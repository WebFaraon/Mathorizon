/* ============================================================
   Admin console: Acasă
   ============================================================
   Greeting with the date, what needs attention today (each sign a
   number and a direct link) and, in the middle, big tiles that lead
   to every other page.
   Reference view for the others: render(root, ctx) writes markup
   with AdminUI helpers and wires its own events.
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico, nf, plural } = U;

  function greeting() {
    const h = new Date().getHours();
    return h >= 5 && h < 11 ? 'Bună dimineața' : h < 18 && h >= 11 ? 'Bună ziua' : 'Bună seara';
  }
  const todayId = () => ((new Date().getDay() + 6) % 7) + 1;
  const tomorrowISO = () => { const d = new Date(D.today); d.setDate(d.getDate() + 1); return D.iso(d); };

  function attention() {
    const live = D.groups.filter(g => g.status !== 'inactiv');
    const conflicts = D.conflicts(todayId());
    const risk = D.groups.filter(g => g.status === 'activ' && D.freeSeats(g) >= 2);
    const incomplete = D.groups.filter(g => g.status === 'activ' && D.freeSeats(g) === 1);
    const tomorrowDay = (todayId() % 7) + 1;
    const startTomorrow = D.groups.filter(g => g.startDate === tomorrowISO() || (g.status === 'completare' && g.startDate > D.todayISO && g.days.includes(tomorrowDay) && g.startDate <= tomorrowISO()));
    const debt = D.students.filter(s => s.status === 'activ' && s.balance <= -1000);
    return [
      { k: 'Conflicte în cabinete azi', v: conflicts.length, s: conflicts.length ? 'Același cabinet sau profesor de două ori' : 'Planul de azi e curat', href: '#repartizare?day=' + todayId(), warn: conflicts.length > 0, icon: 'alert' },
      { k: 'Risc financiar', v: risk.length, s: 'Grupe active cu 2+ locuri libere', href: '#orar?quick=risc', icon: 'wallet' },
      { k: 'Active incomplete', v: incomplete.length, s: 'Grupe active cu 1 loc liber', href: '#orar?quick=incomplete', icon: 'users' },
      { k: 'Încep mâine', v: startTomorrow.length, s: 'Grupe care pornesc mâine', href: '#orar?quick=maine', icon: 'play' },
      { k: 'Datorii peste 1 000 lei', v: debt.length, s: 'Elevi activi cu sold negativ mare', href: '#elevi?sold=mare&status=activ&sort=balance', icon: 'user-x' },
      { k: 'Grupe în lucru', v: live.length, s: `din ${nf.format(D.groups.length)} grupe`, href: '#orar', icon: 'grid' }
    ];
  }

  /* one tile per page: the icon plate in the page colour, the name and what it is for */
  function tiles() {
    const day = todayId();
    return [
      { id: 'orar', href: '#orar', icon: 'grid', t: 'Orar', d: 'Grupele, programul și locurile libere' },
      { id: 'elevi', href: '#elevi', icon: 'users', t: 'Elevi', d: 'Prezențe, sold, manager și statut' },
      { id: 'inscriere', href: '#inscriere', icon: 'user-plus', t: 'Înscriere', d: 'Un elev nou într-o grupă potrivită' },
      { id: 'repartizare', href: '#repartizare?day=' + day, icon: 'door', t: 'Repartizare', d: 'Cabinetele pe ore, cu mutare' },
      { id: 'inlocuiri', href: '#inlocuiri', icon: 'replace', t: 'Înlocuiri', d: 'Lecțiile ținute de alt profesor' },
      { id: 'receptie', href: '#receptie', icon: 'monitor', t: 'Recepție', d: 'Ecranul TV de la intrare' },
      { id: 'disponibilitate', href: '#disponibilitate', icon: 'clock', t: 'Disponibilitate', d: 'Când pot preda profesorii' },
      { id: 'analitica', href: '#analitica', icon: 'chart-column', t: 'Analitică', d: 'Distribuții și tendințe' },
      { id: 'profesori', href: '#profesori', icon: 'user', t: 'Conturi', d: 'Cereri, abonamente și waitlist' },
      { id: 'exercitii', href: 'admin-add-exercise.html', icon: 'plus', t: 'Adaugă exercițiu', d: 'Un exercițiu nou în culegere' },
      { id: 'calculator', href: '#calculator', icon: 'calculator', t: 'Calculator', d: 'Transfer, înlocuire și retur' },
      { id: 'culegeri', href: 'admin-culegeri.html', icon: 'library', t: 'Culegeri', d: 'Culegerile și exercițiile din ele' }
    ];
  }

  /* ---- the day on a display: lessons per hour, today, drawn as the pixels of a dot-matrix LCD ----
     14 hours (08-21), each a bar two pixels wide plus a gap column; a bar is as tall as the number of lessons running in that hour (scaled to the day's busiest hour).
     Past hours are dimmed, the current hour's bar ends in a blinking cursor and the gap column after it fills one pixel per ~8.5 minutes, like a clock.
     Under it one flag per teacher, lit while that teacher is in a lesson. Real data only (AdminData.groups of today's weekday). The display changes in steps, never in tweens. */
  const LCD_ON = /[?&]viu=1\b/.test(location.search);               // preview: admin.html?viu=1
  const H0 = 8, H1 = 21, ROWS = 7, NCOL = (H1 - H0 + 1) * 3;
  let lcdTimer = 0, lcdBooted = false;
  const pad2 = n => String(n).padStart(2, '0');
  function lcdModel() {
    const day = todayId(), now = new Date(), nh = now.getHours(), nm = now.getMinutes();
    const live = D.groups.filter(g => g.status !== 'inactiv' && g.days.includes(day));
    const hours = Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i);
    const at = h => live.filter(g => g.start <= h && h < g.start + g.duration);
    const count = hours.map(h => at(h).length), peak = Math.max(1, ...count);
    const nowSet = new Set(at(nh).map(g => g.teacher));
    return { hours, count, peak, nh, nm, total: live.length, running: at(nh).length, nowSet, inDay: nh >= H0 && nh <= H1, peakHour: hours[count.indexOf(Math.max(...count))] };
  }
  function lcdHTML(m) {
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < NCOL; c++) cells.push(`<i data-r="${r}" data-c="${c}" style="--d:${c * 16 + (ROWS - r) * 9}ms"></i>`);
    return `
      <div class="ah-lcd${lcdBooted ? '' : ' is-boot'}" role="img" aria-label="${esc(`Lecții pe ore azi: cel mai încărcat interval e ${pad2(m.peakHour)}:00, cu ${m.count[m.hours.indexOf(m.peakHour)]} lecții. Acum sunt ${m.running} lecții în curs.`)}">
        <div class="ah-lcd__top"><span id="ahLcdL">Lecții azi <b>${m.total}</b></span><span id="ahLcdR">În curs <b>${m.running}</b></span></div>
        <div class="ah-lcd__px" aria-hidden="true">${cells.join('')}<span class="ah-lcd__scan"></span></div>
        <div class="ah-lcd__hrs" aria-hidden="true">${m.hours.map(h => `<span data-h="${h}">${pad2(h)}</span>`).join('')}</div>
        <div class="ah-lcd__flags" aria-hidden="true">${D.teachers.map(t => `<i data-t="${esc(t.id)}" title="${esc(t.name)}"></i>`).join('')}<span id="ahLcdT"></span></div>
      </div>`;
  }
  /* sets which pixels are lit; cheap enough to run every minute */
  function lcdPaint(box, m) {
    const px = box.querySelectorAll('.ah-lcd__px > i');
    px.forEach(el => {
      const c = +el.dataset.c, r = +el.dataset.r, hi = Math.floor(c / 3), k = c % 3, h = H0 + hi, n = m.count[hi];
      const height = n ? Math.max(1, Math.round(n / m.peak * ROWS)) : 0, fromBottom = ROWS - r;
      const isNow = m.inDay && h === m.nh;
      let on = false, cur = false;
      if (k < 2) {
        on = fromBottom <= height;
        if (isNow) cur = height ? fromBottom === height : fromBottom === 1;
      } else if (isNow) on = fromBottom <= Math.floor(m.nm / (60 / ROWS)) + 1;
      el.className = (on || cur ? 'on' : '') + (cur ? ' cur' : '') + (m.inDay && h < m.nh || (!m.inDay && m.nh > H1) ? ' past' : '');
    });
    box.querySelectorAll('.ah-lcd__hrs span').forEach(s => s.classList.toggle('is-now', m.inDay && +s.dataset.h === m.nh));
    let live = 0;
    box.querySelectorAll('.ah-lcd__flags i').forEach(f => { const on = m.nowSet.has(f.dataset.t); f.classList.toggle('on', on); if (on) live++; });
    const T = box.querySelector('#ahLcdT'); if (T) T.innerHTML = `La lucru acum <b>${live}</b>/${D.teachers.length}`;
    const R = box.querySelector('#ahLcdR'); if (R && !box.classList.contains('is-read')) R.innerHTML = `În curs <b>${m.running}</b>`;
  }
  function lcdStart(root) {
    clearInterval(lcdTimer);
    const box = root.querySelector('.ah-lcd'); if (!box) return;
    let m = lcdModel(); lcdPaint(box, m);
    const L = box.querySelector('#ahLcdL'), R = box.querySelector('#ahLcdR'), rest = { L: L.innerHTML, R: R.innerHTML };
    // pointing at an hour reads its number out in the top line (stepped: it just changes)
    const read = h => { box.classList.add('is-read'); const n = m.count[m.hours.indexOf(h)]; L.innerHTML = `${pad2(h)}:00`; R.innerHTML = `Lecții <b>${n}</b>`; };
    box.querySelector('.ah-lcd__px').addEventListener('pointermove', e => { const c = e.target.dataset && e.target.dataset.c; if (c != null) read(H0 + Math.floor(+c / 3)); });
    box.querySelector('.ah-lcd__px').addEventListener('pointerleave', () => { box.classList.remove('is-read'); L.innerHTML = `Lecții azi <b>${m.total}</b>`; R.innerHTML = `În curs <b>${m.running}</b>`; });
    lcdTimer = setInterval(() => {
      if (!box.isConnected) { clearInterval(lcdTimer); return; }
      if (document.hidden) return;
      m = lcdModel(); lcdPaint(box, m);
    }, 30000);
    // the loop stops when the tab is hidden or the display has scrolled away
    const pause = on => box.classList.toggle('is-paused', on);
    document.addEventListener('visibilitychange', () => pause(document.hidden));
    if ('IntersectionObserver' in window) new IntersectionObserver(es => pause(!es[0].isIntersecting)).observe(box);
    lcdBooted = true;
  }

  window.AdminViews.acasa = {
    title: 'Acasă',
    icon: 'home',
    render(root, ctx) {
      const name = (ctx.auth && ctx.auth.displayName && ctx.auth.displayName()) || 'Administrator';
      const att = attention();
      root.innerHTML = `
        <header class="ax-head ah-head">
          <div class="ah-head__t">
            <p class="ah-eyebrow">${esc(new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
            <h1 class="ah-title">${greeting()}, ${esc(name)}</h1>
            <p class="ax-lede">Ce are nevoie de atenție azi, și drumul spre fiecare instrument.</p>
          </div>
          ${LCD_ON ? lcdHTML(lcdModel()) : ''}
        </header>

        <section aria-label="De rezolvat" class="ax-stats ah-att">
          ${att.map((a, i) => `
            <a class="ax-stat ah-att__item${a.warn ? ' is-warn' : ''}" href="${a.href}" data-arrive style="--i:${i};--pg:var(--ax-c-${esc(a.href.replace('#', '').split('?')[0])}, var(--ax-hi))">
              <span class="ax-stat__k">${ico(a.icon, 16)} ${esc(a.k)}</span>
              <span class="ax-stat__v">${nf.format(a.v)}</span>
              <span class="ax-stat__s">${esc(a.s)}</span>
              <span class="ah-att__go">${ico('arrow-right', 18)}</span>
            </a>`).join('')}
        </section>

        <div class="ah-grid">
          <section aria-labelledby="ahHubT">
            <div class="ax-h2-row"><h2 class="ax-h2" id="ahHubT">Instrumente</h2></div>
            <nav class="ah-hub">
              ${tiles().map((t, i) => `
                <a class="ah-tile" href="${t.href}" data-arrive style="--i:${i};--pg:var(--ax-c-${t.id})">
                  <span class="ah-tile__plate">${ico(t.icon, 32)}</span>
                  <b class="ah-tile__t">${esc(t.t)}</b>
                  <span class="ah-tile__d">${esc(t.d)}</span>
                </a>`).join('')}
            </nav>
          </section>
        </div>`;
      if (LCD_ON) lcdStart(root);
    }
  };
})();
