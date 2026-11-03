-- Managerii afla de schimbarile de lectii ale profesorilor (2026-11-04).
--
-- Cand un profesor anuleaza o lectie (cu motiv), o muta, adauga una in plus, ori le desface, schimbarea intra intr-un jurnal (lesson_change_events).
-- Il vad: adminul (toate) si managerii ale caror elevi sunt in acea grupa (managerul scris in registru la elevii inscrisi, comparat dupa numele oficial).
-- O grupa de 6 elevi cu 6 manageri diferiti ajunge la toti 6; o grupa cu un singur manager ajunge la el. Fiecare are propriul "vazut".
-- Panoul din consola (pagina "Schimbari") citeste prin lesson_changes_feed / lesson_changes_unseen / lesson_changes_mark.
-- class_lesson_set primeste p_reason (obligatoriu la anulare): functia veche cu 5 parametri se sterge si se recreeaza, deci drepturile se pun din nou mai jos.
-- Se ruleaza dupa 20261103100000_mutare_ore_si_offline.sql.

-- ---------- 1. jurnalul ----------
create table if not exists public.lesson_change_events (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  group_id    uuid,                                  -- reg_groups.id al clasei (fara cheie straina: sincronizarea poate reface grupele)
  teacher_id  uuid,
  teacher_name text,
  actor_id    uuid,                                  -- cine a facut schimbarea (profesorul, sau un manager / admin)
  kind        text not null check (kind in ('moved', 'extra', 'cancelled', 'restored', 'extra_removed')),
  orig_start  timestamp,                             -- ora din program (moved / cancelled / restored)
  new_start   timestamp,                             -- noua ora (moved / extra); la restored: ora la care fusese mutata; la extra_removed: ora lectiei sterse
  hours       int,
  reason      text,                                  -- doar la anulare
  created_at  timestamptz not null default now()
);
create index if not exists lesson_change_events_created_idx on public.lesson_change_events (created_at desc);
create index if not exists lesson_change_events_group_idx on public.lesson_change_events (group_id);
alter table public.lesson_change_events enable row level security;
revoke all on table public.lesson_change_events from anon, authenticated;

create table if not exists public.lesson_change_seen (
  event_id uuid not null references public.lesson_change_events(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  seen_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.lesson_change_seen enable row level security;
revoke all on table public.lesson_change_seen from anon, authenticated;

-- ---------- 2. profesorul schimba lectiile: schimbarea intra si in jurnal ----------
drop function if exists public.class_lesson_set(uuid, text, date, timestamp, int);

create or replace function public.class_lesson_set(p_class uuid, p_kind text, p_orig date, p_new_start timestamp, p_hours int default null, p_reason text default null)
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
  v_ev uuid;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
  v_fmt constant text := 'YYYY-MM-DD"T"HH24:MI';
begin
  select * into c from public.classes where id = p_class;
  if not found then raise exception 'not found'; end if;
  if not (c.teacher_id = auth.uid() or public.reg_is_staff()) then raise exception 'not allowed'; end if;
  if p_kind not in ('moved', 'extra', 'cancelled') then raise exception 'bad kind'; end if;
  -- la o anulare managerii trebuie sa afle de ce; la mutare si lectie in plus nu se cere motiv
  if p_kind = 'cancelled' and (v_reason is null or length(v_reason) < 3) then raise exception 'reason required'; end if;
  if p_kind <> 'cancelled' then v_reason := null; end if;

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

  -- anuntul pentru manageri (jurnalul schimbarilor); cine a facut schimbarea, daca e personal, il are deja vazut
  insert into public.lesson_change_events (class_id, group_id, teacher_id, teacher_name, actor_id, kind, orig_start, new_start, hours, reason)
  values (p_class, c.reg_group_id, c.teacher_id, c.teacher_name, auth.uid(), p_kind,
          case when p_kind = 'extra' then null else v_rst end,
          case when p_kind = 'cancelled' then null else p_new_start end, v_hours, v_reason)
  returning id into v_ev;
  if public.reg_is_staff() then insert into public.lesson_change_seen (event_id, user_id) values (v_ev, auth.uid()) on conflict do nothing; end if;

  return jsonb_build_object(
    'id', v_id, 'kind', p_kind, 'hours', v_hours,
    'orig_start', to_char(v_rst, v_fmt), 'new_start', to_char(p_new_start, v_fmt)
  );
end $$;

-- anularea unei exceptii (profesorul desface o mutare / anulare, sau sterge o lectie in plus)
create or replace function public.class_lesson_remove(p_change uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ch public.class_lesson_changes;
  c public.classes;
  v_now timestamp := now() at time zone 'Europe/Chisinau';
  v_fmt constant text := 'YYYY-MM-DD"T"HH24:MI';
  v_ev uuid;
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

  -- si revenirea la program (sau stergerea unei lectii in plus) ajunge la manageri
  insert into public.lesson_change_events (class_id, group_id, teacher_id, teacher_name, actor_id, kind, orig_start, new_start, hours)
  values (ch.class_id, c.reg_group_id, c.teacher_id, c.teacher_name, auth.uid(),
          case when ch.kind = 'extra' then 'extra_removed' else 'restored' end,
          case when ch.kind = 'extra' then null else ch.orig_start end, ch.new_start, ch.hours)
  returning id into v_ev;
  if public.reg_is_staff() then insert into public.lesson_change_seen (event_id, user_id) values (v_ev, auth.uid()) on conflict do nothing; end if;

  return jsonb_build_object('kind', ch.kind, 'orig_start', to_char(ch.orig_start, v_fmt), 'new_start', to_char(ch.new_start, v_fmt), 'hours', ch.hours);
end $$;

-- ---------- 3. ce vede fiecare ----------
-- Evenimentele din ultimele 90 de zile pe care le are voie sa le vada cine intreaba: adminul pe toate, managerul (activ) doar pe cele ale grupelor in care are elevi inscrisi.
-- "students" = elevii lui din grupa (la admin: toti cei inscrisi). "seen" = a marcat-o deja el.
create or replace function public.lesson_changes_feed(p_limit int default 120)
returns table (id uuid, class_id uuid, kind text, orig_start timestamp, new_start timestamp, hours int, reason text, created_at timestamptz,
               teacher_name text, subject text, grade text, level text, mode text, tab text, students text[], seen boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_role text; v_status text; v_name text; v_admin boolean;
  v_in constant text[] := array['activ', 'ora de proba', 'ora de proba confirmata', 'instabil', 'inlocuire'];
begin
  select up.role, up.status, up.official_name into v_role, v_status, v_name from public.user_profiles up where up.user_id = auth.uid();
  v_admin := v_role = 'admin';
  if not v_admin and not (v_role = 'manager' and v_status = 'active' and nullif(btrim(coalesce(v_name, '')), '') is not null) then
    return;
  end if;
  return query
    select e.id, e.class_id, e.kind, e.orig_start, e.new_start, e.hours, e.reason, e.created_at,
           coalesce(e.teacher_name, c.teacher_name), g.subject, g.grade, g.level, g.mode, g.tab,
           coalesce((select array_agg(s.name order by s.col) from public.reg_students s
                      where s.group_id = e.group_id and lower(translate(coalesce(s.status, ''), 'ăâîșşțţ', 'aaisstt')) = any (v_in)
                        and (v_admin or public.name_key(s.manager) = public.name_key(v_name))), '{}'::text[]),
           exists (select 1 from public.lesson_change_seen x where x.event_id = e.id and x.user_id = auth.uid())
      from public.lesson_change_events e
      left join public.reg_groups g on g.id = e.group_id
      left join public.classes c on c.id = e.class_id
     where e.created_at > now() - interval '90 days'
       and (v_admin or exists (select 1 from public.reg_students s
                                where s.group_id = e.group_id and lower(translate(coalesce(s.status, ''), 'ăâîșşțţ', 'aaisstt')) = any (v_in)
                                  and public.name_key(s.manager) = public.name_key(v_name)))
     order by e.created_at desc
     limit least(greatest(coalesce(p_limit, 120), 1), 300);
end $$;

create or replace function public.lesson_changes_unseen()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.lesson_changes_feed(300) f where not f.seen;
$$;

-- p_ids null = toate cele vazute in lista lui; marcheaza doar pentru cine intreaba, si doar ce ar fi avut voie sa vada
create or replace function public.lesson_changes_mark(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  insert into public.lesson_change_seen (event_id, user_id)
  select f.id, auth.uid() from public.lesson_changes_feed(300) f
   where not f.seen and (p_ids is null or f.id = any (p_ids))
  on conflict do nothing;
$$;

-- ---------- 4. drepturi: doar utilizatorii logati ----------
revoke all on function public.class_lesson_set(uuid, text, date, timestamp, int, text) from public, anon;
revoke all on function public.class_lesson_remove(uuid) from public, anon;
revoke all on function public.lesson_changes_feed(int) from public, anon;
revoke all on function public.lesson_changes_unseen() from public, anon;
revoke all on function public.lesson_changes_mark(uuid[]) from public, anon;
grant execute on function public.class_lesson_set(uuid, text, date, timestamp, int, text) to authenticated;
grant execute on function public.class_lesson_remove(uuid) to authenticated;
grant execute on function public.lesson_changes_feed(int) to authenticated;
grant execute on function public.lesson_changes_unseen() to authenticated;
grant execute on function public.lesson_changes_mark(uuid[]) to authenticated;

-- Verificare dupa rulare (nu trebuie sa apara 'anon'):
--   select routine_name, grantee from information_schema.routine_privileges
--    where routine_schema = 'public' and routine_name in ('class_lesson_set', 'class_lesson_remove', 'lesson_changes_feed', 'lesson_changes_unseen', 'lesson_changes_mark')
--      and grantee in ('anon', 'public');
