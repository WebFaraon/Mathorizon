/* Rewrites, in the demo registers that already exist, the schedule rows (AA2:AC7: one row per hour, as the real registers have them)
   and the subject of the summer groups ("Matematica (Vara)"). Nothing else is touched: no tab is created, renamed or moved.
     node scripts/registru-import/google/fix-schedules.js [--only t26] */
'use strict';
const fs = require('fs');
const path = require('path');
const { api } = require('./auth');
const { allTeachers } = require('../demo-group');

const links = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '_import', 'demo', 'links.json'), 'utf8'));
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const q = t => "'" + t.replace(/'/g, "''") + "'";
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets/';

(async () => {
  const cabinets = new Set((await api('GET', `${SHEETS}${links.template}/values/CONFIGURARI!K2:K200`, { who: 'user' })).values.map(x => x[0]));
  for (const t of allTeachers().filter(x => !only || x.id === only)) {
    const L = links.teachers[t.id];
    if (!L) continue;
    const data = [];
    t.groups.forEach((d, i) => {
      const tab = L.groups[i].tab, g = d.group;
      if (L.groups[i].id !== g.id) throw new Error('Ordinea grupelor nu se potrivește: ' + t.name);
      const rows = [];
      d.schedule.forEach(s => { for (let h = 0; h < (g.duration || 1); h++) rows.push([s.day, (s.hour + h) / 24, s.room && cabinets.has(s.room) ? s.room : '']); });
      while (rows.length < 6) rows.push(['', '', '']);
      data.push({ range: `${q(tab)}!AA2:AC7`, values: rows.slice(0, 6) });
      data.push({ range: `${q(tab)}!A4`, values: [[g.subject + (g.regime === 'vara' ? ' (Vara)' : '')]] });
    });
    await api('POST', `${SHEETS}${L.ssid}/values:batchUpdate`, { who: 'user', body: { valueInputOption: 'RAW', data } });
    console.log(`${t.name}: ${t.groups.length} grupe`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
