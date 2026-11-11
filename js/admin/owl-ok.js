/* ============================================================
   The owl on every success panel of the console (2026-11-11)
   ============================================================
   Enrolling a student, transferring one, assigning a replacement: each ends on a panel
   with a tick (.in-ok, .tr-ok). This script watches for those panels and swaps the tick
   for the Teorema owl (js/mascot.js, the Logo Kit one, mood "happy"):
     1. the owl pops up in the middle of the dialog, big, with a soft green ring,
     2. after a moment it glides up to its place and shrinks,
     3. the rest of the panel (title, details, keys) appears, each part after the other
        (the panels' own entrance animations start when the "stage" class leaves).
   With "reduce motion" the owl is simply there. No call site has to change.
   ============================================================ */
(function () {
  'use strict';
  var SEL = '.in-ok, .tr-ok';
  var HOLD = 1350;                         // how long the owl stays alone in the middle (ms)
  var loading = false, waiters = [], owls = [];
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function withMascot(cb) {
    if (window.TeoremaMascot) { cb(); return; }
    waiters.push(cb);
    if (loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = 'js/mascot.js';
    var done = function () { var w = waiters; waiters = []; w.forEach(function (f) { f(); }); };
    s.onload = done; s.onerror = done;     // no owl rather than no panel
    document.head.appendChild(s);
  }
  var theme = function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; };

  function arrive(panel) {
    if (panel.__owl) return;
    panel.__owl = true;
    var ring = panel.querySelector('[class$="__ring"]');
    var box = document.createElement('div');
    box.className = 'ok-owl';
    box.innerHTML = '<div class="ok-owl__m" aria-hidden="true"></div>';
    if (ring) ring.replaceWith(box); else panel.insertBefore(box, panel.firstChild);
    if (!calm) panel.classList.add('is-owl-stage');
    withMascot(function () {
      if (!panel.isConnected || !window.TeoremaMascot) return;
      try { owls.push(new window.TeoremaMascot.Mascot(box.firstChild, { mood: 'happy', theme: theme() })); } catch (e) { /* the box stays empty */ }
    });
    if (calm) return;
    requestAnimationFrame(function () {
      var pr = panel.getBoundingClientRect(), br = box.getBoundingClientRect();
      var top = Math.max(pr.top, 0), bottom = Math.min(pr.bottom, window.innerHeight);
      box.style.setProperty('--ok-dy', ((top + bottom) / 2 - (br.top + br.height / 2)) + 'px');
      box.classList.add('is-in');
      setTimeout(function () { panel.classList.remove('is-owl-stage'); }, HOLD);
    });
  }

  function sweep() {                       // stop updating owls whose panel is gone
    owls = owls.filter(function (m) {
      if (m.host && m.host.isConnected) return true;
      if (window.TeoremaMascot) window.TeoremaMascot.dispose(m);
      return false;
    });
  }

  new MutationObserver(function (list) {
    list.forEach(function (r) {
      r.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches(SEL)) arrive(n);
        else if (n.querySelectorAll) n.querySelectorAll(SEL).forEach(arrive);
      });
    });
    if (owls.length) sweep();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
