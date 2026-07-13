-- Extends _sim_strip_superscript to also understand the new ⁺ ⁽ ⁾
-- keypad "power mode" can now insert (js/simulare-exam.js's
-- SUPERSCRIPT_MAP), so a compound exponent like "2⁽³⁺¹⁾" grades as
-- 2^(3+1) = 16, not as an unrecognized symbol. Comma/√// have no
-- Unicode superscript form at all, so they never appear here — nothing
-- to add for those.
create or replace function public._sim_strip_superscript(s0 text) returns text
language plpgsql immutable as $$
declare
  s text := s0;
  i int := 1;
  len int;
  ch text;
  result text := '';
  run text := '';
  map jsonb := '{"⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9","⁻":"-","⁺":"+","⁽":"(","⁾":")"}'::jsonb;
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
