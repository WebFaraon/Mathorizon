-- ============================================================
-- Fix: display_name/avatar_url on user_profiles were never actually
-- getting backfilled, so the Capitole leaderboard (get_xp_leaderboard)
-- has been showing 'Elev Mathorizon' for every real student instead of
-- their real name.
--
-- js/auth.js's _syncUserProfile() has, since 20260919090000, tried to keep
-- these fresh with a raw PostgREST PATCH on every sign-in:
--   PATCH user_profiles?user_id=eq.<uid>  { display_name, avatar_url }
-- That PATCH is fire-and-forget (.catch(() => {})) — and it has been
-- silently failing for every account checked, every time, since the
-- column was added: user_profiles has never had a self-service UPDATE
-- policy, only SELECT/INSERT (the row is created once at signup and
-- historically never touched again from the client). No UPDATE policy
-- means RLS rejects the PATCH outright, the .catch() swallows it, and
-- display_name/avatar_url stay NULL forever — which is exactly what a
-- direct read of user_profiles for three known test accounts confirmed.
--
-- Adding a blanket "update own row" policy would be worse: user_profiles
-- also carries role/status/plan, and a client-writable UPDATE on the
-- whole row would let a signed-in user PATCH their own role to 'admin'.
-- So this follows the same shape the leaderboard itself already uses
-- (get_xp_leaderboard, security definer) — a narrow RPC that can only
-- ever touch display_name/avatar_url for auth.uid()'s own row, called
-- instead of the raw PATCH from now on (see js/auth.js).
-- ============================================================

create function public.sync_own_profile_identity(p_display_name text, p_avatar_url text)
returns void
security definer set search_path = public
language plpgsql as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.user_profiles
     set display_name = p_display_name,
         avatar_url   = p_avatar_url
   where user_id = auth.uid();
end;
$$;

revoke execute on function public.sync_own_profile_identity(text, text) from public;
grant execute on function public.sync_own_profile_identity(text, text) to authenticated;

-- One-time backfill for every row the broken PATCH never reached — same
-- full_name → name → email-prefix precedence js/auth.js's _displayName()
-- already computes client-side, just run once here from the auth.users
-- data a security-definer/migration context can read directly.
update public.user_profiles up
   set display_name = coalesce(
         up.display_name,
         au.raw_user_meta_data ->> 'full_name',
         au.raw_user_meta_data ->> 'name',
         split_part(au.email, '@', 1)
       ),
       avatar_url = coalesce(
         up.avatar_url,
         au.raw_user_meta_data ->> 'custom_avatar_url',
         au.raw_user_meta_data ->> 'avatar_url'
       )
  from auth.users au
 where au.id = up.user_id
   and up.display_name is null;
