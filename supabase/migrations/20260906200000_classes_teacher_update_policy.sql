-- ============================================================
-- classes had no UPDATE RLS policy for the teacher — there was never a
-- feature that needed to update a class row after creation before now
-- (Nivel matematică editor, and the teacher_name self-heal on class-page
-- load). Both writes were succeeding at the HTTP level (200, no error)
-- but silently affecting 0 rows, since Postgrest doesn't treat "the
-- WHERE/RLS-filtered UPDATE matched nothing" as an error — confirmed live:
-- the toast said "updated" but a reload showed the old value.
--
-- Additive only (a new policy name, dropped-and-recreated for
-- idempotency) — can only grant permission, never take any away, since
-- permissive policies for the same command are OR'd together with
-- whatever already exists on this table.
-- ============================================================

drop policy if exists classes_teacher_update on public.classes;
create policy classes_teacher_update on public.classes for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());
