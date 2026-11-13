-- Greșelile mele: exercițiile la care elevul a răspuns greșit în Antrenament
-- și pe care nu le-a rezolvat încă corect. Un rând per elev și exercițiu.
-- Se șterge când elevul răspunde corect.

create table if not exists public.user_mistakes (
  user_id     uuid   not null references auth.users(id) on delete cascade,
  exercise_id text   not null check (char_length(exercise_id) between 1 and 120),
  wrong_count integer not null default 1 check (wrong_count between 1 and 100000),
  last_at     bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (user_id, exercise_id)
);

alter table public.user_mistakes enable row level security;

drop policy if exists user_mistakes_select on public.user_mistakes;
create policy user_mistakes_select on public.user_mistakes for select to authenticated using (user_id = auth.uid());

drop policy if exists user_mistakes_insert on public.user_mistakes;
create policy user_mistakes_insert on public.user_mistakes for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_mistakes_update on public.user_mistakes;
create policy user_mistakes_update on public.user_mistakes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_mistakes_delete on public.user_mistakes;
create policy user_mistakes_delete on public.user_mistakes for delete to authenticated using (user_id = auth.uid());

revoke all on public.user_mistakes from anon, public;
grant select, insert, update, delete on public.user_mistakes to authenticated;

-- ------------------------------------------------------------
-- Verificare după rulare: trebuie să returneze ZERO rânduri
-- (anon nu are voie să atingă tabelul)
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'user_mistakes' and grantee in ('anon', 'PUBLIC');
-- ------------------------------------------------------------
