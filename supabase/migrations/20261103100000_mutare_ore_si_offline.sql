-- Mutarea orei, lectia in plus si anularea merg si la grupele OFFLINE (2026-11-03).
--
-- Fata de 20261102100000_mutare_ore_lectii.sql: functiile class_lesson_set si class_upcoming_lessons nu mai cer ca grupa sa fie online.
-- Sala Meet ramane doar pentru grupele online (class_meet_at nu se schimba).
-- Atentie: la o lectie fata in fata platforma NU verifica daca cabinetul e liber la noua ora (lectia ramane in acelasi cabinet).
-- Se ruleaza dupa 20261102100000_mutare_ore_lectii.sql.

create or replace function public.class_lesson_set(p_class uuid, p_kind text, p_orig date, p_new_start timestamp, p_hours int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.classes;
  g public.reg_groups;
  v_now timestamp := now() at time zone 'Europe/Chisinau';
  old public.class_lesson_changes;
  v_rst timestamp;                  -- inceputul lectiei din program (moved / cancelled)
  v_rn int;                         -- durata ei
  v_cur timestamp;
  v_hours int;
  v_id uuid;
  v_fmt constant text := 'YYYY-MM-DD"T"HH24:MI';
begin
  select * into c from public.classes where id = p_class;
  if not found then raise exception 'not found'; end if;
  if not (c.teacher_id = auth.uid() or public.reg_is_staff()) then raise exception 'not allowed'; end if;
  if p_kind not in ('moved', 'extra', 'cancelled') then raise exception 'bad kind'; end if;

  select * into g from public.reg_groups where id = c.reg_group_id;
  if not found then raise exception 'no group'; end if;

  if p_kind in ('moved', 'cancelled') then
    if p_orig is null then raise exception 'date required'; end if;
    select * into old from public.class_lesson_changes where class_id = p_class and orig_date = p_orig and kind in ('moved', 'cancelled');
    -- lectia din program din ziua aceea (exceptiile nu conteaza aici)
    select p_orig + make_interval(hours => min((e->>'hour')::int)), count(*)::int into v_rst, v_rn
      from jsonb_array_elements(coalesce(g.schedule, '[]'::jsonb)) e
     where (e->>'day') ~ '^[1-7]$' and (e->>'hour') ~ '^[0-9]{1,2}$' and (e->>'day')::int = extract(isodow from p_orig)::int;
    if v_rst is null then raise exception 'no lesson that day'; end if;
    -- lectia care se schimba acum: cea deja mutata, daca exista, altfel cea din program
    v_cur := case when old.kind = 'moved' then old.new_start else v_rst end;
    if v_cur < v_now + interval '1 hour' then raise exception 'too late'; end if;
    if old.id is not null then delete from public.class_lesson_changes where id = old.id; end if;
  end if;

  if p_kind in ('moved', 'extra') then
    if p_new_start is null then raise exception 'time required'; end if;
    if p_new_start < v_now + interval '1 hour' then raise exception 'too soon'; end if;
    if p_new_start > v_now + interval '90 days' then raise exception 'too far'; end if;
  end if;

  v_hours := case when p_kind = 'cancelled' then v_rn else coalesce(p_hours, v_rn, 1) end;
  if v_hours is null or v_hours < 1 or v_hours > 3 then raise exception 'bad hours'; end if;

  insert into public.class_lesson_changes (class_id, kind, orig_date, orig_start, orig_hours, new_start, hours, created_by)
  values (
    p_class, p_kind,
    case when p_kind = 'extra' then null else p_orig end,
    case when p_kind = 'extra' then null else v_rst end,
    case when p_kind = 'extra' then null else v_rn end,
    case when p_kind = 'cancelled' then null else p_new_start end,
    v_hours, auth.uid()
  ) returning id into v_id;

  -- nu are voie sa se suprapuna cu alta lectie a grupei (cele anulate nu conteaza)
  if p_kind <> 'cancelled' and exists (
    select 1 from public.class_lessons(p_class, p_new_start - interval '1 day', p_new_start + interval '2 days') l
    where l.l_kind <> 'cancelled' and l.l_change is distinct from v_id
      and l.l_start < p_new_start + make_interval(hours => v_hours)
      and l.l_start + make_interval(hours => l.l_hours) > p_new_start
  ) then raise exception 'overlap'; end if;

  return jsonb_build_object(
    'id', v_id, 'kind', p_kind, 'hours', v_hours,
    'orig_start', to_char(v_rst, v_fmt), 'new_start', to_char(p_new_start, v_fmt)
  );
end $$;

create or replace function public.class_upcoming_lessons(p_class uuid, p_days int default 21)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.classes;
  g public.reg_groups;
  v_now timestamp := now() at time zone 'Europe/Chisinau';
  v_fmt constant text := 'YYYY-MM-DD"T"HH24:MI';
begin
  select * into c from public.classes where id = p_class;
  if not found then return '[]'::jsonb; end if;
  if not (c.teacher_id = auth.uid() or public.reg_is_staff()
          or exists (select 1 from public.class_members m where m.class_id = p_class and m.student_id = auth.uid() and m.status = 'activ')) then
    return '[]'::jsonb;
  end if;
  select * into g from public.reg_groups where id = c.reg_group_id;
  if not found then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'start', to_char(l_start, v_fmt),
      'end', to_char(l_start + make_interval(hours => l_hours), v_fmt),
      'hours', l_hours, 'kind', l_kind, 'change', l_change,
      'orig_date', l_orig_date, 'orig_start', to_char(l_orig_start, v_fmt)
    ) order by l_start)
    from public.class_lessons(p_class, v_now - interval '3 hours', v_now + make_interval(days => least(greatest(coalesce(p_days, 21), 1), 90)))
  ), '[]'::jsonb);
end $$;

-- drepturile raman cele din migrarea de baza (create or replace le pastreaza), dar le punem la loc pentru siguranta
revoke all on function public.class_lesson_set(uuid, text, date, timestamp, int) from public, anon;
revoke all on function public.class_upcoming_lessons(uuid, int) from public, anon;
grant execute on function public.class_lesson_set(uuid, text, date, timestamp, int) to authenticated;
grant execute on function public.class_upcoming_lessons(uuid, int) to authenticated;
