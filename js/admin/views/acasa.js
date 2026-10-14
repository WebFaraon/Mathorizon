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
    }
  };
})();
