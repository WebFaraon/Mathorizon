/* ============================================================
   Mathorizon — Simulare setup (bac.html), step 1 and 2 extras
   ============================================================
   What js/bac.js does not do for the redesigned setup flow:
   - fills the "situația ta" display with real data (finished
     simulations and best grade from 'bac-history', ExamTokens from
     BM.getTokens, unlimited for an admin),
   - keeps the token note next to the start key honest,
   - tilts a ticket a few degrees toward the pointer (mouse only, never
     under reduced motion) and lets a click anywhere on the ticket press
     its own Selectează key.
   bac.js calls BMSimSetup.refresh() whenever the setup view is shown
   again (after an exam finishes, a history clear, ...).
   ============================================================ */
(function () {
  'use strict';

  const HIST_KEY = 'bac-history';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function readHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]') || []; }
    catch (e) { return []; }
  }

  function refresh() {
    const isAdmin = window.BMAuth && window.BMAuth.role === 'admin';
    const tokens = (window.BM && BM.getTokens) ? BM.getTokens() : 0;
    const hist = readHistory();
    const grades = hist.map(h => Number(h.grade)).filter(g => !Number.isNaN(g));

    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('stCount', String(hist.length));
    set('stBest', grades.length ? Math.max(...grades).toFixed(2) : '-.--');
    set('stTokens', isAdmin ? '∞' : String(tokens));

    const note = isAdmin ? 'Cont admin: pornești fără să consumi tokenuri.'
      : tokens <= 0 ? 'Nu mai ai ExamTokenuri. O simulare costă un token.'
      : `O simulare costă 1 ExamToken. Ai ${tokens}, îți rămân ${tokens - 1} după pornire.`;
    document.querySelectorAll('[data-token-note]').forEach(el => {
      el.dataset.base = note;
      if (!el.dataset.picked) el.textContent = 'Alege mai întâi cum vei răspunde.';
      else el.textContent = note;
    });
  }

  /* Called by selectAnswerMethod in js/bac.js once a method is picked. */
  function methodPicked() {
    document.querySelectorAll('[data-token-note]').forEach(el => {
      el.dataset.picked = '1';
      el.textContent = el.dataset.base || el.textContent;
    });
  }

  function bindTickets() {
    const tickets = document.querySelectorAll('.st-choose .st-ticket');
    tickets.forEach(t => {
      const key = t.querySelector('.st-key');
      // A click anywhere on the ticket presses its key (the key itself is
      // the real control, so keyboard and screen readers use that one).
      t.addEventListener('click', e => {
        if (e.target.closest('.st-key') || !key) return;
        key.click();
      });
      if (reduced) return;
      t.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = t.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        t.style.setProperty('--ry', (x * 5).toFixed(2) + 'deg');
        t.style.setProperty('--rx', (-y * 4).toFixed(2) + 'deg');
      });
      t.addEventListener('pointerleave', () => {
        t.style.setProperty('--ry', '0deg');
        t.style.setProperty('--rx', '0deg');
      });
    });
  }

  window.BMSimSetup = { refresh, methodPicked };

  document.addEventListener('DOMContentLoaded', () => {
    refresh();
    bindTickets();
    // The status display runs its segment test once, then shows the figures.
    const status = document.querySelector('.st-status');
    setTimeout(() => status && status.classList.remove('st-boot'), reduced ? 0 : 650);
  });
  // Tokens and role arrive from the auth sync after first paint.
  ['bmauth:ready', 'bmauth:synced', 'bmauth:profile'].forEach(ev => document.addEventListener(ev, refresh));
  window.addEventListener('storage', refresh);
})();
