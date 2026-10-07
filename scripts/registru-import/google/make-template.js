/* Makes the clean template inside Google: a copy of the real register (the copy never leaves Google) with every tab deleted
   except the three general tabs, "Orar 1" (the empty group tab) and CONFIGURARI; their input cells are emptied. The copy keeps every colour, dropdown chip, validation and formula.
     node scripts/registru-import/google/make-template.js <registerFileId> <folderId>
   Prints the template's spreadsheet id. */
'use strict';
const { api } = require('./auth');
const [src, folder] = process.argv.slice(2);
if (!src || !folder) { console.error('Folosire: make-template.js <idRegistru> <idFolder>'); process.exit(1); }
const KEEP = new Set(['Total achitări', 'Disponibilitate', 'Disponibilitate Vara', 'Orar 1', 'CONFIGURARI']);
/* the input cells of the general tabs: emptied (every formula stays, they read the group tabs) */
const CLEAR = ["'Total achitări'!A3:B32", "'Total achitări'!F4:AI4", "'Disponibilitate'!B2:H14", "'Disponibilitate'!J3:V14", "'Disponibilitate Vara'!B2:H14", "'Disponibilitate Vara'!J3:V14"];
(async () => {
  const copy = await api('POST', `https://www.googleapis.com/drive/v3/files/${src}/copy?supportsAllDrives=true`, { who: 'user', body: { name: 'SABLON registru (gol, v2)', parents: [folder] } });
  const meta = await api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${copy.id}?fields=sheets.properties`, { who: 'user' });
  const drop = meta.sheets.map(s => s.properties).filter(p => !KEEP.has(p.title));
  const kept = meta.sheets.map(s => s.properties).filter(p => KEEP.has(p.title));
  if (kept.length !== KEEP.size) throw new Error('Nu am găsit toate filele de păstrat: ' + kept.map(k => k.title));
  await api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${copy.id}:batchUpdate`, { who: 'user', body: { requests: drop.map(p => ({ deleteSheet: { sheetId: p.sheetId } })) } });
  await api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${copy.id}/values:batchClear`, { who: 'user', body: { ranges: CLEAR } });
  // clearing removes the checkbox rule of the classes grid (nothing else): put it back, unticked
  const ids = {}; kept.forEach(k => { ids[k.title] = k.sheetId; });
  await api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${copy.id}:batchUpdate`, { who: 'user', body: { requests: ['Disponibilitate', 'Disponibilitate Vara'].map(n => ({ repeatCell: { range: { sheetId: ids[n], startRowIndex: 2, endRowIndex: 14, startColumnIndex: 10, endColumnIndex: 22 }, cell: { userEnteredValue: { boolValue: false }, dataValidation: { condition: { type: 'BOOLEAN' } } }, fields: 'userEnteredValue,dataValidation' } })) } });
  const after = await api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${copy.id}?fields=sheets.properties(title,sheetId,hidden)`, { who: 'user' });
  console.log('Șablon:', copy.id);
  console.log('File rămase:', after.sheets.map(s => s.properties.title + (s.properties.hidden ? ' (ascunsă)' : '') + ' gid=' + s.properties.sheetId).join(' | '));
  console.log('File șterse:', drop.length);
})().catch(e => { console.error(e.message); process.exit(1); });
