-- ============================================================
-- Tablă live — per-participant "lock writing" toggle.
-- Lets the teacher block a specific student from drawing (deliberate
-- disruption, or just an accidental touch mid-lesson) without ending the
-- session or touching anyone else's ability to draw. Enforced in two
-- places, not just one: js/whiteboard.js refuses to start a new stroke
-- client-side the instant the lock lands (a same-tick UX nicety, synced
-- live through the existing whiteboard_participants realtime subscription
-- in js/class-page.js), and — the actual guarantee — wb_objects_insert's
-- RLS check below, so a stale or tampered client can't just ignore the
-- flag and insert anyway.
-- ============================================================

alter table public.whiteboard_participants add column if not exists locked boolean not null default false;

-- wb_objects_insert (20260904160000) already checks the session is live
-- and the caller is a teacher/member of the class — this just adds "and
-- not locked" to that same check, one extra join to whiteboard_participants
-- keyed on (session_id, user_id), which is already covered by that table's
-- own unique(session_id, user_id) index.
drop policy if exists wb_objects_insert on public.whiteboard_objects;
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
    and not coalesce((
      select p.locked from public.whiteboard_participants p
      where p.session_id = whiteboard_objects.session_id and p.user_id = auth.uid()
    ), false)
  );

-- ============================================================
-- set_whiteboard_participant_locked — the only writer of .locked.
-- Teacher-of-the-class only, same shape as every other teacher-gated write
-- in this schema (endWhiteboard's UPDATE, wb_sessions_teacher_all) — a
-- plain UPDATE policy would work too, but an RPC keeps the "must be THIS
-- session's teacher, not just any teacher" check in one place rather than
-- duplicated between a policy and every call site that might ever write
-- this column.
-- ============================================================
create or replace function public.set_whiteboard_participant_locked(p_session_id uuid, p_user_id uuid, p_locked boolean)
returns public.whiteboard_participants
security definer set search_path = public
language plpgsql as $$
declare
  v_session public.whiteboard_sessions;
  v_row     public.whiteboard_participants;
begin
  select * into v_session from whiteboard_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'session not found'; end if;
  if not exists (select 1 from classes c where c.id = v_session.class_id and c.teacher_id = auth.uid()) then
    raise exception 'only the teacher can lock/unlock a participant';
  end if;

  update whiteboard_participants set locked = p_locked
    where session_id = p_session_id and user_id = p_user_id
    returning * into v_row;

  if v_row.id is null then raise exception 'participant not found'; end if;
  return v_row;
end $$;

grant execute on function public.set_whiteboard_participant_locked(uuid, uuid, boolean) to authenticated;
