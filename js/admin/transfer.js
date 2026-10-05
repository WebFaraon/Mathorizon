/* ============================================================
   Admin console: transfer students to another group
   ============================================================
   Opened from the group drawer of the Orar view, after the admin ticked
   the students to move:  AdminTransfer.open({ from: groupId, students: [ids], onDone })

   A dialog lists the groups the students could go to: same subject,
   grade and profile, not closed, with room for all of them, never a
   group they were in before. Ordered by level: the same level first,
   then the nearest ones. A
   choice shows what will happen; "Transferă" calls AdminData.transfer,
   which keeps the student in the old group with the status Transferat
   (marks and money stay there, so the statistics are not lost) and
   gives him a new column, status Activ, in the new group. The console
   and both teachers' registers follow through the shared demo state.
   The success screen offers "Anulează transferul".
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico, hh } = U;

  const dayNames = g => g.days.map(d => D.DAYS[d - 1].name).join(' / ');
  const timeRange = g => `${hh(g.start)}-${hh(g.start + g.duration)}`;
  const initials = s => ((s.first || '?')[0] + (s.last || '')[0]).toUpperCase();
  const countWord = (n, one, many) => (n === 1 ? `1 ${one}` : `${n} ${n % 100 >= 1 && n % 100 <= 19 ? many : 'de ' + many}`);
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CHECK = '<svg class="tr-chk-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>';

  function roomPlate(g) {
    const r = g.room ? D.room(g.room) : null;
    return r ? `<span class="or-room or-room--sm" title="${esc(r.name)}"><small>Cab.</small>${r.num}</span>` : '<span class="ax-tag">Online</span>';
  }

  function open({ from, students, onDone }) {
    const src = D.group(from);
    const people = students.map(id => D.students.find(s => s.id === id)).filter(Boolean);
    if (!src || !people.length) return;
    const n = people.length;
    const st = { pick: null, done: null };

    const dlg = document.createElement('dialog');
    dlg.className = 'tr-dlg';
    dlg.setAttribute('aria-labelledby', 'trT');
    document.body.appendChild(dlg);

    const all = () => D.transferCandidates(students);
    const visible = () => all();
    const tName = g => D.teacher(g.teacher).name;

    /* ---------------- step 1: choose the group ---------------- */
    function cardHTML(c, i, best) {
      const g = c.g, e = g.size - c.free, sel = st.pick === g.id;
      const incoming = sel ? n : 0;
      const seats = Array.from({ length: g.size }, (_, k) => `<i class="${k < e ? 'on' : k < e + incoming ? 'inc' : ''}"></i>`).join('');
      const lvl = `<span class="tr-b${c.sameLevel ? ' tr-b--ok' : ''}">${c.sameLevel ? 'Același nivel ' : 'Nivel '}${esc(g.level)}</span>`;
      const proj = c.sameProject ? '' : `<span class="tr-b tr-b--far">${esc(D.project(g.project).mode === 'offline' ? 'Offline' : 'Online')}</span>`;
      const fill = g.status === 'completare' ? '<span class="tr-b">Se completează</span>' : '';
      return `
        <button type="button" class="tr-card${sel ? ' is-sel' : ''}${best ? ' is-best' : ''}${c.fits ? '' : ' is-off'}" role="radio" aria-checked="${sel}" data-g="${g.id}" tabindex="${sel ? 0 : -1}" style="--i:${i}"${c.fits ? '' : ' disabled'}>
          <span class="tr-card__when"><b>${esc(dayNames(g))}</b><span>${timeRange(g)}</span></span>
          <span class="tr-card__room">${roomPlate(g)}</span>
          <span class="tr-card__main">
            <b>${esc(tName(g))}</b>
            <span>${esc(g.subject)}, clasa ${esc(g.grade)}${g.profile ? ', ' + esc(g.profile) : ''} <span class="ax-line ax-line--${g.project}">${esc(D.project(g.project).short)}</span></span>
            <span class="tr-badges">${best ? '<span class="tr-b tr-b--best">Cea mai potrivită</span>' : ''}${lvl}${proj}${fill}</span>
          </span>
          <span class="tr-card__seat">
            <span class="ax-seats" aria-hidden="true">${seats}</span>
            <em>${c.fits ? (c.free === 1 ? '1 loc liber' : `${c.free} locuri libere`) : `Doar ${c.free === 1 ? '1 loc liber' : c.free + ' locuri libere'}`}</em>
          </span>
          <span class="tr-card__tick" aria-hidden="true">${CHECK}</span>
        </button>`;
    }

    function listHTML() {
      const base = all();
      const vis = visible();
      const fit = vis.filter(c => c.fits), tight = vis.filter(c => !c.fits && c.free > 0);
      const full = base.filter(c => c.free === 0).length;
      const bestId = fit.length ? fit[0].g.id : null;
      let html = '';
      if (fit.length) html += fit.map((c, i) => cardHTML(c, i, c.g.id === bestId && (c.sameLevel || fit.length === 1))).join('');
      else html += `<div class="tr-empty"><b>Nicio grupă potrivită.</b>${tight.length ? `Grupele de clasa ${esc(src.grade)} nu au destule locuri pentru ${countWord(n, 'elev', 'elevi')}. Încearcă să muți mai puțini deodată.` : 'Toate grupele de aceeași materie, clasă și profil sunt complete sau închise. Poți crea o grupă nouă din Repartizare.'}</div>`;
      if (tight.length) html += `<h3 class="tr-sub">Nu au destule locuri pentru ${countWord(n, 'elev', 'elevi')}</h3>` + tight.map((c, i) => cardHTML(c, fit.length + i, false)).join('');
      if (full) html += `<p class="tr-full">${full === 1 ? 'Încă o grupă este completă' : `Încă ${full} ${full % 100 >= 1 && full % 100 <= 19 ? 'grupe sunt complete' : 'de grupe sunt complete'}`} și nu apare aici.</p>`;
      return html;
    }

    function noteHTML(g) {
      const t = D.teacher(g.teacher), o = D.teacher(src.teacher);
      return `
        <ul class="tr-flow">
          <li><span class="tr-flow__i tr-flow__i--out">${ico('arrow-right', 14)}</span><span><b>În grupa veche</b> primește statutul <em>Transferat</em>. Prezențele și banii rămân la ${esc(o.name)}, ca să nu se piardă statistica.</span></li>
          <li><span class="tr-flow__i tr-flow__i--in">${ico('arrow-right', 14)}</span><span><b>În grupa nouă</b> apare ca <em>Activ</em>, în registrul lui ${esc(t.name)}, cu o coloană nouă fără lecții trecute.</span></li>
          <li><span class="tr-flow__i">${ico('refresh-cw', 14)}</span><span>Se vede imediat în consolă și la ambii profesori. Rămâne un singur elev, nu doi.</span></li>
        </ul>`;
    }

    function stepHTML() {
      const pickG = st.pick && D.group(st.pick);
      return `
        <header class="tr-h">
          <span class="tr-h__ic" aria-hidden="true">${ico('swap', 22)}</span>
          <div class="tr-h__t"><span class="tr-eye">Transfer</span><h2 id="trT">Unde mutăm ${countWord(n, 'elev', 'elevi')}?</h2></div>
          <button type="button" class="ax-icon-btn tr-x" data-x aria-label="Închide">${ico('x', 18)}</button>
        </header>
        <section class="tr-who" aria-label="Elevii care se mută">
          <div class="tr-from"><small>Din grupa</small><span class="ax-grade">${esc(src.grade)}</span><b>${esc(src.subject)}</b><span>${esc(tName(src))}, ${esc(dayNames(src))} ${timeRange(src)}</span></div>
          <ul class="tr-kids">${people.map((s, i) => `<li style="--i:${i}"><i>${esc(initials(s))}</i>${esc(s.name)}</li>`).join('')}</ul>
        </section>
        <div class="tr-list" role="radiogroup" aria-label="Grupe disponibile" id="trList">${listHTML()}</div>
        <div class="tr-note${pickG ? ' is-on' : ''}" id="trNote"><div>${pickG ? noteHTML(pickG) : ''}</div></div>
        <footer class="tr-f">
          <p class="tr-f__s" id="trSum" aria-live="polite">${pickG ? `${esc(tName(pickG))}, ${esc(dayNames(pickG))} ${timeRange(pickG)}` : 'Alege o grupă din listă.'}</p>
          <button type="button" class="ax-btn" data-x>Renunță</button>
          <button type="button" class="ax-btn ax-btn--primary tr-go" data-go ${pickG ? '' : 'disabled'}>${ico('swap', 16)} Transferă ${countWord(n, 'elev', 'elevi')}</button>
        </footer>`;
    }

    function paintStep(keepScroll) {
      const list = dlg.querySelector('#trList');
      const top = keepScroll && list ? list.scrollTop : 0;
      dlg.innerHTML = stepHTML();
      dlg.classList.remove('is-ok');
      const l2 = dlg.querySelector('#trList');
      if (keepScroll && l2) { l2.classList.add('is-still'); l2.scrollTop = top; }
      const f = dlg.querySelector('.tr-card:not([disabled])');
      if (f && !dlg.querySelector('.tr-card.is-sel')) f.tabIndex = 0;
    }

    /* choosing a card changes only what has to change, so the cards do not flicker */
    function choose(gid) {
      st.pick = gid;
      dlg.querySelectorAll('.tr-card').forEach(b => {
        const on = b.dataset.g === gid;
        b.classList.toggle('is-sel', on); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1;
        const c = D.transferCandidates(students).find(x => x.g.id === b.dataset.g);
        if (c) {
          const e = c.g.size - c.free;
          b.querySelectorAll('.ax-seats i').forEach((s, k) => { s.className = k < e ? 'on' : (on && k < e + n) ? 'inc' : ''; });
        }
      });
      const g = D.group(gid);
      const note = dlg.querySelector('#trNote');
      note.firstElementChild.innerHTML = noteHTML(g);
      note.classList.add('is-on');
      dlg.querySelector('#trSum').textContent = `${tName(g)}, ${dayNames(g)} ${timeRange(g)}`;
      const go = dlg.querySelector('[data-go]'); go.disabled = false;
      if (!calm()) { go.classList.remove('is-ping'); void go.offsetWidth; go.classList.add('is-ping'); }
    }

    /* ---------------- step 2: done ---------------- */
    function doneHTML(ids, g) {
      const o = D.teacher(src.teacher), t = D.teacher(g.teacher);
      return `
        <div class="tr-ok">
          <svg class="tr-ok__ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28"/><path d="m19 33 9 9 18-20"/></svg>
          <h2 id="trT">${ids.length === 1 ? 'Elevul a fost transferat' : countWord(ids.length, 'elev transferat', 'elevi transferați')}</h2>
          <p class="tr-ok__sub">${esc(src.subject)}, clasa ${esc(src.grade)}: de la ${esc(o.name)} la ${esc(t.name)}, ${esc(dayNames(g))} ${timeRange(g)}</p>
          <ul class="tr-ok__rows">${people.map((s, i) => `
            <li style="--i:${i}">
              <b>${esc(s.name)}</b>
              <span class="ax-st ax-st--transferat"><i class="ax-st__i" aria-hidden="true"></i>Transferat</span>
              <span class="tr-ok__arr" aria-hidden="true">${ico('arrow-right', 16)}</span>
              <span class="ax-st ax-st--activ"><i class="ax-st__i" aria-hidden="true"></i>Activ</span>
            </li>`).join('')}</ul>
          <p class="tr-ok__note">Gata, se vede acum în registrul lui ${esc(t.name)} și în consolă. În registrul lui ${esc(o.name)} rămâne cu statutul Transferat, cu prezențele și banii păstrați.</p>
          <div class="tr-ok__f">
            <button type="button" class="ax-btn" data-undo>${ico('undo', 16)} Anulează transferul</button>
            <button type="button" class="ax-btn ax-btn--primary" data-fin>Gata</button>
          </div>
        </div>`;
    }

    function commit() {
      const g = D.group(st.pick);
      if (!g) return;
      const ids = D.transfer(students, g.id);
      if (!ids.length) { U.toast('Elevii nu au putut fi transferați.', 'warn'); return; }
      st.done = ids;
      dlg.classList.add('is-ok');
      dlg.innerHTML = doneHTML(ids, g);
      if (onDone) onDone('transfer');
      dlg.querySelector('[data-fin]').focus();
    }

    /* ---------------- events ---------------- */
    dlg.addEventListener('click', e => {
      if (e.target === dlg) { dlg.close(); return; }
      if (e.target.closest('[data-x]')) { dlg.close(); return; }
      const card = e.target.closest('.tr-card');
      if (card && !card.disabled) { choose(card.dataset.g); return; }
      if (e.target.closest('[data-go]')) { commit(); return; }
      if (e.target.closest('[data-fin]')) { dlg.close(); return; }
      if (e.target.closest('[data-undo]')) {
        const did = D.undoTransfer(st.done || []);
        st.done = null;
        dlg.close();
        if (onDone) onDone('undo');
        U.toast(did ? 'Transferul a fost anulat. Elevii sunt din nou în grupa veche.' : 'Transferul nu mai poate fi anulat.');
      }
    });
    dlg.addEventListener('keydown', e => {
      const card = e.target.closest && e.target.closest('.tr-card');
      if (!card || !['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      e.preventDefault();
      const cards = Array.from(dlg.querySelectorAll('.tr-card:not([disabled])'));
      const at = cards.indexOf(card);
      const next = cards[Math.max(0, Math.min(cards.length - 1, at + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1)))];
      if (next) { choose(next.dataset.g); next.focus(); next.scrollIntoView({ block: 'nearest' }); }
    });
    /* while the dialog is open nothing behind it scrolls: the wheel and touch only move the list inside it */
    const phone = () => window.matchMedia('(max-width: 760px)').matches;
    const hold = e => {
      const t = e.target;
      if (t !== dlg && dlg.contains(t) && (phone() || t.closest('.tr-list, .tr-ok'))) return;
      e.preventDefault();
    };
    document.addEventListener('wheel', hold, { passive: false, capture: true });
    document.addEventListener('touchmove', hold, { passive: false, capture: true });
    dlg.addEventListener('close', () => {
      document.removeEventListener('wheel', hold, { capture: true });
      document.removeEventListener('touchmove', hold, { capture: true });
      dlg.remove();
    });
    dlg.addEventListener('cancel', () => { /* Esc closes it, as usual */ });

    paintStep(false);
    dlg.showModal();
    const first = dlg.querySelector('.tr-card:not([disabled])');
    if (first) first.tabIndex = 0;
    if (first) first.focus({ preventScroll: true });
  }

  window.AdminTransfer = { open };
})();
