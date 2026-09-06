-- Tablă live — grid visibility is a per-SESSION setting the teacher
-- controls, not a per-viewer preference: every participant should see the
-- same grid state the teacher chose, and only the teacher can flip it —
-- same shape as the session's own title (js/class-page.js's
-- _bindTablaTitleInput / _debouncedTablaLive, mirrored for the grid by
-- setGridEnabled in js/whiteboard.js). whiteboard_sessions is already in
-- the supabase_realtime publication and already has a teacher-writes/
-- student-reads RLS split (wb_sessions_teacher_all / wb_sessions_student_select,
-- see 20260904120000_whiteboard.sql), so a plain column plus those
-- existing policies is all this needs — no new policy, no new publication
-- entry.
alter table public.whiteboard_sessions
  add column if not exists grid_enabled boolean not null default false;
