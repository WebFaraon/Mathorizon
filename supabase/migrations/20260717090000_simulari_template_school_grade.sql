-- ============================================================
-- Templates are saved per-teacher, not per-class (created_by only —
-- see 20260714090000), which made sense since a template is meant to
-- be reusable across a teacher's classes. But that also means the
-- "Șabloane salvate" picker gave no hint of which grade level (5th,
-- 9th, BAC prep, etc.) a given template was actually built for —
-- exactly the piece of context a teacher juggling several grades
-- needs to tell templates apart at a glance.
--
-- A simulation is always created inside one specific class's page
-- (class-page.js's module-level `classData`), and every class already
-- carries its own grade in `classes.school_grade` (a free string like
-- "a 9-a" — see class-page.js's _gradeCodeFromSchoolGrade, the same
-- convention already used to auto-filter the exercise bank by grade).
-- So the grade a template belongs to needs no manual picker of its
-- own — it's just a snapshot of the class it was saved from, taken
-- automatically at "save as template" time.
-- ============================================================

alter table public.simulation_templates add column if not exists school_grade text;
