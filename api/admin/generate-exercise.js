'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model  = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: { temperature: 0 }
});

const GRADE_LABELS = { '9': 'a IX-a', 'bac': 'a XII-a (BAC)' };

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

function buildPrompt(context) {
  const { grade, categoryName, subcategoryName, difficulty } = context;
  return `Ești un profesor de matematică care pregătește un exercițiu nou pentru platforma Mathorizon (BAC Moldova). Ai primit o fotografie a unui exercițiu de matematică, pentru clasa: ${GRADE_LABELS[grade] || grade}, capitolul "${categoryName}", subcapitolul "${subcategoryName}", dificultate "${difficulty}".

Transcrie exercițiul din imagine EXACT, folosind notație LaTeX cu $...$ (inline) și $$...$$ (block) — nu folosi alte delimitatoare.

Returnează STRICT un obiect JSON valid (fără markdown, fără text suplimentar):
{
  "titlu": "titlu scurt descriptiv",
  "enunt_katex": "enunțul complet, cu $...$/$$...$$",
  "raspuns_final": "răspunsul final (LaTeX)",
  "punctaj_total": 7,
  "pasi_barem": [
    { "nr": 1, "descriere": "ce trebuie demonstrat/calculat la acest pas", "operatie_katex": "calculul propriu-zis, LaTeX", "puncte_maxime": 3, "puncte_partiale": false, "nota_evaluare": "ce trebuie verificat strict la acest pas" }
  ],
  "metode_alternative": [
    { "nume": "Metodă alternativă (nume scurt)", "descriere": "rezumat al altei metode valide" }
  ]
}

Reguli:
- suma puncte_maxime din pasi_barem = exact punctaj_total
- împarte pașii logic, ca într-un barem oficial BAC Moldova
- metode_alternative poate fi listă goală dacă nu există altă metodă validă`;
}

async function generateExercise({ imageBase64, mimeType, context }) {
  if (!imageBase64) throw new Error('missing imageBase64');

  const prompt = buildPrompt(context || {});
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
  ]);

  const raw     = result.response.text().trim();
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(jsonStr);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { accessToken, imageBase64, mimeType, context } = req.body || {};
    await requireAdmin(accessToken);

    const parsed = await generateExercise({ imageBase64, mimeType, context });
    res.status(200).json(parsed);
  } catch (e) {
    const status = e.message === 'forbidden' ? 403 : 400;
    res.status(status).json({ error: e.message });
  }
};
