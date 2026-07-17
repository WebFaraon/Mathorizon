/* ============================================================
   BACMath — Shared Utilities
   ============================================================ */

window.BM = window.BM || {};

/* ---- Hamburger menu ---- */
document.addEventListener('DOMContentLoaded', function () {
  const hamburger = document.getElementById('navHamburger');
  const menu      = document.getElementById('navMobileMenu');
  if (!hamburger || !menu) return;

  hamburger.addEventListener('click', function (e) {
    e.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
  });

  document.addEventListener('click', function (e) {
    if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
      hamburger.classList.remove('open');
    }
  });

  menu.querySelectorAll('.nav__mobile-link').forEach(function (link) {
    link.addEventListener('click', function () {
      menu.classList.remove('open');
      hamburger.classList.remove('open');
    });
  });
});

/* ---- Debounce ---- */
BM.debounce = function(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};

/* ---- Shuffle ---- */
BM.shuffle = function(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ---- Format date ---- */
BM.formatDate = function(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return 'acum';
  if (min < 60) return `acum ${min}m`;
  if (hr < 24) return `acum ${hr}h`;
  if (day === 1) return 'ieri';
  if (day < 7) return `acum ${day}z`;
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
};

/* ---- Difficulty label ---- */
BM.diffLabel = { usor: 'Ușor', mediu: 'Mediu', dificil: 'Greu', legendar: 'Legendar' };
BM.diffClass = { usor: 'usor', mediu: 'mediu', dificil: 'dificil', legendar: 'legendar' };

BM.diffBadge = function(difficulty) {
  return `<span class="diff-badge ${BM.diffClass[difficulty] || ''}">${BM.diffLabel[difficulty] || difficulty}</span>`;
};

/* ---- Points badge ---- */
// Renders nothing when puncteTotal isn't set yet (most non-calcul-algebric
// exercises still don't have one assigned — see [[ai-grading-barem-coverage]])
// rather than showing a misleading placeholder. When puncteEstimat is true,
// the value wasn't derived from the exam's fixed slot structure or an
// official barem — Gemini judged it from the solution's complexity — so it
// renders with a distinct dashed style + tooltip instead of looking equally
// certain as a confirmed one.
BM.pointsBadge = function(puncteTotal, puncteEstimat) {
  if (!puncteTotal) return '';
  if (puncteEstimat) {
    return `<span class="points-badge points-badge--estimat" title="Punctaj estimat de AI pe baza complexității — neconfirmat oficial">${puncteTotal}p ?</span>`;
  }
  return `<span class="points-badge">${puncteTotal}p</span>`;
};

/* ---- Escape HTML ---- */
BM.esc = function(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/* ---- Newlines to <br> — versiune TRUSTED (fără escape, pentru date din data.js) ---- */
BM.trustedNl2br = function(str) {
  /* Convertim \n la <br>, dar NUMAI în afara blocurilor $$ ... $$ */
  const parts = str.split(/([ \t]*\$\$[\s\S]*?\$\$[ \t]*)/g);
  return parts.map((p, i) => {
    if (i % 2 === 1) return p;           /* bloc $$...$$ — lăsat intact */
    return p
      .replace(/\n/g, '<br>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }).join('');
};

/* ---- Newlines to <br> ---- */
BM.nl2br = function(str) {
  return BM.esc(str).replace(/\n/g, '<br>');
};

/* ---- Extract the last \boxed{...} value out of a solution string (brace-depth aware) ---- */
BM.extractBoxedAnswer = function(solution) {
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
  // Some exercises write "\boxed{= 4}" (equals sign included) instead of
  // "\boxed{4}" — an inconsistency in the source content. Strip a leading
  // "=" so the extracted value is always just the answer itself.
  content = content.trim().replace(/^=\s*/, '');
  return content || null;
};

/* ---- Convert a raw-LaTeX final answer (from \boxed{...} or Gemini's
   raspuns_final) into the plain, Unicode-symbol form a student would
   actually type with the Simulări answer toolbar — e.g. "\frac{3}{2}" -> "3/2",
   "\sqrt{5}" -> "√5". Without this, a teacher who accepts the AI/bank
   suggestion as-is stores a correct_answer no real student's plain-text
   input could ever match, even when mathematically identical. Best-effort:
   covers the LaTeX that shows up in this app's own exercises/AI output, not
   arbitrary LaTeX. ---- */
BM.latexToPlain = function(str) {
  if (!str) return '';
  let s = String(str).trim();

  // Gemini sometimes wraps raspuns_final in its own $...$/$$...$$ even
  // though the prompt asks for bare LaTeX (same quirk admin-exercise.js
  // works around) — strip a surrounding pair before converting, or a stray
  // "$" would otherwise end up sitting in the plain-text answer.
  s = s.replace(/^\$\$?(.*?)\$\$?$/s, '$1').trim();

  s = s.replace(/\\left|\\right/g, '');

  // LaTeX spacing commands (\,  \;  \!  \quad  \qquad  \<space>) carry no
  // value of their own — "6\,426" is the single number 6426 with a
  // thousands-grouping hint, not "6 426" with an actual space in it. Strip
  // them to nothing (not a literal space) so a student typing "6426" with
  // zero spaces matches the stored correct_answer.
  s = s.replace(/\\(?:,|;|!|quad|qquad|thinspace|medspace|thickspace|enspace|\s)/g, '');

  s = s.replace(/\\sqrt\[(\d+)\]\{([^{}]*)\}/g, (m, n, x) => {
    const rootGlyph = { '2': '√', '3': '∛', '4': '∜' }[n];
    return rootGlyph ? rootGlyph + x : `${x}^(1/${n})`;
  });
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√$1');
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2');
  // A few frac/sqrt args are themselves simple enough to only need one more
  // pass (nested one level deep, e.g. \frac{1}{2}-style fractions inside a
  // \sqrt already replaced above) — safe to run twice since a plain (no
  // remaining braces) input is a no-op on the second pass.
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2');

  const SYMBOLS = {
    '\\cdot': '·', '\\times': '×', '\\pm': '±', '\\mp': '∓',
    '\\pi': 'π', '\\infty': '∞',
    '\\neq': '≠', '\\leq': '≤', '\\geq': '≥', '\\le': '≤', '\\ge': '≥',
    '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\subseteq': '⊆',
    '\\cup': '∪', '\\cap': '∩', '\\emptyset': '∅', '\\varnothing': '∅',
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\theta': 'θ'
  };
  for (const [cmd, glyph] of Object.entries(SYMBOLS)) {
    s = s.split(cmd).join(glyph);
  }

  const SUPERSCRIPT = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
  s = s.replace(/\^\{(-?\d+)\}/g, (m, n) => [...n].map(c => c === '-' ? '⁻' : (SUPERSCRIPT[c] || c)).join(''));
  s = s.replace(/\^(-?\d)/g,      (m, n) => [...n].map(c => c === '-' ? '⁻' : (SUPERSCRIPT[c] || c)).join(''));

  // \{ / \} are LaTeX's escaped literal braces (set notation, e.g. \{1,2\})
  // — protect them before stripping the *unescaped* braces that are just
  // LaTeX grouping syntax (like the ones \frac/\sqrt left behind above).
  s = s.replace(/\\\{/g, '\x01').replace(/\\\}/g, '\x02');
  s = s.replace(/[{}]/g, '');
  s = s.replace(/\x01/g, '{').replace(/\x02/g, '}');

  return s.trim();
};

/* ---- Render KaTeX math în element ---- */
BM.renderMath = function(el) {
  if (!el || !window.renderMathInElement) return;
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true  },
        { left: '$',  right: '$',  display: false }
      ],
      throwOnError: false,
      errorColor: '#ef4444'
    });
  } catch(e) { /* silently ignore */ }
};

/* ---- Extrage preview plain text (fără LaTeX) ---- */
BM.plainPreview = function(str) {
  return str
    .replace(/\$\$[\s\S]*?\$\$/g, '')   /* elimină blocuri display */
    .replace(/\$[^$\n]+\$/g, '')         /* elimină inline math */
    .replace(/\*\*([^*]+)\*\*/g, '$1')   /* elimină bold */
    .split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
};

/* ---- Toast ---- */
BM.toast = function(msg, type = 'info', duration = 2800) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${BM.esc(msg)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
};

/* ---- Panel / Modal ---- */
BM.openPanel = function(id) {
  document.getElementById('overlay')?.classList.add('open');
  document.getElementById(`panel-${id}`)?.classList.add('open');
};

BM.closeAllPanels = function() {
  document.getElementById('overlay')?.classList.remove('open');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
};

/* ---- Progress ring update ---- */
BM.updateProgressRing = function(ringId, percent) {
  const ring = document.getElementById(ringId);
  if (!ring) return;
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (percent / 100) * circumference;
  ring.style.strokeDashoffset = offset;
};

/* ---- Get URL param ---- */
BM.getParam = function(name) {
  return new URLSearchParams(window.location.search).get(name);
};

/* ---- Navigate to category page ---- */
BM.gotoCategory = function(categoryId, subcategoryId, exerciseId) {
  let url = `category.html?id=${categoryId}`;
  if (subcategoryId) url += `&sub=${subcategoryId}`;
  if (exerciseId) url += `&ex=${exerciseId}`;
  window.location.href = url;
};

/* ---- ExamToken system ---- */
BM.TOKEN_KEY     = 'bac_exam_tokens';
BM.TOKEN_DEFAULT = 0;

BM.getTokens = function () {
  const v = localStorage.getItem(BM.TOKEN_KEY);
  if (v === null) {
    localStorage.setItem(BM.TOKEN_KEY, String(BM.TOKEN_DEFAULT));
    return BM.TOKEN_DEFAULT;
  }
  return Math.max(0, parseInt(v, 10) || 0);
};

BM.consumeToken = function () {
  const n = BM.getTokens();
  if (n <= 0) return false;
  localStorage.setItem(BM.TOKEN_KEY, String(n - 1));
  BM.refreshTokenWidgets();
  return true;
};

BM.refreshTokenWidgets = function () {
  const isAdmin = window.BMAuth?.role === 'admin';
  const n = BM.getTokens();
  document.querySelectorAll('[data-token-count]').forEach(el => {
    el.textContent = isAdmin ? '∞' : n;
  });
  const w = document.getElementById('tokenWidget');
  if (!w) return;
  w.classList.toggle('token-widget--low',   !isAdmin && n === 1);
  w.classList.toggle('token-widget--empty', !isAdmin && n === 0);
  w.title = isAdmin ? 'Tokenuri nelimitate (cont admin)' : n === 0
    ? 'Nu mai ai ExamTokenuri. Achiziționează pentru a continua.'
    : `${n} ExamToken${n === 1 ? '' : 'uri'} disponibil${n === 1 ? '' : 'e'}`;
};

document.addEventListener('DOMContentLoaded', BM.refreshTokenWidgets);

/* ---- Nav: relocate theme toggle + token widget into the hamburger dropdown
   on narrow screens, instead of showing them (cramped) in the top bar. Moves
   the actual elements, not copies — same id, same listeners, same
   refreshTokenWidgets()/BM.toggleTheme() wiring, just re-parented — so
   there's never two token counts or two theme buttons to keep in sync. */
(function () {
  const mq = window.matchMedia('(max-width: 600px)');
  let inMobile = false;
  let tokenAnchor = null;
  let themeAnchor = null;
  let mobileRow   = null;

  function apply(matches) {
    if (matches === inMobile) return;
    const tokenWidget = document.getElementById('tokenWidget');
    const themeBtn    = document.getElementById('themeBtn');
    const mobileMenu  = document.getElementById('navMobileMenu');
    if (!tokenWidget || !themeBtn || !mobileMenu) return;

    if (matches) {
      tokenAnchor = document.createComment('nav-token-anchor');
      themeAnchor = document.createComment('nav-theme-anchor');
      tokenWidget.before(tokenAnchor);
      themeBtn.before(themeAnchor);
      mobileRow = document.createElement('div');
      mobileRow.className = 'nav__mobile-utility-row';
      mobileRow.append(themeBtn, tokenWidget);
      mobileMenu.appendChild(mobileRow);
    } else {
      tokenAnchor?.replaceWith(tokenWidget);
      themeAnchor?.replaceWith(themeBtn);
      mobileRow?.remove();
      mobileRow = null;
    }
    inMobile = matches;
  }

  document.addEventListener('DOMContentLoaded', () => {
    apply(mq.matches);
    mq.addEventListener('change', e => apply(e.matches));
  });
})();

/* ---- Scroll-to-top button ---- */
BM.initScrollTop = function() {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', function() {
    btn.classList.toggle('visible', window.scrollY > 350);
  }, { passive: true });
  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
};

/* ============================================================
   Custom select — replaces a native <select class="cls-form-select">
   (hidden globally via CSS, `.cls-form-select { display: none; }`) with
   a styled dropdown. Any such <select> MUST be passed through
   BM.initCustomSelects() after being added to the DOM, or it stays
   invisible/unusable.
   ============================================================ */
BM.makeCustomSelect = function(sel) {
  const wrapper = document.createElement('div');
  wrapper.className = 'cls-csel';

  const trigger = document.createElement('div');
  trigger.className = 'cls-csel__trigger';

  const display = document.createElement('span');
  display.className = 'cls-csel__display';
  const selectedOpt = sel.options[sel.selectedIndex] || sel.options[0];
  display.textContent = selectedOpt?.text || '';
  if (selectedOpt?.value) display.setAttribute('data-has-value', '');

  const arrow = document.createElement('span');
  arrow.className = 'cls-csel__arrow';
  arrow.innerHTML = `<svg width="11" height="7" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l5 5 5-5"/></svg>`;

  trigger.appendChild(display);
  trigger.appendChild(arrow);

  const dropdown = document.createElement('div');
  dropdown.className = 'cls-csel__dropdown';

  [...sel.options].forEach(opt => {
    const item = document.createElement('div');
    item.className = 'cls-csel__option' + (!opt.value ? ' cls-csel__option--placeholder' : '');
    if (opt.value && opt.value === sel.value) item.classList.add('cls-csel__option--sel');
    item.dataset.value = opt.value;
    item.textContent = opt.text;
    item.addEventListener('click', e => {
      e.stopPropagation();
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      display.textContent = opt.text;
      if (opt.value) display.setAttribute('data-has-value', ''); else display.removeAttribute('data-has-value');
      dropdown.querySelectorAll('.cls-csel__option--sel').forEach(el => el.classList.remove('cls-csel__option--sel'));
      if (opt.value) item.classList.add('cls-csel__option--sel');
      BM._closeAllCsels();
    });
    dropdown.appendChild(item);
  });

  wrapper.appendChild(trigger);
  wrapper.appendChild(dropdown);

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = wrapper.classList.contains('cls-csel--open');
    BM._closeAllCsels();
    if (!wasOpen) {
      wrapper.classList.add('cls-csel--open');
      BM._positionCselDropdown(trigger, dropdown);
    }
  });

  sel.style.display = 'none';
  sel.parentNode.insertBefore(wrapper, sel);
};

/* Fixed-position the dropdown off the trigger's viewport rect so it escapes
   clipping by a scrollable modal body (an absolutely-positioned dropdown
   was cut off whenever its field sat near the bottom of the scroll area).
   Flips upward if there's no room below. */
BM._positionCselDropdown = function(trigger, dropdown) {
  const rect   = trigger.getBoundingClientRect();
  const maxH   = 216;
  const below  = window.innerHeight - rect.bottom;
  const openUp = below < maxH + 8 && rect.top > below;
  dropdown.style.position = 'fixed';
  dropdown.style.left     = rect.left + 'px';
  dropdown.style.width    = rect.width + 'px';
  dropdown.style.right    = 'auto';
  if (openUp) {
    dropdown.style.top    = 'auto';
    dropdown.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
  } else {
    dropdown.style.bottom = 'auto';
    dropdown.style.top    = (rect.bottom + 5) + 'px';
  }
};

BM._closeAllCsels = function() {
  document.querySelectorAll('.cls-csel--open').forEach(w => w.classList.remove('cls-csel--open'));
};
document.addEventListener('click', () => BM._closeAllCsels());
// Scrolling INSIDE an open dropdown's own option list also fires a native
// 'scroll' event — since capture-phase listeners see it regardless of
// bubbling, a plain document-level listener can't tell that apart from the
// page/modal scrolling underneath it, and was closing the dropdown the
// instant you tried to scroll through its options.
document.addEventListener('scroll', (e) => {
  if (e.target?.closest && e.target.closest('.cls-csel__dropdown')) return;
  BM._closeAllCsels();
}, true);

BM.initCustomSelects = function(container) {
  (container || document).querySelectorAll('.cls-form-select').forEach(sel => BM.makeCustomSelect(sel));
};
