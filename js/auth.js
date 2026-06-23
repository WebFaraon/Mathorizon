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
      if (event === 'SIGNED_IN')  await _syncTokens();
      if (event === 'SIGNED_OUT') {
        localStorage.setItem(BM.TOKEN_KEY, '0');
        BM.refreshTokenWidgets();
      }
    });

    const { data: { session } } = await sb.auth.getSession();
    currentUser = session?.user ?? null;
    _updateProfileBtn();
    if (currentUser) await _syncTokens();

    /* Override BM.consumeToken — sync with DB in background */
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

    document.dispatchEvent(new CustomEvent('bmauth:ready', { detail: { user: currentUser } }));
  }

  /* ============================================================
     TOKEN SYNC
     ============================================================ */
  async function _syncTokens() {
    if (!sb || !currentUser) return;
    const { data, error } = await sb
      .from('exam_tokens').select('count')
      .eq('user_id', currentUser.id).single();
    if (!error && data) {
      localStorage.setItem(BM.TOKEN_KEY, String(data.count));
      BM.refreshTokenWidgets();
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
    return localStorage.getItem('prof_avatar_v1')
        || currentUser?.user_metadata?.avatar_url
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
