-- Realtime reliability fix for whiteboard_participants.
--
-- Observed in testing: a teacher's already-open live roster modal did not
-- pick up a newly-joined student until the modal was closed and reopened —
-- the initial fetch always worked (plain PostgREST), but the live
-- postgres_changes push did not arrive.
--
-- Root cause: wb_participants_select's USING clause reached class_id by
-- hopping through whiteboard_sessions (itself an RLS-protected table),
-- which in turn re-evaluates ITS OWN policies against classes/
-- class_members — a nested, multi-table dependency chain for something
-- that's supposed to be a cheap per-row realtime authorization check.
-- Supabase's own guidance for realtime-published tables is to keep their
-- RLS policies flat, ideally a single non-nested check, precisely to
-- avoid this. whiteboard_sessions.status watch (already flat, one hop to
-- classes/class_members, same shape as simulations' proven-working
-- policy) was never the suspect — only whiteboard_participants was.
--
-- Fix: denormalize class_id directly onto whiteboard_participants so its
-- SELECT policy no longer needs whiteboard_sessions as a stepping stone.

alter table public.whiteboard_participants add column if not exists class_id uuid references public.classes(id) on delete cascade;

update public.whiteboard_participants p
  set class_id = s.class_id
  from public.whiteboard_sessions s
  where s.id = p.session_id and p.class_id is null;

alter table public.whiteboard_participants alter column class_id set not null;
create index if not exists whiteboard_participants_class_id_idx on public.whiteboard_participants(class_id);

drop policy if exists wb_participants_select on public.whiteboard_participants;
create policy wb_participants_select on public.whiteboard_participants for select to authenticated
  using (
    exists (select 1 from public.classes c where c.id = whiteboard_participants.class_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.class_members cm where cm.class_id = whiteboard_participants.class_id and cm.student_id = auth.uid())
  );

-- join_whiteboard_session now populates class_id on insert.
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

  select * into v_row from whiteboard_participants where session_id = p_session_id and user_id = auth.uid();
  if v_row.id is not null then return v_row; end if;

  if v_is_teacher then
    v_color := '#111827';
  else
    perform pg_advisory_xact_lock(hashtext(p_session_id::text));
    select array_agg(color) into v_used from whiteboard_participants where session_id = p_session_id;
    select c into v_color from unnest(v_palette) c where c <> all (coalesce(v_used, array[]::text[])) limit 1;
    if v_color is null then
      v_color := v_palette[1 + (coalesce(array_length(v_used,1),0) % array_length(v_palette,1))];
    end if;
  end if;

  insert into whiteboard_participants (session_id, class_id, user_id, display_name, role, color)
    values (p_session_id, v_session.class_id, auth.uid(), p_display_name, case when v_is_teacher then 'profesor' else 'elev' end, v_color)
    on conflict (session_id, user_id) do nothing
    returning * into v_row;

  if v_row.id is null then
    select * into v_row from whiteboard_participants where session_id = p_session_id and user_id = auth.uid();
  end if;
  return v_row;
end $$;

grant execute on function public.join_whiteboard_session(uuid, text) to authenticated;
