/* ============================================================
   Lecție (prototip): un exercițiu pe ecran, explicație înainte, feedback de la bufniță,
   greșelile revin la final. Conținut exemplu: Ecuații de gradul I, clasa a 7-a (de validat cu programa).
   Nu citește și nu scrie nimic în baza de date.
   ============================================================ */
(function () {
  'use strict';

  var LESSON = { clasa: 'Clasa a 7-a', unit: 'Ecuații de gradul I', n: 1, of: 7 };

  var STEPS = [
    { t: 'learn', title: 'Ecuația e o balanță', pages: [
      { p: 'O ecuație e ca o balanță: <b>ce e în stânga trebuie să fie egal cu ce e în dreapta</b>. Căutăm numărul <b>x</b> care o ține în echilibru.',
        rows: [['x + 5', '=', '12']] },
      { p: 'Vrem ca <b>x</b> să rămână singur. <b>Ce faci într-o parte, faci și în cealaltă</b>: scădem 5 din ambele părți.',
        rows: [['x + 5', '=', '12'], ['x + 5 <mark>− 5</mark>', '=', '12 <mark>− 5</mark>']] },
      { p: 'Acum <b>x</b> e singur. Calculăm și apoi verificăm: dacă punem 7 în loc de x, balanța rămâne în echilibru.',
        rows: [['x + 5', '=', '12'], ['x + 5 − 5', '=', '12 − 5'], ['x', '=', '7', 'fin'], ['7 + 5', '=', '12 ✓']] }
    ] },
    { t: 'mc', rar: 0, q: 'Care este soluția ecuației?', eq: 'x + 5 = 12', opts: ['5', '7', '17', '60'], a: 1,
      why: 'Scădem 5 din ambele părți: x = 12 − 5 = 7.' },
    { t: 'mc', rar: 0, q: 'Rezolvă ecuația.', eq: '3x = 18', opts: ['6', '3', '15', '54'], a: 0,
      why: 'Împărțim ambele părți la 3: x = 18 : 3 = 6.' },
    { t: 'num', rar: 0, q: 'Rezolvă ecuația și scrie valoarea lui x.', eq: '2x + 3 = 11', a: 4,
      why: 'Scădem 3: 2x = 8. Apoi împărțim la 2: x = 4.' },
    { t: 'order', rar: 1, q: 'Pune pașii rezolvării în ordinea corectă.', eq: '3x − 4 = 11',
      tiles: ['3x = 11 + 4', '3x = 15', 'x = 15 : 3', 'x = 5'],
      why: 'Mutăm 4 în dreapta cu semn schimbat, calculăm 11 + 4 = 15, apoi împărțim la 3.' },
    { t: 'bug', rar: 1, q: 'Elevul a greșit într-o linie. Care este ea?',
      lines: ['2x + 6 = 14', '2x = 14 + 6', '2x = 20', 'x = 10'], bad: 1,
      why: 'Pe linia 2, 6 trebuia scăzut, nu adunat: 2x = 14 − 6 = 8, deci x = 4.' },
    { t: 'num', rar: 2, q: 'Rezolvă ecuația și scrie valoarea lui x.', eq: '5x − 7 = 3x + 9', a: 8,
      why: 'Grupăm x-urile: 5x − 3x = 9 + 7, adică 2x = 16, deci x = 8.' },
    { t: 'mc', rar: 2, q: 'Un caiet costă de 2 ori cât un pix. Împreună costă 15 lei. Cât costă pixul?', opts: ['3 lei', '7,5 lei', '5 lei', '10 lei'], a: 2,
      why: 'Pixul costă x, caietul 2x: x + 2x = 15, deci 3x = 15 și x = 5.' }
  ];

  var RAR = ['COMUN', 'RAR', 'EPIC'];
  var OKT = ['Corect!', 'Bravo!', 'Exact!', 'Foarte bine!'];
  var NOT = ['Nu chiar.', 'Aproape!', 'Hai să vedem.'];

  var $ = function (s) { return document.querySelector(s); };
  var main = $('#lzMain'), foot = $('#lzFoot'), go = $('#lzGo'), skip = $('#lzSkip');
  var fb = $('#lzFb'), fbT = $('#lzFbTitle'), fbX = $('#lzFbText'), bar = $('#lzBar'), xpEl = $('#lzXp'), prog = $('#lzProg');
  var themeOf = function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; };

  var owls = [];
  function owl(host, mood) {
    if (!window.TeoremaMascot || !host) return null;
    try { var m = new window.TeoremaMascot.Mascot(host, { mood: mood, theme: themeOf() }); owls.push(m); return m; } catch (e) { return null; }
  }
  function dropOwls() { owls.forEach(function (m) { try { window.TeoremaMascot.dispose(m); } catch (e) { /* gone */ } }); owls = []; }

  var queue, cur, exercises, total, doneCount, xp, firstOk, tries, started, phase, ans, learnPage, step, fbOwl;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function start() {
    exercises = STEPS.filter(function (s) { return s.t !== 'learn'; }).length;
    queue = STEPS.map(function (_, i) { return i; });
    total = exercises; doneCount = 0; xp = 0; firstOk = 0; tries = {}; started = Date.now();
    xpEl.textContent = '0';
    setProgress();
    next();
  }

  function setProgress() {
    var pct = Math.round(doneCount / total * 100);
    bar.style.width = pct + '%';
    prog.setAttribute('aria-valuenow', pct);
  }

  function swap(html, after) {
    var old = main.firstElementChild;
    var show = function () {
      dropOwls();
      main.innerHTML = '<section class="lz-step">' + html + '</section>';
      after && after(main.firstElementChild);
    };
    if (old) { old.classList.add('out'); setTimeout(show, 190); } else show();
  }

  function setFoot(mode) {            // mode: null | 'ok' | 'no'
    foot.className = 'lz-foot' + (mode ? ' ' + mode : '');
  }

  function next() {
    if (!queue.length) { return end(); }
    cur = queue.shift();
    step = STEPS[cur];
    ans = null; phase = 'answer';
    fb.hidden = true; setFoot(null);
    skip.hidden = step.t === 'learn';
    go.disabled = step.t !== 'learn';
    go.textContent = step.t === 'learn' ? 'Continuă' : 'Verifică';
    if (step.t === 'learn') { learnPage = 0; renderLearn(); }
    else renderExercise();
  }

  /* ---------- învață ---------- */
  function renderLearn() {
    var pg = step.pages[learnPage];
    var rows = pg.rows.map(function (r, i) {
      var isNew = i === pg.rows.length - 1 && learnPage > 0 || (learnPage === 0 && i === 0);
      return '<div class="lz-row' + (r[3] ? ' ' + r[3] : '') + '"' + (isNew ? '' : ' style="animation:none"') + '><span class="sd">' + r[0] + '</span><span class="eqs">' + r[1] + '</span><span class="sd">' + r[2] + '</span></div>';
    }).join('');
    var dots = step.pages.map(function (_, i) { return '<i' + (i <= learnPage ? ' class="on"' : '') + '></i>'; }).join('');
    var html = '<div class="lz-meta"><span class="lz-chip">ÎNVAȚĂ</span><span>' + LESSON.clasa + ' · ' + LESSON.unit + ' · lecția ' + LESSON.n + '</span></div>' +
      '<div class="lz-learn"><h2>' + step.title + '</h2><p>' + pg.p + '</p><div class="lz-board">' + rows + '</div><div class="lz-dots">' + dots + '</div></div>';
    if (learnPage === 0) swap(html); else { var m = main.firstElementChild; if (m) { m.innerHTML = html; m.style.animation = 'none'; } else swap(html); }
    go.textContent = learnPage === step.pages.length - 1 ? 'Am înțeles' : 'Continuă';
  }

  /* ---------- exerciții ---------- */
  function head() {
    return '<div class="lz-meta"><span class="lz-chip r' + step.rar + '">' + RAR[step.rar] + '</span><span>' + LESSON.clasa + ' · ' + LESSON.unit + '</span></div>' +
      '<div class="lz-ask"><div class="owl" id="lzQ"></div><div class="lz-bubble">' + esc(step.q) + '</div></div>';
  }
  function afterRender() { owl($('#lzQ'), step.rar === 2 ? 'think' : 'idle'); }

  function renderExercise() {
    var html = head(), after = afterRender;
    if (step.t === 'mc') {
      html += (step.eq ? '<div class="lz-eq">' + esc(step.eq) + '</div>' : '') + '<div class="lz-opts">' +
        step.opts.map(function (o, i) { return '<button type="button" class="lz-op" data-i="' + i + '"><span class="k">' + (i + 1) + '</span>' + esc(o) + '</button>'; }).join('') + '</div>';
      after = function (el) { afterRender(); el.querySelectorAll('.lz-op').forEach(function (b) { b.onclick = function () { pickMc(+b.dataset.i); }; }); };
    } else if (step.t === 'num') {
      html += '<div class="lz-eq">' + esc(step.eq) + '</div><div class="lz-num"><label for="lzInp">x =</label><input id="lzInp" class="lz-inp" type="text" inputmode="decimal" autocomplete="off" placeholder="?"></div>';
      after = function (el) {
        afterRender();
        var inp = el.querySelector('#lzInp');
        inp.oninput = function () { ans = inp.value.trim() === '' ? null : inp.value; go.disabled = ans === null; };
        setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }, 450);
      };
    } else if (step.t === 'order') {
      var idx = step.tiles.map(function (_, i) { return i; }), bank = [2, 0, 3, 1].filter(function (i) { return i < idx.length; });
      ans = [];
      html += '<div class="lz-eq">' + esc(step.eq) + '</div><div class="lz-ans" id="lzAns"></div><div class="lz-bank" id="lzBank"></div>';
      after = function () { afterRender(); drawOrder(bank); };
    } else if (step.t === 'bug') {
      html += '<div class="lz-lines">' + step.lines.map(function (l, i) { return '<button type="button" class="lz-ln" data-i="' + i + '"><i>' + (i + 1) + '</i>' + esc(l) + '</button>'; }).join('') + '</div>';
      after = function (el) { afterRender(); el.querySelectorAll('.lz-ln').forEach(function (b) { b.onclick = function () { pickBug(+b.dataset.i); }; }); };
    }
    swap(html, after);
  }

  function pickMc(i) {
    if (phase !== 'answer') return;
    ans = i; go.disabled = false;
    main.querySelectorAll('.lz-op').forEach(function (b) { b.classList.toggle('sel', +b.dataset.i === i); });
  }
  function pickBug(i) {
    if (phase !== 'answer') return;
    ans = i; go.disabled = false;
    main.querySelectorAll('.lz-ln').forEach(function (b) { b.classList.toggle('sel', +b.dataset.i === i); });
  }
  function drawOrder(bank) {
    var A = $('#lzAns'), B = $('#lzBank');
    if (!A || !B) return;
    A.innerHTML = ''; B.innerHTML = '';
    ans.forEach(function (ti, pos) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'lz-tile'; b.textContent = step.tiles[ti];
      b.onclick = function () { if (phase !== 'answer') return; ans.splice(pos, 1); bank.push(ti); drawOrder(bank); };
      A.appendChild(b);
    });
    var all = [2, 0, 3, 1].filter(function (i) { return i < step.tiles.length; });
    all.forEach(function (ti) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'lz-tile'; b.textContent = step.tiles[ti];
      var used = ans.indexOf(ti) >= 0;
      if (used) { b.classList.add('used'); b.disabled = true; }
      b.onclick = function () { if (phase !== 'answer' || used) return; ans.push(ti); bank.splice(bank.indexOf(ti), 1); drawOrder(bank); };
      B.appendChild(b);
    });
    go.disabled = ans.length !== step.tiles.length;
  }

  /* ---------- verificare ---------- */
  function isRight() {
    if (step.t === 'mc') return ans === step.a;
    if (step.t === 'bug') return ans === step.bad;
    if (step.t === 'num') return Math.abs(parseFloat(String(ans).replace(',', '.')) - step.a) < 1e-9;
    if (step.t === 'order') return ans.every(function (v, i) { return v === i; });
    return true;
  }

  function mark(right) {
    if (step.t === 'mc') {
      main.querySelectorAll('.lz-op').forEach(function (b) {
        var i = +b.dataset.i; b.disabled = true; b.classList.remove('sel');
        if (i === step.a) b.classList.add('ok'); else if (i === ans) b.classList.add('no');
      });
    } else if (step.t === 'bug') {
      main.querySelectorAll('.lz-ln').forEach(function (b) {
        var i = +b.dataset.i; b.disabled = true; b.classList.remove('sel');
        if (i === step.bad) b.classList.add('ok'); else if (i === ans) b.classList.add('no');
      });
    } else if (step.t === 'num') {
      var inp = $('#lzInp'); if (inp) { inp.readOnly = true; inp.classList.add(right ? 'ok' : 'no'); }
    } else if (step.t === 'order') {
      var A = $('#lzAns'); if (A) A.querySelectorAll('.lz-tile').forEach(function (b, pos) { b.disabled = true; b.classList.add(ans[pos] === pos ? 'ok' : 'no'); });
    }
  }

  function check(giveUp) {
    if (phase !== 'answer') return;
    var right = !giveUp && isRight();
    phase = 'feedback';
    mark(right);
    var firstTime = !tries[cur];
    tries[cur] = (tries[cur] || 0) + 1;
    if (right) {
      var gain = firstTime ? 10 : 5;
      xp += gain; if (firstTime) firstOk++;
      doneCount++; setProgress();
      xpEl.textContent = String(xp);
      var x = $('.lz-xp'); x.classList.remove('bump'); void x.offsetWidth; x.classList.add('bump');
    } else {
      queue.push(cur);              // greșeala revine la final
      total++; setProgress();
      var st = main.firstElementChild; if (st) { st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake'); }
    }
    showFeedback(right, giveUp);
  }

  function showFeedback(right, giveUp) {
    setFoot(right ? 'ok' : 'no');
    skip.hidden = true;
    fb.hidden = false;
    fbT.textContent = right ? OKT[Math.floor(Math.random() * OKT.length)] : (giveUp ? 'Nu-i nimic.' : NOT[Math.floor(Math.random() * NOT.length)]);
    fbX.textContent = right ? step.why : step.why + ' O mai încercăm la final.';
    var host = $('#lzFbOwl'); host.innerHTML = '';
    if (fbOwl) { try { window.TeoremaMascot.dispose(fbOwl); } catch (e) { /* gone */ } }
    fbOwl = owl(host, right ? 'happy' : 'wrong');
    go.disabled = false;
    go.textContent = 'Continuă';
  }

  /* ---------- final ---------- */
  function end() {
    foot.style.display = 'none';
    bar.style.width = '100%';
    var sec = Math.round((Date.now() - started) / 1000), mm = Math.floor(sec / 60), ss = ('0' + (sec % 60)).slice(-2);
    var pct = Math.round(firstOk / exercises * 100);
    var html = '<div class="lz-end lz-step"><div class="owl" id="lzEndOwl"></div><h1>Lecție terminată!</h1>' +
      '<p>Ai rezolvat ecuațiile de la început până la capăt. Greșelile au revenit la final și le-ai corectat.</p>' +
      '<div class="lz-stats"><div><b>+' + xp + '</b><span>XP</span></div><div><b>' + pct + '%</b><span>din prima</span></div><div><b>' + mm + ':' + ss + '</b><span>timp</span></div></div>' +
      '<div class="lz-skill"><div><b>' + LESSON.unit + '</b><span>Lecția ' + LESSON.n + ' din ' + LESSON.of + ' · nivel 1 din 5</span><div class="lz-pips"><i class="on"></i><i></i><i></i><i></i><i></i></div></div></div>' +
      '<button class="lz-go" id="lzAgain" type="button">Repetă lecția</button></div>';
    swap(html, function () {
      owl($('#lzEndOwl'), 'happy');
      $('#lzAgain').onclick = function () { location.reload(); };
    });
  }

  /* ---------- comenzi ---------- */
  go.onclick = function () {
    if (go.disabled) return;
    if (step.t === 'learn') {
      if (learnPage < step.pages.length - 1) { learnPage++; renderLearn(); return; }
      doneLearn(); return;
    }
    if (phase === 'answer') check(false); else advance();
  };
  skip.onclick = function () { if (phase === 'answer' && step.t !== 'learn') check(true); };
  function doneLearn() { advance(); }
  function advance() {
    var st = main.firstElementChild;
    if (st) st.classList.add('out');
    setTimeout(next, 200);
  }
  $('#lzExit').onclick = function () { if (history.length > 1) history.back(); else location.href = 'capitole.html'; };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { if (!go.disabled && foot.style.display !== 'none') { e.preventDefault(); go.click(); } return; }
    if (phase !== 'answer' || !step) return;
    if (step.t === 'mc' && /^[1-4]$/.test(e.key)) pickMc(+e.key - 1);
  });

  start();
})();
