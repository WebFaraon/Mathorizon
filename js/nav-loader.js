/* ============================================================
   Mathorizon — Shared Nav Loader
   Injects partials/nav.html into <nav id="nav-root"> and derives the
   active link from the URL. The outer <nav class="nav"> shell is static
   markup in every page (not injected) so it's positioned/colored by CSS
   from first paint — only the links/buttons inside it are fetched, so
   there's no layout shift and no unstyled flash while that happens.

   Other modules (theme.js, utils.js, auth.js, app.js/category.js,
   panels.js) bind to elements that live inside this partial (themeBtn,
   navHamburger, tokenWidget, navProfileBtn, favBtn, histBtn). Those
   modules' own init runs on DOMContentLoaded, which fires before this
   fetch resolves, so each of them also re-runs its init on the
   'nav:loaded' event dispatched below.
   ============================================================ */
(function () {
  'use strict';

  var navRoot = document.getElementById('nav-root');
  if (!navRoot) return;

  // Race fix: every other module that touches nav markup (hamburger in
  // utils.js, panels.js, auth.js, app.js, category.js) used to bind via a
  // bare `document.addEventListener('nav:loaded', fn)` registered near the
  // bottom of the page's script list — AFTER heavier scripts earlier in the
  // list (the Supabase CDN bundle, data.js, custom-exercises.js). On a slow
  // or uncached first load those take long enough that this partial's own
  // tiny same-origin fetch resolves and dispatches 'nav:loaded' BEFORE that
  // later listener is even registered, so it's never called — hamburger
  // clicks (and everything else gated the same way) silently do nothing
  // until the next load, once those scripts are warm in cache. BM.onNavReady
  // closes the race without a setTimeout: it runs fn() immediately when nav
  // is already injected, and only falls back to the event for callers that
  // genuinely got here first.
  window.BM = window.BM || {};
  window.BM.navLoaded = false;
  window.BM.onNavReady = function (fn) {
    if (window.BM.navLoaded) { fn(); return; }
    document.addEventListener('nav:loaded', fn);
  };

  // class.html has no "Clasă" link of its own — it belongs under "Clase".
  var ACTIVE_ALIAS = { 'class.html': 'classes.html' };

  // Applies the correct href for the current best-known auth state (the
  // synchronous hint from js/auth-hint.js first, then real confirmation via
  // bmauth:ready). The 5 main tabs keep their real (authenticated) href for
  // everyone, guest included — a guest's click on them is intercepted
  // separately (see bindGuestTabToast) rather than routed to a different
  // page, so there's nothing to swap here. Safe to call more than once: it
  // always recomputes from data-authed-href, the one immutable source of
  // truth, rather than mutating href in place.
  function applyAuthLinks() {
    navRoot.querySelectorAll('[data-authed-href]').forEach(function (el) {
      el.setAttribute('href', el.getAttribute('data-authed-href'));
    });

    // Threads the page's own ?from= through to the nav's login/signup
    // links — e.g. a guest bounced off /capitole to /?from=/capitole
    // still has that destination attached once they click "Conectare" in
    // the nav, not just the big CTA button in the landing's own content.
    var from  = new URLSearchParams(location.search).get('from');
    var login  = navRoot.querySelector('#navGuestLogin');
    var signup = navRoot.querySelector('#navGuestSignup');
    if (login)  login.setAttribute('href',  'auth.html' + (from ? '?from=' + encodeURIComponent(from) : ''));
    if (signup) signup.setAttribute('href', 'auth.html?tab=signup' + (from ? '&from=' + encodeURIComponent(from) : ''));
  }

  function setActiveLink() {
    navRoot.querySelectorAll('.nav__link--active, .nav__mobile-link--active').forEach(function (el) {
      el.classList.remove('nav__link--active', 'nav__mobile-link--active');
    });

    var current = location.pathname.split('/').pop() || 'index.html';
    current = ACTIVE_ALIAS[current] || current;

    navRoot.querySelectorAll('.nav__link[href], .nav__mobile-link[href]').forEach(function (link) {
      var target = link.getAttribute('href').split('?')[0];
      if (target === current) {
        link.classList.add(
          link.classList.contains('nav__mobile-link') ? 'nav__mobile-link--active' : 'nav__link--active'
        );
      }
    });
  }

  function refreshNav() {
    applyAuthLinks();
    setActiveLink();
  }

  // A signed-out visitor sees the same 5 tabs, in the same order, styled
  // identically to an authenticated visitor — but clicking one goes nowhere;
  // it shows a toast pointing them at "Conectare" instead. Bound once, right
  // after injection (this partial's innerHTML is only ever set this one
  // time), and checks bm-guest at CLICK time rather than baking the
  // decision in up front, so it stays correct even if the auth hint is
  // still unconfirmed when the nav first paints. Authenticated visitors are
  // untouched: the check below is a no-op for them and the click proceeds
  // as a normal navigation.
  function bindGuestTabToast() {
    navRoot.querySelectorAll('.nav__link[data-authed-href], .nav__mobile-link[data-authed-href]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        if (!document.documentElement.classList.contains('bm-guest')) return;
        e.preventDefault();
        if (!window.BM || !window.BM.toast) return;
        var login = navRoot.querySelector('#navGuestLogin');
        window.BM.toast('Loghează-te ca să ai acces la restul funcțiilor.', 'info', 4000, {
          id: 'guestNavToast',
          closable: true,
          link: { href: login ? login.getAttribute('href') : 'auth.html', label: 'Conectare' }
        });
      });
    });
  }

  fetch('partials/nav.html')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (html) {
      navRoot.innerHTML = html;
      refreshNav();
      bindGuestTabToast();
      window.BM.navLoaded = true;
      document.dispatchEvent(new Event('nav:loaded'));
    })
    .catch(function (err) {
      console.error('[nav-loader] failed to load partials/nav.html:', err);
    });

  // The synchronous hint (js/auth-hint.js) can be wrong (stale token) —
  // once the real session is known, re-apply so link targets and the
  // active-tab highlight match the confirmed state, not just the guess.
  document.addEventListener('bmauth:ready', function () {
    if (navRoot.innerHTML) refreshNav();
  });
})();
