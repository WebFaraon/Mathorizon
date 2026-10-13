/* The list of group tabs in "Total achitări" (what a group's money is added up from). Two layouts:
     old   30 columns F:AI are prepared with formulas; a group is listed by writing its tab name in the first empty cell of row 4 (F4:AI4).
     new   (the template of 2026-10-13) E, F, G are the totals (all / Online / Offline) and the groups start at H; the sheet holds the formulas of ONE model
           column (H1:H32) and the totals add up H4 to the LAST COLUMN OF THE SHEET: a new group is a NEW column, copied from the model, with the name in row 4.
   readTotal says where the next name goes (and whether a column has to be copied first); the adapters do the copy (copyColumn / removeColumn). Plain ES module. */
import { colLetter } from './parse.mjs';

const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const val = c => (c && c.v != null ? c.v : '');
export const NEW_FIRST = 8;                 // H
export const NEW_LAST = 60;
const PLACEHOLDER = /^sheet\d*$/i;           // the template lists an empty tab "Sheet3" as an example

export function firstFree(row) {
  for (let i = 0; i < row.length; i++) if (row[i] === '' || row[i] == null) return { a1: colLetter(6 + i) + '4', index: i };
  return null;
}

/* tabs: adapter.tabs(). Returns { exists: false } or { exists, title, layout, free: { a1, index } | null, addColumn: { from, to, rows: [1, 32] } | null } */
export async function readTotal(adapter, tabs) {
  const tab = tabs.find(x => plain(x.title) === 'total achitari');
  if (!tab) return { exists: false };
  const probe = await adapter.read(tab.title, ['F6', 'G6']);
  const isNew = plain(val(probe.F6)) === 'online' && plain(val(probe.G6)) === 'offline';
  if (!isNew) {
    const keys = []; for (let c = 6; c <= 35; c++) keys.push(colLetter(c) + '4');
    const row = await adapter.read(tab.title, keys);
    return { exists: true, title: tab.title, layout: 'old', free: firstFree(keys.map(k => val(row[k]))), addColumn: null };
  }
  const keys = [];
  for (let c = NEW_FIRST; c <= NEW_LAST; c++) keys.push(colLetter(c) + '4', colLetter(c) + '3');
  const row = await adapter.read(tab.title, keys);
  for (let c = NEW_FIRST; c <= NEW_LAST; c++) {
    const L = colLetter(c), name = String(val(row[L + '4'])).trim();
    if (name && !PLACEHOLDER.test(name)) continue;
    // free: the model column H is already a column of formulas; a later one needs the formulas copied unless somebody prepared it
    const hasFormulas = !!(row[L + '3'] && row[L + '3'].f);
    return { exists: true, title: tab.title, layout: 'new', free: { a1: L + '4', index: c - NEW_FIRST }, addColumn: c === NEW_FIRST || hasFormulas ? null : { from: colLetter(NEW_FIRST), to: L, rows: [1, 32] } };
  }
  return { exists: true, title: tab.title, layout: 'new', free: null, addColumn: null };
}

/* before the name is written: the column is made when the layout needs one */
export async function prepareTotal(adapter, total) {
  if (total && total.addColumn) await adapter.copyColumn(total.title, total.addColumn.from, total.addColumn.to, total.addColumn.rows[0], total.addColumn.rows[1]);
}
/* when the new tab could not be completed: the column that was made for it goes away again (it is the last one, nothing shifts) */
export async function undoTotal(adapter, total) {
  if (total && total.addColumn) { try { await adapter.removeColumn(total.title, total.addColumn.to); } catch (e) { /* it stays, empty: the totals ignore a column with no name */ } }
}
