-- ============================================================
-- Some exercises in js/data.js write their boxed final answer as
-- "\boxed{= 4}" (equals sign included) while most write just
-- "\boxed{4}" — an inconsistency in the source content, not an
-- intentional rule. extractBoxedAnswer() copies whatever is
-- inside the braces verbatim, so a student answering "4" against
-- a stored correct_answer of "= 4" was wrongly marked incorrect
-- (neither the numeric parse nor the string compare in
-- _sim_normalize recognized "=" as noise).
--
-- Fix: always strip a leading "=" (plus any following whitespace)
-- before comparing, so "4" and "= 4" are always treated as the
-- same answer — regardless of which way the source exercise
-- happened to be written.
-- ============================================================

create or replace function public._sim_normalize(raw text) returns text
language plpgsql immutable as $$
declare v text;
begin
  v := coalesce(trim(raw), '');
  v := regexp_replace(v, '^=\s*', '');
  v := regexp_replace(v, '\s+', ' ', 'g');
  if v ~ '^-?\d+,\d+$' then
    v := replace(v, ',', '.');
  end if;
  return lower(v);
end $$;

-- One-time cleanup: strip "=" from already-stored answer keys too, so any
-- simulation created before this fix (and not yet finished by every
-- student) grades correctly from now on without needing to be rebuilt.
update public.simulation_answer_keys
set correct_answer = regexp_replace(correct_answer, '^=\s*', '')
where correct_answer ~ '^=\s*';
