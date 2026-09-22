#!/usr/bin/env node
/* ============================================================
   Generează, cu Gemini, câmpul `explicatie` pentru pașii unui barem
   deja existent în js/data.js — calculul desfășurat pe care îl vede
   elevul sub criteriul oficial.

   `descriere` (criteriul oficial) NU se atinge: el e ce trimite
   api/verify-exam.js lui Gemini la notare, iar formularea oficială e
   deliberat agnostică față de metodă. Explicațiile sunt strict
   pedagogice.

   Usage:
     node scripts/generate-barem-explicatii.js --id an-int-001
     node scripts/generate-barem-explicatii.js --subcat integrale
     node scripts/generate-barem-explicatii.js --id an-int-001 --apply

   Fără --apply nu se scrie nimic: doar afișează ce ar genera și
   salvează un log în scratch, ca să poată fi citit înainte de a fi
   crezut pe cuvânt.
   ============================================================ */
'use strict';
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateContentWithRetry } = require('../api/_gemini-retry');
const { extractJson } = require('../api/_gemini-shared');
const { buildBaremSpanMap, lineIndent } = require('./_data-barem-span');

const DATA_PATH = path.join(__dirname, '..', 'js', 'data.js');

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const ONLY_ID = arg('id', null);
const TARGET_SUBCAT = arg('subcat', null);
const APPLY = argv.includes('--apply');
const OUT = arg('out', null);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  generationConfig: { temperature: 0, responseMimeType: 'application/json' }
});

global.window = global;
require(DATA_PATH);
const EXERCISES = global.BM.EXERCISES;

function buildPrompt(ex) {
  const pasi = ex.barem
    .map((b, i) => `Pasul ${i + 1} (${b.puncte_maxime}p): ${b.descriere}`)
    .join('\n');

  return `Ești profesor de matematică și pregătești elevi pentru BAC-ul din Republica Moldova.

Mai jos ai un exercițiu, rezolvarea lui și BAREMUL OFICIAL, care listează criteriile de punctare. Criteriile oficiale sunt formulate foarte scurt, dintr-o propoziție, și un elev care deschide baremul ca să se verifice NU înțelege din ele cum se face efectiv calculul.

Sarcina ta: pentru FIECARE pas din barem, scrie o explicație desfășurată care arată concret cum se ajunge la acel pas.

ENUNȚ:
${ex.statement}

REZOLVARE COMPLETĂ (adevărul matematic, nu o contrazice):
${ex.solution}

BAREMUL OFICIAL (${ex.puncteTotal}p în total):
${pasi}

REGULI OBLIGATORII:
1. O explicație per pas, exact ${ex.barem.length} explicații, în aceeași ordine.
2. Explicația trebuie să conțină CALCULUL CONCRET, nu o reformulare a criteriului. Dacă criteriul zice "Determinarea unei primitive", explicația trebuie să arate ce formulă de integrare se aplică și să scrie primitiva rezultată.
3. Explică DOAR ce ține de pasul respectiv. Nu anticipa pașii următori și nu relua pașii anteriori.
4. Matematica se scrie în KaTeX: $...$ pentru formule în rând, $$...$$ pentru formule pe rând separat. Fără alte marcaje, fără **bold**, fără liste cu bulină.
5. Scrie în română, cu diacritice, la persoana I plural ("integrăm", "notăm", "obținem"), ca la tablă.
6. Nu inventa rezultate. Fiecare valoare numerică trebuie să rezulte din rezolvarea de mai sus.
7. Între 1 și 4 propoziții per explicație, plus formulele. Concis, dar complet.
8. Nu folosi caracterul — (liniuță lungă) nicăieri în text.

Răspunde STRICT cu JSON de forma:
{"explicatii": [{"nr": 1, "explicatie": "..."}, {"nr": 2, "explicatie": "..."}]}`;
}

function validate(ex, out) {
  const problems = [];
  if (!Array.isArray(out)) return ['raspunsul nu contine un array `explicatii`'];
  if (out.length !== ex.barem.length) {
    problems.push(`asteptam ${ex.barem.length} explicatii, am primit ${out.length}`);
  }
  out.forEach((e, i) => {
    const t = String(e.explicatie || '').trim();
    if (!t) problems.push(`explicatia ${i + 1} e goala`);
    if (t.includes('—')) problems.push(`explicatia ${i + 1} contine liniuta lunga`);
    if (/\*\*/.test(t)) problems.push(`explicatia ${i + 1} contine **bold**`);
    const dollars = (t.match(/\$/g) || []).length;
    if (dollars % 2 !== 0) problems.push(`explicatia ${i + 1} are delimitatori $ neperechi (${dollars})`);
  });
  return problems;
}

async function run(ex) {
  const prompt = buildPrompt(ex);
  const res = await generateContentWithRetry(model, [{ text: prompt }]);
  const raw = res.response.text();
  const parsed = extractJson(raw);
  const list = parsed && Array.isArray(parsed.explicatii) ? parsed.explicatii : null;
  return { list, raw };
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

  console.log(`${targets.length} exercitii de procesat (mod: ${APPLY ? 'APPLY' : 'DRY RUN'}).\n`);

  const results = [];
  for (const ex of targets) {
    process.stdout.write(`${ex.id} ... `);
    try {
      const { list, raw } = await run(ex);
      const problems = validate(ex, list);
      console.log(problems.length ? `PROBLEME: ${problems.join('; ')}` : 'ok');
      results.push({ id: ex.id, ex, list, raw, problems });
    } catch (err) {
      console.log('EROARE: ' + err.message);
      results.push({ id: ex.id, ex, list: null, raw: '', problems: ['exceptie: ' + err.message] });
    }
  }

  const outPath = OUT || path.join(require('os').tmpdir(), 'barem-explicatii.json');
  fs.writeFileSync(outPath, JSON.stringify(results.map(r => ({
    id: r.id,
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

  // ---- scriere ----
  const usable = results.filter(r => r.list && !r.problems.length);
  const skipped = results.filter(r => !r.list || r.problems.length);
  if (skipped.length) {
    skipped.forEach(r => console.log(`SARIT ${r.id}: ${r.problems.join('; ')}`));
  }
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
