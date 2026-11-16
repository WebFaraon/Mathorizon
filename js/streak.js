/* Fereastra seriei (2026-11-17): se deschide din flacăra din rândul de sus. Se încarcă la prima apăsare (js/utils.js).
   Citește seria din BM.Storage.getStreakInfo(); seria crește doar din lecțiile din Învață. */
(function () {
  'use strict';
  var NAMES = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
  var MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
  var el = null, anchor = null;

  function zile(n) { return n === 1 ? '1 zi' : (n % 100 === 0 || n % 100 >= 20) ? n + ' de zile' : n + ' zile'; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function html() {
    var S = window.BM && BM.Storage, info = S && S.getStreakInfo ? S.getStreakInfo() : { count: 0, days: [], doneToday: false };
    /* ultimele 7 zile, azi în dreapta: se vede de când a pornit seria */
    var n = info.count, now = new Date(), week = '', i, d, iso, on, today;
    for (i = 6; i >= 0; i--) {
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); iso = S.isoDate(d);
      on = info.days.indexOf(iso) !== -1; today = i === 0;
      week += '<div class="stk-d' + (on ? ' on' : '') + (today ? ' today' : '') + '"><span>' + (today ? 'Azi' : NAMES[(d.getDay() + 6) % 7]) + '</span><i>' +
        (on ? '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M4.5 10.5 8.5 14.5 15.5 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') + '</i></div>';
    }
    var title = n > 0 ? 'Serie de ' + zile(n) : 'Nicio serie încă';
    var sub = n === 0 ? 'Termină o lecție în Învață ca să începi o serie.' : info.doneToday ? 'Ai făcut o lecție azi. Revino mâine ca seria să crească.' : 'Fă o lecție azi ca să nu pierzi seria.';
    var since = '';
    if (n > 0 && info.startDate) { var p = info.startDate.split('-'); since = 'Începută pe ' + Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1]; }
    var foot = info.doneToday
      ? '<div class="stk-ok"><img src="assets/images/gamification/bifa.svg" alt="" width="26" height="26">Seria de azi e salvată</div>'
      : '<a class="stk-go" href="parcurs.html">Începe o lecție</a>';
    return '<div class="stk__head"><div class="stk__t"><h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p></div>' +
      '<img src="assets/images/gamification/streak.svg" alt="" width="84" height="84"></div>' +
      '<div class="stk__week">' + week + '</div>' +
      '<div class="stk__body">' + (since ? '<div class="stk-since">' + esc(since) + '</div>' : '') +
      foot + '</div>';
  }

  function place() {
    if (!el || !anchor) return;
    var r = anchor.getBoundingClientRect(), plate = anchor.closest('.nav__right') || anchor, pr = plate.getBoundingClientRect();
    var w = Math.min(380, window.innerWidth - 24);
    el.style.width = w + 'px';
    var right = Math.min(pr.right, window.innerWidth - 12);
    el.style.left = Math.max(12, right - w) + 'px';
    el.style.top = (pr.bottom + 12) + 'px';
    var cx = r.left + r.width / 2 - Math.max(12, right - w);
    el.style.setProperty('--stk-arrow', Math.max(24, Math.min(w - 24, cx)) + 'px');
  }
  function close() {
    if (!el) return;
    var e = el; el = null;
    e.classList.remove('on'); setTimeout(function () { e.remove(); }, 160);
    if (anchor) anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDoc, true); document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
  }
  function onDoc(e) { if (el && !el.contains(e.target) && !(anchor && anchor.contains(e.target))) close(); }
  function onKey(e) { if (e.key === 'Escape') { close(); if (anchor) anchor.focus(); } }
  function open(a) {
    anchor = a; if (el) return;
    el = document.createElement('div'); el.className = 'stk'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Seria ta');
    el.innerHTML = html(); document.body.appendChild(el); place();
    a.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { el && el.classList.add('on'); });
    document.addEventListener('mousedown', onDoc, true); document.addEventListener('keydown', onKey, true); window.addEventListener('resize', place);
  }
  window.BMStreak = { toggle: function (a) { if (el) close(); else open(a); }, close: close };
})();
