/* A teacher's register (Google Sheets / .xlsx) -> a clean model.
   The layout it knows (see the sheets themselves):
     Total achitări   payments to the teacher in A:B (from row 3), salary cells E1:E3, the tabs it adds up in F4:AI4
     Disponibilitate  a days x hours grid ("Disponibil") and what the teacher teaches (subject x class ticks)
     CONFIGURARI      hidden: the lists behind every dropdown
     one tab per group:
       A1 format, A3 state, A4 subject, A5 class, A6 level, A7 profile; AA2:AC7 schedule (day, hour, cabinet)
       students in columns D..Z: row 1 "Name+373...", 2 sold, 3 payments, 4 discounts, 5 cost, 6 done/available,
       7 manager, 8 status; lessons in rows 9..198: A date ("4 August", no year), B topic, C teacher pay,
       AA teacher level, marks from column D.
   Nothing is guessed silently: what had to be cleaned or inferred is written in the model (kind, note) so the
   validation report can show it. */
'use strict';
const path = require('path');
const { priceFor, lessonPay } = require('./pay');

const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const colLetter = c => { let s = ''; for (; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; };
const GENERAL = new Set(['total achitari', 'disponibilitate', 'disponibilitate vara', 'configurari']);
const DAYS = { luni: 1, marti: 2, miercuri: 3, joi: 4, vineri: 5, sambata: 6, sambat: 6, duminica: 7 };
const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const MARK = { 'prezent': 'P', 'absent': 'A', 'prima lectie gratuita': 'G', 'absent motivat': 'M', 'absent prima lectie gratuita': 'B' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const FIRST_STUDENT_COL = 4, LAST_STUDENT_COL = 26, FIRST_LESSON_ROW = 9, LAST_LESSON_ROW = 198;

const pad = n => String(n).padStart(2, '0');
const dayNumber = name => { const p = plain(name); return DAYS[p] || DAYS[p.replace(/a$/, '')] || null; };

/* "Bivol Dragoș Registru EXAMEN.MD OFFLINE 2025-2026" -> teacher, project, school year */
function titleOf(file) {
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  const m = /^(.*?)\s+Registru\s+(.*?)\s+(\d{4})\s*-\s*(\d{4})$/i.exec(base);
  return m ? { title: base, teacher: m[1].trim(), project: m[2].trim(), yearFrom: +m[3], yearTo: +m[4] } : { title: base, teacher: null, project: null, yearFrom: null, yearTo: null };
}

/* the lists behind the dropdowns */
function readConfig(book) {
  const out = { found: false };
  const name = book.sheetNames.find(n => plain(n) === 'configurari');
  if (!name) return out;
  const s = book.sheet(name);
  const keys = { manager: 'manager', materia: 'subject', clasa: 'grade', nivelul: 'level', profilul: 'profile', 'starea grupului': 'groupState', 'statutul elevului': 'studentStatus', 'statut participare': 'mark', 'statut disponibilitate': 'availability', cabinetul: 'cabinet' };
  out.found = true;
  for (let c = 1; c <= s.cols; c++) {
    const key = keys[plain(s.text(1, c))];
    if (!key) continue;
    const list = [];
    for (let r = 2; r <= Math.min(s.rows, 400); r++) { const t = s.text(r, c); if (t) list.push(t); }
    out[key] = list;
  }
  return out;
}

/* "Name+37369123456" and its untidy cousins */
function parseStudentHeader(raw) {
  const text = String(raw).replace(/\r/g, '\n');
  const cut = text.search(/[+\d]/);
  const namePart = cut < 0 ? text : text.slice(0, cut);
  const phonePart = cut < 0 ? '' : text.slice(cut);
  const name = namePart.replace(/\s+/g, ' ').replace(/[(),;:-]+\s*$/, '').trim();
  const digits = phonePart.replace(/\D/g, '');
  let phone = null, kind;
  if (!digits) kind = 'missing';
  else if (/^373\d{8}$/.test(digits)) phone = '+' + digits;
  else if (/^0[67]\d{7}$/.test(digits)) phone = '+373' + digits.slice(1);
  else if (/^[67]\d{7}$/.test(digits)) phone = '+373' + digits;
  else kind = 'invalid';
  if (phone) kind = /^[^\d+]+\+373\d{8}$/.test(text.trim()) && !text.includes('\n') ? 'ok' : 'cleaned';
  const words = name.split(' ').filter(Boolean).length;
  return { name, phone, phoneKind: kind, phoneRaw: phonePart.replace(/\s+/g, ' ').trim(), nameNote: text.includes('\n') ? 'pe mai multe rânduri' : words >= 4 ? 'peste 3 cuvinte, poate include și părintele' : words < 2 ? 'un singur cuvânt' : null };
}

/* payments typed as =SUM(1216-608): the figure, the formula and its terms */
function money(cell) {
  if (!cell) return { value: 0, formula: null, parts: [], blank: true };
  const value = typeof cell.v === 'number' ? cell.v : parseFloat(String(cell.v).replace(',', '.'));
  const formula = cell.f ? cell.f.replace(/\s+/g, '') : null;
  let parts = [];
  if (formula) {
    const inner = /^sum\((.*)\)$/i.exec(formula);
    const body = inner ? inner[1] : formula;
    if (/^[\d.+\-*/()]*$/.test(body)) parts = (body.match(/[+-]?\d+(?:\.\d+)?/g) || []).map(Number);
  }
  return { value: Number.isFinite(value) ? value : 0, formula, parts, bad: !Number.isFinite(value) ? String(cell.v) : null };
}

function level(raw) {
  const t = String(raw || '').trim();
  if (!t || plain(t) === 'nivelul') return { value: null, placeholder: !!t };
  if (plain(t) === 'repetat') return { value: 'Repetat' };
  const m = /(\d+)\D+(\d+)/.exec(t);
  return m ? { value: `${m[1]}-${m[2]}` } : { value: null, odd: t };
}

/* one group tab */
function parseGroup(book, name, year) {
  const s = book.sheet(name);
  const g = { tab: name, flags: [], notes: [] };
  const tabPlain = plain(name);
  ['inactiv', 'transferat', 'inlocuire'].forEach(f => { if (tabPlain.includes(f)) g.flags.push(f); });
  g.formatRaw = s.text(1, 1);
  const fm = /(\d+)/.exec(g.formatRaw);
  g.size = fm ? +fm[1] : (plain(g.formatRaw).startsWith('individual') ? 1 : null);
  g.state = s.text(3, 1) || null;
  const subj = s.text(4, 1);
  g.subject = subj.replace(/\s*\(vara\)\s*$/i, '').trim() || null;
  g.summer = /\(vara\)/i.test(subj);
  g.grade = ROMAN.includes(s.text(5, 1)) ? s.text(5, 1) : (s.text(5, 1) || null);
  const lv = level(s.text(6, 1));
  g.level = lv.value; if (lv.placeholder) g.notes.push('nivelul nu e ales'); if (lv.odd) g.notes.push('nivel neînțeles: ' + lv.odd);
  const pr = s.text(7, 1);
  g.profile = pr === 'Real' || pr === 'Uman' ? pr : null;
  g.schedule = [];
  for (let r = 2; r <= 7; r++) {
    const dayRaw = s.text(r, 27);
    if (!dayRaw && !s.get(r, 28) && !s.text(r, 29)) continue;
    const hv = s.num(r, 28);
    g.schedule.push({ row: r, dayRaw, day: dayNumber(dayRaw), hour: hv == null ? null : Math.round(hv * 24), cabinet: s.text(r, 29) || null, stub: !dayRaw && hv == null });
  }
  /* students */
  g.students = [];
  for (let c = FIRST_STUDENT_COL; c <= LAST_STUDENT_COL; c++) {
    const raw = s.get(1, c);
    if (!raw) continue;
    const h = parseStudentHeader(raw.v);
    g.students.push(Object.assign({
      col: c, colLetter: colLetter(c), headerRaw: String(raw.v),
      manager: s.text(7, c) || null, status: s.text(8, c) || null,
      paid: money(s.get(3, c)), discount: money(s.get(4, c)),
      cached: { sold: s.num(2, c), cost: s.num(5, c), done: s.text(6, c) || null }
    }, h));
  }
  /* a text in row 1 with nothing under it (no status, manager, money or marks) is a note, not a student */
  const hasMarks = c => { for (let r = FIRST_LESSON_ROW; r <= LAST_LESSON_ROW; r++) if (s.text(r, c)) return true; return false; };
  g.students = g.students.filter(st => {
    const empty = !st.status && !st.manager && !st.paid.value && !st.discount.value && !hasMarks(st.col);
    if (empty) g.notes.push(`${st.colLetter}1 e o notă, nu un elev: „${st.headerRaw.replace(/\s+/g, ' ').slice(0, 80)}”`);
    return !empty;
  });
  /* marks in a student column that has no header */
  g.orphanMarks = [];
  const known = new Set(g.students.map(x => x.col));
  for (let c = FIRST_STUDENT_COL; c <= LAST_STUDENT_COL; c++) {
    if (known.has(c) || g.students.some(x => x.col === c)) continue;
    let n = 0;
    for (let r = FIRST_LESSON_ROW; r <= LAST_LESSON_ROW; r++) if (s.text(r, c)) n++;
    if (n) g.orphanMarks.push({ col: colLetter(c), count: n });
  }
  /* lessons */
  g.lessons = [];
  const cols = g.students.map(x => x.col);
  for (let r = FIRST_LESSON_ROW; r <= LAST_LESSON_ROW; r++) {
    const dateText = s.text(r, 1), topic = s.text(r, 2);
    const marks = {};
    let any = false;
    cols.forEach(c => { const t = s.text(r, c); if (t) { marks[colLetter(c)] = { raw: t, code: MARK[plain(t)] || null }; any = true; } });
    if (!dateText && !topic && !any) continue;
    const lvRaw = s.text(r, 27), lm = /(\d+)\s*$/.exec(lvRaw);
    const L = { row: r, dateText, topic, marks, level: lm ? +lm[1] : null, cachedPay: s.num(r, 3), cachedPct: s.num(r, 28) };
    const m = /^(\d{1,2})\s+(.+)$/.exec(dateText);
    if (m && MONTHS.includes(plain(m[2]))) {
      const mi = MONTHS.indexOf(plain(m[2]));
      L.dom = +m[1]; L.month = mi + 1;
      if (year) {
        L.year = L.month >= 9 ? year : year + 1;
        const d = new Date(Date.UTC(L.year, mi, L.dom));
        if (d.getUTCMonth() === mi && d.getUTCDate() === L.dom) { L.iso = `${L.year}-${pad(L.month)}-${pad(L.dom)}`; L.weekday = ((d.getUTCDay() + 6) % 7) + 1; }
        else L.badDate = true;
      }
    } else if (dateText) L.badDate = true;
    g.lessons.push(L);
  }
  g.cachedTotalPay = s.num(8, 3);
  return g;
}

/* Disponibilitate: when the teacher can teach, and what */
function parseAvailability(book, name) {
  const s = book.sheet(name);
  const slots = {};
  const hoursSeen = [];
  for (let r = 2; r <= Math.min(s.rows, 40); r++) {
    const hv = s.num(r, 1);
    if (hv == null) continue;
    const h = Math.round(hv * 24);
    hoursSeen.push(h);
    for (let c = 2; c <= 8; c++) {
      const day = dayNumber(s.text(1, c));
      if (day && plain(s.text(r, c)) === 'disponibil') (slots[day] = slots[day] || []).push(h);
    }
  }
  const teaches = {};
  for (let r = 1; r <= Math.min(s.rows, 60); r++) {
    // the header row of the ticks: roman numerals from column K
    const first = s.text(r, 11);
    if (first !== 'I') continue;
    const grades = [];
    for (let c = 11; c <= 11 + 11; c++) grades.push(s.text(r, c));
    for (let rr = r + 1; rr <= Math.min(s.rows, r + 30); rr++) {
      const subj = s.text(rr, 10);
      if (!subj) continue;
      const ticked = [];
      grades.forEach((gr, i) => { const x = s.get(rr, 11 + i); if (gr && x && x.v === true) ticked.push(gr); });
      teaches[subj] = ticked;
    }
    break;
  }
  return { sheet: name, slots, teaches, hours: hoursSeen };
}

/* Total achitări: what was paid to the teacher, the salary cells, the tabs it adds up */
function parseTotal(book, name) {
  const s = book.sheet(name);
  const payments = [];
  for (let r = 3; r <= Math.min(s.rows, 80); r++) {
    const a = s.text(r, 1), bv = s.get(r, 2);
    if (!a && !bv) continue;
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(a);
    const sum = bv ? parseFloat(String(bv.v).replace(',', '.')) : null;
    payments.push({ row: r, dateText: a, iso: m ? `${m[3]}-${m[2]}-${m[1]}` : null, sum: Number.isFinite(sum) ? sum : null });
  }
  const tabs = [];
  for (let c = 6; c <= 40; c++) { const t = s.text(4, c); if (t) tabs.push({ col: colLetter(c), name: t }); }
  return { sheet: name, salaryDue: s.num(1, 5), paidTotal: s.num(2, 5), earnedTotal: s.num(3, 5), payments, tabs };
}

function parseWorkbook(book) {
  const meta = titleOf(book.source || '');
  const year = meta.yearFrom;
  const names = book.sheetNames;
  const find = k => names.find(n => plain(n) === k);
  const model = { meta, config: readConfig(book), sheets: names.map(n => ({ name: n, hidden: book.hidden(n) })), groups: [], skipped: [] };
  const total = find('total achitari');
  if (total) model.total = parseTotal(book, total);
  const av = find('disponibilitate'), avv = find('disponibilitate vara');
  if (av) model.availability = parseAvailability(book, av);
  if (avv) model.availabilitySummer = parseAvailability(book, avv);
  names.forEach(n => {
    if (GENERAL.has(plain(n))) return;
    const g = parseGroup(book, n, year);
    const placeholder = plain(g.state) === 'starea grupului' && !g.students.length && !g.lessons.length;
    if ((!g.formatRaw && !g.students.length && !g.lessons.length) || placeholder) { model.skipped.push({ tab: n, reason: 'filă goală (șablon)' }); return; }
    model.groups.push(g);
  });
  return model;
}

module.exports = { parseWorkbook, parseStudentHeader, titleOf, plain, colLetter, dayNumber, priceFor, lessonPay, ROMAN };
