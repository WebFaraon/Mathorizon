/* ============================================================
   BACMath — Training Page Logic
   ============================================================ */

(function() {
  'use strict';

  let selectedCount     = 10;
  let selectedSubcats   = new Set();
  let selectedDiff      = 'all';
  let selectedTimerMode = 'none';    // 'none' | 'relaxed' | 'strict'
  let selectedAnswerType = 'mixed';  // 'mixed' | 'written' | 'mcq'
  let unsolvedOnly      = false;

  let sessionExercises  = [];   // [ex, ex, ...] for the current session
  let cardStates        = [];   // parallel array: { ex, status: 'hidden'|'correct'|'incorrect'|'ungraded', xpGain, correctAnswerText }
  let revealedCount     = 0;
  let currentStreak     = 0;
  let bestStreakSession  = 0;
  let sessionXp         = 0;
  let activeCardIndex   = null;
  let startTime         = null;
  let xpAtSessionStart  = 0;
  let missedSubcats     = new Set(); // subcategories with >=1 incorrect card this session — feeds "Repetă greșelile"

  const XP_BASE = { usor: 10, mediu: 20, dificil: 35 };
  const MILESTONES = [3, 5, 8];
  const TIMER_SECONDS = { relaxed: 90, strict: 45 };

  /* In-memory cache for generated MCQ option sets — keyed by exercise id,
     lives for the page's lifetime (a fresh reload re-checks sessionStorage
     then Supabase, see renderMcqAnswerZone). */
  const mcqMemCache = new Map();

  function reduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---- Init ---- */
  const UNLOCKED_CATS = new Set(['algebra']);

  function init() {
    renderConfig();
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
          updateSummary();
        };
        countBox.appendChild(btn);
      });
    }

    /* Difficulty chips */
    const diffBox = document.getElementById('diffChips');
    if (diffBox) {
      [
        { id: 'all',     label: 'Toate' },
        { id: 'usor',    label: 'Ușor',  cls: 'config-chip--usor' },
        { id: 'mediu',   label: 'Mediu', cls: 'config-chip--mediu' },
        { id: 'dificil', label: 'Greu',  cls: 'config-chip--dificil' }
      ].forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'config-chip' + (d.cls ? ` ${d.cls}` : '') + (d.id === selectedDiff ? ' selected' : '');
        btn.textContent = d.label;
        btn.onclick = () => {
          selectedDiff = d.id;
          diffBox.querySelectorAll('.config-chip').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          updateSummary();
        };
        diffBox.appendChild(btn);
      });
    }

    renderChapterList();
    renderExtraSettings();
    updateSummary();
  }

  /* Rebuilds only the chapter/subcategory picker — called whenever a
     subcategory selection changes. Kept separate from renderConfig() so the
     count/difficulty chips (built once, append-only) never get re-appended
     and duplicated. */
  function renderChapterList() {
    const chList = document.getElementById('chapterList');
    if (!chList) return;
    chList.innerHTML = '';
    BM.CATEGORIES.forEach(cat => chList.appendChild(renderChapterBlock(cat)));
  }

  function chapterSelectedCount(cat) {
    return cat.subcategories.filter(s => selectedSubcats.has(s.id)).length;
  }

  function renderChapterBlock(cat) {
    const locked = !UNLOCKED_CATS.has(cat.id);
    const wrap = document.createElement('div');
    wrap.className = 'config-chapter-block';

    const item = document.createElement('div');
    const selCount = locked ? 0 : chapterSelectedCount(cat);
    item.className = 'config-chapter-item'
      + (locked ? ' config-chapter-item--locked' : '')
      + (selCount > 0 ? ' selected' : '');
    item.id = `cat-item-${cat.id}`;
    item.innerHTML = `
      <span class="config-chapter-icon" style="color:${cat.color}">${cat.symbol}</span>
      <span class="config-chapter-name">${BM.esc(cat.name)}</span>
      ${locked
        ? `<span class="config-chapter-lock">${icon('lock', { size: 16 })}</span><span class="config-chapter-soon">În curând</span>`
        : `<span class="config-chapter-subcount">${selCount}/${cat.subcategories.length}</span>`}
    `;
    /* Only the lock toast is wired here — select-all/clear-all is the
       explicit buttons' job alone now (a chapter-title click doing the same
       thing made "Selectează tot" redundant and was surprising). */
    item.onclick = locked
      ? () => BM.toast('Exercițiile pentru acest capitol vor fi disponibile în curând.', 'info')
      : null;
    wrap.appendChild(item);

    if (!locked) {
      wrap.appendChild(renderSubcatPanel(cat));
    }
    return wrap;
  }

  function renderSubcatPanel(cat) {
    const panel = document.createElement('div');
    panel.className = 'config-subcat-panel';
    panel.id = `subcat-panel-${cat.id}`;

    const actions = document.createElement('div');
    actions.className = 'config-subcat-actions';
    actions.innerHTML = `
      <button type="button" class="config-subcat-action config-subcat-action--select">${icon('check', { size: 16 })} Selectează tot</button>
      <button type="button" class="config-subcat-action config-subcat-action--clear">${icon('x', { size: 16 })} Deselectează tot</button>
    `;
    const [selectAllBtn, clearAllBtn] = actions.querySelectorAll('button');
    selectAllBtn.onclick = e => { e.stopPropagation(); cat.subcategories.forEach(s => selectedSubcats.add(s.id)); renderChapterList(); updateSummary(); };
    clearAllBtn.onclick  = e => { e.stopPropagation(); clearAllSubcats(cat); };
    panel.appendChild(actions);

    const grid = document.createElement('div');
    grid.className = 'config-subcat-grid';
    cat.subcategories.forEach(sub => {
      const chip = document.createElement('div');
      const isSel = selectedSubcats.has(sub.id);
      chip.className = 'config-subcat-chip' + (isSel ? ' selected' : '');
      chip.innerHTML = `
        <span class="config-subcat-icon" style="color:${sub.color}">${sub.symbol}</span>
        <span class="config-subcat-name">${BM.esc(sub.name)}</span>
        <span class="config-subcat-check">${icon('check', { size: 16 })}</span>
      `;
      chip.onclick = e => { e.stopPropagation(); toggleSubcat(sub.id, cat); };
      grid.appendChild(chip);
    });
    panel.appendChild(grid);

    return panel;
  }

  /* Free to go down to zero — the live summary + disabled Start button
     (updateSummary) already tell the student when nothing's selected,
     so blocking it here too was just a second, confusing "no-op" version
     of that same guard. */
  function toggleSubcat(id, cat) {
    if (selectedSubcats.has(id)) {
      selectedSubcats.delete(id);
    } else {
      selectedSubcats.add(id);
    }
    renderChapterList();
    updateSummary();
  }

  function clearAllSubcats(cat) {
    cat.subcategories.forEach(s => selectedSubcats.delete(s.id));
    renderChapterList();
    updateSummary();
  }

  /* ---- D. Extra settings: timer / answer type / unsolved-only ----
     Built once (like the count/difficulty chips) with in-place class
     toggling on click, rather than a full re-render per change. */
  function renderExtraSettings() {
    const box = document.getElementById('extraSettings');
    if (!box) return;
    box.innerHTML = '';

    const timerRow = document.createElement('div');
    timerRow.className = 'config-extra-row';
    const timerLabel = document.createElement('span');
    timerLabel.className = 'config-extra-row__label';
    timerLabel.textContent = 'Cronometru';
    timerRow.appendChild(timerLabel);
    const timerChips = document.createElement('div');
    timerChips.className = 'config-chips';
    [
      { id: 'none',    label: 'Fără' },
      { id: 'relaxed', label: 'Relaxat (90s)' },
      { id: 'strict',  label: 'Contra timp (45s)' }
    ].forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'config-chip' + (t.id === selectedTimerMode ? ' selected' : '');
      btn.textContent = t.label;
      btn.onclick = () => {
        selectedTimerMode = t.id;
        timerChips.querySelectorAll('.config-chip').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateSummary();
      };
      timerChips.appendChild(btn);
    });
    timerRow.appendChild(timerChips);
    box.appendChild(timerRow);

    const typeRow = document.createElement('div');
    typeRow.className = 'config-extra-row';
    const typeLabel = document.createElement('span');
    typeLabel.className = 'config-extra-row__label';
    typeLabel.textContent = 'Tip de răspuns';
    typeRow.appendChild(typeLabel);
    const typeChips = document.createElement('div');
    typeChips.className = 'config-chips';
    [
      { id: 'mixed',   label: 'Mixt' },
      { id: 'written', label: 'Doar scriere' },
      { id: 'mcq',     label: 'Doar variante multiple' }
    ].forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'config-chip' + (t.id === selectedAnswerType ? ' selected' : '');
      btn.textContent = t.label;
      btn.onclick = () => {
        selectedAnswerType = t.id;
        typeChips.querySelectorAll('.config-chip').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateSummary();
      };
      typeChips.appendChild(btn);
    });
    typeRow.appendChild(typeChips);
    box.appendChild(typeRow);

    const toggleRow = document.createElement('div');
    toggleRow.className = 'config-extra-row';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'config-toggle' + (unsolvedOnly ? ' on' : '');
    toggle.innerHTML = `<span class="config-toggle__switch"></span> Doar exerciții nerezolvate`;
    toggle.onclick = () => {
      unsolvedOnly = !unsolvedOnly;
      toggle.classList.toggle('on', unsolvedOnly);
      updateSummary();
    };
    toggleRow.appendChild(toggle);
    box.appendChild(toggleRow);
  }

  /* An exercise is answered by typed input when its solution has a short,
     symbolic \boxed{} value; otherwise it's answered via generated
     multiple-choice options. Must match extractBoxedAnswer() below exactly
     (not the looser BM.extractBoxedAnswer in utils.js) since that's the
     function that actually decides the answer UI at reveal time. */
  function isWrittenAnswer(ex) {
    return extractBoxedAnswer(ex.solution) != null;
  }

  /* Shared by the live summary and the actual session start, so both agree
     on exactly which exercises are eligible under the current filters. */
  function buildPool() {
    const bySubcat = {};
    BM.EXERCISES.forEach(e => {
      if (!selectedSubcats.has(e.subcategoryId)) return;
      if (selectedDiff !== 'all' && e.difficulty !== selectedDiff) return;
      if (unsolvedOnly && BM.Storage.isSolved(e.id)) return;
      if (selectedAnswerType !== 'mixed') {
        const written = isWrittenAnswer(e);
        if (selectedAnswerType === 'written' && !written) return;
        if (selectedAnswerType === 'mcq' && written) return;
      }
      (bySubcat[e.subcategoryId] = bySubcat[e.subcategoryId] || []).push(e);
    });
    return bySubcat;
  }

  /* ---- E. Live summary + start-button validation ---- */
  function updateSummary() {
    const textEl = document.getElementById('configSummaryText');
    const startBtn = document.getElementById('startBtn');
    if (!textEl || !startBtn) return;

    if (selectedSubcats.size === 0) {
      textEl.textContent = 'Selectează cel puțin un subcapitol pentru a începe.';
      textEl.classList.add('config-summary-text--invalid');
      startBtn.disabled = true;
      return;
    }

    const pool = buildPool();
    const available = Object.values(pool).reduce((sum, arr) => sum + arr.length, 0);

    if (available === 0) {
      textEl.textContent = 'Niciun exercițiu disponibil cu aceste filtre — încearcă alte setări.';
      textEl.classList.add('config-summary-text--invalid');
      startBtn.disabled = true;
      return;
    }

    textEl.classList.remove('config-summary-text--invalid');
    startBtn.disabled = false;

    const diffLabels = { all: 'toate dificultățile', usor: 'Ușor', mediu: 'Mediu', dificil: 'Greu' };
    const willRun = Math.min(selectedCount, available);
    const perExerciseMin = selectedTimerMode !== 'none' ? TIMER_SECONDS[selectedTimerMode] / 60 : 1.5;
    const minutes = Math.max(1, Math.round(willRun * perExerciseMin));
    const subCount = selectedSubcats.size;

    let text = `${willRun} exerciții · ${diffLabels[selectedDiff]} · ${subCount} subcapitol${subCount === 1 ? '' : 'e'} · ~${minutes} min`;
    if (willRun < selectedCount) text += ` (doar ${available} disponibile din ${selectedCount} cerute)`;
    textEl.textContent = text;
  }

  /* ---- Config panel <-> HUD morph ---- */
  function collapseConfigPanel() {
    const panel = document.getElementById('configPanel');
    if (reduceMotion()) {
      document.getElementById('configContent').hidden = true;
      document.getElementById('trainingHud').hidden = false;
      panel.classList.add('training-panel--collapsed');
      return Promise.resolve();
    }
    return new Promise(resolve => {
      panel.classList.add('training-panel--collapsing');
      setTimeout(() => {
        document.getElementById('configContent').hidden = true;
        document.getElementById('trainingHud').hidden = false;
        panel.classList.remove('training-panel--collapsing');
        panel.classList.add('training-panel--collapsed');
        setTimeout(resolve, 300);
      }, 450);
    });
  }

  function expandConfigPanel() {
    const panel = document.getElementById('configPanel');
    document.getElementById('trainingLayout').classList.remove('training-layout--session');
    document.getElementById('trainingHud').hidden = true;
    document.getElementById('configContent').hidden = false;
    panel.classList.remove('training-panel--collapsed', 'training-panel--collapsing');
  }

  /* ---- Start training ---- */
  window.startTraining = function() {
    /* Group by subcategory (not a flat pooled shuffle) so that when several
       subcategories are selected, the session round-robins across all of them
       instead of possibly drawing every card from just one by chance. */
    const pool = buildPool();
    const subIds = Object.keys(pool);

    if (selectedSubcats.size === 0) {
      BM.toast('Selectează cel puțin un subcapitol pentru a începe.', 'error');
      return;
    }
    if (subIds.length === 0) {
      BM.toast('Niciun exercițiu disponibil cu filtrele selectate!', 'error');
      return;
    }

    subIds.forEach(id => { pool[id] = BM.shuffle(pool[id]); });

    const picked = [];
    let exhausted = false;
    while (picked.length < selectedCount && !exhausted) {
      exhausted = true;
      for (const id of subIds) {
        if (picked.length >= selectedCount) break;
        if (pool[id].length) {
          picked.push(pool[id].shift());
          exhausted = false;
        }
      }
    }
    sessionExercises = BM.shuffle(picked);
    cardStates       = sessionExercises.map(ex => ({ ex, status: 'hidden' }));
    revealedCount    = 0;
    currentStreak    = 0;
    bestStreakSession = 0;
    sessionXp        = 0;
    activeCardIndex  = null;
    startTime        = Date.now();
    xpAtSessionStart = BM.Training.getTotalXp();
    missedSubcats    = new Set();

    document.getElementById('flipBoard').style.display = '';
    document.getElementById('resultsView').classList.remove('active');
    document.getElementById('resultsView').innerHTML = '';
    closeRevealOverlay(true);
    document.getElementById('trainingLayout').classList.add('training-layout--session');

    collapseConfigPanel().then(() => {
      renderHud();
      dealCards();
    });
  };

  /* ---- Card grid ---- */
  function dealCards() {
    const abandonBtn = document.getElementById('abandonBtn');
    if (abandonBtn) abandonBtn.hidden = false;
    renderFlipGrid(true);
  }

  function renderFlipGrid(dealAnimation) {
    const total = cardStates.length;
    document.getElementById('sessionCounter').textContent = `${revealedCount} / ${total}`;
    const ring = document.getElementById('sessionProgressRing');
    if (ring) {
      const circumference = 213.6; // 2 * PI * r(34), matches training.html's ring
      const pct = total ? revealedCount / total : 0;
      ring.style.strokeDashoffset = String(circumference * (1 - pct));
    }

    const grid = document.getElementById('flipGrid');
    if (!grid) return;
    grid.innerHTML = cardStates.map((cs, i) => {
      const done    = cs.status !== 'hidden';
      const ungraded = cs.status === 'ungraded';
      const good    = cs.status === 'correct';
      const rarity  = BM.RARITY_BY_DIFF[cs.ex.difficulty] || 'comun';
      const badge = ungraded
        ? `<span class="flip-card__result-badge flip-card__result-badge--neutral">—</span>`
        : `<span class="flip-card__result-badge flip-card__result-badge--${good ? 'good' : 'bad'}">${icon(good ? 'circle-check' : 'circle-x', { size: 16 })}</span>`;
      const detail = (done && !ungraded)
        ? `<div class="flip-card__result-detail">${cs.ex.puncteTotal ? `${good ? cs.ex.puncteTotal : 0}/${cs.ex.puncteTotal}p · ` : ''}<strong>+${cs.xpGain || 0} XP</strong></div>`
        : '';
      const dealStyle = dealAnimation
        ? ` style="animation:card-up-in 0.4s cubic-bezier(0.22,1,0.36,1) both;animation-delay:${reduceMotion() ? 0 : i * 60}ms"`
        : '';
      return `
        <div class="flip-card${done ? ' flip-card--done' : ''}" data-idx="${i}" data-rarity="${rarity}" onclick="trOpenCard(${i})"${dealStyle}>
          <div class="flip-card__inner${done ? ' flip-card--flipped' : ''}">
            <span class="flip-card__rarity-badge">${rarity}</span>
            <div class="flip-card__face flip-card__face--back">
              <img class="flip-card__logo-img" src="assets/images/MathorizonLogo.png" alt="">
            </div>
            <div class="flip-card__face flip-card__face--front">
              ${done ? badge : ''}
              <div class="flip-card__front-content">
                <span class="flip-card__num">#${i + 1}</span>
                ${detail}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  window.trOpenCard = function(idx) {
    const cs = cardStates[idx];
    if (!cs || activeCardIndex !== null) return;
    activeCardIndex = idx;

    /* Already solved — reopen read-only, to review the solution, not to
       answer again. No flip animation needed, it's already face-up. */
    if (cs.status !== 'hidden') {
      renderRevealOverlay(idx, true);
      return;
    }

    const cardEl = document.querySelector(`.flip-card[data-idx="${idx}"]`);
    if (!cardEl) { renderRevealOverlay(idx, false); return; }

    cardEl.classList.add('flip-card--selecting');
    setTimeout(() => {
      cardEl.querySelector('.flip-card__inner').classList.add('flip-card--flipped');
      setTimeout(() => renderRevealOverlay(idx, false), 480);
    }, 200);
  };

  /* ---- Reveal overlay ---- */
  function renderRevealOverlay(idx, reviewMode) {
    const cs = cardStates[idx];
    const ex = cs.ex;
    const cat = BM.getCategoryById(ex.categoryId);
    const sub = BM.getSubcategoryById(ex.categoryId, ex.subcategoryId);
    const rarity = BM.RARITY_BY_DIFF[ex.difficulty] || 'comun';

    const modal = document.getElementById('revealModal');
    modal.dataset.rarity = rarity;

    const headHtml = `
      <div class="ex-card__meta" style="margin-bottom:10px">
        <span class="reveal-modal__rarity-badge">${rarity}</span>
        ${BM.diffBadge(ex.difficulty)}
        ${BM.pointsBadge(ex.puncteTotal, ex.puncteEstimat)}
        <span class="type-badge">${BM.esc(sub?.name || ex.subcategoryId)}</span>
        ${cat ? `<span class="type-badge" style="background:${cat.color}1a;color:${cat.color}">${BM.esc(cat.name)}</span>` : ''}
      </div>
      <div class="reveal-title">${BM.esc(ex.title)}</div>
      <div class="reveal-statement math-content" id="revealStatement">${BM.trustedNl2br(ex.statement)}</div>
      ${BM.renderExerciseFigure(ex)}
    `;

    if (reviewMode) {
      const isCorrect = cs.status === 'correct';
      const bannerHtml = cs.status === 'ungraded'
        ? ''
        : isCorrect
          ? `<div class="reveal-result-banner reveal-result-banner--correct">${icon('circle-check', { size: 16 })} Corect! <strong>+${cs.xpGain || 0} XP</strong></div>`
          : `<div class="reveal-result-banner reveal-result-banner--incorrect">${icon('circle-x', { size: 16 })} Greșit — răspunsul corect: $${BM.esc(cs.correctAnswerText || '')}$</div>`;
      modal.innerHTML = `
        ${headHtml}
        ${bannerHtml}
        ${buildSolutionBlockHtml(ex, false)}
        <div style="text-align:right;margin-top:14px">
          <button class="btn btn--primary" id="revealContinueBtn">Închide</button>
        </div>
      `;
      modal.scrollTop = 0; // innerHTML swap doesn't reset scroll on its own — without this a modal reopened after a scrolled-down close (e.g. review mode right after grading) would render already scrolled past its own header.
      BM.renderMath(modal);
      document.getElementById('revealContinueBtn').onclick = () => closeRevealOverlay();
      document.getElementById('revealOverlay').classList.add('open');
      return;
    }

    const expected = extractBoxedAnswer(ex.solution);
    cs._expected = expected;

    modal.innerHTML = `
      ${headHtml}
      <div id="revealAnswerZone">
        ${expected
          ? `
          <div class="reveal-answer-row">
            <input type="text" id="revealAnswerInput" class="cls-form-input reveal-answer-input" placeholder="Scrie răspunsul tău aici…" autocomplete="off">
            <button class="btn btn--primary" id="revealSubmitBtn">Verifică răspunsul</button>
          </div>`
          : `<div class="reveal-mcq-loading"><span class="reveal-mcq-spinner"></span> Se generează opțiunile…</div>`}
      </div>
      <div id="revealResultZone"></div>
    `;
    modal.scrollTop = 0; // see the scroll-reset note in the review-mode branch above

    BM.renderMath(modal);

    const overlay = document.getElementById('revealOverlay');
    overlay.classList.add('open');

    startCardTimer(idx);

    if (expected) {
      const input = document.getElementById('revealAnswerInput');
      const submit = () => trSubmitAnswer(idx);
      document.getElementById('revealSubmitBtn').onclick = submit;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      input.focus();
    } else {
      renderMcqAnswerZone(idx);
    }
  }

  /* Wrong-answer solution reveal: a real, points-tagged progressive barem
     when ex.barem exists (only ~47% of Algebră today — see barem-coverage
     investigation), otherwise the full solution at once under a distinct
     label, so the fallback never pretends to be a stepped barem it doesn't
     have. Also used, non-staggered, for the "Vezi rezolvarea" reveal on a
     correct answer and for reopening a solved card in review mode. */
  function buildSolutionBlockHtml(ex, staggered) {
    if (Array.isArray(ex.barem) && ex.barem.length) {
      const steps = ex.barem.map((step, i) => {
        const delay = (staggered && !reduceMotion()) ? i * 220 : 0;
        const ptsCls = ex.baremEstimat ? ' reveal-step__points--estimat' : '';
        const ptsTitle = ex.baremEstimat ? ' title="Punctaj estimat de AI — neconfirmat oficial"' : '';
        return `
          <div class="reveal-step" style="animation-delay:${delay}ms">
            <div class="reveal-step__head">
              <span class="reveal-step__num">Pasul ${i + 1}</span>
              <span class="reveal-step__points${ptsCls}"${ptsTitle}>${step.puncte_maxime}p${ex.baremEstimat ? ' ?' : ''}</span>
            </div>
            <div class="math-content">${BM.trustedNl2br(step.descriere)}</div>
          </div>`;
      }).join('');
      return `<div class="reveal-steps">${steps}</div>`;
    }
    return `
      <div class="reveal-solution-label">Rezolvare completă</div>
      <div class="reveal-solution math-content">${BM.trustedNl2br(ex.solution)}</div>`;
  }

  /* ---- MCQ answer zone (replaces the old self-report flow) ----
     For exercises whose answer can't be typed (extractBoxedAnswer
     returned null), fetch/generate 4 multiple-choice options instead of
     letting the student self-grade after seeing the solution. */
  async function renderMcqAnswerZone(idx) {
    const cs = cardStates[idx];
    const ex = cs.ex;

    let data = mcqMemCache.get(ex.id) || null;

    if (!data) {
      try {
        const cachedRaw = sessionStorage.getItem(`bm_mcq_cache_${ex.id}`);
        if (cachedRaw) data = JSON.parse(cachedRaw);
      } catch (e) { /* corrupted entry, ignore */ }
    }

    if (!data && window.BMAuth?.supabase) {
      try {
        const { data: row } = await window.BMAuth.supabase
          .from('training_mcq_cache')
          .select('correct_answer,distractors')
          .eq('exercise_id', ex.id)
          .maybeSingle();
        if (row) data = { correctAnswer: row.correct_answer, distractors: row.distractors };
      } catch (e) { /* network hiccup — fall through to generation/fallback */ }
    }

    if (!data && window.BMAuth?.user) {
      try {
        const session = (await window.BMAuth.supabase.auth.getSession())?.data?.session;
        const res = await fetch('/api/training/generate-mcq-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: session?.access_token || '',
            exerciseId: ex.id,
            statement: ex.statement,
            solution: ex.solution,
            barem: ex.barem
          })
        });
        if (res.ok) data = await res.json();
      } catch (e) { /* network/Gemini failure — fall through to fallback UI */ }
    }

    // Bail if the student already navigated away from this card while we
    // were awaiting the network (e.g. closed the overlay).
    if (activeCardIndex !== idx) return;

    if (data && data.correctAnswer && Array.isArray(data.distractors) && data.distractors.length === 3) {
      mcqMemCache.set(ex.id, data);
      try { sessionStorage.setItem(`bm_mcq_cache_${ex.id}`, JSON.stringify(data)); } catch (e) { /* storage full/unavailable — cache just won't persist across reload */ }
      renderMcqOptions(idx, data);
    } else {
      renderMcqFallback(idx, !window.BMAuth?.user);
    }
  }

  function renderMcqOptions(idx, data) {
    const cs = cardStates[idx];
    const options = BM.shuffle([data.correctAnswer, ...data.distractors]);
    cs._mcqCorrectIndex = options.indexOf(data.correctAnswer);
    cs._mcqCorrectAnswer = data.correctAnswer;

    const zone = document.getElementById('revealAnswerZone');
    if (!zone) return;
    zone.innerHTML = `
      <div class="reveal-mcq-options">
        ${options.map((opt, i) => `
          <button class="reveal-mcq-option" data-idx="${i}" onclick="trSelectMcqOption(${idx},${i})">
            <span class="reveal-mcq-option__math math-content">${opt}</span>
          </button>`).join('')}
      </div>
    `;
    BM.renderMath(zone);
  }

  /* guestNoSession: true when the fallback is shown because the student
     isn't logged in (rather than a genuine generation failure) — softer
     copy inviting login instead of implying something broke. */
  function renderMcqFallback(idx, guestNoSession) {
    const ex = cardStates[idx].ex;
    const zone = document.getElementById('revealAnswerZone');
    if (!zone) return;
    zone.innerHTML = `
      <p class="reveal-selfcheck-hint">${guestNoSession
        ? `${icon('lock', { size: 16 })} Conectează-te pentru variante multiple generate automat — deocamdată, iată soluția:`
        : `${icon('triangle-alert', { size: 16, className: 'icon--warning' })} Nu am putut genera variante de răspuns acum — iată soluția:`}</p>
      <div class="reveal-solution math-content">${BM.trustedNl2br(ex.solution)}</div>
      <button class="btn btn--surface btn--full" id="revealUnderstoodBtn">Am înțeles, continuă</button>
    `;
    BM.renderMath(zone);
    document.getElementById('revealUnderstoodBtn').onclick = () => trAcknowledgeNoGrade(idx);
  }

  window.trSubmitAnswer = function(idx) {
    const cs = cardStates[idx];
    const input = document.getElementById('revealAnswerInput');
    if (!input || cs.status !== 'hidden') return;
    const isCorrect = compareAnswers(input.value, cs._expected);
    input.disabled = true;
    document.getElementById('revealSubmitBtn').disabled = true;
    gradeCard(idx, isCorrect);
  };

  window.trSelectMcqOption = function(idx, chosenIndex) {
    const cs = cardStates[idx];
    if (cs.status !== 'hidden') return;
    document.querySelectorAll('.reveal-mcq-option').forEach(btn => { btn.disabled = true; });
    const isCorrect = chosenIndex === cs._mcqCorrectIndex;
    gradeCard(idx, isCorrect);
  };

  /* No-grade fallback path — never counts as correct or incorrect (keeps
     the "no self-graded cheat vector" guarantee even when generation fails
     or the student isn't logged in), but still advances the session. */
  window.trAcknowledgeNoGrade = function(idx) {
    const cs = cardStates[idx];
    if (cs.status !== 'hidden') return;
    clearCardTimer();
    cs.status = 'ungraded';
    cs.xpGain = 0;
    revealedCount++;
    renderHud();
    renderFlipGrid();
    closeRevealOverlay();
  };

  /* ---- Per-exercise timer (Cronometru: Relaxat 90s / Contra timp 45s) ----
     Runs only while a card's modal is open; idle between cards. Reuses
     .bac-timer/.bac-timer.warning/.danger + timerPulse verbatim from the
     BAC simulation page. */
  let timerInterval = null;
  let timerRemaining = 0;

  function startCardTimer(idx) {
    clearCardTimer();
    if (selectedTimerMode === 'none') return;
    timerRemaining = TIMER_SECONDS[selectedTimerMode];
    const hud = document.getElementById('hudTimer');
    if (hud) hud.hidden = false;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timerRemaining--;
      updateTimerDisplay();
      if (timerRemaining <= 0) {
        clearCardTimer();
        trExpireCard(idx);
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const hud = document.getElementById('hudTimer');
    if (!hud) return;
    const safe = Math.max(0, timerRemaining);
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    hud.textContent = `${m}:${String(s).padStart(2, '0')}`;
    hud.classList.toggle('warning', timerRemaining <= 15 && timerRemaining > 7);
    hud.classList.toggle('danger', timerRemaining <= 7);
  }

  function clearCardTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    const hud = document.getElementById('hudTimer');
    if (hud) hud.hidden = true;
  }

  function trExpireCard(idx) {
    const cs = cardStates[idx];
    if (!cs || cs.status !== 'hidden' || activeCardIndex !== idx) return;
    const input = document.getElementById('revealAnswerInput');
    if (input) input.disabled = true;
    const submitBtn = document.getElementById('revealSubmitBtn');
    if (submitBtn) submitBtn.disabled = true;
    document.querySelectorAll('.reveal-mcq-option').forEach(btn => { btn.disabled = true; });
    gradeCard(idx, false);
  }

  /* ---- Grading ---- */
  function gradeCard(idx, isCorrect) {
    const cs = cardStates[idx];
    const ex = cs.ex;
    const mcqPath = cs._expected == null;
    const correctAnswerText = cs._expected != null ? cs._expected : cs._mcqCorrectAnswer;
    cs.status = isCorrect ? 'correct' : 'incorrect';
    cs.correctAnswerText = correctAnswerText;
    revealedCount++;
    clearCardTimer();

    if (isCorrect) {
      currentStreak++;
      bestStreakSession = Math.max(bestStreakSession, currentStreak);
      if (MILESTONES.includes(currentStreak) || (currentStreak > 8 && (currentStreak - 8) % 5 === 0)) {
        celebrateMilestone(currentStreak);
      }
      const best = BM.Storage.getBestCombo();
      if (currentStreak > best) BM.Storage.setBestCombo(currentStreak);
      if (currentStreak > BM.Training.getBestStreak()) BM.Training.reportBestStreak(currentStreak);
      if (!BM.Storage.isSolved(ex.id)) BM.Storage.toggleSolved(ex.id);
    } else {
      currentStreak = 0;
      missedSubcats.add(ex.subcategoryId);
    }

    const xpGain = calcXp(ex.difficulty, isCorrect, currentStreak);
    cs.xpGain = xpGain;
    sessionXp += xpGain;
    BM.Training.addXp(xpGain);
    renderHud();
    animateXpGain(xpGain);

    const resultZone = document.getElementById('revealResultZone');
    const answerZone = document.getElementById('revealAnswerZone');

    if (isCorrect) {
      /* Solution isn't forced on a correct answer — available on demand via
         "Vezi rezolvarea", per the design (don't bury the win under a wall
         of text the student didn't ask for). */
      resultZone.innerHTML = `
        <div class="reveal-result-banner reveal-result-banner--correct">${icon('circle-check', { size: 16 })} Corect! <strong>+${xpGain} XP</strong></div>
        <button class="btn btn--surface btn--full" id="revealShowSolutionBtn">${icon('book-open', { size: 16 })} Vezi rezolvarea</button>
        <div id="revealSolutionZone" hidden></div>
      `;
    } else {
      /* Wrong answers reveal the solution immediately, progressively when a
         real barem exists (see buildSolutionBlockHtml). The correct-answer
         text is LaTeX (e.g. "\frac{5}{2}") — must be $-delimited or
         BM.renderMath (which only recognizes $/$$) leaves it raw. */
      resultZone.innerHTML = `
        <div class="reveal-result-banner reveal-result-banner--incorrect">${icon('circle-x', { size: 16 })} Greșit — răspunsul corect: $${BM.esc(correctAnswerText || '')}$</div>
        ${buildSolutionBlockHtml(ex, true)}
      `;
    }
    BM.renderMath(resultZone);
    resultZone.insertAdjacentHTML('beforeend', `
      <div style="text-align:right;margin-top:14px">
        <button class="btn btn--primary" id="revealContinueBtn">Continuă</button>
      </div>
    `);
    document.getElementById('revealContinueBtn').onclick = () => closeRevealOverlay();
    if (isCorrect) {
      document.getElementById('revealShowSolutionBtn').onclick = () => {
        const zone = document.getElementById('revealSolutionZone');
        zone.hidden = false;
        zone.innerHTML = buildSolutionBlockHtml(ex, false);
        BM.renderMath(zone);
        document.getElementById('revealShowSolutionBtn').remove();
      };
    }
    if (answerZone) {
      const row = mcqPath ? answerZone.querySelector('.reveal-mcq-options') : answerZone.querySelector('.reveal-answer-row');
      if (row) row.style.opacity = '0.5';
    }

    /* Update the grid card underneath so it flips-revealed with its difficulty color when we return */
    renderFlipGrid();
  }

  function closeRevealOverlay(silent) {
    clearCardTimer();
    document.getElementById('revealOverlay').classList.remove('open');
    const wasIdx = activeCardIndex;
    activeCardIndex = null;
    if (silent) return;
    if (wasIdx !== null && revealedCount >= sessionExercises.length && sessionExercises.length > 0) {
      finishSession();
    }
  }

  /* ---- Abandon session ---- */
  window.trConfirmAbandon = function() {
    const ov = document.createElement('div');
    ov.className = 'bac-confirm-overlay';
    ov.innerHTML = `
      <div class="bac-confirm-modal" role="dialog" aria-modal="true">
        <div class="bac-confirm-icon">${icon('triangle-alert', { size: 36, className: 'icon--warning' })}</div>
        <div class="bac-confirm-title">Renunți la sesiunea curentă?</div>
        <p class="bac-confirm-sub">Progresul din exercițiile nerezolvate se pierde. Cele deja rezolvate rămân salvate.</p>
        <div class="bac-confirm-actions">
          <button class="btn btn--surface" id="abandon-cancel">Înapoi</button>
          <button class="btn btn--danger" id="abandon-ok">Renunță</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const close = () => { ov.classList.remove('open'); setTimeout(() => ov.remove(), 220); };
    ov.querySelector('#abandon-cancel').onclick = close;
    ov.querySelector('#abandon-ok').onclick = () => { close(); restartTraining(); };
    ov.onclick = e => { if (e.target === ov) close(); };
    requestAnimationFrame(() => ov.classList.add('open'));
  };

  /* ---- HUD ---- */
  function renderHud() {
    const streakEl = document.getElementById('hudStreakVal');
    const xpEl     = document.getElementById('hudXpVal');
    const recordEl = document.getElementById('hudRecord');
    if (streakEl) {
      streakEl.textContent = currentStreak;
      const wrap = document.getElementById('hudStreak');
      wrap.classList.remove('session-hud__streak--pulse');
      void wrap.offsetWidth;
      wrap.classList.add('session-hud__streak--pulse');
    }
    if (xpEl) xpEl.textContent = sessionXp;
    if (recordEl) {
      const best = BM.Storage.getBestCombo();
      // innerHTML, not textContent — icon() returns markup, not plain text.
      recordEl.innerHTML = best > 0 ? `${icon('trophy', { size: 16, className: 'icon--gamify' })} Record: ${best}` : '';
    }
    BM.Training.refreshWidgets();
  }

  /* Floating "+N XP" that pops up next to the XP pill and a quick pulse on
     the level bar fill — the "animation when you collect XP" ask. */
  function animateXpGain(amount) {
    if (!amount || amount <= 0) return;
    const xpEl = document.getElementById('hudXp');
    if (xpEl) {
      const popup = document.createElement('span');
      popup.className = 'xp-gain-popup';
      popup.textContent = `+${amount} XP`;
      xpEl.appendChild(popup);
      popup.addEventListener('animationend', () => popup.remove());
    }
    const fill = document.querySelector('[data-training-level-fill]');
    if (fill) {
      fill.classList.remove('session-level__fill--pulse');
      void fill.offsetWidth;
      fill.classList.add('session-level__fill--pulse');
    }
  }

  /* ---- XP & celebrations ---- */
  function calcXp(difficulty, isCorrect, streakAtGrade) {
    const base = XP_BASE[difficulty] || 15;
    if (!isCorrect) return Math.round(base * 0.2);
    const multiplier = 1 + Math.min(streakAtGrade, 10) * 0.1;
    return Math.round(base * multiplier);
  }

  function celebrateMilestone(streakCount) {
    BM.toast(`${streakCount} răspunsuri corecte la rând!`, 'success', 3200);
    fireConfetti();
  }

  function fireConfetti() {
    const layer = document.getElementById('confettiLayer');
    if (!layer) return;
    const colors = ['#3A6BAD', '#16A34A', '#D97706', '#DC2626'];
    const particles = [];
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-particle';
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = `${Math.random() * 0.3}s`;
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.appendChild(p);
      particles.push(p);
    }
    setTimeout(() => particles.forEach(p => p.remove()), 1900);
  }

  /* ---- Answer extraction / normalization / comparison ---- */
  function extractBoxedAnswer(solutionStr) {
    const str = String(solutionStr || '');
    const marker = '\\boxed{';
    let lastContent = null;
    let searchFrom = 0;
    while (true) {
      const start = str.indexOf(marker, searchFrom);
      if (start === -1) break;
      const contentStart = start + marker.length;
      let depth = 1;
      let i = contentStart;
      for (; i < str.length; i++) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth === 0) {
        lastContent = str.slice(contentStart, i);
        searchFrom = i + 1;
      } else {
        break; // unbalanced — stop scanning
      }
    }
    if (lastContent == null) return null;
    /* Reject content that looks like prose (proof conclusions etc.) rather than a short
       symbolic answer — a run of 4+ letters NOT immediately preceded by "\" (so LaTeX
       command names like \frac, \sqrt, \log don't trigger a false positive). */
    if (/\\blacksquare|\\text\{|(?<!\\)[a-zA-ZăâîșțĂÂÎȘȚ]{4,}/.test(lastContent)) return null;
    const normalized = normalizeAnswer(lastContent);
    if (!normalized) return null;
    return lastContent.trim();
  }

  function normalizeAnswer(str) {
    let s = String(str || '');
    /* Romanian LaTeX decimal comma: "0{,}5" -> "0,5" (must run before generic brace stripping) */
    s = s.replace(/(\d)\{,\}(\d)/g, '$1,$2');
    s = s.trim().replace(/^=\s*/, '');
    s = s.replace(/\\left|\\right/g, '');
    /* \frac{a}{b} / \dfrac{a}{b} / \tfrac{a}{b} -> a/b (brace-aware, handles nesting) */
    s = stripFracCommands(s);
    s = s.replace(/[{}]/g, '');
    s = s.replace(/\s+/g, '');
    s = s.toLowerCase();
    return s;
  }

  /* Replaces every \frac{a}{b} / \dfrac{a}{b} / \tfrac{a}{b} occurrence (wherever it
     appears in the string, brace-aware so nested fractions are handled) with "a/b" */
  function stripFracCommands(s) {
    const cmdRe = /\\(?:d|t)?frac\{/;
    let guard = 0;
    let m;
    /* Innermost-first: process the LAST "\frac{" occurrence each pass so a nested
       fraction resolves to a parenthesized sub-value before it's spliced into its
       parent, instead of flattening "a/(b/c)" into the ambiguous "a/b/c". */
    while ((m = lastMatch(s, cmdRe)) && guard++ < 30) {
      const cmdStart  = m.index;
      const openBrace  = cmdStart + m[0].length - 1; // index of the numerator's "{"
      const numClose   = matchBrace(s, openBrace);
      if (numClose === -1) break; // unbalanced — stop rather than loop forever
      const numContent = s.slice(openBrace + 1, numClose);
      let denContent = '';
      let afterIdx = numClose + 1;
      if (s[afterIdx] === '{') {
        const denClose = matchBrace(s, afterIdx);
        if (denClose === -1) break;
        denContent = s.slice(afterIdx + 1, denClose);
        afterIdx = denClose + 1;
      }
      const wrap = x => x.includes('/') ? `(${x})` : x;
      const replacement = denContent ? `${wrap(numContent)}/${wrap(denContent)}` : numContent;
      s = s.slice(0, cmdStart) + replacement + s.slice(afterIdx);
    }
    return s;
  }

  /* Like regex.exec but returns the LAST match in the string instead of the first */
  function lastMatch(s, re) {
    const g = new RegExp(re.source, 'g');
    let m, last = null;
    while ((m = g.exec(s))) last = m;
    return last;
  }

  function matchBrace(s, openIdx) {
    let depth = 1;
    for (let i = openIdx + 1; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  /* ---- Numeric equivalence checking ----
     Plain numeric/algebraic answers (numbers, fractions, radicals, pi, exponents)
     are evaluated to a number and compared within a tolerance, so term order and
     equivalent-but-differently-written forms (20√3+37 vs 37+20√3) don't matter.
     Anything not purely numeric (equations, sets, intervals, systems, parametrized
     or trig/complex answers) falls back to the existing string comparison below. */
  function stripSqrtCommands(s) {
    const cmdRe = /\\sqrt\{/;
    let guard = 0;
    let m;
    while ((m = lastMatch(s, cmdRe)) && guard++ < 30) {
      const cmdStart = m.index;
      const openBrace = cmdStart + m[0].length - 1;
      const close = matchBrace(s, openBrace);
      if (close === -1) break;
      const content = s.slice(openBrace + 1, close);
      s = s.slice(0, cmdStart) + `sqrt(${content})` + s.slice(close + 1);
    }
    return s;
  }

  function stripExponentBraces(s) {
    const cmdRe = /\^\{/;
    let guard = 0;
    let m;
    while ((m = lastMatch(s, cmdRe)) && guard++ < 30) {
      const start = m.index;
      const openBrace = start + 1;
      const close = matchBrace(s, openBrace);
      if (close === -1) break;
      const content = s.slice(openBrace + 1, close);
      s = s.slice(0, start) + `^(${content})` + s.slice(close + 1);
    }
    return s;
  }

  function tryEvalNumeric(raw) {
    let s = String(raw || '').trim();
    if (!s) return null;
    s = s.replace(/(\d)\{,\}(\d)/g, '$1.$2'); // Romanian LaTeX decimal comma: "1{,}7" -> "1.7"
    s = s.replace(/^=\s*/, '');
    s = s.replace(/\\left|\\right/g, '');
    s = s.replace(/\\[,;:!]/g, ''); // LaTeX spacing commands
    s = stripFracCommands(s);
    s = stripSqrtCommands(s);
    s = s.replace(/\\sqrt(?!\()/g, 'sqrt'); // stray \sqrt without braces, e.g. "\sqrt2"
    s = stripExponentBraces(s);
    s = s.replace(/\\cdot|\\times/g, '*');
    s = s.replace(/\\pi/g, 'pi');
    if (/\\/.test(s)) return null; // unhandled LaTeX command remains (\in, \cup, \infty, \mathbb, \text...)
    if (/[{}\[\]=]/.test(s)) return null; // sets, intervals, equations
    s = s.replace(/[×·]/g, '*').replace(/π/g, 'pi').replace(/−/g, '-');
    s = s.replace(/\s+/g, '');
    s = s.replace(/(\d),(\d)/g, '$1.$2'); // plain decimal comma typed by the student
    if (s.includes(',')) return null; // leftover comma -> a list, not a single value
    s = s.toLowerCase();
    if (!s) return null;
    const stripped = s.replace(/sqrt|pi/g, '');
    if (/[a-z]/.test(stripped)) return null; // unsupported variable/constant/function
    try {
      const value = evalArithmetic(s);
      return Number.isFinite(value) ? value : null;
    } catch (e) {
      return null;
    }
  }

  /* Small recursive-descent evaluator for +,-,*,/,^, parentheses, sqrt(...)/√, pi,
     and implicit multiplication (e.g. "20sqrt(3)", "2pi", "(2+1)(3-1)"). */
  function evalArithmetic(s) {
    let pos = 0;
    const peek = () => s[pos];
    const startsWith = word => s.startsWith(word, pos);
    const canStartFactor = () => {
      const c = peek();
      return c === '√' || (c !== undefined && /[0-9.(]/.test(c)) || startsWith('sqrt') || startsWith('pi');
    };
    const expect = ch => {
      if (peek() !== ch) throw new Error(`expected "${ch}"`);
      pos++;
    };
    const parseNumber = () => {
      const m = /^\d+(\.\d+)?/.exec(s.slice(pos));
      if (!m) throw new Error('expected number');
      pos += m[0].length;
      return parseFloat(m[0]);
    };
    const sqrtOf = v => {
      if (v < 0) throw new Error('sqrt of negative');
      return Math.sqrt(v);
    };
    const parsePrimary = () => {
      if (peek() === '√') { pos++; return sqrtOf(parsePrimary()); }
      if (startsWith('sqrt')) { pos += 4; return sqrtOf(parsePrimary()); }
      if (startsWith('pi')) { pos += 2; return Math.PI; }
      if (peek() === '(') { pos++; const v = parseExpr(); expect(')'); return v; }
      if (/[0-9.]/.test(peek() || '')) return parseNumber();
      throw new Error('unexpected token');
    };
    const parsePower = () => {
      const base = parsePrimary();
      if (peek() === '^') { pos++; return Math.pow(base, parseUnary()); }
      return base;
    };
    const parseUnary = () => {
      if (peek() === '-') { pos++; return -parseUnary(); }
      if (peek() === '+') { pos++; return parseUnary(); }
      return parsePower();
    };
    const parseTerm = () => {
      let value = parseUnary();
      while (true) {
        if (peek() === '*') { pos++; value *= parseUnary(); }
        else if (peek() === '/') { pos++; value /= parseUnary(); }
        else if (canStartFactor()) { value *= parseUnary(); }
        else break;
      }
      return value;
    };
    const parseExpr = () => {
      let value = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = peek(); pos++;
        value = op === '+' ? value + parseTerm() : value - parseTerm();
      }
      return value;
    };
    const result = parseExpr();
    if (pos !== s.length) throw new Error('trailing input');
    return result;
  }

  function compareAnswers(userRaw, expectedRaw) {
    const userNum = tryEvalNumeric(userRaw);
    const expectedNum = tryEvalNumeric(expectedRaw);
    if (userNum != null && expectedNum != null) {
      return Math.abs(userNum - expectedNum) < 1e-6 * Math.max(1, Math.abs(expectedNum));
    }
    return normalizeAnswer(userRaw) === normalizeAnswer(expectedRaw);
  }

  /* ---- Finish ---- */
  function animateCountUp(el, target) {
    if (!el) return;
    if (reduceMotion() || target <= 0) { el.textContent = target; return; }
    const duration = 800;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = Math.round(target * t);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function animateLevelBar(xpBefore, xpAfter, leveledUp) {
    const perLevel = BM.Training.XP_PER_LEVEL;
    const fill = document.getElementById('resultsLevelFill');
    const label = document.getElementById('resultsLevelLabel');
    const xpLbl = document.getElementById('resultsLevelXp');
    if (!fill || !label || !xpLbl) return;
    const levelBefore = Math.floor(xpBefore / perLevel) + 1;
    const levelAfter  = Math.floor(xpAfter / perLevel) + 1;
    const set = (level, pct) => {
      label.textContent = level;
      xpLbl.textContent = `${Math.round(pct * perLevel)} / ${perLevel} XP`;
      fill.style.width = `${Math.round(pct * 100)}%`;
    };
    set(levelBefore, (xpBefore % perLevel) / perLevel);

    if (reduceMotion()) {
      set(levelAfter, (xpAfter % perLevel) / perLevel);
      return;
    }
    requestAnimationFrame(() => {
      if (!leveledUp) {
        fill.style.transition = 'width 0.8s cubic-bezier(0.22,1,0.36,1)';
        set(levelAfter, (xpAfter % perLevel) / perLevel);
        return;
      }
      // Crossed at least one level mid-session: fill to 100%, snap to 0%,
      // then fill to the new in-level amount — reads as "leveled up" even
      // when more than one level was crossed in a single session.
      fill.style.transition = 'width 0.5s cubic-bezier(0.22,1,0.36,1)';
      set(levelBefore, 1);
      setTimeout(() => {
        fill.style.transition = 'none';
        set(levelAfter, 0);
        void fill.offsetWidth;
        fill.style.transition = 'width 0.5s cubic-bezier(0.22,1,0.36,1)';
        set(levelAfter, (xpAfter % perLevel) / perLevel);
      }, 550);
    });
  }

  function finishSession() {
    // Nothing left to abandon once the session is genuinely over — the HUD
    // strip stays up (final progress/XP/level are useful context on the
    // results screen), just without an action that no longer means anything.
    const abandonBtn = document.getElementById('abandonBtn');
    if (abandonBtn) abandonBtn.hidden = true;

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const total   = sessionExercises.length;
    const solved  = cardStates.filter(cs => cs.status === 'correct').length;
    const pct     = total > 0 ? Math.round((solved / total) * 100) : 0;
    const isPerfect = total > 0 && solved === total;
    const allTimeBest = BM.Storage.getBestCombo();
    const newRecord = bestStreakSession > 0 && bestStreakSession >= allTimeBest;

    const xpNow = BM.Training.getTotalXp();
    const perLevel = BM.Training.XP_PER_LEVEL;
    const levelBefore = Math.floor(xpAtSessionStart / perLevel) + 1;
    const levelAfter  = Math.floor(xpNow / perLevel) + 1;
    const leveledUp = levelAfter > levelBefore;

    document.getElementById('flipBoard').style.display = 'none';
    const resView = document.getElementById('resultsView');
    resView.classList.add('active');

    // Named resultIcon, not icon — this function is inside the same
    // closure as every other call to the global icon() below; a local
    // `icon` here would shadow it.
    const resultIcon = icon(pct >= 80 ? 'party-popper' : pct >= 50 ? 'dumbbell' : 'library', { size: 48 });
    const title  = pct >= 80 ? 'Excelent!' : pct >= 50 ? 'Bine!' : 'Continuă să exersezi!';
    const sub    = pct >= 80
      ? 'Ai rezolvat majoritatea exercițiilor. Ești pe drumul cel bun!'
      : pct >= 50
      ? 'Progres bun! Mai exersează capitolele dificile.'
      : 'Nu te descuraja. Practica face perfectă!';

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    /* Per-subcategory breakdown — the "unde ai mers bine, unde ai greșit" ask */
    const bySub = {};
    cardStates.forEach(cs => {
      const key = cs.ex.subcategoryId;
      if (!bySub[key]) bySub[key] = { correct: 0, total: 0, ex: cs.ex };
      bySub[key].total++;
      if (cs.status === 'correct') bySub[key].correct++;
    });
    const breakdownRows = Object.values(bySub).map(s => {
      const sub = BM.getSubcategoryById(s.ex.categoryId, s.ex.subcategoryId);
      const name = sub?.name || s.ex.subcategoryId;
      const scoreCls = s.correct === s.total ? 'good' : s.correct === 0 ? 'bad' : 'mixed';
      return `<div class="results-breakdown__row"><span>${BM.esc(name)}</span><span class="results-breakdown__score results-breakdown__score--${scoreCls}">${s.correct}/${s.total}</span></div>`;
    }).join('');

    resView.innerHTML = `
      ${isPerfect ? `
      <div class="results-perfect-banner">${icon('award', { size: 16 })} Sesiune perfectă! Ai rezolvat toate exercițiile corect.</div>` : ''}
      ${newRecord ? `
      <div class="results-record-banner">${icon('trophy', { size: 16 })} Record nou de streak: ${bestStreakSession} răspunsuri corecte la rând!</div>` : ''}
      ${leveledUp ? `
      <div class="results-record-banner">${icon('trophy', { size: 16 })} Nivel nou: ${levelAfter}!</div>` : ''}

      <div class="results-header">
        <div class="results-icon">${resultIcon}</div>
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
        <div class="result-stat">
          <div class="result-stat__num" id="resultsXpCount" style="color:var(--yellow)">0</div>
          <div class="result-stat__lbl">XP câștigat</div>
        </div>
        <div class="result-stat">
          <div class="result-stat__num" style="color:var(--icon-gamify)">${icon('flame', { size: 16, className: 'icon-num' })} ${bestStreakSession}</div>
          <div class="result-stat__lbl">Streak maxim</div>
        </div>
      </div>

      <div class="session-level" style="max-width:none;margin:0 auto 24px">
        <div class="session-level__top">
          <span class="session-level__label">Nivel <span id="resultsLevelLabel">${levelBefore}</span></span>
          <span class="session-level__xp" id="resultsLevelXp"></span>
        </div>
        <div class="session-level__bar"><div class="session-level__fill" id="resultsLevelFill" style="width:0%"></div></div>
      </div>

      <div class="results-breakdown">
        <div class="results-breakdown__title">Defalcare pe subcapitole</div>
        ${breakdownRows}
      </div>

      <div style="text-align:center;color:var(--text-muted);font-size:0.9rem;margin-bottom:28px">
        ${icon('timer', { size: 16 })} Timp total: ${timeStr}
      </div>

      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        ${missedSubcats.size > 0 ? `
        <button class="btn btn--surface btn--lg" onclick="repeatMistakes()">
          ${icon('refresh-cw', { size: 20 })} Repetă greșelile
        </button>` : ''}
        <button class="btn btn--primary btn--lg" onclick="restartTraining()">
          ${icon('refresh-cw', { size: 20 })} Sesiune nouă
        </button>
        <a class="btn btn--surface btn--lg" href="capitole.html">
          ${icon('arrow-left', { size: 16 })} Înapoi la capitole
        </a>
      </div>
    `;

    animateCountUp(document.getElementById('resultsXpCount'), sessionXp);
    animateLevelBar(xpAtSessionStart, xpNow, leveledUp);

    if (isPerfect || leveledUp) fireConfetti();
  }

  /* Builds a new session using only the subcategories that had >=1 incorrect
     card this session ("tipurile ratate"), keeping every other setting
     (difficulty/timer/answer-type/unsolved-only/count) as currently
     selected. */
  window.repeatMistakes = function() {
    if (missedSubcats.size === 0) return;
    selectedSubcats = new Set(missedSubcats);
    startTraining();
  };

  window.restartTraining = function() {
    closeRevealOverlay(true);
    clearCardTimer();
    document.getElementById('flipGrid').innerHTML = '';
    document.getElementById('confettiLayer').innerHTML = '';
    sessionExercises = [];
    cardStates = [];
    revealedCount = 0;
    currentStreak = 0;
    bestStreakSession = 0;
    sessionXp = 0;
    missedSubcats = new Set();

    document.getElementById('flipBoard').style.display = '';
    document.getElementById('resultsView').classList.remove('active');
    document.getElementById('resultsView').innerHTML = '';

    expandConfigPanel();
    renderChapterList();
    updateSummary();
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
