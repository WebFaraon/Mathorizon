/* ============================================================
   Teorema — Auth Page (auth.html)
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
  let _swapT1 = 0, _swapT2 = 0;   // the timers of the form swap (switchTab)
  let _role     = 'elev';
  let _usernameMode = false;
  let _quietFocus = false;
  const USERNAME_DOMAIN = 'mathorizon.local';

  const $ = id => document.getElementById(id);
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FORMS = { login: 'fLogin', signup: 'fSignup', reset: 'fReset' };

  /* ============================================================
     The stage on the left: the owl talks you through the form in a speech bubble (a short line for the mode, then the rule of the field you
     are in) and, when you are not in a field, tells what the platform has: the four chips light one after the other, each with its line.
     A small path of lessons fills node by node, the XP bar follows. Same API as the old display (mode, hint, home, role, boot).
     ============================================================ */
  const LCD = (function () {
    const line = $('apLine'), bubble = line && line.parentNode, stage = $('apStage');
    const chips = Array.prototype.slice.call(document.querySelectorAll('#apChips li'));
    const PHRASE = {
      login: 'Bine ai revenit! Hai să continuăm de unde ai rămas.',
      signup: 'Creează-ți contul și pornim de la prima lecție.',
      reset: 'Nicio grijă. Îți trimitem un link pe email.'
    };
    let idx = -1, rot = 0, wait = 0, held = false;

    function say(text) {
      if (!line || !text) return;
      if (reduceMotion()) { line.textContent = text; return; }
      bubble.classList.remove('is-in'); void bubble.offsetWidth;
      line.textContent = text;
      bubble.classList.add('is-in');
      if (stage) { stage.classList.remove('is-hop'); void stage.offsetWidth; stage.classList.add('is-hop'); }
    }
    function light(i) { chips.forEach((c, k) => c.classList.toggle('on', k === i)); }
    function tick() {
      if (held || !chips.length) return;
      idx = (idx + 1) % chips.length;
      light(idx);
      say(chips[idx].dataset.say);
    }
    function start() { stop(); if (!reduceMotion()) rot = setInterval(tick, 4300); }
    function stop() { clearInterval(rot); clearTimeout(wait); }
    function resumeLater(ms) { held = true; clearTimeout(wait); wait = setTimeout(() => { held = false; start(); }, ms); }

    /* the path of lessons: nodes fill one by one, the bar grows, "+10 XP" pops, then it starts over */
    const nodes = Array.prototype.slice.call(document.querySelectorAll('#apPath .ap-n')), fill = $('apXpFill'), gain = $('apXpGain');
    let step = 0, pathT = 0;
    function paintPath() {
      nodes.forEach((n, k) => { n.classList.toggle('done', k < step); n.classList.toggle('now', k === step); });
      if (fill) fill.style.transform = 'scaleX(' + (step / nodes.length) + ')';
    }
    function pathTick() {
      step++;
      if (step > nodes.length) { step = 0; paintPath(); return; }
      paintPath();
      if (gain) { gain.classList.remove('is-pop'); void gain.offsetWidth; gain.classList.add('is-pop'); }
    }
    function startPath() {
      if (!nodes.length) return;
      if (reduceMotion()) { step = 2; paintPath(); return; }
      step = 0; paintPath();
      pathT = setInterval(pathTick, 1250);
    }

    return {
      boot(mode) {
        say(PHRASE[mode]);
        startPath();
        resumeLater(3800);
      },
      mode(mode) { say(PHRASE[mode]); light(-1); resumeLater(3800); },
      role() {},
      hint(text) { if (!text) return; stop(); held = true; light(-1); say(text); },
      home() { say(PHRASE[_tab]); resumeLater(3000); },
      figuresNow() {}
    };
  })();

  /* What each field says on the display while you are in it */
  const HINT = {
    lEmail: 'Email sau nume de utilizator.',
    lPass:  'Parola contului tău.',
    sName:  'Nume și prenume, doar litere.',
    sEmail: () => (_usernameMode ? '3-20 caractere: litere mici, cifre sau _.' : 'Adresa unde primești confirmarea.'),
    sPass:  'Minim 8 caractere.',
    sConf:  'Repetă aceeași parolă.',
    rEmail: 'Emailul contului tău.'
  };
  const ROLE_HINT = {
    elev: 'Elev: lecții, exerciții și simulări BAC.',
    profesor: 'Profesor: contul se activează după aprobarea adminului.',
    manager: 'Manager: doar consola, după aprobarea adminului.'
  };

  /* The page the person came for (?from=...). Google takes the browser away and brings it back to auth.html without the query,
     so it is kept for that round trip in sessionStorage. */
  function _fromParam() {
    let from = new URLSearchParams(window.location.search).get('from');
    try {
      if (from) sessionStorage.setItem('bm_auth_from', from);
      else from = sessionStorage.getItem('bm_auth_from');
    } catch (e) { /* private mode: the default page */ }
    return from || null;
  }
  function _getFrom() {
    const from = _fromParam() || 'parcurs.html';
    try { sessionStorage.removeItem('bm_auth_from'); } catch (e) { /* ignore */ }
    return from.startsWith('http') || from.startsWith('//') ? 'parcurs.html' : from;
  }

  /* A teacher who chose Profesor and then Google: Google cannot carry the role, so it is kept here and written to the new account
     (as user metadata, like the email form does) before the profile is made. An account that already exists keeps its role. */
  /* Conectare is for an account that exists, Înregistrare for a new one, and Google cannot tell them apart by itself (it makes the
     account the first time it sees an identity). So the tab the Google key was pressed in is remembered for the round trip, and when
     Google brings the person back the server (api/auth/oauth-guard.js) says whether what happened fits that tab:
       "no-account": they pressed it in Conectare but no account existed: the account Google just made is removed, they go to Înregistrare;
       "exists": they pressed it in Înregistrare but the account already existed: they are signed out and sent to Conectare.
     If the check cannot be reached the sign-in goes through as before (a failed check must never lock people out). */
  async function _oauthGuard(session) {
    let intent = null;
    try {
      const raw = JSON.parse(localStorage.getItem('bm_oauth_intent') || 'null');
      localStorage.removeItem('bm_oauth_intent');
      if (raw && (raw.intent === 'login' || raw.intent === 'signup') && Date.now() - raw.at < 10 * 60 * 1000) intent = raw.intent;
    } catch (e) { /* ignore */ }
    if (!intent || !session) return 'ok';
    try {
      const r = await fetch('/api/auth/oauth-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ intent })
      });
      if (!r.ok) return 'ok';
      const j = await r.json();
      return j && (j.status === 'no-account' || j.status === 'exists') ? j.status : 'ok';
    } catch (e) { return 'ok'; }
  }
  async function _refuseGoogle(verdict) {
    try { localStorage.removeItem('bm_pending_role'); } catch (e) { /* ignore */ }
    try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { /* the session is dropped below anyway */ }
    _redirecting = false;
    switchTab(verdict === 'exists' ? 'login' : 'signup');
    _showMsg(verdict === 'exists'
      ? 'Există deja un cont cu acest cont Google. Conectează-te din Conectare.'
      : 'Nu există încă un cont cu acest cont Google. Creează-l din Înregistrare.', true);
  }

  async function _applyPendingRole(session) {
    let role = null;
    /* kept only for the trip to Google and back: a choice abandoned there must not turn a later student sign-up into a teacher */
    try {
      const raw = JSON.parse(localStorage.getItem('bm_pending_role') || 'null');
      if (raw && (raw.role === 'profesor' || raw.role === 'manager') && Date.now() - raw.at < 10 * 60 * 1000) role = raw.role;
      localStorage.removeItem('bm_pending_role');
    } catch (e) { /* ignore */ }
    if (!role || !sb || !session) return;
    try {
      const { data } = await sb.from('user_profiles').select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (data) return;
      await sb.auth.updateUser({ data: { role } });
    } catch (e) { /* the account is made as a student; an admin can change it */ }
  }

  // An admin with no explicit destination lands in the admin console.
  let _redirecting = false;
  /* The welcome after a real sign-in (js/welcome.js): the violet panel with the owl is already up (it went up when the key was pressed); it warms the next page in the background, fills its slider and hands over. Not for a visit with a session that was already there. */
  function _go(url, welcome, session) {
    if (welcome && window.TeoremaWelcome) {
      const md = (session && session.user && session.user.user_metadata) || {};
      const first = String(md.full_name || md.name || md.username || '').trim().split(/\s+/)[0] || '';
      window.TeoremaWelcome.finish(url, { name: first, mode: _tab === 'signup' ? 'signup' : 'login' });
    } else {
      window.location.replace(url);
    }
  }

  async function _redirect(session, welcome) {
    if (_redirecting) return;
    _redirecting = true;
    const verdict = await _oauthGuard(session);
    if (verdict !== 'ok') { if (window.TeoremaWelcome) window.TeoremaWelcome.cancel(); await _refuseGoogle(verdict); return; }
    await _applyPendingRole(session);
    const explicit = _fromParam();
    try {
      if (session && sb) {
        const { data: me } = await sb.from('user_profiles').select('role').eq('user_id', session.user.id).maybeSingle();
        if (me && me.role === 'manager') { _go('admin.html', welcome, session); return; }
      }
    } catch (e) { /* the default page below */ }
    if (!explicit && session && sb) {
      try {
        const { data } = await sb.from('user_profiles').select('role').eq('user_id', session.user.id).maybeSingle();
        if (data && (data.role === 'admin' || data.role === 'manager')) { _go('admin.html', welcome, session); return; }
      } catch (e) { /* fall through to the default page */ }
    }
    _go(_getFrom(), welcome, session);
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
    document.body.classList.remove('ap-boot');       // the first-paint entrances must not play again
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

    /* the swap is a small show: the old form slides out and fades, the panel eases to the height of the new one, the new form
       slides in from the side the key points to and its fields land one after the other */
    const panel = $('apPanel');
    const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finishSwap = () => {
      clearTimeout(_swapT1); clearTimeout(_swapT2);
      document.querySelectorAll('.ap-form').forEach(f => f.classList.remove('is-out'));
      if (panel) { panel.classList.remove('is-resizing'); panel.style.height = ''; }
    };
    const h0 = panel ? panel.getBoundingClientRect().height : 0;    // the height now, before anything changes
    finishSwap();                                    // a quick second press ends the first show at once
    const show = () => {
      if (prevEl) prevEl.style.display = 'none';
      if (!nextEl) return;
      nextEl.style.display = '';
      if (calm || !panel) { nextEl.classList.remove('is-in'); void nextEl.offsetWidth; nextEl.classList.add('is-in'); setTimeout(() => nextEl.classList.remove('is-in'), 600); return; }
      panel.style.height = 'auto';
      const h1 = panel.offsetHeight;                 // the natural height of the new form
      panel.style.height = h0 + 'px';
      void panel.offsetHeight;
      panel.classList.add('is-resizing');
      panel.style.height = h1 + 'px';
      nextEl.style.setProperty('--ap-dx', dir);
      nextEl.classList.remove('is-in'); void nextEl.offsetWidth; nextEl.classList.add('is-in');
      _swapT2 = setTimeout(() => { nextEl.classList.remove('is-in'); panel.classList.remove('is-resizing'); panel.style.height = ''; }, 560);
    };
    const order = ['login', 'signup', 'reset'];
    const dir = order.indexOf(tab) > order.indexOf(prev) ? 1 : -1;
    if (prevEl && !calm && prevEl.style.display !== 'none') {
      prevEl.style.setProperty('--ap-dx', dir);
      prevEl.classList.add('is-out');
      _swapT1 = setTimeout(() => { prevEl.classList.remove('is-out'); show(); }, 150);
    } else show();
    LCD.mode(tab);
    /* the cursor goes to the first field, but the display keeps its greeting: it prints a field's rule only when the person goes there */
    setTimeout(() => { if (_tab !== tab) return; const f = $({ login: 'lEmail', signup: 'sName', reset: 'rEmail' }[tab]); if (f) { _quietFocus = true; f.focus({ preventScroll: true }); _quietFocus = false; } }, 220);

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
    if (msg.includes('provider is not enabled') || msg.includes('Unsupported provider')) return 'Conectarea cu Google nu este activată încă. Folosește emailul și parola.';
    if (msg.includes('access_denied')) return 'Conectarea cu Google a fost anulată.';
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
    if (window.TeoremaWelcome) window.TeoremaWelcome.start({ mode: 'login' });      // the panel goes up at once, before the network answers
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    _setLoading('btnLogin', false);
    if (error) { if (window.TeoremaWelcome) window.TeoremaWelcome.cancel(); return _showMsg(_roError(error.message), true); }
  }
  window.onLogin = onLogin;

  /* Numele complet: doar litere (cu diacritice), spatiu, cratima si apostrof; cel putin doua cuvinte de cate doua litere */
  const NAME_BAD = /[^\p{L}\s'’-]/gu;
  function _cleanName(v) { return v.replace(NAME_BAD, '').replace(/\s{2,}/g, ' ').replace(/^[\s'’-]+/, ''); }
  function _validName(v) {
    const words = v.trim().split(/\s+/);
    return words.length >= 2 && words.every(w => /^\p{L}[\p{L}'’-]*\p{L}$/u.test(w));
  }
  function _wireName() {
    const inp = $('sName');
    if (!inp) return;
    inp.addEventListener('input', () => {
      const c = _cleanName(inp.value);
      if (c !== inp.value) { const pos = inp.selectionStart - (inp.value.length - c.length); inp.value = c; try { inp.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
    });
  }

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
    if (!_validName(name)) { _markInvalid(['sName']); return _showMsg('Scrie numele complet, nume și prenume, doar cu litere (fără cifre, simboluri sau puncte).', true); }
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
    if (window.TeoremaWelcome) window.TeoremaWelcome.start({ mode: 'signup' });
    const { data: signUpData, error } = await sb.auth.signUp({
      email: contact, password: pass,
      options: { data: { full_name: name, role: _role } }
    });
    _setLoading('btnSignup', false);
    if (error) { if (window.TeoremaWelcome) window.TeoremaWelcome.cancel(); return _showMsg(_roError(error.message), true); }
    /* no session yet = the account waits for the e-mail: nothing to welcome, the message is shown on the form */
    if (!(signUpData && signUpData.session) && window.TeoremaWelcome) window.TeoremaWelcome.cancel();
    LCD.hint('Cont creat.');
    if (_role === 'profesor' || _role === 'manager') {
      _showMsg(`Cont creat! Verifică emailul pentru confirmare. Contul tău de ${_role} va fi activat după aprobarea adminului.`, false);
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

  /* The Google key is lit only when the project has the provider on (Supabase answers it on /auth/v1/settings). Until then it is printed flat
     with "în curând", and a press says why, instead of sending the browser to a page of JSON. */
  let _googleOn = true;
  async function _checkGoogle() {
    try {
      const r = await fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_ANON } });
      if (!r.ok) return;
      const s = await r.json();
      _googleOn = !!(s && s.external && s.external.google);
    } catch (e) { return; }                       // offline or blocked: leave the key lit, the press will say what happened
    const g = $('authGoogle');
    if (!g) return;
    g.classList.toggle('is-off', !_googleOn);
    g.setAttribute('aria-disabled', _googleOn ? 'false' : 'true');
  }
  async function onGoogle() {
    if (!sb) return _noService();
    _clearMsg();
    if (!_googleOn) return _showMsg('Conectarea cu Google nu este activată încă. Folosește emailul și parola.', true);
    _fromParam();                                  // keep the page asked for across the round trip
    try { localStorage.setItem('bm_oauth_intent', JSON.stringify({ intent: _tab === 'signup' ? 'signup' : 'login', at: Date.now() })); } catch (e) { /* ignore */ }
    try { if (_tab === 'signup' && (_role === 'profesor' || _role === 'manager')) localStorage.setItem('bm_pending_role', JSON.stringify({ role: _role, at: Date.now() })); else localStorage.removeItem('bm_pending_role'); } catch (e) { /* ignore */ }
    const g = $('authGoogle');
    if (g) { g.disabled = true; g.classList.add('is-loading'); }
    try { sessionStorage.setItem('teorema_oauth_welcome', String(Date.now())); } catch (e) { /* ignore */ }
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth.html' }
    });
    if (error) { if (g) { g.disabled = false; g.classList.remove('is-loading'); } _showMsg(_roError(error.message), true); }
  }
  window.onGoogle = onGoogle;

  /* ---- INIT: the page itself does not wait for Supabase ---- */
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    /* Read initial tab + role from URL params (the landing page's route
       cards link here with both, e.g. auth.html?tab=signup&role=profesor,
       so the signup form opens with the right role already selected). */
    if (params.get('role') === 'profesor' || params.get('role') === 'manager') { _role = params.get('role'); selectRole(_role); }
    if (tabParam === 'signup' || tabParam === 'reset') {
      /* the form shows at once, without the swap animation: the display boots straight into that mode */
      switchTab(tabParam);
    }
    /* Google (through Supabase) brings an error back on the URL when the person cancels or the sign-in is refused */
    const hashQ = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const back = params.get('error_description') || params.get('error') || hashQ.get('error_description') || hashQ.get('error');
    const backCode = params.get('error') || hashQ.get('error');
    if (back) {
      try { localStorage.removeItem('bm_pending_role'); } catch (e) { /* ignore */ }
      _showMsg(backCode === 'access_denied' ? 'Conectarea cu Google a fost anulată.' : _roError(String(back).replace(/\+/g, ' ')), true);
      history.replaceState(null, '', window.location.pathname + (tabParam ? '?tab=' + tabParam : ''));
    }
    _checkGoogle();
    LCD.boot(_tab);
    setTimeout(() => document.body.classList.remove('ap-boot'), 2600);
    _wireModeKeys(); _wirePassword(); _wireCaps(); _wireHints(); _wireName();
  });

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) return;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    /* If already logged in, redirect immediately */
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { try { sessionStorage.removeItem('teorema_oauth_welcome'); } catch (e) { /* ignore */ } if (window.TeoremaWelcome) window.TeoremaWelcome.cancel(); }
    if (session) {
      /* Back from Google a moment ago counts as a sign-in; a visit with an old session does not. */
      let fromGoogle = false;
      try { const t = Number(sessionStorage.getItem('teorema_oauth_welcome')); sessionStorage.removeItem('teorema_oauth_welcome'); fromGoogle = !!t && Date.now() - t < 10 * 60 * 1000; } catch (e) { /* ignore */ }
      _redirect(session, fromGoogle);
      return;
    }

    /* Listen for auth state changes (handles OAuth hash) */
    sb.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        _redirect(session, event === 'SIGNED_IN');
      }
    });
  });
})();
