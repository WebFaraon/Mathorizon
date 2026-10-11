/* The lists for the Apps Script projects (apps-script/Mathorizon-sync.gs, docs/apps-script.md), READ ONLY:
   the enabled registers of the platform, split in lists of at most 20 (Google gives 20 triggers per project, one per register), each as the JSON the
   script's property REGISTERS wants. Also makes the registers' key once (_import/reg-hook-secret.txt, never printed, never in git): the value of the
   Supabase secret REG_HOOK_SECRET and of the script property HOOK_SECRET.
     node scripts/registru-import/apps-script-lists.js
   Needs SUPABASE_SERVICE_ROLE_KEY in .env. Prints counts and file ids, never names. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..', '..');
require(path.join(root, 'node_modules', 'dotenv')).config({ path: path.join(root, '.env'), quiet: true });
const URL_ = process.env.SUPABASE_URL || 'https://tfflpivehrrzmklvcyhe.supabase.co';
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SK) { console.error('Lipsește SUPABASE_SERVICE_ROLE_KEY din .env'); process.exit(1); }

(async () => {
  const res = await fetch(`${URL_}/rest/v1/reg_workbooks?select=spreadsheet_id&enabled=eq.true&order=spreadsheet_id.asc`, { headers: { apikey: SK, Authorization: 'Bearer ' + SK } });
  if (!res.ok) { console.error('Nu am putut citi registrele: ' + res.status); process.exit(1); }
  const ids = (await res.json()).map(r => r.spreadsheet_id);
  const file = path.join(root, '_import', 'reg-hook-secret.txt');
  let made = false;
  if (!fs.existsSync(file)) { fs.writeFileSync(file, crypto.randomBytes(32).toString('hex')); made = true; }
  console.log(`${ids.length} registre active.`);
  console.log(made ? 'Cheia registrelor: făcută acum în _import/reg-hook-secret.txt' : 'Cheia registrelor: există în _import/reg-hook-secret.txt');
  const per = 20;
  for (let i = 0, n = 1; i < ids.length; i += per, n++) {
    const part = ids.slice(i, i + per);
    console.log(`\nProiectul ${n} (${part.length} registre), proprietatea REGISTERS:`);
    console.log(JSON.stringify(part));
  }
})().catch(e => { console.error(e.message); process.exit(1); });
