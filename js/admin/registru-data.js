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

   Added to window.AdminData (also setMark, setLesson, addLesson, removeLesson, setRate, nextDate):
     ledger(groupId)   -> { lessons, rows, stats, rate, ... } for one group
     teacherBook(tid)  -> { groups, totals, earned, payments, due, ... }
     tLevel(tid), rateOf(group), tabName(group), schedule(group)
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
  const tLevel = tid => 2 + ((parseInt(tid.slice(1), 10) * 5) % 4);        // 2..5
  function rateOf(g) {
    const gi = D.GRADES.indexOf(g.grade);
    const base = gi <= 3 ? 140 : gi <= 6 ? 160 : gi <= 8 ? 190 : gi <= 10 ? 218 : 240;
    const k = g.project === 'exo' ? 1.1 : g.project === 'mat' ? 0.92 : 1;
    return Math.round(base * k / 5) * 5;
  }

  /* "Luni/Miercuri 12:00", "Joi 10:00-12:00 (Vară)": the name of the group's tab in the register */
  function tabName(g) {
    const days = g.days.map(d => D.DAYS[d - 1].name).join('/');
    const hh = h => String(h).padStart(2, '0') + ':00';
    const time = g.duration > 1 ? `${hh(g.start)}-${hh(g.start + g.duration)}` : hh(g.start);
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

  function generate(g) {
    const b = D.base(g.id) || g;
    const r = rng(hash('g' + g.id));
    const rate = rateOf({ grade: b.grade, project: g.project });
    const topics = topicsFor({ subject: b.subject, grade: b.grade });

    const from = new Date(D.today); from.setDate(from.getDate() - WINDOW_DAYS);
    const start = parse(g.startDate);
    const first = start > from ? start : from;
    let last = new Date(D.today);
    if (b.status === 'inactiv') { last = new Date(D.today); last.setDate(last.getDate() - (20 + Math.floor(r() * 100))); }
    const dates = [];
    for (let d = new Date(first); d < last; d.setDate(d.getDate() + 1)) if (b.days.includes(wd(d))) dates.push(new Date(d));
    // a group nobody has joined yet has no history
    const held = D.studentsOf(g.id).length ? dates.filter((_, i) => i === 0 || r() > 0.06).slice(-MAX_LESSONS) : [];

    let k = 0;
    const lessons = held.map((d, i) => {
      const reduced = i > 0 && r() < 0.12;
      const price = Math.round(rate * b.duration * (reduced ? 0.8 : 1));
      const topic = topics[k % topics.length]; k += r() < 0.85 ? 1 : 0;
      return { date: d, topic, price };
    });
    const n = lessons.length;

    const rows = D.studentsOf(g.id).map(s => {
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
        if (i === joinIdx && isNew) codes[i] = rs() < 0.12 ? 'B' : 'G';
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
    return { rate, dur: b.duration, lessons, rows };
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
    const rate = ov.rate || G.rate, k = rate / G.rate;
    const all = G.lessons.map((l, i) => {
      const o = (ov.l || {})[i] || {};
      return mkLesson(i, o.d ? parse(o.d) : l.date, o.t != null ? o.t : l.topic, Math.round(l.price * k));
    });
    (ov.x || []).forEach((e, j) => all.push(mkLesson(G.lessons.length + j, e.d ? parse(e.d) : null, e.t != null ? e.t : '', Math.round(rate * G.dur))));
    // a deleted lesson (a generated one or an added one) is only skipped: marks and edits keep their keys
    const rm = new Set(ov.rm || []);
    const lessons = all.filter(l => !rm.has(l.oid));
    lessons.forEach((l, pos) => { l.i = pos; });
    const n = lessons.length;

    const rows = G.rows.map(r => {
      const mine = (ov.m || {})[r.s.id] || {};
      const codes = lessons.map(l => (mine[l.oid] != null ? mine[l.oid] : (r.codes[l.oid] || '')));
      let cost = 0, done = 0;
      codes.forEach((c, i) => { if (PAID_MARK[c]) { cost += lessons[i].price; done++; } });
      const sold = r.paid + r.disc - cost;
      let flag = -1;
      if (sold < 0) { let run = 0; for (let i = 0; i < n; i++) { if (PAID_MARK[codes[i]]) run += lessons[i].price; if (run > r.paid + r.disc) { flag = i; break; } } }
      return { s: r.s, codes, cost, done, disc: r.disc, paid: r.paid, sold, avail: rate ? Math.round(sold / rate * 10) / 10 : 0, flag, manager: D.manager(r.s.manager) };
    });

    const st = { P: 0, A: 0, M: 0, G: 0, B: 0, paid: 0, cost: 0, disc: 0, debt: 0, adv: 0, sold: 0, active: 0, trial: 0, moved: 0, inactive: 0 };
    rows.forEach(x => {
      x.codes.forEach(c => { if (c) st[c]++; });
      st.paid += x.paid; st.cost += x.cost; st.disc += x.disc; st.sold += x.sold;
      if (x.sold < 0) st.debt += x.sold; else st.adv += x.sold;
      const t = x.s.status;
      if (STUDENT_COUNTS_AS_ACTIVE.includes(t)) st.active++;
      else if (t === 'proba' || t === 'proba_ok') st.trial++;
      else if (t === 'transferat') st.moved++;
      else st.inactive++;
    });
    const marks = st.P + st.A + st.M;
    st.hours = n * G.dur;
    st.avg = n ? (st.P + st.G) / n : 0;
    st.success = marks ? Math.round(st.P / marks * 100) : 0;
    st.absent = st.A + st.M + st.B;

    lessons.forEach((l, i) => {
      let there = 0, expected = 0;
      rows.forEach(x => { const c = x.codes[i]; if (c) { expected++; if (c === 'P' || c === 'G') there++; } });
      l.there = there; l.expected = expected;
      l.pct = expected ? Math.round(there / expected * 100) : null;
    });

    const months = [];
    const byKey = {};
    lessons.forEach((l, i) => {
      if (!l.month) return;                       // a lesson without a date counts in no month yet
      let m = byKey[l.month];
      if (!m) { m = byKey[l.month] = { key: l.month, name: l.monthName, P: 0, A: 0, M: 0, G: 0, B: 0, value: 0, hours: 0, mgr: {} }; months.push(m); }
      m.hours += G.dur;
      rows.forEach(x => {
        const c = x.codes[i];
        if (!c) return;
        m[c]++;
        if (PAID_MARK[c]) { m.value += l.price; const id = x.s.manager; m.mgr[id] = (m.mgr[id] || 0) + l.price; }
      });
    });
    months.sort((a, b) => a.key.localeCompare(b.key));
    months.forEach(m => { const t = m.P + m.A + m.M; m.pct = t ? Math.round(m.P / t * 100) : 0; });

    const pct = LEVEL_PCT[tLevel(g.teacher)];
    const earned = Math.round(st.cost * pct * 100) / 100;
    return { g, rate, baseRate: G.rate, dur: G.dur, nGen: G.lessons.length, lessons, rows, stats: st, months, sum: lessons.reduce((t, l) => t + l.price, 0), earned, level: tLevel(g.teacher), pct };
  }

  function ledger(gid) {
    let L = cache.get(gid);
    if (!L) {
      const g = D.group(gid);
      let G = gens.get(gid);
      if (!G) { G = generate(g); gens.set(gid, G); }
      L = derive(g, G, D.ledgerEdits()[gid]);
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
  function setRate(gid, rate) { edit(gid, ov => { if (rate > 0) ov.rate = rate; else delete ov.rate; }); }

  /* ---- everything one teacher sees on the first page of the register ---- */
  function teacherBook(tid) {
    const t = D.teacher(tid);
    const gs = D.groups.filter(g => g.teacher === tid).sort((a, b) => Math.min(...a.days) - Math.min(...b.days) || a.start - b.start || a.id.localeCompare(b.id));
    const groups = gs.map(g => ledger(g.id));
    const T = { P: 0, A: 0, M: 0, G: 0, B: 0, paid: 0, cost: 0, disc: 0, debt: 0, adv: 0, sold: 0, active: 0, trial: 0, moved: 0, inactive: 0, hours: 0 };
    groups.forEach(L => Object.keys(T).forEach(k => { T[k] += L.stats[k] || 0; }));
    const marks = T.P + T.A + T.M;
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

    return { teacher: t, level: tLevel(tid), pct: LEVEL_PCT[tLevel(tid)], groups, totals: T, months, earned, payments, paid, due: Math.round((earned - paid) * 100) / 100 };
  }

  /* ---- the ledger is the source of the balances the console shows ---- */
  const mapMark = c => (c === 'A' || c === 'B' ? 'a' : c === 'M' ? 'm' : 'p');
  function applyToStudents(gid) {
    ledger(gid).rows.forEach(x => {
      const s = x.s;
      if (!s._p0) s._p0 = s.presence.slice();
      s.balance = x.sold;
      const last = x.codes.filter(Boolean).slice(-3).map(mapMark);
      s.presence = s._p0.slice(0, 3 - last.length).concat(last);
    });
  }
  D.groups.forEach(g => applyToStudents(g.id));

  // an edit (here, in another tab, or a reset of the demo data): rebuild what depends on it
  let seen = JSON.stringify(D.ledgerEdits());
  const sig = () => D.students.map(s => s.status + s.manager).join();
  let statuses = sig();
  D.onChange(() => {
    const now = JSON.stringify(D.ledgerEdits());
    const st = sig();
    if (now === seen && st === statuses) return;
    seen = now; statuses = st;
    cache.clear();
    D.groups.forEach(g => applyToStudents(g.id));
  });

  Object.assign(D, { MONTHS, topicsFor, ledger, teacherBook, tLevel, rateOf, tabName, schedule, LEVEL_PCT, setMark, setLesson, addLesson, removeLesson, setRate, nextDate });
})();
