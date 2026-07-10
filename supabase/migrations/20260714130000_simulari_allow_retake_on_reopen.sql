-- ============================================================
-- Allow a student to retake a Simulare after the teacher hits
-- "Redeschide" — previously impossible in two independent ways:
--
-- 1. simulation_attempts had a hard UNIQUE (simulation_id, student_id)
--    constraint. start_simulation_attempt() inserted with
--    `on conflict (simulation_id, student_id) do nothing`, so once a
--    student had ANY row (even a long-finished one), every future
--    call just silently returned that same old, already-'finalizata'
--    row — no new attempt could ever be created for that pair, reopen
--    or not.
-- 2. js/simulare-exam.js's start() unconditionally treated an
--    existing 'finalizata' attempt as "show past results", with no
--    check of the simulation's current status — so even if #1 were
--    fixed, the client would never ask the server for a new attempt.
--
-- Fix (this migration handles the server half; client half is in
-- simulare-exam.js/class-page.js): drop the full unique constraint,
-- replace it with a PARTIAL unique index that only forbids two
-- *simultaneously in-progress* attempts for the same (simulation,
-- student) — multiple *finalized* rows for the same pair are now
-- allowed, one per attempt, preserving full history. Nothing reads
-- "the" attempt for a (simulation, student) pair anymore; every
-- query that used to assume at most one row now explicitly orders by
-- started_at and takes the latest, so:
--   - Catalog / Simulări list / live view display the MOST RECENT
--     attempt's grade (a retake overwrites what's shown, never what's
--     stored).
--   - Class/simulation averages are computed off that same latest-
--     only view, so they can't double-count an old + new grade for
--     the same student.
--   - Old attempts (and their simulation_answers, feedback, flags —
--     all FK'd to attempt_id, unaffected by this change) stay in the
--     database untouched, in case a teacher ever needs the history.
-- ============================================================

alter table public.simulation_attempts
  drop constraint if exists simulation_attempts_simulation_id_student_id_key;

create unique index if not exists simulation_attempts_one_active_idx
  on public.simulation_attempts (simulation_id, student_id)
  where status = 'in_progres';

create or replace function public.start_simulation_attempt(p_simulation_id uuid, p_student_name text)
returns public.simulation_attempts
security definer set search_path = public
language plpgsql as $$
declare v_sim public.simulations; v_row public.simulation_attempts; v_total numeric;
begin
  select * into v_sim from simulations where id = p_simulation_id;
  if v_sim.id is null then raise exception 'simulation not found'; end if;
  if v_sim.status <> 'activa' then raise exception 'simulation not active'; end if;
  if not exists (select 1 from class_members where class_id = v_sim.class_id and student_id = auth.uid()) then
    raise exception 'not a member of this class';
  end if;

  -- Resume an already in-progress attempt if one exists — never start
  -- a second one on top of it (the partial unique index would reject
  -- it anyway, but checking first avoids a needless failed insert).
  select * into v_row from simulation_attempts
    where simulation_id = p_simulation_id and student_id = auth.uid() and status = 'in_progres';
  if v_row.id is not null then return v_row; end if;

  -- Otherwise always create a fresh row — this is the first-ever
  -- attempt, OR a retake of a simulation the teacher reopened after
  -- this student had already finished it once.
  select coalesce(sum(points),0) into v_total from simulation_items where simulation_id = p_simulation_id;

  insert into simulation_attempts (simulation_id, student_id, student_name, total_points)
    values (p_simulation_id, auth.uid(), p_student_name, v_total)
    on conflict (simulation_id, student_id) where status = 'in_progres' do nothing
    returning * into v_row;

  if v_row.id is null then
    -- Lost a race against a concurrent request that inserted first.
    select * into v_row from simulation_attempts
      where simulation_id = p_simulation_id and student_id = auth.uid() and status = 'in_progres';
  end if;
  return v_row;
end $$;

revoke execute on function public.start_simulation_attempt(uuid, text) from public;
revoke execute on function public.start_simulation_attempt(uuid, text) from anon;
grant execute on function public.start_simulation_attempt(uuid, text) to authenticated;
