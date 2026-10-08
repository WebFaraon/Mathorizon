/* Runs one command against a register without ever overwriting what someone else changed:
     1. plan the writes (commands.js), each with the value the cell must still hold;
     2. read those cells again right before writing; any difference = conflict, nothing is written;
     3. write, then read back and check the cells hold what was written (a protected range or a lost request shows up here);
     4. remember the outcome under the command id, so a retry of the same command never writes twice.
   The Sheets API has no compare-and-set, so step 2 and 3 cannot be atomic: the window is a few milliseconds, and step 3 catches
   anything that slipped in (it reports "verify-failed", with what the cell holds, instead of retrying blindly).
   Plain ES module (Node through require, the Supabase Edge Function through import). */
import { plan, planTransfer } from './commands.mjs';
import { planNewGroup, firstFree, GENERAL_TABS } from './newgroup.mjs';
import { readConfig } from './parse.mjs';
import { parseA1 } from './memory-book.mjs';

const nul = x => (x === undefined || x === null ? null : x);
const same = (a, b) => nul(a.v) === nul(b.v) && (a.f || null) === (b.f || null);
const current = (book, tab, k) => { const { r, c } = parseA1(k); const x = book.sheet(tab).get(r, c); return x ? { v: nul(x.v), f: x.f || null } : { v: null, f: null }; };

function run(book, cmd) {
  const p = plan(book, cmd);
  if (!p.ok) return p.conflict ? { status: 'conflict', code: p.code, msg: p.msg } : { status: 'invalid', code: p.code, msg: p.msg };
  if (p.noop) return { status: 'noop', column: p.column, writes: [] };
  if (book.hooks && book.hooks.afterPlan) book.hooks.afterPlan(book);          // tests: somebody edits the sheet right here
  // just before writing: is every cell still what the plan saw?
  const stale = p.writes.filter(x => !same(current(book, cmd.tab, x.a1), x.expect));
  if (stale.length) return { status: 'conflict', code: 'changed', msg: `Celula ${stale[0].a1} a fost schimbată între timp (acum: „${current(book, cmd.tab, stale[0].a1).v}”). Nu am scris nimic.`, cells: stale.map(x => x.a1) };
  const cells = {};
  p.writes.forEach(x => { cells[x.a1] = x.write; });
  book.set(cmd.tab, cells);
  // read back
  const bad = p.writes.filter(x => { const now = current(book, cmd.tab, x.a1); return x.write.f ? (now.f || '') !== x.write.f : now.v !== x.write.v || now.f; });
  if (bad.length) return { status: 'failed', code: 'verify-failed', msg: `După scriere, celula ${bad[0].a1} are „${current(book, cmd.tab, bad[0].a1).v}”, nu ce am scris.`, cells: bad.map(x => x.a1) };
  return { status: 'done', column: p.column, writes: p.writes.map(x => ({ a1: x.a1, old: x.expect, new: x.write })) };
}

/* journal: anything with get(id) / set(id, result): a Map here, a table in the platform */
export function apply(book, cmd, journal) {
  if (!cmd || !cmd.id) return { status: 'invalid', code: 'id', msg: 'Comanda nu are id.' };
  const seen = journal && journal.get(cmd.id);
  if (seen && (seen.status === 'done' || seen.status === 'noop')) return Object.assign({}, seen, { replay: true });
  const out = run(book, cmd);
  if (journal) journal.set(cmd.id, out);
  return out;
}

/* The same steps against a live register (Google Sheets), where every read and write is a call:
     adapter.load(tab)         -> a MemoryBook with the tab (values and formulas) and CONFIGURARI
     adapter.read(tab, [a1])   -> { a1: { v, f } } the cells as they are right now
     adapter.write(tab, cells) -> writes { a1: { v } | { f } }
   Nothing is written when the plan is refused or a cell changed since it was read; after the write the cells are read back. */
export async function applyAsync(adapter, cmd) {
  if (!cmd || !cmd.id) return { status: 'invalid', code: 'id', msg: 'Comanda nu are id.' };
  const book = await adapter.load(cmd.tab);
  const p = plan(book, cmd);
  if (!p.ok) return p.conflict ? { status: 'conflict', code: p.code, msg: p.msg } : { status: 'invalid', code: p.code, msg: p.msg };
  if (p.noop) return { status: 'noop', column: p.column, writes: [] };
  const keys = p.writes.map(x => x.a1);
  const norm = c => ({ v: nul(c && c.v), f: (c && c.f) || null });
  const fresh = await adapter.read(cmd.tab, keys);
  const stale = p.writes.filter(x => !same(norm(fresh[x.a1]), x.expect));
  if (stale.length) return { status: 'conflict', code: 'changed', msg: `Celula ${stale[0].a1} a fost schimbată între timp (acum: „${norm(fresh[stale[0].a1]).v}”). Nu am scris nimic.`, cells: stale.map(x => x.a1) };
  const cells = {};
  p.writes.forEach(x => { cells[x.a1] = x.write; });
  await adapter.write(cmd.tab, cells);
  const after = await adapter.read(cmd.tab, keys);
  const bad = p.writes.filter(x => { const now = norm(after[x.a1]); return x.write.f ? (now.f || '') !== x.write.f : now.v !== x.write.v || now.f; });
  if (bad.length) return { status: 'failed', code: 'verify-failed', msg: `După scriere, celula ${bad[0].a1} are „${norm(after[bad[0].a1]).v}”, nu ce am scris.`, cells: bad.map(x => x.a1) };
  return { status: 'done', column: p.column, writes: p.writes.map(x => ({ a1: x.a1, old: x.expect, new: x.write })) };
}

/* TRANSFER against live registers: adapters = { from, to } (the same adapter when both groups are in one register).
   Each phase is checked just before it is written and read back after it. Phase 1 (new group) failing leaves the old group untouched;
   a failure in phase 2 is reported as "half-done" (he is in both groups, his money in both): the same command, tried again, only finishes phase 2. */
export async function applyTransferAsync(adapters, cmd) {
  if (!cmd || !cmd.id) return { status: 'invalid', code: 'id', msg: 'Comanda nu are id.' };
  const [bookFrom, bookTo] = await Promise.all([adapters.from.load(cmd.fromTab), adapters.to.load(cmd.toTab)]);
  const p = planTransfer(bookFrom, bookTo, cmd);
  if (!p.ok) return p.conflict ? { status: 'conflict', code: p.code, msg: p.msg } : { status: 'invalid', code: p.code, msg: p.msg };
  if (p.state === 'done') return { status: 'noop', column: p.column, writes: [], msg: 'Elevul era deja transferat.' };
  const norm = c => ({ v: nul(c && c.v), f: (c && c.f) || null });
  const half = (i, msg, extra) => Object.assign({ status: 'failed', code: i === 0 ? 'verify-failed' : 'half-done', msg: i === 0 ? msg : `S-a scris elevul în grupa nouă, dar nu s-a terminat în grupa veche: ${msg} Reîncearcă transferul (nu se dublează nimic).`, column: p.column, split: p.split, phase: i + 1 }, extra || {});
  const done = [];
  for (let i = 0; i < p.phases.length; i++) {
    const ph = p.phases[i], adapter = ph.side === 'to' ? adapters.to : adapters.from, keys = ph.writes.map(x => x.a1);
    try {
      const fresh = await adapter.read(ph.tab, keys);
      const stale = ph.writes.filter(x => !same(norm(fresh[x.a1]), x.expect));
      if (stale.length) {
        const msg = `Celula ${stale[0].a1} din „${ph.tab}” a fost schimbată între timp (acum: „${norm(fresh[stale[0].a1]).v}”).`;
        return i === 0 ? { status: 'conflict', code: 'changed', msg: msg + ' Nu am scris nimic.', cells: stale.map(x => x.a1) } : half(i, msg);
      }
      const cells = {};
      ph.writes.forEach(x => { cells[x.a1] = x.write; });
      await adapter.write(ph.tab, cells);
      const after = await adapter.read(ph.tab, keys);
      const bad = ph.writes.filter(x => { const now = norm(after[x.a1]); return x.write.f ? (now.f || '') !== x.write.f : now.v !== x.write.v || now.f; });
      if (bad.length) return half(i, `după scriere, celula ${bad[0].a1} din „${ph.tab}” are „${norm(after[bad[0].a1]).v}”, nu ce am scris.`, { cells: bad.map(x => x.a1) });
      done.push({ side: ph.side, tab: ph.tab, writes: ph.writes.map(x => ({ a1: x.a1, old: x.expect, new: x.write })) });
    } catch (e) {
      if (i === 0) throw e;                       // nothing was written yet that we know of
      return half(i, String((e && e.message) || e).slice(0, 200));
    }
  }
  return { status: 'done', column: p.column, oldColumn: p.oldColumn, split: p.split, resumed: p.resumed, phases: done };
}

/* NEW_GROUP against a live register. adapter:
     tabs()                         -> [{ title, sheetId, hidden }]          (in the register's order)
     load(tab), read(tab, [a1])     -> as for the other commands
     duplicate(sourceTitle, title)  -> { sheetId }                           (a copy of the tab, with its colours, lists and formulas)
     batchWrite({ clears, cells })  -> ONE all-or-nothing write: clears [{ tab, range }], cells { tab: { a1: { v } | { f } } }
     remove(title)                  -> deletes a tab
   The tab is duplicated, then cleared + filled + listed in the Total tab in one write; if that write fails the new tab is deleted again, so a failure
   leaves nothing behind. The first student (optional) is written afterwards like any ADD_STUDENT; if only that fails the group stays and the answer says so. */
export async function applyNewGroupAsync(adapter, cmd) {
  if (!cmd || !cmd.id) return { status: 'invalid', code: 'id', msg: 'Comanda nu are id.' };
  const tabs = await adapter.tabs();
  const norm = c => ({ v: nul(c && c.v), f: (c && c.f) || null });
  // the template: the empty tab "Orar 1", else the last visible group tab (found by its A1, reading from the end until one matches)
  const plainT = x => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  let template = tabs.find(x => plainT(x.title) === 'orar 1') || null;
  if (!template) {
    const groups = tabs.filter(x => !x.hidden && !GENERAL_TABS.has(plainT(x.title)));
    for (let k = groups.length - 1; k >= 0 && !template; k--) { const a1 = (await adapter.read(groups[k].title, ['A1']))['A1']; if (/^(grup|individual)/i.test(String((a1 && a1.v) || ''))) template = groups[k]; }
  }
  const totalTab = tabs.find(x => String(x.title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === 'total achitari');
  let total = { exists: false };
  if (totalTab) {
    const keys = []; for (let c = 6; c <= 35; c++) keys.push(colName(c) + '4');
    const row = await adapter.read(totalTab.title, keys);
    total = { exists: true, title: totalTab.title, free: firstFree(keys.map(k => { const x = row[k]; return x && x.v != null ? x.v : ''; })) };
  }
  const book = template ? await adapter.load(template.title) : null;
  const config = book ? readConfig(book) : {};
  const p = planNewGroup({ tabs, template, config, configCells: book && book.data.CONFIGURARI ? book.data.CONFIGURARI.cells : {}, total, cmd });
  if (!p.ok) return { status: 'invalid', code: p.code, msg: p.msg, onStudent: !!p.onStudent };

  const created = await adapter.duplicate(p.sourceTitle, p.title);
  const cellsByTab = { [p.title]: p.cells };
  if (p.total) cellsByTab[p.total.tab] = { [p.total.a1]: { v: p.total.v } };
  try {
    await adapter.batchWrite({ clears: p.clears.map(range => ({ tab: p.title, range })), cells: cellsByTab });
    const keys = ['A1', 'A3', 'A4', 'A5', 'A6', 'AA9'];
    const after = await adapter.read(p.title, keys);
    const bad = keys.filter(k => norm(after[k]).v !== p.cells[k].v);
    if (bad.length) throw new Error(`după scriere, celula ${bad[0]} din fila nouă nu are ce am scris`);
    if (p.total) { const t = await adapter.read(p.total.tab, [p.total.a1]); if (norm(t[p.total.a1]).v !== p.total.v) throw new Error('numele filei nu a ajuns în „Total achitări”'); }
  } catch (e) {
    try { await adapter.remove(p.title); } catch (e2) { /* the tab stays: said below */ }
    return { status: 'failed', code: 'new-group-failed', msg: 'Fila nouă nu a putut fi completată și a fost ștearsă: ' + String((e && e.message) || e).slice(0, 200) };
  }
  const out = { status: 'done', tab: p.title, sheetId: created.sheetId, source: p.sourceTitle, totalListed: !!p.total, column: null };
  if (p.student) {
    const r = await applyAsync(adapter, Object.assign({ id: cmd.id + '-s' }, p.student));
    if (r.status !== 'done') return Object.assign(out, { status: 'failed', code: 'group-done-student-failed', msg: `Grupa a fost creată (fila „${p.title}”), dar elevul nu a putut fi scris: ${r.msg || r.code}. Îl poți înscrie din consolă după sincronizare.` });
    out.column = r.column;
  }
  return out;
}
const colName = c => { let s = ''; for (; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; };
