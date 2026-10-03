/* ============================================================
   Admin console: Conturi (real accounts)
   ============================================================
   The only page of the console that reads REAL data: teacher sign-up
   requests (approve / reject), teacher accounts with their classes,
   student accounts with their classes and plan, and the landing-page
   waitlist. Ported from the old js/admin-page.js.

   Data: Supabase RPCs (POST /rest/v1/rpc/<fn>, apikey + the admin's
   Bearer token), each one checks role = 'admin' in the database:
     get_pending_professors, get_all_professors, get_all_classes_admin,
     get_all_students, get_all_student_classes_admin,
     get_all_student_plans, set_professor_status, set_student_plan
   and the waitlist through GET /api/admin/get-waitlist (a server route
   with the service key behind its own admin check).

   Loaded once per visit and kept in a module cache; "Reîncarcă"
   fetches again. URL: #profesori?tab=cereri|profesori|elevi|waitlist&q=
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI;
  const { esc, ico, nf, plural } = U;

  // Same project and public anon key as js/auth.js and the old admin page.
  const SUPABASE_URL = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  const TABS = [
    { id: 'cereri', label: 'Cereri' },
    { id: 'profesori', label: 'Profesori' },
    { id: 'elevi', label: 'Elevi' },
    { id: 'waitlist', label: 'Waitlist' }
  ];
  const PLANS = [{ id: 'free', name: 'Free' }, { id: 'standard', name: 'Standard' }, { id: 'premium', name: 'Premium' }];
  const PROF_ST = {
    active: { cls: 'activ', name: 'Aprobat' },
    pending: { cls: 'completare', name: 'În așteptare' },
    rejected: { cls: 'inactiv', name: 'Respins' }
  };
  const LEVELS = { '9-10': 'Foarte bun', '7-8': 'OK', '6-7': 'Mediocru', '5-6': 'Slab' };
  const CAP = 60;

  /* ---------- module cache ---------- */
  // status: idle | loading | ready | error
  let C = { status: 'idle' };
  let session = null;
  let mount = null;     // { root, ctx } of the visible render
  let tab = 'cereri', query = '', shown = CAP, sort = { profesori: 'name', elevi: 'date' };

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
    const fns = ['get_pending_professors', 'get_all_professors', 'get_all_classes_admin', 'get_all_students', 'get_all_student_classes_admin', 'get_all_student_plans'];
    const waitP = loadWaitlist();
    const out = await Promise.allSettled(fns.map(f => rpc(f)));
    const val = i => (out[i].status === 'fulfilled' && Array.isArray(out[i].value) ? out[i].value : []);
    const failed = out.map((r, i) => r.status === 'rejected' ? { fn: fns[i], msg: niceError(r.reason) } : null).filter(Boolean);
    if (failed.length === fns.length) {
      C = { status: 'error', error: failed[0].msg, wait: C.wait };
      paint();
      await waitP; paint();
      return;
    }
    const plans = {};
    val(5).forEach(r => { plans[r.user_id] = r.plan || 'free'; });
    const classesBy = {};
    val(2).forEach(c => { (classesBy[c.teacher_id] = classesBy[c.teacher_id] || []).push(c); });
    const studClassesBy = {};
    val(4).forEach(r => { (studClassesBy[r.student_id] = studClassesBy[r.student_id] || []).push(r); });
    C = {
      status: 'ready',
      loadedAt: new Date(),
      failed,
      pending: val(0),
      profs: val(1),
      classesBy, studClassesBy, plans,
      students: val(3),
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
  // classes.name is generated as "Materie · Zi · Oră"
  function parseClass(c) {
    const parts = String(c.name || c.class_name || '').split('·').map(s => s.trim());
    return { subject: parts[0] || 'Clasă', day: parts[1] || '', time: parts[2] || '' };
  }
  const match = (...fields) => { const q = query.trim().toLowerCase(); return !q || fields.some(f => String(f || '').toLowerCase().includes(q)); };

  /* ---------- counts ---------- */
  const bad = fn => C.status === 'ready' && C.failed.find(f => f.fn === fn);
  // a tab whose own RPC failed shows the error instead of a misleading "nothing here"
  const TAB_FN = { cereri: 'get_pending_professors', profesori: 'get_all_professors', elevi: 'get_all_students' };
  function counts() {
    if (C.status !== 'ready') return null;
    return {
      pending: bad('get_pending_professors') ? null : C.pending.length,
      approved: bad('get_all_professors') ? null : C.profs.filter(p => p.status === 'active').length,
      rejected: bad('get_all_professors') ? null : C.profs.filter(p => p.status === 'rejected').length,
      students: bad('get_all_students') ? null : C.students.length,
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
      { k: 'Cereri în așteptare', v: n && n.pending, s: 'Profesori de aprobat', tab: 'cereri', warn: n && n.pending > 0, icon: 'clock' },
      { k: 'Profesori aprobați', v: n && n.approved, s: 'Conturi active', tab: 'profesori', icon: 'check' },
      { k: 'Cereri respinse', v: n && n.rejected, s: 'Nu au acces de profesor', tab: 'profesori', icon: 'x' },
      { k: 'Elevi înregistrați', v: n && n.students, s: 'Conturi de elev', tab: 'elevi', icon: 'users' },
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
    const n = id === 'cereri' ? C.pending.length : id === 'profesori' ? C.profs.length : id === 'elevi' ? C.students.length : (C.wait.status === 'ready' ? C.wait.rows.length : null);
    return n == null ? '' : `<span class="ax-seg__n">${nf.format(n)}</span>`;
  }

  function loadingHTML() {
    return `<div class="ax-panel cn-state" role="status"><b>Se încarcă conturile…</b><span>Citesc cererile, profesorii, elevii și lista de așteptare din Supabase.</span></div>`;
  }
  function errorHTML(msg, title) {
    return `<div class="ax-panel cn-state cn-state--err" role="alert">
      <span class="cn-state__sign" aria-hidden="true">${ico('alert', 20)}</span>
      <b>${esc(title || 'Nu am putut încărca')}: ${esc(msg)}</b>
      <span>Datele vin direct din baza de date reală. Verifică conexiunea și sesiunea, apoi încearcă din nou.</span>
      <button type="button" class="ax-btn ax-btn--dark ax-btn--sm" data-reload>${ico('refresh-cw', 16)} Reîncarcă</button>
    </div>`;
  }
  const emptyHTML = (title, sub) => `<div class="ax-panel ax-empty cn-empty"><b>${esc(title)}</b>${esc(sub || '')}</div>`;
  const noMatch = () => emptyHTML(`Nimic pentru „${query.trim()}”.`, 'Caută după nume sau e-mail.');

  function moreHTML(total) {
    return total > shown ? `<div class="cn-more"><button type="button" class="ax-btn ax-btn--sm" data-more>Arată încă ${nf.format(Math.min(CAP, total - shown))}</button><span class="ax-sub">${nf.format(shown)} din ${nf.format(total)}</span></div>` : '';
  }

  function pendingHTML() {
    if (!C.pending.length) return emptyHTML('Nu există cereri în așteptare.', 'Când un profesor își face cont, cererea lui apare aici.');
    const list = C.pending.filter(p => match(p.full_name, p.email));
    if (!list.length) return noMatch();
    return `<ul class="cn-req">
      ${list.map((p, i) => `
        <li class="cn-req__row" data-uid="${esc(p.user_id)}" data-arrive style="--i:${i}">
          <span class="cn-ini" aria-hidden="true">${esc(initials(p.full_name))}</span>
          <span class="cn-req__who"><b>${esc(p.full_name || 'Fără nume')}</b><span class="ax-sub">${esc(p.email || '')}</span></span>
          <span class="cn-req__when"><span class="ax-sub">Cerere trimisă</span><b>${esc(fmtDate(p.created_at)) || 'necunoscut'}</b></span>
          <span class="cn-req__keys">
            <button type="button" class="ax-btn ax-btn--primary ax-btn--sm cn-approve" data-approve="${esc(p.user_id)}">${ico('check', 16)} Aprobă</button>
            <button type="button" class="ax-btn ax-btn--sm cn-reject" data-reject="${esc(p.user_id)}">${ico('x', 16)} Respinge</button>
          </span>
        </li>`).join('')}
    </ul>`;
  }

  function classRows(classes) {
    if (!classes.length) return '<span class="ax-sub">Nicio clasă creată</span>';
    return `<ul class="cn-cls">${classes.map(c => {
      const { subject, day, time } = parseClass(c);
      const n = Number(c.member_count) || 0, max = Number(c.max_students) || 0;
      const full = max && n >= max;
      return `<li>
        <b class="cn-cls__s">${esc(subject)}</b>
        <span class="cn-cls__t">${esc([day, time].filter(Boolean).join(', ')) || '<span class="ax-sub">fără program</span>'}</span>
        <span class="cn-cls__n${full ? ' ax-neg' : ''}" title="elevi înscriși${max ? ' din locuri' : ''}">${ico('users', 14)} ${nf.format(n)}${max ? '/' + nf.format(max) : ''}</span>
        <span class="cn-cls__g">${c.school_grade ? 'cls. ' + esc(c.school_grade) : ''}</span>
        <span class="cn-cls__l">${c.math_level ? `${esc(c.math_level)}${LEVELS[c.math_level] ? ' · ' + esc(LEVELS[c.math_level]) : ''}` : ''}</span>
      </li>`;
    }).join('')}</ul>`;
  }

  function sortTh(group, key, label, cls) {
    const on = sort[group] === key;
    return `<th data-sort="${key}"${cls ? ` class="${cls}"` : ''}${on ? ` aria-sort="${key === 'date' || key === 'classes' ? 'descending' : 'ascending'}"` : ''}><button type="button" class="cn-th" data-sort-btn="${group}:${key}">${label}${on ? ico('chevron-down', 14) : ''}</button></th>`;
  }

  function profsHTML() {
    if (!C.profs.length) return emptyHTML('Nu există conturi de profesor.', '');
    const order = { pending: 0, active: 1, rejected: 2 };
    const list = C.profs.filter(p => match(p.full_name, p.email)).sort((a, b) => {
      if (sort.profesori === 'classes') return (C.classesBy[b.user_id] || []).length - (C.classesBy[a.user_id] || []).length;
      if (sort.profesori === 'status') return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ro');
    });
    if (!list.length) return noMatch();
    const page = list.slice(0, shown);
    return `<div class="ax-table-wrap"><table class="ax-table cn-table">
      <thead><tr>${sortTh('profesori', 'name', 'Profesor')}${sortTh('profesori', 'status', 'Status')}${sortTh('profesori', 'classes', 'Clase')}</tr></thead>
      <tbody>${page.map((p, i) => {
        const st = PROF_ST[p.status] || { cls: 'inactiv', name: p.status || 'Necunoscut' };
        const cls = C.classesBy[p.user_id] || [];
        return `<tr data-arrive style="--i:${i}">
          <td><div class="cn-who"><span class="cn-ini" aria-hidden="true">${esc(initials(p.full_name))}</span><span><b class="ax-strong">${esc(p.full_name || 'Fără nume')}</b><span class="ax-sub">${esc(p.email || '')}</span></span></div></td>
          <td data-l="Status"><span class="ax-st ax-st--${st.cls}"><i class="ax-st__i"></i>${esc(st.name)}</span></td>
          <td class="cn-cls-td" data-l="Clase"><div><span class="cn-cls__count">${plural(cls.length, 'clasă', 'clase')}</span>${classRows(cls)}</div></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>${moreHTML(list.length)}`;
  }

  function studentsHTML() {
    if (!C.students.length) return emptyHTML('Nu există elevi înregistrați.', '');
    const list = C.students.filter(s => match(s.full_name, s.email)).sort((a, b) => {
      if (sort.elevi === 'name') return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ro');
      if (sort.elevi === 'classes') return (C.studClassesBy[b.user_id] || []).length - (C.studClassesBy[a.user_id] || []).length;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
    if (!list.length) return noMatch();
    const page = list.slice(0, shown);
    return `<div class="ax-table-wrap"><table class="ax-table cn-table">
      <thead><tr>${sortTh('elevi', 'name', 'Elev')}${sortTh('elevi', 'date', 'Înscris')}${sortTh('elevi', 'classes', 'Clase')}<th>Pachet</th></tr></thead>
      <tbody>${page.map((s, i) => {
        const cls = C.studClassesBy[s.user_id] || [];
        const plan = C.plans[s.user_id] || 'free';
        return `<tr data-arrive style="--i:${i}">
          <td><div class="cn-who"><span class="cn-ini" aria-hidden="true">${esc(initials(s.full_name))}</span><span><b class="ax-strong">${esc(s.full_name || 'Fără nume')}</b><span class="ax-sub">${esc(s.email || '')}</span></span></div></td>
          <td class="cn-nowrap" data-l="Înscris">${esc(fmtDate(s.created_at))}</td>
          <td data-l="Clase">${cls.length ? `<ul class="cn-scls">${cls.map(c => {
            const { subject, day, time } = parseClass(c);
            return `<li title="${esc(c.teacher_name || '')}"><b>${esc(subject)}</b>${day || time ? ` <span class="ax-sub">${esc([day, time].filter(Boolean).join(', '))}</span>` : ''}${c.teacher_name ? ` <span class="ax-sub">· ${esc(c.teacher_name)}</span>` : ''}</li>`;
          }).join('')}</ul>` : '<span class="ax-sub">Neînscris</span>'}</td>
          <td data-l="Pachet"><label class="cn-plan"><span class="cn-vh">Pachetul lui ${esc(s.full_name || 'elev')}</span>
            <select class="ax-select cn-plan__sel" data-plan="${esc(s.user_id)}" data-cur="${esc(plan)}">
              ${PLANS.map(p => `<option value="${p.id}"${p.id === plan ? ' selected' : ''}>${p.name}</option>`).join('')}
            </select></label></td>
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
    const inner = tab === 'cereri' ? pendingHTML() : tab === 'profesori' ? profsHTML() : tab === 'elevi' ? studentsHTML() : waitHTML();
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
    box.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => decide(b.dataset.approve, 'active')));
    box.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => {
      // second click confirms: no native dialog, the key itself asks
      if (b.dataset.armed) { decide(b.dataset.reject, 'rejected'); return; }
      b.dataset.armed = '1';
      b.classList.add('is-armed');
      b.innerHTML = `${ico('x', 16)} Confirmă respingerea`;
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.classList.remove('is-armed'); b.innerHTML = `${ico('x', 16)} Respinge`; } }, 4000);
    }));
    box.querySelectorAll('[data-plan]').forEach(s => s.addEventListener('change', () => setPlan(s)));
  }

  async function decide(uid, status) {
    const idx = C.pending.findIndex(p => p.user_id === uid);
    if (idx < 0) return;
    const p = C.pending[idx];
    const prof = C.profs.find(x => x.user_id === uid);
    const prevStatus = prof ? prof.status : null;
    // optimistic: take the request off the list right away
    C.pending.splice(idx, 1);
    if (prof) prof.status = status; else C.profs.push(Object.assign({}, p, { status }));
    paint();
    if (window.AdminShell) window.AdminShell.refreshNav();
    try {
      await rpc('set_professor_status', { target_user_id: uid, new_status: status });
      U.toast(status === 'active' ? `${esc(p.full_name || 'Profesorul')} a fost aprobat.` : `Cererea lui ${esc(p.full_name || 'profesor')} a fost respinsă.`);
    } catch (e) {
      C.pending.splice(idx, 0, p);
      if (prof) prof.status = prevStatus; else C.profs = C.profs.filter(x => x.user_id !== uid);
      paint();
      if (window.AdminShell) window.AdminShell.refreshNav();
      U.toast(`Nu s-a salvat: ${esc(niceError(e))}`, 'warn');
    }
  }

  async function setPlan(sel) {
    const uid = sel.dataset.plan, prev = sel.dataset.cur, next = sel.value;
    const s = C.students.find(x => x.user_id === uid);
    sel.disabled = true;
    try {
      await rpc('set_student_plan', { target_user_id: uid, new_plan: next });
      C.plans[uid] = next;
      sel.dataset.cur = next;
      U.toast(`Pachetul lui ${esc((s && s.full_name) || 'elev')} este acum ${esc(PLANS.find(p => p.id === next).name)}.`);
    } catch (e) {
      sel.value = prev;
      U.toast(`Pachetul nu s-a schimbat: ${esc(niceError(e))}`, 'warn');
    } finally {
      sel.disabled = false;
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
              <h1 class="ax-h1">Conturi <span class="cn-real" title="Această pagină citește și scrie în baza de date reală, nu în datele demo.">Date reale</span></h1>
              <p class="ax-lede">Cereri de profesor, conturile elevilor cu pachetele lor și lista de așteptare.</p>
            </div>
          </div>
          <div class="ax-head__keys">
            <a class="ax-btn" href="admin-add-exercise.html">${ico('plus', 16)} Adaugă exercițiu</a>
            <a class="ax-btn" href="admin-culegeri.html">${ico('library', 16)} Culegeri</a>
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
