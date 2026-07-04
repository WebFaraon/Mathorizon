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
    _updateStreakWhenReady();
    BM.initScrollTop();
    openPanelFromUrl();
  }

  // Calling BM.Storage.updateStreak() immediately (as this used to) raced
  // auth.js's DB sync: auth.js only swaps in the DB-syncing version of
  // updateStreak() after an async getSession() call, and _syncProgress()
  // ("DB e sursa de adevăr, suprascrie localul") then overwrites
  // localStorage with whatever's still in the DB — which, for a logged-in
  // user, is still yesterday's row, since today's local bump ran through
  // the original localStorage-only updateStreak before the override got
  // installed. Net effect: the streak silently reverted every single day,
  // looking permanently stuck. Wait for the sync to actually resolve (or
  // confirm there's no session to sync against) before updating.
  function _updateStreakWhenReady() {
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      BM.Storage.updateStreak();
      renderStats(false);
    };
    document.addEventListener('bmauth:synced', run, { once: true });
    document.addEventListener('bmauth:ready', (e) => {
      if (!e.detail?.user) run(); // no session → nothing will sync, safe now
    }, { once: true });
    // Fallback in case auth.js never loads/initializes (e.g. the Supabase
    // CDN script failed) — don't leave the streak stuck waiting forever on
    // an event that will never fire.
    setTimeout(run, 2500);
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
      streakEl.textContent = stats.streak > 0
        ? `🔥 ${stats.streak}`
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

      return `
        <div class="chapter-card" onclick="BM.gotoCategory('${cat.id}')"
             style="--card-color: ${cat.color}">
          <div class="chapter-card__top">
            <div class="chapter-card__icon" style="color:${cat.color};background:${cat.color}1a">
              ${cat.symbol}
            </div>
            <div class="chapter-card__count">
              ${prog.total} exerciții
            </div>
          </div>

          <div>
            <div class="chapter-card__name">${BM.esc(cat.name)}</div>
            <div class="chapter-card__desc">${BM.esc(cat.description)}</div>
          </div>

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
      grid.querySelectorAll('.chapter-card').forEach((card, i) => {
        card.style.animationDelay = `${i * 60}ms`;
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
            <div class="sri-title">${BM.esc(ex.title)}</div>
            <div class="sri-cat">${BM.esc(cat?.name || '')} · ${BM.esc(sub?.name || ex.subcategoryId)}</div>
          </div>
          <div class="sri-diff">${BM.diffBadge(ex.difficulty)}</div>
          ${isSolved ? '<span style="color:var(--green);font-size:0.85rem">✓</span>' : ''}
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

  function openFavorites() {
    const favIds = BM.Storage.getFavorites();
    const list = document.getElementById('favList');
    if (!list) return;

    if (favIds.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">♡</div>
          <p>Niciun exercițiu favorit încă.</p>
          <p class="text-muted">Apasă ♥ pe un exercițiu pentru a-l adăuga.</p>
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
          <div class="empty-icon">◷</div>
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
