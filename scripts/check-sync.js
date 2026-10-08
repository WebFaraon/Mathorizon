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
// a student given by his column number: trusted only while the header is still his
{
  const who = { col: 5, name: 'Popa Mihai', phone: '+37379111222' };            // E
  const b = book();
  const r1 = apply(b, { id: 'c1', type: 'SET_STATUS', tab: 'Grupa 1', student: who, status: 'Activ', expectStatus: 'Oră de probă' });
  ok(r1.status === 'done' && cell(b, 'E8').v === 'Activ', 'by column: the status of the student in column E changes');
  const moved = book(); moved.data['Grupa 1'].cells.E1 = { v: 'Altcineva Ion+37360000000' };
  const r2 = apply(moved, { id: 'c2', type: 'ADD_PAYMENT', tab: 'Grupa 1', student: who, amount: 100 });
  ok(r2.status === 'invalid' && r2.code === 'not-found' && moved.writes.length === 0, 'by column: a header that is not his any more refuses the payment, nothing written');
  const r3 = apply(book(), { id: 'c3', type: 'SET_MANAGER', tab: 'Grupa 1', student: Object.assign({}, who, { phone: '+37369999999' }), manager: 'Pricinoc Ariadna' });
  ok(r3.code === 'not-found', 'by column: a different phone is refused too');
  const r4 = apply(book(), { id: 'c4', type: 'SET_MANAGER', tab: 'Grupa 1', student: { col: 12, name: 'Nimeni Nimeni' }, manager: 'Pricinoc Ariadna' });
  ok(r4.code === 'not-found', 'by column: an empty column is not a student');
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
// ── the reading side (F1): a register's values -> the parser -> one replace per changed group ──
(async () => {
  const core = 'file:///' + path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'registru', 'sync-core.mjs').replace(/\\/g, '/');
  const { syncWorkbook } = await import(core);
  const grid = bk => ({ title: 'Test Registru EXAMEN.MD OFFLINE 2025-2026', tabs: bk.sheetNames.map((n, i) => { const sh = bk.sheet(n), rows = []; for (let r = 1; r <= 198; r++) { const row = []; for (let c = 1; c <= 29; c++) { const x = sh.get(r, c); row.push(x ? x.v : ''); } rows.push(row); } return { title: n, sheetId: 100 + i, hidden: bk.hidden(n), values: n === 'CONFIGURARI' ? null : rows }; }) });
  const mem = () => { const store = new Map(); return { store, hashes: async () => new Map([...store].map(([k, v]) => [k, v.content_hash])), applyGroup: async (id, p) => { store.set(String(p.sheet_id), p); }, prune: async (id, keep) => { let n = 0; [...store.keys()].forEach(k => { if (!keep.map(String).includes(k)) { store.delete(k); n++; } }); return n; } }; };
  const wb = { id: 'w1', spreadsheet_id: 'x' };
  {
    const db = mem(), data = grid(book());
    const r1 = await syncWorkbook({ wb, read: async () => data, db });
    ok(r1.seen === 1 && r1.changed === 1 && r1.skipped.length === 0, 'first read stores the group: ' + JSON.stringify(r1));
    const g = db.store.get('100');
    ok(g && g.format_size === 3 && g.subject === 'Matematica' && g.students.length === 2 && g.lessons.length === 2, 'the stored group has its students and lessons');
    ok(g.students[0].phone === '+37369123456' && g.students[0].paid === 608 && g.lessons[0].iso === '2025-09-08' && g.lessons[0].marks.D === 'P' && g.lessons[0].marks.E === 'G', 'phone, payment, date with the school year and marks are read: ' + JSON.stringify(g.lessons[0]));
    const r2 = await syncWorkbook({ wb, read: async () => data, db });
    ok(r2.changed === 0 && r2.unchanged === 1, 'nothing changed: nothing rewritten');
    const d2 = grid(book()); d2.tabs[0].values[8][3] = 'ABSENT';
    const r3 = await syncWorkbook({ wb, read: async () => d2, db });
    ok(r3.changed === 1 && db.store.get('100').lessons[0].marks.D === 'A', 'one changed mark replaces the group');
    const d3 = grid(book()); d3.tabs[0].values[0][0] = 'Grup cu 7 elevi';
    const db3 = mem(); const r4 = await syncWorkbook({ wb, read: async () => d3, db: db3 });
    ok(r4.skipped.length === 1 && r4.changed === 0 && db3.store.size === 0, 'a wrong format is not stored: ' + JSON.stringify(r4.skipped));
    const empty = { title: 'X', tabs: [{ title: 'Total achitări', sheetId: 1, values: [] }] };
    let threw = false; try { await syncWorkbook({ wb, read: async () => empty, db }); } catch (e) { threw = true; }
    ok(threw && db.store.size === 1, 'a register that suddenly shows no group fails and deletes nothing');
    const gone = grid(book()); gone.tabs = gone.tabs.filter(t => t.title === 'CONFIGURARI').concat([{ title: 'Alta', sheetId: 555, hidden: false, values: grid(book()).tabs[0].values }]);
    const r5 = await syncWorkbook({ wb, read: async () => gone, db });
    ok(r5.pruned === 1 && db.store.has('555') && !db.store.has('100'), 'a deleted tab leaves the platform');
    // the file's modifiedTime: same time and a fresh full read -> not read at all
    let reads = 0; const peek = async () => 'T1';
    const wbm = { id: 'w1', spreadsheet_id: 'x', drive_modified: 'T1', last_full_sync_at: new Date().toISOString() };
    const r6 = await syncWorkbook({ wb: wbm, read: async () => { reads++; return data; }, peek, db });
    ok(!r6.full && reads === 0, 'unchanged file: no read from Google');
    const r7 = await syncWorkbook({ wb: Object.assign({}, wbm, { drive_modified: 'T0' }), read: async () => { reads++; return data; }, peek, db });
    ok(r7.full && reads === 1 && r7.modified === 'T1', 'changed file: read');
    const r8 = await syncWorkbook({ wb: Object.assign({}, wbm, { last_full_sync_at: new Date(Date.now() - 2 * 864e5).toISOString() }), read: async () => { reads++; return data; }, peek, db });
    ok(r8.full && reads === 2, 'a full read at least once a day even if the file looks unchanged');
    const r7f = await syncWorkbook({ wb: wbm, read: async () => { reads++; return data; }, peek, db, force: true });
    ok(r7f.full && r7f.changed === 0, 'force: read even when the file looks unchanged (right after a write of ours)');
  }
  // ── F2: the same commands against a live register (Google Sheets) through the async adapter: load, read, write ──
  {
    const { applyAsync } = await import('file:///' + path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'registru', 'apply.mjs').replace(/\\/g, '/'));
    const live = (hooks) => {
      const bk = book(), calls = { read: 0, write: 0 };
      return {
        bk, calls,
        load: async () => bk,
        read: async (tab, keys) => { calls.read++; if (hooks && hooks.beforeRead) { hooks.beforeRead(bk); hooks.beforeRead = null; } const o = {}; keys.forEach(k => { const c = bk.cell(tab, k); o[k] = c ? { v: c.v, f: c.f } : { v: null }; }); return o; },
        write: async (tab, cells) => { calls.write++; if (!(hooks && hooks.drop)) bk.set(tab, cells); }
      };
    };
    const A = live();
    const r1 = await applyAsync(A, add('a1'));
    ok(r1.status === 'done' && r1.column === 'G' && A.calls.write === 1 && cell(A.bk, 'G1').v === 'Rusu Elena+37369555444', 'async: the student is written in one call: ' + JSON.stringify(r1));
    const r2 = await applyAsync(A, add('a2'));
    ok(r2.status === 'invalid' && r2.code === 'duplicate' && A.calls.write === 1 && A.calls.read === 2, 'async: the same student again is refused before any read or write');
    const B = live({ beforeRead: bk => { bk.data['Grupa 1'].cells.G1 = { v: 'Altcineva Ion+37360000000' }; } });
    const r3 = await applyAsync(B, add('a3'));
    ok(r3.status === 'conflict' && r3.code === 'changed' && B.calls.write === 0, 'async: a cell taken between planning and the re-read is a conflict, nothing written: ' + JSON.stringify(r3));
    const C = live({ drop: true });
    const r4 = await applyAsync(C, add('a4'));
    ok(r4.status === 'failed' && r4.code === 'verify-failed' && C.calls.write === 1, 'async: a write that did not stick is reported');
    const D2 = live();
    const r5 = await applyAsync(D2, { id: 'a5', type: 'ADD_PAYMENT', tab: 'Grupa 1', student: { name: 'Ionescu Ana', phone: '069123456' }, amount: 300 });
    ok(r5.status === 'done' && cell(D2.bk, 'D3').f === 'SUM(1216-608+300)', 'async: a payment continues the sum');
    const r6 = await applyAsync(D2, { id: 'a6', type: 'SET_STATUS', tab: 'Grupa 1', student: { name: 'Ionescu Ana', phone: '069123456' }, status: 'Activ' });
    ok(r6.status === 'noop' && D2.calls.write === 1, 'async: the status it already has is a no-op');
  }
  // ── TRANSFER: two phases, in two registers (or one), with the Calculator's split of the money ──
  {
    const { applyTransferAsync } = await import('file:///' + path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'registru', 'apply.mjs').replace(/\\/g, '/'));
    const { splitMoney } = await import('file:///' + path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'registru', 'pay.mjs').replace(/\\/g, '/'));
    const mk = (cells) => new MemoryBook({ 'Grupa 1': { cells }, CONFIGURARI: { hidden: true, cells: cfgCells } }, 'Test Registru EXAMEN.MD OFFLINE 2025-2026.xlsx');
    const fromBook = (extra) => { const b = book(); Object.assign(b.data['Grupa 1'].cells, { D5: { v: 300, f: 'x' } }, extra || {}); return b; };       // he paid 608, the lessons cost 300
    const toBook = () => mk({ A1: { v: 'Grup cu 3 elevi' }, A3: { v: 'Activ' }, A4: { v: 'Matematica' }, F9: {}, E3: { v: 0, f: 'sum(0)' }, E4: { v: 0, f: 'sum(0)' }, D3: { v: 0, f: 'sum(0)' }, D4: { v: 0, f: 'sum(0)' } });
    const adapter = (bk, tab, hooks) => ({
      calls: { read: 0, write: 0 },
      load: async () => bk,
      read: async function (tb, keys) { this.calls.read++; if (hooks && hooks.beforeRead) { hooks.beforeRead(bk); hooks.beforeRead = null; } const o = {}; keys.forEach(k => { const c = bk.cell(tb, k); o[k] = c ? { v: c.v, f: c.f } : { v: null }; }); return o; },
      write: async function (tb, cells) { this.calls.write++; if (hooks && hooks.failWrite) { hooks.failWrite--; throw new Error('Google 500: simulat'); } bk.set(tb, cells); }
    });
    const cmdT = (id, o) => Object.assign({ id, type: 'TRANSFER', fromTab: 'Grupa 1', toTab: 'Grupa 1', student: { col: 4, name: 'Ionescu Ana', phone: '+37369123456' }, status: 'Activ', manager: 'Pricinoc Ariadna' }, o);

    // the split itself (the numbers of the Calculator)
    { const m = splitMoney(608, 0, 300); ok(m.achC === 300 && m.achRem === 308 && m.redRem === 0 && m.debt === 0, 'split: paid 608, lessons 300 -> 300 stays, 308 moves'); }
    { const m = splitMoney(1000, 200, 600); ok(m.achC === 500 && m.redC === 100 && m.achRem === 500 && m.redRem === 100, 'split: payments and discounts share the cost by their weight: ' + JSON.stringify(m)); }
    { const m = splitMoney(300, 100, 500); ok(m.achRem === 0 && m.redRem === 0 && m.debt === 100, 'split: the lessons cost more than he paid -> nothing moves, the debt stays'); }

    // two registers: both phases
    {
      const F = fromBook(), T = toBook(), aF = adapter(F), aT = adapter(T);
      const r = await applyTransferAsync({ from: aF, to: aT }, cmdT('t1', { toTab: 'Grupa 1' }));
      const E = r.column;
      ok(r.status === 'done' && r.split.achRem === 308 && aT.calls.write === 1 && aF.calls.write === 1, 'transfer: both phases written, one write per register: ' + JSON.stringify({ s: r.status, c: r.column, m: r.msg }));
      ok(T.cell('Grupa 1', E + '1').v === 'Ionescu Ana+37369123456' && T.cell('Grupa 1', E + '8').v === 'Activ' && T.cell('Grupa 1', E + '7').v === 'Pricinoc Ariadna' && T.cell('Grupa 1', E + '3').f === 'SUM(308)', 'new group: the column has his header, status, manager and the 308 that moved');
      ok(F.cell('Grupa 1', 'D8').v === 'Transferat' && F.cell('Grupa 1', 'D3').f === 'SUM(1216-608-308)' && F.cell('Grupa 1', 'D4').f === 'sum(0)', 'old group: Transferat, and the moved 308 taken out as one more term (what was typed stays)');
      const again = await applyTransferAsync({ from: aF, to: aT }, cmdT('t1b'));
      ok(again.status === 'noop' && aT.calls.write === 1 && aF.calls.write === 1, 'the same transfer again changes nothing');
    }
    // a failure in phase 2, then the retry finishes it without a second column
    {
      const F = fromBook(), T = toBook(), aF = adapter(F, null, { failWrite: 1 }), aT = adapter(T);
      const r1 = await applyTransferAsync({ from: aF, to: aT }, cmdT('t2'));
      const cols = () => { let n = 0; for (let c = 4; c <= 26; c++) if (T.sheet('Grupa 1').text(1, c)) n++; return n; };
      ok(r1.status === 'failed' && r1.code === 'half-done' && r1.phase === 2 && cols() === 1 && F.cell('Grupa 1', 'D8').v === 'Activ', 'phase 2 fails: reported as half-done, he is in the new group, the old one is untouched: ' + JSON.stringify({ c: r1.code, m: r1.msg && r1.msg.slice(0, 60) }));
      const r2 = await applyTransferAsync({ from: aF, to: aT }, cmdT('t2b'));
      ok(r2.status === 'done' && r2.resumed === true && cols() === 1 && F.cell('Grupa 1', 'D8').v === 'Transferat' && F.cell('Grupa 1', 'D3').f === 'SUM(1216-608-308)', 'the retry only finishes phase 2: still one column in the new group, the old one closed');
    }
    // refusals: nothing is written
    {
      const F = fromBook(), T = toBook(), aF = adapter(F), aT = adapter(T);
      const r = await applyTransferAsync({ from: aF, to: aT }, cmdT('t3', { expect: { A: 608, R: 0, C: 500 } }));
      ok(r.status === 'conflict' && r.code === 'stale-money' && aT.calls.write === 0 && aF.calls.write === 0, 'the money on screen is not the sheet\'s any more: conflict, nothing written');
      const bad = fromBook(); bad.data['Grupa 1'].cells.D8 = { v: 'Inactiv' };
      const r2 = await applyTransferAsync({ from: adapter(bad), to: adapter(toBook()) }, cmdT('t4'));
      ok(r2.status === 'invalid' && r2.code === 'not-active', 'an Inactiv student is not transferred');
      const text = fromBook(); text.data['Grupa 1'].cells.D3 = { v: 'h' };
      const r3 = await applyTransferAsync({ from: adapter(text), to: adapter(toBook()) }, cmdT('t5'));
      ok(r3.code === 'cell-not-numeric', 'a text in the payment cell needs a human');
      const full = toBook(); ['D', 'E', 'F'].forEach((L, i) => { full.data['Grupa 1'].cells[L + '1'] = { v: 'Elev' + i + ' Unu+3736900000' + i }; full.data['Grupa 1'].cells[L + '8'] = { v: 'Activ' }; });
      const r4 = await applyTransferAsync({ from: adapter(fromBook()), to: adapter(full) }, cmdT('t6'));
      ok(r4.code === 'group-full', 'a full group does not take him');
      const r5 = await applyTransferAsync({ from: adapter(fromBook()), to: adapter(toBook()) }, cmdT('t7', { status: 'Gigel' }));
      ok(r5.code === 'status', 'a status outside the list of the new group is refused');
      const r6 = await applyTransferAsync({ from: adapter(fromBook()), to: adapter(toBook()) }, cmdT('t8', { student: { col: 4, name: 'Altcineva Ion', phone: '+37369123456' } }));
      ok(r6.code === 'not-found', 'a column that is not his is refused');
      const T9 = toBook(), F9 = fromBook(), aF9 = adapter(F9), aT9 = adapter(T9, null, { beforeRead: bk => { bk.data['Grupa 1'].cells.D1 = { v: 'Altcineva Ion+37360000000' }; } });
      const r7 = await applyTransferAsync({ from: aF9, to: aT9 }, cmdT('t9'));
      ok(r7.status === 'conflict' && r7.code === 'changed' && aT9.calls.write === 0 && aF9.calls.write === 0, 'a cell taken in the new group between planning and writing: conflict, nothing written');
    }
    // the debt case: nothing moves but the student is still marked Transferat; his debt stays
    {
      const F = fromBook({ D5: { v: 800, f: 'x' } }), T = toBook(), aF = adapter(F), aT = adapter(T);
      const r = await applyTransferAsync({ from: aF, to: aT }, cmdT('t10'));
      ok(r.status === 'done' && r.split.debt === 192 && r.split.achRem === 0 && T.cell('Grupa 1', r.column + '3').f === 'sum(0)' && F.cell('Grupa 1', 'D3').f === 'sum(1216-608)' && F.cell('Grupa 1', 'D8').v === 'Transferat', 'debt: 608 paid, lessons 800 -> nothing moves, his sums stay, the debt of 192 stays in the old group');
    }
    // one register, two tabs
    {
      const b = new MemoryBook({ 'Grupa 1': { cells: Object.assign({}, book().data['Grupa 1'].cells, { D5: { v: 300, f: 'x' } }) }, 'Grupa 2': { cells: { A1: { v: 'Grup cu 3 elevi' }, E3: { v: 0, f: 'sum(0)' }, E4: { v: 0, f: 'sum(0)' }, D3: { v: 0, f: 'sum(0)' }, D4: { v: 0, f: 'sum(0)' } } }, CONFIGURARI: { hidden: true, cells: cfgCells } }, 'Test.xlsx');
      const a = adapter(b);
      const r = await applyTransferAsync({ from: a, to: a }, cmdT('t11', { toTab: 'Grupa 2' }));
      ok(r.status === 'done' && b.cell('Grupa 2', r.column + '1').v === 'Ionescu Ana+37369123456' && b.cell('Grupa 1', 'D8').v === 'Transferat', 'one register, two tabs: the same two phases');
    }
  }
  // ── NEW_GROUP: a new tab in the teacher's register, filled in, listed in Total achitari, with its first student ──
  {
    const { applyNewGroupAsync } = await import('file:///' + path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'registru', 'apply.mjs').replace(/\\/g, '/'));
    const cfgG = Object.assign({}, cfgCells, { B3: { v: 'Matematica (Vara)' }, D3: { v: '4 ― 5' }, D4: { v: '9 ― 10' }, F3: { v: 'Se completează' }, I3: { v: '13' } });
    const total = (n) => { const c = { D1: { v: 'Data' } }; for (let i = 0; i < n; i++) c[String.fromCharCode(70 + i % 20) + '4'] = { v: 'x' }; return c; };
    const totalCells = n => { const c = {}; for (let i = 0; i < n; i++) { const col = 6 + i; const L = col <= 26 ? String.fromCharCode(64 + col) : 'A' + String.fromCharCode(64 + col - 26); c[L + '4'] = { v: 'Grupa ' + i }; } return c; };
    const orar = () => ({ A1: { v: 'Grup cu 6 elevi' }, A3: { v: 'Starea grupului' }, A4: { v: 'Materia' }, A5: { v: 'Clasa' }, A6: { v: 'Nivelul' }, A7: { v: 'Profilul' }, D3: { v: 0, f: 'sum(0)' }, D4: { v: 0, f: 'sum(0)' }, AA9: { v: 'Nivelul Profesorului 4' }, AA198: { v: 'Nivelul Profesorului 4' }, D5: { v: 0, f: 'LET(x)' } });
    const reg = (o, hooks) => {
      o = o || {};
      const spec = { 'Total achitări': { cells: totalCells(o.total == null ? 3 : o.total) } };
      if (o.noTotal) delete spec['Total achitări'];
      if (!o.noOrar) spec['Orar 1'] = { cells: orar() };
      spec['Grupa 1'] = { cells: Object.assign({}, book().data['Grupa 1'].cells) };
      spec.CONFIGURARI = { hidden: true, cells: cfgG };
      const bk = new MemoryBook(spec, 'x.xlsx'), ids = {}; let n = 100; const calls = { duplicate: 0, batch: 0 };
      return {
        bk, calls,
        tabs: async () => bk.sheetNames.map(nm => ({ title: nm, sheetId: ids[nm] || (ids[nm] = ++n), hidden: bk.data[nm].hidden })),
        load: async () => bk,
        read: async (tab, keys) => { const out = {}; keys.forEach(k => { const c = bk.cell(tab, k); out[k] = c ? { v: c.v, f: c.f } : { v: null }; }); return out; },
        duplicate: async (src, title) => { calls.duplicate++; bk.addSheet(title, bk.data[src].cells); ids[title] = ++n; return { sheetId: ids[title] }; },
        remove: async tt => bk.removeSheet(tt),
        batchWrite: async ({ clears, cells }) => { calls.batch++; if (hooks && hooks.failBatch) throw new Error('Google 500: simulat'); clears.forEach(c => bk.clearRange(c.tab, c.range)); Object.keys(cells).forEach(tb => bk.set(tb, cells[tb])); },
        write: async (tab, cells) => { bk.set(tab, cells); }
      };
    };
    const G = (o) => Object.assign({ size: 3, subject: 'Matematica', summer: false, grade: 'XI', profile: 'Real', level: '9-10', days: [2, 4], start: 16, duration: 1, cabinet: '13', teacherLevel: 5, state: 'Se completează' }, o || {});
    const S = { name: 'Rusu Elena', phone: '069 555 444', manager: 'Cerchez Cristina', status: 'Oră de probă' };
    const cmdG = (id, g, st) => ({ id, type: 'NEW_GROUP', group: G(g), student: st === undefined ? S : st });

    {
      const R = reg(), r = await applyNewGroupAsync(R, cmdG('n1'));
      const tab = 'Marți/Joi 16:00-17:00', c = k => R.bk.cell(tab, k) || {};
      ok(r.status === 'done' && r.tab === tab && r.source === 'Orar 1' && r.totalListed && r.column === 'D', 'new group: tab created from Orar 1, listed in Total, student written: ' + JSON.stringify({ s: r.status, t: r.tab, m: r.msg }));
      ok(c('A1').v === 'Grup cu 3 elevi' && c('A3').v === 'Se completează' && c('A4').v === 'Matematica' && c('A5').v === 'XI' && c('A6').v === '9 ― 10' && c('A7').v === 'Real', 'new group: format, state, subject, class, level, profile');
      ok(c('AA2').v === 'Marți' && Math.abs(c('AB2').v - 16 / 24) < 1e-9 && c('AC2').v === '13' && c('AA3').v === 'Joi' && !c('AA4').v, 'new group: the schedule, one row per day and hour, with the cabinet');
      ok(c('AA9').v === 'Nivelul Profesorului 5' && c('AA198').v === 'Nivelul Profesorului 5' && c('D3').f === 'sum(0)' && c('D5').f === 'LET(x)', 'new group: the teacher level on every row, payments back to sum(0), the sheet formulas kept');
      ok(c('D1').v === 'Rusu Elena+37369555444' && c('D7').v === 'Cerchez Cristina' && c('D8').v === 'Oră de probă', 'new group: the first student in the first column');
      ok(R.bk.cell('Total achitări', 'I4').v === tab, 'new group: its name is the next free cell of the Total list (F4:AI4)');
      const r2 = await applyNewGroupAsync(R, cmdG('n2', null, null));
      ok(r2.status === 'done' && r2.tab === tab + ' (2)', 'a second group with the same schedule gets another name: ' + r2.tab);
    }
    {
      const R = reg({ noOrar: true }), r = await applyNewGroupAsync(R, cmdG('n3', { days: [1, 3], start: 12 }, null));
      const tab = r.tab, kept = R.bk.data['Grupa 1'].cells;
      const noStudents = ![4, 5, 6, 7].some(i => R.bk.cell(tab, String.fromCharCode(64 + i) + '1')) && !R.bk.cell(tab, 'D9') && !R.bk.cell(tab, 'B9') && !R.bk.cell(tab, 'A9') && !R.bk.cell(tab, 'F9');
      ok(r.status === 'done' && r.source === 'Grupa 1' && noStudents && !R.bk.cell(tab, 'D8') && !R.bk.cell(tab, 'D7'), 'no Orar 1: a real group tab is copied and then cleaned (no students, lessons, marks, manager, status) ');
      ok(kept.D1 && kept.D9 && R.bk.cell('Grupa 1', 'D1').v === 'Ionescu Ana+37369123456', 'the group it was copied from is not touched');
    }
    {
      const R = reg({ total: 30 }), r = await applyNewGroupAsync(R, cmdG('n4'));
      ok(r.status === 'invalid' && r.code === 'total-full' && R.calls.duplicate === 0, 'Total list full: refused before anything is created');
      const R2 = reg({ noTotal: true }), r2 = await applyNewGroupAsync(R2, cmdG('n5'));
      ok(r2.status === 'done' && r2.totalListed === false, 'no Total tab: the group is still created (and the answer says it is not listed)');
    }
    {
      const R = reg({}, { failBatch: true }), before = R.bk.sheetNames.slice();
      const r = await applyNewGroupAsync(R, cmdG('n6'));
      ok(r.status === 'failed' && r.code === 'new-group-failed' && JSON.stringify(R.bk.sheetNames) === JSON.stringify(before), 'the write fails: the new tab is deleted again, nothing is left behind');
    }
    {
      const bad = [[{ size: 7 }, 'size'], [{ subject: 'Gigel' }, 'subject'], [{ grade: 'XIII' }, 'grade'], [{ profile: null }, 'profile'], [{ level: '1-2' }, 'level'], [{ days: [] }, 'schedule'], [{ days: [1, 2, 3, 4], duration: 2 }, 'schedule'], [{ cabinet: '99' }, 'cabinet'], [{ teacherLevel: 9 }, 'teacher-level'], [{ state: 'Altceva' }, 'state']];
      for (const [g, code] of bad) { const R = reg(), r = await applyNewGroupAsync(R, cmdG('b' + code, g)); ok(r.status === 'invalid' && r.code === code && R.calls.duplicate === 0, 'refused (' + code + '), nothing created'); }
      const R = reg(), r = await applyNewGroupAsync(R, cmdG('bs', null, Object.assign({}, S, { phone: '123' })));
      ok(r.status === 'invalid' && r.code === 'phone' && r.onStudent && R.calls.duplicate === 0, 'a bad phone of the first student is refused BEFORE the tab is created');
      const R3 = reg(), r3 = await applyNewGroupAsync(R3, cmdG('bsum', { summer: true, subject: 'Matematica' }, null));
      ok(r3.status === 'done' && R3.bk.cell(r3.tab, 'A4').v === 'Matematica (Vara)' && / \(Vara\)$/.test(r3.tab), 'a summer group: "(Vara)" in the subject and in the tab name');
    }
  }
  // ── SET_GROUP: the state (A3) and the schedule (AA2:AC7) of a group, only when the person saw the current values ──
  const { applyAsync } = await import('file:///' + path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'registru', 'apply.mjs').replace(/\\/g, '/'));
  {
    const cfgS = Object.assign({}, cfgCells, { F3: { v: 'Se completează' }, F4: { v: 'Inactiv' }, I3: { v: '13' }, I4: { v: '15' } });
    const mkS = (extra, hooks) => {
      const cells = Object.assign({ A1: { v: 'Grup cu 3 elevi' }, A3: { v: 'Activ' }, AA2: { v: 'Marți' }, AB2: { v: 16 / 24 }, AC2: { v: '14' }, AA3: { v: 'Joi' }, AB3: { v: 16 / 24 }, AC3: { v: '14' } }, extra || {});
      const bk = new MemoryBook({ 'Grupa 1': { cells }, CONFIGURARI: { hidden: true, cells: cfgS } }, 'x.xlsx');
      const calls = { write: 0 };
      return {
        bk, calls,
        load: async () => bk,
        read: async (tab, keys) => { const out = {}; keys.forEach(k => { const c = bk.cell(tab, k); out[k] = c ? { v: c.v, f: c.f } : { v: null }; }); return out; },
        write: async (tab, cells) => { calls.write++; if (hooks && hooks.before) hooks.before(bk); bk.set(tab, cells); }
      };
    };
    const SG = (o) => Object.assign({ id: 'sg' + Math.random(), type: 'SET_GROUP', tab: 'Grupa 1' }, o);
    const cc = (R, k) => R.bk.cell('Grupa 1', k) || {};
    const sch = (o) => Object.assign({ days: [2, 4], start: 16, duration: 1, cabinet: '14' }, o || {});
    {
      const R = mkS(), r = await applyAsync(R, SG({ state: 'Inactiv', expect: { state: 'Activ' } }));
      ok(r.status === 'done' && cc(R, 'A3').v === 'Inactiv' && r.writes.length === 1, 'group state changed in one cell (A3)');
      const r2 = await applyAsync(R, SG({ state: 'Inactiv' }));
      ok(r2.status === 'noop', 'the same state again is a no-op');
      const R2 = mkS(); R2.bk.data['Grupa 1'].cells.A3.v = 'Se completează';
      const r3 = await applyAsync(R2, SG({ state: 'Inactiv', expect: { state: 'Activ' } }));
      ok(r3.status === 'conflict' && r3.code === 'stale-state' && R2.calls.write === 0, 'the state changed in the sheet meanwhile: conflict, nothing written');
      ok((await applyAsync(mkS(), SG({ state: 'Gigel' }))).code === 'state', 'a state outside the list is refused');
    }
    {
      // a move: the hour changes (one cell per row), the cabinet changes (the two cabinet cells), the days stay
      const R = mkS(), r = await applyAsync(R, SG({ schedule: sch({ start: 18, cabinet: '13' }), expect: { schedule: sch() } }));
      ok(r.status === 'done' && cc(R, 'AA2').v === 'Marți' && Math.abs(cc(R, 'AB2').v - 18 / 24) < 1e-9 && Math.abs(cc(R, 'AB3').v - 18 / 24) < 1e-9 && cc(R, 'AC2').v === '13' && cc(R, 'AC3').v === '13' && r.writes.length === 4, 'a move: new hour and cabinet on both rows, the days not rewritten: ' + JSON.stringify(r.writes && r.writes.map(x => x.a1)));
      const r2 = await applyAsync(R, SG({ schedule: sch({ start: 18, cabinet: '13' }), expect: { schedule: sch() } }));
      ok(r2.status === 'noop', 'the same move again (the sheet already has it) is a no-op, not a conflict');
    }
    {
      // other days and a second hour: rows are added, leftovers cleared
      const R = mkS(), r = await applyAsync(R, SG({ schedule: sch({ days: [1, 3, 5], duration: 2, start: 10 }), expect: { schedule: sch() } }));
      const rows = [2, 3, 4, 5, 6, 7].map(i => [cc(R, 'AA' + i).v, cc(R, 'AB' + i).v == null ? null : Math.round(cc(R, 'AB' + i).v * 24), cc(R, 'AC' + i).v || null]);
      ok(r.status === 'done' && JSON.stringify(rows) === JSON.stringify([['Luni', 10, '14'], ['Luni', 11, '14'], ['Miercuri', 10, '14'], ['Miercuri', 11, '14'], ['Vineri', 10, '14'], ['Vineri', 11, '14']]), 'other days and two hours: six rows, one per hour: ' + JSON.stringify(rows));
      const R2 = mkS(), r2 = await applyAsync(R2, SG({ schedule: sch({ days: [2], cabinet: '' }), expect: { schedule: sch() } }));
      ok(r2.status === 'done' && cc(R2, 'AA3').v == null && cc(R2, 'AB3').v == null && cc(R2, 'AC3').v == null && cc(R2, 'AC2').v == null && cc(R2, 'AA2').v === 'Marți', 'fewer days and no cabinet: the leftover row and the cabinets are cleared');
    }
    {
      const R = mkS({ AB2: { v: 17 / 24 } }), r = await applyAsync(R, SG({ schedule: sch({ start: 18 }), expect: { schedule: sch() } }));
      ok(r.status === 'conflict' && r.code === 'stale-schedule' && R.calls.write === 0, 'the schedule was changed in the sheet meanwhile: conflict, nothing written');
      const R2 = mkS(), real = R2.read;
      let n = 0; R2.read = async (tab, keys) => { if (++n === 1) R2.bk.data['Grupa 1'].cells.AB3.v = 17 / 24; return real(tab, keys); };
      const r2 = await applyAsync(R2, SG({ schedule: sch({ start: 18 }), expect: { schedule: sch() } }));
      ok(r2.status === 'conflict' && r2.code === 'changed' && R2.calls.write === 0, 'a cell changed between the plan and the write: conflict, nothing written: ' + r2.status);
    }
    {
      const R = mkS({ AC2: { v: '14' }, AC3: { v: null } }), r = await applyAsync(R, SG({ schedule: sch({ start: 17 }), expect: { schedule: sch() } }));
      ok(r.status === 'done', 'a cabinet on one row only is read as the group cabinet (no false conflict)');
      const bad = [[{ days: [] }, 'schedule'], [{ days: [2, 2] }, 'schedule'], [{ days: [1, 2, 3, 4], duration: 2 }, 'schedule'], [{ start: 7 }, 'schedule'], [{ start: 22 }, 'schedule'], [{ cabinet: '99' }, 'cabinet']];
      for (const [s, code] of bad) { const R3 = mkS(), r3 = await applyAsync(R3, SG({ schedule: sch(s) })); ok(r3.status === 'invalid' && r3.code === code && R3.calls.write === 0, 'refused (' + code + '): ' + JSON.stringify(s)); }
      ok((await applyAsync(mkS({ A1: { v: 'Total' } }), SG({ state: 'Activ' }))).code === 'not-a-group', 'a tab that is not a group is refused');
      ok((await applyAsync(mkS(), SG({}))).code === 'empty', 'a command that asks for nothing is refused');
      const R4 = mkS(), r4 = await applyAsync(R4, SG({ state: 'Inactiv', schedule: sch({ start: 19 }), expect: { state: 'Activ', schedule: sch() } }));
      ok(r4.status === 'done' && cc(R4, 'A3').v === 'Inactiv' && Math.abs(cc(R4, 'AB2').v - 19 / 24) < 1e-9, 'state and schedule together are one command');
    }
  }
  // ── SET_GROUP renames the tab: a tab named after its schedule follows it, and so does its name in the Total list ──
  {
    const { applySetGroupAsync } = await import('file:///' + path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'registru', 'apply.mjs').replace(/\\/g, '/'));
    const { renamedTitle } = await import('file:///' + path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'registru', 'newgroup.mjs').replace(/\\/g, '/'));
    const cfgS = Object.assign({}, cfgCells, { F3: { v: 'Se completează' }, I3: { v: '13' }, I4: { v: '15' } });
    const mk = (title, o) => {
      o = o || {};
      const grp = { A1: { v: 'Grup cu 3 elevi' }, A3: { v: 'Activ' }, AA2: { v: 'Joi' }, AB2: { v: 11 / 24 }, AC2: { v: '14' } };
      const spec = { [title]: { cells: grp }, 'Alta grupa': { cells: Object.assign({}, grp) }, CONFIGURARI: { hidden: true, cells: cfgS } };
      if (!o.noTotal) spec['Total achitări'] = { cells: { F4: { v: 'Alta grupa' }, G4: { v: o.inTotal === false ? 'altceva' : title } } };
      const bk = new MemoryBook(spec, 'x.xlsx');
      const calls = { rename: 0 };
      return {
        bk, calls,
        tabs: async () => bk.sheetNames.map(n => ({ title: n, sheetId: 1, hidden: bk.data[n].hidden })),
        load: async () => bk,
        read: async (tab, keys) => { const out = {}; keys.forEach(k => { const c = bk.cell(tab, k); out[k] = c ? { v: c.v, f: c.f } : { v: null }; }); return out; },
        write: async (tab, cells) => { bk.set(tab, cells); },
        renameTab: async (oldT, newT, cell) => { calls.rename++; if (o.failRename) throw new Error('Google 500: simulat'); if (bk.sheetNames.includes(newT)) throw new Error('nume duplicat'); bk.addSheet(newT, bk.data[oldT].cells); bk.removeSheet(oldT); if (cell) bk.set(cell.tab, { [cell.a1]: { v: cell.v } }); }
      };
    };
    const sc = (o) => Object.assign({ days: [4], start: 10, duration: 1, cabinet: '14' }, o || {});
    const cmdR = (tab, s, extra) => Object.assign({ id: 'rn' + Math.random(), type: 'SET_GROUP', tab, schedule: s, expect: { schedule: sc({ start: 11 }) } }, extra || {});
    ok(renamedTitle('Joi 11:00-12:00 (Vară)', sc(), []) === 'Joi 10:00-11:00 (Vară)', 'the name follows the schedule and keeps its "(Vară)"');
    ok(renamedTitle('Miercuri/Vineri 09:00-11:00', { days: [5, 3], start: 14, duration: 2 }, []) === 'Miercuri/Vineri 14:00-16:00', 'two days, two hours, days in week order');
    ok(renamedTitle('Orar 1', sc(), []) === null && renamedTitle('Grupa 1', sc(), []) === null && renamedTitle('Alina Ionescu', sc(), []) === null, 'a name that is not a schedule is left alone');
    ok(renamedTitle('Joi 10:00-11:00', sc(), []) === null, 'a name that already matches: nothing to rename');
    ok(renamedTitle('Joi 11:00-12:00', sc(), ['Joi 10:00-11:00']) === 'Joi 10:00-11:00 (2)', 'a taken name gets a number');
    {
      const R = mk('Joi 11:00-12:00 (Vară)'), r = await applySetGroupAsync(R, cmdR('Joi 11:00-12:00 (Vară)', sc()));
      ok(r.status === 'done' && r.renamed && r.renamed.to === 'Joi 10:00-11:00 (Vară)' && r.renamed.total === true && R.bk.sheetNames.includes('Joi 10:00-11:00 (Vară)') && !R.bk.sheetNames.includes('Joi 11:00-12:00 (Vară)'), 'moved: written and the tab renamed: ' + JSON.stringify(r.renamed));
      ok(R.bk.cell('Total achitări', 'G4').v === 'Joi 10:00-11:00 (Vară)' && R.bk.cell('Total achitări', 'F4').v === 'Alta grupa', 'its cell in the Total list has the new name, the others are untouched');
      ok(Math.abs(R.bk.cell('Joi 10:00-11:00 (Vară)', 'AB2').v - 10 / 24) < 1e-9, 'the schedule is written in the renamed tab');
    }
    {
      // the sheet already has the new hour but the name is old (an earlier move before renaming existed): the same command only renames
      const R = mk('Joi 11:00-12:00 (Vară)'); R.bk.data['Joi 11:00-12:00 (Vară)'].cells.AB2.v = 10 / 24;
      const r = await applySetGroupAsync(R, cmdR('Joi 11:00-12:00 (Vară)', sc()));
      ok(r.status === 'noop' && r.renamed && R.bk.sheetNames.includes('Joi 10:00-11:00 (Vară)'), 'nothing to write but the name is out of date: only the rename is done');
    }
    {
      const R = mk('Orar 1'), r = await applySetGroupAsync(R, cmdR('Orar 1', sc()));
      ok(r.status === 'done' && !r.renamed && R.calls.rename === 0, 'a tab with another kind of name is not renamed');
      const R2 = mk('Joi 11:00-12:00', { noTotal: true }), r2 = await applySetGroupAsync(R2, cmdR('Joi 11:00-12:00', sc()));
      ok(r2.status === 'done' && r2.renamed && r2.renamed.total === false, 'no Total tab: renamed anyway, the answer says it was not in a list');
      const R3 = mk('Joi 11:00-12:00', { inTotal: false }), r3 = await applySetGroupAsync(R3, cmdR('Joi 11:00-12:00', sc()));
      ok(r3.status === 'done' && r3.renamed && r3.renamed.total === false && R3.bk.cell('Total achitări', 'G4').v === 'altceva', 'a group that is not in the Total list: the list is not touched');
      const R4 = mk('Joi 11:00-12:00'), r4 = await applySetGroupAsync(R4, { id: 'rnst', type: 'SET_GROUP', tab: 'Joi 11:00-12:00', state: 'Se completează' });
      ok(r4.status === 'done' && !r4.renamed && R4.calls.rename === 0, 'only the state changes: the tab keeps its name');
    }
    {
      const R = mk('Joi 11:00-12:00', { failRename: true }), r = await applySetGroupAsync(R, cmdR('Joi 11:00-12:00', sc()));
      ok(r.status === 'done' && r.renameNote && !r.renamed && Math.abs(R.bk.cell('Joi 11:00-12:00', 'AB2').v - 10 / 24) < 1e-9 && R.bk.cell('Total achitări', 'G4').v === 'Joi 11:00-12:00', 'the rename fails: the schedule stays written, the Total list is untouched, the answer says why');
      const R2 = mk('Joi 11:00-12:00'); R2.bk.data['Joi 11:00-12:00'].cells.AB2.v = 17 / 24;
      const r2 = await applySetGroupAsync(R2, cmdR('Joi 11:00-12:00', sc()));
      ok(r2.status === 'conflict' && R2.calls.rename === 0, 'a refused command renames nothing');
    }
  }
  // ── syncGroup: only the tab the console just wrote is read and replaced ──
  {
    const { syncGroup } = await import(core);
    const wbg = { id: 'w1', spreadsheet_id: 'x' };
    const one = bk => { const d = grid(bk); return { title: d.title, tabs: d.tabs.filter(x => x.title === 'Grupa 1') }; };
    const db = mem(); delete db.prune;                                  // a group sync must never prune: calling it would throw
    let asked = null;
    const readTab = async (ss, sid, tab) => { asked = [ss, sid, tab]; return one(book()); };
    const r1 = await syncGroup({ wb: wbg, sheetId: 100, tab: 'Grupa 1', readTab, db });
    ok(r1.changed === 1 && r1.tab === 'Grupa 1' && db.store.get('100') && db.store.get('100').students.length === 2 && JSON.stringify(asked) === JSON.stringify(['x', 100, 'Grupa 1']), 'group sync: that one tab is read and stored with its students and lessons');
    const r2 = await syncGroup({ wb: wbg, sheetId: 100, tab: 'Grupa 1', readTab, db });
    ok(r2.changed === 0 && r2.unchanged === 1, 'group sync: nothing changed, nothing rewritten');
    const b2 = book(); b2.data['Grupa 1'].cells.A3 = { v: 'Inactiv' };
    const r3 = await syncGroup({ wb: wbg, sheetId: 100, tab: 'Grupa 1', readTab: async () => one(b2), db });
    ok(r3.changed === 1 && db.store.get('100').state === 'Inactiv', 'group sync: a changed state replaces the group');
    db.store.set('555', { sheet_id: 555, content_hash: 'z' });
    await syncGroup({ wb: wbg, sheetId: 100, tab: 'Grupa 1', readTab, db });
    ok(db.store.has('555'), 'group sync: the other groups of the register are not touched');
    const b3 = book(); b3.data['Grupa 1'].cells.A1 = { v: 'Grup cu 7 elevi' };
    const db2 = mem(); const r4 = await syncGroup({ wb: wbg, sheetId: 100, tab: 'Grupa 1', readTab: async () => one(b3), db: db2 });
    ok(r4.changed === 0 && r4.skipped.length === 1 && db2.store.size === 0, 'group sync: a wrong format is not stored');
    let threw = false; try { await syncGroup({ wb: wbg, sheetId: 100, tab: 'Grupa 1', readTab: async () => ({ title: 'X', tabs: [] }), db }); } catch (e) { threw = true; }
    ok(threw, 'group sync: a tab that is gone is an error, nothing changes');
    threw = false; try { await syncGroup({ wb: wbg, sheetId: 100, tab: 'Grupa 1', readTab: async () => ({ title: 'X', tabs: [{ title: 'Total achitări', sheetId: 9, hidden: false, values: [] }] }), db }); } catch (e) { threw = true; }
    ok(threw, 'group sync: a tab that is not a group is an error');
  }
  console.log(`SYNC: ${pass} checks passed, ${fail} failed`);
  if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();
