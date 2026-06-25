/* ============================================================
   Mathorizon — Admin Page (admin.html)
   ============================================================ */

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

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

  async function renderAdmin(session) {
    const loading = document.getElementById('adminLoading');
    const denied  = document.getElementById('adminDenied');
    const wrap    = document.getElementById('adminWrap');
    if (loading) loading.style.display = 'none';

    let pending = [], allProfs = [];
    try {
      pending  = await _rpc('get_pending_professors', {}, session) || [];
      allProfs = await _rpc('get_all_professors', {}, session) || [];
    } catch (e) {
      console.error('[Admin] RPC error:', e.message);
      if (denied) denied.style.display = '';
      return;
    }

    if (wrap) wrap.style.display = '';

    /* Stats */
    const approved = allProfs.filter(p => p.status === 'active').length;
    const rejected = allProfs.filter(p => p.status === 'rejected').length;
    const statPending  = document.getElementById('statPending');
    const statApproved = document.getElementById('statApproved');
    const statRejected = document.getElementById('statRejected');
    if (statPending)  statPending.textContent  = pending.length;
    if (statApproved) statApproved.textContent = approved;
    if (statRejected) statRejected.textContent = rejected;

    /* Pending list */
    const pendingEl = document.getElementById('pendingList');
    if (pendingEl) {
      if (!pending.length) {
        pendingEl.innerHTML = '<div class="admin-empty">Nu există cereri în așteptare.</div>';
      } else {
        pendingEl.innerHTML = pending.map(p => `
          <div class="admin-prof-card" id="pcard-${p.user_id}">
            <div class="admin-prof-avatar">${_initials(p.full_name)}</div>
            <div class="admin-prof-info">
              <div class="admin-prof-name">${BM.esc(p.full_name || '—')}</div>
              <div class="admin-prof-email">${BM.esc(p.email || '—')}</div>
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
    }

    /* All professors list */
    const allEl = document.getElementById('allProfList');
    if (allEl) {
      if (!allProfs.length) {
        allEl.innerHTML = '<div class="admin-empty">Nu există conturi de profesor.</div>';
      } else {
        allEl.innerHTML = `<div class="admin-approved-list">${
          allProfs.map(p => `
            <div class="admin-approved-row">
              <span class="admin-approved-name">${BM.esc(p.full_name || '—')}</span>
              <span style="color:var(--text-muted);font-size:0.82rem">${BM.esc(p.email || '')}</span>
              <span class="admin-approved-badge admin-approved-badge--${p.status === 'active' ? 'active' : p.status === 'pending' ? 'pending' : 'rejected'}">
                ${p.status === 'active' ? 'Aprobat' : p.status === 'pending' ? 'În așteptare' : 'Respins'}
              </span>
            </div>`).join('')
        }</div>`;
      }
    }

    window._adminSession = session;
  }

  window.approveProf = async function(userId) {
    const btn = document.querySelector(`#pcard-${userId} .btn`);
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      await _rpc('set_professor_status', { target_user_id: userId, new_status: 'active' }, window._adminSession);
      const card = document.getElementById(`pcard-${userId}`);
      if (card) {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
        setTimeout(() => { card.remove(); _updatePendingCount(-1); _updateApprovedCount(1); }, 300);
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
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
        setTimeout(() => { card.remove(); _updatePendingCount(-1); _updateRejectedCount(1); }, 300);
      }
      BM.toast('Cerere respinsă.', 'success');
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
    }
  };

  function _updatePendingCount(delta) {
    const el = document.getElementById('statPending');
    if (el) el.textContent = Math.max(0, parseInt(el.textContent || '0') + delta);
    const list = document.getElementById('pendingList');
    if (list && !list.querySelector('.admin-prof-card')) {
      list.innerHTML = '<div class="admin-empty">Nu există cereri în așteptare.</div>';
    }
  }
  function _updateApprovedCount(delta) {
    const el = document.getElementById('statApproved');
    if (el) el.textContent = Math.max(0, parseInt(el.textContent || '0') + delta);
  }
  function _updateRejectedCount(delta) {
    const el = document.getElementById('statRejected');
    if (el) el.textContent = Math.max(0, parseInt(el.textContent || '0') + delta);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const auth = await _waitForAuth();
    if (!auth.user) {
      window.location.replace('auth.html?from=admin.html');
      return;
    }
    await _waitForProfile();

    const loading = document.getElementById('adminLoading');
    const denied  = document.getElementById('adminDenied');

    if (auth.role !== 'admin') {
      if (loading) loading.style.display = 'none';
      if (denied)  denied.style.display  = '';
      return;
    }

    await renderAdmin(auth.supabase.auth.getSession().then ? (await auth.supabase.auth.getSession()).data.session : null);
  });
})();
