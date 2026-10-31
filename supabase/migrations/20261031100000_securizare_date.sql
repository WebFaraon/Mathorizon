-- Securizarea datelor, dinaintea lansarii.
--
-- 1. get_all_students, get_all_classes_admin, get_all_student_classes_admin nu verificau cine le cheama si puteau fi apelate si fara cont:
--    dadeau numele si emailul tuturor elevilor si toate clasele. Acum cer un cont de admin.
-- 2. get_all_student_plans dadea eroare pentru oricine (coloana user_id era ambigua cu coloana de iesire): reparata.
-- 3. Functiile care schimba sau citesc date private nu mai pot fi apelate de cine nu e conectat.
-- 4. Fisierele temelor (bucket assignment-files): oricine conectat putea sterge sau urca orice fisier, iar oricine putea lista tot bucketul.
--    Acum urca/sterge doar elevul in dosarul lui si profesorul clasei temei. Linkurile fisierelor raman publice (nu se schimba nimic pentru elevi).
-- 5. Tabelele nu mai dau anonimului nici scriere, nici citire, in afara de cele doua tabele publice. Tabelele si functiile noi pornesc fara drept pentru anonim.
--
-- Dupa rulare: verificarile din supabase/manual/verifica-securitatea.sql trebuie sa dea zero randuri.

-- ---------- 1 + 2: functiile de admin ----------
create or replace function public.get_all_students()
returns table (user_id uuid, full_name text, email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  return query
    select p.user_id, (u.raw_user_meta_data->>'full_name')::text, u.email::text, p.created_at
    from public.user_profiles p
    join auth.users u on u.id = p.user_id
    where p.role = 'elev' and p.status = 'active'
    order by p.created_at desc;
end $$;

create or replace function public.get_all_classes_admin()
returns table (id uuid, name text, teacher_id uuid, teacher_name text, math_level text, max_students integer, school_grade text, member_count bigint, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  return query
    select c.id, c.name, c.teacher_id, c.teacher_name, c.math_level, c.max_students, c.school_grade,
           coalesce(count(cm.student_id), 0)::bigint, c.created_at
    from public.classes c
    left join public.class_members cm on cm.class_id = c.id
    group by c.id, c.name, c.teacher_id, c.teacher_name, c.math_level, c.max_students, c.school_grade, c.created_at
    order by c.created_at desc;
end $$;

create or replace function public.get_all_student_classes_admin()
returns table (student_id uuid, class_id uuid, class_name text, teacher_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  return query
    select cm.student_id, c.id, c.name, c.teacher_name
    from public.class_members cm
    join public.classes c on c.id = cm.class_id
    order by cm.student_id, c.name;
end $$;

create or replace function public.get_all_student_plans()
returns table (user_id uuid, plan text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  return query select up.user_id, up.plan from public.user_profiles up where up.role = 'elev';
end $$;

-- ---------- 3: cine poate apela ce ----------
-- (REVOKE de la PUBLIC si anon: PUBLIC e dreptul implicit al oricarei functii; fara el, anon nu mai primeste dreptul pe ocolite)
alter function public.consume_exam_token() set search_path = public;
alter function public.get_all_professors() set search_path = public;
alter function public.get_pending_professors() set search_path = public;
alter function public.set_professor_status(uuid, text) set search_path = public;

do $$
declare f text;
begin
  foreach f in array array[
    'public.get_all_students()', 'public.get_all_classes_admin()', 'public.get_all_student_classes_admin()', 'public.get_all_student_plans()',
    'public.get_all_professors()', 'public.get_pending_professors()', 'public.set_professor_status(uuid, text)', 'public.set_student_plan(uuid, text)',
    'public.consume_exam_token()', 'public.join_whiteboard_session(uuid, text, text)', 'public.set_whiteboard_participant_locked(uuid, uuid, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- fara apelant in aplicatie: numaratoarea o face deja get_all_classes_admin; curatenia o face cron-ul prin run_simulation_expiry_sweep
revoke execute on function public.get_class_member_count(uuid) from public, anon, authenticated;
revoke execute on function public.close_expired_simulations() from public, anon, authenticated;
revoke execute on function public.start_scheduled_simulations() from public, anon, authenticated;

-- ---------- 4: fisierele temelor ----------
-- caile: submissions/<tema>/<elev>/<fisier> (lucrarea elevului) si <tema>/<fisier> (fisierele puse de profesor)
drop policy if exists storage_read on storage.objects;
drop policy if exists storage_insert on storage.objects;
drop policy if exists storage_delete on storage.objects;
drop policy if exists assignment_files_select on storage.objects;
drop policy if exists assignment_files_insert on storage.objects;
drop policy if exists assignment_files_delete on storage.objects;

create policy assignment_files_select on storage.objects for select to authenticated using (
  bucket_id = 'assignment-files' and (
    case when (storage.foldername(objects.name))[1] = 'submissions'
      then (storage.foldername(objects.name))[3] = auth.uid()::text
           or exists (select 1 from public.assignments a join public.classes c on c.id = a.class_id
                      where a.id::text = (storage.foldername(objects.name))[2] and c.teacher_id = auth.uid())
      else exists (select 1 from public.assignments a join public.classes c on c.id = a.class_id
                   where a.id::text = (storage.foldername(objects.name))[1] and c.teacher_id = auth.uid())
    end));

create policy assignment_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'assignment-files' and (
    case when (storage.foldername(objects.name))[1] = 'submissions'
      then (storage.foldername(objects.name))[3] = auth.uid()::text
           and exists (select 1 from public.assignments a where a.id::text = (storage.foldername(objects.name))[2])
      else exists (select 1 from public.assignments a join public.classes c on c.id = a.class_id
                   where a.id::text = (storage.foldername(objects.name))[1] and c.teacher_id = auth.uid())
    end));

create policy assignment_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'assignment-files' and (
    case when (storage.foldername(objects.name))[1] = 'submissions'
      then (storage.foldername(objects.name))[3] = auth.uid()::text
           or exists (select 1 from public.assignments a join public.classes c on c.id = a.class_id
                      where a.id::text = (storage.foldername(objects.name))[2] and c.teacher_id = auth.uid())
      else exists (select 1 from public.assignments a join public.classes c on c.id = a.class_id
                   where a.id::text = (storage.foldername(objects.name))[1] and c.teacher_id = auth.uid())
    end));

-- ---------- 5: anonimul nu are drepturi pe tabele ----------
-- singurele tabele citite fara cont: exercitiile publice si memoria intrebarilor cu variante
revoke all on all tables in schema public from anon;
grant select on public.custom_exercises, public.training_mcq_cache to anon;
revoke all on all sequences in schema public from anon;

-- tabelele si functiile create de acum incolo nu mai primesc drepturi pentru anonim si PUBLIC (DROP + CREATE pe o functie le dadea inapoi)
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;
