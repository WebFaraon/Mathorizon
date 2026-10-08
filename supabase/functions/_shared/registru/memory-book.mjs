/* A register held in memory, with the same read interface as read-xlsx.js plus writes. It stands in for the Google Sheet in tests,
   and behaves the way the Sheets API does: no compare-and-set, a write is accepted whatever the cell held before.
   `hooks.beforeWrite(a1set)` lets a test change the sheet "from outside" between our read and our write; `hooks.dropWrites`
   makes the sheet accept a write and silently keep the old value (what a protected range or a lost request looks like).
   The Edge Function also fills one from the Google values of a tab, to plan a command on it.
   Plain ES module (Node through require, the Supabase Edge Function through import). */
import { colLetter } from './parse.mjs';

export const a1 = (r, c) => colLetter(c) + r;
export function parseA1(s) {
  const m = /^([A-Z]+)(\d+)$/.exec(s);
  if (!m) throw new Error('A1 invalid: ' + s);
  let c = 0; for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: +m[2], c };
}

export class MemoryBook {
  /* spec: { name: { hidden, cells: { A1: { v, f } } } } (f without the leading "=") */
  constructor(spec, source) {
    this.source = source || 'memory.xlsx';
    this.data = {};
    this.hooks = {};
    this.writes = [];
    Object.keys(spec).forEach(n => { this.data[n] = { hidden: !!spec[n].hidden, cells: {} }; Object.keys(spec[n].cells || {}).forEach(k => { this.data[n].cells[k] = Object.assign({}, spec[n].cells[k]); }); });
    this.sheetNames = Object.keys(spec);
  }
  static from(book) {
    const spec = {};
    book.sheetNames.forEach(n => {
      const s = book.sheet(n), cells = {};
      for (let r = 1; r <= s.rows; r++) for (let c = 1; c <= s.cols; c++) { const x = s.get(r, c); if (x) cells[a1(r, c)] = { v: x.v, f: x.f || undefined }; }
      spec[n] = { hidden: book.hidden(n), cells };
    });
    return new MemoryBook(spec, book.source);
  }
  hidden(n) { return this.data[n].hidden; }
  sheet(name) {
    const d = this.data[name];
    if (!d) throw new Error('Fila nu există: ' + name);
    let rows = 1, cols = 1;
    Object.keys(d.cells).forEach(k => { const p = parseA1(k); rows = Math.max(rows, p.r); cols = Math.max(cols, p.c); });
    return {
      name, rows, cols,
      get: (r, c) => { const x = d.cells[a1(r, c)]; return x === undefined || x.v === undefined || x.v === null || x.v === '' ? (x && x.f ? { v: x.v, f: x.f, t: 'n' } : undefined) : { v: x.v, f: x.f || null, t: typeof x.v === 'number' ? 'n' : 's' }; },
      text(r, c) { const x = this.get(r, c); return x === undefined || x.v === undefined ? '' : String(x.v).trim(); },
      num(r, c) { const x = this.get(r, c); return x !== undefined && typeof x.v === 'number' ? x.v : null; }
    };
  }
  /* what the API call would do: write cells ({ a1: { v } | { f } | null }) */
  set(name, cells) {
    if (this.hooks.beforeWrite) this.hooks.beforeWrite(this, name, cells);
    Object.keys(cells).forEach(k => {
      this.writes.push({ sheet: name, a1: k, cell: cells[k] });
      if (this.hooks.dropWrites) return;
      if (cells[k] === null) { delete this.data[name].cells[k]; return; }
      const c = Object.assign({}, cells[k]);
      const m = c.f && c.v === undefined ? /^SUM\(([\d.+\-*/() ]*)\)$/i.exec(c.f) : null;     // the sheet recalculates a simple SUM(...) at once
      if (m) c.v = Function('return (' + m[1] + ')')();
      this.data[name].cells[k] = c;
    });
  }
  addSheet(name, cells, hidden) { this.data[name] = { hidden: !!hidden, cells: Object.fromEntries(Object.entries(cells || {}).map(([k, v]) => [k, Object.assign({}, v)])) }; if (!this.sheetNames.includes(name)) this.sheetNames.push(name); }
  removeSheet(name) { delete this.data[name]; this.sheetNames = this.sheetNames.filter(n => n !== name); }
  clearRange(name, range) {                                   // "A9:B198": the values and formulas of a rectangle
    const [a, b] = range.split(':').map(parseA1);
    Object.keys(this.data[name].cells).forEach(k => { const p = parseA1(k); if (p.r >= a.r && p.r <= b.r && p.c >= a.c && p.c <= b.c) delete this.data[name].cells[k]; });
  }
  /* raw access for comparisons in tests */
  cell(name, k) { const x = this.data[name].cells[k]; return x ? Object.assign({}, x) : null; }
  snapshot() { const o = {}; Object.keys(this.data).forEach(n => { o[n] = JSON.stringify(this.data[n].cells); }); return o; }
}

