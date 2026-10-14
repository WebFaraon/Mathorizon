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

## Confirmat din Google Sheets real (2026-10-13, șablonul partajat cu contul de serviciu)

Formulele reale sunt cele din export (aceleași diferențe, nimic în plus în fila de grupă). Detalii pe care exportul nu le arăta:
- **`CONFIGURARI!A1` = `=IMPORTRANGE("1cfzsd-M5Ujtc8Y-FQSzmAyjJ12Cq2qAG4SgRhCCVdoQ", "CONFIGURARI!A1:V99")`** confirmat.
- **Validări stricte în fila de grupă:** `A1` trebuie să fie din `CONFIGURARI!M2:M9` (formatele, deci inclusiv „Grup cu 10 elevi”); **`C1` doar „Offline” sau „Online”**; `A3` stări, `A4` materii, `A5` clase, `A6` nivel, `A7` profil, `D7:Z7` manageri, `D8:Z8` statut elev (nestrictă), `D9:Z198` participare. Scrierile prin API nu sunt oprite de validări, dar valorile din afara listei apar roșii în Sheets: planificatoarele noastre verifică deja listele.
- **Protejat:** `Grup Model!C9:C198` (plata profesorului pe lecție) și foaia `CONFIGURARI`. Contul de serviciu nu le poate scrie: conversia lor se face cu contul proprietar (OAuth-ul din `_import/google-oauth-token.json`), nu cu cel de serviciu.
- **20 de reguli de formatare condiționată** în fila de grupă (culori de statut și prezență): se păstrează la conversie, pentru că nu atingem formatarea.
- **`Total achitări` are formule într-o singură coloană-model, `H` (rândurile 3..32), nu în 30 de coloane umplute dinainte (`F:AI`) ca în vechiul format.** Totalurile `E`, `F`, `G` adună `H4:` până la **ultima coloană a foii** (`COLUMNS(1:1)`): o grupă nouă înseamnă o coloană nouă la dreapta, copiată din modelul `H`, cu numele filei în rândul 4. Asta schimbă mecanismul de înscriere a unei file noi în `Total` (NEW_GROUP, înlocuiri): nu mai e „primul loc liber în F4:AI4”, ci „adaugă o coloană după ultima și copiază formulele”. `Sheet3` din `H4` e un nume de probă (fila `Sheet3` există goală).

## Răspunsurile fondatorului și adaptarea codului (pasul 1, 2026-10-13)

- **Online și offline sunt în același fișier**, cu `C1` diferit pe fiecare grupă. Deci proiectul unei grupe nu mai vine din numele fișierului: vine din `C1` (`reg_groups.mode`).
- Fișierul-mamă nu e accesibil încă; șablonul partajat e creat în ziua respectivă, deci datele lui sunt proaspete.

Codul citește acum **ambele formate** (cel vechi rămâne neschimbat, 253 de verificări de sincronizare, 13892 de consolă):
- `pay.mjs`: tabele offline și online, `priceFor(size, mode)`, `sizesFor(mode)` (8 doar offline, 10 doar online), `lessonPay(size, paying, level, mode)` cu nivel 7 și minimul garantat 6 pentru grupa de 10. Pentru un nivel necunoscut formula plătește 255 offline / 242 online (în formatul vechi plătește 0, ca până acum).
- `parse.mjs`: `C1` (mod), `A2` (prețul pe oră, „258 MDL/oră”), `CONFIGURARI` (tarife, tabele de plată, `broken` când arată `#REF!`), `Total achitări` cu aspectul nou (coloanele `F4`/`G4` cu numărătoare nu sunt nume de file).
- `validate.mjs`: erori noi `config-broken`, `tariffs`, `format-mode`, `price`, avertisment `mode`. Prețul se ia din `A2`, tabelul din cod e doar rezervă; plata profesorului se compară cu toleranța de 0,51 (registrele noi rotunjesc la leu întreg).
- `total.mjs` (nou): unde se scrie numele unei file noi în `Total achitări`. Aspectul vechi: prima celulă goală din `F4:AI4`. Aspectul nou: prima coloană de la `H` fără nume (`Sheet3` de probă contează liber); dacă nu are formule, se copiază coloana-model `H` (rândurile 1..32) cu `copyColumn`, iar la eșec coloana se șterge (`removeColumn`).
- `newgroup.mjs`, `apply.mjs`: șablonul poate fi `Grup Model` sau `Orar 1`; se scrie `C1` din modul grupei; formatul trebuie să existe în acel mod (`size-mode`); nivelul profesorului până la 7.
- `replacement.mjs`: fila de înlocuire păstrează modul grupei de bază (`C1` copiat), prețul unei lecții e ce arată `A2` al grupei de bază (refuz `price` dacă nu e număr).
- Platforma: migrarea `20261012100000_registre_mode_price.sql` adaugă `reg_groups.mode` și `reg_groups.price` și recreează `reg_apply_group`. Consola citește coloanele cu rezervă (fără migrare merge ca până acum), proiectul unei grupe vine din `mode`, un profesor cu grupe în ambele moduri apartine ambelor proiecte, prețul grupei (`D.rateOf`) bate tabelul, formatul de 10 apare la Înscriere doar online, cel de 8 doar offline, iar grupa nouă trimite `mode` din proiectul ales.

**Ordinea de lansare:** 1) rulează migrarea în SQL Editor, 2) redeploy la `registru-sync`, `registru-apply` și `registru-replace`. Fără migrare, sincronizarea unui registru în format nou ar eșua la `reg_apply_group` (coloanele lipsesc); registrele vechi nu trimit `mode` ca valoare și nu sunt afectate.

## Conversia registrelor demo (2026-10-13): făcută și verificată

Script: `scripts/registru-import/google/convert-format.js` (`--test <id>` pe o copie, `--one <id>`, `--all`). Convertește **pe loc** (același id de fișier, deci Apps Script, grupele din platformă și înlocuirile rămân legate), într-un singur `batchUpdate` atomic:
- fiecare filă de grupă: `C1` = modul (deslipit de `B1`), formulele șablonului în `A2`, `D5:Z6`, `C9:C198`, validările `A1:C1`; nimic altceva (elevi, prezențe, plăți, reduceri, teme, orar nu se ating);
- `Total achitări` înlocuită cu cea din șablon (copiată cu `sheets.copyTo`), plățile `A3:B32` și lista filelor puse la loc de la `H4`, câte o coloană copiată din modelul `H` pentru fiecare grupă;
- fila `Grup Model` (șablonul de grupă nouă) înainte de `CONFIGURARI`;
- `CONFIGURARI`: tarifele și tabelele de plată (`L:V`) din șablon, **ca valori** (registrele reale vor importa foaia din fișierul-mamă cu `IMPORTRANGE`; fișierul-mamă nu e partajat cu noi, listele din `A:K` rămân cele de acum);
- `Disponibilitate` și `Disponibilitate Vara`: rândurile „Comentariu profesorului” și „Link Google Meet”.

**Capcană găsită:** `CONFIGURARI` trebuie lărgită la 22 de coloane ÎNAINTE de a copia filele din șablon; o formulă care arată spre o coloană din afara foii e ancorată la capătul foii și se mută la lărgire (prețurile citeau coloanele greșite). Scriptul lărgește întâi.

Înainte și după, registrul e citit cu importatorul platformei și comparat elev cu elev (cost, sold, achitat, reducere, prezențe, date, stări, orar). Singura diferență permisă: plata profesorului pe lecție (formula nouă rotunjește la leu). Rezultat pe cele **27 de registre, 200 de grupe**: nicio diferență; plata profesorului diferă doar prin rotunjire (ex. un registru de 17 grupe: salariul total 58323,01 înainte, 58278 după). Baza de date: 200 de grupe cu `mode = offline` și prețul corect (608/348/288/248/228/218), audit complet 0 diferențe, 27 de registre `ok`. Copiile de siguranță ale formatului vechi sunt într-un folder „Backup înainte de formatul nou …” din Drive-ul proprietarului.

Teste de capăt la capăt pe registre convertite: `google/new-format-e2e-local.js` (grupă nouă online / offline / de 10 din `Grup Model`, refuzul 10 offline și 8 online, plată pe elev, mutarea orarului cu redenumirea filei și a numelui din `Total`, curățare) și `google/replacement-local.js` (înlocuire între două registre convertite, banii se mută și se întorc, totul la loc).

Defecte reale găsite de aceste teste și reparate în cod: `google.mjs` citea `CONFIGURARI` doar `A:K` și `Total` doar până la `AI`; citirea numelor din `Total` în afara foii dădea eroare Google (lista se citește acum pe lățimea reală a foii, `adapter.width`); redenumirea unei file după orar căuta numele doar în `F4:AI4` (`locateName` în `total.mjs` îl găsește și în aspectul nou).

**Pentru registrele reale (rămas):** fișierul-mamă partajat cu contul de serviciu și cu proprietarul, `CONFIGURARI!A1` înlocuit cu `IMPORTRANGE` și autorizat o dată per registru, aceeași comandă de conversie (cu copie de siguranță automată). Modul se pune din numele fișierului (`OFFLINE`/`ONLINE`); într-un fișier cu grupe de ambele feluri `C1` se schimbă apoi de mână pe grupele online (prețul și plata se recalculează singure).

**Aspect (verificat prin export PDF al foilor convertite):** coloana `C` a filelor de grupă rămăsese la lățimea veche (61 px) și chipul „Online/Offline” din `C1` nu se vedea. Lățimile din șablon (`C` 130 px, `AC` 114 px) sunt acum puse pe toate cele 200 de grupe (`google/fix-widths.js`, rulat pe cele 27 de registre) și incluse în `convert-format.js` pentru registrele reale. Rândurile de înălțime, culorile, fonturile și validările din `A1:C8` sunt identice cu ale șablonului; `Total achitări` și rândurile noi din `Disponibilitate` sunt copiate direct din șablon (aspect identic).

**Textul elevilor în fila nouă (găsit pe 14 octombrie):** în șablonul nou, celulele cu numele elevilor (`D1:Z1`), managerii (`D7:Z7`) și statutul (`D8:Z8`) sunt în greutate normală, pe când filele profesorilor le au bold. O filă făcută din `Grup Model` (înlocuire, grupă nouă) ieșea deci cu text simplu. Reparat în trei locuri: `boldStudentCells` în adaptorul Google (apelat după `duplicate` la grupă nouă și la înlocuire, doar greutatea), `Grup Model` din registrele convertite pus pe bold (`google/fix-student-bold.js`, rulat pe cele 27 plus fila de înlocuire deja făcută) și același pas în `convert-format.js`. Șablonul fondatorului are aceeași diferență: grupele lui noi vor ieși cu text simplu până îl corectează.

**Datele din coloana A sunt date reale în șablonul nou (găsit pe 14 octombrie):** celulele `A9:A198` au validarea „dată validă” și formatul `d mmmm yy`, deci o dată scrisă sau aleasă de profesor ajunge la citire ca număr serial (46315 = 20 octombrie 2026), nu ca text „20 Octombrie”. Parserul înțelegea doar textul și raporta „Data 46315 nu se înțelege”. Acum `parse.mjs` (`serialDate`) citește ambele: un serial dă data cu anul din el (și continuă anul pentru rândurile următoare cu text), iar același lucru se aplică plăților din `Total achitări` (`03.10.2026` scris ca dată). Teste în `check-sync.js` (258).

