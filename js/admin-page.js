/* ============================================================
   Mathorizon — Admin Page (admin.html)
   ============================================================ */

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  let _activeTab = 'profs';

  function _waitForAuth() {
    return new Promise(resolve => {
      if (window._bmAuthReady) return resolve(window.BMAuth);
      const timer = setTimeout(() => resolve(window.BMAuth), 6000);
      document.addEventListener('bmauth:ready', () => { clearTimeout(timer); resolve(window.BMAuth); }, { once: true });
    });
  }

  function _waitForProfile() {
    return new Promise(resolve => {
      if (window.BMAuth?.role) return resolve();
      document.addEventListener('bmauth:profile', resolve, { once: true });
      setTimeout(resolve, 5000);
    });
  }

  async function _rpc(fnName, params = {}, session) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + (session?.access_token || ''),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(params)
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || 'HTTP ' + res.status);
    return text ? JSON.parse(text) : null;
  }

  function _initials(name) {
    const parts = (name || '').split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name || '?').slice(0, 2).toUpperCase() || '?';
  }

  function _formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function _parseClass(cls) {
    const parts = (cls.name || cls.class_name || '').split('·').map(s => s.trim());
    const icons  = { 'matematică':'📐','fizică':'⚛️','chimie':'🧪','biologie':'🌿','informatică':'💻','istorie':'📜','geografie':'🌍','română':'📖','limba română':'📖','engleză':'🇬🇧','limba engleză':'🇬🇧','franceză':'🇫🇷' };
    const subject = parts[0] || cls.name || cls.class_name;
    return { subject, icon: icons[(subject||'').toLowerCase()] || '📚', day: parts[1]||'', time: parts[2]||'' };
  }

  const mathLevelMap = {
    '9-10': { label:'Foarte bun', cls:'tag--green' },
    '7-8':  { label:'OK',         cls:'tag--blue'  },
    '6-7':  { label:'Mediocru',   cls:'tag--amber' },
    '5-6':  { label:'Slab',       cls:'tag--red'   },
  };

  /* ── Professor section ── */
  function _classCard(cls) {
    const { subject, icon, day, time } = _parseClass(cls);
    const enrolled = Number(cls.member_count) || 0;
    const maxEl    = cls.max_students;
    const lvl      = cls.math_level ? mathLevelMap[cls.math_level] : null;
    const full     = maxEl && enrolled >= maxEl;
    return `
      <div class="admin-class-mini">
        <div class="admin-class-mini__subject">${icon} ${BM.esc(subject)}</div>
        ${(day||time) ? `<div class="admin-class-mini__schedule">${BM.esc([day,time].filter(Boolean).join(' · '))}</div>` : ''}
        <div class="admin-class-mini__tags">
          <span class="admin-class-mini__tag${full?' admin-class-mini__tag--red':''}">👥 ${enrolled}${maxEl?' / '+maxEl:''} elevi</span>
          ${cls.school_grade ? `<span class="admin-class-mini__tag admin-class-mini__tag--muted">Cls. ${BM.esc(cls.school_grade)}</span>` : ''}
          ${lvl ? `<span class="admin-class-mini__tag admin-class-mini__${lvl.cls}">${BM.esc(cls.math_level)} · ${lvl.label}</span>` : ''}
        </div>
      </div>`;
  }

  function _profRow(prof, classes) {
    const uid = prof.user_id;
    const statusMap = { active:['active','Aprobat'], pending:['pending','În așteptare'], rejected:['rejected','Respins'] };
    const [sCls, sLbl] = statusMap[prof.status] || ['pending','—'];
    return `
      <div class="admin-prof-block" id="pblock-${uid}" data-name="${BM.esc((prof.full_name||'').toLowerCase())}">
        <div class="admin-prof-row" onclick="toggleAdminExpand('prof','${uid}')">
          <div class="admin-prof-avatar">${_initials(prof.full_name)}</div>
          <div class="admin-prof-info">
            <div class="admin-prof-name">${BM.esc(prof.full_name||'—')}</div>
            <div class="admin-prof-email">${BM.esc(prof.email||'')}</div>
          </div>
          <div class="admin-prof-meta">
            <span class="admin-class-count">${classes.length} ${classes.length===1?'clasă':'clase'}</span>
            <span class="admin-approved-badge admin-approved-badge--${sCls}">${sLbl}</span>
          </div>
          <span class="admin-expand-icon" id="expand-icon-prof-${uid}">▼</span>
        </div>
        <div class="admin-prof-classes" id="expand-panel-prof-${uid}">
          ${!classes.length
            ? '<div class="admin-empty" style="padding:16px">Nicio clasă creată.</div>'
            : `<div class="admin-class-grid">${classes.map(_classCard).join('')}</div>`}
        </div>
      </div>`;
  }

  /* ── Student section ── */
  function _studentClassChip(cls) {
    const { subject, icon, day, time } = _parseClass(cls);
    const schedule = [day, time].filter(Boolean).join(' · ');
    return `<span class="admin-stud-chip" title="${BM.esc(cls.teacher_name||'')}">
      ${icon} ${BM.esc(subject)}${schedule ? ' · ' + BM.esc(schedule) : ''}
    </span>`;
  }

  function _studentRow(student, classes) {
    const uid = student.user_id;
    return `
      <div class="admin-prof-block" id="sblock-${uid}" data-name="${BM.esc((student.full_name||'').toLowerCase())}">
        <div class="admin-prof-row" onclick="toggleAdminExpand('stud','${uid}')">
          <div class="admin-prof-avatar">${_initials(student.full_name)}</div>
          <div class="admin-prof-info">
            <div class="admin-prof-name">${BM.esc(student.full_name||'—')}</div>
            <div class="admin-prof-email">${BM.esc(student.email||'')}</div>
          </div>
          <div class="admin-prof-meta">
            <span class="admin-class-count">${classes.length} ${classes.length===1?'clasă':'clase'}</span>
            <span class="admin-student-date-badge">${_formatDate(student.created_at)}</span>
          </div>
          <span class="admin-expand-icon" id="expand-icon-stud-${uid}">▼</span>
        </div>
        <div class="admin-prof-classes" id="expand-panel-stud-${uid}">
          ${!classes.length
            ? '<div class="admin-empty" style="padding:16px">Neînscris în nicio clasă.</div>'
            : `<div class="admin-stud-chips">${classes.map(_studentClassChip).join('')}</div>`}
        </div>
      </div>`;
  }

  /* ── Toggle expand ── */
  window.toggleAdminExpand = function(type, uid) {
    const panel = document.getElementById(`expand-panel-${type}-${uid}`);
    const icon  = document.getElementById(`expand-icon-${type}-${uid}`);
    const row   = panel?.previousElementSibling;
    if (!panel) return;
    const open = panel.classList.toggle('open');
    if (icon) icon.classList.toggle('open', open);
    if (row)  row.classList.toggle('open', open);
  };

  /* ── Tab switching ── */
  window.switchAdminTab = function(tab) {
    _activeTab = tab;
    document.getElementById('panelProfs').style.display = tab === 'profs' ? '' : 'none';
    document.getElementById('panelStuds').style.display = tab === 'studs'  ? '' : 'none';
    document.getElementById('tabProfs').classList.toggle('admin-tab--active', tab === 'profs');
    document.getElementById('tabStuds').classList.toggle('admin-tab--active', tab === 'studs');
    const searchEl = document.getElementById('adminSearch');
    if (searchEl) { searchEl.value = ''; adminFilterSearch(); }
  };

  /* ── Search / filter ── */
  window.adminFilterSearch = function() {
    const q       = (document.getElementById('adminSearch')?.value || '').toLowerCase().trim();
    const panelId = _activeTab === 'profs' ? 'panelProfs' : 'panelStuds';
    const panel   = document.getElementById(panelId);
    if (!panel) return;
    panel.querySelectorAll('.admin-prof-block').forEach(el => {
      const name = el.dataset.name || '';
      el.style.display = (!q || name.includes(q)) ? '' : 'none';
    });
  };

  /* ── Main render ── */
  async function renderAdmin(session) {
    const loading = document.getElementById('adminLoading');
    const denied  = document.getElementById('adminDenied');
    const wrap    = document.getElementById('adminWrap');
    if (loading) loading.style.display = 'none';

    let pending = [], allProfs = [], allClasses = [], allStudents = [], studentClasses = [];
    try {
      [pending, allProfs, allClasses, allStudents, studentClasses] = await Promise.all([
        _rpc('get_pending_professors',       {}, session).catch(() => []),
        _rpc('get_all_professors',           {}, session).catch(() => []),
        _rpc('get_all_classes_admin',        {}, session).catch(() => []),
        _rpc('get_all_students',             {}, session).catch(() => []),
        _rpc('get_all_student_classes_admin',{}, session).catch(() => []),
      ]);
    } catch (e) {
      console.error('[Admin] error:', e.message);
      if (denied) denied.style.display = '';
      return;
    }

    if (wrap) wrap.style.display = '';

    /* Stats */
    const approved = (allProfs||[]).filter(p => p.status === 'active').length;
    const rejected = (allProfs||[]).filter(p => p.status === 'rejected').length;
    _setText('statPending',  (pending||[]).length);
    _setText('statApproved', approved);
    _setText('statRejected', rejected);
    _setText('statStudents', (allStudents||[]).length);
    _setText('tabProfCount', (allProfs||[]).length);
    _setText('tabStudCount', (allStudents||[]).length);

    /* Pending list */
    const pendingEl = document.getElementById('pendingList');
    if (pendingEl) {
      pendingEl.innerHTML = !(pending||[]).length
        ? '<div class="admin-empty">Nu există cereri în așteptare.</div>'
        : (pending||[]).map(p => `
            <div class="admin-prof-card" id="pcard-${p.user_id}">
              <div class="admin-prof-avatar">${_initials(p.full_name)}</div>
              <div class="admin-prof-info">
                <div class="admin-prof-name">${BM.esc(p.full_name||'—')}</div>
                <div class="admin-prof-email">${BM.esc(p.email||'')}</div>
                <div class="admin-prof-date">Cerere trimisă: ${_formatDate(p.created_at)}</div>
              </div>
              <div class="admin-prof-actions">
                <button class="btn btn--sm" style="background:var(--green-dim);color:var(--green);border-color:var(--green-border)"
                  onclick="approveProf('${p.user_id}')">✓ Aprobă</button>
                <button class="btn btn--sm btn--danger-outline"
                  onclick="rejectProf('${p.user_id}')">✗ Respinge</button>
              </div>
            </div>`).join('');
    }

    /* Professors panel */
    const classesMap = {};
    (allClasses||[]).forEach(c => {
      if (!classesMap[c.teacher_id]) classesMap[c.teacher_id] = [];
      classesMap[c.teacher_id].push(c);
    });

    const profPanel = document.getElementById('panelProfs');
    if (profPanel) {
      profPanel.innerHTML = !(allProfs||[]).length
        ? '<div class="admin-empty">Nu există conturi de profesor.</div>'
        : (allProfs||[]).map(p => _profRow(p, classesMap[p.user_id]||[])).join('');
    }

    /* Students panel */
    const studClassMap = {};
    (studentClasses||[]).forEach(r => {
      if (!studClassMap[r.student_id]) studClassMap[r.student_id] = [];
      studClassMap[r.student_id].push(r);
    });

    const studPanel = document.getElementById('panelStuds');
    if (studPanel) {
      studPanel.innerHTML = !(allStudents||[]).length
        ? '<div class="admin-empty">Nu există elevi înregistrați.</div>'
        : (allStudents||[]).map(s => _studentRow(s, studClassMap[s.user_id]||[])).join('');
    }

    window._adminSession = session;
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  window.approveProf = async function(userId) {
    const btn = document.querySelector(`#pcard-${userId} .btn`);
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      await _rpc('set_professor_status', { target_user_id: userId, new_status: 'active' }, window._adminSession);
      const card = document.getElementById(`pcard-${userId}`);
      if (card) {
        card.style.opacity = '0.5'; card.style.pointerEvents = 'none';
        setTimeout(() => { card.remove(); _delta('statPending',-1); _delta('statApproved',1); }, 300);
      }
      BM.toast('Profesor aprobat!', 'success');
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✓ Aprobă'; }
    }
  };

  window.rejectProf = async function(userId) {
    if (!confirm('Ești sigur că vrei să respingi această cerere?')) return;
    try {
      await _rpc('set_professor_status', { target_user_id: userId, new_status: 'rejected' }, window._adminSession);
      const card = document.getElementById(`pcard-${userId}`);
      if (card) {
        card.style.opacity = '0.5'; card.style.pointerEvents = 'none';
        setTimeout(() => { card.remove(); _delta('statPending',-1); _delta('statRejected',1); }, 300);
      }
      BM.toast('Cerere respinsă.', 'success');
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
    }
  };

  function _delta(id, delta) {
    const el = document.getElementById(id);
    if (el) el.textContent = Math.max(0, parseInt(el.textContent||'0') + delta);
    if (id === 'statPending') {
      const list = document.getElementById('pendingList');
      if (list && !list.querySelector('.admin-prof-card'))
        list.innerHTML = '<div class="admin-empty">Nu există cereri în așteptare.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const auth = await _waitForAuth();
    if (!auth.user) { window.location.replace('auth.html?from=admin.html'); return; }
    await _waitForProfile();

    const loading = document.getElementById('adminLoading');
    const denied  = document.getElementById('adminDenied');
    if (auth.role !== 'admin') {
      if (loading) loading.style.display = 'none';
      if (denied)  denied.style.display  = '';
      return;
    }

    await renderAdmin((await auth.supabase.auth.getSession()).data.session);
  });
})();
