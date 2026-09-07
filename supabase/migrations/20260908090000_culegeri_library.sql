-- ============================================================
-- "Culegeri" library: admin-uploaded scanned PDF textbooks, browsable by
-- approved teachers (role=profesor) and admin only — never students. Lets
-- teachers pick a page in-app (creating a simulation, assigning homework)
-- instead of hunting for the right file in a Telegram group each time.
--
-- Storage holds the PDF bytes (bucket 'culegeri', private); this table
-- holds the browsable metadata (title/grade/chapter + which storage object
-- it lives at). Only admin uploads (per product decision) — teachers get
-- read-only access to browse and open pages.
-- ============================================================

-- 200MB cap — these are full scanned textbooks (image-heavy pages, not
-- OCR'd text), routinely 100-300MB. Without an explicit file_size_limit
-- here the bucket falls back to the project's global Storage default
-- (commonly 50MB on the free tier), which would silently reject a
-- legitimate culegere. on conflict...do update so re-running this file
-- also raises the limit on a bucket that already exists from an earlier
-- apply of this same migration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('culegeri', 'culegeri', false, 209715200, array['application/pdf'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.culegeri (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  grade text not null check (grade in ('5','6','7','8','9','10','11','bac')),
  category_id text,
  file_path text not null,
  uploaded_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists culegeri_grade_idx on public.culegeri(grade);

alter table public.culegeri enable row level security;

drop policy if exists culegeri_select_teachers on public.culegeri;
create policy culegeri_select_teachers on public.culegeri
  for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role in ('admin', 'profesor')
    )
  );

drop policy if exists culegeri_admin_write on public.culegeri;
create policy culegeri_admin_write on public.culegeri
  for all to authenticated
  using (
    exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin')
  );

-- Storage: same split — teachers+admin can read the PDF bytes, only admin
-- can write/replace/delete them.
drop policy if exists culegeri_storage_select_teachers on storage.objects;
create policy culegeri_storage_select_teachers on storage.objects
  for select to authenticated
  using (
    bucket_id = 'culegeri'
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role in ('admin', 'profesor')
    )
  );

drop policy if exists culegeri_storage_admin_write on storage.objects;
create policy culegeri_storage_admin_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'culegeri'
    and exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin')
  )
  with check (
    bucket_id = 'culegeri'
    and exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin')
  );
