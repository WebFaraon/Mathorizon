-- Rolul de manager.
--   - se inregistreaza ca profesorii (cerere, status pending) si intra in consola doar dupa ce adminul il aproba
--   - are acces doar la consola, in paginile Acasa, Orar, Elevi, Inscriere, Starturi, Inlocuiri, Disponibilitate (restrictia paginilor o face consola; aici sunt drepturile din baza de date)
--   - "personal" (staff) = admin sau manager aprobat: reg_is_staff()
--
-- ATENTIE: in aceeasi zi am gasit ca oricine isi putea crea singur profilul de profesor cu status "active" (politica de inserare verifica doar rolul, nu si statusul):
-- un cont nou se aproba singur. Politica de mai jos cere status pending pentru profesor si manager.

-- 1. rolul nou
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles add constraint user_profiles_role_check check (role = any (array['elev', 'profesor', 'admin', 'manager']));

-- 2. profilul propriu: elevul activ, profesorul si managerul in asteptare, planul free
drop policy if exists users_insert_own_profile on public.user_profiles;
create policy users_insert_own_profile on public.user_profiles for insert
  with check (
    auth.uid() = user_id
    and ((role = 'elev' and status = 'active') or (role in ('profesor', 'manager') and status = 'pending'))
    and coalesce(plan, 'free') = 'free'
  );

-- 3. cine e "personal"
create or replace function public.reg_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_profiles where user_id = auth.uid() and (role = 'admin' or (role = 'manager' and status = 'active')));
$$;
revoke all on function public.reg_is_staff() from public, anon;
grant execute on function public.reg_is_staff() to authenticated;

-- 4. ce citeste si ce scrie personalul (registrele, comenzile, cabinetele, starturile)
create or replace function public.reg_can_see(p_workbook uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.reg_is_staff()
      or exists (select 1 from public.reg_workbooks w where w.id = p_workbook and w.owner_user_id = auth.uid());
$$;
create or replace function public.reg_can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select public.reg_is_staff();
$$;

drop policy if exists console_rooms_read on public.console_rooms;
create policy console_rooms_read on public.console_rooms for select to authenticated using (public.reg_is_staff());

create or replace function public.console_set_room(p_num int, p_seats int, p_floor int default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_staff() then raise exception 'not authorized'; end if;
  if p_seats is null then
    delete from public.console_rooms where num = p_num;
  else
    insert into public.console_rooms (num, seats, floor, updated_at, updated_by) values (p_num, p_seats, p_floor, now(), auth.uid())
    on conflict (num) do update set seats = excluded.seats, floor = excluded.floor, updated_at = now(), updated_by = auth.uid();
  end if;
end $$;

drop policy if exists group_start_requests_read on public.group_start_requests;
create policy group_start_requests_read on public.group_start_requests for select to authenticated using (public.reg_is_staff());

create or replace function public.start_request_mark(p_id uuid, p_what text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_staff() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_what = 'seen' then
    update public.group_start_requests set manager_seen_at = coalesce(manager_seen_at, now()) where id = p_id;
  elsif p_what = 'done' then
    update public.group_start_requests set manager_seen_at = coalesce(manager_seen_at, now()), manager_done_at = now() where id = p_id and status in ('confirmed', 'declined');
  elsif p_what = 'reopen' then
    update public.group_start_requests set manager_done_at = null where id = p_id;
  else
    raise exception 'unknown action';
  end if;
end $$;

drop policy if exists telegram_links_read on public.telegram_links;
create policy telegram_links_read on public.telegram_links for select to authenticated using (user_id = auth.uid() or public.reg_is_staff());

-- codurile de invitatie ale claselor (Orar, Inscriere)
drop policy if exists classes_select_scoped on public.classes;
create policy classes_select_scoped on public.classes for select to authenticated
  using (teacher_id = auth.uid() or public.is_class_member(id) or public.reg_is_staff());

-- contul elevului in fisa lui (Elevi): cine are cont, cu ce e-mail, ce pachet
create or replace function public.admin_student_accounts()
returns table (reg_group_id uuid, reg_student_name text, user_id uuid, email text, full_name text, plan text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_staff() then raise exception 'not authorized'; end if;
  return query
    select c.reg_group_id, l.reg_student_name, l.student_id, au.email::text, (au.raw_user_meta_data->>'full_name')::text, up.plan
    from public.class_member_links l
    join public.classes c on c.id = l.class_id and c.reg_group_id is not null
    join auth.users au on au.id = l.student_id
    left join public.user_profiles up on up.user_id = l.student_id;
end $$;

create or replace function public.set_student_plan(target_user_id uuid, new_plan text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if new_plan not in ('free', 'standard', 'premium') then raise exception 'invalid plan'; end if;
  if not public.reg_is_staff() then raise exception 'not authorized'; end if;
  update public.user_profiles set plan = new_plan where user_id = target_user_id and role = 'elev';
end $$;

-- 5. Conturi (doar admin): cererile de profesor si de manager, lista managerilor, stergerea unui manager
create or replace function public.admin_pending_accounts()
returns table (user_id uuid, role text, created_at timestamptz, email text, full_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  return query
    select up.user_id, up.role, up.created_at, au.email::text, (au.raw_user_meta_data->>'full_name')::text
    from public.user_profiles up join auth.users au on au.id = up.user_id
    where up.role in ('profesor', 'manager') and up.status = 'pending'
    order by up.created_at asc;
end $$;

create or replace function public.admin_set_account_status(p_user uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  if p_status not in ('active', 'rejected') then raise exception 'invalid status'; end if;
  update public.user_profiles set status = p_status where user_id = p_user and role in ('profesor', 'manager');
  if not found then raise exception 'not a teacher or manager'; end if;
end $$;

create or replace function public.admin_manager_overview()
returns table (user_id uuid, email text, full_name text, status text, created_at timestamptz, avatar_url text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  return query
    select up.user_id, au.email::text, (au.raw_user_meta_data->>'full_name')::text, up.status, up.created_at, up.avatar_url
    from public.user_profiles up join auth.users au on au.id = up.user_id
    where up.role = 'manager'
    order by up.created_at desc;
end $$;

-- un manager sters pierde accesul la consola; contul ramane ca simplu cont de elev
create or replace function public.admin_remove_manager(p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  update public.user_profiles set role = 'elev', status = 'active', plan = 'free' where user_id = p_user and role = 'manager';
  if not found then raise exception 'not a manager'; end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_student_accounts()', 'public.set_student_plan(uuid, text)', 'public.console_set_room(int, int, int)', 'public.start_request_mark(uuid, text)',
    'public.admin_pending_accounts()', 'public.admin_set_account_status(uuid, text)', 'public.admin_manager_overview()', 'public.admin_remove_manager(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
