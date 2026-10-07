/* Reads an .xlsx into a small grid interface the parser works on, so the same parser can later read a Google Sheet
   through the API: a "book" has sheetNames, hidden(name) and sheet(name) -> { get(row, col) -> { v, f, t } }.
   Rows and columns are 1-based (A = 1). Times come back as fractions of a day (0.5 = 12:00). */
'use strict';
const fs = require('fs');
const XLSX = require('xlsx');

function readXlsx(file) {
  const wb = XLSX.read(fs.readFileSync(file), { cellFormula: true, cellDates: false, cellText: false });
  const meta = (wb.Workbook && wb.Workbook.Sheets) || [];
  const hiddenByName = {};
  meta.forEach(s => { if (s.Hidden) hiddenByName[s.name] = true; });
  const sheets = {};
  const book = {
    source: file,
    sheetNames: wb.SheetNames.slice(),
    hidden: name => !!hiddenByName[name],
    sheet(name) {
      if (sheets[name]) return sheets[name];
      const ws = wb.Sheets[name];
      const ref = ws && ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      const view = {
        name,
        rows: ref.e.r + 1,
        cols: ref.e.c + 1,
        get(r, c) {
          const cell = ws && ws[XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })];
          if (!cell || cell.v === undefined || cell.v === null || cell.v === '') return undefined;
          return { v: cell.v, f: cell.f || null, t: cell.t };
        },
        text(r, c) { const x = this.get(r, c); return x === undefined ? '' : String(x.v).trim(); },
        num(r, c) { const x = this.get(r, c); return x !== undefined && typeof x.v === 'number' ? x.v : null; }
      };
      sheets[name] = view;
      return view;
    }
  };
  return book;
}

module.exports = { readXlsx };
