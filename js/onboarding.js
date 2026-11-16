/* ============================================================
   Wizardul elevului: nickname unic (@) si clasa. Apare o singura data, la prima conectare (si la conturile vechi, la
   urmatoarea conectare), dar nu in timpul unui examen sau al unei lectii live. Se poate redeschide din profil pentru schimbare:
   BMOnboarding.open({ edit: true }).

   Datele merg prin functiile din 20261113100000_nickname_clasa_elev.sql. Daca acea migrare nu a fost rulata inca, wizardul nu apare
   (apelurile esueaza in tacere), deci site-ul poate fi publicat inaintea ei.
   ============================================================ */
(function () {
  'use strict';
  if (window.BMOnboarding) return;

  var RE = /^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$/;
  var CALM = /(^\/$|index\.html|parcurs\.html|misiuni\.html|capitole\.html|category\.html|classes\.html|training\.html|profile\.html)$/;
  var GRADES = [
    [5, 'V', 'clasa a 5-a'], [6, 'VI', 'clasa a 6-a'], [7, 'VII', 'clasa a 7-a'], [8, 'VIII', 'clasa a 8-a'],
    [9, 'IX', 'clasa a 9-a'], [10, 'X', 'clasa a 10-a'], [11, 'XI', 'clasa a 11-a'], [12, 'XII', 'clasa a 12-a']
  ];
  var MSG = {
    ok: 'Liber. E al tău!',
    taken: 'Acest nickname e deja folosit. Încearcă altul.',
    invalid: 'Între 3 și 20 de caractere: litere mici, cifre, _ sau punct. Începe și se termină cu o literă sau o cifră.',
    reserved: 'Acest nickname nu poate fi folosit. Alege altul.'
  };

  var sb = function () { return window.BMAuth && window.BMAuth.supabase; };
  var uid = function () { return (window.BMAuth && window.BMAuth.user && window.BMAuth.user.id) || ''; };
  var themeOf = function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; };

  function css() {
    if (document.querySelector('link[href*="css/onboarding.css"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/onboarding.css';
    document.head.appendChild(l);
  }
  function withMascot(cb) {
    if (window.TeoremaMascot) return cb();
    var s = document.createElement('script'); s.src = 'js/mascot.js'; s.onload = cb; s.onerror = cb;
    document.head.appendChild(s);
  }
  function owl(host, mood) {
    withMascot(function () {
      if (!window.TeoremaMascot || !host.isConnected) return;
      try { host.__m = new window.TeoremaMascot.Mascot(host, { mood: mood, theme: themeOf() }); } catch (e) { /* the dialog works without the owl */ }
    });
  }
  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  /* idei construite din ce a scris elevul: aceeasi litere, cu cifre sau cu un semn intre ele (stabile, nu se schimba la fiecare tasta) */
  function suggestions(typed) {
    var base = slug(typed).replace(/^[0-9]+/, '').slice(0, 14);
    if (base.length < 2) return [];
    var h = 7, i;
    for (i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) % 9973;
    var n = function (k) { return String(10 + ((h * (k + 3)) % 90)); };
    var out = [base + n(0), base + '_' + n(1), base + '.' + n(2)];
    return out.map(function (x) { return x.slice(0, 20); }).filter(function (x) { return RE.test(x) && x !== typed; });
  }

  /* codul dintr-un link de invitatie (classes.html?cod=ABC123), daca elevul a venit de acolo */
  function inviteFromUrl() {
    try { var c = new URLSearchParams(location.search).get('cod'); return c && /^[A-Za-z0-9]{6}$/.test(c) ? c.toUpperCase() : ''; } catch (e) { return ''; }
  }
  var JOIN_MSG = {
    not_found: 'Nu găsesc nicio clasă cu acest cod. Verifică literele și cifrele și încearcă din nou.',
    own_class: 'Nu te poți înscrie în propria clasă.',
    already_member: 'Ești deja în această clasă.',
    rejected_wait: 'Cererea ta a fost respinsă. Poți trimite din nou peste cel mult o zi.',
    too_many: 'Prea multe coduri greșite la rând. Încearcă din nou peste 15 minute.',
    auth: 'Conectează-te ca să trimiți o cerere.'
  };

  var el = null, state = null;

  function close() {
    if (!el) return;
    el.classList.remove('is-on');
    var gone = el; el = null; document.documentElement.classList.remove('ob-open');
    setTimeout(function () { if (gone.parentNode) gone.parentNode.removeChild(gone); }, 260);
  }

  function open(opts) {
    opts = opts || {};
    if (el) return;
    /* nickname-ul (si clasa, doar la elevi) e pentru elevi si profesori: un manager sau un admin nu vad wizardul */
    var role0 = opts.role || (window.BMAuth && window.BMAuth.role);
    if (role0 && role0 !== 'elev' && role0 !== 'profesor') return;
    css();
    state = { teacher: role0 === 'profesor', step: 0, nick: opts.nickname || '', grade: opts.grade || null, lockedUntil: opts.lockedUntil || null, status: '', edit: !!opts.edit, timer: 0, saving: false, saved: false, sending: false, code: inviteFromUrl(), name: '' };
    try { state.name = (window.BMAuth && window.BMAuth.displayName && window.BMAuth.displayName()) || ''; } catch (e) { /* ignore */ }
    el = document.createElement('div');
    el.className = 'ob';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Profilul tău');
    document.body.appendChild(el);
    document.documentElement.classList.add('ob-open');
    render();
    requestAnimationFrame(function () { if (el) el.classList.add('is-on'); });
  }

  function dots() {
    if (state.edit || state.teacher) return '';
    var out = '';
    for (var i = 0; i < 3; i++) out += '<i class="' + (i < state.step ? 'done' : i === state.step ? 'on' : '') + '"></i>';
    return '<div class="ob-dots" aria-hidden="true">' + out + '</div>';
  }

  function render() {
    if (!el) return;
    var s = state, h = '';
    if (s.step === 0 && s.edit && s.lockedUntil && Date.parse(s.lockedUntil) > Date.now()) {
      var d = new Date(s.lockedUntil), when = d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
      h = '<div class="ob-owl owl" id="obOwl"></div><h2>Nickname-ul e blocat</h2>' +
        '<p>Nickname-ul se poate schimba o dată la 60 de zile. Îl poți schimba din <b>' + when + '</b>.</p>' +
        '<div class="ob-fld ob-fld--ro"><span class="at">@</span><input type="text" value="' + s.nick.replace(/"/g, '') + '" readonly aria-label="Nickname-ul tău"></div>' +
        '<div class="ob-act"><button class="ob-go" id="obX2" type="button">Am înțeles</button></div>';
    } else if (s.step === 0) {
      h = '<div class="ob-owl owl" id="obOwl"></div><h2>' + (s.edit ? 'Schimbă nickname-ul' : 'Bine ai venit la Teorema!') + '</h2>' +
        '<p>' + (s.teacher ? 'Alege un <b>nickname</b>. Apare în profilul tău. Numele tău real rămâne în clase, în registre și în catalog.' : 'Alege un <b>nickname</b>. Apare în profilul tău și în clasament. Numele tău real rămâne în clase, în registre și în catalog.') + (s.edit ? ' După ce îl schimbi, îl poți schimba din nou abia peste 60 de zile.' : '') + '</p>' +
        '<label class="ob-fld" for="obNick"><span class="at">@</span><input id="obNick" type="text" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="nickname" value="' + s.nick.replace(/"/g, '') + '"></label>' +
        '<div class="ob-st" id="obSt" role="status"></div>' +
        '<div class="ob-sug" id="obSug"></div>' +
        '<div class="ob-act"><button class="ob-go" id="obNext" type="button" disabled>' + (s.edit || s.teacher ? 'Salvează' : 'Continuă') + '</button></div>' +
        (s.edit ? '<button class="ob-link" id="obX" type="button">Renunță</button>' : '<button class="ob-link" id="obLater" type="button">Mai târziu</button>');
    } else if (s.step === 1) {
      h = '<div class="ob-owl owl" id="obOwl"></div><h2>În ce clasă ești?</h2>' +
        '<p>Parcursul tău de lecții începe de la clasa ta. O poți schimba oricând din profil.</p>' +
        '<div class="ob-gr-lbl">GIMNAZIU</div><div class="ob-gr">' + GRADES.slice(0, 5).map(gk).join('') + '</div>' +
        '<div class="ob-gr-lbl">LICEU</div><div class="ob-gr">' + GRADES.slice(5).map(gk).join('') + '</div>' +
        '<div class="ob-act"><button class="ob-back" id="obBack" type="button">Înapoi</button><button class="ob-go" id="obNext" type="button"' + (s.grade ? '' : ' disabled') + '>Continuă</button></div>';
    } else {
      h = '<div class="ob-owl owl" id="obOwl"></div><h2>Vrei să intri într-o clasă?</h2>' +
        '<p>Dacă profesorul ți-a dat <b>codul clasei</b>, scrie-l aici. Profesorul primește cererea pe loc și, când o acceptă, clasa apare la tine. Nu ai codul acum? Îl poți scrie oricând în fila <b>Clase</b>.</p>' +
        '<label class="ob-code" for="obCode"><img src="assets/images/class/cod.svg" alt="" width="34" height="34"><input id="obCode" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" placeholder="ABC123" aria-label="Codul clasei" value="' + s.code + '"></label>' +
        '<div class="ob-err" id="obErr" role="alert"></div>' +
        '<div class="ob-act ob-act--join"><button class="ob-skip" id="obSkip" type="button">Nu acum, închide</button><button class="ob-go" id="obSend" type="button"' + (s.code.length === 6 ? '' : ' disabled') + '>Trimite cererea</button></div>' +
        '<button class="ob-link" id="obBack" type="button">Înapoi</button>';
    }
    el.innerHTML = '<div class="ob-card' + (s.step === 2 && !s.edit && !s.teacher ? ' ob-card--join' : '') + '">' + dots() + h + '</div>';
    owl($('#obOwl'), s.step === 2 ? 'happy' : s.step === 1 ? 'think' : 'idle');
    if (s.step === 2) { var cin = $('#obCode'); if (cin) setTimeout(function () { try { cin.focus({ preventScroll: true }); } catch (e) { cin.focus(); } }, 380); }
    bind();
  }
  function gk(g) {
    return '<button type="button" class="ob-g' + (state.grade === g[0] ? ' on' : '') + '" data-g="' + g[0] + '"><b>' + g[1] + '</b><span>' + g[2] + '</span></button>';
  }
  function $(s) { return el && el.querySelector(s); }

  function setStatus(kind, text) {
    var st = $('#obSt'); if (!st) return;
    st.className = 'ob-st ' + (kind || ''); st.textContent = text || '';
    var nx = $('#obNext'); if (nx) nx.disabled = kind !== 'ok';
  }

  /* ideile apar abia dupa ce elevul a scris ceva si dispar cand numele ales e liber */
  function showIdeas(v, ok) {
    var sug = $('#obSug'); if (!sug) return;
    var list = ok ? [] : suggestions(v);
    sug.innerHTML = list.length ? '<span>Idei:</span>' + list.map(function (x) { return '<button type="button" data-s="' + x + '">@' + x + '</button>'; }).join('') : '';
  }

  function check() {
    var inp = $('#obNick'); if (!inp) return;
    var v = inp.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (v !== inp.value) inp.value = v;
    state.nick = v;
    clearTimeout(state.timer);
    showIdeas(v);
    if (!v) { setStatus('', ''); return; }
    if (!RE.test(v)) { setStatus('bad', v.length < 3 ? 'Încă puțin: minim 3 caractere.' : MSG.invalid); return; }
    setStatus('wait', 'Verific…');
    var mine = v;
    state.timer = setTimeout(function () {
      var c = sb(); if (!c) { setStatus('bad', 'Nu pot verifica acum. Reîncearcă.'); return; }
      c.rpc('nickname_available', { p_nickname: mine }).then(function (r) {
        if (!el || state.nick !== mine) return;
        if (r.error) { setStatus('bad', 'Nu pot verifica acum. Reîncearcă.'); return; }
        var k = r.data;
        setStatus(k === 'ok' ? 'ok' : 'bad', MSG[k] || MSG.invalid);
        showIdeas(mine, k === 'ok');
      }, function () { if (el) setStatus('bad', 'Nu pot verifica acum. Reîncearcă.'); });
    }, 320);
  }

  function bind() {
    var s = state, nx = $('#obNext');
    if (s.step === 0 && !nx) { var x2 = $('#obX2'); if (x2) x2.onclick = close; return; }
    if (s.step === 0) {
      var inp = $('#obNick');
      inp.addEventListener('input', function () { s.saved = false; });
      inp.addEventListener('input', check);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && nx && !nx.disabled) nx.click(); });
      var sug = $('#obSug');
      sug.addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (b) { inp.value = b.getAttribute('data-s'); check(); inp.focus(); } });
      if (s.nick) check();
      setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }, 350);
      nx.onclick = function () { if (s.teacher) { save(); } else if (s.edit) { s.grade = s.grade || +(localStorage.getItem('bm_grade') || 0) || 7; save(); } else { s.step = 1; render(); } };
      var lt = $('#obLater'); if (lt) lt.onclick = function () { try { sessionStorage.setItem('bm_onb_later', '1'); } catch (e) { /* ignore */ } close(); };
      var xx = $('#obX'); if (xx) xx.onclick = close;
    } else if (s.step === 1) {
      el.querySelectorAll('.ob-g').forEach(function (b) {
        b.onclick = function () {
          s.grade = +b.getAttribute('data-g'); s.saved = false;
          el.querySelectorAll('.ob-g').forEach(function (o) { o.classList.toggle('on', o === b); });
          nx.disabled = false;
        };
      });
      $('#obBack').onclick = function () { s.step = 0; render(); };
      nx.onclick = function () { s.step = 2; render(); };
    } else {
      var cin = $('#obCode'), send = $('#obSend');
      cin.addEventListener('input', function () {
        var v = cin.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        if (v !== cin.value) cin.value = v;
        s.code = v; send.disabled = v.length !== 6;
        var er = $('#obErr'); if (er) er.textContent = '';
      });
      cin.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !send.disabled) send.click(); });
      $('#obBack').onclick = function () { s.step = 1; render(); };
      $('#obSkip').onclick = skipJoin;
      send.onclick = sendJoin;
    }
  }

  /* salveaza nickname-ul si clasa (o singura data); cb(true) cand sunt salvate */
  function persist(cb) {
    var s = state, c = sb();
    var bad = function () { var m = 'Nu s-a putut salva. Reîncearcă peste un moment.', er = $('#obErr'); if (er) er.textContent = m; else if ($('#obSt')) setStatus('bad', m); };
    if (s.saved) return cb(true);
    if (!c) { bad(); return cb(false); }
    c.rpc('complete_student_onboarding', { p_nickname: s.nick, p_grade: s.teacher ? null : s.grade }).then(function (r) {
      var d = r && r.data;
      if (r.error || !d || !d.ok) {
        var e = d && d.error;
        if (e === 'locked') { s.lockedUntil = d.until; s.step = 0; render(); return cb(false); }
        if (e === 'taken' || e === 'invalid' || e === 'reserved') { s.step = 0; render(); setStatus('bad', MSG[e]); return cb(false); }
        bad();
        return cb(false);
      }
      try { if (d.grade) localStorage.setItem('bm_grade', String(d.grade)); localStorage.setItem('bm_nickname', d.nickname); localStorage.setItem('bm_onb_' + uid(), '1'); } catch (e2) { /* ignore */ }
      s.saved = true;
      document.dispatchEvent(new CustomEvent('bm:onboarded', { detail: { nickname: d.nickname, grade: d.grade } }));
      cb(true);
    }, function () { bad(); cb(false); });
  }

  /* „Nu acum, închide”: profilul se salveaza si wizardul se inchide */
  function skipJoin() {
    var s = state, b = $('#obSkip'), g = $('#obSend');
    if (s.sending) return;
    s.sending = true; if (b) b.disabled = true; if (g) g.disabled = true;
    persist(function (ok) {
      s.sending = false;
      if (!el) return;
      if (!ok) { if (b) b.disabled = false; if (g) g.disabled = s.code.length !== 6; return; }
      close();
      if (window.BM && BM.toast) BM.toast('Gata! Te poți alătura unei clase oricând din fila Clase.', 'info', 4200);
    });
  }

  /* „Trimite cererea”: profilul se salveaza, cererea pleaca la profesor, iar elevul ajunge in Clase unde vede ca asteapta raspunsul */
  function sendJoin() {
    var s = state, c = sb(), er = $('#obErr'), b = $('#obSend'), k = $('#obSkip');
    if (s.sending || s.code.length !== 6) return;
    s.sending = true; b.disabled = true; k.disabled = true; b.textContent = 'Se trimite…'; if (er) er.textContent = '';
    var undo = function (msg) {
      s.sending = false; if (!el) return;
      b.textContent = 'Trimite cererea'; b.disabled = s.code.length !== 6; k.disabled = false;
      var e2 = $('#obErr'); if (e2) e2.textContent = msg || '';
    };
    persist(function (ok) {
      if (!ok) return undo('');
      if (!c) return undo('Nu pot trimite acum. Reîncearcă.');
      c.rpc('request_join_class', { p_code: s.code, p_name: (window.BMAuth && BMAuth.displayName && BMAuth.displayName()) || '' }).then(function (r) {
        if (r.error) return undo('Cererea nu a putut fi trimisă. Reîncearcă peste un moment.');
        var d = r.data || {}, st = d.status || '';
        if (st === 'pending' || st === 'already_pending') {
          try { sessionStorage.setItem('bm_join_sent', JSON.stringify({ name: d.class_name || '', at: Date.now() })); } catch (e3) { /* ignore */ }
          close();
          location.href = 'classes.html';
          return;
        }
        undo(JOIN_MSG[st] || 'Cererea nu a putut fi trimisă.');
      }, function () { undo('Cererea nu a putut fi trimisă. Verifică conexiunea și reîncearcă.'); });
    });
  }

  function save() {
    var s = state, b = $('#obSave');
    if (s.saving) return;
    s.saving = true; if (b) b.disabled = true;
    persist(function (ok) {
      s.saving = false;
      if (!ok) { if (b) b.disabled = false; return; }
      if (s.edit) { try { sessionStorage.removeItem('bm_rail_rank'); } catch (e3) { /* ignore */ } }
      close();
    });
  }

  /* Porneste wizardul daca elevul nu l-a facut inca. */
  function maybe() {
    if (!CALM.test(location.pathname)) return;
    try { if (sessionStorage.getItem('bm_onb_later') || localStorage.getItem('bm_onb_' + uid()) === '1') return; } catch (e) { /* ignore */ }
    var c = sb(); if (!c) return;
    c.rpc('my_student_profile').then(function (r) {
      var p = r && r.data;
      if (r.error || !p) return;                       // migrarea nu e rulata inca, sau nu are profil
      if (p.role !== 'elev' && p.role !== 'profesor') return;
      if (p.onboarded) { try { localStorage.setItem('bm_onb_' + uid(), '1'); } catch (e) { /* ignore */ } }
      if (p.grade) { try { localStorage.setItem('bm_grade', String(p.grade)); if (p.nickname) localStorage.setItem('bm_nickname', p.nickname); } catch (e) { /* ignore */ } }
      if (!p.onboarded) open({ nickname: p.nickname || '', grade: p.grade || null, role: p.role });
    }, function () { /* in tacere */ });
  }

  window.BMOnboarding = { open: open, maybe: maybe, close: close };
  /* se cheama din js/auth.js, imediat ce rolul e cunoscut */
  maybe();   // loaded by js/auth.js once the student's role is known
})();
