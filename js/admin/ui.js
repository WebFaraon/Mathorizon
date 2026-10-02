/* ============================================================
   Mathorizon admin console: shared UI helpers
   ============================================================
   Small DOM helpers used by every view (js/admin/views/*.js):
   escaping, formatting, filter state kept in the URL hash query,
   the multi-select filter dropdown, chips, a sortable table, the
   side drawer and toasts. All markup uses the ax- prefix and is
   styled by css/admin.css.
   ============================================================ */
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const nf = new Intl.NumberFormat('ro-RO');
  const money = n => (n < 0 ? '−' : '') + nf.format(Math.abs(n)) + ' lei';
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const hh = h => String(h).padStart(2, '0') + ':00';
  const plural = (n, one, many) => `${nf.format(n)} ${n === 1 ? one : many}`;

  function daysLabel(days) {
    const D = window.AdminData.DAYS;
    return days.map(d => D[d - 1].name).join(' / ');
  }

  /* Icons: reuse the site's Lucide set (js/icons.js) when a name exists,
     with a few extra line icons the console needs. */
  const EXTRA = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    grid: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    door: '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/>',
    filter: '<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
    panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    sort: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    phone: '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'user-x': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/>',
    swap: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'chevrons-left': '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>'
  };
  function ico(name, size) {
    size = size || 18;
    if (EXTRA[name]) {
      return `<svg class="ax-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EXTRA[name]}</svg>`;
    }
    if (window.icon) return window.icon(name, { size: [14, 16, 18, 20, 24, 32].includes(size) ? size : 16, className: 'ax-ico' });
    return '';
  }

  /* ---- filter state in the hash: #orar?status=activ,completare&q=... ---- */
  function readQuery() {
    const q = (location.hash.split('?')[1] || '');
    const out = {};
    new URLSearchParams(q).forEach((v, k) => { out[k] = v; });
    return out;
  }
  function writeQuery(obj) {
    const route = location.hash.split('?')[0] || '#acasa';
    const p = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
      p.set(k, Array.isArray(v) ? v.join(',') : v);
    });
    const s = p.toString();
    history.replaceState(null, '', route + (s ? '?' + s : ''));
  }
  const listParam = (q, k) => (q[k] ? q[k].split(',').filter(Boolean) : []);

  /* ---- multi-select filter (a disclosure with check rows) ---- */
  function multiSelect({ id, label, options, selected, onChange, tone }) {
    const sel = new Set(selected || []);
    const wrap = document.createElement('div');
    wrap.className = 'ax-ms' + (sel.size ? ' is-set' : '');
    wrap.dataset.id = id;
    const render = () => {
      wrap.classList.toggle('is-set', sel.size > 0);
      wrap.querySelector('.ax-ms__count').textContent = sel.size ? sel.size : '';
      wrap.querySelectorAll('.ax-ms__opt').forEach(o => {
        const on = sel.has(o.dataset.value);
        o.classList.toggle('is-on', on);
        o.setAttribute('aria-checked', String(on));
      });
    };
    wrap.innerHTML = `
      <button type="button" class="ax-ms__btn" aria-expanded="false">
        <span class="ax-ms__label">${esc(label)}</span>
        <span class="ax-ms__count"></span>
        ${ico('chevron-down', 16)}
      </button>
      <div class="ax-ms__list" role="listbox" aria-multiselectable="true" aria-label="${esc(label)}"><div class="ax-ms__clip"><div class="ax-ms__in">
        ${options.map(o => `
          <button type="button" class="ax-ms__opt${tone ? ' ax-tone--' + esc(o.tone || o.value) : ''}" role="option" data-value="${esc(o.value)}" aria-checked="false">
            <span class="ax-ms__box" aria-hidden="true"></span><span>${esc(o.label)}</span>
            ${o.count != null ? `<span class="ax-ms__n">${nf.format(o.count)}</span>` : ''}
          </button>`).join('')}
      </div></div></div>`;
    const btn = wrap.querySelector('.ax-ms__btn');
    btn.addEventListener('click', () => {
      const open = !wrap.classList.contains('is-open');
      wrap.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
    wrap.querySelectorAll('.ax-ms__opt').forEach(o => o.addEventListener('click', () => {
      const v = o.dataset.value;
      if (sel.has(v)) sel.delete(v); else sel.add(v);
      render();
      onChange(Array.from(sel));
    }));
    wrap.clear = () => { sel.clear(); render(); };
    render();
    return wrap;
  }


  /* ---- single-select dropdown ----
     Every native <select class="ax-select"> is replaced by a button that
     opens a popover in the same style as the multi-select filters. The
     native element stays in the DOM (hidden), so views keep reading
     .value and listening to 'change'. A MutationObserver upgrades selects
     that views render later. */
  let selPop = null;
  function closeSelPop(focusBtn) {
    if (!selPop) return;
    const p = selPop; selPop = null;
    p.wrap.classList.remove('is-open');
    p.btn.setAttribute('aria-expanded', 'false');
    p.pop.classList.add('is-closing');
    setTimeout(() => p.pop.remove(), 120);
    document.removeEventListener('pointerdown', p.onDown, true);
    document.removeEventListener('scroll', p.onScroll, true);
    window.removeEventListener('resize', p.onScroll);
    p.btn.removeEventListener('keydown', p.onKey);
    if (focusBtn) p.btn.focus({ preventScroll: true });
  }

  function enhanceSelect(native) {
    if (native.dataset.axEnh) return;
    native.dataset.axEnh = '1';
    const wrap = document.createElement('div');
    wrap.className = 'ax-sel';
    const cs = getComputedStyle(native);
    if (cs.minWidth && cs.minWidth !== '0px' && cs.minWidth !== 'auto') wrap.style.minWidth = cs.minWidth;
    native.before(wrap);
    wrap.append(native);
    native.classList.add('ax-sel__native');
    native.tabIndex = -1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ax-sel__btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (cs.minHeight && cs.minHeight !== '0px' && cs.minHeight !== 'auto') btn.style.minHeight = cs.minHeight;
    if (native.id) {
      const lab = document.querySelector(`label[for="${native.id}"]`);
      if (lab) { if (!lab.id) lab.id = native.id + '-lbl'; btn.setAttribute('aria-labelledby', lab.id); }
    }
    wrap.append(btn);

    const opts = () => Array.from(native.options);
    const sync = () => {
      const o = native.options[native.selectedIndex];
      btn.innerHTML = `<span class="ax-sel__v">${esc(o ? o.textContent : '')}</span>${ico('chevron-down', 16)}`;
      btn.disabled = native.disabled;
      wrap.classList.toggle('is-set', !!(o && o.value !== '' && native.selectedIndex > 0));
    };
    // programmatic changes (select.value = ...) keep the label in step
    const vd = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(native, 'value', { configurable: true, get() { return vd.get.call(this); }, set(v) { vd.set.call(this, v); sync(); } });
    const sd = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
    Object.defineProperty(native, 'selectedIndex', { configurable: true, get() { return sd.get.call(this); }, set(v) { sd.set.call(this, v); sync(); } });
    native.addEventListener('change', sync);
    native.addEventListener('focus', () => btn.focus());
    sync();

    function open() {
      if (btn.disabled) return;
      if (selPop && selPop.btn === btn) { closeSelPop(true); return; }
      closeSelPop();
      const pop = document.createElement('div');
      pop.className = 'ax-sel__pop';
      pop.setAttribute('role', 'listbox');
      pop.innerHTML = opts().map((o, i) => `
        <button type="button" class="ax-sel__opt${i === native.selectedIndex ? ' is-on' : ''}" role="option" data-i="${i}" aria-selected="${i === native.selectedIndex}"${o.disabled ? ' disabled' : ''}>
          <span>${esc(o.textContent)}</span>${i === native.selectedIndex ? ico('check', 16) : ''}
        </button>`).join('');
      document.body.append(pop);
      const r = btn.getBoundingClientRect();
      const w = Math.max(r.width, 180);
      pop.style.minWidth = w + 'px';
      const h = Math.min(pop.scrollHeight, 320);
      pop.style.maxHeight = '320px';
      const below = innerHeight - r.bottom - 8, above = r.top - 8;
      const up = below < h && above > below;
      pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
      if (up) { pop.style.bottom = (innerHeight - r.top + 4) + 'px'; pop.classList.add('is-up'); }
      else pop.style.top = (r.bottom + 4) + 'px';
      wrap.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      const items = () => Array.from(pop.querySelectorAll('.ax-sel__opt:not([disabled])'));
      let act = pop.querySelector('.is-on') || items()[0];
      const mark = el => { if (!el) return; pop.querySelectorAll('.is-act').forEach(x => x.classList.remove('is-act')); act = el; el.classList.add('is-act'); el.scrollIntoView({ block: 'nearest' }); };
      mark(act);
      const choose = el => {
        const i = +el.dataset.i;
        const changed = native.selectedIndex !== i;
        native.selectedIndex = i;
        closeSelPop(true);
        if (changed) {
          native.dispatchEvent(new Event('input', { bubbles: true }));
          native.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      pop.addEventListener('click', e => { const o = e.target.closest('.ax-sel__opt'); if (o && !o.disabled) choose(o); });
      pop.addEventListener('pointermove', e => { const o = e.target.closest('.ax-sel__opt'); if (o && o !== act && !o.disabled) mark(o); });
      let typed = '', typedT = 0;
      const onKey = e => {
        const list = items(); const at = list.indexOf(act);
        if (e.key === 'ArrowDown') { e.preventDefault(); mark(list[Math.min(list.length - 1, at + 1)]); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); mark(list[Math.max(0, at - 1)]); }
        else if (e.key === 'Home') { e.preventDefault(); mark(list[0]); }
        else if (e.key === 'End') { e.preventDefault(); mark(list[list.length - 1]); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (act) choose(act); }
        else if (e.key === 'Escape') { e.preventDefault(); closeSelPop(true); }
        else if (e.key === 'Tab') { closeSelPop(); }
        else if (e.key.length === 1) {
          clearTimeout(typedT); typed += e.key.toLowerCase(); typedT = setTimeout(() => { typed = ''; }, 600);
          const hit = list.find(x => x.textContent.trim().toLowerCase().startsWith(typed));
          if (hit) mark(hit);
        }
      };
      btn.addEventListener('keydown', onKey);
      const onDown = e => { if (!pop.contains(e.target) && !btn.contains(e.target)) closeSelPop(); };
      const onScroll = e => { if (e && e.target && pop.contains(e.target)) return; closeSelPop(); };
      document.addEventListener('pointerdown', onDown, true);
      document.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onScroll);
      selPop = { wrap, btn, pop, onDown, onScroll, onKey };
    }
    btn.addEventListener('click', open);
    btn.addEventListener('keydown', e => {
      if (!selPop && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); open(); }
    });
  }

  function enhanceSelects(root) {
    (root || document).querySelectorAll('select.ax-select:not([data-ax-enh])').forEach(enhanceSelect);
  }
  let selQueued = false;
  new MutationObserver(() => {
    if (selQueued) return;
    selQueued = true;
    queueMicrotask(() => { selQueued = false; enhanceSelects(document); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  enhanceSelects(document);

  /* ---- chips for the active-filter bar ---- */
  function activeChips(items, onRemove, onClear) {
    if (!items.length) return '';
    return `
      <div class="ax-active" role="group" aria-label="Filtre active">
        <span class="ax-active__lbl">Filtre active</span>
        ${items.map((it, i) => `<button type="button" class="ax-chip-x" data-i="${i}">${esc(it.label)}${ico('x', 14)}</button>`).join('')}
        <button type="button" class="ax-link" data-clear>Șterge toate</button>
      </div>`;
  }
  function wireActiveChips(root, items, onRemove, onClear) {
    root.querySelectorAll('.ax-chip-x').forEach(b => b.addEventListener('click', () => onRemove(items[+b.dataset.i])));
    root.querySelector('[data-clear]')?.addEventListener('click', onClear);
  }

  /* ---- drawer (side sheet) ---- */
  function drawer({ title, sub, body, actions }) {
    document.querySelector('.ax-drawer')?.remove();
    const el = document.createElement('div');
    el.className = 'ax-drawer';
    el.innerHTML = `
      <div class="ax-drawer__scrim" data-close></div>
      <aside class="ax-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="axDrawerT">
        <header class="ax-drawer__head">
          <div>
            <h2 id="axDrawerT">${title}</h2>
            ${sub ? `<p>${sub}</p>` : ''}
          </div>
          <button type="button" class="ax-icon-btn" data-close aria-label="Închide">${ico('x', 18)}</button>
        </header>
        <div class="ax-drawer__body">${body}</div>
        ${actions ? `<footer class="ax-drawer__foot">${actions}</footer>` : ''}
      </aside>`;
    const prev = document.activeElement;
    const close = () => {
      el.classList.add('is-closing');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { el.remove(); prev && prev.focus && prev.focus(); }, 180);
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    document.addEventListener('keydown', onKey);
    document.body.appendChild(el);
    el.querySelector('.ax-drawer__panel [data-close]').focus();
    el.close = close;
    return el;
  }

  /* ---- toast ---- */
  function toast(msg, kind) {
    let host = document.querySelector('.ax-toasts');
    if (!host) { host = document.createElement('div'); host.className = 'ax-toasts'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'ax-toast' + (kind ? ' ax-toast--' + kind : '');
    t.innerHTML = msg;
    host.appendChild(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 250); }, 3200);
  }

  /* ---- CSV ---- */
  function downloadCSV(name, rows) {
    const csv = rows.map(r => r.map(v => {
      const s = String(v == null ? '' : v);
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  window.AdminViews = window.AdminViews || {};

  window.AdminUI = {
    esc, $, $$, nf, money, pct, hh, plural, daysLabel, ico,
    readQuery, writeQuery, listParam,
    multiSelect, enhanceSelects, activeChips, wireActiveChips, drawer, toast, downloadCSV
  };
})();
