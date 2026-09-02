#!/usr/bin/env node
/* ============================================================
   Regenerates partials/nav.html from js/icons.js.

   Why this exists: the nav partial is fetched as plain HTML by
   js/nav-loader.js and injected via innerHTML — it cannot execute
   JavaScript, so it cannot call icon() itself. Its 7 <svg> icons are
   frozen copies of icon()'s output, pasted in at edit time instead of
   generated at page-load time. That's a deliberate call to avoid a
   load-order dependency between icons.js and nav-loader.js (see the
   note at the top of partials/nav.html) — but it means the partial can
   silently drift from icons.js if someone edits an icon there without
   knowing the nav has its own frozen copy.

   Run this file after changing any icon used in the nav (see NAV_ICONS
   below) to regenerate partials/nav.html from the current icons.js:

     node scripts/prebake-nav-icons.js

   It overwrites partials/nav.html entirely — the only sanctioned way to
   hand-edit it afterwards is to update NAV_ICONS or the TEMPLATE in
   this file and re-run it, not to edit the generated file directly.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

// icons.js is a browser-only script (attaches to `window`), not a
// CommonJS module — this stub lets it run under plain `node` without
// changing icons.js itself or adding a build step to the app.
global.window = {};
require(path.join(__dirname, '..', 'js', 'icons.js'));
const icon = global.window.icon;

// The 7 icons used in the nav. Edit these (name/size/className) to
// change what the nav shows, then re-run this script — never hand-edit
// the <svg> markup in partials/nav.html.
const NAV_ICONS = {
  capitole:    icon('library',        { size: 16, className: 'nav__mobile-link__icon' }),
  simulare:    icon('clipboard-list', { size: 16, className: 'nav__mobile-link__icon' }),
  antrenament: icon('target',         { size: 16, className: 'nav__mobile-link__icon' }),
  clase:       icon('school',         { size: 16, className: 'nav__mobile-link__icon' }),
  pachete:     icon('package',        { size: 16, className: 'nav__mobile-link__icon' }),
  token:       icon('ticket',         { size: 16, className: 'token-widget__icon' }),
  theme:       icon('moon',           { size: 20 }),
};

for (const [key, svg] of Object.entries(NAV_ICONS)) {
  if (!svg) throw new Error('icon() returned empty output for "' + key + '" — check the icon name exists in js/icons.js');
}

const HEADER = `<!--
  AUTO-GENERATED — DO NOT HAND-EDIT THE <svg> ICONS BELOW.

  This partial is fetched as plain HTML by js/nav-loader.js and injected
  via innerHTML, so it can't execute JavaScript and can't call icon()
  itself. Its 7 icons are pre-rendered, frozen copies of js/icons.js's
  icon() output — generated once, at edit time, not live at page load.
  (Chosen specifically to avoid a load-order dependency between
  icons.js and nav-loader.js — see icons.js for the icon definitions.)

  To change an icon used here: edit NAV_ICONS in
  scripts/prebake-nav-icons.js, then run:
    node scripts/prebake-nav-icons.js
  That overwrites this file. Do not edit the <svg> blocks by hand —
  they will silently drift from js/icons.js if you do.
-->
`;

const TEMPLATE = `    <div class="nav__inner container">
      <a class="nav__brand" href="capitole.html" data-authed-href="capitole.html">
        <img class="nav__logo" src="assets/images/MathorizonLogo.png" alt="Mathorizon">
        <span class="nav__name">Math<b>orizon</b></span>
      </a>

      <div class="nav__links">
        <a class="nav__link" href="capitole.html" data-authed-href="capitole.html">Capitole</a>
        <a class="nav__link" href="bac.html?new=1" data-authed-href="bac.html?new=1">Simulare</a>
        <a class="nav__link" href="training.html" data-authed-href="training.html">Antrenament</a>
        <a class="nav__link" href="classes.html" data-authed-href="classes.html">Clase</a>
        <a class="nav__link" href="pachete.html" data-authed-href="pachete.html">Pachete</a>
      </div>
      <button class="nav__hamburger" id="navHamburger" aria-label="Meniu">
        <span></span><span></span><span></span>
      </button>
      <div class="nav__right">
        <div class="token-widget" id="tokenWidget" title="ExamTokenuri disponibile">
          \${token}
          <span class="token-widget__count" data-token-count>—</span>
          <span class="token-widget__label">Tokenuri</span>
        </div>
        <button class="nav-icon-btn" id="favBtn" title="Exerciții favorite"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>
        <button class="nav-icon-btn" id="histBtn" title="Istoric rezolvări"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg></button>
        <button class="theme-btn" id="themeBtn" onclick="BM.toggleTheme()" title="Schimbă tema" aria-label="Schimbă tema">\${theme}</button>
        <button class="nav-profile-btn" id="navProfileBtn" title="Conectează-te">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </button>
        <div class="nav__guest-actions" id="navGuestActions">
          <a class="nav__guest-login" id="navGuestLogin" href="auth.html">Conectare</a>
          <a class="nav__guest-signup" id="navGuestSignup" href="auth.html?tab=signup">Creează cont</a>
        </div>
      </div>
    </div>
    <div class="nav__mobile-menu" id="navMobileMenu">
      <a class="nav__mobile-link" href="capitole.html" data-authed-href="capitole.html">\${capitole}Capitole</a>
      <a class="nav__mobile-link" href="bac.html?new=1" data-authed-href="bac.html?new=1">\${simulare}Simulare</a>
      <a class="nav__mobile-link" href="training.html" data-authed-href="training.html">\${antrenament}Antrenament</a>
      <a class="nav__mobile-link" href="classes.html" data-authed-href="classes.html">\${clase}Clase</a>
      <a class="nav__mobile-link" href="pachete.html" data-authed-href="pachete.html">\${pachete}Pachete</a>
      <div class="nav__mobile-divider"></div>
      <div class="nav__mobile-section-lbl">Mai multe</div>
      <button class="nav__mobile-link nav__mobile-link--action" onclick="document.getElementById('navMobileMenu').classList.remove('open');document.getElementById('favBtn').click()">Exerciții favorite</button>
      <button class="nav__mobile-link nav__mobile-link--action" onclick="document.getElementById('navMobileMenu').classList.remove('open');document.getElementById('histBtn').click()">Istoric rezolvări</button>
    </div>
`;

const body = TEMPLATE.replace(/\$\{(\w+)\}/g, (_, key) => {
  if (!(key in NAV_ICONS)) throw new Error('Template references unknown icon key "' + key + '"');
  return NAV_ICONS[key];
});

const OUT = path.join(__dirname, '..', 'partials', 'nav.html');
fs.writeFileSync(OUT, HEADER + body);
console.log('Wrote ' + OUT);
