/* ============================================================
   Mathorizon — Simulare BAC
   Structura oficială BAC Moldova 2022+
   ============================================================ */

(function () {
  'use strict';

  const DURATION = 3 * 60 * 60; // 10800 secunde

  /* ----------------------------------------------------------------
     CONFIGURAȚIA SLOTURILOR
     Fiecare slot are un pool de (subcategorie, dificultăți).
     Algoritmul alege aleator un pool disponibil (subcategorie neutilizată)
     și un exercițiu aleator din el.
  ---------------------------------------------------------------- */
  const SLOTS = [
    {
      id: 'ex1', label: 'Ex. 1', points: 5, group: '1',
      desc: 'Calcul Algebric',
      pools: [
        { subcat: 'calcul-algebric', diff: ['usor', 'mediu', 'dificil'] }
      ]
    },
    {
      id: 'ex2', label: 'Ex. 2', points: 5, group: '2',
      desc: 'Algebră',
      pools: [
        { subcat: 'complexe',       diff: ['usor', 'mediu'] },
        { subcat: 'polinoame',      diff: ['usor', 'mediu'] },
        { subcat: 'ec-exp',         diff: ['usor'] },
        { subcat: 'inec-rationale', diff: ['usor', 'mediu'] }
      ]
    },
    {
      id: 'ex3', label: 'Ex. 3', points: 8, group: '3',
      desc: 'Ecuații / Inecuații',
      pools: [
        { subcat: 'complexe',       diff: ['mediu', 'dificil'] },
        { subcat: 'polinoame',      diff: ['mediu', 'dificil'] },
        { subcat: 'ec-irationale',  diff: ['usor', 'mediu', 'dificil'] },
        { subcat: 'ec-exp',         diff: ['mediu', 'dificil'] },
        { subcat: 'ec-log',         diff: ['usor', 'mediu', 'dificil'] },
        { subcat: 'inec-rationale', diff: ['usor', 'mediu'] }
      ]
    },
    {
      id: 'ex4', label: 'Ex. 4', points: 8, group: '4',
      desc: 'Ecuații / Trigonometrie',
      pools: [
        { subcat: 'complexe',       diff: ['mediu', 'dificil'] },
        { subcat: 'polinoame',      diff: ['mediu', 'dificil'] },
        { subcat: 'ec-irationale',  diff: ['usor', 'mediu', 'dificil'] },
        { subcat: 'ec-exp',         diff: ['mediu', 'dificil'] },
        { subcat: 'ec-log',         diff: ['usor', 'mediu', 'dificil'] },
        { subcat: 'inec-rationale', diff: ['usor', 'mediu'] },
        { subcat: 'trigonometrie',  diff: ['usor', 'mediu', 'dificil'] }
      ]
    },
    {
      id: 'ex5', label: 'Ex. 5', points: 8, group: '5',
      desc: 'Trigonometrie / Inecuații',
      pools: [
        { subcat: 'trigonometrie',  diff: ['mediu', 'dificil'] },
        { subcat: 'inec-rationale', diff: ['dificil'] }
      ]
    },
    {
      id: 'ex6', label: 'Ex. 6', points: 5, group: '6',
      desc: 'Geometrie',
      pools: [
        { subcat: 'geo-plana',     diff: ['usor', 'mediu', 'dificil'] },
        { subcat: 'geo-analitica', diff: ['usor', 'mediu', 'dificil'] },
        { subcat: 'geo-spatiu',    diff: ['usor', 'mediu', 'dificil'] }
      ]
    },
    {
      id: 'ex7', label: 'Ex. 7', points: 8, group: '7',
      desc: 'Geometrie avansată',
      pools: [
        { subcat: 'geo-plana',     diff: ['mediu', 'dificil'] },
        { subcat: 'geo-analitica', diff: ['mediu', 'dificil'] },
        { subcat: 'geo-spatiu',    diff: ['mediu', 'dificil'] }
      ]
    },
    {
      id: 'ex8', label: 'Ex. 8', points: 8, group: '8',
      desc: 'Geometrie complexă',
      pools: [
        { subcat: 'geo-plana',     diff: ['dificil'] },
        { subcat: 'geo-analitica', diff: ['dificil'] },
        { subcat: 'geo-spatiu',    diff: ['dificil'] }
      ]
    },
    {
      id: 'ex9', label: 'Ex. 9', points: 5, group: '9',
      desc: 'Șiruri și Progresii',
      pools: [
        { subcat: 'siruri',    diff: ['usor', 'mediu', 'dificil'] },
        { subcat: 'progresii', diff: ['usor', 'mediu', 'dificil'] }
      ]
    },
    {
      id: 'ex10a', label: 'Ex. 10a', points: 8, group: '10',
      desc: 'Derivate',
      pools: [
        { subcat: 'derivate', diff: ['usor', 'mediu', 'dificil'] }
      ]
    },
    {
      id: 'ex10b', label: 'Ex. 10b', points: 8, group: '10',
      desc: 'Limite / Integrale',
      pools: [
        { subcat: 'limite',    diff: ['usor', 'mediu', 'dificil'] },
        { subcat: 'integrale', diff: ['usor', 'mediu', 'dificil'] }
      ]
    },
    {
      id: 'ex10c', label: 'Ex. 10c', points: 8, group: '10',
      desc: 'Limite / Integrale',
      pools: [
        { subcat: 'limite',    diff: ['usor', 'mediu', 'dificil'] },
        { subcat: 'integrale', diff: ['usor', 'mediu', 'dificil'] }
      ]
    },
    {
      id: 'ex11', label: 'Ex. 11', points: 8, group: '11',
      desc: 'Probabilitate',
      pools: [
        { subcat: 'probabilitate', diff: ['usor', 'mediu', 'dificil'] }
      ]
    },
    {
      id: 'ex12', label: 'Ex. 12', points: 8, group: '12',
      desc: 'Binomul lui Newton',
      pools: [
        { subcat: 'combinari', diff: ['usor', 'mediu', 'dificil'] }
      ]
    }
  ];

  /* ---- Answer extraction utilities ---- */
  function extractBoxedAnswer(solution) {
    if (!solution) return null;
    const marker = '\\boxed{';
    const idx = solution.lastIndexOf(marker);
    if (idx === -1) return null;
    let depth = 1, content = '';
    for (let i = idx + marker.length; i < solution.length; i++) {
      if      (solution[i] === '{') { depth++; content += '{'; }
      else if (solution[i] === '}') { if (--depth === 0) break; content += '}'; }
      else                            content += solution[i];
    }
    return content || null;
  }

  function normalizeAnswer(raw) {
    if (raw === null || raw === undefined) return '';
    let s = String(raw).trim();
    s = s.replace(/^[=\s]+/, '');
    s = s.replace(/\{,\}/g, '.');                                              // LaTeX decimal comma
    s = s.replace(/\\(?:d|t)?frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');       // \frac{a}{b} → a/b
    // LaTeX → Unicode
    s = s.replace(/\\in\b/g, '∈');
    s = s.replace(/\\notin\b/g, '∉');
    s = s.replace(/\\cup\b/g, '∪');
    s = s.replace(/\\cap\b/g, '∩');
    s = s.replace(/\\emptyset\b/g, '∅');
    s = s.replace(/\\mathbb\{R\}/g, 'ℝ');
    s = s.replace(/\\mathbb\{Z\}/g, 'ℤ');
    s = s.replace(/\\mathbb\{N\}/g, 'ℕ');
    s = s.replace(/\\[+-]?infty\b/g, '∞');
    s = s.replace(/\+\\infty/g, '∞');
    s = s.replace(/\\leq\b/g, '≤');
    s = s.replace(/\\geq\b/g, '≥');
    s = s.replace(/\\neq\b/g, '≠');
    s = s.replace(/\\pi\b/g, 'π');
    s = s.replace(/\\circ\b/g, '°');
    s = s.replace(/\^\{?2\}?/g, '²');
    s = s.replace(/\^\{?3\}?/g, '³');
    s = s.replace(/\\[a-zA-Z]+\*?/g, '');   // strip remaining LaTeX commands
    s = s.replace(/[{}\s]/g, '');            // strip braces and whitespace
    s = s.replace(/;/g, ',');               // interval semicolons → commas
    return s.toLowerCase();
  }

  function isProofExercise(solution) {
    return !solution.includes('\\boxed{') && solution.includes('\\blacksquare');
  }

  /* ---- State ---- */
  let exam    = null;
  let current = 0;
  let timerEl = null;
  let timerInterval = null;

  /* ---- Init ---- */
  function init() {
    timerEl = document.getElementById('navTimer');
    updateTimerDisplay(DURATION);

    // ?new=1 from homepage → always reset to setup
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      sessionStorage.removeItem('bac-exam');
      sessionStorage.removeItem('bac-current');
      history.replaceState(null, '', 'bac.html');
      showSetupView();
      return;
    }

    const saved = tryRestoreExam();
    if (saved) {
      exam = saved;
      current = parseInt(sessionStorage.getItem('bac-current') || '0', 10);
      if (exam.phase === 'exam') {
        showExamView();
        startTimer();
      } else if (exam.phase === 'assess') {
        // Legacy phase — auto-grade and show results
        doFinish();
      } else if (exam.phase === 'done') {
        renderResults();
        showView('resultsView');
      }
    } else {
      showSetupView();
    }
  }

  function showSetupView() {
    showView('setupView');
    renderHistory();
  }

  /* ---- Show/hide views ---- */
  function showView(id) {
    ['setupView', 'examView', 'resultsView'].forEach(v => {
      document.getElementById(v).style.display = v === id ? '' : 'none';
    });
  }

  /* ================================================================
     GENERATE EXAM — no-repeat per subcategory
  ================================================================ */
  function generateExam() {
    const usedSubcats = new Set();

    return SLOTS.map(slot => {
      const shuffledPools = BM.shuffle([...slot.pools]);

      for (const pool of shuffledPools) {
        if (usedSubcats.has(pool.subcat)) continue;

        const candidates = BM.EXERCISES.filter(e =>
          e.subcategoryId === pool.subcat &&
          pool.diff.includes(e.difficulty)
        );
        if (candidates.length === 0) continue;

        const ex = BM.shuffle([...candidates])[0];
        usedSubcats.add(pool.subcat);
        return { slotId: slot.id, exercise: ex, usedSubcat: pool.subcat, score: null, work: '', flagged: false, confirmedAnswer: null };
      }

      return { slotId: slot.id, exercise: null, usedSubcat: null, score: null, work: '', flagged: false, confirmedAnswer: null };
    });
  }

  /* ================================================================
     START EXAM
  ================================================================ */
  function doStartExam() {
    exam = {
      slots: generateExam(),
      startTs: Date.now(),
      endTs: null,
      phase: 'exam'
    };
    current = 0;
    saveExam();
    showExamView();
    startTimer();
  }

  window.startExam = function () {
    const tokens    = BM.getTokens();
    const loggedIn  = !!window.BMAuth?.user;

    if (tokens <= 0) {
      if (!loggedIn) {
        showTokenDialog({
          icon: '🔑',
          title: 'Cont necesar',
          body: `Creează un cont gratuit și primești <strong>3 ExamTokenuri</strong> pentru simulări BAC.`,
          confirmLabel: 'Conectează-te',
          confirmClass: 'btn--primary',
          onConfirm: () => { window.location.href = 'auth.html?from=bac.html'; },
          cancelLabel: 'Anulează'
        });
      } else {
        showTokenDialog({
          icon: '🔒',
          title: 'Nu mai ai ExamTokenuri',
          body: `Ai folosit toate simulările disponibile.<br>Achiziționează ExamTokenuri pentru a continua să exersezi.`,
          confirmLabel: 'Achiziționează tokenuri',
          confirmClass: 'btn--primary',
          onConfirm: () => BM.toast('Funcționalitate disponibilă în curând.', 'info'),
          cancelLabel: 'Închide'
        });
      }
      return;
    }

    showTokenDialog({
      icon: '🎟',
      title: 'Pornești simularea BAC?',
      body: `Dacă confirmi, <strong>1 ExamToken</strong> va fi scăzut din contul tău.
             Vei rămâne cu <strong>${tokens - 1}</strong> token${tokens - 1 === 1 ? '' : 'uri'}.
             <br><br>
             <span class="exam-start-warn">⚠ Dacă ieși din pagină în timpul examenului, tokenul nu va fi restituit.</span>`,
      confirmLabel: '🚀 Pornește examenul',
      confirmClass: 'btn--primary',
      onConfirm: () => {
        if (!BM.consumeToken()) return;
        doStartExam();
      },
      cancelLabel: 'Anulează'
    });
  };

  function showTokenDialog({ icon, title, body, confirmLabel, confirmClass, onConfirm, cancelLabel }) {
    const ov = document.createElement('div');
    ov.className = 'bac-confirm-overlay';
    ov.innerHTML = `
      <div class="bac-confirm-modal exam-start-modal" role="dialog" aria-modal="true">
        <div class="bac-confirm-icon">${icon}</div>
        <div class="bac-confirm-title">${title}</div>
        <div class="exam-start-body">${body}</div>
        <div class="bac-confirm-actions">
          <button class="btn btn--surface" id="tkn-cancel">${cancelLabel}</button>
          <button class="btn ${confirmClass}" id="tkn-ok">${confirmLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const close = () => { ov.classList.remove('open'); setTimeout(() => ov.remove(), 220); };
    ov.querySelector('#tkn-cancel').onclick = close;
    ov.querySelector('#tkn-ok').onclick = () => { close(); onConfirm(); };
    ov.onclick = e => { if (e.target === ov) close(); };
    requestAnimationFrame(() => ov.classList.add('open'));
  }

  /* ================================================================
     EXAM VIEW
  ================================================================ */
  function showExamView() {
    showView('examView');
    updateNavbarForExam(true);
    renderNavigator();
    renderCurrentSlot();
  }

  function updateNavbarForExam(show) {
    const backBtn = document.getElementById('bacBackBtn');
    if (backBtn) backBtn.style.display = show ? 'none' : '';
    if (show) {
      timerEl = document.getElementById('navTimer');
      BM.applyTheme && BM.applyTheme();
    }
  }

  function renderNavigator() {
    const nav = document.getElementById('itemNav');
    const total        = SLOTS.length;
    const doneCount    = exam.slots.filter(s => s.confirmedAnswer !== null).length;
    const flagCount    = exam.slots.filter(s => s.flagged).length;
    const unavailCount = exam.slots.filter(s => !s.exercise).length;
    const remaining    = Math.max(0, total - doneCount - unavailCount);
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    let motiv;
    if (pct === 0)        motiv = 'Mult succes la examen! 🎓';
    else if (pct < 30)    motiv = `Bun start! Mai ai ${remaining} exerciții.`;
    else if (pct < 60)    motiv = `Progres bun — ai completat ${pct}%.`;
    else if (pct < 85)    motiv = `${remaining} exerciții rămase. Continuă! 💪`;
    else if (pct < 100)   motiv = `Aproape gata! Ultimele ${remaining} exerciții.`;
    else                  motiv = 'Toate exercițiile completate! 🎉';

    let itemsHtml = '';
    let lastGroup = null;

    SLOTS.forEach((slot, i) => {
      const item = exam.slots[i];
      const isDone        = item.confirmedAnswer !== null;
      const isCurrent     = i === current;
      const isUnavailable = !item.exercise;
      const isFlagged     = !!item.flagged;
      let cls = 'bac-nav-item';
      if (isUnavailable)  cls += ' unavailable';
      else if (isCurrent) cls += ' current';
      else if (isDone)    cls += ' done';
      if (isFlagged)      cls += ' flagged';

      lastGroup = slot.group;

      const statusIcon = isDone ? '✓' : isUnavailable ? '—' : '';
      const clickAttr  = isUnavailable ? '' : `onclick="gotoSlot(${i})"`;
      const keyAttr    = isUnavailable ? '' : `onkeydown="event.key==='Enter'&&gotoSlot(${i})"`;
      const starBtn    = isUnavailable ? '' :
        `<button class="bac-nav-flag${isFlagged ? ' active' : ''}"
                 onclick="event.stopPropagation();toggleFlagSlot(${i})"
                 title="Marchează pentru revizuire">${isFlagged ? '★' : '☆'}</button>`;

      itemsHtml += `
        <div class="${cls}" role="button" tabindex="${isUnavailable ? '-1' : '0'}"
             ${clickAttr} ${keyAttr}
             title="${slot.label} — ${slot.desc} (${slot.points}p)">
          <span class="bac-nav-item__status">${statusIcon}</span>
          <span class="bac-nav-item__label">${slot.label.replace('Ex. ', 'Item ')}</span>
          ${isCurrent
            ? '<span class="bac-nav-badge">\xCEn lucru</span>'
            : `<span class="bac-nav-item__pts">${slot.points}p</span>`}
          ${starBtn}
        </div>
      `;
    });

    nav.innerHTML = `
      <div class="bac-sidebar__header">
        <div class="bac-sidebar__exam-title">Simulare BAC</div>
        <div class="bac-sidebar__stats-grid">
          <div class="bac-stat-chip bac-stat-chip--done">
            <span class="bac-stat-chip__icon">✓</span>
            <span class="bac-stat-chip__val">${doneCount}</span>
            <span class="bac-stat-chip__lbl">Rezolvate</span>
          </div>
          <div class="bac-stat-chip bac-stat-chip--rem">
            <span class="bac-stat-chip__icon">○</span>
            <span class="bac-stat-chip__val">${remaining}</span>
            <span class="bac-stat-chip__lbl">Rămase</span>
          </div>
          <div class="bac-stat-chip bac-stat-chip--flag">
            <span class="bac-stat-chip__icon">★</span>
            <span class="bac-stat-chip__val">${flagCount}</span>
            <span class="bac-stat-chip__lbl">Marcate</span>
          </div>
        </div>
        <div class="bac-sidebar__progress-row">
          <span class="bac-sidebar__progress-count">${pct}% completat</span>
        </div>
        <div class="bac-sidebar__track">
          <div class="bac-sidebar__fill" style="width:${pct}%"></div>
        </div>
        <div class="bac-sidebar__motiv">${motiv}</div>
      </div>
      <div class="bac-sidebar__nav">
        <div class="bac-sidebar__section-label">Itemi</div>
        ${itemsHtml}
      </div>
    `;
  }

  function renderCurrentSlot() {
    const slot  = SLOTS[current];
    const item  = exam.slots[current];
    const total = SLOTS.length;

    const sub = item.exercise
      ? BM.getSubcategoryById(item.exercise.categoryId, item.exercise.subcategoryId)
      : null;

    // Topbar meta
    document.getElementById('slotMeta').innerHTML = `
      <div class="bac-slot-meta">
        <span class="bac-slot-num">${slot.label}</span>
        <span class="bac-slot-pts">${slot.points} puncte</span>
        ${item.exercise ? BM.diffBadge(item.exercise.difficulty) : ''}
        <span class="bac-slot-desc" style="margin:0">${BM.esc(sub?.name || slot.desc)}</span>
      </div>
    `;

    // Flag button state
    const flagBtn = document.getElementById('flagBtn');
    if (flagBtn) {
      flagBtn.className   = 'bac-flag-btn' + (item.flagged ? ' active' : '');
      flagBtn.title       = item.flagged ? 'Elimină marcajul' : 'Marchează pentru revizuire';
      flagBtn.textContent = item.flagged ? '★' : '☆';
    }

    // Progress dots
    const dots = SLOTS.map((_, i) => {
      let cls = 'bac-dot';
      if (i === current)                    cls += ' current';
      else if (exam.slots[i].confirmedAnswer !== null) cls += ' done';
      else if (exam.slots[i].flagged)        cls += ' flagged';
      return `<div class="${cls}" title="Item ${i + 1}"></div>`;
    }).join('');
    document.getElementById('progressDots').innerHTML = dots;

    // Main content
    const container = document.getElementById('slotContent');
    if (!item.exercise) {
      container.innerHTML = `
        <div class="bac-exercise-card">
          <div class="bac-card-stripe"></div>
          <div class="bac-card-body">
            <div class="bac-slot-title">${slot.label} — ${slot.desc}</div>
            <div class="bac-unavailable">
              <div style="font-size:2.5rem;margin-bottom:12px;opacity:0.25">📚</div>
              <p style="font-weight:600;margin-bottom:6px">Exercițiile pentru această temă vor fi adăugate \xEEn cur\xE2nd.</p>
              <p style="font-size:0.84rem;color:var(--text-muted)">Continuă cu itemul următor.</p>
            </div>
          </div>
        </div>
      `;
    } else {
      const ex = item.exercise;
      const diffClass    = `bac-card--${ex.difficulty || 'mediu'}`;
      const wasCollapsed = 'collapsed';
      container.innerHTML = `
        <div class="bac-exercise-card ${diffClass}">
          <div class="bac-card-stripe"></div>
          <div class="bac-card-body">
            <h2 class="bac-slot-title">${BM.esc(ex.title)}</h2>
            <div class="bac-statement math-content">${BM.trustedNl2br(ex.statement)}</div>
          </div>
        </div>
        <div class="bac-notes-card ${wasCollapsed}" id="notesCard">
          <div class="bac-notes-header" onclick="toggleNotes()">
            <span class="bac-notes-icon">✏️</span>
            <span class="bac-notes-label">Notițe de lucru</span>
            <span class="bac-notes-toggle">▾</span>
          </div>
          <div class="bac-notes-body">
            <textarea class="bac-work-textarea"
                      placeholder="Notează pași intermediari, calcule, observații…"
                      oninput="saveWork(${current}, this.value)">${BM.esc(item.work || '')}</textarea>
          </div>
        </div>
        ${renderAnswerCard(ex, item, current)}
      `;
      if (window.renderMathInElement) BM.renderMath(container);
    }

    // Nav buttons
    document.getElementById('prevSlotBtn').disabled = current === 0;
    const nextBtn = document.getElementById('nextSlotBtn');
    if (current === total - 1) {
      nextBtn.textContent = 'Finalizează';
      nextBtn.classList.add('is-finish');
      nextBtn.onclick = finishExam;
    } else {
      nextBtn.textContent = 'Următor';
      nextBtn.classList.remove('is-finish');
      nextBtn.onclick = nextSlot;
    }

    renderNavigator();
  }

  function renderAnswerCard(ex, item, idx) {
    const isProof     = isProofExercise(ex.solution);
    const isConfirmed = item.confirmedAnswer !== null;

    if (isProof) {
      const isDemoConfirmed = isConfirmed;
      return `
        <div class="bac-answer-card ${isDemoConfirmed ? 'bac-answer-card--confirmed' : ''}">
          <div class="bac-answer-header">
            <span class="bac-answer-icon">📋</span>
            <span class="bac-answer-label">Confirmare demonstrație</span>
            ${isDemoConfirmed ? '<span class="bac-answer-header-badge">✓ Confirmat</span>' : ''}
          </div>
          <div class="bac-answer-body">
            <p class="bac-answer-hint" style="margin-bottom:14px">Exercițiu de demonstrație — redactează pașii complet în notițe, apoi confirmă.</p>
            ${isDemoConfirmed
              ? `<div class="bac-answer-confirmed-badge">✓ Demonstrația a fost înregistrată. Vei afla rezultatul la final.</div>`
              : `<button class="bac-answer-btn" onclick="confirmProof(${idx})">Am redactat demonstrația</button>`}
          </div>
        </div>`;
    }

    const displayVal = isConfirmed
      ? BM.esc(item.confirmedAnswer)
      : '';

    const SYMBOLS = [
      { sym: '∈', tip: 'aparține' }, { sym: '∉', tip: 'nu aparține' },
      { sym: '∪', tip: 'reuniune' }, { sym: '∩', tip: 'intersecție' },
      { sym: '∅', tip: 'mulțime vidă' }, { sym: 'ℝ', tip: 'mulțimea numerelor reale' },
      { sym: '∞', tip: 'infinit' }, { sym: '≤', tip: 'mai mic sau egal' },
      { sym: '≥', tip: 'mai mare sau egal' }, { sym: '≠', tip: 'diferit' },
      { sym: 'π', tip: 'pi' }, { sym: '°', tip: 'grade' },
      { sym: '²', tip: 'la pătrat' }, { sym: '³', tip: 'la cub' },
    ];
    const symbolBar = isConfirmed ? '' : `
      <div class="bac-symbols-wrap">
        <button class="bac-symbols-toggle" type="button" onclick="toggleSymbols(this)">
          Simboluri speciale <span class="bac-symbols-chevron">▾</span>
        </button>
        <div class="bac-answer-symbols" style="display:none">
          ${SYMBOLS.map(({ sym, tip }) =>
            `<button class="bac-sym-btn" type="button" title="${tip}" onclick="insertAnswerSymbol('${sym}')">${sym}</button>`
          ).join('')}
        </div>
      </div>`;

    return `
      <div class="bac-answer-card ${isConfirmed ? 'bac-answer-card--confirmed' : ''}">
        <div class="bac-answer-header">
          <span class="bac-answer-icon">✍</span>
          <span class="bac-answer-label">Răspunsul final</span>
          ${isConfirmed ? '<span class="bac-answer-header-badge">✓ Confirmat</span>' : ''}
        </div>
        <div class="bac-answer-body">
          <div class="bac-answer-row">
            <input class="bac-answer-input${isConfirmed ? ' bac-answer-input--confirmed' : ''}"
                   id="answerInput"
                   type="text"
                   placeholder="ex: 4, -3/2, x∈(-∞;-2)∪(3;+∞)"
                   value="${displayVal}"
                   ${isConfirmed ? 'disabled' : ''}
                   onkeydown="if(event.key==='Enter')confirmAnswer(${idx})">
            ${isConfirmed
              ? ''
              : `<button class="bac-answer-btn" onclick="confirmAnswer(${idx})">Confirmă răspunsul</button>`}
          </div>
          ${symbolBar}
          <div class="bac-answer-hint">
            ${isConfirmed
              ? 'Răspunsul a fost înregistrat. Vei afla dacă este corect după finalizarea examenului.'
              : 'Odată confirmat, răspunsul nu mai poate fi modificat până la finalul examenului.'}
          </div>
        </div>
      </div>`;
  }

  function showAnswerConfirmDialog(answer, onConfirm) {
    const ov = document.createElement('div');
    ov.className = 'bac-confirm-overlay';
    ov.innerHTML = `
      <div class="bac-confirm-modal" role="dialog" aria-modal="true">
        <div class="bac-confirm-icon">✍</div>
        <div class="bac-confirm-title">Confirmi răspunsul?</div>
        <div class="bac-confirm-sub">Odată confirmat, nu mai poate fi modificat până la finalul examenului.</div>
        <div class="bac-confirm-answer">${BM.esc(answer)}</div>
        <div class="bac-confirm-actions">
          <button class="btn btn--surface" id="bac-cfm-cancel">Anulează</button>
          <button class="btn btn--primary" id="bac-cfm-ok">Confirmă răspunsul</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const close = () => { ov.classList.remove('open'); setTimeout(() => ov.remove(), 220); };
    ov.querySelector('#bac-cfm-cancel').onclick = close;
    ov.querySelector('#bac-cfm-ok').onclick = () => { close(); onConfirm(); };
    ov.onclick = (e) => { if (e.target === ov) close(); };
    requestAnimationFrame(() => ov.classList.add('open'));
  }

  window.confirmAnswer = function (i) {
    if (!exam?.slots[i] || exam.slots[i].confirmedAnswer !== null) return;
    const inputEl = document.getElementById('answerInput');
    if (!inputEl) return;
    const val = inputEl.value.trim();
    if (!val) { BM.toast('Introdu un răspuns înainte de confirmare.', 'info'); return; }

    showAnswerConfirmDialog(val, () => {
      exam.slots[i].confirmedAnswer = val;
      saveExam();
      const card = inputEl.closest('.bac-answer-card');
      if (card) {
        card.classList.add('bac-answer-card--confirmed');
        inputEl.disabled = true;
        inputEl.classList.add('bac-answer-input--confirmed');
        inputEl.value = val;
        card.querySelector('.bac-answer-btn')?.remove();
        const symWrap = card.querySelector('.bac-symbols-wrap');
        if (symWrap) symWrap.style.display = 'none';
        const hint = card.querySelector('.bac-answer-hint');
        if (hint) hint.textContent = 'Răspunsul a fost înregistrat. Vei afla dacă este corect după finalizarea examenului.';
        const label = card.querySelector('.bac-answer-label');
        if (label && !card.querySelector('.bac-answer-header-badge')) {
          const badge = document.createElement('span');
          badge.className = 'bac-answer-header-badge';
          badge.textContent = '✓ Confirmat';
          label.after(badge);
        }
      }
      renderNavigator();
      BM.toast('Răspuns confirmat și blocat.', 'success');
    });
  };

  window.toggleSymbols = function (btn) {
    const bar = btn.nextElementSibling;
    const isOpen = bar.style.display !== 'none';
    bar.style.display = isOpen ? 'none' : 'flex';
    btn.querySelector('.bac-symbols-chevron').textContent = isOpen ? '▾' : '▴';
  };

  window.insertAnswerSymbol = function (sym) {
    const input = document.getElementById('answerInput');
    if (!input || input.disabled) return;
    const s = input.selectionStart, e = input.selectionEnd;
    input.value = input.value.substring(0, s) + sym + input.value.substring(e);
    input.selectionStart = input.selectionEnd = s + sym.length;
    input.focus();
  };

  window.confirmProof = function (i) {
    if (!exam?.slots[i] || exam.slots[i].confirmedAnswer !== null) return;
    exam.slots[i].confirmedAnswer = '__PROOF__';
    saveExam();
    renderCurrentSlot();
    renderNavigator();
    BM.toast('Demonstrație confirmată și blocată.', 'success');
  };

  window.gotoSlot = function (i) {
    const container = document.getElementById('slotContent');
    container.classList.add('slot-exit');
    current = i;
    sessionStorage.setItem('bac-current', String(i));
    setTimeout(() => {
      container.classList.remove('slot-exit');
      renderCurrentSlot();
    }, 180);
  };

  window.prevSlot = function () { if (current > 0) gotoSlot(current - 1); };
  window.nextSlot = function () { if (current < SLOTS.length - 1) gotoSlot(current + 1); };

  window.saveWork = function (i, val) {
    if (exam?.slots[i]) {
      exam.slots[i].work = val;
      saveExam();
    }
  };

  window.toggleFlag = function () { toggleFlagSlot(current); };

  window.toggleFlagSlot = function (i) {
    if (!exam?.slots[i]) return;
    exam.slots[i].flagged = !exam.slots[i].flagged;
    saveExam();
    // Update topbar flag button if toggling current slot
    if (i === current) {
      const flagBtn = document.getElementById('flagBtn');
      if (flagBtn) {
        flagBtn.className   = 'bac-flag-btn' + (exam.slots[i].flagged ? ' active' : '');
        flagBtn.textContent = exam.slots[i].flagged ? '★' : '☆';
      }
    }
    renderNavigator();
  };

  window.toggleNotes = function () {
    const card = document.getElementById('notesCard');
    if (!card) return;
    card.classList.toggle('collapsed');
  };

  /* ================================================================
     TIMER
  ================================================================ */
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
    tick();
  }

  function tick() {
    if (!exam) return;
    const elapsed = Math.floor((Date.now() - exam.startTs) / 1000);
    const remaining = Math.max(0, DURATION - elapsed);
    updateTimerDisplay(remaining);
    if (remaining === 0) {
      clearInterval(timerInterval);
      BM.toast('Timpul a expirat! Se calculează nota.', 'info');
      doFinish();
    }
  }

  function updateTimerDisplay(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const str = `${pad(h)}:${pad(m)}:${pad(s)}`;
    const cls = seconds < 600 ? 'danger' : seconds < 1800 ? 'warning' : '';
    if (timerEl) {
      timerEl.textContent = str;
      timerEl.className = 'bac-timer' + (cls ? ' ' + cls : '');
    }
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  /* ================================================================
     FINISH EXAM
  ================================================================ */
  window.finishExam = function () {
    if (!confirm('Ești sigur că vrei să finalizezi simularea? Exercițiile fără răspuns confirmat vor primi 0 puncte.')) return;
    clearInterval(timerInterval);
    doFinish();
  };

  function doFinish() {
    exam.endTs = Date.now();
    exam.phase = 'done';
    // Auto-grade all slots
    exam.slots.forEach((item, i) => {
      if (!item.exercise) { item.score = 0; return; }
      if (item.confirmedAnswer === null) { item.score = 0; return; }
      const sol = item.exercise.solution;
      if (isProofExercise(sol)) {
        item.score = item.confirmedAnswer === '__PROOF__' ? SLOTS[i].points : 0;
        return;
      }
      const correct = normalizeAnswer(extractBoxedAnswer(sol));
      const student = normalizeAnswer(item.confirmedAnswer);
      item.score = (correct && student && correct === student) ? SLOTS[i].points : 0;
    });
    current = 0;
    saveExam();
    updateNavbarForExam(false);
    saveToHistory();
    renderResults();
    showView('resultsView');
  }

  /* ================================================================
     RESULTS
  ================================================================ */

  function cleanDisplayAnswer(str) {
    return str
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\\left|\\right/g, '')
      .replace(/\\in\b/g, '∈').replace(/\\cup\b/g, '∪').replace(/\\cap\b/g, '∩')
      .replace(/\\emptyset\b/g, '∅').replace(/\\infty\b/g, '∞')
      .replace(/\\pm\b/g, '±').replace(/\\cdot\b/g, '·')
      .replace(/\\times\b/g, '×').replace(/\\leq\b/g, '≤').replace(/\\geq\b/g, '≥')
      .replace(/\\neq\b/g, '≠').replace(/\\approx\b/g, '≈')
      .replace(/\\[a-zA-Z]+/g, '')
      .replace(/\\[,;:!-]/g, '')
      .replace(/\\/g, '')
      .replace(/\{,\}/g, ',')
      .replace(/[{}]/g, '')
      .replace(/,{2,}/g, ',')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function truncateStr(str, len) {
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  function renderResults() {
    const maxPts = SLOTS.reduce((s, slot) => s + slot.points, 0);
    const earned = exam.slots.reduce((s, item) => s + (item.score || 0), 0);
    const grade  = (earned / maxPts * 10);
    const gradeDisplay = grade.toFixed(2);
    const pctEarned = Math.round(earned / maxPts * 100);

    const gradeColor = grade >= 9   ? 'var(--green)'
                     : grade >= 7   ? 'var(--solved)'
                     : grade >= 5   ? 'var(--yellow)'
                     : 'var(--red)';

    const gradeEmoji = grade >= 9 ? '🏆' : grade >= 7 ? '🎯' : grade >= 5 ? '📚' : '📖';
    const gradeLabel = grade >= 9 ? 'Excelent!' : grade >= 7 ? 'Bine!' :
                       grade >= 5 ? 'Promovat' : 'Nepromovat';

    let durationSec = exam.endTs
      ? Math.floor((exam.endTs - exam.startTs) / 1000)
      : DURATION;
    const dH = Math.floor(durationSec / 3600);
    const dM = Math.floor((durationSec % 3600) / 60);

    const correctCount    = exam.slots.filter(item => item.exercise && (item.score || 0) > 0).length;
    const wrongCount      = exam.slots.filter(item => item.exercise && item.confirmedAnswer && (item.score || 0) === 0).length;
    const unansweredCount = exam.slots.filter(item => item.exercise && !item.confirmedAnswer).length;

    const breakdown = SLOTS.map((slot, i) => {
      const item = exam.slots[i];
      const s    = item.score || 0;
      const max  = slot.points;
      const na   = !item.exercise;

      let studentDisplay = 'Nerăspuns';
      let correctDisplay = '';
      let statusClass    = 'empty';

      if (!na && item.exercise) {
        const confirmed = item.confirmedAnswer;
        if (confirmed !== null) {
          if (confirmed === '__PROOF__') {
            studentDisplay = 'Demonstrat';
          } else {
            studentDisplay = truncateStr(confirmed, 28);
          }
          statusClass = s === max ? 'correct' : 'wrong';
        }
        if (s !== max && !isProofExercise(item.exercise.solution)) {
          const raw = extractBoxedAnswer(item.exercise.solution);
          if (raw) correctDisplay = truncateStr(cleanDisplayAnswer(normalizeAnswer(raw)), 28);
        }
      }

      const scoreClass = na ? '' : s === max ? 'res-score--correct' : 'res-score--wrong';

      return `
        <div class="res-row${na ? ' res-row--na' : ''}">
          <div class="res-row__left">
            <span class="res-row__label">${slot.label}</span>
            <span class="res-row__desc">${BM.esc(slot.desc)}</span>
          </div>
          <div class="res-row__mid">
            ${na
              ? '<span class="res-answer res-answer--na">Indisponibil</span>'
              : `<span class="res-answer res-answer--${statusClass}" title="${BM.esc(item.confirmedAnswer || '')}">${BM.esc(studentDisplay)}</span>
                 ${correctDisplay ? `<span class="res-arrow">→</span><span class="res-correct" title="${BM.esc(correctDisplay)}">${BM.esc(correctDisplay)}</span>` : ''}`
            }
          </div>
          <div class="res-row__score ${scoreClass}">
            ${na ? '—' : `${s} / ${max}p`}
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('resultsContent').innerHTML = `
      <div class="res-hero">
        <div class="res-hero__grade" style="color:${gradeColor}">${gradeDisplay}</div>
        <div class="res-hero__label" style="color:${gradeColor}">${gradeEmoji} ${gradeLabel}</div>
        <div class="res-score-bar">
          <div class="res-score-bar__fill" data-width="${pctEarned}" style="background:${gradeColor}"></div>
        </div>
        <div class="res-score-label">${earned} din ${maxPts} puncte — ${pctEarned}%</div>
        <div class="res-stats">
          <div class="res-stat res-stat--correct">
            <span class="res-stat__val">${correctCount}</span>
            <span class="res-stat__lbl">Corecte</span>
          </div>
          <div class="res-stat res-stat--wrong">
            <span class="res-stat__val">${wrongCount}</span>
            <span class="res-stat__lbl">Greșite</span>
          </div>
          <div class="res-stat res-stat--empty">
            <span class="res-stat__val">${unansweredCount}</span>
            <span class="res-stat__lbl">Necompletate</span>
          </div>
          <div class="res-stat res-stat--time">
            <span class="res-stat__val">${dH}h ${pad(dM)}m</span>
            <span class="res-stat__lbl">Timp</span>
          </div>
        </div>
      </div>

      <div class="res-table">
        <div class="res-table__head">
          <span>Exercițiu</span>
          <span>Răspunsul tău → Corect</span>
          <span style="text-align:right">Scor</span>
        </div>
        ${breakdown}
      </div>

      <div class="res-actions">
        <button class="btn btn--primary btn--lg" onclick="newSimulation()">🔄 Simulare Nouă</button>
        <a class="btn btn--surface btn--lg" href="index.html">Capitole</a>
      </div>
    `;

    requestAnimationFrame(() => {
      const bar = document.querySelector('.res-score-bar__fill');
      if (bar) requestAnimationFrame(() => { bar.style.width = bar.dataset.width + '%'; });
    });
  }

  window.newSimulation = function () {
    if (!confirm('Ești sigur că vrei să începi o simulare nouă? Rezultatele curente vor fi șterse.')) return;
    clearInterval(timerInterval);
    sessionStorage.removeItem('bac-exam');
    sessionStorage.removeItem('bac-current');
    exam = null;
    current = 0;
    updateNavbarForExam(false);
    updateTimerDisplay(DURATION);
    showSetupView();
  };

  /* ================================================================
     HISTORY (localStorage)
  ================================================================ */
  function saveToHistory() {
    try {
      const maxPts = SLOTS.reduce((s, slot) => s + slot.points, 0);
      const earned = exam.slots.reduce((s, item) => s + (item.score || 0), 0);
      const durationSec = exam.endTs
        ? Math.floor((exam.endTs - exam.startTs) / 1000)
        : DURATION;
      const entry = {
        ts: Date.now(),
        grade: parseFloat((earned / maxPts * 10).toFixed(2)),
        earned,
        maxPts,
        durationSec,
        breakdown: SLOTS.map((slot, i) => ({
          label: slot.label,
          desc:  slot.desc,
          score: exam.slots[i].score || 0,
          max:   slot.points,
          na:    !exam.slots[i].exercise
        }))
      };
      const raw = localStorage.getItem('bac-history');
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(entry);
      if (list.length > 20) list.length = 20;
      localStorage.setItem('bac-history', JSON.stringify(list));
      if (window.BMAuth?.saveBacSimulation) BMAuth.saveBacSimulation(entry);
    } catch (e) { /* storage full */ }
  }

  function renderHistory() {
    const el = document.getElementById('bacHistory');
    if (!el) return;
    let list = [];
    try {
      const raw = localStorage.getItem('bac-history');
      if (raw) list = JSON.parse(raw);
    } catch (e) { list = []; }

    let bodyContent;
    if (!list.length) {
      bodyContent = `
        <div class="bac-hist__empty">
          <span class="bac-hist__empty-icon">📋</span>
          <p>Nicio simulare finalizată încă.</p>
          <p>Pornește prima ta simulare și rezultatele vor apărea aici.</p>
        </div>
      `;
    } else {
      const rows = list.slice(0, 6).map(entry => {
        const date = new Date(entry.ts).toLocaleDateString('ro-RO', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
        const gradeColor = entry.grade >= 9   ? 'var(--green)'
                         : entry.grade >= 7   ? 'var(--solved)'
                         : entry.grade >= 5   ? 'var(--yellow)'
                         : 'var(--red)';
        const dH = Math.floor(entry.durationSec / 3600);
        const dM = Math.floor((entry.durationSec % 3600) / 60);
        return `
          <div class="bac-hist-item">
            <div class="bac-hist-item__date">${date}</div>
            <div class="bac-hist-item__pts">${entry.earned}/${entry.maxPts}p</div>
            <div class="bac-hist-item__time">${dH}h ${pad(dM)}m</div>
            <div class="bac-hist-item__grade" style="color:${gradeColor}">${entry.grade.toFixed(2)}</div>
          </div>
        `;
      }).join('');
      bodyContent = `
        <div class="bac-hist__col-headers">
          <span>Data</span>
          <span class="bac-hist__col-pts">Puncte</span>
          <span class="bac-hist__col-time">Timp</span>
          <span class="bac-hist__col-grade">Notă</span>
        </div>
        ${rows}
        <div class="bac-hist__footer">
          <button class="bac-hist__clear" onclick="clearBacHistory()">Șterge tot istoricul</button>
        </div>
      `;
    }

    const countBadge = list.length
      ? `<span class="bac-hist__toggle-count">${list.length}</span>`
      : '';

    el.innerHTML = `
      <div class="bac-hist" id="bacHistPanel">
        <button class="bac-hist__toggle" onclick="toggleHistPanel()" aria-expanded="false">
          <span class="bac-hist__toggle-icon">📋</span>
          <span class="bac-hist__toggle-title">Simulări anterioare</span>
          ${countBadge}
          <span class="bac-hist__toggle-chevron">▾</span>
        </button>
        <div class="bac-hist__body">
          ${bodyContent}
        </div>
      </div>
    `;
  }

  window.toggleHistPanel = function () {
    const panel = document.getElementById('bacHistPanel');
    if (!panel) return;
    panel.classList.toggle('open');
    const btn = panel.querySelector('.bac-hist__toggle');
    if (btn) btn.setAttribute('aria-expanded', String(panel.classList.contains('open')));
  };

  window.clearBacHistory = function () {
    if (!confirm('Ștergi tot istoricul de simulări?')) return;
    localStorage.removeItem('bac-history');
    renderHistory();
  };

  /* ================================================================
     PERSIST / RESTORE
  ================================================================ */
  function saveExam() {
    try {
      const payload = {
        startTs: exam.startTs,
        endTs:   exam.endTs,
        phase:   exam.phase,
        slots: exam.slots.map(item => ({
          slotId:          item.slotId,
          exerciseId:      item.exercise?.id || null,
          usedSubcat:      item.usedSubcat,
          score:           item.score,
          work:            item.work || '',
          flagged:         item.flagged || false,
          confirmedAnswer: item.confirmedAnswer !== undefined ? item.confirmedAnswer : null
        }))
      };
      sessionStorage.setItem('bac-exam', JSON.stringify(payload));
      sessionStorage.setItem('bac-current', String(current));
    } catch (e) { /* storage full */ }
  }

  function tryRestoreExam() {
    try {
      const raw = sessionStorage.getItem('bac-exam');
      if (!raw) return null;
      const saved = JSON.parse(raw);
      saved.slots = saved.slots.map(item => ({
        ...item,
        exercise:        item.exerciseId ? (BM.EXERCISES.find(e => e.id === item.exerciseId) || null) : null,
        flagged:         item.flagged || false,
        confirmedAnswer: item.confirmedAnswer !== undefined ? item.confirmedAnswer : null
      }));
      return saved;
    } catch (e) { return null; }
  }

  /* ---- Boot ---- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
