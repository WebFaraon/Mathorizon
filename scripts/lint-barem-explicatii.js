#!/usr/bin/env node
/* ============================================================
   Verifică TOATE explicațiile de barem din js/data.js față de regulile din
   docs/barem-explicatii.md:
     1. reguli de conținut, din text (scripts/_explicatie-rules.js)
     2. lățime și vizibilitate, în browser real, pe 320/390/768/1280px
        (scripts/_explicatie-browser-lint.js)

   Usage:
     node scripts/lint-barem-explicatii.js                 (toate)
     node scripts/lint-barem-explicatii.js --id an-int-002
     node scripts/lint-barem-explicatii.js --subcat integrale
     node scripts/lint-barem-explicatii.js --no-browser    (doar regulile din text)

   Iese cu cod 1 dacă găsește o încălcare, deci se poate pune într-un hook
   sau în CI. Rulează-l după orice modificare a unei explicații.
   ============================================================ */
'use strict';
const path = require('path');
const { lintStatic } = require('./_explicatie-rules');
const { lintLayout } = require('./_explicatie-browser-lint');

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const ONLY_ID = arg('id', null);
const SUBCAT = arg('subcat', null);
const NO_BROWSER = argv.includes('--no-browser');

global.window = global;
require(path.join(__dirname, '..', 'js', 'data.js'));
const EXERCISES = global.BM.EXERCISES;

async function main() {
  const targets = EXERCISES.filter(ex =>
    Array.isArray(ex.barem) && ex.barem.some(b => b.explicatie) &&
    (!ONLY_ID || ex.id === ONLY_ID) &&
    (!SUBCAT || ex.subcategoryId === SUBCAT)
  );
  if (!targets.length) {
    console.log('Niciun exercitiu cu explicatii de verificat.');
    return;
  }

  // o lista plata de pasi, ca browserul sa incarce o singura data pagina
  const flat = [];
  targets.forEach(ex => ex.barem.forEach((b, i) => {
    if (b.explicatie) flat.push({ ex, step: i + 1, criterion: b.descriere, points: b.puncte_maxime, explicatie: b.explicatie });
  }));

  const staticProblems = flat.map(f => lintStatic(f.explicatie));

  let layout = { available: false, reason: 'sarit (--no-browser)', problems: flat.map(() => []) };
  if (!NO_BROWSER) {
    console.log(`Randez ${flat.length} explicatii in browser (4 latimi)...`);
    layout = await lintLayout(flat.map(f => ({ criterion: f.criterion, points: f.points, explicatie: f.explicatie })));
    if (!layout.available) console.log('ATENTIE, verificarea de latime nu a rulat: ' + layout.reason);
  }

  let total = 0;
  let lastId = null;
  flat.forEach((f, i) => {
    const all = [...staticProblems[i], ...layout.problems[i]];
    if (!all.length) return;
    if (f.ex.id !== lastId) { console.log(`\n${f.ex.id}  (${f.ex.title})`); lastId = f.ex.id; }
    console.log(`  pasul ${f.step}:`);
    all.forEach(p => console.log('    - ' + p));
    total += all.length;
  });

  const steps = flat.length;
  const bad = flat.filter((f, i) => staticProblems[i].length || layout.problems[i].length).length;
  console.log('');
  if (total) {
    console.log(`${bad} din ${steps} pasi incalca regulile (${total} incalcari), in ${targets.length} exercitii.`);
    process.exit(1);
  }
  console.log(`OK: ${steps} pasi din ${targets.length} exercitii respecta regulile` +
    (layout.available ? ' (continut + lățime pe 320/390/768/1280px).' : ' (doar continut; latimea NU a fost verificata).'));
}

main().catch(e => { console.error(e); process.exit(1); });
