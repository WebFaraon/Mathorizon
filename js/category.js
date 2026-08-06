/* ============================================================
   BACMath — Category Page Logic
   ============================================================ */

(function() {
  'use strict';

  let currentCategory  = null;
  let currentSubcat    = null;
  let statusFilter     = 'all'; // 'all' | 'unsolved' | 'solved'
  let diffFilter       = 'all'; // 'all' | 'usor' | 'mediu' | 'dificil' | 'legendar'
  let allExercises     = [];
  let filtered         = [];
  let viewInitialized  = false;

  /* ---- Package-based access: students see only the first N exercises
     per subchapter; teachers/admin are unrestricted. ---- */
  const FREE_EXERCISES_PER_SUBCAT = 10;

  /* ---- Collectible-card ("rarity") redesign — opt-in per subcategory.
     See renderExercises/renderFilterBar below for what this toggles. ---- */
  const RARITY_SUBCATS = new Set(['calcul-algebric', 'polinoame', 'geo-plana', 'geo-spatiu']);

  /* ---- Fav / solved action-button icons (SVG, not font glyphs — a plain
     "☐" read as an unclear placeholder rather than "mark as solved"). ---- */
  function iconHeart(filled) {
    return `<svg viewBox="0 0 24 24" width="15" height="15" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  }
  function iconCheck(done) {
    return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/>${done ? '<polyline points="7.8 12.4 10.6 15.2 16.3 9"/>' : ''}</svg>`;
  }

  function hasFullBankAccess() {
    const role = window.BMAuth?.role;
    return role === 'profesor' || role === 'admin';
  }

  /* ---- View transition helper ---- */
  function switchView(hideEl, showEl, renderFn) {
    const doShow = () => {
      hideEl.style.display = 'none';
      hideEl.classList.remove('view-exiting');
      renderFn();
      showEl.style.display = '';
      void showEl.offsetWidth; // force reflow so animation restarts
      showEl.classList.add('view-entering');
      showEl.addEventListener('animationend', () => showEl.classList.remove('view-entering'), { once: true });
      viewInitialized = true;
    };

    if (viewInitialized && hideEl.style.display !== 'none') {
      hideEl.classList.add('view-exiting');
      setTimeout(doShow, 160);
    } else {
      hideEl.style.display = 'none';
      doShow();
    }
  }

  /* ---- Init ---- */
  function init() {
    const catId = BM.getParam('id');
    if (!catId) { window.location.href = 'index.html'; return; }

    currentCategory = BM.getCategoryById(catId);
    if (!currentCategory) { window.location.href = 'index.html'; return; }

    allExercises = BM.EXERCISES.filter(e => e.categoryId === catId);

    renderHeader();
    initPanelBtns();
    BM.Storage.recordVisit();

    const subParam = BM.getParam('sub');
    if (subParam) {
      showExercisesView(subParam);
    } else {
      showCardsView();
    }
    BM.initScrollTop();
  }

  /* ---- Header ---- */
  function renderHeader() {
    const cat  = currentCategory;
    const prog = BM.Storage.getProgressForCategory(cat.id, BM.EXERCISES);

    document.title = `${cat.name} — Mathorizon`;

    const header = document.getElementById('catHeader');
    if (!header) return;
    header.innerHTML = `
      <svg class="cat-header__math-bg" xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 1440 200" preserveAspectRatio="xMidYMid slice"
           aria-hidden="true" focusable="false">
        <!-- All decorations in right half (x>720) to avoid overlapping text content -->
        <!-- Sine wave: axis y=112=4×28, x=728(26×28)→1064(38×28), half-period=56, amplitude=28 -->
        <g fill="none" stroke="${cat.color}">
          <line x1="728" y1="112" x2="1092" y2="112" stroke-width="1.0" opacity="0.18"/>
          <polyline points="1087,108 1095,112 1087,116" stroke-width="1.0" opacity="0.16"/>
          <path d="M 728 112 C 742 84,770 84,784 112 C 798 140,826 140,840 112
                   C 854 84,882 84,896 112 C 910 140,938 140,952 112
                   C 966 84,994 84,1008 112 C 1022 140,1050 140,1064 112"
                stroke-width="1.6" opacity="0.17"/>
        </g>
        <!-- Floating symbols, right zone -->
        <g fill="${cat.color}" font-family="Georgia,'Times New Roman',serif">
          <text x="756"  y="68"  font-size="44" opacity="0.08">∑</text>
          <text x="868"  y="180" font-size="34" opacity="0.075">∫</text>
          <text x="980"  y="60"  font-size="30" opacity="0.08">π</text>
          <text x="1040" y="174" font-size="13" opacity="0.065">f(x) = ax² + bx + c</text>
          <text x="1148" y="64"  font-size="38" opacity="0.08">Δ</text>
        </g>
        <!-- Coordinate axes + parabola, far right (origin 1288=46×28, 140=5×28) -->
        <g fill="none" stroke="${cat.color}">
          <line x1="1176" y1="140" x2="1412" y2="140" stroke-width="1.1" opacity="0.20"/>
          <line x1="1288" y1="28"  x2="1288" y2="180" stroke-width="1.1" opacity="0.20"/>
          <polyline points="1407,136 1415,140 1407,144" stroke-width="1.1" opacity="0.18"/>
          <polyline points="1284,33  1288,25  1292,33"  stroke-width="1.1" opacity="0.18"/>
          <!-- Parabola: M 1232 168 Q 1288 56 1344 168, peak at (1288,112)=46×28,4×28 -->
          <path d="M 1232 168 Q 1288 56 1344 168" stroke-width="1.7" opacity="0.17"/>
        </g>
      </svg>
      <div class="container">
        <div class="cat-header__inner">
          <div class="cat-header__icon" style="color:${cat.color};background:${cat.color}1a;border-color:${cat.color}33">
            ${cat.symbol}
          </div>
          <div class="cat-header__info">
            <h1 class="cat-header__name">${BM.esc(cat.name)}</h1>
            <p class="cat-header__desc">${BM.esc(cat.description)}</p>
            <div class="cat-hud">
              <div class="cat-hud__stat">
                <span class="cat-hud__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="3" width="16" height="18" rx="2.4"></rect>
                    <line x1="8" y1="8" x2="16" y2="8"></line>
                    <line x1="8" y1="12.2" x2="16" y2="12.2"></line>
                    <line x1="8" y1="16.4" x2="12.5" y2="16.4"></line>
                  </svg>
                </span>
                <div>
                  <div class="cat-hud__num" id="hdr-total">${prog.total}</div>
                  <div class="cat-hud__lbl">Exerciții</div>
                </div>
              </div>
              <div class="cat-hud__stat cat-hud__stat--solved">
                <span class="cat-hud__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="4 12.5 9.5 18 20 5"></polyline>
                  </svg>
                </span>
                <div>
                  <div class="cat-hud__num" id="hdr-solved">${prog.solved}</div>
                  <div class="cat-hud__lbl">Rezolvate</div>
                </div>
              </div>
              <div class="cat-hud__bar-block">
                <div class="cat-hud__bar-top">
                  <span class="cat-hud__bar-label">Progres</span>
                  <span class="cat-hud__bar-pct" id="hdr-pct" style="color:${cat.color}">${prog.percent}%</span>
                </div>
                <div class="cat-hud__track">
                  <div class="cat-hud__fill" id="catProgressFill" style="background:${cat.color}"></div>
                  <span class="cat-hud__tick" style="left:25%"></span>
                  <span class="cat-hud__tick" style="left:50%"></span>
                  <span class="cat-hud__tick" style="left:75%"></span>
                </div>
                <div class="cat-hud__bar-caption" id="hdr-progress-txt">${prog.solved} din ${prog.total} exerciții rezolvate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fill = document.getElementById('catProgressFill');
      if (fill) fill.style.width = prog.percent + '%';
    }));
  }

  /* ============================================================
     VIEW: Subcategory Cards
     ============================================================ */
  function showCardsView() {
    currentSubcat = null;
    const cardsEl = document.getElementById('subcatCardsSection');
    const exEl    = document.getElementById('exercisesSection');
    switchView(exEl, cardsEl, () => {
      resetHeaderToCategory();
      renderCatBreadcrumb();
      renderSubcatCards();
      refreshHeader();
    });
  }

  function renderCatBreadcrumb() {
    const cat = currentCategory;
    const bc  = document.getElementById('catBreadcrumb');
    if (!bc) return;
    const nameEl = document.getElementById('catBreadcrumbName');
    if (nameEl) {
      nameEl.textContent   = cat.name;
      nameEl.style.color   = cat.color;
    }
    bc.style.display = '';
  }

  /* ---- Header helpers: swap between category and subcategory ---- */
  function updateHeaderForSubcat(sub) {
    if (!sub) return;
    const header = document.getElementById('catHeader');
    if (!header) return;
    const nameEl = header.querySelector('.cat-header__name');
    const iconEl = header.querySelector('.cat-header__icon');
    const descEl = header.querySelector('.cat-header__desc');
    if (nameEl) nameEl.textContent = sub.name;
    if (iconEl) {
      iconEl.innerHTML         = sub.symbol;
      iconEl.style.color       = sub.color;
      iconEl.style.background  = sub.color + '22';
      iconEl.style.borderColor = sub.color + '44';
    }
    if (descEl) descEl.textContent = sub.description || currentCategory.description;
  }

  function resetHeaderToCategory() {
    const cat    = currentCategory;
    const header = document.getElementById('catHeader');
    if (!header) return;
    const nameEl = header.querySelector('.cat-header__name');
    const iconEl = header.querySelector('.cat-header__icon');
    const descEl = header.querySelector('.cat-header__desc');
    if (nameEl) nameEl.textContent = cat.name;
    if (iconEl) {
      iconEl.innerHTML         = cat.symbol;
      iconEl.style.color       = cat.color;
      iconEl.style.background  = cat.color + '1a';
      iconEl.style.borderColor = cat.color + '33';
    }
    if (descEl) descEl.textContent = cat.description;
  }

  function renderSubcatCards() {
    const cat    = currentCategory;
    const grid   = document.getElementById('subcatCardsGrid');
    if (!grid) return;

    const solved = BM.Storage.getSolved();

    grid.innerHTML = cat.subcategories.map((sub, i) => {
      const exs    = allExercises.filter(e => e.subcategoryId === sub.id);
      const count  = exs.length;
      const done   = exs.filter(e => solved[e.id]).length;
      const pct    = count > 0 ? Math.round((done / count) * 100) : 0;
      const empty  = count === 0;

      return `
        <div class="subcat-card${empty ? ' subcat-card--empty' : ''}"
             ${empty ? '' : `onclick="selectSubcat('${sub.id}')"`}
             style="--sc-color:${sub.color};animation-delay:${i * 0.04}s">
          <div class="subcat-card__top">
            <div class="subcat-card__icon"
                 style="color:${sub.color};background:${sub.color}22;border-color:${sub.color}33">
              ${sub.symbol}
            </div>
            ${empty
              ? '<span class="subcat-card__soon">În curând</span>'
              : `<div class="subcat-card__count"
                      style="color:${sub.color};border-color:${sub.color}44;background:${sub.color}15">
                   ${count} ex.
                 </div>`
            }
          </div>
          <div class="subcat-card__name">${BM.esc(sub.name)}</div>
          ${sub.description ? `<div class="subcat-card__desc">${BM.esc(sub.description)}</div>` : ''}
          ${!empty ? `
            <div class="subcat-card__footer">
              <div class="subcat-card__track">
                <div class="subcat-card__bar"
                     style="width:${pct}%;background:${sub.color}"></div>
              </div>
              <div class="subcat-card__prog">
                <span>${done} / ${count} exerciții</span>
                <span style="color:${sub.color};font-weight:700">${pct}%</span>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.subcat-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', (e.clientX - r.left) + 'px');
        card.style.setProperty('--mouse-y', (e.clientY - r.top) + 'px');
      });
    });
  }

  window.selectSubcat = function(subcatId) {
    showExercisesView(subcatId);
  };

  /* ============================================================
     VIEW: Exercises
     ============================================================ */
  function showExercisesView(subcatId) {
    currentSubcat = subcatId;
    statusFilter  = 'all';
    diffFilter    = 'all';
    const cardsEl = document.getElementById('subcatCardsSection');
    const exEl    = document.getElementById('exercisesSection');
    switchView(cardsEl, exEl, () => {
      const bc = document.getElementById('catBreadcrumb');
      if (bc) bc.style.display = 'none';
      const sub = BM.getSubcategoryById(currentCategory.id, subcatId);
      updateHeaderForSubcat(sub);
      renderBreadcrumb(sub);
      renderFilterBar();
      applyFilters();
      refreshHeader();
      const exParam = BM.getParam('ex');
      if (exParam) handleTargetExercise(exParam);
    });
  }

  window.goBackToCards = function() {
    showCardsView();
  };

  function renderBreadcrumb(sub) {
    const cat = currentCategory;
    const el  = document.getElementById('subcatBreadcrumb');
    if (!el) return;
    el.innerHTML = `
      <div class="container">
        <div class="subcat-bc__inner">
          <button class="subcat-bc__back" onclick="goBackToCards()">
            ← ${BM.esc(cat.name)}
          </button>
          <span class="subcat-bc__sep">›</span>
          <span class="subcat-bc__current" style="color:${sub ? sub.color : 'var(--accent-light)'}">
            ${sub ? BM.esc(sub.name) : subcatId}
          </span>
        </div>
      </div>
    `;
  }

  /* ---- Filter Bar ----
     Status (Toate/Nerezolvate/Rezolvate) and Raritate/Dificultate (Comun/
     Rar/Epic/Legendar) are two independent axes — statusFilter + diffFilter
     — so any combination (e.g. "Nerezolvate" + "Rar") can be active at
     once. Each cluster is its own labeled, boxed group so it's clear at a
     glance which chips belong together. */
  function renderFilterBar() {
    const bar = document.getElementById('filterBar');
    if (!bar) return;
    const isRarityPage = RARITY_SUBCATS.has(currentSubcat);
    bar.classList.toggle('filter-bar--rarity', isRarityPage);
    const diffLabel = isRarityPage ? 'Raritate' : 'Dificultate';

    const statusChips = `
      <button class="filter-chip ${statusFilter === 'all'      ? 'active' : ''}" data-fg="status" data-fv="all"      onclick="setFilter('status','all')">Toate</button>
      <button class="filter-chip ${statusFilter === 'unsolved' ? 'active' : ''}" data-fg="status" data-fv="unsolved" onclick="setFilter('status','unsolved')">Nerezolvate</button>
      <button class="filter-chip ${statusFilter === 'solved'   ? 'active' : ''}" data-fg="status" data-fv="solved"   onclick="setFilter('status','solved')">Rezolvate</button>
    `;
    const diffChips = `
      <button class="filter-chip easy      ${diffFilter === 'usor'     ? 'active' : ''}" data-fg="diff" data-fv="usor"     onclick="setFilter('diff','usor')">${isRarityPage ? 'Comun' : 'Ușor'}</button>
      <button class="filter-chip medium    ${diffFilter === 'mediu'    ? 'active' : ''}" data-fg="diff" data-fv="mediu"    onclick="setFilter('diff','mediu')">${isRarityPage ? 'Rar' : 'Mediu'}</button>
      <button class="filter-chip hard      ${diffFilter === 'dificil'  ? 'active' : ''}" data-fg="diff" data-fv="dificil"  onclick="setFilter('diff','dificil')">${isRarityPage ? 'Epic' : 'Greu'}</button>
      <button class="filter-chip legendary ${diffFilter === 'legendar' ? 'active' : ''}" data-fg="diff" data-fv="legendar" onclick="setFilter('diff','legendar')">Legendar</button>
    `;

    /* Rarity page only: below a certain width even the boxed-group chip
       layout is cramped, so a pair of native <select>s (hidden on desktop,
       see CSS) stand in instead — same statusFilter/diffFilter state
       underneath, just a friendlier control for a small screen. */
    bar.innerHTML = `
      <div class="filter-bar__chips">
        <div class="filter-bar__group">
          <span class="filter-label">Stare:</span>
          ${statusChips}
        </div>
        <div class="filter-bar__group">
          <span class="filter-label">${diffLabel}:</span>
          ${diffChips}
        </div>
      </div>
      ${isRarityPage ? `
      <div class="filter-bar__selects">
        <select class="filter-select" data-fg="status">
          <option value="all">Toate</option>
          <option value="unsolved">Nerezolvate</option>
          <option value="solved">Rezolvate</option>
        </select>
        <select class="filter-select" data-fg="diff">
          <option value="all">Toate raritățile</option>
          <option value="usor">Comun</option>
          <option value="mediu">Rar</option>
          <option value="dificil">Epic</option>
          <option value="legendar">Legendar</option>
        </select>
      </div>` : ''}
    `;

    if (isRarityPage) {
      bar.querySelectorAll('.filter-select').forEach(sel => {
        sel.value = sel.dataset.fg === 'status' ? statusFilter : diffFilter;
        buildCustomFilterSelect(sel);
      });
      ensureFilterSelectGlobalListeners();
    }
  }

  /* A native <select>'s open option list is drawn by the browser/OS itself
     — its font, corners and colors ignore page CSS entirely, which is why
     it looked like a completely different, unstyled control next to the
     rest of the site. Progressively enhance it into the same custom
     dropdown (.cls-csel) already built for classes.html, so it actually
     matches — the native <select> stays in the DOM, hidden, purely as the
     value holder setFilter()/applyFilters() already know how to read. */
  function buildCustomFilterSelect(sel) {
    const group = sel.dataset.fg;
    const wrapper = document.createElement('div');
    wrapper.className = 'cls-csel';
    /* Rarity select only: tint the trigger with the tier's own color (same
       green/blue/purple/orange as the desktop chips) so the mobile dropdown
       isn't left flat and colorless next to them — see updateCselTierClass. */
    if (group === 'diff') updateCselTierClass(wrapper, sel.value);

    const trigger = document.createElement('div');
    trigger.className = 'cls-csel__trigger';

    const display = document.createElement('span');
    display.className = 'cls-csel__display';
    display.setAttribute('data-has-value', '');
    display.textContent = sel.options[sel.selectedIndex]?.text || '';

    const arrow = document.createElement('span');
    arrow.className = 'cls-csel__arrow';
    arrow.innerHTML = '<svg width="11" height="7" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l5 5 5-5"/></svg>';

    trigger.appendChild(display);
    trigger.appendChild(arrow);

    const dropdown = document.createElement('div');
    dropdown.className = 'cls-csel__dropdown';

    const addOption = (opt) => {
      const item = document.createElement('div');
      item.className = 'cls-csel__option' + (opt.value === sel.value ? ' cls-csel__option--sel' : '');
      item.textContent = opt.text;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllFilterSelects();
        setFilter(group, opt.value);
      });
      dropdown.appendChild(item);
    };

    [...sel.children].forEach(child => {
      if (child.tagName === 'OPTGROUP') {
        const label = document.createElement('div');
        label.className = 'cls-csel__group-label';
        label.textContent = child.label;
        dropdown.appendChild(label);
        [...child.children].forEach(addOption);
      } else if (child.tagName === 'OPTION') {
        addOption(child);
      }
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = wrapper.classList.contains('cls-csel--open');
      closeAllFilterSelects();
      if (!wasOpen) wrapper.classList.add('cls-csel--open');
    });

    sel.style.display = 'none';
    sel.insertAdjacentElement('afterend', wrapper);
    /* Stashed so syncFilterUI() can keep this trigger's label/selected-
       option highlight correct whether the value changed via a click here
       or via a chip click elsewhere. */
    sel._cselWrapper = wrapper;
  }

  const CSEL_TIER_VALUES = ['all', 'usor', 'mediu', 'dificil', 'legendar'];
  function updateCselTierClass(wrapper, value) {
    CSEL_TIER_VALUES.forEach(v => wrapper.classList.remove('cls-csel--tier-' + v));
    wrapper.classList.add('cls-csel--tier-' + value);
  }

  function closeAllFilterSelects() {
    document.querySelectorAll('.cls-csel--open').forEach(w => w.classList.remove('cls-csel--open'));
  }

  let filterSelectListenersReady = false;
  function ensureFilterSelectGlobalListeners() {
    if (filterSelectListenersReady) return;
    filterSelectListenersReady = true;
    document.addEventListener('click', closeAllFilterSelects);
  }

  /* Status and difficulty/rarity are independent axes — clicking a diff
     chip that's already active clears it back to "all" (there's no
     standalone "Toate" chip in that row to fall back on the way the status
     group has one). */
  window.setFilter = function(group, value) {
    if (group === 'status') {
      statusFilter = value;
    } else {
      diffFilter = (diffFilter === value) ? 'all' : value;
    }
    syncFilterUI();
    applyFilters();
  };

  /* Keeps every chip and the mobile dropdowns (rarity page only, see
     renderFilterBar) in sync however the filter was actually changed —
     chip click, dropdown option click, or programmatic reset. */
  function syncFilterUI() {
    document.querySelectorAll('.filter-chip[data-fg="status"]').forEach(c => {
      c.classList.toggle('active', c.dataset.fv === statusFilter);
    });
    document.querySelectorAll('.filter-chip[data-fg="diff"]').forEach(c => {
      c.classList.toggle('active', c.dataset.fv === diffFilter);
    });
    document.querySelectorAll('.filter-select').forEach(sel => {
      const val = sel.dataset.fg === 'status' ? statusFilter : diffFilter;
      if (sel.value !== val) sel.value = val;
      const wrapper = sel._cselWrapper;
      if (!wrapper) return;
      const display = wrapper.querySelector('.cls-csel__display');
      if (display) display.textContent = sel.options[sel.selectedIndex]?.text || '';
      wrapper.querySelectorAll('.cls-csel__option').forEach((el, i) => {
        el.classList.toggle('cls-csel__option--sel', sel.options[i]?.value === sel.value);
      });
      if (sel.dataset.fg === 'diff') updateCselTierClass(wrapper, sel.value);
    });
  }

  /* ---- Apply Filters ---- */
  function applyFilters() {
    const solved   = BM.Storage.getSolved();
    const subExs   = currentSubcat
      ? allExercises.filter(e => e.subcategoryId === currentSubcat)
      : allExercises;

    /* Lock status is computed from the unfiltered per-subchapter order, so
       switching the difficulty/solved filter never changes which exercises
       count toward the free limit. */
    const fullAccess  = hasFullBankAccess();
    const unlockedIds = fullAccess ? null : new Set(subExs.slice(0, FREE_EXERCISES_PER_SUBCAT).map(e => e.id));

    filtered = subExs.filter(e => {
      if (statusFilter === 'solved'   && !solved[e.id]) return false;
      if (statusFilter === 'unsolved' &&  solved[e.id]) return false;
      if (diffFilter !== 'all' && e.difficulty !== diffFilter) return false;
      return true;
    }).map(e => Object.assign({}, e, { _locked: !fullAccess && !unlockedIds.has(e.id) }));

    renderExercises();
  }

  function getMathPreview(statement) {
    const display = statement.match(/\$\$([\s\S]*?)\$\$/);
    if (display) return '$$' + display[1].trim() + '$$';
    /* Among all inline math containing '=', pick the longest (most informative) */
    const allEq = [...statement.matchAll(/\$([^$\n]*=[^$\n]*)\$/g)];
    if (allEq.length > 0) {
      const best = allEq.reduce((a, b) => a[1].length >= b[1].length ? a : b);
      return '$$' + best[1].trim() + '$$';
    }
    /* Fallback: pick the longest inline math (handles ≥, ≤, etc.) */
    const allInline = [...statement.matchAll(/\$([^$\n]+)\$/g)];
    if (allInline.length > 0) {
      const best = allInline.reduce((a, b) => a[1].length >= b[1].length ? a : b);
      return '$$' + best[1].trim() + '$$';
    }
    return '';
  }

  /* ---- Rarity redesign (preview — see RARITY_SUBCATS above) ---- */
  const RARITY_BY_DIFF = BM.RARITY_BY_DIFF;

  function renderRarityCards(container) {
    const solved = BM.Storage.getSolved();
    const favs   = BM.Storage.getFavorites();
    const cat    = currentCategory;

    container.innerHTML = filtered.map((ex) => {
      const sub    = BM.getSubcategoryById(cat.id, ex.subcategoryId);
      const rarity = RARITY_BY_DIFF[ex.difficulty] || 'comun';

      if (ex._locked) {
        return `
        <div class="rarity-card rarity-card--locked" data-rarity="${rarity}" id="card-${ex.id}">
          <div class="rarity-card__inner">
            <div class="rarity-card__title rarity-card__title--locked">${BM.esc(ex.title)}</div>
          </div>
          <div class="rarity-card__lock-overlay">
            <span class="rarity-card__lock-icon" aria-hidden="true">🔒</span>
            <span class="rarity-card__lock-text">Pachet Standard necesar</span>
          </div>
        </div>`;
      }

      const isSolved  = !!solved[ex.id];
      const isFav     = favs.includes(ex.id);
      const hasFigure = !!ex.figureSvg;
      const formula   = getMathPreview(ex.statement) || BM.trustedNl2br(ex.statement);

      /* Geometry cards carry a figure (drawn separately in the Geometry
         Figure Editor) — the single-formula preview that works for
         algebra/polinoame doesn't apply (a synthetic-geometry statement is
         prose, not one clean equation), so the diagram itself becomes the
         visual anchor, same footprint as the formula box (title + source +
         box only, no statement text — matches algebra/polinoame exactly).
         Cards without a figure (e.g. the odd coordinate-only problem) fall
         back to the plain formula/text preview exactly like algebra cards. */
      const previewBox = hasFigure
        ? `<div class="rarity-card__statement">
             <div class="rarity-card__figure-thumb">${ex.figureSvg}</div>
           </div>`
        : `<div class="rarity-card__statement">
             <div class="rarity-card__statement-inner">
               <div class="rarity-card__statement-formula math-content">${formula}</div>
             </div>
           </div>`;

      const canEdit = window.BMAuth?.role === 'admin' && ex._custom;

      return `
        <div class="rarity-card" data-rarity="${rarity}" data-diff="${ex.difficulty}" id="card-${ex.id}" onclick="openRarityModal('${ex.id}', this)">
          <span class="rarity-badge">${rarity}</span>
          <div class="rarity-card__inner">
            <div class="rarity-card__top">
              <div class="rarity-card__tags">
                ${BM.pointsBadge(ex.puncteTotal, ex.puncteEstimat)}
                <span class="type-badge">${BM.esc(sub?.name || ex.subcategoryId)}</span>
              </div>
              <div class="rarity-card__actions" onclick="event.stopPropagation()">
                ${canEdit ? `<button class="ex-action-btn edit" onclick="editExercise('${ex.id}')" title="Editează exercițiul">✎</button>` : ''}
                <button class="ex-action-btn fav ${isFav ? 'active' : ''}"
                        onclick="toggleFav('${ex.id}', this)"
                        title="${isFav ? 'Elimină din favorite' : 'Adaugă la favorite'}">${iconHeart(isFav)}</button>
                <button class="ex-action-btn solved ${isSolved ? 'active' : ''}"
                        onclick="toggleSolved('${ex.id}', this)"
                        title="${isSolved ? 'Marchează ca nerezolvat' : 'Marchează ca rezolvat'}">${iconCheck(isSolved)}</button>
              </div>
            </div>
            <div class="rarity-card__title">${BM.esc(ex.title)}</div>
            <div class="rarity-card__source">${BM.esc(ex.source)}</div>
            ${previewBox}
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.rarity-card').forEach((card, i) => {
      card.style.animationDelay = `${Math.min(i * 30, 300)}ms`;
      card.classList.add('ex-entering');
      card.addEventListener('animationend', () => {
        card.classList.remove('ex-entering');
        card.style.animationDelay = '';
      }, { once: true });
    });

    if (window.renderMathInElement) BM.renderMath(container);
    /* Deferred a frame: on the initial subcategory navigation this renders
       inside switchView's doShow *before* it un-hides the exercises section
       (showEl.style.display is set back to '' right after this callback
       returns) — measuring synchronously here would run against a
       display:none ancestor, where every box/scroll dimension reads 0, so
       nothing would ever get scaled. Waiting a frame guarantees the section
       is actually visible and laid out first. */
    requestAnimationFrame(() => shrinkRarityFormulasToFit(container));
    /* The KaTeX web font can still be loading when the measurement above
       runs, so scrollWidth is read off fallback-font metrics — usually
       narrower than the real KaTeX glyphs. That under-measurement is what
       let several formulas skip scaling entirely (computed as "already
       fits") and then grow past the box once the real font swaps in, with
       nothing left to re-trigger a recompute. Re-running once fonts are
       actually ready re-measures against the final metrics. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => shrinkRarityFormulasToFit(container));
    }
  }

  /* Polynomial/matrix statements (polinoame) commonly render wider than the
     radicals/logs calcul-algebric was designed around, so the fixed 88px
     preview box can't just rely on a single font-size fitting everything —
     see css/style.css's .rarity-card__statement-formula comment. Scale each
     formula down only as much as it needs so it fits the box uniformly,
     instead of letting overflow-x:hidden silently clip long expressions. */
  function shrinkRarityFormulasToFit(container) {
    container.querySelectorAll('.rarity-card__statement').forEach(box => {
      const formula = box.querySelector('.rarity-card__statement-formula');
      if (!formula) return;
      formula.style.transform = '';
      /* Measure the innermost KaTeX element, not `formula` itself — both
         it and .katex-display carry their own overflow-x:hidden (see CSS),
         and scrollWidth on an element only reports what's visible past a
         *descendant's* own clipping, not past its own. Two nested hidden
         layers meant formula.scrollWidth always came back pre-clipped to
         "already fits", so overflow silently slipped through as invisible
         clipped pixels instead of ever triggering a shrink. */
      const katex = formula.querySelector('.katex-display, .katex');
      if (!katex) return;
      const cs = getComputedStyle(box);
      // A few px of slack so a shrunk formula never sits flush against the
      // box edge — fitting exactly to the pixel reads as clipped even when
      // technically nothing's cut off.
      const SAFETY = 6;
      const availW = box.clientWidth  - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)  - SAFETY;
      const availH = box.clientHeight - parseFloat(cs.paddingTop)  - parseFloat(cs.paddingBottom) - SAFETY;
      const needW  = katex.scrollWidth;
      const needH  = katex.scrollHeight;
      if (!needW || !needH) return;
      const scale = Math.min(1, availW / needW, availH / needH);
      if (scale < 1) formula.style.transform = `scale(${scale.toFixed(3)})`;
    });
  }

  function buildRarityModalBody(ex) {
    const cat   = currentCategory;
    const sub   = BM.getSubcategoryById(cat.id, ex.subcategoryId);
    const barem = Array.isArray(ex.barem) ? ex.barem : [];
    const total = ex.puncteTotal || barem.reduce((s, b) => s + (Number(b.puncte_maxime) || 0), 0);

    const stepsHtml = barem.map((b, i) => `
      <div class="rarity-step">
        <span class="rarity-step__num">${i + 1}</span>
        <div class="rarity-step__body math-content">${BM.trustedNl2br(b.descriere || '')}</div>
        <span class="rarity-step__pts">${b.puncte_maxime}p</span>
      </div>`).join('');

    return `
      <div class="rarity-modal__meta">
        ${BM.pointsBadge(ex.puncteTotal, ex.puncteEstimat)}
        <span class="type-badge">${BM.esc(sub?.name || ex.subcategoryId)}</span>
        <span class="source-text">${BM.esc(ex.source)}</span>
      </div>
      <h3 class="rarity-modal__title">${BM.esc(ex.title)}</h3>
      <div class="rarity-modal__statement math-content">${BM.trustedNl2br(ex.statement)}</div>
      ${BM.renderExerciseFigure(ex)}
      ${barem.length ? `
      <div class="rarity-modal__barem-title">Barem</div>
      ${stepsHtml}
      <div class="rarity-modal__total">Total <strong>${total}p</strong></div>` : ''}`;
  }

  function buildRarityModal(ex, rarity, hasPrev, hasNext) {
    return `
      <div class="classes-modal rarity-modal" id="rarityModal" data-rarity="${rarity}">
        <div class="classes-modal__backdrop"></div>
        <button class="rarity-modal__nav rarity-modal__nav--prev" id="rarityModalPrev" aria-label="Exercițiul anterior" ${hasPrev ? '' : 'hidden'}>‹</button>
        <button class="rarity-modal__nav rarity-modal__nav--next" id="rarityModalNext" aria-label="Exercițiul următor" ${hasNext ? '' : 'hidden'}>›</button>
        <div class="classes-modal__dialog rarity-modal__dialog">
          <div class="rarity-modal__head">
            <span class="rarity-badge">${rarity}</span>
            <button class="icon-btn" id="rarityModalClose">✕</button>
          </div>
          <div class="rarity-modal__body">${buildRarityModalBody(ex)}</div>
        </div>
      </div>`;
  }

  window.openRarityModal = function(id, originEl) {
    /* Navigable list mirrors what's actually on screen (respects the active
       filters) and skips locked cards — those never open a modal, so they'd
       be a dead end if included in prev/next. */
    const navList = filtered.filter(e => !e._locked);
    let navIdx = navList.findIndex(e => e.id === id);
    const ex = navIdx >= 0 ? navList[navIdx] : BM.EXERCISES.find(e => e.id === id);
    if (!ex) return;
    const rarity = RARITY_BY_DIFF[ex.difficulty] || 'comun';

    document.getElementById('rarityModal')?.remove();

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    /* Measured after the scroll lock above (not before) — locking overflow
       can drop the scrollbar and shift page content sideways, and the card
       needs to be measured in the same post-shift layout the modal itself
       will be measured in, or the two rects fall out of sync by the
       scrollbar's width. */
    const originRect = originEl ? originEl.getBoundingClientRect() : null;
    if (originEl) {
      originEl.classList.add('rarity-card--opening');
      originEl.addEventListener('animationend', () => originEl.classList.remove('rarity-card--opening'), { once: true });
    }

    const hasPrev = navIdx > 0;
    const hasNext = navIdx >= 0 && navIdx < navList.length - 1;

    const wrap = document.createElement('div');
    wrap.innerHTML = buildRarityModal(ex, rarity, hasPrev, hasNext);
    const modal = wrap.firstElementChild;
    document.body.appendChild(modal);
    BM.renderMath(modal);

    const dialog   = modal.querySelector('.rarity-modal__dialog');
    const backdrop = modal.querySelector('.classes-modal__backdrop');
    const prevBtn  = modal.querySelector('#rarityModalPrev');
    const nextBtn  = modal.querySelector('#rarityModalNext');
    const body     = modal.querySelector('.rarity-modal__body');

    /* Swap the dialog's content in place for prev/next instead of closing
       and re-opening the whole modal — keeps the dialog anchored where it
       is (no card-fly animation to a card that may be scrolled off-screen)
       and reads as flipping a page rather than a fresh navigation. */
    let navAnimating = false;
    const goTo = (newIdx, direction) => {
      if (newIdx < 0 || newIdx >= navList.length || navAnimating) return;
      navAnimating = true;
      navIdx = newIdx;
      const newEx = navList[navIdx];
      const newRarity = RARITY_BY_DIFF[newEx.difficulty] || 'comun';
      modal.dataset.rarity = newRarity;
      modal.querySelector('.rarity-badge').textContent = newRarity;
      prevBtn.hidden = navIdx <= 0;
      nextBtn.hidden = navIdx >= navList.length - 1;

      const outOffset = direction === 'next' ? -24 : 24;
      body.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
      body.style.opacity   = '0';
      body.style.transform = `translateX(${outOffset}px)`;
      setTimeout(() => {
        body.innerHTML = buildRarityModalBody(newEx);
        BM.renderMath(body);
        body.scrollTop = 0;
        body.style.transition = 'none';
        body.style.transform  = `translateX(${-outOffset}px)`;
        body.getBoundingClientRect(); /* force reflow before transitioning back in */
        requestAnimationFrame(() => {
          body.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
          body.style.opacity   = '1';
          body.style.transform = 'translateX(0)';
          setTimeout(() => { navAnimating = false; }, 180);
        });
      }, 150);
    };
    prevBtn.onclick = () => goTo(navIdx - 1, 'prev');
    nextBtn.onclick = () => goTo(navIdx + 1, 'next');

    /* Touch swipe (phone) — only acts on release past a horizontal
       threshold, and only when the gesture reads as clearly horizontal, so
       it never fights the body's own vertical scroll while it's happening. */
    let touchStartX = 0, touchStartY = 0, touchActive = false;
    dialog.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchActive = true;
    }, { passive: true });
    dialog.addEventListener('touchend', (e) => {
      if (!touchActive) return;
      touchActive = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) goTo(navIdx + 1, 'next');
        else        goTo(navIdx - 1, 'prev');
      }
    }, { passive: true });

    /* Fly the dialog in from the clicked card's exact position and size (a
       FLIP transition) so the card visually grows into the modal it opened,
       rather than the modal just popping up in the center of the screen.
       Falls back to a plain centered scale-in when there's no origin card
       (e.g. .rarity-modal__dialog { animation: none } in CSS hands entrance
       control entirely to this JS transition either way). */
    const targetRect = dialog.getBoundingClientRect();
    let fromTransform;
    if (originRect) {
      const scaleX = originRect.width  / targetRect.width;
      const scaleY = originRect.height / targetRect.height;
      const dx = (originRect.left + originRect.width  / 2) - (targetRect.left + targetRect.width  / 2);
      const dy = (originRect.top  + originRect.height / 2) - (targetRect.top  + targetRect.height / 2);
      fromTransform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    } else {
      fromTransform = 'translateY(12px) scale(0.94)';
    }

    dialog.style.transition = 'none';
    dialog.style.transform  = fromTransform;
    dialog.style.opacity    = '0';
    backdrop.style.transition = 'none';
    backdrop.style.opacity    = '0';
    dialog.getBoundingClientRect(); /* force reflow before transitioning */

    requestAnimationFrame(() => {
      dialog.style.transition = 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.26s ease';
      dialog.style.transform  = 'translate(0, 0) scale(1, 1)';
      dialog.style.opacity    = '1';
      backdrop.style.transition = 'opacity 0.3s ease';
      backdrop.style.opacity    = '1';
    });

    const finishClose = () => {
      modal.remove();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
    const close = () => {
      const currentRect = dialog.getBoundingClientRect();
      let toTransform;
      if (originRect) {
        const scaleX = originRect.width  / currentRect.width;
        const scaleY = originRect.height / currentRect.height;
        const dx = (originRect.left + originRect.width  / 2) - (currentRect.left + currentRect.width  / 2);
        const dy = (originRect.top  + originRect.height / 2) - (currentRect.top  + currentRect.height / 2);
        toTransform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
      } else {
        toTransform = 'translateY(12px) scale(0.94)';
      }
      dialog.style.transition = 'transform 0.26s ease, opacity 0.22s ease';
      dialog.style.transform  = toTransform;
      dialog.style.opacity    = '0';
      backdrop.style.transition = 'opacity 0.22s ease';
      backdrop.style.opacity    = '0';
      setTimeout(finishClose, 260);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft')  goTo(navIdx - 1, 'prev');
      else if (e.key === 'ArrowRight') goTo(navIdx + 1, 'next');
    };
    modal.querySelector('.classes-modal__backdrop').onclick = close;
    modal.querySelector('#rarityModalClose').onclick = close;
    document.addEventListener('keydown', onKey);
  };

  /* ---- Render exercises ---- */
  function renderExercises() {
    const container = document.getElementById('exercisesContainer');
    if (!container) return;

    if (filtered.length === 0) {
      container.classList.remove('exercises-container--rarity');
      container.innerHTML = `
        <div class="no-results">
          <div class="no-results__icon">🔍</div>
          <p>Niciun exercițiu găsit cu filtrele selectate.</p>
          <p style="margin-top:8px;font-size:0.85rem;color:var(--text-muted)">
            Încearcă să schimbi filtrele.
          </p>
        </div>`;
      return;
    }

    const isRarityPage = RARITY_SUBCATS.has(currentSubcat);
    container.classList.toggle('exercises-container--rarity', isRarityPage);
    if (isRarityPage) { renderRarityCards(container); return; }

    const solved = BM.Storage.getSolved();
    const favs   = BM.Storage.getFavorites();
    const cat    = currentCategory;

    container.innerHTML = filtered.map((ex, idx) => {
      const isSolved   = !!solved[ex.id];
      const isFav      = favs.includes(ex.id);
      const sub        = BM.getSubcategoryById(cat.id, ex.subcategoryId);
      const num        = String(idx + 1).padStart(2, '0');

      if (ex._locked) {
        return `
        <div class="ex-card ex-card--locked" id="card-${ex.id}" data-diff="${ex.difficulty}">
          <div class="ex-card__head">
            <div class="ex-card__num">${num}</div>
            <div class="ex-card__left">
              <div class="ex-card__meta">
                ${BM.diffBadge(ex.difficulty)}
                ${BM.pointsBadge(ex.puncteTotal, ex.puncteEstimat)}
                <span class="type-badge">${BM.esc(sub?.name || ex.subcategoryId)}</span>
              </div>
              <div class="ex-card__title ex-card__title--locked">${BM.esc(ex.title)}</div>
            </div>
          </div>
          <div class="ex-card__lock-overlay">
            <span class="ex-card__lock-icon" aria-hidden="true">🔒</span>
            <span class="ex-card__lock-text">Pachet Standard necesar</span>
          </div>
        </div>`;
      }

      const mathPrev   = getMathPreview(ex.statement);

      return `
        <div class="ex-card ${isSolved ? 'solved' : ''}" id="card-${ex.id}" data-diff="${ex.difficulty}">
          <div class="ex-card__head" onclick="toggleCard('${ex.id}')">
            <div class="ex-card__num">${num}</div>
            <div class="ex-card__left">
              <div class="ex-card__meta">
                ${BM.diffBadge(ex.difficulty)}
                ${BM.pointsBadge(ex.puncteTotal, ex.puncteEstimat)}
                <span class="type-badge">${BM.esc(sub?.name || ex.subcategoryId)}</span>
                ${ex._custom ? '<span class="type-badge type-badge--custom" title="Adăugat din panoul admin">✨ Adăugat</span>' : ''}
                <span class="source-text">${BM.esc(ex.source)}</span>
              </div>
              <div class="ex-card__title">${BM.esc(ex.title)}</div>
              ${mathPrev ? `<div class="ex-card__math-preview math-content">${mathPrev}</div>` : ''}
            </div>
            <div class="ex-card__actions" onclick="event.stopPropagation()">
              ${window.BMAuth?.role === 'admin' && ex._custom ? `<button class="ex-action-btn edit" onclick="editExercise('${ex.id}')" title="Editează exercițiul">✎</button>` : ''}
              <button class="ex-action-btn fav ${isFav ? 'active' : ''}"
                      onclick="toggleFav('${ex.id}', this)"
                      title="${isFav ? 'Elimină din favorite' : 'Adaugă la favorite'}">
                ${iconHeart(isFav)}
              </button>
              <button class="ex-action-btn solved ${isSolved ? 'active' : ''}"
                      onclick="toggleSolved('${ex.id}', this)"
                      title="${isSolved ? 'Marchează ca nerezolvat' : 'Marchează ca rezolvat'}">
                ${iconCheck(isSolved)}
              </button>
              <button class="ex-action-btn ex-card__expand" onclick="toggleCard('${ex.id}')">↓</button>
            </div>
          </div>

          <div class="ex-card__body" id="body-${ex.id}" onclick="toggleCard('${ex.id}')">
            <div class="ex-card__statement math-content">${BM.trustedNl2br(ex.statement)}</div>
            ${BM.renderExerciseFigure(ex)}
            <div class="ex-card__solution math-content" id="sol-${ex.id}"></div>
            <div class="ex-card__foot">
              <button class="btn btn--ghost" onclick="event.stopPropagation(); toggleSolution('${ex.id}')">Arată soluția</button>
              <button class="btn btn--success ${isSolved ? 'active' : ''}"
                      id="solveBtn-${ex.id}"
                      onclick="event.stopPropagation(); toggleSolved('${ex.id}', document.querySelector('#card-${ex.id} .ex-action-btn.solved'))">
                ${isSolved ? '✓ Rezolvat' : 'Marchează ca rezolvat'}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    /* Stagger entry animation — class removed after animationend so reflows don't restart it */
    container.querySelectorAll('.ex-card').forEach((card, i) => {
      card.style.animationDelay = `${Math.min(i * 30, 300)}ms`;
      card.classList.add('ex-entering');
      card.addEventListener('animationend', () => {
        card.classList.remove('ex-entering');
        card.style.animationDelay = '';
      }, { once: true });
    });

    if (window.renderMathInElement) BM.renderMath(container);
  }

  /* ---- Card toggle (accordion: max 1 deschis odată) ---- */
  window.toggleCard = function(id) {
    const card = document.getElementById(`card-${id}`);
    if (!card) return;
    const wasOpen = card.classList.contains('open');

    /* Închide toate cardurile deschise și resetează soluțiile */
    document.querySelectorAll('.ex-card.open').forEach(c => {
      c.classList.remove('open');
      const b = c.querySelector('.ex-card__expand');
      if (b) b.textContent = '↓';
      /* Ascunde soluția la închidere */
      const cId = c.id.replace('card-', '');
      const cSol = document.getElementById(`sol-${cId}`);
      if (cSol && cSol.classList.contains('visible')) {
        cSol.classList.remove('visible');
        cSol.innerHTML = '';
        const cBtn = cSol.parentElement?.querySelector('.btn--ghost');
        if (cBtn) cBtn.textContent = 'Arată soluția';
      }
    });

    /* Dacă nu era deschis, îl deschidem — soluția rămâne ascunsă */
    if (!wasOpen) {
      card.classList.add('open');
      const btn = card.querySelector('.ex-card__expand');
      if (btn) btn.textContent = '↑';

      /* Scroll smooth la card */
      setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  };

  /* ---- Solution toggle ---- */
  window.toggleSolution = function(id) {
    const sol = document.getElementById(`sol-${id}`);
    const ex  = BM.EXERCISES.find(e => e.id === id);
    if (!sol || !ex) return;
    if (sol.classList.contains('visible')) {
      sol.classList.remove('visible');
      sol.innerHTML = '';
      const btn = sol.parentElement.querySelector('.btn--ghost');
      if (btn) btn.textContent = 'Arată soluția';
    } else {
      sol.innerHTML = BM.trustedNl2br(ex.solution);
      sol.classList.add('visible');
      BM.renderMath(sol);
      const btn = sol.parentElement.querySelector('.btn--ghost');
      if (btn) btn.textContent = 'Ascunde soluția';
    }
  };

  /* ---- Solved toggle ---- */
  window.toggleSolved = function(id, actionBtn) {
    const nowSolved = BM.Storage.toggleSolved(id);
    const card      = document.getElementById(`card-${id}`);
    const solveBtn  = document.getElementById(`solveBtn-${id}`);

    if (card) card.classList.toggle('solved', nowSolved);
    if (actionBtn) {
      actionBtn.classList.toggle('active', nowSolved);
      actionBtn.innerHTML = iconCheck(nowSolved);
      actionBtn.title = nowSolved ? 'Marchează ca nerezolvat' : 'Marchează ca rezolvat';
    }
    if (solveBtn) {
      solveBtn.classList.toggle('active', nowSolved);
      solveBtn.textContent = nowSolved ? '✓ Rezolvat' : 'Marchează ca rezolvat';
    }

    /* Animație puls pe cardul întregului exercițiu */
    if (card) {
      card.classList.remove('anim-solved', 'anim-fav');
      void card.offsetWidth; /* forțează reflow pentru restart animație */
      if (nowSolved) card.classList.add('anim-solved');
      card.addEventListener('animationend', () => card.classList.remove('anim-solved', 'anim-fav'), { once: true });
    }

    BM.toast(
      nowSolved ? 'Exercițiu marcat ca rezolvat! 🎉' : 'Exercițiu marcat ca nerezolvat.',
      nowSolved ? 'success' : 'info'
    );
    refreshHeader();
  };

  /* ---- Favorite toggle ---- */
  window.toggleFav = function(id, btn) {
    const nowFav = BM.Storage.toggleFavorite(id);
    if (btn) {
      btn.classList.toggle('active', nowFav);
      btn.innerHTML = iconHeart(nowFav);
      btn.title = nowFav ? 'Elimină din favorite' : 'Adaugă la favorite';
    }

    /* Animație puls pe cardul întregului exercițiu */
    const card = document.getElementById(`card-${id}`);
    if (card) {
      card.classList.remove('anim-solved', 'anim-fav');
      void card.offsetWidth;
      if (nowFav) card.classList.add('anim-fav');
      card.addEventListener('animationend', () => card.classList.remove('anim-solved', 'anim-fav'), { once: true });
    }

    BM.toast(nowFav ? 'Adăugat la favorite! ♥' : 'Eliminat din favorite.',
             nowFav ? 'success' : 'info');
  };

  /* ---- Admin: edit an admin-added exercise (title/barem/figure) ----
     Only ever shown for ex._custom rows (see canEdit checks above) — static
     BM.EXERCISES seed content isn't in custom_exercises and has no id the
     edit wizard could load. */
  window.editExercise = function(id) {
    window.location.href = `admin-add-exercise.html?edit=${encodeURIComponent(id)}`;
  };

  /* ---- Refresh header progress (categorie sau subcategorie) ---- */
  function refreshHeader() {
    let prog;
    if (currentSubcat) {
      const subExs     = allExercises.filter(e => e.subcategoryId === currentSubcat);
      const solvedMap  = BM.Storage.getSolved();
      const solvedCnt  = subExs.filter(e => solvedMap[e.id]).length;
      const total      = subExs.length;
      prog = { solved: solvedCnt, total, percent: total > 0 ? Math.round((solvedCnt / total) * 100) : 0 };
    } else {
      prog = BM.Storage.getProgressForCategory(currentCategory.id, BM.EXERCISES);
    }

    const fill   = document.getElementById('catProgressFill');
    if (fill)    fill.style.width = prog.percent + '%';
    const elT    = document.getElementById('hdr-total');
    if (elT)     elT.textContent = prog.total;
    const elS    = document.getElementById('hdr-solved');
    if (elS)     elS.textContent = prog.solved;
    const elP    = document.getElementById('hdr-pct');
    if (elP)     elP.textContent = prog.percent + '%';
    const elTxt  = document.getElementById('hdr-progress-txt');
    if (elTxt)   elTxt.textContent = `${prog.solved} din ${prog.total} exerciții rezolvate`;
  }

  /* ---- Random set ---- */
  window.randomSet = function() {
    const pool = BM.shuffle(filtered).slice(0, 5);
    const ids  = pool.map(e => e.id);
    document.querySelectorAll('.ex-card').forEach(card => {
      const id = card.id.replace('card-', '');
      card.style.display = ids.includes(id) ? '' : 'none';
    });
    BM.toast(`Set aleatoriu de ${pool.length} exerciții generat! 🎲`, 'success');

    const container = document.getElementById('exercisesContainer');
    if (container && !document.getElementById('resetRandBtn')) {
      const wrap = document.createElement('div');
      wrap.id = 'resetRandBtn';
      wrap.style.marginBottom = '16px';
      wrap.innerHTML = `<button class="btn btn--surface" onclick="resetRandom(this)" style="font-size:0.85rem">Arată toate exercițiile</button>`;
      container.parentElement.insertBefore(wrap, container);
    }
  };

  window.resetRandom = function(btn) {
    document.querySelectorAll('.ex-card').forEach(c => c.style.display = '');
    btn?.parentElement?.remove();
  };

  /* ---- Handle target exercise from search ---- */
  function handleTargetExercise(exId) {
    setTimeout(() => {
      const card = document.getElementById(`card-${exId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('open');
        card.style.borderColor = 'var(--accent)';
        setTimeout(() => { card.style.borderColor = ''; }, 2000);
      }
    }, 300);
  }

  /* ---- Panel buttons ---- */
  function initPanelBtns() {
    document.getElementById('favBtn')?.addEventListener('click', openFavPanel);
    document.getElementById('histBtn')?.addEventListener('click', openHistory);
  }

  window.clearHistory = function() {
    BM.Storage.clearHistory();
    const list = document.getElementById('histList');
    if (list) list.innerHTML = `<div class="empty-state"><div class="empty-icon">◷</div><p>Nu ai rezolvat niciun exercițiu.</p><p class="text-muted">Exercițiile rezolvate vor apărea aici.</p></div>`;
    BM.toast('Istoricul a fost șters.', 'info');
  };

  function openHistory() {
    const hist = BM.Storage.getHistory();
    const list = document.getElementById('histList');
    if (!list) return;
    if (hist.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">◷</div><p>Nu ai rezolvat niciun exercițiu.</p><p class="text-muted">Exercițiile rezolvate vor apărea aici.</p></div>`;
    } else {
      list.innerHTML = hist.slice(0, 50).map(h => {
        const ex = BM.EXERCISES.find(e => e.id === h.id);
        if (!ex) return '';
        const cat = BM.getCategoryById(ex.categoryId);
        return `
          <div class="panel-ex-item" onclick="BM.gotoCategory('${ex.categoryId}', '${ex.subcategoryId}', '${ex.id}')">
            <span style="font-size:1.3rem">${cat?.symbol || '?'}</span>
            <div class="panel-ex-item__info">
              <div class="panel-ex-item__title">${BM.esc(ex.title)}</div>
              <div class="panel-ex-item__meta">${BM.esc(cat?.name || '')} · ${BM.diffBadge(ex.difficulty)}</div>
            </div>
            <span class="panel-ex-item__date">${BM.formatDate(h.ts)}</span>
          </div>`;
      }).join('');
    }
    BM.openPanel('hist');
  }

  function openFavPanel() {
    const favIds  = BM.Storage.getFavorites();
    const list    = document.getElementById('favList');
    if (!list) return;
    const catFavs = favIds
      .map(id => BM.EXERCISES.find(e => e.id === id && e.categoryId === currentCategory.id))
      .filter(Boolean);

    if (catFavs.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">♡</div><p>Niciun favorit în acest capitol.</p></div>`;
    } else {
      list.innerHTML = catFavs.map(ex => `
        <div class="panel-ex-item" onclick="selectSubcat('${ex.subcategoryId}');BM.closeAllPanels()">
          <div class="panel-ex-item__info">
            <div class="panel-ex-item__title">${BM.esc(ex.title)}</div>
            <div class="panel-ex-item__meta">${BM.diffBadge(ex.difficulty)}</div>
          </div>
        </div>`).join('');
    }
    BM.openPanel('fav');
  }

  /* ---- Re-render după sync cu DB ---- */
  document.addEventListener('bmauth:synced', () => {
    if (!currentCategory) return;
    const solved = BM.Storage.getSolved();

    /* Dacă suntem în view-ul de exerciții, refacem complet lista: reia atât
       starea de "rezolvat", cât și blocarea per-pachet, care depinde de
       BMAuth.role și era încă necunoscut la primul render (role se poate
       sincroniza după ce lista a fost deja afișată). */
    if (currentSubcat) {
      applyFilters();
    }

    /* Dacă suntem în view-ul cu carduri de subcategorii, actualizăm progresul în-place */
    if (!currentSubcat) {
      const grid = document.getElementById('subcatCardsGrid');
      if (grid) {
        const cards = grid.querySelectorAll('.subcat-card');
        currentCategory.subcategories.forEach((sub, i) => {
          const card = cards[i];
          if (!card) return;
          const exs   = allExercises.filter(e => e.subcategoryId === sub.id);
          const count = exs.length;
          const done  = exs.filter(e => solved[e.id]).length;
          const pct   = count > 0 ? Math.round((done / count) * 100) : 0;
          const bar   = card.querySelector('.subcat-card__bar');
          const prog  = card.querySelector('.subcat-card__prog');
          if (bar)  bar.style.width = pct + '%';
          if (prog) prog.innerHTML  =
            `<span>${done} / ${count} exerciții</span>` +
            `<span style="color:${sub.color};font-weight:700">${pct}%</span>`;
        });
      }
    }

    refreshHeader();
  });

  /* The grid's column count (and so each card's width) changes with
     viewport width via auto-fill/minmax — a scale computed once at render
     time goes stale across a resize or orientation change, leaving formulas
     either still-clipped or shrunk more than they now need to be. */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const container = document.getElementById('exercisesContainer');
      if (container && container.classList.contains('exercises-container--rarity')) {
        shrinkRarityFormulasToFit(container);
      }
    }, 150);
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
