-- ============================================================
-- Tablă live — Phase 0: session lifecycle + participant roster.
-- No drawing yet (whiteboard_objects lands in a later migration,
-- once the canvas itself is built) — this phase only proves out
-- start/join/end + stable per-participant colors end-to-end.
-- ============================================================

-- ── whiteboard_sessions — one row per live session ───────────
create table if not exists public.whiteboard_sessions (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title      text not null default 'Tablă live',
  status     text not null default 'live' check (status in ('live','ended')),
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  snapshot   jsonb,  -- filled in a later phase, once there's a canvas to snapshot
  created_at timestamptz not null default now()
);
create index if not exists whiteboard_sessions_class_id_idx on public.whiteboard_sessions(class_id);

-- "One live board per teacher at a time" — literally per teacher, not per
-- class, so a teacher can't have two simultaneous live boards even across
-- two different classes. A plain client INSERT that races this constraint
-- fails with 23505, same as the invite-code collision already handled in
-- classes-page.js — the UI catches that code and shows a friendly toast
-- rather than a raw DB error.
create unique index if not exists whiteboard_sessions_one_live_per_teacher_idx
  on public.whiteboard_sessions(created_by) where status = 'live';

-- ── whiteboard_participants — roster + STABLE per-session color ─
create table if not exists public.whiteboard_participants (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.whiteboard_sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  display_name text,
  role         text not null check (role in ('profesor','elev')),
  color        text not null,
  joined_at    timestamptz not null default now(),
  unique (session_id, user_id)
);
create index if not exists whiteboard_participants_session_id_idx on public.whiteboard_participants(session_id);

alter table public.whiteboard_sessions     enable row level security;
alter table public.whiteboard_participants enable row level security;

-- Sessions: teacher (class owner) full CRUD — the same UPDATE that ends a
-- session (status='ended') is just a normal write under this policy, no
-- separate RPC needed, mirroring how simulations.status is flipped today.
create policy wb_sessions_teacher_all on public.whiteboard_sessions for all to authenticated
  using (exists (
    select 1 from public.classes c where c.id = whiteboard_sessions.class_id and c.teacher_id = auth.uid()
  ))
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.classes c where c.id = whiteboard_sessions.class_id and c.teacher_id = auth.uid())
  );

create policy wb_sessions_student_select on public.whiteboard_sessions for select to authenticated
  using (exists (
    select 1 from public.class_members cm
    where cm.class_id = whiteboard_sessions.class_id and cm.student_id = auth.uid()
  ));

-- Participants: readable by anyone in the class (teacher or member) —
-- writable ONLY through join_whiteboard_session below (no insert/update
-- policy at all), same "no direct writes to derived roster state" shape
-- Simulări uses for simulation_attempts.
create policy wb_participants_select on public.whiteboard_participants for select to authenticated
  using (exists (
    select 1 from public.whiteboard_sessions s
    where s.id = whiteboard_participants.session_id
      and (
        exists (select 1 from public.classes c where c.id = s.class_id and c.teacher_id = auth.uid())
        or exists (select 1 from public.class_members cm where cm.class_id = s.class_id and cm.student_id = auth.uid())
      )
  ));

-- ============================================================
-- join_whiteboard_session — the ONLY writer of whiteboard_participants.
-- Needed as an RPC (not a raw insert) for one reason: atomic, race-safe
-- color assignment — two students joining in the same millisecond must
-- not land on the same color, which a plain "read roster, pick next free
-- color, insert" from two clients would race. pg_advisory_xact_lock
-- serializes assignment per session; the unique(session_id,user_id) row
-- makes reconnects idempotent (existing row found → same color returned,
-- never reassigned). Teacher always gets a reserved color, never drawn
-- from the student palette, so their ink stays recognizable across every
-- session regardless of who else has joined.
-- ============================================================
create or replace function public.join_whiteboard_session(p_session_id uuid, p_display_name text)
returns public.whiteboard_participants
security definer set search_path = public
language plpgsql as $$
declare
  v_session    public.whiteboard_sessions;
  v_is_teacher boolean;
  v_row        public.whiteboard_participants;
  v_color      text;
  v_palette    text[] := array['#e11d48','#2563eb','#16a34a','#d97706','#7c3aed','#0891b2','#db2777','#65a30d'];
  v_used       text[];
begin
  select * into v_session from whiteboard_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'session not found'; end if;
  if v_session.status <> 'live' then raise exception 'session not live'; end if;

  select exists(select 1 from classes c where c.id = v_session.class_id and c.teacher_id = auth.uid()) into v_is_teacher;
  if not v_is_teacher and not exists (
    select 1 from class_members cm where cm.class_id = v_session.class_id and cm.student_id = auth.uid()
  ) then
    raise exception 'not a member of this class';
  end if;

  -- Reconnect: same color as before, no reassignment.
  select * into v_row from whiteboard_participants where session_id = p_session_id and user_id = auth.uid();
  if v_row.id is not null then return v_row; end if;

  if v_is_teacher then
    v_color := '#111827'; -- reserved teacher color, never drawn from the student palette
  else
    perform pg_advisory_xact_lock(hashtext(p_session_id::text));
    select array_agg(color) into v_used from whiteboard_participants where session_id = p_session_id;
    select c into v_color from unnest(v_palette) c where c <> all (coalesce(v_used, array[]::text[])) limit 1;
    if v_color is null then
      v_color := v_palette[1 + (coalesce(array_length(v_used,1),0) % array_length(v_palette,1))]; -- >8 concurrent: cycle
    end if;
  end if;

  insert into whiteboard_participants (session_id, user_id, display_name, role, color)
    values (p_session_id, auth.uid(), p_display_name, case when v_is_teacher then 'profesor' else 'elev' end, v_color)
    on conflict (session_id, user_id) do nothing
    returning * into v_row;

  if v_row.id is null then
    select * into v_row from whiteboard_participants where session_id = p_session_id and user_id = auth.uid();
  end if;
  return v_row;
end $$;

grant execute on function public.join_whiteboard_session(uuid, text) to authenticated;

-- ============================================================
-- Realtime publication — new tables are NOT auto-added (Simulări
-- discovered this the hard way, see 20260711090000_simulari_realtime_
-- publication.sql; doing it right here from the start instead).
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='whiteboard_sessions') then
    alter publication supabase_realtime add table public.whiteboard_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='whiteboard_participants') then
    alter publication supabase_realtime add table public.whiteboard_participants;
  end if;
end $$;
