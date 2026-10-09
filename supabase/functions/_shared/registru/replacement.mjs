/* Replacements (docs/inlocuiri.md): a lesson of a group is taught by another teacher.
   This file is the register side of it, plain ES module (Node through import(), the Edge Functions through import):
     readOriginal(book, tab)                 the group of the base teacher as the register has it: format, subject, class, level, profile, students
     replacementRows(dates)                  the schedule rows (day, hour, cabinet) of the dates chosen
     planReplacementTab(...)                 a NEW tab in the substitute's register: group state Inlocuire, every student copied with status Inlocuire and no money
     applyReplacementCreateAsync(...)        creates that tab, or (it exists already for this group and teacher) brings it up to date: state, schedule, students
   The money (what moves when the substitute marks a student) is REPL_TAKE / REPL_MONEY in commands.mjs, decided by the engine at the end of this file's sibling
   (engine.mjs). Nothing here moves money: a copied student starts with payments and discounts at 0. */
import { colLetter, readConfig } from './parse.mjs';
import { tokens } from './link.mjs';
import { phoneOf, FIRST_COL, LAST_COL } from './commands.mjs';
import { applyAsync } from './apply.mjs';
import { priceFor } from './pay.mjs';
import { DAY_NAMES, CLEARS, GENERAL_TABS, firstFree } from './newgroup.mjs';

const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const invalid = (code, msg) => ({ ok: false, code, msg });
export const REPL_STATE = 'Înlocuire';
const COPIED = new Set(['activ', 'instabil', 'ora de proba', 'ora de proba confirmata', 'inlocuire']);     // in the group now: Inactiv and Transferat stay out

/* ---- the group of the base teacher, from its tab ---- */
export function readOriginal(book, tab) {
  const s = book.sheet(tab);
  const a1 = s.text(1, 1);
  const size = /individual/i.test(a1) ? 1 : (/(\d+)/.exec(a1) || [])[1] ? +(/(\d+)/.exec(a1))[1] : null;
  const ph = (raw, ...placeholders) => (placeholders.includes(plain(raw)) ? '' : raw);
  const grade = s.text(5, 1), level = ph(s.text(6, 1), 'nivelul'), profile = ph(s.text(7, 1), 'profilul');
  const students = [];
  for (let c = FIRST_COL; c <= LAST_COL; c++) {
    const head = s.text(1, c);
    if (!head) continue;
    const m = /\+?\d[\d\s]{6,}/.exec(head);
    const phone = m ? phoneOf(m[0]) : null;
    const name = tokens(head.replace(/[+\d][\s\S]*$/, '')).join(' ');
    const rawName = head.replace(/[+\d][\s\S]*$/, '').replace(/\s+/g, ' ').trim();
    students.push({ col: c, letter: colLetter(c), name: rawName || name, phone, manager: s.text(7, c), status: s.text(8, c) });
  }
  return { tab, a1, size, state: s.text(3, 1), subject: s.text(4, 1), grade, level, profile, students };
}

/* who is copied: the students that are in the group now (not Inactiv, not Transferat) and that have a name and a phone the register can find again */
export function copiedStudents(orig) {
  return orig.students.filter(st => COPIED.has(plain(st.status)) && st.phone && st.name.split(' ').length >= 2);
}

/* the weekday (1 = Monday ... 7 = Sunday) of an ISO date */
export const weekdayOf = iso => { const d = new Date(iso + 'T12:00:00Z'); return d.getUTCDay() === 0 ? 7 : d.getUTCDay(); };

/* dates -> schedule rows (a two-hour lesson is two rows), without repeats; the register has room for six rows */
export function replacementRows(dates) {
  const seen = new Map();
  (dates || []).forEach(d => {
    const day = weekdayOf(d.iso), cab = d.cabinet == null || d.cabinet === '' ? '' : String(d.cabinet);
    for (let h = 0; h < (Number(d.duration) || 1); h++) seen.set(`${day}|${Number(d.start) + h}`, { day, hour: Number(d.start) + h, cab });
  });
  return [...seen.values()].sort((a, b) => a.day - b.day || a.hour - b.hour);
}

/* a name for the new tab that no tab has: "Inlocuire <the base tab's name>" */
function uniqueTitle(base, taken) {
  const used = new Set(taken.map(plain));
  let title = String(base).slice(0, 95), k = 1;
  while (used.has(plain(title))) title = `${String(base).slice(0, 90)} (${++k})`;
  return title;
}

function checkLists(cfg, { subject, level, rows, students }) {
  if (cfg.groupState && cfg.groupState.length && !cfg.groupState.includes(REPL_STATE)) return invalid('state', `Starea „${REPL_STATE}” nu e în lista din CONFIGURARI a registrului profesorului nou.`);
  if (cfg.studentStatus && cfg.studentStatus.length && !cfg.studentStatus.includes(REPL_STATE)) return invalid('status', `Statutul „${REPL_STATE}” nu e în lista elevilor din CONFIGURARI a registrului profesorului nou.`);
  if (subject && cfg.subject && cfg.subject.length && !cfg.subject.some(x => plain(x) === plain(subject))) return invalid('subject', `Materia „${subject}” nu e în lista din CONFIGURARI a registrului profesorului nou: el nu o predă.`);
  if (level && cfg.level && cfg.level.length && !cfg.level.some(x => plain(x) === plain(level))) return invalid('level', `Nivelul „${level}” nu e în lista din CONFIGURARI a registrului profesorului nou.`);
  for (const r of rows) if (r.cab && cfg.cabinet && cfg.cabinet.length && !cfg.cabinet.map(String).includes(r.cab)) return invalid('cabinet', `Cabinetul „${r.cab}” nu e în lista din CONFIGURARI.`);
  for (const st of students) if (st.manager && cfg.manager && cfg.manager.length && !cfg.manager.includes(st.manager)) return invalid('manager', `Managerul „${st.manager}” nu e în lista din CONFIGURARI a registrului profesorului nou.`);
  return null;
}

/* A NEW tab: the same cells a person fills in by hand (like a new group), the state Inlocuire, and the students in the first columns with the status
   Inlocuire and their manager. Everything that belongs to students and lessons of the template is cleared first (the template may be a real group's tab). */
export function planReplacementTab({ tabs, template, config, configCells, total, orig, rows, teacherLevel, baseTitle }) {
  const cfg = config || {};
  const students = copiedStudents(orig);
  if (!students.length) return invalid('no-students', 'Grupa nu are elevi de copiat (toți sunt Inactiv sau Transferat).');
  if (students.length > LAST_COL - FIRST_COL + 1) return invalid('too-many', `Grupa are ${students.length} elevi: într-un registru încap cel mult ${LAST_COL - FIRST_COL + 1}.`);
  if (!rows.length) return invalid('schedule', 'Nu e nicio dată de înlocuit.');
  if (rows.length > 6) return invalid('schedule', 'Registrul are loc pentru cel mult 6 ore de orar pe săptămână (AA2:AC7): alege date din mai puține zile sau ore.');
  if (!(orig.size >= 1)) return invalid('size', 'Nu pot citi formatul grupei de bază (A1).');
  const bad = checkLists(cfg, { subject: orig.subject, level: orig.level, rows, students });
  if (bad) return bad;
  const tl = +teacherLevel;
  if (!(tl >= 1 && tl <= 6)) return invalid('teacher-level', 'Nivelul profesorului trebuie să fie între 1 și 6.');
  if (!template) return invalid('no-template', 'Registrul profesorului nou nu are nicio filă de grupă după care să se facă una nouă („Orar 1” sau o grupă existentă).');
  if (total && total.exists && !total.free) return invalid('total-full', 'Lista de file din „Total achitări” (F4:AI4) e plină: fila nouă nu ar intra în totaluri. Fă loc în registru.');

  const title = uniqueTitle(baseTitle || `Înlocuire ${orig.tab}`, tabs.map(t => t.title));
  const cells = {}, put = (a1, v) => { cells[a1] = { v }; };
  put('A1', orig.size === 1 ? 'Individual 1 elev' : `Grup cu ${orig.size} elevi`);
  put('A3', REPL_STATE); put('A4', orig.subject); put('A5', orig.grade); put('A6', orig.level || 'Nivelul'); put('A7', orig.profile || 'Profilul');
  rows.forEach((r, i) => { put('AA' + (2 + i), DAY_NAMES[r.day - 1]); put('AB' + (2 + i), r.hour / 24); if (r.cab) put('AC' + (2 + i), r.cab); });
  for (let row = 9; row <= 198; row++) put('AA' + row, 'Nivelul Profesorului ' + tl);
  for (let c = FIRST_COL; c <= LAST_COL; c++) { cells[colLetter(c) + '3'] = { f: 'sum(0)' }; cells[colLetter(c) + '4'] = { f: 'sum(0)' }; }
  students.forEach((st, i) => {
    const L = colLetter(FIRST_COL + i);
    put(L + '1', `${st.name}${st.phone}`);
    if (st.manager) put(L + '7', st.manager);
    put(L + '8', REPL_STATE);
  });
  return {
    ok: true, title, sourceTitle: template.title, clears: CLEARS.slice(), cells,
    total: total && total.exists && total.free ? { tab: total.title, a1: total.free.a1, v: title } : null,
    students: students.map(s => ({ name: s.name, phone: s.phone, from: s.letter }))
  };
}

const nul = x => (x === undefined || x === null ? null : x);
const colName = c => { let s = ''; for (; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; };

/* cmd: { id, type: 'REPLACEMENT_CREATE', fromTab, existingTab?, dates: [{ iso, start, duration, cabinet }], teacherLevel }
   adapters: { from, to } (the same adapter when both teachers are in one register). Returns { status, tab, sheetId, reused, students: n, rows }. */
export async function applyReplacementCreateAsync(adapters, cmd) {
  if (!cmd || !cmd.id) return { status: 'invalid', code: 'id', msg: 'Comanda nu are id.' };
  const origBook = await adapters.from.load(cmd.fromTab);
  if (!origBook.sheetNames.includes(cmd.fromTab)) return { status: 'invalid', code: 'tab', msg: 'Fila grupei de bază nu mai există în registru.' };
  const orig = readOriginal(origBook, cmd.fromTab);
  const rows = replacementRows(cmd.dates);
  const price = priceFor(orig.size);
  if (!price) return { status: 'invalid', code: 'price', msg: 'Formatul grupei de bază nu are un preț de lecție: banii unei înlocuiri nu se pot calcula.' };
  const students = copiedStudents(orig).map(s => ({ name: s.name, phone: s.phone, manager: s.manager, status: REPL_STATE }));

  // the tab exists already for this group and this teacher: bring it up to date (state, schedule, students that joined meanwhile)
  if (cmd.existingTab) {
    const r = await applyAsync(adapters.to, { id: cmd.id, type: 'REPL_TAB_UPDATE', tab: cmd.existingTab, rows, students, teacherLevel: cmd.teacherLevel });
    return Object.assign({}, r, { tab: cmd.existingTab, reused: true, size: orig.size, price, students: students.length, rows: rows.length });
  }

  const tabs = await adapters.to.tabs();
  const plainT = x => plain(x);
  let template = tabs.find(x => plainT(x.title) === 'orar 1') || null;
  if (!template) {
    const groups = tabs.filter(x => !x.hidden && !GENERAL_TABS.has(plainT(x.title)));
    for (let k = groups.length - 1; k >= 0 && !template; k--) { const a1 = (await adapters.to.read(groups[k].title, ['A1']))['A1']; if (/^(grup|individual)/i.test(String((a1 && a1.v) || ''))) template = groups[k]; }
  }
  const totalTab = tabs.find(x => plainT(x.title) === 'total achitari');
  let total = { exists: false };
  if (totalTab) {
    const keys = []; for (let c = 6; c <= 35; c++) keys.push(colName(c) + '4');
    const row = await adapters.to.read(totalTab.title, keys);
    total = { exists: true, title: totalTab.title, free: firstFree(keys.map(k => { const x = row[k]; return x && x.v != null ? x.v : ''; })) };
  }
  const book = template ? await adapters.to.load(template.title) : null;
  const config = book ? readConfig(book) : {};
  const p = planReplacementTab({ tabs, template, config, configCells: book && book.data.CONFIGURARI ? book.data.CONFIGURARI.cells : {}, total, orig, rows, teacherLevel: cmd.teacherLevel, baseTitle: cmd.title });
  if (!p.ok) return { status: 'invalid', code: p.code, msg: p.msg };

  const created = await adapters.to.duplicate(p.sourceTitle, p.title);
  const cellsByTab = { [p.title]: p.cells };
  if (p.total) cellsByTab[p.total.tab] = { [p.total.a1]: { v: p.total.v } };
  try {
    await adapters.to.batchWrite({ clears: p.clears.map(range => ({ tab: p.title, range })), cells: cellsByTab });
    const keys = ['A1', 'A3', 'A4', 'A5', 'D1', 'D8'];
    const after = await adapters.to.read(p.title, keys);
    const bad = keys.filter(k => nul(after[k] && after[k].v) !== p.cells[k].v);
    if (bad.length) throw new Error(`după scriere, celula ${bad[0]} din fila nouă nu are ce am scris`);
    if (p.total) { const t = await adapters.to.read(p.total.tab, [p.total.a1]); if (nul(t[p.total.a1] && t[p.total.a1].v) !== p.total.v) throw new Error('numele filei nu a ajuns în „Total achitări”'); }
  } catch (e) {
    try { await adapters.to.remove(p.title); } catch (e2) { /* the tab stays: said below */ }
    return { status: 'failed', code: 'replacement-failed', msg: 'Fila de înlocuire nu a putut fi completată și a fost ștearsă: ' + String((e && e.message) || e).slice(0, 200) };
  }
  return { status: 'done', tab: p.title, sheetId: created.sheetId, reused: false, size: orig.size, price, students: p.students.length, rows: rows.length, source: p.sourceTitle, totalListed: !!p.total };
}
