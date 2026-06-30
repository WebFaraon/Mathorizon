/* ============================================================
   Mathorizon — Classes Page
   Teachers: create classes, share invite codes, manage members.
   Students: join via invite code, view/leave classes.
   ============================================================ */

(function () {
  'use strict';

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

      const close = (result) => { overlay.remove(); resolve(result); };
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
      overlay.querySelector('#confirmNo').addEventListener('click',  () => close(false));
      overlay.querySelector('#confirmYes').addEventListener('click', () => close(true));
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
  async function renderTeacherView() {
    setRootContent(`<div class="classes-loading"><div class="classes-spinner"></div><p>Se încarcă...</p></div>`);

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

    setRootContent(`
      <div class="classes-page">
        <div class="classes-header">
          <div class="classes-header__info">
            <h1 class="classes-title">Clasele Mele</h1>
            <p class="classes-subtitle">Creează clase și partajează codurile de invitație cu elevii tăi.</p>
          </div>
          <button class="btn btn--primary" id="createClassBtn">+ Creează Clasă</button>
        </div>
        ${classes.length === 0
          ? teacherEmpty()
          : `<div class="classes-grid" id="classesGrid">
               ${classes.map(c => teacherCard(c, memberCounts[c.id] || 0)).join('')}
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
      if (!wasOpen) wrapper.classList.add('cls-csel--open');
    });

    sel.style.display = 'none';
    sel.parentNode.insertBefore(wrapper, sel);
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

  function _initCustomSelects() {
    document.querySelectorAll('.cls-form-select').forEach(sel => _makeCustomSelect(sel));
    document.addEventListener('click', _closeAllCsels);
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
            <div class="cls-form-row">
              <div class="cls-form-field">
                <label class="cls-form-label">Ziua</label>
                <select id="classZiuaInput" class="cls-form-input cls-form-select">
                  <option value="">— Ziua —</option>
                  <option value="Luni">Luni</option>
                  <option value="Marți">Marți</option>
                  <option value="Miercuri">Miercuri</option>
                  <option value="Joi">Joi</option>
                  <option value="Vineri">Vineri</option>
                  <option value="Sâmbătă">Sâmbătă</option>
                  <option value="Duminică">Duminică</option>
                </select>
              </div>
              <div class="cls-form-field">
                <label class="cls-form-label">Ora</label>
                <select id="classOraInput" class="cls-form-input cls-form-select">
                  <option value="">— Ora —</option>
                  ${buildTimeOptions()}
                </select>
              </div>
            </div>
            <div class="cls-form-row">
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

  function buildGeneratedName() {
    const mat = document.getElementById('classMaterieInput')?.value || '';
    const zi  = document.getElementById('classZiuaInput')?.value || '';
    const ora = document.getElementById('classOraInput')?.value || '';
    if (!mat && !zi && !ora) return '—';
    const parts = [mat, zi, ora].filter(Boolean);
    return parts.join(' · ');
  }

  function updateNamePreview() {
    const el = document.getElementById('classNamePreview');
    if (el) el.textContent = buildGeneratedName();
  }

  function openCreateModal() {
    const modal = document.getElementById('classesModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('classMaterieInput')?.focus();
    document.getElementById('closeModalBtn').onclick         = closeCreateModal;
    document.getElementById('cancelCreateBtn').onclick       = closeCreateModal;
    document.getElementById('classesModalBackdrop').onclick  = closeCreateModal;
    document.getElementById('confirmCreateBtn').onclick      = confirmCreateClass;
    ['classMaterieInput', 'classZiuaInput', 'classOraInput', 'classMaxEleviInput', 'classGradeInput', 'classMathLevelInput'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', updateNamePreview);
    });
  }

  function closeCreateModal() {
    const modal = document.getElementById('classesModal');
    if (!modal) return;
    modal.style.display = 'none';
    ['classMaterieInput', 'classZiuaInput', 'classOraInput', 'classMaxEleviInput', 'classGradeInput', 'classMathLevelInput'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; _cselReset(el); }
    });
    const preview = document.getElementById('classNamePreview');
    if (preview) preview.textContent = '—';
    _closeAllCsels();
  }

  async function confirmCreateClass() {
    const name      = buildGeneratedName();
    const materie   = document.getElementById('classMaterieInput')?.value;
    const ziua      = document.getElementById('classZiuaInput')?.value;
    const ora       = document.getElementById('classOraInput')?.value;
    const maxElevi  = document.getElementById('classMaxEleviInput')?.value;
    const grade     = document.getElementById('classGradeInput')?.value;
    const mathLevel = document.getElementById('classMathLevelInput')?.value;

    if (!materie || !ziua || !ora) {
      BM.toast('Selectează materia, ziua și ora.', 'error');
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
  async function renderStudentView() {
    setRootContent(`<div class="classes-loading"><div class="classes-spinner"></div><p>Se încarcă...</p></div>`);

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

    const joinBtn  = document.getElementById('joinClassBtn');
    const codeInput = document.getElementById('inviteCodeInput');
    joinBtn?.addEventListener('click', joinClass);
    codeInput?.addEventListener('keydown', e => { if (e.key === 'Enter') joinClass(); });

    document.querySelectorAll('.class-card__leave').forEach(btn => {
      btn.addEventListener('click', () => leaveClass(btn.dataset.id, btn.dataset.name));
    });
    attachMouseGlow('classesGrid');
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
        .insert({ class_id: found.id, student_id: BMAuth.user.id });

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
