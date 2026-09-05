-- ============================================================
-- Structured recurring schedule for classes.
-- Until now the day(s)+time a class meets on lived only as free text
-- baked into classes.name ("Materie · Zi[/Zi2] · Oră" — see
-- js/classes-page.js buildGeneratedName). That's fine for display but
-- can't be queried/date-mathed, which the class Sumar tab's "next
-- lesson" widget needs. This adds real columns and backfills them by
-- parsing the existing name once; classes.name itself is left
-- completely untouched — it stays the display string, name and
-- schedule are independent from here on and the schedule is never
-- parsed from name again after this migration.
-- ============================================================

alter table public.classes add column if not exists schedule_days smallint[];
alter table public.classes add column if not exists schedule_time time;

-- ISO weekday numbering (1=Luni…7=Duminică, matching DAY_ORDER in
-- js/classes-page.js), max 2 days per the create form's own limit
-- ("Poți alege 2 zile" — js/classes-page.js:607). Both columns are
-- nullable and read with NULL treated as "no schedule set" everywhere
-- downstream, so existing rows and any future insert that omits them
-- keep working unchanged.
alter table public.classes add constraint classes_schedule_days_check
  check (
    schedule_days is null
    or (array_length(schedule_days, 1) between 1 and 2 and schedule_days <@ array[1,2,3,4,5,6,7]::smallint[])
  );

-- ── One-time backfill from classes.name ────────────────────────────
-- Parses "Materie · Zi[/Zi2] · Oră" back into the two new columns.
-- A row is only ever updated when BOTH the day(s) and the time parse
-- unambiguously — never partially — so any row left with both columns
-- still NULL after this block failed to parse and needs a manual look.
do $$
declare
  r record;
  v_parts text[];
  v_day_part text;
  v_time_part text;
  v_day_names text[];
  v_day_nums smallint[];
  v_day_num smallint;
  v_day_name text;
  v_ok boolean;
  v_success_count int := 0;
  v_fail_count int := 0;
begin
  for r in select id, name from public.classes where schedule_days is null and schedule_time is null loop
    v_parts := string_to_array(r.name, ' · ');
    v_ok := true;

    if array_length(v_parts, 1) is distinct from 3 then
      v_ok := false;
      raise notice 'SCHEDULE BACKFILL FAILED (class %): name "%" does not split into 3 " · "-separated parts', r.id, r.name;
    else
      v_day_part := v_parts[2];
      v_time_part := v_parts[3];

      if v_time_part !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
        v_ok := false;
        raise notice 'SCHEDULE BACKFILL FAILED (class %): time part "%" is not HH:MM', r.id, r.name;
      end if;

      v_day_names := string_to_array(v_day_part, '/');
      if array_length(v_day_names, 1) is null or array_length(v_day_names, 1) > 2 then
        v_ok := false;
        raise notice 'SCHEDULE BACKFILL FAILED (class %): day part "%" has 0 or more than 2 days', r.id, r.name;
      end if;

      if v_ok then
        v_day_nums := '{}';
        foreach v_day_name in array v_day_names loop
          v_day_num := case trim(v_day_name)
            when 'Luni' then 1
            when 'Marți' then 2
            when 'Miercuri' then 3
            when 'Joi' then 4
            when 'Vineri' then 5
            when 'Sâmbătă' then 6
            when 'Duminică' then 7
            else null
          end;
          if v_day_num is null then
            v_ok := false;
            raise notice 'SCHEDULE BACKFILL FAILED (class %): unrecognized day name "%" in "%"', r.id, v_day_name, r.name;
            exit;
          end if;
          v_day_nums := array_append(v_day_nums, v_day_num);
        end loop;
      end if;
    end if;

    if v_ok then
      update public.classes
        set schedule_days = (select array_agg(distinct d order by d) from unnest(v_day_nums) as d),
            schedule_time = v_time_part::time
        where id = r.id;
      v_success_count := v_success_count + 1;
    else
      v_fail_count := v_fail_count + 1;
    end if;
  end loop;

  raise notice 'SCHEDULE BACKFILL SUMMARY: % succeeded, % failed (left NULL for manual fix)', v_success_count, v_fail_count;
end $$;
