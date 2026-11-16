-- Tabla live: o tabla nu se poate incheia daca o alta tabla deja incheiata din aceeasi clasa are aceeasi denumire
-- (fara a tine cont de majuscule sau de spatii in plus). Tablele vechi cu denumiri identice raman cum sunt:
-- regula se verifica doar in clipa in care o tabla trece in "ended" sau isi schimba denumirea dupa ce e incheiata.
-- Site-ul verifica la fel inainte si cere o denumire noua; aceasta este plasa de siguranta din baza de date.

create or replace function public.whiteboard_title_unique()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'ended'
     and (tg_op = 'INSERT' or old.status is distinct from 'ended' or new.title is distinct from old.title) then
    if exists (
      select 1 from public.whiteboard_sessions s
      where s.class_id = new.class_id
        and s.status = 'ended'
        and s.id <> new.id
        and lower(btrim(regexp_replace(s.title, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(new.title, '\s+', ' ', 'g')))
    ) then
      raise exception 'whiteboard_title_taken' using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.whiteboard_title_unique() from public, anon, authenticated;

drop trigger if exists whiteboard_title_unique on public.whiteboard_sessions;
create trigger whiteboard_title_unique
  before insert or update on public.whiteboard_sessions
  for each row execute function public.whiteboard_title_unique();

-- Verificare (dupa rulare): functia nu trebuie sa fie apelabila de anon; trebuie sa nu intoarca niciun rand.
-- select grantee, privilege_type from information_schema.routine_privileges
--  where routine_schema = 'public' and routine_name = 'whiteboard_title_unique' and grantee in ('anon', 'authenticated', 'PUBLIC');
