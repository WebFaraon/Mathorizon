#!/usr/bin/env node
/* ============================================================
   Scans the repo for emoji / pseudo-icon characters still left to
   convert to js/icons.js's icon() system.

   Two buckets, reported separately:
   - "emoji"   — \p{Extended_Pictographic}: the colorful glyphs (📚 ⏳ 🔑 …).
   - "symbol"  — plain-text dingbat/arrow/star characters (✓ ✗ → ★ •) that
                 already render monochrome in most fonts but are still
                 hand-typed text, not icon() output, so they don't carry
                 the site's sizing/color-role system.

   Usage:
     node scripts/emoji-scan.js            — summary (counts per file)
     node scripts/emoji-scan.js --detail    — every match, with line + context
     node scripts/emoji-scan.js --detail path/to/file.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'fontcheck', 'assets', 'supabase']);
const EXT_RE = /\.(html|js)$/;

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
// Common hand-typed pseudo-icon symbols that are NOT Extended_Pictographic
// (arrows, stars, checks/crosses, bullets used as UI glyphs in text/CSS
// content, not inside icon() calls).
const SYMBOL_RE = /[←-⇿☀-⛿✀-➿⬀-⯿•●○■□✓✔✗✘★☆]/gu;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT_RE.test(name)) out.push(p);
  }
  return out;
}

function scan(files) {
  const results = [];
  for (const f of files) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const src = fs.readFileSync(f, 'utf8');
    const lines = src.split(/\r?\n/);
    const emojiHits = [];
    const symbolHits = [];
    lines.forEach((line, i) => {
      const em = line.match(EMOJI_RE);
      if (em) em.forEach(ch => emojiHits.push({ line: i + 1, ch, text: line.trim().slice(0, 120) }));
      // Strip already-matched emoji chars before symbol pass so composite
      // sequences (e.g. flag/ZWJ emoji) don't double-count into "symbol".
      const stripped = line.replace(EMOJI_RE, '');
      const sym = stripped.match(SYMBOL_RE);
      if (sym) sym.forEach(ch => symbolHits.push({ line: i + 1, ch, text: line.trim().slice(0, 120) }));
    });
    if (emojiHits.length || symbolHits.length) {
      results.push({ file: rel, emojiHits, symbolHits });
    }
  }
  return results;
}

function main() {
  const args = process.argv.slice(2);
  const detail = args.includes('--detail');
  const filterFile = args.find(a => !a.startsWith('--'));

  let files = walk(ROOT, []);
  if (filterFile) files = files.filter(f => path.relative(ROOT, f).replace(/\\/g, '/') === filterFile);

  const results = scan(files).sort((a, b) => (b.emojiHits.length + b.symbolHits.length) - (a.emojiHits.length + a.symbolHits.length));

  let totalEmoji = 0, totalSymbol = 0;
  for (const r of results) {
    totalEmoji += r.emojiHits.length;
    totalSymbol += r.symbolHits.length;
    console.log(String(r.emojiHits.length).padStart(4) + ' emoji  ' + String(r.symbolHits.length).padStart(4) + ' symbol  ' + r.file);
    if (detail) {
      for (const h of r.emojiHits) console.log('    [emoji]  L' + h.line + '  ' + h.ch + '   ' + h.text);
      for (const h of r.symbolHits) console.log('    [symbol] L' + h.line + '  ' + h.ch + '   ' + h.text);
    }
  }
  console.log('---');
  console.log('Files with hits: ' + results.length);
  console.log('Total emoji: ' + totalEmoji);
  console.log('Total symbol: ' + totalSymbol);
  console.log('Total: ' + (totalEmoji + totalSymbol));
}

main();
