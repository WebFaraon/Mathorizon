-- ============================================================
-- Antrenament — persistent per-student lifetime stats
-- Lifetime XP + best training-session streak, tied to the
-- account so it's visible across devices. "Exercises solved" is
-- already covered by the existing user_solved table/sync — this
-- only adds the two values that had no persistence before.
--
-- Uses direct owner-scoped RLS (client PATCHes its own row),
-- matching the exam_tokens precedent, NOT the newer SECURITY
-- DEFINER RPC convention used for real grading data (see
-- simulari.sql) — XP/streak here are pure gamification with no
-- grading implication, computed client-side exactly like
-- sessionXp/currentStreak already are today, so a direct
-- owner-scoped UPDATE policy is proportionate.
-- ============================================================

create table if not exists public.training_stats (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  total_xp     integer not null default 0,
  best_streak  integer not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.training_stats enable row level security;

create policy training_stats_owner_select on public.training_stats
  for select to authenticated using (user_id = auth.uid());

create policy training_stats_owner_insert on public.training_stats
  for insert to authenticated with check (user_id = auth.uid());

create policy training_stats_owner_update on public.training_stats
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
