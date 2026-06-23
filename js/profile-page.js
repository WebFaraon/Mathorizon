/* ============================================================
   Mathorizon — Profile Page (profile.html)
   ============================================================ */

(function () {
  'use strict';

  function _waitForAuth() {
    return new Promise(resolve => {
      if (window.BMAuth?.supabase) return resolve(window.BMAuth);
      document.addEventListener('bmauth:ready', () => resolve(window.BMAuth), { once: true });
    });
  }

  function _roError(msg) {
    if (!msg) return 'A apărut o eroare.';
    if (msg.includes('Password should be'))          return 'Parola trebuie să aibă cel puțin 6 caractere.';
    if (msg.includes('same_password'))               return 'Noua parolă trebuie să fie diferită de cea actuală.';
    if (msg.includes('Invalid login credentials'))   return 'Parola curentă este incorectă.';
    if (msg.includes('rate limit'))                  return 'Prea multe încercări. Încearcă mai târziu.';
    return msg;
  }

  function _formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ---- Render profile ---- */
  async function renderProfile(user, sb) {
    const content  = document.getElementById('profileContent');
    const skeleton = document.getElementById('profileSkeleton');
    if (!content || !skeleton) return;

    const name      = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Utilizator';
    const email     = user.email || '';
    const avatarUrl = user.user_metadata?.avatar_url || null;
    const memberSince = _formatDate(user.created_at);
    const tokens    = parseInt(localStorage.getItem('bac_exam_tokens') ?? '3', 10);
    const verified  = user.email_confirmed_at ? true : false;

    /* initials */
    const parts = name.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase() || '?';

    content.innerHTML = `
      <!-- PROFILE HEADER -->
      <div class="prof-header">
        <div class="prof-avatar-lg">
          ${avatarUrl
            ? `<img src="${avatarUrl}" alt="${BM.esc(name)}" class="prof-avatar-img">`
            : `<span class="prof-avatar-initials">${BM.esc(initials)}</span>`}
        </div>
        <div class="prof-header-info">
          <h1 class="prof-name">${BM.esc(name)}</h1>
          <p class="prof-email">${BM.esc(email)}</p>
          <div class="prof-badges">
            <span class="prof-badge prof-badge--blue">Elev</span>
            ${verified ? '<span class="prof-badge prof-badge--green">✓ Email verificat</span>' : '<span class="prof-badge prof-badge--yellow">Email neverificat</span>'}
          </div>
        </div>
        <button class="btn btn--danger-outline prof-logout-btn" id="profLogout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Deconectare
        </button>
      </div>

      <!-- STATS ROW -->
      <div class="prof-stats">
        <div class="prof-stat">
          <div class="prof-stat__val">${tokens}</div>
          <div class="prof-stat__lbl">ExamTokenuri</div>
          <div class="prof-stat__sub">disponibile</div>
        </div>
        <div class="prof-stat">
          <div class="prof-stat__val">${memberSince}</div>
          <div class="prof-stat__lbl">Membru din</div>
          <div class="prof-stat__sub">&nbsp;</div>
        </div>
        <div class="prof-stat" id="profExamsStatBox">
          <div class="prof-stat__val" id="profExamCount">—</div>
          <div class="prof-stat__lbl">Simulări BAC</div>
          <div class="prof-stat__sub">efectuate</div>
        </div>
      </div>

      <!-- CARDS GRID -->
      <div class="prof-grid">

        <!-- Card: Informații cont -->
        <div class="prof-card">
          <div class="prof-card__head">
            <span class="prof-card__icon">👤</span>
            <span class="prof-card__title">Informații cont</span>
          </div>
          <div class="prof-card__body">
            <div class="prof-field-row">
              <span class="prof-field-lbl">Nume</span>
              <span class="prof-field-val">${BM.esc(name)}</span>
            </div>
            <div class="prof-field-row">
              <span class="prof-field-lbl">Email</span>
              <span class="prof-field-val">${BM.esc(email)}</span>
            </div>
            <div class="prof-field-row">
              <span class="prof-field-lbl">Cont creat</span>
              <span class="prof-field-val">${memberSince}</span>
            </div>
            <div class="prof-field-row">
              <span class="prof-field-lbl">Provider</span>
              <span class="prof-field-val">${user.app_metadata?.provider === 'google' ? '🌐 Google' : '📧 Email / Parolă'}</span>
            </div>
          </div>
        </div>

        <!-- Card: ExamTokenuri -->
        <div class="prof-card">
          <div class="prof-card__head">
            <span class="prof-card__icon">🎟</span>
            <span class="prof-card__title">ExamTokenuri</span>
          </div>
          <div class="prof-card__body">
            <div class="prof-token-display">
              <span class="prof-token-count ${tokens === 0 ? 'prof-token-count--empty' : tokens === 1 ? 'prof-token-count--low' : ''}">${tokens}</span>
              <span class="prof-token-lbl">token${tokens === 1 ? '' : 'uri'} disponibil${tokens === 1 ? '' : 'e'}</span>
            </div>
            <p class="prof-token-hint">
              ${tokens === 0
                ? 'Ai folosit toate tokenurile. Achiziționează mai multe pentru a continua simulările BAC.'
                : tokens === 1
                  ? 'Ai rămas cu un singur token. Folosește-l cu grijă!'
                  : `Poți efectua ${tokens} simulări BAC cu tokenurile tale.`}
            </p>
            <a class="btn btn--primary btn--sm" href="bac.html?new=1">
              Începe simulare BAC →
            </a>
          </div>
        </div>

        <!-- Card: Schimbă parola -->
        <div class="prof-card" id="cardPassword">
          <div class="prof-card__head">
            <span class="prof-card__icon">🔐</span>
            <span class="prof-card__title">Schimbă parola</span>
          </div>
          <div class="prof-card__body">
            ${user.app_metadata?.provider === 'google'
              ? '<p class="prof-hint-muted">Contul tău folosește autentificarea Google. Parola se gestionează din contul Google.</p>'
              : `
              <div id="pwMsg" class="auth-msg" style="display:none"></div>
              <form id="fPassword" novalidate>
                <div class="auth-field" style="margin-bottom:12px">
                  <label class="auth-label" for="pwNew">Parolă nouă</label>
                  <div class="auth-input-wrap">
                    <input class="auth-input" id="pwNew" type="password" placeholder="Minim 8 caractere" autocomplete="new-password" required minlength="8">
                    <button type="button" class="auth-eye" data-target="pwNew" onclick="togglePw(this)">👁</button>
                  </div>
                </div>
                <div class="auth-field" style="margin-bottom:16px">
                  <label class="auth-label" for="pwConf">Confirmă parola nouă</label>
                  <div class="auth-input-wrap">
                    <input class="auth-input" id="pwConf" type="password" placeholder="Repetă parola" autocomplete="new-password" required>
                    <button type="button" class="auth-eye" data-target="pwConf" onclick="togglePw(this)">👁</button>
                  </div>
                </div>
                <button type="submit" class="btn btn--primary btn--sm" id="btnPw">
                  <span>Salvează parola</span><span class="auth-spin" style="display:none"></span>
                </button>
              </form>`}
          </div>
        </div>

        <!-- Card: Sesiune -->
        <div class="prof-card">
          <div class="prof-card__head">
            <span class="prof-card__icon">🔒</span>
            <span class="prof-card__title">Sesiune și securitate</span>
          </div>
          <div class="prof-card__body">
            <div class="prof-field-row">
              <span class="prof-field-lbl">Status sesiune</span>
              <span class="prof-field-val" style="color:var(--green)">● Activ</span>
            </div>
            <div class="prof-field-row">
              <span class="prof-field-lbl">Ultima autentificare</span>
              <span class="prof-field-val">${_formatDate(user.last_sign_in_at)}</span>
            </div>
            <button class="btn btn--danger-outline btn--sm" id="btnLogout2" style="margin-top:16px;width:100%">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Deconectare
            </button>
          </div>
        </div>

      </div>
    `;

    skeleton.style.display = 'none';
    content.style.display  = '';

    /* ---- Event bindings ---- */
    const doLogout = async () => {
      await sb.auth.signOut();
      window.location.href = 'index.html';
    };
    document.getElementById('profLogout')?.addEventListener('click', doLogout);
    document.getElementById('btnLogout2')?.addEventListener('click', doLogout);

    /* Password form */
    const fPw = document.getElementById('fPassword');
    if (fPw) {
      fPw.onsubmit = async (e) => {
        e.preventDefault();
        const pwMsg  = document.getElementById('pwMsg');
        const newPw  = document.getElementById('pwNew')?.value;
        const confPw = document.getElementById('pwConf')?.value;

        const showPwMsg = (txt, err) => {
          if (!pwMsg) return;
          pwMsg.textContent = txt;
          pwMsg.className   = 'auth-msg ' + (err ? 'auth-msg--error' : 'auth-msg--success');
          pwMsg.style.display = '';
        };

        if (!newPw || !confPw) return showPwMsg('Completează ambele câmpuri.', true);
        if (newPw.length < 8)  return showPwMsg('Parola trebuie să aibă cel puțin 8 caractere.', true);
        if (newPw !== confPw)  return showPwMsg('Parolele nu coincid.', true);

        const btn = document.getElementById('btnPw');
        if (btn) { btn.disabled = true; btn.querySelector('span:first-child').style.opacity = '0'; btn.querySelector('.auth-spin').style.display = ''; }

        const { error } = await sb.auth.updateUser({ password: newPw });

        if (btn) { btn.disabled = false; btn.querySelector('span:first-child').style.opacity = ''; btn.querySelector('.auth-spin').style.display = 'none'; }

        if (error) return showPwMsg(_roError(error.message), true);
        showPwMsg('Parola a fost schimbată cu succes!', false);
        document.getElementById('pwNew').value  = '';
        document.getElementById('pwConf').value = '';
      };
    }

    /* Load exam count from localStorage */
    try {
      const histKey = 'bac_history';
      const hist = JSON.parse(localStorage.getItem(histKey) || '[]');
      const el = document.getElementById('profExamCount');
      if (el) el.textContent = hist.length || '0';
    } catch (_) {}

    /* Password toggle (shared with auth-page) */
    window.togglePw = function(btn) {
      const inp = document.getElementById(btn.dataset.target);
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? '👁' : '🙈';
    };
  }

  /* ---- INIT ---- */
  document.addEventListener('DOMContentLoaded', async () => {
    const auth = await _waitForAuth();
    if (!auth.user) {
      window.location.replace('auth.html?from=profile.html');
      return;
    }
    await renderProfile(auth.user, auth.supabase);
  });
})();
