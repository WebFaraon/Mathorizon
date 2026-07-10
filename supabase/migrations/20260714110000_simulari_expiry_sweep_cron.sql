-- ============================================================
-- Auto-close simulations at their own deadline, on a schedule —
-- not just lazily when a teacher/student happens to open a page.
--
-- Until now: finalize_expired_simulation_attempts() only settled
-- individual ATTEMPT rows past *their own* started_at + time_limit,
-- and only ran when a client happened to call it from loadMembriTab/
-- loadSimulariTab/_refreshSimLiveBody. It never touched
-- simulations.status — a simulation stayed 'activa' forever unless
-- the teacher clicked "Încheie" by hand. Result: a teacher who
-- doesn't reopen the class page after the time limit passes finds
-- the simulation still "active" and a stuck 'in_progres' attempt
-- days later, with no student present.
--
-- close_expired_simulations() adds the missing piece: once a
-- simulation's OWN clock (started_at + time_limit_minutes) has
-- passed, it force-finalizes every remaining in_progres attempt
-- for it (settling with whatever was submitted so far) and flips
-- simulations.status to 'incheiata' — exactly the same write
-- endSimulation() does by hand. Because `simulations` is already in
-- the supabase_realtime publication (see
-- 20260711090000_simulari_realtime_publication.sql) and
-- simulare-exam.js already subscribes to UPDATEs on its own
-- simulation row to force-finish the student the instant the
-- teacher hits "Încheie" (js/simulare-exam.js:_watchSimulationStatus),
-- this automatic status flip is picked up by that exact same
-- listener — a student mid-exam gets kicked to the results screen
-- within a second or two of the deadline, no extra client code
-- needed.
--
-- run_simulation_expiry_sweep() bundles both this and the existing
-- per-attempt function into one call, scheduled every minute via
-- pg_cron so it runs regardless of whether anyone ever opens the
-- class page again. The three existing lazy JS call sites are also
-- switched to call this combined sweep instead, as a defensive
-- fallback in case pg_cron isn't available on this Supabase plan —
-- either path now closes the simulation itself, not just attempts.
-- ============================================================

create or replace function public.close_expired_simulations()
returns void
security definer set search_path = public
language plpgsql as $$
begin
  -- Settle every attempt still in progress once its OWN simulation's
  -- deadline has passed — overrides any later per-attempt deadline
  -- (a student who started late doesn't get more time than the exam
  -- window itself allows once the whole simulation is closing).
  update simulation_attempts a
  set status = 'finalizata',
      finished_at = now(),
      earned_points = coalesce(sub.pts, 0),
      grade_10 = round((1 + 9 * (coalesce(sub.pts, 0) / nullif(a.total_points, 0)))::numeric * 2) / 2
  from simulations s
  left join lateral (
    select sum(points_earned) as pts from simulation_answers where attempt_id = a.id
  ) sub on true
  where a.simulation_id = s.id
    and a.status = 'in_progres'
    and s.status = 'activa'
    and s.started_at is not null
    and now() > s.started_at + (s.time_limit_minutes || ' minutes')::interval;

  update simulations s
  set status = 'incheiata'
  where s.status = 'activa'
    and s.started_at is not null
    and now() > s.started_at + (s.time_limit_minutes || ' minutes')::interval;
end $$;

revoke execute on function public.close_expired_simulations() from public;
revoke execute on function public.close_expired_simulations() from anon;
grant execute on function public.close_expired_simulations() to authenticated;

create or replace function public.run_simulation_expiry_sweep()
returns void
security definer set search_path = public
language plpgsql as $$
begin
  perform public.finalize_expired_simulation_attempts(null);
  perform public.close_expired_simulations();
end $$;

revoke execute on function public.run_simulation_expiry_sweep() from public;
revoke execute on function public.run_simulation_expiry_sweep() from anon;
grant execute on function public.run_simulation_expiry_sweep() to authenticated;

-- ── Schedule: every minute, independent of any page being open ──
-- If this project's Supabase plan/role can't create extensions, this
-- block fails loudly (on purpose) rather than silently leaving
-- simulations un-swept — enable "pg_cron" under Database → Extensions
-- in the Supabase dashboard, then re-run just this last statement.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'mathorizon-simulation-expiry-sweep',
  '* * * * *',
  $$ select public.run_simulation_expiry_sweep(); $$
);
