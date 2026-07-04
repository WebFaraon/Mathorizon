/* ============================================================
   BACMath — Training Page Logic
   ============================================================ */

(function() {
  'use strict';

  let selectedCount     = 10;
  let selectedCats      = new Set();
  let selectedDiff      = 'all';
  let sessionExercises  = [];
  let currentIndex      = 0;
  let startTime         = null;
  let solvedInSession   = new Set();

  /* ---- Init ---- */
  const UNLOCKED_CATS = new Set(['algebra']);

  function init() {
    renderConfig();
    UNLOCKED_CATS.forEach(id => selectedCats.add(id));
    updateChapterUI();
    BM.initScrollTop();
  }

  /* ---- Render config panel ---- */
  function renderConfig() {
    /* Count chips */
    const countBox = document.getElementById('countChips');
    if (countBox) {
      [5, 10, 15, 20].forEach(n => {
        const btn = document.createElement('button');
        btn.className = 'config-chip' + (n === selectedCount ? ' selected' : '');
        btn.textContent = n;
        btn.onclick = () => {
          selectedCount = n;
          countBox.querySelectorAll('.config-chip').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        };
        countBox.appendChild(btn);
      });
    }

    /* Difficulty chips */
    const diffBox = document.getElementById('diffChips');
    if (diffBox) {
      [
        { id: 'all',   label: 'Toate' },
        { id: 'usor',  label: 'Ușor' },
        { id: 'mediu', label: 'Mediu' },
        { id: 'greu',  label: 'Greu' }
      ].forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'config-chip' + (d.id === selectedDiff ? ' selected' : '');
        btn.textContent = d.label;
        btn.onclick = () => {
          selectedDiff = d.id;
          diffBox.querySelectorAll('.config-chip').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        };
        diffBox.appendChild(btn);
      });
    }

    /* Chapter list */
    const chList = document.getElementById('chapterList');
    if (chList) {
      BM.CATEGORIES.forEach(cat => {
        const locked = !UNLOCKED_CATS.has(cat.id);
        const item = document.createElement('div');
        item.className = 'config-chapter-item' + (locked ? ' config-chapter-item--locked' : ' selected');
        item.id = `cat-item-${cat.id}`;
        item.innerHTML = `
          <span class="config-chapter-icon" style="color:${cat.color}">${cat.symbol}</span>
          <span class="config-chapter-name">${BM.esc(cat.name)}</span>
          ${locked
            ? '<span class="config-chapter-lock">🔒</span><span class="config-chapter-soon">În curând</span>'
            : '<span class="config-chapter-check">✓</span>'}
        `;
        item.onclick = locked
          ? () => BM.toast('Exercițiile pentru acest capitol vor fi disponibile în curând.', 'info')
          : () => toggleCat(cat.id, item);
        chList.appendChild(item);
      });
    }
  }

  function toggleCat(id, el) {
    if (!UNLOCKED_CATS.has(id)) return;
    if (selectedCats.has(id)) {
      if (selectedCats.size <= 1) {
        BM.toast('Selectează cel puțin un capitol.', 'error');
        return;
      }
      selectedCats.delete(id);
      el.classList.remove('selected');
      el.querySelector('.config-chapter-check').textContent = '';
    } else {
      selectedCats.add(id);
      el.classList.add('selected');
      el.querySelector('.config-chapter-check').textContent = '✓';
    }
  }

  function updateChapterUI() {
    BM.CATEGORIES.forEach(cat => {
      const item = document.getElementById(`cat-item-${cat.id}`);
      if (!item) return;
      if (selectedCats.has(cat.id)) {
        item.classList.add('selected');
        item.querySelector('.config-chapter-check').textContent = '✓';
      }
    });
  }

  /* ---- Start training ---- */
  window.startTraining = function() {
    let pool = BM.EXERCISES.filter(e => {
      if (!selectedCats.has(e.categoryId)) return false;
      if (selectedDiff !== 'all' && e.difficulty !== selectedDiff) return false;
      return true;
    });

    if (pool.length === 0) {
      BM.toast('Niciun exercițiu disponibil cu filtrele selectate!', 'error');
      return;
    }

    pool = BM.shuffle(pool);
    sessionExercises = pool.slice(0, Math.min(selectedCount, pool.length));
    currentIndex = 0;
    solvedInSession = new Set();
    startTime = Date.now();

    document.getElementById('configView').classList.add('hidden');
    document.getElementById('sessionView').classList.remove('hidden');
    document.getElementById('resultsView').classList.remove('active');

    renderSessionExercise();
  };

  /* ---- Render current exercise ---- */
  function renderSessionExercise() {
    const total = sessionExercises.length;
    const idx   = currentIndex;
    const ex    = sessionExercises[idx];
    if (!ex) { finishSession(); return; }

    /* Progress */
    const pct = Math.round(((idx) / total) * 100);
    document.getElementById('sessionCounter').textContent = `${idx + 1} / ${total}`;
    document.getElementById('sessionFill').style.width = pct + '%';

    const cat = BM.getCategoryById(ex.categoryId);
    const sub = BM.getSubcategoryById(ex.categoryId, ex.subcategoryId);
    const isSolvedGlobal = BM.Storage.isSolved(ex.id);
    const isSolvedNow    = solvedInSession.has(ex.id);

    const card = document.getElementById('sessionCard');
    if (!card) return;

    card.innerHTML = `
      <div class="ex-card ${isSolvedGlobal ? 'solved' : ''}" id="tr-card-${ex.id}">
        <div class="ex-card__head" style="cursor:default">
          <div class="ex-card__left">
            <div class="ex-card__meta">
              ${BM.diffBadge(ex.difficulty)}
              <span class="type-badge">${BM.esc(sub?.name || ex.subcategoryId)}</span>
              <span class="source-text">${BM.esc(ex.source)}</span>
              ${cat ? `<span class="type-badge" style="background:${cat.color}1a;color:${cat.color}">${BM.esc(cat.name)}</span>` : ''}
            </div>
            <div class="ex-card__title">${BM.esc(ex.title)}</div>
          </div>
          <div class="ex-card__actions">
            <button class="ex-action-btn fav ${BM.Storage.isFavorite(ex.id) ? 'active' : ''}"
                    onclick="trToggleFav('${ex.id}', this)" title="Favorite">
              ${BM.Storage.isFavorite(ex.id) ? '♥' : '♡'}
            </button>
          </div>
        </div>

        <div style="padding:0 20px 20px">
          <div class="ex-card__statement math-content" id="tr-stmt-${ex.id}">${BM.trustedNl2br(ex.statement)}</div>
          <div class="ex-card__solution math-content" id="tr-sol-${ex.id}"></div>
          <div class="ex-card__foot" style="margin-top:0">
            <button class="btn btn--ghost" onclick="trToggleSolution('${ex.id}')">
              💡 Arată soluția
            </button>
            <button class="btn btn--success ${(isSolvedGlobal || isSolvedNow) ? 'active' : ''}"
                    id="tr-solve-${ex.id}"
                    onclick="trToggleSolved('${ex.id}', this)">
              ${(isSolvedGlobal || isSolvedNow) ? '✓ Rezolvat' : 'Marchează ca rezolvat'}
            </button>
          </div>
        </div>
      </div>
    `;

    /* Randăm math în cardul curent */
    BM.renderMath(card);

    /* Nav buttons */
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.textContent = idx === total - 1 ? '🏁 Finalizează' : 'Următorul →';
  }

  window.trToggleSolution = function(id) {
    const sol = document.getElementById(`tr-sol-${id}`);
    const ex  = BM.EXERCISES.find(e => e.id === id);
    if (!sol || !ex) return;
    if (sol.classList.contains('visible')) {
      sol.classList.remove('visible'); sol.innerHTML = '';
    } else {
      sol.innerHTML = BM.trustedNl2br(ex.solution);
      sol.classList.add('visible');
      BM.renderMath(sol);
    }
  };

  window.trToggleSolved = function(id, btn) {
    const nowSolved = BM.Storage.toggleSolved(id);
    if (nowSolved) {
      solvedInSession.add(id);
    } else {
      solvedInSession.delete(id);
    }
    if (btn) {
      btn.classList.toggle('active', nowSolved);
      btn.textContent = nowSolved ? '✓ Rezolvat' : 'Marchează ca rezolvat';
    }
    BM.toast(nowSolved ? '✓ Rezolvat!' : 'Marcat ca nerezolvat.', nowSolved ? 'success' : 'info');
  };

  window.trToggleFav = function(id, btn) {
    const nowFav = BM.Storage.toggleFavorite(id);
    if (btn) {
      btn.classList.toggle('active', nowFav);
      btn.textContent = nowFav ? '♥' : '♡';
    }
    BM.toast(nowFav ? 'Adăugat la favorite! ♥' : 'Eliminat din favorite.', 'info');
  };

  /* ---- Navigation ---- */
  window.prevExercise = function() {
    if (currentIndex > 0) {
      currentIndex--;
      renderSessionExercise();
    }
  };

  window.nextExercise = function() {
    if (currentIndex < sessionExercises.length - 1) {
      currentIndex++;
      renderSessionExercise();
    } else {
      finishSession();
    }
  };

  /* ---- Finish ---- */
  function finishSession() {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const total   = sessionExercises.length;
    const solved  = solvedInSession.size;
    const pct     = total > 0 ? Math.round((solved / total) * 100) : 0;

    document.getElementById('sessionView').classList.add('hidden');
    const resView = document.getElementById('resultsView');
    resView.classList.add('active');

    const icon   = pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚';
    const title  = pct >= 80 ? 'Excelent!' : pct >= 50 ? 'Bine!' : 'Continuă să exersezi!';
    const sub    = pct >= 80
      ? 'Ai rezolvat majoritatea exercițiilor. Ești pe drumul cel bun!'
      : pct >= 50
      ? 'Progres bun! Mai exersează capitolele dificile.'
      : 'Nu te descuraja. Practica face perfectă!';

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    resView.innerHTML = `
      <div class="results-header">
        <div class="results-icon">${icon}</div>
        <div class="results-title">${title}</div>
        <div class="results-subtitle">${sub}</div>
      </div>

      <div class="results-stats">
        <div class="result-stat">
          <div class="result-stat__num" style="color:var(--green)">${solved}</div>
          <div class="result-stat__lbl">Rezolvate</div>
        </div>
        <div class="result-stat">
          <div class="result-stat__num">${total}</div>
          <div class="result-stat__lbl">Total</div>
        </div>
        <div class="result-stat">
          <div class="result-stat__num" style="color:var(--accent-light)">${pct}%</div>
          <div class="result-stat__lbl">Scor</div>
        </div>
      </div>

      <div style="text-align:center;color:var(--text-muted);font-size:0.9rem;margin-bottom:28px">
        ⏱ Timp total: ${timeStr}
      </div>

      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn--primary btn--lg" onclick="restartTraining()">
          🔄 Nou antrenament
        </button>
        <a class="btn btn--surface btn--lg" href="index.html">
          ← Înapoi la capitole
        </a>
      </div>
    `;
  }

  window.restartTraining = function() {
    document.getElementById('configView').classList.remove('hidden');
    document.getElementById('sessionView').classList.add('hidden');
    document.getElementById('resultsView').classList.remove('active');
    document.getElementById('resultsView').innerHTML = '';
  };

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
