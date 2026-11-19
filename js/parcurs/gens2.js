/* ============================================================
   Parcurs: generatoare noi pentru secțiunea 1 (Mulțimea numerelor raționale), scrise după tipurile de itemi din manualul clasei a 7-a:
   alegerea numerelor după mulțime, scrierea ca {m/n}, numere mixte (scoate / introdu întregii), egalitate adevărată sau falsă cu produsele în cruce,
   perechi de fracții echivalente, citirea numerelor zecimale, numere mixte în zecimale, perioada, zecimale periodice simple și mixte în fracții.
   Se adaugă în același obiect G din gens.js (încărcat înaintea acestui fișier). Același format de specificații ca acolo, plus tipul nou:
     mixed  {q, eq?, a:{w, n, d}}   răspuns ca număr mixt: w întregi (poate fi negativ) și fracția n/d, 0 < n < d, ireductibilă
   ============================================================ */
(function (root) {
  'use strict';
  var PM = (typeof module !== 'undefined' && module.exports) ? require('./lib.js') : root.PM;
  var PG = (typeof module !== 'undefined' && module.exports) ? require('./gens.js') : root.PG;
  var G = PG.G, H = PG.helpers, tier = PG.tier, mcS = H.mcS, fr = H.fr, int = H.int, coprime = H.coprime;
  var F = PM.F, fs = PM.fmtF, fd = PM.fmtDec, raw = PM.fmtRaw, gcd = PM.gcd;

  /* ---------- scrieri ---------- */
  var mixedStr = function (w, n, d) { return (w < 0 ? '−' : '') + Math.abs(w) + '{' + n + '/' + d + '}'; };
  var pow10 = function (k) { return Math.pow(10, k); };
  var nines = function (k) { return pow10(k) - 1; };
  var rep = function (ch, k) { var s = ''; while (k-- > 0) s += ch; return s; };
  var pick2 = function (R, a, b) { return R.bool() ? a : b; };

  /* ---------- numerale românești, pentru citirea numerelor zecimale ---------- */
  var ONES_M = ['zero', 'unu', 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă', 'zece', 'unsprezece', 'doisprezece', 'treisprezece', 'paisprezece', 'cincisprezece', 'șaisprezece', 'șaptesprezece', 'optsprezece', 'nouăsprezece'];
  var ONES_F = ONES_M.slice(); ONES_F[1] = 'una'; ONES_F[2] = 'două'; ONES_F[12] = 'douăsprezece';
  var TENS = ['', '', 'douăzeci', 'treizeci', 'patruzeci', 'cincizeci', 'șaizeci', 'șaptezeci', 'optzeci', 'nouăzeci'];
  function words(n, f) {
    var ones = f ? ONES_F : ONES_M, h = Math.floor(n / 100), r = n % 100, out = [];
    if (h) out.push(h === 1 ? 'o sută' : ONES_F[h] + ' sute');
    if (r || !h) out.push(r < 20 ? ones[r] : TENS[Math.floor(r / 10)] + (r % 10 ? ' și ' + ones[r % 10] : ''));
    return out.join(' ');
  }
  /* "de" apare după numerele de la 20 în sus, dacă ultimele două cifre nu sunt între 01 și 19: douăzeci de sutimi, dar douăsprezece sutimi */
  var needsDe = function (n) { return n >= 20 && (n % 100 === 0 || n % 100 >= 20); };
  var PLACE = ['zecimi', 'sutimi', 'miimi'], PLACE1 = ['zecime', 'sutime', 'miime'];
  function wholeWords(n) { return n === 1 ? 'un întreg' : words(n, false) + (needsDe(n) ? ' de' : '') + ' întregi'; }
  function decWords(digits) {
    var v = parseInt(digits, 10), k = digits.length - 1;
    return v === 1 ? 'o ' + PLACE1[k] : words(v, true) + (needsDe(v) ? ' de ' : ' ') + PLACE[k];
  }
  function perWords(per) {
    var z = 0; while (z < per.length - 1 && per[z] === '0') z++;
    var out = []; for (var i = 0; i < z; i++) out.push('zero');
    out.push(words(parseInt(per.slice(z), 10), false));
    return out.join(' ');
  }

  /* ---------- numere pentru alegerea după mulțime ---------- */
  function setItem(R, lvl) {
    var kinds = tier(lvl, ['int', 'int', 'dec', 'frac'], ['int', 'dec', 'frac', 'mixed', 'fracInt'], ['int', 'dec', 'frac', 'mixed', 'fracInt', 'per']);
    var k = R.pick(kinds), v, t;
    if (k === 'int') { v = R.pick([0, 0, R.int(1, 40), R.int(1, 200), -R.int(1, 60), -R.int(1, 40)]); return [int(v), F(v)]; }
    if (k === 'dec') { var pl = R.int(1, 2), x = R.int(1, 99) * (R.bool(0.3) ? -1 : 1); if (x % 10 === 0) x++; v = F(x, pow10(pl)); return [fd(v), v]; }
    if (k === 'frac') { var d = R.int(2, 12), n = R.int(1, d * 2); if (!coprime(n, d) || n === d) return setItem(R, lvl); v = F(n * (R.bool(0.3) ? -1 : 1), d); return [fs(v), v]; }
    if (k === 'fracInt') { var d2 = R.int(2, 6), m = R.int(1, 9) * (R.bool(0.4) ? -1 : 1); t = raw(m * d2, d2); return [t, F(m)]; }
    if (k === 'mixed') { var d3 = R.int(2, 12), r = R.int(1, d3 - 1), w = R.int(1, 9); if (!coprime(r, d3)) return setItem(R, lvl); var sg = R.bool(0.3) ? -1 : 1; return [mixedStr(sg * w, r, d3), F(sg * (w * d3 + r), d3)]; }
    var dd = R.pick([3, 6, 9, 11, 12, 15]), nn = R.int(1, dd * 3); if (!coprime(nn, dd) || PM.isFiniteDec(F(nn, dd))) return setItem(R, lvl);
    v = F(nn * (R.bool(0.4) ? -1 : 1), dd); return [fd(v), v];
  }
  var isInt = function (f) { return f.d === 1; };
  var SET_Q = [
    { name: 'întregi', ok: isInt, rule: 'Un număr este întreg când nu are parte fracționară: fracțiile care se împart exact ({8/2} = 4) și zecimalele cu zero după virgulă sunt întregi, dar 3,5 sau {7/2} nu sunt.' },
    { name: 'naturale', ok: function (f) { return f.d === 1 && f.n >= 0; }, rule: 'Numerele naturale sunt 0, 1, 2, 3… Un număr negativ sau unul cu parte fracționară nu este natural.' },
    { name: 'raționale negative', ok: function (f) { return f.n < 0; }, rule: 'Toate numerele de aici sunt raționale. Cele negative sunt cele cu minus în față.' },
    { name: 'raționale care nu sunt întregi', ok: function (f) { return f.d !== 1; }, rule: 'Sunt raționale și nu sunt întregi acele numere care au parte fracționară, adică la care rămâne o fracție ireductibilă cu numitorul mai mare ca 1.' }
  ];
  G.pickSet = function (R, lvl) {
    var N = tier(lvl, 6, 7, 8), qd = R.pick(SET_Q), tries = 0, items, ans;
    do {
      items = []; var seen = {};
      while (items.length < N) { var it = setItem(R, lvl); if (!seen[it[0]]) { seen[it[0]] = 1; items.push(it); } }
      ans = []; items.forEach(function (it, i) { if (qd.ok(it[1])) ans.push(i); });
    } while ((ans.length < 2 || ans.length > N - 2) && ++tries < 200);
    if (ans.length < 1 || ans.length >= N) return G.pickSet(R, lvl);
    return { t: 'multi', q: R.pick(['Alege toate numerele ' + qd.name + '.', 'Selectează numerele ' + qd.name + '.', 'Care dintre numere sunt ' + qd.name + '? Alege-le pe toate.']),
      opts: items.map(function (it) { return it[0]; }), ans: ans,
      why: 'Sunt ' + qd.name + ': ' + ans.map(function (i) { return items[i][0]; }).join(', ') + '. ' + qd.rule, hint: 'Adu fiecare număr la o formă simplă (împarte fracțiile, citește zecimalele) și verifică pe rând.' };
  };

  /* ---------- scrie numărul ca {m/n} ---------- */
  G.writeMN = function (R, lvl) {
    var kind = R.pick(tier(lvl, ['int', 'mixed', 'mixed'], ['mixed', 'mixed', 'dec', 'int'], ['mixed', 'dec', 'dec', 'mixedNeg'])), eq, a, why, hint;
    if (kind === 'int') { var v = R.int(2, 30) * (lvl > 0 && R.bool(0.4) ? -1 : 1); eq = int(v); a = F(v); why = 'Orice număr întreg are numitorul 1: ' + int(v) + ' = {' + int(v) + '/1}.'; hint = 'Numitorul poate fi 1.'; }
    else if (kind === 'mixed' || kind === 'mixedNeg') {
      var d = R.int(2, tier(lvl, 6, 9, 12)), r = R.int(1, d - 1), w = R.int(1, tier(lvl, 6, 9, 15)), sg = kind === 'mixedNeg' || (lvl > 0 && R.bool(0.35)) ? -1 : 1;
      eq = mixedStr(sg * w, r, d); a = F(sg * (w * d + r), d);
      why = (sg < 0 ? '−' : '') + w + '{' + r + '/' + d + '} = ' + (sg < 0 ? '−' : '') + '{' + w + '·' + d + '+' + r + '/' + d + '} = ' + (sg < 0 ? '−' : '') + '{' + (w * d + r) + '/' + d + '}. Înmulțim întregii cu numitorul și adunăm numărătorul.';
      hint = 'Întregii se înmulțesc cu numitorul, apoi se adaugă numărătorul.';
    } else {
      var pl = lvl === 2 ? R.int(1, 2) : 1, x = R.int(11, pl === 1 ? 99 : 999) * (R.bool(0.5) ? -1 : 1); if (x % 10 === 0) x++;
      var s = x < 0 ? '−' : '', ax = Math.abs(x), dd = pow10(pl);
      a = F(x, dd);
      eq = s + Math.floor(ax / dd) + ',' + String(ax % dd).padStart(pl, '0');
      why = eq + ' = ' + s + '{' + ax + '/' + dd + '}. Numărul de zecimale arată câte zerouri are numitorul.' + (a.d !== dd ? ' Se poate și simplifica: ' + fs(a) + '.' : '');
      hint = 'Zecimalele se citesc ca fracție cu numitorul 10, 100…';
    }
    return { t: 'num', q: R.pick(['Scrie numărul sub forma {m/n}, cu m număr întreg și n număr natural nenul.', 'Scrie numărul ca fracție {m/n}.', 'Transformă numărul într-o fracție {m/n} (m ∈ ℤ, n ∈ ℕ*).']), eq: eq, a: a, form: 'frac', why: why, hint: hint };
  };

  /* ---------- fracții echivalente: adevărat sau fals, perechi, locuri goale ---------- */
  G.tfEquiv = function (R, lvl) {
    var b = R.int(2, tier(lvl, 7, 9, 12)), a = R.int(1, b + 2), k = R.int(2, tier(lvl, 5, 7, 9)), truth = R.bool(), n2 = a * k, d2 = b * k;
    if (!coprime(a, b)) { b = b + 1; if (!coprime(a, b)) a = 1; d2 = b * k; n2 = a * k; }
    if (!truth) {
      var way = R.int(0, 2);
      if (way === 0) n2 = n2 + R.pick([-1, 1, 2]);
      else if (way === 1) d2 = d2 + R.pick([-1, 1, 2]);
      else { n2 = a + k; d2 = b + k; }
      if (n2 < 1 || d2 < 2 || a * d2 === b * n2) { n2 = a * k + 1; d2 = b * k; }
    }
    var eqv = a * d2 === b * n2;
    return { t: 'mc', q: R.pick(['Adevărat sau fals?', 'Este adevărată egalitatea?', 'Sunt echivalente cele două fracții?']), eq: fr(a, b) + ' = ' + fr(n2, d2), opts: ['Adevărat', 'Fals'], a: eqv ? 0 : 1, fixed: true,
      why: 'Verificăm cu produsele în cruce: ' + a + '·' + d2 + ' = ' + (a * d2) + ' și ' + b + '·' + n2 + ' = ' + (b * n2) + '. ' + (eqv ? 'Sunt egale, deci fracțiile sunt echivalente.' : 'Nu sunt egale, deci fracțiile nu sunt echivalente.'),
      hint: 'Fracțiile {a/b} și {c/d} sunt echivalente dacă a·d = b·c.' };
  };
  G.matchEquiv = function (R, lvl) {
    var n = tier(lvl, 3, 4, 4), bases = [], seen = {}, g = 0;
    while (bases.length < n && g++ < 200) { var f = H.pickFrac(R, 2, 9, R.bool(0.7)); var key = f.n + '/' + f.d; if (!seen[key]) { seen[key] = 1; bases.push(f); } }
    var pairs = bases.map(function (f, i) {
      var k1 = R.int(2, 5), k2 = R.int(2, 6); if (k2 === k1) k2 = k1 + 1;
      var left = fr(f.n * k1, f.d * k1), right = lvl === 2 && i === 0 ? fr(f.n, f.d) : fr(f.n * k2, f.d * k2);
      return [left, right];
    });
    return { t: 'match', q: R.pick(['Găsește perechile de fracții echivalente (egale).', 'Unește fiecare fracție cu cea egală cu ea.']), pairs: pairs,
      why: 'Fiecare pereche are aceeași valoare: ' + pairs.map(function (p) { return p[0] + ' = ' + p[1]; }).join('; ') + '. Se verifică prin amplificare, simplificare sau produsele în cruce.', hint: 'Simplifică fiecare fracție până devine ireductibilă; cele echivalente ajung la aceeași fracție.' };
  };
  G.equivFill2 = function (R, lvl) {
    var b = R.int(2, tier(lvl, 6, 9, 12)), a = R.int(1, b + 2), k = R.int(2, tier(lvl, 5, 8, 11)), kind = R.int(0, 2), eq, ans, why;
    if (!coprime(a, b)) a = 1;
    if (kind === 0) { eq = fr(a, b) + ' = {' + (a * k) + '/▢}'; ans = b * k; why = 'Numărătorul s-a înmulțit cu ' + k + ' (' + a + '·' + k + ' = ' + (a * k) + '), deci înmulțim și numitorul: ' + b + '·' + k + ' = ' + (b * k) + '.'; }
    else if (kind === 1) { eq = '{' + (a * k) + '/' + (b * k) + '} = {▢/' + b + '}'; ans = a; why = 'Numitorul s-a împărțit la ' + k + ' (' + (b * k) + ':' + k + ' = ' + b + '), deci împărțim și numărătorul: ' + (a * k) + ':' + k + ' = ' + a + '.'; }
    else { eq = '{' + (a * k) + '/' + (b * k) + '} = {' + a + '/▢}'; ans = b; why = 'Numărătorul s-a împărțit la ' + k + ' (' + (a * k) + ':' + k + ' = ' + a + '), deci împărțim și numitorul: ' + (b * k) + ':' + k + ' = ' + b + '.'; }
    return { t: 'num', q: R.pick(['Completează căsuța goală.', 'Ce număr lipsește ca fracțiile să fie egale?', 'Scrie numărul care lipsește.']), eq: eq, a: F(ans), form: 'int', why: why, hint: 'Vezi cu ce număr s-a înmulțit (sau s-a împărțit) celălalt termen al fracției.' };
  };

  /* ---------- fracții supraunitare și numere mixte ---------- */
  G.fracKind = function (R, lvl) {
    var d = R.int(2, tier(lvl, 9, 12, 15)), kind = R.pick(['sub', 'sub', 'eq', 'sup', 'sup', 'sup']), n = kind === 'sub' ? R.int(1, d - 1) : kind === 'eq' ? d : R.int(d + 1, d * 3);
    if (R.bool(0.5)) {
      var names = ['subunitară', 'echiunitară', 'supraunitară'], idx = kind === 'sub' ? 0 : kind === 'eq' ? 1 : 2;
      return { t: 'mc', q: R.pick(['Cum este fracția?', 'Ce fel de fracție este aceasta?', 'Cum se numește fracția?']), eq: raw(n, d), opts: names, a: idx, fixed: true,
        why: kind === 'sub' ? 'Numărătorul ' + n + ' este mai mic decât numitorul ' + d + ', deci fracția este subunitară (mai mică decât 1).' : kind === 'eq' ? 'Numărătorul și numitorul sunt egale (' + n + '), deci fracția este echiunitară și valorează 1.' : 'Numărătorul ' + n + ' este mai mare decât numitorul ' + d + ', deci fracția este supraunitară (mai mare decât 1).',
        hint: 'Compară numărătorul cu numitorul.' };
    }
    var want = R.pick(['sup', 'sub']), bads = [], seen = {}, good = want === 'sup' ? raw(R.int(d + 1, d * 3), d) : raw(R.int(1, d - 1), d);
    seen[good] = 1;
    while (bads.length < 3) { var dd = R.int(2, 12), nn = want === 'sup' ? R.int(1, dd - 1) : R.int(dd + 1, dd * 3), s = raw(nn, dd); if (!seen[s]) { seen[s] = 1; bads.push(s); } }
    return mcS(R, want === 'sup' ? 'Care dintre fracții este supraunitară?' : 'Care dintre fracții este subunitară?', good, bads,
      { why: want === 'sup' ? 'O fracție este supraunitară când numărătorul este mai mare decât numitorul. Aici ' + good + ' are numărătorul mai mare.' : 'O fracție este subunitară când numărătorul este mai mic decât numitorul. Aici ' + good + ' are numărătorul mai mic.', hint: 'Compară numărătorul cu numitorul la fiecare.', sameValueOk: true });
  };
  function mixedParts(R, lvl) {
    var d = R.int(2, tier(lvl, 6, 8, 11)), r, g = 0; do { r = R.int(1, d - 1); } while (!coprime(r, d) && g++ < 50); if (!coprime(r, d)) { d = 5; r = 2; }
    return { d: d, r: r, w: R.int(1, tier(lvl, 5, 9, 15)) };
  }
  var CTX = [['Ana a cumpărat ', ' kg de mere. Scrie cantitatea ca număr mixt.'], ['Într-un vas sunt ', ' litri de apă. Scrie cantitatea ca număr mixt.'], ['Un băiat a parcurs ', ' km. Scrie distanța ca număr mixt.'], ['O bucată de sfoară are ', ' m. Scrie lungimea ca număr mixt.'], ['Pentru o prăjitură sunt necesare ', ' kg de făină. Scrie cantitatea ca număr mixt.']];
  G.toMixed = function (R, lvl) {
    var p = mixedParts(R, lvl), n = p.w * p.d + p.r, s = lvl > 0 && R.bool(0.35) ? -1 : 1, word = lvl > 0 && s > 0 && R.bool(0.35), c = R.pick(CTX);
    var q = word ? c[0] + '{' + n + '/' + p.d + '}' + c[1] : R.pick(['Scoate întregii din fracție.', 'Scrie fracția ca număr mixt (întregi și fracție).', 'Câți întregi sunt în fracție? Scrie numărul mixt.']);
    return { t: 'mixed', q: q, eq: word ? undefined : (s < 0 ? '−' : '') + '{' + n + '/' + p.d + '}', a: { w: s * p.w, n: p.r, d: p.d },
      why: n + ' : ' + p.d + ' = ' + p.w + ', rest ' + p.r + '. Câtul sunt întregii, iar restul devine numărătorul: ' + (s < 0 ? '−' : '') + '{' + n + '/' + p.d + '} = ' + mixedStr(s * p.w, p.r, p.d) + '.',
      hint: 'Împarte numărătorul la numitor. Câtul sunt întregii, restul este noul numărător, iar numitorul rămâne.' };
  };
  G.fromMixed = function (R, lvl) {
    var p = mixedParts(R, lvl), s = lvl > 0 && R.bool(0.35) ? -1 : 1, n = p.w * p.d + p.r;
    return { t: 'num', q: R.pick(['Introdu întregii în fracție.', 'Scrie numărul mixt ca o singură fracție.', 'Transformă numărul mixt în fracție.']), eq: mixedStr(s * p.w, p.r, p.d), a: F(s * n, p.d), form: 'frac',
      why: mixedStr(s * p.w, p.r, p.d) + ' = ' + (s < 0 ? '−' : '') + '{' + p.w + '·' + p.d + '+' + p.r + '/' + p.d + '} = ' + (s < 0 ? '−' : '') + '{' + n + '/' + p.d + '}. Întregii se înmulțesc cu numitorul, apoi se adaugă numărătorul.',
      hint: 'Numărătorul nou este întregii · numitor + numărătorul vechi. Numitorul rămâne.' };
  };
  G.mixedMc = function (R, lvl) {
    var p = mixedParts(R, lvl), n = p.w * p.d + p.r;
    if (R.bool(0.5)) {
      var good = mixedStr(p.w, p.r, p.d), bads = [mixedStr(p.w + 1, p.r, p.d), mixedStr(p.w, p.d - p.r, p.d), mixedStr(Math.max(1, p.w - 1), p.r, p.d), mixedStr(p.w, p.r, p.d + 1)], seen = {};
      seen[good] = 1; bads = bads.filter(function (b) { if (seen[b]) return false; seen[b] = 1; return true; });
      return mcS(R, 'Care număr mixt este egal cu fracția ' + fr(n, p.d) + ' ?', good, bads, { why: n + ' : ' + p.d + ' = ' + p.w + ', rest ' + p.r + ', deci {' + n + '/' + p.d + '} = ' + good + '.', hint: 'Câtul sunt întregii, restul este numărătorul.', sameValueOk: true });
    }
    var goodF = fr(n, p.d), badF = [fr(p.w * p.r + p.d, p.d), fr(p.w + p.r, p.d), fr(n, p.r === 1 ? p.d + 1 : p.r), fr(n + p.d, p.d)], seenF = {}, wrongs = [];
    seenF[goodF] = 1; badF.forEach(function (b) { if (!seenF[b]) { seenF[b] = 1; wrongs.push(b); } });
    wrongs = wrongs.filter(function (w) { var m = /\{(\d+)\/(\d+)\}/.exec(w); return !PM.eq(F(+m[1], +m[2]), F(n, p.d)); });
    return mcS(R, 'Care fracție este egală cu numărul mixt ' + mixedStr(p.w, p.r, p.d) + ' ?', goodF, wrongs, { why: mixedStr(p.w, p.r, p.d) + ' = {' + p.w + '·' + p.d + '+' + p.r + '/' + p.d + '} = ' + goodF + '. Întregii se înmulțesc cu numitorul și se adaugă numărătorul.', hint: 'Întregii · numitor + numărător, deasupra aceluiași numitor.' });
  };
  G.mixedBug = function (R, lvl) {
    var p = mixedParts(R, lvl), type = R.int(0, 2), w = type === 0 ? Math.max(2, p.w) : p.w, r = p.r, d = p.d, n = w * d + r, lines, bad, why;
    var head = 'Introducem întregii în fracție: ' + mixedStr(w, r, d) + '.';
    if (type === 0) {
      var wr = w * r + d;
      lines = [head, '= {' + w + '·' + r + '+' + d + '/' + d + '}', '= {' + wr + '/' + d + '}', 'Răspuns: {' + wr + '/' + d + '}'];
      bad = 1; why = 'Întregii se înmulțesc cu numitorul, nu cu numărătorul: {' + w + '·' + d + '+' + r + '/' + d + '} = {' + n + '/' + d + '}.';
    } else if (type === 1) {
      var off = R.pick([-1, 1, 2]), wrong = n + off; if (wrong < 1) wrong = n + 1;
      lines = [head, '= {' + w + '·' + d + '+' + r + '/' + d + '}', '= {' + wrong + '/' + d + '}', 'Răspuns: {' + wrong + '/' + d + '}'];
      bad = 2; why = 'La calcul: ' + w + '·' + d + ' = ' + (w * d) + ', iar ' + (w * d) + ' + ' + r + ' = ' + n + ', deci rezultatul corect este {' + n + '/' + d + '}.';
    } else {
      var wrongD = r === d ? d + 1 : r;
      lines = [head, '= {' + w + '·' + d + '+' + r + '/' + d + '}', '= {' + n + '/' + d + '}', 'Răspuns: {' + n + '/' + wrongD + '}'];
      bad = 3; why = 'Numitorul rămâne același, ' + d + '. Răspunsul corect este {' + n + '/' + d + '}.';
    }
    return { t: 'bug', q: 'Elevul a rezolvat greșit. Care linie conține greșeala?', lines: lines, bad: bad, why: why, hint: 'Refă calculul pe un caiet, pas cu pas, și compară cu fiecare linie.' };
  };

  /* ---------- numere zecimale ---------- */
  G.readDec = function (R, lvl) {
    var pl = tier(lvl, 1, 2, 3), whole = R.int(0, tier(lvl, 9, 40, 99)), digs = '', i;
    do { digs = ''; for (i = 0; i < pl; i++) digs += R.int(0, 9); } while (/^0+$/.test(digs) || (pl > 1 && digs[pl - 1] === '0'));
    var shown = whole + ',' + digs, good = wholeWords(whole) + ' și ' + decWords(digs);
    var other = PLACE[(pl % 3)], wrongPlace = wholeWords(whole) + ' și ' + words(parseInt(digs, 10), true) + (needsDe(parseInt(digs, 10)) ? ' de ' : ' ') + other;
    var swapW = wholeWords(whole === 0 ? 1 : whole + 1) + ' și ' + decWords(digs);
    var d2 = digs.split('').reverse().join(''), swapD = /^0+$/.test(d2) || d2[d2.length - 1] === '0' && pl > 1 ? null : wholeWords(whole) + ' și ' + decWords(d2);
    var onlyWhole = wholeWords(parseInt(digs, 10)) + ' și ' + decWords(String(whole === 0 ? 1 : whole).slice(0, 1));
    var wrongs = [wrongPlace, swapW, swapD, onlyWhole].filter(function (x) { return x && x !== good; });
    return mcS(R, 'Cum se citește numărul ' + shown + ' ?', good, wrongs, { why: shown + ' are partea întreagă ' + whole + ' și partea zecimală ' + digs + ' (' + PLACE[pl - 1] + '). Se citește: ' + good + '.', hint: 'Prima cifră după virgulă înseamnă zecimi, a doua sutimi, a treia miimi. Numele se potrivește cu ultima cifră.', sameValueOk: true });
  };
  G.mixedToDec = function (R, lvl) {
    var d = R.pick(tier(lvl, [2, 4, 5, 10], [2, 4, 5, 8, 10, 20], [4, 5, 8, 20, 25])), r, g = 0; do { r = R.int(1, d - 1); } while (!coprime(r, d) && g++ < 60); if (!coprime(r, d)) r = 1;
    var w = R.int(1, tier(lvl, 6, 12, 40)), s = lvl > 1 && R.bool(0.35) ? -1 : 1, n = w * d + r, f = F(s * n, d), frac = fd(F(r, d));
    return { t: 'num', q: R.pick(['Scrie numărul mixt ca număr zecimal.', 'Transformă numărul mixt în număr zecimal.']), eq: mixedStr(s * w, r, d), a: f, form: 'dec',
      why: 'Metoda 1: {' + r + '/' + d + '} = ' + r + ' : ' + d + ' = ' + frac + ', deci ' + mixedStr(w, r, d) + ' = ' + w + ' + ' + frac + ' = ' + fd(F(n, d)) + '. Metoda 2: {' + n + '/' + d + '} = ' + n + ' : ' + d + ' = ' + fd(F(n, d)) + '.' + (s < 0 ? ' Numărul are minus, deci ' + fd(f) + '.' : ''),
      hint: 'Fie transformi doar fracția din număr în zecimal și o aduni la întregi, fie introduci întregii în fracție și împarți.' };
  };
  G.decToMixed = function (R, lvl) {
    var pl = tier(lvl, 1, 1, 2), w = R.int(1, tier(lvl, 5, 9, 20)), frac, g = 0, x;
    do { x = R.int(1, pow10(pl) - 1); frac = F(x, pow10(pl)); } while ((frac.d === 1 || x % 10 === 0 && pl === 2) && g++ < 80);
    var s = lvl > 0 && R.bool(0.3) ? -1 : 1, shown = (s < 0 ? '−' : '') + w + ',' + String(x).padStart(pl, '0');
    return { t: 'mixed', q: R.pick(['Scrie numărul zecimal ca număr mixt, cu fracția ireductibilă.', 'Transformă zecimalul în număr mixt (fracția să fie ireductibilă).']), eq: shown, a: { w: s * w, n: frac.n, d: frac.d },
      why: shown + ' = ' + (s < 0 ? '−' : '') + '(' + w + ' + 0,' + String(x).padStart(pl, '0') + ') = ' + (s < 0 ? '−' : '') + '(' + w + ' + {' + x + '/' + pow10(pl) + '}) = ' + mixedStr(s * w, frac.n, frac.d) + '. Partea zecimală se scrie ca fracție și se simplifică.', hint: 'Partea întreagă rămâne întregii. Partea zecimală devine o fracție cu numitorul 10 sau 100, apoi o simplifici.' };
  };
  var DPLACE = { '-1': 'zecimilor', '-2': 'sutimilor', '-3': 'miimilor', 0: 'unităților', 1: 'zecilor' };
  G.decDigit = function (R, lvl) {
    var pl = tier(lvl, 2, 3, 3), wl = tier(lvl, 1, 2, 2), digs = R.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, wl + pl);
    if (digs[0] === 0) { digs[0] = digs[1]; digs[1] = 0; }
    var whole = digs.slice(0, wl).join(''), dec = digs.slice(wl).join(''), shown = whole + ',' + dec;
    var opts = []; for (var e = wl - 1; e >= 1; e--) opts.push(e); opts.push(0); for (var k = 1; k <= pl; k++) opts.push(-k);
    var pos = R.pick(opts), digit = pos >= 0 ? +whole[wl - 1 - pos] : +dec[-pos - 1];
    return { t: 'num', q: R.pick(['Care este cifra ' + DPLACE[pos] + ' din numărul ' + shown + '?', 'În numărul ' + shown + ', care este cifra ' + DPLACE[pos] + '?']), a: F(digit), form: 'int',
      why: 'În ' + shown + ': ' + whole.split('').map(function (c, i) { return 'cifra ' + DPLACE[wl - 1 - i] + ' este ' + c; }).join(', ') + ', ' + dec.split('').map(function (c, i) { return 'cifra ' + DPLACE[-(i + 1)] + ' este ' + c; }).join(', ') + '. Deci cifra ' + DPLACE[pos] + ' este ' + digit + '.', hint: 'Mergi din virgulă: întâi zecimi, apoi sutimi, apoi miimi. Spre stânga: unități, zeci.' };
  };

  /* ---------- zecimale periodice: perioada, tipul, citirea ---------- */
  var DIVS = [[2, 3], [5, 6], [15, 11], [14, 12], [63, 22], [7, 9], [10, 3], [8, 11], [17, 6], [25, 12], [13, 15], [19, 18], [5, 9], [4, 11], [11, 6], [31, 30], [20, 9], [29, 12], [41, 33], [53, 45]];
  G.divPeriod = function (R, lvl) {
    var pairs = tier(lvl, DIVS.slice(0, 8), DIVS.slice(2, 14), DIVS.slice(4)), p = R.pick(pairs), f = F(p[0], p[1]);
    return { t: 'num', q: R.pick(['Efectuează împărțirea și scrie rezultatul ca număr zecimal periodic.', 'Împarte și scrie câtul cu perioada între paranteze.']), eq: p[0] + ' : ' + p[1], a: f, form: 'per',
      why: p[0] + ' : ' + p[1] + ' = ' + (function () { var x = PM.decInfo(f); return (x.neg ? '−' : '') + x.ip + ',' + x.pre + x.per + x.per; })() + '… Resturile se repetă, deci cifrele din perioadă se repetă: ' + fd(f) + '.', hint: 'Împarte până când un rest apare a doua oară. De acolo cifrele se repetă. Scrie perioada între paranteze.' };
  };
  function randDigits(R, k, nonZeroFirst) { var s = '', i; for (i = 0; i < k; i++) s += i === 0 && nonZeroFirst ? R.int(1, 9) : R.int(0, 9); return s; }
  function periodic(R, kind, perLen, preLen) {
    var ip = R.int(0, 20), pre = kind === 'mixed' ? randDigits(R, preLen, true) : '', per, g = 0;
    do { per = randDigits(R, perLen, true); } while (((/^(\d)\1*$/.test(per) && perLen > 1) || per === rep('9', perLen) || (kind === 'mixed' && per === pre)) && g++ < 40);
    return { ip: ip, pre: pre, per: per, text: ip + ',' + pre + '(' + per + ')' };
  }
  G.periodKind = function (R, lvl) {
    var kind = R.pick(tier(lvl, ['simple', 'mixed'], ['simple', 'mixed', 'finite'], ['simple', 'mixed', 'finite'])), x, idx, why;
    if (kind === 'finite') { var pl = R.int(1, 3), dg = randDigits(R, pl, false); if (dg[pl - 1] === '0') dg = dg.slice(0, pl - 1) + R.int(1, 9); x = R.int(0, 30) + ',' + dg; idx = 0; why = x + ' se termină: are un număr finit de zecimale, deci este număr zecimal finit, nu periodic.'; }
    else if (kind === 'simple') { var a = periodic(R, 'simple', R.int(1, 2), 0); x = a.text; idx = 1; why = 'Perioada (' + a.per + ') începe chiar după virgulă, fără cifre care nu se repetă înaintea ei: număr periodic simplu.'; }
    else { var b = periodic(R, 'mixed', R.int(1, 2), R.int(1, 2)); x = b.text; idx = 2; why = 'Între virgulă și perioadă sunt cifre care nu se repetă (' + b.pre + '), partea neperiodică. Deci numărul este periodic mixt.'; }
    return { t: 'mc', q: R.pick(['Ce fel de număr zecimal este acesta?', 'Cum este numărul zecimal?']), eq: x, opts: ['zecimal finit', 'periodic simplu', 'periodic mixt'], a: idx, fixed: true, why: why, hint: 'Se termină? Dacă nu, perioada începe imediat după virgulă (simplu) sau după alte cifre (mixt)?' };
  };
  G.periodDigits = function (R, lvl) {
    var mixed = lvl > 0 && R.bool(0.55) || lvl === 2, x = periodic(R, mixed ? 'mixed' : 'simple', R.int(1, tier(lvl, 2, 3, 3)), R.int(1, 2)), what = mixed ? R.pick(['per', 'pre', 'prelen']) : 'per', q, a, why, hint;
    if (what === 'per') { q = 'Care este perioada numărului ' + x.text + ' ?'; a = F(+x.per); why = 'Perioada este numărul din paranteze: ' + x.per + '.'; hint = 'Perioada este grupul de cifre din paranteză.'; }
    else if (what === 'pre') { q = 'Care este partea neperiodică a numărului ' + x.text + ' ?'; a = F(+x.pre); why = 'Partea neperiodică este formată din zecimalele dintre virgulă și paranteză: ' + x.pre + '.'; hint = 'Sunt cifrele de după virgulă care nu intră în paranteză.'; }
    else { q = 'Câte cifre are partea neperiodică a numărului ' + x.text + ' ?'; a = F(x.pre.length); why = 'Între virgulă și paranteză sunt ' + x.pre.length + (x.pre.length === 1 ? ' cifră' : ' cifre') + ': ' + x.pre + '.'; hint = 'Numără cifrele dintre virgulă și paranteză.'; }
    return { t: 'num', q: q, a: a, form: 'int', why: why, hint: hint };
  };
  G.readPeriodic = function (R, lvl) {
    var mixed = lvl === 2 || (lvl === 1 && R.bool(0.4)), x = periodic(R, mixed ? 'mixed' : 'simple', R.int(1, 2), R.int(1, 2)), whole = x.ip === 0 ? 'zero întregi' : wholeWords(x.ip);
    var preW = function (pre) { return decWords(pre); };
    var good = mixed ? whole + ', ' + preW(x.pre) + ' și ' + perWords(x.per) + ' în perioadă' : whole + ' și ' + perWords(x.per) + ' în perioadă';
    var rev = x.per.split('').reverse().join('');
    var wrongs = [];
    if (mixed) {
      wrongs.push(whole + ', ' + preW(x.pre) + ' și ' + perWords(x.per) + ' ' + PLACE[x.pre.length + x.per.length > 3 ? 2 : x.pre.length + x.per.length - 1]);
      wrongs.push(whole + ', ' + perWords(x.per) + ' și ' + perWords(x.pre) + ' în perioadă');
      if (rev !== x.per) wrongs.push(whole + ', ' + preW(x.pre) + ' și ' + perWords(rev) + ' în perioadă');
    } else {
      wrongs.push(whole + ' și ' + decWords(x.per) + (/\d/.test(x.per) ? '' : ''));
      if (rev !== x.per) wrongs.push(whole + ' și ' + perWords(rev) + ' în perioadă');
      wrongs.push(wholeWords(x.ip + 1) + ' și ' + perWords(x.per) + ' în perioadă');
    }
    wrongs = wrongs.filter(function (w) { return w !== good; });
    return mcS(R, 'Cum se citește numărul ' + x.text + ' ?', good, wrongs, { why: x.text + ': partea întreagă ' + x.ip + (mixed ? ', partea neperiodică ' + x.pre : '') + ', perioada ' + x.per + '. Se citește: ' + good + '.', hint: 'Spune partea întreagă, apoi (la cele mixte) partea neperiodică, apoi perioada urmată de „în perioadă”.', sameValueOk: true });
  };
  G.classifyDec = function (R, lvl) {
    var kind = R.pick(['finite', 'simple', 'mixed']), ds = { finite: [2, 4, 5, 8, 10, 20, 25, 50], simple: [3, 9, 11, 33, 99], mixed: [6, 12, 15, 18, 30, 45, 60, 22] }[kind], d = R.pick(ds), n, g = 0;
    do { n = R.int(1, d * (lvl > 1 ? 2 : 1) - 1); } while (!coprime(n, d) && g++ < 50); if (!coprime(n, d)) n = 1;
    var f = F(n, d), x = PM.decInfo(f), idx = x.per === '' ? 0 : x.pre === '' ? 1 : 2, why;
    var fact = { 2: '2', 4: '2·2', 5: '5', 8: '2·2·2', 10: '2·5', 20: '2·2·5', 25: '5·5', 50: '2·5·5', 3: '3', 9: '3·3', 11: '11', 33: '3·11', 99: '3·3·11', 6: '2·3', 12: '2·2·3', 15: '3·5', 18: '2·3·3', 30: '2·3·5', 45: '3·3·5', 60: '2·2·3·5', 22: '2·11' }[f.d];
    why = 'Numitorul ' + f.d + ' = ' + fact + '. ' + (idx === 0 ? 'Are doar factorii 2 și 5, deci zecimala se termină: ' : idx === 1 ? 'Nu are factorii 2 sau 5, deci zecimala este periodică simplă: ' : 'Are și factorii 2 sau 5, și alți factori primi, deci zecimala este periodică mixtă: ') + fd(f) + '.';
    return { t: 'mc', q: R.pick(['Fracția ireductibilă se scrie ca număr zecimal. Cum este acesta?', 'Ce fel de zecimală se obține din fracție?']), eq: fs(f), opts: ['zecimal finit', 'periodic simplu', 'periodic mixt'], a: idx, fixed: true, why: why,
      hint: 'Descompune numitorul în factori primi. Doar 2 și 5: finit. Fără 2 și 5: periodic simplu. Și 2 sau 5, și altul: periodic mixt.' };
  };

  /* ---------- zecimale periodice în fracții ---------- */
  G.perNines = function (R, lvl) {
    var k = R.int(1, tier(lvl, 2, 3, 3)), per = randDigits(R, k, true), den = nines(k), text = '0,(' + per + ')';
    return { t: 'num', q: R.pick(['Completează căsuța goală.', 'Ce număr lipsește de la numitor?']), eq: text + ' = {' + (+per) + '/▢}', a: F(den), form: 'int',
      why: 'Perioada ' + per + ' are ' + k + (k === 1 ? ' cifră' : ' cifre') + ', deci numitorul are tot atâtea cifre de 9: ' + den + '. ' + text + ' = {' + (+per) + '/' + den + '}.', hint: 'Numitorul este format din tot atâtea cifre de 9 câte cifre are perioada.' };
  };
  G.perSimple0 = function (R, lvl) {
    var k = tier(lvl, 1, 2, R.int(2, 3)), per = randDigits(R, k, true), g = 0; while ((/^(\d)\1*$/.test(per) && k > 1 || per === rep('9', k)) && g++ < 30) per = randDigits(R, k, true);
    if (k === 3 && R.bool(0.35)) per = '00' + R.int(1, 8); else if (k === 2 && lvl > 0 && R.bool(0.3)) per = '0' + R.int(1, 8);
    var num = +per, f = F(num, nines(k)), text = '0,(' + per + ')';
    return { t: 'num', q: R.pick(['Scrie numărul ca fracție ireductibilă.', 'Transformă numărul zecimal periodic în fracție ireductibilă.', 'Care este fracția ireductibilă egală cu numărul?']), eq: text, a: f, form: 'frac', reduced: true,
      why: text + ' = {' + num + '/' + nines(k) + '}' + (f.d !== nines(k) ? ' = ' + fs(f) : '') + '. Numărătorul este perioada, iar numitorul are tot atâtea cifre de 9.' + (f.d !== nines(k) ? ' Simplificăm la final.' : ''), hint: 'Perioada deasupra, tot atâtea cifre de 9 dedesubt. Apoi simplifici.' };
  };
  G.perSimpleInt = function (R, lvl) {
    var k = tier(lvl, 1, 2, R.int(2, 3)), w = R.int(1, tier(lvl, 4, 7, 9)), per = randDigits(R, k, lvl === 2 ? false : true), g = 0; if (+per === 0) per = '1';
    while (/^(\d)\1*$/.test(per) && k > 1 && g++ < 30) per = randDigits(R, k, true);
    var den = nines(k), f = F(w * den + +per, den), text = w + ',(' + per + ')';
    return { t: 'num', q: R.pick(['Scrie numărul ca fracție ireductibilă.', 'Transformă numărul în fracție ireductibilă (poate fi supraunitară).']), eq: text, a: f, form: 'frac', reduced: true,
      why: text + ' = ' + w + ' + 0,(' + per + ') = ' + w + ' + {' + (+per) + '/' + den + '} = ' + w + '{' + (+per) + '/' + den + '} = {' + w + '·' + den + '+' + (+per) + '/' + den + '} = {' + (w * den + +per) + '/' + den + '}' + (f.d !== den ? ' = ' + fs(f) : '') + '.', hint: 'Partea întreagă rămâne deoparte. Transformă 0,(perioada) în fracție, apoi introdu întregii.' };
  };
  G.fracToPerSimple = function (R, lvl) {
    var k = R.int(1, tier(lvl, 2, 2, 3)), per = randDigits(R, k, lvl === 2 ? false : true), g = 0; if (+per === 0) per = '1';
    while (/^(\d)\1*$/.test(per) && k > 1 && g++ < 30) per = randDigits(R, k, true);
    var f = F(+per, nines(k));
    return { t: 'num', q: R.pick(['Scrie fracția ca număr zecimal periodic.', 'Transformă fracția în număr zecimal periodic, cu perioada între paranteze.']), eq: '{' + (+per) + '/' + nines(k) + '}', a: f, form: 'per',
      why: '{' + (+per) + '/' + nines(k) + '} = ' + (+per) + ' : ' + nines(k) + ' = 0,(' + per + '). Numitorul cu ' + k + ' de 9 înseamnă o perioadă de ' + k + (k === 1 ? ' cifră' : ' cifre') + (per[0] === '0' ? ', cu zerourile din față păstrate' : '') + '.', hint: 'Numitorul 9, 99, 999 spune câte cifre are perioada; numărătorul e perioada (completat cu zerouri în față).' };
  };
  G.perSimpleMc = function (R, lvl) {
    var k = R.int(1, tier(lvl, 2, 2, 3)), per = randDigits(R, k, true), w = lvl > 0 && R.bool(0.5) ? R.int(1, 5) : 0, den = nines(k), g = 0;
    while (/^(\d)\1*$/.test(per) && k > 1 && g++ < 30) per = randDigits(R, k, true);
    var text = w + ',(' + per + ')', f = F(w * den + +per, den), good = fs(f), wrongs = [];
    var cand = [F(w * den + +per, nines(Math.max(1, k - 1)) || 9), F(w * den + +per, pow10(k)), F(+per, den), F(w * den + +per, den + 9), F(w * pow10(k) + +per, pow10(k) * 9)];
    cand.forEach(function (c) { var s = fs(c); if (!PM.eq(c, f) && wrongs.indexOf(s) < 0 && s !== good) wrongs.push(s); });
    return mcS(R, 'Care fracție este egală cu ' + text + ' ?', good, wrongs, { why: text + (w ? ' = ' + w + ' + {' + (+per) + '/' + den + '}' : '') + ' = ' + good + '. Numitorul are ' + k + ' de 9 (câte cifre are perioada).', hint: 'Perioada deasupra, cifre de 9 dedesubt (tot atâtea). Cu parte întreagă, introduci întregii.' });
  };
  G.perSimpleBug = function (R, lvl) {
    var k = R.int(1, 2), per, g = 0; do { per = randDigits(R, k, true); } while ((gcd(+per, nines(k)) === 1 || +per === nines(k) || /^(\d)\1*$/.test(per) && k > 1) && g++ < 80);
    var den = nines(k), f = F(+per, den), gg = gcd(+per, den), text = '0,(' + per + ')', type = R.int(0, 2), lines, bad, why;
    var head = 'Transformăm ' + text + ' în fracție ireductibilă.';
    if (type === 0) { var wrongDen = pow10(k); var f2 = F(+per, wrongDen); lines = [head, text + ' = {' + (+per) + '/' + wrongDen + '}', '= ' + fs(f2), 'Răspuns: ' + fs(f2)]; bad = 1; why = 'Numitorul are tot atâtea cifre de 9 câte cifre are perioada: ' + den + ', nu ' + wrongDen + '. Corect: {' + (+per) + '/' + den + '} = ' + fs(f) + '.'; }
    else if (type === 1) { var wd = den / gg + R.pick([1, 2]); lines = [head, text + ' = {' + (+per) + '/' + den + '}', '= {' + (+per) + ':' + gg + '/' + den + ':' + gg + '} = {' + (+per / gg) + '/' + wd + '}', 'Răspuns: {' + (+per / gg) + '/' + wd + '}']; bad = 2; why = 'La simplificare împărțim și numărătorul, și numitorul la ' + gg + ': ' + den + ':' + gg + ' = ' + (den / gg) + '. Corect: ' + fs(f) + '.'; }
    else { lines = [head, text + ' = {' + den + '/' + (+per) + '}', '= ' + fs(F(den, +per)), 'Răspuns: ' + fs(F(den, +per))]; bad = 1; why = 'Numărătorul este perioada (' + per + '), iar numitorul este ' + den + ', nu invers. Corect: {' + (+per) + '/' + den + '} = ' + fs(f) + '.'; }
    return { t: 'bug', q: 'Elevul a rezolvat greșit. Care linie conține greșeala?', lines: lines, bad: bad, why: why, hint: 'Perioada este numărătorul, iar numitorul are tot atâtea cifre de 9. Apoi se simplifică corect.' };
  };

  /* mixte: 0,a(bc) = (abc - a) / 990 */
  function mixedPer(R, lvl) {
    var preLen = R.int(1, tier(lvl, 1, 1, 2)), perLen = R.int(1, tier(lvl, 1, 2, 2)), pre = randDigits(R, preLen, true), per, g = 0;
    do { per = randDigits(R, perLen, false); } while (((per === rep(per[0], perLen) && perLen > 1) || per === rep('9', perLen) || /^0+$/.test(per)) && g++ < 40);
    var a = parseInt(pre + per, 10), b = parseInt(pre, 10), den = nines(perLen) * pow10(preLen);
    return { pre: pre, per: per, preLen: preLen, perLen: perLen, a: a, b: b, num: a - b, den: den, f: F(a - b, den), text: '0,' + pre + '(' + per + ')' };
  }
  G.perMixedFrac = function (R, lvl) {
    var p = mixedPer(R, lvl), w = lvl === 2 && R.bool(0.5) ? R.int(1, 5) : 0, f = F(w * p.den + p.num, p.den), text = w ? w + ',' + p.pre + '(' + p.per + ')' : p.text, why;
    why = text + ' = ' + (w ? w + ' + ' + p.text + ' = ' + w + ' + ' : '') + '{' + p.a + '−' + p.b + '/' + p.den + '} = ' + (w ? w + ' + ' : '') + '{' + p.num + '/' + p.den + '}' + (F(p.num, p.den).d !== p.den ? ' = ' + (w ? w + ' + ' : '') + fs(p.f) : '') + (w ? ' = ' + fs(f) : '') + '. Numărătorul: numărul format din partea neperiodică urmată de perioadă, minus partea neperiodică. Numitorul: cifre de 9 cât perioada, urmate de zerouri cât partea neperiodică.';
    return { t: 'num', q: R.pick(['Scrie numărul ca fracție ireductibilă.', 'Transformă numărul zecimal periodic mixt în fracție ireductibilă.']), eq: text, a: f, form: 'frac', reduced: true, why: why, hint: 'Numărător: (partea neperiodică și perioada, scrise împreună) − partea neperiodică. Numitor: 9 pentru fiecare cifră din perioadă, apoi 0 pentru fiecare cifră neperiodică.' };
  };
  G.perMixedFill = function (R, lvl) {
    var p = mixedPer(R, lvl), kind = R.int(0, 2), eq, ans, why;
    if (kind === 0) { eq = p.text + ' = {▢/' + p.den + '}'; ans = p.num; why = 'Numărătorul este ' + p.a + ' − ' + p.b + ' = ' + p.num + ' (partea neperiodică și perioada scrise împreună, minus partea neperiodică).'; }
    else if (kind === 1) { eq = p.text + ' = {' + p.num + '/▢}'; ans = p.den; why = 'Numitorul are ' + p.perLen + (p.perLen === 1 ? ' cifră de 9' : ' cifre de 9') + ' (câte cifre are perioada), urmate de ' + p.preLen + (p.preLen === 1 ? ' zero' : ' zerouri') + ' (câte cifre are partea neperiodică): ' + p.den + '.'; }
    else { eq = p.text + ' = {' + p.a + '−▢/' + p.den + '}'; ans = p.b; why = 'Din numărul format din partea neperiodică și perioadă (' + p.a + ') se scade partea neperiodică, adică ' + p.b + '.'; }
    return { t: 'num', q: R.pick(['Completează căsuța goală.', 'Ce număr lipsește?']), eq: eq, a: F(ans), form: 'int', why: why, hint: 'Numărătorul: (neperiodică+perioadă) − neperiodică. Numitorul: 9 cât perioada, apoi 0 cât partea neperiodică.' };
  };
  G.perMixedMc = function (R, lvl) {
    var p = mixedPer(R, lvl), good = fs(p.f), cand = [F(p.a, p.den), F(p.num, nines(p.perLen + p.preLen)), F(p.num, nines(p.perLen)), F(p.a - +p.per, p.den), F(p.num, p.den * 10)], wrongs = [];
    cand.forEach(function (c) { var s = fs(c); if (!PM.eq(c, p.f) && wrongs.indexOf(s) < 0 && s !== good) wrongs.push(s); });
    return mcS(R, 'Care fracție este egală cu ' + p.text + ' ?', good, wrongs, { why: p.text + ' = {' + p.a + '−' + p.b + '/' + p.den + '} = {' + p.num + '/' + p.den + '}' + (p.f.d !== p.den ? ' = ' + good : '') + '. Se scade partea neperiodică din numărul format de neperiodică și perioadă.', hint: 'Numărător: (neperiodică+perioadă) − neperiodică. Numitor: 9 cât perioada, apoi 0 cât neperiodica.' });
  };
  G.perMixedBug = function (R, lvl) {
    var p = mixedPer(R, lvl), type = R.int(0, 2), lines, bad, why, head = 'Transformăm ' + p.text + ' în fracție.';
    if (type === 0) {
      lines = [head, p.text + ' = {' + p.a + '/' + p.den + '}', '= ' + fs(F(p.a, p.den)), 'Răspuns: ' + fs(F(p.a, p.den))]; bad = 1;
      why = 'La numărător trebuie să scădem și partea neperiodică: ' + p.a + ' − ' + p.b + ' = ' + p.num + '. Corect: {' + p.num + '/' + p.den + '}' + (p.f.d !== p.den ? ' = ' + fs(p.f) : '') + '.';
    } else if (type === 1) {
      var wd = nines(p.perLen + p.preLen);
      lines = [head, p.text + ' = {' + p.a + '−' + p.b + '/' + wd + '}', '= {' + p.num + '/' + wd + '}', 'Răspuns: ' + fs(F(p.num, wd))]; bad = 1;
      why = 'Numitorul are cifre de 9 doar pentru perioadă (' + p.perLen + '), urmate de zerouri pentru partea neperiodică (' + p.preLen + '): ' + p.den + ', nu ' + wd + '.';
    } else {
      var off = R.pick([-1, 1, 2]), badNum = p.num + off; if (badNum < 1) badNum = p.num + 1;
      lines = [head, p.text + ' = {' + p.a + '−' + p.b + '/' + p.den + '}', '= {' + badNum + '/' + p.den + '}', 'Răspuns: ' + fs(F(badNum, p.den))]; bad = 2;
      why = 'La scădere: ' + p.a + ' − ' + p.b + ' = ' + p.num + ', nu ' + badNum + '. Corect: {' + p.num + '/' + p.den + '}' + (p.f.d !== p.den ? ' = ' + fs(p.f) : '') + '.';
    }
    return { t: 'bug', q: 'Elevul a rezolvat greșit. Care linie conține greșeala?', lines: lines, bad: bad, why: why, hint: 'Refă calculul: numărător (neperiodică+perioadă) − neperiodică, numitor 9…0.' };
  };

  /* afirmații despre scrierea numerelor raționale (din „Rețineți” din manual) */
  var RT = ['Orice număr rațional poate fi scris sub formă de fracție ireductibilă.', 'Orice număr rațional poate fi scris sub formă zecimală.', 'Numerele zecimale periodice sunt numere zecimale infinite.', 'Perioada unui număr zecimal periodic este numărul din parantezele lui.', 'Numărul 2,(8) este un număr zecimal periodic simplu.', 'Numărul 0,7(23) este un număr zecimal periodic mixt.'];
  var RF = ['Un număr zecimal periodic nu poate fi scris sub formă de fracție.', 'Orice număr zecimal este periodic.', 'Numărul 2,(8) este un număr zecimal periodic mixt.', 'Numărul 0,7(23) este un număr zecimal periodic simplu.', 'Numerele zecimale periodice sunt numere zecimale finite.', 'Perioada numărului 0,2(35) este 2.', 'Numerele 0,(3) și 0,3 sunt egale.'];
  G.rationalForms = function (R) {
    var good = R.pick(RT), bad = R.shuffle(RF).slice(0, 3);
    return mcS(R, 'Care afirmație este adevărată?', good, bad, { why: '„' + good + '” este adevărată. Un număr rațional se scrie și ca fracție, și ca număr zecimal (finit sau periodic). Zecimalele periodice au o perioadă care se repetă la nesfârșit; perioada este grupul din paranteze.', hint: 'Gândește-te la definițiile din lecție: perioadă, periodic simplu, periodic mixt.' });
  };
})(typeof window !== 'undefined' ? window : globalThis);
