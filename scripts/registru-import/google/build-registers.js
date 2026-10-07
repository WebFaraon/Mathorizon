/* Builds the demo registers in Google Sheets: one workbook per teacher, one tab per group, every tab a duplicate of the clean template
   tab (same colours, dropdown chips, validations, formulas), filled with the console's demo people. Only INPUT cells are written
   (format, state, subject, class, level, schedule, student headers, payments, manager, status, dates, topics, marks, teacher level);
   the sheet's own formulas calculate the rest.
     node scripts/registru-import/google/build-registers.js --template <spreadsheetId> --folder <folderId> [--only t26] [--limit 3]
   Writes _import/demo/links.json (kept between runs: teachers already built are skipped) and js/admin/sheet-links.js (group -> workbook + tab). */
'use strict';
const fs = require('fs');
const path = require('path');
const { api } = require('./auth');
const { allTeachers, D } = require('../demo-group');
const { colLetter } = require('../parse');

const args = process.argv.slice(2);
const opt = k => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : null);
const TEMPLATE = opt('template'), FOLDER = opt('folder'), ONLY = opt('only'), LIMIT = +(opt('limit') || 0);
if (!TEMPLATE || !FOLDER) { console.error('Folosire: build-registers.js --template <idSablon> --folder <idFolder> [--only t26] [--limit 3]'); process.exit(1); }

const ROOT = path.join(__dirname, '..', '..', '..');
const STATE_FILE = path.join(ROOT, '_import', 'demo', 'links.json');
const LINKS_JS = path.join(ROOT, 'js', 'admin', 'sheet-links.js');
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets/';
const U = { who: 'user' };

const STATE = { activ: 'Activ', completare: 'Se completează', inactiv: 'Inactiv', inlocuire: 'Înlocuire' };
const STATUS = { activ: 'Activ', instabil: 'Activ', proba: 'Oră de probă', proba_ok: 'Oră de probă confirmată', transferat: 'Transferat', inactiv: 'Inactiv', inlocuire: 'Înlocuire' };
const MARK = { P: 'PREZENT', A: 'ABSENT', M: 'ABSENT MOTIVAT', G: 'PRIMA LECȚIE GRATUITĂ', B: 'ABSENT PRIMA LECȚIE GRATUITĂ' };
const MONTH = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
const q = t => "'" + t.replace(/'/g, "''") + "'";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function lists() {
  const r = await api('GET', `${SHEETS}${TEMPLATE}/values:batchGet?ranges=CONFIGURARI!B2:B100&ranges=CONFIGURARI!K2:K100&ranges=CONFIGURARI!G2:G100&ranges=CONFIGURARI!H2:H100`, U);
  const col = i => (r.valueRanges[i].values || []).map(x => x[0]).filter(Boolean);
  return { manager: new Set(col(0)), cabinet: new Set(col(1)), state: new Set(col(2)), status: new Set(col(3)) };
}

/* the cells to write for one group tab, as value ranges */
function fill(title, d, cfg, report) {
  const g = d.group, raw = [], formulas = [];
  const R = (a1, values) => raw.push({ range: `${q(title)}!${a1}`, values });
  R('A1', [[g.size === 1 ? 'Individual 1 elev' : `Grup cu ${g.size} elevi`]]);
  const state = STATE[g.status] || 'Activ';
  R('A3:A7', [[cfg.state.has(state) ? state : 'Activ'], [g.subject], [g.grade], [g.level.replace('-', ' ― ')], [g.profile || 'Profilul']]);
  d.schedule.slice(0, 6).forEach((s, i) => {
    R(`AA${2 + i}:AC${2 + i}`, [[s.day, s.hour / 24, s.room && cfg.cabinet.has(s.room) ? s.room : '']]);
    if (s.room && !cfg.cabinet.has(s.room)) report.cabinet++;
  });
  const n = d.students.length;
  if (n) {
    const last = colLetter(3 + n);
    R(`D1:${last}1`, [d.students.map(s => `${s.name}${s.phone || ''}`)]);
    R(`D7:${last}8`, [d.students.map(s => (s.manager && cfg.manager.has(s.manager) ? s.manager : '')), d.students.map(s => STATUS[s.status] || 'Activ')]);
    d.students.forEach(s => { if (s.manager && !cfg.manager.has(s.manager)) report.manager++; });
    formulas.push({ range: `${q(title)}!D3:${last}4`, values: [d.students.map(s => `=SUM(${s.paid})`), d.students.map(s => `=SUM(${s.disc})`)] });
  }
  R('AA9:AA198', Array.from({ length: 190 }, () => ['Nivelul Profesorului ' + d.teacherLevel]));
  if (d.lessons.length) {
    const rows = d.lessons.length;
    R(`A9:B${8 + rows}`, d.lessons.map(l => { const [, m, day] = l.iso.split('-').map(Number); return [`${day} ${MONTH[m - 1]}`, l.topic]; }));
    if (n) R(`D9:${colLetter(3 + n)}${8 + rows}`, d.lessons.map(l => l.marks.map(c => (c ? MARK[c] : ''))));
  }
  return { raw, formulas };
}

/* the general tabs of a teacher's workbook: payments to the teacher and the tabs the totals add up; availability, subjects and classes */
const GRADES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
function general(t, titles, report) {
  const raw = [], book = D.teacherBook(t.id), tch = D.teacher(t.id);
  const payments = book.payments.slice(0, 30);
  if (book.payments.length > 30) report.payments = book.payments.length;
  if (payments.length) raw.push({ range: `'Total achitări'!A3:B${2 + payments.length}`, values: payments.map(p => [p.label, p.amount]) });
  raw.push({ range: `'Total achitări'!F4:${colLetter(5 + Math.min(30, titles.length))}4`, values: [titles.slice(0, 30)] });
  const vara = D.groups.filter(g => g.teacher === t.id && g.regime === 'vara' && g.status !== 'inactiv');
  [['Disponibilitate', false], ['Disponibilitate Vara', true]].forEach(([tab, summer]) => {
    const grid = [];
    for (let h = 9; h <= 21; h++) grid.push([1, 2, 3, 4, 5, 6, 7].map(day => (summer && vara.some(g => g.days.includes(day) && g.start <= h && h < g.start + g.duration) ? 'Ocupat' : D.isAvailable(t.id, day, h, 1) ? 'Disponibil' : '')));
    raw.push({ range: `'${tab}'!B2:H14`, values: grid });
    const rows = [];
    for (let i = 0; i < 12; i++) { const e = tch.teach[i]; rows.push([e ? e.subject + (summer ? ' (Vara)' : '') : ''].concat(GRADES.map(g => !!(e && e.grades.includes(g))))); }
    raw.push({ range: `'${tab}'!J3:V14`, values: rows });
  });
  return raw;
}

async function build(t, cfg, template, links) {
  const names = new Set();
  const titles = t.groups.map(d => { let nm = d.group.tab.slice(0, 95), k = 1; while (names.has(nm)) nm = d.group.tab.slice(0, 90) + ' (' + (++k) + ')'; names.add(nm); return nm; });
  const file = await api('POST', `https://www.googleapis.com/drive/v3/files/${TEMPLATE}/copy?supportsAllDrives=true`, Object.assign({ body: { name: `${t.name} Registru EXAMEN.MD OFFLINE 2025-2026 (DEMO)`, parents: [FOLDER] } }, U));
  const ssid = file.id;
  const meta = await api('GET', `${SHEETS}${ssid}?fields=sheets.properties(title,sheetId)`, U);
  const base = meta.sheets.map(s => s.properties).find(p => p.title === 'Orar 1');
  const requests = [];
  for (let i = 1; i < t.groups.length; i++) requests.push({ duplicateSheet: { sourceSheetId: base.sheetId, newSheetName: titles[i], insertSheetIndex: i + 3 } });
  requests.push({ updateSheetProperties: { properties: { sheetId: base.sheetId, title: titles[0] }, fields: 'title' } });
  const res = await api('POST', `${SHEETS}${ssid}:batchUpdate`, Object.assign({ body: { requests } }, U));
  const gids = [base.sheetId].concat(res.replies.filter(r => r.duplicateSheet).map(r => r.duplicateSheet.properties.sheetId));
  const report = { cabinet: 0, manager: 0 };
  const rawAll = [], formAll = [];
  t.groups.forEach((d, i) => { const f = fill(titles[i], d, cfg, report); rawAll.push(...f.raw); formAll.push(...f.formulas); });
  rawAll.push(...general(t, titles, report));
  await api('POST', `${SHEETS}${ssid}/values:batchUpdate`, Object.assign({ body: { valueInputOption: 'RAW', data: rawAll } }, U));
  await api('POST', `${SHEETS}${ssid}/values:batchUpdate`, Object.assign({ body: { valueInputOption: 'USER_ENTERED', data: formAll } }, U));
  links.teachers[t.id] = { name: t.name, ssid, groups: t.groups.map((d, i) => ({ id: d.group.id, tab: titles[i], gid: gids[i] })) };
  return { ssid, report };
}

function writeLinks(links) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(links, null, 1));
  const groups = {};
  Object.keys(links.teachers).forEach(tid => links.teachers[tid].groups.forEach(g => { groups[g.id] = { teacher: tid, ssid: links.teachers[tid].ssid, gid: g.gid, tab: g.tab }; }));
  const teachers = {};
  Object.keys(links.teachers).forEach(tid => { teachers[tid] = { ssid: links.teachers[tid].ssid }; });
  fs.writeFileSync(LINKS_JS, `/* Group -> Google Sheets register (workbook id + tab id). Written by scripts/registru-import/google/build-registers.js for the demo registers;
   with the real registers the sync fills the same shape. A group or teacher without an entry has no register yet. */
(function () {
  const L = window.AdminSheetLinks = ${JSON.stringify({ groups, teachers }, null, 1)};
  const base = id => 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
  /* the link to a group's tab (or null), and to a teacher's workbook (or null) */
  L.groupUrl = gid => { const g = L.groups[gid]; return g ? base(g.ssid) + '#gid=' + g.gid : null; };
  L.teacherUrl = tid => { const t = L.teachers[tid]; return t ? base(t.ssid) : null; };
})();
`);
}

(async () => {
  const links = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : { template: TEMPLATE, folder: FOLDER, teachers: {} };
  const cfg = await lists();
  let todo = allTeachers().filter(t => (!ONLY || t.id === ONLY) && !links.teachers[t.id]);
  if (LIMIT) todo = todo.slice(0, LIMIT);
  console.log(`${todo.length} profesori de construit (${Object.keys(links.teachers).length} deja făcuți).`);
  for (const t of todo) {
    const t0 = Date.now();
    const r = await build(t, cfg, TEMPLATE, links);
    writeLinks(links);                                    // saved after every teacher: a stop in the middle loses nothing
    console.log(`${t.name}: ${t.groups.length} grupe, https://docs.google.com/spreadsheets/d/${r.ssid} (${Math.round((Date.now() - t0) / 1000)}s)${r.report.manager || r.report.cabinet ? ` | manageri în afara listei: ${r.report.manager}, cabinete în afara listei: ${r.report.cabinet}` : ''}`);
    await sleep(1500);
  }
  writeLinks(links);
})().catch(e => { console.error(e.message); process.exit(1); });
