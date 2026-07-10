-- ============================================================
-- Prevent a teacher from ending up with two identical Simulare
-- templates — e.g. clicking the 📋 "Salvează ca șablon" icon on
-- the same simulation twice (once now, once again later after
-- forgetting it was already saved). The in-modal button already
-- disables itself on click to stop an accidental double-submit
-- of the SAME request, but that doesn't stop two separate save
-- attempts (possibly from two browser tabs) from each succeeding
-- and creating two rows with the same content — only a DB-level
-- constraint closes that race for good.
--
-- Scoped per-teacher (created_by), case-insensitive, since the
-- save modal prefills the template name from the simulation's own
-- title — the exact scenario that would otherwise collide.
-- ============================================================

create unique index if not exists simulation_templates_created_by_title_idx
  on public.simulation_templates (created_by, lower(title));
