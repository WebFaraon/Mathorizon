/* ============================================================
   Mathorizon: Registru (the teacher's register)
   ============================================================
   The spreadsheet every teacher keeps, rebuilt as a page: same sheets,
   same structure, same colours. Tabs along the top, like the sheet's tabs:

     Total achitări   all groups side by side: money earned, payments
                      received, group figures, students owing
     Disponibilitate  the week by hour (Disponibil / Ocupat / empty)
                      and what the teacher teaches, per grade
     <one tab per group>  students as columns, lessons as rows, presence,
                      balance, paid, discounts, cost of the lessons

   Read-only except the availability grid and the teaching table, which are
   edited here and written to the same store the admin console reads
   (AdminData.setAvailability / setTeach), so the console's Disponibilitate
   page shows them at once, also live across tabs.

   Data is the demo data of the console (js/admin/mock-data.js and
   js/admin/registru-data.js). Access: an approved teacher, or an admin.
   Routes: #total (default)  #disponibilitate  #grupa/<groupId>
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico } = U;
  const calm = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const fm = (n, d = 0) => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const sg = (n, d = 0) => (n < 0 ? '−' : '') + fm(Math.abs(n), d);
  const hh = h => String(h).padStart(2, '0') + ':00';
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const lastFirst = p => `${p.last} ${p.first}`;

  const SNAME = { activ: 'Activ', proba: 'Oră de probă', proba_ok: 'Probă confirmată', instabil: 'Instabil', inlocuire: 'Înlocuire', transferat: 'Transferat', inactiv: 'Inactiv' };
  const GNAME = { activ: 'Activ', completare: 'Se completează', inlocuire: 'Înlocuire', inactiv: 'Inactiv' };
  const GCOUNT = { activ: 'Active', completare: 'Se completează', inlocuire: 'Înlocuire', inactiv: 'Inactive' };
  const CODE = { P: ['PREZENT', 'p'], A: ['ABSENT', 'a'], M: ['ABSENT MOTIVAT', 'm'], G: ['PRIMA LECȚIE GRATUITĂ', 'g'] };
  const SHORT = { Matematica: 'Mat.', 'L.română': 'Rom.', Fizica: 'Fiz.', Istoria: 'Ist.', Chimie: 'Chim.', Biologie: 'Bio.', Engleza: 'Engl.', Geografie: 'Geo.' };
  const MONTH_HUE = [215, 195, 165, 125, 90, 52, 38, 26, 12, 345, 300, 255]; // Jan..Dec: June, July, August as in the sheet
  const H0 = 8, H1 = 21;                                                     // availability rows: 08:00 .. 20:00
  const HOURS = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
  const GRADES = D.GRADES;

  const S = { tid: null, role: null, auth: null, book: null, cur: '', compact: false };
  let view = null, tabsEl = null;

  /* ---------------- who is looking ---------------- */
  function resolveTeacher(auth) {
    const q = new URLSearchParams(location.search).get('t');
    if (q && D.teacher(q)) return q;
    try { const s = sessionStorage.getItem('bm_rg_teacher'); if (s && D.teacher(s)) return s; } catch (e) {}
    const nm = norm(auth && auth.displayName && auth.displayName());
    const hit = nm && D.teachers.find(t => norm(`${t.first} ${t.last}`) === nm || norm(lastFirst(t)) === nm);
    return (hit || D.teacher('t5') || D.teachers[0]).id;
  }
  const initials = name => { const p = String(name || '').trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); };

  /* ---------------- shell ---------------- */
  function shellHTML() {
    const admin = S.role === 'admin';
    const back = admin ? { href: 'admin.html#disponibilitate', label: 'Consola', icon: 'arrow-left' } : { href: 'profile.html', label: 'Profilul meu', icon: 'arrow-left' };
    return `
      <div class="rg" id="rg">
        <header class="rg-top">
          <a class="rg-brand" href="${back.href}" title="${back.label}">
            <img class="rg-brand__logo" src="assets/images/MathorizonLogo-mark.png" alt="" width="312" height="165">
            <span><b>MATHORIZON</b><small>Registru</small></span>
          </a>
          <div class="rg-who" id="rgWho"></div>
          <div class="rg-top__r">
            <label class="rg-demo" title="Datele sunt generate în browser. Modificările rămân doar pe acest dispozitiv.">
              <i aria-hidden="true"></i><b>Date demo</b>
              <select class="ax-select rg-demo__sel" id="rgTeacher" aria-label="Profesor (date demo)"></select>
            </label>
            <button type="button" class="ax-icon-btn rg-ibtn" id="rgTheme" aria-label="Schimbă tema">${ico(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon', 18)}</button>
            <a class="ax-btn rg-back" href="${back.href}">${ico(back.icon, 16)}<span>${back.label}</span></a>
          </div>
        </header>
        <nav class="rg-tabs" aria-label="Foile registrului"><div class="rg-tabs__in" id="rgTabs" role="tablist"></div></nav>
        <main class="rg-view" id="rgView" tabindex="-1"></main>
      </div>`;
  }

  function paintTop() {
    const t = D.teacher(S.tid);
    const n = D.groups.filter(g => g.teacher === t.id && g.status !== 'inactiv').length;
    document.getElementById('rgWho').innerHTML = `
      <span class="rg-who__av" aria-hidden="true">${esc(initials(lastFirst(t)))}</span>
      <span class="rg-who__t"><b>${esc(lastFirst(t))}</b><small>${esc(t.subjects.join(', '))} · nivelul ${D.tLevel(t.id)} · ${n} ${n === 1 ? 'grupă activă' : 'grupe active'}</small></span>`;
    const sel = document.getElementById('rgTeacher');
    sel.innerHTML = D.teachers.slice().sort((a, b) => a.name.localeCompare(b.name, 'ro')).map(x => {
      const c = D.groups.filter(g => g.teacher === x.id).length;
      return `<option value="${x.id}"${x.id === S.tid ? ' selected' : ''}>${esc(lastFirst(x))} (${c})</option>`;
    }).join('');
  }

  function tabsHTML() {
    const gs = D.groups.filter(g => g.teacher === S.tid).sort((a, b) => Math.min(...a.days) - Math.min(...b.days) || a.start - b.start || a.id.localeCompare(b.id));
    const tab = (r, label, extra = '') => `<button type="button" class="rg-tab${extra}" role="tab" data-r="${r}" aria-selected="false" tabindex="-1">${label}</button>`;
    return `
      ${tab('total', `${ico('chart-column', 16)}<span>Total achitări</span>`, ' rg-tab--main')}
      ${tab('disponibilitate', `${ico('clock', 16)}<span>Disponibilitate</span>`, ' rg-tab--main')}
      <i class="rg-tabs__sep" aria-hidden="true"></i>
      ${gs.map(g => {
        const L = D.ledger(g.id);
        return tab('grupa/' + g.id, `<i class="rg-tab__n" title="Elevi în registru">${L.rows.length}</i><span>${esc(D.tabName(g))}</span><em class="rg-tab__s rg-s-${g.status}" title="${esc(GNAME[g.status])}"></em>`, ' rg-tab--g');
      }).join('')}
      <i class="rg-tabs__bar" id="rgBar" aria-hidden="true"></i>`;
  }

  function moveBar(animate) {
    const bar = document.getElementById('rgBar');
    const on = tabsEl && tabsEl.querySelector('.rg-tab[aria-selected="true"]');
    if (!bar || !on) return;
    if (!animate || calm()) bar.style.transition = 'none';
    bar.style.width = on.offsetWidth + 'px';
    bar.style.transform = `translateX(${on.offsetLeft}px)`;
    if (!animate || calm()) { void bar.offsetWidth; bar.style.transition = ''; }
    // keep the active tab in view in the strip
    const sc = tabsEl, l = on.offsetLeft, r = l + on.offsetWidth;
    if (l < sc.scrollLeft + 8) sc.scrollTo({ left: Math.max(0, l - 16), behavior: calm() ? 'auto' : 'smooth' });
    else if (r > sc.scrollLeft + sc.clientWidth - 8) sc.scrollTo({ left: r - sc.clientWidth + 16, behavior: calm() ? 'auto' : 'smooth' });
  }

  /* ---------------- router ---------------- */
  function parseRoute() {
    const h = location.hash.replace(/^#/, '');
    if (h === 'disponibilitate') return { key: 'disponibilitate', name: 'disp' };
    const m = /^grupa\/(g\d+)$/.exec(h);
    if (m) { const g = D.group(m[1]); if (g && g.teacher === S.tid) return { key: h, name: 'grupa', gid: g.id }; }
    return { key: 'total', name: 'total' };
  }

  let leaveT = 0;
  function route(first) {
    const r = parseRoute();
    const changed = r.key !== S.cur;
    tabsEl.querySelectorAll('.rg-tab').forEach(b => { const on = b.dataset.r === r.key; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    moveBar(!first && changed);
    if (!changed && !first) { paint(r, false); return; }
    S.cur = r.key;
    clearTimeout(leaveT);
    if (first || calm()) { paint(r, true); return; }
    view.classList.add('is-leaving');
    leaveT = setTimeout(() => { view.classList.remove('is-leaving'); paint(r, true); }, 120);
  }

  function paint(r, entering) {
    closePop(); hideTip();
    const keepScroll = !entering ? (view.querySelector('.rg-board, .rg-av-page') || {}) : null;
    const sx = keepScroll ? keepScroll.scrollLeft : 0, sy = keepScroll ? keepScroll.scrollTop : 0;
    view.dataset.tab = r.name;
    view.innerHTML = '';
    try {
      if (r.name === 'disp') renderDisp(view);
      else if (r.name === 'grupa') renderGroup(view, r.gid);
      else renderTotal(view);
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="ax-empty"><b>Pagina nu s-a putut afișa.</b>${esc(e.message)}</div>`;
    }
    const sc = view.querySelector('.rg-board, .rg-av-page');
    if (sc && !entering) { sc.scrollLeft = sx; sc.scrollTop = sy; }
    if (entering) {
      view.classList.remove('is-entering'); void view.offsetWidth; view.classList.add('is-entering');
      if (sc) sc.scrollTo(0, 0);
      U.countUp(view);
    }
  }

  const repaint = () => paint(parseRoute(), false);

  /* ---------------- scroll shadows, hover cross, tooltip ---------------- */
  function wireBoard(board) {
    if (!board) return;
    let raf = 0;
    const sync = () => { raf = 0; board.classList.toggle('is-sx', board.scrollLeft > 2); board.classList.toggle('is-sy', board.scrollTop > 2); };
    board.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(sync); }, { passive: true });
    sync();
    // the hovered column lights up together with the row
    let col = null;
    const light = c => {
      if (c === col) return;
      board.querySelectorAll('.is-col').forEach(x => x.classList.remove('is-col'));
      col = c;
      if (c != null) board.querySelectorAll(`[data-c="${c}"]`).forEach(x => x.classList.add('is-col'));
    };
    board.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const el = e.target.closest('[data-c]'); light(el ? el.dataset.c : null); });
    board.addEventListener('pointerleave', () => light(null));
    // tooltips on presence marks
    board.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el && e.pointerType !== 'touch') showTip(el); });
    board.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tip]') === e.target.closest('[data-tip]'))) hideTip(); });
    board.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
    board.addEventListener('focusout', hideTip);
    board.addEventListener('scroll', hideTip, { passive: true });
  }

  let tipEl = null;
  function showTip(el) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'rg-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    const parts = el.dataset.tip.split('|');
    tipEl.innerHTML = `<b>${esc(parts[0])}</b>${parts.slice(1).map(p => `<span>${esc(p)}</span>`).join('')}`;
    tipEl.classList.add('is-on');
    const r = el.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
    if (y < 64) y = r.bottom + 8;
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    tipEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function hideTip() { if (tipEl) tipEl.classList.remove('is-on'); }

  let popEl = null;
  function openPop(anchor, html) {
    closePop();
    popEl = document.createElement('div');
    popEl.className = 'rg-pop';
    popEl.innerHTML = html;
    document.body.appendChild(popEl);
    const r = anchor.getBoundingClientRect(), w = popEl.offsetWidth, h = popEl.offsetHeight;
    let x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 8; if (y + h > innerHeight - 8) y = Math.max(64, r.top - h - 8);
    popEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    requestAnimationFrame(() => popEl && popEl.classList.add('is-on'));
    setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', onEsc); }, 0);
    return popEl;
  }
  const outside = e => { if (popEl && !popEl.contains(e.target)) closePop(); };
  const onEsc = e => { if (e.key === 'Escape') closePop(); };
  function closePop() {
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', onEsc);
    if (popEl) { const p = popEl; popEl = null; p.classList.remove('is-on'); setTimeout(() => p.remove(), 140); }
  }

  /* ============================================================
     Total achitări
     ============================================================ */
  const sizeLabel = n => (n === 1 ? 'Individual 1 elev' : `Grup cu ${n} elevi`);
  const sizeTone = n => (n >= 5 ? 'ok' : n >= 3 ? 'warn' : 'bad');
  const gradeTone = g => { const i = GRADES.indexOf(g); return i <= 3 ? 'lilac' : i <= 8 ? 'ok' : 'info'; };
  const subjLabel = g => g.subject + (g.regime === 'vara' ? ' (Vară)' : '');
  const succTone = (p, any) => (!any ? 'none' : p >= 90 ? 'ok' : p >= 50 ? 'info' : 'warn');
  const lines = arr => arr.map(x => `<span>${x}</span>`).join('');
  const mgrShort = m => { const p = m.name.split(' '); return `${p[p.length - 1]} ${p[0][0]}.`; };

  function monthsCell(months, kind) {
    if (!months.length) return '<span class="rg-none">-</span>';
    return months.map(m => {
      let inner;
      if (kind === 'state') inner = `<em class="p" title="Prezent">${m.P}</em><em class="a" title="Absent">${m.A}</em><em class="m" title="Absent motivat">${m.M}</em><em class="g" title="Prima lecție gratuită">${m.G}</em>`;
      else if (kind === 'rate') inner = `<b>${m.pct}%</b><u class="rg-bar" aria-hidden="true"><i style="width:${m.pct}%"></i></u>`;
      else if (kind === 'value') inner = `<b>${fm(m.value)}</b>`;
      else if (kind === 'hours') inner = `<b>${fm(m.hours)}</b>`;
      else {
        const ids = Object.keys(m.mgr).sort((a, b) => m.mgr[b] - m.mgr[a]);
        inner = ids.length ? `<span class="rg-m__l">${ids.map(id => `<span><u>${esc(mgrShort(D.manager(id)))}</u><b>${fm(m.mgr[id])}</b></span>`).join('')}</span>` : '<b>0</b>';
      }
      return `<span class="rg-m${kind === 'mgr' ? ' rg-m--col' : ''}"><i>${esc(m.name.slice(0, 3))}</i>${inner}</span>`;
    }).join('');
  }

  function ledgerHTML(B) {
    return `
      <aside class="rg-ledger" aria-label="Plăți primite">
        <div class="rg-ledger__h"><b>Plăți primite</b><span>${B.payments.length} ${B.payments.length === 1 ? 'plată' : 'plăți'}</span></div>
        <div class="rg-ledger__sc">
          <table>
            <thead><tr><th>Data</th><th>Suma</th></tr></thead>
            <tbody>${B.payments.length ? B.payments.slice().reverse().map((p, i) => `<tr style="--ri:${i}"><td>${esc(p.label)}</td><td>${fm(p.amount)}</td></tr>`).join('') : '<tr><td colspan="2" class="rg-none">Nicio plată încă</td></tr>'}</tbody>
          </table>
        </div>
        <div class="rg-ledger__f"><span>Suma achitată</span><b>${fm(B.paid, 2)}</b></div>
      </aside>`;
  }

  function sheetHTML(B) {
    const gs = B.groups, T = B.totals;
    let ri = 0;
    const cells = fn => gs.map((L, i) => {
      const r = fn(L, i), o = typeof r === 'string' ? { h: r } : r;
      return `<td class="rg-c${o.c ? ' ' + o.c : ''}" data-c="${i}">${o.h}</td>`;
    }).join('');
    const row = (cls, label, total, cs, tcls = '') => `
      <tr class="rg-r ${cls}" style="--ri:${ri++}"><th class="rg-lab" scope="row">${label}</th><td class="rg-tot ${tcls}">${total}</td>${cs}</tr>`;
    const blank = cells(() => '');
    const num = (get, d = 0, tone) => cells(L => { const v = get(L.stats, L); return { h: sg(v, d), c: tone ? tone(v) : '' }; });
    const totNum = (v, d = 0) => sg(v, d);
    const sold = v => (v > 0 ? 'is-good' : v < 0 ? 'is-bad' : '');
    const any = (L) => (L.stats.P + L.stats.A + L.stats.M) > 0;

    const distinct = (arr, key, fmt) => {
      const m = new Map(); arr.forEach(x => { const k = key(x); m.set(k, (m.get(k) || 0) + 1); });
      return Array.from(m.entries()).map(([k, n]) => fmt(k, n));
    };
    const live = gs.filter(L => L.g.status !== 'inactiv');
    const weekly = live.reduce((n, L) => n + L.g.days.length, 0);

    const head = `
      <tr class="rg-r rg-r--head" style="--ri:${ri++}">
        <th class="rg-lab" scope="row">Grupa</th>
        <td class="rg-tot rg-fig--k">${gs.length}</td>
        ${gs.map((L, i) => `<th class="rg-c rg-gh" data-c="${i}" scope="col"><button type="button" class="rg-gl" data-go="${L.g.id}" title="Deschide foaia grupei"><span>${esc(D.tabName(L.g))}</span>${ico('arrow-right', 14)}</button></th>`).join('')}
      </tr>`;

    return `
      <table class="rg-sheet" id="rgSheet" style="--cols:${gs.length}">
        <colgroup><col class="rg-col-lab"><col class="rg-col-tot">${gs.map(() => '<col class="rg-col-g">').join('')}</colgroup>
        <tbody>
          ${row('rg-r--orange', 'Salariu spre achitare', sg(B.due, 2), blank, 'rg-fig--k is-gold')}
          ${row('rg-r--orange', 'Suma achitată', fm(B.paid, 2), blank, 'rg-fig--k rg-tot--w')}
          ${row('rg-r--band', 'Suma pentru toate lecțiile', fm(B.earned, 2), cells(L => ({ h: fm(L.earned, 2), c: 'rg-b' })), 'rg-fig--k')}
          ${head}
          ${row('rg-r--tall', 'Orarul', `<span class="rg-sm">${weekly} ${weekly === 1 ? 'lecție' : 'lecții'} pe săptămână</span>`,
            cells(L => ({ h: lines(D.schedule(L.g).map(x => `${esc(x.day)} ${hh(x.hour).slice(0, 5)} ${x.room ? 'cab ' + x.room : 'online'}`)), c: 'rg-sched' })))}
          ${row('', 'Formatul grupului', `<span class="rg-sm rg-lines">${lines(distinct(gs, L => L.g.size, (k, n) => `${k === 1 ? 'Individual' : 'Grup cu ' + k}: ${n}`))}</span>`,
            cells(L => ({ h: sizeLabel(L.g.size), c: 'rg-tone rg-tone--' + sizeTone(L.g.size) })))}
          ${row('', 'Starea grupului', `<span class="rg-sm rg-lines">${lines(['activ', 'completare', 'inlocuire', 'inactiv'].map(k => `${GCOUNT[k]}: ${gs.filter(L => L.g.status === k).length}`))}</span>`,
            cells(L => ({ h: `<span class="rg-dot rg-s-${L.g.status}"></span>${esc(GNAME[L.g.status])}`, c: 'rg-tone rg-tone--st-' + L.g.status })))}
          ${row('', 'Materia', `<span class="rg-sm rg-lines">${lines(distinct(gs, L => L.g.subject, (k, n) => `${esc(k)}: ${n}`))}</span>`, cells(L => ({ h: esc(subjLabel(L.g)), c: 'rg-cream' })))}
          ${row('', 'Clasa', `<span class="rg-sm rg-lines">${lines(distinct(gs.slice().sort((a, b) => GRADES.indexOf(a.g.grade) - GRADES.indexOf(b.g.grade)), L => L.g.grade, (k, n) => `${k}: ${n}`))}</span>`,
            cells(L => ({ h: esc(L.g.grade), c: 'rg-tone rg-tone--' + gradeTone(L.g.grade) })))}
          ${row('', 'Nivelul de studiu', '', cells(L => ({ h: esc(L.g.level), c: 'rg-cream' })))}
          ${row('', 'Profilul', '', cells(L => (L.g.profile ? { h: esc(L.g.profile), c: 'rg-tone rg-tone--' + (L.g.profile === 'Real' ? 'pink' : 'lilac') } : { h: '<span class="rg-none">-</span>', c: 'rg-cream' })))}
          ${row('', 'Elevi activi', totNum(T.active), num(s => s.active), 'rg-fig--k')}
          ${row('', 'Elevi cu statut oră de probă', totNum(T.trial), num(s => s.trial), 'rg-fig--k')}
          ${row('', 'Elevi transferați', totNum(T.moved), num(s => s.moved), 'rg-fig--k')}
          ${row('', 'Elevi inactivi', totNum(T.inactive), num(s => s.inactive), 'rg-fig--k')}
          ${row('', 'Ore predate', totNum(T.hours), num(s => s.hours), 'rg-fig--k')}
          ${row('', 'Media elevilor pe lecție', fm(T.avg, 2), num(s => s.avg, 2))}
          ${row('', 'Succesul prezențelor', `${T.success}%`, cells(L => ({ h: any(L) ? L.stats.success + '%' : '<span class="rg-none">-</span>', c: 'rg-tone rg-tone--s-' + succTone(L.stats.success, any(L)) })), 'rg-fig--k')}
          ${row('', 'Elevi prezenți', totNum(T.P), num(s => s.P), 'rg-fig--k')}
          ${row('', 'Elevi la prima lecție gratuită', totNum(T.G), num(s => s.G), 'rg-fig--k')}
          ${row('', 'Elevi absenți', totNum(T.absent), num(s => s.absent), 'rg-fig--k')}
          ${row('', 'Plăți efectuate', totNum(T.paid), num(s => s.paid), 'rg-fig--k')}
          ${row('', 'Consumul orelor', totNum(T.cost), num(s => s.cost), 'rg-fig--k')}
          ${row('', 'Reduceri pentru elevi', totNum(T.disc), num(s => s.disc), 'rg-fig--k')}
          ${row('', 'Datorii elevi', totNum(T.debt), cells(L => ({ h: sg(L.stats.debt), c: L.stats.debt < 0 ? 'rg-tone rg-tone--bad2' : '' })), 'rg-fig--k' + (T.debt < 0 ? ' is-bad' : ''))}
          ${row('', 'Avansuri elevi', totNum(T.adv), cells(L => ({ h: sg(L.stats.adv), c: L.stats.adv > 0 ? 'rg-tone rg-tone--good2' : '' })), 'rg-fig--k' + (T.adv > 0 ? ' is-good' : ''))}
          ${row('', 'Sold elevi', totNum(T.sold), cells(L => ({ h: sg(L.stats.sold), c: L.stats.sold > 0 ? 'rg-tone rg-tone--good2' : L.stats.sold < 0 ? 'rg-tone rg-tone--bad2' : '' })), 'rg-fig--k ' + sold(T.sold))}
          ${row('rg-r--tall rg-r--top', 'Starea elevului la oră<span class="rg-key"><em class="p">prezent</em><em class="a">absent</em><em class="m">motivat</em><em class="g">gratuit</em></span>', `<span class="rg-ms">${monthsCell(B.months, 'state')}</span>`, cells(L => ({ h: `<span class="rg-ms">${monthsCell(L.months, 'state')}</span>`, c: 'rg-ml' })))}
          ${row('rg-r--tall rg-r--top', 'Randament grupă', `<span class="rg-ms">${monthsCell(B.months, 'rate')}</span>`, cells(L => ({ h: `<span class="rg-ms">${monthsCell(L.months, 'rate')}</span>`, c: 'rg-ml' })))}
          ${row('rg-r--tall rg-r--top', 'Valoarea orelor consumate lunar', `<span class="rg-ms">${monthsCell(B.months, 'value')}</span>`, cells(L => ({ h: `<span class="rg-ms">${monthsCell(L.months, 'value')}</span>`, c: 'rg-ml' })))}
          ${row('rg-r--tall rg-r--top', 'Ore predate lunar', `<span class="rg-ms">${monthsCell(B.months, 'hours')}</span>`, cells(L => ({ h: `<span class="rg-ms">${monthsCell(L.months, 'hours')}</span>`, c: 'rg-ml' })))}
          ${row('rg-r--tall rg-r--top', 'Cost lunar ore consumate manager', `<span class="rg-ms">${monthsCell(B.months, 'mgr')}</span>`, cells(L => ({ h: `<span class="rg-ms">${monthsCell(L.months, 'mgr')}</span>`, c: 'rg-ml' })))}
        </tbody>
      </table>`;
  }

  function renderTotal(v) {
    const B = D.teacherBook(S.tid);
    S.book = B;
    if (!B.groups.length) {
      v.innerHTML = `<div class="rg-total rg-total--solo">${ledgerHTML(B)}<div class="ax-empty"><b>Nicio grupă încă.</b>Când primești prima grupă, apare aici ca o coloană, cu orarul, elevii și banii ei.</div></div>`;
      return;
    }
    v.innerHTML = `<div class="rg-total">${ledgerHTML(B)}<div class="rg-board" id="rgBoard" tabindex="0" aria-label="Total achitări, toate grupele">${sheetHTML(B)}</div></div>`;
    const board = v.querySelector('#rgBoard');
    wireBoard(board);
    const led = v.querySelector('.rg-ledger');
    led.querySelector('.rg-ledger__h').addEventListener('click', () => led.classList.toggle('is-open'));
    board.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) location.hash = 'grupa/' + b.dataset.go; });
  }

  /* ============================================================
     One group
     ============================================================ */
  function nextLessons(g, n) {
    if (g.status === 'inactiv') return [];
    const out = [];
    const d = new Date(D.today);
    for (let i = 0; i < 28 && out.length < n; i++) {
      d.setDate(d.getDate() + (i === 0 ? 0 : 1));
      const wd = ((d.getDay() + 6) % 7) + 1;
      if (g.days.includes(wd)) out.push({ label: `${d.getDate()} ${D.MONTHS[d.getMonth()]}`, month: d.getMonth(), today: i === 0 });
    }
    return out;
  }

  function groupHTML(L) {
    const g = L.g, t = D.teacher(g.teacher);
    const free = Math.max(0, g.size - D.enrolled(g).length);
    const nStu = L.rows.length;
    const cols = nStu + free;
    const sched = D.schedule(g);
    const up = nextLessons(g, 2);
    const each = fn => L.rows.map((x, i) => fn(x, i)).join('');
    const emptyCols = (fn) => Array.from({ length: free }, (_, k) => fn(nStu + k)).join('');
    const xcol = (a, b, c) => `<td class="rg-gap"></td>${a}${b}${c}`;
    const st = L.stats;
    const pill = (txt, cls) => `<span class="rg-pillsel ${cls || ''}">${txt}<i>${ico('chevron-down', 14)}</i></span>`;

    const tone = { activ: 'ok', proba: 'info', proba_ok: 'info', instabil: 'warn', inlocuire: 'lilac', transferat: 'grey', inactiv: 'bad' };

    const rows = [];
    // 1 names
    rows.push(`<tr class="rg-hr" data-hr="1">
      <th class="rg-a rg-pillcell">${pill(`<span class="rg-long">${esc(sizeLabel(g.size))}</span><span class="rg-short">${g.size === 1 ? 'Individual' : g.size + ' elevi'}</span>`, 'rg-tone--' + sizeTone(g.size))}</th>
      <th class="rg-b rg-hl-lab" colspan="2">DATELE ELEVULUI</th>
      ${each((x, i) => `<th class="rg-sc rg-sname" data-c="${i}" scope="col"><button type="button" class="rg-sn" data-s="${x.s.id}"><b>${esc(lastFirst(x.s))}</b><small>${esc(x.s.phone)}</small></button></th>`)}
      ${emptyCols(i => `<th class="rg-sc rg-sname is-free" data-c="${i}" scope="col"><span class="rg-sn"><b>Loc liber</b><small>în grupă</small></span></th>`)}
      ${xcol('<th class="rg-xh">Ziua</th>', '<th class="rg-xh">Ora</th>', '<th class="rg-xh">Cabinetul</th>')}
    </tr>`);
    const fin = (n, cls, lab, pillHTML, get, getFree) => {
      const sx = [null, null, null, null, null, null];
      const idx = n - 2; // schedule entry shown in this header row
      const s = sched[idx];
      rows.push(`<tr class="rg-hr rg-hr--fin" data-hr="${n}">
        <th class="rg-a rg-pillcell">${pillHTML}</th>
        <th class="rg-b rg-hl-lab rg-hl--${cls}" colspan="2">${lab}</th>
        ${each((x, i) => `<td class="rg-sc rg-fin rg-fin--${cls}${get(x).c ? ' ' + get(x).c : ''}" data-c="${i}">${get(x).h}</td>`)}
        ${emptyCols(i => `<td class="rg-sc rg-fin rg-fin--${cls} is-free" data-c="${i}">${getFree}</td>`)}
        ${xcol(s ? `<td class="rg-xc">${esc(s.day)}</td>` : '<td class="rg-xc is-blank"></td>', s ? `<td class="rg-xc">${hh(s.hour).slice(0, 5)}</td>` : '<td class="rg-xc is-blank"></td>', s ? `<td class="rg-xc">${s.room ? s.room : 'online'}</td>` : '<td class="rg-xc is-blank"></td>')}
      </tr>`);
    };
    fin(2, 'sold', 'SOLD', `<span class="rg-rate"><span class="rg-long">${fm(L.rate)} MDL/Oră</span><span class="rg-short">${fm(L.rate)}/oră</span></span>`,
      x => ({ h: sg(x.sold, 0), c: x.sold > 0 ? 'is-good' : x.sold < 0 ? 'is-bad' : '' }), '0');
    fin(3, 'paid', 'ACHITĂRI', pill(esc(GNAME[g.status]), 'rg-tone--st-' + g.status), x => ({ h: fm(x.paid) }), '0');
    fin(4, 'disc', 'REDUCERI', pill(`<span class="rg-long">${esc(subjLabel(g))}</span><span class="rg-short">${esc(SHORT[g.subject] || g.subject)}${g.regime === 'vara' ? ' V' : ''}</span>`, 'rg-cream'), x => ({ h: fm(x.disc) }), '0');
    fin(5, 'cost', 'COSTUL LECȚIILOR', pill(esc(g.grade), 'rg-tone--' + gradeTone(g.grade)), x => ({ h: fm(x.cost) }), '0');
    fin(6, 'done', 'EFECTUATE / DISPONIBILE', pill(esc(g.level), 'rg-cream'), x => ({ h: `${x.done} / ${fm(x.avail, 1)}`, c: x.avail < 0 ? 'is-bad-t' : '' }), '0 / 0,0');
    fin(7, 'mgr', 'MANAGER', pill(esc(g.profile || 'Profilul'), g.profile ? 'rg-tone--' + (g.profile === 'Real' ? 'pink' : 'lilac') : 'rg-cream'), x => ({ h: x.manager ? esc(lastFirst({ first: x.manager.name.split(' ')[0], last: x.manager.name.split(' ').slice(1).join(' ') })) : '' }), '');
    // 8 status + column heads
    rows.push(`<tr class="rg-hr rg-hr--last" data-hr="8">
      <th class="rg-a rg-colh">DATA</th>
      <th class="rg-b rg-colh">TEMA</th>
      <th class="rg-cc rg-colh rg-sumh" title="Suma lecțiilor">${fm(L.sum)}</th>
      ${each((x, i) => `<td class="rg-sc rg-stat rg-stat--${tone[x.s.status] || 'grey'}" data-c="${i}">${esc(SNAME[x.s.status] || x.s.status)}</td>`)}
      ${emptyCols(i => `<td class="rg-sc rg-stat rg-stat--free is-free" data-c="${i}">Liber</td>`)}
      ${xcol('<th class="rg-colh rg-xlh">NIVELUL PROFESORULUI</th>', '<th class="rg-colh rg-xlh">PREZENȚA</th>', '<th class="rg-colh rg-xlh"></th>')}
    </tr>`);

    const body = [];
    L.lessons.forEach((l, li) => {
      body.push(`<tr class="rg-lr" style="--ri:${Math.min(li, 18)}">
        <th class="rg-a rg-ld" style="--mh:${MONTH_HUE[l.date.getMonth()]}" scope="row"><span class="rg-long">${esc(l.label)}</span><span class="rg-short">${l.date.getDate()} ${esc(D.MONTHS[l.date.getMonth()].slice(0, 3))}</span></th>
        <td class="rg-b rg-lt" title="${esc(l.topic)}">${esc(l.topic)}</td>
        <td class="rg-cc rg-lp">${fm(l.price)}</td>
        ${each((x, i) => {
          const c = x.codes[li], info = c ? CODE[c] : null;
          const tip = info ? `${lastFirst(x.s)}|${l.label}, ${l.topic}|${info[0]}${c === 'P' || c === 'A' ? ', ' + fm(l.price) + ' lei' : ', fără cost'}${x.flag === li ? '|Aici a depășit suma plătită' : ''}` : '';
          return `<td class="rg-sc rg-pc" data-c="${i}">${info
            ? `<span class="rg-pl rg-pl--${info[1]}${x.flag === li ? ' is-flag' : ''}" tabindex="0" data-tip="${esc(tip)}">${info[0]}</span>`
            : '<span class="rg-pl rg-pl--e"></span>'}</td>`;
        })}
        ${emptyCols(i => `<td class="rg-sc rg-pc is-free" data-c="${i}"><span class="rg-pl rg-pl--e"></span></td>`)}
        ${xcol(`<td class="rg-xc"><span class="rg-lvl">Nivelul profesorului ${L.level}</span></td>`, `<td class="rg-xc rg-xp${l.pct == null ? '' : l.pct >= 80 ? ' is-ok' : l.pct < 50 ? ' is-low' : ''}">${l.pct == null ? '' : l.pct + '%'}</td>`, '<td class="rg-xc is-blank"></td>')}
      </tr>`);
    });
    up.forEach((u, k) => {
      body.push(`<tr class="rg-lr rg-lr--next" style="--ri:${Math.min(L.lessons.length + k, 20)}">
        <th class="rg-a rg-ld" style="--mh:${MONTH_HUE[u.month]}" scope="row"><span class="rg-long">${esc(u.label)}</span><span class="rg-short">${esc(u.label.split(' ')[0])} ${esc(u.label.split(' ')[1].slice(0, 3))}</span></th>
        <td class="rg-b rg-lt"><em>${u.today ? 'Astăzi' : k === 0 ? 'Urmează' : 'Apoi'}</em></td>
        <td class="rg-cc rg-lp"></td>
        ${Array.from({ length: cols }, (_, i) => `<td class="rg-sc rg-pc" data-c="${i}"><span class="rg-pl rg-pl--e"></span></td>`).join('')}
        ${xcol('<td class="rg-xc is-blank"></td>', '<td class="rg-xc is-blank"></td>', '<td class="rg-xc is-blank"></td>')}
      </tr>`);
    });
    if (!L.lessons.length && !up.length) body.push(`<tr class="rg-lr"><td colspan="${6 + cols}" class="rg-empty-row">Nicio lecție ținută încă. Prima lecție apare aici după ce grupa începe.</td></tr>`);

    return `
      <div class="rg-group">
      <div class="rg-gbar">
        <div class="rg-gbar__t">
          <h2>${esc(D.tabName(g))}</h2>
          <p><span class="rg-dot rg-s-${g.status}"></span>${esc(GNAME[g.status])}<i>·</i>${esc(subjLabel(g))} ${esc(g.grade)}<i>·</i>${L.lessons.length} ${L.lessons.length === 1 ? 'lecție' : 'lecții'}<i>·</i>${nStu} ${nStu === 1 ? 'elev' : 'elevi'}<i>·</i>${esc(D.project(g.project).short)}</p>
        </div>
        <div class="rg-gbar__k">
          <span class="rg-gstat"><small>Sold grupă</small><b class="${st.sold < 0 ? 'is-bad' : st.sold > 0 ? 'is-good' : ''}">${sg(st.sold)}</b></span>
          <span class="rg-gstat"><small>Prezențe</small><b>${L.lessons.length ? st.success + '%' : '-'}</b></span>
          <span class="rg-gstat rg-gstat--sal"><small>Câștigat</small><b>${fm(L.earned, 2)}</b></span>
          <button type="button" class="rg-fold" id="rgFold" aria-pressed="${S.compact}" title="Ascunde sau arată cifrele elevilor">${ico('list', 16)}<span>Sumar</span></button>
        </div>
      </div>
      <div class="rg-board rg-gboard" id="rgBoard" tabindex="0" aria-label="Foaia grupei ${esc(D.tabName(g))}">
        <table class="rg-gsheet${S.compact ? ' is-compact' : ''}" style="--scols:${cols}">
          <colgroup><col class="rg-col-a"><col class="rg-col-b"><col class="rg-col-c">${Array.from({ length: cols }, () => '<col class="rg-col-s">').join('')}<col class="rg-col-gap"><col class="rg-col-x1"><col class="rg-col-x2"><col class="rg-col-x3"></colgroup>
          <thead>${rows.join('')}</thead>
          <tbody>${body.join('')}</tbody>
        </table>
      </div>
      <footer class="rg-legend" aria-label="Legendă">
        <span><i class="rg-pl rg-pl--p"></i>Prezent</span><span><i class="rg-pl rg-pl--a"></i>Absent</span><span><i class="rg-pl rg-pl--m"></i>Absent motivat</span><span><i class="rg-pl rg-pl--g"></i>Prima lecție gratuită</span>
        <span><i class="rg-pl rg-pl--p is-flag"></i>Aici elevul a depășit suma plătită</span><span class="rg-legend__n">Sold = achitări + reduceri − costul lecțiilor. Absența nemotivată se plătește.</span>
      </footer>
      </div>`;
  }

  function studentDrawer(L, sid) {
    const x = L.rows.find(r => r.s.id === sid);
    if (!x) return;
    const s = x.s;
    const recent = x.codes.map((c, i) => [c, i]).filter(p => p[0]).slice(-8);
    U.drawer({
      title: esc(lastFirst(s)),
      sub: `${esc(D.tabName(L.g))} · ${esc(SNAME[s.status])}`,
      body: `
        <dl class="ax-dl">
          <dt>Telefon</dt><dd><a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></dd>
          <dt>Manager</dt><dd>${x.manager ? esc(lastFirst({ first: x.manager.name.split(' ')[0], last: x.manager.name.split(' ').slice(1).join(' ') })) : '-'}</dd>
          <dt>În grupă din</dt><dd>${esc(new Date(s.joinedAt + 'T00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }))}</dd>
          <dt>Achitări</dt><dd>${fm(x.paid)} lei</dd>
          <dt>Reduceri</dt><dd>${fm(x.disc)} lei</dd>
          <dt>Costul lecțiilor</dt><dd>${fm(x.cost)} lei</dd>
          <dt>Sold</dt><dd><b class="${x.sold < 0 ? 'rg-neg' : x.sold > 0 ? 'rg-pos' : ''}">${sg(x.sold)} lei</b></dd>
          <dt>Lecții efectuate</dt><dd>${x.done}, mai are plătite ${fm(Math.max(0, x.avail), 1)}</dd>
        </dl>
        <h3 class="rg-dr-h">Ultimele lecții</h3>
        <ul class="rg-dr-l">${recent.length ? recent.reverse().map(([c, i]) => `<li><span class="rg-pl rg-pl--${CODE[c][1]}">${CODE[c][0]}</span><span><b>${esc(L.lessons[i].label)}</b><small>${esc(L.lessons[i].topic)}</small></span></li>`).join('') : '<li class="rg-none">Nicio lecție încă.</li>'}</ul>`,
      actions: S.role === 'admin' ? `<a class="ax-btn ax-btn--primary" href="admin.html#elevi?q=${encodeURIComponent(s.last)}">Vezi în consolă ${ico('arrow-right', 16)}</a>` : ''
    });
  }

  function renderGroup(v, gid) {
    const L = D.ledger(gid);
    v.innerHTML = groupHTML(L);
    const board = v.querySelector('#rgBoard');
    wireBoard(board);
    v.querySelector('#rgFold').addEventListener('click', e => {
      S.compact = !S.compact;
      e.currentTarget.setAttribute('aria-pressed', String(S.compact));
      try { localStorage.setItem('bm_rg_compact', S.compact ? '1' : '0'); } catch (err) {}
      board.querySelector('.rg-gsheet').classList.toggle('is-compact', S.compact);
      board.scrollTop = 0;
    });
    board.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) studentDrawer(L, b.dataset.s); });
  }

  /* ============================================================
     Disponibilitate
     ============================================================ */
  let A = null; // { t, on: {day: Set(hour)}, busy: {day: Map(hour -> group)} }
  let selfWrite = false;

  function busyMap(t) {
    const m = {};
    D.DAYS.forEach(d => { m[d.id] = new Map(); });
    D.groups.filter(g => g.teacher === t.id && g.status !== 'inactiv').forEach(g => g.days.forEach(d => { for (let h = g.start; h < g.start + g.duration; h++) m[d].set(h, g); }));
    return m;
  }
  function onSets(t, busy) {
    const o = {};
    D.DAYS.forEach(d => {
      const s = new Set();
      (t.availability[d.id] || []).forEach(([a, b]) => { for (let h = a; h < b; h++) s.add(h); });
      o[d.id] = s;
    });
    return o;
  }
  function toWindows(set) {
    const hs = Array.from(set).filter(h => h >= H0 && h < H1).sort((a, b) => a - b);
    const out = [];
    hs.forEach(h => { const l = out[out.length - 1]; if (l && l[1] === h) l[1] = h + 1; else out.push([h, h + 1]); });
    return out;
  }
  const outsideOf = (d, h) => A.busy[d].has(h) && !A.on[d].has(h);

  function cellHTML(d, h, first) {
    const g = A.busy[d].get(h);
    const dn = D.DAYS[d - 1].name;
    if (g) {
      const out = outsideOf(d, h);
      const lab = `${dn} ${hh(h)}, ocupat: ${g.subject} ${g.grade}${out ? ', în afara disponibilității' : ''}`;
      return `<button type="button" class="rg-av is-busy${out ? ' is-out' : ''}" data-d="${d}" data-h="${h}" tabindex="-1" aria-label="${esc(lab)}"><span>Ocupat</span><small>${esc(SHORT[g.subject] || g.subject)} ${esc(g.grade)}</small>${out ? '<em aria-hidden="true">!</em>' : ''}</button>`;
    }
    const on = A.on[d].has(h);
    return `<button type="button" class="rg-av${on ? ' is-on' : ''}" data-d="${d}" data-h="${h}" tabindex="${first ? 0 : -1}" aria-pressed="${on}" aria-label="${esc(dn + ' ' + hh(h))}"><span>${on ? 'Disponibil' : ''}</span></button>`;
  }

  function gridHTML() {
    return `
      <table class="rg-av-grid" role="grid" aria-label="Disponibilitatea săptămânală">
        <thead><tr><th class="rg-av-corner">Orar</th>${D.DAYS.map(d => `<th class="rg-av-day" scope="col"><button type="button" data-day="${d.id}" title="${esc(d.name)}: toată ziua"><span class="rg-av-day__f">${esc(d.name)}</span><span class="rg-av-day__s">${esc(d.short)}</span></button></th>`).join('')}</tr></thead>
        <tbody>${HOURS.map((h, ri) => `<tr><th class="rg-av-hour" scope="row"><button type="button" data-hr="${h}" title="Ora ${hh(h)} în toate zilele">${hh(h).slice(0, 5)}</button></th>${D.DAYS.map((d, ci) => `<td style="--w:${ri + ci}">${cellHTML(d.id, h, ri === 0 && ci === 0)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
  }

  function countHours() {
    let avail = 0, busy = 0, free = 0;
    D.DAYS.forEach(d => {
      avail += A.on[d.id].size;
      busy += A.busy[d.id].size;
      A.on[d.id].forEach(h => { if (!A.busy[d.id].has(h)) free++; });
    });
    return { avail, busy, free };
  }
  function updateStats() {
    const c = countHours();
    [['avail', c.avail], ['busy', c.busy], ['free', c.free]].forEach(([k, n]) => {
      const el = view.querySelector(`[data-stat="${k}"]`);
      if (el && el.textContent !== String(n)) { el.textContent = n; el.classList.remove('is-tick'); void el.offsetWidth; el.classList.add('is-tick'); }
    });
  }

  function setCell(btn, on) {
    const d = +btn.dataset.d, h = +btn.dataset.h;
    if (A.busy[d].has(h)) return false;
    if (A.on[d].has(h) === on) return false;
    if (on) A.on[d].add(h); else A.on[d].delete(h);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.firstElementChild.textContent = on ? 'Disponibil' : '';
    btn.classList.remove('is-pop'); void btn.offsetWidth; btn.classList.add('is-pop');
    return true;
  }

  function commit(note) {
    const o = {};
    D.DAYS.forEach(d => { o[d.id] = toWindows(A.on[d.id]); });
    selfWrite = true;
    try { D.setAvailability(S.tid, o); } finally { selfWrite = false; }
    updateStats();
    const chip = view.querySelector('#rgSave');
    if (chip) {
      chip.classList.remove('is-on'); void chip.offsetWidth; chip.classList.add('is-on');
      chip.querySelector('span').textContent = note || 'Salvat, se vede în consolă';
    }
    const rs = view.querySelector('#rgReset');
    if (rs) rs.hidden = !D.teacherEdited(S.tid);
  }

  function snapshot() { const o = {}; D.DAYS.forEach(d => { o[d.id] = Array.from(A.on[d.id]); }); return o; }
  function restore(o) { D.DAYS.forEach(d => { A.on[d.id] = new Set(o[d.id]); }); selfWrite = true; try { commit('Anulat'); } finally { selfWrite = false; } syncGrid(true); }
  function syncGrid(wave) {
    view.querySelectorAll('.rg-av').forEach(b => {
      const d = +b.dataset.d, h = +b.dataset.h;
      if (A.busy[d].has(h)) { b.classList.toggle('is-out', outsideOf(d, h)); const em = b.querySelector('em'); if (outsideOf(d, h) && !em) b.insertAdjacentHTML('beforeend', '<em aria-hidden="true">!</em>'); else if (!outsideOf(d, h) && em) em.remove(); return; }
      const on = A.on[d].has(h);
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); b.firstElementChild.textContent = on ? 'Disponibil' : '';
    });
    updateStats();
  }
  function undoToast(msg, prev) {
    U.toast(`${msg} <button type="button" class="rg-undo">Anulează</button>`);
    const t = document.querySelector('.ax-toasts .ax-toast:last-child .rg-undo');
    if (t) t.addEventListener('click', () => { restore(prev); t.closest('.ax-toast').classList.add('is-out'); });
  }

  function bulk(cells, label) {
    const free = cells.filter(b => !A.busy[+b.dataset.d].has(+b.dataset.h));
    if (!free.length) return;
    const allOn = free.every(b => A.on[+b.dataset.d].has(+b.dataset.h));
    const prev = snapshot();
    free.forEach((b, i) => {
      const go = () => setCell(b, !allOn);
      if (calm()) go(); else setTimeout(go, i * 14);
    });
    // the lessons the teacher already has stay inside the programme
    D.DAYS.forEach(d => A.busy[d.id].forEach((g, h) => { A.on[d.id].add(h); }));
    setTimeout(() => { syncGrid(); commit(); undoToast(`${label}: ${allOn ? 'scos din program' : 'adăugat în program'}.`, prev); }, calm() ? 0 : free.length * 14 + 30);
  }

  function wireGrid(root) {
    const grid = root.querySelector('.rg-av-grid');
    let drag = null;
    grid.addEventListener('pointerdown', e => {
      const b = e.target.closest('.rg-av');
      if (!b || e.button > 0) return;
      const d = +b.dataset.d, h = +b.dataset.h;
      if (A.busy[d].has(h)) { openBusy(b, d, h); return; }
      closePop();
      const on = !A.on[d].has(h);
      drag = { on, changed: setCell(b, on), mouse: e.pointerType !== 'touch', prev: snapshot() };
      b.focus({ preventScroll: true });
      e.preventDefault();
    });
    grid.addEventListener('pointerover', e => {
      if (!drag || !drag.mouse) return;
      const b = e.target.closest('.rg-av');
      if (b && !b.classList.contains('is-busy') && setCell(b, drag.on)) drag.changed = true;
    });
    const end = () => { if (!drag) return; const d = drag; drag = null; if (d.changed) commit(); };
    if (wireGrid.off) wireGrid.off();
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    wireGrid.off = () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    // keyboard: arrows move, space or enter toggles
    grid.addEventListener('keydown', e => {
      const b = e.target.closest('.rg-av');
      if (!b) return;
      const d = +b.dataset.d, h = +b.dataset.h;
      let nd = d, nh = h;
      if (e.key === 'ArrowRight') nd = Math.min(7, d + 1); else if (e.key === 'ArrowLeft') nd = Math.max(1, d - 1);
      else if (e.key === 'ArrowDown') nh = Math.min(H1 - 1, h + 1); else if (e.key === 'ArrowUp') nh = Math.max(H0, h - 1);
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (A.busy[d].has(h)) { openBusy(b, d, h); return; }
        if (setCell(b, !A.on[d].has(h))) commit();
        return;
      } else return;
      e.preventDefault();
      const n = grid.querySelector(`.rg-av[data-d="${nd}"][data-h="${nh}"]`);
      if (n) { b.tabIndex = -1; n.tabIndex = 0; n.focus(); }
    });
    grid.addEventListener('click', e => {
      const day = e.target.closest('[data-day]'), hr = e.target.closest('[data-hr]');
      if (day) bulk(Array.from(grid.querySelectorAll(`.rg-av[data-d="${day.dataset.day}"]`)), D.DAYS[day.dataset.day - 1].name);
      else if (hr) bulk(Array.from(grid.querySelectorAll(`.rg-av[data-h="${hr.dataset.hr}"]`)), 'Ora ' + hh(+hr.dataset.hr).slice(0, 5));
    });
  }

  function openBusy(btn, d, h) {
    const g = A.busy[d].get(h);
    const room = g.room ? D.room(g.room) : null;
    const out = outsideOf(d, h);
    const pop = openPop(btn, `
      <div class="rg-pop__h"><b>${esc(g.subject)} ${esc(g.grade)}</b><span class="rg-dot rg-s-${g.status}"></span></div>
      <p>${esc(D.DAYS[d - 1].name)}, ${hh(g.start).slice(0, 5)}-${hh(g.start + g.duration).slice(0, 5)}${room ? `, cabinet ${room.num}` : ', online'}</p>
      <p class="rg-pop__s">${esc(D.tabName(g))}</p>
      ${out ? '<p class="rg-pop__w"><b>!</b> Lecția e în afara programului tău.</p>' : ''}
      <div class="rg-pop__a">
        ${out ? '<button type="button" class="ax-btn ax-btn--sm" data-fix>Adaugă în program</button>' : ''}
        <a class="ax-btn ax-btn--sm ax-btn--primary" href="#grupa/${g.id}">Deschide foaia ${ico('arrow-right', 14)}</a>
      </div>`);
    const fix = pop.querySelector('[data-fix]');
    if (fix) fix.addEventListener('click', () => { const prev = snapshot(); A.on[d].add(h); syncGrid(); commit(); closePop(); undoToast('Ora a fost adăugată în program.', prev); });
    pop.querySelector('a').addEventListener('click', closePop);
  }

  /* ---- what the teacher teaches ---- */
  function lockedSet() {
    const s = new Set();
    D.groups.filter(g => g.teacher === S.tid && g.status !== 'inactiv').forEach(g => s.add(g.subject + '|' + g.grade));
    return s;
  }
  let teachRows = [];
  function teachHTML() {
    const locked = lockedSet();
    const rows = teachRows.concat([{ subject: '', grades: [] }, { subject: '', grades: [] }]);
    const band = i => (i <= 3 ? 1 : i <= 8 ? 2 : 3);
    return `
      <table class="rg-teach" aria-label="Ce predai și pentru ce clase">
        <thead>
          <tr><th class="rg-th-det" rowspan="1">Detalii profesor</th><th class="rg-th-clasa" colspan="12">Clasa</th></tr>
          <tr><th class="rg-th-mat">Materia</th>${GRADES.map((g, i) => `<th class="rg-th-g rg-th-g--${band(i)}" scope="col">${g}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((r, ri) => {
            const set = new Set(r.grades);
            return `<tr data-row="${ri}" class="${r.subject ? 'is-set' : 'is-blank'}">
              <th class="rg-teach-sel" scope="row">
                <select class="ax-select" data-subj="${ri}" aria-label="Materia ${ri + 1}">
                  <option value="">Alege materia</option>
                  ${D.SUBJECTS.map(s => `<option value="${esc(s)}"${s === r.subject ? ' selected' : ''}>${esc(s)}</option>`).join('')}
                </select>
              </th>
              ${GRADES.map((g, i) => {
                const lock = r.subject && locked.has(r.subject + '|' + g);
                const on = set.has(g) || lock;
                return `<td class="rg-ck-c rg-ck-c--${band(i)}${on ? ' is-on' : ''}"><label class="rg-ck${lock ? ' is-lock' : ''}" title="${lock ? 'Ai o grupă la această materie și clasă' : ''}"><input type="checkbox" data-row="${ri}" data-g="${g}"${on ? ' checked' : ''}${lock || !r.subject ? ' disabled' : ''} aria-label="${esc((r.subject || 'Materie') + ', clasa ' + g)}"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg></i></label></td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function saveTeach(note) {
    const rows = teachRows.filter(r => r.subject).map(r => ({ subject: r.subject, grades: GRADES.filter(g => r.grades.includes(g)) }));
    selfWrite = true;
    try { D.setTeach(S.tid, rows); } finally { selfWrite = false; }
    const chip = view.querySelector('#rgSave2');
    if (chip) { chip.classList.remove('is-on'); void chip.offsetWidth; chip.classList.add('is-on'); chip.querySelector('span').textContent = note || 'Salvat, se vede în consolă'; }
    const rs = view.querySelector('#rgReset');
    if (rs) rs.hidden = !D.teacherEdited(S.tid);
  }

  function wireTeach(root) {
    const box = root.querySelector('#rgTeachBox');
    const rebuild = () => { box.innerHTML = teachHTML(); };
    // the rows of the table as the teacher sees them (the empty ones are not stored)
    box.addEventListener('change', e => {
      const sel = e.target.closest('select[data-subj]');
      if (sel) {
        const ri = +sel.dataset.subj, v = sel.value;
        const cur = teachRows[ri];
        if (v && teachRows.some((r, i) => i !== ri && r.subject === v)) { U.toast('Materia e deja în tabel.'); rebuild(); return; }
        const lock = cur && cur.subject ? Array.from(lockedSet()).filter(k => k.startsWith(cur.subject + '|')) : [];
        if (cur && cur.subject && lock.length && v !== cur.subject) { U.toast(`Ai grupe la ${esc(cur.subject)}, materia nu poate fi schimbată.`); rebuild(); return; }
        if (cur) { cur.subject = v; if (!v) teachRows.splice(ri, 1); }
        else if (v) teachRows.push({ subject: v, grades: [] });
        saveTeach(); rebuild();
        return;
      }
      const ck = e.target.closest('input[type="checkbox"]');
      if (ck) {
        const r = teachRows[+ck.dataset.row];
        if (!r) return;
        const g = ck.dataset.g;
        r.grades = ck.checked ? r.grades.concat(g) : r.grades.filter(x => x !== g);
        ck.closest('.rg-ck-c').classList.toggle('is-on', ck.checked);
        saveTeach();
      }
    });
  }

  function renderDisp(v) {
    const t = D.teacher(S.tid);
    const busy = busyMap(t);
    A = { t, busy, on: onSets(t, busy) };
    teachRows = D.teacher(S.tid).teach.map(r => ({ subject: r.subject, grades: r.grades.slice() }));
    const c = countHours();
    const edited = D.teacherEdited(S.tid);
    v.innerHTML = `
      <div class="rg-av-page">
        <div class="rg-av-head">
          <div>
            <h2>Disponibilitate</h2>
            <p>Atinge o oră sau trage peste mai multe. <b>Ocupat</b> înseamnă că ai deja o lecție atunci; ce rămâne gol înseamnă că nu poți. Ce completezi aici se vede în consola administratorului, la <b>Disponibilitate</b>.</p>
          </div>
          <div class="rg-av-keys">
            <span class="rg-save" id="rgSave"><i>${ico('check', 14)}</i><span>Se salvează automat</span></span>
            <button type="button" class="ax-btn ax-btn--sm" id="rgClear">${ico('x', 14)} Golește programul</button>
            <button type="button" class="ax-btn ax-btn--sm" id="rgReset"${edited ? '' : ' hidden'}>${ico('refresh-cw', 14)} Programul inițial</button>
          </div>
        </div>
        <div class="rg-av-cols">
          <section class="rg-card rg-card--grid" aria-label="Orar">
            <div class="rg-av-stats">
              <span class="rg-ast"><small>Disponibile</small><b data-stat="avail">${c.avail}</b><em>ore pe săptămână</em></span>
              <span class="rg-ast"><small>Ocupate</small><b data-stat="busy">${c.busy}</b><em>cu lecții</em></span>
              <span class="rg-ast"><small>Libere</small><b data-stat="free">${c.free}</b><em>de oferit</em></span>
            </div>
            <div class="rg-av-wrap">${gridHTML()}</div>
            <div class="rg-av-legend"><span><i class="rg-lg rg-lg--on"></i>Disponibil</span><span><i class="rg-lg rg-lg--busy"></i>Ocupat, ai o lecție</span><span><i class="rg-lg rg-lg--off"></i>Gol, nu poți</span></div>
          </section>
          <section class="rg-card rg-card--teach" aria-label="Detalii profesor">
            <div class="rg-teach-h"><h3>Ce predai și pentru ce clase</h3><span class="rg-save rg-save--s" id="rgSave2"><i>${ico('check', 14)}</i><span>Se salvează automat</span></span></div>
            <div class="rg-teach-wrap" id="rgTeachBox">${teachHTML()}</div>
            <p class="rg-teach-n">${ico('info', 14)} Clasele la care ai deja o grupă sunt bifate și blocate.</p>
          </section>
        </div>
      </div>`;
    wireGrid(v);
    wireTeach(v);
    v.querySelector('#rgClear').addEventListener('click', () => {
      const prev = snapshot();
      D.DAYS.forEach(d => { A.on[d.id] = new Set(A.busy[d.id].keys()); });
      syncGrid(); commit('Program golit'); undoToast('Programul a fost golit, rămân lecțiile tale.', prev);
    });
    v.querySelector('#rgReset').addEventListener('click', () => {
      const prev = snapshot();
      selfWrite = true; try { D.resetTeacher(S.tid); } finally { selfWrite = false; }
      repaint();
      U.toast('Programul și materiile au revenit la valorile inițiale.');
    });
  }

  /* ---------------- start ---------------- */
  function waitAuth() {
    return new Promise(res => {
      if (window._bmAuthReady) return res(window.BMAuth);
      document.addEventListener('bmauth:ready', () => res(window.BMAuth), { once: true });
    });
  }
  function waitRole(a) {
    return new Promise(res => {
      if (a.role) return res();
      document.addEventListener('bmauth:profile', () => res(), { once: true });
      setTimeout(res, 5000);
    });
  }
  function blocked(title, msg, href, label) {
    document.body.innerHTML = `<div class="ax-empty" style="padding-top:18vh"><b>${title}</b>${msg}<div style="margin-top:18px"><a class="ax-btn ax-btn--dark" href="${href}">${label}</a></div></div>`;
  }

  async function start() {
    const auth = await waitAuth();
    if (!auth.user) { location.replace('auth.html?from=registru.html'); return; }
    await waitRole(auth);
    const role = auth.role;
    if (role === 'profesor' && auth.status !== 'active') { blocked('Cont în așteptare', 'Registrul se deschide după ce adminul îți aprobă contul de profesor.', 'profile.html', 'Înapoi la profil'); return; }
    if (role !== 'profesor' && role !== 'admin') { blocked('Acces interzis', 'Registrul este pentru profesori.', 'capitole.html', 'Înapoi la site'); return; }
    S.auth = auth; S.role = role;
    S.tid = resolveTeacher(auth);
    try { S.compact = localStorage.getItem('bm_rg_compact') === '1'; } catch (e) {}

    const loading = document.getElementById('rgLoading');
    if (loading) loading.remove();
    const holder = document.createElement('div');
    holder.innerHTML = shellHTML();
    document.body.prepend(holder.firstElementChild);
    view = document.getElementById('rgView');
    tabsEl = document.getElementById('rgTabs');
    paintTop();
    tabsEl.innerHTML = tabsHTML();

    tabsEl.addEventListener('click', e => { const b = e.target.closest('.rg-tab'); if (b) location.hash = b.dataset.r; });
    tabsEl.addEventListener('keydown', e => {
      const list = Array.from(tabsEl.querySelectorAll('.rg-tab'));
      const i = list.indexOf(document.activeElement);
      if (i < 0) return;
      let n = -1;
      if (e.key === 'ArrowRight') n = (i + 1) % list.length; else if (e.key === 'ArrowLeft') n = (i - 1 + list.length) % list.length;
      else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = list.length - 1;
      if (n < 0) return;
      e.preventDefault(); list[n].focus(); location.hash = list[n].dataset.r;
    });
    document.getElementById('rgTheme').addEventListener('click', e => {
      if (window.BM && BM.toggleTheme) BM.toggleTheme();
      e.currentTarget.innerHTML = ico(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon', 18);
    });
    document.getElementById('rgTeacher').addEventListener('change', e => {
      S.tid = e.target.value;
      try { sessionStorage.setItem('bm_rg_teacher', S.tid); } catch (err) {}
      const u = new URL(location.href); u.searchParams.set('t', S.tid); u.hash = 'total';
      history.replaceState(null, '', u);
      S.cur = '';
      paintTop();
      tabsEl.innerHTML = tabsHTML();
      route(false);
    });
    window.addEventListener('hashchange', () => route(false));
    window.addEventListener('resize', () => moveBar(false));
    document.fonts && document.fonts.ready.then(() => moveBar(false));

    // the console (another tab) changed the same data: show it
    const external = () => { if (!selfWrite && view) { paintTop(); tabsEl.innerHTML = tabsHTML(); route(false); } };
    document.addEventListener('bm:demo-external', external);

    route(true);
    document.dispatchEvent(new CustomEvent('rg:ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
