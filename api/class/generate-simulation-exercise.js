'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateContentWithRetry, geminiErrorStatus } = require('../_gemini-retry');
const { extractJson, normalizeImageMime } = require('../_gemini-shared');

const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

// JSON output mode without a responseSchema — same reasoning (and the same
// measured 150-300s+ constrained-decoder stall) as api/admin/generate-exercise.js.
// The field list and the deliberate field ORDER the schema used to pin down —
// verificare_numerica BEFORE raspuns_final, so the model derives the check
// first instead of rationalising one after the fact — are stated verbatim in
// the prompt's JSON template below, and normalizeResult() re-asserts the shape
// after parsing.

// Google retired the entire Gemini 2.x generation from generateContent (404
// "no longer available"). We initially replaced it with gemini-3-flash-preview,
// but "-preview" models carry noticeably more restrictive rate limits than
// stable releases and started throwing transient 503 "high demand" errors as
// usage grew — gemini-3.5-flash is the stable/GA successor in the same tier,
// so it's used instead. Check https://ai.google.dev/gemini-api/docs/models
// for the current stable model list if this starts 404ing later.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model  = genAI.getGenerativeModel({
  // Overridable without a code change (GEMINI_MODEL) — the model list moves
  // often enough that this file has already been rewritten for it twice.
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  generationConfig: {
    temperature: 0,
    responseMimeType: 'application/json'
  }
});

const GRADE_LABELS = {
  '5': 'a V-a', '6': 'a VI-a', '7': 'a VII-a', '8': 'a VIII-a', '9': 'a IX-a',
  '10': 'a X-a', '11': 'a XI-a', '12': 'a XII-a', bac: 'a XII-a (BAC)'
};

async function requireTeacher(accessToken) {
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
  const role = Array.isArray(rows) ? rows[0]?.role : undefined;
  if (role !== 'admin' && role !== 'profesor') throw new Error('forbidden');
}

function buildPrompt(context) {
  const { grade, categoryName, subcategoryName } = context || {};
  const chapterBlock = categoryName
    ? ` din capitolul "${categoryName}"${subcategoryName ? `, subcapitolul "${subcategoryName}"` : ''}`
    : '';

  return `Ești un profesor de matematică care pregătește un exercițiu pentru un test de clasă (platforma Mathorizon), pentru clasa: ${GRADE_LABELS[grade] || grade}${chapterBlock}. Ai primit o fotografie a unui exercițiu dintr-o culegere.

Transcrie exercițiul din imagine EXACT, folosind notație LaTeX cu $...$ (inline) și $$...$$ (block) — nu folosi alte delimitatoare.

Acest exercițiu va fi notat prin comparație EXACTĂ cu răspunsul final (fără barem pe pași) — determină și tu răspunsul final corect al exercițiului. Rezolvă-l cu atenție, apoi VERIFICĂ independent rezultatul înainte de a-l finaliza — de exemplu prin substituirea unei valori numerice concrete în enunțul original și recalculare, sau printr-o metodă diferită de cea folosită prima dată. Dacă verificarea arată o discrepanță, recalculează până obții un rezultat consistent — raspuns_final trebuie să fie deja varianta corectată.

Returnează STRICT un obiect JSON valid (fără markdown, fără text suplimentar), cu EXACT această structură:
{
  "titlu": "titlu scurt descriptiv",
  "enunt_katex": "enunțul complet, cu $...$/$$...$$",
  "verificare_numerica": "rezumat scurt al verificării făcute: ce valoare/metodă ai folosit și ce ai obținut (ex: 'la x=2, enunțul evaluat dă -122, iar rezultatul evaluat la x=2 dă tot -122')",
  "raspuns_final": "răspunsul final ca expresie LaTeX BRUTĂ, FĂRĂ delimitatoare $ sau $$ în jurul ei (ex: -1, nu $-1$; sau x=3, sau {1,2}) și FĂRĂ unitate de măsură (ex: 24√6, nu 24√6 cm² — acest exercițiu e notat prin comparație EXACTĂ cu ce tastează elevul, care de regulă nu include unități) — deja verificat",
  "verificat": true doar dacă verificarea de mai sus a confirmat rezultatul fără nicio discrepanță, altfel false
}`;
}

// Guarantees the response SHAPE the client renders against — the job the
// removed responseSchema's `required` list used to do. Purely structural:
// fills in missing fields and coerces types, never invents or alters content.
function normalizeResult(parsed) {
  const r = parsed && typeof parsed === 'object' ? parsed : {};
  const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
  return {
    titlu:               str(r.titlu),
    enunt_katex:         str(r.enunt_katex),
    verificare_numerica: str(r.verificare_numerica),
    raspuns_final:       str(r.raspuns_final),
    // tri-state on purpose: class-page.js shows a red "AI-ul nu și-a putut
    // confirma" banner on false but stays quiet on null (no self-check given)
    verificat:           typeof r.verificat === 'boolean' ? r.verificat : null
  };
}

async function generateSimulationExercise({ imageBase64, mimeType, context }) {
  if (!imageBase64) throw new Error('missing imageBase64');

  const prompt = buildPrompt(context);
  const result = await generateContentWithRetry(model, [
    { text: prompt },
    { inlineData: { mimeType: normalizeImageMime(mimeType), data: imageBase64 } }
  ]);

  const raw = result.response.text().trim();
  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (e) {
    // Was a bare "Unexpected token …" with no hint of what actually came
    // back; the first part of the raw reply distinguishes "Gemini wrote
    // prose" from "Gemini returned an empty/blocked response".
    const err = new Error(`Răspunsul Gemini nu a putut fi interpretat ca JSON (${e.message}). Început: ${raw.slice(0, 160)}`);
    err.status = 502;
    throw err;
  }
  return normalizeResult(parsed);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { accessToken, imageBase64, mimeType, context } = req.body || {};
    await requireTeacher(accessToken);

    const parsed = await generateSimulationExercise({ imageBase64, mimeType, context });
    res.status(200).json(parsed);
  } catch (e) {
    // Quota/timeout/overload failures carry their own status + Romanian
    // message from _gemini-retry instead of a blanket 400 with raw English.
    const status = e.message === 'forbidden' ? 403 : (geminiErrorStatus(e) || 400);
    if (status >= 500) console.error('[generate-simulation-exercise]', e.code || '', e.cause || e);
    res.status(status).json({ error: e.message, code: e.code || null });
  }
};
