-- Diagnostic de acces: ce poate citi un strain? Doar citeste, nu schimba nimic. Ruleaza pe rand in Supabase SQL si lipeste-mi rezultatele.
-- (Politicile RLS vechi ale lui classes si class_members nu sunt in migrari, de aceea trebuie vazute in baza.)

-- 1) Politicile tabelelor sensibile. Ma intereseaza mai ales: cine poate citi `classes` (si coloana invite_code) si `class_members`, si ce cmd au politicile "ALL".
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('classes', 'class_members', 'class_join_requests', 'class_member_links', 'class_sessions', 'attendance_records', 'class_posts',
                    'reg_workbooks', 'reg_groups', 'reg_students', 'reg_lessons', 'reg_commands', 'reg_replacements', 'user_profiles')
order by tablename, cmd, policyname;

-- 2) Cate randuri totale are fiecare (referinta pentru pasii 3 si 4).
select 'classes' as tabel, count(*) as total from public.classes
union all select 'class_members', count(*) from public.class_members
union all select 'class_posts', count(*) from public.class_posts
union all select 'reg_students', count(*) from public.reg_students
union all select 'reg_workbooks', count(*) from public.reg_workbooks
union all select 'user_profiles', count(*) from public.user_profiles;

-- 3) Ce vede un ELEV obisnuit. Inlocuieste <UUID_ELEV> cu user_id-ul unui elev care e in UNA singura clasa (il gasesti in class_members).
--    Un elev ar trebui sa vada doar clasa lui; reg_* si class_join_requests ale altora, deloc.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<UUID_ELEV>', 'role', 'authenticated')::text, true);
select 'classes' as tabel, count(*) as vede from public.classes
union all select 'class_members', count(*) from public.class_members
union all select 'class_posts', count(*) from public.class_posts
union all select 'class_join_requests', count(*) from public.class_join_requests
union all select 'class_member_links', count(*) from public.class_member_links
union all select 'reg_workbooks', count(*) from public.reg_workbooks
union all select 'reg_groups', count(*) from public.reg_groups
union all select 'reg_students', count(*) from public.reg_students
union all select 'reg_lessons', count(*) from public.reg_lessons
union all select 'user_profiles', count(*) from public.user_profiles;
rollback;

-- 4) Ce vede un PROFESOR care NU are registru legat. Inlocuieste <UUID_PROF>. Ar trebui sa vada doar clasele lui (poate niciuna) si nimic din reg_*.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<UUID_PROF>', 'role', 'authenticated')::text, true);
select 'classes' as tabel, count(*) as vede from public.classes
union all select 'class_members', count(*) from public.class_members
union all select 'class_join_requests', count(*) from public.class_join_requests
union all select 'reg_workbooks', count(*) from public.reg_workbooks
union all select 'reg_students', count(*) from public.reg_students
union all select 'reg_commands', count(*) from public.reg_commands
union all select 'user_profiles', count(*) from public.user_profiles;
rollback;
