/* ============================================================
   Scene cu bufnița pe marginile hărții de lecții (Învață), ca la Duolingo: personaje care fac câte ceva, în buclă, fără să
   atragă atenția de la lecții. Nu apar la fiecare pas: câte una la fiecare al treilea nod, pe partea opusă nodului.
   Cinci scene: citește pe un morman de cărți, doarme sub lună, se gândește (formule care plutesc), sare de bucurie
   (confeti), scrie într-un caiet. Bufnița e mascota (js/mascot.js, prin js/owl.js: stare + accesorii), restul sunt SVG și CSS
   (css/parcurs.css, blocul "scene"). Se văd doar când coloana are loc (container query) și se opresc când ies din ecran
   și la "reduce motion".
   ============================================================ */
(function () {
  'use strict';
  var KINDS = ['read', 'think', 'sleep', 'write', 'hop'];
  var n = 0;

  var BOOKS = '<svg class="scn__prop scn__books" viewBox="0 0 120 60" aria-hidden="true">' +
    '<rect x="14" y="36" width="92" height="20" rx="6" fill="#2C1952" transform="translate(0 3)"/><rect x="14" y="36" width="92" height="20" rx="6" fill="#5B2FB3"/><rect x="22" y="43" width="40" height="4" rx="2" fill="#CFC4E8"/>' +
    '<rect x="22" y="18" width="80" height="18" rx="6" fill="#C95A08" transform="translate(0 3)"/><rect x="22" y="18" width="80" height="18" rx="6" fill="#FF8A12"/><rect x="30" y="25" width="30" height="4" rx="2" fill="#FFF3B0"/>' +
    '<rect x="30" y="2" width="66" height="16" rx="6" fill="#4C7A00" transform="translate(0 3)"/><rect x="30" y="2" width="66" height="16" rx="6" fill="#7BB403"/><rect x="38" y="8" width="26" height="4" rx="2" fill="#E3F3C2"/></svg>';
  var MOON = '<svg class="scn__prop scn__moon" viewBox="0 0 120 70" aria-hidden="true">' +
    '<path d="M86 8A26 26 0 1 0 100 52A22 22 0 0 1 86 8Z" fill="#E0A800" transform="translate(0 3)"/><path d="M86 8A26 26 0 1 0 100 52A22 22 0 0 1 86 8Z" fill="#FFD23F"/>' +
    '<g class="tw"><path d="M18 18Q18.8 21.2 22 22Q18.8 22.8 18 26Q17.2 22.8 14 22Q17.2 21.2 18 18Z" fill="#7BB403"/></g><g class="tw tw2"><path d="M104 40Q104.7 42.3 107 43Q104.7 43.7 104 46Q103.3 43.7 101 43Q103.3 42.3 104 40Z" fill="#5B2FB3"/></g></svg>';
  var CUSHION = '<svg class="scn__prop scn__cush" viewBox="0 0 120 40" aria-hidden="true"><ellipse cx="60" cy="24" rx="52" ry="14" fill="#2C1952" transform="translate(0 4)"/><ellipse cx="60" cy="24" rx="52" ry="14" fill="#5B2FB3"/><ellipse cx="60" cy="20" rx="34" ry="7" fill="#7C58D1"/></svg>';
  var SYM = '<span class="scn__sym s1">π</span><span class="scn__sym s2">∑</span><span class="scn__sym s3">√</span><span class="scn__sym s4">x²</span>';
  var PAPER = '<svg class="scn__prop scn__paper" viewBox="0 0 90 100" aria-hidden="true">' +
    '<rect x="8" y="6" width="74" height="88" rx="9" fill="#CFC4E8" transform="translate(0 4)"/><rect x="8" y="6" width="74" height="88" rx="9" fill="#FFFFFF" stroke="#CFC4E8" stroke-width="2"/>' +
    '<path class="ln l1" d="M20 28H62" stroke="#5B2FB3" stroke-width="4" stroke-linecap="round" fill="none"/><path class="ln l2" d="M20 44H70" stroke="#7BB403" stroke-width="4" stroke-linecap="round" fill="none"/><path class="ln l3" d="M20 60Q30 52 40 60T60 60" stroke="#FF8A12" stroke-width="4" stroke-linecap="round" fill="none"/>' +
    '<rect x="8" y="6" width="74" height="14" rx="9" fill="#5B2FB3"/><rect x="8" y="12" width="74" height="8" fill="#5B2FB3"/></svg>';
  var CONF = '<i class="scn__cf c1"></i><i class="scn__cf c2"></i><i class="scn__cf c3"></i><i class="scn__cf c4"></i><i class="scn__cf c5"></i>';

  function owl(mood, look) {
    return '<span class="scn__owl"><span class="owl" data-owl="' + mood + '"' + (look ? ' data-owl-look="' + look + '"' : '') + ' aria-hidden="true"></span></span>';
  }

  /* markup of the scene number i (they cycle); side: -1 left, 1 right of the path */
  function html(side) {
    var kind = KINDS[n++ % KINDS.length], inner;
    if (kind === 'read') inner = BOOKS + owl('idle', 'book');
    else if (kind === 'sleep') inner = MOON + CUSHION + owl('sleep');
    else if (kind === 'think') inner = SYM + owl('think');
    else if (kind === 'write') inner = PAPER + owl('idle', 'pencil');
    else inner = CONF + owl('happy');
    return '<div class="scn scn--' + kind + '" style="--sx:' + (side * 236) + '" aria-hidden="true"><span class="scn__shadow"></span>' + inner + '</div>';
  }
  function reset() { n = 0; }

  /* the owls come to life, and the animation runs only while the scene is on the screen */
  var io = null;
  function mount(root) {
    if (!root) return;
    var list = root.querySelectorAll('.scn');
    if (!list.length) return;
    if (window.BMOwl) root.querySelectorAll('.scn .owl:not(.is-owl)').forEach(function (el) { window.BMOwl.mount(el, el.getAttribute('data-owl'), {}); });
    if (!('IntersectionObserver' in window)) { list.forEach(function (e) { e.classList.add('is-in'); }); return; }
    if (!io) io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('is-in', e.isIntersecting); }); }, { rootMargin: '80px' });
    list.forEach(function (e) { io.observe(e); });
  }

  window.PMScenes = { html: html, mount: mount, reset: reset };
})();
