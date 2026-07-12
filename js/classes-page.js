/* ============================================================
   Mathorizon — Classes Page
   Teachers: create classes, share invite codes, manage members.
   Students: join via invite code, view/leave classes.
   ============================================================ */

(function () {
  'use strict';

  const DAY_ORDER = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

  // Persists across renderTeacherView() re-renders (create/delete a class)
  // within the same visit, same convention as other in-session-only filter/
  // sort state elsewhere in the app.
  let _dayFilterSelected = [];

  // Class names are always machine-generated as "Materie · Zi[/Zi2] · Oră"
  // (see buildGeneratedName/_getSelectedDays below — there's no free-text
  // override and no separate "days" column in the classes table), so the
  // day(s) a class meets on can be reliably recovered straight from the
  // name instead of needing a schema change just for this filter.
  function _parseClassDays(name) {
    const dayPart = String(name || '').split(' · ')[1] || '';
    return dayPart.split('/').map(d => d.trim()).filter(d => DAY_ORDER.includes(d));
  }

  /* ─── Init ─────────────────────────────────────────────────────── */
  function init() {
    BM.initScrollTop();
    if (window._bmAuthReady) {
      handleAuthReady();
    } else {
      document.addEventListener('bmauth:ready', handleAuthReady, { once: true });
    }
  }

  function handleAuthReady() {
    if (!BMAuth.user) {
      renderLoginPrompt();
      return;
    }
    if (BMAuth.role) {
      renderForRole();
    } else {
      /* Role loads async via bmauth:synced — show spinner until then */
      document.addEventListener('bmauth:synced', renderForRole, { once: true });
    }
  }

  function renderForRole() {
    if (BMAuth.role === 'profesor') {
      renderTeacherView();
    } else {
      renderStudentView();
    }
  }

  /* ─── Custom confirm dialog ────────────────────────────────────── */
  function showConfirm({ title, message, confirmText = 'Confirmă', icon = '⚠️' }) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <div class="confirm-dialog__body">
            <div class="confirm-dialog__icon">${icon}</div>
            <div class="confirm-dialog__title">${title}</div>
            ${message ? `<p class="confirm-dialog__msg">${message}</p>` : ''}
          </div>
          <div class="confirm-dialog__foot">
            <button class="btn btn--surface" id="confirmNo">Anulează</button>
            <button class="btn btn--danger" id="confirmYes">${confirmText}</button>
          </div>
        </div>
      `;

      const close = (result) => { overlay.remove(); document.body.style.overflow = ''; resolve(result); };
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
      overlay.querySelector('#confirmNo').addEventListener('click',  () => close(false));
      overlay.querySelector('#confirmYes').addEventListener('click', () => close(true));
      document.body.style.overflow = 'hidden';
      document.body.appendChild(overlay);
      overlay.querySelector('#confirmNo').focus();
    });
  }

  /* ─── Root helpers ─────────────────────────────────────────────── */
  function getRoot() { return document.getElementById('classesRoot'); }

  function setRootContent(html) {
    const root = getRoot();
    if (!root) return;
    /* Preserve background blobs */
    root.innerHTML = `
      <div class="main-blob main-blob--pink" aria-hidden="true"></div>
      <div class="main-blob main-blob--blue" aria-hidden="true"></div>
      ${html}
    `;
  }

  function renderLoginPrompt() {
    setRootContent(`
      <div class="classes-auth-prompt">
        <div class="classes-auth-icon">🔒</div>
        <h2>Autentificare necesară</h2>
        <p>Trebuie să fii autentificat pentru a accesa funcționalitatea de clase.</p>
        <a class="btn btn--primary" href="auth.html?from=classes.html">Conectează-te</a>
      </div>
    `);
  }

  /* ─── Invite code generator ────────────────────────────────────── */
  function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  /* ─── Relative date ─────────────────────────────────────────────── */
  function relDate(isoStr) {
    if (!isoStr) return '';
    const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
    if (diff < 60)      return 'acum';
    if (diff < 3600)    return `acum ${Math.floor(diff / 60)} min`;
    if (diff < 86400)   return `acum ${Math.floor(diff / 3600)} ore`;
    if (diff < 2592000) return `acum ${Math.floor(diff / 86400)} zile`;
    return new Date(isoStr).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ─── Mouse glow ─────────────────────────────────────────────────── */
  function attachMouseGlow(containerId) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    grid.querySelectorAll('.class-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', (e.clientX - r.left) + 'px');
        card.style.setProperty('--mouse-y', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     TEACHER VIEW
  ═══════════════════════════════════════════════════════════════ */
  function _teacherCacheKey() { return 'bm_cls_t_' + BMAuth.user.id; }

  function _applyTeacherUI(classes, memberCounts) {
    setRootContent(`
      <div class="classes-page">
        <div class="classes-header">
          <div class="classes-header__info">
            <h1 class="classes-title">Clasele Mele</h1>
            <p class="classes-subtitle">Creează clase și partajează codurile de invitație cu elevii tăi.</p>
          </div>
          <div class="classes-header__actions">
            ${classes.length > 0 ? _dayFilterHTML() : ''}
            <button class="btn btn--primary" id="createClassBtn">+ Creează Clasă</button>
          </div>
        </div>
        ${classes.length === 0
          ? teacherEmpty()
          : `<div class="classes-grid" id="classesGrid">
               ${classes.map(c => teacherCard(c, memberCounts[c.id] || 0)).join('')}
             </div>
             <div class="classes-empty classes-empty--filtered" id="classesFilterEmpty" style="display:none">
               <div class="classes-empty__icon">📭</div>
               <h3>Nicio clasă în ziua selectată</h3>
               <p>Încearcă altă zi sau șterge filtrul.</p>
             </div>`
        }
      </div>
      ${createModalHTML()}
    `);
    document.getElementById('createClassBtn')?.addEventListener('click', openCreateModal);
    document.querySelectorAll('.class-card__delete').forEach(btn => {
      btn.addEventListener('click', () => deleteClass(btn.dataset.id, btn.dataset.name));
    });
    attachMouseGlow('classesGrid');
    _initCustomSelects();
    if (classes.length > 0) { _wireDayFilter(); _applyDayFilter(); }
  }

  /* ── Day-of-week filter — quiet icon-only trigger next to "+ Creează
     Clasă", not a prominent control; a teacher only needs it once they
     have enough classes that scanning the grid by eye stops being faster. */
  function _dayFilterHTML() {
    return `
      <div class="cls-day-filter" id="clsDayFilter">
        <button type="button" class="cls-day-filter__btn${_dayFilterSelected.length ? ' cls-day-filter__btn--active' : ''}"
                id="dayFilterBtn" title="Filtrează după zi" aria-label="Filtrează după zi">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
            <path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>
          </svg>
          ${_dayFilterSelected.length ? `<span class="cls-day-filter__dot"></span>` : ''}
        </button>
        <div class="cls-day-filter__pop" id="dayFilterPop">
          <div class="cls-day-filter__chips">
            ${DAY_ORDER.map(d => `
              <button type="button" class="cls-day-chip cls-day-chip--sm${_dayFilterSelected.includes(d) ? ' cls-day-chip--sel' : ''}" data-day="${d}">${d.slice(0, 3)}</button>
            `).join('')}
          </div>
          <button type="button" class="cls-day-filter__clear" id="dayFilterClear">Arată toate</button>
        </div>
      </div>`;
  }

  function _wireDayFilter() {
    const wrap  = document.getElementById('clsDayFilter');
    const btn   = document.getElementById('dayFilterBtn');
    const pop   = document.getElementById('dayFilterPop');
    if (!wrap || !btn || !pop) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      wrap.classList.toggle('cls-day-filter--open');
    });
    pop.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => wrap.classList.remove('cls-day-filter--open'));

    pop.querySelectorAll('[data-day]').forEach(chip => {
      chip.addEventListener('click', () => {
        const day = chip.dataset.day;
        _dayFilterSelected = _dayFilterSelected.includes(day)
          ? _dayFilterSelected.filter(d => d !== day)
          : [..._dayFilterSelected, day];
        chip.classList.toggle('cls-day-chip--sel');
        btn.classList.toggle('cls-day-filter__btn--active', _dayFilterSelected.length > 0);
        let dot = btn.querySelector('.cls-day-filter__dot');
        if (_dayFilterSelected.length && !dot) {
          btn.insertAdjacentHTML('beforeend', '<span class="cls-day-filter__dot"></span>');
        } else if (!_dayFilterSelected.length && dot) {
          dot.remove();
        }
        _applyDayFilter();
      });
    });

    document.getElementById('dayFilterClear')?.addEventListener('click', () => {
      _dayFilterSelected = [];
      pop.querySelectorAll('.cls-day-chip--sel').forEach(c => c.classList.remove('cls-day-chip--sel'));
      btn.classList.remove('cls-day-filter__btn--active');
      btn.querySelector('.cls-day-filter__dot')?.remove();
      _applyDayFilter();
    });
  }

  // Matches if ANY of the class's own days is among the selected filter
  // days — a Marți/Joi class stays visible when only "Joi" is picked.
  function _applyDayFilter() {
    const grid = document.getElementById('classesGrid');
    if (!grid) return;
    const cards = [...grid.querySelectorAll('.class-card')];
    let visibleCount = 0;
    cards.forEach(card => {
      const days = (card.dataset.days || '').split(',').filter(Boolean);
      const match = _dayFilterSelected.length === 0 || days.some(d => _dayFilterSelected.includes(d));
      card.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });
    const emptyMsg = document.getElementById('classesFilterEmpty');
    if (emptyMsg) emptyMsg.style.display = visibleCount === 0 ? '' : 'none';
    grid.style.display = visibleCount === 0 ? 'none' : '';
  }

  async function renderTeacherView() {
    /* Show cached content immediately if available */
    let hasCached = false;
    try {
      const cached = JSON.parse(sessionStorage.getItem(_teacherCacheKey()) || 'null');
      if (cached) { hasCached = true; _applyTeacherUI(cached.classes, cached.memberCounts); }
    } catch {}
    if (!hasCached) {
      setRootContent(`<div class="classes-loading"><div class="classes-spinner"></div><p>Se încarcă...</p></div>`);
    }

    let classes = [];
    try {
      const { data, error } = await BMAuth.supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', BMAuth.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      classes = data || [];
    } catch (e) {
      BM.toast('Eroare la încărcarea claselor: ' + e.message, 'error');
    }

    /* Fetch member counts in parallel */
    const memberCounts = {};
    if (classes.length > 0) {
      await Promise.all(classes.map(async cls => {
        try {
          const { count } = await BMAuth.supabase
            .from('class_members')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id);
          memberCounts[cls.id] = count || 0;
        } catch {}
      }));
    }

    try { sessionStorage.setItem(_teacherCacheKey(), JSON.stringify({ classes, memberCounts })); } catch {}
    _applyTeacherUI(classes, memberCounts);
  }

  function teacherEmpty() {
    return `
      <div class="classes-empty">
        <div class="classes-empty__icon">🏫</div>
        <h3>Nicio clasă creată</h3>
        <p>Creează prima clasă și partajează codul de invitație cu elevii tăi.</p>
      </div>
    `;
  }

  function teacherCard(cls, memberCount) {
    const plural = memberCount !== 1 ? 'elevi' : 'elev';
    return `
      <div class="class-card class-card--clickable"
           data-days="${_parseClassDays(cls.name).join(',')}"
           onclick="window.location.href='class.html?id=${cls.id}'">
        <div class="class-card__header">
          <div>
            <div class="class-card__name">${BM.esc(cls.name)}</div>
            ${cls.school_grade ? `<span class="class-card__grade">Clasa ${BM.esc(cls.school_grade)}</span>` : ''}
          </div>
          <button class="class-card__delete"
                  data-id="${cls.id}"
                  data-name="${BM.esc(cls.name)}"
                  title="Șterge clasa"
                  onclick="event.stopPropagation()">✕</button>
        </div>
        ${cls.description ? `<p class="class-card__desc">${BM.esc(cls.description)}</p>` : ''}
        <div class="class-card__invite">
          <span class="class-card__invite-label">Cod invitație</span>
          <div class="class-card__invite-row">
            <span class="class-card__invite-code">${cls.invite_code}</span>
            <button class="class-card__copy-btn"
                    onclick="event.stopPropagation(); window._copyCode('${cls.invite_code}')"
                    title="Copiază codul">⧉</button>
          </div>
        </div>
        <div class="class-card__footer">
          <span class="class-card__members">
            <span class="class-card__members-count">${memberCount}${cls.max_students ? `/${cls.max_students}` : ''}</span>
            ${plural}
          </span>
          <span class="class-card__date">${relDate(cls.created_at)}</span>
        </div>
      </div>
    `;
  }

  /* ─── Create modal ─────────────────────────────────────────────── */
  function buildTimeOptions() {
    let opts = '';
    for (let h = 9; h <= 21; h++) {
      const hh = String(h).padStart(2, '0');
      opts += `<option value="${hh}:00">${hh}:00</option>`;
      if (h < 21) opts += `<option value="${hh}:30">${hh}:30</option>`;
    }
    return opts;
  }

  /* ── Custom select (replaces native <select> for full styling control) ── */
  function _makeCustomSelect(sel) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cls-csel';
    wrapper._nativeSel = sel;

    const trigger = document.createElement('div');
    trigger.className = 'cls-csel__trigger';

    const display = document.createElement('span');
    display.className = 'cls-csel__display';
    display.textContent = sel.options[0]?.text || '';

    const arrowSvg = `<svg width="11" height="7" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l5 5 5-5"/></svg>`;
    const arrow = document.createElement('span');
    arrow.className = 'cls-csel__arrow';
    arrow.innerHTML = arrowSvg;

    trigger.appendChild(display);
    trigger.appendChild(arrow);

    const dropdown = document.createElement('div');
    dropdown.className = 'cls-csel__dropdown';

    [...sel.options].forEach(opt => {
      const item = document.createElement('div');
      item.className = 'cls-csel__option' + (!opt.value ? ' cls-csel__option--placeholder' : '');
      item.dataset.value = opt.value;
      item.textContent = opt.text;
      item.addEventListener('click', e => {
        e.stopPropagation();
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        display.textContent = opt.text;
        display.style.color = opt.value ? 'var(--text)' : '';
        dropdown.querySelectorAll('.cls-csel__option--sel').forEach(el => el.classList.remove('cls-csel__option--sel'));
        if (opt.value) item.classList.add('cls-csel__option--sel');
        _closeAllCsels();
      });
      dropdown.appendChild(item);
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = wrapper.classList.contains('cls-csel--open');
      _closeAllCsels();
      if (!wasOpen) {
        wrapper.classList.add('cls-csel--open');
        _positionCselDropdown(trigger, dropdown);
      }
    });

    sel.style.display = 'none';
    sel.parentNode.insertBefore(wrapper, sel);
  }

  /* Fixed-position the dropdown off the trigger's viewport rect so it escapes
     clipping by any scrollable modal ancestor. Flips upward if there's no
     room below. */
  function _positionCselDropdown(trigger, dropdown) {
    const rect   = trigger.getBoundingClientRect();
    const maxH   = 216;
    const below  = window.innerHeight - rect.bottom;
    const openUp = below < maxH + 8 && rect.top > below;
    dropdown.style.position = 'fixed';
    dropdown.style.left     = rect.left + 'px';
    dropdown.style.width    = rect.width + 'px';
    dropdown.style.right    = 'auto';
    if (openUp) {
      dropdown.style.top    = 'auto';
      dropdown.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
    } else {
      dropdown.style.bottom = 'auto';
      dropdown.style.top    = (rect.bottom + 5) + 'px';
    }
  }

  function _closeAllCsels() {
    document.querySelectorAll('.cls-csel--open').forEach(w => w.classList.remove('cls-csel--open'));
  }

  function _cselReset(sel) {
    const wrap = sel.previousElementSibling;
    if (!wrap?.classList.contains('cls-csel')) return;
    const display = wrap.querySelector('.cls-csel__display');
    if (display) display.textContent = sel.options[0]?.text || '';
    wrap.querySelectorAll('.cls-csel__option--sel').forEach(o => o.classList.remove('cls-csel__option--sel'));
  }

  // Scrolling INSIDE an open dropdown's own option list also fires a native
  // 'scroll' event — since it's captured (not bubbled), a plain document-level
  // capture listener can't tell that apart from the page/modal scrolling
  // underneath it, and was closing the dropdown the instant you tried to
  // scroll through its options. Ignore scrolls whose target is the dropdown
  // itself; only page/ancestor scrolls should close it.
  function _onDocumentScrollForCsel(e) {
    if (e.target?.closest && e.target.closest('.cls-csel__dropdown')) return;
    _closeAllCsels();
  }

  function _initCustomSelects() {
    document.querySelectorAll('.cls-form-select').forEach(sel => _makeCustomSelect(sel));
    document.addEventListener('click', _closeAllCsels);
    document.addEventListener('scroll', _onDocumentScrollForCsel, true);
  }

  function createModalHTML() {
    return `
      <div class="classes-modal" id="classesModal" style="display:none">
        <div class="classes-modal__backdrop" id="classesModalBackdrop"></div>
        <div class="classes-modal__dialog">
          <div class="classes-modal__head">
            <h3>Creează Clasă Nouă</h3>
            <button class="icon-btn" id="closeModalBtn">✕</button>
          </div>
          <div class="classes-modal__body">
            <div class="cls-form-field">
              <label class="cls-form-label">Materie</label>
              <select id="classMaterieInput" class="cls-form-input cls-form-select">
                <option value="">— Selectează materia —</option>
                <option value="Matematică">Matematică</option>
                <option value="Limba Română">Limba Română</option>
                <option value="Istorie">Istorie</option>
                <option value="Geografie">Geografie</option>
                <option value="Chimie">Chimie</option>
                <option value="Limba Engleză">Limba Engleză</option>
                <option value="Biologie">Biologie</option>
              </select>
            </div>
            <div class="cls-form-field">
              <label class="cls-form-label">Ziua</label>
              <div class="cls-day-picker" id="classZiuaPicker">
                ${['Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă','Duminică'].map(d => `
                  <button type="button" class="cls-day-chip" data-day="${d}">${d}</button>
                `).join('')}
              </div>
              <span class="cls-form-hint">Poți alege 2 zile dacă grupa are lecții de două ori pe săptămână</span>
            </div>
            <div class="cls-form-row">
              <div class="cls-form-field">
                <label class="cls-form-label">Ora</label>
                <select id="classOraInput" class="cls-form-input cls-form-select">
                  <option value="">— Ora —</option>
                  ${buildTimeOptions()}
                </select>
              </div>
              <div class="cls-form-field">
                <label class="cls-form-label">Nr. maxim elevi</label>
                <select id="classMaxEleviInput" class="cls-form-input cls-form-select">
                  <option value="">— Număr —</option>
                  <option value="6">6 elevi</option>
                  <option value="5">5 elevi</option>
                  <option value="4">4 elevi</option>
                  <option value="3">3 elevi</option>
                  <option value="2">2 elevi</option>
                  <option value="1">Individual (1 elev)</option>
                </select>
              </div>
            </div>
            <div class="cls-form-row">
              <div class="cls-form-field">
                <label class="cls-form-label">Clasa</label>
                <select id="classGradeInput" class="cls-form-input cls-form-select">
                  <option value="">— Clasa —</option>
                  <option value="a 5-a">a 5-a</option>
                  <option value="a 6-a">a 6-a</option>
                  <option value="a 7-a">a 7-a</option>
                  <option value="a 8-a">a 8-a</option>
                  <option value="a 9-a">a 9-a</option>
                  <option value="a 10-a">a 10-a</option>
                  <option value="a 11-a">a 11-a</option>
                  <option value="a 12-a">a 12-a</option>
                </select>
              </div>
              <div class="cls-form-field">
                <label class="cls-form-label">Nivel matematică</label>
                <select id="classMathLevelInput" class="cls-form-input cls-form-select">
                  <option value="">— Nivel —</option>
                  <option value="9-10">9-10 · Foarte bun</option>
                  <option value="7-8">7-8 · OK</option>
                  <option value="6-7">6-7 · Așa și așa</option>
                  <option value="5-6">5-6 · Slab</option>
                </select>
              </div>
            </div>
            <div class="cls-name-preview">
              <span class="cls-name-preview__label">Denumire:</span>
              <span class="cls-name-preview__value" id="classNamePreview">—</span>
            </div>
          </div>
          <div class="classes-modal__foot">
            <button class="btn btn--surface" id="cancelCreateBtn">Anulează</button>
            <button class="btn btn--primary" id="confirmCreateBtn">Creează Clasa</button>
          </div>
        </div>
      </div>
    `;
  }

  // Reads selection straight off the chips' DOM state rather than keeping a
  // parallel JS array — the day picker has no hidden <select>, this *is*
  // its source of truth. Always returned in weekday order regardless of
  // click order, so "Marți/Joi" never renders as "Joi/Marți".
  function _getSelectedDays() {
    const picker = document.getElementById('classZiuaPicker');
    if (!picker) return [];
    const selected = [...picker.querySelectorAll('.cls-day-chip--sel')].map(b => b.dataset.day);
    return DAY_ORDER.filter(d => selected.includes(d));
  }

  function buildGeneratedName() {
    const mat = document.getElementById('classMaterieInput')?.value || '';
    const zi  = _getSelectedDays().join('/');
    const ora = document.getElementById('classOraInput')?.value || '';
    if (!mat && !zi && !ora) return '—';
    const parts = [mat, zi, ora].filter(Boolean);
    return parts.join(' · ');
  }

  function updateNamePreview() {
    const el = document.getElementById('classNamePreview');
    if (el) el.textContent = buildGeneratedName();
  }

  function _wireDayPicker() {
    const picker = document.getElementById('classZiuaPicker');
    if (!picker || picker._wired) return;
    picker._wired = true;
    picker.querySelectorAll('.cls-day-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const isSelected = chip.classList.contains('cls-day-chip--sel');
        const selectedCount = picker.querySelectorAll('.cls-day-chip--sel').length;
        if (!isSelected && selectedCount >= 2) {
          BM.toast('Poți selecta cel mult 2 zile pe săptămână.', 'info');
          return;
        }
        chip.classList.toggle('cls-day-chip--sel');
        updateNamePreview();
      });
    });
  }

  function openCreateModal() {
    const modal = document.getElementById('classesModal');
    if (!modal) return;
    modal.style.display = 'flex';
    /* Fără asta, body-ul rămâne scrollabil sub modalul fixed — pe mobil,
       scroll-ul pe pagina din spate face ca header-ul modalului (fixed)
       să iasă din ecran când bara de adresă a browserului se ascunde/arată. */
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.getElementById('classMaterieInput')?.focus();
    document.getElementById('closeModalBtn').onclick         = closeCreateModal;
    document.getElementById('cancelCreateBtn').onclick       = closeCreateModal;
    document.getElementById('classesModalBackdrop').onclick  = closeCreateModal;
    document.getElementById('confirmCreateBtn').onclick      = confirmCreateClass;
    ['classMaterieInput', 'classOraInput', 'classMaxEleviInput', 'classGradeInput', 'classMathLevelInput'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', updateNamePreview);
    });
    _wireDayPicker();
  }

  function closeCreateModal() {
    const modal = document.getElementById('classesModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    ['classMaterieInput', 'classOraInput', 'classMaxEleviInput', 'classGradeInput', 'classMathLevelInput'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; _cselReset(el); }
    });
    document.getElementById('classZiuaPicker')?.querySelectorAll('.cls-day-chip--sel')
      .forEach(c => c.classList.remove('cls-day-chip--sel'));
    const preview = document.getElementById('classNamePreview');
    if (preview) preview.textContent = '—';
    _closeAllCsels();
  }

  async function confirmCreateClass() {
    const name      = buildGeneratedName();
    const materie   = document.getElementById('classMaterieInput')?.value;
    const ziua      = _getSelectedDays().join('/');
    const ora       = document.getElementById('classOraInput')?.value;
    const maxElevi  = document.getElementById('classMaxEleviInput')?.value;
    const grade     = document.getElementById('classGradeInput')?.value;
    const mathLevel = document.getElementById('classMathLevelInput')?.value;

    if (!materie || !ziua || !ora) {
      BM.toast('Selectează materia, ziua (cel puțin una) și ora.', 'error');
      return;
    }
    if (!maxElevi) {
      BM.toast('Selectează numărul maxim de elevi.', 'error');
      return;
    }
    if (!grade) {
      BM.toast('Selectează clasa elevilor.', 'error');
      return;
    }

    const btn = document.getElementById('confirmCreateBtn');
    btn.disabled    = true;
    btn.textContent = 'Se creează…';

    let inviteCode = generateInviteCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { error } = await BMAuth.supabase
          .from('classes')
          .insert({
            name,
            teacher_id:   BMAuth.user.id,
            teacher_name: BMAuth.displayName(),
            invite_code:  inviteCode,
            max_students: parseInt(maxElevi, 10),
            school_grade: grade,
            math_level:   mathLevel || null
          });

        if (!error) {
          closeCreateModal();
          BM.toast('Clasa a fost creată! Cod: ' + inviteCode, 'success');
          renderTeacherView();
          return;
        }
        if (error.code === '23505') {
          inviteCode = generateInviteCode();
        } else {
          throw error;
        }
      } catch (e) {
        BM.toast('Eroare: ' + e.message, 'error');
        btn.disabled    = false;
        btn.textContent = 'Creează Clasa';
        return;
      }
    }

    BM.toast('Nu s-a putut genera un cod unic. Încearcă din nou.', 'error');
    btn.disabled    = false;
    btn.textContent = 'Creează Clasa';
  }

  async function deleteClass(classId, className) {
    const ok = await showConfirm({
      icon:        '🗑️',
      title:       'Ștergi clasa „' + className + '"?',
      message:     'Această acțiune este ireversibilă. Toți elevii înscriși vor fi scoși din clasă.',
      confirmText: 'Șterge clasa'
    });
    if (!ok) return;
    try {
      const { error } = await BMAuth.supabase
        .from('classes')
        .delete()
        .eq('id', classId)
        .eq('teacher_id', BMAuth.user.id);
      if (error) throw error;
      BM.toast('Clasa a fost ștearsă.', 'info');
      renderTeacherView();
    } catch (e) {
      BM.toast('Eroare la ștergere: ' + e.message, 'error');
    }
  }

  window._copyCode = function (code) {
    navigator.clipboard.writeText(code)
      .then(() => BM.toast('Codul ' + code + ' a fost copiat!', 'success'))
      .catch(() => BM.toast('Codul este: ' + code, 'info'));
  };

  /* ═══════════════════════════════════════════════════════════════
     STUDENT VIEW
  ═══════════════════════════════════════════════════════════════ */
  function _studentCacheKey() { return 'bm_cls_s_' + BMAuth.user.id; }

  function _applyStudentUI(classes) {
    setRootContent(`
      <div class="classes-page">
        <div class="classes-header">
          <div class="classes-header__info">
            <h1 class="classes-title">Clasele Mele</h1>
            <p class="classes-subtitle">Alătură-te unei clase cu codul de invitație primit de la profesor.</p>
          </div>
        </div>

        <div class="classes-join-section">
          <div class="classes-join-card">
            <div class="classes-join-card__icon">🔑</div>
            <div class="classes-join-card__body">
              <h3>Alătură-te unei clase</h3>
              <p>Introdu codul de 6 caractere primit de la profesorul tău.</p>
              <div class="classes-join-row">
                <input type="text" id="inviteCodeInput" class="classes-code-input"
                       placeholder="ABC123" maxlength="6"
                       oninput="this.value = this.value.toUpperCase()">
                <button class="btn btn--primary" id="joinClassBtn">Alătură-te</button>
              </div>
            </div>
          </div>
        </div>

        <div class="classes-section-title">Clase înscrise</div>
        ${classes.length === 0
          ? studentEmpty()
          : `<div class="classes-grid classes-grid--student" id="classesGrid">
               ${classes.map(c => studentCard(c)).join('')}
             </div>`
        }
      </div>
    `);
    const joinBtn   = document.getElementById('joinClassBtn');
    const codeInput = document.getElementById('inviteCodeInput');
    joinBtn?.addEventListener('click', joinClass);
    codeInput?.addEventListener('keydown', e => { if (e.key === 'Enter') joinClass(); });
    document.querySelectorAll('.class-card__leave').forEach(btn => {
      btn.addEventListener('click', () => leaveClass(btn.dataset.id, btn.dataset.name));
    });
    attachMouseGlow('classesGrid');
  }

  async function renderStudentView() {
    /* Show cached content immediately if available */
    let hasCached = false;
    try {
      const cached = JSON.parse(sessionStorage.getItem(_studentCacheKey()) || 'null');
      if (cached) { hasCached = true; _applyStudentUI(cached.classes); }
    } catch {}
    if (!hasCached) {
      setRootContent(`<div class="classes-loading"><div class="classes-spinner"></div><p>Se încarcă...</p></div>`);
    }

    let classes = [];
    try {
      const { data, error } = await BMAuth.supabase
        .from('class_members')
        .select(`joined_at, classes ( id, name, description, teacher_name, created_at )`)
        .eq('student_id', BMAuth.user.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      classes = (data || []).map(row => ({ ...row.classes, joined_at: row.joined_at }));
    } catch (e) {
      BM.toast('Eroare la încărcarea claselor: ' + e.message, 'error');
    }

    try { sessionStorage.setItem(_studentCacheKey(), JSON.stringify({ classes })); } catch {}
    _applyStudentUI(classes);
  }

  function studentEmpty() {
    return `
      <div class="classes-empty">
        <div class="classes-empty__icon">📚</div>
        <h3>Nicio clasă înscrisă</h3>
        <p>Introdu codul de invitație de mai sus pentru a te alătura primei clase.</p>
      </div>
    `;
  }

  function studentCard(cls) {
    return `
      <div class="class-card class-card--student class-card--clickable"
           onclick="window.location.href='class.html?id=${cls.id}'">
        <div class="class-card__header">
          <div class="class-card__name">${BM.esc(cls.name)}</div>
        </div>
        ${cls.description ? `<p class="class-card__desc">${BM.esc(cls.description)}</p>` : ''}
        <div class="class-card__teacher">
          <span class="class-card__teacher-label">Profesor:</span>
          <span class="class-card__teacher-name">${BM.esc(cls.teacher_name || '—')}</span>
        </div>
        <div class="class-card__footer">
          <span class="class-card__date">Înscris ${relDate(cls.joined_at)}</span>
          <button class="class-card__leave"
                  data-id="${cls.id}"
                  data-name="${BM.esc(cls.name)}"
                  onclick="event.stopPropagation()">Ieși din clasă</button>
        </div>
      </div>
    `;
  }

  async function joinClass() {
    const input = document.getElementById('inviteCodeInput');
    const code  = input?.value.trim().toUpperCase();

    if (!code || code.length !== 6) {
      BM.toast('Introdu un cod valid de 6 caractere.', 'error');
      input?.focus();
      return;
    }

    const btn = document.getElementById('joinClassBtn');
    btn.disabled    = true;
    btn.textContent = 'Se verifică…';

    try {
      const { data: found, error: findErr } = await BMAuth.supabase
        .from('classes')
        .select('id, name, teacher_id')
        .eq('invite_code', code)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!found) {
        BM.toast('Cod de invitație invalid. Verifică și încearcă din nou.', 'error');
        btn.disabled = false; btn.textContent = 'Alătură-te';
        return;
      }
      if (found.teacher_id === BMAuth.user.id) {
        BM.toast('Nu te poți înscrie în propria clasă.', 'error');
        btn.disabled = false; btn.textContent = 'Alătură-te';
        return;
      }

      const { error: joinErr } = await BMAuth.supabase
        .from('class_members')
        .insert({ class_id: found.id, student_id: BMAuth.user.id, student_name: BMAuth.displayName() });

      if (joinErr) {
        if (joinErr.code === '23505') {
          BM.toast('Ești deja înscris în această clasă.', 'error');
        } else {
          throw joinErr;
        }
        btn.disabled = false; btn.textContent = 'Alătură-te';
        return;
      }

      BM.toast('Te-ai alăturat clasei „' + found.name + '"!', 'success');
      renderStudentView();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
      btn.disabled = false; btn.textContent = 'Alătură-te';
    }
  }

  async function leaveClass(classId, className) {
    const ok = await showConfirm({
      title:       `Ieși din clasa „${className}"?`,
      message:     'Nu vei mai avea acces la anunțuri și teme. Te poți alătura din nou cu codul de invitație.',
      confirmText: 'Ieși din clasă',
      icon:        '🚪'
    });
    if (!ok) return;
    try {
      const { error } = await BMAuth.supabase
        .from('class_members')
        .delete()
        .eq('class_id', classId)
        .eq('student_id', BMAuth.user.id);
      if (error) throw error;
      BM.toast('Ai ieșit din clasă.', 'info');
      renderStudentView();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
    }
  }

  /* ─── Bootstrap ─────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
