/* ============================================================
   Parcurs: pagina cu drumul lecțiilor (parcurs.html).
   Capitol > secțiune (o temă din tabelul fondatorului) > cerculețe (subteme, câte 4 lecții) > testul secțiunii.
   Un cerculeț se deschide după ce termini pe cel dinainte; inelul din jurul lui arată câte lecții din cele 4 sunt făcute.
   Clasa vine din contul elevului (wizardul de la conectare). Deocamdată există conținut doar pentru clasa a 7-a.
   ============================================================ */
(function () {
  'use strict';
  var PM = window.PM, C = window.PCONTENT, Prog = window.Parcurs;
  var root = null;   /* #ppRoot: îl pune insula React (coloana din mijloc), deci îl căutăm după ce apare */
  var CLS = C.CLASS7;
  var ROMAN = { 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII' };
  var reduce = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var esc = PM.esc;

  var ICON = {
    book: '<path d="M3 5.5C5 4.5 8 4.5 12 6.5c4-2 7-2 9-1v13c-2-1-5-1-9 1-4-2-7-2-9-1z"/><path d="M12 6.5v13"/>',
    scale: '<path d="M12 4v16M6 20h12M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    axis: '<rect x="2.5" y="8.5" width="19" height="7" rx="1.8"/><path d="M7 8.5v3.5M11 8.5v2.5M15 8.5v3.5M19 8.5v2.5"/>',
    decimal: '<text x="12" y="16.5" text-anchor="middle" font-size="11.5" font-weight="800" fill="currentColor" stroke="none" font-family="Plus Jakarta Sans, sans-serif">0,5</text>',
    repeat: '<path d="M20 11a8 8 0 0 0-14-4M4 5v4h4M4 13a8 8 0 0 0 14 4M20 19v-4h-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    paren: '<path d="M8 4c-3 4-3 12 0 16M16 4c3 4 3 12 0 16"/>',
    times: '<path d="M6 6l12 12M18 6L6 18"/>',
    signs: '<text x="12" y="17" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor" stroke="none" font-family="Plus Jakarta Sans, sans-serif">±</text>',
    divide: '<circle cx="12" cy="6" r="1.3"/><circle cx="12" cy="18" r="1.3"/><path d="M5 12h14"/>',
    order: '<path d="M4 7h16M4 12h10M4 17h6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  var svg = function (n, cls) { return '<svg viewBox="0 0 24 24" class="' + (cls || 'ic') + '" aria-hidden="true">' + (ICON[n] || ICON.book) + '</svg>'; };
  var ZIG = [0, 70, 108, 70, 0, -70, -108, -70];

  /* ---------- clasa elevului ---------- */
  /* elevul isi are clasa din wizard (bm_grade); profesorul si adminul doar privesc un parcurs la alegere (bm_grade_view), fara sa schimbe nimic in cont */
  function isStudent() { var r = window.BMAuth && window.BMAuth.role; return !r || r === 'elev'; }
  function grade() {
    try { var g = parseInt(localStorage.getItem(isStudent() ? 'bm_grade' : 'bm_grade_view') || '', 10); if (g >= 5 && g <= 12) return g; } catch (e) { /* ignore */ }
    return 0;
  }
  /* clasa pe care o privesti acum: elevul poate vedea o alta clasa fara sa-si schimbe clasa din cont (bm_grade_view ramane si dupa o lectie) */
  function viewOf() { try { var g = parseInt(localStorage.getItem('bm_grade_view') || '', 10); if (g >= 5 && g <= 12) return g; } catch (e) { /* ignore */ } return 0; }
  function setView(n) { try { if (n) localStorage.setItem('bm_grade_view', String(n)); else localStorage.removeItem('bm_grade_view'); } catch (e) { /* ignore */ } if (window.BMGrade) window.BMGrade.paint(); }

  /* derulare doar pe containerul care deruleaza pe verticala: scrollIntoView muta si containerele taiate (overflow) ale paginii, de aici decalajele */
  function scrollerOf(el) {
    for (var p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      var cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return document.scrollingElement || document.documentElement;
  }
  function revealIn(el, o) {
    o = o || {};
    var sc = scrollerOf(el), isDoc = sc === document.scrollingElement || sc === document.documentElement;
    var vt = isDoc ? 0 : sc.getBoundingClientRect().top, vb = isDoc ? window.innerHeight : sc.getBoundingClientRect().bottom;
    var top = vt + (o.padTop || 0), bot = vb - (o.padBottom || 0), r = el.getBoundingClientRect(), d = 0;
    if (o.mode === 'center') d = (r.top + r.height / 2) - (top + bot) / 2;
    else if (o.mode === 'start') d = r.top - top;
    else { if (r.bottom > bot) d = r.bottom - bot; if (o.keep) { var kr = o.keep.getBoundingClientRect(); if (kr.top - d < top + 8) d = kr.top - (top + 8); } else if (r.top - d < top) d = r.top - top; }
    if (Math.abs(d) < 2) return;
    var cur = isDoc ? (window.pageYOffset || sc.scrollTop) : sc.scrollTop, opt = { top: Math.max(0, cur + d), behavior: o.smooth && !reduce() ? 'smooth' : 'auto' };
    if (isDoc) window.scrollTo(opt); else sc.scrollTo(opt);
  }

  /* ---------- stare ---------- */
  function totalsOf(sec) {
    var lessons = 0, done = 0;
    sec.circles.forEach(function (c) { c.lessons.forEach(function (l) { lessons++; if (Prog.isDone(l.id)) done++; }); });
    return { lessons: lessons, done: done, testDone: Prog.isDone(sec.testId) };
  }
  function circleDone(c) { return c.lessons.every(function (l) { return Prog.isDone(l.id); }); }
  function circleCount(c) { return c.lessons.filter(function (l) { return Prog.isDone(l.id); }).length; }
  function currentNodeId() {
    var f = C.flat(), i;
    for (i = 0; i < f.length; i++) if (!Prog.isDone(f[i].id)) return f[i].id;
    return null;
  }
  /* cercul/nodul curent: primul care nu e terminat */
  function curCircleOrTest() {
    var id = currentNodeId(); if (!id) return null;
    var n = C.findNode(id);
    return n.kind === 'test' ? { test: n.section } : { circle: n.circle, lesson: n.lesson };
  }

  /* ---------- desen ---------- */
  var RING_R = 46, RING_LEN = 2 * Math.PI * RING_R;
  /* inel cu grosime lipit de cerculețul curent: patru segmente, câte unul pe lecție (cele făcute sunt verzi), cu partea laterală vizibilă ca la cerculeț */
  function rimGrad(n, on, off) {
    var s = [], i, c, a, b;
    for (i = 0; i < 4; i++) { c = i < n ? on : off; a = i * 90 + 5; b = (i + 1) * 90 - 5; s.push('transparent ' + (i * 90) + 'deg ' + a + 'deg', c + ' ' + a + 'deg ' + b + 'deg', 'transparent ' + b + 'deg ' + ((i + 1) * 90) + 'deg'); }
    return 'conic-gradient(' + s.join(',') + ')';
  }
  function rim(n) {
    return '<span class="rim" aria-hidden="true" style="--ra:' + rimGrad(n, 'var(--rim-on)', 'var(--rim-off)') + ';--rb:' + rimGrad(n, 'var(--rim-on-e)', 'var(--rim-off-e)') + '"><i class="rim-b"></i><i class="rim-a"></i></span>';
  }
  function ring(frac) {
    return '<svg class="ring' + (frac > 0 ? '' : ' z') + '" viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-bg" cx="50" cy="50" r="' + RING_R + '"/><circle class="ring-fg" cx="50" cy="50" r="' + RING_R + '" style="stroke-dasharray:' + RING_LEN.toFixed(1) + ';stroke-dashoffset:' + (RING_LEN * (1 - frac)).toFixed(1) + '" transform="rotate(-90 50 50)"/></svg>';
  }

  function nodeHTML(kind, state, idx, o) {
    var dx = ZIG[idx % ZIG.length], inner, label;
    if (kind === 'test') { inner = '<img src="assets/images/gamification/cadou' + (state === 'lock' ? '-mini' : '') + '.svg" alt="">'; label = 'Testul secțiunii'; }
    else if (state === 'done') { inner = svg('check'); label = o.title; }
    else { inner = svg(o.icon); label = o.title; }
    var frac = kind === 'test' ? (state === 'done' ? 1 : 0) : o.count / 4;
    var h = '<div class="nw" style="--dx:' + dx + '"' + (dx < 0 ? ' data-neg="1"' : '') + ' data-id="' + esc(o.id) + '" data-state="' + state + '">';
    h += '<button class="nd ' + state + (kind === 'test' ? ' test' : '') + '" type="button" aria-label="' + esc(label) + (state === 'lock' ? ', blocat' : state === 'done' ? ', terminat' : '') + '" data-node="' + esc(o.id) + '">';
    if (kind !== 'test' && state === 'cur') h += rim(o.count || 0);
    h += '<span class="face">' + inner + '</span>';
    if (state === 'cur') h += '<span class="go-tag">ÎNCEPE</span>';
    h += '</button>';
    if (state === 'cur') h += '<div class="owlw"><img class="owl-tile" src="assets/images/avatar-owl.svg" alt="" width="88" height="88"></div>';
    h += '</div>';
    return h;
  }

  function sectionHTML(sec, sIdx, cur) {
    var t = totalsOf(sec), secDone = t.testDone, anyDone = t.done > 0;
    var isCurSec = cur && ((cur.circle && cur.circle.section === sec) || cur.test === sec);
    var state = secDone ? 'done' : isCurSec ? 'cur' : 'lock';
    var pips = '', i;
    sec.circles.forEach(function (c) { pips += '<i class="' + (circleDone(c) ? 'on' : circleCount(c) ? 'half' : '') + '"></i>'; });
    pips += '<i class="test ' + (secDone ? 'on' : '') + '"></i>';
    var h = '<section class="pp-sec" id="' + sec.id + '" data-sec="' + sec.id + '" data-state="' + state + '">';
    h += '<div class="unit ' + (state === 'lock' ? 'dim' : '') + '"><div class="unit__tx"><small>CAPITOLUL ' + sec.chapter.n + ', SECȚIUNEA ' + sec.n + '</small><h2>' + esc(PM.plain(sec.title)) + '</h2><div class="pr" aria-hidden="true">' + pips + '</div></div>';
    if (state === 'cur' && !anyDone) h += '<button class="unit__key" type="button" data-skip="' + sec.id + '">' + svg('bolt') + 'SARI PESTE</button>';
    else if (state === 'done') h += '<span class="unit__tag">' + svg('check') + 'TERMINATĂ</span>';
    else if (state === 'lock') h += '<span class="unit__tag">' + svg('lock') + 'BLOCATĂ</span>';
    h += '</div><div class="path">';
    var idx = 0;
    sec.circles.forEach(function (c) {
      var cd = circleDone(c), cnt = circleCount(c);
      var st = cd ? 'done' : (cur && cur.circle === c) ? 'cur' : 'lock';
      h += nodeHTML('circle', st, idx++, { id: c.id_full, title: c.title, icon: c.icon, count: cnt });
    });
    var tst = secDone ? 'done' : (cur && cur.test === sec) ? 'cur' : 'lock';
    h += nodeHTML('test', tst, idx++, { id: sec.testId, title: sec.short, count: 0 });
    h += '</div></section>';
    return h;
  }

  function upcomingHTML() {
    var ch = CLS.chapters[0];
    var rows = ch.upcoming.map(function (t, i) { return '<li><span class="sn">' + (ch.sections.length + i + 1) + '</span><b>' + esc(t) + '</b>' + svg('lock', 'ic lk') + '</li>'; }).join('');
    return '<section class="pp-soon"><div class="pp-soon__h"><small>URMEAZĂ ÎN CAPITOLUL ' + ch.n + '</small><h3>Se pregătesc încă ' + ch.upcoming.length + ' secțiuni</h3></div><ol>' + rows + '</ol></section>';
  }

  function progressPct() {
    var total = 0, done = 0;
    CLS.chapters.forEach(function (k) { k.sections.forEach(function (sec) { var t = totalsOf(sec); total += t.lessons + 1; done += t.done + (t.testDone ? 1 : 0); }); });
    return { pct: total ? Math.round(done / total * 100) : 0, done: done, total: total };
  }

  /* progresul (inel verde pe butonul clasei) si butonul Sectiuni stau in randul de sus al site-ului (de la 601px; pe telefon raman in pagina) */
  function publishTop(g, pr) {
    var de = document.documentElement;
    de.setAttribute('data-pp', '1');
    try {
      if (g === 7) {
        de.setAttribute('data-pp-pct', String(pr.pct)); de.style.setProperty('--pp-deg', Math.round(pr.pct * 3.6) + 'deg');
        localStorage.setItem('bm_pp_pct', String(pr.pct));
      } else { de.removeAttribute('data-pp-pct'); localStorage.removeItem('bm_pp_pct'); }
    } catch (e) { /* ignore */ }
    if (window.BMGrade) window.BMGrade.paint();
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#navSecBtn')) openAll(); });

  /* ---------- randare ---------- */
  function render() {
    if (!root) return;
    var g = viewOf() || grade() || 7;
    var cur = curCircleOrTest();
    var pr = progressPct();
    var canPick = true;
    publishTop(g, pr);
    var h = '<div class="pp-top"><button class="pk' + (canPick ? '' : ' static') + '" type="button" id="ppClass"' + (canPick ? '' : ' tabindex="-1"') + '>' + 'Clasa a ' + ROMAN[g] + '-a' + (canPick ? svg('chev') : '') + '</button>' +
      (g === 7 ? '<span class="pp-pct" title="' + pr.done + ' din ' + pr.total + ' lecții și teste"><i style="--p:' + pr.pct + '%"></i><b>' + pr.pct + '%</b></span>' : '') +
      '<button class="pk sm" type="button" id="ppAll">' + svg('list') + '<span class="pp-lg">Toate secțiunile</span><span class="pp-sm">Secțiuni</span></button></div>';
    if (g !== 7) {
      h += '<div class="pp-main"><div class="pp-soonclass"><div class="owl" data-owl="idle"></div><h2>Parcursul clasei a ' + ROMAN[g] + '-a se pregătește</h2><p>Lucrăm la lecțiile pentru această clasă. Deocamdată este gata clasa a 7-a, ca să vezi cum arată un parcurs.</p><div class="pp-soonclass__act"><button class="go" type="button" id="ppSee7">VEZI CLASA A 7-A</button><a class="pk sm" href="capitole.html">Exerciții</a></div></div></div>';
      root.innerHTML = h; bindTop(); return;
    }
    h += '<div class="pp-main">';
    h += '<div class="pp-chap"><span>CAPITOLUL 1 · ' + esc(CLS.chapters[0].title.toUpperCase()) + '</span></div>';
    CLS.chapters[0].sections.forEach(function (s, i) { h += sectionHTML(s, i, cur); });
    h += upcomingHTML();
    h += '<p class="pp-note">Conținut în verificare: textele și exercițiile sunt validate de echipă înainte să fie definitive.</p>';
    h += '</div>';
    root.innerHTML = h;
    bindTop(); bindPath();
    if (window.OwlSite && window.OwlSite.scan) { try { window.OwlSite.scan(root); } catch (e) { /* ignore */ } }
  }

  /* ---------- popup-ul unui nod ---------- */
  var openPop = null;
  function closePop() { if (openPop) { var p = openPop; openPop = null; p.classList.remove('on'); setTimeout(function () { p.remove(); }, 160); } }
  function popHTML(id) {
    var n = C.findNode(id) || null, h = '';
    var c = findCircle(id);
    if (c) {
      var cnt = circleCount(c), done = cnt === 4, curL = c.lessons[Math.min(cnt, 3)];
      var st = nodeState(c);
      if (st === 'lock') return '<small>BLOCAT</small><h3>' + esc(c.title) + '</h3><p class="pp-pop__p">Termină mai întâi cerculețele de mai sus ca să-l deschizi.</p>';
      if (done) {
        h = '<small>CERCULEȚ TERMINAT</small><h3>' + esc(c.title) + '</h3><div class="pp-pop__ls">';
        c.lessons.forEach(function (l) { h += '<a class="ls done" href="lectie.html?l=' + l.id + '"><span class="st">' + svg('check') + '</span><b>' + l.n + '. ' + esc(l.title) + '</b><em>Repetă</em></a>'; });
        return h + '</div>';
      }
      h = '<small>LECȚIA ' + curL.n + ' DIN 4</small><h3>' + esc(c.title) + '</h3><p class="pp-pop__p"><b>' + esc(curL.title) + '</b>' + (curL.n === 1 ? ': începe cu explicația, apoi exersezi.' : curL.n === 2 ? ': exersezi ce ai învățat.' : curL.n === 3 ? ': exerciții mai grele, cu probleme.' : ': cele mai grele, ca să fii sigur.') + '</p>';
      h += '<div class="meta"><span>7 exerciții</span><span>circa 5 min</span><span>până la +70 XP</span></div><a class="gob" href="lectie.html?l=' + curL.id + '">ÎNCEPE LECȚIA</a>';
      if (cnt > 0) { h += '<div class="pp-pop__ls small">'; c.lessons.forEach(function (l) { if (Prog.isDone(l.id)) h += '<a class="ls done" href="lectie.html?l=' + l.id + '"><span class="st">' + svg('check') + '</span><b>' + l.n + '. ' + esc(l.title) + '</b><em>Repetă</em></a>'; }); h += '</div>'; }
      return h;
    }
    var sec = CLS.chapters[0].sections.filter(function (s) { return s.testId === id; })[0];
    if (sec) {
      var ts = Prog.isDone(sec.testId) ? 'done' : (currentNodeId() === sec.testId ? 'cur' : 'lock');
      if (ts === 'lock') return '<small>BLOCAT</small><h3>Testul secțiunii</h3><p class="pp-pop__p">Se deschide după ce termini toate cerculețele secțiunii.</p>';
      return '<small>' + (ts === 'done' ? 'TEST TRECUT' : 'TESTUL SECȚIUNII') + '</small><h3>' + esc(sec.short) + '</h3><p class="pp-pop__p">Zece exerciții din toată secțiunea, de la mediu la greu.</p><div class="meta"><span>10 exerciții</span><span>circa 8 min</span>' + (ts === 'done' ? '' : '<span>până la +100 XP</span>') + '</div><a class="gob" href="lectie.html?l=' + sec.testId + '">' + (ts === 'done' ? 'REPETĂ TESTUL' : 'ÎNCEPE TESTUL') + '</a>';
    }
    return '';
  }
  function findCircle(id) {
    var out = null;
    CLS.chapters.forEach(function (k) { k.sections.forEach(function (s) { s.circles.forEach(function (c) { if (c.id_full === id) out = c; }); }); });
    return out;
  }
  function nodeState(c) { if (circleDone(c)) return 'done'; var cur = curCircleOrTest(); return cur && cur.circle === c ? 'cur' : 'lock'; }

  function showPop(nw, id) {
    closePop();
    var html = popHTML(id); if (!html) return;
    var pop = document.createElement('div');
    pop.className = 'pp-pop'; pop.setAttribute('role', 'dialog'); pop.innerHTML = html;
    nw.appendChild(pop); openPop = pop;
    /* limitele sunt ale panoului care deruleaza (el taie ce iese din el), nu doar ale ferestrei */
    var paneEl = nw.closest('.cap-col-middle'), pr = paneEl ? paneEl.getBoundingClientRect() : { left: 0, right: window.innerWidth };
    var minL = Math.max(0, pr.left), maxR = Math.min(window.innerWidth, pr.right);
    var r = pop.getBoundingClientRect(), shift = 0, margin = 10;
    if (r.left < minL + margin) shift = minL + margin - r.left;
    else if (r.right > maxR - margin) shift = (maxR - margin) - r.right;
    pop.style.setProperty('--sx', shift + 'px');
    requestAnimationFrame(function () { pop.classList.add('on'); });
    var first = pop.querySelector('a.gob'); if (first) first.focus({ preventScroll: true });
    /* panoul trebuie sa se vada complet: daca iese din ecran (pe telefon, sub bara de jos), pagina deruleaza pana il arata */
    var settle = function () { if (openPop === pop) revealIn(pop, { mode: 'nearest', padBottom: 16, keep: nw, smooth: true }); };
    setTimeout(settle, 60); setTimeout(settle, 320);
  }

  /* ---------- evenimente ---------- */
  function bindTop() {
    var cls = document.getElementById('ppClass');
    if (cls) cls.onclick = function () {
      classAsk();
    };
    var all = document.getElementById('ppAll'); if (all) all.onclick = openAll;
    var see = document.getElementById('ppSee7'); if (see) see.onclick = function () { setView(7); render(); };
  }
  function bindPath() {
    root.querySelectorAll('.nd').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); var nw = b.closest('.nw'); if (openPop && openPop.parentNode === nw) { closePop(); return; } showPop(nw, b.dataset.node); };
    });
    root.querySelectorAll('[data-skip]').forEach(function (b) { b.onclick = function () { skipAsk(b.dataset.skip); }; });
  }
  document.addEventListener('click', function (e) { if (openPop && !openPop.contains(e.target)) closePop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePop(); closeDlg(); } });

  /* ---------- dialoguri ---------- */
  var dlg = null;
  function closeDlg() { if (!dlg) return; var d = dlg; dlg = null; d.classList.remove('on'); setTimeout(function () { d.remove(); }, 200); }
  function dialog(html, cls) {
    closeDlg();
    dlg = document.createElement('div'); dlg.className = 'pp-dlg ' + (cls || ''); dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true');
    dlg.innerHTML = '<div class="pp-dlg__card">' + html + '</div>';
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDlg(); });
    document.body.appendChild(dlg);
    requestAnimationFrame(function () { dlg && dlg.classList.add('on'); });
    return dlg;
  }
  function openAll() {
    var ch = CLS.chapters[0], cur = curCircleOrTest(), h = '<div class="pp-dlg__h"><h2>Toate secțiunile</h2><button class="pk sm x" type="button" data-x aria-label="Închide">' + svg('close') + '</button></div><p class="pp-dlg__sub">Clasa a 7-a · Capitolul ' + ch.n + ': ' + esc(ch.title) + '</p><div class="pp-all">';
    ch.sections.forEach(function (s) {
      var t = totalsOf(s), pct = Math.round((t.done + (t.testDone ? 1 : 0)) / (t.lessons + 1) * 100);
      var st = t.testDone ? 'done' : (cur && ((cur.circle && cur.circle.section === s) || cur.test === s)) ? 'cur' : 'lock';
      h += '<button type="button" class="ur ' + st + '" data-goto="' + s.id + '"><span class="st">' + (st === 'done' ? svg('check') : st === 'cur' ? svg('bolt') : svg('lock')) + '</span><span class="tx"><b>' + esc(PM.plain(s.title)) + '</b><small>' + s.circles.length + ' cerculețe + test</small></span><span class="bar"><i style="width:' + pct + '%"></i></span><span class="pc">' + pct + '%</span></button>';
    });
    ch.upcoming.forEach(function (t, i) { h += '<div class="ur lock static"><span class="st">' + svg('lock') + '</span><span class="tx"><b>' + esc(t) + '</b><small>În pregătire</small></span></div>'; });
    h += '</div>';
    var d = dialog(h, 'wide');
    d.querySelector('[data-x]').onclick = closeDlg;
    d.querySelectorAll('[data-goto]').forEach(function (b) { b.onclick = function () { closeDlg(); var el = document.getElementById(b.dataset.goto); if (el) revealIn(el, { mode: 'start', padTop: 96, smooth: true }); }; });
  }
  /* doar clasa, fara nickname: elevul poate trece oricând de la o clasă la alta */
  function classAsk() {
    var g = viewOf() || grade() || 7;
    var keys = [5, 6, 7, 8, 9, 10, 11, 12].map(function (n) {
      return '<button type="button" class="pp-g' + (n === g ? ' on' : '') + '" data-g="' + n + '"><b>' + ROMAN[n] + '</b><span>clasa a ' + n + '-a</span></button>';
    }).join('');
    var d = dialog('<div class="pp-dlg__h"><h2>Alege clasa</h2><button class="pk sm x" type="button" data-x aria-label="Închide">' + svg('close') + '</button></div><p class="pp-dlg__sub">Parcursul de lecții se schimbă după clasa aleasă.</p><div class="pp-grades">' + keys + '</div>', 'small');
    d.querySelector('[data-x]').onclick = closeDlg;
    d.querySelectorAll('[data-g]').forEach(function (b) {
      b.onclick = function () {
        var n = +b.dataset.g;
        if (isStudent()) { try { localStorage.setItem('bm_grade', String(n)); } catch (e) { /* ignore */ } setView(0); } else setView(n);
        var sb = isStudent() && window.BMAuth && window.BMAuth.supabase;
        if (sb) { try { Promise.resolve(sb.rpc('set_student_grade', { p_grade: n })).then(function () {}, function () {}); } catch (e) { /* migrarea poate lipsi: clasa ramane in browser */ } }
        closeDlg(); render(); if (window.BMGrade) window.BMGrade.paint();
        var top = root && root.closest('.cap-col-middle'); if (top) top.scrollTop = 0; else window.scrollTo(0, 0);
      };
    });
  }
  function skipAsk(secId) {
    var sec = CLS.chapters[0].sections.filter(function (s) { return s.id === secId; })[0]; if (!sec) return;
    var d = dialog('<div class="owl" data-owl="idle"></div><h2>Test de nivel</h2><p>Știi deja „' + esc(PM.plain(sec.short)) + '”? Rezolvă <b>10 exerciții</b> și, dacă ai cel puțin <b>8 corecte</b>, secțiunea se marchează ca terminată și treci mai departe.</p><p class="pp-dlg__small">Greșelile nu se repetă la final. Dacă nu ieși, mergi normal prin cerculețe.</p><div class="pp-dlg__act"><a class="go" href="lectie.html?l=' + sec.skipId + '">ÎNCEPE TESTUL</a><button class="pk" type="button" data-x>Nu acum</button></div>', 'small');
    d.querySelector('[data-x]').onclick = closeDlg;
    if (window.OwlSite && window.OwlSite.scan) { try { window.OwlSite.scan(d); } catch (e) { /* ignore */ } }
  }

  /* ---------- după o lecție: animațiile de întoarcere ---------- */
  function celebrate() {
    var id = null; try { id = sessionStorage.getItem('parcurs_celebrate'); sessionStorage.removeItem('parcurs_celebrate'); } catch (e) { /* ignore */ }
    var target = null;
    if (id) {
      var n = C.findNode(id);
      var cid = n ? (n.kind === 'test' ? n.id : n.circle.id_full) : null;
      target = cid && root.querySelector('.nw[data-id="' + cid + '"]');
    }
    var cur = root.querySelector('.nw .nd.cur');
    var focus = target || cur;
    if (focus) setTimeout(function () { revealIn(focus, { mode: 'center' }); }, 30);
    if (!id || reduce()) return;
    if (target) {
      var fg = target.querySelector('.ring-fg'), nd = target.querySelector('.nd');
      if (fg && fg.parentNode) fg.parentNode.classList.remove('z');
      if (fg && nd) {
        var final = fg.style.strokeDashoffset;
        var n2 = C.findNode(id), circ = n2 && n2.circle;
        var was = circ ? Math.max(0, circleCount(circ) - 1) : 0;
        fg.style.transition = 'none'; fg.style.strokeDashoffset = (RING_LEN * (1 - was / 4)).toFixed(1);
        setTimeout(function () { fg.style.transition = 'stroke-dashoffset .9s cubic-bezier(.3,.8,.2,1)'; fg.style.strokeDashoffset = final; }, 350);
        nd.classList.add('celebrate');
      }
    }
    if (cur && cur !== (target && target.querySelector('.nd'))) { cur.classList.add('unlock'); }
  }

  /* ---------- pornire ---------- */
  function start() {
    var g = grade();
    var after = function () { render(); celebrate(); };
    var done = false, once = function () { if (done) return; done = true; after(); };
    Promise.all([Prog.ready(), gradeFromDb()]).then(once, once);
    setTimeout(once, 1800);
  }
  function gradeFromDb() {
    if (grade()) return Promise.resolve();
    var sb = window.BMAuth && window.BMAuth.supabase;
    if (!sb) return Promise.resolve();
    return Promise.resolve(sb.rpc('my_student_profile')).then(function (r) {
      var p = r && r.data;
      if (p && p.grade) { try { localStorage.setItem('bm_grade', String(p.grade)); if (p.nickname) localStorage.setItem('bm_nickname', p.nickname); } catch (e) { /* ignore */ } }
    }, function () {});
  }

  document.addEventListener('bm:onboarded', function () { setView(0); render(); });
  /* clasa se poate schimba si din butonul din randul de sus (js/classpick.js) */
  window.addEventListener('bm:grade', function () { render(); var top = root && root.closest('.cap-col-middle'); if (top) top.scrollTop = 0; else window.scrollTo(0, 0); });
  document.addEventListener('parcurs:changed', function () { /* redesenăm doar când pagina nu e în mijlocul unei animații */ });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { render(); celebrate(); } });

  /* wizardul poate lipsi (dacă migrarea nu a fost rulată): pagina merge pe clasa a 7-a */
  var started = false;
  var begin = function () { if (started) return; started = true; start(); };
  function whenRoot(cb) {
    var tries = 0;
    (function look() {
      root = document.getElementById('ppRoot');
      if (root) return cb();
      if (tries++ < 200) requestAnimationFrame(look);
    })();
  }
  whenRoot(function () {
    if (window._bmAuthReady) begin(); else document.addEventListener('bmauth:ready', begin, { once: true });
    setTimeout(begin, 2500);
  });
})();
