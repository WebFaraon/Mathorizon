/* The reading side of the sync (F1), independent of where it runs.
     read(spreadsheetId)  -> { title, tabs: [{ title, sheetId, hidden, values }] }      (google.mjs, or a fixture in tests)
     db                   -> { hashes, applyGroup, prune }                              (Supabase in the function, a Map in tests)
   One register at a time: read it once, parse it with the same parser as the importer, and replace each CHANGED group whole (or not at all).
   Nothing is deleted on a doubt: an unreadable register, or one that suddenly shows no group, fails the run and leaves the data as it was. */
import { parseWorkbook } from './parse.mjs';

const KNOWN_SIZES = [1, 2, 3, 4, 5, 6, 8];
const MARK_CODE = c => c.code || c.raw;
const titleHasYear = title => /\d{4}\s*-\s*\d{4}/.test(title);

/* the interface the parser reads, over plain arrays of values */
export function valuesBook(data, source) {
  const byName = new Map(data.tabs.map(t => [t.title, t]));
  return {
    source,
    sheetNames: data.tabs.map(t => t.title),
    hidden: n => !!(byName.get(n) && byName.get(n).hidden),
    sheet(name) {
      const t = byName.get(name), v = (t && t.values) || [];
      const cell = (r, c) => { const x = v[r - 1] && v[r - 1][c - 1]; return x === undefined || x === null || x === '' ? undefined : x; };
      return {
        name, rows: Math.max(1, v.length), cols: Math.max(1, ...v.map(r => r.length)),
        get: (r, c) => { const x = cell(r, c); return x === undefined ? undefined : { v: x, f: null, t: typeof x === 'number' ? 'n' : typeof x === 'boolean' ? 'b' : 's' }; },
        text(r, c) { const x = cell(r, c); return x === undefined ? '' : String(x).trim(); },
        num(r, c) { const x = cell(r, c); return typeof x === 'number' ? x : null; }
      };
    }
  };
}

export async function sha256(text) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...d].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* one group of the parsed model -> the payload of reg_apply_group (what is stored, nothing else) */
export function groupPayload(g, sheetId) {
  return {
    sheet_id: sheetId, tab: g.tab, format_size: g.size, state: g.state, subject: g.subject, summer: g.summer, grade: g.grade, level: g.level, profile: g.profile,
    schedule: g.schedule.filter(s => !s.stub).map(s => ({ day: s.day, hour: s.hour, cabinet: s.cabinet })),
    cached_total_pay: g.cachedTotalPay,
    students: g.students.map(s => ({ col: s.colLetter, header_raw: s.headerRaw, name: s.name, phone: s.phone, phone_kind: s.phoneKind, manager: s.manager, status: s.status, paid: s.paid.value, discount: s.discount.value, cost: s.cached.cost, sold: s.cached.sold })),
    lessons: g.lessons.map(l => ({ row_no: l.row, date_text: l.dateText || null, iso: l.iso || null, topic: l.topic || null, teacher_level: l.level, teacher_pay: l.cachedPay, marks: Object.fromEntries(Object.entries(l.marks).map(([c, m]) => [c, MARK_CODE(m)])) }))
  };
}

/* what belongs to the register itself, not to one group: the project, the dropdown lists, and the teacher's own tabs */
export function workbookData(m) {
  const cfg = m.config || {};
  const tot = m.total || {};
  const av = m.availability || null, avv = m.availabilitySummer || null;
  return {
    project: m.meta.project || null,
    config: { manager: cfg.manager || [], cabinet: cfg.cabinet || [], subject: cfg.subject || [], studentStatus: cfg.studentStatus || [], groupState: cfg.groupState || [] },
    teacher: {
      availability: av ? { slots: av.slots, teaches: av.teaches } : null,
      availabilitySummer: avv ? { slots: avv.slots, teaches: avv.teaches } : null,
      payments: (tot.payments || []).filter(p => p.sum != null).map(p => ({ dateText: p.dateText, iso: p.iso, sum: p.sum })),
      salaryDue: tot.salaryDue == null ? null : tot.salaryDue, paidTotal: tot.paidTotal == null ? null : tot.paidTotal, earnedTotal: tot.earnedTotal == null ? null : tot.earnedTotal
    }
  };
}

/* a group is not stored when its format is wrong: every price and pay in it would be wrong too */
export function gate(g) {
  if (g.size == null || !KNOWN_SIZES.includes(g.size)) return `formatul „${g.formatRaw}” nu e unul cunoscut`;
  return null;
}

const DAY_MS = 24 * 3600 * 1000;

/* wb: { id, spreadsheet_id, title, school_year_from, drive_modified, last_full_sync_at }
   peek(spreadsheetId) -> the file's modifiedTime: when it is the same as at the last full read (and that read is under a day old) the register is not read at all */
export async function syncWorkbook({ wb, read, peek, db }) {
  const out = { seen: 0, changed: 0, unchanged: 0, skipped: [], pruned: 0, notes: [], full: true, modified: null };
  if (peek) {
    out.modified = await peek(wb.spreadsheet_id);                                 // asked BEFORE reading: an edit in between shows up as a newer time next run
    const fresh = wb.last_full_sync_at && Date.now() - Date.parse(wb.last_full_sync_at) < DAY_MS;
    if (out.modified && wb.drive_modified === out.modified && fresh) { out.full = false; return out; }
  }
  const data = await read(wb.spreadsheet_id);
  const source = `${data.title}.xlsx`;
  const book = valuesBook(data, source);
  const m = parseWorkbook(book, { yearFrom: wb.school_year_from || null });
  if (wb.school_year_from && !titleHasYear(data.title)) out.notes.push('anul școlar nu se vede în titlu: am folosit anul din setări');
  if (!m.groups.length) throw new Error('Registrul nu arată nicio grupă: nu schimb nimic (poate accesul lipsește sau structura s-a stricat).');
  const sheetOf = new Map(data.tabs.map(t => [t.title, t.sheetId]));
  const stored = await db.hashes(wb.id);
  const keep = [];
  for (const g of m.groups) {
    out.seen++;
    const sheetId = sheetOf.get(g.tab);
    keep.push(sheetId);
    const bad = gate(g);
    if (bad) { out.skipped.push({ tab: g.tab, reason: bad }); continue; }       // the previous copy of this group stays as it was
    const payload = groupPayload(g, sheetId);
    payload.content_hash = await sha256(JSON.stringify(Object.assign({}, payload, { content_hash: undefined })));
    if (stored.get(String(sheetId)) === payload.content_hash) { out.unchanged++; continue; }
    await db.applyGroup(wb.id, payload);
    out.changed++;
  }
  // tabs deleted from the register leave the platform, but only the tabs that no longer exist (a skipped group is kept)
  out.pruned = await db.prune(wb.id, keep.filter(x => x !== undefined));
  out.title = data.title; out.teacher = m.meta.teacher;
  out.workbook = workbookData(m);
  return out;
}
