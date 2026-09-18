#!/usr/bin/env node
'use strict';

/* ============================================================
   Mathorizon — links the built React island into capitole.html
   ============================================================
   The Capitole page body is a React bundle (see vite.config.ts), but the
   page itself is still a hand-written .html file. Vite content-hashes the
   bundle's filenames so the CDN/browser cache invalidates correctly on
   every deploy, which means the <link>/<script> tags in capitole.html
   cannot be written by hand — they'd go stale the first time the bundle
   changed, and the page would silently render nothing.

   So `npm run build:react` runs vite and then this script, which reads
   vite's manifest and rewrites the two marked blocks in capitole.html
   in-place. Nothing outside those markers is touched.

   Run it by hand only if you built with `vite build` directly.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'assets', 'react', '.vite', 'manifest.json');
const PAGE = path.join(ROOT, 'capitole.html');
/* Path the browser requests — relative, like every other asset reference in
   these pages, so it resolves the same at /capitole.html and at /capitole. */
const PUBLIC_DIR = 'assets/react';

const MARKERS = {
  css: 'REACT-ISLAND-CSS',
  js: 'REACT-ISLAND-JS'
};

function fail(message) {
  console.error(`\n  [sync-react-tags] ${message}\n`);
  process.exit(1);
}

/** Replaces everything between `<!-- NAME:START -->` and `<!-- NAME:END -->`. */
function replaceBlock(html, name, inner) {
  const pattern = new RegExp(
    `(<!--\\s*${name}:START\\s*-->)[\\s\\S]*?(<!--\\s*${name}:END\\s*-->)`
  );
  if (!pattern.test(html)) {
    fail(
      `capitole.html has no "${name}:START / ${name}:END" block.\n` +
      `  Add the marker comments back before running this — without them the\n` +
      `  built bundle has nothing to attach to and the page renders empty.`
    );
  }
  return html.replace(pattern, `$1\n${inner}\n  $2`);
}

if (!fs.existsSync(MANIFEST)) {
  fail(`no manifest at ${path.relative(ROOT, MANIFEST)} — run \`npm run build:react\`.`);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const entry = Object.values(manifest).find((chunk) => chunk.isEntry);
if (!entry) fail('manifest contains no entry chunk.');

const cssTags = (entry.css || [])
  .map((file) => `  <link rel="stylesheet" href="${PUBLIC_DIR}/${file}">`)
  .join('\n');
/* type="module" is what defers it: the island reads window.BM, which the
   classic <script> tags further up the page set, and a module script always
   runs after those have executed. */
const jsTag = `  <script type="module" src="${PUBLIC_DIR}/${entry.file}"></script>`;

let html = fs.readFileSync(PAGE, 'utf8');
html = replaceBlock(html, MARKERS.css, cssTags || '  <!-- (no css emitted) -->');
html = replaceBlock(html, MARKERS.js, jsTag);
fs.writeFileSync(PAGE, html);

console.log('  [sync-react-tags] capitole.html updated:');
(entry.css || []).forEach((file) => console.log(`    css  ${PUBLIC_DIR}/${file}`));
console.log(`    js   ${PUBLIC_DIR}/${entry.file}`);
