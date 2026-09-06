-- Tablă live — "select" tool (js/whiteboard.js): lets a participant drag
-- one of THEIR OWN committed objects to a new spot on the board. This is
-- the first UPDATE this table has ever needed (until now only INSERT/
-- DELETE existed — see 20260904160000_whiteboard_objects.sql), so there
-- was no UPDATE policy at all yet.
--
-- Own objects only, same shape and same reasoning as the existing
-- owner-only DELETE policy: a teacher-moves-anyone's-object policy is the
-- same Phase 2 deferral as a teacher-erases-anyone's-stroke tool (see
-- wb_objects_owner_delete's own comment) — a separate policy lands
-- alongside that tool rather than being added unused now.
create policy wb_objects_owner_update on public.whiteboard_objects for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
