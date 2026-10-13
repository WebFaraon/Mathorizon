# Formatul nou al registrelor (șablonul din `_newExcel/`), analiza din 2026-10-13

Fișierul primit de la fondator: `_newExcel/Template - Registru Profesor.xlsx` (export din Google Sheets, deci formulele specifice Google apar ca `__xludf.DUMMYFUNCTION("...")`, dar textul formulei e păstrat în interior și l-am citit de acolo). Comparat cu șablonul curat vechi din Drive („SABLON registru (gol, v2)”), fila cu fila. Ce nu se vede dintr-un export xlsx: validările de date (listele derulante), formatarea condiționată, protecțiile. Pentru ele trebuie fișierul Google Sheets real.

## Ce s-a schimbat

**Filele:** `Orar 1` se numește acum **`Grup Model`** (fila-șablon pentru o grupă nouă); a apărut o filă goală `Sheet3` (vizibilă, fără conținut, trecută în Total ca exemplu); restul la fel (`Total achitări`, `Disponibilitate`, `Disponibilitate Vara`, `CONFIGURARI`).

### 1. Fila unei grupe (`Grup Model`): modul Online / Offline și tarife din configurare
- **Celulă nouă `C1`**: modul grupei, „Online” sau „Offline” (în vechiul format nu exista; grupa online se deosebea doar prin numele fișierului).
- **Prețul pe oră** (`A2`, rândul 5 „Costul lecțiilor”, rândul 6) nu mai e scris în formulă (`{608, 348, 288, 248, 228, 218, 0, 148}`), ci citit din `CONFIGURARI`: `M2:M9` = formatul („Individual 1 elev”, „Grup cu 2..8 elevi”, **„Grup cu 10 elevi”**), `O` = tarif Offline, `P` = tarif Online. Offline rămâne identic cu cel vechi (608, 348, 288, 248, 228, 218, 148; la 10 elevi 0). **Online e diferit: 548, 328, 258, 228, 218, 198, 0 (la 8), 108 (la 10).** Costul unui elev = prezențe (PREZENT + ABSENT) × prețul modului grupei.
- **Plata profesorului pe lecție** (coloana `C`, rândurile 9..198): nu mai e fixă în formulă, ci din `CONFIGURARI`: `S` Bază Offline standard, `T` Bază Offline grup de 8, `U` Bază Online standard, `V` Bază Online grup de 10, pe nivelul profesorului (1..**7**: nivelul 7 e nou). Coeficienții (grup de 3: 0,6863 / 0,8549 / 1; grup de 6: 0,6863 ×4, 0,8549, 1; grup de 8: 0,6296 / 0,7519) pot fi suprascriși din `CONFIGURARI!Z2:Z9` (acum goale, deci se folosesc valorile de mai sus). Minim garantat: 4 elevi → 3, 5 → 4, **10 → 6**. Rezultatul e **rotunjit la întreg** (înainte nu). Dacă tabelul nu are nivelul, valoare de rezervă 255 (offline) / 242 (online).
- Neschimbat: `A1` (format), `A3:A7`, orarul `AA2:AC7`, nivelul profesorului `AA9:AA198`, coloana `AB` (randament), rândurile 2-4 (sold, achitări, reduceri) și 7-8 (manager, statut), marcajele `D9:Z198`.

### 2. `CONFIGURARI` devine una centrală
- `A1 = IMPORTRANGE("1cfzsd-M5Ujtc8Y-FQSzmAyjJ12Cq2qAG4SgRhCCVdoQ", "CONFIGURARI!A1:V99")`: tot tabelul vine dintr-un **fișier-mamă** (nu e partajat cu contul nostru de serviciu: 403). Listele (manageri, materii, clase, nivel, profil, stări, statuturi, participare, cabinete) și tarifele se schimbă într-un singur loc pentru toate registrele.
- Coloane noi față de vechi: `L` zi, `M` format grupă, `N` nr. maxim elevi, `O`/`P` tarife, `R:V` tabelul nivelurilor profesorului, `Z2:Z9` coeficienți. Liste: profilul are în plus „General”; materiile de bază fără „L.germană” și „L.chineză” (rămân cele „(Vara)”); managerii „Ceban Olga”, „Botnari Radu” și cabinetul 18 nu mai sunt (erau adăugate de noi pentru demo).

### 3. `Total achitări` refăcută
- Coloanele **`F` (Online)** și **`G` (Offline)** sunt noi: salariul, suma achitată și lecțiile se împart pe moduri; plata din `B3:B32` se repartizează între Online și Offline proporțional cu lecțiile fiecăruia. **Lista fișelor pe care le adună nu mai e în `F4:AI4`, ci de la `H4` în dreapta** (E, F, G au acum formule).
- Neschimbat: plățile în `A:B` de la rândul 3, celulele de salariu `E1:E3` (spre achitare, achitat, total).

### 4. `Disponibilitate`
- Două rânduri noi sub orar: `A15` „Comentariu profesorului”, `A16` „Link Google Meet” (și în varianta de vară, doar Meet). `A1` („Orar”) nu mai e. Grila de ore și bifele „ce predă” rămân.

## Ce înseamnă pentru platformă (verificat cu parserul actual pe fișierul nou)
Parserul nu cade: citește listele, cele 23 de cabinete, `Grup Model` și `Sheet3` le sare ca șabloane, `Total` îl citește. Dar:
1. **Grupele de 10 elevi nu s-ar sincroniza** (dimensiunile cunoscute sunt 1-6 și 8 în `sync-core`, `validate`, `newgroup`, consolă): grupa, elevii și banii ei lipsesc din platformă.
2. **`Total`:** parserul citește `F4:AI4` și ia ca file „0” și „1” (numerele din F4/G4): doar avertismente. Dar **NEW_GROUP și înlocuirile scriu numele filei în primul loc liber din `F4:AI4`**: trebuie mutate la `H4`.
3. **Prețuri fixe în cod** (`pay.mjs`): înlocuirile (banii unei lecții) și plata profesorului calculată în consolă folosesc tarifele offline de azi; online, grupa de 10 și orice schimbare centrală de tarif nu s-ar reflecta. Trebuie citit prețul din registru (`A2` sau `CONFIGURARI`).
4. **`C1`:** NEW_GROUP și înlocuirile trebuie să scrie modul (o filă de înlocuire a unei grupe online trebuie să rămână Online). Consola ar putea lua proiectul (Offline/Online) din `C1`, nu din numele fișierului: ar rezolva și „Fără cabinet” vs „Online”.
5. **Șablon:** numele `Grup Model` (acum căutăm `Orar 1`, apoi ultima filă de grupă).
6. **Plata profesorului:** rotunjirea la întreg și nivelul 7 schimbă cifrele față de calculul nostru; platforma ia cifra din registru când există, dar „drift” va apărea până se aliniază funcția.

## Cum ar merge tranziția (recomandarea mea): în același fișier, nu fișiere noi
Fișierele noi ar avea alt id și file cu alte id-uri: grupele din platformă (legate de id-ul filei), înlocuirile deja făcute, scriptul Apps Script și accesul profesorilor ar trebui refăcute. În același fișier, totul rămâne legat.

Pentru fiecare registru, un script (acelasi stil cu cele existente, cu verificare):
1. **Copie de siguranță** a fișierului (Drive).
2. **Fiecare filă de grupă:** se pune `C1` (Offline/Online, după proiectul registrului), se înlocuiesc formulele de preț (`A2`, rândurile 5 și 6) și de plată (`C9:C198`) cu cele noi; datele (elevi, marcaje, plăți, reduceri, teme, orar) nu se ating.
3. **`CONFIGURARI`:** înlocuită cu `IMPORTRANGE` din fișierul-mamă (fiecare registru trebuie autorizat o dată să citească din el; se poate face din Apps Script, nu de mână).
4. **`Total achitări`:** formulele noi; plățile `A3:B32` păstrate; numele filelor mutate de la `F4..` la `H4..`.
5. **`Disponibilitate`:** cele două rânduri noi; **`Orar 1` → `Grup Model`.**
6. **Verificare automată înainte / după**, pe fiecare grupă: aceleași sold, cost, achitări, reduceri, număr de prezențe pentru fiecare elev (offline: trebuie identice la leu); plata profesorului: doar diferențele de rotunjire și de nivel 7 (listate).

Mai întâi pe un registru demo (copie), apoi toate cele 27 demo, apoi cele reale.

## Riscuri
1. **IMPORTRANGE (cel mai mare risc).** Dacă fișierul-mamă e șters, nepartajat sau registrul nu e autorizat, `CONFIGURARI` devine erori și **prețurile ies 0** (`IFERROR(...,0)`): costurile, soldurile și datoriile elevilor se strică în tăcere, în toate registrele deodată. Fișierul-mamă devine un punct unic de eșec: copie de rezervă, acces strict, iar platforma trebuie să verifice la fiecare citire că tarifele există și să dea alarmă.
2. **Schimbarea centrală a unui tarif recalculează tot trecutul**, la toți elevii (costul = prezențe × prețul de acum, fără istoric al prețului). E și azi cazul într-un registru, dar acum o singură modificare atinge toate registrele.
3. **Banii înlocuirilor și ai transferurilor:** transferul folosește costul din celulele elevului (rămâne corect); înlocuirea folosește un preț din cod: de corectat înainte de trecere, altfel o grupă online sau de 10 calculează greșit.
4. **Grupe de 10 elevi:** până la adaptare, nesincronizate.
5. **Locul listei din `Total`:** scriem greșit în `F4/G4` dacă nu mutăm la `H4`.
6. **Format neverificat din xlsx:** validările de date (poate lista pentru `C1`), formatarea condiționată și protecțiile; plus formulele din `Total` care folosesc funcții noi (`FILTER`, `LET`, `MAP`): merg doar în Google Sheets, deci verificarea se face pe Google Sheets, nu pe export.
7. **Mutarea între registre:** Apps Script rămâne neschimbat (e legat de id-ul fișierului), iar declanșatorul continuă să meargă dacă fișierele rămân aceleași.

## De lămurit
- Linkul fișierului **Google Sheets** al șablonului nou (partajat cu contul de serviciu) și al **fișierului-mamă** `1cfzsd-…` (cel puțin ca cititor pentru contul de serviciu), ca să verific formulele reale, validările și valorile tarifelor.
- Registrele online și offline vor fi **în fișiere separate** sau în același fișier, cu `C1` diferit pe fiecare grupă?
- Când trec registrele reale, și cine îi poate autoriza pe toți pentru `IMPORTRANGE` (contul care deține proiectul Apps Script poate face asta automat dacă are acces la ele).
