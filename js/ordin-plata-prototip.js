/* Ordin de plată: machetă. Fără bază de date, fără trimiteri nicăieri. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie',
    'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

  function fmtDate(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

  // 1200 -> "1 200,00"
  function fmtMoney(txt) {
    var n = parseFloat(String(txt).replace(/\s/g, '').replace(',', '.'));
    if (!isFinite(n) || n < 0) return '0,00';
    var parts = n.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts[0] + ',' + parts[1];
  }

  // Cod QR de exemplu (desen, nu se scanează): trei repere în colțuri și puncte fixe pe baza textului.
  function fakeQr(seedText) {
    var N = 29, svg = $('oQr'), h = 2166136261;
    for (var i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); }
    function rnd() { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; }
    var cells = '';
    function finder(x, y) {
      cells += '<rect x="' + x + '" y="' + y + '" width="7" height="7" fill="#1E1631"/>' +
        '<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="5" height="5" fill="#fff"/>' +
        '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" fill="#1E1631"/>';
    }
    function inFinder(x, y) {
      return (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    }
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (inFinder(x, y)) continue;
      if (rnd() > 0.52) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#1E1631"/>';
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    svg.innerHTML = '<rect width="29" height="29" fill="#fff"/>' + cells;
  }

  function paint() {
    var elev = $('fElev').value, plat = $('fPlatitor').value.trim() || '...',
      grupa = $('fGrupa').value.trim(), perioada = $('fPerioada').value.trim(),
      link = $('fLink').value.trim();
    $('oSuma').textContent = fmtMoney($('fSuma').value);
    $('oPlatitor').textContent = plat;
    $('oElev').textContent = elev;
    $('oGrupa').textContent = grupa;
    var scop = 'Plata lecțiilor de matematică, elev ' + elev +
      (grupa ? ', grupa ' + grupa : '') + (perioada ? ', ' + perioada : '');
    $('oScop').textContent = scop;
    var d = $('fData').value ? new Date($('fData').value + 'T12:00:00') : null;
    $('oData').textContent = d ? fmtDate(d) : '...';
    $('oEmis').textContent = fmtDate(new Date());
    $('oBtn').setAttribute('href', link || '#');
    fakeQr(link + '|' + $('fSuma').value);
  }

  ['fElev', 'fPlatitor', 'fGrupa', 'fSuma', 'fData', 'fPerioada', 'fLink'].forEach(function (id) {
    $(id).addEventListener('input', paint);
    $(id).addEventListener('change', paint);
  });
  $('bPrint').addEventListener('click', function () { window.print(); });
  $('bCopy').addEventListener('click', function () {
    var v = $('fLink').value, b = $('bCopy');
    function done() { var t = b.textContent; b.textContent = 'Copiat'; setTimeout(function () { b.textContent = t; }, 1400); }
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, done); else done();
  });
  paint();
})();
