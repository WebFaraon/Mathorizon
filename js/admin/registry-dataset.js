/* ============================================================
   Admin console: the Google Sheets registers as the source of the console's data
   ============================================================
   build(tables) turns the rows of the reg_* tables (what the registru-sync function stored, see supabase/migrations/20261008*)
   into the same shapes the console is built on (js/admin/mock-data.js): teachers, managers, rooms, groups, students, and the
   history of a student who is in several groups (a column per group in the registers = a transfer chain here).

   tables = { workbooks: [...], groups: [...], students: [...], lessons: [...] }   (rows as the database returns them)

   Pure function, no browser needed: the same file is read by the console (window.AdminRegistryDataset) and by the Node check
   (scripts/check-registry-dataset.js), which proves that the demo registers give back exactly the demo console.
   The registers do not say: a teacher's phone (left empty), a room's seats (8), a transfer's date (the first lesson in the new group).
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AdminRegistryDataset = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const tokens = name => plain(name).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).sort();
  const sameName = (a, b) => {
    if (!a.length || !b.length) return false;
    const [s, l] = a.length <= b.length ? [a, b] : [b, a];
    return s.length >= 2 && s.every(t => l.includes(t));           // "Popescu Ana" is part of "Popescu Ana Maria"
  };
  const groupStatus = s => { const p = plain(s); return p === 'activ' ? 'activ' : p === 'inactiv' ? 'inactiv' : p === 'se completeaza' || p === 'porneste' ? 'completare' : p === 'inlocuire' ? 'inlocuire' : 'activ'; };
  const studentStatus = s => {
    const p = plain(s);
    return p === 'activ' ? 'activ' : p === 'ora de proba' ? 'proba' : p === 'ora de proba confirmata' ? 'proba_ok' : p === 'transferat' ? 'transferat' : p === 'inactiv' ? 'inactiv' : p === 'inlocuire' ? 'inlocuire' : 'activ';
  };
  const ENROLLED = new Set(['activ', 'proba', 'proba_ok', 'inlocuire', 'instabil']);
  const projectId = (wb, group) => {
    const p = plain(wb.project || wb.title || '');
    if (p.includes('offline')) return 'exo';
    if (p.includes('online')) return 'exn';
    if (p.includes('matematica.md')) return 'mat';
    return 'exo';
  };
  const mgrName = n => { const t = String(n || '').trim().split(/\s+/); return t.length > 1 ? t.slice(1).join(' ') + ' ' + t[0] : String(n || ''); };   // "Cerchez Cristina" -> "Cristina Cerchez"
  const splitPerson = name => { const t = String(name || '').trim().split(/\s+/); return { last: t[0] || '', first: t.slice(1).join(' ') || t[0] || '' }; };
  const nextDay = iso => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  const merge = hours => {
    const hs = [...new Set(hours)].sort((a, b) => a - b), out = [];
    hs.forEach(h => { const l = out[out.length - 1]; if (l && h === l[1]) l[1] = h + 1; else out.push([h, h + 1]); });
    return out;
  };

  /* the days, the start and the duration of a group from its schedule rows (a two-hour lesson is two rows: "Joi 10" and "Joi 11") */
  function slotsOf(schedule) {
    const rows = (schedule || []).filter(s => s.day && s.hour != null);
    const byDay = {};
    rows.forEach(s => { (byDay[s.day] = byDay[s.day] || []).push(s.hour); });
    const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
    if (!days.length) return { days: [], start: 0, duration: 1, room: null, irregular: false };
    const win = d => merge(byDay[d])[0];
    const w0 = win(days[0]);
    const irregular = days.some(d => { const w = win(d); return w[0] !== w0[0] || w[1] !== w0[1]; });
    const cab = (rows.find(s => s.cabinet) || {}).cabinet;
    return { days, start: w0[0], duration: w0[1] - w0[0], room: cab ? 'c' + String(cab).replace(/\D/g, '') : null, irregular };
  }

  function build(T, opts) {
    opts = opts || {};
    const wbs = (T.workbooks || []).filter(w => w.enabled !== false);
    const wbById = new Map(wbs.map(w => [w.id, w]));
    const groupsByWb = new Map();
    (T.groups || []).forEach(g => { if (!wbById.has(g.workbook_id)) return; (groupsByWb.get(g.workbook_id) || groupsByWb.set(g.workbook_id, []).get(g.workbook_id)).push(g); });
    const studentsByGroupRow = new Map();
    (T.students || []).forEach(s => { (studentsByGroupRow.get(s.group_id) || studentsByGroupRow.set(s.group_id, []).get(s.group_id)).push(s); });
    const lessonsByGroupRow = new Map();
    (T.lessons || []).forEach(l => { (lessonsByGroupRow.get(l.group_id) || lessonsByGroupRow.set(l.group_id, []).get(l.group_id)).push(l); });
    lessonsByGroupRow.forEach(list => list.sort((a, b) => a.row_no - b.row_no));

    /* ---- managers: the register's dropdown list, then anyone named on a student ---- */
    const mgrNames = new Set();
    wbs.forEach(w => ((w.config && w.config.manager) || []).forEach(n => mgrNames.add(n)));
    (T.students || []).forEach(s => { if (s.manager) mgrNames.add(s.manager); });
    const managers = [...mgrNames].sort((a, b) => a.localeCompare(b, 'ro')).map((n, i) => { const name = mgrName(n); return { id: 'm' + (i + 1), name, short: name.split(' ')[0], tone: i, _reg: n }; });
    const mgrByReg = new Map(managers.map(m => [m._reg, m.id]));

    /* ---- teachers ---- */
    const teachers = [];
    const tidOf = new Map();
    wbs.forEach(w => {
      const { first, last } = splitPerson(w.teacher_name || w.title || 'Profesor');
      const td = w.teacher_data || {};
      const av = (td.availability && td.availability.slots) || {};
      const availability = {};
      for (let d = 1; d <= 7; d++) availability[d] = merge(av[d] || []);
      const teachMap = {};
      [td.availability, td.availabilitySummer].forEach(a => {
        Object.entries((a && a.teaches) || {}).forEach(([subj, grades]) => {
          const name = subj.replace(/\s*\(vara\)\s*$/i, '').trim();
          teachMap[name] = [...new Set((teachMap[name] || []).concat(grades))];
        });
      });
      const GR = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
      const teach = Object.keys(teachMap).map(subject => ({ subject, grades: teachMap[subject].sort((a, b) => GR.indexOf(a) - GR.indexOf(b)) }));
      const t = { id: 't' + String(w.id), first, last, name: w.teacher_name || `${last} ${first}`, subjects: teach.map(x => x.subject), projects: [projectId(w)], phone: '', availability, teach, _wb: w.id, _ssid: w.spreadsheet_id };
      teachers.push(t); tidOf.set(w.id, t.id);
    });

    /* ---- rooms: the cabinets of the dropdown list and of the schedules ---- */
    const cabs = new Set();
    wbs.forEach(w => ((w.config && w.config.cabinet) || []).forEach(c => { if (/^\d+$/.test(String(c))) cabs.add(+c); }));
    (T.groups || []).forEach(g => (g.schedule || []).forEach(s => { if (s.cabinet && /^\d+$/.test(String(s.cabinet))) cabs.add(+s.cabinet); }));
    const rooms = [...cabs].sort((a, b) => a - b).map(n => ({ id: 'c' + n, num: n, name: 'Cabinet ' + n, floor: n < 15 ? 1 : n < 25 ? 2 : 3, seats: 8 }));

    /* ---- groups ---- */
    const groups = [], gById = new Map(), lessonsOf = {}, colsOf = {}, payOf = {}, levelsByTeacher = {};
    wbs.forEach(w => {
      (groupsByWb.get(w.id) || []).forEach(r => {
        const sl = slotsOf(r.schedule);
        const lessons = lessonsByGroupRow.get(r.id) || [];
        const dated = lessons.filter(l => l.iso && l.topic).map(l => l.iso).sort();
        const first = dated[0] || null;
        const g = {
          id: r.id, project: projectId(w), regime: r.summer || /\(vara\)/.test(plain(r.tab)) ? 'vara' : 'normal', subject: r.subject, grade: r.grade, profile: r.profile || null, level: r.level || '',
          size: r.format_size, status: groupStatus(r.state), teacher: tidOf.get(w.id), days: sl.days, start: sl.start, duration: sl.duration, room: sl.room,
          startDate: first || opts.today || null, createdAt: first || opts.today || null, _src: { wb: w.id, ssid: w.spreadsheet_id, sheet: r.sheet_id, tab: r.tab }, _irregular: sl.irregular
        };
        groups.push(g); gById.set(g.id, g);
        lessonsOf[g.id] = lessons.map(l => ({ row: l.row_no, iso: l.iso || null, topic: l.topic || '', marks: l.marks || {}, level: l.teacher_level, pay: l.teacher_pay }));
        const lv = (levelsByTeacher[g.teacher] = levelsByTeacher[g.teacher] || {});
        lessons.forEach(l => { if (l.teacher_level != null) lv[l.teacher_level] = (lv[l.teacher_level] || 0) + 1; });
      });
    });

    /* ---- people: one person for the columns of the same child (the same phone and name) ---- */
    const people = [], byPhone = new Map(), noPhone = [];
    const enrol = [];                                                  // every column of every group
    groups.forEach(g => {
      (studentsByGroupRow.get(g.id) || []).slice().sort((a, b) => String(a.col).length - String(b.col).length || String(a.col).localeCompare(String(b.col))).forEach(row => {
        const marks = lessonsOf[g.id].map(l => l.marks[row.col] || '');
        const dates = lessonsOf[g.id].map((l, i) => (marks[i] && l.iso ? l.iso : null)).filter(Boolean).sort();
        enrol.push({ row, g, marks, first: dates[0] || null, last: dates[dates.length - 1] || null });
      });
    });
    enrol.forEach(e => {
      const t = tokens(e.row.name), ph = e.row.phone;
      if (ph) {
        const list = byPhone.get(ph) || [];
        let p = list.find(x => sameName(x.tokens, t));
        if (!p) { p = { tokens: t, enrollments: [], name: e.row.name, phone: ph }; people.push(p); list.push(p); byPhone.set(ph, list); }
        p.enrollments.push(e);
      } else noPhone.push({ e, t });
    });
    noPhone.forEach(({ e, t }) => {
      let p = people.find(x => sameName(x.tokens, t));
      if (!p) { p = { tokens: t, enrollments: [], name: e.row.name, phone: null }; people.push(p); }
      p.enrollments.push(e);
    });

    const students = [], baseBy = {}, transfers = {}, history = {}, personOf = new Map();
    let at = 1000;
    people.forEach(p => {
      p.enrollments.sort((a, b) => (a.first || '9999').localeCompare(b.first || '9999') || a.g._src.tab.localeCompare(b.g._src.tab));
      const live = p.enrollments.filter(e => ENROLLED.has(studentStatus(e.row.status)));
      const primary = live.length ? live[live.length - 1] : p.enrollments[p.enrollments.length - 1];
      const firstE = p.enrollments[0];
      const { first, last } = splitPerson(p.name);
      const s = {
        // the id of his first column: stable, and never the same for two people
        id: 's' + String(p.enrollments[0].row.id), first, last, name: p.name, phone: p.phone || '',
        status: studentStatus(primary.row.status), manager: mgrByReg.get(primary.row.manager) || null, balance: 0, presence: [],
        level: primary.g.level || '', group: firstE.g.id, joinedAt: firstE.first || primary.first || opts.today || null, _base: firstE.g.id, _cur: primary.g.id
      };
      students.push(s); personOf.set(p, s);
      (baseBy[firstE.g.id] = baseBy[firstE.g.id] || []).push(s);
      for (let i = 1; i < p.enrollments.length; i++) {
        const prev = p.enrollments[i - 1], cur = p.enrollments[i];
        if (prev.g.id === cur.g.id) continue;
        // the day he changed groups: the first lesson in the new group, but never on or before his last marked lesson in the old one (the console closes the lessons from that day on)
        let when = cur.first;
        if (!when || (prev.last && when <= prev.last)) when = prev.last ? nextDay(prev.last) : (when || opts.today || null);
        transfers['reg' + (at)] = { s: s.id, from: prev.g.id, to: cur.g.id, iso: when, prev: studentStatus(prev.row.status), at: at++ };
      }
      p.enrollments.forEach(e => { e.person = s; });
    });

    /* ---- the ledger of every group, as the register has it (consumed by registru-data.js) ---- */
    groups.forEach(g => {
      const cols = enrol.filter(e => e.g === g);
      colsOf[g.id] = cols.map(e => ({ s: e.person, col: e.row.col, name: e.row.name, phone: e.row.phone, statusRaw: e.row.status, manager: e.row.manager, paid: Number(e.row.paid) || 0, disc: Number(e.row.discount) || 0, marks: e.marks, sheetCost: e.row.cost, sheetSold: e.row.sold }));
      payOf[g.id] = lessonsOf[g.id].map(l => l.pay);
    });

    const teacherInfo = {};
    teachers.forEach(t => {
      const w = wbById.get(t._wb), td = w.teacher_data || {};
      const lv = levelsByTeacher[t.id] || {};
      const best = Object.keys(lv).sort((a, b) => lv[b] - lv[a])[0];
      teacherInfo[t.id] = {
        level: best ? +best : 4,
        payments: (td.payments || []).map(p => ({ iso: p.iso || '', label: p.dateText || '', amount: Number(p.sum) || 0 })),
        sheet: { salaryDue: td.salaryDue, paidTotal: td.paidTotal, earnedTotal: td.earnedTotal }
      };
    });

    return {
      teachers, managers, rooms, groups, students, transfers, history, baseBy,
      ledger: gid => ({ lessons: lessonsOf[gid] || [], cols: colsOf[gid] || [], pay: payOf[gid] || [] }),
      /* the column of a person in a group's sheet: { col (the letter), name, phone, status, manager } as the register has it */
      columnOf: (sid, gid) => { const c = (colsOf[gid] || []).find(x => x.s.id === sid); return c ? { col: c.col, name: c.name, phone: c.phone, status: c.statusRaw, manager: c.manager } : null; },
      teacherInfo, tLevel: tid => (teacherInfo[tid] ? teacherInfo[tid].level : 4),
      payments: tid => (teacherInfo[tid] ? teacherInfo[tid].payments : []),
      summary: { workbooks: wbs.length, groups: groups.length, students: students.length, columns: enrol.length, irregular: groups.filter(g => g._irregular).length, noSchedule: groups.filter(g => !g.days.length).length }
    };
  }

  return { build, slotsOf, studentStatus, groupStatus };
});
