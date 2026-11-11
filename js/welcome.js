/* ============================================================
   Teorema: the welcome after sign-in
   ============================================================
   After a real sign-in (e-mail, sign-up or Google) the whole screen is covered by a violet
   panel: the Teorema owl, the same one as in the Logo Kit (js/mascot.js), greets in its happy
   pose, and a slider fills as if the materials were loading. After about a second the panel
   fades away and the platform is there. Same for every role.

   How it hangs together:
   - js/auth-page.js calls TeoremaWelcome.go(url, { name, mode }) instead of redirecting at once:
     it leaves a short-lived note in sessionStorage, fades a violet cover over the sign-in page,
     and then goes to the destination.
   - This file is loaded in the <head> of every page a sign-in can land on. If the note is there
     it paints a violet panel before anything else (a pseudo-element of <html>, so there is no
     flash of the page), builds the greeting as soon as <body> exists, and removes it again.
     The note is read once and deleted, so a reload never plays it twice, and it expires after
     three minutes.
   - With "reduce motion" the panel stays for a moment and goes without animation.
   Plain script, no dependencies; js/mascot.js is fetched only when the greeting plays.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'teorema_welcome';
  var TTL = 3 * 60 * 1000;
  var FILL_MS = 700;          // the slider
  var OUT_MS = 380;           // the panel leaving
  var root = document.documentElement;
  var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  var VIOLET = '#3F236E', VIOLET_DARK = '#2A1750';

  var CSS = [
    /* the instant panel, painted before the body exists */
    'html.tw-on::before{content:"";position:fixed;inset:0;z-index:2147483000;background:' + VIOLET + '}',
    'html[data-theme="dark"].tw-on::before{background:' + VIOLET_DARK + '}',
    /* the cover that fades in over the sign-in page */
    '.tw-cover{position:fixed;inset:0;z-index:2147483001;background:' + VIOLET + ';opacity:0;transition:opacity .32s ease;pointer-events:all}',
    'html[data-theme="dark"] .tw-cover{background:' + VIOLET_DARK + '}',
    '.tw-cover.is-on{opacity:1}',
    /* the greeting */
    '.tw{position:fixed;inset:0;z-index:2147483002;display:grid;place-items:center;padding:24px;background:' + VIOLET + ';color:#fff;font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;opacity:1;transition:opacity ' + OUT_MS + 'ms ease}',
    'html[data-theme="dark"] .tw{background:' + VIOLET_DARK + '}',
    '.tw::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:28px 28px;pointer-events:none}',
    '.tw__center{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;max-width:92vw;transition:transform ' + OUT_MS + 'ms cubic-bezier(.4,0,.2,1)}',
    '.tw__owl{width:min(250px,60vw)}',
    '.tw__owl svg{display:block;width:100%;height:auto;overflow:visible}',
    '.tw__hi{margin:6px 0 0;font-size:clamp(1.45rem,4.6vw,2rem);font-weight:800;letter-spacing:-.02em;line-height:1.15}',
    '.tw__sub{margin:0;font-size:.95rem;font-weight:600;color:rgba(255,255,255,.72)}',
    '.tw__bar{width:min(260px,64vw);height:8px;margin-top:10px;border-radius:999px;background:rgba(255,255,255,.18);overflow:hidden}',
    '.tw__bar i{display:block;width:100%;height:100%;border-radius:999px;background:#7BB403;transform-origin:left center;transform:scaleX(0)}',
    '.tw.is-out{opacity:0;pointer-events:none}',
    '.tw.is-out .tw__center{transform:translateY(-10px) scale(1.04)}'
  ];
  var MOTION = [
    '@keyframes twPop{from{opacity:0;transform:translateY(26px) scale(.7)}}',
    '@keyframes twUp{from{opacity:0;transform:translateY(14px)}}',
    '@keyframes twFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
    '.tw__owl{animation:twPop .75s cubic-bezier(.16,1,.3,1) backwards}',
    '.tw__hi{animation:twUp .6s .12s cubic-bezier(.16,1,.3,1) backwards}',
    '.tw__sub{animation:twUp .6s .2s cubic-bezier(.16,1,.3,1) backwards}',
    '.tw__bar{animation:twUp .5s .28s cubic-bezier(.16,1,.3,1) backwards}',
    '.tw__bar i{animation:twFill ' + FILL_MS + 'ms .15s cubic-bezier(.45,0,.2,1) forwards}'
  ];

  function addStyle(text) {
    var st = document.createElement('style');
    st.setAttribute('data-teorema-welcome', '');
    st.textContent = text;
    (document.head || root).appendChild(st);
  }

  /* ---------- the note between pages ---------- */
  function arm(opts) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), name: (opts && opts.name) || '', mode: (opts && opts.mode) || 'login' })); } catch (e) { /* no storage: no greeting */ }
  }
  function takeNote() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      sessionStorage.removeItem(KEY);
      var n = JSON.parse(raw);
      return n && Date.now() - n.t < TTL ? n : null;
    } catch (e) { return null; }
  }

  /* ---------- the sign-in page: cover, then go ---------- */
  function go(url, opts) {
    arm(opts);
    function leave() { window.location.replace(url); }
    if (RM || !document.body) { leave(); return; }
    addStyle(CSS.join('\n'));
    var cover = document.createElement('div');
    cover.className = 'tw-cover';
    document.body.appendChild(cover);
    void cover.offsetWidth;                  // so the fade has a start
    cover.classList.add('is-on');
    setTimeout(leave, 340);
  }

  /* the sign-in page itself never plays the greeting */
  var onAuthPage = /\/auth\.html$/.test(location.pathname);
  window.TeoremaWelcome = { arm: arm, go: go };
  if (onAuthPage) return;

  var note = takeNote();
  if (!note) return;

  /* ---------- the destination: greeting ---------- */
  addStyle(CSS.join('\n') + (RM ? '' : '\n' + MOTION.join('\n')));
  root.classList.add('tw-on');

  var bodyReady = false, mascotReady = false, shown = false;
  var script = document.createElement('script');
  var base = (function () {
    var cur = document.currentScript && document.currentScript.src;
    return cur ? cur.replace(/welcome\.js(\?.*)?$/, '') : 'js/';
  })();
  script.src = base + 'mascot.js';
  script.onload = function () { mascotReady = true; tryShow(); };
  script.onerror = function () { mascotReady = true; tryShow(); };      // greet without the owl rather than not at all
  (document.head || root).appendChild(script);
  setTimeout(function () { mascotReady = true; tryShow(); }, 1500);      // the owl is late: do not hold the page

  function waitForBody() {
    if (document.body) { bodyReady = true; tryShow(); return; }
    var mo = new MutationObserver(function () {
      if (document.body) { mo.disconnect(); bodyReady = true; tryShow(); }
    });
    mo.observe(root, { childList: true });
  }
  waitForBody();

  function greeting() {
    var name = (note.name || '').trim();
    var word = note.mode === 'signup' ? 'Bine ai venit' : 'Bine ai revenit';
    return name ? word + ', ' + name + '!' : word + '!';
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function tryShow() {
    if (shown || !bodyReady || !mascotReady) return;
    shown = true;
    var el = document.createElement('div');
    el.className = 'tw';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="tw__center">' +
        '<div class="tw__owl" id="twOwl"></div>' +
        '<h2 class="tw__hi">' + esc(greeting()) + '</h2>' +
        '<p class="tw__sub">Se încarcă materialele…</p>' +
        '<div class="tw__bar" aria-hidden="true"><i></i></div>' +
      '</div>';
    document.body.appendChild(el);
    root.classList.remove('tw-on');           // the real panel is up; the instant one can go

    var owl = null;
    if (window.TeoremaMascot) {
      try { owl = new TeoremaMascot.Mascot(el.querySelector('#twOwl'), { mood: 'happy', theme: 'dark' }); } catch (e) { owl = null; }
    }

    function leave() {
      if (RM) { finish(); return; }
      el.classList.add('is-out');
      setTimeout(finish, OUT_MS + 60);
    }
    function finish() {
      if (owl && window.TeoremaMascot) TeoremaMascot.dispose(owl);
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    setTimeout(leave, RM ? 600 : FILL_MS + 180);
    setTimeout(finish, 5000);                 // never stuck
  }
})();
