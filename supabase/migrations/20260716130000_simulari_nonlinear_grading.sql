-- ============================================================
-- Replace the linear grade_10 = 1 + 9*(earned/total) conversion with
-- the real, non-linear official ANCE conversion table (Evaluarea
-- Națională / BAC), whose lower-bound percentage per grade is read off
-- the 50-point table: 0, 1, 5, 9, 13, 21, 29, 37, 45, 48 out of 50 —
-- i.e. 0%, 2%, 10%, 18%, 26%, 42%, 58%, 74%, 90%, 96%. The bands are
-- deliberately uneven (wide in the middle, narrow at the very top) —
-- a flat 1+9p formula was too harsh on a single small mistake and too
-- forgiving on the "you barely tried" end.
--
-- Every simulation has its own total_points (whatever the teacher's
-- items sum to), so the percentages must be rescaled per attempt
-- rather than hard-coded for 50. Naively rounding each threshold to
-- the nearest point breaks for small/odd totals — e.g. total=8 gives
-- raw thresholds 0,0,1,1,2,3,5,6,7,8, where grades 2 and 4 collide
-- with their neighbor and become unreachable. _sim_grade_from_points()
-- guards against that by bumping any threshold up to stay strictly
-- above the previous one, and by always returning 10 for a perfect
-- score regardless of rounding.
--
-- The official table itself is a flat step function (every score in a
-- band gets the exact same whole grade), but this app has always shown
-- half-point grades (8.5, not a flat 8 or 9) — losing that granularity
-- would make close attempts within the same wide band indistinguishable.
-- So instead of a step lookup, the per-grade thresholds are used as
-- anchor points (thr[i] points -> grade i) and the grade is linearly
-- interpolated *between* consecutive anchors, then rounded to the
-- nearest 0.5 — same non-linear band widths (a mistake inside the wide
-- 42%-58% band moves the grade much less than one inside the narrow
-- 90%-96% band), but still a smooth, half-point-capable curve rather
-- than flat steps.
-- ============================================================

create or replace function public._sim_grade_from_points(earned numeric, total numeric) returns numeric
language plpgsql immutable as $$
declare
  pct   numeric[] := array[0, 0.02, 0.10, 0.18, 0.26, 0.42, 0.58, 0.74, 0.90, 0.96];
  thr   numeric[] := array[0,0,0,0,0,0,0,0,0,0];
  i     int;
  e     numeric;
  grade numeric := 10;
begin
  if total is null or total <= 0 or earned is null then return null; end if;

  e := greatest(0, least(earned, total));
  if e >= total then return 10; end if;

  for i in 1..10 loop
    thr[i] := round(pct[i] * total);
    if i > 1 and thr[i] <= thr[i-1] then
      thr[i] := thr[i-1] + 1;
    end if;
  end loop;

  for i in 1..9 loop
    if e < thr[i+1] then
      grade := i + (e - thr[i]) / (thr[i+1] - thr[i]);
      exit;
    end if;
  end loop;

  grade := round(grade * 2) / 2;
  return least(10, greatest(1, grade));
end $$;

revoke execute on function public._sim_grade_from_points(numeric, numeric) from public;
revoke execute on function public._sim_grade_from_points(numeric, numeric) from anon;

-- ---- Same three call sites that used to inline the linear formula ----

create or replace function public.finish_simulation_attempt(p_attempt_id uuid)
returns public.simulation_attempts
security definer set search_path = public
language plpgsql as $$
declare v_attempt public.simulation_attempts; v_earned numeric;
begin
  select * into v_attempt from simulation_attempts where id = p_attempt_id;
  if v_attempt.id is null or v_attempt.student_id is distinct from auth.uid() then raise exception 'not your attempt'; end if;

  select coalesce(sum(points_earned),0) into v_earned from simulation_answers where attempt_id = p_attempt_id;

  update simulation_attempts
    set status = 'finalizata',
        finished_at = now(),
        earned_points = v_earned,
        grade_10 = public._sim_grade_from_points(v_earned, total_points)
    where id = p_attempt_id
    returning * into v_attempt;
  return v_attempt;
end $$;

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
      grade_10 = public._sim_grade_from_points(pts.total, a.total_points)
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
      grade_10 = public._sim_grade_from_points(pts.total, a.total_points)
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
