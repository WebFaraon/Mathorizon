/* Runs one command against a register without ever overwriting what someone else changed:
     1. plan the writes (commands.js), each with the value the cell must still hold;
     2. read those cells again right before writing; any difference = conflict, nothing is written;
     3. write, then read back and check the cells hold what was written (a protected range or a lost request shows up here);
     4. remember the outcome under the command id, so a retry of the same command never writes twice.
   The Sheets API has no compare-and-set, so step 2 and 3 cannot be atomic: the window is a few milliseconds, and step 3 catches
   anything that slipped in (it reports "verify-failed", with what the cell holds, instead of retrying blindly).
   Plain ES module (Node through require, the Supabase Edge Function through import). */
import { plan } from './commands.mjs';
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
