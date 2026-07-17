-- ============================================================
-- Attendance tracking for the teacher's "Catalog" tab: a "lecție"
-- (class_sessions row) is a single dated class meeting; each student
-- gets one attendance_records row per lecție (present/absent).
--
-- Teacher-owned, class-scoped, same shape as the simulări feature
-- (see 20260708120000_simulari.sql) — class_sessions mirrors
-- `simulations` (class_id -> classes.teacher_id), attendance_records
-- mirrors a child table one hop further via session_id, same as
-- simulation_items -> simulations -> classes.
--
-- Deliberately teacher-only end to end (no student select policy) —
-- this is a monitoring tool for the teacher's own catalog view, not a
-- student-facing feature, so there is nothing to expose to students
-- yet (same reasoning as simulation_attempt_flags).
-- ============================================================

create table if not exists public.class_sessions (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  created_by   uuid not null references auth.users(id),
  session_date date not null,
  created_at   timestamptz not null default now()
);
create index if not exists class_sessions_class_id_idx on public.class_sessions(class_id);

-- One lecție per class per day — the "+ Adaugă lecție" flow always
-- inserts a new row, so this is the guard against an accidental
-- double-submit (or two tabs) creating two sessions for the same date;
-- correcting an existing date's attendance goes through an update
-- instead, by clicking that session's column in the catalog.
create unique index if not exists class_sessions_class_id_date_idx
  on public.class_sessions(class_id, session_date);

create table if not exists public.attendance_records (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references auth.users(id),
  present    boolean not null default true,
  unique(session_id, student_id)
);
create index if not exists attendance_records_session_id_idx on public.attendance_records(session_id);
create index if not exists attendance_records_student_id_idx on public.attendance_records(student_id);

alter table public.class_sessions     enable row level security;
alter table public.attendance_records enable row level security;

create policy class_sessions_teacher_all on public.class_sessions for all to authenticated
  using (exists (
    select 1 from public.classes c
    where c.id = class_sessions.class_id and c.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.classes c
    where c.id = class_sessions.class_id and c.teacher_id = auth.uid()
  ));

create policy attendance_records_teacher_all on public.attendance_records for all to authenticated
  using (exists (
    select 1 from public.class_sessions s
    join public.classes c on c.id = s.class_id
    where s.id = attendance_records.session_id and c.teacher_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.class_sessions s
    join public.classes c on c.id = s.class_id
    where s.id = attendance_records.session_id and c.teacher_id = auth.uid()
  ));
