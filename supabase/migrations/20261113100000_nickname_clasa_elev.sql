-- ============================================================
-- Nickname unic si clasa elevului (wizard la prima conectare)
--
--  * user_profiles.nickname  : @nickname unic (fara diferenta intre litere mari si mici), 3 pana la 20 de caractere
--  * user_profiles.grade     : clasa (5 pana la 12), pentru parcursul de lectii
--  * user_profiles.onboarded_at : cand a trecut elevul prin wizard
--
-- Nickname-ul se vede DOAR in clasamentul Top elevi (decizia fondatorului). Numele real ramane peste tot in rest.
-- Elevul nu poate scrie direct in user_profiles (nu exista politica de UPDATE pentru el, role/status/plan sunt pe acelasi rand),
-- deci totul trece prin functii security definer care verifica auth.uid().
-- ============================================================

alter table public.user_profiles add column if not exists nickname text;
alter table public.user_profiles add column if not exists grade smallint;
alter table public.user_profiles add column if not exists onboarded_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_nickname_chk') then
    alter table public.user_profiles
      add constraint user_profiles_nickname_chk
      check (nickname is null or nickname ~ '^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_grade_chk') then
    alter table public.user_profiles
      add constraint user_profiles_grade_chk
      check (grade is null or grade between 5 and 12);
  end if;
end $$;

create unique index if not exists user_profiles_nickname_uq
  on public.user_profiles (lower(nickname)) where nickname is not null;

-- cuvinte care nu pot fi nickname (confuzie cu personalul sau cu brandul)
create or replace function public._nickname_reserved(p text)
returns boolean language sql immutable as $$
  select p = any (array[
    'admin','administrator','teorema','mathorizon','profesor','profesori','manager','moderator',
    'suport','support','staff','echipa','oficial','official','bufnita','owl','elev','elevi','test','null','undefined'
  ]);
$$;
revoke execute on function public._nickname_reserved(text) from public, anon;

-- 'ok' | 'taken' | 'invalid' | 'reserved'   (nickname-ul propriu conteaza ca liber)
create or replace function public.nickname_available(p_nickname text)
returns text
security definer set search_path = public
language plpgsql stable as $$
declare
  n text := lower(trim(coalesce(p_nickname, '')));
begin
  if auth.uid() is null then return 'invalid'; end if;
  if n !~ '^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$' then return 'invalid'; end if;
  if public._nickname_reserved(n) then return 'reserved'; end if;
  if exists (select 1 from public.user_profiles where lower(nickname) = n and user_id <> auth.uid()) then
    return 'taken';
  end if;
  return 'ok';
end;
$$;
revoke execute on function public.nickname_available(text) from public, anon;
grant execute on function public.nickname_available(text) to authenticated;

-- profilul de elev al celui conectat (null daca nu are rand)
create or replace function public.my_student_profile()
returns jsonb
security definer set search_path = public
language sql stable as $$
  select jsonb_build_object(
    'role', up.role,
    'nickname', up.nickname,
    'grade', up.grade,
    'onboarded', up.onboarded_at is not null
  )
  from public.user_profiles up
  where up.user_id = auth.uid();
$$;
revoke execute on function public.my_student_profile() from public, anon;
grant execute on function public.my_student_profile() to authenticated;

-- wizardul: seteaza nickname-ul si clasa (si se poate chema din nou pentru schimbare, din profil)
create or replace function public.complete_student_onboarding(p_nickname text, p_grade integer)
returns jsonb
security definer set search_path = public
language plpgsql as $$
declare
  uid uuid := auth.uid();
  r text;
  n text := lower(trim(coalesce(p_nickname, '')));
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select role into r from public.user_profiles where user_id = uid;
  if r is distinct from 'elev' then return jsonb_build_object('ok', false, 'error', 'not_student'); end if;
  if n !~ '^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$' then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if public._nickname_reserved(n) then return jsonb_build_object('ok', false, 'error', 'reserved'); end if;
  if p_grade is null or p_grade < 5 or p_grade > 12 then return jsonb_build_object('ok', false, 'error', 'grade'); end if;
  begin
    update public.user_profiles
       set nickname = n,
           grade = p_grade::smallint,
           onboarded_at = coalesce(onboarded_at, now())
     where user_id = uid;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end;
  return jsonb_build_object('ok', true, 'nickname', n, 'grade', p_grade);
end;
$$;
revoke execute on function public.complete_student_onboarding(text, integer) from public, anon;
grant execute on function public.complete_student_onboarding(text, integer) to authenticated;

-- clasamentul: adauga nickname-ul (clientul arata @nickname, iar fara nickname numele ca pana acum)
drop function if exists public.get_xp_leaderboard(integer);

create function public.get_xp_leaderboard(p_limit integer default 500)
returns table(
  user_id      uuid,
  display_name text,
  avatar_url   text,
  total_xp     integer,
  best_streak  integer,
  rank         integer,
  nickname     text
)
security definer set search_path = public
language plpgsql as $$
begin
  return query
    select
      up.user_id,
      coalesce(up.display_name, 'Elev Teorema') as display_name,
      up.avatar_url,
      coalesce(ts.total_xp, 0) as total_xp,
      coalesce(ts.best_streak, 0) as best_streak,
      row_number() over (
        order by coalesce(ts.total_xp, 0) desc,
                 coalesce(ts.best_streak, 0) desc,
                 coalesce(up.nickname, up.display_name, 'Elev Teorema') asc
      )::integer as rank,
      up.nickname
    from public.user_profiles up
    left join public.training_stats ts on ts.user_id = up.user_id
    where up.role = 'elev'
    order by coalesce(ts.total_xp, 0) desc,
             coalesce(ts.best_streak, 0) desc,
             coalesce(up.nickname, up.display_name, 'Elev Teorema') asc
    limit greatest(p_limit, 0);
end;
$$;

-- DROP + CREATE redă EXECUTE catre anon: se retrage din nou
revoke execute on function public.get_xp_leaderboard(integer) from public, anon;
grant execute on function public.get_xp_leaderboard(integer) to authenticated;

-- ------------------------------------------------------------
-- Verificare dupa rulare: trebuie sa returneze ZERO randuri
-- (nicio functie noua nu are voie sa fie apelabila de anon)
--
-- select p.proname
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('nickname_available','my_student_profile','complete_student_onboarding','get_xp_leaderboard','_nickname_reserved')
--   and has_function_privilege('anon', p.oid, 'execute');
-- ------------------------------------------------------------
