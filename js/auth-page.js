/* ============================================================
   Mathorizon — Auth Page (auth.html)
   Standalone — does NOT depend on auth.js timing
   The look is the calculator world (css/auth-page.css); this file holds
   the behaviour: Supabase sign-in / sign-up / reset, Google, the role,
   and the display (LCD) that talks you through the form.
   ============================================================ */

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  let sb        = null;
  let _tab      = 'login';
  let _role     = 'elev';
  let _usernameMode = false;
  let _quietFocus = false;
  const USERNAME_DOMAIN = 'mathorizon.local';

  const $ = id => document.getElementById(id);
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FORMS = { login: 'fLogin', signup: 'fSignup', reset: 'fReset' };

  /* ============================================================
     The display. Annunciators say where you are (mode, role), a typed
     line prints a greeting and then the rule of the field you are in,
     and the figures are the site's real ones (never counted up: an LCD
     refreshes). Same grammar as the Capitole display.
     ============================================================ */
  const LCD = (function () {
    const box = $('apLcd'), line = $('apLine');
    const PHRASE = { login: 'Bine ai revenit.', signup: 'Creează-ți contul.', reset: 'Resetează parola.' };
    let timer = 0, booted = false;

    const total = () => (window.BM && BM.EXERCISES ? BM.EXERCISES.length : 0);
    const chapters = () => (window.BM && BM.CATEGORIES ? BM.CATEGORIES.length : 0);

    function type(text) {
      if (!line) return;
      clearInterval(timer);
      if (reduceMotion()) { line.textContent = text; return; }
      line.textContent = '';
      let i = 0;
      timer = setInterval(() => {
        i++;
        line.textContent = text.slice(0, i);
        if (i >= text.length) clearInterval(timer);
      }, 22);
    }
    function refreshFrames() {
      if (!box || reduceMotion()) return;
      box.classList.remove('ap-lcd--refresh');
      void box.offsetWidth;
      box.classList.add('ap-lcd--refresh');
    }
    function figures(mode) {
      const put = (id, v) => { const el = $(id); if (el) el.textContent = v; };
      if (mode === 'signup') {
        put('apFigA', '3');          put('apUnitA', 'ExamTokenuri gratuite');
        put('apFigB', total() || ''); put('apUnitB', 'exerciții');
      } else {
        put('apFigA', total() || ''); put('apUnitA', 'exerciții');
        put('apFigB', chapters() || ''); put('apUnitB', 'capitole');
      }
    }
    function annunciators(mode) {
      if (!box) return;
      box.querySelectorAll('[data-ann]').forEach(a => {
        const k = a.dataset.ann;
        a.classList.toggle('ap-lcd__a--on', k === mode || (mode === 'signup' && k === _role));
      });
    }
    return {
      /* power-on: the segment test (eights), then the real readout */
      boot(mode) {
        if (!box) return;
        const done = () => {
          booted = true;
          box.classList.remove('ap-lcd--boot');
          figures(mode); annunciators(mode); type(PHRASE[mode]);
        };
        if (reduceMotion()) { done(); return; }
        setTimeout(done, 600);
      },
      mode(mode) {
        if (!booted) return;
        figures(mode); annunciators(mode); refreshFrames(); type(PHRASE[mode]);
      },
      role() { if (booted) annunciators(_tab); },
      hint(text) { if (booted && text) type(text); },
      home() { if (booted) type(PHRASE[_tab]); },
      /* the bank can grow after custom exercises load: show the settled number */
      figuresNow() { if (booted) { figures(_tab); refreshFrames(); } }
    };
  })();

  /* What each field says on the display while you are in it */
  const HINT = {
    lEmail: 'Email sau nume de utilizator.',
    lPass:  'Parola contului tău.',
    sName:  'Numele tău complet.',
    sEmail: () => (_usernameMode ? '3-20 caractere: litere mici, cifre sau _.' : 'Adresa unde primești confirmarea.'),
    sPass:  'Minim 8 caractere.',
    sConf:  'Repetă aceeași parolă.',
    rEmail: 'Emailul contului tău.'
  };
  const ROLE_HINT = {
    elev: 'Elev: acces complet la exerciții și simulări.',
    profesor: 'Profesor: contul se activează după aprobarea adminului.'
  };

  /* ---- Exercise count: same BM.EXERCISES source capitole.html uses, so
     this page never drifts from the real total. Waits on custom
     exercises so it lands on the settled number. ---- */
  function _watchBank() {
    if (!window.BM || !BM.EXERCISES) return;
    const ready = BM.customExercisesReady ? BM.customExercisesReady() : Promise.resolve();
    ready.then(() => LCD.figuresNow()).catch(() => {});
  }

  function _getFrom() {
    const from = new URLSearchParams(window.location.search).get('from') || 'capitole.html';
    return from.startsWith('http') ? 'capitole.html' : from;
  }

  // An admin with no explicit destination lands in the admin console.
  let _redirecting = false;
  async function _redirect(session) {
    if (_redirecting) return;
    _redirecting = true;
    const explicit = new URLSearchParams(window.location.search).get('from');
    if (!explicit && session && sb) {
      try {
        const { data } = await sb.from('user_profiles').select('role').eq('user_id', session.user.id).maybeSingle();
        if (data && data.role === 'admin') { window.location.replace('admin.html'); return; }
      } catch (e) { /* fall through to the default page */ }
    }
    window.location.replace(_getFrom());
  }

  /* ---- Message helpers ---- */
  function _showMsg(text, isError) {
    const el = $('authMsg'), t = $('authMsgText');
    if (!el || !t) return;
    t.textContent = text;
    el.className = 'ap-msg ' + (isError ? 'ap-msg--error' : 'ap-msg--success');
    el.hidden = false;
    void el.offsetWidth;                       // replay the entrance when a new message replaces an old one
    el.classList.add('is-new');
  }
  function _clearMsg() {
    const el = $('authMsg'), t = $('authMsgText');
    if (el) el.hidden = true;
    if (t) t.textContent = '';
  }
  function _setLoading(btnId, on) {
    const btn = $(btnId);
    if (!btn) return;
    btn.disabled = on;
    btn.classList.toggle('is-loading', on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }
  /* fields that were left empty: red edge, a nudge, and the cursor goes to the first one */
  function _markInvalid(ids) {
    let first = null;
    ids.forEach(id => {
      const el = $(id);
      if (!el) return;
      el.setAttribute('aria-invalid', 'true');
      if (!first) first = el;
    });
    if (first) {
      first.classList.remove('is-nudge'); void first.offsetWidth; first.classList.add('is-nudge');
      first.focus();
    }
  }
  function _clearInvalid(form) {
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  }

  /* ---- Mode keys: Conectare / Înregistrare (and the reset form, which hides them) ---- */
  function switchTab(tab) {
    if (tab === _tab) return;
    const prev = _tab;
    _tab = tab;
    const isReset = tab === 'reset';
    const prevEl = $(FORMS[prev]), nextEl = $(FORMS[tab]);
    const modes = document.querySelector('.ap-modes'), divider = $('authDivider'), google = $('authGoogle');

    document.querySelectorAll('.ap-mode').forEach(t => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('ap-mode--on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on || (isReset && t.dataset.tab === 'login') ? 0 : -1;
    });
    if (modes)   modes.style.display   = isReset ? 'none' : '';
    if (divider) divider.style.display = isReset ? 'none' : '';
    if (google)  google.style.display  = isReset ? 'none' : '';

    if (prevEl) prevEl.style.display = 'none';
    if (nextEl) {
      nextEl.style.display = '';
      nextEl.classList.remove('is-in'); void nextEl.offsetWidth; nextEl.classList.add('is-in');
      setTimeout(() => nextEl.classList.remove('is-in'), 600);
    }
    LCD.mode(tab);
    /* the cursor goes to the first field, but the display keeps its greeting: it prints a field's rule only when the person goes there */
    setTimeout(() => { const f = $({ login: 'lEmail', signup: 'sName', reset: 'rEmail' }[tab]); if (f) { _quietFocus = true; f.focus(); _quietFocus = false; } }, 40);

    _clearMsg();
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    history.replaceState(null, '', url);
  }
  window.switchTab = switchTab;

  /* arrow keys move between the two mode keys, like a tab list */
  function _wireModeKeys() {
    const modes = document.querySelector('.ap-modes');
    if (!modes) return;
    modes.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = _tab === 'login' ? 'signup' : 'login';
      switchTab(next);
      const k = modes.querySelector(`[data-tab="${next}"]`);
      if (k) k.focus();
    });
  }

  /* ---- Role selection ---- */
  window.selectRole = function (role) {
    _role = role;
    document.querySelectorAll('.ap-role').forEach(btn => {
      const on = btn.dataset.role === role;
      btn.classList.toggle('ap-role--on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    LCD.role();
    LCD.hint(ROLE_HINT[role]);
  };

  /* ---- Username-instead-of-email toggle (signup only) ---- */
  window.toggleUsernameMode = function () {
    _usernameMode = !_usernameMode;
    const input = $('sEmail'), label = $('sContactLabel'), btn = $('toggleUsernameBtn'), hint = $('usernameHint');
    if (!input || !label || !btn || !hint) return;
    if (_usernameMode) {
      input.type = 'text';
      input.placeholder = 'ex: ion_popescu92';
      input.autocomplete = 'username';
      label.textContent = 'Nume de utilizator';
      btn.textContent = 'Am totuși un email';
      hint.hidden = false;
    } else {
      input.type = 'email';
      input.placeholder = 'adresa@email.com';
      input.autocomplete = 'email';
      label.textContent = 'Email';
      btn.textContent = 'Nu am email, folosesc un nume de utilizator';
      hint.hidden = true;
    }
    input.value = '';
    input.removeAttribute('aria-invalid');
    input.focus();
    _clearMsg();
  };

  /* ---- Password visibility ---- */
  window.togglePw = function (btn) {
    const inp = $(btn.dataset.target);
    if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.innerHTML = icon(show ? 'eye-off' : 'eye', { size: 16 });
    btn.setAttribute('aria-pressed', show ? 'true' : 'false');
    btn.setAttribute('aria-label', show ? 'Ascunde parola' : 'Arată parola');
  };

  /* ---- Password length: eight cells, one per required character ---- */
  function _wirePassword() {
    const pass = $('sPass'), conf = $('sConf'), cells = $('sPassCells'), count = $('sPassN'), match = $('sMatch');
    if (!pass || !cells) return;
    const paintCells = () => {
      const len = pass.value.length, n = Math.min(len, 8);
      cells.querySelectorAll('i').forEach((c, i) => c.classList.toggle('on', i < n));
      cells.classList.toggle('ok', len >= 8);
      if (count) count.textContent = n + '/8';
      cells.setAttribute('aria-label', len >= 8 ? `Parola are ${len} caractere: destul` : `Parola are ${len} din cele 8 caractere necesare`);
    };
    const paintMatch = () => {
      if (!match) return;
      const a = pass.value, b = conf.value;
      if (!b) { match.hidden = true; return; }
      const same = a === b;
      match.hidden = false;
      match.classList.toggle('is-ok', same);
      match.classList.toggle('is-bad', !same);
      match.querySelector('span').textContent = same ? 'Parolele coincid.' : 'Parolele nu coincid încă.';
    };
    pass.addEventListener('input', () => { paintCells(); paintMatch(); });
    conf.addEventListener('input', paintMatch);
  }

  /* Caps Lock: a small amber light under a password field while it is on */
  function _wireCaps() {
    document.querySelectorAll('.ap-caps').forEach(note => {
      const inp = $(note.dataset.caps);
      if (!inp) return;
      const check = e => { note.hidden = !(e.getModifierState && e.getModifierState('CapsLock')); };
      inp.addEventListener('keydown', check);
      inp.addEventListener('keyup', check);
      inp.addEventListener('blur', () => { note.hidden = true; });
    });
  }

  /* The display names the field you are in and prints its rule */
  function _wireHints() {
    document.addEventListener('focusin', e => {
      if (_quietFocus) return;
      const h = HINT[e.target.id];
      if (h) LCD.hint(typeof h === 'function' ? h() : h);
    });
    document.addEventListener('focusout', e => {
      if (!HINT[e.target.id]) return;
      setTimeout(() => {
        const a = document.activeElement;
        if (!a || !HINT[a.id]) LCD.home();
      }, 250);
    });
    /* typing clears the red edge of the field */
    document.addEventListener('input', e => { if (e.target.removeAttribute) e.target.removeAttribute('aria-invalid'); });
  }

  /* ---- Error translation ---- */
  function _roError(msg) {
    if (!msg) return 'A apărut o eroare. Încearcă din nou.';
    if (msg.includes('Invalid login credentials'))  return 'Date de conectare incorecte.';
    if (msg.includes('Email not confirmed'))        return 'Emailul nu a fost confirmat. Verifică inbox-ul.';
    if (msg.includes('User already registered'))    return 'Există deja un cont cu acest email.';
    if (msg.includes('Password should be'))         return 'Parola trebuie să aibă cel puțin 6 caractere.';
    if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit'))
      return 'Prea multe încercări. Încearcă mai târziu.';
    return msg;
  }
  const _noService = () => _showMsg('Serviciul de autentificare nu s-a încărcat. Reîncarcă pagina.', true);

  /* ---- Form handlers ---- */
  async function onLogin(e) {
    e.preventDefault();
    _clearMsg(); _clearInvalid($('fLogin'));
    if (!sb) return _noService();
    const raw  = $('lEmail')?.value.trim();
    const pass = $('lPass')?.value;
    if (!raw || !pass) {
      _markInvalid([!raw && 'lEmail', !pass && 'lPass'].filter(Boolean));
      return _showMsg('Completează toate câmpurile.', true);
    }
    const email = raw.includes('@') ? raw : `${raw.toLowerCase()}@${USERNAME_DOMAIN}`;
    _setLoading('btnLogin', true);
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    _setLoading('btnLogin', false);
    if (error) return _showMsg(_roError(error.message), true);
  }
  window.onLogin = onLogin;

  async function onSignup(e) {
    e.preventDefault();
    _clearMsg(); _clearInvalid($('fSignup'));
    if (!sb) return _noService();
    const name    = $('sName')?.value.trim();
    const contact = $('sEmail')?.value.trim();
    const pass    = $('sPass')?.value;
    const conf    = $('sConf')?.value;
    if (!name || !contact || !pass || !conf) {
      _markInvalid([!name && 'sName', !contact && 'sEmail', !pass && 'sPass', !conf && 'sConf'].filter(Boolean));
      return _showMsg('Completează toate câmpurile.', true);
    }
    if (pass.length < 8) { _markInvalid(['sPass']); return _showMsg('Parola trebuie să aibă cel puțin 8 caractere.', true); }
    if (pass !== conf)   { _markInvalid(['sConf']); return _showMsg('Parolele nu coincid.', true); }

    if (_usernameMode) {
      const username = contact.toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        _markInvalid(['sEmail']);
        return _showMsg('Numele de utilizator trebuie să aibă 3-20 caractere: litere mici, cifre sau „_”.', true);
      }
      _setLoading('btnSignup', true);
      try {
        const resp = await fetch('/api/auth/register-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: pass, full_name: name, role: _role })
        });
        const data = await resp.json();
        if (!resp.ok) { _setLoading('btnSignup', false); return _showMsg(data.error || 'A apărut o eroare.', true); }
        const { error } = await sb.auth.signInWithPassword({ email: data.email, password: pass });
        _setLoading('btnSignup', false);
        if (error) return _showMsg(_roError(error.message), true);
        /* redirect handled by onAuthStateChange listener once SIGNED_IN fires */
      } catch (err) {
        _setLoading('btnSignup', false);
        _showMsg('Eroare de rețea. Încearcă din nou.', true);
      }
      return;
    }

    _setLoading('btnSignup', true);
    const { error } = await sb.auth.signUp({
      email: contact, password: pass,
      options: { data: { full_name: name, role: _role } }
    });
    _setLoading('btnSignup', false);
    if (error) return _showMsg(_roError(error.message), true);
    LCD.hint('Cont creat.');
    if (_role === 'profesor') {
      _showMsg('Cont creat! Verifică emailul pentru confirmare. Contul tău de profesor va fi activat după aprobarea adminului.', false);
    } else {
      _showMsg('Cont creat! Verifică emailul pentru confirmare, apoi conectează-te.', false);
    }
  }
  window.onSignup = onSignup;

  async function onReset(e) {
    e.preventDefault();
    _clearMsg(); _clearInvalid($('fReset'));
    if (!sb) return _noService();
    const email = $('rEmail')?.value.trim();
    if (!email) { _markInvalid(['rEmail']); return _showMsg('Introdu adresa de email.', true); }
    _setLoading('btnReset', true);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth.html?tab=login'
    });
    _setLoading('btnReset', false);
    if (error) return _showMsg(_roError(error.message), true);
    LCD.hint('Email trimis.');
    _showMsg('Email trimis! Verifică căsuța poștală.', false);
  }
  window.onReset = onReset;

  async function onGoogle() {
    if (!sb) return _noService();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth.html' }
    });
    if (error) _showMsg(_roError(error.message), true);
  }
  window.onGoogle = onGoogle;

  /* ---- INIT: the page itself does not wait for Supabase ---- */
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    /* Read initial tab + role from URL params (the landing page's route
       cards link here with both, e.g. auth.html?tab=signup&role=profesor,
       so the signup form opens with the right role already selected). */
    if (params.get('role') === 'profesor') { _role = 'profesor'; selectRole('profesor'); }
    if (tabParam === 'signup' || tabParam === 'reset') {
      /* the form shows at once, without the swap animation: the display boots straight into that mode */
      switchTab(tabParam);
    }
    LCD.boot(_tab);
    _watchBank();
    _wireModeKeys(); _wirePassword(); _wireCaps(); _wireHints();
  });

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) return;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    /* If already logged in, redirect immediately */
    const { data: { session } } = await sb.auth.getSession();
    if (session) { _redirect(session); return; }

    /* Listen for auth state changes (handles OAuth hash) */
    sb.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        _redirect(session);
      }
    });
  });
})();
