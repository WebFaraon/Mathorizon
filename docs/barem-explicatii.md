# Explicațiile pașilor de barem

Sub fiecare criteriu oficial din barem, elevul vede o **explicație**: calculul desfășurat din spatele criteriului. Ea trăiește în câmpul opțional `explicatie` al fiecărui pas din `barem[]` (`js/data.js`).

```js
{ descriere: 'Determinarea unei primitive a funcției de sub simbolul integralei',
  puncte_maxime: 2,
  explicatie: 'Determinăm o primitivă $G(t)$ ...\n$$G(t) = \\frac{t^3}{3} - t$$' }
```

- `descriere` = criteriul oficial, transcris întocmai. E și textul pe care `api/verify-exam.js` îl trimite lui Gemini la notare, deci **nu se rescrie niciodată** ca să sune mai explicativ.
- `explicatie` = doar pentru elev. Nu intră în `data/official-barem-examples.json`.

Regulile de mai jos sunt aceleași pe care le primește Gemini la generare și pe care le verifică automat comanda de lint. Sursa lor unică e `scripts/_explicatie-rules.js`.

## Fluxul pentru un exercițiu nou

1. Adaugi exercițiul în `js/data.js`, cu `barem[]` transcris din documentul oficial, și exemplul în `data/official-barem-examples.json`.
2. Probă, fără scriere: `node scripts/generate-barem-explicatii.js --id <id>`. Citește rezultatul din log (calea e afișată la final). Verifică matematica pas cu pas, pentru că regulile de mai jos verifică forma, nu adevărul.
3. Scrie: `node scripts/generate-barem-explicatii.js --id <id> --apply`.
4. Verifică tot: `npm run lint:explicatii`. Trebuie să iasă `OK`.

Generatorul retrimite singur lui Gemini încălcările găsite, de cel mult 3 ori, și scrie doar un răspuns care a trecut de reguli. Dacă un exercițiu e respins de 3 ori, nu se scrie nimic pentru el și mesajul spune ce regulă a picat.

## Reguli de formă (verificate automat)

**Structură**

1. Explicația e o succesiune de blocuri scurte: o propoziție, apoi formula ei pe rând separat (`$$...$$`).
2. Proza (tot ce nu e formulă) are cel mult **240** de caractere. Cel mult **4** formule `$$...$$`.
3. Nu reformula criteriul. Prima propoziție spune ce facem: „Notăm...", „Aplicăm...", „Înlocuim...".

**Formule în rând (`$...$`)**

4. Doar simboluri și egalități scurte: cel mult **18** caractere în interior, cel mult **5** pe explicație.
5. Niciodată în rând: `\frac`, `\int`, `\sum`, `\prod`, `\lim`, `\left`, `\right`, `\begin`, `\boxed`. Se scriu ca `$$...$$`.
6. Două sau mai multe relații introduse deodată (`t = ...`, `x = ...`, `dx = ...`) merg într-un bloc `aligned`, nu înșirate în propoziție.

**Formule pe rând (`$$...$$`)**

7. Un rând are cel mult **2** semne `=`. În `aligned` se numără doar cele de după `&` (membrul stâng e o ipoteză): `x = 3 &\Rightarrow t = \sqrt{4} = 2` e în regulă.
8. `\begin{aligned}`: cel mult **4** rânduri, **exact un `&`** pe rând. Două forme permise, nu se amestecă:

   *(a) Lanț de calcul cu expresia de plecare lungă.* Primul rând conține doar expresia, cu `&` în față; celelalte încep cu `&=`:
   ```
   \begin{aligned} &2\left[G(3)-G(2)\right] \\ &= 2\left(6-\tfrac{2}{3}\right) \\ &= \tfrac{32}{3} \end{aligned}
   ```
   *(b) Definiții paralele, sau lanț cu membrul stâng scurt* (cel mult **8** caractere înaintea lui `&`):
   ```
   \begin{aligned} t &= \sqrt{x+1} \\ x &= t^2 - 1 \\ dx &= 2t\,dt \end{aligned}
   ```
   Fără membru stâng lung înaintea lui `&`. Fără `\\` în afara unui `aligned`.
9. Fără `\boxed`. Fără `\text{...}` mai lung de **12** caractere (textul din formule nu se rupe pe rânduri).
10. `\left...\right` doar pentru conținut înalt (fracții, radicali) și **niciodată imbricate**. Altfel `( )` și `[ ]` simple. O fracție numerică mică într-o expresie se scrie `\tfrac`.
11. Lățime: pe telefon o formulă are ~280px, adică 30-35 de caractere pe rând. Ce nu încape se sparge conform regulii 8.

**Limbă și format**

12. Română cu diacritice, persoana I plural. Fără liniuță lungă (—), fără `**bold**`, fără liste cu bulină. Fără `<` urmat direct de literă (`$a<b$`): browserul îl citește ca tag HTML. Scrie `\lt` sau pune spații.
13. Fiecare valoare numerică rezultă din `solution`. Nimic inventat.

## Reguli de conținut (verificate de un om, la pasul 2 din flux)

Forma corectă cu conținut subțire nu ajută un elev. Regulile de formă împing spre scurt, așa că acestea le țin în echilibru:

- **C1.** Calcul concret, nu reformulare a criteriului.
- **C2. Autonomie.** Elevul citește doar enunțul și explicația pasului. Orice expresie care apare într-o formulă și nu e în enunț (integrandul simplificat, `G(3)`, noile limite) își arată originea în aceeași explicație.
- **C3.** Nu se sare nicio operație. Nu „`G(3) = 6`", ci „`G(3) = 3^3/3 - 3 = 6`". Noile limite după o substituție se derivă. Nici operațiile cu fracții nu se sar.
- **C4.** O transformare pe care criteriul o presupune dar nu o scrie (simplificarea integrandului înainte de substituție) se include la începutul explicației.
- **C5.** Doar ce ține de pas: nu anticipa pașii următori, nu relua pașii anteriori.
- **C6.** Nu comprima ca să încapi (ai loc de 4 blocuri), dar nici rânduri consecutive care repetă același calcul.

## Ce verifică lintul, concret

`npm run lint:explicatii` (sau `node scripts/lint-barem-explicatii.js`, cu `--id`, `--subcat` sau `--no-browser`) iese cu cod 1 dacă găsește o încălcare.

1. **Din text:** regulile 2, 4, 5, 7, 8, 9, 10, 12.
2. **În browser real, pe 320 / 390 / 768 / 1280px**, cu CSS-ul, `js/utils.js` și KaTeX-ul reale:
   - *Vizibilitate:* nimic din explicație nu iese din zona vizibilă a modalului. `.rarity-modal__body` are `overflow-x: hidden`, deci ce iese e tăiat fără urmă.
   - *Lățime:* o formulă `$$...$$` trebuie să încapă cu cel mult 15% micșorare. Sub asta textul devine prea mic pentru telefon.

`BM.fitDisplayMath` (`js/utils.js`) rămâne ca plasă de siguranță pe site, dar lintul o dezactivează: verifică ce ar trebui să facă ea doar în cazuri rare.

## Regulă pentru CSS, nu pentru conținut

Dacă modifici layoutul modalului (`.rarity-step`, `.rarity-step__detail`), rulează lintul. O cutie cu `flex-basis: 100%` **plus** `margin-left` iese din pas cu marginea respectivă, iar `overflow-x: hidden` o taie în tăcere. A fost deja o dată bug: ultimii 38px ai fiecărei linii lipseau pe tabletă și desktop. Se vedea doar dacă măsurai față de modal, nu față de cutia elementului.
