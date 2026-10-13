/* One-off: the register conversion left column C of every group tab at its old width (61 px), too narrow for the new "Online / Offline" chip in C1. Sets column C to 130 px
   and column AC to 114 px (the template's "Grup Model" widths) on every group tab of the given registers, nothing else.
     node fix-widths.js <spreadsheetId> [...]      or: node fix-widths.js --all   (every enabled register of the platform) */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..');
require(path.join(root, 'node_modules', 'dotenv')).config({ path: path.join(root, '.env'), quiet: true });
const { api } = require('./auth');
const U = { who: 'user' };
const GENERAL = new Set(['total achitari', 'disponibilitate', 'disponibilitate vara', 'configurari', 'grup model']);
const plain = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
(async () => {
  let ids = process.argv.slice(2).filter(a => a !== '--all');
  if (process.argv.includes('--all')) {
    const SK = process.env.SUPABASE_SERVICE_ROLE_KEY, URL_ = process.env.SUPABASE_URL || 'https://tfflpivehrrzmklvcyhe.supabase.co';
    ids = (await (await fetch(`${URL_}/rest/v1/reg_workbooks?select=spreadsheet_id&enabled=eq.true&order=teacher_name.asc,id.asc`, { headers: { apikey: SK, Authorization: 'Bearer ' + SK } })).json()).map(x => x.spreadsheet_id);
  }
  for (let i = 0; i < ids.length; i++) {
    const meta = await api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${ids[i]}?fields=sheets.properties(title,sheetId)`, U);
    const tabs = meta.sheets.map(s => s.properties).filter(p => !GENERAL.has(plain(p.title)));
    const requests = [];
    tabs.forEach(p => [[2, 130], [28, 114]].forEach(([c, px]) => requests.push({ updateDimensionProperties: { range: { sheetId: p.sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } })));
    if (requests.length) await api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${ids[i]}:batchUpdate`, Object.assign({ body: { requests } }, U));
    console.log(`#${i + 1}: ${tabs.length} grupe`);
  }
})().catch(e => { console.error('EROARE: ' + e.message); process.exit(1); });
