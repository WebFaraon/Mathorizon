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
    try { sessionStorage.setItem('bm_leaving', Date.now() + ':1'); } catch (e) { /* ignore */ }   // the next page then starts with the owl too
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
    try { sessionStorage.setItem('bm_leaving', Date.now() + ':0'); } catch (e) { /* no storage: the new page just has no loader */ }
    waitTimer = setTimeout(showLoader, 350);
    // a navigation that never happens (a download, a blocked redirect) must not leave the page faded for good
    safeTimer = setTimeout(clearLeaving, 15000);
  }

  // The new page of a change this script started: its content stays hidden until the page is built and still, then ALL of
  // it fades in together (a page builds itself in steps, and showing the steps looked jerky). If that takes longer than a
  // moment, or the old page was already showing the owl, the owl is shown meanwhile.
  var booting = false, bootLoader = false;
  try {
    var parts = String(sessionStorage.getItem('bm_leaving') || '').split(':');
    sessionStorage.removeItem('bm_leaving');
    booting = !!+parts[0] && Date.now() - +parts[0] < 20000;
    bootLoader = parts[1] === '1';
  } catch (e) { /* ignore */ }
  if (booting) {
    root.classList.add('bm-leaving');
    var bootEl = null, owlAt = 0, started = Date.now(), lastChange = Date.now(), loaded = false, finished = false;
    var showBoot = function () {
      if (bootEl || finished || !document.body) return;
      bootEl = document.createElement('div');
      bootEl.className = 'bm-leave bm-leave--boot is-on';
      bootEl.innerHTML = loaderHTML();
      document.body.appendChild(bootEl);
      owlAt = Date.now();
    };
    // The page's own entrance effects (cards dealt one after the other, numbers powering up) are timed from the moment the
    // elements were built, i.e. while they are still hidden. They are finished off here, so the page comes in as ONE piece.
    var settleMotion = function () {
      if (!document.getAnimations) return;
      document.getAnimations().forEach(function (a) {
        try {
          var tm = a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming();
          var tg = a.effect && a.effect.target;
          if (!tm || tm.iterations === Infinity) return;
          if (tg && tg.closest && (tg.closest('.bm-leave') || tg.closest('#nav-root') || tg.closest('#appRail'))) return;
          a.finish();
        } catch (err) { /* an animation that cannot be finished simply plays on */ }
      });
    };
    var bootDone = function () {
      if (finished) return;
      finished = true;
      settleMotion();
      root.classList.add('bm-revealing');
      root.classList.remove('bm-leaving');
      if (bootEl) { bootEl.classList.remove('is-on'); var gone = bootEl; setTimeout(function () { if (gone.parentNode) gone.parentNode.removeChild(gone); }, 340); }
      setTimeout(function () { root.classList.remove('bm-revealing'); }, 420);
      bootEl = null;
      if (watcher) watcher.disconnect();
    };
    // anything still loading on screen: the pages' own spinners and skeletons
    var BUSY = '.classes-loading, .classes-spinner, .ai-loading, .ai-loading__spinner, .cap-card-skeleton, .cap-sidebar-section--skeleton, [aria-busy="true"]';
    var busyNow = function () {
      var list = document.querySelectorAll(BUSY);
      for (var i = 0; i < list.length; i++) { if (list[i].getClientRects().length && !list[i].closest('.bm-leave')) return true; }
      return false;
    };
    var watcher = null;
    if (window.MutationObserver) {
      watcher = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i], t = m.target;
          if (m.type === 'characterData') continue;   // typed text, counters: the page does these on purpose, over time
          if (m.type === 'childList') {
            var onlyText = true, k;
            for (k = 0; k < m.addedNodes.length; k++) if (m.addedNodes[k].nodeType !== 3) onlyText = false;
            for (k = 0; k < m.removedNodes.length; k++) if (m.removedNodes[k].nodeType !== 3) onlyText = false;
            if (onlyText) continue;
          }
          if (t.nodeType === 1 && t.closest && (t.closest('#nav-root') || t.closest('#appRail') || t.closest('.bm-leave'))) continue;
          lastChange = Date.now(); return;
        }
      });
      watcher.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    }
    // requests still on their way (the data the page shows): a page is "calm" only when none are, so numbers and lists do not pop in after the reveal
    var inflight = 0;
    if (window.fetch) {
      var realFetch = window.fetch;
      window.fetch = function () {
        inflight++;
        var done = function () { inflight--; lastChange = Date.now(); };
        var pr;
        try { pr = realFetch.apply(this, arguments); } catch (err) { done(); throw err; }
        return pr.then(function (r) { done(); return r; }, function (err) { done(); throw err; });
      };
    }
    var tick = function () {
      if (finished) return;
      var now = Date.now();
      if (!bootEl && (bootLoader || now - started > 260)) showBoot();
      var authOk = window._bmAuthReady === true || !document.querySelector('script[src*="auth.js"]');   // pages un-hide their content once the session is known
      var calm = authOk && now - lastChange >= 160 && inflight === 0 && !busyNow();
      var owlLongEnough = !bootEl || now - owlAt >= 420;
      if ((loaded && calm && owlLongEnough) || now - started > 2600) { bootDone(); return; }
      setTimeout(tick, 50);
    };
    window.addEventListener('load', function () { loaded = true; lastChange = Date.now(); });
    if (document.body) { if (bootLoader) showBoot(); }
    else {
      var bmo = new MutationObserver(function () { if (document.body) { bmo.disconnect(); if (bootLoader) showBoot(); } });
      bmo.observe(root, { childList: true });
    }
    tick();
  }

  // coming back with the browser's Back button can restore this page from memory, still faded
  window.addEventListener('pageshow', function (e) { if (e.persisted) clearLeaving(); });

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
  var NAV_KEY = 'bm_nav_html_v5';
  function prefillNav(nav) {
    try {
      var h = localStorage.getItem(NAV_KEY);
      if (!h || nav.firstElementChild) return;
      nav.innerHTML = h;
      // the profile button and the counters as they were last seen (same width as the real ones), so the navbar does not
      // re-flow when the real ones arrive a moment later
      var guest = root.classList.contains('bm-guest');
      var pill = localStorage.getItem(guest ? 'bm_nav_pill_guest' : 'bm_nav_pill_user');
      var btn = nav.querySelector('#navProfileBtn');
      if (pill && btn) { var tmp = document.createElement('div'); tmp.innerHTML = pill; var nb = tmp.firstElementChild; if (nb) btn.replaceWith(nb); }
      var cnt = JSON.parse(localStorage.getItem('bm_nav_counts_v1') || 'null');
      if (cnt && !guest) {
        nav.querySelectorAll('[data-token-count]').forEach(function (el) { if (cnt.t != null) el.textContent = cnt.t; });
        nav.querySelectorAll('[data-streak-count]').forEach(function (el) { if (cnt.s != null) el.textContent = cnt.s; });
      }
      var cur = location.pathname.split('/').pop() || 'index.html';
      if (cur === 'class.html') cur = 'classes.html';
      nav.querySelectorAll('.nav__link[href], .nav__mobile-link[href]').forEach(function (a) {
        if (a.getAttribute('href').split('?')[0] === cur) a.classList.add(a.classList.contains('nav__mobile-link') ? 'nav__mobile-link--active' : 'nav__link--active');
      });
    } catch (err) { /* storage blocked: nav-loader fetches it */ }
  }
  // remember the real profile button and counters when the page is left
  window.addEventListener('pagehide', function () {
    try {
      var b = document.getElementById('navProfileBtn');
      if (b && b.firstElementChild) {
        var isPill = b.classList.contains('nav-profile-btn--pill'), isCta = b.classList.contains('nav-profile-btn--cta');
        if (isPill || isCta) localStorage.setItem(isPill ? 'bm_nav_pill_user' : 'bm_nav_pill_guest', b.outerHTML);
      }
      var t = document.querySelector('[data-token-count]'), st = document.querySelector('[data-streak-count]');
      if (t && st && t.textContent !== '\u2014' && st.textContent !== '\u2014') localStorage.setItem('bm_nav_counts_v1', JSON.stringify({ t: t.textContent, s: st.textContent }));
    } catch (err) { /* ignore */ }
  });
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
        if (el.id === 'nav-root' || el.id === 'appRail' || /^(SCRIPT|STYLE|LINK)$/.test(el.tagName)) return;
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
