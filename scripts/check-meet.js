/* Checks of the teacher's Google Meet link: what is accepted from the register cell, what is refused, and that it is read from the "Disponibilitate" tab.
   Run: npm run check:meet */
'use strict';
const path = require('path');
const R = path.join(__dirname, 'registru-import');
const { MemoryBook } = require(path.join(R, 'sync', 'memory-book'));
const { parseWorkbook } = require(path.join(R, 'parse'));

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; if (fails.length < 25) fails.push(m); } };

(async () => {
  const { normalizeMeet } = await import('../supabase/functions/_shared/registru/meet.mjs');

  const good = [
    ['https://meet.google.com/abc-defg-hij', 'https://meet.google.com/abc-defg-hij'],
    ['meet.google.com/abc-defg-hij', 'https://meet.google.com/abc-defg-hij'],
    ['  https://meet.google.com/ABC-DEFG-HIJ?authuser=0&hs=179#x ', 'https://meet.google.com/abc-defg-hij'],
    ['http://meet.google.com/abc-defg-hij/', 'https://meet.google.com/abc-defg-hij'],
    ['https://meet.google.com/lookup/abcd1234', 'https://meet.google.com/lookup/abcd1234'],
    ['https://meet.google.com/meet/zsv-nmei-szr', 'https://meet.google.com/meet/zsv-nmei-szr'],
    ['meet.google.com/meet/ZSV-NMEI-SZR?authuser=1', 'https://meet.google.com/meet/zsv-nmei-szr'],
    ['https://meet.google.com/matematica-ana', 'https://meet.google.com/matematica-ana'],
    ['https://MEET.GOOGLE.COM/abc-defg-hij', 'https://meet.google.com/abc-defg-hij'],
    ['https://meet.google.com/abc-defg-hij \n', 'https://meet.google.com/abc-defg-hij']
  ];
  good.forEach(([raw, want]) => { const r = normalizeMeet(raw); ok(r.url === want && r.why === null, `accepted: ${JSON.stringify(raw)} -> ${JSON.stringify(r)}`); });

  const bad = [
    ['', 'missing'], ['   ', 'missing'], [null, 'missing'], [undefined, 'missing'],
    ['https://meet.google.com/new', 'new'], ['meet.google.com/new', 'new'], ['https://meet.google.com/', 'invalid'], ['https://meet.google.com', 'invalid'],
    ['https://meet.google.com/landing', 'invalid'],
    ['https://evil.example.com/abc-defg-hij', 'invalid'], ['https://meet.google.com.evil.example/abc-defg-hij', 'invalid'],
    ['https://zoom.us/j/123456789', 'invalid'], ['javascript:alert(1)', 'invalid'], ['https://user:pw@meet.google.com/abc-defg-hij', 'invalid'],
    ['https://meet.google.com:8443/abc-defg-hij', 'invalid'], ['ftp://meet.google.com/abc-defg-hij', 'invalid'],
    ['abc-defg-hij', 'invalid'], ['link-ul il trimit mai tarziu', 'invalid'], ['https://meet.google.com/a', 'invalid'],
    ['https://meet.google.com/abc/defg/hij', 'invalid'], ['https://meet.google.com/meet/', 'invalid'], ['https://meet.google.com/meet/altceva', 'invalid'], ['https://meet.google.com/meet/abc/defg', 'invalid'], ['https://meet.google.com/lookup/', 'invalid'], ['https://meet.google.com/<script>', 'invalid']
  ];
  bad.forEach(([raw, why]) => { const r = normalizeMeet(raw); ok(r.url === null && r.why === why, `refused (${why}): ${JSON.stringify(raw)} -> ${JSON.stringify(r)}`); });

  // read from the tab: the row is found by its label, the link is in D..H
  const grid = (extra, row) => {
    const cells = { A1: { v: 'Orar' }, B1: { v: 'Luni' }, A2: { v: 0.375 }, B2: { v: 'Disponibil' }, ['A' + (row || 16)]: { v: 'Link Google Meet' } };
    return new MemoryBook({ Disponibilitate: { cells: Object.assign(cells, extra) }, CONFIGURARI: { hidden: true, cells: { A1: { v: 'Manager' }, A2: { v: 'X Y' } } } }, 'Test Registru EXAMEN.MD OFFLINE 2025-2026.xlsx');
  };
  const meetOf = b => (parseWorkbook(b).availability || {}).meet;
  let m = meetOf(grid({ D16: { v: 'https://meet.google.com/abc-defg-hij' } }));
  ok(m && m.url === 'https://meet.google.com/abc-defg-hij', 'D16 is read: ' + JSON.stringify(m));
  m = meetOf(grid({ E16: { v: 'meet.google.com/abc-defg-hij' } }));
  ok(m && m.url === 'https://meet.google.com/abc-defg-hij', 'the first filled cell of D16:H16 counts (here E16): ' + JSON.stringify(m));
  m = meetOf(grid({ D17: { v: 'https://meet.google.com/abc-defg-hij' } }, 17));
  ok(m && m.url === 'https://meet.google.com/abc-defg-hij', 'the row is found by its label (one row lower): ' + JSON.stringify(m));
  m = meetOf(grid({}));
  ok(m && m.url === null && m.why === 'missing', 'an empty box is "missing": ' + JSON.stringify(m));
  m = meetOf(grid({ D16: { v: 'https://zoom.us/j/1' } }));
  ok(m && m.url === null && m.why === 'invalid' && m.raw === 'https://zoom.us/j/1', 'a foreign address is refused and kept as typed for the console: ' + JSON.stringify(m));
  m = meetOf(grid({ A16: { v: 'Link Google Meet' }, B16: { v: 'ceva' } }));
  ok(m && m.url === null, 'text in B16 (the label area) is not a link');

  // what reaches the database
  const { workbookData } = await import('../supabase/functions/_shared/registru/sync-core.mjs');
  const w = workbookData(parseWorkbook(grid({ D16: { v: 'meet.google.com/abc-defg-hij' } })));
  ok(w.teacher.meet && w.teacher.meet.url === 'https://meet.google.com/abc-defg-hij' && w.teacher.meet.raw === undefined, 'teacher_data.meet carries the clean url: ' + JSON.stringify(w.teacher.meet));
  const w2 = workbookData(parseWorkbook(grid({ D16: { v: 'altceva' } })));
  ok(w2.teacher.meet && w2.teacher.meet.url === null && w2.teacher.meet.why === 'invalid', 'teacher_data.meet says why there is none: ' + JSON.stringify(w2.teacher.meet));

  console.log(`MEET: ${pass} checks passed, ${fail} failed`);
  if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();
