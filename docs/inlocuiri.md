# Înlocuiri: decizii și arhitectură

Proces cerut de fondator și confirmat de utilizator (2026-10-09). Totul se face din platformă, automat, sincronizat cu registrele. Statutul lucrării e la sfârșit.

## Procesul, în cuvintele utilizatorului

Când un profesor nu poate face lecția cu o grupă, administratorul atribuie lecția unui alt profesor, după disponibilitatea lui, într-un cabinet liber la ora respectivă, și se asigură că profesorul nou predă clasa respectivă. În registrul profesorului nou se creează automat o filă cu starea grupei **Înlocuire** și toți elevii sunt copiați acolo cu statutul **Înlocuire**. Elevii rămân **Activ** în registrul original.

Banii nu se transferă deodată (șansa ca elevii să vină la lecția de înlocuire e mai mică). Până când profesorul nou nu pune prezența unui elev, elevul are în fila nouă sold 0, achitări 0, reduceri 0. După ce a fost pusă prezența pentru un elev, banii pentru acea prezență trec automat din registrul vechi în cel nou, cu calculele din tabul Calculator (Înlocuire). Dacă profesorul nu completează nimic pentru un elev, sau a fost absent motivat, cifrele rămân 0 în registrul nou. Faptul că elevul a făcut o înlocuire trebuie să apară în Istoricul lui. Lecția trebuie să apară în Repartizare, vizibilă administratorului.

Într-o grupă de 3 elevi activi nu poate exista un al patrulea cu statut Înlocuire: în fila de înlocuire sunt toți cu Înlocuire, în grupa de bază toți Activ.

## Deciziile confirmate (răspunsuri date de utilizator)

| Întrebare | Decizie |
|---|---|
| Perioada unei înlocuiri | **Date alese** (una sau mai multe lecții), nu interval și nu „până la anulare”. |
| Câte file în registrul înlocuitorului | **O filă pe grupă și pe profesor, refolosită** la înlocuirile următoare. |
| Prezența se schimbă după ce banii au trecut | **Banii se întorc automat** în registrul vechi (se scad din cel nou, se adaugă în cel vechi) și se notează în istoric. |
| Bani insuficienți în registrul vechi | **Se transferă ce există și administratorul e anunțat**; registrul nou arată sold negativ pentru diferență. |
| Cum arată în Repartizare | **Doar în săptămâna datei**: cardul de înlocuire (violet, profesorul nou, cabinetul ales) apare la ora grupei; cardul grupei de bază rămâne în acea zi, **marcat „înlocuită”**, și nu mai dă conflict de cabinet sau profesor. În alte săptămâni totul arată ca înainte. |
| Ce elevi se copiază | **Toți, în afară de Inactiv și Transferat** (adică cei care sunt în grupă acum: Activ, Instabil, Oră de probă, Oră de probă confirmată). Statutul lor în fila nouă: Înlocuire. |
| Unde se începe și se urmărește | **Buton în panoul grupei** (Orar și Repartizare) care deschide pașii, plus o **pagină nouă „Înlocuiri”** în meniu. |
| Fila de înlocuire după ultima dată | **Trece singură pe Inactiv** după ultima dată și după ce toate prezențele sunt decontate; **se redeschide** (Înlocuire) la următoarea înlocuire. |
| Când se mută banii pentru un elev | La **Prezent** sau **Absent** (nemotivat). La gol, **Absent motivat**, **Prima lecție gratuită** (și „Absent prima lecție gratuită”): nimic. Contează orice rând de lecție bifat în fila de înlocuire, chiar dacă data nu a fost planificată. |

## Formula (tabul Calculator, Înlocuire)

Pentru fiecare prezență a unui elev, o lecție (1 oră) cu prețul formatului grupei de bază (`PRICES[N]` din `pay.mjs`, la fel ca în fila nouă, care păstrează „Grup cu N elevi”):

```
total      = ore x preț                     (ore = 1 per rând de lecție bifat)
achitări   = Achitări (rândul 3) al elevului în registrul vechi
reduceri   = Reduceri (rândul 4) ale elevului în registrul vechi
trece_ach  = round2(total x achitări / (achitări + reduceri))
trece_red  = round2(total - trece_ach)
rămâne_ach = achitări - trece_ach ; rămâne_red = reduceri - trece_red
```
Dacă `achitări + reduceri < total` (bani insuficienți): se mută tot ce există (`trece_ach = achitări`, `trece_red = reduceri`) și diferența (`total - (achitări + reduceri)`) se notează ca „neacoperită”. Dacă `achitări + reduceri = 0`, nu se mută nimic și toată suma e neacoperită. În registrul nou: plata și reducerea sunt termeni adăugați în `SUM(...)` (rândurile 3 și 4 ale elevului), în cel vechi termeni minus. Costul și soldul le calculează formulele registrului nou.

## Arhitectură

**Baza de date** (migrația `20261009100000_registre_replacements.sql`):
- `reg_replacements`: o înlocuire = grupa de bază (`orig_workbook`, `orig_sheet`), registrul și fila înlocuitorului (`repl_workbook`, `repl_sheet`, `repl_tab`), starea (`active` / `closed` / `cancelled`), datele (jsonb `[{ iso, start, duration, cabinet, cancelled? }]`), prețul unei lecții și formatul. O singură înregistrare vie pentru perechea (grupa de bază, profesorul nou): fila se refolosește, datele noi se adaugă (index unic parțial).
- `reg_replacement_items`: o linie pe (înlocuire, elev, rând de lecție), cheia `telefon#rând`: starea (`pending` → `from-done` → `settled`; la corecție `rev-new-done` → `reversed`), sumele mutate (`ach`, `red`, `short`), pasul și eroarea la care a rămas, încercările, `attempt` (crește când prezența dispare și revine).
- `reg_locks` + `reg_take_lock` / `reg_release_lock` (doar service role): o singură rulare a motorului odată.
- Tabelele se citesc doar de admin și se scriu doar de funcții. `reg_enqueue_command` primește `REPLACEMENT_CREATE` și `REPLACEMENT_CANCEL` pe registrul înlocuitorului (`sheet_id = 0`); `REPL_TAKE`, `REPL_MONEY`, `REPL_CLOSE` le pune doar motorul.

**Registrul** (module pure, Node și Deno, testate în `scripts/check-sync.js`):
- `replacement.mjs`: `applyReplacementCreateAsync` face fila (duplică „Orar 1” sau ultima fila de grupă, scrie formatul „Grup cu N elevi”, starea Înlocuire, materia, clasa, nivelul, profilul, orarul din date, nivelul profesorului, elevii copiați cu statut Înlocuire și bani 0, o intrare în „Total achitări”), citește înapoi, iar la orice eșec șterge fila nouă. Dacă fila grupei există deja la acel profesor, o aduce la zi (`REPL_TAB_UPDATE`: starea, orarul adăugat, elevii veniți între timp). Refuză formatul fără preț.
- `commands.mjs`: `REPL_TAKE` (în registrul vechi calculează din celulele reale suma care pleacă, `splitReplacement`, și adaugă termeni minus), `REPL_MONEY` (termeni cu semn în rândurile 3 și 4, pentru fila nouă și pentru corecții), `REPL_CLOSE` (starea Inactiv, orarul golit, doar dacă fila e încă în Înlocuire).
- `replacement-engine.mjs`: motorul. Din prezențele din tabelele sincronizate află liniile de decontat și pe cele de returnat, aplică pașii în ordine, **salvează starea după fiecare pas**, folosește id-uri de comandă deterministe (`repl-<id>-<elev>-<încercare>-<pas>-<n>`) ca un pas repetat să primească răspunsul primului, nu să scrie a doua oară; o scriere despre care nu se știe dacă a ajuns (`write-unknown`, `verify-failed`, `interrupted`) **nu se repetă singură**, cere verificarea registrului. Închide fila după ultima dată, când nu mai e nimic deschis.

**Funcțiile Supabase**: `_shared/registru/process.ts` (rulează o comandă pe registru, comun cu `registru-apply`; tratează și `REPLACEMENT_CREATE` / `REPLACEMENT_CANCEL`), `registru-replace` (motorul legat de Supabase și Google; ia lacătul, citește prezențele din `reg_lessons`, fiecare pas e un rând în `reg_commands` cu id derivat, deci jurnal), `registru-sync` îl cheamă la sfârșitul fiecărei citiri complete când există o înlocuire activă. Anularea: o dată viitoare se marchează anulată; dacă nu mai rămâne nicio dată și nu s-a mutat niciun ban, fila trece pe Inactiv.

**Consolă**: `registry-dataset.js` scoate filele de înlocuire din `groups` (nu sunt grupe: nu intră în orar, în cabinete, în înscrieri) și din lanțul de grupe al elevului (nu sunt transfer); le dă ca `replacements`, iar banii din ele intră în soldul elevului (`replSold`) și în Istoric (`replEvents`, secțiunea „Înlocuiri” din Parcursul elevului). `replacement-plan.js` (pur, testat în `scripts/check-replacements.js`) alege profesorii (predă materia la clasă, disponibil la oră în toate zilele alese, fără altă grupă sau înlocuire atunci; lecția luată de altcineva în ziua aceea eliberează profesorul și cabinetul) și cabinetele libere.

## Verificări

- `npm run check:sync` (225), `npm run check:replacements` (33), `npm run check:registry` (13.889, rămâne identic).
- Probă vie: `node scripts/registru-import/google/replacement-local.js [de la=t1] [la=t26]` pe două registre demo: fila de înlocuire (6 elevi, toți Înlocuire, bani 0), Prezent / Absent motivat / Absent, banii unei lecții (208,64 + 9,36 = 218) pleacă din registrul vechi și ajung în cel nou, a doua rulare nu scrie nimic, prezența schimbată îi întoarce, prezența revine și se decontează o singură dată, închiderea, apoi toate celulele puse la loc (16 din 16 verificări, 2026-10-09). Citește doar o filă la fiecare pas: limita Google (60 citiri/minut) e împărțită cu cron-ul.

## Stare

- **Gata și verificat:** registrul (fila, comenzile, motorul), migrația scrisă, funcțiile (`process.ts`, `registru-replace`, legătura din `registru-sync`), datele consolei, planificatorul, secțiunea din Istoric, proba vie.
- **De pus în funcțiune (de utilizator):** rulează migrația `20261009100000_registre_replacements.sql` în Supabase (SQL editor); redeploy la `registru-sync`, `registru-apply` și funcția nouă `registru-replace` (are `verify_jwt = false` în `supabase/config.toml`). Fără migrație consola merge ca înainte (tabelele lipsă sunt ignorate).
- **În lucru:** pașii din panoul grupei, pagina „Înlocuiri”, Repartizare (cardul de înlocuire și grupa de bază marcată).
