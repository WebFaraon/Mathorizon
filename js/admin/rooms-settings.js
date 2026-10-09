/* ============================================================
   Admin console: the cabinets ("Cabinete")
   ============================================================
   AdminRooms.open()  a dialog with every cabinet: its number, floor and seats. The registers only name the cabinet (the number in the dropdown list of
   CONFIGURARI and in the schedule), so what the registers do not say is set here, once, and saved for everyone (AdminRegistry.setRooms -> table
   console_rooms): the seats and the floor of every cabinet, and cabinets the registers do not list yet (add one, change its number, take it away).
   A cabinet that the registers list keeps its number (they refer to it); to use a new one in a group's tab it must also be in the cabinet list of the
   register ("Cabinetul ... nu e în lista din CONFIGURARI" says it otherwise).
   It is what the choice of a cabinet for a new group (Înscriere) and the capacity checks of Repartizare use. In Demo mode the dialog only shows them.
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  if (!U || !D) return;
  const { esc, ico } = U;

  function open() {
    const live = D.readOnly();
    // one row per cabinet; origin: 'reg' (the registers list it: its number is fixed), 'console' (saved here only), 'new' (added in this dialog)
    let rows = D.rooms.slice().sort((a, b) => a.num - b.num).map(r => ({
      key: 'r' + r.num, num: String(r.num), was: r.num, origin: r.inRegisters === false ? 'console' : 'reg',
      seats: r.seatsSet === false ? '' : String(r.seats), floor: String(r.floor), was_seats: r.seatsSet === false ? '' : String(r.seats), was_floor: String(r.floor), gone: false
    }));
    let seq = 0;
    const unset = () => rows.filter(r => !r.gone && r.seats === '').length;

    const dlg = document.createElement('dialog');
    dlg.className = 'rs-dlg';
    dlg.setAttribute('aria-labelledby', 'rsT');
    document.body.appendChild(dlg);

    const okNum = r => /^\d{1,3}$/.test(r.num) && +r.num >= 1 && +r.num <= 999;
    const okSeats = r => r.seats === '' || (/^\d{1,2}$/.test(r.seats) && +r.seats >= 1 && +r.seats <= 60);
    const okFloor = r => r.floor === '' || (/^\d{1,2}$/.test(r.floor) && +r.floor <= 20);
    const dup = r => !r.gone && rows.some(o => o !== r && !o.gone && o.num === r.num && r.num !== '');
    const problem = r => !r.gone && (!okNum(r) || !okSeats(r) || !okFloor(r) || dup(r) || (r.origin !== 'reg' && r.seats === ''));
    const dirty = r => r.gone ? r.origin !== 'new' : r.origin === 'new' || r.num !== String(r.was) || r.seats !== r.was_seats || r.floor !== r.was_floor;
    const changed = () => rows.filter(dirty);

    function rowHTML(r, i) {
      const fixed = r.origin === 'reg' || !live, st = r.origin === 'new' ? 'nou' : r.seats === '' ? 'nesetat' : dirty(r) ? 'de salvat' : 'salvat';
      const tag = r.seats === '' ? `<span class="ax-tag ax-tag--warn">${st}</span>` : `<span class="${st === 'de salvat' || st === 'nou' ? 'rs-chg' : 'rs-ok'}">${st}</span>`;
      return `<li class="rs-row${dirty(r) ? ' is-dirty' : ''}${problem(r) ? ' is-bad' : ''}${r.gone ? ' is-gone' : ''}" data-key="${r.key}" style="--i:${Math.min(i, 14)}">
        <label class="rs-c rs-c--num"><span class="rs-l">Cabinet</span><input class="ax-input rs-in rs-in--num" inputmode="numeric" maxlength="3" data-k="num" value="${esc(r.num)}" ${fixed ? 'readonly tabindex="-1"' : ''} aria-label="Numărul cabinetului"></label>
        <label class="rs-c"><span class="rs-l">Etaj</span><input class="ax-input rs-in" inputmode="numeric" maxlength="2" data-k="floor" value="${esc(r.floor)}" ${live ? '' : 'disabled'} aria-label="Etajul cabinetului ${esc(r.num)}"></label>
        <label class="rs-c"><span class="rs-l">Locuri</span><input class="ax-input rs-in" inputmode="numeric" maxlength="2" data-k="seats" placeholder="nesetat" value="${esc(r.seats)}" ${live ? '' : 'disabled'} aria-label="Locurile cabinetului ${esc(r.num)}"></label>
        <span class="rs-s">${tag}<small>${r.origin === 'reg' ? 'din registre' : 'doar în consolă'}</small></span>
        ${live && r.origin !== 'reg' ? `<button type="button" class="ax-icon-btn rs-del" data-del aria-label="Scoate cabinetul ${esc(r.num)}" title="Scoate cabinetul">${ico('x', 16)}</button>` : '<span></span>'}
      </li>`;
    }
    const visible = () => rows.filter(r => !r.gone);
    function paintRows(focusKey) {
      dlg.querySelector('#rsList').innerHTML = visible().map(rowHTML).join('') || '<li class="rs-none">Niciun cabinet.</li>';
      paintFoot();
      if (focusKey) { const f = dlg.querySelector(`[data-key="${focusKey}"] .rs-in--num`); if (f) f.focus(); }
    }
    function paintFoot() {
      const n = changed().length, w = rows.some(problem), save = dlg.querySelector('[data-save]');
      dlg.querySelector('#rsSum').textContent = w ? 'Numărul e între 1 și 999 și nu se repetă; locurile între 1 și 60 (obligatorii la un cabinet adăugat aici); etajul un număr.' : n ? `${n} ${n === 1 ? 'modificare' : 'modificări'}` : '';
      if (save) save.disabled = !live || !n || w;
      const fill = dlg.querySelector('.rs-fill'); if (fill) fill.hidden = !unset();
    }

    dlg.innerHTML = `
      <header class="rs-h">
        <span class="rs-h__ic" aria-hidden="true">${ico('door', 22)}</span>
        <div class="rs-h__t"><span class="rs-eye">Setări</span><h2 id="rsT">Cabinetele</h2></div>
        <button type="button" class="ax-icon-btn rs-x" data-x aria-label="Închide">${ico('x', 18)}</button>
      </header>
      <div class="rs-body">
        <p class="rs-lede">Registrele spun doar numărul cabinetului, nu câte locuri are. Completează-le o dată: la o grupă nouă consola îți arată ce cabinete sunt libere și ce se potrivește ca mărime, ca un grup mic să nu ocupe un cabinet mare.</p>
        ${live ? '' : '<p class="rs-note">În modul Demo capacitățile vin odată cu datele demo și nu se pot schimba. Treci pe Registre ca să le setezi.</p>'}
        ${live ? `<div class="rs-fill"><label>Pune <input class="ax-input rs-in rs-all" inputmode="numeric" maxlength="2" placeholder="8" aria-label="Locuri"> locuri la toate cele nesetate</label><button type="button" class="ax-btn ax-btn--sm" data-fill>Aplică</button></div>` : ''}
        <div class="rs-head" aria-hidden="true"><span>Cabinet</span><span>Etaj</span><span>Locuri</span><span>Stare</span><span></span></div>
        <ul class="rs-list" id="rsList"></ul>
        ${live ? `<button type="button" class="ax-btn rs-add" data-add>${ico('plus', 16)} Adaugă un cabinet</button>
        <p class="rs-help">Un cabinet nou trebuie trecut și în lista de cabinete (CONFIGURARI) din registrul profesorului, altfel registrul nu-l primește în fila unei grupe.</p>` : ''}
        <p class="rs-err" id="rsErr" role="alert"></p>
      </div>
      <footer class="rs-f"><span class="rs-f__s" id="rsSum" aria-live="polite"></span><button type="button" class="ax-btn" data-x>Închide</button>${live ? `<button type="button" class="ax-btn ax-btn--primary" data-save disabled>${ico('check', 16)} Salvează</button>` : ''}</footer>`;

    dlg.addEventListener('input', e => {
      const i = e.target.closest('.rs-in[data-k]');
      if (!i || i.classList.contains('rs-all')) return;
      const li = i.closest('.rs-row'), r = rows.find(x => x.key === li.dataset.key);
      r[i.dataset.k] = i.value.trim();
      // only the state of this row changes, the field keeps the focus
      li.classList.toggle('is-dirty', dirty(r));
      rows.forEach(o => { const el = dlg.querySelector(`[data-key="${o.key}"]`); if (el) el.classList.toggle('is-bad', problem(o)); });
      const st = r.origin === 'new' ? 'nou' : r.seats === '' ? 'nesetat' : dirty(r) ? 'de salvat' : 'salvat';
      li.querySelector('.rs-s').firstElementChild.outerHTML = r.seats === '' ? `<span class="ax-tag ax-tag--warn">${st}</span>` : `<span class="${st === 'de salvat' || st === 'nou' ? 'rs-chg' : 'rs-ok'}">${st}</span>`;
      dlg.querySelector('#rsErr').textContent = '';
      paintFoot();
    });
    dlg.addEventListener('click', async e => {
      if (e.target === dlg || e.target.closest('[data-x]')) { dlg.close(); return; }
      if (e.target.closest('[data-fill]')) {
        const v = dlg.querySelector('.rs-all').value.trim();
        if (!/^\d{1,2}$/.test(v) || +v < 1 || +v > 60) { dlg.querySelector('#rsErr').textContent = 'Scrie un număr de locuri între 1 și 60.'; return; }
        rows.forEach(r => { if (!r.gone && r.seats === '') r.seats = v; });
        paintRows();
        return;
      }
      if (e.target.closest('[data-add]')) {
        const key = 'n' + (++seq);
        rows.push({ key, num: '', was: null, origin: 'new', seats: '', floor: '', was_seats: '', was_floor: '', gone: false });
        paintRows(key);
        const list = dlg.querySelector('.rs-body'); list.scrollTop = list.scrollHeight;
        return;
      }
      const del = e.target.closest('[data-del]');
      if (del) { const r = rows.find(x => x.key === del.closest('.rs-row').dataset.key); if (r.origin === 'new') rows = rows.filter(x => x !== r); else r.gone = true; paintRows(); return; }
      const save = e.target.closest('[data-save]');
      if (save && !save.disabled) {
        save.disabled = true; save.innerHTML = `${ico('check', 16)} Se salvează…`;
        // a cabinet that changed its number (saved here only) is the old one taken away and a new one made; the seats of a register cabinet are only ever set or cleared
        const items = [];
        rows.filter(dirty).forEach(r => {
          if (r.gone) { items.push({ num: r.was, seats: null, floor: null }); return; }
          if (r.origin !== 'new' && +r.num !== r.was) items.push({ num: r.was, seats: null, floor: null });
          items.push({ num: +r.num, seats: r.seats === '' ? null : +r.seats, floor: r.floor === '' ? null : +r.floor });
        });
        const out = await window.AdminRegistry.setRooms(items);
        if (out.ok) { U.toast('Cabinetele au fost salvate.'); dlg.close(); if (window.AdminShell) window.AdminShell.render(); return; }
        dlg.querySelector('#rsErr').textContent = out.msg;
        save.innerHTML = `${ico('check', 16)} Salvează`; paintFoot();
      }
    });
    dlg.addEventListener('close', () => dlg.remove());
    paintRows();
    dlg.showModal();
    const first = dlg.querySelector('.rs-all') || dlg.querySelector('[data-x]');
    if (first) first.focus({ preventScroll: true });
  }

  window.AdminRooms = { open };
})();
