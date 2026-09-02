/* ============================================================
   Mathorizon — Theme Toggle (light / dark)
   Loaded first in <head> to avoid flash of wrong theme.
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'bm_theme';

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = document.getElementById('themeBtn');
    // btn lives inside the nav partial (js/nav-loader.js) and window.icon
    // comes from js/icons.js — both load synchronously on every page, but
    // neither exists yet during this function's very first call (line 16
    // below, before either script below it in <head>/<body> has run), so
    // both are guarded rather than assumed present.
    if (btn && window.icon) {
      btn.innerHTML = window.icon(theme === 'dark' ? 'sun' : 'moon', { size: 20 });
    }
  }

  /* Apply immediately before first paint */
  apply(localStorage.getItem(KEY) || 'light');

  window.BM = window.BM || {};
  window.BM.toggleTheme = function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);

    // Every .ex-card (and its children) has its own background/border-
    // color/box-shadow transition for its OWN hover/open states — those
    // weren't meant to all fire at once, but changing data-theme flips the
    // CSS variables they read from, so every visible card starts animating
    // simultaneously. With a full subcategory list open that's dozens of
    // cards each independently transitioning a paint-heavy property
    // (box-shadow in particular can't be composited, it forces a repaint
    // every frame), which is exactly the multi-frame/stepped look reported
    // here instead of one clean swap. Disabling transitions for a single
    // frame around the swap makes it one instant repaint instead — still
    // reads as "smooth" (arguably more so than a struggling animation),
    // and doesn't touch any other transition since the class is removed
    // again immediately after.
    var root = document.documentElement;
    root.classList.add('theme-switching');
    apply(next);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.remove('theme-switching');
      });
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    apply(localStorage.getItem(KEY) || 'light');
  });

  // themeBtn lives inside the async-injected nav (see js/nav-loader.js) —
  // it doesn't exist yet at DOMContentLoaded, so re-sync once it's there.
  document.addEventListener('nav:loaded', function () {
    apply(document.documentElement.getAttribute('data-theme') || 'light');
  });
})();
