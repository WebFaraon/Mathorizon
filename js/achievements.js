/* ============================================================
   Realizări (2026-11-18): insignele din Teorema Logo Kit (fila Realizări), separate pentru elevi și pentru profesori.
   Fiecare realizare e o insignă cu raritate (Comun, Rar, Epic, Legendar), forma depinde de categorie. Cele care nu se pot calcula încă
   apar blocate cu mențiunea "În curând" (`soon`). Nu se dă XP pentru realizări (se decide mai târziu).
   Nimic nu se salvează separat: ce e câștigat se calculează din activitatea de pe platformă. În browser se țin doar ce a văzut omul deja
   (ca mesajul "Realizare nouă" să apară o singură dată) și cea mai lungă serie.

   Insignele desenate: assets/images/ach/<id>.svg și <id>-blocat.svg, generate din `DEFS` de scripts/make-ach-badges.mjs
   (aceeași funcție ca în kit; cele de profesor au pictograme noi în același stil).
   API: BMAch.local(role), BMAch.load(role), BMAch.section(role, stats), BMAch.open(role), BMAch.check(role, stats), BMAch.DEFS
   ============================================================ */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.BMAch) return;

  var IMG = 'assets/images/ach/';
  var RN = ['Comun', 'Rar', 'Epic', 'Legendar'];
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  /* ---- ce se poate câștiga ----
     c = categoria, shape = hex | round | shield, r = raritatea 0..3, ico / txt = pictograma și numărul de pe insignă,
     stat = cifra din care se calculează, goal = pragul, soon = încă nu se poate calcula */
  function d(c, shape, r, ico, txt, id, name, desc, stat, goal, extra) {
    var o = { id: id, c: c, shape: shape, r: r, ico: ico, txt: txt, name: name, desc: desc, stat: stat, goal: goal };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  var soon = { soon: true };
  var CHAPS = ['Funcții', 'Derivate', 'Probabilități', 'Geometrie', 'Trigonometrie', 'Logaritmi'];
  var SLUG = ['functii', 'derivate', 'probabilitati', 'geometrie', 'trigonometrie', 'logaritmi'];

  var CAT = {
    elev: ['Capitole', 'Serie', 'Exerciții', 'Măiestrie', 'Comunitate', 'Speciale'],
    profesor: ['Serie', 'Teme', 'Simulări', 'Tabla live', 'Elevi', 'Comunicare', 'Conținut', 'Speciale']
  };

  var DEFS = {
    elev: [].concat(
      CHAPS.map(function (n, k) { return d(0, 'shield', 1, null, '', 'cap-' + SLUG[k], 'Insigna ' + n, 'Termină capitolul „' + n + '” cu cel puțin 80%.', '', 100, { soon: true, owl: true, picto: k }); }),
      [
        d(1, 'hex', 0, 'flame', '3', 'serie-3', 'Trei la rând', 'Exersează 3 zile la rând.', 'streak', 3),
        d(1, 'hex', 0, 'flame', '7', 'serie-7', 'O săptămână', 'Exersează 7 zile la rând.', 'streak', 7),
        d(1, 'hex', 1, 'flame', '30', 'serie-30', 'Luna de foc', 'Exersează 30 de zile la rând.', 'streak', 30),
        d(1, 'hex', 2, 'flame', '100', 'serie-100', 'Sută de zile', 'Exersează 100 de zile la rând.', 'streak', 100),
        d(1, 'hex', 3, 'flame', '365', 'serie-365', 'Un an cu bufnița', 'Exersează 365 de zile la rând.', 'streak', 365),
        d(2, 'hex', 0, 'tick', '1', 'ex-1', 'Primul pas', 'Rezolvă primul exercițiu.', 'solved', 1),
        d(2, 'hex', 0, 'tick', '25', 'ex-25', 'Încălzire', 'Rezolvă 25 de exerciții.', 'solved', 25),
        d(2, 'hex', 1, 'tick', '100', 'ex-100', 'Sută', 'Rezolvă 100 de exerciții.', 'solved', 100),
        d(2, 'hex', 2, 'tick', '500', 'ex-500', 'Maraton', 'Rezolvă 500 de exerciții.', 'solved', 500),
        d(2, 'hex', 3, 'tick', '1000', 'ex-1000', 'Mia', 'Rezolvă 1000 de exerciții.', 'solved', 1000),
        d(3, 'round', 1, 'target', '', 'fara-greseli', 'Fără greșeli', 'Termină o lecție fără nicio greșeală.', 'perfect', 1),
        d(3, 'round', 1, 'bolt', '', 'fulger', 'Fulger', 'Rezolvă 5 exerciții corect în mai puțin de un minut.', '', 1, soon),
        d(3, 'round', 0, 'moon', '', 'noapte', 'Bufnița de noapte', 'Exersează după ora 22:00.', 'night', 1),
        d(3, 'round', 0, 'sun', '', 'matinal', 'Matinal', 'Exersează înainte de ora 7:00.', 'early', 1),
        d(3, 'round', 1, 'clock', '', 'prima-sim', 'Prima simulare', 'Termină prima simulare de BAC.', 'sims', 1),
        d(3, 'round', 2, 'ten', '', 'nota-10', 'Nota 10', 'Obține nota 10 la o simulare de BAC.', 'grade10', 1),
        d(3, 'round', 1, 'bulb', '', 'fara-indicii', 'Fără indicii', 'Rezolvă 10 exerciții fără să ceri indiciu.', '', 10, soon),
        d(4, 'round', 0, 'star', '', 'prima-liga', 'Prima ligă', 'Intră într-o ligă săptămânală.', '', 1, soon),
        d(4, 'round', 2, 'crown', '', 'liga-aur', 'Liga Aur', 'Ajunge în Liga Aur.', '', 1, soon),
        d(4, 'round', 2, 'trophy', '', 'locul-1', 'Locul 1', 'Termină o săptămână pe primul loc.', '', 1, soon),
        d(4, 'round', 0, 'friends', '', 'invita', 'Invită un prieten', 'Un prieten își face cont cu invitația ta.', '', 1, soon),
        d(5, 'round', 2, 'collector', '', 'colectionar', 'Colecționar', 'Obține toate insignele de capitol.', '', 6, soon),
        d(5, 'round', 3, 'cap', '', 'absolvent', 'Absolvent', 'Termină toate capitolele cu minim 90%.', '', 1, soon),
        d(5, 'round', 3, 'owlwise', '', 'bufnita-intelepta', 'Bufnița înțeleaptă', 'Ajunge la nivelul maxim.', '', 1, soon)
      ]),
    profesor: [
      d(0, 'hex', 0, 'flame', '3', 'p-serie-3', 'Prezent', 'Intră pe platformă 3 zile la rând.', 'streak', 3),
      d(0, 'hex', 0, 'flame', '7', 'p-serie-7', 'O săptămână', 'Intră pe platformă 7 zile la rând.', 'streak', 7),
      d(0, 'hex', 1, 'flame', '30', 'p-serie-30', 'Luna de foc', 'Intră pe platformă 30 de zile la rând.', 'streak', 30),
      d(0, 'hex', 2, 'flame', '100', 'p-serie-100', 'Sută de zile', 'Intră pe platformă 100 de zile la rând.', 'streak', 100),
      d(1, 'hex', 0, 'sheet', '1', 'p-teme-1', 'Prima temă', 'Dă prima temă unei clase.', 'hw', 1),
      d(1, 'hex', 1, 'sheet', '10', 'p-teme-10', 'Teme la zi', 'Dă 10 teme elevilor.', 'hw', 10),
      d(1, 'hex', 2, 'sheet', '30', 'p-teme-30', 'Mentor de teme', 'Dă 30 de teme elevilor.', 'hw', 30),
      d(1, 'hex', 3, 'sheet', '100', 'p-teme-100', 'Sută de teme', 'Dă 100 de teme elevilor.', 'hw', 100),
      d(2, 'round', 0, 'clock', '', 'p-sim-1', 'Prima simulare', 'Creează prima simulare pentru o clasă.', 'sims', 1),
      d(2, 'round', 1, 'clock', '', 'p-sim-5', 'Pregătitor', 'Creează 5 simulări.', 'sims', 5),
      d(2, 'round', 2, 'clock', '', 'p-sim-15', 'Arhitect de simulări', 'Creează 15 simulări.', 'sims', 15),
      d(3, 'round', 0, 'board', '', 'p-tabla-1', 'Prima tablă', 'Pornește prima tablă live.', 'boards', 1),
      d(3, 'round', 1, 'board', '', 'p-tabla-5', 'La tablă', 'Pornește 5 table live.', 'boards', 5),
      d(3, 'round', 2, 'board', '', 'p-tabla-20', 'Maestru al tablei', 'Pornește 20 de table live.', 'boards', 20),
      d(4, 'hex', 0, 'friends', '5', 'p-elevi-5', 'Prima grupă', 'Ai 5 elevi în clasele tale.', 'students', 5),
      d(4, 'hex', 1, 'friends', '20', 'p-elevi-20', 'Clasă plină', 'Ai 20 de elevi în clasele tale.', 'students', 20),
      d(4, 'hex', 2, 'friends', '50', 'p-elevi-50', 'Mulți elevi', 'Ai 50 de elevi în clasele tale.', 'students', 50),
      d(4, 'hex', 3, 'friends', '100', 'p-elevi-100', 'Sută de elevi', 'Ai 100 de elevi în clasele tale.', 'students', 100),
      d(5, 'round', 0, 'chat', '', 'p-mesaje-5', 'Primele mesaje', 'Scrie 5 mesaje în clasele tale.', 'msgs', 5),
      d(5, 'round', 1, 'chat', '', 'p-mesaje-50', 'Aproape de elevi', 'Scrie 50 de mesaje în clasele tale.', 'msgs', 50),
      d(5, 'round', 2, 'chat', '', 'p-mesaje-300', 'Mereu aproape', 'Scrie 300 de mesaje în clasele tale.', 'msgs', 300),
      d(6, 'hex', 0, 'library', '1', 'p-ex-1', 'Prima problemă', 'Adaugă primul exercițiu în culegere.', 'ex', 1),
      d(6, 'hex', 1, 'library', '10', 'p-ex-10', 'Autor', 'Adaugă 10 exerciții în culegere.', 'ex', 10),
      d(6, 'hex', 2, 'library', '50', 'p-ex-50', 'Biblioteca ta', 'Adaugă 50 de exerciții în culegere.', 'ex', 50),
      d(7, 'round', 1, 'tick', '', 'p-catalog', 'Catalog la zi', 'Ține catalogul la zi, o lună la rând.', '', 1, soon),
      d(7, 'round', 2, 'star', '', 'p-recenzie', 'Cinci stele', 'Primește o recenzie de 5 stele de la un elev.', '', 1, soon)
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
    /* lecțiile din Învață: nota 100% si ora la care s-au terminat prima dată */
    var prog = lsJSON('bm_parcurs_v1_' + uid(), {}), perfect = 0, night = 0, early = 0;
    Object.keys(prog).forEach(function (k) {
      var r = prog[k];
      if (!/^r\d+\.s\d+\.c\d+\.l\d+$/.test(k) || !r || r.via === 'skip') return;
      if ((r.pct || 0) >= 100) perfect++;
      var h = r.at ? new Date(r.at).getHours() : -1;
      if (h >= 22 || (h >= 0 && h < 4)) night++; else if (h >= 4 && h < 7) early++;
    });
    st.perfect = perfect; st.night = night; st.early = early;
    var hist = lsJSON('bac-history', []);
    st.sims = Array.isArray(hist) ? hist.length : 0;
    var g = Array.isArray(hist) ? hist.reduce(function (m, h) { var x = Number(h && h.grade); return isNaN(x) ? m : Math.max(m, x); }, 0) : 0;
    st.grade10 = g >= 9.995 ? 1 : 0;
    st.hw = 0; st.boards = 0; st.students = 0; st.msgs = 0; st.ex = 0;
    var c = lsJSON('bm_ach2_db_' + uid(), null);     /* ultimele cifre din baza de date, ca prima desenare să nu pornească de la zero */
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
      return Promise.resolve().then(function () { return sb.from('simulation_attempts').select('grade_10,status').eq('student_id', id).eq('status', 'finalizata'); })
        .then(function (r) { return r && !r.error && Array.isArray(r.data) ? r.data : []; }, function () { return []; })
        .then(function (rows) {
          var best = 0; rows.forEach(function (x) { var g = Number(x.grade_10); if (!isNaN(g)) best = Math.max(best, g); });
          return { dbSims: rows.length, dbGrade: best };
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
    var key = 'bm_ach2_stats_' + uid(), cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { /* ignore */ }
    if (cached && cached.role === role && Date.now() - cached.t < 120000) { last[role] = cached.v; return Promise.resolve(cached.v); }
    return fromDb(role).then(function (db) {
      var st = local(role);
      if (role === 'elev') {
        /* simulările din browser si cele din baza de date sunt aceleasi, nu se adună */
        st.sims = Math.max(st.sims || 0, db.dbSims || 0);
        if ((db.dbGrade || 0) >= 9.995) st.grade10 = 1;
      } else {
        ['students', 'hw', 'sims', 'boards', 'msgs', 'ex'].forEach(function (k) { st[k] = db[k] || 0; });
      }
      var persist = {}; ['students', 'hw', 'boards', 'msgs', 'ex', 'sims'].forEach(function (k) { persist[k] = st[k]; });
      if (role !== 'elev') try { localStorage.setItem('bm_ach2_db_' + uid(), JSON.stringify({ v: persist })); } catch (e) { /* ignore */ }
      try { sessionStorage.setItem(key, JSON.stringify({ role: role, t: Date.now(), v: st })); } catch (e) { /* ignore */ }
      last[role] = st;
      return st;
    }, function () { var st = local(role); last[role] = st; return st; });
  }

  /* ---- ce e câștigat ---- */
  function evaluate(role, st) {
    return DEFS[setOf(role)].map(function (x) {
      var v = x.soon ? 0 : (Number(st[x.stat]) || 0);
      var got = !x.soon && v >= x.goal;
      return { d: x, v: v, got: got, soon: !!x.soon, pct: x.soon ? 0 : Math.min(100, Math.round(Math.min(v, x.goal) / x.goal * 100)) };
    });
  }
  function totals(ev) {
    var t = { earned: 0, total: 0, soon: 0 };
    ev.forEach(function (x) { if (x.soon) t.soon++; else { t.total++; if (x.got) t.earned++; } });
    return t;
  }

  function badge(x, px, extra) {
    var file = IMG + x.d.id + (x.got ? '' : '-blocat') + '.svg';
    return '<img class="am-b' + (extra ? ' ' + extra : '') + '" src="' + file + '" alt="" width="' + px + '" height="' + Math.round(px * 140 / 120) + '" decoding="async" loading="lazy">';
  }

  /* ---- în cardul de profil: ținta cea mai apropiată, insignele câștigate și cheia spre toate ---- */
  function section(role, st) {
    role = setOf(role);
    var ev = evaluate(role, st), tt = totals(ev);
    var open = ev.filter(function (x) { return !x.soon && !x.got; }).sort(function (a, b) { return b.pct - a.pct || a.d.goal - b.d.goal; })[0];
    var goal = open
      ? '<div class="am-next"><div class="am-next__m">' + badge(open, 56) + '</div><div class="am-next__t">' +
          '<small>Următoarea țintă</small><b>' + esc(open.d.name) + '</b><span>' + esc(open.d.desc) + '</span>' +
          '<div class="am-bar" role="progressbar" aria-valuenow="' + open.pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + open.pct + '%"></i></div>' +
          '<em>' + Math.round(open.v) + ' / ' + open.d.goal + '</em></div></div>'
      : '<div class="am-next am-next--done"><div class="am-next__t"><b>Ai toate realizările disponibile</b><span>Mai vin altele în curând.</span></div></div>';
    var got = ev.filter(function (x) { return x.got; }).sort(function (a, b) { return b.d.r - a.d.r || b.d.goal - a.d.goal; });
    var show = got.slice(0, 6), more = got.length - show.length;
    var row = show.map(function (x) {
      return '<button type="button" class="am-chip" data-ach-open="' + role + '" title="' + esc(x.d.name + ' (' + RN[x.d.r] + ')') + '">' + badge(x, 46) + '</button>';
    }).join('') + (more > 0 ? '<button type="button" class="am-chip am-chip--more" data-ach-open="' + role + '">+' + more + '</button>' : '');
    return '<h4 class="rl-h rl-h--ach">Realizări <span class="am-count"><b>' + tt.earned + '</b> din ' + tt.total + '</span></h4>' +
      '<div class="am-box">' + goal + (row ? '<div class="am-row">' + row + '</div>' : '') + '</div>' +
      '<button type="button" class="rl-btn am-open" data-ach-open="' + role + '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M8.5 14.2L7 22l5-3 5 3-1.5-7.8"/></svg>Toate realizările</button>';
  }

  /* ---- fereastra cu toate ---- */
  function open(role) {
    role = setOf(role);
    var st = last[role] || local(role), ev = evaluate(role, st), tt = totals(ev), cats = CAT[role];
    var pct = tt.total ? Math.round(tt.earned / tt.total * 100) : 0, cur = -1;
    var dlg = document.createElement('div');
    dlg.className = 'am-dlg'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', 'Realizări');
    var used = {}; ev.forEach(function (x) { used[x.d.c] = 1; });
    var chips = '<button type="button" class="am-cat" data-c="-1" aria-pressed="true">Toate</button>' + cats.map(function (n, i) { return used[i] ? '<button type="button" class="am-cat" data-c="' + i + '" aria-pressed="false">' + esc(n) + '</button>' : ''; }).join('');
    dlg.innerHTML = '<div class="am-dlg__card"><div class="am-dlg__h"><div><h2>Realizările tale</h2><p>' + (role === 'elev' ? 'Insigne pentru obiceiuri bune: serii, exerciții, simulări.' : 'Insigne pentru ce faci cu elevii tăi: teme, simulări, tablă, clase.') + '</p></div>' +
      '<button type="button" class="am-dlg__x" aria-label="Închide"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="am-dlg__sum"><span><b>' + tt.earned + '</b> din ' + tt.total + '</span><div class="am-bar am-bar--lg"><i style="width:' + pct + '%"></i></div>' + (tt.soon ? '<small>+ ' + tt.soon + ' în curând</small>' : '') + '</div>' +
      '<div class="am-cats" role="group" aria-label="Categorie">' + chips + '</div><ul class="am-list" id="amList"></ul></div>';
    function draw() {
      /* obținutele întâi, apoi cele în lucru, la urmă cele "în curând" (în rest, ordinea din listă) */
      var rank = function (x) { return x.got ? 0 : x.soon ? 2 : 1; };
      var list = ev.filter(function (x) { return cur < 0 || x.d.c === cur; }).map(function (x, i) { return { x: x, i: i }; })
        .sort(function (a, b) { return rank(a.x) - rank(b.x) || a.i - b.i; }).map(function (o) { return o.x; });
      dlg.querySelector('#amList').innerHTML = list.map(function (x) {
        return '<li class="am-card' + (x.got ? ' is-got' : '') + (x.soon ? ' is-soon' : '') + '">' + badge(x, 84) +
          '<div class="am-card__b"><b>' + esc(x.d.name) + '</b><span class="am-r am-r' + x.d.r + '">' + RN[x.d.r] + '</span>' +
          '<p>' + esc(x.d.desc) + '</p>' +
          (x.soon ? '<span class="am-soon">În curând</span>'
            : x.got ? '<span class="am-done">Obținută</span>'
            : '<div class="am-bar" role="progressbar" aria-valuenow="' + x.pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + x.pct + '%"></i></div><em>' + Math.round(x.v) + ' / ' + x.d.goal + '</em>') +
          '</div></li>';
      }).join('');
    }
    var close = function () { dlg.classList.remove('on'); setTimeout(function () { dlg.remove(); document.documentElement.style.overflow = ''; }, 180); document.removeEventListener('keydown', esck); };
    var esck = function (e) { if (e.key === 'Escape') close(); };
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('.am-dlg__x')) return close();
      var b = e.target.closest('.am-cat');
      if (b) { cur = parseInt(b.getAttribute('data-c'), 10); [].forEach.call(dlg.querySelectorAll('.am-cat'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); draw(); }
    });
    document.addEventListener('keydown', esck);
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(dlg); draw();
    requestAnimationFrame(function () { dlg.classList.add('on'); });
  }

  if (typeof document !== 'undefined') document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ach-open]');
    if (b) open(b.getAttribute('data-ach-open'));
  });

  /* ---- "Realizare nouă": o singură dată pentru fiecare insignă (prima vizită doar le memorează) ---- */
  function check(role, st) {
    role = setOf(role);
    var key = 'bm_ach_seen_v2_' + uid(), all = lsJSON(key, {}), mine = Array.isArray(all[role]) ? all[role] : null;
    var now = evaluate(role, st).filter(function (x) { return x.got; });
    if (mine && root.BM && root.BM.toast) {
      now.forEach(function (x) { if (mine.indexOf(x.d.id) < 0) root.BM.toast('Realizare nouă: ' + x.d.name + ' (' + RN[x.d.r] + ')', 'success', 4800); });
    }
    all[role] = now.map(function (x) { return x.d.id; });
    try { localStorage.setItem(key, JSON.stringify(all)); } catch (e) { /* ignore */ }
  }

  root.BMAch = { local: local, load: load, section: section, open: open, check: check, evaluate: evaluate, DEFS: DEFS, CAT: CAT, RN: RN };
})();
