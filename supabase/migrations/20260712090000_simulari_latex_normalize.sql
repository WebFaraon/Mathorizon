-- ============================================================
-- Defense-in-depth companion to the client-side BM.latexToPlain()
-- conversion (js/utils.js) now run when a teacher picks/scans an
-- exercise. Grading still compares literal text, so if a raw-LaTeX
-- correct_answer (e.g. "\frac{3}{2}", "\sqrt{5}") ever slips through
-- review, a student's plain-text answer ("3/2", "√5") would never
-- match. Give _sim_normalize the same common-case LaTeX-to-plain
-- conversions so grading is lenient even when the stored answer key
-- wasn't cleaned up.
-- ============================================================

create or replace function public._sim_normalize(raw text) returns text
language plpgsql immutable as $$
declare v text;
begin
  v := coalesce(trim(raw), '');
  v := regexp_replace(v, '^=\s*', '');

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
