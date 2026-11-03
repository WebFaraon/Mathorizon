/* ============================================================
   Admin console: Schimbări (lessons a teacher cancelled, moved or added outside the schedule)
   ============================================================
   A teacher changes ONE lesson from the class header ("Modifică lecțiile"): cancels it (and says why), moves it, adds an extra one, or undoes one of those.
   Each of these is written to a journal (lesson_change_events) the moment it is saved. Here the managers read it.
   Who sees what (decided with the founder): the admin sees every change; a manager sees the changes of the groups where one of the enrolled students
   has THAT manager written in the register (a group of 6 students with 6 different managers reaches all 6; a group with one manager reaches that one).
   Each person has their own "Văzut". There is no approval: the teacher agrees the change with the students, the managers are only told.
   Data: rpc lesson_changes_feed / lesson_changes_unseen / lesson_changes_mark (migration 20261104100000_schimbari_lectii_manageri.sql). URL: #schimbari
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI;
  const { esc, ico } = U;

  const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
  const grade = g => { const n = ROMAN[String(g || '').trim().toUpperCase()]; return n ? 'clasa a ' + n + '-a' : (g ? 'clasa ' + g : ''); };
  /* the times are wall-clock Chisinau strings ("2026-11-10T15:00:00"), read and shown as they are */
  const wall = s => { const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null; };
  const wallDay = s => { const d = wall(s); return d ? d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }) : ''; };
  const wallHM = s => { const d = wall(s); return d ? d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : ''; };
  const full = s => wallDay(s) + ', ' + wallHM(s);
  const nowWall = () => { const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Chisinau', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).replace(' ', 'T'); return wall(p); };
  const hoursWord = n => (n === 1 ? '1 oră' : n + ' ore');
  function ago(iso) {
    if (!iso) return '';
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 90) return 'acum';
    if (s < 3600) return 'acum ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'acum ' + Math.round(s / 3600) + ' ore';
    return 'acum ' + Math.round(s / 86400) + ' zile';
  }
  const sb = () => window.BMAuth && window.BMAuth.supabase;

  const KIND = {
    cancelled: { label: 'Lecție anulată', tone: 'bad' },
    moved: { label: 'Lecție mutată', tone: 'warn' },
    extra: { label: 'Lecție în plus', tone: 'ok' },
    restored: { label: 'Revenire la program', tone: 'none' },
    extra_removed: { label: 'Lecție în plus ștearsă', tone: 'none' }
  };

  let C = { status: 'idle', items: [], error: '' };
  let mount = null, timer = null, badgeTimer = null, badgeN = null;
  const openSec = { scNew: true, scSeen: false };

  async function fetchItems() {
    const c = sb();
    if (!c) throw new Error('Nu există o sesiune activă.');
    const { data, error } = await c.rpc('lesson_changes_feed', { p_limit: 150 });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  /* the lesson that is close: the change touches a lesson that starts in the next 24 hours (the manager may still have to tell someone) */
  function urgent(e) {
    const now = nowWall();
    const t = [e.orig_start, e.new_start].filter(Boolean).map(wall).filter(Boolean);
    return !e.seen && t.some(d => d >= now && d - now <= 86400000);
  }

  function whatHTML(e) {
    const hrs = e.hours ? ` (${hoursWord(e.hours)})` : '';
    if (e.kind === 'cancelled') return `Lecția de ${esc(full(e.orig_start))} nu se mai ține.`;
    if (e.kind === 'moved') return `Din ${esc(full(e.orig_start))} în ${esc(full(e.new_start))}${esc(hrs)}.`;
    if (e.kind === 'extra') return `${esc(full(e.new_start))}${esc(hrs)}, în afara programului.`;
    if (e.kind === 'restored') return `Lecția de ${esc(full(e.orig_start))} se ține din nou la ora obișnuită${e.new_start ? '; mutarea la ' + esc(full(e.new_start)) + ' nu mai e valabilă' : ''}.`;
    return `Lecția în plus de ${esc(full(e.new_start))} nu se mai ține.`;
  }

  function cardHTML(e) {
    const k = KIND[e.kind] || { label: e.kind, tone: 'none' };
    const sub = [e.level ? 'Nivel ' + e.level : '', e.mode ? (e.mode === 'online' ? 'Online' : 'Offline') : ''].filter(Boolean).join(' · ');
    const isAdmin = !(window.AdminAccess && window.AdminAccess.manager);
    const names = Array.isArray(e.students) ? e.students : [];
    const who = names.length ? `<p class="st-note sc-students"><b>${isAdmin ? 'Elevi înscriși' : 'Elevii tăi din grupă'}:</b> ${esc(names.join(', '))}</p>` : '';
    const hot = urgent(e) ? '<span class="sc-hot">Urgent: lecția e în următoarele 24 de ore</span>' : '';
    return `<article class="st-card sc-card sc-card--${k.tone}${e.seen ? ' is-seen' : ''}">
      <div class="st-card__h">
        <div class="st-card__t"><b>${esc(e.subject || 'Grupă')}${e.grade ? `, ${esc(grade(e.grade))}` : ''}</b><span class="ax-sub">${esc(sub)}</span></div>
        <div class="st-card__who">${ico('user', 14)} ${esc(e.teacher_name || 'Profesor')}</div>
      </div>
      <div class="st-card__b">
        <p class="st-line"><span class="sc-kind sc-kind--${k.tone}"><i aria-hidden="true"></i>${esc(k.label)}</span> <span class="ax-sub">${esc(ago(e.created_at))}</span> ${hot}</p>
        <p class="sc-what">${whatHTML(e)}</p>
        ${e.kind === 'cancelled' ? `<blockquote class="st-quote">${e.reason ? esc(e.reason) : 'Fără motiv scris.'}</blockquote>` : ''}
        ${who}
      </div>
      ${e.seen ? '' : `<div class="st-card__f"><button type="button" class="ax-btn ax-btn--primary" data-seen="${e.id}">${ico('circle-check', 16)} Am văzut</button></div>`}
    </article>`;
  }

  function section(title, id, list, empty, cap2) {
    const cards = list.slice(0, cap2 || list.length).map(cardHTML).join('');
    return `<details class="st-sec" id="${id}"${openSec[id] ? ' open' : ''}>
      <summary class="st-sec__h"><span class="st-sec__t">${esc(title)}</span><span class="st-sec__n${list.length ? '' : ' is-zero'}">${list.length}</span><span class="st-sec__c" aria-hidden="true">${ico('chevron-down', 18)}</span></summary>
      <div class="st-sec__b">${list.length ? cards : `<p class="st-empty">${esc(empty)}</p>`}</div>
    </details>`;
  }

  async function mark(ids) {
    try {
      const { error } = await sb().rpc('lesson_changes_mark', { p_ids: ids });
      if (error) throw error;
      await load(true);
    } catch (e) { U.toast('Nu am putut salva: ' + esc((e && e.message) || e), 'warn'); }
  }

  function paint() {
    if (!mount) return;
    const body = mount.root.querySelector('#scBody'), stamp = mount.root.querySelector('#scStamp'), all = mount.root.querySelector('#scAll');
    if (!body) return;
    if (C.status === 'loading' && !C.items.length) { body.innerHTML = '<p class="st-note">Se încarcă…</p>'; return; }
    if (C.status === 'error') { body.innerHTML = `<p class="st-note st-note--bad">${esc(C.error)}</p>`; return; }
    const fresh = C.items.filter(e => !e.seen).sort((a, b) => (urgent(b) - urgent(a)) || String(b.created_at).localeCompare(String(a.created_at)));
    const old = C.items.filter(e => e.seen);
    body.innerHTML = `
      ${section('Noi', 'scNew', fresh, 'Nicio schimbare nouă.')}
      ${section('Văzute', 'scSeen', old, 'Nimic văzut încă.', 40)}`;
    body.querySelectorAll('details.st-sec').forEach(d => d.addEventListener('toggle', () => { openSec[d.id] = d.open; }));
    body.querySelectorAll('[data-seen]').forEach(b => b.addEventListener('click', () => { b.disabled = true; mark([b.dataset.seen]); }));
    if (all) all.hidden = !fresh.length;
    if (stamp) stamp.textContent = 'Citit la ' + new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }

  async function load(quiet) {
    if (!quiet && !C.items.length) { C.status = 'loading'; paint(); }
    try {
      C.items = await fetchItems();
      C.status = 'ready';
      setBadge(C.items.filter(e => !e.seen).length);
    } catch (e) {
      const m = String((e && e.message) || e || '');
      C.status = 'error';
      C.error = /function|does not exist|schema cache|relation/i.test(m) ? 'Jurnalul schimbărilor nu există încă: rulează migrarea 20261104100000_schimbari_lectii_manageri.sql.' : 'Nu am putut citi schimbările: ' + m.slice(0, 200);
    }
    paint();
  }

  /* the number on the "Schimbări" key of the sign panel: what this person has not seen yet */
  function setBadge(n) {
    badgeN = n || null;
    const a = document.querySelector('[data-route="schimbari"]');
    if (!a) return;
    let el = a.querySelector('.ax-nav__n');
    if (!badgeN) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('span'); el.className = 'ax-nav__n'; a.insertBefore(el, a.querySelector('.ax-nav__arrow')); }
    el.textContent = String(badgeN);
    el.setAttribute('aria-label', badgeN + ' de văzut');
  }
  function startBadgePoll() {
    if (badgeTimer || !sb()) return;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const { data, error } = await sb().rpc('lesson_changes_unseen');
        if (!error && typeof data === 'number') setBadge(data);
      } catch (e) { /* the page shows the error when it is opened */ }
    };
    setTimeout(tick, 1800);
    badgeTimer = setInterval(tick, 60000);
  }
  document.addEventListener('bmauth:ready', startBadgePoll);
  if (window._bmAuthReady) startBadgePoll();

  window.AdminViews.schimbari = {
    title: 'Schimbări',
    demo: false,
    icon: 'calendar',
    badge: () => badgeN,
    render(root) {
      mount = { root };
      if (timer) { clearInterval(timer); timer = null; }
      root.innerHTML = `
        <header class="ax-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('calendar', 24)}</span>
            <div>
              <h1 class="ax-h1">Schimbări</h1>
              <p class="ax-sub">Lecții anulate, mutate sau în plus, la grupele cu elevii tăi.</p>
            </div>
          </div>
          <div class="ax-head__keys">
            <button type="button" class="ax-btn ax-btn--sm" id="scAll" hidden>${ico('circle-check', 16)} Marchează tot ca văzut</button>
            <button type="button" class="ax-btn ax-btn--sm" id="scReload">${ico('refresh-cw', 16)} Reîncarcă</button>
          </div>
        </header>
        <div class="st-bar"><span class="ax-sub" id="scStamp"></span></div>
        <div id="scBody" aria-live="polite"></div>`;
      root.querySelector('#scReload').addEventListener('click', () => load(false));
      root.querySelector('#scAll').addEventListener('click', () => mark(null));
      paint();
      load(true);
      timer = setInterval(() => { if (!document.hidden && document.getElementById('scBody')) load(true); else if (!document.getElementById('scBody')) { clearInterval(timer); timer = null; } }, 30000);
    }
  };
})();
