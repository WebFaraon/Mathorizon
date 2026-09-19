-- ============================================================
-- XP leaderboard — "top elevi" for the Capitole sidebar.
--
-- training_stats has owner-only RLS (see 20260807090100_training_stats.sql
-- — "client PATCHes its own row"), so no client query can rank across
-- users directly. Same shape as get_all_student_plans()
-- (20260904090000_user_profiles_plan.sql): a security definer function
-- that reads across rows itself and hands back only the columns a
-- leaderboard needs — no email, no auth.users touch (display_name is
-- read from user_profiles, populated by js/auth.js — see the previous
-- migration).
--
-- All-time XP, not a weekly reset — training_stats.total_xp is lifetime
-- (matches what the profile page already shows), and there's no
-- week-bucketed XP tracking to rank by instead. Restricted to role='elev'
-- so a teacher/admin test account never displaces a real student's spot.
-- ============================================================

create or replace function public.get_xp_leaderboard(p_limit integer default 10)
returns table(
  user_id      uuid,
  display_name text,
  total_xp     integer,
  best_streak  integer,
  rank         integer
)
security definer set search_path = public
language plpgsql as $$
begin
  return query
    select
      ts.user_id,
      coalesce(up.display_name, 'Elev Mathorizon') as display_name,
      ts.total_xp,
      ts.best_streak,
      row_number() over (order by ts.total_xp desc, ts.best_streak desc)::integer as rank
    from public.training_stats ts
    join public.user_profiles up on up.user_id = ts.user_id
    where up.role = 'elev'
      and ts.total_xp > 0
    order by ts.total_xp desc, ts.best_streak desc
    limit greatest(p_limit, 0);
end;
$$;

revoke execute on function public.get_xp_leaderboard(integer) from public;
grant execute on function public.get_xp_leaderboard(integer) to authenticated;
