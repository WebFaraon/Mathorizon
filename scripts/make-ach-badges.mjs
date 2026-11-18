#!/usr/bin/env node
/* Insignele pentru Realizari (assets/images/ach/<id>.svg si <id>-blocat.svg), desenate cu aceeasi functie ca in Teorema Logo Kit
   (fila Realizari: `pbadge`), din lista `DEFS` din js/achievements.js. Pictogramele de profesor care lipsesc in kit (sheet, board, chat, library)
   sunt adaugate aici in acelasi stil. Cifrele de pe insigne se transforma in contururi (Space Grotesk 700), ca sa arate la fel intr-un <img>.

   Rulare (din radacina; kit.html = pagina artefactului Teorema Logo Kit, salvata local):
     npm i --no-save opentype.js @fontsource/space-grotesk
     node scripts/make-ach-badges.mjs /cale/catre/kit.html */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const opentype = require('opentype.js');

const kitPath = process.argv[2];
if (!kitPath) { console.error('Da calea catre kit.html'); process.exit(1); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(root, 'assets', 'images', 'ach');
fs.mkdirSync(OUT, { recursive: true });

/* lista de realizari */
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'achievements.js'), 'utf8'), ctx);
const DEFS = ctx.BMAch.DEFS;

/* kitul, cu pbadge expus si cu pictogramele noi */
let html = fs.readFileSync(kitPath, 'utf8');
const NEW_ICONS =
  "case 'sheet':return '<rect x=\"-17\" y=\"-24\" width=\"34\" height=\"46\" rx=\"6\" fill=\"'+fg+'\"/><path d=\"M-9 -11H9M-9 -1H9M-9 9H2\" stroke=\"'+ac+'\" stroke-width=\"4\" stroke-linecap=\"round\"/>';" +
  "case 'board':return '<rect x=\"-27\" y=\"-24\" width=\"54\" height=\"34\" rx=\"5\" fill=\"none\" stroke=\"'+fg+'\" stroke-width=\"5\"/><path d=\"M-16 2Q-9 -16 -2 -5T14 -10\" fill=\"none\" stroke=\"'+ac+'\" stroke-width=\"4\" stroke-linecap=\"round\"/><path d=\"M-13 10L-19 27M13 10L19 27\" stroke=\"'+fg+'\" stroke-width=\"4\" stroke-linecap=\"round\"/>';" +
  "case 'chat':return '<path d=\"M-26 -22H26Q31 -22 31 -17V7Q31 12 26 12H0L-15 26V12H-26Q-31 12 -31 7V-17Q-31 -22 -26 -22Z\" fill=\"'+fg+'\"/><path d=\"M-18 -10H18M-18 1H6\" stroke=\"'+ac+'\" stroke-width=\"4\" stroke-linecap=\"round\"/>';" +
  "case 'library':return '<rect x=\"-28\" y=\"6\" width=\"56\" height=\"13\" rx=\"4\" fill=\"'+fg+'\"/><rect x=\"-23\" y=\"-8\" width=\"44\" height=\"12\" rx=\"4\" fill=\"'+ac+'\"/><rect x=\"-26\" y=\"-22\" width=\"38\" height=\"12\" rx=\"4\" fill=\"'+fg+'\"/><path d=\"M-16 12.5H8\" stroke=\"'+ac+'\" stroke-width=\"3\" stroke-linecap=\"round\"/>';";
const anchorBook = "case 'book':return '<path d=\"M0 -14C-8 -22";
if (!html.includes(anchorBook) || !html.includes('function badge(k,earned){')) { console.error('Kitul nu mai arata cum ma asteptam'); process.exit(1); }
html = html.replace(anchorBook, NEW_ICONS + anchorBook).replace('function badge(k,earned){', 'window.__pb=pbadge;function badge(k,earned){');
const tmp = path.join(path.dirname(kitPath), '.kit-patched.html');
fs.writeFileSync(tmp, html);

/* cifrele din <text> in contururi */
const fontFile = require.resolve('@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff');
const buf = fs.readFileSync(fontFile);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
/* serializare proprie (toPathData din opentype.js poate scoate NaN) */
function pathData(p) {
  const f = (v) => { if (!Number.isFinite(v)) throw new Error('NaN in contur'); return String(Math.round(v * 100) / 100); };
  return p.commands.map((c) => {
    if (c.type === 'Z') return 'Z';
    const nums = c.type === 'M' || c.type === 'L' ? [c.x, c.y] : c.type === 'Q' ? [c.x1, c.y1, c.x, c.y] : [c.x1, c.y1, c.x2, c.y2, c.x, c.y];
    return c.type + nums.map(f).join(' ');
  }).join('');
}
function outline(svg) {
  return svg.replace(/<text\b([^>]*)>([^<]*)<\/text>/g, (m, attrs, txt) => {
    const get = (n) => { const r = new RegExp('\\b' + n + '="([^"]*)"').exec(attrs); return r ? r[1] : null; };
    const size = parseFloat(get('font-size') || '16'), x = parseFloat(get('x') || '0'), y = parseFloat(get('y') || '0');
    /* fiecare cifra separat, fara kerning (la "10" opentype.js da NaN) */
    const adv = (ch) => font.charToGlyph(ch).advanceWidth * size / font.unitsPerEm;
    const w = [...txt].reduce((t, ch) => t + adv(ch), 0);
    let cx = get('text-anchor') === 'middle' ? x - w / 2 : get('text-anchor') === 'end' ? x - w : x;
    let d = '';
    for (const ch of txt) { d += pathData(font.getPath(ch, cx, y, size)); cx += adv(ch); }
    if (d.includes('NaN')) throw new Error('NaN in contur: ' + txt);
    return '<path d="' + d + '" fill="' + (get('fill') || '#000') + '" fill-rule="evenodd"/>';
  });
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + tmp, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__pb, null, { timeout: 15000 });
let n = 0;
for (const role of Object.keys(DEFS)) {
  for (const d of DEFS[role]) {
    for (const earned of [true, false]) {
      const svg = await page.evaluate(([o, earned]) => window.__pb({ shape: o.shape, r: o.r, earned, ico: o.ico || undefined, txt: o.txt || undefined, owl: !!o.owl, picto: o.picto, name: o.name }), [d, earned]);
      fs.writeFileSync(path.join(OUT, d.id + (earned ? '' : '-blocat') + '.svg'), outline(svg));
      n++;
    }
  }
}
await browser.close();
fs.unlinkSync(tmp);
console.log(n + ' insigne in ' + OUT);
