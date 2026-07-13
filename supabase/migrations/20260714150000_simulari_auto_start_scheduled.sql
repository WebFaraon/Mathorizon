-- ============================================================
-- Auto-start scheduled simulations at their own scheduled_at,
-- mirroring close_expired_simulations() (20260714110000) for the
-- opposite edge of a simulation's lifecycle.
--
-- Until now: a simulation created with "Programează" sat in status
-- 'programata' forever until the teacher opened the class page and
-- clicked "Pornește acum" by hand — scheduled_at was purely
-- informational, nothing ever read it to flip the status. A teacher
-- who scheduled a simulation for 15:00 and wasn't watching the clock
-- found it still 'programata' (invisible to students — see the
-- `simList.filter(s => s.status !== 'programata')` in loadSimulariTab)
-- well past 15:00.
--
-- start_scheduled_simulations() closes that gap: once scheduled_at has
-- passed for a still-'programata' simulation, it flips status to
-- 'activa' and sets started_at = scheduled_at (not now()) so the exam
-- window is exactly what the teacher configured (e.g. scheduled for
-- 15:00 with a 50-minute limit closes at 15:50 regardless of the up-to
-- -a-minute pg_cron lag) — same reasoning reopenSimulation() and
-- close_expired_simulations() already rely on started_at for.
--
-- Folded into run_simulation_expiry_sweep() rather than a separate cron
-- entry: that function already runs every minute via pg_cron AND from
-- three lazy client call sites (loadMembriTab, loadSimulariTab,
-- _refreshSimLiveBody), and `simulations` is already in the
-- supabase_realtime publication with class-page.js subscribed to its
-- UPDATEs (_setupRealtime's `_debouncedSimulari` handler) — so the
-- status flip reaches any open teacher/student class page live, no
-- extra client code needed.
-- ============================================================

create or replace function public.start_scheduled_simulations()
returns void
security definer set search_path = public
language plpgsql as $$
begin
  update simulations
  set status = 'activa',
      started_at = scheduled_at
  where status = 'programata'
    and scheduled_at is not null
    and now() >= scheduled_at;
end $$;

revoke execute on function public.start_scheduled_simulations() from public;
revoke execute on function public.start_scheduled_simulations() from anon;
grant execute on function public.start_scheduled_simulations() to authenticated;

create or replace function public.run_simulation_expiry_sweep()
returns void
security definer set search_path = public
language plpgsql as $$
begin
  perform public.start_scheduled_simulations();
  perform public.finalize_expired_simulation_attempts(null);
  perform public.close_expired_simulations();
end $$;
