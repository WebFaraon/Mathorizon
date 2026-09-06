/* ============================================================
   Mathorizon — Profile Page (profile.html)
   ============================================================ */

(function () {
  'use strict';

  const AVATAR_LS_KEY = 'prof_avatar_v1';
  const HIST_KEY      = 'bac-history';

  function _waitForAuth() {
    return new Promise(resolve => {
      if (window._bmAuthReady) return resolve(window.BMAuth);
      const timer = setTimeout(() => resolve(window.BMAuth), 6000);
      document.addEventListener('bmauth:ready', () => {
        clearTimeout(timer);
        resolve(window.BMAuth);
      }, { once: true });
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
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('prof-modal-overlay--in'));

    const close = () => {
      ov.classList.remove('prof-modal-overlay--in');
      setTimeout(() => { ov.remove(); document.documentElement.style.overflow = ''; document.body.style.overflow = ''; }, 180);
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

  /* ---- Edit profile modal (display name; avatar has its own hover-edit
     affordance on the header avatar already) ---- */
  function _showEditProfileModal({ name, sb, onSaved }) {
    const ov = document.createElement('div');
    ov.className = 'prof-modal-overlay';
    ov.innerHTML = `
      <div class="prof-modal" role="dialog" aria-modal="true">
        <h3 class="prof-modal__title">Editează profilul</h3>
        <form id="fEditProfile" novalidate style="text-align:left">
          <div id="editProfileMsg" class="auth-msg" style="display:none;margin-bottom:12px"></div>
          <div class="auth-field" style="margin-bottom:20px">
            <label class="auth-label" for="editName">Nume afișat</label>
            <div class="auth-input-wrap">
              <input class="auth-input" id="editName" type="text" maxlength="60" required value="${BM.esc(name)}">
            </div>
          </div>
          <p class="prof-hint-muted" style="margin-bottom:20px">Pentru a schimba poza de profil, treci cu mouse-ul peste avatar și apasă pe iconița de editare.</p>
          <div class="prof-modal__actions">
            <button type="button" class="btn btn--surface" data-action="cancel">Anulează</button>
            <button type="submit" class="btn btn--primary" id="btnSaveProfile">
              <span>Salvează</span><span class="auth-spin" style="display:none"></span>
            </button>
          </div>
        </form>
      </div>`;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('prof-modal-overlay--in'));

    const close = () => {
      ov.classList.remove('prof-modal-overlay--in');
      setTimeout(() => { ov.remove(); document.documentElement.style.overflow = ''; document.body.style.overflow = ''; }, 180);
    };

    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('[data-action="cancel"]').addEventListener('click', close);
    document.getElementById('editName')?.focus();

    function onEsc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } }
    document.addEventListener('keydown', onEsc);

    ov.querySelector('#fEditProfile').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = document.getElementById('editProfileMsg');
      const showMsg = (txt, err) => {
        if (!msg) return;
        msg.textContent = txt;
        msg.className = 'auth-msg ' + (err ? 'auth-msg--error' : 'auth-msg--success');
        msg.style.display = '';
      };
      const newName = document.getElementById('editName')?.value.trim();
      if (!newName) return showMsg('Numele nu poate fi gol.', true);

      const btn = document.getElementById('btnSaveProfile');
      if (btn) { btn.disabled = true; btn.querySelector('span:first-child').style.opacity = '0'; btn.querySelector('.auth-spin').style.display = ''; }

      const { error } = await sb.auth.updateUser({ data: { full_name: newName } });

      if (btn) { btn.disabled = false; btn.querySelector('span:first-child').style.opacity = ''; btn.querySelector('.auth-spin').style.display = 'none'; }

      if (error) return showMsg(_roError(error.message), true);
      onSaved(newName);
      close();
      BM.toast('Profilul a fost actualizat!', 'success');
    });
  }

  /* ---- Edit profile modal — teacher variant (name, bio, country, phone,
     social link; avatar/cover have their own hover-edit affordances) ---- */
  function _showEditTeacherProfileModal({ name, bio, country, phone, socialUrl, sb, onSaved }) {
    const ov = document.createElement('div');
    ov.className = 'prof-modal-overlay';
    ov.innerHTML = `
      <div class="prof-modal prof-modal--wide" role="dialog" aria-modal="true">
        <h3 class="prof-modal__title">Editează profilul</h3>
        <form id="fEditProfile" novalidate style="text-align:left">
          <div id="editProfileMsg" class="auth-msg" style="display:none;margin-bottom:12px"></div>
          <div class="auth-field" style="margin-bottom:16px">
            <label class="auth-label" for="editName">Nume afișat</label>
            <div class="auth-input-wrap">
              <input class="auth-input" id="editName" type="text" maxlength="60" required value="${BM.esc(name)}">
            </div>
          </div>
          <div class="auth-field" style="margin-bottom:16px">
            <label class="auth-label" for="editBio">Despre mine</label>
            <div class="auth-input-wrap">
              <textarea class="auth-input" id="editBio" rows="3" maxlength="280" placeholder="O scurtă descriere despre tine — experiență, stil de predare...">${BM.esc(bio)}</textarea>
            </div>
          </div>
          <div class="prof-pw-grid" style="margin-bottom:16px">
            <div class="auth-field">
              <label class="auth-label" for="editCountry">Țară</label>
              <div class="auth-input-wrap">
                <input class="auth-input" id="editCountry" type="text" maxlength="60" placeholder="România" value="${BM.esc(country)}">
              </div>
            </div>
            <div class="auth-field">
              <label class="auth-label" for="editPhone">Telefon</label>
              <div class="auth-input-wrap">
                <input class="auth-input" id="editPhone" type="tel" maxlength="30" placeholder="07xx xxx xxx" value="${BM.esc(phone)}">
              </div>
            </div>
          </div>
          <div class="auth-field" style="margin-bottom:20px">
            <label class="auth-label" for="editSocial">Rețea socială (link)</label>
            <div class="auth-input-wrap">
              <input class="auth-input" id="editSocial" type="url" maxlength="200" placeholder="https://..." value="${BM.esc(socialUrl)}">
            </div>
          </div>
          <p class="prof-hint-muted" style="margin-bottom:20px">Pentru a schimba poza de profil sau imaginea de copertă, treci cu mouse-ul peste ele și apasă pe iconița de editare.</p>
          <div class="prof-modal__actions">
            <button type="button" class="btn btn--surface" data-action="cancel">Anulează</button>
            <button type="submit" class="btn btn--primary" id="btnSaveProfile">
              <span>Salvează</span><span class="auth-spin" style="display:none"></span>
            </button>
          </div>
        </form>
      </div>`;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('prof-modal-overlay--in'));

    const close = () => {
      ov.classList.remove('prof-modal-overlay--in');
      setTimeout(() => { ov.remove(); document.documentElement.style.overflow = ''; document.body.style.overflow = ''; }, 180);
    };

    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('[data-action="cancel"]').addEventListener('click', close);
    document.getElementById('editName')?.focus();

    function onEsc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } }
    document.addEventListener('keydown', onEsc);

    ov.querySelector('#fEditProfile').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = document.getElementById('editProfileMsg');
      const showMsg = (txt, err) => {
        if (!msg) return;
        msg.textContent = txt;
        msg.className = 'auth-msg ' + (err ? 'auth-msg--error' : 'auth-msg--success');
        msg.style.display = '';
      };
      const newName    = document.getElementById('editName')?.value.trim();
      const newBio      = document.getElementById('editBio')?.value.trim() || '';
      const newCountry  = document.getElementById('editCountry')?.value.trim() || '';
      const newPhone    = document.getElementById('editPhone')?.value.trim() || '';
      const newSocial   = document.getElementById('editSocial')?.value.trim() || '';
      if (!newName) return showMsg('Numele nu poate fi gol.', true);
      if (newSocial && !/^https?:\/\//i.test(newSocial)) return showMsg('Link-ul trebuie să înceapă cu http:// sau https://.', true);

      const btn = document.getElementById('btnSaveProfile');
      if (btn) { btn.disabled = true; btn.querySelector('span:first-child').style.opacity = '0'; btn.querySelector('.auth-spin').style.display = ''; }

      const { data, error } = await sb.auth.updateUser({ data: {
        full_name: newName, bio: newBio, country: newCountry, phone: newPhone, social_url: newSocial
      } });

      if (btn) { btn.disabled = false; btn.querySelector('span:first-child').style.opacity = ''; btn.querySelector('.auth-spin').style.display = 'none'; }

      if (error) return showMsg(_roError(error.message), true);
      onSaved(data.user);
      close();
      BM.toast('Profilul a fost actualizat!', 'success');
    });
  }

  /* Compress image to data URL (default max 200px — avatar size; pass a
     larger maxDim for the wider cover-photo banner). JPEG 0.85. */
  function _compressImage(file, maxDim) {
    maxDim = maxDim || 200;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > h) { if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; } }
          else       { if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; } }
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

  /* ---- Star rating ---- */
  function _starsHTML(rating, size) {
    const filled = rating == null ? 0 : Math.round(rating);
    let out = '';
    for (let i = 1; i <= 5; i++) {
      out += `<span class="prof-star${i <= filled ? ' prof-star--filled' : ''}">${icon('star', { size })}</span>`;
    }
    return out;
  }

  /* Reviews are display-only for now (no submission flow yet — see the
     teacher_reviews migration comment), so this just reads whatever's
     there; an empty table renders the empty state further down. */
  async function _fetchTeacherReviews(sb, teacherId) {
    try {
      const { data, error } = await sb
        .from('teacher_reviews')
        .select('id, rating, comment, student_name, created_at')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const reviews = data || [];
      const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
      return { reviews, avg, count: reviews.length };
    } catch {
      return { reviews: [], avg: null, count: 0 };
    }
  }

  /* Convertește un data URL în Blob fără fetch() */
  function _dataUrlToBlob(dataUrl) {
    const [header, b64] = dataUrl.split(',');
    const mime   = (header.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const binary = atob(b64);
    const arr    = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /* ---- Render profile ---- */
  async function renderProfile(user, sb) {
    const content  = document.getElementById('profileContent');
    const skeleton = document.getElementById('profileSkeleton');
    if (!content || !skeleton) return;

    let name          = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Utilizator';
    const isUsernameAccount = user.user_metadata?.is_username_account === true;
    const email       = isUsernameAccount ? '' : (user.email || '');
    const avatarUrl   = user.user_metadata?.custom_avatar_url
        || user.user_metadata?.avatar_url
        || null;
    const memberSince = _formatDate(user.created_at);
    const tokens      = BM.getTokens();
    const verified    = !!user.email_confirmed_at;
    const isGoogle    = user.app_metadata?.provider === 'google';
    const hist        = _loadHistory();

    const role    = window.BMAuth?.role   || 'elev';
    const status  = window.BMAuth?.status || 'active';
    const isAdmin = role === 'admin';
    const isTeacher = role === 'profesor';
    const isStudent = role === 'elev';

    /* "Business card" fields — teacher-only for now, stored the same way
       as name/avatar (auth user_metadata) rather than a new table. */
    const bio       = user.user_metadata?.bio || '';
    const country   = user.user_metadata?.country || '';
    const socialUrl = user.user_metadata?.social_url || '';
    const phone     = user.user_metadata?.phone || '';
    const coverUrl  = user.user_metadata?.custom_cover_url || null;
    const socialDisplay = socialUrl ? socialUrl.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '') : '';
    const reviewsData = isTeacher ? await _fetchTeacherReviews(sb, user.id) : { reviews: [], avg: null, count: 0 };

    const parts    = name.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase() || '?';

    /* Token visual — up to 5 ticket emojis + "+N" badge, no empty slots */
    const MAX_SHOWN = 5;
    let tokenVisual;
    if (isAdmin) {
      tokenVisual = `<span title="Tokenuri nelimitate (cont admin)">${icon('ticket', { size: 24 })}</span>
                     <span style="font-size:0.82rem;color:var(--text-muted);margin-left:10px">Tokenuri nelimitate</span>`;
    } else if (tokens === 0) {
      tokenVisual = `<span style="opacity:0.25">${icon('ticket', { size: 24 })}</span>
                     <span style="font-size:0.82rem;color:var(--text-muted);margin-left:10px">Niciun token disponibil</span>`;
    } else {
      const shown = Math.min(tokens, MAX_SHOWN);
      const extra = tokens > MAX_SHOWN ? tokens - MAX_SHOWN : 0;
      tokenVisual = Array(shown).fill(null).map(() =>
        `<span style="filter:${tokens <= 1 ? 'grayscale(0.4) sepia(0.3)' : 'none'}"
               title="${tokens} token${tokens === 1 ? '' : 'uri'}">${icon('ticket', { size: 24 })}</span>`
      ).join('') + (extra ? `<span class="prof-token-extra">+${extra}</span>` : '');
    }

    /* Learning-progress data — same sources as Antrenament (js/training-stats.js)
       and Capitole/index (js/storage.js, js/data.js), just read here instead
       of duplicated. */
    const levelInfo    = window.BM?.Training?.getLevelInfo ? BM.Training.getLevelInfo() : { level: 1, xpIntoLevel: 0, xpForNextLevel: 100 };
    const totalXp      = window.BM?.Training?.getTotalXp ? BM.Training.getTotalXp() : 0;
    const bestStreak    = window.BM?.Training?.getBestStreak ? BM.Training.getBestStreak() : 0;
    const dailyStreak   = BM.Storage.getStreak().count;
    const exStats       = BM.Storage.getStats(BM.EXERCISES);

    /* BAC history rows */
    let histContent;
    if (!hist.length) {
      histContent = `
        <div class="prof-hist-empty">
          <span style="display:flex;justify-content:center">${icon('clipboard-list', { size: 32 })}</span>
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

    const pendingBanner = role === 'profesor' && status === 'pending' ? `
      <div class="prof-pending-banner">
        <span class="prof-pending-banner__icon">${icon('hourglass', { size: 24, className: 'icon--warning' })}</span>
        <div>
          <div class="prof-pending-banner__title">Cont de profesor în așteptare</div>
          <div class="prof-pending-banner__body">
            Cererea ta de înregistrare ca profesor a fost primită și urmează să fie analizată.
            Vei putea accesa funcționalitățile pentru profesori după ce adminul îți aprobă contul.
          </div>
        </div>
      </div>` : '';

    const rejectedBanner = role === 'profesor' && status === 'rejected' ? `
      <div class="prof-rejected-banner">
        <span class="prof-pending-banner__icon">${icon('circle-x', { size: 24, className: 'icon--error' })}</span>
        <div>
          <div class="prof-pending-banner__title">Cerere de profesor respinsă</div>
          <div class="prof-pending-banner__body">
            Cererea ta de cont de profesor a fost respinsă. Contactează adminul pentru mai multe detalii.
          </div>
        </div>
      </div>` : '';

    const badgesHTML = `
      ${role === 'admin'
        ? `<span class="prof-badge prof-badge--red">${icon('settings', { size: 16 })} Admin</span>`
        : role === 'profesor'
          ? (status === 'pending'
            ? `<span class="prof-badge prof-badge--amber">${icon('hourglass', { size: 16 })} Profesor (în așteptare)</span>`
            : status === 'rejected'
              ? `<span class="prof-badge prof-badge--red">${icon('circle-x', { size: 16 })} Profesor (respins)</span>`
              : `<span class="prof-badge prof-badge--purple">${icon('presentation', { size: 16 })} Profesor</span>`)
          : '<span class="prof-badge prof-badge--blue">Elev</span>'}
      ${role === 'profesor' && status === 'active'
        ? `<span class="prof-badge prof-badge--green">${icon('circle-check', { size: 16 })} Aprobat</span>` : ''}
      ${isUsernameAccount
        ? `<span class="prof-badge prof-badge--green">${icon('circle-check', { size: 16 })} Cont activ</span>`
        : (verified
          ? `<span class="prof-badge prof-badge--green">${icon('circle-check', { size: 16 })} Email verificat</span>`
          : '<span class="prof-badge prof-badge--yellow">Email neverificat</span>')}
      ${isGoogle ? `<span class="prof-badge prof-badge--blue">${icon('globe', { size: 16 })} Google</span>` : ''}
    `;

    /* Teacher gets a "public profile / business card" style header (cover
       photo, big avatar overlapping it, rating, contact row, bio) instead
       of the plain identity header — see the conversation this shipped in.
       Everyone else keeps the original simple header. */
    const teacherBizcardHTML = `
      <div class="prof-bizcard">
        <div class="prof-cover${coverUrl ? '' : ' prof-cover--placeholder'}"${coverUrl ? ` style="background-image:url('${coverUrl}')"` : ''}>
          <label class="prof-cover-edit" title="Schimbă imaginea de copertă">
            ${icon('camera', { size: 16 })}
            <input type="file" id="coverInput" accept="image/*" style="display:none">
          </label>
        </div>
        <div class="prof-bizcard-body">
          <div class="prof-bizcard-top">
            <div class="prof-avatar-wrap prof-avatar-wrap--cover">
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

            <div class="prof-bizcard-info">
              <div class="prof-bizcard-info__row1">
                <div>
                  <h1 class="prof-name">${BM.esc(name)}</h1>
                  <div class="prof-badges">${badgesHTML}</div>
                </div>
                <button class="btn btn--surface btn--sm prof-bizcard-editbtn" id="btnEditProfile">${icon('pencil', { size: 16 })} Editează profilul</button>
              </div>

              <div class="prof-rating-row">
                <span class="prof-stars">${_starsHTML(reviewsData.avg, 16)}</span>
                ${reviewsData.count
                  ? `<span class="prof-rating-num">${reviewsData.avg.toFixed(1)}</span><span class="prof-rating-count">(${reviewsData.count} recenzi${reviewsData.count === 1 ? 'e' : 'i'})</span>`
                  : `<span class="prof-rating-count">Nicio recenzie încă</span>`}
              </div>

              <div class="prof-contact-row">
                ${country ? `<span class="prof-contact-item">${icon('map-pin', { size: 16 })} ${BM.esc(country)}</span>` : ''}
                ${email ? `<span class="prof-contact-item">${icon('mail', { size: 16 })} ${BM.esc(email)}</span>` : ''}
                ${phone ? `<span class="prof-contact-item">${icon('phone', { size: 16 })} ${BM.esc(phone)}</span>` : ''}
                ${socialUrl ? `<a class="prof-contact-item prof-contact-item--link" href="${BM.esc(socialUrl)}" target="_blank" rel="noopener noreferrer">${icon('link', { size: 16 })} ${BM.esc(socialDisplay)}</a>` : ''}
                <span class="prof-contact-item">${icon('calendar', { size: 16 })} Membru din ${memberSince}</span>
              </div>
            </div>
          </div>

          <p class="prof-bio${bio ? '' : ' prof-bio--empty'}">${bio ? BM.esc(bio) : 'Adaugă o scurtă descriere despre tine din „Editează profilul”.'}</p>
        </div>
      </div>

      <div class="prof-card prof-card--wide prof-reviews-card">
        <div class="prof-card__head">
          <span class="prof-card__icon">${icon('star', { size: 16 })}</span>
          <span class="prof-card__title">Recenzii</span>
          ${reviewsData.count ? `<span class="prof-reviews-head-rating">${_starsHTML(reviewsData.avg, 16)} ${reviewsData.avg.toFixed(1)} · ${reviewsData.count} recenzi${reviewsData.count === 1 ? 'e' : 'i'}</span>` : ''}
        </div>
        <div class="prof-card__body">
          ${reviewsData.count ? reviewsData.reviews.map(r => `
            <div class="prof-review-item">
              <div class="prof-review-item__head">
                <span class="prof-review-item__name">${BM.esc(r.student_name || 'Elev')}</span>
                <span class="prof-review-item__stars">${_starsHTML(r.rating, 16)}</span>
              </div>
              ${r.comment ? `<p class="prof-review-item__comment">${BM.esc(r.comment)}</p>` : ''}
              <span class="prof-review-item__date">${_formatDate(r.created_at)}</span>
            </div>`).join('') : `
            <div class="prof-hist-empty">
              <span style="display:flex;justify-content:center">${icon('star', { size: 32 })}</span>
              <p>Niciun elev nu a lăsat încă o recenzie.</p>
            </div>`}
        </div>
      </div>

      <div class="prof-header prof-header--profile">
        <div class="prof-section">
          <div class="prof-section__title">${icon('lock', { size: 16 })} Schimbă parola</div>
          ${isGoogle
            ? '<p class="prof-hint-muted">Contul tău folosește autentificarea Google. Parola se gestionează din contul Google.</p>'
            : `<div id="pwMsg" class="auth-msg" style="display:none"></div>
               <form id="fPassword" novalidate>
                 <div class="prof-pw-grid">
                   <div class="auth-field">
                     <label class="auth-label" for="pwNew">Parolă nouă</label>
                     <div class="auth-input-wrap">
                       <input class="auth-input" id="pwNew" type="password" placeholder="Minim 8 caractere" autocomplete="new-password" required minlength="8">
                       <button type="button" class="auth-eye" data-target="pwNew" onclick="togglePw(this)">${icon('eye', { size: 16 })}</button>
                     </div>
                   </div>
                   <div class="auth-field">
                     <label class="auth-label" for="pwConf">Confirmă parola nouă</label>
                     <div class="auth-input-wrap">
                       <input class="auth-input" id="pwConf" type="password" placeholder="Repetă parola" autocomplete="new-password" required>
                       <button type="button" class="auth-eye" data-target="pwConf" onclick="togglePw(this)">${icon('eye', { size: 16 })}</button>
                     </div>
                   </div>
                 </div>
                 <button type="submit" class="btn btn--primary btn--sm" id="btnPw">
                   <span>Salvează parola</span><span class="auth-spin" style="display:none"></span>
                 </button>
               </form>`}
        </div>
        <div class="prof-divider"></div>
        <div class="prof-session-row">
          <span class="prof-session-strip__text">${icon('clock', { size: 16 })} Ultima autentificare: ${_formatDate(user.last_sign_in_at)}</span>
          <button class="btn btn--danger-outline btn--sm" id="btnLogout">
            ${icon('log-out', { size: 16 })}
            Deconectare
          </button>
        </div>
      </div>
    `;

    const defaultHeaderHTML = `
      <div class="prof-header">
        <div class="prof-identity-row">
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
          <div class="prof-badges">${badgesHTML}</div>
          <div class="prof-header-meta">
            <span class="prof-meta-item">${icon('calendar', { size: 16 })} Membru din ${memberSince}</span>
          </div>
          <div class="prof-header-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
            <button class="btn btn--surface btn--sm" id="btnEditProfile">${icon('pencil', { size: 16 })} Editează profilul</button>
            ${role === 'admin' ? `
            <a href="admin.html" class="btn btn--primary btn--sm" style="display:inline-flex;gap:8px;align-items:center">
              ${icon('settings', { size: 16 })} Panou Admin
            </a>` : ''}
          </div>
        </div>
        </div>
      </div>`;

    content.innerHTML = `
      ${pendingBanner}${rejectedBanner}
      <!-- PROFILE HEADER -->
      ${isTeacher ? teacherBizcardHTML : defaultHeaderHTML}

      <!-- CARDS GRID -->
      <div class="prof-grid">

        ${isStudent ? `
        <!-- Card: Progresul Meu -->
        <div class="prof-card prof-card--wide">
          <div class="prof-card__head">
            <span class="prof-card__icon">${icon('trending-up', { size: 16 })}</span>
            <span class="prof-card__title">Progresul Meu</span>
          </div>
          <div class="prof-card__body">
            <div class="prof-stats" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
              <div class="prof-stat">
                <div class="prof-stat__val">${levelInfo.level}</div>
                <div class="prof-stat__lbl">Nivel curent</div>
                <div class="prof-stat__sub">${levelInfo.xpIntoLevel} / ${levelInfo.xpForNextLevel} XP</div>
              </div>
              <div class="prof-stat">
                <div class="prof-stat__val">${totalXp}</div>
                <div class="prof-stat__lbl">XP Total</div>
              </div>
              <div class="prof-stat">
                <div class="prof-stat__val">${dailyStreak}</div>
                <div class="prof-stat__lbl">Streak curent</div>
                <div class="prof-stat__sub">zile la rând</div>
              </div>
              <div class="prof-stat">
                <div class="prof-stat__val">${bestStreak}</div>
                <div class="prof-stat__lbl">Cel mai bun streak</div>
                <div class="prof-stat__sub">Antrenament</div>
              </div>
              <div class="prof-stat">
                <div class="prof-stat__val">${exStats.solvedCount}</div>
                <div class="prof-stat__lbl">Exerciții rezolvate</div>
                <div class="prof-stat__sub">din ${exStats.total}</div>
              </div>
            </div>

            <div style="margin-top:22px">
              <div class="progress-track"><div class="progress-bar" style="width:${exStats.percent}%"></div></div>
              <div class="progress-label">
                <span>${exStats.solvedCount} / ${exStats.total} exerciții rezolvate</span>
                <span>${exStats.percent}%</span>
              </div>
            </div>

            <div style="margin-top:24px">
              <div class="prof-progress-subhead">Progres pe capitole</div>
              ${BM.CATEGORIES.map(cat => {
                const p = BM.Storage.getProgressForCategory(cat.id, BM.EXERCISES);
                return `
                <div class="prof-progress-chapter-row">
                  <span class="prof-progress-chapter-name">${BM.esc(cat.name)}</span>
                  <div class="progress-track" style="--card-color:${cat.color};margin:0;flex:1">
                    <div class="progress-bar" style="width:${p.percent}%"></div>
                  </div>
                  <span class="prof-progress-chapter-pct">${p.percent}%</span>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>` : ''}

        ${!isTeacher ? `
        <!-- Card: ExamTokenuri -->
        <div class="prof-card">
          <div class="prof-card__head">
            <span class="prof-card__icon">${icon('ticket', { size: 16 })}</span>
            <span class="prof-card__title">ExamTokenuri</span>
          </div>
          <div class="prof-card__body">
            <div class="prof-token-bar">${tokenVisual}</div>
            <div class="prof-token-main">
              <span class="prof-token-count ${!isAdmin && tokens === 0 ? 'prof-token-count--empty' : !isAdmin && tokens === 1 ? 'prof-token-count--low' : ''}">${isAdmin ? '∞' : tokens}</span>
              <div class="prof-token-info">
                <span class="prof-token-lbl">${isAdmin ? 'tokenuri nelimitate' : `token${tokens === 1 ? '' : 'uri'} disponibil${tokens === 1 ? '' : 'e'}`}</span>
                <span class="prof-token-hint">
                  ${isAdmin ? 'Cont admin — acces nelimitat la simulări BAC.' : tokens === 0 ? 'Ai epuizat toate tokenurile.' : tokens === 1 ? icon('triangle-alert', { size: 16, className: 'icon--warning' }) + ' Ultimul token rămas!' : `${tokens} simulări BAC disponibile`}
                </span>
              </div>
            </div>
            <a class="btn btn--primary btn--sm prof-token-btn" href="bac.html?new=1">
              Pornește simulare examen
            </a>
            ${!isAdmin ? `
            <a class="btn btn--surface btn--sm prof-token-btn" href="pachete.html#tokenuri" style="margin-top:8px">
              ${icon('ticket', { size: 16 })} Cumpără tokenuri
            </a>` : ''}
          </div>
        </div>` : ''}

        ${!isTeacher ? `
        <!-- Card: Schimbă parola -->
        <div class="prof-card">
          <div class="prof-card__head">
            <span class="prof-card__icon">${icon('lock', { size: 16 })}</span>
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
                       <button type="button" class="auth-eye" data-target="pwNew" onclick="togglePw(this)">${icon('eye', { size: 16 })}</button>
                     </div>
                   </div>
                   <div class="auth-field" style="margin-bottom:16px">
                     <label class="auth-label" for="pwConf">Confirmă parola nouă</label>
                     <div class="auth-input-wrap">
                       <input class="auth-input" id="pwConf" type="password" placeholder="Repetă parola" autocomplete="new-password" required>
                       <button type="button" class="auth-eye" data-target="pwConf" onclick="togglePw(this)">${icon('eye', { size: 16 })}</button>
                     </div>
                   </div>
                   <button type="submit" class="btn btn--primary btn--sm" id="btnPw">
                     <span>Salvează parola</span><span class="auth-spin" style="display:none"></span>
                   </button>
                 </form>`}
          </div>
        </div>` : ''}

      </div>

      ${!isTeacher ? `
      <!-- BAC HISTORY -->
      <div class="prof-hist-card">
        <div class="prof-card__head">
          <span class="prof-card__icon">${icon('clipboard-list', { size: 16 })}</span>
          <span class="prof-card__title">Simulări BAC anterioare</span>
          ${hist.length ? `<span class="bac-hist__toggle-count" style="margin-left:auto;margin-right:0">${hist.length}</span>` : ''}
        </div>
        <div id="profHistBody">${histContent}</div>
      </div>` : ''}

      ${!isTeacher ? `
      <!-- Sesiune (comprimat) -->
      <div class="prof-session-strip" style="margin-top:16px">
        <span class="prof-session-strip__text">${icon('clock', { size: 16 })} Ultima autentificare: ${_formatDate(user.last_sign_in_at)}</span>
        <button class="btn btn--danger-outline btn--sm" id="btnLogout">
          ${icon('log-out', { size: 16 })}
          Deconectare
        </button>
      </div>` : ''}
    `;

    skeleton.style.display = 'none';
    content.style.display  = '';

    /* ---- Event bindings ---- */
    const _doLogout = () => {
      _showConfirm({
        icon: icon('unlock', { size: 48 }),
        title: 'Deconectare',
        body: 'Ești sigur că vrei să te deconectezi din contul tău?',
        confirmLabel: 'Da, deconectează-mă',
        cancelLabel: 'Anulează',
        onConfirm: () => {
          /* signOut în background — nu așteptăm, redirectăm imediat */
          try { sb.auth.signOut(); } catch {}
          /* Curățăm manual toate cheile de sesiune Supabase */
          [localStorage, sessionStorage].forEach(store => {
            Object.keys(store).forEach(k => {
              if (k.startsWith('sb-') || k.startsWith('supabase')) store.removeItem(k);
            });
          });
          localStorage.setItem(BM.TOKEN_KEY, '0');
          localStorage.removeItem('bm_solved');
          localStorage.removeItem('bm_streak');
          window.location.replace('/');
        }
      });
    };
    document.getElementById('btnLogout')?.addEventListener('click', _doLogout);

    document.getElementById('btnClearHist')?.addEventListener('click', async () => {
      if (!confirm('Ștergi tot istoricul de simulări BAC?')) return;
      try {
        // Must finish before reload — the page re-syncs 'bac-history' from
        // the DB on load, so a not-yet-deleted row there would just get
        // pulled back into localStorage, undoing the clear.
        if (window.BMAuth?.clearBacHistory) await BMAuth.clearBacHistory();
        localStorage.removeItem(HIST_KEY);
        window.location.reload();
      } catch (e) {
        BM.toast('Ștergerea istoricului a eșuat. Încearcă din nou.', 'error');
      }
    });

    /* Avatar upload — Supabase Storage */
    document.getElementById('avatarInput')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const lbl = e.target.closest('label');
      if (lbl) lbl.style.opacity = '0.5';
      try {
        const dataUrl  = await _compressImage(file);
        const blob     = _dataUrlToBlob(dataUrl);
        const filePath = `${user.id}.jpg`;

        const { error: uploadErr } = await sb.storage
          .from('avatars')
          .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadErr) {
          const msg = uploadErr.message || '';
          if (msg.toLowerCase().includes('bucket')) {
            BM.toast('Bucket-ul "avatars" nu există în Supabase Storage. Creează-l din dashboard.', 'error');
          } else {
            BM.toast('Upload eșuat: ' + msg, 'error');
          }
          throw uploadErr;
        }

        // getPublicUrl() returns the same URL every time for this fixed
        // filePath (upsert overwrites it in place) — confirmed live: on a
        // second upload the toast said "updated" but the old image kept
        // showing, because the browser served its cached copy of that
        // unchanged URL. A cache-busting query param forces a fresh fetch,
        // both here and on the next page load (the busted URL is what
        // gets saved).
        const { data: { publicUrl: rawAvatarUrl } } = sb.storage.from('avatars').getPublicUrl(filePath);
        const publicUrl = `${rawAvatarUrl}?v=${Date.now()}`;

        const { error: updErr } = await sb.auth.updateUser({ data: { custom_avatar_url: publicUrl } });
        if (updErr) throw updErr;

        localStorage.removeItem(AVATAR_LS_KEY);

        const wrap = document.querySelector('.prof-avatar-lg');
        if (wrap) wrap.innerHTML = `<img src="${publicUrl}" alt="${BM.esc(name)}" class="prof-avatar-img">`;
        const navBtn = document.getElementById('navProfileBtn');
        if (navBtn) navBtn.innerHTML = `<img src="${publicUrl}" alt="${BM.esc(name)}" class="nav-profile-avatar">`;
        BM.toast('Poza de profil actualizată!', 'success');
      } catch (err) {
        BM.toast('Eroare: ' + (err?.message || 'necunoscută'), 'error');
      } finally {
        if (lbl) lbl.style.opacity = '';
      }
    });

    /* Cover photo upload — Supabase Storage, same "avatars" bucket as the
       profile picture, just a different file per user. */
    document.getElementById('coverInput')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const lbl = e.target.closest('label');
      if (lbl) lbl.style.opacity = '0.5';
      try {
        const dataUrl  = await _compressImage(file, 1200);
        const blob     = _dataUrlToBlob(dataUrl);
        const filePath = `${user.id}-cover.jpg`;

        const { error: uploadErr } = await sb.storage
          .from('avatars')
          .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadErr) {
          BM.toast('Upload eșuat: ' + (uploadErr.message || ''), 'error');
          throw uploadErr;
        }

        // Same cache-busting fix as the avatar upload above — this
        // filePath is fixed per user, so without a query param the
        // browser would keep showing the previously-cached image.
        const { data: { publicUrl: rawCoverUrl } } = sb.storage.from('avatars').getPublicUrl(filePath);
        const publicUrl = `${rawCoverUrl}?v=${Date.now()}`;

        const { error: updErr } = await sb.auth.updateUser({ data: { custom_cover_url: publicUrl } });
        if (updErr) throw updErr;

        const coverEl = document.querySelector('.prof-cover');
        if (coverEl) {
          coverEl.style.backgroundImage = `url('${publicUrl}')`;
          coverEl.classList.remove('prof-cover--placeholder');
        }
        BM.toast('Imaginea de copertă a fost actualizată!', 'success');
      } catch (err) {
        BM.toast('Eroare: ' + (err?.message || 'necunoscută'), 'error');
      } finally {
        if (lbl) lbl.style.opacity = '';
      }
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
      btn.innerHTML = icon(inp.type === 'password' ? 'eye' : 'eye-off', { size: 16 });
    };

    /* Edit profile — teacher gets the bigger "business card" modal (bio,
       country, phone, social link too); everyone else just edits the name. */
    document.getElementById('btnEditProfile')?.addEventListener('click', () => {
      if (isTeacher) {
        _showEditTeacherProfileModal({
          name, bio, country, phone, socialUrl, sb,
          onSaved: freshUser => renderProfile(freshUser, sb)
        });
        return;
      }
      _showEditProfileModal({
        name, sb,
        onSaved: newName => {
          name = newName;
          const nameParts = newName.split(/\s+/).filter(Boolean);
          const newInitials = nameParts.length >= 2
            ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
            : newName.slice(0, 2).toUpperCase() || '?';

          const nameEl = document.querySelector('.prof-name');
          if (nameEl) nameEl.textContent = newName;

          const initialsEl = document.querySelector('.prof-avatar-initials');
          if (initialsEl) initialsEl.textContent = newInitials;

          const navNameEl = document.querySelector('.nav-profile-name');
          if (navNameEl) navNameEl.textContent = newName;
          const navInitialsEl = document.querySelector('.nav-profile-initials');
          if (navInitialsEl) navInitialsEl.textContent = newInitials;

          const navBtn = document.getElementById('navProfileBtn');
          if (navBtn) navBtn.title = newName;
        }
      });
    });
  }

  /* ---- INIT ---- */
  document.addEventListener('DOMContentLoaded', async () => {
    const auth = await _waitForAuth();
    if (!auth.user) {
      window.location.replace('auth.html?from=profile.html');
      return;
    }
    await renderProfile(auth.user, auth.supabase);
    // role/status come from a separate, slower DB round-trip
    // (_syncUserProfile in auth.js) that's still pending at this point —
    // if it lands after this page already painted with the 'elev' fallback,
    // a profesor account would be stuck showing "Elev" forever. Re-render
    // once the real role arrives.
    document.addEventListener('bmauth:profile', () => renderProfile(auth.user, auth.supabase), { once: true });
  });
})();
