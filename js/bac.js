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

  // Active slot definitions — SLOTS for BAC, overridden for lectie exam
  let _slotDefs = SLOTS;

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
  let _fsWarnings   = 0;
  let _navGuardOn   = false;

  /* ---- Fullscreen helpers ---- */
  function _enterFullscreen() {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen || (() => {})).call(el);
  }
  function _exitFullscreen() {
    (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen || (() => {})).call(document);
  }
  function _isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
  }

  function _showFsWarning() {
    if (document.getElementById('fsWarnOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'fsWarnOverlay';
    ov.innerHTML = `
      <div class="fs-warn-box">
        <div class="fs-warn-icon">⚠️</div>
        <div class="fs-warn-title">Ai ieșit din fullscreen!</div>
        <div class="fs-warn-body">
          Nu ai voie să ieși din fullscreen în timpul examenului.<br>
          <strong>Dacă mai ieși o dată, examenul se închide automat</strong> fără rezultate, notă sau analiză.<br>
          Tokenul utilizat <strong>nu va fi restituit</strong>.
        </div>
        <button class="btn btn--primary" onclick="BMBac.returnFullscreen()">↑ Reintră în fullscreen</button>
      </div>`;
    document.body.appendChild(ov);
  }
  function _hideFsWarning() {
    document.getElementById('fsWarnOverlay')?.remove();
  }

  window.BMBac = window.BMBac || {};
  window.BMBac.returnFullscreen = function() {
    _enterFullscreen();
  };

  /* ---- Sidebar collapse ---- */
  const SIDEBAR_COLLAPSE_KEY = 'bac-sidebar-collapsed';

  window.BMBac.toggleSidebar = function () {
    const wrap = document.getElementById('sidebarWrap');
    if (!wrap) return;
    const collapsed = wrap.classList.toggle('collapsed');
    try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (e) {}
  };

  function _restoreSidebarCollapsed() {
    const wrap = document.getElementById('sidebarWrap');
    if (!wrap) return;
    let collapsed = false;
    try { collapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1'; } catch (e) {}
    wrap.classList.toggle('collapsed', collapsed);
  }

  /* ---- Navbar auto-hide (exam mode) ---- */
  function _initNavAutoHide() {
    const nav  = document.querySelector('.nav');
    const zone = document.getElementById('navHoverZone');
    if (!nav || !zone || nav._bacAutoHideBound) return;
    nav._bacAutoHideBound = true;
    const show = () => nav.classList.add('nav--peek');
    const hide = (e) => {
      const to = e.relatedTarget;
      if (to && (nav.contains(to) || to === zone)) return;
      nav.classList.remove('nav--peek');
    };
    zone.addEventListener('mouseenter', show);
    nav.addEventListener('mouseenter', show);
    nav.addEventListener('mouseleave', hide);
    zone.addEventListener('mouseleave', hide);
  }

  function _terminateNoResults() {
    clearInterval(timerInterval);
    _navGuardOff();
    _hideFsWarning();
    _exitFullscreen();
    sessionStorage.removeItem('bac-exam');
    sessionStorage.removeItem('bac-current');
    exam = null;

    const ov = document.createElement('div');
    ov.id = 'terminateModal';
    ov.innerHTML = `
      <div class="fs-warn-box">
        <div class="fs-warn-icon">❌</div>
        <div class="fs-warn-title">Examen anulat</div>
        <div class="fs-warn-body">
          Ai ieșit din fullscreen de <strong>două ori</strong> în timpul simulării.<br><br>
          Examenul a fost <strong>închis automat</strong> fără rezultate, fără notă și fără analiză.<br>
          <span style="color:var(--red);font-weight:700">Tokenul utilizat nu va fi restituit.</span>
        </div>
        <button class="btn btn--primary" onclick="
          document.getElementById('terminateModal').remove();
          document.getElementById('setupView').scrollIntoView();
        ">Înțeleg</button>
      </div>`;
    document.body.appendChild(ov);
    showView('setupView');
  }

  document.addEventListener('fullscreenchange',       _onFsChange);
  document.addEventListener('webkitfullscreenchange', _onFsChange);
  document.addEventListener('mozfullscreenchange',    _onFsChange);
  function _onFsChange() {
    if (_isFullscreen()) { _hideFsWarning(); return; }
    if (!exam || exam.phase !== 'exam') return;
    _fsWarnings++;
    if (_fsWarnings === 1) {
      _showFsWarning();
    } else {
      _terminateNoResults();
    }
  }

  /* ---- Navigation guard ---- */
  function _guardClick(e) {
    const link = e.currentTarget;
    if (link.href && link.href.includes('#')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    _showNavGuardModal();
  }

  function _onBeforeUnload(e) {
    e.preventDefault();
    e.returnValue = '';
  }

  function _navGuardOn_fn() {
    if (_navGuardOn) return;
    _navGuardOn = true;
    document.querySelectorAll('.nav__link, .nav__mobile-link, .nav__brand, .nav-profile-btn, .nav-icon-btn')
      .forEach(el => el.addEventListener('click', _guardClick, true));
    window.addEventListener('beforeunload', _onBeforeUnload);
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', _onPopState);
  }

  function _navGuardOff() {
    if (!_navGuardOn) return;
    _navGuardOn = false;
    document.querySelectorAll('.nav__link, .nav__mobile-link, .nav__brand, .nav-profile-btn, .nav-icon-btn')
      .forEach(el => el.removeEventListener('click', _guardClick, true));
    window.removeEventListener('beforeunload', _onBeforeUnload);
    window.removeEventListener('popstate', _onPopState);
  }

  function _onPopState() {
    history.pushState(null, '', location.href);
    _showNavGuardModal();
  }

  function _showNavGuardModal() {
    if (document.getElementById('navGuardModal')) return;
    const ov = document.createElement('div');
    ov.id = 'navGuardModal';
    ov.innerHTML = `
      <div class="nav-guard-box">
        <div class="nav-guard-icon">🔒</div>
        <div class="nav-guard-title">Examen în desfășurare</div>
        <div class="nav-guard-body">
          Nu poți naviga în altă parte în timp ce examenul este activ.<br>
          Finalizează simularea apăsând butonul <strong style="color:var(--red)">Finalizează</strong>.
        </div>
        <button class="btn btn--primary" onclick="document.getElementById('navGuardModal').remove()">Înapoi la examen</button>
      </div>`;
    document.body.appendChild(ov);
  }

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
      if (exam.type === 'lectie') {
        _slotDefs = exam.slots.map((s, i) => ({
          id: s.slotId, label: s.label || ('Ex. ' + (i + 1)),
          points: s.points, group: String(i + 1),
          desc: s.exercise ? (s.exercise.subcategoryId || '') : ''
        }));
        if (exam.phase === 'exam') { showExamView(); _startLectieTimer(); }
        else if (exam.phase === 'done') { renderResults(); showView('resultsView'); }
        else doFinish();
      } else {
        if (exam.phase === 'exam') {
          showExamView();
          startTimer();
        } else if (exam.phase === 'assess') {
          doFinish();
        } else if (exam.phase === 'done') {
          renderResults();
          showView('resultsView');
        }
      }
    } else {
      showSetupView();
    }
  }

  function showSetupView() {
    _slotDefs = SLOTS;
    clearInterval(_lectieTimerInterval);
    showView('setupView');
    _showSetupPanel('choose');
    renderHistory();
  }

  /* ---- Setup sub-panels (choose / bac / lectie) ---- */
  function _showSetupPanel(panel) {
    const choose  = document.getElementById('simChoose');
    const bacExp  = document.getElementById('bacSetupExpanded');
    const lectExp = document.getElementById('lectieSetupExpanded');
    if (!choose) return;
    choose.classList.remove('sim-fade-out');
    choose.style.display  = panel === 'choose'  ? 'flex' : 'none';
    bacExp.style.display  = panel === 'bac'     ? 'flex' : 'none';
    lectExp.style.display = panel === 'lectie'  ? 'flex' : 'none';
  }

  // Fade `outEl` out, swap panels, then fade `inEl` in. Shared by
  // selectSimType (choose -> bac/lectie) and backToChoose (bac/lectie -> choose)
  // so the transition looks identical in both directions.
  function _switchPanel(outEl, panel, inElId, afterShow) {
    if (!outEl) { _showSetupPanel(panel); return; }
    outEl.classList.add('sim-fade-out');
    setTimeout(function () {
      _showSetupPanel(panel);
      if (afterShow) afterShow();
      var inEl = document.getElementById(inElId);
      if (inEl) {
        inEl.classList.add('sim-fade-in');
        inEl.addEventListener('animationend', function () { inEl.classList.remove('sim-fade-in'); }, { once: true });
      }
    }, 220);
  }

  window.selectSimType = function (type) {
    var choose = document.getElementById('simChoose');
    var panelId = type === 'bac' ? 'bacSetupExpanded' : 'lectieSetupExpanded';
    _switchPanel(choose, type, panelId, function () {
      if (type === 'bac') renderHistory();
    });
  };

  window.backToChoose = function (e) {
    if (e) e.preventDefault();
    var bacExp  = document.getElementById('bacSetupExpanded');
    var lectExp = document.getElementById('lectieSetupExpanded');
    var activePanel = (bacExp && bacExp.style.display !== 'none') ? bacExp
                     : (lectExp && lectExp.style.display !== 'none') ? lectExp
                     : null;
    _switchPanel(activePanel, 'choose', 'simChoose');
  };

  /* ---- Lectie de Proba: grade selection & exam ---- */
  let _lectieGrade = null;
  const LECTIE_DURATION = 50 * 60; // 3000 seconds

  window.selectGrade = function (grade) {
    _lectieGrade = grade;
    document.querySelectorAll('.lectie-grade-btn').forEach(btn => btn.classList.remove('selected'));
    const btns = document.querySelectorAll('.lectie-grade-btn');
    btns.forEach(btn => { if (btn.textContent.trim() === 'Cls. ' + grade) btn.classList.add('selected'); });
    const chip = document.getElementById('lectieChipGrade');
    if (chip) chip.textContent = grade + 'a';
    const startBtn = document.getElementById('lectieStartBtn');
    if (startBtn) startBtn.disabled = false;
  };

  window.startLectieExam = function () {
    if (!_lectieGrade) return;
    _doStartLectieExam(_lectieGrade);
  };

  function _doStartLectieExam(grade) {
    const pool = _buildLectiePool(grade);
    if (pool.length === 0) {
      BM.toast && BM.toast('Nu există exerciții disponibile pentru această clasă.', 'warn');
      return;
    }
    const slots = _pickLectieSlots(pool);
    const lectieExam = {
      type: 'lectie',
      grade,
      slots,
      startTs: Date.now(),
      endTs: null,
      phase: 'exam'
    };
    sessionStorage.setItem('lectie-exam', JSON.stringify(lectieExam));
    sessionStorage.setItem('lectie-current', '0');
    _runLectieExam(lectieExam);
  }

  function _buildLectiePool(grade) {
    const all = BM.EXERCISES || [];
    const easy   = all.filter(e => e.difficulty === 'usor');
    const medium = all.filter(e => e.difficulty === 'mediu');
    const hard   = all.filter(e => e.difficulty === 'dificil');
    const pickN = (arr, n) => BM.shuffle([...arr]).slice(0, n);
    const picked = [
      ...pickN(easy,   3).map(e => ({ exercise: e, targetDiff: 'usor',   score: null, work: '', flagged: false, confirmedAnswer: null })),
      ...pickN(medium, 3).map(e => ({ exercise: e, targetDiff: 'mediu',  score: null, work: '', flagged: false, confirmedAnswer: null })),
      ...pickN(hard,   2).map(e => ({ exercise: e, targetDiff: 'dificil',score: null, work: '', flagged: false, confirmedAnswer: null }))
    ];
    return BM.shuffle(picked);
  }

  function _pickLectieSlots(pool) {
    return pool.map((item, i) => ({
      slotId: 'lp' + (i + 1),
      label: 'Ex. ' + (i + 1),
      points: item.targetDiff === 'usor' ? 5 : item.targetDiff === 'mediu' ? 8 : 10,
      exercise: item.exercise,
      score: null,
      work: '',
      flagged: false,
      confirmedAnswer: null
    }));
  }

  function _runLectieExam(lectieExam) {
    exam = lectieExam;
    current = 0;
    _fsWarnings = 0;
    _slotDefs = exam.slots.map((s, i) => ({
      id: s.slotId,
      label: s.label || ('Ex. ' + (i + 1)),
      points: s.points,
      group: String(i + 1),
      desc: s.exercise ? (s.exercise.subcategoryId || '') : ''
    }));
    showExamView();
    _startLectieTimer();
    _enterFullscreen();
    _navGuardOn_fn();
  }

  let _lectieTimerInterval = null;
  let _lectieTimeLeft = LECTIE_DURATION;

  function _startLectieTimer() {
    _lectieTimeLeft = LECTIE_DURATION;
    clearInterval(_lectieTimerInterval);
    _lectieTimerInterval = setInterval(() => {
      _lectieTimeLeft--;
      updateTimerDisplay(_lectieTimeLeft);
      if (_lectieTimeLeft <= 300 && timerEl) timerEl.classList.add('bac-timer--warn');
      if (_lectieTimeLeft <= 60  && timerEl) timerEl.classList.add('bac-timer--danger');
      if (_lectieTimeLeft <= 0) {
        clearInterval(_lectieTimerInterval);
        doFinish();
      }
    }, 1000);
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
    _fsWarnings = 0;
    saveExam();
    showExamView();
    startTimer();
    _enterFullscreen();
    _navGuardOn_fn();
  }

  window.startExam = function () {
    const tokens    = BM.getTokens();
    const loggedIn  = !!window.BMAuth?.user;

    if (window.BMAuth?.role === 'admin') {
      doStartExam();
      return;
    }

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
    _restoreSidebarCollapsed();
    _initNavAutoHide();
    renderNavigator();
    renderCurrentSlot();
  }

  function updateNavbarForExam(show) {
    const backBtn = document.getElementById('bacBackBtn');
    if (backBtn) backBtn.style.display = show ? 'none' : '';
    document.body.classList.toggle('bac-exam-mode', show);
    if (show) {
      timerEl = document.getElementById('navTimer');
      BM.applyTheme && BM.applyTheme();
    } else {
      const nav = document.querySelector('.nav');
      if (nav) nav.classList.remove('nav--peek');
    }
  }

  function renderNavigator() {
    const nav = document.getElementById('itemNav');
    const total        = _slotDefs.length;
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

    _slotDefs.forEach((slot, i) => {
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
          <span class="bac-nav-item__short">${slot.label.replace('Ex. ', '')}</span>
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
            <span class="bac-stat-chip__val">${doneCount}</span>
            <span class="bac-stat-chip__lbl">Rezolvate</span>
          </div>
          <div class="bac-stat-chip bac-stat-chip--rem">
            <span class="bac-stat-chip__val">${remaining}</span>
            <span class="bac-stat-chip__lbl">Rămase</span>
          </div>
          <div class="bac-stat-chip bac-stat-chip--flag">
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
    if (window._activeDrawingCanvas) {
      window._activeDrawingCanvas.destroy();
      window._activeDrawingCanvas = null;
    }

    const slot  = _slotDefs[current];
    const item  = exam.slots[current];
    const total = _slotDefs.length;

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
    const dots = _slotDefs.map((_, i) => {
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
      const diffClass = `bac-card--${ex.difficulty || 'mediu'}`;
      container.innerHTML = `
        <div class="bac-exercise-card ${diffClass}">
          <div class="bac-card-stripe"></div>
          <div class="bac-card-body">
            <h2 class="bac-slot-title">${BM.esc(ex.title)}</h2>
            <div class="bac-statement math-content">${BM.trustedNl2br(ex.statement)}</div>
          </div>
        </div>
        <div class="bac-notes-card" id="notesCard">
          <div class="bac-notes-header" onclick="toggleNotes()">
            <span class="bac-notes-icon">✏️</span>
            <span class="bac-notes-label">Notițe de lucru</span>
            <span class="bac-notes-toggle">▾</span>
          </div>
          <div class="bac-notes-body bac-notes-body--canvas" id="drawingCanvasMount"></div>
        </div>
        ${renderAnswerCard(ex, item, current)}
      `;
      if (window.renderMathInElement) BM.renderMath(container);

      const dcMount = document.getElementById('drawingCanvasMount');
      if (dcMount && window.DrawingCanvas) {
        const _cur = current;
        window._activeDrawingCanvas = new DrawingCanvas(dcMount, {
          onSave: function (dataUrl) { saveWork(_cur, dataUrl); },
          initialData: item.work || null
        });
        window.getCanvasImage = function () {
          return window._activeDrawingCanvas ? window._activeDrawingCanvas.getCanvasImage() : null;
        };
      }
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
  window.nextSlot = function () { if (current < _slotDefs.length - 1) gotoSlot(current + 1); };

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
    if (document.getElementById('finishConfirmModal')) return;
    const ov = document.createElement('div');
    ov.id = 'finishConfirmModal';
    ov.innerHTML = `
      <div class="nav-guard-box">
        <div class="nav-guard-icon">🎓</div>
        <div class="nav-guard-title" style="color:var(--text)">Finalizezi simularea?</div>
        <div class="nav-guard-body">
          Exercițiile fără răspuns confirmat vor primi <strong>0 puncte</strong>.<br>
          Această acțiune este ireversibilă.
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn--surface" onclick="document.getElementById('finishConfirmModal').remove()">Înapoi la examen</button>
          <button class="btn btn--danger" onclick="
            document.getElementById('finishConfirmModal').remove();
            BMBac.confirmFinish();
          ">Da, finalizează</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  };

  window.BMBac.confirmFinish = function() {
    clearInterval(timerInterval);
    clearInterval(_lectieTimerInterval);
    _navGuardOff();
    _hideFsWarning();
    _exitFullscreen();
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
        item.score = item.confirmedAnswer === '__PROOF__' ? _slotDefs[i].points : 0;
        return;
      }
      const correct = normalizeAnswer(extractBoxedAnswer(sol));
      const student = normalizeAnswer(item.confirmedAnswer);
      item.score = (correct && student && correct === student) ? _slotDefs[i].points : 0;
    });
    current = 0;
    saveExam();
    updateNavbarForExam(false);
    if (exam.type !== 'lectie') saveToHistory();
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
    const maxPts = _slotDefs.reduce((s, slot) => s + slot.points, 0);
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

    const _examDuration = exam.type === 'lectie' ? LECTIE_DURATION : DURATION;
    let durationSec = exam.endTs
      ? Math.floor((exam.endTs - exam.startTs) / 1000)
      : _examDuration;
    const dH = Math.floor(durationSec / 3600);
    const dM = Math.floor((durationSec % 3600) / 60);

    const correctCount    = exam.slots.filter(item => item.exercise && (item.score || 0) > 0).length;
    const wrongCount      = exam.slots.filter(item => item.exercise && item.confirmedAnswer && (item.score || 0) === 0).length;
    const unansweredCount = exam.slots.filter(item => item.exercise && !item.confirmedAnswer).length;

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

      <div class="res-actions">
        <button class="btn btn--primary btn--lg" onclick="newSimulation()">🔄 Simulare Nouă</button>
        <a class="btn btn--surface btn--lg" href="index.html">Capitole</a>
      </div>

      <div class="ai-section" id="aiSection">
        <div class="ai-section__intro">
          <div class="ai-section__icon">🤖</div>
          <div>
            <div class="ai-section__title">Evaluare AI cu Gemini</div>
            <div class="ai-section__desc">Analizează rezolvările tale manuscrise și le compară cu baremul oficial.</div>
          </div>
          <button class="btn btn--ai" id="aiVerifyBtn" onclick="verifyExam()">Evaluează</button>
        </div>
        <div id="aiResultsSection"></div>
      </div>
    `;

    requestAnimationFrame(() => {
      const bar = document.querySelector('.res-score-bar__fill');
      if (bar) requestAnimationFrame(() => { bar.style.width = bar.dataset.width + '%'; });
    });
  }

  /* ================================================================
     AI EXAM VERIFICATION
  ================================================================ */

  // A stray tap on the canvas saves a fully-transparent PNG to item.work, which
  // would otherwise be composited onto white and sent to Gemini as if answered.
  // Return true when the strokes layer has no meaningful ink so we can skip it.
  function isBlankStrokes(strokesDataUrl) {
    return new Promise(function (resolve) {
      if (!strokesDataUrl || !strokesDataUrl.startsWith('data:image/png;base64,')) {
        resolve(true);
        return;
      }
      const img = new Image();
      img.onload = function () {
        const c   = document.createElement('canvas');
        c.width   = img.naturalWidth;
        c.height  = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let data;
        try {
          data = ctx.getImageData(0, 0, c.width, c.height).data;
        } catch (e) {
          resolve(false); // can't inspect pixels → assume it has content
          return;
        }
        let ink = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 12) {            // alpha above a small threshold = ink
            if (++ink > 40) { resolve(false); return; }
          }
        }
        resolve(true);                    // ≤40 non-transparent pixels → effectively blank
      };
      img.onerror = function () { resolve(true); };
      img.src = strokesDataUrl;
    });
  }

  function compositeOnBackground(strokesDataUrl, bgColor) {
    return new Promise(function (resolve) {
      if (!strokesDataUrl || !strokesDataUrl.startsWith('data:image/png;base64,')) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = function () {
        const MAX_W = 1200;
        const scale = img.naturalWidth > MAX_W ? MAX_W / img.naturalWidth : 1;
        const w = Math.round(img.naturalWidth  * scale);
        const h = Math.round(img.naturalHeight * scale);
        const off = document.createElement('canvas');
        off.width  = w;
        off.height = h;
        const ctx = off.getContext('2d');
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(off.toDataURL('image/png'));
      };
      img.onerror = function () { resolve(null); };
      img.src = strokesDataUrl;
    });
  }

  function compositeOnWhite(strokesDataUrl) {
    return compositeOnBackground(strokesDataUrl, '#ffffff');
  }

  // The stroke color depends on the theme active while drawing (dark theme
  // uses a near-white pen) — compositing that ink onto white for the AI
  // payload is fine for Gemini's OCR, but is illegible to a human viewer.
  // Sample the ink's average luminance and pick a contrasting background for
  // the read-only display snapshot.
  function detectInkIsLight(strokesDataUrl) {
    return new Promise(function (resolve) {
      if (!strokesDataUrl) { resolve(false); return; }
      const img = new Image();
      img.onload = function () {
        const SAMPLE = 200; // small sample is enough to estimate ink color
        const scale  = img.naturalWidth > SAMPLE ? SAMPLE / img.naturalWidth : 1;
        const w = Math.max(1, Math.round(img.naturalWidth  * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const c   = document.createElement('canvas');
        c.width   = w;
        c.height  = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        let data;
        try { data = ctx.getImageData(0, 0, w, h).data; }
        catch (e) { resolve(false); return; }
        let sum = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 30) {
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            count++;
          }
        }
        resolve(count > 0 && (sum / count) > 128);
      };
      img.onerror = function () { resolve(false); };
      img.src = strokesDataUrl;
    });
  }

  async function compositeForDisplay(strokesDataUrl) {
    const isLight = await detectInkIsLight(strokesDataUrl);
    return compositeOnBackground(strokesDataUrl, isLight ? '#1a1a1a' : '#ffffff');
  }

  function renderAiLoading(total) {
    return `
      <div class="ai-loading">
        <div class="ai-loading__spinner"></div>
        <div class="ai-loading__text">Se evaluează ${total} exerciții cu Gemini AI…</div>
        <div class="ai-loading__hint">Poate dura 30–60 de secunde</div>
      </div>`;
  }

  function renderAiResultsHTML(results, examTotalMaxim, images) {
    const totalAcordat = results.reduce((s, r) => s + (r.total_acordat || 0), 0);
    const totalMaxim   = examTotalMaxim || results.reduce((s, r) => s + (r.total_maxim || 0), 0);
    const pct = totalMaxim > 0 ? Math.round(totalAcordat / totalMaxim * 100) : 0;
    const scoreColor = pct >= 90 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';

    const itemsHtml = results.map((r, idx) => {
      const itemPct = r.total_maxim > 0 ? r.total_acordat / r.total_maxim : 0;
      const pill    = itemPct >= 0.8 ? 'correct' : itemPct > 0 ? 'partial' : 'wrong';

      const pasiHtml = (r.pasi || []).map(p => {
        const cls = p.corect ? 'correct' : p.puncte_acordate > 0 ? 'partial' : 'wrong';
        return `
          <div class="ai-step ai-step--${cls}">
            <span class="ai-step__dot"></span>
            <span class="ai-step__desc">${BM.esc(p.descriere)}</span>
            <span class="ai-step__pts">${p.puncte_acordate}/${p.puncte_maxime}p</span>
          </div>`;
      }).join('');

      // Read-only snapshot of exactly what was sent to Gemini for this
      // exercise, so the student can compare their handwriting to the verdict.
      const img = images && images[idx];

      return `
        <div class="ai-item${r.error ? ' ai-item--error' : ''}">
          <div class="ai-item__header">
            <span class="ai-item__label">${BM.esc(r.label)}</span>
            <span class="ai-score-pill ai-score-pill--${pill}">${r.total_acordat}/${r.total_maxim}p</span>
          </div>
          ${pasiHtml ? `<div class="ai-item__steps">${pasiHtml}</div>` : ''}
          ${r.observatii ? `<p class="ai-item__obs">${BM.esc(r.observatii)}</p>` : ''}
          ${img ? `
          <details class="ai-item__canvas-wrap">
            <summary>Vezi lucrarea ta</summary>
            <img class="ai-item__canvas" src="${img}" alt="Lucrarea manuscrisă pentru ${BM.esc(r.label)}">
          </details>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="ai-results">
        <div class="ai-results__summary">
          <span class="ai-results__grade" style="color:${scoreColor}">${totalAcordat}p</span>
        </div>
        <div class="ai-items">${itemsHtml}</div>
        <p class="ai-results__disclaimer">Evaluarea AI are caracter orientativ. Pot apărea inexactități în interpretarea scrisului de mână.</p>
      </div>`;
  }

  window.verifyExam = async function () {
    const btn     = document.getElementById('aiVerifyBtn');
    const section = document.getElementById('aiResultsSection');
    if (!btn || !section) return;

    btn.disabled    = true;
    btn.textContent = 'Se evaluează…';

    // Flush the last active canvas so its latest state is in item.work
    if (window._activeDrawingCanvas) window._activeDrawingCanvas.flush();

    const eligibleSlots = _slotDefs.filter((_, i) => exam.slots[i]?.exercise);
    section.innerHTML = renderAiLoading(eligibleSlots.length);

    try {
      // Build payload — composite each slot's strokes on white background
      const items = await Promise.all(_slotDefs.map(async (slot, i) => {
        const item = exam.slots[i];
        if (!item?.exercise) return null;

        // Treat an effectively-blank canvas (e.g. from a stray tap) as unanswered,
        // so it gets the "nerezolvat" path instead of a full barem evaluation.
        const blank        = await isBlankStrokes(item.work || null);
        const composite    = blank ? null : await compositeOnWhite(item.work);
        const canvasBase64 = composite ? composite.split(',')[1] : null;
        // Separate, contrast-aware snapshot for the read-only display below
        // each result — the Gemini payload always uses a white background,
        // but ink drawn in dark theme (near-white) would be invisible on it.
        const displayImg   = blank ? null : await compositeForDisplay(item.work);

        return {
          label:           slot.label,
          enunt:           item.exercise.statement || '',
          solutieOficiala: item.exercise.solution  || '',
          raspunsCorect:   extractBoxedAnswer(item.exercise.solution) || '',
          raspunsElev:     item.confirmedAnswer || '',
          puncteMaxime:    slot.points,
          // Official BAC barem for this exercise, when transcribed — overrides
          // the auto-derived equal split so Gemini grades against the exact
          // per-step criteria instead of guessing the point breakdown.
          barem:           item.exercise.barem || null,
          // true for baremes we generated heuristically (not a transcribed
          // official document) — tells the server not to call them "oficial".
          baremEstimat:    !!item.exercise.baremEstimat,
          canvasBase64,
          displayImg
        };
      }));

      const eligibleItems = items.filter(Boolean);
      const images  = eligibleItems.map(it => it.displayImg);
      // Strip the display-only image before sending — it's not needed by the
      // server and would roughly double the request payload size.
      const payload = eligibleItems.map(function (it) {
        const rest = Object.assign({}, it);
        delete rest.displayImg;
        return rest;
      });

      const resp = await fetch('/api/verify-exam', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error || `Server error ${resp.status}`);
      }

      const results = await resp.json();
      const examTotalMaxim = _slotDefs.reduce((s, sl) => s + (sl.points || 0), 0);
      section.innerHTML = renderAiResultsHTML(results, examTotalMaxim, images);
      if (window.renderMathInElement) {
        renderMathInElement(section, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$',  right: '$',  display: false },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false
        });
      }

      // Success path was leaving the button stuck on "Se evaluează…" forever —
      // re-enable it so the student can re-run after updating their work.
      btn.disabled    = false;
      btn.textContent = 'Reevaluează';

    } catch (e) {
      section.innerHTML = `
        <div class="ai-error">
          <strong>Evaluarea AI a eșuat.</strong><br>${BM.esc(e.message)}
        </div>`;
      btn.disabled    = false;
      btn.textContent = 'Reîncearcă';
    }
  };

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
      const maxPts = _slotDefs.reduce((s, slot) => s + slot.points, 0);
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
        breakdown: _slotDefs.map((slot, i) => ({
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
