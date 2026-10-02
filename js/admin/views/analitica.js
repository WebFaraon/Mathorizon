/* ============================================================
   Admin console: Analitică
   ============================================================
   The shape of the business in a few honest tables and charts, all
   computed from window.AdminData on every render:
     - KPI signs for groups and students (with their definitions)
     - distribution by grade (table + bar chart)
     - subjects (occupancy of active groups) and student statuses
     - a pivot table (two criteria x one value, optional shading)
     - room occupancy (Examen.md Offline, rooms x days)
     - lessons per starting hour (SVG column chart)
     - debts per manager
   Page filters (project, teacher, regime) and the pivot settings live
   in the URL (#analitica?project=exo&pa=materie&pb=clasa...).
   Shading uses one hue only (--ax-blue mixed with the panel, in the
   stylesheet; see css/admin/analitica.css, .an-h1..an-h5).
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico, nf } = U;

  const dec1 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pctTxt = v => nf.format(Math.round(v)) + '%';
  const ratio = (a, b) => (b ? (a / b) * 100 : 0);
  const iso = d => D.iso(d); // local calendar date, same as mock-data.js
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);

  const GST = Object.fromEntries(D.GROUP_STATUS.map(s => [s.id, s.name]));
  const SST = Object.fromEntries(D.STUDENT_STATUS.map(s => [s.id, s.name]));
  const TEACHERS = D.teachers.slice().sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const REGIMES = [['all', 'Toate'], ['normal', 'Normal'], ['vara', 'Școala de Vară']];

  /* ---- per-group student counts (cached per render) ---- */
  let cache = new Map();
  function gc(g) {
    let c = cache.get(g.id);
    if (!c) {
      const ss = D.studentsOf(g.id);
      c = {
        active: ss.filter(s => s.status === 'activ').length,
        probe: ss.filter(s => s.status === 'proba' || s.status === 'proba_ok').length,
        enrolled: D.enrolled(g).length,
        free: D.freeSeats(g)
      };
      cache.set(g.id, c);
    }
    return c;
  }

  /* ---- pivot vocabulary ---- */
  const DIMS = {
    materie: { label: 'Materie', key: g => g.subject, order: D.SUBJECTS, name: k => k },
    clasa: { label: 'Clasă', key: g => g.grade, order: D.GRADES, name: k => 'Clasa ' + k },
    profesor: { label: 'Profesor', key: g => g.teacher, order: TEACHERS.map(t => t.id), name: k => D.teacher(k).name },
    proiect: { label: 'Proiect', key: g => g.project, order: D.PROJECTS.map(p => p.id), name: k => D.project(k).name },
    statut: { label: 'Statut grup', key: g => g.status, order: D.GROUP_STATUS.map(s => s.id), name: k => GST[k] },
    format: { label: 'Format grup', key: g => g.size, order: [1, 2, 3, 4, 5, 6], name: k => (k === 1 ? 'Individual' : k + ' locuri') }
  };
  const VALS = {
    grupe: { label: 'Număr grupe', agg: gs => gs.length },
    elevi: { label: 'Elevi activi', agg: gs => sum(gs, g => gc(g).active) },
    libere: { label: 'Locuri libere', agg: gs => sum(gs, g => gc(g).free) },
    ocupare: { label: 'Grad de ocupare %', pct: true, agg: gs => { const seats = sum(gs, g => g.size); return seats ? ratio(sum(gs, g => gc(g).enrolled), seats) : null; } }
  };
  const PST = [['all', 'Toate statutele'], ['live', 'Fără inactive'], ...D.GROUP_STATUS.map(s => [s.id, s.name])];
  const SORTS = [['clasa', 'Clasă'], ['grupe', 'Grupe'], ['elevi', 'Elevi activi']];

  /* ---- state <-> URL ---- */
  function readState(q) {
    const st = {
      project: D.PROJECTS.some(p => p.id === q.project) ? q.project : 'all',
      teacher: q.teacher && D.teacher(q.teacher) ? q.teacher : '',
      regim: q.regim === 'normal' || q.regim === 'vara' ? q.regim : 'all',
      sort: SORTS.some(s => s[0] === q.sort) ? q.sort : 'clasa',
      pa: DIMS[q.pa] ? q.pa : 'materie',
      pb: DIMS[q.pb] ? q.pb : 'proiect',
      pv: VALS[q.pv] ? q.pv : 'grupe',
      pst: PST.some(s => s[0] === q.pst) ? q.pst : 'all',
      heat: q.heat !== '0'
    };
    if (st.pb === st.pa) st.pb = Object.keys(DIMS).find(k => k !== st.pa);
    return st;
  }
  function saveState(st) {
    U.writeQuery({
      project: st.project === 'all' ? '' : st.project,
      teacher: st.teacher,
      regim: st.regim === 'all' ? '' : st.regim,
      sort: st.sort === 'clasa' ? '' : st.sort,
      pa: st.pa === 'materie' ? '' : st.pa,
      pb: st.pb === 'proiect' ? '' : st.pb,
      pv: st.pv === 'grupe' ? '' : st.pv,
      pst: st.pst === 'all' ? '' : st.pst,
      heat: st.heat ? '' : '0'
    });
  }

  /* ---- the filtered model ---- */
  function model(st) {
    cache = new Map();
    const groups = D.groups.filter(g =>
      (st.project === 'all' || g.project === st.project) &&
      (!st.teacher || g.teacher === st.teacher) &&
      (st.regim === 'all' || g.regime === st.regim));
    const filtered = st.project !== 'all' || !!st.teacher || st.regim !== 'all';
    const gids = new Set(groups.map(g => g.id));
    const students = filtered ? D.students.filter(s => s.group && gids.has(s.group)) : D.students.slice();
    return { groups, students, filtered };
  }

  function withProject(st, base, params) {
    const p = new URLSearchParams(params || {});
    if (st.project !== 'all') p.set('project', st.project);
    const s = p.toString();
    return base + (s ? '?' + s : '');
  }

  /* ============ KPIs ============ */
  function kpis(m, st) {
    const { groups, students } = m;
    const n = s => groups.filter(g => g.status === s).length;
    const today = iso(D.today), in7 = iso(addDays(D.today, 7));
    const starting = groups.filter(g => g.status === 'completare' && g.startDate > today && g.startDate <= in7).length;
    const sc = s => students.filter(x => x.status === s).length;
    const act = groups.filter(g => g.status === 'activ');
    const actInAct = sum(act, g => gc(g).active);
    const noGroup = students.filter(s => !s.group).length;
    return {
      groups: [
        { k: 'Total grupe', v: nf.format(groups.length), raw: groups.length, s: 'Toate grupele din filtru, orice statut' },
        { k: 'Grupe active', v: nf.format(act.length), raw: act.length, s: 'Statut Activ: țin lecții' },
        { k: 'Se completează', v: nf.format(n('completare')), raw: n('completare'), s: 'Își adună încă elevii', href: withProject(st, '#orar', { status: 'completare' }) },
        { k: 'Startează', v: nf.format(starting), raw: starting, s: 'Se completează, pornesc în 7 zile', href: withProject(st, '#orar', { status: 'completare', sort: 'start' }) },
        { k: 'Grupe inactive', v: nf.format(n('inactiv')), raw: n('inactiv'), s: 'Oprite, nu mai țin lecții', href: withProject(st, '#orar', { status: 'inactiv' }) },
        { k: 'Mărime medie grupă', v: dec1.format(act.length ? actInAct / act.length : 0), raw: act.length ? +(actInAct / act.length).toFixed(1) : 0, s: 'Elevi activi pe grupă activă' }
      ],
      students: [
        { k: 'Total elevi', v: nf.format(students.length), raw: students.length, s: m.filtered ? 'Elevii grupelor din filtru' : `Inclusiv ${nf.format(noGroup)} fără grupă` },
        { k: 'Elevi activi', v: nf.format(sc('activ')), raw: sc('activ'), s: 'Statut Activ' },
        { k: 'Ore de probă', v: nf.format(sc('proba') + sc('proba_ok')), raw: sc('proba') + sc('proba_ok'), s: `${nf.format(sc('proba'))} programate, ${nf.format(sc('proba_ok'))} confirmate`, href: withProject(st, '#elevi', { status: 'proba,proba_ok' }) },
        { k: 'Transferați', v: nf.format(sc('transferat')), raw: sc('transferat'), s: 'Statut Transferat', href: withProject(st, '#elevi', { status: 'transferat' }) },
        { k: 'Elevi inactivi', v: nf.format(sc('inactiv')), raw: sc('inactiv'), s: 'Nu mai frecventează', href: withProject(st, '#elevi', { status: 'inactiv' }) },
        { k: 'Rata de activitate', v: pctTxt(ratio(sc('activ'), students.length)), raw: Math.round(ratio(sc('activ'), students.length)) + '%', s: 'Elevi activi din totalul elevilor' }
      ]
    };
  }

  function statHTML(a, i) {
    const inner = `
      <span class="ax-stat__k">${esc(a.k)}</span>
      <span class="ax-stat__v">${a.v}</span>
      <span class="ax-stat__s">${esc(a.s)}</span>`;
    return a.href
      ? `<a class="ax-stat an-stat" href="${a.href}" data-arrive style="--i:${i}">${inner}<span class="an-stat__go" aria-hidden="true">${ico('arrow-right', 16)}</span></a>`
      : `<div class="ax-stat an-stat" data-arrive style="--i:${i}">${inner}</div>`;
  }

  function kpiHTML(k) {
    return `
      <section class="an-kpis" aria-label="Indicatori">
        <div class="an-kpis__row">
          <h2 class="an-kpis__h">Grupe</h2>
          <div class="ax-stats an-stats">${k.groups.map(statHTML).join('')}</div>
        </div>
        <div class="an-kpis__row">
          <h2 class="an-kpis__h">Elevi</h2>
          <div class="ax-stats an-stats">${k.students.map((a, i) => statHTML(a, i + 6)).join('')}</div>
        </div>
      </section>`;
  }

  /* ============ Grades ============ */
  function gradeRows(m) {
    const by = {};
    m.groups.forEach(g => {
      const r = by[g.grade] || (by[g.grade] = { grade: g.grade, groups: 0, active: 0, probe: 0 });
      r.groups++; r.active += gc(g).active; r.probe += gc(g).probe;
    });
    const rows = D.GRADES.filter(x => by[x]).map(x => by[x]);
    const total = sum(rows, r => r.active);
    rows.forEach(r => { r.share = ratio(r.active, total); });
    rows.slice().sort((a, b) => b.active - a.active).slice(0, 3).forEach((r, i) => { if (r.active) r.rank = i + 1; });
    return { rows, total };
  }
  function sortGrades(rows, sort) {
    const gi = x => D.GRADES.indexOf(x.grade);
    const out = rows.slice();
    if (sort === 'grupe') out.sort((a, b) => b.groups - a.groups || gi(a) - gi(b));
    else if (sort === 'elevi') out.sort((a, b) => b.active - a.active || gi(a) - gi(b));
    else out.sort((a, b) => gi(a) - gi(b));
    return out;
  }
  function gradeTableHTML(gr, sort) {
    if (!gr.rows.length) return emptyHTML();
    const sortCol = { clasa: 0, grupe: 1, elevi: 2 }[sort];
    const th = (t, i, num) => `<th${num ? ' class="ax-num"' : ''}${i === sortCol ? ` aria-sort="${i === 0 ? 'ascending' : 'descending'}"` : ''}>${t}</th>`;
    return `
      <div class="ax-table-wrap an-wrap">
        <table class="ax-table an-table">
          <caption class="an-sr">Distribuția pe clase, ordonată după ${esc(SORTS.find(s => s[0] === sort)[1])}</caption>
          <thead><tr>${th('Clasă', 0)}${th('Număr grupe', 1, 1)}${th('Elevi activi', 2, 1)}${th('Ore de probă', 3, 1)}<th>Procentaj</th></tr></thead>
          <tbody>
            ${sortGrades(gr.rows, sort).map(r => `
              <tr>
                <td><span class="an-grade"><span class="ax-grade">${esc(r.grade)}</span>${r.rank ? `<span class="an-rank">Top ${r.rank}</span>` : ''}</span></td>
                <td class="ax-num">${nf.format(r.groups)}</td>
                <td class="ax-num">${nf.format(r.active)}</td>
                <td class="ax-num">${nf.format(r.probe)}</td>
                <td>${meterHTML(r.share)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot><tr><td>Total</td><td class="ax-num">${nf.format(sum(gr.rows, r => r.groups))}</td><td class="ax-num">${nf.format(gr.total)}</td><td class="ax-num">${nf.format(sum(gr.rows, r => r.probe))}</td><td>${gr.total ? '100%' : ''}</td></tr></tfoot>
        </table>
      </div>`;
  }
  function meterHTML(v) {
    return `<span class="an-meter"><span class="an-meter__t" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, v)).toFixed(1)}%"></i></span><b>${pctTxt(v)}</b></span>`;
  }
  function gradeChartHTML(gr) {
    if (!gr.rows.length) return '';
    const max = Math.max(1, ...gr.rows.map(r => r.active));
    return `
      <figure class="an-hbars" aria-label="Elevi activi pe clase">
        <figcaption class="an-fig__t">Elevi activi pe clase <span>în ordinea claselor</span></figcaption>
        <ol class="an-hbars__list">
          ${gr.rows.map(r => `
            <li class="an-hbar" data-tip="Clasa ${esc(r.grade)}: ${nf.format(r.active)} elevi activi, ${pctTxt(r.share)} din total">
              <span class="an-hbar__l">${esc(r.grade)}</span>
              <span class="an-hbar__t"><i style="width:${((r.active / max) * 100).toFixed(1)}%"></i></span>
              <span class="an-hbar__v">${nf.format(r.active)}</span>
            </li>`).join('')}
        </ol>
      </figure>`;
  }

  /* ============ Subjects ============ */
  function subjectRows(m) {
    return D.SUBJECTS.map(sub => {
      const gs = m.groups.filter(g => g.subject === sub);
      if (!gs.length) return null;
      const act = gs.filter(g => g.status === 'activ');
      const seats = sum(act, g => g.size);
      return {
        subject: sub,
        groups: act.length,
        active: sum(gs, g => gc(g).active),
        seats,
        enrolled: sum(act, g => gc(g).enrolled),
        free: sum(act, g => gc(g).free)
      };
    }).filter(Boolean).sort((a, b) => b.groups - a.groups || b.active - a.active);
  }
  function subjectHTML(rows) {
    if (!rows.length) return emptyHTML();
    return `
      <div class="ax-table-wrap an-wrap">
        <table class="ax-table an-table">
          <thead><tr><th>Materie</th><th class="ax-num">Grupe active</th><th class="ax-num">Elevi activi</th><th>Grad de ocupare</th><th class="ax-num">Locuri libere</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="ax-strong">${esc(r.subject)}</td>
                <td class="ax-num">${nf.format(r.groups)}</td>
                <td class="ax-num">${nf.format(r.active)}</td>
                <td>${r.seats ? meterHTML(ratio(r.enrolled, r.seats)) : '<span class="an-mute">fără grupe active</span>'}</td>
                <td class="ax-num">${nf.format(r.free)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ============ Student statuses ============ */
  const ACTIONS = {
    activ: 'Urmărește progresul',
    proba: 'Confirmă ora de probă',
    proba_ok: 'Înscrie în grupă',
    instabil: 'Contactează elevii',
    inlocuire: 'Mărește grupele',
    transferat: 'Documentează transferul',
    inactiv: 'Sună pentru revenire'
  };
  function statusRows(m) {
    const total = m.students.length;
    return D.STUDENT_STATUS.map(s => {
      const n = m.students.filter(x => x.status === s.id).length;
      return { id: s.id, name: s.name, n, share: ratio(n, total), action: ACTIONS[s.id] };
    });
  }
  function statusHTML(rows, st) {
    const max = Math.max(1, ...rows.map(r => r.share));
    return `
      <ul class="an-status">
        ${rows.map(r => `
          <li class="an-status__row">
            <span class="ax-st ax-st--${r.id}"><i class="ax-st__i"></i>${esc(r.name)}</span>
            <span class="an-status__n"><b>${nf.format(r.n)}</b><span>${pctTxt(r.share)}</span></span>
            <span class="an-status__bar" aria-hidden="true"><i style="width:${((r.share / max) * 100).toFixed(1)}%"></i></span>
            ${r.n ? `<a class="an-status__act" href="${withProject(st, '#elevi', { status: r.id })}">${esc(r.action)}${ico('arrow-right', 14)}</a>` : '<span class="an-status__act an-mute">Nimic de făcut</span>'}
          </li>`).join('')}
      </ul>`;
  }

  /* ============ Pivot ============ */
  function pivotData(m, st) {
    let gs = m.groups;
    if (st.pst === 'live') gs = gs.filter(g => g.status !== 'inactiv');
    else if (st.pst !== 'all') gs = gs.filter(g => g.status === st.pst);
    const A = DIMS[st.pa], B = DIMS[st.pb], V = VALS[st.pv];
    const present = (dim) => { const s = new Set(gs.map(dim.key)); return dim.order.filter(k => s.has(k)); };
    const rows = present(A), cols = present(B);
    const cell = {}, rowG = {}, colG = {};
    gs.forEach(g => {
      const a = A.key(g), b = B.key(g);
      (cell[a + '|' + b] = cell[a + '|' + b] || []).push(g);
      (rowG[a] = rowG[a] || []).push(g);
      (colG[b] = colG[b] || []).push(g);
    });
    const val = list => (list && list.length ? V.agg(list) : null);
    const grid = rows.map(a => cols.map(b => val(cell[a + '|' + b])));
    const max = Math.max(0, ...grid.flat().filter(v => v != null));
    return { gs, rows, cols, grid, max, A, B, V, rowT: rows.map(a => val(rowG[a])), colT: cols.map(b => val(colG[b])), total: val(gs) };
  }
  const fmtVal = (V, v) => (v == null ? '' : V.pct ? pctTxt(v) : nf.format(v));
  function bucket(v, max, isPct) {
    if (v == null || v <= 0) return 0;
    const f = isPct ? v / 100 : v / (max || 1);
    return Math.max(1, Math.min(5, Math.ceil(f * 5)));
  }
  function pivotTableHTML(p, st) {
    if (!p.rows.length) return emptyHTML();
    const cellHTML = (v, i, j) => {
      const b = st.heat ? bucket(v, p.max, p.V.pct) : 0;
      const label = `${p.A.name(p.rows[i])}, ${p.B.name(p.cols[j])}: ${v == null ? 'nicio grupă' : fmtVal(p.V, v)}`;
      return `<td class="ax-num an-pv__c${b ? ' an-h' + b : ''}${v == null ? ' is-nil' : ''}" data-tip="${esc(label)}">${v == null ? '<span aria-label="nicio grupă">·</span>' : fmtVal(p.V, v)}</td>`;
    };
    return `
      <div class="ax-table-wrap an-wrap an-pv-wrap">
        <table class="ax-table an-pv">
          <caption class="an-sr">${esc(p.V.label)} pe ${esc(p.A.label)} și ${esc(p.B.label)}</caption>
          <thead><tr>
            <th scope="col" class="an-pv__corner">${esc(p.A.label)} <span aria-hidden="true">/</span> ${esc(p.B.label)}</th>
            ${p.cols.map(b => `<th scope="col" class="ax-num">${esc(p.B.name(b))}</th>`).join('')}
            <th scope="col" class="ax-num an-pv__tot">Total</th>
          </tr></thead>
          <tbody>
            ${p.rows.map((a, i) => `
              <tr>
                <th scope="row">${esc(p.A.name(a))}</th>
                ${p.grid[i].map((v, j) => cellHTML(v, i, j)).join('')}
                <td class="ax-num an-pv__tot">${fmtVal(p.V, p.rowT[i])}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <th scope="row">Total</th>
            ${p.colT.map(v => `<td class="ax-num">${fmtVal(p.V, v)}</td>`).join('')}
            <td class="ax-num an-pv__tot">${fmtVal(p.V, p.total)}</td>
          </tr></tfoot>
        </table>
      </div>`;
  }
  function heatLegendHTML(isPct, max) {
    const steps = [1, 2, 3, 4, 5].map(b => {
      const lo = isPct ? (b - 1) * 20 + 1 : Math.floor(((b - 1) / 5) * max) + 1;
      const hi = isPct ? b * 20 : Math.floor((b / 5) * max);
      return { b, t: isPct ? `${b === 1 ? 1 : lo}-${hi}%` : lo >= hi ? nf.format(hi) : `${nf.format(lo)}-${nf.format(hi)}` , empty: !isPct && hi < lo };
    }).filter(s => !s.empty);
    return `<div class="an-legend" aria-label="Legenda intensității">
      <span class="an-legend__l">${isPct ? 'Ocupare' : 'Valoare'}</span>
      ${steps.map(s => `<span class="an-legend__i"><i class="an-h${s.b}"></i>${s.t}</span>`).join('')}
    </div>`;
  }
  function selectHTML(id, label, opts, val, disabled) {
    return `<label class="an-ctl"><span class="an-ctl__l">${esc(label)}</span>
      <select class="ax-select" id="${id}">
        ${opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}${disabled && disabled === v ? ' disabled' : ''}>${esc(t)}</option>`).join('')}
      </select></label>`;
  }
  function pivotHTML(m, st) {
    const p = pivotData(m, st);
    const dimOpts = Object.entries(DIMS).map(([k, d]) => [k, d.label]);
    return `
      <div class="ax-panel__head an-head">
        <div>
          <h2 class="ax-h2" id="anPvT">Tabel încrucișat</h2>
          <p class="an-def">Grupele împărțite după două criterii. Totalurile se calculează din grupe, nu din adunarea celulelor, deci gradul de ocupare rămâne corect.</p>
        </div>
        <button type="button" class="ax-btn ax-btn--sm" id="anPvCsv">${ico('download', 16)} CSV tabel</button>
      </div>
      <div class="an-pv-ctls">
        ${selectHTML('anPa', 'Criteriu principal', dimOpts, st.pa)}
        ${selectHTML('anPb', 'Criteriu secundar', dimOpts, st.pb, st.pa)}
        ${selectHTML('anPv', 'Valoare', Object.entries(VALS).map(([k, v]) => [k, v.label]), st.pv)}
        ${selectHTML('anPst', 'Statut grup', PST, st.pst)}
        <label class="ax-switch an-pv-switch"><input type="checkbox" id="anHeat"${st.heat ? ' checked' : ''}><span class="ax-switch__t" aria-hidden="true"></span>Intensitate culori</label>
      </div>
      <div class="an-pv-body">
        ${pivotTableHTML(p, st)}
        <div class="an-pv-foot">
          <p class="an-def">${esc(p.V.label)}${p.V.pct ? ': elevi înscriși (fără inactivi și transferați) din locurile grupelor' : ''}. ${nf.format(p.gs.length)} ${p.gs.length === 1 ? 'grupă' : 'grupe'} în calcul. Punct: nicio grupă în combinația respectivă.</p>
          ${st.heat && p.rows.length ? heatLegendHTML(p.V.pct, p.max) : ''}
        </div>
      </div>`;
  }
  function pivotCSV(m, st) {
    const p = pivotData(m, st);
    const f = v => (v == null ? '' : p.V.pct ? Math.round(v) : v);
    return [
      [`${p.V.label}: ${p.A.label} / ${p.B.label}`, ...p.cols.map(b => p.B.name(b)), 'Total'],
      ...p.rows.map((a, i) => [p.A.name(a), ...p.grid[i].map(f), f(p.rowT[i])]),
      ['Total', ...p.colT.map(f), f(p.total)]
    ];
  }

  /* ============ Rooms ============ */
  const SLOTS = D.HOURS.length; // 13 one-hour slots, 08:00-21:00
  function roomData(m, st) {
    if (st.project !== 'all' && st.project !== 'exo') return null;
    const gs = m.groups.filter(g => g.project === 'exo' && g.room && g.status !== 'inactiv');
    const rows = D.rooms.map(r => {
      const days = D.DAYS.map(d => {
        const hrs = new Set();
        gs.forEach(g => {
          if (g.room !== r.id || !g.days.includes(d.id)) return;
          for (let h = g.start; h < g.start + g.duration; h++) if (D.HOURS.includes(h)) hrs.add(h);
        });
        return hrs.size;
      });
      return { r, days, total: sum(days, x => x) };
    });
    const dayT = D.DAYS.map((d, i) => sum(rows, x => x.days[i]));
    return { rows, dayT, total: sum(rows, x => x.total) };
  }
  function roomsHTML(rd) {
    if (!rd) return `<div class="ax-empty"><b>Fără cabinete în acest proiect</b>Doar Examen.md Offline ține lecții în cabinete. Alege „Toate proiectele” sau Examen.md Offline.</div>`;
    const cap = SLOTS * 7, capDay = SLOTS * D.rooms.length;
    return `
      <div class="ax-table-wrap an-wrap">
        <table class="ax-table an-rooms">
          <caption class="an-sr">Ore ocupate din ${SLOTS} pe zi, pe cabinete și zile</caption>
          <thead><tr><th scope="col">Cabinet</th>${D.DAYS.map(d => `<th scope="col" class="ax-num"><abbr title="${esc(d.name)}">${esc(d.short)}</abbr></th>`).join('')}<th scope="col" class="ax-num">Săptămână</th></tr></thead>
          <tbody>
            ${rd.rows.map(({ r, days, total }) => `
              <tr>
                <th scope="row"><span class="an-room" title="Cabinet ${r.num}, ${r.seats} locuri">${r.num}</span><span class="an-sr">Cabinet ${r.num}</span></th>
                ${days.map((h, i) => `<td class="ax-num an-rooms__c an-h${bucket(ratio(h, SLOTS), 0, true)}" data-tip="Cabinet ${r.num}, ${esc(D.DAYS[i].name)}: ${h} din ${SLOTS} ore ocupate (${pctTxt(ratio(h, SLOTS))})">${h}</td>`).join('')}
                <td class="ax-num an-rooms__t"><b>${pctTxt(ratio(total, cap))}</b><span class="ax-sub">${total} h din ${cap}</span></td>
              </tr>`).join('')}
          </tbody>
          <tfoot><tr><th scope="row">Toate</th>${rd.dayT.map(h => `<td class="ax-num">${pctTxt(ratio(h, capDay))}</td>`).join('')}<td class="ax-num an-rooms__t"><b>${pctTxt(ratio(rd.total, cap * D.rooms.length))}</b></td></tr></tfoot>
        </table>
      </div>`;
  }

  /* ============ Lessons per hour ============ */
  function hourData(m) {
    const live = m.groups.filter(g => g.status !== 'inactiv');
    const counts = D.HOURS.map(h => sum(live.filter(g => g.start === h), g => g.days.length));
    return { counts, total: sum(counts, x => x) };
  }
  function niceStep(max, ticks) {
    const raw = max / ticks;
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  function drawHours(el, hd) {
    const W = Math.max(260, el.clientWidth);
    const H = 230, ml = 34, mr = 6, mt = 26, mb = 30;
    const pw = W - ml - mr, ph = H - mt - mb;
    const max = Math.max(1, ...hd.counts);
    const step = niceStep(max, 4);
    const top = Math.ceil(max / step) * step;
    const y = v => mt + ph - (v / top) * ph;
    const band = pw / hd.counts.length;
    const bw = Math.min(24, band * 0.62);
    const peak = hd.counts.indexOf(max);
    const every = band < 26 ? 2 : 1;
    let s = '';
    for (let v = 0; v <= top; v += step) {
      s += `<line class="an-ax__grid${v === 0 ? ' is-base' : ''}" x1="${ml}" x2="${W - mr}" y1="${y(v) + 0.5}" y2="${y(v) + 0.5}"/>`;
      s += `<text class="an-ax__y" x="${ml - 8}" y="${y(v) + 4}" text-anchor="end">${nf.format(v)}</text>`;
    }
    hd.counts.forEach((c, i) => {
      s += `<rect class="an-hit" x="${ml + band * i}" y="${mt}" width="${band}" height="${ph}" data-tip="${U.hh(D.HOURS[i])}: ${nf.format(c)} ${c === 1 ? 'lecție începe' : 'lecții încep'} în cursul săptămânii"/>`;
    });
    hd.counts.forEach((c, i) => {
      const cx = ml + band * i + band / 2;
      const x = cx - bw / 2, yt = y(c), h = mt + ph - yt;
      const r = Math.min(2, h);
      if (c > 0) s += `<path class="an-col${i === peak ? ' is-peak' : ''}" d="M${x},${mt + ph} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + bw - r} Q${x + bw},${yt} ${x + bw},${yt + r} V${mt + ph} Z"/>`;
      if (i % every === 0 || i === peak) s += `<text class="an-ax__x${i === peak ? ' is-peak' : ''}" x="${cx}" y="${H - 10}" text-anchor="middle">${String(D.HOURS[i]).padStart(2, '0')}</text>`;
    });
    const px = ml + band * peak + band / 2;
    s += `<text class="an-peak" x="${Math.min(W - mr - 4, Math.max(ml + 4, px))}" y="${y(max) - 8}" text-anchor="${px > W - 70 ? 'end' : px < ml + 60 ? 'start' : 'middle'}">${nf.format(max)} la ${U.hh(D.HOURS[peak])}</text>`;
    el.innerHTML = `<svg class="an-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(hourSummary(hd))}">${s}</svg>`;
  }
  function hourSummary(hd) {
    const max = Math.max(...hd.counts);
    const peak = hd.counts.indexOf(max);
    return `Lecții pe ora de început, ${nf.format(hd.total)} pe săptămână. Cea mai aglomerată oră: ${U.hh(D.HOURS[peak])}, cu ${nf.format(max)} lecții.`;
  }
  function hoursHTML(hd) {
    if (!hd.total) return emptyHTML();
    return `
      <div class="an-chart" id="anHours"></div>
      <table class="an-sr"><caption>Lecții pe ora de început</caption>
        <thead><tr><th scope="col">Ora</th><th scope="col">Lecții pe săptămână</th></tr></thead>
        <tbody>${hd.counts.map((c, i) => `<tr><td>${U.hh(D.HOURS[i])}</td><td>${c}</td></tr>`).join('')}</tbody>
      </table>`;
  }

  /* ============ Debts per manager ============ */
  function debtRows(m) {
    return D.managers.map(mg => {
      const ss = m.students.filter(s => s.manager === mg.id && s.balance < 0);
      return { mg, n: ss.length, debt: sum(ss, s => s.balance) };
    }).sort((a, b) => a.debt - b.debt);
  }
  function debtHTML(rows) {
    if (!rows.some(r => r.n)) return `<div class="ax-empty"><b>Nicio datorie</b>Niciun elev din filtru nu are sold negativ.</div>`;
    const max = Math.max(1, ...rows.map(r => -r.debt));
    return `
      <ol class="an-debts">
        ${rows.map((r, i) => `
          <li>
            <a class="an-debt" href="#elevi?manager=${r.mg.id}&sold=datorie" data-arrive style="--i:${i}">
              <span class="ax-mgr" data-i="${esc(r.mg.name.split(' ').map(w => w[0]).join(''))}">${esc(r.mg.name)}</span>
              <span class="an-debt__bar" aria-hidden="true"><i style="width:${((-r.debt / max) * 100).toFixed(1)}%"></i></span>
              <span class="an-debt__v"><b>${U.money(r.debt)}</b><span>${U.plural(r.n, 'elev', 'elevi')}</span></span>
              ${ico('arrow-right', 16)}
            </a>
          </li>`).join('')}
      </ol>`;
  }

  function emptyHTML() {
    return `<div class="ax-empty"><b>Nicio grupă în filtru</b>Schimbă proiectul, profesorul sau regimul.</div>`;
  }

  /* ============ CSV of every summary ============ */
  function summaryCSV(m, st) {
    const k = kpis(m, st);
    const gr = gradeRows(m);
    const rd = roomData(m, st);
    const hd = hourData(m);
    const filt = [
      st.project === 'all' ? 'Toate proiectele' : D.project(st.project).name,
      st.teacher ? D.teacher(st.teacher).name : 'Toți profesorii',
      REGIMES.find(r => r[0] === st.regim)[1]
    ].join(', ');
    const rows = [['Analitică Mathorizon', new Date().toLocaleString('ro-RO')], ['Filtru', filt], []];
    rows.push(['Indicatori', 'Valoare', 'Definiție']);
    [...k.groups, ...k.students].forEach(a => rows.push([a.k, a.raw, a.s]));
    rows.push([], ['Distribuția pe clase'], ['Clasă', 'Număr grupe', 'Elevi activi', 'Ore de probă', 'Procentaj']);
    gr.rows.forEach(r => rows.push([r.grade, r.groups, r.active, r.probe, Math.round(r.share) + '%']));
    rows.push([], ['Materii'], ['Materie', 'Grupe active', 'Elevi activi', 'Grad de ocupare', 'Locuri libere']);
    subjectRows(m).forEach(r => rows.push([r.subject, r.groups, r.active, r.seats ? Math.round(ratio(r.enrolled, r.seats)) + '%' : '', r.free]));
    rows.push([], ['Statusul elevilor'], ['Statut', 'Elevi', 'Procent', 'Acțiune recomandată']);
    statusRows(m).forEach(r => rows.push([r.name, r.n, Math.round(r.share) + '%', r.action]));
    if (rd) {
      rows.push([], ['Ocuparea cabinetelor (ore ocupate din ' + SLOTS + ')'], ['Cabinet', ...D.DAYS.map(d => d.name), 'Săptămână', 'Procent']);
      rd.rows.forEach(x => rows.push(['Cabinet ' + x.r.num, ...x.days, x.total, Math.round(ratio(x.total, SLOTS * 7)) + '%']));
    }
    rows.push([], ['Lecții pe ora de început (pe săptămână)'], ['Ora', 'Lecții']);
    hd.counts.forEach((c, i) => rows.push([U.hh(D.HOURS[i]), c]));
    rows.push([], ['Datorii pe manageri'], ['Manager', 'Elevi cu datorie', 'Total datorie (lei)']);
    debtRows(m).forEach(r => rows.push([r.mg.name, r.n, r.debt]));
    return rows;
  }

  /* ============ tooltip ============ */
  let tip = null;
  function tipEl() {
    if (!tip || !tip.isConnected) {
      tip = document.createElement('div');
      tip.className = 'an-tip';
      tip.setAttribute('role', 'tooltip');
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(target) {
    const t = tipEl();
    t.textContent = target.getAttribute('data-tip');
    t.hidden = false;
    const r = target.getBoundingClientRect();
    const tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    let y = r.top - th - 8;
    if (y < 64) y = r.bottom + 8;
    t.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  const hideTip = () => { if (tip) tip.hidden = true; };
  window.addEventListener('scroll', hideTip, { passive: true });
  function wireTips(root) {
    root.addEventListener('mouseover', e => { const t = e.target.closest('[data-tip]'); if (t && root.contains(t)) showTip(t); });
    root.addEventListener('mouseout', e => { const t = e.target.closest('[data-tip]'); if (t && !t.contains(e.relatedTarget)) hideTip(); });
    root.addEventListener('focusin', e => { const t = e.target.closest('[data-tip]'); if (t) showTip(t); });
    root.addEventListener('focusout', hideTip);
  }

  /* ============ page ============ */
  let ro = null;
  let live = null; // { root, ctx } of the mounted page, for demo-data changes
  D.onChange(() => { if (live && live.root.isConnected && location.hash.startsWith('#analitica')) live.ctx.rerender(); });

  function render(root, ctx) {
    const st = readState(ctx.query);
    live = { root, ctx };
    hideTip();
    const stamp = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    const anyFilter = st.project !== 'all' || st.teacher || st.regim !== 'all';
    root.innerHTML = `
      <header class="ax-head an-pagehead">
        <div class="ax-head__t">
          <span class="ax-plate">${ico('chart-column', 24)}</span>
          <div>
            <h1 class="ax-h1">Analitică</h1>
            <p class="ax-lede">Forma activității: grupe, elevi, cabinete și datorii. Calculat la ${stamp}, din datele curente.</p>
          </div>
        </div>
        <div class="ax-head__keys">
          <button type="button" class="ax-btn" id="anCsv">${ico('download', 16)} Export CSV</button>
          <button type="button" class="ax-btn ax-btn--dark" id="anRefresh">${ico('refresh-cw', 16)} Actualizează</button>
        </div>
      </header>
      <div class="an-filters" role="group" aria-label="Filtre pentru toată pagina">
        ${selectHTML('anProject', 'Proiect', [['all', 'Toate proiectele'], ...D.PROJECTS.map(p => [p.id, p.name])], st.project)}
        ${selectHTML('anTeacher', 'Profesor', [['', 'Toți profesorii'], ...TEACHERS.map(t => [t.id, t.name])], st.teacher)}
        ${selectHTML('anRegim', 'Regim', REGIMES, st.regim)}
        ${st.project !== 'all' ? `<span class="ax-line ax-line--${st.project} an-filters__line">${esc(D.project(st.project).name)}</span>` : ''}
        ${anyFilter ? '<button type="button" class="ax-link an-filters__clear" id="anClear">Șterge filtrele</button>' : ''}
      </div>
      <div id="anBody"></div>`;

    const body = root.querySelector('#anBody');
    wireTips(root);

    function paintBody() {
      const m = model(st);
      const gr = gradeRows(m);
      const hd = hourData(m);
      body.innerHTML = `
        ${kpiHTML(kpis(m, st))}
        <p class="an-note">${m.filtered
          ? `Cifrele privesc ${U.plural(m.groups.length, 'grupă', 'grupe')} din filtru și elevii lor. Elevii fără grupă nu intră în calcul când e activ un filtru.`
          : 'Toate grupele și toți elevii. Grupă activă: are statut Activ. Elev activ: are statut Activ, indiferent de statutul grupei.'}</p>

        <section class="ax-panel an-sec" aria-labelledby="anClsT">
          <div class="ax-panel__head an-head">
            <div>
              <h2 class="ax-h2" id="anClsT">Distribuția pe clase</h2>
              <p class="an-def">Grupe de orice statut; elevi activi și ore de probă din aceste grupe. Procentaj: partea clasei din elevii activi. Top 1-3 după elevi activi.</p>
            </div>
            ${selectHTML('anSort', 'Ordonează după', SORTS, st.sort)}
          </div>
          <div class="an-cls">
            <div id="anClsTable">${gradeTableHTML(gr, st.sort)}</div>
            ${gradeChartHTML(gr)}
          </div>
        </section>

        <div class="an-grid">
          <section class="ax-panel an-sec" aria-labelledby="anSubT">
            <div class="ax-panel__head an-head">
              <div>
                <h2 class="ax-h2" id="anSubT">Materii</h2>
                <p class="an-def">Grad de ocupare: elevi înscriși (fără inactivi și transferați) din locurile grupelor active. Locuri libere: în grupele active.</p>
              </div>
            </div>
            ${subjectHTML(subjectRows(m))}
          </section>

          <section class="ax-panel an-sec" aria-labelledby="anStT">
            <div class="ax-panel__head an-head">
              <div>
                <h2 class="ax-h2" id="anStT">Statusul elevilor</h2>
                <p class="an-def">Fiecare elev are un singur statut. Procent din ${U.plural(m.students.length, 'elev', 'elevi')}; acțiunea duce la lista lor.</p>
              </div>
            </div>
            ${statusHTML(statusRows(m), st)}
          </section>
        </div>

        <section class="ax-panel an-sec an-pv-sec" id="anPivot" aria-labelledby="anPvT"></section>

        <div class="an-grid">
          <section class="ax-panel an-sec" aria-labelledby="anRoT">
            <div class="ax-panel__head an-head">
              <div>
                <h2 class="ax-h2" id="anRoT">Ocuparea cabinetelor</h2>
                <p class="an-def">Examen.md Offline, grupe fără statut Inactiv. Ore ocupate pe zi din ${SLOTS} (08:00-21:00); o oră cu două grupe se numără o dată.</p>
              </div>
            </div>
            ${roomsHTML(roomData(m, st))}
            ${roomData(m, st) ? `<div class="an-sec__foot">${heatLegendHTML(true, 100)}</div>` : ''}
          </section>

          <div class="an-stack">
            <section class="ax-panel an-sec" aria-labelledby="anHrT">
              <div class="ax-panel__head an-head">
                <div>
                  <h2 class="ax-h2" id="anHrT">Lecții pe ore</h2>
                  <p class="an-def">Câte lecții încep la fiecare oră, adunate pe toată săptămâna (o grupă de două ori pe săptămână dă două lecții). Fără grupele inactive.</p>
                </div>
              </div>
              <div class="ax-panel__body">${hoursHTML(hd)}</div>
            </section>

            <section class="ax-panel an-sec" aria-labelledby="anDbT">
              <div class="ax-panel__head an-head">
                <div>
                  <h2 class="ax-h2" id="anDbT">Datorii pe manageri</h2>
                  <p class="an-def">Suma soldurilor negative ale elevilor fiecărui manager, orice statut. Deschide lista elevilor cu datorie.</p>
                </div>
              </div>
              ${debtHTML(debtRows(m))}
            </section>
          </div>
        </div>`;

      paintPivot(m);
      const hEl = body.querySelector('#anHours');
      if (hEl) {
        drawHours(hEl, hd);
        if (ro) ro.disconnect();
        let w = hEl.clientWidth;
        ro = new ResizeObserver(() => {
          if (!hEl.isConnected) { ro.disconnect(); return; }
          if (Math.abs(hEl.clientWidth - w) < 2) return;
          w = hEl.clientWidth;
          drawHours(hEl, hd);
        });
        ro.observe(hEl);
      }

      body.querySelector('#anSort').addEventListener('change', e => {
        st.sort = e.target.value; saveState(st);
        body.querySelector('#anClsTable').innerHTML = gradeTableHTML(gr, st.sort);
      });
    }

    function paintPivot(m) {
      const sec = body.querySelector('#anPivot');
      const focusId = document.activeElement && sec.contains(document.activeElement) ? document.activeElement.id : null;
      const scroll = sec.querySelector('.an-pv-wrap') ? sec.querySelector('.an-pv-wrap').scrollLeft : 0;
      sec.innerHTML = pivotHTML(m, st);
      if (focusId && sec.querySelector('#' + focusId)) sec.querySelector('#' + focusId).focus();
      const wrap = sec.querySelector('.an-pv-wrap');
      if (wrap) wrap.scrollLeft = scroll;
      const on = (id, fn) => sec.querySelector('#' + id).addEventListener('change', e => { fn(e.target); saveState(st); hideTip(); paintPivot(model(st)); });
      on('anPa', t => { st.pa = t.value; if (st.pb === st.pa) st.pb = Object.keys(DIMS).find(k => k !== st.pa); });
      on('anPb', t => { st.pb = t.value; });
      on('anPv', t => { st.pv = t.value; });
      on('anPst', t => { st.pst = t.value; });
      on('anHeat', t => { st.heat = t.checked; });
      sec.querySelector('#anPvCsv').addEventListener('click', () => {
        U.downloadCSV(`analitica-tabel-${st.pa}-${st.pb}.csv`, pivotCSV(model(st), st));
        U.toast('Tabelul încrucișat a fost exportat.');
      });
    }

    const onFilter = (id, key) => root.querySelector('#' + id).addEventListener('change', e => {
      st[key] = e.target.value; saveState(st); ctx.rerender();
    });
    onFilter('anProject', 'project');
    onFilter('anTeacher', 'teacher');
    onFilter('anRegim', 'regim');
    root.querySelector('#anClear')?.addEventListener('click', () => {
      st.project = 'all'; st.teacher = ''; st.regim = 'all'; saveState(st); ctx.rerender();
    });
    root.querySelector('#anCsv').addEventListener('click', () => {
      U.downloadCSV('analitica-sumar.csv', summaryCSV(model(st), st));
      U.toast('Toate tabelele de sumar au fost exportate.');
    });
    root.querySelector('#anRefresh').addEventListener('click', () => {
      ctx.rerender();
      U.toast('Cifrele au fost recalculate.');
    });

    paintBody();
  }

  window.AdminViews.analitica = {
    title: 'Analitică',
    icon: 'chart-column',
    render
  };
})();
