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

  /* Flat 100 XP/level — simple and transparent (level = xp/100 + 1) rather
     than a progressive curve, so the level bar in the session header reads
     predictably instead of needing a lookup table. */
  BM.Training.XP_PER_LEVEL = 100;
  BM.Training.getLevelInfo = function () {
    const xp = BM.Training.getTotalXp();
    const perLevel = BM.Training.XP_PER_LEVEL;
    const level = Math.floor(xp / perLevel) + 1;
    const xpIntoLevel = xp % perLevel;
    return { level, xpIntoLevel, xpForNextLevel: perLevel, pct: xpIntoLevel / perLevel };
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

    const level = BM.Training.getLevelInfo();
    document.querySelectorAll('[data-training-level]').forEach(el => { el.textContent = level.level; });
    document.querySelectorAll('[data-training-level-xp]').forEach(el => {
      el.textContent = `${level.xpIntoLevel} / ${level.xpForNextLevel} XP`;
    });
    document.querySelectorAll('[data-training-level-fill]').forEach(el => {
      el.style.width = `${Math.round(level.pct * 100)}%`;
    });
  };

  document.addEventListener('DOMContentLoaded', BM.Training.refreshWidgets);
})();
