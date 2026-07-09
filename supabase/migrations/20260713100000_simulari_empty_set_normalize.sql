-- ============================================================
-- Found during an edge-case review: _sim_normalize's final cleanup
-- step strips ALL remaining curly braces unconditionally
-- (`regexp_replace(v, '[{}]', '', 'g')`), so a correct_answer of
-- literally "{}" (a very natural way for a teacher to write the
-- empty-set answer to e.g. an irrational/logarithmic equation with
-- no valid solution) normalizes down to an EMPTY STRING — which is
-- exactly what a student's completely blank, unanswered input also
-- normalizes to. Result: for any item whose correct answer was
-- written as "{}", a student who leaves the field blank (or types
-- only whitespace) would be graded as CORRECT.
--
-- Fix: recognize an all-whitespace pair of braces as the empty set
-- and map it to the same canonical "∅" the \emptyset/\varnothing
-- LaTeX commands already normalize to, before the generic brace
-- stripping ever runs — so "{}" and "∅" now correctly match each
-- other too, instead of "{}" silently collapsing into "no answer".
-- ============================================================

create or replace function public._sim_normalize(raw text) returns text
language plpgsql immutable as $$
declare v text;
begin
  v := coalesce(trim(raw), '');
  v := regexp_replace(v, '^=\s*', '');

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
