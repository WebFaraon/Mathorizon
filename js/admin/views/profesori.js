/* ============================================================
   Admin console: Conturi (real accounts)
   ============================================================
   The page of the console that reads REAL accounts: teacher sign-up requests (approve / reject), the teachers with what their
   registers say about them (groups, students per lesson, lessons taught, income), removing a teacher, and the landing-page waitlist.
   The students' accounts are not listed here: a student's sheet in Elevi shows whether he has an account (js/admin/accounts.js).

   Data: Supabase RPCs (POST /rest/v1/rpc/<fn>, apikey + the admin's Bearer token), each one checks role = 'admin' in the database:
     admin_pending_accounts (teachers and managers; get_pending_professors as a fallback), admin_set_account_status (with the official name; set_professor_status as a fallback),
     admin_set_official_name, the function registru-config (the managers list of the registers),
     admin_professor_overview (get_all_professors as a fallback), admin_remove_professor, admin_manager_overview, admin_remove_manager
   the registers' numbers come from window.AdminData (the Registre source of the console) and the waitlist through GET /api/admin/get-waitlist.

   Loaded once per visit and kept in a module cache; "Reincarca" fetches again. URL: #profesori?tab=cereri|profesori|manageri|waitlist&q=
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico, nf, plural } = U;

  // Same project and public anon key as js/auth.js and the old admin page.
  const SUPABASE_URL = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  const TABS = [
    { id: 'cereri', label: 'Cereri' },
    { id: 'profesori', label: 'Profesori' },
    { id: 'manageri', label: 'Manageri' },
    { id: 'waitlist', label: 'Waitlist' }
  ];
  const PROF_ST = {
    active: { cls: 'activ', name: 'Aprobat' },
    pending: { cls: 'completare', name: 'În așteptare' },
    rejected: { cls: 'inactiv', name: 'Respins' }
  };
  const CAP = 60;

  /* ---------- module cache ---------- */
  // status: idle | loading | ready | error
  let C = { status: 'idle' };
  let session = null;
  let mount = null;     // { root, ctx } of the visible render
  let tab = 'cereri', query = '', shown = CAP, sort = { profesori: 'name' };

  /* ---------- network ---------- */
  function niceError(e) {
    const m = String((e && e.message) || e || '');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Nu s-a putut contacta serverul.';
    return m.length > 220 ? m.slice(0, 220) + '…' : m;
  }
  async function rpc(fn, params) {
    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: 'Bearer ' + ((session && session.access_token) || ''),
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(params || {})
      });
    } catch (e) { throw new Error('Nu s-a putut contacta serverul.'); }
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { const j = JSON.parse(text); msg = j.message || j.error || j.hint || text; } catch (e) { /* plain text */ }
      if (/not authorized/i.test(msg)) msg = 'Contul nu are drept de administrator în baza de date.';
      throw new Error(msg || 'Eroare de server (cod ' + res.status + ').');
    }
    return text ? JSON.parse(text) : [];
  }

  async function loadWaitlist() {
    C.wait = { status: 'loading', rows: [] };
    try {
      let res;
      try {
        res = await fetch('/api/admin/get-waitlist', { headers: { Authorization: 'Bearer ' + ((session && session.access_token) || '') } });
      } catch (e) { throw new Error('Nu s-a putut contacta serverul.'); }
      const body = await res.text().catch(() => '');
      let data = {};
      try { data = body ? JSON.parse(body) : {}; } catch (e) { /* html 404 page */ }
      if (!res.ok) {
        if (res.status === 404) throw new Error('Serverul local nu are rutele /api active (în producție lista se încarcă).');
        throw new Error(data.error || 'Eroare de server (cod ' + res.status + ').');
      }
      C.wait = { status: 'ready', rows: Array.isArray(data.rows) ? data.rows : [] };
    } catch (e) {
      C.wait = { status: 'error', rows: [], error: niceError(e) };
    }
  }

  async function load() {
    C = { status: 'loading', wait: { status: 'loading', rows: [] } };
    paint();
    try {
      const s = await mount.ctx.auth.supabase.auth.getSession();
      session = s && s.data ? s.data.session : null;
    } catch (e) { session = null; }
    if (!session) {
      C = { status: 'error', error: 'Nu există o sesiune activă. Deconectează-te și intră din nou în cont.', wait: { status: 'error', rows: [], error: 'Fără sesiune.' } };
      paint();
      return;
    }
    const waitP = loadWaitlist();
    const [pend0, over, mg] = await Promise.allSettled([rpc('admin_pending_accounts'), rpc('admin_professor_overview'), rpc('admin_manager_overview')]);
    let pend = pend0;
    if (pend.status === 'rejected') {                 // the newest migration is not run yet: the teachers' requests only
      try { pend = { status: 'fulfilled', value: (await rpc('get_pending_professors')).map(r => Object.assign({ role: 'profesor' }, r)) }; } catch (e) { pend = { status: 'rejected', reason: e }; }
    }
    let profs = over.status === 'fulfilled' && Array.isArray(over.value) ? over.value : null, plain = false;
    let profErr = over.status === 'rejected' ? over.reason : null;
    if (!profs) {                                   // the same: the list without photos and numbers
      try { profs = await rpc('get_all_professors'); plain = true; profErr = null; } catch (e) { profErr = e; }
    }
    const failed = [];
    if (pend.status === 'rejected') failed.push({ fn: 'get_pending_professors', msg: niceError(pend.reason) });
    if (!profs) failed.push({ fn: 'get_all_professors', msg: niceError(profErr) });
    if (mg.status === 'rejected') failed.push({ fn: 'admin_manager_overview', msg: /does not exist|schema cache|Could not find/i.test(String(mg.reason && mg.reason.message)) ? 'Rulează migrarea 20261101100000_rol_manager.sql.' : niceError(mg.reason) });
    if (pend.status === 'rejected' && !profs) {
      C = { status: 'error', error: failed[0].msg, wait: C.wait };
      paint();
      await waitP; paint();
      return;
    }
    C = {
      status: 'ready',
      loadedAt: new Date(),
      failed,
      pending: pend.status === 'fulfilled' && Array.isArray(pend.value) ? pend.value : [],
      profs: profs || [],
      mgrs: mg.status === 'fulfilled' && Array.isArray(mg.value) ? mg.value : [],
      plain,
      wait: C.wait
    };
    paint();
    if (window.AdminShell) window.AdminShell.refreshNav();
    await waitP;
    paint();
  }

  /* ---------- formatting ---------- */
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  function initials(name) {
    const p = String(name || '').trim().split(/\s+/).filter(Boolean);
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (String(name || '?').slice(0, 2).toUpperCase() || '?');
  }
  const match = (...fields) => { const q = query.trim().toLowerCase(); return !q || fields.some(f => String(f || '').toLowerCase().includes(q)); };

  /* ---------- counts ---------- */
  const bad = fn => C.status === 'ready' && C.failed.find(f => f.fn === fn);
  // a tab whose own RPC failed shows the error instead of a misleading "nothing here"
  const TAB_FN = { cereri: 'get_pending_professors', profesori: 'get_all_professors', manageri: 'admin_manager_overview' };
  function counts() {
    if (C.status !== 'ready') return null;
    return {
      pending: bad('get_pending_professors') ? null : C.pending.length,
      approved: bad('get_all_professors') ? null : C.profs.filter(p => p.status === 'active').length,
      managers: bad('admin_manager_overview') ? null : C.mgrs.filter(p => p.status === 'active').length,
      rejected: bad('get_all_professors') ? null : C.profs.filter(p => p.status === 'rejected').length + C.mgrs.filter(p => p.status === 'rejected').length,
      wait9: C.wait.status === 'ready' ? C.wait.rows.filter(r => String(r.clasa) === '9').length : null,
      wait: C.wait.status === 'ready' ? C.wait.rows.length : null
    };
  }

  /* ---------- markup ---------- */
  function statsHTML() {
    const n = counts();
    const v = x => (C.status === 'loading' ? '<span class="cn-dots" aria-label="se încarcă">···</span>' : x == null ? '<span class="cn-na">n/d</span>' : nf.format(x));
    const wSub = C.wait && C.wait.status === 'error' ? 'Lista nu s-a putut încărca' : (n && n.wait != null ? `din ${plural(n.wait, 'înscriere', 'înscrieri')}` : 'Lista de pe pagina principală');
    const items = [
      { k: 'Cereri în așteptare', v: n && n.pending, s: 'Profesori și manageri de aprobat', tab: 'cereri', warn: n && n.pending > 0, icon: 'clock' },
      { k: 'Profesori aprobați', v: n && n.approved, s: 'Conturi active', tab: 'profesori', icon: 'check' },
      { k: 'Manageri aprobați', v: n && n.managers, s: 'Conturi active', tab: 'manageri', icon: 'user' },
      { k: 'Cereri respinse', v: n && n.rejected, s: 'Fără acces', tab: 'cereri', icon: 'x' },
      { k: 'Waitlist clasa a 9-a', v: n && n.wait9, s: wSub, tab: 'waitlist', icon: 'mail' }
    ];
    return items.map((it, i) => `
      <button type="button" class="ax-stat cn-stat${it.warn ? ' is-warn' : ''}" data-tab="${it.tab}" data-arrive style="--i:${i}">
        <span class="ax-stat__k">${ico(it.icon, 16)} ${esc(it.k)}</span>
        <span class="ax-stat__v">${v(it.v)}</span>
        <span class="ax-stat__s">${esc(it.s)}</span>
      </button>`).join('');
  }

  function tabCount(id) {
    if (C.status !== 'ready') return '';
    if (bad(TAB_FN[id])) return '';
    const n = id === 'cereri' ? C.pending.length : id === 'profesori' ? C.profs.length : id === 'manageri' ? C.mgrs.length : (C.wait.status === 'ready' ? C.wait.rows.length : null);
    return n == null ? '' : `<span class="ax-seg__n">${nf.format(n)}</span>`;
  }

  function loadingHTML() {
    return `<div class="ax-panel cn-state" role="status"><b>Se încarcă conturile…</b></div>`;
  }
  function errorHTML(msg, title) {
    return `<div class="ax-panel cn-state cn-state--err" role="alert">
      <span class="cn-state__sign" aria-hidden="true">${ico('alert', 20)}</span>
      <b>${esc(title || 'Nu am putut încărca')}: ${esc(msg)}</b>
      <button type="button" class="ax-btn ax-btn--dark ax-btn--sm" data-reload>${ico('refresh-cw', 16)} Reîncarcă</button>
    </div>`;
  }
  const emptyHTML = (title, sub) => `<div class="ax-panel ax-empty cn-empty"><b>${esc(title)}</b>${esc(sub || '')}</div>`;
  const noMatch = () => emptyHTML(`Nimic pentru „${query.trim()}”.`, 'Caută după nume sau e-mail.');

  function moreHTML(total) {
    return total > shown ? `<div class="cn-more"><button type="button" class="ax-btn ax-btn--sm" data-more>Arată încă ${nf.format(Math.min(CAP, total - shown))}</button><span class="ax-sub">${nf.format(shown)} din ${nf.format(total)}</span></div>` : '';
  }

  function pendingHTML() {
    if (!C.pending.length) return emptyHTML('Nu există cereri în așteptare.', 'Cererile de profesor și de manager apar aici.');
    const list = C.pending.filter(p => match(p.full_name, p.email));
    if (!list.length) return noMatch();
    return `<ul class="cn-req">
      ${list.map((p, i) => `
        <li class="cn-req__row" data-uid="${esc(p.user_id)}" data-arrive style="--i:${i}">
          <span class="cn-ini" aria-hidden="true">${esc(initials(p.full_name))}</span>
          <span class="cn-req__who"><b>${esc(p.full_name || 'Fără nume')}</b> <span class="cn-role">${p.role === 'manager' ? 'Manager' : 'Profesor'}</span><span class="ax-sub">${esc(p.email || '')}</span></span>
          <label class="cn-req__name"><span class="ax-sub">Nume oficial (Nume Prenume)</span><input class="ax-input" data-name="${esc(p.user_id)}" value="${esc(p.full_name || '')}" autocomplete="off" maxlength="80"></label>
          <span class="cn-req__when"><span class="ax-sub">Cerere trimisă</span><b>${esc(fmtDate(p.created_at)) || 'necunoscut'}</b></span>
          <span class="cn-req__keys">
            <button type="button" class="ax-btn ax-btn--primary ax-btn--sm cn-approve" data-approve="${esc(p.user_id)}">${ico('check', 16)} Aprobă</button>
            <button type="button" class="ax-btn ax-btn--sm cn-reject" data-reject="${esc(p.user_id)}">${ico('x', 16)} Respinge</button>
          </span>
        </li>`).join('')}
    </ul>`;
  }

  function sortTh(group, key, label, cls) {
    const on = sort[group] === key;
    return `<th data-sort="${key}"${cls ? ` class="${cls}"` : ''}${on ? ` aria-sort="${key === 'date' || key === 'classes' ? 'descending' : 'ascending'}"` : ''}><button type="button" class="cn-th" data-sort-btn="${group}:${key}">${label}${on ? ico('chevron-down', 14) : ''}</button></th>`;
  }

  /* what a teacher's registers say, from the console's Registre data: groups (all, and the active ones), lessons taught (a row with a date, a topic and at
     least one attendance mark), students per lesson (those present, the free first lesson included, divided by the lessons taught) and the income (the cost of
     the lessons taught, the "Consumul orelor" of the register: the sum of the cost row of every student column). null = no register tied to the account. */
  function statsFor(p) {
    if (!p.workbook_ids || !p.workbook_ids.length || !D || !D.readOnly || !D.readOnly() || !D.registry || !D.registry.ledger) return null;
    const ts = D.teachers.filter(t => p.workbook_ids.includes(t._wb));
    if (!ts.length) return null;
    const ids = new Set(ts.map(t => t.id));
    const gs = D.groups.filter(g => ids.has(g.teacher));
    let lessons = 0, present = 0, income = 0;
    gs.forEach(g => {
      const L = D.registry.ledger(g.id);
      L.lessons.forEach(l => {
        if (!l.iso || !String(l.topic || '').trim()) return;
        const codes = Object.values(l.marks || {}).filter(Boolean);
        if (!codes.length) return;
        lessons++;
        present += codes.filter(c => c === 'P' || c === 'G').length;
      });
      L.cols.forEach(c => { income += Number(c.sheetCost) || 0; });
    });
    return { groups: gs.length, active: gs.filter(g => g.status === 'activ').length, lessons, avg: lessons ? present / lessons : null, income };
  }
  const dec1 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const NA = '<span class="ax-sub">—</span>';

  function avatarHTML(p) {
    const ini = initials(p.full_name);
    return p.avatar_url
      ? `<img class="cn-av" src="${esc(p.avatar_url)}" alt="" width="34" height="34" loading="lazy" data-ini="${esc(ini)}">`
      : `<span class="cn-ini" aria-hidden="true">${esc(ini)}</span>`;
  }

  function profsHTML() {
    if (!C.profs.length) return emptyHTML('Nu există conturi de profesor.', '');
    const order = { pending: 0, active: 1, rejected: 2 };
    const rows = C.profs.filter(p => match(p.full_name, p.email)).map(p => ({ p, x: C.plain ? null : statsFor(p) }));
    const num = (r, k) => (r.x && r.x[k] != null ? r.x[k] : -1);
    rows.sort((a, b) => {
      if (sort.profesori === 'status') return (order[a.p.status] ?? 3) - (order[b.p.status] ?? 3);
      if (sort.profesori === 'groups') return num(b, 'groups') - num(a, 'groups');
      if (sort.profesori === 'lessons') return num(b, 'lessons') - num(a, 'lessons');
      if (sort.profesori === 'income') return num(b, 'income') - num(a, 'income');
      return String(a.p.full_name || '').localeCompare(String(b.p.full_name || ''), 'ro');
    });
    if (!rows.length) return noMatch();
    const page = rows.slice(0, shown);
    return `<div class="ax-table-wrap"><table class="ax-table cn-table">
      <thead><tr>${sortTh('profesori', 'name', 'Profesor')}${sortTh('profesori', 'status', 'Status')}${sortTh('profesori', 'groups', 'Grupe', 'ax-num')}<th class="ax-num">Elevi / lecție</th>${sortTh('profesori', 'lessons', 'Lecții predate', 'ax-num')}${sortTh('profesori', 'income', 'Venit generat', 'ax-num')}<th></th></tr></thead>
      <tbody>${page.map(({ p, x }, i) => {
        const st = PROF_ST[p.status] || { cls: 'inactiv', name: p.status || 'Necunoscut' };
        const none = C.plain ? NA : '<span class="ax-sub" title="Contul nu are un registru legat (pagina Sincronizare)">fără registru</span>';
        return `<tr data-arrive style="--i:${i}" data-uid="${esc(p.user_id)}">
          <td><div class="cn-who">${avatarHTML(p)}<span><b class="ax-strong">${esc(p.official_name || p.full_name || 'Fără nume')}</b><span class="ax-sub">${esc(p.email || '')}</span></span></div></td>
          <td data-l="Status"><span class="ax-st ax-st--${st.cls}"><i class="ax-st__i"></i>${esc(st.name)}</span></td>
          <td class="ax-num" data-l="Grupe">${x ? `<b>${nf.format(x.groups)}</b><span class="ax-sub">${nf.format(x.active)} ${x.active === 1 ? "activă" : "active"}</span>` : none}</td>
          <td class="ax-num" data-l="Elevi / lecție">${x && x.avg != null ? `<b>${dec1.format(x.avg)}</b>` : NA}</td>
          <td class="ax-num" data-l="Lecții predate">${x ? `<b>${nf.format(x.lessons)}</b>` : NA}</td>
          <td class="ax-num" data-l="Venit generat">${x ? `<b>${U.money(x.income)}</b>` : NA}</td>
          <td class="cn-act"><button type="button" class="ax-btn ax-btn--sm" data-rename="${esc(p.user_id)}" title="Numele oficial, cel din consolă și din registre">${ico('pencil', 16)} Nume</button> <button type="button" class="ax-btn ax-btn--sm cn-reject" data-remove="${esc(p.user_id)}" title="Pierde funcțiile de profesor; clasele trec la contul tău">${ico('trash-2', 16)} Șterge</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>${moreHTML(rows.length)}`;
  }

  function mgrsHTML() {
    if (!C.mgrs.length) return emptyHTML('Nu există conturi de manager.', '');
    const list = C.mgrs.filter(p => match(p.full_name, p.official_name, p.email));
    if (!list.length) return noMatch();
    const page = list.slice(0, shown);
    return `<div class="ax-table-wrap"><table class="ax-table cn-table">
      <thead><tr><th>Manager</th><th>Status</th><th title="Dacă numele e în lista de manageri din registre">Lista registrelor</th><th>Cont din</th><th></th></tr></thead>
      <tbody>${page.map((p, i) => {
        const st = PROF_ST[p.status] || { cls: 'inactiv', name: p.status || 'Necunoscut' };
        const inList = p.status !== 'active' ? NA : p.config_synced_at ? '<span class="ax-st ax-st--activ"><i class="ax-st__i"></i>Da</span>' : `<span class="ax-st ax-st--completare"><i class="ax-st__i"></i>Lipsește</span> <button type="button" class="ax-btn ax-btn--sm" data-config>Trimite</button>`;
        return `<tr data-arrive style="--i:${i}" data-uid="${esc(p.user_id)}">
          <td><div class="cn-who">${avatarHTML(p)}<span><b class="ax-strong">${esc(p.official_name || p.full_name || 'Fără nume')}</b><span class="ax-sub">${esc(p.email || '')}</span></span></div></td>
          <td data-l="Status"><span class="ax-st ax-st--${st.cls}"><i class="ax-st__i"></i>${esc(st.name)}</span></td>
          <td data-l="Lista registrelor">${inList}</td>
          <td class="cn-nowrap" data-l="Cont din">${esc(fmtDate(p.created_at))}</td>
          <td class="cn-act"><button type="button" class="ax-btn ax-btn--sm" data-rename="${esc(p.user_id)}" title="Numele oficial, cel din consolă și din registre">${ico('pencil', 16)} Nume</button> <button type="button" class="ax-btn ax-btn--sm cn-reject" data-remove-mgr="${esc(p.user_id)}" title="Pierde accesul la consolă">${ico('trash-2', 16)} Șterge</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>${moreHTML(list.length)}`;
  }

  function waitHTML() {
    const w = C.wait;
    if (w.status === 'loading') return loadingHTML();
    if (w.status === 'error') return errorHTML(w.error, 'Nu am putut încărca lista de așteptare');
    if (!w.rows.length) return emptyHTML('Nimeni pe listă încă.', 'Înscrierile de pe pagina principală apar aici.');
    const list = w.rows.filter(r => match(r.email, r.sursa, r.clasa));
    if (!list.length) return noMatch();
    const page = list.slice(0, shown);
    return `<div class="ax-table-wrap"><table class="ax-table cn-table">
      <thead><tr><th>E-mail</th><th>Clasa</th><th>Sursa</th><th>Data</th></tr></thead>
      <tbody>${page.map((r, i) => `<tr data-arrive style="--i:${i}">
        <td class="ax-strong cn-mail">${esc(r.email)}</td>
        <td data-l="Clasa">${r.clasa ? `<span class="ax-grade">${esc(r.clasa)}</span>` : ''}</td>
        <td data-l="Sursa">${esc(r.sursa || '') || '<span class="ax-sub">necunoscută</span>'}</td>
        <td class="cn-nowrap" data-l="Data">${esc(fmtDate(r.created_at))}</td>
      </tr>`).join('')}</tbody>
    </table></div>${moreHTML(list.length)}`;
  }

  function bodyHTML() {
    if (C.status === 'loading' || C.status === 'idle') return loadingHTML();
    if (C.status === 'error') return errorHTML(C.error);
    const partial = C.failed && C.failed.length ? `<div class="cn-partial" role="status"><span class="ax-hazard" aria-hidden="true"></span><span><b>Unele date lipsesc.</b> ${C.failed.map(f => `${esc(f.fn)}: ${esc(f.msg)}`).join('; ')}</span><button type="button" class="ax-link" data-reload>Reîncarcă</button></div>` : '';
    const tf = bad(TAB_FN[tab]);
    if (tf) return errorHTML(tf.msg);
    const inner = tab === 'cereri' ? pendingHTML() : tab === 'profesori' ? profsHTML() : tab === 'manageri' ? mgrsHTML() : waitHTML();
    return partial + inner;
  }

  /* ---------- paint + wiring ---------- */
  function visible() { return mount && mount.root.isConnected && (location.hash.slice(1).split('?')[0] === 'profesori'); }

  function paint() {
    if (!visible()) return;
    const r = mount.root;
    r.querySelector('#cnStats').innerHTML = statsHTML();
    r.querySelectorAll('#cnTabs button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.tab === tab));
      b.innerHTML = esc(TABS.find(t => t.id === b.dataset.tab).label) + tabCount(b.dataset.tab);
    });
    const stamp = r.querySelector('#cnStamp');
    stamp.textContent = C.status === 'ready' ? 'Încărcat la ' + C.loadedAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '';
    r.querySelector('#cnReload').disabled = C.status === 'loading';
    paintBody();
  }
  function paintBody() {
    if (!visible()) return;
    const box = mount.root.querySelector('#cnBody');
    box.innerHTML = bodyHTML();
    wireBody(box);
  }
  function setTab(id) {
    if (tab === id) return;
    tab = id; shown = CAP;
    U.writeQuery({ tab: tab === 'cereri' ? null : tab, q: query });
    paint();
  }

  function wireBody(box) {
    box.querySelectorAll('[data-reload]').forEach(b => b.addEventListener('click', load));
    box.querySelector('[data-more]')?.addEventListener('click', () => { shown += CAP; paintBody(); });
    box.querySelectorAll('[data-sort-btn]').forEach(b => b.addEventListener('click', () => {
      const [g, k] = b.dataset.sortBtn.split(':');
      sort[g] = k; paintBody();
    }));
    box.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => {
      const inp = box.querySelector(`[data-name="${b.dataset.approve}"]`), name = inp ? inp.value.replace(/\s+/g, ' ').trim() : '';
      if (!name) { U.toast('Scrie numele oficial.', 'warn'); if (inp) inp.focus(); return; }
      decide(b.dataset.approve, 'active', name);
    }));
    box.querySelectorAll('[data-rename]').forEach(b => b.addEventListener('click', () => openName(b.dataset.rename)));
    box.querySelectorAll('[data-config]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; await sendConfig(); }));
    box.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => {
      // second click confirms: no native dialog, the key itself asks
      if (b.dataset.armed) { decide(b.dataset.reject, 'rejected'); return; }
      b.dataset.armed = '1';
      b.classList.add('is-armed');
      b.innerHTML = `${ico('x', 16)} Confirmă respingerea`;
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.classList.remove('is-armed'); b.innerHTML = `${ico('x', 16)} Respinge`; } }, 4000);
    }));
    box.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
      // second click confirms: the key itself asks
      if (b.dataset.armed) { removeProf(b.dataset.remove); return; }
      b.dataset.armed = '1';
      b.classList.add('is-armed');
      b.innerHTML = `${ico('trash-2', 16)} Confirmă ștergerea`;
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.classList.remove('is-armed'); b.innerHTML = `${ico('trash-2', 16)} Șterge`; } }, 4000);
    }));
    box.querySelectorAll('[data-remove-mgr]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.armed) { removeMgr(b.dataset.removeMgr); return; }
      b.dataset.armed = '1';
      b.classList.add('is-armed');
      b.innerHTML = `${ico('trash-2', 16)} Confirmă ștergerea`;
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.classList.remove('is-armed'); b.innerHTML = `${ico('trash-2', 16)} Șterge`; } }, 4000);
    }));
    // a photo that does not load: the initials instead
    box.querySelectorAll('img.cn-av').forEach(im => im.addEventListener('error', () => {
      const sp = document.createElement('span');
      sp.className = 'cn-ini'; sp.setAttribute('aria-hidden', 'true'); sp.textContent = im.dataset.ini || '?';
      im.replaceWith(sp);
    }, { once: true }));
  }

  async function decide(uid, status, name) {
    const idx = C.pending.findIndex(p => p.user_id === uid);
    if (idx < 0) return;
    const p = C.pending[idx], mgr = p.role === 'manager', list = mgr ? C.mgrs : C.profs;
    const prof = list.find(x => x.user_id === uid);
    const prevStatus = prof ? prof.status : null;
    // optimistic: take the request off the list right away
    C.pending.splice(idx, 1);
    if (prof) prof.status = status; else list.push(Object.assign({}, p, { status }));
    paint();
    if (window.AdminShell) window.AdminShell.refreshNav();
    try {
      const missing = e => /does not exist|schema cache|Could not find/i.test(String(e && e.message));
      try { await rpc('admin_set_account_status', status === 'active' ? { p_user: uid, p_status: status, p_name: name } : { p_user: uid, p_status: status }); }
      catch (e) {
        if (!missing(e)) throw e;
        try { await rpc('admin_set_account_status', { p_user: uid, p_status: status }); }       // the name migration is not run yet
        catch (e2) {
          if (mgr || !missing(e2)) throw e2;
          await rpc('set_professor_status', { target_user_id: uid, new_status: status });      // neither migration is run yet: teachers still work
        }
      }
      if (status === 'active' && name) prof ? (prof.official_name = name) : (list[list.length - 1].official_name = name);
      const who = name || p.full_name || (mgr ? 'Managerul' : 'Profesorul');
      U.toast(status === 'active' ? `${esc(who)} a fost aprobat.` : `Cererea lui ${esc(who)} a fost respinsă.`);
      if (status === 'active' && mgr) sendConfig();
    } catch (e) {
      C.pending.splice(idx, 0, p);
      if (prof) prof.status = prevStatus; else { const k = list.findIndex(x => x.user_id === uid); if (k >= 0) list.splice(k, 1); }
      paint();
      if (window.AdminShell) window.AdminShell.refreshNav();
      U.toast(`Nu s-a salvat: ${esc(nameError(e))}`, 'warn');
    }
  }

  const nameError = e => {
    const m = String((e && e.message) || e || '');
    if (/name taken/i.test(m)) return 'Numele există deja la alt cont.';
    if (/name required/i.test(m)) return 'Scrie numele oficial.';
    if (/manager has students/i.test(m)) return 'Managerul are deja elevi în registre: numele nu se poate schimba acum.';
    return niceError(e);
  };

  /* the official name: the one shown in the console, in the classes and in the registers; the person's own profile name stays as it is */
  function openName(uid) {
    const p = C.profs.find(x => x.user_id === uid) || C.mgrs.find(x => x.user_id === uid);
    if (!p) return;
    const mgr = !!C.mgrs.find(x => x.user_id === uid);
    // a small dialog in the middle of the page: one field and a confirmation
    const d = document.createElement('dialog');
    d.className = 'cn-dlg';
    d.setAttribute('aria-labelledby', 'cnNameT');
    d.innerHTML = `<form id="cnNameForm">
      <div class="cn-dlg__b">
        <h2 id="cnNameT">Nume oficial</h2>
        <span class="ax-sub">${esc(p.email || '')}</span>
        <label class="sy-f"><span>Nume Prenume</span><input class="ax-input" name="name" required maxlength="80" value="${esc(p.official_name || p.full_name || '')}" autocomplete="off"></label>
        <p class="sy-err" id="cnNameErr" role="alert"></p>
      </div>
      <div class="cn-dlg__a"><button type="button" class="ax-btn" data-close>Renunță</button><button type="submit" class="ax-btn ax-btn--dark" id="cnNameGo">Salvează</button></div>
    </form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
    d.querySelector('#cnNameForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const name = String(new FormData(ev.target).get('name') || '').replace(/\s+/g, ' ').trim(), go = d.querySelector('#cnNameGo'), err = d.querySelector('#cnNameErr');
      if (!name) { err.textContent = 'Scrie numele oficial.'; return; }
      go.disabled = true; err.textContent = '';
      try {
        await rpc('admin_set_official_name', { p_user: uid, p_name: name });
        p.official_name = name;
        if (mgr) p.config_synced_at = null;
        d.close(); paint();
        U.toast('Numele a fost schimbat.');
        if (mgr) sendConfig();
      } catch (e) { err.textContent = nameError(e); go.disabled = false; }
    });
    d.showModal();
    const inp = d.querySelector('input[name="name"]'); inp.focus(); inp.select();
  }

  /* the managers list of the registers (the master file): the function writes the approved managers there; without access it says which names to copy */
  async function sendConfig() {
    try {
      let res;
      try {
        res = await fetch(`${SUPABASE_URL}/functions/v1/registru-config`, { method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + ((session && session.access_token) || ''), 'Content-Type': 'application/json' }, body: '{}' });
      } catch (e) { throw new Error('Nu s-a putut contacta serverul.'); }
      const j = await res.json().catch(() => ({}));
      if (res.status === 404) U.toast('Funcția registru-config nu e pusă în funcțiune.', 'warn');
      else if (j && j.ok) U.toast(j.added && j.added.length ? `Adăugat în lista de manageri din registre: ${esc(j.added.join(', '))}.` : 'Lista de manageri din registre e la zi.');
      else if (j && j.code === 'no-access') U.toast(`Fișierul-mamă nu e partajat cu contul de serviciu. Scrie de mână în coloana B din CONFIGURARI: ${esc((j.names || []).join(', '))}.`, 'warn');
      else U.toast(`Lista din registre nu s-a actualizat: ${esc((j && j.error) || 'eroare de server')}`, 'warn');
    } catch (e) {
      U.toast(`Lista din registre nu s-a actualizat: ${esc(niceError(e))}`, 'warn');
    }
    try { C.mgrs = await rpc('admin_manager_overview'); paint(); } catch (e) { /* the page keeps what it had */ }
  }

  async function removeMgr(uid) {
    const p = C.mgrs.find(x => x.user_id === uid);
    if (!p) return;
    try {
      await rpc('admin_remove_manager', { p_user: uid });
      C.mgrs = C.mgrs.filter(x => x.user_id !== uid);
      C.pending = C.pending.filter(x => x.user_id !== uid);
      paint();
      if (window.AdminShell) window.AdminShell.refreshNav();
      U.toast(`${esc(p.full_name || 'Managerul')} nu mai este manager.`);
    } catch (e) {
      U.toast(`Nu s-a șters: ${esc(niceError(e))}`, 'warn');
    }
  }

  async function removeProf(uid) {
    const p = C.profs.find(x => x.user_id === uid);
    if (!p) return;
    try {
      const r = await rpc('admin_remove_professor', { p_user: uid });
      C.profs = C.profs.filter(x => x.user_id !== uid);
      C.pending = C.pending.filter(x => x.user_id !== uid);
      paint();
      if (window.AdminShell) window.AdminShell.refreshNav();
      const n = r && r.classes_moved;
      U.toast(`${esc(p.full_name || 'Profesorul')} nu mai este profesor.${n ? ` ${n === 1 ? 'O clasă a trecut' : n + ' clase au trecut'} la contul tău.` : ''}`);
    } catch (e) {
      U.toast(`Nu s-a șters: ${esc(niceError(e))}`, 'warn');
    }
  }

  window.AdminViews.profesori = {
    title: 'Conturi',
    demo: false,
    icon: 'user',
    badge: () => (C.status === 'ready' && C.pending.length ? C.pending.length : null),
    render(root, ctx) {
      mount = { root, ctx };
      const q = ctx.query || {};
      tab = TABS.some(t => t.id === q.tab) ? q.tab : 'cereri';
      query = q.q || '';
      shown = CAP;

      root.innerHTML = `
        <header class="ax-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('user', 24)}</span>
            <div>
              <h1 class="ax-h1">Conturi</h1>
            </div>
          </div>
        </header>
        <section class="ax-stats cn-stats" id="cnStats" aria-label="Pe scurt"></section>
        <div class="cn-bar">
          <div class="ax-seg cn-tabs" id="cnTabs" role="group" aria-label="Secțiune">
            ${TABS.map(t => `<button type="button" data-tab="${t.id}" aria-pressed="${t.id === tab}">${esc(t.label)}</button>`).join('')}
          </div>
          <label class="ax-search cn-search"><span class="cn-vh">Caută în secțiunea curentă</span>${ico('search', 16)}
            <input class="ax-input" id="cnQ" type="search" placeholder="Caută după nume sau e-mail" value="${esc(query)}" autocomplete="off"></label>
          <span class="cn-stamp ax-sub" id="cnStamp"></span>
          <button type="button" class="ax-btn ax-btn--sm" id="cnReload">${ico('refresh-cw', 16)} Reîncarcă</button>
        </div>
        <div id="cnBody" aria-live="polite"></div>`;

      root.querySelector('#cnStats').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
      root.querySelectorAll('#cnTabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
      root.querySelector('#cnQ').addEventListener('input', e => {
        query = e.target.value; shown = CAP;
        U.writeQuery({ tab: tab === 'cereri' ? null : tab, q: query });
        paintBody();
      });
      root.querySelector('#cnReload').addEventListener('click', load);

      if (C.status === 'idle') load();
      else paint();
    }
  };
})();
