/* ============================================================
   Admin console: Profil (the person who is signed in: a manager or the admin)
   ============================================================
   Three blocks: the account (the name shown in the console and the official name from the registers, which only the admin changes), Telegram
   (connect and disconnect, the same one-time code as the teacher's profile) and, for a manager, a few numbers about their own students.
   Data: auth.updateUser (the name shown), sync_own_profile_identity, telegram_bot / telegram_links, telegram_link_code, telegram_unlink,
   manager_my_stats (migration 20261105100000_profil_manager.sql). URL: #profil
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI;
  const { esc, ico, nf } = U;
  const sb = () => window.BMAuth && window.BMAuth.supabase;
  const isMgr = () => !!(window.AdminAccess && window.AdminAccess.manager);

  function initials(name) {
    const p = String(name || '').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }

  let stats = { status: 'idle', data: null, error: '' };
  let tgPoll = null;
  const stopPoll = () => { if (tgPoll) { clearInterval(tgPoll); tgPoll = null; } };

  /* ---- the account ---- */
  function accountHTML(a) {
    const name = a.displayName(), email = (a.user && a.user.email) || '';
    const role = isMgr() ? 'Manager' : 'Administrator';
    return `<section class="pr-card" aria-labelledby="prAccT">
      <h2 class="pr-h" id="prAccT">Contul tău</h2>
      <div class="pr-who">
        <span class="pr-avatar" id="prAvatar" aria-hidden="true">${esc(initials(name))}</span>
        <div><b id="prWho">${esc(name)}</b><span class="ax-sub">${esc(role)}${email ? ' · ' + esc(email) : ''}</span></div>
      </div>
      <form class="pr-form" id="prNameForm" novalidate>
        <label class="pr-f"><span>Numele afișat</span><input class="ax-input" id="prName" name="name" maxlength="80" autocomplete="name" value="${esc(name)}"></label>
        <p class="pr-note">Așa te vede platforma, în meniu și în salut. Nu schimbă numele din registre.</p>
        <div class="pr-err" id="prNameErr" role="alert"></div>
        <div class="pr-keys"><button type="submit" class="ax-btn ax-btn--primary" id="prNameSave">${ico('check', 16)} Salvează numele</button></div>
      </form>
      <div class="pr-official" id="prOfficial"></div>
    </section>`;
  }

  function officialHTML() {
    if (!isMgr()) return '';
    if (stats.status === 'loading' || stats.status === 'idle') return '<p class="pr-note">Se citește numele oficial…</p>';
    const n = stats.data && stats.data.official_name;
    if (stats.status === 'error' || stats.data === null) return '<p class="pr-note">Nu am putut citi numele oficial.</p>';
    return `<div class="pr-f pr-f--ro"><span>Numele oficial, din registre</span><b>${n ? esc(n) : 'Încă nesetat'}</b></div>
      <p class="pr-note">${n ? 'Elevii înscriși de tine apar în registre cu acest nume. Îl schimbă doar administratorul, ca să nu se rupă legătura cu ei: scrie-i dacă trebuie corectat.' : 'Administratorul îl pune la aprobarea contului. Până atunci nu apar elevii și schimbările tale.'}</p>`;
  }

  async function saveName(root) {
    const input = root.querySelector('#prName'), err = root.querySelector('#prNameErr'), btn = root.querySelector('#prNameSave');
    const v = input.value.replace(/\s+/g, ' ').trim();
    err.textContent = '';
    if (v.length < 3) { err.textContent = 'Scrie numele întreg (cel puțin 3 litere).'; input.focus(); return; }
    btn.disabled = true;
    try {
      const { error } = await sb().auth.updateUser({ data: { full_name: v } });
      if (error) throw error;
      try { await sb().rpc('sync_own_profile_identity', { p_display_name: v, p_avatar_url: window.BMAuth.avatarUrl ? window.BMAuth.avatarUrl() : null }); } catch (e) { /* the sign-in sync does it next time */ }
      root.querySelector('#prWho').textContent = v;
      root.querySelector('#prAvatar').textContent = initials(v);
      const side = document.querySelector('.ax-sign__user b'), av = document.querySelector('.ax-sign__avatar');
      if (side) side.textContent = v;
      if (av) av.textContent = initials(v);
      input.value = v;
      U.toast('Numele a fost salvat.', 'ok');
    } catch (e) {
      err.textContent = 'Nu am putut salva numele: ' + String((e && e.message) || e).slice(0, 160);
    }
    btn.disabled = false;
  }

  /* ---- Telegram ---- */
  function telegramHTML() {
    return `<section class="pr-card" id="prTelegram" aria-labelledby="prTgT">
      <h2 class="pr-h" id="prTgT">Telegram</h2>
      <p class="pr-note" id="tgNote">Se verifică…</p>
      <div id="tgBox"></div>
    </section>`;
  }

  async function wireTelegram(root) {
    const note = root.querySelector('#tgNote'), box = root.querySelector('#tgBox');
    if (!note || !box) return;
    const c = sb(), uid = window.BMAuth.user && window.BMAuth.user.id;
    const mgr = isMgr();
    const state = async () => {
      const [b, l] = await Promise.all([
        c.from('telegram_bot').select('username').eq('id', 1).maybeSingle(),
        c.from('telegram_links').select('username, linked_at').eq('user_id', uid).maybeSingle()
      ]);
      return { bot: b.error ? null : (b.data && b.data.username) || null, link: l.error ? null : l.data || null, missing: !!(b.error || l.error) };
    };
    const what = mgr ? 'Botul recunoaște contul tău de manager. Comenzile și alertele pentru manageri nu sunt pornite încă, deocamdată nu primești nimic acolo.' : 'Botul recunoaște contul tău.';
    const paint = async () => {
      stopPoll();
      if (!root.contains(note)) return;
      let s;
      try { s = await state(); } catch (e) { s = { missing: true }; }
      if (!s.bot || s.missing) {
        note.textContent = 'Botul de Telegram nu e pornit încă. Când e gata, apare aici butonul de conectare.';
        box.innerHTML = '';
        return;
      }
      if (s.link) {
        note.textContent = 'Telegram e conectat' + (s.link.username ? ' (@' + s.link.username + ')' : '') + '. ' + what;
        box.innerHTML = `<div class="pr-keys"><button type="button" class="ax-btn" id="tgOff">Deconectează Telegram</button></div>`;
        box.querySelector('#tgOff').addEventListener('click', async e => {
          e.currentTarget.disabled = true;
          try { await c.rpc('telegram_unlink'); } catch (err) { /* shown again below */ }
          paint();
        });
        return;
      }
      note.textContent = 'Conectează Telegram: apeși butonul, se deschide botul, apeși Start și contul e legat.';
      box.innerHTML = `<div class="pr-keys"><button type="button" class="ax-btn ax-btn--primary" id="tgOn">${ico('message-circle', 16)} Conectează Telegram</button></div><p class="pr-note" id="tgHow" hidden></p>`;
      box.querySelector('#tgOn').addEventListener('click', async e => {
        const btn = e.currentTarget; btn.disabled = true;
        const how = box.querySelector('#tgHow');
        try {
          const { data, error } = await c.rpc('telegram_link_code');
          if (error || !data) throw error || new Error('cod');
          const url = 'https://t.me/' + encodeURIComponent(s.bot) + '?start=' + encodeURIComponent(data);
          window.open(url, '_blank', 'noopener');
          how.hidden = false;
          how.innerHTML = 'Am deschis Telegram. Apasă <b>Start</b> acolo. Dacă nu s-a deschis, <a class="pr-link" href="' + esc(url) + '" target="_blank" rel="noopener">folosește acest link</a> (ține 15 minute).';
          const until = Date.now() + 15 * 60 * 1000;
          tgPoll = setInterval(async () => {
            if (Date.now() > until || !root.contains(note)) { stopPoll(); btn.disabled = false; return; }
            try { const x = await state(); if (x.link) paint(); } catch (err) { /* the next try */ }
          }, 3000);
        } catch (err) {
          btn.disabled = false;
          how.hidden = false;
          how.textContent = /Doar profesorii|not authorized|42501/i.test(String((err && err.message) || '')) ? 'Contul tău nu poate conecta Telegram încă: rulează migrarea 20261105100000_profil_manager.sql sau cere administratorului.' : 'Nu am putut face codul. Încearcă din nou peste câteva secunde.';
        }
      });
    };
    paint();
  }

  /* ---- numbers about the manager's own students ---- */
  function statsHTML() {
    if (!isMgr()) return '';
    const d = stats.data;
    let body;
    if (stats.status === 'error') body = `<p class="pr-note pr-note--bad">${esc(stats.error)}</p>`;
    else if (stats.status !== 'ready') body = '<p class="pr-note">Se încarcă…</p>';
    else if (!d || !d.official_name) body = '<p class="pr-note">Apar după ce administratorul îți pune numele oficial, cel din registre.</p>';
    else {
      const cells = [
        ['users', 'Elevi înscriși', d.students, 'activi, la oră de probă sau în înlocuire'],
        ['circle-check', 'Activi', d.active, 'cu statut Activ în registru'],
        ['clock', 'La oră de probă', d.trial, 'încă nu au plătit'],
        ['grid', 'Grupe', d.groups, 'în care ai elevi'],
        ['wallet', 'Cu sold negativ', d.negative, 'au de plătit']
      ];
      body = `<div class="ax-stats pr-stats">${cells.map(([i, k, v, s], n) => `
        <div class="ax-stat" style="--pg:var(--ax-c-${['elevi', 'inscriere', 'disponibilitate', 'orar', 'starturi'][n]})">
          <span class="ax-stat__k">${ico(i, 16)} ${esc(k)}</span>
          <span class="ax-stat__v">${nf.format(Number(v) || 0)}</span>
          <span class="ax-stat__s">${esc(s)}</span>
        </div>`).join('')}</div>`;
    }
    return `<section class="pr-sect" aria-labelledby="prStT"><h2 class="pr-h" id="prStT">Elevii tăi</h2>${body}</section>`;
  }

  async function loadStats(root) {
    if (!isMgr()) return;
    stats = { status: 'loading', data: null, error: '' };
    paintStats(root);
    try {
      const { data, error } = await sb().rpc('manager_my_stats');
      if (error) throw error;
      stats = { status: 'ready', data: data || null, error: '' };
    } catch (e) {
      const m = String((e && e.message) || e || '');
      stats = { status: 'error', data: null, error: /function|does not exist|schema cache/i.test(m) ? 'Numerele nu există încă: rulează migrarea 20261105100000_profil_manager.sql.' : 'Nu am putut citi numerele: ' + m.slice(0, 160) };
    }
    paintStats(root);
  }
  function paintStats(root) {
    const off = root.querySelector('#prOfficial'), st = root.querySelector('#prStats');
    if (off) off.innerHTML = officialHTML();
    if (st) st.innerHTML = statsHTML();
  }

  window.AdminViews.profil = {
    title: 'Profil',
    demo: false,
    icon: 'circle-user',
    render(root) {
      stopPoll();
      const a = window.BMAuth;
      if (!a || !a.user || !sb()) { root.innerHTML = '<p class="pr-note">Nu există o sesiune activă.</p>'; return; }
      root.innerHTML = `
        <header class="ax-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('circle-user', 24)}</span>
            <div>
              <h1 class="ax-h1">Profil</h1>
              <p class="ax-sub">Contul tău, Telegram${isMgr() ? ' și numerele elevilor tăi' : ''}.</p>
            </div>
          </div>
        </header>
        <div class="pr-grid">${accountHTML(a)}${telegramHTML()}</div>
        <div id="prStats"></div>`;
      root.querySelector('#prNameForm').addEventListener('submit', e => { e.preventDefault(); saveName(root); });
      wireTelegram(root);
      loadStats(root);
      paintStats(root);
    }
  };
})();
