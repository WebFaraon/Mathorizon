-- Clasele vin doar din registru (cerut de utilizator, 2026-10-28).
--
-- Un profesor nu isi mai creeaza grupe: grupa o face managerul sau adminul in consola, ajunge in registrul profesorului, iar clasa de pe platforma
-- o face baza de date (20261015120000_registre_clase_automate.sql). Din client nu se mai poate insera in `classes`, indiferent de politicile RLS
-- vechi (care nu sunt in migrari). Functiile security definer (reg_class_sync_group) si service_role raman singurele care pot crea o clasa.
--
-- Clasele facute de mana pana acum (reg_group_id gol) NU sunt sterse aici: stergerea cascadeaza mesaje, teme, simulari, catalog si membri.
-- Se sterg cu scriptul de mana supabase/manual/sterge-clasele-fara-registru.sql, dupa ce vezi lista.

create or replace function public.classes_block_client_insert() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'Grupele se creează din registru, nu de către profesor.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists classes_block_client_insert on public.classes;
create trigger classes_block_client_insert before insert on public.classes
  for each row execute function public.classes_block_client_insert();

revoke all on function public.classes_block_client_insert() from public, anon, authenticated;
