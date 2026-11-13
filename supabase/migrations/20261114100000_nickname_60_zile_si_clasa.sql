-- ============================================================
-- Nickname-ul se poate schimba o data la 60 de zile; clasa se schimba liber din Învață
--
--  * user_profiles.nickname_changed_at : cand a fost pus sau schimbat ultima oara nickname-ul
--    (la conturile care aveau deja nickname, se socotesc 60 de zile de la terminarea wizardului: onboarded_at)
--  * complete_student_onboarding : prima setare e libera; o schimbare ulterioara se respinge cu error = 'locked'
--    si data pana cand e blocat (until), atata timp cat n-au trecut 60 de zile
--  * set_student_grade(p_grade)  : doar clasa, fara nickname (cheia „Clasa a X-a” din Învață)
--  * my_student_profile          : intoarce si locked_until (null daca se poate schimba)
-- ============================================================

alter table public.user_profiles add column if not exists nickname_changed_at timestamptz;

create or replace function public.my_student_profile()
returns jsonb
security definer set search_path = public
language sql stable as $$
  select jsonb_build_object(
    'role', up.role,
    'nickname', up.nickname,
    'grade', up.grade,
    'onboarded', up.onboarded_at is not null,
    'locked_until', case
      when up.nickname is not null and coalesce(up.nickname_changed_at, up.onboarded_at) is not null
           and now() < coalesce(up.nickname_changed_at, up.onboarded_at) + interval '60 days'
      then coalesce(up.nickname_changed_at, up.onboarded_at) + interval '60 days'
      else null end
  )
  from public.user_profiles up
  where up.user_id = auth.uid();
$$;
revoke execute on function public.my_student_profile() from public, anon;
grant execute on function public.my_student_profile() to authenticated;

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
  if r is distinct from 'elev' then return jsonb_build_object('ok', false, 'error', 'not_student'); end if;
  if n !~ '^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$' then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if public._nickname_reserved(n) then return jsonb_build_object('ok', false, 'error', 'reserved'); end if;
  if p_grade is null or p_grade < 5 or p_grade > 12 then return jsonb_build_object('ok', false, 'error', 'grade'); end if;
  -- un nickname deja ales nu se schimba inainte sa treaca 60 de zile
  if cur is not null and cur is distinct from n and last_at is not null and now() < last_at + interval '60 days' then
    return jsonb_build_object('ok', false, 'error', 'locked', 'until', last_at + interval '60 days');
  end if;
  begin
    update public.user_profiles
       set nickname = n,
           nickname_changed_at = case when nickname is distinct from n then now() else nickname_changed_at end,
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

create or replace function public.set_student_grade(p_grade integer)
returns jsonb
security definer set search_path = public
language plpgsql as $$
declare
  uid uuid := auth.uid();
  r text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select role into r from public.user_profiles where user_id = uid;
  if r is distinct from 'elev' then return jsonb_build_object('ok', false, 'error', 'not_student'); end if;
  if p_grade is null or p_grade < 5 or p_grade > 12 then return jsonb_build_object('ok', false, 'error', 'grade'); end if;
  update public.user_profiles set grade = p_grade::smallint where user_id = uid;
  return jsonb_build_object('ok', true, 'grade', p_grade);
end;
$$;
revoke execute on function public.set_student_grade(integer) from public, anon;
grant execute on function public.set_student_grade(integer) to authenticated;

-- ------------------------------------------------------------
-- Verificare dupa rulare: trebuie sa returneze ZERO randuri
-- (nicio functie de aici nu are voie sa fie apelabila de anon; CREATE OR REPLACE pastreaza drepturile, dar le retragem oricum)
--
-- select p.proname
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('my_student_profile','complete_student_onboarding','set_student_grade')
--   and has_function_privilege('anon', p.oid, 'execute');
-- ------------------------------------------------------------
