-- ============================================================
-- Sumar tab roster table — per-student status (activ/inactiv) and an
-- assigned manager name, editable inline from Sumar without needing to
-- open Catalog (which stays grades/attendance-only).
-- ============================================================

alter table public.class_members add column if not exists status text not null default 'activ';
alter table public.class_members add constraint class_members_status_check
  check (status in ('activ', 'inactiv'));

alter table public.class_members add column if not exists manager_name text;

-- Whatever RLS already exists on class_members predates the migrations
-- folder, so its exact shape isn't visible here — this policy is additive
-- only (a new name, dropped-and-recreated for idempotency) and can only
-- grant permission, never take any away, since permissive policies for the
-- same command are OR'd together. Lets a class's own teacher update their
-- own members' rows (status/manager_name), same "is this my class" check
-- already used elsewhere (e.g. whiteboard_sessions policies).
drop policy if exists class_members_teacher_update on public.class_members;
create policy class_members_teacher_update on public.class_members for update to authenticated
  using (exists (select 1 from public.classes c where c.id = class_members.class_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = class_members.class_id and c.teacher_id = auth.uid()));
