# Sincronizarea platformă ⇄ registrele Google Sheets

Scop: aceleași registre (aceleași file, culori, formule), legate de platformă fără erori tăcute. Nu promitem zero erori, promitem că **orice nepotrivire se oprește și se raportează**, nu se scrie peste date.

## 1. Cine deține ce

| Zonă din fila unei grupe | Proprietar | Cine o schimbă |
|---|---|---|
| Rândurile 2, 5, 6 și coloana C (sold, cost, efectuate/disponibile, plata lecției) | **Sheets** (formulele) | nimeni; platforma doar citește. Formula din `registru-data.js` e doar test de control. |
| Prezențe (D9:Z198), data și tema lecției (A, B), nivelul profesorului (AA) | **Sheets**, profesorul | profesorul |
| Rândul 3 Achitări, rândul 4 Reduceri | **platforma sau Sheets** | managerii și adminul (nu profesorii) |
| Rândul 1 antet elev, rândul 7 manager, rândul 8 statut | **platforma sau Sheets** | managerii și adminul |
| A1 format, A3–A7 starea, materia, clasa, nivelul, profilul; AA2:AC7 orarul | **Sheets** la început | adminul |

Cine scrie în aceeași celulă din două părți trece prin aceeași poartă (secțiunea 3): se verifică valoarea veche, nu se suprascrie nimic schimbat între timp.

## 2. Identități stabile

Numele filei se schimbă și se taie la 31 de caractere, numele elevului se scrie în mai multe feluri. De aceea:
- fiecare registru, filă și coloană de elev primește un id în **metadatele ascunse** ale Google Sheets (developer metadata), care supraviețuiesc redenumirilor și mutării coloanelor;
- până atunci (fișiere `.xlsx`), elevul se găsește după telefon și nume, iar dacă sunt mai mulți sau niciunul comanda e refuzată (`not-found`).

## 3. Scrierea din platformă (implementată, `scripts/registru-import/sync/`)

Platforma nu scrie direct. Pune o **comandă** (`ADD_STUDENT`, `SET_STATUS`, `SET_MANAGER`, `ADD_PAYMENT`, `ADD_DISCOUNT`), cu un id unic. Pentru fiecare comandă:

1. `plan()` (commands.js) spune exact ce celule scrie și ce valoare trebuie să aibă fiecare acum (`expect`). Validează: nume, telefon +373, statut și manager din listele din CONFIGURARI, elev duplicat, grupă plină, coloană liberă.
2. `apply()` (apply.js) recitește celulele chiar înainte de scriere. Dacă una e diferită → `conflict`, nu scrie nimic.
3. Scrie, citește înapoi și verifică. O scriere pierdută sau blocată → `failed / verify-failed`.
4. Rezultatul se ține sub id-ul comenzii: aceeași comandă reluată nu scrie a doua oară.

Rezultate: `done`, `noop`, `invalid` (nimic scris), `conflict` (nimic scris), `failed`.
Reguli: o coloană cu prezențe, dar fără antet, nu se refolosește niciodată; o plată e un termen în plus în `SUM(...)` (`=SUM(1216-608)` → `=SUM(1216-608+300)`), iar o celulă cu text („h”) cere un om.

**Limită cunoscută:** Google Sheets nu are „scrie doar dacă valoarea e încă X”. Între recitirea de la pasul 2 și scriere rămâne o fereastră de câteva milisecunde. Pasul 3 prinde ce nu s-a scris, dar nu poate prinde o editare făcută de om exact în acea fereastră. Se reduce prin scrieri mici (câteva celule, un singur apel) și prin faptul că proprietarii zonelor sunt diferiți.

## 4. Citirea din registre (F1, scrisă și testată)

- Funcția edge `registru-sync` (`supabase/functions/registru-sync/`) și motorul comun (`supabase/functions/_shared/registru/`): `google.mjs` (login cu contul de serviciu și citire), `parse.mjs` (același parser ca importerul), `sync-core.mjs` (hash pe grupă, înlocuire, curățare). Aceleași fișiere rulează în Node (teste) și în Deno (funcția).
- Pentru fiecare registru: o verificare ușoară a datei ultimei modificări (Drive). Dacă fișierul nu s-a schimbat și ultima citire completă e de sub o zi, **nu se citește nimic din Sheets**. Altfel, o singură citire pentru toate filele de grup.
- Fiecare grupă schimbată se înlocuiește **întreagă și în tranzacție** (`reg_apply_group`), deci nu rămâne niciodată pe jumătate scrisă. O grupă neschimbată nu se rescrie (hash).
- Protecții: o grupă cu format necunoscut nu se salvează (rămâne copia veche) și apare ca „oprită”; un registru care deodată nu arată nicio grupă face ca rularea să eșueze și nu șterge nimic; fila ștearsă din registru iese din platformă; limita Google pe minut oprește rularea, iar următoarea continuă cu registrul care așteaptă cel mai mult.
- Anul lecțiilor: se ia din titlul fișierului („… 2025-2026”) sau din `reg_workbooks.school_year_from`.
- Tabele: `reg_workbooks`, `reg_groups`, `reg_students`, `reg_lessons`, `reg_sync_runs` (migrația `20261008120000_registre_sync.sql`). Adminul vede tot, un profesor doar registrul pe care îl deține; scrie doar funcția (service role).
- Verificat pe cele 27 de registre demo: 196 de grupe, 476 de coloane de elevi, 3.788 de lecții citite și comparate cu consola, 0 diferențe; a doua trecere nu face nicio citire din Sheets (`scripts/registru-import/google/sync-local.js --twice`).

### Punerea în funcțiune (o singură dată)

1. **SQL Editor** în Supabase: rulează conținutul `supabase/migrations/20261008120000_registre_sync.sql`.
2. Înregistrează registrele: `node scripts/registru-import/google/seed-sql.js`, apoi rulează `_import/demo/seed-workbooks.sql` în SQL Editor.
3. **Secrete** (Edge Functions → Secrets, sau CLI): `GOOGLE_SA_KEY` (tot conținutul `_import/google-service-account.json`) și `REG_SYNC_SECRET` (un șir lung, aleator).
4. **Deploy** din folderul proiectului: `npx supabase login`, apoi `npx supabase functions deploy registru-sync --project-ref tfflpivehrrzmklvcyhe`.
5. **Cron** (SQL Editor, cu secretul tău în loc de `<SECRET>`):
   `select cron.schedule('registru-sync', '*/10 * * * *', $$ select net.http_post(url := 'https://tfflpivehrrzmklvcyhe.supabase.co/functions/v1/registru-sync', headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', '<SECRET>'), body := '{}'::jsonb) $$);`

Cota Google: 60 de citiri pe minut pe proiect. Fără verificarea datei, 27 de registre citite la fiecare 10 minute ar depăși-o; cu ea, doar registrele schimbate se citesc.

## 5. Unde rulează

Site-ul e servit static, cu handler-e `api/*.js`. Sincronizarea nu trebuie să ruleze în browser și nu are loc în `server.js`/`api/`, ci în **Supabase**, care e deja în proiect:
- **Edge Function** `registru-sync` (ca `send-class-push`): autentificare cu contul de serviciu Google, citire/scriere prin Sheets API;
- **pg_cron** (deja activ) o pornește periodic; Apps Script o cheamă pentru editări;
- cheia contului de serviciu stă în Supabase secrets, nu în repo și nu în browser;
- comenzile, rezultatele și jurnalul de sincronizări în tabele Postgres, cu RLS: profesorul își vede doar registrul, adminul pe toate.

## 6. Etape

- **F0 (făcut):** contractul de mai sus, planificarea și aplicarea comenzilor, testate pe un registru în memorie (`npm run check:sync`).
- **F1 (scris, de pus în funcțiune):** citirea registrelor în tabele Supabase, jurnal de rulări. Rămâne pagina de stare în admin.
- **F2:** comenzile din Înscriere/Transfer/Plăți ajung în Sheets prin coadă.
- **F3:** semnale în timp real (Apps Script), monitorizare, alerte.

## 7. Trecerea pe date reale (listă de control)

Ce e făcut: citirea registrelor în tabele, pagina Sincronizare (stare, probleme cu link la celulă, adăugare registru, legare de contul unui profesor), comutatorul **Demo | Registre** în consolă (doar citire; verificat că arată exact ca demo-ul pe cele 27 de registre demo: `npm run check:registry`).

De făcut o singură dată, în ordine:
1. **SQL Editor:** rulează `supabase/migrations/20261008180000_registre_sync_teacher.sql` (coloanele noi și funcțiile pentru adăugarea registrelor).
2. **Deploy** funcția (citește acum și filele generale, rulează verificările, deduce anul din succesiunea lecțiilor): `npx supabase functions deploy registru-sync --project-ref tfflpivehrrzmklvcyhe --use-api --no-verify-jwt`.
3. Pentru fiecare registru real: partajează-l cu `registre-sync@mathorizon-registre.iam.gserviceaccount.com` ca **Cititor**, apoi în Admin → Sincronizare → **Adaugă registru** (link, profesor, contul lui, anul școlar). Registrele demo se pot opri din **Setări** când nu mai sunt necesare.
4. Citește **De reparat / De verificat** din fiecare registru; repară în Sheets (nu în platformă). Înainte să schimbi o filă: fără redenumiri de file, fără inserări sau ștergeri de rânduri și coloane (fișierele confidențiale ale adminului citesc din registre).
5. Comută pe **Registre** și compară cu ce știi.

Ce nu se poate deduce din registre (de știut): telefonul profesorului, locurile dintr-un cabinet (se presupun 8), proiectul unei grupe (vine din titlul fișierului: OFFLINE, ONLINE), data unui transfer (prima lecție în grupa nouă), anul lecțiilor (din titlu și din succesiunea rândurilor: un registru acoperă un an școlar). Un rând de orar fără zi și oră lasă grupa fără orar în consolă. Aceleași reguli se aplică și când registrele devin sursa pentru scriere (F2).

## 8. Scrierea din platformă (F2, scrisă și testată; de pus în funcțiune)

- **Coada:** `reg_commands` (migrația `20261008200000_registre_commands.sql`). Consola pune o comandă prin `reg_enqueue_command` (azi doar adminul: `reg_can_write()` e locul unde se adaugă managerii), apoi cheamă funcția **`registru-apply`**, care o aplică în Sheets: o ia din coadă (o singură rulare per comandă), o planifică pe fila live, **recitește celulele chiar înainte de scriere**, scrie, citește înapoi și păstrează rezultatul: `done`, `noop`, `invalid`, `conflict`, `failed`. Apoi consola cere `registru-sync` pentru acel registru și își reîncarcă datele.
- **Comenzi:** adaugă elev (primul loc liber, `Oră de probă`), schimbă statutul sau managerul, adaugă o plată sau o reducere (un termen în plus în `SUM(...)`). Aceleași reguli ca la secțiunea 3: nu se suprascrie nimic schimbat între timp, o coloană cu prezențe și fără antet nu se refolosește, un text în celula plății cere un om.
- **În consolă, azi:** Înscriere într-o **grupă existentă** scrie în registru (dialogul arată coloana și un link la celulă). În pagina **Elevi**, fișa unui elev (modul Registre) are secțiunea **„În registru”**: schimbă statutul și managerul și adaugă o plată, o reducere sau un retur în coloana lui din grupa curentă. Elevul se găsește după număr de coloană și se verifică antetul (nume și telefon): o coloană mutată sau înlocuită e refuzată. Grupele noi și transferul urmează; pagina Sincronizare arată „Scrieri recente” cu rezultatul fiecărei comenzi.
- **Contul de serviciu trebuie să fie EDITOR al registrului** ca să scrie (pentru citire a fost destul Cititor). Registrele demo sunt deja în folderul partajat ca Editor.
- **Verificat:** 63 de teste (în memorie și prin adaptorul asincron) și un test pe un registru demo real din Google: adaugă elev, îl citește înapoi parserul, duplicatul e refuzat, plată și retur, conflict de statut, celulele puse la loc (`node scripts/registru-import/google/apply-local.js`).

Punerea în funcțiune: (1) SQL Editor: rulează `20261008200000_registre_commands.sql`; (2) `npx supabase functions deploy registru-apply --project-ref tfflpivehrrzmklvcyhe --use-api --no-verify-jwt`; (3) redeploy la `registru-sync` (a primit verificările și datele profesorului); (4) la registrele reale: partajează cu contul de serviciu ca Editor.

## 9. Cât de repede apare o schimbare din registru în consolă

Sheets → baza de date: cron-ul (`registru-sync`, azi la 10 minute; se poate pune la un minut, verificarea datei fișierului e ușoară) sau butonul „Sincronizează acum” din pagina Sincronizare.
Baza de date → consola deschisă (modul Registre): **singură**, la 45 de secunde. Consola întreabă (un apel mic) care e cea mai nouă citire a oricărui registru și, dacă e mai nouă decât datele de pe ecran și nimeni nu scrie într-un câmp sau n-are o fereastră deschisă, își încarcă datele noi. Butonul de pe insigna verde „Registre” face același lucru imediat.
Sub o secundă-două ar fi nevoie de un declanșator în Google (Apps Script, la fiecare editare): urmează.

## 10. Transferul între grupe (F2b, scris și testat; de pus în funcțiune)

- **Comanda `TRANSFER`** (migrația `20261008220000_registre_transfer.sql`): se pune pe grupa veche, iar grupa nouă e în payload (`toWorkbook`, `toSheet`); grupele pot fi în registre diferite. Banii se împart cu formulele din Calculator (`splitMoney` în `pay.mjs`, copia consolei e comparată în `check:registry`): A = achitări, R = reduceri, C = costul lecțiilor din coloana veche (celula 5, calculată de registru); rămâne în grupa veche C împărțit după greutatea A și R, trece restul, iar dacă C > A + R datoria rămâne în grupa veche și nu trece nimic.
- **Două faze, în ordinea sigură:** (1) grupa nouă: coloana elevului cu antet, manager, statut și suma care trece (`SUM(...)`) la achitări și reduceri; (2) grupa veche: statut `Transferat` și suma trecută scoasă ca un termen minus în `SUM(...)` (ce s-a tastat rămâne; coloana veche ajunge la sold 0 sau la datorie). Fiecare fază se scrie **atomic** în registrul ei (un singur `spreadsheets.batchUpdate`, deci și textele cu „+373...” rămân text).
- **Siguranță:** împărțirea se calculează în funcție din celulele registrului, nu din ce trimite consola; consola trimite doar ce a arătat pe ecran (`expect`) și o diferență e refuzată (`stale-money`); fiecare fază recitește celulele chiar înainte și le verifică după; un elev deja în grupa nouă cu alte sume e refuzat (`mismatch`); inactiv, grupă plină, text în celula plății sau coloană care nu mai e a lui sunt refuzate.
- **Dacă faza 2 eșuează:** rezultatul e `failed / half-done` (elevul e în ambele grupe), iar aceeași comandă reîncercată găsește coloana nouă cu sumele corecte și face doar faza 2 (nu se dublează nimic). Dialogul de transfer arată eroarea și permite „Reîncearcă”. Nu există anulare: o greșeală se corectează în registru.
- **Verificat:** 85 de teste în memorie (două registre, un registru cu două file, eșec simulat în faza 2, refuzurile, cazul cu datorie) și un test pe **două registre demo reale din Google** (`node scripts/registru-import/google/transfer-local.js`: 5.760 rămân, 860 trec, celulele puse la loc).

Punerea în funcțiune: (1) SQL Editor: `20261008220000_registre_transfer.sql`; (2) deploy la `registru-apply` și `registru-sync` (cod comun schimbat), cu aceleași comenzi ca la secțiunea 8; (3) la registrele reale, contul de serviciu trebuie să fie Editor în **ambele** registre ale unui transfer.

După o scriere din consolă se cere o citire **forțată** a registrului respectiv (`force: true`, doar cu `workbook_id`): data ultimei modificări a fișierului poate rămâne veche câteva secunde după o scriere prin API, iar fără forțare citirea ar fi fost sărită și datele noi ar fi apărut abia după următoarea rulare a cron-ului (1–2 minute). La fel face butonul „Sincronizează” de pe un rând din pagina Sincronizare.

## 11. Grupe noi din Înscriere (F2c, scris și testat; de pus în funcțiune)

- **Comanda `NEW_GROUP`** (migrația `20261008240000_registre_new_group.sql`, pusă pe REGISTRU, `sheet_id = 0`): în registrul profesorului se creează o filă nouă, completată, cu primul elev. Planul e în `supabase/functions/_shared/registru/newgroup.mjs`, aplicarea în `applyNewGroupAsync` (`apply.mjs`).
- **Pașii:** (1) se alege șablonul: fila „Orar 1” a registrului, iar dacă nu există, ultima filă de grupă vizibilă (după A1 „Grup…”/„Individual…”); (2) se validează TOT înainte să se creeze ceva (format 1/2/3/4/5/6/8, materie și nivel din listele din CONFIGURARI, clasă, profil la liceu, orar de cel mult 6 ore pe săptămână, cabinet din listă, nivelul profesorului 1–6, loc liber în lista din „Total achitări” F4:AI4, și primul elev verificat ca la o înscriere); (3) fila se **duplică** (rămân culorile, chip-urile, validările și formulele); (4) într-o singură cerere atomică se **curăță** (A9:B198, D1:Z1, D7:Z8, D9:Z198, AA2:AC7) și se **completează**: A1 format, A3 stare „Se completează”, A4 materie („(Vara)” la vară), A5 clasă, A6 nivel („4 ― 5”), A7 profil, orarul AA2:AC7 pe ore, „Nivelul Profesorului N” pe AA9:AA198, plățile D3:Z4 înapoi la `sum(0)`, și numele filei în prima celulă liberă din „Total achitări”; (5) se citește înapoi; dacă ceva nu merge, **fila nouă se șterge la loc** și nu rămâne nimic; (6) apoi se scrie elevul ca la orice înscriere (dacă doar el eșuează, grupa rămâne și răspunsul o spune).
- **Numele filei:** ca orarul, „Luni/Miercuri 12:00-13:00” (+ „ (Vara)”, + „ (2)” dacă există deja).
- **În consolă:** în Înscriere → Grupă nouă → „Creează grupa și înscrie elevul”, în modul Registre, scrie în registru și arată fila creată, coloana elevului și un link la ea. Profesorul trebuie să aibă registru legat (`D.teacher(id)._wb`).
- **Verificat:** 24 de teste noi în memorie (șablon „Orar 1”, șablon copiat dintr-o grupă existentă și curățat, nume duplicate, Total plin, fără Total, eșec la scriere cu ștergerea filei, 12 refuzuri) și un test pe **un registru demo real din Google** (`node scripts/registru-import/google/new-group-local.js`: fila creată, importerul o citește înapoi, formulele din „Total achitări” o citesc fără eroare, apoi fila ștearsă și lista din Total pusă la loc).

Punerea în funcțiune: (1) SQL Editor: `20261008240000_registre_new_group.sql`; (2) deploy la `registru-apply` și `registru-sync`; (3) contul de serviciu trebuie să fie Editor în registrul profesorului.
