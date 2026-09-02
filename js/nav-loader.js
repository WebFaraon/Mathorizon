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

  // class.html has no "Clasă" link of its own — it belongs under "Clase".
  var ACTIVE_ALIAS = { 'class.html': 'classes.html' };

  // Guest (nelogat) visitors get the public preview of each section instead
  // of the real, account-gated page — same 5 tabs, same order, same labels,
  // different destination. Keyed by the authenticated href's filename (the
  // one baked into the template — see data-authed-href below).
  var GUEST_DESTINATION = {
    'capitole.html': 'capitole-preview.html',
    'bac.html':       'simulare-preview.html',
    'training.html':  'antrenament-preview.html',
    'classes.html':   'clase-preview.html',
    'pachete.html':   'pachete-preview.html'
  };

  // Applies the correct href for the current best-known auth state (the
  // synchronous hint from js/auth-hint.js first, then real confirmation via
  // bmauth:ready) — the authenticated destinations are the template's
  // default markup ("exact ce e acum, nemodificat"), this only overrides
  // them for a guest. Safe to call more than once: it always recomputes
  // from data-authed-href, the one immutable source of truth, rather than
  // mutating href in place.
  function applyAuthLinks() {
    var isGuest = document.documentElement.classList.contains('bm-guest');
    navRoot.querySelectorAll('[data-authed-href]').forEach(function (el) {
      var authedHref = el.getAttribute('data-authed-href');
      var guestHref  = GUEST_DESTINATION[authedHref.split('?')[0]];
      el.setAttribute('href', isGuest && guestHref ? guestHref : authedHref);
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

  fetch('partials/nav.html')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (html) {
      navRoot.innerHTML = html;
      refreshNav();
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
