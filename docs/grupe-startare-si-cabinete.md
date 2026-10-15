# Startarea grupelor, cabinetul opțional și programul lecțiilor (cerut de fondator, 2026-10-15)

Regulile de mai jos sunt implementate în consolă (`js/admin/views/inscriere.js`, `repartizare.js`) și în sincronizare (`supabase/functions/_shared/registru/start-rule.mjs`).

## 1. Statutul „Startează”
Fluxul unei grupe: **Se completează → Startează → Activ**.
- **Se completează:** se așteaptă elevii la înscriere.
- **Startează:** grupa are destui elevi; lecția următoare profesorul se prezintă și elevii vin la **lecția de probă**. Dacă elevii continuă, rămân în grupă cu statutul **Activ**.
- Trecerea din „Se completează” în „Startează” se face **automat**, fără ca cineva să o schimbe: la fiecare citire a unui registru, `registru-sync` (`syncWorkbook` / `syncGroup`) verifică fiecare grupă „Se completează” cu `startCheck`; dacă are destui elevi înscriși, pune în coadă o comandă `SET_GROUP` (`state: Startează`, `expect.state: Se completează`) și cheamă `registru-apply`. Se scrie în celula `A3` a filei din registru, deci și platforma o vede la următoarea citire.
- Id-ul comenzii e făcut din registru, filă și numărul de elevi: aceeași situație nu se pune în coadă de două ori, iar o grupă pusă la loc de o persoană nu e pornită din nou până nu se mai înscrie un elev. Dacă între timp cineva a schimbat starea în registru, comanda e refuzată (conflict), nu suprascrie.
- „Startează” e în toate filtrele și paginile (Orar, Repartizare, Elevi, Analitică, Înscriere, Transfer, Acasă): culoare albastră, sursa unică e `D.GROUP_STATUS` (`mock-data.js`) și `groupStatus` (`registry-dataset.js`). Grupele „Startează” rămân în lista de înscriere (au locuri libere) cu insigna „Startează”.

**Criteriul (acum doar numărul de elevi înscriși: Activ, Oră de probă, Oră de probă confirmată; Inactiv, Transferat și Înlocuire nu contează):**

| Format grupă | Elevi minim ca să pornească |
| --- | --- |
| 6 elevi | 4 (regula fondatorului) |
| 3 elevi | 2 (regula fondatorului) |
| 2 elevi | 2 |
| 4 elevi | 3 |
| 5 elevi | 4 |
| 8 elevi | 6 |
| 10 elevi | 6 |
| Individual (1 elev) | fără regulă: nu are oră de probă |

Valorile pentru formatele de 2, 4, 5, 8 și 10 elevi sunt deduse (două treimi, minimul garantat din tabelul de plată): **de confirmat cu fondatorul.** Se schimbă într-un singur loc, `START_MIN` din `start-rule.mjs`.

**Lecția individuală** nu are oră de probă: decontarea începe de la prima lecție. La înscriere elevul intră cu statutul **Activ** și o grupă individuală nouă se creează direct **Activă** (nu „Se completează”).

## 2. Înscriere: nivelul și cele patru câmpuri obligatorii
- „Informații generale” (Materia, Clasa, Formatul, Nivelul) sunt **toate obligatorii**: până nu sunt completate nu apare nicio grupă. Profilul (doar la liceu) rămâne obligatoriu pentru lista exactă, ca înainte.
- **Nivelul se alege multiplu** (de exemplu 5-6 și 6-7): lista arată doar grupele acestor niveluri. „Informații suplimentare” (zile, ore, mărimea grupei, profesor) rămân preferințe ale părintelui.
- La o grupă nouă, dacă sunt alese mai multe niveluri, managerul alege nivelul grupei noi (un grup are un singur nivel).

## 3. Grupă nouă: cabinetul e opțional
- Managerul poate crea grupa **fără cabinet** (implicit). Lecția se creează în registrul profesorului, apare în Repartizare după programul ales, cu semnul **Fără cabinet**.
- În **Repartizare** orarul rămâne cel clasic. O grupă offline fără cabinet are pe blocul ei o **iconiță galbenă cu o ușă, care pulsează**, și un contur punctat; în vederea Cabinete grupele astea stau într-un rând propriu **„Fără cabinet”, primul din tablă**, iar în vederea Profesori sunt în rândul profesorului lor. Filtrul „Doar grupele fără cabinet” (coloana de filtre) lasă pe tablă doar blocurile astea.
- Directorul dă cabinetul **trăgând blocul pe un cabinet** (la aceeași oră) sau **apăsând pe bloc**, care deschide panoul cu lista cabinetelor (liber sau ocupat la ora grupei, prea mic) și orele libere.
- Verificarea se face pentru **toate zilele grupei**. Alegerea se scrie în registru (`SET_GROUP`, celulele `AC` ale orarului) și apare imediat în platformă ca ocupat, deci un alt cabinet nu se mai poate suprapune; un cabinet ocupat spune de cine.

## 4. Programul unei grupe noi
Regula: **ori două ore consecutive într-o zi, ori câte o oră în două zile diferite**.
- „O oră, în două zile”: se aleg exact două zile, la aceeași oră (în registru două rânduri de orar, câte unul pe zi; fila se numește, de exemplu, „Luni/Miercuri 17:00-18:00”).
- „Două ore, într-o zi”: o singură zi, două ore la rând (două rânduri pe aceeași zi; „Luni 17:00-19:00”).
- Butonul „Creează grupa” se activează abia când programul e complet; a treia zi aleasă o înlocuiește pe cea mai veche.
- Ora e aceeași în ambele zile: platforma tratează un orar cu ore diferite ca „neregulat” (nu se poate muta, nu se poate înlocui din consolă).

## 5. După aceste schimbări
Redeploy: `registru-sync` (regula de startare). Consola se publică singură. La prima citire a fiecărui registru, grupele „Se completează” care au deja destui elevi trec în „Startează” (o citire forțată a tuturor registrelor le prinde pe toate deodată).

## Grupele din registru devin clase pe platformă (2026-10-15)

Migrarea `supabase/migrations/20261015120000_registre_clase_automate.sql` leagă fiecare grupă din registru de o clasă din `classes` (`classes.reg_group_id`), pentru registrele care au un cont de profesor legat (`reg_workbooks.owner_user_id`, setat din Sincronizare).

- O grupă `Se completează`, `Startează` sau `Activ` primește o clasă cu cod de invitație propriu (generat o singură dată, nu se schimbă). `Inactiv` și `Înlocuire` nu primesc clasă; o clasă deja făcută rămâne cu elevii ei.
- Clasa urmărește grupa: nume (`Materie · Zi/Zi2 · Ora`), clasa elevilor, nivel, online/offline, locuri, program (cel mult două zile) și profesor se actualizează la fiecare scriere în `reg_groups`.
- Totul trece prin triggerele `reg_groups_class_sync` și `reg_workbooks_class_sync`, deci nu depinde de o redeployare: sincronizarea, grupa nouă din Înscriere (comanda NEW_GROUP) și SET_GROUP produc aceeași clasă. Un eșec în trigger doar dă avertisment, nu oprește sincronizarea.
- Tabul Clase al profesorului arată grupele ca blocuri mici; fiecare bloc deschide clasa (`class.html?id=`), cu Sumar, Mesaje, Teme, Simulări, Catalog. „Clase pe platformă" păstrează doar clasele făcute de mână (`reg_group_id` gol).
- Elevii din registru nu au conturi: intră în clasă cu codul. Legarea elevilor din registru de conturi nu e făcută.

## Alăturarea la o clasă prin cerere (2026-10-16)

Migrarea `supabase/migrations/20261016100000_cereri_alaturare_clase.sql` schimbă felul în care un elev intră într-o clasă (toate clasele, nu doar cele din registru):

- Elevul introduce codul în Clase și apasă „Trimite cererea" (`request_join_class`). Nu intră în clasă și nu are acces la nimic până acceptă profesorul. Un trigger pe `class_members` oprește orice inserare directă din client, indiferent de politicile RLS vechi.
- Profesorul vede cererile în Clase („Cereri de alăturare") și ca insignă pe tabul Clase din meniu (`js/join-badge.js`, încărcat de `js/nav-loader.js`). Acceptă sau respinge (`decide_join_request`). O cerere respinsă se poate retrimite după 24 de ore; elevul își poate retrage o cerere în așteptare.
- La acceptare, pentru o clasă făcută dintr-o grupă din registru, profesorul poate lega elevul de numele lui din registru (`class_members.reg_student_name`). Sugestia vine din asemănarea numelor, nelegată automat. Legarea se poate face și mai târziu, din coloana „Registru" din Sumar (`set_member_reg_link`).
- Un elev legat primește din registru, la fiecare sincronizare (`reg_class_sync_people`, apelată la sfârșitul `reg_apply_group`): statutul (Transferat sau Inactiv în registru = Inactiv în clasă) și prezențele (P și G = prezent; A, M și B = absent), scrise ca sesiuni și înregistrări în Catalog. Registrul e singura sursă: o prezență pusă de mână în Catalog pentru un elev legat se rescrie la următoarea sincronizare.
- Nu e făcută: mutarea automată a elevului în clasa altei grupe când e transferat în registru.
