/* ============================================================
   Mathorizon — Shared Catalog/Sumar stats
   Single source of truth for the aggregate numbers shown in both
   class-page.js's Catalog tab (Note + Prezență) and its Sumar tab —
   medie clasă, prezență medie, număr lecții, teme active, medie per
   elev. Neither tab should ever compute these independently; both
   call into this module so the two views can never silently drift
   apart on what counts as "active" or how an average is derived.
   ============================================================ */

(function () {
  'use strict';
  window.BM = window.BM || {};

  const CatalogStats = {};

  /* ─── Fetch ──────────────────────────────────────────────────────
     Everything loadMembriTab (Catalog) and loadSumarTab (Sumar) both
     need: members, assignments, homework submissions, simulations +
     finished attempts, and (teacher-only) attendance sessions/records.
     One round of queries, shared by both tabs. */
  async function fetchCatalogData(classId, isTeacher) {
    /* 1. Class members — try to include student_name (column may not exist yet) */
    let { data: members, error: memErr } = await BMAuth.supabase
      .from('class_members')
      .select('student_id, student_name, joined_at')
      .eq('class_id', classId)
      .order('joined_at', { ascending: true });
    if (memErr) {
      ({ data: members, error: memErr } = await BMAuth.supabase
        .from('class_members')
        .select('student_id, joined_at')
        .eq('class_id', classId)
        .order('joined_at', { ascending: true }));
      if (memErr) throw memErr;
    }
    members = members || [];

    const nameMap = {};
    members.forEach(m => { if (m.student_name) nameMap[m.student_id] = m.student_name; });

    /* Supplement names from post_reactions (covers members who joined before student_name was stored) */
    const { data: classPosts } = await BMAuth.supabase
      .from('class_posts').select('id').eq('class_id', classId);
    if (classPosts && classPosts.length > 0) {
      const postIds = classPosts.map(p => p.id);
      const { data: reactions } = await BMAuth.supabase
        .from('post_reactions').select('user_id, user_name').in('post_id', postIds);
      (reactions || []).forEach(r => {
        if (!nameMap[r.user_id] && r.user_name) nameMap[r.user_id] = r.user_name;
      });
    }

    /* 2. Assignments for this class */
    let assignQuery = BMAuth.supabase
      .from('assignments')
      .select('id, title, due_date, points, created_at, archived_at, visibility')
      .eq('class_id', classId)
      .order('due_date', { ascending: true });
    if (!isTeacher) assignQuery = assignQuery.or('visibility.eq.published,visibility.is.null');
    const { data: rawAssign, error: aErr } = await assignQuery;
    if (aErr) throw aErr;
    const assignments = rawAssign || [];

    /* 3. All submissions */
    const subMatrix = {}; /* [studentId][assignmentId] */
    if (assignments.length > 0) {
      const aIds = assignments.map(a => a.id);
      const { data: subs } = await BMAuth.supabase
        .from('homework_submissions')
        .select('assignment_id, student_id, student_name, grade, grade_confirmed, submitted_at, graded_at')
        .in('assignment_id', aIds);
      (subs || []).forEach(s => {
        if (!nameMap[s.student_id] && s.student_name) nameMap[s.student_id] = s.student_name;
        if (!subMatrix[s.student_id]) subMatrix[s.student_id] = {};
        subMatrix[s.student_id][s.assignment_id] = s;
      });
    }

    /* 4. Simulări — finished attempts merge into the same Medie averages */
    const { data: rawSims } = await BMAuth.supabase
      .from('simulations').select('id, title, status, created_at, started_at, scheduled_at').eq('class_id', classId)
      .order('created_at', { ascending: true });
    const sims = rawSims || [];

    const simMatrix = {}; /* [studentId][simulationId] — latest finalized attempt only */
    if (sims.length > 0) {
      const simIds = sims.map(s => s.id);
      const { data: simAttempts } = await BMAuth.supabase
        .from('simulation_attempts')
        .select('id, simulation_id, student_id, student_name, grade_10, status, earned_points, total_points, started_at, finished_at')
        .eq('status', 'finalizata')
        .in('simulation_id', simIds)
        .order('started_at', { ascending: true });
      (simAttempts || []).forEach(a => {
        if (!nameMap[a.student_id] && a.student_name) nameMap[a.student_id] = a.student_name;
        if (!simMatrix[a.student_id]) simMatrix[a.student_id] = {};
        simMatrix[a.student_id][a.simulation_id] = a;
      });
    }

    /* 5. Attendance (Prezență) — teacher-only. */
    let sessions = [], attMatrix = {};
    if (isTeacher) {
      const { data: rawSessions } = await BMAuth.supabase
        .from('class_sessions').select('id, session_date').eq('class_id', classId)
        .order('session_date', { ascending: true });
      sessions = rawSessions || [];

      if (sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        const { data: attRows } = await BMAuth.supabase
          .from('attendance_records').select('session_id, student_id, present').in('session_id', sessionIds);
        (attRows || []).forEach(r => {
          if (!attMatrix[r.student_id]) attMatrix[r.student_id] = {};
          attMatrix[r.student_id][r.session_id] = r.present;
        });
      }
    }

    const stats = {
      memberCount: members.length,
      assignmentCount: assignments.length,
      classAvg: classAverage(members, assignments, sims, subMatrix, simMatrix)
    };

    return { members, nameMap, assignments, subMatrix, sims, simMatrix, sessions, attMatrix, stats };
  }

  /* ─── Tiering (red/amber/green) ─────────────────────────────────── */
  function gradeTier(g) {
    if (g == null || isNaN(g)) return null;
    return g >= 7 ? 'hi' : g >= 5 ? 'mid' : 'lo';
  }

  function attendanceTier(pct) {
    if (pct == null || isNaN(pct)) return null;
    return pct >= 90 ? 'hi' : pct >= 75 ? 'mid' : 'lo';
  }

  /* ─── Medie clasă — every confirmed homework grade + finalized
     simulation grade across all students, flattened and averaged.
     Returns a "X.X"-formatted string, or null if nothing confirmed yet. */
  function classAverage(members, assignments, sims, subMatrix, simMatrix) {
    const grades = [];
    members.forEach(m => {
      assignments.forEach(a => {
        const sub = (subMatrix[m.student_id] || {})[a.id];
        if (sub?.grade_confirmed) grades.push(parseFloat(sub.grade));
      });
      sims.forEach(s => {
        const att = (simMatrix[m.student_id] || {})[s.id];
        if (att?.grade_10 != null) grades.push(parseFloat(att.grade_10));
      });
    });
    return grades.length ? (grades.reduce((t, g) => t + g, 0) / grades.length).toFixed(1) : null;
  }

  /* Per-student confirmed-grade average (assignments + simulations) —
     same "confirmed only" rule as classAverage, one student at a time. */
  function studentAverage(studentId, assignments, sims, subMatrix, simMatrix) {
    const mySubs = subMatrix[studentId] || {};
    const mySims = simMatrix[studentId] || {};
    const grades = assignments
      .map(a => (mySubs[a.id]?.grade_confirmed ? parseFloat(mySubs[a.id].grade) : null))
      .filter(g => g !== null)
      .concat(sims.map(s => mySims[s.id]?.grade_10 != null ? parseFloat(mySims[s.id].grade_10) : null).filter(g => g !== null));
    return grades.length ? grades.reduce((t, g) => t + g, 0) / grades.length : null;
  }

  /* ─── Attendance — per-student rate + class-wide average rate.
     A session counts as "recorded" for a student only if an explicit
     attendance_records row exists for them (present:true OR false) —
     an un-marked session is neither, and doesn't count against or for
     the rate. absentLastTwo flags the "missed the last 2 lecții in a
     row" case (only true if both of the two most recent sessions were
     explicitly marked absent — not just unrecorded). */
  function attendanceStats(members, sessions, attMatrix) {
    const perStudent = members.map(m => {
      const myAtt = attMatrix[m.student_id] || {};
      const recorded = sessions.filter(s => myAtt[s.id] !== undefined);
      const presentCount = recorded.filter(s => myAtt[s.id] === true).length;
      const rate = recorded.length ? Math.round((presentCount / recorded.length) * 100) : null;
      const lastTwo = sessions.slice(-2);
      const absentLastTwo = lastTwo.length === 2 && lastTwo.every(s => myAtt[s.id] === false);
      return { studentId: m.student_id, rate, presentCount, recordedCount: recorded.length, absentLastTwo };
    });
    const rateValues = perStudent.map(s => s.rate).filter(r => r != null);
    const classRate = rateValues.length
      ? Math.round(rateValues.reduce((t, v) => t + v, 0) / rateValues.length)
      : null;
    return { perStudent, classRate };
  }

  /* Average HEADCOUNT present per lesson (not a percentage) — sum of how
     many students showed up at each session, divided by the number of
     sessions. Distinct from attendanceStats().classRate (an average of
     per-student attendance RATES): this answers "how many kids typically
     show up", that answers "what fraction of the roster typically shows up". */
  function avgPresentPerLesson(members, sessions, attMatrix) {
    if (!sessions.length) return null;
    const total = sessions.reduce((sum, s) => {
      const presentCount = members.filter(m => (attMatrix[m.student_id] || {})[s.id] === true).length;
      return sum + presentCount;
    }, 0);
    return total / sessions.length;
  }

  /* ─── Lessons held — count + date of the most recent one. `sessions`
     must already be sorted ascending by session_date (every caller's
     query already does this). */
  function lessonStats(sessions) {
    return {
      count: sessions.length,
      lastDate: sessions.length ? sessions[sessions.length - 1].session_date : null
    };
  }

  /* ─── Homework — total/active/overdue + the assignments still open,
     nearest deadline first. "Active" = not archived, regardless of
     due date having passed only counts as overdue, not active; a draft
     is not a separate axis here (mirrors the pre-existing Teme sidebar
     behavior — visibility only ever hides a row from students at the
     query level, it doesn't change active/archived bookkeeping). */
  function assignmentStats(assignments) {
    const relevant = assignments.filter(a => !a.archived_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toDate = a => { const [y, m, d] = a.due_date.split('-').map(Number); return new Date(y, m - 1, d); };

    const overdue = relevant.filter(a => toDate(a) < today).length;
    const active = relevant.length - overdue;
    const upcoming = relevant
      .filter(a => toDate(a) >= today)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));

    return { total: relevant.length, active, overdue, upcoming };
  }

  /* ─── Simulations — how many are open right now, and completion
     counts for each (X of Y class members have a finalized attempt). */
  function simulationStats(sims, members, simMatrix) {
    const active = sims.filter(s => s.status === 'activa').map(s => ({
      sim: s,
      finished: members.filter(m => simMatrix[m.student_id]?.[s.id]).length,
      total: members.length
    }));
    return { activeCount: active.length, active };
  }

  CatalogStats.fetchCatalogData = fetchCatalogData;
  CatalogStats.gradeTier = gradeTier;
  CatalogStats.attendanceTier = attendanceTier;
  CatalogStats.classAverage = classAverage;
  CatalogStats.studentAverage = studentAverage;
  CatalogStats.attendanceStats = attendanceStats;
  CatalogStats.avgPresentPerLesson = avgPresentPerLesson;
  CatalogStats.lessonStats = lessonStats;
  CatalogStats.assignmentStats = assignmentStats;
  CatalogStats.simulationStats = simulationStats;

  BM.CatalogStats = CatalogStats;
})();
