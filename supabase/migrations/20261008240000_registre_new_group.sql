-- ============================================================
-- Registre: comanda NEW_GROUP (o grupa noua = o fila noua in registrul profesorului, completata, cu primul elev).
--
-- Comanda se pune pe REGISTRU (workbook_id), nu pe o grupa: fila nu exista inca, deci sheet_id = 0.
-- Functia registru-apply duplica fila-sablon ("Orar 1" sau o grupa existenta), o curata, o completeaza, o trece in lista
-- din "Total achitari" si scrie primul elev; daca scrierea esueaza, fila noua se sterge la loc.
-- ============================================================

alter table public.reg_commands drop constraint if exists reg_commands_type_check;
alter table public.reg_commands add constraint reg_commands_type_check
  check (type in ('ADD_STUDENT', 'SET_STATUS', 'SET_MANAGER', 'ADD_PAYMENT', 'ADD_DISCOUNT', 'TRANSFER', 'NEW_GROUP'));

create or replace function public.reg_enqueue_command(p_workbook uuid, p_sheet bigint, p_type text, p_payload jsonb, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if not public.reg_can_write() then raise exception 'not authorized'; end if;
  if p_type = 'NEW_GROUP' then
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
  insert into public.reg_commands (id, workbook_id, sheet_id, type, payload, created_by)
  values (v_id, p_workbook, p_sheet, p_type, coalesce(p_payload, '{}'::jsonb), auth.uid())
  on conflict (id) do nothing;
  return v_id;
end $$;

-- CREATE OR REPLACE pastreaza drepturile, dar le reafirmam: doar utilizatorii autentificati (adminul e verificat in functie)
revoke all on function public.reg_enqueue_command(uuid, bigint, text, jsonb, uuid) from public, anon;
grant execute on function public.reg_enqueue_command(uuid, bigint, text, jsonb, uuid) to authenticated;
