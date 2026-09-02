-- Waitlist signups from the public landing page. Currently only "Clasa a
-- 9-a" uses this (source of "9" as the sole clasa value in practice), but
-- the schema is generic (clasa, sursa) so a future landing section can
-- reuse the same table instead of each inventing its own.

create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  clasa      text not null,
  sursa      text not null default 'landing',
  ip         text,
  created_at timestamptz not null default now(),
  unique (email, clasa)
);

create index if not exists waitlist_ip_created_at_idx
  on public.waitlist (ip, created_at);

-- RLS on with zero policies — nobody reaches this table through the public
-- anon/authenticated PostgREST API at all. Only the service-role key (used
-- server-side by api/waitlist/join.js to write and api/admin/get-waitlist.js
-- to read, mirroring how api/auth/register-username.js already uses the
-- service role for an operation the client can't be trusted to do itself)
-- can touch it — that key bypasses RLS entirely, so no policy is needed
-- for those two routes to work.
alter table public.waitlist enable row level security;
