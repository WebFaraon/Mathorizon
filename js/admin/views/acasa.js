/* ============================================================
   Admin console: Acasă
   ============================================================
   Greeting with the date, what needs attention today (each sign a
   number and a direct link), the three projects at a glance on the
   left and, in the middle, big tiles that lead to every other page.
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

  function projects() {
    return D.PROJECTS.map((p, i) => {
      const gs = D.groups.filter(g => g.project === p.id);
      const act = gs.filter(g => g.status === 'activ').length;
      const ids = new Set(gs.map(g => g.id));
      const st = D.students.filter(s => ids.has(s.group) && s.status === 'activ').length;
      const share = U.pct(act, gs.length);
      return `
        <a class="ah-proj" href="#orar?project=${p.id}" data-arrive style="--i:${i}">
          <span class="ax-line ax-line--${p.id}">${esc(p.name)}</span>
          <span class="ah-proj__v"><b>${nf.format(act)}</b> grupe active din ${nf.format(gs.length)}</span>
          <span class="ah-proj__bar" aria-hidden="true"><i style="width:${share}%"></i></span>
          <span class="ax-sub">${plural(st, 'elev activ', 'elevi activi')} · ${p.mode === 'offline' ? 'în cabinete' : 'online'}</span>
        </a>`;
    }).join('');
  }

  /* one big tile per page: icon plate in the page colour, what it is for,
     and one live figure so the tile also says something before you open it */
  function tiles() {
    const day = todayId();
    const liveToday = D.groups.filter(g => g.status !== 'inactiv' && g.days.includes(day));
    const clash = D.conflicts(day).length;
    const activeStudents = D.students.filter(s => s.status === 'activ').length;
    return [
      { id: 'orar', href: '#orar', icon: 'grid', t: 'Orar', d: 'Grupele cu programul, profesorul și locurile libere.', fig: nf.format(D.groups.length), unit: 'grupe' },
      { id: 'elevi', href: '#elevi', icon: 'users', t: 'Elevi', d: 'Prezențe, sold, manager și statutul fiecărui elev.', fig: nf.format(D.students.length), unit: 'elevi' },
      { id: 'repartizare', href: '#repartizare?day=' + day, icon: 'door', t: 'Repartizare', d: 'Cabinetele pe ore, cu mutare și verificare automată.', fig: nf.format(liveToday.length), unit: clash ? `lecții azi, ${plural(clash, 'suprapunere', 'suprapuneri')}` : 'lecții azi' },
      { id: 'disponibilitate', href: '#disponibilitate', icon: 'clock', t: 'Disponibilitate', d: 'Când pot preda profesorii și cine e liber la o oră.', fig: nf.format(D.teachers.length), unit: 'profesori' },
      { id: 'analitica', href: '#analitica', icon: 'chart-column', t: 'Analitică', d: 'Distribuții, tendințe și tabele încrucișate.', fig: U.pct(activeStudents, D.students.length) + '%', unit: 'elevi activi' },
      { id: 'profesori', href: '#profesori', icon: 'user', t: 'Conturi', d: 'Cereri de profesor, elevi, abonamente și waitlist.', fig: 'Date reale', unit: '' },
      { id: 'exercitii', href: 'admin-add-exercise.html', icon: 'plus', t: 'Adaugă exercițiu', d: 'Un exercițiu nou în culegere, cu barem generat.', fig: 'Culegere', unit: '' },
      { id: 'calculator', href: '#calculator', icon: 'calculator', t: 'Calculator', d: 'Transfer, înlocuire și retur: sumele împărțite proporțional.', fig: 'Transfer', unit: 'înlocuire · retur' },
      { id: 'culegeri', href: 'admin-culegeri.html', icon: 'library', t: 'Culegeri', d: 'Culegerile existente și exercițiile din ele.', fig: 'Bibliotecă', unit: '' }
    ];
  }

  window.AdminViews.acasa = {
    title: 'Acasă',
    icon: 'home',
    render(root, ctx) {
      const name = (ctx.auth && ctx.auth.displayName && ctx.auth.displayName()) || 'Administrator';
      const att = attention();
      root.innerHTML = `
        <header class="ax-head ah-head">
          <div>
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
          <aside class="ah-side" aria-labelledby="ahProjT">
            <div class="ax-h2-row"><h2 class="ax-h2" id="ahProjT">Proiecte</h2></div>
            <div class="ah-projs">${projects()}</div>
          </aside>
          <section aria-labelledby="ahHubT">
            <div class="ax-h2-row"><h2 class="ax-h2" id="ahHubT">Instrumente</h2></div>
            <nav class="ah-hub">
              ${tiles().map((t, i) => `
                <a class="ah-tile" href="${t.href}" data-arrive style="--i:${i};--pg:var(--ax-c-${t.id})">
                  <span class="ah-tile__top">
                    <span class="ah-tile__plate">${ico(t.icon, 28)}</span>
                    <span class="ah-tile__go" aria-hidden="true">${ico('arrow-right', 20)}</span>
                  </span>
                  <b class="ah-tile__t">${esc(t.t)}</b>
                  <span class="ah-tile__d">${esc(t.d)}</span>
                  <span class="ah-tile__fig"><b>${esc(t.fig)}</b>${t.unit ? `<small>${esc(t.unit)}</small>` : ''}</span>
                </a>`).join('')}
            </nav>
          </section>
        </div>`;
    }
  };
})();
