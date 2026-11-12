-- ============================================================
-- Parcurs: progresul elevului (ce lecții a terminat)
--
-- Un rând pe lecție terminată. lesson_id arată ca r7.s1.c2.l3 (clasa 7, secțiunea 1, cerculețul 2, lecția 3),
-- r7.s1.test (testul secțiunii) sau r7.s1.c1.l1 marcat via = 'skip' (secțiune trecută prin testul de nivel).
-- Fiecare elev vede și scrie doar propriile rânduri (RLS). XP-ul se adaugă separat, prin training_stats, ca la Antrenament.
-- Până rulează această migrare, Parcursul păstrează progresul doar în browser.
-- ============================================================

create table if not exists public.parcurs_progress (
  user_id   uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null check (lesson_id ~ '^[a-z0-9_.]{3,60}$'),
  best_pct  smallint not null default 0 check (best_pct between 0 and 100),
  plays     integer  not null default 1 check (plays between 0 and 100000),
  xp        integer  not null default 0 check (xp between 0 and 500),
  via       text     not null default 'lesson' check (via in ('lesson', 'skip')),
  done_at   timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.parcurs_progress enable row level security;

drop policy if exists parcurs_progress_select on public.parcurs_progress;
create policy parcurs_progress_select on public.parcurs_progress for select to authenticated using (user_id = auth.uid());

drop policy if exists parcurs_progress_insert on public.parcurs_progress;
create policy parcurs_progress_insert on public.parcurs_progress for insert to authenticated with check (user_id = auth.uid());

drop policy if exists parcurs_progress_update on public.parcurs_progress;
create policy parcurs_progress_update on public.parcurs_progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.parcurs_progress from anon, public;
grant select, insert, update on public.parcurs_progress to authenticated;

-- ------------------------------------------------------------
-- Verificare după rulare: trebuie să returneze ZERO rânduri
-- (anon nu are voie să atingă tabelul)
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'parcurs_progress' and grantee in ('anon', 'PUBLIC');
-- ------------------------------------------------------------
