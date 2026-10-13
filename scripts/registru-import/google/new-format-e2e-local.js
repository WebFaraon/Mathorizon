/* Proves the platform's writes on a register ALREADY CONVERTED to the new format (convert-format.js), with the same code as the Edge Functions, from this computer:
   a new group online (a new tab from "Grup Model", C1 = Online, a NEW COLUMN in "Total achitări" copied from the model column H, the first student), another one offline,
   a group of 10 online, the refusals (10 offline, 8 online), a payment on a student; the importer's parser reads it all back, "Total achitări" picks the groups up
   (Online / Offline split), and everything is put back (tabs deleted, columns removed, the payment cleared).
     node scripts/registru-import/google/new-format-e2e-local.js <spreadsheetId of a TEST copy, already converted>
   Writes in the register it is given: use it on a copy. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..');
const KEY = JSON.parse(fs.readFileSync(path.join(root, '_import', 'google-service-account.json'), 'utf8'));
const id = process.argv[2];
if (!id) { console.error('Folosire: new-format-e2e-local.js <idRegistruConvertit>'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { createAdapter, readWorkbook } = await import('../../../supabase/functions/_shared/registru/google.mjs');
  const { applyNewGroupAsync, applyAsync, applySetGroupAsync } = await import('../../../supabase/functions/_shared/registru/apply.mjs');
  const { valuesBook } = await import('../../../supabase/functions/_shared/registru/sync-core.mjs');
  const { parseWorkbook } = await import('../../../supabase/functions/_shared/registru/parse.mjs');
  const adapter = createAdapter(KEY, id);
  let ok = 0, bad = 0;
  const check = (c, m) => { if (c) ok++; else bad++; console.log((c ? '  ok  ' : '  !!  ') + m); };
  const model = async () => { const d = await readWorkbook(KEY, id); return parseWorkbook(valuesBook(d, d.title + '.xlsx'), { yearFrom: 2025 }); };

  const m0 = await model();
  const base = m0.groups.length, names0 = m0.total.tabs.length;
  check(m0.config.newFormat && m0.total.layout === 'new', `registrul e în formatul nou (${base} grupe, ${names0} file în Total)`);
  const created = [];
  const S = { name: 'Testescu Maria', phone: '069 000 222', manager: 'Cerchez Cristina', status: 'Oră de probă' };
  const mk = (o, days) => ({ id: 'e2e-' + Math.random(), type: 'NEW_GROUP', group: Object.assign({ size: 3, subject: 'Matematica', summer: false, grade: 'XI', profile: 'Uman', level: '6 ― 7', days, start: 20, duration: 1, cabinet: '13', teacherLevel: 7, state: 'Se completează', mode: 'Online' }, o), student: S });

  const a = await applyNewGroupAsync(adapter, mk({}, [2, 5]));
  check(a.status === 'done' && a.source === 'Grup Model', 'grupă online nouă din „Grup Model”: ' + JSON.stringify({ s: a.status, c: a.code, m: a.msg, src: a.source }));
  if (a.tab) created.push(a.tab);
  const b = await applyNewGroupAsync(adapter, mk({ mode: 'Offline', start: 18, size: 6 }, [1, 4]));
  check(b.status === 'done', 'grupă offline nouă: ' + JSON.stringify({ s: b.status, c: b.code, m: b.msg }));
  if (b.tab) created.push(b.tab);
  const c = await applyNewGroupAsync(adapter, mk({ size: 10, start: 19 }, [3]));
  check(c.status === 'done', 'grupă de 10 elevi online: ' + JSON.stringify({ s: c.status, c: c.code, m: c.msg }));
  if (c.tab) created.push(c.tab);
  const r1 = await applyNewGroupAsync(adapter, mk({ size: 10, mode: 'Offline', start: 17 }, [6])), r2 = await applyNewGroupAsync(adapter, mk({ size: 8, start: 17 }, [6]));
  check(r1.code === 'size-mode' && r2.code === 'size-mode', 'refuzate: 10 elevi offline și 8 elevi online (' + r1.code + ', ' + r2.code + ')');

  await sleep(6000);
  const m1 = await model();
  const find = tab => m1.groups.find(g => g.tab === tab) || {};
  const ga = find(a.tab), gb = find(b.tab), gc = find(c.tab);
  check(m1.groups.length === base + 3, `platforma vede ${m1.groups.length} grupe (era ${base}, +3)`);
  check(ga.mode === 'online' && ga.price === 258 && ga.size === 3, `grupa online de 3: mod ${ga.mode}, preț ${ga.price}`);
  check(gb.mode === 'offline' && gb.price === 218 && gb.size === 6, `grupa offline de 6: mod ${gb.mode}, preț ${gb.price}`);
  check(gc.mode === 'online' && gc.price === 108 && gc.size === 10, `grupa online de 10: mod ${gc.mode}, preț ${gc.price}`);
  check([ga, gb, gc].every(g => g.students && g.students.length === 1 && g.students[0].status === 'Oră de probă'), 'fiecare grupă nouă are primul elev, cu statutul Oră de probă');
  check(m1.total.tabs.length === names0 + 3 && created.every(t => m1.total.tabs.some(x => x.name === t)), `„Total achitări” are ${m1.total.tabs.length} file în listă (+3), coloane noi copiate din model`);
  check(!!ga.schedule && ga.schedule.some(s => s.cabinet === '13'), 'orarul și cabinetul grupei noi sunt citite');

  // a payment on the first student of the new group: the cost and the sold follow the NEW price formula
  const st = ga.students[0];
  const pay = await applyAsync(adapter, { id: 'e2e-pay', type: 'ADD_PAYMENT', tab: a.tab, student: { name: S.name, phone: '069000222' }, amount: 258 });
  check(pay.status === 'done', 'plată pe elev în grupa nouă: ' + JSON.stringify({ s: pay.status, c: pay.code, m: pay.msg }));
  await sleep(3000);
  const m2 = await model();
  const s2 = (m2.groups.find(g => g.tab === a.tab) || { students: [{}] }).students[0];
  check(s2.paid && s2.paid.value === 258 && s2.cached.sold === 258, `plata se vede la elev: achitat ${s2.paid && s2.paid.value}, sold ${s2.cached && s2.cached.sold}`);

  // the group moves to another hour: its tab is renamed after the schedule and its name in the Total list (new layout, from H) goes with it
  const sg = await applySetGroupAsync(adapter, { id: 'e2e-set', type: 'SET_GROUP', tab: a.tab, schedule: { days: [2, 5], start: 21, duration: 1, cabinet: '13' }, expect: { schedule: { days: [2, 5], start: 20, duration: 1, cabinet: '13' } } });
  check(sg.status === 'done' && !sg.renameNote && sg.renamed && sg.renamed.total === true, 'mutarea orarului a redenumit fila și numele din „Total achitări”: ' + JSON.stringify({ s: sg.status, n: sg.renameNote, r: sg.renamed }));
  if (sg.tab) created[created.indexOf(a.tab)] = sg.tab;
  await sleep(4000);
  const m4 = await model();
  check(m4.total.tabs.some(x => x.name === sg.tab) && !m4.total.tabs.some(x => x.name === a.tab) && m4.groups.some(g => g.tab === sg.tab), 'platforma vede grupa sub numele nou, iar Total o listează sub numele nou');

  // put everything back
  const again = async fn => { for (let i = 0; i < 5; i++) { try { return await fn(); } catch (e) { if (!/limita/i.test(e.message)) throw e; await sleep(25000); } } };
  for (const t of created.reverse()) { try { await again(() => adapter.remove(t)); } catch (e) { console.log('   (nu am putut șterge fila ' + t + ': ' + e.message + ')'); } }
  const total = await adapter.tabs();
  const tt = total.find(x => x.title === 'Total achitări');
  // the columns of Total made for the new groups are the last ones: take them away from the right, as many as were added
  for (let i = 0; i < created.length; i++) { const L = String.fromCharCode(64 + 7 + names0 + created.length - i); try { await again(() => adapter.removeColumn('Total achitări', L)); } catch (e) { console.log('   (coloana ' + L + ': ' + e.message + ')'); } }
  await sleep(4000);
  const m3 = await model();
  check(m3.groups.length === base && m3.total.tabs.length === names0, `curățat: ${m3.groups.length} grupe, ${m3.total.tabs.length} file în Total (ca la început)`);
  console.log(`\n${ok} verificări reușite, ${bad} eșuate`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('EROARE: ' + e.message); process.exit(1); });
