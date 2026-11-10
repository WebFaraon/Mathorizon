/* ============================================================
   Teorema: Antrenament (training.html) logic
   ============================================================ */

(function() {
  'use strict';

  let selectedCount     = 10;
  let selectedSubcats   = new Set();
  let selectedDiff      = 'all';
  let expandedCats      = new Set(); // category ids whose subcat panel is expanded — chevron-driven, collapsed by default
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
  /* XP/solved/best-streak are NOT committed to storage per-card anymore —
     only staged here and written once in finishSession(). This is what lets
     "Renunță la sesiune" discard a session for real: there's nothing to
     revert, because nothing was persisted yet. */
  let pendingSolvedIds  = new Set();

  const XP_BASE = { usor: 10, mediu: 20, dificil: 35 };
  const MILESTONES = [3, 5, 8];
  /* Timer duration is now per-exercise (rarity × chapter), not a flat
     45s/90s — a Legendar geometry problem and a Comun arithmetic one can't
     realistically share a countdown. TIMER_BASE_BY_RARITY is the "Contra
     timp" (tight) reference; "Relaxat" scales it up. */
  const TIMER_BASE_BY_RARITY = { comun: 60, rar: 100, epic: 160, legendar: 240 };
  const TIMER_CATEGORY_MULT = { algebra: 1.0, geometrie: 1.3, analiza: 1.15, combinatorica: 1.1 };
  const TIMER_RELAXED_FACTOR = 1.6;
  const TIMER_XP_BONUS = { none: 1, relaxed: 1.2, strict: 1.5 }; // +20% / +50% XP for a correct, cronometrat answer

  /* Countdown (seconds) for one exercise under a given timer mode — rounded
     to the nearest 5s so the displayed time never looks arbitrarily precise. */
  function computeTimerSeconds(ex, mode) {
    if (mode === 'none') return 0;
    const rarity = BM.RARITY_BY_DIFF[ex.difficulty] || 'comun';
    const base = (TIMER_BASE_BY_RARITY[rarity] || TIMER_BASE_BY_RARITY.comun) * (TIMER_CATEGORY_MULT[ex.categoryId] || 1);
    const strict = Math.round(base / 5) * 5;
    return mode === 'relaxed' ? Math.round(strict * TIMER_RELAXED_FACTOR / 5) * 5 : strict;
  }

  /* In-memory cache for generated MCQ option sets — keyed by exercise id,
     lives for the page's lifetime (a fresh reload re-checks sessionStorage
     then Supabase, see renderMcqAnswerZone). */
  const mcqMemCache = new Map();

  function reduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---- Init ---- */
  const UNLOCKED_CATS = new Set(['algebra', 'geometrie']);

  function init() {
    renderConfig();
    BM.initScrollTop();
    setTimeout(() => document.body.classList.remove('an-boot'), 2600);
  }

  /* ---- Render config ---- */
  const RARITY_KEYS = [
    { id: 'all',      label: 'Toate',    pips: 0 },
    { id: 'usor',     label: 'Comun',    r: 'comun',    pips: 1 },
    { id: 'mediu',    label: 'Rar',      r: 'rar',      pips: 2 },
    { id: 'dificil',  label: 'Epic',     r: 'epic',     pips: 3 },
    { id: 'legendar', label: 'Legendar', r: 'legendar', pips: 4 }
  ];
  const RARITY_NAME = { comun: 'Comun', rar: 'Rar', epic: 'Epic', legendar: 'Legendar' };
  const RARITY_PIPS = { comun: 1, rar: 2, epic: 3, legendar: 4 };

  function pipsHtml(n) {
    if (!n) return '';
    return `<span class="an-pips" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i${i <= n ? ' class="on"' : ''}></i>`).join('')}</span>`;
  }

  /* A segmented group of keys: one is pressed in at a time. Built once;
     a click only flips aria-pressed, so nothing re-renders or replays. */
  function buildKeyGroup(box, items, isOn, onPick) {
    if (!box) return;
    box.innerHTML = '';
    items.forEach(it => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'an-key';
      if (it.r) btn.dataset.r = it.r;
      btn.innerHTML = it.html;
      if (it.title) btn.title = it.title;
      btn.setAttribute('aria-pressed', isOn(it) ? 'true' : 'false');
      btn.onclick = () => {
        onPick(it);
        box.querySelectorAll('.an-key').forEach((b, i) => b.setAttribute('aria-pressed', items[i] === it ? 'true' : 'false'));
        updateSummary();
      };
      box.appendChild(btn);
    });
  }

  function renderConfig() {
    buildKeyGroup(
      document.getElementById('countChips'),
      [5, 10, 15, 20].map(n => ({ n, html: String(n) })),
      it => it.n === selectedCount,
      it => { selectedCount = it.n; }
    );
    buildKeyGroup(
      document.getElementById('diffChips'),
      RARITY_KEYS.map(d => Object.assign({}, d, { html: `${pipsHtml(d.pips)}${d.label}` })),
      it => it.id === selectedDiff,
      it => { selectedDiff = it.id; refreshChapters(); } // per-type counts depend on the rarity filter
    );
    renderChapterList();
    renderTimerChips();
    renderTypeChips();
    renderExtraSettings();

    const all = document.getElementById('anAll');
    if (all) all.onclick = () => {
      BM.CATEGORIES.forEach(c => {
        if (UNLOCKED_CATS.has(c.id)) c.subcategories.forEach(s => { if (subcatExerciseCount(s) > 0) selectedSubcats.add(s.id); });
      });
      refreshChapters(); updateSummary();
    };
    const none = document.getElementById('anNone');
    if (none) none.onclick = () => { selectedSubcats.clear(); refreshChapters(); updateSummary(); };
    const fold = document.getElementById('anFold');
    if (fold) fold.onclick = () => {
      const open = fold.dataset.state !== 'open';
      document.querySelectorAll('.an-chap:not(.an-chap--soon)').forEach(sec => setChapterOpen(sec, open));
    };
    updateFoldAll();

    updateSummary();
    bootDisplay();
  }

  /* The display runs its segment test once, then shows the real readout. */
  function bootDisplay() {
    if (reduceMotion()) return;
    ['anFig', 'anSubs', 'anBonus', 'anPool'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '88'; });
    const min = document.getElementById('anMin'); if (min) min.textContent = '88 min';
    document.querySelectorAll('#anLcd .an-ann').forEach(a => a.classList.add('is-on'));
    setTimeout(updateSummary, 560);
  }

  /* Chapters are built once; toggling a type only refreshes counts and
     pressed states in place (so the entrance never replays). */
  function renderChapterList() {
    const chList = document.getElementById('chapterList');
    if (!chList) return;
    chList.innerHTML = '';
    BM.CATEGORIES.forEach((cat, i) => chList.appendChild(renderChapterBlock(cat, i)));
    refreshChapters();
  }

  /* Number of exercises available for this subcategory under the current
     rarity filter: a live preview, so the student sees where the exercises
     are before pressing Start. */
  function subcatExerciseCount(sub) {
    let n = 0;
    BM.EXERCISES.forEach(e => {
      if (e.subcategoryId !== sub.id) return;
      if (selectedDiff !== 'all' && e.difficulty !== selectedDiff) return;
      n++;
    });
    return n;
  }

  /* Selected types that actually hold an exercise under the current filter. */
  function effectiveSubcats() {
    const out = [];
    BM.CATEGORIES.forEach(cat => {
      if (!UNLOCKED_CATS.has(cat.id)) return;
      cat.subcategories.forEach(s => { if (selectedSubcats.has(s.id) && subcatExerciseCount(s) > 0) out.push(s.id); });
    });
    return out;
  }

  /* Chapters are accordions: open by default, a student who does not need one
     folds it away. The head still shows what is chosen (a count, a line and
     one segment per type), so nothing is hidden when it is folded. */
  const openCats = new Set(['algebra', 'geometrie']);

  function updateFoldAll() {
    const b = document.getElementById('anFold');
    if (!b) return;
    const allOpen = BM.CATEGORIES.filter(c => UNLOCKED_CATS.has(c.id)).every(c => openCats.has(c.id));
    b.dataset.state = allOpen ? 'open' : 'closed';
    const label = b.querySelector('[data-label]');
    if (label) label.textContent = allOpen ? 'Restrânge tot' : 'Extinde tot';
  }

  function setChapterOpen(sec, open) {
    sec.classList.toggle('an-chap--closed', !open);
    const t = sec.querySelector('.an-fold');
    if (t) {
      t.setAttribute('aria-expanded', String(open));
      t.setAttribute('aria-label', (open ? 'Restrânge ' : 'Extinde ') + sec.dataset.name);
    }
    if (open) openCats.add(sec.dataset.cat); else openCats.delete(sec.dataset.cat);
    updateFoldAll();
  }

  function renderChapterBlock(cat, i) {
    const locked = !UNLOCKED_CATS.has(cat.id);
    const sec = document.createElement('section');
    sec.className = 'an-chap' + (locked ? ' an-chap--soon' : '');
    sec.dataset.cat = cat.id;
    sec.dataset.name = cat.name;
    sec.id = `cat-item-${cat.id}`;
    sec.style.setProperty('--i', i);

    if (locked) {
      sec.innerHTML = `
        <header class="an-chap__head">
          <span class="an-tile"><span class="an-tile__s">${cat.symbol}</span></span>
          <div class="an-chap__txt"><h3 class="an-chap__name">${BM.esc(cat.name)}</h3></div>
          <span class="an-soon">${icon('lock', { size: 16 })} În curând</span>
        </header>`;
      sec.onclick = () => BM.toast('Exercițiile pentru acest capitol vor fi disponibile în curând.', 'info');
      return sec;
    }

    const open = openCats.has(cat.id);
    if (!open) sec.classList.add('an-chap--closed');
    const total = BM.EXERCISES.filter(e => e.categoryId === cat.id).length;
    sec.dataset.total = total;
    sec.innerHTML = `
      <header class="an-chap__head">
        <span class="an-tile"><span class="an-tile__s">${cat.symbol}</span></span>
        <div class="an-chap__txt">
          <h3 class="an-chap__name">${BM.esc(cat.name)}</h3>
          <p class="an-chap__meta" data-meta></p>
          <div class="an-picks" data-picks aria-hidden="true">${cat.subcategories.map(() => '<i></i>').join('')}</div>
        </div>
        <span class="an-count" data-count>0/${cat.subcategories.length}</span>
        <button type="button" class="an-key an-fold" aria-expanded="${open}" aria-label="${open ? 'Restrânge' : 'Extinde'} ${BM.esc(cat.name)}">${icon('chevron-down', { size: 20 })}</button>
      </header>
      <div class="an-chap__body"><div class="an-chap__inner">
        <div class="an-chap__bar">
          <button type="button" class="an-key an-key--sm" data-act="all">${icon('check', { size: 16 })} Alege tot</button>
          <button type="button" class="an-key an-key--sm" data-act="none">${icon('x', { size: 16 })} Golește</button>
        </div>
        <div class="an-chap__grid"></div>
      </div></div>`;

    const grid = sec.querySelector('.an-chap__grid');
    cat.subcategories.forEach((sub, j) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'an-sub';
      btn.dataset.id = sub.id;
      btn.style.setProperty('--j', Math.min(j, 16));
      btn.innerHTML = `
        <span class="an-sub__sym"><span>${sub.symbol}</span></span>
        <span class="an-sub__name">${BM.esc(sub.name)}</span>
        <span class="an-sub__n" title="Exerciții disponibile cu filtrul curent de raritate">0</span>
        <span class="an-sub__led" aria-hidden="true"></span>`;
      btn.onclick = () => toggleSubcat(sub.id);
      grid.appendChild(btn);
    });
    sec.querySelector('.an-chap__head').onclick = () => setChapterOpen(sec, sec.classList.contains('an-chap--closed'));
    sec.querySelector('[data-act="all"]').onclick = () => {
      cat.subcategories.forEach(s => { if (subcatExerciseCount(s) > 0) selectedSubcats.add(s.id); });
      refreshChapters(); updateSummary();
    };
    sec.querySelector('[data-act="none"]').onclick = () => {
      cat.subcategories.forEach(s => selectedSubcats.delete(s.id));
      refreshChapters(); updateSummary();
    };
    return sec;
  }

  function refreshChapters() {
    BM.CATEGORIES.forEach(cat => {
      if (!UNLOCKED_CATS.has(cat.id)) return;
      const sec = document.getElementById(`cat-item-${cat.id}`);
      if (!sec) return;
      let sel = 0, picked = 0;
      const picks = sec.querySelectorAll('[data-picks] i');
      cat.subcategories.forEach((sub, j) => {
        const btn = sec.querySelector(`.an-sub[data-id="${sub.id}"]`);
        if (!btn) return;
        const n = subcatExerciseCount(sub);
        const on = selectedSubcats.has(sub.id) && n > 0;
        if (on) { sel++; picked += n; }
        btn.disabled = n === 0;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.querySelector('.an-sub__n').textContent = n;
        if (picks[j]) { picks[j].classList.toggle('on', on); picks[j].classList.toggle('off', n === 0); }
      });
      const c = sec.querySelector('[data-count]');
      if (c) c.textContent = `${sel}/${cat.subcategories.length}`;
      const meta = sec.querySelector('[data-meta]');
      if (meta) {
        meta.textContent = sel > 0
          ? `${sel} din ${cat.subcategories.length} tipuri alese · ${picked} exerciții`
          : `${cat.subcategories.length} tipuri · ${sec.dataset.total} exerciții`;
        meta.classList.toggle('is-on', sel > 0);
      }
    });
  }

  function toggleSubcat(id) {
    if (selectedSubcats.has(id)) selectedSubcats.delete(id); else selectedSubcats.add(id);
    refreshChapters();
    updateSummary();
  }

  /* ---- Timer, answer type, unsolved-only ---- */
  function renderTimerChips() {
    buildKeyGroup(
      document.getElementById('timerChips'),
      [
        { id: 'none',    html: '<span>Fără</span>' },
        { id: 'relaxed', html: '<span>Relaxat</span><em class="an-bonus">+20% XP</em>', title: 'Timpul variază pe exercițiu, în funcție de raritate și capitol.' },
        { id: 'strict',  html: '<span>Contra timp</span><em class="an-bonus">+50% XP</em>', title: 'Timpul variază pe exercițiu, în funcție de raritate și capitol.' }
      ],
      it => it.id === selectedTimerMode,
      it => { selectedTimerMode = it.id; }
    );
  }

  function renderTypeChips() {
    buildKeyGroup(
      document.getElementById('typeChips'),
      [
        { id: 'mixed',   html: 'Mixt' },
        { id: 'written', html: 'Scris' },
        { id: 'mcq',     html: 'Variante' }
      ],
      it => it.id === selectedAnswerType,
      it => { selectedAnswerType = it.id; }
    );
  }

  function renderExtraSettings() {
    const box = document.getElementById('extraSettings');
    if (!box) return;
    box.innerHTML = '';
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'an-switch' + (unsolvedOnly ? ' on' : '');
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', String(unsolvedOnly));
    sw.innerHTML = '<span class="an-switch__slot"><span class="an-switch__knob"></span></span><span>Doar exerciții nerezolvate</span>';
    sw.onclick = () => {
      unsolvedOnly = !unsolvedOnly;
      sw.classList.toggle('on', unsolvedOnly);
      sw.setAttribute('aria-checked', String(unsolvedOnly));
      updateSummary();
    };
    box.appendChild(sw);
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

  /* ---- Live summary + start-key validation ---- */
  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const s = String(value);
    if (el.textContent === s) return;
    el.textContent = s;
    if (!reduceMotion()) { el.classList.remove('an-strobe'); void el.offsetWidth; el.classList.add('an-strobe'); }
  }

  function setAnnunciators(go) {
    const on = {
      comun:    selectedDiff === 'all' || selectedDiff === 'usor',
      rar:      selectedDiff === 'all' || selectedDiff === 'mediu',
      epic:     selectedDiff === 'all' || selectedDiff === 'dificil',
      legendar: selectedDiff === 'all' || selectedDiff === 'legendar',
      timer:    selectedTimerMode !== 'none',
      written:  selectedAnswerType === 'written',
      mcq:      selectedAnswerType === 'mcq',
      unsolved: unsolvedOnly,
      go
    };
    document.querySelectorAll('#anLcd [data-ann]').forEach(el => el.classList.toggle('is-on', !!on[el.dataset.ann]));
  }

  function showSummary(text, bad) {
    const line = document.getElementById('configSummaryText');
    const hint = document.getElementById('anHint');
    if (line) { line.textContent = text; line.classList.toggle('is-bad', !!bad); }
    if (hint) { hint.textContent = text; hint.classList.toggle('is-bad', !!bad); }
  }

  function updateSummary() {
    const startBtn = document.getElementById('startBtn');
    if (!startBtn) return;
    const subIds = effectiveSubcats();

    const blank = msg => {
      setText('anFig', '0'); setText('anMin', '--'); setText('anSubs', subIds.length); setText('anBonus', '--'); setText('anPool', 0);
      showSummary(msg, true);
      startBtn.disabled = true;
      setAnnunciators(false);
    };

    if (subIds.length === 0) { blank('Alege cel puțin un tip de exerciții.'); return; }

    const pool = buildPool();
    const available = Object.values(pool).reduce((sum, arr) => sum + arr.length, 0);
    if (available === 0) { blank('Niciun exercițiu cu aceste filtre. Încearcă alte setări.'); return; }

    startBtn.disabled = false;

    const diffLabels = { all: 'toate raritățile', usor: 'Comun', mediu: 'Rar', dificil: 'Epic', legendar: 'Legendar' };
    const timerLabels = { none: 'fără cronometru', relaxed: 'cronometru relaxat', strict: 'contra timp' };
    const willRun = Math.min(selectedCount, available);
    let perExerciseMin = 1.5;
    if (selectedTimerMode !== 'none') {
      const flatPool = Object.values(pool).flat();
      if (flatPool.length) {
        const avgSeconds = flatPool.reduce((sum, e) => sum + computeTimerSeconds(e, selectedTimerMode), 0) / flatPool.length;
        perExerciseMin = avgSeconds / 60;
      }
    }
    const minutes = Math.max(1, Math.round(willRun * perExerciseMin));
    const bonus = Math.round((TIMER_XP_BONUS[selectedTimerMode] - 1) * 100);

    setText('anFig', willRun);
    setText('anMin', `${minutes} min`);
    setText('anSubs', subIds.length);
    setText('anBonus', `+${bonus}%`);
    setText('anPool', available);

    let text = `${willRun} exerciții · ${diffLabels[selectedDiff]} · ${timerLabels[selectedTimerMode]}`;
    if (willRun < selectedCount) text += `. Ai cerut ${selectedCount}, dar sunt doar ${available} disponibile`;
    showSummary(text + '.', false);
    setAnnunciators(true);
  }

  /* ---- Setup <-> session ---- */
  function collapseConfigPanel() {
    const setup = document.getElementById('configContent');
    const hud = document.getElementById('trainingHud');
    const board = document.getElementById('flipBoard');
    window.scrollTo(0, 0);
    const finish = () => {
      setup.hidden = true;
      setup.classList.remove('an-setup--out');
      hud.hidden = false;
      board.hidden = false;
    };
    if (reduceMotion()) { finish(); return Promise.resolve(); }
    return new Promise(resolve => {
      setup.classList.add('an-setup--out');
      setTimeout(() => { finish(); resolve(); }, 260);
    });
  }

  function expandConfigPanel() {
    document.getElementById('trainingLayout').classList.remove('an-page--session');
    document.getElementById('trainingHud').hidden = true;
    document.getElementById('flipBoard').hidden = true;
    document.getElementById('configContent').hidden = false;
    window.scrollTo(0, 0);
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
    pendingSolvedIds = new Set();

    document.getElementById('resultsView').classList.remove('active');
    document.getElementById('resultsView').innerHTML = '';
    closeRevealOverlay(true);
    document.getElementById('trainingLayout').classList.add('an-page--session');

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
    const counter = document.getElementById('sessionCounter');
    if (counter) counter.textContent = `${revealedCount} / ${total}`;
    const segs = document.getElementById('sessionSegs');
    if (segs) {
      segs.innerHTML = cardStates.map(cs =>
        `<i class="${cs.status === 'correct' ? 'ok' : cs.status === 'incorrect' ? 'bad' : cs.status === 'ungraded' ? 'skip' : ''}"></i>`
      ).join('');
    }

    const grid = document.getElementById('flipGrid');
    if (!grid) return;
    grid.innerHTML = cardStates.map((cs, i) => {
      const done     = cs.status !== 'hidden';
      const ungraded = cs.status === 'ungraded';
      const good     = cs.status === 'correct';
      const rarity   = BM.RARITY_BY_DIFF[cs.ex.difficulty] || 'comun';
      const band     = `<div class="an-card__band"><span>${RARITY_NAME[rarity]}</span>${pipsHtml(RARITY_PIPS[rarity])}</div>`;
      const tone     = !done ? '' : ungraded ? ' an-card--skip' : good ? ' an-card--good' : ' an-card--bad';
      const tile     = ungraded ? '<span aria-hidden="true">·</span>' : icon(good ? 'check' : 'x', { size: 28 });
      const pts      = (done && !ungraded && cs.ex.puncteTotal) ? `<span class="an-card__pts">${good ? cs.ex.puncteTotal : 0}/${cs.ex.puncteTotal}p</span>` : '';
      const xp       = (done && !ungraded) ? `<span class="an-card__xp">+${cs.xpGain || 0} XP</span>` : '';
      return `
        <div class="an-card${done ? ' an-card--done' : ''}${tone}${dealAnimation ? ' an-card--deal' : ''}" data-idx="${i}" data-rarity="${rarity}" style="--i:${Math.min(i, 14)}"
             role="button" tabindex="0" aria-label="Cartea ${i + 1}, ${RARITY_NAME[rarity]}${done ? (ungraded ? ', rezolvare văzută' : good ? ', corect' : ', greșit') : ''}"
             onclick="trOpenCard(${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();trOpenCard(${i});}">
          <div class="an-card__inner${done ? ' an-card--flipped' : ''}">
            <div class="an-card__face an-card__face--back">
              ${band}
              <div class="an-card__emblem"></div>
              <div class="an-card__foot"><span class="an-no">#${String(i + 1).padStart(2, '0')}</span></div>
            </div>
            <div class="an-card__face an-card__face--front">
              ${band}
              <div class="an-card__res">
                ${done ? `<span class="an-res-tile">${tile}</span>${xp}${pts}<span class="an-card__again">Vezi rezolvarea</span>` : ''}
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

    /* Already solved: reopen read-only, to review the solution, not to
       answer again. No flip needed, it is already face up. */
    if (cs.status !== 'hidden') {
      renderRevealOverlay(idx, true);
      return;
    }

    const cardEl = document.querySelector(`.an-card[data-idx="${idx}"]`);
    if (!cardEl) { renderRevealOverlay(idx, false); return; }

    cardEl.classList.add('an-card--selecting');
    setTimeout(() => {
      cardEl.querySelector('.an-card__inner').classList.add('an-card--flipped');
      setTimeout(() => renderRevealOverlay(idx, false), 480);
    }, 200);
  };

  /* ---- Reveal dialog ---- */
  function renderRevealOverlay(idx, reviewMode) {
    document.body.style.overflow = 'hidden';
    const cs = cardStates[idx];
    const ex = cs.ex;
    const cat = BM.getCategoryById(ex.categoryId);
    const sub = BM.getSubcategoryById(ex.categoryId, ex.subcategoryId);
    const rarity = BM.RARITY_BY_DIFF[ex.difficulty] || 'comun';

    const modal = document.getElementById('revealModal');
    // Delegated on the modal itself: its innerHTML is replaced on every open, so a
    // listener on a step's button would go stale. Safe to call on each open.
    BM.bindExplanationToggles(modal);
    modal.dataset.rarity = rarity;

    /* The timer sits at the end of the legend row (never in review mode:
       the card has been answered already). */
    const timerHtml = (!reviewMode && selectedTimerMode !== 'none')
      ? `<span class="an-timer" id="revealTimer" title="Timp rămas. Răspunsurile cronometrate primesc un bonus de XP."></span>`
      : '';

    const headHtml = `
      <div class="an-m-meta">
        <span class="an-legend an-legend--r">${pipsHtml(RARITY_PIPS[rarity])}${RARITY_NAME[rarity]}</span>
        ${BM.pointsBadge(ex.puncteTotal, ex.puncteEstimat)}
        <span class="an-legend">${BM.esc(sub?.name || ex.subcategoryId)}</span>
        ${cat ? `<span class="an-legend">${BM.esc(cat.name)}</span>` : ''}
        ${timerHtml}
      </div>
      <h2 class="an-m-title">${BM.esc(ex.title)}</h2>
      <div class="an-m-statement math-content" id="revealStatement">${BM.trustedNl2br(ex.statement)}</div>
      ${BM.renderExerciseFigure(ex)}
    `;

    if (reviewMode) {
      const isCorrect = cs.status === 'correct';
      const bannerHtml = cs.status === 'ungraded'
        ? ''
        : isCorrect
          ? `<div class="an-banner an-banner--ok">Corect! <strong>+${cs.xpGain || 0} XP</strong></div>`
          : `<div class="an-banner an-banner--bad">Greșit. Răspunsul corect: $${BM.esc(cs.correctAnswerText || '')}$</div>`;
      modal.innerHTML = `
        ${headHtml}
        ${bannerHtml}
        ${buildSolutionBlockHtml(ex, false)}
        <div class="an-m-foot">
          <button class="an-key an-key--primary an-key--lg" type="button" id="revealContinueBtn">Închide</button>
        </div>
      `;
      modal.scrollTop = 0; // an innerHTML swap does not reset scroll on its own
      BM.renderMath(modal);
      BM.fitDisplayMath(modal);
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
          <div class="an-answer">
            <input type="text" id="revealAnswerInput" class="an-input" placeholder="Scrie răspunsul tău aici…" autocomplete="off" autocapitalize="off" spellcheck="false">
            <button class="an-go an-go--sm" type="button" id="revealSubmitBtn">Verifică răspunsul</button>
          </div>`
          : `<div class="an-load"><i></i><i></i><i></i> Se generează opțiunile…</div>`}
      </div>
      <div id="revealResultZone"></div>
    `;
    modal.scrollTop = 0;

    BM.renderMath(modal);
    BM.fitDisplayMath(modal);

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
     when ex.barem exists, otherwise the full solution at once under a
     distinct label, so the fallback never pretends to be a stepped barem it
     does not have. Also used, non-staggered, for the "Vezi rezolvarea"
     reveal on a correct answer and for reopening a solved card. */
  function buildSolutionBlockHtml(ex, staggered) {
    if (Array.isArray(ex.barem) && ex.barem.length) {
      const withExpl = ex.barem.filter(step => step.explicatie).length;
      const steps = ex.barem.map((step, i) => {
        const delay = (staggered && !reduceMotion()) ? i * 220 : 0;
        const ptsTitle = ex.baremEstimat ? ' title="Punctaj estimat de AI, neconfirmat oficial"' : '';
        // The explanation stays closed until the student asks for it (see
        // BM.explParts in js/utils.js); only the criterion and its points
        // are visible by default.
        let expl = '';
        if (step.explicatie) {
          const p = BM.explParts();
          expl = `
            <div class="an-step__expl-row">${p.button}</div>
            <div class="an-step__detail math-content" ${p.panelAttrs}>${BM.trustedNl2br(step.explicatie)}</div>`;
        }
        return `
          <div class="an-step" data-expl-step style="animation-delay:${delay}ms">
            <div class="an-step__head">
              <span class="an-step__num">Pasul ${i + 1}</span>
              <span class="an-step__pts"${ptsTitle}>${step.puncte_maxime}p${ex.baremEstimat ? ' ?' : ''}</span>
            </div>
            <div class="an-step__crit math-content">${BM.trustedNl2br(step.descriere)}</div>${expl}
          </div>`;
      }).join('');
      // With a single explanation, that step's own button does the same job.
      const toolbar = withExpl >= 2 ? `<header class="expl-toolbar">${BM.explToggleAllHtml()}</header>` : '';
      return `<div class="an-steps" data-expl-scope>${toolbar}${steps}</div>`;
    }
    return `
      <div class="an-sol-label">Rezolvare completă</div>
      <div class="an-sol math-content">${BM.trustedNl2br(ex.solution)}</div>`;
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
      <div class="an-opts">
        ${options.map((opt, i) => `
          <button class="an-opt" type="button" data-idx="${i}" onclick="trSelectMcqOption(${idx},${i})">
            <span class="an-opt__l">${'ABCD'[i] || i + 1}</span>
            <span class="an-opt__m math-content">${opt}</span>
          </button>`).join('')}
      </div>
    `;
    BM.renderMath(zone);
  }

  /* guestNoSession: true when the fallback is shown because the student
     is not logged in (rather than a genuine generation failure): softer
     copy inviting login instead of implying something broke. */
  function renderMcqFallback(idx, guestNoSession) {
    const ex = cardStates[idx].ex;
    const zone = document.getElementById('revealAnswerZone');
    if (!zone) return;
    zone.innerHTML = `
      <p class="an-hint">${guestNoSession
        ? `${icon('lock', { size: 16 })} Conectează-te pentru variante multiple generate automat. Deocamdată, iată soluția:`
        : `${icon('triangle-alert', { size: 16 })} Nu am putut genera variante de răspuns acum. Iată soluția:`}</p>
      <div class="an-sol math-content">${BM.trustedNl2br(ex.solution)}</div>
      <div class="an-m-foot"><button class="an-key an-key--primary an-key--lg" type="button" id="revealUnderstoodBtn">Am înțeles, continuă</button></div>
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
    document.querySelectorAll('.an-opt').forEach((btn, i) => {
      btn.disabled = true;
      if (i === cs._mcqCorrectIndex) btn.classList.add('is-right');
      else if (i === chosenIndex) btn.classList.add('is-wrong');
    });
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
    timerRemaining = computeTimerSeconds(cardStates[idx].ex, selectedTimerMode);
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
    const el = document.getElementById('revealTimer');
    if (!el) return;
    const safe = Math.max(0, timerRemaining);
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    el.innerHTML = `${m}<span class="an-colon">:</span>${String(s).padStart(2, '0')}`;
    el.classList.toggle('warning', timerRemaining <= 15 && timerRemaining > 7);
    el.classList.toggle('danger', timerRemaining <= 7);
  }

  function clearCardTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function trExpireCard(idx) {
    const cs = cardStates[idx];
    if (!cs || cs.status !== 'hidden' || activeCardIndex !== idx) return;
    const input = document.getElementById('revealAnswerInput');
    if (input) input.disabled = true;
    const submitBtn = document.getElementById('revealSubmitBtn');
    if (submitBtn) submitBtn.disabled = true;
    document.querySelectorAll('.an-opt').forEach((btn, i) => { btn.disabled = true; if (i === cs._mcqCorrectIndex) btn.classList.add('is-right'); });
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
      /* Staged, not committed — see pendingSolvedIds/finishSession. Abandoning
         mid-session must discard this, so nothing writes through here. */
      if (!BM.Storage.isSolved(ex.id)) pendingSolvedIds.add(ex.id);
    } else {
      currentStreak = 0;
      missedSubcats.add(ex.subcategoryId);
    }

    const xpGain = calcXp(ex.difficulty, isCorrect, currentStreak);
    cs.xpGain = xpGain;
    sessionXp += xpGain; // session-local only until finishSession() commits it
    renderHud();
    animateXpGain(xpGain);

    const resultZone = document.getElementById('revealResultZone');
    const answerZone = document.getElementById('revealAnswerZone');

    if (isCorrect) {
      /* The solution is not forced on a correct answer: available on demand
         via "Vezi rezolvarea" (do not bury the win under a wall of text the
         student did not ask for). */
      resultZone.innerHTML = `
        <div class="an-banner an-banner--ok">Corect! <strong>+${xpGain} XP</strong></div>
        <button class="an-key an-key--wide" type="button" id="revealShowSolutionBtn">${icon('book-open', { size: 16 })} Vezi rezolvarea</button>
        <div id="revealSolutionZone" hidden></div>
      `;
    } else {
      /* Wrong answers reveal the solution immediately, progressively when a
         real barem exists (see buildSolutionBlockHtml). The correct-answer
         text is LaTeX (e.g. "\frac{5}{2}"): it must be $-delimited or
         BM.renderMath (which only recognizes $/$$) leaves it raw. */
      resultZone.innerHTML = `
        <div class="an-banner an-banner--bad">Greșit. Răspunsul corect: $${BM.esc(correctAnswerText || '')}$</div>
        ${buildSolutionBlockHtml(ex, true)}
      `;
    }
    BM.renderMath(resultZone);
    resultZone.insertAdjacentHTML('beforeend', `
      <div class="an-m-foot">
        <button class="an-key an-key--primary an-key--lg" type="button" id="revealContinueBtn">Continuă</button>
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
    if (answerZone && !mcqPath) {
      const row = answerZone.querySelector('.an-answer');
      if (row) row.style.opacity = '0.55';
    }

    /* Update the grid card underneath so it flips-revealed with its difficulty color when we return */
    renderFlipGrid();
  }

  function closeRevealOverlay(silent) {
    clearCardTimer();
    document.getElementById('revealOverlay').classList.remove('open');
    document.body.style.overflow = '';
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
    ov.className = 'an-overlay';
    ov.innerHTML = `
      <div class="an-dialog" role="dialog" aria-modal="true">
        <div class="an-tile">${icon('triangle-alert', { size: 22 })}</div>
        <h3>Renunți la sesiunea curentă?</h3>
        <p>Pierzi progresul acestei sesiuni. XP-ul câștigat, seria și exercițiile rezolvate până acum nu se salvează.</p>
        <div class="an-dialog__keys">
          <button class="an-key" type="button" id="abandon-cancel">Înapoi</button>
          <button class="an-key an-key--danger" type="button" id="abandon-ok">Renunță</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const close = () => { ov.classList.remove('open'); setTimeout(() => ov.remove(), 260); };
    ov.querySelector('#abandon-cancel').onclick = close;
    ov.querySelector('#abandon-ok').onclick = () => { close(); restartTraining(); };
    ov.onclick = e => { if (e.target === ov) close(); };
    requestAnimationFrame(() => ov.classList.add('open'));
  };

  /* ---- HUD ---- */
  function renderHud() {
    const streakEl = document.getElementById('hudStreakVal');
    const xpEl     = document.getElementById('hudXpVal');
    if (streakEl) {
      streakEl.textContent = currentStreak;
      const wrap = document.getElementById('hudStreak');
      wrap.classList.remove('an-pulse');
      void wrap.offsetWidth;
      wrap.classList.add('an-pulse');
    }
    if (xpEl) xpEl.textContent = sessionXp;
    BM.Training.refreshWidgets();
  }

  /* A floating "+N XP" over the XP cell: the "animation when you collect XP". */
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
  }

  /* ---- XP & celebrations ---- */
  /* Timer bonus rewards the actual added risk: Contra timp (45s) is tighter
     than Relaxat (90s), so it pays out more. Only applies to correct
     answers — a wrong answer under a timer isn't "extra effort" worth
     rewarding on top of the usual consolation XP. */
  function calcXp(difficulty, isCorrect, streakAtGrade) {
    const base = XP_BASE[difficulty] || 15;
    if (!isCorrect) return 0;
    const streakMultiplier = 1 + Math.min(streakAtGrade, 10) * 0.1;
    const timerMultiplier = TIMER_XP_BONUS[selectedTimerMode] || 1;
    return Math.round(base * streakMultiplier * timerMultiplier);
  }

  function celebrateMilestone(streakCount) {
    BM.toast(`${streakCount} răspunsuri corecte la rând!`, 'success', 3200);
    fireConfetti();
  }

  function fireConfetti() {
    const layer = document.getElementById('confettiLayer');
    if (!layer) return;
    const colors = ['#5A31A6', '#7CB800', '#B4D95C', '#8B66DC', '#DE6A1E'];
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
    const trimmed = lastContent.trim();
    if (!trimmed) return null;
    /* Only route to typed input when the boxed content is a clean numeric/
       algebraic expression (number, fraction, radical, exponent, pi) —
       tryEvalNumeric (below) already correctly bails on brackets, braces,
       commas and any unhandled LaTeX command, so it doubles as the "is this
       a short symbolic answer, not an interval/set/equation/prose" check.
       (The previous "4+ letters not preceded by a backslash" regex broke on
       \infty/\emptyset — regex tries every start offset, so it matched
       "nfty"/"mptyset" mid-command — and, worse, let bracketed set answers
       like \{-1,\;1\} straight through, which normalizeAnswer's blind brace
       stripping then made ungradeable by any answer a student would type.) */
    if (tryEvalNumeric(trimmed) == null) return null;
    return trimmed;
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
    /* An LCD figure refreshes in stepped frames, it does not glide. */
    const steps = 10;
    let n = 0;
    const timer = setInterval(() => {
      n++;
      el.textContent = Math.round(target * n / steps);
      if (n >= steps) clearInterval(timer);
    }, 70);
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
        fill.style.transition = 'width 0.8s steps(20, end)';
        set(levelAfter, (xpAfter % perLevel) / perLevel);
        return;
      }
      // Crossed at least one level mid-session: fill to 100%, snap to 0%,
      // then fill to the new in-level amount — reads as "leveled up" even
      // when more than one level was crossed in a single session.
      fill.style.transition = 'width 0.5s steps(20, end)';
      set(levelBefore, 1);
      setTimeout(() => {
        fill.style.transition = 'none';
        set(levelAfter, 0);
        void fill.offsetWidth;
        fill.style.transition = 'width 0.5s steps(20, end)';
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

    /* Commit everything staged during the session — the only place any of
       this actually gets written to storage/DB (see gradeCard/pendingSolvedIds
       above). Must run before xpNow/getBestStreak are read below. */
    if (sessionXp > 0) BM.Training.addXp(sessionXp);
    pendingSolvedIds.forEach(id => { if (!BM.Storage.isSolved(id)) BM.Storage.toggleSolved(id); });
    if (bestStreakSession > 0) {
      if (bestStreakSession > BM.Storage.getBestCombo()) BM.Storage.setBestCombo(bestStreakSession);
      BM.Training.reportBestStreak(bestStreakSession);
    }

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

    document.getElementById('flipBoard').hidden = true;
    const resView = document.getElementById('resultsView');
    resView.classList.add('active');
    window.scrollTo(0, 0);

    const title  = pct >= 80 ? 'Excelent!' : pct >= 50 ? 'Bine!' : 'Continuă să exersezi!';
    const sub    = pct >= 80
      ? 'Ai rezolvat majoritatea exercițiilor. Ești pe drumul cel bun!'
      : pct >= 50
      ? 'Progres bun! Mai exersează capitolele dificile.'
      : 'Nu te descuraja. Practica face perfectă!';

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    /* Per-subcategory breakdown: where it went well, where it did not. One
       strip segment per card of that type. */
    const bySub = {};
    cardStates.forEach(cs => {
      const key = cs.ex.subcategoryId;
      if (!bySub[key]) bySub[key] = { correct: 0, total: 0, ex: cs.ex, marks: [] };
      bySub[key].total++;
      if (cs.status === 'correct') bySub[key].correct++;
      bySub[key].marks.push(cs.status === 'correct' ? 'ok' : cs.status === 'incorrect' ? 'bad' : '');
    });
    const breakdownRows = Object.values(bySub).map((s, i) => {
      const sub = BM.getSubcategoryById(s.ex.categoryId, s.ex.subcategoryId);
      const name = sub?.name || s.ex.subcategoryId;
      const scoreCls = s.correct === s.total ? 'good' : s.correct === 0 ? 'bad' : 'mixed';
      return `
        <div class="an-tape__row" style="--i:${Math.min(i, 10)}">
          <span class="an-tape__name">${BM.esc(name)}</span>
          <span class="an-tape__score an-tape__score--${scoreCls}">${s.correct}/${s.total}</span>
          <div class="an-tape__strip">${s.marks.map(m => `<i class="${m}"></i>`).join('')}</div>
        </div>`;
    }).join('');

    resView.innerHTML = `
      <div class="an-res">
        <div class="an-res__main">
          <section class="an-plate">
            <div class="an-plate__owl" role="img" aria-label="Bufnița Teorema"></div>
            <h2 class="an-plate__title">${title}</h2>
            <p class="an-plate__sub">${sub}</p>
            <div class="an-plate__tags">
              ${isPerfect ? '<span class="an-tag">Sesiune perfectă</span>' : ''}
              ${newRecord ? `<span class="an-tag">Record nou de serie: ${bestStreakSession}</span>` : ''}
              ${leveledUp ? `<span class="an-tag">Nivel nou: ${levelAfter}</span>` : ''}
            </div>
          </section>

          <div class="an-lcd an-lcd--res" role="group" aria-label="Scorul sesiunii">
            <div class="an-ann-row">
              <span class="an-ann is-on">SESIUNE</span>
              <span class="an-ann${isPerfect ? ' is-on' : ''}">PERFECT</span>
              <span class="an-ann${newRecord ? ' is-on' : ''}">RECORD</span>
              <span class="an-ann${leveledUp ? ' is-on' : ''}">NIVEL +</span>
            </div>
            <div class="an-lcd__row">
              <div class="an-lcd__fig"><b>${pct}%</b><span class="an-lcd__unit">${solved} din ${total} rezolvate</span></div>
            </div>
            <dl class="an-res__nums">
              <div><dt>XP câștigat</dt><dd id="resultsXpCount">0</dd></div>
              <div><dt>Serie maximă</dt><dd>${bestStreakSession}</dd></div>
              <div><dt>Timp total</dt><dd>${timeStr}</dd></div>
              <div><dt>Cărți</dt><dd>${total}</dd></div>
            </dl>
          </div>

          <div class="an-res__lvl">
            <div class="an-lvl">
              <span class="an-lvl__t">Nivel <span id="resultsLevelLabel">${levelBefore}</span></span>
              <div class="an-lvl__bar"><i id="resultsLevelFill" style="width:0%"></i></div>
              <span class="an-lvl__xp" id="resultsLevelXp"></span>
            </div>
          </div>
        </div>

        <aside class="an-res__side">
          <section class="an-tape">
            <h3 class="an-tape__title">Defalcare pe tipuri</h3>
            ${breakdownRows}
          </section>
          <div class="an-res__keys">
            <button class="an-go" type="button" style="--i:0" onclick="restartTraining()">
              <span class="an-go__led" aria-hidden="true"></span>
              Sesiune nouă
              ${icon('refresh-cw', { size: 20 })}
            </button>
            ${missedSubcats.size > 0 ? `
            <button class="an-key" type="button" style="--i:1" onclick="repeatMistakes()">
              ${icon('refresh-cw', { size: 16 })} Repetă greșelile
            </button>` : ''}
            <a class="an-key" style="--i:2" href="capitole.html">
              ${icon('arrow-left', { size: 16 })} Înapoi la capitole
            </a>
          </div>
        </aside>
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
    refreshChapters();
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
    pendingSolvedIds = new Set();

    document.getElementById('resultsView').classList.remove('active');
    document.getElementById('resultsView').innerHTML = '';

    expandConfigPanel();
    refreshChapters();
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
