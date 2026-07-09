-- ============================================================
-- Found during an edge-case review: the simulation-builder wizard's
-- "edit" flow (openSimulationWizard → _simWzSave in class-page.js)
-- deletes ALL simulation_items for the simulation being edited and
-- reinserts them fresh with brand-new ids — and the "✎ Editează"
-- button was rendered unconditionally, including for an 'activa' or
-- already-'incheiata' simulation. Since simulation_answer_keys and
-- simulation_answers both cascade-delete off simulation_items(id),
-- a teacher editing a simulation students are actively taking (or
-- have already finished) would silently wipe every submitted answer,
-- and any student mid-exam would start hitting "item not found" on
-- their next answer save (their loaded item ids no longer exist).
--
-- The client is being fixed to only offer editing while a simulation
-- is still 'programata', but that alone isn't a real guarantee — the
-- old sim_items_teacher_all / sim_keys_teacher_all policies allowed
-- this at the database level regardless of status, so a stale tab or
-- a direct REST call could still do it. Split each into a status-
-- unrestricted SELECT (teachers can still view/review an active or
-- finished simulation's items) and an INSERT/UPDATE/DELETE that only
-- succeeds while the parent simulation is still 'programata'.
-- ============================================================

drop policy if exists sim_items_teacher_all on public.simulation_items;

create policy sim_items_teacher_select on public.simulation_items for select to authenticated
  using (exists (
    select 1 from public.simulations s join public.classes c on c.id = s.class_id
    where s.id = simulation_items.simulation_id and c.teacher_id = auth.uid()
  ));

create policy sim_items_teacher_insert on public.simulation_items for insert to authenticated
  with check (exists (
    select 1 from public.simulations s join public.classes c on c.id = s.class_id
    where s.id = simulation_items.simulation_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ));

create policy sim_items_teacher_update on public.simulation_items for update to authenticated
  using (exists (
    select 1 from public.simulations s join public.classes c on c.id = s.class_id
    where s.id = simulation_items.simulation_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ))
  with check (exists (
    select 1 from public.simulations s join public.classes c on c.id = s.class_id
    where s.id = simulation_items.simulation_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ));

create policy sim_items_teacher_delete on public.simulation_items for delete to authenticated
  using (exists (
    select 1 from public.simulations s join public.classes c on c.id = s.class_id
    where s.id = simulation_items.simulation_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ));

-- Same split for the answer keys, joined one level deeper (through items).
drop policy if exists sim_keys_teacher_all on public.simulation_answer_keys;

create policy sim_keys_teacher_select on public.simulation_answer_keys for select to authenticated
  using (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_answer_keys.simulation_item_id and c.teacher_id = auth.uid()
  ));

create policy sim_keys_teacher_insert on public.simulation_answer_keys for insert to authenticated
  with check (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_answer_keys.simulation_item_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ));

create policy sim_keys_teacher_update on public.simulation_answer_keys for update to authenticated
  using (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_answer_keys.simulation_item_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ))
  with check (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_answer_keys.simulation_item_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ));

create policy sim_keys_teacher_delete on public.simulation_answer_keys for delete to authenticated
  using (exists (
    select 1 from public.simulation_items si
    join public.simulations s on s.id = si.simulation_id
    join public.classes c on c.id = s.class_id
    where si.id = simulation_answer_keys.simulation_item_id and c.teacher_id = auth.uid()
      and s.status = 'programata'
  ));
