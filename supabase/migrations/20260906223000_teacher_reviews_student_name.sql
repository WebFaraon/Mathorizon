-- ============================================================
-- Denormalized reviewer display name, captured at submission time —
-- same pattern already used for classes.teacher_name and
-- class_members.manager_name. Avoids needing a join against auth.users
-- (not exposed to PostgREST) just to show who left a review.
-- ============================================================

alter table public.teacher_reviews add column if not exists student_name text;
