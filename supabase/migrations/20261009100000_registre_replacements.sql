-- ============================================================
-- Registre: INLOCUIRI (un profesor tine lectia unei grupe a altui profesor). Vezi docs/inlocuiri.md.
--
--   reg_replacements        o inlocuire = grupa de baza + registrul profesorului nou + fila lui + datele alese. O singura inregistrare
--                           pentru perechea (grupa de baza, profesorul nou): fila lui se refoloseste, datele noi se adauga la ale ei.
--   reg_replacement_items   banii unei prezente: un elev la un rand de lectie din fila de inlocuire. Pasii (luat din registrul vechi,
--                           pus in cel nou) se salveaza unul cate unul, ca o cadere intre ei sa se reia de unde a ramas.
--   reg_locks               un lacat scurt, ca doua rulari ale motorului sa nu lucreze deodata.
--
-- Comenzile noi: REPLACEMENT_CREATE si REPLACEMENT_CANCEL se pun din consola pe REGISTRUL profesorului nou (sheet_id = 0);
-- REPL_TAKE, REPL_MONEY, REPL_CLOSE le pune doar motorul (functia registru-replace, service role) si raman aici ca jurnal.
-- Tabelele se citesc doar de admin si se scriu doar de functii (service role).
-- ============================================================

alter table public.reg_commands drop constraint if exists reg_commands_type_check;
alter table public.reg_commands add constraint reg_commands_type_check
  check (type in ('ADD_STUDENT', 'SET_STATUS', 'SET_MANAGER', 'ADD_PAYMENT', 'ADD_DISCOUNT', 'TRANSFER', 'NEW_GROUP', 'SET_GROUP', 'SET_AVAILABILITY',
                  'REPLACEMENT_CREATE', 'REPLACEMENT_CANCEL', 'REPL_TAKE', 'REPL_MONEY', 'REPL_CLOSE'));

create table if not exists public.reg_replacements (
  id             uuid primary key,                                  -- id-ul comenzii REPLACEMENT_CREATE care a facut-o
  orig_workbook  uuid not null references public.reg_workbooks (id) on delete cascade,
  orig_sheet     bigint not null,                                   -- grupa de baza (gid)
  repl_workbook  uuid not null references public.reg_workbooks (id) on delete cascade,
  repl_sheet     bigint not null,                                   -- fila de inlocuire din registrul profesorului nou (gid)
  repl_tab       text,
  status         text not null default 'active' check (status in ('active', 'closed', 'cancelled')),
  dates          jsonb not null default '[]'::jsonb,                -- [{ iso, start, duration, cabinet, cancelled? }]
  price          numeric not null,                                  -- pretul unei lectii pentru formatul grupei de baza (lei)
  size           int,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  closed_at      timestamptz
);
-- o singura inregistrare vie pentru aceeasi grupa si acelasi profesor nou: fila se refoloseste
create unique index if not exists reg_replacements_pair_idx on public.reg_replacements (orig_workbook, orig_sheet, repl_workbook) where status <> 'cancelled';
create index if not exists reg_replacements_repl_idx on public.reg_replacements (repl_workbook, repl_sheet);

create table if not exists public.reg_replacement_items (
  replacement_id uuid not null references public.reg_replacements (id) on delete cascade,
  student_key    text not null,                                     -- telefon#randul lectiei
  lesson_row     int not null,
  student_name   text,
  student_phone  text,
  mark           text,                                              -- P sau A
  status         text not null default 'pending' check (status in ('pending', 'from-done', 'settled', 'rev-new-done', 'reversed')),
  step           text,                                              -- pasul care a esuat ultima oara
  error          text,
  tries          int not null default 0,
  attempt        int not null default 1,                            -- creste cand prezenta se schimba si revine
  tot            numeric,                                           -- pretul lectiei
  ach            numeric not null default 0,                        -- cat s-a luat din achitari
  red            numeric not null default 0,                        -- cat s-a luat din reduceri
  short          numeric not null default 0,                        -- cat a lipsit (elevul nu avea destui bani)
  settled_at     timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (replacement_id, student_key)
);

create table if not exists public.reg_locks (
  name  text primary key,
  until timestamptz not null
);

alter table public.reg_replacements      enable row level security;
alter table public.reg_replacement_items enable row level security;
alter table public.reg_locks             enable row level security;

drop policy if exists reg_replacements_read on public.reg_replacements;
create policy reg_replacements_read on public.reg_replacements for select to authenticated using (public.reg_can_write());
drop policy if exists reg_replacement_items_read on public.reg_replacement_items;
create policy reg_replacement_items_read on public.reg_replacement_items for select to authenticated using (public.reg_can_write());

revoke all on public.reg_replacements, public.reg_replacement_items, public.reg_locks from anon, authenticated;
grant select on public.reg_replacements, public.reg_replacement_items to authenticated;

-- lacatul: true daca l-ai luat (liber sau expirat), false daca il tine altcineva; doar service role
create or replace function public.reg_take_lock(p_name text, p_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  insert into public.reg_locks as l (name, until) values (p_name, now() + make_interval(secs => p_seconds))
  on conflict (name) do update set until = excluded.until where l.until < now();
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;
revoke all on function public.reg_take_lock(text, int) from public, anon, authenticated;
grant execute on function public.reg_take_lock(text, int) to service_role;

create or replace function public.reg_release_lock(p_name text)
returns void
language sql security definer set search_path = public as $$
  update public.reg_locks set until = now() - interval '1 second' where name = p_name;
$$;
revoke all on function public.reg_release_lock(text) from public, anon, authenticated;
grant execute on function public.reg_release_lock(text) to service_role;

-- punerea unei comenzi: REPLACEMENT_CREATE / REPLACEMENT_CANCEL sunt pe registru (sheet 0); la CREATE grupa de baza trebuie sa existe
create or replace function public.reg_enqueue_command(p_workbook uuid, p_sheet bigint, p_type text, p_payload jsonb, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if not public.reg_can_write() then raise exception 'not authorized'; end if;
  if p_type in ('REPL_TAKE', 'REPL_MONEY', 'REPL_CLOSE') then
    raise exception 'Comanda aceasta o pune doar motorul de inlocuiri.';
  end if;
  if p_type in ('NEW_GROUP', 'SET_AVAILABILITY', 'REPLACEMENT_CREATE', 'REPLACEMENT_CANCEL') then
    if not exists (select 1 from public.reg_workbooks w where w.id = p_workbook and w.enabled) then
      raise exception 'Registrul nu există sau nu mai e activ în platformă.';
    end if;
  elsif not exists (select 1 from public.reg_groups g where g.workbook_id = p_workbook and g.sheet_id = p_sheet) then
    raise exception 'Grupa nu există în registrul acesta (sincronizează registrul și încearcă din nou).';
  end if;
  if p_type = 'TRANSFER' and not exists (
       select 1 from public.reg_groups g
       where g.workbook_id = nullif(p_payload->>'toWorkbook', '')::uuid and g.sheet_id = nullif(p_payload->>'toSheet', '')::bigint) then
    raise exception 'Grupa nouă nu există în registrul ei (sincronizează registrele și încearcă din nou).';
  end if;
  if p_type = 'REPLACEMENT_CREATE' and not exists (
       select 1 from public.reg_groups g
       where g.workbook_id = nullif(p_payload->>'origWorkbook', '')::uuid and g.sheet_id = nullif(p_payload->>'origSheet', '')::bigint) then
    raise exception 'Grupa de bază nu există în registrul ei (sincronizează registrele și încearcă din nou).';
  end if;
  if p_type = 'REPLACEMENT_CANCEL' and not exists (
       select 1 from public.reg_replacements r where r.id = nullif(p_payload->>'replacementId', '')::uuid and r.repl_workbook = p_workbook) then
    raise exception 'Înlocuirea nu există în registrul acesta.';
  end if;
  insert into public.reg_commands (id, workbook_id, sheet_id, type, payload, created_by)
  values (v_id, p_workbook, p_sheet, p_type, coalesce(p_payload, '{}'::jsonb), auth.uid())
  on conflict (id) do nothing;
  return v_id;
end $$;

-- CREATE OR REPLACE pastreaza drepturile, dar le reafirmam: doar utilizatorii autentificati (adminul e verificat in functie)
revoke all on function public.reg_enqueue_command(uuid, bigint, text, jsonb, uuid) from public, anon;
grant execute on function public.reg_enqueue_command(uuid, bigint, text, jsonb, uuid) to authenticated;
