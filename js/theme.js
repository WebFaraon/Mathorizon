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
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '☽';
  }

  /* Apply immediately before first paint */
  apply(localStorage.getItem(KEY) || 'light');

  window.BM = window.BM || {};
  window.BM.toggleTheme = function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    apply(next);
  };

  document.addEventListener('DOMContentLoaded', function () {
    apply(localStorage.getItem(KEY) || 'light');
  });
})();
