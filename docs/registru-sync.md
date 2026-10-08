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
