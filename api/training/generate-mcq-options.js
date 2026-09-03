'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateContentWithRetry, geminiErrorStatus } = require('../_gemini-retry');
const { extractJson } = require('../_gemini-shared');

const SUPABASE_URL         = 'https://tfflpivehrrzmklvcyhe.supabase.co';
const SUPABASE_ANON        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// JSON output mode without a responseSchema — see the note in
// api/admin/generate-exercise.js: the constrained decoder measured 150-300s+
// on the same prompt that JSON mode alone answers in seconds. The shape is
// stated in the prompt's JSON template and re-asserted after parsing.
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

// Lighter sibling of generate-exercise.js's requireAdmin — any logged-in
// student may trigger generation (it's a shared read-through cache, not an
// admin action), so this only checks for a valid session, not a role.
async function requireAuth(accessToken) {
  if (!accessToken) throw new Error('unauthorized');
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` }
  });
  if (!userRes.ok) throw new Error('unauthorized');
  return userRes.json();
}

async function getCachedRow(exerciseId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/training_mcq_cache?exercise_id=eq.${encodeURIComponent(exerciseId)}&select=correct_answer,distractors`,
    { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function writeCacheRow(exerciseId, correctAnswer, distractors) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return; // best-effort — a missing key shouldn't break the response
  await fetch(`${SUPABASE_URL}/rest/v1/training_mcq_cache`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ exercise_id: exerciseId, correct_answer: correctAnswer, distractors })
  }).catch(() => {});
}

function buildBaremBlock(barem) {
  if (!Array.isArray(barem) || !barem.length) return '(fără barem detaliat disponibil)';
  return barem.map((p, i) => `Pasul ${i + 1} (${p.puncte_maxime || '?'}p): ${p.descriere || ''}`).join('\n');
}

function buildPrompt({ statement, solution, barem }) {
  return `Ești un profesor de matematică care pregătește un exercițiu tip grilă (o variantă corectă + 3 variante greșite) pentru un elev care se pregătește de BAC.

ENUNȚUL exercițiului:
${statement || ''}

SOLUȚIA completă (barem oficial):
${buildBaremBlock(barem)}

SOLUȚIA text (rezumat):
${solution || ''}

Sarcina ta:
1. Stabilește răspunsul final corect, ca o expresie LaTeX scurtă, brută (fără $ / $$ în jur, fără unitate de măsură) — la fel cum ar apărea într-un \\boxed{}.
2. Generează EXACT 3 răspunsuri greșite, dar plauzibile — fiecare trebuie să corespundă unei greșeli TIPICE, SPECIFICE pe care un elev chiar ar putea s-o facă la ACEST exercițiu concret (ex: o eroare de semn la un pas anume din barem, aplicarea formulei greșite, alegerea ramurii/cazului greșit într-o inecuație, un capăt de interval deschis/închis greșit, o eroare aritmetică la un pas anume). Uită-te la pașii din barem și imaginează-ți "un elev care a greșit exact la pasul N, dar a făcut restul corect".

Reguli stricte:
- NU genera distractori aleatorii, fără legătură cu problema — fiecare trebuie motivat de o greșeală reală, plauzibilă la ACEST exercițiu.
- NU genera doi distractori identici sau echivalenți matematic între ei sau cu răspunsul corect (aceeași valoare scrisă altfel) — cele 4 variante trebuie să fie distincte ca valoare.
- Răspunsurile (corect + cele 3 greșite) trebuie să fie scurte — expresii LaTeX brute, nu propoziții.

Pentru fiecare distractor, completează și "reason" cu o notă scurtă (internă, nu se arată elevului) despre ce greșeală modelează.`;
}

async function generateMcqOptions({ statement, solution, barem }) {
  const prompt = buildPrompt({ statement, solution, barem });
  const result = await generateContentWithRetry(model, [{ text: prompt }]);

  const parsed = extractJson(result.response.text().trim());
  return {
    correctAnswer: String(parsed?.correctAnswer ?? ''),
    distractors: (Array.isArray(parsed?.distractors) ? parsed.distractors : [])
      .filter(d => d && typeof d === 'object')
      .map(d => ({ value: String(d.value ?? ''), reason: String(d.reason ?? '') }))
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { accessToken, exerciseId, statement, solution, barem } = req.body || {};
    if (!exerciseId) throw new Error('missing exerciseId');

    // Idempotent under a race: two students opening the same never-seen
    // card at once shouldn't both trigger (and both pay for) a Gemini call.
    const cached = await getCachedRow(exerciseId);
    if (cached) {
      res.status(200).json({ correctAnswer: cached.correct_answer, distractors: cached.distractors });
      return;
    }

    await requireAuth(accessToken);

    const parsed = await generateMcqOptions({ statement, solution, barem });
    const distractorValues = (parsed.distractors || []).map(d => d.value);
    await writeCacheRow(exerciseId, parsed.correctAnswer, distractorValues);

    res.status(200).json({ correctAnswer: parsed.correctAnswer, distractors: distractorValues });
  } catch (e) {
    // A quota/timeout/overload failure gets its own status and Romanian text
    // from _gemini-retry; anything else stays the opaque 'generation_failed'
    // this route has always returned (training.js just falls back to the
    // free-text answer UI on any non-2xx, so the body is advisory).
    const status = e.message === 'unauthorized' ? 401
                 : e.message === 'missing exerciseId' ? 400
                 : (geminiErrorStatus(e) || 502);
    if (status >= 500 || status === 429) console.error('[generate-mcq-options]', e.code || '', e.cause || e);
    res.status(status).json({ error: e.code ? e.message : (status === 502 ? 'generation_failed' : e.message), code: e.code || null });
  }
};
