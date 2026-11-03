-- Profilul managerului din consola: legarea Telegram si numerele lui.
--   1. telegram_link_code(): pe langa profesor si admin, il poate cere si un manager aprobat (activ).
--   2. manager_my_stats(): cati elevi are managerul in registre (dupa numele oficial), fara nicio suma de bani.
-- Se ruleaza dupa 20261104100000_schimbari_lectii_manageri.sql. Nu cere redeploy la nicio functie Edge in afara de telegram-bot (vezi mai jos).

-- ---------- 1. legarea Telegram ----------
-- Aceeasi semnatura ca inainte: CREATE OR REPLACE pastreaza drepturile (anon nu are EXECUTE), le pun totusi din nou la sfarsit.
create or replace function public.telegram_link_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if v_uid is null then raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_profiles
                  where user_id = v_uid and (role in ('profesor', 'admin') or (role = 'manager' and status = 'active'))) then
    raise exception 'Doar profesorii și managerii aprobați își pot conecta Telegram.' using errcode = '42501';
  end if;
  delete from public.telegram_link_codes where user_id = v_uid or expires_at < now();
  loop
    v_code := '';
    for i in 1..8 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * 32)::int, 1); end loop;
    begin
      insert into public.telegram_link_codes (code, user_id, expires_at) values (v_code, v_uid, now() + interval '15 minutes');
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return v_code;
end $$;

-- ---------- 2. numerele managerului ----------
-- Elevii pe care managerul e scris in registre (numele oficial, comparat cu name_key). "Inscrisi" = aceleasi stari ca la Schimbari.
-- Un elev din mai multe grupe se numara o data. Intoarce null pentru oricine nu e manager activ; fara nume oficial, doar official_name = null.
create or replace function public.manager_my_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text; v_status text; v_name text;
  v_in constant text[] := array['activ', 'ora de proba', 'ora de proba confirmata', 'instabil', 'inlocuire'];
  v_students int; v_active int; v_trial int; v_groups int; v_negative int;
begin
  select up.role, up.status, up.official_name into v_role, v_status, v_name from public.user_profiles up where up.user_id = auth.uid();
  if v_role is distinct from 'manager' or v_status is distinct from 'active' then return null; end if;
  if nullif(btrim(coalesce(v_name, '')), '') is null then return jsonb_build_object('official_name', null); end if;

  with mine as (
    select s.group_id, public.name_key(s.name) as k, s.sold,
           lower(translate(coalesce(s.status, ''), 'ăâîșşțţ', 'aaisstt')) as st
      from public.reg_students s
     where public.name_key(s.manager) = public.name_key(v_name) and nullif(btrim(coalesce(s.name, '')), '') is not null
  )
  select count(distinct k) filter (where st = any (v_in)),
         count(distinct k) filter (where st = 'activ'),
         count(distinct k) filter (where st like 'ora de proba%'),
         count(distinct group_id) filter (where st = any (v_in)),
         count(distinct k) filter (where st = any (v_in) and coalesce(sold, 0) < 0)
    into v_students, v_active, v_trial, v_groups, v_negative
    from mine;

  return jsonb_build_object('official_name', v_name, 'students', v_students, 'active', v_active, 'trial', v_trial, 'groups', v_groups, 'negative', v_negative);
end $$;

-- ---------- 3. drepturi ----------
revoke all on function public.telegram_link_code() from public, anon;
revoke all on function public.manager_my_stats() from public, anon;
grant execute on function public.telegram_link_code() to authenticated;
grant execute on function public.manager_my_stats() to authenticated;

-- Verificare dupa rulare (nu trebuie sa apara niciun rand):
--   select routine_name, grantee from information_schema.routine_privileges
--    where routine_schema = 'public' and routine_name in ('telegram_link_code', 'manager_my_stats') and grantee in ('anon', 'public');
