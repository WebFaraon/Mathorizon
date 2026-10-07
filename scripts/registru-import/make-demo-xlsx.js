#!/usr/bin/env node
/* Writes ONE demo group of the console as a register tab in the real layout (same cells, same formulas), so the Google Sheets
   side of the link can be seen with demo people only.
     node scripts/registru-import/make-demo-xlsx.js [groupId] [--out folder]
   The sheet computes its own cost, sold and teacher pay (formulas), exactly what the platform would read back. */
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
global.window = { addEventListener() {} };
global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } };
const root = path.join(__dirname, '..', '..', 'js', 'admin');
require(path.join(root, 'mock-data.js')); require(path.join(root, 'registru-data.js'));
const D = window.AdminData;
const { PRICES, PAY_MAX, PAY_MAX_8 } = require('./pay');

const args = process.argv.slice(2);
const outDir = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(__dirname, '..', '..', '_import', 'demo'));
const pick = args.find(a => /^g\d+$/.test(a));
const g = pick ? D.groups.find(x => x.id === pick) : D.groups.find(x => x.size === 3 && x.status === 'activ' && D.ledger(x.id).rows.length === 3 && D.ledger(x.id).lessons.length >= 6);
const L = D.ledger(g.id);
const teacher = D.teacher(g.teacher);

const col = c => { let s = ''; for (; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; };
const MARK = { P: 'PREZENT', A: 'ABSENT', M: 'Absent motivat', G: 'Prima lecție gratuită', B: 'Absent prima lecție gratuită' };
const STATUS = { activ: 'Activ', proba: 'Oră de probă', inactiv: 'Inactiv', transferat: 'Transferat' };
const STATE = { activ: 'Activ', completare: 'Se completează', inactiv: 'Inactiv', inlocuire: 'Înlocuire' };
const MONTH = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
const DAYNAME = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
const ws = {};
const put = (a, v, f) => { ws[a] = typeof v === 'number' ? { t: 'n', v } : { t: 's', v: String(v) }; if (f) ws[a].f = f; };

put('A1', g.size === 1 ? 'Individual 1 elev' : `Grup cu ${g.size} elevi`);
put('A3', STATE[g.status] || g.status);
put('A4', g.subject); put('A5', g.grade); put('A6', g.level); if (g.profile) put('A7', g.profile);
g.days.forEach((d, i) => { const r = 2 + i; put('AA' + r, DAYNAME[d - 1]); ws['AB' + r] = { t: 'n', v: g.start / 24, z: 'h:mm' }; const room = g.room ? D.room(g.room) : null; if (room) put('AC' + r, room.num); });

const level = D.tLevel(g.teacher);
const lessons = L.lessons.filter(l => l.counted || l.topic);
const first = 9, last = 198;
const students = L.rows.slice(0, 23);
const priceTxt = PRICES[g.size];
students.forEach((row, k) => {
  const c = col(4 + k), s = row.s;
  put(c + '1', `${s.name}${s.phone ? '+' + String(s.phone).replace(/^\+/, '') : ''}`);
  put(c + '2', row.sold, `${c}3+${c}4-${c}5`);
  put(c + '3', row.paid, `SUM(${row.paid})`);
  put(c + '4', row.disc || 0, `SUM(${row.disc || 0})`);
  put(c + '5', row.cost, `(COUNTIF(${c}${first}:${c}${last},"PREZENT")+COUNTIF(${c}${first}:${c}${last},"ABSENT"))*${priceTxt}`);
  if (row.manager) put(c + '7', row.manager);
  put(c + '8', STATUS[row.status] || row.status);
});
const lastCol = col(3 + students.length);
let total = 0;
lessons.forEach((l, i) => {
  const r = first + i;
  const d = new Date(l.iso + 'T00:00:00Z');
  put('A' + r, `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`);
  put('B' + r, l.topic);
  put('AA' + r, `Nivel ${level}`, undefined);
  const cap = (g.size === 8 ? PAY_MAX_8 : PAY_MAX)[level];
  const n = `(COUNTIF(D${r}:${lastCol}${r},"PREZENT")+COUNTIF(D${r}:${lastCol}${r},"ABSENT"))`;
  const factor = g.size === 3 ? `CHOOSE(MIN(${n},3),0.6863,0.8549,1)` : `${n}/${g.size}`;
  const pay = L.lessons.indexOf(l) >= 0 ? l.pay : 0;
  total += pay;
  put('C' + r, pay, `IF(${n}=0,0,${factor}*${cap})`);
  students.forEach((row, k) => { const code = row.codes[L.lessons.indexOf(l)]; if (code) put(col(4 + k) + r, MARK[code]); });
});
put('A8', 'Data'); put('B8', 'Tema'); put('C8', 'Plata profesor');
put('C' + (last + 2), total, `SUM(C${first}:C${last})`);
ws['!ref'] = `A1:AC${last + 2}`;
ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 16 }].concat(students.map(() => ({ wch: 24 })));

const tab = D.tabName(g).split(/[/:?*]/).join(' ').slice(0, 31);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, tab);
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${teacher.name} Registru EXAMEN.MD OFFLINE 2025-2026.xlsx`);
XLSX.writeFile(wb, file);
console.log(`Grupa ${g.id} (${tab}), profesor ${teacher.name}, ${students.length} elevi, ${lessons.length} lecții.\nFișier: ${file}`);
