/* ============================================================
   Teorema: bara de jos de pe telefon (7 taburi, doar imagini).
   Rulează în <head>, deci bara e acolo din primul cadru. Se vede doar pe telefon (până la 600px) și doar pentru un cont conectat
   (stilurile sunt în css/bnav.css, după clasele html.bm-authed / bm-guest puse de auth-hint.js). Pe laptop nu se vede nimic din ea.
   Taburile sunt pagini aparte: Profil, Învață, Exerciții, Simulare, Antrenament, Clase, Misiuni.
   ============================================================ */
(function () {
  'use strict';
  var TABS = [
    ['profil', 'profile.html', 'Profil'],
    ['invata', 'parcurs.html', 'Învață'],
    ['exercitii', 'capitole.html', 'Exerciții'],
    ['simulare', 'bac.html?new=1', 'Simulare'],
    ['antrenament', 'training.html', 'Antrenament'],
    ['clase', 'classes.html', 'Clase'],
    ['misiuni', 'misiuni.html', 'Misiuni']
  ];
  var PAGE = {
    'profile': 'profil', 'parcurs': 'invata', 'capitole': 'exercitii', 'category': 'exercitii', 'adauga-exercitiu': 'exercitii',
    'bac': 'simulare', 'training': 'antrenament', 'classes': 'clase', 'class': 'clase', 'misiuni': 'misiuni'
  };
  var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase().replace(/\.html$/, '');
  var active = PAGE[file] || '';
  var idx = -1, i;
  for (i = 0; i < TABS.length; i++) if (TABS[i][0] === active) idx = i;

  var prev = -1;
  try { prev = parseInt(sessionStorage.getItem('bnav_prev'), 10); if (isNaN(prev)) prev = -1; if (idx >= 0) sessionStorage.setItem('bnav_prev', String(idx)); } catch (e) { /* ignore */ }

  function build() {
    var nav = document.createElement('nav');
    nav.id = 'bnav'; nav.setAttribute('aria-label', 'Navigare principală');
    var h = '<i class="bn-ind" aria-hidden="true"></i>';
    TABS.forEach(function (t, n) {
      h += '<a class="bn-b' + (n === idx ? ' on' : '') + '" href="' + t[1] + '" data-tab="' + t[0] + '" aria-label="' + t[2] + '" title="' + t[2] + '"' + (n === idx ? ' aria-current="page"' : '') + '>' +
        '<img src="assets/images/tabs/' + t[0] + '.svg" alt="" width="34" height="34" decoding="async"></a>';
    });
    nav.innerHTML = h;
    var ind = nav.firstChild;
    var from = prev >= 0 && prev !== idx ? prev : idx;
    nav.style.setProperty('--i', String(Math.max(0, from)));
    if (idx < 0) nav.classList.add('bn-none');
    document.body.appendChild(nav);
    if (from !== idx && idx >= 0) {
      /* alunecă de la tabul pe care erai la cel nou */
      requestAnimationFrame(function () { requestAnimationFrame(function () { nav.style.setProperty('--i', String(idx)); ind.classList.add('go'); }); });
    }
  }

  function put() {
    if (!document.body) return false;
    if (!document.getElementById('bnav')) build();
    return true;
  }
  if (!put()) {
    var mo = new MutationObserver(function () { if (put()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true });
  }

  /* în sala de examen (Simulare) bara dispare, ca să nu încurce */
  document.addEventListener('DOMContentLoaded', function () {
    var ex = document.getElementById('examView');
    if (!ex) return;
    var de = document.documentElement;
    var sync = function () { de.classList.toggle('bnav-off', getComputedStyle(ex).display !== 'none'); };
    new MutationObserver(sync).observe(ex, { attributes: true, attributeFilter: ['style', 'class'] });
    sync();
  });
})();
