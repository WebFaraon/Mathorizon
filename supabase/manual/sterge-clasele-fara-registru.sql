-- Sterge clasele facute de mana de profesori (cele care NU vin dintr-o grupa din registru).
-- RULEAZA PE RAND, de sus in jos, in Supabase SQL. Nu face parte din migrari: sterge date.
--
-- Stergerea unei clase cascadeaza tot ce tine de ea: membrii (class_members), cererile de alaturare, mesajele, temele si predarile,
-- simularile si incercarile lor, tabla, sesiunile si prezentele din Catalog, abonarile la notificari. Nu se poate desface.

-- 1) Ce se sterge: lista claselor fara grupa din registru, cu numarul de elevi si de lectii din Catalog.
select c.id, c.name, c.teacher_name, c.created_at,
       (select count(*) from public.class_members m where m.class_id = c.id) as elevi,
       (select count(*) from public.class_sessions s where s.class_id = c.id) as lectii_in_catalog
from public.classes c
where c.reg_group_id is null
order by c.teacher_name, c.created_at;

-- 2) Daca lista e cea asteptata, sterge-le (decomenteaza doar liniile de mai jos).
-- begin;
--   delete from public.classes where reg_group_id is null;
-- commit;

-- 3) Verificare: trebuie sa ramana doar clasele legate de o grupa din registru.
-- select count(*) filter (where reg_group_id is null) as fara_registru, count(*) filter (where reg_group_id is not null) as din_registru from public.classes;
