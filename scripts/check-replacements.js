/* The console side of the replacements (docs/inlocuiri.md), on synthetic tables (no register, no network):
   - registry-dataset.js keeps a substitute's tab OUT of the groups and out of the students' chains, and gives it back as `replacements`;
   - the money in the substitute's tab counts in the student's balance (replSold) and his history (replEvents);
   - replacement-plan.js decides who can take a lesson (teaches the class, is available, is free, has a register) and which cabinet is free.
   Run: npm run check:replacements */
'use strict';
const path = require('path');
const RD = require(path.join(__dirname, '..', 'js', 'admin', 'registry-dataset.js'));
const RP = require(path.join(__dirname, '..', 'js', 'admin', 'replacement-plan.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  !! ' + m); } };

const wbA = { id: 'wA', spreadsheet_id: 'ssA', title: 'Registru A', teacher_name: 'Ionescu Maria', enabled: true, project: 'Examen.md Offline', config: { manager: ['Cerchez Cristina'], cabinet: ['13', '14', '15'] },
  teacher_data: { availability: { slots: { 2: [16], 4: [16] }, teaches: { Matematica: ['XII'] }, hours: [16, 17] } } };
const wbB = { id: 'wB', spreadsheet_id: 'ssB', title: 'Registru B', teacher_name: 'Popescu Dan', enabled: true, project: 'Examen.md Offline', config: { cabinet: ['13', '14', '15'] },
  teacher_data: { availability: { slots: { 4: [15, 16, 17, 18] }, teaches: { Matematica: ['XII', 'XI'] }, hours: [15, 16, 17, 18] } } };
const wbC = { id: 'wC', spreadsheet_id: 'ssC', title: 'Registru C', teacher_name: 'Rusu Elena', enabled: true, project: 'Examen.md Offline', config: {},
  teacher_data: { availability: { slots: { 4: [16] }, teaches: { Fizica: ['XII'] }, hours: [16] } } };
const sched = [{ day: 2, hour: 16, cabinet: '13' }, { day: 4, hour: 16, cabinet: '13' }];
const gBase = { id: 'g1', workbook_id: 'wA', sheet_id: 11, tab: 'Marți/Joi 16:00-17:00', format_size: 3, state: 'Activ', subject: 'Matematica', summer: false, grade: 'XII', level: '9 ― 10', profile: 'Real', schedule: sched };
const gRepl = { id: 'g2', workbook_id: 'wB', sheet_id: 22, tab: 'Înlocuire Marți/Joi 16:00-17:00', format_size: 3, state: 'Înlocuire', subject: 'Matematica', summer: false, grade: 'XII', level: '9 ― 10', profile: 'Real', schedule: [{ day: 4, hour: 16, cabinet: '14' }] };
const gOther = { id: 'g3', workbook_id: 'wB', sheet_id: 23, tab: 'Joi 17:00-18:00', format_size: 4, state: 'Activ', subject: 'Matematica', summer: false, grade: 'XI', level: '9 ― 10', profile: 'Real', schedule: [{ day: 4, hour: 17, cabinet: '15' }] };
const stu = (id, group, col, name, phone, status, paid, discount, cost, sold) => ({ id, group_id: group, col, name, phone, manager: 'Cerchez Cristina', status, paid, discount, cost, sold });
const T = {
  workbooks: [wbA, wbB, wbC],
  groups: [gBase, gRepl, gOther],
  students: [
    stu('a1', 'g1', 'D', 'Ionescu Ana', '+37369111111', 'Activ', 2500, 100, 218, 2382), stu('a2', 'g1', 'E', 'Popa Mihai', '+37379222222', 'Activ', 0, 0, 0, 0), stu('a3', 'g1', 'F', 'Rusu Vlad', '+37369333333', 'Activ', 0, 0, 436, -436),
    stu('b1', 'g2', 'D', 'Ionescu Ana', '+37369111111', 'Înlocuire', 210.21, 7.79, 218, 0), stu('b2', 'g2', 'E', 'Popa Mihai', '+37379222222', 'Înlocuire', 0, 0, 0, 0), stu('b3', 'g2', 'F', 'Rusu Vlad', '+37369333333', 'Înlocuire', 0, 0, 218, -218)
  ],
  lessons: [
    { group_id: 'g1', row_no: 9, date_text: '6 Octombrie', iso: '2026-10-06', topic: 'Funcții', teacher_level: 4, teacher_pay: 100, marks: { D: 'P', E: 'P', F: 'A' } },
    { group_id: 'g2', row_no: 9, date_text: '8 Octombrie', iso: '2026-10-08', topic: 'Înlocuire', teacher_level: 4, teacher_pay: 50, marks: { D: 'P', E: 'M', F: 'A' } }
  ],
  replacements: [{ id: 'r1', orig_workbook: 'wA', orig_sheet: 11, repl_workbook: 'wB', repl_sheet: 22, repl_tab: 'Înlocuire Marți/Joi 16:00-17:00', status: 'active', dates: [{ iso: '2026-10-15', start: 16, duration: 1, cabinet: '14' }], price: 288, size: 3, created_at: '2026-10-09T10:00:00Z' }],
  replacement_items: [
    { replacement_id: 'r1', student_key: '+37369111111#9', lesson_row: 9, student_name: 'Ionescu Ana', student_phone: '+37369111111', mark: 'P', status: 'settled', tries: 0, attempt: 1, tot: 288, ach: 210.21, red: 7.79, short: 0, settled_at: '2026-10-09T11:00:00Z' },
    { replacement_id: 'r1', student_key: '+37369333333#9', lesson_row: 9, student_name: 'Rusu Vlad', student_phone: '+37369333333', mark: 'A', status: 'settled', tries: 0, attempt: 1, tot: 288, ach: 0, red: 0, short: 288, settled_at: '2026-10-09T11:00:00Z' }
  ]
};
const ds = RD.build(T, { today: '2026-10-09' });
ok(ds.groups.length === 2 && ds.groups.every(g => g.id !== 'g2'), 'the substitute\'s tab is not a group of the console');
ok(ds.students.length === 3, 'the substitute\'s columns are not new people (3, not 6): ' + ds.students.length);
ok(Object.keys(ds.transfers).length === 0, 'a replacement is never a transfer');
ok(ds.students.every(s => s._cur === 'g1' && s.group === 'g1'), 'every student\'s current group stays the base group');
ok(ds.replacements.length === 1, 'one replacement');
const rep = ds.replacements[0];
ok(rep.base === 'g1' && rep.teacher === ds.groups.find(g => g.id === 'g3').teacher && rep.baseTeacher === ds.groups.find(g => g.id === 'g1').teacher, 'the replacement knows the base group, the substitute and the base teacher');
ok(rep.cols.length === 3 && rep.lessons.length === 1 && rep.lessons[0].marks.D === 'P' && rep.items.length === 2 && rep.synced, 'columns, lessons and money lines come with it');
ok(rep.cols.every(c => c.sid) && new Set(rep.cols.map(c => c.sid)).size === 3, 'each column is matched to the person it belongs to');
const ana = ds.students.find(s => s.phone === '+37369111111'), vlad = ds.students.find(s => s.phone === '+37369333333'), mihai = ds.students.find(s => s.phone === '+37379222222');
ok(ds.replSold(ana.id) === 0 && ds.replSold(vlad.id) === -218 && ds.replSold(mihai.id) === 0, 'the sold of the substitute\'s tab counts: Ana 0, Vlad owes 218 (the lesson he attended and could not cover)');
ok(ds.replEvents(ana.id).length === 1 && ds.replEvents(ana.id)[0].ach === 210.21 && ds.replEvents(ana.id)[0].iso === '2026-10-08' && ds.replEvents(vlad.id)[0].short === 288, 'the history gets the lines of money, dated by the lesson');
ok(ds.replEvents(mihai.id).length === 0, 'a student who was Absent motivat has no line');
ok(rep._src.sheet === 22 && rep._src.ssid === 'ssB' && rep.dates[0].cabinet === '14' && rep.price === 288, 'the link to the tab and the dates');
const withoutRepl = RD.build(Object.assign({}, T, { replacements: [], replacement_items: [] }), { today: '2026-10-09' });
ok(withoutRepl.groups.length === 3 && withoutRepl.students.length === 3 && Object.keys(withoutRepl.transfers).length === 3, 'without the replacement row the same tab would look like a transfer: proof the filter matters');

// the planner
const dates = ['2026-10-15'];                                                      // a Thursday
const A = ds.teachers.find(t => t._wb === 'wA'), B = ds.teachers.find(t => t._wb === 'wB'), C = ds.teachers.find(t => t._wb === 'wC');
const g1 = ds.groups.find(g => g.id === 'g1');
const ctx = Object.assign({ group: g1, dates, groups: ds.groups, teachers: ds.teachers, rooms: ds.rooms, replacements: [] });
ok(RP.weekday('2026-10-15') === 4 && RP.weekday('2026-10-18') === 7 && RP.weekday('2026-10-12') === 1, 'weekdays');
ok(JSON.stringify(RP.upcomingDates(g1, '2026-10-12', 2)) === JSON.stringify(['2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22']), 'the dates the group meets');
ok(RP.dateOfWeekday(4, '2026-10-09') === '2026-10-08' && RP.dateOfWeekday(1, '2026-10-09') === '2026-10-05' && RP.dateOfWeekday(7, '2026-10-09') === '2026-10-11', 'the date of a weekday in this week (Monday first)');
let opts = RP.teacherOptions(ctx);
const o = id => opts.find(x => x.teacher.id === id);
ok(!opts.some(x => x.teacher.id === A.id), 'the group\'s own teacher is not offered');
ok(o(B.id).ok && o(B.id).reasons.length === 0, 'Popescu: teaches XII, available Thursday 16, free at 16 -> ok');
ok(!o(C.id).ok && o(C.id).reasons.some(r => /Nu predă Matematica la clasa a XII/.test(r)), 'Rusu: does not teach Matematica: ' + JSON.stringify(o(C.id).reasons));
ok(opts[0].teacher.id === B.id, 'the ones who can come first');
// B has a group Thursday 17: a two-hour group would clash; the base group is one hour so no clash
const g1b = Object.assign({}, g1, { duration: 2 });
opts = RP.teacherOptions(Object.assign({}, ctx, { group: g1b }));
ok(!o(B.id).ok && o(B.id).reasons.some(r => /Are grupa de Matematica \(clasa XI\) la 17:00/.test(r)), 'a two-hour lesson clashes with his group at 17: ' + JSON.stringify(o(B.id).reasons));
ok(RP.teacherOptions(Object.assign({}, ctx, { dates: [] }))[0].reasons[0] === 'Alege mai întâi datele', 'no date, no answer');
opts = RP.teacherOptions(Object.assign({}, ctx, { dates: ['2026-10-13', '2026-10-15'] }));
ok(!o(B.id).ok && o(B.id).reasons.some(r => /Nu e disponibil marți la 16:00/.test(r)), 'every chosen weekday must be covered by his availability (Tuesday is not)');
// B is already doing another replacement at that hour
const other = { id: 'r9', status: 'active', base: 'gX', teacher: B.id, dates: [{ iso: '2026-10-15', start: 16, duration: 1, cabinet: '15' }] };
opts = RP.teacherOptions(Object.assign({}, ctx, { replacements: [other] }));
ok(!o(B.id).ok && o(B.id).reasons.some(r => /înlocuire/.test(r)), 'a teacher who substitutes elsewhere at that hour is busy');
// the teacher\'s own group is being replaced that day by somebody else: he is free
const bLesson = Object.assign({}, ds.groups.find(g => g.id === 'g3'), { start: 16, id: 'g3' });
const ctxB = Object.assign({}, ctx, { groups: ds.groups.map(g => (g.id === 'g3' ? bLesson : g)) });
ok(!RP.teacherOptions(ctxB).find(x => x.teacher.id === B.id).ok, 'with his own group at 16 he is busy');
const takenAway = { id: 'r8', status: 'active', base: 'g3', teacher: C.id, dates: [{ iso: '2026-10-15', start: 16, duration: 1, cabinet: '15' }] };
ok(RP.teacherOptions(Object.assign({}, ctxB, { replacements: [takenAway] })).find(x => x.teacher.id === B.id).ok, 'but free on the day somebody else takes that lesson');
// rooms
const rooms = RP.roomOptions(ctx);
const r = id => rooms.find(x => x.room.id === id);
ok(r('c13').free, 'the group\'s own cabinet is free for its replaced lesson');
ok(r('c14').free && r('c15').free, 'cabinets nobody has are free');
const roomsB = RP.roomOptions(Object.assign({}, ctxB));
ok(!roomsB.find(x => x.room.id === 'c15').free && roomsB.find(x => x.room.id === 'c15').by[0] === 'Matematica, clasa XI', 'a cabinet used by a group at 16 on Thursday is taken: ' + JSON.stringify(roomsB.find(x => x.room.id === 'c15').by));
const roomsR = RP.roomOptions(Object.assign({}, ctx, { replacements: [other] }));
ok(!roomsR.find(x => x.room.id === 'c15').free && roomsR.find(x => x.room.id === 'c15').by[0] === 'o înlocuire', 'a cabinet used by another replacement is taken');
// replacedOn / onDate
ok(RP.replacedOn(ds.replacements, 'g1', '2026-10-15') && !RP.replacedOn(ds.replacements, 'g1', '2026-10-14') && !RP.replacedOn(ds.replacements, 'g3', '2026-10-15'), 'which lesson is replaced on which date');
ok(RP.onDate(ds.replacements, '2026-10-15').length === 1 && RP.onDate(ds.replacements, '2026-10-16').length === 0, 'the replaced lessons of a date');
const cancelled = [Object.assign({}, ds.replacements[0], { dates: [{ iso: '2026-10-15', start: 16, duration: 1, cabinet: '14', cancelled: true }] })];
ok(!RP.replacedOn(cancelled, 'g1', '2026-10-15') && RP.onDate(cancelled, '2026-10-15').length === 0, 'a cancelled date is not a replacement any more');

// the capacity of the cabinets: set by the admin (console_rooms), 8 and marked "not set" until then
const withRooms = RD.build(Object.assign({}, T, { console_rooms: [{ num: 13, seats: 10, floor: 2 }] }), { today: '2026-10-09' });
const r13 = withRooms.rooms.find(x => x.num === 13), r14 = withRooms.rooms.find(x => x.num === 14);
ok(r13 && r13.seats === 10 && r13.floor === 2 && r13.seatsSet === true, 'a cabinet the admin has set keeps its seats and floor');
ok(r14 && r14.seats === 8 && r14.seatsSet === false, 'a cabinet nobody has set is 8, marked not set (the console warns instead of guessing)');
ok(ds.rooms.every(x => x.seatsSet === false), 'without the table every cabinet is "not set"');

console.log(`REPLACEMENTS (console): ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
