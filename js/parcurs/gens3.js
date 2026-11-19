/* ============================================================
   Parcurs: exerciții INTERACTIVE pentru secțiunea 1 (numerele raționale): copilul trage, taie, mărește, observă, în loc să scrie o cifră.
   Se adaugă în același obiect G din gens.js. Desenul și comportamentul fiecărui tip sunt în js/parcurs/inter.js (încărcat după engine.js).
   Tipuri noi (restul formatului ca în gens.js):
     bins   {q, bins:[{l, s?}], items:[{t, b}], kind}      trage fiecare card în cutia lui; b = indexul cutiei; kind: 'sets' | 'frac' | 'dec' (pentru verificări)
     rank   {q, tiles[] (în ordinea corectă), dir?:'asc'|'desc'}   trage cardurile în ordine; tiles e deja în ordinea cerută
     slice  {q, mode:'make', n, d}  taie întregul în d părți egale și colorează n
            {q, mode:'equiv', a, b, ex:[n, d]}  bara de sus are a/b colorat; jos taie în alte părți și colorează aceeași parte
     zoom   {q, mode:'find', lo, target}     mărește axa până găsești numărul (target = fracție cu cel mult 3 zecimale)
            {q, mode:'between', lo, A, B}    găsește un număr între A și B
     rem    {q, n, d, q0, r0, rows:[{x, dg, r}], at}     împărțirea n : d; apasă primul rest care a mai apărut (rows[at-1])
     wholes {q, n, d}                         trage cele n bucăți de 1/d în cercuri și umple cât mai multe cercuri întregi
   ============================================================ */
(function (root) {
  'use strict';
  var PM = (typeof module !== 'undefined' && module.exports) ? require('./lib.js') : root.PM;
  var PG = (typeof module !== 'undefined' && module.exports) ? (require('./gens.js'), require('./gens2.js'), require('./gens.js')) : root.PG;
  var G = PG.G, tier = PG.tier;
  var F = PM.F, fs = PM.fmtF, fd = PM.fmtDec, raw = PM.fmtRaw, gcd = PM.gcd;
  var fr = function (n, d) { return '{' + n + '/' + d + '}'; };
  var int = function (n) { return (n < 0 ? '−' : '') + Math.abs(n); };
  var uniq = function (arr, key) { var seen = {}; return arr.filter(function (x) { var k = key(x); if (seen[k]) return false; seen[k] = 1; return true; }); };

  /* ---------------- 1. trage în cutii ---------------- */

  /* ℕ, ℤ și ℚ: fiecare număr în cea mai mică mulțime din care face parte */
  G.binsSets = function (R, lvl) {
    var items = [], tries = 0;
    var nat = function () {
      if (lvl === 0 || R.bool(0.5)) return { t: String(R.pick([0, 2, 5, 7, 9, 12, 20])), b: 0 };
      var k = R.int(2, 9), d = R.pick([2, 3, 4, 5]); return { t: raw(k * d, d), b: 0 };       /* {12/4} = 3, tot natural */
    };
    var negInt = function () {
      if (lvl === 0 || R.bool(0.5)) return { t: '−' + R.int(1, 15), b: 1 };
      var k = R.int(1, 8), d = R.pick([2, 3, 4, 5]); return { t: raw(-k * d, d), b: 1 };
    };
    var ratio = function () {
      var kind = lvl === 0 ? 0 : R.int(0, 2);
      if (kind === 0) { var d = R.pick([2, 3, 4, 5, 7]), n = R.int(1, d * 2); if (n % d === 0) n++; return { t: (R.bool() ? '−' : '') + fr(n, d), b: 2 }; }
      if (kind === 1) { return { t: (R.bool() ? '−' : '') + R.int(0, 9) + ',' + R.int(1, 9), b: 2 }; }
      var dd = R.pick([3, 6, 9, 11]), nn = R.int(1, dd - 1); return { t: '0,(' + Math.round(nn / dd * 9) + ')', b: 2 };
    };
    var spec = tier(lvl, [2, 2, 2], [2, 2, 3], [2, 3, 3]);
    var mk = [nat, negInt, ratio];
    for (var b = 0; b < 3; b++) for (var k = 0; k < spec[b]; k++) items.push(mk[b]());
    while (uniq(items, function (x) { return x.t; }).length < items.length && tries++ < 30) { items = []; for (b = 0; b < 3; b++) for (k = 0; k < spec[b]; k++) items.push(mk[b]()); }
    items = R.shuffle(uniq(items, function (x) { return x.t; }));
    /* 0,(x) cu x = 0 sau 9 ar fi întreg sau mai ciudat: înlocuim cardurile periodice cu o formă sigură */
    items.forEach(function (it) { if (/^0,\(\d\)$/.test(it.t)) { var dg = +it.t.charAt(3); if (dg === 0 || dg === 9) it.t = '0,(3)'; } });
    items = uniq(items, function (x) { return x.t; });
    return { t: 'bins', kind: 'sets', q: 'Trage fiecare număr în cea mai mică mulțime din care face parte.',
      bins: [{ l: 'Naturale', s: 'ℕ' }, { l: 'Întregi negative', s: 'ℤ' }, { l: 'Raționale neîntregi', s: 'ℚ' }], items: items,
      why: 'Naturale: ' + items.filter(function (i) { return i.b === 0; }).map(function (i) { return i.t; }).join(', ') + '. Întregi negative: ' + items.filter(function (i) { return i.b === 1; }).map(function (i) { return i.t; }).join(', ') +
        '. Raționale neîntregi: ' + items.filter(function (i) { return i.b === 2; }).map(function (i) { return i.t; }).join(', ') + '. O fracție ca {12/4} are valoarea 3, deci este număr natural.',
      hint: 'Fă împărțirea: dacă dă un număr întreg, fracția e întreagă. Un număr cu virgulă care nu e întreg este doar rațional.' };
  };

  /* fracții subunitare, echiunitare, supraunitare */
  G.binsKind = function (R, lvl) {
    var maxD = tier(lvl, 6, 9, 12), items = [], used = {};
    var add = function (n, d, b) { var k = n + '/' + d; if (used[k]) return false; used[k] = 1; items.push({ t: fr(n, d), b: b }); return true; };
    var want = tier(lvl, [2, 1, 2], [2, 1, 3], [3, 1, 3]);
    var g;
    for (var b = 0; b < 3; b++) for (var k = 0; k < want[b]; k++) {
      g = 0;
      while (g++ < 50) {
        var d = R.int(2, maxD), n = b === 0 ? R.int(1, d - 1) : b === 1 ? d : R.int(d + 1, d * 2 + 3);
        if (b === 2 && gcd(n, d) === 1 && R.bool(0.8) === false) continue;
        if (add(n, d, b)) break;
      }
    }
    items = R.shuffle(items);
    var by = function (b) { return items.filter(function (i) { return i.b === b; }).map(function (i) { return i.t; }).join(', '); };
    return { t: 'bins', kind: 'frac', q: 'Trage fiecare fracție în cutia potrivită.',
      bins: [{ l: 'Subunitare', s: 'mai mici ca 1' }, { l: 'Echiunitare', s: 'egale cu 1' }, { l: 'Supraunitare', s: 'mai mari ca 1' }], items: items,
      why: 'Subunitare (numărătorul mai mic decât numitorul): ' + by(0) + '. Echiunitare (numărătorul egal cu numitorul): ' + by(1) + '. Supraunitare (numărătorul mai mare): ' + by(2) + '.',
      hint: 'Compară numărătorul cu numitorul.' };
  };

  /* zecimale finite, periodice simple, periodice mixte */
  function decKind(f) { var i = PM.decInfo(f); return i.per === '' ? 0 : i.pre === '' ? 1 : 2; }
  G.binsDec = function (R, lvl) {
    var pools = [[2, 4, 5, 8, 10, 20, 25], [3, 9, 11, 33, 7, 13, 27], [6, 12, 15, 18, 14, 22, 30, 45]];
    var showDec = lvl === 0, items = [], used = {};
    var want = tier(lvl, [2, 2, 2], [2, 2, 2], [2, 2, 3]);
    for (var b = 0; b < 3; b++) for (var k = 0; k < want[b]; k++) {
      var g = 0;
      while (g++ < 80) {
        var d = R.pick(pools[b]), n = R.int(1, d - 1);
        if (gcd(n, d) !== 1) continue;
        var f = F(n, d); if (decKind(f) !== b) continue;
        var key = n + '/' + d; if (used[key]) continue;
        used[key] = 1; items.push({ t: showDec ? fd(f) : fs(f), b: b, f: f }); break;
      }
    }
    items = R.shuffle(items);
    var by = function (b) { return items.filter(function (i) { return i.b === b; }).map(function (i) { return fs(i.f) + ' = ' + fd(i.f); }).join('; '); };
    var out = items.map(function (i) { return { t: i.t, b: i.b }; });
    return { t: 'bins', kind: showDec ? 'dec' : 'decFrac', q: showDec ? 'Trage fiecare număr zecimal în cutia lui.' : 'Fiecare fracție, scrisă ca zecimală, ajunge într-o cutie. Trage-le.',
      bins: [{ l: 'Finite', s: '0,25' }, { l: 'Periodice simple', s: '0,(3)' }, { l: 'Periodice mixte', s: '0,1(6)' }], items: out,
      why: 'Finite: ' + (by(0) || '-') + '. Periodice simple: ' + (by(1) || '-') + '. Periodice mixte: ' + (by(2) || '-') + '. Periodică simplă: perioada începe imediat după virgulă. Periodică mixtă: între virgulă și perioadă sunt cifre care nu se repetă.',
      hint: showDec ? 'Se repetă ceva? Începe imediat după virgulă?' : 'Împarte numărătorul la numitor. Numitorii cu doar factorii 2 și 5 dau zecimale finite.' };
  };

  /* ---------------- 2. ordonează prin tragere ---------------- */
  function asRank(sp, R, asc, what) {
    var tiles = asc ? sp.tiles : sp.tiles.slice().reverse();
    return { t: 'rank', q: 'Trage cardurile în ordine ' + (asc ? 'crescătoare' : 'descrescătoare') + ', de la ' + (asc ? 'cel mai mic la cel mai mare' : 'cel mai mare la cel mai mic') + '.', tiles: tiles, dir: asc ? 'asc' : 'desc',
      why: sp.why.replace(/Ordinea crescătoare/, asc ? 'Ordinea crescătoare' : 'Ordinea crescătoare (apoi o citim invers)'), hint: sp.hint };
  }
  G.rankRat = function (R, lvl) { return asRank(G.sortRat(R, lvl), R, R.bool(0.7)); };
  G.rankDec = function (R, lvl) { return asRank(G.orderDec(R, lvl), R, R.bool(0.7)); };

  /* ---------------- 3. taie și colorează ---------------- */
  G.sliceMake = function (R, lvl) {
    var d = R.int(2, tier(lvl, 6, 8, 12)), n = R.int(1, d - 1);
    return { t: 'slice', mode: 'make', n: n, d: d, q: 'Taie întregul în părți egale și colorează ' + fr(n, d) + '.',
      why: 'Numitorul ' + d + ' spune în câte părți egale tăiem întregul, iar numărătorul ' + n + ' spune câte părți colorăm: ' + fr(n, d) + '.', hint: 'Mai întâi taie în ' + d + ' părți, apoi colorează ' + n + '.' };
  };
  G.sliceEquiv = function (R, lvl) {
    var b = R.pick(tier(lvl, [2, 3, 4], [3, 4, 5], [4, 5, 6])), a = R.int(1, b - 1), tries = 0;
    while (gcd(a, b) !== 1 && tries++ < 20) a = R.int(1, b - 1);
    if (gcd(a, b) !== 1) a = 1;
    var k = 2, ex = [a * k, b * k], more = [];
    for (var j = 3; b * j <= 12; j++) more.push(fr(a * j, b * j));
    return { t: 'slice', mode: 'equiv', a: a, b: b, ex: ex, q: 'Bara de sus are colorat ' + fr(a, b) + '. Taie bara de jos în alte părți și colorează aceeași parte din întreg.',
      why: 'Putem tăia în ' + (b * k) + ' părți și colora ' + (a * k) + ': ' + fr(a, b) + ' = ' + fr(a * k, b * k) + ' (am înmulțit numărătorul și numitorul cu ' + k + ').' + (more.length ? ' La fel de bine: ' + more.join(', ') + '.' : '') + ' Partea colorată din întreg este aceeași.',
      hint: 'Dacă tai fiecare parte în două, de câte ori mai multe părți colorezi?' };
  };

  /* ---------------- 4. mărește pe axă ---------------- */
  G.zoomFind = function (R, lvl) {
    var lo = lvl === 2 ? R.int(0, 3) : 0, f, form;
    if (lvl === 0) { f = F(lo * 10 + R.int(1, 9), 10); form = R.pick(['dec', 'frac', 'dec']); }
    else if (lvl === 1) { f = F(lo * 100 + R.int(1, 9) * 10 + R.pick([1, 2, 3, 4, 6, 7, 8, 9]), 100); form = R.pick(['dec', 'dec', 'frac']); }
    else {
      var pick = R.pick([1, 3, 5, 7, 0, 0]);
      if (pick) { f = F(lo * 8 + pick, 8); form = 'frac'; }
      else { f = F(lo * 1000 + R.int(1, 9) * 100 + R.int(0, 9) * 10 + R.int(1, 9), 1000); form = 'dec'; }
    }
    var text = form === 'frac' ? fs(f) : fd(f), dec = fd(f);
    var tenths = Math.floor(f.n * 10 / f.d), zooms = tier(lvl, 0, 1, 2);
    var why = (form === 'frac' ? fs(f) + ' = ' + dec + '. ' : '') + dec + ' se află ' + (zooms === 0 ? 'la ' + (tenths % 10 === 1 ? 'o zecime' : (tenths % 10) + ' zecimi') + ' după ' + Math.floor(f.n / f.d) + '.' : 'între ' + fd(F(tenths, 10)) + ' și ' + fd(F(tenths + 1, 10)) + '. Mărim acest interval, care are 10 părți egale (sutimi)' + (zooms >= 2 ? ', apoi mărim încă o dată (miimi)' : '') + ' și numărăm diviziunile.');
    return { t: 'zoom', mode: 'find', lo: Math.floor(f.n / f.d), target: f, q: 'Găsește pe axă numărul ' + text + '. Atinge un interval ca să-l mărești, apoi atinge punctul.',
      why: why, hint: zooms === 0 ? 'Numără zecimile de la ' + Math.floor(f.n / f.d) + '.' : 'Citește zecimile, apoi mărește intervalul și citește sutimile.' };
  };
  G.zoomBetween = function (R, lvl) {
    var lo = lvl === 2 ? R.int(1, 4) : 0, A, B;
    if (lvl === 0) { var t = R.int(1, 8); A = F(lo * 10 + t, 10); B = F(lo * 10 + t + 1, 10); }
    else { var tt = R.int(10, 89); if (tt % 10 === 9) tt--; A = F(lo * 100 + tt, 100); B = F(lo * 100 + tt + 1, 100); }
    var M = PM.div(PM.add(A, B), F(2));
    return { t: 'zoom', mode: 'between', lo: lo, A: A, B: B, q: 'Găsește un număr care se află între ' + fd(A) + ' și ' + fd(B) + '. Mărește axa până îl vezi.',
      why: 'Între ' + fd(A) + ' și ' + fd(B) + ' sunt mai multe numere, de exemplu ' + fd(M) + '. Oricât de apropiate ar fi două numere, mai există altele între ele: mărim intervalul și apar mai multe diviziuni.',
      hint: 'Atinge intervalul dintre cele două numere ca să-l împarți în 10 părți.' };
  };

  /* ---------------- 5. împărțirea își găsește perioada ---------------- */
  G.remRepeat = function (R, lvl) {
    var ds = tier(lvl, [3, 6, 9, 11], [7, 12, 13, 15, 18], [7, 13, 14, 21, 26]), d = R.pick(ds), n, tries = 0;
    do { n = R.int(1, d * 2 - 1); tries++; } while ((gcd(n, d) !== 1 || n % d === 0) && tries < 40);
    var q0 = Math.floor(n / d), r0 = n % d, seen = {}, rows = [], r = r0, digits = [], at = 0;
    seen[r0] = 0;
    for (var i = 1; i < 40; i++) {
      var x = r * 10, dg = Math.floor(x / d), rr = x % d;
      rows.push({ x: x, dg: dg, r: rr }); digits.push(dg);
      if (seen[rr] !== undefined) { at = i; var first = seen[rr]; return finish(first, i); }
      seen[rr] = i; r = rr;
    }
    function finish(first, atIdx) {
      var info = PM.decInfo(F(n, d)), per = info.per, pre = info.pre;
      return { t: 'rem', n: n, d: d, q0: q0, r0: r0, rows: rows, at: atIdx, first: first,
        q: 'Împarte ' + n + ' la ' + d + ' pas cu pas. Apasă rândul în care apare un rest care a mai fost.',
        why: 'Restul ' + rows[atIdx - 1].r + ' a mai apărut' + (first === 0 ? ' chiar la început' : ' la pasul ' + first) + ', deci cifrele dintre cele două apariții se repetă la nesfârșit: perioada este (' + per + '). ' + fr(n, d) + ' = ' + fd(F(n, d)) + '.',
        hint: 'Caută două rânduri care au același rest. Apasă pe al doilea.' };
    }
    return { t: 'rem', n: 1, d: 3, q0: 0, r0: 1, rows: [{ x: 10, dg: 3, r: 1 }], at: 1, first: 0, q: 'Împarte 1 la 3 pas cu pas. Apasă rândul în care apare un rest care a mai fost.', why: 'Restul 1 a mai apărut chiar la început, deci cifra 3 se repetă: 0,(3).', hint: 'Caută două rânduri cu același rest.' };
  };

  /* ---------------- 6. întregi din bucăți ---------------- */
  G.wholesFill = function (R, lvl) {
    var d, n, tries = 0, maxC = tier(lvl, 2, 3, 3);
    do {
      d = R.int(2, tier(lvl, 5, 6, 8));
      n = R.int(d + 1, d * maxC - 1);
    } while ((n % d === 0 || Math.ceil(n / d) > maxC) && tries++ < 60);
    if (n % d === 0) n = d + 1;
    var q = Math.floor(n / d), r = n % d, f = fr(n, d);
    return { t: 'wholes', n: n, d: d, q: 'Trage cele ' + n + ' bucăți de ' + fr(1, d) + ' în cercuri. Umple cât mai multe cercuri întregi.',
      why: f + ' înseamnă ' + n + ' bucăți de ' + fr(1, d) + '. Un cerc plin are ' + d + ' bucăți, deci umplem ' + q + (q === 1 ? ' cerc' : ' cercuri') + ' și rămân ' + r + (r === 1 ? ' bucată' : ' bucăți') + ': ' + f + ' = ' + q + fr(r, d) + '.',
      hint: 'Un cerc se umple când are ' + d + ' bucăți. Câte cercuri pline poți face?' };
  };
})(typeof window !== 'undefined' ? window : globalThis);
