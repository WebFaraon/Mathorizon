-- ============================================================
-- Registre: scrierea din platforma in registrul Google Sheets (F2).
--
-- Platforma nu scrie in registru direct. Pune o COMANDA (reg_commands): adauga un elev, schimba statutul sau managerul,
-- adauga o plata sau o reducere. Functia edge `registru-apply` o aplica in Sheets (verifica celulele inainte si dupa,
-- nu suprascrie nimic schimbat intre timp) si scrie rezultatul aici: done, noop, invalid, conflict sau failed.
-- Doar functia (service role) schimba statusul unei comenzi; din browser se poate doar pune o comanda si citi.
-- Cine poate scrie: azi doar adminul. Managerii se adauga schimband reg_can_write().
-- ============================================================

create table if not exists public.reg_commands (
  id          uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.reg_workbooks (id) on delete cascade,
  sheet_id    bigint not null,                      -- fila (gid), nu numele ei
  type        text not null check (type in ('ADD_STUDENT', 'SET_STATUS', 'SET_MANAGER', 'ADD_PAYMENT', 'ADD_DISCOUNT')),
  payload     jsonb not null default '{}'::jsonb,   -- name, phone, manager, status / student { name, phone }, amount, expectStatus ...
  status      text not null default 'pending' check (status in ('pending', 'running', 'done', 'noop', 'invalid', 'conflict', 'failed')),
  result      jsonb,                                -- { status, column, writes, code, msg }
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,                          -- cand a luat-o functia (o comanda ramasa 'running' peste 10 minute se marcheaza failed)
  applied_at  timestamptz
);
create index if not exists reg_commands_wb_idx on public.reg_commands (workbook_id, created_at desc);
create index if not exists reg_commands_pending_idx on public.reg_commands (created_at) where status = 'pending';

alter table public.reg_commands enable row level security;

create or replace function public.reg_can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select public.reg_is_admin();
$$;

drop policy if exists reg_commands_read on public.reg_commands;
create policy reg_commands_read on public.reg_commands for select to authenticated using (public.reg_can_write());

revoke all on public.reg_commands from anon, authenticated;
grant select on public.reg_commands to authenticated;

-- punerea unei comenzi; p_id (optional) face reluarea aceluiasi apel inofensiva: aceeasi comanda nu se pune de doua ori
create or replace function public.reg_enqueue_command(p_workbook uuid, p_sheet bigint, p_type text, p_payload jsonb, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if not public.reg_can_write() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.reg_groups g where g.workbook_id = p_workbook and g.sheet_id = p_sheet) then
    raise exception 'Grupa nu există în registrul acesta (sincronizează registrul și încearcă din nou).';
  end if;
  insert into public.reg_commands (id, workbook_id, sheet_id, type, payload, created_by)
  values (v_id, p_workbook, p_sheet, p_type, coalesce(p_payload, '{}'::jsonb), auth.uid())
  on conflict (id) do nothing;
  return v_id;
end $$;

-- DROP+CREATE re-acorda EXECUTE lui anon: scoatem explicit; adminul e verificat in functie
revoke all on function public.reg_can_write() from public, anon;
revoke all on function public.reg_enqueue_command(uuid, bigint, text, jsonb, uuid) from public, anon;
grant execute on function public.reg_can_write() to authenticated;
grant execute on function public.reg_enqueue_command(uuid, bigint, text, jsonb, uuid) to authenticated;
