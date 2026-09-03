/* ============================================================
   Mathorizon — Landing Page: hero typewriter
   Hand-written (no library), runs once per page load, and respects
   prefers-reduced-motion. Runs as a normal synchronous script placed
   after the markup it targets, so no DOMContentLoaded wait is needed —
   the elements already exist by the time this executes.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* The full phrase always lives in the DOM as real text (#heroTypewriterFull,
     a .sr-only span — see index.html) for SEO/screen readers. This only
     types that SAME text into a second, aria-hidden span for the visual
     effect, so nothing accessible/indexable is ever missing, only what's
     painted mid-animation. */
  function runTypewriter() {
    var visible = document.getElementById('heroTypewriterVisible');
    var srText  = document.getElementById('heroTypewriterFull');
    var cursor  = document.getElementById('heroTypewriterCursor');
    if (!visible || !srText) return;
    var text = srText.textContent;

    if (reduceMotion) {
      visible.textContent = text;
      if (cursor) cursor.remove();
      return;
    }

    var TOTAL_MS = 1100;
    var delay = Math.max(18, Math.min(45, TOTAL_MS / text.length));
    var i = 0;
    (function typeNext() {
      visible.textContent = text.slice(0, i);
      i++;
      if (i <= text.length) {
        setTimeout(typeNext, delay);
      } else if (cursor) {
        setTimeout(function () { cursor.classList.add('is-done'); }, 300);
      }
    })();
  }

  runTypewriter();
})();
