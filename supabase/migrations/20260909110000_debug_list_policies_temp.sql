-- TEMPORARY — introspection helper only, dropped by the very next
-- migration once used. Lets us read pg_policies for a table via the REST
-- API (service role), since pre-migrations-folder policies on tables like
-- class_posts have no other record of their exact shape anywhere in this
-- repo (see 20260906120000/20260909090000 for the same caveat).
create or replace function public._debug_list_policies(p_table text)
returns table(policyname text, cmd text, qual text, with_check text)
language sql
security definer
set search_path = public
as $$
  select policyname, cmd, qual::text, with_check::text
  from pg_policies
  where schemaname = 'public' and tablename = p_table;
$$;
