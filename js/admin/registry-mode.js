/* ============================================================
   Admin console: the data source switch, Demo | Registre
   ============================================================
   Demo: the generated demo data (as always). Registre: the Google Sheets registers, read from the reg_* tables that the registru-sync
   function fills (js/admin/registry-dataset.js turns the rows into the console's own shapes, AdminData.useData puts them in place).
   In Registre the console is read only: a write answers with the 'bm:registry-readonly' event (a toast here) and changes nothing.

   The choice is remembered per browser (localStorage bm_admin_source). A failed load never leaves the console half switched:
   it stays on the demo and says why.
   ============================================================ */
(function () {
  'use strict';
  const D = window.AdminData, U = window.AdminUI;
  const KEY = 'bm_admin_source';
  const SUPABASE_URL = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';
  const PAGE = 1000;                                   // the most rows the API returns in one answer

  let busy = false;
  let stamp = null;                                   // the newest full read of any register, as of the data on screen
  const latestRead = list => list.reduce((m, w) => (w.last_full_sync_at && (!m || w.last_full_sync_at > m) ? w.last_full_sync_at : m), null);
  const read = () => { try { return localStorage.getItem(KEY) === 'registre' ? 'registre' : 'demo'; } catch (e) { return 'demo'; } };
  const write = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } };

  async function token() {
    const a = window.BMAuth;
    const s = a && a.supabase ? await a.supabase.auth.getSession() : null;
    const t = s && s.data && s.data.session && s.data.session.access_token;
    if (!t) throw new Error('Nu există o sesiune activă. Deconectează-te și intră din nou în cont.');
    return t;
  }
  async function fetchAll(table, select, order, access) {
    const out = [];
    for (let from = 0; ; from += PAGE) {
      let res;
      try {
        res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}&order=${order}`, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + access, Accept: 'application/json', Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' } });
      } catch (e) { throw new Error('Nu s-a putut contacta serverul.'); }
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try { const j = JSON.parse(text); msg = j.message || j.hint || text; } catch (e) { /* plain text */ }
        if (/relation .* does not exist|schema cache/i.test(msg)) msg = 'Tabelele registrelor nu există încă în baza de date (migrațiile din supabase/migrations nu au fost rulate).';
        throw new Error(msg || 'Eroare de server (cod ' + res.status + ').');
      }
      const rows = text ? JSON.parse(text) : [];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }
  async function loadTables() {
    const access = await token();
    const [workbooks, groups, students, lessons] = await Promise.all([
      fetchAll('reg_workbooks', 'id,spreadsheet_id,title,teacher_name,project,config,teacher_data,enabled,last_full_sync_at', 'teacher_name.asc,id.asc', access),
      fetchAll('reg_groups', 'id,workbook_id,sheet_id,tab,format_size,state,subject,summer,grade,level,profile,schedule', 'workbook_id.asc,sheet_id.asc', access),
      fetchAll('reg_students', 'id,group_id,col,name,phone,manager,status,paid,discount,cost,sold', 'group_id.asc,col.asc', access),
      fetchAll('reg_lessons', 'group_id,row_no,date_text,iso,topic,teacher_level,teacher_pay,marks', 'group_id.asc,row_no.asc', access)
    ]);
    stamp = latestRead(workbooks);
    return { workbooks, groups, students, lessons };
  }

  /* the data read again from the registers (after a write, or on demand), without leaving the Registre mode */
  async function refresh() {
    if (!D.readOnly()) return false;
    const T = await loadTables();
    const ds = window.AdminRegistryDataset.build(T, { today: new Date().toISOString().slice(0, 10) });
    D.useData(ds, { today: new Date() });
    if (window.AdminShell) window.AdminShell.render();
    return true;
  }

  async function call(fn, access, body) {
    let res;
    try { res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
    catch (e) { throw new Error('Nu s-a putut contacta funcția ' + fn + ' (nu e pusă în funcțiune sau nu răspunde).'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(res.status === 401 ? 'Contul nu are drept de scriere în registre.' : (data.error || 'Eroare de server (cod ' + res.status + ').'));
    return data;
  }
  async function rpc(fn, access, params) {
    let res;
    try { res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + access, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(params || {}) }); }
    catch (e) { throw new Error('Nu s-a putut contacta serverul.'); }
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { const j = JSON.parse(text); msg = j.message || j.hint || text; } catch (e) { /* plain text */ }
      if (/not authorized/i.test(msg)) msg = 'Contul nu are drept de scriere în registre.';
      if (/Could not find the function|schema cache/i.test(msg)) msg = 'Scrierea în registre nu e pusă în funcțiune (migrația 20261008200000_registre_commands.sql nu a fost rulată).';
      throw new Error(msg || 'Eroare de server (cod ' + res.status + ').');
    }
    return text ? JSON.parse(text) : null;
  }

  /* One command, from the click to the result: queued (a row the admin can see), applied in the sheet by registru-apply, the register read
     again by registru-sync so the console shows it. Returns { ok, status, column, msg, url } and never throws. */
  async function command(group, type, payload, opts) {
    opts = opts || {};
    try {
      if (!D.readOnly()) throw new Error('Scrierea în registre merge doar în modul Registre.');
      const g = D.group(group);
      if (!g || !g._src || !g._src.wb) throw new Error('Grupa nu are un registru legat.');
      const access = await token();
      const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : undefined;
      const queued = await rpc('reg_enqueue_command', access, { p_workbook: g._src.wb, p_sheet: g._src.sheet, p_type: type, p_payload: payload, p_id: id });
      const out = await call('registru-apply', access, { command_id: queued });
      const r = (out.results || [])[0];
      if (!r) throw new Error('Comanda nu a fost preluată (o rulează altcineva sau a fost deja aplicată). Verifică pagina Sincronizare.');
      const ok = r.status === 'done';
      if ((ok || r.status === 'noop') && !opts.defer) {
        try { await call('registru-sync', access, { workbook_id: g._src.wb, force: true }); await refresh(); } catch (e) { /* the write is done; the cron reads it a few minutes later */ }
      }
      const url = g._src.ssid ? `https://docs.google.com/spreadsheets/d/${g._src.ssid}/edit#gid=${g._src.sheet}` + (r.column ? `&range=${r.column}1` : '') : null;
      return { ok, status: r.status, column: r.column || null, msg: r.msg || '', code: r.code || '', url };
    } catch (e) {
      return { ok: false, status: 'failed', column: null, msg: String((e && e.message) || e), code: 'client', url: null };
    }
  }

  /* Transfer: each student moves from `from` to `to` (groups that may be in two different registers), with his money split by the Calculator's
     formulas (the register's own cells are the numbers, the console only sends what it showed on screen so a change in between is refused).
     One command per student; a student whose second phase failed can be tried again (nothing is duplicated). Returns one result per student. */
  async function transfer({ from, students, to }) {
    const gFrom = D.group(from), gTo = D.group(to), results = [];
    const toSync = new Set();
    for (const sid of students) {
      const col = gFrom && D.registry.columnOf(sid, from);
      if (!col || !gTo || !gTo._src) { results.push({ sid, ok: false, status: 'invalid', code: 'client', msg: 'Elevul sau grupa nouă nu au un registru legat.' }); continue; }
      const f = D.transferFin(from, sid) || { A: 0, R: 0, C: 0 };
      const letterNo = String(col.col).split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
      const r = await command(from, 'TRANSFER', { student: { col: letterNo, name: col.name, phone: col.phone }, toWorkbook: gTo._src.wb, toSheet: gTo._src.sheet, status: col.status || 'Activ', manager: col.manager || '', expect: { A: f.A, R: f.R, C: f.C } }, { defer: true });
      results.push(Object.assign({ sid }, r));
      if (r.ok || r.status === 'noop' || r.code === 'half-done') { toSync.add(gFrom._src.wb); toSync.add(gTo._src.wb); }
    }
    if (toSync.size) {
      try { const access = await token(); for (const wb of toSync) await call('registru-sync', access, { workbook_id: wb, force: true }); await refresh(); } catch (e) { /* written; the cron reads it a few minutes later */ }
    }
    return results;
  }

  /* A new group: a new tab in the teacher's register, filled in (format, subject, class, level, profile, schedule, cabinet, the teacher's level),
     listed in Total achitari, with the first student. One command on the register (it has no sheet yet). Returns { ok, status, tab, column, msg, url }. */
  async function newGroup({ fresh, first, last, phone, manager }) {
    try {
      if (!D.readOnly()) throw new Error('Grupele noi se scriu în registre doar în modul Registre.');
      const t = D.teacher(fresh.teacher);
      if (!t || !t._wb) throw new Error('Profesorul nu are un registru legat.');
      const access = await token();
      const room = fresh.room ? D.room(fresh.room) : null, m = D.manager(manager);
      const payload = {
        group: { size: fresh.size, subject: fresh.subject, summer: fresh.regime === 'vara', grade: fresh.grade, profile: fresh.profile || null, level: fresh.level || '', days: fresh.days, start: fresh.start, duration: fresh.duration, cabinet: room ? String(room.num) : '', teacherLevel: D.tLevel(t.id), state: 'Se completează' },
        student: { name: `${last} ${first}`.replace(/\s+/g, ' ').trim(), phone, manager: m ? (m._reg || m.name) : '', status: 'Oră de probă' }
      };
      const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : undefined;
      const queued = await rpc('reg_enqueue_command', access, { p_workbook: t._wb, p_sheet: 0, p_type: 'NEW_GROUP', p_payload: payload, p_id: id });
      const out = await call('registru-apply', access, { command_id: queued });
      const r = (out.results || [])[0];
      if (!r) throw new Error('Comanda nu a fost preluată (o rulează altcineva sau a fost deja aplicată). Verifică pagina Sincronizare.');
      if (r.status === 'done' || r.code === 'group-done-student-failed') {
        try { await call('registru-sync', access, { workbook_id: t._wb, force: true }); await refresh(); } catch (e) { /* written; the cron reads it a few minutes later */ }
      }
      const url = t._ssid && r.sheetId ? `https://docs.google.com/spreadsheets/d/${t._ssid}/edit#gid=${r.sheetId}` + (r.column ? `&range=${r.column}1` : '') : null;
      return { ok: r.status === 'done', status: r.status, tab: r.tab || null, column: r.column || null, msg: r.msg || '', code: r.code || '', url };
    } catch (e) {
      return { ok: false, status: 'failed', tab: null, column: null, msg: String((e && e.message) || e), code: 'client', url: null };
    }
  }

  /* the enrolment desk: a new student in an existing group, first lesson free (status "Oră de probă") */
  async function enrol(d) {
    const m = D.manager(d.manager);
    return command(d.group, 'ADD_STUDENT', { name: `${d.last} ${d.first}`.replace(/\s+/g, ' ').trim(), phone: d.phone, manager: m ? (m._reg || m.name) : '', status: 'Oră de probă' });
  }

  function paint() {
    const reg = D.readOnly();
    document.documentElement.setAttribute('data-source', reg ? 'registre' : 'demo');
    const right = document.querySelector('.ax-top__right');
    if (!right) return;
    let box = document.getElementById('axSrc');
    if (!box) {
      box = document.createElement('div');
      box.className = 'ax-seg ax-src';
      box.id = 'axSrc';
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Sursa datelor');
      box.innerHTML = '<button type="button" data-src="demo">Demo</button><button type="button" data-src="registre">Registre</button>';
      right.insertBefore(box, right.firstChild);
      box.addEventListener('click', e => { const b = e.target.closest('[data-src]'); if (b) setSource(b.dataset.src); });
    }
    box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === (reg ? 'registre' : 'demo'))));
    box.classList.toggle('is-busy', busy);
    const pillEl = document.getElementById('axRegPill');
    if (pillEl) pillEl.classList.toggle('is-busy', busy);
    let pill = document.getElementById('axRegPill');
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'ax-regpill';
      pill.id = 'axRegPill';
      pill.title = 'Datele vin din registrele Google Sheets (sincronizate în platformă). Din consolă se poate înscrie un elev într-o grupă existentă; restul se schimbă în registru.';
      pill.innerHTML = '<i aria-hidden="true"></i><b>Registre</b><button type="button" class="ax-regpill__r" title="Reîncarcă acum datele din registre" aria-label="Reîncarcă datele din registre"></button>';
      pill.querySelector('button').innerHTML = (window.AdminUI && window.AdminUI.ico) ? window.AdminUI.ico('refresh-cw', 14) : '↻';
      pill.querySelector('button').addEventListener('click', () => poll(true));
      right.insertBefore(pill, box.nextSibling);
    }
  }

  /* The registers are read into the platform by the sync (every few minutes, or "Sincronizează acum"). The console on screen follows by itself:
     every 45 seconds it asks for the time of the newest read (one small call) and, when it is newer than its own data and nobody is typing or has
     a dialog open, loads the new data. The button on the green pill does the same at once. */
  async function poll(force) {
    if (!D.readOnly() || busy || (document.hidden && !force)) return false;
    try {
      const access = await token();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/reg_workbooks?select=last_full_sync_at&order=last_full_sync_at.desc.nullslast&limit=1`, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + access, Accept: 'application/json' } });
      if (!res.ok) return false;
      const rows = await res.json(), latest = rows[0] && rows[0].last_full_sync_at;
      if (!force && (!latest || latest === stamp)) return false;
      const a = document.activeElement;
      if (!force && (document.querySelector('dialog[open], .ax-drawer') || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)))) return false;   // later: not under somebody's hands
      busy = true; paint();
      try { await refresh(); } finally { busy = false; paint(); }
      U.toast(force ? 'Datele au fost reîncărcate din registre.' : 'Datele au fost actualizate din registre.');
      return true;
    } catch (e) { busy = false; paint(); return false; }
  }
  setInterval(() => poll(false), 45000);

  async function setSource(next, quiet) {
    if (busy) return false;
    const cur = D.readOnly() ? 'registre' : 'demo';
    if (next === cur) { write(next); paint(); return true; }
    busy = true; paint();
    try {
      if (next === 'registre') {
        const T = await loadTables();
        if (!T.workbooks.length || !T.groups.length) throw new Error('Încă nu e sincronizat niciun registru. Deschide pagina Sincronizare și apasă „Sincronizează acum”.');
        const ds = window.AdminRegistryDataset.build(T, { today: new Date().toISOString().slice(0, 10) });
        D.useData(ds, { today: new Date() });
        if (!quiet) U.toast(`Registre: ${ds.summary.workbooks} registre, ${ds.summary.groups} grupe, ${ds.summary.students} elevi. Consola e doar pentru citire.`);
      } else {
        D.useDemo();
        if (!quiet) U.toast('Date demo.');
      }
      write(next);
      if (window.AdminShell) window.AdminShell.render();
      return true;
    } catch (e) {
      U.toast(`Nu am trecut pe ${next === 'registre' ? 'Registre' : 'Demo'}: ${U.esc(String((e && e.message) || e))}`, 'warn');
      if (next === 'registre') write('demo');
      return false;
    } finally {
      busy = false; paint();
    }
  }

  // a write attempted while the registers are the source (a drag, a status, an enrolment ...)
  let lastToast = 0;
  document.addEventListener('bm:registry-readonly', () => {
    if (Date.now() - lastToast < 2500) return;
    lastToast = Date.now();
    U.toast('Registrele sunt sursa datelor. De aici se poate înscrie un elev, se poate transfera și se pot schimba statutul, managerul și plățile (se scrie în registru); restul se schimbă în registru, direct în Google Sheets. În modul Demo poți încerca liber.', 'warn');
  });

  window.AdminRegistry = { setSource, refresh, poll, command, enrol, transfer, newGroup, source: () => (D.readOnly() ? 'registre' : 'demo'), preferred: read };

  // the shell paints after the sign-in: wait for it, then draw the switch and restore the saved choice
  let tries = 0;
  const wait = setInterval(() => {
    if (document.getElementById('axShell')) {
      clearInterval(wait);
      paint();
      if (read() === 'registre') setSource('registre', true);
    } else if (++tries > 150) clearInterval(wait);
  }, 100);
})();
