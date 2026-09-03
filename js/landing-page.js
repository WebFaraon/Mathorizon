/* ============================================================
   Mathorizon — Landing Page (index.html)
   Waitlist signup for the "Clasa a 9-a" route card — link → inline
   form → success, all within the same card, no modal/page.
   ============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'bm_waitlist_9';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const dynamic = document.getElementById('waitlistDynamic');
  if (!dynamic) return;

  function readSaved() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function writeSaved(email) {
    try { localStorage.setItem(STORAGE_KEY, email); } catch (e) {}
  }

  function renderDefault() {
    // Same btn--ghost treatment as the other 3 route cards' CTAs, not a
    // bare text link, so all four cards read as one consistent button style.
    dynamic.innerHTML =
      '<div class="chapter-card__desc">Lucrăm la exerciții și teste pentru treapta gimnazială. Lasă-ți emailul și te anunțăm primul.</div>' +
      '<div class="route-card__footer">' +
        '<a href="#" class="btn btn--ghost btn--lg btn--full" id="waitlistLinkBtn">Anunță-mă când e gata</a>' +
      '</div>';
    document.getElementById('waitlistLinkBtn').addEventListener('click', function (e) {
      e.preventDefault();
      renderForm();
    });
  }

  function renderForm() {
    dynamic.innerHTML =
      '<form class="route-card__waitlist-form" id="waitlistForm" novalidate>' +
        '<div class="route-card__waitlist-row">' +
          '<input type="email" class="auth-input route-card__waitlist-input" id="waitlistEmail" placeholder="email@exemplu.com" autocomplete="email" required>' +
          '<button type="submit" class="btn btn--primary btn--sm">Trimite</button>' +
        '</div>' +
        // Honeypot — real visitors never see or fill this; a non-empty
        // value on submit means it was an automated fill, not a person.
        '<input type="text" name="website" id="waitlistHoneypot" class="route-card__honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<p class="route-card__waitlist-error" id="waitlistError" style="display:none"></p>' +
      '</form>';
    const form = document.getElementById('waitlistForm');
    document.getElementById('waitlistEmail').focus();
    form.addEventListener('submit', onSubmit);
  }

  function renderSuccess(email) {
    dynamic.innerHTML =
      '<div class="chapter-card__desc">Gata. Te anunțăm pe <strong>' + BM.esc(email) + '</strong> când exercițiile pentru clasa a 9-a sunt disponibile.</div>';
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errorEl   = document.getElementById('waitlistError');
    const input     = document.getElementById('waitlistEmail');
    const honeypot  = document.getElementById('waitlistHoneypot');
    const btn       = document.querySelector('#waitlistForm button[type="submit"]');
    const email     = input.value.trim();

    errorEl.style.display = 'none';

    if (!EMAIL_RE.test(email)) {
      errorEl.textContent = 'Introdu o adresă de email validă.';
      errorEl.style.display = '';
      return;
    }

    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = 'Se trimite<span class="btn-loading-spin"></span>';

    try {
      let res;
      try {
        res = await fetch('/api/waitlist/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, clasa: '9', sursa: 'landing', website: honeypot.value })
        });
      } catch (networkErr) {
        // fetch() itself rejects (not just a non-2xx response) when the
        // server can't be reached at all — connection refused, no server
        // listening on this origin, etc.
        console.error('[waitlist] network error contacting /api/waitlist/join:', networkErr);
        throw new Error('Nu s-a putut contacta serverul. Verifică dacă rulează.');
      }

      const bodyText = await res.text().catch(function () { return ''; });
      let data = {};
      try { data = bodyText ? JSON.parse(bodyText) : {}; } catch (e) {}

      if (!res.ok) {
        console.error('[waitlist] /api/waitlist/join failed — status:', res.status, 'body:', bodyText);
        // A 404 here means the origin serving this page has no /api/*
        // routes at all (e.g. the static-only dev server) rather than the
        // API rejecting the request — distinct message, not "A apărut o
        // eroare" for something that isn't a server-side validation error.
        if (res.status === 404) {
          throw new Error('Acest server nu are API activ pe acest port. Rulează "node server.js" și accesează pagina de acolo.');
        }
        throw new Error(data.error || ('A apărut o eroare de la server (cod ' + res.status + ').'));
      }

      writeSaved(email);
      renderSuccess(email);
    } catch (err) {
      errorEl.textContent = err.message || 'A apărut o eroare. Încearcă din nou.';
      errorEl.style.display = '';
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  const saved = readSaved();
  if (saved) {
    renderSuccess(saved);
  } else {
    renderDefault();
  }
})();
