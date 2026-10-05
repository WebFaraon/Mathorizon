/* Checks of the demo data (no browser): every teacher, every group, every student.
   - the figures add up (balances, totals, payments, salary due) and the console reads the register's balances;
   - an edit has the effect it should (marks, price, lessons, statuses, availability) and a reset clears it;
   - the data does not depend on the day: the same set is generated whatever the device clock says.
   Run: npm run check:demo */
global.window = { addEventListener() {} }; global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } }; global.document = { dispatchEvent() {} };
const path = require('path'); const root = path.join(__dirname, '..', 'js', 'admin');
require(path.join(root, 'mock-data.js')); require(path.join(root, 'registru-data.js'));
const D = window.AdminData;
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; if (fails.length < 25) fails.push(m); } };
const near = (a, b) => Math.abs(a - b) < 0.011;

let nRows = 0, nLessons = 0;
D.groups.forEach(g => {
  const L = D.ledger(g.id);
  let sumSold = 0, sumPaid = 0, sumCost = 0;
  L.rows.forEach(x => {
    nRows++;
    let cost = 0, done = 0;
    x.codes.forEach((c, i) => { if (c === 'P' || c === 'A') { cost += L.lessons[i].price; done++; } });
    ok(cost === x.cost, g.id + ' cost ' + x.s.id);
    ok(done === x.done, g.id + ' done ' + x.s.id);
    ok(x.sold === x.paid + x.disc - x.cost, g.id + ' sold formula ' + x.s.id);
    ok(x.s.balance === x.sold, g.id + ' console balance == register sold ' + x.s.id);
    ok(!x.codes.some(c => c && !'PGMAB'.includes(c)), g.id + ' unknown mark');
    ok(Number.isFinite(x.avail), g.id + ' avail NaN');
    sumSold += x.sold; sumPaid += x.paid; sumCost += x.cost;
    // the last three marks in the console come from the register
    const last = x.codes.filter(Boolean).slice(-3).map(c => (c === 'A' || c === 'B' ? 'a' : c === 'M' ? 'm' : 'p'));
    ok(last.every((m, k) => x.s.presence[3 - last.length + k] === m), g.id + ' presence ' + x.s.id);
  });
  ok(sumSold === L.stats.sold && sumPaid === L.stats.paid && sumCost === L.stats.cost, g.id + ' group sums');
  ok(near(L.earned, L.lessons.reduce((t, l) => t + l.pay, 0)), g.id + ' earned = sum of the lesson pays');
  L.lessons.forEach(l => { if (l.counted) { ok(l.pay >= 175 * L.dur, g.id + ' pay is never below 175/hour'); ok(l.pay <= 255 * L.dur, g.id + ' pay is never above 255/hour'); } else ok(l.pay === 0 && l.price === 0, g.id + ' an incomplete lesson has no sum'); });
  nLessons += L.lessons.length;
  ok(L.lessons.every((l, i) => l.i === i), g.id + ' lesson positions');
  ok(L.sum === L.lessons.reduce((t, l) => t + l.price, 0), g.id + ' price sum');
  // monthly rows add up to the group figures
  ok(L.months.reduce((t, m) => t + m.value, 0) === L.stats.cost, g.id + ' months value == cost');
  ok(L.months.reduce((t, m) => t + m.hours, 0) === L.stats.hours, g.id + ' months hours');
});

let teachersWithGroups = 0;
D.teachers.forEach(t => {
  const B = D.teacherBook(t.id);
  if (B.groups.length) teachersWithGroups++;
  const sum = k => B.groups.reduce((n, L) => n + L.stats[k], 0);
  ['P', 'A', 'M', 'G', 'B', 'paid', 'cost', 'disc', 'debt', 'adv', 'sold'].forEach(k => ok(B.totals[k] === sum(k), t.id + ' total ' + k));
  ok(near(B.earned, B.groups.reduce((n, L) => n + L.earned, 0)), t.id + ' earned total');
  ok(B.payments.reduce((n, p) => n + p.amount, 0) === B.paid, t.id + ' payments sum');
  ok(near(B.due, B.earned - B.paid) && B.due >= 0, t.id + ' due >= 0 and = earned - paid (' + B.due + ')');
  ok(B.groups.length === D.groups.filter(g => g.teacher === t.id).length, t.id + ' group count');
  // availability always covers the lessons (no teacher is outside his own hours)
  D.groups.filter(g => g.teacher === t.id && g.status !== 'inactiv').forEach(g => g.days.forEach(d => { if (!D.isAvailable(t.id, d, g.start, g.duration)) ok(false, t.id + ' lesson outside availability ' + g.id); }));
  ok(t.teach.length > 0 && t.subjects.length >= t.teach.length, t.id + ' teach/subjects');
});

// the pay scheme and the prices, as agreed
ok(D.rateBySize(1) === 608 && D.rateBySize(3) === 288, 'student prices: individual 608, three 288');
[[1, 1, 255], [1, 0, 175], [3, 1, 175], [3, 2, 218], [3, 3, 255], [3, 0, 175], [6, 1, 175], [6, 2, 175], [6, 3, 175], [6, 4, 175], [6, 5, 218], [6, 6, 255], [6, 0, 175], [2, 1, 218], [2, 2, 255]]
  .forEach(([size, present, pay]) => ok(D.lessonPay(size, present) === pay, 'pay for size ' + size + ' with ' + present + ' present = ' + pay + ' (got ' + D.lessonPay(size, present) + ')'));
// edits: each mark has the effect it should
const g = 'g080', L0 = D.ledger(g); const x0 = L0.rows.find(r => r.codes.some((c, i) => c === 'P'));
const i0 = x0.codes.findIndex(c => c === 'P'); const oid = L0.lessons[i0].oid; const price = L0.lessons[i0].price;
const soldOf = () => D.ledger(g).rows.find(r => r.s.id === x0.s.id).sold;
const base = soldOf();
D.setMark(g, x0.s.id, oid, 'M'); ok(soldOf() === base + price, 'M frees the lesson'); ok(x0.s.balance === base + price, 'console balance follows the register');
D.setMark(g, x0.s.id, oid, 'B'); ok(soldOf() === base + price, 'B is free');
D.setMark(g, x0.s.id, oid, 'G'); ok(soldOf() === base + price, 'G is free');
D.setMark(g, x0.s.id, oid, 'A'); ok(soldOf() === base, 'A is charged');
D.setMark(g, x0.s.id, oid, ''); ok(soldOf() === base + price, 'empty is free');
D.setMark(g, x0.s.id, oid, 'P'); ok(soldOf() === base, 'P is charged');
const rate0 = D.ledger(g).rate; D.setRate(g, rate0 + 10); ok(D.ledger(g).rate === rate0 + 10 && soldOf() < base, 'raising the rate raises the cost'); D.setRate(g, 0); ok(D.ledger(g).rate === rate0, 'rate back');
const n0 = D.ledger(g).lessons.length;
const earn0 = D.ledger(g).earned, hours0 = D.ledger(g).stats.hours, cost0 = D.ledger(g).stats.cost, sum0 = D.ledger(g).sum;
  D.addLesson(g); ok(D.ledger(g).lessons.length === n0 + 1 && D.ledger(g).lessons.slice(-1)[0].label === 'Alege data', 'added lesson has no date');
  { const nl = D.ledger(g).lessons.slice(-1)[0]; ok(!nl.counted && nl.price === 0 && nl.pay === 0, 'an added lesson shows no sum'); D.setMark(g, x0.s.id, nl.oid, 'P');
    ok(D.ledger(g).earned === earn0 && D.ledger(g).stats.hours === hours0 && D.ledger(g).stats.cost === cost0 && D.ledger(g).sum === sum0, 'an incomplete lesson adds nothing: not to the cost, the hours, the pay');
    D.setLesson(g, nl.oid, { d: '2026-10-12' }); ok(!D.ledger(g).lessons.slice(-1)[0].counted, 'a date alone is not enough');
    D.setLesson(g, nl.oid, { t: 'Tema' }); { const c = D.ledger(g).lessons.slice(-1)[0]; ok(c.counted && c.price > 0 && c.pay >= 175 && D.ledger(g).earned > earn0 && D.ledger(g).stats.cost > cost0 && D.ledger(g).stats.hours === hours0 + D.ledger(g).dur, 'date and title together make it count (price ' + c.price + ', pay ' + c.pay + ')'); }
    D.setLesson(g, nl.oid, { t: '  ' }); ok(!D.ledger(g).lessons.slice(-1)[0].counted && D.ledger(g).earned === earn0, 'clearing the title takes it out again');
    D.setLesson(g, nl.oid, { t: 'Tema' }); D.setMark(g, x0.s.id, nl.oid, ''); }
const nl = D.ledger(g).lessons.slice(-1)[0]; D.setLesson(g, nl.oid, { d: '2026-10-12' }); ok(D.ledger(g).lessons.slice(-1)[0].label === '12 octombrie', 'date set');
D.removeLesson(g, nl.oid); ok(D.ledger(g).lessons.length === n0, 'added lesson removed');
D.removeLesson(g, L0.lessons[1].oid); const L2 = D.ledger(g); ok(L2.lessons.length === n0 - 1 && L2.lessons.every((l, i) => l.i === i), 'generated lesson removed, positions renumbered');
ok(L2.rows.every((r, k) => r.codes.length === L2.lessons.length), 'codes follow the lessons');
D.setStudentStatus(x0.s.id, 'transferat'); ok(D.students.find(s => s.id === x0.s.id).status === 'transferat', 'student status');
D.setStudentManager(x0.s.id, 'm3'); ok(D.ledger(g).rows.find(r => r.s.id === x0.s.id).manager.id === 'm3', 'manager');
D.setGroup(g, { subject: 'Fizica', grade: 'IX', level: '8-9', profile: 'Uman', size: 4, status: 'inlocuire' });
const G = D.group(g); ok(G.subject === 'Fizica' && G.grade === 'IX' && G.level === '8-9' && G.profile === 'Uman' && G.size === 4 && G.status === 'inlocuire', 'group fields');
ok(D.teacher(G.teacher).subjects.includes('Fizica'), 'teacher subjects follow the group');
// availability
const t = D.teacher('t5'); const av = JSON.parse(JSON.stringify(t.availability)); av[1] = [[8, 22]]; D.setAvailability('t5', av);
ok(D.isAvailable('t5', 1, 21, 1), 'hour 21 available'); ok(D.teacherEdited('t5'), 'teacher edited flag');
D.setTeach('t5', [{ subject: 'Matematica', grades: ['V'] }, { subject: 'Chimie', grades: ['X'] }]); ok(D.teacher('t5').subjects.includes('Chimie'), 'new subject');
// the whole thing survives a reload (a second copy of the code reading the same store) and a reset clears it all
const saved = localStorage._s; const keep = JSON.stringify(saved);
ok(Object.keys(JSON.parse(Object.values(saved)[0])).sort().join() === 'groups,ledger,students,teachers', 'what is stored: ' + Object.keys(JSON.parse(Object.values(saved)[0])).join());
D.reset();
ok(D.group(g).subject === 'Matematica' && D.group(g).status !== 'inlocuire', 'reset: group');
ok(D.students.find(s => s.id === x0.s.id).status !== 'transferat', 'reset: student status');
ok(D.ledger(g).lessons.length === n0 && soldOf() === base, 'reset: ledger and balance');
ok(!D.teacherEdited('t5') && !D.teacher('t5').subjects.includes('Chimie'), 'reset: teacher');

// transfers: the student moves, the old column stays (status Transferat, money kept), nobody is duplicated
{
  const src = D.groups.find(x => D.enrolled(x).length >= 2 && x.status === 'activ' && D.transferCandidates([D.enrolled(x)[0].id]).some(c => c.fits));
  const who = D.enrolled(src)[0], sid = who.id, dest = D.transferCandidates([sid]).find(c => c.fits).g;
  const people0 = D.students.length, old0 = D.ledger(src.id).rows.find(r => r.s.id === sid), cols0 = D.ledger(dest.id).rows.length, enrDest0 = D.enrolled(dest).length, enrSrc0 = D.enrolled(src).length;
  ok(D.transferCandidates([sid]).every(c => c.g.subject === src.subject && c.g.grade === src.grade && c.g.status !== 'inactiv' && c.g.id !== src.id), 'candidates: same subject and grade, open, not the same group');
  ok(D.transferCandidates([sid]).filter(c => c.fits).every(c => c.free >= 1), 'candidates: fits means room');
  const ids = D.transfer([sid], dest.id);
  const L1 = D.ledger(src.id), L2 = D.ledger(dest.id), o1 = L1.rows.find(r => r.s.id === sid), n1 = L2.rows.find(r => r.s.id === sid);
  ok(ids.length === 1 && who.group === dest.id && who.status === 'activ', 'transfer: student is in the new group, Activ');
  ok(D.students.length === people0, 'transfer: nobody is duplicated');
  ok(o1 && o1.status === 'transferat' && o1.leave && o1.to && o1.to.id === dest.id, 'transfer: old column says Transferat');
  ok(o1.paid === old0.paid && o1.cost === old0.cost && o1.sold === old0.sold && o1.codes.join() === old0.codes.join(), 'transfer: old column keeps marks and money');
  ok(n1 && n1.status === 'activ' && n1.join && n1.from && n1.from.id === src.id && n1.paid === 0 && n1.codes.every(c => !c), 'transfer: new column is Activ and starts empty');
  ok(L2.rows.length === cols0 + 1 && D.enrolled(dest).length === enrDest0 + 1 && D.enrolled(src).length === enrSrc0 - 1, 'transfer: seats move');
  ok(L1.stats.moved >= 1 && L1.rows.length === (D.baseMembers(src.id).length), 'transfer: old group keeps every column');
  ok(who.balance === o1.sold + n1.sold, 'transfer: console balance is the sum of his columns');
  ok(D.transferCandidates([sid]).every(c => c.g.id !== src.id), 'transfer: cannot go back to a group he was in');
  const nl = (D.addLesson(dest.id, '2026-10-12'), D.ledger(dest.id).lessons.slice(-1)[0]);
  D.setLesson(dest.id, nl.oid, { t: 'Tema noua' });
  D.setMark(dest.id, sid, nl.oid, 'P'); D.setMark(src.id, sid, D.ledger(src.id).lessons[0].oid, 'M');
  const n2 = D.ledger(dest.id).rows.find(r => r.s.id === sid);
  ok(n2.codes[n2.codes.length - 1] === 'P' && n2.cost > 0, 'transfer: a new lesson can be marked in the new group');
  ok(n2.codes.slice(0, -1).every(c => !c) && n2.lock.slice(0, -1).every(Boolean), 'transfer: lessons before the transfer stay closed in the new group');
  D.addLesson(src.id, '2026-10-12'); const sl = D.ledger(src.id).lessons.slice(-1)[0]; D.setLesson(src.id, sl.oid, { t: 'X' }); D.setMark(src.id, sid, sl.oid, 'P');
  ok(D.ledger(src.id).rows.find(r => r.s.id === sid).codes.slice(-1)[0] === '', 'transfer: a lesson after the transfer cannot be marked in the old group');
  const undo = D.undoTransfer(ids);
  ok(undo === 1 && who.group === src.id && who.status === 'activ' && D.ledger(dest.id).rows.length === cols0, 'undo: back in the old group, column gone');
  D.transfer([sid], dest.id); D.reset();
  ok(who.group === src.id && !Object.keys(D.sync.edits()).length, 'reset clears transfers');
}

console.log(`DATA: ${pass} checks passed, ${fail} failed | ${D.groups.length} groups, ${nRows} student columns, ${nLessons} lessons, ${D.teachers.length} teachers (${teachersWithGroups} with groups)`);
fails.forEach(f => console.log('  FAIL', f));

// the same data on any day (the demo's today is fixed in js/admin/mock-data.js)
const code = require('fs').readFileSync(path.join(root, 'mock-data.js'), 'utf8') + require('fs').readFileSync(path.join(root, 'registru-data.js'), 'utf8');
const printOnDay = day => {
  const RealDate = Date, fake = new RealDate(day).getTime();
  global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fake); } static now() { return fake; } };
  global.window = { addEventListener() {} }; global.document = { dispatchEvent() {} };
  new Function(code)();
  const E = window.AdminData; const s = E.students.map(x => x.name + x.balance + x.presence.join('')).join() + E.groups.map(g => { const L = E.ledger(g.id); return g.id + L.sum + L.earned + L.lessons.length; }).join();
  global.Date = RealDate; delete global.window; return s.length + ':' + s.slice(0, 40) + s.slice(-40);
};
const days = ['2026-10-05T09:00:00', '2026-10-06T00:00:30', '2026-12-24T23:59:59', '2027-06-01T12:00:00'].map(printOnDay);
if (days.every(x => x === days[0])) pass++; else { fail++; console.log('  FAIL the demo data changes with the device date'); }
console.log('DAY:', days.every(x => x === days[0]) ? 'same data on 4 different days' : 'DIFFERENT data on different days');
process.exit(fail ? 1 : 0);
