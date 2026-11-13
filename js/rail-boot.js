/* Panoul de profil din stânga, prezent din primul cadru (ca navbarul): cum apare <body>, punem în el ultimul panou desenat,
   păstrat în localStorage de js/rail.js. Rulează în <head>, deci nu așteaptă nicio rețea. Detalii: js/rail.js. */
(function () {
  'use strict';
  try {
    var de = document.documentElement;
    if (window.innerWidth < 1180 || !de.classList.contains('bm-authed')) return;
    var raw = localStorage.getItem('bm_rail_html_v1');
    if (!raw) return;
    var cached = JSON.parse(raw) || {}, html = cached.html;
    if (!html) return;
    var put = function () {
      if (!document.body) return false;
      if (!document.body.hasAttribute('data-rail')) return true;
      if (!document.getElementById('appRail')) {
        var a = document.createElement('aside');
        a.id = 'appRail'; a.className = 'app-rail'; a.setAttribute('aria-label', 'Profilul tău');
        a.innerHTML = html; if (cached.sig) a.setAttribute('data-sig', cached.sig);
        document.body.insertBefore(a, document.body.firstChild);
      }
      return true;
    };
    if (!put()) {
      var mo = new MutationObserver(function () { if (put()) mo.disconnect(); });
      mo.observe(de, { childList: true });
    }
  } catch (e) { /* fara panou pana la prima desenare */ }
})();
