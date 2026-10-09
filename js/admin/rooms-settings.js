/* ============================================================
   Admin console: the cabinets ("Cabinete")
   ============================================================
   AdminRooms.open()  a dialog with every cabinet of the registers: its floor and how many seats it has. The registers only say the cabinet's number, so the
   capacity is set here, once, and saved for everyone (AdminRegistry.setRooms -> table console_rooms). It is what the choice of a cabinet for a new group
   (Înscriere) and the capacity checks of Repartizare use: a group of two should not take a cabinet of ten.
   In Demo mode the capacities come with the demo data and the dialog only shows them.
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  if (!U || !D) return;
  const { esc, ico } = U;

  function open() {
    const live = D.readOnly();
    const rooms = D.rooms.slice().sort((a, b) => a.num - b.num);
    const start = new Map(rooms.map(r => [r.num, { seats: r.seatsSet === false ? '' : String(r.seats), floor: String(r.floor) }]));
    const cur = new Map([...start].map(([k, v]) => [k, Object.assign({}, v)]));
    const unset = rooms.filter(r => r.seatsSet === false).length;

    const dlg = document.createElement('dialog');
    dlg.className = 'rs-dlg';
    dlg.setAttribute('aria-labelledby', 'rsT');
    document.body.appendChild(dlg);

    const valid = v => /^\d{1,2}$/.test(v) && +v >= 1 && +v <= 60;
    const changed = () => rooms.filter(r => { const a = start.get(r.num), b = cur.get(r.num); return a.seats !== b.seats || a.floor !== b.floor; });
    const bad = () => rooms.filter(r => { const b = cur.get(r.num); return (b.seats !== '' && !valid(b.seats)) || (b.floor !== '' && !/^\d{1,2}$/.test(b.floor)); });

    function rowHTML(r, i) {
      const b = cur.get(r.num), a = start.get(r.num);
      const dirty = a.seats !== b.seats || a.floor !== b.floor;
      const wrong = (b.seats !== '' && !valid(b.seats)) || (b.floor !== '' && !/^\d{1,2}$/.test(b.floor));
      return `<tr data-num="${r.num}" class="${dirty ? 'is-dirty' : ''}${wrong ? ' is-bad' : ''}" style="--i:${Math.min(i, 14)}">
        <th scope="row"><span class="or-room or-room--sm"><small>Cab.</small>${r.num}</span></th>
        <td><label class="rs-f"><span class="rs-vh">Etajul cabinetului ${r.num}</span><input class="ax-input rs-in" inputmode="numeric" maxlength="2" data-k="floor" value="${esc(b.floor)}" ${live ? '' : 'disabled'}></label></td>
        <td><label class="rs-f"><span class="rs-vh">Locurile cabinetului ${r.num}</span><input class="ax-input rs-in" inputmode="numeric" maxlength="2" data-k="seats" placeholder="nesetat" value="${esc(b.seats)}" ${live ? '' : 'disabled'}></label></td>
        <td class="rs-st">${b.seats === '' ? '<span class="ax-tag ax-tag--warn">nesetat</span>' : dirty ? '<span class="rs-chg">de salvat</span>' : '<span class="rs-ok">salvat</span>'}</td>
      </tr>`;
    }

    function paintRows() { dlg.querySelector('#rsBody').innerHTML = rooms.map(rowHTML).join(''); paintFoot(); }
    function paintFoot() {
      const n = changed().length, w = bad().length, save = dlg.querySelector('[data-save]');
      dlg.querySelector('#rsSum').textContent = w ? 'Locurile sunt între 1 și 60, etajul un număr.' : n ? `${n} ${n === 1 ? 'cabinet modificat' : 'cabinete modificate'}` : '';
      if (save) save.disabled = !live || !n || !!w;
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
        ${live && unset ? `<div class="rs-fill"><label>Pune <input class="ax-input rs-in rs-all" inputmode="numeric" maxlength="2" placeholder="8" aria-label="Locuri"> locuri la toate cele nesetate</label><button type="button" class="ax-btn ax-btn--sm" data-fill>Aplică</button></div>` : ''}
        <div class="ax-table-wrap"><table class="ax-table rs-t"><thead><tr><th>Cabinet</th><th>Etaj</th><th>Locuri</th><th></th></tr></thead><tbody id="rsBody"></tbody></table></div>
        <p class="rs-err" id="rsErr" role="alert"></p>
      </div>
      <footer class="rs-f"><span class="rs-f__s" id="rsSum" aria-live="polite"></span><button type="button" class="ax-btn" data-x>Închide</button>${live ? `<button type="button" class="ax-btn ax-btn--primary" data-save disabled>${ico('check', 16)} Salvează</button>` : ''}</footer>`;

    dlg.addEventListener('input', e => {
      const i = e.target.closest('.rs-in[data-k]');
      if (!i) return;
      const tr = i.closest('tr'), c = cur.get(+tr.dataset.num);
      c[i.dataset.k] = i.value.trim();
      // only this row is repainted (its state), the field keeps the focus
      const r = rooms.find(x => x.num === +tr.dataset.num), a = start.get(r.num);
      const dirty = a.seats !== c.seats || a.floor !== c.floor;
      const wrong = (c.seats !== '' && !valid(c.seats)) || (c.floor !== '' && !/^\d{1,2}$/.test(c.floor));
      tr.classList.toggle('is-dirty', dirty); tr.classList.toggle('is-bad', wrong);
      tr.querySelector('.rs-st').innerHTML = c.seats === '' ? '<span class="ax-tag ax-tag--warn">nesetat</span>' : dirty ? '<span class="rs-chg">de salvat</span>' : '<span class="rs-ok">salvat</span>';
      dlg.querySelector('#rsErr').textContent = '';
      paintFoot();
    });
    dlg.addEventListener('click', async e => {
      if (e.target === dlg || e.target.closest('[data-x]')) { dlg.close(); return; }
      if (e.target.closest('[data-fill]')) {
        const v = dlg.querySelector('.rs-all').value.trim();
        if (!valid(v)) { dlg.querySelector('#rsErr').textContent = 'Scrie un număr de locuri între 1 și 60.'; return; }
        rooms.forEach(r => { const c = cur.get(r.num); if (c.seats === '') c.seats = v; });
        paintRows();
        return;
      }
      const save = e.target.closest('[data-save]');
      if (save && !save.disabled) {
        save.disabled = true; save.innerHTML = `${ico('check', 16)} Se salvează…`;
        const items = changed().map(r => { const c = cur.get(r.num); return { num: r.num, seats: c.seats === '' ? null : +c.seats, floor: c.floor === '' ? null : +c.floor }; });
        const out = await window.AdminRegistry.setRooms(items);
        if (out.ok) { U.toast('Capacitățile cabinetelor au fost salvate.'); dlg.close(); if (window.AdminShell) window.AdminShell.render(); return; }
        dlg.querySelector('#rsErr').textContent = out.msg;
        save.innerHTML = `${ico('check', 16)} Salvează`; paintFoot();
      }
    });
    dlg.addEventListener('close', () => dlg.remove());
    paintRows();
    dlg.showModal();
    const first = dlg.querySelector('.rs-all') || dlg.querySelector('.rs-in:not([disabled])') || dlg.querySelector('[data-x]');
    if (first) first.focus({ preventScroll: true });
  }

  window.AdminRooms = { open };
})();
