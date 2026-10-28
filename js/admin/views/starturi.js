/* ============================================================
   Admin console: Starturi (groups that have enough students to start)
   ============================================================
   A group turns into "Startează" by itself when enough students are enrolled (js/admin/..., supabase/functions/_shared/registru/start-rule.mjs). The Telegram bot then
   asks the group's teacher "Do you confirm the start?" (supabase/functions/telegram-bot). What he answers shows up here:
     De sunat              the teacher confirmed: the manager calls the students to invite them to the trial lesson, then marks it done;
     Așteaptă profesorul   the question is sent (or waits for 08:00, or the teacher has no Telegram tied: then the manager calls him);
     Nu s-a confirmat      the teacher said no and gave the reason; the manager reads it and marks it seen;
     Rezolvate             what was handled, and the requests that stopped mattering (the group changed status).
   Data: group_start_requests, reg_workbooks (teacher), telegram_links, reg_students (admins read all; RLS). URL: #starturi
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI;
  const { esc, ico } = U;

  const DAYS = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];
  const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
  const COUNTS = { 'activ': 1, 'ora de proba': 1, 'ora de proba confirmata': 1 };
  const plain = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  let C = { status: 'idle', items: [] };
  let mount = null, timer = null, badgeTimer = null, badgeN = null;

  const pad = n => String(n).padStart(2, '0');
  function when(schedule) {
    const by = new Map();
    (Array.isArray(schedule) ? schedule : []).forEach(r => {
      const d = Number(r && r.day), h = Number(r && r.hour);
      if (!(d >= 1 && d <= 7) || !Number.isFinite(h)) return;
      const x = by.get(d) || { h0: h, n: 0 };
      x.h0 = Math.min(x.h0, h); x.n++; by.set(d, x);
    });
    if (!by.size) return '';
    const days = [...by.keys()].sort((a, b) => a - b), f = by.get(days[0]);
    const names = days.map(d => DAYS[d - 1]);
    return (names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' și ' + names[names.length - 1]) + ', ' + pad(f.h0) + ':00 - ' + pad(f.h0 + f.n) + ':00';
  }
  const grade = g => { const n = ROMAN[String(g || '').trim().toUpperCase()]; return n ? 'clasa a ' + n + '-a' : (g ? 'clasa ' + g : ''); };
  function ago(iso) {
    if (!iso) return '';
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 90) return 'acum';
    if (s < 3600) return 'acum ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'acum ' + Math.round(s / 3600) + ' ore';
    return 'acum ' + Math.round(s / 86400) + ' zile';
  }
  const sb = () => window.BMAuth && window.BMAuth.supabase;

  function bucketOf(x) {
    const r = x.r;
    if (r.status === 'confirmed') return r.manager_done_at ? 'done' : 'call';
    if (r.status === 'declined') return r.manager_done_at ? 'done' : 'declined';
    if (r.status === 'cancelled') return 'done';
    return 'waiting';                                  // pending, awaiting_reason
  }
  function countOpen(items) { return items.filter(x => { const b = bucketOf(x); return b === 'call' || b === 'declined'; }).length; }

  async function fetchItems() {
    const c = sb();
    if (!c) throw new Error('Nu există o sesiune activă.');
    const rq = await c.from('group_start_requests').select('*').order('created_at', { ascending: false }).limit(150);
    if (rq.error) throw rq.error;
    const reqs = rq.data || [];
    if (!reqs.length) return [];
    const wids = [...new Set(reqs.map(r => r.workbook_id))], gids = reqs.map(r => r.group_id).filter(Boolean);
    const [ws, ls, ss] = await Promise.all([
      c.from('reg_workbooks').select('id, teacher_name, owner_user_id, spreadsheet_id').in('id', wids),
      c.from('telegram_links').select('user_id'),
      gids.length ? c.from('reg_students').select('group_id, col, name, phone, status, manager').in('group_id', gids).order('col', { ascending: true }) : Promise.resolve({ data: [] })
    ]);
    const wb = new Map((ws.data || []).map(w => [w.id, w]));
    const linked = new Set((ls.data || []).map(l => l.user_id));
    const studs = new Map();
    (ss.data || []).forEach(s => { (studs.get(s.group_id) || studs.set(s.group_id, []).get(s.group_id)).push(s); });
    return reqs.map(r => {
      const w = wb.get(r.workbook_id) || {};
      return { r, teacher: w.teacher_name || 'Profesor', sheetUrl: w.spreadsheet_id ? 'https://docs.google.com/spreadsheets/d/' + w.spreadsheet_id + '/edit#gid=' + r.sheet_id : null, hasTelegram: !!(w.owner_user_id && linked.has(w.owner_user_id)), students: (studs.get(r.group_id) || []).filter(s => COUNTS[plain(s.status)]) };
    });
  }

  async function mark(id, what) {
    try {
      const { error } = await sb().rpc('start_request_mark', { p_id: id, p_what: what });
      if (error) throw error;
      await load(true);
    } catch (e) { U.toast('Nu am putut salva: ' + esc((e && e.message) || e), 'warn'); }
  }

  /* ---- drawing ---- */
  function head(x) {
    const r = x.r;
    return `<div class="st-card__h">
      <div class="st-card__t"><b>${esc(r.subject || 'Grupă')}${r.grade ? `, ${esc(grade(r.grade))}` : ''}</b><span class="ax-sub">${esc(when(r.schedule) || r.tab || '')}</span></div>
      <div class="st-card__who">${ico('user', 14)} ${esc(x.teacher)}</div>
    </div>`;
  }
  function studentsHTML(x) {
    if (!x.students.length) return '<p class="st-note">Nu am găsit elevii înscriși în registru.</p>';
    return `<div class="ax-table-wrap"><table class="ax-table st-tbl">
      <thead><tr><th scope="col">Elev</th><th scope="col">Telefon</th><th scope="col">Statut</th><th scope="col">Manager</th></tr></thead>
      <tbody>${x.students.map(s => `<tr><td><span class="ax-strong">${esc(s.name)}</span></td>
        <td>${s.phone ? `<a class="st-tel" href="tel:${esc(String(s.phone).replace(/[^+\d]/g, ''))}">${esc(s.phone)}</a>` : '<span class="ax-sub">fără telefon</span>'}</td>
        <td>${esc(s.status || '')}</td><td>${esc(s.manager || '')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function cardHTML(x, b) {
    const r = x.r;
    let body = '', foot = '';
    if (b === 'call') {
      body = `<p class="st-line"><span class="ax-st ax-st--activ"><i class="ax-st__i" aria-hidden="true"></i>Confirmat de profesor</span> <span class="ax-sub">${esc(ago(r.decided_at))}</span></p>
        <p class="st-note">Sună elevii și invită-i la prima lecție, cea de probă.</p>${studentsHTML(x)}`;
      foot = `<button type="button" class="ax-btn ax-btn--primary" data-mark="done" data-id="${r.id}">${ico('circle-check', 16)} Am sunat elevii</button>`;
    } else if (b === 'declined') {
      body = `<p class="st-line"><span class="ax-st ax-st--inactiv"><i class="ax-st__i" aria-hidden="true"></i>Profesorul nu a confirmat startul</span> <span class="ax-sub">${esc(ago(r.decided_at))}</span></p>
        <blockquote class="st-quote">${r.reason ? esc(r.reason) : 'Fără motiv scris.'}</blockquote>`;
      foot = `<button type="button" class="ax-btn" data-mark="done" data-id="${r.id}">${ico('circle-check', 16)} Am văzut</button>`;
    } else if (b === 'waiting') {
      let line;
      if (r.status === 'awaiting_reason') line = 'Profesorul a ales să nu confirme și urmează să scrie motivul.';
      else if (r.notified_at) line = `Întrebarea a fost trimisă în Telegram ${ago(r.notified_at)}. Profesorul nu a răspuns încă.`;
      else if (!x.hasTelegram) line = 'Profesorul nu are Telegram conectat, deci botul nu îl poate întreba. Sună-l tu pentru confirmare.';
      else if (r.notify_error) line = 'Botul nu a reușit să trimită întrebarea: ' + r.notify_error;
      else line = 'Întrebarea se trimite în câteva momente (botul scrie între 08:00 și 21:00).';
      body = `<p class="st-line"><span class="ax-st ax-st--completare"><i class="ax-st__i" aria-hidden="true"></i>Așteaptă profesorul</span> <span class="ax-sub">grupa a trecut în Startează ${esc(ago(r.created_at))}</span></p><p class="st-note">${esc(line)}</p>`;
    } else {
      const what = r.status === 'confirmed' ? 'Confirmat de profesor, elevii au fost sunați' : r.status === 'declined' ? 'Neconfirmat' + (r.reason ? ': ' + r.reason : '') : 'Anulat: grupa și-a schimbat statutul';
      body = `<p class="st-line">${esc(what)} <span class="ax-sub">${esc(ago(r.manager_done_at || r.decided_at || r.created_at))}</span></p>`;
      foot = r.status !== 'cancelled' ? `<button type="button" class="ax-btn ax-btn--sm" data-mark="reopen" data-id="${r.id}">Redeschide</button>` : '';
    }
    const sheet = x.sheetUrl ? `<a class="ax-btn ax-btn--sm st-sheet" href="${esc(x.sheetUrl)}" target="_blank" rel="noopener" title="Deschide fila grupei în registrul profesorului, în Google Sheets">${ico('book-open', 16)} Deschide în Sheets</a>` : '';
    const actions = [foot, sheet].filter(Boolean).join('');
    return `<article class="st-card st-card--${b}">${head(x)}<div class="st-card__b">${body}</div>${actions ? `<div class="st-card__f">${actions}</div>` : ''}</article>`;
  }
  function section(title, id, list, empty) {
    return `<section class="st-sec" aria-labelledby="${id}">
      <h2 class="st-sec__h" id="${id}">${esc(title)} <span class="st-sec__n${list.length ? '' : ' is-zero'}">${list.length}</span></h2>
      ${list.length ? list.map(x => cardHTML(x, bucketOf(x))).join('') : `<p class="st-empty">${esc(empty)}</p>`}
    </section>`;
  }

  function paint() {
    if (!mount) return;
    const body = mount.root.querySelector('#stBody'), stamp = mount.root.querySelector('#stStamp');
    if (!body) return;
    if (C.status === 'loading' && !C.items.length) { body.innerHTML = '<p class="st-note">Se încarcă…</p>'; return; }
    if (C.status === 'error') { body.innerHTML = `<p class="st-note st-note--bad">${esc(C.error)}</p>`; return; }
    const by = { call: [], waiting: [], declined: [], done: [] };
    C.items.forEach(x => by[bucketOf(x)].push(x));
    by.call.sort((a, b) => String(b.r.decided_at || '').localeCompare(String(a.r.decided_at || '')));
    body.innerHTML = `
      ${section('De sunat', 'stCall', by.call, 'Niciun grup confirmat de așteptat. Când un profesor confirmă startul, apare aici cu elevii de sunat.')}
      ${section('Așteaptă profesorul', 'stWait', by.waiting, 'Nicio grupă nu așteaptă un răspuns.')}
      ${section('Nu s-a confirmat', 'stNo', by.declined, 'Niciun profesor nu a refuzat startul.')}
      <details class="st-done"><summary>Rezolvate <span class="st-sec__n${by.done.length ? '' : ' is-zero'}">${by.done.length}</span></summary>${by.done.length ? by.done.slice(0, 40).map(x => cardHTML(x, 'done')).join('') : '<p class="st-empty">Nimic încă.</p>'}</details>`;
    if (stamp) stamp.textContent = 'Citit la ' + new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    body.querySelectorAll('[data-mark]').forEach(b => b.addEventListener('click', () => { b.disabled = true; mark(b.dataset.id, b.dataset.mark); }));
  }

  async function load(quiet) {
    if (!quiet && !C.items.length) { C.status = 'loading'; paint(); }
    try {
      C.items = await fetchItems();
      C.status = 'ready';
      setBadge(countOpen(C.items));
    } catch (e) {
      const m = String((e && e.message) || e || '');
      C.status = 'error';
      C.error = /relation|does not exist|schema cache/i.test(m) ? 'Tabelul cu starturi nu există încă: rulează migrarea 20261029120000_telegram_starturi.sql.' : 'Nu am putut citi starturile: ' + m.slice(0, 200);
    }
    paint();
  }

  /* the number on the "Starturi" key of the sign panel: the groups waiting for the manager (confirmed, to call, or refused, to read) */
  function setBadge(n) {
    badgeN = n || null;
    const a = document.querySelector('[data-route="starturi"]');
    if (!a) return;
    let el = a.querySelector('.ax-nav__n');
    if (!badgeN) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('span'); el.className = 'ax-nav__n'; a.insertBefore(el, a.querySelector('.ax-nav__arrow')); }
    el.textContent = String(badgeN);
    el.setAttribute('aria-label', badgeN + ' de rezolvat');
  }
  function startBadgePoll() {
    if (badgeTimer || !sb()) return;
    const tick = async () => { if (document.hidden) return; try { setBadge(countOpen(await fetchItems())); } catch (e) { /* the page shows the error when it is opened */ } };
    setTimeout(tick, 1500);
    badgeTimer = setInterval(tick, 60000);
  }
  document.addEventListener('bmauth:ready', startBadgePoll);
  if (window._bmAuthReady) startBadgePoll();

  window.AdminViews.starturi = {
    title: 'Starturi',
    demo: false,
    icon: 'rocket',
    badge: () => badgeN,
    render(root) {
      mount = { root };
      if (timer) { clearInterval(timer); timer = null; }
      root.innerHTML = `
        <header class="ax-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('rocket', 24)}</span>
            <div>
              <h1 class="ax-h1">Starturi</h1>
              <p class="ax-lede">Grupele care au destui elevi ca să înceapă. Botul de Telegram întreabă profesorul dacă confirmă startul; ce răspunde apare aici, iar tu suni elevii pentru prima lecție.</p>
            </div>
          </div>
          <div class="ax-head__keys"><button type="button" class="ax-btn ax-btn--sm" id="stReload">${ico('refresh-cw', 16)} Reîncarcă</button></div>
        </header>
        <div class="st-bar"><span class="ax-sub" id="stStamp"></span></div>
        <div id="stBody" aria-live="polite"></div>`;
      root.querySelector('#stReload').addEventListener('click', () => load(false));
      paint();
      load(true);
      timer = setInterval(() => { if (!document.hidden && document.getElementById('stBody')) load(true); else if (!document.getElementById('stBody')) { clearInterval(timer); timer = null; } }, 20000);
    }
  };
})();
