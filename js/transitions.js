/* ============================================================
   Teorema: smooth page changes (2026-11-13)
   ============================================================
   The site is a set of separate pages, so going from one tab to another used to be a hard reload: the page
   went blank, the navbar vanished and came back, then the new content popped in. This keeps that structure
   (no router, nothing re-written) and hides the seams:

   1. The navbar is in the new page from its very first paint (js/nav-loader.js keeps its markup) and has its
      own view-transition name (css/style.css, end), so it stays where it is.
   2. The browser cross-fades the old page into the new one (cross-document view transitions, Chrome, Edge,
      Safari). In browsers without that, this file fades the new page in itself.
   3. The moment a link is followed, the old content fades out here (html.bm-leaving), and when the next
      page is slow (over ~0.35 s) the owl comes up in the middle with a sliding bar, so the screen never sits
      empty or frozen.
   4. Links the visitor is about to follow are fetched ahead of time (speculation rules, where supported).
   ============================================================ */
(function () {
  'use strict';
  var root = document.documentElement;
  var canVT = 'onpagereveal' in window;
  if (!canVT) root.classList.add('bm-no-vt');

  var waitTimer = 0, safeTimer = 0;

  function clearLeaving() {
    clearTimeout(waitTimer); clearTimeout(safeTimer);
    window.removeEventListener('beforeunload', askGuard);
    root.classList.remove('bm-leaving');
    var l = document.querySelector('.bm-leave');
    if (l && l.parentNode) l.parentNode.removeChild(l);
  }

  function showLoader() {
    if (document.querySelector('.bm-leave') || !document.body) return;
    var d = document.createElement('div');
    d.className = 'bm-leave';
    d.setAttribute('role', 'status');
    d.setAttribute('aria-label', 'Se încarcă');
    d.innerHTML = loaderHTML();
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add('is-on'); });
  }

  // the same owl and bar on the old page (while the next one loads) and on the new page (while it starts), so the two
  // cross-fade into each other without a jump; drawn by css alone, since nothing else is loaded yet at that moment
  function loaderHTML() {
    return '<div class="bm-leave__img"></div><div class="bm-leave__bar"><i></i></div>';
  }

  // A page that asks "leave this page?" (an exam in progress) must not sit faded behind that question: the last
  // 'beforeunload' listener, added now so it runs after the page's own, drops the fade when a question is coming.
  function askGuard(e) {
    window.removeEventListener('beforeunload', askGuard);
    if (e.defaultPrevented || e.returnValue) clearLeaving();
  }

  function startLeaving() {
    if (root.classList.contains('bm-leaving')) return;
    window.addEventListener('beforeunload', askGuard);
    root.classList.add('bm-leaving');
    try { sessionStorage.setItem('bm_leaving', String(Date.now())); } catch (e) { /* no storage: the new page just has no loader */ }
    waitTimer = setTimeout(showLoader, 350);
    // a navigation that never happens (a download, a blocked redirect) must not leave the page faded for good
    safeTimer = setTimeout(clearLeaving, 15000);
  }

  // The new page of a change this script started: its content stays hidden behind the same owl until the page has loaded,
  // then fades in. (The first paint of a page is mostly empty: its content is built by script a moment later.)
  var booting = false;
  try {
    var ts = +sessionStorage.getItem('bm_leaving');
    sessionStorage.removeItem('bm_leaving');
    booting = !!ts && Date.now() - ts < 20000;
  } catch (e) { /* ignore */ }
  if (booting) {
    root.classList.add('bm-leaving');
    var bootEl = null;
    var addBoot = function () {
      if (bootEl || !document.body) return;
      bootEl = document.createElement('div');
      bootEl.className = 'bm-leave bm-leave--boot is-on';
      bootEl.innerHTML = loaderHTML();
      document.body.appendChild(bootEl);
    };
    var bootDone = function () {
      if (!bootEl && !root.classList.contains('bm-leaving')) return;
      root.classList.add('bm-revealing');
      root.classList.remove('bm-leaving');
      if (bootEl) { bootEl.classList.remove('is-on'); var gone = bootEl; setTimeout(function () { if (gone.parentNode) gone.parentNode.removeChild(gone); }, 320); }
      setTimeout(function () { root.classList.remove('bm-revealing'); }, 380);
      bootEl = null;
    };
    if (document.body) addBoot();
    else {
      var bmo = new MutationObserver(function () { if (document.body) { bmo.disconnect(); addBoot(); } });
      bmo.observe(root, { childList: true });
    }
    var started = Date.now();
    window.addEventListener('load', function () { setTimeout(bootDone, Math.max(60, 380 - (Date.now() - started))); });
    setTimeout(bootDone, 6000);
  }

  // coming back with the browser's Back button can restore this page from memory, still faded
  window.addEventListener('pageshow', clearLeaving);

  function sameOriginPage(u) {
    try {
      var url = new URL(u, location.href);
      if (url.origin !== location.origin) return false;
      if (url.pathname === location.pathname && url.search === location.search) return false;   // a hash change or the same page
      return true;
    } catch (e) { return false; }
  }

  // A click starts the fade at once (the navigate event below can arrive a moment later); the navigate event also catches the
  // navigations that are not clicks (a button that sets location.href, a redirect done in script).
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    if (/^(mailto|tel|javascript):/i.test(a.getAttribute('href'))) return;
    if (sameOriginPage(a.href)) startLeaving();
  });
  if (window.navigation && typeof window.navigation.addEventListener === 'function') {
    window.navigation.addEventListener('navigate', function (e) {
      if (e.hashChange || e.downloadRequest != null || e.defaultPrevented) return;
      if (e.navigationType === 'reload' || e.navigationType === 'traverse') return;
      if (e.destination && e.destination.sameDocument) return;
      if (!sameOriginPage(e.destination && e.destination.url)) return;
      startLeaving();
    });
  }

  // The navbar of the last visit is put in the moment its (empty) element is parsed, before the first paint, so the new
  // page never shows a bare strip where the navbar goes. js/nav-loader.js keeps the copy fresh.
  var NAV_KEY = 'bm_nav_html_v1';
  function prefillNav(nav) {
    try {
      var h = localStorage.getItem(NAV_KEY);
      if (!h || nav.firstElementChild) return;
      nav.innerHTML = h;
      var cur = location.pathname.split('/').pop() || 'index.html';
      if (cur === 'class.html') cur = 'classes.html';
      nav.querySelectorAll('.nav__link[href], .nav__mobile-link[href]').forEach(function (a) {
        if (a.getAttribute('href').split('?')[0] === cur) a.classList.add(a.classList.contains('nav__mobile-link') ? 'nav__mobile-link--active' : 'nav__link--active');
      });
    } catch (err) { /* storage blocked: nav-loader fetches it */ }
  }
  var navEl = document.getElementById('nav-root');
  if (navEl) prefillNav(navEl);
  else {
    var mo = new MutationObserver(function () {
      var n = document.getElementById('nav-root');
      if (n) { mo.disconnect(); prefillNav(n); }
    });
    mo.observe(root, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () { mo.disconnect(); });
  }

  // Without cross-document view transitions the new page fades in on its own (everything but the navbar).
  if (!canVT && !booting) {
    var enter = function () {
      if (!document.body || !document.body.animate) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el.id === 'nav-root' || /^(SCRIPT|STYLE|LINK)$/.test(el.tagName)) return;
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease' });
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enter); else enter();
  }

  // Warm-up while the browser is idle: the owl of the loader (so it is ready when needed) and the next pages.
  function warm() {
    var head = document.head || root;
    if (!document.querySelector('script[src*="owl.js"]')) {
      var c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'css/owl.css'; head.appendChild(c);
      var s = document.createElement('script'); s.src = 'js/owl.js'; s.defer = true; head.appendChild(s);
    }
    var p = document.createElement('link'); p.rel = 'prefetch'; p.as = 'script'; p.href = 'js/mascot.js'; head.appendChild(p);
    if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules') && !document.querySelector('script[type="speculationrules"]')) {
      var sr = document.createElement('script');
      sr.type = 'speculationrules';
      sr.textContent = JSON.stringify({
        prefetch: [{
          where: { and: [
            { href_matches: '/*' },
            { not: { href_matches: ['/admin*', '/registru*', '/auth*', '/api/*'] } },
            { not: { selector_matches: '[target=_blank], [download]' } }
          ] },
          eagerness: 'moderate'
        }]
      });
      head.appendChild(sr);
    }
  }
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
  window.addEventListener('load', function () { idle(warm); });
})();
