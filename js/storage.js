/* ============================================================
   BACMath — Storage Manager (localStorage)
   ============================================================ */

window.BM = window.BM || {};

BM.Storage = (function() {
  /* Returns local date as "YYYY-MM-DD" — consistent with what Supabase date columns return */
  function _isoDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const KEY = {
    solved:     'bm_solved',
    favorites:  'bm_favorites',
    history:    'bm_history',
    streak:     'bm_streak',
    lastVisit:  'bm_last_visit',
    bestCombo:  'bm_training_best_combo'
  };

  function get(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch(e) { return null; }
  }

  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
  }

  /* ---- Solved ---- */
  function getSolved() { return get(KEY.solved) || {}; }
  function isSolved(id) { return !!getSolved()[id]; }

  function toggleSolved(id) {
    const solved = getSolved();
    if (solved[id]) {
      delete solved[id];
      set(KEY.solved, solved);
      return false;
    } else {
      solved[id] = Date.now();
      set(KEY.solved, solved);
      // Call through BM.Storage (not the bare local names) — auth.js
      // monkey-patches BM.Storage.addToHistory/updateStreak to also upsert
      // to Supabase for a logged-in user. A bare call here would resolve to
      // this module's own un-patched closures, silently skipping the DB
      // sync for every exercise solved from category/training pages (the
      // only place this ran was on index.html, via its own direct call to
      // BM.Storage.updateStreak()).
      BM.Storage.addToHistory(id);
      BM.Storage.updateStreak();
      return true;
    }
  }

  /* ---- Favorites ---- */
  function getFavorites() { return get(KEY.favorites) || []; }
  function isFavorite(id) { return getFavorites().includes(id); }

  function toggleFavorite(id) {
    let favs = getFavorites();
    if (favs.includes(id)) {
      favs = favs.filter(f => f !== id);
      set(KEY.favorites, favs);
      return false;
    } else {
      favs.unshift(id);
      set(KEY.favorites, favs);
      return true;
    }
  }

  /* ---- History ---- */
  function getHistory() { return get(KEY.history) || []; }

  function addToHistory(exerciseId) {
    const hist = getHistory();
    const entry = { id: exerciseId, ts: Date.now() };
    const idx = hist.findIndex(h => h.id === exerciseId);
    if (idx !== -1) hist.splice(idx, 1);
    hist.unshift(entry);
    set(KEY.history, hist.slice(0, 200));
  }

  function clearHistory() { set(KEY.history, []); }

  /* ---- Streak ---- */
  function getStreak() {
    const s = get(KEY.streak);
    if (!s) return { count: 0, lastDate: null };
    /* Normalize legacy toDateString() format ("Tue Jun 24 2026") → ISO ("2026-06-24") */
    if (s.lastDate) {
      const normalized = _isoDate(new Date(s.lastDate));
      if (normalized !== s.lastDate) { s.lastDate = normalized; set(KEY.streak, s); }
    }
    return s;
  }

  function updateStreak() {
    const today = _isoDate();
    const s = getStreak();

    if (s.lastDate === today) return;

    const yesterday = _isoDate(new Date(Date.now() - 86400000));
    if (s.lastDate === yesterday) {
      s.count += 1;
    } else {
      s.count = 1;
    }
    s.lastDate = today;
    set(KEY.streak, s);
  }

  /* ---- Stats ---- */
  function getStats(exercises) {
    const solved = getSolved();
    const total = exercises.length;
    const solvedCount = exercises.filter(e => solved[e.id]).length;
    const percent = total > 0 ? Math.round((solvedCount / total) * 100) : 0;
    return { total, solvedCount, percent, streak: getStreak().count };
  }

  function getProgressForCategory(categoryId, exercises) {
    const catExercises = exercises.filter(e => e.categoryId === categoryId);
    if (catExercises.length === 0) return { solved: 0, total: 0, percent: 0 };
    const solved = getSolved();
    const solvedCount = catExercises.filter(e => solved[e.id]).length;
    return {
      solved: solvedCount,
      total: catExercises.length,
      percent: Math.round((solvedCount / catExercises.length) * 100)
    };
  }

  /* ---- Training combo streak (best-of, session-local streak lives in training.js —
     unrelated to the calendar-based daily streak above) ---- */
  function getBestCombo() { return get(KEY.bestCombo) || 0; }
  function setBestCombo(n) { set(KEY.bestCombo, n); }

  /* ---- Last Visit ---- */
  function recordVisit() { set(KEY.lastVisit, new Date().toDateString()); }

  /* ---- Clear ---- */
  function clearAll() {
    Object.values(KEY).forEach(k => localStorage.removeItem(k));
  }

  return {
    getSolved, isSolved, toggleSolved,
    getFavorites, isFavorite, toggleFavorite,
    getHistory, addToHistory, clearHistory,
    getStreak, updateStreak,
    getBestCombo, setBestCombo,
    getStats, getProgressForCategory,
    recordVisit, clearAll
  };
})();
