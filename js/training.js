/* ============================================================
   BACMath — Training Page Logic
   ============================================================ */

(function() {
  'use strict';

  let selectedCount     = 10;
  let selectedSubcats   = new Set();
  let expandedCats      = new Set();
  let selectedDiff      = 'all';

  let sessionExercises  = [];   // [ex, ex, ...] for the current session
  let cardStates        = [];   // parallel array: { ex, status: 'hidden'|'correct'|'incorrect'|'ungraded' }
  let revealedCount     = 0;
  let currentStreak     = 0;
  let bestStreakSession  = 0;
  let sessionXp         = 0;
  let activeCardIndex   = null;
  let startTime         = null;

  const XP_BASE = { usor: 10, mediu: 20, dificil: 35 };
  const MILESTONES = [3, 5, 8];

  /* In-memory cache for generated MCQ option sets — keyed by exercise id,
     lives for the page's lifetime (a fresh reload re-checks sessionStorage
     then Supabase, see renderMcqAnswerZone). */
  const mcqMemCache = new Map();

  /* ---- Init ---- */
  const UNLOCKED_CATS = new Set(['algebra']);

  function init() {
    /* Subcategories start deselected — the student picks what to train on,
       rather than everything being pre-selected for them. */
    BM.CATEGORIES.forEach(cat => {
      if (!UNLOCKED_CATS.has(cat.id)) return;
      expandedCats.add(cat.id);
    });
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
        };
        diffBox.appendChild(btn);
      });
    }

    renderChapterList();
  }

  /* Rebuilds only the chapter/subcategory picker — called on every expand/collapse
     or subcategory toggle. Kept separate from renderConfig() so the count/difficulty
     chips (built once, append-only) never get re-appended and duplicated. */
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
      + (selCount > 0 ? ' selected' : '')
      + (expandedCats.has(cat.id) ? ' expanded' : '');
    item.id = `cat-item-${cat.id}`;
    item.innerHTML = `
      <span class="config-chapter-icon" style="color:${cat.color}">${cat.symbol}</span>
      <span class="config-chapter-name">${BM.esc(cat.name)}</span>
      ${locked
        ? `<span class="config-chapter-lock">${icon('lock', { size: 16 })}</span><span class="config-chapter-soon">În curând</span>`
        : `<span class="config-chapter-subcount">${selCount}/${cat.subcategories.length}</span>
           <span class="config-chapter-chevron">▾</span>`}
    `;
    item.onclick = locked
      ? () => BM.toast('Exercițiile pentru acest capitol vor fi disponibile în curând.', 'info')
      : () => toggleChapterExpanded(cat.id);
    wrap.appendChild(item);

    if (!locked) {
      wrap.appendChild(renderSubcatPanel(cat));
    }
    return wrap;
  }

  function toggleChapterExpanded(id) {
    if (expandedCats.has(id)) expandedCats.delete(id);
    else expandedCats.add(id);
    renderChapterList();
  }

  function renderSubcatPanel(cat) {
    const panel = document.createElement('div');
    panel.className = 'config-subcat-panel' + (expandedCats.has(cat.id) ? '' : ' collapsed');
    panel.id = `subcat-panel-${cat.id}`;

    const actions = document.createElement('div');
    actions.className = 'config-subcat-actions';
    actions.innerHTML = `
      <button type="button" class="config-subcat-action config-subcat-action--select">${icon('check', { size: 16 })} Selectează tot</button>
      <button type="button" class="config-subcat-action config-subcat-action--clear">${icon('x', { size: 16 })} Deselectează tot</button>
    `;
    const [selectAllBtn, clearAllBtn] = actions.querySelectorAll('button');
    selectAllBtn.onclick = e => { e.stopPropagation(); cat.subcategories.forEach(s => selectedSubcats.add(s.id)); renderChapterList(); };
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

  function toggleSubcat(id, cat) {
    if (selectedSubcats.has(id)) {
      if (selectedSubcats.size <= 1) {
        BM.toast('Selectează cel puțin un subcapitol.', 'error');
        return;
      }
      selectedSubcats.delete(id);
    } else {
      selectedSubcats.add(id);
    }
    renderChapterList();
  }

  function clearAllSubcats(cat) {
    const catSubIds = new Set(cat.subcategories.map(s => s.id));
    const otherSelected = [...selectedSubcats].filter(id => !catSubIds.has(id)).length;
    if (otherSelected === 0) {
      BM.toast('Selectează cel puțin un subcapitol.', 'error');
      return;
    }
    cat.subcategories.forEach(s => selectedSubcats.delete(s.id));
    renderChapterList();
  }

  /* ---- Start training ---- */
  window.startTraining = function() {
    /* Group by subcategory (not a flat pooled shuffle) so that when several
       subcategories are selected, the session round-robins across all of them
       instead of possibly drawing every card from just one by chance. */
    const bySubcat = {};
    BM.EXERCISES.forEach(e => {
      if (!selectedSubcats.has(e.subcategoryId)) return;
      if (selectedDiff !== 'all' && e.difficulty !== selectedDiff) return;
      (bySubcat[e.subcategoryId] = bySubcat[e.subcategoryId] || []).push(e);
    });
    const subIds = Object.keys(bySubcat);

    if (selectedSubcats.size === 0) {
      BM.toast('Selectează cel puțin un subcapitol pentru a începe.', 'error');
      return;
    }
    if (subIds.length === 0) {
      BM.toast('Niciun exercițiu disponibil cu filtrele selectate!', 'error');
      return;
    }

    subIds.forEach(id => { bySubcat[id] = BM.shuffle(bySubcat[id]); });

    const picked = [];
    let exhausted = false;
    while (picked.length < selectedCount && !exhausted) {
      exhausted = true;
      for (const id of subIds) {
        if (picked.length >= selectedCount) break;
        if (bySubcat[id].length) {
          picked.push(bySubcat[id].shift());
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

    document.getElementById('trainingLayout').classList.add('training-layout--session');
    document.getElementById('sessionView').style.display = '';
    document.getElementById('resultsView').classList.remove('active');
    closeRevealOverlay(true);

    renderHud();
    renderFlipGrid();
  };

  /* ---- Card grid ---- */
  function renderFlipGrid() {
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
      return `
        <div class="flip-card${done ? ' flip-card--done' : ''}" data-idx="${i}" data-rarity="${rarity}" onclick="trOpenCard(${i})">
          <div class="flip-card__inner${done ? ' flip-card--flipped' : ''}">
            <span class="flip-card__rarity-badge">${rarity}</span>
            <div class="flip-card__face flip-card__face--back">
              <img class="flip-card__logo-img" src="assets/images/MathorizonLogo.png" alt="">
            </div>
            <div class="flip-card__face flip-card__face--front">
              ${done
                ? `${badge}
                   <span class="flip-card__num">#${i + 1}</span>`
                : `<span class="flip-card__num">#${i + 1}</span>`}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  window.trOpenCard = function(idx) {
    const cs = cardStates[idx];
    if (!cs || cs.status !== 'hidden' || activeCardIndex !== null) return;
    activeCardIndex = idx;

    const cardEl = document.querySelector(`.flip-card[data-idx="${idx}"]`);
    if (!cardEl) { renderRevealOverlay(idx); return; }

    cardEl.classList.add('flip-card--selecting');
    setTimeout(() => {
      cardEl.querySelector('.flip-card__inner').classList.add('flip-card--flipped');
      setTimeout(() => renderRevealOverlay(idx), 480);
    }, 200);
  };

  /* ---- Reveal overlay ---- */
  function renderRevealOverlay(idx) {
    const cs = cardStates[idx];
    const ex = cs.ex;
    const cat = BM.getCategoryById(ex.categoryId);
    const sub = BM.getSubcategoryById(ex.categoryId, ex.subcategoryId);
    const expected = extractBoxedAnswer(ex.solution);
    cs._expected = expected;
    const rarity = BM.RARITY_BY_DIFF[ex.difficulty] || 'comun';

    const modal = document.getElementById('revealModal');
    modal.dataset.rarity = rarity;
    modal.innerHTML = `
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

    BM.renderMath(modal);

    const overlay = document.getElementById('revealOverlay');
    overlay.classList.add('open');

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
    cs.status = 'ungraded';
    revealedCount++;
    renderHud();
    renderFlipGrid();
    closeRevealOverlay();
  };

  /* ---- Grading ---- */
  function gradeCard(idx, isCorrect) {
    const cs = cardStates[idx];
    const ex = cs.ex;
    const mcqPath = cs._expected == null;
    const correctAnswerText = cs._expected != null ? cs._expected : cs._mcqCorrectAnswer;
    cs.status = isCorrect ? 'correct' : 'incorrect';
    revealedCount++;

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
    }

    const xpGain = calcXp(ex.difficulty, isCorrect, currentStreak);
    sessionXp += xpGain;
    BM.Training.addXp(xpGain);
    renderHud();
    animateXpGain(xpGain);

    /* Reveal result banner + solution — both paths are genuinely graded now
       (typed input compares against the exact boxed answer, MCQ against the
       chosen option), so both get the same confident banner copy. */
    const resultZone = document.getElementById('revealResultZone');
    const answerZone = document.getElementById('revealAnswerZone');
    resultZone.innerHTML = `
      <div class="reveal-result-banner reveal-result-banner--${isCorrect ? 'correct' : 'incorrect'}">
        ${isCorrect
          ? `${icon('circle-check', { size: 16 })} Corect!`
          : `${icon('circle-x', { size: 16 })} Greșit — răspunsul corect: ${BM.esc(correctAnswerText || '')}`}
      </div>
      <div class="reveal-solution math-content">${BM.trustedNl2br(ex.solution)}</div>
    `;
    BM.renderMath(resultZone);
    resultZone.insertAdjacentHTML('beforeend', `
      <div style="text-align:right;margin-top:14px">
        <button class="btn btn--primary" id="revealContinueBtn">Continuă</button>
      </div>
    `);
    document.getElementById('revealContinueBtn').onclick = () => closeRevealOverlay();
    if (answerZone) {
      const row = mcqPath ? answerZone.querySelector('.reveal-mcq-options') : answerZone.querySelector('.reveal-answer-row');
      if (row) row.style.opacity = '0.5';
    }

    /* Update the grid card underneath so it flips-revealed with its difficulty color when we return */
    renderFlipGrid();
  }

  function closeRevealOverlay(silent) {
    document.getElementById('revealOverlay').classList.remove('open');
    const wasIdx = activeCardIndex;
    activeCardIndex = null;
    if (silent) return;
    if (wasIdx !== null && revealedCount >= sessionExercises.length && sessionExercises.length > 0) {
      finishSession();
    }
  }

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
  function finishSession() {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const total   = sessionExercises.length;
    const solved  = cardStates.filter(cs => cs.status === 'correct').length;
    const pct     = total > 0 ? Math.round((solved / total) * 100) : 0;
    const isPerfect = total > 0 && solved === total;
    const allTimeBest = BM.Storage.getBestCombo();
    const newRecord = bestStreakSession > 0 && bestStreakSession >= allTimeBest;

    document.getElementById('sessionView').style.display = 'none';
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

    resView.innerHTML = `
      ${isPerfect ? `
      <div class="results-perfect-banner">${icon('award', { size: 16 })} Sesiune perfectă! Ai rezolvat toate exercițiile corect.</div>` : ''}
      ${newRecord ? `
      <div class="results-record-banner">${icon('trophy', { size: 16 })} Record nou de streak: ${bestStreakSession} răspunsuri corecte la rând!</div>` : ''}

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
          <div class="result-stat__num" style="color:var(--yellow)">${sessionXp}</div>
          <div class="result-stat__lbl">XP câștigat</div>
        </div>
        <div class="result-stat">
          <div class="result-stat__num" style="color:var(--icon-gamify)">${icon('flame', { size: 16, className: 'icon-num' })} ${bestStreakSession}</div>
          <div class="result-stat__lbl">Streak maxim</div>
        </div>
      </div>

      <div style="text-align:center;color:var(--text-muted);font-size:0.9rem;margin-bottom:28px">
        ${icon('timer', { size: 16 })} Timp total: ${timeStr}
      </div>

      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn--primary btn--lg" onclick="restartTraining()">
          ${icon('refresh-cw', { size: 20 })} Nou antrenament
        </button>
        <a class="btn btn--surface btn--lg" href="capitole.html">
          ${icon('arrow-left', { size: 16 })} Înapoi la capitole
        </a>
      </div>
    `;

    if (isPerfect) fireConfetti();
  }

  window.restartTraining = function() {
    closeRevealOverlay(true);
    document.getElementById('flipGrid').innerHTML = '';
    document.getElementById('confettiLayer').innerHTML = '';
    sessionExercises = [];
    cardStates = [];
    revealedCount = 0;
    currentStreak = 0;
    bestStreakSession = 0;
    sessionXp = 0;

    document.getElementById('trainingLayout').classList.remove('training-layout--session');
    document.getElementById('sessionView').style.display = 'none';
    document.getElementById('resultsView').classList.remove('active');
    document.getElementById('resultsView').innerHTML = '';
    const empty = document.getElementById('emptyState');
    if (empty) empty.style.display = '';
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
