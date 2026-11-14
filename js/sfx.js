/* ============================================================
   Sunete: un "click" discret la fiecare buton apăsat și sunetul de "răspuns corect" din lecții.
   Fișierele sunt în assets/sounds/ (click.mp3, correct.mp3). Se folosește Web Audio (fără întârziere la apăsare); dacă nu există,
   cade pe un element audio obișnuit. Browserul permite sunet abia după prima atingere, așa că totul pornește de la ea.
   Oprire: localStorage bm_sound = "0" (sau BMSfx.enable(false)). Cine citește BMSfx.play('correct') nu trebuie să știe de restul.
   ============================================================ */
(function () {
  'use strict';
  if (window.BMSfx) return;

  var FILES = { click: 'assets/sounds/click.mp3', correct: 'assets/sounds/correct.mp3' };
  var VOL = { click: 0.55, correct: 0.85 };
  var buf = {}, ctx = null, tags = {};

  function on() { try { return localStorage.getItem('bm_sound') !== '0'; } catch (e) { return true; } }
  function enable(v) { try { localStorage.setItem('bm_sound', v ? '1' : '0'); } catch (e) { /* ignore */ } }

  /* contextul audio se creează de la început (rămâne "suspendat" până la prima atingere) și fișierele se decodează imediat,
     așa că la prima apăsare sunetul e deja gata și nu mai are nimic de așteptat */
  (function init() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; } } }
    Object.keys(FILES).forEach(function (k) {
      try { var a = new Audio(); a.preload = 'auto'; a.src = FILES[k]; tags[k] = a; } catch (e) { /* ignore */ }
      if (!ctx) return;
      try {
        fetch(FILES[k]).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (ab) {
          if (!ab) return;
          ctx.decodeAudioData(ab, function (b) { buf[k] = b; }, function () { /* rămâne varianta simplă */ });
        }, function () { /* fără sunet */ });
      } catch (e) { /* fără sunet */ }
    });
  })();

  function wake() {
    if (ctx && ctx.state !== 'running') { try { ctx.resume(); } catch (e) { /* ignore */ } }
  }

  var last = 0;
  function play(name) {
    if (!on() || !FILES[name]) return;
    var now = Date.now();
    if (name === 'click') { if (now - last < 30) return; last = now; }
    wake();
    if (ctx && buf[name]) {
      try {
        var s = ctx.createBufferSource(), g = ctx.createGain();
        s.buffer = buf[name]; g.gain.value = VOL[name] || 0.7;
        s.connect(g); g.connect(ctx.destination); s.start(0);
        return;
      } catch (e) { /* încearcă varianta simplă */ }
    }
    try {
      var a = tags[name]; if (!a) return;
      /* o copie, ca două sunete apropiate să nu se taie între ele */
      var c = a.cloneNode(); c.volume = VOL[name] || 0.7;
      var p = c.play(); if (p && p.catch) p.catch(function () { /* blocat până la prima atingere */ });
    } catch (e) { /* fără sunet */ }
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
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var t = e.target && e.target.nodeType === 1 ? pressable(e.target) : null;
    if (!t) { wake(); return; }
    if (t.disabled || t.getAttribute('aria-disabled') === 'true' || t.closest('[data-nosound]')) return;
    play('click');
  }, true);
  /* unele telefoane (iPhone) deblochează sunetul abia la ridicarea degetului */
  ['touchend', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, wake, { capture: true, passive: true }); });
  /* tastatura: Enter și Spațiu pe un buton */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (t && t.tagName === 'BUTTON' && !t.disabled && !e.repeat) play('click');
  }, true);

  window.BMSfx = { play: play, enable: enable, enabled: on };
})();
