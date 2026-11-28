-- ============================================================
-- Curăță datele DEMO ale registrelor, înainte de a lega registrele reale.
--
-- CITEȘTE ÎNTÂI, apoi rulează în SQL Editor (Supabase). Rulează TOT fișierul
-- odată: are trei părți (1 = ce se va șterge, 2 = ștergerea, 3 = verificarea).
-- Ștergerea e într-o tranzacție: dacă ceva nu iese cum trebuie, nu se schimbă nimic.
--
-- Ce șterge (doar ce ține de registrele al căror titlu conține "(DEMO)"):
--   * cele 27 de registre demo, cu grupele, elevii, lecțiile, comenzile,
--     istoricul de sincronizare, înlocuirile și cererile de start (în cascadă);
--   * clasele create automat din grupele acelor registre (9 clase), cu tot ce
--     atârnă de ele: membri, mesaje, cereri de intrare, schimbări de lecții,
--     tablele live și ce s-a scris pe ele, notificările.
--
-- Ce NU atinge: conturile (elevi, profesori, manageri, admin), exercițiile,
-- progresul (XP, serie, lecții), legătura cu Telegram, cabinetele, setările.
--
-- Ordinea contează: întâi se șterg registrele demo din baza de date, abia apoi
-- fișierele demo din Google Drive. Altfel sincronizarea ar da erori.
--
-- Nu se poate anula. Dacă vrei o copie înainte: Supabase, Database, Backups
-- (planul Free nu are copii zilnice, deci nu te baza pe ea).
-- ============================================================

-- ---------- 1. CE SE VA ȘTERGE (doar citire) ----------
select 'registre demo'            as ce, count(*) as de_sters from reg_workbooks where title ilike '%(DEMO)%'
union all select 'registre care NU sunt demo (rămân)', count(*) from reg_workbooks where title not ilike '%(DEMO)%'
union all select 'grupe',            count(*) from reg_groups   g join reg_workbooks w on w.id = g.workbook_id where w.title ilike '%(DEMO)%'
union all select 'elevi din registre', count(*) from reg_students s join reg_groups g on g.id = s.group_id join reg_workbooks w on w.id = g.workbook_id where w.title ilike '%(DEMO)%'
union all select 'lecții din registre', count(*) from reg_lessons l join reg_groups g on g.id = l.group_id join reg_workbooks w on w.id = g.workbook_id where w.title ilike '%(DEMO)%'
union all select 'clase create din grupe demo', count(*) from classes c join reg_groups g on g.id = c.reg_group_id join reg_workbooks w on w.id = g.workbook_id where w.title ilike '%(DEMO)%'
union all select 'clase fără legătură cu un registru (rămân)', count(*) from classes where reg_group_id is null
union all select 'membri în clasele de șters', count(*) from class_members m join classes c on c.id = m.class_id join reg_groups g on g.id = c.reg_group_id join reg_workbooks w on w.id = g.workbook_id where w.title ilike '%(DEMO)%'
union all select 'table live în clasele de șters', count(*) from whiteboard_sessions s join classes c on c.id = s.class_id join reg_groups g on g.id = c.reg_group_id join reg_workbooks w on w.id = g.workbook_id where w.title ilike '%(DEMO)%'
union all select 'mesaje în clasele de șters', count(*) from class_posts p join classes c on c.id = p.class_id join reg_groups g on g.id = c.reg_group_id join reg_workbooks w on w.id = g.workbook_id where w.title ilike '%(DEMO)%';

-- ---------- 2. ȘTERGEREA ----------
begin;

-- Clasele întâi: legătura lor cu grupa (reg_group_id) s-ar pierde odată cu registrul.
delete from classes
where reg_group_id in (
  select g.id
  from reg_groups g
  join reg_workbooks w on w.id = g.workbook_id
  where w.title ilike '%(DEMO)%'
);

-- Registrele demo: grupele, elevii, lecțiile, comenzile, istoricul de sincronizare,
-- înlocuirile și cererile de start dispar în cascadă.
delete from reg_workbooks where title ilike '%(DEMO)%';

-- Plasă de siguranță: dacă a rămas ceva demo, anulează tot.
do $$
begin
  if exists (select 1 from reg_workbooks where title ilike '%(DEMO)%') then
    raise exception 'Au rămas registre demo, anulez.';
  end if;
  if exists (select 1 from reg_groups g where not exists (select 1 from reg_workbooks w where w.id = g.workbook_id)) then
    raise exception 'Grupe fără registru, anulez.';
  end if;
end $$;

commit;

-- ---------- 3. VERIFICARE (după ștergere totul trebuie să fie 0) ----------
select 'registre'            as tabel, count(*) as ramase from reg_workbooks
union all select 'grupe',               count(*) from reg_groups
union all select 'elevi din registre',  count(*) from reg_students
union all select 'lecții din registre', count(*) from reg_lessons
union all select 'comenzi',             count(*) from reg_commands
union all select 'istoric sincronizare', count(*) from reg_sync_runs
union all select 'înlocuiri',           count(*) from reg_replacements
union all select 'cereri de start',     count(*) from group_start_requests
union all select 'clase',               count(*) from classes;
