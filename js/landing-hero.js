/* ============================================================
   Mathorizon — Landing Page: hero typewriter + stats carousel
   Both hand-written (no library), run once per page load, and respect
   prefers-reduced-motion. Runs as a normal synchronous script placed
   after the markup it targets, so no DOMContentLoaded wait is needed —
   the elements already exist by the time this executes.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Hero typewriter ----
     The full phrase always lives in the DOM as real text (#heroTypewriterFull,
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

  /* ---- Stats carousel ----
     Desktop's staggered fade-in is pure CSS (see style.css). This only
     drives the MOBILE carousel — auto-rotate every 3s, loop forever, pause
     permanently once the user touches it, dot indicators. Skipped
     entirely under reduced motion — CSS stacks all three instead. */
  function initStatsCarousel() {
    var card  = document.getElementById('landingStatsCard');
    var track = document.getElementById('landingStatsTrack');
    if (!card || !track) return;
    var stats = Array.prototype.slice.call(track.querySelectorAll('.landing-stat'));
    var dots  = Array.prototype.slice.call(card.querySelectorAll('.landing-stats-dot'));
    if (!stats.length) return;

    var mq = window.matchMedia('(max-width: 768px)');
    var idx = 0;
    var timer = null;
    var stoppedByUser = false;

    function show(n) {
      idx = n;
      stats.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
      dots.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
    }

    function start() {
      if (reduceMotion || !mq.matches || stoppedByUser || timer) return;
      timer = setInterval(function () { show((idx + 1) % stats.length); }, 3000);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    show(0);
    start();

    card.addEventListener('touchstart', function () {
      stoppedByUser = true;
      stop();
    }, { passive: true });

    mq.addEventListener('change', function (e) {
      if (e.matches) start(); else stop();
    });
  }

  runTypewriter();
  initStatsCarousel();
})();
