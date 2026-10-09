-- ============================================================
-- Consola: capacitatea cabinetelor (cate locuri are fiecare).
--
-- Registrele spun doar numarul cabinetului (coloana AC din orarul filei), nu cate locuri are. Capacitatea o completeaza adminul o data,
-- din consola (fereastra "Cabinete"), si o folosesc alegerea cabinetului la o grupa noua si verificarile de capacitate din Repartizare.
-- Citire: orice admin. Scriere: doar prin functia de mai jos (verifica adminul).
-- ============================================================

create table if not exists public.console_rooms (
  num        int primary key check (num between 1 and 999),
  seats      int not null check (seats between 1 and 60),
  floor      int check (floor between 0 and 20),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.console_rooms enable row level security;

drop policy if exists console_rooms_read on public.console_rooms;
create policy console_rooms_read on public.console_rooms for select to authenticated using (public.reg_is_admin());

revoke all on public.console_rooms from anon, authenticated;
grant select on public.console_rooms to authenticated;

-- p_seats null = sterge setarea (cabinetul revine la valoarea implicita)
create or replace function public.console_set_room(p_num int, p_seats int, p_floor int default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.reg_is_admin() then raise exception 'not authorized'; end if;
  if p_seats is null then
    delete from public.console_rooms where num = p_num;
  else
    insert into public.console_rooms (num, seats, floor, updated_at, updated_by) values (p_num, p_seats, p_floor, now(), auth.uid())
    on conflict (num) do update set seats = excluded.seats, floor = excluded.floor, updated_at = now(), updated_by = auth.uid();
  end if;
end $$;

-- functie noua: dar reafirmam drepturile (doar utilizatorii autentificati; adminul e verificat in functie)
revoke all on function public.console_set_room(int, int, int) from public, anon;
grant execute on function public.console_set_room(int, int, int) to authenticated;
