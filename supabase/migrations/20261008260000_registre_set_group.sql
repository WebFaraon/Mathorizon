-- ============================================================
-- Registre: comanda SET_GROUP (starea grupei si orarul ei, scrise din consola in fila grupei).
--
-- Starea e celula A3 a filei, orarul e AA2:AC7 (zi, ora, cabinet). Functia registru-apply scrie doar daca
-- persoana a vazut valorile curente din registru (payload.expect), altfel comanda se opreste cu "conflict".
-- Functia reg_enqueue_command ramane cea din migratia NEW_GROUP (o grupa existenta, workbook + sheet).
-- ============================================================

alter table public.reg_commands drop constraint if exists reg_commands_type_check;
alter table public.reg_commands add constraint reg_commands_type_check
  check (type in ('ADD_STUDENT', 'SET_STATUS', 'SET_MANAGER', 'ADD_PAYMENT', 'ADD_DISCOUNT', 'TRANSFER', 'NEW_GROUP', 'SET_GROUP'));
