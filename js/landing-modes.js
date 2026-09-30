/* ============================================================
   Mathorizon — Landing page MODE keys (index.html)
   ============================================================
   The landing page is one calculator: four MODE keys (BAC, Clasa a 9-a,
   Profesor, Test) switch what the display shows and which action sits
   next to it. Real tabs underneath (role="tablist" / "tab" / "tabpanel",
   arrow keys, Home/End), so it works by keyboard and screen reader. A
   #bac / #gimnaziu / #profesor / #test hash opens that mode directly.

   The four panels share one grid cell (.ld-stage in css/calculator.css),
   so the calculator keeps the height of the tallest one. Switching is a
   carousel: panels before the active one wait on the left, panels after
   it on the right (is-before / is-after), the old one slides out toward
   its side and the new one in from its own. The display's lines then
   print in with Motion (motion.dev, loaded by index.html into
   window.BMMotion); without it, or under reduced motion, the panel just
   swaps.
   ============================================================ */
(function () {
  'use strict';

  const tabs = Array.from(document.querySelectorAll('.ld-mode[role="tab"]'));
  if (!tabs.length) return;
  const calc   = document.querySelector('.ld-calc');
  const stage  = document.querySelector('.ld-stage');
  const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Prints a panel's lines in, one after another. Returns the animation
     (or null) so a caller can wait for it. */
  function printIn(panel) {
    const M = window.BMMotion;
    if (!M || reduced || !panel) return null;
    const lines = panel.querySelectorAll('.ld-print');
    if (!lines.length) return null;
    return M.animate(lines,
      { opacity: [0, 1], clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] },
      { duration: 0.28, ease: 'linear', delay: M.stagger(0.06) });
  }

  /* First paint: the lines stay hidden (.is-pre) until they print in, so
     they don't flash visible first. If Motion never arrives (blocked CDN),
     reveal them plainly after a short wait. */
  function revealFirst(panel) {
    const done = () => calc.classList.remove('is-pre');
    const run = printIn(panel);
    if (run && run.finished) run.finished.then(done, done); else done();
    setTimeout(done, 1600);
  }

  /* One size for every mode. The stage already keeps the calculator's
     total height; when the layout is a single column (phones) the display
     and the action column each take the height of the tallest one, so the
     LCD itself stays the same size when the mode changes. Measured with
     the panels' natural heights (.ld-measure), redone when fonts load, on
     resize, and when the waitlist form opens. */
  function equalize() {
    stage.classList.add('ld-measure');
    let screenH = 0, actionH = 0;
    panels.forEach(p => {
      screenH = Math.max(screenH, p.querySelector('.ld-screen').offsetHeight);
      actionH = Math.max(actionH, p.querySelector('.ld-action').offsetHeight);
    });
    stage.style.setProperty('--ld-screen-h', screenH + 'px');
    stage.style.setProperty('--ld-action-h', actionH + 'px');
    stage.classList.remove('ld-measure');
  }
  let eqTimer = 0;
  const equalizeSoon = () => { clearTimeout(eqTimer); eqTimer = setTimeout(equalize, 80); };
  window.addEventListener('resize', equalizeSoon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(equalize);
  const wl = document.getElementById('waitlistDynamic');
  if (wl && window.MutationObserver) new MutationObserver(equalizeSoon).observe(wl, { childList: true, subtree: true });
  equalize();

  function activate(tab, { focus = false, instant = false } = {}) {
    const index = tabs.indexOf(tab);
    if (instant) stage.classList.add('ld-instant');
    tabs.forEach((t, i) => {
      const on = i === index;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle('is-on', on);
      const panel = panels[i];
      panel.classList.toggle('is-active', on);
      panel.classList.toggle('is-before', i < index);
      panel.classList.toggle('is-after', i > index);
      panel.inert = !on;
    });
    if (instant) {
      // Let the state settle without transitions, then turn them back on.
      requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('ld-instant')));
    } else {
      printIn(panels[index]);
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
  const first = fromHash || tabs[0];
  activate(first, { instant: true });

  // Power-on: the figures display runs its segment test once, then the
  // first mode prints in as the page settles.
  const boot = document.querySelector('.ld-figures');
  setTimeout(() => boot && boot.classList.remove('ld-boot'), reduced ? 0 : 650);
  const firstPanel = panels[tabs.indexOf(first)];
  if (window.BMMotion) setTimeout(() => revealFirst(firstPanel), 450);
  // Motion arriving late: reveal without re-printing lines already read.
  else document.addEventListener('bm:motion', () => {
    if (performance.now() < 1500) setTimeout(() => revealFirst(firstPanel), 450);
  }, { once: true });
  setTimeout(() => calc.classList.remove('is-pre'), 2200);
})();
