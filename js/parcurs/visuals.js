/* ============================================================
   Parcurs: desenele interactive ale lecțiilor (bară de fracții, axa numerelor, mulțimi, împărțire, semne, salturi, arie, adunare în coloană).
   Fiecare funcție întoarce un element DOM și, unde e cazul, un mic API ({get(), set(), el}) pentru motorul lecțiilor.
   Se bazează pe window.PM (lib.js). Culorile vin din tokenurile --pm-* ale site-ului, deci merg în tema deschisă și în cea închisă.
   ============================================================ */
(function (root) {
  'use strict';
  var PM = root.PM;
  var NS = 'http://www.w3.org/2000/svg';
  var $m = function (s) { return PM.m(s); };

  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function s(tag, attrs, html) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.textContent = html;
    return e;
  }
  var neg = function (n) { return n < 0 ? '−' + Math.abs(n) : String(n); };

  /* ---------- bara de fracții: d părți egale, n colorate ----------
     interactive: atingerea unei părți colorează până la ea (bara din lecțiile „Învață”)
     toggle:      fiecare parte se aprinde sau se stinge singură (exercițiile de colorat) */
  function bar(o) {
    var wrap = h('div', 'pv-bar' + (o.small ? ' sm' : '')), d = o.d, on = [], i;
    for (i = 0; i < d; i++) on.push(i < (o.n || 0) ? 1 : 0);
    function count() { var k = 0; for (var q = 0; q < on.length; q++) k += on[q]; return k; }
    function draw(first) {
      wrap.innerHTML = '';
      for (var j = 0; j < d; j++) {
        var c = h(o.interactive || o.toggle ? 'button' : 'span', 'pc' + (on[j] ? ' on' : ''));
        if (o.interactive || o.toggle) { c.type = 'button'; c.setAttribute('aria-label', 'Partea ' + (j + 1) + ' din ' + d); c.setAttribute('aria-pressed', on[j] ? 'true' : 'false'); c.onclick = (function (jj) { return function () { tap(jj); }; })(j); }
        if (first) c.style.animationDelay = (j * 35) + 'ms'; else c.style.animation = 'none';
        wrap.appendChild(c);
      }
    }
    function tap(j) {
      if (o.toggle) on[j] = on[j] ? 0 : 1;
      else { var n0 = count(); var n1 = (j + 1 === n0) ? j : j + 1; on = []; for (var q = 0; q < d; q++) on.push(q < n1 ? 1 : 0); }
      draw(false); pop(wrap.children[j]);
      if (o.onchange) o.onchange(count(), d);
    }
    draw(true);
    return { el: wrap, get: count, d: function () { return d; },
      set: function (n, nd) { if (nd) d = nd; on = []; for (var q = 0; q < d; q++) on.push(q < n ? 1 : 0); draw(false); },
      lock: function (ok, target) {
        wrap.classList.add(ok ? 'ok' : 'no');
        Array.prototype.forEach.call(wrap.children, function (c, j) { c.disabled = true; if (!ok && target != null && j < target) c.classList.add('miss'); });
      } };
  }
  function pop(el) { if (!el || !el.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return; el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' }); }

  /* ---------- axa numerelor ---------- */
  var AW = 640, AH = 130, PAD = 34, LY = 74;
  function axisSvg(o) {
    var svg = s('svg', { viewBox: '0 0 ' + AW + ' ' + AH, class: 'pv-axis', role: 'img' });
    var min = o.min, max = o.max, sub = o.sub || 1, span = max - min, W = AW - 2 * PAD;
    var X = function (v) { return PAD + (v - min) / span * W; };
    svg.appendChild(s('line', { x1: PAD - 14, y1: LY, x2: AW - PAD + 14, y2: LY, class: 'ln' }));
    svg.appendChild(s('path', { d: 'M' + (AW - PAD + 6) + ' ' + (LY - 6) + 'L' + (AW - PAD + 16) + ' ' + LY + 'L' + (AW - PAD + 6) + ' ' + (LY + 6), class: 'ar' }));
    for (var i = min * sub; i <= max * sub; i++) {
      var v = i / sub, major = i % sub === 0, x = X(v);
      svg.appendChild(s('line', { x1: x, y1: LY - (major ? 11 : 6), x2: x, y2: LY + (major ? 11 : 6), class: major ? 'tk mj' : 'tk' }));
      if (major) svg.appendChild(s('text', { x: x, y: LY + 32, class: "tl", "text-anchor": "middle" }, neg(v)));
    }
    (o.pts || []).forEach(function (p) {
      var x = X(PM.val(p.v));
      var g = s('g', { class: 'pt' + (p.cls ? ' ' + p.cls : '') });
      g.appendChild(s('circle', { cx: x, cy: LY, r: 9, class: 'dot' }));
      if (p.l) g.appendChild(s('text', { x: x, y: LY - 20, class: 'pl', 'text-anchor': 'middle' }, p.l));
      svg.appendChild(g);
    });
    svg._X = X; svg._cfg = { min: min, max: max, sub: sub, W: W };
    return svg;
  }
  /* axă statică (pentru desenul unei întrebări) */
  function axis(o) { var w = h('div', 'pv-axis-wrap'); w.appendChild(axisSvg(o)); return { el: w }; }

  /* axă cu punct de mutat: trage sau folosește săgețile; se oprește pe diviziuni */
  function axisPick(o) {
    var wrap = h('div', 'pv-axis-wrap pick'), svg = axisSvg({ min: o.min, max: o.max, sub: o.sub, pts: o.start ? [{ v: o.start, l: 'start', cls: 'st' }] : [] });
    var sub = o.sub || 1, lo = o.min * sub, hi = o.max * sub, k = null, moved = false;
    var g = s('g', { class: 'mk', tabindex: '0', role: 'slider', 'aria-label': 'Punct de mutat pe axă', 'aria-valuemin': lo, 'aria-valuemax': hi });
    g.appendChild(s('circle', { cx: 0, cy: 0, r: 16, class: 'halo' }));
    g.appendChild(s('circle', { cx: 0, cy: 0, r: 11, class: 'dot' }));
    var lbl = s('text', { x: 0, y: -26, class: 'ml', 'text-anchor': 'middle' }, o.markLabel || '');
    g.appendChild(lbl);
    g.style.display = 'none';
    svg.appendChild(g);
    var readout = h('div', 'pv-read', ''); readout.hidden = !o.readout;
    function place(i, user) {
      i = Math.max(lo, Math.min(hi, i));
      k = i; moved = true;
      var x = svg._X(i / sub);
      g.style.display = '';
      g.setAttribute('transform', 'translate(' + x + ',' + LY + ')');
      g.setAttribute('aria-valuenow', i);
      if (o.readout) { var f = PM.F(i, sub); readout.hidden = false; readout.innerHTML = '<b>' + $m(PM.fmtF(f)) + '</b><span>' + $m(PM.fmtDec(f)) + '</span>'; }
      if (o.mirror) mirror(i);
      if (o.onchange) o.onchange(PM.F(i, sub), user);
    }
    var mir = null;
    function mirror(i) {
      if (!mir) { mir = s('g', { class: 'pt mir' }); mir.appendChild(s('circle', { cx: 0, cy: 0, r: 9, class: 'dot' })); mir.appendChild(s('text', { x: 0, y: -20, class: 'pl', 'text-anchor': 'middle' }, 'opusul')); svg.appendChild(mir); }
      var m = -i; if (m < lo || m > hi) { mir.style.display = 'none'; return; }
      mir.style.display = ''; mir.setAttribute('transform', 'translate(' + svg._X(m / sub) + ',' + LY + ')');
    }
    function fromEvent(ev) {
      var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * AW;
      var v = min_((x - PAD) / svg._cfg.W * (o.max - o.min) + o.min);
      return Math.round(v * sub);
    }
    function min_(v) { return v; }
    var drag = false;
    svg.addEventListener('pointerdown', function (ev) { drag = true; try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ } place(fromEvent(ev), true); g.focus({ preventScroll: true }); ev.preventDefault(); });
    svg.addEventListener('pointermove', function (ev) { if (drag) place(fromEvent(ev), true); });
    svg.addEventListener('pointerup', function () { drag = false; });
    svg.addEventListener('pointercancel', function () { drag = false; });
    g.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { place((k == null ? Math.round((lo + hi) / 2) : k) - 1, true); ev.preventDefault(); }
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { place((k == null ? Math.round((lo + hi) / 2) : k) + 1, true); ev.preventDefault(); }
    });
    wrap.appendChild(svg); wrap.appendChild(readout);
    if (o.hint !== false && !o.tapHint) { var th = h('div', 'pv-tap', 'Atinge sau trage pe axă'); wrap.appendChild(th); svg.addEventListener('pointerdown', function () { th.remove(); }, { once: true }); }
    return { el: wrap, svg: svg, get: function () { return k == null ? null : PM.F(k, sub); }, moved: function () { return moved; }, place: place,
      lock: function (ok, target) {
        svg.style.pointerEvents = 'none'; g.classList.add(ok ? 'ok' : 'no');
        if (!ok && target) { var x = svg._X(PM.val(target)); var t = s('g', { class: 'pt tg', transform: 'translate(' + x + ',' + LY + ')' }); t.appendChild(s('circle', { cx: 0, cy: 0, r: 11, class: 'dot' })); svg.appendChild(t); }
      } };
  }

  /* ---------- mulțimile ℕ ⊂ ℤ ⊂ ℚ ---------- */
  function sets(chips) {
    var wrap = h('div', 'pv-sets'), svg = s('svg', { viewBox: '0 0 420 230', class: 'pv-sets-svg', role: 'img', 'aria-label': 'Mulțimile N, Z și Q, una în alta' });
    var Q = s('ellipse', { cx: 210, cy: 115, rx: 200, ry: 108, class: 'set q' }), Z = s('ellipse', { cx: 210, cy: 125, rx: 135, ry: 78, class: 'set z' }), N = s('ellipse', { cx: 210, cy: 135, rx: 70, ry: 46, class: 'set n' });
    svg.appendChild(Q); svg.appendChild(Z); svg.appendChild(N);
    svg.appendChild(s('text', { x: 210, y: 26, class: 'sl', 'text-anchor': 'middle' }, 'ℚ'));
    svg.appendChild(s('text', { x: 210, y: 70, class: 'sl', 'text-anchor': 'middle' }, 'ℤ'));
    svg.appendChild(s('text', { x: 210, y: 140, class: 'sl', 'text-anchor': 'middle' }, 'ℕ'));
    var row = h('div', 'pv-chips'), say = h('div', 'pv-say', 'Atinge un număr.');
    (chips || []).forEach(function (c) {
      var b = h('button', 'pv-chip', $m(c)); b.type = 'button';
      b.onclick = function () {
        row.querySelectorAll('.pv-chip').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on');
        var p = PM.parseAnswer(PM.plain(c).replace('−', '-')), set = p && p.kind === 'int' ? (p.f.n >= 0 ? 'n' : 'z') : 'q';
        [N, Z, Q].forEach(function (e) { e.classList.remove('lit'); });
        (set === 'n' ? N : set === 'z' ? Z : Q).classList.add('lit');
        say.innerHTML = $m(c) + ' este număr ' + (set === 'n' ? '**natural**, deci și întreg, și rațional: ℕ ⊂ ℤ ⊂ ℚ.' : set === 'z' ? '**întreg**, nu natural. Este și rațional: ℤ ⊂ ℚ.' : '**rațional**, dar nu întreg. Se scrie ca fracție.');
        say.innerHTML = say.innerHTML.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
        pop(b);
      };
      row.appendChild(b);
    });
    wrap.appendChild(svg); wrap.appendChild(row); wrap.appendChild(say);
    return { el: wrap };
  }

  /* ---------- împărțirea care nu se termină: n : d, pas cu pas ---------- */
  function divSteps(n, d) {
    var wrap = h('div', 'pv-div'), res = h('div', 'pv-div-res'), list = h('div', 'pv-div-list'), btn = h('button', 'pv-more', 'Mai departe'); btn.type = 'button';
    var ip = Math.floor(n / d), r = n % d, seen = {}, digits = '', steps = [], i;
    steps.push({ t: '**' + n + ' : ' + d + ' = ' + ip + '**, rest ' + r, res: ip + ',…' });
    seen[r] = 0;
    for (i = 1; i <= 12; i++) {
      var x = r * 10, dg = Math.floor(x / d), nr = x % d;
      digits += dg;
      var st = { t: '**' + x + ' : ' + d + ' = ' + dg + '**, rest ' + nr, res: ip + ',' + digits + '…' };
      if (nr === 0) { st.end = 'fin'; st.res = ip + ',' + digits; steps.push(st); break; }
      if (seen[nr] !== undefined) { st.end = 'per'; st.t += '. [[Restul ' + nr + ' a mai apărut!]]'; st.pre = digits.slice(0, seen[nr]); st.per = digits.slice(seen[nr]); st.res = ip + ',' + st.pre + '(' + st.per + ')'; steps.push(st); break; }
      steps.push(st); seen[nr] = i; r = nr;
    }
    var k = 0;
    function more() {
      if (k >= steps.length) return;
      var st = steps[k++], row = h('div', 'pv-div-row' + (st.end === 'per' ? ' again' : ''), $m(st.t));
      list.appendChild(row); res.innerHTML = $m(st.res); pop(row);
      if (st.end) {
        res.classList.add('done'); btn.disabled = true; btn.textContent = st.end === 'per' ? 'Perioada s-a găsit' : 'Gata';
        wrap.appendChild(h('div', 'pv-div-note', $m(st.end === 'per' ? 'De aici cifrele se repetă la nesfârșit. Scriem **' + st.res + '**.' : 'Restul a ajuns 0: zecimala se termină.')));
      }
    }
    btn.onclick = more;
    wrap.appendChild(res); wrap.appendChild(list); wrap.appendChild(btn); more();
    return { el: wrap };
  }

  /* ---------- semnul produsului ---------- */
  function signs() {
    var a = 1, b = -1, wrap = h('div', 'pv-signs'), out = h('div', 'pv-sg-out');
    function pair(label, set) {
      var box = h('div', 'pv-sg-pair'), lb = h('span', 'pv-sg-lb', label), p = h('button', 'pv-sg-k', '+'), m = h('button', 'pv-sg-k', '−'); p.type = m.type = 'button';
      function paint(v) { p.classList.toggle('on', v > 0); m.classList.toggle('on', v < 0); }
      p.onclick = function () { set(1); paint(1); render(); pop(p); }; m.onclick = function () { set(-1); paint(-1); render(); pop(m); };
      box.appendChild(lb); box.appendChild(p); box.appendChild(m); return { el: box, paint: paint };
    }
    var A = pair('primul factor', function (v) { a = v; }), B = pair('al doilea factor', function (v) { b = v; });
    function render() {
      var r = a * b, sg = function (v) { return v > 0 ? '+' : '−'; };
      out.innerHTML = '<span class="e">(' + sg(a) + ') · (' + sg(b) + ')</span><span class="eq">=</span><b class="' + (r > 0 ? 'p' : 'm') + '">(' + sg(r) + ')</b><small>' + (a === b ? 'Semne la fel: plus.' : 'Semne diferite: minus.') + '</small>';
      var bb = out.querySelector('b'); if (bb) pop(bb);
    }
    A.paint(a); B.paint(b); render();
    wrap.appendChild(A.el); wrap.appendChild(B.el); wrap.appendChild(out);
    return { el: wrap };
  }

  /* ---------- salturi pe axă (adunarea cu numere cu semn) ---------- */
  function jump(o) {
    var wrap = h('div', 'pv-jump'), svg = axisSvg({ min: -8, max: 8, sub: 1, pts: [] }), cur = o.start, k = 0;
    var X = svg._X, mk = s('g', { class: 'mk fix', transform: 'translate(' + X(cur) + ',' + LY + ')' });
    mk.appendChild(s('circle', { cx: 0, cy: 0, r: 11, class: 'dot' })); svg.appendChild(mk);
    var txt = h('div', 'pv-jump-tx', '<div>' + $m('Pornim de la **' + neg(o.start) + '**.') + '</div>');
    var btn = h('button', 'pv-more', 'Mai departe'); btn.type = 'button';
    btn.onclick = function () {
      if (k >= o.moves.length) return;
      var mv = o.moves[k++], from = cur, to = cur + mv, x1 = X(from), x2 = X(to);
      var arc = s('path', { d: 'M' + x1 + ' ' + (LY - 12) + ' Q' + ((x1 + x2) / 2) + ' ' + (LY - 62) + ' ' + x2 + ' ' + (LY - 12), class: 'arc' + (mv < 0 ? ' back' : '') });
      svg.insertBefore(arc, mk);
      var len = arc.getTotalLength ? arc.getTotalLength() : 200; arc.style.strokeDasharray = len; arc.style.strokeDashoffset = len;
      requestAnimationFrame(function () { arc.style.transition = 'stroke-dashoffset .5s ease'; arc.style.strokeDashoffset = 0; });
      mk.style.transition = 'transform .5s cubic-bezier(.5,0,.2,1)'; mk.setAttribute('transform', 'translate(' + x2 + ',' + LY + ')');
      cur = to;
      var line = h('div', 'pv-jump-ln', $m(neg(from) + ' + ' + (mv < 0 ? '(' + neg(mv) + ')' : mv) + ' = **' + neg(to) + '**'));
      txt.appendChild(line);
      if (k >= o.moves.length) { btn.disabled = true; btn.textContent = 'Gata'; }
    };
    wrap.appendChild(svg); wrap.appendChild(txt); wrap.appendChild(btn);
    return { el: wrap };
  }

  /* ---------- modelul cu arie: a/b · c/d ---------- */
  function area(o) {
    var A = o.a, B = o.b, wrap = h('div', 'pv-area'), W = 240, H = 180, svg = s('svg', { viewBox: '0 0 ' + (W + 20) + ' ' + (H + 20), class: 'pv-area-svg', role: 'img', 'aria-label': 'Pătrat împărțit în coloane și rânduri' });
    var cw = W / A[1], ch = H / B[1], cells = [];
    for (var r = 0; r < B[1]; r++) for (var c = 0; c < A[1]; c++) {
      var rect = s('rect', { x: 10 + c * cw, y: 10 + r * ch, width: cw, height: ch, class: 'cell', rx: 3 });
      svg.appendChild(rect); cells.push({ el: rect, c: c, r: r });
    }
    var txt = h('div', 'pv-area-tx'), btn = h('button', 'pv-more', 'Mai departe'); btn.type = 'button';
    var step = 0;
    var msgs = [
      'Împărțim pătratul în **' + A[1] + ' coloane**. Coloreaza **' + A[0] + '** dintre ele: {' + A[0] + '/' + A[1] + '}.',
      'Împărțim și în **' + B[1] + ' rânduri**. Colorăm **' + B[0] + '** dintre ele: {' + B[0] + '/' + B[1] + '}.',
      'Pătrățelele colorate de **două ori** sunt **' + (A[0] * B[0]) + '** din **' + (A[1] * B[1]) + '**: {' + A[0] + '/' + A[1] + '} · {' + B[0] + '/' + B[1] + '} = {' + A[0] * B[0] + '/' + A[1] * B[1] + '} = ' + PM.fmtF(PM.F(A[0] * B[0], A[1] * B[1]))
    ];
    msgs[0] = msgs[0].replace('Coloreaza', 'Colorăm');
    function show() {
      txt.innerHTML = $m(msgs[Math.max(0, step - 1)] || 'Apasă „Mai departe”.');
      cells.forEach(function (x) {
        var colA = x.c < A[0] && step >= 1, rowB = x.r < B[0] && step >= 2;
        x.el.setAttribute('class', 'cell' + (colA ? ' a' : '') + (rowB ? ' b' : '') + (colA && rowB ? ' ab' : ''));
      });
    }
    btn.onclick = function () { if (step < 3) { step++; show(); if (step >= 3) { btn.disabled = true; btn.textContent = 'Gata'; } } };
    wrap.appendChild(svg); wrap.appendChild(txt); wrap.appendChild(btn);
    txt.innerHTML = $m('Apasă „Mai departe”.');
    return { el: wrap };
  }

  /* ---------- adunarea în coloană, virgulă sub virgulă ---------- */
  function col(o) {
    var A = o.a, B = o.b, wrap = h('div', 'pv-col');
    var ia = A.split(',')[0], da = (A.split(',')[1] || ''), ib = B.split(',')[0], db = (B.split(',')[1] || '');
    var il = Math.max(ia.length, ib.length), dl = Math.max(da.length, db.length);
    var fa = PM.parseAnswer(A).f, fb = PM.parseAnswer(B).f, r = o.op === '−' ? PM.sub(fa, fb) : PM.add(fa, fb), R = PM.fmtDec(r);
    var ir = R.split(',')[0], dr = (R.split(',')[1] || ''); il = Math.max(il, ir.length); dl = Math.max(dl, dr.length);
    function rowHTML(i, d, op, cls) {
      var cells = '', p;
      cells += '<span class="op">' + (op || '') + '</span>';
      for (p = il - i.length; p > 0; p--) cells += '<span class="dg pad"> </span>';
      for (p = 0; p < i.length; p++) cells += '<span class="dg">' + i[p] + '</span>';
      cells += '<span class="cm">,</span>';
      for (p = 0; p < dl; p++) cells += d[p] !== undefined ? '<span class="dg">' + d[p] + '</span>' : '<span class="dg zero">0</span>';
      return '<div class="row ' + (cls || '') + '">' + cells + '</div>';
    }
    wrap.innerHTML = rowHTML(ia, da, '', '') + rowHTML(ib, db, o.op, '') + '<div class="rule"></div>' + rowHTML(ir, dr, '', 'res');
    var res = wrap.querySelectorAll('.row.res .dg'); Array.prototype.slice.call(res).reverse().forEach(function (e, i) { e.style.animationDelay = (400 + i * 160) + 'ms'; });
    var note = h('div', 'pv-col-note', $m('Zerourile gri completează locurile libere: **3,45 + 12,60**.'));
    wrap.appendChild(note);
    return { el: wrap };
  }

  /* ---------- bare multiple, cu etichetă (aceeași parte, alte numere) ---------- */
  function bars(list) {
    var wrap = h('div', 'pv-bars');
    list.forEach(function (p, i) {
      var row = h('div', 'pv-bars-row'), lab = h('span', 'pv-bars-lab', $m('{' + p[1] + '/' + p[0] + '}')), b = bar({ d: p[0], n: p[1], small: true });
      row.style.animationDelay = (i * 160) + 'ms'; row.appendChild(lab); row.appendChild(b.el); wrap.appendChild(row);
    });
    return { el: wrap };
  }

  /* ---------- bară cu butoane de numărător și numitor ---------- */
  function barCtl(o) {
    var wrap = h('div', 'pv-barctl'), read = h('div', 'pv-read big'), b = null, n = o.n, d = o.d;
    var ctl = h('div', 'pv-ctls');
    function key(lbl, label, fn) { var k = h('button', 'pv-k', lbl); k.type = 'button'; k.setAttribute('aria-label', label); k.onclick = function () { fn(); pop(k); }; return k; }
    function sync() {
      read.innerHTML = '<span class="fr-big">' + $m('{' + n + '/' + d + '}') + '</span><span class="eq">=</span><span>' + $m(n + ' : ' + d) + '</span>' + (o.dec ? '<span class="eq">=</span><b>' + $m(PM.fmtDec(PM.F(n, d))) + '</b>' : '');
    }
    function rebuild() {
      var old = b && b.el; b = bar({ d: d, n: n, interactive: true, onchange: function (v) { n = v; sync(); } }); if (old) wrap.replaceChild(b.el, old); else wrap.insertBefore(b.el, ctl);
      sync();
    }
    ctl.appendChild(h('span', 'pv-k-lb', 'numărător'));
    ctl.appendChild(key('−', 'Scade numărătorul', function () { n = Math.max(0, n - 1); b.set(n); sync(); }));
    ctl.appendChild(key('+', 'Crește numărătorul', function () { n = Math.min(d, n + 1); b.set(n); sync(); }));
    if (!o.lockD) {
      ctl.appendChild(h('span', 'pv-k-lb', 'numitor'));
      ctl.appendChild(key('−', 'Scade numitorul', function () { d = Math.max(2, d - 1); n = Math.min(n, d); rebuild(); }));
      ctl.appendChild(key('+', 'Crește numitorul', function () { d = Math.min(12, d + 1); rebuild(); }));
    }
    wrap.appendChild(ctl); wrap.appendChild(read); rebuild();
    return { el: wrap };
  }

  root.PV = { bar: bar, axis: axis, axisPick: axisPick, sets: sets, divSteps: divSteps, signs: signs, jump: jump, area: area, col: col, bars: bars, barCtl: barCtl, pop: pop, h: h };
})(window);
