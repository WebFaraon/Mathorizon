# Apps Script: registrele ajung în platformă în secunde

Până acum o editare dintr-un registru ajungea în platformă după cron-ul de un minut (plus până la 45 s până o vedea consola). Cu scriptul, o editare ajunge în baza de date în 2-3 secunde, iar consola o ia la cel mult 15 secunde după aceea. Banii unei înlocuiri se mută imediat după ce profesorul pune prezența.

## Cum merge

```
profesorul schimbă o celulă în registru
  -> declansatorul "la editare" al proiectului Apps Script (contul de administrare)
  -> UrlFetchApp: POST registru-sync, header x-hook-secret, { spreadsheet_id, sheet_id, tab }
  -> platforma citește DOAR acea filă din Google (cam 0,6 s), o scrie în baza de date, pune semnul „ultima schimbare" (reg_workbooks.last_change_at)
     și, dacă fila e o filă de înlocuire, pornește motorul de bani (registru-replace)
  -> consola întreabă la 15 s ce e nou (o interogare mică) și își reîncarcă datele
```

Dacă scriptul nu poate trimite, nu se pierde nimic: cron-ul citește oricum registrele (editările de formatare, filele noi și rândurile inserate se văd tot la cron, nu au nevoie de script).

**Un proiect separat, al contului de administrare, nu un script în fiecare registru.** Un script legat de un registru e vizibil oricărui editor al registrului, deci profesorii ar vedea cheia. Proiectul separat nu e partajat cu nimeni. Pe de altă parte contul care îl face trebuie să poată deschide fiecare registru (proprietar sau editor).

**Cheia are puteri minime.** `REG_HOOK_SECRET` nu e cheia cron-ului (`REG_SYNC_SECRET`). Cu ea platforma acceptă doar `{ spreadsheet_id, sheet_id, tab }` sau `{ spreadsheet_id, full: true }`: citește din nou un registru, atât. Orice alt câmp (un id de registru al nostru, o comandă) e refuzat cu 400 (`_shared/registru/hook.mjs`, testat în `check:sync`). O cheie scursă poate cel mult să pornească citiri inutile.

## Limite ale Google, care contează

- **20 de declansatoare per proiect**, unul pe registru: 27 de registre = 2 proiecte (`npm run apps-script:lists` împarte lista în liste de 20). Când adaugi registre, același lucru.
- **Timp de rulare al declansatoarelor: 90 min/zi cont personal, 6 h/zi Google Workspace.** Scriptul ține executiile scurte: prima editare dintr-o filă pleacă imediat; cele din următoarele 3 secunde se adună într-o singură cerere (o execuție care doarme, celelalte ies pe loc).
- **Apeluri externe:** 20.000/zi cont personal, 100.000 Workspace: de ajuns.
- Editările făcute prin API (consola noastră) nu pornesc declansatorul: nici nu e nevoie, consola citește singură fila după fiecare scriere a ei.

## Punerea în funcțiune (o singură dată)

1. **Migrația** `supabase/migrations/20261011100000_registre_change_stamp.sql` în SQL Editor (adaugă `reg_workbooks.last_change_at`). Fără ea totul merge, dar consola nu vede editările din registru decât la citirea completă.
2. **Cheia:** `npm run apps-script:lists` face cheia în `_import/reg-hook-secret.txt` (rămâne local, în afara git) și scrie listele de registre. Pune cheia în Supabase:
   ```
   npx supabase secrets set REG_HOOK_SECRET=<valoarea din _import/reg-hook-secret.txt> --project-ref tfflpivehrrzmklvcyhe
   ```
   (în PowerShell: `$k = (Get-Content _import\reg-hook-secret.txt).Trim(); npx supabase secrets set REG_HOOK_SECRET=$k --project-ref tfflpivehrrzmklvcyhe`)
3. **Redeploy** `registru-sync` (a primit calea cu cheia registrelor, `spreadsheet_id` și semnul de schimbare):
   `npx supabase functions deploy registru-sync --project-ref tfflpivehrrzmklvcyhe --use-api --no-verify-jwt`
4. **Probă fără Apps Script:** `node scripts/registru-import/google/hook-local.js` scrie o celulă într-un registru demo, face cererea pe care o face scriptul, citește baza de date și pune celula la loc; arată în secunde cât a durat.
5. **Proiectul Apps Script** (cu contul de administrare, pe script.google.com): proiect nou, lipești `apps-script/Mathorizon-sync.gs`, apoi în *Setările proiectului > Proprietăți script* pui `HOOK_URL` (adresa funcției `registru-sync`), `HOOK_SECRET` (cheia) și `REGISTERS` (lista din `npm run apps-script:lists`, proiectul 1). Rulezi din editor, pe rând: `testPing` (verifică adresa și cheia, cere autorizarea o dată), `installTriggers`, `status`. Pentru al doilea proiect, a doua listă.
6. Verifici: schimbi o celulă într-un registru și te uiți în consolă (Registre): apare în câteva secunde. `status` arată ultimul apel al scriptului.

## Dacă ceva nu merge

- `status` arată `EROARE 401`: cheia din proiect nu e cea din Supabase. `EROARE 400`: scriptul trimite ceva ce `hook.mjs` nu acceptă (nu ar trebui).
- `installTriggers` aruncă la un registru: contul nu are acces la el (adaugă-l ca editor).
- Editez și nu se întâmplă nimic: în Apps Script > Executări vezi dacă `onSheetEdit` a pornit; după ce adaugi registre la listă rulezi din nou `installTriggers`.
- Consola nu se actualizează deși baza de date da: migrația de la pasul 1 nu e rulată, sau o fereastră/sertar e deschis (consola nu schimbă datele sub mâna cuiva).
