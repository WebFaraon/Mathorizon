/* ============================================================
   Admin console: Acasă
   ============================================================
   Greeting with the date, what needs attention today (each sign a
   number and a direct link), the lessons of today on the room board,
   the three projects at a glance and the directions to every page.
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

  function todayBoard() {
    const day = todayId();
    const rows = D.rooms.map(r => {
      const gs = D.groups.filter(g => g.room === r.id && g.status !== 'inactiv' && g.days.includes(day)).sort((a, b) => a.start - b.start);
      return { r, gs };
    });
    const total = rows.reduce((t, x) => t + x.gs.length, 0);
    return `
      <section class="ax-panel ah-board" aria-labelledby="ahBoardT">
        <div class="ax-panel__head">
          <div><h2 class="ax-h2" id="ahBoardT">Azi în cabinete</h2><p class="ax-lede">${esc(D.DAYS[day - 1].name)}, Examen.md Offline · ${plural(total, 'lecție', 'lecții')}</p></div>
          <a class="ax-btn ax-btn--sm" href="#repartizare?day=${day}">Deschide repartizarea ${ico('arrow-right', 16)}</a>
        </div>
        <ol class="ah-board__rows">
          ${rows.map(({ r, gs }, i) => `
            <li class="ah-board__row" data-arrive style="--i:${i}">
              <span class="ah-room"><small>Cab.</small>${r.num}</span>
              <div class="ah-board__slots">
                ${gs.length ? gs.map(g => {
                  const t = D.teacher(g.teacher);
                  return `<a class="ah-slot" href="#repartizare?day=${day}&focus=${g.id}">
                    <b>${U.hh(g.start)}</b><span>${esc(t.last)} ${esc(t.first[0])}.</span><span class="ax-sub">${esc(g.subject)} ${esc(g.grade)}</span>
                  </a>`;
                }).join('') : '<span class="ah-free">Liber toată ziua</span>'}
              </div>
            </li>`).join('')}
        </ol>
      </section>`;
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

  const DIRECTIONS = [
    ['orar', 'grid', 'Orar', 'Grupele, programul și locurile libere'],
    ['elevi', 'users', 'Elevi', 'Prezențe, sold, manager și status'],
    ['repartizare', 'door', 'Repartizare', 'Cabinetele pe ore, cu mutare și verificare'],
    ['disponibilitate', 'clock', 'Disponibilitate', 'Când pot preda profesorii'],
    ['analitica', 'chart-column', 'Analitică', 'Distribuții, tendințe, tabele încrucișate'],
    ['profesori', 'user', 'Conturi', 'Cereri profesori, elevi, abonamente']
  ];

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
            <a class="ax-stat ah-att__item${a.warn ? ' is-warn' : ''}" href="${a.href}" data-arrive style="--i:${i}">
              <span class="ax-stat__k">${ico(a.icon, 16)} ${esc(a.k)}</span>
              <span class="ax-stat__v">${nf.format(a.v)}</span>
              <span class="ax-stat__s">${esc(a.s)}</span>
              <span class="ah-att__go">${ico('arrow-right', 18)}</span>
            </a>`).join('')}
        </section>

        <div class="ah-grid">
          ${todayBoard()}
          <div class="ah-side">
            <section aria-labelledby="ahProjT">
              <div class="ax-h2-row"><h2 class="ax-h2" id="ahProjT">Proiecte</h2></div>
              <div class="ah-projs">${projects()}</div>
            </section>
            <section aria-labelledby="ahDirT">
              <div class="ax-h2-row"><h2 class="ax-h2" id="ahDirT">Direcții</h2></div>
              <nav class="ah-dirs">
                ${DIRECTIONS.map(([id, ic, t, s], i) => `
                  <a class="ah-dir" href="#${id}" data-arrive style="--i:${i}">
                    <span class="ax-plate">${ico(ic, 20)}</span>
                    <span><b>${esc(t)}</b><span class="ax-sub">${esc(s)}</span></span>
                    ${ico('arrow-right', 18)}
                  </a>`).join('')}
              </nav>
            </section>
          </div>
        </div>`;
    }
  };
})();
