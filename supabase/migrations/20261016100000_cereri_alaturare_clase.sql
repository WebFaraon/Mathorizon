-- Alaturarea la o clasa se face prin cerere, nu direct cu codul (cerut de utilizator, 2026-10-15).
--
-- Elevul introduce codul si trimite o cerere; pana o accepta profesorul clasei nu are acces la nimic din clasa (mesaje, teme, simulari, tabla, catalog).
-- La acceptare, profesorul poate lega elevul de numele lui din registrul grupei (class_members.reg_student_name). Un elev legat primeste din
-- registru statutul (Activ / Inactiv) si prezentele, scrise in Catalogul clasei. Registrul ramane singura sursa: o prezenta pusa de mana in
-- Catalog pentru un elev legat se rescrie la urmatoarea sincronizare.
--
-- Tot ce tine de acces trece prin functii (security definer); clientul nu mai poate insera direct in class_members.

-- ---------- cererile ----------

create table if not exists public.class_join_requests (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  student_id  uuid not null references auth.users (id) on delete cascade,
  student_name text,
  class_name  text,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references auth.users (id) on delete set null,
  unique (class_id, student_id)
);
create index if not exists class_join_requests_class_idx on public.class_join_requests (class_id, status);
create index if not exists class_join_requests_student_idx on public.class_join_requests (student_id);

alter table public.class_join_requests enable row level security;

-- elevul isi vede cererile; profesorul le vede pe ale claselor lui. Scrierea se face doar prin functiile de mai jos.
drop policy if exists class_join_requests_select on public.class_join_requests;
create policy class_join_requests_select on public.class_join_requests for select to authenticated
  using (
    student_id = auth.uid()
    or exists (select 1 from public.classes c where c.id = class_join_requests.class_id and c.teacher_id = auth.uid())
  );

-- elevul isi poate retrage o cerere aflata in asteptare
drop policy if exists class_join_requests_cancel on public.class_join_requests;
create policy class_join_requests_cancel on public.class_join_requests for delete to authenticated
  using (student_id = auth.uid() and status = 'pending');

revoke all on public.class_join_requests from anon;
revoke insert, update on public.class_join_requests from authenticated;

-- ---------- legatura cu registrul ----------

alter table public.class_members add column if not exists reg_student_name text;
create unique index if not exists class_members_reg_name_uidx
  on public.class_members (class_id, lower(btrim(reg_student_name))) where reg_student_name is not null;

-- ---------- nimeni nu mai intra in clasa direct ----------
-- (RLS-ul vechi al lui class_members nu e in migrari; declansatorul opreste inserarea din client oricare ar fi politicile)

create or replace function public.class_members_block_direct_insert() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'Alăturarea la o clasă se face printr-o cerere trimisă profesorului.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists class_members_block_direct_insert on public.class_members;
create trigger class_members_block_direct_insert before insert on public.class_members
  for each row execute function public.class_members_block_direct_insert();

-- ---------- statut si prezente din registru, pentru elevii legati ----------

create or replace function public.reg_class_sync_people(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.classes;
  m record;
  l record;
  v_sess uuid;
  v_mark text;
begin
  select * into c from public.classes where reg_group_id = p_group;
  if not found then return; end if;
  if not exists (select 1 from public.class_members where class_id = c.id and reg_student_name is not null) then return; end if;

  -- statutul: transferat sau inactiv in registru = inactiv in clasa
  update public.class_members cm set status = case when lower(rs.status) in ('transferat', 'inactiv') then 'inactiv' else 'activ' end
  from public.reg_students rs
  where rs.group_id = p_group and cm.class_id = c.id and cm.reg_student_name is not null
    and lower(btrim(rs.name)) = lower(btrim(cm.reg_student_name))
    and cm.status is distinct from (case when lower(rs.status) in ('transferat', 'inactiv') then 'inactiv' else 'activ' end);

  -- prezentele: o lectie tinuta (cu note) = o sesiune in Catalog, cate o inregistrare pe elev legat
  for l in select iso, marks from public.reg_lessons
           where group_id = p_group and iso is not null and iso <= current_date and marks is not null and marks <> '{}'::jsonb
           order by iso loop
    select id into v_sess from public.class_sessions where class_id = c.id and session_date = l.iso order by created_at limit 1;
    for m in select cm.student_id, rs.col
             from public.class_members cm
             join public.reg_students rs on rs.group_id = p_group and lower(btrim(rs.name)) = lower(btrim(cm.reg_student_name))
             where cm.class_id = c.id and cm.reg_student_name is not null loop
      v_mark := l.marks ->> m.col;
      if v_mark in ('P', 'G', 'A', 'M', 'B') then
        if v_sess is null then
          insert into public.class_sessions (class_id, created_by, session_date) values (c.id, c.teacher_id, l.iso) returning id into v_sess;
        end if;
        insert into public.attendance_records as a (session_id, student_id, present)
        values (v_sess, m.student_id, v_mark in ('P', 'G'))
        on conflict (session_id, student_id) do update set present = excluded.present
        where a.present is distinct from excluded.present;
      end if;
    end loop;
  end loop;
end $$;

-- reg_apply_group (definitia din 20261012100000) + sincronizarea elevilor legati la sfarsit
create or replace function public.reg_apply_group(p_workbook uuid, p_group jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
begin
  insert into public.reg_groups as g (workbook_id, sheet_id, tab, format_size, mode, price, state, subject, summer, grade, level, profile, schedule, cached_total_pay, content_hash, synced_at)
  values (p_workbook, (p_group->>'sheet_id')::bigint, p_group->>'tab', nullif(p_group->>'format_size', '')::int,
          nullif(lower(p_group->>'mode'), ''), nullif(p_group->>'price', '')::numeric,
          p_group->>'state', p_group->>'subject',
          coalesce((p_group->>'summer')::boolean, false), p_group->>'grade', p_group->>'level', p_group->>'profile',
          coalesce(p_group->'schedule', '[]'::jsonb), nullif(p_group->>'cached_total_pay', '')::numeric, p_group->>'content_hash', now())
  on conflict (workbook_id, sheet_id) do update set
    tab = excluded.tab, format_size = excluded.format_size, mode = excluded.mode, price = excluded.price, state = excluded.state, subject = excluded.subject, summer = excluded.summer,
    grade = excluded.grade, level = excluded.level, profile = excluded.profile, schedule = excluded.schedule,
    cached_total_pay = excluded.cached_total_pay, content_hash = excluded.content_hash, synced_at = now()
  returning id into v_group;

  delete from public.reg_students where group_id = v_group;
  delete from public.reg_lessons  where group_id = v_group;

  insert into public.reg_students (group_id, col, header_raw, name, phone, phone_kind, manager, status, paid, discount, cost, sold)
  select v_group, s->>'col', s->>'header_raw', s->>'name', s->>'phone', s->>'phone_kind', s->>'manager', s->>'status',
         nullif(s->>'paid', '')::numeric, nullif(s->>'discount', '')::numeric, nullif(s->>'cost', '')::numeric, nullif(s->>'sold', '')::numeric
  from jsonb_array_elements(coalesce(p_group->'students', '[]'::jsonb)) s;

  insert into public.reg_lessons (group_id, row_no, date_text, iso, topic, teacher_level, teacher_pay, marks)
  select v_group, (l->>'row_no')::int, l->>'date_text', nullif(l->>'iso', '')::date, l->>'topic', nullif(l->>'teacher_level', '')::int,
         nullif(l->>'teacher_pay', '')::numeric, coalesce(l->'marks', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_group->'lessons', '[]'::jsonb)) l;

  -- o eroare aici nu trebuie sa opreasca niciodata sincronizarea registrului
  begin
    perform public.reg_class_sync_people(v_group);
  exception when others then
    raise warning 'reg_class_sync_people %: %', v_group, sqlerrm;
  end;

  return v_group;
end $$;

-- ---------- functiile de acces ----------

-- elevul trimite cererea cu codul clasei
create or replace function public.request_join_class(p_code text, p_name text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.classes;
  r public.class_join_requests;
  v_name text;
begin
  if v_uid is null then return jsonb_build_object('status', 'auth'); end if;
  select * into c from public.classes where invite_code = upper(btrim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if c.teacher_id = v_uid then return jsonb_build_object('status', 'own_class'); end if;
  if exists (select 1 from public.class_members where class_id = c.id and student_id = v_uid) then
    return jsonb_build_object('status', 'already_member', 'class_name', c.name);
  end if;

  v_name := coalesce(nullif(btrim(p_name), ''), (select nullif(btrim(display_name), '') from public.user_profiles where user_id = v_uid), 'Elev');

  select * into r from public.class_join_requests where class_id = c.id and student_id = v_uid;
  if found then
    if r.status = 'pending' then return jsonb_build_object('status', 'already_pending', 'class_name', c.name); end if;
    if r.status = 'rejected' and r.decided_at > now() - interval '24 hours' then
      return jsonb_build_object('status', 'rejected_wait', 'class_name', c.name, 'retry_at', r.decided_at + interval '24 hours');
    end if;
    update public.class_join_requests
      set status = 'pending', student_name = v_name, class_name = c.name, created_at = now(), decided_at = null, decided_by = null
      where id = r.id;
  else
    insert into public.class_join_requests (class_id, student_id, student_name, class_name) values (c.id, v_uid, v_name, c.name);
  end if;
  return jsonb_build_object('status', 'pending', 'class_name', c.name);
end $$;

-- profesorul accepta sau respinge; la acceptare poate lega elevul de numele lui din registrul grupei
create or replace function public.decide_join_request(p_request uuid, p_accept boolean, p_reg_name text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r public.class_join_requests;
  c public.classes;
  v_reg text := nullif(btrim(coalesce(p_reg_name, '')), '');
begin
  select * into r from public.class_join_requests where id = p_request;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select * into c from public.classes where id = r.class_id;
  if c.teacher_id is distinct from v_uid and not public.reg_is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if r.status <> 'pending' then return jsonb_build_object('status', 'already_decided'); end if;

  if not p_accept then
    update public.class_join_requests set status = 'rejected', decided_at = now(), decided_by = v_uid where id = r.id;
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_reg is not null then
    if c.reg_group_id is null or not exists (select 1 from public.reg_students where group_id = c.reg_group_id and lower(btrim(name)) = lower(v_reg)) then
      raise exception 'Elevul nu există în registrul grupei.';
    end if;
    if exists (select 1 from public.class_members where class_id = c.id and student_id <> r.student_id and lower(btrim(reg_student_name)) = lower(v_reg)) then
      raise exception 'Elevul din registru e deja legat de alt cont.';
    end if;
    -- numele exact din registru
    select name into v_reg from public.reg_students where group_id = c.reg_group_id and lower(btrim(name)) = lower(v_reg) limit 1;
  end if;

  insert into public.class_members (class_id, student_id, student_name, reg_student_name)
  values (c.id, r.student_id, r.student_name, v_reg)
  on conflict (class_id, student_id) do update set reg_student_name = coalesce(excluded.reg_student_name, public.class_members.reg_student_name);

  update public.class_join_requests set status = 'accepted', decided_at = now(), decided_by = v_uid where id = r.id;

  if v_reg is not null and c.reg_group_id is not null then
    begin perform public.reg_class_sync_people(c.reg_group_id); exception when others then raise warning 'reg_class_sync_people: %', sqlerrm; end;
  end if;
  return jsonb_build_object('status', 'accepted', 'linked', v_reg is not null);
end $$;

-- legarea (sau dezlegarea, cu null) unui elev deja intrat in clasa
create or replace function public.set_member_reg_link(p_class uuid, p_student uuid, p_reg_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.classes;
  v_reg text := nullif(btrim(coalesce(p_reg_name, '')), '');
begin
  select * into c from public.classes where id = p_class;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if c.teacher_id is distinct from auth.uid() and not public.reg_is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_reg is not null then
    if c.reg_group_id is null or not exists (select 1 from public.reg_students where group_id = c.reg_group_id and lower(btrim(name)) = lower(v_reg)) then
      raise exception 'Elevul nu există în registrul grupei.';
    end if;
    if exists (select 1 from public.class_members where class_id = c.id and student_id <> p_student and lower(btrim(reg_student_name)) = lower(v_reg)) then
      raise exception 'Elevul din registru e deja legat de alt cont.';
    end if;
    select name into v_reg from public.reg_students where group_id = c.reg_group_id and lower(btrim(name)) = lower(v_reg) limit 1;
  end if;
  update public.class_members set reg_student_name = v_reg where class_id = p_class and student_id = p_student;
  if v_reg is not null and c.reg_group_id is not null then
    begin perform public.reg_class_sync_people(c.reg_group_id); exception when others then raise warning 'reg_class_sync_people: %', sqlerrm; end;
  end if;
  return jsonb_build_object('status', 'ok', 'linked', v_reg is not null);
end $$;

-- cate cereri asteapta decizia profesorului (insigna de la tabul Clase)
create or replace function public.pending_join_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.class_join_requests r join public.classes c on c.id = r.class_id
  where r.status = 'pending' and c.teacher_id = auth.uid();
$$;

-- DROP/CREATE re-acorda EXECUTE pentru anon: se reafirma peste tot
revoke all on function public.reg_class_sync_people(uuid) from public, anon, authenticated;
grant execute on function public.reg_class_sync_people(uuid) to service_role;
revoke all on function public.reg_apply_group(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reg_apply_group(uuid, jsonb) to service_role;
revoke all on function public.request_join_class(text, text) from public, anon;
grant execute on function public.request_join_class(text, text) to authenticated;
revoke all on function public.decide_join_request(uuid, boolean, text) from public, anon;
grant execute on function public.decide_join_request(uuid, boolean, text) to authenticated;
revoke all on function public.set_member_reg_link(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_reg_link(uuid, uuid, text) to authenticated;
revoke all on function public.pending_join_count() from public, anon;
grant execute on function public.pending_join_count() to authenticated;
revoke all on function public.class_members_block_direct_insert() from public, anon, authenticated;
