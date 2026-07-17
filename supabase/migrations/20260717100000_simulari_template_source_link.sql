-- ============================================================
-- Track which simulation a template was saved from, so the
-- "Salvează ca șablon" modal can tell a teacher "you already saved
-- this one" instead of silently letting them save it again under a
-- tweaked title. Title-based matching alone isn't reliable here: the
-- teacher can rename the simulation after saving a template, or two
-- unrelated simulations can legitimately share a title.
-- ============================================================

alter table public.simulation_templates
  add column if not exists source_simulation_id uuid references public.simulations(id) on delete set null;

create index if not exists simulation_templates_source_simulation_id_idx
  on public.simulation_templates(source_simulation_id);
