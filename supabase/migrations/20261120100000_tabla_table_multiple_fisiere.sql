-- ============================================================
-- Tabla live: table separate (comuna + una privata pentru fiecare elev) si fisiere pe tabla.
--
-- 1. whiteboard_objects.board_owner: null = tabla comuna (o vad si scriu toti ai clasei),
--    altfel = tabla privata a elevului respectiv (o vede elevul si profesorul clasei; scriu ambii).
-- 2. Blocarea unui elev (whiteboard_participants.locked) se aplica doar tablei comune.
-- 3. Canalele Realtime private ale tablelor private (topic wbp:<sesiune>:<elev>): primesc si trimit doar
--    elevul respectiv si profesorul clasei (fara asta cineva care cunoaste id-urile ar putea asculta traseele "live").
-- 4. Biblioteca de fisiere a profesorului (wb_files) + bucketul privat wb-files (imagini si PDF-uri).
-- 5. Imaginile pot fi puse pe tabla: kind = 'image'.
--
-- Se ruleaza dupa 20261116100000. Fara ea tabla merge ca pana acum (doar comuna, fara fisiere).
-- ============================================================

-- ---------- 1: tablele ----------
alter table public.whiteboard_objects
  add column if not exists board_owner uuid references auth.users(id) on delete cascade;
create index if not exists whiteboard_objects_session_board_seq_idx
  on public.whiteboard_objects(session_id, board_owner, seq);

-- ---------- 5: tipul "image" ----------
alter table public.whiteboard_objects drop constraint if exists whiteboard_objects_kind_check;
alter table public.whiteboard_objects
  add constraint whiteboard_objects_kind_check check (kind in ('stroke', 'text', 'image'));

-- ---------- 1+2: cine vede si cine scrie ----------
drop policy if exists wb_objects_select on public.whiteboard_objects;
create policy wb_objects_select on public.whiteboard_objects for select to authenticated
  using (
    exists (select 1 from public.classes c where c.id = whiteboard_objects.class_id and c.teacher_id = auth.uid())
    or (
      whiteboard_objects.board_owner is null
      and exists (select 1 from public.class_members cm where cm.class_id = whiteboard_objects.class_id and cm.student_id = auth.uid())
    )
    or (
      whiteboard_objects.board_owner = auth.uid()
      and exists (select 1 from public.class_members cm where cm.class_id = whiteboard_objects.class_id and cm.student_id = auth.uid())
    )
  );

drop policy if exists wb_objects_insert on public.whiteboard_objects;
create policy wb_objects_insert on public.whiteboard_objects for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.whiteboard_sessions s
      where s.id = whiteboard_objects.session_id and s.status = 'live' and s.class_id = whiteboard_objects.class_id
    )
    and (
      -- tabla comuna: profesorul clasei sau un elev al clasei care nu e blocat
      (
        whiteboard_objects.board_owner is null
        and (
          exists (select 1 from public.classes c where c.id = whiteboard_objects.class_id and c.teacher_id = auth.uid())
          or (
            exists (select 1 from public.class_members cm where cm.class_id = whiteboard_objects.class_id and cm.student_id = auth.uid())
            and not coalesce((
              select p.locked from public.whiteboard_participants p
              where p.session_id = whiteboard_objects.session_id and p.user_id = auth.uid()
            ), false)
          )
        )
      )
      -- tabla privata: elevul pe a lui, sau profesorul pe a oricarui elev al clasei (blocarea nu se aplica aici)
      or (
        whiteboard_objects.board_owner is not null
        and exists (select 1 from public.class_members cm where cm.class_id = whiteboard_objects.class_id and cm.student_id = whiteboard_objects.board_owner)
        and (
          whiteboard_objects.board_owner = auth.uid()
          or exists (select 1 from public.classes c where c.id = whiteboard_objects.class_id and c.teacher_id = auth.uid())
        )
      )
    )
  );
-- stergerea si mutarea ramin: doar propriile obiecte (wb_objects_owner_delete, wb_objects_owner_update)

-- ---------- 3: canale Realtime private pentru tablele private ----------
create or replace function public.wb_topic_allowed(p_topic text)
returns boolean
security definer set search_path = public
language plpgsql stable as $$
declare
  v_parts   text[];
  v_session uuid;
  v_owner   uuid;
  v_class   uuid;
begin
  v_parts := string_to_array(p_topic, ':');
  if array_length(v_parts, 1) is distinct from 3 or v_parts[1] <> 'wbp' then return false; end if;
  begin
    v_session := v_parts[2]::uuid;
    v_owner   := v_parts[3]::uuid;
  exception when others then
    return false;
  end;
  select s.class_id into v_class from public.whiteboard_sessions s where s.id = v_session;
  if v_class is null then return false; end if;
  return exists (select 1 from public.classes c where c.id = v_class and c.teacher_id = auth.uid())
      or (v_owner = auth.uid()
          and exists (select 1 from public.class_members cm where cm.class_id = v_class and cm.student_id = auth.uid()));
end;
$$;
revoke execute on function public.wb_topic_allowed(text) from public, anon;
grant execute on function public.wb_topic_allowed(text) to authenticated;

drop policy if exists wb_rt_receive on realtime.messages;
create policy wb_rt_receive on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and public.wb_topic_allowed(realtime.topic()));

drop policy if exists wb_rt_send on realtime.messages;
create policy wb_rt_send on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and public.wb_topic_allowed(realtime.topic()));

-- ---------- 4: biblioteca de fisiere a profesorului ----------
create table if not exists public.wb_files (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('image', 'pdf')),
  mime       text,
  size       integer not null default 0,
  path       text not null,                 -- calea in bucketul wb-files: <profesor>/<fisier>
  pages      integer,                       -- doar PDF: numarul de pagini
  width      integer,                       -- doar imagine: dimensiunea originala
  height     integer,
  created_at timestamptz not null default now()
);
create index if not exists wb_files_owner_idx on public.wb_files(owner_id, created_at desc);
alter table public.wb_files enable row level security;

drop policy if exists wb_files_owner_select on public.wb_files;
create policy wb_files_owner_select on public.wb_files for select to authenticated using (owner_id = auth.uid());
drop policy if exists wb_files_owner_insert on public.wb_files;
create policy wb_files_owner_insert on public.wb_files for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.user_profiles up where up.user_id = auth.uid() and up.role in ('profesor', 'admin'))
  );
drop policy if exists wb_files_owner_delete on public.wb_files;
create policy wb_files_owner_delete on public.wb_files for delete to authenticated using (owner_id = auth.uid());

-- bucketul privat: fisierele se citesc prin adrese semnate, valabile putin timp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wb-files', 'wb-files', false, 26214400,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 26214400,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

drop policy if exists wb_files_storage_select on storage.objects;
create policy wb_files_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'wb-files' and (
    -- profesorul isi vede fisierele
    (storage.foldername(objects.name))[1] = auth.uid()::text
    -- orice participant vede imaginile aflate pe tablele pe care are voie sa le vada
    or exists (
      select 1 from public.whiteboard_objects o
      where o.kind = 'image'
        and o.fabric_json ->> 'src' = objects.name
        and (
          exists (select 1 from public.classes c where c.id = o.class_id and c.teacher_id = auth.uid())
          or (
            exists (select 1 from public.class_members cm where cm.class_id = o.class_id and cm.student_id = auth.uid())
            and (o.board_owner is null or o.board_owner = auth.uid())
          )
        )
    )
  ));

drop policy if exists wb_files_storage_insert on storage.objects;
create policy wb_files_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'wb-files'
  and (storage.foldername(objects.name))[1] = auth.uid()::text
  and exists (select 1 from public.user_profiles up where up.user_id = auth.uid() and up.role in ('profesor', 'admin'))
);

drop policy if exists wb_files_storage_update on storage.objects;
create policy wb_files_storage_update on storage.objects for update to authenticated using (
  bucket_id = 'wb-files' and (storage.foldername(objects.name))[1] = auth.uid()::text
) with check (
  bucket_id = 'wb-files' and (storage.foldername(objects.name))[1] = auth.uid()::text
);

drop policy if exists wb_files_storage_delete on storage.objects;
create policy wb_files_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'wb-files' and (storage.foldername(objects.name))[1] = auth.uid()::text
);

-- ------------------------------------------------------------
-- Verificare dupa rulare: trebuie sa returneze ZERO randuri
--
-- select p.proname
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname = 'wb_topic_allowed'
--   and has_function_privilege('anon', p.oid, 'execute');
--
-- select grantee, privilege_type from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'wb_files' and grantee = 'anon';
-- ------------------------------------------------------------
