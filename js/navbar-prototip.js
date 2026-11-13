/* Prototip: bara de jos de pe telefon, 7 taburi, doar imagini. Nu e legat de pagini reale. */
(function () {
  'use strict';
  var tb = document.getElementById('tb'), ind = document.getElementById('tbInd'), screen = document.getElementById('screen'), phone = document.getElementById('phone');
  var tabs = Array.prototype.slice.call(tb.querySelectorAll('.tb-b'));
  var order = tabs.map(function (b) { return b.dataset.tab; });
  var cur = null;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function place(animate) {
    var b = tabs[order.indexOf(cur)]; if (!b) return;
    ind.style.transition = animate && !reduce ? '' : 'none';
    ind.style.width = b.offsetWidth + 'px';
    ind.style.height = b.offsetHeight + 'px';
    ind.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    if (!animate) { void ind.offsetWidth; ind.style.transition = ''; }
  }
  function show(name, o) {
    o = o || {};
    if (order.indexOf(name) < 0) name = 'invata';
    var first = cur === null, dir = first ? 0 : (order.indexOf(name) > order.indexOf(cur) ? 1 : -1);
    cur = name;
    tabs.forEach(function (b) {
      var on = b.dataset.tab === name;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      if (on && !first && !reduce) { b.classList.remove('hop'); void b.offsetWidth; b.classList.add('hop'); }
    });
    screen.querySelectorAll('.scr').forEach(function (s) {
      var on = s.dataset.screen === name;
      s.hidden = !on;
      if (on) { s.style.setProperty('--dir', dir); s.classList.remove('in'); void s.offsetWidth; if (!first && !reduce) s.classList.add('in'); }
    });
    screen.scrollTop = 0;
    place(!first);
    if (o.focus) tabs[order.indexOf(name)].focus();
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ }
  }

  tb.addEventListener('click', function (e) { var b = e.target.closest('.tb-b'); if (b) show(b.dataset.tab); });
  tb.addEventListener('keydown', function (e) {
    var i = order.indexOf(cur), n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % order.length; else if (e.key === 'ArrowLeft') n = (i + order.length - 1) % order.length;
    else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = order.length - 1;
    if (n !== null) { e.preventDefault(); show(order[n], { focus: true }); }
  });

  /* trecere între taburi cu un gest orizontal pe ecran */
  var sx = 0, sy = 0, st = 0;
  screen.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
  screen.addEventListener('touchend', function (e) {
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 && Date.now() - st < 500) { var i = order.indexOf(cur) + (dx < 0 ? 1 : -1); if (i >= 0 && i < order.length) show(order[i]); }
  }, { passive: true });

  window.addEventListener('resize', function () { place(false); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(false); });

  /* controale de probă */
  var dark = document.getElementById('optDark'), lab = document.getElementById('optLabel');
  dark.onchange = function () { document.documentElement.setAttribute('data-theme', dark.checked ? 'dark' : 'light'); };
  lab.onchange = function () { phone.classList.toggle('labels', lab.checked); setTimeout(function () { place(false); }, 0); };
  if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) { dark.checked = true; dark.onchange(); }

  show((location.hash || '').replace('#', '') || 'invata');
})();
