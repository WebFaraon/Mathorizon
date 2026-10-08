/* Proves SET_AVAILABILITY on a REAL demo register in Google, from this computer, with the same code as the Edge Function:
   one hour is made available in the "Disponibilitate" tab, the importer's parser reads it back, a command on a stale value is refused,
   and then the cell is put back exactly as it was.
     node scripts/registru-import/google/set-availability-local.js [t26]
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
  const { applyAsync } = await import('../../../supabase/functions/_shared/registru/apply.mjs');
  const { valuesBook } = await import('../../../supabase/functions/_shared/registru/sync-core.mjs');
  const { parseWorkbook } = await import('../../../supabase/functions/_shared/registru/parse.mjs');
  const T = links.teachers[tid];
  const adapter = createAdapter(KEY, T.ssid);
  let ok = 0, bad = 0;
  const check = (c, m) => { if (c) ok++; else bad++; console.log((c ? '  ok  ' : '  !!  ') + m); };
  const parse = async () => { const d = await readWorkbook(KEY, T.ssid); return parseWorkbook(valuesBook(d, d.title + '.xlsx')); };

  const m0 = await parse();
  const slots0 = m0.availability.slots;
  // a free hour: the first (day, hour) of the grid that is not available
  let free = null;
  for (let d = 1; d <= 7 && !free; d++) for (const h of m0.availability.hours) if (!(slots0[d] || []).includes(h)) { free = { day: d, hour: h }; break; }
  if (!free) { console.log('Nu am găsit o oră liberă în disponibilitate.'); process.exit(1); }
  const col = String.fromCharCode(65 + free.day), row = 2 + (m0.availability.hours.indexOf(free.hour));
  const a1 = col + row;
  console.log(`Registrul lui ${T.name}: ora ${free.hour}:00 din ziua ${free.day} (${a1}) nu e disponibilă`);
  const before = (await adapter.read('Disponibilitate', [a1]))[a1];
  const cmd = (changes) => ({ id: 'setavail-test-' + Date.now() + Math.random(), type: 'SET_AVAILABILITY', tab: 'Disponibilitate', changes });
  try {
    const r = await applyAsync(adapter, cmd([{ day: free.day, hour: free.hour, to: true, was: false }]));
    check(r.status === 'done' && r.writes.length === 1, 'ora a fost făcută disponibilă: ' + JSON.stringify({ s: r.status, m: r.msg }));
    const m1 = await parse();
    check((m1.availability.slots[free.day] || []).includes(free.hour), 'importerul citește ora ca disponibilă');
    check(JSON.stringify(Object.keys(m1.availability.slots).map(d => (m1.availability.slots[d] || []).length)) !== JSON.stringify(Object.keys(slots0).map(d => (slots0[d] || []).length)), 'numărul de ore disponibile s-a schimbat');
    const r2 = await applyAsync(adapter, cmd([{ day: free.day, hour: free.hour, to: true, was: false }]));
    check(r2.status === 'noop', 'aceeași comandă a doua oară: nimic de scris (' + r2.status + ')');
    const r3 = await applyAsync(adapter, cmd([{ day: free.day, hour: free.hour, to: false, was: false }]));
    check(r3.status === 'conflict' && r3.code === 'stale-availability', 'valoare veche: comanda e refuzată (' + r3.status + ' ' + (r3.code || '') + ')');
  } finally {
    const back = await applyAsync(adapter, cmd([{ day: free.day, hour: free.hour, to: false }]));
    const after = (await adapter.read('Disponibilitate', [a1]))[a1];
    check((after.v == null) === (before.v == null) && (after.v || null) === (before.v || null), 'celula e la loc: ' + JSON.stringify(after) + ' (comanda de întoarcere: ' + back.status + ')');
  }
  console.log(`\n${ok} verificări reușite, ${bad} eșuate`);
  if (bad) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
