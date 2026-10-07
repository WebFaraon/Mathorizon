/* Compares what the Google Sheets formulas calculated with what the console calculates, for every built tab:
   each student's cost (row 5) and sold (row 2), each lesson's teacher pay (column C). Differences are real bugs: a wrong cell written, or a rule that differs.
     node scripts/registru-import/google/verify-registers.js [--only t26] */
'use strict';
const fs = require('fs');
const path = require('path');
const { api } = require('./auth');
const { D } = require('../demo-group');
const { colLetter } = require('../parse');

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const links = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '_import', 'demo', 'links.json'), 'utf8'));
const q = t => "'" + t.replace(/'/g, "''") + "'";
const num = x => { const n = parseFloat(String(x).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

(async () => {
  let tabs = 0, cells = 0, bad = 0; const shown = [];
  for (const tid of Object.keys(links.teachers)) {
    if (only && tid !== only) continue;
    const T = links.teachers[tid];
    const ranges = T.groups.flatMap(g => [`${q(g.tab)}!C9:C198`, `${q(g.tab)}!D2:Z2`, `${q(g.tab)}!D5:Z5`]);
    const r = await api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${T.ssid}/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&` + ranges.map(x => 'ranges=' + encodeURIComponent(x)).join('&'), { who: 'user' });
    const tot = await api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${T.ssid}/values/${encodeURIComponent("'Total achitări'!E1:E3")}?valueRenderOption=UNFORMATTED_VALUE`, { who: 'user' });
    const [due, paid, earned] = (tot.values || []).map(x => Number(x[0]));
    const book = D.teacherBook(tid);
    [['Salariu spre achitare (E1)', due, book.due], ['Suma achitată (E2)', paid, book.paid], ['Suma pentru toate lecțiile (E3)', earned, book.earned]].forEach(([lab, got, want]) => {
      cells++; if (!(Math.abs(got - want) <= 0.05)) { bad++; if (shown.length < 15) shown.push(`${T.name} / Total achitări: ${lab}: Sheets ${got}, consolă ${want}`); }
    });
    T.groups.forEach((g, i) => {
      tabs++;
      const L = D.ledger(g.id), lessons = L.lessons.filter(l => l.counted || l.topic).slice(0, 190);
      const pay = r.valueRanges[3 * i].values || [], sold = (r.valueRanges[3 * i + 1].values || [[]])[0] || [], cost = (r.valueRanges[3 * i + 2].values || [[]])[0] || [];
      const fail = (m) => { bad++; if (shown.length < 15) shown.push(`${T.name} / ${g.tab}: ${m}`); };
      lessons.forEach((l, k) => { cells++; const got = pay[k] ? Number(pay[k][0]) : 0; if (Math.abs((got || 0) - (l.counted ? l.pay : 0)) > 0.01) fail(`plata lecției ${k + 1}: Sheets ${got}, consolă ${l.pay}`); });
      L.rows.slice(0, 23).forEach((row, k) => {
        cells += 2;
        if (Math.abs(Number(cost[k] || 0) - row.cost) > 0.01) fail(`${colLetter(4 + k)}5 cost: Sheets ${cost[k]}, consolă ${row.cost}`);
        if (Math.abs(Number(sold[k] || 0) - row.sold) > 0.01) fail(`${colLetter(4 + k)}2 sold: Sheets ${sold[k]}, consolă ${row.sold}`);
      });
    });
  }
  console.log(`${tabs} file verificate, ${cells} valori comparate, ${bad} diferențe.`);
  shown.forEach(s => console.log(' - ' + s));
})().catch(e => { console.error(e.message); process.exit(1); });
