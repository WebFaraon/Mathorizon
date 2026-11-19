/* Tabla live: editorul de ecuații (2026-11-19).
   Un ajutor de scriere pentru telefon, laptop sau mouse greu de folosit: o casetă de editare matematică (MathLive) cu o tastatură proprie în română,
   iar formula terminată se pune pe tablă ca UN SINGUR obiect vectorial (un traseu umplut, ca scrisul cu pixul), deci rămâne clară la orice zoom, se mută,
   se redimensionează, se șterge și se anulează ca orice alt obiect, iar ceilalți o văd fără să încarce nimic.
   Cum: formula LaTeX din casetă e desenată de MathJax (SVG, fără fonturi), iar SVG-ul e topit într-un singur traseu în coordonatele tablei.
   Bibliotecile (js/vendor/mathlive, js/vendor/mathjax) se încarcă abia la prima deschidere a editorului.
   În tablă (window.Whiteboard) se leagă prin: wb._canvasWrap, wb._panX/_panY/_scale, wb._mathCommit({...}), wb._mathClosed(). */
(function (global) {
  'use strict';
  var SCRIPT = document.currentScript && document.currentScript.src ? document.currentScript.src : '';
  var VENDOR = (SCRIPT ? SCRIPT.replace(/[^\/]*$/, '') : 'js/') + 'vendor/';
  var NS = 'http://www.w3.org/2000/svg';

  /* ======================= încărcare ======================= */
  var loadP = null, MLmod = null;
  function load() {
    if (loadP) return loadP;
    loadP = new Promise(function (res, rej) {
      if (global.MathJax && global.MathJax.tex2svg) return res();
      global.MathJax = { svg: { fontCache: 'none' }, startup: { typeset: false }, options: { enableMenu: false } };
      var s = document.createElement('script');
      s.src = VENDOR + 'mathjax/tex-svg.js'; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('mathjax')); };
      document.head.appendChild(s);
    }).then(function () { return global.MathJax.startup.promise; })
      .then(function () { return import(VENDOR + 'mathlive/mathlive.min.mjs'); })
      .then(function (m) {
        MLmod = m;
        var E = m.MathfieldElement;
        try { E.fontsDirectory = VENDOR + 'mathlive/fonts'; } catch (e) {}
        try { E.soundsDirectory = null; E.plonkSound = null; E.keypressSound = null; } catch (e) {}
        try { E.decimalSeparator = ','; } catch (e) {}
        return m;
      });
    loadP.catch(function () { loadP = null; });
    return loadP;
  }

  /* ======================= din SVG într-un traseu ======================= */
  // matrice [a b c d e f] ca în SVG
  function mmul(m, n) {
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
            m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  }
  function mpt(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  function parseTransform(str) {
    var m = [1, 0, 0, 1, 0, 0];
    if (!str) return m;
    var re = /(translate|scale|matrix|rotate)\s*\(([^)]*)\)/g, t;
    while ((t = re.exec(str))) {
      var a = t[2].split(/[\s,]+/).filter(Boolean).map(Number), n = null;
      if (t[1] === 'translate') n = [1, 0, 0, 1, a[0], a[1] || 0];
      else if (t[1] === 'scale') n = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0];
      else if (t[1] === 'matrix') n = a;
      else if (t[1] === 'rotate') { var r = a[0] * Math.PI / 180; n = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]; }
      if (n) m = mmul(m, n);
    }
    return m;
  }

  // "M 0 0 L ..." în segmente absolute: [{t:'M',x,y} | {t:'L'} | {t:'C',x1,y1,x2,y2,x,y} | {t:'Q',x1,y1,x,y} | {t:'Z'}], un subtraseu = o listă
  function pathToSubs(d) {
    var re = /([MmLlHhVvCcSsQqTtZzAa])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g, tk = [], t;
    while ((t = re.exec(d))) tk.push(t[1] ? t[1] : parseFloat(t[2]));
    var i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, prev = '', subs = [], cur = null;
    function num() { return tk[i++]; }
    while (i < tk.length) {
      if (typeof tk[i] === 'string') cmd = tk[i++];
      var rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      if (C === 'Z') { if (cur) cur.push({ t: 'Z' }); x = sx; y = sy; prev = 'Z'; continue; }
      if (C === 'M') {
        var mx = num() + (rel ? x : 0), my = num() + (rel ? y : 0);
        cur = [{ t: 'M', x: mx, y: my }]; subs.push(cur); x = sx = mx; y = sy = my; cmd = rel ? 'l' : 'L'; prev = 'M'; continue;
      }
      if (!cur) { cur = [{ t: 'M', x: x, y: y }]; subs.push(cur); }
      else if (prev === 'Z') { cur = [{ t: 'M', x: x, y: y }]; subs.push(cur); }
      if (C === 'L') { x = num() + (rel ? x : 0); y = num() + (rel ? y : 0); cur.push({ t: 'L', x: x, y: y }); }
      else if (C === 'H') { x = num() + (rel ? x : 0); cur.push({ t: 'L', x: x, y: y }); }
      else if (C === 'V') { y = num() + (rel ? y : 0); cur.push({ t: 'L', x: x, y: y }); }
      else if (C === 'C') {
        var x1 = num() + (rel ? x : 0), y1 = num() + (rel ? y : 0), x2 = num() + (rel ? x : 0), y2 = num() + (rel ? y : 0), ex = num() + (rel ? x : 0), ey = num() + (rel ? y : 0);
        cur.push({ t: 'C', x1: x1, y1: y1, x2: x2, y2: y2, x: ex, y: ey }); lcx = x2; lcy = y2; x = ex; y = ey;
      } else if (C === 'S') {
        var sx2 = num() + (rel ? x : 0), sy2 = num() + (rel ? y : 0), sex = num() + (rel ? x : 0), sey = num() + (rel ? y : 0);
        var rx = (prev === 'C' || prev === 'S') ? 2 * x - lcx : x, ry = (prev === 'C' || prev === 'S') ? 2 * y - lcy : y;
        cur.push({ t: 'C', x1: rx, y1: ry, x2: sx2, y2: sy2, x: sex, y: sey }); lcx = sx2; lcy = sy2; x = sex; y = sey;
      } else if (C === 'Q') {
        var qx = num() + (rel ? x : 0), qy = num() + (rel ? y : 0), qex = num() + (rel ? x : 0), qey = num() + (rel ? y : 0);
        cur.push({ t: 'Q', x1: qx, y1: qy, x: qex, y: qey }); lcx = qx; lcy = qy; x = qex; y = qey;
      } else if (C === 'T') {
        var tex = num() + (rel ? x : 0), tey = num() + (rel ? y : 0);
        var qrx = (prev === 'Q' || prev === 'T') ? 2 * x - lcx : x, qry = (prev === 'Q' || prev === 'T') ? 2 * y - lcy : y;
        cur.push({ t: 'Q', x1: qrx, y1: qry, x: tex, y: tey }); lcx = qrx; lcy = qry; x = tex; y = tey;
      } else throw new Error('arc');
      prev = C;
    }
    return subs;
  }
  function mapSub(sub, m) {
    return sub.map(function (s) {
      if (s.t === 'Z') return s;
      var o = { t: s.t }, p = mpt(m, s.x, s.y); o.x = p[0]; o.y = p[1];
      if (s.t === 'C') { var a = mpt(m, s.x1, s.y1), b = mpt(m, s.x2, s.y2); o.x1 = a[0]; o.y1 = a[1]; o.x2 = b[0]; o.y2 = b[1]; }
      else if (s.t === 'Q') { var q = mpt(m, s.x1, s.y1); o.x1 = q[0]; o.y1 = q[1]; }
      return o;
    });
  }
  function subBox(sub) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    function add(x, y) { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
    sub.forEach(function (s) { if (s.t === 'Z') return; add(s.x, s.y); if (s.t === 'C') { add(s.x1, s.y1); add(s.x2, s.y2); } else if (s.t === 'Q') add(s.x1, s.y1); });
    return b;
  }
  // un subtraseu cu curbe devine o poligonală (doar când trebuie tăiat)
  function flatten(sub) {
    var pts = [], x = 0, y = 0, N = 18;
    sub.forEach(function (s) {
      if (s.t === 'M' || s.t === 'L') { pts.push([s.x, s.y]); x = s.x; y = s.y; }
      else if (s.t === 'C') {
        for (var k = 1; k <= N; k++) { var u = k / N, v = 1 - u; pts.push([v * v * v * x + 3 * v * v * u * s.x1 + 3 * v * u * u * s.x2 + u * u * u * s.x, v * v * v * y + 3 * v * v * u * s.y1 + 3 * v * u * u * s.y2 + u * u * u * s.y]); }
        x = s.x; y = s.y;
      } else if (s.t === 'Q') {
        for (var k2 = 1; k2 <= N; k2++) { var u2 = k2 / N, v2 = 1 - u2; pts.push([v2 * v2 * x + 2 * v2 * u2 * s.x1 + u2 * u2 * s.x, v2 * v2 * y + 2 * v2 * u2 * s.y1 + u2 * u2 * s.y]); }
        x = s.x; y = s.y;
      }
    });
    return pts;
  }
  function clipPoly(pts, r) {   // Sutherland-Hodgman pe un dreptunghi
    function pass(list, inside, cross) {
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var a = list[i], b = list[(i + 1) % list.length], ia = inside(a), ib = inside(b);
        if (ia) out.push(a);
        if (ia !== ib) out.push(cross(a, b));
      }
      return out;
    }
    var p = pts;
    p = pass(p, function (q) { return q[0] >= r[0]; }, function (a, b) { var t = (r[0] - a[0]) / (b[0] - a[0]); return [r[0], a[1] + t * (b[1] - a[1])]; });
    if (p.length) p = pass(p, function (q) { return q[0] <= r[2]; }, function (a, b) { var t = (r[2] - a[0]) / (b[0] - a[0]); return [r[2], a[1] + t * (b[1] - a[1])]; });
    if (p.length) p = pass(p, function (q) { return q[1] >= r[1]; }, function (a, b) { var t = (r[1] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), r[1]]; });
    if (p.length) p = pass(p, function (q) { return q[1] <= r[3]; }, function (a, b) { var t = (r[3] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), r[3]]; });
    return p;
  }
  function inter(a, b) { return a ? [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])] : b; }
  function r2(n) { return String(Math.round(n * 100) / 100); }
  function subToStr(sub) {
    return sub.map(function (s) {
      if (s.t === 'Z') return 'Z';
      if (s.t === 'C') return 'C ' + r2(s.x1) + ' ' + r2(s.y1) + ' ' + r2(s.x2) + ' ' + r2(s.y2) + ' ' + r2(s.x) + ' ' + r2(s.y);
      if (s.t === 'Q') return 'Q ' + r2(s.x1) + ' ' + r2(s.y1) + ' ' + r2(s.x) + ' ' + r2(s.y);
      return s.t + ' ' + r2(s.x) + ' ' + r2(s.y);
    }).join(' ');
  }

  // SVG-ul MathJax (grupuri cu transformări, <path>, <rect>, <svg> imbricat cu decupare) -> un singur șir de traseu
  function svgToPath(svg, scale, ox, oy) {
    var vb = (svg.getAttribute('viewBox') || '0 0 0 0').split(/[\s,]+/).map(Number);
    var out = [];
    var base = [scale, 0, 0, scale, -vb[0] * scale + ox, -vb[1] * scale + oy];
    function emit(sub, clip) {
      if (clip) {
        var b = subBox(sub), e = 0.001;
        if (b[2] < clip[0] - e || b[0] > clip[2] + e || b[3] < clip[1] - e || b[1] > clip[3] + e) return;   // întreg în afara ferestrei
        if (!(b[0] >= clip[0] - e && b[1] >= clip[1] - e && b[2] <= clip[2] + e && b[3] <= clip[3] + e)) {   // iese parțial: o taiem
          var poly = clipPoly(flatten(sub), clip);
          if (poly.length < 3) return;
          var cs = [{ t: 'M', x: poly[0][0], y: poly[0][1] }];
          for (var i = 1; i < poly.length; i++) cs.push({ t: 'L', x: poly[i][0], y: poly[i][1] });
          cs.push({ t: 'Z' });
          out.push(subToStr(cs)); return;
        }
      }
      out.push(subToStr(sub));
    }
    function walk(el, M, clip) {
      var tag = el.tagName.toLowerCase();
      if (tag === 'title' || tag === 'defs' || tag === 'desc') return;
      if (tag === 'text' || tag === 'foreignobject' || tag === 'use' || tag === 'image') throw new Error('unsupported:' + tag);
      var m = el.getAttribute && el.getAttribute('transform') ? mmul(M, parseTransform(el.getAttribute('transform'))) : M;
      if (tag === 'path') {
        parsePathSafe(el.getAttribute('d') || '').forEach(function (sub) { emit(mapSub(sub, m), clip); });
        return;
      }
      if (tag === 'rect') {
        var x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0, w = +el.getAttribute('width'), h = +el.getAttribute('height');
        emit(mapSub([{ t: 'M', x: x, y: y }, { t: 'L', x: x + w, y: y }, { t: 'L', x: x + w, y: y + h }, { t: 'L', x: x, y: y + h }, { t: 'Z' }], m), clip);
        return;
      }
      if (tag === 'svg') {   // fereastră imbricată (bare întinse, săgeți, acolade): se decupează la dimensiunea ei
        var nx = +el.getAttribute('x') || 0, ny = +el.getAttribute('y') || 0, nw = +el.getAttribute('width'), nh = +el.getAttribute('height');
        var v = (el.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number), cm = m, nclip = clip;
        var a = mpt(m, nx, ny), b = mpt(m, nx + nw, ny + nh);
        nclip = inter(clip, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
        if (v.length === 4 && v[2] && v[3]) {
          var sx = nw / v[2], sy = nh / v[3], s = Math.min(sx, sy);
          if (Math.abs(sx - sy) < 1e-6) cm = mmul(mmul(m, [1, 0, 0, 1, nx, ny]), mmul([sx, 0, 0, sy, 0, 0], [1, 0, 0, 1, -v[0], -v[1]]));
          else cm = mmul(mmul(m, [1, 0, 0, 1, nx + (nw - v[2] * s) / 2, ny + (nh - v[3] * s) / 2]), mmul([s, 0, 0, s, 0, 0], [1, 0, 0, 1, -v[0], -v[1]]));
        } else cm = mmul(m, [1, 0, 0, 1, nx, ny]);
        for (var c = el.firstElementChild; c; c = c.nextElementSibling) walk(c, cm, nclip);
        return;
      }
      for (var k = el.firstElementChild; k; k = k.nextElementSibling) walk(k, m, clip);
    }
    function parsePathSafe(d) { return d ? pathToSubs(d) : []; }
    for (var c = svg.firstElementChild; c; c = c.nextElementSibling) walk(c, base, null);
    return { d: out.join(' '), w: vb[2] * scale, h: vb[3] * scale };
  }

  /* ======================= LaTeX -> desen ======================= */
  var svgCache = new Map();
  function cleanLatex(s) {
    s = String(s || '');
    var prev;
    do { prev = s; s = s.replace(/\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g, function (m, t) { return t && t.trim() ? t : '\\square'; }); } while (s !== prev);
    return s.trim();
  }
  function svgFor(latex) {
    if (svgCache.has(latex)) return svgCache.get(latex);
    var res = null;
    try {
      var node = global.MathJax.tex2svg(latex, { display: false });
      var svg = node.querySelector('svg');
      if (svg && !svg.querySelector('[data-mml-node="merror"]')) res = svg;
    } catch (e) { res = null; }
    if (svgCache.size > 300) svgCache.clear();
    svgCache.set(latex, res);
    return res;
  }
  // fs = mărimea literei în unitățile tablei; ox/oy = colțul stânga-sus al formulei pe tablă
  function toPath(latex, fs, ox, oy) {
    latex = cleanLatex(latex);
    if (!latex) return null;
    var svg = svgFor(latex);
    if (!svg) return { err: 'syntax' };
    try {
      var r = svgToPath(svg, fs / 1000, ox || 0, oy || 0);
      if (!r.d) return null;
      r.latex = latex;
      return r;
    } catch (e) { return { err: String(e && e.message || '').indexOf('unsupported') === 0 ? 'char' : 'syntax' }; }
  }
  // etichete pentru taste: același desen, ca SVG în pagină
  var labelCache = new Map();
  function labelSVG(tex) {
    if (labelCache.has(tex)) return labelCache.get(tex);
    var html = '';
    try {
      var node = global.MathJax.tex2svg(tex, { display: false }), s = node.querySelector('svg');
      if (s && !s.querySelector('[data-mml-node="merror"]') && !s.querySelector('text')) { s.removeAttribute('style'); s.setAttribute('aria-hidden', 'true'); html = s.outerHTML; }
    } catch (e) {}
    labelCache.set(tex, html);
    return html;
  }

  /* ======================= tastatura ======================= */
  var PH = '\\square';
  function T(tex, ins, tip, o) { var k = { tex: tex, ins: ins == null ? tex : ins, tip: tip || '' }; if (o) for (var p in o) k[p] = o[p]; return k; }    // cheie cu etichetă LaTeX
  function Y(ch, tip, o) { var k = { txt: ch, type: ch, tip: tip || '' }; if (o) for (var p in o) k[p] = o[p]; return k; }                       // se "tastează" caracterul (reguli de MathLive)
  function C(label, cmd, tip, o) { var k = { txt: label, cmd: cmd, tip: tip || '' }; if (o) for (var p in o) k[p] = o[p]; return k; }
  function X(txt, ins, tip, o) { var k = { txt: txt, ins: ins, tip: tip || '' }; if (o) for (var p in o) k[p] = o[p]; return k; }              // cheie cu etichetă text
  function Z(tex, ch, tip, o) { return Y(ch, tip, Object.assign({ tex: tex }, o || {})); }                                                           // se tastează ch, dar eticheta e desenată
  function D(n) { return Y(String(n), '', { cls: 'num' }); }
  var BACK = C('⌫', 'deleteBackward', 'Șterge', { rep: 1, cls: 'ctl', w: 1.4, ico: 'back' });
  var LEFT = C('←', 'moveToPreviousChar', 'Stânga', { rep: 1, cls: 'ctl', ico: 'left' });
  var RIGHT = C('→', 'moveToNextChar', 'Dreapta', { rep: 1, cls: 'ctl', ico: 'right' });
  var NAVROW = [Z('(', '(', 'Paranteză deschisă'), Z(')', ')', 'Paranteză închisă'), LEFT, RIGHT, BACK, C('Golește', 'clearAll', 'Șterge tot', { cls: 'ctl txt', w: 1.5 })];
  function pair(open, close, tip) { return T(open + ' ' + close, '\\left' + open + '#@\\right' + close, tip); }

  function latinRows(up) {
    function row(s) { return s.split('').map(function (ch) { var c = up ? ch.toUpperCase() : ch; return Y(c, '', { cls: 'let' }); }); }
    return [row('qwertyuiop'), row('asdfghjkl').concat([Y("'", 'Prim')]), [C('⇧', 'shift', 'Litere mari', { cls: 'ctl' + (up ? ' on' : ''), w: 1.4, ico: 'shift' })].concat(row('zxcvbnm')).concat([Y(',', 'Virgulă'), Y('.', 'Punct')])];
  }
  function greekRows(up) {
    var lo = ['\\alpha', '\\beta', '\\gamma', '\\delta', '\\varepsilon', '\\zeta', '\\eta', '\\theta', '\\iota', '\\kappa', '\\lambda', '\\mu', '\\nu', '\\xi', '\\pi', '\\rho', '\\sigma', '\\tau', '\\upsilon', '\\varphi', '\\chi', '\\psi', '\\omega'];
    var hi = ['\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Xi', '\\Pi', '\\Sigma', '\\Upsilon', '\\Phi', '\\Psi', '\\Omega'];
    var list = (up ? hi : lo).map(function (g) { return T(g, g, '', { cls: 'gk' }); });
    var rows = [], per = up ? 6 : 8;
    for (var i = 0; i < list.length; i += per) rows.push(list.slice(i, i + per));
    rows.push([C('⇧', 'shiftGreek', 'Litere mari', { cls: 'ctl' + (up ? ' on' : ''), w: 1.4, ico: 'shift' }), T('\\vartheta', '\\vartheta', '', { cls: 'gk' }), T('\\varrho', '\\varrho', '', { cls: 'gk' }), T('\\varsigma', '\\varsigma', '', { cls: 'gk' }), T('\\partial', '\\partial', 'Derivată parțială', { cls: 'gk' }), T('\\nabla', '\\nabla', '', { cls: 'gk' })]);
    return rows;
  }

  var TABS = [
    { id: 'num', name: '123', tip: 'Numere și structuri', rows: function () { return [
      [T('\\frac{\\square}{\\square}', '\\frac{#@}{#?}', 'Fracție', { cls: 'st' }), T('\\sqrt{\\square}', '\\sqrt{#0}', 'Radical', { cls: 'st' }), T('\\sqrt[\\square]{\\square}', '\\sqrt[#?]{#0}', 'Radical de ordin n', { cls: 'st' }), T('\\left|\\square\\right|', '\\left|#@\\right|', 'Modul', { cls: 'st' }),
        D(7), D(8), D(9), Z('\\div', '÷', 'Împărțit', { cmdIns: '\\div' }), Z(':', ':', 'Împărțit cu două puncte'), T('\\cdot', '\\cdot', 'Înmulțit cu punct')],
      [T('\\square^{2}', '^{2}', 'Pătrat', { cls: 'st' }), T('\\square^{\\square}', '#@^{#?}', 'Putere', { cls: 'st' }), T('\\square_{\\square}', '#@_{#?}', 'Indice', { cls: 'st' }), T('\\left(\\square\\right)', '\\left(#@\\right)', 'Paranteze mari', { cls: 'st' }),
        D(4), D(5), D(6), T('\\times', '\\times', 'Înmulțit'), Z('+', '+', 'Plus'), Z('-', '-', 'Minus')],
      [T('\\pi', '\\pi', 'Pi'), T('e', 'e', 'Numărul e'), T('\\infty', '\\infty', 'Infinit'), T('^{\\circ}', '^{\\circ}', 'Grad'),
        D(1), D(2), D(3), Z('=', '=', 'Egal'), Z('<', '<', 'Mai mic'), Z('>', '>', 'Mai mare')],
      [Y('x', '', { cls: 'let' }), Y('y', '', { cls: 'let' }), Y('z', '', { cls: 'let' }), T('\\%', '\\%', 'Procent'),
        D(0), Z(',', ',', 'Virgulă zecimală'), Z('.', '.', 'Punct'), T('\\le', '\\le', 'Mai mic sau egal'), T('\\ge', '\\ge', 'Mai mare sau egal'), T('\\ne', '\\ne', 'Diferit')],
      NAVROW]; } },
    { id: 'fn', name: 'f(x)', tip: 'Logaritmi și trigonometrie', rows: function () { return [
      [T('\\log_{\\square}\\left(\\square\\right)', '\\log_{#?}\\left(#?\\right)', 'Logaritm cu baza la alegere', { w: 2.4, cls: 'st' }), T('\\ln\\left(\\square\\right)', '\\ln\\left(#?\\right)', 'Logaritm natural', { w: 1.8, cls: 'st' }), T('\\lg\\left(\\square\\right)', '\\lg\\left(#?\\right)', 'Logaritm zecimal', { w: 1.8, cls: 'st' })],
      [T('e^{\\square}', 'e^{#?}', 'e la putere', { cls: 'st' }), T('10^{\\square}', '10^{#?}', '10 la putere', { cls: 'st' }), T('a^{\\square}', 'a^{#?}', 'a la putere', { cls: 'st' }), T('\\log_{\\square}', '\\log_{#?}', 'Doar log cu bază'), T('\\log', '\\log', 'log'), T('\\ln', '\\ln', 'ln'), T('\\lg', '\\lg', 'lg')],
      [T('\\sin\\left(\\square\\right)', '\\sin\\left(#?\\right)', 'Sinus', { w: 1.5 }), T('\\cos\\left(\\square\\right)', '\\cos\\left(#?\\right)', 'Cosinus', { w: 1.5 }), T('\\operatorname{tg}\\left(\\square\\right)', '\\operatorname{tg}\\left(#?\\right)', 'Tangentă', { w: 1.5 }), T('\\operatorname{ctg}\\left(\\square\\right)', '\\operatorname{ctg}\\left(#?\\right)', 'Cotangentă', { w: 1.5 })],
      [T('\\arcsin\\left(\\square\\right)', '\\arcsin\\left(#?\\right)', 'Arcsinus', { w: 1.5 }), T('\\arccos\\left(\\square\\right)', '\\arccos\\left(#?\\right)', 'Arccosinus', { w: 1.5 }), T('\\operatorname{arctg}\\left(\\square\\right)', '\\operatorname{arctg}\\left(#?\\right)', 'Arctangentă', { w: 1.5 }), T('\\operatorname{arcctg}\\left(\\square\\right)', '\\operatorname{arcctg}\\left(#?\\right)', 'Arccotangentă', { w: 1.5 })],
      NAVROW]; } },
    { id: 'an', tall: 1, name: '∑∫', tip: 'Limite, sume, integrale, combinatorică', rows: function () { return [
      [T('\\lim_{\\square\\to\\square}', '\\lim_{#?\\to #?}', 'Limită', { w: 1.6, cls: 'st' }), T('\\sum_{\\square}^{\\square}', '\\sum_{#?}^{#?}', 'Sumă', { cls: 'st' }), T('\\prod_{\\square}^{\\square}', '\\prod_{#?}^{#?}', 'Produs', { cls: 'st' }), T('\\int', '\\int', 'Integrală'), T('\\int_{\\square}^{\\square}', '\\int_{#?}^{#?}', 'Integrală definită', { cls: 'st' })],
      [T('f\\left(x\\right)', 'f\\left(x\\right)', 'f(x)', { w: 1.3 }), T("f'", "f'", 'f prim'), T("f''", "f''", 'f secund'), T('\\frac{d}{dx}', '\\frac{d}{dx}', 'Derivată'), T('dx', 'dx', 'dx'), T('\\Delta', '\\Delta', 'Delta'), T('x\\to', 'x\\to ', 'x tinde la')],
      [T('n!', '!', 'Factorial'), T('C_{\\square}^{\\square}', 'C_{#?}^{#?}', 'Combinări', { cls: 'st' }), T('A_{\\square}^{\\square}', 'A_{#?}^{#?}', 'Aranjamente', { cls: 'st' }), T('P_{\\square}', 'P_{#?}', 'Permutări', { cls: 'st' }), T('\\binom{\\square}{\\square}', '\\binom{#?}{#?}', 'Coeficient binomial', { cls: 'st' })],
      [T('\\left[\\square\\right]', '\\left[#@\\right]', 'Partea întreagă'), T('\\left\\{\\square\\right\\}', '\\left\\{#@\\right\\}', 'Partea fracționară'), T('\\lfloor\\square\\rfloor', '\\left\\lfloor#@\\right\\rfloor', 'Parte întreagă (jos)'), T('\\lceil\\square\\rceil', '\\left\\lceil#@\\right\\rceil', 'Parte întreagă (sus)'), T('\\bmod', '\\bmod ', 'Rest la împărțire'), X('cmmdc', '\\operatorname{cmmdc}\\left(#?\\right)', 'Cel mai mare divizor comun', { cls: 'let' }), X('cmmmc', '\\operatorname{cmmmc}\\left(#?\\right)', 'Cel mai mic multiplu comun', { cls: 'let' })],
      NAVROW]; } },
    { id: 'abc', name: 'abc', tip: 'Litere', shift: true, rows: function (st) { return latinRows(st.shift).concat([NAVROW]); } },
    { id: 'gr', name: 'αβγ', tip: 'Litere grecești', shiftGreek: true, rows: function (st) { return greekRows(st.shiftGreek).concat([NAVROW]); } },
    { id: 'sy', name: '≤∈', tip: 'Relații, mulțimi, logică', rows: function () { return [
      ['\\ne', '\\approx', '\\equiv', '\\sim', '\\cong', '\\pm', '\\mp', '\\propto'].map(function (s) { return T(s, s); }),
      ['\\in', '\\notin', '\\subset', '\\subseteq', '\\cup', '\\cap', '\\emptyset', '\\setminus'].map(function (s) { return T(s, s); }),
      [T('\\mathbb{N}', '\\mathbb{N}', 'Numere naturale'), T('\\mathbb{Z}', '\\mathbb{Z}', 'Numere întregi'), T('\\mathbb{Q}', '\\mathbb{Q}', 'Numere raționale'), T('\\mathbb{R}', '\\mathbb{R}', 'Numere reale'), T('\\mathbb{C}', '\\mathbb{C}', 'Numere complexe'), T('\\forall', '\\forall'), T('\\exists', '\\exists'), T('\\therefore', '\\therefore')],
      ['\\Rightarrow', '\\Leftrightarrow', '\\Leftarrow', '\\rightarrow', '\\leftrightarrow', '\\mapsto', '\\wedge', '\\vee'].map(function (s) { return T(s, s); }),
      ['\\neg', '\\mid', '\\nmid', '\\ll', '\\gg', '\\cdots', '\\ldots', '\\prime'].map(function (s) { return T(s, s); }),
      NAVROW]; } },
    { id: 'ge', tall: 2, name: '∠△', tip: 'Geometrie și intervale', rows: function () { return [
      [T('\\angle', '\\angle ', 'Unghi'), T('\\triangle', '\\triangle ', 'Triunghi'), T('\\perp', '\\perp', 'Perpendiculare'), T('\\parallel', '\\parallel', 'Paralele'), T('\\circ', '^{\\circ}', 'Grad'), T('^{\\prime}', "'", 'Minut'), T('^{\\prime\\prime}', "''", 'Secundă'), T('\\sim', '\\sim', 'Asemenea')],
      [T('\\overline{AB}', '\\overline{#@}', 'Segment', { w: 1.3 }), T('\\overrightarrow{AB}', '\\overrightarrow{#@}', 'Semidreaptă', { w: 1.3 }), T('\\vec{v}', '\\vec{#@}', 'Vector', { w: 1.3 }), T('\\widehat{ABC}', '\\widehat{#@}', 'Unghiul ABC', { w: 1.3 }), T('\\overset{\\frown}{AB}', '\\overset{\\frown}{#@}', 'Arc de cerc', { w: 1.3 })],
      [T('\\left]\\square,\\square\\right[', '\\left]#?,#?\\right[', 'Interval deschis ]a, b[', { w: 1.5 }), T('\\left[\\square,\\square\\right]', '\\left[#?,#?\\right]', 'Interval închis [a, b]', { w: 1.5 }), T('\\left[\\square,\\square\\right[', '\\left[#?,#?\\right[', 'Interval [a, b[', { w: 1.5 }), T('\\left]\\square,\\square\\right]', '\\left]#?,#?\\right]', 'Interval ]a, b]', { w: 1.5 })],
      [T('\\left(\\square,\\square\\right)', '\\left(#?,#?\\right)', 'Pereche (a, b)', { w: 1.4 }), T('\\left\\{\\square\\right\\}', '\\left\\{#?\\right\\}', 'Mulțime { }', { w: 1.2 }), T('\\left\\|\\square\\right\\|', '\\left\\|#@\\right\\|', 'Normă', { w: 1.2 }), T('\\mathbb{R}\\setminus\\{\\square\\}', '\\mathbb{R}\\setminus\\left\\{#?\\right\\}', 'R fără o mulțime', { w: 1.8 })],
      NAVROW]; } },
    { id: 'sys', tall: 3, name: '{▦}', tip: 'Sisteme, cazuri, matrice', rows: function () { return [
      [T('\\left\\{\\begin{array}{l}\\square\\\\\\square\\end{array}\\right.', '\\left\\{\\begin{array}{l}#?\\\\#?\\end{array}\\right.', 'Sistem cu 2 ecuații', { w: 1.6, cls: 'st' }), T('\\left\\{\\begin{array}{l}\\square\\\\\\square\\\\\\square\\end{array}\\right.', '\\left\\{\\begin{array}{l}#?\\\\#?\\\\#?\\end{array}\\right.', 'Sistem cu 3 ecuații', { w: 1.6, cls: 'st' }),
        T('\\begin{cases}\\square&\\square\\\\\\square&\\square\\end{cases}', '\\begin{cases}#?&#?\\\\#?&#?\\end{cases}', 'Funcție pe ramuri (2 cazuri)', { w: 1.8, cls: 'st' })],
      [T('\\begin{pmatrix}\\square&\\square\\\\\\square&\\square\\end{pmatrix}', '\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}', 'Matrice 2×2', { w: 1.6, cls: 'st' }), T('\\begin{vmatrix}\\square&\\square\\\\\\square&\\square\\end{vmatrix}', '\\begin{vmatrix}#?&#?\\\\#?&#?\\end{vmatrix}', 'Determinant 2×2', { w: 1.6, cls: 'st' }),
        T('\\begin{pmatrix}\\square\\\\\\square\\end{pmatrix}', '\\begin{pmatrix}#?\\\\#?\\end{pmatrix}', 'Vector coloană', { w: 1.2, cls: 'st' })],
      [T('\\begin{pmatrix}\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\end{pmatrix}', '\\begin{pmatrix}#?&#?&#?\\\\#?&#?&#?\\\\#?&#?&#?\\end{pmatrix}', 'Matrice 3×3', { w: 1.6, cls: 'st' }), T('\\begin{vmatrix}\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\end{vmatrix}', '\\begin{vmatrix}#?&#?&#?\\\\#?&#?&#?\\\\#?&#?&#?\\end{vmatrix}', 'Determinant 3×3', { w: 1.6, cls: 'st' })],
      [C('+ linie', 'addRowAfter', 'Adaugă o linie', { cls: 'ctl txt', w: 1.3 }), C('+ coloană', 'addColumnAfter', 'Adaugă o coloană', { cls: 'ctl txt', w: 1.3 }), C('− linie', 'removeRow', 'Șterge linia', { cls: 'ctl txt', w: 1.3 }), C('− coloană', 'removeColumn', 'Șterge coloana', { cls: 'ctl txt', w: 1.3 })],
      NAVROW]; } }
  ];

  var ICONS = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 5H9l-6 7 6 7h11z"/><path d="m13 9 5 6m0-6-5 6"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    shift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 4 13h4.5v6h7v-6H20z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 9 7 7 7-7"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 15 7-7 7 7"/></svg>',
    kbd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
  };
  var TOOL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 5H7l6 7-6 7h10"/></svg>';

  /* ======================= editorul ======================= */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function Editor(wb, opts) {
    this.wb = wb; this.o = opts || {};
    this.fs = this.o.fs || Math.round(Math.max(12, Math.min(80, 40 / wb._scale)));   // about 40 screen px tall at any zoom
    this.color = this.o.color || wb._color || '#1a1a1a';
    this.latex = '';
    this.res = null;
    this.state = { shift: false, shiftGreek: false };
    this.tab = 'num';
    this.center = this.o.center || null;
    this.moved = !!this.o.center;
    this.closed = false;
    this._build();
  }
  Editor.prototype._build = function () {
    var self = this, wb = this.wb;
    var dock = this.dock = el('div', 'wbm');
    dock.setAttribute('role', 'dialog'); dock.setAttribute('aria-label', 'Editor de ecuații');
    dock.innerHTML =
      '<div class="wbm__bar">' +
        '<button type="button" class="wbm__btn wbm__x" title="Închide (Esc)" aria-label="Închide">' + ICONS.x + '</button>' +
        '<div class="wbm__fieldwrap"><math-field class="wbm__field" aria-label="Formula"></math-field><span class="wbm__empty">Alege o structură de jos sau scrie…</span></div>' +
        '<button type="button" class="wbm__btn wbm__fold" title="Ascunde tastatura" aria-label="Ascunde tastatura">' + ICONS.down + '</button>' +
        '<button type="button" class="wbm__go" disabled>' + ICONS.ok + '<span>Pune pe tablă</span></button>' +
      '</div>' +
      '<div class="wbm__body">' +
        '<div class="wbm__hint" role="status"><span class="wbm__msg"></span><span class="wbm__size"><button type="button" class="wbm__sz" data-d="-1" title="Mai mică" aria-label="Mai mică">A−</button><button type="button" class="wbm__sz" data-d="1" title="Mai mare" aria-label="Mai mare">A+</button></span></div>' +
        '<div class="wbm__tabs" role="tablist"></div>' +
        '<div class="wbm__keys"></div>' +
      '</div>';
    wb._canvasWrap.appendChild(dock);
    this.bar = dock.querySelector('.wbm__bar');
    this.mf = dock.querySelector('.wbm__field');
    this.goBtn = dock.querySelector('.wbm__go');
    this.msg = dock.querySelector('.wbm__msg');
    this.tabsEl = dock.querySelector('.wbm__tabs');
    this.keysEl = dock.querySelector('.wbm__keys');
    this.emptyEl = dock.querySelector('.wbm__empty');
    this._configField();
    this._tabs();
    this._keys();

    dock.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    dock.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
    dock.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); self.close(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); self.commit(); }
    });
    dock.querySelector('.wbm__x').addEventListener('click', function () { self.close(); });
    dock.querySelector('.wbm__fold').addEventListener('click', function () { self.fold(!dock.classList.contains('is-fold')); });
    this.goBtn.addEventListener('click', function () { self.commit(); });
    dock.querySelector('.wbm__size').addEventListener('click', function (e) {
      var b = e.target.closest('.wbm__sz'); if (!b) return;
      self.fs = Math.max(8, Math.min(140, self.fs * (b.dataset.d === '1' ? 1.18 : 0.85)));
      self._render();
    });
    // un clic pe casetă desface tastatura ascunsă
    this.mf.addEventListener('focusin', function () { if (dock.classList.contains('is-fold') && self._unfoldOnFocus) self.fold(false); });
    requestAnimationFrame(function () { dock.classList.add('on'); });
    this._ghostMake();
    this._render();
    var self2 = this;
    setTimeout(function () { if (!self2.closed) { try { self2.mf.focus({ preventScroll: true }); } catch (e) { self2.mf.focus(); } } }, 60);
  };

  Editor.prototype._configField = function () {
    var mf = this.mf, self = this;
    mf.setAttribute('inputmode', 'none');
    try {
      mf.mathVirtualKeyboardPolicy = 'manual';
      mf.menuItems = [];
      mf.smartMode = false;
      mf.letterShapeStyle = 'tex';
      mf.popoverPolicy = 'off';
      var sc = Object.assign({}, mf.inlineShortcuts || {});
      sc.tg = '\\operatorname{tg}'; sc.ctg = '\\operatorname{ctg}'; sc.arctg = '\\operatorname{arctg}'; sc.arcctg = '\\operatorname{arcctg}'; sc.lg = '\\lg';
      sc.cmmdc = '\\operatorname{cmmdc}'; sc.cmmmc = '\\operatorname{cmmmc}';
      mf.inlineShortcuts = sc;
    } catch (e) {}
    if (this.o.latex) mf.setValue(this.o.latex);
    mf.addEventListener('input', function () { self._onInput(); });
    mf.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { /* Enter lasă MathLive să treacă la linia următoare în matrice */ } });
    this._onInput(true);
  };
  Editor.prototype._onInput = function (first) {
    var self = this;
    clearTimeout(this._t);
    this._t = setTimeout(function () { if (self.closed) return; self.latex = self.mf.getValue('latex'); self._render(); }, first ? 0 : 70);
    this.emptyEl.style.display = this.mf.getValue('latex') ? 'none' : '';
  };

  Editor.prototype._tabs = function () {
    var self = this;
    this.tabsEl.innerHTML = TABS.map(function (t) {
      return '<button type="button" class="wbm__tab' + (t.id === self.tab ? ' on' : '') + '" role="tab" data-tab="' + t.id + '" title="' + t.tip + '" aria-label="' + t.tip + '">' + t.name + '</button>';
    }).join('');
    this.tabsEl.onpointerdown = function (e) { e.preventDefault(); };
    this.tabsEl.onclick = function (e) {
      var b = e.target.closest('[data-tab]'); if (!b) return;
      self.tab = b.dataset.tab; self._tabs(); self._keys(); self._refocus();
    };
  };
  Editor.prototype._keys = function () {
    var self = this, tab = TABS.filter(function (t) { return t.id === self.tab; })[0];
    var rows = tab.rows(this.state);
    this.keysEl.dataset.tab = tab.id;
    this.keysEl.innerHTML = '';
    var keyMap = this._keyMap = [];
    rows.forEach(function (row, ri) {
      var r = el('div', 'wbm__row' + (tab.tall && ri < tab.tall ? ' is-tall' : ''));
      row.forEach(function (k) {
        var b = el('button', 'wbm__k' + (k.cls ? ' ' + k.cls.split(' ').map(function (c) { return 'k-' + c; }).join(' ') : ''));
        b.type = 'button'; b.tabIndex = -1;
        if (k.tip) { b.title = k.tip; b.setAttribute('aria-label', k.tip); }
        b.style.flex = (k.w || 1) + ' 1 0';
        if (k.ico) b.innerHTML = ICONS[k.ico];
        else if (k.tex) { var lab = labelSVG(k.tex); if (lab) b.innerHTML = lab; else b.textContent = k.txt || k.type || ''; }
        else b.textContent = k.txt;
        b.dataset.i = keyMap.length; keyMap.push(k);
        r.appendChild(b);
      });
      self.keysEl.appendChild(r);
    });
    this.keysEl.onpointerdown = function (e) {
      var b = e.target.closest('.wbm__k'); if (!b) return;
      e.preventDefault();
      var k = keyMap[+b.dataset.i]; if (!k) return;
      b.classList.add('is-down');
      var up = function () { b.classList.remove('is-down'); clearTimeout(self._rt); clearInterval(self._ri); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      self._press(k);
      if (k.rep) { self._rt = setTimeout(function () { self._ri = setInterval(function () { self._press(k); }, 65); }, 380); }
    };
    this.keysEl.onmousedown = function (e) { e.preventDefault(); };   // caseta nu pierde cursorul
  };

  Editor.prototype._press = function (k) {
    var mf = this.mf;
    if (k.cmd === 'shift') { this.state.shift = !this.state.shift; this._keys(); return; }
    if (k.cmd === 'shiftGreek') { this.state.shiftGreek = !this.state.shiftGreek; this._keys(); return; }
    if (k.cmd === 'clearAll') { mf.setValue(''); this._onInput(); this._refocus(); return; }
    this._refocus();
    try {
      if (k.cmd) mf.executeCommand(k.cmd);
      else if (k.type) {
        if (k.cmdIns) mf.insert(k.cmdIns, { format: 'latex', focus: true, feedback: false });
        else mf.executeCommand(['typedText', k.type, { focus: true, feedback: false, simulateKeystroke: true }]);
      } else if (k.ins) mf.insert(k.ins, { format: 'latex', selectionMode: 'placeholder', focus: true, feedback: false, scrollIntoView: true });
    } catch (e) { try { mf.insert(k.ins || k.type || '', { format: 'latex', focus: true }); } catch (e2) {} }
    this._onInput();
  };
  Editor.prototype._refocus = function () { try { this.mf.focus({ preventScroll: true }); } catch (e) { this.mf.focus(); } };
  Editor.prototype.fold = function (on) {
    this.dock.classList.toggle('is-fold', on);
    var b = this.dock.querySelector('.wbm__fold');
    b.innerHTML = on ? ICONS.up : ICONS.down; b.title = on ? 'Arată tastatura' : 'Ascunde tastatura';
    this._unfoldOnFocus = on;
    this.wb._syncViewport && this.reposition();
  };

  /* ---- desenul formulei pe tablă (fantomă mutabilă) ---- */
  Editor.prototype._ghostMake = function () {
    var self = this, g = this.ghost = el('div', 'wbm-ghost');
    g.innerHTML = '<svg xmlns="' + NS + '" preserveAspectRatio="none"><path fill-rule="nonzero"/></svg><i class="wbm-ghost__tag">trage ca să muți</i>';
    g.style.display = 'none';
    this.wb._canvasWrap.appendChild(g);
    this.gpath = g.querySelector('path'); this.gsvg = g.querySelector('svg');
    var drag = null;
    g.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      drag = { x: e.clientX, y: e.clientY, cx: self.center.x, cy: self.center.y }; g.setPointerCapture(e.pointerId); g.classList.add('is-drag');
    });
    g.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var s = self.wb._scale;
      self.center = { x: drag.cx + (e.clientX - drag.x) / s, y: drag.cy + (e.clientY - drag.y) / s };
      self.moved = true; self.reposition();
    });
    var end = function () { drag = null; g.classList.remove('is-drag'); };
    g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
  };
  Editor.prototype._defaultCenter = function () {
    var wb = this.wb, wrapH = wb._canvasWrap.clientHeight, wrapW = wb._canvasWrap.clientWidth;
    var dockTop = this.dock.offsetTop;
    var visH = Math.max(80, Math.min(wrapH, dockTop > 0 ? dockTop : wrapH));
    return { x: (wrapW / 2 - wb._panX) / wb._scale, y: (visH / 2 - wb._panY) / wb._scale };
  };
  Editor.prototype._render = function () {
    var res = this.res = this.latex ? toPath(this.latex, this.fs, 0, 0) : null;
    var ok = !!(res && res.d);
    this.goBtn.disabled = !ok;
    var m = this.msg;
    if (res && res.err === 'syntax') m.textContent = 'Formula nu poate fi desenată încă. Verifică parantezele și casetele.';
    else if (res && res.err === 'char') m.textContent = 'Un caracter nu există în formule (de exemplu litere cu diacritice). Pentru cuvinte folosește unealta Text.';
    else if (ok && /\\square/.test(res.latex) && /\\square/.test(cleanLatex(this.latex)) && /placeholder/.test(this.latex)) m.textContent = 'Casetele goale se vor vedea ca pătrate pe tablă.';
    else m.textContent = this.o.replaceId ? 'Modifici formula de pe tablă.' : '';
    m.classList.toggle('is-err', !!(res && res.err));
    if (!ok) { this.ghost.style.display = 'none'; return; }
    if (!this.center) this.center = this._defaultCenter();
    this.gpath.setAttribute('d', res.d);
    this.gpath.setAttribute('fill', this.color);
    this.gsvg.setAttribute('viewBox', '0 0 ' + res.w + ' ' + res.h);
    this.ghost.style.display = '';
    this.reposition();
  };
  Editor.prototype.reposition = function () {
    if (this.closed) return;
    if (!this.moved && this.center) this.center = this._defaultCenter();
    if (!this.res || !this.res.d || !this.center) return;
    var wb = this.wb, s = wb._scale, w = this.res.w * s, h = this.res.h * s, g = this.ghost.style;
    g.left = (wb._panX + this.center.x * s - w / 2) + 'px';
    g.top = (wb._panY + this.center.y * s - h / 2) + 'px';
    g.width = w + 'px'; g.height = h + 'px';
  };

  Editor.prototype.commit = function () {
    if (this.closed || !this.res || !this.res.d) return;
    var info = { latex: this.res.latex, fs: this.fs, cx: this.center.x, cy: this.center.y, replaceId: this.o.replaceId || null, color: this.color };
    this.close(true);
    this.wb._mathCommit(info);
  };
  Editor.prototype.close = function (committed) {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this._t); clearTimeout(this._rt); clearInterval(this._ri);
    var dock = this.dock, ghost = this.ghost;
    dock.classList.remove('on');
    setTimeout(function () { if (dock.parentNode) dock.parentNode.removeChild(dock); }, 200);
    if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    if (this.wb._math === this) this.wb._math = null;
    if (this.wb._mathClosed) this.wb._mathClosed(!!committed);
  };

  /* ======================= API ======================= */
  var WBMath = {
    ready: load,
    toPath: toPath,
    // pornește editorul pe tabla wb: opts = { latex, fs, center:{x,y}, replaceId, color }
    open: function (wb, opts) {
      if (wb._math) { try { wb._math.mf.focus(); } catch (e) {} return Promise.resolve(wb._math); }
      var pending = wb._mathPending = (wb._mathPending || 0) + 1;
      return load().then(function () {
        wb._mathPending = 0;
        if (wb._destroyed || wb._math) return wb._math;
        wb._math = new Editor(wb, opts);
        return wb._math;
      }, function (err) {
        wb._mathPending = 0;
        if (wb._mathClosed) wb._mathClosed(false);
        if (global.BM && BM.toast) BM.toast('Editorul de ecuații nu s-a putut încărca. Verifică conexiunea și încearcă din nou.', 'error');
        throw err;
      });
    },
    _tabs: TABS,
    ICON: TOOL_ICON
  };
  global.WBMath = WBMath;
})(window);
