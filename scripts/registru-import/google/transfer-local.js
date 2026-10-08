/* Proves the TRANSFER on two REAL demo registers in Google, from this computer, with the same code as the Edge Function:
   an Activ student with money moves from a group of one register to a group of another register, the Calculator's split is applied,
   the importer's parser reads both registers back, the same command again changes nothing, and every cell is put back as it was.
     node scripts/registru-import/google/transfer-local.js
   Only the demo registers of _import/demo/links.json are touched. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..');
const KEY = JSON.parse(fs.readFileSync(path.join(root, '_import', 'google-service-account.json'), 'utf8'));
const links = JSON.parse(fs.readFileSync(path.join(root, '_import', 'demo', 'links.json'), 'utf8'));
const snap = JSON.parse(fs.readFileSync(path.join(root, '_import', 'demo', 'snapshot.json'), 'utf8'));

(async () => {
  const { createAdapter, tabTitle, readWorkbook } = await import('../../../supabase/functions/_shared/registru/google.mjs');
  const { applyTransferAsync } = await import('../../../supabase/functions/_shared/registru/apply.mjs');
  const { splitMoney } = await import('../../../supabase/functions/_shared/registru/pay.mjs');
  const { valuesBook } = await import('../../../supabase/functions/_shared/registru/sync-core.mjs');
  const { parseWorkbook } = await import('../../../supabase/functions/_shared/registru/parse.mjs');
  let ok = 0, bad = 0;
  const check = (c, m) => { if (c) ok++; else bad++; console.log((c ? '  ok  ' : '  !!  ') + m); };

  // the source: an Activ student with payments and a cost, in a group of the first register that has one
  const wbOf = id => snap.workbooks.find(w => w.id === id), tidOf = wb => wb.id.replace('wb-', '');
  const cand = snap.students.find(s => s.status === 'Activ' && s.paid > 300 && s.cost > 300 && s.cost < s.paid + s.discount + 1);
  const gFrom = snap.groups.find(g => g.id === cand.group_id), wFrom = wbOf(gFrom.workbook_id);
  // the destination: another register, a group with a free seat
  const live = g => snap.students.filter(s => s.group_id === g.id && ['Activ', 'Oră de probă', 'Oră de probă confirmată', 'Înlocuire'].includes(s.status)).length;
  const cols = g => snap.students.filter(s => s.group_id === g.id).length;
  const gTo = snap.groups.find(g => g.workbook_id !== gFrom.workbook_id && g.format_size && live(g) < g.format_size && cols(g) < 20);
  const wTo = wbOf(gTo.workbook_id);
  console.log(`Din „${gFrom.tab}” (${wFrom.teacher_name}) în „${gTo.tab}” (${wTo.teacher_name}); elev cu achitări ${cand.paid}, reduceri ${cand.discount}, cost ${cand.cost}`);

  const aFrom = createAdapter(KEY, wFrom.spreadsheet_id), aTo = createAdapter(KEY, wTo.spreadsheet_id);
  const fromTab = await tabTitle(KEY, wFrom.spreadsheet_id, gFrom.sheet_id), toTab = await tabTitle(KEY, wTo.spreadsheet_id, gTo.sheet_id);
  const oldCells = ['8', '3', '4'].map(r => cand.col + r);
  const before = await aFrom.read(fromTab, oldCells);                                   // to put back
  const sold = await aFrom.read(fromTab, [cand.col + '3', cand.col + '4', cand.col + '5']);
  const A = sold[cand.col + '3'].v || 0, R = sold[cand.col + '4'].v || 0, C = sold[cand.col + '5'].v || 0;
  const m = splitMoney(A, R, C);
  console.log(`În registru: achitări ${A}, reduceri ${R}, cost ${C} -> rămân ${m.achC + m.redC}, trec ${m.achRem + m.redRem}, datorie ${m.debt}`);

  const cmd = { id: 'transfer-test-' + Date.now(), type: 'TRANSFER', fromTab, toTab, student: { col: cand.col.charCodeAt(0) - 64, name: cand.name, phone: cand.phone }, status: 'Activ', manager: cand.manager || 'Cerchez Cristina', expect: { A, R, C } };
  const r1 = await applyTransferAsync({ from: aFrom, to: aTo }, cmd);
  check(r1.status === 'done' && r1.phases.length === 2, 'transferul s-a scris în două faze: ' + JSON.stringify({ s: r1.status, c: r1.column, m: r1.msg }));
  if (r1.status !== 'done') { process.exit(1); }
  const L = r1.column;
  try {
    // the parser reads both registers back
    const read = async (w, tab) => { const d = await readWorkbook(KEY, w.spreadsheet_id); return parseWorkbook(valuesBook(d, d.title + '.xlsx')).groups.find(g => g.tab === tab); };
    const gNew = await read(wTo, toTab), gOld = await read(wFrom, fromTab);
    const sNew = gNew.students.find(s => s.colLetter === L), sOld = gOld.students.find(s => s.colLetter === cand.col);
    check(sNew && sNew.name === cand.name && sNew.phone === cand.phone && sNew.status === 'Activ', 'în grupa nouă: elevul în coloana ' + L + ' cu numele, telefonul și statutul lui');
    check(sNew && Math.abs(sNew.paid.value - m.achRem) < 0.01 && Math.abs(sNew.discount.value - m.redRem) < 0.01 && Math.abs(sNew.cached.sold - (m.achRem + m.redRem)) < 0.01, `în grupa nouă: au trecut ${m.achRem} + ${m.redRem}, soldul lui e ${sNew && sNew.cached.sold}`);
    check(sOld && sOld.status === 'Transferat' && Math.abs(sOld.paid.value - m.achC) < 0.01 && Math.abs(sOld.discount.value - m.redC) < 0.01, `în grupa veche: Transferat, au rămas ${m.achC} + ${m.redC}`);
    check(sOld && Math.abs(sOld.cached.sold + m.debt) < 0.01, `în grupa veche soldul e ${sOld && sOld.cached.sold} (0, sau datoria lui ${m.debt})`);
    // the same again: nothing
    const r2 = await applyTransferAsync({ from: aFrom, to: aTo }, Object.assign({}, cmd, { id: cmd.id + 'b', expect: undefined }));
    check(r2.status === 'noop', 'aceeași comandă a doua oară nu schimbă nimic: ' + r2.status);
  } finally {
    // put everything back
    await aTo.write(toTab, { [L + '1']: { v: '' }, [L + '7']: { v: '' }, [L + '8']: { v: '' }, [L + '3']: { f: 'sum(0)' }, [L + '4']: { f: 'sum(0)' } });
    const back = {};
    oldCells.forEach(k => { const c = before[k]; back[k] = c.f ? { f: c.f } : { v: c.v === undefined ? '' : c.v }; });
    await aFrom.write(fromTab, back);
    const a = await aFrom.read(fromTab, oldCells), b = await aTo.read(toTab, [L + '1', L + '8']);
    const same = oldCells.every(k => (a[k].f || null) === (before[k].f || null) && (a[k].v == null ? null : a[k].v) === (before[k].v == null ? null : before[k].v));
    check(same && !b[L + '1'].v && !b[L + '8'].v, 'toate celulele au fost puse la loc, în ambele registre');
  }
  console.log(`\n${ok} verificări reușite, ${bad} eșuate`);
  if (bad) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
