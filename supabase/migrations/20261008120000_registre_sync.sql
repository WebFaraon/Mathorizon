-- ============================================================
-- Registrele Google Sheets citite in platforma (sincronizare F1: doar citire).
--
-- Registrul Sheets ramane singurul calculator si sursa datelor: aici se tine o copie
-- de citire. Nimic din tabelele astea nu se scrie din browser. Le scrie doar functia
-- edge `registru-sync` (cu service role), prin reg_apply_group(), in tranzactie
-- (o grupa se inlocuieste intreaga sau deloc).
--
-- Acces: adminul vede tot; un profesor vede doar registrul pe care il detine
-- (reg_workbooks.owner_user_id = auth.uid()).
-- ============================================================

create table if not exists public.reg_workbooks (
  id               uuid primary key default gen_random_uuid(),
  spreadsheet_id   text not null unique,          -- id-ul fisierului Google (stabil, nu numele)
  title            text,
  teacher_name     text,
  owner_user_id    uuid references auth.users (id) on delete set null,   -- profesorul care il vede
  school_year_from int,                           -- anul de inceput al anului scolar (registrul nu scrie anul pe lectii); daca lipseste, se ia din titlul fisierului
  enabled          boolean not null default true,
  last_synced_at   timestamptz,                   -- ultima verificare (si cand nu s-a schimbat nimic)
  last_full_sync_at timestamptz,                  -- ultima citire completa
  drive_modified   text,                          -- modifiedTime al fisierului la ultima citire completa
  last_status      text check (last_status in ('ok', 'partial', 'failed')),
  last_error       text,
  created_at       timestamptz not null default now()
);

create table if not exists public.reg_groups (
  id              uuid primary key default gen_random_uuid(),
  workbook_id     uuid not null references public.reg_workbooks (id) on delete cascade,
  sheet_id        bigint not null,                -- gid-ul filei (stabil, numele filei se schimba)
  tab             text not null,
  format_size     int,                            -- N din "Grup cu N elevi" (1 = individual)
  state           text,                           -- Activ / Inactiv / Startează / Se completează / Înlocuire
  subject         text,
  summer          boolean not null default false,
  grade           text,
  level           text,
  profile         text,
  schedule        jsonb not null default '[]',    -- [{ day, hour, cabinet }]
  cached_total_pay numeric,                       -- C8 din registru (suma platii profesorului)
  content_hash    text,                           -- ca sa nu rescriem o grupa neschimbata
  synced_at       timestamptz not null default now(),
  unique (workbook_id, sheet_id)
);

create table if not exists public.reg_students (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.reg_groups (id) on delete cascade,
  col             text not null,                  -- litera coloanei (D..Z)
  header_raw      text,
  name            text,
  phone           text,
  phone_kind      text,
  manager         text,
  status          text,
  paid            numeric,                        -- randul 3 (suma platilor)
  discount        numeric,                        -- randul 4
  cost            numeric,                        -- randul 5 (calculat de Sheets)
  sold            numeric,                        -- randul 2 (calculat de Sheets)
  unique (group_id, col)
);

create table if not exists public.reg_lessons (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.reg_groups (id) on delete cascade,
  row_no          int not null,                   -- randul din fila (9..198)
  date_text       text,                           -- "4 August" (registrul nu scrie anul)
  iso             date,                           -- data cu anul dedus (an scolar)
  topic           text,
  teacher_level   int,
  teacher_pay     numeric,                        -- coloana C (calculata de Sheets)
  marks           jsonb not null default '{}',    -- { "D": "P", "E": "G" }  P A G M B
  unique (group_id, row_no)
);

create table if not exists public.reg_sync_runs (
  id              bigint generated always as identity primary key,
  workbook_id     uuid references public.reg_workbooks (id) on delete cascade,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text check (status in ('ok', 'partial', 'failed')),
  groups_seen     int,
  groups_changed  int,
  groups_skipped  int,                            -- oprite de validare
  detail          jsonb                           -- erori si avertizari, pe grupa
);

create index if not exists reg_groups_workbook_idx   on public.reg_groups   (workbook_id);
create index if not exists reg_students_group_idx    on public.reg_students (group_id);
create index if not exists reg_students_phone_idx    on public.reg_students (phone);
create index if not exists reg_lessons_group_idx     on public.reg_lessons  (group_id);
create index if not exists reg_sync_runs_wb_idx      on public.reg_sync_runs (workbook_id, started_at desc);

-- ── Acces ────────────────────────────────────────────────────
alter table public.reg_workbooks  enable row level security;
alter table public.reg_groups     enable row level security;
alter table public.reg_students   enable row level security;
alter table public.reg_lessons    enable row level security;
alter table public.reg_sync_runs  enable row level security;

create or replace function public.reg_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.reg_can_see(p_workbook uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.reg_is_admin()
      or exists (select 1 from public.reg_workbooks w where w.id = p_workbook and w.owner_user_id = auth.uid());
$$;

revoke all on function public.reg_is_admin() from public, anon;
revoke all on function public.reg_can_see(uuid) from public, anon;
grant execute on function public.reg_is_admin() to authenticated;
grant execute on function public.reg_can_see(uuid) to authenticated;

drop policy if exists reg_workbooks_read on public.reg_workbooks;
create policy reg_workbooks_read on public.reg_workbooks for select to authenticated using (public.reg_can_see(id));

drop policy if exists reg_groups_read on public.reg_groups;
create policy reg_groups_read on public.reg_groups for select to authenticated using (public.reg_can_see(workbook_id));

drop policy if exists reg_students_read on public.reg_students;
create policy reg_students_read on public.reg_students for select to authenticated
  using (exists (select 1 from public.reg_groups g where g.id = group_id and public.reg_can_see(g.workbook_id)));

drop policy if exists reg_lessons_read on public.reg_lessons;
create policy reg_lessons_read on public.reg_lessons for select to authenticated
  using (exists (select 1 from public.reg_groups g where g.id = group_id and public.reg_can_see(g.workbook_id)));

drop policy if exists reg_sync_runs_read on public.reg_sync_runs;
create policy reg_sync_runs_read on public.reg_sync_runs for select to authenticated using (public.reg_is_admin());

-- doar citire pentru utilizatori; scrierile le face service role (functia edge)
revoke all on public.reg_workbooks, public.reg_groups, public.reg_students, public.reg_lessons, public.reg_sync_runs from anon, authenticated;
grant select on public.reg_workbooks, public.reg_groups, public.reg_students, public.reg_lessons, public.reg_sync_runs to authenticated;

-- ── Inlocuirea unei grupe, in tranzactie ─────────────────────
-- p_group: { sheet_id, tab, format_size, state, subject, summer, grade, level, profile, schedule,
--            cached_total_pay, content_hash, students: [...], lessons: [...] }
create or replace function public.reg_apply_group(p_workbook uuid, p_group jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
begin
  insert into public.reg_groups as g (workbook_id, sheet_id, tab, format_size, state, subject, summer, grade, level, profile, schedule, cached_total_pay, content_hash, synced_at)
  values (p_workbook, (p_group->>'sheet_id')::bigint, p_group->>'tab', nullif(p_group->>'format_size', '')::int, p_group->>'state', p_group->>'subject',
          coalesce((p_group->>'summer')::boolean, false), p_group->>'grade', p_group->>'level', p_group->>'profile',
          coalesce(p_group->'schedule', '[]'::jsonb), nullif(p_group->>'cached_total_pay', '')::numeric, p_group->>'content_hash', now())
  on conflict (workbook_id, sheet_id) do update set
    tab = excluded.tab, format_size = excluded.format_size, state = excluded.state, subject = excluded.subject, summer = excluded.summer,
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

  return v_group;
end $$;

-- grupele disparute din registru (fila stearsa) se scot, tot in tranzactie
create or replace function public.reg_prune_groups(p_workbook uuid, p_keep bigint[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.reg_groups where workbook_id = p_workbook and not (sheet_id = any (p_keep));
  get diagnostics n = row_count;
  return n;
end $$;

-- DROP+CREATE re-acorda EXECUTE lui anon: scoatem explicit, doar service role le poate rula
revoke all on function public.reg_apply_group(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.reg_prune_groups(uuid, bigint[]) from public, anon, authenticated;
grant execute on function public.reg_apply_group(uuid, jsonb) to service_role;
grant execute on function public.reg_prune_groups(uuid, bigint[]) to service_role;
