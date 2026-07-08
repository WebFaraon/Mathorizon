-- ============================================================
-- Simulări — class-specific timed test feature
-- Teacher-authored, class-scoped tests graded by exact final-
-- answer match. Distinct from the AI-graded BAC exam simulator.
-- ============================================================

-- ── simulations ──────────────────────────────────────────────
create table if not exists public.simulations (
  id                 uuid primary key default gen_random_uuid(),
  class_id           uuid not null references public.classes(id) on delete cascade,
  created_by         uuid not null references auth.users(id),
  title              text not null,
  scheduled_at       timestamptz,
  time_limit_minutes int not null check (time_limit_minutes > 0),
  status             text not null default 'programata'
                        check (status in ('programata','activa','incheiata')),
  started_at         timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists simulations_class_id_idx on public.simulations(class_id);

-- ── simulation_items — snapshot of the exercise at add-time.
--    Deliberately holds NO answer — students can SELECT this
--    table, and RLS is row-level, not column-level, so any
--    answer stored here would be visible to them too.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.simulation_items (
  id                 uuid primary key default gen_random_uuid(),
  simulation_id      uuid not null references public.simulations(id) on delete cascade,
  position           int not null,
  exercise_source    text not null check (exercise_source in ('bank','custom','adhoc')),
  source_exercise_id text,
  title              text not null,
  statement          text not null,
  difficulty         text,
  points             numeric not null check (points > 0),
  created_at         timestamptz not null default now()
);
create index if not exists simulation_items_simulation_id_idx on public.simulation_items(simulation_id);

-- ── simulation_answer_keys — teacher-only. No student SELECT
--    policy exists anywhere in this migration, on purpose.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.simulation_answer_keys (
  simulation_item_id uuid primary key references public.simulation_items(id) on delete cascade,
  correct_answer     text not null
);

-- ── simulation_attempts — one per student per simulation ────
create table if not exists public.simulation_attempts (
  id             uuid primary key default gen_random_uuid(),
  simulation_id  uuid not null references public.simulations(id) on delete cascade,
  student_id     uuid not null references auth.users(id),
  student_name   text,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'in_progres' check (status in ('in_progres','finalizata')),
  earned_points  numeric not null default 0,
  total_points   numeric not null default 0,
  grade_10       numeric,
  unique (simulation_id, student_id)
);
create index if not exists simulation_attempts_simulation_id_idx on public.simulation_attempts(simulation_id);
create index if not exists simulation_attempts_student_id_idx on public.simulation_attempts(student_id);

-- ── simulation_answers — one per attempt per item ────────────
create table if not exists public.simulation_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references public.simulation_attempts(id) on delete cascade,
  simulation_item_id  uuid not null references public.simulation_items(id) on delete cascade,
  answer_text         text,
  is_correct          boolean,
  points_earned       numeric,
  answered_at         timestamptz not null default now(),
  unique (attempt_id, simulation_item_id)
);
create index if not exists simulation_answers_attempt_id_idx on public.simulation_answers(attempt_id);

alter table public.simulations            enable row level security;
alter table public.simulation_items       enable row level security;
alter table public.simulation_answer_keys enable row level security;
alter table public.simulation_attempts    enable row level security;
alter table public.simulation_answers     enable row level security;

-- ── Teacher (class owner) — full CRUD everywhere for their own
--    class, including flipping 'incheiata' back to 'activa'
--    ("Redeschide") — that's just a normal UPDATE under this
--    same policy, no separate schema support needed.
-- ─────────────────────────────────────────────────────────────
create policy sim_teacher_all on public.simulations for all to authenticated
  using (exists (
    select 1 from public.classes c
    where c.id = simulations.class_id and c.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.classes c
    where c.id = simulations.class_id and c.teacher_id = auth.uid()
  ));

create policy sim_items_teacher_all on public.simulation_items for all to authenticated
  using (exists (
    select 1 from public.simulations s join public.classes c on c.id = s.class_id
    where s.id = simulation_items.simulation_id and c.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.simulations s join public.classes c on c.id = s.class_id
    where s.id = simulation_items.simulation_id and c.teacher_id = auth.uid()
  ));

create policy sim_keys_teacher_all on public.simulation_answer_keys for all to authenticated
  using (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_answer_keys.simulation_item_id and c.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_answer_keys.simulation_item_id and c.teacher_id = auth.uid()
  ));

create policy sim_attempts_teacher_select on public.simulation_attempts for select to authenticated
  using (exists (
    select 1 from public.simulations s join public.classes c on c.id = s.class_id
    where s.id = simulation_attempts.simulation_id and c.teacher_id = auth.uid()
  ));

create policy sim_answers_teacher_select on public.simulation_answers for select to authenticated
  using (exists (
    select 1 from public.simulation_attempts a
    join public.simulations s on s.id = a.simulation_id
    join public.classes c on c.id = s.class_id
    where a.id = simulation_answers.attempt_id and c.teacher_id = auth.uid()
  ));

-- ── Students — read-only, and only what they're allowed to see.
-- ─────────────────────────────────────────────────────────────
create policy sim_student_select on public.simulations for select to authenticated
  using (
    status in ('activa','incheiata')
    and exists (
      select 1 from public.class_members cm
      where cm.class_id = simulations.class_id and cm.student_id = auth.uid()
    )
  );

create policy sim_items_student_select on public.simulation_items for select to authenticated
  using (exists (
    select 1 from public.simulations s
    join public.class_members cm on cm.class_id = s.class_id
    where s.id = simulation_items.simulation_id
      and s.status in ('activa','incheiata')
      and cm.student_id = auth.uid()
  ));

create policy sim_attempts_student_select on public.simulation_attempts for select to authenticated
  using (student_id = auth.uid());

create policy sim_answers_student_select on public.simulation_answers for select to authenticated
  using (exists (
    select 1 from public.simulation_attempts a
    where a.id = simulation_answers.attempt_id and a.student_id = auth.uid()
  ));

-- NOTE: deliberately no INSERT/UPDATE policies for students on
-- simulation_attempts/simulation_answers, and no policy at all
-- (any command) on simulation_answer_keys for students. All
-- student-facing mutation goes through the SECURITY DEFINER
-- functions below, which check auth.uid() ownership internally
-- — this prevents a student from e.g. PATCHing earned_points on
-- their own row directly via a raw REST call.

-- ============================================================
-- Grading — deterministic, no AI. Trim/collapse whitespace,
-- decimal-comma → dot (only for a bare "digits,digits" shape,
-- so set/interval commas like "{1,2}" are left untouched),
-- numeric/fraction-aware comparison with a small epsilon,
-- case-insensitive string fallback otherwise.
-- ============================================================
create or replace function public._sim_normalize(raw text) returns text
language plpgsql immutable as $$
declare v text;
begin
  v := coalesce(trim(raw), '');
  v := regexp_replace(v, '\s+', ' ', 'g');
  if v ~ '^-?\d+,\d+$' then
    v := replace(v, ',', '.');
  end if;
  return lower(v);
end $$;

create or replace function public._sim_try_number(raw text) returns numeric
language plpgsql immutable as $$
declare v text; frac text[];
begin
  v := public._sim_normalize(raw);
  if v ~ '^-?\d+(\.\d+)?$' then
    return v::numeric;
  elsif v ~ '^-?\d+/\d+$' then
    frac := regexp_split_to_array(v, '/');
    if frac[2]::numeric = 0 then return null; end if;
    return frac[1]::numeric / frac[2]::numeric;
  end if;
  return null;
end $$;

create or replace function public._sim_answers_match(a text, b text) returns boolean
language plpgsql immutable as $$
declare na numeric; nb numeric;
begin
  na := public._sim_try_number(a);
  nb := public._sim_try_number(b);
  if na is not null and nb is not null then
    return abs(na - nb) < 0.0000001;
  end if;
  return public._sim_normalize(a) = public._sim_normalize(b);
end $$;

-- ============================================================
-- RPC functions — the only way attempts/answers get written.
-- ============================================================
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

  select coalesce(sum(points),0) into v_total from simulation_items where simulation_id = p_simulation_id;

  insert into simulation_attempts (simulation_id, student_id, student_name, total_points)
    values (p_simulation_id, auth.uid(), p_student_name, v_total)
    on conflict (simulation_id, student_id) do nothing;

  select * into v_row from simulation_attempts
    where simulation_id = p_simulation_id and student_id = auth.uid();
  return v_row;
end $$;

create or replace function public.submit_simulation_answer(p_attempt_id uuid, p_item_id uuid, p_answer_text text)
returns public.simulation_answers
security definer set search_path = public
language plpgsql as $$
declare v_attempt public.simulation_attempts; v_key text; v_points numeric; v_correct boolean; v_row public.simulation_answers;
begin
  select * into v_attempt from simulation_attempts where id = p_attempt_id;
  if v_attempt.id is null or v_attempt.student_id <> auth.uid() then raise exception 'not your attempt'; end if;
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
  if v_attempt.id is null or v_attempt.student_id <> auth.uid() then raise exception 'not your attempt'; end if;

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

grant execute on function public.start_simulation_attempt(uuid, text)      to authenticated;
grant execute on function public.submit_simulation_answer(uuid, uuid, text) to authenticated;
grant execute on function public.finish_simulation_attempt(uuid)           to authenticated;

-- ============================================================
-- custom_exercises — widen for grade 5-12 simulation content,
-- and let teachers (not just admins) insert into it.
-- Defensive/idempotent: the exact current constraint name can't
-- be introspected here (no local DB/psql access), so drop-if-
-- exists then re-add rather than assuming its name.
-- ============================================================
alter table public.custom_exercises drop constraint if exists custom_exercises_grade_check;
alter table public.custom_exercises add constraint custom_exercises_grade_check
  check (grade in ('5','6','7','8','9','10','11','12','bac'));

alter table public.custom_exercises alter column category_id drop not null;
alter table public.custom_exercises alter column subcategory_id drop not null;

create policy custom_exercises_insert_teacher on public.custom_exercises for insert to authenticated
  with check (exists (
    select 1 from public.user_profiles up
    where up.user_id = auth.uid() and up.role in ('admin','profesor')
  ));
