-- ============================================================
-- Fix a pre-existing bug that silently broke the ENTIRE expiry sweep,
-- found while verifying 20260714150000 (auto-start scheduled sims).
--
-- Both finalize_expired_simulation_attempts() (20260710090000) and
-- close_expired_simulations() (20260714110000) wrote:
--
--   update simulation_attempts a
--   set ...
--   from simulations s
--   left join lateral (
--     select sum(points_earned) as pts from simulation_answers where attempt_id = a.id
--   ) sub on true
--   ...
--
-- Postgres rejects this: a LATERAL subquery in the FROM list may only
-- correlate with FROM items that precede it IN THAT SAME FROM LIST —
-- the UPDATE target's alias (`a`) is not itself a member of the FROM
-- list (it's referenceable in WHERE/ON, just not from LATERAL), so
-- both functions raised "invalid reference to FROM-clause entry for
-- table a" on every single call.
--
-- Every call site wraps the RPC in try{}catch(e){} client-side
-- (defensive-fallback comments say as much), and pg_cron swallows
-- failures into its own job-run log rather than surfacing anywhere
-- visible — so this has been failing silently since 2026-07-10
-- (finalize) / 2026-07-14 (close) with nobody noticing: no attempt has
-- ever been auto-finalized past its deadline, and no simulation has
-- ever been auto-closed, via this path. It surfaced now because
-- run_simulation_expiry_sweep() bundles all three sweeps into one
-- statement (20260714150000) — a mid-chain exception in either broken
-- function rolled back the whole call, including the otherwise-working
-- start_scheduled_simulations() update, since a single top-level SQL
-- call is one atomic transaction.
--
-- Fix: replace the LATERAL correlated subquery with a plain pre-
-- aggregated subquery (GROUP BY attempt_id) joined via a normal ON
-- condition — referencing the target alias in a join's ON clause is
-- fine, only LATERAL's restricted correlation scope was the problem.
-- Logic is otherwise unchanged.
-- ============================================================

create or replace function public.finalize_expired_simulation_attempts(p_simulation_id uuid default null)
returns void
security definer set search_path = public
language plpgsql as $$
begin
  update simulation_attempts a
  set status = 'finalizata',
      finished_at = now(),
      earned_points = coalesce(sub.pts, 0),
      grade_10 = round((1 + 9 * (coalesce(sub.pts, 0) / nullif(a.total_points, 0)))::numeric * 2) / 2
  from simulations s
  left join (
    select attempt_id, sum(points_earned) as pts from simulation_answers group by attempt_id
  ) sub on sub.attempt_id = a.id
  where a.simulation_id = s.id
    and a.status = 'in_progres'
    and now() > a.started_at + (s.time_limit_minutes || ' minutes')::interval
    and (p_simulation_id is null or a.simulation_id = p_simulation_id);
end $$;

create or replace function public.close_expired_simulations()
returns void
security definer set search_path = public
language plpgsql as $$
begin
  update simulation_attempts a
  set status = 'finalizata',
      finished_at = now(),
      earned_points = coalesce(sub.pts, 0),
      grade_10 = round((1 + 9 * (coalesce(sub.pts, 0) / nullif(a.total_points, 0)))::numeric * 2) / 2
  from simulations s
  left join (
    select attempt_id, sum(points_earned) as pts from simulation_answers group by attempt_id
  ) sub on sub.attempt_id = a.id
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
