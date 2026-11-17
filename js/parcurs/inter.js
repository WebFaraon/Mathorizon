/* ============================================================
   Parcurs: exerciții interactive (încărcat după engine.js, care îi dă puntea window.PLZ).
   Copilul nu mai scrie o cifră: trage cardurile în cutii, le ordonează cu degetul, taie și colorează, mărește axa, caută restul care se repetă,
   umple cercuri cu bucăți. Fiecare tip întoarce același obiect ca celelalte din engine.js: {canCheck, isRight, mark, okEl, answerText?, extra?}.
   Tragerea merge cu mouse și cu degetul (pointer events); pentru cine nu poate trage, orice card se poate și atinge: atingi cardul, apoi locul lui.
   Specificațiile vin din gens3.js. Se bazează pe window.PM, window.PV și window.PLZ = { BUILD, phase(), setGo(on) }.
   ============================================================ */
(function () {
  'use strict';
  var PLZ = window.PLZ, PM = window.PM, PV = window.PV;
  if (!PLZ || !PM || !PV) return;
  var BUILD = PLZ.BUILD, m = PM.m, h = PV.h, pop = PV.pop;
  var reduce = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var answering = function () { return PLZ.phase() === 'answer'; };
  var fr = function (n, d) { return '{' + n + '/' + d + '}'; };

  function shuffleNot(n, isDone) {
    var ord, tries = 0;
    do { ord = []; for (var i = 0; i < n; i++) ord.push(i); for (var j = n - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)), t = ord[j]; ord[j] = ord[k]; ord[k] = t; } }
    while (n > 1 && isDone(ord) && tries++ < 20);
    return ord;
  }

  /* ---------- tragere cu mouse sau deget; o atingere scurtă = tap ----------
     o: {start(), move(x, y, elementSub), drop(elementSub, x, y), end(), tap()} */
  function drag(el, o) {
    el.classList.add('lz-drag');
    el.addEventListener('pointerdown', function (ev) {
      if (!answering() || (ev.button && ev.button !== 0)) return;
      var sx = ev.clientX, sy = ev.clientY, moved = false, ghost = null, id = ev.pointerId;
      var rect = el.getBoundingClientRect(), ox = sx - rect.left, oy = sy - rect.top;
      try { el.setPointerCapture(id); } catch (e) { /* ok */ }
      function move(e) {
        if (e.pointerId !== id) return;
        if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) {
          moved = true;
          ghost = el.cloneNode(true); ghost.removeAttribute('id'); ghost.classList.add('lz-ghost'); ghost.style.width = rect.width + 'px'; ghost.style.minHeight = rect.height + 'px';
          document.body.appendChild(ghost); el.classList.add('lifted');
          if (o.start) o.start();
        }
        if (moved) {
          ghost.style.transform = 'translate(' + (e.clientX - ox) + 'px,' + (e.clientY - oy) + 'px) scale(1.05)';
          if (o.move) o.move(e.clientX, e.clientY, document.elementFromPoint(e.clientX, e.clientY));
        }
      }
      function up(e) {
        if (e.pointerId !== id) return;
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        try { el.releasePointerCapture(id); } catch (x) { /* ok */ }
        if (moved) {
          var t = document.elementFromPoint(e.clientX, e.clientY);
          ghost.remove(); el.classList.remove('lifted');
          if (o.end) o.end();
          if (e.type === 'pointerup' && o.drop) o.drop(t, e.clientX, e.clientY);
        } else if (e.type === 'pointerup' && o.tap) o.tap();
      }
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      ev.preventDefault();
    });
    el.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && o.tap && answering()) { e.preventDefault(); o.tap(); } });
  }
  function chip(html, extra) {
    var c = h('button', 'lz-chip' + (extra ? ' ' + extra : ''), html); c.type = 'button'; return c;
  }

  /* ================= bins: trage fiecare card în cutia lui ================= */
  BUILD.bins = function (sp, el) {
    var items = sp.items, n = items.length, where = items.map(function () { return -1; }), selI = null;
    var order = shuffleNot(n, function () { return false; });
    var pool = h('div', 'lz-pool'), grid = h('div', 'lz-bins'), binEls = [], bodies = [];
    el.appendChild(h('div', 'lz-note', 'Trage un card în cutie. Poți și să atingi cardul, apoi cutia.'));
    el.appendChild(pool);
    sp.bins.forEach(function (b, bi) {
      var box = h('div', 'lz-bin'), head = h('div', 'lz-bin__h', '<b>' + m(b.l) + '</b>' + (b.s ? '<small>' + m(b.s) + '</small>' : '')), body = h('div', 'lz-bin__b');
      box.dataset.b = bi; box.appendChild(head); box.appendChild(body); grid.appendChild(box); binEls.push(box); bodies.push(body);
      box.addEventListener('click', function (ev) { if (!answering() || ev.target.closest('.lz-chip') || selI == null) return; place(selI, bi); });
    });
    el.appendChild(grid);
    pool.addEventListener('click', function (ev) { if (!answering() || ev.target.closest('.lz-chip') || selI == null) return; place(selI, -1); });
    function place(i, b) { where[i] = b; selI = null; draw(i); PLZ.setGo(where.every(function (w) { return w >= 0; })); }
    function over(t) {
      binEls.forEach(function (b) { b.classList.remove('over'); }); pool.classList.remove('over');
      var bx = t && t.closest && t.closest('.lz-bin'); if (bx) { bx.classList.add('over'); return; }
      if (t && t.closest && t.closest('.lz-pool')) pool.classList.add('over');
    }
    function chipFor(i) {
      var c = chip(m(items[i].t), selI === i ? 'sel' : '');
      drag(c, {
        /* ai ales un card și atingi unul din cutie: cardul ales trece în cutia aceea (cutia e acoperită de carduri, nu are loc liber de atins) */
        tap: function () { if (selI != null && selI !== i && where[i] >= 0) { place(selI, where[i]); return; } selI = selI === i ? null : i; draw(); pop(c); },
        move: function (x, y, t) { over(t); },
        end: function () { over(null); },
        drop: function (t) {
          var bx = t && t.closest && t.closest('.lz-bin');
          if (bx) place(i, +bx.dataset.b); else if (t && t.closest && t.closest('.lz-pool')) place(i, -1);
        }
      });
      return c;
    }
    function draw(popI) {
      pool.innerHTML = ''; bodies.forEach(function (b) { b.innerHTML = ''; });
      order.forEach(function (i) {
        var c = chipFor(i);
        (where[i] < 0 ? pool : bodies[where[i]]).appendChild(c);
        if (popI === i) pop(c);
      });
      pool.classList.toggle('empty', !where.some(function (w) { return w < 0; }));
    }
    draw();
    return {
      canCheck: function () { return where.every(function (w) { return w >= 0; }); },
      isRight: function () { return items.every(function (it, i) { return where[i] === it.b; }); },
      mark: function () {
        pool.innerHTML = ''; bodies.forEach(function (b) { b.innerHTML = ''; });
        order.forEach(function (i) {
          /* cardul pus bine: verde în cutia lui; pus greșit: roșu în cutia unde l-ai pus; rămas în afară (ai cerut răspunsul): verde, în cutia lui */
          var placed = where[i] >= 0, good = !placed || where[i] === items[i].b;
          var c = chip(m(items[i].t), good ? 'ok' : 'no'); c.disabled = true;
          bodies[placed ? where[i] : items[i].b].appendChild(c);
        });
      },
      okEl: function () { return grid; },
      extra: function () {
        var wrong = items.filter(function (it, i) { return where[i] !== it.b; }).length;
        return wrong ? (wrong === 1 ? 'Un card a ajuns în cutia greșită.' : wrong + ' carduri au ajuns în cutii greșite.') : '';
      }
    };
  };

  /* ================= rank: trage cardurile în ordine ================= */
  BUILD.rank = function (sp, el) {
    var n = sp.tiles.length, ord = shuffleNot(n, function (o) { return o.every(function (v, i) { return v === i; }); }), selI = null;
    var asc = sp.dir !== 'desc';
    el.appendChild(h('div', 'lz-note', 'Trage cardurile pe locul lor. Poți și să atingi două carduri ca să le schimbi între ele.'));
    var row = h('div', 'lz-rank'), ends = h('div', 'lz-rank__ends', '<span>' + (asc ? 'cel mai mic' : 'cel mai mare') + '</span><i></i><span>' + (asc ? 'cel mai mare' : 'cel mai mic') + '</span>');
    el.appendChild(row); el.appendChild(ends);
    var chips = [];
    function nearest(x, y, skip) {
      var best = -1, bd = 1e9;
      chips.forEach(function (c, pos) {
        if (pos === skip) return;
        var r = c.getBoundingClientRect(), d = Math.hypot(x - (r.left + r.width / 2), (y - (r.top + r.height / 2)) * 1.6);
        if (d < bd) { bd = d; best = pos; }
      });
      return best;
    }
    function moveTo(from, to) { var v = ord.splice(from, 1)[0]; ord.splice(to, 0, v); selI = null; draw(to); }
    function draw(popPos) {
      row.innerHTML = ''; chips = [];
      ord.forEach(function (ti, pos) {
        var c = chip('<span class="ix">' + (pos + 1) + '</span>' + m(sp.tiles[ti]), selI === pos ? 'sel' : ''); chips.push(c); row.appendChild(c);
        drag(c, {
          tap: function () {
            if (selI == null) { selI = pos; draw(); return; }
            if (selI === pos) { selI = null; draw(); return; }
            var a = selI, t = ord[a]; ord[a] = ord[pos]; ord[pos] = t; selI = null; draw(pos);
          },
          move: function (x, y) { var q = nearest(x, y, pos); chips.forEach(function (k, j) { k.classList.toggle('over', j === q); }); },
          end: function () { chips.forEach(function (k) { k.classList.remove('over'); }); },
          drop: function (t, x, y) { var q = nearest(x, y, pos); if (q >= 0) moveTo(pos, q); }
        });
        if (popPos === pos) pop(c);
      });
    }
    draw();
    PLZ.setGo(true);
    return {
      canCheck: function () { return true; },
      isRight: function () { return ord.every(function (v, i) { return v === i; }); },
      mark: function () { chips.forEach(function (c, pos) { c.disabled = true; c.classList.remove('sel', 'over'); c.classList.add(ord[pos] === pos ? 'ok' : 'no'); }); },
      okEl: function () { return row; }
    };
  };

  /* ================= slice: taie întregul și colorează ================= */
  BUILD.slice = function (sp, el) {
    var parts = 1, colored = 0, MAXP = 12, bar = null, locked = false;
    var wrap = h('div', 'lz-slice');
    if (sp.mode === 'equiv') {
      var ref = h('div', 'lz-slice__ref');
      ref.appendChild(h('div', 'lz-slice__lb', 'Bara de sus ' + m(fr(sp.a, sp.b))));
      ref.appendChild(PV.bar({ d: sp.b, n: sp.a }).el);
      wrap.appendChild(ref);
    }
    var host = h('div', 'lz-slice__bar'), ctl = h('div', 'lz-slice__ctl'), read = h('div', 'lz-slice__read');
    var minus = h('button', 'pv-k', '−'), plus = h('button', 'pv-k', '+'), val = h('b', 'lz-slice__n', '1');
    minus.type = plus.type = 'button'; minus.setAttribute('aria-label', 'Mai puține părți'); plus.setAttribute('aria-label', 'Mai multe părți');
    ctl.appendChild(h('span', 'pv-k-lb', 'Taie în')); ctl.appendChild(minus); ctl.appendChild(val); ctl.appendChild(plus); ctl.appendChild(h('span', 'pv-k-lb', 'părți'));
    wrap.appendChild(h('div', 'lz-slice__lb', sp.mode === 'equiv' ? 'Bara de jos' : 'Întregul'));
    wrap.appendChild(host); wrap.appendChild(ctl); wrap.appendChild(read);
    el.appendChild(wrap);
    el.appendChild(h('div', 'lz-note', 'Mai întâi taie întregul, apoi atinge părțile pe care vrei să le colorezi.'));
    function sync() {
      val.textContent = parts;
      read.innerHTML = colored ? 'Ai colorat ' + m(fr(colored, parts)) : 'Nu ai colorat nimic încă';
      minus.disabled = locked || parts <= 1; plus.disabled = locked || parts >= MAXP;
      PLZ.setGo(colored > 0);
    }
    function build() {
      colored = 0; bar = PV.bar({ d: parts, n: 0, toggle: true, onchange: function (c) { colored = c; sync(); } });
      host.innerHTML = ''; host.appendChild(bar.el); sync();
    }
    minus.onclick = function () { if (!answering() || parts <= 1) return; parts--; build(); pop(val); };
    plus.onclick = function () { if (!answering() || parts >= MAXP) return; parts++; build(); pop(val); };
    build();
    var tgt = sp.mode === 'equiv' ? { n: sp.ex[0], d: sp.ex[1] } : { n: sp.n, d: sp.d };
    return {
      canCheck: function () { return colored > 0; },
      isRight: function () {
        if (sp.mode === 'equiv') return parts !== sp.b && PM.eq(PM.F(colored, parts), PM.F(sp.a, sp.b));
        return parts === sp.d && colored === sp.n;
      },
      mark: function (right) {
        locked = true; bar.lock(right); sync();
        if (!right) {
          var c = h('div', 'lz-slice__ok'); c.appendChild(h('div', 'lz-slice__lb', (sp.mode === 'equiv' ? 'De exemplu ' : 'Corect ') + m(fr(tgt.n, tgt.d))));
          c.appendChild(PV.bar({ d: tgt.d, n: tgt.n }).el); wrap.appendChild(c);
        }
      },
      okEl: function () { return host; },
      extra: function () { return sp.mode === 'equiv' && parts === sp.b && colored > 0 ? 'Ai tăiat în aceleași părți ca bara de sus. Caută alte părți.' : ''; }
    };
  };

  /* ================= zoom: mărește axa ================= */
  BUILD.zoom = function (sp, el) {
    var K = 3, den = function (k) { return Math.pow(10, k); }, stack = [{ a: sp.lo, k: 0 }], sel = null, locked = false;
    var STEP = ['', 'zecime (0,1)', 'sutime (0,01)', 'miime (0,001)'];
    var wrap = h('div', 'lz-zoom'), top = h('div', 'lz-zoom__top'), shell = h('div', 'lz-zr'), inner = h('div', 'lz-zri'), read = h('div', 'lz-zoom__read'), back = h('button', 'lz-zoom__back', 'Înapoi');
    back.type = 'button';
    var crumb = h('span', 'lz-zoom__crumb');
    top.appendChild(crumb); top.appendChild(back);
    shell.appendChild(inner); wrap.appendChild(top); wrap.appendChild(shell); wrap.appendChild(read); el.appendChild(wrap);
    el.appendChild(h('div', 'lz-note', sp.mode === 'between' ? 'Atinge un interval ca să-l mărești. Când vezi un număr care se află între cele două, atinge-l.' : 'Atinge un interval ca să-l mărești. Când vezi punctul căutat, atinge-l.'));
    var fmt = function (num, k) { return PM.fmtDec(PM.F(num, den(k))); };
    function win() { return stack[stack.length - 1]; }
    function selVal() { return sel ? PM.F(sel.num, den(sel.k)) : null; }
    function draw(anim) {
      var w = win(), k1 = w.k + 1, i;
      inner.innerHTML = '';
      crumb.innerHTML = 'Axa arată de la <b>' + fmt(w.a, w.k) + '</b> la <b>' + fmt(w.a + 1, w.k) + '</b>. O diviziune este o ' + STEP[k1] + '.';
      back.hidden = stack.length < 2 || locked;
      for (i = 0; i < 10; i++) {
        var band = h('button', 'lz-zb' + (w.k + 1 < K ? '' : ' flat'), w.k + 1 < K ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M15 15l5.5 5.5M7.5 10h5M10 7.5v5"/></svg>' : '');
        band.type = 'button'; band.style.left = (i * 10) + '%'; band.setAttribute('aria-label', 'Mărește intervalul de la ' + fmt(10 * w.a + i, k1) + ' la ' + fmt(10 * w.a + i + 1, k1));
        if (w.k + 1 < K) band.onclick = (function (ii) { return function () { if (!answering()) return; stack.push({ a: 10 * w.a + ii, k: w.k + 1 }); sel = null; draw(true); }; })(i);
        else band.disabled = true;
        inner.appendChild(band);
      }
      inner.appendChild(h('i', 'lz-zl-line'));
      for (i = 0; i <= 10; i++) {
        var num = 10 * w.a + i, left = (i * 10) + '%';
        var tk = h('i', 'lz-zt' + (i === 0 || i === 10 ? ' mj' : '')); tk.style.left = left; inner.appendChild(tk);
        var lb = h('span', 'lz-zlab', fmt(num, k1)); lb.style.left = left; inner.appendChild(lb);
        var dot = h('button', 'lz-zd' + (sel && sel.num === num && sel.k === k1 ? ' on' : '')); dot.type = 'button'; dot.style.left = left; dot.setAttribute('aria-label', 'Alege ' + fmt(num, k1));
        dot.onclick = (function (nn, kk) { return function () { if (!answering()) return; sel = { num: nn, k: kk }; draw(false); pop(inner.querySelector('.lz-zd.on')); }; })(num, k1);
        inner.appendChild(dot);
      }
      if (sp.mode === 'between' && (PM.val(sp.B) - PM.val(sp.A)) * den(k1) >= 0.99) [['A', sp.A], ['B', sp.B]].forEach(function (p) {
        var pos = (PM.val(p[1]) - w.a / den(w.k)) * den(w.k);
        if (pos < -1e-9 || pos > 1 + 1e-9) return;
        var fl = h('span', 'lz-zflag', '<b>' + fmt(Math.round(PM.val(p[1]) * den(Math.max(w.k, 2))), Math.max(w.k, 2)) + '</b>'); fl.style.left = (pos * 100) + '%'; inner.appendChild(fl);
      });
      read.innerHTML = sel ? 'Ai ales <b>' + fmt(sel.num, sel.k) + '</b>' : 'Nu ai ales încă niciun punct';
      PLZ.setGo(!!sel);
      if (anim && !reduce()) { inner.classList.remove('zin'); void inner.offsetWidth; inner.classList.add('zin'); }
    }
    back.onclick = function () { if (!answering() || stack.length < 2) return; stack.pop(); sel = null; draw(true); };
    draw(false);
    var okVal = function () { var v = selVal(); return v && (sp.mode === 'between' ? PM.cmp(v, sp.A) > 0 && PM.cmp(v, sp.B) < 0 : PM.eq(v, sp.target)); };
    return {
      canCheck: function () { return !!sel; },
      isRight: function () { return !!okVal(); },
      mark: function (right) {
        locked = true; back.hidden = true;
        inner.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
        var on = inner.querySelector('.lz-zd.on'); if (on) on.classList.add(right ? 'ok' : 'no');
      },
      okEl: function () { return shell; },
      answerText: function () { return sp.mode === 'between' ? '' : PM.fmtDec(sp.target); }
    };
  };

  /* ================= rem: împărțirea își găsește perioada ================= */
  BUILD.rem = function (sp, el) {
    var sel = null, locked = false, rows = [];
    var wrap = h('div', 'lz-rem');
    wrap.appendChild(h('div', 'lz-rem__head', '<b>' + sp.n + ' : ' + sp.d + '</b> = ' + sp.q0 + ', cu restul <span class="r">' + sp.r0 + '</span>'));
    var list = h('div', 'lz-rem__rows');
    sp.rows.forEach(function (r, i) {
      var b = h('button', 'lz-rem__row', '<span class="ix">' + (i + 1) + '</span><span class="op">' + r.x + ' : ' + sp.d + ' = <b>' + r.dg + '</b></span><span class="rest">rest <b>' + r.r + '</b></span>');
      b.type = 'button'; b.style.animationDelay = (reduce() ? 0 : 120 + i * 260) + 'ms';
      b.onclick = function () { if (!answering()) return; sel = i + 1; rows.forEach(function (x, j) { x.classList.toggle('sel', j === i); }); PLZ.setGo(true); pop(b); };
      list.appendChild(b); rows.push(b);
    });
    wrap.appendChild(list); el.appendChild(wrap);
    el.appendChild(h('div', 'lz-note', 'Fiecare rând este un pas al împărțirii. Atinge rândul al cărui rest a mai apărut.'));
    return {
      canCheck: function () { return sel != null; },
      isRight: function () { return sel === sp.at; },
      mark: function (right) {
        rows.forEach(function (b, j) {
          b.disabled = true; b.classList.remove('sel');
          if (j + 1 === sp.at) b.classList.add('ok');
          else if (j + 1 === sp.first) b.classList.add('twin');
          else if (j + 1 === sel) b.classList.add('no');
        });
        if (sp.first === 0) wrap.querySelector('.lz-rem__head').classList.add('twin');
      },
      okEl: function () { return rows[sp.at - 1]; }
    };
  };

  /* ================= wholes: bucăți în cercuri ================= */
  var NS = 'http://www.w3.org/2000/svg';
  function wedge(cx, cy, r, i, d) {
    var a0 = -Math.PI / 2 + i * 2 * Math.PI / d, a1 = -Math.PI / 2 + (i + 1) * 2 * Math.PI / d;
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return 'M' + cx + ' ' + cy + 'L' + x0.toFixed(2) + ' ' + y0.toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + (d === 1 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + 'Z';
  }
  /* o bucată de 1/d: felia cu vârful în jos, tăiată pe măsura ei ca să se vadă bine și când d e mare */
  function pieceSvg(d, hpx) {
    var th = Math.PI / d, sx = Math.min(1, Math.sin(th)), w = 92 * sx + 6;
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', (50 - 46 * sx - 3) + ' 1 ' + w + ' 53');
    svg.setAttribute('height', hpx); svg.setAttribute('width', Math.round(hpx * w / 53)); svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(NS, 'path'); p.setAttribute('d', wedge(50, 50, 46, 0, d)); p.setAttribute('class', 'wp');
    var g = document.createElementNS(NS, 'g'); g.setAttribute('transform', 'rotate(' + (-180 / d) + ' 50 50)'); g.appendChild(p); svg.appendChild(g);
    return svg;
  }
  BUILD.wholes = function (sp, el) {
    var d = sp.d, n = sp.n, C = Math.ceil(n / d), slots = [], i;
    for (i = 0; i < C; i++) { var s = []; for (var j = 0; j < d; j++) s.push(false); slots.push(s); }
    var placed = 0, wrap = h('div', 'lz-wholes'), tray = h('div', 'lz-wholes__tray'), circles = h('div', 'lz-wholes__circles'), cEls = [], svgs = [];
    el.appendChild(h('div', 'lz-note', 'Trage o bucată într-un cerc, sau atinge un cerc ca să pui o bucată în el. Atinge o bucată din cerc ca s-o scoți.'));
    wrap.appendChild(tray); wrap.appendChild(circles); el.appendChild(wrap);
    var left = h('div', 'lz-wholes__left'); wrap.appendChild(left);
    function drawTray() {
      tray.innerHTML = '';
      for (var k = 0; k < n - placed; k++) {
        var pc = h('button', 'lz-piece'); pc.type = 'button'; pc.setAttribute('aria-label', 'Bucată ' + fr(1, d)); pc.appendChild(pieceSvg(d, 40)); tray.appendChild(pc);
        drag(pc, {
          tap: function () { var ci = firstOpen(); if (ci >= 0) put(ci); },
          move: function (x, y, t) { cEls.forEach(function (c) { c.classList.remove('over'); }); var c = t && t.closest && t.closest('.lz-circle'); if (c) c.classList.add('over'); },
          end: function () { cEls.forEach(function (c) { c.classList.remove('over'); }); },
          drop: function (t) { var c = t && t.closest && t.closest('.lz-circle'); if (c) put(+c.dataset.c); }
        });
      }
      left.innerHTML = placed < n ? 'Mai ai de pus <b>' + (n - placed) + '</b>' + (n - placed === 1 ? ' bucată' : ' bucăți') : 'Toate bucățile sunt puse. Verifică!';
      tray.style.display = placed >= n ? 'none' : '';
      PLZ.setGo(placed === n);
    }
    function firstOpen() { for (var c = 0; c < C; c++) if (slots[c].indexOf(false) >= 0) return c; return -1; }
    function put(ci) {
      if (!answering() || placed >= n) return;
      var j = slots[ci].indexOf(false); if (j < 0) return;
      slots[ci][j] = true; placed++; paint(ci, j); drawTray();
    }
    function takeOut(ci, j) {
      if (!answering() || !slots[ci][j]) return;
      slots[ci][j] = false; placed--; paint(ci, j); drawTray();
    }
    function paint(ci, j) {
      var ps = svgs[ci].querySelectorAll('path.sl');
      for (var q = 0; q < d; q++) ps[q].classList.toggle('on', slots[ci][q]);
      var cnt = slots[ci].filter(Boolean).length;
      cEls[ci].classList.toggle('full', cnt === d);
      cEls[ci].querySelector('.cnt').textContent = cnt + '/' + d;
      if (j != null) pop(ps[j]);
    }
    for (i = 0; i < C; i++) (function (ci) {
      var c = h('div', 'lz-circle'); c.dataset.c = ci; c.setAttribute('role', 'group'); c.setAttribute('aria-label', 'Cercul ' + (ci + 1));
      var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'lz-circle__svg');
      var base = document.createElementNS(NS, 'circle'); base.setAttribute('cx', 50); base.setAttribute('cy', 50); base.setAttribute('r', 47); base.setAttribute('class', 'bs'); svg.appendChild(base);
      for (var j = 0; j < d; j++) {
        var p = document.createElementNS(NS, 'path'); p.setAttribute('d', wedge(50, 50, 46, j, d)); p.setAttribute('class', 'sl');
        p.addEventListener('click', (function (jj) { return function (ev) { ev.stopPropagation(); if (slots[ci][jj]) takeOut(ci, jj); else put(ci); }; })(j));
        svg.appendChild(p);
      }
      c.appendChild(svg); c.appendChild(h('span', 'cnt', '0/' + d));
      c.addEventListener('click', function () { put(ci); });
      circles.appendChild(c); cEls.push(c); svgs.push(svg);
    })(i);
    drawTray();
    var q = Math.floor(n / d), r = n % d;
    return {
      canCheck: function () { return placed === n; },
      isRight: function () {
        var counts = slots.map(function (s) { return s.filter(Boolean).length; }).sort(function (a, b) { return b - a; });
        var want = []; for (var k = 0; k < q; k++) want.push(d); if (r) want.push(r); while (want.length < C) want.push(0);
        return counts.every(function (c, k) { return c === want[k]; });
      },
      mark: function (right) {
        cEls.forEach(function (c) { c.classList.add(right ? 'ok' : 'no'); c.style.pointerEvents = 'none'; });
        tray.innerHTML = '';
      },
      okEl: function () { return circles; },
      answerText: function () { return fr(n, d) + ' = ' + q + fr(r, d); }
    };
  };
})();
