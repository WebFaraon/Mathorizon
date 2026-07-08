-- ============================================================
-- The original migration deliberately gave students NO select
-- policy on simulation_answer_keys (v1 scope: correct/incorrect +
-- score only, no answer reveal). The user now wants the correct
-- answer shown next to the student's own answer on the results
-- screen, once they've finished. Add a narrowly-scoped policy: a
-- student may read the answer key for an item only if they have
-- their OWN finalizata attempt on that item's simulation — never
-- before finishing, and never for someone else's attempt.
-- ============================================================

create policy sim_keys_student_select_after_finish on public.simulation_answer_keys for select to authenticated
  using (exists (
    select 1
    from public.simulation_items si
    join public.simulation_attempts a on a.simulation_id = si.simulation_id
    where si.id = simulation_answer_keys.simulation_item_id
      and a.student_id = auth.uid()
      and a.status = 'finalizata'
  ));
