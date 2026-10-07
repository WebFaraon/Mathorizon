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

  // money shows its cents only when it has some (a transfer splits sums to the cent); other figures keep their decimals
  const fm = (n, d) => { if (d == null) d = Math.abs(n - Math.round(n)) < 0.005 ? 0 : 2; return new Intl.NumberFormat('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); };
  const sg = (n, d) => (n < 0 ? '−' : '') + fm(Math.abs(n), d);
  const hh = h => String(h).padStart(2, '0') + ':00';
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const lastFirst = p => `${p.last} ${p.first}`;

  // the statuses a student can have in the register, in the order of the sheet's dropdown
  const SNAME = { proba: 'Oră de probă', activ: 'Activ', transferat: 'Transferat', inactiv: 'Inactiv', proba_ok: 'Oră de probă confirmată', inlocuire: 'Înlocuire', instabil: 'Instabil' };
  const SORDER = ['proba', 'activ', 'transferat', 'inactiv', 'proba_ok', 'inlocuire', 'instabil'];
  // presence marks: P present, G present at the first free lesson, M absent excused, A absent unexcused, B absent at the trial lesson
  const MARK = {
    P: { k: 'P', t: 'PREZENT', n: 'Prezent', c: 'p' },
    G: { k: 'G', t: 'PREZENT PRIMA LECȚIE GRATUITĂ', n: 'Prezent prima lecție gratuită', c: 'g' },
    M: { k: 'M', t: 'ABSENT MOTIVAT', n: 'Absent motivat', c: 'm' },
    A: { k: 'A', t: 'ABSENT NEMOTIVAT', n: 'Absent nemotivat', c: 'a' },
    B: { k: 'B', t: 'ABSENT PRIMA LECȚIE DE PROBĂ', n: 'Absent prima lecție de probă', c: 'b' }
  };
  const GNAME = { activ: 'Activ', completare: 'Se completează', inlocuire: 'Înlocuire', inactiv: 'Inactiv' };
  const GCOUNT = { activ: 'Active', completare: 'Se completează', inlocuire: 'Înlocuire', inactiv: 'Inactive' };
  const SHORT = { Matematica: 'Mat.', 'L.română': 'Rom.', Fizica: 'Fiz.', Istoria: 'Ist.', Chimie: 'Chim.', Biologie: 'Bio.', Engleza: 'Engl.', Geografie: 'Geo.' };
  const MONTH_HUE = [215, 195, 165, 125, 90, 52, 38, 26, 12, 345, 300, 255]; // Jan..Dec: June, July, August as in the sheet
  const H0 = 8, H1 = 22;                                                     // availability rows: 08:00 .. 21:00
  const HOURS = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
  const GRADES = D.GRADES;

  const S = { tid: null, role: null, auth: null, book: null, cur: '' };
  let view = null, tabsEl = null;

  /* ---------------- who is looking ---------------- */
  function resolveTeacher(auth) {
    // The admin can open any teacher's register (?t=). A teacher always gets his own: the one that matches his name
    // (in this demo, anyone who does not match is the demo teacher t5).
    if (S.role === 'admin') {
      const q = new URLSearchParams(location.search).get('t');
      if (q && D.teacher(q)) return q;
      try { const s = sessionStorage.getItem('bm_rg_teacher'); if (s && D.teacher(s)) return s; } catch (e) {}
    }
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
            <button type="button" class="ax-icon-btn rg-ibtn rg-inbox" id="rgInbox" aria-label="Comentarii" title="Comentarii">${ico('message-circle', 18)}<b class="rg-inbox__n" id="rgInboxN" hidden></b></button>
            <span class="rg-saved" id="rgSaved" role="status" aria-live="polite"><i>${ico('check', 14)}</i><span>Salvat</span></span>
            <span class="rg-demo" title="Date demo, generate în browser. Punctul verde: modificările se văd și pe celelalte dispozitive conectate. Galben: rămân doar pe acest dispozitiv. Set de date: ${D.fingerprint}">
              <i aria-hidden="true"></i><b>Date demo</b>
            </span>
            ${admin ? '<label class="rg-pick"><select class="ax-select rg-demo__sel" id="rgTeacher" aria-label="Profesor (date demo)"></select></label>' : ''}
            <button type="button" class="ax-icon-btn rg-ibtn" id="rgTheme" aria-label="Schimbă tema">${ico(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon', 18)}</button>
            <a class="ax-btn rg-back" href="${back.href}">${ico(back.icon, 16)}<span>${back.label}</span></a>
          </div>
        </header>
        <main class="rg-view" id="rgView" tabindex="-1"></main>
        <nav class="rg-tabs" aria-label="Foile registrului">
          <div class="rg-tabs__in" id="rgTabs" role="tablist"></div>
          <div class="rg-tabs__arr">
            <button type="button" class="rg-arr" id="rgTL" data-dir="-1" aria-label="Taburi spre stânga" title="Taburi spre stânga"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button>
            <button type="button" class="rg-arr" id="rgTR" data-dir="1" aria-label="Taburi spre dreapta" title="Taburi spre dreapta"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button>
          </div>
        </nav>
      </div>`;
  }

  function paintTop() {
    const t = D.teacher(S.tid);
    const n = D.groups.filter(g => g.teacher === t.id && g.status !== 'inactiv').length;
    document.getElementById('rgWho').innerHTML = `
      <span class="rg-who__av" aria-hidden="true">${esc(initials(lastFirst(t)))}</span>
      <span class="rg-who__t"><b>${esc(lastFirst(t))}</b><small>${esc(t.subjects.join(', '))} · ${n} ${n === 1 ? 'grupă activă' : 'grupe active'}</small></span>`;
    paintInbox();
    const sel = document.getElementById('rgTeacher');
    if (sel) sel.innerHTML = D.teachers.slice().sort((a, b) => a.name.localeCompare(b.name, 'ro')).map(x => {
      const c = D.groups.filter(g => g.teacher === x.id).length;
      return `<option value="${x.id}"${x.id === S.tid ? ' selected' : ''}>${esc(lastFirst(x))} (${c})</option>`;
    }).join('');
  }

  function tabsHTML() {
    const gs = D.groups.filter(g => g.teacher === S.tid).sort((a, b) => Math.min(...a.days) - Math.min(...b.days) || a.start - b.start || a.id.localeCompare(b.id));
    const unread = unreadByGroup();
    const tab = (r, label, extra = '') => `<button type="button" class="rg-tab${extra}" role="tab" data-r="${r}" aria-selected="false" tabindex="-1">${label}</button>`;
    return `
      ${tab('total', `${ico('chart-column', 16)}<span>Total achitări</span>`, ' rg-tab--main')}
      ${tab('disponibilitate', `${ico('clock', 16)}<span>Disponibilitate</span>`, ' rg-tab--main')}
      <i class="rg-tabs__sep" aria-hidden="true"></i>
      ${gs.map(g => {
        const L = D.ledger(g.id);
        return tab('grupa/' + g.id, `<i class="rg-tab__n" title="Elevi în registru">${L.rows.length}</i><span>${esc(D.tabName(g))}</span>${unread[g.id] ? `<b class="rg-tab__c" title="${unread[g.id] === 1 ? 'Un comentariu nou' : unread[g.id] + ' comentarii noi'}">${unread[g.id]}</b>` : ''}<em class="rg-tab__s rg-s-${g.status}" title="${esc(GNAME[g.status])}"></em>`, ' rg-tab--g');
      }).join('')}`;
  }

  function moveBar(animate) {
    const on = tabsEl && tabsEl.querySelector('.rg-tab[aria-selected="true"]');
    if (!on) return;
    // keep the active tab in view in the strip
    const sc = tabsEl, l = on.offsetLeft, r = l + on.offsetWidth;
    if (l < sc.scrollLeft + 8) sc.scrollTo({ left: Math.max(0, l - 16), behavior: calm() ? 'auto' : 'smooth' });
    else if (r > sc.scrollLeft + sc.clientWidth - 8) sc.scrollTo({ left: r - sc.clientWidth + 16, behavior: calm() ? 'auto' : 'smooth' });
    updateArrows();
  }

  /* the arrows at the end of the strip, as in the spreadsheet: a click moves a page of tabs,
     holding moves them continuously, the wheel moves them too */
  function updateArrows() {
    const l = document.getElementById('rgTL'), r = document.getElementById('rgTR');
    if (!l || !r || !tabsEl) return;
    const max = tabsEl.scrollWidth - tabsEl.clientWidth;
    l.disabled = tabsEl.scrollLeft <= 1;
    r.disabled = tabsEl.scrollLeft >= max - 1;
    l.parentElement.classList.toggle('is-idle', max <= 1);
  }
  function wireTabArrows() {
    let hold = 0, raf = 0, dir = 0;
    const step = () => { tabsEl.scrollLeft += dir * 14; raf = requestAnimationFrame(step); };
    const stop = () => { clearTimeout(hold); cancelAnimationFrame(raf); raf = 0; dir = 0; };
    document.querySelectorAll('.rg-arr').forEach(b => {
      b.addEventListener('pointerdown', e => {
        if (b.disabled || e.button > 0) return;
        dir = +b.dataset.dir;
        hold = setTimeout(() => { raf = requestAnimationFrame(step); b.dataset.held = '1'; }, 320);
      });
      b.addEventListener('click', () => {
        if (b.dataset.held) { delete b.dataset.held; return; }
        tabsEl.scrollBy({ left: +b.dataset.dir * Math.max(180, tabsEl.clientWidth * 0.7), behavior: calm() ? 'auto' : 'smooth' });
      });
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => document.querySelectorAll('.rg-arr').forEach(b => b.addEventListener(ev, stop)));
    tabsEl.addEventListener('scroll', () => requestAnimationFrame(updateArrows), { passive: true });
    tabsEl.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && tabsEl.scrollWidth > tabsEl.clientWidth) { e.preventDefault(); tabsEl.scrollLeft += e.deltaY; }
    }, { passive: false });
  }

  /* a small "Salvat" in the top bar after every edit */
  function flashSaved() {
    const el = document.getElementById('rgSaved');
    if (!el) return;
    el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('is-on'), 2200);
  }
  /* the tabs and the top bar show the status of the groups and the counts: redraw them after an edit */
  function refreshChrome() {
    paintTop();
    tabsEl.innerHTML = tabsHTML();
    const r = parseRoute();
    tabsEl.querySelectorAll('.rg-tab').forEach(b => { const on = b.dataset.r === r.key; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    moveBar(false);
  }

  /* ---------------- router ---------------- */
  function parseRoute() {
    const h = location.hash.replace(/^#/, '');
    if (h === 'disponibilitate') return { key: 'disponibilitate', name: 'disp' };
    const m = /^grupa\/(g\d+)$/.exec(h);
    if (m) { const g = D.group(m[1]); if (g && g.teacher === S.tid) return { key: h, name: 'grupa', gid: g.id }; }
    return { key: 'total', name: 'total' };
  }

  let leaveT = 0, enterT = 0;
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
    clearTimeout(enterT); view.classList.remove('is-entering');
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
      void view.offsetWidth; view.classList.add('is-entering');
      enterT = setTimeout(() => view.classList.remove('is-entering'), 1300);
      if (sc) sc.scrollTo(0, 0);
      U.countUp(view);
    }
  }

  const repaint = () => paint(parseRoute(), false);

  /* ---------------- scroll shadows, hover cross, tooltip ---------------- */
  function wireBoard(board, opts) {
    if (!board) return;
    const cross = !(opts && opts.cross === false);
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
    if (cross) {
      board.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const el = e.target.closest('[data-c]'); light(el ? el.dataset.c : null); });
      board.addEventListener('pointerleave', () => light(null));
    }
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
  function openPop(anchor, html, cls) {
    closePop();
    popEl = document.createElement('div');
    popEl.className = 'rg-pop' + (cls ? ' ' + cls : '');
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
    CM.open = null;
    if (popEl) { const p = popEl; popEl = null; p.classList.remove('is-on'); setTimeout(() => p.remove(), 140); }
  }

  /* ============================================================
     Comments on cells (as in a spreadsheet)
     ============================================================
     The admin or a manager leaves a note on a presence cell, a student column or a lesson date; the teacher
     reads it and may reply. A small orange corner marks a cell with a thread (red while there is something
     unread), the thread opens on click, Shift+F2 or the right-click menu, and a card with the note shows on hover.
     Stored in the shared demo state, one row per message (AdminData.addComment), so it is live on every device. */
  const CM = { open: null, card: null, timer: 0 };
  const READ_KEY = 'bm_rg_cm_read_v1';
  let readSet = {};
  try { readSet = JSON.parse(localStorage.getItem(READ_KEY) || '{}') || {}; } catch (e) { readSet = {}; }
  const saveRead = () => { try { localStorage.setItem(READ_KEY, JSON.stringify(readSet)); } catch (e) {} };
  const myRole = () => (S.role === 'admin' ? 'admin' : 'profesor');
  const ROLE_NAME = { admin: 'Administrator', profesor: 'Profesor' };
  const isUnread = m => m.role !== myRole() && !readSet[m.id];
  const threadMap = gid => { const m = new Map(); D.comments().forEach(c => { if (c.g === gid) { if (!m.has(c.k)) m.set(c.k, []); m.get(c.k).push(c); } }); return m; };
  const threadOf = (gid, key) => D.comments().filter(c => c.g === gid && c.k === key);
  const canThread = (gid, key) => S.role === 'admin' || threadOf(gid, key).length > 0;
  function unreadByGroup() {
    const by = {};
    D.comments().forEach(c => { if (isUnread(c) && D.group(c.g) && D.group(c.g).teacher === S.tid) by[c.g] = (by[c.g] || 0) + 1; });
    return by;
  }
  const unreadTotal = () => Object.values(unreadByGroup()).reduce((a, b) => a + b, 0);
  function paintInbox() {
    const n = document.getElementById('rgInboxN');
    if (!n) return;
    const u = unreadTotal();
    n.hidden = !u; n.textContent = u > 9 ? '9+' : u;
    const b = document.getElementById('rgInbox');
    if (b) b.setAttribute('aria-label', u ? 'Comentarii, ' + u + ' necitite' : 'Comentarii');
  }
  function cellLabel(gid, key) {
    const L = D.ledger(gid), p = key.split('~');
    const row = id => L.rows.find(r => r.s.id === id), les = oid => L.lessons.find(l => l.oid === +oid);
    if (p[0] === 's') return row(p[1]) ? lastFirst(row(p[1]).s) : null;
    if (p[0] === 'l') return les(p[1]) ? 'Lecția din ' + les(p[1]).label : null;
    if (p[0] === 'm') return row(p[1]) && les(p[2]) ? lastFirst(row(p[1]).s) + ', ' + les(p[2]).label : null;
    return null;
  }
  const whenOf = ms => {
    const d = new Date(ms), t = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), now = new Date();
    if (d.toDateString() === now.toDateString()) return 'azi, ' + t;
    const m = D.MONTHS[d.getMonth()];
    return d.getDate() + ' ' + (m.length > 4 ? m.slice(0, 3) + '.' : m) + ', ' + t;
  };
  const linkify = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
  const msgHTML = (m, fresh) => `<li class="rg-cmm rg-cmm--${m.role}${isUnread(m) ? ' is-new' : ''}${fresh ? ' is-fresh' : ''}"><span class="rg-cmm__av" aria-hidden="true">${esc(initials(m.by))}</span><div><p class="rg-cmm__h"><b>${esc(m.by)}</b><em>${ROLE_NAME[m.role] || ''}</em><time>${whenOf(m.at)}</time></p><p class="rg-cmm__t">${linkify(m.t)}</p></div></li>`;

  /* the card that shows on hover, read-only */
  function showCard(span, gid) {
    clearTimeout(CM.timer);
    CM.timer = setTimeout(() => {
      const cell = span.closest('[data-cmk]'); if (!cell || popEl) return;
      const th = threadOf(gid, cell.dataset.cmk); if (!th.length) return;
      if (!CM.card) { CM.card = document.createElement('div'); CM.card.className = 'rg-cmcard'; CM.card.setAttribute('role', 'tooltip'); document.body.appendChild(CM.card); }
      const first = th[0], rest = th.slice(1);
      CM.card.innerHTML = `<div class="rg-cmcard__h"><span class="rg-cmm__av rg-cmm--${first.role}">${esc(initials(first.by))}</span><div><b>${esc(first.by)}</b><time>${whenOf(first.at)}</time></div></div><p>${linkify(first.t)}</p>${rest.length ? `<small>${rest.length === 1 ? 'Încă un răspuns' : 'Încă ' + rest.length + ' răspunsuri'}. Apasă ca să deschizi conversația.</small>` : '<small>Apasă ca să răspunzi.</small>'}`;
      CM.card.classList.add('is-on');
      const r = cell.getBoundingClientRect(), w = CM.card.offsetWidth, h = CM.card.offsetHeight;
      let x = r.right + 6; if (x + w > innerWidth - 8) x = Math.max(8, r.left - w - 6);
      let y = Math.max(64, Math.min(innerHeight - h - 8, r.top));
      CM.card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }, 220);
  }
  function hideCard() { clearTimeout(CM.timer); if (CM.card) CM.card.classList.remove('is-on'); }

  /* the thread: messages, a reply box, and for the admin a way to delete it */
  function openThread(anchor, gid, key, label) {
    if (!anchor || !canThread(gid, key)) return;
    hideCard(); hideTip();
    const me = (S.auth && S.auth.displayName && S.auth.displayName()) || (S.role === 'admin' ? 'Administrator' : 'Profesor');
    const markRead = () => { const th = threadOf(gid, key); let ch = false; th.forEach(m => { if (!readSet[m.id]) { readSet[m.id] = 1; ch = true; } }); if (ch) { saveRead(); paintInbox(); } return ch; };
    let seen = new Set(threadOf(gid, key).map(m => m.id));
    const listHTML = fresh => { const th = threadOf(gid, key); return th.length ? th.map(m => msgHTML(m, fresh && fresh.has(m.id))).join('') : '<li class="rg-cmw__empty">Nicio notă încă. Scrie ce vrei să vadă profesorul.</li>'; };
    const html = fresh => {
      const has = threadOf(gid, key).length > 0;
      return `<div class="rg-cmw" role="dialog" aria-label="Comentariu: ${esc(label)}">
        <div class="rg-cmw__h"><span><small>Comentariu</small><b>${esc(label)}</b></span><button type="button" class="rg-cmw__x" data-cmx aria-label="Închide">${ico('x', 16)}</button></div>
        <ul class="rg-cmw__l" id="rgCmL">${listHTML(fresh)}</ul>
        <form class="rg-cmw__f" id="rgCmF">
          <textarea rows="2" maxlength="600" placeholder="${has ? 'Răspunde…' : 'Scrie o notă pentru profesor…'}" aria-label="${has ? 'Răspuns' : 'Comentariu nou'}"></textarea>
          <div class="rg-cmw__b"><span>Enter trimite, Shift+Enter rând nou</span>${S.role === 'admin' && has ? '<button type="button" class="rg-cmw__del" data-cmdel>Șterge conversația</button>' : ''}<button type="submit" class="rg-cmw__go">Trimite</button></div>
        </form>
      </div>`;
    };
    const wasUnread = markRead();
    const pop = openPop(anchor, html(), 'rg-pop--cm');
    const list = pop.querySelector('#rgCmL'), ta = pop.querySelector('textarea');
    list.scrollTop = list.scrollHeight;
    ta.focus();
    const send = () => {
      const t = ta.value.trim(); if (!t) return;
      D.addComment({ k: key, g: gid, by: me, role: myRole(), t });
      const mine = D.comments().slice(-1)[0].id;
      readSet[mine] = 1; saveRead();
      seen = new Set(threadOf(gid, key).map(m => m.id));
      pop.innerHTML = html(new Set([mine])); wireIn();
      flashSaved(); refreshGroup(gid); refreshChrome();
      const l2 = pop.querySelector('#rgCmL'); l2.scrollTop = l2.scrollHeight;
      pop.querySelector('textarea').focus();
    };
    const wireIn = () => {
      const l = pop.querySelector('#rgCmL'), t = pop.querySelector('textarea');
      // another device wrote: add only what is new (nothing is redrawn when nothing changed)
      CM.open = { refresh() {
        const ids = threadOf(gid, key).map(m => m.id);
        if (ids.length === seen.size && ids.every(id => seen.has(id))) return;
        const fresh = new Set(ids.filter(id => !seen.has(id))); seen = new Set(ids);
        const keep = t.value, atEnd = l.scrollHeight - l.scrollTop - l.clientHeight < 40;
        l.innerHTML = listHTML(fresh); markRead();
        if (atEnd) l.scrollTop = l.scrollHeight;
        t.value = keep;
      } };
      t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
      pop.querySelector('#rgCmF').addEventListener('submit', e => { e.preventDefault(); send(); });
    };
    wireIn();
    pop.addEventListener('click', e => {
      if (e.target.closest('[data-cmx]')) { closePop(); return; }
      const d = e.target.closest('[data-cmdel]');
      if (d) {
        if (!d.dataset.sure) { d.dataset.sure = '1'; d.textContent = 'Sigur? Apasă din nou'; setTimeout(() => { if (d.isConnected) { delete d.dataset.sure; d.textContent = 'Șterge conversația'; } }, 3000); return; }
        D.deleteComments(threadOf(gid, key).map(m => m.id));
        closePop(); flashSaved(); refreshGroup(gid); refreshChrome(); U.toast('Conversația a fost ștearsă.');
      }
    });
    if (wasUnread) { refreshGroup(gid); refreshChrome(); }
  }
  /* right-click on a cell: open its thread, or start one */
  function cellItems(cell, gid) {
    const key = cell.dataset.cmk, items = [];
    if (key && canThread(gid, key)) items.push(['cm', 'message-circle', threadOf(gid, key).length ? 'Deschide comentariul' : 'Adaugă comentariu']);
    const sn = cell.querySelector('.rg-sn[data-s]');
    if (S.role === 'admin' && sn) items.push(['copy', 'clipboard-list', 'Copiază coloana']);
    if (S.role === 'admin' && S.clip && S.clip.gid === gid && cell.classList.contains('is-free')) items.push(['paste', 'arrow-right', 'Lipește coloana aici']);
    return items;
  }
  function openCellMenu(cell, gid) {
    const items = cellItems(cell, gid);
    if (!items.length) return;
    const pop = openPop(cell, `<div class="rg-menu rg-menu--ctx" role="menu">${items.map(([a, ic, lab]) => `<button type="button" role="menuitem" class="rg-mi rg-mi--ctx" data-act="${a}">${ico(ic, 16)}<span>${lab}</span></button>`).join('')}</div>`, 'rg-pop--menu rg-pop--ctx');
    const bs = Array.from(pop.querySelectorAll('.rg-mi')); bs[0].focus();
    pop.addEventListener('click', e => {
      const b = e.target.closest('.rg-mi'); if (!b) return;
      closePop();
      if (b.dataset.act === 'cm') openThread(cell, gid, cell.dataset.cmk, cell.dataset.cml);
      else if (b.dataset.act === 'copy') copyColumn(gid, cell.querySelector('.rg-sn[data-s]').dataset.s);
      else if (b.dataset.act === 'paste') pasteColumn(gid, +cell.dataset.c);
    });
    pop.addEventListener('keydown', e => {
      const at = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); bs[Math.min(bs.length - 1, at + 1)].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); bs[Math.max(0, at - 1)].focus(); }
    });
  }

  /* ---- moving a student's column: copy it, then paste it on a free column ----
     A student who left (Inactiv, Transferat) keeps his column, but a manager moves it to the far right to free
     the first columns for the new ones. The student cannot be in two columns, so pasting moves the column. */
  function copyColumn(gid, sid) {
    const x = D.ledger(gid).rows.find(r => r.s.id === sid); if (!x) return;
    S.clip = { gid, sid };
    refreshGroup(gid);
    const pb = view.querySelectorAll('#rgBoard .rg-sn--paste'); if (pb.length) pb[pb.length - 1].scrollIntoView({ inline: 'end', block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });   // show the free columns on the right
    U.toast(`Coloana lui ${esc(lastFirst(x.s))} e copiată. Alege o coloană liberă și apasă „Lipește aici”.`);
  }
  function pasteColumn(gid, slot) {
    const c = S.clip; if (!c || c.gid !== gid) return;
    const L = D.ledger(gid), x = L.rows.find(r => r.s.id === c.sid);
    S.clip = null;
    if (!x || L.rows.some(r => r.slot === slot)) { refreshGroup(gid); return; }
    const before = JSON.stringify(D.ledgerEdits());
    D.setColumn(gid, c.sid, slot);
    flashSaved(); refreshGroup(gid);
    const board = view.querySelector('#rgBoard');
    if (board) board.querySelectorAll('[data-c="' + slot + '"]').forEach(el => { el.classList.add('is-cmflash'); setTimeout(() => el.classList.remove('is-cmflash'), 2000); });
    U.toast(`Coloana lui ${esc(lastFirst(x.s))} a fost mutată. <button type="button" class="rg-undo">Anulează</button>`);
    const u = document.querySelector('.ax-toasts .ax-toast:last-child .rg-undo');
    if (u) u.addEventListener('click', () => { D.setLedgerEdits(JSON.parse(before)); refreshGroup(gid); u.closest('.ax-toast').classList.add('is-out'); });
  }
  /* the copied column is outlined until it is pasted (Esc cancels) */
  function markClip(board, gid) {
    if (!board || !S.clip || S.clip.gid !== gid) return;
    const x = D.ledger(gid).rows.find(r => r.s.id === S.clip.sid); if (!x) return;
    board.querySelectorAll('[data-c="' + x.slot + '"]').forEach(el => el.classList.add('is-clipcol'));
  }

  /* every comment of this teacher's groups, newest first; a click goes to the cell */
  function openInbox() {
    const mine = new Set(D.groups.filter(g => g.teacher === S.tid).map(g => g.id));
    const map = new Map();
    D.comments().forEach(c => { if (mine.has(c.g) && cellLabel(c.g, c.k)) { const id = c.g + '|' + c.k; if (!map.has(id)) map.set(id, []); map.get(id).push(c); } });
    const items = Array.from(map.values()).sort((a, b) => b[b.length - 1].at - a[a.length - 1].at);
    const body = items.length ? `<ul class="rg-inbox__l">${items.map((th, i) => {
      const last = th[th.length - 1], g = D.group(last.g), un = th.filter(isUnread).length;
      return `<li><button type="button" class="rg-inbox__i${un ? ' is-new' : ''}" data-i="${i}"><span class="rg-inbox__w">${esc(D.tabName(g))} · ${esc(cellLabel(last.g, last.k))}</span><span class="rg-inbox__t"><b>${esc(last.by)}:</b> ${esc(last.t.length > 120 ? last.t.slice(0, 120) + '…' : last.t)}</span><span class="rg-inbox__m">${whenOf(last.at)} · ${th.length === 1 ? 'un mesaj' : th.length + ' mesaje'}${un ? ' · <i>' + un + ' necitit' + (un === 1 ? '' : 'e') + '</i>' : ''}</span></button></li>`;
    }).join('')}</ul>` : '<div class="ax-empty"><b>Niciun comentariu.</b>' + (S.role === 'admin' ? 'Fă clic dreapta pe o celulă din registru și alege „Adaugă comentariu”.' : 'Când administratorul lasă o notă pe o celulă, o găsești aici.') + '</div>';
    const dr = U.drawer({ title: 'Comentarii', sub: `${esc(lastFirst(D.teacher(S.tid)))} · ${items.length} ${items.length === 1 ? 'conversație' : 'conversații'}`, body });
    dr.querySelectorAll('.rg-inbox__i').forEach(b => b.addEventListener('click', () => { const th = items[+b.dataset.i], last = th[0]; dr.close(); goComment(last.g, last.k); }));
  }
  function goComment(gid, key) {
    if (parseRoute().gid !== gid) location.hash = 'grupa/' + gid;
    let tries = 0;
    (function find() {
      const cell = view.querySelector('#rgBoard [data-cmk="' + key + '"]');
      if (cell) {
        cell.scrollIntoView({ block: 'center', inline: 'center', behavior: calm() ? 'auto' : 'smooth' });
        cell.classList.add('is-cmflash'); setTimeout(() => cell.classList.remove('is-cmflash'), 2000);
        setTimeout(() => openThread(cell, gid, key, cell.dataset.cml), 380);
      } else if (++tries < 15) setTimeout(find, 120);
    })();
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

  const kv = items => `<span class="rg-kv">${items.map(([lab, n, dot]) => `<span class="rg-kv__r">${dot ? `<i class="rg-dot rg-s-${dot}"></i>` : ''}<em>${lab}</em><b>${n}</b></span>`).join('')}</span>`;
  const chipsOf = items => `<span class="rg-chips">${items.map(([lab, n]) => `<span class="rg-chip">${esc(lab)}<b>${n}</b></span>`).join('')}</span>`;

  function monthsCell(months, kind) {
    if (!months.length) return '<span class="rg-none">Nicio lecție</span>';
    const rows = months.map(m => {
      const hue = MONTH_HUE[+m.key.slice(5) - 1];
      const tag = `<i class="rg-mt" style="--mh:${hue}">${esc(m.name.slice(0, 3))}</i>`;
      if (kind === 'state') return `<span class="rg-m">${tag}<span class="rg-mc">${['P', 'G', 'M', 'A', 'B'].map(c => `<em class="${MARK[c].c}" title="${esc(MARK[c].n)}">${m[c]}</em>`).join('')}</span></span>`;
      if (kind === 'rate') return `<span class="rg-m">${tag}<span class="rg-mr"><u class="rg-bar" aria-hidden="true"><i style="width:${m.pct}%"></i></u><b>${m.pct}%</b></span></span>`;
      if (kind === 'value') return `<span class="rg-m">${tag}<b class="rg-mv">${fm(m.value)}<small>lei</small></b></span>`;
      if (kind === 'hours') return `<span class="rg-m">${tag}<b class="rg-mv">${fm(m.hours)}<small>ore</small></b></span>`;
      const ids = Object.keys(m.mgr).sort((a, b) => m.mgr[b] - m.mgr[a]);
      return `<span class="rg-m rg-m--col">${tag}<span class="rg-m__l">${ids.length ? ids.map(id => `<span><u>${esc(mgrShort(D.manager(id)))}</u><b>${fm(m.mgr[id])}</b></span>`).join('') : '<span><u>fără ore plătite</u><b>0</b></span>'}</span></span>`;
    }).join('');
    return `<span class="rg-ms rg-ms--${kind}">${rows}</span>`;
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
          ${row('', 'Formatul grupului', kv(distinct(gs, L => L.g.size, (k, n) => [k === 1 ? 'Individual' : `Grup cu ${k} elevi`, n])),
            cells(L => ({ h: sizeLabel(L.g.size), c: 'rg-tone rg-tone--' + sizeTone(L.g.size) })))}
          ${row('', 'Starea grupului', kv(['activ', 'completare', 'inlocuire', 'inactiv'].map(k => [GNAME[k], gs.filter(L => L.g.status === k).length, k])),
            cells(L => ({ h: `<span class="rg-dot rg-s-${L.g.status}"></span>${esc(GNAME[L.g.status])}`, c: 'rg-tone rg-tone--st-' + L.g.status })))}
          ${row('', 'Materia', kv(distinct(gs, L => L.g.subject, (k, n) => [esc(k), n])), cells(L => ({ h: esc(subjLabel(L.g)), c: 'rg-cream' })))}
          ${row('', 'Clasa', kv(distinct(gs.slice().sort((a, b) => GRADES.indexOf(a.g.grade) - GRADES.indexOf(b.g.grade)), L => L.g.grade, (k, n) => ['Clasa ' + k, n])),
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
          ${row('rg-r--tall rg-r--top', 'Starea elevului la oră<span class="rg-key"><em class="p">prezent</em><em class="g">gratuit</em><em class="m">motivat</em><em class="a">nemotivat</em><em class="b">probă</em></span>', `<span class="rg-ms">${monthsCell(B.months, 'state')}</span>`, cells(L => ({ h: `<span class="rg-ms">${monthsCell(L.months, 'state')}</span>`, c: 'rg-ml' })))}
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
  const SIZES = [1, 2, 3, 4, 5, 6, 8].map(n => [n, sizeLabel(n)]);
  const opts = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const ps = (field, cur, list, tone, label) => `<div class="rg-ps ${tone}"><select class="ax-select" data-gf="${field}" aria-label="${esc(label)}">${opts(list, cur)}</select></div>`;
  const STONE = { activ: 'ok', proba: 'info', proba_ok: 'info', instabil: 'warn', inlocuire: 'lilac', transferat: 'grey', inactiv: 'bad' };
  const dateLabel = iso => { const d = new Date(iso + 'T00:00'); return `${d.getDate()} ${D.MONTHS[d.getMonth()]}`; };

  function groupTableHTML(L) {
    const g = L.g;
    const nStu = L.rows.length;
    const maxSlot = L.rows.reduce((m, x) => Math.max(m, x.slot), -1);
    const cols = Math.max(12, nStu + 6, maxSlot + 2);          // a register has many empty columns
    const sched = D.schedule(g);
    // a student sits in his own column (his slot); the columns between are free
    const rowBySlot = new Map(L.rows.map(x => [x.slot, x]));
    const firstSlot = L.rows.length ? L.rows[0].slot : 0;
    const slots = (rowFn, freeFn) => Array.from({ length: cols }, (_, i) => { const x = rowBySlot.get(i); return x ? rowFn(x, i) : freeFn(i); }).join('');
    const pasting = !!(S.clip && S.clip.gid === g.id && S.role === 'admin');
    const blankX = c => `<td class="rg-xc rg-x${c} is-blank"></td>`;
    const schedX = n => { const s = sched[n]; return s
      ? `<td class="rg-xc rg-x1">${esc(s.day)}</td><td class="rg-xc rg-x2">${hh(s.hour).slice(0, 5)}</td><td class="rg-xc rg-x3">${s.room ? s.room : 'online'}</td>`
      : blankX(1) + blankX(2) + blankX(3); };
    const TH = threadMap(g.id);
    const cmMark = key => { const th = TH.get(key); return th ? `<span class="rg-cm${th.some(isUnread) ? ' is-new' : ''}" role="button" tabindex="-1" aria-label="Comentariu, ${th.length === 1 ? 'un mesaj' : th.length + ' mesaje'}${th.some(isUnread) ? ', necitit' : ''}"></span>` : ''; };
    const person = m => (m ? lastFirst({ first: m.name.split(' ')[0], last: m.name.split(' ').slice(1).join(' ') }) : '');

    const head = [];
    head.push(`<tr class="rg-hr" data-hr="1">
      <th class="rg-a rg-pillcell">${ps('size', g.size, SIZES, 'rg-tone--' + sizeTone(g.size), 'Formatul grupei')}</th>
      <th class="rg-hl-lab" colspan="2">DATELE ELEVULUI</th>
      ${slots((x, i) => {
        const note = x.leave ? `<small class="rg-sn__mv">→ ${esc(x.to ? D.tabName(x.to) : 'altă grupă')}</small>` : x.join ? `<small class="rg-sn__mv">${x.from ? 'din ' + esc(D.tabName(x.from)) : 'elev nou'}</small>` : `<small>${esc(x.s.phone)}</small>`;
        const tip = lastFirst(x.s) + (x.leave ? ', transferat în ' + (x.to ? D.tabName(x.to) : 'altă grupă') : x.join ? (x.from ? ', venit prin transfer din ' + D.tabName(x.from) : ', elev nou înscris pe ' + x.join) : '');
        return `<th class="rg-sc rg-sname${x.leave ? ' is-moved' : ''}${x.join ? ' is-in' : ''}" data-c="${i}" scope="col" data-cmk="s~${x.s.id}" data-cml="${esc(lastFirst(x.s))}"><button type="button" class="rg-sn" data-s="${x.s.id}" title="${esc(tip)}"><b>${esc(lastFirst(x.s))}</b>${note}</button>${cmMark('s~' + x.s.id)}</th>`;
      }, i => `<th class="rg-sc rg-sname is-free" data-c="${i}" scope="col">${pasting ? `<button type="button" class="rg-sn rg-sn--paste" data-paste="${i}"><b>Lipește aici</b><small>mută coloana</small></button>` : '<span class="rg-sn"><b>Loc liber</b><small>în grupă</small></span>'}</th>`)}
      <th class="rg-xh rg-x1">Ziua</th><th class="rg-xh rg-x2">Ora</th><th class="rg-xh rg-x3">Cabinetul</th>
    </tr>`);
    const fin = (n, cls, lab, pillHTML, get, getFree) => head.push(`<tr class="rg-hr rg-hr--fin" data-hr="${n}">
        <th class="rg-a rg-pillcell">${pillHTML}</th>
        <th class="rg-hl-lab rg-hl--${cls}" colspan="2">${lab}</th>
        ${slots((x, i) => { const v = get(x); return `<td class="rg-sc rg-fin rg-fin--${cls}${v.c ? ' ' + v.c : ''}" data-c="${i}">${v.h}</td>`; }, i => `<td class="rg-sc rg-fin rg-fin--${cls} is-free" data-c="${i}">${getFree}</td>`)}
        ${schedX(n - 2)}
      </tr>`);
    fin(2, 'sold', 'SOLD',
      `<span class="rg-rate"><input class="rg-rate-in" type="number" inputmode="numeric" min="50" max="2000" step="5" value="${L.rate}" data-rate aria-label="Prețul pe oră, în lei"><span>MDL/Oră</span></span>`,
      x => ({ h: sg(x.sold), c: x.sold > 0 ? 'is-good' : x.sold < 0 ? 'is-bad' : '' }), '0');
    fin(3, 'paid', 'ACHITĂRI', ps('status', g.status, D.GROUP_STATUS.map(s => [s.id, s.name]), 'rg-tone--st-' + g.status, 'Starea grupei'), x => ({ h: fm(x.paid) }), '0');
    fin(4, 'disc', 'REDUCERI', ps('subject', g.subject, D.SUBJECTS.map(s => [s, s]), 'rg-cream', 'Materia'), x => ({ h: fm(x.disc) }), '0');
    fin(5, 'cost', 'COSTUL LECȚIILOR', ps('grade', g.grade, GRADES.map(s => [s, 'Clasa ' + s]), 'rg-tone--' + gradeTone(g.grade), 'Clasa'), x => ({ h: fm(x.cost) }), '0');
    fin(6, 'done', 'EFECTUATE / DISPONIBILE', ps('level', g.level, D.LEVELS.map(s => [s, 'Nivel ' + s]), 'rg-cream', 'Nivelul de studiu'), x => ({ h: `${x.done} / ${fm(x.avail, 1)}`, c: x.avail < 0 ? 'is-bad-t' : '' }), '0 / 0,0');
    fin(7, 'mgr', 'MANAGER', ps('profile', g.profile || '', [['', 'Profilul'], ['Real', 'Profil Real'], ['Uman', 'Profil Uman']], g.profile ? 'rg-tone--' + (g.profile === 'Real' ? 'pink' : 'lilac') : 'rg-cream', 'Profilul'), x => ({ h: `<div class="rg-ps rg-ps--mg"><select class="ax-select" data-smg="${x.s.id}" aria-label="Managerul elevului ${esc(lastFirst(x.s))}">${opts(D.managers.map(m => [m.id, person(m)]), x.s.manager)}</select></div>` }), '');
    head.push(`<tr class="rg-hr rg-hr--last" data-hr="8">
      <th class="rg-a rg-colh">DATA</th>
      <th class="rg-b rg-colh">TEMA</th>
      <th class="rg-cc rg-colh rg-sumh" aria-label="Total câștigat cu această grupă">${fm(L.earned)}</th>
      ${slots((x, i) => x.leave
        ? `<td class="rg-sc rg-stat rg-stat--lilac rg-stat--moved" data-c="${i}" title="A fost transferat. Ora lui și banii rămân în această coloană."><span class="rg-mvd">Transferat</span></td>`
        : `<td class="rg-sc rg-stat rg-stat--${STONE[x.status] || 'grey'}" data-c="${i}"><div class="rg-ps rg-ps--st"><select class="ax-select" data-sst="${x.s.id}" aria-label="Statusul elevului ${esc(lastFirst(x.s))}">${opts(SORDER.map(k => [k, SNAME[k]]), x.status)}</select></div></td>`, i => `<td class="rg-sc rg-stat rg-stat--free is-free" data-c="${i}">Liber</td>`)}
      <th class="rg-colh rg-xlh rg-x1">NIVELUL PROFESORULUI</th><th class="rg-colh rg-xlh rg-x2">PREZENȚA</th><th class="rg-colh rg-xlh rg-x3"></th>
    </tr>`);

    const body = [];
    L.lessons.forEach((l, li) => {
      body.push(`<tr class="rg-lr" data-li="${li}">
        <th class="rg-a rg-ld${l.date ? '' : ' is-nodate'}" style="--mh:${MONTH_HUE[l.date ? l.date.getMonth() : 0]}" scope="row" data-cmk="l~${l.oid}" data-cml="Lecția din ${esc(l.label)}"><button type="button" class="rg-dc" data-date="${l.oid}" title="Schimbă data" aria-label="Data lecției ${li + 1}: ${esc(l.label)}"><span class="rg-long">${esc(l.label)}</span><span class="rg-short">${l.date ? l.date.getDate() + ' ' + esc(D.MONTHS[l.date.getMonth()].slice(0, 3)) : 'Data'}</span></button>${cmMark('l~' + l.oid)}</th>
        <td class="rg-b rg-lt"><input class="rg-ti" type="text" value="${esc(l.topic)}" data-ti="${l.oid}" placeholder="Tema lecției" maxlength="90" autocomplete="off" aria-label="Tema lecției ${li + 1}"></td>
        <td class="rg-cc rg-lp"${l.counted ? '' : ' title="Completează data și tema: abia atunci lecția se plătește"'}><span>${fm(l.pay)}</span></td>
        ${slots((x, i) => {
          const c = x.codes[li], m = c ? MARK[c] : null;
          if (x.lock[li]) return `<td class="rg-sc rg-pc is-lock" data-c="${i}" title="${x.leave ? 'Elevul a fost transferat, lecțiile de după transfer nu se mai notează aici' : 'Elevul a venit prin transfer, lecțiile dinainte nu se notează'}"><span class="rg-pl rg-pl--e is-off">${c ? (m ? m.t : '') : ''}</span></td>`;
          return `<td class="rg-sc rg-pc" data-c="${i}" data-cmk="m~${x.s.id}~${l.oid}" data-cml="${esc(lastFirst(x.s) + ', ' + l.label)}"><button type="button" class="rg-pl rg-pl--${m ? m.c : 'e'}${x.flag === li ? ' is-flag' : ''}" data-sid="${x.s.id}" data-i="${l.oid}" data-m="${c || ''}" tabindex="${li === 0 && i === firstSlot ? 0 : -1}" aria-label="${esc(lastFirst(x.s) + ', ' + l.label + ': ' + (m ? m.n : 'necompletat'))}">${m ? m.t : ''}</button>${cmMark('m~' + x.s.id + '~' + l.oid)}</td>`;
        }, i => `<td class="rg-sc rg-pc is-free" data-c="${i}"><span class="rg-pl rg-pl--e is-off"></span></td>`)}
        <td class="rg-xc rg-x1">${l.counted ? `<span class="rg-lvl">Nivelul ${L.level}</span>` : ''}</td><td class="rg-xc rg-x2 rg-xp${!l.counted || l.pct == null ? '' : l.pct >= 80 ? ' is-ok' : l.pct < 50 ? ' is-low' : ''}">${l.counted && l.pct != null ? l.pct + '%' : ''}</td>${blankX(3)}
      </tr>`);
    });

    return `
      <table class="rg-gsheet" style="--scols:${cols}">
        <colgroup><col class="rg-col-a"><col class="rg-col-b"><col class="rg-col-c">${Array.from({ length: cols }, () => '<col class="rg-col-s">').join('')}<col class="rg-col-x1"><col class="rg-col-x2"><col class="rg-col-x3"></colgroup>
        <thead>${head.join('')}</thead>
        <tbody>${body.join('')}</tbody>
      </table>
      <div class="rg-addbar"><button type="button" class="rg-add" data-add>${ico('plus', 16)}<span>Adaugă lecție nouă</span></button></div>`;
  }

  /* a group a student moved to or came from: a link to its sheet (the admin can open another teacher's) */
  function moveLink(g) {
    const label = esc(`${g.subject} ${g.grade}, ${D.tabName(g)}`);
    if (g.teacher === S.tid) return `<a href="#grupa/${g.id}" data-closedr>${label}</a>`;
    return S.role === 'admin' ? `<a href="registru.html?t=${g.teacher}#grupa/${g.id}" target="_blank" rel="noopener">${label}</a>, la ${esc(lastFirst(D.teacher(g.teacher)))}` : `${label}, la ${esc(lastFirst(D.teacher(g.teacher)))}`;
  }
  function studentDrawer(L, sid) {
    const x = L.rows.find(r => r.s.id === sid);
    if (!x) return;
    const s = x.s;
    const recent = x.codes.map((c, i) => [c, i]).filter(p => p[0]).slice(-8);
    const dr = U.drawer({
      title: esc(lastFirst(s)),
      sub: `${esc(D.tabName(L.g))} · ${esc(SNAME[x.status])}`,
      body: `
        <dl class="ax-dl">
          <dt>Telefon</dt><dd><a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></dd>
          <dt>Manager</dt><dd>${x.manager ? esc(lastFirst({ first: x.manager.name.split(' ')[0], last: x.manager.name.split(' ').slice(1).join(' ') })) : '-'}</dd>
          <dt>În grupă din</dt><dd>${esc(new Date((x.join || s.joinedAt) + 'T00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }))}</dd>
          ${x.leave ? `<dt>Transferat</dt><dd>${esc(new Date(x.leave + 'T00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }))}, în ${x.to ? moveLink(x.to) : 'altă grupă'}</dd>` : ''}
          ${x.leave && x.fin ? `<dt>Banii la transfer</dt><dd>Au rămas aici ${fm(x.fin.achC + x.fin.redC)} lei, cât au costat lecțiile ținute; ${fm(x.fin.achRem + x.fin.redRem)} lei au trecut în grupa nouă${x.fin.debt ? `. Datorie rămasă aici: ${fm(x.fin.debt)} lei` : ''}</dd>` : ''}
          ${x.join && x.fin ? `<dt>Banii veniți</dt><dd>Achitări ${fm(x.fin.achRem)} lei, reduceri ${fm(x.fin.redRem)} lei, din grupa veche</dd>` : ''}
          ${x.join && x.from ? `<dt>Venit din</dt><dd>${x.from ? moveLink(x.from) : 'altă grupă'}</dd>` : ''}
          <dt>Achitări</dt><dd>${fm(x.paid)} lei</dd>
          <dt>Reduceri</dt><dd>${fm(x.disc)} lei</dd>
          <dt>Costul lecțiilor</dt><dd>${fm(x.cost)} lei</dd>
          <dt>Sold</dt><dd><b class="${x.sold < 0 ? 'rg-neg' : x.sold > 0 ? 'rg-pos' : ''}">${sg(x.sold)} lei</b></dd>
          <dt>Lecții efectuate</dt><dd>${x.done}, mai are plătite ${fm(Math.max(0, x.avail), 1)}</dd>
        </dl>
        <h3 class="rg-dr-h">Ultimele lecții</h3>
        <ul class="rg-dr-l">${recent.length ? recent.reverse().map(([c, i]) => `<li><span class="rg-pl rg-pl--${MARK[c].c}">${MARK[c].t}</span><span><b>${esc(L.lessons[i].label)}</b><small>${esc(L.lessons[i].topic || 'fără temă')}</small></span></li>`).join('') : '<li class="rg-none">Nicio lecție încă.</li>'}</ul>`,
      actions: S.role === 'admin' ? `<a class="ax-btn ax-btn--primary" href="admin.html#elevi?q=${encodeURIComponent(s.last)}">Vezi în consolă ${ico('arrow-right', 16)}</a>` : ''
    });
    dr.querySelectorAll('[data-closedr]').forEach(l => l.addEventListener('click', () => dr.close()));
  }

  /* the table is drawn again after an edit (a few ms); scroll and focus stay where they were */
  function refreshGroup(gid, focus) {
    const board = view.querySelector('#rgBoard');
    if (!board) return;
    hideTip();
    const sx = board.scrollLeft, sy = board.scrollTop;
    board.innerHTML = groupTableHTML(D.ledger(gid));
    markClip(board, gid);
    board.scrollLeft = sx; board.scrollTop = sy;
    if (focus) {
      const b = board.querySelector(`.rg-pl[data-sid="${focus.sid}"][data-i="${focus.i}"]`);
      if (b) { b.tabIndex = 0; b.focus({ preventScroll: true }); b.classList.add('is-pop'); }
    }
  }

  function openMarkMenu(btn, gid) {
    const cur = btn.dataset.m;
    const pop = openPop(btn, `
      <div class="rg-menu" role="menu" aria-label="Prezența">
        ${Object.values(MARK).map(m => `<button type="button" role="menuitemradio" aria-checked="${m.k === cur}" class="rg-mi${m.k === cur ? ' is-on' : ''}" data-code="${m.k}"><i class="rg-pl rg-pl--${m.c}"></i><span>${m.n}</span><kbd>${m.k}</kbd></button>`).join('')}
        <button type="button" role="menuitem" class="rg-mi rg-mi--clear" data-code=""><i class="rg-pl rg-pl--e"></i><span>Golește celula</span><kbd>Del</kbd></button>
        ${canThread(gid, btn.closest('[data-cmk]').dataset.cmk) ? `<button type="button" role="menuitem" class="rg-mi rg-mi--cm" data-cmopen="1">${ico('message-circle', 16)}<span>${threadOf(gid, btn.closest('[data-cmk]').dataset.cmk).length ? 'Deschide comentariul' : 'Adaugă comentariu'}</span><kbd>Shift+F2</kbd></button>` : ''}
      </div>`, 'rg-pop--menu');
    const items = Array.from(pop.querySelectorAll('.rg-mi'));
    (items.find(x => x.classList.contains('is-on')) || items[0]).focus();
    const pick = code => {
      closePop();
      D.setMark(gid, btn.dataset.sid, +btn.dataset.i, code);
      flashSaved();
      refreshGroup(gid, { sid: btn.dataset.sid, i: btn.dataset.i });
    };
    pop.addEventListener('click', e => {
      const b = e.target.closest('.rg-mi'); if (!b) return;
      if (b.dataset.cmopen) { const c = btn.closest('[data-cmk]'); closePop(); openThread(c, gid, c.dataset.cmk, c.dataset.cml); return; }
      pick(b.dataset.code);
    });
    pop.addEventListener('keydown', e => {
      const at = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, at + 1)].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(0, at - 1)].focus(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); pick(''); }
      else if (MARK[e.key.toUpperCase()] && !e.ctrlKey && !e.metaKey) { e.preventDefault(); pick(e.key.toUpperCase()); }
      else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closePop(); btn.focus(); }
    });
  }

  /* deleting any lesson, with undo (the edits are restored as they were) */
  function deleteLesson(gid, oid) {
    const before = JSON.stringify(D.ledgerEdits());
    D.removeLesson(gid, oid); flashSaved(); refreshGroup(gid);
    U.toast('Lecția a fost ștearsă. <button type="button" class="rg-undo">Anulează</button>');
    const u = document.querySelector('.ax-toasts .ax-toast:last-child .rg-undo');
    if (u) u.addEventListener('click', () => { D.setLedgerEdits(JSON.parse(before)); refreshGroup(gid); u.closest('.ax-toast').classList.add('is-out'); });
  }
  /* right click on the date block */
  function openLessonMenu(anchor, gid, oid) {
    const L = D.ledger(gid), l = L.lessons.find(x => x.oid === oid);
    if (!l) return;
    const pop = openPop(anchor, `
      <div class="rg-menu rg-menu--ctx" role="menu" aria-label="Lecția din ${esc(l.label)}">
        <button type="button" role="menuitem" class="rg-mi rg-mi--ctx" data-act="date">${ico('calendar', 16)}<span>Schimbă data</span></button>
        ${canThread(gid, 'l~' + oid) ? `<button type="button" role="menuitem" class="rg-mi rg-mi--ctx" data-act="cm">${ico('message-circle', 16)}<span>${threadOf(gid, 'l~' + oid).length ? 'Deschide comentariul' : 'Adaugă comentariu'}</span></button>` : ''}
        <button type="button" role="menuitem" class="rg-mi rg-mi--ctx rg-mi--del" data-act="del">${ico('trash-2', 16)}<span>Șterge lecția</span></button>
      </div>`, 'rg-pop--menu rg-pop--ctx');
    const items = Array.from(pop.querySelectorAll('.rg-mi'));
    items[0].focus();
    pop.addEventListener('click', e => {
      const b = e.target.closest('.rg-mi'); if (!b) return;
      closePop();
      if (b.dataset.act === 'del') deleteLesson(gid, oid);
      else if (b.dataset.act === 'cm') { const c = anchor.closest('[data-cmk]'); openThread(c, gid, c.dataset.cmk, c.dataset.cml); }
      else openCalendar(anchor, gid, oid);
    });
    pop.addEventListener('keydown', e => {
      const at = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, at + 1)].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(0, at - 1)].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closePop(); anchor.focus(); }
    });
  }

  /* a calendar in the language of the site, instead of the browser's own */
  const WD = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
  const cap1 = t => t.charAt(0).toUpperCase() + t.slice(1);
  function openCalendar(anchor, gid, li) {
    const L = D.ledger(gid), l = L.lessons.find(x => x.oid === li), g = L.g;
    const todayIso = D.iso(new Date());
    let cur = l.iso ? new Date(l.iso + 'T00:00') : new Date();
    cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const html = () => {
      const first = new Date(cur), lead = (first.getDay() + 6) % 7;
      const start = new Date(first); start.setDate(1 - lead);
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const iso = D.iso(d), wdId = ((d.getDay() + 6) % 7) + 1;
        cells.push(`<button type="button" class="rg-cal__d${d.getMonth() !== cur.getMonth() ? ' is-out' : ''}${iso === todayIso ? ' is-today' : ''}${iso === l.iso ? ' is-sel' : ''}${g.days.includes(wdId) ? ' is-meet' : ''}" data-d="${iso}" tabindex="-1" aria-label="${d.getDate()} ${D.MONTHS[d.getMonth()]} ${d.getFullYear()}">${d.getDate()}</button>`);
      }
      return `
        <div class="rg-cal__h">
          <button type="button" class="rg-cal__nav" data-nav="-1" aria-label="Luna trecută"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button>
          <b>${esc(cap1(D.MONTHS[cur.getMonth()]))} ${cur.getFullYear()}</b>
          <button type="button" class="rg-cal__nav" data-nav="1" aria-label="Luna viitoare"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button>
        </div>
        <div class="rg-cal__w" aria-hidden="true">${WD.map(x => `<span>${x}</span>`).join('')}</div>
        <div class="rg-cal__g">${cells.join('')}</div>
        <div class="rg-cal__f"><span><i></i>zilele grupei</span><span class="rg-cal__k"><button type="button" class="rg-cal__del" data-del>Șterge lecția</button><button type="button" class="rg-cal__today" data-today>Azi</button></span></div>`;
    };
    const pop = openPop(anchor, '<div class="rg-cal">' + html() + '</div>', 'rg-pop--cal');
    const root = pop.querySelector('.rg-cal');
    const focusDay = iso => { const b = root.querySelector('.rg-cal__d[data-d="' + iso + '"]'); if (b) { root.querySelectorAll('.rg-cal__d[tabindex="0"]').forEach(x => { x.tabIndex = -1; }); b.tabIndex = 0; b.focus(); } };
    const redraw = dir => {
      root.innerHTML = html();
      const grid = root.querySelector('.rg-cal__g');
      if (dir && !calm()) grid.animate([{ opacity: 0, transform: 'translateX(' + (dir * 14) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    };
    const pick = iso => { closePop(); D.setLesson(gid, li, { d: iso }); flashSaved(); refreshGroup(gid); };
    const go = n => { cur = new Date(cur.getFullYear(), cur.getMonth() + n, 1); redraw(n); };
    root.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]'); if (nav) { go(+nav.dataset.nav); return; }
      if (e.target.closest('[data-today]')) { pick(todayIso); return; }
      if (e.target.closest('[data-del]')) { closePop(); deleteLesson(gid, li); return; }
      const d = e.target.closest('.rg-cal__d'); if (d) pick(d.dataset.d);
    });
    root.addEventListener('keydown', e => {
      const d = e.target.closest('.rg-cal__d');
      if (!d) return;
      const base = new Date(d.dataset.d + 'T00:00');
      let n = 0, m = 0;
      if (e.key === 'ArrowLeft') n = -1; else if (e.key === 'ArrowRight') n = 1; else if (e.key === 'ArrowUp') n = -7; else if (e.key === 'ArrowDown') n = 7;
      else if (e.key === 'PageUp') m = -1; else if (e.key === 'PageDown') m = 1;
      else if (e.key === 'Escape') { e.preventDefault(); closePop(); anchor.focus(); return; }
      else return;
      e.preventDefault();
      const t = new Date(base);
      if (m) t.setMonth(t.getMonth() + m); else t.setDate(t.getDate() + n);
      if (t.getMonth() !== cur.getMonth() || t.getFullYear() !== cur.getFullYear()) { cur = new Date(t.getFullYear(), t.getMonth(), 1); redraw(t > base ? 1 : -1); }
      focusDay(D.iso(t));
    });
    focusDay(l.iso || todayIso);
  }

  function wireGroup(board, gid) {
    board.addEventListener('click', e => {
      const ps = e.target.closest('[data-paste]');
      if (ps) { pasteColumn(gid, +ps.dataset.paste); return; }
      const cmx = e.target.closest('.rg-cm');
      if (cmx) { const c = cmx.closest('[data-cmk]'); hideCard(); openThread(c, gid, c.dataset.cmk, c.dataset.cml); return; }
      const pl = e.target.closest('.rg-pl[data-sid]');
      if (pl) { openMarkMenu(pl, gid); return; }
      const st = e.target.closest('[data-s]');
      if (st) { studentDrawer(D.ledger(gid), st.dataset.s); return; }
      if (e.target.closest('[data-add]')) {
        D.addLesson(gid); flashSaved(); refreshGroup(gid);
        const rows = board.querySelectorAll('.rg-lr'); const last = rows[rows.length - 1];
        if (last) { last.classList.add('is-new'); const dc = last.querySelector('.rg-dc'); if (dc) { dc.focus({ preventScroll: true }); last.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' }); } }
        return;
      }
      const dt = e.target.closest('[data-date]');
      if (dt) openCalendar(dt, gid, +dt.dataset.date);
    });
    board.addEventListener('contextmenu', e => {
      const dt = e.target.closest('[data-date]');
      if (dt) { e.preventDefault(); openLessonMenu(dt, gid, +dt.dataset.date); return; }
      const c = e.target.closest('[data-cmk], .rg-sname.is-free');
      if (c && cellItems(c, gid).length) { e.preventDefault(); openCellMenu(c, gid); }
    });
    board.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const m = e.target.closest('.rg-cm'); if (m) showCard(m, gid); });
    board.addEventListener('pointerout', e => { if (e.target.closest('.rg-cm')) hideCard(); });
    board.addEventListener('keydown', e => {
      const t = e.target;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && S.role === 'admin' && t.matches && t.matches('.rg-sn[data-s]')) { e.preventDefault(); copyColumn(gid, t.dataset.s); return; }
      if (e.shiftKey && e.key === 'F2') { const c = t.closest && t.closest('[data-cmk]'); if (c && canThread(gid, c.dataset.cmk)) { e.preventDefault(); openThread(c, gid, c.dataset.cmk, c.dataset.cml); return; } }
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { const dt = t.closest && t.closest('[data-date]'); if (dt) { e.preventDefault(); openLessonMenu(dt, gid, +dt.dataset.date); return; } }
      if (t.matches && t.matches('.rg-ti')) {
        if (e.key === 'Escape') { t.value = t.defaultValue; t.blur(); }
        else if (e.key === 'Enter') { e.preventDefault(); t.blur(); }   // saves (change fires on blur) and leaves the field
        return;
      }
      const pl = t.closest && t.closest('.rg-pl[data-sid]');
      if (!pl) return;
      const oid = +pl.dataset.i, li = +pl.closest('tr').dataset.li, c = +pl.closest('td').dataset.c;
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (MARK[key] && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); D.setMark(gid, pl.dataset.sid, oid, key); flashSaved(); refreshGroup(gid, { sid: pl.dataset.sid, i: oid }); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); D.setMark(gid, pl.dataset.sid, oid, ''); flashSaved(); refreshGroup(gid, { sid: pl.dataset.sid, i: oid }); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMarkMenu(pl, gid); return; }
      let nl = li, nc = c;
      if (e.key === 'ArrowDown') nl++; else if (e.key === 'ArrowUp') nl--; else if (e.key === 'ArrowRight') nc++; else if (e.key === 'ArrowLeft') nc--; else return;
      e.preventDefault();
      const n = board.querySelector(`tr[data-li="${nl}"] td[data-c="${nc}"] .rg-pl[data-sid]`);
      if (n) { pl.tabIndex = -1; n.tabIndex = 0; n.focus(); }
    });
    board.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('select[data-gf]')) {
        const f = t.dataset.gf;
        let v = t.value;
        if (f === 'size') v = +v; else if (f === 'profile') v = v || null;
        D.setGroup(gid, { [f]: v });
        flashSaved(); refreshGroup(gid); refreshChrome();
      } else if (t.matches('select[data-sst]')) {
        D.setStudentStatus(t.dataset.sst, t.value);
        flashSaved(); refreshGroup(gid); refreshChrome();
      } else if (t.matches('select[data-smg]')) {
        D.setStudentManager(t.dataset.smg, t.value);
        flashSaved(); refreshGroup(gid);
      } else if (t.matches('input[data-ti]')) {
        D.setLesson(gid, +t.dataset.ti, { t: t.value.trim() });
        t.defaultValue = t.value; flashSaved();
      } else if (t.matches('input[data-rate]')) {
        const n = Math.round(+t.value);
        if (!(n >= 50 && n <= 2000)) { t.value = D.ledger(gid).rate; U.toast('Prețul pe oră trebuie să fie între 50 și 2000 de lei.'); return; }
        D.setRate(gid, n); flashSaved(); refreshGroup(gid);
      }
    });
  }

  function renderGroup(v, gid) {
    const L = D.ledger(gid);
    v.innerHTML = `
      <div class="rg-group">
        <div class="rg-board rg-gboard" id="rgBoard" tabindex="0" aria-label="Foaia grupei ${esc(D.tabName(L.g))}">${groupTableHTML(L)}</div>
      </div>`;
    const board = v.querySelector('#rgBoard');
    wireBoard(board, { cross: false });
    wireGroup(board, gid);
    markClip(board, gid);
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
      return `<button type="button" class="rg-av is-busy${out ? ' is-out' : ''}" data-d="${d}" data-h="${h}" tabindex="-1" aria-label="${esc(lab)}"><span class="rg-av__t">Ocupat</span><small>${esc(SHORT[g.subject] || g.subject)} ${esc(g.grade)}</small>${out ? '<em aria-hidden="true">!</em>' : ''}</button>`;
    }
    const on = A.on[d].has(h);
    return `<button type="button" class="rg-av${on ? ' is-on' : ''}" data-d="${d}" data-h="${h}" tabindex="${first ? 0 : -1}" aria-pressed="${on}" aria-label="${esc(dn + ' ' + hh(h))}"><span class="rg-av__t">${on ? 'Disponibil' : ''}</span></button>`;
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
    btn.querySelector('.rg-av__t').textContent = on ? 'Disponibil' : '';
    btn.classList.remove('is-pop'); void btn.offsetWidth; btn.classList.add('is-pop');
    return true;
  }

  function commit(note) {
    const o = {};
    D.DAYS.forEach(d => { o[d.id] = toWindows(A.on[d.id]); });
    selfWrite = true;
    try { D.setAvailability(S.tid, o); } finally { selfWrite = false; }
    updateStats();
    flashSaved();
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
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); b.querySelector('.rg-av__t').textContent = on ? 'Disponibil' : '';
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
    const blanks = Math.max(2, 9 - teachRows.length);
    const rows = teachRows.concat(Array.from({ length: blanks }, () => ({ subject: '', grades: [] })));
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
    flashSaved();
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
            <p>Atinge o oră sau trage peste mai multe. <b>Ocupat</b> înseamnă că ai deja o lecție; ce rămâne gol înseamnă că nu poți.</p>
          </div>
          <div class="rg-av-keys">
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
          </section>
          <section class="rg-card rg-card--teach" aria-label="Detalii profesor">
            <div class="rg-teach-h"><h3>Ce predai și pentru ce clase</h3></div>
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

    const loading = document.getElementById('rgLoading');
    if (loading) loading.remove();
    const holder = document.createElement('div');
    holder.innerHTML = shellHTML();
    document.body.prepend(holder.firstElementChild);
    view = document.getElementById('rgView');
    tabsEl = document.getElementById('rgTabs');
    paintTop();
    tabsEl.innerHTML = tabsHTML();
    wireTabArrows();

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
    document.getElementById('rgInbox').addEventListener('click', openInbox);
    document.getElementById('rgTheme').addEventListener('click', e => {
      if (window.BM && BM.toggleTheme) BM.toggleTheme();
      e.currentTarget.innerHTML = ico(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon', 18);
    });
    const picker = document.getElementById('rgTeacher');
    if (picker) picker.addEventListener('change', e => {
      S.tid = e.target.value;
      try { sessionStorage.setItem('bm_rg_teacher', S.tid); } catch (err) {}
      const u = new URL(location.href); u.searchParams.set('t', S.tid); u.hash = 'total';
      history.replaceState(null, '', u);
      S.cur = '';
      paintTop();
      tabsEl.innerHTML = tabsHTML();
      route(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !S.clip || popEl || document.querySelector('.ax-drawer')) return;
      const g = S.clip.gid; S.clip = null;
      if (parseRoute().gid === g) refreshGroup(g);
    });
    window.addEventListener('hashchange', () => route(false));
    window.addEventListener('resize', () => moveBar(false));
    document.fonts && document.fonts.ready.then(() => moveBar(false));

    // the console (another tab) changed the same data: show it
    // (not while a field is being typed in or a menu is open: it waits for that to end)
    let extWait = false;
    const external = () => {
      if (selfWrite || !view) return;
      if (CM.open && popEl) CM.open.refresh();
      const a = document.activeElement;
      const busy = (a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && view.contains(a)) || document.querySelector('.rg-pop, .ax-drawer');
      if (busy) { if (!extWait) { extWait = true; setTimeout(() => { extWait = false; external(); }, 1200); } return; }
      const before = unreadTotal();
      refreshChrome(); route(false);
      if (unreadTotal() > before) U.toast('Ai un comentariu nou în registru.');
    };
    document.addEventListener('bm:demo-external', external);

    route(true);
    document.dispatchEvent(new CustomEvent('rg:ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
