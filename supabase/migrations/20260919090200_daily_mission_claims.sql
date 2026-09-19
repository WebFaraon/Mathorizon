-- ============================================================
-- Daily missions — reward claims.
--
-- Mission DEFINITIONS (title, target, XP reward) live in frontend code
-- (src/capitole/lib/missions.ts), same as BM.CATEGORIES does for chapters
-- — there's no admin UI to author missions yet, so a database table of
-- definitions would just be a second place to keep them in sync with the
-- first. What genuinely needs server-side state is which missions a user
-- has already been paid out for today, so reloading the page (or opening
-- it on another device) never grants the same day's XP twice.
--
-- Progress itself is computed client-side from data that's already real
-- and already synced (BM.Storage.getSolved() timestamps, BM.Storage.
-- getStreak()) — same trust model already established for training_stats
-- ("pure gamification with no grading implication, computed client-side
-- ... a direct owner-scoped policy is proportionate", see
-- 20260807090100_training_stats.sql). The XP itself is granted through
-- the EXISTING BM.Training.addXp() path (js/auth.js), not written here —
-- this table only remembers that today's claim happened.
-- ============================================================

create table if not exists public.user_daily_mission_claims (
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null,
  mission_key text not null,
  xp_awarded  integer not null default 0,
  claimed_at  timestamptz not null default now(),
  primary key (user_id, day, mission_key)
);

alter table public.user_daily_mission_claims enable row level security;

create policy user_daily_mission_claims_owner_select on public.user_daily_mission_claims
  for select to authenticated using (user_id = auth.uid());

create policy user_daily_mission_claims_owner_insert on public.user_daily_mission_claims
  for insert to authenticated with check (user_id = auth.uid());
