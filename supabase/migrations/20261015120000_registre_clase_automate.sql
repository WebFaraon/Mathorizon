-- Grupele din registru devin clase pe platforma (cerut de fondator, 2026-10-15).
--
-- Cand un registru are un cont de profesor legat (reg_workbooks.owner_user_id), fiecare grupa a lui (Se completeaza, Startează, Activ)
-- are o clasa pe platforma: apare in tabul Clase al profesorului si se deschide ca oricare alta clasa (Sumar, Mesaje, Teme, Simulari,
-- Catalog), cu un cod de invitatie propriu, generat o singura data. Clasa urmareste grupa: programul, clasa elevilor, nivelul,
-- tipul (online/offline), numarul maxim de elevi si profesorul se actualizeaza singure cand se schimba in registru.
-- Tot ce intra in registru (sincronizarea, grupa noua din consola, comanda SET_GROUP) trece prin reg_apply_group, deci prin trigger.
-- O grupa Inactiv sau Inlocuire nu primeste clasa; o clasa deja facuta ramane cu elevii ei.

alter table public.classes add column if not exists reg_group_id uuid references public.reg_groups (id) on delete set null;
create unique index if not exists classes_reg_group_uidx on public.classes (reg_group_id) where reg_group_id is not null;

-- grupele din registru pot avea 8 sau 10 locuri: orice verificare veche pe max_students (formularul vechi oprea la 6) se scoate
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.classes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%max_students%' loop
    execute format('alter table public.classes drop constraint %I', c.conname);
    raise notice 'classes: scoasa verificarea % pe max_students', c.conname;
  end loop;
end $$;

create or replace function public.reg_class_sync_group(p_group uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  g public.reg_groups;
  w public.reg_workbooks;
  v_state text;
  v_days smallint[];
  v_hour int;
  v_time time;
  v_name text;
  v_grade text;
  v_teacher text;
  v_type text;
  v_max int;
  v_class uuid;
  v_code text;
  v_try int := 0;
  v_i int;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_dn constant text[] := array['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
  v_roman constant text[] := array['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
begin
  select * into g from public.reg_groups where id = p_group;
  if not found then return null; end if;
  select * into w from public.reg_workbooks where id = g.workbook_id;
  if not found or w.owner_user_id is null or not w.enabled then return null; end if;

  v_state := lower(coalesce(g.state, ''));
  if v_state not in ('activ', 'se completează', 'se completeaza', 'startează', 'starteaza') then return null; end if;

  -- zilele (cel mult doua, cum cere clasa) si ora de inceput
  select array_agg(d::smallint order by d) into v_days from (
    select distinct (e->>'day')::int as d from jsonb_array_elements(coalesce(g.schedule, '[]'::jsonb)) e
    where (e->>'day') ~ '^[1-7]$' order by 1 limit 2) x;
  select min((e->>'hour')::int) into v_hour from jsonb_array_elements(coalesce(g.schedule, '[]'::jsonb)) e
    where (e->>'hour') ~ '^[0-9]{1,2}$' and (e->>'hour')::int between 0 and 23;
  v_time := case when v_hour is null then null else make_time(v_hour, 0, 0) end;

  -- numele de afisare, in forma clasei facute de mana: Materie · Zi/Zi2 · Ora
  v_name := coalesce(nullif(trim(g.subject), ''), 'Grupă');
  if v_days is not null and v_time is not null then
    v_name := v_name || ' · ' || (select string_agg(v_dn[d], '/' order by d) from unnest(v_days) d) || ' · ' || to_char(v_time, 'HH24:MI');
  end if;

  v_i := array_position(v_roman, upper(trim(coalesce(g.grade, ''))));
  v_grade := case when v_i is not null then 'a ' || v_i || '-a' else nullif(trim(coalesce(g.grade, '')), '') end;
  v_type := case when lower(coalesce(g.mode, '')) in ('online', 'offline') then lower(g.mode) else null end;
  v_max := coalesce(g.format_size, 6);

  select coalesce(nullif(trim(up.display_name), ''), nullif(trim(w.teacher_name), ''), 'Profesor') into v_teacher
    from (select 1) one left join public.user_profiles up on up.user_id = w.owner_user_id;

  select id into v_class from public.classes where reg_group_id = g.id;
  if v_class is not null then
    update public.classes set
      name = v_name, teacher_id = w.owner_user_id, teacher_name = v_teacher, max_students = v_max, school_grade = v_grade,
      math_level = g.level, schedule_days = v_days, schedule_time = v_time, lesson_type = v_type
    where id = v_class and (
      name is distinct from v_name or teacher_id is distinct from w.owner_user_id or teacher_name is distinct from v_teacher
      or max_students is distinct from v_max or school_grade is distinct from v_grade or math_level is distinct from g.level
      or schedule_days is distinct from v_days or schedule_time is distinct from v_time or lesson_type is distinct from v_type);
    return v_class;
  end if;

  loop
    v_code := '';
    for v_i in 1..6 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * 32)::int, 1); end loop;
    begin
      insert into public.classes (name, teacher_id, teacher_name, invite_code, max_students, school_grade, math_level, schedule_days, schedule_time, lesson_type, reg_group_id)
      values (v_name, w.owner_user_id, v_teacher, v_code, v_max, v_grade, g.level, v_days, v_time, v_type, g.id)
      returning id into v_class;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 8 then raise; end if;
    end;
  end loop;
  return v_class;
end $$;

-- un esec aici nu trebuie sa opreasca niciodata sincronizarea registrului
create or replace function public.reg_class_trg_group() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.reg_class_sync_group(new.id);
  exception when others then
    raise warning 'reg_class_sync_group %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists reg_groups_class_sync on public.reg_groups;
create trigger reg_groups_class_sync after insert or update on public.reg_groups
  for each row execute function public.reg_class_trg_group();

-- contul legat de registru se schimba (sau registrul se opreste/porneste): grupele lui urmeaza
create or replace function public.reg_class_trg_workbook() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.reg_groups where workbook_id = new.id loop
    begin
      perform public.reg_class_sync_group(r.id);
    exception when others then
      raise warning 'reg_class_sync_group %: %', r.id, sqlerrm;
    end;
  end loop;
  return new;
end $$;

drop trigger if exists reg_workbooks_class_sync on public.reg_workbooks;
create trigger reg_workbooks_class_sync after update of owner_user_id, enabled, teacher_name on public.reg_workbooks
  for each row when (old.owner_user_id is distinct from new.owner_user_id or old.enabled is distinct from new.enabled or old.teacher_name is distinct from new.teacher_name)
  execute function public.reg_class_trg_workbook();

-- DROP/CREATE re-acorda EXECUTE pentru anon: se reafirma
revoke all on function public.reg_class_sync_group(uuid) from public, anon, authenticated;
revoke all on function public.reg_class_trg_group() from public, anon, authenticated;
revoke all on function public.reg_class_trg_workbook() from public, anon, authenticated;
grant execute on function public.reg_class_sync_group(uuid) to service_role;

-- registrele deja legate de un cont primesc clasele acum
do $$
declare r record;
begin
  for r in select g.id from public.reg_groups g join public.reg_workbooks w on w.id = g.workbook_id where w.owner_user_id is not null and w.enabled loop
    begin
      perform public.reg_class_sync_group(r.id);
    exception when others then
      raise warning 'backfill %: %', r.id, sqlerrm;
    end;
  end loop;
end $$;
