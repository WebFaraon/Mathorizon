/* ============================================================
   Admin console: Repartizare (rooms x hours)
   ============================================================
   The room board of one day, read like a platform board: rows are the
   eight cabinets of Examen.md Offline (or, in "Profesori" mode, the
   teachers who teach that day in any project), columns are the hours
   08:00-20:00. Groups are cards placed at their start hour.

   Moving a group:
   - drag a card with the mouse to another cell; while dragging every
     cell shows whether the move is valid for ALL the group's days
     (free / room taken / teacher busy or unavailable);
   - or open the "Mută" form in the drawer (Shift+click on the card, or
     from the clash list), with "Propune primul loc liber".
   A plain click (or Enter) on a card opens that teacher's register at
   the group, in a new tab (registru.html?t=..#grupa/..), where the
   admin edits the same data the teacher sees, live.
   Every move goes through AdminData.move and is pushed on a session
   undo stack.

   State lives in the hash query (#repartizare?day=3&rows=prof&disc=...)
   so filtered boards can be linked; ?focus=gID scrolls to a card.
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico, nf, plural, hh } = U;

  const FIRST = 8, END = 21, NCOL = 13;
  const DAY_LOWER = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];
  const isoToday = () => ((new Date().getDay() + 6) % 7) + 1;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const live = g => g.status !== 'inactiv';
  const range = (g, start) => `${hh(start == null ? g.start : start)}-${hh((start == null ? g.start : start) + g.duration)}`;
  const statusName = id => (D.GROUP_STATUS.find(s => s.id === id) || {}).name || id;
  const roomName = id => (id ? D.room(id).name : 'Online');
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function daysPhrase(days) {
    const n = days.slice().sort((a, b) => a - b).map(d => DAY_LOWER[d - 1]);
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' și ' + n[n.length - 1] : (n[0] || '');
  }

  /* ---- session state (survives route changes, not reloads) ---- */
  const undoStack = [];
  let M = null;              // mounted view: { root, ctx, s }
  let settleId = null;       // card to animate after the next render
  let lastBoardKey = null;   // day|rows|vis of the last board, to keep scroll on filter changes

  /* ============ state <-> URL ============ */
  const LIST_KEYS = ['proj', 'st', 'disc', 'cls', 'fmt', 'profil', 'reg'];
  function readState(q) {
    const s = {
      day: +q.day >= 1 && +q.day <= 7 ? +q.day : isoToday(),
      rows: q.rows === 'prof' ? 'prof' : 'cab',
      q: q.q || '',
      vis: q.vis === 'c' ? 'c' : 'max',
      hide: q.hide === '1',
      focus: q.focus || null
    };
    LIST_KEYS.forEach(k => { s[k] = U.listParam(q, k); });
    return s;
  }
  function writeState(s) {
    const o = { day: s.day, rows: s.rows === 'prof' ? 'prof' : null };
    LIST_KEYS.forEach(k => { o[k] = s[k]; });
    o.q = s.q || null;
    o.vis = s.vis === 'c' ? 'c' : null;
    o.hide = s.hide ? '1' : null;
    o.focus = s.focus || null;
    U.writeQuery(o);
  }
  const filterCount = s => LIST_KEYS.reduce((t, k) => t + (k === 'proj' && s.rows === 'cab' ? 0 : s[k].length), 0) + (s.q ? 1 : 0);

  /* ============ data helpers ============ */
  function pass(g, s) {
    if (s.st.length ? !s.st.includes(g.status) : !live(g)) return false;
    if (s.rows === 'cab') { if (!g.room) return false; } else if (s.proj.length && !s.proj.includes(g.project)) return false;
    if (s.disc.length && !s.disc.includes(g.subject)) return false;
    if (s.cls.length && !s.cls.includes(g.grade)) return false;
    if (s.fmt.length && !s.fmt.includes(String(g.size))) return false;
    if (s.profil.length && !s.profil.includes(g.profile)) return false;
    if (s.reg.length && !s.reg.includes(g.regime)) return false;
    if (s.q) {
      const t = D.teacher(g.teacher), q = norm(s.q);
      if (!norm(t.name).includes(q) && !norm(t.first + ' ' + t.last).includes(q)) return false;
    }
    return true;
  }
  const dayGroups = (s, day) => D.groups.filter(g => g.days.includes(day) && pass(g, s));

  function conflictInfo(day) {
    const list = D.conflicts(day).map(c => {
      const gs = c.groups.map(D.group);
      const from = Math.max(...gs.map(g => g.start));
      const to = Math.min(...gs.map(g => g.start + g.duration));
      return Object.assign({}, c, { gs, from, to });
    }).sort((a, b) => a.from - b.from || (a.kind === 'room' ? -1 : 1));
    const room = new Set(), teacher = new Set(), roomRows = new Set(), teacherRows = new Set();
    list.forEach(c => {
      c.groups.forEach(id => (c.kind === 'room' ? room : teacher).add(id));
      (c.kind === 'room' ? roomRows : teacherRows).add(c.kind === 'room' ? c.room : c.teacher);
    });
    return { list, room, teacher, roomRows, teacherRows };
  }

  /* Would group g fit in `room` at `start`, on ALL its days? */
  function check(g, room, start) {
    const end = start + g.duration;
    const res = { start, room: [], teacher: [], unavail: [], overflow: end > END || start < FIRST, small: 0 };
    D.groups.forEach(o => {
      if (o.id === g.id || !live(o)) return;
      if (o.start >= end || o.start + o.duration <= start) return;
      const days = g.days.filter(d => o.days.includes(d));
      if (!days.length) return;
      if (room && o.room === room) res.room.push({ o, days });
      if (o.teacher === g.teacher) res.teacher.push({ o, days });
    });
    g.days.forEach(d => { if (!D.isAvailable(g.teacher, d, start, g.duration)) res.unavail.push(d); });
    const r = room && D.room(room);
    if (r && r.seats < g.size) res.small = r.seats;
    res.bad = !!(res.teacher.length || res.unavail.length || res.overflow);
    res.clash = !!(res.room.length || res.small);
    res.ok = !res.bad && !res.clash;
    return res;
  }
  const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
  /* Every line starts with the day it is about, so a group held on two days
     says which of its days causes the problem. `.note` explains why the other
     day matters at all (the new hour applies to every day of the group). */
  function reasons(g, c) {
    const t = D.teacher(g.teacher);
    const out = [];
    if (c.overflow) out.push('Lecția s-ar termina după 21:00.');
    c.teacher.forEach(({ o, days }) => out.push(`${cap(daysPhrase(days))}: ${t.name} are deja ${o.subject} ${o.grade} la ${range(o)} (${o.room ? roomName(o.room) : 'online'}).`));
    c.unavail.forEach(d => {
      const wins = (t.availability[d] || []).map(([a, b]) => `${hh(a)}-${hh(b)}`).join(', ');
      out.push(`${cap(DAY_LOWER[d - 1])}: ${t.name} nu lucrează la ${range(g, c.start)} (${wins ? 'program ' + wins : 'nu are program în această zi'}).`);
    });
    c.room.forEach(({ o, days }) => out.push(`${cap(daysPhrase(days))}: ${roomName(o.room)} e ocupat la ${range(o)} de ${D.teacher(o.teacher).name} (${o.subject} ${o.grade}).`));
    if (c.small) out.push(`Cabinetul are doar ${c.small} locuri, grupa are ${g.size}.`);
    if (g.days.length > 1 && out.length) out.note = `Grupa se ține ${daysPhrase(g.days)}. Ora nouă se aplică în toate zilele, de aceea sunt verificate toate.`;
    return out;
  }
  /* reasons as <p>/<span> lines plus the muted note */
  const reasonsHTML = (g, c, tag, cls) => {
    const r = reasons(g, c);
    return r.map(x => `<${tag} class="${cls}">${esc(x)}</${tag}>`).join('') + (r.note ? `<${tag} class="rp-note">${esc(r.note)}</${tag}>` : '');
  };
  function shortReason(c) {
    if (c.overflow) return 'După 21:00';
    if (c.teacher.length) return 'Prof. ocupat';
    if (c.unavail.length) return 'Indisponibil';
    if (c.room.length) return 'Ocupat';
    if (c.small) return 'Prea mic';
    return 'Liber';
  }

  /* First free slot for all days: same hour in another room first (the
     students keep their hour), then the earliest valid hour and room. */
  function propose(g, strictOnly) {
    const others = D.rooms.map(r => r.id).filter(id => id !== g.room);
    const rooms = g.room ? [g.room].concat(others) : [null];
    // soft: room and teacher are free, only the availability is not confirmed
    const soft = c => !c.room.length && !c.small && !c.teacher.length && !c.overflow;
    for (const accept of strictOnly ? [c => c.ok] : [c => c.ok, soft]) {
      if (g.room) for (const r of others) if (accept(check(g, r, g.start))) return { room: r, start: g.start, soft: accept === soft };
      for (let h = FIRST; h + g.duration <= END; h++) {
        for (const r of rooms) {
          if (r === g.room && h === g.start) continue;
          if (accept(check(g, r, h))) return { room: r, start: h, soft: accept === soft };
        }
      }
    }
    return null;
  }
  function proposalNote(g, pr) {
    if (!pr) return 'Nu am găsit niciun loc liber în toate zilele grupei.';
    const where = esc(moveText(g, pr)) + (pr.start === g.start ? ', aceeași oră' : '');
    return pr.soft
      ? `Niciun loc nu e liber și în disponibilitatea profesorului. Cel mai apropiat: ${where}, cu cabinetul și profesorul liberi.`
      : `Propunere: ${where}.`;
  }

  function lanes(gs) {
    const sorted = gs.slice().sort((a, b) => a.start - b.start || b.duration - a.duration || a.id.localeCompare(b.id));
    const ends = [], lane = {};
    sorted.forEach(g => {
      let i = ends.findIndex(e => e <= g.start);
      if (i < 0) { i = ends.length; ends.push(0); }
      ends[i] = g.start + g.duration;
      lane[g.id] = i;
    });
    return { lane, n: Math.max(1, ends.length), sorted };
  }

  function rowsFor(s, gs) {
    if (s.rows === 'cab') {
      const rows = D.rooms.map(r => ({ id: r.id, kind: 'room', r, gs: gs.filter(g => g.room === r.id) }));
      return s.hide ? rows.filter(x => x.gs.length) : rows;
    }
    const byT = {};
    gs.forEach(g => (byT[g.teacher] = byT[g.teacher] || []).push(g));
    return Object.keys(byT).map(id => ({ id, kind: 'teacher', t: D.teacher(id), gs: byT[id] }))
      .sort((a, b) => a.t.last.localeCompare(b.t.last, 'ro') || a.t.first.localeCompare(b.t.first, 'ro'));
  }

  /* physical rooms of the day, unfiltered */
  function daySummary(day, ci) {
    const all = D.groups.filter(g => live(g) && g.days.includes(day));
    const inRooms = all.filter(g => g.room);
    const booked = new Set();
    inRooms.forEach(g => { for (let h = g.start; h < g.start + g.duration; h++) if (h < END) booked.add(g.room + '|' + h); });
    const used = new Set(inRooms.map(g => g.room)).size;
    const cap = D.rooms.length * NCOL;
    return {
      lessons: all.length, inRooms: inRooms.length, online: all.length - inRooms.length,
      used, booked: booked.size, cap, occ: U.pct(booked.size, cap), free: cap - booked.size,
      conf: ci.list.length,
      confRoom: ci.list.filter(c => c.kind === 'room').length,
      confTeacher: ci.list.filter(c => c.kind === 'teacher').length
    };
  }

  /* ============ markup ============ */
  function headHTML() {
    return `
      <div class="ax-fixsplit rp-split">
        <div class="rp-side rp-noprint">
          <div id="rpDays"></div>
          <aside class="ax-rail is-collapsible rp-rail" id="rpRail" aria-label="Filtre"></aside>
        </div>
        <div class="ax-col rp-col">
          <header class="rp-head">
            <h1 class="ax-sr">Repartizare pe cabinete</h1>
            <div class="rp-noprint rp-daytop" id="rpDaysTop"></div>
          </header>
          <div class="rp-main" id="rpMain"></div>
        </div>
      </div>`;
  }

  function dayStats(s, ci, d) {
    const n = dayGroups(s, d.id).length;
    const c = d.id === s.day ? ci.list.length : D.conflicts(d.id).length;
    return { n, c, today: d.id === isoToday() };
  }

  /* the days: the first control above the board */
  function daysTopHTML(s, ci) {
    return `
      <div class="ax-seg rp-days" role="group" aria-label="Ziua">
        ${D.DAYS.map(d => {
          const { n, c, today } = dayStats(s, ci, d);
          return `<button type="button" data-day="${d.id}" aria-pressed="${d.id === s.day}"${today ? ' class="is-today"' : ''}
            aria-label="${esc(d.name)}${today ? ', azi' : ''}: ${plural(n, 'lecție', 'lecții')}${c ? ', ' + plural(c, 'suprapunere', 'suprapuneri') : ''}">
            <span class="rp-days__n"><span class="rp-days__full">${esc(d.name)}</span><span class="rp-days__short">${esc(d.short)}</span></span>
            <span class="rp-days__c">${today ? '<em>azi</em>' : ''}${nf.format(n)}</span>
            ${c ? '<i class="rp-days__x" aria-hidden="true"></i>' : ''}
          </button>`;
        }).join('')}
      </div>
      <div class="ax-seg rp-modeseg" role="group" aria-label="Rânduri">
        <button type="button" data-rows="cab" aria-pressed="${s.rows === 'cab'}">${ico('door', 18)} Cabinete</button>
        <button type="button" data-rows="prof" aria-pressed="${s.rows === 'prof'}">${ico('user', 18)} Profesori</button>
      </div>`;
  }

  /* first block of the fixed column: the figures of the chosen day */
  function sideBlockHTML(s, sum) {
    return summaryHTML(s, sum);
  }

  function summaryHTML(s, sum) {
    const confTxt = sum.conf ? [sum.confRoom ? plural(sum.confRoom, 'în cabinet', 'în cabinete') : '', sum.confTeacher ? plural(sum.confTeacher, 'la profesor', 'la profesori') : ''].filter(Boolean).join(', ') : 'ziua e curată';
    return `
      <section class="rp-sum" aria-label="Sumarul zilei">
        <h2 class="rp-sum__h">${esc(D.DAYS[s.day - 1].name)}<small>sumarul zilei</small></h2>
        <div class="rp-sum__i"><span class="rp-sum__k">Lecții</span><b class="rp-sum__v">${nf.format(sum.lessons)}</b><span class="rp-sum__s">${nf.format(sum.inRooms)} în cabinete, ${nf.format(sum.online)} online</span></div>
        <div class="rp-sum__i"><span class="rp-sum__k">Cabinete</span><b class="rp-sum__v">${sum.used}<small> din ${D.rooms.length}</small></b><span class="rp-sum__s">${D.rooms.length - sum.used ? plural(D.rooms.length - sum.used, 'liber toată ziua', 'libere toată ziua') : 'toate au lecții'}</span></div>
        <div class="rp-sum__i rp-sum__i--occ"><span class="rp-sum__k">Ocupare</span><b class="rp-sum__v">${sum.occ}%</b>
          <span class="rp-sum__bar" role="img" aria-label="${sum.booked} din ${sum.cap} ore-cabinet ocupate"><i style="width:${sum.occ}%"></i></span>
          <span class="rp-sum__s">${nf.format(sum.booked)} din ${nf.format(sum.cap)} ore-cabinet</span></div>
        <div class="rp-sum__i"><span class="rp-sum__k">Ore libere</span><b class="rp-sum__v">${nf.format(sum.free)}</b><span class="rp-sum__s">între 08:00 și 21:00</span></div>
        <button type="button" class="rp-sum__i rp-sum__conf${sum.conf ? ' is-warn' : ''}" data-goconf title="Deschide lista de suprapuneri">
          <span class="rp-sum__k">Suprapuneri</span><b class="rp-sum__v">${sum.conf ? ico('alert', 20) : ''}${nf.format(sum.conf)}</b><span class="rp-sum__s">${esc(confTxt)}</span>
        </button>
      </section>`;
  }

  function chipItems(s) {
    const items = [];
    const lab = {
      proj: v => (D.project(v) || {}).name || v,
      st: v => statusName(v),
      disc: v => v,
      cls: v => 'Clasa ' + v,
      fmt: v => plural(+v, 'loc', 'locuri'),
      profil: v => 'Profil ' + v,
      reg: v => (v === 'vara' ? 'Școala de Vară' : 'Regim normal')
    };
    LIST_KEYS.forEach(k => {
      if (k === 'proj' && s.rows === 'cab') return;
      s[k].forEach(v => items.push({ key: k, value: v, label: lab[k](v) }));
    });
    if (s.q) items.push({ key: 'q', value: s.q, label: `Profesor: ${s.q}` });
    return items;
  }

  function seatsHTML(g) {
    const n = D.enrolled(g).length;
    let h = '';
    for (let i = 0; i < g.size; i++) h += `<i${i < n ? ' class="on"' : ''}></i>`;
    return `<span class="ax-seats" aria-hidden="true">${h}</span>`;
  }
  const stHTML = id => `<span class="ax-st ax-st--${esc(id)}"><i class="ax-st__i" aria-hidden="true"></i>${esc(statusName(id))}</span>`;

  function cardHTML(g, s, lane, ci) {
    const t = D.teacher(g.teacher);
    const rc = ci.room.has(g.id), tc = ci.teacher.has(g.id);
    const enr = D.enrolled(g).length;
    const label = `${t.name}, ${g.subject}, clasa ${g.grade}, ${range(g)}, ${roomName(g.room)}, ${statusName(g.status)}, ${enr} din ${g.size} locuri${rc ? ', cabinet dublat' : ''}${tc ? ', profesor dublat' : ''}. Deschide detaliile și mutarea.`;
    const cls = ['rp-card', 'rp-card--' + g.project, 'rp-card--st-' + g.status, 'rp-card--d' + g.duration];
    if (rc || tc) cls.push('is-clash');
    if (!live(g)) cls.push('is-off');
    if (g.id === settleId) cls.push('is-settle');
    const tag = rc ? '<span class="ax-tag ax-tag--warn rp-card__tag">în conflict</span>' : tc ? '<span class="ax-tag ax-tag--warn rp-card__tag">profesor dublat</span>' : '';
    const pos = `grid-column:${g.start - FIRST + 1} / span ${Math.min(g.duration, END - g.start)};grid-row:${lane + 1}`;
    if (s.vis !== 'max') {
      return `<button type="button" class="${cls.join(' ')} rp-card--c" data-g="${g.id}" style="${pos}" aria-label="${esc(label)}" title="${esc(t.name + ', ' + g.subject + ' ' + g.grade + ', ' + range(g))}">
        ${rc || tc ? '<span class="rp-card__hz ax-hazard" aria-hidden="true"></span>' : ''}
        ${s.rows === 'prof'
          ? `<span class="rp-card__t">${g.room ? 'Cab. ' + D.room(g.room).num : 'Online'}</span>`
          : `<span class="rp-card__t">${esc(t.last)} <span class="rp-card__i">${esc(t.first[0])}.</span></span>`}
        <span class="rp-card__m"><span class="ax-grade">${esc(g.grade)}</span>${seatsHTML(g)}</span>
      </button>`;
    }
    const head = s.rows === 'prof' ? (g.room ? D.room(g.room).name : 'Online') : t.name;
    const full = enr >= g.size;
    const sun = g.regime === 'vara' ? `<span class="rp-card__sun" role="img" aria-label="Școala de Vară" title="Școala de Vară">${ico('sun', 16)}</span>` : '';
    return `<button type="button" class="${cls.join(' ')}" data-g="${g.id}" style="${pos}" aria-label="${esc(label)}">
      ${rc || tc ? '<span class="rp-card__hz ax-hazard" aria-hidden="true"></span>' : ''}
      <span class="rp-card__top"><span class="rp-card__t">${esc(head)}</span>${tag || sun}</span>
      <span class="rp-card__id"><span class="ax-grade">${esc(g.grade)}</span><span class="rp-card__subj">${esc(g.subject)}</span></span>
      <span class="rp-card__f">${stHTML(g.status)}${g.profile ? `<span class="rp-card__p">${esc(g.profile)}</span>` : ''}</span>
      <span class="rp-card__fill${full ? ' is-full' : ''}">${seatsHTML(g)}<span class="rp-card__n"><b>${enr}</b>/${g.size}<small>${full ? 'complet' : 'elevi'}</small></span></span>
    </button>`;
  }

  function plateHTML(row, ci) {
    if (row.kind === 'room') {
      const r = row.r;
      const alert = ci.roomRows.has(r.id);
      return `<div class="rp-plate${alert ? ' has-alert' : ''}" title="${esc(r.name)}, ${r.seats} locuri, etajul ${r.floor}">
        <span class="rp-plate__k">Cab.</span>
        <b class="rp-plate__n">${r.num}</b>
        <span class="rp-plate__m"><span>${r.seats} loc.</span><span>et. ${r.floor}</span></span>
        ${alert ? `<span class="rp-plate__al" role="img" aria-label="Suprapunere în ${esc(r.name)}">${ico('alert', 14)}</span>` : ''}
      </div>`;
    }
    const t = row.t;
    const alert = ci.teacherRows.has(t.id);
    const projs = Array.from(new Set(row.gs.map(g => g.project)));
    return `<div class="rp-plate rp-plate--t${alert ? ' has-alert' : ''}" title="${esc(t.name)}">
      <b class="rp-plate__ln">${esc(t.last)}</b>
      <span class="rp-plate__fn">${esc(t.first)}</span>
      <span class="rp-plate__lines" aria-label="${esc(projs.map(p => D.project(p).name).join(', '))}">${projs.map(p => `<i class="rp-pl--${p}"></i>`).join('')}</span>
      ${alert ? `<span class="rp-plate__al" role="img" aria-label="${esc(t.name)} are două grupe în aceeași oră">${ico('alert', 14)}</span>` : ''}
    </div>`;
  }

  function nowFrac(day) {
    if (day !== isoToday()) return null;
    const n = new Date();
    const h = n.getHours() + n.getMinutes() / 60;
    if (h < FIRST || h >= END) return null;
    return { f: (h - FIRST) / NCOL, label: n.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }), hour: Math.floor(h) };
  }

  function boardHTML(s, rows, ci) {
    const now = nowFrac(s.day);
    const dayName = D.DAYS[s.day - 1].name;
    const head = `
      <div class="rp-hdr">
        <div class="rp-corner">${s.rows === 'cab' ? 'Cabinet' : 'Profesor'}</div>
        <div class="rp-hours">
          ${D.HOURS.map(h => `<div class="rp-hour${now && now.hour === h ? ' is-now' : ''}" data-h="${h}"><b>${String(h).padStart(2, '0')}</b><small>:00</small><span class="rp-hour__v"></span></div>`).join('')}
          ${now ? `<span class="rp-now__lbl" style="--f:${now.f}">${esc(now.label)}</span>` : ''}
        </div>
      </div>`;
    const body = rows.map((row, i) => {
      const L = lanes(row.gs);
      const busy = new Set();
      row.gs.forEach(g => { for (let h = g.start; h < g.start + g.duration; h++) busy.add(h); });
      const t = row.kind === 'teacher' ? row.t : null;
      const cells = D.HOURS.map(h => {
        const na = t && !D.isAvailable(t.id, s.day, h, 1);
        return `<div class="rp-cell" data-h="${h}"${busy.has(h) ? ' data-busy' : ''}${na ? ' data-na' : ''} style="grid-column:${h - FIRST + 1}"></div>`;
      }).join('');
      return `
        <div class="rp-row" data-row="${row.id}" data-arrive style="--i:${i};--lanes:${L.n}">
          <div class="rp-platecell">${plateHTML(row, ci)}</div>
          <div class="rp-track">${cells}${L.sorted.map(g => cardHTML(g, s, L.lane[g.id], ci)).join('')}</div>
        </div>`;
    }).join('');
    const empty = !rows.length ? `<div class="ax-empty rp-board__empty"><b>${s.rows === 'cab' ? 'Niciun cabinet de afișat' : 'Niciun profesor nu predă'}</b>${filterCount(s) || s.hide ? 'Nicio grupă nu trece de filtrele alese în ziua aceasta.' : 'Nu sunt lecții în ziua aceasta.'}</div>` : '';
    return `
      <section class="rp-boardwrap" aria-label="Tabla zilei">
        <p class="rp-print-t">Repartizare, ${esc(dayName)}${s.rows === 'prof' ? ', pe profesori' : ', pe cabinete'}</p>
        <div class="rp-scroll" id="rpScroll" tabindex="0" role="region" aria-label="Tabla de repartizare, ${esc(dayName)}. Derulează pe orizontală pentru toate orele.">
          <div class="rp-board ${s.vis === 'max' ? 'is-max' : 'is-c'} ${s.rows === 'prof' ? 'is-prof' : 'is-cab'}" id="rpBoard">
            ${head}
            ${body}
            ${now && rows.length ? `<span class="rp-now" style="--f:${now.f}" aria-hidden="true"></span>` : ''}
          </div>
          ${empty}
        </div>
      </section>`;
  }

  function conflictsListHTML(ci) {
    if (!ci.list.length) return '<p class="rp-conf__none">Nicio suprapunere în ziua selectată.</p>';
    return `<ol class="rp-conf__list">${ci.list.map((c, i) => {
      const isRoom = c.kind === 'room';
      const when = range({ start: c.from, duration: c.to - c.from });
      return `
        <li class="rp-cf">
          <span class="rp-cf__hz ax-hazard" aria-hidden="true"></span>
          <header class="rp-cf__h">
            <span class="rp-cf__k" aria-hidden="true">${ico(isRoom ? 'door' : 'user', 20)}</span>
            <div class="rp-cf__what">
              <b>${esc(isRoom ? roomName(c.room) : D.teacher(c.teacher).name)}</b>
              <span>${isRoom ? 'Același cabinet, în același timp' : 'Același profesor, în același timp'}</span>
            </div>
            <span class="rp-cf__when">${when}</span>
          </header>
          <div class="rp-cf__gs">
            ${c.gs.map(g => `
              <div class="rp-cg rp-cg--st-${esc(g.status)}">
                <b>${esc(D.teacher(g.teacher).name)}</b>
                <span class="rp-cg__s"><span class="ax-grade">${esc(g.grade)}</span>${esc(g.subject)}</span>
                <span class="rp-cg__t">${range(g)}${c.kind === 'teacher' ? ' · ' + esc(g.room ? 'Cabinet ' + D.room(g.room).num : 'online') : ''}</span>
                ${stHTML(g.status)}
              </div>`).join('')}
          </div>
          <footer class="rp-cf__f">
            <button type="button" class="ax-btn ax-btn--sm" data-show="${i}">${ico('eye', 16)} Arată pe tablă</button>
            <button type="button" class="ax-btn ax-btn--sm ax-btn--dark" data-fix="${i}">Rezolvă ${ico('arrow-right', 16)}</button>
          </footer>
        </li>`;
    }).join('')}</ol>`;
  }

  /* the clash list lives in a drawer, opened from the red/yellow count in the header */
  function openConflicts() {
    const s = M.s;
    const ci = conflictInfo(s.day);
    const dayName = D.DAYS[s.day - 1].name;
    const nR = ci.list.filter(c => c.kind === 'room').length, nT = ci.list.length - nR;
    const el = U.drawer({
      title: `Suprapuneri, ${esc(dayName)}`,
      sub: ci.list.length ? `${plural(nR, 'în cabinet', 'în cabinete')}, ${plural(nT, 'la profesor', 'la profesori')}. Calculate pentru toate grupele zilei, indiferent de filtre.` : 'Calculate pentru toate grupele zilei, indiferent de filtre.',
      body: `<div class="rp-conf rp-conf--drawer">${conflictsListHTML(ci)}</div>`
    });
    U.$$('[data-show]', el).forEach(b => b.addEventListener('click', () => {
      const c = ci.list[+b.dataset.show];
      el.close();
      showGroups(c.groups, c.kind);
    }));
    U.$$('[data-fix]', el).forEach(b => b.addEventListener('click', () => {
      const c = ci.list[+b.dataset.fix];
      // the second group, unless only the first one has a fully free slot
      const order = c.groups.length > 1 ? [c.groups[1], c.groups[0]].concat(c.groups.slice(2)) : c.groups;
      const gid = order.find(id => propose(D.group(id), true)) || order[0];
      openDrawer(gid, { propose: true, conflict: c });
    }));
  }

  /* ============ rail ============ */
  function buildRail() {
    const { root, s } = M;
    const rail = root.querySelector('#rpRail');
    if (!rail) return;
    const openIds = U.$$('.ax-ms.is-open', rail).map(x => x.dataset.id);
    const wasOpen = rail.classList.contains('is-open');
    const n = filterCount(s);
    rail.innerHTML = `
      <div class="ax-rail__head">
        <b>Filtre</b>
        <span class="rp-rail__n">${n ? `<span class="ax-ms__count">${n}</span>` : ''}</span>
        <button type="button" class="ax-link rp-rail__tg" aria-expanded="${wasOpen}" aria-controls="rpRail">${wasOpen ? 'Ascunde' : 'Arată filtrele'}</button>
      </div>
      <div class="ax-rail__lbl">Sursa datelor</div>
      <div data-slot="proj"></div>
      <div class="ax-rail__lbl">Grupe</div>
      <div class="rp-rail__stack" data-slot="groups"></div>
      <p class="rp-rail__note">Grupele inactive apar doar dacă le alegi la Statut grup.</p>
      <div class="ax-rail__lbl"><label for="rpQ">Profesor</label></div>
      <div class="ax-search">${ico('search', 16)}<input class="ax-input" id="rpQ" type="search" placeholder="Nume sau prenume" autocomplete="off" value="${esc(s.q)}"></div>
      <div class="ax-rail__sep"></div>
      <div class="ax-rail__lbl" id="rpVisL">Vizibilitate</div>
      <div class="ax-seg rp-vis" role="group" aria-labelledby="rpVisL">
        <button type="button" data-vis="c" aria-pressed="${s.vis !== 'max'}">Compactă</button>
        <button type="button" data-vis="max" aria-pressed="${s.vis === 'max'}">Maximă</button>
      </div>
      <label class="ax-switch rp-hide${s.rows === 'prof' ? ' is-dis' : ''}">
        <input type="checkbox" id="rpHide"${s.hide ? ' checked' : ''}${s.rows === 'prof' ? ' disabled' : ''}>
        <span class="ax-switch__t" aria-hidden="true"></span>
        <span>Ascunde rândurile goale${s.rows === 'prof' ? '<small>Doar pentru Cabinete</small>' : ''}</span>
      </label>
      <div class="ax-rail__sep"></div>
      <button type="button" class="ax-btn rp-rail__clear" id="rpClear"${n ? '' : ' disabled'}>${ico('x', 16)} Șterge toate filtrele</button>
      <div class="ax-rail__sep"></div>
      <div class="ax-rail__lbl">Legendă</div>
      <div class="rp-legend" aria-label="Legendă">
        <span><i class="rp-lg rp-lg--free"></i>Loc liber</span>
        <span><i class="rp-lg ax-hazard"></i>Cabinet dublat</span>
        <span><i class="rp-lg rp-lg--bad"></i>Profesor ocupat sau indisponibil</span>
        ${s.rows === 'prof' ? '<span><i class="rp-lg rp-lg--na"></i>În afara disponibilității</span>' + D.PROJECTS.map(p => `<span class="ax-line ax-line--${p.id}">${esc(p.short)}</span>`).join('') : ''}
      </div>
      <p class="rp-rail__note">Trage o grupă cu mausul sau deschide-o (clic, Enter) și folosește „Mută". Ctrl+Z anulează ultima mutare.</p>`;
    rail.classList.toggle('is-open', wasOpen);

    const on = key => vals => { s[key] = vals; s.focus = null; writeState(s); refreshRailCount(); renderMain(); };
    const projSlot = rail.querySelector('[data-slot="proj"]');
    if (s.rows === 'prof') {
      projSlot.appendChild(U.multiSelect({ id: 'proj', label: 'Proiect', options: D.PROJECTS.map(p => ({ value: p.id, label: p.name })), selected: s.proj, onChange: on('proj') }));
    } else {
      projSlot.innerHTML = `<p class="rp-rail__fixed"><span class="ax-line ax-line--exo">Examen.md Offline</span><small>Singurul proiect cu cabinete. Pentru online, alege rândurile Profesori.</small></p>`;
    }
    const stack = rail.querySelector('[data-slot="groups"]');
    const sizes = Array.from(new Set(D.groups.map(g => g.size))).sort((a, b) => a - b);
    [
      { id: 'st', label: 'Statut grup', tone: true, options: D.GROUP_STATUS.map(x => ({ value: x.id, label: x.name })) },
      { id: 'disc', label: 'Disciplină', options: D.SUBJECTS.map(x => ({ value: x, label: x })) },
      { id: 'cls', label: 'Clasa', options: D.GRADES.map(x => ({ value: x, label: 'Clasa ' + x })) },
      { id: 'fmt', label: 'Format grup', options: sizes.map(x => ({ value: String(x), label: x === 1 ? 'Individual, 1 loc' : plural(x, 'loc', 'locuri') })) },
      { id: 'profil', label: 'Profil', options: [{ value: 'Real', label: 'Real' }, { value: 'Uman', label: 'Uman' }] },
      { id: 'reg', label: 'Regim', options: [{ value: 'normal', label: 'Regim normal' }, { value: 'vara', label: 'Școala de Vară' }] }
    ].forEach(f => stack.appendChild(U.multiSelect({ id: f.id, label: f.label, options: f.options, selected: s[f.id], onChange: on(f.id), tone: !!f.tone })));
    openIds.forEach(id => { const ms = rail.querySelector(`.ax-ms[data-id="${id}"]`); if (ms) { ms.classList.add('is-open'); ms.querySelector('.ax-ms__btn').setAttribute('aria-expanded', 'true'); } });

    rail.querySelector('.rp-rail__tg').addEventListener('click', e => {
      const open = !rail.classList.contains('is-open');
      rail.classList.toggle('is-open', open);
      e.currentTarget.setAttribute('aria-expanded', String(open));
      e.currentTarget.textContent = open ? 'Ascunde' : 'Arată filtrele';
    });
    let tmr;
    U.suggest(rail.querySelector('#rpQ'), () => D.teachers.map(t => t.name).sort((a, b) => a.localeCompare(b, 'ro')));
    rail.querySelector('#rpQ').addEventListener('input', e => {
      clearTimeout(tmr);
      const v = e.target.value.trim();
      tmr = setTimeout(() => { s.q = v; s.focus = null; writeState(s); refreshRailCount(); renderMain(); }, 160);
    });
    U.$$('[data-vis]', rail).forEach(b => b.addEventListener('click', () => {
      s.vis = b.dataset.vis; writeState(s);
      U.$$('[data-vis]', rail).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderMain();
    }));
    rail.querySelector('#rpHide').addEventListener('change', e => { s.hide = e.target.checked; writeState(s); renderMain(); });
    rail.querySelector('#rpClear').addEventListener('click', clearFilters);
  }
  function refreshRailCount() {
    const rail = M && M.root.querySelector('#rpRail');
    if (!rail) return;
    const n = filterCount(M.s);
    rail.querySelector('.rp-rail__n').innerHTML = n ? `<span class="ax-ms__count">${n}</span>` : '';
    rail.querySelector('#rpClear').disabled = !n;
  }
  function clearFilters() {
    const s = M.s;
    LIST_KEYS.forEach(k => { s[k] = []; });
    s.q = ''; s.focus = null;
    writeState(s); buildRail(); renderMain();
  }

  /* ============ main area ============ */
  function renderMain(first) {
    if (!M) return;
    const { root, s } = M;
    const main = root.querySelector('#rpMain');
    if (!main) return;
    if (!first) root.classList.remove('is-fresh');
    const prev = main.querySelector('#rpScroll');
    const keep = prev ? { l: prev.scrollLeft, t: prev.scrollTop } : null;
    const key = `${s.day}|${s.rows}|${s.vis}`;

    const ci = conflictInfo(s.day);
    const gs = dayGroups(s, s.day);
    const rows = rowsFor(s, gs);
    const chips = chipItems(s);
    root.querySelector('#rpDaysTop').innerHTML = daysTopHTML(s, ci);
    root.querySelector('#rpDays').innerHTML = sideBlockHTML(s, daySummary(s.day, ci));
    main.innerHTML = `
      <div class="rp-chips rp-noprint">${U.activeChips(chips)}</div>
      ${boardHTML(s, rows, ci)}`;

    wireMain(main, s, ci, chips);

    const sc = main.querySelector('#rpScroll');
    if (keep && key === lastBoardKey) { sc.scrollLeft = keep.l; sc.scrollTop = keep.t; }
    else initialScroll(sc, s, rows);
    lastBoardKey = key;
    settleId = null;

    if (s.focus) {
      const id = s.focus;
      s.focus = null; writeState(s);
      const g = D.group(id);
      if (g) requestAnimationFrame(() => {
        const b = M.root.querySelector('#rpBoard');
        if (b && b.querySelector(`[data-g="${id}"]`)) focusGroups([id], true);
        else showGroups([id], g.room ? 'room' : 'teacher');
      });
    }
  }

  function colWidth(sc) {
    const h = sc.querySelector('.rp-hour');
    return h ? h.getBoundingClientRect().width : 60;
  }
  function initialScroll(sc, s, rows) {
    if (sc.scrollWidth <= sc.clientWidth + 2) return;
    const now = nowFrac(s.day);
    let h = now ? now.hour - 1 : null;
    if (h == null) {
      const starts = rows.flatMap(r => r.gs.map(g => g.start));
      h = starts.length ? Math.min(...starts) : FIRST;
    }
    sc.scrollLeft = Math.max(0, (h - FIRST) * colWidth(sc));
  }

  function wireMain(main, s, ci, chips) {
    const root = M.root;
    const visible = sel => U.$$(sel, root).find(x => x.offsetParent !== null);
    U.$$('[data-day]', root).forEach(b => b.addEventListener('click', () => {
      if (+b.dataset.day === s.day) return;
      s.day = +b.dataset.day; s.focus = null; writeState(s); renderMain();
      const nb = visible(`[data-day="${s.day}"]`); if (nb) nb.focus();
    }));
    U.$$('[data-rows]', root).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.rows === s.rows) return;
      s.rows = b.dataset.rows; s.focus = null; writeState(s); buildRail(); renderMain();
      const nb = visible(`[data-rows="${s.rows}"]`); if (nb) nb.focus();
    }));
    U.wireActiveChips(main.querySelector('.rp-chips'), chips, it => {
      if (it.key === 'q') s.q = ''; else s[it.key] = s[it.key].filter(v => v !== it.value);
      writeState(s); buildRail(); renderMain();
    }, clearFilters);
    root.querySelector('[data-goconf]').addEventListener('click', openConflicts);

    const sc = main.querySelector('#rpScroll');
    const board = main.querySelector('#rpBoard');
    board.addEventListener('click', e => {
      const card = e.target.closest('.rp-card');
      if (!card) return;
      if (drag.justDropped) { drag.justDropped = false; return; }
      const g = D.group(card.dataset.g);
      if (!g) return;
      // a click opens the group's tab in its Google Sheets register; a group with no register yet opens the side panel (Shift+click always does)
      const url = !e.shiftKey && window.AdminSheetLinks && window.AdminSheetLinks.groupUrl(g.id);
      if (url) window.open(url, '_blank', 'noopener'); else openDrawer(g.id);
    });
    wireDrag(sc, board, s);
  }

  /* Scroll to cards and pulse them; if a filter or the row mode hides
     them, clear the filters / switch mode first. */
  function showGroups(ids, kind) {
    const s = M.s;
    const board = () => M.root.querySelector('#rpBoard');
    const missing = () => ids.some(id => !board() || !board().querySelector(`[data-g="${id}"]`));
    if (missing()) {
      const gs = ids.map(D.group);
      const needProf = gs.some(g => !g.room) || kind === 'teacher' && s.rows === 'prof';
      LIST_KEYS.forEach(k => { s[k] = []; });
      s.q = ''; s.hide = false;
      if (gs.some(g => !live(g))) s.st = ['activ', 'completare', 'inlocuire', 'inactiv'];
      if (needProf) s.rows = 'prof';
      if (!gs.every(g => g.days.includes(s.day))) s.day = gs[0].days[0];
      writeState(s); buildRail(); renderMain();
      U.toast('Filtrele au fost scoase ca să apară grupele căutate.');
    }
    requestAnimationFrame(() => focusGroups(ids, true));
  }
  function focusGroups(ids, scroll) {
    const board = M && M.root.querySelector('#rpBoard');
    if (!board) return;
    const cards = ids.map(id => board.querySelector(`[data-g="${id}"]`)).filter(Boolean);
    if (!cards.length) return;
    if (scroll) {
      const sc = M.root.querySelector('#rpScroll');
      const c = cards[0];
      const sr = sc.getBoundingClientRect(), cr = c.getBoundingClientRect();
      const plate = board.querySelector('.rp-platecell');
      const pw = plate ? plate.getBoundingClientRect().width : 0;
      const hdr = board.querySelector('.rp-hdr').getBoundingClientRect().height;
      const behavior = reduced() ? 'auto' : 'smooth';
      const left = sc.scrollLeft + (cr.left - sr.left) - pw - Math.max(0, (sr.width - pw - cr.width) / 2);
      const top = sc.scrollTop + (cr.top - sr.top) - hdr - Math.max(0, (sr.height - hdr - cr.height) / 2);
      sc.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior });
      const wr = sc.getBoundingClientRect();
      if (wr.top < 70 || wr.top > innerHeight * 0.45) window.scrollTo({ top: window.scrollY + wr.top - 84, behavior });
    }
    cards.forEach(c => {
      c.classList.remove('is-pulse');
      void c.offsetWidth;
      c.classList.add('is-pulse');
      setTimeout(() => c.classList.remove('is-pulse'), 2600);
    });
  }

  /* ============ moving ============ */
  function moveText(g, patch) {
    const room = 'room' in patch ? patch.room : g.room;
    const start = 'start' in patch ? patch.start : g.start;
    return room ? `${roomName(room)}, ${hh(start)}` : `ora ${hh(start)}`;
  }
  function apply(g, patch) {
    if (D.blocked()) return;
    const prev = { start: g.start, room: g.room };
    const entry = { id: g.id, prev, next: Object.assign({}, prev, patch) };
    undoStack.push(entry);
    settleId = g.id;
    D.move(g.id, patch); // onChange re-renders the board
    const txt = `Grupa mutată în ${moveText(g, {})}.`.replace('în ora', 'la ora');
    U.toast(`<span class="rp-toast"><span>${esc(txt)}</span><button type="button" class="rp-toast__undo">${ico('undo', 14)} Anulează</button></span>`);
    const t = document.querySelector('.ax-toasts') && document.querySelector('.ax-toasts').lastElementChild;
    const b = t && t.querySelector('.rp-toast__undo');
    if (b) b.addEventListener('click', () => { undo(entry); t.remove(); });
  }
  function undo(entry) {
    if (D.blocked()) return;
    const i = entry ? undoStack.indexOf(entry) : undoStack.length - 1;
    if (i < 0) return;
    const e = undoStack.splice(i, 1)[0];
    const g = D.group(e.id);
    settleId = e.id;
    D.move(e.id, e.prev);
    U.toast(esc(`Mutare anulată: ${D.teacher(g.teacher).name}, ${g.subject} ${g.grade} e din nou ${e.prev.room ? 'în ' + roomName(e.prev.room) + ', ' : 'la '}${hh(e.prev.start)}.`));
  }
  /* Validate then move; asks before an invalid move. */
  async function tryMove(g, room, start) {
    if (D.blocked()) return false;
    if (room === g.room && start === g.start) return false;
    const c = check(g, room, start);
    if (!c.ok) {
      const yes = await confirmDialog(`Mutarea la ${room ? roomName(room) + ', ' : ''}${hh(start)} are probleme`, reasons(g, c), c);
      if (!yes) return false;
    }
    apply(g, g.room ? { start, room } : { start });
    return true;
  }

  function confirmDialog(title, list, c) {
    const note = c && (c.room.length || c.teacher.length)
      ? 'Muți grupa oricum? Suprapunerea va apărea în lista de conflicte până o rezolvi.'
      : 'Muți grupa oricum? Confirmă ora cu profesorul înainte să anunți elevii.';
    return new Promise(res => {
      const d = document.createElement('dialog');
      d.className = 'rp-dlg';
      d.setAttribute('aria-labelledby', 'rpDlgT');
      d.innerHTML = `
        <div class="rp-dlg__hz ax-hazard" aria-hidden="true"></div>
        <div class="rp-dlg__b">
          <h2 id="rpDlgT">${esc(title)}</h2>
          <ul>${list.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
          ${list.note ? `<p class="rp-note">${esc(list.note)}</p>` : ''}
          <p>${esc(note)}</p>
        </div>
        <div class="rp-dlg__f">
          <button type="button" class="ax-btn" data-v="no" autofocus>Renunță</button>
          <button type="button" class="ax-btn ax-btn--dark" data-v="yes">Mută oricum</button>
        </div>`;
      document.body.appendChild(d);
      d.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => d.close(b.dataset.v)));
      d.addEventListener('close', () => { res(d.returnValue === 'yes'); d.remove(); });
      d.addEventListener('click', e => { if (e.target === d) d.close('no'); });
      d.showModal();
    });
  }

  /* ---- drag and drop (mouse / pen; touch uses the drawer) ---- */
  const drag = { justDropped: false };
  function wireDrag(sc, board, s) {
    board.addEventListener('pointerdown', e => {
      const card = e.target.closest('.rp-card');
      if (!card || e.button !== 0 || e.pointerType === 'touch') return;
      const g = D.group(card.dataset.g);
      const x0 = e.clientX, y0 = e.clientY;
      const cr = card.getBoundingClientRect();
      const cw = colWidth(sc);
      const grab = Math.max(0, Math.min(g.duration - 1, Math.floor((x0 - cr.left) / cw)));
      let started = false, ghost = null, tip = null, target = null, raf = 0, px = x0, py = y0;
      const cache = {};

      const begin = () => {
        started = true;
        board.classList.add('is-dragging');
        card.classList.add('is-src');
        U.$$('.rp-row', board).forEach(row => {
          const rid = row.dataset.row;
          U.$$('.rp-cell', row).forEach(cell => {
            const h = +cell.dataset.h;
            const start = h;
            let st;
            if (s.rows === 'prof' && rid !== g.teacher) st = 'off';
            else {
              const room = s.rows === 'cab' ? rid : g.room;
              const c = check(g, room, start);
              cache[rid + '|' + h] = c;
              st = c.bad ? 'bad' : c.clash ? 'room' : 'ok';
            }
            cell.classList.add('v-' + st);
            const isOrigin = (s.rows === 'cab' ? rid === g.room : rid === g.teacher) && h >= g.start && h < g.start + g.duration;
            if (isOrigin) cell.classList.add('v-origin');
          });
        });
        // Teacher reasons do not depend on the room: say them once per hour, in the header.
        const max = board.classList.contains('is-max');
        U.$$('.rp-hour', board).forEach(hd => {
          const h = +hd.dataset.h;
          const c = check(g, null, h);
          if (!c.bad) return;
          const long = shortReason(c);
          const short = { 'Prof. ocupat': 'Ocupat', 'Indisponibil': 'Indisp.', 'După 21:00': 'Târziu' }[long] || long;
          hd.classList.add('v-bad');
          if (!c.teacher.length && c.unavail.length) hd.classList.add('v-unav');
          hd.title = reasons(g, c).join(' ');
          hd.querySelector('.rp-hour__v').textContent = max ? (long === 'Prof. ocupat' ? 'Profesor ocupat' : long === 'Indisponibil' ? 'Profesor indisponibil' : long) : short;
        });
        ghost = card.cloneNode(true);
        ghost.className = card.className.replace(/\bis-(src|settle|pulse)\b/g, '') + ' rp-ghost';
        ghost.removeAttribute('style');
        ghost.style.width = cr.width + 'px';
        ghost.style.height = cr.height + 'px';
        ghost.setAttribute('aria-hidden', 'true');
        tip = document.createElement('div');
        tip.className = 'rp-tip';
        tip.setAttribute('role', 'status');
        document.body.append(ghost, tip);
        document.body.classList.add('rp-grabbing');
        raf = requestAnimationFrame(autoScroll);
      };

      const place = () => {
        ghost.style.transform = `translate(${px - (x0 - cr.left)}px, ${py - (y0 - cr.top)}px)`;
        U.$$('.is-target', board).forEach(c => c.classList.remove('is-target', 't-ok', 't-room', 't-bad'));
        const el = document.elementFromPoint(px, py);
        const cell = el && el.closest('.rp-cell');
        target = null;
        let html = '';
        if (cell && board.contains(cell)) {
          const row = cell.closest('.rp-row');
          const rid = row.dataset.row;
          const start = +cell.dataset.h - grab;
          if (s.rows === 'prof' && rid !== g.teacher) {
            html = `<b>Alt profesor</b><span>În rândurile Profesori grupa se mută doar pe ore, în rândul profesorului ei.</span>`;
          } else if (start < FIRST || start + g.duration > END) {
            html = `<b>${hh(Math.max(FIRST, start))}</b><span class="is-bad">Lecția nu încape în program (08:00-21:00).</span>`;
          } else {
            const room = s.rows === 'cab' ? rid : g.room;
            const c = cache[rid + '|' + start] || check(g, room, start);
            target = { room, start, c, rid };
            const tk = 't-' + (c.bad ? 'bad' : c.clash ? 'room' : 'ok');
            for (let h = start; h < start + g.duration; h++) {
              const x = row.querySelector(`.rp-cell[data-h="${h}"]`);
              if (x) x.classList.add('is-target', tk);
            }
            const where = `${room && s.rows === 'cab' ? roomName(room) + ', ' : ''}${range(g, start)}`;
            const same = room === g.room && start === g.start;
            html = same
              ? `<b>${esc(where)}</b><span>Poziția actuală.</span>`
              : c.ok
                ? `<b>${esc(where)}</b><span class="is-ok">${ico('check', 14)} Liber ${esc(daysPhrase(g.days))}.</span>`
                : `<b>${esc(where)}</b>${reasonsHTML(g, c, 'span', c.bad ? 'is-bad' : 'is-warn')}`;
          }
        }
        tip.innerHTML = html;
        tip.hidden = !html;
        if (html) {
          const tw = tip.offsetWidth, th = tip.offsetHeight;
          let tx = px + 16, ty = py + cr.height - (y0 - cr.top) + 10;
          if (tx + tw > innerWidth - 8) tx = innerWidth - 8 - tw;
          if (ty + th > innerHeight - 8) ty = py - (y0 - cr.top) - th - 10;
          tip.style.transform = `translate(${Math.max(8, tx)}px, ${Math.max(8, ty)}px)`;
        }
      };

      const autoScroll = () => {
        const r = sc.getBoundingClientRect();
        const pw = (board.querySelector('.rp-platecell') || { offsetWidth: 0 }).offsetWidth;
        const hd = board.querySelector('.rp-hdr').offsetHeight;
        const m = 48;
        let dx = 0, dy = 0;
        if (px < r.left + pw + m && px > r.left - 40) dx = -Math.ceil((r.left + pw + m - px) / 5);
        else if (px > r.right - m && px < r.right + 40) dx = Math.ceil((px - (r.right - m)) / 5);
        if (py < r.top + hd + 28 && py > r.top - 40) dy = -Math.ceil((r.top + hd + 28 - py) / 5);
        else if (py > r.bottom - 28 && py < r.bottom + 40) dy = Math.ceil((py - (r.bottom - 28)) / 5);
        if (dx || dy) { sc.scrollLeft += dx; sc.scrollTop += dy; place(); }
        raf = requestAnimationFrame(autoScroll);
      };

      let over = false;
      const end = async drop => {
        if (over) return;
        over = true;
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerup', onUp);
        card.removeEventListener('pointercancel', onCancel);
        card.removeEventListener('lostpointercapture', onCancel);
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('blur', onCancel);
        window.removeEventListener('hashchange', onCancel);
        if (!started) return;
        cancelAnimationFrame(raf);
        ghost.remove(); tip.remove();
        document.body.classList.remove('rp-grabbing');
        board.classList.remove('is-dragging');
        card.classList.remove('is-src');
        U.$$('.rp-cell', board).forEach(c => { c.className = 'rp-cell'; });
        U.$$('.rp-hour.v-bad', board).forEach(hd => { hd.classList.remove('v-bad', 'v-unav'); hd.removeAttribute('title'); hd.querySelector('.rp-hour__v').textContent = ''; });
        drag.justDropped = true;
        setTimeout(() => { drag.justDropped = false; }, 0);
        if (drop && target) await tryMove(g, target.room, target.start);
      };
      const onMove = ev => {
        // the button was released somewhere we never heard about (other tab, other window)
        if (ev.buttons === 0 && ev.pointerType === 'mouse') { end(false); return; }
        px = ev.clientX; py = ev.clientY;
        if (!started) { if (Math.hypot(px - x0, py - y0) < 6) return; begin(); }
        place();
      };
      const onUp = () => end(true);
      const onCancel = () => end(false);
      const onHide = () => { if (document.hidden) end(false); };
      const onKey = ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); end(false); } };
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerup', onUp);
      card.addEventListener('pointercancel', onCancel);
      card.addEventListener('lostpointercapture', onCancel);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('blur', onCancel);
      window.addEventListener('hashchange', onCancel);
    });
  }
  /* A ghost or tooltip must never outlive its drag (route change, re-render). */
  function clearStrayDrag() {
    document.querySelectorAll('.rp-ghost, .rp-tip').forEach(n => n.remove());
    document.body.classList.remove('rp-grabbing');
  }
  window.addEventListener('hashchange', clearStrayDrag);
  window.addEventListener('pagehide', clearStrayDrag);

  /* ============ drawer ============ */
  function openDrawer(gid, opts) {
    opts = opts || {};
    const g = D.group(gid);
    if (!g) return;
    const t = D.teacher(g.teacher), p = D.project(g.project);
    const sel = { room: g.room, start: g.start };
    let proposed = null;
    if (opts.propose) { proposed = propose(g); if (proposed) { sel.room = proposed.room; sel.start = proposed.start; } }
    const studs = D.studentsOf(g.id).slice().sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    const enr = D.enrolled(g).length;
    const room = g.room && D.room(g.room);

    const body = `
      ${opts.conflict ? `<div class="rp-dr__alert"><span class="ax-hazard" aria-hidden="true"></span><p><b>${opts.conflict.kind === 'room' ? 'Cabinet dublat' : 'Profesor dublat'}</b> ${esc(range({ start: opts.conflict.from, duration: opts.conflict.to - opts.conflict.from }))}, cu ${esc(opts.conflict.gs.filter(x => x.id !== g.id).map(x => D.teacher(x.teacher).name + ' (' + x.subject + ' ' + x.grade + ')').join(', '))}.${proposed ? ' Am propus mai jos primul loc liber.' : ''}</p></div>` : ''}
      <dl class="ax-dl rp-dr__dl">
        <dt>Profesor</dt><dd>${esc(t.name)}<span class="ax-sub">${esc(t.phone)}</span></dd>
        <dt>Proiect</dt><dd><span class="ax-line ax-line--${p.id}">${esc(p.name)}</span></dd>
        <dt>Disciplina</dt><dd>${esc(g.subject)}</dd>
        <dt>Clasa</dt><dd><span class="ax-grade">${esc(g.grade)}</span>${g.profile ? ` <span class="rp-dr__aside">profil ${esc(g.profile)}</span>` : ''}</dd>
        <dt>Nivel</dt><dd>${esc(g.level)}</dd>
        <dt>Format</dt><dd class="rp-dr__seats">${seatsHTML(g)} <span>${enr} din ${plural(g.size, 'loc ocupat', 'locuri ocupate')}</span></dd>
        <dt>Program</dt><dd>${esc(U.daysLabel(g.days.slice().sort((a, b) => a - b)))}<span class="ax-sub">${range(g)}, ${plural(g.duration, 'oră', 'ore')}</span></dd>
        <dt>Cabinet</dt><dd>${room ? `${esc(room.name)}<span class="ax-sub">${room.seats} locuri, etajul ${room.floor}</span>` : 'Online, fără cabinet'}</dd>
        <dt>Regim</dt><dd>${g.regime === 'vara' ? '<span class="ax-tag ax-tag--sun">Școala de Vară</span>' : 'Regim normal'}</dd>
      </dl>

      <section class="rp-dr__sec" aria-labelledby="rpStT">
        <h3 class="rp-dr__h" id="rpStT">Statut</h3>
        <div class="ax-seg rp-dr__st" role="group" aria-labelledby="rpStT">
          ${D.GROUP_STATUS.map(x => `<button type="button" data-st="${x.id}" aria-pressed="${g.status === x.id}">${stHTML(x.id)}</button>`).join('')}
        </div>
      </section>

      <section class="rp-dr__sec rp-mv" aria-labelledby="rpMvT">
        <div class="rp-dr__hrow">
          <h3 class="rp-dr__h" id="rpMvT">Mută</h3>
          <button type="button" class="ax-btn ax-btn--sm" data-propose>${ico('sparkles', 16)} Propune primul loc liber</button>
        </div>
        <p class="rp-dr__note">Verificat pentru toate zilele grupei: ${esc(daysPhrase(g.days))}.</p>
        ${g.room ? `
          <label class="rp-dr__lbl" for="rpMvRoom">Cabinet</label>
          <select class="ax-select" id="rpMvRoom">
            ${D.rooms.map(r => `<option value="${r.id}">${esc(r.name)}, ${r.seats} locuri, etajul ${r.floor}${r.id === g.room ? ' (actual)' : ''}</option>`).join('')}
          </select>` : ''}
        <span class="rp-dr__lbl" id="rpMvHL">Ora de început</span>
        <div class="rp-hrs" role="radiogroup" aria-labelledby="rpMvHL" id="rpMvH"></div>
        <p class="rp-hrs__key" aria-hidden="true"><span class="is-busy"><i></i>are oră: profesorul predă altă grupă</span><span class="is-unav"><i></i>indisp.: în afara programului lui</span><span class="is-room"><i></i>ocupat: cabinetul e luat</span></p>
        <div class="rp-mv__res" id="rpMvRes" aria-live="polite"></div>
      </section>

      <section class="rp-dr__sec" aria-labelledby="rpStudT">
        <h3 class="rp-dr__h" id="rpStudT">Elevi <span class="rp-dr__cnt">${studs.length}</span></h3>
        ${studs.length ? `<div class="ax-table-wrap"><table class="ax-table rp-dr__tbl">
          <thead><tr><th scope="col">Elev</th><th scope="col">Statut</th><th scope="col" class="ax-num">Sold</th></tr></thead>
          <tbody>${studs.map(st => `<tr><td><span class="ax-strong">${esc(st.name)}</span><span class="ax-sub">${esc(st.phone)}</span></td><td><span class="ax-st ax-st--${esc(D.statusIn(st, g.id))}"><i class="ax-st__i" aria-hidden="true"></i>${esc((D.STUDENT_STATUS.find(x => x.id === D.statusIn(st, g.id)) || {}).name || st.status)}</span></td><td class="ax-num${D.soldIn(st, g.id) < 0 ? ' ax-neg' : ''}">${U.money(D.soldIn(st, g.id))}</td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="rp-dr__note">Niciun elev înscris.</p>'}
      </section>`;

    const dr = U.drawer({
      title: `${esc(g.subject)}, clasa ${esc(g.grade)}`,
      sub: `<span class="ax-line ax-line--${p.id}">${esc(p.short)}</span> <span class="rp-dr__sub">${esc(t.name)}, ${esc(U.daysLabel(g.days.slice().sort((a, b) => a - b)))}, ${range(g)}${room ? ', ' + esc(room.name) : ''}</span>`,
      body,
      actions: `<button type="button" class="ax-btn" data-close>Închide</button><button type="button" class="ax-btn ax-btn--primary" data-save>${ico('arrow-right', 16)} Mută grupa</button>`
    });
    dr.classList.add('rp-drawer');

    const hrs = dr.querySelector('#rpMvH');
    const res = dr.querySelector('#rpMvRes');
    const save = dr.querySelector('[data-save]');
    const roomSel = dr.querySelector('#rpMvRoom');
    if (roomSel) roomSel.value = sel.room;

    const paint = note => {
      const tiles = [];
      for (let h = FIRST; h < END; h++) {
        const fits = h + g.duration <= END;
        const c = fits ? check(g, sel.room, h) : null;
        const cur = sel.room === g.room && h === g.start;
        // two different problems, two different colours: the teacher teaches
        // something else then (busy, red) / is outside his schedule (unav, amber)
        const k = !fits ? 'out' : c.ok ? 'ok' : c.teacher.length ? 'busy' : c.unavail.length ? 'unav' : c.bad ? 'bad' : 'room';
        const word = !fits ? 'nu încape' : cur ? 'actual' : c.ok ? 'liber' : { 'Prof. ocupat': 'are oră', 'Indisponibil': 'indisp.', 'Ocupat': 'ocupat', 'Prea mic': 'prea mic', 'După 21:00': 'târziu' }[shortReason(c)];
        const full = !fits ? 'nu încape în program' : cur ? 'poziția actuală' : c.ok ? 'liber' : reasons(g, c).join(' ');
        const aria = k === 'busy' ? 'profesorul are altă lecție' : k === 'unav' ? 'în afara programului profesorului' : '';
        tiles.push(`<button type="button" role="radio" class="rp-hr rp-hr--${k}${cur ? ' is-cur' : ''}" data-h="${h}" aria-checked="${h === sel.start}"${fits ? '' : ' disabled'} tabindex="${h === sel.start ? 0 : -1}" aria-label="${hh(h)}, ${esc(aria ? aria + '. ' + full : full)}" title="${esc(full)}">
          <b>${hh(h)}</b><small>${esc(word)}</small>${k === 'room' ? '<i class="ax-hazard" aria-hidden="true"></i>' : ''}</button>`);
      }
      hrs.innerHTML = tiles.join('');
      const same = sel.room === g.room && sel.start === g.start;
      const c = check(g, sel.room, sel.start);
      const where = `${sel.room ? roomName(sel.room) + ', ' : ''}${range(g, sel.start)}`;
      res.innerHTML = (note ? `<p class="rp-mv__note">${note}</p>` : '') + (same
        ? `<p class="rp-mv__line">${esc(where)}: poziția actuală${c.ok ? '' : ', cu probleme'}.</p>${c.ok ? '' : reasonsHTML(g, c, 'p', 'rp-mv__line is-' + (c.bad ? 'bad' : 'warn'))}`
        : c.ok
          ? `<p class="rp-mv__line is-ok">${ico('check', 16)} ${esc(where)}: liber ${esc(daysPhrase(g.days))}.</p>`
          : reasonsHTML(g, c, 'p', 'rp-mv__line is-' + (c.bad ? 'bad' : 'warn')));
      save.disabled = same;
      save.innerHTML = `${ico('arrow-right', 16)} ${same ? 'Mută grupa' : c.ok ? 'Mută grupa' : 'Mută oricum'}`;
    };
    paint(opts.propose ? proposalNote(g, proposed) : '');

    hrs.addEventListener('click', e => {
      const b = e.target.closest('.rp-hr');
      if (!b || b.disabled) return;
      sel.start = +b.dataset.h; paint();
      const nb = hrs.querySelector(`[data-h="${sel.start}"]`); if (nb) nb.focus();
    });
    hrs.addEventListener('keydown', e => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      let h = sel.start + dir;
      while (h >= FIRST && h < END && h + g.duration > END) h += dir;
      if (h < FIRST || h + g.duration > END) return;
      sel.start = h; paint();
      hrs.querySelector(`[data-h="${h}"]`).focus();
    });
    if (roomSel) roomSel.addEventListener('change', () => { sel.room = roomSel.value; paint(); });
    dr.querySelector('[data-propose]').addEventListener('click', () => {
      const pr = propose(g);
      if (!pr) { paint(proposalNote(g, null)); return; }
      sel.room = pr.room; sel.start = pr.start;
      if (roomSel) roomSel.value = sel.room;
      paint(proposalNote(g, pr));
    });
    save.addEventListener('click', async () => {
      const c = check(g, sel.room, sel.start);
      if (!c.ok) {
        const yes = await confirmDialog(`Mutarea la ${sel.room ? roomName(sel.room) + ', ' : ''}${hh(sel.start)} are probleme`, reasons(g, c), c);
        if (!yes) return;
      }
      dr.close();
      apply(g, g.room ? { start: sel.start, room: sel.room } : { start: sel.start });
    });
    U.$$('[data-st]', dr).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.st === g.status || D.blocked()) return;
      D.setStatus(g.id, b.dataset.st);
      U.$$('[data-st]', dr).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      U.toast(esc(`Statut schimbat: ${statusName(b.dataset.st)}.`));
      paint();
    }));
  }

  /* ============ export, print ============ */
  const onView = () => !!(M && M.root.isConnected && /^#repartizare(\?|$)/.test(location.hash || ''));
  window.addEventListener('beforeprint', () => { if (onView()) document.body.classList.add('rp-print'); });
  window.addEventListener('afterprint', () => document.body.classList.remove('rp-print'));

  /* ============ live updates ============ */
  D.onChange(() => {
    if (D.edited() === 0) undoStack.length = 0; // demo data was reset
    if (onView() && !document.querySelector('.rp-ghost')) renderMain();
  });
  setInterval(() => {
    if (!onView()) return;
    const now = nowFrac(M.s.day);
    const line = M.root.querySelector('.rp-now'), lbl = M.root.querySelector('.rp-now__lbl');
    if (!now) return;
    if (line) line.style.setProperty('--f', now.f);
    if (lbl) { lbl.style.setProperty('--f', now.f); lbl.textContent = now.label; }
  }, 30000);

  document.addEventListener('keydown', e => {
    if (!onView() || e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName) || document.querySelector('.ax-drawer, dialog[open]')) return;
    e.preventDefault();
    undo();
  });

  function totalConflicts() {
    let n = 0;
    for (let d = 1; d <= 7; d++) n += D.conflicts(d).length;
    return n;
  }

  window.AdminViews.repartizare = {
    title: 'Repartizare',
    icon: 'door',
    badge: () => totalConflicts() || null,
    render(root, ctx) {
      clearStrayDrag();
      M = { root, ctx, s: readState(ctx.query) };
      if (!ctx.query.day) writeState(M.s);
      root.innerHTML = headHTML();
      buildRail();
      renderMain(true);
    }
  };
})();
