-- ============================================================
-- Antrenament — cached AI-generated multiple-choice options
-- One row per exercise, shared across every student. Generated
-- lazily by api/training/generate-mcq-options.js the first time
-- an exercise with a non-typeable answer is opened in training,
-- then reused by everyone after that (never bulk-pregenerated).
-- ============================================================

create table if not exists public.training_mcq_cache (
  exercise_id     text primary key,
  correct_answer  text not null,
  distractors     jsonb not null,   -- array of exactly 3 strings
  model_version   text not null default 'gemini-3.5-flash',
  created_at      timestamptz not null default now()
);

alter table public.training_mcq_cache enable row level security;

-- Open read — cached quiz content isn't sensitive, and a logged-out
-- guest should still benefit from a cache another student already
-- warmed (only *generating* a new entry requires a session).
create policy training_mcq_cache_select on public.training_mcq_cache
  for select to public using (true);

-- Deliberately NO insert/update/delete policy for any client role.
-- All writes go through api/training/generate-mcq-options.js using
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely — this is
-- the first table in the codebase to use that key (previously
-- defined in .env but unused everywhere else). Without this, a
-- malicious client could POST directly with their own JWT + the
-- anon key and pollute the shared distractor cache for every other
-- student who opens that exercise afterwards.
