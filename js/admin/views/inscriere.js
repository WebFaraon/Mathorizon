/* ============================================================
   Admin console: Înscriere (the enrolment desk)
   ============================================================
   A manager talks to a parent on the phone and types what is said: subject, grade, the profile (lyceum only,
   X-XII), the student's level. The list on the right shows every ACTIVE group with a free seat that fits, the same
   level first and then the nearest ones. What the parent wishes (days, hours, offline or online, a teacher) only
   narrows the list, and only when the parent asks for it.

   A group is chosen: the manager types the student's name and the parent's phone, and the student appears at once in
   the teacher's register as "Oră de probă" (the first lesson is free); he becomes "Activ" when the parent pays.

   No group fits: "Grupă nouă" lists the teachers who teach that subject and grade with the hours they can still take;
   the manager picks a teacher and a slot, and a group is created from zero with this one student ("Se completează").
   Data: AdminData.enrolCandidates / newGroupOptions / enrolStudent / undoEnrol (js/admin/mock-data.js).
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico, hh } = U;

  const KEY = 'bm_enrol_v1', MGR_KEY = 'bm_enrol_mgr';
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dayNames = g => g.days.map(d => D.DAYS[d - 1].name).join(' / ');
  const timeRange = (start, dur) => `${hh(start)}-${hh(start + dur)}`;
  const sizeLabel = n => (n === 1 ? 'Individual' : `Grup cu ${n} elevi`);
  // the formats that exist in each mode (the registers' price lists): 8 students only offline, 10 only online
  const sizesOf = project => (project === 'exo' ? [1, 2, 3, 4, 5, 6, 8] : [1, 2, 3, 4, 5, 6, 10]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (n % 100 >= 1 && n % 100 <= 19 ? many : 'de ' + many)}`;
  const CHECK = '<svg class="in-ck" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>';
  const FMT = { offline: ['exo'], online: ['exn', 'mat'] };
  const PROJ_NAME = { exo: 'Examen.md Offline', exn: 'Examen.md Online', mat: 'Matematica.md' };
  const H0 = 8, H1 = 21;

  const fresh = () => ({ subject: 'Matematica', grade: '', profile: '', levels: [], days: [], from: '', to: '', fmt: '', size: '', prof: '', filling: false, mode: 'exist', ng: { project: 'exo', size: 6, dur: 1, teacher: '', days: [], start: null, room: '' } });
  let S = fresh();
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (v && v.ng) S = Object.assign(fresh(), v); } catch (e) { /* private mode */ }
  if (!Array.isArray(S.levels)) S.levels = S.level ? [S.level] : [];
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
  let root = null, onResize = null;

  /* ---------------- what the parent said -> the query ---------------- */
  const wishes = () => (S.days.length ? 1 : 0) + (S.from !== '' || S.to !== '' ? 1 : 0) + (S.size ? 1 : 0) + (S.prof.trim() ? 1 : 0);
  const query = () => ({ subject: S.subject, grade: S.grade, profile: S.profile, level: '', days: S.days, from: S.from === '' ? null : +S.from, to: S.to === '' ? null : +S.to, project: S.fmt ? FMT[S.fmt] : null, filling: S.filling });
  const plain = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  /* the teacher search: every word typed starts a word of the name */
  const profOk = name => { const q = plain(S.prof).split(/\s+/).filter(Boolean); if (!q.length) return true; const w = plain(name).split(/\s+/); return q.every(x => w.some(y => y.startsWith(x))); };
  const ready = () => !!(S.subject && S.grade && S.fmt && S.levels.length);        // the format (Offline / Online) is part of who the student is, not a wish
  /* the project of a new group follows the format chosen at the top: offline is Examen.md Offline; online only asks which online project */
  const ngProject = () => (S.fmt === 'offline' ? 'exo' : S.fmt === 'online' ? (S.ng.project === 'mat' ? 'mat' : 'exn') : 'exo');
  function syncNg() {
    const p = ngProject();
    if (S.ng.project !== p) { S.ng.project = p; S.ng.teacher = ''; S.ng.days = []; S.ng.start = null; S.ng.room = ''; }
    if (!sizesOf(S.ng.project).includes(S.ng.size)) S.ng.size = 6;
    if (S.size && !sizesOf(S.ng.project).includes(+S.size)) S.size = '';
  }
  const ngLevel = () => (S.levels.includes(S.ng.level) ? S.ng.level : S.levels[0] || '');
  const sizeOpts = () => opt('', 'Oricare', S.size) + sizesOf(ngProject()).map(n => opt(String(n), n === 1 ? 'Individual' : n + ' elevi', S.size)).join('');
  // only the chip that was just chosen plays the pop: the whole pane is drawn again, and every chip that is on would play it too
  const popTo = sel => { if (calm()) return; const el = root.querySelector(sel); if (el) el.classList.add('is-pop'); };
  const lyceum = () => !!S.grade && D.needsProfile(S.grade);

  /* ---------------- the filters on the left: a fixed rail of dropdowns ---------------- */
  const opt = (v, label, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(label)}</option>`;
  function railHTML() {
    const hourOpts = (cur, any) => opt('', any, cur) + Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i).map(h => opt(h, hh(h), cur)).join('');
    return `
      <div class="ax-rail__head"><b>Informații generale</b></div>
      <div class="in-fl"><span class="ax-rail__lbl" id="inLs">Materia</span><select class="ax-select" data-k="subject" aria-labelledby="inLs">${D.SUBJECTS.map(x => opt(x, x, S.subject)).join('')}</select></div>
      <div class="in-fl"><span class="ax-rail__lbl" id="inLg">Clasa</span><select class="ax-select" data-k="grade" aria-labelledby="inLg">${opt('', 'Alege clasa', S.grade)}${D.GRADES.map(x => opt(x, 'Clasa ' + x, S.grade)).join('')}</select></div>
      <div class="in-prof${lyceum() ? ' is-open' : ''}" id="inProf"><div><div class="in-fl"><span class="ax-rail__lbl" id="inLp">Profilul <small>liceu</small></span><select class="ax-select" data-k="profile" aria-labelledby="inLp">${opt('', 'Alege profilul', S.profile)}${['Real', 'Uman'].map(x => opt(x, x, S.profile)).join('')}</select></div></div></div>
      <div class="in-fl"><span class="ax-rail__lbl" id="inLm">Formatul</span><select class="ax-select" data-k="fmt" aria-labelledby="inLm">${opt('', 'Alege formatul', S.fmt)}${opt('offline', 'Offline', S.fmt)}${opt('online', 'Online', S.fmt)}</select></div>
      <div data-ms="levels"></div>
      <div class="ax-rail__sep"></div>
      <div class="ax-rail__head"><b>Informații suplimentare</b></div>
      <p class="in-note">Le folosești doar dacă părintele le cere.</p>
      <div data-ms="days"></div>
      <div class="in-row">
        <div class="in-fl"><span class="ax-rail__lbl" id="inLf">De la ora</span><select class="ax-select" data-k="from" aria-labelledby="inLf">${hourOpts(S.from, 'Oricând')}</select></div>
        <div class="in-fl"><span class="ax-rail__lbl" id="inLt">Până la ora</span><select class="ax-select" data-k="to" aria-labelledby="inLt">${hourOpts(S.to, 'Oricând')}</select></div>
      </div>
      <div class="in-fl"><span class="ax-rail__lbl" id="inLz">Mărimea grupei</span><select class="ax-select" data-k="size" aria-labelledby="inLz">${sizeOpts()}</select></div>
      <div class="in-fl"><span class="ax-rail__lbl">Profesorul</span><div class="ax-search">${ico('search', 16)}<input id="inProfQ" class="ax-input" type="search" autocomplete="off" placeholder="Nume profesor" aria-label="Profesorul" value="${esc(S.prof)}"></div></div>
      <button type="button" class="in-clear" data-clear-wish hidden>Șterge dorințele</button>
      <button type="button" class="in-reset" data-reset>${ico('undo', 16)} Începe de la zero</button>`;
  }
  /* what changes when a dropdown changes, without redrawing the rail (so the open ones stay open) */
  function syncRail() {
    const rail = root.querySelector('#inRail'); if (!rail) return;
    rail.querySelector('#inProf').classList.toggle('is-open', lyceum());
    const c = rail.querySelector('[data-clear-wish]'), n = wishes();
    c.hidden = !n; c.textContent = n ? `Șterge dorințele (${n})` : 'Șterge dorințele';
  }
  function buildRail() {
    const rail = root.querySelector('#inRail');
    rail.innerHTML = railHTML();
    const days = U.multiSelect({ id: 'in-days', label: 'Zilele în care poate', options: D.DAYS.map(d => ({ value: String(d.id), label: d.name })), selected: S.days.map(String), onChange: v => { S.days = v.map(Number); save(); syncRail(); paintPane(true); } });
    rail.querySelector('[data-ms="days"]').replaceWith(days);
    const lv = U.multiSelect({ id: 'in-levels', label: 'Nivelul', options: D.LEVELS.map(x => ({ value: x, label: 'Nivel ' + x })), selected: S.levels, onChange: v => { S.levels = v; save(); syncRail(); paintPane(true); } });
    rail.querySelector('[data-ms="levels"]').replaceWith(lv);
    U.suggest(rail.querySelector('#inProfQ'), () => D.teachers.filter(t => t.subjects.includes(S.subject)).map(t => t.name).sort((a, b) => a.localeCompare(b, 'ro')));
    let tm = 0;
    rail.querySelector('#inProfQ').addEventListener('input', e => { S.prof = e.target.value; clearTimeout(tm); tm = setTimeout(() => { save(); syncRail(); paintPane(true); }, 140); });
    syncRail();
  }
  function wireRail() {
    const rail = root.querySelector('#inRail');
    rail.addEventListener('change', e => {
      const sel = e.target.closest('select[data-k]'); if (!sel) return;
      const k = sel.dataset.k;
      S[k] = sel.value;
      if (k === 'fmt') { syncNg(); const sz = rail.querySelector('select[data-k="size"]'); if (sz) sz.innerHTML = sizeOpts(); }
      if (k === 'size' && sel.value) S.ng.size = +sel.value;                 // a group of that size is also what a new group is made as
      if (k === 'subject') { S.ng.teacher = ''; S.ng.days = []; S.ng.start = null; }
      if (k === 'grade') { if (!lyceum()) S.profile = ''; S.ng.teacher = ''; S.ng.days = []; S.ng.start = null; }
      save(); syncRail(); paintPane(true);
    });
    rail.addEventListener('click', e => {
      if (e.target.closest('[data-clear-wish]')) { Object.assign(S, { days: [], from: '', to: '', size: '', prof: '' }); save(); buildRail(); paintPane(true); return; }
      if (e.target.closest('[data-reset]')) { S = fresh(); save(); buildRail(); paintPane(true); }
    });
  }

  /* ---------------- the right side ---------------- */
  const tabsHTML = () => `
    <div class="in-tabs" role="tablist" aria-label="Unde îl punem">
      <button type="button" class="in-tab" role="tab" data-mode="exist" aria-selected="true">Grupe existente <b id="inN" hidden></b></button>
      <button type="button" class="in-tab" role="tab" data-mode="new" aria-selected="false">Grupă nouă</button>
      <span class="in-ink" id="inInk" aria-hidden="true"></span>
    </div>`;

  function prompt() {
    return `<div class="in-empty in-empty--start"><span class="in-empty__ic" aria-hidden="true">${ico('user-plus', 28)}</span><b>Începe cu datele elevului</b><span>Alege materia, clasa, formatul (Offline sau Online) și nivelul (poți alege mai multe), iar grupele active care se potrivesc apar aici.</span></div>`;
  }

  function groupCard(c, i) {
    const g = c.g, t = D.teacher(g.teacher), room = g.room ? D.room(g.room) : null;
    const seats = Array.from({ length: g.size }, (_, k) => `<i class="${k < g.size - c.free ? 'on' : ''}"></i>`).join('');
    const lvl = `<span class="in-b in-b--ok">Nivel ${esc(g.level)}</span>`;
    return `
      <button type="button" class="in-gc" data-enrol="${g.id}" style="--i:${i}" aria-label="${esc(`${t.name}, ${dayNames(g)} ${timeRange(g.start, g.duration)}, ${c.free} ${c.free === 1 ? 'loc liber' : 'locuri libere'}. Înscrie aici.`)}">
        <span class="in-gc__when"><b>${esc(dayNames(g))}</b><span>${timeRange(g.start, g.duration)}</span></span>
        <span class="in-gc__room">${room ? `<span class="or-room or-room--sm" title="${esc(room.name)}"><small>Cab.</small>${room.num}</span>` : `<span class="ax-tag${U.noRoom(g).online ? '' : ' ax-tag--warn'}">${U.noRoom(g).label}</span>`}</span>
        <span class="in-gc__main">
          <b>${esc(t.name)}</b>
          <span>${esc(g.subject)}, clasa ${esc(g.grade)}${g.profile ? ', ' + esc(g.profile) : ''} <span class="ax-line ax-line--${g.project}">${esc(D.project(g.project).short)}</span></span>
          <span class="in-badges">${lvl}${g.status === 'completare' ? '<span class="in-b in-b--fill">Se completează</span>' : g.status === 'starteaza' ? '<span class="in-b in-b--start">Startează</span>' : ''}${c.pop === 0 ? '<span class="in-b">Fără elevi încă</span>' : ''}</span>
        </span>
        <span class="in-gc__seat"><span class="ax-seats" aria-hidden="true">${seats}</span><em>${c.free === 1 ? '1 loc liber' : c.free + ' locuri libere'}</em><small>${sizeLabel(g.size)}</small></span>
        <span class="in-gc__go" aria-hidden="true">Înscrie aici ${ico('arrow-right', 16)}</span>
      </button>`;
  }

  function existHTML(list) {
    if (!ready()) return prompt();
    const hint = lyceum() && !S.profile ? `<p class="in-hint">${ico('alert', 16)} E liceu: alege și profilul, ca să vezi doar grupele potrivite.</p>` : '';
    const top = `
      <div class="in-reshead">
        <p class="in-count" aria-live="polite"><b>${list.length}</b> ${list.length === 1 ? 'grupă activă potrivită' : 'grupe active potrivite'}</p>
        <button type="button" class="in-tg" data-filling aria-pressed="${S.filling}"><span class="in-sw" aria-hidden="true"></span>Și grupele care se completează</button>
      </div>
      <p class="in-sub">Nivel ${esc(S.levels.slice().sort().join(' și '))}</p>${hint}`;
    if (!list.length) {
      return top + `<div class="in-empty"><span class="in-empty__ic" aria-hidden="true">${ico('search-x', 28)}</span><b>Nicio grupă activă nu se potrivește${wishes() ? ' cu aceste dorințe' : ''}.</b><span>${wishes() ? 'Relaxează o dorință a părintelui sau creează o grupă nouă.' : 'Poți crea o grupă nouă, cu elevul ăsta, la un profesor care are timp.'}</span>
        <div class="in-empty__k">${wishes() ? '<button type="button" class="ax-btn" data-clear-wish>Șterge dorințele</button>' : ''}<button type="button" class="ax-btn ax-btn--primary" data-mode="new">${ico('plus', 16)} Creează o grupă nouă</button></div></div>`;
    }
    return top + `<div class="in-list">${list.map(groupCard).join('')}</div>
      <p class="in-foot">Nu găsești ce îi convine părintelui? <button type="button" class="ax-link" data-mode="new">Creează o grupă nouă</button></p>`;
  }

  /* ---- a new group: pick a teacher and a free slot ---- */
  function gridHTML(o) {
    const dur = S.ng.dur, free = o.free;
    const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
    const ok = (d, h) => { for (let x = h; x < h + dur; x++) if (!free[d].includes(x)) return false; return true; };
    const pref = (d, h) => (!S.days.length || S.days.includes(d)) && (S.from === '' || h >= +S.from) && (S.to === '' || h + dur <= +S.to) && (S.days.length || S.from !== '' || S.to !== '');
    return `<div class="in-grid-wrap"><table class="in-grid" aria-label="Orele libere ale profesorului">
      <thead><tr><th></th>${hours.map(h => `<th scope="col">${String(h).padStart(2, '0')}</th>`).join('')}</tr></thead>
      <tbody>${D.DAYS.map(d => `<tr><th scope="row">${esc(d.short)}</th>${hours.map(h => {
        const can = ok(d.id, h), sel = S.ng.start === h && S.ng.days.includes(d.id);
        return `<td><button type="button" class="in-cell${can ? '' : ' is-off'}${sel ? ' is-sel' : ''}${can && pref(d.id, h) ? ' is-pref' : ''}" data-cell data-d="${d.id}" data-h="${h}"${can ? '' : ' disabled'} aria-pressed="${sel}" aria-label="${esc(d.name + ' ' + hh(h) + (can ? '' : ', ocupat'))}"></button></td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  /* The cabinets for a new group at the chosen days and hour: which are free, which are taken (and by whom), which are too small, and the one that fits best
     (the smallest free cabinet with room for everybody, so a group of two does not take a cabinet of ten). `chosen` is the person's pick while it is still valid. */
  function roomPlan() {
    const days = S.ng.days.slice().sort(), start = S.ng.start, dur = S.ng.dur, size = S.ng.size;
    if (S.ng.project !== 'exo' || start == null || !days.length) return null;
    const holders = id => D.groups.filter(g => g.status !== 'inactiv' && g.room === id && g.days.some(d => days.includes(d)) && g.start < start + dur && start < g.start + g.duration);
    const opts = D.rooms.map(r => {
      const by = holders(r.id).map(g => `${D.teacher(g.teacher).name}, ${g.subject} ${g.grade}, ${dayNames(g)} ${timeRange(g.start, g.duration)}`);
      return { r, free: !by.length, by, fits: r.seats >= size, set: r.seatsSet !== false };
    });
    const usable = opts.filter(o => o.free && o.fits);
    const best = usable.slice().sort((a, b) => a.r.seats - b.r.seats || a.r.num - b.r.num)[0] || null;
    const chosen = opts.find(o => o.r.id === S.ng.room && o.free && o.fits) || null;          // nothing is picked for the manager: no cabinet is the usual answer
    return { opts, best, chosen, size, anyUnset: opts.some(o => !o.set) };
  }
  function roomsHTML(plan) {
    if (!plan) return '';
    const { opts, best, chosen, size } = plan;
    const chip = o => {
      const sel = chosen && chosen.r.id === o.r.id, state = !o.free ? 'ocupat' : !o.fits ? 'prea mic' : best && best.r.id === o.r.id ? 'se potrivește' : 'liber';
      const why = !o.free ? `Ocupat în aceste ore: ${o.by.join('; ')}` : !o.fits ? `Are ${o.r.seats} locuri, grupa are ${size}` : '';
      return `<button type="button" class="in-rm${sel ? ' is-on' : ''}${!o.free || !o.fits ? ' is-off' : ''}${best && best.r.id === o.r.id ? ' is-best' : ''}" data-room="${o.r.id}" role="radio" aria-checked="${sel}" ${o.free && o.fits ? '' : 'disabled'}${why ? ` title="${esc(why)}"` : ''}>
        <b>${o.r.num}</b><span class="in-rm__s">${o.r.seats} ${o.r.seats === 1 ? 'loc' : 'locuri'}${o.set ? '' : '?'}</span><small>${state}</small></button>`;
    };
    const none = `<button type="button" class="in-rm in-rm--none${!chosen ? ' is-on' : ''}" data-room="" role="radio" aria-checked="${!chosen}"><b>Fără</b><span class="in-rm__s">cabinet</span><small>îl alege directorul</small></button>`;
    const spare = chosen && chosen.set ? chosen.r.seats - size : 0;
    const note = !chosen
      ? (best ? `<p class="in-rm__note">${ico('info', 16)} <span>Poți lăsa grupa fără cabinet: directorul îl atribuie în Repartizare, unde vede ce e liber.</span></p>`
        : `<p class="in-rm__note is-warn">${ico('alert', 16)} <span>Niciun cabinet liber la ora aceasta nu are ${size === 1 ? 'un loc' : size + ' locuri'}. Poți crea grupa fără cabinet: directorul îl atribuie în Repartizare.</span></p>`)
      : spare >= 3 ? `<p class="in-rm__note is-warn">${ico('alert', 16)} <span>Cabinetul ${chosen.r.num} are ${chosen.r.seats} locuri pentru ${size === 1 ? 'un elev' : size + ' elevi'}: ${spare} locuri rămân goale cât timp grupa ține cabinetul.${best && best.r.id !== chosen.r.id && best.r.seats < chosen.r.seats ? ` Cabinetul ${best.r.num} (${best.r.seats} locuri) e liber la ora aceasta.` : ''}</span></p>`
      : '';
    const unset = plan.anyUnset ? `<p class="in-rm__hint">Pentru cabinetele cu <b>?</b> nu se știe câte locuri au (acum 8). <button type="button" class="ax-link" data-rooms>Setează capacitățile</button></p>` : '';
    return `<section class="in-rooms" aria-label="Cabinetul grupei">
      <h3 class="in-rooms__h">Cabinetul <em class="in-opt">opțional</em> <small>pentru ${size === 1 ? 'un elev' : size + ' elevi'}, ${esc(S.ng.days.slice().sort().map(d => D.DAYS[d - 1].name).join(' / '))}, ${timeRange(S.ng.start, S.ng.dur)}</small></h3>
      <div class="in-rm__grid" role="radiogroup" aria-label="Cabinete">${none}${opts.map(chip).join('')}</div>
      ${note}${unset}
    </section>`;
  }

  function newHTML() {
    if (!ready()) return prompt();
    syncNg();
    const opts = D.newGroupOptions({ subject: S.subject, grade: S.grade, project: S.ng.project }).filter(o => profOk(o.t.name));
    const sel = opts.find(o => o.t.id === S.ng.teacher);
    const offline = S.ng.project === 'exo';
    const picked = sel && S.ng.start != null && S.ng.days.length;
    const plan = picked && offline ? roomPlan() : null;
    const room = plan && plan.chosen ? plan.chosen.r.id : null;
    const needProf = lyceum() && !S.profile;
    const need = S.ng.dur === 1 ? 2 : 1, complete = S.ng.days.length === need;
    const bar = picked ? `
      <div class="in-dock is-on">
        <p class="in-dock__t"><b>${esc(sel.t.name)}</b>, ${esc(S.ng.days.slice().sort().map(d => D.DAYS[d - 1].name).join(' / '))}, ${timeRange(S.ng.start, S.ng.dur)}${offline ? (room ? `, cabinetul ${D.room(room).num}` : ', fără cabinet') : ', online'}<span>${esc(sizeLabel(S.ng.size))}, clasa ${esc(S.grade)}${S.profile && lyceum() ? ', ' + esc(S.profile) : ''}${ngLevel() ? ', nivel ' + esc(ngLevel()) : ''}</span></p>
        <button type="button" class="ax-btn ax-btn--primary in-dock__go" data-create ${!complete || needProf ? 'disabled' : ''}>${ico('plus', 16)} ${needProf ? 'Alege întâi profilul' : !complete ? 'Alege și a doua zi, la aceeași oră' : 'Creează grupa și înscrie elevul'}</button>
      </div>` : '';
    return `
      <p class="in-sub">Grupă nouă: alege profesorul și ora.</p>
      <div class="in-ng">
        ${S.levels.length > 1 ? `<div class="in-f"><span class="in-l">Nivelul grupei noi</span><div class="in-chips" role="radiogroup" aria-label="Nivelul grupei">${S.levels.slice().sort().map(l => `<button type="button" class="in-chip${ngLevel() === l ? ' is-on' : ''}" data-ngl="${esc(l)}" role="radio" aria-checked="${ngLevel() === l}">Nivel ${esc(l)}</button>`).join('')}</div></div>` : ''}
        ${S.fmt === 'online' ? `<div class="in-f"><span class="in-l">Proiectul</span><div class="in-chips" role="radiogroup" aria-label="Proiectul">${['exn', 'mat'].map(p => `<button type="button" class="in-chip${S.ng.project === p ? ' is-on' : ''}" data-ngp="${p}" role="radio" aria-checked="${S.ng.project === p}">${esc(PROJ_NAME[p])}</button>`).join('')}</div></div>` : ''}
        <div class="in-f"><span class="in-l">Câți elevi va avea</span><div class="in-chips in-chips--n" role="radiogroup" aria-label="Dimensiunea">${sizesOf(S.ng.project).map(n => `<button type="button" class="in-chip${S.ng.size === n ? ' is-on' : ''}" data-ngs="${n}" role="radio" aria-checked="${S.ng.size === n}">${n === 1 ? 'Individual' : n}</button>`).join('')}</div></div>
        <div class="in-f"><span class="in-l">Durata unei lecții</span><div class="in-chips" role="radiogroup" aria-label="Durata">${[1, 2].map(n => `<button type="button" class="in-chip${S.ng.dur === n ? ' is-on' : ''}" data-ngd="${n}" role="radio" aria-checked="${S.ng.dur === n}">${n === 1 ? 'O oră, în două zile' : 'Două ore, într-o zi'}</button>`).join('')}</div></div>
      </div>
      <div class="in-reshead"><p class="in-count"><b>${opts.length}</b> ${opts.length === 1 ? 'profesor are timp' : 'profesori au timp'}</p></div>
      ${opts.length ? `<ul class="in-teachers">${opts.map((o, i) => `
        <li class="in-tc${o.t.id === S.ng.teacher ? ' is-open' : ''}" style="--i:${i}">
          <button type="button" class="in-tc__h" data-ngt="${o.t.id}" aria-expanded="${o.t.id === S.ng.teacher}">
            <span class="in-tc__who"><b>${esc(o.t.name)}</b><span>${esc(o.t.subjects.join(', '))}${o.hasGroups ? '' : ' · fără grupe încă'}</span></span>
            <span class="in-tc__days" aria-hidden="true">${D.DAYS.map(d => `<i class="${o.free[d.id].length ? 'on' : ''}" title="${esc(d.name)}: ${o.free[d.id].length} ore libere"><em>${esc(d.short[0])}</em></i>`).join('')}</span>
            <span class="in-tc__n"><b>${o.total}</b> ore libere pe săptămână</span>
            <span class="in-tc__chev" aria-hidden="true">${ico('chevron-down', 18)}</span>
          </button>
          <div class="in-tc__b"><div>${o.t.id === S.ng.teacher ? `<p class="in-tc__hint">${S.ng.dur === 1 ? 'Alege aceeași oră în două zile.' : 'Alege ziua și prima oră.'} Cu punct: dorința părintelui.</p>${gridHTML(o)}${roomsHTML(plan)}` : ''}</div></div>
        </li>`).join('')}</ul>` : `<div class="in-empty"><span class="in-empty__ic" aria-hidden="true">${ico('search-x', 28)}</span><b>Niciun profesor nu are ore libere pentru asta.</b><span>Încearcă alt format sau scoate profesorul ales din dorințele părintelui.</span></div>`}
      ${bar}`;
  }

  /* ---------------- painting ---------------- */
  let lastN = -1;
  function paintPane(animate) {
    const list = ready() ? D.enrolCandidates(query()).filter(c => S.levels.includes(c.g.level) && profOk(D.teacher(c.g.teacher).name) && (!S.size || c.g.size === +S.size)) : [];
    root.querySelectorAll('.in-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === S.mode)));
    const nb = root.querySelector('#inN'); nb.hidden = !ready(); nb.textContent = list.length;
    const pane = root.querySelector('#inPane');
    const keep = pane.scrollTop;
    pane.innerHTML = S.mode === 'exist' ? existHTML(list) : newHTML();
    pane.classList.toggle('is-still', !animate);
    pane.scrollTop = keep;
    moveInk();
    if (ready() && lastN !== list.length) { nb.classList.remove('bump'); void nb.offsetWidth; nb.classList.add('bump'); }
    lastN = list.length;
  }
  function moveInk() {
    const ink = root.querySelector('#inInk'), on = root.querySelector('.in-tab[aria-selected="true"]');
    if (!ink || !on) return;
    ink.style.width = '100px';
    ink.style.transform = `translateX(${on.offsetLeft}px) scaleX(${on.offsetWidth / 100})`;
  }
  const paintAll = animate => { syncRail(); paintPane(animate); };

  /* ---------------- the dialog: who is the student ---------------- */
  function openEnrol(target) {
    if (D.readOnly() && target.fresh && !(D.teacher(target.fresh.teacher) || {})._wb) { U.toast('Profesorul acestei grupe nu are un registru legat: grupa nouă nu se poate crea în registru.', 'warn'); return; }
    const mine = target.group ? D.group(target.group) : null;
    const fieldsG = target.fresh;                       // a group to be created
    const g = mine || fieldsG;
    if (!g) return;
    const t = D.teacher(g.teacher);
    const room = g.room ? D.room(g.room) : null;
    let mgr = ''; try { mgr = localStorage.getItem(MGR_KEY) || ''; } catch (e) { /* private mode */ }
    if (!D.manager(mgr)) mgr = D.managers[0].id;
    const dlg = document.createElement('dialog');
    dlg.className = 'in-dlg';
    dlg.setAttribute('aria-labelledby', 'inDT');
    document.body.appendChild(dlg);
    const st = { last: '', first: '', phone: '', mgr, touched: {}, done: null };
    const free = mine ? D.freeSeats(mine) : g.size;
    const seatsHTML = (extra) => Array.from({ length: g.size }, (_, k) => `<i class="${k < g.size - free ? 'on' : (extra && k === g.size - free) ? 'new' : ''}"></i>`).join('');
    const days = (g.days || []).slice().sort().map(d => D.DAYS[d - 1].name).join(' / ');
    const solo = g.size === 1;
    const groupBlock = (extra) => `
      <div class="in-sum">
        <span class="in-sum__tag${mine ? '' : ' is-new'}">${mine ? 'Grupă existentă' : 'Grupă nouă'}</span>
        <p class="in-sum__t"><b>${esc(t.name)}</b></p>
        <p class="in-sum__l">${esc(days)}, ${timeRange(g.start, g.duration)}${room ? `, cabinetul ${room.num}` : g.project === 'exo' ? ', fără cabinet' : ', online'}</p>
        <p class="in-sum__l">${esc(g.subject)}, clasa ${esc(g.grade)}${g.profile ? ', ' + esc(g.profile) : ''}${g.level ? ', nivel ' + esc(g.level) : ''}</p>
        <p class="in-sum__s"><span class="ax-seats" aria-hidden="true">${seatsHTML(extra)}</span> ${esc(sizeLabel(g.size))}${mine ? `, ${free === 1 ? '1 loc liber' : free + ' locuri libere'}` : solo ? ', activă de la prima lecție' : ', se completează'}</p>
      </div>`;
    const errs = () => {
      const e = {};
      if (st.last.trim().length < 2) e.last = 'Scrie numele de familie.';
      if (st.first.trim().length < 2) e.first = 'Scrie prenumele.';
      if (!/^[67]\d{7}$/.test(st.phone)) e.phone = 'Numărul are 8 cifre și începe cu 6 sau 7.';
      return e;
    };
    const fmtPhone = d => d.replace(/(\d{2})(\d{0,3})(\d{0,3})/, (m, a, b, c) => [a, b, c].filter(Boolean).join(' '));
    const field = (k, label, ph, extra) => `<label class="in-fld"><span>${label}</span><input type="text" data-f="${k}" value="${esc(st[k])}" placeholder="${ph}" autocomplete="off" ${extra || ''}><small class="in-err" data-err="${k}" role="alert"></small></label>`;
    function formHTMLd() {
      return `
        <header class="in-dlg__h"><span class="in-dlg__ic" aria-hidden="true">${ico('user-plus', 22)}</span><div><span class="in-dlg__e">${mine ? 'Înscriere în grupă' : 'Grupă nouă'}</span><h2 id="inDT">Cine e elevul?</h2></div><button type="button" class="ax-icon-btn in-dlg__x" data-x aria-label="Închide">${ico('x', 18)}</button></header>
        <div class="in-dlg__b">
          ${groupBlock(false)}
          <form class="in-form" id="inEF" novalidate>
            <div class="in-two">${field('last', 'Nume', 'ex. Popescu', 'autocapitalize="words"')}${field('first', 'Prenume', 'ex. Maria', 'autocapitalize="words"')}</div>
            <label class="in-fld"><span>Telefonul părintelui</span><span class="in-ph"><i>+373</i><input type="tel" inputmode="numeric" data-f="phone" value="${esc(fmtPhone(st.phone))}" placeholder="69 123 456" autocomplete="off" maxlength="10"></span><small class="in-err" data-err="phone" role="alert"></small><small class="in-dup" id="inDup" hidden></small></label>
            <label class="in-fld in-fld--sel"><span>Managerul</span><select class="ax-select" data-f="mgr">${D.managers.map(m => `<option value="${m.id}"${m.id === st.mgr ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
            <div class="in-info">
              <p>${ico('info', 16)}${solo ? '<span><b>Lecția individuală nu are oră de probă.</b> Elevul apare în registrul profesorului cu statutul <em>Activ</em>, iar decontarea începe de la prima lecție.</span>' : '<span><b>Prima lecție e gratuită.</b> Elevul apare acum în registrul profesorului cu statutul <em>Oră de probă</em>. Când părintele plătește, statutul devine <em>Activ</em>.</span>'}</p>
              <p class="in-chips-s"><span>Clasa ${esc(g.grade)}</span>${g.profile ? `<span>${esc(g.profile)}</span>` : ''}${g.level ? `<span>Nivel ${esc(g.level)}</span>` : ''}<span>${esc(g.subject)}</span></p>
            </div>
            <p class="in-werr" id="inErr" role="alert"></p>
          </form>
        </div>
        <footer class="in-dlg__f"><span class="in-dlg__s" id="inSum"></span><button type="button" class="ax-btn" data-x>Renunță</button><button type="submit" form="inEF" class="ax-btn ax-btn--primary in-go" id="inGo" disabled>${ico('user-plus', 16)} Înscrie elevul</button></footer>`;
    }
    function showErrors(all) {
      const e = errs();
      dlg.querySelectorAll('[data-err]').forEach(el => {
        const k = el.dataset.err, on = e[k] && (all || st.touched[k]);
        el.textContent = on ? e[k] : '';
        el.closest('.in-fld').classList.toggle('has-err', !!on);
      });
      const ok = !Object.keys(e).length;
      const go = dlg.querySelector('#inGo'); if (go) go.disabled = !ok;
      const sum = dlg.querySelector('#inSum'); if (sum) sum.textContent = ok ? `${st.last.trim()} ${st.first.trim()} · +373 ${fmtPhone(st.phone)}` : 'Completează numele și telefonul.';
    }
    function dupHint() {
      const el = dlg.querySelector('#inDup'); if (!el) return;
      const hit = /^[67]\d{7}$/.test(st.phone) ? D.students.find(s => s.phone === '+373' + st.phone) : null;
      el.hidden = !hit;
      if (hit) { const hg = hit.group ? D.group(hit.group) : null; el.textContent = `Același număr are deja: ${hit.name}${hg ? ' (' + hg.subject + ', clasa ' + hg.grade + ')' : ''}. Poate e un frate sau o soră.`; }
    }
    const cap = v => v.replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
    function wireForm() {
      dlg.querySelectorAll('input[data-f]').forEach(inp => {
        inp.addEventListener('input', () => {
          const k = inp.dataset.f;
          if (k === 'phone') { st.phone = inp.value.replace(/\D/g, '').slice(0, 8); inp.value = fmtPhone(st.phone); dupHint(); }
          else st[k] = inp.value;
          showErrors(false);
        });
        inp.addEventListener('blur', () => {
          const k = inp.dataset.f; st.touched[k] = true;
          if (k !== 'phone') { st[k] = cap(st[k].trim()); inp.value = st[k]; }
          showErrors(false);
        });
      });
      dlg.querySelector('select[data-f="mgr"]').addEventListener('change', e => { st.mgr = e.target.value; });
      dlg.querySelector('#inEF').addEventListener('submit', ev => { ev.preventDefault(); submit(); });
      showErrors(false);
    }
    function submit() {
      if (D.readOnly()) { submitRegistry(); return; }
      st.touched = { last: 1, first: 1, phone: 1 };
      if (Object.keys(errs()).length) { showErrors(true); const bad = dlg.querySelector('.has-err input'); if (bad) bad.focus(); return; }
      st.last = cap(st.last.trim()); st.first = cap(st.first.trim());
      try { localStorage.setItem(MGR_KEY, st.mgr); } catch (e) { /* private mode */ }
      const who = (window.BMAuth && window.BMAuth.displayName && window.BMAuth.displayName()) || null;
      const base = { first: st.first, last: st.last, phone: '+373' + st.phone, manager: st.mgr, level: g.level || '', by: who };
      const res = D.enrolStudent(mine ? Object.assign(base, { group: mine.id }) : Object.assign(base, { newGroup: fieldsG }));
      st.done = res;
      dlg.classList.add('is-ok');
      dlg.innerHTML = doneHTML(res);
      paintAll(false);
      dlg.querySelector('[data-another]').focus();
    }
    /* Registre: the student is written in the register itself (a command, applied by registru-apply), and the answer is shown */
    async function submitRegistry() {
      st.touched = { last: 1, first: 1, phone: 1 };
      if (Object.keys(errs()).length) { showErrors(true); const bad = dlg.querySelector('.has-err input'); if (bad) bad.focus(); return; }
      st.last = cap(st.last.trim()); st.first = cap(st.first.trim());
      try { localStorage.setItem(MGR_KEY, st.mgr); } catch (e) { /* private mode */ }
      const go = dlg.querySelector('#inGo'), msg = dlg.querySelector('#inErr');
      if (msg) msg.textContent = '';
      if (go) { go.disabled = true; go.dataset.label = go.innerHTML; go.textContent = mine ? 'Se scrie în registru…' : 'Se creează fila în registru…'; }
      const r = mine
        ? await window.AdminRegistry.enrol({ group: mine.id, first: st.first, last: st.last, phone: '+373' + st.phone, manager: st.mgr, status: solo ? 'Activ' : 'Oră de probă' })
        : await window.AdminRegistry.newGroup({ fresh: fieldsG, first: st.first, last: st.last, phone: '+373' + st.phone, manager: st.mgr });
      if (!r.ok) {
        if (go) { go.disabled = false; go.innerHTML = go.dataset.label; }
        const text = r.status === 'conflict' ? `${r.msg} Nu am scris nimic: încearcă din nou.` : (r.msg || 'Nu s-a putut scrie în registru.');
        if (msg) msg.textContent = text; else U.toast(esc(text), 'warn');
        return;
      }
      st.done = { registry: true, res: r };
      dlg.classList.add('is-ok');
      dlg.innerHTML = doneRegistryHTML(r);
      if (mine) U.wireInvite(dlg, D.group(mine.id) || mine);
      paintAll(false);
      dlg.querySelector('[data-another]').focus();
    }
    function doneRegistryHTML(r) {
      const G = mine ? (D.group(mine.id) || mine) : fieldsG, tt = D.teacher(G.teacher) || t, m = D.manager(st.mgr);
      return `
        <div class="in-ok">
          <button type="button" class="ax-icon-btn in-ok__x" data-x aria-label="Închide">${ico('x', 18)}</button>
          <svg class="in-ok__ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28"/><path d="m19 33 9 9 18-20"/></svg>
          <h2 id="inDT">${mine ? 'Elevul e în registru' : 'Grupa nouă e în registru'}</h2>
          <p class="in-ok__sub"><b>${esc(st.last)} ${esc(st.first)}</b>, ${esc(G.subject)}, clasa ${esc(G.grade)}, la ${esc(tt.name)}, ${esc(dayNames(G))}, ${timeRange(G.start, G.duration)}</p>
          <ul class="in-ok__s">
            ${mine ? '' : `<li><span>${ico('book-open', 16)}</span><span>Fila <b>${esc(r.tab || '')}</b> a fost creată în registrul lui ${esc(tt.name)}, cu tot completat</span></li>
            <li>${solo ? '<span class="ax-st ax-st--activ"><i class="ax-st__i" aria-hidden="true"></i>Activă</span>' : '<span class="ax-st ax-st--completare"><i class="ax-st__i" aria-hidden="true"></i>Se completează</span>'}<span>Grupa e trecută și în „Total achitări”.</span></li>`}
            <li><span>${ico('user-plus', 16)}</span><span>${mine ? 'Scris în registru, coloana' : 'Elevul e în coloana'} <b>${esc(r.column || '')}</b></span></li>
            ${solo ? `<li><span class="ax-st ax-st--activ"><i class="ax-st__i" aria-hidden="true"></i>Activ</span><span>Fără oră de probă: decontarea începe de la prima lecție</span></li>` : `<li><span class="ax-st ax-st--proba"><i class="ax-st__i" aria-hidden="true"></i>Oră de probă</span><span class="in-ok__arr" aria-hidden="true">${ico('arrow-right', 16)}</span><span class="ax-st ax-st--activ"><i class="ax-st__i" aria-hidden="true"></i>Activ, după prima plată</span></li>`}
            <li><span>${ico('users', 16)}</span><span>Managerul elevului: <b>${esc(m ? m.name : '')}</b></span></li>
          </ul>
          ${mine ? U.inviteHTML(G) : '<p class="ax-invite__soon">Codul apare în câteva secunde.</p>'}
          <p class="in-ok__note">${solo ? 'Se plătește de la prima lecție.' : 'Prima lecție e gratuită.'}</p>
          <div class="in-ok__f">
            <button type="button" class="ax-btn ax-btn--primary" data-another>${ico('user-plus', 16)} Înscrie alt elev</button>
            ${r.url ? `<a class="ax-btn" href="${esc(r.url)}" target="_blank" rel="noopener">${ico('book-open', 16)} Deschide în Sheets</a>` : ''}
          </div>
        </div>`;
    }
    function doneHTML(res) {
      const G = D.group(res.group), tt = D.teacher(G.teacher), m = D.manager(st.mgr);
      return `
        <div class="in-ok">
          <button type="button" class="ax-icon-btn in-ok__x" data-x aria-label="Închide">${ico('x', 18)}</button>
          <svg class="in-ok__ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28"/><path d="m19 33 9 9 18-20"/></svg>
          <h2 id="inDT">Înscrierea e făcută</h2>
          <p class="in-ok__sub"><b>${esc(st.last)} ${esc(st.first)}</b>, ${esc(G.subject)}, clasa ${esc(G.grade)}, la ${esc(tt.name)}, ${esc(dayNames(G))}, ${timeRange(G.start, G.duration)}${mine ? '' : '. Grupa nouă așteaptă să se completeze'}</p>
          <ul class="in-ok__s">
            <li><span class="ax-seats" aria-hidden="true">${seatsHTML(true)}</span><span>${esc(sizeLabel(G.size))}: <b>${D.enrolled(G).length}</b> din ${G.size} locuri ocupate</span></li>
            <li><span class="ax-st ax-st--proba"><i class="ax-st__i" aria-hidden="true"></i>Oră de probă</span><span class="in-ok__arr" aria-hidden="true">${ico('arrow-right', 16)}</span><span class="ax-st ax-st--activ"><i class="ax-st__i" aria-hidden="true"></i>Activ, după plată</span></li>
            <li><span>${ico('users', 16)}</span><span>Managerul elevului: <b>${esc(m.name)}</b></span></li>
          </ul>
          <p class="in-ok__note">Elevul e deja în registrul lui ${esc(tt.name)}, cu o coloană nouă. Prima lecție e gratuită.</p>
          <div class="in-ok__f">
            <button type="button" class="ax-btn ax-btn--primary" data-another>${ico('user-plus', 16)} Înscrie alt elev</button>
            <button type="button" class="ax-btn in-undo" data-undo>${ico('undo', 16)} Anulează înscrierea</button>
          </div>
        </div>`;
    }
    /* nothing behind the dialog scrolls while it is open */
    const hold = e => { const tg = e.target; if (tg !== dlg && dlg.contains(tg) && tg.closest('.in-dlg__b, .in-ok')) return; e.preventDefault(); };
    document.addEventListener('wheel', hold, { passive: false, capture: true });
    document.addEventListener('touchmove', hold, { passive: false, capture: true });
    dlg.addEventListener('click', e => {
      if (e.target === dlg || e.target.closest('[data-x]')) { dlg.close(); return; }
      if (e.target.closest('[data-fin]') && st.done && e.target.tagName !== 'A') { dlg.close(); return; }
      if (e.target.closest('[data-another]')) { S = fresh(); save(); dlg.close(); buildRail(); paintPane(true); return; }
      if (e.target.closest('[data-undo]') && !(st.done && st.done.registry)) {
        D.undoEnrol(st.done); st.done = null; dlg.close(); paintAll(false);
        U.toast('Înscrierea a fost anulată. Elevul a dispărut din registru.');
      }
    });
    dlg.addEventListener('close', () => { document.removeEventListener('wheel', hold, { capture: true }); document.removeEventListener('touchmove', hold, { capture: true }); dlg.remove(); });
    dlg.innerHTML = formHTMLd();
    wireForm();
    dlg.showModal();
    const first = dlg.querySelector('input[data-f="last"]'); if (first) first.focus();
  }

  /* ---------------- events ---------------- */
  function wire(host) {
    host.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-clear-wish]')) { Object.assign(S, { days: [], from: '', to: '', size: '', prof: '' }); save(); buildRail(); paintPane(true); return; }
      if (t.closest('[data-reset]')) { S = fresh(); save(); buildRail(); paintPane(true); return; }
      const mode = t.closest('[data-mode]');
      if (mode) { S.mode = mode.dataset.mode; save(); paintPane(true); return; }
      if (t.closest('[data-filling]')) { S.filling = !S.filling; save(); paintPane(true); return; }
      const en = t.closest('[data-enrol]');
      if (en) { openEnrol({ group: en.dataset.enrol }); return; }
      const ngp = t.closest('[data-ngp]'); if (ngp) { S.ng.project = ngp.dataset.ngp; if (!sizesOf(S.ng.project).includes(S.ng.size)) S.ng.size = 6; S.ng.teacher = ''; S.ng.days = []; S.ng.start = null; save(); paintPane(false); popTo(`[data-ngp="${ngp.dataset.ngp}"]`); return; }
      const ngl = t.closest('[data-ngl]'); if (ngl) { S.ng.level = ngl.dataset.ngl; save(); paintPane(false); popTo(`[data-ngl="${ngl.dataset.ngl}"]`); return; }
      const ngs = t.closest('[data-ngs]'); if (ngs) { S.ng.size = +ngs.dataset.ngs; save(); paintPane(false); popTo(`[data-ngs="${ngs.dataset.ngs}"]`); return; }
      const ngd = t.closest('[data-ngd]'); if (ngd) { S.ng.dur = +ngd.dataset.ngd; S.ng.days = []; S.ng.start = null; save(); paintPane(false); popTo(`[data-ngd="${ngd.dataset.ngd}"]`); return; }
      const ngt = t.closest('[data-ngt]');
      if (ngt) { S.ng.teacher = S.ng.teacher === ngt.dataset.ngt ? '' : ngt.dataset.ngt; S.ng.days = []; S.ng.start = null; save(); paintPane(false); return; }
      const rm = t.closest('[data-room]'); if (rm && !rm.disabled) { S.ng.room = rm.dataset.room; save(); paintPane(false); return; }
      if (t.closest('[data-rooms]')) { if (window.AdminRooms) window.AdminRooms.open(); return; }
      const cell = t.closest('[data-cell]');
      if (cell && !cell.disabled) {
        const d = +cell.dataset.d, h = +cell.dataset.h;
        if (S.ng.start === h && S.ng.days.includes(d)) { S.ng.days = S.ng.days.filter(x => x !== d); if (!S.ng.days.length) S.ng.start = null; }
        else if (S.ng.start === h && S.ng.days.length < (S.ng.dur === 1 ? 2 : 1)) S.ng.days = S.ng.days.concat(d);
        else if (S.ng.start === h && S.ng.dur === 1) S.ng.days = [S.ng.days[1], d];            // two days at most: the older pick goes
        else { S.ng.start = h; S.ng.days = [d]; }
        save(); paintPane(false);
        if (S.ng.start === h && S.ng.days.includes(d)) popTo(`[data-cell][data-d="${d}"][data-h="${h}"]`);          // only the cell just chosen
        const rs = root.querySelector('.in-rooms');                       // the cabinets appear under the grid: bring them into view (above the dock)
        if (rs && S.ng.start != null) rs.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        return;
      }
      if (t.closest('[data-create]')) {
        const o = D.newGroupOptions({ subject: S.subject, grade: S.grade, project: S.ng.project }).find(x => x.t.id === S.ng.teacher);
        if (!o || S.ng.start == null || S.ng.days.length !== (S.ng.dur === 1 ? 2 : 1)) return;
        const days = S.ng.days.slice().sort();
        const plan = roomPlan(), room = S.ng.project === 'exo' ? (plan && plan.chosen ? plan.chosen.r.id : null) : null;
        const sd = new Date(D.today); let k = 0;
        do { sd.setDate(sd.getDate() + 1); k++; } while (k < 8 && !days.includes(((sd.getDay() + 6) % 7) + 1));   // the first meeting: the trial lesson
        openEnrol({ fresh: { project: S.ng.project, regime: 'normal', subject: S.subject, grade: S.grade, profile: lyceum() ? (S.profile || null) : null, level: ngLevel(), size: S.ng.size, status: 'completare', teacher: o.t.id, days, start: S.ng.start, duration: S.ng.dur, room, startDate: D.iso(sd), createdAt: D.todayISO } });
      }
    });
  }

  /* ---------------- the view ---------------- */
  window.AdminViews.inscriere = {
    title: 'Înscriere',
    icon: 'user-plus',
    render(el) {
      root = el;
      root.innerHTML = `
        <div class="ax-fixsplit in-fix">
          <aside class="ax-rail in-rail" id="inRail" aria-label="Ce spune părintele"></aside>
          <div class="ax-col">
            <header class="ax-head in-head">
              <div class="ax-head__t">
                <span class="ax-plate">${ico('user-plus', 24)}</span>
                <div>
                  <h1 class="ax-h1">Înscriere elev</h1>
                </div>
              </div>
            </header>
            <section class="in-res" aria-label="Unde îl punem">
              <div id="inTabs"></div>
              <div class="in-pane" id="inPane"></div>
            </section>
          </div>
        </div>`;
      root.querySelector('#inTabs').innerHTML = tabsHTML();
      lastN = -1;
      buildRail(); wireRail();
      paintPane(true);
      wire(root.querySelector('.in-res'));
      if (onResize) window.removeEventListener('resize', onResize);
      onResize = moveInk; window.addEventListener('resize', onResize);
    }
  };
})();
