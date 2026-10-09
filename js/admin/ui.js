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
    calculator: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
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
    'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    replace: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><path d="M10 6.5h4a3 3 0 0 1 3 3V14"/><path d="m14.5 11.5 2.5 2.5 2.5-2.5"/>',
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
      // inside a modal dialog (top layer) the list must live in the dialog, or it opens behind it
      (native.closest('dialog[open]') || document.body).append(pop);
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
      const openedAt = Date.now();
      const onScroll = e => { if (e && e.target && pop.contains(e.target)) return; if (Date.now() - openedAt < 300) return; if (e && e.target && e.target !== document && !e.target.contains(btn)) return; closeSelPop(); };
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


  /* ---- type-ahead list under a text field ----
     Shows every option when the field is focused and narrows it as you
     type ("D" lists the names that start with D, in the first or the last
     name). Picking one writes the full name into the field and fires
     'input', so the view's own filter handler runs unchanged. */
  const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function suggest(input, getOptions) {
    let pop = null, act = -1, items = [];
    const close = () => {
      if (!pop) return;
      const p = pop; pop = null; act = -1;
      p.classList.add('is-closing');
      setTimeout(() => p.remove(), 120);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('scroll', onScroll, true);
    };
    const onDown = e => { if (pop && !pop.contains(e.target) && e.target !== input) close(); };
    const place = () => {
      if (!pop) return;
      const r = input.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) { close(); return; }
      const w = Math.max(r.width, 220);
      pop.style.minWidth = w + 'px';
      pop.style.maxHeight = Math.max(160, Math.min(340, innerHeight - r.bottom - 16)) + 'px';
      pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
      pop.style.top = (r.bottom + 4) + 'px';
    };
    const onScroll = e => { if (pop && !pop.contains(e.target)) place(); };
    const filter = () => {
      const q = plain(input.value).trim();
      const all = getOptions();
      if (!q) return all;
      return all.filter(o => { const n = plain(o); return n.startsWith(q) || n.split(/\s+/).some(w => w.startsWith(q)); });
    };
    const mark = i => {
      if (!pop) return;
      pop.querySelectorAll('.is-act').forEach(x => x.classList.remove('is-act'));
      act = i;
      const el = pop.querySelector(`[data-i="${i}"]`);
      if (el) { el.classList.add('is-act'); el.scrollIntoView({ block: 'nearest' }); }
    };
    const pick = i => {
      input.value = items[i];
      input.dispatchEvent(new Event('input', { bubbles: true }));
      close();
    };
    const hl = (name, q) => {
      if (!q) return esc(name);
      const words = name.split(' ');
      let out = '', done = false;
      words.forEach((w, k) => {
        const hit = !done && plain(w).startsWith(q);
        if (hit) { out += `<b>${esc(w.slice(0, q.length))}</b>${esc(w.slice(q.length))}`; done = true; } else out += esc(w);
        if (k < words.length - 1) out += ' ';
      });
      return out;
    };
    function render() {
      items = filter();
      const q = plain(input.value).trim();
      if (!pop) {
        pop = document.createElement('div');
        pop.className = 'ax-sel__pop ax-sug';
        pop.setAttribute('role', 'listbox');
        pop.addEventListener('pointerdown', e => e.preventDefault()); // keep focus in the field
        pop.addEventListener('click', e => { const o = e.target.closest('[data-i]'); if (o) pick(+o.dataset.i); });
        // hover follows the pointer (not on scroll: only a real mouse move counts)
        pop.addEventListener('pointermove', e => {
          const o = e.target.closest('[data-i]');
          if (!o || +o.dataset.i === act) return;
          pop.querySelectorAll('.is-act').forEach(x => x.classList.remove('is-act'));
          act = +o.dataset.i; o.classList.add('is-act');
        });
        document.body.append(pop);
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('scroll', onScroll, true);
      }
      pop.innerHTML = items.length
        ? items.map((n, i) => `<button type="button" class="ax-sel__opt" role="option" data-i="${i}"><span>${hl(n, q)}</span></button>`).join('')
        : '<div class="ax-sug__none">Niciun profesor cu acest nume</div>';
      place();
      pop.classList.remove('is-closing');
      mark(items.length ? 0 : -1);
    }
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-autocomplete', 'list');
    input.addEventListener('focus', render);
    input.addEventListener('click', () => { if (!pop) render(); });
    input.addEventListener('input', render);
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!pop) render(); else mark(Math.min(items.length - 1, act + 1)); }
      else if (e.key === 'ArrowUp' && pop) { e.preventDefault(); mark(Math.max(0, act - 1)); }
      else if (e.key === 'Enter' && pop && act >= 0 && items[act]) { e.preventDefault(); pick(act); }
      else if (e.key === 'Escape' && pop) { e.stopPropagation(); close(); }
    });
  }

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
    // a slim bar runs down the toast's own lifetime; hovering pauses both
    let left = 3200, started = Date.now(), timer = 0;
    const out = () => { t.classList.add('is-out'); setTimeout(() => t.remove(), 250); };
    const arm = () => { started = Date.now(); timer = setTimeout(out, left); t.classList.remove('is-paused'); };
    t.style.setProperty('--ax-toast-ms', left + 'ms');
    t.addEventListener('mouseenter', () => { clearTimeout(timer); left -= Date.now() - started; t.classList.add('is-paused'); });
    t.addEventListener('mouseleave', arm);
    arm();
  }

  /* ---- long tables: the first rows paint at once, the rest follow a few per frame ----
     A page with 60 rows costs a few hundred ms of layout on a slow device; spreading it keeps
     the page answering (typing in a filter, switching tabs). Rows are only hidden, not removed. */
  function stagger(tbody, first, step) {
    if (!tbody || tbody.children.length <= first) return;
    const rest = Array.from(tbody.children).slice(first);
    rest.forEach(r => { r.hidden = true; });
    let i = 0;
    (function next() {
      if (!tbody.isConnected) return;
      const end = Math.min(rest.length, i + step);
      for (; i < end; i++) rest[i].hidden = false;
      if (i < rest.length) requestAnimationFrame(next);
    })();
  }

  /* ---- count-up: the figures of a page run up from 0 when it opens ----
     Only plain numbers in the Romanian format ("1.234", "2,8", "51%", "−801.052");
     anything else is left alone. Skipped with reduced motion. */
  function countUp(root) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const re = /^([−-]?)(\d{1,3}(?:\.\d{3})*|\d+)(,\d+)?(\s*%)?$/;
    const jobs = [];
    root.querySelectorAll('.ax-stat__v, .ah-tile__fig > b, .rp-sum__v, .an-stat__v, .cl-hero b[data-v], .rg-fig--k').forEach(el => {
      if (el.children.length || el.dataset.counted) return;
      const txt = el.textContent.trim();
      const m = re.exec(txt);
      if (m) jobs.push([el, txt, m]);
    });
    // one pass of reads (widths), then one pass of writes: no layout thrashing
    const widths = jobs.map(([el]) => el.getBoundingClientRect().width);
    jobs.forEach(([el, txt, m], idx) => {
      const sign = m[1], int = +m[2].replace(/\./g, ''), dec = m[3] || '', suffix = m[4] || '';
      const decimals = dec ? dec.length - 1 : 0, target = int + (dec ? +('0.' + dec.slice(1)) : 0);
      if (target === 0 || target > 1e7) return;
      el.dataset.counted = '1';
      const t0 = performance.now(), dur = Math.min(900, 380 + Math.log10(target + 1) * 120);
      const nfm = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      const fmt = v => sign + nfm.format(v) + suffix;
      el.style.minWidth = widths[idx] + 'px'; // the line never jitters while the digits change
      (function step(now) {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = k < 1 ? fmt(target * e) : txt;
        if (k < 1) requestAnimationFrame(step); else el.style.minWidth = '';
      })(t0);
    });
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

  /* A group with no cabinet: in an online project that is normal ("Online"); in an offline project the register simply has no cabinet for it ("Fără cabinet"). */
  const noRoom = g => { const p = window.AdminData.project(g.project); return p && p.mode === 'offline' ? { online: false, label: 'Fără cabinet', long: 'Fără cabinet în registru' } : { online: true, label: 'Online', long: 'Online, fără cabinet' }; };
  const roomPlate = (g, size) => { const n = noRoom(g); return n.online ? `<span class="or-room or-room--on${size ? ' or-room--sm' : ''}" title="Online">${ico('monitor', 16)}</span>` : `<span class="or-room or-room--none${size ? ' or-room--sm' : ''}" title="${n.long}">${ico('alert', 16)}</span>`; };

  window.AdminUI = {
    esc, $, $$, nf, money, pct, hh, plural, daysLabel, ico,
    readQuery, writeQuery, listParam, noRoom, roomPlate,
    multiSelect, enhanceSelects, suggest, countUp, stagger, activeChips, wireActiveChips, drawer, toast, downloadCSV
  };
})();
