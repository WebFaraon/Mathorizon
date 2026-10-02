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
      { id: 'disponibilitate', label: 'Disponibilitate', icon: 'clock' },
      { id: 'analitica', label: 'Analitică', icon: 'chart-column' }
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
            <span class="ax-sign__mark">M</span>
            <span class="ax-hide-folded"><b>MATHORIZON</b><small>Consolă de administrare</small></span>
          </a>
          <nav id="axNav">${navHTML(external || 'acasa')}</nav>
          <div class="ax-sign__foot">
            <div class="ax-sign__user">
              <span class="ax-sign__avatar">${esc(initials(name))}</span>
              <span class="ax-hide-folded"><b>${esc(name)}</b><small>Administrator</small></span>
            </div>
            <div class="ax-sign__row">
              <a class="ax-sign__btn ax-hide-folded" href="capitole.html" data-browse>${ico('external', 16)} Vezi site-ul</a>
              <button type="button" class="ax-sign__btn ax-sign__btn--icon" id="axTheme" aria-label="Schimbă tema">${ico(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon', 16)}</button>
              <button type="button" class="ax-sign__btn ax-sign__btn--icon ax-fold-btn" id="axFold" aria-label="Restrânge meniul">${ico('panel', 16)}</button>
            </div>
            <button type="button" class="ax-sign__btn ax-hide-folded" id="axLogout">${ico('log-out', 16)} Deconectare</button>
          </div>
        </aside>
        <div class="ax-main">
          <header class="ax-top">
            <button type="button" class="ax-icon-btn ax-top__menu" id="axMenu" aria-label="Deschide meniul">${ico('menu', 18)}</button>
            <div class="ax-top__crumb"><span>Consolă</span>${ico('chevron-right', 16)}<b id="axCrumb"></b></div>
            <div class="ax-top__right">
              ${external ? '' : `<span class="ax-demo" title="Datele sunt generate în browser. Modificările rămân doar pe acest dispozitiv.">
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
    if (t) t.textContent = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
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

  function refreshNav() {
    const nav = document.getElementById('axNav');
    if (nav) nav.innerHTML = navHTML(external || current);
  }

  function render(fresh) {
    const root = document.getElementById('axView');
    if (!root || external) return;
    const id = routeId();
    const view = window.AdminViews[id];
    const changed = id !== current;
    current = id;
    document.title = (view.title || 'Consolă') + ' | Mathorizon admin';
    document.getElementById('axCrumb').textContent = view.title || '';
    refreshNav();
    root.classList.toggle('is-fresh', !!(fresh || changed));
    root.innerHTML = '';
    try {
      view.render(root, { auth, query: U.readQuery(), rerender: () => render(false) });
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="ax-empty"><b>Pagina nu s-a putut afișa.</b>${esc(e.message)}</div>`;
    }
    if (changed) { window.scrollTo(0, 0); root.focus({ preventScroll: true }); }
    document.getElementById('axShell').classList.remove('is-nav-open');
  }

  function wire() {
    const shell = document.getElementById('axShell');
    try { if (localStorage.getItem('bm_ax_folded') === '1') shell.classList.add('is-folded'); } catch (e) {}
    document.getElementById('axFold').addEventListener('click', () => {
      shell.classList.toggle('is-folded');
      try { localStorage.setItem('bm_ax_folded', shell.classList.contains('is-folded') ? '1' : '0'); } catch (e) {}
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
    const demoReset = document.getElementById('axDemoReset');
    if (demoReset) demoReset.addEventListener('click', () => {
      if (!confirm('Resetezi datele demo? Mutările și statusurile schimbate pe acest dispozitiv se pierd.')) return;
      window.AdminData.reset();
      U.toast('Datele demo au fost resetate.');
    });
    window.AdminData.onChange(() => refreshNav());
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
      if (legacy) { view.appendChild(legacy); legacy.hidden = false; }
    }
    wire();
    if (!external) render(true);
    document.dispatchEvent(new CustomEvent('ax:ready', { detail: { auth } }));
  }

  window.AdminShell = { refreshNav, render: () => render(false) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
