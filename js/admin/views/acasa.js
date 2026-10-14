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

  /* ---- the building, drawn as a plan, behind the greeting (preview: admin.html?viu=1) ----
     Pure decoration, no data: two rows of cabinets on either side of a corridor, thin walls drawn once on arrival, doors that swing open and shut, seats that fill with the
     console's page colours, and a few small squares (a group) that walk the corridor, step into a cabinet and come back out: the cabinet tints and its door opens while they are in.
     Everything is generated here from a few numbers; it is aria-hidden, behind the content, fades out to the left and below, and stops when the tab is hidden. */
  const PLAN_ON = /[?&]viu=1\b/.test(location.search);
  let planBooted = false, planWired = false;
  function planHTML() {
    // one row of seven cabinets above a corridor; the corridor's lower wall is the edge of the building
    const X = [10, 122, 236, 340, 452, 560, 646, 710], Y0 = 6, YA = 94, YB = 134, YC = 114, GAP = 28, YIN = 62;
    const PG = ['orar', 'elevi', 'inscriere', 'repartizare', 'inlocuiri', 'receptie', 'disponibilitate', 'analitica', 'calculator', 'culegeri', 'exercitii', 'profesori'];
    const mid = (a, b) => Math.round((a + b) / 2);
    const walls = [], doors = [], seats = [], tints = [], walkers = [];
    const w = (x1, y1, x2, y2) => walls.push(`<path class="ah-pl__w" pathLength="1" d="M${x1} ${y1}L${x2} ${y2}" style="--i:${walls.length}"/>`);
    w(10, Y0, 710, Y0); w(10, YB, 710, YB); w(10, Y0, 10, YB); w(710, Y0, 710, YB);
    X.slice(1, -1).forEach(x => w(x, Y0, x, YA));
    const rooms = X.slice(0, -1).map((x, i) => ({ i, x, w: X[i + 1] - x, cx: mid(x, X[i + 1]) }));
    // the corridor's upper wall, with a gap for every door
    let wx = 10; rooms.forEach(r => { w(wx, YA, r.cx - GAP / 2, YA); wx = r.cx + GAP / 2; }); w(wx, YA, 710, YA);
    // which cabinets a walker visits: [cabinet, enters from the left?, seconds, delay]
    const visits = [[1, true, 34, -6], [2, false, 38, -19], [4, false, 31, -12], [0, true, 41, -28], [5, true, 36, -23], [3, false, 33, -2]];
    const visit = new Map(visits.map((v, n) => [v[0], { n, dur: v[2], dly: v[3] }]));
    rooms.forEach(r => {
      const hx = r.cx - GAP / 2, ox = (hx + GAP * Math.cos(68 * Math.PI / 180)).toFixed(1), oy = (YA - GAP * Math.sin(68 * Math.PI / 180)).toFixed(1), v = visit.get(r.i);
      const timing = v ? `animation-name:ah-door-walk;animation-duration:${v.dur}s;animation-delay:${v.dly}s` : `animation-duration:${19 + (r.i * 7) % 17}s;animation-delay:${-((r.i * 5 + 3) % 13)}s`;
      doors.push(`<g class="ah-pl__door"><path class="ah-pl__arc" d="M${hx + GAP} ${YA}A${GAP} ${GAP} 0 0 0 ${ox} ${oy}"/><line class="ah-pl__leaf" x1="${hx}" y1="${YA}" x2="${hx + GAP}" y2="${YA}" style="transform-origin:${hx}px ${YA}px;--a:-68deg;${timing}"/></g>`);
      // seats: six in a block, some of them fill in turn
      for (let a = 0; a < 2; a++) for (let c = 0; c < 3; c++) {
        const n = r.i * 6 + a * 3 + c, color = PG[(n * 5 + 2) % PG.length], live = n % 3 !== 0, dur = 17 + (n * 7) % 19, dly = -((n * 11) % 23);
        seats.push(`<rect class="ah-pl__s${live ? ' is-live' : ''}" x="${r.cx - 20 + c * 16}" y="${Y0 + 14 + a * 16}" width="8" height="8" rx="1" style="--c:var(--ax-c-${color});--t:${dur}s;--d:${dly}s"/>`);
      }
    });
    // walkers: each follows one cabinet's tint and door (same duration and delay), so they arrive together
    visits.forEach(([i, fromLeft, dur, dly], n) => {
      const r = rooms[i], sx = fromLeft ? 10 : 710, ex = fromLeft ? 710 : 10, color = PG[(n * 3 + 1) % PG.length];
      const leg1 = Math.abs(r.cx - sx), depth = YC - YIN, total = leg1 + depth * 2 + Math.abs(ex - r.cx), f1 = ((leg1 + depth) / total * 100).toFixed(2) + '%';
      tints.push(`<rect class="ah-pl__tint" x="${r.x}" y="${Y0}" width="${r.w}" height="${YA - Y0}" style="--c:var(--ax-c-${color});--t:${dur}s;--d:${dly}s"/>`);
      walkers.push(`<i class="ah-pl__p" style="--c:var(--ax-c-${color});--path:path('M${sx} ${YC}L${r.cx} ${YC}L${r.cx} ${YIN}L${r.cx} ${YC}L${ex} ${YC}');--f1:${f1};--t:${dur}s;--d:${dly}s"></i>`);
    });
    return `<div class="ah-pl${planBooted ? '' : ' is-boot'}" aria-hidden="true">
      <svg viewBox="0 0 720 150" width="720" height="150" focusable="false">${tints.join('')}<g class="ah-pl__walls">${walls.join('')}</g>${doors.join('')}${seats.join('')}</svg>${walkers.join('')}
    </div>`;
  }
  function planStart(root) {
    const box = root.querySelector('.ah-pl'); if (!box) return;
    planBooted = true;
    if (!planWired) {
      planWired = true;
      document.addEventListener('visibilitychange', () => { const b = document.querySelector('.ah-pl'); if (b) b.classList.toggle('is-paused', document.hidden); });
    }
  }

  window.AdminViews.acasa = {
    title: 'Acasă',
    icon: 'home',
    render(root, ctx) {
      const name = (ctx.auth && ctx.auth.displayName && ctx.auth.displayName()) || 'Administrator';
      const att = attention();
      root.innerHTML = `
        <header class="ax-head ah-head">
          ${PLAN_ON ? planHTML() : ''}
          <div class="ah-head__t">
            <p class="ah-eyebrow">${esc(new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
            <h1 class="ah-title">${greeting()}, ${esc(name)}</h1>
            <p class="ax-lede">Ce are nevoie de atenție azi, și drumul spre fiecare instrument.</p>
          </div>
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
      if (PLAN_ON) planStart(root);
    }
  };
})();
