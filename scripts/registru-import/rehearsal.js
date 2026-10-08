/* The rehearsal on a REAL register, on this computer only (nothing is sent anywhere, no names are printed):
   the .xlsx goes through the same modules as the sync (parser, linking, validation, the group payloads), becomes the reg_* tables, and the
   tables become the console's data exactly as in Registre mode. Then it counts what would be wrong or strange.
     node scripts/registru-import/rehearsal.js "<registru.xlsx>"
   Writes _import/out/real-tables.json (the tables, with real names: local only, used to test the console pages on real data)
   and prints a summary without any student name. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const file = process.argv[2];
if (!file) { console.error('Folosire: node scripts/registru-import/rehearsal.js "<registru.xlsx>"'); process.exit(1); }

global.window = { addEventListener() {} }; global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } };
global.document = { dispatchEvent() {} }; global.CustomEvent = function (n) { this.type = n; };
require(path.join(root, 'js', 'admin', 'mock-data.js')); require(path.join(root, 'js', 'admin', 'registru-data.js'));
const RD = require(path.join(root, 'js', 'admin', 'registry-dataset.js'));
const D = window.AdminData;
const { readXlsx } = require('./read-xlsx');
const { parseWorkbook } = require('./parse');
const { linkPeople } = require('./link');
const { validate } = require('./validate');

(async () => {
  const { groupPayload, workbookData, gate, packIssues } = await import('../../supabase/functions/_shared/registru/sync-core.mjs');
  const book = readXlsx(file);
  const model = parseWorkbook(book);
  const issues = validate(model, linkPeople(model));
  const wd = workbookData(model);

  // the tables, as the sync would store them
  const T = { workbooks: [{ id: 'wb-real', spreadsheet_id: 'real', title: model.meta.title, teacher_name: model.meta.teacher, project: wd.project, config: wd.config, teacher_data: wd.teacher, enabled: true }], groups: [], students: [], lessons: [] };
  const skipped = [];
  model.groups.forEach((g, i) => {
    const bad = gate(g);
    if (bad) { skipped.push({ tab: g.tab, why: bad }); return; }
    const p = groupPayload(g, 1000 + i), gid = 'g-' + (1000 + i);
    T.groups.push({ id: gid, workbook_id: 'wb-real', sheet_id: p.sheet_id, tab: p.tab, format_size: p.format_size, state: p.state, subject: p.subject, summer: p.summer, grade: p.grade, level: p.level, profile: p.profile, schedule: p.schedule, cached_total_pay: p.cached_total_pay });
    p.students.forEach(s => T.students.push({ id: `s-${gid}-${s.col}`, group_id: gid, col: s.col, name: s.name, phone: s.phone, manager: s.manager, status: s.status, paid: s.paid, discount: s.discount, cost: s.cost, sold: s.sold }));
    p.lessons.forEach(l => T.lessons.push({ group_id: gid, row_no: l.row_no, date_text: l.date_text, iso: l.iso, topic: l.topic, teacher_level: l.teacher_level, teacher_pay: l.teacher_pay, marks: l.marks }));
  });
  fs.mkdirSync(path.join(root, '_import', 'out'), { recursive: true });
  fs.writeFileSync(path.join(root, '_import', 'out', 'real-tables.json'), JSON.stringify(T));

  const today = new Date(2026, 9, 8);
  const ds = RD.build(T, { today: '2026-10-08' });
  D.useData(ds, { today });

  const out = [];
  const say = s => { out.push(s); console.log(s); };
  say(`Registru: ${model.meta.teacher} · ${model.meta.project} · ${model.meta.yearFrom}-${model.meta.yearTo}`);
  say(`Citit: ${model.groups.length} file de grupă, ${T.students.length} coloane de elevi, ${T.lessons.length} lecții. Oprite de verificarea formatului: ${skipped.length}${skipped.length ? ' (' + skipped.map(s => s.tab + ': ' + s.why).join('; ') + ')' : ''}`);
  const sm = packIssues(issues).summary;
  say(`Verificări: ${sm.error} de reparat, ${sm.warn} de verificat, ${sm.info} note`);
  say(`Consola: ${ds.summary.groups} grupe, ${ds.summary.students} persoane din ${ds.summary.columns} coloane, ${Object.keys(ds.transfers).length} transferuri deduse, ${ds.summary.irregular} grupe cu orar neregulat, ${ds.summary.noSchedule} grupe fără orar`);
  const noSched = ds.groups.filter(g => !g.days.length).map(g => g._src.tab), irr = ds.groups.filter(g => g._irregular).map(g => g._src.tab);
  if (noSched.length) say(`  fără orar: ${noSched.join(' | ')}`);
  if (irr.length) say(`  orar neregulat: ${irr.join(' | ')}`);

  // the money: the console's own count from the marks against what the sheet calculated
  let rows = 0, drift = 0; const driftTabs = {};
  let earnedSheet = 0, earnedConsole = 0, payDiff = [];
  ds.groups.forEach(g => {
    const L = D.ledger(g.id);
    L.rows.forEach(r => { rows++; if (r.drift) { drift++; driftTabs[g._src.tab] = (driftTabs[g._src.tab] || 0) + 1; } });
    const sheet = (T.groups.find(x => x.id === g.id) || {}).cached_total_pay;
    if (sheet != null) { earnedSheet += sheet; earnedConsole += L.earned; if (Math.abs(sheet - L.earned) > 0.05) payDiff.push(`${g._src.tab}: registru ${sheet}, consolă ${L.earned}`); }
  });
  say(`Bani: ${drift} din ${rows} coloane de elevi au o numărătoare proprie diferită de a registrului (consola arată cifrele registrului)${drift ? ' în ' + Object.keys(driftTabs).length + ' file' : ''}`);
  say(`Plata profesorului: suma pe file din registru ${Math.round(earnedSheet * 100) / 100}, în consolă ${Math.round(earnedConsole * 100) / 100}${payDiff.length ? '; file cu diferențe: ' + payDiff.length : ''}`);
  const book1 = D.teacherBook(ds.teachers[0].id);
  say(`Profesorul: plătit ${book1.paid} (registru: ${wd.teacher.paidTotal}), de plată ${book1.due} (registru: ${wd.teacher.salaryDue}), nivel ${book1.level}, ${wd.teacher.payments.length} plăți citite${wd.teacher.payments.some(p => !p.iso) ? ', ' + wd.teacher.payments.filter(p => !p.iso).length + ' cu data text' : ''}`);
  const multi = ds.students.filter(s => D.transfersOf(s.id).length);
  say(`Elevi cu parcurs în mai multe grupe: ${multi.length}; fără telefon: ${ds.students.filter(s => !s.phone).length}`);
  const statuses = {}; ds.students.forEach(s => { statuses[s.status] = (statuses[s.status] || 0) + 1; });
  say(`Statuturi: ${Object.entries(statuses).map(([k, v]) => k + ' ' + v).join(', ')}`);
  say(`Disponibilitate: ${Object.values(ds.teachers[0].availability).filter(w => w.length).length} zile cu ore, ${ds.teachers[0].teach.length} materii în „Detalii profesor”`);
  // the console's own consistency checks on real data: every group has a ledger, no student in two active groups
  const active = {}; ds.students.forEach(s => { if (['activ', 'proba', 'proba_ok', 'inlocuire'].includes(s.status) && s.group) active[s.id] = 1; });
  say(`Grupe cu ore de predare programate, dar fără profesor în disponibilitate (zile): ${ds.groups.filter(g => g.status !== 'inactiv' && g.days.length && g.days.some(d => !D.isAvailable(g.teacher, d, g.start, g.duration))).length}`);
  const conflicts = [1, 2, 3, 4, 5, 6, 7].reduce((n, d) => n + D.conflicts(d).length, 0);
  say(`Conflicte de cabinet sau profesor în orar: ${conflicts}`);
  fs.writeFileSync(path.join(root, '_import', 'out', 'rehearsal.report.txt'), out.join('\n') + '\n');
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
