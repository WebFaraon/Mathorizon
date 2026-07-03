/* ============================================================
   Mathorizon — Pachete (Pricing) Page
   ============================================================ */

(function () {
  'use strict';

  function init() {
    BM.initScrollTop();
    initBillingToggle();
    initFaq();
    initPurchaseButtons();
  }

  /* ---- Billing toggle: swaps displayed price between monthly / yearly ---- */
  function initBillingToggle() {
    const toggle = document.getElementById('billingToggle');
    if (!toggle) return;

    toggle.addEventListener('click', function (e) {
      const btn = e.target.closest('.billing-toggle__btn');
      if (!btn) return;
      const billing = btn.dataset.billing;

      toggle.querySelectorAll('.billing-toggle__btn').forEach(function (b) {
        const active = b === btn;
        b.classList.toggle('billing-toggle__btn--active', active);
        b.setAttribute('aria-selected', String(active));
      });

      document.querySelectorAll('.pricing-card__price-val[data-monthly]').forEach(function (el) {
        const val = billing === 'yearly' ? el.dataset.yearly : el.dataset.monthly;
        el.textContent = val;
      });

      document.querySelectorAll('[data-yearly-note]').forEach(function (note) {
        const priceEl = note.closest('.pricing-card__head').querySelector('.pricing-card__price-val');
        if (billing === 'yearly' && priceEl) {
          const yearlyTotal = Number(priceEl.dataset.yearly) * 12;
          note.textContent = `facturat anual — ${yearlyTotal} lei/an`;
        } else {
          note.innerHTML = '&nbsp;';
        }
      });
    });
  }

  /* ---- FAQ accordion ---- */
  function initFaq() {
    const list = document.getElementById('faqList');
    if (!list) return;

    list.addEventListener('click', function (e) {
      const q = e.target.closest('.faq-item__q');
      if (!q) return;
      const item = q.closest('.faq-item');
      const isOpen = item.classList.toggle('open');
      q.setAttribute('aria-expanded', String(isOpen));
    });
  }

  /* ---- Plan / token purchase buttons — no real payment integration yet ---- */
  function initPurchaseButtons() {
    document.querySelectorAll('.pricing-card__cta[data-plan]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        BM.toast('Plățile online vor fi disponibile în curând.', 'info');
      });
    });

    document.querySelectorAll('[data-tokens]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        BM.toast('Plățile online vor fi disponibile în curând.', 'info');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
