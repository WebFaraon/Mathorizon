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
    const wbm = { id: 'w1', spreadsheet_id: 'x', drive_modified: 'T1', last_full_sync_at: new Date().toISOString(), teacher_data: { availability: null } };
    const r6 = await syncWorkbook({ wb: wbm, read: async () => { reads++; return data; }, peek, db });
    ok(!r6.full && reads === 0, 'unchanged file: no read from Google');
    const r7 = await syncWorkbook({ wb: Object.assign({}, wbm, { drive_modified: 'T0' }), read: async () => { reads++; return data; }, peek, db });
    ok(r7.full && reads === 1 && r7.modified === 'T1', 'changed file: read');
    const r8 = await syncWorkbook({ wb: Object.assign({}, wbm, { last_full_sync_at: new Date(Date.now() - 2 * 864e5).toISOString() }), read: async () => { reads++; return data; }, peek, db });
    ok(r8.full && reads === 2, 'a full read at least once a day even if the file looks unchanged');
    const r9 = await syncWorkbook({ wb: Object.assign({}, wbm, { teacher_data: {} }), read: async () => { reads++; return data; }, peek, db });
    ok(r9.full && reads === 3, 'a register whose teacher data was never stored is read once even when the file looks unchanged');
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
  // ── SET_AVAILABILITY: single cells of the "Disponibilitate" tab, only when the person saw the current value ──
  {
    const { applyAsync } = await import('file:///' + path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'registru', 'apply.mjs').replace(/\\/g, '/'));
    const mkA = (extra, cfgExtra) => {
      const cells = { A1: { v: 'Orar' }, B1: { v: 'Luni' }, C1: { v: 'Marți' }, D1: { v: 'Miercuri' }, E1: { v: 'Joi' }, F1: { v: 'Vineri' }, G1: { v: 'Sâmbătă' }, H1: { v: 'Duminică' } };
      for (let i = 0; i < 13; i++) cells['A' + (i + 2)] = { v: (9 + i) / 24 };
      cells.B2 = { v: 'Disponibil' }; cells.B3 = { v: 'Disponibil' }; cells.C3 = { v: 'Ocupat' };
      const bk = new MemoryBook({ Disponibilitate: { cells: Object.assign(cells, extra || {}) }, CONFIGURARI: { hidden: true, cells: Object.assign({}, cfgCells, cfgExtra || {}) } }, 'x.xlsx');
      const calls = { write: 0 };
      return {
        bk, calls,
        load: async () => bk,
        read: async (tab, keys) => { const out = {}; keys.forEach(k => { const c = bk.cell(tab, k); out[k] = c ? { v: c.v, f: c.f } : { v: null }; }); return out; },
        write: async (tab, cells) => { calls.write++; bk.set(tab, cells); }
      };
    };
    const SA = (changes) => ({ id: 'av' + Math.random(), type: 'SET_AVAILABILITY', tab: 'Disponibilitate', changes });
    const cc = (R, k) => R.bk.cell('Disponibilitate', k) || {};
    {
      const R = mkA(), r = await applyAsync(R, SA([{ day: 1, hour: 11, to: true, was: false }, { day: 1, hour: 9, to: false, was: true }]));
      ok(r.status === 'done' && cc(R, 'B4').v === 'Disponibil' && cc(R, 'B2').v == null && cc(R, 'B3').v === 'Disponibil' && r.writes.length === 2, 'availability: one hour set, one cleared, nothing else touched');
      const r2 = await applyAsync(R, SA([{ day: 1, hour: 11, to: true, was: false }]));
      ok(r2.status === 'noop', 'availability: the same change again is a no-op (not a conflict)');
    }
    {
      const R = mkA(), r = await applyAsync(R, SA([{ day: 2, hour: 10, to: false, was: false }, { day: 2, hour: 10 + 0, to: false }].slice(0, 1)));
      ok(r.status === 'noop' && cc(R, 'C3').v === 'Ocupat', 'availability: "Ocupat" is never cleared');
      const R2 = mkA(), r2 = await applyAsync(R2, SA([{ day: 2, hour: 10, to: true, was: false }]));
      ok(r2.status === 'done' && cc(R2, 'C3').v === 'Disponibil', 'availability: marking an "Ocupat" hour available overwrites it');
    }
    {
      const R = mkA({ B4: { v: 'Disponibil' } }), r = await applyAsync(R, SA([{ day: 1, hour: 11, to: false, was: false }]));
      ok(r.status === 'conflict' && cc(R, 'B4').v === 'Disponibil' && R.calls.write === 0, 'availability: the teacher made an hour available meanwhile, the person wants it cleared on what he saw: conflict, nothing written');
      const R3 = mkA({ B5: { v: 'Disponibil' } }), r3 = await applyAsync(R3, SA([{ day: 1, hour: 12, to: true, was: false }, { day: 3, hour: 9, to: true, was: true }]));
      ok(r3.status === 'conflict' && r3.code === 'stale-availability' && R3.calls.write === 0, 'availability: the person saw "not available" for an hour that was available: conflict, nothing written');
    }
    {
      const bad = [[[], 'changes'], [[{ day: 1, hour: 4, to: true }], 'slot'], [[{ day: 9, hour: 10, to: true }], 'slot'], [[{ day: 1, hour: 10, to: true }, { day: 1, hour: 10, to: false }], 'changes']];
      for (const [list, code] of bad) { const R = mkA(), r = await applyAsync(R, SA(list)); ok(r.status === 'invalid' && r.code === code && R.calls.write === 0, 'availability refused (' + code + ')'); }
      const R = mkA({}, { J1: { v: 'Statut disponibilitate' }, J2: { v: 'Ocupat' } }), r = await applyAsync(R, SA([{ day: 1, hour: 11, to: true }]));
      ok(r.status === 'invalid' && r.code === 'availability', 'availability: the register\'s list has no "Disponibil": refused');
      const R2 = mkA(), r2 = await applyAsync(R2, Object.assign(SA([{ day: 1, hour: 11, to: true }]), { tab: 'Total achitări' }));
      ok(r2.status === 'invalid', 'availability: another tab is refused');
    }
  }
  // ── Replacements: the Calculator's split for one student, the two money commands, the tab of the substitute ──
  {
    const imp = f => import('file:///' + path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'registru', f).replace(/\\/g, '/'));
    const { applyAsync } = await imp('apply.mjs');
    const { splitReplacement } = await imp('pay.mjs');
    const { applyReplacementCreateAsync, readOriginal, copiedStudents, replacementRows, weekdayOf } = await imp('replacement.mjs');

    // the Calculator (tab Inlocuire) and the founder's example: 1 hour x 218, payments 2700, discounts 100 -> 210.21 + 7.79
    const f1 = splitReplacement(2700, 100, 218);
    ok(f1.ach === 210.21 && f1.red === 7.79 && f1.short === 0 && f1.tot === 218, 'replacement split: the founder example 210.21 + 7.79 = 218: ' + JSON.stringify(f1));
    const f2 = splitReplacement(3500.5, 450, 150, 8.5);
    ok(Math.abs(f2.ach + f2.red - 1275) < 1e-9 && f2.ach === 1129.77, 'replacement split: the Calculator sample (8.5 h x 150): ' + JSON.stringify(f2));
    const f3 = splitReplacement(100, 50, 218);
    ok(f3.ach === 100 && f3.red === 50 && f3.short === 68, 'replacement split: not enough money moves what exists, the rest is short: ' + JSON.stringify(f3));
    ok(splitReplacement(0, 0, 218).short === 218 && splitReplacement(0, 0, 218).ach === 0, 'replacement split: no money at all, everything is short');
    ok(splitReplacement(-50, 40, 218).ach === 0 && splitReplacement(-50, 40, 218).red === 40, 'replacement split: a negative cell counts as 0');
    for (let i = 0; i < 300; i++) { const a = Math.round(Math.random() * 500000) / 100, r = Math.round(Math.random() * 100000) / 100, pr = [148, 218, 228, 248, 288, 348, 608][i % 7], h = 1 + (i % 4); const s = splitReplacement(a, r, pr, h); if (Math.abs(s.ach + s.red + s.short - s.tot) > 0.0051 || s.ach > a + 1e-9 || s.red > r + 1e-9) { ok(false, 'replacement split invariant: ' + JSON.stringify({ a, r, pr, h, s })); break; } if (i === 299) ok(true, 'replacement split: moved + short = total, never more than what the student has (300 random cases)'); }

    // a small register: a tab as the teacher keeps it
    const regTab = (cells, cfgExtra) => {
      const spec = { 'Grupa 1': { cells }, CONFIGURARI: { hidden: true, cells: Object.assign({}, cfgCells, cfgExtra || {}) } };
      const bk = new MemoryBook(spec, 'x.xlsx'), calls = { write: 0 };
      return { bk, calls, load: async () => bk, read: async (tab, keys) => { const o = {}; keys.forEach(k => { const c = bk.cell(tab, k); o[k] = c ? { v: c.v, f: c.f } : { v: null }; }); return o; }, write: async (tab, cells2) => { calls.write++; bk.set(tab, cells2); } };
    };
    const base = () => ({ A1: { v: 'Grup cu 6 elevi' }, A3: { v: 'Activ' }, D1: { v: 'Ionescu Ana+37369123456' }, D3: { v: 2700, f: 'sum(2700)' }, D4: { v: 100, f: 'sum(100)' }, D5: { v: 436 }, E1: { v: 'Popa Mihai+37379111222' }, E3: { v: 0, f: 'sum(0)' }, E4: { v: 0, f: 'sum(0)' } });
    const stud = (name, phone) => ({ name, phone });
    const take = (R, o) => applyAsync(R, Object.assign({ id: 'rt' + Math.random(), type: 'REPL_TAKE', tab: 'Grupa 1', student: stud('Ionescu Ana', '069123456'), price: 218 }, o || {}));
    {
      const R = regTab(base()), r = await take(R);
      ok(r.status === 'done' && r.info.ach === 210.21 && r.info.red === 7.79 && r.info.short === 0, 'REPL_TAKE: the amounts come from his cells: ' + JSON.stringify(r.info));
      const c = k => R.bk.cell('Grupa 1', k);
      ok(c('D3').f === 'SUM(2700-210.21)' && c('D3').v === 2489.79 && c('D4').f === 'SUM(100-7.79)' && c('D4').v === 92.21, 'REPL_TAKE: one more minus term in each SUM, what he typed stays: ' + c('D3').f + ' ' + c('D4').f);
      const r2 = await take(R);
      ok(r2.status === 'done' && c('D3').f === 'SUM(2700-210.21-210.21)', 'REPL_TAKE: a second lesson takes a second term (the proportion follows what is left)');
    }
    {
      const R = regTab(Object.assign(base(), { D3: { v: 100, f: 'sum(100)' }, D4: { v: 50, f: 'sum(50)' } })), r = await take(R);
      ok(r.status === 'done' && r.info.short === 68 && R.bk.cell('Grupa 1', 'D3').v === 0 && R.bk.cell('Grupa 1', 'D4').v === 0, 'REPL_TAKE: not enough money, what exists moves, 68 is short');
      const R0 = regTab(base()), r0 = await take(R0, { student: stud('Popa Mihai', '079111222') });
      ok(r0.status === 'noop' && r0.info.short === 218 && R0.calls.write === 0, 'REPL_TAKE: a student with no money: nothing is written, everything is short');
      const Rb = regTab(Object.assign(base(), { D3: { v: 'h' } })), rb = await take(Rb);
      ok(rb.status === 'invalid' && rb.code === 'cell-not-numeric' && Rb.calls.write === 0, 'REPL_TAKE: a text in the payment cell needs a human, nothing written');
      ok((await take(regTab(base()), { student: stud('Nimeni Nimeni', '069000000') })).code === 'not-found', 'REPL_TAKE: a student that is not in the tab is refused');
      ok((await take(regTab(base()), { price: 0 })).code === 'price', 'REPL_TAKE: a price of 0 is refused');
    }
    {
      // REPL_MONEY: gives the money to the substitute's tab and takes it back
      const R = regTab(base()), m = (o) => applyAsync(R, Object.assign({ id: 'rm' + Math.random(), type: 'REPL_MONEY', tab: 'Grupa 1', student: stud('Popa Mihai', '079111222') }, o));
      const r = await m({ ach: 210.21, red: 7.79 });
      const c = k => R.bk.cell('Grupa 1', k);
      ok(r.status === 'done' && c('E3').f === 'SUM(210.21)' && c('E4').f === 'SUM(7.79)' && c('E3').v === 210.21, 'REPL_MONEY: the first money is the first term: ' + c('E3').f);
      const r2 = await m({ ach: -210.21, red: -7.79 });
      ok(r2.status === 'done' && c('E3').f === 'SUM(210.21-210.21)' && c('E3').v === 0 && c('E4').v === 0, 'REPL_MONEY: taking it back leaves the sum at 0, the history in the formula');
      ok((await m({ ach: 0, red: 0 })).status === 'noop', 'REPL_MONEY: nothing to move is a no-op');
      ok((await m({ ach: 1.234 })).code === 'amount', 'REPL_MONEY: more than two decimals is refused');
    }

    // the two registers: the base teacher's group and the substitute's register
    const reg2 = (spec, hooks) => {
      const bk = new MemoryBook(spec, 'x.xlsx'), ids = {}; let n = 100; const calls = { duplicate: 0, batch: 0 };
      return {
        bk, calls,
        tabs: async () => bk.sheetNames.map(nm => ({ title: nm, sheetId: ids[nm] || (ids[nm] = ++n), hidden: bk.data[nm].hidden })),
        load: async () => bk,
        read: async (tab, keys) => { const o = {}; keys.forEach(k => { const c = bk.cell(tab, k); o[k] = c ? { v: c.v, f: c.f } : { v: null }; }); return o; },
        duplicate: async (src, title) => { calls.duplicate++; bk.addSheet(title, bk.data[src].cells); ids[title] = ++n; return { sheetId: ids[title] }; },
        remove: async tt => bk.removeSheet(tt),
        batchWrite: async ({ clears, cells }) => { calls.batch++; if (hooks && hooks.failBatch) throw new Error('Google 500: simulat'); clears.forEach(c2 => bk.clearRange(c2.tab, c2.range)); Object.keys(cells).forEach(tb => bk.set(tb, cells[tb])); },
        write: async (tab, cells) => { bk.set(tab, cells); }
      };
    };
    const lists = { B2: { v: 'Matematica' }, F2: { v: 'Activ' }, F3: { v: 'Înlocuire' }, F4: { v: 'Inactiv' }, G2: { v: 'Activ' }, G3: { v: 'Înlocuire' }, G4: { v: 'Transferat' }, G5: { v: 'Inactiv' }, G6: { v: 'Oră de probă' }, I2: { v: '13' }, I3: { v: '14' }, D2: { v: '9 ― 10' } };
    const cfgR = Object.assign({}, cfgCells, lists);
    const origTab = () => ({
      A1: { v: 'Grup cu 6 elevi' }, A3: { v: 'Activ' }, A4: { v: 'Matematica' }, A5: { v: 'XII' }, A6: { v: '9 ― 10' }, A7: { v: 'Real' },
      D1: { v: 'Ionescu Ana+37369123456' }, D7: { v: 'Pricinoc Ariadna' }, D8: { v: 'Activ' }, D3: { v: 2700, f: 'sum(2700)' }, D4: { v: 100, f: 'sum(100)' },
      E1: { v: 'Popa Mihai+37379111222' }, E7: { v: 'Cerchez Cristina' }, E8: { v: 'Oră de probă' },
      F1: { v: 'Rusu Elena+37369555444' }, F7: { v: 'Cerchez Cristina' }, F8: { v: 'Inactiv' },
      G1: { v: 'Sula Vlad+37369777888' }, G7: { v: 'Cerchez Cristina' }, G8: { v: 'Transferat' },
      H1: { v: 'Mîrzac Samuel+37369333444' }, H7: { v: 'Pricinoc Ariadna' }, H8: { v: 'Instabil' }
    });
    const orarT = () => ({ A1: { v: 'Grup cu 6 elevi' }, A3: { v: 'Starea grupului' }, A4: { v: 'Materia' }, A5: { v: 'Clasa' }, A6: { v: 'Nivelul' }, A7: { v: 'Profilul' }, D3: { v: 0, f: 'sum(0)' }, D4: { v: 0, f: 'sum(0)' }, AA9: { v: 'Nivelul Profesorului 4' } });
    const totalCells = n => { const c = {}; for (let i = 0; i < n; i++) { const col = 6 + i; c[(col <= 26 ? String.fromCharCode(64 + col) : 'A' + String.fromCharCode(64 + col - 26)) + '4'] = { v: 'Grupa ' + i }; } return c; };
    const pair = (o, hooks) => ({
      from: reg2({ 'Marți/Joi 16:00-17:00': { cells: origTab() }, CONFIGURARI: { hidden: true, cells: cfgCells } }),
      to: reg2(Object.assign({ 'Total achitări': { cells: totalCells(2) }, 'Orar 1': { cells: orarT() }, CONFIGURARI: { hidden: true, cells: (o && o.cfg) || cfgR } }, (o && o.extra) || {}), hooks)
    });
    const dates = [{ iso: '2026-10-15', start: 16, duration: 1, cabinet: '13' }];
    const create = (P, o) => applyReplacementCreateAsync(P, Object.assign({ id: 'rc' + Math.random(), fromTab: 'Marți/Joi 16:00-17:00', dates, teacherLevel: 4 }, o || {}));
    ok(weekdayOf('2026-10-15') === 4 && weekdayOf('2026-10-18') === 7 && weekdayOf('2026-10-12') === 1, 'replacement: the weekday of a date (Thursday = 4, Sunday = 7)');
    ok(JSON.stringify(replacementRows([{ iso: '2026-10-15', start: 16, duration: 2, cabinet: '13' }, { iso: '2026-10-22', start: 16, duration: 2, cabinet: '13' }])) === JSON.stringify([{ day: 4, hour: 16, cab: '13' }, { day: 4, hour: 17, cab: '13' }]), 'replacement: two Thursdays are the same two schedule rows');
    ok(copiedStudents(readOriginal(pair().from.bk, 'Marți/Joi 16:00-17:00')).map(s => s.name).join('|') === 'Ionescu Ana|Popa Mihai|Mîrzac Samuel', 'replacement: Inactiv and Transferat are not copied');
    {
      const P = pair(), r = await create(P);
      const tab = 'Înlocuire Marți/Joi 16:00-17:00', c = k => P.to.bk.cell(tab, k) || {};
      ok(r.status === 'done' && r.tab === tab && r.students === 3 && r.reused === false && r.totalListed, 'replacement tab: created from Orar 1 and listed in Total: ' + JSON.stringify({ s: r.status, t: r.tab, m: r.msg }));
      ok(c('A1').v === 'Grup cu 6 elevi' && c('A3').v === 'Înlocuire' && c('A4').v === 'Matematica' && c('A5').v === 'XII' && c('A6').v === '9 ― 10' && c('A7').v === 'Real', 'replacement tab: format, state, subject, class, level, profile as the base group');
      ok(c('D1').v === 'Ionescu Ana+37369123456' && c('E1').v === 'Popa Mihai+37379111222' && c('F1').v === 'Mîrzac Samuel+37369333444' && !c('G1').v, 'replacement tab: the three students in the first columns, written as the register writes them');
      ok(['D', 'E', 'F'].every(L => c(L + '8').v === 'Înlocuire') && c('D7').v === 'Pricinoc Ariadna' && c('E7').v === 'Cerchez Cristina', 'replacement tab: status Înlocuire and the manager of each');
      ok(['D', 'E', 'F'].every(L => c(L + '3').f === 'sum(0)' && c(L + '4').f === 'sum(0)'), 'replacement tab: no money at all (payments and discounts at sum(0))');
      ok(c('AA2').v === 'Joi' && Math.abs(c('AB2').v - 16 / 24) < 1e-9 && c('AC2').v === '13' && !c('AA3').v, 'replacement tab: the schedule is the Thursday 16:00 in cabinet 13');
      ok(c('AA9').v === 'Nivelul Profesorului 4' && P.to.bk.cell('Total achitări', 'H4').v === tab, 'replacement tab: the substitute\'s level on the rows, the name in the Total list');
      ok(P.from.bk.cell('Marți/Joi 16:00-17:00', 'D3').f === 'sum(2700)' && P.from.bk.cell('Marți/Joi 16:00-17:00', 'D8').v === 'Activ' && P.from.calls.batch === 0, 'replacement: the base group is not touched (students stay Activ, money stays)');
      // a second replacement of the same group by the same teacher: the same tab, brought up to date
      P.from.bk.data['Marți/Joi 16:00-17:00'].cells.I1 = { v: 'Nou Elev+37369222111' }; P.from.bk.data['Marți/Joi 16:00-17:00'].cells.I7 = { v: 'Cerchez Cristina' }; P.from.bk.data['Marți/Joi 16:00-17:00'].cells.I8 = { v: 'Activ' };
      P.to.bk.data[tab].cells.A3 = { v: 'Inactiv' }; delete P.to.bk.data[tab].cells.AA2; delete P.to.bk.data[tab].cells.AB2; delete P.to.bk.data[tab].cells.AC2;
      const r2 = await create(P, { existingTab: tab, dates: [{ iso: '2026-10-22', start: 16, duration: 1, cabinet: '14' }] });
      ok(r2.status === 'done' && r2.reused === true && c('A3').v === 'Înlocuire' && c('AA2').v === 'Joi' && c('AC2').v === '14' && c('G1').v === 'Nou Elev+37369222111' && c('G8').v === 'Înlocuire', 'replacement tab reused: state back to Înlocuire, the new schedule, the student that joined meanwhile added: ' + JSON.stringify({ s: r2.status, m: r2.msg }));
      ok(P.to.calls.duplicate === 1, 'replacement tab reused: no second tab was made');
      const r3 = await create(P, { existingTab: tab, dates: [{ iso: '2026-10-22', start: 16, duration: 1, cabinet: '14' }] });
      ok(r3.status === 'noop', 'replacement tab reused: the same request again changes nothing');
    }
    {
      const bad = [
        [pair({ cfg: Object.assign({}, cfgR, { F3: { v: 'Altceva' } }) }), {}, 'state'],
        [pair({ cfg: Object.assign({}, cfgR, { G3: { v: 'Altceva' } }) }), {}, 'status'],
        [pair({ cfg: Object.assign({}, cfgR, { B2: { v: 'Fizica' } }) }), {}, 'subject'],
        [pair(), { dates: [{ iso: '2026-10-15', start: 16, duration: 1, cabinet: '99' }] }, 'cabinet'],
        [pair(), { dates: [] }, 'schedule'],
        [pair(), { teacherLevel: 9 }, 'teacher-level'],
        [pair({ extra: { 'Total achitări': { cells: totalCells(30) } } }), {}, 'total-full']
      ];
      for (const [P, o, code] of bad) { const r = await create(P, o); ok(r.status === 'invalid' && r.code === code && P.to.calls.duplicate === 0, 'replacement tab refused (' + code + '), nothing created: ' + r.status + ' ' + r.code); }
      const P0 = pair(); P0.from.bk.data['Marți/Joi 16:00-17:00'].cells.D8 = { v: 'Inactiv' }; P0.from.bk.data['Marți/Joi 16:00-17:00'].cells.E8 = { v: 'Transferat' }; P0.from.bk.data['Marți/Joi 16:00-17:00'].cells.H8 = { v: 'Inactiv' };
      const rn = await create(P0);
      ok(rn.status === 'invalid' && rn.code === 'no-students' && P0.to.calls.duplicate === 0, 'replacement tab refused: no student left to copy');
      const Pf = pair({}, { failBatch: true }), before = Pf.to.bk.sheetNames.slice(), rf = await create(Pf);
      ok(rf.status === 'failed' && rf.code === 'replacement-failed' && JSON.stringify(Pf.to.bk.sheetNames) === JSON.stringify(before), 'replacement tab: the write fails, the new tab is deleted again, nothing is left behind');
    }

    // ── the engine: the marks of the substitute become money, in both registers, and come back when a mark changes ──
    {
      const { settleReplacements, itemKey } = await imp('replacement-engine.mjs');
      const P = pair(), cr = await create(P), replTab = cr.tab, origName = 'Marți/Joi 16:00-17:00';
      const cO = k => (P.from.bk.cell(origName, k) || {}), cN = k => (P.to.bk.cell(replTab, k) || {});
      const journal = new Map(), calls = [];
      let failNext = null;
      const run = async req => {
        if (journal.has(req.id)) return journal.get(req.id);                       // the same id answers with the first answer
        if (failNext && (!failNext.step || req.id.includes('-' + failNext.step + '-'))) { const f = failNext; failNext = null; if (f.throws) throw new Error('căzut'); const r = { status: 'failed', code: f.code || 'google', msg: 'simulat' }; return r; }
        const orig = req.workbook === 'O', ad = orig ? P.from : P.to, tab = orig ? origName : replTab;
        const r = await applyAsync(ad, Object.assign({ id: req.id, type: req.type, tab }, req.payload));
        journal.set(req.id, r); calls.push(req.type + (orig ? '@O' : '@R')); return r;
      };
      const students = [{ col: 'D', name: 'Ionescu Ana', phone: '+37369123456' }, { col: 'E', name: 'Popa Mihai', phone: '+37379111222' }, { col: 'F', name: 'Mîrzac Samuel', phone: '+37369333444' }];
      const lessons = [{ row: 9, marks: {} }, { row: 10, marks: {} }];
      const state = { items: new Map(), status: 'active' };
      const db = {
        replacements: async () => [{ id: 'r1', origWorkbook: 'O', origSheet: 1, replWorkbook: 'R', replSheet: 2, status: state.status, dates: [{ iso: '2026-10-15' }], price: 218 }],
        replData: async () => ({ students, lessons }),
        items: async () => [...state.items.values()].map(i => JSON.parse(JSON.stringify(i))),
        saveItem: async (rep, it) => { state.items.set(it.student_key, JSON.parse(JSON.stringify(it))); },
        setStatus: async (rep, s) => { state.status = s; }
      };
      const go = (today) => settleReplacements({ db, run, today: today || '2026-10-14' });
      const item = (phone, row) => state.items.get(itemKey(phone, row)) || {};
      const sum = L => (cO(L + '3').v || 0) + (cO(L + '4').v || 0);

      let o = await go();
      ok(o.settled === 0 && calls.length === 0 && state.items.size === 0, 'engine: no mark, nothing happens');
      lessons[0].marks = { D: 'P', E: 'P', F: 'M' };
      o = await go();
      ok(o.settled === 2 && o.short === 1 && state.items.size === 2, 'engine: Prezent settles, Absent motivat does not (two lines, one of them short): ' + JSON.stringify(o));
      ok(cO('D3').v === 2489.79 && cO('D4').v === 92.21 && cN('D3').f === 'SUM(210.21)' && cN('D4').f === 'SUM(7.79)', 'engine: the money of one lesson left the base register and arrived in the substitute\'s tab (210.21 + 7.79)');
      ok(item('+37379111222', 9).status === 'settled' && item('+37379111222', 9).short === 218 && !cN('E3').f.includes('SUM(2') && cN('E3').v === 0, 'engine: a student with no money: settled with the whole lesson short, nothing moved');
      ok(!state.items.has(itemKey('+37369333444', 9)), 'engine: Absent motivat leaves no line at all');
      const n1 = calls.length; o = await go();
      ok(calls.length === n1 && o.settled === 0, 'engine: a second run with the same marks writes nothing');

      lessons[0].marks = { D: 'M', E: 'P', F: 'M' };                                   // the substitute changes Ana's mark
      o = await go();
      ok(o.reversed === 1 && item('+37369123456', 9).status === 'reversed' && cO('D3').v === 2700 && cO('D4').v === 100 && cN('D3').v === 0 && cN('D4').v === 0, 'engine: the mark changed after the money moved: it goes back, first out of the substitute\'s tab, then into the base register');
      ok(cO('D3').f === 'SUM(2700-210.21+210.21)' && cN('D3').f === 'SUM(210.21-210.21)', 'engine: the history stays in the formulas (terms, not overwritten numbers)');
      lessons[0].marks = { D: 'P', E: 'P', F: 'M' };                                   // and changes it back
      o = await go();
      ok(o.settled === 1 && item('+37369123456', 9).status === 'settled' && item('+37369123456', 9).attempt === 2 && cO('D3').v === 2489.79, 'engine: the mark is back: settled again as a new attempt, never twice at once');

      lessons[1].marks = { D: 'A' };                                                    // a second lesson, Absent (not excused) costs too
      const before = sum('D');
      o = await go();
      ok(Math.abs((before - sum('D')) - 218) < 0.0051 && Math.abs((cN('D3').v + cN('D4').v) - 436) < 0.0051, 'engine: a second lesson takes one more lesson price (218) from the base register, the tab has two');

      // a step fails: it is tried again, never skipped
      lessons[1].marks = { D: 'A', F: 'P' };
      failNext = { step: 'take', code: 'google' };
      o = await go();
      ok(o.errors === 1 && item('+37369333444', 10).status === 'pending' && item('+37369333444', 10).step === 'take' && item('+37369333444', 10).tries === 1, 'engine: a failed step keeps the reason and is tried again');
      o = await go();
      ok(o.errors === 0 && item('+37369333444', 10).status === 'settled', 'engine: the next run finishes it');

      // a fall between the two steps: it resumes at the second one, the first is not repeated
      lessons[1].marks = { D: 'A', F: 'P', E: 'A' };
      const takesBefore = calls.filter(c => c === 'REPL_TAKE@O').length;
      failNext = { step: 'to', throws: true };
      o = await go();
      ok(item('+37379111222', 10).status === 'from-done' && o.errors === 1, 'engine: the second step fell: the line stays at from-done');
      o = await go();
      ok(item('+37379111222', 10).status === 'settled' && calls.filter(c => c === 'REPL_TAKE@O').length === takesBefore + 1, 'engine: the next run only does the second step (the money was taken once)');

      // not known whether it wrote: nobody repeats it
      lessons[1].marks = { D: 'A', F: 'P', E: 'A', };
      lessons.push({ row: 11, marks: { D: 'P' } });
      failNext = { step: 'take', code: 'verify-failed' };
      o = await go();
      const stuck = item('+37369123456', 11);
      ok(stuck.status === 'pending' && stuck.tries >= 5 && /verifică registrul/.test(stuck.error), 'engine: a write that cannot be confirmed is not repeated: a person looks at the register');
      const n2 = calls.length; await go();
      ok(calls.length === n2, 'engine: and it stays so on the next runs');
      lessons.pop();

      // closing: only after the last date and when every line is settled or reversed
      state.items.delete(itemKey('+37369123456', 11));
      o = await go('2026-10-14');
      ok(o.closed === 0 && state.status === 'active' && cN('A3').v === 'Înlocuire', 'engine: before the last date the tab stays open');
      o = await go('2026-10-16');
      ok(o.closed === 1 && state.status === 'closed' && cN('A3').v === 'Inactiv' && !cN('AA2').v && !cN('AB2').v, 'engine: after the last date and everything settled the tab goes Inactiv and its schedule is cleared');
      state.status = 'cancelled'; lessons[0].marks = { D: 'P', E: 'P', F: 'P' }; const n3 = calls.length; await go('2026-10-16');
      ok(calls.length === n3, 'engine: a cancelled replacement is left alone');
    }
  }
  console.log(`SYNC: ${pass} checks passed, ${fail} failed`);
  if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();
