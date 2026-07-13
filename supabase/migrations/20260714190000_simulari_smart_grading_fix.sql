-- ============================================================
-- Fix two real bugs found by testing 20260714180000 directly against
-- Supabase before declaring it done:
--
-- 1. "\dfrac{3}{2}" evaluated to 1, not 1.5. Postgres performs INTEGER
--    division when both operands of "/" are bare integer literals
--    ("select 3/2" is 1, truncated) — _sim_strip_frac correctly produced
--    "(3)/(2)", but "3" and "2" are still untyped integer literals at
--    that point, so the division truncated before the final ::numeric
--    cast ever got a chance to matter (casting the RESULT doesn't
--    undo truncation that already happened inside the expression).
--    Fixed by promoting every standalone integer literal to an explicit
--    decimal literal ("3" -> "3.0") right before evaluating, so
--    Postgres types it `numeric` from the start. This is exactly why
--    "5⁻²" (0.04, correct) worked but "1/25" (came out as int-truncated
--    0, not 0.04) didn't in testing — the power operator ^ doesn't have
--    this int-truncation behavior, only "/" does.
--
-- 2. "2\pi" evaluated to null instead of ~6.283. \pi was mapped to the
--    bare word "pi", not the function call "pi()" — Postgres tried to
--    resolve "pi" as a column/variable reference (there isn't one),
--    errored, and the exception handler correctly returned null instead
--    of crashing, but the value was simply never computed. Fixed by
--    mapping to "pi()" instead of "pi", and dropping the now-redundant
--    (and, worse, newly-wrong) "(pi)(digit or paren)" implicit-
--    multiplication rule — since "pi()" already ends in a literal ")",
--    the existing "closing-paren followed by digit/paren" rules already
--    cover every case that rule was for; keeping it would have matched
--    "pi()"'s own opening paren and corrupted it into "pi*()".
-- ============================================================

create or replace function public._sim_eval_expr(raw text) returns numeric
language plpgsql immutable as $$
declare
  v text;
  stripped text;
  result numeric;
begin
  v := coalesce(raw, '');
  if trim(v) = '' then return null; end if;

  v := regexp_replace(v, '(\d)\{,\}(\d)', '\1.\2', 'g');
  v := regexp_replace(v, '^\s*=\s*', '');
  v := replace(v, '\left', '');
  v := replace(v, '\right', '');
  v := regexp_replace(v, '\\[,;:!]', '', 'g');

  v := public._sim_strip_frac(v);
  v := public._sim_strip_sqrt(v);
  v := replace(v, '\sqrt', 'sqrt');
  v := public._sim_strip_exp_braces(v);
  v := replace(v, '\cdot', '*');
  v := replace(v, '\times', '*');
  v := replace(v, '\pi', 'pi()');

  if v ~ '\\' then return null; end if;
  if v ~ '[{}\[\]=]' then return null; end if;

  v := replace(v, '×', '*');
  v := replace(v, '·', '*');
  v := replace(v, '÷', '/');
  v := replace(v, '−', '-');
  v := replace(v, 'π', 'pi()');
  v := public._sim_strip_superscript(v);

  v := regexp_replace(v, '\s+', '', 'g');
  v := regexp_replace(v, '(\d),(\d)', '\1.\2', 'g');
  if position(',' in v) > 0 then return null; end if;
  v := lower(v);
  if v = '' then return null; end if;

  stripped := replace(replace(v, 'sqrt', ''), 'pi', '');
  if stripped ~ '[a-z]' then return null; end if;
  if v !~ '^[0-9a-z.+*/^()-]*$' then return null; end if;

  v := regexp_replace(v, '([0-9)])(\()', '\1*\2', 'g');
  v := regexp_replace(v, '(\))([0-9])', '\1*\2', 'g');
  v := regexp_replace(v, '([0-9])(sqrt|pi)', '\1*\2', 'g');
  v := regexp_replace(v, '(\))(sqrt|pi)', '\1*\2', 'g');

  -- Force every standalone integer literal to a decimal literal so
  -- Postgres types it `numeric`, not `integer` — see note (1) above.
  -- Lookbehind/lookahead skip digit runs that are already part of an
  -- existing decimal (e.g. the "3" and "14" in "3.14" stay untouched).
  v := regexp_replace(v, '(?<!\.)(\d+)(?!\.\d)', '\1.0', 'g');

  begin
    execute format('select (%s)::numeric', v) into result;
  exception when others then
    return null;
  end;

  return result;
end $$;
