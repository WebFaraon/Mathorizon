/* ============================================================
   Mathorizon — Capitole page: the parts that are still vanilla
   ============================================================
   The page's CONTENT — hero, statistici, cardurile de capitole, banner-ul
   Simulare BAC — moved to React (src/capitole/, bundled into
   assets/react/). What's left here is the page furniture React
   deliberately does not own, because it hangs off the shared navbar that
   all five tabs use and that isn't migrated yet:

     · the Favorite / Istoric side panels (opened by favBtn / histBtn,
       which live inside partials/nav.html),
     · the back-to-top button,
     · ?panel=fav / ?panel=hist deep links,
     · recordVisit().

   Stats and chapter rendering used to live here too (renderStats,
   animateCount, renderChapters, fitCardTags) along with the
   'bmauth:synced' re-render. React reads the same BM.Storage data and
   listens to the same events now — see src/capitole/hooks/useCapitoleData.ts.
   ============================================================ */

(function() {
  'use strict';

  /* ---- Init ---- */
  function init() {
    initSearch();
    initPanelBtns();
    BM.Storage.recordVisit();
    BM.initScrollTop();
    openPanelFromUrl();
  }

  function openPanelFromUrl() {
    const p = new URLSearchParams(location.search).get('panel');
    if (!p) return;
    history.replaceState(null, '', location.pathname);
    if (p === 'fav')  openFavorites();
    if (p === 'hist') openHistory();
  }

  /* ---- Search ----
     Dormant: capitole.html has had no #searchInput for a while, so this
     returns immediately. Left in place (rather than deleted along with the
     stats/chapters rendering) because it's the only implementation of the
     exercise search that exists — if a search box comes back, it comes back
     here, or in React if that's where the box lands. */
  function initSearch() {
    const input  = document.getElementById('searchInput');
    const drop   = document.getElementById('searchDropdown');
    const clear  = document.getElementById('searchClear');
    if (!input) return;

    const handleSearch = BM.debounce(function() {
      const q = input.value.trim();
      clear.style.display = q ? '' : 'none';
      if (q.length < 2) {
        drop.classList.remove('open');
        return;
      }
      const results = searchExercises(q);
      renderSearchResults(results, q, drop);
    }, 200);

    input.addEventListener('input', handleSearch);

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        input.value = '';
        drop.classList.remove('open');
        clear.style.display = 'none';
      }
    });

    clear.addEventListener('click', () => {
      input.value = '';
      drop.classList.remove('open');
      clear.style.display = 'none';
      input.focus();
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) {
        drop.classList.remove('open');
      }
    });
  }

  function searchExercises(q) {
    const lower = q.toLowerCase();
    return BM.EXERCISES.filter(e =>
      e.title.toLowerCase().includes(lower) ||
      e.statement.toLowerCase().includes(lower) ||
      e.subcategoryId.includes(lower) ||
      e.categoryId.includes(lower)
    ).slice(0, 8);
  }

  function renderSearchResults(results, q, drop) {
    if (results.length === 0) {
      drop.innerHTML = `<div class="search-no-results">Niciun exercițiu găsit pentru „${BM.esc(q)}"</div>`;
      drop.classList.add('open');
      return;
    }

    const solved = BM.Storage.getSolved();
    drop.innerHTML = results.map(ex => {
      const cat = BM.getCategoryById(ex.categoryId);
      const sub = BM.getSubcategoryById(ex.categoryId, ex.subcategoryId);
      const isSolved = !!solved[ex.id];
      return `
        <div class="search-result-item"
             onclick="BM.gotoCategory('${ex.categoryId}', '${ex.subcategoryId}', '${ex.id}')">
          <span class="sri-badge" style="background:${cat?.color}1a;color:${cat?.color}">
            ${cat?.symbol || '?'}
          </span>
          <div class="sri-text">
            <div class="sri-title">${BM.esc(ex.title)}${ex._custom ? ` <span class="type-badge type-badge--custom" title="Adăugat din panoul admin">${icon('sparkles', { size: 16 })}</span>` : ''}</div>
            <div class="sri-cat">${BM.esc(cat?.name || '')} · ${BM.esc(sub?.name || ex.subcategoryId)}</div>
          </div>
          <div class="sri-diff">${BM.diffBadge(ex.difficulty)}</div>
          ${isSolved ? `<span>${icon('circle-check', { size: 16, className: 'icon--success' })}</span>` : ''}
        </div>
      `;
    }).join('');
    drop.classList.add('open');
  }

  /* ---- Panels (Favorites & History) ---- */
  function initPanelBtns() {
    document.getElementById('favBtn')?.addEventListener('click', openFavorites);
    document.getElementById('histBtn')?.addEventListener('click', openHistory);
  }
  // favBtn/histBtn live inside the async-injected nav (see js/nav-loader.js),
  // so the call in init() below (DOMContentLoaded-timed) finds them null —
  // this re-binds once they actually exist.
  BM.onNavReady(initPanelBtns);

  function openFavorites() {
    const favIds = BM.Storage.getFavorites();
    const list = document.getElementById('favList');
    if (!list) return;

    if (favIds.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icon('heart', { size: 48 })}</div>
          <p>Niciun exercițiu favorit încă.</p>
          <p class="text-muted">Apasă ${icon('heart', { size: 16 })} pe un exercițiu pentru a-l adăuga.</p>
        </div>`;
    } else {
      const exs = favIds.map(id => BM.EXERCISES.find(e => e.id === id)).filter(Boolean);
      list.innerHTML = exs.map(ex => renderPanelItem(ex)).join('');
    }
    BM.openPanel('fav');
  }

  function openHistory() {
    const hist = BM.Storage.getHistory();
    const list = document.getElementById('histList');
    if (!list) return;

    if (hist.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icon('clock', { size: 48 })}</div>
          <p>Nu ai rezolvat niciun exercițiu.</p>
          <p class="text-muted">Exercițiile rezolvate vor apărea aici.</p>
        </div>`;
    } else {
      list.innerHTML = hist.slice(0, 50).map(h => {
        const ex = BM.EXERCISES.find(e => e.id === h.id);
        return ex ? renderPanelItem(ex, h.ts) : '';
      }).join('');
    }
    BM.openPanel('hist');
  }

  window.clearHistory = function() {
    BM.Storage.clearHistory();
    const list = document.getElementById('histList');
    if (list) list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◷</div>
        <p>Nu ai rezolvat niciun exercițiu.</p>
        <p class="text-muted">Exercițiile rezolvate vor apărea aici.</p>
      </div>`;
    BM.toast('Istoricul a fost șters.', 'info');
  };

  function renderPanelItem(ex, ts) {
    const cat = BM.getCategoryById(ex.categoryId);
    return `
      <div class="panel-ex-item"
           onclick="BM.gotoCategory('${ex.categoryId}', '${ex.subcategoryId}', '${ex.id}')">
        <span style="font-size:1.3rem">${cat?.symbol || '?'}</span>
        <div class="panel-ex-item__info">
          <div class="panel-ex-item__title">${BM.esc(ex.title)}</div>
          <div class="panel-ex-item__meta">
            ${BM.esc(cat?.name || '')} · ${BM.diffBadge(ex.difficulty)}
          </div>
        </div>
        ${ts ? `<span class="panel-ex-item__date">${BM.formatDate(ts)}</span>` : ''}
      </div>
    `;
  }

  /* ---- Start ---- */
  const start = async () => {
    await (BM.customExercisesReady ? BM.customExercisesReady() : Promise.resolve());
    init();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
