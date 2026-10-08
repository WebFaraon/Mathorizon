/* Writes the SQL that registers the demo registers in reg_workbooks (run it once in the Supabase SQL Editor, after the migration).
     node scripts/registru-import/google/seed-sql.js
   Output: _import/demo/seed-workbooks.sql (outside git). owner_user_id stays empty: only admins see them until a register is given to a teacher. */
'use strict';
const fs = require('fs');
const path = require('path');
const links = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '_import', 'demo', 'links.json'), 'utf8'));
const q = t => "'" + String(t).replace(/'/g, "''") + "'";
const rows = Object.keys(links.teachers).map(tid => `  (${q(links.teachers[tid].ssid)}, ${q(links.teachers[tid].name + ' Registru EXAMEN.MD OFFLINE 2025-2026 (DEMO)')}, ${q(links.teachers[tid].name)}, 2025)`);
const sql = `-- ${rows.length} registre demo. Rulează o singură dată, după migrația 20261008120000_registre_sync.sql.
insert into public.reg_workbooks (spreadsheet_id, title, teacher_name, school_year_from) values
${rows.join(',\n')}
on conflict (spreadsheet_id) do nothing;
`;
const out = path.join(__dirname, '..', '..', '..', '_import', 'demo', 'seed-workbooks.sql');
fs.writeFileSync(out, sql);
console.log(`${rows.length} registre în ${out}`);
