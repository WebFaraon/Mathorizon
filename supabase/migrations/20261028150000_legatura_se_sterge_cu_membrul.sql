-- Cand un elev iese din clasa (sau e scos), legatura lui cu numele din registru dispare si ea.
--
-- Gasit la proba pe productie (2026-10-28): elevul a iesit din clasa, dar randul din class_member_links a ramas. Un rand orfan tine numele din registru
-- "ocupat": lista profesorului nu il mai oferea, iar legarea lui la alt cont dadea "deja legat de alt cont".

create or replace function public.class_members_drop_link() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.class_member_links where class_id = old.class_id and student_id = old.student_id;
  return old;
end $$;

revoke all on function public.class_members_drop_link() from public, anon, authenticated;

drop trigger if exists class_members_drop_link on public.class_members;
create trigger class_members_drop_link after delete on public.class_members
  for each row execute function public.class_members_drop_link();

-- legaturile orfane de pana acum
delete from public.class_member_links l
where not exists (select 1 from public.class_members m where m.class_id = l.class_id and m.student_id = l.student_id);
