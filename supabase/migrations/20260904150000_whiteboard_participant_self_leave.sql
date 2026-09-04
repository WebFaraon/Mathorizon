-- Lets a participant remove their OWN row when they explicitly close the
-- live-board modal ("leaving" it) — previously there was no delete policy
-- at all on whiteboard_participants (writes only went through
-- join_whiteboard_session), so a student closing the modal had no way to
-- signal "I'm out" and just kept showing as connected to everyone else
-- until the whole session ended.
create policy wb_participants_self_delete on public.whiteboard_participants for delete to authenticated
  using (user_id = auth.uid());
