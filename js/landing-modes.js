/* ============================================================
   Mathorizon — Landing page MODE keys (index.html)
   ============================================================
   The landing page is one calculator: four MODE keys (BAC, Clasa a 9-a,
   Profesor, Test) switch what the display shows and which action sits
   next to it. Real tabs underneath (role="tablist" / "tab" / "tabpanel",
   arrow keys, Home/End), so it works by keyboard and screen reader. A
   #bac / #gimnaziu / #profesor / #test hash opens that mode directly.

   Motion (motion.dev, loaded by index.html into window.BMMotion) prints
   the display's lines in on every switch; without it, or under reduced
   motion, the panel simply swaps.
   ============================================================ */
(function () {
  'use strict';

  const tabs = Array.from(document.querySelectorAll('.ld-mode[role="tab"]'));
  if (!tabs.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function printIn(panel) {
    const M = window.BMMotion;
    if (!M || reduced) return;
    const lines = panel.querySelectorAll('.ld-print');
    if (!lines.length) return;
    M.animate(lines,
      { opacity: [0, 1], clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] },
      { duration: 0.28, ease: 'linear', delay: M.stagger(0.06) });
  }

  function activate(tab, { focus = false, animate = true } = {}) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle('is-on', on);
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    const screen = panel && panel.querySelector('.ld-screen');
    if (screen && animate && !reduced) {
      // An LCD refreshes: a short strobe, then the lines print in.
      screen.classList.remove('ld-refresh');
      void screen.offsetWidth;
      screen.classList.add('ld-refresh');
      printIn(panel);
    }
    if (focus) tab.focus();
    if (history.replaceState) history.replaceState(null, '', '#' + tab.dataset.mode);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', e => {
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); activate(next, { focus: true }); }
    });
  });

  const fromHash = tabs.find(t => '#' + t.dataset.mode === location.hash);
  activate(fromHash || tabs[0], { animate: false });

  // Power-on: the figures display runs its segment test once, then the
  // first mode prints in as the page settles.
  const boot = document.querySelector('.ld-figures');
  setTimeout(() => boot && boot.classList.remove('ld-boot'), reduced ? 0 : 650);
  const firstPanel = document.getElementById((fromHash || tabs[0]).getAttribute('aria-controls'));
  if (window.BMMotion) setTimeout(() => printIn(firstPanel), 450);
  // Motion arriving late: skip, or it would re-print lines already read.
  else document.addEventListener('bm:motion', () => {
    if (performance.now() < 1500) printIn(firstPanel);
  }, { once: true });
})();
