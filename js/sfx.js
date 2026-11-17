/* ============================================================
   Sunete: un "click" discret la fiecare buton apăsat și sunetul de "răspuns corect" din lecții.
   Fișierele sunt în assets/sounds/ (click.wav, correct.wav: PCM curat, fără codec, ca să nu se strice sunetul scurt).
   Se folosește Web Audio. Trei lucruri țin sunetul curat și la timp (2026-11-17):
   1) contextul audio e trezit la orice gest (inclusiv când mouse-ul se apropie de un buton), iar un sunet cerut cât contextul încă doarme
      se cântă doar dacă se trezește în mai puțin de 0,4 s; nu se mai adună apăsările care apoi pornesc toate deodată;
   2) cât pagina e vizibilă, curge un zgomot de nivel nesimțit (sub un bit al unui convertor pe 16 biți) care oprește browserul și placa de sunet să
      "adoarmă" după o pauză: altfel prima apăsare după o pauză lungă întârzia sau pierdea începutul sunetului;
   3) sunetele sunt PCM, nu mp3: un click de câteva milisecunde trecut prin decodorul mp3 se distorsiona.
   Oprire: localStorage bm_sound = "0" (sau BMSfx.enable(false)). Cine citește BMSfx.play('correct') nu trebuie să știe de restul.
   ============================================================ */
(function () {
  'use strict';
  if (window.BMSfx) return;

  var FILES = { click: 'assets/sounds/click.wav', correct: 'assets/sounds/correct.wav' };
  var VOL = { click: 0.5, correct: 0.8 };
  var MAX_WAIT = 400;                 /* ms: un sunet cerut cât contextul dormea nu se mai cântă dacă s-a trezit mai târziu */
  var buf = {}, ctx = null, tags = {}, keep = null;

  function on() { try { return localStorage.getItem('bm_sound') !== '0'; } catch (e) { return true; } }
  function enable(v) { try { localStorage.setItem('bm_sound', v ? '1' : '0'); } catch (e) { /* ignore */ } if (!v) keepAlive(false); else wake(); }
  function running() { return !!ctx && ctx.state === 'running'; }

  function decode(k, ab, again) {
    var done = function (b) { buf[k] = b; };
    var fail = function () { if (again) { fetch(FILES[k]).then(function (r) { return r.arrayBuffer(); }).then(function (a2) { decode(k, a2, false); }, function () { /* rămâne varianta simplă */ }); } };
    try {
      var p = ctx.decodeAudioData(ab.slice(0), done, fail);
      if (p && p.then) p.then(done, fail);
    } catch (e) { fail(); }
  }

  (function init() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; } } }
    Object.keys(FILES).forEach(function (k) {
      try { var a = new Audio(); a.preload = 'auto'; a.src = FILES[k]; tags[k] = a; } catch (e) { /* ignore */ }
      if (!ctx) return;
      try {
        fetch(FILES[k]).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (ab) { if (ab) decode(k, ab, true); }, function () { /* fără sunet */ });
      } catch (e) { /* fără sunet */ }
    });
    if (ctx) { try { ctx.addEventListener('statechange', function () { if (running()) keepAlive(true); }); } catch (e) { /* ignore */ } }
  })();

  /* zgomot de nivel nesimțit (±2 pași ai unui convertor pe 16 biți): opțiunea de a opri dispozitivul din liniște digitală nu mai are cum să se declanșeze */
  function keepAlive(yes) {
    if (!ctx) return;
    if (!yes) { if (keep) { try { keep.src.stop(); } catch (e) { /* ignore */ } try { keep.gain.disconnect(); } catch (e2) { /* ignore */ } keep = null; } return; }
    if (keep || !running() || document.hidden || !on()) return;
    try {
      var n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      var s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = b; s.loop = true; g.gain.value = 0.00006;
      s.connect(g); g.connect(ctx.destination); s.start(0);
      keep = { src: s, gain: g };
    } catch (e) { keep = null; }
  }

  /* trezește contextul (la un gest, sau când mouse-ul se apropie de ceva apăsabil), fără să cânte nimic */
  function wake() {
    if (!ctx) return;
    if (running()) { keepAlive(true); return; }
    try { var p = ctx.resume(); if (p && p.then) p.then(function () { keepAlive(true); }, function () { /* blocat până la prima atingere */ }); } catch (e) { /* ignore */ }
  }

  function fire(name) {
    try {
      var s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf[name]; g.gain.value = VOL[name] || 0.7;
      s.connect(g); g.connect(ctx.destination); s.start(0);
      return true;
    } catch (e) { return false; }
  }
  function tagPlay(name) {
    try {
      var a = tags[name]; if (!a) return;
      var c = a.cloneNode(); c.volume = VOL[name] || 0.7;   /* o copie, ca două sunete apropiate să nu se taie între ele */
      var p = c.play(); if (p && p.catch) p.catch(function () { /* blocat până la prima atingere */ });
    } catch (e) { /* fără sunet */ }
  }

  var last = 0;
  function play(name) {
    if (!on() || !FILES[name]) return;
    var now = Date.now();
    if (name === 'click') { if (now - last < 30) return; last = now; }
    if (ctx && buf[name]) {
      if (running()) { if (fire(name)) return; }
      else {
        /* contextul doarme: îl trezim și cântăm doar dacă se trezește repede (altfel sunetul ar veni târziu sau toate odată) */
        var t0 = performance.now();
        try {
          var p = ctx.resume();
          if (p && p.then) p.then(function () { if (performance.now() - t0 < MAX_WAIT && running()) { fire(name); keepAlive(true); } }, function () { /* blocat */ });
        } catch (e) { /* ignore */ }
        return;
      }
    }
    tagPlay(name);
  }

  /* orice se poate apăsa: butoane și legături, dar și cardurile și rândurile făcute cu un div (cele cu cursor "mână") */
  var CLICKABLE = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], summary, select, input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], label[for], [onclick], .nd';
  function pressable(t) {
    var el = t.closest ? t.closest(CLICKABLE) : null;
    if (el) return el;
    for (var i = 0, n = t; n && n.nodeType === 1 && i < 8; i++, n = n.parentElement) {
      try { if (getComputedStyle(n).cursor === 'pointer') return n; } catch (e) { return null; }
    }
    return null;
  }
  /* mouse: la apăsare, ca să se audă pe loc. Deget: abia când degetul se ridică fără să fi alunecat, ca un scroll care pornește de pe un buton
     (sau o atingere anulată de browser) să nu scoată niciun sunet */
  var touch = null;
  function target(e) {
    var t = e.target && e.target.nodeType === 1 ? pressable(e.target) : null;
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true' || t.closest('[data-nosound]')) return null;
    return t;
  }
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') { if (e.button !== 0) return; if (target(e)) play('click'); else wake(); return; }
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, ok: !!target(e) };
    wake();   /* contextul se trezește cât degetul e încă pe ecran, deci e gata când se ridică */
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (touch && e.pointerId === touch.id && (Math.abs(e.clientX - touch.x) > 8 || Math.abs(e.clientY - touch.y) > 8)) touch.ok = false;
  }, { capture: true, passive: true });
  document.addEventListener('pointercancel', function (e) { if (touch && e.pointerId === touch.id) touch = null; }, true);
  document.addEventListener('pointerup', function (e) {
    if (!touch || e.pointerId !== touch.id) return;
    var ok = touch.ok; touch = null;
    if (ok && target(e)) play('click');
  }, true);

  /* mouse-ul care se mișcă anunță o apăsare: contextul e trezit dinainte, nu abia la click (prima apăsare după o pauză lungă nu mai întârzie) */
  var lastMove = 0;
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var now = Date.now(); if (now - lastMove < 400) return; lastMove = now;
    if (!running()) wake();
  }, { capture: true, passive: true });

  /* unele telefoane (iPhone) deblochează sunetul abia la ridicarea degetului */
  ['touchstart', 'touchend', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, wake, { capture: true, passive: true }); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) keepAlive(false); else wake(); });
  window.addEventListener('focus', wake);
  window.addEventListener('pagehide', function () { keepAlive(false); });

  /* tastatura: Enter și Spațiu pe un buton */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (t && t.tagName === 'BUTTON' && !t.disabled && !e.repeat) play('click');
  }, true);

  window.BMSfx = { play: play, enable: enable, enabled: on };
})();
