/* When does a group start? The status "Se completează" (students are still being enrolled) turns into "Startează" (the teacher gives the next lesson, the students
   come to the trial lesson) by itself, as soon as enough students are enrolled; nobody changes it by hand. "Startează" turns into "Activ" when the students stay.
   For now the only criterion is how many students are enrolled. How many, by the size of the group (the founder's rule: 4 of 6, 2 of 3; the other sizes follow the same
   two-thirds proportion and the pay table's guaranteed minimum, to be confirmed). An individual lesson has no trial lesson: it is charged from the first lesson, so
   it never waits in "Se completează" and has no rule here.
   Plain ES module, no imports: read by Node (tests) and by the Supabase Edge Function. */

export const START_MIN = { 2: 2, 3: 2, 4: 3, 5: 4, 6: 4, 8: 6, 10: 6 };
const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/* the students who count as enrolled: on the trial lesson, confirmed after it, or already active (Inactiv, Transferat and Înlocuire are not students of the group) */
const COUNTS = new Set(['activ', 'ora de proba', 'ora de proba confirmata']);

export const minToStart = size => START_MIN[size] || null;

/* g: a group as groupPayload gives it ({ state, format_size, students: [{ status }] }). Returns null when the rule does not apply, else { enrolled, need, start } */
export function startCheck(g) {
  if (!g || plain(g.state) !== 'se completeaza') return null;
  const need = minToStart(g.format_size);
  if (!need) return null;
  const enrolled = (g.students || []).filter(s => COUNTS.has(plain(s.status))).length;
  return { enrolled, need, start: enrolled >= need };
}

/* The groups of the database (rows of reg_groups with the statuses of their students) that have enough students to start now, whatever the register did since.
   A register that has not changed is not read again, so a group that missed its start (the register was busy, Google's per-minute limit, a command that failed) would
   wait for the next edit; the sync looks at the database too, every run, and queues the start again. groups: [{ id, workbook_id, sheet_id, tab, state, format_size }],
   studentsByGroup: Map(group id -> [{ status }]). */
export function pendingStarts(groups, studentsByGroup) {
  const out = [];
  for (const g of groups || []) {
    const sc = startCheck({ state: g.state, format_size: g.format_size, students: (studentsByGroup && studentsByGroup.get(g.id)) || [] });
    if (sc && sc.start) out.push({ workbook: g.workbook_id, sheetId: g.sheet_id, tab: g.tab, enrolled: sc.enrolled, need: sc.need });
  }
  return out;
}
