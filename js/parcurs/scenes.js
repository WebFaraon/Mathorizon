/* ============================================================
   Scene cu bufnița pe marginile hărții de lecții (Învață), ca la Duolingo: personaje care fac câte ceva, în buclă, fără să
   atragă atenția de la lecții. Două pe secțiune: una în stânga (la al doilea nod) și una în dreapta (la al cincilea), mereu pe
   partea opusă nodului. Opt scene: bea o cafea, se gândește (formule care plutesc), sare de bucurie (confeti), doarme sub lună, salută, scrie într-un caiet, privește stelele,
   ascultă muzică. Bufnița e mascota (js/mascot.js, prin js/owl.js: stare + accesorii), restul sunt SVG și CSS
   (css/parcurs.css, blocul "scene"). Pe laptop sunt la mărime întreagă, pe telefon mai mici, lipite de margine; se opresc când
   ies din ecran și la "reduce motion".
   ============================================================ */
(function () {
  'use strict';
  var KINDS = ['coffee', 'think', 'hop', 'sleep', 'wave', 'write', 'stars', 'music'];
  var SAY = ['Hei!', 'Bravo!', 'Hai!', 'Tu poți!', 'Super!'];
  var n = 0, lastSide = -1;

  var MOON = '<svg class="scn__prop scn__moon" viewBox="0 0 120 70" aria-hidden="true">' +
    '<path d="M86 8A26 26 0 1 0 100 52A22 22 0 0 1 86 8Z" fill="#E0A800" transform="translate(0 3)"/><path d="M86 8A26 26 0 1 0 100 52A22 22 0 0 1 86 8Z" fill="#FFD23F"/>' +
    '<g class="tw"><path d="M18 18Q18.8 21.2 22 22Q18.8 22.8 18 26Q17.2 22.8 14 22Q17.2 21.2 18 18Z" fill="#7BB403"/></g><g class="tw tw2"><path d="M104 40Q104.7 42.3 107 43Q104.7 43.7 104 46Q103.3 43.7 101 43Q103.3 42.3 104 40Z" fill="#5B2FB3"/></g></svg>';
  var CUSHION = '<svg class="scn__prop scn__cush" viewBox="0 0 120 48" aria-hidden="true"><ellipse cx="60" cy="24" rx="52" ry="14" fill="#2C1952" transform="translate(0 4)"/><ellipse cx="60" cy="24" rx="52" ry="14" fill="#5B2FB3"/><ellipse cx="60" cy="20" rx="34" ry="7" fill="#7C58D1"/></svg>';
  var SYM = '<span class="scn__sym s1">π</span><span class="scn__sym s2">∑</span><span class="scn__sym s3">√</span><span class="scn__sym s4">x²</span>';
  var PAPER = '<svg class="scn__prop scn__paper" viewBox="0 0 90 100" aria-hidden="true">' +
    '<rect x="8" y="6" width="74" height="88" rx="9" fill="#CFC4E8" transform="translate(0 4)"/><rect x="8" y="6" width="74" height="88" rx="9" fill="#FFFFFF" stroke="#CFC4E8" stroke-width="2"/>' +
    '<path class="ln l1" d="M20 28H62" stroke="#5B2FB3" stroke-width="4" stroke-linecap="round" fill="none"/><path class="ln l2" d="M20 44H70" stroke="#7BB403" stroke-width="4" stroke-linecap="round" fill="none"/><path class="ln l3" d="M20 60Q30 52 40 60T60 60" stroke="#FF8A12" stroke-width="4" stroke-linecap="round" fill="none"/>' +
    '<rect x="8" y="6" width="74" height="14" rx="9" fill="#5B2FB3"/><rect x="8" y="12" width="74" height="8" fill="#5B2FB3"/></svg>';
  var CONF = '<i class="scn__cf c1"></i><i class="scn__cf c2"></i><i class="scn__cf c3"></i><i class="scn__cf c4"></i><i class="scn__cf c5"></i>';

  var MUG = '<svg class="scn__prop scn__mug" viewBox="0 0 60 60" aria-hidden="true">' +
    '<path d="M44 20h4a8 8 0 0 1 0 16h-4" fill="none" stroke="#2C1952" stroke-width="5" stroke-linecap="round" transform="translate(0 3)"/><path d="M44 20h4a8 8 0 0 1 0 16h-4" fill="none" stroke="#5B2FB3" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M8 18h38v20a14 14 0 0 1-14 14h-10a14 14 0 0 1-14-14z" fill="#2C1952" transform="translate(0 3)"/><path d="M8 18h38v20a14 14 0 0 1-14 14h-10a14 14 0 0 1-14-14z" fill="#5B2FB3"/><rect x="8" y="18" width="38" height="8" rx="3" fill="#7C58D1"/><path d="M16 32h14" stroke="#CFC4E8" stroke-width="4" stroke-linecap="round"/></svg>';
  var STEAM = '<svg class="scn__prop scn__steam" viewBox="0 0 60 50" aria-hidden="true"><path class="st st1" d="M16 48C10 38 22 32 16 20S22 6 18 0" fill="none" stroke="#B9AED3" stroke-width="4" stroke-linecap="round"/><path class="st st2" d="M30 48C24 38 36 32 30 20S36 6 32 0" fill="none" stroke="#B9AED3" stroke-width="4" stroke-linecap="round"/><path class="st st3" d="M44 48C38 38 50 32 44 20S50 6 46 0" fill="none" stroke="#B9AED3" stroke-width="4" stroke-linecap="round"/></svg>';
  var STARS = '<svg class="scn__prop scn__stars" viewBox="0 0 150 80" aria-hidden="true">' +
    '<g class="tw"><path d="M22 16Q23.6 24 32 26Q23.6 28 22 36Q20.4 28 12 26Q20.4 24 22 16Z" fill="#FFD23F"/></g>' +
    '<g class="tw tw2"><path d="M124 6Q125.2 12 131 13Q125.2 14 124 20Q122.8 14 117 13Q122.8 12 124 6Z" fill="#7BB403"/></g>' +
    '<g class="tw tw3"><path d="M136 46Q137.4 53 144 54Q137.4 55 136 62Q134.6 55 128 54Q134.6 53 136 46Z" fill="#7C58D1"/></g>' +
    '<g class="tw tw4"><path d="M6 56Q7 60.5 11 61Q7 61.5 6 66Q5 61.5 1 61Q5 60.5 6 56Z" fill="#FF8A12"/></g></svg>';
  var NOTES = '<span class="scn__note n1">♪</span><span class="scn__note n2">♫</span><span class="scn__note n3">♪</span>';

  function owl(mood, look) {
    return '<span class="scn__owl"><span class="owl" data-owl="' + mood + '"' + (look ? ' data-owl-look="' + look + '"' : '') + ' aria-hidden="true"></span></span>';
  }

  /* markup of the next scene; dx = where the node of this row stands (the scene goes on the opposite side) */
  function html(dx) {
    var kind = KINDS[n++ % KINDS.length], inner, side = dx > 0 ? -1 : dx < 0 ? 1 : -lastSide;
    lastSide = side;
    if (kind === 'sleep') inner = MOON + CUSHION + owl('sleep');
    else if (kind === 'think') inner = SYM + owl('think');
    else if (kind === 'write') inner = PAPER + owl('idle', 'pencil');
    else if (kind === 'coffee') inner = STEAM + MUG + owl('idle');
    else if (kind === 'wave') inner = '<span class="scn__say">' + SAY[n % SAY.length] + '</span>' + owl('happy');
    else if (kind === 'stars') inner = STARS + owl('idle', 'glasses');
    else if (kind === 'music') inner = NOTES + owl('happy');
    else inner = CONF + owl('happy');
    return '<div class="scn scn--' + kind + '" style="--sx:' + (side * 236) + ';--side:' + side + '" aria-hidden="true"><span class="scn__shadow"></span>' + inner + '</div>';
  }
  function reset() { n = 0; lastSide = -1; }

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
