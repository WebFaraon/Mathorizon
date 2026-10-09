/* Audit of the live system, READ ONLY: for every register in the platform's database, the register is read from Google and parsed with the same code as the
   sync, and compared with what the database holds. Nothing is written anywhere. Prints counts and the codes of what differs, never names or phones.
     node scripts/registru-import/audit-live.js [--only <n>]        (n = the position of a register in the list, to look at one)
   Needs in .env: SUPABASE_SERVICE_ROLE_KEY (reads the reg_* tables), and _import/google-service-account.json (reads the registers).
   What it checks per register:
     - groups: the ones in the sheet that the database does not have, has but differently (the same content hash the sync uses), or has and the sheet no longer has;
     - students and lessons: the counts in the sheet against the rows in the database;
     - the teacher's data: availability hours, what the teacher teaches;
     - the sheet's own problems (the importer's checks), as counts by code.
   Also: the last runs of the sync and the last commands of the console (failed / conflict), from the database. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
require(path.join(root, 'node_modules', 'dotenv')).config({ path: path.join(root, '.env') });
const KEY = JSON.parse(fs.readFileSync(path.join(root, '_import', 'google-service-account.json'), 'utf8'));
const URL_ = process.env.SUPABASE_URL || 'https://tfflpivehrrzmklvcyhe.supabase.co';
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SK) { console.error('Lipsește SUPABASE_SERVICE_ROLE_KEY din .env'); process.exit(1); }
const only = process.argv.includes('--only') ? +process.argv[process.argv.indexOf('--only') + 1] : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function rest(table, select, filter, order) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const u = `${URL_}/rest/v1/${table}?select=${select}${filter ? '&' + filter : ''}${order ? '&order=' + order : ''}`;
    const r = await fetch(u, { headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Range-Unit': 'items', Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 120)}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

(async () => {
  const { readWorkbook, QuotaError } = await import('../../supabase/functions/_shared/registru/google.mjs');
  const { syncWorkbook, valuesBook } = await import('../../supabase/functions/_shared/registru/sync-core.mjs');
  const { parseWorkbook } = await import('../../supabase/functions/_shared/registru/parse.mjs');
  const { validate } = await import('../../supabase/functions/_shared/registru/validate.mjs');
  const { linkPeople } = await import('../../supabase/functions/_shared/registru/link.mjs');

  const books = await rest('reg_workbooks', 'id,spreadsheet_id,title,enabled,school_year_from,teacher_data,last_status,last_error,last_full_sync_at', 'enabled=eq.true', 'teacher_name.asc,id.asc');
  const groups = await rest('reg_groups', 'id,workbook_id,sheet_id,content_hash,tab', null, 'workbook_id.asc,sheet_id.asc');
  const students = await rest('reg_students', 'id,group_id', null, 'group_id.asc');
  const lessons = await rest('reg_lessons', 'group_id', null, 'group_id.asc');
  console.log(`Baza de date: ${books.length} registre active, ${groups.length} grupe, ${students.length} coloane de elevi, ${lessons.length} lecții.\n`);

  const stuBy = new Map(), lesBy = new Map();
  students.forEach(s => stuBy.set(s.group_id, (stuBy.get(s.group_id) || 0) + 1));
  lessons.forEach(l => lesBy.set(l.group_id, (lesBy.get(l.group_id) || 0) + 1));

  const total = { registers: 0, groups: 0, missing: 0, differing: 0, extra: 0, countsOff: 0, teacherOff: 0, readFail: 0, errors: 0, warns: 0, skipped: 0 };
  const codes = {};
  const detail = [];
  for (let i = 0; i < books.length; i++) {
    if (only != null && i !== only) continue;
    const wb = books[i];
    const mine = groups.filter(g => g.workbook_id === wb.id);
    let data = null;
    for (let tries = 0; tries < 8 && !data; tries++) {
      try { data = await readWorkbook(KEY, wb.spreadsheet_id); } catch (e) {
        if (e instanceof QuotaError) { await sleep(20000); continue; }
        detail.push(`#${i}: nu s-a putut citi din Google: ${String(e.message).slice(0, 100)}`); break;
      }
    }
    if (!data) { total.readFail++; continue; }
    total.registers++;
    // the same decision as the sync: which groups would be written (= differ), through a database that only answers and never stores
    const hashes = new Map(mine.map(g => [String(g.sheet_id), g.content_hash]));
    let wouldChange = 0, extra = 0;
    const stub = { hashes: async () => hashes, applyGroup: async () => { wouldChange++; }, prune: async (id, keep) => { extra = mine.filter(g => !keep.includes(Number(g.sheet_id))).length; return extra; } };
    const r = await syncWorkbook({ wb: { id: wb.id, spreadsheet_id: wb.spreadsheet_id, school_year_from: wb.school_year_from }, read: async () => data, db: stub, force: true });
    const m = parseWorkbook(valuesBook(data, data.title + '.xlsx'), { yearFrom: wb.school_year_from || null });
    // counts: students and lessons in the sheet against the rows stored for the same group
    const sheetOf = new Map(data.tabs.map(t => [t.title, t.sheetId]));
    let countsOff = 0;
    for (const g of m.groups) {
      const row = mine.find(x => Number(x.sheet_id) === sheetOf.get(g.tab));
      if (!row) continue;
      if ((stuBy.get(row.id) || 0) !== g.students.length || (lesBy.get(row.id) || 0) !== g.lessons.length) countsOff++;
    }
    const missing = m.groups.filter(g => !mine.some(x => Number(x.sheet_id) === sheetOf.get(g.tab))).length;
    const dbAv = wb.teacher_data && wb.teacher_data.availability, shAv = m.availability;
    const n = a => (a && a.slots ? Object.values(a.slots).reduce((s, l) => s + l.length, 0) : 0);
    const teacherOff = (dbAv ? n(dbAv) : 0) !== n(shAv) ? 1 : 0;
    const issues = validate(m, linkPeople(m));
    issues.forEach(x => { if (x.level !== 'info') codes[x.level + ':' + x.code] = (codes[x.level + ':' + x.code] || 0) + 1; });
    total.groups += m.groups.length; total.missing += missing; total.differing += Math.max(0, wouldChange - missing); total.extra += extra;
    total.countsOff += countsOff; total.teacherOff += teacherOff; total.skipped += r.skipped.length;
    total.errors += issues.filter(x => x.level === 'error').length; total.warns += issues.filter(x => x.level === 'warn').length;
    const flags = [];
    if (missing) flags.push(`${missing} grupe lipsesc din baza de date`);
    if (wouldChange - missing > 0) flags.push(`${wouldChange - missing} grupe diferă de ce e în Google`);
    if (extra) flags.push(`${extra} grupe în baza de date nu mai există în registru`);
    if (countsOff) flags.push(`${countsOff} grupe cu număr diferit de elevi sau lecții`);
    if (teacherOff) flags.push(`disponibilitatea diferă (baza: ${n(dbAv)} ore, registru: ${n(shAv)})`);
    if (wb.last_status === 'failed') flags.push('ultima sincronizare a eșuat: ' + String(wb.last_error || '').slice(0, 80));
    if (flags.length) detail.push(`#${i}: ` + flags.join('; '));
    process.stdout.write(flags.length ? 'x' : '.');
  }
  console.log('\n');
  console.log(`Registre citite din Google: ${total.registers}${total.readFail ? ` (nu s-au putut citi: ${total.readFail})` : ''}; grupe în registre: ${total.groups}`);
  console.log(`Grupe lipsă în baza de date: ${total.missing} | grupe diferite: ${total.differing} | grupe rămase în plus: ${total.extra}`);
  console.log(`Grupe cu număr diferit de elevi/lecții: ${total.countsOff} | profesori cu disponibilitate diferită: ${total.teacherOff} | grupe oprite de verificări: ${total.skipped}`);
  console.log(`Probleme în registre (importatorul): ${total.errors} erori, ${total.warns} avertismente`);
  Object.keys(codes).sort().forEach(k => console.log('   ' + k + ' x' + codes[k]));
  if (detail.length) { console.log('\nDe văzut:'); detail.forEach(d => console.log('  ' + d)); } else console.log('\nNicio diferență între registre și baza de date.');

  // the console's commands and the sync's runs
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const cmds = await rest('reg_commands', 'type,status,created_at', `created_at=gte.${since}`, 'created_at.desc');
  const by = {};
  cmds.forEach(c => { const k = c.type + ':' + c.status; by[k] = (by[k] || 0) + 1; });
  console.log(`\nComenzi din consolă în ultimele 7 zile: ${cmds.length}`);
  Object.keys(by).sort().forEach(k => console.log('   ' + k + ' x' + by[k]));
  const stuck = cmds.filter(c => c.status === 'pending' || c.status === 'running').length;
  if (stuck) console.log(`   ATENȚIE: ${stuck} comenzi blocate în pending/running`);
  const runs = await rest('reg_sync_runs', 'status', `started_at=gte.${since}`, 'started_at.desc');
  const rb = {}; runs.forEach(x => { rb[x.status] = (rb[x.status] || 0) + 1; });
  console.log(`Rulări de sincronizare cu citire completă (7 zile): ${runs.length}`, JSON.stringify(rb));
})().catch(e => { console.error('EROARE:', e.message); process.exit(1); });
