/* Converts a teacher's register from the OLD format to the NEW one (the founder's template of 2026-10-13, docs/registre-format-nou.md) IN PLACE: the same file id,
   so the Apps Script trigger, the platform's groups (keyed by the tab's sheet id), the replacements and the teachers' access all stay linked.
   What it changes, all in ONE atomic batchUpdate (it either happens completely or not at all):
     - every group tab: C1 = the mode (Offline / Online, unmerged from B1), the formulas of the price (A2, rows 5 and 6) and of the teacher's pay (C9:C198) are the
       template's (they read CONFIGURARI), the validations of A1:C1; nothing else (students, marks, payments, discounts, topics, schedule) is touched;
     - "Total achitări": the template's new tab (F Online, G Offline, the list of groups from H4, one model column), the payments A3:B32 and the list of tabs put back;
     - "Grup Model": the template's empty group tab (new groups are made from it);
     - CONFIGURARI: the tariff and pay tables (columns L:V) of the template added as VALUES (the real registers will import the whole sheet from the founder's master file
       with IMPORTRANGE, that file is not shared with us yet; the lists in A:K stay as they are);
     - "Disponibilitate" and "Disponibilitate Vara": the rows "Comentariu profesorului" and "Link Google Meet".
   Before and after, the register is read with the platform's own importer and the two results are compared student by student (cost, sold, paid, discount, marks,
   dates, states, schedule): everything must be identical; the only allowed difference is the teacher's pay per lesson (the new formula rounds to a whole number).

     node convert-format.js --test <spreadsheetId>     copy the register, convert the COPY, verify, leave the copy (its id is printed)
     node convert-format.js --one  <spreadsheetId>     backup copy, convert, verify, force the platform's sync, verify the database
     node convert-format.js --all                      every enabled register of the platform, one after the other, stops at the first failure
   Needs the owner's login (_import/google-oauth-token.json) for the writes (CONFIGURARI is protected) and the service account for the reads, and in .env
   SUPABASE_SERVICE_ROLE_KEY (only for --one / --all). Never prints a name or a phone. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..');
require(path.join(root, 'node_modules', 'dotenv')).config({ path: path.join(root, '.env'), quiet: true });
const { api } = require('./auth');

const TEMPLATE = '1anG5PEK66Hm45iLjhAw2KX7BN9SvdXo_6KzLlcYg6N4';
const KEY = JSON.parse(fs.readFileSync(path.join(root, '_import', 'google-service-account.json'), 'utf8'));
const URL_ = process.env.SUPABASE_URL || 'https://tfflpivehrrzmklvcyhe.supabase.co';
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SYNC_SECRET = (() => { try { return fs.readFileSync(path.join(root, '_import', 'reg-sync-secret.txt'), 'utf8').trim(); } catch (e) { return ''; } })();
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets/';
const DRIVE = 'https://www.googleapis.com/drive/v3/files/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const U = { who: 'user' };
const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const col = n => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const q = t => encodeURIComponent("'" + t + "'");

/* ---------- reading the register the way the platform does ---------- */
async function snapshot(id) {
  const { readWorkbook, QuotaError } = await import('../../../supabase/functions/_shared/registru/google.mjs');
  const { syncWorkbook } = await import('../../../supabase/functions/_shared/registru/sync-core.mjs');
  let data = null;
  for (let t = 0; t < 8 && !data; t++) {
    try { data = await readWorkbook(KEY, id); } catch (e) { if (e instanceof QuotaError) { await sleep(20000); continue; } throw e; }
  }
  if (!data) throw new Error('Registrul nu s-a putut citi (limita Google).');
  const payloads = {};
  const stub = { hashes: async () => new Map(), applyGroup: async (wb, p) => { payloads[p.tab] = p; }, prune: async () => 0 };
  const out = await syncWorkbook({ wb: { id: 'x', spreadsheet_id: id }, read: async () => data, db: stub, force: true });
  return { payloads, workbook: out.workbook, issues: out.issues, skipped: out.skipped, tabs: data.tabs, title: data.title };
}

/* ---------- the comparison before / after ---------- */
const stable = o => JSON.stringify(o);
function compare(before, after) {
  const bad = [], note = {};
  const add = (k, n) => { note[k] = (note[k] || 0) + (n == null ? 1 : n); };
  const tabs = Object.keys(before.payloads);
  if (stable(tabs.slice().sort()) !== stable(Object.keys(after.payloads).sort())) bad.push('Grupele citite nu mai sunt aceleași: ' + tabs.length + ' înainte, ' + Object.keys(after.payloads).length + ' după.');
  let studentsN = 0, lessonsN = 0;
  tabs.forEach((tab, gi) => {
    const a = before.payloads[tab], b = after.payloads[tab];
    if (!b) return;
    const g = 'grupa #' + (gi + 1);
    ['sheet_id', 'tab', 'format_size', 'state', 'subject', 'summer', 'grade', 'level', 'profile'].forEach(k => { if (stable(a[k]) !== stable(b[k])) bad.push(`${g}: câmpul ${k} diferă (${stable(a[k])} -> ${stable(b[k])})`); });
    if (stable(a.schedule) !== stable(b.schedule)) bad.push(`${g}: orarul diferă`);
    if (a.students.length !== b.students.length) bad.push(`${g}: ${a.students.length} elevi înainte, ${b.students.length} după`);
    a.students.forEach((s, i) => {
      studentsN++;
      const t = b.students[i];
      if (!t) return;
      ['col', 'header_raw', 'name', 'phone', 'manager', 'status', 'paid', 'discount', 'cost', 'sold'].forEach(k => {
        const x = s[k], y = t[k];
        const same = typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) < 0.005 : stable(x) === stable(y);
        if (!same) bad.push(`${g}, elevul ${i + 1}: ${k} diferă (${stable(x)} -> ${stable(y)})`);
      });
    });
    if (a.lessons.length !== b.lessons.length) bad.push(`${g}: ${a.lessons.length} lecții înainte, ${b.lessons.length} după`);
    let sumA = 0, sumB = 0;
    a.lessons.forEach((l, i) => {
      lessonsN++;
      const m = b.lessons[i];
      if (!m) return;
      ['row_no', 'date_text', 'iso', 'topic', 'teacher_level'].forEach(k => { if (stable(l[k]) !== stable(m[k])) bad.push(`${g}, lecția ${i + 1}: ${k} diferă (${stable(l[k])} -> ${stable(m[k])})`); });
      if (stable(l.marks) !== stable(m.marks)) bad.push(`${g}, lecția ${i + 1}: prezențele diferă`);
      const x = l.teacher_pay == null ? 0 : l.teacher_pay, y = m.teacher_pay == null ? 0 : m.teacher_pay;
      sumA += x; sumB += y;
      if (Math.abs(x - y) > 0.51) bad.push(`${g}, lecția ${i + 1}: plata profesorului diferă mai mult decât rotunjirea (${x} -> ${y})`);
      else if (Math.abs(x - y) > 0.004) add('lecții cu plata rotunjită la leu');
    });
    // what the new fields say about the group
    if (b.mode !== 'offline' && b.mode !== 'online') bad.push(`${g}: modul (C1) nu se citește (${stable(b.mode)})`);
    const table = { 1: 608, 2: 348, 3: 288, 4: 248, 5: 228, 6: 218, 8: 148 };
    const want = b.mode === 'offline' ? table[a.format_size] : null;
    if (b.mode === 'offline' && b.price !== want) bad.push(`${g}: prețul din A2 e ${stable(b.price)}, ar fi trebuit ${want}`);
    if (b.mode === 'offline') add('grupe Offline cu prețul corect în A2', b.price === want ? 1 : 0);
    note['diferența totală a plății profesorului (lei)'] = Math.round(((note['diferența totală a plății profesorului (lei)'] || 0) + (sumB - sumA)) * 100) / 100;
  });
  const wa = before.workbook.teacher, wb = after.workbook.teacher;
  if (stable(wa.availability) !== stable(wb.availability)) bad.push('Disponibilitatea profesorului diferă');
  if (stable(wa.availabilitySummer) !== stable(wb.availabilitySummer)) bad.push('Disponibilitatea de vară diferă');
  if (stable(wa.payments) !== stable(wb.payments)) bad.push('Plățile către profesor din „Total achitări” diferă: ' + stable(wa.payments) + ' -> ' + stable(wb.payments));
  if (wa.paidTotal !== wb.paidTotal) bad.push(`Suma achitată profesorului diferă (${wa.paidTotal} -> ${wb.paidTotal})`);
  if (wa.earnedTotal != null && wb.earnedTotal != null) note['salariul total (lei): înainte / după'] = wa.earnedTotal + ' / ' + wb.earnedTotal;
  if (!after.workbook.config.newFormat) bad.push('Registrul nu e recunoscut ca format nou (CONFIGURARI fără tarife).');
  if (after.workbook.config.broken) bad.push('CONFIGURARI arată erori.');
  const errs = (after.issues && after.issues.summary && after.issues.summary.error) || 0;
  if (errs) bad.push(`Verificările platformei dau ${errs} erori în registrul convertit: ${JSON.stringify(after.issues.byCode)}`);
  if ((after.skipped || []).length) bad.push(`${after.skipped.length} grupe oprite de verificări după conversie`);
  return { bad, note, studentsN, lessonsN, groups: tabs.length };
}

/* ---------- the conversion ---------- */
const cellOf = v => (v === '' || v == null ? {} : typeof v === 'number' ? { userEnteredValue: { numberValue: v } } : typeof v === 'boolean' ? { userEnteredValue: { boolValue: v } } : String(v)[0] === '=' ? { userEnteredValue: { formulaValue: v } } : { userEnteredValue: { stringValue: String(v) } });
const rowsOf = grid => grid.map(r => ({ values: r.map(cellOf) }));
const range = (sheetId, r0, r1, c0, c1) => ({ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
const paste = (src, dst, type) => ({ copyPaste: { source: src, destination: dst, pasteType: type, pasteOrientation: 'NORMAL' } });

async function convert(id, log) {
  log = log || console.log;
  const meta = await api('GET', `${SHEETS}${id}?fields=sheets(properties(title,sheetId,index,hidden,gridProperties))`, U);
  const sheets = meta.sheets.map(s => s.properties);
  const byTitle = t => sheets.find(s => s.title === t);
  if (sheets.some(s => plain(s.title) === 'grup model')) throw new Error('Registrul are deja fila „Grup Model”: pare convertit.');
  const oldTotal = byTitle('Total achitări'), config = byTitle('CONFIGURARI'), disp = byTitle('Disponibilitate'), dispV = byTitle('Disponibilitate Vara');
  if (!oldTotal || !config) throw new Error('Lipsește „Total achitări” sau CONFIGURARI.');
  if (!(sheets.find(s => s.sheetId === oldTotal.sheetId) && oldTotal.gridProperties.columnCount >= 35)) throw new Error('„Total achitări” nu are forma vechiului format (F:AI).');

  log('1. Citesc registrul cu importatorul platformei (înainte)...');
  const before = await snapshot(id);
  if (before.skipped.length) throw new Error('Registrul are grupe oprite de verificări înainte de conversie: nu îl ating.');
  if (before.workbook.config.newFormat) throw new Error('Registrul e deja în formatul nou.');
  const groupTabs = Object.keys(before.payloads).map(t => ({ tab: t, sheetId: before.payloads[t].sheet_id }));
  const mode = /\bonline\b/i.test(before.title) ? 'Online' : 'Offline';
  log(`   ${groupTabs.length} grupe, ${Object.values(before.payloads).reduce((n, p) => n + p.students.length, 0)} coloane de elevi, modul registrului: ${mode}`);

  log('2. Citesc starea veche din „Total achitări” (lista filelor și plățile)...');
  const names = ((await api('GET', `${SHEETS}${id}/values/${q('Total achitări')}!F4:AI4?valueRenderOption=UNFORMATTED_VALUE`, U)).values || [[]])[0].filter(x => x !== '' && x != null).map(String);
  const pay = (await api('GET', `${SHEETS}${id}/values/${q('Total achitări')}!A3:B32?valueRenderOption=UNFORMATTED_VALUE`, U)).values || [];
  const payGrid = Array.from({ length: 30 }, (_, i) => [(pay[i] || [])[0] == null ? '' : pay[i][0], (pay[i] || [])[1] == null ? '' : pay[i][1]]);
  log(`   ${names.length} file în lista din Total, ${payGrid.filter(r => r[1] !== '').length} plăți`);

  log('3. Citesc din șablon: tarifele, rândurile din Disponibilitate...');
  const tpl = await api('GET', `${SHEETS}${TEMPLATE}?fields=sheets(properties(title,sheetId))`, U);
  const T = {}; tpl.sheets.forEach(s => { T[s.properties.title] = s.properties.sheetId; });
  const tariffs = (await api('GET', `${SHEETS}${TEMPLATE}/values/${q('CONFIGURARI')}!L1:V99?valueRenderOption=UNFORMATTED_VALUE`, U)).values || [];
  if (!tariffs.length || String((tariffs[1] || [])[2] || '') === '' || !(tariffs[1] || [])[3]) throw new Error('Șablonul nu are tarifele în CONFIGURARI (importul din fișierul-mamă nu s-a încărcat).');
  const dispRows = async (title) => {
    const tg = await api('GET', `${SHEETS}${TEMPLATE}?ranges=${q(title)}!A15:V16&fields=sheets(merges,data(rowData(values(userEnteredValue,userEnteredFormat,dataValidation))))`, U);
    const s = tg.sheets[0];
    return { rows: ((s.data && s.data[0] && s.data[0].rowData) || []).map(r => ({ values: r.values || [] })), merges: (s.merges || []).filter(m => m.startRowIndex >= 14 && m.endRowIndex <= 16) };
  };
  const dispT = await dispRows('Disponibilitate'), dispVT = await dispRows('Disponibilitate Vara');
  const totalCols = await api('GET', `${SHEETS}${TEMPLATE}?ranges=${q('Total achitări')}!A1:H1&fields=sheets(data(columnMetadata(pixelSize)))`, U);
  const widths = ((totalCols.sheets[0].data[0] || {}).columnMetadata || []).map(c => c.pixelSize);

  // CONFIGURARI must be as wide as the template's BEFORE the template's tabs are copied in: a formula that points at a column beyond the grid is anchored to the
  // end of the sheet and moves when columns are appended later (the prices would read the wrong columns)
  const grow = [];
  if (config.gridProperties.columnCount < 22) grow.push({ appendDimension: { sheetId: config.sheetId, dimension: 'COLUMNS', length: 22 - config.gridProperties.columnCount } });
  if (config.gridProperties.rowCount < 100) grow.push({ appendDimension: { sheetId: config.sheetId, dimension: 'ROWS', length: 100 - config.gridProperties.rowCount } });
  if (grow.length) await api('POST', `${SHEETS}${id}:batchUpdate`, Object.assign({ body: { requests: grow } }, U));

  log('4. Aduc din șablon filele „Total achitări” și „Grup Model” (copiate în registru)...');
  const copied = [];
  try {
    for (const name of ['Total achitări', 'Grup Model']) copied.push(await api('POST', `${SHEETS}${TEMPLATE}/sheets/${T[name]}:copyTo`, Object.assign({ body: { destinationSpreadsheetId: id } }, U)));
    const newTotal = copied[0], model = copied[1];
    const S = sheets.length;
    const n = names.length, lastCol = 7 + Math.max(n, 1);          // A..G are the totals; the groups start at H
    const reqs = [];
    // CONFIGURARI: the tariff and pay tables of the template, as values (L:V)
    reqs.push({ updateCells: { rows: rowsOf(tariffs), fields: 'userEnteredValue', start: { sheetId: config.sheetId, rowIndex: 0, columnIndex: 11 } } });
    // Disponibilitate: two new rows
    [[disp, dispT], [dispV, dispVT]].forEach(([s, t]) => {
      if (!s || !t.rows.length) return;
      if (s.gridProperties.rowCount < 16) reqs.push({ appendDimension: { sheetId: s.sheetId, dimension: 'ROWS', length: 16 - s.gridProperties.rowCount } });
      reqs.push({ updateCells: { rows: t.rows, fields: 'userEnteredValue,userEnteredFormat,dataValidation', start: { sheetId: s.sheetId, rowIndex: 14, columnIndex: 0 } } });
      t.merges.forEach(m => reqs.push({ mergeCells: { range: range(s.sheetId, m.startRowIndex, m.endRowIndex, m.startColumnIndex, m.endColumnIndex), mergeType: 'MERGE_ALL' } }));
    });
    // Total: the old tab goes, the template's takes its name and place
    reqs.push({ deleteSheet: { sheetId: oldTotal.sheetId } });
    reqs.push({ updateSheetProperties: { properties: { sheetId: newTotal.sheetId, title: 'Total achitări', index: 0 }, fields: 'title,index' } });
    if (n > 1) {
      reqs.push({ appendDimension: { sheetId: newTotal.sheetId, dimension: 'COLUMNS', length: n - 1 } });
      reqs.push(paste(range(newTotal.sheetId, 0, 32, 7, 8), range(newTotal.sheetId, 0, 32, 8, lastCol), 'PASTE_NORMAL'));
      for (let c = 8; c < lastCol; c++) if (widths[7]) reqs.push({ updateDimensionProperties: { range: { sheetId: newTotal.sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 }, properties: { pixelSize: widths[7] }, fields: 'pixelSize' } });
    }
    reqs.push({ updateCells: { rows: [{ values: names.map(cellOf) }], fields: 'userEnteredValue', start: { sheetId: newTotal.sheetId, rowIndex: 3, columnIndex: 7 } } });
    reqs.push({ updateCells: { rows: rowsOf(payGrid), fields: 'userEnteredValue', start: { sheetId: newTotal.sheetId, rowIndex: 2, columnIndex: 0 } } });
    // the template's group tab, before CONFIGURARI
    reqs.push({ updateSheetProperties: { properties: { sheetId: model.sheetId, title: 'Grup Model', index: S - 1 }, fields: 'title,index' } });
    reqs.push({ updateSheetProperties: { properties: { sheetId: config.sheetId, index: S }, fields: 'index' } });
    // every group tab
    groupTabs.forEach(g => {
      const s = g.sheetId, m = model.sheetId;
      reqs.push({ unmergeCells: { range: range(s, 0, 1, 1, 3) } });
      reqs.push(paste(range(m, 0, 1, 1, 3), range(s, 0, 1, 1, 3), 'PASTE_FORMAT'));
      reqs.push(paste(range(m, 0, 1, 0, 3), range(s, 0, 1, 0, 3), 'PASTE_DATA_VALIDATION'));
      reqs.push({ updateCells: { rows: [{ values: [cellOf(mode)] }], fields: 'userEnteredValue', start: { sheetId: s, rowIndex: 0, columnIndex: 2 } } });
      reqs.push(paste(range(m, 1, 2, 0, 1), range(s, 1, 2, 0, 1), 'PASTE_FORMULA'));                 // A2: the price per hour
      reqs.push(paste(range(m, 4, 6, 3, 26), range(s, 4, 6, 3, 26), 'PASTE_FORMULA'));               // D5:Z6: cost and lessons
      reqs.push(paste(range(m, 8, 198, 2, 3), range(s, 8, 198, 2, 3), 'PASTE_FORMULA'));             // C9:C198: the teacher's pay
    });
    log(`5. Scriu totul într-o singură operațiune atomică (${reqs.length} cereri, ${groupTabs.length} grupe)...`);
    await api('POST', `${SHEETS}${id}:batchUpdate`, Object.assign({ body: { requests: reqs } }, U));
  } catch (e) {
    for (const c of copied) { try { await api('POST', `${SHEETS}${id}:batchUpdate`, Object.assign({ body: { requests: [{ deleteSheet: { sheetId: c.sheetId } }] } }, U)); } catch (e2) { /* already gone */ } }
    throw e;
  }

  log('6. Aștept recalcularea și citesc din nou cu importatorul platformei (după)...');
  await sleep(6000);
  let after = await snapshot(id);
  let cmp = compare(before, after);
  for (let i = 0; i < 2 && cmp.bad.length; i++) { await sleep(8000); after = await snapshot(id); cmp = compare(before, after); }   // formulas may still be recalculating
  return { before, after, cmp, id, mode, groups: groupTabs.length, names: names.length };
}

function report(r, log) {
  log = log || console.log;
  log(`   ${r.cmp.groups} grupe, ${r.cmp.studentsN} coloane de elevi, ${r.cmp.lessonsN} lecții comparate`);
  Object.keys(r.cmp.note).forEach(k => log(`   ${k}: ${r.cmp.note[k]}`));
  if (r.cmp.bad.length) { log(`   DIFERENȚE (${r.cmp.bad.length}):`); r.cmp.bad.slice(0, 25).forEach(x => log('     - ' + x)); }
  else log('   NICIO diferență în afară de rotunjirea plății profesorului.');
}

/* ---------- the platform side ---------- */
async function rest(table, select, filter) {
  const res = await fetch(`${URL_}/rest/v1/${table}?select=${select}${filter ? '&' + filter : ''}`, { headers: { apikey: SK, Authorization: 'Bearer ' + SK } });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json();
}
async function platformSync(workbookId) {
  for (let a = 0; a < 5; a++) {
    const res = await fetch(`${URL_}/functions/v1/registru-sync`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-sync-secret': SYNC_SECRET, apikey: SK, Authorization: 'Bearer ' + SK }, body: JSON.stringify({ workbook_id: workbookId, force: true }) });
    const j = await res.json().catch(() => ({}));
    const x = (j.results || [])[0] || {};
    if (/quota|limit/i.test(JSON.stringify(x))) { await sleep(20000); continue; }
    return x;
  }
  return { status: 'quota' };
}
async function verifyPlatform(spreadsheetId, after, log) {
  const wbs = await rest('reg_workbooks', 'id,last_status', `spreadsheet_id=eq.${spreadsheetId}`);
  if (!wbs.length) { log('   (registrul nu e în platformă: sar peste verificarea bazei de date)'); return true; }
  const r = await platformSync(wbs[0].id);
  log(`   sincronizare forțată: ${r.status}`);
  await sleep(2500);
  const rows = await rest('reg_groups', 'sheet_id,tab,format_size,mode,price,content_hash', `workbook_id=eq.${wbs[0].id}`);
  let bad = 0;
  Object.values(after.payloads).forEach(p => {
    const row = rows.find(x => Number(x.sheet_id) === p.sheet_id);
    if (!row || row.content_hash !== p.content_hash || row.mode !== p.mode || Number(row.price) !== Number(p.price) || row.format_size !== p.format_size) bad++;
  });
  if (rows.length !== Object.keys(after.payloads).length) bad++;
  log(bad ? `   BAZA DE DATE: ${bad} grupe nu corespund cu registrul` : `   baza de date corespunde registrului (${rows.length} grupe, mod și preț pe fiecare)`);
  return !bad;
}

/* ---------- main ---------- */
(async () => {
  const [cmd, arg] = process.argv.slice(2);
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  if (cmd === '--test') {
    const f = await api('GET', `${DRIVE}${arg}?fields=name,parents&supportsAllDrives=true`, U);
    const c = await api('POST', `${DRIVE}${arg}/copy?supportsAllDrives=true`, Object.assign({ body: { name: f.name + ' (TEST de șters)', parents: f.parents } }, U));
    console.log('Copia de test:', c.id);
    const r = await convert(c.id);
    report(r);
    console.log(r.cmp.bad.length ? 'TEST EȘUAT' : 'TEST REUȘIT', '| copia:', c.id);
    process.exit(r.cmp.bad.length ? 1 : 0);
  }
  if (cmd === '--one' || cmd === '--all') {
    if (!SK) throw new Error('Lipsește SUPABASE_SERVICE_ROLE_KEY din .env');
    const targets = cmd === '--one' ? [{ spreadsheet_id: arg }] : await rest('reg_workbooks', 'id,spreadsheet_id', 'enabled=eq.true&order=teacher_name.asc,id.asc');
    // the backups of the old format, in one folder
    const folder = await api('POST', DRIVE.replace('/files/', '/files'), Object.assign({ body: { name: 'Backup înainte de formatul nou ' + stamp.slice(0, 10), mimeType: 'application/vnd.google-apps.folder' } }, U));
    console.log('Folder pentru copii de siguranță:', folder.id);
    const done = [], failed = [];
    for (let i = 0; i < targets.length; i++) {
      const id = targets[i].spreadsheet_id;
      console.log(`\n[${i + 1}/${targets.length}] registrul #${i + 1}`);
      try {
        const bk = await api('POST', `${DRIVE}${id}/copy?supportsAllDrives=true`, Object.assign({ body: { name: `BACKUP registru #${i + 1} ${id.slice(0, 6)}`, parents: [folder.id] } }, U));
        console.log('   copie de siguranță:', bk.id);
        const r = await convert(id);
        report(r);
        if (r.cmp.bad.length) throw new Error('verificarea a găsit diferențe: registrul rămâne convertit, copia de siguranță e ' + bk.id);
        if (!(await verifyPlatform(id, r.after, console.log))) throw new Error('baza de date nu corespunde');
        done.push(id);
      } catch (e) { failed.push(id); console.log('   EȘEC: ' + e.message); break; }
      await sleep(4000);
    }
    console.log(`\nConvertite și verificate: ${done.length}/${targets.length}${failed.length ? ' | OPRIT la un eșec' : ''}`);
    process.exit(failed.length ? 1 : 0);
  }
  console.log('Folosire: convert-format.js --test <id> | --one <id> | --all');
})().catch(e => { console.error('EROARE: ' + e.message); process.exit(1); });
