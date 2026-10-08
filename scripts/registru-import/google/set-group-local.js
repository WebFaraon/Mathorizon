/* Proves SET_GROUP on a REAL demo register in Google, from this computer, with the same code as the Edge Function:
   the state (A3) and the hour/cabinet (AA2:AC7) of one group are changed, the importer's parser reads them back, a command made on stale
   values is refused, and then everything is put back exactly as it was.
     node scripts/registru-import/google/set-group-local.js [t26]
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
  const { parseWorkbook, readConfig } = await import('../../../supabase/functions/_shared/registru/parse.mjs');
  const T = links.teachers[tid];
  const adapter = createAdapter(KEY, T.ssid);
  let ok = 0, bad = 0;
  const check = (c, m) => { if (c) ok++; else bad++; console.log((c ? '  ok  ' : '  !!  ') + m); };

  const d0 = await readWorkbook(KEY, T.ssid);
  const m0 = parseWorkbook(valuesBook(d0, d0.title + '.xlsx'));
  const cfg = readConfig(valuesBook(d0, d0.title + '.xlsx'));
  // a group with a regular schedule (the same hour on every day)
  const g0 = m0.groups.find(g => {
    const rows = g.schedule.filter(s => !s.stub && s.day && s.hour != null);
    return rows.length && rows.length <= 4 && new Set(rows.map(s => s.hour)).size === rows.length / new Set(rows.map(s => s.day)).size && g.state;
  });
  if (!g0) { console.log('Nu am găsit o grupă cu orar regulat.'); process.exit(1); }
  const rows0 = g0.schedule.filter(s => !s.stub && s.day && s.hour != null);
  const days = [...new Set(rows0.map(s => s.day))].sort((a, b) => a - b);
  const hours = rows0.map(s => s.hour).sort((a, b) => a - b);
  const start = hours[0], duration = hours[hours.length - 1] - start + 1;
  const cab = (rows0.find(s => s.cabinet) || {}).cabinet || '';
  console.log(`Registrul lui ${T.name}, fila „${g0.tab}”: stare „${g0.state}”, zile ${days}, ora ${start}, durata ${duration}, cabinet „${cab}”`);
  const keys = []; for (let r = 2; r <= 7; r++) ['AA', 'AB', 'AC'].forEach(c => keys.push(c + r)); keys.push('A3');
  const before = await adapter.read(g0.tab, keys);
  const norm = o => JSON.stringify(keys.map(k => [(o[k] && o[k].v) == null ? null : o[k].v, (o[k] && o[k].f) || null]));

  const otherState = (cfg.groupState || []).find(s => s !== g0.state);
  const otherCab = (cfg.cabinet || []).map(String).find(c => c !== String(cab));
  const newStart = start + duration + 1 <= 21 ? start + 1 : start - 1;
  const seen = { days, start, duration, cabinet: String(cab) };
  const cmd = (o) => Object.assign({ id: 'setgroup-test-' + Date.now() + Math.random(), type: 'SET_GROUP', tab: g0.tab }, o);
  try {
    const r = await applyAsync(adapter, cmd({ state: otherState, schedule: { days, start: newStart, duration, cabinet: otherCab || String(cab) }, expect: { state: g0.state, schedule: seen } }));
    check(r.status === 'done', 'starea și mutarea au fost scrise: ' + JSON.stringify({ s: r.status, m: r.msg, w: (r.writes || []).map(x => x.a1) }));
    const d1 = await readWorkbook(KEY, T.ssid);
    const g1 = parseWorkbook(valuesBook(d1, d1.title + '.xlsx')).groups.find(g => g.tab === g0.tab);
    const rows1 = g1.schedule.filter(s => !s.stub && s.day && s.hour != null);
    check(g1.state === otherState, 'importerul citește starea nouă: ' + g1.state);
    check(rows1.length === rows0.length && rows1.every(s => s.hour >= newStart && s.hour < newStart + duration) && rows1.every(s => String(s.cabinet || '') === (otherCab || String(cab))), 'importerul citește ora și cabinetul noi: ' + JSON.stringify(rows1.map(s => [s.day, s.hour, s.cabinet])));
    check(JSON.stringify([...new Set(rows1.map(s => s.day))].sort((a, b) => a - b)) === JSON.stringify(days), 'zilele au rămas aceleași');
    // the same command again: the sheet already has it
    const r2 = await applyAsync(adapter, cmd({ state: otherState, schedule: { days, start: newStart, duration, cabinet: otherCab || String(cab) }, expect: { state: g0.state, schedule: seen } }));
    check(r2.status === 'noop', 'aceeași comandă a doua oară: nimic de scris (' + r2.status + ')');
    // a command made on the old values, for another state: refused
    const r3 = await applyAsync(adapter, cmd({ state: g0.state, expect: { state: 'Altceva' } }));
    check(r3.status === 'conflict' && r3.code === 'stale-state', 'valori vechi: comanda e refuzată (' + r3.status + ' ' + (r3.code || '') + ')');
    const r4 = await applyAsync(adapter, cmd({ schedule: { days, start: start, duration, cabinet: String(cab) }, expect: { schedule: { days, start: 22 - duration - 1, duration, cabinet: 'x' } } }));
    check(r4.status === 'conflict' && r4.code === 'stale-schedule', 'orar văzut greșit: comanda e refuzată (' + r4.status + ' ' + (r4.code || '') + ')');
  } finally {
    // put everything back: first by the command (the way the console would undo), then cell by cell if anything differs
    const back = await applyAsync(adapter, cmd({ state: g0.state, schedule: { days, start, duration, cabinet: String(cab) } }));
    let after = await adapter.read(g0.tab, keys);
    if (norm(after) !== norm(before)) {
      const fix = {}; keys.forEach(k => { const b = before[k] || {}; fix[k] = b.f ? { f: b.f } : { v: b.v == null ? null : b.v }; });
      await adapter.write(g0.tab, fix);
      after = await adapter.read(g0.tab, keys);
    }
    check(back.status === 'done' || back.status === 'noop', 'înapoi prin comandă: ' + back.status);
    check(norm(after) === norm(before), 'fila e la loc, celulă cu celulă (A3 și AA2:AC7)');
  }
  console.log(`\n${ok} verificări reușite, ${bad} eșuate`);
  if (bad) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
