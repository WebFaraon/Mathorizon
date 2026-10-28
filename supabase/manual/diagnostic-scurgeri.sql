-- Diagnostic de acces: ce poate citi un strain? Doar citeste, nu schimba nimic.
-- RULEAZA CATE UN BLOC PE RAND: selecteaza doar blocul (de la comentariul "BLOC" pana la ultimul `;` sau `$$;`), apasa Run, copiaza rezultatul.
-- Nu e nimic de inlocuit: blocurile 2 si 3 isi aleg singure un elev si un profesor.
-- (Politicile RLS vechi ale lui classes si class_members nu sunt in migrari, de aceea trebuie vazute in baza.)

-- ===== BLOC 1: politicile tabelelor sensibile =====
-- Ma intereseaza mai ales: cine poate citi `classes` (si coloana invite_code) si `class_members`, si ce cmd au politicile "ALL".
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('classes', 'class_members', 'class_join_requests', 'class_member_links', 'class_sessions', 'attendance_records', 'class_posts',
                    'reg_workbooks', 'reg_groups', 'reg_students', 'reg_lessons', 'reg_commands', 'reg_replacements', 'user_profiles')
order by tablename, cmd, policyname;

-- ===== BLOC 2: ce vede un ELEV obisnuit (unul care e intr-o singura clasa) =====
-- Rezultatul apare ca MESAJ DE EROARE (e intentionat: blocul se anuleaza singur, deci nu poate schimba nimic). Citesti "total" si "vede" pe fiecare tabel.
-- Un elev ar trebui sa vada doar clasa lui; reg_* si class_join_requests / class_member_links ale altora, deloc.
do $$
declare
  v_uid uuid; t text; n bigint; r text := '';
  tabs text[] := array['classes', 'class_members', 'class_posts', 'class_join_requests', 'class_member_links', 'reg_workbooks', 'reg_groups', 'reg_students', 'reg_lessons', 'user_profiles'];
  totals jsonb := '{}'::jsonb;
begin
  select student_id into v_uid from public.class_members group by student_id having count(*) = 1 limit 1;
  if v_uid is null then raise exception 'Nu am gasit niciun elev care sa fie intr-o singura clasa.'; end if;
  foreach t in array tabs loop
    begin execute format('select count(*) from public.%I', t) into n; totals := totals || jsonb_build_object(t, n);
    exception when undefined_table then totals := totals || jsonb_build_object(t, -1); end;
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  foreach t in array tabs loop
    begin execute format('select count(*) from public.%I', t) into n;
    exception when others then n := -1; end;
    r := r || rpad(t, 22) || ' total ' || rpad((totals ->> t), 6) || ' vede ' || n || E'\n';
  end loop;
  raise exception E'\nELEV (%) \n%\n(-1 = tabelul nu exista sau nu are voie sa-l citeasca)', v_uid, r;
end $$;

-- ===== BLOC 3: ce vede un PROFESOR care NU are registru legat =====
-- Ar trebui sa vada doar clasele lui (poate niciuna) si nimic din reg_* sau din cererile altora.
do $$
declare
  v_uid uuid; t text; n bigint; r text := '';
  tabs text[] := array['classes', 'class_members', 'class_posts', 'class_join_requests', 'class_member_links', 'reg_workbooks', 'reg_groups', 'reg_students', 'reg_lessons', 'reg_commands', 'user_profiles'];
  totals jsonb := '{}'::jsonb;
begin
  select user_id into v_uid from public.user_profiles
    where role = 'profesor' and user_id not in (select owner_user_id from public.reg_workbooks where owner_user_id is not null) limit 1;
  if v_uid is null then raise exception 'Nu am gasit niciun profesor fara registru legat.'; end if;
  foreach t in array tabs loop
    begin execute format('select count(*) from public.%I', t) into n; totals := totals || jsonb_build_object(t, n);
    exception when undefined_table then totals := totals || jsonb_build_object(t, -1); end;
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  foreach t in array tabs loop
    begin execute format('select count(*) from public.%I', t) into n;
    exception when others then n := -1; end;
    r := r || rpad(t, 22) || ' total ' || rpad((totals ->> t), 6) || ' vede ' || n || E'\n';
  end loop;
  raise exception E'\nPROFESOR FARA REGISTRU (%) \n%\n(-1 = tabelul nu exista sau nu are voie sa-l citeasca)', v_uid, r;
end $$;
