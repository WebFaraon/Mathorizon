/* Proves NEW_GROUP on a REAL demo register in Google, from this computer, with the same code as the Edge Function:
   a new group (a new tab, filled in, listed in "Total achitari", with its first student) is created in a demo register, the importer's parser
   reads it back, the Total tab's formulas pick it up, and then everything is put back (the tab deleted, the Total cell cleared).
     node scripts/registru-import/google/new-group-local.js [t26]
   Only the demo registers of _import/demo/links.json are touched. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..');
const KEY = JSON.parse(fs.readFileSync(path.join(root, '_import', 'google-service-account.json'), 'utf8'));
const links = JSON.parse(fs.readFileSync(path.join(root, '_import', 'demo', 'links.json'), 'utf8'));
const tid = process.argv[2] || 't26';

(async () => {
  const { createAdapter, readWorkbook } = await import('../../../supabase/functions/_shared/registru/google.mjs');
  const { applyNewGroupAsync } = await import('../../../supabase/functions/_shared/registru/apply.mjs');
  const { valuesBook } = await import('../../../supabase/functions/_shared/registru/sync-core.mjs');
  const { parseWorkbook } = await import('../../../supabase/functions/_shared/registru/parse.mjs');
  const T = links.teachers[tid];
  const adapter = createAdapter(KEY, T.ssid);
  let ok = 0, bad = 0;
  const check = (c, m) => { if (c) ok++; else bad++; console.log((c ? '  ok  ' : '  !!  ') + m); };

  const before = await adapter.tabs();
  const keys = []; for (let c = 6; c <= 35; c++) keys.push(String.fromCharCode(64 + (c <= 26 ? c : 0)) + (c <= 26 ? '' : '') + '4');
  const totalKeys = []; for (let c = 6; c <= 35; c++) totalKeys.push((c <= 26 ? String.fromCharCode(64 + c) : 'A' + String.fromCharCode(64 + c - 26)) + '4');
  const totalBefore = await adapter.read('Total achitări', totalKeys);
  console.log(`Registrul lui ${T.name}: ${before.length} file`);

  const cmd = {
    id: 'newgroup-test-' + Date.now(), type: 'NEW_GROUP',
    group: { size: 4, subject: 'Matematica', summer: false, grade: 'XI', profile: 'Uman', level: '6-7', days: [2, 5], start: 20, duration: 1, cabinet: '13', teacherLevel: 4, state: 'Se completează' },
    student: { name: 'Testescu Maria', phone: '069 000 222', manager: 'Cerchez Cristina', status: 'Oră de probă' }
  };
  const r = await applyNewGroupAsync(adapter, cmd);
  check(r.status === 'done' && r.tab && r.column === 'D' && r.totalListed, 'grupa nouă a fost creată: ' + JSON.stringify({ s: r.status, t: r.tab, c: r.column, m: r.msg }));
  if (r.status !== 'done') process.exit(1);
  try {
    const d = await readWorkbook(KEY, T.ssid);
    const m = parseWorkbook(valuesBook(d, d.title + '.xlsx'));
    const g = m.groups.find(x => x.tab === r.tab);
    check(!!g, 'importerul găsește grupa nouă după nume: ' + r.tab);
    check(g && g.size === 4 && g.state === 'Se completează' && g.subject === 'Matematica' && g.grade === 'XI' && g.profile === 'Uman' && g.level === '6-7', 'format, stare, materie, clasă, profil și nivel citite înapoi');
    check(g && g.schedule.filter(s => !s.stub).length === 2 && g.schedule[0].day === 2 && g.schedule[0].hour === 20 && g.schedule[1].day === 5 && g.schedule[0].cabinet === '13', 'orarul: marți și vineri la 20:00, cabinetul 13');
    check(g && g.students.length === 1 && g.students[0].name === 'Testescu Maria' && g.students[0].phone === '+37369000222' && g.students[0].status === 'Oră de probă' && g.students[0].manager === 'Cerchez Cristina', 'primul elev e în prima coloană, cu statutul și managerul lui');
    check(g && g.lessons.length === 0 && g.level !== null, 'fila e curată: nicio lecție, nicio prezență, nicio plată din grupa de la care s-a copiat');
    check(g && g.lessons.every(l => l) && g.students[0].paid.value === 0 && g.students[0].cached.cost === 0 && g.students[0].cached.sold === 0, 'formulele filei dau 0 (cost, sold)');
    // the Total tab lists it and its formulas read it without error
    const tot = await adapter.read('Total achitări', totalKeys);
    const slot = totalKeys.find(k => tot[k].v === r.tab);
    check(!!slot, 'numele filei e în lista din „Total achitări” (' + slot + ')');
    if (slot) { const col = slot.replace('4', ''); const below = await adapter.read('Total achitări', [col + '3', col + '6', col + '7']); check(typeof below[col + '3'].v === 'number' && String(below[col + '6'].v).includes('Grup cu 4') && below[col + '7'].v === 'Se completează', `formulele din Total citesc fila nouă: lecții ${below[col + '3'].v}, format „${below[col + '6'].v}”, stare „${below[col + '7'].v}”`); }
  } finally {
    // put everything back: the tab, the Total cell
    await adapter.remove(r.tab);
    const clear = {}; totalKeys.forEach(k => { if (!totalBefore[k].v) clear[k] = { v: '' }; else clear[k] = { v: totalBefore[k].v }; });
    await adapter.write('Total achitări', clear);
    const after = await adapter.tabs(), totalAfter = await adapter.read('Total achitări', totalKeys);
    check(after.length === before.length && after.every((x, i) => x.title === before[i].title) && totalKeys.every(k => (totalAfter[k].v || null) === (totalBefore[k].v || null)), 'registrul e la loc: aceleași file, aceeași listă din Total');
  }
  console.log(`\n${ok} verificări reușite, ${bad} eșuate`);
  if (bad) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
