-- Pagina Conturi: profesori cu poza si registrele lor, conturile elevilor legate de registru, stergerea unui profesor.
-- Toate trei sunt doar pentru admin (la fel ca get_all_students si celelalte).

-- 1. Profesorii: ce are get_all_professors, plus poza de profil, registrele legate de cont si cate clase are pe platforma.
create or replace function public.admin_professor_overview()
returns table (user_id uuid, email text, full_name text, status text, created_at timestamptz, avatar_url text, workbook_ids uuid[], classes_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  return query
    select up.user_id, au.email::text, (au.raw_user_meta_data->>'full_name')::text, up.status, up.created_at, up.avatar_url,
           coalesce((select array_agg(w.id order by w.created_at) from public.reg_workbooks w where w.owner_user_id = up.user_id), '{}'::uuid[]),
           (select count(*) from public.classes c where c.teacher_id = up.user_id)
    from public.user_profiles up
    join auth.users au on au.id = up.user_id
    where up.role = 'profesor'
    order by up.created_at desc;
end $$;

-- 2. Conturile elevilor care au fost legate de numele lor din registru (de profesor, la acceptarea cererii de alaturare).
--    Consola le arata in fisa elevului: are cont, cu ce e-mail, ce pachet.
create or replace function public.admin_student_accounts()
returns table (reg_group_id uuid, reg_student_name text, user_id uuid, email text, full_name text, plan text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  return query
    select c.reg_group_id, l.reg_student_name, l.student_id, au.email::text, (au.raw_user_meta_data->>'full_name')::text, up.plan
    from public.class_member_links l
    join public.classes c on c.id = l.class_id and c.reg_group_id is not null
    join auth.users au on au.id = l.student_id
    left join public.user_profiles up on up.user_id = l.student_id;
end $$;

-- 3. Stergerea unui profesor (demisie): pierde functiile de profesor, nu si contul.
--    - contul ramane, ca simplu cont de elev (plan free)
--    - registrele lui se dezleaga de cont (cand legi registrul de contul noului profesor, clasele trec singure la el)
--    - clasele lui trec la contul adminului care sterge, ca elevii sa nu piarda mesajele, temele si notele
--    - legatura cu Telegram se taie
create or replace function public.admin_remove_professor(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_admin uuid := auth.uid(); v_name text; v_classes int; v_books int;
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.user_profiles where user_id = p_user and role = 'profesor') then raise exception 'not a teacher'; end if;
  select coalesce(nullif(btrim(display_name), ''), 'Administrator') into v_name from public.user_profiles where user_id = v_admin;

  update public.reg_workbooks set owner_user_id = null where owner_user_id = p_user;
  get diagnostics v_books = row_count;

  update public.classes set teacher_id = v_admin, teacher_name = coalesce(v_name, 'Administrator') where teacher_id = p_user;
  get diagnostics v_classes = row_count;

  delete from public.telegram_links where user_id = p_user;
  delete from public.telegram_link_codes where user_id = p_user;

  update public.user_profiles set role = 'elev', status = 'active', plan = 'free' where user_id = p_user;
  return jsonb_build_object('classes_moved', v_classes, 'registers_unlinked', v_books);
end $$;

revoke execute on function public.admin_professor_overview() from public, anon;
revoke execute on function public.admin_student_accounts() from public, anon;
revoke execute on function public.admin_remove_professor(uuid) from public, anon;
grant execute on function public.admin_professor_overview() to authenticated;
grant execute on function public.admin_student_accounts() to authenticated;
grant execute on function public.admin_remove_professor(uuid) to authenticated;
