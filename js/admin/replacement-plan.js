/* ============================================================
   Admin console: planning a replacement (docs/inlocuiri.md)
   ============================================================
   Pure functions, no browser needed (the same file is read by the console as window.AdminReplacementPlan and by scripts/check-replacements.js).
   A replacement is one lesson (or a few) of a group taught by another teacher on a chosen date: the group keeps its hour, the substitute must teach
   that subject in that class, be available then, have nothing else at that hour, and a cabinet must be free. Everything is decided from what the
   console already holds: groups (days, start, duration, room, teacher), teachers (teach, availability), rooms and the replacements already made.

     weekday(iso)                                  1 = Monday .. 7 = Sunday
     upcomingDates(group, fromIso, weeks)          the dates (>= fromIso) on which the group meets
     replacedOn(replacements, groupId, iso)        the replacement entry that takes this group's lesson on this date, or null
     teacherOptions(ctx)                           every other teacher, with ok / the reasons why not
     roomOptions(ctx)                              every cabinet, with free / who has it
     onDate(replacements, iso)                     the replaced lessons of a date: [{ rep, date }]
     dateOfWeekday(day, todayIso)                  the date of that weekday in the week of todayIso (Monday first)
   ctx = { group, dates: [iso], groups, teachers, rooms, replacements }
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AdminReplacementPlan = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const DAY_NAMES = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];
  const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const baseSubject = s => String(s || '').replace(/\s*\(vara\)\s*$/i, '').trim();
  const weekday = iso => { const d = new Date(iso + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; };
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const overlaps = (s1, d1, s2, d2) => s1 < s2 + d2 && s2 < s1 + d1;
  const live = r => r.status !== 'cancelled';
  const hh = h => String(h).padStart(2, '0') + ':00';

  function upcomingDates(g, fromIso, weeks) {
    const out = [];
    for (let i = 0; i < (weeks || 6) * 7; i++) {
      const iso = addDays(fromIso, i);
      if ((g.days || []).includes(weekday(iso))) out.push(iso);
    }
    return out;
  }

  /* the entry of a replacement that takes the lesson of this group on this date (cancelled dates do not count) */
  function replacedOn(replacements, groupId, iso) {
    for (const r of replacements || []) {
      if (!live(r) || r.base !== groupId) continue;
      const d = (r.dates || []).find(x => x.iso === iso && !x.cancelled);
      if (d) return { rep: r, date: d };
    }
    return null;
  }
  function onDate(replacements, iso) {
    const out = [];
    (replacements || []).forEach(r => { if (!live(r)) return; (r.dates || []).forEach(d => { if (d.iso === iso && !d.cancelled) out.push({ rep: r, date: d }); }); });
    return out;
  }
  function dateOfWeekday(day, todayIso) { return addDays(todayIso, day - weekday(todayIso)); }

  /* what holds a teacher or a room on this date at this hour: his own groups (unless another teacher takes that lesson that day) and the replacements he does */
  function holdersOn(ctx, iso, start, duration, skipGroupId) {
    const day = weekday(iso), out = [];
    (ctx.groups || []).forEach(g => {
      if (g.id === skipGroupId || g.status === 'inactiv' || !(g.days || []).includes(day) || !overlaps(start, duration, g.start, g.duration)) return;
      if (replacedOn(ctx.replacements, g.id, iso)) return;                         // somebody else teaches that lesson today: its teacher and room are free
      out.push({ kind: 'group', group: g, teacher: g.teacher, room: g.room });
    });
    (ctx.replacements || []).forEach(r => {
      if (!live(r)) return;
      (r.dates || []).forEach(d => {
        if (d.iso !== iso || d.cancelled || !overlaps(start, duration, d.start, d.duration)) return;
        out.push({ kind: 'replacement', rep: r, date: d, teacher: r.teacher, room: d.cabinet ? 'c' + String(d.cabinet).replace(/\D/g, '') : null });
      });
    });
    return out;
  }

  function why(ctx, t, g, dates) {
    const reasons = [];
    if (!t._wb) return ['Nu are registru legat în platformă'];
    const subject = plain(baseSubject(g.subject));
    if (!(t.teach || []).some(r => plain(baseSubject(r.subject)) === subject && (r.grades || []).includes(g.grade))) reasons.push(`Nu predă ${baseSubject(g.subject)} la clasa a ${g.grade}-a`);
    const days = [...new Set(dates.map(weekday))];
    const missing = days.filter(d => !((t.availability && t.availability[d]) || []).some(([a, b]) => g.start >= a && g.start + g.duration <= b));
    if (missing.length) reasons.push(`Nu e disponibil ${missing.map(d => DAY_NAMES[d - 1]).join(', ')} la ${hh(g.start)}`);
    const busy = [];
    dates.forEach(iso => holdersOn(ctx, iso, g.start, g.duration, g.id).forEach(h => {
      if (h.teacher !== t.id) return;
      busy.push(h.kind === 'group' ? `Are grupa de ${h.group.subject} (clasa ${h.group.grade}) la ${hh(h.group.start)}` : 'Face deja o înlocuire la ora aceea');
    }));
    return reasons.concat([...new Set(busy)]);
  }

  /* every teacher except the group's own, the ones who can take all the chosen dates first */
  function teacherOptions(ctx) {
    const g = ctx.group, dates = ctx.dates || [];
    return (ctx.teachers || []).filter(t => t.id !== g.teacher).map(t => {
      const reasons = dates.length ? why(ctx, t, g, dates) : ['Alege mai întâi datele'];
      return { teacher: t, ok: !reasons.length, reasons };
    }).sort((a, b) => (b.ok - a.ok) || String(a.teacher.name).localeCompare(String(b.teacher.name), 'ro'));
  }

  /* every cabinet: free on all the chosen dates (the group's own slot does not count: its lesson is the one being replaced) */
  function roomOptions(ctx) {
    const g = ctx.group, dates = ctx.dates || [];
    return (ctx.rooms || []).map(room => {
      const by = [];
      dates.forEach(iso => holdersOn(ctx, iso, g.start, g.duration, g.id).forEach(h => {
        if (h.room !== room.id) return;
        by.push(h.kind === 'group' ? `${h.group.subject}, clasa ${h.group.grade}` : 'o înlocuire');
      }));
      return { room, free: !by.length, by: [...new Set(by)] };
    });
  }

  return { weekday, addDays, upcomingDates, replacedOn, onDate, dateOfWeekday, teacherOptions, roomOptions, holdersOn, baseSubject, DAY_NAMES };
});
