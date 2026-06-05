/* ============================================================
   BACMath — Storage Manager (localStorage)
   ============================================================ */

window.BM = window.BM || {};

BM.Storage = (function() {
  const KEY = {
    solved:    'bm_solved',
    favorites: 'bm_favorites',
    history:   'bm_history',
    streak:    'bm_streak',
    lastVisit: 'bm_last_visit'
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
      addToHistory(id);
      updateStreak();
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

  /* ---- Streak ---- */
  function getStreak() {
    const s = get(KEY.streak);
    return s || { count: 0, lastDate: null };
  }

  function updateStreak() {
    const today = new Date().toDateString();
    const s = getStreak();

    if (s.lastDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (s.lastDate === yesterday) {
      s.count += 1;
    } else if (s.lastDate !== today) {
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

  /* ---- Last Visit ---- */
  function recordVisit() { set(KEY.lastVisit, new Date().toDateString()); }

  /* ---- Clear ---- */
  function clearAll() {
    Object.values(KEY).forEach(k => localStorage.removeItem(k));
  }

  return {
    getSolved, isSolved, toggleSolved,
    getFavorites, isFavorite, toggleFavorite,
    getHistory, addToHistory,
    getStreak, updateStreak,
    getStats, getProgressForCategory,
    recordVisit, clearAll
  };
})();
