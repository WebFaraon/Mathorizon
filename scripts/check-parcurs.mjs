// Verificări pentru Parcurs: aritmetica din lib.js, generatoarele din gens.js și structura conținutului (js/parcurs/content*.js).
// Rulează cu: npm run check:parcurs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PM = require('../js/parcurs/lib.js');
const { G } = require('../js/parcurs/gens.js');
let content = null;
try { content = require('../js/parcurs/content7.js'); } catch (e) { /* conținutul poate lipsi la început */ }

let ok = 0, bad = 0;
const fails = [];
function check(c, msg) { if (c) ok++; else { bad++; if (fails.length < 40) fails.push(msg); } }

/* ---------- aritmetică, comparată cu numere în virgulă mobilă ---------- */
const R0 = PM.rng(7);
for (let i = 0; i < 2000; i++) {
  const a = PM.F(R0.int(-30, 30), R0.int(1, 20)), b = PM.F(R0.int(-30, 30), R0.int(1, 20));
  check(Math.abs(PM.val(PM.add(a, b)) - (PM.val(a) + PM.val(b))) < 1e-9, 'add');
  check(Math.abs(PM.val(PM.sub(a, b)) - (PM.val(a) - PM.val(b))) < 1e-9, 'sub');
  check(Math.abs(PM.val(PM.mul(a, b)) - PM.val(a) * PM.val(b)) < 1e-9, 'mul');
  if (b.n !== 0) check(Math.abs(PM.val(PM.div(a, b)) - PM.val(a) / PM.val(b)) < 1e-9, 'div');
  check(PM.cmp(a, b) === Math.sign(PM.val(a) - PM.val(b)) || Math.abs(PM.val(a) - PM.val(b)) < 1e-12, 'cmp');
}
/* scrierea zecimală și citirea ei înapoi */
for (let n = -40; n <= 40; n++) for (let d = 1; d <= 16; d++) {
  const f = PM.F(n, d), s = PM.fmtDec(f), p = PM.parseAnswer(s);
  check(p && PM.eq(p.f, f), 'dec round-trip ' + n + '/' + d + ' -> ' + s);
  const q = PM.parseAnswer(PM.fmtRaw(n, d).replace(/[{}]/g, '').replace('/', '/'));
  check(q && PM.eq(q.f, f), 'frac parse ' + n + '/' + d);
}
check(PM.fmtDec(PM.F(1, 3)) === '0,(3)', 'fmtDec 1/3');
check(PM.fmtDec(PM.F(5, 6)) === '0,8(3)', 'fmtDec 5/6');
check(PM.fmtDec(PM.F(4, 11)) === '0,(36)', 'fmtDec 4/11');
check(PM.fmtDec(PM.F(-3, 8)) === '−0,375', 'fmtDec -3/8');
check(PM.fmtDec(PM.F(7, 4)) === '1,75', 'fmtDec 7/4');
[['0,(3)', 1, 3], ['0,8(3)', 5, 6], ['0,(36)', 4, 11], ['1,2(45)', 41, 33 * 1 + 0 || 33], ['-0,(5)', -5, 9], ['0,1(6)', 1, 6]].forEach(([s, n, d]) => {
  const p = PM.parseAnswer(s); if (s === '1,2(45)') { check(p && PM.eq(p.f, PM.F(1233, 990)), 'parse 1,2(45)'); return; }
  check(p && PM.eq(p.f, PM.F(n, d)), 'parse periodic ' + s);
});
check(PM.parseAnswer('abc') === null && PM.parseAnswer('') === null && PM.parseAnswer('1/0') === null, 'parse invalid');
check(PM.parseAnswer('−3/4').f.n === -3 && PM.parseAnswer('3/−4').f.n === -3, 'parse minus forms');
check(PM.parseAnswer('6/8').reduced === false && PM.parseAnswer('3/4').reduced === true && PM.parseAnswer('-3/4').reduced === true, 'reduced flag');
check(PM.m('{3/4}').includes('class="fr"') && PM.m('x^2').includes('<sup>2</sup>') && !PM.m('<b>').includes('<b>'), 'markup');

/* ---------- mic evaluator pentru expresii scrise cu fracții, ca să verificăm răspunsurile ---------- */
function evalExpr(src) {
  let s = src.replace(/\s+/g, '').replace(/−/g, '-').replace(/·/g, '*');
  let i = 0;
  const peek = () => s[i];
  function num() {
    if (s[i] === '(') { i++; const v = add(); if (s[i] !== ')') throw new Error('paranteză'); i++; return v; }
    if (s[i] === '{') {
      const j = s.indexOf('}', i), body = s.slice(i + 1, j); i = j + 1;
      const [a, b] = body.split('/'); const ev = (t) => evalExpr(t);
      return PM.div(ev(a.replace(/-/g, '−')), ev(b.replace(/-/g, '−')));
    }
    const m = /^\d+(,\d+)?/.exec(s.slice(i)); if (!m) throw new Error('număr la ' + s.slice(i));
    i += m[0].length; return PM.parseAnswer(m[0]).f;
  }
  function un() { if (s[i] === '-') { i++; return PM.neg(un()); } if (s[i] === '+') { i++; return un(); } return num(); }
  function mul() { let v = un(); while (s[i] === '*' || s[i] === ':') { const o = s[i++]; const r = un(); v = o === '*' ? PM.mul(v, r) : PM.div(v, r); } return v; }
  function add() { let v = mul(); while (s[i] === '+' || s[i] === '-') { const o = s[i++]; const r = mul(); v = o === '+' ? PM.add(v, r) : PM.sub(v, r); } return v; }
  const v = add(); if (i !== s.length) throw new Error('rest: ' + s.slice(i)); return v;
}
const valOf = (t) => { try { return evalExpr(t); } catch (e) { return null; } };

/* ---------- generatoare ---------- */
const bank = [];
function strs(o, out = []) { if (typeof o === 'string') out.push(o); else if (Array.isArray(o)) o.forEach((x) => strs(x, out)); else if (o && typeof o === 'object') Object.keys(o).forEach((k) => { if (k !== 'a' || typeof o.a === 'string') strs(o[k], out); }); return out; }
function validate(name, lvl, seed, sp) {
  const tag = name + ':' + lvl + ':' + seed;
  check(sp && typeof sp.q === 'string' && sp.q.length > 3, tag + ' q');
  check(typeof sp.why === 'string' && sp.why.length > 8, tag + ' why');
  strs(sp).forEach((s) => { check(!/NaN|undefined|\[object|Infinity/.test(s), tag + ' text: ' + s); const h = PM.m(s); check(!/[{}]/.test(h.replace(/<[^>]+>/g, '')), tag + ' acolade: ' + s); });
  if (sp.t === 'mc') {
    check(sp.opts.length >= 2 && sp.opts.length <= 4 && (sp.fixed || sp.opts.length >= 3), tag + ' nr opțiuni ' + sp.opts.length);
    check(new Set(sp.opts).size === sp.opts.length, tag + ' opțiuni duplicate');
    check(Number.isInteger(sp.a) && sp.a >= 0 && sp.a < sp.opts.length, tag + ' index');
    const vs = sp.opts.map(valOf);
    if (!sp.sameValueOk && vs.every((v) => v)) { const same = vs.filter((v) => PM.eq(v, vs[sp.a])).length; check(same === 1, tag + ' două opțiuni egale ca valoare: ' + sp.opts.join(' | ')); }
  } else if (sp.t === 'num') {
    check(sp.a && Number.isInteger(sp.a.n) && Number.isInteger(sp.a.d) && sp.a.d > 0, tag + ' a');
    if (sp.form === 'int') check(sp.a.d === 1, tag + ' int dar ' + sp.a.n + '/' + sp.a.d);
    if (sp.form === 'dec') check(PM.isFiniteDec(sp.a), tag + ' dec dar periodic');
    const shown = sp.form === 'dec' ? PM.fmtDec(sp.a) : sp.form === 'per' ? PM.fmtDec(sp.a) : PM.fmtRaw(sp.a.n, sp.a.d).replace(/[{}]/g, '');
    const p = PM.parseAnswer(shown); check(p && PM.eq(p.f, sp.a), tag + ' răspunsul nu se poate scrie: ' + shown);
    if (sp.eq && !/▢/.test(sp.eq)) { const v = valOf(sp.eq); if (v) check(PM.eq(v, sp.a), tag + ' expresia ' + sp.eq + ' = ' + PM.fmtDec(v) + ' dar răspunsul ' + PM.fmtDec(sp.a)); }
  } else if (sp.t === 'multi') {
    check(sp.ans.length > 0 && sp.ans.length < sp.opts.length && sp.ans.every((i) => i >= 0 && i < sp.opts.length), tag + ' multi');
  } else if (sp.t === 'order') {
    check(sp.tiles.length >= 3 && new Set(sp.tiles).size === sp.tiles.length, tag + ' tiles');
    const vs = sp.tiles.map(valOf);
    if (vs.every((v) => v)) for (let i = 1; i < vs.length; i++) check(PM.cmp(vs[i - 1], vs[i]) < 0, tag + ' ordinea crescătoare: ' + sp.tiles.join(' , '));
  } else if (sp.t === 'bug') {
    check(Number.isInteger(sp.bad) && sp.bad > 0 && sp.bad < sp.lines.length, tag + ' bug');
  } else if (sp.t === 'match') {
    check(sp.pairs.length >= 3 && new Set(sp.pairs.map((p) => p[0])).size === sp.pairs.length && new Set(sp.pairs.map((p) => p[1])).size === sp.pairs.length, tag + ' match');
    sp.pairs.forEach((p) => { const a = valOf(p[0]), b = valOf(p[1]); if (a && b) check(PM.eq(a, b), tag + ' pereche ' + p.join(' = ')); });
  } else if (sp.t === 'axis') {
    check(sp.target.n * sp.sub % sp.target.d === 0 && PM.val(sp.target) >= sp.min && PM.val(sp.target) <= sp.max, tag + ' axis');
    if (sp.start) check(PM.val(sp.start) >= sp.min && PM.val(sp.start) <= sp.max, tag + ' axis start');
  } else if (sp.t === 'bar') {
    check(sp.n >= 1 && sp.n <= sp.d && sp.d <= 14, tag + ' bar');
  } else check(false, tag + ' tip necunoscut ' + sp.t);
}
let count = 0;
for (const name of Object.keys(G)) {
  for (let lvl = 0; lvl <= 2; lvl++) for (let seed = 1; seed <= 250; seed++) {
    let sp;
    try { sp = G[name](PM.rng(seed * 977 + lvl), lvl); } catch (e) { check(false, name + ':' + lvl + ':' + seed + ' excepție ' + e.message); continue; }
    validate(name, lvl, seed, sp); count++;
  }
}

/* ---------- conținut ---------- */
if (content && content.build) {
  let built = 0;
  for (const id of content.allIds()) for (let seed = 1; seed <= 40; seed++) {
    let L; try { L = content.build(id, PM.rng(seed)); } catch (e) { check(false, id + ' excepție ' + e.message); continue; }
    check(L && L.exercises.length === (id.endsWith('.test') || id.endsWith('.skip') ? 10 : 7), id + ' număr de exerciții');
    if (!L) continue;
    L.exercises.forEach((sp, i) => validate(id + '#' + i, sp.rar, seed, sp)); built++;
  }
  console.log(built + ' lecții construite din conținut');
}
if (content && content.validate) { const errs = content.validate(); errs.forEach((e) => check(false, 'conținut: ' + e)); check(errs.length === 0, 'conținut valid'); }

console.log(`${ok} verificări reușite, ${bad} eșuate (${count} exerciții generate, ${Object.keys(G).length} generatoare)`);
if (bad) { console.log(fails.join('\n')); process.exit(1); }
