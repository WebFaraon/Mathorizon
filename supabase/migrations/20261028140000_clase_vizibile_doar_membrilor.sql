-- `classes` nu mai poate fi citit de oricine e logat (2026-10-28).
--
-- Politica veche classes_select_auth (using auth.role() = 'authenticated') lasa ORICE cont logat sa citeasca TOATE clasele: nume, profesor, program si
-- codul de invitatie al fiecareia. Alte politici (de exemplu class_posts) se sprijina pe "exista clasa" si mostenesc aceeasi deschidere, pentru ca
-- subcererile din politici trec prin RLS-ul lui `classes`.
--
-- Acum o clasa o vad doar profesorul ei, membrii ei si adminul. Alaturarea nu mai are nevoie sa citeasca `classes`: se face prin request_join_class
-- (security definer), cu codul. Verificarea de membru e intr-o functie security definer ca sa nu apara recursie intre politicile lui `classes` si
-- ale lui `class_members` (class_members.members_select_teacher citeste la randul ei `classes`).

create or replace function public.is_class_member(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_members where class_id = p_class and student_id = auth.uid());
$$;

revoke all on function public.is_class_member(uuid) from public, anon;
grant execute on function public.is_class_member(uuid) to authenticated;

drop policy if exists classes_select_auth on public.classes;
drop policy if exists classes_select_scoped on public.classes;
create policy classes_select_scoped on public.classes for select to authenticated
  using (teacher_id = auth.uid() or public.is_class_member(id) or public.reg_is_admin());

-- politica veche prin care un elev se punea singur in clasa; trigger-ul class_members_block_direct_insert o oprea deja, o scoatem ca sa nu induca in eroare
drop policy if exists members_insert on public.class_members;
