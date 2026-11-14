/* ============================================================
   Parcurs, clasa a 7-a (programa Republicii Moldova, 2026-2027): conținutul primelor 3 teme din tabelul fondatorului.
   Structură: Capitol > Secțiune (o temă din tabel) > cerculeț (o subtemă) > 4 lecții (Învață, Exersează, Aplică, Provocare).
   Sfârșitul fiecărei secțiuni: un test (cufărul). Exercițiile se generează din js/parcurs/gens.js, deci la fiecare lecție sunt altele.
   CONȚINUT DE VALIDAT: textele explicative sunt scrise de AI și trebuie citite de fondator înainte să ajungă la elevi.
   ============================================================ */
(function (root) {
  'use strict';
  var PM = (typeof module !== 'undefined' && module.exports) ? require('./lib.js') : root.PM;
  var PG = (typeof module !== 'undefined' && module.exports) ? (require('./gens.js'), require('./gens2.js'), require('./gens.js')) : root.PG;
  var G = PG.G;

  var LESSON_TITLES = ['Învață', 'Exersează', 'Aplică', 'Provocare'];
  var PLAN = { 1: [0, 0, 0, 0, 0, 1, 1], 2: [0, 0, 0, 1, 1, 1, 1], 3: [1, 1, 1, 1, 1, 2, 2], 4: [1, 1, 2, 2, 2, 2, 2] };
  var TEST_TIERS = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2];
  var XP_FIRST = 10;

  /* ------------------------------ secțiunea 1 ------------------------------ */
  var S1 = {
    id: 's1', title: 'Numere raționale. Numere zecimale. Numere zecimale periodice', short: 'Numere raționale',
    circles: [
      { id: 'c1', title: 'Ce sunt numerele raționale', icon: 'book',
        learn: [
          { title: 'O fracție este o împărțire', p: 'Fracția **{3/4}** înseamnă **3 : 4**: numărătorul se împarte la numitor. Schimbă numerele și vezi cum se mișcă fracția.', bar: { d: 4, n: 3, ctl: true, dec: true } },
          { title: 'Numerele raționale', p: 'Un număr **rațional** se poate scrie sub forma {m/n}, unde **m** este număr întreg (m ∈ ℤ), iar **n** este număr natural nenul (n ∈ ℕ*). Mulțimea lor se notează **ℚ**. Atinge un număr și vezi în ce mulțimi intră.', sets: ['5', '−3', '{3/4}', '0,2', '−1,5'] },
          { title: 'Întregii sunt și ei raționali', p: 'Orice număr întreg se scrie ca fracție cu numitorul 1. De aceea **ℕ ⊂ ℤ ⊂ ℚ**: fiecare mulțime o conține pe cea dinainte. Cu ℕ* notăm numerele naturale nenule: 1, 2, 3…, deci ℕ* ⊂ ℕ.', rows: ['5 = {5/1}', '−3 = {−3/1}', '0 = {0/1}', '0,2 = {2/10}'] },
          { title: 'Unde punem minusul', p: 'La o fracție, minusul poate sta în fața ei, la numărător sau la numitor. **Valoarea rămâne aceeași.** Două minusuri se anulează.', rows: ['−{3/4} = {−3/4} = {3/−4}', '{−3/−4} = {3/4}'] }
        ],
        pools: [['smallestSet', 'intAsFrac', 'signForms', 'fracToInt', 'pickSet'], ['whichPositive', 'multiInts', 'shareWord', 'statement', 'intAsFrac', 'fracToInt', 'pickSet', 'writeMN'], ['signForms', 'multiInts', 'statement', 'whichPositive', 'pickSet', 'writeMN']] },
      { id: 'c2', title: 'Fracții echivalente și simplificare', icon: 'scale',
        learn: [
          { title: 'Aceeași parte, alte numere', p: 'Cele trei bare au aceeași parte colorată. Fracțiile **{1/2}**, **{2/4}** și **{4/8}** au aceeași valoare: se numesc **echivalente**.', bars: [[2, 1], [4, 2], [8, 4]] },
          { title: 'Amplificarea', p: 'Înmulțim numărătorul și numitorul cu **același număr nenul**. Valoarea fracției nu se schimbă.', rows: ['{2/3} = {2·4/3·4}', '{2/3} = {8/12}'] },
          { title: 'Simplificarea', p: 'Împărțim numărătorul și numitorul la **același număr** (un divizor comun).', rows: ['{18/24} = {18:6/24:6}', '{18/24} = {3/4}'] },
          { title: 'Fracția ireductibilă', p: 'Când numărătorul și numitorul nu mai au niciun divizor comun în afară de 1, fracția este **ireductibilă**: nu se mai poate simplifica.', rows: ['{3/4} este ireductibilă', '{6/8} nu este: se simplifică prin 2'] }
        ,
          { title: 'Produsele în cruce', p: 'Două fracții {a/b} și {c/d} sunt **echivalente** dacă **a · d = b · c**. Înmulțim „în cruce” și comparăm rezultatele.', rows: ['{2/5} ▢ {4/10}', '2 · 10 = 20 și 5 · 4 = 20', '20 = 20, deci {2/5} = {4/10}', '{3/4} ▢ {5/6}: 3 · 6 = 18, 4 · 5 = 20, deci nu sunt egale'] }
        ],
        pools: [['barShade', 'equivFill', 'amplify', 'simplifyFull', 'equivFill2', 'tfEquiv'], ['barEquiv', 'equivFill', 'simplifyFull', 'isIrreducible', 'equalPair', 'amplify', 'tfEquiv', 'matchEquiv', 'equivFill2'], ['simplifyFull', 'bugSimplify', 'isIrreducible', 'equalPair', 'barEquiv', 'tfEquiv', 'matchEquiv', 'equivFill2']] },
      { id: 'c6', title: 'Fracții supraunitare și numere mixte', icon: 'divide',
        learn: [
          { title: 'Subunitare, echiunitare, supraunitare', p: 'După cum comparăm numărătorul cu numitorul, o fracție este **subunitară** (mai mică decât 1), **echiunitară** (egală cu 1) sau **supraunitară** (mai mare decât 1). Exemple: {3/5} este subunitară, {5/5} este echiunitară, {7/4} este supraunitară (vezi-o pe bare).', bars: [[4, 4], [4, 3]], rows: ['{3/5} < 1', '{5/5} = 1', '{7/4} > 1'] },
          { title: 'Scoatem întregii din fracție', p: 'La o fracție supraunitară **împărțim** numărătorul la numitor. Câtul sunt **întregii**, restul devine **numărătorul**, iar numitorul rămâne.', rows: ['{17/5}', '17 : 5 = 3, rest 2', '{17/5} = 3{2/5}'] },
          { title: 'Introducem întregii în fracție', p: 'Înmulțim **întregii cu numitorul** și adunăm numărătorul. Rezultatul este noul numărător.', rows: ['4{1/3} = {4·3+1/3}', '= {13/3}', '6{2/5} = {6·5+2/5} = {32/5}'] },
          { title: 'Numerele mixte negative', p: 'Minusul din fața unui număr mixt se aplică **întregului număr**. Calculăm cu valorile pozitive, apoi punem minusul.', rows: ['−{11/3} = −3{2/3}', '−2{1/4} = −{9/4}', '−2{1/4} este între −3 și −2'] }
        ],
        pools: [['fracKind', 'toMixed', 'fromMixed', 'mixedMc'], ['toMixed', 'fromMixed', 'mixedMc', 'fracKind', 'writeMN', 'mixedBug'], ['toMixed', 'fromMixed', 'writeMN', 'mixedBug', 'mixedMc']] },
      { id: 'c3', title: 'Axa numerelor și compararea', icon: 'axis',
        learn: [
          { title: 'Numerele pe axă', p: 'Pe axă, numerele cresc spre **dreapta**. Atinge axa și vezi ce număr indică punctul.', axis: { min: -2, max: 2, sub: 4, tap: true } },
          { title: 'Opusul unui număr', p: 'Numerele **{3/4}** și **−{3/4}** sunt **opuse**: au aceeași distanță față de 0, dar de părți diferite. Atinge axa și vezi perechea.', axis: { min: -2, max: 2, sub: 4, tap: true, mirror: true } },
          { title: 'Cum comparăm', p: 'Orice număr negativ este mai mic decât orice număr pozitiv. La două numere negative, **mai mare este cel mai apropiat de 0**.', rows: ['−5 < −2 < 0 < 3', '−{3/4} < −{1/4}'] },
          { title: 'Fracții cu numitori diferiți', p: 'Le aducem la același numitor și comparăm numărătorii.', rows: ['{3/4} ▢ {5/6}', '{3/4} = {9/12} și {5/6} = {10/12}', '{9/12} < {10/12}, deci {3/4} < {5/6}'] }
        ],
        pools: [['axisRead', 'axisPlace', 'cmp', 'opposite'], ['axisPlace', 'axisRead', 'cmp', 'sortRat', 'opposite'], ['axisPlace', 'cmp', 'sortRat', 'between', 'axisRead']] },
      { id: 'c4', title: 'Fracții zecimale', icon: 'decimal',
        learn: [
          { title: 'Zecimalele sunt fracții cu 10, 100…', p: 'Prima cifră după virgulă înseamnă zecimi, a doua sutimi. Colorează părțile și vezi cum se citește.', bar: { d: 10, n: 7, ctl: true, dec: true, lockD: true } },
          { title: 'Fracție în număr zecimal', p: 'Amplificăm până când numitorul devine 10, 100 sau 1000.', rows: ['{3/4} = {3·25/4·25}', '{3/4} = {75/100} = 0,75'] },
          { title: 'Număr zecimal în fracție', p: 'Numărul de zecimale arată câte zerouri are numitorul. Apoi simplificăm.', rows: ['0,6 = {6/10} = {3/5}', '2,25 = {225/100} = {9/4}'] },
          { title: 'Nu toate se termină', p: 'Dacă fracția ireductibilă are la numitor doar factorii primi **2** și **5**, scrierea zecimală se termină. Altfel, urmează ceva nou.', rows: ['{3/8}: 8 = 2·2·2, deci 0,375', '{1/3}: 3 nu e nici 2, nici 5, deci ?'] },
          { title: 'Cum citim un număr zecimal', p: 'Partea întreagă se citește cu **întregi**, apoi partea zecimală cu numele ultimei cifre: **zecimi**, **sutimi**, **miimi**.', rows: ['15,027 = 15{27/1000}', '„cincisprezece întregi și douăzeci și șapte de miimi”', '3,5 = „trei întregi și cinci zecimi”', '0,25 = „douăzeci și cinci de sutimi”'] },
          { title: 'Numerele mixte în zecimale', p: 'Avem două metode. **Metoda 1:** transformăm doar fracția în zecimal și adunăm întregii. **Metoda 2:** introducem întregii în fracție și împărțim.', rows: ['8{3/4}: {3/4} = 3 : 4 = 0,75', '8{3/4} = 8 + 0,75 = 8,75', '8{3/4} = {8·4+3/4} = {35/4}', '35 : 4 = 8,75'] }
        ],
        pools: [['fracToDec', 'decToFrac', 'matchDec', 'decFracMc', 'readDec', 'decDigit'], ['fracToDec', 'decToFrac', 'cmpDec', 'orderDec', 'decFracMc', 'matchDec', 'mixedToDec', 'readDec', 'decDigit'], ['fracToDec', 'decToFrac', 'cmpDec', 'orderDec', 'mixedToDec', 'decToMixed', 'readDec']] },
      { id: 'c5', title: 'Numere zecimale periodice', icon: 'repeat',
        learn: [
          { title: 'O împărțire care nu se termină', p: 'Împărțim 1 la 3. Apasă „Mai departe” și urmărește resturile.', div: { n: 1, d: 3 } },
          { title: 'Perioada', p: 'Cifra sau grupul de cifre care se repetă se numește **perioadă**. O scriem între paranteze.', rows: ['{1/3} = 0,333… = 0,([[3]])', '{5/6} = 0,8333… = 0,8([[3]])', '{4/11} = 0,3636… = 0,([[36]])'] },
          { title: 'Finită sau periodică?', p: 'Simplificăm fracția. Dacă numitorul are doar factorii **2** și **5**, zecimala este **finită**. Altfel este **periodică**.', rows: ['{7/20}: 20 = 2·2·5, deci finită', '{5/12}: 12 = 2·2·3, deci periodică'] },
          { title: 'De la periodic la fracție', p: 'La 0,(a): numărătorul este perioada, iar numitorul are tot atâtea cifre de 9 câte cifre are perioada.', rows: ['0,(7) = {7/9}', '0,(36) = {36/99} = {4/11}', 'x = 0,(7) → 10x = 7,(7) → 9x = 7'] },
          { title: 'Simplu sau mixt', p: 'Dacă perioada începe chiar **după virgulă**, numărul este periodic **simplu**. Dacă între virgulă și perioadă sunt cifre care nu se repetă, este periodic **mixt**. Primele două numere de mai jos sunt simple, ultimele două sunt mixte.', rows: ['2,([[8]])', '35,([[21]])', '0,[[7]]([[23]])', '6,[[25]]([[3]])'] },
          { title: 'Cum se citește perioada', p: 'După partea întreagă (și după partea neperiodică, la cele mixte) citim perioada și spunem **„în perioadă”**.', rows: ['2,(45) = „doi întregi și patruzeci și cinci în perioadă”', '1,(3) = „un întreg și trei în perioadă”', '0,4(09) = „zero întregi, patru zecimi și zero nouă în perioadă”'] }
        ],
        pools: [['isPeriodic', 'periodKind', 'periodDigits', 'decExpansion', 'periodLen'], ['periodKind', 'periodDigits', 'divPeriod', 'decExpansion', 'readPeriodic', 'finiteMulti', 'periodLen'], ['divPeriod', 'decTyped', 'classifyDec', 'nthDigit', 'periodDigits', 'readPeriodic', 'perToFrac']] },
      { id: 'c7', title: 'Periodice simple în fracții', icon: 'repeat',
        learn: [
          { title: 'Fracții cu 9, 99, 999', p: 'Fracțiile cu numitorul **9, 99 sau 999** dau numere periodice simple: perioada este numărătorul, scris cu atâtea cifre câte nouări are numitorul.', rows: ['{2/9} = 0,2222… = 0,([[2]])', '{11/99} = 0,1111… = 0,([[11]])', '{5/999} = 0,005005… = 0,([[005]])'] },
          { title: 'De la periodic la fracție', p: 'La un număr periodic simplu cu **0 întregi**: numărătorul este **perioada**, iar numitorul are **tot atâtea cifre de 9** câte cifre are perioada.', rows: ['0,(7) = {7/9}', '0,(15) = {15/99} = {5/33}', '0,(17) = {17/99}'] },
          { title: 'Când întregul nu e 0', p: 'Dacă partea întreagă este diferită de 0, **adunăm** întregul cu fracția obținută din partea zecimală.', rows: ['2,(05) = 2 + 0,(05)', '= 2 + {5/99} = 2{5/99}', '= {2·99+5/99} = {203/99}', '1,(235) = 1{235/999} = {1234/999}'] },
          { title: 'Pașii, pe scurt', p: '**1.** Separăm partea întreagă. **2.** Perioada deasupra, cifre de 9 dedesubt. **3.** Simplificăm fracția până devine ireductibilă.', rows: ['0,(36) = {36/99}', '= {36:9/99:9} = {4/11}'] }
        ],
        pools: [['perNines', 'perSimple0', 'perSimpleMc', 'fracToPerSimple'], ['perSimple0', 'perSimpleInt', 'perSimpleMc', 'fracToPerSimple', 'perNines', 'perSimpleBug'], ['perSimple0', 'perSimpleInt', 'perSimpleBug', 'perSimpleMc', 'fracToPerSimple']] },
      { id: 'c8', title: 'Periodice mixte în fracții', icon: 'link',
        learn: [
          { title: 'Neperiodică și perioadă', p: 'La un număr periodic **mixt**, între virgulă și perioadă sunt cifre care nu se repetă: **partea neperiodică**. În 0,2(35), partea neperiodică este **2** și perioada este **35**. În 0,16(2), partea neperiodică este **16** și perioada este **2**.', rows: ['0,[[2]]([[35]])', '0,[[16]]([[2]])', '0,[[7]]([[23]])'] },
          { title: 'Metoda I: mutăm virgula', p: 'Împărțim la 10 (sau 100…), ca să rămână un număr periodic simplu, pe care știm să-l transformăm.', rows: ['0,1(16) = {1,(16)/10}', '1,(16) = 1{16/99} = {115/99}', '{115/99} : 10 = {115/990}'] },
          { title: 'Metoda a II-a: regula', p: '**Numărător:** numărul format din partea neperiodică urmată de perioadă, minus partea neperiodică. **Numitor:** cifre de 9 cât perioada, urmate de zerouri cât partea neperiodică.', rows: ['0,2(35) = {235−[[2]]/990} = {233/990}', '0,16(2) = {162−[[16]]/900} = {146/900}', '{146/900} = {73/450}'] },
          { title: 'Cu partea întreagă', p: 'Ca la periodicele simple: separăm partea întreagă, transformăm partea zecimală, apoi le adunăm.', rows: ['5,3(01) = 5 + 0,3(01)', '= 5 + {301−3/990} = 5 + {298/990}', '= 5{149/495} = {2624/495}'] },
          { title: 'Orice număr rațional', p: 'Orice număr rațional se scrie **și ca fracție ireductibilă, și ca număr zecimal** (finit sau periodic). Felul zecimalei depinde de numitorul fracției ireductibile. {3/8} se termină (finit), {4/11} este periodic simplu, iar {5/12} este periodic mixt.', rows: ['{3/8} = 0,375', '{4/11} = 0,(36)', '{5/12} = 0,41(6)'] }
        ],
        pools: [['perMixedFill', 'perMixedMc', 'perMixedFrac', 'rationalForms'], ['perMixedFrac', 'perMixedFill', 'perMixedMc', 'perMixedBug', 'classifyDec'], ['perMixedFrac', 'perMixedBug', 'perMixedMc', 'classifyDec', 'rationalForms', 'perSimpleInt']] }
    ]
  };

  /* ------------------------------ secțiunea 2 ------------------------------ */
  var S2 = {
    id: 's2', title: 'Adunarea, scăderea numerelor raționale', short: 'Adunare și scădere',
    circles: [
      { id: 'c1', title: 'Același numitor și zecimale', icon: 'plus',
        learn: [
          { title: 'Părți de aceeași mărime', p: 'Când numitorii sunt egali, părțile au aceeași mărime și le **numărăm**: adunăm numărătorii, numitorul rămâne.', bars: [[8, 2], [8, 3], [8, 5]], rows: ['{2/8} + {3/8} = {2+3/8} = {5/8}'] },
          { title: 'Scăderea', p: 'La scădere facem la fel. La final **simplificăm**, dacă se poate.', rows: ['{7/9} − {4/9} = {7−4/9}', '= {3/9} = {1/3}'] },
          { title: 'Zecimale: virgulă sub virgulă', p: 'Aliniem virgulele, completăm cu zerouri unde lipsesc cifre și calculăm de la dreapta la stânga.', col: { a: '3,45', b: '12,6', op: '+' } }
        ],
        pools: [['addSame', 'subSame', 'addDec', 'missingTerm', 'addMc'], ['addSame', 'subSame', 'addDec', 'missingTerm', 'partsWord'], ['addSame', 'subSame', 'addDec', 'partsWord', 'missingTerm']] },
      { id: 'c2', title: 'Numitor comun', icon: 'link',
        learn: [
          { title: 'Părți de mărimi diferite', p: '{1/2} și {1/3} au părți diferite, nu le putem număra împreună. Le tăiem în părți egale: șesimi.', bars: [[2, 1], [3, 1], [6, 3], [6, 2], [6, 5]] },
          { title: 'Numitorul comun', p: 'Alegem cel mai mic multiplu comun al numitorilor, apoi amplificăm fiecare fracție.', rows: ['{1/2} + {1/3}', '2 și 3: numitor comun 6', '{1/2} = {3/6} și {1/3} = {2/6}', '{3/6} + {2/6} = {5/6}'] },
          { title: 'Un exemplu mai mare', p: 'Rezultatul poate fi mai mare decât 1. Îl lăsăm ca fracție.', rows: ['{3/4} + {5/6}', 'cel mai mic multiplu comun al lui 4 și 6 este 12', '{9/12} + {10/12} = {19/12}'] },
          { title: 'Scăderea, la fel', p: 'Același numitor întâi, apoi scădem numărătorii.', rows: ['{5/6} − {1/4}', '{10/12} − {3/12} = {7/12}'] }
        ],
        pools: [['lcmQ', 'ampCommon', 'addDiff', 'addDiffMc'], ['addDiff', 'subDiff', 'stepOrder', 'bugAdd', 'mixWord'], ['addDiff', 'subDiff', 'bugAdd', 'mixWord', 'lcmQ']] },
      { id: 'c3', title: 'Numere cu semne diferite', icon: 'axis',
        learn: [
          { title: 'Adunarea pe axă', p: 'A aduna un număr pozitiv înseamnă un salt spre **dreapta**, a aduna unul negativ înseamnă un salt spre **stânga**.', jump: { start: 2, moves: [3, -7] } },
          { title: 'Regulile', p: '**Același semn:** adunăm valorile absolute și păstrăm semnul. **Semne diferite:** scădem valoarea mică din cea mare și păstrăm semnul numărului mai îndepărtat de 0.', rows: ['−3 + (−5) = −(3 + 5) = −8', '−7 + 4 = −(7 − 4) = −3', '2 + (−6) = −(6 − 2) = −4'] },
          { title: 'Scăderea înseamnă adunarea opusului', p: 'Schimbăm scăderea în adunare cu opusul numărului scăzut.', rows: ['5 − (−3) = 5 + 3 = 8', '−2 − 4 = −2 + (−4) = −6'] },
          { title: 'Și la fracții', p: 'Numitor comun, apoi aceleași reguli ca la numerele întregi.', rows: ['−{1/2} + {1/3}', '= −{3/6} + {2/6}', '= −{1/6}'] }
        ],
        pools: [['addInt', 'subInt', 'signMc', 'jump'], ['addInt', 'subInt', 'jump', 'addFracSign', 'tempWord', 'negNeg'], ['addInt', 'subInt', 'addFracSign', 'decSign', 'calcSeq', 'tempWord']] },
      { id: 'c4', title: 'Paranteze și probleme', icon: 'paren',
        learn: [
          { title: 'Plus în fața parantezei', p: 'Semnele din paranteză **rămân** la fel când o scoatem.', rows: ['10 + (3 − 5) = 10 + 3 − 5 = 8'] },
          { title: 'Minus în fața parantezei', p: 'Semnele din paranteză **se schimbă** când o scoatem.', rows: ['10 − (3 − 5) = 10 − 3 + 5 = 12'] },
          { title: 'Ordinea calculelor', p: 'Întâi calculăm în paranteză, apoi mergem de la stânga la dreapta.', rows: ['{1/2} − ({1/3} − {1/6})', '= {1/2} − {1/6}', '= {3/6} − {1/6} = {1/3}'] }
        ],
        pools: [['parExpr', 'removeParens', 'tempWord'], ['parExpr', 'removeParens', 'bugParen', 'balanceWord', 'parFrac'], ['parExpr', 'parFrac', 'bugParen', 'balanceWord']] }
    ]
  };

  /* ------------------------------ secțiunea 3 ------------------------------ */
  var S3 = {
    id: 's3', title: 'Înmulțirea, împărțirea numerelor raționale', short: 'Înmulțire și împărțire',
    circles: [
      { id: 'c1', title: 'Înmulțirea numerelor raționale', icon: 'times',
        learn: [
          { title: 'O fracție dintr-o fracție', p: 'Un pătrat împărțit în coloane și rânduri. {2/3} din {3/4} înseamnă pătrățelele colorate de două ori. Apasă „Mai departe”.', area: { a: [2, 3], b: [3, 4] } },
          { title: 'Regula', p: 'Înmulțim numărătorii între ei și numitorii între ei. Dacă se poate, simplificăm **înainte** de a înmulți.', rows: ['{2/3} · {4/5} = {2·4/3·5} = {8/15}', '{3/8} · {4/9} = {3·4/8·9} = {1/6}'] },
          { title: 'Numere zecimale', p: 'Înmulțim ca pe numerele întregi, apoi punem virgula: atâtea zecimale câte au factorii împreună.', rows: ['0,3 · 0,12', '3 · 12 = 36', '1 + 2 = 3 zecimale, deci 0,036'] },
          { title: 'Fracție dintr-un număr', p: 'Împărțim numărul la numitor, apoi înmulțim cu numărătorul.', rows: ['{3/4} din 20 = {3/4} · 20', '20 : 4 = 5 și 5 · 3 = 15'] }
        ],
        pools: [['mulFrac', 'fractionOf', 'mulDec', 'mulInt'], ['mulFrac', 'mulDec', 'fractionOf', 'wordPart', 'mulInt', 'bugMul'], ['mulFrac', 'mulDec', 'wordPart', 'bugMul', 'fractionOf']] },
      { id: 'c2', title: 'Regula semnelor', icon: 'signs',
        learn: [
          { title: 'Semnul produsului', p: 'Atinge două semne și vezi ce semn are produsul lor.', signs: true },
          { title: 'Regula', p: '**Semne la fel: plus. Semne diferite: minus.** Valorile se înmulțesc ca de obicei.', rows: ['(−3) · (−4) = 12', '(−3) · 4 = −12', '3 · (−4) = −12'] },
          { title: 'Mai mulți factori', p: 'Numărăm minusurile. **Număr par** de minusuri: plus. **Număr impar**: minus.', rows: ['(−1) · (−2) · (−3) = −6', '(−1) · (−2) · (−3) · (−4) = 24'] },
          { title: 'La fracții, la fel', p: 'Mai întâi semnul, apoi înmulțim fracțiile.', rows: ['−{2/3} · {9/4} = −{18/12} = −{3/2}', '(−{1/2}) · (−{4/5}) = {2/5}'] }
        ],
        pools: [['signMul', 'mulSigned', 'countMinus'], ['mulSigned', 'countMinus', 'mulFracSign', 'negProducts', 'mulDecSign'], ['mulSigned', 'mulFracSign', 'mulDecSign', 'negProducts', 'countMinus']] },
      { id: 'c3', title: 'Împărțirea. Inversul unui număr', icon: 'divide',
        learn: [
          { title: 'Inversul unui număr', p: 'Inversul lui **{3/4}** este **{4/3}**. Produsul dintre un număr și inversul lui este 1.', rows: ['{3/4} · {4/3} = 1', '5 · {1/5} = 1', '0 nu are invers'] },
          { title: 'Împărțirea este o înmulțire', p: '**a : b = a · inversul lui b.** Inversăm doar al doilea număr, cel din dreapta semnului „:”.', rows: ['{2/3} : {4/5} = {2/3} · {5/4}', '= {10/12} = {5/6}'] },
          { title: 'Semnele', p: 'Regula semnelor este aceeași ca la înmulțire.', rows: ['(−12) : 4 = −3', '(−12) : (−4) = 3'] },
          { title: 'Numere zecimale', p: 'Înmulțim deîmpărțitul și împărțitorul cu 10, 100… ca împărțitorul să devină număr întreg.', rows: ['3,6 : 0,4 = 36 : 4', '= 9'] }
        ],
        pools: [['inverse', 'divInt', 'divMc'], ['divFrac', 'divInt', 'divDec', 'inverse', 'divMc', 'bugDiv'], ['divFrac', 'divDec', 'divWord', 'bugDiv', 'inverse']] },
      { id: 'c4', title: 'Operații combinate', icon: 'order',
        learn: [
          { title: 'Ordinea operațiilor', p: '**1.** Parantezele. **2.** Înmulțirile și împărțirile, de la stânga la dreapta. **3.** Adunările și scăderile, de la stânga la dreapta.', rows: ['2 + 3 · 4 = 2 + 12 = 14', '(2 + 3) · 4 = 5 · 4 = 20'] },
          { title: 'Cu fracții', p: 'Aceeași ordine, indiferent de tipul numerelor.', rows: ['{1/2} + {2/3} · {3/4}', '= {1/2} + {1/2}', '= 1'] },
          { title: 'Probleme în doi pași', p: 'Calculăm pe rând și notăm cât a rămas după fiecare pas.', rows: ['Un bidon de 20 l', 'Dimineața: {1/4} din 20 = 5 l, rămân 15 l', 'Seara: {2/5} din 15 = 6 l, rămân 9 l'] }
        ],
        pools: [['orderInt', 'orderFrac', 'stepOrderCalc'], ['orderInt', 'orderFrac', 'parMix', 'bugOrder', 'stepOrderCalc'], ['orderFrac', 'orderInt', 'word2', 'parMix', 'bugOrder']] }
    ]
  };

  /* temele următoare din tabel, care urmează să fie scrise (apar blocate în Parcurs) */
  var UPCOMING = [
    'Rădăcina pătrată dintr-un număr rațional nenegativ',
    'Numere iraționale. Numere reale',
    'Scoaterea și introducerea factorilor sub radical',
    'Operații cu radicali',
    'Ridicarea la putere a radicalilor',
    'Ordinea operațiilor cu radicali'
  ];

  var CLASS7 = {
    grade: 7,
    title: 'Clasa a 7-a',
    chapters: [{ id: 'k1', n: 1, title: 'Numere și radicali', sections: [S1, S2, S3], upcoming: UPCOMING }]
  };
  CLASS7.chapters.forEach(function (k, ki) {
    k.sections.forEach(function (s, si) {
      s.n = si + 1; s.chapter = k;
      s.circles.forEach(function (c, ci) {
        c.n = ci + 1; c.section = s; c.lessons = [];
        for (var l = 1; l <= 4; l++) c.lessons.push({ id: 'r7.' + s.id + '.' + c.id + '.l' + l, n: l, title: LESSON_TITLES[l - 1], circle: c });
        c.id_full = 'r7.' + s.id + '.' + c.id;
      });
      s.testId = 'r7.' + s.id + '.test';
      s.skipId = 'r7.' + s.id + '.skip';
    });
  });

  /* ordinea liniară a nodurilor din parcurs: lecții de cerculeț, apoi testul secțiunii */
  function flat() {
    var out = [];
    CLASS7.chapters.forEach(function (k) {
      k.sections.forEach(function (s) {
        s.circles.forEach(function (c) { c.lessons.forEach(function (l) { out.push({ kind: 'lesson', id: l.id, lesson: l, circle: c, section: s }); }); });
        out.push({ kind: 'test', id: s.testId, section: s });
      });
    });
    return out;
  }
  function findNode(id) { return flat().filter(function (n) { return n.id === id; })[0] || null; }

  /* ---------- construirea unei lecții ---------- */
  function pickFrom(R, names, used, last) {
    var best = [], min = 1e9;
    names.forEach(function (n) { var u = used[n] || 0; if (u < min) { min = u; best = [n]; } else if (u === min) best.push(n); });
    var ok = best.filter(function (n) { return n !== last; });
    return R.pick(ok.length ? ok : best);
  }
  /* cheia unui exercițiu: generatorul, textul și conținutul (variantele, liniile, perechile), ca să recunoaștem același exercițiu a doua oară */
  function specKey(nm, spec) {
    return nm + '|' + (spec.q || '') + '|' + (spec.eq || '') + '|' + JSON.stringify(spec.opts || spec.tiles || spec.lines || spec.pairs || spec.a || '');
  }
  /* mem (opțional): {has(key), add(key)}; cheile exercițiilor văzute de elev în ultimele lecții, ca să nu se repete și între lecții */
  function makeSet(R, pools, tiers, mem) {
    var used = {}, seen = {}, last = null, out = [], i;
    for (i = 0; i < tiers.length; i++) {
      var t = tiers[i], names = pools[i % pools.length][t], spec = null, tries = 0, nm, key;
      while (tries++ < 24) {
        nm = pickFrom(R, names, used, last);
        spec = G[nm](R, t);
        key = specKey(nm, spec);
        if (!seen[key] && !(mem && mem.has(key) && tries < 20)) break;
      }
      seen[key] = 1; if (mem) mem.add(key);
      used[nm] = (used[nm] || 0) + 1; last = nm;
      spec.rar = t; spec.gen = nm;
      out.push(spec);
    }
    return out;
  }
  /* întoarce {kind, title, sub, learn, exercises, xpMax} pentru o lecție, test sau test de sărit */
  function build(id, R, mem) {
    R = R || PM.rng();
    var m = /^r7\.(s\d)\.(c\d)\.l(\d)$/.exec(id), sec, circ;
    if (m) {
      sec = CLASS7.chapters[0].sections.filter(function (s) { return s.id === m[1]; })[0];
      circ = sec && sec.circles.filter(function (c) { return c.id === m[2]; })[0];
      if (!circ) return null;
      var n = +m[3], tiers = PLAN[n];
      return { id: id, kind: 'lesson', n: n, title: LESSON_TITLES[n - 1], circle: circ.title, section: sec.title, grade: CLASS7.title,
        learn: n === 1 ? circ.learn : null, exercises: makeSet(R, [circ.pools], tiers, mem), xpMax: tiers.length * XP_FIRST };
    }
    m = /^r7\.(s\d)\.(test|skip)$/.exec(id);
    if (m) {
      sec = CLASS7.chapters[0].sections.filter(function (s) { return s.id === m[1]; })[0];
      if (!sec) return null;
      var pools = sec.circles.map(function (c) { return c.pools; });
      /* un cerculeț pe rând: exercițiul i vine din cerculețul i mod nr. cerculețe */
      var circles = sec.circles, exs = [], used = {}, last = null, seen = {};
      TEST_TIERS.forEach(function (t, i) {
        var c = circles[i % circles.length], names = c.pools[t], spec = null, tries = 0, nm;
        var key; while (tries++ < 24) { nm = pickFrom(R, names, used, last); spec = G[nm](R, t); key = specKey(nm, spec); if (!seen[key] && !(mem && mem.has(key) && tries < 20)) break; }
        seen[key] = 1; if (mem) mem.add(key);
        used[nm] = (used[nm] || 0) + 1; last = nm; spec.rar = t; spec.gen = nm; exs.push(spec);
      });
      return { id: id, kind: m[2], n: 0, title: m[2] === 'test' ? 'Testul secțiunii' : 'Test de nivel', circle: sec.short, section: sec.title, grade: CLASS7.title, learn: null,
        exercises: exs, xpMax: m[2] === 'test' ? TEST_TIERS.length * XP_FIRST : 0, noRetry: m[2] === 'skip', passAt: m[2] === 'skip' ? 8 : 0 };
    }
    return null;
  }

  /* verificări folosite de scripts/check-parcurs.mjs */
  function validate() {
    var errs = [];
    CLASS7.chapters.forEach(function (k) {
      k.sections.forEach(function (s) {
        s.circles.forEach(function (c) {
          if (!c.learn || c.learn.length < 3) errs.push(c.id_full + ': pagini „Învață” prea puține');
          if (c.pools.length !== 3) errs.push(c.id_full + ': trebuie 3 niveluri');
          c.pools.forEach(function (names, t) {
            if (!names.length) errs.push(c.id_full + ' nivelul ' + t + ' gol');
            names.forEach(function (nm) { if (!G[nm]) errs.push(c.id_full + ': generator lipsă ' + nm); });
          });
          (c.learn || []).forEach(function (pg, i) {
            if (!pg.p || !pg.title) errs.push(c.id_full + ' pagina ' + (i + 1) + ': lipsește textul');
            var kinds = ['rows', 'bar', 'bars', 'axis', 'sets', 'div', 'signs', 'jump', 'area', 'col'].filter(function (x) { return pg[x]; });
            if (!kinds.length) errs.push(c.id_full + ' pagina ' + (i + 1) + ': fără element vizual');
          });
        });
      });
    });
    return errs;
  }
  /* toate identificatoarele de lecții, pentru verificări */
  function allIds() {
    var out = [];
    flat().forEach(function (n) { out.push(n.id); if (n.kind === 'test') out.push(n.section.skipId); });
    return out;
  }

  var API = { CLASS7: CLASS7, build: build, flat: flat, findNode: findNode, validate: validate, allIds: allIds, XP_FIRST: XP_FIRST, LESSON_TITLES: LESSON_TITLES };
  root.PCONTENT = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
