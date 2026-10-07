/* Makes the clean template inside Google: a copy of the real register (the copy never leaves Google) with every tab deleted
   except "Orar 1" (the empty group tab) and CONFIGURARI. The copy keeps every colour, dropdown chip, validation and formula.
     node scripts/registru-import/google/make-template.js <registerFileId> <folderId>
   Prints the template's spreadsheet id. */
'use strict';
const { api } = require('./auth');
const [src, folder] = process.argv.slice(2);
if (!src || !folder) { console.error('Folosire: make-template.js <idRegistru> <idFolder>'); process.exit(1); }
const KEEP = new Set(['Orar 1', 'CONFIGURARI']);
(async () => {
  const copy = await api('POST', `https://www.googleapis.com/drive/v3/files/${src}/copy?supportsAllDrives=true`, { who: 'user', body: { name: 'SABLON registru (gol)', parents: [folder] } });
  const meta = await api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${copy.id}?fields=sheets.properties`, { who: 'user' });
  const drop = meta.sheets.map(s => s.properties).filter(p => !KEEP.has(p.title));
  const kept = meta.sheets.map(s => s.properties).filter(p => KEEP.has(p.title));
  if (kept.length !== 2) throw new Error('Nu am găsit ambele file de păstrat: ' + kept.map(k => k.title));
  await api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${copy.id}:batchUpdate`, { who: 'user', body: { requests: drop.map(p => ({ deleteSheet: { sheetId: p.sheetId } })) } });
  const after = await api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${copy.id}?fields=sheets.properties(title,sheetId,hidden)`, { who: 'user' });
  console.log('Șablon:', copy.id);
  console.log('File rămase:', after.sheets.map(s => s.properties.title + (s.properties.hidden ? ' (ascunsă)' : '') + ' gid=' + s.properties.sheetId).join(' | '));
  console.log('File șterse:', drop.length);
})().catch(e => { console.error(e.message); process.exit(1); });
