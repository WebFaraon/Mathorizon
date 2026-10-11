-- ============================================================
-- Registre: "ce s-a schimbat ultima data" (pentru ca consola sa afle repede de o editare facuta in registru).
--
-- Pana acum consola intreba doar cand s-a facut ultima CITIRE COMPLETA a unui registru (last_full_sync_at). O citire a unei singure file
-- (cea pornita de scriptul Apps Script din registru, la fiecare editare) nu atingea acea coloana, deci consola nu o vedea pana la urmatoarea
-- citire completa. last_change_at se pune la ora la care citirea a gasit ceva schimbat (o fila sau un registru intreg).
-- ============================================================

alter table public.reg_workbooks add column if not exists last_change_at timestamptz;
create index if not exists reg_workbooks_change_idx on public.reg_workbooks (last_change_at desc nulls last);
