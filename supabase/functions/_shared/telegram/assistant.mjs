/* The teacher's assistant: what the bot answers when the teacher asks (today, tomorrow, the week, the groups, the pay, the numbers, the replacements, the Meet link,
   the rules). Pure functions: they get the teacher's data (a "view", see below) and the time, and give back the text of the message (Telegram HTML) and its buttons.
   No database, no network: scripts/check-telegram.js tests every message. The data is read by supabase/functions/telegram-bot/index.ts (db.teacherView).

   view = {
     workbooks:    [{ id, teacher_name, teacher_data, last_synced_at }]            the registers tied to the teacher's account
     groups:       [{ id, workbook_id, sheet_id, tab, format_size, state, subject, grade, level, profile, schedule, mode }]
     students:     [{ group_id, name, status }]
     lessons:      [{ group_id, iso, topic, marks }]                                marks: { column letter: code }
     replacements: [{ id, status, orig_workbook, orig_sheet, repl_workbook, repl_sheet, dates: [{ iso, start, duration, cabinet, cancelled }],
                      orig: { subject, grade } | null, origTeacher, replTeacher }]
   } */
import { START_MIN } from '../registru/start-rule.mjs';

export const TZ = 'Europe/Chisinau';
export const DAYS = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];
const DAY_SHORT = ['lu', 'ma', 'mi', 'jo', 'vi', 'sâ', 'du'];
const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

export const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pad = n => String(n).padStart(2, '0');
const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const nf = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = n => nf.format(Math.round((Number(n) || 0) * 100) / 100) + ' lei';
const hh = h => `${pad(h)}:00`;

export const gradeText = g => { const n = ROMAN[String(g == null ? '' : g).trim().toUpperCase()]; return n ? `clasa a ${n}-a` : (g ? `clasa ${g}` : ''); };
const groupName = g => [esc(g.subject || 'Grupă'), esc(gradeText(g.grade))].filter(Boolean).join(', ');

/* ---------- the clock of Chisinau ---------- */
export function localNow(date) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date).forEach(x => { p[x.type] = x.value; });
  const iso = `${p.year}-${p.month}-${p.day}`;
  return { iso, dow: dowOf(iso), minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
export function addDays(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function dowOf(iso) { const d = new Date(iso + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; }
const dateText = iso => `${DAYS[dowOf(iso) - 1]}, ${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const diffDays = (a, b) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 864e5);
export function dayName(iso, todayIso) {
  const d = diffDays(iso, todayIso);
  return d === 0 ? `azi, ${dateText(iso)}` : d === 1 ? `mâine, ${dateText(iso)}` : dateText(iso);
}

/* ---------- schedules ---------- */

/* "luni și joi, 12:00 - 13:00": the days of the group and the hours of its lesson, from the schedule rows (one per hour) */
export function whenText(schedule) {
  const byDay = new Map();
  (Array.isArray(schedule) ? schedule : []).forEach(r => {
    const d = Number(r && r.day), h = Number(r && r.hour);
    if (!(d >= 1 && d <= 7) || !Number.isFinite(h)) return;
    const x = byDay.get(d) || { h0: h, n: 0 };
    x.h0 = Math.min(x.h0, h); x.n++;
    byDay.set(d, x);
  });
  if (!byDay.size) return '';
  const days = [...byDay.keys()].sort((a, b) => a - b), first = byDay.get(days[0]);
  const names = days.map(d => DAYS[d - 1]);
  const dayText = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' și ' + names[names.length - 1];
  return `${dayText}, ${pad(first.h0)}:00 - ${pad(first.h0 + first.n)}:00`;
}

/* the lessons of a group on each day: [{ day, start, end, cabinet }] (consecutive hours of a day are one lesson) */
export function slotsOf(schedule) {
  const rows = (Array.isArray(schedule) ? schedule : []).map(r => ({ day: Number(r && r.day), hour: Number(r && r.hour), cabinet: r && r.cabinet ? String(r.cabinet) : '' }))
    .filter(r => r.day >= 1 && r.day <= 7 && Number.isFinite(r.hour)).sort((a, b) => a.day - b.day || a.hour - b.hour);
  const out = [];
  rows.forEach(r => {
    const l = out[out.length - 1];
    if (l && l.day === r.day && l.end === r.hour) { l.end = r.hour + 1; if (!l.cabinet) l.cabinet = r.cabinet; }
    else out.push({ day: r.day, start: r.hour, end: r.hour + 1, cabinet: r.cabinet });
  });
  return out;
}

/* ---------- groups and students ---------- */
const COUNTED = new Set(['activ', 'ora de proba', 'ora de proba confirmata']);
export const isCounted = s => COUNTED.has(plain(s));
export const stateKey = s => { const p = plain(s); return p === 'activ' ? 'activ' : p === 'starteaza' ? 'starteaza' : p === 'se completeaza' ? 'completare' : p === 'inactiv' ? 'inactiv' : p === 'inlocuire' ? 'inlocuire' : 'altele'; };
const STATE_ICON = { activ: '🟢', starteaza: '🚀', completare: '🟠', inactiv: '⚪', inlocuire: '🔄', altele: '▫️' };
const STATE_NAME = { activ: 'Activă', starteaza: 'Pornește', completare: 'Se completează', inactiv: 'Inactivă', inlocuire: 'Înlocuire', altele: '' };

function studentsOf(view, g) { return (view.students || []).filter(s => s.group_id === g.id); }
function studentsLine(view, g) {
  const list = studentsOf(view, g).filter(s => isCounted(s.status));
  if (!list.length) return 'niciun elev înscris';
  const trial = list.filter(s => plain(s.status) !== 'activ').length;
  return `${plural(list.length, 'elev', 'elevi')}${trial ? ` (${trial} la ora de probă)` : ''}`;
}
const meetOf = (view, g) => {
  if (plain(g.mode) !== 'online') return '';
  const w = (view.workbooks || []).find(x => x.id === g.workbook_id), m = w && w.teacher_data && w.teacher_data.meet;
  const url = typeof m === 'string' ? m : (m && (m.url || m.link)) || '';
  return /^https:\/\/meet\.google\.com\//.test(url) ? url : '';
};
function placeText(view, g, slot) {
  if (plain(g.mode) === 'online') { const u = meetOf(view, g); return u ? `💻 Online · <a href="${esc(u)}">Intră în Meet</a>` : '💻 Online · fără link Meet în registru'; }
  return slot && slot.cabinet ? `📍 Cabinet ${esc(slot.cabinet)}` : '📍 Fără cabinet stabilit';
}

/* done lessons: a row with a date, a topic and at least one attendance mark (the same rule as the Conturi page of the console) */
function doneLessons(view, groupIds) {
  const ids = groupIds ? new Set(groupIds) : null;
  return (view.lessons || []).filter(l => (!ids || ids.has(l.group_id)) && l.iso && String(l.topic || '').trim() && Object.values(l.marks || {}).some(Boolean));
}

/* ---------- what happens on a day ---------- */

/* { teach: [item], away: [item], waiting: [group] } for one date. item = { start, end, group, slot, kind: 'own' | 'sub', by? } */
export function dayItems(view, iso) {
  const dow = dowOf(iso), W = new Set((view.workbooks || []).map(w => w.id));
  const reps = (view.replacements || []).filter(r => r.status === 'active');
  const awayKey = new Map();
  reps.forEach(r => { if (!W.has(r.orig_workbook)) return; (r.dates || []).forEach(d => { if (!d.cancelled && d.iso === iso) awayKey.set(`${r.orig_workbook}|${r.orig_sheet}|${d.start}`, r); }); });
  const out = { teach: [], away: [], waiting: [] };
  (view.groups || []).forEach(g => {
    const k = stateKey(g.state);
    slotsOf(g.schedule).filter(s => s.day === dow).forEach(slot => {
      if (k === 'completare') { out.waiting.push(g); return; }
      if (k !== 'activ' && k !== 'starteaza') return;
      const rep = awayKey.get(`${g.workbook_id}|${g.sheet_id}|${slot.start}`);
      const item = { start: slot.start, end: slot.end, group: g, slot, kind: 'own' };
      if (rep) out.away.push(Object.assign(item, { by: rep.replTeacher || '' })); else out.teach.push(item);
    });
  });
  reps.forEach(r => {
    if (!W.has(r.repl_workbook)) return;
    (r.dates || []).forEach(d => {
      if (d.cancelled || d.iso !== iso) return;
      const tab = (view.groups || []).find(g => g.workbook_id === r.repl_workbook && String(g.sheet_id) === String(r.repl_sheet));
      const base = r.orig || {};
      const group = Object.assign({}, tab || {}, { subject: base.subject || (tab && tab.subject), grade: base.grade || (tab && tab.grade), mode: (tab && tab.mode) || base.mode });
      out.teach.push({ start: d.start, end: d.start + (d.duration || 1), group, slot: { cabinet: d.cabinet ? String(d.cabinet) : '' }, kind: 'sub', from: r.origTeacher || '' });
    });
  });
  out.teach.sort((a, b) => a.start - b.start);
  out.away.sort((a, b) => a.start - b.start);
  return out;
}

/* a quote block (the indented block with a bar) groups the lines of one lesson, one group, one replacement */
const quote = lines => `<blockquote>${Array.isArray(lines) ? lines.join('\n') : lines}</blockquote>`;
/* a table in a fixed-width block: labels on the left, values aligned on the right (the only way to line numbers up in a chat) */
function table(rows, gap = 3) {
  const a = Math.max(...rows.map(r => r[0].length)), b = Math.max(...rows.map(r => r[1].length));
  return '<pre>' + rows.map(([x, y]) => esc(x.padEnd(a + gap) + y.padStart(b))).join('\n') + '</pre>';
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function itemText(view, it) {
  const g = it.group;
  const lines = [`<b>${hh(it.start)} – ${hh(it.end)}</b> · ${groupName(g)}`, `${placeText(view, g, it.slot)}${g.level ? ` · nivel ${esc(g.level)}` : ''}`, `👥 ${studentsLine(view, g.id ? g : {})}`];
  if (it.kind === 'sub') lines.push(`🔄 Înlocuiești${it.from ? ' grupa lui ' + esc(it.from) : ' o grupă'}`);
  if (stateKey(g.state) === 'starteaza' && it.kind === 'own') lines.push('🚀 Lecția de probă a unei grupe noi');
  return quote(lines);
}

/* the next lesson from now on: { iso, item } or null (looks 21 days ahead) */
export function nextLesson(view, now) {
  const t = localNow(now);
  for (let i = 0; i <= 21; i++) {
    const iso = addDays(t.iso, i);
    const left = dayItems(view, iso).teach.filter(it => i > 0 || it.start * 60 > t.minutes);
    if (left.length) return { iso, item: left[0] };
  }
  return null;
}

export const NO_REGISTER = 'Contul tău nu are încă un registru legat. Cere administratorului să-l lege.';
export const hasRegister = view => !!(view && view.workbooks && view.workbooks.length);

export function dayText(view, now, offset) {
  const t = localNow(now), iso = addDays(t.iso, offset), label = dayName(iso, t.iso);
  const { teach, away, waiting } = dayItems(view, iso);
  const head = `📅 <b>${esc(cap(label))}</b>`;
  const parts = [teach.length ? `${head} · ${plural(teach.length, 'lecție', 'lecții')}\n\n` + teach.map(it => itemText(view, it)).join('\n\n') : `${head}\n\n🌿 Nicio lecție.`];
  if (away.length) parts.push('🔄 <b>Înlocuite</b>\n' + quote(away.map(it => `${hh(it.start)} · ${groupName(it.group)}${it.by ? ` · de către ${esc(it.by)}` : ''}`)));
  if (waiting.length) parts.push('⏳ <i>Se completează, fără lecții încă:</i> ' + waiting.map(g => `${groupName(g)} (${hh(slotsOf(g.schedule).find(s => s.day === dowOf(iso)).start)})`).join(', '));
  if (!teach.length) {
    const n = nextLesson(view, now);
    if (n && n.iso !== iso) parts.push(`➡️ Următoarea lecție: <b>${esc(dayName(n.iso, t.iso))} · ${hh(n.item.start)}</b>\n${groupName(n.item.group)}`);
  }
  return parts.join('\n\n');
}

export function weekText(view, now) {
  const t = localNow(now), blocks = [];
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const iso = addDays(t.iso, i), { teach, away } = dayItems(view, iso);
    total += teach.length;
    if (!teach.length && !away.length) continue;
    const lines = teach.map(it => `${hh(it.start)}–${hh(it.end)} · ${groupName(it.group)} · ${plain(it.group.mode) === 'online' ? 'Online' : it.slot.cabinet ? 'cab. ' + esc(it.slot.cabinet) : 'fără cabinet'}${it.kind === 'sub' ? ' · înlocuire' : ''}`)
      .concat(away.map(it => `<s>${hh(it.start)} · ${groupName(it.group)}</s> · înlocuită${it.by ? ' de ' + esc(it.by) : ''}`));
    blocks.push(`<b>${esc(cap(dayName(iso, t.iso)))}</b>\n${quote(lines)}`);
  }
  if (!blocks.length) return '📆 <b>Următoarele 7 zile</b>\n\n🌿 Nicio lecție programată.';
  return `📆 <b>Următoarele 7 zile</b> · ${plural(total, 'lecție', 'lecții')}\n\n` + blocks.join('\n\n');
}

/* ---------- the groups ---------- */
const STATE_ORDER = ['activ', 'starteaza', 'completare', 'inactiv'];
const realGroups = view => (view.groups || []).filter(g => stateKey(g.state) !== 'inlocuire');

function startNote(view, g) {
  const need = START_MIN[g.format_size];
  if (stateKey(g.state) === 'completare' && need) {
    const enrolled = studentsOf(view, g).filter(s => isCounted(s.status)).length;
    return enrolled >= need ? 'are destui elevi: pornește singură în curând' : `mai trebuie ${plural(need - enrolled, 'elev', 'elevi')} ca să pornească (minimul e ${need} din ${g.format_size})`;
  }
  return '';
}

const seats = (view, g) => {
  const list = studentsOf(view, g).filter(s => isCounted(s.status)), trial = list.filter(s => plain(s.status) !== 'activ').length;
  return `${list.length}${g.format_size ? '/' + g.format_size : ''} ${list.length === 1 ? 'elev' : 'elevi'}${trial ? ` · ${trial} la probă` : ''}`;
};
export function groupsText(view) {
  const gs = realGroups(view);
  if (!gs.length) return '👥 <b>Grupele tale</b>\n\nNu am găsit nicio grupă în registrul tău.';
  const out = [`👥 <b>Grupele tale</b> · ${gs.length}`];
  STATE_ORDER.forEach(k => {
    const list = gs.filter(g => stateKey(g.state) === k);
    if (!list.length) return;
    if (k === 'inactiv') { out.push(`${STATE_ICON[k]} <b>Inactive</b> · ${list.length}`); return; }
    out.push(`${STATE_ICON[k]} <b>${k === 'activ' ? 'Active' : k === 'starteaza' ? 'Pornesc' : 'Se completează'}</b> · ${list.length}\n` + quote(list.map(g => {
      const note = startNote(view, g);
      return `<b>${groupName(g)}</b>\n${esc(whenText(g.schedule) || 'fără program')} · ${esc(seats(view, g))}${note ? `\n↳ ${esc(note)}` : ''}`;
    }).join('\n\n')));
  });
  return out.join('\n\n');
}
export function groupsKeyboard(view) {
  const gs = realGroups(view).filter(g => stateKey(g.state) !== 'inactiv').slice(0, 24);
  return { inline_keyboard: gs.map(g => { const s = slotsOf(g.schedule)[0]; return [{ text: `${STATE_ICON[stateKey(g.state)]} ${g.subject || 'Grupă'} ${g.grade || ''}${s ? ` · ${DAY_SHORT[s.day - 1]} ${hh(s.start)}` : ''}`.replace(/\s+/g, ' '), callback_data: 'g:' + g.id }]; }) };
}

export function groupCard(view, id, now) {
  const g = realGroups(view).find(x => x.id === id);
  if (!g) return null;
  const k = stateKey(g.state), t = localNow(now), students = studentsOf(view, g), counted = students.filter(s => isCounted(s.status));
  const slots = slotsOf(g.schedule);
  const meta = [STATE_NAME[k] || esc(g.state || ''), g.level ? `nivel ${esc(g.level)}` : '', g.profile ? `profil ${esc(String(g.profile).toLowerCase())}` : ''].filter(Boolean).join(' · ');
  const lines = [`📚 <b>${groupName(g)}</b>`, `${STATE_ICON[k]} ${meta}`];
  const note = startNote(view, g);
  if (note) lines.push(`⏳ ${esc(note)}`);
  if (k === 'starteaza') lines.push('🚀 Urmează lecția de probă; managerul sună elevii');
  lines.push('', quote([`🗓 ${esc(whenText(g.schedule) || 'fără program în registru')}`, placeText(view, g, slots[0]), `👥 ${counted.length} ${counted.length === 1 ? 'loc ocupat' : 'locuri ocupate'}${g.format_size ? ` din ${g.format_size}` : ''}`]));
  if (counted.length) {
    lines.push('', '<b>Elevii</b>', quote(counted.map((s, i) => `${i + 1}. ${esc(s.name || 'fără nume')} · ${esc(plain(s.status) === 'activ' ? 'activ' : 'oră de probă' + (plain(s.status) === 'ora de proba confirmata' ? ' confirmată' : ''))}`)));
  }
  const other = students.length - counted.length;
  if (other > 0) lines.push(`<i>+ ${plural(other, 'elev plecat sau transferat', 'elevi plecați sau transferați')}</i>`);
  const done = doneLessons(view, [g.id]).sort((a, b) => a.iso.localeCompare(b.iso));
  const nx = nextOfGroup(g, t, view);
  if (done.length || nx) lines.push('');
  if (done.length) lines.push(`📊 ${plural(done.length, 'lecție predată', 'lecții predate')} · ultima: ${esc(dateText(done[done.length - 1].iso))}`);
  if (nx) lines.push(`➡️ Următoarea lecție: <b>${esc(dayName(nx.iso, t.iso))} · ${hh(nx.start)}</b>`);
  return lines.join('\n');
}
/* the next lesson that he really teaches: a lesson given to a replacement is skipped */
function nextOfGroup(g, t, view) {
  if (!['activ', 'starteaza'].includes(stateKey(g.state))) return null;
  for (let i = 0; i <= 21; i++) {
    const iso = addDays(t.iso, i), it = dayItems(view, iso).teach.find(x => x.kind === 'own' && x.group.id === g.id && (i > 0 || x.start * 60 > t.minutes));
    if (it) return { iso, start: it.start };
  }
  return null;
}
export const backKeyboard = { inline_keyboard: [[{ text: '‹ Toate grupele', callback_data: 'gl' }]] };

/* ---------- pay and numbers ---------- */

const ago = (iso, now) => {
  if (!iso) return '';
  const m = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000));
  return m < 1 ? 'chiar acum' : m < 60 ? `acum ${plural(m, 'minut', 'minute')}` : m < 1440 ? `acum ${plural(Math.round(m / 60), 'oră', 'ore')}` : `acum ${plural(Math.round(m / 1440), 'zi', 'zile')}`;
};

export function salaryText(view, now) {
  const tds = (view.workbooks || []).map(w => w.teacher_data || {});
  const sum = k => tds.reduce((a, d) => a + (Number(d[k]) || 0), 0), has = k => tds.some(d => d[k] != null);
  if (!has('earnedTotal') && !has('paidTotal') && !has('salaryDue')) return '💰 <b>Salariul tău</b>\n\nNu am găsit cifrele în foaia „Total achitări” din registrul tău.';
  const pays = tds.flatMap(d => (d.payments || []).filter(p => p && Number(p.sum))).sort((a, b) => String(b.iso || '').localeCompare(String(a.iso || ''))).slice(0, 3);
  const seen = (view.workbooks || []).map(w => w.last_synced_at).filter(Boolean).sort().pop();
  const out = ['💰 <b>Salariul tău</b>', table([['Câștigat', money(sum('earnedTotal'))], ['Achitat', money(sum('paidTotal'))], ['De primit', money(sum('salaryDue'))]])];
  if (pays.length) out.push('<b>Ultimele plăți</b>\n' + table(pays.map(p => [String(p.dateText || p.iso || ''), money(p.sum)])));
  if (seen) out.push(`<i>Din registrul tău, citit ${ago(seen, now)}</i>`);
  return out.join('\n\n');
}

export function statsText(view, now) {
  const gs = realGroups(view), t = localNow(now), month = t.iso.slice(0, 7);
  const done = doneLessons(view);
  const present = done.reduce((a, l) => a + Object.values(l.marks || {}).filter(c => c === 'P' || c === 'G').length, 0);
  const thisMonth = done.filter(l => l.iso.slice(0, 7) === month);
  const noMarks = (view.lessons || []).filter(l => l.iso && String(l.topic || '').trim() && !Object.values(l.marks || {}).some(Boolean) && l.iso <= t.iso);
  const active = gs.filter(g => ['activ', 'starteaza'].includes(stateKey(g.state))).length;
  const out = ['📊 <b>Cifrele tale</b>', table([
    [`Lecții în ${MONTHS[Number(month.slice(5)) - 1]}`, String(thisMonth.length)],
    ['Lecții în total', String(done.length)],
    ['Elevi pe lecție', done.length ? nf1.format(present / done.length) : '—'],
    ['Grupe active', `${active} din ${gs.length}`]])];
  if (noMarks.length) out.push(noMarks.length === 1 ? '📝 1 lecție are dată și temă, dar nu are prezențe notate în registru.' : `📝 ${noMarks.length} lecții au dată și temă, dar nu au prezențe notate în registru.`);
  return out.join('\n\n');
}

/* ---------- replacements ---------- */
export function replacementsText(view, now) {
  const t = localNow(now), W = new Set((view.workbooks || []).map(w => w.id));
  const mine = [], subs = [];
  (view.replacements || []).filter(r => r.status === 'active').forEach(r => (r.dates || []).forEach(d => {
    if (d.cancelled || !d.iso || d.iso < t.iso) return;
    const base = r.orig || {};
    const row = { iso: d.iso, start: d.start, end: d.start + (d.duration || 1), name: groupName(base), other: r.replTeacher, from: r.origTeacher, cabinet: d.cabinet };
    if (W.has(r.orig_workbook)) mine.push(row);
    if (W.has(r.repl_workbook)) subs.push(row);
  }));
  const sort = a => a.sort((x, y) => x.iso.localeCompare(y.iso) || x.start - y.start);
  if (!mine.length && !subs.length) return '🔄 <b>Înlocuiri</b>\n\nNu ai nicio înlocuire programată.';
  const block = (r, who) => `<b>${esc(dayName(r.iso, t.iso))} · ${hh(r.start)}–${hh(r.end)}</b>\n${r.name}${who ? ' · ' + who : ''}${r.cabinet ? ` · cab. ${esc(r.cabinet)}` : ''}`;
  const out = ['🔄 <b>Înlocuiri</b>'];
  if (mine.length) out.push('<b>Te înlocuiește altcineva</b>\n' + quote(sort(mine).map(r => block(r, r.other ? 'de către ' + esc(r.other) : ''))));
  if (subs.length) out.push('<b>Înlocuiești tu</b>\n' + quote(sort(subs).map(r => block(r, r.from ? 'grupa lui ' + esc(r.from) : ''))));
  return out.join('\n\n');
}

/* ---------- Meet ---------- */
export function meetText(view) {
  if (!hasRegister(view)) return NO_REGISTER;
  const links = (view.workbooks || []).map(w => { const m = w.teacher_data && w.teacher_data.meet; return typeof m === 'string' ? m : (m && (m.url || m.link)) || ''; }).filter(Boolean);
  const online = realGroups(view).filter(g => plain(g.mode) === 'online' && stateKey(g.state) !== 'inactiv');
  const out = ['💻 <b>Linkul tău Meet</b>'];
  out.push(links.length ? `<a href="${esc(links[0])}">${esc(links[0])}</a>` : 'Nu ai încă un link în registru. Scrie-l în foaia „Disponibilitate”, în rândul „Link Google Meet”.');
  out.push(online.length ? `👥 Îl văd elevii a ${plural(online.length, 'grupă online', 'grupe online')}.` : 'Nu ai grupe online acum.');
  return out.join('\n\n');
}

/* ---------- the rules ---------- */
const NEED_TABLE = '<pre>' + Object.keys(START_MIN).map(Number).sort((a, b) => a - b).map(n => `grup de ${String(n).padEnd(2)}  ${START_MIN[n]} elevi`).join('\n') + '</pre>';
export const RULES = {
  start: `🚀 <b>Când pornește o grupă</b>\n\nO grupă care se completează trece singură în „Pornește” când are destui elevi înscriși (activi sau la ora de probă):\n\n${NEED_TABLE}\n\nLecția individuală nu are oră de probă.\nCând grupa pornește te întreb aici dacă confirmi, apoi managerul sună elevii.`,
  status: '🏷 <b>Statusurile grupei</b>\n\n' + quote(['🟢 <b>Activă</b>: merge, are lecții', '🟠 <b>Se completează</b>: se mai înscriu elevi, lecțiile n-au început', '🚀 <b>Pornește</b>: sunt destui elevi, urmează lecția de probă', '⚪ <b>Inactivă</b>: nu mai are lecții', '🔄 <b>Înlocuire</b>: fila unui profesor care înlocuiește']) + '\n\nStatusul îl schimbă managerul sau registrul.',
  marks: '📝 <b>Prezențele din registru</b>\n\n' + quote(['<b>PREZENT</b>: elevul a fost', '<b>ABSENT</b>: lipsă nemotivată, lecția se taxează', '<b>ABSENT MOTIVAT</b>: lipsă motivată, nu se taxează', '<b>PRIMA LECȚIE GRATUITĂ</b>: ora de probă, a venit', '<b>ABSENT PRIMA LECȚIE GRATUITĂ</b>: ora de probă, n-a venit']) + '\n\nData, tema și prezențele se scriu doar în registru. O lecție contează când are dată, temă și cel puțin o prezență.',
  schedule: '🗓 <b>Orarul unei grupe</b>\n\n' + quote(['O lecție de două ore într-o zi', 'sau două lecții de o oră, în zile diferite']) + '\n\nOrele, zilele și cabinetul le schimbă managerul. Grupele online nu au cabinet.'
};
export const rulesKeyboard = () => ({ inline_keyboard: [[{ text: '🚀 Pornirea grupei', callback_data: 'r:start' }, { text: '🏷 Statusuri', callback_data: 'r:status' }], [{ text: '📝 Prezențe', callback_data: 'r:marks' }, { text: '🗓 Orar', callback_data: 'r:schedule' }]] });
export const rulesIntro = '📘 <b>Reguli</b>';

/* ---------- help and menu ---------- */
/* the quick keys under the message box */
export const MENU = [['📅 Azi', '📅 Mâine'], ['👥 Grupele mele', '💰 Salariu'], ['❓ Ajutor']];
export const menuKeyboard = () => ({ keyboard: MENU.map(r => r.map(text => ({ text }))), resize_keyboard: true, is_persistent: true });

/* the help: a grid of nine keys, three in a row, every key the same width, so it lines up on any phone */
export const COMMANDS = [['azi', '📅 Azi'], ['maine', '📅 Mâine'], ['saptamana', '📆 7 zile'], ['grupe', '👥 Grupe'], ['salariu', '💰 Salariu'], ['statistici', '📊 Cifre'], ['inlocuiri', '🔄 Înlocuiri'], ['meet', '💻 Meet'], ['reguli', '📘 Reguli']];
export const helpKeyboard = () => ({ inline_keyboard: [0, 3, 6].map(i => COMMANDS.slice(i, i + 3).map(([c, text]) => ({ text, callback_data: 'cmd:' + c }))) });
export const helpText = '🤖 <b>Asistentul Mathorizon</b>';

/* what the teacher may type, with or without the slash, and the keys of the menu */
const WORDS = { azi: 'azi', maine: 'maine', saptamana: 'saptamana', '7 zile': 'saptamana', grupe: 'grupe', 'grupele mele': 'grupe', salariu: 'salariu', statistici: 'statistici', cifre: 'statistici', inlocuiri: 'inlocuiri', meet: 'meet', reguli: 'reguli', ajutor: 'ajutor', help: 'ajutor', meniu: 'ajutor' };
export function commandOf(text) {
  const t = plain(String(text || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '')).replace(/^\//, '').replace(/@\w+$/, '').trim();
  return WORDS[t] || null;
}

/* ---------- the question about a start, and its answers ---------- */
export function nextOccurrence(schedule, now) {
  const slots = slotsOf(schedule), t = localNow(now);
  if (!slots.length) return null;
  for (let i = 0; i <= 14; i++) {
    const iso = addDays(t.iso, i), s = slots.find(x => x.day === dowOf(iso) && (i > 0 || x.start * 60 > t.minutes));
    if (s) return { iso, start: s.start, end: s.end, cabinet: s.cabinet };
  }
  return null;
}

const groupLines = r => [`<b>${[esc(r.subject || 'Grupă'), esc(gradeText(r.grade))].filter(Boolean).join(', ')}</b>`].concat(whenText(r.schedule) ? [`🗓 ${esc(whenText(r.schedule))}`] : []);

export function askText(r, counts, students, now) {
  const names = (students || []).filter(s => s && s.name && isCounted(s.status));
  const box = groupLines(r).concat([`👥 ${counts.enrolled} ${counts.enrolled === 1 ? 'elev înscris' : 'elevi înscriși'} din ${counts.size}${counts.need ? ` (minimul pentru start e ${counts.need})` : ''}`], names.map(s => `   • ${esc(s.name)} · ${plain(s.status) === 'activ' ? 'activ' : 'oră de probă'}`));
  const nx = now ? nextOccurrence(r.schedule, now) : null;
  const out = ['🚀 <b>Grupa ta e gata de start</b>', quote(box)];
  if (nx) out.push(`➡️ Prima lecție, cea de probă: <b>${esc(dateText(nx.iso))} · ${hh(nx.start)}</b>`);
  out.push('Confirmând, managerul sună elevii pentru prima lecție.', '<b>Confirmi startul grupei?</b>');
  return out.join('\n\n');
}
export const confirmedText = (r, now) => {
  const nx = now ? nextOccurrence(r.schedule, now) : null;
  return ['✅ <b>Ai confirmat startul grupei</b>', quote(groupLines(r)), 'Managerul a fost anunțat și sună elevii.' + (nx ? `\n➡️ Prima lecție: <b>${esc(dateText(nx.iso))} · ${hh(nx.start)}</b>` : '')].join('\n\n');
};
export const declinedText = r => ['❌ <b>Nu ai confirmat startul grupei</b>', quote(groupLines(r))].join('\n\n');
