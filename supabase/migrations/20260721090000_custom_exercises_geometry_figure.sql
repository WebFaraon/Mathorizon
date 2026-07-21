-- ============================================================
-- Geometry Figure Editor: lets an admin hand-draw the diagram for a
-- Geometrie exercise (Gemini transcribes the text statement only and
-- is explicitly told to ignore any figure in the source photo — see
-- api/admin/generate-exercise.js's per-category prompt branch).
--
-- Two columns, both nullable (every non-geometry exercise leaves them
-- null forever, same pattern as custom_exercises.barem being null for
-- teacher-authored Simulări rows — see 20260708120000_simulari.sql):
--   figure_data — the editable Fabric.js scene (role-tagged shapes,
--                 so the admin can reopen and correct a figure later)
--   figure_svg  — the flattened export the student-facing pages render
--                 inline (its strokes/fills reference var(--text) /
--                 var(--text-secondary) instead of literal hex, so it
--                 re-colors for free with the site's existing dark/
--                 light theme switch; a color the admin explicitly
--                 picked is stored as a literal hex and never flips)
--
-- No RLS change needed — both columns live on the existing
-- custom_exercises row, already governed by that table's policies.
-- ============================================================

alter table public.custom_exercises
  add column if not exists figure_data jsonb,
  add column if not exists figure_svg  text;
