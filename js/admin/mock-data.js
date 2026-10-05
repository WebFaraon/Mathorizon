/* ============================================================
   Mathorizon admin console: demo data
   ============================================================
   A deterministic, generated dataset for the admin console while the
   real data (groups, rooms, managers, balances) does not exist in
   Supabase yet. Same seed, same data on every load. Nothing here is
   written to the database: changes the admin makes in demo mode
   (moving a group to another room or hour, changing a status) are kept
   in localStorage under STORE_KEY and can be reset.

   window.AdminData = {
     DAYS, HOURS, PROJECTS, SUBJECTS, GRADES, GROUP_STATUS, STUDENT_STATUS,
     rooms, teachers, managers, groups, students,
     group(id), teacher(id), manager(id), room(id), studentsOf(groupId),
     freeSeats(g), conflicts(day), move(groupId, patch), setStatus(...),
     setAvailability(teacherId, availability), setTeach(teacherId, rows),
     resetTeacher(id), teacherEdited(id), base(groupId),
     reset(), onChange(fn)
   }

   js/admin/registru-data.js adds the teacher register ledger on top of this
   (ledger, teacherBook, ...) and makes student balances and presence come
   from it. The register page (registru.html) edits availability and the
   teaching table through setAvailability / setTeach; another tab picks the
   change up through the 'storage' event.
   ============================================================ */
(function () {
  'use strict';

  const STORE_KEY = 'bm_admin_demo_v1';

  /* ---- deterministic random (mulberry32) ---- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = rng(20261002);
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const int = (a, b) => a + Math.floor(R() * (b - a + 1));
  function weighted(pairs) {
    const total = pairs.reduce((t, p) => t + p[1], 0);
    let x = R() * total;
    for (const [v, w] of pairs) { if ((x -= w) < 0) return v; }
    return pairs[pairs.length - 1][0];
  }

  /* ---- vocabularies ---- */
  const DAYS = [
    { id: 1, name: 'Luni', short: 'Lun' }, { id: 2, name: 'Marți', short: 'Mar' },
    { id: 3, name: 'Miercuri', short: 'Mie' }, { id: 4, name: 'Joi', short: 'Joi' },
    { id: 5, name: 'Vineri', short: 'Vin' }, { id: 6, name: 'Sâmbătă', short: 'Sâm' },
    { id: 7, name: 'Duminică', short: 'Dum' }
  ];
  const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 08:00 .. 20:00 starts

  const PROJECTS = [
    { id: 'exo', name: 'Examen.md Offline', short: 'Examen Offline', mode: 'offline' },
    { id: 'exn', name: 'Examen.md Online', short: 'Examen Online', mode: 'online' },
    { id: 'mat', name: 'Matematica.md', short: 'Matematica.md', mode: 'online' }
  ];

  const SUBJECTS = ['Matematica', 'L.română', 'Fizica', 'Istoria', 'Chimie', 'Biologie', 'Engleza', 'Geografie'];
  const GRADES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const LEVELS = ['4-5', '5-6', '6-7', '7-8', '8-9', '9-10'];

  const GROUP_STATUS = [
    { id: 'activ', name: 'Activ' },
    { id: 'completare', name: 'Se completează' },
    { id: 'inlocuire', name: 'Înlocuire' },
    { id: 'inactiv', name: 'Inactiv' }
  ];
  const STUDENT_STATUS = [
    { id: 'activ', name: 'Activ' },
    { id: 'proba', name: 'Oră de probă' },
    { id: 'proba_ok', name: 'Probă confirmată' },
    { id: 'instabil', name: 'Instabil' },
    { id: 'inlocuire', name: 'Înlocuire' },
    { id: 'transferat', name: 'Transferat' },
    { id: 'inactiv', name: 'Inactiv' }
  ];

  const FIRST_M = ['Victor', 'Nichita', 'Aurelian', 'Dragoș', 'Gabriel', 'Nicolae', 'Octavian', 'Alexandru', 'Bogdan', 'Grigore', 'Maxim', 'Ilie', 'Vlad', 'Andrei', 'Mihai', 'Cristian', 'Dumitru', 'Ion', 'Sergiu', 'Radu', 'Damian', 'Ciprian', 'Marcel', 'Petru', 'Tudor', 'Daniel', 'Artur', 'Eugen'];
  const FIRST_F = ['Diana', 'Iana', 'Irina', 'Viorica', 'Doina', 'Amelia', 'Elena', 'Victorina', 'Natalia', 'Cristina', 'Ariadna', 'Valeria', 'Victoria', 'Lenara', 'Romina', 'Ana', 'Maria', 'Alina', 'Corina', 'Tatiana', 'Mihaela', 'Daniela', 'Ecaterina', 'Olga', 'Sanda', 'Ludmila', 'Carolina', 'Adelina'];
  const LAST = ['Sîrbu', 'Suhina', 'Zinenco', 'Tihon', 'Bivol', 'Dementieva', 'Matvei', 'Rîbca', 'Pîrțac', 'Pîrpît', 'Jalenco', 'Motruc', 'Adam', 'Sula', 'Cuzeac', 'Cernatîschi', 'Grebincea', 'Harabari', 'Mirza', 'Trohin', 'Rotari', 'Melnicov', 'Luchian', 'Moșneaga', 'Pănuță', 'Moiseenco', 'Buzu', 'Marcu', 'Ursuleac', 'Ciumac', 'Cerchez', 'Pricinoc', 'Chitic', 'Lipovan', 'Albot', 'Ceban', 'Rusu', 'Popa', 'Lungu', 'Munteanu', 'Țurcanu', 'Cojocaru', 'Guțu', 'Bălan', 'Ungureanu', 'Gîrlea', 'Botnari', 'Zaharia', 'Plămădeală', 'Croitoru', 'Vrabie', 'Negru', 'Lupașcu', 'Spînu', 'Postică', 'Cebotari', 'Rață', 'Melnic', 'Nistor', 'Grosu'];

  const person = () => {
    const f = R() < 0.5;
    return { first: pick(f ? FIRST_F : FIRST_M), last: pick(LAST) };
  };
  const phone = () => '+373' + pick(['6', '7']) + String(int(0, 9)) + String(int(100000, 999999));

  /* ---- rooms (offline only) ---- */
  const rooms = [11, 12, 13, 14, 15, 16, 17, 18].map(n => ({
    id: 'c' + n, num: n, name: 'Cabinet ' + n, floor: n < 15 ? 1 : 2, seats: n === 17 ? 10 : n % 2 ? 8 : 6
  }));

  /* ---- managers ---- */
  const managers = [
    ['Cristina', 'Cerchez'], ['Ariadna', 'Pricinoc'], ['Octavian', 'Chitic'],
    ['Alexandru', 'Lipovan'], ['Olga', 'Ceban'], ['Radu', 'Botnari']
  ].map(([first, last], i) => ({ id: 'm' + (i + 1), name: `${first} ${last}`, short: first, tone: i }));

  /* ---- teachers ---- */
  const teacherSpecs = [
    ['Victor', 'Sîrbu', ['Matematica'], ['exo', 'mat']], ['Nichita', 'Suhina', ['Matematica', 'Fizica'], ['exo']],
    ['Victor', 'Zinenco', ['Fizica'], ['exo', 'exn']], ['Aurelian', 'Tihon', ['Matematica'], ['exo', 'exn']],
    ['Dragoș', 'Bivol', ['Matematica'], ['exo', 'mat']], ['Diana', 'Dementieva', ['L.română'], ['exo', 'exn']],
    ['Iana', 'Matvei', ['Matematica'], ['exo', 'mat']], ['Gabriel', 'Rîbca', ['Matematica'], ['exo']],
    ['Nicolae', 'Sîrbu', ['Matematica'], ['exo', 'exn']], ['Victor', 'Pîrțac', ['Fizica'], ['exo']],
    ['Viorica', 'Pîrpît', ['Matematica'], ['mat']], ['Irina', 'Jalenco', ['Matematica'], ['mat', 'exn']],
    ['Doina', 'Motruc', ['Matematica'], ['mat']], ['Amelia', 'Adam', ['Istoria'], ['exn', 'exo']],
    ['Vlad', 'Sula', ['Matematica'], ['exo', 'mat']], ['Maxim', 'Cuzeac', ['Matematica'], ['mat']],
    ['Ilie', 'Cernatîschi', ['Matematica'], ['mat', 'exn']], ['Elena', 'Grebincea', ['Matematica'], ['mat']],
    ['Victorina', 'Harabari', ['Matematica'], ['mat', 'exo']], ['Ana', 'Rusu', ['L.română'], ['exo', 'exn']],
    ['Maria', 'Popa', ['Chimie'], ['exo', 'exn']], ['Corina', 'Lungu', ['Biologie'], ['exo', 'exn']],
    ['Tatiana', 'Munteanu', ['Engleza'], ['exn', 'exo']], ['Sergiu', 'Țurcanu', ['Geografie', 'Istoria'], ['exo']],
    ['Mihaela', 'Cojocaru', ['L.română'], ['exn', 'exo']], ['Petru', 'Guțu', ['Fizica', 'Matematica'], ['exn', 'exo']],
    ['Carolina', 'Bălan', ['Engleza'], ['exo', 'exn']], ['Tudor', 'Ungureanu', ['Chimie', 'Biologie'], ['exo']]
  ];
  const teachers = teacherSpecs.map(([first, last, subjects, projects], i) => {
    // Weekly availability: per day a list of [startHour, endHour) windows.
    const availability = {};
    DAYS.forEach(d => {
      const weekend = d.id >= 6;
      if (R() < (weekend ? 0.45 : 0.18)) { availability[d.id] = []; return; }
      const a = weekend ? int(8, 10) : pick([8, 9, 13, 14, 15]);
      const b = Math.min(21, a + (weekend ? int(5, 9) : int(4, 7)));
      availability[d.id] = [[a, b]];
    });
    return { id: 't' + (i + 1), first, last, name: `${last} ${first}`, subjects, projects, phone: phone(), availability };
  });

  /* ---- groups ---- */
  const DAY_PATTERNS = [[1, 3], [2, 4], [3, 5], [1, 4], [2, 5], [6, 7], [1], [2], [3], [4], [5], [6], [7], [6], [7]];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Local calendar date (toISOString would shift it to UTC, a day back here).
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  const groups = [];
  const teacherBusy = {};
  const N_GROUPS = 196;
  for (let i = 0; i < N_GROUPS; i++) {
    const project = weighted([['exo', 46], ['exn', 28], ['mat', 26]]);
    const subject = project === 'mat' ? 'Matematica' : weighted([['Matematica', 52], ['L.română', 14], ['Fizica', 9], ['Istoria', 6], ['Chimie', 5], ['Biologie', 5], ['Engleza', 6], ['Geografie', 3]]);
    const pool = teachers.filter(t => t.subjects.includes(subject) && t.projects.includes(project));
    const teacher = pick(pool.length ? pool : teachers.filter(t => t.subjects.includes(subject)));
    const grade = weighted([['II', 2], ['III', 2], ['IV', 3], ['V', 6], ['VI', 8], ['VII', 9], ['VIII', 10], ['IX', 22], ['X', 7], ['XI', 8], ['XII', 23]]);
    const gi = GRADES.indexOf(grade);
    const size = weighted([[6, 34], [3, 24], [4, 12], [5, 10], [2, 12], [1, 8]]);
    const regime = R() < 0.14 ? 'vara' : 'normal';
    let status = weighted([['activ', 46], ['completare', 20], ['inlocuire', 16], ['inactiv', 18]]);
    const duration = weighted([[1, 58], [2, 42]]);
    // A slot inside the teacher's availability where the teacher is still
    // free; a few groups (every 41st) skip the check so the console has a
    // teacher clash to show.
    let days, start, tries = 0;
    do {
      days = pick(DAY_PATTERNS);
      const win = (teacher.availability[days[0]] || [])[0];
      start = win ? int(win[0], Math.max(win[0], win[1] - duration)) : int(9, 19);
      start = Math.min(start, 21 - duration);
      tries++;
    } while (tries < 12 && i % 31 !== 7 && days.some(d => { for (let h = start; h < start + duration; h++) if (teacherBusy[`${teacher.id}|${d}|${h}`]) return true; return false; }));
    if (status !== 'inactiv') days.forEach(d => { for (let h = start; h < start + duration; h++) teacherBusy[`${teacher.id}|${d}|${h}`] = true; });
    const startDate = status === 'completare' && R() < 0.35 ? iso(addDays(today, int(1, 9))) : iso(addDays(today, -int(14, 300)));
    groups.push({
      id: 'g' + String(i + 1).padStart(3, '0'),
      project, regime, subject, grade,
      profile: gi >= 9 ? (R() < 0.62 ? 'Real' : 'Uman') : null,
      level: pick(LEVELS),
      size, status, teacher: teacher.id,
      days: days.slice(), start, duration,
      room: null,
      startDate,
      createdAt: iso(addDays(today, -int(20, 400)))
    });
  }

  /* The slot above was picked from the availability of the group's first day
     only. Widen each teacher's availability so every lesson sits inside it, on
     every day it is held (lessons stay where they are; the schedule follows). */
  groups.forEach(g => {
    const t = teachers.find(x => x.id === g.teacher);
    g.days.forEach(d => {
      const have = t.availability[d] || [];
      if (have.some(([a, b]) => g.start >= a && g.start + g.duration <= b)) return; // already inside
      // not covered yet: open a realistic block around the lesson, not just its own hour
      const wins = have.concat([[Math.max(8, g.start - 2), Math.min(21, g.start + g.duration + 2)]]).sort((a, b) => a[0] - b[0]);
      const merged = [];
      wins.forEach(w => {
        const last = merged[merged.length - 1];
        if (last && w[0] <= last[1] + 1) last[1] = Math.max(last[1], w[1]); // overlapping, adjacent or one hour apart
        else merged.push([w[0], w[1]]);
      });
      t.availability[d] = merged;
    });
  });

  /* Offline groups get a room: the first free one at their hours, so the
     plan starts mostly clean; a handful are then placed on purpose in a
     busy room so the console has real conflicts to show. */
  const busy = {}; // `${day}|${room}|${hour}` -> groupId
  const slotKeys = (g, room) => {
    const out = [];
    g.days.forEach(d => { for (let h = g.start; h < g.start + g.duration; h++) out.push(`${d}|${room}|${h}`); });
    return out;
  };
  groups.filter(g => g.project === 'exo').forEach((g, i) => {
    const order = rooms.map(r => r.id).sort(() => R() - 0.5);
    let room = order.find(r => slotKeys(g, r).every(k => !busy[k]));
    if (!room || i % 14 === 5) room = order.find(r => slotKeys(g, r).some(k => busy[k])) || order[0];
    g.room = room;
    slotKeys(g, room).forEach(k => { busy[k] = busy[k] || g.id; });
  });

  /* ---- students ---- */
  const students = [];
  let sid = 0;
  function makeStudent(group, forcedStatus) {
    const p = person();
    const status = forcedStatus || weighted([['activ', 46], ['proba', 6], ['proba_ok', 3], ['instabil', 5], ['inlocuire', 8], ['transferat', 10], ['inactiv', 22]]);
    const pres = Array.from({ length: 3 }, () => weighted(status === 'activ' ? [['p', 80], ['a', 8], ['m', 12]] : [['p', 35], ['a', 35], ['m', 30]]));
    const debt = status === 'activ' ? weighted([[0, 50], [1, 50]]) : 1;
    const balance = debt ? -int(150, 3400) : int(0, 900);
    sid++;
    return {
      id: 's' + String(sid).padStart(4, '0'),
      first: p.first, last: p.last, name: `${p.last} ${p.first}`,
      phone: phone(),
      status,
      manager: pick(managers).id,
      balance,
      presence: pres,
      level: pick(LEVELS),
      group: group ? group.id : null,
      joinedAt: iso(addDays(today, -int(3, 380)))
    };
  }
  groups.forEach(g => {
    let n;
    if (g.status === 'inactiv') n = int(0, Math.min(2, g.size));
    else if (g.status === 'completare') n = int(0, Math.max(0, g.size - 1));
    else if (g.status === 'inlocuire') n = int(0, g.size);
    else n = Math.max(1, g.size - weighted([[0, 50], [1, 28], [2, 14], [3, 8]]));
    for (let k = 0; k < n; k++) {
      const st = g.status === 'inactiv' ? 'inactiv' : (g.status === 'activ' ? weighted([['activ', 78], ['proba', 8], ['proba_ok', 4], ['instabil', 6], ['inlocuire', 4]]) : null);
      students.push(makeStudent(g, st));
    }
  });
  for (let k = 0; k < 140; k++) students.push(makeStudent(null, weighted([['inactiv', 60], ['transferat', 30], ['proba', 10]])));

  /* ---- indexes ---- */
  const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
  const idx = { teachers: byId(teachers), managers: byId(managers), rooms: byId(rooms), groups: byId(groups) };
  const studentsByGroup = {};
  students.forEach(s => { if (s.group) (studentsByGroup[s.group] = studentsByGroup[s.group] || []).push(s); });

  /* ---- what each teacher teaches, per grade (the "Detalii profesor" table of the register) ----
     Own random stream, drawn after everything above, so the data above stays exactly as it was. */
  const R2 = rng(20261004);
  teachers.forEach(t => {
    t.teach = t.subjects.map(subject => {
      const own = groups.filter(g => g.teacher === t.id && g.subject === subject).map(g => GRADES.indexOf(g.grade));
      const set = new Set(own);
      const lo = own.length ? Math.min(...own) : 4, hi = own.length ? Math.max(...own) : 8;
      for (let i = lo; i <= hi; i++) if (R2() < 0.8) set.add(i);
      if (lo > 0 && R2() < 0.5) set.add(lo - 1);
      if (hi < 11 && R2() < 0.5) set.add(hi + 1);
      return { subject, grades: Array.from(set).sort((a, b) => a - b).map(i => GRADES[i]) };
    });
  });
  const subjectsOf = t => {
    const out = [];
    t.teach.forEach(r => { if (!out.includes(r.subject)) out.push(r.subject); });
    groups.forEach(g => { if (g.teacher === t.id && !out.includes(g.subject)) out.push(g.subject); });
    return out;
  };

  /* ---- local edits (demo only) ---- */
  const clone = o => JSON.parse(JSON.stringify(o));
  const BASE = clone(groups.map(g => ({ id: g.id, days: g.days, start: g.start, duration: g.duration, room: g.room, status: g.status, subject: g.subject, grade: g.grade, level: g.level, profile: g.profile, size: g.size })));
  const BASE_S = Object.fromEntries(students.map(s => [s.id, { status: s.status, manager: s.manager }]));
  const idxS = Object.fromEntries(students.map(s => [s.id, s]));
  const BASE_T = clone(teachers.map(t => ({ id: t.id, availability: t.availability, teach: t.teach })));
  const baseG = Object.fromEntries(BASE.map(b => [b.id, b]));
  let edits = {};
  try { edits = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { edits = {}; }
  function applyEdits() {
    BASE.forEach(b => Object.assign(idx.groups[b.id], { days: b.days.slice(), start: b.start, duration: b.duration, room: b.room, status: b.status, subject: b.subject, grade: b.grade, level: b.level, profile: b.profile, size: b.size }));
    Object.entries(edits.groups || {}).forEach(([id, patch]) => { if (idx.groups[id]) Object.assign(idx.groups[id], patch); });
    Object.entries(BASE_S).forEach(([id, b]) => { idxS[id].status = b.status; idxS[id].manager = b.manager; });
    Object.entries(edits.students || {}).forEach(([id, patch]) => { if (idxS[id]) Object.assign(idxS[id], patch); });
    BASE_T.forEach(b => {
      const t = idx.teachers[b.id], e = (edits.teachers || {})[b.id] || {};
      t.availability = clone(e.availability || b.availability);
      t.teach = clone(e.teach || b.teach);
      t.subjects = subjectsOf(t);
    });
  }
  applyEdits();
  const listeners = new Set();
  const saveHooks = [];
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(edits)); } catch (e) { /* private mode */ }
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    saveHooks.forEach(fn => { try { fn(edits); } catch (e) { console.error(e); } });   // js/admin/demo-sync.js sends the changes to Supabase
  }
  /* Edits that arrive from another device (Realtime): applied at once, announced after a short pause so a burst
     of them (a reset on the other side) redraws the views once. */
  let extT = 0;
  function replaceEdits(next) {
    edits = next || {};
    applyEdits();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(edits)); } catch (e) { /* private mode */ }
    clearTimeout(extT);
    extT = setTimeout(() => {
      listeners.forEach(fn => { try { fn(); } catch (err) { console.error(err); } });
      document.dispatchEvent(new CustomEvent('bm:demo-external'));
    }, 60);
  }
  // The register (registru.html) edits the same store from another tab: pick its changes up live.
  window.addEventListener('storage', e => {
    if (e.key !== STORE_KEY) return;
    try { edits = JSON.parse(e.newValue || '{}') || {}; } catch (err) { edits = {}; }
    applyEdits();
    listeners.forEach(fn => { try { fn(); } catch (err) { console.error(err); } });
    document.dispatchEvent(new CustomEvent('bm:demo-external'));
  });

  /* ---- helpers ---- */
  const enrolled = g => (studentsByGroup[g.id] || []).filter(s => !['inactiv', 'transferat'].includes(s.status));
  const freeSeats = g => Math.max(0, g.size - enrolled(g).length);

  // Overlaps for one day: the same room or the same teacher twice in an hour.
  function conflicts(day) {
    const room = {}, teacher = {};
    groups.forEach(g => {
      if (g.status === 'inactiv' || !g.days.includes(day)) return;
      for (let h = g.start; h < g.start + g.duration; h++) {
        if (g.room) (room[`${g.room}|${h}`] = room[`${g.room}|${h}`] || []).push(g.id);
        (teacher[`${g.teacher}|${h}`] = teacher[`${g.teacher}|${h}`] || []).push(g.id);
      }
    });
    const out = [];
    const seen = new Set();
    Object.entries(room).forEach(([k, ids]) => {
      if (ids.length < 2) return;
      const key = 'r|' + k.split('|')[0] + '|' + ids.slice().sort().join(',');
      if (seen.has(key)) return; seen.add(key);
      out.push({ kind: 'room', room: k.split('|')[0], hour: +k.split('|')[1], groups: ids });
    });
    Object.entries(teacher).forEach(([k, ids]) => {
      if (ids.length < 2) return;
      const key = 't|' + k.split('|')[0] + '|' + ids.slice().sort().join(',');
      if (seen.has(key)) return; seen.add(key);
      out.push({ kind: 'teacher', teacher: k.split('|')[0], hour: +k.split('|')[1], groups: ids });
    });
    return out;
  }

  function isAvailable(teacherId, day, start, duration) {
    const wins = (idx.teachers[teacherId] && idx.teachers[teacherId].availability[day]) || [];
    return wins.some(([a, b]) => start >= a && start + duration <= b);
  }

  function patchGroup(id, patch) {
    edits.groups = edits.groups || {};
    edits.groups[id] = Object.assign({}, edits.groups[id] || {}, patch);
    Object.assign(idx.groups[id], patch);
    if ('subject' in patch) teachers.forEach(t => { t.subjects = subjectsOf(t); });
    save();
  }
  function patchStudent(id, patch) {
    edits.students = edits.students || {};
    edits.students[id] = Object.assign({}, edits.students[id] || {}, patch);
    Object.assign(idxS[id], patch);
    save();
  }

  /* A teacher's weekly availability ({ day: [[from, to), ...] }) or teaching table, as the register writes it. */
  function patchTeacher(id, patch) {
    edits.teachers = edits.teachers || {};
    edits.teachers[id] = Object.assign({}, edits.teachers[id] || {}, clone(patch));
    const t = idx.teachers[id];
    if (patch.availability) t.availability = clone(patch.availability);
    if (patch.teach) { t.teach = clone(patch.teach); t.subjects = subjectsOf(t); }
    save();
  }

  window.AdminData = {
    DAYS, HOURS, PROJECTS, SUBJECTS, GRADES, LEVELS, GROUP_STATUS, STUDENT_STATUS,
    rooms, teachers, managers, groups, students,
    today,
    iso,
    todayISO: iso(today),
    group: id => idx.groups[id],
    teacher: id => idx.teachers[id],
    manager: id => idx.managers[id],
    room: id => idx.rooms[id],
    project: id => PROJECTS.find(p => p.id === id),
    studentsOf: gid => studentsByGroup[gid] || [],
    enrolled, freeSeats, conflicts, isAvailable,
    move: (id, patch) => patchGroup(id, patch),
    setStatus: (id, status) => patchGroup(id, { status }),
    edited: () => Object.keys(edits.groups || {}).length,
    setGroup: (id, patch) => patchGroup(id, patch),
    setStudentStatus: (id, status) => patchStudent(id, { status }),
    baseStatus: id => BASE_S[id].status,
    setStudentManager: (id, manager) => patchStudent(id, { manager }),
    ledgerEdits: () => edits.ledger || {},
    setLedgerEdits(v) { edits.ledger = v; save(); },
    setAvailability: (id, availability) => patchTeacher(id, { availability }),
    setTeach: (id, teach) => patchTeacher(id, { teach }),
    teacherEdited: id => !!((edits.teachers || {})[id]),
    resetTeacher(id) { if (edits.teachers) delete edits.teachers[id]; applyEdits(); save(); },
    base: id => baseG[id],
    reset() { edits = {}; applyEdits(); save(); },
    sync: { edits: () => edits, replace: replaceEdits, onSave: fn => saveHooks.push(fn) },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
