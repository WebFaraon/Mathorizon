/* Prezentarea echipei: scena de 1920 x 1080 scalata in fereastra, slide-uri cu pasi (punctele apar pe rand),
   tastele: sageti / spatiu (inainte, inapoi), Home / End, F (ecran complet), T (deschis / inchis), M (harta), Esc. */
(function () {
  'use strict';
  var stage = document.getElementById('stage');
  var slides = Array.prototype.slice.call(stage.querySelectorAll('.slide'));
  var cur = 0, step = 0, steps = [];
  var bar = document.querySelector('#progress i'), cnt = document.getElementById('cnt');

  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = 'scale(' + s + ')';
  }
  function rvOf(i) { return Array.prototype.slice.call(slides[i].querySelectorAll('.rv')); }
  function paint() {
    slides.forEach(function (sl, i) {
      sl.classList.toggle('is-on', i === cur);
      sl.classList.toggle('is-past', i < cur);
      var all = document.body.classList.contains('all');
      rvOf(i).forEach(function (el, k) { el.classList.toggle('on', all || i < cur || (i === cur && k < step)); });
    });
    bar.style.width = ((cur + 1) / slides.length * 100) + '%';
    cnt.textContent = (cur + 1) + ' / ' + slides.length;
    try { history.replaceState(null, '', '#' + (cur + 1)); } catch (e) {}
    document.title = (slides[cur].getAttribute('data-title') || 'Prezentare') + ' | Teorema';
    var m = document.querySelector('#map li button.on'); if (m) m.classList.remove('on');
    var b = document.querySelectorAll('#map li button')[cur]; if (b) b.classList.add('on');
  }
  function next() {
    var n = rvOf(cur).length;
    if (step < n) { step++; paint(); return; }
    if (cur < slides.length - 1) { cur++; step = 0; paint(); }
  }
  function prev() {
    if (step > 0) { step--; paint(); return; }
    if (cur > 0) { cur--; step = rvOf(cur).length; paint(); }
  }
  function go(i) { cur = Math.max(0, Math.min(slides.length - 1, i)); step = 0; paint(); }

  // harta
  var map = document.getElementById('map'), ol = map.querySelector('ol');
  slides.forEach(function (sl, i) {
    var li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.innerHTML = '<em>' + (i + 1) + '</em>' + (sl.getAttribute('data-title') || 'Slide ' + (i + 1));
    b.addEventListener('click', function () { map.classList.remove('is-on'); go(i); });
    li.appendChild(b); ol.appendChild(li);
  });
  function toggleMap() { map.classList.toggle('is-on'); }

  function toggleTheme() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('theme', dark ? 'light' : 'dark'); } catch (e) {}
    // bufnitele isi iau varianta potrivita la schimbare
    var ev = document.createEvent('Event'); ev.initEvent('bm:theme', true, true); document.dispatchEvent(ev);
  }
  function toggleFull() {
    if (!document.fullscreenElement) { (document.documentElement.requestFullscreen || function () {}).call(document.documentElement); }
    else { document.exitFullscreen(); }
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (map.classList.contains('is-on')) { if (k === 'Escape' || k === 'm' || k === 'M') toggleMap(); return; }
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown' || k === 'Enter') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(slides.length - 1);
    else if (k === 'f' || k === 'F') toggleFull();
    else if (k === 't' || k === 'T') toggleTheme();
    else if (k === 'm' || k === 'M') toggleMap();
  });

  // atingere: glisare stanga / dreapta, atingere pe jumatatea din dreapta = inainte
  var sx = 0, sy = 0, st = 0;
  document.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (e.target.closest && e.target.closest('#hud, #map')) return;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); }
    else if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && Date.now() - st < 400) { t.clientX > window.innerWidth / 2 ? next() : prev(); }
  }, { passive: true });

  document.getElementById('bPrev').addEventListener('click', prev);
  document.getElementById('bNext').addEventListener('click', next);
  document.getElementById('bMap').addEventListener('click', toggleMap);
  document.getElementById('bTheme').addEventListener('click', toggleTheme);
  document.getElementById('bFull').addEventListener('click', toggleFull);
  map.addEventListener('click', function (e) { if (e.target === map) toggleMap(); });

  // HUD: apare cand misti mouse-ul, dispare dupa cateva secunde
  var hudT;
  document.addEventListener('mousemove', function () { document.body.classList.add('hud-on'); clearTimeout(hudT); hudT = setTimeout(function () { document.body.classList.remove('hud-on'); }, 2600); });

  window.addEventListener('hashchange', function () { var n = parseInt((location.hash || '').slice(1), 10); if (n >= 1 && n <= slides.length && n - 1 !== cur) go(n - 1); });
  window.addEventListener('resize', fit);
  try { var th = localStorage.getItem('theme'); if (th === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}
  var h = parseInt((location.hash || '').slice(1), 10);
  fit();
  if (h >= 1 && h <= slides.length) { cur = h - 1; }
  // ?toate sau ?print: toate punctele sunt vizibile (pentru PDF)
  if (/[?&](toate|print)\b/.test(location.search)) { step = 999; document.body.classList.add('all'); slides.forEach(function (s) { s.querySelectorAll('.rv').forEach(function (e) { e.classList.add('on'); }); }); }
  paint();
})();
