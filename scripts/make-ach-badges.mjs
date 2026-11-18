#!/usr/bin/env node
/* Insignele pentru Realizari: assets/images/ach/<id>-1..5.svg (Bronz, Argint, Aur, Diamant, Mitic) si <id>-blocat.svg, desenate cu aceeasi functie
   ca in Teorema Logo Kit (fila Realizari: `pbadge`), din lista `DEFS` din js/achievements.js. Paleta e cu cinci niveluri (cea din kit avea patru
   rarităti), iar in mijloc se pune iconita reala din aplicatie (`img` din DEFS), nu pictograma din kit. Cele "in curand" au doar varianta blocata.
   Cifrele de pe insigne (pragul nivelului) se transforma in contururi (Space Grotesk 700), ca sa arate la fel intr-un <img>.

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

/* paleta pe cinci niveluri: rama (r1 deschis, r2 inchis), fata (f1 sus, f2 jos), gl = steluta, laur si cifra */
const PAL = "var PAL=[" +
  "{r1:'#F6CFAA',r2:'#A85F26',f1:'#5B3A9C',f2:'#2B1757',ac:'#FFB36B',gl:'#F5C79B'}," +
  "{r1:'#F7F9FF',r2:'#8F98B5',f1:'#5B3A9C',f2:'#2B1757',ac:'#E3E8F6',gl:'#E3E8F6'}," +
  "{r1:'#FFF3B8',r2:'#BE8305',f1:'#6C40B3',f2:'#2A1357',ac:'#FFD23F',gl:'#FFDF6B'}," +
  "{r1:'#E4FAFF',r2:'#1E9BD1',f1:'#3F5FD0',f2:'#14246B',ac:'#8EE8FF',gl:'#8EE8FF'}," +
  "{r1:'#FFD0F0',r2:'#C4106A',f1:'#8E2FC9',f2:'#35095E',ac:'#FF8AD8',gl:'#FF8AD8'}];";

/* kitul, cu pbadge expus, cu paleta noua si cu pictograma "chat" (cea din kit nu exista) */
let html = fs.readFileSync(kitPath, 'utf8');
const CHAT = "case 'chat':return '<path d=\"M-26 -22H26Q31 -22 31 -17V7Q31 12 26 12H0L-15 26V12H-26Q-31 12 -31 7V-17Q-31 -22 -26 -22Z\" fill=\"'+fg+'\"/><path d=\"M-18 -10H18M-18 1H6\" stroke=\"'+ac+'\" stroke-width=\"4\" stroke-linecap=\"round\"/>';";
const anchorBook = "case 'book':return '<path d=\"M0 -14C-8 -22";
if (!html.includes(anchorBook) || !html.includes('function badge(k,earned){') || !/var PAL=\[[^;]*?\}\];/.test(html)) { console.error('Kitul nu mai arata cum ma asteptam'); process.exit(1); }
html = html.replace(anchorBook, CHAT + anchorBook).replace('function badge(k,earned){', 'window.__pb=pbadge;function badge(k,earned){').replace(/var PAL=\[[^;]*?\}\];/, PAL);
const tmp = path.join(path.dirname(kitPath), '.kit-patched.html');
fs.writeFileSync(tmp, html);

/* iconita reala din aplicatie, pusa in mijlocul insignei (in locul grupului gol pe care il lasa pbadge fara `ico`) */
function embed(svg, d, earned, level) {
  if (!d.img) return svg;
  const raw = fs.readFileSync(path.join(root, d.img), 'utf8');
  const vb = /viewBox="([^"]+)"/.exec(raw)[1].split(/\s+/).map(Number);
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const hasTxt = earned || d.tiers.length;                      /* insigna are cifra jos */
  const size = d.shape === 'round' ? 46 : 50;
  return svg.replace(/<g transform="translate\(60 ([\d.]+)\)"><\/g>/, (m, cy) => {
    const c = parseFloat(cy), sc = size / vb[2];
    const g = '<g transform="translate(' + (60 - size / 2) + ' ' + (c - size / 2) + ') scale(' + sc.toFixed(4) + ') translate(' + (-vb[0]) + ' ' + (-vb[1]) + ')"' + (earned ? '' : ' filter="url(#achGray)" opacity=".55"') + '>' + inner + '</g>';
    return (earned ? '' : '<defs><filter id="achGray"><feColorMatrix type="saturate" values="0"/></filter></defs>') + g;
  });
}
/* nivelul Mitic: o aura roz in jurul insignei */
function aura(svg) {
  const cy = /<path d="M6 62A54 54/.test(svg) ? 60 : 66;
  return svg.replace('</defs>', '<radialGradient id="achAura"><stop offset=".55" stop-color="#FF5CC8" stop-opacity="0"/><stop offset=".82" stop-color="#FF5CC8" stop-opacity=".38"/><stop offset="1" stop-color="#FF5CC8" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="' + cy + '" r="62" fill="url(#achAura)"/>');
}

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
    /* nivelurile 1..5 (doar cele care se pot calcula) si varianta blocata */
    const variants = d.soon ? [[0, false]] : [...d.tiers.map((t, i) => [i + 1, true]), [0, false]];
    for (const [level, earned] of variants) {
      const txt = d.soon ? '' : String(d.tiers[Math.max(0, level - 1)]);
      let svg = await page.evaluate(([o, earned, r, txt]) => window.__pb({ shape: o.shape, r, earned, ico: o.ico || undefined, txt: txt || undefined, name: o.name }), [{ shape: d.shape, ico: d.ico || null, name: d.name }, earned, Math.max(0, level - 1), txt]);
      svg = embed(svg, d, earned, level);
      if (level === 5) svg = aura(svg);
      fs.writeFileSync(path.join(OUT, d.id + (level ? '-' + level : '-blocat') + '.svg'), outline(svg));
      n++;
    }
  }
}
await browser.close();
fs.unlinkSync(tmp);
console.log(n + ' insigne in ' + OUT);
