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

   Added to window.AdminData:
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

  /* ---- the ledger of one group ---- */
  const cache = new Map();
  const STUDENT_COUNTS_AS_ACTIVE = ['activ', 'instabil', 'inlocuire'];

  function build(g) {
    const b = D.base(g.id) || g;
    const r = rng(hash('g' + g.id));
    const rate = rateOf(g);
    const topics = topicsFor(g);

    // dates of the lessons held
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
      return {
        i, date: d, iso: D.iso(d), day: wd(d),
        month: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
        monthName: cap(MONTHS[d.getMonth()]),
        label: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
        topic, price
      };
    });
    const n = lessons.length;

    // one column per student
    const rows = D.studentsOf(g.id).map(s => {
      const rs = rng(hash('s' + s.id));
      if (s._debt == null) s._debt = s.balance < 0;
      // most active students are settled: only some of the ones flagged as owing really are
      const debt = s._debt && (s.status !== 'activ' || rs() < 0.5);
      const joined = parse(s.joinedAt);
      let joinIdx = n ? lessons.findIndex(l => l.date >= joined) : 0;
      if (joinIdx < 0) joinIdx = n;
      const isTrial = s.status === 'proba' || s.status === 'proba_ok';
      if (isTrial && n) joinIdx = Math.max(0, n - (s.status === 'proba' ? 1 : 2));
      const isNew = !!n && (isTrial || joined >= lessons[0].date);
      let endIdx = n;
      if (s.status === 'inactiv' || s.status === 'transferat') endIdx = Math.min(n, joinIdx + 2 + Math.floor(rs() * Math.max(1, n - joinIdx)));
      const odds = s.status === 'activ' ? [['P', 82], ['A', 6], ['M', 12]]
        : s.status === 'instabil' ? [['P', 58], ['A', 27], ['M', 15]]
        : [['P', 60], ['A', 22], ['M', 18]];
      const codes = Array(n).fill('');
      for (let i = joinIdx; i < endIdx; i++) {
        if (i === joinIdx && isNew) codes[i] = rs() < 0.12 ? 'M' : 'G';
        else codes[i] = weighted(rs, odds);
      }
      let cost = 0, done = 0;
      codes.forEach((c, i) => { if (c === 'P' || c === 'A') { cost += lessons[i].price; done++; } });
      const disc = done >= 4 && rs() < 0.35 ? Math.round(cost * (0.03 + rs() * 0.09)) : 0;
      let paid;
      if (debt && cost > 0) {
        paid = Math.max(0, Math.round(cost * (0.35 + rs() * 0.55) / 10) * 10 - disc);
        if (paid + disc >= cost) paid = Math.max(0, cost - disc - 10 - Math.round(rs() * 30) * 10);
      } else {
        const adv = rs() < 0.5 ? 0 : Math.round(rs() * 90) * 10;
        paid = Math.max(0, cost - disc + adv);
      }
      const sold = paid + disc - cost;

      // the first lesson that went past what the student had paid for
      let flag = -1;
      if (sold < 0) { let run = 0; for (let i = 0; i < n; i++) { if (codes[i] === 'P' || codes[i] === 'A') run += lessons[i].price; if (run > paid + disc) { flag = i; break; } } }

      return { s, codes, joinIdx, endIdx, cost, done, disc, paid, sold, avail: rate ? Math.round(sold / rate * 10) / 10 : 0, flag, manager: D.manager(s.manager) };
    });

    // figures of the group
    const st = { P: 0, A: 0, M: 0, G: 0, paid: 0, cost: 0, disc: 0, debt: 0, adv: 0, sold: 0, active: 0, trial: 0, moved: 0, inactive: 0 };
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
    st.hours = n * b.duration;
    st.avg = n ? (st.P + st.G) / n : 0;
    st.success = marks ? Math.round(st.P / marks * 100) : 0;
    st.absent = st.A + st.M;

    // per lesson: how many were there
    lessons.forEach((l, i) => {
      let there = 0, expected = 0;
      rows.forEach(x => { const c = x.codes[i]; if (c) { expected++; if (c === 'P' || c === 'G') there++; } });
      l.there = there; l.expected = expected;
      l.pct = expected ? Math.round(there / expected * 100) : null;
    });

    // by month
    const months = [];
    const byKey = {};
    lessons.forEach((l, i) => {
      let m = byKey[l.month];
      if (!m) { m = byKey[l.month] = { key: l.month, name: l.monthName, P: 0, A: 0, M: 0, G: 0, value: 0, hours: 0, mgr: {} }; months.push(m); }
      m.hours += b.duration;
      rows.forEach(x => {
        const c = x.codes[i];
        if (!c) return;
        m[c]++;
        if (c === 'P' || c === 'A') { m.value += l.price; const id = x.s.manager; m.mgr[id] = (m.mgr[id] || 0) + l.price; }
      });
    });
    months.forEach(m => { const t = m.P + m.A + m.M; m.pct = t ? Math.round(m.P / t * 100) : 0; });

    const pct = LEVEL_PCT[tLevel(g.teacher)];
    const earned = Math.round(st.cost * pct * 100) / 100;
    return { g, rate, lessons, rows, stats: st, months, sum: lessons.reduce((t, l) => t + l.price, 0), earned, level: tLevel(g.teacher), pct };
  }

  function ledger(gid) {
    let L = cache.get(gid);
    if (!L) { L = build(D.group(gid)); cache.set(gid, L); }
    return L;
  }

  /* ---- everything one teacher sees on the first page of the register ---- */
  function teacherBook(tid) {
    const t = D.teacher(tid);
    const gs = D.groups.filter(g => g.teacher === tid).sort((a, b) => Math.min(...a.days) - Math.min(...b.days) || a.start - b.start || a.id.localeCompare(b.id));
    const groups = gs.map(g => ledger(g.id));
    const T = { P: 0, A: 0, M: 0, G: 0, paid: 0, cost: 0, disc: 0, debt: 0, adv: 0, sold: 0, active: 0, trial: 0, moved: 0, inactive: 0, hours: 0 };
    groups.forEach(L => Object.keys(T).forEach(k => { T[k] += L.stats[k] || 0; }));
    const marks = T.P + T.A + T.M;
    T.success = marks ? Math.round(T.P / marks * 100) : 0;
    T.lessons = groups.reduce((n, L) => n + L.lessons.length, 0);
    T.avg = T.lessons ? (T.P + T.G) / T.lessons : 0;
    T.absent = T.A + T.M;
    const earned = Math.round(groups.reduce((n, L) => n + L.earned, 0) * 100) / 100;

    // the months across all groups
    const months = [];
    const byKey = {};
    groups.forEach(L => L.months.forEach(m => {
      let x = byKey[m.key];
      if (!x) { x = byKey[m.key] = { key: m.key, name: m.name, P: 0, A: 0, M: 0, G: 0, value: 0, hours: 0, mgr: {} }; months.push(x); }
      ['P', 'A', 'M', 'G', 'value', 'hours'].forEach(f => { x[f] += m[f]; });
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
  D.groups.forEach(g => {
    const L = ledger(g.id);
    L.rows.forEach(x => {
      const s = x.s;
      s.balance = x.sold;
      const last = x.codes.filter(Boolean).slice(-3).map(c => (c === 'A' ? 'a' : c === 'M' ? 'm' : 'p'));
      s.presence = s.presence.slice(0, 3 - last.length).concat(last);
    });
  });

  Object.assign(D, { MONTHS, ledger, teacherBook, tLevel, rateOf, tabName, schedule, LEVEL_PCT });
})();
