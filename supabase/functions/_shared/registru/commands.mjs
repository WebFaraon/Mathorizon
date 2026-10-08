/* What the platform may ask a register to do, and exactly which cells each request touches.
   A command is plain data ({ id, type, tab, ... }); plan() turns it into a list of writes, each with the value the cell must still
   hold ("expect") for the write to be allowed. Nothing here writes: apply.js does, and checks the expectations first.
   Who owns what (docs/registru-sync.md): the platform writes row 1 (student header), row 3 and 4 (payments, discounts),
   row 7 (manager) and row 8 (status) of a student column. Marks, topics and dates stay with the teacher; the money
   (rows 2, 5, 6, column C) is the sheet's own formulas and is never written.
   Plain ES module (Node through require, the Supabase Edge Function through import). */
import { colLetter, readConfig } from './parse.mjs';
import { tokens } from './link.mjs';

export const FIRST_COL = 4, LAST_COL = 26, FIRST_LESSON_ROW = 9, LAST_LESSON_ROW = 198;
const ENROLLED = new Set(['activ', 'ora de proba', 'ora de proba confirmata', 'inlocuire']);
const norm = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const same = (a, b) => (a == null ? '' : String(a)) === (b == null ? '' : String(b));

/* a cell as the command saw it, to be compared again just before the write */
const snap = (s, r, c) => { const x = s.get(r, c); return x ? { v: x.v === undefined ? null : x.v, f: x.f || null } : { v: null, f: null }; };
const w = (a1, before, cell) => ({ a1, expect: before, write: cell });

export function phoneOf(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (/^373\d{8}$/.test(digits)) return '+' + digits;
  if (/^0?[67]\d{7}$/.test(digits)) return '+373' + digits.slice(-8);
  return null;
}

const invalid = (code, msg) => ({ ok: false, code, msg });
const planOk = (writes, extra) => Object.assign({ ok: true, writes }, extra || {});

function readStudents(s) {
  const out = [];
  for (let c = FIRST_COL; c <= LAST_COL; c++) {
    const head = s.text(1, c);
    let marks = 0;
    for (let r = FIRST_LESSON_ROW; r <= LAST_LESSON_ROW; r++) if (s.text(r, c)) marks++;
    out.push({ col: c, letter: colLetter(c), head, marks, status: s.text(8, c) });
  }
  return out;
}
const phoneInHead = head => { const m = /\+?\d[\d\s]{6,}/.exec(head); return m ? phoneOf(m[0]) : null; };
const nameInHead = head => tokens(head.replace(/[+\d][\s\S]*$/, '')).join(' ');

/* finds the student's column: by phone and name, as long as the register has no id for him (later: the column's developer metadata) */
export function locate(s, who) {
  if (who.col) return readStudents(s).find(x => x.col === who.col && x.head) || null;
  const t = tokens(who.name || '').join(' '), ph = phoneOf(who.phone);
  const hits = readStudents(s).filter(x => x.head && (!ph || phoneInHead(x.head) === ph) && nameInHead(x.head) === t);
  return hits.length === 1 ? hits[0] : null;
}

const NOT_FOUND = () => invalid('not-found', 'Elevul nu e găsit sau e găsit de mai multe ori în fila asta.');

const PLANNERS = {
  /* a new student in the first free column: header, manager, status. The payment cells already hold =sum(0). */
  ADD_STUDENT(book, cmd, cfg) {
    const s = book.sheet(cmd.tab);
    const name = String(cmd.name || '').replace(/\s+/g, ' ').trim();
    const phone = phoneOf(cmd.phone);
    if (name.split(' ').length < 2) return invalid('name', 'Numele trebuie să aibă cel puțin două cuvinte.');
    if (!phone) return invalid('phone', 'Telefonul nu e unul valid (+373 și 8 cifre).');
    if (cfg.studentStatus && !cfg.studentStatus.includes(cmd.status)) return invalid('status', `Statutul „${cmd.status}” nu e în lista din CONFIGURARI.`);
    if (cfg.manager && !cfg.manager.includes(cmd.manager)) return invalid('manager', `Managerul „${cmd.manager}” nu e în lista din CONFIGURARI.`);
    const cols = readStudents(s);
    const dupe = cols.find(x => x.head && phoneInHead(x.head) === phone && nameInHead(x.head) === tokens(name).join(' '));
    if (dupe) return invalid('duplicate', `Elevul e deja în coloana ${dupe.letter}.`);
    const size = (/(\d+)/.exec(s.text(1, 1)) || [])[1];
    const live = cols.filter(x => x.head && ENROLLED.has(norm(x.status))).length;
    if (size && live >= +size && !cmd.allowOverfill) return invalid('group-full', `Grupa are ${live} elevi activi din ${size} locuri.`);
    const free = cols.find(x => !x.head && !x.marks);                     // a column with marks but no header is somebody's lost data: never reuse it
    if (!free) return invalid('no-column', 'Nu mai e nicio coloană liberă (D–Z).');
    const c = free.col, L = free.letter;
    return planOk([
      w(L + '1', snap(s, 1, c), { v: `${name}${phone}` }),
      w(L + '7', snap(s, 7, c), { v: cmd.manager }),
      w(L + '8', snap(s, 8, c), { v: cmd.status })
    ], { column: L });
  },

  SET_STATUS(book, cmd, cfg) {
    const s = book.sheet(cmd.tab);
    if (cfg.studentStatus && !cfg.studentStatus.includes(cmd.status)) return invalid('status', `Statutul „${cmd.status}” nu e în lista din CONFIGURARI.`);
    const col = locate(s, cmd.student);
    if (!col) return NOT_FOUND();
    if (cmd.expectStatus !== undefined && !same(col.status, cmd.expectStatus)) return { ok: false, conflict: true, code: 'stale', msg: `Statutul din registru e „${col.status}”, nu „${cmd.expectStatus}” cum știa platforma.` };
    if (col.status === cmd.status) return planOk([], { noop: true, column: col.letter });
    return planOk([w(col.letter + '8', snap(s, 8, col.col), { v: cmd.status })], { column: col.letter });
  },

  SET_MANAGER(book, cmd, cfg) {
    const s = book.sheet(cmd.tab);
    if (cfg.manager && !cfg.manager.includes(cmd.manager)) return invalid('manager', `Managerul „${cmd.manager}” nu e în lista din CONFIGURARI.`);
    const col = locate(s, cmd.student);
    if (!col) return NOT_FOUND();
    if (s.text(7, col.col) === cmd.manager) return planOk([], { noop: true, column: col.letter });
    return planOk([w(col.letter + '7', snap(s, 7, col.col), { v: cmd.manager })], { column: col.letter });
  },

  /* a payment or a discount is one more term in the cell's SUM(...), the way the managers type them: =SUM(1216-608) -> =SUM(1216-608+300) */
  ADD_PAYMENT(book, cmd) { return addTerm(book, cmd, 3); },
  ADD_DISCOUNT(book, cmd) { return addTerm(book, cmd, 4); }
};

function addTerm(book, cmd, row) {
  const s = book.sheet(cmd.tab);
  const amount = Number(cmd.amount);
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000 || Math.round(amount * 100) !== amount * 100) return invalid('amount', 'Suma trebuie să fie un număr nenul, cu cel mult 2 zecimale.');
  const col = locate(s, cmd.student);
  if (!col) return NOT_FOUND();
  const cell = s.get(row, col.col);
  let body = null;
  if (!cell) body = '0';
  else if (cell.f) { const m = /^sum\((.*)\)$/i.exec(cell.f.replace(/\s+/g, '')); if (m && /^[\d.+\-*/()]*$/.test(m[1])) body = m[1]; }
  else if (typeof cell.v === 'number') body = String(cell.v);
  if (body === null) return invalid('cell-not-numeric', `Celula ${col.letter}${row} nu e o sumă pe care o pot continua (are „${cell ? (cell.f || cell.v) : ''}”): trebuie reparată de un om.`);
  const term = String(Math.abs(amount));
  const next = body === '0' ? (amount > 0 ? term : '-' + term) : body + (amount > 0 ? '+' : '-') + term;
  return planOk([w(col.letter + row, snap(s, row, col.col), { f: `SUM(${next})` })], { column: col.letter });
}

export function plan(book, cmd) {
  const fn = PLANNERS[cmd.type];
  if (!fn) return invalid('type', 'Comandă necunoscută: ' + cmd.type);
  if (!book.sheetNames.includes(cmd.tab)) return invalid('tab', 'Fila nu există în registru.');
  return fn(book, cmd, readConfig(book));
}

export const COMMANDS = Object.keys(PLANNERS);
