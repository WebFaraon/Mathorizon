-- ============================================================
-- Storage RLS on the "avatars" bucket was originally set up outside
-- migrations (via the dashboard) to allow each user to write only an
-- exact "<uid>.jpg" object. The new teacher profile cover-photo upload
-- (profile-page.js) writes "<uid>-cover.jpg" instead — confirmed live:
-- that upload failed with "new row violates row-level security policy"
-- because the existing policy doesn't match that filename.
--
-- Additive only (a new policy name — OR'd with whatever already exists,
-- same reasoning as the classes_teacher_update policy earlier): scoped to
-- any object name PREFIXED by the user's own id in the avatars bucket, so
-- it covers both "<uid>.jpg" and "<uid>-cover.jpg" without needing to
-- know or touch the exact wording of the original dashboard-created
-- policy. Still fully self-scoped — no cross-user access granted.
-- ============================================================

drop policy if exists avatars_own_prefix_all on storage.objects;
create policy avatars_own_prefix_all on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and name like (auth.uid()::text || '%'))
  with check (bucket_id = 'avatars' and name like (auth.uid()::text || '%'));
