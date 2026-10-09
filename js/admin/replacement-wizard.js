/* ============================================================
   Admin console: assign a replacement (docs/inlocuiri.md)
   ============================================================
   AdminReplacement.open({ group: groupId, onDone })  (from the group drawer, Registre mode)

   One dialog, four things in order: which lessons are replaced (the dates the group meets, from today), who teaches them (only teachers who teach the
   subject in that class, are available then and have nothing else at that hour; the others are listed with the reason), in which cabinet (free on
   every chosen date; the group's own cabinet is free for its own replaced lesson), and a plain account of what will happen before the button.
   "Atribuie" calls AdminRegistry.replace: the substitute's register gets the tab of this group (made now, or the one from the earlier replacement
   brought up to date) with every student copied as "Înlocuire" and no money. The money moves later, by itself, when he marks a student.
   The decisions are in AdminReplacementPlan (js/admin/replacement-plan.js, tested without a browser).
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData, RP = window.AdminReplacementPlan;
  if (!U || !D || !RP) return;
  const { esc, ico, hh } = U;

  const COPY = new Set(['activ', 'instabil', 'proba', 'proba_ok', 'inlocuire']);   // the same students the register copies: those who are in the group now
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const dateLabel = iso => { const d = new Date(iso + 'T12:00:00'); return `${cap(RP.DAY_NAMES[RP.weekday(iso) - 1])} ${d.getDate()} ${D.MONTHS[d.getMonth()]}`; };
  const money = v => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2, maximumFractionDigits: Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2 }).format(v);
  const plural = (n, one, many) => (n === 1 ? `1 ${one}` : `${n} ${n % 100 >= 1 && n % 100 <= 19 ? many : 'de ' + many}`);
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>';

  function open({ group, onDone }) {
    const g = D.group(group);
    if (!g || !D.readOnly()) return;
    const reps = () => ((D.registry && D.registry.replacements) || []);
    const base = D.teacher(g.teacher);
    const kids = D.studentsOf(g.id).filter(s => s.group === g.id && COPY.has(D.statusIn(s, g.id)));
    const price = D.rateBySize(g.size);
    const now = new Date(), todayIso = D.todayISO;
    // the lessons that can still be replaced: from today on (today only while the lesson has not started)
    const dates = RP.upcomingDates(g, todayIso, 6).filter(iso => iso !== todayIso || now.getHours() < g.start);
    const blocker = !g._src || !g._src.wb ? 'Grupa nu are un registru legat în platformă.'
      : g._irregular || !g.days.length ? 'Orarul grupei nu are aceeași oră în toate zilele (sau lipsește): atribuie înlocuirea direct în registru.'
      : !price ? 'Formatul grupei nu are un preț de lecție: banii unei înlocuiri nu se pot calcula.'
      : !kids.length ? 'Grupa nu are elevi de copiat în fila de înlocuire.' : '';
    const st = { dates: new Set(), teacher: null, room: undefined, busy: false, done: null, err: '' };

    const dlg = document.createElement('dialog');
    dlg.className = 'rl-dlg';
    dlg.setAttribute('aria-labelledby', 'rlT');
    document.body.appendChild(dlg);

    const ctx = () => ({ group: g, dates: [...st.dates].sort(), groups: D.groups, teachers: D.teachers, rooms: D.rooms, replacements: reps() });
    const teachers = () => RP.teacherOptions(ctx());
    const rooms = () => RP.roomOptions(ctx());
    const chosenTeacher = () => (st.teacher ? D.teacher(st.teacher) : null);
    const chosenRoom = () => (st.room ? D.room(st.room) : null);
    const roomReady = () => (g.room ? !!st.room : st.room !== undefined);               // an online group may stay without a cabinet, a group in a cabinet needs one
    const ready = () => !blocker && st.dates.size > 0 && !!st.teacher && roomReady() && !st.busy;

    /* ---------- the parts ---------- */
    function headHTML() {
      return `
        <header class="rl-h">
          <span class="rl-h__ic" aria-hidden="true">${ico('replace', 22)}</span>
          <div class="rl-h__t"><span class="rl-eye">Înlocuire</span><h2 id="rlT">${esc(g.subject)}, clasa ${esc(g.grade)}</h2></div>
          <button type="button" class="ax-icon-btn rl-x" data-x aria-label="Închide">${ico('x', 18)}</button>
        </header>
        <section class="rl-who" aria-label="Grupa">
          <span>${esc(base.name)}</span><span>${esc(g.days.map(d => D.DAYS[d - 1].name).join(' / '))}, ${hh(g.start)}-${hh(g.start + g.duration)}</span>
          <span>${g.room ? esc(D.room(g.room).name) : 'Online'}</span><span>${plural(kids.length, 'elev', 'elevi')}</span>
        </section>`;
    }

    function datesHTML() {
      if (!dates.length) return '<p class="rl-none">Grupa nu are lecții în următoarele șase săptămâni.</p>';
      return `<ul class="rl-dates" role="group" aria-label="Lecțiile înlocuite">${dates.map((iso, i) => {
        const taken = RP.replacedOn(reps(), g.id, iso), on = st.dates.has(iso);
        return `<li style="--i:${i}"><label class="rl-date${on ? ' is-on' : ''}${taken ? ' is-off' : ''}">
          <input type="checkbox" class="rl-in" data-date="${iso}" ${on ? 'checked' : ''} ${taken ? 'disabled' : ''}>
          <span class="rl-box" aria-hidden="true">${CHECK}</span>
          <span class="rl-date__d"><b>${esc(dateLabel(iso))}</b><small>${hh(g.start)}-${hh(g.start + g.duration)}</small></span>
          ${taken ? `<span class="rl-date__n">înlocuită de ${esc(D.teacher(taken.rep.teacher) ? D.teacher(taken.rep.teacher).name : 'alt profesor')}</span>` : ''}
        </label></li>`;
      }).join('')}</ul>`;
    }

    function teachersHTML() {
      if (!st.dates.size) return '<p class="rl-none">Alege mai întâi lecțiile: disponibilitatea se verifică pentru fiecare zi aleasă.</p>';
      const all = teachers(), ok = all.filter(o => o.ok), no = all.filter(o => !o.ok);
      const row = (o, i) => `<li style="--i:${i}"><label class="rl-t${st.teacher === o.teacher.id ? ' is-on' : ''}${o.ok ? '' : ' is-off'}">
          <input type="radio" class="rl-in" name="rlTeacher" value="${esc(o.teacher.id)}" ${st.teacher === o.teacher.id ? 'checked' : ''} ${o.ok ? '' : 'disabled'}>
          <span class="rl-dot" aria-hidden="true"></span>
          <span class="rl-t__n"><b>${esc(o.teacher.name)}</b>${o.ok ? `<small>${esc(o.teacher.subjects.slice(0, 3).join(', '))}</small>` : `<small class="rl-why">${esc(o.reasons.join('. '))}</small>`}</span>
        </label></li>`;
      return `${ok.length ? `<ul class="rl-ts" role="radiogroup" aria-label="Profesori disponibili">${ok.map(row).join('')}</ul>` : '<p class="rl-none">Niciun profesor nu poate prelua toate lecțiile alese. Alege mai puține lecții sau altă zi.</p>'}
        ${no.length ? `<details class="rl-more"><summary>Nu pot prelua (${no.length})</summary><ul class="rl-ts">${no.map(row).join('')}</ul></details>` : ''}`;
    }

    function roomsHTML() {
      if (!st.teacher) return '<p class="rl-none">Cabinetul se alege după profesor.</p>';
      const list = rooms();
      const chips = list.map(o => `<label class="rl-room${st.room === o.room.id ? ' is-on' : ''}${o.free ? '' : ' is-off'}" ${o.free ? '' : `title="Ocupat: ${esc(o.by.join(', '))}"`}>
          <input type="radio" class="rl-in" name="rlRoom" value="${esc(o.room.id)}" ${st.room === o.room.id ? 'checked' : ''} ${o.free ? '' : 'disabled'}>
          <b>${o.room.num}</b><small>${o.free ? (g.room === o.room.id ? 'cabinetul grupei' : 'liber') : 'ocupat'}</small></label>`).join('');
      const online = g.room ? '' : `<label class="rl-room rl-room--on${st.room === null ? ' is-on' : ''}"><input type="radio" class="rl-in" name="rlRoom" value="" ${st.room === null ? 'checked' : ''}><b>Online</b><small>fără cabinet</small></label>`;
      return `<div class="rl-rooms" role="radiogroup" aria-label="Cabinet">${online}${chips}</div>`;
    }

    function sumHTML() {
      if (blocker) return '';
      const t = chosenTeacher();
      if (!t || !st.dates.size) return '<p class="rl-sum__empty">Alege lecțiile și profesorul: aici vezi ce se întâmplă în registru.</p>';
      const n = st.dates.size;
      const first = kids.slice(0, 8).map(s => `<li>${esc(s.name)}</li>`).join('') + (kids.length > 8 ? `<li class="rl-more-k">încă ${kids.length - 8}</li>` : '');
      const reuse = reps().some(r => r.base === g.id && r.teacher === t.id && r.status !== 'cancelled');
      return `<div class="rl-sum__b">
        <p><b>În registrul lui ${esc(t.name)}</b> ${reuse ? 'fila acestei grupe există deja: se aduce la zi, cu lecțiile noi în orar.' : 'se creează o filă nouă pentru această grupă, cu starea <b>Înlocuire</b>.'}</p>
        <p>${plural(kids.length, 'elev', 'elevi')} ${kids.length === 1 ? 'este copiat' : 'sunt copiați'} cu statutul <b>Înlocuire</b>, cu achitări, reduceri și sold <b>0</b>. În registrul lui ${esc(base.name)} rămân <b>Activ</b>.</p>
        <ul class="rl-kids">${first}</ul>
        <p><b>Banii</b> nu se mută acum. Când ${esc(t.name)} pune prezența unui elev (<b>Prezent</b> sau <b>Absent</b>), o lecție de <b>${money(price)} lei</b> trece automat din registrul grupei în fila lui, după formulele din Calculator. La <b>Absent motivat</b> sau fără prezență nu se mută nimic.</p>
        <p>${n === 1 ? 'O lecție' : plural(n, 'lecție', 'lecții')} apare ${n === 1 ? 'în Repartizare în ziua ei' : 'în Repartizare în zilele lor'}, iar elevii o văd în Istoric.</p>
      </div>`;
    }

    function footHTML() {
      const t = chosenTeacher(), r = chosenRoom();
      const line = st.busy ? '' : blocker ? '' : !st.dates.size ? 'Alege cel puțin o lecție.' : !t ? 'Alege profesorul.' : !roomReady() ? 'Alege cabinetul.'
        : `${plural(st.dates.size, 'lecție', 'lecții')}, ${esc(t.name)}${r ? ', cabinet ' + r.num : st.room === null ? ', online' : ''}`;
      return `<p class="rl-f__s" id="rlSum" aria-live="polite">${line}</p>
        <button type="button" class="ax-btn" data-x>Renunță</button>
        <button type="button" class="ax-btn ax-btn--primary rl-go" data-assign ${ready() ? '' : 'disabled'}>${ico('replace', 16)} ${st.busy ? 'Se creează fila…' : 'Atribuie înlocuirea'}</button>`;
    }

    function mainHTML() {
      if (blocker) return `<div class="rl-body"><p class="rl-block">${ico('alert', 18)} <span>${esc(blocker)}</span></p></div><footer class="rl-f"><span></span><button type="button" class="ax-btn" data-x>Închide</button></footer>`;
      return `
        <div class="rl-body" id="rlBody">
          <section class="rl-sec"><h3><i>1</i> Ce lecții se înlocuiesc</h3><div id="rlDates">${datesHTML()}</div></section>
          <section class="rl-sec"><h3><i>2</i> Cine predă</h3><div id="rlTeachers">${teachersHTML()}</div></section>
          <section class="rl-sec"><h3><i>3</i> În ce cabinet</h3><div id="rlRooms">${roomsHTML()}</div></section>
          <section class="rl-sec rl-sum" aria-label="Ce se întâmplă"><h3><i>4</i> Ce se întâmplă</h3><div id="rlSumBox">${sumHTML()}</div></section>
          <p class="rl-err" id="rlErr" role="alert">${esc(st.err)}</p>
        </div>
        <footer class="rl-f" id="rlFoot">${footHTML()}</footer>`;
    }

    function doneHTML() {
      const r = st.done, t = chosenTeacher();
      return `
        <div class="rl-body rl-ok">
          <span class="rl-ok__ic" aria-hidden="true">${CHECK}</span>
          <h3>${r.reused ? 'Fila de înlocuire a fost actualizată' : 'Fila de înlocuire a fost creată'}</h3>
          <p>În registrul lui <b>${esc(t.name)}</b>${r.tab ? `, fila <b>${esc(r.tab)}</b>` : ''}: ${plural(kids.length, 'elev', 'elevi')} cu statutul Înlocuire și banii la 0. Banii se mută singuri, după ce ${esc(t.name)} pune prezența.</p>
          <p class="rl-ok__s">${plural(st.dates.size, 'lecție', 'lecții')} ${st.dates.size === 1 ? 'se vede' : 'se văd'} în Repartizare în ziua ${st.dates.size === 1 ? 'ei' : 'lor'}. Urmărești totul în pagina Înlocuiri.</p>
        </div>
        <footer class="rl-f"><span></span>
          ${r.url ? `<a class="ax-btn" href="${esc(r.url)}" target="_blank" rel="noopener">${ico('book-open', 16)} Deschide fila</a>` : ''}
          <a class="ax-btn ax-btn--primary" href="#inlocuiri" data-x>${ico('replace', 16)} Vezi în Înlocuiri</a>
        </footer>`;
    }

    /* ---------- paint and wiring ---------- */
    const $ = s => dlg.querySelector(s);
    function paintRest() {                                                // everything after the dates, kept in place so the list the person is ticking never jumps
      $('#rlTeachers').innerHTML = teachersHTML();
      $('#rlRooms').innerHTML = roomsHTML();
      $('#rlSumBox').innerHTML = sumHTML();
      $('#rlFoot').innerHTML = footHTML();
      $('#rlErr').textContent = st.err;
    }
    function pickDefaultRoom() {
      if (!st.teacher) { st.room = undefined; return; }
      const list = rooms(), own = list.find(o => o.room.id === g.room);
      if (g.room) st.room = own && own.free ? g.room : ((list.find(o => o.free) || {}).room || {}).id;
      else st.room = null;
    }
    function dropInvalid() {                                              // after the dates change the teacher or the cabinet may not fit any more
      if (st.teacher) {
        const o = teachers().find(x => x.teacher.id === st.teacher);
        if (!o || !o.ok) st.teacher = null;
      }
      if (st.room) { const o = rooms().find(x => x.room.id === st.room); if (!o || !o.free) st.room = undefined; }
      if (!st.teacher) st.room = undefined;
      else if (st.room === undefined) pickDefaultRoom();
    }
    function wire() {
      dlg.addEventListener('click', e => {
        if (e.target === dlg || e.target.closest('[data-x]')) { if (!st.busy) { dlg.close(); } else if (e.target.closest('[data-x]')) e.preventDefault(); }
      });
      dlg.addEventListener('cancel', e => { if (st.busy) e.preventDefault(); });
      dlg.addEventListener('change', e => {
        const i = e.target;
        if (!i.classList || !i.classList.contains('rl-in') || st.busy) return;
        st.err = '';
        if (i.dataset.date) {
          if (i.checked) st.dates.add(i.dataset.date); else st.dates.delete(i.dataset.date);
          i.closest('.rl-date').classList.toggle('is-on', i.checked);
          dropInvalid();
        } else if (i.name === 'rlTeacher') {
          st.teacher = i.value; st.room = undefined; pickDefaultRoom();
        } else if (i.name === 'rlRoom') {
          st.room = i.value || null;
        }
        paintRest();
        if (i.name === 'rlTeacher') { const sel = dlg.querySelector('input[name="rlTeacher"]:checked'); if (sel) sel.focus({ preventScroll: true }); }
        if (i.name === 'rlRoom') { const sel = dlg.querySelector('input[name="rlRoom"]:checked'); if (sel) sel.focus({ preventScroll: true }); }
      });
      dlg.addEventListener('click', async e => {
        if (!e.target.closest('[data-assign]') || !ready()) return;
        st.busy = true; st.err = '';
        $('#rlFoot').innerHTML = footHTML();
        dlg.classList.add('is-busy');
        const t = chosenTeacher(), r = chosenRoom();
        const payload = [...st.dates].sort().map(iso => ({ iso, start: g.start, duration: g.duration, cabinet: r ? String(r.num) : '' }));
        const out = await window.AdminRegistry.replace({ group: g.id, teacher: t.id, dates: payload });
        st.busy = false; dlg.classList.remove('is-busy');
        if (out.ok) {
          st.done = out;
          dlg.innerHTML = headHTML() + doneHTML();
          if (onDone) onDone(out);
          U.toast(`Înlocuire atribuită: ${esc(t.name)}, ${plural(st.dates.size, 'lecție', 'lecții')}.`);
          return;
        }
        st.err = out.msg || 'Nu s-a putut crea fila de înlocuire.';
        $('#rlFoot').innerHTML = footHTML();
        $('#rlErr').textContent = st.err;
      });
      dlg.addEventListener('close', () => dlg.remove());
    }

    dlg.innerHTML = headHTML() + mainHTML();
    wire();
    dlg.showModal();
    const first = dlg.querySelector('.rl-in:not([disabled])') || dlg.querySelector('[data-x]');
    if (first && !calm()) first.focus({ preventScroll: true });
  }

  window.AdminReplacement = { open };
})();
