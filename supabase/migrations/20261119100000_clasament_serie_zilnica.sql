-- Clasament: seria zilnica (zile la rand) a fiecarui elev, ca sa se vada in podium si in lista.
-- Pana acum clasamentul avea doar "best_streak" (cea mai lunga serie de raspunsuri corecte la
-- Antrenament), care nu e seria zilnica din rand. Seria zilnica sta in user_streak (owner-only),
-- de aceea o citeste functia security definer.
-- Se ruleaza dupa 20261113100000. Fara ea clasamentul merge ca pana acum, doar fara seria.

drop function if exists public.get_xp_leaderboard(integer);

create function public.get_xp_leaderboard(p_limit integer default 500)
returns table(
  user_id      uuid,
  display_name text,
  avatar_url   text,
  total_xp     integer,
  best_streak  integer,
  rank         integer,
  nickname     text,
  streak       integer
)
security definer set search_path = public
language plpgsql as $$
declare
  v_today date := (now() at time zone 'Europe/Chisinau')::date;
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
      up.nickname,
      -- seria e vie doar daca ultima zi e azi sau ieri (la fel ca getStreak() din site)
      case when us.last_date::date >= v_today - 1 then coalesce(us.count, 0) else 0 end::integer as streak
    from public.user_profiles up
    left join public.training_stats ts on ts.user_id = up.user_id
    left join public.user_streak us on us.user_id = up.user_id
    where up.role = 'elev'
    order by coalesce(ts.total_xp, 0) desc,
             coalesce(ts.best_streak, 0) desc,
             coalesce(up.nickname, up.display_name, 'Elev Teorema') asc
    limit greatest(p_limit, 0);
end;
$$;

-- DROP + CREATE reda EXECUTE catre anon: se retrage din nou
revoke execute on function public.get_xp_leaderboard(integer) from public, anon;
grant execute on function public.get_xp_leaderboard(integer) to authenticated;

-- ------------------------------------------------------------
-- Verificare dupa rulare: trebuie sa returneze ZERO randuri
--
-- select p.proname
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname = 'get_xp_leaderboard'
--   and has_function_privilege('anon', p.oid, 'execute');
-- ------------------------------------------------------------
