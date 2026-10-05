-- ============================================================
-- Shared demo state for the admin console and the teacher register.
--
-- Both pages (admin.html, registru.html) run on demo data generated in
-- the browser (js/admin/mock-data.js, js/admin/registru-data.js). What a
-- person changes on top of it (a presence mark, a date, a status, the
-- teacher's availability, ...) used to stay in that browser's
-- localStorage. This table keeps those changes in one place, so a
-- teacher on a tablet and an admin on a laptop see each other's edits
-- live (js/admin/demo-sync.js: upsert on save, Realtime on the way back).
--
-- One row per edited thing, key = "<section>/<id>":
--   groups/g080     patch of a group   (subject, grade, level, profile, size, status, ...)
--   students/s0123  patch of a student (status, manager)
--   teachers/t5     availability and what the teacher teaches
--   ledger/g080     the register of one group (marks, dates, topics, added or deleted lessons, price)
-- value is the same JSON the pages used to keep in localStorage.
--
-- DEMO ONLY: nothing here is real school data. Access is limited to the
-- two roles that use these pages (admin, and approved teachers); students
-- and guests cannot read or write it. When the real tables exist, the
-- pages stop using this one and it can be dropped.
-- ============================================================

create table if not exists public.demo_state (
  key        text primary key,
  value      jsonb not null,
  client     text,                                   -- which open page wrote it (a page ignores its own echo)
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.demo_state enable row level security;

-- Tables get anon/authenticated grants by default; this one is for signed-in staff only.
revoke all on public.demo_state from anon;
grant select, insert, update, delete on public.demo_state to authenticated;

drop policy if exists demo_state_staff_all on public.demo_state;
create policy demo_state_staff_all on public.demo_state for all to authenticated
  using (exists (
    select 1 from public.user_profiles up
    where up.user_id = auth.uid()
      and (up.role = 'admin' or (up.role = 'profesor' and up.status = 'active'))
  ))
  with check (exists (
    select 1 from public.user_profiles up
    where up.user_id = auth.uid()
      and (up.role = 'admin' or (up.role = 'profesor' and up.status = 'active'))
  ));

-- A DELETE event must carry the whole old row (the page reads old.client).
alter table public.demo_state replica identity full;

-- New tables are not in the Realtime publication by default (see 20260711090000).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'demo_state'
  ) then
    alter publication supabase_realtime add table public.demo_state;
  end if;
end $$;
