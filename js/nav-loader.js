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

  function setActiveLink() {
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

  fetch('partials/nav.html')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (html) {
      navRoot.innerHTML = html;
      setActiveLink();
      document.dispatchEvent(new Event('nav:loaded'));
    })
    .catch(function (err) {
      console.error('[nav-loader] failed to load partials/nav.html:', err);
    });
})();
