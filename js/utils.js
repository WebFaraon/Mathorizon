/* ============================================================
   BACMath — Shared Utilities
   ============================================================ */

window.BM = window.BM || {};

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
BM.diffLabel = { usor: 'Ușor', mediu: 'Mediu', greu: 'Greu' };
BM.diffClass = { usor: 'usor', mediu: 'mediu', greu: 'greu' };

BM.diffBadge = function(difficulty) {
  return `<span class="diff-badge ${BM.diffClass[difficulty] || ''}">${BM.diffLabel[difficulty] || difficulty}</span>`;
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
