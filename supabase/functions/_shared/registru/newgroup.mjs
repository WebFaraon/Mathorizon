/* A new group in a teacher's register: a new tab, filled in, and its name added to the list of "Total achitari".
   Pure planning (no I/O): given the register's tabs, a template tab, the dropdown lists (parsed, and their cells for checking the first student) and the first free place in the Total tab,
   planNewGroup says exactly what to clear and what to write. applyNewGroupAsync (apply.mjs) does it against Google.
   Plain ES module (Node through require, the Supabase Edge Function through import).

   cmd: { id, type: 'NEW_GROUP', group: { size, subject, summer, grade, profile, level, days: [1..7], start, duration, cabinet, teacherLevel, state },
          student?: { name, phone, manager, status } }

   What the new tab gets (the same cells a person fills in by hand):
     A1 "Grup cu N elevi" / "Individual 1 elev"   A3 state   A4 subject ("(Vara)" for a summer group)   A5 class   A6 level ("4 ― 5")   A7 profile
     AA2:AC7 the schedule, one row per hour (day, hour, cabinet)   AA9:AA198 "Nivelul Profesorului N"   D3:Z4 payments and discounts back to sum(0)
   and everything that belongs to students and lessons is cleared (A9:B198 dates and topics, D1:Z1 headers, D7:Z8 manager and status, D9:Z198 marks),
   because the template may be a tab of a real group. The formulas of the template (price, cost, sold, teacher pay) stay as they are. */
import { MemoryBook } from './memory-book.mjs';
import { plan } from './commands.mjs';
import { colLetter, readConfig } from './parse.mjs';

export const DAY_NAMES = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
const SIZES = [1, 2, 3, 4, 5, 6, 8];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const GENERAL_TABS = new Set(['total achitari', 'disponibilitate', 'disponibilitate vara', 'configurari']);
export const CLEARS = ['A9:B198', 'D1:Z1', 'D7:Z8', 'D9:Z198', 'AA2:AC7'];
const invalid = (code, msg) => ({ ok: false, code, msg });

/* "4-5" -> "4 ― 5" (the way the register's list writes it); "Repetat" stays */
export const levelLabel = l => { const m = /^(\d+)\s*[-―–—]\s*(\d+)$/.exec(String(l || '').trim()); return m ? `${m[1]} ― ${m[2]}` : String(l || '').trim(); };

/* the tab name, as the schedule: "Luni/Miercuri 12:00-13:00 (Vara)"; never one that exists already */
export function tabTitleFor(g, taken) {
  const hh = h => String(h).padStart(2, '0') + ':00';
  const days = g.days.slice().sort((a, b) => a - b).map(d => DAY_NAMES[d - 1]).join('/');
  const base = `${days} ${hh(g.start)}-${hh(g.start + (g.duration || 1))}${g.summer ? ' (Vara)' : ''}`.slice(0, 95);
  const used = new Set(taken.map(plain));
  let title = base, k = 1;
  while (used.has(plain(title))) title = `${base} (${++k})`;
  return title;
}

/* the template: the empty tab "Orar 1" when the register has it, else the last visible group tab (it is cleaned anyway) */
export function chooseTemplate(tabs, a1Of) {
  const orar = tabs.find(t => plain(t.title) === 'orar 1');
  if (orar) return orar;
  const groups = tabs.filter(t => !t.hidden && !GENERAL_TABS.has(plain(t.title)));
  for (let i = groups.length - 1; i >= 0; i--) if (/^(grup|individual)/i.test(String(a1Of[groups[i].title] || ''))) return groups[i];
  return null;
}

/* the first free place for a name in the list of the Total tab (F4:AI4): { a1, index } or null when it is full */
export function firstFree(row) {
  for (let i = 0; i < row.length; i++) if (row[i] === '' || row[i] == null) return { a1: colLetter(6 + i) + '4', index: i };
  return null;
}

export function planNewGroup({ tabs, template, config, configCells, total, cmd }) {
  const g = cmd.group || {};
  const cfg = config || {};
  const size = +g.size, days = (g.days || []).map(Number), duration = +g.duration || 1, start = +g.start;
  if (!SIZES.includes(size)) return invalid('size', 'Formatul grupei trebuie să fie 1, 2, 3, 4, 5, 6 sau 8 elevi.');
  const subject = String(g.subject || '').trim() + (g.summer ? ' (Vara)' : '');
  if (!g.subject) return invalid('subject', 'Materia lipsește.');
  if (cfg.subject && cfg.subject.length && !cfg.subject.some(x => plain(x) === plain(subject))) return invalid('subject', `Materia „${subject}” nu e în lista din CONFIGURARI a registrului.`);
  if (!ROMAN.includes(g.grade)) return invalid('grade', 'Clasa trebuie să fie de la I la XII.');
  const liceu = ROMAN.indexOf(g.grade) >= 9;
  if (liceu && !['Real', 'Uman'].includes(g.profile)) return invalid('profile', 'La liceu trebuie ales profilul (Real sau Uman).');
  const level = g.level ? levelLabel(g.level) : '';
  if (level && cfg.level && cfg.level.length && !cfg.level.some(x => plain(x) === plain(level))) return invalid('level', `Nivelul „${level}” nu e în lista din CONFIGURARI.`);
  if (!days.length || days.some(d => !(d >= 1 && d <= 7)) || !Number.isInteger(start) || start < 8 || start + duration > 22) return invalid('schedule', 'Orarul grupei (zile și oră) nu e valid.');
  if (days.length * duration > 6) return invalid('schedule', 'Registrul are loc pentru cel mult 6 ore de orar pe săptămână (AA2:AC7).');
  const cabinet = g.cabinet == null || g.cabinet === '' ? '' : String(g.cabinet);
  if (cabinet && cfg.cabinet && cfg.cabinet.length && !cfg.cabinet.includes(cabinet)) return invalid('cabinet', `Cabinetul „${cabinet}” nu e în lista din CONFIGURARI.`);
  const state = g.state || 'Se completează';
  if (cfg.groupState && cfg.groupState.length && !cfg.groupState.includes(state)) return invalid('state', `Starea „${state}” nu e în lista din CONFIGURARI.`);
  const tl = +g.teacherLevel;
  if (!(tl >= 1 && tl <= 6)) return invalid('teacher-level', 'Nivelul profesorului trebuie să fie între 1 și 6.');
  if (!template) return invalid('no-template', 'Registrul nu are nicio filă de grupă după care să se facă una nouă („Orar 1” sau o grupă existentă).');
  if (total && total.exists && !total.free) return invalid('total-full', 'Lista de file din „Total achitări” (F4:AI4) e plină: grupa nouă nu ar intra în totaluri. Fă loc în registru.');

  const title = tabTitleFor({ days, start, duration, summer: !!g.summer }, tabs.map(t => t.title));
  const cells = {};
  const put = (a1, v) => { cells[a1] = { v }; };
  put('A1', size === 1 ? 'Individual 1 elev' : `Grup cu ${size} elevi`);
  put('A3', state); put('A4', subject); put('A5', g.grade); put('A6', level || 'Nivelul'); put('A7', liceu ? g.profile : 'Profilul');
  let r = 2;
  days.slice().sort((a, b) => a - b).forEach(d => { for (let h = 0; h < duration; h++) { put('AA' + r, DAY_NAMES[d - 1]); put('AB' + r, (start + h) / 24); if (cabinet) put('AC' + r, cabinet); r++; } });
  for (let row = 9; row <= 198; row++) put('AA' + row, 'Nivelul Profesorului ' + tl);
  for (let c = 4; c <= 26; c++) { cells[colLetter(c) + '3'] = { f: 'sum(0)' }; cells[colLetter(c) + '4'] = { f: 'sum(0)' }; }

  // the first student, checked BEFORE anything is created, on a tab as it will be (no students, the register's own lists)
  let student = null;
  if (cmd.student) {
    const virtual = new MemoryBook({ [title]: { cells: { A1: cells.A1 } }, CONFIGURARI: { hidden: true, cells: configCells || {} } }, 'virtual.xlsx');
    const p = plan(virtual, Object.assign({ id: cmd.id + '-s', type: 'ADD_STUDENT', tab: title }, cmd.student));
    if (!p.ok) return { ok: false, code: p.code, msg: p.msg, onStudent: true };
    student = Object.assign({ type: 'ADD_STUDENT', tab: title }, cmd.student);
  }
  return {
    ok: true, title, sourceTitle: template.title, clears: CLEARS.slice(), cells,
    total: total && total.exists && total.free ? { tab: total.title, a1: total.free.a1, v: title } : null, student
  };
}

export { readConfig };
