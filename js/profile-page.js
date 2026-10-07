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

  /* ---- Countries ----
     A fixed ISO 3166-1 list (no free text), named in Romanian by the
     browser's own Intl.DisplayNames, flags as SVGs from the flag-icons
     package (emoji flags don't render on Windows). The profile keeps
     saving the country's name in user_metadata.country (class-page.js
     shows it as text) and adds country_code for the flag. */
  const COUNTRY_CODES = ('AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ '
    + 'CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '
    + 'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP '
    + 'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR '
    + 'MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE '
    + 'RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV '
    + 'TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' ');
  const PINNED_COUNTRIES = ['MD', 'RO'];
  const FLAG_BASE = 'https://cdn.jsdelivr.net/npm/flag-icons@7.5.0/flags/4x3/';
  const _regionNames = (() => {
    try { return new Intl.DisplayNames(['ro'], { type: 'region' }); } catch { return null; }
  })();
  function _countryName(code) {
    const n = code && _regionNames ? _regionNames.of(code) : '';
    return n && n !== code ? n : code;
  }
  const COUNTRIES = COUNTRY_CODES
    .map(code => ({ code, name: _countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const _fold = str => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  /* Short forms people typed by hand before the dropdown existed. */
  const COUNTRY_ALIASES = {
    'moldova': 'MD', 'r. moldova': 'MD', 'rep. moldova': 'MD', 'republica moldova': 'MD', 'rm': 'MD',
    'romania': 'RO', 'ro': 'RO', 'usa': 'US', 'sua': 'US', 'statele unite': 'US',
    'uk': 'GB', 'anglia': 'GB', 'marea britanie': 'GB', 'germania': 'DE', 'italia': 'IT', 'ucraina': 'UA'
  };

  /* Code for a profile: the saved code, or (older profiles, typed by hand)
     the country whose Romanian name, or a common short form, matches. */
  function _countryCodeFor(meta) {
    if (meta?.country_code) return meta.country_code;
    const typed = _fold(meta?.country).trim();
    if (!typed) return '';
    if (COUNTRY_ALIASES[typed]) return COUNTRY_ALIASES[typed];
    const hit = COUNTRIES.find(c => _fold(c.name) === typed);
    return hit ? hit.code : '';
  }
  function _flagImg(code) {
    return code
      ? `<img class="pf-flag" src="${FLAG_BASE}${code.toLowerCase()}.svg" alt="" width="20" height="15" loading="lazy">`
      : '';
  }

  /* Searchable country dropdown: a trigger that opens a list with a search
     box, pinned Moldova / România first, full keyboard support. Returns a
     getter for the chosen code ('' = none). */
  function _mountCountryPicker(root, initialCode) {
    let code = initialCode || '';
    let active = -1;
    let shown = [];
    const trigger = root.querySelector('.pf-country__trigger');
    const valueEl = root.querySelector('.pf-country__value');
    const pop     = root.querySelector('.pf-country__pop');
    const search  = root.querySelector('.pf-country__search');
    const list    = root.querySelector('.pf-country__list');

    const paintValue = () => {
      valueEl.innerHTML = code
        ? `${_flagImg(code)}<span>${BM.esc(_countryName(code))}</span>`
        : '<span class="pf-country__ph">Alege țara</span>';
    };
    const option = (c, i) => `
      <li role="option" id="pfc-${c.code || 'none'}" class="pf-country__opt${c.sep ? ' pf-country__opt--sep' : ''}${c.code === code ? ' is-selected' : ''}${i === active ? ' is-active' : ''}"
          data-code="${c.code}" aria-selected="${c.code === code}">
        ${c.code ? _flagImg(c.code) : '<span class="pf-flag pf-flag--none"></span>'}
        <span>${BM.esc(c.name)}</span>
      </li>`;
    const paintList = () => {
      const q = _fold(search.value).trim();
      const none = { code: '', name: 'Nicio țară' };
      if (q) {
        shown = COUNTRIES.filter(c => _fold(c.name).includes(q) || c.code.toLowerCase() === q);
      } else {
        const pinned = PINNED_COUNTRIES.map(k => COUNTRIES.find(c => c.code === k)).filter(Boolean);
        // A rule under the pinned block separates it from the full list.
        if (pinned.length) pinned[pinned.length - 1] = { ...pinned[pinned.length - 1], sep: true };
        shown = [none, ...pinned, ...COUNTRIES.filter(c => !PINNED_COUNTRIES.includes(c.code))];
      }
      if (active >= shown.length) active = shown.length - 1;
      list.innerHTML = shown.length
        ? shown.map((c, i) => option(c, i)).join('')
        : '<li class="pf-country__empty">Nicio țară găsită.</li>';
      const cur = list.querySelector('.is-active');
      if (cur) {
        cur.scrollIntoView({ block: 'nearest' });
        search.setAttribute('aria-activedescendant', cur.id);
      }
    };
    const open = () => {
      pop.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      search.value = '';
      active = Math.max(0, shownIndexOf(code));
      paintList();
      search.focus();
    };
    const close = (refocus) => {
      pop.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (refocus) trigger.focus();
    };
    const shownIndexOf = c => {
      search.value = '';
      paintList();
      return shown.findIndex(x => x.code === c);
    };
    const pick = c => { code = c; paintValue(); close(true); };

    trigger.addEventListener('click', () => (pop.hidden ? open() : close(true)));
    search.addEventListener('input', () => { active = 0; paintList(); });
    search.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); paintList(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paintList(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) pick(shown[active].code); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    });
    list.addEventListener('mousedown', e => e.preventDefault());
    list.addEventListener('click', e => {
      const li = e.target.closest('.pf-country__opt');
      if (li) pick(li.dataset.code);
    });
    document.addEventListener('mousedown', e => { if (!pop.hidden && !root.contains(e.target)) close(false); });

    paintValue();
    return () => code;
  }

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

  /* ---- Edit profile modal — "business card" variant (name, bio, country,
     phone, social link; avatar/cover have their own hover-edit affordances).
     Used by every role now — this used to be teacher-only, back when only
     the teacher header displayed these fields. */
  function _showEditBizcardProfileModal({ name, bio, countryCode, phone, socialUrl, isTeacher, sb, onSaved }) {
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
              <textarea class="auth-input" id="editBio" rows="3" maxlength="280" placeholder="${isTeacher ? 'O scurtă descriere despre tine — experiență, stil de predare...' : 'O scurtă descriere despre tine...'}">${BM.esc(bio)}</textarea>
            </div>
          </div>
          <div class="prof-pw-grid" style="margin-bottom:16px">
            <div class="auth-field">
              <span class="auth-label" id="editCountryLbl">Țară</span>
              <div class="pf-country" id="editCountry">
                <button type="button" class="pf-country__trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="editCountryLbl">
                  <span class="pf-country__value"></span>
                  ${icon('chevron-down', { size: 16 })}
                </button>
                <div class="pf-country__pop" hidden>
                  <input class="pf-country__search" type="text" placeholder="Caută țara" aria-label="Caută țara"
                         role="combobox" aria-controls="editCountryList" aria-expanded="true" autocomplete="off">
                  <ul class="pf-country__list" id="editCountryList" role="listbox" aria-labelledby="editCountryLbl"></ul>
                </div>
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
          <p class="prof-hint-muted" style="margin-bottom:20px">Poza de profil și coperta se schimbă din butoanele cu aparat foto de pe profil.</p>
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
    const getCountryCode = _mountCountryPicker(ov.querySelector('#editCountry'), countryCode);
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
      const newCountryCode = getCountryCode();
      const newCountry  = newCountryCode ? _countryName(newCountryCode) : '';
      const newPhone    = document.getElementById('editPhone')?.value.trim() || '';
      const newSocial   = document.getElementById('editSocial')?.value.trim() || '';
      if (!newName) return showMsg('Numele nu poate fi gol.', true);
      if (newSocial && !/^https?:\/\//i.test(newSocial)) return showMsg('Link-ul trebuie să înceapă cu http:// sau https://.', true);

      const btn = document.getElementById('btnSaveProfile');
      if (btn) { btn.disabled = true; btn.querySelector('span:first-child').style.opacity = '0'; btn.querySelector('.auth-spin').style.display = ''; }

      const { data, error } = await sb.auth.updateUser({ data: {
        full_name: newName, bio: newBio, country: newCountry, country_code: newCountryCode, phone: newPhone, social_url: newSocial
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

  /* A teacher's own classes with their student counts — the same
     classes / class_members tables classes.html reads (teacher_id on
     classes, one class_members row per enrolled student). */
  async function _fetchTeacherClasses(sb, teacherId) {
    try {
      const { data: classes, error } = await sb
        .from('classes')
        .select('id, name')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!classes?.length) return [];
      const { data: members } = await sb
        .from('class_members')
        .select('class_id')
        .in('class_id', classes.map(c => c.id));
      const counts = {};
      (members || []).forEach(m => { counts[m.class_id] = (counts[m.class_id] || 0) + 1; });
      return classes.map(c => ({ ...c, students: counts[c.id] || 0 }));
    } catch {
      return [];
    }
  }

  /* One orchestrated entrance, with Motion (loaded as an ES module by
     profile.html into window.BMMotion): the plate settles, its spec cells
     count in, the display fields refresh one by one, the tickets are dealt,
     and the BAC tape prints line by line once it scrolls into view. The
     page is fully visible without it (no-JS, reduced motion, CDN down). */
  function _animateProfile(root) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const run = M => {
      const { stagger, inView } = M;
      const ease = [0.16, 1, 0.3, 1];
      const $ = sel => root.querySelectorAll(sel);
      // Motion throws on an empty selection, and not every role renders
      // every piece (no tickets for a teacher, no display for an admin).
      const animate = (els, keyframes, options) => els.length && M.animate(els, keyframes, options);
      animate($('.pf-plate'), { opacity: [0, 1], y: [14, 0] }, { duration: 0.5, ease });
      animate($('.pf-spec__cell'), { opacity: [0, 1], y: [6, 0] }, { duration: 0.35, ease, delay: stagger(0.045, { startDelay: 0.18 }) });
      animate($('.pf-card, .pf-section'), { opacity: [0, 1], y: [12, 0] }, { duration: 0.45, ease, delay: stagger(0.08, { startDelay: 0.22 }) });
      animate($('.pf-lcd__val'), { opacity: [0.1, 1] }, { duration: 0.18, ease: 'linear', delay: stagger(0.1, { startDelay: 0.45 }) });
      animate($('.pf-lcd__bar i'), { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] }, { duration: 0.8, ease, delay: 0.6 });
      animate($('.pf-ticket, .pf-ticket-more'), { opacity: [0, 1], y: [-12, 0], rotate: [-8, 0] }, { duration: 0.4, ease, delay: stagger(0.07, { startDelay: 0.4 }) });
      const tape = root.querySelector('.pf-tape__paper');
      if (tape) {
        inView(tape, () => {
          animate(tape.querySelectorAll('.pf-tape__line'),
            { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], y: [-4, 0] },
            { duration: 0.16, ease: 'linear', delay: stagger(0.045) });
        }, { amount: 0.2 });
      }
    };
    if (window.BMMotion) return run(window.BMMotion);
    // Motion still loading: animate only if it lands right away. Later than
    // that the page has already been seen, and replaying its entrance
    // would read as a glitch.
    const shownAt = performance.now();
    document.addEventListener('bm:motion', () => {
      if (performance.now() - shownAt < 600) run(window.BMMotion);
    }, { once: true });
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
    const isGoogle    = user.app_metadata?.provider === 'google';
    const hist        = _loadHistory();

    const role    = window.BMAuth?.role   || 'elev';
    const status  = window.BMAuth?.status || 'active';
    const isAdmin = role === 'admin';
    const isTeacher = role === 'profesor';

    /* "Business card" fields — stored the same way as name/avatar (auth
       user_metadata) rather than a new table. Every role has these now;
       only the rating (reviewsData below) stays teacher-specific. */
    const bio       = user.user_metadata?.bio || '';
    const countryCode = _countryCodeFor(user.user_metadata);
    const country   = countryCode ? _countryName(countryCode) : (user.user_metadata?.country || '');
    const socialUrl = user.user_metadata?.social_url || '';
    const phone     = user.user_metadata?.phone || '';
    const coverUrl  = user.user_metadata?.custom_cover_url || null;
    const socialDisplay = socialUrl ? socialUrl.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '') : '';
    const reviewsData = isTeacher ? await _fetchTeacherReviews(sb, user.id) : { reviews: [], avg: null, count: 0 };

    const parts    = name.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase() || '?';

    /* ---- Figures, all from the same sources the rest of the site reads.
       The custom-exercise merge has to land first, or the bank total is
       short by every exercise that only exists in the database. ---- */
    await (BM.customExercisesReady ? BM.customExercisesReady() : Promise.resolve());
    const stats    = BM.Storage.getStats(BM.EXERCISES || []);
    const totalXp  = BM.Training?.getTotalXp?.() ?? 0;
    const perLevel = BM.Training?.XP_PER_LEVEL ?? 100;
    const level    = Math.floor(totalXp / perLevel) + 1;
    const xpInto   = totalXp % perLevel;
    const streak   = BM.Storage.getStreak?.().count || 0;
    const grades   = hist.map(h => Number(h.grade)).filter(g => !Number.isNaN(g));
    const bestGrade = grades.length ? Math.max(...grades) : null;
    const avgGrade  = grades.length ? grades.reduce((sum, g) => sum + g, 0) / grades.length : null;
    const isActiveTeacher = isTeacher && status === 'active';
    const teacherClasses  = isActiveTeacher ? await _fetchTeacherClasses(sb, user.id) : [];

    /* ---- Identity plate ---- */
    const roleLine = isAdmin
      ? { text: 'Administrator', led: '' }
      : isTeacher
        ? (status === 'pending'  ? { text: 'Profesor, în așteptarea aprobării', led: 'amber' }
          : status === 'rejected' ? { text: 'Profesor, cerere respinsă', led: 'red' }
          : { text: 'Profesor aprobat', led: 'green' })
        : { text: 'Elev', led: '' };

    const specCells = [
      country   && ['Țară', `<span class="pf-country-val">${_flagImg(countryCode)}${BM.esc(country)}</span>`],
      email     && ['E-mail', BM.esc(email), true],
      phone     && ['Telefon', BM.esc(phone)],
      socialUrl && ['Link', `<a href="${BM.esc(socialUrl)}" target="_blank" rel="noopener noreferrer">${BM.esc(socialDisplay)}</a>`, true],
      isTeacher && ['Rating', reviewsData.count
        ? `${reviewsData.avg.toFixed(1)} din 5, ${reviewsData.count} recenzi${reviewsData.count === 1 ? 'e' : 'i'}`
        : 'Fără recenzii încă'],
      ['Membru din', memberSince],
      ['Autentificare', isGoogle ? 'Cont Google' : 'E-mail și parolă']
    ].filter(Boolean);

    const plateHTML = `
      <section class="pf-plate" aria-label="Profil">
        <div class="prof-cover pf-cover${coverUrl ? '' : ' prof-cover--placeholder'}"${coverUrl ? ` style="background-image:url('${coverUrl}')"` : ''}>
          <label class="pf-cover-edit" title="Schimbă imaginea de copertă">
            ${icon('camera', { size: 16 })}<span>Copertă</span>
            <input type="file" id="coverInput" accept="image/*" hidden>
          </label>
        </div>
        <div class="pf-id">
          <div class="pf-avatar">
            <div class="prof-avatar-lg">
              ${avatarUrl
                ? `<img src="${avatarUrl}" alt="${BM.esc(name)}" class="prof-avatar-img">`
                : `<span class="prof-avatar-initials">${BM.esc(initials)}</span>`}
            </div>
            <label class="pf-avatar-edit" title="Schimbă poza de profil">
              ${icon('camera', { size: 16 })}
              <input type="file" id="avatarInput" accept="image/*" hidden>
            </label>
          </div>
          <div class="pf-id__main">
            <h1 class="pf-name">${BM.esc(name)}</h1>
            <p class="pf-role">${roleLine.led ? `<span class="pf-led pf-led--${roleLine.led}" aria-hidden="true"></span>` : ''}${roleLine.text}</p>
          </div>
          <div class="pf-id__actions">
            ${isAdmin ? `<a href="admin.html" class="pf-key pf-key--primary">${icon('settings', { size: 16 })} Panou admin</a>` : ''}
            <!-- Registru: legătura e oprită până se decide registrul (registru.html există în continuare) -->
            <button class="pf-key" id="btnEditProfile">${icon('pencil', { size: 16 })} Editează profilul</button>
          </div>
        </div>
        <dl class="pf-spec">
          ${specCells.map(([label, value, wide]) => `<div class="pf-spec__cell${wide ? ' pf-spec__cell--wide' : ''}"><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
        </dl>
        <p class="pf-bio${bio ? '' : ' pf-bio--empty'}">${bio ? BM.esc(bio) : 'Adaugă o scurtă descriere despre tine din „Editează profilul”.'}</p>
      </section>`;

    const noticeHTML = isTeacher && status === 'pending' ? `
      <div class="pf-notice pf-notice--amber" role="status">
        <span class="pf-led pf-led--amber" aria-hidden="true"></span>
        <div>
          <strong>Cont de profesor în așteptare</strong>
          <p>Cererea ta de înregistrare ca profesor a fost primită și urmează să fie analizată. Vei putea accesa funcționalitățile pentru profesori după ce adminul îți aprobă contul.</p>
        </div>
      </div>` : isTeacher && status === 'rejected' ? `
      <div class="pf-notice pf-notice--red" role="status">
        <span class="pf-led pf-led--red" aria-hidden="true"></span>
        <div>
          <strong>Cerere de profesor respinsă</strong>
          <p>Cererea ta de cont de profesor a fost respinsă. Contactează adminul pentru mai multe detalii.</p>
        </div>
      </div>` : '';

    /* ---- Student progress: one display, four fields ---- */
    const progressHTML = `
      <section class="pf-section">
        <h2 class="pf-h">Progresul tău</h2>
        <div class="pf-lcd">
          <div class="pf-lcd__cell pf-lcd__cell--wide">
            <span class="pf-lcd__lbl">Exerciții rezolvate</span>
            <span class="pf-lcd__val">${stats.solvedCount}<small>/${stats.total}</small></span>
            <span class="pf-lcd__bar" aria-hidden="true"><i style="width:${stats.percent}%"></i></span>
            <span class="pf-lcd__sub">${stats.percent}% din bancă</span>
          </div>
          <div class="pf-lcd__cell">
            <span class="pf-lcd__lbl">Nivel</span>
            <span class="pf-lcd__val">${level}</span>
            <span class="pf-lcd__sub">${xpInto}/${perLevel} XP</span>
          </div>
          <div class="pf-lcd__cell">
            <span class="pf-lcd__lbl">Zile la rând</span>
            <span class="pf-lcd__val">${streak}</span>
            <span class="pf-lcd__sub">${totalXp} XP total</span>
          </div>
          <div class="pf-lcd__cell">
            <span class="pf-lcd__lbl">Cea mai bună notă</span>
            <span class="pf-lcd__val">${bestGrade != null ? bestGrade.toFixed(2) : '0.00'}</span>
            <span class="pf-lcd__sub">${hist.length} simulăr${hist.length === 1 ? 'e' : 'i'}</span>
          </div>
        </div>
      </section>`;

    /* ---- BAC history as a printing calculator's paper tape. Grades under
       5 print in red, the way these printers print negative numbers. ---- */
    const tapeRows = hist.map(entry => {
      const when = new Date(entry.ts);
      const d  = when.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const t  = when.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
      const dH = Math.floor(entry.durationSec / 3600);
      const dM = Math.floor((entry.durationSec % 3600) / 60);
      const g  = Number(entry.grade);
      return `
        <div class="pf-tape__entry">
          <div class="pf-tape__line pf-tape__line--meta"><span>${d}</span><span>${t}</span></div>
          <div class="pf-tape__line"><span>Puncte</span><span>${entry.earned}/${entry.maxPts}</span></div>
          <div class="pf-tape__line"><span>Timp</span><span>${dH}h ${pad(dM)}m</span></div>
          <div class="pf-tape__line pf-tape__line--grade${g < 5 ? ' pf-tape__line--neg' : ''}"><span>Notă</span><span>${g.toFixed(2)}</span></div>
        </div>`;
    }).join('');

    const tapeHTML = `
      <section class="pf-section" id="simulari-bac">
        <div class="pf-h-row">
          <h2 class="pf-h">Simulări BAC</h2>
          ${hist.length ? '<button class="pf-key pf-key--sm" id="btnClearHist">Șterge istoricul</button>' : ''}
        </div>
        ${hist.length ? `
        <div class="pf-tape">
          <div class="pf-tape__paper">
            <div class="pf-tape__line pf-tape__line--head"><span>Simulări finalizate</span><span>${hist.length}</span></div>
            ${tapeRows}
            <div class="pf-tape__line pf-tape__line--total"><span>Media notelor</span><span>${avgGrade.toFixed(2)}</span></div>
          </div>
        </div>` : `
        <div class="pf-empty">
          <p>Nicio simulare finalizată încă. Prima ta simulare apare aici, tipărită, imediat ce o termini.</p>
          <a class="pf-key pf-key--primary" href="bac.html?new=1">Pornește prima simulare</a>
        </div>`}
      </section>`;

    /* ---- Exam tokens as tickets ---- */
    const MAX_TICKETS = 5;
    const ticketsHTML = isAdmin
      ? '<span class="pf-ticket pf-ticket--wide"><b>∞</b></span>'
      : tokens === 0
        ? '<span class="pf-ticket pf-ticket--none"></span>'
        : Array.from({ length: Math.min(tokens, MAX_TICKETS) }, () => '<span class="pf-ticket"></span>').join('')
          + (tokens > MAX_TICKETS ? `<span class="pf-ticket-more">+${tokens - MAX_TICKETS}</span>` : '');
    const tokenNote = isAdmin
      ? 'Cont admin: simulări BAC nelimitate.'
      : tokens === 0 ? 'Nu mai ai tokenuri. O simulare BAC costă un token.'
      : tokens === 1 ? 'Ultimul token: încă o simulare BAC.'
      : `Ajung pentru ${tokens} simulări BAC.`;

    const tokensHTML = `
      <section class="pf-card">
        <div class="pf-h-row">
          <h2 class="pf-h">ExamTokenuri</h2>
          <span class="pf-counter${!isAdmin && tokens <= 1 ? ' pf-counter--low' : ''}">${isAdmin ? '∞' : tokens}</span>
        </div>
        <div class="pf-tickets" aria-hidden="true">${ticketsHTML}</div>
        <p class="pf-note">${tokenNote}</p>
        <a class="pf-key pf-key--primary pf-key--block" href="bac.html?new=1">Pornește o simulare</a>
        ${!isAdmin ? `<a class="pf-key pf-key--block" href="pachete.html#tokenuri">${icon('ticket', { size: 16 })} Cumpără tokenuri</a>` : ''}
      </section>`;

    /* ---- Teacher: one activity display, then reviews | classes | account */
    const totalStudents = teacherClasses.reduce((sum, c) => sum + c.students, 0);
    const lastReview = reviewsData.count ? reviewsData.reviews[0] : null;
    const teacherStatsHTML = `
      <section class="pf-section">
        <h2 class="pf-h">Activitatea ta</h2>
        <div class="pf-lcd pf-lcd--even">
          <div class="pf-lcd__cell">
            <span class="pf-lcd__lbl">Clase</span>
            <span class="pf-lcd__val">${teacherClasses.length}</span>
            <span class="pf-lcd__sub">create de tine</span>
          </div>
          <div class="pf-lcd__cell">
            <span class="pf-lcd__lbl">Elevi</span>
            <span class="pf-lcd__val">${totalStudents}</span>
            <span class="pf-lcd__sub">în toate clasele</span>
          </div>
          <div class="pf-lcd__cell">
            <span class="pf-lcd__lbl">Rating</span>
            <span class="pf-lcd__val">${reviewsData.count ? reviewsData.avg.toFixed(1) : '0.0'}<small>/5</small></span>
            <span class="pf-stars">${_starsHTML(reviewsData.avg, 14)}</span>
          </div>
          <div class="pf-lcd__cell">
            <span class="pf-lcd__lbl">Recenzii</span>
            <span class="pf-lcd__val">${reviewsData.count}</span>
            <span class="pf-lcd__sub">${lastReview ? `ultima: ${_formatDate(lastReview.created_at)}` : 'niciuna încă'}</span>
          </div>
        </div>
      </section>`;

    const reviewsHTML = `
      <section class="pf-card">
        <div class="pf-h-row">
          <h2 class="pf-h">Recenzii</h2>
          <span class="pf-counter">${reviewsData.count}</span>
        </div>
        ${reviewsData.count ? reviewsData.reviews.map(r => `
          <article class="pf-review">
            <div class="pf-review__head">
              <strong>${BM.esc(r.student_name || 'Elev')}</strong>
              <span class="pf-stars">${_starsHTML(r.rating, 14)}</span>
              <span class="pf-review__date">${_formatDate(r.created_at)}</span>
            </div>
            ${r.comment ? `<p>${BM.esc(r.comment)}</p>` : ''}
          </article>`).join('') : `
          <p class="pf-note">Niciun elev nu a lăsat încă o recenzie. Recenziile elevilor tăi apar aici, cu cele mai noi primele.</p>`}
      </section>`;

    const classesHTML = `
      <section class="pf-card">
        <div class="pf-h-row">
          <h2 class="pf-h">Clasele mele</h2>
          <span class="pf-counter">${teacherClasses.length}</span>
        </div>
        ${teacherClasses.length ? `
        <ul class="pf-list">
          ${teacherClasses.map(c => `
            <li><a class="pf-list__row" href="class.html?id=${encodeURIComponent(c.id)}">
              <span class="pf-list__name">${BM.esc(c.name || 'Clasă')}</span>
              <span class="pf-list__meta">${c.students} elev${c.students === 1 ? '' : 'i'}</span>
            </a></li>`).join('')}
        </ul>` : '<p class="pf-note">Nu ai creat încă nicio clasă.</p>'}
        <a class="pf-key pf-key--block" href="classes.html">${icon('users', { size: 16 })} Mergi la Clase</a>
      </section>`;

    /* ---- Account: password + session ---- */
    const accountHTML = `
      <section class="pf-card" id="pfAccount">
        <h2 class="pf-h">Cont</h2>
        ${isGoogle
          ? '<p class="pf-note">Contul tău folosește autentificarea Google. Parola se gestionează din contul Google.</p>'
          : `<div id="pwMsg" class="auth-msg" style="display:none"></div>
             <form id="fPassword" class="pf-form" novalidate>
               <div class="auth-field">
                 <label class="auth-label" for="pwNew">Parolă nouă</label>
                 <div class="auth-input-wrap">
                   <input class="auth-input" id="pwNew" type="password" placeholder="Minim 8 caractere" autocomplete="new-password" required minlength="8">
                   <button type="button" class="auth-eye" data-target="pwNew" onclick="togglePw(this)" aria-label="Arată parola">${icon('eye', { size: 16 })}</button>
                 </div>
               </div>
               <div class="auth-field">
                 <label class="auth-label" for="pwConf">Confirmă parola nouă</label>
                 <div class="auth-input-wrap">
                   <input class="auth-input" id="pwConf" type="password" placeholder="Repetă parola" autocomplete="new-password" required>
                   <button type="button" class="auth-eye" data-target="pwConf" onclick="togglePw(this)" aria-label="Arată parola">${icon('eye', { size: 16 })}</button>
                 </div>
               </div>
               <button type="submit" class="pf-key pf-key--primary pf-key--block" id="btnPw">
                 <span>Salvează parola</span><span class="auth-spin" style="display:none"></span>
               </button>
             </form>`}
        <div class="pf-session">
          <p class="pf-note">Ultima autentificare: ${_formatDate(user.last_sign_in_at)}</p>
          <button class="pf-key pf-key--danger pf-key--block" id="btnLogout">${icon('log-out', { size: 16 })} Deconectare</button>
        </div>
      </section>`;

    /* Teacher: reviews beside classes + account. Student / admin: the
       progress display across the page, then tape, tokens and account side
       by side, so nothing leaves a column of empty space. */
    const bodyHTML = isTeacher ? (isActiveTeacher ? `
      <div class="pf-desk pf-desk--teacher">
        <div class="pf-desk__prog">${teacherStatsHTML}</div>
        <div class="pf-desk__cls">${classesHTML}</div>
        <div class="pf-desk__rev">${reviewsHTML}</div>
        <div class="pf-desk__acc">${accountHTML}</div>
      </div>` : `
      <div class="pf-desk pf-desk--teacher-lite">
        <div class="pf-desk__rev">${reviewsHTML}</div>
        <div class="pf-desk__acc">${accountHTML}</div>
      </div>`) : `
      <div class="pf-desk${isAdmin ? ' pf-desk--noprog' : ''}">
        ${isAdmin ? '' : `<div class="pf-desk__prog">${progressHTML}</div>`}
        <div class="pf-desk__tape">${tapeHTML}</div>
        <div class="pf-desk__tok">${tokensHTML}</div>
        <div class="pf-desk__acc">${accountHTML}</div>
      </div>`;

    content.innerHTML = `
      ${noticeHTML}
      ${plateHTML}
      ${bodyHTML}
    `;

    skeleton.style.display = 'none';
    content.style.display  = '';
    _animateProfile(content);

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
        // 500px, not the old 200 — the avatar now displays as large as
        // ~200px CSS (bigger still on a business-card header), and 200px
        // source pixels look visibly soft blown up that large, worse yet
        // on a retina screen.
        const dataUrl  = await _compressImage(file, 500);
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
        if (navBtn) navBtn.innerHTML = `<img src="${publicUrl}" alt="${BM.esc(name)}" class="nav-profile-avatar"><span class="nav-profile-name">${BM.esc(name)}</span>`;
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
        const dataUrl  = await _compressImage(file, 1600);
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
      _showEditBizcardProfileModal({
        name, bio, countryCode, phone, socialUrl, isTeacher, sb,
        onSaved: freshUser => renderProfile(freshUser, sb)
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
    // role/status come from a separate, slower DB round-trip
    // (_syncUserProfile in auth.js) that can still be pending at this
    // point. If it already landed (window.BMAuth.role set), the render
    // below already picks up the real value; otherwise listen for
    // 'bmauth:profile' and re-render once it arrives — attached BEFORE
    // that first render (which does its own async work: bio, cover,
    // review data...), not after. That first render can easily take
    // longer than _syncUserProfile's own single quick query, so
    // listening only once it finished (the previous order here) had a
    // real window where this one-time event already fired-and-was-missed
    // before the listener existed — a profesor account stuck showing the
    // 'elev' fallback forever, exactly the bug direct feedback reported.
    if (!window.BMAuth?.role) {
      document.addEventListener('bmauth:profile', () => renderProfile(auth.user, auth.supabase), { once: true });
    }
    await renderProfile(auth.user, auth.supabase);
  });
})();
