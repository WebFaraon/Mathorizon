/* ============================================================
   Mathorizon — Profile Page (profile.html)
   ============================================================ */

(function () {
  'use strict';

  const AVATAR_LS_KEY = 'prof_avatar_v1';
  const HIST_KEY      = 'bac-history';

  function _waitForAuth() {
    return new Promise(resolve => {
      if (window.BMAuth?.supabase) return resolve(window.BMAuth);
      document.addEventListener('bmauth:ready', () => resolve(window.BMAuth), { once: true });
    });
  }

  function _roError(msg) {
    if (!msg) return 'A apărut o eroare.';
    if (msg.includes('Password should be'))        return 'Parola trebuie să aibă cel puțin 6 caractere.';
    if (msg.includes('same_password'))             return 'Noua parolă trebuie să fie diferită de cea actuală.';
    if (msg.includes('Invalid login credentials')) return 'Parola curentă este incorectă.';
    if (msg.includes('rate limit'))                return 'Prea multe încercări. Încearcă mai târziu.';
    return msg;
  }

  function _formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  /* ---- Confirmation modal ---- */
  function _showConfirm({ icon, title, body, confirmLabel, cancelLabel, onConfirm }) {
    const ov = document.createElement('div');
    ov.className = 'prof-modal-overlay';
    ov.innerHTML = `
      <div class="prof-modal" role="dialog" aria-modal="true">
        <div class="prof-modal__icon">${icon}</div>
        <h3 class="prof-modal__title">${title}</h3>
        <p class="prof-modal__body">${body}</p>
        <div class="prof-modal__actions">
          <button class="btn btn--surface" data-action="cancel">${cancelLabel}</button>
          <button class="btn btn--danger"  data-action="confirm">${confirmLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('prof-modal-overlay--in'));

    const close = () => {
      ov.classList.remove('prof-modal-overlay--in');
      setTimeout(() => ov.remove(), 180);
    };

    ov.addEventListener('click', e => {
      if (e.target === ov) close();
    });
    ov.querySelector('[data-action="cancel"]').addEventListener('click', close);
    ov.querySelector('[data-action="confirm"]').addEventListener('click', async () => {
      ov.remove(); // remove immediately, don't wait for animation
      await onConfirm();
    });

    function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    }
    document.addEventListener('keydown', onEsc);
  }

  function _gradeColor(g) {
    if (g >= 9) return 'var(--green)';
    if (g >= 7) return 'var(--solved)';
    if (g >= 5) return 'var(--yellow)';
    return 'var(--red)';
  }

  function _loadHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
    catch { return []; }
  }

  /* Compress image to data URL (max 200px, JPEG 0.85) */
  function _compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const MAX = 200;
          let w = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
          else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---- Render profile ---- */
  async function renderProfile(user, sb) {
    const content  = document.getElementById('profileContent');
    const skeleton = document.getElementById('profileSkeleton');
    if (!content || !skeleton) return;

    const name        = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Utilizator';
    const email       = user.email || '';
    const googleAv    = user.user_metadata?.avatar_url || null;
    const localAv     = localStorage.getItem(AVATAR_LS_KEY);
    const avatarUrl   = localAv || googleAv;
    const memberSince = _formatDate(user.created_at);
    const tokens      = parseInt(localStorage.getItem('bac_exam_tokens') ?? '3', 10);
    const verified    = !!user.email_confirmed_at;
    const isGoogle    = user.app_metadata?.provider === 'google';
    const hist        = _loadHistory();

    const parts    = name.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase() || '?';

    /* Token dots visualization (max 10) */
    const MAX_DOTS = 10;
    let tokenDots = '';
    for (let i = 0; i < MAX_DOTS; i++) {
      if (i < tokens) {
        tokenDots += `<span class="prof-token-dot ${tokens <= 1 ? 'prof-token-dot--low' : 'prof-token-dot--filled'}"></span>`;
      } else {
        tokenDots += `<span class="prof-token-dot prof-token-dot--empty"></span>`;
      }
    }
    const tokenExtra = tokens > MAX_DOTS
      ? `<span class="prof-token-extra">+${tokens - MAX_DOTS}</span>` : '';

    /* BAC history rows */
    let histContent;
    if (!hist.length) {
      histContent = `
        <div class="prof-hist-empty">
          <span style="font-size:2rem">📋</span>
          <p>Nicio simulare finalizată încă.</p>
          <a class="btn btn--primary btn--sm" href="bac.html" style="margin-top:12px">Pornește prima simulare</a>
        </div>`;
    } else {
      const rows = hist.map(entry => {
        const d  = new Date(entry.ts).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
        const dH = Math.floor(entry.durationSec / 3600);
        const dM = Math.floor((entry.durationSec % 3600) / 60);
        return `<tr>
          <td>${d}</td>
          <td>${entry.earned}/${entry.maxPts}p</td>
          <td>${dH}h ${pad(dM)}m</td>
          <td><span class="prof-hist-grade" style="color:${_gradeColor(entry.grade)}">${entry.grade.toFixed(2)}</span></td>
        </tr>`;
      }).join('');
      histContent = `
        <table class="prof-hist-table">
          <thead><tr><th>Data</th><th>Puncte</th><th>Timp</th><th>Notă</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="prof-hist-footer">
          <button class="btn btn--sm btn--danger-outline" id="btnClearHist">Șterge tot istoricul</button>
        </div>`;
    }

    content.innerHTML = `
      <!-- PROFILE HEADER -->
      <div class="prof-header">
        <div class="prof-avatar-wrap">
          <div class="prof-avatar-lg">
            ${avatarUrl
              ? `<img src="${avatarUrl}" alt="${BM.esc(name)}" class="prof-avatar-img">`
              : `<span class="prof-avatar-initials">${BM.esc(initials)}</span>`}
          </div>
          <label class="prof-avatar-edit" title="Schimbă poza de profil">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <input type="file" id="avatarInput" accept="image/*" style="display:none">
          </label>
        </div>
        <div class="prof-header-info">
          <h1 class="prof-name">${BM.esc(name)}</h1>
          <p class="prof-email">${BM.esc(email)}</p>
          <div class="prof-badges">
            <span class="prof-badge prof-badge--blue">Elev</span>
            ${verified
              ? '<span class="prof-badge prof-badge--green">✓ Email verificat</span>'
              : '<span class="prof-badge prof-badge--yellow">Email neverificat</span>'}
            ${isGoogle ? '<span class="prof-badge prof-badge--blue">🌐 Google</span>' : ''}
          </div>
          <div class="prof-header-meta">
            <span class="prof-meta-item">📅 Membru din ${memberSince}</span>
            <span class="prof-meta-sep">·</span>
            <span class="prof-meta-item">🎟 ${tokens} token${tokens === 1 ? '' : 'uri'} disponibil${tokens === 1 ? '' : 'e'}</span>
            <span class="prof-meta-sep">·</span>
            <span class="prof-meta-item">📋 ${hist.length} simulăr${hist.length === 1 ? 'e' : 'i'} BAC</span>
          </div>
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
              <span class="prof-field-val">${isGoogle ? '🌐 Google' : '📧 Email / Parolă'}</span>
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
            <div class="prof-token-bar">${tokenDots}${tokenExtra}</div>
            <div class="prof-token-main">
              <span class="prof-token-count ${tokens === 0 ? 'prof-token-count--empty' : tokens === 1 ? 'prof-token-count--low' : ''}">${tokens}</span>
              <div class="prof-token-info">
                <span class="prof-token-lbl">token${tokens === 1 ? '' : 'uri'} disponibil${tokens === 1 ? '' : 'e'}</span>
                <span class="prof-token-hint">
                  ${tokens === 0 ? 'Ai epuizat toate tokenurile.' : tokens === 1 ? '⚠ Ultimul token rămas!' : `${tokens} simulări BAC disponibile`}
                </span>
              </div>
            </div>
            <a class="btn btn--primary btn--sm prof-token-btn" href="bac.html?new=1">
              Pornește simulare BAC
            </a>
          </div>
        </div>

        <!-- Card: Schimbă parola -->
        <div class="prof-card">
          <div class="prof-card__head">
            <span class="prof-card__icon">🔐</span>
            <span class="prof-card__title">Schimbă parola</span>
          </div>
          <div class="prof-card__body">
            ${isGoogle
              ? '<p class="prof-hint-muted">Contul tău folosește autentificarea Google. Parola se gestionează din contul Google.</p>'
              : `<div id="pwMsg" class="auth-msg" style="display:none"></div>
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
            <button class="btn btn--danger-outline btn--sm" id="btnLogout" style="margin-top:16px;width:100%">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Deconectare
            </button>
          </div>
        </div>

      </div>

      <!-- BAC HISTORY -->
      <div class="prof-hist-card">
        <div class="prof-card__head">
          <span class="prof-card__icon">📋</span>
          <span class="prof-card__title">Simulări BAC anterioare</span>
          ${hist.length ? `<span class="bac-hist__toggle-count" style="margin-left:auto;margin-right:0">${hist.length}</span>` : ''}
        </div>
        <div id="profHistBody">${histContent}</div>
      </div>
    `;

    skeleton.style.display = 'none';
    content.style.display  = '';

    /* ---- Event bindings ---- */
    const _doLogout = () => {
      _showConfirm({
        icon: '🔓',
        title: 'Deconectare',
        body: 'Ești sigur că vrei să te deconectezi din contul tău?',
        confirmLabel: 'Da, deconectează-mă',
        cancelLabel: 'Anulează',
        onConfirm: async () => {
          /* 1. Graceful signout via Supabase SDK */
          try {
            const client = window.BMAuth?.supabase || sb;
            if (client) await client.auth.signOut({ scope: 'local' });
          } catch (e) { console.warn('[Profile] signOut SDK error:', e); }

          /* 2. Belt-and-suspenders: clear Supabase session from localStorage */
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith('sb-') || k.includes('supabase')) localStorage.removeItem(k);
          });
          localStorage.setItem(BM.TOKEN_KEY, '0');

          /* 3. Navigate away */
          window.location.replace('index.html');
        }
      });
    };
    document.getElementById('btnLogout')?.addEventListener('click', _doLogout);

    document.getElementById('btnClearHist')?.addEventListener('click', () => {
      if (!confirm('Ștergi tot istoricul de simulări BAC?')) return;
      localStorage.removeItem(HIST_KEY);
      window.location.reload();
    });

    /* Avatar upload */
    document.getElementById('avatarInput')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await _compressImage(file);
        localStorage.setItem(AVATAR_LS_KEY, dataUrl);
        const wrap = document.querySelector('.prof-avatar-lg');
        if (wrap) wrap.innerHTML = `<img src="${dataUrl}" alt="${BM.esc(name)}" class="prof-avatar-img">`;
        const navBtn = document.getElementById('navProfileBtn');
        if (navBtn) navBtn.innerHTML = `<img src="${dataUrl}" alt="${BM.esc(name)}" class="nav-profile-avatar">`;
        BM.toast('Poza de profil actualizată!', 'success');
      } catch { BM.toast('Nu am putut procesa imaginea.', 'error'); }
    });

    /* Password form */
    const fPw = document.getElementById('fPassword');
    if (fPw) {
      fPw.onsubmit = async e => {
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
