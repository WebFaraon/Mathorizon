#!/usr/bin/env node
/* Reads a teacher's register and writes what it understood and what needs a person.
     node scripts/registru-import/run.js "<registru.xlsx>" [--out _import/out]
   Writes next to --out:  <name>.model.json (the clean data, with names and phones: keep it out of git),
                          <name>.report.md (for people) and <name>.report.json. Nothing is changed in the register. */
'use strict';
const fs = require('fs');
const path = require('path');
const { readXlsx } = require('./read-xlsx');
const { parseWorkbook } = require('./parse');
const { linkPeople } = require('./link');
const { validate, summarize } = require('./validate');

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const outDir = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(__dirname, '..', '..', '_import', 'out'));
if (!file) { console.error('Folosire: node scripts/registru-import/run.js "<registru.xlsx>" [--out folder]'); process.exit(1); }

const book = readXlsx(file);
const model = parseWorkbook(book);
const linked = linkPeople(model);
const issues = validate(model, linked);
const summary = summarize(model, linked, issues);

/* the report for people */
const LEVELS = { error: 'De reparat', warn: 'De verificat', info: 'Curățat sau presupus de importator' };
const TITLE = {
  'no-config': 'Lipsește CONFIGURARI', 'no-year': 'Anul școlar nu se știe', 'year-inferred': 'Anul datelor a fost presupus', 'no-total': 'Lipsește Total achitări', 'no-availability': 'Lipsește Disponibilitate',
  'not-in-total': 'Grupe care nu intră în „Total achitări”', 'total-unknown-tab': '„Total achitări” citește file care nu există', 'payment-sum': 'Plăți către profesor fără sumă', 'payment-date': 'Plăți către profesor cu data scrisă ca text',
  'paid-total': 'Suma achitată nu se potrivește', 'earned-total': 'Suma pentru lecții nu se potrivește',
  format: 'Format de grupă invalid', state: 'Starea grupei', subject: 'Materia', grade: 'Clasa', level: 'Nivel nealeș', profile: 'Liceu fără profil', 'profile-extra': 'Profil la o clasă fără profil', note: 'Alte note', 'tab-vs-state': 'Numele filei nu se potrivește cu starea grupei',
  schedule: 'Orar', cabinet: 'Cabinet', 'outside-availability': 'Orar în afara disponibilității', 'not-in-teaches': 'Materie sau clasă nebifată la „Detalii profesor”',
  'over-size': 'Prea mulți elevi pentru formatul grupei', 'state-vs-students': 'Starea grupei nu se potrivește cu elevii', phone: 'Telefoane lipsă sau neînțelese', 'phone-cleaned': 'Telefoane aduse la forma +373XXXXXXXX', name: 'Nume neobișnuite', manager: 'Manager', status: 'Statut de elev',
  money: 'Sume care nu sunt numere', cost: 'Cost diferit de calcul', sold: 'Sold diferit de calcul', 'trial-too-long': 'Oră de probă care a trecut de prima lecție', 'active-no-marks': 'Elev activ fără nicio prezență',
  date: 'Date care nu se înțeleg', 'date-order': 'Date în ordine greșită', weekday: 'Lecții în alte zile decât orarul', mark: 'Prezențe necunoscute', 'unpaid-lesson': 'Lecții cu prezențe, dar neplătite (fără dată sau temă)', 'teacher-level': 'Nivelul profesorului pe lecții',
  'over-paying': 'Mai mulți elevi taxați decât locuri', pay: 'Plata lecției diferă de calcul', 'orphan-marks': 'Prezențe fără elev', 'double-booked': 'Profesorul are două grupe în același timp', 'room-clash': 'Cabinet ocupat de două grupe',
  siblings: 'Același telefon, nume diferite', duplicate: 'Același nume, telefoane diferite', 'name-only': 'Elevi legați doar după nume', 'two-active': 'Elev Activ în mai multe grupe', 'moved-nowhere': 'Transferat fără grupă nouă în registru'
};
const where = i => [i.tab ? `„${i.tab}”` : null, i.cell].filter(Boolean).join(' ');
let md = `# Raport de import: ${summary.file}\n\n`;
md += `Profesor: **${summary.teacher || '?'}** · proiect: **${summary.project || '?'}** · an școlar: **${summary.year || '?'}**\n\n`;
md += `## Ce am citit\n\n`;
md += `- ${summary.sheets} file, din care ${summary.groups} grupe (${summary.skipped.length ? 'sărite: ' + summary.skipped.join(', ') : 'nicio filă sărită'})\n`;
md += `- ${summary.studentColumns} coloane de elevi, care sunt ${summary.people} persoane diferite (același copil poate fi în mai multe grupe)\n`;
md += `- ${summary.lessons} lecții, ${summary.marks} prezențe, ${summary.payments} plăți către profesor\n`;
md += `- Stări de grupă: ${Object.entries(summary.groupStates).map(([k, v]) => `${k} ${v}`).join(', ')}\n`;
md += `- Statute de elevi: ${Object.entries(summary.studentStatuses).map(([k, v]) => `${k} ${v}`).join(', ')}\n\n`;
md += `## Rezumat\n\n| | |\n|---|---|\n| De reparat | ${summary.issues.error || 0} |\n| De verificat | ${summary.issues.warn || 0} |\n| Curățat sau presupus | ${summary.issues.info || 0} |\n\n`;
['error', 'warn', 'info'].forEach(level => {
  const list = issues.filter(i => i.level === level);
  if (!list.length) return;
  md += `## ${LEVELS[level]} (${list.length})\n\n`;
  const codes = [...new Set(list.map(i => i.code))];
  codes.forEach(code => {
    const items = list.filter(i => i.code === code);
    md += `### ${TITLE[code] || code} (${items.length})\n\n`;
    items.slice(0, level === 'info' ? 6 : 12).forEach(i => { md += `- ${where(i) ? where(i) + ': ' : ''}${i.msg}\n`; });
    if (items.length > (level === 'info' ? 6 : 12)) md += `- … și încă ${items.length - (level === 'info' ? 6 : 12)}\n`;
    md += '\n';
  });
});

/* what goes to the platform: no cached money, the model keeps the sheet's own figures next to ours */
const slim = {
  meta: model.meta, config: model.config, availability: model.availability, availabilitySummer: model.availabilitySummer,
  total: model.total,
  groups: model.groups.map(g => Object.assign({}, g, { students: g.students.map(s => { const c = Object.assign({}, s); delete c.person; return c; }) })),
  people: linked.people.map(p => ({ id: p.id, name: p.name, phone: p.phone, viaNameOnly: p.viaNameOnly, enrollments: p.enrollments.map(e => ({ tab: e.tab, col: e.colLetter, status: e.status, manager: e.manager, paid: e.paid, discount: e.discount, charged: e.marks.charged, lessons: e.marks.total, firstLesson: e.marks.firstIso, lastLesson: e.marks.lastIso })) })),
  issues
};
fs.mkdirSync(outDir, { recursive: true });
const base = path.join(outDir, path.basename(file).replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_'));
fs.writeFileSync(base + '.model.json', JSON.stringify(slim, null, 1));
fs.writeFileSync(base + '.report.md', md);
fs.writeFileSync(base + '.report.json', JSON.stringify({ summary, issues }, null, 1));
console.log(`${summary.groups} grupe, ${summary.studentColumns} coloane de elevi (${summary.people} persoane), ${summary.lessons} lecții, ${summary.marks} prezențe.`);
console.log(`De reparat: ${summary.issues.error || 0} · de verificat: ${summary.issues.warn || 0} · curățat/presupus: ${summary.issues.info || 0}`);
console.log('Raport: ' + base + '.report.md');
