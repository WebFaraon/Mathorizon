/* ============================================================
   Teorema: the welcome after sign-in
   ============================================================
   One violet panel hides everything between pressing "Conectare" / "Creează cont" and
   the platform being ready: the Teorema owl (the one of the Logo Kit, js/mascot.js) greets in
   its happy pose and a slider fills as if the materials were loading.

   1. THE SIGN-IN PAGE. The panel goes up the moment the key is pressed, before the network
      answers (js/auth-page.js: TeoremaWelcome.start). A wrong password, or a sign-up that waits
      for an e-mail, takes it away again (cancel) and the form is where it was.
   2. WARM-UP. When the sign-in succeeds, the page that is next (Capitole, or the console) is
      loaded in a hidden frame while the slider crawls. The frame goes through whatever the page
      does on its own (checking the account, sending an admin or a manager to the console), so the
      page we finally go to is already known and its files are cached. The sign-in page is never
      reloaded meanwhile.
   3. THE HAND-OVER. When the frame has settled and the slider has had its moment, the slider
      fills and the browser goes to the page. The page paints the same violet panel before
      anything else (a pseudo-element of <html>, no flash), keeps it until it has settled itself,
      then fades it away. If the page reloads while the panel is up, the note that says "the
      welcome is running" is still there (it is removed only when the panel leaves), so the panel
      comes back at once instead of the blink showing.

   Same for every role. With "reduce motion" there is no animation, only the panel.
   Plain script; js/mascot.js is fetched when the panel is first needed.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'teorema_welcome';          // the note between pages (sessionStorage)
  var NOTE_TTL = 25 * 1000;             // a note older than this is stale
  var MAX_LOADS = 4;                    // the panel comes back after at most this many reloads
  var MIN_SHOW = 900;                   // the owl is on screen at least this long
  var WARM_MAX = 6000;                  // never wait longer for the warm-up
  var OUT_MS = 380;
  var root = document.documentElement;
  var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var inFrame = false;
  try { inFrame = window.top !== window.self; } catch (e) { inFrame = true; }

  var VIOLET = '#3F236E', VIOLET_DARK = '#2A1750';

  var CSS = [
    'html.tw-on::before{content:"";position:fixed;inset:0;z-index:2147483000;background:' + VIOLET + '}',
    'html[data-theme="dark"].tw-on::before{background:' + VIOLET_DARK + '}',
    '.tw{position:fixed;inset:0;z-index:2147483002;display:grid;place-items:center;padding:24px;background:' + VIOLET + ';color:#fff;font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;opacity:0;transition:opacity .28s ease;cursor:progress;touch-action:none;overscroll-behavior:none}',
    'html[data-theme="dark"] .tw{background:' + VIOLET_DARK + '}',
    '.tw.is-in,.tw.tw--resume{opacity:1}',
    '.tw::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:28px 28px;pointer-events:none}',
    '.tw__center{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;max-width:92vw;transition:transform ' + OUT_MS + 'ms cubic-bezier(.4,0,.2,1)}',
    '.tw__owl{width:min(250px,60vw);min-height:120px}',
    '.tw__owl svg{display:block;width:100%;height:auto;overflow:visible}',
    '.tw__hi{margin:6px 0 0;font-size:clamp(1.45rem,4.6vw,2rem);font-weight:800;letter-spacing:-.02em;line-height:1.15;transition:opacity .22s ease}',
    '.tw__hi.is-swap{opacity:0}',
    '.tw__sub{margin:0;font-size:.95rem;font-weight:600;color:rgba(255,255,255,.72)}',
    '.tw__bar{width:min(260px,64vw);height:8px;margin-top:10px;border-radius:999px;background:rgba(255,255,255,.18);overflow:hidden}',
    '.tw__bar i{display:block;width:100%;height:100%;border-radius:999px;background:#7BB403;transform-origin:left center;transform:scaleX(0);will-change:transform}',
    '.tw.is-out{opacity:0;pointer-events:none;transition-duration:' + OUT_MS + 'ms}',
    /* while the panel is up nothing under it can be scrolled or dragged */
    'html.tw-lock,html.tw-lock body{overflow:hidden!important}',
    '.tw.is-out .tw__center{transform:translateY(-10px) scale(1.04)}'
  ];
  var MOTION = [
    '@keyframes twPop{from{opacity:0;transform:translateY(26px) scale(.7)}}',
    '@keyframes twUp{from{opacity:0;transform:translateY(14px)}}',
    '.tw:not(.tw--resume) .tw__owl{animation:twPop .75s cubic-bezier(.16,1,.3,1) backwards}',
    '.tw:not(.tw--resume) .tw__hi{animation:twUp .6s .1s cubic-bezier(.16,1,.3,1) backwards}',
    '.tw:not(.tw--resume) .tw__sub{animation:twUp .6s .18s cubic-bezier(.16,1,.3,1) backwards}',
    '.tw:not(.tw--resume) .tw__bar{animation:twUp .5s .26s cubic-bezier(.16,1,.3,1) backwards}'
  ];

  var styled = false;
  function ensureStyle() {
    if (styled) return;
    styled = true;
    var st = document.createElement('style');
    st.setAttribute('data-teorema-welcome', '');
    st.textContent = CSS.join('\n') + (RM ? '' : '\n' + MOTION.join('\n'));
    (document.head || root).appendChild(st);
  }

  /* ---------- the mascot, fetched once ---------- */
  var mascotState = 0, mascotWaiters = [];      // 0 not asked, 1 loading, 2 ready (or failed)
  var base = (function () {
    var cur = document.currentScript && document.currentScript.src;
    return cur ? cur.replace(/welcome\.js(\?.*)?$/, '') : 'js/';
  })();
  function withMascot(cb) {
    if (mascotState === 2 || window.TeoremaMascot) { cb(); return; }
    mascotWaiters.push(cb);
    if (mascotState === 1) return;
    mascotState = 1;
    var s = document.createElement('script');
    s.src = base + 'mascot.js';
    function done() { mascotState = 2; var w = mascotWaiters; mascotWaiters = []; w.forEach(function (f) { f(); }); }
    s.onload = done; s.onerror = done;          // no owl rather than no panel
    (document.head || root).appendChild(s);
  }

  /* ---------- the note between pages ---------- */
  function writeNote(n) { try { sessionStorage.setItem(KEY, JSON.stringify(n)); } catch (e) { /* no storage: no hand-over */ } }
  function readNote() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      var n = JSON.parse(raw);
      if (!n || Date.now() - n.t > NOTE_TTL) { sessionStorage.removeItem(KEY); return null; }
      return n;
    } catch (e) { return null; }
  }
  function dropNote() { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  /* ---------- the panel ---------- */
  var cur = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function greetingText(name, mode) {
    var word = mode === 'signup' ? 'Bine ai venit' : 'Bine ai revenit';
    name = (name || '').trim();
    return name ? word + ', ' + name + '!' : word + '!';
  }

  function build(opts) {
    ensureStyle();
    var el = document.createElement('div');
    el.className = 'tw' + (opts.resume ? ' tw--resume' : '');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="tw__center">' +
        '<div class="tw__owl"></div>' +
        '<h2 class="tw__hi">' + esc(greetingText(opts.name, opts.mode)) + '</h2>' +
        '<p class="tw__sub">Se încarcă materialele…</p>' +
        '<div class="tw__bar" aria-hidden="true"><i></i></div>' +
      '</div>';
    (opts.into || document.body).appendChild(el);
    root.classList.add('tw-lock');
    var c = { el: el, owl: null, bar: el.querySelector('.tw__bar i'), hi: el.querySelector('.tw__hi'), p: opts.resume ? 1 : 0, max: 0.86,
              finishing: false, onFull: null, raf: 0, t0: Date.now(), mode: opts.mode, name: opts.name || '' };
    c.bar.style.transform = 'scaleX(' + c.p + ')';
    withMascot(function () {
      if (!c.el.parentNode || !window.TeoremaMascot) return;
      try { c.owl = new TeoremaMascot.Mascot(c.el.querySelector('.tw__owl'), { mood: 'happy', theme: 'dark' }); } catch (e) { c.owl = null; }
    });
    if (!opts.resume) { void el.offsetWidth; el.classList.add('is-in'); }
    return c;
  }

  function tick() {
    var c = cur;
    if (!c) return;
    if (RM) {
      c.bar.style.transform = 'scaleX(' + (c.finishing ? 1 : 0.9) + ')';
      if (c.finishing) { c.finishing = false; if (c.onFull) c.onFull(); }
      return;
    }
    if (c.finishing) c.p = Math.min(1, c.p + (1 - c.p) * 0.2 + 0.006);
    else c.p += (c.max - c.p) * 0.022;
    c.bar.style.transform = 'scaleX(' + c.p.toFixed(4) + ')';
    if (c.finishing && c.p >= 0.999) {
      c.bar.style.transform = 'scaleX(1)';
      c.finishing = false;
      if (c.onFull) c.onFull();
      return;
    }
    c.raf = requestAnimationFrame(tick);
  }

  function dispose(c, then) {
    if (!c) return;
    cancelAnimationFrame(c.raf);
    function gone() {
      root.classList.remove('tw-lock');
      if (c.owl && window.TeoremaMascot) TeoremaMascot.dispose(c.owl);
      if (c.el.parentNode) c.el.parentNode.removeChild(c.el);
      if (then) then();
    }
    if (RM) { gone(); return; }
    c.el.classList.add('is-out');
    setTimeout(gone, OUT_MS + 60);
  }

  /* ---------- API for the sign-in page ---------- */
  function start(opts) {
    opts = opts || {};
    if (cur) return cur;
    if (!document.body) return null;
    cur = build({ mode: opts.mode, name: opts.name, resume: false });
    if (!RM) cur.raf = requestAnimationFrame(tick); else tick();
    return cur;
  }

  /* the sign-in did not lead anywhere (wrong password, a sign-up waiting for an e-mail): the form is back */
  function cancel() {
    var c = cur;
    cur = null;
    root.classList.remove('tw-on');
    dispose(c);
  }

  function setName(name) {
    if (!cur || !name || cur.name === name) return;
    cur.name = name;
    var h = cur.hi;
    h.classList.add('is-swap');
    setTimeout(function () { h.textContent = greetingText(name, cur && cur.mode); h.classList.remove('is-swap'); }, RM ? 0 : 200);
  }

  /* load the next page in a hidden frame and wait until it has settled; cb gets the address it ended on.
     Only Capitole and the console: a class page would ask the student about notifications inside the hidden frame. */
  function warm(url, cb) {
    var path = String(url).split(/[?#]/)[0].split('/').pop();
    if (path !== 'capitole.html' && path !== 'admin.html') { cb(url); return; }
    var fr = document.createElement('iframe');
    fr.setAttribute('aria-hidden', 'true');
    fr.tabIndex = -1;
    fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:800px;border:0;visibility:hidden;pointer-events:none';
    var finished = false, lastPath = '', stableSince = 0, timer = 0;
    function end(final) {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      cb(final || url);
      setTimeout(function () { if (fr.parentNode) fr.parentNode.removeChild(fr); }, 1500);   // after the hand-over has started
    }
    var born = Date.now();
    timer = setInterval(function () {
      if (Date.now() - born > WARM_MAX) { end(url); return; }
      try {
        var w = fr.contentWindow, d = fr.contentDocument;
        if (!w || !d || d.readyState !== 'complete') { stableSince = 0; return; }
        var here = w.location.pathname.split('/').pop() + w.location.search;
        var known = w._bmAuthReady && w.BMAuth && (w.BMAuth.role || !w.BMAuth.user);
        if (!known || d.documentElement.classList.contains('bm-auth-pending')) { stableSince = 0; return; }
        if (here !== lastPath) { lastPath = here; stableSince = Date.now(); return; }
        if (Date.now() - stableSince > 450) end(w.location.pathname.split('/').pop() + w.location.search + w.location.hash);
      } catch (e) { end(url); }
    }, 90);
    document.body.appendChild(fr);
    fr.src = url;
  }

  /* the sign-in succeeded: warm the next page, fill the slider, hand over */
  function finish(url, info) {
    info = info || {};
    var c = cur || start({ mode: info.mode, name: info.name });
    if (!c) { window.location.replace(url); return; }
    if (info.name) setName(info.name);
    var warmed = false, shown = false, address = url;
    function ready() {
      if (!warmed || !shown) return;
      c.finishing = true;
      c.onFull = function () {
        writeNote({ t: Date.now(), name: c.name, mode: c.mode, resume: true, loads: 0 });
        setTimeout(function () { window.location.replace(address); }, RM ? 0 : 140);
      };
      if (RM) tick(); else { cancelAnimationFrame(c.raf); c.raf = requestAnimationFrame(tick); }
    }
    setTimeout(function () { shown = true; ready(); }, Math.max(0, MIN_SHOW - (Date.now() - c.t0)));
    warm(url, function (final) { address = final; warmed = true; ready(); });
  }

  window.TeoremaWelcome = { start: start, cancel: cancel, setName: setName, finish: finish };

  if (inFrame) return;                         // the warm-up frame never plays the panel

  /* ---------- the sign-in page: back from Google ---------- */
  var onAuthPage = /\/auth\.html$/.test(location.pathname);
  if (onAuthPage) {
    var fromGoogle = false;
    try {
      var t = Number(sessionStorage.getItem('teorema_oauth_welcome'));
      fromGoogle = !!t && Date.now() - t < 10 * 60 * 1000 && /access_token=|[?&]code=/.test(location.hash + location.search);
    } catch (e) { fromGoogle = false; }
    if (fromGoogle) {
      var intent = 'login';
      try { intent = (JSON.parse(localStorage.getItem('bm_oauth_intent') || '{}').intent) === 'signup' ? 'signup' : 'login'; } catch (e) { /* login */ }
      ensureStyle();
      root.classList.add('tw-on');
      waitForBody(function () { withMascot(function () { start({ mode: intent }); root.classList.remove('tw-on'); }); });
    } else {
      /* warm the mascot while the person types, so the panel has its owl the instant the key is pressed */
      document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { withMascot(function () {}); }, 300); });
    }
    return;
  }

  /* ---------- the destination: the same panel, in the very first frame ---------- */
  var note = readNote();
  if (!note || !note.resume) return;
  if ((note.loads || 0) >= MAX_LOADS) { dropNote(); return; }
  note.loads = (note.loads || 0) + 1;
  writeNote(note);

  ensureStyle();
  root.classList.add('tw-on');                 // violet from the first instant, even before the panel below exists

  function waitForBody(cb) {
    if (document.body) { cb(); return; }
    var mo = new MutationObserver(function () { if (document.body) { mo.disconnect(); cb(); } });
    mo.observe(root, { childList: true });
  }

  /* The panel is built NOW, from inside <head>, with the owl, the greeting and the full slider, so the first
     frame the browser paints on this page is the frame the sign-in page was showing: no empty violet, no pop.
     <html> may hold it before <body> exists (it is position:fixed, so it takes no room). The owl needs
     js/mascot.js first, so it is written into the page stream right here and executes before the parser goes on. */
  /* On a phone, Chrome widens the layout viewport (to twice the screen here) while the page is still loading and its
     unfinished layout is wider than the screen; a panel painted in that window then sits in the bottom-right corner of
     the real screen and the page can be dragged sideways. Pinning the minimum scale to 1 for the time the panel is up
     stops the widening; the original value is put back when the panel leaves. */
  var vpMeta = document.querySelector('meta[name="viewport"]'), vpOrig = null;
  if (vpMeta && !/minimum-scale/.test(vpMeta.getAttribute('content') || '')) {
    vpOrig = vpMeta.getAttribute('content') || '';
    vpMeta.setAttribute('content', vpOrig + ', minimum-scale=1');
  }
  function restoreViewport() { if (vpMeta && vpOrig !== null) { vpMeta.setAttribute('content', vpOrig); vpOrig = null; } }

  var panel = null;
  function mount() {
    if (panel) return;
    panel = build({ mode: note.mode, name: note.name, resume: true, into: document.body || root });
    cur = panel;
    root.classList.remove('tw-on');
    settle(panel);
  }
  window.TeoremaWelcome._mount = mount;
  if (document.readyState === 'loading' && !window.TeoremaMascot) {
    document.write('<script src="' + base + 'mascot.js"><\/script><script>window.TeoremaWelcome._mount()<\/script>');
  } else {
    withMascot(mount);
  }

  /* keep the panel until the page has settled (account known, nothing left to redraw), then fade it away */
  function settle(c) {
    var born = Date.now(), settledAt = 0;
    var timer = setInterval(function () {
      var ok = document.readyState === 'complete' && window._bmAuthReady && window.BMAuth && (window.BMAuth.role || !window.BMAuth.user)
               && !root.classList.contains('bm-auth-pending');
      if (ok && !settledAt) settledAt = Date.now();
      if (!ok) settledAt = 0;
      var enough = settledAt && Date.now() - settledAt > 350;
      if ((enough && Date.now() - born > 250) || Date.now() - born > 4000) {
        clearInterval(timer);
        cur = null;
        dispose(c, function () { restoreViewport(); dropNote(); });   // the note goes only when the panel does
      }
    }, 90);
  }
})();
