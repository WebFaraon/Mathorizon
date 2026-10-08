#!/usr/bin/env node
/* One demo group of the console, as plain JSON, for make_demo_xlsx.py (which pours it into a copy of the real register's template tab).
     node scripts/registru-import/demo-group.js [groupId] > demo-group.json */
'use strict';
const path = require('path');
global.window = { addEventListener() {} };
global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } };
const root = path.join(__dirname, '..', '..', 'js', 'admin');
require(path.join(root, 'mock-data.js')); require(path.join(root, 'registru-data.js'));
const D = window.AdminData;

const nameLastFirst = m => { const p = m.name.split(' '); return p.length > 1 ? p.slice(1).join(' ') + ' ' + p[0] : m.name; };   // "Ariadna Pricinoc" -> "Pricinoc Ariadna", as in the register's list

function groupData(g) {
  const L = D.ledger(g.id);
  const t = D.teacher(g.teacher);
  const lessons = L.lessons.map((l, i) => ({ l, i })).filter(x => x.l.counted || x.l.topic);
  const room = g.room ? D.room(g.room) : null;
  return {
    teacher: t.name, teacherLevel: D.tLevel(g.teacher),
    group: { id: g.id, tab: D.tabName(g), duration: g.duration, regime: g.regime, size: g.size, status: g.status, subject: g.subject, grade: g.grade, level: g.level, profile: g.profile || null },
    schedule: g.days.map(d => ({ day: D.DAYS[d - 1].name, hour: g.start, room: room ? String(room.num) : null })),
    students: L.rows.slice(0, 23).map(r => ({ name: r.s.name, phone: r.s.phone, manager: r.manager ? nameLastFirst(r.manager) : null, status: r.status, paid: r.paid, disc: r.disc || 0 })),
    lessons: lessons.slice(0, 190).map(({ l, i }) => ({ iso: l.iso, topic: l.topic, marks: L.rows.slice(0, 23).map(r => r.codes[i] || '') }))
  };
}
/* every teacher that has groups, with the data of each group, in the console's own order */
function allTeachers() {
  return D.teachers.map(t => ({ id: t.id, name: t.name, groups: D.groups.filter(g => g.teacher === t.id).sort((a, b) => Math.min(...a.days) - Math.min(...b.days) || a.start - b.start || a.id.localeCompare(b.id)).map(groupData) })).filter(t => t.groups.length);
}
module.exports = { groupData, allTeachers, D };

if (require.main === module) {
  const pick = process.argv.slice(2).find(a => /^g\d+$/.test(a));
  const g = pick ? D.groups.find(x => x.id === pick) : D.groups.find(x => x.size === 3 && x.status === 'activ' && D.ledger(x.id).rows.length === 3 && D.ledger(x.id).lessons.length >= 6);
  console.log(JSON.stringify(groupData(g), null, 1));
}
