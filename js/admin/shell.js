/* ============================================================
   Mathorizon admin console: shell and router
   ============================================================
   Builds the sign panel (left), the top bar (crumb, demo switch,
   station clock) and routes #acasa / #orar / #elevi / #repartizare /
   #analitica / #disponibilitate / #profesori to the views registered in
   window.AdminViews (js/admin/views/*.js):

     AdminViews.orar = {
       title: 'Orar', icon: 'grid', lede: '...',
       badge: () => number | null,          // optional count on the sign
       render(root, ctx) { ... }            // ctx = { auth, query, rerender }
     }

   Pages outside admin.html (Adaugă exercițiu, Culegeri) use the same
   shell: <body class="ax" data-ax-page="exercitii"> and their content
   inside #axLegacy is moved into the main area.

   Access: only BMAuth.role === 'admin'; guests go to sign-in.
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI;
  const esc = U.esc, ico = U.ico;
  window.AdminViews = window.AdminViews || {};

  const NAV = [
    { group: 'Operațiuni', items: [
      { id: 'acasa', label: 'Acasă', icon: 'home' },
      { id: 'orar', label: 'Orar', icon: 'grid' },
      { id: 'elevi', label: 'Elevi', icon: 'users' },
      { id: 'repartizare', label: 'Repartizare', icon: 'door' },
      { id: 'receptie', label: 'Recepție', icon: 'monitor' },
      { id: 'disponibilitate', label: 'Disponibilitate', icon: 'clock' },
      { id: 'analitica', label: 'Analitică', icon: 'chart-column' },
      { id: 'calculator', label: 'Calculator', icon: 'calculator' }
    ] },
    { group: 'Platforma', items: [
      { id: 'profesori', label: 'Conturi', icon: 'user' },
      { id: 'exercitii', label: 'Adaugă exercițiu', icon: 'plus', href: 'admin-add-exercise.html' },
      { id: 'culegeri', label: 'Culegeri', icon: 'library', href: 'admin-culegeri.html' }
    ] }
  ];
  const ALL = NAV.flatMap(g => g.items);

  const external = document.body.dataset.axPage || null;
  let auth = null;
  let current = null;

  function initials(name) {
    const p = String(name || '').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }

  function navHTML(active) {
    return NAV.map(g => `
      <div class="ax-sign__group">
        <div class="ax-sign__title ax-hide-folded">${esc(g.group)}</div>
        <ul class="ax-nav">
          ${g.items.map(it => {
            const v = window.AdminViews[it.id];
            const n = v && v.badge ? v.badge() : null;
            const href = it.href || ('admin.html#' + it.id);
            return `<li><a class="ax-nav__a" href="${href}" data-route="${it.id}"${it.id === active ? ' aria-current="page"' : ''} title="${esc(it.label)}">
              <span class="ax-nav__pic">${ico(it.icon, 18)}</span>
              <span class="ax-nav__label">${esc(it.label)}</span>
              ${n ? `<span class="ax-nav__n" aria-label="${n} de rezolvat">${n}</span>` : ''}
              <span class="ax-nav__arrow">${ico('arrow-right', 16)}</span>
            </a></li>`;
          }).join('')}
        </ul>
      </div>`).join('');
  }

  function shellHTML() {
    const name = (auth && auth.displayName && auth.displayName()) || 'Administrator';
    return `
      <div class="ax-shell" id="axShell">
        <aside class="ax-sign" aria-label="Navigare consolă">
          <a class="ax-sign__brand" href="admin.html#acasa">
            <img class="ax-sign__logo" src="assets/images/MathorizonLogo-mark.png" alt="" width="312" height="165">
            <span class="ax-hide-folded"><b>MATHORIZON</b><small>Consolă de<br>administrare</small></span>
          </a>
          <nav id="axNav">${navHTML(external || 'acasa')}</nav>
          <div class="ax-sign__foot">
            <div class="ax-sign__user">
              <span class="ax-sign__avatar">${esc(initials(name))}</span>
              <span class="ax-hide-folded"><b>${esc(name)}</b><small>Administrator</small></span>
            </div>
            <div class="ax-sign__row">
              <a class="ax-sign__btn ax-sign__btn--site" href="capitole.html" data-browse title="Vezi site-ul">${ico('external', 16)}<span class="ax-btn-t">Vezi site-ul</span></a>
              <button type="button" class="ax-sign__btn ax-sign__btn--icon" id="axTheme" aria-label="Schimbă tema">${ico(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon', 16)}</button>
              <button type="button" class="ax-sign__btn ax-sign__btn--icon ax-fold-btn" id="axFold" aria-label="Restrânge meniul">${ico('panel', 16)}</button>
            </div>
            <button type="button" class="ax-sign__btn ax-sign__btn--demo" id="axDemoReset2" title="Resetează datele demo">${ico('refresh-cw', 16)}<span class="ax-btn-t">Resetează datele demo</span></button>
            <button type="button" class="ax-sign__btn ax-sign__btn--out" id="axLogout" title="Deconectare">${ico('log-out', 16)}<span class="ax-btn-t">Deconectare</span></button>
          </div>
        </aside>
        <div class="ax-main">
          <header class="ax-top">
            <button type="button" class="ax-icon-btn ax-top__menu" id="axMenu" aria-label="Deschide meniul">${ico('menu', 18)}</button>
            <div class="ax-top__crumb"><span>Consolă</span>${ico('chevron-right', 16)}<b id="axCrumb"></b></div>
            <div class="ax-top__right">
              ${external ? '' : `<span class="ax-demo" title="Date demo, generate în browser. Punctul verde: modificările se văd și pe celelalte dispozitive conectate. Galben: rămân doar pe acest dispozitiv. Set de date: ${window.AdminData.fingerprint}">
                <i aria-hidden="true"></i><b>Date demo</b>
                <button type="button" id="axDemoReset">Resetează</button>
              </span>`}
              <div class="ax-clock" aria-live="off"><b id="axTime"></b><small id="axDate"></small></div>
            </div>
          </header>
          <main class="ax-view" id="axView" tabindex="-1"></main>
        </div>
      </div>`;
  }

  /* ---- clock ---- */
  function tick() {
    const now = new Date();
    const t = document.getElementById('axTime');
    const d = document.getElementById('axDate');
    if (t) {
      const txt = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
      if (t.textContent !== txt) { const first = !t.textContent; t.textContent = txt; if (!first) { t.classList.remove('is-tick'); void t.offsetWidth; t.classList.add('is-tick'); } }
    }
    if (d) {
      const s = now.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
      d.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    }
  }

  /* ---- router ---- */
  function routeId() {
    const id = (location.hash.slice(1).split('?')[0] || 'acasa');
    return window.AdminViews[id] ? id : 'acasa';
  }

  function refreshNav(active, reveal) {
    const nav = document.getElementById('axNav');
    if (!nav) return;
    nav.innerHTML = navHTML(active || external || current);
    // "you are here" slides in only when the page really changed, not on every data refresh
    if (reveal && !calm()) { const a = nav.querySelector('[aria-current="page"]'); if (a) a.classList.add('is-new'); }
  }

  /* Changing tab: the old page fades out (150ms), the new one comes in with
     its blocks rising one after another. Re-renders on the same tab (filters,
     theme) stay instant. */
  const calm = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let leaveT = 0, enterT = 0;
  function render(fresh) {
    const root = document.getElementById('axView');
    if (!root || external) return;
    clearTimeout(leaveT);
    const next = routeId();
    if (next !== current && current && !calm()) {
      root.classList.remove('is-entering');
      root.classList.add('is-leaving');
      refreshNav(next, true); // the sign panel answers the click at once
      leaveT = setTimeout(() => { root.classList.remove('is-leaving'); paint(fresh); }, 150);
    } else {
      root.classList.remove('is-leaving');
      paint(fresh);
    }
  }

  function enter(root) {
    if (calm()) return;
    clearTimeout(enterT);
    // The entrance is put on the few blocks that move, not on the page container: a class on an
    // ancestor makes the browser re-check the style of every element below it (slow on big tables).
    requestAnimationFrame(() => {
      const blocks = [];
      Array.from(root.children).forEach(c => {
        if (!c.classList.contains('ax-fixsplit')) { blocks.push(c); return; }
        const col = c.querySelector(':scope > .ax-col');
        if (col) blocks.push(...col.children);
        const side = c.querySelector(':scope > .ax-rail, :scope > .rp-side');
        if (side) { side.classList.add('ax-in-side'); blocks.push(side); }
      });
      blocks.forEach((el, i) => { if (!el.classList.contains('ax-in-side')) { el.style.setProperty('--e', String(Math.min(i, 4))); el.classList.add('ax-in'); } });
      enterT = setTimeout(() => blocks.forEach(el => { el.classList.remove('ax-in', 'ax-in-side'); el.style.removeProperty('--e'); }), 1200);
      U.countUp(root);
    });
  }

  function paint(fresh) {
    const root = document.getElementById('axView');
    if (!root || external) return;
    const id = routeId();
    const view = window.AdminViews[id];
    const changed = id !== current;
    current = id;
    document.title = (view.title || 'Consolă') + ' | Mathorizon admin';
    document.getElementById('axCrumb').textContent = view.title || '';
    refreshNav();
    root.dataset.view = id;
    document.getElementById('axShell').dataset.view = id;
    document.getElementById('axShell').removeAttribute('data-tv');          // the TV mode belongs to the Recepție page only
    // pages that do not run on the generated demo data do not show the demo switch
    document.getElementById('axShell').toggleAttribute('data-nodemo', view.demo === false);
    root.classList.toggle('is-fresh', !!(fresh || changed));
    root.innerHTML = '';
    try {
      view.render(root, { auth, query: U.readQuery(), rerender: () => render(false) });
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="ax-empty"><b>Pagina nu s-a putut afișa.</b>${esc(e.message)}</div>`;
    }
    if (changed) { window.scrollTo(0, 0); root.focus({ preventScroll: true }); enter(root); }
    document.getElementById('axShell').classList.remove('is-nav-open');
  }

  function wire() {
    const shell = document.getElementById('axShell');
    try { if (localStorage.getItem('bm_ax_folded') === '1') shell.classList.add('is-folded'); } catch (e) {}
    document.getElementById('axFold').addEventListener('click', () => {
      // The layout switches to its final state at once (one reflow); the movement is
      // played on transforms and on the sign panel's width only, so it stays smooth
      // even on heavy pages. Main content and the sign panel slide by the same distance.
      const sign = shell.querySelector('.ax-sign');
      const from = sign.getBoundingClientRect().width;
      shell.classList.toggle('is-folded');
      const to = sign.getBoundingClientRect().width;
      try { localStorage.setItem('bm_ax_folded', shell.classList.contains('is-folded') ? '1' : '0'); } catch (e) {}
      if (calm() || innerWidth <= 960 || !sign.animate || from === to) return;
      const o = { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
      shell.classList.add('is-folding');
      sign.animate([{ width: from + 'px' }, { width: to + 'px' }], o);
      shell.querySelectorAll('.ax-top, .ax-view > :not(.ax-fixsplit), .ax-view .ax-fixsplit > .ax-col').forEach(el => {
        el.animate([{ transform: `translateX(${from - to}px)` }, { transform: 'none' }], o);
      });
      setTimeout(() => shell.classList.remove('is-folding'), o.duration + 40);
    });
    document.getElementById('axMenu').addEventListener('click', () => shell.classList.add('is-nav-open'));
    shell.addEventListener('click', e => { if (shell.classList.contains('is-nav-open') && e.target === shell) shell.classList.remove('is-nav-open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') shell.classList.remove('is-nav-open'); });
    document.getElementById('axTheme').addEventListener('click', e => {
      if (window.BM && BM.toggleTheme) BM.toggleTheme();
      e.currentTarget.innerHTML = ico(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon', 16);
      if (!external) render(false);
    });
    document.getElementById('axLogout').addEventListener('click', async () => {
      try { await auth.supabase.auth.signOut(); } catch (e) {}
      location.replace('auth.html');
    });
    // "Vezi site-ul": remember for this tab that the admin wants the site,
    // so the landing redirect does not send them back here.
    document.querySelector('[data-browse]').addEventListener('click', () => {
      try { sessionStorage.setItem('bm_admin_browse', '1'); } catch (e) {}
    });
    const resetDemo = () => {
      if (!confirm('Resetezi datele demo? Mutările și statusurile schimbate pe acest dispozitiv se pierd.')) return;
      window.AdminData.reset();
      U.toast('Datele demo au fost resetate.');
    };
    ['axDemoReset', 'axDemoReset2'].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener('click', resetDemo); });
    window.AdminData.onChange(() => refreshNav());
    // the teacher's register (another tab or another device) saved something: show it here at once,
    // but never under a field someone is typing in or a drawer that is open (it waits for that to end)
    let lastExt = 0, extWait = false;
    const typing = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && document.getElementById('axView').contains(a)) || !!document.querySelector('.ax-drawer'); };
    const showExternal = () => {
      if (external) return;
      if (typing()) { if (!extWait) { extWait = true; setTimeout(() => { extWait = false; showExternal(); }, 1200); } return; }
      refreshNav(); render(false);
      if (Date.now() - lastExt > 5000) U.toast('Date actualizate din Registrul profesorului.'); // one notice per burst of edits
      lastExt = Date.now();
    };
    document.addEventListener('bm:demo-external', showExternal);
    // links that load another document: let the page fade out first
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || calm()) return;
      let u; try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (u.origin !== location.origin || u.pathname === location.pathname) return;
      const view = document.getElementById('axView');
      if (!view) return;
      e.preventDefault();
      view.classList.add('is-leaving');
      setTimeout(() => { location.href = a.href; }, 150);
    });
    window.addEventListener('hashchange', () => render(false));
    tick();
    setInterval(tick, 15000);
  }

  /* ---- access ---- */
  function waitAuth() {
    return new Promise(res => {
      if (window._bmAuthReady) return res(window.BMAuth);
      document.addEventListener('bmauth:ready', () => res(window.BMAuth), { once: true });
    });
  }
  function waitRole(a) {
    return new Promise(res => {
      if (a.role) return res();
      const done = () => res();
      document.addEventListener('bmauth:profile', done, { once: true });
      setTimeout(done, 5000);
    });
  }

  function denied() {
    document.body.innerHTML = `
      <div class="ax-empty" style="padding-top:18vh">
        <b>Acces interzis</b>
        Consola este disponibilă doar pentru administratori.
        <div style="margin-top:18px"><a class="ax-btn ax-btn--dark" href="capitole.html">Înapoi la site</a></div>
      </div>`;
  }

  async function start() {
    try { sessionStorage.removeItem('bm_admin_browse'); } catch (e) {}
    auth = await waitAuth();
    if (!auth.user) { location.replace('auth.html?from=' + encodeURIComponent(location.pathname.split('/').pop() || 'admin.html')); return; }
    await waitRole(auth);
    if (auth.role !== 'admin') { denied(); return; }

    const legacy = document.getElementById('axLegacy');
    const loading = document.getElementById('axLoading');
    if (loading) loading.remove();
    const holder = document.createElement('div');
    holder.innerHTML = shellHTML();
    document.body.prepend(holder.firstElementChild);
    if (external) {
      const item = ALL.find(i => i.id === external);
      document.getElementById('axCrumb').textContent = item ? item.label : '';
      const view = document.getElementById('axView');
      view.dataset.view = external;
      document.getElementById('axShell').setAttribute('data-nodemo', '');
      document.getElementById('axShell').dataset.view = external;
      if (legacy) { view.appendChild(legacy); legacy.hidden = false; }
      enter(view);
    }
    wire();
    if (!external) render(true);
    document.dispatchEvent(new CustomEvent('ax:ready', { detail: { auth } }));
  }

  window.AdminShell = { refreshNav, render: () => render(false) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
