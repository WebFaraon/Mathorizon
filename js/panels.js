(function () {
  'use strict';

  function injectPanelHTML() {
    if (document.getElementById('panel-fav')) return;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'panelOverlay';
    overlay.onclick = () => BM.closeAllPanels();
    document.body.appendChild(overlay);

    document.body.insertAdjacentHTML('beforeend', `
      <aside class="panel" id="panel-fav">
        <div class="panel__head">
          <h3>Exerciții Favorite</h3>
          <button class="icon-btn" onclick="BM.closeAllPanels()" title="Închide">✕</button>
        </div>
        <div class="panel__body" id="favList">
          <div class="empty-state">
            <div class="empty-icon">♡</div>
            <p>Niciun exercițiu favorit încă.</p>
            <p class="text-muted">Apasă ♥ pe un exercițiu pentru a-l adăuga.</p>
          </div>
        </div>
      </aside>
      <aside class="panel" id="panel-hist">
        <div class="panel__head">
          <h3>Istoric Rezolvări</h3>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn btn--surface" style="font-size:0.75rem;padding:4px 10px;height:32px"
                    onclick="clearPanelHistory()" title="Șterge istoricul">Șterge tot</button>
            <button class="icon-btn" onclick="BM.closeAllPanels()" title="Închide">✕</button>
          </div>
        </div>
        <div class="panel__body" id="histList">
          <div class="empty-state">
            <div class="empty-icon">◷</div>
            <p>Nu ai rezolvat niciun exercițiu.</p>
            <p class="text-muted">Exercițiile rezolvate vor apărea aici.</p>
          </div>
        </div>
      </aside>
    `);
  }

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

  window.openFavoritesPanel = function () {
    injectPanelHTML();
    const favIds = BM.Storage.getFavorites();
    const list = document.getElementById('favList');
    if (favIds.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">♡</div>
        <p>Niciun exercițiu favorit încă.</p>
        <p class="text-muted">Apasă ♥ pe un exercițiu pentru a-l adăuga.</p></div>`;
    } else {
      const exs = favIds.map(id => BM.EXERCISES.find(e => e.id === id)).filter(Boolean);
      list.innerHTML = exs.map(ex => renderPanelItem(ex)).join('');
    }
    BM.openPanel('fav');
  };

  window.openHistoryPanel = function () {
    injectPanelHTML();
    const hist = BM.Storage.getHistory();
    const list = document.getElementById('histList');
    if (hist.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">◷</div>
        <p>Nu ai rezolvat niciun exercițiu.</p>
        <p class="text-muted">Exercițiile rezolvate vor apărea aici.</p></div>`;
    } else {
      list.innerHTML = hist.slice(0, 50).map(h => {
        const ex = BM.EXERCISES.find(e => e.id === h.id);
        return ex ? renderPanelItem(ex, h.ts) : '';
      }).join('');
    }
    BM.openPanel('hist');
  };

  window.clearPanelHistory = function () {
    BM.Storage.clearHistory();
    const list = document.getElementById('histList');
    if (list) list.innerHTML = `<div class="empty-state"><div class="empty-icon">◷</div>
      <p>Nu ai rezolvat niciun exercițiu.</p>
      <p class="text-muted">Exercițiile rezolvate vor apărea aici.</p></div>`;
    BM.toast('Istoricul a fost șters.', 'info');
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('favBtn')?.addEventListener('click', openFavoritesPanel);
    document.getElementById('histBtn')?.addEventListener('click', openHistoryPanel);
  });
})();
