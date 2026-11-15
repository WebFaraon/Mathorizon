-- ============================================================
-- Nickname si pentru profesori (wizardul de la prima conectare)
--
-- Elevii aleg nickname si clasa, profesorii doar nickname. Numele real ramane in clase, registre si catalog;
-- nickname-ul se vede in profil (si in clasamentul elevilor).
-- Singura schimbare: complete_student_onboarding accepta si rolul 'profesor'. Pentru profesor clasa nu se cere
-- (p_grade poate fi null si nu se salveaza). Pentru elev totul ramane la fel.
-- ============================================================

create or replace function public.complete_student_onboarding(p_nickname text, p_grade integer)
returns jsonb
security definer set search_path = public
language plpgsql as $$
declare
  uid uuid := auth.uid();
  r text;
  cur text;
  last_at timestamptz;
  n text := lower(trim(coalesce(p_nickname, '')));
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select role, nickname, coalesce(nickname_changed_at, onboarded_at) into r, cur, last_at from public.user_profiles where user_id = uid;
  if r is null or r not in ('elev', 'profesor') then return jsonb_build_object('ok', false, 'error', 'not_student'); end if;
  if n !~ '^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$' then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if public._nickname_reserved(n) then return jsonb_build_object('ok', false, 'error', 'reserved'); end if;
  if r = 'elev' and (p_grade is null or p_grade < 5 or p_grade > 12) then return jsonb_build_object('ok', false, 'error', 'grade'); end if;
  -- un nickname deja ales nu se schimba inainte sa treaca 60 de zile
  if cur is not null and cur is distinct from n and last_at is not null and now() < last_at + interval '60 days' then
    return jsonb_build_object('ok', false, 'error', 'locked', 'until', last_at + interval '60 days');
  end if;
  begin
    update public.user_profiles
       set nickname = n,
           nickname_changed_at = case when nickname is distinct from n then now() else nickname_changed_at end,
           grade = case when r = 'elev' then p_grade::smallint else grade end,
           onboarded_at = coalesce(onboarded_at, now())
     where user_id = uid;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end;
  return jsonb_build_object('ok', true, 'nickname', n, 'grade', case when r = 'elev' then p_grade else null end);
end;
$$;
revoke execute on function public.complete_student_onboarding(text, integer) from public, anon;
grant execute on function public.complete_student_onboarding(text, integer) to authenticated;

-- ------------------------------------------------------------
-- Verificare dupa rulare: trebuie sa returneze ZERO randuri
--
-- select p.proname
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('complete_student_onboarding')
--   and has_function_privilege('anon', p.oid, 'execute');
-- ------------------------------------------------------------
