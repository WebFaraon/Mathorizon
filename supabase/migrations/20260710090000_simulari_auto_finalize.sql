-- ============================================================
-- Enforce the time limit server-side, not just in the student's
-- own browser timer. Previously, a student who closed the tab (or
-- just never clicked Finalizează) before time ran out kept their
-- attempt 'in_progres' forever with no way to get graded, and a
-- student who left the tab open past the deadline could in theory
-- keep submitting answers indefinitely since submit_simulation_answer
-- only checked status, never wall-clock time.
--
-- finalize_expired_simulation_attempts() settles any attempt whose
-- deadline has passed using whatever was submitted up to that point.
-- There's no cron/scheduler in this project, so it's invoked lazily
-- by whichever client next looks at the data (teacher's live view,
-- the Membri/Catalog tab, a student's own Simulări list) rather than
-- firing instantly at t+0 — and defensively from inside
-- submit_simulation_answer too, so a late answer can never sneak in.
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
  left join lateral (
    select sum(points_earned) as pts from simulation_answers where attempt_id = a.id
  ) sub on true
  where a.simulation_id = s.id
    and a.status = 'in_progres'
    and now() > a.started_at + (s.time_limit_minutes || ' minutes')::interval
    and (p_simulation_id is null or a.simulation_id = p_simulation_id);
end $$;

revoke execute on function public.finalize_expired_simulation_attempts(uuid) from public;
revoke execute on function public.finalize_expired_simulation_attempts(uuid) from anon;
grant execute on function public.finalize_expired_simulation_attempts(uuid) to authenticated;

create or replace function public.submit_simulation_answer(p_attempt_id uuid, p_item_id uuid, p_answer_text text)
returns public.simulation_answers
security definer set search_path = public
language plpgsql as $$
declare v_attempt public.simulation_attempts; v_sim public.simulations; v_key text; v_points numeric; v_correct boolean; v_row public.simulation_answers;
begin
  select * into v_attempt from simulation_attempts where id = p_attempt_id;
  if v_attempt.id is null or v_attempt.student_id is distinct from auth.uid() then raise exception 'not your attempt'; end if;

  select * into v_sim from simulations where id = v_attempt.simulation_id;
  if v_attempt.status = 'in_progres' and now() > v_attempt.started_at + (v_sim.time_limit_minutes || ' minutes')::interval then
    perform public.finalize_expired_simulation_attempts(v_attempt.simulation_id);
    select status into v_attempt.status from simulation_attempts where id = p_attempt_id;
  end if;
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
