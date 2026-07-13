-- TEMPORARY diagnostic function — will be dropped once the "3.14 -> null"
-- and "\dfrac{1}{\sqrt{2}} vs 0.7071067812" bugs are found. Mirrors
-- _sim_eval_expr step by step but returns the intermediate string at each
-- stage instead of the final numeric, so we can see exactly where it
-- diverges without guessing.
create or replace function public._sim_eval_debug(raw text) returns jsonb
language plpgsql immutable as $$
declare
  v text;
  stripped text;
  steps jsonb := '[]'::jsonb;
  result numeric;
  err text;
begin
  v := coalesce(raw, '');
  steps := steps || jsonb_build_object('step', 'start', 'v', v);

  v := regexp_replace(v, '(\d)\{,\}(\d)', '\1.\2', 'g');
  steps := steps || jsonb_build_object('step', 'brace_comma', 'v', v);

  v := regexp_replace(v, '^\s*=\s*', '');
  v := replace(v, '\left', '');
  v := replace(v, '\right', '');
  v := regexp_replace(v, '\\[,;:!]', '', 'g');
  steps := steps || jsonb_build_object('step', 'latex_misc', 'v', v);

  v := public._sim_strip_frac(v);
  steps := steps || jsonb_build_object('step', 'strip_frac', 'v', v);
  v := public._sim_strip_sqrt(v);
  steps := steps || jsonb_build_object('step', 'strip_sqrt', 'v', v);
  v := replace(v, '\sqrt', 'sqrt');
  v := public._sim_strip_exp_braces(v);
  steps := steps || jsonb_build_object('step', 'strip_exp_braces', 'v', v);
  v := replace(v, '\cdot', '*');
  v := replace(v, '\times', '*');
  v := replace(v, '\pi', 'pi()');
  steps := steps || jsonb_build_object('step', 'latex_ops', 'v', v);

  if v ~ '\\' then
    steps := steps || jsonb_build_object('step', 'BAIL_backslash', 'v', v);
    return steps;
  end if;
  if v ~ '[{}\[\]=]' then
    steps := steps || jsonb_build_object('step', 'BAIL_brackets', 'v', v);
    return steps;
  end if;

  v := replace(v, '×', '*');
  v := replace(v, '·', '*');
  v := replace(v, '÷', '/');
  v := replace(v, '−', '-');
  v := replace(v, 'π', 'pi()');
  v := public._sim_strip_superscript(v);
  steps := steps || jsonb_build_object('step', 'unicode_ops', 'v', v);

  v := regexp_replace(v, '\s+', '', 'g');
  v := regexp_replace(v, '(\d),(\d)', '\1.\2', 'g');
  steps := steps || jsonb_build_object('step', 'whitespace_comma', 'v', v);
  if position(',' in v) > 0 then
    steps := steps || jsonb_build_object('step', 'BAIL_comma', 'v', v);
    return steps;
  end if;
  v := lower(v);
  if v = '' then
    steps := steps || jsonb_build_object('step', 'BAIL_empty', 'v', v);
    return steps;
  end if;

  stripped := replace(replace(v, 'sqrt', ''), 'pi', '');
  steps := steps || jsonb_build_object('step', 'stripped_check', 'v', v, 'stripped', stripped, 'has_letters', (stripped ~ '[a-z]'));
  if stripped ~ '[a-z]' then
    steps := steps || jsonb_build_object('step', 'BAIL_letters', 'v', v);
    return steps;
  end if;
  steps := steps || jsonb_build_object('step', 'whitelist_check', 'v', v, 'whitelist_pass', (v ~ '^[0-9a-z.+*/^()-]*$'));
  if v !~ '^[0-9a-z.+*/^()-]*$' then
    steps := steps || jsonb_build_object('step', 'BAIL_whitelist', 'v', v);
    return steps;
  end if;

  v := regexp_replace(v, '([0-9)])(\()', '\1*\2', 'g');
  v := regexp_replace(v, '(\))([0-9])', '\1*\2', 'g');
  v := regexp_replace(v, '([0-9])(sqrt|pi)', '\1*\2', 'g');
  v := regexp_replace(v, '(\))(sqrt|pi)', '\1*\2', 'g');
  steps := steps || jsonb_build_object('step', 'implicit_mult', 'v', v);

  v := regexp_replace(v, '(?<!\.)(\d+)(?!\.\d)', '\1.0', 'g');
  steps := steps || jsonb_build_object('step', 'promote_numeric', 'v', v);

  begin
    execute format('select (%s)::numeric', v) into result;
    steps := steps || jsonb_build_object('step', 'final_result', 'v', v, 'result', result);
  exception when others then
    get stacked diagnostics err = message_text;
    steps := steps || jsonb_build_object('step', 'EXEC_ERROR', 'v', v, 'error', err);
  end;

  return steps;
end $$;
