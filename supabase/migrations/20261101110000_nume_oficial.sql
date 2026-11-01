-- Numele oficial al profesorilor si al managerilor ("Nume Prenume"), pus de admin la aprobare si tinut intr-un singur loc.
--   - consola, clasele si registrele legate de un cont de profesor il folosesc pe el (sincronizarea nu-l mai rescrie din titlul fisierului)
--   - managerii aprobati intra in lista consolei si, prin functia registru-config, in lista din fisierul-mamă (CONFIGURARI, coloana B)
--   - numele din profilul personal al profesorului (display_name) nu se atinge

alter table public.user_profiles add column if not exists official_name text;
alter table public.user_profiles add column if not exists config_synced_at timestamptz;     -- cand a fost gasit managerul in lista din fisierul-mamă

-- cheia unui nume: fara diacritice, fara litere mari, cuvintele in ordine alfabetica ("Cerchez Cristina" = "Cristina Cerchez")
create or replace function public.name_key(p text) returns text
language sql immutable set search_path = public as $$
  select coalesce(string_agg(t, ' ' order by t), '')
  from unnest(regexp_split_to_array(btrim(regexp_replace(lower(translate(coalesce(p, ''), 'ăâîșşțţĂÂÎȘŞȚŢéèëüöä', 'aaisstt' || 'AAISSTT' || 'eeeuoa')), '[^a-z0-9 ]+', ' ', 'g')), '\s+')) t
  where t <> ''
$$;

-- profesorii care au deja un registru legat: numele lor oficial e cel din registru (cel de pana acum)
update public.user_profiles up set official_name = w.teacher_name
from public.reg_workbooks w
where w.owner_user_id = up.user_id and up.role = 'profesor' and up.official_name is null and nullif(btrim(w.teacher_name), '') is not null;

-- un registru legat de un cont cu nume oficial poarta numele acela, orice ar scrie sincronizarea din titlul fisierului
create or replace function public.reg_workbook_official_name() returns trigger
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if new.owner_user_id is not null then
    select official_name into v from public.user_profiles where user_id = new.owner_user_id and official_name is not null;
    if v is not null then new.teacher_name := v; end if;
  end if;
  return new;
end $$;
revoke all on function public.reg_workbook_official_name() from public, anon, authenticated;
drop trigger if exists reg_workbooks_official_name on public.reg_workbooks;
create trigger reg_workbooks_official_name before insert or update on public.reg_workbooks
  for each row execute function public.reg_workbook_official_name();

-- aprobarea cere numele oficial (la respingere nu)
drop function if exists public.admin_set_account_status(uuid, text);
create or replace function public.admin_set_account_status(p_user uuid, p_status text, p_name text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_name text := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), ''); v_role text;
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  if p_status not in ('active', 'rejected') then raise exception 'invalid status'; end if;
  select role into v_role from public.user_profiles where user_id = p_user and role in ('profesor', 'manager');
  if v_role is null then raise exception 'not a teacher or manager'; end if;
  if p_status = 'active' then
    if v_name is null then raise exception 'name required'; end if;
    if exists (select 1 from public.user_profiles where user_id <> p_user and official_name is not null and public.name_key(official_name) = public.name_key(v_name)) then raise exception 'name taken'; end if;
    update public.user_profiles set status = 'active', official_name = v_name, config_synced_at = null where user_id = p_user;
    if v_role = 'profesor' then update public.reg_workbooks set teacher_name = v_name where owner_user_id = p_user; end if;
  else
    update public.user_profiles set status = 'rejected' where user_id = p_user;
  end if;
end $$;

-- schimbarea numelui oficial: la un manager care are deja elevi in registre nu se poate (numele lui e scris in celulele lor)
create or replace function public.admin_set_official_name(p_user uuid, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_name text := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), ''); r record;
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  if v_name is null then raise exception 'name required'; end if;
  select role, official_name into r from public.user_profiles where user_id = p_user and role in ('profesor', 'manager');
  if not found then raise exception 'not a teacher or manager'; end if;
  if exists (select 1 from public.user_profiles where user_id <> p_user and official_name is not null and public.name_key(official_name) = public.name_key(v_name)) then raise exception 'name taken'; end if;
  if r.role = 'manager' and r.official_name is not null and r.official_name <> v_name
     and exists (select 1 from public.reg_students s where public.name_key(s.manager) = public.name_key(r.official_name)) then
    raise exception 'manager has students';
  end if;
  update public.user_profiles set official_name = v_name, config_synced_at = case when r.role = 'manager' then null else config_synced_at end where user_id = p_user;
  if r.role = 'profesor' then update public.reg_workbooks set teacher_name = v_name where owner_user_id = p_user; end if;
end $$;

-- listele din Conturi, cu numele oficial (si, la manageri, daca sunt in lista registrelor)
drop function if exists public.admin_professor_overview();
create or replace function public.admin_professor_overview()
returns table (user_id uuid, email text, full_name text, status text, created_at timestamptz, avatar_url text, workbook_ids uuid[], classes_count bigint, official_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  return query
    select up.user_id, au.email::text, (au.raw_user_meta_data->>'full_name')::text, up.status, up.created_at, up.avatar_url,
           coalesce((select array_agg(w.id order by w.created_at) from public.reg_workbooks w where w.owner_user_id = up.user_id), '{}'::uuid[]),
           (select count(*) from public.classes c where c.teacher_id = up.user_id), up.official_name
    from public.user_profiles up
    join auth.users au on au.id = up.user_id
    where up.role = 'profesor'
    order by up.created_at desc;
end $$;

drop function if exists public.admin_manager_overview();
create or replace function public.admin_manager_overview()
returns table (user_id uuid, email text, full_name text, status text, created_at timestamptz, avatar_url text, official_name text, config_synced_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  return query
    select up.user_id, au.email::text, (au.raw_user_meta_data->>'full_name')::text, up.status, up.created_at, up.avatar_url, up.official_name, up.config_synced_at
    from public.user_profiles up join auth.users au on au.id = up.user_id
    where up.role = 'manager'
    order by up.created_at desc;
end $$;

-- managerii aprobati, pentru listele consolei (admin si manager)
create or replace function public.staff_manager_names()
returns table (name text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_staff() then raise exception 'not authorized'; end if;
  return query select up.official_name from public.user_profiles up where up.role = 'manager' and up.status = 'active' and up.official_name is not null order by 1;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_set_account_status(uuid, text, text)', 'public.admin_set_official_name(uuid, text)', 'public.admin_professor_overview()', 'public.admin_manager_overview()', 'public.staff_manager_names()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
