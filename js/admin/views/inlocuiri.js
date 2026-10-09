/* ============================================================
   Admin console: Înlocuiri (docs/inlocuiri.md)
   ============================================================
   Every replacement the platform follows: which group, which teacher took it, on which dates, what the substitute has marked and where the money of
   each lesson is. The money moves by itself (registru-replace); this page only shows it and lets the admin step in:
     - open the substitute's tab in Google Sheets;
     - cancel a lesson that has not been held yet;
     - run the check now, or let a line that gave up try again (after looking at the register).
   Data: AdminData.registry.replacements (js/admin/registry-dataset.js), read again every 30 seconds while the page is open.
   URL: #inlocuiri?f=active|attention|done|all
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData, RP = window.AdminReplacementPlan;
  const { esc, ico, hh } = U;

  const MARK = { P: 'Prezent', A: 'Absent', M: 'Absent motivat', G: 'Prima lecție gratuită', B: 'Absent la lecția gratuită' };
  const PAYS = { P: true, A: true };
  const FILTERS = [['active', 'În lucru'], ['attention', 'De verificat'], ['done', 'Încheiate'], ['all', 'Toate']];
  const money = v => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2, maximumFractionDigits: Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2 }).format(v);
  const plural = (n, one, many) => (n === 1 ? `1 ${one}` : `${n} ${n % 100 >= 1 && n % 100 <= 19 ? many : 'de ' + many}`);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const dayShort = iso => { const d = new Date(iso + 'T12:00:00'); return `${RP.DAY_NAMES[RP.weekday(iso) - 1].slice(0, 3)} ${d.getDate()} ${D.MONTHS[d.getMonth()].slice(0, 3)}`; };
  const dayLong = iso => { const d = new Date(iso + 'T12:00:00'); return `${cap(RP.DAY_NAMES[RP.weekday(iso) - 1])} ${d.getDate()} ${D.MONTHS[d.getMonth()]}`; };
  const reps = () => ((D.registry && D.registry.replacements) || []);
  const today = () => D.todayISO;
  const liveDates = r => r.dates.filter(d => !d.cancelled).sort((a, b) => a.iso.localeCompare(b.iso));
  const tName = id => (D.teacher(id) ? D.teacher(id).name : 'Profesor necunoscut');

  let mount = null, timer = null, loading = false;

  /* ---- what is going on with one replacement ---- */
  function facts(r) {
    const it = r.items, live = liveDates(r), t = today();
    const errors = it.filter(i => i.error), moved = it.filter(i => i.status === 'settled' || i.status === 'rev-new-done' || i.status === 'from-done');
    const settled = it.filter(i => i.status === 'settled');
    const sum = k => Math.round(settled.reduce((s, i) => s + i[k], 0) * 100) / 100;
    const waiting = it.filter(i => i.status === 'pending' || i.status === 'from-done' || i.status === 'rev-new-done');
    const ahead = live.filter(d => d.iso >= t);
    let state;
    if (errors.length) state = { key: 'attention', label: 'De verificat', tone: 'bad' };
    else if (sum('short') > 0) state = { key: 'short', label: 'Bani insuficienți', tone: 'warn' };
    else if (!live.length) state = { key: 'cancelled', label: 'Anulată', tone: 'off' };
    else if (r.status === 'closed') state = { key: 'done', label: 'Încheiată', tone: 'ok' };
    else if (live[0].iso > t) state = { key: 'planned', label: 'Programată', tone: 'swap' };
    else if (!ahead.length && waiting.length) state = { key: 'settling', label: 'Se decontează', tone: 'swap' };
    else if (!ahead.length) state = { key: 'settling', label: 'Se încheie', tone: 'swap' };
    else state = { key: 'live', label: 'În desfășurare', tone: 'swap' };
    return { live, errors, settled, ach: sum('ach'), red: sum('red'), short: sum('short'), moved: moved.length, waiting: waiting.length, ahead, state, attention: errors.length > 0 || sum('short') > 0 };
  }
  const isDone = r => ['done', 'cancelled'].includes(facts(r).state.key);
  const inFilter = (r, f) => f === 'all' || (f === 'attention' ? facts(r).attention : f === 'done' ? isDone(r) : !isDone(r));

  /* ---- the page ---- */
  function statsHTML() {
    const all = reps().map(r => ({ r, f: facts(r) }));
    const open = all.filter(x => !isDone(x.r));
    const ahead = open.reduce((n, x) => n + x.f.ahead.length, 0);
    const movedSum = all.reduce((s, x) => s + x.f.ach + x.f.red, 0);
    const att = all.filter(x => x.f.attention).length;
    const items = [
      { k: 'În lucru', v: open.length, s: open.length ? 'urmărite acum' : 'nicio înlocuire deschisă', icon: 'replace' },
      { k: 'Lecții de ținut', v: ahead, s: ahead ? 'de azi încolo' : 'nicio lecție programată', icon: 'clock' },
      { k: 'Bani mutați', v: money(movedSum) + ' lei', s: 'din registrele grupelor', icon: 'wallet', small: true },
      { k: 'De verificat', v: att, s: att ? 'erori sau bani insuficienți' : 'totul e în regulă', icon: 'alert', warn: att > 0 }
    ];
    return items.map((it, i) => `
      <div class="ax-stat cn-stat${it.warn ? ' is-warn' : ''}" style="--i:${i}">
        <span class="ax-stat__k">${ico(it.icon, 16)} ${esc(it.k)}</span>
        <span class="ax-stat__v${it.small ? ' ri-small' : ''}">${typeof it.v === 'number' ? U.nf.format(it.v) : esc(it.v)}</span>
        <span class="ax-stat__s">${esc(it.s)}</span>
      </div>`).join('');
  }

  function rowHTML(r, i) {
    const f = facts(r), g = r.base ? D.group(r.base) : null, d0 = f.live[0] || r.dates[0];
    const moved = f.ach + f.red;
    const more = f.live.length > 1 ? `<small>+${f.live.length - 1} ${f.live.length - 1 === 1 ? 'lecție' : 'lecții'}</small>` : `<small>${d0 ? hh(d0.start) + '-' + hh(d0.start + d0.duration) : ''}</small>`;
    const who = r.cols.length ? plural(r.cols.length, 'elev', 'elevi') : '';
    return `<li style="--i:${i}"><button type="button" class="ri-row ri-row--${f.state.tone}" data-rep="${esc(r.id)}">
      <span class="ri-when"><b>${d0 ? esc(dayShort(d0.iso)) : 'fără dată'}</b>${more}</span>
      <span class="ri-main"><b>${g ? esc(g.subject) + ', clasa ' + esc(g.grade) : esc(r.tab)}</b><small>${g ? esc(tName(r.baseTeacher)) : 'grupa de bază nu mai există'} <i class="ri-arrow" aria-hidden="true">${ico('arrow-right', 14)}</i> ${esc(tName(r.teacher))}</small></span>
      <span class="ri-who">${esc(who)}</span>
      <span class="ri-money">${moved > 0 ? `<b>${money(moved)} lei</b><small>mutați${f.waiting ? ', ' + f.waiting + ' în așteptare' : ''}</small>` : f.waiting ? `<small>${plural(f.waiting, 'linie', 'linii')} în așteptare</small>` : '<small>nimic mutat încă</small>'}</span>
      <span class="ri-state"><em class="ri-chip ri-chip--${f.state.tone}">${esc(f.state.label)}</em></span>
    </button></li>`;
  }

  function listHTML(filter) {
    if (!D.readOnly()) return `<div class="ax-empty"><b>Înlocuirile merg în modul Registre.</b>Datele demo nu au registre în care să se creeze fila unui profesor. Treci pe <button type="button" class="ax-link" data-registre>Registre</button> din bara de sus.</div>`;
    const all = reps(), shown = all.filter(r => inFilter(r, filter)).sort((a, b) => {
      const fa = facts(a), fb = facts(b), da = (fa.live[0] || a.dates[0] || {}).iso || '', db = (fb.live[0] || b.dates[0] || {}).iso || '';
      return (fb.attention - fa.attention) || (filter === 'done' ? db.localeCompare(da) : da.localeCompare(db));
    });
    if (!all.length) return `<div class="ax-empty"><b>Nicio înlocuire încă.</b>Deschide o grupă din Orar și apasă „Înlocuire”: alegi lecțiile, profesorul și cabinetul, iar fila apare singură în registrul lui.</div>`;
    if (!shown.length) return `<div class="ax-empty"><b>Nimic în această listă.</b>${filter === 'attention' ? 'Nicio înlocuire nu are nevoie de atenție.' : 'Schimbă filtrul de mai sus.'}</div>`;
    return `<ul class="ri-list">${shown.map(rowHTML).join('')}</ul>`;
  }

  function filtersHTML(f) {
    const n = k => reps().filter(r => inFilter(r, k)).length;
    return `<div class="ax-seg ri-seg" role="group" aria-label="Filtru">${FILTERS.map(([k, label]) => `<button type="button" data-f="${k}" aria-pressed="${k === f}">${label}<span class="ri-n">${n(k)}</span></button>`).join('')}</div>`;
  }

  function paint() {
    if (!mount || !mount.root.isConnected) return;
    const f = mount.filter, r = mount.root;
    r.querySelector('#riStats').innerHTML = statsHTML();
    r.querySelector('#riFilters').innerHTML = filtersHTML(f);
    r.querySelector('#riBody').innerHTML = listHTML(f);
    r.querySelector('#riStamp').textContent = mount.loadedAt ? 'Verificat la ' + mount.loadedAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '';
    r.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { mount.filter = b.dataset.f; U.writeQuery({ f: mount.filter === 'active' ? '' : mount.filter }); paint(); }));
    r.querySelectorAll('[data-rep]').forEach(b => b.addEventListener('click', () => openDetail(b.dataset.rep)));
    const go = r.querySelector('[data-registre]');
    if (go) go.addEventListener('click', () => window.AdminRegistry && window.AdminRegistry.setSource('registre'));
  }

  async function reload(quiet) {
    if (loading || !D.readOnly() || !window.AdminRegistry) return;
    loading = true;
    const btn = mount && mount.root.querySelector('#riReload');
    if (btn && !quiet) btn.disabled = true;
    try { await window.AdminRegistry.refreshReplacements(); if (mount) mount.loadedAt = new Date(); } catch (e) { /* the next try */ }
    loading = false;
    if (mount && mount.root.isConnected) { const b = mount.root.querySelector('#riReload'); if (b) b.disabled = false; paint(); }
  }

  /* ---- one replacement: dates, what each student did and where the money is ---- */
  function lessonRowsHTML(r) {
    const rows = r.lessons.filter(l => Object.keys(l.marks).length);
    if (!rows.length) return '<p class="ri-none">Profesorul nu a pus încă nicio prezență în fila lui.</p>';
    return rows.map(l => {
      const lines = r.cols.map(c => {
        const code = l.marks[c.col];
        if (!code) return '';
        const key = (c.phone || '') + '#' + l.row, item = r.items.find(i => i.key === key);
        let money_ = '', tone = '';
        if (!PAYS[code]) money_ = 'nu se mută nimic';
        else if (!item) money_ = 'urmează să se decontaze';
        else if (item.error) { money_ = item.error; tone = 'bad'; }
        else if (item.status === 'settled') { const m = item.ach + item.red; money_ = m > 0 ? `${money(m)} lei mutați${item.short > 0 ? `, lipsesc ${money(item.short)} lei` : ''}` : `nimic mutat, lipsesc ${money(item.short || item.tot)} lei`; tone = item.short > 0 ? 'warn' : 'ok'; }
        else if (item.status === 'reversed') money_ = 'banii s-au întors';
        else money_ = 'se decontează';
        const retry = item && item.error ? `<button type="button" class="ax-btn ax-btn--sm" data-retry="${esc(item.key)}">Reia</button>` : '';
        return `<tr><td class="ri-nm">${esc(c.name)}</td><td>${esc(MARK[code] || code)}</td><td class="ri-m${tone ? ' ri-m--' + tone : ''}">${esc(money_)}</td><td>${retry}</td></tr>`;
      }).join('');
      return `<div class="ri-lesson"><h4>${l.iso ? esc(dayLong(l.iso)) : 'Lecția din rândul ' + l.row}${l.topic ? `<small>${esc(l.topic)}</small>` : ''}</h4>
        <div class="ax-table-wrap"><table class="ax-table ri-t"><thead><tr><th>Elev</th><th>Prezență</th><th>Banii</th><th></th></tr></thead><tbody>${lines}</tbody></table></div></div>`;
    }).join('');
  }

  function datesHTML(r) {
    const t = today();
    return `<ul class="ri-dates">${r.dates.slice().sort((a, b) => a.iso.localeCompare(b.iso)).map(d => {
      const past = d.iso < t;
      return `<li class="${d.cancelled ? 'is-off' : ''}"><span><b>${esc(dayLong(d.iso))}</b> ${hh(d.start)}-${hh(d.start + d.duration)}${d.cabinet ? ', cabinet ' + esc(d.cabinet) : ', online'}</span>
        ${d.cancelled ? '<em class="ri-chip ri-chip--off">Anulată</em>' : past ? '<em class="ri-chip ri-chip--ok">Ținută</em>' : `<span class="ri-cancel" data-cancel-box="${esc(d.iso)}|${d.start}"><button type="button" class="ax-link" data-cancel="${esc(d.iso)}|${d.start}">Anulează lecția</button></span>`}</li>`;
    }).join('')}</ul>`;
  }

  function openDetail(id) {
    const r = reps().find(x => x.id === id);
    if (!r) return;
    const g = r.base ? D.group(r.base) : null, f = facts(r);
    const url = r._src.ssid ? `https://docs.google.com/spreadsheets/d/${r._src.ssid}/edit#gid=${r._src.sheet}` : null;
    const body = `
      <div class="ri-dw">
        <div class="ri-dw__top"><em class="ri-chip ri-chip--${f.state.tone}">${esc(f.state.label)}</em>${g ? `<span class="ax-sub">${esc(g.days.map(d => D.DAYS[d - 1].name).join(' / '))}, ${hh(g.start)}-${hh(g.start + g.duration)}</span>` : ''}</div>
        <dl class="ax-dl">
          <dt>Grupa</dt><dd>${g ? `${esc(g.subject)}, clasa ${esc(g.grade)}${g.profile ? ', ' + esc(g.profile) : ''}<span class="ax-sub">${plural(r.cols.length, 'elev', 'elevi')} în fila de înlocuire</span>` : 'Grupa de bază nu mai există în registre'}</dd>
          <dt>Titular</dt><dd>${esc(tName(r.baseTeacher))}</dd>
          <dt>Înlocuitor</dt><dd>${esc(tName(r.teacher))}<span class="ax-sub">fila „${esc(r.tab)}”</span></dd>
          <dt>Lecție</dt><dd>${money(r.price)} lei<span class="ax-sub">trece din registrul grupei în fila înlocuitorului, la Prezent sau Absent</span></dd>
          <dt>Mutat</dt><dd>${f.ach + f.red > 0 ? `${money(f.ach + f.red)} lei<span class="ax-sub">${money(f.ach)} achitări, ${money(f.red)} reduceri</span>` : 'Nimic încă'}${f.short > 0 ? `<span class="ax-sub ri-warn">Lipsesc ${money(f.short)} lei: elevii nu aveau destui bani în registrul grupei</span>` : ''}</dd>
        </dl>
        ${f.errors.length ? `<p class="ri-errs">${ico('alert', 16)} <span><b>${plural(f.errors.length, 'linie are', 'linii au')} nevoie de verificare.</b> Deschide registrul, vezi dacă banii s-au mutat, apoi apasă „Reia” pe rândul respectiv.</span></p>` : ''}
        <h3 class="ri-h3">Lecții</h3>
        ${datesHTML(r)}
        <h3 class="ri-h3">Prezențe și bani</h3>
        ${lessonRowsHTML(r)}
      </div>`;
    const el = U.drawer({
      title: g ? `Înlocuire: ${esc(g.subject)}, clasa ${esc(g.grade)}` : 'Înlocuire',
      sub: `${esc(tName(r.baseTeacher))} → ${esc(tName(r.teacher))}`,
      body,
      actions: `<button type="button" class="ax-btn" data-check>${ico('refresh-cw', 16)} Verifică acum</button>${url ? `<a class="ax-btn ax-btn--dark" href="${esc(url)}" target="_blank" rel="noopener">${ico('book-open', 16)} Deschide fila</a>` : ''}`
    });
    const reopen = () => { el.close(); setTimeout(() => openDetail(id), 220); };
    el.querySelector('[data-check]').addEventListener('click', async e => {
      const b = e.currentTarget; b.disabled = true; b.innerHTML = `${ico('refresh-cw', 16)} Se verifică…`;
      const out = await window.AdminRegistry.settleReplacements();
      U.toast(out.ok ? 'Prezențele au fost verificate.' : esc(out.msg || 'Nu s-a putut verifica.'), out.ok ? undefined : 'warn');
      reopen();
    });
    el.querySelectorAll('[data-retry]').forEach(b => b.addEventListener('click', async () => {
      if (!window.confirm('Ai verificat în registre că banii acestei lecții NU au fost deja mutați? Dacă s-au mutat, o nouă încercare i-ar muta a doua oară.')) return;
      b.disabled = true;
      const out = await window.AdminRegistry.settleReplacements({ replacement: r.id, key: b.dataset.retry });
      U.toast(out.ok ? 'Încercare nouă pornită.' : esc(out.msg || 'Nu s-a putut relua.'), out.ok ? undefined : 'warn');
      reopen();
    }));
    el.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => {
      const [iso, start] = b.dataset.cancel.split('|'), box = b.parentElement;
      box.innerHTML = `<span class="ri-sure">Sigur?</span> <button type="button" class="ax-btn ax-btn--sm ax-btn--danger" data-yes>Da, anulează</button> <button type="button" class="ax-btn ax-btn--sm" data-no>Nu</button>`;
      box.querySelector('[data-no]').addEventListener('click', () => { box.innerHTML = `<button type="button" class="ax-link" data-cancel="${esc(iso)}|${start}">Anulează lecția</button>`; });
      box.querySelector('[data-yes]').addEventListener('click', async e => {
        e.currentTarget.disabled = true;
        const out = await window.AdminRegistry.cancelReplacement(r.id, iso, +start);
        U.toast(out.ok ? 'Lecția a fost anulată.' : esc(out.msg || 'Nu s-a putut anula.'), out.ok ? undefined : 'warn');
        if (out.ok) reopen(); else reopen();
      });
    }));
  }

  window.AdminViews.inlocuiri = {
    title: 'Înlocuiri',
    demo: false,
    icon: 'replace',
    openDetail,
    badge: () => { const n = reps().filter(r => facts(r).attention).length; return n || null; },
    render(root, ctx) {
      const q = (ctx && ctx.query) || {};
      mount = { root, filter: FILTERS.some(([k]) => k === q.f) ? q.f : 'active', loadedAt: null };
      root.innerHTML = `
        <header class="ax-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('replace', 24)}</span>
            <div>
              <h1 class="ax-h1">Înlocuiri</h1>
              <p class="ax-lede">Lecțiile ținute de alt profesor: fila lui din registru, prezențele puse și banii care trec singuri din grupa de bază.</p>
            </div>
          </div>
          <div class="ax-head__keys"><button type="button" class="ax-btn" id="riReload">${ico('refresh-cw', 16)} Reîncarcă</button></div>
        </header>
        <section class="ax-stats cn-stats" id="riStats" aria-label="Pe scurt"></section>
        <div class="ri-bar"><div id="riFilters"></div><span class="ax-sub" id="riStamp"></span></div>
        <div id="riBody" aria-live="polite"></div>`;
      root.querySelector('#riReload').addEventListener('click', () => reload(false));
      paint();
      if (D.readOnly()) reload(true);
      clearInterval(timer);
      timer = setInterval(() => {
        if (!mount || !mount.root.isConnected) { clearInterval(timer); return; }
        const a = document.activeElement;
        if (document.hidden || document.querySelector('.ax-drawer, dialog[open]') || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
        reload(true);
      }, 30000);
    }
  };
})();
