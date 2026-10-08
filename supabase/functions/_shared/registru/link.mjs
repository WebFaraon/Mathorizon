/* The register has no student id: the same child is a column in every group he was in, found again only by his name
   and his parent's phone. This links the columns into people (and says how sure it is), so the journey of a student
   can be rebuilt. Rules:
     same phone + same name (words, in any order, one name may be shorter)  -> the same person
     same phone + other name                                                -> another person (a sibling?), listed
     no phone                                                               -> matched by name only, marked "doar după nume"
     same name + other phone                                                -> not merged, listed as a possible duplicate
   Plain ES module (Node through require, the Supabase Edge Function through import). */
import { plain } from './parse.mjs';

export const tokens = name => plain(name).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).sort();
function sameName(a, b) {
  if (!a.length || !b.length) return false;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 2 && s.every(t => l.includes(t));           // "Popescu Ana" is part of "Popescu Ana Maria"
}

export function marksOf(group, st) {
  const c = { P: 0, A: 0, G: 0, M: 0, B: 0, other: 0 };
  let firstIso = null, lastIso = null, firstRow = null, lastRow = null;
  group.lessons.forEach(l => {
    const m = l.marks[st.colLetter];
    if (!m) return;
    if (m.code) c[m.code]++; else c.other++;
    if (!firstRow) { firstRow = l.row; firstIso = l.iso || null; }
    lastRow = l.row; lastIso = l.iso || lastIso;
  });
  return { counts: c, charged: c.P + c.A, total: c.P + c.A + c.G + c.M + c.B + c.other, firstIso, lastIso, firstRow, lastRow };
}

export function linkPeople(model) {
  const people = [];
  const byPhone = new Map();
  const noPhone = [];
  model.groups.forEach(g => g.students.forEach(st => {
    const e = { tab: g.tab, colLetter: st.colLetter, status: st.status, manager: st.manager, paid: st.paid.value, discount: st.discount.value, group: g, student: st, marks: marksOf(g, st) };
    st.person = null;
    const t = tokens(st.name);
    if (st.phone) {
      const list = byPhone.get(st.phone) || [];
      let p = list.find(x => sameName(x.tokens, t));
      if (!p) { p = { id: null, name: st.name, phone: st.phone, tokens: t, enrollments: [], flags: new Set(), viaNameOnly: false }; people.push(p); list.push(p); byPhone.set(st.phone, list); }
      p.enrollments.push(e); st.person = p;
    } else noPhone.push({ e, t, st });
  }));
  noPhone.forEach(({ e, t, st }) => {
    let p = people.find(x => sameName(x.tokens, t));
    if (!p) { p = { id: null, name: st.name, phone: null, tokens: t, enrollments: [], flags: new Set(), viaNameOnly: true }; people.push(p); }
    else p.flags.add('legat doar după nume');
    p.enrollments.push(e); st.person = p;
  });
  people.forEach((p, i) => { p.id = 'p' + (i + 1); p.enrollments.sort((a, b) => (a.marks.firstIso || '9999').localeCompare(b.marks.firstIso || '9999') || a.group.tab.localeCompare(b.group.tab)); });
  // siblings and possible duplicates
  const siblings = [], dupes = [];
  byPhone.forEach((list, phone) => { if (list.length > 1) siblings.push({ phone, names: list.map(p => p.name) }); });
  const byName = new Map();
  people.forEach(p => { const k = p.tokens.join(' '); (byName.get(k) || byName.set(k, []).get(k)).push(p); });
  byName.forEach(list => { if (list.length > 1 && list.every(p => p.phone) && new Set(list.map(p => p.phone)).size > 1) dupes.push(list); });
  return { people, siblings, dupes };
}
