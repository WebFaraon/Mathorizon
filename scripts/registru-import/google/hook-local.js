/* Proves the whole road of the Apps Script (docs/apps-script.md) WITHOUT Apps Script, on one DEMO register: a cell is written in Google (as a teacher's edit would),
   then the same request the script sends (header x-hook-secret, { spreadsheet_id, sheet_id, tab }) is made to the deployed registru-sync, and the database
   is read to see the change arrive. Prints the seconds each step took. Then the cell is put back and the register read again.
     node scripts/registru-import/google/hook-local.js [teacher=t1]
   Needs: .env SUPABASE_SERVICE_ROLE_KEY, _import/reg-hook-secret.txt (the same value as the Supabase secret REG_HOOK_SECRET), the service account.
   Only a demo register of _import/demo/links.json is touched, one empty lesson row (the last: 198), and it is cleared at the end. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..');
require(path.join(root, 'node_modules', 'dotenv')).config({ path: path.join(root, '.env'), quiet: true });
const KEY = JSON.parse(fs.readFileSync(path.join(root, '_import', 'google-service-account.json'), 'utf8'));
const links = JSON.parse(fs.readFileSync(path.join(root, '_import', 'demo', 'links.json'), 'utf8'));
const HOOK = fs.readFileSync(path.join(root, '_import', 'reg-hook-secret.txt'), 'utf8').trim();
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.SUPABASE_URL || 'https://tfflpivehrrzmklvcyhe.supabase.co';
const tid = process.argv[2] || 't1';
const ROW = 198, MARK = 'zz-hook-test';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { createAdapter } = await import('../../../supabase/functions/_shared/registru/google.mjs');
  const T = links.teachers[tid], ad = createAdapter(KEY, T.ssid);
  let ok = 0, bad = 0;
  const check = (c, m) => { if (c) ok++; else bad++; console.log((c ? '  ok  ' : '  !!  ') + m); };
  const rest = async p => (await fetch(`${BASE}/rest/v1/${p}`, { headers: { apikey: SK, Authorization: 'Bearer ' + SK } })).json();
  const tabs = await ad.tabs();
  const tab = tabs.find(t => !t.hidden && !/^(total|disponibilitate|orar 1|configurari)/i.test(t.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()));
  const wb = (await rest(`reg_workbooks?select=id&spreadsheet_id=eq.${T.ssid}`))[0];
  const hook = async body => {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/functions/v1/registru-sync`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hook-secret': HOOK }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => ({})), ms: Date.now() - t0 };
  };
  const inDb = async () => {
    const g = (await rest(`reg_groups?select=id&workbook_id=eq.${wb.id}&sheet_id=eq.${tab.sheetId}`))[0];
    const l = g ? await rest(`reg_lessons?select=topic&group_id=eq.${g.id}&row_no=eq.${ROW}`) : [];
    return l.length ? l[0].topic : null;
  };
  console.log(`Registrul lui ${tid}, fila ${tab.sheetId}`);
  check((await ad.read(tab.title, ['B' + ROW]))['B' + ROW].v == null, 'rândul de probă (198) e gol în registru');

  // 1. what a hostile or wrong call gets
  const bad1 = await fetch(`${BASE}/functions/v1/registru-sync`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hook-secret': 'gresit' }, body: '{}' });
  check(bad1.status === 401, 'o cheie greșită primește 401');
  const bad2 = await hook({ spreadsheet_id: T.ssid, sheet_id: tab.sheetId, tab: tab.title, workbook_id: wb.id });
  check(bad2.status === 400, 'cu cheia registrelor nu se acceptă un câmp în plus (workbook_id): ' + bad2.status);
  const bad3 = await hook({});
  check(bad3.status === 400, 'cu cheia registrelor, o cerere goală e refuzată: ' + bad3.status);

  try {
    // 2. an edit, the hook, the database
    const t0 = Date.now();
    await ad.write(tab.title, { ['B' + ROW]: { v: MARK } });
    const tw = Date.now() - t0;
    const r = await hook({ spreadsheet_id: T.ssid, sheet_id: tab.sheetId, tab: tab.title, force: true });
    const res = (r.body.results || [])[0] || {};
    check(r.status === 200 && res.status === 'ok' && res.changed === 1, `cererea scriptului: ${r.status}, ${res.status}, ${res.changed} fila schimbată, ${r.ms} ms`);
    const topic = await inDb();
    check(topic === MARK, 'în baza de date lecția nouă e deja acolo');
    console.log(`     scrierea în Google ${tw} ms, citirea fișei de către platformă ${r.ms} ms: de la editare la baza de date ${(Date.now() - t0) / 1000} s`);
    const again = await hook({ spreadsheet_id: T.ssid, sheet_id: tab.sheetId, tab: tab.title });
    check(((again.body.results || [])[0] || {}).changed === 0, 'a doua cerere, fără alt edit, nu schimbă nimic (0 fișe)');
    const stamp = await rest(`reg_workbooks?select=last_change_at&id=eq.${wb.id}`);
    check(Array.isArray(stamp) && stamp[0] && stamp[0].last_change_at, 'registrul are semnul „ultima schimbare” (migrația 20261011100000 rulată, consola va vedea editarea)');
  } finally {
    await ad.write(tab.title, { ['B' + ROW]: { v: '' } });
    const r = await hook({ spreadsheet_id: T.ssid, sheet_id: tab.sheetId, tab: tab.title });
    await sleep(300);
    check((await inDb()) === null, 'celula pusă la loc și baza de date la fel');
  }
  console.log(`\n${ok} verificări reușite, ${bad} eșuate`);
  if (bad) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
