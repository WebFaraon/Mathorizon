/* ============================================================
   Mathorizon — Authentication (Supabase)
   Manages session state and profile button across all pages.
   Auth forms live in auth.html / profile actions in profile.html
   ============================================================ */

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  let sb             = null;
  let currentUser    = null;
  let currentSession = null;
  let _syncDone      = false;
  let _userRole      = null;
  let _userStatus    = null;

  /* ============================================================
     INIT
     ============================================================ */
  async function init() {
    if (!window.supabase) return;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    sb.auth.onAuthStateChange(async (event, session) => {
      console.log('[BMAuth] onAuthStateChange:', event, !!session?.user);
      const incomingUser = session?.user ?? null;
      const userChanged  = incomingUser?.id !== currentUser?.id;
      currentUser    = incomingUser;
      currentSession = session ?? null;
      _updateProfileBtn();
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && currentUser) {
        if (userChanged && _syncDone) {
          /* Alt user s-a logat fără SIGNED_OUT — curățăm datele celui vechi */
          _syncDone = false;
          BM.Storage.clearAll();
        }
        if (!_syncDone) {
          _syncDone = true;
          await _syncUserProfile();
          await _syncTokens();
          await _syncProgress();
          document.dispatchEvent(new CustomEvent('bmauth:synced', { detail: { user: currentUser } }));
        }
      }
      if (event === 'SIGNED_OUT') {
        _syncDone = false;
        _userRole   = null;
        _userStatus = null;
        localStorage.setItem(BM.TOKEN_KEY, '0');
        localStorage.removeItem('bm_solved');
        localStorage.removeItem('bm_streak');
        localStorage.removeItem('bm_favorites');
        localStorage.removeItem('bm_history');
        localStorage.removeItem('bac-history');
        BM.refreshTokenWidgets();
      }
    });

    const { data: { session } } = await sb.auth.getSession();
    console.log('[BMAuth] getSession:', !!session?.user);
    currentUser    = session?.user ?? null;
    currentSession = session       ?? null;
    _updateProfileBtn();

    /* Semnalem că auth-ul e gata — pagina poate randa imediat */
    window._bmAuthReady = true;
    document.dispatchEvent(new CustomEvent('bmauth:ready', { detail: { user: currentUser } }));

    /* Override BM.consumeToken — PATCH direct în DB */
    BM.consumeToken = function () {
      const n = BM.getTokens();
      if (n <= 0) return false;
      const newCount = n - 1;
      localStorage.setItem(BM.TOKEN_KEY, String(newCount));
      BM.refreshTokenWidgets();
      if (currentUser) {
        _dbFetch(`exam_tokens?user_id=eq.${currentUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ count: newCount }),
          headers: { 'Prefer': 'return=minimal' }
        }).catch(() => {});
      }
      return true;
    };

    /* Override BM.Storage.toggleSolved — upsert/delete direct în DB */
    const _origToggleSolved = BM.Storage.toggleSolved;
    BM.Storage.toggleSolved = function (id) {
      const nowSolved = _origToggleSolved(id);
      if (currentUser) {
        if (nowSolved) {
          const ts = BM.Storage.getSolved()[id] || Date.now();
          _dbFetch('user_solved', {
            method: 'POST',
            body: JSON.stringify({ user_id: currentUser.id, exercise_id: id, solved_at: ts }),
            headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
          }).catch(() => {});
        } else {
          _dbFetch(`user_solved?user_id=eq.${currentUser.id}&exercise_id=eq.${id}`, {
            method: 'DELETE'
          }).catch(() => {});
        }
      }
      return nowSolved;
    };

    /* Override BM.Storage.updateStreak — upsert direct în DB */
    const _origUpdateStreak = BM.Storage.updateStreak;
    BM.Storage.updateStreak = function () {
      _origUpdateStreak();
      if (currentUser) {
        const s = BM.Storage.getStreak();
        _dbFetch('user_streak', {
          method: 'POST',
          body: JSON.stringify({ user_id: currentUser.id, count: s.count, last_date: s.lastDate }),
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
        }).catch(() => {});
      }
    };

    /* Override BM.Storage.toggleFavorite — upsert/delete direct în DB */
    const _origToggleFav = BM.Storage.toggleFavorite;
    BM.Storage.toggleFavorite = function (id) {
      const nowFav = _origToggleFav(id);
      if (currentUser) {
        if (nowFav) {
          _dbFetch('user_favorites', {
            method: 'POST',
            body: JSON.stringify({ user_id: currentUser.id, exercise_id: id, added_at: Date.now() }),
            headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
          }).catch(() => {});
        } else {
          _dbFetch(`user_favorites?user_id=eq.${currentUser.id}&exercise_id=eq.${id}`, {
            method: 'DELETE'
          }).catch(() => {});
        }
      }
      return nowFav;
    };

    /* Override BM.Storage.addToHistory — upsert direct în DB */
    const _origAddToHistory = BM.Storage.addToHistory;
    BM.Storage.addToHistory = function (exerciseId) {
      _origAddToHistory(exerciseId);
      if (currentUser) {
        _dbFetch('user_history', {
          method: 'POST',
          body: JSON.stringify({ user_id: currentUser.id, exercise_id: exerciseId, ts: Date.now() }),
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
        }).catch(() => {});
      }
    };

  }

  /* ============================================================
     TOKEN SYNC
     ============================================================ */
  async function _dbFetch(path, options = {}) {
    const token = currentSession?.access_token || '';
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      ...options,
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function _syncTokens() {
    if (!sb || !currentUser) return;

    /* Arată imediat 3 tokenuri dacă sunt la 0 (după logout) */
    if (BM.getTokens() <= 0) {
      localStorage.setItem(BM.TOKEN_KEY, '3');
      BM.refreshTokenWidgets();
    }

    try {
      const rows = await _dbFetch(
        `exam_tokens?select=count&user_id=eq.${currentUser.id}`
      );
      if (rows && rows.length > 0) {
        localStorage.setItem(BM.TOKEN_KEY, String(rows[0].count));
        BM.refreshTokenWidgets();
        return;
      }
      /* Niciun rând — utilizator nou, inserăm 3 tokenuri (upsert pt siguranță) */
      await _dbFetch('exam_tokens', {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUser.id, count: 3 }),
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
      });
      localStorage.setItem(BM.TOKEN_KEY, '3');
      BM.refreshTokenWidgets();
    } catch (e) {
      console.error('[BMAuth] syncTokens error:', e.message);
      /* Păstrăm optimistic 3 setat mai sus */
    }
  }

  /* ============================================================
     USER PROFILE SYNC — role + status
     ============================================================ */
  async function _syncUserProfile() {
    if (!currentUser) return;
    const uid = currentUser.id;
    try {
      const rows = await _dbFetch(`user_profiles?user_id=eq.${uid}&select=role,status`);
      if (Array.isArray(rows) && rows.length > 0) {
        _userRole   = rows[0].role;
        _userStatus = rows[0].status;
      } else {
        /* Utilizator fără profil — creăm unul bazat pe user_metadata */
        const role   = currentUser.user_metadata?.role || 'elev';
        const status = role === 'profesor' ? 'pending' : 'active';
        await _dbFetch('user_profiles', {
          method:  'POST',
          body:    JSON.stringify({ user_id: uid, role, status }),
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
        });
        _userRole   = role;
        _userStatus = status;
      }
      document.dispatchEvent(new CustomEvent('bmauth:profile', {
        detail: { role: _userRole, status: _userStatus }
      }));
      BM.refreshTokenWidgets();
    } catch (e) {
      console.error('[BMAuth] syncUserProfile error:', e.message);
    }
  }

  /* ============================================================
     PROGRESS SYNC — DB este sursa de adevăr, suprascrie localul.
     Datele de guest (nelogat) nu se combină cu contul.
     ============================================================ */
  async function _syncProgress() {
    if (!currentUser) return;
    const uid = currentUser.id;
    try {
      /* ---- Exerciții rezolvate ---- */
      const dbSolved = await _dbFetch(
        `user_solved?select=exercise_id,solved_at&user_id=eq.${uid}`
      );
      if (Array.isArray(dbSolved)) {
        const dbMap = Object.fromEntries(dbSolved.map(r => [r.exercise_id, r.solved_at]));
        try { localStorage.setItem('bm_solved', JSON.stringify(dbMap)); } catch {}
      }

      /* ---- Streak ---- */
      const streakRows = await _dbFetch(
        `user_streak?select=count,last_date&user_id=eq.${uid}`
      );
      const dbStreak = Array.isArray(streakRows) ? streakRows[0] || null : null;
      if (dbStreak) {
        // dbStreak.last_date is already "YYYY-MM-DD" (a Postgres `date`
        // column, echoed verbatim by PostgREST) — the exact format
        // _isoDate() writes. Do NOT round-trip it through `new Date(...)`:
        // a date-only string parses as UTC midnight, so reformatting it
        // back with a local-time formatter shifts the date by a day for
        // any user west of UTC.
        try { localStorage.setItem('bm_streak', JSON.stringify({ count: dbStreak.count, lastDate: dbStreak.last_date })); } catch {}
      } else {
        try { localStorage.setItem('bm_streak', JSON.stringify({ count: 0, lastDate: null })); } catch {}
        /* Utilizator nou — inițializează rândul în DB ca să nu apară valori greșite */
        _dbFetch('user_streak', {
          method: 'POST',
          body: JSON.stringify({ user_id: uid, count: 0, last_date: null }),
          headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' }
        }).catch(() => {});
      }

      /* ---- Favorite ---- */
      const dbFavs = await _dbFetch(
        `user_favorites?select=exercise_id&user_id=eq.${uid}&order=added_at.desc`
      );
      if (Array.isArray(dbFavs)) {
        try { localStorage.setItem('bm_favorites', JSON.stringify(dbFavs.map(r => r.exercise_id))); } catch {}
      }

      /* ---- Istoric exerciții ---- */
      const dbHist = await _dbFetch(
        `user_history?select=exercise_id,ts&user_id=eq.${uid}&order=ts.desc&limit=200`
      );
      if (Array.isArray(dbHist)) {
        try { localStorage.setItem('bm_history', JSON.stringify(dbHist.map(r => ({ id: r.exercise_id, ts: r.ts })))); } catch {}
      }

      /* ---- Simulări BAC ---- */
      const dbSims = await _dbFetch(
        `bac_simulations?select=ts,grade,earned,max_pts,duration_sec,breakdown&user_id=eq.${uid}&order=ts.desc&limit=20`
      );
      if (Array.isArray(dbSims)) {
        const sims = dbSims.map(r => ({
          ts:          r.ts,
          grade:       r.grade,
          earned:      r.earned,
          maxPts:      r.max_pts,
          durationSec: r.duration_sec,
          breakdown:   r.breakdown
        }));
        try { localStorage.setItem('bac-history', JSON.stringify(sims)); } catch {}
      }

    } catch (e) {
      console.error('[BMAuth] syncProgress exception:', e.message);
    }
  }

  /* ============================================================
     HELPERS
     ============================================================ */
  function _displayName() {
    if (!currentUser) return '';
    return currentUser.user_metadata?.full_name
        || currentUser.user_metadata?.name
        || currentUser.email?.split('@')[0]
        || 'Utilizator';
  }

  function _avatarUrl() {
    if (!currentUser) return null;
    return currentUser.user_metadata?.custom_avatar_url
        || currentUser.user_metadata?.avatar_url
        || null;
  }

  function _initials() {
    const parts = _displayName().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (_displayName().slice(0, 2).toUpperCase()) || '?';
  }

  /* ============================================================
     PROFILE BUTTON — redirect to pages
     ============================================================ */
  function _updateProfileBtn() {
    const btn = document.getElementById('navProfileBtn');
    if (!btn) return;

    if (currentUser) {
      const av   = _avatarUrl();
      const name = _displayName();
      btn.classList.add('nav-profile-btn--pill');
      btn.innerHTML = av
        ? `<img src="${av}" alt="${BM.esc(name)}" class="nav-profile-avatar"><span class="nav-profile-name">${BM.esc(name)}</span>`
        : `<span class="nav-profile-initials">${BM.esc(_initials())}</span><span class="nav-profile-name">${BM.esc(name)}</span>`;
      btn.title   = name;
      btn.onclick = () => { window.location.href = 'profile.html'; };
    } else {
      btn.classList.remove('nav-profile-btn--pill');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
      btn.title   = 'Conectează-te';
      btn.onclick = () => {
        const here = window.location.pathname.replace(/^\//, '') + window.location.search;
        window.location.href = 'auth.html?from=' + encodeURIComponent(here || 'index.html');
      };
    }
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.BMAuth = {
    init,
    get user()      { return currentUser; },
    get supabase()  { return sb; },
    get role()      { return _userRole; },
    get status()    { return _userStatus; },
    displayName:    () => _displayName(),
    avatarUrl:      () => _avatarUrl(),
    initials:       () => _initials(),
    saveBacSimulation: (entry) => {
      if (!currentUser) return;
      _dbFetch('bac_simulations', {
        method: 'POST',
        body: JSON.stringify({
          user_id:      currentUser.id,
          ts:           entry.ts,
          grade:        entry.grade,
          earned:       entry.earned,
          max_pts:      entry.maxPts,
          duration_sec: entry.durationSec,
          breakdown:    entry.breakdown
        }),
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
      }).catch(() => {});
    },
    // Deletes every bac_simulations row for this user. Returns a promise so
    // the caller can await it before reloading — _syncProgress() (above)
    // treats the DB as the source of truth and repopulates localStorage's
    // 'bac-history' from it on every load, so clearing only the local copy
    // without this made "Șterge tot istoricul" look like it did nothing.
    clearBacHistory: () => {
      if (!currentUser) return Promise.resolve();
      return _dbFetch(`bac_simulations?user_id=eq.${currentUser.id}`, {
        method: 'DELETE'
      });
    }
  };

  /* ============================================================
     DAILY STREAK — bump once per calendar day. Runs on every page
     (this file loads everywhere), not just the homepage, so a day
     only used to count as "visited" if the user opened index.html
     or solved an exercise there — every other page load silently
     skipped the bump and broke the "consecutive days" chain even on
     days the user genuinely logged in.
     Waits for the sync to resolve (or confirmation there's no
     session) before bumping — bumping immediately would race the
     override installed above and get clobbered once _syncProgress
     restores yesterday's row from the DB ("DB e sursa de adevăr").
     ============================================================ */
  (function () {
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      BM.Storage.updateStreak();
      document.dispatchEvent(new CustomEvent('bmauth:streak-updated'));
    };
    document.addEventListener('bmauth:synced', run, { once: true });
    document.addEventListener('bmauth:ready', (e) => {
      if (!e.detail?.user) run(); // no session → nothing will sync, safe now
    }, { once: true });
    setTimeout(run, 2500);
  })();

  document.addEventListener('DOMContentLoaded', init);
})();
