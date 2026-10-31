-- Exercitiile noi (custom_exercises) le adauga doar profesorii aprobati, pe numele lor.
-- Adminul nu mai adauga; il poate corecta pe cele existente (politicile de update si delete raman).
-- Inainte, dreptul de inserare il aveau adminul si orice profesor, chiar neaprobat.

drop policy if exists custom_exercises_admin_insert on public.custom_exercises;
drop policy if exists custom_exercises_insert_teacher on public.custom_exercises;

create policy custom_exercises_insert_teacher on public.custom_exercises for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.user_profiles up where up.user_id = auth.uid() and up.role = 'profesor' and up.status = 'active')
  );
