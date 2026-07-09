-- ============================================================
-- The Simulări tables were never added to the `supabase_realtime`
-- publication — new tables aren't included automatically, unlike
-- the older tables (class_posts, assignments, homework_submissions,
-- class_members) which were already registered before this feature
-- existed. Without this, every `.channel(...).on('postgres_changes', ...)`
-- subscription in class-page.js/simulare-exam.js for these 3 tables
-- silently receives nothing — explaining why the teacher's "x/y
-- finalizat" counter, the live view, and Membri never updated live,
-- and why a student's exam has no way to notice the teacher ended it.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'simulations'
  ) then
    alter publication supabase_realtime add table public.simulations;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'simulation_attempts'
  ) then
    alter publication supabase_realtime add table public.simulation_attempts;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'simulation_answers'
  ) then
    alter publication supabase_realtime add table public.simulation_answers;
  end if;
end $$;
