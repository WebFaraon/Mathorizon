-- ============================================================
-- A teacher's stored correct_answer for an equation item is often
-- literally "x=8" (lifted straight from a "\boxed{x=8}" solution),
-- while a student typing the numeric result on the Simulări keypad
-- naturally just enters "8". _sim_normalize already strips a bare
-- leading "=" (from the \boxed{= 4} fix), but "x=8" has no leading
-- "=" — it starts with the variable name — so it was left untouched
-- and never matched "8", grading a mathematically correct answer
-- as wrong.
--
-- Fix: also strip a single leading letter (the variable name) that
-- sits directly in front of the "=", so "x=8", "X = 8" and "=8" all
-- normalize down to "8" before comparison. _sim_try_number() already
-- calls _sim_normalize() first, so this also makes the numeric-
-- equivalence check (e.g. "x=8" vs "8.0") work for free.
-- ============================================================

create or replace function public._sim_normalize(raw text) returns text
language plpgsql immutable as $$
declare v text;
begin
  v := coalesce(trim(raw), '');
  v := regexp_replace(v, '^[a-zA-Z]?\s*=\s*', '');

  if v ~ '^\{\s*\}$' then
    v := '∅';
  end if;

  -- Common LaTeX remnants -> plain/Unicode, mirroring BM.latexToPlain.
  v := replace(v, '\left', '');
  v := replace(v, '\right', '');
  v := regexp_replace(v, '\\sqrt\[2\]\{([^{}]*)\}', '√\1', 'g');
  v := regexp_replace(v, '\\sqrt\[3\]\{([^{}]*)\}', '∛\1', 'g');
  v := regexp_replace(v, '\\sqrt\[4\]\{([^{}]*)\}', '∜\1', 'g');
  v := regexp_replace(v, '\\sqrt\{([^{}]*)\}', '√\1', 'g');
  v := regexp_replace(v, '\\frac\{([^{}]*)\}\{([^{}]*)\}', '\1/\2', 'g');
  v := regexp_replace(v, '\\frac\{([^{}]*)\}\{([^{}]*)\}', '\1/\2', 'g'); -- one more pass for a nested level

  v := replace(v, '\cdot', '·');
  v := replace(v, '\times', '×');
  v := replace(v, '\pm', '±');
  v := replace(v, '\mp', '∓');
  v := replace(v, '\pi', 'π');
  v := replace(v, '\infty', '∞');
  v := replace(v, '\neq', '≠');
  v := replace(v, '\leq', '≤');
  v := replace(v, '\geq', '≥');
  v := replace(v, '\le', '≤');
  v := replace(v, '\ge', '≥');
  v := replace(v, '\notin', '∉');
  v := replace(v, '\in', '∈');
  v := replace(v, '\subseteq', '⊆');
  v := replace(v, '\subset', '⊂');
  v := replace(v, '\cup', '∪');
  v := replace(v, '\cap', '∩');
  v := replace(v, '\emptyset', '∅');
  v := replace(v, '\varnothing', '∅');

  v := regexp_replace(v, '\^\{(-?\d+)\}', '\1', 'g'); -- superscript digits are left as plain digits server-side (no easy per-char unicode mapping in SQL)
  v := regexp_replace(v, '\\\{', chr(1), 'g');
  v := regexp_replace(v, '\\\}', chr(2), 'g');
  v := regexp_replace(v, '[{}]', '', 'g');
  v := replace(v, chr(1), '{');
  v := replace(v, chr(2), '}');

  v := regexp_replace(v, '\s+', ' ', 'g');
  if v ~ '^-?\d+,\d+$' then
    v := replace(v, ',', '.');
  end if;
  return lower(trim(v));
end $$;

-- One-time cleanup: strip the same "var=" prefix from already-stored
-- answer keys, so any simulation created before this fix (and not yet
-- finished by every student) grades correctly from now on without
-- needing to be rebuilt.
update public.simulation_answer_keys
set correct_answer = regexp_replace(correct_answer, '^[a-zA-Z]?\s*=\s*', '')
where correct_answer ~ '^[a-zA-Z]?\s*=\s*';
