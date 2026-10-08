-- ============================================================
-- Registre: datele fiecarui registru (nu ale unei grupe) si adaugarea de registre din consola.
--
--  - reg_workbooks primeste proiectul (din titlu: "EXAMEN.MD OFFLINE"), listele din CONFIGURARI (manageri, cabinete ...)
--    si datele profesorului: disponibilitate, ce preda, platile din "Total achitari". Le scrie functia registru-sync.
--  - reg_add_workbook / reg_update_workbook: adminul inregistreaza un registru (link sau id Google), il leaga de contul
--    unui profesor (owner_user_id) si il poate opri. Doar admin; nu se scrie direct in tabel din browser.
-- ============================================================

alter table public.reg_workbooks add column if not exists project text;
alter table public.reg_workbooks add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.reg_workbooks add column if not exists teacher_data jsonb not null default '{}'::jsonb;

-- "https://docs.google.com/spreadsheets/d/<id>/edit#gid=0" sau doar "<id>" -> "<id>"
create or replace function public.reg_spreadsheet_id(p text) returns text
language sql immutable as $$
  select coalesce(substring(trim(p) from '/d/([A-Za-z0-9_-]{20,})'), case when trim(p) ~ '^[A-Za-z0-9_-]{20,}$' then trim(p) end);
$$;

create or replace function public.reg_add_workbook(p_spreadsheet text, p_teacher text default null, p_owner uuid default null, p_year int default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id text := public.reg_spreadsheet_id(p_spreadsheet);
  v_row uuid;
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  if v_id is null then raise exception 'Linkul sau id-ul Google nu pare valid'; end if;
  insert into public.reg_workbooks (spreadsheet_id, teacher_name, owner_user_id, school_year_from)
  values (v_id, nullif(trim(p_teacher), ''), p_owner, p_year)
  on conflict (spreadsheet_id) do update set
    teacher_name = coalesce(nullif(trim(p_teacher), ''), public.reg_workbooks.teacher_name),
    owner_user_id = coalesce(p_owner, public.reg_workbooks.owner_user_id),
    school_year_from = coalesce(p_year, public.reg_workbooks.school_year_from),
    enabled = true
  returning id into v_row;
  return v_row;
end $$;

create or replace function public.reg_update_workbook(p_id uuid, p_enabled boolean default null, p_owner uuid default null, p_clear_owner boolean default false, p_year int default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  update public.reg_workbooks set
    enabled = coalesce(p_enabled, enabled),
    owner_user_id = case when p_clear_owner then null else coalesce(p_owner, owner_user_id) end,
    school_year_from = coalesce(p_year, school_year_from)
  where id = p_id;
end $$;

-- DROP+CREATE re-acorda EXECUTE lui anon: scoatem explicit, doar utilizatorii autentificati (si admin e verificat in functie)
revoke all on function public.reg_spreadsheet_id(text) from public, anon;
revoke all on function public.reg_add_workbook(text, text, uuid, int) from public, anon;
revoke all on function public.reg_update_workbook(uuid, boolean, uuid, boolean, int) from public, anon;
grant execute on function public.reg_spreadsheet_id(text) to authenticated;
grant execute on function public.reg_add_workbook(text, text, uuid, int) to authenticated;
grant execute on function public.reg_update_workbook(uuid, boolean, uuid, boolean, int) to authenticated;
