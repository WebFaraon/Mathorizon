/* ============================================================
   Mathorizon: the teacher's register, demo data
   ============================================================
   The teacher register (registru.html) is the spreadsheet every teacher
   keeps today: per group, one column per student, one row per lesson,
   with presence, balance, payments and the money the teacher earns.
   This file generates that ledger from the same demo data the admin
   console uses (js/admin/mock-data.js), so both sides show one world:

     - a student's balance in Elevi / Analitică is the balance of the
       register (paid + discounts - cost of the lessons attended);
     - the last three presence marks in the console are the last three
       lessons of the register;
     - availability and what a teacher teaches are edited in the register
       and read by the console (AdminData.setAvailability / setTeach).

   Added to window.AdminData (also setMark, setLesson, addLesson, removeLesson, setRate, setColumn, nextDate):
     ledger(groupId)   -> { lessons, rows, stats, rate, ... } for one group
     teacherBook(tid)  -> { groups, totals, earned, payments, due, ... }
     tLevel(tid), rateOf(group), rateBySize(size), lessonPay(size, paying, level), tabName(group), schedule(group)
     MONTHS

   History is generated once from the original schedule of each group
   (AdminData.base), so moving a group in Repartizare does not rewrite
   lessons that already happened. Same data on every load.
   ============================================================ */
(function () {
  'use strict';
  const D = window.AdminData;
  if (!D) return;

  const DAY_MS = 864e5;
  const WINDOW_DAYS = 150;     // how far back the register goes
  const MAX_LESSONS = 44;      // rows kept per group
  const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const parse = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const wd = d => ((d.getDay() + 6) % 7) + 1;
  const weighted = (r, pairs) => {
    const total = pairs.reduce((t, p) => t + p[1], 0);
    let x = r() * total;
    for (const [v, w] of pairs) { if ((x -= w) < 0) return v; }
    return pairs[pairs.length - 1][0];
  };

  /* ---- vocabulary ---- */
  const TOPICS = {
    low: ['Numerele până la 100', 'Adunarea și scăderea', 'Înmulțirea', 'Împărțirea', 'Fracții simple', 'Figuri geometrice', 'Probleme cu text', 'Unități de măsură', 'Recapitulare'],
    mid: ['Operații cu numere raționale', 'Puteri', 'Radicali', 'Calcul algebric', 'Ecuații de gradul I', 'Rapoarte și proporții', 'Procente', 'Funcții', 'Teorema lui Pitagora', 'Aria și perimetrul', 'Recapitulare'],
    high: ['Puteri', 'Radicali', 'Operații cu numere raționale', 'Rezolvarea ecuațiilor', 'Calcul algebric', 'Recapitulare', 'Funcția de gradul 1', 'Semnul funcției de gradul 1', 'Funcția de gradul 2', 'Monotonia funcției de gradul 2', 'Ecuații de gradul 2', 'Inegalități', 'Progresii', 'Logaritmi', 'Trigonometrie', 'Limite', 'Derivate', 'Integrale', 'Probabilități'],
    'L.română': ['Textul narativ', 'Figuri de stil', 'Comentariul literar', 'Eseul argumentativ', 'Ortografie', 'Substantivul', 'Verbul', 'Textul liric', 'Recapitulare'],
    Fizica: ['Mărimi fizice', 'Cinematică', 'Dinamică', 'Legile lui Newton', 'Lucrul mecanic', 'Termodinamică', 'Electricitate', 'Recapitulare'],
    Istoria: ['Antichitatea', 'Evul Mediu', 'Țările Române', 'Epoca modernă', 'Primul Război Mondial', 'Perioada interbelică', 'Recapitulare'],
    Chimie: ['Structura atomului', 'Legături chimice', 'Reacții chimice', 'Acizi și baze', 'Soluții', 'Chimie organică', 'Recapitulare'],
    Biologie: ['Celula', 'Țesuturi', 'Genetică', 'Sistemul nervos', 'Sistemul circulator', 'Ecologie', 'Recapitulare'],
    Engleza: ['Present simple', 'Past simple', 'Conditionals', 'Reported speech', 'Vocabulary', 'Writing', 'Recapitulare'],
    Geografie: ['Relieful', 'Clima', 'Hidrografia', 'Populația', 'Economia', 'Europa', 'Recapitulare']
  };
  function topicsFor(g) {
    if (g.subject !== 'Matematica') return TOPICS[g.subject] || TOPICS.mid;
    const gi = D.GRADES.indexOf(g.grade);
    return gi <= 3 ? TOPICS.low : gi <= 7 ? TOPICS.mid : TOPICS.high;
  }

  const LEVEL_PCT = { 1: 0.20, 2: 0.22, 3: 0.24, 4: 0.26, 5: 0.28 };
  const tLevel = tid => (D.registry ? D.registry.tLevel(tid) : 2 + ((parseInt(tid.slice(1), 10) * 5) % 4));        // 2..5 (demo); from the lessons' own level column when the registers are the source
  /* What a student pays per hour, by the format of the group, as in the teachers' registers (cell A1, "Grup cu 6 elevi"):
     the price list of the sheet's formulas. 7 is not a format. Kept equal to scripts/registru-import/pay.js (check-demo-data compares them). */
  const STUDENT_RATE = { 1: 608, 2: 348, 3: 288, 4: 248, 5: 228, 6: 218, 7: 0, 8: 148 };
  const rateBySize = n => STUDENT_RATE[+n] || STUDENT_RATE[1];
  const rateOf = g => rateBySize(g.size);

  /* What the teacher earns for one lesson: the registers' column C formula. It depends on the group's format, on how many students are
     charged for the lesson (marked P or A; G, M, B and an empty cell are not) and on the teacher's level (1..6). Nobody charged = 0.
     Full group and the cap by level; fewer students get a share of it (a floor of 3 of 4 and 4 of 5 for groups of 4 and 5). */
  const PAY_MAX_8 = { 1: 180, 2: 235, 3: 255, 4: 270, 5: 280, 6: 325 }, PAY_MAX = { 1: 165, 2: 215, 3: 235, 4: 255, 5: 265, 6: 305 };
  const GUARANTEED = { 4: 3, 5: 4 };
  function lessonPay(size, paying, level) {
    if (!(size >= 1) || !paying) return 0;
    const max = (size === 8 ? PAY_MAX_8 : PAY_MAX)[level] || 0;
    const counted = Math.max(paying, GUARANTEED[size] || 0);
    let f;
    if (size === 3) f = { 1: 0.6863, 2: 0.8549, 3: 1 }[paying];
    else if (size === 6) f = { 1: 0.6863, 2: 0.6863, 3: 0.6863, 4: 0.6863, 5: 0.8549, 6: 1 }[paying];
    else if (size === 8) f = paying < 3 ? 0.6296 : paying < 6 ? 0.7519 : paying / size;
    else f = counted / size;
    if (f === undefined) f = paying / size;
    return f * max;
  }

  /* "Luni/Miercuri 12:00", "Joi 10:00-12:00 (Vară)": the name of the group's tab in the register */
  function tabName(g) {
    const days = g.days.map(d => D.DAYS[d - 1].name).join('/');
    const hh = h => String(h).padStart(2, '0') + ':00';
    const time = `${hh(g.start)}-${hh(g.start + g.duration)}`;      // always start and end, one hour or two
    return `${days} ${time}${g.regime === 'vara' ? ' (Vară)' : ''}`;
  }
  function schedule(g) {
    const room = g.room ? D.room(g.room) : null;
    return g.days.map(d => ({ day: D.DAYS[d - 1].name, hour: g.start, room: room ? room.num : null }));
  }

  /* ---- the ledger of one group ----
     Two steps: generate(g) makes the history once (lessons, who was there, what each student
     paid); derive() computes every figure from it plus the teacher's own edits (a changed date
     or topic, a changed mark, a lesson added, a changed price per hour), so an edit in the register
     moves sold, cost, percentages and the balances the console shows. */
  const gens = new Map();
  const cache = new Map();
  const STUDENT_COUNTS_AS_ACTIVE = ['activ', 'instabil', 'inlocuire'];
  // marks: P present, G present first lesson free, M absent excused, A absent unexcused, B absent first (trial) lesson
  const PAID_MARK = { P: true, A: true };


  /* The registers as the source (js/admin/registry-dataset.js): the lessons, the marks and the money are what the sheets hold. */
  function fromRegistry(g) {
    const R = D.registry.ledger(g.id);
    const rate = rateBySize(g.size);
    const lessons = R.lessons.map(l => ({ date: l.iso ? parse(l.iso) : null, topic: l.topic || '', price: rate }));
    const MARKS = { P: 1, A: 1, G: 1, M: 1, B: 1 };
    const rows = R.cols.map(c => ({ s: c.s, codes: R.lessons.map((l, i) => (MARKS[c.marks[i]] ? c.marks[i] : '')), paid: c.paid, disc: c.disc }));
    const pos = {};
    R.cols.forEach(c => { const n = String(c.col).split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 4; if (n >= 0 && pos[c.s.id] == null) pos[c.s.id] = n; });
    return { rate, dur: 1, lessons, rows, pay: R.pay, pos };
  }

  function generate(g) {
    if (D.registry) return fromRegistry(g);
    const b = D.base(g.id) || g;
    const r = rng(hash('g' + g.id));
    const rate = rateBySize(b.size);
    const topics = topicsFor({ subject: b.subject, grade: b.grade });

    const from = new Date(D.today); from.setDate(from.getDate() - WINDOW_DAYS);
    const start = parse(g.startDate);
    const first = start > from ? start : from;
    let last = new Date(D.today);
    if (b.status === 'inactiv') { last = new Date(D.today); last.setDate(last.getDate() - (20 + Math.floor(r() * 100))); }
    const dates = [];
    for (let d = new Date(first); d < last; d.setDate(d.getDate() + 1)) if (b.days.includes(wd(d))) dates.push(new Date(d));
    // a group nobody has joined yet has no history
    const meets = D.baseMembers(g.id).length ? dates.filter((_, i) => i === 0 || r() > 0.06) : [];
    // every lesson in the register is one hour (a student may come to only one of the two, each with its own mark
    // and its own payment): a meeting of two hours is two lessons on the same date
    const held = [].concat(...meets.map(d => Array(b.duration).fill(d))).slice(-MAX_LESSONS);

    let k = 0;
    const lessons = held.map((d, i) => {
      void (i > 0 && r() < 0.12);                 // (the old random reduced price; the draw stays so the other numbers do not move)
      const price = rate;
      const topic = topics[k % topics.length]; k += r() < 0.85 ? 1 : 0;
      return { date: d, topic, price };
    });
    const n = lessons.length;

    const rows = D.baseMembers(g.id).map(s => {
      const rs = rng(hash('s' + s.id));
      const st0 = D.baseStatus ? D.baseStatus(s.id) : s.status;
      if (s._debt == null) s._debt = s.balance < 0;
      const debt = s._debt && (st0 !== 'activ' || rs() < 0.5);
      const joined = parse(s.joinedAt);
      let joinIdx = n ? lessons.findIndex(l => l.date >= joined) : 0;
      if (joinIdx < 0) joinIdx = n;
      const isTrial = st0 === 'proba' || st0 === 'proba_ok';
      if (isTrial && n) joinIdx = Math.max(0, n - (st0 === 'proba' ? 1 : 2));
      const isNew = !!n && (isTrial || joined >= lessons[0].date);
      let endIdx = n;
      if (st0 === 'inactiv' || st0 === 'transferat') endIdx = Math.min(n, joinIdx + 2 + Math.floor(rs() * Math.max(1, n - joinIdx)));
      const odds = st0 === 'activ' ? [['P', 82], ['A', 6], ['M', 12]]
        : st0 === 'instabil' ? [['P', 58], ['A', 27], ['M', 15]]
        : [['P', 60], ['A', 22], ['M', 18]];
      const codes = Array(n).fill('');
      for (let i = joinIdx; i < endIdx; i++) {
        const p = i > joinIdx ? lessons[i - 1] : null;
        if (i === joinIdx && isNew) codes[i] = rs() < 0.12 ? 'B' : 'G';
        else if (p && p.date.getTime() === lessons[i].date.getTime() && codes[i - 1] && codes[i - 1] !== 'G' && codes[i - 1] !== 'B' && rs() < 0.9) codes[i] = codes[i - 1];   // the second hour of a meeting: mostly the same as the first
        else codes[i] = weighted(rs, odds);
      }
      let cost = 0, done = 0;
      codes.forEach((c, i) => { if (PAID_MARK[c]) { cost += lessons[i].price; done++; } });
      const disc = done >= 4 && rs() < 0.35 ? Math.round(cost * (0.03 + rs() * 0.09)) : 0;
      let paid;
      if (debt && cost > 0) {
        paid = Math.max(0, Math.round(cost * (0.35 + rs() * 0.55) / 10) * 10 - disc);
        if (paid + disc >= cost) paid = Math.max(0, cost - disc - 10 - Math.round(rs() * 30) * 10);
      } else {
        const adv = rs() < 0.5 ? 0 : Math.round(rs() * 90) * 10;
        paid = Math.max(0, cost - disc + adv);
      }
      return { s, codes, paid, disc };
    });
    return { rate, dur: 1, lessons, rows };
  }

  const mkLesson = (i, date, topic, price) => (date ? {
    i, oid: i, date, iso: D.iso(date), day: wd(date),
    month: date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'),
    monthName: cap(MONTHS[date.getMonth()]),
    label: date.getDate() + ' ' + MONTHS[date.getMonth()],
    topic, price
  } : { i, oid: i, date: null, iso: '', day: 0, month: '', monthName: '', label: 'Alege data', topic, price });

  function derive(g, G, ov) {
    ov = ov || {};
    // what a student pays per hour follows the group's format (individual, 3, 6 ...) unless it was set by hand
    const rate = ov.rate || rateBySize(g.size), k = rate / G.rate;
    const all = G.lessons.map((l, i) => {
      const o = (ov.l || {})[i] || {};
      return mkLesson(i, o.d ? parse(o.d) : l.date, o.t != null ? o.t : l.topic, Math.round(l.price * k));
    });
    (ov.x || []).forEach((e, j) => all.push(mkLesson(G.lessons.length + j, e.d ? parse(e.d) : null, e.t != null ? e.t : '', Math.round(rate))));
    // a deleted lesson (a generated one or an added one) is only skipped: marks and edits keep their keys
    const rm = new Set(ov.rm || []);
    const lessons = all.filter(l => !rm.has(l.oid));
    lessons.forEach((l, pos) => { l.i = pos; });
    // A lesson counts (students' cost, teacher's pay, hours, figures) only once it has a date AND a title:
    // until then it shows no sum, so the teacher always fills both in.
    lessons.forEach(l => { l.counted = !!(l.date && String(l.topic || '').trim()); if (!l.counted) l.price = 0; });
    const n = lessons.length;
    const nCounted = lessons.filter(l => l.counted).length;

    // A student who came by a transfer has a column too, starting empty and with no money; the one who left keeps
    // his column (marks, money) but no lesson from the day of the transfer on can be marked for him, and the new
    // group's lessons before that day cannot be marked for the one who came.
    const known = new Set(G.rows.map(r => r.s.id));
    const extra = D.studentsOf(g.id).filter(s => !known.has(s.id)).map(s => {
      const T0 = D.stint(s, g.id);
      // a story student (js/admin/mock-data.js, buildSeeds) was really here for a while: his lessons have marks
      return { s, codes: T0.inEntry && T0.inEntry.seed ? seedCodes(s.id, g.id, G, T0.join, T0.leave || '9999-12-31') : [], paid: 0, disc: 0 };
    });
    const rows = G.rows.concat(extra).map(r => {
      const T = D.stint(r.s, g.id);
      // The money of a transfer (the Calculator's formulas, see transferFin): what the student brought from the old group
      // is his start here; in the group he left only what the lessons he had cost stays.
      let paidX = r.paid, discX = r.disc;
      if (T.finIn) { paidX = T.finIn.achRem; discX = T.finIn.redRem; }
      if (T.finOut) { paidX = T.finOut.achC; discX = T.finOut.redC; }
      const lock = lessons.map(l => !!((T.join && l.iso && l.iso < T.join) || (T.leave && (!l.iso || l.iso >= T.leave))));
      const mine = (ov.m || {})[r.s.id] || {};
      const codes = lessons.map((l, i) => (lock[i] ? '' : mine[l.oid] != null ? mine[l.oid] : (r.codes[l.oid] || '')));
      let cost = 0, done = 0;
      codes.forEach((c, i) => { if (PAID_MARK[c] && lessons[i].counted) { cost += lessons[i].price; done++; } });
      cost = round2(cost);
      const sold = round2(paidX + discX - cost);
      let flag = -1;
      if (sold < 0) { let run = 0; for (let i = 0; i < n; i++) { if (PAID_MARK[codes[i]]) run += lessons[i].price; if (run > paidX + discX) { flag = i; break; } } }
      return { s: r.s, status: D.statusIn(r.s, g.id), join: T.join, leave: T.leave, from: T.from ? D.group(T.from) : null, to: T.to ? D.group(T.to) : null, lock, fin: T.finOut || T.finIn || null, codes, cost, done, disc: discX, paid: paidX, sold, avail: rate ? Math.round(sold / rate * 10) / 10 : 0, flag, manager: D.manager(r.s.manager) };
    });

    // The column of each student: his slot. By default the students fill the columns from the left; a manager can
    // move one to another (free) column, e.g. a student who left goes to the far right to make room (ov.pos).
    {
      const want = ov.pos || {}, taken = new Set();
      rows.forEach(x => { const p = want[x.s.id]; if (Number.isInteger(p) && p >= 0 && !taken.has(p)) { x.slot = p; taken.add(p); } });
      let nx = 0;
      rows.forEach(x => { if (x.slot == null) { while (taken.has(nx)) nx++; x.slot = nx; taken.add(nx); } });
      rows.sort((a, b) => a.slot - b.slot);
    }

    const st = { P: 0, A: 0, M: 0, G: 0, B: 0, paid: 0, cost: 0, disc: 0, debt: 0, adv: 0, sold: 0, active: 0, trial: 0, moved: 0, inactive: 0 };
    rows.forEach(x => {
      x.codes.forEach((c, i) => { if (c && lessons[i].counted) st[c]++; });
      st.paid += x.paid; st.cost += x.cost; st.disc += x.disc; st.sold += x.sold;
      if (x.sold < 0) st.debt += x.sold; else st.adv += x.sold;
      const t = x.status;
      if (STUDENT_COUNTS_AS_ACTIVE.includes(t)) st.active++;
      else if (t === 'proba' || t === 'proba_ok') st.trial++;
      else if (t === 'transferat') st.moved++;
      else st.inactive++;
    });
    ['paid', 'cost', 'disc', 'debt', 'adv', 'sold'].forEach(k => { st[k] = round2(st[k]); });
    const marks = st.P + st.A + st.M;
    st.hours = nCounted;
    st.avg = nCounted ? (st.P + st.G) / nCounted : 0;
    st.success = marks ? Math.round(st.P / marks * 100) : 0;
    st.absent = st.A + st.M + st.B;

    // per lesson: who was there, and what the teacher earns for it (by how many came, with a floor)
    lessons.forEach((l, i) => {
      let there = 0, expected = 0, paying = 0;
      rows.forEach(x => { const c = x.codes[i]; if (c) { expected++; if (c === 'P' || c === 'G') there++; if (PAID_MARK[c]) paying++; } });   // the teacher is paid by the students whose lesson is charged: P and A
      l.paying = paying;
      l.there = there; l.expected = expected;
      l.pct = expected ? Math.round(there / expected * 100) : null;
      l.pay = l.counted ? lessonPay(g.size, paying, tLevel(g.teacher)) : 0;
      if (l.counted && G.pay && G.pay[l.oid] != null) l.pay = G.pay[l.oid];          // registers: what the sheet calculated
    });

    const months = [];
    const byKey = {};
    lessons.forEach((l, i) => {
      if (!l.month || !l.counted) return;         // a lesson without a date or a title counts in no month yet
      let m = byKey[l.month];
      if (!m) { m = byKey[l.month] = { key: l.month, name: l.monthName, P: 0, A: 0, M: 0, G: 0, B: 0, value: 0, hours: 0, mgr: {} }; months.push(m); }
      m.hours += 1;
      rows.forEach(x => {
        const c = x.codes[i];
        if (!c) return;
        m[c]++;
        if (PAID_MARK[c]) { m.value += l.price; const id = x.s.manager; m.mgr[id] = (m.mgr[id] || 0) + l.price; }
      });
    });
    months.sort((a, b) => a.key.localeCompare(b.key));
    months.forEach(m => { const t = m.P + m.A + m.M; m.pct = t ? Math.round(m.P / t * 100) : 0; });

    const earned = Math.round(lessons.reduce((t, l) => t + l.pay, 0) * 100) / 100;
    return { g, rate, baseRate: G.rate, dur: G.dur, nGen: G.lessons.length, nCounted, lessons, rows, stats: st, months, sum: lessons.reduce((t, l) => t + l.price, 0), earned, level: tLevel(g.teacher) };
  }

  function ledger(gid) {
    let L = cache.get(gid);
    if (!L) {
      const g = D.group(gid);
      let G = gens.get(gid);
      if (!G) { G = generate(g); gens.set(gid, G); }
      L = derive(g, G, D.registry ? { pos: G.pos } : D.ledgerEdits()[gid]);
      cache.set(gid, L);
    }
    return L;
  }

  /* ---- editing: everything is kept in the demo store, under "ledger" ---- */
  function edit(gid, fn) {
    const all = JSON.parse(JSON.stringify(D.ledgerEdits()));
    const ov = all[gid] = all[gid] || {};
    fn(ov);
    D.setLedgerEdits(all);               // saves, notifies, other tabs follow through 'storage'
  }
  function setMark(gid, sid, i, code) { edit(gid, ov => { ov.m = ov.m || {}; (ov.m[sid] = ov.m[sid] || {})[i] = code; }); }
  function setLesson(gid, i, patch) {
    const n = ledger(gid).nGen;
    edit(gid, ov => {
      if (i >= n) { ov.x = ov.x || []; Object.assign(ov.x[i - n], patch); return; }
      ov.l = ov.l || {}; ov.l[i] = Object.assign(ov.l[i] || {}, patch);
    });
  }
  /* the date the group meets next after its last lesson */
  function nextDate(gid) {
    const L = ledger(gid), g = L.g;
    const dated = L.lessons.filter(l => l.date);
    const lastD = dated.length ? new Date(Math.max.apply(null, dated.map(l => l.date.getTime()))) : new Date(D.today.getFullYear(), D.today.getMonth(), D.today.getDate() - 1);
    const d = new Date(lastD);
    for (let i = 0; i < 14; i++) { d.setDate(d.getDate() + 1); if (g.days.includes(wd(d))) return D.iso(d); }
    return D.iso(d);
  }
  function addLesson(gid, iso) { edit(gid, ov => { ov.x = ov.x || []; ov.x.push({ d: iso || '', t: '' }); }); }
  function removeLesson(gid, oid) { edit(gid, ov => { ov.rm = ov.rm || []; if (!ov.rm.includes(oid)) ov.rm.push(oid); }); }
  /* a student's column: slot = the column number (0 is the first), null = back to the natural place */
  function setColumn(gid, sid, slot) { edit(gid, ov => { ov.pos = ov.pos || {}; if (slot == null) delete ov.pos[sid]; else ov.pos[sid] = slot; if (!Object.keys(ov.pos).length) delete ov.pos; }); }
  function setRate(gid, rate) { edit(gid, ov => { if (rate > 0) ov.rate = rate; else delete ov.rate; }); }

  /* ---- everything one teacher sees on the first page of the register ---- */
  function teacherBook(tid) {
    const t = D.teacher(tid);
    const gs = D.groups.filter(g => g.teacher === tid).sort((a, b) => Math.min(...a.days) - Math.min(...b.days) || a.start - b.start || a.id.localeCompare(b.id));
    const groups = gs.map(g => ledger(g.id));
    const T = { P: 0, A: 0, M: 0, G: 0, B: 0, paid: 0, cost: 0, disc: 0, debt: 0, adv: 0, sold: 0, active: 0, trial: 0, moved: 0, inactive: 0, hours: 0 };
    groups.forEach(L => Object.keys(T).forEach(k => { T[k] += L.stats[k] || 0; }));
    const marks = T.P + T.A + T.M;
    ['paid', 'cost', 'disc', 'debt', 'adv', 'sold'].forEach(k => { T[k] = round2(T[k]); });
    T.success = marks ? Math.round(T.P / marks * 100) : 0;
    T.lessons = groups.reduce((n, L) => n + L.lessons.length, 0);
    T.avg = T.lessons ? (T.P + T.G) / T.lessons : 0;
    T.absent = T.A + T.M + T.B;
    const earned = Math.round(groups.reduce((n, L) => n + L.earned, 0) * 100) / 100;

    // the months across all groups
    const months = [];
    const byKey = {};
    groups.forEach(L => L.months.forEach(m => {
      let x = byKey[m.key];
      if (!x) { x = byKey[m.key] = { key: m.key, name: m.name, P: 0, A: 0, M: 0, G: 0, B: 0, value: 0, hours: 0, mgr: {} }; months.push(x); }
      ['P', 'A', 'M', 'G', 'B', 'value', 'hours'].forEach(f => { x[f] += m[f]; });
      Object.keys(m.mgr).forEach(id => { x.mgr[id] = (x.mgr[id] || 0) + m.mgr[id]; });
    }));
    months.sort((a, b) => a.key.localeCompare(b.key));
    months.forEach(m => { const q = m.P + m.A + m.M; m.pct = q ? Math.round(m.P / q * 100) : 0; });

    // what the school already paid the teacher
    if (D.registry) {
      const pays = D.registry.payments(tid), paid = Math.round(pays.reduce((n, p) => n + p.amount, 0) * 100) / 100;
      return { teacher: t, level: tLevel(tid), groups, totals: T, months, earned, payments: pays, paid, due: Math.round((earned - paid) * 100) / 100 };
    }
    const r = rng(hash('pay' + tid));
    const owedLeft = r() < 0.7 ? Math.round(r() * 9000) / 100 : 300 + Math.round(r() * 2200);
    let target = Math.max(0, Math.floor(earned - owedLeft));
    const payments = [];
    const day = new Date(D.today); day.setDate(day.getDate() - (2 + Math.floor(r() * 10)));
    while (target > 0 && payments.length < 40) {
      let amount = Math.min(target, 700 + Math.round(r() * 26) * 100);
      if (target - amount < 500) amount = target;
      payments.push({ iso: D.iso(day), label: day.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' }), amount: Math.round(amount) });
      target -= Math.round(amount);
      day.setDate(day.getDate() - (10 + Math.floor(r() * 22)));
    }
    payments.reverse();
    const paid = payments.reduce((n, p) => n + p.amount, 0);

    return { teacher: t, level: tLevel(tid), groups, totals: T, months, earned, payments, paid, due: Math.round((earned - paid) * 100) / 100 };
  }

  /* ---- the money of a transfer: the Calculator's "Transfer" formulas, done by the register ----
     A = what the student paid in the group he leaves, R = the discounts, C = the cost of the lessons he had.
       share of payments = A / (A + R), of discounts = R / (A + R)
       stays in the old group (consumed) = C x each share   -> the old column ends with balance 0
       goes to the new group = what was entered - what was consumed (payments and discounts apart)
     Everything is rounded to cents so that consumed + moved = A + R exactly. If the lessons cost more than A + R, the
     student owes the difference: it stays in the old group (nothing negative is sent to the new one). */
  const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
  function splitMoney(a, r, c) {
    const A = round2(a), R = round2(r), C = round2(c), total = round2(A + R);
    const used = Math.min(C, total);
    let achC = 0, redC = 0;
    if (total > 0 && used > 0) {
      achC = round2(used * (A / total));
      redC = Math.min(R, round2(used - achC));
      achC = round2(used - redC);
    }
    return { A, R, C, achC, redC, achRem: round2(A - achC), redRem: round2(R - redC), debt: round2(Math.max(0, C - total)) };
  }
  function transferFin(gid, sid) {
    const x = ledger(gid).rows.find(r => r.s.id === sid);
    return x ? splitMoney(x.paid, x.disc, x.cost) : null;
  }
  /* The story students' transfers have no stored split: it is worked out from the generated register of the group he
     left, the same way, as of the day of the transfer (a second transfer starts from what the first one brought). */
  const seedFinCache = new Map();
  const genOf = gid => { let G = gens.get(gid); if (!G) { G = generate(D.group(gid)); gens.set(gid, G); } return G; };
  function seedCodes(sid, gid, G, fromIso, toIso) {
    const rs = rng(hash('sc' + sid + gid)), out = [];
    G.lessons.forEach((l, i) => { const d = D.iso(l.date); if (d >= fromIso && d < toIso) out[i] = weighted(rs, [['P', 84], ['M', 10], ['A', 6]]); });
    return out;
  }
  function finOfEntry(t) { return t ? (t.fin || (t.seed ? seedFin(t) : null)) : null; }
  function seedFin(t) {
    if (seedFinCache.has(t.id)) return seedFinCache.get(t.id);
    const G = genOf(t.from), base = G.rows.find(r => r.s.id === t.s);
    const prev = D.transfersOf(t.s).filter(x => x.to === t.from && x.at < t.at).pop();
    let A, R, codes;
    if (prev) { const f = finOfEntry(prev); A = f.achRem; R = f.redRem; codes = seedCodes(t.s, t.from, G, prev.iso, t.iso); }
    else { A = base.paid; R = base.disc; codes = base.codes; }
    let C = 0;
    G.lessons.forEach((l, i) => { if (D.iso(l.date) < t.iso && PAID_MARK[codes[i]]) C += l.price; });
    const f = splitMoney(A, R, C);
    seedFinCache.set(t.id, f);
    return f;
  }
  const baseStint = D.stint;
  D.stint = (s, gid) => {
    const T = baseStint(s, gid);
    if (T.inEntry && T.inEntry.seed && !T.finIn) T.finIn = seedFin(T.inEntry);
    if (T.outEntry && T.outEntry.seed && !T.finOut) T.finOut = seedFin(T.outEntry);
    return T;
  };
  /* the plan to show before confirming: one entry per student of the group */
  function transferPlan(gid, sids) { return sids.map(id => { const f = transferFin(gid, id); return f ? Object.assign({ sid: id }, f) : null; }).filter(Boolean); }
  const baseTransfer = D.transfer;
  D.transfer = (sids, toGid) => {
    const fins = {};
    sids.forEach(id => { const s = D.students.find(x => x.id === id); if (s && s.group) { const f = transferFin(s.group, id); if (f) fins[id] = f; } });
    return baseTransfer(sids, toGid, fins);
  };

  /* ---- the journey of a student: every group he was in, with dates, lessons and money, and what happened between ----
     Chapters (one per group, in the order he joined them) with the events inside each; the links between chapters are the
     transfers. Dates come from the register (first and last marked lesson), the transfers and the status log. */
  function journey(sid) {
    const s = D.students.find(x => x.id === sid);
    if (!s) return null;
    const moves = D.transfersOf(sid), log = D.statusLog(sid);
    const chapters = [];
    D.groups.forEach(g => {
      if (!D.studentsOf(g.id).includes(s)) return;
      const L = ledger(g.id), x = L.rows.find(r => r.s.id === sid);
      if (!x) return;
      const T = D.stint(s, g.id);
      const into = moves.filter(t => t.to === g.id).pop(), out = moves.filter(t => t.from === g.id).pop();
      const coded = x.codes.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
      const first = coded.length ? { iso: L.lessons[coded[0]].iso, code: x.codes[coded[0]] } : null;
      const last = coded.length ? L.lessons[coded[coded.length - 1]].iso : null;
      chapters.push({ g, x, status: x.status, join: T.join || s.joinedAt, joinAt: into ? into.at : -Infinity, leave: T.leave, leaveAt: T.leave && out ? out.at : Infinity,
        from: T.from ? D.group(T.from) : null, to: T.to ? D.group(T.to) : null, first, last, held: x.done, spent: x.cost, paid: x.paid, disc: x.disc, sold: x.sold, fin: T.finOut || null, finIn: T.finIn || null });
    });
    chapters.sort((a, b) => a.joinAt - b.joinAt || a.join.localeCompare(b.join));
    chapters.forEach((c, k) => { c.events = []; c.k = k; });
    chapters.forEach((c, k) => {
      c.events.push(k === 0 ? { iso: c.join, kind: 'enrol', title: 'Înscris' } : { iso: c.join, kind: 'arrive', title: 'Venit prin transfer', from: c.from });
      if (c.first) c.events.push({ iso: c.first.iso, kind: 'first', title: 'Prima lecție', code: c.first.code });
    });
    // status changes: they belong to the chapter that was open when they happened
    log.forEach(h => {
      const c = chapters.find(x => h.at >= x.joinAt && h.at < x.leaveAt) || chapters[chapters.length - 1];
      if (c) c.events.push({ iso: h.iso, kind: 'status', title: 'Statut schimbat', from: h.from, to: h.to });
    });
    // an end that the log does not have (the generated students): the last lesson tells when
    chapters.forEach(c => {
      const ended = c.status === 'inactiv' || (c.status === 'transferat' && !c.to);
      const logged = c.events.some(e => e.kind === 'status' && (e.to === 'inactiv' || e.to === 'transferat'));
      if (ended && !logged) c.events.push({ iso: c.last || c.join, kind: c.status === 'inactiv' ? 'inactive' : 'moved', title: c.status === 'inactiv' ? 'Devine inactiv' : 'Transferat', last: c.last, unknown: c.status === 'transferat' });
      else if ((c.leave || ended) && c.last) c.events.push({ iso: c.last, kind: 'last', title: 'Ultima lecție' });
    });
    const order = { enrol: 0, arrive: 0, first: 1, status: 2, last: 3, inactive: 4, moved: 4 };
    chapters.forEach(c => c.events.sort((a, b) => a.iso.localeCompare(b.iso) || order[a.kind] - order[b.kind]));
    const sum = k => Math.round(chapters.reduce((t, c) => t + c[k], 0) * 100) / 100;
    return { student: s, chapters, links: moves, totals: { spent: sum('spent'), paid: sum('paid'), disc: sum('disc'), held: sum('held'), balance: s.balance }, since: chapters.length ? chapters[0].join : s.joinedAt };
  }

  /* ---- the ledger is the source of the balances the console shows ---- */
  const mapMark = c => (c === 'A' || c === 'B' ? 'a' : c === 'M' ? 'm' : 'p');
  function applyToStudents() {
    const bal = new Map(), marks = new Map();
    D.groups.forEach(g => ledger(g.id).rows.forEach(x => {
      const s = x.s;
      if (!s._p0) s._p0 = s.presence.slice();
      bal.set(s, (bal.get(s) || 0) + x.sold);
      const list = marks.get(s) || [];
      // the columns of the groups he left come first, the one he is in now last
      if (s.group === g.id) list.push(x.codes); else list.unshift(x.codes);
      marks.set(s, list);
    }));
    bal.forEach((v, s) => {
      s.balance = v;
      const last = [].concat(...marks.get(s)).filter(Boolean).slice(-3).map(mapMark);
      s.presence = s._p0.slice(0, 3 - last.length).concat(last);
    });
  }
  applyToStudents();

  // an edit (here, in another tab, or a reset of the demo data): rebuild what depends on it
  let seen = JSON.stringify(D.ledgerEdits());
  const sig = () => D.students.map(s => s.status + s.manager + s.group).join() + '|' + D.groups.map(g => g.size).join();   // the group's format sets the price and the pay
  let statuses = sig();
  let lastSource = D.registry;
  D.onChange(() => {
    if (D.registry !== lastSource) { lastSource = D.registry; gens.clear(); cache.clear(); applyToStudents(); seen = JSON.stringify(D.ledgerEdits()); statuses = sig(); return; }       // the source changed (demo <-> registers): everything is rebuilt
    const now = JSON.stringify(D.ledgerEdits());
    const st = sig();
    if (now === seen && st === statuses) return;
    seen = now; statuses = st;
    cache.clear();
    applyToStudents();
  });

  /* what a person owes or has in advance in one group (his total, over all groups, is s.balance) */
  const soldIn = (s, gid) => { const x = ledger(gid).rows.find(r => r.s.id === s.id); return x ? x.sold : s.balance; };
  D.resetLedger = () => { gens.clear(); cache.clear(); applyToStudents(); };
  Object.assign(D, { journey, transferFin, transferPlan, soldIn, MONTHS, topicsFor, ledger, teacherBook, tLevel, rateOf, rateBySize, lessonPay, tabName, schedule, setMark, setLesson, addLesson, removeLesson, setRate, setColumn, nextDate });
})();
