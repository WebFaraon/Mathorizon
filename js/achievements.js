/* ============================================================
   Realizări (2026-11-18): fiecare realizare are UN nume și mai multe niveluri de insignă (Bronz, Argint, Aur, Diamant, Mitic), într-un singur loc.
   Insigna e a nivelului cel mai înalt atins; pe măsură ce crește progresul, se schimbă în nivelul următor. În mijlocul insignei e iconița reală din
   aplicație (foc, tablă, teme, simulări, elevi...). Separate pentru elevi și pentru profesori. Cele care nu se pot calcula încă sunt blocate "În curând".
   Nu se dă XP pentru realizări (se decide mai târziu). Nimic nu se salvează separat: nivelul se calculează din activitate; în browser se țin doar
   nivelurile văzute (ca mesajul "Realizare nouă" să apară o singură dată) și cea mai lungă serie.

   Insignele: assets/images/ach/<id>-1..5.svg (Bronz..Mitic) și <id>-blocat.svg, generate din `DEFS` de scripts/make-ach-badges.mjs.
   API: BMAch.local(role), BMAch.load(role), BMAch.section(role, stats), BMAch.open(role), BMAch.check(role, stats), BMAch.DEFS
   ============================================================ */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.BMAch) return;

  var IMG = 'assets/images/ach/';
  var LV = ['Bronz', 'Argint', 'Aur', 'Diamant', 'Mitic'];
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  /* "1 exercițiu", "5 exerciții", "20 de exerciții" */
  function ro(n, one, many) {
    n = Math.round(n);
    if (n === 1) return '1 ' + one;
    var m = n % 100;
    return n + (m === 0 || m >= 20 ? ' de ' : ' ') + many;
  }

  /* ---- ce se poate câștiga ----
     id, name, img = iconița reală din aplicație (sau ico = pictogramă din kit), stat = cifra din care se calculează,
     tiers = pragurile celor 5 niveluri, desc = textul unui prag, shape = hex | round, soon = încă nu se poate calcula */
  function d(id, name, icon, stat, tiers, desc, extra) {
    var o = { id: id, name: name, stat: stat, tiers: tiers, desc: desc, shape: 'hex' };
    if (/\.svg$/.test(icon)) o.img = icon; else o.ico = icon;
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function soonD(id, name, icon, text, extra) { var o = d(id, name, icon, '', [], null, extra); o.soon = true; o.text = text; return o; }
  var I = 'assets/images/';
  var streakTiers = [3, 30, 90, 180, 365];

  var DEFS = {
    elev: [
      d('serie', 'Serie', I + 'gamification/streak.svg', 'streak', streakTiers, function (n) { return 'Exersează ' + ro(n, 'zi', 'zile') + ' la rând'; }),
      d('exercitii', 'Rezolvitor', I + 'tabs/exercitii.svg', 'solved', [10, 100, 300, 600, 1000], function (n) { return 'Rezolvă ' + ro(n, 'exercițiu', 'exerciții'); }),
      d('lectii', 'Explorator', I + 'tabs/invata.svg', 'lessons', [5, 25, 60, 120, 250], function (n) { return 'Termină ' + ro(n, 'lecție', 'lecții') + ' în Învață'; }),
      d('fara-greseli', 'Fără greșeli', I + 'gamification/bifa.svg', 'perfect', [1, 10, 30, 70, 150], function (n) { return 'Termină ' + ro(n, 'lecție', 'lecții') + ' fără nicio greșeală'; }),
      d('noapte', 'Bufnița de noapte', 'moon', 'night', [1, 5, 15, 40, 100], function (n) { return 'Termină ' + ro(n, 'lecție', 'lecții') + ' după ora 22:00'; }),
      d('matinal', 'Matinal', 'sun', 'early', [1, 5, 15, 40, 100], function (n) { return 'Termină ' + ro(n, 'lecție', 'lecții') + ' înainte de ora 7:00'; }),
      d('simulari', 'Pregătit de examen', I + 'tabs/simulare.svg', 'sims', [1, 3, 10, 25, 50], function (n) { return 'Termină ' + ro(n, 'simulare', 'simulări'); }),
      d('nota', 'Nota mare', I + 'profile/rating.svg', 'grade', [5, 7, 8, 9, 10], function (n) { return 'Obține nota ' + n + ' la o simulare'; }, { shape: 'round', fmt: 'grade' }),
      d('teme', 'Temeinic', I + 'class/teme.svg', 'homework', [1, 10, 30, 75, 150], function (n) { return 'Predă ' + ro(n, 'temă', 'teme'); }),
      soonD('capitole', 'Maestru de capitole', I + 'chapters/algebra.svg', 'Termină capitolele cu cel puțin 80%.'),
      soonD('ligi', 'Ligi', I + 'gamification/liga.svg', 'Urcă în ligile săptămânale.', { shape: 'round' }),
      soonD('locul-1', 'Locul 1', I + 'gamification/leaderboard.svg', 'Termină săptămâni pe primul loc în ligă.', { shape: 'round' }),
      soonD('prieteni', 'Invită prieteni', I + 'roles/elev.svg', 'Prietenii tăi își fac cont cu invitația ta.'),
      soonD('fulger', 'Fulger', I + 'gamification/xp.svg', 'Rezolvă 5 exerciții corect în mai puțin de un minut.', { shape: 'round' }),
      soonD('fara-indicii', 'Fără indicii', 'bulb', 'Rezolvă exerciții fără să ceri indiciu.', { shape: 'round' })
    ],
    profesor: [
      d('p-serie', 'Prezență', I + 'gamification/streak.svg', 'streak', streakTiers, function (n) { return 'Intră pe platformă ' + ro(n, 'zi', 'zile') + ' la rând'; }),
      d('p-teme', 'Mentor de teme', I + 'class/teme.svg', 'hw', [1, 10, 30, 100, 300], function (n) { return 'Dă ' + ro(n, 'temă', 'teme') + ' elevilor'; }),
      d('p-simulari', 'Pregătitor de examene', I + 'class/simulari.svg', 'sims', [1, 5, 15, 40, 100], function (n) { return 'Creează ' + ro(n, 'simulare', 'simulări'); }),
      d('p-tabla', 'La tablă', I + 'class/tabla-light.svg', 'boards', [1, 5, 20, 60, 150], function (n) { return 'Pornește ' + ro(n, 'tablă live', 'table live'); }),
      d('p-elevi', 'Clase pline', I + 'admin/elevi.svg', 'students', [5, 20, 50, 100, 250], function (n) { return 'Ai ' + ro(n, 'elev', 'elevi') + ' înscriși în clasele tale'; }),
      d('p-mesaje', 'Aproape de elevi', 'chat', 'msgs', [10, 100, 300, 1000, 3000], function (n) { return 'Scrie ' + ro(n, 'mesaj', 'mesaje') + ' în clasele tale'; }),
      d('p-exercitii', 'Autor de exerciții', I + 'tabs/exercitii.svg', 'ex', [1, 10, 50, 150, 400], function (n) { return 'Adaugă ' + ro(n, 'exercițiu', 'exerciții') + ' în culegere'; }),
      soonD('p-catalog', 'Catalog la zi', I + 'class/registru.svg', 'Ține catalogul la zi, lună după lună.', { shape: 'round' }),
      soonD('p-recenzii', 'Cinci stele', I + 'profile/rating.svg', 'Primește recenzii de 5 stele de la elevi.', { shape: 'round' })
    ]
  };

  var A = function () { return root.BMAuth; };
  var uid = function () { return (A() && A().user && A().user.id) || ''; };
  var setOf = function (role) { return role === 'elev' ? 'elev' : 'profesor'; };
  var last = {};   /* ultimele cifre pe rol, pentru fereastra deschisă dintr-un click */

  function lsGet(k, dflt) { try { var v = localStorage.getItem(k); return v == null ? dflt : v; } catch (e) { return dflt; } }
  function lsJSON(k, dflt) { try { return JSON.parse(localStorage.getItem(k) || 'null') || dflt; } catch (e) { return dflt; } }

  /* ---- cifre din browser (imediat, fără rețea) ---- */
  function local(role) {
    var BM = root.BM || {}, st = {};
    var cur = (BM.Storage && BM.Storage.getStreak && (BM.Storage.getStreak() || {}).count) || 0;
    var bk = 'bm_ach_beststreak_' + uid(), best = Math.max(parseInt(lsGet(bk, '0'), 10) || 0, cur);
    try { localStorage.setItem(bk, String(best)); } catch (e) { /* ignore */ }
    st.streak = best;
    var solved = (BM.Storage && BM.Storage.getSolved) ? BM.Storage.getSolved() : lsJSON('bm_solved', {});
    st.solved = Object.keys(solved || {}).filter(function (k) { return solved[k]; }).length;
    /* lecțiile din Învață: câte, câte cu nota 100% și câte s-au terminat prima dată noaptea sau dimineața (ora locală) */
    var prog = lsJSON('bm_parcurs_v1_' + uid(), {}), lessons = 0, perfect = 0, night = 0, early = 0;
    Object.keys(prog).forEach(function (k) {
      var r = prog[k];
      if (!/^r\d+\.s\d+\.c\d+\.l\d+$/.test(k) || !r || r.via === 'skip') return;
      lessons++;
      if ((r.pct || 0) >= 100) perfect++;
      var h = r.at ? new Date(r.at).getHours() : -1;
      if (h >= 22 || (h >= 0 && h < 4)) night++; else if (h >= 4 && h < 7) early++;
    });
    st.lessons = lessons; st.perfect = perfect; st.night = night; st.early = early;
    var hist = lsJSON('bac-history', []);
    st.sims = Array.isArray(hist) ? hist.length : 0;
    st.grade = Array.isArray(hist) ? hist.reduce(function (m, h) { var x = Number(h && h.grade); return isNaN(x) ? m : Math.max(m, x); }, 0) : 0;
    st.homework = 0; st.hw = 0; st.boards = 0; st.students = 0; st.msgs = 0; st.ex = 0;
    var c = lsJSON('bm_ach3_db_' + uid(), null);     /* ultimele cifre din baza de date, ca prima desenare să nu pornească de la zero */
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
    role = setOf(role);
    var key = 'bm_ach3_stats_' + uid(), cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { /* ignore */ }
    if (cached && cached.role === role && Date.now() - cached.t < 120000) { last[role] = cached.v; return Promise.resolve(cached.v); }
    return fromDb(role).then(function (db) {
      var st = local(role);
      if (role === 'elev') {
        st.homework = db.homework || 0;
        /* simulările din browser si cele din baza de date sunt aceleasi, nu se adună */
        st.sims = Math.max(st.sims || 0, db.dbSims || 0);
        st.grade = Math.max(st.grade || 0, db.dbGrade || 0);
      } else {
        ['students', 'hw', 'sims', 'boards', 'msgs', 'ex'].forEach(function (k) { st[k] = db[k] || 0; });
      }
      var persist = {}; ['homework', 'students', 'hw', 'boards', 'msgs', 'ex'].forEach(function (k) { persist[k] = st[k]; });
      try { localStorage.setItem('bm_ach3_db_' + uid(), JSON.stringify({ v: persist })); sessionStorage.setItem(key, JSON.stringify({ role: role, t: Date.now(), v: st })); } catch (e) { /* ignore */ }
      last[role] = st;
      return st;
    }, function () { var st = local(role); last[role] = st; return st; });
  }

  /* ---- nivelurile ---- */
  function evaluate(role, st) {
    return DEFS[setOf(role)].map(function (x) {
      var v = x.soon ? 0 : (Number(st[x.stat]) || 0), level = 0;
      x.tiers.forEach(function (t, i) { if (v >= t) level = i + 1; });
      var next = x.soon || level >= x.tiers.length ? null : x.tiers[level];
      return { d: x, v: v, level: level, soon: !!x.soon, max: !x.soon && level >= x.tiers.length,
        next: next, pct: next ? Math.min(100, Math.round(v / next * 100)) : (x.soon ? 0 : 100) };
    });
  }
  function totals(ev) {
    var t = { earned: 0, total: 0, soon: 0 };
    ev.forEach(function (x) { if (x.soon) t.soon++; else { t.total += x.d.tiers.length; t.earned += x.level; } });
    return t;
  }
  var shown = function (x, v) { return x.d.fmt === 'grade' ? (Math.round(v * 100) / 100).toString().replace('.', ',') : String(Math.round(v)); };

  function badge(x, px, extra) {
    var file = IMG + x.d.id + (x.level > 0 ? '-' + x.level : '-blocat') + '.svg';
    return '<img class="am-b' + (extra ? ' ' + extra : '') + '" src="' + file + '" alt="" width="' + px + '" height="' + Math.round(px * 140 / 120) + '" decoding="async" loading="lazy">';
  }

  /* ---- în cardul de profil: ținta cea mai apropiată, insignele câștigate și cheia spre toate ---- */
  function section(role, st) {
    role = setOf(role);
    var ev = evaluate(role, st), tt = totals(ev);
    var open = ev.filter(function (x) { return !x.soon && !x.max; }).sort(function (a, b) { return b.pct - a.pct || a.next - b.next; })[0];
    var goal = open
      ? '<div class="am-next"><div class="am-next__m">' + badge(open, 56) + '</div><div class="am-next__t">' +
          '<small>Următoarea țintă</small><b>' + esc(open.d.name) + '</b><span>Nivel ' + LV[open.level] + ': ' + esc(open.d.desc(open.next)) + '</span>' +
          '<div class="am-bar" role="progressbar" aria-valuenow="' + open.pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + open.pct + '%"></i></div>' +
          '<em>' + shown(open, open.v) + ' / ' + open.next + '</em></div></div>'
      : '<div class="am-next am-next--done"><div class="am-next__t"><b>Ai toate nivelurile disponibile</b><span>Mai vin altele în curând.</span></div></div>';
    var got = ev.filter(function (x) { return x.level > 0; }).sort(function (a, b) { return b.level - a.level; });
    var show = got.slice(0, 6), more = got.length - show.length;
    var row = show.map(function (x) {
      return '<button type="button" class="am-chip" data-ach-open="' + role + '" title="' + esc(x.d.name + ' (' + LV[x.level - 1] + ')') + '">' + badge(x, 46) + '</button>';
    }).join('') + (more > 0 ? '<button type="button" class="am-chip am-chip--more" data-ach-open="' + role + '">+' + more + '</button>' : '');
    return '<h4 class="rl-h rl-h--ach">Realizări <span class="am-count"><b>' + tt.earned + '</b> din ' + tt.total + '</span></h4>' +
      '<div class="am-box">' + goal + (row ? '<div class="am-row">' + row + '</div>' : '') + '</div>' +
      '<button type="button" class="rl-btn am-open" data-ach-open="' + role + '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M8.5 14.2L7 22l5-3 5 3-1.5-7.8"/></svg>Toate realizările</button>';
  }

  /* ---- fereastra cu toate: o insignă pe realizare, cu nivelurile ei ---- */
  function open(role) {
    role = setOf(role);
    var st = last[role] || local(role), ev = evaluate(role, st), tt = totals(ev);
    var pct = tt.total ? Math.round(tt.earned / tt.total * 100) : 0;
    var dlg = document.createElement('div');
    dlg.className = 'am-dlg'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', 'Realizări');
    /* cele în lucru întâi, apoi cele care n-au început, la urmă cele "în curând" */
    var rank = function (x) { return x.soon ? 2 : x.level > 0 || x.v > 0 ? 0 : 1; };
    var list = ev.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return rank(a.x) - rank(b.x) || a.i - b.i; }).map(function (o) { return o.x; });
    var cards = list.map(function (x) {
      var pips = x.d.tiers.map(function (t, i) {
        return '<span class="am-pip am-lv' + i + (i < x.level ? ' is-on' : '') + '" title="' + LV[i] + '"><b>' + t + '</b><small>' + LV[i] + '</small></span>';
      }).join('');
      var body = x.soon
        ? '<p>' + esc(x.d.text) + '</p><span class="am-soon">În curând</span>'
        : x.max
          ? '<p>Nivel maxim atins. Felicitări!</p><div class="am-pips">' + pips + '</div>'
          : '<p>' + (x.level ? 'Următorul nivel: ' : 'Primul nivel: ') + '<b>' + LV[x.level] + '</b>. ' + esc(x.d.desc(x.next)) + '</p>' +
            '<div class="am-bar" role="progressbar" aria-valuenow="' + x.pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + x.pct + '%"></i></div><em>' + shown(x, x.v) + ' / ' + x.next + '</em><div class="am-pips">' + pips + '</div>';
      return '<li class="am-card' + (x.soon ? ' is-soon' : '') + (x.max ? ' is-max' : '') + '">' + badge(x, 96) +
        '<div class="am-card__b"><div class="am-card__h"><b>' + esc(x.d.name) + '</b>' +
        (x.soon ? '' : '<span class="am-r ' + (x.level ? 'am-lv' + (x.level - 1) : 'am-lvx') + '">' + (x.level ? LV[x.level - 1] : 'Blocată') + '</span>') + '</div>' + body + '</div></li>';
    }).join('');
    dlg.innerHTML = '<div class="am-dlg__card"><div class="am-dlg__h"><div><h2>Realizările tale</h2><p>' + (role === 'elev' ? 'Fiecare realizare are cinci niveluri: Bronz, Argint, Aur, Diamant și Mitic.' : 'Insigne pentru ce faci cu elevii tăi, în cinci niveluri: Bronz, Argint, Aur, Diamant și Mitic.') + '</p></div>' +
      '<button type="button" class="am-dlg__x" aria-label="Închide"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="am-dlg__sum"><span><b>' + tt.earned + '</b> din ' + tt.total + ' niveluri</span><div class="am-bar am-bar--lg"><i style="width:' + pct + '%"></i></div>' + (tt.soon ? '<small>+ ' + tt.soon + ' în curând</small>' : '') + '</div>' +
      '<ul class="am-list">' + cards + '</ul></div>';
    var close = function () { dlg.classList.remove('on'); setTimeout(function () { dlg.remove(); document.documentElement.style.overflow = ''; }, 180); document.removeEventListener('keydown', esck); };
    var esck = function (e) { if (e.key === 'Escape') close(); };
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('.am-dlg__x')) close(); });
    document.addEventListener('keydown', esck);
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(dlg);
    requestAnimationFrame(function () { dlg.classList.add('on'); });
  }

  if (typeof document !== 'undefined') document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ach-open]');
    if (b) open(b.getAttribute('data-ach-open'));
  });

  /* ---- "Realizare nouă": o singură dată pentru fiecare nivel (prima vizită doar le memorează) ---- */
  function check(role, st) {
    role = setOf(role);
    var key = 'bm_ach_seen_v3_' + uid(), all = lsJSON(key, {}), mine = all[role] && typeof all[role] === 'object' ? all[role] : null;
    var now = {};
    evaluate(role, st).forEach(function (x) {
      if (x.level < 1) return;
      now[x.d.id] = x.level;
      if (mine && root.BM && root.BM.toast && x.level > (mine[x.d.id] || 0)) root.BM.toast('Realizare nouă: ' + x.d.name + ', nivel ' + LV[x.level - 1], 'success', 4800);
    });
    all[role] = now;
    try { localStorage.setItem(key, JSON.stringify(all)); } catch (e) { /* ignore */ }
  }

  root.BMAch = { local: local, load: load, section: section, open: open, check: check, evaluate: evaluate, DEFS: DEFS, LV: LV };
})();
