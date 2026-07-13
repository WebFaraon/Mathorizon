-- ============================================================
-- Real mathematical grading for simulation answers.
--
-- _sim_answers_match() has always been very limited: _sim_try_number()
-- only recognizes a bare integer/decimal ("25") or a single simple
-- fraction ("3/4") — anything else (radicals, exponents, parentheses,
-- multi-term sums like "37+20√3") falls straight to exact (case-
-- insensitive) STRING comparison. That was fine while the answer
-- keyboard only offered basic symbols, but the new keypad (√, xⁿ/^,
-- and a superscript "power mode") makes it trivial for a student to
-- type a mathematically-correct answer that will never string-match
-- whatever the teacher happened to type as the expected answer.
--
-- _sim_eval_expr() replaces that narrow check: it normalizes LaTeX
-- (\frac, \sqrt, ^{...}, \pi, \cdot/\times, decimal comma, Unicode
-- superscript digits from the new keypad toggle), inserts the '*' an
-- implicit multiplication like "20sqrt(3)" needs, and — once the
-- string has been reduced to STRICTLY digits/operators/parens/./sqrt/pi
-- and nothing else — hands it to Postgres's own expression evaluator
-- via dynamic SQL to get the numeric value. The strict whitelist runs
-- *before* the dynamic SQL executes: anything that doesn't fit that
-- narrow character set (sets, intervals, systems, prose, or literally
-- anything else) returns NULL here and _sim_answers_match() falls back
-- to the old numeric/fraction check and then to the string comparison,
-- exactly as before — nothing that used to work stops working.
-- ============================================================

create or replace function public._sim_brace_close(s text, open_idx int) returns int
language plpgsql immutable as $$
declare
  depth int := 1;
  i int;
  len int;
  ch text;
begin
  len := length(s);
  i := open_idx + 1;
  while i <= len loop
    ch := substr(s, i, 1);
    if ch = '{' then
      depth := depth + 1;
    elsif ch = '}' then
      depth := depth - 1;
      if depth = 0 then
        return i;
      end if;
    end if;
    i := i + 1;
  end loop;
  return -1;
end $$;

-- Replaces every \frac{a}{b} / \dfrac{a}{b} / \tfrac{a}{b} with (a)/(b),
-- brace-aware so nested fractions/roots inside a/b are handled — always
-- resolves the leftmost occurrence; any nested command still inside the
-- extracted (a)/(b) gets caught by the next loop iteration.
create or replace function public._sim_strip_frac(s0 text) returns text
language plpgsql immutable as $$
declare
  s text := s0;
  cmd_start int;
  open_brace int;
  num_close int;
  den_close int;
  after_idx int;
  num_content text;
  den_content text;
  replacement text;
  guard int := 0;
begin
  s := replace(s, '\dfrac{', '\frac{');
  s := replace(s, '\tfrac{', '\frac{');
  loop
    guard := guard + 1;
    exit when guard > 30;
    cmd_start := position('\frac{' in s);
    exit when cmd_start = 0;
    open_brace := cmd_start + length('\frac{') - 1;
    num_close := public._sim_brace_close(s, open_brace);
    exit when num_close = -1;
    num_content := substr(s, open_brace + 1, num_close - open_brace - 1);
    den_content := '';
    after_idx := num_close + 1;
    if substr(s, after_idx, 1) = '{' then
      den_close := public._sim_brace_close(s, after_idx);
      exit when den_close = -1;
      den_content := substr(s, after_idx + 1, den_close - after_idx - 1);
      after_idx := den_close + 1;
    end if;
    if den_content <> '' then
      replacement := '(' || num_content || ')/(' || den_content || ')';
    else
      replacement := num_content;
    end if;
    s := substr(s, 1, cmd_start - 1) || replacement || substr(s, after_idx);
  end loop;
  return s;
end $$;

create or replace function public._sim_strip_sqrt(s0 text) returns text
language plpgsql immutable as $$
declare
  s text := s0;
  cmd_start int;
  open_brace int;
  close_idx int;
  content text;
  guard int := 0;
begin
  loop
    guard := guard + 1;
    exit when guard > 30;
    cmd_start := position('\sqrt{' in s);
    exit when cmd_start = 0;
    open_brace := cmd_start + length('\sqrt{') - 1;
    close_idx := public._sim_brace_close(s, open_brace);
    exit when close_idx = -1;
    content := substr(s, open_brace + 1, close_idx - open_brace - 1);
    s := substr(s, 1, cmd_start - 1) || 'sqrt(' || content || ')' || substr(s, close_idx + 1);
  end loop;
  return s;
end $$;

create or replace function public._sim_strip_exp_braces(s0 text) returns text
language plpgsql immutable as $$
declare
  s text := s0;
  cmd_start int;
  close_idx int;
  content text;
  guard int := 0;
begin
  loop
    guard := guard + 1;
    exit when guard > 30;
    cmd_start := position('^{' in s);
    exit when cmd_start = 0;
    close_idx := public._sim_brace_close(s, cmd_start + 1);
    exit when close_idx = -1;
    content := substr(s, cmd_start + 2, close_idx - cmd_start - 2);
    s := substr(s, 1, cmd_start - 1) || '^(' || content || ')' || substr(s, close_idx + 1);
  end loop;
  return s;
end $$;

-- Converts a run of Unicode superscript digits/minus (what the new keypad's
-- "power mode" toggle inserts, e.g. "5²" or "5⁻²") into "^(...)" notation.
create or replace function public._sim_strip_superscript(s0 text) returns text
language plpgsql immutable as $$
declare
  s text := s0;
  i int := 1;
  len int;
  ch text;
  result text := '';
  run text := '';
  map jsonb := '{"⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9","⁻":"-"}'::jsonb;
begin
  len := length(s);
  while i <= len loop
    ch := substr(s, i, 1);
    if map ? ch then
      run := run || (map ->> ch);
    else
      if run <> '' then
        result := result || '^(' || run || ')';
        run := '';
      end if;
      result := result || ch;
    end if;
    i := i + 1;
  end loop;
  if run <> '' then
    result := result || '^(' || run || ')';
  end if;
  return result;
end $$;

-- The real evaluator: normalizes, strictly whitelists, then delegates the
-- actual arithmetic to Postgres's own expression evaluator (which already
-- understands +,-,*,/,^,(),sqrt(),pi() correctly, including precedence and
-- unary minus) via dynamic SQL — only ever reached once `v` has been
-- reduced to nothing but digits/operators/parens/./sqrt/pi, so there is no
-- injection surface: no quotes, semicolons, or arbitrary identifiers can
-- ever reach the EXECUTE.
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
  v := replace(v, '\pi', 'pi');

  if v ~ '\\' then return null; end if;
  if v ~ '[{}\[\]=]' then return null; end if;

  v := replace(v, '×', '*');
  v := replace(v, '·', '*');
  v := replace(v, '÷', '/');
  v := replace(v, '−', '-');
  v := replace(v, 'π', 'pi');
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
  v := regexp_replace(v, '(pi)([0-9(])', '\1*\2', 'g');

  begin
    execute format('select (%s)::numeric', v) into result;
  exception when others then
    return null;
  end;

  return result;
end $$;

revoke execute on function public._sim_eval_expr(text) from public;
revoke execute on function public._sim_eval_expr(text) from anon;

create or replace function public._sim_answers_match(a text, b text) returns boolean
language plpgsql immutable as $$
declare na numeric; nb numeric;
begin
  na := public._sim_eval_expr(a);
  nb := public._sim_eval_expr(b);
  if na is not null and nb is not null then
    return abs(na - nb) < 1e-6 * greatest(1, abs(nb));
  end if;

  na := public._sim_try_number(a);
  nb := public._sim_try_number(b);
  if na is not null and nb is not null then
    return abs(na - nb) < 0.0000001;
  end if;

  return public._sim_normalize(a) = public._sim_normalize(b);
end $$;
