/* ============================================================
   Teorema owl on the pages (2026-11-11)
   ============================================================
   One small helper so any page can show the owl of the Logo Kit (js/mascot.js) in one of its
   moods without loading anything by hand:

     <span class="owl owl--md" data-owl="idle"></span>     any element with data-owl is filled
                                                           with the owl when it appears in the page
     idle     "Atentă"      eyes follow the cursor: start page, sign-in, empty states
     wrong    "Încurajare"  a gentle drop and brows: a wrong answer
     verify   "Verifică"    a magnifier: the AI checks a solution
     load     "Se încarcă"  instead of the round spinner
     sleep    "Doarme"      night: after 22:00 "Du-te la culcare, mâine repetăm"

   - Every round spinner of the site (.classes-spinner, .ai-loading__spinner) turns into the owl by
     itself: "verify" when the text next to it speaks of the AI, "load" otherwise. The element stays,
     so code that looks for it keeps working; until the owl is ready the old spinner turns.
   - Pages with <body data-owl-night> get the sleeping owl card after 22:00 (Europe/Chisinau, until
     05:00), once per evening, never over a live lesson or exam.
   - The owl follows the light/dark theme (data-theme on <html>).
   - "Reduce motion": the owl is shown but nothing hops or slides.
   Plain script; js/mascot.js is fetched the first time an owl is needed.
   ============================================================ */
(function () {
  'use strict';
  var cur = document.currentScript && document.currentScript.src;
  var base = cur ? cur.replace(/owl\.js(\?.*)?$/, '') : 'js/';
  var loading = 0, waiters = [], owls = [];
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var theme = function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; };

  function withMascot(cb) {
    if (window.TeoremaMascot) { cb(); return; }
    waiters.push(cb);
    if (loading) return;
    loading = 1;
    var s = document.createElement('script');
    s.src = base + 'mascot.js';
    var done = function () { var w = waiters; waiters = []; w.forEach(function (f) { f(); }); };
    s.onload = done; s.onerror = done;           // no owl rather than a broken page
    (document.head || document.documentElement).appendChild(s);
  }

  function hydrate(el) {
    if (el.__owl) return;
    var mood = el.getAttribute('data-owl') || 'idle';
    withMascot(function () {
      if (!el.isConnected || el.__owl || !window.TeoremaMascot) return;
      try {
        var m = new window.TeoremaMascot.Mascot(el, { mood: mood, theme: el.getAttribute('data-owl-theme') || theme() });
        el.__owl = m; owls.push(m);
        el.classList.add('is-owl');
      } catch (e) { /* the element stays empty */ }
    });
  }

  /* the round spinners of the site */
  var SPIN = '.classes-spinner, .ai-loading__spinner';
  function spin(el) {
    if (el.__owlSpin) return;
    el.__owlSpin = 1;
    if (el.closest('.wb-fullscreen')) return;      // the live board has its own row-of-cells loader
    var host = el.parentNode, p = host && host.querySelector('p, .ai-loading__text');
    var txt = (p && p.textContent) || (host && host.textContent) || '';
    el.setAttribute('data-owl', /\bAI\b|analiz|evalu|verific|Gemini/i.test(txt) ? 'verify' : 'load');
    el.classList.add('owl--spin');       // the size comes with .is-owl, once the owl is in (the ring turns until then)
    hydrate(el);
  }

  function scan(n) {
    if (n.nodeType !== 1) return;
    if (n.matches('[data-owl]')) hydrate(n);
    if (n.matches(SPIN)) spin(n);
    n.querySelectorAll('[data-owl]').forEach(hydrate);
    n.querySelectorAll(SPIN).forEach(spin);
  }

  function sweep() {                              // stop updating owls whose element left the page
    owls = owls.filter(function (m) {
      if (m.host && m.host.isConnected) return true;
      if (window.TeoremaMascot) window.TeoremaMascot.dispose(m);
      return false;
    });
  }

  var mo = new MutationObserver(function (list) {
    list.forEach(function (r) { r.addedNodes.forEach(scan); });
    if (owls.length > 40) sweep();
  });
  function start() {
    mo.observe(document.documentElement, { childList: true, subtree: true });
    scan(document.documentElement);
    new MutationObserver(function () {
      owls.forEach(function (m) { if (m.host && !m.host.getAttribute('data-owl-theme') && m.theme !== theme()) { m.theme = theme(); m.build(); } });
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.body && document.body.hasAttribute('data-owl-night')) setTimeout(night, 1400);
  }

  /* ---------- the sleeping owl, after 22:00 ---------- */
  var TZ = 'Europe/Chisinau';
  function night() {
    var now = new Date();
    var h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).format(now)) % 24;
    if (!(h >= 22 || h < 5)) return;
    var evening = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date(now.getTime() - 6 * 3600e3));   // 00:00 to 05:00 still belongs to the evening before
    var key = 'teorema_owl_night';
    try { if (localStorage.getItem(key) === evening) return; } catch (e) { /* no storage: it shows */ }
    if (document.getElementById('owlNight')) return;
    var busy = document.querySelector('#trainingHud:not([hidden]), .sim-exam-overlay, .wb-fullscreen, #examView:not([hidden])');
    if (busy) { setTimeout(night, 5 * 60e3); return; }
    var box = document.createElement('aside');
    box.id = 'owlNight';
    box.className = 'owl-night';
    box.setAttribute('role', 'status');
    box.innerHTML =
      '<span class="owl owl--md owl-night__owl" data-owl="sleep" aria-hidden="true"></span>' +
      '<div class="owl-night__t"><small>E târziu</small><b>Du-te la culcare, mâine repetăm.</b>' +
      '<span>Ce ai învățat azi se fixează în somn. Un creier odihnit rezolvă mai repede.</span></div>' +
      '<button type="button" class="owl-night__x">Mai stau puțin</button>';
    box.querySelector('.owl-night__x').onclick = function () {
      try { localStorage.setItem(key, evening); } catch (e) { /* ignore */ }
      box.classList.add('is-out');
      setTimeout(function () { box.remove(); }, 380);
    };
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('is-in'); });
  }

  window.BMOwl = {
    /* put the owl into an element right now */
    mount: function (el, mood, opts) {
      el.setAttribute('data-owl', mood || 'idle');
      if (opts && opts.theme) el.setAttribute('data-owl-theme', opts.theme);
      el.classList.add('owl');
      hydrate(el);
    },
    /* the markup of an owl, for strings built in script: BMOwl.html('wrong', 'md') */
    html: function (mood, size, extra) {
      return '<span class="owl owl--' + (size || 'md') + (extra ? ' ' + extra : '') + '" data-owl="' + mood + '" aria-hidden="true"></span>';
    },
    night: night,
    isCalm: calm
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
