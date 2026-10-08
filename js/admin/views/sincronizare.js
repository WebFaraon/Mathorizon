/* ============================================================
   Admin console: Sincronizare (the Google Sheets registers read into the platform)
   ============================================================
   Real data, like Conturi: for every register, when it was last checked and read, how many groups it has, and what went wrong
   (a failed run with its message, or groups that were not stored and why). "Sincronizează acum" calls the registru-sync
   edge function with the admin's own token (the function checks role = 'admin' itself).

   Data: GET /rest/v1/reg_workbooks, reg_groups, reg_sync_runs (RLS: admins see all), POST /functions/v1/registru-sync.
   URL: #sincronizare
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI;
  const { esc, ico, nf, plural } = U;

  const SUPABASE_URL = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  const ST = {
    ok: { cls: 'activ', name: 'La zi' },
    partial: { cls: 'completare', name: 'Cu grupe oprite' },
    failed: { cls: 'inactiv sy-bad', name: 'Eroare' },
    never: { cls: 'inlocuire', name: 'Încă necitit' }
  };

  let C = { status: 'idle' };
  let session = null, mount = null, syncing = null;          // syncing: null | 'all' | workbook id

  function niceError(e) {
    const m = String((e && e.message) || e || '');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Nu s-a putut contacta serverul.';
    return m.length > 260 ? m.slice(0, 260) + '…' : m;
  }
  async function get(path) {
    let res;
    try { res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + ((session && session.access_token) || ''), Accept: 'application/json' } }); }
    catch (e) { throw new Error('Nu s-a putut contacta serverul.'); }
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { const j = JSON.parse(text); msg = j.message || j.hint || text; } catch (e) { /* plain text */ }
      if (/relation .* does not exist|schema cache/i.test(msg)) msg = 'Tabelele registrelor nu există încă în baza de date (migrația 20261008120000_registre_sync.sql nu a fost rulată).';
      throw new Error(msg || 'Eroare de server (cod ' + res.status + ').');
    }
    return text ? JSON.parse(text) : [];
  }

  /* ---------- formatting ---------- */
  function ago(iso) {
    if (!iso) return 'niciodată';
    const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
    if (s < 45) return 'acum câteva secunde';
    if (s < 3600) return 'acum ' + plural(Math.round(s / 60), 'minut', 'minute');
    if (s < 86400) return 'acum ' + plural(Math.round(s / 3600), 'oră', 'ore');
    return 'acum ' + plural(Math.round(s / 86400), 'zi', 'zile');
  }
  const sheetUrl = id => 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(id) + '/edit';
  const statusOf = w => (w.last_status && ST[w.last_status] ? w.last_status : 'never');

  /* ---------- load ---------- */
  async function load() {
    C = { status: 'loading' };
    paint();
    try {
      const s = await mount.ctx.auth.supabase.auth.getSession();
      session = s && s.data ? s.data.session : null;
    } catch (e) { session = null; }
    if (!session) { C = { status: 'error', error: 'Nu există o sesiune activă. Deconectează-te și intră din nou în cont.' }; paint(); return; }
    try {
      const [books, groups, runs] = await Promise.all([
        get('reg_workbooks?select=id,spreadsheet_id,title,teacher_name,enabled,last_synced_at,last_full_sync_at,last_status,last_error&order=teacher_name.asc'),
        get('reg_groups?select=workbook_id&limit=1000'),
        get('reg_sync_runs?select=workbook_id,started_at,detail&status=eq.partial&order=started_at.desc&limit=200')
      ]);
      const groupsBy = {};
      groups.forEach(g => { groupsBy[g.workbook_id] = (groupsBy[g.workbook_id] || 0) + 1; });
      const skippedBy = {};                                    // the latest partial run of each register: which groups were not stored, and why
      runs.forEach(r => { if (!skippedBy[r.workbook_id]) skippedBy[r.workbook_id] = (r.detail && r.detail.skipped) || []; });
      C = { status: 'ready', loadedAt: new Date(), books, groupsBy, skippedBy };
    } catch (e) { C = { status: 'error', error: niceError(e) }; }
    paint();
    if (window.AdminShell) window.AdminShell.refreshNav();
  }

  /* ---------- sync now ---------- */
  async function syncNow(id) {
    if (syncing) return;
    syncing = id || 'all';
    paint();
    try {
      let res;
      try {
        res = await fetch(`${SUPABASE_URL}/functions/v1/registru-sync`, {
          method: 'POST',
          headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + ((session && session.access_token) || ''), 'Content-Type': 'application/json' },
          body: JSON.stringify(id ? { workbook_id: id } : {})
        });
      } catch (e) { throw new Error('Nu s-a putut contacta funcția de sincronizare (nu e pusă în funcțiune sau nu răspunde).'); }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 401 ? 'Contul nu are drept de administrator pentru sincronizare.' : (body.error || 'Eroare de server (cod ' + res.status + ').'));
      const r = body.results || [];
      const read = r.filter(x => x.status === 'ok' || x.status === 'partial').length;
      const failed = r.filter(x => x.status === 'failed').length;
      const deferred = r.filter(x => x.status === 'deferred').length;
      U.toast(`${plural(r.length, 'registru verificat', 'registre verificate')}, ${plural(read, 'citit', 'citite')}${failed ? `, ${plural(failed, 'cu eroare', 'cu erori')}` : ''}${deferred ? `, ${deferred} amânate (limita Google)` : ''}.`, failed ? 'warn' : undefined);
    } catch (e) {
      U.toast(`Sincronizarea nu a pornit: ${esc(niceError(e))}`, 'warn');
    } finally {
      syncing = null;
    }
    await load();
  }

  /* ---------- markup ---------- */
  function statsHTML() {
    const ready = C.status === 'ready', B = ready ? C.books : [];
    const bad = B.filter(w => w.last_status === 'failed').length;
    const stopped = ready ? Object.keys(C.skippedBy).reduce((n, id) => n + ((B.find(w => w.id === id) || {}).last_status === 'partial' ? C.skippedBy[id].length : 0), 0) : 0;
    const last = B.reduce((m, w) => (w.last_synced_at && (!m || w.last_synced_at > m) ? w.last_synced_at : m), null);
    const v = x => (C.status === 'loading' ? '<span class="cn-dots" aria-label="se încarcă">···</span>' : ready ? x : '<span class="cn-na">n/d</span>');
    const items = [
      { k: 'Registre', v: v(nf.format(B.length)), s: ready ? plural(B.filter(w => w.enabled).length, 'activ', 'active') : '', icon: 'book-open' },
      { k: 'Ultima verificare', v: v(ago(last)), s: 'din orice registru', icon: 'clock', small: true },
      { k: 'Cu eroare', v: v(nf.format(bad)), s: bad ? 'Vezi mesajul din tabel' : 'Totul e în regulă', icon: 'alert', warn: bad > 0 },
      { k: 'Grupe oprite', v: v(nf.format(stopped)), s: stopped ? 'Nu s-au salvat, rămâne copia veche' : 'Nicio grupă oprită', icon: 'x', warn: stopped > 0 }
    ];
    return items.map((it, i) => `
      <div class="ax-stat cn-stat${it.warn ? ' is-warn' : ''}" data-arrive style="--i:${i}">
        <span class="ax-stat__k">${ico(it.icon, 16)} ${esc(it.k)}</span>
        <span class="ax-stat__v${it.small ? ' sy-small' : ''}">${it.v}</span>
        <span class="ax-stat__s">${esc(it.s)}</span>
      </div>`).join('');
  }

  const loadingHTML = () => '<div class="ax-panel cn-state" role="status"><b>Se încarcă starea sincronizării…</b><span>Citesc registrele și ultimele rulări din Supabase.</span></div>';
  const errorHTML = msg => `<div class="ax-panel cn-state cn-state--err" role="alert">
      <span class="cn-state__sign" aria-hidden="true">${ico('alert', 20)}</span>
      <b>Nu am putut încărca: ${esc(msg)}</b>
      <span>Datele vin direct din baza de date reală. Verifică conexiunea și sesiunea, apoi încearcă din nou.</span>
      <button type="button" class="ax-btn ax-btn--dark ax-btn--sm" data-reload>${ico('refresh-cw', 16)} Reîncarcă</button>
    </div>`;

  function tableHTML() {
    if (!C.books.length) return '<div class="ax-panel ax-empty cn-empty"><b>Niciun registru înregistrat.</b>Registrele se adaugă în tabelul reg_workbooks (id-ul fișierului Google).</div>';
    return `<div class="ax-table-wrap"><table class="ax-table cn-table sy-table">
      <thead><tr><th>Registru</th><th>Status</th><th>Verificat</th><th>Citit complet</th><th class="ax-num">Grupe</th><th><span class="cn-vh">Acțiuni</span></th></tr></thead>
      <tbody>${C.books.map((w, i) => {
        const st = ST[statusOf(w)], skipped = w.last_status === 'partial' ? (C.skippedBy[w.id] || []) : [];
        const note = w.last_status === 'failed' && w.last_error ? `<span class="sy-note sy-note--err">${esc(w.last_error)}</span>`
          : skipped.length ? `<span class="sy-note">${skipped.map(s => `<b>${esc(s.tab)}</b>: ${esc(s.reason)}`).join('<br>')}</span>` : '';
        const busy = syncing === w.id;
        return `<tr data-arrive style="--i:${i}">
          <td><b class="ax-strong">${esc(w.teacher_name || 'Registru')}</b><span class="ax-sub">${esc(w.title || w.spreadsheet_id)}</span>${note}</td>
          <td data-l="Status"><span class="ax-st ax-st--${st.cls}"><i class="ax-st__i"></i>${esc(st.name)}</span>${w.enabled ? '' : '<span class="ax-sub">oprit</span>'}</td>
          <td class="cn-nowrap" data-l="Verificat">${esc(ago(w.last_synced_at))}</td>
          <td class="cn-nowrap" data-l="Citit complet">${esc(ago(w.last_full_sync_at))}</td>
          <td class="ax-num" data-l="Grupe">${nf.format(C.groupsBy[w.id] || 0)}</td>
          <td><div class="sy-keys">
            <button type="button" class="ax-btn ax-btn--sm" data-sync="${esc(w.id)}"${syncing ? ' disabled' : ''}>${ico('refresh-cw', 16)} ${busy ? 'Se citește…' : 'Sincronizează'}</button>
            <a class="ax-btn ax-btn--sm" href="${sheetUrl(w.spreadsheet_id)}" target="_blank" rel="noopener">${ico('book-open', 16)} Deschide</a>
          </div></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }

  function bodyHTML() {
    if (C.status === 'loading' || C.status === 'idle') return loadingHTML();
    if (C.status === 'error') return errorHTML(C.error);
    return tableHTML();
  }

  /* ---------- paint + wiring ---------- */
  const visible = () => mount && mount.root.isConnected && location.hash.slice(1).split('?')[0] === 'sincronizare';
  function paint() {
    if (!visible()) return;
    const r = mount.root;
    r.querySelector('#syStats').innerHTML = statsHTML();
    r.querySelector('#syStamp').textContent = C.status === 'ready' ? 'Încărcat la ' + C.loadedAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '';
    const all = r.querySelector('#syAll'), reload = r.querySelector('#syReload');
    all.disabled = !!syncing || C.status !== 'ready';
    all.innerHTML = `${ico('refresh-cw', 16)} ${syncing === 'all' ? 'Se sincronizează…' : 'Sincronizează acum'}`;
    reload.disabled = C.status === 'loading' || !!syncing;
    const box = r.querySelector('#syBody');
    box.innerHTML = bodyHTML();
    box.querySelectorAll('[data-reload]').forEach(b => b.addEventListener('click', load));
    box.querySelectorAll('[data-sync]').forEach(b => b.addEventListener('click', () => syncNow(b.dataset.sync)));
  }

  window.AdminViews.sincronizare = {
    title: 'Sincronizare',
    demo: false,
    icon: 'refresh-cw',
    badge: () => (C.status === 'ready' ? C.books.filter(w => w.last_status === 'failed').length || null : null),
    render(root, ctx) {
      mount = { root, ctx };
      root.innerHTML = `
        <header class="ax-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('refresh-cw', 24)}</span>
            <div>
              <h1 class="ax-h1">Sincronizare <span class="cn-real" title="Starea sincronizării vine din baza de date reală. Conținutul registrelor de acum este demo.">Stare reală</span></h1>
              <p class="ax-lede">Registrele Google Sheets citite în platformă: când au fost verificate, ce s-a citit și ce nu a mers.</p>
            </div>
          </div>
          <div class="ax-head__keys">
            <button type="button" class="ax-btn ax-btn--primary" id="syAll">${ico('refresh-cw', 16)} Sincronizează acum</button>
          </div>
        </header>
        <section class="ax-stats cn-stats" id="syStats" aria-label="Pe scurt"></section>
        <div class="cn-bar">
          <span class="cn-stamp ax-sub" id="syStamp"></span>
          <button type="button" class="ax-btn ax-btn--sm" id="syReload">${ico('refresh-cw', 16)} Reîncarcă</button>
        </div>
        <div id="syBody" aria-live="polite"></div>`;
      root.querySelector('#syAll').addEventListener('click', () => syncNow(null));
      root.querySelector('#syReload').addEventListener('click', load);
      if (C.status === 'idle') load(); else paint();
    }
  };
})();
