/* Runs the same command code as the Edge Function against a REAL demo register in Google, from this computer, to prove the write path:
   plan -> re-read -> write -> read back, on a live sheet. It enrols a test student in one group of a demo register, checks that the
   importer's parser reads him back, tries the same command twice (the second must be refused), and puts the three cells back as they were.
     node scripts/registru-import/google/apply-local.js [t26]
   Only demo registers (_import/demo/links.json) are touched. */
'use strict';
const fs = require('fs');
const path = require('path');
const KEY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '_import', 'google-service-account.json'), 'utf8'));
const links = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '_import', 'demo', 'links.json'), 'utf8'));
const tid = process.argv[2] || 't26';

(async () => {
  const { createAdapter, tabTitle, readWorkbook } = await import('../../../supabase/functions/_shared/registru/google.mjs');
  const { applyAsync } = await import('../../../supabase/functions/_shared/registru/apply.mjs');
  const { valuesBook } = await import('../../../supabase/functions/_shared/registru/sync-core.mjs');
  const { parseWorkbook } = await import('../../../supabase/functions/_shared/registru/parse.mjs');
  const T = links.teachers[tid];
  const adapter = createAdapter(KEY, T.ssid);
  let ok = 0, bad = 0;
  const check = (c, m) => { if (c) ok++; else { bad++; console.log('  NU: ' + m); } console.log((c ? '  ok  ' : '  !!  ') + m); };

  // a group of this register with a free seat and a free column
  let target = null;
  for (const g of T.groups) {
    const tab = await tabTitle(KEY, T.ssid, g.gid);
    const book = await adapter.load(tab);
    const s = book.sheet(tab);
    const size = +(/(\d+)/.exec(s.text(1, 1)) || [])[1];
    const live = [];
    for (let c = 4; c <= 26; c++) if (s.text(1, c) && ['activ', 'ora de proba', 'ora de proba confirmata', 'inlocuire'].includes(s.text(8, c).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())) live.push(c);
    if (size && live.length < size) { target = { g, tab, size, live: live.length }; break; }
  }
  if (!target) { console.log('Nicio grupă cu loc liber în registrul ' + tid); return; }
  console.log(`Grupa „${target.tab}” (${target.live}/${target.size} elevi)`);

  const cmd = { id: 'test-' + Date.now(), type: 'ADD_STUDENT', tab: target.tab, name: 'Testescu Ionela', phone: '069 000 111', manager: 'Cerchez Cristina', status: 'Oră de probă' };
  const r1 = await applyAsync(adapter, cmd);
  check(r1.status === 'done' && /^[D-Z]$/.test(r1.column), 'comanda s-a scris: ' + JSON.stringify({ status: r1.status, column: r1.column, msg: r1.msg }));
  if (r1.status !== 'done') return;

  // the parser reads the new student back exactly as the sync would
  const data = await readWorkbook(KEY, T.ssid);
  const m = parseWorkbook(valuesBook(data, data.title + '.xlsx'));
  const grp = m.groups.find(x => x.tab === target.tab), st = grp.students.find(x => x.colLetter === r1.column);
  check(st && st.name === 'Testescu Ionela' && st.phone === '+37369000111' && st.status === 'Oră de probă' && st.manager === 'Cerchez Cristina', 'importerul îl citește înapoi: ' + JSON.stringify(st && { name: st.name, phone: st.phone, status: st.status, manager: st.manager }));
  check(st && st.paid.value === 0 && st.discount.value === 0, 'plățile lui sunt 0 (formulele șablonului)');

  // the same person again: refused, nothing written
  const r2 = await applyAsync(adapter, Object.assign({}, cmd, { id: 'test-' + Date.now() + 'b' }));
  check(r2.status === 'invalid' && r2.code === 'duplicate', 'a doua oară e refuzat ca duplicat: ' + r2.status + ' ' + r2.code);

  // a payment on him, then a refund: the sum continues
  const who = { name: 'Testescu Ionela', phone: '069000111' };
  const p1 = await applyAsync(adapter, { id: 'test-p1-' + Date.now(), type: 'ADD_PAYMENT', tab: target.tab, student: who, amount: 300 });
  check(p1.status === 'done' && p1.writes[0].new.f === 'SUM(300)', 'plata de 300 devine SUM(300): ' + JSON.stringify(p1.writes && p1.writes[0].new));
  const p2 = await applyAsync(adapter, { id: 'test-p2-' + Date.now(), type: 'ADD_PAYMENT', tab: target.tab, student: who, amount: -50 });
  check(p2.status === 'done' && p2.writes[0].new.f === 'SUM(300-50)', 'retur de 50: ' + JSON.stringify(p2.writes && p2.writes[0].new));
  const s1 = await applyAsync(adapter, { id: 'test-s1-' + Date.now(), type: 'SET_STATUS', tab: target.tab, student: who, status: 'Activ', expectStatus: 'Oră de probă' });
  check(s1.status === 'done', 'statutul trece pe Activ');
  const s2 = await applyAsync(adapter, { id: 'test-s2-' + Date.now(), type: 'SET_STATUS', tab: target.tab, student: who, status: 'Inactiv', expectStatus: 'Oră de probă' });
  check(s2.status === 'conflict' && s2.code === 'stale', 'statut schimbat între timp: conflict, nimic scris');

  // put everything back: header, payment cells (they held =sum(0)), manager, status
  const L = r1.column;
  await adapter.write(target.tab, { [L + '1']: { v: '' }, [L + '7']: { v: '' }, [L + '8']: { v: '' }, [L + '3']: { f: 'sum(0)' }, [L + '4']: { f: 'sum(0)' } });
  const back = await adapter.read(target.tab, [L + '1', L + '3', L + '7', L + '8']);
  check(!back[L + '1'].v && !back[L + '7'].v && !back[L + '8'].v && back[L + '3'].f && /sum\(0\)/i.test(back[L + '3'].f), 'celulele au fost puse la loc');
  console.log(`\n${ok} verificări reușite, ${bad} eșuate`);
  if (bad) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
