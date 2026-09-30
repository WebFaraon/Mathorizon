#!/usr/bin/env node
/* ============================================================
   Generează, cu Gemini, câmpul `explicatie` pentru pașii unui barem
   deja existent în js/data.js: calculul desfășurat pe care îl vede
   elevul sub criteriul oficial.

   `descriere` (criteriul oficial) NU se atinge: el e ce trimite
   api/verify-exam.js lui Gemini la notare, iar formularea oficială e
   deliberat agnostică față de metodă. Explicațiile sunt strict
   pedagogice.

   Fiecare răspuns al lui Gemini trece prin două verificări înainte să fie
   acceptat: regulile de conținut (scripts/_explicatie-rules.js) și lățimea
   în browser real (scripts/_explicatie-browser-lint.js). Dacă pică, i se
   retrimit exact încălcările și refă explicațiile, de cel mult MAX_ATTEMPTS
   ori. Ce se scrie în data.js e chiar răspunsul verificat, nu o cerere nouă.
   Regulile sunt descrise în docs/barem-explicatii.md.

   Usage:
     node scripts/generate-barem-explicatii.js --id an-int-001
     node scripts/generate-barem-explicatii.js --subcat integrale
     node scripts/generate-barem-explicatii.js --id an-int-001 --apply
     node scripts/generate-barem-explicatii.js --id an-int-001 --no-browser
     node scripts/generate-barem-explicatii.js --id an-int-001 --apply --from-log <log.json>
        (scrie exact ce ai citit intr-o proba anterioara, fara o cerere noua)

   Fără --apply nu se scrie nimic: doar afișează ce ar genera și
   salvează un log, ca să poată fi citit înainte de a fi crezut pe cuvânt.
   ============================================================ */
'use strict';
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateContentWithRetry } = require('../api/_gemini-retry');
const { extractJson } = require('../api/_gemini-shared');
const { buildBaremSpanMap, lineIndent } = require('./_data-barem-span');
const { RULES_PROMPT, CONTENT_PROMPT, lintStatic } = require('./_explicatie-rules');
const { lintLayout } = require('./_explicatie-browser-lint');

const DATA_PATH = path.join(__dirname, '..', 'js', 'data.js');
const MAX_ATTEMPTS = 3;

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const ONLY_ID = arg('id', null);
const TARGET_SUBCAT = arg('subcat', null);
const APPLY = argv.includes('--apply');
const NO_BROWSER = argv.includes('--no-browser');
const OUT = arg('out', null);
// Scrie EXACT ce s-a citit intr-o proba anterioara, fara o cerere noua catre
// Gemini: raspunsurile nu sunt deterministe nici la temperatura 0, deci un
// --apply simplu ar scrie altceva decat ai verificat. Trece din nou prin ambele
// verificari inainte de scriere.
const FROM_LOG = arg('from-log', null);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  generationConfig: { temperature: 0, responseMimeType: 'application/json' }
});

global.window = global;
require(DATA_PATH);
const EXERCISES = global.BM.EXERCISES;

function buildPrompt(ex, feedback) {
  const pasi = ex.barem
    .map((b, i) => `Pasul ${i + 1} (${b.puncte_maxime}p): ${b.descriere}`)
    .join('\n');

  const retry = feedback
    ? `\n\nRĂSPUNSUL TĂU ANTERIOR A ÎNCĂLCAT REGULILE DE FORMĂ:\n${feedback}\nRefă TOATE explicațiile, respectând regulile de formă de mai sus. Nu schimba matematica, doar forma.\n`
    : '';

  return `Ești profesor de matematică și pregătești elevi pentru BAC-ul din Republica Moldova.

Mai jos ai un exercițiu, rezolvarea lui și BAREMUL OFICIAL, care listează criteriile de punctare. Criteriile oficiale sunt formulate foarte scurt, dintr-o propoziție, și un elev care deschide baremul ca să se verifice NU înțelege din ele cum se face efectiv calculul.

Sarcina ta: pentru FIECARE pas din barem, scrie o explicație desfășurată care arată concret cum se ajunge la acel pas.

ENUNȚ:
${ex.statement}

REZOLVARE COMPLETĂ (adevărul matematic, nu o contrazice):
${ex.solution}

BAREMUL OFICIAL (${ex.puncteTotal}p în total):
${pasi}

Scrie exact ${ex.barem.length} explicații, în aceeași ordine ca pașii. Matematica se scrie în KaTeX: $...$ pentru formule în rând, $$...$$ pentru formule pe rând separat.

${CONTENT_PROMPT}

${RULES_PROMPT}${retry}
Răspunde STRICT cu JSON de forma:
{"explicatii": [{"nr": 1, "explicatie": "..."}, {"nr": 2, "explicatie": "..."}]}`;
}

/* Întoarce problemele pe pas: [{ step, msgs: [...] }] */
async function check(ex, list) {
  const perStep = [];
  if (!Array.isArray(list)) return [{ step: 0, msgs: ['raspunsul nu contine un array `explicatii`'] }];
  if (list.length !== ex.barem.length) {
    return [{ step: 0, msgs: [`asteptam ${ex.barem.length} explicatii, am primit ${list.length}`] }];
  }

  list.forEach((e, i) => {
    const msgs = lintStatic(String(e.explicatie || ''));
    if (msgs.length) perStep.push({ step: i + 1, msgs });
  });
  if (perStep.length) return perStep;   // pana nu trece continutul, latimea nu are sens

  if (!NO_BROWSER) {
    const layout = await lintLayout(list.map((e, i) => ({
      criterion: ex.barem[i].descriere,
      points: ex.barem[i].puncte_maxime,
      explicatie: String(e.explicatie || '').trim()
    })));
    if (!layout.available) {
      if (!check.warned) { console.log(`\n  ATENTIE: verificarea de latime nu a rulat (${layout.reason}). Se scrie doar cu regulile de continut.`); check.warned = true; }
    } else {
      layout.problems.forEach((msgs, i) => { if (msgs.length) perStep.push({ step: i + 1, msgs }); });
    }
  }
  return perStep;
}

function feedbackText(problems) {
  return problems.map(p => `- ${p.step ? 'Pasul ' + p.step + ': ' : ''}${p.msgs.join('; ')}`).join('\n');
}

async function generateOne(ex) {
  let feedback = '';
  let last = { list: null, raw: '', problems: [{ step: 0, msgs: ['nicio incercare'] }], attempts: 0 };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await generateContentWithRetry(model, [{ text: buildPrompt(ex, feedback) }]);
    const raw = res.response.text();
    let parsed = null;
    try { parsed = extractJson(raw); } catch (e) { /* problems mai jos */ }
    const list = parsed && Array.isArray(parsed.explicatii) ? parsed.explicatii : null;
    const problems = await check(ex, list);
    last = { list, raw, problems, attempts: attempt };
    if (!problems.length) return last;
    if (attempt < MAX_ATTEMPTS) {
      process.stdout.write(`\n    incercarea ${attempt}: ${problems.length} pasi cu probleme, retrimit... `);
      feedback = feedbackText(problems);
    }
  }
  return last;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY lipseste din .env');
    process.exit(1);
  }
  const targets = ONLY_ID
    ? EXERCISES.filter(e => e.id === ONLY_ID)
    : TARGET_SUBCAT
      ? EXERCISES.filter(e => e.subcategoryId === TARGET_SUBCAT && Array.isArray(e.barem) && e.barem.length)
      : [];

  if (!targets.length) {
    console.error('niciun exercitiu tinta. Foloseste --id <id> sau --subcat <subcategorie>.');
    process.exit(1);
  }

  console.log(`${targets.length} exercitii de procesat (mod: ${APPLY ? 'APPLY' : 'DRY RUN'}, cel mult ${MAX_ATTEMPTS} incercari fiecare).\n`);

  const results = [];
  for (const ex of targets) {
    process.stdout.write(`${ex.id} ... `);
    try {
      let r;
      if (FROM_LOG) {
        const logData = JSON.parse(fs.readFileSync(FROM_LOG, 'utf8'));
        const entry = logData.find(e => e.id === ex.id);
        if (!entry || !Array.isArray(entry.pasi) || !entry.pasi.length) throw new Error(`nu exista ${ex.id} in ${FROM_LOG}`);
        const list = entry.pasi.map(p => ({ nr: p.nr, explicatie: p.explicatie_gemini }));
        const problems = await check(ex, list);
        r = { list, raw: '', problems, attempts: 0 };
      } else {
        r = await generateOne(ex);
      }
      console.log(r.problems.length
        ? `\n    RESPINS dupa ${r.attempts} incercari:\n${feedbackText(r.problems).replace(/^/gm, '      ')}`
        : (r.attempts ? `ok (incercarea ${r.attempts})` : `ok (din log, reverificat)`));
      results.push({ id: ex.id, ex, ...r });
    } catch (err) {
      console.log('EROARE: ' + err.message);
      results.push({ id: ex.id, ex, list: null, raw: '', attempts: 0, problems: [{ step: 0, msgs: ['exceptie: ' + err.message] }] });
    }
  }

  const outPath = OUT || path.join(require('os').tmpdir(), 'barem-explicatii.json');
  fs.writeFileSync(outPath, JSON.stringify(results.map(r => ({
    id: r.id,
    attempts: r.attempts,
    problems: r.problems,
    pasi: (r.list || []).map((e, i) => ({
      nr: i + 1,
      criteriu: r.ex.barem[i] && r.ex.barem[i].descriere,
      explicatie_gemini: e.explicatie,
      explicatie_actuala: r.ex.barem[i] && r.ex.barem[i].explicatie
    }))
  })), null, 2), 'utf8');
  console.log('\nlog scris in: ' + outPath);

  if (!APPLY) {
    console.log('(dry run: js/data.js nu a fost atins)');
    return;
  }

  // ---- scriere: doar ce a trecut de ambele verificari ----
  const usable = results.filter(r => r.list && !r.problems.length);
  const skipped = results.filter(r => !r.list || r.problems.length);
  skipped.forEach(r => console.log(`SARIT ${r.id}: respins de reguli, nu s-a scris nimic pentru el.`));
  if (!usable.length) {
    console.log('nimic de scris.');
    return;
  }

  let text = fs.readFileSync(DATA_PATH, 'utf8');
  const spanMap = buildBaremSpanMap(text);

  // editez de la coada spre cap, ca offset-urile deja calculate sa ramana valide
  const edits = [];
  for (const r of usable) {
    const span = spanMap[r.id];
    if (!span) { console.log(`SARIT ${r.id}: nu i-am gasit blocul barem in data.js`); continue; }
    const baseIndent = lineIndent(text, span.keywordStart);
    const itemIndent = baseIndent + '  ';
    // descriere si puncte_maxime vin din obiectul existent, NU de la Gemini:
    // criteriul oficial nu se rescrie, se adauga doar explicatia.
    const items = r.ex.barem.map((b, i) => {
      const expl = String(r.list[i].explicatie || '').trim();
      return `${itemIndent}{ descriere: ${JSON.stringify(b.descriere)}, puncte_maxime: ${b.puncte_maxime}, explicatie: ${JSON.stringify(expl)} }`;
    });
    edits.push({ id: r.id, start: span.start, end: span.end, newText: `[\n${items.join(',\n')}\n${baseIndent}]` });
  }

  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) {
    text = text.slice(0, e.start) + e.newText + text.slice(e.end + 1);
  }
  fs.writeFileSync(DATA_PATH, text, 'utf8');
  console.log(`\nscris in js/data.js: ${edits.map(e => e.id).join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
