-- Messages: each participant may delete only their own message — not the
-- teacher moderating everyone else's. Introspection via the temporary
-- _debug_list_policies() helper (previous migration) showed the
-- pre-migrations-folder policy `posts_delete` already is
-- `using (author_id = auth.uid())` — strictly author-only. The
-- class_posts_author_or_teacher_delete policy added in 20260909090000
-- additionally granted the class's teacher delete-any (reasonable for a
-- one-way announcements board where the teacher was always the author
-- anyway, wrong now that anyone can post) — since RLS policies for the
-- same command are OR'd together, that extra grant is dropped here and
-- the original author-only `posts_delete` policy is left to do the job
-- it was already doing.
drop policy if exists class_posts_author_or_teacher_delete on public.class_posts;

-- Cleanup: drop the temporary introspection helper now that it's served
-- its purpose (see 20260909110000).
drop function if exists public._debug_list_policies(text);
