/* Checks of the platform -> register writes (scripts/registru-import/sync), on a register held in memory (no Google, no real data).
   Run: npm run check:sync */
'use strict';
const path = require('path');
const R = path.join(__dirname, 'registru-import');
const { MemoryBook } = require(path.join(R, 'sync', 'memory-book'));
const { apply } = require(path.join(R, 'sync', 'apply'));
const { parseWorkbook } = require(path.join(R, 'parse'));

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; if (fails.length < 25) fails.push(m); } };

const CFG = {
  A1: 'Manager', A2: 'Pricinoc Ariadna', A3: 'Cerchez Cristina',
  B1: 'Materia', B2: 'Matematica', C1: 'Clasa', C2: 'XII', D1: 'Nivelul', D2: '9 ― 10', E1: 'Profilul', E2: 'Real',
  F1: 'Starea grupului', F2: 'Activ', G1: 'Statutul elevului', G2: 'Oră de probă', G3: 'Activ', G4: 'Transferat', G5: 'Inactiv', G6: 'Oră de probă confirmată',
  H1: 'Statut participare', H2: 'PRIMA LECȚIE GRATUITĂ', H3: 'PREZENT', H4: 'ABSENT', H5: 'ABSENT MOTIVAT', I1: 'Cabinetul', I2: '14'
};
const cfgCells = {}; Object.keys(CFG).forEach(k => { cfgCells[k] = { v: CFG[k] }; });

/* a group tab: 3 seats, two students (one with a payment typed as a sum), one lost column with marks and no header */
function book() {
  const g = {
    A1: { v: 'Grup cu 3 elevi' }, A3: { v: 'Activ' }, A4: { v: 'Matematica' }, A5: { v: 'XII' }, A6: { v: '9 ― 10' }, A7: { v: 'Real' },
    D1: { v: 'Ionescu Ana+37369123456' }, D2: { v: 0, f: 'D3+D4-D5' }, D3: { v: 608, f: 'sum(1216-608)' }, D4: { v: 0, f: 'sum(0)' }, D7: { v: 'Pricinoc Ariadna' }, D8: { v: 'Activ' },
    E1: { v: 'Popa Mihai+37379111222' }, E3: { v: 0, f: 'sum(0)' }, E4: { v: 0, f: 'sum(0)' }, E7: { v: 'Cerchez Cristina' }, E8: { v: 'Oră de probă' },
    F9: { v: 'PREZENT' }, F10: { v: 'ABSENT' },
    A9: { v: '8 Septembrie' }, B9: { v: 'Puteri' }, A10: { v: '10 Septembrie' }, B10: { v: 'Radicali' },
    D9: { v: 'PREZENT' }, D10: { v: 'PREZENT' }, E9: { v: 'PRIMA LECȚIE GRATUITĂ' }
  };
  return new MemoryBook({ 'Grupa 1': { cells: g }, CONFIGURARI: { hidden: true, cells: cfgCells } }, 'Test Registru EXAMEN.MD OFFLINE 2025-2026.xlsx');
}
const cell = (b, k) => b.cell('Grupa 1', k);
const diff = (before, b) => { const a = JSON.parse(before['Grupa 1']), c = JSON.parse(b.snapshot()['Grupa 1']); return [...new Set([...Object.keys(a), ...Object.keys(c)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(c[k])).sort(); };
const add = (id, extra) => Object.assign({ id, type: 'ADD_STUDENT', tab: 'Grupa 1', name: 'Rusu Elena', phone: '069 555 444', manager: 'Cerchez Cristina', status: 'Oră de probă' }, extra);

// ADD_STUDENT: three cells, in the first free column, nothing else touched
{
  const b = book(), s0 = b.snapshot();
  const r = apply(b, add('c1'));
  ok(r.status === 'done' && r.column === 'G', 'new student goes to the first free column (the lost column F is skipped): ' + JSON.stringify(r));
  ok(JSON.stringify(diff(s0, b)) === JSON.stringify(['G1', 'G7', 'G8']), 'only the header, manager and status cells are written: ' + diff(s0, b));
  ok(cell(b, 'G1').v === 'Rusu Elena+37369555444', 'header in the Name+373 form (phone cleaned)');
  const m = parseWorkbook(b), g = m.groups[0], st = g.students.find(x => x.colLetter === 'G');
  ok(st && st.name === 'Rusu Elena' && st.phone === '+37369555444' && st.phoneKind === 'ok' && st.status === 'Oră de probă' && st.manager === 'Cerchez Cristina', 'the importer reads the new student back exactly');
  ok(g.orphanMarks.length === 1 && g.orphanMarks[0].col === 'F', 'the lost column is still reported, not reused');
}
// ADD_STUDENT: refusals, with nothing written
[
  [{ name: 'Rusu' }, 'name'], [{ phone: '123' }, 'phone'], [{ status: 'Gigel' }, 'status'], [{ manager: 'Nimeni Nimeni' }, 'manager'],
  [{ name: 'Ionescu Ana', phone: '+373 69 123 456' }, 'duplicate'], [{ name: 'Ana Ionescu', phone: '069123456' }, 'duplicate'], [{ type: 'NOPE' }, 'type'], [{ tab: 'Nu exista' }, 'tab']
].forEach(([patch, code]) => {
  const b = book(), s0 = b.snapshot(), r = apply(b, add('x' + code, patch));
  ok(r.status === 'invalid' && r.code === code, 'refused with ' + code + ': ' + JSON.stringify(r));
  ok(JSON.stringify(b.snapshot()) === JSON.stringify(s0) && b.writes.length === 0, 'nothing written when ' + code);
});
{
  // a full group: the 3 seats are taken by Activ / trial students
  const b = book(); apply(b, add('f1', { name: 'Rusu Elena', status: 'Activ' }));
  const r = apply(b, add('f2', { name: 'Sandu Vlad', phone: '068111222', status: 'Activ' }));
  ok(r.status === 'invalid' && r.code === 'group-full', 'a full group refuses a new student');
  ok(apply(b, add('f3', { name: 'Sandu Vlad', phone: '068111222', status: 'Activ', allowOverfill: true })).status === 'done', 'unless overfill is asked for explicitly');
}
// idempotent: the same command id never writes twice
{
  const b = book(), j = new Map();
  const r1 = apply(b, add('same'), j), n = b.writes.length, r2 = apply(b, add('same'), j);
  ok(r1.status === 'done' && r2.status === 'done' && r2.replay && b.writes.length === n, 'a retried command is not written again');
}
// SET_STATUS
{
  const b = book(), s0 = b.snapshot();
  const cmd = { id: 's1', type: 'SET_STATUS', tab: 'Grupa 1', student: { name: 'Popa Mihai', phone: '079111222' }, status: 'Activ', expectStatus: 'Oră de probă' };
  const r = apply(b, cmd);
  ok(r.status === 'done' && JSON.stringify(diff(s0, b)) === JSON.stringify(['E8']) && cell(b, 'E8').v === 'Activ', 'status changed in one cell');
  ok(apply(b, Object.assign({}, cmd, { id: 's2', expectStatus: undefined })).status === 'noop', 'same status again is a no-op');
  const b2 = book(); b2.data['Grupa 1'].cells.E8.v = 'Transferat';
  const r2 = apply(b2, cmd);
  ok(r2.status === 'conflict' && r2.code === 'stale' && b2.writes.length === 0, 'someone changed the status first: conflict, nothing written');
  ok(apply(book(), Object.assign({}, cmd, { id: 's3', status: 'Gigel' })).code === 'status', 'status outside the list is refused');
  ok(apply(book(), Object.assign({}, cmd, { id: 's4', student: { name: 'Necunoscut Om', phone: '079000000' } })).code === 'not-found', 'unknown student');
  const b3 = book(); b3.hooks.afterPlan = (bk) => { bk.data['Grupa 1'].cells.E8.v = 'Inactiv'; };       // changed between our read and our write
  const r3 = apply(b3, Object.assign({}, cmd, { id: 's5', expectStatus: undefined }));
  ok(r3.status === 'conflict' && r3.code === 'changed' && b3.writes.length === 0, 'a change between planning and writing is a conflict, nothing written: ' + JSON.stringify(r3));
  const b4 = book(); b4.hooks.dropWrites = true;
  const r4 = apply(b4, Object.assign({}, cmd, { id: 's6' }));
  ok(r4.status === 'failed' && r4.code === 'verify-failed', 'a write the sheet silently drops is reported: ' + JSON.stringify(r4));
}
// SET_MANAGER
{
  const b = book(), s0 = b.snapshot();
  const r = apply(b, { id: 'm1', type: 'SET_MANAGER', tab: 'Grupa 1', student: { name: 'Ionescu Ana', phone: '069123456' }, manager: 'Cerchez Cristina' });
  ok(r.status === 'done' && JSON.stringify(diff(s0, b)) === JSON.stringify(['D7']), 'manager changed in one cell');
  ok(apply(b, { id: 'm2', type: 'SET_MANAGER', tab: 'Grupa 1', student: { name: 'Ionescu Ana', phone: '069123456' }, manager: 'Cerchez Cristina' }).status === 'noop', 'same manager is a no-op');
}
// payments and discounts: one more term in the sum
{
  const pay = (b, who, amount, type) => apply(b, { id: 'p' + Math.random(), type: type || 'ADD_PAYMENT', tab: 'Grupa 1', student: who, amount });
  const ana = { name: 'Ionescu Ana', phone: '069123456' }, mihai = { name: 'Popa Mihai', phone: '079111222' };
  const b = book(), s0 = b.snapshot();
  ok(pay(b, ana, 300).status === 'done' && cell(b, 'D3').f === 'SUM(1216-608+300)' && cell(b, 'D3').v === 908, 'a payment continues the typed sum: ' + JSON.stringify(cell(b, 'D3')));
  ok(JSON.stringify(diff(s0, b)) === JSON.stringify(['D3']), 'only the payment cell changes');
  ok(pay(b, ana, -100).status === 'done' && cell(b, 'D3').f === 'SUM(1216-608+300-100)' && cell(b, 'D3').v === 808, 'a refund is a minus term');
  ok(pay(b, mihai, 250.5).status === 'done' && cell(b, 'E3').f === 'SUM(250.5)' && cell(b, 'E3').v === 250.5, 'sum(0) becomes the first payment, not 0+250.5');
  ok(pay(b, ana, 50, 'ADD_DISCOUNT').status === 'done' && cell(b, 'D4').f === 'SUM(50)', 'a discount goes to row 4');
  ['x', 0, NaN, 1.234, 1e9].forEach(a => ok(pay(book(), ana, a).code === 'amount', 'amount refused: ' + a));
  const bad = book(); bad.data['Grupa 1'].cells.D3 = { v: 'h' };
  ok(pay(bad, ana, 10).code === 'cell-not-numeric' && bad.writes.length === 0, 'a text in the payment cell needs a human, nothing written');
  const empty = book(); delete empty.data['Grupa 1'].cells.E3;
  ok(pay(empty, mihai, 100).status === 'done' && cell(empty, 'E3').f === 'SUM(100)', 'an empty payment cell starts a sum');
  const race = book(); race.hooks.afterPlan = bk => { bk.data['Grupa 1'].cells.D3 = { v: 999, f: 'sum(999)' }; };
  const rr = pay(race, ana, 5);
  ok(rr.status === 'conflict' && cell(race, 'D3').f === 'sum(999)', 'a payment typed by a manager meanwhile is not overwritten: ' + JSON.stringify(rr));
}
console.log(`SYNC: ${pass} checks passed, ${fail} failed`);
if (fail) { console.log(fails.join('\n')); process.exit(1); }
