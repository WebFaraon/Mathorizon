/* ============================================================
   Parcurs: generatoare de exerciții (răspunsul se calculează, nu se scrie de mână).
   Fiecare generator primește (R, lvl): R = hazard (PM.rng), lvl = 0 ușor, 1 mediu, 2 greu, și întoarce o specificație:
     mc     {q, eq?, vis?, opts[], a, fixed?}
     num    {q, eq?, vis?, a:{n,d}, form:'any'|'int'|'dec'|'frac'|'per', reduced?, unit?}
     multi  {q, opts[], ans[]}
     order  {q, eq?, tiles[] (în ordinea corectă)}
     bug    {q, lines[], bad}
     match  {q, pairs[[stânga, dreapta]]}
     axis   {q, min, max, sub, target, start?}
     bar    {q, d, n}
   Toate au `why` (explicația după răspuns) și, de regulă, `hint`.
   ============================================================ */
(function (root) {
  'use strict';
  var PM = (typeof module !== 'undefined' && module.exports) ? require('./lib.js') : root.PM;
  var F = PM.F, fs = PM.fmtF, fd = PM.fmtDec, raw = PM.fmtRaw, gcd = PM.gcd, lcm = PM.lcm;

  var int = function (n) { return (n < 0 ? '−' : '') + Math.abs(n); };
  var intp = function (n) { return n < 0 ? '(' + int(n) + ')' : int(n); };
  var fr = function (n, d) { return '{' + n + '/' + d + '}'; };
  var coprime = function (a, b) { return gcd(a, b) === 1; };
  var G = {};

  /* valoarea unei scrieri simple ({a/b}, −{a/b}, 12, 0,75), ca să nu punem ca greșeală un număr egal cu răspunsul */
  function simpleVal(s) {
    var m = /^(−?)\{(\d+)\/(\d+)\}$/.exec(s);
    if (m) return F((m[1] ? -1 : 1) * parseInt(m[2], 10), parseInt(m[3], 10));
    var p = PM.parseAnswer(s);
    return p ? p.f : null;
  }
  function mcS(R, q, correct, wrongs, extra) {
    var opts = [correct], cv = simpleVal(correct);
    wrongs.forEach(function (w) {
      if (opts.indexOf(w) >= 0) return;
      var wv = simpleVal(w);
      if (cv && wv && PM.eq(cv, wv) && !(extra && extra.sameValueOk)) return;
      opts.push(w);
    });
    opts = opts.slice(0, 4);
    var order = R.shuffle(opts.map(function (_, i) { return i; }));
    var o = { t: 'mc', q: q, opts: order.map(function (i) { return opts[i]; }), a: order.indexOf(0) };
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  /* alege o fracție ireductibilă */
  function pickFrac(R, minD, maxD, proper) {
    for (var i = 0; i < 200; i++) {
      var d = R.int(minD, maxD), n = R.int(1, proper ? d - 1 : d * 2);
      if (n > 0 && coprime(n, d) && n !== d && d > 1) return F(n, d);
    }
    return F(1, 2);
  }
  var tier = function (lvl, a, b, c) { return lvl === 0 ? a : lvl === 1 ? b : c; };

  /* ================= 1.1 Numere raționale ================= */
  G.smallestSet = function (R) {
    var kind = R.pick(['N', 'Z', 'Q', 'Q']), x, set, why;
    if (kind === 'N') { x = String(R.pick([0, 3, 7, 12, 25, 40])); set = 0; why = x + ' este număr natural, deci intră în ℕ (și, mai departe, în ℤ și în ℚ).'; }
    else if (kind === 'Z') { x = '−' + R.int(2, 15); set = 1; why = x + ' are minus și nu are parte fracționară: e număr întreg, dar nu natural. Cea mai mică mulțime este ℤ.'; }
    else { x = R.pick(['{3/4}', '−{1/2}', '0,25', '1,5', '{7/3}', '−0,8', '{5/6}']); set = 2; why = x + ' nu este întreg. Se scrie ca fracție, deci cea mai mică mulțime care îl conține este ℚ.'; }
    return { t: 'mc', q: 'În care este cea mai mică mulțime care conține numărul?', eq: x, opts: ['ℕ (naturale)', 'ℤ (întregi)', 'ℚ (raționale)'], a: set, fixed: true, why: why,
      hint: 'ℕ: 0, 1, 2… ℤ: adaugă și numerele negative. ℚ: adaugă și fracțiile.' };
  };
  G.intAsFrac = function (R, lvl) {
    var n = R.int(1, 9) * (lvl > 0 && R.bool(0.4) ? -1 : 1), b = R.int(2, 9);
    return { t: 'num', q: 'Ce număr lipsește de la numărător?', eq: int(n) + ' = {▢/' + b + '}', a: F(n * b), form: 'int',
      why: 'Orice număr întreg are numitorul 1: ' + int(n) + ' = {' + int(n) + '/1}. Amplificăm cu ' + b + ': {' + int(n) + '·' + b + '/1·' + b + '} = {' + int(n * b) + '/' + b + '}.',
      hint: 'Amplifică fracția {' + int(n) + '/1} cu ' + b + '.' };
  };
  G.signForms = function (R, lvl) {
    var a = R.int(1, 9), b = R.int(2, 9); if (a === b) a = (a % 9) + 1; if (a === b) b++;
    if (lvl < 2) {
      var okS = R.pick(['{−' + a + '/' + b + '}', '{' + a + '/−' + b + '}', '−{' + a + '/' + b + '}']);
      var shown = R.pick(['−{' + a + '/' + b + '}', '{−' + a + '/' + b + '}', '{' + a + '/−' + b + '}'].filter(function (s) { return s !== okS; }));
      return mcS(R, 'Care dintre fracții este egală cu ' + shown + ' ?', okS, ['{' + a + '/' + b + '}', '{−' + a + '/−' + b + '}', '−{' + b + '/' + a + '}'],
        { why: 'Un singur minus, oriunde l-am pune (la numărător, la numitor sau în fața fracției), face fracția negativă: ' + shown + ' = ' + okS + '.', hint: 'Cât timp există un singur minus, fracția e negativă și are aceeași valoare.' });
    }
    return mcS(R, 'Care dintre fracții este egală cu {−' + a + '/−' + b + '} ?', '{' + a + '/' + b + '}', ['−{' + a + '/' + b + '}', '{−' + a + '/' + b + '}', '{' + b + '/' + a + '}'],
      { why: 'Două minusuri se anulează: {−' + a + '/−' + b + '} = {' + a + '/' + b + '}, o fracție pozitivă.', hint: 'Minus pe minus dă plus.' });
  };
  G.whichPositive = function (R) {
    var mags = R.shuffle([[1, 2], [2, 3], [3, 4], [4, 5], [5, 7], [3, 8], [5, 6], [2, 5], [7, 9]]).slice(0, 4);
    var posIdx = R.int(0, 3), opts = mags.map(function (p, i) {
      var a = p[0], b = p[1];
      if (i === posIdx) return R.bool() ? '{' + a + '/' + b + '}' : '{−' + a + '/−' + b + '}';
      return R.pick(['{−' + a + '/' + b + '}', '{' + a + '/−' + b + '}', '−{' + a + '/' + b + '}']);
    });
    return { t: 'mc', q: 'Care dintre numere este pozitiv?', opts: opts, a: posIdx, why: 'O fracție e pozitivă când are două minusuri (se anulează) sau niciunul. Celelalte au exact un minus, deci sunt negative.', hint: 'Numără minusurile: unul singur face numărul negativ.' };
  };
  G.fracToInt = function (R, lvl) {
    var d = R.int(2, tier(lvl, 5, 9, 12)), k = R.int(2, tier(lvl, 6, 9, 12)), s = (lvl > 0 && R.bool()) ? -1 : 1;
    var n = s * k * d;
    return { t: 'num', q: 'Scrie numărul ca întreg.', eq: raw(n, d), a: F(s * k), form: 'int', why: raw(n, d) + ' înseamnă ' + int(n) + ' : ' + d + ' = ' + int(s * k) + '.', hint: 'Fracția e o împărțire: numărător : numitor.' };
  };
  G.shareWord = function (R) {
    var a = R.int(2, 5), b = R.int(a + 1, 8), what = R.pick(['kg de mere', 'kg de nuci', 'litri de suc']);
    return mcS(R, 'Se împart egal ' + a + ' ' + what + ' la ' + b + ' copii. Cât primește fiecare copil?', '{' + a + '/' + b + '} ' + what.split(' ')[0],
      ['{' + b + '/' + a + '} ' + what.split(' ')[0], '{1/' + (a + b) + '} ' + what.split(' ')[0], '{' + (a + b) + '/' + b + '} ' + what.split(' ')[0]],
      { why: 'A împărți ' + a + ' la ' + b + ' înseamnă ' + a + ' : ' + b + ' = {' + a + '/' + b + '}. Fiecare copil primește {' + a + '/' + b + '} ' + what.split(' ')[0] + '.', hint: 'Cantitatea totală e numărătorul, numărul de copii e numitorul.' });
  };
  G.multiInts = function (R, lvl) {
    var pool = [['−4', -4], ['0', 0], ['7', 7], ['{8/2}', 4], ['{−9/3}', -3], ['{12/4}', 3], ['{1/2}', 0.5], ['0,5', 0.5], ['{5/3}', 5 / 3], ['{−7/2}', -3.5], ['2,4', 2.4], ['{10/5}', 2], ['{15/6}', 2.5], ['−1,5', -1.5]];
    var ints = R.shuffle(pool.filter(function (p) { return Math.abs(p[1] - Math.round(p[1])) < 1e-9; })).slice(0, tier(lvl, 2, 2, 3));
    var non = R.shuffle(pool.filter(function (p) { return Math.abs(p[1] - Math.round(p[1])) > 1e-9; })).slice(0, tier(lvl, 3, 3, 4));
    var items = R.shuffle(ints.concat(non));
    var ans = [], i;
    for (i = 0; i < items.length; i++) if (Math.abs(items[i][1] - Math.round(items[i][1])) < 1e-9) ans.push(i);
    return { t: 'multi', q: 'Alege toate numerele care sunt întregi.', opts: items.map(function (p) { return p[0]; }), ans: ans,
      why: 'Sunt întregi: ' + ans.map(function (j) { return items[j][0]; }).join(', ') + '. Celelalte au parte fracționară (de exemplu {1/2} = 0,5).', hint: 'Fă împărțirea: dacă dă exact, numărul e întreg.' };
  };
  var TRUE_S = ['Orice număr întreg este și număr rațional.', 'Numărul 0 este număr rațional.', '{−6/3} este un număr întreg.', 'Numărul −5 este număr rațional.', 'Orice număr natural este număr rațional.'];
  var FALSE_S = ['Orice număr rațional este număr întreg.', '{1/2} este număr întreg.', 'Un număr rațional nu poate fi negativ.', 'Numărul −5 nu este număr rațional.', 'Numitorul unei fracții poate fi 0.', 'ℚ este cuprinsă în ℤ.'];
  G.statement = function (R) {
    var good = R.pick(TRUE_S), bad = R.shuffle(FALSE_S).slice(0, 3);
    return mcS(R, 'Care afirmație este adevărată?', good, bad, { why: '„' + good + '” este adevărată: ℕ ⊂ ℤ ⊂ ℚ, deci fiecare număr întreg se scrie ca fracție cu numitorul 1. La o fracție, numitorul nu poate fi 0.', hint: 'Ține minte: ℕ ⊂ ℤ ⊂ ℚ.' });
  };

  /* ================= 1.2 Fracții echivalente ================= */
  G.equivFill = function (R, lvl) {
    var b = R.int(2, tier(lvl, 6, 9, 12)), a = R.int(1, b + 2), k = R.int(2, tier(lvl, 5, 8, 12));
    return { t: 'num', q: 'Ce număr lipsește de la numărător?', eq: '{' + a + '/' + b + '} = {▢/' + (b * k) + '}', a: F(a * k), form: 'int',
      why: 'Numitorul s-a înmulțit cu ' + k + ' (' + b + '·' + k + ' = ' + (b * k) + '), deci înmulțim și numărătorul: ' + a + '·' + k + ' = ' + (a * k) + '.', hint: 'Câte ori s-a mărit numitorul? La fel se mărește numărătorul.' };
  };
  G.amplify = function (R, lvl) {
    var b = R.int(3, tier(lvl, 7, 9, 12)), a = R.int(1, b - 1), k = R.int(2, tier(lvl, 4, 6, 9));
    return mcS(R, 'Care fracție este egală cu {' + a + '/' + b + '} ?', '{' + (a * k) + '/' + (b * k) + '}',
      ['{' + (a + k) + '/' + (b + k) + '}', '{' + (a * k) + '/' + b + '}', '{' + a + '/' + (b * k) + '}'],
      { why: 'Amplificăm cu ' + k + ': {' + a + '·' + k + '/' + b + '·' + k + '} = {' + (a * k) + '/' + (b * k) + '}. Înmulțim și numărătorul, și numitorul cu același număr.', hint: 'Înmulțește numărătorul și numitorul cu același număr.' });
  };
  G.simplifyFull = function (R, lvl) {
    var f = pickFrac(R, 2, tier(lvl, 6, 10, 13), true), k = R.int(tier(lvl, 2, 3, 6), tier(lvl, 5, 8, 14)), N = f.n * k, D = f.d * k, g = gcd(N, D);
    return { t: 'num', q: 'Simplifică fracția până devine ireductibilă.', eq: '{' + N + '/' + D + '}', a: f, form: 'frac', reduced: true,
      why: 'Cel mai mare divizor comun al lui ' + N + ' și ' + D + ' este ' + g + '. {' + N + ':' + g + '/' + D + ':' + g + '} = {' + f.n + '/' + f.d + '}.', hint: 'Împarte numărătorul și numitorul la același număr, cât timp se poate.' };
  };
  G.isIrreducible = function (R, lvl) {
    var good = pickFrac(R, 5, tier(lvl, 9, 12, 15), true), bads = [], seen = {};
    while (bads.length < 3) {
      var f = pickFrac(R, 2, 7, true), k = R.int(2, tier(lvl, 4, 6, 8)), s = (f.n * k) + '/' + (f.d * k);
      if (!seen[s]) { seen[s] = 1; bads.push('{' + s + '}'); }
    }
    return mcS(R, 'Care fracție este ireductibilă?', '{' + good.n + '/' + good.d + '}', bads,
      { sameValueOk: true, why: '{' + good.n + '/' + good.d + '} nu se mai poate simplifica, pentru că cel mai mare divizor comun al numitorului și numărătorului este 1. Celelalte au divizori comuni.', hint: 'Caută un număr care împarte exact și numărătorul, și numitorul.' });
  };
  G.equalPair = function (R, lvl) {
    var f = pickFrac(R, 2, tier(lvl, 6, 8, 9), true), k = R.int(2, 4), same = R.bool(), N = f.n * k, D = f.d * k;
    var c = f.n, d = f.d;
    if (!same) { c = f.n + 1; if (c === d || gcd(c * k, D) === 0) c++; }
    var A = { n: f.n, d: f.d }, eqv = PM.eq(F(c, d), A);
    var p1 = N * d, p2 = D * c;
    return { t: 'mc', q: 'Sunt egale fracțiile {' + N + '/' + D + '} și {' + c + '/' + d + '} ?', opts: ['Da, sunt egale', 'Nu, nu sunt egale'], a: eqv ? 0 : 1, fixed: true,
      why: 'Verificăm cu produsele pe diagonală: ' + N + '·' + d + ' = ' + p1 + ' și ' + D + '·' + c + ' = ' + p2 + '. ' + (p1 === p2 ? 'Sunt egale, deci fracțiile sunt egale.' : 'Nu sunt egale, deci fracțiile sunt diferite.'), hint: 'Înmulțește „în cruce”: numărătorul uneia cu numitorul celeilalte.' };
  };
  G.barShade = function (R, lvl) {
    var d = R.int(3, tier(lvl, 6, 8, 10)), n = R.int(1, d - 1);
    return { t: 'bar', q: 'Colorează {' + n + '/' + d + '} din bară. Atinge părțile.', d: d, n: n, why: 'Bara are ' + d + ' părți egale. {' + n + '/' + d + '} înseamnă ' + n + ' părți colorate din ' + d + '.', hint: 'Numitorul spune câte părți are bara, numărătorul câte colorezi.' };
  };
  G.barEquiv = function (R, lvl) {
    var d = R.pick(tier(lvl, [6, 8], [8, 10, 12], [12, 12, 10])), divs = [], i;
    for (i = 2; i < d; i++) if (d % i === 0) divs.push(i);
    var b = R.pick(divs), a = R.int(1, b - 1), n = a * d / b;
    return { t: 'bar', q: 'Colorează pe bara cu ' + d + ' părți o parte egală cu {' + a + '/' + b + '}.', d: d, n: n, why: '{' + a + '/' + b + '} = {' + n + '/' + d + '}, pentru că ' + b + '·' + (d / b) + ' = ' + d + ' și ' + a + '·' + (d / b) + ' = ' + n + '. Colorăm ' + n + ' părți.', hint: 'Amplifică {' + a + '/' + b + '} ca să ajungă la numitorul ' + d + '.' };
  };
  G.bugSimplify = function (R) {
    var a = R.int(2, 4), b = R.int(a + 1, 7), k = R.int(3, 6);
    if (!coprime(a, b)) b = a + 1;
    var N = a * k, D = b * k, n1 = N - k, d1 = D - k, f = F(n1, d1);
    return { t: 'bug', q: 'Elevul a simplificat greșit. Care linie conține greșeala?', lines: ['{' + N + '/' + D + '}', '= {' + N + '−' + k + '/' + D + '−' + k + '}', '= {' + n1 + '/' + d1 + '}', '= {' + f.n + '/' + f.d + '}'], bad: 1,
      why: 'Simplificăm împărțind numărătorul și numitorul la același număr, nu scăzând același număr. Corect: {' + N + ':' + k + '/' + D + ':' + k + '} = {' + a + '/' + b + '}.', hint: 'Simplificarea înseamnă împărțire.' };
  };

  /* ================= 1.3 Axa numerelor, comparare ================= */
  function axisCfg(R, lvl) {
    if (lvl === 0) return R.pick([{ min: 0, max: 3, sub: 2 }, { min: -2, max: 2, sub: 2 }, { min: 0, max: 2, sub: 4 }]);
    if (lvl === 1) return R.pick([{ min: -2, max: 2, sub: 4 }, { min: 0, max: 3, sub: 3 }, { min: -3, max: 1, sub: 2 }]);
    return R.pick([{ min: -2, max: 2, sub: 3 }, { min: -2, max: 2, sub: 5 }, { min: -1, max: 2, sub: 6 }]);
  }
  function axisPoint(R, c) {
    var k, v;
    for (var i = 0; i < 100; i++) {
      k = R.int(c.min * c.sub + 1, c.max * c.sub - 1);
      v = F(k, c.sub);
      if (v.n !== 0 && v.d !== 1) return v;
    }
    return F(1, 2);
  }
  G.axisRead = function (R, lvl) {
    var c = axisCfg(R, lvl), p = axisPoint(R, c), s = c.sub;
    var wrongs = [F(p.n * s + p.d, p.d * s), F(p.n * s - p.d, p.d * s), PM.neg(p)].map(fs);
    return mcS(R, 'Ce număr reprezintă punctul A de pe axă?', fs(p), wrongs, { vis: { k: 'axis', min: c.min, max: c.max, sub: c.sub, pts: [{ v: p, l: 'A' }] },
      why: 'Între două numere întregi sunt ' + s + ' părți egale. Punctul A este la ' + Math.abs(p.n * s / p.d) + (Math.abs(p.n * s / p.d) === 1 ? ' parte' : ' părți') + ' de 0, spre ' + (p.n < 0 ? 'stânga' : 'dreapta') + ', adică la ' + fs(p) + '.', hint: 'Numără câte părți egale sunt între două numere întregi.' });
  };
  G.axisPlace = function (R, lvl) {
    var c = axisCfg(R, lvl), p = axisPoint(R, c);
    return { t: 'axis', q: 'Mută punctul pe axă la numărul ' + fs(p) + '.', min: c.min, max: c.max, sub: c.sub, target: p,
      why: 'Între două numere întregi sunt ' + c.sub + ' părți egale. ' + fs(p) + ' se află la ' + Math.abs(p.n * c.sub / p.d) + (Math.abs(p.n * c.sub / p.d) === 1 ? ' parte' : ' părți') + ' de 0' + (p.n < 0 ? ', spre stânga' : ', spre dreapta') + '.', hint: 'Împarte fiecare unitate în ' + c.sub + ' părți egale.' };
  };
  G.opposite = function (R, lvl) {
    var f = lvl === 0 ? F(R.int(1, 12) * R.sign()) : lvl === 1 ? pickFrac(R, 2, 9, false) : F(R.int(11, 99) * R.sign(), 10);
    if (lvl === 1 && R.bool()) f = PM.neg(f);
    var o = PM.neg(f);
    if (lvl === 2) return { t: 'num', q: 'Scrie opusul numărului ' + fd(f) + ' ca număr zecimal.', a: o, form: 'dec', why: 'Opusul are aceeași distanță față de 0, dar semn schimbat: ' + fd(o) + '.', hint: 'Opusul lui x este −x.' };
    return { t: 'num', q: 'Care este opusul numărului ' + fs(f) + ' ?', a: o, form: lvl === 0 ? 'int' : 'frac', reduced: lvl === 1, why: 'Opusul are aceeași distanță față de 0, dar de partea cealaltă: opusul lui ' + fs(f) + ' este ' + fs(o) + '.', hint: 'Schimbă semnul numărului.' };
  };
  function cmpPair(R, lvl) {
    var a, b;
    if (lvl === 0) { var d = R.int(3, 9); a = F(R.int(1, d + 3), d); b = F(R.int(1, d + 3), d); if (R.bool(0.3)) b = F(R.int(1, 4)); }
    else if (lvl === 1) { a = pickFrac(R, 2, 8, false); b = pickFrac(R, 2, 8, false); if (R.bool(0.2)) b = a; }
    else { a = PM.neg(pickFrac(R, 2, 9, false)); b = R.bool() ? PM.neg(pickFrac(R, 2, 9, false)) : pickFrac(R, 2, 9, false); if (R.bool(0.2)) b = a; }
    return [a, b];
  }
  G.cmp = function (R, lvl) {
    var p = cmpPair(R, lvl), a = p[0], b = p[1], c = PM.cmp(a, b), ds = lcm(a.d, b.d);
    var why;
    if (a.n < 0 && b.n < 0) why = 'La numerele negative, cel mai apropiat de 0 este mai mare. ' + fs(a) + ' ' + (c === 0 ? '=' : c < 0 ? '<' : '>') + ' ' + fs(b) + '.';
    else if ((a.n < 0) !== (b.n < 0)) why = 'Orice număr negativ este mai mic decât orice număr pozitiv.';
    else if (a.d === b.d) why = 'Au același numitor, deci este mai mare cel cu numărătorul mai mare.';
    else why = 'Aducem la numitorul comun ' + ds + ': ' + fs(a) + ' = {' + (a.n * ds / a.d) + '/' + ds + '} și ' + fs(b) + ' = {' + (b.n * ds / b.d) + '/' + ds + '}. Comparăm numărătorii.';
    return { t: 'mc', q: 'Alege semnul potrivit.', eq: fs(a) + '  ▢  ' + fs(b), opts: ['<', '=', '>'], a: c + 1, fixed: true, big: true, why: why, hint: 'Adu fracțiile la același numitor sau compară-le cu 0.' };
  };
  G.sortRat = function (R, lvl) {
    var vals = [], seen = {}, guard = 0;
    while (vals.length < tier(lvl, 3, 4, 5) && guard++ < 200) {
      var f = lvl === 0 ? F(R.int(-6, 9), 4) : lvl === 1 ? F(R.int(-8, 12), R.pick([2, 3, 4, 6])) : F(R.int(-12, 14), R.pick([3, 4, 5, 6, 8]));
      var key = f.n + '/' + f.d;
      if (!seen[key]) { seen[key] = 1; vals.push(f); }
    }
    vals.sort(PM.cmp);
    return { t: 'order', q: 'Ordonează crescător, de la cel mai mic la cel mai mare.', tiles: vals.map(fs), why: 'Ordinea crescătoare: ' + vals.map(fs).join(' < ') + '. Negativele vin primele, iar dintre ele este mai mic cel mai îndepărtat de 0.', hint: 'Numerele negative sunt mai mici decât cele pozitive.' };
  };
  G.between = function (R, lvl) {
    var A, B, M;
    for (var i = 0; i < 100; i++) {
      A = pickFrac(R, 2, 6, true); B = pickFrac(R, 2, 6, true);
      if (PM.cmp(A, B) > 0) { var t = A; A = B; B = t; }
      if (PM.cmp(A, B) === 0) continue;
      M = PM.div(PM.add(A, B), F(2)); if (M.d <= 24) break;
    }
    var wrongs = [PM.sub(A, F(1, A.d * 2)), PM.add(B, F(1, B.d * 2)), PM.add(B, F(1, 3))].filter(function (w) { return PM.cmp(w, A) <= 0 || PM.cmp(w, B) >= 0; }).map(fs);
    return mcS(R, 'Care număr se află între ' + fs(A) + ' și ' + fs(B) + ' ?', fs(M), wrongs.concat([fs(PM.sub(A, F(1, 5))), fs(PM.add(B, F(1, 7)))]),
      { why: 'Media lor este între ele: (' + fs(A) + ' + ' + fs(B) + ') : 2 = ' + fs(M) + '.', hint: 'Media a două numere se află între ele.' });
  };

  /* ================= 1.4 Zecimale finite ================= */
  G.fracToDec = function (R, lvl) {
    var d = R.pick(tier(lvl, [2, 4, 5, 10], [8, 20, 25], [16, 40, 50, 125])), n = R.int(1, tier(lvl, d - 1, d - 1, d * 2));
    while (!coprime(n, d) || n === d) n = R.int(1, tier(lvl, d - 1, d - 1, d * 2));
    var m = 1; while (Math.pow(10, m) % d !== 0) m++;
    var k = Math.pow(10, m) / d, f = F(n, d);
    return { t: 'num', q: 'Scrie fracția ca număr zecimal.', eq: fr(n, d), a: f, form: 'dec', why: 'Amplificăm până la numitorul ' + Math.pow(10, m) + ': {' + n + '·' + k + '/' + d + '·' + k + '} = {' + (n * k) + '/' + Math.pow(10, m) + '} = ' + fd(f) + '.', hint: 'Caută un număr cu care înmulțești numitorul ca să obții 10, 100 sau 1000.' };
  };
  G.decToFrac = function (R, lvl) {
    var x, sh;
    if (lvl === 0) { x = R.pick([2, 4, 5, 6, 8]); sh = 10; }
    else if (lvl === 1) { x = R.int(1, 99); sh = 100; if (x % 10 === 0) x++; }
    else { x = R.int(101, 499); sh = 100; if (x % 10 === 0) x++; }
    var f = F(x, sh), g = gcd(x, sh);
    return { t: 'num', q: 'Scrie numărul ca fracție ireductibilă.', eq: fd(f), a: f, form: 'frac', reduced: true, why: fd(f) + ' = {' + x + '/' + sh + '}' + (g > 1 ? ' = {' + x + ':' + g + '/' + sh + ':' + g + '} = ' + fs(f) : '') + '.', hint: 'Numărul de zecimale spune câte zerouri are numitorul: 10, 100…' };
  };
  var DECPAIRS = [[F(1, 2), '0,5'], [F(1, 4), '0,25'], [F(3, 4), '0,75'], [F(1, 5), '0,2'], [F(2, 5), '0,4'], [F(3, 5), '0,6'], [F(1, 8), '0,125'], [F(3, 8), '0,375'], [F(1, 10), '0,1'], [F(7, 10), '0,7'], [F(9, 20), '0,45'], [F(7, 20), '0,35'], [F(1, 20), '0,05'], [F(3, 25), '0,12'], [F(4, 5), '0,8'], [F(5, 4), '1,25'], [F(3, 2), '1,5']];
  G.matchDec = function (R, lvl) {
    var picks = R.shuffle(DECPAIRS).slice(0, tier(lvl, 3, 4, 4));
    return { t: 'match', q: 'Unește fiecare fracție cu scrierea ei zecimală.', pairs: picks.map(function (p) { return [fs(p[0]), p[1]]; }), why: 'Am făcut perechile prin împărțire: ' + picks.map(function (p) { return fs(p[0]) + ' = ' + p[1]; }).join('; ') + '.', hint: 'Începe cu perechea de care ești sigur.' };
  };
  G.decFracMc = function (R, lvl) {
    var d = R.pick(tier(lvl, [4, 5, 10], [20, 25, 8], [20, 25, 40])), n = R.int(1, d - 1);
    while (!coprime(n, d)) n = R.int(1, d - 1);
    var f = F(n, d), correct = fd(f), w = ['0,' + n, '0,' + d, fd(F(n, d * 10)), fd(F(n * 10, d)).indexOf(',') < 0 ? String(n) + ',' + d : fd(F(n * 10, d))];
    w = w.filter(function (x) { return x !== correct; });
    return mcS(R, 'Care număr zecimal este egal cu ' + fr(n, d) + ' ?', correct, w, { why: fr(n, d) + ' = ' + correct + ' (împărțim ' + n + ' la ' + d + ').', hint: 'Împarte numărătorul la numitor.' });
  };
  G.cmpDec = function (R, lvl) {
    var a, b;
    for (var i = 0; i < 60; i++) {
      a = F(R.int(1, 19), R.pick([2, 4, 5, 10, 20])); b = F(R.int(1, 99), 100);
      if (PM.cmp(a, b) !== 0 || R.bool(0.1)) break;
    }
    var c = PM.cmp(a, b), sa = R.bool() ? fs(a) : fd(a), sb = R.bool() ? fd(b) : fs(b);
    return { t: 'mc', q: 'Alege semnul potrivit.', eq: sa + '  ▢  ' + sb, opts: ['<', '=', '>'], a: c + 1, fixed: true, big: true, why: 'Scriem ambele ca zecimale: ' + fd(a) + ' și ' + fd(b) + '. ' + (c === 0 ? 'Sunt egale.' : c < 0 ? fd(a) + ' este mai mic.' : fd(a) + ' este mai mare.'), hint: 'Transformă totul în zecimale.' };
  };
  G.orderDec = function (R, lvl) {
    var vals = [], seen = {}, g = 0;
    while (vals.length < tier(lvl, 3, 4, 5) && g++ < 200) {
      var f = R.pick(DECPAIRS)[0]; if (R.bool(0.3)) f = F(R.int(1, 19), 20);
      if (!seen[f.n + '/' + f.d]) { seen[f.n + '/' + f.d] = 1; vals.push(f); }
    }
    vals.sort(PM.cmp);
    var forms = vals.map(function (v, i) { return i % 2 === 0 ? fd(v) : fs(v); });
    return { t: 'order', q: 'Ordonează crescător.', tiles: forms, why: 'Scriem totul ca zecimale: ' + vals.map(fd).join(' < ') + '.', hint: 'Transformă fracțiile în zecimale ca să le compari ușor.' };
  };

  /* ================= 1.5 Zecimale periodice ================= */
  var FINITE_D = [2, 4, 5, 8, 10, 20, 25], PERIOD_D = [3, 6, 7, 9, 11, 12, 15, 18];
  G.isPeriodic = function (R, lvl) {
    function mk(ds) { var d = R.pick(ds), n; do { n = R.int(1, d * (lvl > 1 ? 2 : 1) - 1); } while (!coprime(n, d)); return F(n, d); }
    var good = mk(PERIOD_D), bads = [], seen = {};
    while (bads.length < 3) { var f = mk(FINITE_D), s = f.n + '/' + f.d; if (!seen[s]) { seen[s] = 1; bads.push(fs(f)); } }
    return mcS(R, 'Care fracție se scrie ca număr zecimal periodic?', fs(good), bads, { why: 'Numitorul lui ' + fs(good) + ' (' + good.d + ') are un divizor prim diferit de 2 și 5, deci fracția dă o zecimală periodică: ' + fd(good) + '. La celelalte, numitorii au doar factorii 2 și 5.', hint: 'Fracția ireductibilă e finită doar dacă numitorul are factori primi doar 2 și 5.' });
  };
  G.decExpansion = function (R, lvl) {
    var d = R.pick(tier(lvl, [3, 9, 6], [6, 11, 12, 15], [7, 11, 12, 15, 18, 22])), n;
    do { n = R.int(1, d - 1); } while (!coprime(n, d));
    var f = F(n, d), x = PM.decInfo(f), correct = fd(f), w = [];
    var digs = x.pre + x.per + x.per;
    w.push((x.ip + ',' + digs.slice(0, x.pre.length + x.per.length)).replace(/,$/, ''));
    if (x.per.length > 1) w.push(x.ip + ',' + x.pre + x.per[0] + '(' + x.per.slice(1) + x.per[0] + ')');
    else w.push(x.ip + ',' + x.pre + '(' + x.per + x.per + ')'.replace('))', ')'));
    w.push(x.ip + ',(' + x.pre + x.per + ')');
    w.push(fd(F(n + 1, d))); w.push(fd(F(n + 2, d)));
    w = w.filter(function (s) { return s !== correct && s.indexOf('(') >= 0 || (s !== correct && s.indexOf(',') > 0); });
    return mcS(R, 'Care este scrierea zecimală a fracției ' + fs(f) + ' ?', correct, w, { why: 'Împărțim ' + n + ' la ' + d + ': obținem ' + correct + '. Cifrele din paranteză se repetă la nesfârșit.', hint: 'Fă împărțirea ' + n + ' : ' + d + ' până când un rest se repetă.' });
  };
  G.decTyped = function (R, lvl) {
    var d = R.pick(tier(lvl, [3, 9], [6, 11, 12], [7, 12, 15, 18])), n;
    do { n = R.int(1, d - 1); } while (!coprime(n, d));
    var f = F(n, d);
    return { t: 'num', q: 'Scrie fracția ca zecimală periodică, cu perioada între paranteze.', eq: fs(f), a: f, form: 'per', why: 'Împărțim ' + f.n + ' la ' + f.d + ' și găsim ' + fd(f) + '.', hint: 'Exemplu de scriere: 0,(3) sau 0,8(3).' };
  };
  G.periodLen = function (R, lvl) {
    var preL = R.int(0, tier(lvl, 0, 1, 2)), perL = R.int(tier(lvl, 1, 1, 2), tier(lvl, 2, 3, 3));
    var pre = '', per = '', i;
    for (i = 0; i < preL; i++) pre += R.int(1, 9);
    for (i = 0; i < perL; i++) per += R.int(0, 9);
    if (/^(\d)\1*$/.test(per)) per = per[0] + (perL > 1 ? String((+per[0] % 9) + 1) : '') + per.slice(2);
    if (perL === 1) per = String(R.int(1, 9));
    var s = '0,' + pre + '(' + per + ')';
    return { t: 'num', q: 'Câte cifre are perioada numărului ' + s + ' ?', a: F(per.length), form: 'int', why: 'Perioada este grupul din paranteză: ' + per + '. Are ' + per.length + (per.length === 1 ? ' cifră' : ' cifre') + '.', hint: 'Perioada este ce se află între paranteze.' };
  };
  G.nthDigit = function (R, lvl) {
    var pre = R.bool() ? '' : String(R.int(1, 9)), perL = R.int(2, 3), per = '', i;
    for (i = 0; i < perL; i++) per += R.int(1, 9);
    var k = R.int(7, 24), digit = k <= pre.length ? pre[k - 1] : per[(k - pre.length - 1) % per.length];
    return { t: 'num', q: 'Care este a ' + k + '-a zecimală a numărului 0,' + pre + '(' + per + ') ?', a: F(+digit), form: 'int',
      why: 'Perioada ' + per + ' se repetă' + (pre ? ' după prima zecimală (' + pre + ')' : '') + '. A ' + k + '-a zecimală este ' + digit + '.', hint: 'Scrie zecimalele una după alta și numără, sau folosește restul împărțirii la lungimea perioadei.' };
  };
  G.perToFrac = function (R, lvl) {
    var s, f, why;
    if (lvl <= 1 && R.bool(lvl === 0 ? 1 : 0.4)) {
      var a = R.int(1, 8); s = '0,(' + a + ')'; f = F(a, 9);
      why = 'Notăm x = ' + s + '. Atunci 10x = ' + a + ',(' + a + '), deci 9x = ' + a + ' și x = {' + a + '/9}' + (f.d !== 9 ? ' = ' + fs(f) : '') + '. Regula: 0,(a) = {a/9}.';
    } else if (lvl <= 1) {
      var ab = R.int(10, 98); if (ab % 11 === 0) ab++; s = '0,(' + ab + ')'; f = F(ab, 99);
      why = 'Notăm x = ' + s + '. Atunci 100x = ' + ab + ',(' + ab + '), deci 99x = ' + ab + ' și x = {' + ab + '/99}' + (f.d !== 99 ? ' = ' + fs(f) : '') + '. Regula: 0,(ab) = {ab/99}.';
    } else {
      var p = R.int(1, 8), q = R.int(0, 8); if (q === p) q = (q + 1) % 9; s = '0,' + p + '(' + q + ')'; f = F(parseInt('' + p + q, 10) - p, 90);
      why = 'Notăm x = ' + s + '. Atunci 10x = ' + p + ',(' + q + ') și 100x = ' + p + q + ',(' + q + '). Scădem: 90x = ' + (parseInt('' + p + q, 10) - p) + ', deci x = ' + fs(f) + '.';
    }
    return { t: 'num', q: 'Scrie numărul ca fracție ireductibilă.', eq: s, a: f, form: 'frac', reduced: true, why: why, hint: 'Pentru 0,(a): numărătorul e perioada, numitorul e tot atâtea cifre de 9.' };
  };
  G.finiteMulti = function (R) {
    var items = [], seen = {}, g = 0;
    while (items.length < 5 && g++ < 300) {
      var d = R.pick(items.length < 3 ? FINITE_D.concat(PERIOD_D) : FINITE_D.concat(PERIOD_D)), n = R.int(1, d - 1);
      if (!coprime(n, d)) continue;
      var key = n + '/' + d; if (seen[key]) continue; seen[key] = 1;
      items.push(F(n, d));
    }
    var ans = [];
    items.forEach(function (f, i) { if (PM.isFiniteDec(f)) ans.push(i); });
    if (!ans.length || ans.length === items.length) return G.finiteMulti(R);
    return { t: 'multi', q: 'Alege fracțiile care au scrierea zecimală finită.', opts: items.map(fs), ans: ans,
      why: 'Sunt finite: ' + ans.map(function (i) { return fs(items[i]) + ' = ' + fd(items[i]); }).join('; ') + '. Numitorii lor au doar factorii primi 2 și 5.', hint: 'Descompune numitorul în factori primi.' };
  };

  /* ================= 2.1 Același numitor, zecimale ================= */
  G.addSame = function (R, lvl) {
    var d = R.int(3, tier(lvl, 9, 12, 15)), a = R.int(1, tier(lvl, d - 2, d - 1, d * 2)), b = R.int(1, tier(lvl, d - a > 0 ? d - a : 1, d - 1, d * 2));
    var s = F(a + b, d);
    return { t: 'num', q: 'Calculează. Scrie fracția ireductibilă.', eq: fr(a, d) + ' + ' + fr(b, d), a: s, form: 'frac', reduced: true,
      why: fr(a, d) + ' + ' + fr(b, d) + ' = {' + a + '+' + b + '/' + d + '} = ' + raw(a + b, d) + (s.d !== d || s.n !== a + b ? ' = ' + fs(s) : '') + '.', hint: 'La același numitor, adunăm numărătorii și păstrăm numitorul.' };
  };
  G.subSame = function (R, lvl) {
    var d = R.int(3, tier(lvl, 9, 12, 15)), a = R.int(2, d * 2), b = R.int(1, a - 1);
    if (lvl === 2 && R.bool(0.4)) { var t = a; a = b; b = t; }
    var s = F(a - b, d);
    return { t: 'num', q: 'Calculează. Scrie fracția ireductibilă.', eq: fr(a, d) + ' − ' + fr(b, d), a: s, form: 'frac', reduced: true,
      why: fr(a, d) + ' − ' + fr(b, d) + ' = {' + a + '−' + b + '/' + d + '} = ' + raw(a - b, d) + (s.d !== d || s.n !== a - b ? ' = ' + fs(s) : '') + '.', hint: 'Scădem numărătorii, numitorul rămâne.' };
  };
  G.addDec = function (R, lvl) {
    var sc = tier(lvl, 10, 100, 100), a = R.int(11, tier(lvl, 59, 999, 1999)), b = R.int(11, tier(lvl, 59, 999, 1999)), sub = lvl > 0 && R.bool();
    if (sub && b > a) { var t = a; a = b; b = t; }
    var A = F(a, sc), B = F(b, sc), r = sub ? PM.sub(A, B) : PM.add(A, B);
    return { t: 'num', q: 'Calculează.', eq: fd(A) + (sub ? ' − ' : ' + ') + fd(B), a: r, form: 'dec', why: 'Aliniem virgulele și ' + (sub ? 'scădem' : 'adunăm') + ' cifră cu cifră, de la dreapta la stânga: ' + fd(A) + (sub ? ' − ' : ' + ') + fd(B) + ' = ' + fd(r) + '.', hint: 'Pune virgula sub virgulă.' };
  };
  G.missingTerm = function (R, lvl) {
    var d = R.int(4, tier(lvl, 9, 12, 15)), c = R.int(3, d + (lvl === 2 ? 4 : 0)), a = R.int(1, c - 1), sub = lvl === 2 && R.bool();
    var x = F(c - a, d);
    return { t: 'num', q: 'Ce fracție trebuie pusă în locul căsuței?', eq: sub ? fr(c, d) + ' − ▢ = ' + fr(a, d) : fr(a, d) + ' + ▢ = ' + fr(c, d), a: x, form: 'frac', reduced: true,
      why: (sub ? 'Termenul necunoscut e diferența: ' + fr(c, d) + ' − ' + fr(a, d) : 'Termenul necunoscut e diferența: ' + fr(c, d) + ' − ' + fr(a, d)) + ' = {' + (c - a) + '/' + d + '}' + (x.d !== d ? ' = ' + fs(x) : '') + '.', hint: 'Termenul necunoscut se află scăzând.' };
  };
  G.addMc = function (R, lvl) {
    var d = R.int(4, 12), a = R.int(1, d - 2), b = R.int(1, d - a - 1 > 0 ? d - a - 1 : 1), s = F(a + b, d);
    return mcS(R, 'Care este rezultatul?', fs(s), ['{' + (a + b) + '/' + (2 * d) + '}', '{' + (a * b) + '/' + d + '}', fs(F(a + b + 1, d))],
      { eq: fr(a, d) + ' + ' + fr(b, d), why: 'Numitorul rămâne ' + d + ', iar numărătorii se adună: ' + a + ' + ' + b + ' = ' + (a + b) + '. Rezultat: ' + fs(s) + '.', hint: 'Numitorul nu se adună.' });
  };
  var FOODS = [['o pizza', 'din pizza'], ['un tort', 'din tort'], ['o ciocolată', 'din ciocolată'], ['un pepene', 'din pepene']], NAMES = [['Ana', 'Mihai'], ['Maria', 'Dan'], ['Elena', 'Ion'], ['Irina', 'Vlad']];
  G.partsWord = function (R, lvl) {
    var d = R.int(5, tier(lvl, 8, 12, 12)), a = R.int(1, d - 3), b = R.int(1, d - a - 1), nm = R.pick(NAMES), fd_ = R.pick(FOODS), sub = lvl === 2 && R.bool();
    var s = F(a + b, d), rest = F(d - a - b, d);
    if (sub) return { t: 'num', q: 'Dintr-' + fd_[0].replace('o ', 'o ').replace('un ', 'un ') + ', ' + nm[0] + ' a mâncat ' + fr(a, d) + ' și ' + nm[1] + ' încă ' + fr(b, d) + '. Ce parte a rămas? Scrie fracția ireductibilă.', a: rest, form: 'frac', reduced: true, why: 'Au mâncat împreună ' + fr(a + b, d) + '. A rămas 1 − ' + fr(a + b, d) + ' = {' + (d - a - b) + '/' + d + '}' + (rest.d !== d ? ' = ' + fs(rest) : '') + '.', hint: 'Întregul este 1 = {' + d + '/' + d + '}.' };
    return { t: 'num', q: nm[0] + ' a mâncat ' + fr(a, d) + ' ' + fd_[1] + ', iar ' + nm[1] + ' ' + fr(b, d) + '. Ce parte au mâncat împreună? Scrie fracția ireductibilă.', a: s, form: 'frac', reduced: true, why: fr(a, d) + ' + ' + fr(b, d) + ' = {' + (a + b) + '/' + d + '}' + (s.d !== d ? ' = ' + fs(s) : '') + '.', hint: 'Adună cele două părți.' };
  };

  /* ================= 2.2 Numitor comun ================= */
  G.lcmQ = function (R, lvl) {
    var p = R.pick(tier(lvl, [[2, 4], [3, 6], [2, 3], [4, 8], [5, 10]], [[4, 6], [6, 8], [3, 5], [6, 9], [4, 10]], [[12, 18], [8, 12], [9, 15], [14, 21], [10, 15]])), L = lcm(p[0], p[1]), A = [], B = [], i;
    for (i = 1; i * p[0] <= L; i++) A.push(i * p[0]);
    for (i = 1; i * p[1] <= L; i++) B.push(i * p[1]);
    return { t: 'num', q: 'Care este cel mai mic numitor comun pentru ' + fr(1, p[0]) + ' și ' + fr(1, p[1]) + ' ?', a: F(L), form: 'int', why: 'Multiplii lui ' + p[0] + ': ' + A.join(', ') + '. Multiplii lui ' + p[1] + ': ' + B.join(', ') + '. Cel mai mic multiplu comun este ' + L + '.', hint: 'Caută cel mai mic număr care se împarte exact la amândoi.' };
  };
  G.ampCommon = function (R, lvl) {
    var p = R.pick(tier(lvl, [[2, 4], [3, 6], [4, 8]], [[4, 6], [6, 8], [3, 5]], [[6, 9], [8, 12], [10, 15]])), L = lcm(p[0], p[1]), a = R.int(1, p[0] - 1), k = L / p[0];
    return { t: 'num', q: 'Amplifică fracția la numitorul ' + L + '. Ce număr lipsește?', eq: fr(a, p[0]) + ' = {▢/' + L + '}', a: F(a * k), form: 'int', why: p[0] + '·' + k + ' = ' + L + ', deci amplificăm cu ' + k + ': {' + a + '·' + k + '/' + p[0] + '·' + k + '} = {' + (a * k) + '/' + L + '}.', hint: 'Câte ori încape ' + p[0] + ' în ' + L + '?' };
  };
  function pairFor(R, lvl) {
    var b, d;
    if (lvl === 0) { b = R.pick([2, 3, 4, 5]); d = b * R.pick([2, 3]); }
    else if (lvl === 1) { b = R.pick([2, 3, 4, 5]); do { d = R.pick([3, 4, 5, 7]); } while (!coprime(b, d)); }
    else { b = R.pick([4, 6, 8, 9, 10]); do { d = R.pick([6, 8, 9, 10, 12, 15]); } while (gcd(b, d) === 1 || b === d); }
    var a = R.int(1, b - 1), c = R.int(1, d - 1);
    return [F(a, b), F(c, d), a, b, c, d];
  }
  G.addDiff = function (R, lvl) {
    var p = pairFor(R, lvl), A = p[0], B = p[1], L = lcm(p[3], p[5]), s = PM.add(A, B), x = p[2] * L / p[3], y = p[4] * L / p[5];
    if (R.bool() && lvl === 0) { /* ordinea poate fi inversată */ }
    return { t: 'num', q: 'Calculează. Scrie fracția ireductibilă.', eq: fr(p[2], p[3]) + ' + ' + fr(p[4], p[5]), a: s, form: 'frac', reduced: true,
      why: 'Numitorul comun este ' + L + ': ' + fr(p[2], p[3]) + ' = {' + x + '/' + L + '} și ' + fr(p[4], p[5]) + ' = {' + y + '/' + L + '}. Suma: {' + (x + y) + '/' + L + '}' + (s.d !== L ? ' = ' + fs(s) : '') + '.', hint: 'Aduci fracțiile la același numitor, apoi aduni numărătorii.' };
  };
  G.subDiff = function (R, lvl) {
    var p = pairFor(R, lvl), A = p[0], B = p[1], a = p[2], b = p[3], c = p[4], d = p[5];
    if (PM.cmp(A, B) < 0 && lvl < 2) { var t = A; A = B; B = t; t = a; a = c; c = t; t = b; b = d; d = t; }
    if (PM.cmp(A, B) === 0) { a++; A = F(a, b); }
    var L = lcm(b, d), r = PM.sub(A, B), x = a * L / b, y = c * L / d;
    return { t: 'num', q: 'Calculează. Scrie fracția ireductibilă.', eq: fr(a, b) + ' − ' + fr(c, d), a: r, form: 'frac', reduced: true,
      why: 'Numitorul comun este ' + L + ': {' + x + '/' + L + '} − {' + y + '/' + L + '} = ' + raw(x - y, L) + (r.d !== L || r.n !== x - y ? ' = ' + fs(r) : '') + '.', hint: 'Același numitor întâi, apoi scazi numărătorii.' };
  };
  G.addDiffMc = function (R, lvl) {
    var p = pairFor(R, Math.max(lvl, 1)), a = p[2], b = p[3], c = p[4], d = p[5], s = PM.add(p[0], p[1]);
    return mcS(R, 'Care este suma ' + fr(a, b) + ' + ' + fr(c, d) + ' ?', fs(s), ['{' + (a + c) + '/' + (b + d) + '}', '{' + (a + c) + '/' + lcm(b, d) + '}', '{' + (a * c) + '/' + (b * d) + '}'],
      { why: 'Nu adunăm numitorii. Aducem la numitorul comun ' + lcm(b, d) + ' și apoi adunăm numărătorii: ' + fs(s) + '.', hint: 'Mai întâi numitorul comun.' });
  };
  G.stepOrder = function (R, lvl) {
    var p = pairFor(R, Math.max(lvl, 1)), a = p[2], b = p[3], c = p[4], d = p[5], L = lcm(b, d), x = a * L / b, y = c * L / d;
    return { t: 'order', q: 'Pune pașii în ordine pentru a calcula ' + fr(a, b) + ' + ' + fr(c, d) + ' .',
      tiles: ['Aflu numitorul comun: ' + L, 'Amplific: ' + fr(a, b) + ' = {' + x + '/' + L + '} și ' + fr(c, d) + ' = {' + y + '/' + L + '}', 'Adun numărătorii: ' + x + ' + ' + y + ' = ' + (x + y), 'Scriu rezultatul: ' + raw(x + y, L)],
      why: 'Întâi numitorul comun, apoi amplificăm, apoi adunăm numărătorii.', hint: 'Fără numitor comun nu putem aduna.' };
  };
  G.bugAdd = function (R) {
    var p = pairFor(R, 1), a = p[2], b = p[3], c = p[4], d = p[5];
    return { t: 'bug', q: 'Elevul a greșit. Care linie conține greșeala?', lines: [fr(a, b) + ' + ' + fr(c, d), '= {' + a + '+' + c + '/' + b + '+' + d + '}', '= ' + raw(a + c, b + d)], bad: 1,
      why: 'Numitorii nu se adună. Aducem la numitorul comun ' + lcm(b, d) + ' și adunăm numai numărătorii: ' + fs(p[0].n === 0 ? p[1] : PM.add(p[0], p[1])) + '.', hint: 'Numitorul comun, apoi numărătorii.' };
  };
  G.mixWord = function (R, lvl) {
    var p = pairFor(R, Math.max(lvl, 1)), s = PM.add(p[0], p[1]), thing = R.pick([['apă', 'suc', 'litri'], ['făină', 'zahăr', 'kg'], ['lapte', 'apă', 'litri']]);
    return { t: 'num', q: 'Într-un vas sunt ' + fr(p[2], p[3]) + ' ' + (thing[2] === 'kg' ? 'kg' : 'l') + ' de ' + thing[0] + '. Se adaugă ' + fr(p[4], p[5]) + ' ' + (thing[2] === 'kg' ? 'kg' : 'l') + ' de ' + thing[1] + '. Cât e în total? Scrie fracția ireductibilă.', a: s, form: 'frac', reduced: true,
      why: fr(p[2], p[3]) + ' + ' + fr(p[4], p[5]) + ' = ' + fs(s) + '.', hint: 'Aduceți la numitor comun.' };
  };

  /* ================= 2.3 Numere cu semne diferite ================= */
  G.addInt = function (R, lvl) {
    var a = R.int(1, tier(lvl, 9, 20, 30)) * (lvl === 0 ? (R.bool() ? 1 : -1) : R.sign()), b = R.int(1, tier(lvl, 9, 20, 30)) * R.sign();
    if (lvl === 0 && a > 0 && b > 0) b = -b;
    var r = a + b;
    var how = (a < 0) === (b < 0) ? 'Au același semn: adunăm valorile absolute (' + Math.abs(a) + ' + ' + Math.abs(b) + ' = ' + (Math.abs(a) + Math.abs(b)) + ') și păstrăm semnul.' : 'Au semne diferite: scădem valoarea absolută mai mică din cea mai mare (' + Math.max(Math.abs(a), Math.abs(b)) + ' − ' + Math.min(Math.abs(a), Math.abs(b)) + ' = ' + Math.abs(r) + ') și păstrăm semnul numărului cu valoare absolută mai mare.';
    return { t: 'num', q: 'Calculează.', eq: int(a) + ' + ' + intp(b), a: F(r), form: 'int', why: how + ' Rezultat: ' + int(r) + '.', hint: 'Același semn: aduni. Semne diferite: scazi.' };
  };
  G.subInt = function (R, lvl) {
    var a = R.int(1, tier(lvl, 9, 20, 30)), b = R.int(1, tier(lvl, 9, 20, 30));
    if (lvl === 0 && b > a) { var t = a; a = b; b = t; }
    var A = lvl === 2 ? -a : a, B = lvl === 0 ? b : -b, r = A - B;
    return { t: 'num', q: 'Calculează.', eq: int(A) + ' − ' + intp(B), a: F(r), form: 'int', why: 'A scădea un număr înseamnă a adăuga opusul lui: ' + int(A) + ' − ' + intp(B) + ' = ' + int(A) + ' + ' + intp(-B) + ' = ' + int(r) + '.', hint: 'A scădea înseamnă a aduna opusul.' };
  };
  G.signMc = function (R, lvl) {
    var a = R.int(2, 30) * R.sign(), b = R.int(2, 30) * R.sign(), sub = R.bool(), r = sub ? a - b : a + b;
    if (r === 0) a += 1, r = sub ? a - b : a + b;
    return { t: 'mc', q: 'Rezultatul este pozitiv sau negativ? Hotărăște fără să calculezi totul.', eq: int(a) + (sub ? ' − ' : ' + ') + intp(b), opts: ['Pozitiv', 'Negativ', 'Zero'], a: r > 0 ? 0 : r < 0 ? 1 : 2, fixed: true,
      why: 'Calculul: ' + int(a) + (sub ? ' − ' : ' + ') + intp(b) + ' = ' + int(r) + '. Semnul îl dă numărul cu valoarea absolută mai mare.', hint: 'Care număr e mai departe de 0?' };
  };
  G.jump = function (R, lvl) {
    var a = R.int(-4, 4), b = R.int(-6, 6); if (b === 0) b = 3;
    while (Math.abs(a + b) > 8 || a + b === a) { a = R.int(-4, 4); b = R.int(-6, 6); if (b === 0) b = 2; }
    return { t: 'axis', q: 'Pornești de la ' + int(a) + ' și te muți cu ' + int(b) + '. Mută punctul unde ajungi.', min: -8, max: 8, sub: 1, target: F(a + b), start: F(a),
      why: int(a) + ' + ' + intp(b) + ' = ' + int(a + b) + '. ' + (b > 0 ? 'Adunând un număr pozitiv, mergem spre dreapta.' : 'Adunând un număr negativ, mergem spre stânga.'), hint: (b > 0 ? 'Spre dreapta' : 'Spre stânga') + ', ' + Math.abs(b) + ' pași.' };
  };
  G.addFracSign = function (R, lvl) {
    var p = pairFor(R, tier(lvl, 1, 1, 2)), A = PM.neg(p[0]), B = p[1], sub = lvl === 2, r = sub ? PM.sub(A, B) : PM.add(A, B);
    return { t: 'num', q: 'Calculează. Scrie fracția ireductibilă.', eq: '−' + fr(p[2], p[3]) + (sub ? ' − ' : ' + ') + fr(p[4], p[5]), a: r, form: 'frac', reduced: true,
      why: 'Numitorul comun este ' + lcm(p[3], p[5]) + '. ' + (sub ? 'Ambele sunt negative, deci adunăm valorile absolute și păstrăm minusul: ' : 'Semne diferite: scădem valorile absolute și păstrăm semnul celui mai mare: ') + fs(r) + '.', hint: 'Numitor comun, apoi regula semnelor.' };
  };
  G.decSign = function (R, lvl) {
    var a = F(R.int(11, 59), 10), b = F(R.int(11, 199), 100), sub = lvl === 2, A = PM.neg(a), r = sub ? PM.sub(A, b) : PM.add(A, b);
    return { t: 'num', q: 'Calculează.', eq: fd(A) + (sub ? ' − ' : ' + ') + fd(b), a: r, form: 'dec', why: (sub ? 'Ambele sunt negative: adunăm ' + fd(a) + ' + ' + fd(b) + ' și păstrăm minusul: ' : 'Semne diferite: scădem valorile absolute și păstrăm semnul celui mai mare: ') + fd(r) + '.', hint: 'Aliniază virgulele.' };
  };
  G.negNeg = function (R) {
    var a = R.int(2, 40), kind = R.int(0, 2);
    var e = kind === 0 ? '−(−' + a + ')' : kind === 1 ? '−(+' + a + ')' : '−(−(−' + a + '))', r = kind === 0 ? a : kind === 1 ? -a : -a;
    return { t: 'num', q: 'Calculează.', eq: e, a: F(r), form: 'int', why: 'Minusul din fața parantezei schimbă semnul: ' + e + ' = ' + int(r) + '.', hint: 'Minus pe minus dă plus.' };
  };
  G.calcSeq = function (R) {
    var n = [R.int(2, 15), R.int(2, 15), R.int(2, 15), R.int(2, 15)], s = [R.sign(), R.sign(), R.sign()];
    var e = int(n[0]), r = n[0], i, parts = [e];
    for (i = 0; i < 3; i++) { e += (s[i] > 0 ? ' + ' : ' − ') + n[i + 1]; r += s[i] * n[i + 1]; parts.push((s[i] > 0 ? '+ ' : '− ') + n[i + 1]); }
    return { t: 'num', q: 'Calculează, de la stânga la dreapta.', eq: e, a: F(r), form: 'int', why: 'Calculăm în ordine: ' + e + ' = ' + int(r) + '.', hint: 'Pe rând, de la stânga la dreapta.' };
  };
  G.tempWord = function (R, lvl) {
    var a = R.int(-9, 8), b = R.int(3, 14), up = R.bool(), r = up ? a + b : a - b;
    return { t: 'num', q: 'Dimineața erau ' + int(a) + '°C. Până la prânz temperatura ' + (up ? 'a crescut' : 'a scăzut') + ' cu ' + b + '°C. Câte grade sunt la prânz?', a: F(r), form: 'int', unit: '°C',
      why: (up ? 'Creștere: ' + int(a) + ' + ' + b : 'Scădere: ' + int(a) + ' − ' + b) + ' = ' + int(r) + '°C.', hint: 'Creștere înseamnă adunare, scădere înseamnă scădere.' };
  };

  /* ================= 2.4 Paranteze ================= */
  G.parExpr = function (R, lvl) {
    var a = R.int(2, 20), b = R.int(2, 15), c = R.int(2, 12), kind = R.int(0, tier(lvl, 1, 2, 3)), e, r, w;
    if (kind === 0) { e = a + ' + (' + b + ' − ' + c + ')'; r = a + b - c; w = 'Plus în fața parantezei: semnele rămân. ' + a + ' + ' + b + ' − ' + c + ' = ' + r + '.'; }
    else if (kind === 1) { e = a + ' − (' + b + ' − ' + c + ')'; r = a - b + c; w = 'Minus în fața parantezei: semnele din ea se schimbă. ' + a + ' − ' + b + ' + ' + c + ' = ' + int(r) + '.'; }
    else if (kind === 2) { e = a + ' − (' + b + ' + ' + c + ')'; r = a - b - c; w = 'Minus în fața parantezei: ' + a + ' − ' + b + ' − ' + c + ' = ' + int(r) + '.'; }
    else { e = int(-a) + ' − (' + int(-b) + ' + ' + c + ')'; r = -a + b - c; w = 'Minus în fața parantezei schimbă semnele: ' + int(-a) + ' + ' + b + ' − ' + c + ' = ' + int(r) + '.'; }
    return { t: 'num', q: 'Calculează.', eq: e, a: F(r), form: 'int', why: w, hint: 'Un minus în fața parantezei schimbă toate semnele din ea.' };
  };
  G.parFrac = function (R, lvl) {
    var D = R.pick([[2, 3, 6], [2, 4, 4], [3, 6, 6], [2, 3, 4], [4, 8, 2]]), a = F(R.int(1, 3), D[0]), b = F(R.int(1, 3), D[1]), c = F(R.int(1, 2), D[2]);
    var minus = R.bool(), r = minus ? PM.sub(a, PM.sub(b, c)) : PM.add(a, PM.sub(b, c));
    var sa = fs(a), sb = fs(b), sc = fs(c);
    return { t: 'num', q: 'Calculează. Scrie fracția ireductibilă.', eq: sa + (minus ? ' − (' : ' + (') + sb + ' − ' + sc + ')', a: r, form: 'frac', reduced: true,
      why: 'Întâi paranteza: ' + sb + ' − ' + sc + ' = ' + fs(PM.sub(b, c)) + '. Apoi ' + sa + (minus ? ' − ' : ' + ') + fs(PM.sub(b, c)) + ' = ' + fs(r) + '.', hint: 'Calculează întâi paranteza.' };
  };
  G.removeParens = function (R) {
    var inner = R.pick(['+', '−']), outer = R.pick(['+', '−']), flip = outer === '−';
    var s1 = inner, s2 = flip ? (inner === '+' ? '−' : '+') : inner;
    var correct = 'a ' + outer + ' b ' + s2 + ' c';
    var wr = ['a ' + outer + ' b ' + (s2 === '+' ? '−' : '+') + ' c', 'a ' + (outer === '+' ? '−' : '+') + ' b ' + s2 + ' c', 'a ' + (outer === '+' ? '−' : '+') + ' b ' + (s2 === '+' ? '−' : '+') + ' c'];
    return mcS(R, 'Scrie fără paranteze: a ' + outer + ' (b ' + inner + ' c)', correct, wr, { why: (flip ? 'Minus în fața parantezei: semnele din paranteză se schimbă.' : 'Plus în fața parantezei: semnele rămân la fel.') + ' Obținem ' + correct + '.', hint: flip ? 'Minusul schimbă semnele.' : 'Plusul nu schimbă nimic.' });
  };
  G.bugParen = function (R) {
    var a = R.int(10, 30), b = R.int(3, 9), c = R.int(2, 8), w = a - b - c;
    return { t: 'bug', q: 'Care linie conține greșeala?', lines: [a + ' − (' + b + ' − ' + c + ')', '= ' + a + ' − ' + b + ' − ' + c, '= ' + int(w)], bad: 1, why: 'Minusul din fața parantezei schimbă semnul lui ' + c + ': corect este ' + a + ' − ' + b + ' + ' + c + ' = ' + int(a - b + c) + '.', hint: 'Ce se întâmplă cu semnele după un minus?' };
  };
  G.balanceWord = function (R) {
    var d = R.int(2, 9) * 10, p = R.int(15, 40) * 10, c = R.int(1, 8) * 10 + 5, r = -d + p - c;
    return { t: 'num', q: 'Pe un cont ești în minus cu ' + d + ' lei (adică −' + d + '). Depui ' + p + ' lei, apoi plătești ' + c + ' lei. Cât ai acum pe cont? (negativ = datorie)', a: F(r), form: 'int', unit: 'lei', why: int(-d) + ' + ' + p + ' − ' + c + ' = ' + int(r) + ' lei.', hint: 'Depunerea se adună, plata se scade.' };
  };

  /* ================= 3.1 Înmulțirea ================= */
  G.mulFrac = function (R, lvl) {
    var a, b, c, d, i;
    for (i = 0; i < 100; i++) {
      b = R.int(2, tier(lvl, 6, 9, 12)); d = R.int(2, tier(lvl, 6, 9, 12)); a = R.int(1, b + (lvl === 2 ? 3 : -1) || 1); c = R.int(1, d + (lvl === 2 ? 3 : -1) || 1);
      var simp = gcd(a, d) > 1 || gcd(c, b) > 1;
      if (lvl === 0 ? !simp : lvl === 1 ? simp : true) break;
    }
    var r = PM.mul(F(a, b), F(c, d));
    return { t: 'num', q: 'Calculează. Scrie fracția ireductibilă.', eq: fr(a, b) + ' · ' + fr(c, d), a: r, form: 'frac', reduced: true,
      why: fr(a, b) + ' · ' + fr(c, d) + ' = {' + a + '·' + c + '/' + b + '·' + d + '} = ' + raw(a * c, b * d) + (r.d !== b * d || r.n !== a * c ? ' = ' + fs(r) : '') + '.', hint: 'Numărător cu numărător, numitor cu numitor. Simplifică la final.' };
  };
  G.mulDec = function (R, lvl) {
    var x = R.int(2, tier(lvl, 9, 49, 99)), y = R.int(2, tier(lvl, 9, 49, 99)), sx = tier(lvl, 10, 10, 100), sy = tier(lvl, 10, 100, 100);
    var X = F(x, sx), Y = F(y, sy), r = PM.mul(X, Y), dec = String(sx).length - 1 + String(sy).length - 1;
    return { t: 'num', q: 'Calculează.', eq: fd(X) + ' · ' + fd(Y), a: r, form: 'dec', why: 'Înmulțim ca pe numerele întregi: ' + x + '·' + y + ' = ' + (x * y) + '. În factori sunt ' + dec + ' zecimale în total, deci rezultatul are ' + dec + ' zecimale: ' + fd(r) + '.', hint: 'Ignoră virgulele, înmulțește, apoi pune virgula.' };
  };
  G.fractionOf = function (R, lvl) {
    var b = R.pick(tier(lvl, [2, 4, 5], [3, 5, 8, 10], [6, 7, 9, 12])), a = R.int(1, b - 1), k = R.int(2, tier(lvl, 6, 9, 12)), N = b * k;
    return { t: 'num', q: 'Cât este ' + fr(a, b) + ' din ' + N + ' ?', a: F(a * k), form: 'int', why: N + ' : ' + b + ' = ' + k + ', iar ' + k + '·' + a + ' = ' + (a * k) + '. Sau: ' + fr(a, b) + ' · ' + N + ' = ' + (a * k) + '.', hint: 'Împarte la numitor, apoi înmulțește cu numărătorul.' };
  };
  G.mulInt = function (R, lvl) {
    var b = R.int(3, 9), a = R.int(1, b - 1), k = R.int(2, 9), N = b * k, r = F(a * k);
    if (!coprime(a, b)) a = 1;
    return { t: 'num', q: 'Calculează.', eq: fr(a, b) + ' · ' + N, a: F(a * k), form: 'int', why: fr(a, b) + ' · ' + N + ' = {' + a + '·' + N + '/' + b + '} = {' + (a * N) + '/' + b + '} = ' + (a * k) + '.', hint: 'Simplifică numitorul cu numărul întreg.' };
  };
  G.wordPart = function (R, lvl) {
    var b = R.pick([3, 4, 5, 8]), a = R.int(1, b - 1), k = R.int(2, 6), N = b * k, who = R.pick([['O clasă are', 'elevi', 'sunt băieți', 'băieți'], ['O carte are', 'pagini', 'au fost citite', 'pagini citite'], ['Un autobuz are', 'locuri', 'sunt ocupate', 'locuri ocupate']]);
    return { t: 'num', q: who[0] + ' ' + N + ' ' + who[1] + '. ' + fr(a, b) + ' dintre ele ' + who[2] + '. Câte sunt ' + who[3] + '?', a: F(a * k), form: 'int', why: fr(a, b) + ' din ' + N + ' = ' + N + ' : ' + b + ' · ' + a + ' = ' + k + ' · ' + a + ' = ' + (a * k) + '.', hint: 'Fracția dintr-un număr: împarte la numitor, înmulțește cu numărătorul.' };
  };
  G.bugMul = function (R) {
    var a = R.int(1, 4), b = R.int(2, 6), c = R.int(1, 4), d = R.int(2, 6);
    return { t: 'bug', q: 'Care linie conține greșeala?', lines: [fr(a, b) + ' · ' + fr(c, d), '= {' + a + '·' + c + '/' + b + '+' + d + '}', '= ' + raw(a * c, b + d)], bad: 1, why: 'La înmulțire, numitorii se înmulțesc, nu se adună: {' + a + '·' + c + '/' + b + '·' + d + '} = ' + raw(a * c, b * d) + '.', hint: 'Înmulțirea cere înmulțire și sus, și jos.' };
  };

  /* ================= 3.2 Regula semnelor ================= */
  G.signMul = function (R, lvl) {
    var a = R.int(2, 12) * R.sign(), b = R.int(2, 12) * R.sign(), r = a * b;
    return { t: 'mc', q: 'Ce semn are produsul? Nu e nevoie să calculezi.', eq: int(a) + ' · ' + intp(b), opts: ['Pozitiv', 'Negativ', 'Zero'], a: r > 0 ? 0 : 1, fixed: true,
      why: (a < 0) === (b < 0) ? 'Semne la fel dau produs pozitiv.' : 'Semne diferite dau produs negativ.', hint: 'Semne la fel: plus. Semne diferite: minus.' };
  };
  G.mulSigned = function (R, lvl) {
    var a = R.int(2, tier(lvl, 9, 12, 15)) * R.sign(), b = R.int(2, tier(lvl, 9, 12, 15)) * R.sign(), c = lvl === 2 ? R.int(2, 5) * R.sign() : 0;
    var r = c ? a * b * c : a * b;
    return { t: 'num', q: 'Calculează.', eq: int(a) + ' · ' + intp(b) + (c ? ' · ' + intp(c) : ''), a: F(r), form: 'int', why: 'Valorile: ' + Math.abs(a) + ' · ' + Math.abs(b) + (c ? ' · ' + Math.abs(c) : '') + ' = ' + Math.abs(r) + '. Semnul: ' + (r < 0 ? 'număr impar de minusuri, deci negativ' : 'număr par de minusuri, deci pozitiv') + '. Rezultat: ' + int(r) + '.', hint: 'Mai întâi semnul, apoi valoarea.' };
  };
  G.countMinus = function (R, lvl) {
    var n = R.int(3, tier(lvl, 4, 5, 6)), vals = [], neg = 0, i;
    for (i = 0; i < n; i++) { var v = R.int(2, 9) * R.sign(); if (v < 0) neg++; vals.push(v); }
    var e = vals.map(function (v, i) { return i === 0 ? int(v) : intp(v); }).join(' · ');
    return { t: 'mc', q: 'Ce semn are produsul?', eq: e, opts: ['Pozitiv', 'Negativ'], a: neg % 2 === 0 ? 0 : 1, fixed: true, why: 'Sunt ' + neg + ' factori negativi. Număr ' + (neg % 2 === 0 ? 'par' : 'impar') + ' de minusuri dă produs ' + (neg % 2 === 0 ? 'pozitiv' : 'negativ') + '.', hint: 'Numără minusurile: par = plus, impar = minus.' };
  };
  G.mulFracSign = function (R, lvl) {
    var p = pairFor(R, lvl === 0 ? 1 : 1), s1 = R.sign(), s2 = lvl === 0 ? -1 : R.sign(), A = F(s1 * p[2], p[3]), B = F(s2 * p[4], p[5]), r = PM.mul(A, B);
    var sa = s1 < 0 ? '−' + fr(p[2], p[3]) : fr(p[2], p[3]), sb = s2 < 0 ? '(−' + fr(p[4], p[5]) + ')' : fr(p[4], p[5]);
    return { t: 'num', q: 'Calculează. Scrie fracția ireductibilă.', eq: sa + ' · ' + sb, a: r, form: 'frac', reduced: true, why: 'Semnul: ' + (r.n < 0 ? 'negativ' : 'pozitiv') + '. Valoarea: {' + p[2] + '·' + p[4] + '/' + p[3] + '·' + p[5] + '} = ' + fs(PM.abs(r)) + '. Rezultat: ' + fs(r) + '.', hint: 'Semnul din regula semnelor, apoi înmulțești fracțiile.' };
  };
  G.mulDecSign = function (R, lvl) {
    var x = F(R.int(2, 15), 10), y = F(R.int(2, tier(lvl, 9, 25, 125)), tier(lvl, 10, 100, 100)), s1 = R.sign(), s2 = lvl === 0 ? -1 * s1 : R.sign();
    var A = s1 < 0 ? PM.neg(x) : x, B = s2 < 0 ? PM.neg(y) : y, r = PM.mul(A, B);
    return { t: 'num', q: 'Calculează.', eq: fd(A) + ' · ' + (B.n < 0 ? '(' + fd(B) + ')' : fd(B)), a: r, form: 'dec', why: 'Valorile: ' + fd(x) + ' · ' + fd(y) + ' = ' + fd(PM.abs(r)) + '. Semnul: ' + (r.n < 0 ? 'negativ' : 'pozitiv') + '. Rezultat: ' + fd(r) + '.', hint: 'Mai întâi semnul, apoi înmulțirea.' };
  };
  G.negProducts = function (R) {
    var items = [], ans = [], i;
    for (i = 0; i < 5; i++) {
      var a = R.int(2, 9) * R.sign(), b = R.int(2, 9) * R.sign(), c = R.bool() ? R.int(2, 6) * R.sign() : null, neg = (a < 0) ^ (b < 0) ^ (c !== null && c < 0);
      items.push(int(a) + ' · ' + intp(b) + (c !== null ? ' · ' + intp(c) : ''));
      if (neg) ans.push(i);
    }
    if (!ans.length || ans.length === 5) return G.negProducts(R);
    return { t: 'multi', q: 'Alege produsele care sunt negative.', opts: items, ans: ans, why: 'Un produs e negativ când are un număr impar de factori negativi.', hint: 'Numără minusurile din fiecare produs.' };
  };

  /* ================= 3.3 Împărțirea ================= */
  G.inverse = function (R, lvl) {
    var f, s;
    if (lvl === 0) { f = pickFrac(R, 2, 9, R.bool()); s = fs(f); }
    else if (lvl === 1) { f = R.bool() ? F(R.int(2, 9) * R.sign()) : PM.neg(pickFrac(R, 2, 9, false)); s = fs(f); }
    else { var d = R.pick([[F(1, 4), '0,25'], [F(1, 5), '0,2'], [F(1, 2), '0,5'], [F(3, 4), '0,75'], [F(2, 5), '0,4']]); f = d[0]; s = d[1]; }
    var inv = PM.div(F(1), f);
    return { t: 'num', q: 'Care este inversul numărului ' + s + ' ?', a: inv, form: 'frac', why: 'Inversul lui x este {1/x}. Produsul dintre un număr și inversul lui este 1: ' + s + ' · ' + fs(inv) + ' = 1. Inversul lui ' + s + ' este ' + fs(inv) + '.', hint: 'Inversează fracția: numărătorul și numitorul își schimbă locurile.' };
  };
  G.divFrac = function (R, lvl) {
    var p = pairFor(R, lvl === 0 ? 1 : lvl === 1 ? 2 : 2), A = lvl === 2 && R.bool() ? PM.neg(p[0]) : p[0], B = lvl === 2 && R.bool() ? PM.neg(p[1]) : p[1], r = PM.div(A, B);
    var sa = A.n < 0 ? '−' + fr(p[2], p[3]) : fr(p[2], p[3]), sb = B.n < 0 ? '(−' + fr(p[4], p[5]) + ')' : fr(p[4], p[5]);
    return { t: 'num', q: 'Calculează. Scrie fracția ireductibilă.', eq: sa + ' : ' + sb, a: r, form: 'frac', reduced: true, why: 'Înmulțim cu inversul: ' + sa + ' · ' + (B.n < 0 ? '(−' + fr(p[5], p[4]) + ')' : fr(p[5], p[4])) + ' = ' + fs(r) + '.', hint: 'a : b = a · inversul lui b.' };
  };
  G.divInt = function (R, lvl) {
    var b = R.int(2, tier(lvl, 9, 12, 15)) * (lvl === 0 ? 1 : R.sign()), k = R.int(2, tier(lvl, 9, 12, 15)) * (lvl === 0 ? 1 : R.sign()), a = b * k;
    return { t: 'num', q: 'Calculează.', eq: int(a) + ' : ' + intp(b), a: F(k), form: 'int', why: 'Valorile: ' + Math.abs(a) + ' : ' + Math.abs(b) + ' = ' + Math.abs(k) + '. Semnul: ' + ((a < 0) === (b < 0) ? 'la fel deci plus' : 'diferit deci minus') + '. Rezultat: ' + int(k) + '.', hint: 'Regula semnelor e aceeași ca la înmulțire.' };
  };
  G.divDec = function (R, lvl) {
    var y = R.int(2, 9), k = R.int(2, 12), sh = tier(lvl, 10, 10, 100), X = F(y * k, sh), Y = F(y, sh), r = F(k);
    if (lvl === 1 && R.bool()) { Y = F(y, 10); X = F(y * k, 100); r = F(k, 10); }
    r = PM.div(X, Y);
    return { t: 'num', q: 'Calculează.', eq: fd(X) + ' : ' + fd(Y), a: r, form: 'dec', why: 'Amplificăm ambele numere cu ' + (Y.d === 10 ? '10' : '100') + ' ca să scăpăm de virgulă la împărțitor: ' + fd(PM.mul(X, F(Y.d))) + ' : ' + fd(PM.mul(Y, F(Y.d))) + ' = ' + fd(r) + '.', hint: 'Înmulțește deîmpărțitul și împărțitorul cu 10, 100…' };
  };
  G.divWord = function (R) {
    var cup = R.pick([[1, 4], [1, 5], [1, 2], [3, 4], [2, 5]]), k = R.int(3, 12), total = PM.mul(F(cup[0], cup[1]), F(k));
    return { t: 'num', q: 'Din ' + fs(total) + ' l de suc se umplu pahare de ' + fr(cup[0], cup[1]) + ' l. Câte pahare se umplu?', a: F(k), form: 'int', unit: 'pahare', why: fs(total) + ' : ' + fr(cup[0], cup[1]) + ' = ' + fs(total) + ' · ' + fr(cup[1], cup[0]) + ' = ' + k + '.', hint: 'Câte părți de mărimea paharului încap în total? Împarte.' };
  };
  G.bugDiv = function (R) {
    var p = pairFor(R, 1), a = p[2], b = p[3], c = p[4], d = p[5];
    return { t: 'bug', q: 'Care linie conține greșeala?', lines: [fr(a, b) + ' : ' + fr(c, d), '= ' + fr(b, a) + ' · ' + fr(c, d), '= ' + raw(b * c, a * d)], bad: 1, why: 'La împărțire se inversează al doilea număr (cel din dreapta), nu primul: ' + fr(a, b) + ' · ' + fr(d, c) + '.', hint: 'Care fracție se inversează?' };
  };
  G.divMc = function (R) {
    var p = pairFor(R, 1), a = p[2], b = p[3], c = p[4], d = p[5];
    return mcS(R, 'Care expresie este egală cu ' + fr(a, b) + ' : ' + fr(c, d) + ' ?', fr(a, b) + ' · ' + fr(d, c), [fr(b, a) + ' · ' + fr(c, d), fr(a, b) + ' · ' + fr(c, d), fr(b, a) + ' · ' + fr(d, c)], { why: 'a : b = a · inversul lui b. Inversul lui ' + fr(c, d) + ' este ' + fr(d, c) + '.', hint: 'Inversezi doar fracția din dreapta.' });
  };

  /* ================= 3.4 Operații combinate ================= */
  G.orderInt = function (R, lvl) {
    var a = R.int(2, 12), b = R.int(2, 9), c = R.int(2, 9), d = R.int(2, 12), kind = R.int(0, tier(lvl, 1, 2, 4)), e, r, w;
    if (kind === 0) { e = a + ' + ' + b + ' · ' + c; r = a + b * c; w = 'Întâi înmulțirea: ' + b + ' · ' + c + ' = ' + (b * c) + '. Apoi ' + a + ' + ' + (b * c) + ' = ' + r + '.'; }
    else if (kind === 1) { e = (a * c) + ' − ' + b + ' · ' + c; r = a * c - b * c; w = 'Întâi înmulțirea: ' + b + ' · ' + c + ' = ' + (b * c) + '. Apoi ' + (a * c) + ' − ' + (b * c) + ' = ' + int(r) + '.'; }
    else if (kind === 2) { e = (b * c) + ' : ' + c + ' + ' + a + ' · ' + d; r = b + a * d; w = 'Înmulțirile și împărțirile primele: ' + (b * c) + ' : ' + c + ' = ' + b + ' și ' + a + ' · ' + d + ' = ' + (a * d) + '. Apoi ' + b + ' + ' + (a * d) + ' = ' + r + '.'; }
    else if (kind === 3) { e = '(' + a + ' + ' + b + ') · ' + c; r = (a + b) * c; w = 'Întâi paranteza: ' + a + ' + ' + b + ' = ' + (a + b) + '. Apoi ' + (a + b) + ' · ' + c + ' = ' + r + '.'; }
    else { e = int(-a) + ' · ' + intp(b) + ' + ' + (c * d) + ' : ' + intp(-c); r = -a * b - d; w = 'Întâi ' + int(-a) + ' · ' + intp(b) + ' = ' + int(-a * b) + ' și ' + (c * d) + ' : ' + intp(-c) + ' = ' + int(-d) + '. Apoi ' + int(-a * b) + ' + ' + intp(-d) + ' = ' + int(r) + '.'; }
    return { t: 'num', q: 'Calculează.', eq: e, a: F(r), form: 'int', why: w, hint: 'Paranteze, apoi înmulțiri și împărțiri, apoi adunări și scăderi.' };
  };
  G.orderFrac = function (R, lvl) {
    var D = R.pick([[2, 3, 4], [2, 3, 3], [3, 4, 3], [2, 5, 5], [4, 3, 2], [6, 2, 3]]), a = F(R.int(1, 2), D[0]), b = F(R.int(1, 2), D[1]), c = F(R.int(1, 3), D[2]);
    var mulKind = lvl < 2 || R.bool(), m = mulKind ? PM.mul(b, c) : PM.div(b, c), r = PM.add(a, m);
    var op = mulKind ? ' · ' : ' : ';
    return { t: 'num', q: 'Calculează. Scrie fracția ireductibilă.', eq: fs(a) + ' + ' + fs(b) + op + fs(c), a: r, form: 'frac', reduced: true, why: 'Întâi ' + (mulKind ? 'înmulțirea' : 'împărțirea') + ': ' + fs(b) + op + fs(c) + ' = ' + fs(m) + '. Apoi ' + fs(a) + ' + ' + fs(m) + ' = ' + fs(r) + '.', hint: 'Înmulțirea și împărțirea înaintea adunării.' };
  };
  G.parMix = function (R) {
    var a = R.int(6, 20), b = R.int(1, a - 1), c = R.int(2, 9), d = R.int(2, 6), t = (a - b) * c;
    var k = d; if (t % d !== 0) k = 1;
    return { t: 'num', q: 'Calculează.', eq: '(' + a + ' − ' + b + ') · ' + c + ' : ' + k, a: F(t / k), form: 'int', why: 'Întâi paranteza: ' + a + ' − ' + b + ' = ' + (a - b) + '. Apoi de la stânga la dreapta: ' + (a - b) + ' · ' + c + ' = ' + t + ', iar ' + t + ' : ' + k + ' = ' + (t / k) + '.', hint: 'Paranteza are prioritate.' };
  };
  G.stepOrderCalc = function (R) {
    var a = R.int(3, 15), b = R.int(2, 9), c = R.int(2, 9), d = R.int(2, 12), m = b * c, s = a + m, r = s - d;
    return { t: 'order', q: 'Pune pașii în ordine pentru a calcula ' + a + ' + ' + b + ' · ' + c + ' − ' + d + ' .', tiles: ['Calculez înmulțirea: ' + b + ' · ' + c + ' = ' + m, 'Calculez adunarea: ' + a + ' + ' + m + ' = ' + s, 'Calculez scăderea: ' + s + ' − ' + d + ' = ' + int(r), 'Rezultat final: ' + int(r)],
      why: 'Înmulțirea se face înaintea adunării și scăderii; apoi mergem de la stânga la dreapta.', hint: 'Înmulțirea are prioritate.' };
  };
  G.word2 = function (R) {
    var T = R.pick([[1, 4], [1, 5], [1, 3], [3, 8]]), m = R.int(2, 6), b = T[1], a = T[0], total = b * m * (b === 8 ? 1 : 1), rest = total - total * a / b;
    var divs = [], i; for (i = 2; i <= rest; i++) if (rest % i === 0 && i <= 6) divs.push(i);
    var dd = R.pick(divs.length ? divs : [2]), cc = R.int(1, dd - 1);
    if (rest % dd !== 0) { dd = 1; cc = 1; }
    var used2 = rest / dd * cc, left = rest - used2;
    return { t: 'num', q: 'Într-un bidon sunt ' + total + ' litri. Dimineața se toarnă ' + fr(a, b) + ' din bidon, iar seara ' + fr(cc, dd) + ' din ce a rămas. Câți litri rămân?', a: F(left), form: 'int', unit: 'litri',
      why: 'Dimineața: ' + fr(a, b) + ' din ' + total + ' = ' + (total * a / b) + ' l, rămân ' + rest + ' l. Seara: ' + fr(cc, dd) + ' din ' + rest + ' = ' + used2 + ' l. Rămân ' + rest + ' − ' + used2 + ' = ' + left + ' litri.', hint: 'Calculează pe rând: mai întâi cât rămâne după prima turnare.' };
  };
  G.bugOrder = function (R) {
    var a = R.int(2, 9), b = R.int(2, 9), c = R.int(2, 9), w = (a + b) * c;
    return { t: 'bug', q: 'Care linie conține greșeala?', lines: [a + ' + ' + b + ' · ' + c, '= ' + (a + b) + ' · ' + c, '= ' + w], bad: 1, why: 'Înmulțirea se face înaintea adunării: ' + b + ' · ' + c + ' = ' + (b * c) + ', apoi ' + a + ' + ' + (b * c) + ' = ' + (a + b * c) + '.', hint: 'Ce operație are prioritate?' };
  };

  var out = { G: G, tier: tier };
  root.PG = out;
  if (typeof module !== 'undefined' && module.exports) module.exports = out;
})(typeof window !== 'undefined' ? window : globalThis);
