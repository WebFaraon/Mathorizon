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

  async function rpc(fn, params) {
    let res;
    try { res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + ((session && session.access_token) || ''), 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(params || {}) }); }
    catch (e) { throw new Error('Nu s-a putut contacta serverul.'); }
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { const j = JSON.parse(text); msg = j.message || j.hint || text; } catch (e) { /* plain text */ }
      if (/not authorized/i.test(msg)) msg = 'Contul nu are drept de administrator în baza de date.';
      if (/Could not find the function|schema cache/i.test(msg)) msg = 'Funcția nu există încă în baza de date (migrația 20261008180000_registre_sync_teacher.sql nu a fost rulată).';
      throw new Error(msg || 'Eroare de server (cod ' + res.status + ').');
    }
    return text ? JSON.parse(text) : null;
  }
  const SA_EMAIL = 'registre-sync@mathorizon-registre.iam.gserviceaccount.com';

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
        get('reg_workbooks?select=id,spreadsheet_id,title,teacher_name,owner_user_id,school_year_from,enabled,last_synced_at,last_full_sync_at,last_status,last_error,issues&order=teacher_name.asc'),
        get('reg_groups?select=workbook_id,sheet_id,tab&limit=1000'),
        get('reg_sync_runs?select=workbook_id,started_at,detail&status=eq.partial&order=started_at.desc&limit=200')
      ]);
      const groupsBy = {};
      const sheetOf = {};                                      // workbook -> tab name -> sheet id, for the link to a cell
      groups.forEach(g => { groupsBy[g.workbook_id] = (groupsBy[g.workbook_id] || 0) + 1; (sheetOf[g.workbook_id] = sheetOf[g.workbook_id] || {})[g.tab] = g.sheet_id; });
      const skippedBy = {};                                    // the latest partial run of each register: which groups were not stored, and why
      runs.forEach(r => { if (!skippedBy[r.workbook_id]) skippedBy[r.workbook_id] = (r.detail && r.detail.skipped) || []; });
      let cmds = [];
      try { cmds = await get('reg_commands?select=id,workbook_id,type,payload,status,result,created_at&order=created_at.desc&limit=15'); } catch (e) { cmds = null; }   // null: the migration is not run yet
      C = { status: 'ready', loadedAt: new Date(), books, groupsBy, skippedBy, sheetOf, cmds };
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
          body: JSON.stringify(id ? { workbook_id: id, force: true } : {})
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

  function issuesChip(w) {
    const s = w.issues && w.issues.summary;
    if (!s || (!s.error && !s.warn)) return '';
    return `<button type="button" class="sy-issues" data-issues="${esc(w.id)}">${s.error ? `<b class="sy-bad">${plural(s.error, 'de reparat', 'de reparat')}</b>` : ''}${s.error && s.warn ? ' · ' : ''}${s.warn ? `${plural(s.warn, 'de verificat', 'de verificat')}` : ''} ${ico('arrow-right', 14)}</button>`;
  }

  /* what the checks found in one register: by kind, every item with a link to its cell */
  function openIssues(id) {
    const w = C.books.find(x => x.id === id);
    if (!w || !w.issues || !w.issues.items) return;
    const I = w.issues, byCode = {};
    I.items.forEach(i => { (byCode[i.level + ':' + i.code] = byCode[i.level + ':' + i.code] || []).push(i); });
    const cell = i => {
      const sid = C.sheetOf[w.id] && C.sheetOf[w.id][i.tab];
      const label = [i.tab, i.cell].filter(Boolean).join(' ');
      return sid != null ? `<a href="${sheetUrl(w.spreadsheet_id)}#gid=${sid}${i.cell ? '&range=' + encodeURIComponent(i.cell) : ''}" target="_blank" rel="noopener">${esc(label)}</a>` : esc(label);
    };
    const section = (level, head) => {
      const keys = Object.keys(byCode).filter(k => k.startsWith(level + ':'));
      if (!keys.length) return '';
      return `<h3 class="sy-h">${esc(head)}</h3>` + keys.map(k => {
        const items = byCode[k], code = k.split(':')[1], total = I.byCode[k] || items.length;
        return `<section class="sy-kind"><b>${esc((I.titles && I.titles[code]) || code)} <span class="ax-sub">(${nf.format(total)})</span></b><ul>${items.slice(0, 25).map(i => `<li>${cell(i)}: ${esc(i.msg)}</li>`).join('')}</ul>${total > 25 ? `<span class="ax-sub">… și încă ${nf.format(total - 25)}</span>` : ''}</section>`;
      }).join('');
    };
    U.drawer({
      title: esc(w.teacher_name || 'Registru'),
      sub: esc(`${plural(I.summary.error, 'de reparat', 'de reparat')}, ${plural(I.summary.warn, 'de verificat', 'de verificat')}. ${I.summary.info ? nf.format(I.summary.info) + ' note curățate sau presupuse de importator nu se listează.' : ''}`),
      body: `<div class="sy-issuelist">${section('error', 'De reparat în registru')}${section('warn', 'De verificat')}${I.truncated ? '<p class="ax-sub">Lista e tăiată la primele 400 de probleme.</p>' : ''}</div>`
    });
  }

  /* add a register / change which teacher account sees it */
  let profs = null;
  async function loadProfs() {
    if (profs) return profs;
    try { profs = (await rpc('get_all_professors')).filter(p => p.status === 'active'); } catch (e) { profs = []; }
    return profs;
  }
  async function openSettings(id) {
    const w = id ? C.books.find(x => x.id === id) : null;
    const list = await loadProfs();
    const d = U.drawer({
      title: w ? 'Setările registrului' : 'Adaugă un registru',
      sub: w ? esc(w.title || w.spreadsheet_id) : 'Un registru Google Sheets al unui profesor.',
      body: `<form class="sy-form" id="syForm">
        ${w ? '' : `<p class="sy-step"><b>Întâi:</b> în Google, partajează registrul cu <code>${esc(SA_EMAIL)}</code> ca <b>Cititor</b>. Fără asta platforma nu îl poate citi.</p>
        <label class="sy-f"><span>Link-ul sau id-ul registrului Google</span><input class="ax-input" name="sheet" required placeholder="https://docs.google.com/spreadsheets/d/…" autocomplete="off"></label>`}
        <label class="sy-f"><span>Profesor <em>(opțional, se completează din numele fișierului)</em></span><input class="ax-input" name="teacher" value="${esc((w && w.teacher_name) || '')}" placeholder="Nume Prenume" autocomplete="off"></label>
        <label class="sy-f"><span>Contul de profesor care îl vede <em>(opțional)</em></span>
          <select class="ax-select" name="owner"><option value="">Doar adminul</option>${list.map(p => `<option value="${esc(p.user_id)}"${w && w.owner_user_id === p.user_id ? ' selected' : ''}>${esc(p.full_name || p.email)} · ${esc(p.email || '')}</option>`).join('')}</select></label>
        <label class="sy-f"><span>Anul școlar începe în <em>(dacă nu se vede în numele fișierului)</em></span><input class="ax-input" name="year" inputmode="numeric" maxlength="4" value="${w && w.school_year_from ? esc(w.school_year_from) : ''}" placeholder="2025"></label>
        ${w ? `<label class="sy-f sy-check"><input type="checkbox" name="enabled"${w.enabled ? ' checked' : ''}> <span>Registrul se sincronizează</span></label>` : ''}
        <p class="sy-err" id="syErr" role="alert"></p>
      </form>`,
      actions: `<button type="button" class="ax-btn" data-close>Renunță</button><button type="submit" form="syForm" class="ax-btn ax-btn--dark" id="syGo">${w ? 'Salvează' : 'Adaugă și sincronizează'}</button>`
    });
    d.querySelector('#syForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = new FormData(ev.target), go = d.querySelector('#syGo'), err = d.querySelector('#syErr');
      const year = String(f.get('year') || '').trim();
      if (year && !/^20\d\d$/.test(year)) { err.textContent = 'Anul trebuie să aibă 4 cifre, de exemplu 2025.'; return; }
      go.disabled = true; err.textContent = '';
      try {
        let rid = id;
        if (!w) rid = await rpc('reg_add_workbook', { p_spreadsheet: String(f.get('sheet')), p_teacher: String(f.get('teacher') || '') || null, p_owner: f.get('owner') || null, p_year: year ? +year : null });
        else {
          await rpc('reg_add_workbook', { p_spreadsheet: w.spreadsheet_id, p_teacher: String(f.get('teacher') || '') || null, p_owner: f.get('owner') || null, p_year: year ? +year : null });
          await rpc('reg_update_workbook', { p_id: w.id, p_enabled: !!f.get('enabled'), p_clear_owner: !f.get('owner') });
        }
        d.close();
        U.toast(w ? 'Setările au fost salvate.' : 'Registrul a fost adăugat. Se citește acum…');
        await load();
        if (!w) syncNow(rid);
      } catch (e) { err.textContent = niceError(e); go.disabled = false; }
    });
  }

  function tableHTML() {
    if (!C.books.length) return '<div class="ax-panel ax-empty cn-empty"><b>Niciun registru înregistrat.</b>Registrele se adaugă în tabelul reg_workbooks (id-ul fișierului Google).</div>';
    return `<div class="ax-table-wrap"><table class="ax-table cn-table sy-table">
      <thead><tr><th>Registru</th><th>Status</th><th>Verificat</th><th>Citit complet</th><th class="ax-num">Grupe</th><th><span class="cn-vh">Acțiuni</span></th></tr></thead>
      <tbody>${C.books.map((w, i) => {
        const st = ST[statusOf(w)], skipped = w.last_status === 'partial' ? (C.skippedBy[w.id] || []) : [];
        const hint = /403|404|permission|not found/i.test(w.last_error || '') ? `. Verifică dacă registrul e partajat cu ${esc(SA_EMAIL)} (Cititor).` : '';
        const note = w.last_status === 'failed' && w.last_error ? `<span class="sy-note sy-note--err">${esc(w.last_error)}${hint}</span>`
          : skipped.length ? `<span class="sy-note">${skipped.map(s => `<b>${esc(s.tab)}</b>: ${esc(s.reason)}`).join('<br>')}</span>` : '';
        const busy = syncing === w.id;
        return `<tr data-arrive style="--i:${i}">
          <td><b class="ax-strong">${esc(w.teacher_name || 'Registru')}</b><span class="ax-sub">${esc(w.title || w.spreadsheet_id)}</span>${note}${issuesChip(w)}</td>
          <td data-l="Status"><span class="ax-st ax-st--${st.cls}"><i class="ax-st__i"></i>${esc(st.name)}</span>${w.enabled ? '' : '<span class="ax-sub">oprit</span>'}</td>
          <td class="cn-nowrap" data-l="Verificat">${esc(ago(w.last_synced_at))}</td>
          <td class="cn-nowrap" data-l="Citit complet">${esc(ago(w.last_full_sync_at))}</td>
          <td class="ax-num" data-l="Grupe">${nf.format(C.groupsBy[w.id] || 0)}</td>
          <td><div class="sy-keys">
            <button type="button" class="ax-btn ax-btn--sm" data-sync="${esc(w.id)}"${syncing ? ' disabled' : ''}>${ico('refresh-cw', 16)} ${busy ? 'Se citește…' : 'Sincronizează'}</button>
            <a class="ax-btn ax-btn--sm" href="${sheetUrl(w.spreadsheet_id)}" target="_blank" rel="noopener">${ico('book-open', 16)} Deschide</a>
            <button type="button" class="ax-btn ax-btn--sm" data-set="${esc(w.id)}">${ico('settings', 16)} Setări</button>
          </div></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }

  const CMD = { ADD_STUDENT: 'Elev adăugat', SET_STATUS: 'Statut schimbat', SET_MANAGER: 'Manager schimbat', ADD_PAYMENT: 'Plată adăugată', ADD_DISCOUNT: 'Reducere adăugată' };
  const CST = { pending: ['inlocuire', 'În așteptare'], running: ['inlocuire', 'Se scrie'], done: ['activ', 'Scris'], noop: ['activ', 'Era deja așa'], invalid: ['inactiv sy-bad', 'Refuzat'], conflict: ['completare', 'Conflict'], failed: ['inactiv sy-bad', 'Eroare'] };
  function commandsHTML() {
    if (!C.cmds || !C.cmds.length) return '';
    const name = id => { const w = C.books.find(x => x.id === id); return w ? (w.teacher_name || 'Registru') : 'Registru'; };
    return `<h2 class="sy-h2">Scrieri recente în registre</h2>
      <div class="ax-table-wrap"><table class="ax-table cn-table sy-table">
        <thead><tr><th>Când</th><th>Registru</th><th>Ce</th><th>Status</th></tr></thead>
        <tbody>${C.cmds.map(c => {
          const st = CST[c.status] || ['inactiv', c.status], who = (c.payload && (c.payload.name || (c.payload.student && c.payload.student.name))) || '';
          const r = c.result || {};
          const detail = r.msg ? `<span class="sy-note${c.status === 'failed' || c.status === 'invalid' ? ' sy-note--err' : ''}">${esc(r.msg)}</span>` : (r.column ? `<span class="ax-sub">coloana ${esc(r.column)}</span>` : '');
          return `<tr><td class="cn-nowrap">${esc(ago(c.created_at))}</td><td>${esc(name(c.workbook_id))}</td><td><b class="ax-strong">${esc(CMD[c.type] || c.type)}</b>${who ? `<span class="ax-sub">${esc(who)}</span>` : ''}</td><td><span class="ax-st ax-st--${st[0]}"><i class="ax-st__i"></i>${esc(st[1])}</span>${detail}</td></tr>`;
        }).join('')}</tbody>
      </table></div>`;
  }

  function bodyHTML() {
    if (C.status === 'loading' || C.status === 'idle') return loadingHTML();
    if (C.status === 'error') return errorHTML(C.error);
    return tableHTML() + commandsHTML();
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
    box.querySelectorAll('[data-issues]').forEach(b => b.addEventListener('click', () => openIssues(b.dataset.issues)));
    box.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => openSettings(b.dataset.set)));
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
            <button type="button" class="ax-btn" id="syAdd">${ico('plus', 16)} Adaugă registru</button>
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
      root.querySelector('#syAdd').addEventListener('click', () => { if (C.status === 'ready') openSettings(null); });
      root.querySelector('#syReload').addEventListener('click', load);
      if (C.status === 'idle') load(); else paint();
    }
  };
})();
