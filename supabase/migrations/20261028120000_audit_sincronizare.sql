-- Audit al sincronizarii registru <-> platforma (2026-10-28).
--
--  1. Prezenta, tema lectiei si data lectiei se tin DOAR in registru (Sheets). Catalogul clasei ramane cu notele (teme si simulari). Din client nu se mai
--     poate scrie in class_sessions / attendance_records; Sumarul citeste prezentele direct din registru (reg_lessons). reg_class_sync_people nu mai scrie
--     sesiuni: pastreaza doar statutul si managerul elevilor legati.
--  2. Incercarile de a ghici un cod de invitatie sunt limitate (10 coduri gresite in 15 minute, apoi pauza).
--  3. Cererile de alaturare ajung in timp real la profesor (si raspunsul la elev): class_join_requests intra in publicatia realtime.
--  4. Legatura elev <-> numele din registru nu mai sta in class_members (pe care colegii de clasa o pot citi, dupa politicile vechi, necunoscute), ci
--     intr-un tabel doar al profesorului clasei: class_member_links.

-- ---------- 0. legatura cu registrul, doar pentru profesor ----------

create table if not exists public.class_member_links (
  class_id         uuid not null references public.classes (id) on delete cascade,
  student_id       uuid not null references auth.users (id) on delete cascade,
  reg_student_name text not null,
  primary key (class_id, student_id)
);
create unique index if not exists class_member_links_name_uidx on public.class_member_links (class_id, lower(btrim(reg_student_name)));
alter table public.class_member_links enable row level security;
drop policy if exists class_member_links_select on public.class_member_links;
create policy class_member_links_select on public.class_member_links for select to authenticated
  using (exists (select 1 from public.classes c where c.id = class_member_links.class_id and c.teacher_id = auth.uid()) or public.reg_is_admin());
revoke all on public.class_member_links from anon;
revoke insert, update, delete on public.class_member_links from authenticated;

-- ce era deja legat (in class_members.reg_student_name) se muta
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_members' and column_name = 'reg_student_name') then
    insert into public.class_member_links (class_id, student_id, reg_student_name)
      select class_id, student_id, reg_student_name from public.class_members where reg_student_name is not null
      on conflict do nothing;
  end if;
end $$;

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
    if exists (select 1 from public.class_member_links where class_id = c.id and student_id <> r.student_id and lower(btrim(reg_student_name)) = lower(v_reg)) then
      raise exception 'Elevul din registru e deja legat de alt cont.';
    end if;
    select name into v_reg from public.reg_students where group_id = c.reg_group_id and lower(btrim(name)) = lower(v_reg) limit 1;
  end if;

  insert into public.class_members (class_id, student_id, student_name) values (c.id, r.student_id, r.student_name)
  on conflict (class_id, student_id) do nothing;
  if v_reg is not null then
    insert into public.class_member_links (class_id, student_id, reg_student_name) values (c.id, r.student_id, v_reg)
    on conflict (class_id, student_id) do update set reg_student_name = excluded.reg_student_name;
  end if;

  update public.class_join_requests set status = 'accepted', decided_at = now(), decided_by = v_uid where id = r.id;

  if v_reg is not null and c.reg_group_id is not null then
    begin perform public.reg_class_sync_people(c.reg_group_id); exception when others then raise warning 'reg_class_sync_people: %', sqlerrm; end;
  end if;
  return jsonb_build_object('status', 'accepted', 'linked', v_reg is not null);
end $$;

create or replace function public.set_member_reg_link(p_class uuid, p_student uuid, p_reg_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.classes;
  v_reg text := nullif(btrim(coalesce(p_reg_name, '')), '');
begin
  select * into c from public.classes where id = p_class;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if c.teacher_id is distinct from auth.uid() and not public.reg_is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.class_members where class_id = p_class and student_id = p_student) then
    raise exception 'Elevul nu e membru al clasei.';
  end if;
  if v_reg is null then
    delete from public.class_member_links where class_id = p_class and student_id = p_student;
    return jsonb_build_object('status', 'ok', 'linked', false);
  end if;
  if c.reg_group_id is null or not exists (select 1 from public.reg_students where group_id = c.reg_group_id and lower(btrim(name)) = lower(v_reg)) then
    raise exception 'Elevul nu există în registrul grupei.';
  end if;
  if exists (select 1 from public.class_member_links where class_id = p_class and student_id <> p_student and lower(btrim(reg_student_name)) = lower(v_reg)) then
    raise exception 'Elevul din registru e deja legat de alt cont.';
  end if;
  select name into v_reg from public.reg_students where group_id = c.reg_group_id and lower(btrim(name)) = lower(v_reg) limit 1;
  insert into public.class_member_links (class_id, student_id, reg_student_name) values (p_class, p_student, v_reg)
  on conflict (class_id, student_id) do update set reg_student_name = excluded.reg_student_name;
  begin perform public.reg_class_sync_people(c.reg_group_id); exception when others then raise warning 'reg_class_sync_people: %', sqlerrm; end;
  return jsonb_build_object('status', 'ok', 'linked', true);
end $$;

revoke all on function public.decide_join_request(uuid, boolean, text) from public, anon;
grant execute on function public.decide_join_request(uuid, boolean, text) to authenticated;
revoke all on function public.set_member_reg_link(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_reg_link(uuid, uuid, text) to authenticated;

-- ---------- 1. prezenta nu se mai pune din platforma ----------

create or replace function public.block_client_write_attendance() returns trigger
language plpgsql as $$
begin
  -- stergerea in cascada (cand dispare o clasa) ruleaza la adancimea 2 si trece
  if current_user in ('authenticated', 'anon') and pg_trigger_depth() <= 1 then
    raise exception 'Prezența se ține în registru (Google Sheets), nu în platformă.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists class_sessions_block_client on public.class_sessions;
create trigger class_sessions_block_client before insert or update or delete on public.class_sessions
  for each row execute function public.block_client_write_attendance();

drop trigger if exists attendance_records_block_client on public.attendance_records;
create trigger attendance_records_block_client before insert or update or delete on public.attendance_records
  for each row execute function public.block_client_write_attendance();

revoke all on function public.block_client_write_attendance() from public, anon, authenticated;

-- statutul elevilor legati vine din registru (managerul si prezentele se citesc direct din reg_students / reg_lessons, nu se mai copiaza)
create or replace function public.reg_class_sync_people(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.classes;
begin
  select * into c from public.classes where reg_group_id = p_group;
  if not found then return; end if;

  update public.class_members cm set status = case when lower(rs.status) in ('transferat', 'inactiv') then 'inactiv' else 'activ' end
  from public.class_member_links l, public.reg_students rs
  where l.class_id = c.id and cm.class_id = c.id and cm.student_id = l.student_id
    and rs.group_id = p_group and lower(btrim(rs.name)) = lower(btrim(l.reg_student_name))
    and cm.status is distinct from (case when lower(rs.status) in ('transferat', 'inactiv') then 'inactiv' else 'activ' end);
end $$;

revoke all on function public.reg_class_sync_people(uuid) from public, anon, authenticated;
grant execute on function public.reg_class_sync_people(uuid) to service_role;

-- ---------- 2. coduri ghicite ----------

create table if not exists public.class_join_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now()
);
create index if not exists class_join_attempts_user_idx on public.class_join_attempts (user_id, at desc);
alter table public.class_join_attempts enable row level security;
revoke all on public.class_join_attempts from anon, authenticated;

create or replace function public.request_join_class(p_code text, p_name text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.classes;
  r public.class_join_requests;
  v_name text;
begin
  if v_uid is null then return jsonb_build_object('status', 'auth'); end if;

  if (select count(*) from public.class_join_attempts where user_id = v_uid and at > now() - interval '15 minutes') >= 10 then
    return jsonb_build_object('status', 'too_many');
  end if;

  select * into c from public.classes where invite_code = upper(btrim(coalesce(p_code, '')));
  if not found then
    insert into public.class_join_attempts (user_id) values (v_uid);
    delete from public.class_join_attempts where at < now() - interval '1 day';
    return jsonb_build_object('status', 'not_found');
  end if;
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

revoke all on function public.request_join_class(text, text) from public, anon;
grant execute on function public.request_join_class(text, text) to authenticated;

-- ---------- 3. realtime pentru cereri ----------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'class_join_requests') then
    alter publication supabase_realtime add table public.class_join_requests;
  end if;
end $$;

-- ---------- 4. coloana veche iese (dupa ce functiile nu o mai folosesc) ----------
drop index if exists public.class_members_reg_name_uidx;
alter table public.class_members drop column if exists reg_student_name;
