/* ============================================================
   Realizări (2026-11-18): medalii pentru elevi și pentru profesori, în trei trepte (bronz, argint, aur).
   Nimic nu se salvează separat: treptele se calculează din ce face deja omul pe platformă (serie, exerciții, lecții, teme, simulări ...
   pentru elev; serie, teme date, simulări create, table pornite, elevi, mesaje, exerciții adăugate pentru profesor), deci cine are deja
   activitate primește imediat medaliile cuvenite. Un singur lucru se ține în browser: ce trepte a văzut deja (ca să apară un mesaj
   "Realizare nouă" doar o dată) și cea mai lungă serie.

   Se desenează în cardul de profil (js/rail.js) și într-o fereastră cu toate medaliile. Medaliile: assets/images/ach/ (scripts/make-ach-icons.py).
   API: BMAch.local(role), BMAch.load(role), BMAch.section(role, stats), BMAch.open(role), BMAch.check(role, stats)
   ============================================================ */
(function () {
  'use strict';
  if (window.BMAch) return;

  var IMG = 'assets/images/ach/';
  var TIER = ['m-lock', 'm-bronze', 'm-silver', 'm-gold'];
  var TIER_NAME = ['blocată', 'bronz', 'argint', 'aur'];
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  /* "1 exercițiu", "5 exerciții", "20 de exerciții" */
  function ro(n, one, many) {
    n = Math.round(n);
    if (n === 1) return '1 ' + one;
    var m = n % 100;
    return n + (m === 0 || m >= 20 ? ' de ' : ' ') + many;
  }

  /* ---- ce se poate câștiga ---- */
  var FAM = {
    elev: [
      { id: 'streak', name: 'Serie', glyph: 'flame', stat: 'streak', crit: function (n) { return 'Fă o serie de ' + ro(n, 'zi', 'zile') + ' la rând'; },
        tiers: [{ n: 3, t: 'Scânteie' }, { n: 7, t: 'Flacără' }, { n: 30, t: 'Foc nestins' }] },
      { id: 'solved', name: 'Rezolvitor', glyph: 'check', stat: 'solved', crit: function (n) { return 'Rezolvă ' + ro(n, 'exercițiu', 'exerciții'); },
        tiers: [{ n: 10, t: 'Primii pași' }, { n: 50, t: 'Pe drumul bun' }, { n: 250, t: 'Maestru al exercițiilor' }] },
      { id: 'lessons', name: 'Explorator', glyph: 'book', stat: 'lessons', crit: function (n) { return 'Termină ' + ro(n, 'lecție', 'lecții') + ' în Învață'; },
        tiers: [{ n: 5, t: 'Curios' }, { n: 25, t: 'Explorator' }, { n: 100, t: 'Cunoscător' }] },
      { id: 'xp', name: 'Fulger', glyph: 'bolt', stat: 'xp', crit: function (n) { return 'Adună ' + n + ' XP'; },
        tiers: [{ n: 100, t: 'Încărcat' }, { n: 1000, t: 'Energie pură' }, { n: 5000, t: 'Fulger' }] },
      { id: 'sims', name: 'Pregătit de examen', glyph: 'watch', stat: 'sims', crit: function (n) { return 'Termină ' + ro(n, 'simulare', 'simulări'); },
        tiers: [{ n: 1, t: 'Prima simulare' }, { n: 3, t: 'Antrenat de examen' }, { n: 10, t: 'Veteran de examen' }] },
      { id: 'grade', name: 'Nota mare', glyph: 'star', stat: 'grade', fmt: 'grade', crit: function (n) { return 'Ia nota ' + n + ' la o simulare'; },
        tiers: [{ n: 7, t: 'Notă bună' }, { n: 9, t: 'Notă mare' }, { n: 10, t: 'Nota 10' }] },
      { id: 'homework', name: 'Temeinic', glyph: 'sheet', stat: 'homework', crit: function (n) { return 'Predă ' + ro(n, 'temă', 'teme'); },
        tiers: [{ n: 1, t: 'Prima temă' }, { n: 5, t: 'Constant' }, { n: 20, t: 'Temeinic' }] }
    ],
    profesor: [
      { id: 'streak', name: 'Prezență', glyph: 'flame', stat: 'streak', crit: function (n) { return 'Intră pe platformă ' + ro(n, 'zi', 'zile') + ' la rând'; },
        tiers: [{ n: 3, t: 'Prezent' }, { n: 7, t: 'Constant' }, { n: 30, t: 'Neobosit' }] },
      { id: 'hw', name: 'Mentor de teme', glyph: 'sheet', stat: 'hw', crit: function (n) { return 'Dă ' + ro(n, 'temă', 'teme') + ' elevilor'; },
        tiers: [{ n: 1, t: 'Prima temă' }, { n: 10, t: 'Teme la zi' }, { n: 30, t: 'Mentor de teme' }] },
      { id: 'sims', name: 'Pregătitor de examene', glyph: 'watch', stat: 'sims', crit: function (n) { return 'Creează ' + ro(n, 'simulare', 'simulări'); },
        tiers: [{ n: 1, t: 'Prima simulare' }, { n: 5, t: 'Pregătitor' }, { n: 15, t: 'Arhitect de simulări' }] },
      { id: 'boards', name: 'La tablă', glyph: 'board', stat: 'boards', crit: function (n) { return 'Pornește ' + ro(n, 'tablă live', 'table live'); },
        tiers: [{ n: 1, t: 'Prima tablă' }, { n: 5, t: 'Profesor la tablă' }, { n: 20, t: 'Maestru al tablei' }] },
      { id: 'students', name: 'Clase pline', glyph: 'people', stat: 'students', crit: function (n) { return 'Ajunge la ' + ro(n, 'elev', 'elevi') + ' în clasele tale'; },
        tiers: [{ n: 5, t: 'Prima grupă' }, { n: 20, t: 'O clasă plină' }, { n: 50, t: 'Mulți elevi' }] },
      { id: 'msgs', name: 'Aproape de elevi', glyph: 'chat', stat: 'msgs', crit: function (n) { return 'Scrie ' + ro(n, 'mesaj', 'mesaje') + ' în clase'; },
        tiers: [{ n: 5, t: 'Primele mesaje' }, { n: 50, t: 'Aproape de elevi' }, { n: 300, t: 'Mereu aproape' }] },
      { id: 'ex', name: 'Autor de exerciții', glyph: 'library', stat: 'ex', crit: function (n) { return 'Adaugă ' + ro(n, 'exercițiu', 'exerciții') + ' în culegere'; },
        tiers: [{ n: 1, t: 'Prima problemă' }, { n: 10, t: 'Autor' }, { n: 50, t: 'Biblioteca ta' }] }
    ]
  };

  var A = function () { return window.BMAuth; };
  var uid = function () { return (A() && A().user && A().user.id) || ''; };
  var set = function (role) { return role === 'elev' ? 'elev' : 'profesor'; };
  var last = {};   /* ultimele cifre pe rol, pentru fereastra deschisă dintr-un click */

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsJSON(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }

  /* ---- cifre din browser (imediat, fără rețea) ---- */
  function local(role) {
    var BM = window.BM || {}, st = {};
    var cur = (BM.Storage && BM.Storage.getStreak && (BM.Storage.getStreak() || {}).count) || 0;
    var bk = 'bm_ach_beststreak_' + uid(), best = Math.max(parseInt(lsGet(bk, '0'), 10) || 0, cur);
    try { localStorage.setItem(bk, String(best)); } catch (e) { /* ignore */ }
    st.streak = best;
    var solved = (BM.Storage && BM.Storage.getSolved) ? BM.Storage.getSolved() : lsJSON('bm_solved', {});
    st.solved = Object.keys(solved || {}).filter(function (k) { return solved[k]; }).length;
    var prog = lsJSON('bm_parcurs_v1_' + uid(), {});
    st.lessons = Object.keys(prog).filter(function (k) { return /^r\d+\.s\d+\.c\d+\.l\d+$/.test(k); }).length;
    st.xp = (BM.Training && BM.Training.getTotalXp && BM.Training.getTotalXp()) || parseInt(lsGet('bm_training_total_xp', '0'), 10) || 0;
    var hist = lsJSON('bac-history', []);
    st.sims = Array.isArray(hist) ? hist.length : 0;
    st.grade = Array.isArray(hist) ? hist.reduce(function (m, h) { var g = Number(h && h.grade); return isNaN(g) ? m : Math.max(m, g); }, 0) : 0;
    st.homework = 0; st.hw = 0; st.boards = 0; st.students = 0; st.msgs = 0; st.ex = 0;
    var c = lsJSON('bm_ach_db_' + uid(), null);     /* ultimele cifre din baza de date, ca prima desenare să nu pornească de la zero */
    if (c && c.v) Object.keys(c.v).forEach(function (k) { st[k] = Math.max(st[k] || 0, c.v[k] || 0); });
    return st;
  }

  /* ---- cifre din baza de date (în tăcere dacă un tabel sau o regulă lipsește) ---- */
  function count(table, col, id) {
    var sb = A() && A().supabase;
    return Promise.resolve().then(function () { return sb.from(table).select('id', { count: 'exact', head: true }).eq(col, id); })
      .then(function (r) { return r && !r.error && typeof r.count === 'number' ? r.count : 0; }, function () { return 0; });
  }
  function fromDb(role) {
    var sb = A() && A().supabase, id = uid();
    if (!sb || !id) return Promise.resolve({});
    if (role === 'elev') {
      return Promise.all([
        count('homework_submissions', 'student_id', id),
        Promise.resolve().then(function () { return sb.from('simulation_attempts').select('grade_10,status').eq('student_id', id).eq('status', 'finalizata'); })
          .then(function (r) { return r && !r.error && Array.isArray(r.data) ? r.data : []; }, function () { return []; })
      ]).then(function (a) {
        var best = 0; a[1].forEach(function (x) { var g = Number(x.grade_10); if (!isNaN(g)) best = Math.max(best, g); });
        return { homework: a[0], dbSims: a[1].length, dbGrade: best };
      });
    }
    return Promise.all([
      Promise.resolve().then(function () { return sb.from('classes').select('id').eq('teacher_id', id); }).then(function (r) { return r && !r.error && Array.isArray(r.data) ? r.data.map(function (x) { return x.id; }) : []; }, function () { return []; }),
      count('assignments', 'created_by', id), count('simulations', 'created_by', id), count('whiteboard_sessions', 'created_by', id),
      count('class_posts', 'author_id', id), count('custom_exercises', 'created_by', id)
    ]).then(function (a) {
      var ids = a[0];
      var members = ids.length
        ? Promise.resolve().then(function () { return sb.from('class_members').select('student_id').in('class_id', ids).limit(3000); })
            .then(function (r) { var seen = {}; ((r && !r.error && r.data) || []).forEach(function (x) { seen[x.student_id] = 1; }); return Object.keys(seen).length; }, function () { return 0; })
        : Promise.resolve(0);
      return members.then(function (n) { return { students: n, hw: a[1], sims: a[2], boards: a[3], msgs: a[4], ex: a[5] }; });
    });
  }

  function load(role) {
    role = set(role);
    var key = 'bm_ach_stats_' + uid(), cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { /* ignore */ }
    if (cached && cached.role === role && Date.now() - cached.t < 120000) { last[role] = cached.v; return Promise.resolve(cached.v); }
    return fromDb(role).then(function (d) {
      var st = local(role);
      if (role === 'elev') {
        st.homework = d.homework || 0;
        st.sims = (st.sims || 0) + (d.dbSims || 0);
        st.grade = Math.max(st.grade || 0, d.dbGrade || 0);
      } else {
        ['students', 'hw', 'sims', 'boards', 'msgs', 'ex'].forEach(function (k) { st[k] = d[k] || 0; });
      }
      var persist = {}; ['homework', 'students', 'hw', 'boards', 'msgs', 'ex'].forEach(function (k) { persist[k] = st[k]; });
      try { localStorage.setItem('bm_ach_db_' + uid(), JSON.stringify({ v: persist })); sessionStorage.setItem(key, JSON.stringify({ role: role, t: Date.now(), v: st })); } catch (e) { /* ignore */ }
      last[role] = st;
      return st;
    }, function () { var st = local(role); last[role] = st; return st; });
  }

  /* ---- treptele ---- */
  function evaluate(role, st) {
    return FAM[set(role)].map(function (f) {
      var v = Number(st[f.stat]) || 0, tier = 0;
      f.tiers.forEach(function (t, i) { if (v >= t.n) tier = i + 1; });
      var nxt = f.tiers[tier] || null;
      return { f: f, v: v, tier: tier, next: nxt, pct: nxt ? Math.min(100, Math.round(Math.min(v, nxt.n) / nxt.n * 100)) : 100 };
    });
  }
  function totals(ev) { var e = 0, t = 0; ev.forEach(function (x) { e += x.tier; t += x.f.tiers.length; }); return { earned: e, total: t }; }
  var shown = function (f, v) { return f.fmt === 'grade' ? (Math.round(v * 100) / 100).toString().replace('.', ',') : String(Math.round(v)); };

  function medal(tier, glyph, size, extra) {
    var px = size || 56;
    return '<span class="am' + (tier ? ' am--t' + tier : ' am--lock') + (extra ? ' ' + extra : '') + '" style="--am:' + px + 'px" aria-hidden="true">' +
      '<img class="am__b" src="' + IMG + TIER[tier] + '.svg" alt="" width="' + px + '" height="' + px + '" decoding="async">' +
      '<img class="am__g" src="' + IMG + 'g-' + glyph + '.svg" alt="" width="' + px + '" height="' + px + '" decoding="async"></span>';
  }

  /* ---- în cardul de profil: țintă următoare, medaliile și cheia spre toate ---- */
  function section(role, st) {
    role = set(role);
    var ev = evaluate(role, st), tt = totals(ev);
    var open = ev.filter(function (x) { return x.next; }).sort(function (a, b) { return b.pct - a.pct; })[0];
    var goal = open
      ? '<div class="am-next"><div class="am-next__m">' + medal(open.tier + 1, open.f.glyph, 52) + '</div><div class="am-next__t">' +
          '<small>Următoarea țintă</small><b>' + esc(open.next.t) + '</b><span>' + esc(open.f.crit(open.next.n)) + '</span>' +
          '<div class="am-bar" role="progressbar" aria-valuenow="' + open.pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + open.pct + '%"></i></div>' +
          '<em>' + shown(open.f, open.v) + ' / ' + open.next.n + '</em></div></div>'
      : '<div class="am-next am-next--done"><div class="am-next__t"><b>Toate medaliile sunt tale</b><span>Ai ajuns la aur peste tot. Bravo!</span></div></div>';
    var row = ev.map(function (x) {
      return '<button type="button" class="am-chip" data-ach-open="' + role + '" title="' + esc(x.f.name + (x.tier ? ': ' + x.f.tiers[x.tier - 1].t + ' (' + TIER_NAME[x.tier] + ')' : ': blocată')) + '">' + medal(x.tier, x.f.glyph, 46) + '</button>';
    }).join('');
    return '<h4 class="rl-h rl-h--ach">Realizări <span class="am-count"><b>' + tt.earned + '</b> din ' + tt.total + '</span></h4>' +
      '<div class="am-box">' + goal + '<div class="am-row">' + row + '</div></div>' +
      '<button type="button" class="rl-btn am-open" data-ach-open="' + role + '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M8.5 14.2L7 22l5-3 5 3-1.5-7.8"/></svg>Toate realizările</button>';
  }

  /* ---- fereastra cu toate ---- */
  function open(role) {
    role = set(role);
    var st = last[role] || local(role), ev = evaluate(role, st), tt = totals(ev);
    var pct = tt.total ? Math.round(tt.earned / tt.total * 100) : 0;
    var d = document.createElement('div');
    d.className = 'am-dlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Realizări');
    var cards = ev.map(function (x) {
      var cur = x.tier ? x.f.tiers[x.tier - 1] : null;
      var pips = x.f.tiers.map(function (t, i) { return '<span class="am-pip' + (i < x.tier ? ' is-on am-pip--t' + (i + 1) : '') + '"><b>' + (x.f.fmt === 'grade' ? t.n : t.n) + '</b><small>' + TIER_NAME[i + 1] + '</small></span>'; }).join('');
      return '<li class="am-card' + (x.tier ? '' : ' is-lock') + (x.tier === x.f.tiers.length ? ' is-max' : '') + '">' +
        '<div class="am-card__m">' + medal(x.tier, x.f.glyph, 64) + '</div>' +
        '<div class="am-card__b"><div class="am-card__h"><h3>' + esc(x.f.name) + '</h3><span class="am-tag am-tag--t' + x.tier + '">' + (cur ? esc(cur.t) : 'Blocată') + '</span></div>' +
          (x.next
            ? '<p>' + esc(x.f.crit(x.next.n)) + '</p><div class="am-bar" role="progressbar" aria-valuenow="' + x.pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + x.pct + '%"></i></div><em>' + shown(x.f, x.v) + ' / ' + x.next.n + '</em>'
            : '<p>Treapta de aur e a ta. Felicitări!</p>') +
          '<div class="am-pips">' + pips + '</div></div></li>';
    }).join('');
    d.innerHTML = '<div class="am-dlg__card"><div class="am-dlg__h"><div><h2>Realizările tale</h2><p>' + (role === 'elev' ? 'Fiecare realizare are trei trepte: bronz, argint și aur.' : 'Medalii pentru ce faci cu elevii tăi, în trei trepte: bronz, argint și aur.') + '</p></div>' +
      '<button type="button" class="am-dlg__x" aria-label="Închide"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="am-dlg__sum"><span><b>' + tt.earned + '</b> din ' + tt.total + ' trepte</span><div class="am-bar am-bar--lg"><i style="width:' + pct + '%"></i></div></div>' +
      '<ul class="am-list">' + cards + '</ul></div>';
    var close = function () { d.classList.remove('on'); setTimeout(function () { d.remove(); document.documentElement.style.overflow = ''; }, 180); document.removeEventListener('keydown', esck); };
    var esck = function (e) { if (e.key === 'Escape') close(); };
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('.am-dlg__x')) close(); });
    document.addEventListener('keydown', esck);
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add('on'); });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ach-open]');
    if (b) open(b.getAttribute('data-ach-open'));
  });

  /* ---- "Realizare nouă": o singură dată pentru fiecare treaptă ---- */
  function check(role, st) {
    role = set(role);
    var key = 'bm_ach_seen_' + uid(), seen = null;
    try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { /* ignore */ }
    var ev = evaluate(role, st), now = {};
    ev.forEach(function (x) { now[x.f.id] = x.tier; });
    var all = seen || {}, mine = all[role];
    if (mine && window.BM && BM.toast) {
      ev.forEach(function (x) {
        if (x.tier > (mine[x.f.id] || 0)) BM.toast('Realizare nouă: ' + x.f.tiers[x.tier - 1].t + ' (' + TIER_NAME[x.tier] + ')', 'success', 4800);
      });
    }
    all[role] = now;
    try { localStorage.setItem(key, JSON.stringify(all)); } catch (e) { /* ignore */ }
  }

  window.BMAch = { local: local, load: load, section: section, open: open, check: check, evaluate: evaluate, FAM: FAM };
})();
