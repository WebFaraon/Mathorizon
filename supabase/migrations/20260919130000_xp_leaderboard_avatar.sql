-- ============================================================
-- XP leaderboard — surface the student's real avatar too.
--
-- Same reasoning as display_name (20260919090000): the actual value
-- (user_metadata.avatar_url / custom_avatar_url, read client-side by
-- js/auth.js's _avatarUrl()) lives on auth.users, which get_xp_leaderboard
-- deliberately never touches (see 20260919090100's own comment — "no
-- email, no auth.users touch"). So it gets copied into user_profiles by
-- the same client-side sync that already copies display_name, and
-- get_xp_leaderboard reads the copy.
-- ============================================================

alter table public.user_profiles add column if not exists avatar_url text;

-- CREATE OR REPLACE can't change a RETURNS TABLE column list (adding
-- avatar_url counts as a different shape), so the old signature has to be
-- dropped first.
drop function if exists public.get_xp_leaderboard(integer);

create function public.get_xp_leaderboard(p_limit integer default 500)
returns table(
  user_id      uuid,
  display_name text,
  avatar_url   text,
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
      up.avatar_url,
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
