/* ============================================================
   Mathorizon: the number of join requests waiting for a teacher, on the "Clase" tab of the nav.
   A student with a class code sends a request; the teacher accepts it on the Clase page (js/classes-page.js).
   Loaded by js/nav-loader.js on every page; does nothing for anyone but a teacher.
   ============================================================ */
(function () {
  'use strict';
  if (window.BMJoinBadge) return;

  let timer = null;

  function badges() {
    return [...document.querySelectorAll('.nav__link[data-authed-href="classes.html"], .nav__mobile-link[data-authed-href="classes.html"]')];
  }

  function set(n) {
    badges().forEach(link => {
      let b = link.querySelector('.bm-reqbadge');
      if (!n) { if (b) b.remove(); link.removeAttribute('data-pending'); return; }
      if (!b) { b = document.createElement('span'); b.className = 'bm-reqbadge'; link.appendChild(b); }
      b.textContent = n > 99 ? '99+' : String(n);
      b.setAttribute('role', 'status');
      b.setAttribute('aria-label', n === 1 ? 'O cerere de alăturare în așteptare' : n + ' cereri de alăturare în așteptare');
      link.setAttribute('data-pending', String(n));
    });
  }

  async function refresh() {
    const a = window.BMAuth;
    if (!a || !a.supabase || !a.user || a.role !== 'profesor') { set(0); return; }
    try {
      const { data, error } = await a.supabase.rpc('pending_join_count');
      if (!error && typeof data === 'number') set(data);
    } catch (e) { /* the migration is not run yet: no badge */ }
  }

  function start() {
    refresh();
    if (!timer) timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  }

  window.BMJoinBadge = { set, refresh };
  document.addEventListener('bmauth:profile', start);
  document.addEventListener('bmauth:ready', start);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  if (window._bmAuthReady) start();
})();
