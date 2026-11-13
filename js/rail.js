/* ============================================================
   Panoul de profil din stânga, la fel de permanent ca navbarul.
   Se desenează pe toate paginile publice cu navbar (body[data-rail]) și rămâne în același loc la schimbarea taburilor,
   inclusiv în profil, într-o clasă sau într-o simulare. Pe ecrane sub 1180 px nu are loc, deci apare doar pe paginile care
   îl pun singure într-o coloană (Exerciții și Învață: React creează <aside id="appRail"> și îl umple tot acest script).

   Date: numele, nickname-ul (doar elevii), rolul, XP-ul, seria zilnică și locul în clasament, citite din aceleași surse ca
   restul site-ului (BMAuth, BM.Training, BM.Storage, get_xp_leaderboard).
   ============================================================ */
(function () {
  'use strict';
  if (window.BMRail) return;

  var MIN = 1180;
  var ROLE = { elev: 'Elev', profesor: 'Profesor', admin: 'Admin' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var state = { rank: null, rankXp: null, nick: '', nickRole: null, mounted: false };
  var scheduled = false;

  function wants() { return document.body && document.body.hasAttribute('data-rail'); }
  function hostEl() { return document.getElementById('appRail'); }
  function mountEl() { return document.getElementById('appRailMount'); }   /* coloana "Profil" de pe telefon (React, Exerciții și Învață) */

  function ensureHost() {
    var h = hostEl();
    if (h) return h;
    if (window.innerWidth < MIN || document.documentElement.classList.contains('rail-off')) return null;
    h = document.createElement('aside');
    h.id = 'appRail'; h.className = 'app-rail'; h.setAttribute('aria-label', 'Profilul tău');
    document.body.insertBefore(h, document.body.firstChild);
    return h;
  }
  function dropHost() {
    var h = hostEl();
    if (h) h.remove();
    document.documentElement.classList.remove('has-rail');
  }

  /* in simularea propriu-zisa (examen sau rezultate) panoul dispare, ca sa nu distraga */
  function examOpen() {
    var ids = ['examView', 'resultsView'];
    for (var i = 0; i < ids.length; i++) { var e = document.getElementById(ids[i]); if (e && e.style.display !== 'none' && getComputedStyle(e).display !== 'none') return true; }
    return false;
  }
  function watchExam() {
    ['examView', 'resultsView'].forEach(function (id) {
      var e = document.getElementById(id); if (!e) return;
      new MutationObserver(schedule).observe(e, { attributes: true, attributeFilter: ['style', 'class'] });
    });
  }

  /* ---- date ---- */
  function snapshot() {
    var A = window.BMAuth, u = A && A.user;
    if (!u) return null;
    var BM = window.BM || {};
    var months = '';
    try { months = u.created_at ? new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(u.created_at)) : ''; } catch (e) { /* ignore */ }
    var role = A.role || null;
    return {
      name: A.displayName ? A.displayName() : '',
      username: (u.user_metadata && (u.user_metadata.username || u.user_metadata.user_name)) || '',
      avatar: A.avatarUrl ? A.avatarUrl() : null,
      cover: (u.user_metadata && u.user_metadata.custom_cover_url) || null,
      role: role,
      since: months,
      xp: (BM.Training && BM.Training.getTotalXp && BM.Training.getTotalXp()) || 0,
      streak: (BM.Storage && BM.Storage.getStreak && (BM.Storage.getStreak() || {}).count) || 0,
      perLevel: (BM.Training && BM.Training.XP_PER_LEVEL) || 100
    };
  }

  function loadExtras() {
    var A = window.BMAuth, sb = A && A.supabase, u = A && A.user;
    if (!sb || !u || state.loading) return;
    state.loading = true; state.extrasDone = true;
    try { state.nick = localStorage.getItem('bm_nickname') || state.nick; } catch (e) { /* ignore */ }
    Promise.resolve(sb.rpc('my_student_profile')).then(function (r) {
      var d = r && r.data;
      if (d) { state.nickRole = d.role || null; state.nick = d.role === 'elev' && d.nickname ? d.nickname : ''; }
    }, function () { /* migrarea poate lipsi */ }).then(function () {
      var cached = null;
      try { cached = JSON.parse(sessionStorage.getItem('bm_rail_rank') || 'null'); } catch (e) { /* ignore */ }
      if (cached && cached.u === u.id && Date.now() - cached.t < 90000) { state.rank = cached.rank; state.rankXp = cached.xp; return; }
      return Promise.resolve(sb.rpc('get_xp_leaderboard', { p_limit: 500 })).then(function (r) {
        var rows = (r && r.data) || [], mine = null;
        rows.forEach(function (x) { if (x.user_id === u.id) mine = x; });
        state.rank = mine ? mine.rank : null; state.rankXp = mine ? mine.total_xp : null;
        try { sessionStorage.setItem('bm_rail_rank', JSON.stringify({ u: u.id, t: Date.now(), rank: state.rank, xp: state.rankXp })); } catch (e) { /* ignore */ }
      }, function () { /* in tacere */ });
    }).then(function () { state.loading = false; schedule(); }, function () { state.loading = false; });
  }

  /* ---- desen ---- */
  function skeleton() { return '<div class="rl-card rl-skel" aria-hidden="true"></div>'; }

  function html(s) {
    var level = Math.floor(s.xp / s.perLevel) + 1, into = s.xp % s.perLevel, pct = Math.round(into / s.perLevel * 100);
    var xpShown = Math.max(s.xp, state.rankXp != null ? state.rankXp : 0);
    level = Math.floor(xpShown / s.perLevel) + 1; into = xpShown % s.perLevel; pct = Math.round(into / s.perLevel * 100);
    var isStudent = (state.nickRole || s.role) === 'elev';
    var big = isStudent && state.nick ? '@' + state.nick : s.name;
    var small = isStudent && state.nick ? s.name : s.username;
    var rankTxt = state.rank != null ? '#' + state.rank : (isStudent ? '—' : '—');
    var avatar = s.avatar || (window.BM && window.BM.DEFAULT_AVATAR) || 'assets/images/avatar-owl.svg';
    var cover = s.cover ? ' style="background-image:url(\'' + esc(s.cover) + '\')"' : '';
    return '<div class="rl-card">' +
      '<div class="rl-cover"' + cover + '></div>' +
      '<div class="rl-avatar" aria-hidden="true"><img src="' + esc(avatar) + '" alt="" referrerpolicy="no-referrer"></div>' +
      '<div class="rl-body">' +
        '<h3 class="rl-name" title="' + esc(big) + '">' + esc(big) + '</h3>' +
        (small && small !== big ? '<p class="rl-user">' + esc(small) + '</p>' : '') +
        '<p class="rl-meta">' + (ROLE[s.role] ? '<span class="rl-role">' + ROLE[s.role] + '</span>' : '') + (s.since ? '<span>S-a alăturat în ' + esc(s.since) + '</span>' : '') + '</p>' +
        '<div class="rl-follow"><button type="button" data-follow="following">Urmărești <b>0</b></button><button type="button" data-follow="followers"><b>0</b> urmăritori</button></div>' +
        '<div class="rl-level"><div class="rl-level__head"><span>Nivel ' + level + '</span><span class="rl-level__xp">' + into + ' / ' + s.perLevel + ' XP</span></div>' +
          '<div class="rl-xp"><div class="rl-xp__track" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Nivel ' + level + ': ' + pct + '%"><i class="rl-xp__fill" style="--xp:' + pct + '%"></i></div><span class="rl-xp__next" title="Următorul nivel: ' + (level + 1) + '">' + (level + 1) + '</span></div></div>' +
        '<h4 class="rl-h">Statistici</h4>' +
        '<div class="rl-ps">' +
          '<div class="rl-ps__card"><img src="assets/images/gamification/streak-mini.svg" alt=""><div><b>' + s.streak + '</b><span>' + (s.streak === 1 ? 'zi la rând' : 'zile la rând') + '</span></div></div>' +
          '<div class="rl-ps__card"><img src="assets/images/gamification/xp-mini.svg" alt=""><div><b>' + xpShown + '</b><span>XP total</span></div></div>' +
          '<div class="rl-ps__card rl-ps__card--soon"><span class="rl-ps__tag">ÎN CURÂND</span><img src="assets/images/gamification/liga.svg" alt=""><div><b>Ligi</b><span>Liga curentă</span></div></div>' +
          '<div class="rl-ps__card"><img src="assets/images/gamification/leaderboard-mini.svg" alt=""><div><b>' + rankTxt + '</b><span>în clasament</span></div></div>' +
        '</div>' +
        '<h4 class="rl-h">Realizări</h4>' +
        '<div class="rl-ach"><img src="assets/images/gamification/realizari.svg" alt=""><p>Realizările vor apărea aici în curând.</p></div>' +
        (isStudent ? '<a class="rl-btn" href="profile.html#simulari-bac"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/></svg>Simulările tale anterioare</a>' : '') +
      '</div></div>';
  }

  function render() {
    scheduled = false;
    if (!wants()) return;
    var off = examOpen();
    document.documentElement.classList.toggle('rail-off', off);
    var s = snapshot(), role = window.BMAuth && window.BMAuth.role;
    var hasUser = !!s && role !== 'manager';
    var m = mountEl();
    if (off) { var hh = hostEl(); if (hh) hh.remove(); document.documentElement.classList.remove('has-rail'); }
    var h = off ? null : ensureHost();
    /* more than one #appRail (an old cached one next to a fresh one) would stack two cards: keep the first */
    var all = document.querySelectorAll('#appRail');
    for (var i = 1; i < all.length; i++) all[i].remove();
    if (!hasUser) { if (h && !h.firstChild) h.innerHTML = skeleton(); if (m && !m.firstChild) m.innerHTML = skeleton(); return; }
    var markup = html(s);
    [h, m].forEach(function (host) {
      if (!host) return;
      var keep = host.querySelector('.rl-body'), top = keep ? keep.scrollTop : 0;
      host.innerHTML = markup;
      var nb = host.querySelector('.rl-body'); if (nb && top) nb.scrollTop = top;
    });
    if (h) document.documentElement.classList.add('has-rail');
    try { localStorage.setItem('bm_rail_html_v1', JSON.stringify({ u: window.BMAuth.user.id, html: markup })); } catch (e) { /* ignore */ }
    if (!state.extrasDone) loadExtras();
  }
  function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(render); }

  /* ---- "Urmărești" si "Urmăritori": nu exista inca relatii de urmarire, deci o fereastra cinstita, goala ---- */
  function follow(kind) {
    var T = kind === 'following' ? ['Urmărești', 'Nu urmărești pe nimeni încă.'] : ['Urmăritori', 'Nu ai niciun urmăritor încă.'];
    var d = document.createElement('div');
    d.className = 'rl-dlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', T[0]);
    d.innerHTML = '<div class="rl-dlg__card"><div class="rl-dlg__h"><h3>' + T[0] + '</h3><button type="button" aria-label="Închide"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="rl-dlg__b"><p>' + T[1] + '</p><span>Funcția de urmărire vine în curând.</span></div></div>';
    var close = function () { d.classList.remove('on'); setTimeout(function () { d.remove(); }, 180); document.removeEventListener('keydown', esck); };
    var esck = function (e) { if (e.key === 'Escape') close(); };
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('button')) close(); });
    document.addEventListener('keydown', esck);
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add('on'); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#appRail [data-follow]');
    if (b) follow(b.getAttribute('data-follow'));
  });

  /* ---- porniri si reimprospatari ---- */
  function boot() {
    if (!wants()) return;
    /* aproape sigur autentificat (indiciul din auth-hint): rezervam loc din prima, ca pagina sa nu sara */
    if (document.documentElement.classList.contains('bm-authed') && window.innerWidth >= MIN) { var h = ensureHost(); if (h && !h.firstChild) h.innerHTML = skeleton(); }
    watchExam();
    schedule();
  }
  ['bmauth:ready', 'bmauth:synced', 'bmauth:profile', 'bmauth:streak-updated', 'bm:onboarded', 'nav:loaded'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (ev === 'bm:onboarded') { try { state.nick = localStorage.getItem('bm_nickname') || ''; } catch (e) { /* ignore */ } state.nickRole = 'elev'; } schedule(); });
  });
  window.addEventListener('focus', function () { if (document.visibilityState === 'visible') { state.rank = state.rank; schedule(); } });
  window.addEventListener('storage', schedule);
  var wasWide = window.innerWidth >= MIN;
  window.addEventListener('resize', function () {
    var wide = window.innerWidth >= MIN;
    if (wide === wasWide) return;
    wasWide = wide;
    if (!wide) dropHost(); else schedule();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.BMRail = { refresh: schedule };
})();
