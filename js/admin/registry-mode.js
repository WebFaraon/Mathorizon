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
      fetchAll('reg_workbooks', 'id,spreadsheet_id,title,teacher_name,project,config,teacher_data,enabled', 'teacher_name.asc,id.asc', access),
      fetchAll('reg_groups', 'id,workbook_id,sheet_id,tab,format_size,state,subject,summer,grade,level,profile,schedule', 'workbook_id.asc,sheet_id.asc', access),
      fetchAll('reg_students', 'id,group_id,col,name,phone,manager,status,paid,discount,cost,sold', 'group_id.asc,col.asc', access),
      fetchAll('reg_lessons', 'group_id,row_no,date_text,iso,topic,teacher_level,teacher_pay,marks', 'group_id.asc,row_no.asc', access)
    ]);
    return { workbooks, groups, students, lessons };
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
    let pill = document.getElementById('axRegPill');
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'ax-regpill';
      pill.id = 'axRegPill';
      pill.title = 'Datele vin din registrele Google Sheets (sincronizate în platformă). Consola e doar pentru citire: scrierea în registre vine la pasul următor.';
      pill.innerHTML = '<i aria-hidden="true"></i><b>Registre · doar citire</b>';
      right.insertBefore(pill, box.nextSibling);
    }
  }

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
    U.toast('Registrele sunt sursa datelor și consola e doar pentru citire. Schimbările se fac în registru; scrierea din platformă vine la pasul următor. În modul Demo poți încerca liber.', 'warn');
  });

  window.AdminRegistry = { setSource, source: () => (D.readOnly() ? 'registre' : 'demo'), preferred: read };

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
