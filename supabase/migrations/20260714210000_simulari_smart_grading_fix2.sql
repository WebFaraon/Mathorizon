-- ============================================================
-- Fix the "3.14 -> 3.14.0 -> syntax error -> null" bug found via the
-- debug function: Postgres's regex engine (ARE) does not actually
-- support lookbehind assertions the way PCRE/JS do — "(?<!\.)" silently
-- failed to constrain anything, so the "promote bare integers to decimal
-- literals" step also mangled numbers that already HAD a decimal point,
-- corrupting e.g. "3.14" into "3.14.0" (a syntax error, caught and
-- returned as null) and, as a direct consequence, breaking the match
-- test for "\dfrac{1}{\sqrt{2}}" vs "0.7071067812" too (the plain
-- decimal "0.7071067812" got the same corruption).
--
-- Replaced with a manual character scan (same technique as the brace-
-- matching helpers already in this file) that consumes a full number
-- token — integer part, and its decimal part too if one immediately
-- follows — and only appends ".0" when there was no decimal part to
-- begin with. No lookaround needed at all.
-- ============================================================

create or replace function public._sim_promote_numeric_literals(s0 text) returns text
language plpgsql immutable as $$
declare
  s text := s0;
  len int;
  i int := 1;
  ch text;
  result text := '';
  token text;
  has_decimal boolean;
begin
  len := length(s);
  while i <= len loop
    ch := substr(s, i, 1);
    if ch ~ '[0-9]' then
      token := '';
      while i <= len and substr(s, i, 1) ~ '[0-9]' loop
        token := token || substr(s, i, 1);
        i := i + 1;
      end loop;
      has_decimal := false;
      if i <= len and substr(s, i, 1) = '.' and i < len and substr(s, i + 1, 1) ~ '[0-9]' then
        has_decimal := true;
        token := token || '.';
        i := i + 1;
        while i <= len and substr(s, i, 1) ~ '[0-9]' loop
          token := token || substr(s, i, 1);
          i := i + 1;
        end loop;
      end if;
      if not has_decimal then
        token := token || '.0';
      end if;
      result := result || token;
    else
      result := result || ch;
      i := i + 1;
    end if;
  end loop;
  return result;
end $$;

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

  v := public._sim_promote_numeric_literals(v);

  begin
    execute format('select (%s)::numeric', v) into result;
  exception when others then
    return null;
  end;

  return result;
end $$;
