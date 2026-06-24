/* ============================================================
   Mathorizon — Authentication (Supabase)
   Manages session state and profile button across all pages.
   Auth forms live in auth.html / profile actions in profile.html
   ============================================================ */

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  let sb          = null;
  let currentUser = null;

  /* ============================================================
     INIT
     ============================================================ */
  async function init() {
    if (!window.supabase) return;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    sb.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user ?? null;
      _updateProfileBtn();
      if (event === 'SIGNED_IN') {
        await _syncTokens();
        await _syncProgress();
        document.dispatchEvent(new CustomEvent('bmauth:synced', { detail: { user: currentUser } }));
      }
      if (event === 'SIGNED_OUT') {
        localStorage.setItem(BM.TOKEN_KEY, '0');
        localStorage.removeItem('bm_solved');
        localStorage.removeItem('bm_streak');
        BM.refreshTokenWidgets();
      }
    });

    const { data: { session } } = await sb.auth.getSession();
    currentUser = session?.user ?? null;
    _updateProfileBtn();
    if (currentUser) {
      await _syncTokens();
      await _syncProgress();
      document.dispatchEvent(new CustomEvent('bmauth:synced', { detail: { user: currentUser } }));
    }

    /* Override BM.consumeToken — sync cu DB în background */
    BM.consumeToken = function () {
      const n = BM.getTokens();
      if (n <= 0) return false;
      localStorage.setItem(BM.TOKEN_KEY, String(n - 1));
      BM.refreshTokenWidgets();
      if (sb && currentUser) {
        sb.rpc('consume_exam_token').then(({ data, error }) => {
          if (!error && typeof data === 'number' && data >= 0) {
            localStorage.setItem(BM.TOKEN_KEY, String(data));
            BM.refreshTokenWidgets();
          }
        });
      }
      return true;
    };

    /* Override BM.Storage.toggleSolved — sync cu DB în background */
    const _origToggleSolved = BM.Storage.toggleSolved;
    BM.Storage.toggleSolved = function (id) {
      const nowSolved = _origToggleSolved(id);
      if (sb && currentUser) {
        if (nowSolved) {
          const ts = BM.Storage.getSolved()[id] || Date.now();
          sb.from('user_solved')
            .upsert({ user_id: currentUser.id, exercise_id: id, solved_at: ts },
                    { onConflict: 'user_id,exercise_id' })
            .then(() => {});
        } else {
          sb.from('user_solved')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('exercise_id', id)
            .then(() => {});
        }
      }
      return nowSolved;
    };

    /* Override BM.Storage.updateStreak — sync cu DB în background */
    const _origUpdateStreak = BM.Storage.updateStreak;
    BM.Storage.updateStreak = function () {
      _origUpdateStreak();
      if (sb && currentUser) {
        const s = BM.Storage.getStreak();
        sb.from('user_streak')
          .upsert({ user_id: currentUser.id, count: s.count, last_date: s.lastDate },
                  { onConflict: 'user_id' })
          .then(() => {});
      }
    };

    document.dispatchEvent(new CustomEvent('bmauth:ready', { detail: { user: currentUser } }));
  }

  /* ============================================================
     TOKEN SYNC
     ============================================================ */
  async function _syncTokens() {
    if (!sb || !currentUser) return;
    const { data, error } = await sb
      .from('exam_tokens').select('count')
      .eq('user_id', currentUser.id).maybeSingle();
    if (data) {
      localStorage.setItem(BM.TOKEN_KEY, String(data.count));
      BM.refreshTokenWidgets();
    } else if (!error) {
      /* Niciun rând — utilizator nou, acordăm 3 tokenuri gratuite */
      const { error: insErr } = await sb
        .from('exam_tokens')
        .insert({ user_id: currentUser.id, count: 3 });
      if (!insErr) {
        localStorage.setItem(BM.TOKEN_KEY, '3');
        BM.refreshTokenWidgets();
      }
    }
  }

  /* ============================================================
     PROGRESS SYNC (exerciții rezolvate + streak)
     ============================================================ */
  async function _syncProgress() {
    if (!sb || !currentUser) return;
    const uid = currentUser.id;

    /* ---- Exerciții rezolvate ---- */
    const { data: dbSolved } = await sb
      .from('user_solved')
      .select('exercise_id, solved_at')
      .eq('user_id', uid);

    if (dbSolved) {
      const localSolved = BM.Storage.getSolved();
      const dbMap = Object.fromEntries(dbSolved.map(r => [r.exercise_id, r.solved_at]));

      /* Adăugăm în local exercițiile din DB care lipsesc */
      let changed = false;
      dbSolved.forEach(r => {
        if (!localSolved[r.exercise_id]) {
          localSolved[r.exercise_id] = r.solved_at;
          changed = true;
        }
      });
      if (changed) {
        try { localStorage.setItem('bm_solved', JSON.stringify(localSolved)); } catch {}
      }

      /* Urcăm în DB exercițiile locale care lipsesc */
      const localOnly = Object.entries(localSolved)
        .filter(([id]) => !dbMap[id])
        .map(([exercise_id, solved_at]) => ({ user_id: uid, exercise_id, solved_at }));
      if (localOnly.length > 0) {
        await sb.from('user_solved')
          .upsert(localOnly, { onConflict: 'user_id,exercise_id' });
      }
    }

    /* ---- Streak ---- */
    const { data: dbStreak } = await sb
      .from('user_streak')
      .select('count, last_date')
      .eq('user_id', uid)
      .maybeSingle();

    const localStreak = BM.Storage.getStreak();

    if (dbStreak) {
      const dbTs    = new Date(dbStreak.last_date  || '1970-01-01').getTime();
      const localTs = new Date(localStreak.lastDate || '1970-01-01').getTime();
      if (dbTs > localTs || (dbTs === localTs && dbStreak.count > localStreak.count)) {
        /* DB-ul e mai recent — actualizăm localul */
        try { localStorage.setItem('bm_streak', JSON.stringify({ count: dbStreak.count, lastDate: dbStreak.last_date })); } catch {}
      } else {
        /* Localul e mai recent — urcăm în DB */
        await sb.from('user_streak')
          .upsert({ user_id: uid, count: localStreak.count, last_date: localStreak.lastDate },
                  { onConflict: 'user_id' });
      }
    } else if (localStreak.count > 0) {
      /* Nu există rând în DB — creăm cu datele locale */
      await sb.from('user_streak')
        .upsert({ user_id: uid, count: localStreak.count, last_date: localStreak.lastDate },
                { onConflict: 'user_id' });
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
      const av = _avatarUrl();
      btn.innerHTML = av
        ? `<img src="${av}" alt="${BM.esc(_displayName())}" class="nav-profile-avatar">`
        : `<span class="nav-profile-initials">${BM.esc(_initials())}</span>`;
      btn.title   = _displayName();
      btn.onclick = () => { window.location.href = 'profile.html'; };
    } else {
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
    displayName:    () => _displayName(),
    avatarUrl:      () => _avatarUrl(),
    initials:       () => _initials(),
  };

  document.addEventListener('DOMContentLoaded', init);
})();
