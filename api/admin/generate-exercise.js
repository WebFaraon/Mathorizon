'use strict';
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { generateContentWithRetry } = require('../_gemini-retry');

const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

// Structured-output schema — forces Gemini's constrained JSON-mode decoder to
// emit syntactically valid JSON (correctly escaped backslashes) instead of
// relying on the model to remember JSON string-escaping rules while writing
// LaTeX-heavy text (\frac, \boxed, \right...). This is the root-cause fix for
// the "Bad escaped character in JSON" failures — the try/catch repair below
// is kept only as a defensive fallback, not the primary defense anymore.
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    titlu:          { type: SchemaType.STRING },
    enunt_katex:    { type: SchemaType.STRING },
    raspuns_final:  { type: SchemaType.STRING },
    punctaj_total:  { type: SchemaType.INTEGER },
    pasi_barem: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nr:             { type: SchemaType.INTEGER },
          descriere:      { type: SchemaType.STRING },
          puncte_maxime:  { type: SchemaType.INTEGER }
        },
        required: ['nr', 'descriere', 'puncte_maxime']
      }
    },
    // Same-call, zero-extra-cost self-check (see generate-simulation-exercise.js
    // for the rationale) — placed after pasi_barem so the model cross-checks
    // raspuns_final against an independent numeric substitution, not just
    // against its own step derivation.
    verificare_numerica: { type: SchemaType.STRING },
    verificat:            { type: SchemaType.BOOLEAN },
    metode_alternative: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nume:      { type: SchemaType.STRING },
          descriere: { type: SchemaType.STRING }
        },
        required: ['nume', 'descriere']
      }
    },
    duplicat: {
      type: SchemaType.OBJECT,
      properties: {
        este_duplicat: { type: SchemaType.BOOLEAN },
        titlu_similar: { type: SchemaType.STRING },
        motiv:         { type: SchemaType.STRING }
      },
      required: ['este_duplicat', 'titlu_similar', 'motiv']
    }
  },
  required: ['titlu', 'enunt_katex', 'raspuns_final', 'punctaj_total', 'pasi_barem', 'verificare_numerica', 'verificat', 'metode_alternative', 'duplicat']
};

// Google retired the entire Gemini 2.x generation from generateContent (404
// "no longer available") even though some 2.x entries still show up in
// ListModels — gemini-3-flash-preview is the current working replacement
// (confirmed directly against the API, including structured-output support).
// Being a "-preview" name, it may itself get renamed later — if this starts
// 404ing again, check https://ai.google.dev/gemini-api/docs/models for the
// current model list.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model  = genAI.getGenerativeModel({
  model: 'gemini-3-flash-preview',
  generationConfig: {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA
  }
});

const GRADE_LABELS = { '9': 'a IX-a', 'bac': 'a XII-a (BAC)' };

// Real, hand-transcribed BAC Moldova baremuri (only calcul-algebric has these
// today — see js/data.js) used as few-shot style examples so Gemini matches
// the official granularity/phrasing for every chapter, not just this one.
const OFFICIAL_EXAMPLES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'official-barem-examples.json'), 'utf8')
);

function buildExamplesBlock() {
  return OFFICIAL_EXAMPLES.map((ex, i) => {
    const pasi = ex.pasi.map(p => `   Pasul ${p.nr} (${p.puncte_maxime}p): ${p.descriere}`).join('\n');
    return `${i + 1}. "${ex.titlu}" — enunț: ${ex.enunt.replace(/\n/g, ' ')} — total ${ex.punctaj_total}p\n${pasi}`;
  }).join('\n\n');
}
const EXAMPLES_BLOCK = buildExamplesBlock();

async function requireAdmin(accessToken) {
  if (!accessToken) throw new Error('missing accessToken');

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` }
  });
  if (!userRes.ok) throw new Error('invalid session');
  const user = await userRes.json();

  const profRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${user.id}&select=role`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` }
  });
  const rows = await profRes.json();
  if (!Array.isArray(rows) || rows[0]?.role !== 'admin') throw new Error('forbidden');
}

function buildDuplicatesBlock(existingExercises) {
  if (!Array.isArray(existingExercises) || !existingExercises.length) {
    return 'Nu există alte exerciții deja introduse în acest subcapitol — câmpul "duplicat" va fi mereu { "este_duplicat": false, "titlu_similar": "", "motiv": "" }.';
  }
  const list = existingExercises.map((e, i) =>
    `${i + 1}. "${e.title || ''}" — ${(e.statement || '').replace(/\n/g, ' ')}`
  ).join('\n');
  return `IATĂ EXERCIȚIILE DEJA EXISTENTE ÎN ACEST SUBCAPITOL (verifică dacă noul exercițiu din fotografie e identic sau o variantă trivială — aceleași numere/structură — a vreunuia dintre ele; enunțuri diferite ca formă dar cu aceeași idee matematică NU sunt duplicat):
${list}`;
}

function buildPrompt(context, existingExercises) {
  const { grade, categoryName, subcategoryName, difficulty, punctajTotal } = context;
  const totalBlock = punctajTotal
    ? `Profesorul a indicat deja că acest exercițiu este notat cu EXACT ${punctajTotal} puncte — este punctajul oficial, nu-l ghici tu. Împarte baremul astfel încât suma puncte_maxime din pasi_barem să fie EXACT ${punctajTotal}, nu altă valoare.`
    : `Estimează punctajul total ca într-un barem oficial BAC Moldova.`;

  return `Ești un profesor de matematică care pregătește un exercițiu nou pentru platforma Mathorizon (BAC Moldova). Ai primit o fotografie a unui exercițiu de matematică, pentru clasa: ${GRADE_LABELS[grade] || grade}, capitolul "${categoryName}", subcapitolul "${subcategoryName}", dificultate "${difficulty}".

Transcrie exercițiul din imagine EXACT, folosind notație LaTeX cu $...$ (inline) și $$...$$ (block) — nu folosi alte delimitatoare.

${totalBlock}

IATĂ ${OFFICIAL_EXAMPLES.length} EXEMPLE REALE DE BAREME OFICIALE BAC MOLDOVA (transcrise manual din documente oficiale) — construiește baremul noului exercițiu EXACT în acest stil: fiecare pas combină explicația și calculul matematic într-un singur câmp "descriere" (nu le separa), punctajul se împarte pe pași de calcul logici, nu pe fiecare linie:

${EXAMPLES_BLOCK}

${buildDuplicatesBlock(existingExercises)}

După ce stabilești raspuns_final și pasi_barem, VERIFICĂ independent rezultatul — de exemplu prin substituirea unei valori numerice concrete în enunțul original și recalculare, sau printr-o metodă diferită de cea folosită în barem. Dacă verificarea arată o discrepanță, corectează raspuns_final și pasi_barem înainte de a răspunde — nu trimite un rezultat neconsistent.

Returnează STRICT un obiect JSON valid (fără markdown, fără text suplimentar), cu EXACT această structură (fără câmpuri suplimentare):
{
  "titlu": "titlu scurt descriptiv",
  "enunt_katex": "enunțul complet, cu $...$/$$...$$",
  "raspuns_final": "răspunsul final ca expresie LaTeX BRUTĂ, FĂRĂ delimitatoare $ sau $$ în jurul ei (ex: -1, nu $-1$) — deja verificat",
  "punctaj_total": ${punctajTotal || 7},
  "pasi_barem": [
    { "nr": 1, "descriere": "explicația și calculul acestui pas, cu LaTeX $...$/$$...$$ inclus direct în text", "puncte_maxime": 3 }
  ],
  "verificare_numerica": "rezumat scurt al verificării făcute: ce valoare/metodă ai folosit și ce ai obținut (ex: 'la x=2, enunțul evaluat dă -122, iar rezultatul evaluat la x=2 dă tot -122')",
  "verificat": true doar dacă verificarea de mai sus a confirmat rezultatul fără nicio discrepanță, altfel false,
  "metode_alternative": [
    { "nume": "Metodă alternativă (nume scurt)", "descriere": "rezumat al altei metode valide" }
  ],
  "duplicat": { "este_duplicat": false, "titlu_similar": "", "motiv": "" }
}

Reguli:
- suma puncte_maxime din pasi_barem = exact punctaj_total
- fiecare "descriere" este text final, gata de afișat elevilor — nu adăuga alte câmpuri
- metode_alternative poate fi listă goală dacă nu există altă metodă validă
- "duplicat.este_duplicat" = true DOAR dacă noul exercițiu e practic identic (aceleași numere/aceeași structură) cu unul din lista de mai sus; altfel false`;
}

async function generateExercise({ imageBase64, mimeType, context, existingExercises }) {
  if (!imageBase64) throw new Error('missing imageBase64');

  const prompt = buildPrompt(context || {}, existingExercises);
  const result = await generateContentWithRetry(model, [
    { text: prompt },
    { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
  ]);

  const raw     = result.response.text().trim();
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Gemini's JSON often contains raw LaTeX backslashes (\log, \sqrt, \left,
    // \frac, \boxed, \notin, \right, \tan, \underline...) that it forgot to
    // double per JSON string-escaping rules (a literal "\" must be written
    // "\\"). Note: \b \f \n \r \t \u are technically valid single-char JSON
    // escapes too, but in this LaTeX-transcription context a backslash
    // followed by one of THOSE letters is essentially always the start of a
    // LaTeX command (\boxed, \frac, \notin, \right, \tan, \underline), not a
    // real control character — so only "\" "/ and a genuine \uXXXX (4 hex
    // digits) are treated as already-valid; everything else gets doubled.
    const repaired = jsonStr.replace(/\\(?!["\\/]|u[0-9a-fA-F]{4})/g, '\\\\');
    return JSON.parse(repaired);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { accessToken, imageBase64, mimeType, context, existingExercises } = req.body || {};
    await requireAdmin(accessToken);

    const parsed = await generateExercise({ imageBase64, mimeType, context, existingExercises });
    res.status(200).json(parsed);
  } catch (e) {
    const status = e.message === 'forbidden' ? 403 : 400;
    res.status(status).json({ error: e.message });
  }
};
