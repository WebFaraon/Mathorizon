/* The rehearsal for real data: the console built from the Google Sheets registers must show exactly what the demo console shows,
   because the 27 demo registers were written from the demo data. Same groups, schedules, students, marks, money, teacher pay.
   Input: _import/demo/snapshot.json (the tables as the sync stores them: node scripts/registru-import/google/sync-local.js --save).
   It stays out of git, so on a machine without it this check is skipped.
   Run: npm run check:registry */
'use strict';
const fs = require('fs');
const path = require('path');
const snapFile = path.join(__dirname, '..', '_import', 'demo', 'snapshot.json');
const linksFile = path.join(__dirname, '..', '_import', 'demo', 'links.json');
if (!fs.existsSync(snapFile) || !fs.existsSync(linksFile)) { console.log('REGISTRY: skipped (no _import/demo/snapshot.json: run sync-local.js --save first)'); process.exit(0); }

global.window = { addEventListener() {} }; global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } };
global.document = { dispatchEvent() {} }; global.CustomEvent = function (n) { this.type = n; };
const root = path.join(__dirname, '..', 'js', 'admin');
require(path.join(root, 'mock-data.js')); require(path.join(root, 'registru-data.js'));
const RD = require(path.join(root, 'registry-dataset.js'));
const D = window.AdminData;
const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
const links = JSON.parse(fs.readFileSync(linksFile, 'utf8'));

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; if (fails.length < 30) fails.push(m); } };
const near = (a, b) => Math.abs(a - b) < 0.011;
const status = s => (s === 'instabil' ? 'activ' : s);                 // the registers have no "instabil": the demo wrote it as Activ

// demo group id -> the id the registry dataset gives it
const regId = {}; Object.keys(links.teachers).forEach(tid => links.teachers[tid].groups.forEach(g => { regId[g.id] = `g-${tid}-${g.gid}`; }));
const tName = {}; D.teachers.forEach(t => { tName[t.id] = t.name; });

/* what the demo console shows, written down before the source is switched */
function observe(gid) {
  const g = D.group(gid), L = D.ledger(gid);
  const room = g.room ? D.room(g.room).num : null;
  return {
    props: { days: g.days.join(), start: g.start, duration: g.duration, room, status: g.status, size: g.size, subject: g.subject, grade: g.grade, profile: g.profile || null, level: g.level, project: g.project, regime: g.regime, teacher: (D.teacher(g.teacher) || {}).name },
    lessons: L.lessons.map(l => ({ iso: l.iso, topic: l.topic, counted: l.counted, price: l.price, pay: l.pay, paying: l.paying })),
    rows: L.rows.map(r => ({ name: r.s.name, phone: r.s.phone, status: status(r.status), codes: r.codes.join(','), paid: r.paid, disc: r.disc, cost: r.cost, sold: r.sold, slot: r.slot })),
    earned: L.earned, stats: { P: L.stats.P, A: L.stats.A, M: L.stats.M, G: L.stats.G, B: L.stats.B, cost: L.stats.cost, sold: L.stats.sold, paid: L.stats.paid, disc: L.stats.disc }
  };
}
const demo = {};
D.groups.forEach(g => { if (regId[g.id]) demo[g.id] = observe(g.id); });
const demoBook = {};
D.teachers.forEach(t => { if (links.teachers[t.id]) { const b = D.teacherBook(t.id); demoBook[t.id] = { earned: b.earned, paid: b.paid, due: b.due, hours: b.totals.hours, P: b.totals.P, cost: b.totals.cost, sold: b.totals.sold, level: b.level }; } });
const demoTeach = {}; D.teachers.forEach(t => { if (links.teachers[t.id]) demoTeach[t.id] = { teach: JSON.stringify(t.teach), avail: JSON.stringify(Object.fromEntries(Object.entries(t.availability).map(([d, w]) => [d, w.filter(([a, b]) => b > 9).map(([a, b]) => [Math.max(a, 9), b])]))) }; });
const demoGroups = D.groups.length;

/* the switch */
const ds = RD.build(snap, { today: '2026-10-05' });
ok(ds.summary.groups === Object.keys(demo).length && ds.summary.workbooks === Object.keys(links.teachers).length, 'the dataset has every group and register: ' + JSON.stringify(ds.summary));
ok(ds.summary.noSchedule === 0 && ds.summary.irregular === 0, 'every group has a regular schedule');
D.useData(ds, { today: new Date(2026, 9, 5) });
ok(D.readOnly() && D.registry === ds, 'registry mode is on');
ok(D.groups.length === ds.groups.length && D.students.length === ds.students.length, 'the console arrays hold the registers data');

/* what the registry console shows */
const tIdOf = {}; Object.keys(links.teachers).forEach(tid => { tIdOf[tid] = ds.teachers.find(t => t.name === links.teachers[tid].name).id; });
Object.keys(demo).forEach(gid => {
  const A = demo[gid], id = regId[gid];
  const g = D.group(id);
  if (!g) { ok(false, 'group missing in registry mode: ' + gid); return; }
  const B = observe(id);
  Object.keys(A.props).filter(k => k !== 'project').forEach(k => ok(String(A.props[k]) === String(B.props[k]), `${gid} ${k}: demo ${A.props[k]}, registers ${B.props[k]}`));
  ok(A.lessons.length === B.lessons.length, `${gid} lesson count ${A.lessons.length} vs ${B.lessons.length}`);
  A.lessons.forEach((l, i) => {
    const m = B.lessons[i]; if (!m) return;
    // The registers carry no year. The demo runs past August 2026 (the end of the 2025-2026 school year the registers are named after): a group that
    // STARTS in September 2026 has its first lessons put one year back, as the title's school year says. A real register covers one school year.
    const sameDay = l.iso === m.iso || (l.iso >= '2026-09-01' && m.iso === '2025' + l.iso.slice(4));
    ok(sameDay && l.topic === m.topic && l.counted === m.counted && l.price === m.price, `${gid} lesson ${i}: ${JSON.stringify(l)} vs ${JSON.stringify(m)}`);
    ok(near(l.pay, m.pay) && l.paying === m.paying, `${gid} lesson ${i} pay ${l.pay}/${l.paying} vs ${m.pay}/${m.paying}`);
  });
  ok(A.rows.length === B.rows.length, `${gid} students ${A.rows.length} vs ${B.rows.length}`);
  A.rows.forEach((r, i) => {
    const m = B.rows.find(x => x.name === r.name && x.phone === r.phone);
    if (!m) { ok(false, `${gid} student missing: ${r.name}`); return; }
    ok(r.codes === m.codes && near(r.paid, m.paid) && near(r.disc, m.disc) && near(r.cost, m.cost) && near(r.sold, m.sold), `${gid} ${r.name}: marks or money differ`);
    ok(r.slot === m.slot, `${gid} ${r.name}: column ${r.slot} vs ${m.slot}`);
  });
  ok(near(A.earned, B.earned), `${gid} earned ${A.earned} vs ${B.earned}`);
  Object.keys(A.stats).forEach(k => ok(near(A.stats[k], B.stats[k]), `${gid} stat ${k} ${A.stats[k]} vs ${B.stats[k]}`));
  // the sheet's own cost and sold agree with what the console computed from the marks (a difference = a rule that is not the sheet's)
  ds.ledger(id).cols.forEach(c => {
    const r = D.ledger(id).rows.find(x => x.s === c.s);
    ok(r && near(c.sheetCost, r.cost) && near(c.sheetSold, r.sold), `${gid} ${c.s.name}: the sheet says cost ${c.sheetCost}, sold ${c.sheetSold}; the console computes ${r && r.cost}, ${r && r.sold}`);
  });
});

/* teachers: pay, hours, availability, what they teach */
Object.keys(demoBook).forEach(tid => {
  const t = D.teacher(tIdOf[tid]), b = D.teacherBook(t.id), A = demoBook[tid];
  ok(near(A.earned, b.earned) && near(A.hours, b.totals.hours) && near(A.cost, b.totals.cost) && near(A.sold, b.totals.sold) && A.P === b.totals.P, `${tid} ${t.name}: totals differ`);
  ok(A.level === b.level, `${tid} level ${A.level} vs ${b.level}`);
  // the payments come from the Total tab: the register holds 30 rows, the demo generated more for two teachers
  const sheetPaid = ds.teacherInfo[t.id].sheet.paidTotal;
  ok(near(sheetPaid, b.paid), `${tid} paid: the sheet says ${sheetPaid}, the console shows ${b.paid}`);
  if (near(A.paid, b.paid)) ok(near(A.due, b.due), `${tid} due`);
  else ok(links.teachers[tid].name === 'Matvei Iana' || links.teachers[tid].name === 'Sîrbu Victor', `${tid} ${t.name}: paid ${A.paid} vs ${b.paid} (only the registers with more than 30 payments may differ)`);
  const a = JSON.stringify(Object.fromEntries(Object.entries(t.availability).map(([d, w]) => [d, w.filter(([x, y]) => y > 9).map(([x, y]) => [Math.max(x, 9), y])])));
  ok(a === demoTeach[tid].avail, `${tid} availability`);
  ok(JSON.stringify(t.teach) === demoTeach[tid].teach, `${tid} teach table`);
});

/* a person in several groups keeps his journey */
const multi = ds.students.filter(s => D.transfersOf(s.id).length);
ok(multi.length === 3, 'three students with a past in several groups: ' + multi.length);
multi.forEach(s => { const j = D.journey(s.id); ok(j && j.chapters.length >= 2, `${s.name}: the journey has chapters`); });

/* read only: nothing writes */
const before = JSON.stringify(D.group(ds.groups[0].id));
D.move(ds.groups[0].id, { start: 3 }); D.setStatus(ds.groups[0].id, 'inactiv'); D.setStudentStatus(ds.students[0].id, 'inactiv'); D.setMark(ds.groups[0].id, ds.students[0].id, 0, 'P'); D.setAvailability(ds.teachers[0].id, {});
ok(JSON.stringify(D.group(ds.groups[0].id)) === before, 'a write in registry mode changes nothing');
ok(D.transfer([ds.students[0].id], ds.groups[1].id).length === 0 && D.enrolStudent({}) === null, 'transfer and enrolment are blocked');

/* back to the demo */
D.useDemo();
ok(!D.readOnly() && D.groups.length === demoGroups, 'back to the demo data');
const again = {}; D.groups.forEach(g => { if (regId[g.id]) again[g.id] = observe(g.id); });
ok(JSON.stringify(again) === JSON.stringify(demo), 'the demo console is exactly what it was before the switch');

console.log(`REGISTRY: ${pass} checks passed, ${fail} failed | ${ds.summary.groups} groups, ${ds.summary.students} people from ${ds.summary.columns} columns`);
if (fail) { console.log(fails.join('\n')); process.exit(1); }
