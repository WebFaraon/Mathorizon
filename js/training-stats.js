/* ============================================================
   Teorema — Antrenament: persistent lifetime XP + best streak
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
     the current in-session "Record: N" line unchanged; these are
     additive, DB-synced lifetime totals. */
  BM.Training.TOTAL_XP_KEY    = 'bm_training_total_xp';
  BM.Training.BEST_STREAK_KEY = 'bm_training_best_streak_persist';

  BM.Training.getTotalXp = function () {
    return Math.max(0, parseInt(localStorage.getItem(BM.Training.TOTAL_XP_KEY), 10) || 0);
  };

  BM.Training.getBestStreak = function () {
    return Math.max(0, parseInt(localStorage.getItem(BM.Training.BEST_STREAK_KEY), 10) || 0);
  };

  /* Nivelul crește cu XP-ul care trebuie adunat: de la nivelul 1 la 2 sunt 100 XP, apoi 150, 200, 250 ... (fiecare nivel cere cu 50 mai mult
     decât cel dinainte). Totalul pentru a ajunge la nivelul n este 100(n-1) + 25(n-1)(n-2). Curba e doar aici: nivelul de pe profil, din
     clasament și din Antrenament o citesc de aici. Când nivelul se leagă de nivelurile din companie, se schimbă numai aceste trei funcții. */
  BM.Training.XP_STEP_BASE = 100;     // XP de la nivelul 1 la 2
  BM.Training.XP_STEP_GROWTH = 50;    // cu atât mai mult cere fiecare nivel următor
  BM.Training.xpToNext = function (level) {
    return BM.Training.XP_STEP_BASE + BM.Training.XP_STEP_GROWTH * (Math.max(1, level) - 1);
  };
  BM.Training.xpAtLevel = function (level) {          // XP total necesar ca să ajungi la nivelul `level`
    const n = Math.max(1, level) - 1;
    return BM.Training.XP_STEP_BASE * n + (BM.Training.XP_STEP_GROWTH / 2) * n * (n - 1);
  };
  BM.Training.levelAt = function (xp) {
    xp = Math.max(0, Math.floor(Number(xp) || 0));
    const b = BM.Training.XP_STEP_BASE, g = BM.Training.XP_STEP_GROWTH;
    let level = Math.max(1, Math.floor((-(b - g / 2) + Math.sqrt((b - g / 2) * (b - g / 2) + 2 * g * xp)) / g) + 1);
    while (BM.Training.xpAtLevel(level + 1) <= xp) level++;      // corecție pentru rotunjiri
    while (level > 1 && BM.Training.xpAtLevel(level) > xp) level--;
    const xpIntoLevel = xp - BM.Training.xpAtLevel(level);
    const xpForNextLevel = BM.Training.xpToNext(level);
    return { level, xpIntoLevel, xpForNextLevel, pct: xpIntoLevel / xpForNextLevel };
  };
  BM.Training.levelFromXp = function (xp) { return BM.Training.levelAt(xp).level; };
  BM.Training.getLevelInfo = function () { return BM.Training.levelAt(BM.Training.getTotalXp()); };

  /* XP primesc DOAR elevii al căror rol e confirmat. Profesorii, managerii și adminii nu primesc XP de nicăieri (alte căi vor veni mai târziu);
     un cont conectat al cărui rol nu a ajuns încă nu primește nimic. Fără cont, XP-ul rămâne doar în browser, ca până acum. */
  BM.Training.xpAllowed = function () {
    const A = window.BMAuth;
    if (!A || !A.user) return true;
    return A.role === 'elev';
  };

  BM.Training.addXp = function (amount) {
    if (!BM.Training.xpAllowed()) return BM.Training.getTotalXp();
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
    document.querySelectorAll('[data-training-level-next]').forEach(el => {
      el.textContent = `încă ${level.xpForNextLevel - level.xpIntoLevel} XP până la nivelul ${level.level + 1}`;
    });
    document.querySelectorAll('[data-training-level-fill]').forEach(el => {
      el.style.width = `${Math.round(level.pct * 100)}%`;
    });
  };

  document.addEventListener('DOMContentLoaded', BM.Training.refreshWidgets);
})();
