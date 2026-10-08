/* ============================================================
   Admin console: Elevi (students)
   ============================================================
   Every student with presence at the last 3 lessons, manager and
   status, balance, and the group they sit in (teacher, grade,
   schedule). A summary strip for the current selection, a filter
   rail split into group filters and student filters, everything in
   the address (#elevi?sold=datorie&sort=balance, ?manager=m2, ...).
   A row opens a drawer with the student's profile and group.
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico, nf } = U;
  const PER = 60;

  /* ---- small helpers (local to this view) ---- */
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tokens = s => norm(s).split(/\s+/).filter(Boolean);
  const digits = s => String(s == null ? '' : s).replace(/\D/g, '');
  function countWord(n, one, many) {
    const r = n % 100;
    return nf.format(n) + ' ' + (n === 1 ? one : (n === 0 || (r >= 1 && r <= 19)) ? many : 'de ' + many);
  }
  const timeRange = g => `${U.hh(g.start)}-${U.hh(g.start + g.duration)}`;
  const dayNames = g => g.days.map(d => D.DAYS[d - 1].name).join(' / ');
  const sizeLabel = n => `Grup cu ${n} ${n === 1 ? 'elev' : 'elevi'}`;
  const statusName = (list, id) => (list.find(s => s.id === id) || { name: id }).name;
  const stHTML = (id, name) => `<span class="ax-st ax-st--${esc(id)}"><i class="ax-st__i" aria-hidden="true"></i>${esc(name)}</span>`;
  const PRES = { p: ['P', 'Prezent'], a: ['A', 'Absent'], m: ['M', 'Motivat'] };
  const presHTML = arr => `<span class="ax-pres" role="img" aria-label="Ultimele 3 lecții, cea mai recentă la urmă: ${arr.map(x => PRES[x][1].toLowerCase()).join(', ')}">${arr.map(x => `<i class="${x}" aria-hidden="true">${PRES[x][0]}</i>`).join('')}</span>`;
  const absences = st => st.presence.filter(x => x !== 'p').length;
  function fmtDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const fmtPhone = p => (/^\+373\d{8}$/.test(p) ? `${p.slice(0, 4)} ${p.slice(4, 6)} ${p.slice(6, 9)} ${p.slice(9)}` : p);
  const initials = name => String(name).split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const mgrHTML = m => m ? `<span class="ax-mgr" data-i="${esc(initials(m.name))}">${esc(m.name)}</span>` : '';

  const FIELDS = {
    elev: { label: 'Elev', ph: 'Nume elev' },
    tel: { label: 'Telefon', ph: 'Număr de telefon' },
    prof: { label: 'Profesor', ph: 'Nume profesor' },
    mgr: { label: 'Manager', ph: 'Nume manager' }
  };
  const SOLD = {
    datorie: { label: 'Datorie', btn: 'Datorie', test: s => s.balance < 0 },
    lazi: { label: 'La zi', btn: 'La zi', test: s => s.balance >= 0 },
    mare: { label: 'Datorie peste 1 000 lei', btn: 'Peste 1 000 lei', test: s => s.balance <= -1000 }
  };
  const LISTS = ['project', 'dur', 'gstatus', 'subj', 'grade', 'size', 'profile', 'status', 'level', 'manager', 'abs'];
  const gradeIdx = st => { const g = st.group && D.group(st.group); return g ? D.GRADES.indexOf(g.grade) : null; };
  const SORTS = {
    name: { label: 'Nume', def: 'asc', key: st => norm(st.name) },
    pres: { label: 'Prezențe', def: 'desc', key: st => absences(st) },
    balance: { label: 'Sold', def: 'asc', key: st => st.balance },
    grade: { label: 'Clasa', def: 'asc', key: gradeIdx }
  };

  function readState(q) {
    const s = {};
    LISTS.forEach(k => { s[k] = U.listParam(q, k); });
    s.q = q.q || '';
    s.in = FIELDS[q.in] ? q.in : 'elev';
    s.vara = q.vara === '1';
    s.sold = SOLD[q.sold] ? q.sold : '';
    s.sort = SORTS[q.sort] ? q.sort : 'name';
    s.dir = q.dir === 'desc' || q.dir === 'asc' ? q.dir : SORTS[s.sort].def;
    return s;
  }
  function writeState(s) {
    const o = {};
    LISTS.forEach(k => { o[k] = s[k]; });
    Object.assign(o, {
      q: s.q.trim(), in: s.in === 'elev' ? '' : s.in, vara: s.vara ? '1' : '', sold: s.sold,
      sort: s.sort === 'name' ? '' : s.sort,
      dir: s.dir === SORTS[s.sort].def ? '' : s.dir
    });
    U.writeQuery(o);
  }

  function searchHit(st, s) {
    const q = s.q.trim();
    if (!q) return true;
    const tk = tokens(q);
    const has = name => { const n = norm(name); return tk.every(t => n.includes(t)); };
    if (s.in === 'tel') {
      const ds = digits(q);
      return ds ? digits(st.phone).includes(ds) : st.phone.includes(q);
    }
    if (s.in === 'prof') { const g = st.group && D.group(st.group); return !!g && has(D.teacher(g.teacher).name); }
    if (s.in === 'mgr') { const m = D.manager(st.manager); return !!m && has(m.name); }
    return has(st.name);
  }

  function filtered(s) {
    const groupOn = s.project.length || s.dur.length || s.gstatus.length || s.subj.length || s.grade.length || s.size.length || s.profile.length || s.vara;
    return D.students.filter(st => {
      if (!searchHit(st, s)) return false;
      if (groupOn) {
        const g = st.group && D.group(st.group);
        if (!g) return false;
        if (s.project.length && !s.project.includes(g.project)) return false;
        if (s.dur.length && !s.dur.includes(String(g.duration))) return false;
        if (s.gstatus.length && !s.gstatus.includes(g.status)) return false;
        if (s.subj.length && !s.subj.includes(g.subject)) return false;
        if (s.grade.length && !s.grade.includes(g.grade)) return false;
        if (s.size.length && !s.size.includes(String(g.size))) return false;
        if (s.profile.length && !s.profile.includes(g.profile)) return false;
        if (s.vara && g.regime !== 'vara') return false;
      }
      if (s.status.length && !s.status.includes(st.status)) return false;
      if (s.level.length && !s.level.includes(st.level)) return false;
      if (s.manager.length && !s.manager.includes(st.manager)) return false;
      if (s.abs.length && !s.abs.includes(String(absences(st)))) return false;
      if (s.sold && !SOLD[s.sold].test(st)) return false;
      return true;
    });
  }

  function sorted(list, s) {
    const k = SORTS[s.sort].key;
    const m = s.dir === 'desc' ? -1 : 1;
    return list.map(st => [k(st), norm(st.name), st]).sort((a, b) => {
      // students without a value (no group, for Clasa) always go last
      if (a[0] == null || b[0] == null) {
        if (a[0] == null && b[0] != null) return 1;
        if (b[0] == null && a[0] != null) return -1;
      } else if (a[0] !== b[0]) return (a[0] < b[0] ? -1 : 1) * m;
      return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
    }).map(x => x[2]);
  }

  /* ---- chips ---- */
  function chipItems(s) {
    const out = [];
    const rm = (k, v) => st => { st[k] = st[k].filter(x => x !== v); };
    if (s.q.trim()) out.push({ label: `${FIELDS[s.in].label}: ${s.q.trim()}`, remove: st => { st.q = ''; } });
    s.project.forEach(v => out.push({ label: (D.project(v) || { name: v }).name, remove: rm('project', v) }));
    s.dur.forEach(v => out.push({ label: v === '1' ? 'Ore de 1 oră' : 'Ore de 2 ore', remove: rm('dur', v) }));
    s.gstatus.forEach(v => out.push({ label: 'Statut grup: ' + statusName(D.GROUP_STATUS, v), remove: rm('gstatus', v) }));
    s.subj.forEach(v => out.push({ label: v, remove: rm('subj', v) }));
    s.grade.forEach(v => out.push({ label: 'Clasa ' + v, remove: rm('grade', v) }));
    s.size.forEach(v => out.push({ label: sizeLabel(+v), remove: rm('size', v) }));
    s.profile.forEach(v => out.push({ label: 'Profil ' + v, remove: rm('profile', v) }));
    if (s.vara) out.push({ label: 'Școala de Vară', remove: st => { st.vara = false; } });
    s.status.forEach(v => out.push({ label: 'Statut elev: ' + statusName(D.STUDENT_STATUS, v), remove: rm('status', v) }));
    s.level.forEach(v => out.push({ label: 'Nivel ' + v, remove: rm('level', v) }));
    s.manager.forEach(v => out.push({ label: 'Manager: ' + ((D.manager(v) || { name: v }).name), remove: rm('manager', v) }));
    s.abs.forEach(v => out.push({ label: v === '1' ? '1 absență' : `${v} absențe`, remove: rm('abs', v) }));
    if (s.sold) out.push({ label: 'Sold: ' + SOLD[s.sold].label, remove: st => { st.sold = ''; } });
    return out;
  }

  /* ---- markup ---- */
  function statsHTML(list) {
    const act = list.filter(st => st.status === 'activ').length;
    const debtors = list.filter(st => st.balance < 0);
    const neg = debtors.reduce((t, st) => t + st.balance, 0);
    const abs = list.filter(st => absences(st) > 0).length;
    const v = (n, unit) => `<span class="ax-stat__v">${n}${unit ? `<small class="el-unit">${unit}</small>` : ''}</span>`;
    return `
      <div class="ax-stat" data-arrive style="--i:0"><span class="ax-stat__k">${ico('users', 16)} Elevi în listă</span>${v(nf.format(list.length))}<span class="ax-stat__s">din ${nf.format(D.students.length)} în total</span></div>
      <div class="ax-stat" data-arrive style="--i:1"><span class="ax-stat__k">${ico('circle-check', 16)} Activi</span>${v(nf.format(act))}<span class="ax-stat__s">${U.pct(act, list.length)}% din listă</span></div>
      <div class="ax-stat" data-arrive style="--i:2"><span class="ax-stat__k">${ico('wallet', 16)} Sold total negativ</span>${v((neg < 0 ? '−' : '') + nf.format(Math.abs(neg)), 'lei')}<span class="ax-stat__s">${countWord(debtors.length, 'elev', 'elevi')} cu datorie</span></div>
      <div class="ax-stat" data-arrive style="--i:3"><span class="ax-stat__k">${ico('calendar', 16)} Cu absențe recente</span>${v(nf.format(abs))}<span class="ax-stat__s">Cel puțin o absență în ultimele 3 lecții</span></div>`;
  }

  function segHTML(k, label, opts, s, cls) {
    const id = 'elL' + k;
    const on = v => (Array.isArray(s[k]) ? s[k].includes(v) : s[k] === v);
    return `
      <span class="ax-rail__lbl" id="${id}">${esc(label)}</span>
      <div class="ax-seg el-seg${cls ? ' ' + cls : ''}" role="group" aria-labelledby="${id}">
        ${opts.map(o => `<button type="button" data-k="${k}" data-v="${esc(o.v)}" aria-pressed="${on(o.v)}"${o.title ? ` title="${esc(o.title)}"` : ''}>${esc(o.l)}</button>`).join('')}
      </div>`;
  }

  function railHTML(s, open) {
    return `
      <div class="ax-rail__head">
        <b>Filtre</b>
        <button type="button" class="ax-btn ax-btn--sm el-rail__tg" aria-expanded="${open}" aria-controls="elRail">
          ${ico('filter', 16)}<span>${open ? 'Ascunde filtrele' : 'Arată filtrele'}</span><span class="el-rail__n" data-railn></span>
        </button>
      </div>
      <label class="ax-rail__lbl" for="elIn">Caută după</label>
      <div class="el-find">
        <select id="elIn" class="ax-select">${Object.entries(FIELDS).map(([k, f]) => `<option value="${k}"${s.in === k ? ' selected' : ''}>${esc(f.label)}</option>`).join('')}</select>
        <div class="ax-search">${ico('search', 16)}<input id="elQ" class="ax-input" type="search" autocomplete="off" aria-label="Caută" placeholder="${esc(FIELDS[s.in].ph)}" value="${esc(s.q)}"></div>
      </div>
      <span class="el-sect">${ico('grid', 14)} Grupa</span>
      <div data-ms="project"></div>
      ${segHTML('dur', 'Formatul orelor', [{ v: '1', l: '1 oră' }, { v: '2', l: '2 ore' }], s, 'el-seg--fill')}
      <div data-ms="gstatus"></div>
      <div data-ms="subj"></div>
      <div data-ms="grade"></div>
      <div data-ms="size"></div>
      ${segHTML('profile', 'Profil', [{ v: 'Real', l: 'Real' }, { v: 'Uman', l: 'Uman' }], s, 'el-seg--fill')}
      <label class="ax-switch el-switch"><input type="checkbox" data-vara${s.vara ? ' checked' : ''}><span class="ax-switch__t" aria-hidden="true"></span>Doar Școala de Vară</label>
      <div class="ax-rail__sep"></div>
      <span class="el-sect">${ico('user', 14)} Elevul</span>
      <div data-ms="status"></div>
      <div data-ms="level"></div>
      <div data-ms="manager"></div>
      ${segHTML('abs', 'Absențe în ultimele 3 lecții', ['0', '1', '2', '3'].map(v => ({ v, l: v, title: v === '1' ? '1 absență' : v + ' absențe' })), s, 'el-seg--fill')}
      ${segHTML('sold', 'Sold', Object.entries(SOLD).map(([v, o]) => ({ v, l: o.btn, title: o.label })), s, 'el-seg--fill el-seg--sold')}
      <div class="ax-rail__sep"></div>
      <button type="button" class="ax-btn el-clear" data-clearall>${ico('x', 16)} Șterge toate filtrele</button>`;
  }

  function thHTML(k, s, extra, tip) {
    const on = s.sort === k;
    const icon = on ? ico(s.dir === 'asc' ? 'chevron-up' : 'chevron-down', 14) : ico('sort', 14);
    return `<th data-sort="${k}"${on ? ` aria-sort="${s.dir === 'asc' ? 'ascending' : 'descending'}"` : ''}${extra || ''}>
      <button type="button" class="el-sort${on ? ' is-on' : ''}"${tip ? ` title="${esc(tip)}"` : ''}>${esc(SORTS[k].label)}${icon}</button></th>`;
  }
  const PRES_TIP = 'Ultimele 3 lecții, cea mai recentă la dreapta. P prezent, A absent, M absent motivat. Sortarea pune întâi elevii cu mai multe absențe.';

  function rowHTML(st, i) {
    const g = st.group && D.group(st.group);
    const m = D.manager(st.manager);
    let groupCells;
    if (g) {
      const t = D.teacher(g.teacher);
      const p = D.project(g.project);
      const room = g.room ? D.room(g.room) : null;
      groupCells = `
        <td><span class="ax-strong">${esc(t.name)}</span><span class="el-proj"><span class="ax-line ax-line--${p.id}">${esc(p.short)}</span></span><span class="ax-sub">${esc(g.subject)}, ${p.mode === 'offline' ? 'offline' : 'online'}</span></td>
        <td>
          <span class="el-cls"><span class="ax-grade">${esc(g.grade)}</span><span class="ax-sub">${g.profile ? `<span class="el-nw">${esc(g.profile)},</span> ` : ''}<span class="el-nw">nivel ${esc(g.level)}</span></span></span>
          <span class="el-size">${sizeLabel(g.size)}</span>
          ${stHTML(g.status, statusName(D.GROUP_STATUS, g.status))}
        </td>
        <td><b class="el-days">${g.days.map(d => `<span>${esc(D.DAYS[d - 1].name)}</span>`).join(' / ')}</b><span class="el-time">${timeRange(g)}${room ? `<span class="el-room">Cab. ${room.num}</span>` : ''}</span></td>`;
    } else {
      groupCells = `<td colspan="3"><span class="el-nogroup">Fără grupă</span></td>`;
    }
    return `
      <tr data-open="${st.id}" tabindex="0" data-arrive style="--i:${i}" aria-label="${esc(st.name)}">
        <td><b class="el-name">${esc(st.name)}</b><a class="el-tel" href="tel:${esc(st.phone)}">${esc(fmtPhone(st.phone))}</a></td>
        <td>${presHTML(st.presence)}</td>
        <td>${stHTML(st.status, statusName(D.STUDENT_STATUS, st.status))}<span class="el-mgr">${m ? `<span class="ax-mgr" data-i="${esc(initials(m.name))}" title="${esc(m.name)}">${esc(m.short)}</span>` : ''}</span></td>
        <td class="ax-num"><span class="el-bal${st.balance < 0 ? ' ax-neg' : st.balance === 0 ? ' is-zero' : ''}">${U.money(st.balance)}</span></td>
        ${groupCells}
        <td class="el-hist"><button type="button" class="el-hbtn" data-hist="${st.id}" aria-label="Istoricul lui ${esc(st.name)}" title="Parcursul elevului">${ico('history', 16)}<span>Istoric</span></button></td>
      </tr>`;
  }

  function mainHTML(s, list, limit) {
    const items = chipItems(s);
    const rows = list.slice(0, limit);
    const rest = list.length - rows.length;
    const sortTxt = SORTS[s.sort].label.toLowerCase() + (s.dir === 'asc' ? ', crescător' : ', descrescător');
    return `
      ${U.activeChips(items)}
      <div class="el-bar">
        <p class="el-count" aria-live="polite"><b>${countWord(list.length, 'elev', 'elevi')}</b> din ${nf.format(D.students.length)}</p>
        <p class="ax-sub">Sortat după ${esc(sortTxt)}</p>
      </div>
      ${list.length ? `
      <div class="ax-table-wrap">
        <table class="ax-table el-table">
          <caption class="el-vh">Elevi, ${countWord(list.length, 'elev', 'elevi')}</caption>
          <thead><tr>
            ${thHTML('name', s)}
            ${thHTML('pres', s, '', PRES_TIP)}
            <th scope="col">Manager</th>
            ${thHTML('balance', s, ' class="ax-num"')}
            <th scope="col">Profesor</th>
            ${thHTML('grade', s)}
            <th scope="col">Orar</th>
            <th scope="col" class="el-hist"><span class="or-vh">Istoric</span></th>
          </tr></thead>
          <tbody>${rows.map((st, i) => rowHTML(st, i)).join('')}</tbody>
        </table>
      </div>
      <p class="el-legend" aria-hidden="true">${presHTML(['p', 'a', 'm'])}<span>Prezențe: P prezent, A absent, M absent motivat; cea mai recentă lecție la dreapta.</span></p>
      ${rest > 0 ? `<div class="el-morebar"><button type="button" class="ax-btn" data-more>Arată încă ${nf.format(Math.min(PER, rest))}</button><span class="ax-sub">${nf.format(rows.length)} afișați din ${nf.format(list.length)}</span></div>` : ''}`
      : `<div class="ax-panel ax-empty"><b>Niciun elev nu se potrivește filtrelor.</b>Scoate unul dintre filtre sau pornește de la zero.<div class="el-empty-k"><button type="button" class="ax-btn" data-clearall>Șterge toate filtrele</button></div></div>`}`;
  }

  /* ---- drawer ---- */
  function openStudent(sid) {
    const st = D.students.find(x => x.id === sid);
    if (!st) return;
    const m = D.manager(st.manager);
    const g = st.group && D.group(st.group);
    const abs = absences(st);
    let note;
    if (st.balance <= -1000) note = 'Datorie peste 1 000 lei. De sunat părintele în această săptămână.';
    else if (st.balance < 0) note = 'Are de achitat restul pentru lecțiile ținute.';
    else if (st.balance > 0) note = 'La zi, cu avans pentru lecțiile următoare.';
    else note = 'La zi.';
    const LBL = ['Acum trei lecții', 'Penultima', 'Ultima'];
    let groupHTML;
    if (g) {
      const t = D.teacher(g.teacher);
      const p = D.project(g.project);
      const room = g.room ? D.room(g.room) : null;
      groupHTML = `
        <div class="el-dw__group">
          <div class="el-dw__gsigns"><span class="ax-line ax-line--${p.id}">${esc(p.name)}</span>${stHTML(g.status, statusName(D.GROUP_STATUS, g.status))}${g.regime === 'vara' ? '<span class="ax-tag ax-tag--sun">Școala de Vară</span>' : ''}</div>
          <dl class="ax-dl">
            <dt>Profesor</dt><dd>${esc(t.name)}<span class="ax-sub">${esc(g.subject)}</span></dd>
            <dt>Program</dt><dd>${esc(dayNames(g))}, ${timeRange(g)}</dd>
            <dt>Cabinet</dt><dd>${room ? esc(room.name) + `<span class="ax-sub">Etajul ${room.floor}</span>` : 'Online'}</dd>
            <dt>Grupa</dt><dd>${sizeLabel(g.size)}, clasa ${esc(g.grade)}${g.profile ? ', ' + esc(g.profile) : ''}<span class="ax-sub">Nivel ${esc(g.level)}, ${D.freeSeats(g) ? (D.freeSeats(g) === 1 ? '1 loc liber' : D.freeSeats(g) + ' locuri libere') : 'completă'}</span></dd>
          </dl>
          <a class="ax-link el-dw__go" href="#orar?prof=${encodeURIComponent(t.name)}" data-go>Grupele profesorului în Orar ${ico('arrow-right', 16)}</a>
        </div>`;
    } else {
      groupHTML = '<p class="el-dw__none">Elevul nu este într-o grupă acum.</p>';
    }
    const hist = D.transfersOf(st.id).map(t => {
      const a = D.group(t.from), b = D.group(t.to);
      return `<li><span class="ax-sub">${esc(fmtDate(t.iso))}</span><span>${esc(D.teacher(a.teacher).name)}, ${esc(dayNames(a))} ${timeRange(a)} ${ico('arrow-right', 14)} <b>${esc(D.teacher(b.teacher).name)}</b>, ${esc(dayNames(b))} ${timeRange(b)}</span></li>`;
    });
    if (hist.length) groupHTML += `<div class="el-dw__moves"><h4>Transferuri</h4><ul>${hist.join('')}</ul><p class="ax-sub">În grupa veche rămân prezențele și banii, cu statutul Transferat.</p></div>`;
    // Registre: the student's column in his group's sheet, with what can be written there (status, manager, a payment or a discount)
    const col = D.readOnly() && g ? D.registry.columnOf(st.id, g.id) : null;
    const STATUSES = ['Activ', 'Oră de probă', 'Oră de probă confirmată', 'Înlocuire', 'Transferat', 'Inactiv'];
    const regHTML = col ? `
          <section class="el-reg" aria-label="În registru">
            <h3 class="el-dw__h">În registru <span>coloana ${esc(col.col)}, grupa ${esc(g.subject)} ${esc(g.grade)}</span></h3>
            <div class="el-reg__row"><label>Statut<select class="ax-select" data-reg-status>${STATUSES.map(x => `<option${x === col.status ? ' selected' : ''}>${esc(x)}</option>`).join('')}${STATUSES.includes(col.status) ? '' : `<option selected>${esc(col.status || '')}</option>`}</select></label>
              <button type="button" class="ax-btn ax-btn--sm" data-reg-do="status">Salvează</button></div>
            <div class="el-reg__row"><label>Manager<select class="ax-select" data-reg-mgr>${D.managers.map(x => `<option value="${esc(x._reg || x.name)}"${(x._reg || x.name) === col.manager ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}${col.manager ? '' : '<option value="" selected>fără manager</option>'}</select></label>
              <button type="button" class="ax-btn ax-btn--sm" data-reg-do="mgr">Salvează</button></div>
            <div class="el-reg__row"><label>Sumă (lei)<input class="ax-input" data-reg-amount inputmode="decimal" placeholder="ex. 600" autocomplete="off"></label>
              <label>Ce este<select class="ax-select" data-reg-kind><option value="pay">Plată</option><option value="disc">Reducere</option><option value="refund">Retur (scade din plată)</option></select></label>
              <button type="button" class="ax-btn ax-btn--sm" data-reg-do="pay">Adaugă</button></div>
            <p class="el-reg__msg" data-reg-msg role="status"></p>
          </section>` : '';
    const el = U.drawer({
      title: esc(st.name),
      sub: `${esc(statusName(D.STUDENT_STATUS, st.status))} · manager ${esc(m ? m.name : '-')}`,
      body: `
        <div class="el-dw">
          <section class="el-dw__bal${st.balance < 0 ? ' is-debt' : ''}${st.balance <= -1000 ? ' is-big' : ''}" aria-label="Sold">
            <span class="el-dw__k">Sold${st.balance <= -1000 ? '<span class="ax-hazard el-dw__haz" aria-hidden="true"></span>' : ''}</span>
            <b class="${st.balance < 0 ? 'ax-neg' : ''}">${U.money(st.balance)}</b>
            <p>${esc(note)}</p>
          </section>
          <dl class="ax-dl">
            <dt>Telefon</dt><dd><a class="el-dw__tel" href="tel:${esc(st.phone)}">${ico('phone', 14)} ${esc(fmtPhone(st.phone))}</a></dd>
            <dt>Manager</dt><dd>${mgrHTML(m)}</dd>
            <dt>Statut</dt><dd>${stHTML(st.status, statusName(D.STUDENT_STATUS, st.status))}</dd>
            <dt>Nivel</dt><dd>${esc(st.level)}</dd>
            <dt>Înscris din</dt><dd>${esc(fmtDate(st.joinedAt))}</dd>
          </dl>
          <section>
            <h3 class="el-dw__h">Ultimele 3 lecții <span>${abs ? (abs === 1 ? '1 absență' : abs + ' absențe') : 'fără absențe'}</span></h3>
            <ol class="el-dw__pres">
              ${st.presence.map((x, i) => `<li><span class="ax-pres"><i class="${x}" aria-hidden="true">${PRES[x][0]}</i></span><span><b>${PRES[x][1]}</b><span class="ax-sub">${LBL[i]}</span></span></li>`).join('')}
            </ol>
          </section>
          <section>
            <h3 class="el-dw__h">Grupa</h3>
            ${groupHTML}
          </section>
          ${regHTML}
        </div>`,
      actions: `
        <button type="button" class="ax-btn" data-journey>${ico('history', 16)} Istoric</button>
        <a class="ax-btn" href="tel:${esc(st.phone)}">${ico('phone', 16)} Sună</a>
        ${g ? `<a class="ax-btn ax-btn--dark" href="#orar?prof=${encodeURIComponent(D.teacher(g.teacher).name)}" data-go>${ico('grid', 16)} Orarul profesorului</a>` : ''}`
    });
    el.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', () => el.close()));
    if (col) {
      const msg = el.querySelector('[data-reg-msg]');
      const colNo = col.col.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
      const who = { col: colNo, name: col.name, phone: col.phone };
      const say = (text, bad) => { msg.textContent = text; msg.classList.toggle('is-bad', !!bad); };
      el.querySelectorAll('[data-reg-do]').forEach(b => b.addEventListener('click', async () => {
        const kind = b.dataset.regDo;
        let type, payload, done;
        if (kind === 'status') {
          const v = el.querySelector('[data-reg-status]').value;
          if (v === col.status) { say('Statutul e deja acesta.'); return; }
          type = 'SET_STATUS'; payload = { student: who, status: v, expectStatus: col.status }; done = 'Statutul a fost schimbat în registru.';
        } else if (kind === 'mgr') {
          const v = el.querySelector('[data-reg-mgr]').value;
          if (!v || v === col.manager) { say('Managerul e deja acesta.'); return; }
          type = 'SET_MANAGER'; payload = { student: who, manager: v }; done = 'Managerul a fost schimbat în registru.';
        } else {
          const raw = el.querySelector('[data-reg-amount]').value.replace(',', '.').trim(), n = Number(raw), k = el.querySelector('[data-reg-kind]').value;
          if (!raw || !Number.isFinite(n) || n <= 0 || Math.round(n * 100) !== n * 100) { say('Scrie o sumă mai mare ca zero, cu cel mult 2 zecimale.', true); return; }
          type = k === 'disc' ? 'ADD_DISCOUNT' : 'ADD_PAYMENT'; payload = { student: who, amount: k === 'refund' ? -n : n };
          done = k === 'disc' ? 'Reducerea a fost adăugată în registru.' : k === 'refund' ? 'Returul a fost scris în registru.' : 'Plata a fost adăugată în registru.';
        }
        el.querySelectorAll('[data-reg-do]').forEach(x => { x.disabled = true; });
        say('Se scrie în registru…');
        const r = await window.AdminRegistry.command(g.id, type, payload);
        if (r.ok || r.status === 'noop') { U.toast(esc(r.status === 'noop' ? 'Era deja așa în registru.' : done)); el.close(); setTimeout(() => openStudent(sid), 220); return; }
        el.querySelectorAll('[data-reg-do]').forEach(x => { x.disabled = false; });
        say(r.status === 'conflict' ? `${r.msg} Nu am scris nimic: încearcă din nou.` : (r.msg || 'Nu s-a putut scrie în registru.'), true);
      }));
    }
    const jb = el.querySelector('[data-journey]');
    if (jb) jb.addEventListener('click', () => { el.close(); window.AdminJourney.open(st.id); });
  }

  /* ---- view ---- */
  let railOpen = false;

  function render(root, ctx) {
    const s = readState(ctx.query || {});
    let limit = PER;

    root.innerHTML = `
      <div class="ax-fixsplit el-split">
        <aside class="ax-rail is-collapsible el-rail${railOpen ? ' is-open' : ''}" id="elRail" aria-label="Filtre">${railHTML(s, railOpen)}</aside>
        <div class="ax-col">
          <header class="ax-head">
        <div class="ax-head__t">
          <span class="ax-plate">${ico('users', 24)}</span>
          <div>
            <h1 class="ax-h1">Elevi</h1>
            <p class="ax-lede">Prezența, soldul și grupa fiecărui elev. Filtrele rămân în adresa paginii.</p>
          </div>
        </div>
        <div class="ax-head__keys">
          <button type="button" class="ax-btn" data-csv>${ico('download', 16)} Export CSV</button>
        </div>
      </header>
          <section class="ax-stats el-stats" aria-label="Rezumatul listei" data-stats></section>
          <div class="el-main" data-main></div>
        </div>
      </div>`;

    const rail = root.querySelector('.el-rail');
    const main = root.querySelector('[data-main]');
    const stats = root.querySelector('[data-stats]');
    let list = [];

    function paintMain() {
      main.innerHTML = mainHTML(s, list, limit);
      if (limit === PER) U.stagger(main.querySelector('tbody'), 14, 12);
      const items = chipItems(s);
      U.wireActiveChips(main, items, it => { it.remove(s); writeState(s); ctx.rerender(); }, clearAll);
      rail.querySelector('[data-railn]').textContent = items.length ? items.length : '';
    }
    function update() {
      limit = PER;
      writeState(s);
      list = sorted(filtered(s), s);
      stats.innerHTML = statsHTML(list);
      paintMain();
    }
    function clearAll() {
      LISTS.forEach(k => { s[k] = []; });
      s.q = ''; s.vara = false; s.sold = '';
      writeState(s);
      ctx.rerender();
    }

    /* multi-selects */
    const countS = fn => { const m = {}; D.students.forEach(st => { const k = fn(st); m[k] = (m[k] || 0) + 1; }); return m; };
    // group options count the students sitting in such groups
    const countSG = fn => countS(st => { const g = st.group && D.group(st.group); return g ? fn(g) : null; });
    const msDefs = {
      project: { label: 'Proiect', opts: D.PROJECTS.map(x => ({ value: x.id, label: x.name })), c: countSG(g => g.project) },
      gstatus: { label: 'Statut grup', tone: true, opts: D.GROUP_STATUS.map(x => ({ value: x.id, label: x.name })), c: countSG(g => g.status) },
      subj: { label: 'Disciplină', opts: D.SUBJECTS.map(x => ({ value: x, label: x })), c: countSG(g => g.subject) },
      grade: { label: 'Clasa', opts: D.GRADES.map(x => ({ value: x, label: 'Clasa ' + x })), c: countSG(g => g.grade) },
      size: { label: 'Format grup', opts: [1, 2, 3, 4, 5, 6, 8].map(n => ({ value: String(n), label: sizeLabel(n) })), c: countSG(g => String(g.size)) },
      status: { label: 'Statut elev', tone: true, opts: D.STUDENT_STATUS.map(x => ({ value: x.id, label: x.name })), c: countS(st => st.status) },
      level: { label: 'Nivel de cunoștințe', opts: D.LEVELS.map(x => ({ value: x, label: 'Nivel ' + x })), c: countS(st => st.level) },
      manager: { label: 'Manager', opts: D.managers.map(x => ({ value: x.id, label: x.name })), c: countS(st => st.manager) }
    };
    Object.entries(msDefs).forEach(([k, def]) => {
      const opts = def.opts.filter(o => def.c[o.value]).map(o => Object.assign({}, o, { count: def.c[o.value] }));
      const ms = U.multiSelect({ id: 'el-' + k, label: def.label, options: opts, selected: s[k], tone: !!def.tone, onChange: v => { s[k] = v; update(); } });
      rail.querySelector(`[data-ms="${k}"]`).replaceWith(ms);
    });

    /* segmented toggles (sold is a single choice) */
    rail.querySelectorAll('.el-seg button[data-k]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k, v = b.dataset.v;
      if (k === 'sold') {
        s.sold = s.sold === v ? '' : v;
        b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === s.sold)));
      } else {
        s[k] = s[k].includes(v) ? s[k].filter(x => x !== v) : s[k].concat(v);
        b.setAttribute('aria-pressed', String(s[k].includes(v)));
      }
      update();
    }));
    rail.querySelector('[data-vara]').addEventListener('change', e => { s.vara = e.target.checked; update(); });
    const qIn = rail.querySelector('#elQ');
    let tm = null;
    qIn.addEventListener('input', () => { s.q = qIn.value; clearTimeout(tm); tm = setTimeout(update, 140); });
    rail.querySelector('#elIn').addEventListener('change', e => {
      s.in = e.target.value;
      qIn.placeholder = FIELDS[s.in].ph;
      update();
    });
    rail.querySelector('[data-clearall]').addEventListener('click', clearAll);
    const tg = rail.querySelector('.el-rail__tg');
    tg.addEventListener('click', () => {
      railOpen = !rail.classList.contains('is-open');
      rail.classList.toggle('is-open', railOpen);
      tg.setAttribute('aria-expanded', String(railOpen));
      tg.querySelector('span').textContent = railOpen ? 'Ascunde filtrele' : 'Arată filtrele';
    });

    /* table: sort, open, more */
    main.addEventListener('click', e => {
      const th = e.target.closest('th[data-sort]');
      if (th) {
        const k = th.dataset.sort;
        if (s.sort === k) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
        else { s.sort = k; s.dir = SORTS[k].def; }
        writeState(s);
        list = sorted(filtered(s), s);
        paintMain();
        const again = main.querySelector(`th[data-sort="${k}"] button`);
        if (again) again.focus();
        return;
      }
      if (e.target.closest('[data-more]')) {
        limit += PER;
        paintMain();
        const first = main.querySelectorAll('tbody tr')[limit - PER];
        if (first) first.focus();
        return;
      }
      if (e.target.closest('[data-clearall]')) { clearAll(); return; }
      const hb = e.target.closest('[data-hist]');
      if (hb) { window.AdminJourney.open(hb.dataset.hist); return; }
      const tr = e.target.closest('tr[data-open]');
      if (tr && !e.target.closest('a,button')) openStudent(tr.dataset.open);
    });
    main.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tr = e.target.closest('tr[data-open]');
      if (tr && e.target === tr) { e.preventDefault(); openStudent(tr.dataset.open); }
    });

    /* export */
    root.querySelector('[data-csv]').addEventListener('click', () => {
      const rows = [['Nume', 'Telefon', 'Statut', 'Manager', 'Sold (lei)', 'Prezențe (ultimele 3)', 'Nivel', 'Profesor', 'Proiect', 'Disciplină', 'Clasa', 'Grupa', 'Statut grup', 'Zile', 'Ora', 'Cabinet', 'Înscris din']];
      list.forEach(st => {
        const g = st.group && D.group(st.group);
        const t = g && D.teacher(g.teacher);
        const room = g && g.room ? D.room(g.room) : null;
        rows.push([st.name, st.phone, statusName(D.STUDENT_STATUS, st.status), (D.manager(st.manager) || {}).name || '', st.balance,
          st.presence.map(x => PRES[x][0]).join(''), st.level,
          t ? t.name : '', g ? D.project(g.project).name : '', g ? g.subject : '', g ? g.grade : '', g ? sizeLabel(g.size) : 'Fără grupă',
          g ? statusName(D.GROUP_STATUS, g.status) : '', g ? dayNames(g) : '', g ? timeRange(g) : '', room ? room.num : (g ? 'Online' : ''), st.joinedAt]);
      });
      U.downloadCSV('elevi.csv', rows);
      U.toast(`Export: ${countWord(list.length, 'elev', 'elevi')}.`);
    });

    list = sorted(filtered(s), s);
    stats.innerHTML = statsHTML(list);
    paintMain();
  }

  window.AdminViews.elevi = {
    title: 'Elevi',
    icon: 'users',
    render
  };
})();
