-- Mutarea orei unei lectii online, lectie in plus, lectie anulata (2026-11-02).
--
-- Programul de baza al grupei ramane in registru (Google Sheets, reg_groups.schedule). Aici se tin doar EXCEPTIILE, lectie cu lectie:
--   moved     o lectie din program trece la alta zi / ora (o singura data); in ziua veche fereastra Meet nu se mai deschide
--   extra     o lectie in plus (recuperare), peste cele din program
--   cancelled o lectie din program nu are loc in ziua aceea
-- Prezentele, tema si data lectiei se scriu tot doar in registru; platforma nu scrie nimic acolo.
--
-- Cine: profesorul grupei (si adminul / managerul), direct, fara aprobare. Doar grupele ONLINE.
-- Limite (decise cu fondatorul): doar in viitor, cu cel putin o ora inainte (si lectia de mutat/anulat trebuie sa inceapa peste cel putin o ora);
--   cel mult 90 de zile in fata; fara suprapunere cu alta lectie a grupei; lectia dureaza 1 pana la 3 ore.
-- Orele sunt ora de perete a Chisinaului (timestamp fara fus), ca in tot restul Meet-ului.
--
-- Fereastra Meet a elevului (class_meet_at) citeste acum lectiile prin class_lessons (program + exceptii), nu doar din program.

-- ---------- 1. tabelul exceptiilor ----------
create table if not exists public.class_lesson_changes (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  kind        text not null check (kind in ('moved', 'extra', 'cancelled')),
  orig_date   date,                       -- moved / cancelled: ziua lectiei din program
  orig_start  timestamp,                  -- moved / cancelled: ora ei de inceput
  orig_hours  int,                        -- moved / cancelled: cate ore avea in program
  new_start   timestamp,                  -- moved / extra: noul inceput; null la cancelled
  hours       int not null check (hours between 1 and 3),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint class_lesson_changes_shape check (
       (kind = 'extra'     and orig_date is null     and new_start is not null)
    or (kind = 'moved'     and orig_date is not null and orig_start is not null and new_start is not null)
    or (kind = 'cancelled' and orig_date is not null and orig_start is not null and new_start is null)
  )
);
create index if not exists class_lesson_changes_class_idx on public.class_lesson_changes (class_id);
-- o lectie din program are cel mult o exceptie (mutata sau anulata)
create unique index if not exists class_lesson_changes_one_per_day
  on public.class_lesson_changes (class_id, orig_date) where kind in ('moved', 'cancelled');

alter table public.class_lesson_changes enable row level security;
revoke all on table public.class_lesson_changes from anon, authenticated;
grant select on table public.class_lesson_changes to authenticated;

-- citesc: profesorul clasei, personalul (admin / manager activ), elevii activi ai clasei; scriu doar prin functiile de mai jos
drop policy if exists class_lesson_changes_read on public.class_lesson_changes;
create policy class_lesson_changes_read on public.class_lesson_changes for select to authenticated using (
     exists (select 1 from public.classes c where c.id = class_lesson_changes.class_id and c.teacher_id = auth.uid())
  or public.reg_is_staff()
  or exists (select 1 from public.class_members m where m.class_id = class_lesson_changes.class_id and m.student_id = auth.uid() and m.status = 'activ')
);

-- schimbarea apare la elevi fara reincarcare
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'class_lesson_changes') then
    alter publication supabase_realtime add table public.class_lesson_changes;
  end if;
end $$;

-- ---------- 2. lectiile unei clase: programul din registru + exceptiile ----------
-- Un rand pe lectie, intre doua momente. Kind: regular | moved | extra | cancelled.
-- start = unde se tine (sau, la cancelled, unde s-ar fi tinut); orig_* = lectia din program de care tine o mutare sau o anulare.
-- O lectie de doua ore are doua linii in program, in aceeasi zi (ca in 20261029100000): inceputul e cea mai mica ora, durata numarul de linii.
create or replace function public.class_lessons(p_class uuid, p_from timestamp, p_to timestamp)
returns table (l_start timestamp, l_hours int, l_kind text, l_change uuid, l_orig_date date, l_orig_start timestamp)
language sql stable security definer set search_path = public as $$
  with sch as (
    select coalesce(g.schedule, '[]'::jsonb) as s
    from public.classes c join public.reg_groups g on g.id = c.reg_group_id
    where c.id = p_class
  ),
  days as (select x::date as d from generate_series(p_from::date, p_to::date, interval '1 day') x),
  reg as (
    select dd.d, dd.d + make_interval(hours => min((e->>'hour')::int)) as st, count(*)::int as n
    from days dd cross join sch cross join lateral jsonb_array_elements(sch.s) e
    where (e->>'day') ~ '^[1-7]$' and (e->>'hour') ~ '^[0-9]{1,2}$' and (e->>'day')::int = extract(isodow from dd.d)::int
    group by dd.d
  )
  select r.st, r.n, 'regular'::text, null::uuid, r.d, r.st
    from reg r
   where r.st between p_from and p_to
     and not exists (select 1 from public.class_lesson_changes ch where ch.class_id = p_class and ch.orig_date = r.d and ch.kind in ('moved', 'cancelled'))
  union all
  select ch.new_start, ch.hours, 'moved'::text, ch.id, ch.orig_date, ch.orig_start
    from public.class_lesson_changes ch
   where ch.class_id = p_class and ch.kind = 'moved' and ch.new_start between p_from and p_to
  union all
  select ch.orig_start, ch.hours, 'cancelled'::text, ch.id, ch.orig_date, ch.orig_start
    from public.class_lesson_changes ch
   where ch.class_id = p_class and ch.kind = 'cancelled' and ch.orig_start between p_from and p_to
  union all
  select ch.new_start, ch.hours, 'extra'::text, ch.id, null::date, null::timestamp
    from public.class_lesson_changes ch
   where ch.class_id = p_class and ch.kind = 'extra' and ch.new_start between p_from and p_to;
$$;
revoke all on function public.class_lessons(uuid, timestamp, timestamp) from public, anon, authenticated;

-- ---------- 3. fereastra Meet tine cont de exceptii ----------
-- Neschimbat fata de 20261029110000_meet_doar_online.sql (elev activ, doar grupe online, 10 minute inainte pana cu 10 minute inainte de sfarsit),
-- in afara de lista lectiilor: acum vine din class_lessons. O lectie anulata nu deschide nimic; una mutata se deschide la noua ora.
create or replace function public.class_meet_at(p_class uuid, p_uid uuid, p_at timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c public.classes;
  g public.reg_groups;
  w public.reg_workbooks;
  v_url text;
  v_teacher boolean;
  v_now timestamp;
  v_open timestamp;
  v_close timestamp;
  v_next timestamp;
  r record;
  v_tz constant text := 'Europe/Chisinau';
begin
  select * into c from public.classes where id = p_class;
  if not found then return jsonb_build_object('status', 'denied'); end if;

  v_teacher := c.teacher_id = p_uid or exists (select 1 from public.user_profiles where user_id = p_uid and role = 'admin');
  if not v_teacher and not exists (select 1 from public.class_members where class_id = p_class and student_id = p_uid and status = 'activ') then
    return jsonb_build_object('status', 'denied');
  end if;

  if c.reg_group_id is null then return jsonb_build_object('status', 'offline'); end if;
  select * into g from public.reg_groups where id = c.reg_group_id;
  if not found then return jsonb_build_object('status', 'offline'); end if;

  -- doar grupele online au sala Meet
  if lower(coalesce(g.mode, '')) <> 'online' then return jsonb_build_object('status', 'offline'); end if;

  select * into w from public.reg_workbooks where id = g.workbook_id;

  v_url := w.teacher_data #>> '{meet,url}';
  if v_url is null then return jsonb_build_object('status', 'no_link', 'why', w.teacher_data #>> '{meet,why}'); end if;

  -- profesorul (si adminul) vad linkul oricand
  if v_teacher then return jsonb_build_object('status', 'open', 'url', v_url, 'teacher', true); end if;

  if lower(coalesce(g.state, '')) not in ('activ', 'se completează', 'se completeaza', 'startează', 'starteaza') then
    return jsonb_build_object('status', 'closed');
  end if;

  v_now := p_at at time zone v_tz;
  for r in
    select l_start, l_hours from public.class_lessons(p_class, v_now - interval '1 day', v_now + interval '8 days')
    where l_kind <> 'cancelled' order by l_start
  loop
    v_open := r.l_start - interval '10 minutes';
    v_close := r.l_start + make_interval(hours => r.l_hours) - interval '10 minutes';
    if v_now >= v_open and v_now < v_close then
      return jsonb_build_object('status', 'open', 'url', v_url, 'closes_at', v_close at time zone v_tz);
    end if;
    if v_open > v_now and (v_next is null or v_open < v_next) then v_next := v_open; end if;
  end loop;

  return jsonb_build_object('status', 'closed', 'opens_at', case when v_next is null then null else v_next at time zone v_tz end);
end $$;
revoke all on function public.class_meet_at(uuid, uuid, timestamptz) from public, anon, authenticated;

-- ---------- 4. mutare / lectie in plus / anulare ----------
-- p_kind = 'moved'     : p_orig = ziua lectiei din program, p_new_start = noul inceput, p_hours = durata (implicit cea din program)
--          'extra'     : p_new_start, p_hours
--          'cancelled' : p_orig
-- Mutarea unei lectii deja mutate / anulate o inlocuieste (se schimba lectia curenta, nu cea din program).
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
  if not found or lower(coalesce(g.mode, '')) <> 'online' then raise exception 'not online'; end if;

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

-- readuce o lectie la ce era: sterge exceptia (lectia mutata revine la ora din program, cea anulata se tine, cea in plus dispare)
create or replace function public.class_lesson_remove(p_change uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ch public.class_lesson_changes;
  c public.classes;
  v_now timestamp := now() at time zone 'Europe/Chisinau';
  v_fmt constant text := 'YYYY-MM-DD"T"HH24:MI';
begin
  select * into ch from public.class_lesson_changes where id = p_change;
  if not found then raise exception 'not found'; end if;
  select * into c from public.classes where id = ch.class_id;
  if not (c.teacher_id = auth.uid() or public.reg_is_staff()) then raise exception 'not allowed'; end if;

  -- ce a trecut ramane in istoric
  if ch.kind = 'extra' and ch.new_start < v_now + interval '1 hour' then raise exception 'too late'; end if;
  if ch.kind = 'moved' and (ch.new_start < v_now or ch.orig_start < v_now + interval '1 hour') then raise exception 'too late'; end if;
  if ch.kind = 'cancelled' and ch.orig_start < v_now + interval '1 hour' then raise exception 'too late'; end if;

  delete from public.class_lesson_changes where id = p_change;

  -- lectia din program care revine nu are voie sa se suprapuna cu alta
  if ch.kind in ('moved', 'cancelled') and exists (
    select 1 from public.class_lessons(ch.class_id, ch.orig_start - interval '1 day', ch.orig_start + interval '2 days') l
    where l.l_kind <> 'cancelled' and not (l.l_kind = 'regular' and l.l_orig_date = ch.orig_date)
      and l.l_start < ch.orig_start + make_interval(hours => ch.orig_hours)
      and l.l_start + make_interval(hours => l.l_hours) > ch.orig_start
  ) then raise exception 'overlap'; end if;

  return jsonb_build_object('kind', ch.kind, 'orig_start', to_char(ch.orig_start, v_fmt), 'new_start', to_char(ch.new_start, v_fmt), 'hours', ch.hours);
end $$;

-- ---------- 5. lectiile urmatoare, pentru clasa (profesor si elevi) ----------
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
  if not found or lower(coalesce(g.mode, '')) <> 'online' then return '[]'::jsonb; end if;

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

-- ---------- 6. drepturi: doar utilizatorii logati ----------
revoke all on function public.class_lesson_set(uuid, text, date, timestamp, int) from public, anon;
revoke all on function public.class_lesson_remove(uuid) from public, anon;
revoke all on function public.class_upcoming_lessons(uuid, int) from public, anon;
grant execute on function public.class_lesson_set(uuid, text, date, timestamp, int) to authenticated;
grant execute on function public.class_lesson_remove(uuid) to authenticated;
grant execute on function public.class_upcoming_lessons(uuid, int) to authenticated;
