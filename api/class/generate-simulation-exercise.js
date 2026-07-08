'use strict';
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

// Trimmed-down schema — no barem/pasi/metode_alternative/duplicat, since
// Simulări grading is exact-final-answer-match only, not step-by-step barem.
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    titlu:         { type: SchemaType.STRING },
    enunt_katex:   { type: SchemaType.STRING },
    raspuns_final: { type: SchemaType.STRING }
  },
  required: ['titlu', 'enunt_katex', 'raspuns_final']
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model  = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA
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

Acest exercițiu va fi notat prin comparație EXACTĂ cu răspunsul final (fără barem pe pași) — determină și tu răspunsul final corect al exercițiului.

Returnează STRICT un obiect JSON valid (fără markdown, fără text suplimentar), cu EXACT această structură:
{
  "titlu": "titlu scurt descriptiv",
  "enunt_katex": "enunțul complet, cu $...$/$$...$$",
  "raspuns_final": "răspunsul final ca expresie LaTeX BRUTĂ, FĂRĂ delimitatoare $ sau $$ în jurul ei (ex: -1, nu $-1$; sau x=3, sau {1,2})"
}`;
}

async function generateSimulationExercise({ imageBase64, mimeType, context }) {
  if (!imageBase64) throw new Error('missing imageBase64');

  const prompt = buildPrompt(context);
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
  ]);

  const raw     = result.response.text().trim();
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Same LaTeX-backslash JSON-escaping fix as api/admin/generate-exercise.js.
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
    const { accessToken, imageBase64, mimeType, context } = req.body || {};
    await requireTeacher(accessToken);

    const parsed = await generateSimulationExercise({ imageBase64, mimeType, context });
    res.status(200).json(parsed);
  } catch (e) {
    const status = e.message === 'forbidden' ? 403 : 400;
    res.status(status).json({ error: e.message });
  }
};
