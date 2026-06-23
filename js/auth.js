/* ============================================================
   Mathorizon — Authentication (Supabase)
   ============================================================
   SQL SETUP — run once in Supabase > SQL Editor:

   -- 1. PROFILES
   CREATE TABLE public.profiles (
     id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
     email TEXT,
     display_name TEXT,
     avatar_url TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
   CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

   -- 2. EXAM TOKENS
   CREATE TABLE public.exam_tokens (
     user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
     count INTEGER NOT NULL DEFAULT 3,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE public.exam_tokens ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "select_own_tokens" ON public.exam_tokens FOR SELECT USING (auth.uid() = user_id);

   -- 3. TOKEN TRANSACTIONS (audit log)
   CREATE TABLE public.token_transactions (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
     delta INTEGER NOT NULL,
     reason TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "select_own_transactions" ON public.token_transactions FOR SELECT USING (auth.uid() = user_id);

   -- 4. AUTO-CREATE PROFILE + GRANT 3 TOKENS ON SIGNUP
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO public.profiles (id, email, display_name, avatar_url)
     VALUES (
       NEW.id,
       NEW.email,
       COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
       NEW.raw_user_meta_data->>'avatar_url'
     );
     INSERT INTO public.exam_tokens (user_id, count) VALUES (NEW.id, 3);
     INSERT INTO public.token_transactions (user_id, delta, reason) VALUES (NEW.id, 3, 'welcome_bonus');
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

   -- 5. ATOMIC CONSUME FUNCTION (returns new count, or -1 if insufficient)
   CREATE OR REPLACE FUNCTION public.consume_exam_token()
   RETURNS INTEGER AS $$
   DECLARE v_count INTEGER; v_new INTEGER;
   BEGIN
     SELECT count INTO v_count FROM public.exam_tokens WHERE user_id = auth.uid() FOR UPDATE;
     IF v_count IS NULL OR v_count <= 0 THEN RETURN -1; END IF;
     v_new := v_count - 1;
     UPDATE public.exam_tokens SET count = v_new, updated_at = NOW() WHERE user_id = auth.uid();
     INSERT INTO public.token_transactions (user_id, delta, reason) VALUES (auth.uid(), -1, 'exam_start');
     RETURN v_new;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ============================================================ */

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  let sb          = null;
  let currentUser = null;
  let _modal      = null;
  let _dropdown   = null;

  /* ============================================================
     INIT
     ============================================================ */
  async function init() {
    if (!window.supabase) {
      console.warn('[Auth] Supabase SDK not found — auth disabled');
      _updateProfileBtn();
      return;
    }

    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    sb.auth.onAuthStateChange(async (event, session) => {
      const prevUser = currentUser;
      currentUser = session?.user ?? null;
      _updateProfileBtn();

      if (event === 'SIGNED_IN' && !prevUser) {
        closeModal();
        await _syncTokens();
        BM.toast('Bine ai revenit, ' + _displayName() + '!', 'success');
      }
      if (event === 'SIGNED_OUT') {
        BM.refreshTokenWidgets();
      }
    });

    const { data: { session } } = await sb.auth.getSession();
    currentUser = session?.user ?? null;
    _updateProfileBtn();
    if (currentUser) await _syncTokens();

    /* Override BM.consumeToken to also sync with DB */
    const _origConsume = BM.consumeToken;
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
  }

  /* ============================================================
     TOKEN SYNC
     ============================================================ */
  async function _syncTokens() {
    if (!sb || !currentUser) return;
    const { data, error } = await sb
      .from('exam_tokens')
      .select('count')
      .eq('user_id', currentUser.id)
      .single();
    if (!error && data) {
      localStorage.setItem(BM.TOKEN_KEY, String(data.count));
      BM.refreshTokenWidgets();
    }
  }

  /* ============================================================
     PROFILE BUTTON
     ============================================================ */
  function _displayName() {
    if (!currentUser) return '';
    return currentUser.user_metadata?.full_name
        || currentUser.user_metadata?.name
        || currentUser.email?.split('@')[0]
        || 'Utilizator';
  }

  function _avatarUrl() {
    return currentUser?.user_metadata?.avatar_url ?? null;
  }

  function _initials() {
    const parts = _displayName().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return _displayName().slice(0, 2).toUpperCase() || '?';
  }

  function _updateProfileBtn() {
    const btn = document.getElementById('navProfileBtn');
    if (!btn) return;

    if (currentUser) {
      const av = _avatarUrl();
      btn.innerHTML = av
        ? `<img src="${av}" alt="${BM.esc(_displayName())}" class="nav-profile-avatar">`
        : `<span class="nav-profile-initials">${BM.esc(_initials())}</span>`;
      btn.title   = _displayName();
      btn.onclick = _toggleDropdown;
    } else {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
      btn.title   = 'Conectează-te';
      btn.onclick = () => openModal('login');
    }
  }

  /* ============================================================
     PROFILE DROPDOWN
     ============================================================ */
  function _toggleDropdown(e) {
    e?.stopPropagation();
    if (_dropdown) { _closeDropdown(); return; }

    const btn = document.getElementById('navProfileBtn');
    const r   = btn.getBoundingClientRect();

    _dropdown = document.createElement('div');
    _dropdown.className = 'auth-dropdown';
    _dropdown.innerHTML = `
      <div class="auth-dropdown__header">
        <div class="auth-dropdown__name">${BM.esc(_displayName())}</div>
        <div class="auth-dropdown__email">${BM.esc(currentUser?.email || '')}</div>
      </div>
      <div class="auth-dropdown__sep"></div>
      <button class="auth-dropdown__item auth-dropdown__item--danger" id="_authSignOut">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Deconectare
      </button>`;

    document.body.appendChild(_dropdown);
    _dropdown.style.top   = (r.bottom + 6) + 'px';
    _dropdown.style.right = (window.innerWidth - r.right) + 'px';

    requestAnimationFrame(() => _dropdown?.classList.add('auth-dropdown--open'));

    _dropdown.querySelector('#_authSignOut').onclick = async () => {
      _closeDropdown();
      await sb.auth.signOut();
      BM.toast('Ai fost deconectat.', 'info');
    };

    setTimeout(() => document.addEventListener('click', _closeDropdown, { once: true }), 0);
  }

  function _closeDropdown() {
    if (!_dropdown) return;
    _dropdown.classList.remove('auth-dropdown--open');
    setTimeout(() => { _dropdown?.remove(); _dropdown = null; }, 180);
  }

  /* ============================================================
     MODAL
     ============================================================ */
  function openModal(tab) {
    if (_modal) return;

    _modal = document.createElement('div');
    _modal.className = 'auth-overlay';
    _modal.innerHTML = `
      <div class="auth-modal" role="dialog" aria-modal="true">
        <button class="auth-modal__close" id="_authClose" title="Închide" aria-label="Închide">✕</button>

        <div class="auth-modal__brand">
          <span class="auth-modal__brand-icon">M</span>
          <span>Math<b>orizon</b></span>
        </div>

        <div class="auth-tabs" role="tablist">
          <button class="auth-tab auth-tab--active" data-tab="login"  role="tab">Conectare</button>
          <button class="auth-tab"                  data-tab="signup" role="tab">Înregistrare</button>
        </div>

        <div id="_authMsg" class="auth-msg" style="display:none"></div>

        <!-- LOGIN -->
        <form id="_fLogin" class="auth-form" novalidate autocomplete="on">
          <div class="auth-field">
            <label class="auth-label" for="_lEmail">Email</label>
            <input class="auth-input" id="_lEmail" type="email" placeholder="adresa@email.com" autocomplete="email" required>
          </div>
          <div class="auth-field">
            <label class="auth-label" for="_lPass">Parolă</label>
            <div class="auth-input-wrap">
              <input class="auth-input" id="_lPass" type="password" placeholder="Parola ta" autocomplete="current-password" required>
              <button type="button" class="auth-eye" data-target="_lPass" aria-label="Arată parola">👁</button>
            </div>
          </div>
          <div class="auth-row-right">
            <button type="button" class="auth-link" id="_goReset">Ai uitat parola?</button>
          </div>
          <button type="submit" class="auth-submit" id="_btnLogin">
            <span>Conectare</span><span class="auth-spin" style="display:none"></span>
          </button>
        </form>

        <!-- SIGNUP -->
        <form id="_fSignup" class="auth-form" style="display:none" novalidate autocomplete="on">
          <div class="auth-field">
            <label class="auth-label" for="_sName">Nume complet</label>
            <input class="auth-input" id="_sName" type="text" placeholder="Ion Popescu" autocomplete="name" required>
          </div>
          <div class="auth-field">
            <label class="auth-label" for="_sEmail">Email</label>
            <input class="auth-input" id="_sEmail" type="email" placeholder="adresa@email.com" autocomplete="email" required>
          </div>
          <div class="auth-field">
            <label class="auth-label" for="_sPass">Parolă</label>
            <div class="auth-input-wrap">
              <input class="auth-input" id="_sPass" type="password" placeholder="Minim 8 caractere" autocomplete="new-password" required minlength="8">
              <button type="button" class="auth-eye" data-target="_sPass" aria-label="Arată parola">👁</button>
            </div>
          </div>
          <div class="auth-field">
            <label class="auth-label" for="_sConf">Confirmă parola</label>
            <div class="auth-input-wrap">
              <input class="auth-input" id="_sConf" type="password" placeholder="Repetă parola" autocomplete="new-password" required>
              <button type="button" class="auth-eye" data-target="_sConf" aria-label="Arată parola">👁</button>
            </div>
          </div>
          <button type="submit" class="auth-submit" id="_btnSignup">
            <span>Creează cont</span><span class="auth-spin" style="display:none"></span>
          </button>
          <p class="auth-terms">La înregistrare primești <strong>3 ExamTokenuri</strong> gratuite 🎟</p>
        </form>

        <!-- RESET -->
        <form id="_fReset" class="auth-form" style="display:none" novalidate>
          <p class="auth-reset-hint">Introdu emailul contului tău și îți vom trimite un link pentru resetarea parolei.</p>
          <div class="auth-field">
            <label class="auth-label" for="_rEmail">Email</label>
            <input class="auth-input" id="_rEmail" type="email" placeholder="adresa@email.com" autocomplete="email" required>
          </div>
          <button type="submit" class="auth-submit" id="_btnReset">
            <span>Trimite link</span><span class="auth-spin" style="display:none"></span>
          </button>
          <button type="button" class="auth-link auth-back" id="_goLogin">← Înapoi la conectare</button>
        </form>

        <div class="auth-divider" id="_authDivider"><span>sau</span></div>
        <button class="auth-google" id="_authGoogle" type="button">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92A8.78 8.78 0 0 0 17.64 9.2z" fill="#4285F4"/>
            <path d="M9 18a8.6 8.6 0 0 0 5.96-2.18l-2.91-2.26A5.43 5.43 0 0 1 9 14.54 5.38 5.38 0 0 1 3.92 11H.93v2.34A9 9 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.92 11A5.27 5.27 0 0 1 3.64 9c0-.69.12-1.36.28-2L.93 4.66A9 9 0 0 0 0 9c0 1.45.35 2.82.93 4.06L3.92 11z" fill="#FBBC05"/>
            <path d="M9 3.58a4.86 4.86 0 0 1 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .93 4.66L3.9 7A5.38 5.38 0 0 1 9 3.58z" fill="#EA4335"/>
          </svg>
          Continuă cu Google
        </button>
      </div>`;

    document.body.appendChild(_modal);
    requestAnimationFrame(() => _modal?.classList.add('auth-overlay--open'));

    if (tab === 'signup') _switchTab('signup');

    /* Close handlers */
    _modal.querySelector('#_authClose').onclick = closeModal;
    _modal.addEventListener('click', e => { if (e.target === _modal) closeModal(); });
    _modal._esc = e => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', _modal._esc);

    /* Tab switching */
    _modal.querySelectorAll('.auth-tab').forEach(t => {
      t.addEventListener('click', () => _switchTab(t.dataset.tab));
    });
    _modal.querySelector('#_goReset').onclick  = () => _switchTab('reset');
    _modal.querySelector('#_goLogin').onclick  = () => _switchTab('login');

    /* Password visibility toggles */
    _modal.querySelectorAll('.auth-eye').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById(btn.dataset.target);
        if (!inp) return;
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.textContent = inp.type === 'password' ? '👁' : '🙈';
      });
    });

    /* Form submissions */
    _modal.querySelector('#_fLogin').onsubmit  = _onLogin;
    _modal.querySelector('#_fSignup').onsubmit = _onSignup;
    _modal.querySelector('#_fReset').onsubmit  = _onReset;
    _modal.querySelector('#_authGoogle').onclick = _onGoogle;

    setTimeout(() => _modal?.querySelector('input')?.focus(), 120);
  }

  function closeModal() {
    if (!_modal) return;
    document.removeEventListener('keydown', _modal._esc);
    _modal.classList.remove('auth-overlay--open');
    const el = _modal;
    _modal = null;
    setTimeout(() => el.remove(), 260);
  }

  function _switchTab(tab) {
    if (!_modal) return;
    const map = { login: '_fLogin', signup: '_fSignup', reset: '_fReset' };
    Object.entries(map).forEach(([key, id]) => {
      const f = document.getElementById(id);
      if (f) f.style.display = key === tab ? '' : 'none';
    });
    _modal.querySelectorAll('.auth-tab').forEach(t => {
      t.classList.toggle('auth-tab--active', t.dataset.tab === tab);
    });
    const isReset = tab === 'reset';
    const div = document.getElementById('_authDivider');
    const goo = document.getElementById('_authGoogle');
    if (div) div.style.display = isReset ? 'none' : '';
    if (goo) goo.style.display = isReset ? 'none' : '';
    _clearMsg();
    const firstInput = { login: '_lEmail', signup: '_sName', reset: '_rEmail' }[tab];
    setTimeout(() => document.getElementById(firstInput)?.focus(), 60);
  }

  function _showMsg(text, isError) {
    const el = document.getElementById('_authMsg');
    if (!el) return;
    el.textContent  = text;
    el.className    = isError ? 'auth-msg auth-msg--error' : 'auth-msg auth-msg--success';
    el.style.display = '';
  }
  function _clearMsg() {
    const el = document.getElementById('_authMsg');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }
  function _setLoading(btnId, on) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = on;
    const txt = btn.querySelector('span:first-child');
    const spn = btn.querySelector('.auth-spin');
    if (txt) txt.style.opacity = on ? '0' : '';
    if (spn) spn.style.display = on ? '' : 'none';
  }

  /* ============================================================
     FORM HANDLERS
     ============================================================ */
  async function _onLogin(e) {
    e.preventDefault();
    _clearMsg();
    const email = document.getElementById('_lEmail').value.trim();
    const pass  = document.getElementById('_lPass').value;
    if (!email || !pass) return _showMsg('Completează toate câmpurile.', true);

    _setLoading('_btnLogin', true);
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    _setLoading('_btnLogin', false);
    if (error) _showMsg(_roError(error.message), true);
  }

  async function _onSignup(e) {
    e.preventDefault();
    _clearMsg();
    const name  = document.getElementById('_sName').value.trim();
    const email = document.getElementById('_sEmail').value.trim();
    const pass  = document.getElementById('_sPass').value;
    const conf  = document.getElementById('_sConf').value;

    if (!name || !email || !pass || !conf) return _showMsg('Completează toate câmpurile.', true);
    if (pass.length < 8) return _showMsg('Parola trebuie să aibă cel puțin 8 caractere.', true);
    if (pass !== conf)   return _showMsg('Parolele nu coincid.', true);

    _setLoading('_btnSignup', true);
    const { error } = await sb.auth.signUp({
      email, password: pass,
      options: { data: { full_name: name } }
    });
    _setLoading('_btnSignup', false);

    if (error) return _showMsg(_roError(error.message), true);
    _showMsg('Cont creat! Verifică emailul pentru a-l confirma, apoi conectează-te.', false);
  }

  async function _onReset(e) {
    e.preventDefault();
    _clearMsg();
    const email = document.getElementById('_rEmail').value.trim();
    if (!email) return _showMsg('Introdu adresa de email.', true);

    _setLoading('_btnReset', true);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/index.html'
    });
    _setLoading('_btnReset', false);

    if (error) return _showMsg(_roError(error.message), true);
    _showMsg('Email trimis! Verifică căsuța poștală.', false);
  }

  async function _onGoogle() {
    if (!sb) return;
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    });
    if (error) _showMsg(_roError(error.message), true);
  }

  function _roError(msg) {
    console.error('[Auth] Supabase error:', msg);
    if (!msg) return 'A apărut o eroare. Încearcă din nou.';
    if (msg.includes('Invalid login credentials'))  return 'Email sau parolă incorectă.';
    if (msg.includes('Email not confirmed'))        return 'Emailul nu a fost confirmat. Verifică inbox-ul.';
    if (msg.includes('User already registered'))    return 'Există deja un cont cu acest email.';
    if (msg.includes('Password should be'))         return 'Parola trebuie să aibă cel puțin 6 caractere.';
    if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) return 'Prea multe încercări. Încearcă mai târziu.';
    return msg;
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.BMAuth = {
    init,
    openModal,
    closeModal,
    get user() { return currentUser; },
    get supabase() { return sb; }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
