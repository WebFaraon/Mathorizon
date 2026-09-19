-- ============================================================
-- XP leaderboard — show every student, not just the top 10 with XP > 0.
--
-- The original get_xp_leaderboard (20260919090100) started the query from
-- training_stats and required total_xp > 0, so a student who never opened
-- Antrenament (no training_stats row at all — that table only gets a row
-- on a student's first XP-earning action, see 20260807090100) was invisible
-- rather than showing at rank N with 0 XP. Per direct feedback ("toti
-- elevii prezenti care sunt pe platforma"), the leaderboard should list
-- every elev account, ranked, XP or not.
--
-- Flips the join direction: start from user_profiles (role='elev', the
-- same restriction as before so a teacher/admin test account never shows
-- up) and LEFT JOIN training_stats, coalescing to 0 for anyone without a
-- row. Default limit raised from 10 to 500 — comfortably above the current
-- ~25 student accounts, with a cap kept (not removed outright) as a sane
-- ceiling rather than a truly unbounded query.
-- ============================================================

create or replace function public.get_xp_leaderboard(p_limit integer default 500)
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
      up.user_id,
      coalesce(up.display_name, 'Elev Mathorizon') as display_name,
      coalesce(ts.total_xp, 0) as total_xp,
      coalesce(ts.best_streak, 0) as best_streak,
      row_number() over (
        order by coalesce(ts.total_xp, 0) desc,
                 coalesce(ts.best_streak, 0) desc,
                 coalesce(up.display_name, 'Elev Mathorizon') asc
      )::integer as rank
    from public.user_profiles up
    left join public.training_stats ts on ts.user_id = up.user_id
    where up.role = 'elev'
    order by coalesce(ts.total_xp, 0) desc,
             coalesce(ts.best_streak, 0) desc,
             coalesce(up.display_name, 'Elev Mathorizon') asc
    limit greatest(p_limit, 0);
end;
$$;

revoke execute on function public.get_xp_leaderboard(integer) from public;
grant execute on function public.get_xp_leaderboard(integer) to authenticated;
