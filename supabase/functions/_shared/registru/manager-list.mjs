/* The managers list of the registers: CONFIGURARI!B2:B99 of the founder master file (every register shows it through IMPORTRANGE).
   Pure: given what the column holds and the approved managers, say who is already there and where the others go. */

const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* "Cerchez Cristina" and "cristina cerchez" are the same name: words without diacritics, in alphabetical order (the same key as name_key() in the database) */
export const nameKey = n => plain(n).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');

export const FIRST_ROW = 2, LAST_ROW = 99;

/* cells: the values of B2:B99 in order ('' for an empty cell); wanted: [{ id, name }].
   Returns { present: [id], add: [{ id, name, row }], full: [id] } (full: no room left in the column). The new names go under the last filled cell. */
export function planManagerList(cells, wanted) {
  const have = new Set((cells || []).map(nameKey).filter(Boolean));
  let last = -1;
  (cells || []).forEach((c, i) => { if (String(c || '').trim()) last = i; });
  const present = [], add = [], full = [], seen = new Set();
  let next = last + 1;
  for (const w of wanted || []) {
    const k = nameKey(w.name);
    if (!k) continue;
    if (have.has(k) || seen.has(k)) { present.push(w.id); continue; }
    if (FIRST_ROW + next > LAST_ROW) { full.push(w.id); continue; }
    add.push({ id: w.id, name: w.name, row: FIRST_ROW + next });
    seen.add(k); next++;
  }
  return { present, add, full };
}
