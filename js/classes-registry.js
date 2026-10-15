/* ============================================================
   Mathorizon: the teacher's groups, read from the register
   ============================================================
   The register of a teacher (a Google Sheet, read into the platform's reg_* tables by the registru-sync function) is the source of his groups, students and lessons.
   load(supabase, userId) returns everything the Clase page needs about them, already shaped, or null when the account has no register linked.
   The row-level security of the reg_* tables lets a teacher read only the workbook whose owner_user_id is his, so no filter here is a security measure.
   Plain script: window.ClassesRegistry. Used by js/classes-page.js.
   ============================================================ */
(function () {
  'use strict';

  const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const DAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

  /* the minimum of enrolled students for a group to start (the same table as supabase/functions/_shared/registru/start-rule.mjs; the platform sets "Startează" by itself) */
  const START_MIN = { 2: 2, 3: 2, 4: 3, 5: 4, 6: 4, 8: 6, 10: 6 };

  const GROUP_STATUS = {
    'activ': { id: 'activ', label: 'Activ' },
    'inactiv': { id: 'inactiv', label: 'Inactiv' },
    'se completeaza': { id: 'completare', label: 'Se completează' },
    'starteaza': { id: 'starteaza', label: 'Startează' },
    'inlocuire': { id: 'inlocuire', label: 'Înlocuire' }
  };
  const STUDENT_STATUS = {
    'activ': { id: 'activ', label: 'Activ', enrolled: true },
    'ora de proba': { id: 'proba', label: 'Oră de probă', enrolled: true },
    'ora de proba confirmata': { id: 'proba_ok', label: 'Probă confirmată', enrolled: true },
    'instabil': { id: 'instabil', label: 'Instabil', enrolled: true },
    'inlocuire': { id: 'inlocuire', label: 'Înlocuire', enrolled: true },
    'transferat': { id: 'transferat', label: 'Transferat', enrolled: false },
    'inactiv': { id: 'inactiv', label: 'Inactiv', enrolled: false }
  };
  const PRESENT = { P: 1, G: 1 }, ABSENT = { A: 1, M: 1, B: 1 };

  /* all the rows of a table (the API answers at most 1000 at a time) */
  async function fetchAll(q) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await q().range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) return out;
    }
  }
  const chunks = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };

  /* the days, the first hour and the length of a group from its schedule rows (a two-hour lesson is two rows) */
  function slots(schedule) {
    const rows = (schedule || []).filter(s => s.day && s.hour != null);
    const byDay = {};
    rows.forEach(s => { (byDay[s.day] = byDay[s.day] || []).push(+s.hour); });
    const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
    if (!days.length) return { days: [], start: null, duration: 1, cab: '' };
    const hrs = byDay[days[0]].slice().sort((a, b) => a - b);
    const cab = (rows.find(s => s.cabinet) || {}).cabinet;
    return { days, start: hrs[0], duration: hrs.length, cab: cab ? String(cab) : '' };
  }

  async function load(sb, uid) {
    try {
      const wq = await sb.from('reg_workbooks').select('id,spreadsheet_id,teacher_name,last_full_sync_at,teacher_data').eq('owner_user_id', uid).eq('enabled', true);
      if (wq.error || !wq.data || !wq.data.length) return null;
      const wbs = wq.data, ids = wbs.map(w => w.id), byWb = new Map(wbs.map(w => [w.id, w]));
      const COLS = 'id,workbook_id,sheet_id,tab,format_size,state,subject,summer,grade,level,profile,schedule';
      let groups;
      try { groups = await fetchAll(() => sb.from('reg_groups').select(COLS + ',mode,price').in('workbook_id', ids).order('sheet_id', { ascending: true })); }
      catch (e) { groups = await fetchAll(() => sb.from('reg_groups').select(COLS).in('workbook_id', ids).order('sheet_id', { ascending: true })); }   // a platform without the newest migration
      const gids = groups.map(g => g.id);
      const students = [], lessons = [];
      for (const part of chunks(gids, 40)) {
        students.push(...await fetchAll(() => sb.from('reg_students').select('group_id,col,name,status').in('group_id', part).order('col', { ascending: true })));
        lessons.push(...await fetchAll(() => sb.from('reg_lessons').select('group_id,row_no,iso,topic,marks').in('group_id', part).order('row_no', { ascending: true })));
      }
      const today = new Date().toISOString().slice(0, 10);
      const stBy = new Map(), leBy = new Map();
      students.forEach(s => { (stBy.get(s.group_id) || stBy.set(s.group_id, []).get(s.group_id)).push(s); });
      lessons.forEach(l => { (leBy.get(l.group_id) || leBy.set(l.group_id, []).get(l.group_id)).push(l); });
      let held = 0, presentAll = 0, markedAll = 0;
      const list = groups.map(g => {
        const wb = byWb.get(g.workbook_id), sl = slots(g.schedule);
        const status = GROUP_STATUS[plain(g.state)] || GROUP_STATUS.activ;
        const les = (leBy.get(g.id) || []).filter(l => l.iso && l.iso <= today && l.marks && Object.keys(l.marks).length);
        const sts = (stBy.get(g.id) || []).slice().sort((a, b) => String(a.col).length - String(b.col).length || String(a.col).localeCompare(String(b.col))).map(s => {
          const st = STUDENT_STATUS[plain(s.status)] || STUDENT_STATUS.activ;
          const marks = les.slice(-8).map(l => (l.marks || {})[s.col] || '');
          let p = 0, tot = 0;
          les.forEach(l => { const m = (l.marks || {})[s.col]; if (PRESENT[m]) { p++; tot++; } else if (ABSENT[m]) tot++; });
          return { col: s.col, name: s.name, status: st, marks, rate: tot ? Math.round(p / tot * 100) : null };
        });
        let gp = 0, gt = 0;
        les.forEach(l => Object.values(l.marks).forEach(m => { if (PRESENT[m]) { gp++; gt++; } else if (ABSENT[m]) gt++; }));
        if (status.id !== 'inactiv') { held += les.length; presentAll += gp; markedAll += gt; }
        const enrolled = sts.filter(s => s.status.enrolled).length;
        return {
          id: g.id, sheetId: g.sheet_id, tab: g.tab, size: g.format_size, mode: g.mode || null, status,
          subject: g.subject || 'Grupă', grade: g.grade || '', level: g.level || '', profile: g.profile || '', summer: !!g.summer,
          days: sl.days, start: sl.start, duration: sl.duration, cab: sl.cab,
          url: wb && wb.spreadsheet_id ? 'https://docs.google.com/spreadsheets/d/' + wb.spreadsheet_id + '/edit#gid=' + g.sheet_id : null,
          students: sts, enrolled, lessons: les.length, rate: gt ? Math.round(gp / gt * 100) : null,
          need: status.id === 'completare' ? START_MIN[g.format_size] || null : null
        };
      });
      list.sort((a, b) => (a.status.id === 'inactiv') - (b.status.id === 'inactiv') || (a.days[0] || 9) - (b.days[0] || 9) || (a.start || 0) - (b.start || 0) || a.tab.localeCompare(b.tab, 'ro'));
      const live = list.filter(g => g.status.id !== 'inactiv');
      const newest = wbs.map(w => w.last_full_sync_at).filter(Boolean).sort().pop() || null;
      return {
        groups: list, syncedAt: newest, teacherName: wbs[0].teacher_name || '',
        stats: {
          groups: live.length,
          students: live.reduce((n, g) => n + g.students.filter(s => s.status.id === 'activ' || s.status.id === 'inlocuire').length, 0),
          lessons: held, rate: markedAll ? Math.round(presentAll / markedAll * 100) : null,
          perLesson: held ? presentAll / held : null
        }
      };
    } catch (e) {
      return null;                                            // the register could not be read: the page shows what it showed before
    }
  }

  /* the link to the teacher's register, at the tab "Total achitări" (the sync keeps that tab's id), or null when the account has no register linked */
  async function registerUrl(sb, uid) {
    try {
      const { data, error } = await sb.from('reg_workbooks').select('spreadsheet_id,teacher_data').eq('owner_user_id', uid).eq('enabled', true).limit(1);
      if (error || !data || !data.length || !data[0].spreadsheet_id) return null;
      const gid = data[0].teacher_data && data[0].teacher_data.totalSheetId;
      return 'https://docs.google.com/spreadsheets/d/' + data[0].spreadsheet_id + '/edit' + (gid != null ? '#gid=' + gid : '');
    } catch (e) { return null; }
  }

  window.ClassesRegistry = { load, registerUrl, DAYS };
})();
