/* ============================================================
   BACMath — Index Page Logic
   ============================================================ */

(function() {
  'use strict';

  /* ---- Init ---- */
  function init() {
    renderStats();
    renderChapters();
    initSearch();
    initPanelBtns();
    BM.Storage.recordVisit();
    // The daily streak bump itself now runs globally in auth.js (every
    // page, not just this one) — just refresh the displayed count once
    // it lands.
    document.addEventListener('bmauth:streak-updated', () => renderStats(false), { once: true });
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

  /* ---- Stats ---- */
  function renderStats(animated = true) {
    const stats = BM.Storage.getStats(BM.EXERCISES);

    if (animated) {
      animateCount('sTotal', stats.total);
      animateCount('sSolved', stats.solvedCount);
    } else {
      const tEl = document.getElementById('sTotal');
      const sEl = document.getElementById('sSolved');
      if (tEl) tEl.textContent = stats.total;
      if (sEl) sEl.textContent = stats.solvedCount;
    }

    const pctEl = document.getElementById('sPercent');
    if (pctEl) pctEl.textContent = stats.percent + '%';

    BM.updateProgressRing('progressRing', stats.percent);

    const streakEl = document.getElementById('sStreak');
    if (streakEl) {
      // innerHTML, not textContent — icon() returns markup, not plain text.
      streakEl.innerHTML = stats.streak > 0
        ? `${icon('flame', { size: 16, className: 'icon-num icon--gamify' })} ${stats.streak}`
        : '— 0';
    }
  }

  function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(timer);
    }, 30);
  }

  /* ---- Chapter cards ---- */
  function renderChapters() {
    const grid = document.getElementById('chaptersGrid');
    if (!grid) return;

    grid.innerHTML = BM.CATEGORIES.map(cat => {
      const prog = BM.Storage.getProgressForCategory(cat.id, BM.EXERCISES);
      const subcatNames = cat.subcategories.slice(0, 3).map(s => s.name);
      const isEmpty = prog.total === 0;

      return `
        <div class="chapter-card${isEmpty ? ' chapter-card--soon' : ''}" ${isEmpty ? '' : `onclick="BM.gotoCategory('${cat.id}')"`}
             style="--card-color: ${cat.color}">
          <div class="chapter-card__top">
            <div class="chapter-card__icon" style="color:${cat.color};background:${cat.color}1a">
              ${cat.symbol}
            </div>
            <div class="chapter-card__count">
              ${isEmpty ? 'În curând' : prog.total + ' exerciții'}
            </div>
          </div>

          <div class="chapter-card__name">${BM.esc(cat.name)}</div>
          <div class="chapter-card__desc">${BM.esc(cat.tagline || cat.description)}</div>

          <div class="chapter-card__tags">
            ${subcatNames.map(n => `<span class="tag">${BM.esc(n)}</span>`).join('')}
            ${cat.subcategories.length > 3
              ? `<span class="tag">+${cat.subcategories.length - 3} tipuri</span>`
              : ''}
          </div>

          <div class="chapter-card__footer">
            <div class="progress-track">
              <div class="progress-bar" style="width:${prog.percent}%"></div>
            </div>
            <div class="progress-label">
              <span>${prog.solved} / ${prog.total} rezolvate</span>
              <span>${prog.percent}%</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    /* Stagger chapter card entry + animate progress bars */
    requestAnimationFrame(() => {
      const cards = grid.querySelectorAll('.chapter-card');
      cards.forEach((card, i) => {
        card.style.animationDelay = `${i * 60}ms`;
        fitCardTags(card, BM.CATEGORIES[i]);
      });
      grid.querySelectorAll('.progress-bar').forEach(bar => {
        const w = bar.style.width;
        bar.style.width = '0';
        requestAnimationFrame(() => { bar.style.width = w; });
      });
    });

    /* Mouse-follow glow */
    grid.querySelectorAll('.chapter-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', (e.clientX - r.left) + 'px');
        card.style.setProperty('--mouse-y', (e.clientY - r.top) + 'px');
      });
    });

    const bacCard = document.getElementById('bacSimCard');
    if (bacCard) {
      bacCard.addEventListener('mousemove', e => {
        const r = bacCard.getBoundingClientRect();
        bacCard.style.setProperty('--mouse-x', (e.clientX - r.left) + 'px');
        bacCard.style.setProperty('--mouse-y', (e.clientY - r.top) + 'px');
      });
    }
  }

  /* Trims a card's subcategory tags down until they all sit on one visual
     row, collapsing whatever doesn't fit into a single "+N tipuri" tag.
     Driven by real layout (offsetTop), not an estimated character budget —
     Romanian diacritics/kerning make width guessing unreliable, and this
     way it stays correct if a subcategory gets renamed later. Must run
     after the card is in the DOM (offsetTop needs real layout). */
  function fitCardTags(card, cat) {
    const wrap = card.querySelector('.chapter-card__tags');
    if (!wrap || !cat) return;
    const names = cat.subcategories.map(s => s.name);
    if (names.length === 0) return;

    const render = n => {
      const hidden = names.length - n;
      wrap.innerHTML = names.slice(0, n).map(name => `<span class="tag">${BM.esc(name)}</span>`).join('') +
        (hidden > 0 ? `<span class="tag">+${hidden} tipuri</span>` : '');
    };

    let shown = Math.min(3, names.length);
    render(shown);
    while (shown > 1) {
      const tags = wrap.children;
      const firstTop = tags[0].offsetTop;
      let wrapped = false;
      for (let i = 1; i < tags.length; i++) {
        if (tags[i].offsetTop !== firstTop) { wrapped = true; break; }
      }
      if (!wrapped) break;
      shown--;
      render(shown);
    }
  }

  /* ---- Search ---- */
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


  /* ---- Re-render după sync cu DB ---- */
  document.addEventListener('bmauth:synced', () => {
    renderStats(false);
    /* Actualizăm progresul cardurilor în-place — fără re-render, fără animație */
    const grid = document.getElementById('chaptersGrid');
    if (grid) {
      const cards = grid.querySelectorAll('.chapter-card');
      BM.CATEGORIES.forEach((cat, i) => {
        const card = cards[i];
        if (!card) return;
        const prog = BM.Storage.getProgressForCategory(cat.id, BM.EXERCISES);
        const bar   = card.querySelector('.progress-bar');
        const label = card.querySelector('.progress-label');
        if (bar)   bar.style.width   = prog.percent + '%';
        if (label) label.innerHTML   =
          `<span>${prog.solved} / ${prog.total} rezolvate</span>` +
          `<span>${prog.percent}%</span>`;
      });
    }
  });

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
