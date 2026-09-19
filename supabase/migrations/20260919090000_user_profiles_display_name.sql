-- Denormalized display name on user_profiles — same pattern already used
-- for classes.teacher_name / class_members.manager_name / teacher_reviews
-- .student_name: auth.users isn't exposed to PostgREST, so anything that
-- needs to show ANOTHER user's name (the Capitole leaderboard, next)
-- reads it from here instead of joining auth.users.
--
-- Populated by js/auth.js's _syncUserProfile(), which already runs on
-- every sign-in — same computation _displayName() already does client-
-- side (full_name → name → email prefix), just also written to a column
-- other users' clients can eventually read (via the leaderboard RPC,
-- which runs security definer — this column itself stays behind the
-- existing owner-only RLS like the rest of the row).

alter table public.user_profiles
  add column if not exists display_name text;
