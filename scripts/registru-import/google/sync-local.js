/* The F1 sync, run on this computer against the real Google registers, with an in-memory database instead of Supabase:
   proves the whole reading path (Google -> parser -> hash -> replace per group) and compares what is stored with the console.
     node scripts/registru-import/google/sync-local.js [--only t26] [--twice]
   --twice runs it a second time and shows that nothing is rewritten when nothing changed. */
'use strict';
const fs = require('fs');
const path = require('path');
const KEY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '_import', 'google-service-account.json'), 'utf8'));
const links = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '_import', 'demo', 'links.json'), 'utf8'));
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

(async () => {
  const { syncWorkbook } = await import('../../../supabase/functions/_shared/registru/sync-core.mjs');
  const { readWorkbook, driveModified } = await import('../../../supabase/functions/_shared/registru/google.mjs');
  const state = new Map(); let reads = 0; const wbRows = new Map();                   // what the workbooks table would remember: drive_modified, last_full_sync_at
  const store = new Map();                                    // workbook id -> Map(sheet_id -> group payload)
  const db = {
    async hashes(id) { return new Map([...(store.get(id) || new Map())].map(([k, v]) => [k, v.content_hash])); },
    async applyGroup(id, p) { if (!store.has(id)) store.set(id, new Map()); store.get(id).set(String(p.sheet_id), p); },
    async prune(id, keep) { const m = store.get(id) || new Map(); let n = 0; [...m.keys()].forEach(k => { if (!keep.map(String).includes(k)) { m.delete(k); n++; } }); return n; }
  };
  const ids = Object.keys(links.teachers).filter(t => !only || t === only);
  for (let pass = 1; pass <= (args.includes('--twice') ? 2 : 1); pass++) {
    reads = 0; const t0 = Date.now(); let seen = 0, changed = 0, unchanged = 0, skipped = 0;
    for (const tid of ids) {
      const T = links.teachers[tid];
      const st = state.get(tid) || {};
      let r;
      for (let attempt = 0; ; attempt++) {
        try { r = await syncWorkbook({ wb: Object.assign({ id: tid, spreadsheet_id: T.ssid }, st), read: id => { reads++; return readWorkbook(KEY, id); }, peek: id => driveModified(KEY, id), db }); break; }
        catch (e) { if (attempt < 3 && /limita pe minut/.test(e.message)) { console.log('  limita Google atinsă: aștept un minut'); await new Promise(res => setTimeout(res, 65000)); continue; } throw e; }
      }
      if (r.full) {
        state.set(tid, { drive_modified: r.modified, last_full_sync_at: new Date().toISOString() });
        wbRows.set(tid, { id: 'wb-' + tid, spreadsheet_id: T.ssid, title: r.title, teacher_name: r.teacher, project: r.workbook.project, config: r.workbook.config, teacher_data: r.workbook.teacher, enabled: true });
      }
      seen += r.seen; changed += r.changed; unchanged += r.unchanged; skipped += r.skipped.length;
      if (pass === 1) console.log(`${T.name}: ${r.seen} grupe, ${r.changed} scrise, ${r.skipped.length} oprite${r.notes.length ? ' | ' + r.notes.join('; ') : ''}`);
    }
    console.log(`Trecerea ${pass}: ${ids.length} registre, ${reads} citite din Google, ${seen} grupe, ${changed} scrise, ${unchanged} neschimbate, ${skipped} oprite, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  // the tables as the database would hold them: what the console's registry mode reads (and what the Node check feeds it)
  if (args.includes('--save')) {
    const tables = { workbooks: [], groups: [], students: [], lessons: [] };
    for (const tid of ids) {
      const wbr = wbRows.get(tid); tables.workbooks.push(wbr);
      store.get(tid).forEach((p, sheetId) => {
        const gid = `g-${tid}-${sheetId}`;
        tables.groups.push({ id: gid, workbook_id: wbr.id, sheet_id: p.sheet_id, tab: p.tab, format_size: p.format_size, state: p.state, subject: p.subject, summer: p.summer, grade: p.grade, level: p.level, profile: p.profile, schedule: p.schedule, cached_total_pay: p.cached_total_pay });
        p.students.forEach(st => tables.students.push({ id: `s-${gid}-${st.col}`, group_id: gid, col: st.col, name: st.name, phone: st.phone, manager: st.manager, status: st.status, paid: st.paid, discount: st.discount, cost: st.cost, sold: st.sold }));
        p.lessons.forEach(l => tables.lessons.push({ group_id: gid, row_no: l.row_no, date_text: l.date_text, iso: l.iso, topic: l.topic, teacher_level: l.teacher_level, teacher_pay: l.teacher_pay, marks: l.marks }));
      });
    }
    const out = path.join(__dirname, '..', '..', '..', '_import', 'demo', 'snapshot.json');
    fs.writeFileSync(out, JSON.stringify(tables));
    console.log(`Snapshot: ${tables.workbooks.length} registre, ${tables.groups.length} grupe, ${tables.students.length} coloane, ${tables.lessons.length} lecții -> ${out}`);
  }

  // what is stored, compared with the console
  const { D } = require('../demo-group');
  let students = 0, lessons = 0, bad = 0; const shown = [];
  for (const tid of ids) {
    const wb = store.get(tid);
    for (const g of links.teachers[tid].groups) {
      const p = wb.get(String(g.gid)), L = D.ledger(g.id), cons = L.rows.slice(0, 23);
      students += p.students.length; lessons += p.lessons.length;
      if (p.students.length !== cons.length) { bad++; shown.push(`${g.tab}: ${p.students.length} elevi în Sheets, ${cons.length} în consolă`); }
      p.students.forEach((s, i) => { if (cons[i] && (Math.abs((s.sold || 0) - cons[i].sold) > 0.01 || Math.abs((s.cost || 0) - cons[i].cost) > 0.01)) { bad++; if (shown.length < 8) shown.push(`${g.tab} ${s.col}: sold/cost diferă`); } });
    }
  }
  console.log(`Stocat: ${students} coloane de elevi, ${lessons} lecții; nepotriviri față de consolă: ${bad}`);
  shown.forEach(s => console.log(' - ' + s));
})().catch(e => { console.error(e.message); process.exit(1); });
