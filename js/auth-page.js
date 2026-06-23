/* ============================================================
   Mathorizon — Auth Page (auth.html)
   Standalone — does NOT depend on auth.js timing
   ============================================================ */

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  let sb   = null;
  let _tab = 'login';

  function _getFrom() {
    const from = new URLSearchParams(window.location.search).get('from') || 'index.html';
    return from.startsWith('http') ? 'index.html' : from;
  }

  function _redirect() {
    window.location.replace(_getFrom());
  }

  /* ---- Message helpers ---- */
  function _showMsg(text, isError) {
    const el = document.getElementById('authMsg');
    if (!el) return;
    el.textContent  = text;
    el.className    = 'auth-msg ' + (isError ? 'auth-msg--error' : 'auth-msg--success');
    el.style.display = '';
  }
  function _clearMsg() {
    const el = document.getElementById('authMsg');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }
  function _setLoading(btnId, on) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = on;
    const txt = btn.querySelector('span:first-child');
    const spn = btn.querySelector('.auth-spin');
    if (txt) txt.style.opacity = on ? '0' : '';
    if (spn) spn.style.display = on ? ''  : 'none';
  }

  /* ---- Tab switching ---- */
  function switchTab(tab) {
    _tab = tab;
    const map = { login: 'fLogin', signup: 'fSignup', reset: 'fReset' };
    Object.entries(map).forEach(([key, id]) => {
      const f = document.getElementById(id);
      if (f) f.style.display = key === tab ? '' : 'none';
    });
    document.querySelectorAll('.auth-tab').forEach(t => {
      t.classList.toggle('auth-tab--active', t.dataset.tab === tab);
    });
    const isReset = tab === 'reset';
    const tabRow  = document.querySelector('.auth-tabs');
    const divider = document.getElementById('authDivider');
    const google  = document.getElementById('authGoogle');
    if (tabRow)  tabRow.style.display  = isReset ? 'none' : '';
    if (divider) divider.style.display = isReset ? 'none' : '';
    if (google)  google.style.display  = isReset ? 'none' : '';
    _clearMsg();
    const focus = { login: 'lEmail', signup: 'sName', reset: 'rEmail' }[tab];
    setTimeout(() => document.getElementById(focus)?.focus(), 60);
    /* sync URL without reload */
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    history.replaceState(null, '', url);
  }
  window.switchTab = switchTab;

  /* ---- Password visibility ---- */
  window.togglePw = function(btn) {
    const inp = document.getElementById(btn.dataset.target);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
  };

  /* ---- Error translation ---- */
  function _roError(msg) {
    if (!msg) return 'A apărut o eroare. Încearcă din nou.';
    if (msg.includes('Invalid login credentials'))  return 'Email sau parolă incorectă.';
    if (msg.includes('Email not confirmed'))        return 'Emailul nu a fost confirmat. Verifică inbox-ul.';
    if (msg.includes('User already registered'))    return 'Există deja un cont cu acest email.';
    if (msg.includes('Password should be'))         return 'Parola trebuie să aibă cel puțin 6 caractere.';
    if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit'))
      return 'Prea multe încercări. Încearcă mai târziu.';
    return msg;
  }

  /* ---- Form handlers ---- */
  async function onLogin(e) {
    e.preventDefault();
    _clearMsg();
    const email = document.getElementById('lEmail')?.value.trim();
    const pass  = document.getElementById('lPass')?.value;
    if (!email || !pass) return _showMsg('Completează toate câmpurile.', true);
    _setLoading('btnLogin', true);
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    _setLoading('btnLogin', false);
    if (error) return _showMsg(_roError(error.message), true);
  }
  window.onLogin = onLogin;

  async function onSignup(e) {
    e.preventDefault();
    _clearMsg();
    const name  = document.getElementById('sName')?.value.trim();
    const email = document.getElementById('sEmail')?.value.trim();
    const pass  = document.getElementById('sPass')?.value;
    const conf  = document.getElementById('sConf')?.value;
    if (!name || !email || !pass || !conf) return _showMsg('Completează toate câmpurile.', true);
    if (pass.length < 8) return _showMsg('Parola trebuie să aibă cel puțin 8 caractere.', true);
    if (pass !== conf)   return _showMsg('Parolele nu coincid.', true);
    _setLoading('btnSignup', true);
    const { error } = await sb.auth.signUp({
      email, password: pass,
      options: { data: { full_name: name } }
    });
    _setLoading('btnSignup', false);
    if (error) return _showMsg(_roError(error.message), true);
    _showMsg('Cont creat! Verifică emailul pentru confirmare, apoi conectează-te.', false);
  }
  window.onSignup = onSignup;

  async function onReset(e) {
    e.preventDefault();
    _clearMsg();
    const email = document.getElementById('rEmail')?.value.trim();
    if (!email) return _showMsg('Introdu adresa de email.', true);
    _setLoading('btnReset', true);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth.html?tab=login'
    });
    _setLoading('btnReset', false);
    if (error) return _showMsg(_roError(error.message), true);
    _showMsg('Email trimis! Verifică căsuța poștală.', false);
  }
  window.onReset = onReset;

  async function onGoogle() {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth.html' }
    });
    if (error) _showMsg(_roError(error.message), true);
  }
  window.onGoogle = onGoogle;

  /* ---- INIT ---- */
  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) return;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    /* If already logged in, redirect immediately */
    const { data: { session } } = await sb.auth.getSession();
    if (session) { _redirect(); return; }

    /* Listen for auth state changes (handles OAuth hash) */
    sb.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        _redirect();
      }
    });

    /* Read initial tab from URL param */
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'signup' || tabParam === 'reset') switchTab(tabParam);
  });
})();
