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

## 4. Citirea din registre (urmează, F1)

- Un apel `batchGet` pe tot registrul, apoi comparație cu starea din platformă.
- Apps Script (`onEdit`, trigger instalat) trimite un semnal la fiecare editare; peste el o citire completă la câteva minute prinde semnalele pierdute.
- Mai întâi trece prin validator (`run.js`). Erorile grave (coloană fără elev, persoană duplicată) opresc importul acelui registru și apar în raport.
- Datele fără an: coloană ascunsă cu data reală, calculată de formulă; până atunci anul se deduce din succesiunea lecțiilor.

## 5. Unde rulează

Site-ul e servit static, cu handler-e `api/*.js`. Sincronizarea nu trebuie să ruleze în browser și nu are loc în `server.js`/`api/`, ci în **Supabase**, care e deja în proiect:
- **Edge Function** `registru-sync` (ca `send-class-push`): autentificare cu contul de serviciu Google, citire/scriere prin Sheets API;
- **pg_cron** (deja activ) o pornește periodic; Apps Script o cheamă pentru editări;
- cheia contului de serviciu stă în Supabase secrets, nu în repo și nu în browser;
- comenzile, rezultatele și jurnalul de sincronizări în tabele Postgres, cu RLS: profesorul își vede doar registrul, adminul pe toate.

## 6. Etape

- **F0 (făcut):** contractul de mai sus, planificarea și aplicarea comenzilor, testate pe un registru în memorie (`npm run check:sync`).
- **F1:** contul de serviciu, citirea registrelor reale în tabele Supabase, jurnal și pagina de stare în admin.
- **F2:** comenzile din Înscriere/Transfer/Plăți ajung în Sheets prin coadă.
- **F3:** semnale în timp real (Apps Script), monitorizare, alerte.
