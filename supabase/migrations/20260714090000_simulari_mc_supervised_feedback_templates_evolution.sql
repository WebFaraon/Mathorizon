-- ============================================================
-- 5 additions to the Simulări feature:
--   1. Multiple-choice items (answer_type + simulation_item_options)
--   2. "Mod supravegheat" — silent tab-switch/fullscreen-exit counter,
--      teacher-only (never visible to the student)
--   3. Per-exercise teacher feedback (simulation_answers.feedback_text)
--   4. Reusable simulation templates (owner-scoped, class-independent)
--   5. Evolution graph needs no new schema — it's computed client-side
--      from data already fetched in loadSimulariTab.
-- ============================================================

-- ── 1. Multiple choice ───────────────────────────────────────
alter table public.simulation_items
  add column if not exists answer_type text not null default 'liber' check (answer_type in ('liber','grila'));

-- Mirrors simulation_items itself: no answer/correctness info here at all —
-- just the option text a student could pick. The correct option's id is
-- stored in simulation_answer_keys.correct_answer (same column already used
-- for free-text answers), so grading needs zero changes to
-- submit_simulation_answer/_sim_answers_match — comparing two option-id
-- strings is just today's case-insensitive string-equality fallback.
create table if not exists public.simulation_item_options (
  id                 uuid primary key default gen_random_uuid(),
  simulation_item_id uuid not null references public.simulation_items(id) on delete cascade,
  label              text not null,
  position           int not null
);
create index if not exists simulation_item_options_item_id_idx on public.simulation_item_options(simulation_item_id);

alter table public.simulation_item_options enable row level security;

create policy sim_item_options_teacher_select on public.simulation_item_options for select to authenticated
  using (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_item_options.simulation_item_id and c.teacher_id = auth.uid()
  ));

create policy sim_item_options_teacher_insert on public.simulation_item_options for insert to authenticated
  with check (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_item_options.simulation_item_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ));

create policy sim_item_options_teacher_update on public.simulation_item_options for update to authenticated
  using (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_item_options.simulation_item_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ))
  with check (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_item_options.simulation_item_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ));

create policy sim_item_options_teacher_delete on public.simulation_item_options for delete to authenticated
  using (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_item_options.simulation_item_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ));

create policy sim_item_options_student_select on public.simulation_item_options for select to authenticated
  using (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.class_members cm on cm.class_id = s.class_id
    where si.id = simulation_item_options.simulation_item_id
      and s.status in ('activa','incheiata')
      and cm.student_id = auth.uid()
  ));

-- ── 2. Mod supravegheat ──────────────────────────────────────
alter table public.simulations add column if not exists supervised boolean not null default false;

-- Deliberately a SEPARATE table with NO student select policy at all — the
-- same reasoning as simulation_answer_keys. simulation_attempts already
-- grants the student full-row SELECT on their own attempt
-- (sim_attempts_student_select), and RLS can't hide a single column from an
-- otherwise-readable row. A counter added directly to simulation_attempts
-- would therefore be readable by the student via the network tab — putting
-- it here instead is what actually makes "never visible to the student" true,
-- not just a UI choice.
create table if not exists public.simulation_attempt_flags (
  attempt_id       uuid primary key references public.simulation_attempts(id) on delete cascade,
  tab_switch_count int not null default 0
);

alter table public.simulation_attempt_flags enable row level security;

create policy sim_attempt_flags_teacher_select on public.simulation_attempt_flags for select to authenticated
  using (exists (
    select 1 from public.simulation_attempts a
    join public.simulations s on s.id = a.simulation_id
    join public.classes c on c.id = s.class_id
    where a.id = simulation_attempt_flags.attempt_id and c.teacher_id = auth.uid()
  ));

-- No INSERT/UPDATE/DELETE policy for anyone — all writes go through this
-- SECURITY DEFINER function, which verifies attempt ownership internally.
create or replace function public.log_sim_violation(p_attempt_id uuid)
returns void
security definer set search_path = public
language plpgsql as $$
declare v_attempt public.simulation_attempts;
begin
  select * into v_attempt from simulation_attempts where id = p_attempt_id;
  if v_attempt.id is null or v_attempt.student_id is distinct from auth.uid() then raise exception 'not your attempt'; end if;
  if v_attempt.status <> 'in_progres' then return; end if;

  insert into simulation_attempt_flags (attempt_id, tab_switch_count)
    values (p_attempt_id, 1)
    on conflict (attempt_id) do update set tab_switch_count = simulation_attempt_flags.tab_switch_count + 1;
end $$;

revoke execute on function public.log_sim_violation(uuid) from public;
revoke execute on function public.log_sim_violation(uuid) from anon;
grant execute on function public.log_sim_violation(uuid) to authenticated;

-- ── 3. Teacher feedback per exercise ─────────────────────────
alter table public.simulation_answers add column if not exists feedback_text text;

-- Column-scoped grant (not a blanket table grant) — a teacher's session can
-- only ever SET feedback_text via this privilege, never is_correct/
-- points_earned, even via a raw REST PATCH that tries to sneak both in.
grant update (feedback_text) on public.simulation_answers to authenticated;

create policy sim_answers_teacher_update_feedback on public.simulation_answers for update to authenticated
  using (exists (
    select 1 from public.simulation_attempts a
    join public.simulations s on s.id = a.simulation_id
    join public.classes c on c.id = s.class_id
    where a.id = simulation_answers.attempt_id and c.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.simulation_attempts a
    join public.simulations s on s.id = a.simulation_id
    join public.classes c on c.id = s.class_id
    where a.id = simulation_answers.attempt_id and c.teacher_id = auth.uid()
  ));
-- Student SELECT already covers this column via the existing
-- sim_answers_student_select policy (whole-row, own attempts only) — no new
-- read-side policy needed for the student to see feedback once it's set.

-- ── 4. Simulation templates — teacher-only end to end, reusable ─
-- across any of that teacher's classes (scoped by created_by, not class_id).
-- Never read by a student, so correct answers can live inline here — the
-- split answer-key trick exists only because simulation_items IS student-
-- readable; templates never are.
create table if not exists public.simulation_templates (
  id                 uuid primary key default gen_random_uuid(),
  created_by         uuid not null references auth.users(id),
  title              text not null,
  time_limit_minutes int not null check (time_limit_minutes > 0),
  supervised         boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists simulation_templates_created_by_idx on public.simulation_templates(created_by);

create table if not exists public.simulation_template_items (
  id                  uuid primary key default gen_random_uuid(),
  template_id         uuid not null references public.simulation_templates(id) on delete cascade,
  position            int not null,
  exercise_source     text not null check (exercise_source in ('bank','custom','adhoc')),
  source_exercise_id  text,
  title               text not null,
  statement           text not null,
  difficulty          text,
  points              numeric not null check (points > 0),
  answer_type         text not null default 'liber' check (answer_type in ('liber','grila')),
  correct_answer      text not null
);
create index if not exists simulation_template_items_template_id_idx on public.simulation_template_items(template_id);

create table if not exists public.simulation_template_options (
  id                uuid primary key default gen_random_uuid(),
  template_item_id  uuid not null references public.simulation_template_items(id) on delete cascade,
  label             text not null,
  position          int not null,
  is_correct        boolean not null default false
);
create index if not exists simulation_template_options_item_id_idx on public.simulation_template_options(template_item_id);

alter table public.simulation_templates        enable row level security;
alter table public.simulation_template_items   enable row level security;
alter table public.simulation_template_options enable row level security;

create policy sim_templates_owner_all on public.simulation_templates for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy sim_template_items_owner_all on public.simulation_template_items for all to authenticated
  using (exists (
    select 1 from public.simulation_templates t
    where t.id = simulation_template_items.template_id and t.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.simulation_templates t
    where t.id = simulation_template_items.template_id and t.created_by = auth.uid()
  ));

create policy sim_template_options_owner_all on public.simulation_template_options for all to authenticated
  using (exists (
    select 1 from public.simulation_template_items ti
    join public.simulation_templates t on t.id = ti.template_id
    where ti.id = simulation_template_options.template_item_id and t.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.simulation_template_items ti
    join public.simulation_templates t on t.id = ti.template_id
    where ti.id = simulation_template_options.template_item_id and t.created_by = auth.uid()
  ));
