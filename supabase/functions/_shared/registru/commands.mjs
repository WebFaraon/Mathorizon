/* What the platform may ask a register to do, and exactly which cells each request touches.
   A command is plain data ({ id, type, tab, ... }); plan() turns it into a list of writes, each with the value the cell must still
   hold ("expect") for the write to be allowed. Nothing here writes: apply.js does, and checks the expectations first.
   Who owns what (docs/registru-sync.md): the platform writes row 1 (student header), row 3 and 4 (payments, discounts),
   row 7 (manager) and row 8 (status) of a student column. Marks, topics and dates stay with the teacher; the money
   (rows 2, 5, 6, column C) is the sheet's own formulas and is never written.
   Plain ES module (Node through require, the Supabase Edge Function through import). */
import { colLetter, readConfig, dayNumber } from './parse.mjs';
import { tokens } from './link.mjs';
import { splitMoney, splitReplacement, round2 } from './pay.mjs';

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

const DAY_NAMES = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
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

  /* The group itself: its state (A3) and its schedule (AA2:AC7: day, hour, cabinet, one row per hour). These belong to the sheet and to the admin;
     the platform writes them only when the person on screen saw the current values (cmd.expect), so a change made in the sheet meanwhile is refused.
       cmd: { type: 'SET_GROUP', tab, state?, schedule?: { days, start, duration, cabinet }, expect?: { state?, schedule? } }
     A schedule cell that already says what is wanted is not written again (the register keeps its own spelling of the day, its own cabinet cell). */
  SET_GROUP(book, cmd, cfg) {
    const s = book.sheet(cmd.tab);
    if (!/^(grup|individual)/i.test(s.text(1, 1))) return invalid('not-a-group', 'Fila nu e o grupă (A1 nu începe cu „Grup” sau „Individual”).');
    const writes = [], ex = cmd.expect || {};
    if (cmd.state !== undefined) {
      const state = String(cmd.state || '').trim(), cur = s.text(3, 1);
      if (!state || (cfg.groupState && cfg.groupState.length && !cfg.groupState.includes(state))) return invalid('state', `Starea „${state}” nu e în lista din CONFIGURARI.`);
      if (cur !== state) {
        if (ex.state !== undefined && !same(ex.state, cur)) return { ok: false, conflict: true, code: 'stale-state', msg: `Starea grupei din registru e „${cur}”, nu „${ex.state}” cât ai văzut tu. Nu am scris nimic.` };
        writes.push(w('A3', snap(s, 3, 1), { v: state }));
      }
    }
    if (cmd.schedule !== undefined) {
      const want = scheduleRows(cmd.schedule, cfg);
      if (!want.ok) return want;
      const cur = [];
      for (let r = 2; r <= 7; r++) {
        const day = dayNumber(s.text(r, 27)), hn = s.num(r, 28);
        if (day && hn !== null) cur.push({ r, day, hour: Math.round(hn * 24), cab: s.text(r, 29) });
      }
      cur.sort((x, y) => x.day - y.day || x.hour - y.hour);
      const effCab = (cur.find(x => x.cab) || {}).cab || '';
      const sameSlots = (a, b) => a.length === b.length && a.every((x, i) => x.day === b[i].day && x.hour === b[i].hour);
      if (ex.schedule !== undefined) {
        const seen = scheduleRows(ex.schedule, cfg), unchanged = sameSlots(cur, want.rows) && effCab === want.rows[0].cab;
        if (!unchanged && !(seen.ok && sameSlots(cur, seen.rows) && effCab === seen.rows[0].cab)) {
          return { ok: false, conflict: true, code: 'stale-schedule', msg: 'Orarul grupei din registru nu mai e cel pe care l-ai văzut (s-a schimbat în registru). Nu am scris nimic.' };
        }
      }
      for (let i = 0; i < 6; i++) {
        const r = i + 2, t = want.rows[i], x = cur.find(y => y.r === r);
        const rawDay = s.text(r, 27), rawCab = s.text(r, 29), hn = s.num(r, 28);
        if (t) {
          if (!(x && x.day === t.day)) writes.push(w('AA' + r, snap(s, r, 27), { v: DAY_NAMES[t.day - 1] }));
          if (!(x && x.hour === t.hour)) writes.push(w('AB' + r, snap(s, r, 28), { v: t.hour / 24 }));
          if (rawCab !== t.cab) writes.push(w('AC' + r, snap(s, r, 29), { v: t.cab === '' ? null : t.cab }));
        } else {
          if (rawDay) writes.push(w('AA' + r, snap(s, r, 27), { v: null }));
          if (hn !== null || s.text(r, 28)) writes.push(w('AB' + r, snap(s, r, 28), { v: null }));
          if (rawCab) writes.push(w('AC' + r, snap(s, r, 29), { v: null }));
        }
      }
    }
    if (cmd.state === undefined && cmd.schedule === undefined) return invalid('empty', 'Comanda nu cere nicio schimbare.');
    return writes.length ? planOk(writes) : planOk([], { noop: true });
  },

  /* The teacher's availability (tab "Disponibilitate": hours down column A, days across row 1, a cell says "Disponibil" or is empty). The platform sets or
     clears single cells, each with what the person saw (`was`), so a cell the teacher changed meanwhile is refused. Other words in a cell ("Ocupat") are
     never cleared, only overwritten when the person marks that hour available.
       cmd: { type: 'SET_AVAILABILITY', tab, changes: [{ day: 1..7, hour, to: true|false, was?: true|false }] } */
  SET_AVAILABILITY(book, cmd, cfg) {
    const s = book.sheet(cmd.tab), OK = 'Disponibil';
    if (!/^disponibilitate/.test(norm(cmd.tab))) return invalid('not-availability', 'Fila nu e una de disponibilitate.');
    if (cfg.availability && cfg.availability.length && !cfg.availability.some(x => norm(x) === 'disponibil')) return invalid('availability', 'Valoarea „Disponibil” nu e în lista din CONFIGURARI.');
    const list = Array.isArray(cmd.changes) ? cmd.changes : [];
    if (!list.length || list.length > 7 * 24) return invalid('changes', 'Nicio schimbare de disponibilitate (sau prea multe deodată).');
    const dayCol = {}, hourRow = {};
    for (let c = 2; c <= 8; c++) { const d = dayNumber(s.text(1, c)); if (d) dayCol[d] = c; }
    for (let r = 2; r <= 40; r++) { const hv = s.num(r, 1); if (hv !== null) hourRow[Math.round(hv * 24)] = r; }
    const writes = [], seen = new Set();
    for (const ch of list) {
      const c = dayCol[ch.day], r = hourRow[ch.hour];
      if (!c || !r) return invalid('slot', `Ora ${ch.hour}:00 din ziua ${ch.day} nu există în tabelul de disponibilitate.`);
      const a1 = colLetter(c) + r;
      if (seen.has(a1)) return invalid('changes', 'Aceeași oră apare de două ori în cerere.');
      seen.add(a1);
      const isAv = norm(s.text(r, c)) === 'disponibil', to = !!ch.to;
      if (isAv === to) continue;                                               // already so
      if (ch.was !== undefined && !!ch.was !== isAv) return { ok: false, conflict: true, code: 'stale-availability', msg: `Disponibilitatea din registru s-a schimbat (${DAY_NAMES[ch.day - 1]}, ${ch.hour}:00). Nu am scris nimic.` };
      if (to) writes.push(w(a1, snap(s, r, c), { v: OK }));
      else writes.push(w(a1, snap(s, r, c), { v: null }));
    }
    return writes.length ? planOk(writes) : planOk([], { noop: true });
  },

  /* ---- Replacements (docs/inlocuiri.md): the money of one lesson taught by a substitute teacher ----
     REPL_TAKE (the OLD register, the student's own group): works out what moves from HIS cells (never from the caller): the Calculator's Inlocuire split of
       hours x price over his payments and discounts, and takes it out as one more minus term in each SUM. The amounts go back in `info` (and are what the
       other register is then given). cmd: { type, tab, student: { col, name, phone }, price, hours? }
     REPL_MONEY (either register): adds (positive) or takes out (negative) a payment and a discount of a student, as terms in the SUMs; used to give the
       money to the substitute's tab and, when a mark is changed later, to give it back. cmd: { type, tab, student, ach, red } */
  REPL_TAKE(book, cmd) {
    const s = book.sheet(cmd.tab);
    const col = locate(s, cmd.student);
    if (!col) return NOT_FOUND();
    const price = Number(cmd.price), hours = cmd.hours === undefined ? 1 : Number(cmd.hours);
    if (!(price > 0) || !(hours > 0)) return invalid('price', 'Prețul sau numărul de ore nu e valid.');
    const cA = s.get(3, col.col), cR = s.get(4, col.col), bodyA = sumBody(cA), bodyR = sumBody(cR);
    if (bodyA === null) return invalid('cell-not-numeric', `Celula ${col.letter}3 nu e o sumă pe care o pot continua (are „${cA ? (cA.f || cA.v) : ''}”): trebuie reparată de un om.`);
    if (bodyR === null) return invalid('cell-not-numeric', `Celula ${col.letter}4 nu e o sumă pe care o pot continua (are „${cR ? (cR.f || cR.v) : ''}”): trebuie reparată de un om.`);
    const m = splitReplacement(s.num(3, col.col) || 0, s.num(4, col.col) || 0, price, hours);
    const writes = [];
    const minus = (row, body, amount) => { const term = String(amount); writes.push(w(col.letter + row, snap(s, row, col.col), { f: `SUM(${body === '0' ? '-' + term : body + '-' + term})` })); };
    if (m.ach > 0) minus(3, bodyA, m.ach);
    if (m.red > 0) minus(4, bodyR, m.red);
    const info = { tot: m.tot, ach: m.ach, red: m.red, short: m.short };
    return writes.length ? planOk(writes, { column: col.letter, info }) : planOk([], { noop: true, column: col.letter, info });
  },
  REPL_MONEY(book, cmd) {
    const s = book.sheet(cmd.tab);
    const col = locate(s, cmd.student);
    if (!col) return NOT_FOUND();
    const writes = [];
    for (const [row, key] of [[3, 'ach'], [4, 'red']]) {
      const amount = Number(cmd[key] || 0);
      if (!Number.isFinite(amount) || Math.abs(amount) > 100000 || Math.round(amount * 100) !== amount * 100) return invalid('amount', 'Suma trebuie să aibă cel mult 2 zecimale.');
      if (amount === 0) continue;
      const cell = s.get(row, col.col), body = sumBody(cell);
      if (body === null) return invalid('cell-not-numeric', `Celula ${col.letter}${row} nu e o sumă pe care o pot continua (are „${cell ? (cell.f || cell.v) : ''}”): trebuie reparată de un om.`);
      const term = String(Math.abs(amount));
      writes.push(w(col.letter + row, snap(s, row, col.col), { f: `SUM(${body === '0' ? (amount > 0 ? term : '-' + term) : body + (amount > 0 ? '+' : '-') + term})` }));
    }
    return writes.length ? planOk(writes, { column: col.letter }) : planOk([], { noop: true, column: col.letter });
  },

  /* A replacement tab that already exists for this group and teacher (docs/inlocuiri.md), brought up to date for a new replacement: the state back to
     Inlocuire, the schedule rows of the new dates added (cabinet corrected when the slot is there already; leftover rows stay), and the students that
     joined the base group since added in free columns with the status Inlocuire (money at 0). Students that are in the tab are not touched.
       cmd: { type: 'REPL_TAB_UPDATE', tab, rows: [{ day, hour, cab }], students: [{ name, phone, manager, status }] } */
  REPL_TAB_UPDATE(book, cmd, cfg) {
    const s = book.sheet(cmd.tab);
    if (!/^(grup|individual)/i.test(s.text(1, 1))) return invalid('not-a-group', 'Fila nu e o grupă.');
    const STATE = 'Înlocuire';
    if (cfg.groupState && cfg.groupState.length && !cfg.groupState.includes(STATE)) return invalid('state', `Starea „${STATE}” nu e în lista din CONFIGURARI.`);
    if (cfg.studentStatus && cfg.studentStatus.length && !cfg.studentStatus.includes(STATE)) return invalid('status', `Statutul „${STATE}” nu e în lista din CONFIGURARI.`);
    const writes = [];
    if (s.text(3, 1) !== STATE) writes.push(w('A3', snap(s, 3, 1), { v: STATE }));

    // schedule: what is there plus the new slots, at most six rows
    const cur = [];
    for (let r = 2; r <= 7; r++) { const day = dayNumber(s.text(r, 27)), hn = s.num(r, 28); if (day && hn !== null) cur.push({ day, hour: Math.round(hn * 24), cab: s.text(r, 29) }); }
    const slots = new Map(cur.map(x => [`${x.day}|${x.hour}`, x]));
    for (const x of (cmd.rows || [])) {
      if (!(x.day >= 1 && x.day <= 7) || !Number.isInteger(x.hour) || x.hour < 8 || x.hour > 21) return invalid('schedule', 'Orarul înlocuirii nu e valid.');
      if (x.cab && cfg.cabinet && cfg.cabinet.length && !cfg.cabinet.map(String).includes(String(x.cab))) return invalid('cabinet', `Cabinetul „${x.cab}” nu e în lista din CONFIGURARI.`);
      slots.set(`${x.day}|${x.hour}`, { day: x.day, hour: x.hour, cab: x.cab == null ? '' : String(x.cab) });
    }
    const want = [...slots.values()].sort((a, b) => a.day - b.day || a.hour - b.hour);
    if (want.length > 6) return invalid('schedule-full', 'Fila de înlocuire are deja orar și noile date nu mai încap (cel mult 6 ore în AA2:AC7): închide înlocuirile vechi.');
    for (let i = 0; i < 6; i++) {
      const r = i + 2, t = want[i], rawDay = s.text(r, 27), rawCab = s.text(r, 29), hn = s.num(r, 28);
      if (t) {
        if (dayNumber(rawDay) !== t.day) writes.push(w('AA' + r, snap(s, r, 27), { v: DAY_NAMES[t.day - 1] }));
        if (hn === null || Math.round(hn * 24) !== t.hour) writes.push(w('AB' + r, snap(s, r, 28), { v: t.hour / 24 }));
        if (rawCab !== t.cab) writes.push(w('AC' + r, snap(s, r, 29), { v: t.cab === '' ? null : t.cab }));
      } else {
        if (rawDay) writes.push(w('AA' + r, snap(s, r, 27), { v: null }));
        if (hn !== null || s.text(r, 28)) writes.push(w('AB' + r, snap(s, r, 28), { v: null }));
        if (rawCab) writes.push(w('AC' + r, snap(s, r, 29), { v: null }));
      }
    }

    // students that are not in the tab yet: the first free columns
    const cols = readStudents(s), taken = new Set();
    let added = 0;
    for (const st of (cmd.students || [])) {
      const phone = phoneOf(st.phone), name = String(st.name || '').replace(/\s+/g, ' ').trim();
      if (!phone || name.split(' ').length < 2) return invalid('student', 'Un elev nu are nume și telefon valide.');
      if (locate(s, { name, phone })) continue;
      if (cfg.manager && cfg.manager.length && st.manager && !cfg.manager.includes(st.manager)) return invalid('manager', `Managerul „${st.manager}” nu e în lista din CONFIGURARI.`);
      const free = cols.find(x => !x.head && !x.marks && !taken.has(x.col));
      if (!free) return invalid('no-column', 'Nu mai e nicio coloană liberă (D–Z) în fila de înlocuire.');
      taken.add(free.col);
      const L = free.letter, c = free.col;
      writes.push(w(L + '1', snap(s, 1, c), { v: `${name}${phone}` }));
      if (st.manager) writes.push(w(L + '7', snap(s, 7, c), { v: st.manager }));
      writes.push(w(L + '8', snap(s, 8, c), { v: STATE }));
      added++;
    }
    return writes.length ? planOk(writes, { info: { added } }) : planOk([], { noop: true, info: { added: 0 } });
  },

  /* The replacement is over (docs/inlocuiri.md): the tab goes to Inactiv and its schedule rows are cleared, as a teacher does when a group ends. Only a tab that
     is still Inlocuire is closed (a person may have changed it meanwhile). cmd: { type: 'REPL_CLOSE', tab } */
  REPL_CLOSE(book, cmd, cfg) {
    const s = book.sheet(cmd.tab);
    if (!/^(grup|individual)/i.test(s.text(1, 1))) return invalid('not-a-group', 'Fila nu e o grupă.');
    if (norm(s.text(3, 1)) !== 'inlocuire') return planOk([], { noop: true });
    if (cfg.groupState && cfg.groupState.length && !cfg.groupState.includes('Inactiv')) return invalid('state', 'Starea „Inactiv” nu e în lista din CONFIGURARI.');
    const writes = [w('A3', snap(s, 3, 1), { v: 'Inactiv' })];
    for (let r = 2; r <= 7; r++) {
      if (s.text(r, 27)) writes.push(w('AA' + r, snap(s, r, 27), { v: null }));
      if (s.num(r, 28) !== null || s.text(r, 28)) writes.push(w('AB' + r, snap(s, r, 28), { v: null }));
      if (s.text(r, 29)) writes.push(w('AC' + r, snap(s, r, 29), { v: null }));
    }
    return planOk(writes);
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

/* { days, start, duration, cabinet } -> the schedule rows in the order of the sheet: { rows: [{ day, hour, cab }] } (a two-hour lesson is two rows) */
function scheduleRows(sc, cfg) {
  const days = ((sc && sc.days) || []).map(Number), start = Number(sc && sc.start), duration = Number(sc && sc.duration) || 1;
  if (!days.length || days.some(d => !(d >= 1 && d <= 7)) || new Set(days).size !== days.length || !Number.isInteger(start) || !Number.isInteger(duration) || duration < 1 || start < 8 || start + duration > 22) return invalid('schedule', 'Orarul grupei (zile și oră) nu e valid.');
  if (days.length * duration > 6) return invalid('schedule', 'Registrul are loc pentru cel mult 6 ore de orar pe săptămână (AA2:AC7).');
  const cab = sc.cabinet == null || sc.cabinet === '' ? '' : String(sc.cabinet);
  if (cab && cfg.cabinet && cfg.cabinet.length && !cfg.cabinet.map(String).includes(cab)) return invalid('cabinet', `Cabinetul „${cab}” nu e în lista din CONFIGURARI.`);
  const rows = [];
  days.slice().sort((a, b) => a - b).forEach(d => { for (let h = 0; h < duration; h++) rows.push({ day: d, hour: start + h, cab }); });
  return { ok: true, rows };
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
