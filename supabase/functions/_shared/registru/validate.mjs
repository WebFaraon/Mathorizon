/* The checks on a parsed register. Each finding: { level: 'error' | 'warn' | 'info', code, tab, cell, msg }.
     error  the platform cannot import it as it is (an unknown value, a date that does not exist, a missing format)
     warn   it imports, but a person should look (money that does not add up, a missing phone, a lesson that is not paid)
     info   what the importer cleaned or inferred on its own
   Plain ES module (Node through require, the Supabase Edge Function through import). */
import { plain, priceFor, lessonPay, ROMAN } from './parse.mjs';

const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 0.011 : eps);
const norm = t => plain(t).replace(/[^a-z0-9]/g, '');
const SIZES = [1, 2, 3, 4, 5, 6, 8];
const DAY_NAME = ['', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
const ENROLLED = s => s && !['inactiv', 'transferat'].includes(plain(s));

export function validate(model, linked) {
  const out = [];
  const add = (level, code, tab, cell, msg) => out.push({ level, code, tab: tab || null, cell: cell || null, msg });
  const cfg = model.config, groups = model.groups;
  const inList = (list, v) => !list || !list.length || list.some(x => plain(x) === plain(v));

  /* ---- the workbook ---- */
  if (!cfg.found) add('error', 'no-config', null, null, 'Lipsește fila CONFIGURARI (listele din dropdown-uri): nu pot verifica valorile.');
  if (!model.meta.yearFrom) add('error', 'no-year', null, null, 'Numele fișierului nu spune anul școlar (ex. „… 2025-2026”): nu pot deduce anul datelor de tip „4 August”.');
  else add('info', 'year-inferred', null, null, `Datele lecțiilor nu au an. Am presupus anul școlar ${model.meta.yearFrom}-${model.meta.yearTo}: septembrie-decembrie ${model.meta.yearFrom}, ianuarie-august ${model.meta.yearTo}.`);
  if (!model.total) add('warn', 'no-total', null, null, 'Lipsește fila „Total achitări”.');
  if (!model.availability) add('warn', 'no-availability', null, null, 'Lipsește fila „Disponibilitate”.');

  /* ---- Total achitări ---- */
  if (model.total) {
    const T = model.total, tab = T.sheet;
    const listed = T.tabs.map(t => ({ name: t.name, key: norm(t.name) }));
    const matches = (g, t) => { const a = norm(g.tab), b = t.key; return a === b || (a.length >= 25 && b.startsWith(a)) || (b.length >= 25 && a.startsWith(b)); };
    const inTotal = g => listed.some(t => matches(g, t));
    groups.forEach(g => { if (!inTotal(g)) add('warn', 'not-in-total', g.tab, null, `Fila nu e în lista din „Total achitări” (rândul 4): suma ei nu intră în salariu.`); });
    listed.forEach(t => { if (!groups.some(g => matches(g, t))) add('warn', 'total-unknown-tab', tab, null, `„Total achitări” citește o filă care nu există: „${t.name}”.`); });
    T.payments.forEach(p => {
      if (p.sum == null) add('warn', 'payment-sum', tab, 'B' + p.row, `Suma plătită profesorului nu e un număr: rândul ${p.row}.`);
      if (!p.iso) add('warn', 'payment-date', tab, 'A' + p.row, `Plata către profesor are data scrisă ca „${p.dateText}” (nu e o dată): rândul ${p.row}.`);
    });
    const paid = round2(T.payments.reduce((t, p) => t + (p.sum || 0), 0));
    if (T.paidTotal != null && !near(paid, T.paidTotal, 0.5)) add('warn', 'paid-total', tab, 'E2', `Suma achitată din registru (${T.paidTotal}) diferă de suma plăților din listă (${paid}).`);
    const earned = round2(groups.filter(inTotal).reduce((t, g) => t + (g.cachedTotalPay || 0), 0));
    if (T.earnedTotal != null && !near(earned, T.earnedTotal, 1)) add('warn', 'earned-total', tab, 'E3', `„Suma pentru toate lecțiile” din registru (${T.earnedTotal}) diferă de suma grupelor din listă (${earned}).`);
  }

  /* ---- what the teacher can do ---- */
  const teaches = model.availability && model.availability.teaches;
  const slotsOf = model.availability && model.availability.slots;

  /* ---- every group ---- */
  const busy = {}, rooms = {};
  groups.forEach(g => {
    const tab = g.tab;
    if (!g.formatRaw) add('error', 'format', tab, 'A1', 'Formatul grupei (A1) e gol.');
    else if (g.size == null || !SIZES.includes(g.size)) add('error', 'format', tab, 'A1', `Formatul „${g.formatRaw}” nu e unul din cele cunoscute (1, 2, 3, 4, 5, 6 sau 8 elevi).`);
    if (!g.state) add('error', 'state', tab, 'A3', 'Starea grupei (A3) e goală.');
    else if (!inList(cfg.groupState, g.state)) add('error', 'state', tab, 'A3', `Starea „${g.state}” nu e în lista din CONFIGURARI.`);
    if (!g.subject) add('error', 'subject', tab, 'A4', 'Materia (A4) e goală.');
    else if (cfg.subject && !inList(cfg.subject, g.subject + (g.summer ? ' (Vara)' : ''))) add('warn', 'subject', tab, 'A4', `Materia „${g.subject}${g.summer ? ' (Vara)' : ''}” nu e în lista din CONFIGURARI.`);
    if (!g.grade) add('error', 'grade', tab, 'A5', 'Clasa (A5) e goală.');
    else if (!ROMAN.includes(g.grade)) add('error', 'grade', tab, 'A5', `Clasa „${g.grade}” nu e una de la I la XII.`);
    if (g.level == null) add('warn', 'level', tab, 'A6', 'Nivelul grupei nu e ales (A6 arată încă „Nivelul”).');
    const liceu = g.grade && ROMAN.indexOf(g.grade) >= 9;
    if (liceu && !g.profile) add('warn', 'profile', tab, 'A7', `Clasa ${g.grade} e de liceu, dar profilul nu e ales (A7).`);
    if (!liceu && g.profile) add('info', 'profile-extra', tab, 'A7', `Profilul „${g.profile}” e ales la clasa ${g.grade}, unde nu se folosește.`);
    g.notes.forEach(n => add('info', 'note', tab, null, n));
    if (g.flags.includes('inactiv') && plain(g.state) !== 'inactiv') add('warn', 'tab-vs-state', tab, 'A3', `Numele filei spune INACTIV, dar starea grupei e „${g.state}”.`);
    if (g.flags.includes('transferat') && plain(g.state) !== 'inactiv') add('info', 'tab-vs-state', tab, 'A3', `Numele filei spune TRANSFERAT, iar starea grupei e „${g.state}”.`);

    /* schedule */
    const days = new Set();
    if (!g.schedule.length && plain(g.state) !== 'inactiv') add('warn', 'schedule', tab, 'AA2', 'Grupa nu are orar (AA2:AC7).');
    const stubs = g.schedule.filter(sl => sl.stub);
    if (stubs.length) add('warn', 'schedule', tab, 'AA' + stubs[0].row, `Orarul are ${stubs.length} rânduri cu doar cabinet, fără zi și oră (AA${stubs[0].row}:AB${stubs[stubs.length - 1].row}).`);
    g.orphanMarks.forEach(o => add('warn', 'orphan-marks', tab, o.col + '9', `Coloana ${o.col} are ${o.count} prezențe, dar nu are elev în rândul 1: se pierd.`));
    g.schedule.filter(sl => !sl.stub).forEach(sl => {
      if (!sl.day) add('error', 'schedule', tab, 'AA' + sl.row, `Ziua „${sl.dayRaw}” nu se înțelege.`);
      else days.add(sl.day);
      if (sl.hour == null) add('error', 'schedule', tab, 'AB' + sl.row, 'Ora lipsește sau nu e o oră.');
      if (!sl.cabinet && plain(g.state) !== 'inactiv') add('warn', 'cabinet', tab, 'AC' + sl.row, 'Cabinetul lipsește.');
      else if (sl.cabinet && cfg.cabinet && !inList(cfg.cabinet, sl.cabinet)) add('warn', 'cabinet', tab, 'AC' + sl.row, `Cabinetul „${sl.cabinet}” nu e în lista din CONFIGURARI.`);
      if (plain(g.state) !== 'inactiv' && sl.day && sl.hour != null) {
        const k = `${sl.day}|${sl.hour}`;
        (busy[k] = busy[k] || []).push(tab);
        if (sl.cabinet) { const rk = `${sl.cabinet}|${k}`; (rooms[rk] = rooms[rk] || []).push(tab); }
        if (slotsOf && !(slotsOf[sl.day] || []).includes(sl.hour)) add('info', 'outside-availability', tab, 'AB' + sl.row, `${DAY_NAME[sl.day]} ${sl.hour}:00 e în afara orelor marcate „Disponibil”.`);
      }
    });
    if (teaches && g.subject && g.grade && Object.keys(teaches).length) {
      const t = teaches[g.subject];
      if (!t || !t.includes(g.grade)) add('info', 'not-in-teaches', tab, null, `${g.subject}, clasa ${g.grade} nu e bifată la „Detalii profesor”.`);
    }

    /* students */
    const live = g.students.filter(s => ENROLLED(s.status));
    if (g.size && live.length > g.size) add('warn', 'over-size', tab, null, `Sunt ${live.length} elevi activi într-o grupă de ${g.size}.`);
    if (plain(g.state) === 'inactiv' && g.students.some(s => ['activ', 'ora de proba', 'ora de proba confirmata'].includes(plain(s.status)))) add('warn', 'state-vs-students', tab, 'A3', 'Grupa e Inactivă, dar are elevi Activi sau la oră de probă.');
    if (plain(g.state) === 'activ' && g.students.length && !live.length) add('warn', 'state-vs-students', tab, 'A3', 'Grupa e Activă, dar toți elevii sunt Inactivi sau Transferați.');
    g.students.forEach(st => {
      const cell = st.colLetter + '1';
      if (st.phoneKind === 'missing') add('warn', 'phone', tab, cell, `Elevul „${st.name}” nu are telefon.`);
      else if (st.phoneKind === 'invalid') add('warn', 'phone', tab, cell, `Telefonul „${st.phoneRaw}” nu se înțelege (elevul „${st.name}”).`);
      else if (st.phoneKind === 'cleaned') add('info', 'phone-cleaned', tab, cell, `Telefonul „${st.phoneRaw}” → ${st.phone} (elevul „${st.name}”).`);
      if (st.nameNote) add('warn', 'name', tab, cell, `Numele din ${cell} are ${st.nameNote}: „${st.headerRaw.replace(/\n/g, ' / ')}”.`);
      if (!st.manager) add('warn', 'manager', tab, st.colLetter + '7', `Elevul „${st.name}” nu are manager.`);
      else if (cfg.manager && !inList(cfg.manager, st.manager)) add('error', 'manager', tab, st.colLetter + '7', `Managerul „${st.manager}” nu e în lista din CONFIGURARI.`);
      if (!st.status) add('error', 'status', tab, st.colLetter + '8', `Elevul „${st.name}” nu are statut.`);
      else if (cfg.studentStatus && !inList(cfg.studentStatus, st.status)) add('error', 'status', tab, st.colLetter + '8', `Statutul „${st.status}” nu e în lista din CONFIGURARI.`);
      [['paid', 3, 'achitări'], ['discount', 4, 'reduceri']].forEach(([k, row, lab]) => { if (st[k].bad) add('error', 'money', tab, st.colLetter + row, `La ${lab} e „${st[k].bad}”, nu un număr.`); });

      // the money, worked out again with the sheet's own rules
      let cnt = 0, any = 0;
      g.lessons.forEach(l => { const m = l.marks[st.colLetter]; if (m) { any++; if (m.code === 'P' || m.code === 'A') cnt++; } });
      const price = g.size ? priceFor(g.size) : 0;
      const cost = round2(cnt * price), sold = round2(st.paid.value + st.discount.value - cost);
      st.calc = { cost, sold, charged: cnt, marks: any };
      if (st.cached.cost != null && !near(cost, st.cached.cost, 0.5)) add('warn', 'cost', tab, st.colLetter + '5', `Costul din registru (${st.cached.cost}) diferă de calculul meu (${cost} = ${cnt} lecții × ${price}).`);
      if (st.cached.sold != null && !near(sold, st.cached.sold, 0.5)) add('warn', 'sold', tab, st.colLetter + '2', `Soldul din registru (${st.cached.sold}) diferă de calculul meu (${sold}).`);
      if (plain(st.status) === 'ora de proba' && cnt >= 2) add('warn', 'trial-too-long', tab, st.colLetter + '8', `„${st.name}” e încă la oră de probă, dar are ${cnt} lecții taxate.`);
      if (plain(st.status) === 'activ' && !any && g.lessons.length >= 3) add('info', 'active-no-marks', tab, st.colLetter + '8', `„${st.name}” e Activ, dar nu are nicio prezență în ${g.lessons.length} lecții.`);
    });

    /* lessons */
    let prev = null, outOfOrder = 0, offDays = 0, level = new Set();
    g.lessons.forEach(l => {
      const cell = 'A' + l.row;
      if (l.badDate) add('error', 'date', tab, cell, `Data „${l.dateText}” nu se înțelege (rândul ${l.row}).`);
      else if (l.iso && prev && l.iso < prev) { outOfOrder++; if (outOfOrder <= 3) add('warn', 'date-order', tab, cell, `Lecția din rândul ${l.row} (${l.iso}) e înaintea celei de dinainte (${prev}).`); }
      if (l.iso) { prev = l.iso; if (days.size && !days.has(l.weekday)) offDays++; }
      const keys = Object.values(l.marks);
      keys.forEach((m, i) => { if (!m.code) add('error', 'mark', tab, `${Object.keys(l.marks)[i]}${l.row}`, `Prezența „${m.raw}” nu e în lista din CONFIGURARI.`); });
      const paying = keys.filter(m => m.code === 'P' || m.code === 'A').length;
      const hasBoth = !!(l.dateText && l.topic);
      if (keys.length && !hasBoth) add('warn', 'unpaid-lesson', tab, 'A' + l.row, `Rândul ${l.row} are prezențe, dar ${!l.dateText ? 'nu are dată' : 'nu are temă'}: registrul nu o plătește.`);
      if (hasBoth && l.level == null) add('warn', 'teacher-level', tab, 'AA' + l.row, `Rândul ${l.row} nu are nivelul profesorului: plata iese 0.`);
      if (l.level != null) level.add(l.level);
      if (g.size && paying > g.size) add('warn', 'over-paying', tab, 'C' + l.row, `Rândul ${l.row}: ${paying} elevi taxați într-o grupă de ${g.size} (plata se calculează proporțional peste plafon: ${l.cachedPay}).`);
      if (hasBoth && g.size && l.level != null) {
        const exp = paying ? lessonPay(g.size, paying, l.level) : 0;
        if (l.cachedPay != null && !near(exp, l.cachedPay, 0.02) && paying <= g.size) add('warn', 'pay', tab, 'C' + l.row, `Rândul ${l.row}: plata din registru (${l.cachedPay}) diferă de calculul meu (${round2(exp)}).`);
      }
    });
    if (outOfOrder > 3) add('warn', 'date-order', tab, null, `Încă ${outOfOrder - 3} lecții cu data înaintea celei de dinainte.`);
    if (offDays) add('warn', 'weekday', tab, null, `${offDays} lecții au datele în zile care nu sunt în orarul grupei (poate anul presupus nu e bun, sau lecția a fost mutată).`);
    if (level.size > 1) add('info', 'teacher-level', tab, null, `Nivelul profesorului diferă între lecții: ${[...level].sort().join(', ')}.`);
  });
  Object.entries(busy).forEach(([k, tabs]) => { if (new Set(tabs).size > 1) { const [d, h] = k.split('|'); add('warn', 'double-booked', null, null, `${DAY_NAME[d]} ${h}:00: profesorul are în același timp ${[...new Set(tabs)].join(' și ')}.`); } });
  Object.entries(rooms).forEach(([k, tabs]) => { if (new Set(tabs).size > 1) { const [room, d, h] = k.split('|'); add('warn', 'room-clash', null, null, `${DAY_NAME[d]} ${h}:00, cabinetul ${room}: ${[...new Set(tabs)].join(' și ')}.`); } });

  /* ---- the people across the tabs ---- */
  if (linked) {
    linked.siblings.forEach(s => add('info', 'siblings', null, null, `Același telefon (${s.phone}), nume diferite: ${s.names.join(' / ')}. Frați?`));
    linked.dupes.forEach(list => add('warn', 'duplicate', null, null, `Același nume, telefoane diferite: „${list[0].name}” (${list.map(p => p.phone).join(', ')}).`));
    linked.people.forEach(p => {
      if (p.viaNameOnly) add('info', 'name-only', null, null, `„${p.name}” nu are telefon, e legat de celelalte file doar după nume.`);
      const live = p.enrollments.filter(e => plain(e.status) === 'activ');
      if (live.length > 1) add('warn', 'two-active', null, null, `„${p.name}” e Activ în ${live.length} grupe: ${live.map(e => e.tab).join(', ')}.`);
      p.enrollments.forEach(e => { if (plain(e.status) === 'transferat' && p.enrollments.length === 1) add('info', 'moved-nowhere', e.tab, e.colLetter + '8', `„${p.name}” e Transferat, dar nu apare în altă filă din acest registru (poate la alt profesor).`); });
    });
  }
  return out;
}

export function summarize(model, linked, issues) {
  const by = (list, f) => list.reduce((m, x) => { const k = f(x) || '(gol)'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const students = model.groups.flatMap(g => g.students);
  return {
    file: model.meta.title, teacher: model.meta.teacher, project: model.meta.project, year: model.meta.yearFrom ? `${model.meta.yearFrom}-${model.meta.yearTo}` : null,
    sheets: model.sheets.length, groups: model.groups.length, skipped: model.skipped.map(s => s.tab),
    groupStates: by(model.groups, g => g.state), groupSizes: by(model.groups, g => g.formatRaw),
    studentColumns: students.length, people: linked.people.length, studentStatuses: by(students, s => s.status),
    lessons: model.groups.reduce((t, g) => t + g.lessons.length, 0),
    marks: model.groups.reduce((t, g) => t + g.lessons.reduce((u, l) => u + Object.keys(l.marks).length, 0), 0),
    payments: model.total ? model.total.payments.length : 0,
    issues: by(issues, i => i.level)
  };
}

/* what each code means, for people */
export const TITLES = {
  'no-config': 'Lipsește CONFIGURARI', 'no-year': 'Anul școlar nu se știe', 'year-inferred': 'Anul datelor a fost presupus', 'no-total': 'Lipsește Total achitări', 'no-availability': 'Lipsește Disponibilitate',
  'not-in-total': 'Grupe care nu intră în „Total achitări”', 'total-unknown-tab': '„Total achitări” citește file care nu există', 'payment-sum': 'Plăți către profesor fără sumă', 'payment-date': 'Plăți către profesor cu data scrisă ca text',
  'paid-total': 'Suma achitată nu se potrivește', 'earned-total': 'Suma pentru lecții nu se potrivește',
  format: 'Format de grupă invalid', state: 'Starea grupei', subject: 'Materia', grade: 'Clasa', level: 'Nivel nealeș', profile: 'Liceu fără profil', 'profile-extra': 'Profil la o clasă fără profil', note: 'Alte note', 'tab-vs-state': 'Numele filei nu se potrivește cu starea grupei',
  schedule: 'Orar', cabinet: 'Cabinet', 'outside-availability': 'Orar în afara disponibilității', 'not-in-teaches': 'Materie sau clasă nebifată la „Detalii profesor”',
  'over-size': 'Prea mulți elevi pentru formatul grupei', 'state-vs-students': 'Starea grupei nu se potrivește cu elevii', phone: 'Telefoane lipsă sau neînțelese', 'phone-cleaned': 'Telefoane aduse la forma +373XXXXXXXX', name: 'Nume neobișnuite', manager: 'Manager', status: 'Statut de elev',
  money: 'Sume care nu sunt numere', cost: 'Cost diferit de calcul', sold: 'Sold diferit de calcul', 'trial-too-long': 'Oră de probă care a trecut de prima lecție', 'active-no-marks': 'Elev activ fără nicio prezență',
  date: 'Date care nu se înțeleg', 'date-order': 'Date în ordine greșită', weekday: 'Lecții în alte zile decât orarul', mark: 'Prezențe necunoscute', 'unpaid-lesson': 'Lecții cu prezențe, dar neplătite (fără dată sau temă)', 'teacher-level': 'Nivelul profesorului pe lecții',
  'over-paying': 'Mai mulți elevi taxați decât locuri', pay: 'Plata lecției diferă de calcul', 'orphan-marks': 'Prezențe fără elev', 'double-booked': 'Profesorul are două grupe în același timp', 'room-clash': 'Cabinet ocupat de două grupe',
  siblings: 'Același telefon, nume diferite', duplicate: 'Același nume, telefoane diferite', 'name-only': 'Elevi legați doar după nume', 'two-active': 'Elev Activ în mai multe grupe', 'moved-nowhere': 'Transferat fără grupă nouă în registru'
};
