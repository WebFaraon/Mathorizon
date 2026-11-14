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
  var raw = {}, buf = {}, ctx = null, gain = null, tags = {};

  function on() { try { return localStorage.getItem('bm_sound') !== '0'; } catch (e) { return true; } }
  function enable(v) { try { localStorage.setItem('bm_sound', v ? '1' : '0'); } catch (e) { /* ignore */ } }

  /* fișierele se aduc din timp (sunt mici); se decodează când există contextul audio */
  function fetchAll() {
    Object.keys(FILES).forEach(function (k) {
      try {
        fetch(FILES[k]).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (a) { if (a) { raw[k] = a; decode(k); } }, function () { /* fără sunet */ });
      } catch (e) { /* fără sunet */ }
    });
  }
  function decode(k) {
    if (!ctx || !raw[k] || buf[k]) return;
    var a = raw[k].slice(0);
    try { ctx.decodeAudioData(a, function (b) { buf[k] = b; }, function () { /* ignore */ }); } catch (e) { /* ignore */ }
  }
  function wake() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { ctx = new AC(); gain = ctx.createGain(); gain.connect(ctx.destination); } catch (e) { ctx = null; } }
      Object.keys(FILES).forEach(decode);
    }
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
  }

  var last = 0;
  function play(name) {
    if (!on() || !FILES[name]) return;
    var now = Date.now();
    if (name === 'click' && now - last < 40) return;
    if (name === 'click') last = now;
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
      var a = tags[name] || (tags[name] = new Audio(FILES[name]));
      a.volume = VOL[name] || 0.7; a.currentTime = 0;
      var p = a.play(); if (p && p.catch) p.catch(function () { /* blocat până la prima atingere */ });
    } catch (e) { /* fără sunet */ }
  }

  /* clic pe orice buton sau legătură: la apăsare, nu la ridicarea degetului, ca să se audă pe loc */
  var CLICKABLE = 'button, a[href], [role="button"], [role="tab"], summary, input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], label[for], .nd';
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var t = e.target && e.target.closest ? e.target.closest(CLICKABLE) : null;
    if (!t) { wake(); return; }
    if (t.disabled || t.getAttribute('aria-disabled') === 'true' || t.hasAttribute('data-nosound')) return;
    play('click');
  }, true);
  /* tastatura: Enter și Spațiu pe un buton care nu a primit pointerdown */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (t && t.tagName === 'BUTTON' && !t.disabled && !e.repeat) play('click');
  }, true);

  fetchAll();
  window.BMSfx = { play: play, enable: enable, enabled: on };
})();
