-- ============================================================
-- Fixes two issues found while testing 20260708120000_simulari.sql:
--
-- 1. submit_simulation_answer / finish_simulation_attempt compared
--    `v_attempt.student_id <> auth.uid()` directly. When called by
--    an unauthenticated (anon) request, auth.uid() is NULL, and in
--    SQL/plpgsql `x <> NULL` evaluates to NULL — which `IF ... THEN`
--    treats as false, NOT true. So the ownership check silently
--    passed instead of raising, letting an anonymous caller with a
--    guessed attempt_id write/finish someone else's attempt.
--    Fixed with `IS DISTINCT FROM`, which is NULL-safe.
--
-- 2. Postgres grants EXECUTE on new functions to PUBLIC by default;
--    the original migration only added a grant to `authenticated`
--    without revoking the PUBLIC default, so `anon` could call these
--    functions too (confirmed live: an anon apikey-only request to
--    start_simulation_attempt executed the function body instead of
--    being rejected outright). Revoked explicitly below.
-- ============================================================

create or replace function public.submit_simulation_answer(p_attempt_id uuid, p_item_id uuid, p_answer_text text)
returns public.simulation_answers
security definer set search_path = public
language plpgsql as $$
declare v_attempt public.simulation_attempts; v_key text; v_points numeric; v_correct boolean; v_row public.simulation_answers;
begin
  select * into v_attempt from simulation_attempts where id = p_attempt_id;
  if v_attempt.id is null or v_attempt.student_id is distinct from auth.uid() then raise exception 'not your attempt'; end if;
  if v_attempt.status <> 'in_progres' then raise exception 'attempt already finished'; end if;

  select correct_answer into v_key from simulation_answer_keys where simulation_item_id = p_item_id;
  select points into v_points from simulation_items where id = p_item_id;
  if v_points is null then raise exception 'item not found'; end if;
  v_correct := public._sim_answers_match(p_answer_text, v_key);

  insert into simulation_answers (attempt_id, simulation_item_id, answer_text, is_correct, points_earned)
    values (p_attempt_id, p_item_id, p_answer_text, v_correct, case when v_correct then v_points else 0 end)
    on conflict (attempt_id, simulation_item_id)
    do update set answer_text   = excluded.answer_text,
                  is_correct    = excluded.is_correct,
                  points_earned = excluded.points_earned,
                  answered_at   = now()
    returning * into v_row;
  return v_row;
end $$;

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
        grade_10 = round((1 + 9 * (v_earned / nullif(total_points,0)))::numeric * 2) / 2
    where id = p_attempt_id
    returning * into v_attempt;
  return v_attempt;
end $$;

revoke execute on function public.start_simulation_attempt(uuid, text)      from public;
revoke execute on function public.submit_simulation_answer(uuid, uuid, text) from public;
revoke execute on function public.finish_simulation_attempt(uuid)           from public;
revoke execute on function public.start_simulation_attempt(uuid, text)      from anon;
revoke execute on function public.submit_simulation_answer(uuid, uuid, text) from anon;
revoke execute on function public.finish_simulation_attempt(uuid)           from anon;

grant execute on function public.start_simulation_attempt(uuid, text)      to authenticated;
grant execute on function public.submit_simulation_answer(uuid, uuid, text) to authenticated;
grant execute on function public.finish_simulation_attempt(uuid)           to authenticated;
