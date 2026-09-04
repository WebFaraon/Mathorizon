-- ============================================================
-- Tablă live — Phase 1: the actual shared drawing surface.
-- One row per FINISHED stroke (not per pointer-move — live in-progress
-- strokes travel over Realtime Broadcast instead, see js/whiteboard.js;
-- this table is only the durable, replayable record of committed work).
-- ============================================================

create table if not exists public.whiteboard_objects (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.whiteboard_sessions(id) on delete cascade,
  -- Denormalized straight onto the row (not looked up via session_id →
  -- whiteboard_sessions), same lesson as whiteboard_participants.class_id
  -- (20260904130000): a realtime-published table's RLS should never hop
  -- through another RLS-protected table to reach the columns it needs —
  -- that's exactly what silently broke live delivery for the roster.
  class_id    uuid not null references public.classes(id) on delete cascade,
  created_by  uuid not null references auth.users(id),
  kind        text not null default 'stroke' check (kind in ('stroke','text')),
  fabric_json jsonb not null,
  seq         bigserial,
  created_at  timestamptz not null default now()
);
create index if not exists whiteboard_objects_session_seq_idx on public.whiteboard_objects(session_id, seq);

-- FULL so a DELETE's realtime payload.old carries the whole deleted row
-- (id included) rather than just whatever DEFAULT identity happens to
-- keep — belt-and-suspenders after the class_members incident; the id is
-- all js/whiteboard.js actually needs, but default identity already
-- guarantees the primary key survives a delete, so this is float rather
-- than a fix for something observed broken.
alter table public.whiteboard_objects replica identity full;

alter table public.whiteboard_objects enable row level security;

create policy wb_objects_select on public.whiteboard_objects for select to authenticated
  using (
    exists (select 1 from public.classes c where c.id = whiteboard_objects.class_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.class_members cm where cm.class_id = whiteboard_objects.class_id and cm.student_id = auth.uid())
  );

-- Insert: caller must own the row (created_by can't be spoofed to someone
-- else's id) and the session must still be live — no drawing into an
-- already-ended session via a stale client.
create policy wb_objects_insert on public.whiteboard_objects for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.whiteboard_sessions s
      where s.id = whiteboard_objects.session_id and s.status = 'live' and s.class_id = whiteboard_objects.class_id
    )
    and (
      exists (select 1 from public.classes c where c.id = whiteboard_objects.class_id and c.teacher_id = auth.uid())
      or exists (select 1 from public.class_members cm where cm.class_id = whiteboard_objects.class_id and cm.student_id = auth.uid())
    )
  );

-- Delete: own objects only for now ("Șterge ce am desenat eu" — Phase 1
-- scope, confirmed with the founder). Teacher-deletes-anyone's-stroke
-- (the real per-line eraser tool) is Phase 2 — a separate policy lands
-- alongside that tool rather than being added unused now.
create policy wb_objects_owner_delete on public.whiteboard_objects for delete to authenticated
  using (created_by = auth.uid());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='whiteboard_objects') then
    alter publication supabase_realtime add table public.whiteboard_objects;
  end if;
end $$;
