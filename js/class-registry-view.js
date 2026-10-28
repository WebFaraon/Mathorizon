/* ============================================================
   Mathorizon: what a class made from a register group shows (Sumar tab of class.html)
   ============================================================
   The register (a Google Sheet, read into reg_* by the registru-sync function) is the one source of who is in the group, their status, their manager,
   when they started and left, and every presence. The platform adds only the accounts: which student account is who in the register.
   load(sb, classData) returns that picture, already derived, or null when the class has no register group (a class made by hand) or the reads fail.
   The row-level security of the reg_* tables lets a teacher read only the workbook that is his, so nothing here is a security measure.
   Plain script: window.ClassRegistryView. Used by js/class-page.js.
   ============================================================ */
(function () {
  'use strict';

  const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const PRESENT = { P: 1, G: 1 }, ABSENT = { A: 1, M: 1, B: 1 };

  const STATUS = {
    'activ': { id: 'activ', label: 'Activ', enrolled: true },
    'ora de proba': { id: 'proba', label: 'Oră de probă', enrolled: true },
    'ora de proba confirmata': { id: 'proba_ok', label: 'Probă confirmată', enrolled: true },
    'instabil': { id: 'instabil', label: 'Instabil', enrolled: true },
    'inlocuire': { id: 'inlocuire', label: 'Înlocuire', enrolled: true },
    'transferat': { id: 'plecat', label: 'Transferat', enrolled: false },
    'inactiv': { id: 'plecat', label: 'Inactiv', enrolled: false }
  };

  async function fetchAll(q) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await q().range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) return out;
    }
  }

  /* a cheap look at when the group was last written by the sync: the page polls this and reloads only when it moved */
  async function stamp(sb, groupId) {
    try {
      const { data, error } = await sb.from('reg_groups').select('synced_at, content_hash').eq('id', groupId).maybeSingle();
      if (error || !data) return null;
      return (data.synced_at || '') + '|' + (data.content_hash || '');
    } catch (e) { return null; }
  }

  async function load(sb, cls) {
    if (!cls || !cls.reg_group_id) return null;
    try {
      const gid = cls.reg_group_id;
      const [g, st, ls, mem, lnk] = await Promise.all([
        sb.from('reg_groups').select('id, workbook_id, sheet_id, tab, state, format_size, synced_at, content_hash').eq('id', gid).maybeSingle(),
        fetchAll(() => sb.from('reg_students').select('col, name, status, manager').eq('group_id', gid).order('col', { ascending: true })),
        fetchAll(() => sb.from('reg_lessons').select('row_no, iso, marks').eq('group_id', gid).order('row_no', { ascending: true })),
        sb.from('class_members').select('student_id, student_name, joined_at').eq('class_id', cls.id),
        sb.from('class_member_links').select('student_id, reg_student_name').eq('class_id', cls.id)
      ]);
      if (g.error || !g.data) return null;
      let url = null, readAt = null;
      try {
        const wb = await sb.from('reg_workbooks').select('spreadsheet_id, last_synced_at').eq('id', g.data.workbook_id).maybeSingle();
        if (wb.data) readAt = wb.data.last_synced_at || null;
        if (wb.data && wb.data.spreadsheet_id) url = 'https://docs.google.com/spreadsheets/d/' + wb.data.spreadsheet_id + '/edit#gid=' + g.data.sheet_id;
      } catch (e) { /* the link is a convenience */ }

      const linkOf = new Map(((lnk && !lnk.error && lnk.data) || []).map(x => [x.student_id, x.reg_student_name]));
      const members = (mem.error ? [] : (mem.data || [])).map(m => Object.assign({}, m, { reg_student_name: linkOf.get(m.student_id) || null }));
      const today = new Date().toISOString().slice(0, 10);
      const held = ls.filter(l => l.iso && l.iso <= today && l.marks && Object.keys(l.marks).length);
      const memberByName = new Map();
      members.forEach(m => { if (m.reg_student_name) memberByName.set(plain(m.reg_student_name), m); });

      let presentAll = 0, markedAll = 0;
      const students = st.map(s => {
        const status = STATUS[plain(s.status)] || STATUS.activ;
        const marked = held.filter(l => (l.marks || {})[s.col]);
        let p = 0, tot = 0;
        marked.forEach(l => { const m = l.marks[s.col]; if (PRESENT[m]) { p++; tot++; } else if (ABSENT[m]) tot++; });
        const lastTwo = held.slice(-2);
        const absentLastTwo = lastTwo.length === 2 && lastTwo.every(l => ABSENT[(l.marks || {})[s.col]]);
        if (status.enrolled) { presentAll += p; markedAll += tot; }
        const m = memberByName.get(plain(s.name)) || null;
        return {
          col: s.col, name: s.name, status, manager: s.manager || '',
          first: marked.length ? marked[0].iso : null, last: marked.length ? marked[marked.length - 1].iso : null,
          present: p, marked: tot, rate: tot ? Math.round(p / tot * 100) : null, absentLastTwo,
          member: m
        };
      });

      /* accounts in the class that are not tied to anybody in the register (or whose register name changed): the teacher ties them */
      const names = new Set(students.map(s => plain(s.name)));
      const loose = members.filter(m => !m.reg_student_name || !names.has(plain(m.reg_student_name)))
        .map(m => ({ student_id: m.student_id, name: m.student_name || 'Elev', joined_at: m.joined_at, lost: !!m.reg_student_name, reg_student_name: m.reg_student_name || '' }));

      const enrolled = students.filter(s => s.status.enrolled).length;
      const presentPerLesson = held.length ? held.reduce((n, l) => n + students.filter(s => s.status.enrolled && PRESENT[(l.marks || {})[s.col]]).length, 0) / held.length : null;
      return {
        group: { id: g.data.id, state: g.data.state, size: g.data.format_size || null, syncedAt: readAt || g.data.synced_at, tab: g.data.tab },
        stamp: (g.data.synced_at || '') + '|' + (g.data.content_hash || ''),
        url, students, loose, enrolled,
        lessons: { count: held.length, lastDate: held.length ? held[held.length - 1].iso : null },
        rate: markedAll ? Math.round(presentAll / markedAll * 100) : null,
        presentPerLesson,
        freeNames: students.filter(s => s.status.enrolled && !s.member).map(s => s.name)
      };
    } catch (e) {
      return null;
    }
  }

  window.ClassRegistryView = { load, stamp, plain, STATUS };
})();
