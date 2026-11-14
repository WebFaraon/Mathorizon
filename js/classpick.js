/* ============================================================
   Clasa aleasă, o singură dată pentru tot site-ul (Învață și Exerciții).
   Butonul "Clasa a VII-a" din rândul de sus (telefon, tabletă și laptop) deschide o fereastră mică cu clasele V-XII. Alegerea se
   ține în browser și o citesc ambele pagini, deci nu mai trebuie schimbată din două locuri.

   - Elevul schimbă clasa lui reală (bm_grade, plus set_student_grade în baza de date, ca în fereastra de pe Învață).
   - Profesorul și adminul doar privesc o clasă (bm_grade_view): nu se schimbă nimic în cont.
   - Dacă nu s-a ales nimic: clasa elevului din cont, altfel a VII-a (singura cu lecții acum).
   Cine vrea să reacționeze la o schimbare ascultă evenimentul "bm:grade" (detail.grade) de pe window.
   ============================================================ */
(function () {
  'use strict';
  if (window.BMGrade) return;

  var ROMAN = { 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII' };
  var KEYS = [5, 6, 7, 8, 9, 10, 11, 12];

  function num(k) { try { var g = parseInt(localStorage.getItem(k) || '', 10); return g >= 5 && g <= 12 ? g : 0; } catch (e) { return 0; } }
  function isStudent() { var r = window.BMAuth && window.BMAuth.role; return !r || r === 'elev'; }
  function get() { return num('bm_grade_view') || (isStudent() ? num('bm_grade') : 0) || 7; }
  function label(n) { return 'Clasa a ' + ROMAN[n || get()] + '-a'; }

  function set(n) {
    n = +n;
    if (!(n >= 5 && n <= 12)) return;
    try {
      if (isStudent()) { localStorage.setItem('bm_grade', String(n)); localStorage.removeItem('bm_grade_view'); }
      else localStorage.setItem('bm_grade_view', String(n));
    } catch (e) { /* ignore */ }
    var sb = isStudent() && window.BMAuth && window.BMAuth.supabase;
    if (sb) { try { Promise.resolve(sb.rpc('set_student_grade', { p_grade: n })).then(function () {}, function () {}); } catch (e) { /* migrarea poate lipsi: clasa rămâne în browser */ } }
    paint();
    try { window.dispatchEvent(new CustomEvent('bm:grade', { detail: { grade: n } })); } catch (e) { /* ignore */ }
  }

  function paint() {
    var t = label();
    var els = document.querySelectorAll('[data-class-label]');
    for (var i = 0; i < els.length; i++) if (els[i].textContent !== t) els[i].textContent = t;
    var sh = document.querySelectorAll('[data-class-short]'), r = ROMAN[get()];
    for (var j = 0; j < sh.length; j++) if (sh[j].textContent !== r) sh[j].textContent = r;
  }

  /* ---- fereastra de alegere ---- */
  var pop = null;
  function closePop() {
    if (!pop) return;
    var p = pop; pop = null;
    p.classList.remove('on');
    var b = document.getElementById('navClassBtn'); if (b) b.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onAway, true);
    window.removeEventListener('resize', closePop);
    setTimeout(function () { p.remove(); }, 160);
  }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closePop(); var b = document.getElementById('navClassBtn'); if (b) b.focus(); } }
  function onAway(e) { if (pop && !pop.contains(e.target) && !(e.target.closest && e.target.closest('#navClassBtn'))) closePop(); }

  function openPop(btn) {
    if (pop) { closePop(); return; }
    var cur = get();
    var d = document.createElement('div');
    d.className = 'cp-pop'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Alege clasa');
    d.innerHTML = '<p class="cp-pop__h">Alege clasa</p><p class="cp-pop__s">Parcursul și exercițiile se schimbă după clasa aleasă.</p><div class="cp-pop__g">' +
      KEYS.map(function (n) { return '<button type="button" class="cp-k' + (n === cur ? ' on' : '') + '" data-g="' + n + '"' + (n === cur ? ' aria-current="true"' : '') + '><b>' + ROMAN[n] + '</b><span>clasa a ' + n + '-a</span></button>'; }).join('') + '</div>';
    document.body.appendChild(d);
    var r = btn.getBoundingClientRect(), w = d.offsetWidth;
    d.style.top = Math.round(r.bottom + 8) + 'px';
    d.style.left = Math.round(Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w))) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { d.classList.add('on'); });
    d.addEventListener('click', function (e) {
      var k = e.target.closest && e.target.closest('[data-g]');
      if (!k) return;
      var n = +k.getAttribute('data-g');
      closePop();
      if (n !== cur) set(n);
    });
    pop = d;
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onAway, true);
    window.addEventListener('resize', closePop);
    var on = d.querySelector('.cp-k.on'); if (on) on.focus();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#navClassBtn');
    if (b) { e.preventDefault(); openPop(b); }
  });

  /* ---- scrie eticheta: navbarul vine din cache la primul cadru și se rescrie după încărcare ---- */
  function watch() {
    paint();
    var root = document.getElementById('nav-root');
    if (root && !root.__cpWatch) { root.__cpWatch = true; new MutationObserver(paint).observe(root, { childList: true, subtree: true }); }
    return !!root;
  }
  if (!watch()) {
    var mo = new MutationObserver(function () { if (watch()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
  ['DOMContentLoaded', 'nav:loaded', 'bmauth:ready', 'bmauth:synced', 'bm:onboarded'].forEach(function (ev) { document.addEventListener(ev, paint); });
  window.addEventListener('storage', function (e) { if (e.key === 'bm_grade' || e.key === 'bm_grade_view') { paint(); try { window.dispatchEvent(new CustomEvent('bm:grade', { detail: { grade: get() } })); } catch (x) { /* ignore */ } } });

  window.BMGrade = { get: get, set: set, label: label, roman: function (n) { return ROMAN[n]; }, paint: paint };
})();
