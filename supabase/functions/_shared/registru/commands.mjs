/* What the platform may ask a register to do, and exactly which cells each request touches.
   A command is plain data ({ id, type, tab, ... }); plan() turns it into a list of writes, each with the value the cell must still
   hold ("expect") for the write to be allowed. Nothing here writes: apply.js does, and checks the expectations first.
   Who owns what (docs/registru-sync.md): the platform writes row 1 (student header), row 3 and 4 (payments, discounts),
   row 7 (manager) and row 8 (status) of a student column. Marks, topics and dates stay with the teacher; the money
   (rows 2, 5, 6, column C) is the sheet's own formulas and is never written.
   Plain ES module (Node through require, the Supabase Edge Function through import). */
import { colLetter, readConfig } from './parse.mjs';
import { tokens } from './link.mjs';
import { splitMoney, round2 } from './pay.mjs';

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
  if (who.col) {
    const x = readStudents(s).find(c => c.col === who.col && c.head);
    if (!x) return null;
    // the column is only trusted while its header is still the student's (somebody may have moved or replaced it)
    if (who.name && nameInHead(x.head) !== tokens(who.name).join(' ')) return null;
    if (who.phone && phoneOf(who.phone) && phoneInHead(x.head) !== phoneOf(who.phone)) return null;
    return x;
  }
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

/* the inside of a payment or discount cell, SUM(<body>): "0" for an empty one, null when it is not a sum a person typed (a text, a strange formula) */
function sumBody(cell) {
  if (!cell) return '0';
  if (cell.f) { const m = /^sum\((.*)\)$/i.exec(cell.f.replace(/\s+/g, '')); return m && /^[\d.+\-*/()]*$/.test(m[1]) ? m[1] : null; }
  return typeof cell.v === 'number' ? String(cell.v) : null;
}

function addTerm(book, cmd, row) {
  const s = book.sheet(cmd.tab);
  const amount = Number(cmd.amount);
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000 || Math.round(amount * 100) !== amount * 100) return invalid('amount', 'Suma trebuie să fie un număr nenul, cu cel mult 2 zecimale.');
  const col = locate(s, cmd.student);
  if (!col) return NOT_FOUND();
  const cell = s.get(row, col.col);
  const body = sumBody(cell);
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

/* ---- TRANSFER: a student moves from one group to another, and his money with him ----
   Two registers may be involved (the groups often have different teachers), so there is no single write: two PHASES, in the safe order.
     phase 1, the new group: his column (header, manager, status) with the part of his money that moves (payments, discounts)
     phase 2, the old group: status Transferat, and the moved part taken out of his payments and discounts (one more minus term in each SUM,
              so what was typed stays; the old column ends with balance 0, or with his debt)
   cmd: { id, type: 'TRANSFER', fromTab, toTab, student: { col, name, phone }, status, manager, expect?: { A, R, C }, allowOverfill? }
   The split is worked out HERE from the cells of the old column (never trusted from the caller); `expect` is what the person saw on screen, and
   a difference is refused. A retry after a failure in phase 2 finds him already in the new group with the right sums and only does phase 2. */
export function planTransfer(bookFrom, bookTo, cmd) {
  if (!bookFrom.sheetNames.includes(cmd.fromTab) || !bookTo.sheetNames.includes(cmd.toTab)) return invalid('tab', 'Una din file nu mai există în registru.');
  const sF = bookFrom.sheet(cmd.fromTab), sT = bookTo.sheet(cmd.toTab), cfg = readConfig(bookTo);
  const old = locate(sF, cmd.student);
  if (!old) return NOT_FOUND();
  const oldStatus = norm(sF.text(8, old.col));
  const name = String((cmd.student && cmd.student.name) || '').replace(/\s+/g, ' ').trim(), phone = phoneOf(cmd.student && cmd.student.phone);
  if (name.split(' ').length < 2 || !phone) return invalid('student', 'Elevul nu are nume și telefon valide în registru.');
  const dupe = readStudents(sT).find(x => x.head && phoneInHead(x.head) === phone && nameInHead(x.head) === tokens(name).join(' '));
  if (dupe && oldStatus === 'transferat') return planOk([], { state: 'done', phases: [] });
  if (!dupe && !ENROLLED.has(oldStatus)) return invalid('not-active', 'Elevul nu e activ în grupa veche (statut „' + sF.text(8, old.col) + '”): nu se poate transfera.');

  // his money, as the sheet has it
  const cA = sF.get(3, old.col), cR = sF.get(4, old.col), bodyA = sumBody(cA), bodyR = sumBody(cR);
  if (bodyA === null) return invalid('cell-not-numeric', `Celula ${old.letter}3 nu e o sumă pe care o pot continua: trebuie reparată de un om.`);
  if (bodyR === null) return invalid('cell-not-numeric', `Celula ${old.letter}4 nu e o sumă pe care o pot continua: trebuie reparată de un om.`);
  const A = sF.num(3, old.col) || 0, R = sF.num(4, old.col) || 0, C = sF.num(5, old.col);
  if (C === null) return invalid('no-cost', `Celula ${old.letter}5 (costul lecțiilor) nu are o valoare: registrul nu l-a calculat.`);
  const m = splitMoney(A, R, C);
  if (cmd.expect) {
    const e = cmd.expect;
    if (Math.abs(e.A - m.A) > 0.01 || Math.abs(e.R - m.R) > 0.01 || Math.abs(e.C - m.C) > 0.01) return { ok: false, conflict: true, code: 'stale-money', msg: `Sumele din registru s-au schimbat de când ai deschis transferul (acum: achitări ${m.A}, reduceri ${m.R}, cost ${m.C}). Nu am scris nimic.` };
  }
  const phases = [];
  let column = dupe ? dupe.letter : null;

  // phase 1: the new group
  if (dupe) {
    // already there (an earlier try wrote it): it must be the same transfer, with the sums of this split
    const pa = sT.num(3, dupe.col) || 0, pr = sT.num(4, dupe.col) || 0;
    if (Math.abs(pa - m.achRem) > 0.01 || Math.abs(pr - m.redRem) > 0.01) return { ok: false, conflict: true, code: 'mismatch', msg: `Elevul e deja în grupa nouă (coloana ${dupe.letter}), dar cu alte sume decât cele ale transferului (${pa} / ${pr} față de ${m.achRem} / ${m.redRem}). Nu am scris nimic: verifică în registru.` };
  } else {
    if (cfg.studentStatus && !cfg.studentStatus.includes(cmd.status)) return invalid('status', `Statutul „${cmd.status}” nu e în lista din CONFIGURARI a grupei noi.`);
    if (cfg.manager && cmd.manager && !cfg.manager.includes(cmd.manager)) return invalid('manager', `Managerul „${cmd.manager}” nu e în lista din CONFIGURARI a grupei noi.`);
    const cols = readStudents(sT);
    const size = (/(\d+)/.exec(sT.text(1, 1)) || [])[1];
    const live = cols.filter(x => x.head && ENROLLED.has(norm(x.status))).length;
    if (size && live >= +size && !cmd.allowOverfill) return invalid('group-full', `Grupa nouă are ${live} elevi activi din ${size} locuri.`);
    const free = cols.find(x => !x.head && !x.marks);
    if (!free) return invalid('no-column', 'Nu mai e nicio coloană liberă (D–Z) în grupa nouă.');
    const c = free.col, L = free.letter;
    const writes = [w(L + '1', snap(sT, 1, c), { v: `${name}${phone}` })];
    if (cmd.manager) writes.push(w(L + '7', snap(sT, 7, c), { v: cmd.manager }));
    writes.push(w(L + '8', snap(sT, 8, c), { v: cmd.status }));
    if (m.achRem > 0) writes.push(w(L + '3', snap(sT, 3, c), { f: `SUM(${m.achRem})` }));
    if (m.redRem > 0) writes.push(w(L + '4', snap(sT, 4, c), { f: `SUM(${m.redRem})` }));
    phases.push({ side: 'to', tab: cmd.toTab, writes });
    column = L;
  }

  // phase 2: the old group
  if (oldStatus !== 'transferat') {
    const writes = [w(old.letter + '8', snap(sF, 8, old.col), { v: 'Transferat' })];
    const minus = (body, x) => `SUM(${body === '0' ? '-' + x : body + '-' + x})`;
    if (m.achRem > 0) writes.push(w(old.letter + '3', snap(sF, 3, old.col), { f: minus(bodyA, m.achRem) }));
    if (m.redRem > 0) writes.push(w(old.letter + '4', snap(sF, 4, old.col), { f: minus(bodyR, m.redRem) }));
    phases.push({ side: 'from', tab: cmd.fromTab, writes });
  }
  return planOk([], { state: phases.length ? (dupe ? 'resume' : 'both') : 'done', phases, split: m, column, oldColumn: old.letter, resumed: !!dupe });
}
