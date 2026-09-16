#!/usr/bin/env node
/* ============================================================
   Regenerates barem[] for existing js/data.js exercises using Gemini,
   calibrated on the real official RM baremuri in
   data/official-barem-examples.json (the same few-shot pool
   api/admin/generate-exercise.js uses for brand-new exercises).

   Existing static exercises with baremEstimat:true got their barem
   split by hand (heuristic paragraph split), not from a real official
   document and not from Gemini. This script re-derives just the barem
   (statement/solution stay untouched) so it follows the structure and
   point-granularity of the real official baremuri instead.

   Usage:
     node scripts/regenerate-baremuri.js --subcat calcul-algebric
     node scripts/regenerate-baremuri.js --subcat calcul-algebric --limit 3   (dry run on a few first)
     node scripts/regenerate-baremuri.js --subcat calcul-algebric --apply     (writes js/data.js for real)

   Without --apply nothing is written to js/data.js — it only prints
   what would change and writes a review log to the scratch dir, so a
   first run should always be a --limit N test read through before
   trusting a full --apply.
   ============================================================ */
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateContentWithRetry } = require('../api/_gemini-retry');
const { extractJson } = require('../api/_gemini-shared');

const DATA_PATH = path.join(__dirname, '..', 'js', 'data.js');
const EXAMPLES_PATH = path.join(__dirname, '..', 'data', 'official-barem-examples.json');

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const TARGET_SUBCAT = arg('subcat', 'calcul-algebric');
const LIMIT = arg('limit', null) ? Number(arg('limit', null)) : Infinity;
const APPLY = argv.includes('--apply');
const ONLY_ID = arg('id', null);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  generationConfig: { temperature: 0, responseMimeType: 'application/json' }
});

// ---- load exercises the normal way, for their real content ----
global.window = global;
require(DATA_PATH);
const CATEGORIES = global.BM.CATEGORIES;
const EXERCISES = global.BM.EXERCISES;

const OFFICIAL_EXAMPLES = JSON.parse(fs.readFileSync(EXAMPLES_PATH, 'utf8'));

function categoryNames(categoryId, subcategoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  const sub = cat && cat.subcategories.find(s => s.id === subcategoryId);
  return { categoryName: (cat && cat.name) || categoryId, subcategoryName: (sub && sub.name) || subcategoryId };
}

function matchingExamples(categoryId, subcategoryId) {
  const bySub = OFFICIAL_EXAMPLES.filter(ex => ex.categoryId === categoryId && ex.subcategoryId === subcategoryId);
  if (bySub.length) return bySub;
  const byCategory = OFFICIAL_EXAMPLES.filter(ex => ex.categoryId === categoryId);
  return byCategory.length ? byCategory : OFFICIAL_EXAMPLES;
}

function buildExamplesBlock(categoryId, subcategoryId) {
  const pool = matchingExamples(categoryId, subcategoryId);
  return pool.map((ex, i) => {
    const pasi = ex.pasi.map(p => `   Pasul ${p.nr} (${p.puncte_maxime}p): ${p.descriere}`).join('\n');
    return `${i + 1}. "${ex.titlu}" — enunț: ${ex.enunt.replace(/\n/g, ' ')} — total ${ex.punctaj_total}p\n${pasi}`;
  }).join('\n\n');
}

function buildPrompt(ex, correctionNote) {
  const { categoryName, subcategoryName } = categoryNames(ex.categoryId, ex.subcategoryId);
  const examplesBlock = buildExamplesBlock(ex.categoryId, ex.subcategoryId);
  return `Ești un profesor de matematică care creează un BAREM de evaluare (stil BAC Moldova) pentru un exercițiu deja rezolvat.

Capitolul: "${categoryName}", subcapitolul: "${subcategoryName}".

ENUNȚ:
${ex.statement}

REZOLVARE (folosește EXACT această rezolvare — nu inventa alta, nu schimba rezultatul):
${ex.solution}

Punctajul total este FIX ${ex.puncteTotal} puncte — suma câmpurilor puncte_maxime din pasii tăi trebuie să fie EXACT ${ex.puncteTotal}, nicio altă valoare.

Mai jos ai exemple de bareme OFICIALE reale de BAC Moldova din același capitol, ca reper de stil, granularitate și mod de împărțire a punctajului pe pași:

${examplesBlock}

Sarcina ta: împarte REZOLVAREA de mai sus în pași de barem, în stilul exact al exemplelor oficiale — scurt, punctează etapele cheie de calcul, nu reformulează explicațiile lungi din rezolvare. Fiecare pas conține formulele LaTeX relevante ($$...$$ pentru afișare). Ultimul pas trebuie să se încheie cu $$\\boxed{...}$$ cu rezultatul final.
${correctionNote || ''}
Răspunde STRICT în format JSON, fără text suplimentar, fără fence-uri markdown, exact în această formă:
{"pasi_barem": [ {"descriere": "...", "puncte_maxime": N}, ... ]}`;
}

async function generateBarem(ex) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const note = attempt === 0 ? '' :
      `\nATENȚIE: răspunsul anterior nu însuma exact ${ex.puncteTotal} puncte. Corectează punctajul pe pași astfel încât suma să fie EXACT ${ex.puncteTotal}.\n`;
    const prompt = buildPrompt(ex, note);
    const result = await generateContentWithRetry(model, [{ text: prompt }]);
    const raw = result.response.text();
    let parsed;
    try {
      parsed = extractJson(raw);
    } catch (e) {
      lastErr = new Error('JSON parse failed: ' + e.message);
      continue;
    }
    const pasi = parsed && parsed.pasi_barem;
    if (!Array.isArray(pasi) || pasi.length === 0) {
      lastErr = new Error('no pasi_barem array in response');
      continue;
    }
    const clean = pasi.map(p => ({
      descriere: String(p.descriere || '').trim(),
      puncte_maxime: Number(p.puncte_maxime)
    }));
    if (clean.some(p => !p.descriere || !Number.isFinite(p.puncte_maxime))) {
      lastErr = new Error('malformed pasi_barem item');
      continue;
    }
    const sum = clean.reduce((s, p) => s + p.puncte_maxime, 0);
    if (sum !== ex.puncteTotal) {
      lastErr = new Error(`sum ${sum} !== puncteTotal ${ex.puncteTotal}`);
      continue; // retry once with correction note
    }
    return clean;
  }
  throw lastErr || new Error('unknown failure');
}

// ---- raw-text scan: find the exact [ ... ] span of each exercise's barem, string/comment aware ----
function findMatchingBracket(text, openIndex) {
  const open = text[openIndex];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) throw new Error('not a bracket at ' + openIndex);
  let depth = 0, i = openIndex;
  while (i < text.length) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') { const nl = text.indexOf('\n', i); i = nl === -1 ? text.length : nl + 1; continue; }
    if (c === '/' && text[i + 1] === '*') { const end = text.indexOf('*/', i + 2); i = end === -1 ? text.length : end + 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c; i++;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === open) { depth++; i++; continue; }
    if (c === close) { depth--; i++; if (depth === 0) return i - 1; continue; }
    i++;
  }
  throw new Error('no matching bracket from ' + openIndex);
}

function buildBaremSpanMap(text) {
  const arrKey = 'BM.EXERCISES = [';
  const arrOpen = text.indexOf(arrKey) + arrKey.length - 1;
  const arrClose = findMatchingBracket(text, arrOpen);
  const map = {};
  let i = arrOpen + 1;
  const skipTrivia = (j) => {
    while (j < arrClose) {
      if (/\s/.test(text[j])) { j++; continue; }
      if (text[j] === '/' && text[j + 1] === '/') { const nl = text.indexOf('\n', j); j = nl === -1 ? arrClose : nl + 1; continue; }
      if (text[j] === '/' && text[j + 1] === '*') { const end = text.indexOf('*/', j + 2); j = end === -1 ? arrClose : end + 2; continue; }
      if (text[j] === ',') { j++; continue; }
      break;
    }
    return j;
  };
  i = skipTrivia(i);
  while (i < arrClose) {
    if (text[i] !== '{') throw new Error('expected { at ' + i + ', got ' + JSON.stringify(text.slice(i, i + 20)));
    const objStart = i;
    const objEnd = findMatchingBracket(text, objStart);
    const objText = text.slice(objStart, objEnd + 1);
    const idMatch = /id:\s*'([^']+)'/.exec(objText);
    const baremKeyMatch = /barem:\s*\[/.exec(objText);
    if (idMatch && baremKeyMatch) {
      const baremOpenAbs = objStart + baremKeyMatch.index + baremKeyMatch[0].length - 1;
      const baremCloseAbs = findMatchingBracket(text, baremOpenAbs);
      const baremKeywordAbs = objStart + baremKeyMatch.index;
      map[idMatch[1]] = { start: baremOpenAbs, end: baremCloseAbs, keywordStart: baremKeywordAbs };
    }
    i = skipTrivia(objEnd + 1);
  }
  return map;
}

function lineIndent(text, atIndex) {
  const nl = text.lastIndexOf('\n', atIndex);
  return /^[ \t]*/.exec(text.slice(nl + 1, atIndex))[0];
}

function formatBaremArray(pasi, baseIndent) {
  const itemIndent = baseIndent + '  ';
  const items = pasi.map(p => `${itemIndent}{ descriere: ${JSON.stringify(p.descriere)}, puncte_maxime: ${p.puncte_maxime} }`);
  return `[\n${items.join(',\n')}\n${baseIndent}]`;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY lipsește din .env');
    process.exit(1);
  }
  const targets = ONLY_ID
    ? EXERCISES.filter(ex => ex.id === ONLY_ID)
    : EXERCISES.filter(ex => ex.subcategoryId === TARGET_SUBCAT && ex.baremEstimat === true).slice(0, LIMIT);
  console.log(`Subcapitol: ${TARGET_SUBCAT} — ${targets.length} exerciții de procesat (mod: ${APPLY ? 'APPLY (scrie data.js)' : 'DRY RUN'}).`);

  let text = fs.readFileSync(DATA_PATH, 'utf8');
  const spanMap = buildBaremSpanMap(text);

  const log = [];
  const edits = []; // {id, start, end, newText}
  let ok = 0, fail = 0;

  for (let idx = 0; idx < targets.length; idx++) {
    const ex = targets[idx];
    const span = spanMap[ex.id];
    if (!span) {
      console.log(`[${idx + 1}/${targets.length}] ${ex.id}  SKIP (no barem span found in file)`);
      log.push({ id: ex.id, status: 'skip-no-span' });
      fail++;
      continue;
    }
    const t0 = Date.now();
    try {
      const newBarem = await generateBarem(ex);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[${idx + 1}/${targets.length}] ${ex.id}  OK (${secs}s, ${newBarem.length} pași, ${ex.puncteTotal}p)`);
      const baseIndent = lineIndent(text, span.keywordStart);
      const newText = formatBaremArray(newBarem, baseIndent);
      edits.push({ id: ex.id, start: span.start, end: span.end, newText });
      log.push({ id: ex.id, status: 'ok', oldBarem: ex.barem, newBarem, secs });
      ok++;
    } catch (e) {
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[${idx + 1}/${targets.length}] ${ex.id}  FAIL (${secs}s): ${e.message}`);
      log.push({ id: ex.id, status: 'fail', error: e.message });
      fail++;
    }
    await new Promise(r => setTimeout(r, 400));
  }

  const scratchDir = process.env.CLAUDE_SCRATCH_DIR || path.join(require('os').tmpdir(), 'regen-baremuri-logs');
  fs.mkdirSync(scratchDir, { recursive: true });
  const logPath = path.join(scratchDir, `regen-baremuri-${TARGET_SUBCAT}-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');
  console.log(`\nRezultat: ${ok} ok, ${fail} eșuate. Log: ${logPath}`);

  if (!APPLY) {
    console.log('DRY RUN — nimic scris în js/data.js. Rulează din nou cu --apply ca să aplici.');
    return;
  }
  if (edits.length === 0) {
    console.log('Niciun edit de aplicat.');
    return;
  }

  const backupPath = DATA_PATH + `.bak-${Date.now()}`;
  fs.writeFileSync(backupPath, text, 'utf8');

  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) {
    text = text.slice(0, e.start) + e.newText + text.slice(e.end + 1);
  }
  fs.writeFileSync(DATA_PATH, text, 'utf8');

  try {
    const out = execFileSync(process.execPath, ['-e',
      `global.window=global; require(${JSON.stringify(DATA_PATH)}); console.log('EXERCISES=' + global.BM.EXERCISES.length);`
    ], { encoding: 'utf8' });
    console.log(`Verificare sintaxă OK după scriere: ${out.trim()}`);
    console.log(`Backup păstrat la: ${backupPath}`);
  } catch (e) {
    fs.writeFileSync(DATA_PATH, text, 'utf8'); // keep broken file for inspection but also restore backup below
    fs.copyFileSync(backupPath, DATA_PATH);
    console.error('EROARE: fișierul scris nu se mai poate încărca — am RESTAURAT din backup.');
    console.error(e.message);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
