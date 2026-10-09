/* Proves the REPLACEMENTS (docs/inlocuiri.md) on two REAL demo registers in Google, from this computer, with the same code as the Edge Functions:
   a group of one demo teacher gets a replacement tab in another demo teacher's register (state Inlocuire, students copied with no money), the substitute
   marks Prezent / Absent motivat / Absent, the engine moves the money of one lesson per paying mark from the base register to the substitute's tab, a changed
   mark gives it back, the mark returns, the tab is closed at the end - and then EVERYTHING is put back (the tab deleted, the Total cell and the money cells restored).
     node scripts/registru-import/google/replacement-local.js [fromTeacher=t1] [toTeacher=t26]
   Only the demo registers of _import/demo/links.json are touched. The log prints counts and amounts, never names or phones. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..', '..');
const KEY = JSON.parse(fs.readFileSync(path.join(root, '_import', 'google-service-account.json'), 'utf8'));
const links = JSON.parse(fs.readFileSync(path.join(root, '_import', 'demo', 'links.json'), 'utf8'));
const FROM = process.argv[2] || 't1', TO = process.argv[3] || 't26';
const imp = f => import('../../../supabase/functions/_shared/registru/' + f);

(async () => {
  const { createAdapter, readWorkbook, readGroupTab } = await imp('google.mjs');
  const { applyAsync } = await imp('apply.mjs');
  const { applyReplacementCreateAsync } = await imp('replacement.mjs');
  const { settleReplacements } = await imp('replacement-engine.mjs');
  const { splitReplacement, priceFor } = await imp('pay.mjs');
  const { valuesBook } = await imp('sync-core.mjs');
  const { parseWorkbook, colLetter } = await imp('parse.mjs');
  const A = links.teachers[FROM], B = links.teachers[TO];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Google allows 60 reads a minute: a call refused for that is simply asked again a minute later (nothing was done by the refused call)
  const patient = f => async (...a) => { for (;;) { try { return await f(...a); } catch (e) { if (/limita pe minut|Quota|429/.test(String(e.message))) { console.log('     (limita Google; aștept un minut)'); await sleep(65000); continue; } throw e; } } };
  const wrap = ad => Object.fromEntries(Object.entries(ad).map(([k, v]) => [k, typeof v === 'function' ? patient(v.bind(ad)) : v]));
  const from = wrap(createAdapter(KEY, A.ssid)), to = wrap(createAdapter(KEY, B.ssid));
  let ok = 0, bad = 0;
  const check = (c, m) => { if (c) ok++; else bad++; console.log((c ? '  ok  ' : '  !!  ') + m); };
  const parse = patient(async ssid => { const d = await readWorkbook(KEY, ssid); return parseWorkbook(valuesBook(d, d.title + '.xlsx')); });
  // one tab only (two Google calls): the whole-register read is for the first look; the quota is shared with the minute cron
  const tabModel = patient(async (ad, ssid, tab) => { const id = (await ad.tabs()).find(x => x.title === tab).sheetId; const d = await readGroupTab(KEY, ssid, id, tab); return parseWorkbook(valuesBook(d, d.title + '.xlsx')).groups.find(x => x.tab === tab); });
  const L = s => (typeof s.col === 'number' ? colLetter(s.col) : s.col);
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

  // 1. a base group with students that have money
  const m0 = await parse(A.ssid);
  const g0 = m0.groups.find(g => g.state === 'Activ' && g.size === 6 && g.students.filter(s => s.status === 'Activ' && s.paid && s.paid.value > 218).length >= 3);
  if (!g0) { console.log('Nu am găsit o grupă de 6 elevi cu trei elevi cu bani în registrul ' + FROM); process.exit(1); }
  const fromTab = g0.tab, cols = g0.students.map(L);
  const rowKeys = []; cols.forEach(c => { rowKeys.push(c + '3', c + '4'); });
  const keep = await from.read(fromTab, rowKeys);                    // to put back at the end
  const money = col => ({ a: Number((keep[col + '3'] || {}).v) || 0, r: Number((keep[col + '4'] || {}).v) || 0 });
  const payers = g0.students.filter(s => s.status === 'Activ' && s.paid && s.paid.value > 218);
  const [s1, s2, s3] = payers;
  console.log(`Grupa de bază din registrul ${FROM}: ${g0.students.length} elevi, ${payers.length} cu bani`);

  const toTabsBefore = await to.tabs();
  const totalKeys = []; for (let c = 6; c <= 35; c++) totalKeys.push((c <= 26 ? String.fromCharCode(64 + c) : 'A' + String.fromCharCode(64 + c - 26)) + '4');
  const totalBefore = await to.read('Total achitări', totalKeys);
  let replTab = null;
  try {
    // 2. the replacement tab
    const sch = g0.schedule.filter(x => !x.stub)[0];
    const dates = [{ iso: '2026-10-15', start: sch ? sch.hour : 10, duration: 1, cabinet: sch && sch.cabinet ? String(sch.cabinet) : '13' }];
    const cr = await applyReplacementCreateAsync({ from, to }, { id: 'repl-proof-' + Date.now(), fromTab, dates, teacherLevel: 4 });
    check(cr.status === 'done' && cr.tab && cr.price === priceFor(6) && cr.reused === false, 'fila de înlocuire a fost creată: ' + JSON.stringify({ s: cr.status, c: cr.code, price: cr.price, students: cr.students, msg: cr.msg }));
    if (cr.status !== 'done') throw new Error('stop');
    replTab = cr.tab;
    const g1 = await tabModel(to, B.ssid, replTab);
    const copied = g0.students.filter(s => ['Activ', 'Instabil', 'Oră de probă', 'Oră de probă confirmată', 'Înlocuire'].includes(s.status));
    check(g1 && g1.state === 'Înlocuire' && g1.size === 6, 'starea grupei: Înlocuire, format cu 6 elevi');
    if (g1) console.log('     copiați:', g1.students.length, 'așteptați:', copied.length, 'statusuri:', JSON.stringify(g1.students.map(s => s.status)), 'din bază:', JSON.stringify(g0.students.map(s => s.status)));
    check(g1 && g1.students.length === copied.length && g1.students.every(s => s.status === 'Înlocuire'), `${g1 && g1.students.length} elevi copiați, toți cu statutul Înlocuire (inactivii și transferații nu)`);
    check(g1 && g1.students.every(s => (s.paid.value || 0) === 0 && (s.discount.value || 0) === 0 && (s.cached.sold || 0) === 0), 'în fila nouă achitările, reducerile și soldul sunt 0');
    check((await tabModel(from, A.ssid, fromTab)).students.every((s, i) => s.status === g0.students[i].status), 'în registrul de bază statutul elevilor a rămas neschimbat (Activ rămâne Activ)');
    const colOf = s => L(g1.students.find(x => x.phone === s.phone));
    const c1 = colOf(s1), c2 = colOf(s2), c3 = colOf(s3);

    // 3. the substitute marks
    const markRow = 9;
    await to.write(replTab, { ['A' + markRow]: { v: '15 Octombrie' }, ['B' + markRow]: { v: 'Înlocuire (probă)' }, [c1 + markRow]: { v: 'Prezent' }, [c2 + markRow]: { v: 'Absent motivat' }, [c3 + markRow]: { v: 'Absent' } });

    const state = { items: new Map(), status: 'active' };
    const journal = new Map();
    const run = async req => {
      if (journal.has(req.id)) return journal.get(req.id);
      const orig = req.workbook === 'O';
      const r = await applyAsync(orig ? from : to, Object.assign({ id: req.id, type: req.type, tab: orig ? fromTab : replTab }, req.payload));
      journal.set(req.id, r); return r;
    };
    const db = {
      replacements: async () => [{ id: 'proof', origWorkbook: 'O', origSheet: 1, replWorkbook: 'R', replSheet: 2, status: state.status, dates, price: cr.price }],
      replData: async () => { const g = await tabModel(to, B.ssid, replTab);
        return { students: g.students.map(s => ({ col: L(s), name: s.name, phone: s.phone })), lessons: g.lessons.map(l => ({ row: l.row, marks: Object.fromEntries(Object.entries(l.marks).filter(([, v]) => v.code).map(([k, v]) => [k, v.code])) })) }; },
      items: async () => [...state.items.values()].map(i => JSON.parse(JSON.stringify(i))),
      saveItem: async (rep, it) => { state.items.set(it.student_key, JSON.parse(JSON.stringify(it))); },
      setStatus: async (rep, s) => { state.status = s; }
    };
    const cell = async (ad, tab, keys) => ad.read(tab, keys);
    const exp1 = splitReplacement(money(L(s1)).a, money(L(s1)).r, 218), exp3 = splitReplacement(money(L(s3)).a, money(L(s3)).r, 218);

    let o = await settleReplacements({ db, run, today: '2026-10-14' });
    check(o.settled === 2 && o.errors === 0, `după prezențe: ${o.settled} elevi decontați (Prezent și Absent), Absent motivat nu: ` + JSON.stringify(o));
    const now1 = await cell(from, fromTab, rowKeys), nw = await cell(to, replTab, [c1 + '3', c1 + '4', c2 + '3', c2 + '4', c3 + '3', c3 + '4']);
    const mn = (k, col) => ({ a: Number((now1[col + '3'] || {}).v) || 0, r: Number((now1[col + '4'] || {}).v) || 0 });
    check(r2(money(L(s1)).a - mn(0, L(s1)).a) === exp1.ach && r2(money(L(s1)).r - mn(0, L(s1)).r) === exp1.red, `elevul Prezent: din registrul vechi au plecat ${exp1.ach} achitări + ${exp1.red} reduceri (o lecție = ${exp1.tot})`);
    check(Number(nw[c1 + '3'].v) === exp1.ach && Number(nw[c1 + '4'].v) === exp1.red, 'aceiași bani au ajuns în fila de înlocuire');
    check(r2(money(L(s3)).a - mn(0, L(s3)).a) === exp3.ach && Number(nw[c3 + '3'].v) === exp3.ach, 'elevul Absent (nemotivat) plătește lecția la fel');
    check(mn(0, L(s2)).a === money(L(s2)).a && mn(0, L(s2)).r === money(L(s2)).r && Number(nw[c2 + '3'].v) === 0 && Number(nw[c2 + '4'].v) === 0, 'elevul Absent motivat: nimic nu s-a mișcat, nicăieri');
    const solds = await cell(to, replTab, [c1 + '2', c1 + '5']);
    console.log(`     fila nouă, elevul Prezent: sold ${solds[c1 + '2'].v}, cost ${solds[c1 + '5'].v}`);
    const sum0 = x => r2(x.a + x.r);
    check(r2(sum0(money(L(s1))) - sum0(mn(0, L(s1))) - (Number(nw[c1 + '3'].v) + Number(nw[c1 + '4'].v))) === 0, 'banii nu s-au pierdut și nu s-au dublat: ce a plecat = ce a ajuns');

    o = await settleReplacements({ db, run, today: '2026-10-14' });
    check(o.settled === 0 && o.errors === 0, 'a doua rulare cu aceleași prezențe nu mai scrie nimic');

    // 4. the substitute changes a mark: the money goes back
    await to.write(replTab, { [c1 + markRow]: { v: 'Absent motivat' } });
    o = await settleReplacements({ db, run, today: '2026-10-14' });
    const back = await cell(from, fromTab, rowKeys), nb = await cell(to, replTab, [c1 + '3', c1 + '4']);
    check(o.reversed === 1 && Number(back[L(s1) + '3'].v) === money(L(s1)).a && Number(back[L(s1) + '4'].v) === money(L(s1)).r && Number(nb[c1 + '3'].v) === 0 && Number(nb[c1 + '4'].v) === 0, 'prezența schimbată în Absent motivat: banii s-au întors în registrul vechi, fila nouă e la 0');
    await to.write(replTab, { [c1 + markRow]: { v: 'Prezent' } });
    o = await settleReplacements({ db, run, today: '2026-10-14' });
    const again = await cell(to, replTab, [c1 + '3']);
    check(o.settled === 1 && Number(again[c1 + '3'].v) === exp1.ach, 'prezența revine: se decontează din nou, o singură dată');

    // 5. over
    o = await settleReplacements({ db, run, today: '2026-10-16' });
    const st = await cell(to, replTab, ['A3', 'AA2']);
    check(o.closed === 1 && st['A3'].v === 'Inactiv' && !st['AA2'].v, 'după ultima dată fila trece pe Inactiv și își golește orarul');
  } finally {
    // put everything back: the base register's money cells, the tab, the Total cell
    const restore = {}; rowKeys.forEach(k => { const c = keep[k]; if (c && (c.f || c.v != null)) restore[k] = c.f ? { f: c.f } : { v: c.v }; });
    await from.write(fromTab, restore);
    if (replTab) await to.remove(replTab);
    const clear = {}; totalKeys.forEach(k => { clear[k] = { v: totalBefore[k].v == null ? '' : totalBefore[k].v }; });
    await to.write('Total achitări', clear);
    const after = await to.tabs(), fa = await from.read(fromTab, rowKeys), ta = await to.read('Total achitări', totalKeys);
    check(after.length === toTabsBefore.length && rowKeys.every(k => String((fa[k] || {}).f || (fa[k] || {}).v || '') === String((keep[k] || {}).f || (keep[k] || {}).v || '')) && totalKeys.every(k => (ta[k].v || null) === (totalBefore[k].v || null)), 'totul e la loc: aceleași file, aceleași celule de bani în registrul de bază, același „Total achitări”');
  }
  console.log(`\n${ok} verificări reușite, ${bad} eșuate`);
  if (bad) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
