-- Botul de Telegram pentru startul grupelor (2026-10-29).
--
-- Cand o grupa trece in "Startează" (singura, cand sunt destui elevi), profesorul ei primeste in Telegram intrebarea "Confirmi startul?". Daca
-- confirma, managerul vede in consola (pagina Starturi) ca trebuie sa sune elevii pentru ora de proba; daca nu, vede motivul.
--
--  - telegram_links: ce cont de profesor e legat de ce chat Telegram (legarea o face profesorul din profilul lui, cu un cod de unica folosinta).
--  - telegram_link_codes: codurile de legare (15 minute).
--  - telegram_bot: numele botului (il pune scriptul de instalare; profilul face link-ul t.me din el).
--  - group_start_requests: o cerere pentru fiecare grupa care trece in Startează. O creeaza triggerul de pe reg_groups; o trimite functia telegram-bot (cron la
--    fiecare minut, doar intre 08:00 si 21:00 ora Chisinaului); raspunsul vine tot prin functia telegram-bot. Managerul (admin) citeste si marcheaza.

create table if not exists public.telegram_bot (
  id int primary key default 1 check (id = 1),
  username text not null,
  set_at timestamptz not null default now()
);
alter table public.telegram_bot enable row level security;
drop policy if exists telegram_bot_read on public.telegram_bot;
create policy telegram_bot_read on public.telegram_bot for select to authenticated using (true);
revoke all on public.telegram_bot from anon;
revoke insert, update, delete on public.telegram_bot from authenticated;

create table if not exists public.telegram_link_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.telegram_link_codes enable row level security;
revoke all on public.telegram_link_codes from anon, authenticated;

create table if not exists public.telegram_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chat_id bigint not null unique,
  username text,
  first_name text,
  linked_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;
drop policy if exists telegram_links_read on public.telegram_links;
create policy telegram_links_read on public.telegram_links for select to authenticated using (user_id = auth.uid() or public.reg_is_admin());
revoke all on public.telegram_links from anon;
revoke insert, update, delete on public.telegram_links from authenticated;

create table if not exists public.group_start_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.reg_groups (id) on delete set null,
  workbook_id uuid not null references public.reg_workbooks (id) on delete cascade,
  sheet_id bigint not null,
  tab text,
  subject text,
  grade text,
  schedule jsonb not null default '[]'::jsonb,
  format_size int,
  enrolled int,
  need int,
  status text not null default 'pending' check (status in ('pending', 'awaiting_reason', 'confirmed', 'declined', 'cancelled')),
  reason text,
  notified_at timestamptz,
  notify_attempts int not null default 0,
  notify_error text,
  telegram_chat_id bigint,
  telegram_message_id bigint,
  decided_at timestamptz,
  manager_seen_at timestamptz,
  manager_done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists group_start_requests_status_idx on public.group_start_requests (status, created_at desc);
create index if not exists group_start_requests_group_idx on public.group_start_requests (group_id);
-- o singura cerere deschisa pe grupa
create unique index if not exists group_start_requests_open_uidx on public.group_start_requests (workbook_id, sheet_id) where status in ('pending', 'awaiting_reason');
alter table public.group_start_requests enable row level security;
drop policy if exists group_start_requests_read on public.group_start_requests;
create policy group_start_requests_read on public.group_start_requests for select to authenticated using (public.reg_is_admin());
revoke all on public.group_start_requests from anon;
revoke insert, update, delete on public.group_start_requests from authenticated;

-- ---------- o grupa trece in Startează: se naste cererea ----------
-- (numarul de elevi se calculeaza la trimitere: la momentul triggerului elevii grupei nu sunt inca rescrisi de reg_apply_group)

create or replace function public.reg_start_request_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if lower(coalesce(new.state, '')) in ('startează', 'starteaza')
       and (tg_op = 'INSERT' or lower(coalesce(old.state, '')) not in ('startează', 'starteaza')) then
      insert into public.group_start_requests (group_id, workbook_id, sheet_id, tab, subject, grade, schedule, format_size)
      values (new.id, new.workbook_id, new.sheet_id, new.tab, new.subject, new.grade, coalesce(new.schedule, '[]'::jsonb), new.format_size)
      on conflict do nothing;
    end if;
  exception when others then
    raise warning 'reg_start_request_trg %: %', new.id, sqlerrm;       -- niciodata nu opreste sincronizarea
  end;
  return new;
end $$;

drop trigger if exists reg_groups_start_request on public.reg_groups;
create trigger reg_groups_start_request after insert or update of state on public.reg_groups
  for each row execute function public.reg_start_request_trg();

-- ---------- legarea contului de profesor cu Telegram ----------

create or replace function public.telegram_link_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if v_uid is null then raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_profiles where user_id = v_uid and role in ('profesor', 'admin')) then
    raise exception 'Doar profesorii își pot conecta Telegram.' using errcode = '42501';
  end if;
  delete from public.telegram_link_codes where user_id = v_uid or expires_at < now();
  loop
    v_code := '';
    for i in 1..8 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * 32)::int, 1); end loop;
    begin
      insert into public.telegram_link_codes (code, user_id, expires_at) values (v_code, v_uid, now() + interval '15 minutes');
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return v_code;
end $$;

create or replace function public.telegram_unlink() returns void
language sql security definer set search_path = public as $$
  delete from public.telegram_links where user_id = auth.uid();
$$;

-- managerul marcheaza ce a vazut / ce a facut
create or replace function public.start_request_mark(p_id uuid, p_what text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_what = 'seen' then
    update public.group_start_requests set manager_seen_at = coalesce(manager_seen_at, now()) where id = p_id;
  elsif p_what = 'done' then
    update public.group_start_requests set manager_seen_at = coalesce(manager_seen_at, now()), manager_done_at = now() where id = p_id and status in ('confirmed', 'declined');
  elsif p_what = 'reopen' then
    update public.group_start_requests set manager_done_at = null where id = p_id;
  else
    raise exception 'unknown action';
  end if;
end $$;

revoke all on function public.reg_start_request_trg() from public, anon, authenticated;
revoke all on function public.telegram_link_code() from public, anon;
revoke all on function public.telegram_unlink() from public, anon;
revoke all on function public.start_request_mark(uuid, text) from public, anon;
grant execute on function public.telegram_link_code() to authenticated;
grant execute on function public.telegram_unlink() to authenticated;
grant execute on function public.start_request_mark(uuid, text) to authenticated;
