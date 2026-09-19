-- ============================================================
-- Fix: get_xp_leaderboard became callable by anon (unauthenticated).
--
-- The previous migration had to DROP + CREATE get_xp_leaderboard (adding
-- avatar_url changed its RETURNS TABLE shape, which CREATE OR REPLACE
-- can't do). A fresh CREATE FUNCTION re-triggers this project's default
-- privileges, which grant EXECUTE directly to anon/authenticated on every
-- new function — a direct grant to anon, not one inherited from PUBLIC,
-- so the existing "revoke ... from public" in that same migration did not
-- remove it. Every previous migration only ever used CREATE OR REPLACE on
-- an already-authenticated-only function, so this default-privilege
-- re-grant never fired before now.
--
-- Net effect for the short window since the previous migration: anyone,
-- without logging in, could call get_xp_leaderboard() and read every
-- student's display name, avatar URL, XP and streak. Revoking anon here.
-- ============================================================

revoke execute on function public.get_xp_leaderboard(integer) from anon;
