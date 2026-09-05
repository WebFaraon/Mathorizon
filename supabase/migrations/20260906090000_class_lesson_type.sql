-- ============================================================
-- Lesson type (Online / Offline) for classes.
-- Shown as a badge next to the Materie/Profesor chips in the class
-- header. Nullable and NOT backfilled — existing classes predate this
-- field and simply show no badge until recreated; only the create-class
-- form writes it going forward.
-- ============================================================

alter table public.classes add column if not exists lesson_type text;

alter table public.classes add constraint classes_lesson_type_check
  check (lesson_type is null or lesson_type in ('online', 'offline'));
