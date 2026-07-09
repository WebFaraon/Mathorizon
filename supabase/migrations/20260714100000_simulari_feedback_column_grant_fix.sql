-- ============================================================
-- Found while live-testing the feedback_text column grant added in the
-- previous migration: a PATCH targeting points_earned (a column that was
-- NEVER explicitly granted to authenticated) still returned 204, not a
-- permission error. Supabase's default project bootstrap runs
-- `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated`
-- for every new table — so `authenticated` already had a blanket UPDATE
-- grant on ALL columns of simulation_answers before this feature existed.
-- `GRANT UPDATE (feedback_text) ... TO authenticated` is purely additive in
-- Postgres — it cannot narrow a privilege that already covers every column.
-- The RLS policy (sim_answers_teacher_update_feedback) only restricts WHICH
-- ROWS, never which columns, so the "a teacher's REST call can only ever
-- touch feedback_text" claim from the previous migration was not actually
-- true until this explicit REVOKE removes the wider default first.
--
-- SECURITY DEFINER functions (submit_simulation_answer, finish_simulation_
-- attempt) are unaffected — they run with the function owner's privileges,
-- not the calling role's grants, so this doesn't touch the exam-taking flow.
-- ============================================================

revoke update on public.simulation_answers from authenticated;
revoke update on public.simulation_answers from anon;

grant update (feedback_text) on public.simulation_answers to authenticated;
