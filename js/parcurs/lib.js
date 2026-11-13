/* ============================================================
   Parcurs: aritmetica cu fracții și scrierea matematică (fără dependențe).
   Folosit de motorul lecțiilor (js/parcurs/engine.js), de generatoare (gens.js) și de verificările din scripts/check-parcurs.mjs.

   Scriere (m): {a/b} = fracție, ^{n} sau ^n = exponent, **text** = îngroșat, [[text]] = evidențiat, ▢ = loc gol.
   Numerele zecimale se scriu cu virgulă, perioada între paranteze: 0,(3).
   ============================================================ */
(function (root) {
  'use strict';

  var gcd = function (a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; };
  var lcm = function (a, b) { return Math.abs(a * b) / (gcd(a, b) || 1); };

  /* fracție redusă: {n, d} cu d > 0 */
  function F(n, d) {
    if (d === undefined) d = 1;
    if (d === 0) throw new Error('numitor 0');
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d) || 1;
    return { n: n / g, d: d / g };
  }
  var add = function (a, b) { return F(a.n * b.d + b.n * a.d, a.d * b.d); };
  var sub = function (a, b) { return F(a.n * b.d - b.n * a.d, a.d * b.d); };
  var mul = function (a, b) { return F(a.n * b.n, a.d * b.d); };
  var div = function (a, b) { return F(a.n * b.d, a.d * b.n); };
  var neg = function (a) { return { n: -a.n, d: a.d }; };
  var abs = function (a) { return { n: Math.abs(a.n), d: a.d }; };
  var eq = function (a, b) { return a.n * b.d === b.n * a.d; };
  var cmp = function (a, b) { var x = a.n * b.d - b.n * a.d; return x < 0 ? -1 : x > 0 ? 1 : 0; };
  var val = function (a) { return a.n / a.d; };

  /* ---- scriere zecimală: {neg, ip, pre, per} din împărțirea n : d ---- */
  function decInfo(f) {
    var n = Math.abs(f.n), d = f.d;
    var ip = Math.floor(n / d), r = n % d, seen = {}, digits = [], at = -1;
    while (r !== 0) {
      if (seen[r] !== undefined) { at = seen[r]; break; }
      seen[r] = digits.length;
      r *= 10;
      digits.push(Math.floor(r / d));
      r = r % d;
      if (digits.length > 400) break;
    }
    var pre = at < 0 ? digits.join('') : digits.slice(0, at).join('');
    var per = at < 0 ? '' : digits.slice(at).join('');
    return { neg: f.n < 0, ip: ip, pre: pre, per: per };
  }
  function fmtDec(f) {
    var x = decInfo(f), s = (x.neg ? '−' : '') + x.ip;
    if (x.pre || x.per) s += ',' + x.pre + (x.per ? '(' + x.per + ')' : '');
    return s;
  }
  var isFinite_ = function (f) { return decInfo(f).per === ''; };

  /* ---- scriere ca fracție (markup) ---- */
  function fmtF(f) {
    var s = f.n < 0 ? '−' : '';
    return s + (f.d === 1 ? String(Math.abs(f.n)) : '{' + Math.abs(f.n) + '/' + f.d + '}');
  }
  /* fracție nereductibilă pe loc, cum o scrie elevul: n/d exact */
  function fmtRaw(n, d) {
    var s = (n < 0) !== (d < 0) ? '−' : '';
    return s + '{' + Math.abs(n) + '/' + Math.abs(d) + '}';
  }
  /* număr cu paranteze când e negativ, pentru expresii */
  function par(f, asDec) {
    var s = asDec ? fmtDec(f) : fmtF(f);
    return f.n < 0 ? '(' + s + ')' : s;
  }

  /* ---- citirea răspunsului scris de elev ----
     întoarce {f, raw:{n,d}, kind:'int'|'dec'|'frac'|'per', reduced} sau null */
  function parseAnswer(str) {
    var s = String(str == null ? '' : str).trim().replace(/[−–—]/g, '-').replace(/\s+/g, '').replace(/,/g, '.');
    if (!s) return null;
    var m;
    if ((m = /^(-?)(\d+)$/.exec(s))) {
      var iv = parseInt(m[1] + m[2], 10);
      return { f: F(iv), raw: { n: iv, d: 1 }, kind: 'int', reduced: true };
    }
    if ((m = /^(-?)(\d*)\.(\d+)$/.exec(s)) && (m[2] !== '' || m[3] !== '')) {
      var den = Math.pow(10, m[3].length), num = parseInt((m[2] || '0') + m[3], 10) * (m[1] ? -1 : 1);
      return { f: F(num, den), raw: { n: num, d: den }, kind: 'dec', reduced: false };
    }
    if ((m = /^(-?)(\d+)\/(-?)(\d+)$/.exec(s))) {
      var a = parseInt(m[2], 10) * (m[1] ? -1 : 1), b = parseInt(m[4], 10) * (m[3] ? -1 : 1);
      if (b === 0) return null;
      return { f: F(a, b), raw: { n: a, d: b }, kind: 'frac', reduced: gcd(a, b) === 1 && b > 0 };
    }
    /* periodic: 0.(3)  1.2(45)  -0.8(3) */
    if ((m = /^(-?)(\d*)\.(\d*)\((\d+)\)$/.exec(s))) {
      var ip = m[2] === '' ? 0 : parseInt(m[2], 10), pre = m[3], per = m[4];
      var all = parseInt((String(ip) + pre + per), 10), part = parseInt(String(ip) + pre, 10);
      var dd = Math.pow(10, pre.length) * (Math.pow(10, per.length) - 1);
      var nn = (all - part) * (m[1] ? -1 : 1);
      if (!isFinite(nn) || !isFinite(dd)) return null;
      return { f: F(nn, dd), raw: null, kind: 'per', reduced: true };
    }
    return null;
  }

  /* ---- scrierea în HTML ---- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /* tot ce e matematică (numere, zecimale, 0,(3), 3/4, x, =, +, −, ×, ÷, paranteze) primește <span class="mt">, ca să se scrie cu fontul formulelor din capitole (Space Grotesk) */
  var NUM = '\\d+(?:,(?:\\d+(?:\\(\\d+\\))?|\\(\\d+\\)))?';
  var ATOM = '(?:' + NUM + '(?:\\/' + NUM + ')?|(?<![\\p{L}\\d])[xyznk](?![\\p{L}])|[=+−×÷·≤≥≈≠()]|&lt;|&gt;)';
  var RUN = null;
  try { RUN = new RegExp(ATOM + '(?:[ \\u00a0]?' + ATOM + ')*', 'gu'); } catch (e) { RUN = null; }
  function mathify(s) {
    if (!RUN) return s;
    return s.split(/(<[^>]*>)/).map(function (seg) {
      if (seg.charAt(0) === '<') return seg;
      return seg.replace(RUN, function (r) { return /[\d=+−×÷·≤≥≈≠xyznk]|&lt;|&gt;/.test(r) ? '<span class="mt">' + r + '</span>' : r; });
    }).join('');
  }
  function m(src) {
    var s = esc(src == null ? '' : src);
    s = s.replace(/\{([^{}\/]+)\/([^{}]+)\}/g, function (_, a, b) { return '<span class="fr"><i>' + a + '</i><i>' + b + '</i></span>'; });
    s = s.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>').replace(/\^(−?\w)/g, '<sup>$1</sup>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[\[([^\]]+)\]\]/g, '<mark>$1</mark>');
    s = s.replace(/▢/g, '<span class="bx" aria-label="loc gol"></span>');
    return mathify(s);
  }
  /* aceeași scriere fără HTML, pentru titluri și aria */
  function plain(src) {
    return String(src == null ? '' : src).replace(/\{([^{}\/]+)\/([^{}]+)\}/g, '$1/$2').replace(/\^\{([^{}]+)\}/g, '^$1').replace(/\*\*|\[\[|\]\]/g, '');
  }

  /* ---- hazard (se poate semăna, pentru verificări) ---- */
  function rng(seed) {
    var a = seed === undefined ? (Math.random() * 4294967296) >>> 0 : seed >>> 0;
    function next() { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    var R = {
      next: next,
      int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      bool: function (p) { return next() < (p === undefined ? 0.5 : p); },
      shuffle: function (arr) { var o = arr.slice(); for (var i = o.length - 1; i > 0; i--) { var j = Math.floor(next() * (i + 1)); var t = o[i]; o[i] = o[j]; o[j] = t; } return o; },
      sign: function () { return next() < 0.5 ? -1 : 1; }
    };
    return R;
  }

  var PM = { gcd: gcd, lcm: lcm, F: F, add: add, sub: sub, mul: mul, div: div, neg: neg, abs: abs, eq: eq, cmp: cmp, val: val,
    decInfo: decInfo, fmtDec: fmtDec, isFiniteDec: isFinite_, fmtF: fmtF, fmtRaw: fmtRaw, par: par, parseAnswer: parseAnswer, m: m, plain: plain, esc: esc, rng: rng };
  root.PM = PM;
  if (typeof module !== 'undefined' && module.exports) module.exports = PM;
})(typeof window !== 'undefined' ? window : globalThis);
