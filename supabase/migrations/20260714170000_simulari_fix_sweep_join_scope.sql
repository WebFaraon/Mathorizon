-- ============================================================
-- Second attempt at the sweep fix — 20260714160000 didn't actually
-- work (re-verified via RPC: same "invalid reference to FROM-clause
-- entry for table a" error). Diagnosis was half-right: the problem was
-- never specifically about LATERAL — it's that an explicit `JOIN ...
-- ON` clause in an UPDATE's FROM list can only see its own two join
-- operands, never the UPDATE target's alias, whether or not the join
-- is LATERAL. 20260714160000 kept the explicit `left join (...) sub on
-- sub.attempt_id = a.id`, which still references target alias `a` from
-- inside a JOIN's ON clause — same illegal reference, just without the
-- LATERAL keyword.
--
-- The one correlation that DID already work in the original code was
-- `from simulations s ... where a.simulation_id = s.id` — a comma-style
-- (implicit-join) FROM item correlated via WHERE, not an explicit JOIN.
-- WHERE has full visibility of every range-table entry, including the
-- UPDATE target — that's the one pattern Postgres actually allows here.
--
-- Fix: drop the JOIN entirely. Pre-aggregate points per attempt in a
-- CTE that already accounts for zero-answer attempts (via a LEFT JOIN
-- *inside* the CTE, between two ordinary tables — not the update
-- target, so that join is unrestricted), then bring it into the UPDATE
-- as another comma-style FROM item, correlated only through WHERE.
-- ============================================================

create or replace function public.finalize_expired_simulation_attempts(p_simulation_id uuid default null)
returns void
security definer set search_path = public
language plpgsql as $$
begin
  with pts as (
    select att.id as attempt_id, coalesce(sum(sa.points_earned), 0) as total
    from simulation_attempts att
    left join simulation_answers sa on sa.attempt_id = att.id
    where att.status = 'in_progres'
    group by att.id
  )
  update simulation_attempts a
  set status = 'finalizata',
      finished_at = now(),
      earned_points = pts.total,
      grade_10 = round((1 + 9 * (pts.total / nullif(a.total_points, 0)))::numeric * 2) / 2
  from simulations s, pts
  where a.simulation_id = s.id
    and a.id = pts.attempt_id
    and a.status = 'in_progres'
    and now() > a.started_at + (s.time_limit_minutes || ' minutes')::interval
    and (p_simulation_id is null or a.simulation_id = p_simulation_id);
end $$;

create or replace function public.close_expired_simulations()
returns void
security definer set search_path = public
language plpgsql as $$
begin
  with pts as (
    select att.id as attempt_id, coalesce(sum(sa.points_earned), 0) as total
    from simulation_attempts att
    left join simulation_answers sa on sa.attempt_id = att.id
    where att.status = 'in_progres'
    group by att.id
  )
  update simulation_attempts a
  set status = 'finalizata',
      finished_at = now(),
      earned_points = pts.total,
      grade_10 = round((1 + 9 * (pts.total / nullif(a.total_points, 0)))::numeric * 2) / 2
  from simulations s, pts
  where a.simulation_id = s.id
    and a.id = pts.attempt_id
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
