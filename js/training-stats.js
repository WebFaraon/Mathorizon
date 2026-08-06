/* ============================================================
   Mathorizon — Antrenament: persistent lifetime XP + best streak
   Local-first (works for guests), overridden by js/auth.js at
   login-init time to also write through to Supabase (mirrors
   BM.consumeToken's override — see js/auth.js). Training-page-only,
   so it's a dedicated file rather than living in js/utils.js
   (loaded on every page).
   ============================================================ */

window.BM = window.BM || {};

(function () {
  'use strict';

  BM.Training = BM.Training || {};

  /* Deliberately different keys from the existing local-only
     bm_training_best_combo (js/storage.js) — that one keeps powering
     the current in-session "🏆 Record: N" line unchanged; these are
     additive, DB-synced lifetime totals. */
  BM.Training.TOTAL_XP_KEY    = 'bm_training_total_xp';
  BM.Training.BEST_STREAK_KEY = 'bm_training_best_streak_persist';

  BM.Training.getTotalXp = function () {
    return Math.max(0, parseInt(localStorage.getItem(BM.Training.TOTAL_XP_KEY), 10) || 0);
  };

  BM.Training.getBestStreak = function () {
    return Math.max(0, parseInt(localStorage.getItem(BM.Training.BEST_STREAK_KEY), 10) || 0);
  };

  BM.Training.addXp = function (amount) {
    const n = Math.max(0, (BM.Training.getTotalXp() + (Number(amount) || 0)));
    localStorage.setItem(BM.Training.TOTAL_XP_KEY, String(n));
    BM.Training.refreshWidgets();
    return n;
  };

  BM.Training.reportBestStreak = function (streakValue) {
    const current = BM.Training.getBestStreak();
    if (!(streakValue > current)) return current;
    localStorage.setItem(BM.Training.BEST_STREAK_KEY, String(streakValue));
    BM.Training.refreshWidgets();
    return streakValue;
  };

  BM.Training.refreshWidgets = function () {
    const xp = BM.Training.getTotalXp();
    const streak = BM.Training.getBestStreak();
    document.querySelectorAll('[data-training-total-xp]').forEach(el => { el.textContent = xp; });
    document.querySelectorAll('[data-training-best-streak]').forEach(el => { el.textContent = streak; });
  };

  document.addEventListener('DOMContentLoaded', BM.Training.refreshWidgets);
})();
