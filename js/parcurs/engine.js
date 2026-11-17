/* ============================================================
   Parcurs: lecția de pe ecran (lectie.html?l=<id>). Un exercițiu pe ecran, explicație înainte de exerciții (lecția 1 a fiecărui cerculeț),
   indiciu la cerere, greșelile revin la final, 10 XP din prima și 5 la a doua încercare, mici animații la fiecare pas.
   Tipuri de exerciții: mc, num, multi, order, bug, match, axis, bar (vezi gens.js).
   Conținutul vine din js/parcurs/content7.js, desenele din visuals.js, progresul din progress.js.
   ============================================================ */
(function () {
  'use strict';
  var PM = window.PM, PV = window.PV, C = window.PCONTENT, Prog = window.Parcurs;
  var m = PM.m, h = PV.h;
  var $ = function (s) { return document.querySelector(s); };
  var reduce = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var themeOf = function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; };

  var main = $('#lzMain'), foot = $('#lzFoot'), go = $('#lzGo'), skip = $('#lzSkip'), hintBtn = $('#lzHint');
  var fb = $('#lzFb'), fbT = $('#lzFbTitle'), fbX = $('#lzFbText'), bar = $('#lzBar'), xpEl = $('#lzXp'), prog = $('#lzProg'), combo = $('#lzCombo');

  var OKT = ['Corect!', 'Bravo!', 'Exact!', 'Foarte bine!', 'Perfect!'];
  var NOT = ['Nu chiar.', 'Aproape!', 'Hai să vedem.'];

  var owls = [], fbOwl = null;
  function owl(host, mood, look) {
    if (!window.TeoremaMascot || !host) return null;
    try { var o = new window.TeoremaMascot.Mascot(host, { mood: mood, theme: themeOf(), look: look || {} }); owls.push(o); return o; } catch (e) { return null; }
  }
  function dropOwls() { owls.forEach(function (o) { try { window.TeoremaMascot.dispose(o); } catch (e) { /* gone */ } }); owls = []; }

  var node, L, steps, queue, cur, step, ctl, total, doneCount, xp, firstOk, tries, hinted, started, phase, learnPage, streak, bestStreak, wrongTaps;
  var replay = false;

  /* ---------- pornire ---------- */
  var params = new URLSearchParams(location.search), lessonId = params.get('l') || '';

  function currentId() {
    var f = C.flat(), i;
    for (i = 0; i < f.length; i++) if (!Prog.isDone(f[i].id)) return f[i].id;
    return null;
  }
  function allowed(id) {
    if (/\.skip$/.test(id)) { var sec = id.replace(/\.skip$/, '.test'); return !Prog.isDone(sec); }
    return Prog.isDone(id) || id === currentId();
  }

  function boot() {
    if (!C.build(lessonId, PM.rng(1))) { location.replace('parcurs.html'); return; }
    var done = false;
    var go_ = function () { if (done) return; done = true; whenRole(begin); };
    /* întâi contul (progresul se ține pe cont), apoi progresul din baza de date */
    var afterAuth = function () { Prog.ready().then(go_, go_); };
    if (window._bmAuthReady) afterAuth(); else document.addEventListener('bmauth:ready', afterAuth, { once: true });
    setTimeout(go_, 3500);
  }

  /* exercițiile văzute de elev în ultimele lecții (cheie scurtă pe cont, în browser): lecția nouă încearcă să nu le repete */
  function seenMemory() {
    var uid = (window.BMAuth && BMAuth.user && BMAuth.user.id) || 'anon', KEY = 'bm_parcurs_seen_v1_' + uid, arr = [], set = {};
    try { arr = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { arr = []; }
    arr.forEach(function (k) { set[k] = 1; });
    var hash = function (str) { var h = 5381, i; for (i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
    return {
      has: function (k) { return !!set[hash(k)]; },
      add: function (k) {
        var x = hash(k); if (set[x]) return; set[x] = 1; arr.push(x);
        if (arr.length > 260) arr.splice(0, arr.length - 260);
        try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) { /* ignore */ }
      }
    };
  }

  function begin() {
    if (!allowed(lessonId)) { location.replace('parcurs.html'); return; }
    replay = Prog.isDone(lessonId) && !/\.skip$/.test(lessonId);
    L = C.build(lessonId, PM.rng(), seenMemory());
    /* doar pentru verificări: ?g=cmp:1 înlocuiește exercițiile cu 7 din același generator (nivelul după două puncte) */
    var forced = params.get('g');
    if (forced && window.PG && window.PG.G[forced.split(':')[0]]) {
      var fg = forced.split(':'), R0 = PM.rng(), lv = +(fg[1] || 0);
      L.exercises = [];
      for (var q = 0; q < 7; q++) { var sp0 = window.PG.G[fg[0]](R0, lv); sp0.rar = lv; sp0.gen = fg[0]; L.exercises.push(sp0); }
      L.learn = null;
    }
    steps = [];
    if (L.learn) steps.push({ t: 'learn', pages: L.learn });
    L.exercises.forEach(function (e) { steps.push(e); });
    queue = steps.map(function (_, i) { return i; });
    total = L.exercises.length; doneCount = 0; xp = 0; firstOk = 0; tries = {}; hinted = false; streak = 0; bestStreak = 0; started = Date.now();
    xpEl.textContent = '0'; combo.hidden = true;
    var xpBox = $('.lz-xp'); if (xpBox) xpBox.hidden = noXp();
    document.title = (L.kind === 'lesson' ? L.circle + ' · ' + L.title : L.title) + ' | Teorema';
    setProgress(); next();
  }

  function setProgress() {
    var pct = Math.min(100, Math.round(doneCount / total * 100));
    bar.style.width = pct + '%';
    prog.setAttribute('aria-valuenow', pct);
    if (!reduce()) { bar.classList.remove('pulse'); void bar.offsetWidth; bar.classList.add('pulse'); }
  }

  function swap(build, after) {
    var old = main.firstElementChild;
    var show = function () {
      dropOwls();
      main.innerHTML = '';
      var el = h('section', 'lz-step');
      build(el);
      main.appendChild(el);
      window.scrollTo(0, 0);
      after && after(el);
    };
    if (old && !reduce()) { old.classList.add('out'); setTimeout(show, 190); } else show();
  }
  function setFoot(mode) { foot.className = 'lz-foot' + (mode ? ' ' + mode : ''); }
  function setGo(on) { go.disabled = !on; }

  function next() {
    if (!queue.length) return end();
    cur = queue.shift(); step = steps[cur]; ctl = null; hinted = false; wrongTaps = 0;
    phase = 'answer'; fb.hidden = true; setFoot(null);
    skip.hidden = step.t === 'learn' || L.noRetry;
    hintBtn.hidden = step.t === 'learn' || !step.hint;
    hintBtn.disabled = false; hintBtn.classList.remove('used');
    setGo(step.t === 'learn');
    go.textContent = step.t === 'learn' ? 'Continuă' : 'Verifică';
    if (step.t === 'learn') { learnPage = 0; renderLearn(true); } else renderExercise();
  }

  /* ---------- învață ---------- */
  function visual(pg) {
    if (pg.bar) return PV.barCtl(pg.bar);
    if (pg.bars) return PV.bars(pg.bars);
    if (pg.axis) return PV.axisPick({ min: pg.axis.min, max: pg.axis.max, sub: pg.axis.sub, readout: true, mirror: !!pg.axis.mirror });
    if (pg.sets) return PV.sets(pg.sets);
    if (pg.div) return PV.divSteps(pg.div.n, pg.div.d);
    if (pg.signs) return PV.signs();
    if (pg.jump) return PV.jump(pg.jump);
    if (pg.area) return PV.area(pg.area);
    if (pg.col) return PV.col(pg.col);
    return null;
  }
  function learnCard(pg, idx, n, animate) {
    var card = h('div', 'lz-learn'), dots = '';
    var lo = h('div', 'owl lz-learn__owl'); lo.id = 'lzLearnOwl'; card.appendChild(lo);
    card.appendChild(h('h2', '', m(pg.title)));
    card.appendChild(h('p', '', m(pg.p)));
    var v = visual(pg); if (v) { var box = h('div', 'lz-vis'); box.appendChild(v.el); card.appendChild(box); }
    if (pg.rows) {
      var board = h('div', 'lz-board');
      pg.rows.forEach(function (r, i) {
        var row = h('div', 'lz-row', m(r));
        if (animate) row.style.animationDelay = (150 + i * 170) + 'ms'; else row.style.animation = 'none';
        board.appendChild(row);
      });
      card.appendChild(board);
    }
    for (var i = 0; i < n; i++) dots += '<i' + (i <= idx ? ' class="on"' : '') + '></i>';
    card.appendChild(h('div', 'lz-dots', dots));
    return card;
  }
  function renderLearn(first) {
    var pages = step.pages, pg = pages[learnPage];
    var build = function (el) {
      var meta = h('div', 'lz-meta');
      meta.innerHTML = '<span class="lz-chip">ÎNVAȚĂ</span><span>' + PM.esc(L.grade + ' · ' + L.circle) + '</span>';
      el.appendChild(meta);
      el.appendChild(learnCard(pg, learnPage, pages.length, true));
    };
    var learnOwl = function () { owl($('#lzLearnOwl'), 'idle', lookFor('learn')); };
    if (first) swap(build, learnOwl);
    else {
      var old = main.firstElementChild;
      var show = function () { dropOwls(); main.innerHTML = ''; var el = h('section', 'lz-step'); build(el); main.appendChild(el); window.scrollTo(0, 0); learnOwl(); };
      if (old && !reduce()) { old.classList.add('out'); setTimeout(show, 160); } else show();
    }
    go.textContent = learnPage === pages.length - 1 ? 'Am înțeles' : 'Continuă';
  }

  /* ---------- exerciții ---------- */
  /* bufnița se potrivește cu tipul de cartonaș: citește la explicații, scrie când trebuie să scrii, poartă ochelari când alegi sau cauți */
  /* profesorii, managerii și adminii pot face lecțiile, dar nu primesc XP din ele (XP-ul lor vine din altceva) */
  /* XP și serie primesc DOAR elevii al căror rol e confirmat. Un cont conectat al cărui rol nu a ajuns încă nu primește nimic
     (rolul vine din baza de date, după pornirea paginii; înainte, un profesor era tratat ca elev până atunci). */
  function noXp() {
    var A = window.BMAuth;
    if (!A || !A.user) return false;           // fără cont, lecția merge ca până acum (nu se scrie nimic pe cont)
    return A.role !== 'elev';
  }
  /* așteaptă rolul contului (cel mult 3 secunde), apoi pornește */
  function whenRole(cb) {
    var A = window.BMAuth, fin = false;
    var go = function () { if (fin) return; fin = true; document.removeEventListener('bmauth:profile', go); cb(); };
    if (!A || !A.user || A.role) return go();
    document.addEventListener('bmauth:profile', go);
    setTimeout(go, 3000);
  }
  function lookFor(t) {
    if (t === 'learn') return { book: true, glasses: true };
    if (t === 'num' || t === 'mixed' || t === 'order' || t === 'match' || t === 'axis' || t === 'bar') return { pencil: true };
    return { glasses: true };
  }
  function head(sp) {
    var f = document.createDocumentFragment();
    var meta = h('div', 'lz-meta');
    meta.innerHTML = '<span>' + PM.esc(L.grade + ' · ' + L.circle) + '</span>';
    var ask = h('div', 'lz-ask'), ow = h('div', 'owl'); ow.id = 'lzQ';
    ask.appendChild(ow); ask.appendChild(h('div', 'lz-bubble', m(sp.q)));
    f.appendChild(meta); f.appendChild(ask);
    return f;
  }
  function visOf(sp) {
    if (!sp.vis) return null;
    if (sp.vis.k === 'axis') return PV.axis({ min: sp.vis.min, max: sp.vis.max, sub: sp.vis.sub, pts: sp.vis.pts }).el;
    if (sp.vis.k === 'bar') return PV.bar({ d: sp.vis.d, n: sp.vis.n }).el;
    return null;
  }

  function renderExercise() {
    var sp = step;
    swap(function (el) {
      el.appendChild(head(sp));
      var hintBox = h('div', 'lz-hintbox'); hintBox.id = 'lzHintBox'; hintBox.hidden = true; el.appendChild(hintBox);
      var v = visOf(sp); if (v) { var vb = h('div', 'lz-vis'); vb.appendChild(v); el.appendChild(vb); }
      if (sp.eq) { var eq = h('div', 'lz-eq', m(sp.eq)); eq.id = 'lzEq'; el.appendChild(eq); }
      ctl = BUILD[sp.t](sp, el);
    }, function () { owl($('#lzQ'), step.rar === 2 ? 'think' : 'idle', lookFor(step.t)); setGo(ctl && ctl.canCheck()); if (ctl && ctl.focus) setTimeout(ctl.focus, 420); });
  }

  var BUILD = {};

  BUILD.mc = function (sp, el) {
    var sel = null, box = h('div', 'lz-opts' + (sp.big ? ' big' : '')), btns = [];
    sp.opts.forEach(function (o, i) {
      var b = h('button', 'lz-op', (sp.big ? '' : '<span class="k">' + (i + 1) + '</span>') + '<span class="t">' + m(o) + '</span>'); b.type = 'button'; b.dataset.i = i;
      b.onclick = function () { pick(i); }; box.appendChild(b); btns.push(b);
    });
    el.appendChild(box);
    function pick(i) {
      if (phase !== 'answer') return;
      sel = i; setGo(true);
      btns.forEach(function (b, j) { b.classList.toggle('sel', j === i); });
      if (sp.big) { var bx = $('#lzEq .bx'); if (bx) { bx.textContent = sp.opts[i]; bx.classList.add('has'); PV.pop(bx); } }
      PV.pop(btns[i]);
    }
    return {
      canCheck: function () { return sel != null; },
      isRight: function () { return sel === sp.a; },
      mark: function () { btns.forEach(function (b, i) { b.disabled = true; b.classList.remove('sel'); if (i === sp.a) b.classList.add('ok'); else if (i === sel) b.classList.add('no'); }); },
      key: function (k) { if (/^[1-9]$/.test(k) && +k <= sp.opts.length) pick(+k - 1); },
      okEl: function () { return btns[sp.a]; }
    };
  };

  BUILD.bug = function (sp, el) {
    var sel = null, box = h('div', 'lz-lines'), btns = [];
    sp.lines.forEach(function (l, i) {
      var b = h('button', 'lz-ln', '<i>' + (i + 1) + '</i><span class="t">' + m(l) + '</span>'); b.type = 'button';
      b.onclick = function () { if (phase !== 'answer') return; sel = i; setGo(true); btns.forEach(function (x, j) { x.classList.toggle('sel', j === i); }); PV.pop(b); };
      box.appendChild(b); btns.push(b);
    });
    el.appendChild(box);
    return {
      canCheck: function () { return sel != null; },
      isRight: function () { return sel === sp.bad; },
      mark: function () { btns.forEach(function (b, i) { b.disabled = true; b.classList.remove('sel'); if (i === sp.bad) b.classList.add('ok'); else if (i === sel) b.classList.add('no'); }); },
      key: function (k) { if (/^[1-9]$/.test(k) && +k <= sp.lines.length) btns[+k - 1].click(); },
      okEl: function () { return btns[sp.bad]; }
    };
  };

  BUILD.multi = function (sp, el) {
    var on = {}, box = h('div', 'lz-opts multi' + (sp.opts.length > 5 ? ' grid' : '')), btns = [];
    el.appendChild(h('div', 'lz-note', 'Pot fi mai multe răspunsuri corecte.'));
    sp.opts.forEach(function (o, i) {
      var b = h('button', 'lz-op', '<span class="k"></span><span class="t">' + m(o) + '</span>'); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.onclick = function () {
        if (phase !== 'answer') return; on[i] = !on[i]; b.classList.toggle('sel', !!on[i]); b.setAttribute('aria-pressed', on[i] ? 'true' : 'false');
        b.querySelector('.k').textContent = on[i] ? '✓' : ''; setGo(Object.keys(on).some(function (k) { return on[k]; })); PV.pop(b);
      };
      box.appendChild(b); btns.push(b);
    });
    el.appendChild(box);
    return {
      canCheck: function () { return Object.keys(on).some(function (k) { return on[k]; }); },
      isRight: function () { return sp.opts.every(function (_, i) { return !!on[i] === sp.ans.indexOf(i) >= 0; }); },
      mark: function () { btns.forEach(function (b, i) { b.disabled = true; b.classList.remove('sel'); var good = sp.ans.indexOf(i) >= 0; if (good && on[i]) b.classList.add('ok'); else if (!good && on[i]) b.classList.add('no'); else if (good) b.classList.add('miss'); }); },
      okEl: function () { return btns[sp.ans[0]]; }
    };
  };

  BUILD.order = function (sp, el) {
    var n = sp.tiles.length, ans = [], bankOrder;
    do { bankOrder = []; var pool = sp.tiles.map(function (_, i) { return i; }); while (pool.length) bankOrder.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); }
    while (n > 1 && bankOrder.every(function (v, i) { return v === i; }));
    var A = h('div', 'lz-ans' + (sp.tiles.every(function (t) { return PM.plain(t).length <= 9; }) ? ' row' : '')), B = h('div', 'lz-bank');
    el.appendChild(A); el.appendChild(B);
    function draw() {
      A.innerHTML = ''; B.innerHTML = '';
      ans.forEach(function (ti, pos) {
        var b = h('button', 'lz-tile', m(sp.tiles[ti])); b.type = 'button'; b.dataset.pos = pos;
        b.onclick = function () { if (phase !== 'answer') return; ans.splice(pos, 1); draw(); };
        A.appendChild(b);
      });
      bankOrder.forEach(function (ti) {
        var used = ans.indexOf(ti) >= 0, b = h('button', 'lz-tile' + (used ? ' used' : ''), m(sp.tiles[ti])); b.type = 'button'; b.disabled = used;
        b.onclick = function () { if (phase !== 'answer' || used) return; ans.push(ti); draw(); var last = A.lastElementChild; if (last) PV.pop(last); };
        B.appendChild(b);
      });
      setGo(ans.length === n);
    }
    draw();
    return {
      canCheck: function () { return ans.length === n; },
      isRight: function () { return ans.every(function (v, i) { return v === i; }); },
      mark: function () { A.querySelectorAll('.lz-tile').forEach(function (b, pos) { b.disabled = true; b.classList.add(ans[pos] === pos ? 'ok' : 'no'); }); },
      okEl: function () { return A; }
    };
  };

  /* răspuns de tip fracție: chiar forma fracției, cu două casete goale (sus și jos) pe care elevul le completează pe rând */
  BUILD.frac = function (sp, el) {
    var wrap = h('div', 'lz-num lz-frac'), msg = h('div', 'lz-msg');
    var col = h('div', 'lz-fcol'), top = h('input', 'lz-fin'), line = h('i', 'lz-fbar'), bot = h('input', 'lz-fin');
    [top, bot].forEach(function (i, k) {
      i.type = 'text'; i.maxLength = 7; i.autocomplete = 'off'; i.spellcheck = false;
      /* sus poate fi și minus (tastatura completă pe telefon), jos doar cifre */
      i.setAttribute('inputmode', k ? 'numeric' : 'text'); i.setAttribute('enterkeyhint', k ? 'done' : 'next');
      i.setAttribute('aria-label', k ? 'Numitorul' : 'Numărătorul');
      i.addEventListener('input', function () {
        var v = i.value.replace(/[−–]/g, '-');
        i.value = (k === 0 && v.charAt(0) === '-' ? '-' : '') + v.replace(/[^0-9]/g, '');
        refresh();
      });
      i.addEventListener('focus', function () { try { i.select(); } catch (e) { /* ignore */ } });
    });
    top.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); bot.focus(); } });
    bot.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') { e.preventDefault(); top.focus(); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (!go.disabled) go.click(); else if (!top.value) top.focus(); }
    });
    col.appendChild(top); col.appendChild(line); col.appendChild(bot);
    wrap.appendChild(col); wrap.appendChild(msg); el.appendChild(wrap);
    function filled() { return /^-?\d+$/.test(top.value) && bot.value !== ''; }
    function refresh() { setGo(filled()); msg.textContent = ''; top.classList.remove('bad'); bot.classList.remove('bad'); }
    function bad(t, which) {
      msg.textContent = t; which.classList.add('bad'); which.classList.remove('shake'); void which.offsetWidth; which.classList.add('shake');
      return null;
    }
    return {
      canCheck: filled,
      isRight: function () {
        if (+bot.value === 0) return bad('Numitorul nu poate fi 0.', bot);
        var p = PM.parseAnswer(top.value + '/' + bot.value);
        if (!p) return bad('Completează numărătorul și numitorul cu numere întregi.', top);
        var right = PM.eq(p.f, sp.a);
        if (right && sp.reduced && !p.reduced) return bad('Valoarea e bună, dar fracția se mai poate simplifica. Simplific-o până la capăt.', top);
        return right;
      },
      mark: function (right) {
        [top, bot].forEach(function (i) { i.readOnly = true; i.classList.add(right ? 'ok' : 'no'); }); line.classList.add(right ? 'ok' : 'no');
      },
      focus: function () { try { top.focus({ preventScroll: true }); } catch (e) { top.focus(); } },
      okEl: function () { return col; },
      answerText: function () { return PM.fmtF(sp.a); }
    };
  };

  /* răspuns ca număr mixt: o casetă pentru întregi (poate avea minus) și fracția, cu două casete, alături */
  BUILD.mixed = function (sp, el) {
    var wrap = h('div', 'lz-num lz-mixed'), msg = h('div', 'lz-msg'), row = h('div', 'lz-mrow');
    var whole = h('input', 'lz-fin lz-fwhole'), col = h('div', 'lz-fcol'), top = h('input', 'lz-fin'), line = h('i', 'lz-fbar'), bot = h('input', 'lz-fin');
    var ins = [whole, top, bot], names = ['Întregii', 'Numărătorul', 'Numitorul'];
    ins.forEach(function (i, k) {
      i.type = 'text'; i.maxLength = 7; i.autocomplete = 'off'; i.spellcheck = false;
      i.setAttribute('inputmode', k === 0 ? 'text' : 'numeric'); i.setAttribute('enterkeyhint', k === 2 ? 'done' : 'next'); i.setAttribute('aria-label', names[k]);
      i.addEventListener('input', function () {
        var v = i.value.replace(/[−–]/g, '-');
        i.value = (k === 0 && v.charAt(0) === '-' ? '-' : '') + v.replace(/[^0-9]/g, '');
        refresh();
      });
      i.addEventListener('focus', function () { try { i.select(); } catch (e) { /* ignore */ } });
      i.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); if (k < 2) ins[k + 1].focus(); else if (!go.disabled) go.click(); }
        else if (e.key === 'ArrowDown' && k === 1) { e.preventDefault(); bot.focus(); }
        else if (e.key === 'ArrowUp' && k === 2) { e.preventDefault(); top.focus(); }
      });
    });
    col.appendChild(top); col.appendChild(line); col.appendChild(bot);
    row.appendChild(whole); row.appendChild(col); wrap.appendChild(row); wrap.appendChild(msg); el.appendChild(wrap);
    function filled() { return /^-?\d+$/.test(whole.value) && /^\d+$/.test(top.value) && /^\d+$/.test(bot.value); }
    function refresh() { setGo(filled()); msg.textContent = ''; ins.forEach(function (i) { i.classList.remove('bad'); }); }
    function bad(t, which) { msg.textContent = t; which.classList.add('bad'); which.classList.remove('shake'); void which.offsetWidth; which.classList.add('shake'); return null; }
    return {
      canCheck: filled,
      isRight: function () {
        var w = parseInt(whole.value, 10), n = parseInt(top.value, 10), d = parseInt(bot.value, 10);
        if (d === 0) return bad('Numitorul nu poate fi 0.', bot);
        if (n >= d) return bad('La un număr mixt, fracția trebuie să fie subunitară: numărătorul mai mic decât numitorul.', top);
        return w === sp.a.w && n === sp.a.n && d === sp.a.d;
      },
      mark: function (right) { ins.forEach(function (i) { i.readOnly = true; i.classList.add(right ? 'ok' : 'no'); }); line.classList.add(right ? 'ok' : 'no'); },
      focus: function () { try { whole.focus({ preventScroll: true }); } catch (e) { whole.focus(); } },
      okEl: function () { return row; },
      answerText: function () { return (sp.a.w < 0 ? '−' : '') + Math.abs(sp.a.w) + '{' + sp.a.n + '/' + sp.a.d + '}'; }
    };
  };

  BUILD.num = function (sp, el) {
    if (sp.form === 'frac') return BUILD.frac(sp, el);
    var wrap = h('div', 'lz-num'), row = h('div', 'lz-num-row'), inp = h('input', 'lz-inp'), keys = h('div', 'lz-keys'), msg = h('div', 'lz-msg');
    inp.type = 'text'; inp.id = 'lzInp'; inp.setAttribute('inputmode', 'text'); inp.setAttribute('enterkeyhint', 'done'); inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false;
    inp.setAttribute('aria-label', 'Răspunsul tău');
    var sym = { int: [], dec: [','], frac: ['/'], per: [',', '(', ')'], any: [',', '/'] }[sp.form || 'any'] || [];
    sym.forEach(function (c) {
      var k = h('button', 'lz-key', c); k.type = 'button'; k.setAttribute('aria-label', { '−': 'minus', ',': 'virgulă', '/': 'linie de fracție', '(': 'paranteză deschisă', ')': 'paranteză închisă' }[c]);
      k.onmousedown = function (e) { e.preventDefault(); };
      k.onclick = function () { if (phase !== 'answer') return; var s = inp.selectionStart == null ? inp.value.length : inp.selectionStart, e2 = inp.selectionEnd == null ? s : inp.selectionEnd; inp.value = inp.value.slice(0, s) + c + inp.value.slice(e2); inp.setSelectionRange(s + 1, s + 1); inp.focus(); inp.oninput(); PV.pop(k); };
      keys.appendChild(k);
    });
    row.appendChild(inp);
    if (sp.unit) row.appendChild(h('span', 'lz-unit', PM.esc(sp.unit)));
    if (sym.length) wrap.appendChild(keys); wrap.appendChild(row); wrap.appendChild(msg); el.appendChild(wrap);
    inp.oninput = function () { setGo(inp.value.trim() !== ''); msg.textContent = ''; inp.classList.remove('bad'); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); if (!go.disabled) go.click(); } };
    function verdict() {
      var p = PM.parseAnswer(inp.value), f = sp.form || 'any';
      if (!p) return { bad: 'Scrie un număr, de exemplu 3/4 sau 0,75.' };
      if (f === 'int' && p.kind !== 'int') return { bad: 'Scrie rezultatul ca număr întreg.' };
      if (f === 'dec' && p.kind !== 'int' && p.kind !== 'dec') return { bad: 'Scrie rezultatul ca număr zecimal, cu virgulă.' };
      if (f === 'per' && p.kind === 'frac') return { bad: 'Scrie rezultatul ca zecimală periodică, de exemplu 0,(3).' };
      if (f === 'frac' && (p.kind === 'dec' || p.kind === 'per')) return { bad: 'Scrie rezultatul ca fracție, de exemplu 3/4.' };
      var right = PM.eq(p.f, sp.a);
      if (right && f === 'frac' && sp.reduced && p.kind === 'frac' && !p.reduced) return { bad: 'Valoarea e bună, dar fracția se mai poate simplifica. Simplific-o până la capăt.' };
      return { right: right };
    }
    return {
      canCheck: function () { return inp.value.trim() !== ''; },
      isRight: function () { var v = verdict(); if (v.bad) { msg.textContent = v.bad; inp.classList.add('bad'); inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); return null; } return v.right; },
      mark: function (right) { inp.readOnly = true; inp.classList.add(right ? 'ok' : 'no'); keys.classList.add('off'); },
      focus: function () { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } },
      okEl: function () { return inp; },
      answerText: function () { var a = sp.a, f = sp.form; return f === 'dec' || f === 'per' ? PM.fmtDec(a) : PM.fmtF(a); }
    };
  };

  BUILD.axis = function (sp, el) {
    var pk = PV.axisPick({ min: sp.min, max: sp.max, sub: sp.sub, start: sp.start, onchange: function () { setGo(true); } });
    var box = h('div', 'lz-vis'); box.appendChild(pk.el); el.appendChild(box);
    return {
      canCheck: function () { return pk.moved(); },
      isRight: function () { return PM.eq(pk.get(), sp.target); },
      mark: function (right) { pk.lock(right, sp.target); },
      okEl: function () { return pk.el; }
    };
  };

  BUILD.bar = function (sp, el) {
    var b = PV.bar({ d: sp.d, n: 0, toggle: true, onchange: function (n) { setGo(n > 0); } });
    var box = h('div', 'lz-vis'); box.appendChild(b.el); el.appendChild(box);
    el.appendChild(h('div', 'lz-note', 'Atinge părțile pe care vrei să le colorezi.'));
    return {
      canCheck: function () { return b.get() > 0; },
      isRight: function () { return b.get() === sp.n; },
      mark: function (right) { b.lock(right, sp.n); },
      okEl: function () { return b.el; }
    };
  };

  BUILD.match = function (sp, el) {
    var L_ = sp.pairs.map(function (p, i) { return { i: i, t: p[0] }; }), R_ = sp.pairs.map(function (p, i) { return { i: i, t: p[1] }; });
    R_.sort(function () { return Math.random() - 0.5; });
    var lsel = null, matched = {}, mistakes = 0, wrap = h('div', 'lz-match'), cl = h('div', 'col'), cr = h('div', 'col'), lb = [], rb = [];
    el.appendChild(h('div', 'lz-note', 'Atinge un număr din stânga, apoi perechea lui din dreapta.'));
    L_.forEach(function (x) { var b = h('button', 'lz-tile', m(x.t)); b.type = 'button'; b.onclick = function () { pickL(x.i); }; cl.appendChild(b); lb[x.i] = b; });
    R_.forEach(function (x) { var b = h('button', 'lz-tile', m(x.t)); b.type = 'button'; b.onclick = function () { pickR(x.i, b); }; cr.appendChild(b); rb[x.i] = b; });
    wrap.appendChild(cl); wrap.appendChild(cr); el.appendChild(wrap);
    function pickL(i) { if (phase !== 'answer' || matched[i]) return; lsel = i; lb.forEach(function (b, j) { b.classList.toggle('sel', j === i); }); PV.pop(lb[i]); }
    function pickR(i, b) {
      if (phase !== 'answer' || matched['r' + i] || lsel == null) return;
      if (i === lsel) {
        matched[i] = matched['r' + i] = true; lb[i].classList.remove('sel'); lb[i].classList.add('ok'); b.classList.add('ok'); lb[i].disabled = b.disabled = true; lsel = null; PV.pop(b);
        if (Object.keys(matched).length === sp.pairs.length * 2) { wrongTaps = mistakes; setGo(true); setTimeout(function () { if (phase === 'answer') go.click(); }, 450); }
      } else {
        mistakes++; b.classList.add('no'); lb[lsel].classList.add('no');
        var a = lb[lsel]; setTimeout(function () { a.classList.remove('no'); b.classList.remove('no'); }, 380);
        [a, b].forEach(function (x) { x.classList.remove('shake'); void x.offsetWidth; x.classList.add('shake'); });
      }
    }
    return {
      canCheck: function () { return Object.keys(matched).length === sp.pairs.length * 2; },
      isRight: function () { return mistakes === 0; },
      mark: function () { /* perechile sunt deja colorate */ },
      okEl: function () { return wrap; },
      extra: function () { return mistakes ? 'Ai încercat greșit de ' + mistakes + (mistakes === 1 ? ' dată' : ' ori') + ', așa că o mai facem o dată la final.' : ''; }
    };
  };

  /* ---------- verificare ---------- */
  function check(giveUp) {
    if (phase !== 'answer' || !ctl) return;
    var right = false;
    if (!giveUp) {
      right = ctl.isRight();
      if (right === null) return;                    /* răspuns scris greșit ca formă: nu se numără */
    }
    phase = 'feedback';
    ctl.mark(right);
    hintBtn.disabled = true;
    var firstTime = !tries[cur];
    tries[cur] = (tries[cur] || 0) + 1;
    if (right) {
      var gain = firstTime && !hinted ? 10 : 5;
      if (L.kind !== 'skip' && !noXp()) xp += gain;
      if (firstTime && !hinted) firstOk++;
      streak++; bestStreak = Math.max(bestStreak, streak);
      doneCount++; setProgress();
      xpEl.textContent = String(xp);
      if (L.kind !== 'skip' && !noXp()) { var x = $('.lz-xp'); x.classList.remove('bump'); void x.offsetWidth; x.classList.add('bump'); floatXp('+' + gain); }
      if (streak >= 3) { combo.hidden = false; combo.querySelector('b').textContent = streak; PV.pop(combo); }
      sparks(ctl.okEl && ctl.okEl());
      if (window.BMSfx) window.BMSfx.play('correct');
      streakShow(streak);
    } else {
      streak = 0; combo.hidden = true;
      if (!L.noRetry) { queue.push(cur); total++; setProgress(); }
      else { doneCount++; setProgress(); }
      var st = main.firstElementChild; if (st) { st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake'); }
    }
    if (L.noRetry && !right) wrongCount_++;
    showFeedback(right, giveUp);
  }
  var wrongCount_ = 0;

  /* 3, 5, 7, 10... corecte la rând: bufnița cu flacără pe tot ecranul, câteva secunde, apoi lecția merge mai departe */
  var STREAK_AT = { 3: 'corecte la rând!', 5: 'la rând! Ești în formă!', 7: 'la rând! Ești în flăcări!', 10: 'la rând! Neoprit!', 15: 'la rând! Incredibil!', 20: 'la rând! Maestru!' };
  function streakShow(n) {
    if (!STREAK_AT[n]) return;
    setTimeout(function () { streakNow(n); }, reduce() ? 500 : 950);   /* întâi se vede răspunsul corect, apoi vine animația */
  }
  function streakNow(n) {
    if (document.querySelector('.lz-streak') || document.body.classList.contains('lz-ended')) return;
    var ov = h('div', 'lz-streak'), ow = h('div', 'owl lz-streak__owl');
    ov.setAttribute('role', 'status');
    ov.appendChild(ow);
    ov.appendChild(h('b', '', String(n)));
    ov.appendChild(h('h2', '', n === 3 ? '3 corecte la rând!' : n + ' ' + STREAK_AT[n]));
    document.body.appendChild(ov);
    var o = owl(ow, 'streak');
    var gone = false, end = function () {
      if (gone) return; gone = true;
      ov.classList.add('out');
      setTimeout(function () { try { if (o) window.TeoremaMascot.dispose(o); } catch (e) { /* gone */ } ov.remove(); }, reduce() ? 0 : 320);
    };
    ov.onclick = end;
    setTimeout(end, reduce() ? 1300 : 2100);
  }

  function showFeedback(right, giveUp) {
    setFoot(right ? 'ok' : 'no');
    skip.hidden = true; hintBtn.hidden = true;
    fb.hidden = false;
    fbT.textContent = right ? (streak >= 3 && streak % 3 === 0 ? 'Serie de ' + streak + '!' : OKT[Math.floor(Math.random() * OKT.length)]) : (giveUp ? 'Nu-i nimic.' : NOT[Math.floor(Math.random() * NOT.length)]);
    var txt = step.why || '', html = '';
    if (!right) {
      if (ctl.answerText) html += '<span class="lz-fb__ans">Răspunsul corect<b>' + m(ctl.answerText()) + '</b></span>';
      if (ctl.extra && ctl.extra()) html += '<span class="lz-fb__why"><span class="ln">' + m(ctl.extra()) + '</span></span>';
    }
    /* explicația, o frază pe rând; un rând care e doar calcul (începe cu o fracție sau o cifră) se vede mai mare */
    var parts = txt.split(/(?<=[.!?])\s+/).filter(function (x) { return x.trim(); });
    if (parts.length) html += '<span class="lz-fb__why">' + parts.map(function (x) { var calc = /^[{\d−-]/.test(x); return '<span class="ln' + (calc ? ' calc' : '') + '">' + m(calc ? x.replace(/\.$/, '') : x) + '</span>'; }).join('') + '</span>';
    if (!right && !L.noRetry && !(ctl.extra && ctl.extra())) html += '<span class="lz-fb__again">O mai încercăm la final.</span>';
    fbX.innerHTML = html;
    var host = $('#lzFbOwl'); host.innerHTML = '';
    if (fbOwl) { try { window.TeoremaMascot.dispose(fbOwl); } catch (e) { /* gone */ } }
    fbOwl = owl(host, right ? 'happy' : 'wrong');
    setGo(true);
    go.textContent = 'Continuă';
  }

  /* ---------- mici efecte ---------- */
  function sparks(target) {
    if (reduce() || !target || !target.getBoundingClientRect || !target.animate) return;
    var r = target.getBoundingClientRect(), cx = r.left + Math.min(r.width, 160) * 0.5 + (r.width > 160 ? 0 : 0), cy = r.top + r.height / 2;
    for (var i = 0; i < 12; i++) {
      var s = document.createElement('i'); s.className = 'lz-spark' + (i % 3 === 0 ? ' v' : '');
      s.style.left = (r.left + r.width * (0.15 + 0.7 * Math.random())) + 'px'; s.style.top = cy + 'px'; document.body.appendChild(s);
      var ang = (-Math.PI / 2) + (Math.random() - 0.5) * 2.3, dist = 40 + Math.random() * 60;
      s.animate([{ transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }, { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + (Math.sin(ang) * dist - 10) + 'px) scale(.2) rotate(' + (Math.random() * 180) + 'deg)', opacity: 0 }], { duration: 520 + Math.random() * 260, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = (function (e) { return function () { e.remove(); }; })(s);
    }
  }
  function floatXp(txt) {
    if (reduce()) return;
    var x = $('.lz-xp'), r = x.getBoundingClientRect(), f = document.createElement('span');
    f.className = 'lz-float'; f.textContent = txt; f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.bottom) + 'px'; document.body.appendChild(f);
    f.animate([{ transform: 'translate(-50%,0)', opacity: 0 }, { transform: 'translate(-50%,10px)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,34px)', opacity: 0 }], { duration: 900, easing: 'ease-out' }).onfinish = function () { f.remove(); };
  }

  /* ---------- indiciu ---------- */
  hintBtn.onclick = function () {
    if (phase !== 'answer' || !step || !step.hint) return;
    var box = $('#lzHintBox'); if (!box) return;
    box.innerHTML = '<b>Indiciu</b> ' + m(step.hint); box.hidden = false; hinted = true; hintBtn.classList.add('used');
    PV.pop(box);
  };

  /* ---------- final ---------- */
  function countUp(el, to, ms, prefix) {
    if (reduce() || to <= 0) { el.textContent = (prefix || '') + to; return; }
    var t0 = performance.now();
    (function tick(t) { var p = Math.min(1, (t - t0) / ms); el.textContent = (prefix || '') + Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0);
  }
  function end() {
    foot.style.display = 'none';
    document.body.classList.add('lz-ended');
    bar.style.width = '100%';
    combo.hidden = true;
    var sec = Math.round((Date.now() - started) / 1000), mm = Math.floor(sec / 60), ss = ('0' + (sec % 60)).slice(-2);
    var exN = L.exercises.length, pct = Math.round(firstOk / exN * 100);
    if (L.kind === 'skip') return endSkip(exN, pct);
    var res = Prog.complete(L.id, { pct: pct, xp: noXp() ? 0 : xp }), awarded = res.first ? res.xpGiven : 0;
    if (awarded > 0 && window.BM && BM.Training && BM.Training.addXp) { try { BM.Training.addXp(awarded); } catch (e) { /* ignore */ } }
    /* Seria crește doar din lecții (elevi); prima lecție a zilei o face să crească și arată ecranul cu flacăra. */
    var streakBefore = 0, streakBumped = false;
    try {
      if (!noXp() && window.BM && BM.Storage && BM.Storage.updateStreak) {
        streakBefore = BM.Storage.getStreak().count;
        streakBumped = !!BM.Storage.updateStreak();
        if (streakBumped) document.dispatchEvent(new CustomEvent('bmauth:streak-updated'));
      }
    } catch (e) { /* ignore */ }
    try { sessionStorage.setItem('parcurs_celebrate', L.id); } catch (e) { /* ignore */ }

    var node_ = C.findNode(L.id), circle = node_ && node_.circle, doneIn = circle ? circle.lessons.filter(function (l) { return Prog.isDone(l.id); }).length : 0;
    var circleDone = circle && doneIn === circle.lessons.length, sectionDone = L.kind === 'test';
    var title = sectionDone ? 'Secțiune terminată!' : circleDone ? 'Cerculeț terminat!' : L.kind === 'lesson' ? 'Lecție terminată!' : 'Gata!';
    var lead = sectionDone ? 'Ai trecut testul secțiunii. Următoarea secțiune se deschide.' : circleDone ? 'Ai terminat toate cele 4 lecții din „' + L.circle + '”. Următorul cerculeț e deblocat.' : pct === 100 ? 'Nicio greșeală din prima. Excelent!' : 'Greșelile au revenit la final și le-ai corectat.';
    swap(function (el) {
      el.className = 'lz-step lz-end lz-done';
      var stage = h('div', 'lz-stage'); var o = h('div', 'owl'); o.id = 'lzEndOwl'; stage.appendChild(o); stage.appendChild(h('i', 'lz-floor')); el.appendChild(stage);
      var t = h('h1', 'lz-done__t', sectionDone ? 'Secțiune completă!' : circleDone ? 'Cerculeț complet!' : L.kind === 'lesson' ? 'Lecție completă!' : 'Gata!');
      el.appendChild(t);
      el.appendChild(h('p', '', PM.esc(lead)));
      var tag = pct === 100 ? 'Perfect!' : pct >= 80 ? 'Bravo!' : 'Corecte';
      var st = h('div', 'lz-sc2');
      st.innerHTML = '<div class="lz-sc lz-sc--xp"><em>XP total</em><div><img src="assets/images/gamification/xp-mini.svg" alt="" width="30" height="30"><b id="lzSXp">0</b></div></div>' +
        '<div class="lz-sc lz-sc--ok"><em>' + tag + '</em><div><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><circle cx="15" cy="17" r="11" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="15" cy="17" r="6" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="15" cy="17" r="2" fill="currentColor"/><path d="M15 17 L26 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M22 4 L28 4 L28 10 Z" fill="currentColor"/></svg><b id="lzSPct">0%</b></div></div>';
      el.appendChild(st);
      if (noXp() || replay) el.appendChild(h('p', 'lz-note', noXp() ? 'Contul tău nu primește XP din lecții.' : 'Ai mai făcut lecția aceasta, de aceea nu primești XP din nou.'));
      if (circle) {
        var pips = '', i;
        for (i = 0; i < circle.lessons.length; i++) pips += '<i class="' + (i < doneIn ? 'on' : '') + (i === doneIn - 1 && !replay ? ' new' : '') + '"></i>';
        var sk = h('div', 'lz-skill'); sk.innerHTML = '<div><b>' + PM.esc(circle.title) + '</b><span>Lecția ' + doneIn + ' din ' + circle.lessons.length + (circleDone ? ' · terminat' : '') + '</span><div class="lz-pips">' + pips + '</div></div>';
        el.appendChild(sk);
      }
      var again = h('button', 'lz-link', 'Mai exersează o dată'); again.type = 'button'; again.onclick = function () { location.reload(); };
      var cont = h('button', 'lz-go lz-end-go', 'Continuă'); cont.type = 'button'; cont.id = 'lzDone';
      cont.onclick = function () { if (streakBumped) showStreak(streakBefore); else location.href = 'parcurs.html'; };
      el.appendChild(cont); el.appendChild(again);
    }, function () {
      owl($('#lzEndOwl'), 'happy');
      var xpTo = (replay || noXp()) ? 0 : (+awarded || 0);
      var t0 = performance.now();
      (function tick(t) {
        var p = Math.max(0, Math.min(1, (t - t0) / 900)), k = reduce() ? 1 : 1 - Math.pow(1 - p, 3), e = $('#lzSPct'), x = $('#lzSXp');
        if (!e || !x) return;
        e.textContent = (Math.round(pct * k) || 0) + '%'; x.textContent = String(Math.round(xpTo * k) || 0);
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
      var big = $('#lzEndOwl'); if (!reduce()) { for (var i = 0; i < 18; i++) setTimeout(function () { sparks(big); }, i * 60); }
    });
  }

  /* ---------- ecranul seriei (prima lecție a zilei) ---------- */
  function showStreak(before) {
    var info = BM.Storage.getStreakInfo(), n = info.count;
    var names = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
    /* ultimele 7 zile, azi în dreapta: se vede de când a pornit seria */
    var now = new Date(), week = '', i, d, iso;
    for (i = 6; i >= 0; i--) {
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); iso = BM.Storage.isoDate(d);
      var on = info.days.indexOf(iso) !== -1, isToday = i === 0;
      week += '<div class="lz-wd' + (on ? ' on' : '') + (isToday ? ' today' : '') + '"><span>' + (isToday ? 'Azi' : names[(d.getDay() + 6) % 7]) + '</span><i>' + (on ? '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M4.5 10.5 8.5 14.5 15.5 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') + '</i></div>';
    }
    swap(function (el) {
      el.className = 'lz-step lz-end lz-streakp';
      var fl = h('div', 'lz-fl'); fl.innerHTML = '<span class="lz-fl__glow"></span><img src="assets/images/gamification/streak.svg" alt="" width="170" height="170">'; el.appendChild(fl);
      var num = h('div', 'lz-sn'); num.setAttribute('aria-live', 'polite'); num.innerHTML = '<b id="lzSn">' + (reduce() ? n : before) + '</b>'; el.appendChild(num);
      el.appendChild(h('div', 'lz-sl', n === 1 ? 'prima zi din serie' : n + ' zile în serie'));
      var card = h('div', 'lz-wk'); card.innerHTML = '<div class="lz-wk__days">' + week + '</div><p>Exersează zilnic, altfel ți se va reseta seria!</p>'; el.appendChild(card);
      var cont = h('button', 'lz-go lz-end-go', 'Continuă'); cont.type = 'button'; cont.onclick = function () { location.href = 'parcurs.html'; }; el.appendChild(cont);
    }, function (el) {
      var sn = $('#lzSn'); if (!sn || reduce()) return;
      setTimeout(function () {
        sn.classList.add('roll'); sn.textContent = n;
      }, 650);
    });
  }
  function endSkip(exN, pct) {
    document.body.classList.add('lz-ended');
    var right = exN - wrongCount_, pass = right >= L.passAt;
    var sec = C.findNode(L.id.replace(/\.skip$/, '.test'));
    if (pass && sec) {
      var ids = [];
      sec.section.circles.forEach(function (c) { c.lessons.forEach(function (l) { ids.push(l.id); }); });
      ids.push(sec.id); Prog.skipMany(ids);
      try { sessionStorage.setItem('parcurs_celebrate', sec.id); } catch (e) { /* ignore */ }
    }
    swap(function (el) {
      el.className = 'lz-step lz-end';
      var o = h('div', 'owl'); o.id = 'lzEndOwl'; el.appendChild(o);
      el.appendChild(h('h1', '', pass ? 'Secțiune trecută!' : 'Încă puțin de exersat'));
      el.appendChild(h('p', '', pass ? 'Ai ' + right + ' din ' + exN + ' răspunsuri corecte. Secțiunea „' + PM.esc(sec.section.short) + '” se marchează ca terminată, iar următoarea se deschide.' : 'Ai ' + right + ' din ' + exN + ' răspunsuri corecte; pentru a sări peste secțiune trebuie ' + L.passAt + '. Mergi pas cu pas prin cerculețe și le vei ști pe toate.'));
      var st = h('div', 'lz-stats'); st.innerHTML = '<div><b>' + right + '/' + exN + '</b><span>corecte</span></div>'; el.appendChild(st);
      var cont = h('button', 'lz-go lz-end-go', 'Continuă'); cont.type = 'button'; cont.onclick = function () { location.href = 'parcurs.html'; }; el.appendChild(cont);
    }, function () { owl($('#lzEndOwl'), pass ? 'happy' : 'wrong'); if (pass && !reduce()) { var big = $('#lzEndOwl'); for (var i = 0; i < 14; i++) setTimeout(function () { sparks(big); }, i * 60); } });
  }

  /* ---------- comenzi ---------- */
  go.onclick = function () {
    if (go.disabled) return;
    if (step.t === 'learn') {
      if (learnPage < step.pages.length - 1) { learnPage++; renderLearn(false); return; }
      return advance();
    }
    if (phase === 'answer') check(false); else advance();
  };
  skip.onclick = function () { if (phase === 'answer' && step.t !== 'learn') check(true); };
  function advance() { var st = main.firstElementChild; if (st && !reduce()) st.classList.add('out'); setTimeout(next, reduce() ? 0 : 200); }

  /* ieșire cu confirmare */
  var dlg = null;
  function exitAsk() {
    if (dlg) return;
    var started_ = doneCount > 0 || (step && step.t === 'learn' && learnPage > 0);
    if (!started_ || !$('#lzFoot') || foot.style.display === 'none') { location.href = 'parcurs.html'; return; }
    dlg = h('div', 'lz-dlg'); dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', 'Ieși din lecție?');
    dlg.innerHTML = '<div class="lz-dlg__card"><div class="owl" id="lzDlgOwl"></div><h2>Ieși din lecție?</h2><p>Pierzi progresul acestei lecții. XP-ul câștigat până acum nu se salvează.</p><div class="lz-dlg__act"><button type="button" class="lz-go" id="lzStay">Rămân</button><button type="button" class="lz-out" id="lzLeave">Ies</button></div></div>';
    document.body.appendChild(dlg);
    requestAnimationFrame(function () { dlg && dlg.classList.add('on'); });
    owl($('#lzDlgOwl'), 'wrong');
    $('#lzStay').onclick = closeDlg; $('#lzLeave').onclick = function () { location.href = 'parcurs.html'; };
    $('#lzStay').focus();
  }
  function closeDlg() { if (!dlg) return; var d = dlg; dlg = null; d.classList.remove('on'); setTimeout(function () { d.remove(); }, 220); }
  $('#lzExit').onclick = exitAsk;

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (dlg) closeDlg(); else exitAsk(); return; }
    if (dlg) return;
    if (e.key === 'Enter') { if (!go.disabled && foot.style.display !== 'none' && e.target.tagName !== 'INPUT') { e.preventDefault(); go.click(); } return; }
    if (phase !== 'answer' || !step || !ctl || !ctl.key || e.target.tagName === 'INPUT') return;
    ctl.key(e.key);
  });

  /* pentru verificări automate în browser: citește starea, nu o schimbă */
  window.__plz = { state: function () { return { step: step, phase: phase, ctl: ctl, L: L, queue: queue, xp: xp }; } };

  boot();
})();
