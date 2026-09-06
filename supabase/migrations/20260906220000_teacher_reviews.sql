-- ============================================================
-- Foundation for the teacher "public profile" page (profile.html):
-- a reviews/rating table so the display side (average rating + review
-- list) has real data to query. The submission flow (where a student
-- actually leaves a review) is a separate, not-yet-built feature — this
-- table just needs to exist and be readable so the profile page's
-- reviews section isn't hardcoded to an empty state forever.
--
-- One review per (teacher, student) pair — a student can update their
-- existing review later (once that UI exists) rather than stacking
-- duplicates.
-- ============================================================

create table if not exists public.teacher_reviews (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (teacher_id, student_id)
);

create index if not exists teacher_reviews_teacher_id_idx on public.teacher_reviews(teacher_id);

alter table public.teacher_reviews enable row level security;

-- Read-only for now (no insert/update/delete policy — nothing can write
-- yet since the submission flow doesn't exist). Scoped to authenticated
-- rather than public/anon since the profile page isn't publicly routable
-- yet either; widen this when that ships.
drop policy if exists teacher_reviews_select on public.teacher_reviews;
create policy teacher_reviews_select on public.teacher_reviews for select to authenticated
  using (true);
