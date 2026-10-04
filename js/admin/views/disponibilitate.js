/* ============================================================
   Admin console: Disponibilitate
   ============================================================
   When teachers can teach and how much of that time is booked.
   - "Cine e liber?": pick a day, an hour, a duration (and optionally
     a subject and a project) and get the teachers who are available
     then and have no group at that time.
   - Un profesor: a teacher list (search, subject, project) on the
     left and the selected teacher's week on the right: days × hours,
     availability drawn as a ruled light area, groups on top with the
     project band; a group outside availability gets a red outline.
   - Toți profesorii: teachers × days, booked / available hours per
     cell, sortable by utilization.
   Availability is read-only here: the teacher sets it in the register (registru.html, tab
   Disponibilitate), which writes the same demo store, also live across tabs.
   State lives in the URL: #disponibilitate?mode=all&t=t4&subj=...&fd=2&fh=15
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico, nf, plural, pct, hh } = U;

  const H0 = 8, H1 = 22, SPAN = H1 - H0; // the board shows 08:00 .. 22:00 (the register lets a teacher offer the 21:00 hour)
  const SHORT = { Matematica: 'Mat.', 'L.română': 'Rom.', Fizica: 'Fiz.', Istoria: 'Ist.', Chimie: 'Chim.', Biologie: 'Bio.', Engleza: 'Engl.', Geografie: 'Geo.' };
  const todayId = () => ((new Date().getDay() + 6) % 7) + 1;
  const live = g => g.status !== 'inactiv';
  const pos = h => ((h - H0) / SPAN) * 100;
  const range = (a, b) => `${hh(a)}-${hh(b)}`;
  const hours = n => plural(n, 'oră', 'ore');

  /* ---------- numbers ---------- */
  function groupsOf(tid) { return D.groups.filter(g => g.teacher === tid && live(g)); }

  function dayStats(t, day, gs) {
    const avail = new Set();
    (t.availability[day] || []).forEach(([a, b]) => { for (let h = a; h < b; h++) avail.add(h); });
    const booked = new Set();
    gs.forEach(g => { if (g.days.includes(day)) for (let h = g.start; h < g.start + g.duration; h++) booked.add(h); });
    let inside = 0;
    booked.forEach(h => { if (avail.has(h)) inside++; });
    return { avail: avail.size, booked: booked.size, inside, free: avail.size - inside };
  }

  function weekStats(t) {
    const gs = groupsOf(t.id);
    const days = {};
    const w = { avail: 0, booked: 0, inside: 0, free: 0, out: 0, groups: gs };
    D.DAYS.forEach(d => {
      const s = dayStats(t, d.id, gs);
      days[d.id] = s;
      w.avail += s.avail; w.booked += s.booked; w.inside += s.inside; w.free += s.free;
    });
    gs.forEach(g => g.days.forEach(d => { if (!D.isAvailable(t.id, d, g.start, g.duration)) w.out++; }));
    w.days = days;
    w.util = w.avail ? pct(w.booked, w.avail) : (w.booked ? 999 : 0);
    return w;
  }

  /* ---------- state ---------- */
  let S = null;
  let stats = null; // teacherId -> weekStats, rebuilt on every render
  let rootEl = null;
  let finderMore = false;

  function readState(q) {
    const nowH = new Date().getHours() + 1;
    return {
      mode: q.mode === 'all' ? 'all' : 'one',
      t: D.teacher(q.t) ? q.t : null,
      q: q.q || '',
      subj: D.SUBJECTS.includes(q.subj) ? q.subj : '',
      proj: D.project(q.proj) ? q.proj : '',
      sort: ['name', 'util', 'booked', 'avail'].includes(q.sort) ? q.sort : 'util',
      dir: q.dir === 'asc' ? 'asc' : (q.dir === 'desc' ? 'desc' : null),
      fd: +q.fd >= 1 && +q.fd <= 7 ? +q.fd : todayId(),
      fh: +q.fh >= 8 && +q.fh <= 20 ? +q.fh : Math.min(20, Math.max(8, nowH)),
      fdur: q.fdur === '2' ? 2 : 1,
      fs: D.SUBJECTS.includes(q.fs) ? q.fs : '',
      fp: D.project(q.fp) ? q.fp : '',
      fset: 'fd' in q || 'fh' in q // the finder slot defaults to "now" until the admin picks one
    };
  }
  function save() {
    U.writeQuery({
      mode: S.mode === 'all' ? 'all' : null,
      t: S.t, q: S.q, subj: S.subj, proj: S.proj,
      sort: S.sort !== 'util' ? S.sort : null, dir: S.dir,
      fd: S.fset ? S.fd : null, fh: S.fset ? S.fh : null, fdur: S.fdur === 2 ? 2 : null, fs: S.fs, fp: S.fp
    });
  }
  const sortDir = () => S.dir || (S.sort === 'name' ? 'asc' : 'desc');

  function filtered() {
    const q = S.q.trim().toLowerCase();
    return D.teachers
      .filter(t => (!S.subj || t.subjects.includes(S.subj)) && (!S.proj || t.projects.includes(S.proj)) &&
        (!q || t.name.toLowerCase().includes(q) || `${t.first} ${t.last}`.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }

  /* ---------- small signs ---------- */
  const lines = t => t.projects.map(p => `<span class="ax-line ax-line--${p}">${esc(D.project(p).short)}</span>`).join('');
  function utilBar(w) {
    const over = w.util > 100;
    const label = w.avail ? `${w.util > 999 ? '999+' : w.util}%` : (w.booked ? 'fără disp.' : '0%');
    return `<span class="dp-util${over ? ' is-over' : ''}" title="${nf.format(w.booked)} ore ocupate din ${nf.format(w.avail)} disponibile">
      <span class="dp-util__bar" aria-hidden="true"><i style="width:${Math.min(100, w.util)}%"></i></span>
      <span class="dp-util__v">${label}</span>
    </span>`;
  }
  const subjSelect = (id, val, label) => `
    <label class="dp-f"><span class="dp-f__l">${label}</span>
      <select class="ax-select" id="${id}">
        <option value="">Toate</option>
        ${D.SUBJECTS.map(s => `<option value="${esc(s)}"${s === val ? ' selected' : ''}>${esc(s)}</option>`).join('')}
      </select></label>`;
  const projSelect = (id, val, label) => `
    <label class="dp-f"><span class="dp-f__l">${label}</span>
      <select class="ax-select" id="${id}">
        <option value="">Toate</option>
        ${D.PROJECTS.map(p => `<option value="${p.id}"${p.id === val ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select></label>`;

  /* ---------- "Cine e liber?" ---------- */
  function finderHTML() {
    return `
      <section class="ax-panel dp-find" aria-labelledby="dpFindT">
        <div class="dp-find__head">
          <h2 class="ax-h2" id="dpFindT">Cine e liber?</h2>
          <p class="ax-sub">Profesorii disponibili la ora aleasă, fără nicio grupă atunci.</p>
        </div>
        <div class="dp-find__ctl">
          <div class="dp-f"><span class="dp-f__l" id="dpFdL">Ziua</span>
            <div class="ax-seg" role="group" aria-labelledby="dpFdL" id="dpFd">
              ${D.DAYS.map(d => `<button type="button" data-v="${d.id}" aria-pressed="${d.id === S.fd}" title="${esc(d.name)}">${esc(d.short)}</button>`).join('')}
            </div></div>
          <label class="dp-f dp-f--hour"><span class="dp-f__l">Ora</span>
            <select class="ax-select" id="dpFh">
              ${D.HOURS.map(h => `<option value="${h}"${h === S.fh ? ' selected' : ''}>${hh(h)}</option>`).join('')}
            </select></label>
          <div class="dp-f"><span class="dp-f__l" id="dpFdurL">Durata</span>
            <div class="ax-seg" role="group" aria-labelledby="dpFdurL" id="dpFdur">
              <button type="button" data-v="1" aria-pressed="${S.fdur === 1}">1 oră</button>
              <button type="button" data-v="2" aria-pressed="${S.fdur === 2}">2 ore</button>
            </div></div>
          ${subjSelect('dpFs', S.fs, 'Disciplină')}
          ${projSelect('dpFp', S.fp, 'Proiect')}
        </div>
        <div class="dp-find__res" id="dpFindRes" aria-live="polite"></div>
      </section>`;
  }

  function overlaps(g, day, h, dur) { return g.days.includes(day) && g.start < h + dur && h < g.start + g.duration; }

  function miniDay(t, day, h, dur) {
    const wins = t.availability[day] || [];
    const gs = stats[t.id].groups.filter(g => g.days.includes(day));
    return `<span class="dp-mini" aria-hidden="true">
      ${wins.map(([a, b]) => `<i class="dp-mini__av" style="left:${pos(a)}%;width:${pos(b) - pos(a)}%"></i>`).join('')}
      ${gs.map(g => `<i class="dp-mini__g dp-mini__g--${g.project}" style="left:${pos(g.start)}%;width:${pos(g.start + g.duration) - pos(g.start)}%"></i>`).join('')}
      <i class="dp-mini__slot" style="left:${pos(h)}%;width:${pos(Math.min(H1, h + dur)) - pos(h)}%"></i>
    </span>`;
  }

  function paintFinder() {
    const el = rootEl && rootEl.querySelector('#dpFindRes');
    if (!el) return;
    const { fd: day, fh: h, fdur: dur } = S;
    const pool = D.teachers.filter(t => (!S.fs || t.subjects.includes(S.fs)) && (!S.fp || t.projects.includes(S.fp)));
    const free = [], busy = [], off = [];
    pool.forEach(t => {
      if (!D.isAvailable(t.id, day, h, dur)) { off.push(t); return; }
      const clash = stats[t.id].groups.filter(g => overlaps(g, day, h, dur));
      if (clash.length) busy.push({ t, g: clash[0] }); else free.push(t);
    });
    free.sort((a, b) => stats[a.id].days[day].booked - stats[b.id].days[day].booked || a.name.localeCompare(b.name, 'ro'));
    const dayName = D.DAYS[day - 1].name;
    const CAP = 8;
    const shown = finderMore ? free : free.slice(0, CAP);

    el.innerHTML = `
      <div class="dp-find__sum">
        <p class="dp-find__big"><b>${nf.format(free.length)}</b> ${free.length === 1 ? 'profesor liber' : 'profesori liberi'} ${esc(dayName)}, ${range(h, Math.min(H1, h + dur))}</p>
        <p class="dp-find__rest">
          <span><b>${nf.format(busy.length)}</b> ${busy.length === 1 ? 'ocupat' : 'ocupați'} atunci</span>
          <span><b>${nf.format(off.length)}</b> nu ${off.length === 1 ? 'este disponibil' : 'sunt disponibili'}</span>
          ${S.fs || S.fp ? `<span>din ${plural(pool.length, 'profesor', 'profesori')} ${S.fs ? 'de ' + esc(S.fs) : ''}${S.fp ? ' în ' + esc(D.project(S.fp).short) : ''}</span>` : ''}
        </p>
      </div>
      ${free.length ? `
        <div class="dp-legend" aria-label="Cum se citește bara">
          <span class="dp-legend__t">Cum se citește bara:</span>
          <span><i class="dp-lg dp-lg--av"></i>Programul profesorului (când poate preda)</span>
          <span><i class="dp-lg dp-lg--off"></i>Hașurat: în afara programului</span>
          <span><i class="dp-lg dp-lg--g"></i>O grupă pe care o are deja, în culoarea proiectului</span>
          <span><i class="dp-lg dp-lg--slot"></i>Ora căutată, ${esc(dayName)} ${range(h, Math.min(H1, h + dur))}</span>
        </div>
        <div class="dp-free-head" aria-hidden="true"><span>Profesor</span><span>Proiecte</span><span class="dp-scale">${[8, 10, 12, 14, 16, 18, 20].map(x => `<i style="left:${pos(x)}%">${String(x).padStart(2, '0')}</i>`).join('')}</span><span></span></div>
        <ul class="dp-free">
          ${shown.map((t, i) => {
            const ds = stats[t.id].days[day];
            const win = (t.availability[day] || []).map(([a, b]) => range(a, b)).join(', ');
            return `<li class="dp-free__row" data-arrive style="--i:${i}">
              <span class="dp-free__who"><b>${esc(t.name)}</b><span class="ax-sub">${esc(t.subjects.join(', '))}</span></span>
              <span class="dp-free__lines">${lines(t)}</span>
              <span class="dp-free__day">
                ${miniDay(t, day, h, dur)}
                <span class="ax-sub dp-free__note"><b>Liber în ${esc(win)}</b> · ${ds.booked ? hours(ds.booked) + ' ocupate' : 'nicio grupă'}</span>
              </span>
              <button type="button" class="ax-btn ax-btn--sm" data-see="${t.id}">Vezi programul ${ico('arrow-right', 16)}</button>
            </li>`;
          }).join('')}
        </ul>
        ${free.length > CAP ? `<button type="button" class="ax-link dp-find__more" id="dpFindMore">${finderMore ? 'Arată mai puțini' : `Arată încă ${free.length - CAP}`}</button>` : ''}`
      : `<div class="ax-empty dp-find__empty"><b>Nimeni nu e liber la ora aceasta.</b>Încearcă altă oră sau scoate filtrul de disciplină ori proiect.</div>`}
      ${busy.length ? `
        <details class="dp-busy">
          <summary>Cine e ocupat atunci (${nf.format(busy.length)})</summary>
          <ul>${busy.map(({ t, g }) => `<li><button type="button" class="ax-link" data-see="${t.id}">${esc(t.name)}</button> <span class="ax-sub">${esc(g.subject)} ${esc(g.grade)}, ${range(g.start, g.start + g.duration)}</span></li>`).join('')}</ul>
        </details>` : ''}`;

    el.querySelectorAll('[data-see]').forEach(b => b.addEventListener('click', () => {
      S.t = b.dataset.see; S.mode = 'one'; save(); paintMain(true);
    }));
    el.querySelector('#dpFindMore')?.addEventListener('click', () => { finderMore = !finderMore; paintFinder(); });
  }

  function wireFinder() {
    const seg = (id, key) => rootEl.querySelectorAll(`#${id} button`).forEach(b => b.addEventListener('click', () => {
      S[key] = +b.dataset.v; S.fset = true;
      rootEl.querySelectorAll(`#${id} button`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      finderMore = false; save(); paintFinder();
    }));
    seg('dpFd', 'fd');
    seg('dpFdur', 'fdur');
    rootEl.querySelector('#dpFh').addEventListener('change', e => { S.fh = +e.target.value; S.fset = true; finderMore = false; save(); paintFinder(); });
    rootEl.querySelector('#dpFs').addEventListener('change', e => { S.fs = e.target.value; finderMore = false; save(); paintFinder(); });
    rootEl.querySelector('#dpFp').addEventListener('change', e => { S.fp = e.target.value; finderMore = false; save(); paintFinder(); });
  }

  /* ---------- one teacher: list + week ---------- */
  function listHTML(list) {
    if (!list.length) return `<p class="dp-list__none">Niciun profesor nu se potrivește filtrelor.</p>`;
    return list.map((t, i) => `
      <li><button type="button" class="dp-t" data-t="${t.id}" aria-pressed="${t.id === S.t}" data-arrive style="--i:${i}">
        <span class="dp-t__who"><b>${esc(t.name)}</b><span class="ax-sub">${esc(t.subjects.join(', '))}</span></span>
        ${utilBar(stats[t.id])}
      </button></li>`).join('');
  }

  function lanesFor(gs) {
    const ends = [];
    const out = new Map();
    gs.slice().sort((a, b) => a.start - b.start || b.duration - a.duration).forEach(g => {
      let lane = ends.findIndex(e => e <= g.start);
      if (lane < 0) { lane = ends.length; ends.push(0); }
      ends[lane] = g.start + g.duration;
      out.set(g.id, lane);
    });
    return { lane: out, n: Math.max(1, ends.length) };
  }

  function weekHTML(t) {
    const w = stats[t.id];
    const today = todayId();
    const scale = [];
    for (let h = H0; h <= H1; h++) scale.push(`<span style="left:${pos(h)}%">${String(h).padStart(2, '0')}</span>`);
    const cells = Array.from({ length: SPAN }, () => '<i></i>').join('');

    const rows = D.DAYS.map((d, i) => {
      const gs = w.groups.filter(g => g.days.includes(d.id));
      const L = lanesFor(gs);
      const ds = w.days[d.id];
      const wins = t.availability[d.id] || [];
      return `
        <div class="dp-row${d.id === today ? ' is-today' : ''}" data-arrive style="--i:${i}">
          <div class="dp-row__day">
            <b>${esc(d.name)}</b>
            <span class="dp-row__win">${wins.length ? wins.map(([a, b]) => `${a}-${b}`).join(', ') : 'indisponibil'}</span>
            ${ds.booked || ds.avail ? `<span class="ax-sub">${nf.format(ds.booked)} din ${nf.format(ds.avail)} ore</span>` : ''}
          </div>
          <div class="dp-row__track" style="--lanes:${L.n}">
            <div class="dp-row__cells" aria-hidden="true">${cells}</div>
            ${wins.map(([a, b]) => `<span class="dp-av" style="left:${pos(a)}%;width:${pos(b) - pos(a)}%" title="Disponibil ${range(a, b)}"></span>`).join('')}
            ${gs.map(g => {
              const out = !D.isAvailable(t.id, d.id, g.start, g.duration);
              const room = g.room ? D.room(g.room) : null;
              const label = `${g.subject} ${g.grade}, ${D.project(g.project).name}, ${range(g.start, g.start + g.duration)}${room ? ', ' + room.name : ''}${out ? ', în afara disponibilității' : ''}`;
              return `<button type="button" class="dp-blk dp-blk--${g.project}${out ? ' is-out' : ''}${g.duration === 1 ? ' is-short' : ''}" data-g="${g.id}" data-d="${d.id}"
                style="left:${pos(g.start)}%;width:calc(${pos(g.start + g.duration) - pos(g.start)}% - 5px);--lane:${L.lane.get(g.id)}" aria-label="${esc(label)}" title="${esc(label)}">
                ${g.duration === 1
                  ? `<b>${esc(g.grade)}</b><span>${esc(SHORT[g.subject] || g.subject)}</span>`
                  : `<b>${esc(SHORT[g.subject] || g.subject)} ${esc(g.grade)}</b><span class="dp-blk__m"><i>${g.start}-${g.start + g.duration}</i>${room ? `<i>cab. ${room.num}</i>` : ''}</span>`}
                ${out ? `<em class="dp-blk__out" aria-hidden="true">!</em>` : ''}
              </button>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="dp-who">
        <div>
          <h2 class="dp-who__name">${esc(t.name)}</h2>
          <p class="dp-who__meta"><span>${esc(t.subjects.join(', '))}</span><span class="dp-who__lines">${lines(t)}</span><span class="dp-who__ph">${ico('phone', 14)} ${esc(t.phone)}</span></p>
        </div>
        <div class="dp-who__keys">
          <a class="ax-btn ax-btn--sm" href="registru.html?t=${t.id}#disponibilitate" target="_blank" rel="noopener">Registrul profesorului ${ico('book-open', 16)}</a>
          <a class="ax-btn ax-btn--sm" href="#orar?teacher=${t.id}">Grupele în Orar ${ico('arrow-right', 16)}</a>
        </div>
      </div>
      <div class="ax-stats dp-tot">
        <div class="ax-stat"><span class="ax-stat__k">Ore disponibile</span><span class="ax-stat__v">${nf.format(w.avail)}</span><span class="ax-stat__s">pe săptămână</span></div>
        <div class="ax-stat${w.booked > w.inside ? ' dp-tot__warn' : ''}"><span class="ax-stat__k">Ore ocupate</span><span class="ax-stat__v">${nf.format(w.booked)}</span><span class="ax-stat__s">${plural(w.groups.length, 'grupă', 'grupe')} în lucru${w.booked > w.inside ? `, <b>${hours(w.booked - w.inside)} în afara disponibilității</b>` : ''}</span></div>
        <div class="ax-stat"><span class="ax-stat__k">Grad de utilizare</span><span class="ax-stat__v${w.util > 100 ? ' ax-neg' : ''}">${w.avail ? w.util + '%' : '-'}</span><span class="ax-stat__s">ore ocupate din cele disponibile</span></div>
        <div class="ax-stat"><span class="ax-stat__k">Ore libere</span><span class="ax-stat__v">${nf.format(w.free)}</span><span class="ax-stat__s">disponibile, fără grupă</span></div>
      </div>
      <div class="dp-legend">
        <span><i class="dp-key dp-key--av"></i>Disponibil</span>
        <span><i class="dp-key dp-key--g"></i>Grupă (banda arată proiectul)</span>
        <span><i class="dp-key dp-key--out"></i>Grupă în afara disponibilității</span>
        <span class="dp-legend__note">${ico('info', 14)} Disponibilitatea vine din Registrul profesorului</span>
      </div>
      <div class="dp-grid-wrap">
        <div class="dp-grid" role="group" aria-label="Săptămâna lui ${esc(t.name)}">
          <div class="dp-grid__hdr" aria-hidden="true"><span class="dp-grid__corner">Ora</span><div class="dp-grid__scale">${scale.join('')}</div></div>
          ${rows}
        </div>
      </div>`;
  }

  function openGroup(gid, day) {
    const g = D.group(gid);
    if (!g) return;
    const t = D.teacher(g.teacher), p = D.project(g.project), room = g.room ? D.room(g.room) : null;
    const st = D.GROUP_STATUS.find(s => s.id === g.status);
    const en = D.enrolled(g).length;
    const outDays = g.days.filter(d => !D.isAvailable(t.id, d, g.start, g.duration));
    const seats = Array.from({ length: g.size }, (_, i) => `<i${i < en ? ' class="on"' : ''}></i>`).join('');
    U.drawer({
      title: `${esc(g.subject)} <span class="ax-grade">${esc(g.grade)}</span>`,
      sub: `${esc(t.name)} · grupa ${esc(g.id)}`,
      body: `
        ${outDays.length ? `<p class="dp-dr-warn"><span class="ax-hazard" aria-hidden="true"></span>În afara disponibilității: ${esc(outDays.map(d => D.DAYS[d - 1].name).join(', '))}, ${range(g.start, g.start + g.duration)}</p>` : ''}
        <dl class="ax-dl">
          <dt>Proiect</dt><dd><span class="ax-line ax-line--${p.id}">${esc(p.name)}</span></dd>
          <dt>Status</dt><dd><span class="ax-st ax-st--${g.status}"><i class="ax-st__i"></i>${esc(st ? st.name : g.status)}</span></dd>
          <dt>Zile</dt><dd>${esc(U.daysLabel(g.days))}</dd>
          <dt>Ora</dt><dd>${range(g.start, g.start + g.duration)} (${hours(g.duration)})</dd>
          <dt>Cabinet</dt><dd>${room ? `${esc(room.name)}, etajul ${room.floor}` : 'Online'}</dd>
          <dt>Elevi</dt><dd><span class="ax-seats" aria-hidden="true">${seats}</span> ${nf.format(en)} din ${nf.format(g.size)}</dd>
          <dt>Nivel</dt><dd>${esc(g.level)}${g.profile ? `, profil ${esc(g.profile)}` : ''}</dd>
          <dt>Regim</dt><dd>${g.regime === 'vara' ? 'Vară' : 'Normal'}</dd>
          <dt>Început</dt><dd>${esc(new Date(g.startDate + 'T00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }))}</dd>
          <dt>Disponibil ${esc(D.DAYS[day - 1].name.toLowerCase())}</dt><dd>${(t.availability[day] || []).map(([a, b]) => range(a, b)).join(', ') || 'nu'}</dd>
        </dl>`,
      actions: `<a class="ax-btn ax-btn--primary" href="#repartizare?day=${day}&focus=${g.id}">Vezi în repartizare ${ico('arrow-right', 16)}</a>`
    });
  }

  function paintWeek() {
    const box = rootEl.querySelector('#dpWeek');
    if (!box) return;
    const t = D.teacher(S.t);
    box.innerHTML = t ? weekHTML(t) : `<div class="ax-empty"><b>Alege un profesor</b>din lista din stânga.</div>`;
    box.querySelectorAll('.dp-blk').forEach(b => b.addEventListener('click', () => openGroup(b.dataset.g, +b.dataset.d)));
  }

  function paintList() {
    const list = filtered();
    const ul = rootEl.querySelector('#dpList');
    ul.innerHTML = listHTML(list);
    rootEl.querySelector('#dpCount').textContent = nf.format(list.length);
    ul.querySelectorAll('.dp-t').forEach(b => b.addEventListener('click', () => {
      S.t = b.dataset.t; save();
      ul.querySelectorAll('.dp-t').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      rootEl.querySelector('#dpRailCur').textContent = D.teacher(S.t).name;
      rootEl.querySelector('.dp-rail')?.classList.remove('is-open');
      rootEl.querySelector('#dpRailBtn')?.setAttribute('aria-expanded', 'false');
      paintWeek();
      if (matchMedia('(max-width: 1180px)').matches) rootEl.querySelector('#dpWeek').scrollIntoView({ block: 'start' });
    }));
  }

  function filtersHTML(prefix) {
    return `
      <label class="ax-search dp-f dp-f--search"><span class="dp-f__l">Caută</span>
        ${ico('search', 16)}<input class="ax-input" id="${prefix}Q" type="search" placeholder="Nume profesor" value="${esc(S.q)}" autocomplete="off"></label>
      ${subjSelect(prefix + 'Subj', S.subj, 'Disciplină')}
      ${projSelect(prefix + 'Proj', S.proj, 'Proiect')}`;
  }
  function wireFilters(prefix, repaint) {
    rootEl.querySelector(`#${prefix}Q`).addEventListener('input', e => { S.q = e.target.value; save(); repaint(); });
    rootEl.querySelector(`#${prefix}Subj`).addEventListener('change', e => { S.subj = e.target.value; save(); repaint(); });
    rootEl.querySelector(`#${prefix}Proj`).addEventListener('change', e => { S.proj = e.target.value; save(); repaint(); });
  }

  function oneHTML() {
    const cur = D.teacher(S.t);
    return `
      <div class="ax-split dp-split">
        <aside class="ax-rail is-collapsible dp-rail" aria-label="Profesori">
          <div class="ax-rail__head dp-rail__head">
            <b>Profesori <span class="dp-rail__n" id="dpCount"></span></b>
            <button type="button" class="ax-btn ax-btn--sm dp-rail__btn" id="dpRailBtn" aria-expanded="false" aria-controls="dpList">
              <span id="dpRailCur">${cur ? esc(cur.name) : 'Alege'}</span>${ico('chevron-down', 16)}
            </button>
          </div>
          ${filtersHTML('dpL')}
          <div class="ax-rail__sep"></div>
          <ul class="dp-list" id="dpList"></ul>
        </aside>
        <section class="ax-panel dp-week" id="dpWeek" aria-label="Săptămâna profesorului"></section>
      </div>`;
  }

  /* ---------- all teachers ---------- */
  function allHTML() {
    return `
      <div class="dp-all-bar">${filtersHTML('dpA')}</div>
      <div class="ax-table-wrap"><table class="ax-table dp-all" id="dpAll"></table></div>`;
  }
  function paintAll() {
    const tbl = rootEl.querySelector('#dpAll');
    const list = filtered();
    const dir = sortDir() === 'asc' ? 1 : -1;
    const key = { name: null, util: w => w.util, booked: w => w.booked, avail: w => w.avail }[S.sort];
    list.sort((a, b) => key ? (key(stats[a.id]) - key(stats[b.id])) * dir || a.name.localeCompare(b.name, 'ro') : a.name.localeCompare(b.name, 'ro') * dir);
    const th = (k, label, cls) => {
      const on = S.sort === k;
      return `<th data-sort="${k}"${cls ? ` class="${cls}"` : ''}${on ? ` aria-sort="${sortDir() === 'asc' ? 'ascending' : 'descending'}"` : ''}><button type="button" class="dp-th">${label}${on ? ico(sortDir() === 'asc' ? 'arrow-up' : 'chevron-down', 14) : ''}</button></th>`;
    };
    const today = todayId();
    tbl.innerHTML = `
      <thead><tr>
        ${th('name', 'Profesor')}
        ${D.DAYS.map(d => `<th class="dp-all__d${d.id === today ? ' is-today' : ''}" title="${esc(d.name)}: ore ocupate / disponibile"><span>${esc(d.short)}</span></th>`).join('')}
        ${th('booked', 'Ocupate', 'ax-num')}
        ${th('avail', 'Disponibile', 'ax-num')}
        ${th('util', 'Utilizare')}
      </tr></thead>
      <tbody>
        ${list.length ? list.map((t, i) => {
          const w = stats[t.id];
          return `<tr data-open="${t.id}" data-arrive style="--i:${i}">
            <td><button type="button" class="dp-all__name" data-t="${t.id}">${esc(t.name)}</button><span class="ax-sub">${esc(t.subjects.join(', '))}</span></td>
            ${D.DAYS.map(d => {
              const s = w.days[d.id];
              if (!s.avail && !s.booked) return `<td class="dp-c is-none"><span aria-label="indisponibil">·</span></td>`;
              const over = s.booked > s.inside;
              return `<td class="dp-c${over ? ' is-over' : ''}${d.id === today ? ' is-today' : ''}">
                <span class="dp-c__v"><b>${s.booked}</b>/${s.avail}</span>
                <span class="dp-c__bar" aria-hidden="true"><i style="width:${s.avail ? Math.min(100, pct(s.booked, s.avail)) : 100}%"></i></span>
              </td>`;
            }).join('')}
            <td class="ax-num">${nf.format(w.booked)}</td>
            <td class="ax-num">${nf.format(w.avail)}</td>
            <td>${utilBar(w)}</td>
          </tr>`;
        }).join('') : `<tr><td colspan="11"><div class="ax-empty"><b>Niciun profesor nu se potrivește filtrelor.</b></div></td></tr>`}
      </tbody>`;
    tbl.querySelectorAll('th[data-sort] button').forEach(b => b.addEventListener('click', () => {
      const k = b.parentElement.dataset.sort;
      if (S.sort === k) S.dir = sortDir() === 'asc' ? 'desc' : 'asc';
      else { S.sort = k; S.dir = null; }
      save(); paintAll();
    }));
    tbl.querySelectorAll('tr[data-open]').forEach(tr => tr.addEventListener('click', () => {
      S.t = tr.dataset.open; S.mode = 'one'; save(); paintMain(true);
    }));
  }

  function paintMain(scrollToWeek) {
    const box = rootEl.querySelector('#dpMain');
    rootEl.querySelectorAll('#dpMode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === S.mode)));
    if (S.mode === 'all') {
      box.innerHTML = allHTML();
      wireFilters('dpA', paintAll);
      paintAll();
      return;
    }
    if (!S.t) { S.t = (filtered()[0] || D.teachers[0]).id; save(); }
    box.innerHTML = oneHTML();
    wireFilters('dpL', paintList);
    const rail = box.querySelector('.dp-rail');
    box.querySelector('#dpRailBtn').addEventListener('click', e => {
      const open = rail.classList.toggle('is-open');
      e.currentTarget.setAttribute('aria-expanded', String(open));
    });
    paintList();
    paintWeek();
    if (scrollToWeek) {
      const target = matchMedia('(max-width: 1180px)').matches ? box.querySelector('#dpWeek') : rootEl.querySelector('.dp-main-h');
      const y = target.getBoundingClientRect().top + window.scrollY - 72; // under the sticky top bar
      window.scrollTo({ top: Math.max(0, y) });
    }
  }

  window.AdminViews.disponibilitate = {
    title: 'Disponibilitate',
    icon: 'clock',
    render(root, ctx) {
      rootEl = root;
      S = readState(ctx.query || {});
      finderMore = false;
      stats = {};
      D.teachers.forEach(t => { stats[t.id] = weekStats(t); });
      const totalAvail = D.teachers.reduce((n, t) => n + stats[t.id].avail, 0);
      const totalBooked = D.teachers.reduce((n, t) => n + stats[t.id].booked, 0);

      root.innerHTML = `
        <header class="ax-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('clock', 24)}</span>
            <div>
              <h1 class="ax-h1">Disponibilitatea profesorilor</h1>
              <p class="ax-lede">${plural(D.teachers.length, 'profesor', 'profesori')}, ${nf.format(totalBooked)} ore ocupate din ${nf.format(totalAvail)} disponibile pe săptămână (${pct(totalBooked, totalAvail)}%).</p>
            </div>
          </div>
          <div class="ax-head__keys">
            <div class="ax-seg" role="group" aria-label="Mod de afișare" id="dpMode">
              <button type="button" data-v="one" aria-pressed="${S.mode === 'one'}">Un profesor</button>
              <button type="button" data-v="all" aria-pressed="${S.mode === 'all'}">Toți profesorii</button>
            </div>
          </div>
        </header>
        <p class="dp-ro">${ico('info', 16)}<span>Disponibilitatea o completează profesorul în Registrul lui, tabul Disponibilitate. Aici doar se citește și se actualizează singură.</span></p>
        ${finderHTML()}
        <div class="ax-h2-row dp-main-h">
          <div><h2 class="ax-h2">${S.mode === 'all' ? 'Toți profesorii' : 'Săptămâna unui profesor'}</h2></div>
        </div>
        <div id="dpMain"></div>`;

      wireFinder();
      paintFinder();
      root.querySelectorAll('#dpMode button').forEach(b => b.addEventListener('click', () => {
        if (S.mode === b.dataset.v) return;
        S.mode = b.dataset.v; save();
        root.querySelector('.dp-main-h .ax-h2').textContent = S.mode === 'all' ? 'Toți profesorii' : 'Săptămâna unui profesor';
        paintMain(false);
      }));
      paintMain(false);
    }
  };
})();
