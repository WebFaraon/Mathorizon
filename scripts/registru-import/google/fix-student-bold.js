/* One-off: the "Grup Model" tab of the new register format has the students' name (D1:Z1), manager (D7:Z7) and status (D8:Z8) cells in plain weight, the teachers' tabs
   have them bold, so every tab made from the model (a replacement, a new group) looked plain. Sets the weight to bold on "Grup Model" and on every group tab whose D1 is not bold.
   Only the weight changes. node fix-student-bold.js <spreadsheetId> [...]    or: node fix-student-bold.js --all  (every enabled register of the platform) */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..');
require(path.join(root, 'node_modules', 'dotenv')).config({ path: path.join(root, '.env'), quiet: true });
const { api } = require('./auth');
const U = { who: 'user' };
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets/';
const GENERAL = new Set(['total achitari', 'disponibilitate', 'disponibilitate vara', 'configurari']);
const plain = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
(async () => {
  let ids = process.argv.slice(2).filter(a => a !== '--all');
  if (process.argv.includes('--all')) {
    const SK = process.env.SUPABASE_SERVICE_ROLE_KEY, URL_ = process.env.SUPABASE_URL || 'https://tfflpivehrrzmklvcyhe.supabase.co';
    ids = (await (await fetch(`${URL_}/rest/v1/reg_workbooks?select=spreadsheet_id&enabled=eq.true&order=teacher_name.asc,id.asc`, { headers: { apikey: SK, Authorization: 'Bearer ' + SK } })).json()).map(x => x.spreadsheet_id);
  }
  let fixedTabs = 0;
  for (let i = 0; i < ids.length; i++) {
    const meta = await api('GET', `${SHEETS}${ids[i]}?fields=sheets.properties(title,sheetId)`, U);
    const tabs = meta.sheets.map(s => s.properties).filter(p => !GENERAL.has(plain(p.title)));
    if (!tabs.length) { console.log(`#${i + 1}: nicio filă de grupă`); continue; }
    // one call: D1 of every tab
    const ranges = tabs.map(p => 'ranges=' + encodeURIComponent("'" + p.title.replace(/'/g, "''") + "'!D1")).join('&');
    const g = await api('GET', `${SHEETS}${ids[i]}?${ranges}&fields=sheets(properties(sheetId),data(rowData(values(userEnteredFormat(textFormat(bold))))))`, U);
    const plainTabs = g.sheets.filter(s => {
      const rd = (s.data && s.data[0] && s.data[0].rowData) || [];
      const bold = !!(rd[0] && rd[0].values && rd[0].values[0] && rd[0].values[0].userEnteredFormat && rd[0].values[0].userEnteredFormat.textFormat && rd[0].values[0].userEnteredFormat.textFormat.bold);
      return !bold;
    }).map(s => s.properties.sheetId);
    const requests = [];
    plainTabs.forEach(sid => [[0, 1], [6, 7], [7, 8]].forEach(([a, b]) => requests.push({ repeatCell: { range: { sheetId: sid, startRowIndex: a, endRowIndex: b, startColumnIndex: 3, endColumnIndex: 26 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } })));
    if (requests.length) await api('POST', `${SHEETS}${ids[i]}:batchUpdate`, Object.assign({ body: { requests } }, U));
    fixedTabs += plainTabs.length;
    console.log(`#${i + 1}: ${tabs.length} file, ${plainTabs.length} puse pe bold`);
  }
  console.log(`\nTotal file reparate: ${fixedTabs}`);
})().catch(e => { console.error('EROARE: ' + e.message); process.exit(1); });
