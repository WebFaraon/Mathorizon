-- XP, seria zilnică și misiunile pe server (2026-11-25).
-- Până acum browserul scria singur în `training_stats`, `user_streak` și `user_daily_mission_claims`, deci oricine își putea scrie orice XP
-- și își putea urca locul în clasament. De acum aceste trei tabele nu mai pot fi scrise direct: singura cale e prin funcțiile de mai jos,
-- care au reguli și plafoane. Se rulează după 20261125100000. Se poate rula și a doua oară.
--
-- Ce garantează și ce nu: serverul nu poate ști dacă un răspuns din lecție a fost cu adevărat corect (corectarea se face în browser),
-- deci plafoanele limitează cât se poate trișa, nu dovedesc fiecare punct. Lecțiile plătesc o singură dată fiecare (referința lecției e unică),
-- misiunile au sume fixe pe server, iar orice altă acordare are plafon pe apel, pe oră și pe zi.

-- 1) Jurnalul acordărilor (nu îl citește nimeni din browser).
create table if not exists public.xp_events (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     integer not null check (amount > 0),
  source     text not null,
  ref        text,
  created_at timestamptz not null default now()
);
alter table public.xp_events enable row level security;
revoke all on table public.xp_events from public, anon, authenticated;
revoke all on sequence public.xp_events_id_seq from public, anon, authenticated;
create index if not exists xp_events_user_time on public.xp_events (user_id, created_at desc);
create unique index if not exists xp_events_lesson_once on public.xp_events (user_id, ref) where source = 'lectie';

-- 2) Acordarea de XP. Doar un elev confirmat primește. Întoarce {total, awarded}.
create or replace function public.award_xp(p_amount integer, p_source text, p_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  v_role text;
  v_max integer;
  v_hour integer;
  v_day integer;
  v_total integer;
begin
  if uid is null then raise exception 'not allowed' using errcode = '42501'; end if;
  select role into v_role from public.user_profiles where user_id = uid;
  select total_xp into v_total from public.training_stats where user_id = uid;
  v_total := coalesce(v_total, 0);
  if v_role is distinct from 'elev' then
    return jsonb_build_object('total', v_total, 'awarded', 0, 'reason', 'role');
  end if;

  v_max := case p_source when 'lectie' then 120 when 'antrenament' then 2500 else null end;
  if v_max is null then raise exception 'unknown source'; end if;
  if p_amount is null or p_amount < 1 or p_amount > v_max then raise exception 'amount out of range'; end if;
  if p_source = 'lectie' and (p_ref is null or length(p_ref) not between 1 and 80) then raise exception 'lesson reference needed'; end if;

  -- plafoane: cel mult 3500 XP pe oră și 9000 pe zi (un antrenament lung rămâne sub ele)
  select coalesce(sum(amount), 0) into v_hour from public.xp_events where user_id = uid and created_at > now() - interval '1 hour';
  select coalesce(sum(amount), 0) into v_day  from public.xp_events where user_id = uid and created_at > now() - interval '24 hours';
  if v_hour + p_amount > 3500 or v_day + p_amount > 9000 then
    return jsonb_build_object('total', v_total, 'awarded', 0, 'reason', 'cap');
  end if;

  if p_source = 'lectie' then
    begin
      insert into public.xp_events (user_id, amount, source, ref) values (uid, p_amount, p_source, p_ref);
    exception when unique_violation then
      return jsonb_build_object('total', v_total, 'awarded', 0, 'reason', 'already');
    end;
  else
    insert into public.xp_events (user_id, amount, source, ref) values (uid, p_amount, p_source, p_ref);
  end if;

  insert into public.training_stats (user_id, total_xp, best_streak, updated_at) values (uid, p_amount, 0, now())
  on conflict (user_id) do update set total_xp = public.training_stats.total_xp + p_amount, updated_at = now()
  returning total_xp into v_total;
  return jsonb_build_object('total', v_total, 'awarded', p_amount);
end $$;

-- 3) Cel mai bun șir de răspunsuri corecte (cosmetic): doar crește și are plafon.
create or replace function public.report_best_streak(p_value integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  v_role text;
  v integer;
begin
  if uid is null then raise exception 'not allowed' using errcode = '42501'; end if;
  select role into v_role from public.user_profiles where user_id = uid;
  if v_role is distinct from 'elev' then return 0; end if;
  insert into public.training_stats (user_id, total_xp, best_streak, updated_at) values (uid, 0, least(greatest(coalesce(p_value, 0), 0), 500), now())
  on conflict (user_id) do update set best_streak = greatest(public.training_stats.best_streak, least(greatest(coalesce(p_value, 0), 0), 500)), updated_at = now()
  returning best_streak into v;
  return v;
end $$;

-- 4) Seria zilnică: o singură creștere pe zi, după ziua din Chișinău (nu mai poate fi scrisă direct).
create or replace function public.bump_streak()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Chisinau')::date;
  v_count integer;
  v_last text;
  v_new integer;
  v_grew boolean := false;
begin
  if uid is null then raise exception 'not allowed' using errcode = '42501'; end if;
  select count, last_date into v_count, v_last from public.user_streak where user_id = uid;
  if not found then
    insert into public.user_streak (user_id, count, last_date) values (uid, 1, v_today::text);
    return jsonb_build_object('count', 1, 'last_date', v_today::text, 'grew', true);
  end if;
  if v_last = v_today::text and v_count > 0 then
    return jsonb_build_object('count', v_count, 'last_date', v_last, 'grew', false);
  end if;
  v_new := case when v_last = (v_today - 1)::text and v_count > 0 then v_count + 1 else 1 end;
  update public.user_streak set count = v_new, last_date = v_today::text where user_id = uid;
  return jsonb_build_object('count', v_new, 'last_date', v_today::text, 'grew', true);
end $$;

-- 5) Misiunile zilei: sumele sunt pe server, o singură dată pe zi pentru fiecare, doar pentru elevi.
create or replace function public.claim_mission(p_key text, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  v_role text;
  v_reward integer;
  v_today date := (now() at time zone 'Europe/Chisinau')::date;
  v_total integer;
begin
  if uid is null then raise exception 'not allowed' using errcode = '42501'; end if;
  select role into v_role from public.user_profiles where user_id = uid;
  select total_xp into v_total from public.training_stats where user_id = uid;
  v_total := coalesce(v_total, 0);
  if v_role is distinct from 'elev' then
    return jsonb_build_object('ok', false, 'reason', 'role', 'total', v_total);
  end if;
  v_reward := case p_key when 'lesson_1_today' then 10 when 'lesson_3_today' then 30 when 'solve_5_today' then 20 when 'solve_10_today' then 40 else null end;
  if v_reward is null then raise exception 'unknown mission'; end if;
  if p_day is null or abs(p_day - v_today) > 1 then raise exception 'bad day'; end if;
  begin
    insert into public.user_daily_mission_claims (user_id, day, mission_key, xp_awarded) values (uid, p_day, p_key, v_reward);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already', 'total', v_total);
  end;
  insert into public.xp_events (user_id, amount, source, ref) values (uid, v_reward, 'misiune', p_day::text || ':' || p_key);
  insert into public.training_stats (user_id, total_xp, best_streak, updated_at) values (uid, v_reward, 0, now())
  on conflict (user_id) do update set total_xp = public.training_stats.total_xp + v_reward, updated_at = now()
  returning total_xp into v_total;
  return jsonb_build_object('ok', true, 'xp', v_reward, 'total', v_total);
end $$;

-- 6) Drepturi: funcțiile doar pentru conturi conectate, tabelele doar de citit.
revoke all on function public.award_xp(integer, text, text) from public, anon;
revoke all on function public.report_best_streak(integer) from public, anon;
revoke all on function public.bump_streak() from public, anon;
revoke all on function public.claim_mission(text, date) from public, anon;
grant execute on function public.award_xp(integer, text, text) to authenticated;
grant execute on function public.report_best_streak(integer) to authenticated;
grant execute on function public.bump_streak() to authenticated;
grant execute on function public.claim_mission(text, date) to authenticated;

revoke insert, update, delete, truncate on table public.training_stats, public.user_streak, public.user_daily_mission_claims from authenticated, anon;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('training_stats','user_streak','user_daily_mission_claims') and cmd in ('INSERT','UPDATE','DELETE','ALL')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Verificare (trebuie să dea 0 rânduri): cine mai poate scrie direct în cele trei tabele, și cine din afară poate chema funcțiile.
--   select grantee, table_name, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name in ('training_stats','user_streak','user_daily_mission_claims')
--     and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in ('award_xp','report_best_streak','bump_streak','claim_mission') and has_function_privilege('anon', p.oid, 'execute');
