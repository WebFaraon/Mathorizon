/* ============================================================
   Admin console: Orar (the groups' timetable)
   ============================================================
   Every group on one board: when it meets, who teaches it, the
   project line, the grade, its status and the seats still free.
   Quick signs on top (the three projects, financial risk, groups
   with one free seat, groups that start tomorrow), a filter rail on
   the left, everything kept in the address (#orar?quick=risc&...),
   so the links from Acasă land on a ready selection.
   A row opens a drawer with the group, its students and a status
   switch (demo data, js/admin/mock-data.js).
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
  const presHTML = arr => `<span class="ax-pres" role="img" aria-label="Ultimele 3 lecții: ${arr.map(x => PRES[x][1].toLowerCase()).join(', ')}">${arr.map(x => `<i class="${x}" aria-hidden="true">${PRES[x][0]}</i>`).join('')}</span>`;
  function fmtDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const fmtPhone = p => (/^\+373\d{8}$/.test(p) ? `${p.slice(0, 4)} ${p.slice(4, 6)} ${p.slice(6, 9)} ${p.slice(9)}` : p);

  /* Same date arithmetic as Acasă (and the demo data), so the counts match. */
  const todayId = () => ((new Date().getDay() + 6) % 7) + 1;
  const isoShift = n => { const d = new Date(D.today); d.setDate(d.getDate() + n); return D.iso(d); };

  function startsTomorrow(g) {
    const t = isoShift(1), td = isoShift(0);
    const tomorrowDay = (todayId() % 7) + 1;
    return g.startDate === t || (g.status === 'completare' && g.startDate > td && g.startDate <= t && g.days.includes(tomorrowDay));
  }
  const atRisk = g => g.status === 'activ' && D.freeSeats(g) >= 2;

  const QUICK = {
    risc: { label: 'Risc financiar', sub: 'Grupe active cu 2+ locuri libere', icon: 'wallet', test: atRisk },
    incomplete: { label: 'Active incomplete', sub: 'Grupe active cu 1 loc liber', icon: 'users', test: g => g.status === 'activ' && D.freeSeats(g) === 1 },
    maine: { label: 'Încep mâine', sub: 'Pornesc sau au prima lecție mâine', icon: 'play', test: startsTomorrow }
  };

  const LISTS = ['project', 'dur', 'status', 'subj', 'grade', 'level', 'size', 'profile', 'seats', 'days'];
  const SORTS = {
    orar: { label: 'Orar', def: 'asc', key: g => g.days[0] * 100 + g.start },
    prof: { label: 'Profesor', def: 'asc', key: g => norm(D.teacher(g.teacher).name) },
    subj: { label: 'Materia', def: 'asc', key: g => norm(g.subject) },
    grade: { label: 'Clasa', def: 'asc', key: g => D.GRADES.indexOf(g.grade) },
    size: { label: 'Grupă', def: 'asc', key: g => g.size },
    free: { label: 'Locuri libere', def: 'desc', key: g => D.freeSeats(g) },
    elevi: { label: 'Elevi', def: 'desc', key: g => D.enrolled(g).length },
    // no column of its own: used by links (#orar?status=completare&sort=start)
    start: { label: 'Data de început', def: 'asc', key: g => g.startDate }
  };

  function readState(q) {
    const s = {};
    LISTS.forEach(k => { s[k] = U.listParam(q, k); });
    s.project = s.project.filter(p => D.PROJECTS.some(x => x.id === p));
    s.quick = QUICK[q.quick] ? q.quick : '';
    s.prof = q.prof || '';
    s.teacher = q.teacher && D.teacher(q.teacher) ? q.teacher : '';
    s.elev = q.elev || '';
    s.vara = q.vara === '1';
    s.sort = SORTS[q.sort] ? q.sort : 'orar';
    s.dir = q.dir === 'desc' || q.dir === 'asc' ? q.dir : SORTS[s.sort].def;
    return s;
  }
  function writeState(s) {
    const o = {};
    LISTS.forEach(k => { o[k] = s[k]; });
    Object.assign(o, {
      quick: s.quick, teacher: s.teacher, prof: s.prof.trim(), elev: s.elev.trim(), vara: s.vara ? '1' : '',
      sort: s.sort === 'orar' ? '' : s.sort,
      dir: s.dir === SORTS[s.sort].def ? '' : s.dir
    });
    U.writeQuery(o);
  }

  function studentMatches(st, q) {
    const ds = digits(q);
    if (ds.length >= 3 && digits(st.phone).includes(ds)) return true;
    const tk = tokens(q);
    if (!tk.length) return false;
    const n = norm(st.name);
    return tk.every(t => n.includes(t));
  }

  function filtered(s) {
    const pt = tokens(s.prof);
    const eq = s.elev.trim();
    return D.groups.filter(g => {
      if (s.project.length && !s.project.includes(g.project)) return false;
      if (s.quick && !QUICK[s.quick].test(g)) return false;
      if (s.teacher && g.teacher !== s.teacher) return false;
      if (pt.length) { const n = norm(D.teacher(g.teacher).name); if (!pt.every(t => n.includes(t))) return false; }
      if (eq && !D.studentsOf(g.id).some(st => studentMatches(st, eq))) return false;
      if (s.dur.length && !s.dur.includes(String(g.duration))) return false;
      if (s.status.length && !s.status.includes(g.status)) return false;
      if (s.subj.length && !s.subj.includes(g.subject)) return false;
      if (s.grade.length && !s.grade.includes(g.grade)) return false;
      if (s.level.length && !s.level.includes(g.level)) return false;
      if (s.size.length && !s.size.includes(String(g.size))) return false;
      if (s.profile.length && !s.profile.includes(g.profile)) return false;
      if (s.seats.length) { const f = D.freeSeats(g); if (!s.seats.includes(f >= 3 ? '3' : String(f))) return false; }
      if (s.vara && g.regime !== 'vara') return false;
      if (s.days.length && !g.days.some(d => s.days.includes(String(d)))) return false;
      return true;
    });
  }

  function sorted(list, s) {
    const k = SORTS[s.sort].key;
    const m = s.dir === 'desc' ? -1 : 1;
    const tie = SORTS.orar.key;
    return list.map(g => [k(g), tie(g), g]).sort((a, b) => {
      if (typeof a[0] === 'string' && a[0] !== b[0]) return a[0].localeCompare(b[0], 'ro') * m;
      if (a[0] < b[0]) return -m;
      if (a[0] > b[0]) return m;
      return a[1] - b[1];
    }).map(x => x[2]);
  }

  /* ---- chips ---- */
  const SEATS_LBL = { 0: '0 locuri libere', 1: '1 loc liber', 2: '2 locuri libere', 3: '3+ locuri libere' };
  function chipItems(s) {
    const out = [];
    const rm = (k, v) => st => { st[k] = st[k].filter(x => x !== v); };
    s.project.forEach(v => out.push({ label: D.project(v).name, remove: rm('project', v) }));
    if (s.quick) out.push({ label: QUICK[s.quick].label, remove: st => { st.quick = ''; } });
    if (s.teacher) out.push({ label: `Profesor: ${D.teacher(s.teacher).name}`, remove: st => { st.teacher = ''; } });
    if (s.prof.trim()) out.push({ label: `Profesor: ${s.prof.trim()}`, remove: st => { st.prof = ''; } });
    if (s.elev.trim()) out.push({ label: `Elev: ${s.elev.trim()}`, remove: st => { st.elev = ''; } });
    s.dur.forEach(v => out.push({ label: v === '1' ? 'Ore de 1 oră' : 'Ore de 2 ore', remove: rm('dur', v) }));
    s.status.forEach(v => out.push({ label: 'Statut: ' + statusName(D.GROUP_STATUS, v), remove: rm('status', v) }));
    s.subj.forEach(v => out.push({ label: v, remove: rm('subj', v) }));
    s.grade.forEach(v => out.push({ label: 'Clasa ' + v, remove: rm('grade', v) }));
    s.level.forEach(v => out.push({ label: 'Nivel ' + v, remove: rm('level', v) }));
    s.size.forEach(v => out.push({ label: sizeLabel(+v), remove: rm('size', v) }));
    s.profile.forEach(v => out.push({ label: 'Profil ' + v, remove: rm('profile', v) }));
    s.seats.forEach(v => out.push({ label: SEATS_LBL[v] || v, remove: rm('seats', v) }));
    if (s.vara) out.push({ label: 'Școala de Vară', remove: st => { st.vara = false; } });
    s.days.forEach(v => out.push({ label: (D.DAYS[+v - 1] || { name: v }).name, remove: rm('days', v) }));
    return out;
  }

  /* ---- markup ---- */
  function signsHTML(s) {
    const proj = D.PROJECTS.map(p => {
      const gs = D.groups.filter(g => g.project === p.id);
      const act = gs.filter(g => g.status === 'activ').length;
      const on = s.project.includes(p.id);
      return `
        <button type="button" class="or-sign or-sign--${p.id}" data-project="${p.id}" aria-pressed="${on}">
          <span class="or-sign__name">${esc(p.name)}</span>
          <span class="or-sign__sub or-sign__line"><span class="or-sign__band" aria-hidden="true"></span>${p.mode === 'offline' ? 'Offline, în cabinete' : 'Online'}</span>
          <span class="or-sign__v"><b>${nf.format(gs.length)}</b> grupe <span class="or-sign__of">${nf.format(act)} active</span></span>
          <span class="or-sign__here" aria-hidden="true">${ico('check', 14)}</span>
        </button>`;
    }).join('');
    const quick = Object.entries(QUICK).map(([id, q]) => {
      const n = D.groups.filter(q.test).length;
      const on = s.quick === id;
      return `
        <button type="button" class="or-sign or-sign--q${id === 'risc' ? ' or-sign--warn' : ''}" data-quick="${id}" aria-pressed="${on}">
          <span class="or-sign__name"><span class="or-sign__pic" aria-hidden="true">${ico(q.icon, 14)}</span>${esc(q.label)}</span>
          <span class="or-sign__sub">${esc(q.sub)}</span>
          <span class="or-sign__v"><b>${nf.format(n)}</b> ${n === 1 ? 'grupă' : 'grupe'}</span>
          <span class="or-sign__here" aria-hidden="true">${ico('check', 14)}</span>
        </button>`;
    }).join('');
    return `
      <div class="or-signs__grp">
        <h2 class="or-signs__t">Proiecte</h2>
        <div class="or-signs__row">${proj}</div>
      </div>
      <div class="or-signs__grp">
        <h2 class="or-signs__t">Selecții rapide</h2>
        <div class="or-signs__row">${quick}</div>
      </div>`;
  }

  function segHTML(k, label, opts, s, cls) {
    const id = 'orL' + k;
    return `
      <span class="ax-rail__lbl" id="${id}">${esc(label)}</span>
      <div class="ax-seg or-seg${cls ? ' ' + cls : ''}" role="group" aria-labelledby="${id}">
        ${opts.map(o => `<button type="button" data-k="${k}" data-v="${esc(o.v)}" aria-pressed="${s[k].includes(o.v)}"${o.title ? ` aria-label="${esc(o.title)}" title="${esc(o.title)}"` : ''}>${esc(o.l)}</button>`).join('')}
      </div>`;
  }

  function railHTML(s, open) {
    return `
      <div class="ax-rail__head">
        <b>Filtre</b>
        <button type="button" class="ax-btn ax-btn--sm or-rail__tg" aria-expanded="${open}" aria-controls="orRail">
          ${ico('filter', 16)}<span>${open ? 'Ascunde filtrele' : 'Arată filtrele'}</span><span class="or-rail__n" data-railn></span>
        </button>
      </div>
      <label class="ax-rail__lbl" for="orProf">Profesor</label>
      <div class="ax-search">${ico('search', 16)}<input id="orProf" class="ax-input" type="search" autocomplete="off" placeholder="Nume profesor" value="${esc(s.prof)}"></div>
      <label class="ax-rail__lbl" for="orElev">Elev</label>
      <div class="ax-search">${ico('search', 16)}<input id="orElev" class="ax-input" type="search" autocomplete="off" placeholder="Nume sau telefon" value="${esc(s.elev)}"></div>
      ${segHTML('dur', 'Formatul orelor', [{ v: '1', l: '1 oră' }, { v: '2', l: '2 ore' }], s, 'or-seg--fill')}
      <span class="ax-rail__lbl">Grupa</span>
      <div data-ms="status"></div>
      <div data-ms="subj"></div>
      <div data-ms="grade"></div>
      <div data-ms="level"></div>
      <div data-ms="size"></div>
      ${segHTML('profile', 'Profil', [{ v: 'Real', l: 'Real' }, { v: 'Uman', l: 'Uman' }], s, 'or-seg--fill')}
      ${segHTML('seats', 'Locuri disponibile', [{ v: '0', l: '0' }, { v: '1', l: '1' }, { v: '2', l: '2' }, { v: '3', l: '3+' }], s, 'or-seg--fill')}
      <label class="ax-switch or-switch"><input type="checkbox" data-vara${s.vara ? ' checked' : ''}><span class="ax-switch__t" aria-hidden="true"></span>Doar Școala de Vară</label>
      ${segHTML('days', 'Zile', D.DAYS.map(d => ({ v: String(d.id), l: d.short, title: d.name })), s, 'or-seg--days')}
      <div class="ax-rail__sep"></div>
      <button type="button" class="ax-btn or-clear" data-clearall>${ico('x', 16)} Șterge toate filtrele</button>`;
  }

  function thHTML(k, s, extra) {
    const on = s.sort === k;
    const icon = on ? ico(s.dir === 'asc' ? 'chevron-up' : 'chevron-down', 14) : ico('sort', 14);
    return `<th data-sort="${k}"${on ? ` aria-sort="${s.dir === 'asc' ? 'ascending' : 'descending'}"` : ''}${extra || ''}>
      <button type="button" class="or-sort${on ? ' is-on' : ''}">${esc(SORTS[k].label)}${icon}</button></th>`;
  }

  function rowHTML(g, i, s) {
    const t = D.teacher(g.teacher);
    const p = D.project(g.project);
    const room = g.room ? D.room(g.room) : null;
    const free = D.freeSeats(g);
    const enr = D.enrolled(g);
    const warn = g.status === 'activ' && free >= 2;
    // with an Elev search on, the matching students come first
    let kids = enr;
    if (s.elev.trim()) {
      const hit = D.studentsOf(g.id).filter(st => studentMatches(st, s.elev.trim()));
      kids = hit.concat(enr.filter(x => !hit.includes(x)));
    }
    const shown = kids.slice(0, 2);
    const more = kids.length - shown.length;
    const seats = Array.from({ length: g.size }, (_, k) => `<i${k < enr.length ? ' class="on"' : ''}></i>`).join('');
    return `
      <tr data-open="${g.id}" tabindex="0" data-arrive style="--i:${i}" aria-label="${esc(`${g.subject} ${g.grade}, ${t.name}, ${dayNames(g)} ${timeRange(g)}`)}">
        <td>
          <div class="or-when">
            ${room ? `<span class="or-room" title="${esc(room.name)}"><small>Cab.</small>${room.num}</span>` : `<span class="or-room or-room--on" title="Online">${ico('monitor', 16)}</span>`}
            <span><b class="or-days">${g.days.map(d => `<span>${esc(D.DAYS[d - 1].name)}</span>`).join(' / ')}</b><span class="or-time">${timeRange(g)}</span></span>
          </div>
        </td>
        <td><span class="ax-strong">${esc(t.last)}</span> <span class="or-first">${esc(t.first)}</span></td>
        <td>
          <span class="ax-strong">${esc(g.subject)}</span>
          <span class="or-proj"><span class="ax-line ax-line--${p.id}">${esc(p.short)}</span>${g.regime === 'vara' ? '<span class="ax-tag ax-tag--sun">Vară</span>' : ''}</span>
          <span class="ax-sub">${p.mode === 'offline' ? 'Offline' : 'Online'}</span>
        </td>
        <td><span class="ax-grade">${esc(g.grade)}</span>${g.profile ? `<span class="ax-sub">${esc(g.profile)}</span>` : ''}</td>
        <td>
          <span class="or-size">${sizeLabel(g.size)}</span>
          ${stHTML(g.status, statusName(D.GROUP_STATUS, g.status))}
          <span class="ax-sub">Nivel ${esc(g.level)}</span>
        </td>
        <td class="ax-num">
          ${warn ? `<span class="ax-tag ax-tag--warn" title="Risc financiar">${ico('alert', 14)}${free}</span>` : `<span class="or-free${free ? '' : ' is-zero'}">${free}</span>`}
          <span class="ax-seats or-seats" aria-hidden="true">${seats}</span>
        </td>
        <td class="or-c-kids">
          ${shown.length ? `<ul class="or-kids">${shown.map(st => `<li><span class="ax-st ax-st--${st.status}" title="${esc(statusName(D.STUDENT_STATUS, st.status))}"><i class="ax-st__i"></i></span><span class="or-kid">${esc(st.name)}</span></li>`).join('')}</ul>` : '<span class="ax-sub">Niciun elev</span>'}
          ${more > 0 ? `<span class="or-more">+${more}</span>` : ''}
        </td>
      </tr>`;
  }

  function mainHTML(s, list, limit) {
    const items = chipItems(s);
    const rows = list.slice(0, limit);
    const rest = list.length - rows.length;
    const sortTxt = SORTS[s.sort].label.toLowerCase() + (s.dir === 'asc' ? ', crescător' : ', descrescător');
    return `
      ${U.activeChips(items)}
      <div class="or-bar">
        <p class="or-count" aria-live="polite"><b>${countWord(list.length, 'grupă', 'grupe')}</b> din ${nf.format(D.groups.length)}</p>
        <p class="ax-sub">Sortat după ${esc(sortTxt)}</p>
      </div>
      ${list.length ? `
      <div class="ax-table-wrap">
        <table class="ax-table or-table">
          <caption class="or-vh">Grupele, ${countWord(list.length, 'grupă', 'grupe')}</caption>
          <thead><tr>
            ${thHTML('orar', s)}${thHTML('prof', s)}${thHTML('subj', s)}${thHTML('grade', s)}${thHTML('size', s)}${thHTML('free', s, ' class="ax-num"')}${thHTML('elevi', s)}
          </tr></thead>
          <tbody>${rows.map((g, i) => rowHTML(g, i, s)).join('')}</tbody>
        </table>
      </div>
      ${rest > 0 ? `<div class="or-morebar"><button type="button" class="ax-btn" data-more>Arată încă ${nf.format(Math.min(PER, rest))}</button><span class="ax-sub">${nf.format(rows.length)} afișate din ${nf.format(list.length)}</span></div>` : ''}`
      : `<div class="ax-panel ax-empty"><b>Nicio grupă nu se potrivește filtrelor.</b>Scoate unul dintre filtre sau pornește de la zero.<div class="or-empty-k"><button type="button" class="ax-btn" data-clearall>Șterge toate filtrele</button></div></div>`}`;
  }

  /* ---- drawer ---- */
  function openGroup(gid, onChanged) {
    const g = D.group(gid);
    if (!g) return;
    const t = D.teacher(g.teacher);
    const p = D.project(g.project);
    const room = g.room ? D.room(g.room) : null;
    const all = D.studentsOf(g.id);
    const body = () => {
      const free = D.freeSeats(g);
      const enr = D.enrolled(g).length;
      const seats = Array.from({ length: g.size }, (_, k) => `<i${k < enr ? ' class="on"' : ''}></i>`).join('');
      return `
        <div class="or-dw">
          <div class="or-dw__signs">
            <span class="ax-line ax-line--${p.id}">${esc(p.name)}</span>
            ${room ? `<span class="or-room or-room--sm"><small>Cab.</small>${room.num}</span>` : '<span class="ax-tag">Online</span>'}
            ${g.regime === 'vara' ? '<span class="ax-tag ax-tag--sun">Școala de Vară</span>' : ''}
            ${g.status === 'activ' && free >= 2 ? `<span class="ax-tag ax-tag--warn">${ico('alert', 14)} Risc financiar</span>` : ''}
          </div>
          <section class="or-dw__sec">
            <h3 class="or-dw__h" id="orDwSt">Statutul grupei</h3>
            <div class="ax-seg or-dw__st" role="group" aria-labelledby="orDwSt">
              ${D.GROUP_STATUS.map(st => `<button type="button" data-st="${st.id}" aria-pressed="${g.status === st.id}">${stHTML(st.id, st.name)}</button>`).join('')}
            </div>
          </section>
          <dl class="ax-dl or-dw__dl">
            <dt>Profesor</dt><dd>${esc(t.name)}<a class="or-tel" href="tel:${esc(t.phone)}">${ico('phone', 14)} ${esc(fmtPhone(t.phone))}</a></dd>
            <dt>Program</dt><dd>${esc(dayNames(g))}, ${timeRange(g)}<span class="ax-sub">${g.duration === 1 ? 'Ore de 1 oră' : 'Ore de 2 ore'}</span></dd>
            <dt>Cabinet</dt><dd>${room ? `${esc(room.name)}<span class="ax-sub">Etajul ${room.floor}, ${room.seats} locuri</span>` : 'Online, fără cabinet'}</dd>
            <dt>Grupa</dt><dd>${sizeLabel(g.size)}, clasa ${esc(g.grade)}${g.profile ? ', ' + esc(g.profile) : ''}<span class="ax-sub">Nivel de cunoștințe ${esc(g.level)}</span></dd>
            <dt>Locuri</dt><dd><span class="ax-seats" aria-hidden="true">${seats}</span> ${free ? `${free} ${free === 1 ? 'liber' : 'libere'} din ${g.size}` : 'Grupă completă'}</dd>
            <dt>Început</dt><dd>${esc(fmtDate(g.startDate))}<span class="ax-sub">Creată pe ${esc(fmtDate(g.createdAt))}, cod ${esc(g.id.toUpperCase())}</span></dd>
          </dl>
          <section class="or-dw__sec">
            <h3 class="or-dw__h">Elevi <span class="or-dw__n">${enr} înscriși${all.length > enr ? `, ${all.length - enr} plecați` : ''}</span></h3>
            ${all.length ? `<ul class="or-dw__kids">${all.map(st => `
              <li class="or-dw__kid${['inactiv', 'transferat'].includes(st.status) ? ' is-gone' : ''}">
                <span class="or-dw__who"><b>${esc(st.name)}</b><a href="tel:${esc(st.phone)}">${esc(fmtPhone(st.phone))}</a></span>
                <span class="or-dw__stc">${stHTML(st.status, statusName(D.STUDENT_STATUS, st.status))}${presHTML(st.presence)}</span>
                <span class="or-dw__bal${st.balance < 0 ? ' ax-neg' : ''}">${U.money(st.balance)}</span>
              </li>`).join('')}</ul>` : '<p class="ax-sub">Grupa nu are încă elevi.</p>'}
          </section>
        </div>`;
    };
    const day = g.days[0];
    const el = U.drawer({
      title: `${esc(g.subject)}, clasa ${esc(g.grade)}`,
      sub: `${esc(t.name)} · ${esc(dayNames(g))}, ${timeRange(g)}`,
      body: body(),
      actions: `
        <a class="ax-btn" href="#repartizare?day=${day}&focus=${g.id}" data-go>${ico('door', 16)} Vezi în repartizare</a>
        <a class="ax-btn ax-btn--dark" href="#elevi?in=prof&q=${encodeURIComponent(t.name)}" data-go>${ico('users', 16)} Elevii profesorului</a>`
    });
    const wireBody = () => {
      el.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => {
        if (g.status === b.dataset.st) return;
        D.setStatus(g.id, b.dataset.st);
        el.querySelector('.ax-drawer__body').innerHTML = body();
        wireBody();
        el.querySelector(`[data-st="${g.status}"]`).focus();
        U.toast(`Statutul grupei: ${esc(statusName(D.GROUP_STATUS, g.status))}.`);
        onChanged();
      }));
    };
    wireBody();
    el.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', () => el.close()));
  }

  /* ---- view ---- */
  let railOpen = false;

  function render(root, ctx) {
    const s = readState(ctx.query || {});
    let limit = PER;

    root.innerHTML = `
      <div class="ax-fixsplit or-split">
        <aside class="ax-rail is-collapsible or-rail${railOpen ? ' is-open' : ''}" id="orRail" aria-label="Filtre">${railHTML(s, railOpen)}</aside>
        <div class="ax-col">
          <header class="ax-head">
        <div class="ax-head__t">
          <span class="ax-plate">${ico('grid', 24)}</span>
          <div>
            <h1 class="ax-h1">Orarul grupelor</h1>
            <p class="ax-lede">Toate grupele cu programul, profesorul și locurile libere. Filtrele rămân în adresa paginii.</p>
          </div>
        </div>
        <div class="ax-head__keys">
          <button type="button" class="ax-btn" data-csv>${ico('download', 16)} Export CSV</button>
          <button type="button" class="ax-btn" data-print>${ico('printer', 16)} Printează</button>
        </div>
      </header>
          <section class="or-signs" aria-label="Proiecte și selecții rapide" data-signs>${signsHTML(s)}</section>
          <div class="or-main" data-main></div>
        </div>
      </div>`;

    const rail = root.querySelector('.or-rail');
    const main = root.querySelector('[data-main]');
    const signs = root.querySelector('[data-signs]');
    let list = [];

    const countActive = () => chipItems(s).length - (s.project.length) - (s.quick ? 1 : 0);
    function paintMain() {
      main.innerHTML = mainHTML(s, list, limit);
      if (limit === PER) U.stagger(main.querySelector('tbody'), 14, 12);
      const items = chipItems(s);
      U.wireActiveChips(main, items, it => { it.remove(s); writeState(s); ctx.rerender(); }, clearAll);
      const n = countActive();
      const rn = rail.querySelector('[data-railn]');
      rn.textContent = n ? n : '';
    }
    function update() {
      limit = PER;
      writeState(s);
      list = sorted(filtered(s), s);
      signs.innerHTML = signsHTML(s);
      paintMain();
    }
    function clearAll() {
      LISTS.forEach(k => { s[k] = []; });
      s.quick = ''; s.teacher = ''; s.prof = ''; s.elev = ''; s.vara = false;
      writeState(s);
      ctx.rerender();
    }

    /* multi-selects */
    const count = fn => { const m = {}; D.groups.forEach(g => { const k = fn(g); if (k != null) m[k] = (m[k] || 0) + 1; }); return m; };
    const msDefs = {
      status: { label: 'Statut grup', tone: true, opts: D.GROUP_STATUS.map(x => ({ value: x.id, label: x.name })), by: g => g.status },
      subj: { label: 'Disciplină', opts: D.SUBJECTS.map(x => ({ value: x, label: x })), by: g => g.subject },
      grade: { label: 'Clasa', opts: D.GRADES.map(x => ({ value: x, label: 'Clasa ' + x })), by: g => g.grade },
      level: { label: 'Nivel de cunoștințe', opts: D.LEVELS.map(x => ({ value: x, label: 'Nivel ' + x })), by: g => g.level },
      size: { label: 'Format grup', opts: [1, 2, 3, 4, 5, 6].map(n => ({ value: String(n), label: sizeLabel(n) })), by: g => String(g.size) }
    };
    Object.entries(msDefs).forEach(([k, def]) => {
      const c = count(def.by);
      const opts = def.opts.filter(o => c[o.value]).map(o => Object.assign({}, o, { count: c[o.value] }));
      const ms = U.multiSelect({ id: 'or-' + k, label: def.label, options: opts, selected: s[k], tone: !!def.tone, onChange: v => { s[k] = v; update(); } });
      rail.querySelector(`[data-ms="${k}"]`).replaceWith(ms);
    });

    /* segmented toggles */
    rail.querySelectorAll('.or-seg button[data-k]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k, v = b.dataset.v;
      s[k] = s[k].includes(v) ? s[k].filter(x => x !== v) : s[k].concat(v);
      b.setAttribute('aria-pressed', String(s[k].includes(v)));
      update();
    }));
    rail.querySelector('[data-vara]').addEventListener('change', e => { s.vara = e.target.checked; update(); });
    let tm = null;
    U.suggest(rail.querySelector('#orProf'), () => D.teachers.map(t => t.name).sort((a, b) => a.localeCompare(b, 'ro')));
    [['#orProf', 'prof'], ['#orElev', 'elev']].forEach(([sel, k]) => {
      rail.querySelector(sel).addEventListener('input', e => {
        s[k] = e.target.value;
        clearTimeout(tm);
        tm = setTimeout(update, 140);
      });
    });
    rail.querySelector('[data-clearall]').addEventListener('click', clearAll);
    const tg = rail.querySelector('.or-rail__tg');
    tg.addEventListener('click', () => {
      railOpen = !rail.classList.contains('is-open');
      rail.classList.toggle('is-open', railOpen);
      tg.setAttribute('aria-expanded', String(railOpen));
      tg.querySelector('span').textContent = railOpen ? 'Ascunde filtrele' : 'Arată filtrele';
    });

    /* quick signs */
    signs.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.project) {
        const v = b.dataset.project;
        s.project = s.project.includes(v) ? s.project.filter(x => x !== v) : s.project.concat(v);
      } else if (b.dataset.quick) {
        s.quick = s.quick === b.dataset.quick ? '' : b.dataset.quick;
      } else return;
      const key = b.dataset.project ? `[data-project="${b.dataset.project}"]` : `[data-quick="${b.dataset.quick}"]`;
      update();
      const again = signs.querySelector(key);
      if (again) again.focus();
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
        const rows = main.querySelectorAll('tbody tr');
        const first = rows[limit - PER];
        if (first) first.focus();
        return;
      }
      if (e.target.closest('[data-clearall]')) { clearAll(); return; }
      const tr = e.target.closest('tr[data-open]');
      if (tr && !e.target.closest('a,button')) openGroup(tr.dataset.open, refresh);
    });
    main.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tr = e.target.closest('tr[data-open]');
      if (tr && e.target === tr) { e.preventDefault(); openGroup(tr.dataset.open, refresh); }
    });
    function refresh() {
      list = sorted(filtered(s), s);
      signs.innerHTML = signsHTML(s);
      paintMain();
    }

    /* export, print */
    root.querySelector('[data-csv]').addEventListener('click', () => {
      const rows = [['Cod', 'Proiect', 'Regim', 'Disciplină', 'Clasa', 'Profil', 'Nivel', 'Format', 'Statut', 'Profesor', 'Zile', 'Ora', 'Cabinet', 'Locuri libere', 'Elevi înscriși', 'Început']];
      list.forEach(g => {
        const room = g.room ? D.room(g.room) : null;
        rows.push([g.id.toUpperCase(), D.project(g.project).name, g.regime === 'vara' ? 'Școala de Vară' : 'Normal', g.subject, g.grade, g.profile || '', g.level, sizeLabel(g.size), statusName(D.GROUP_STATUS, g.status), D.teacher(g.teacher).name, dayNames(g), timeRange(g), room ? room.num : 'Online', D.freeSeats(g), D.enrolled(g).length, g.startDate]);
      });
      U.downloadCSV('orar-grupe.csv', rows);
      U.toast(`Export: ${countWord(list.length, 'grupă', 'grupe')}.`);
    });
    root.querySelector('[data-print]').addEventListener('click', () => {
      const keep = limit;
      limit = Infinity;
      paintMain();
      document.body.classList.add('or-print');
      const done = () => {
        document.body.classList.remove('or-print');
        limit = keep;
        paintMain();
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      window.print();
    });

    list = sorted(filtered(s), s);
    paintMain();
  }

  window.AdminViews.orar = {
    title: 'Orar',
    icon: 'grid',
    badge() {
      const n = D.groups.filter(atRisk).length;
      return n || null;
    },
    render
  };
})();
