'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model  = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: { temperature: 0 }
});

const SYSTEM_PROMPT = `Ești un profesor de matematică care corectează o lucrare de examen BAC Moldova.
Evaluezi rezolvarea unui elev scrisă de mână, bazându-te EXCLUSIV pe baremul oficial furnizat.
Reguli obligatorii:
- Acordă puncte parțiale dacă elevul a rezolvat corect unii pași
- Dacă elevul a folosit o metodă diferită dar corect matematică, acordă punctele integrale
- Nu penaliza greșelile de notație sau ortografie, ci doar greșelile matematice
- Dacă imaginea este goală sau complet ilizibilă, returnează 0 puncte
- Distribui punctajul maxim al exercițiului între pașii identificați
- Acordă NUMAI puncte întregi (1, 2, 3... nu 0.5 sau 1.5) — puncte_acordate și puncte_maxime sunt întotdeauna numere întregi
- În câmpul "descriere" al fiecărui pas, folosește notație LaTeX cu delimitatori $...$ pentru orice expresie matematică (ex: $27^{\frac{2}{3}}$, $\sqrt{x}$, $\frac{a}{b}$)
- Răspunde STRICT cu un obiect JSON valid, fără text suplimentar, fără markdown`;

function extractBarem(solution, totalPoints) {
  if (!solution) return null;

  // Try explicit **Pasul N.** markers
  const stepRx = /\*\*Pasul\s+\d+[.:]\*\*\s*([\s\S]*?)(?=\*\*Pasul\s+\d+[.:]\*\*|$)/g;
  const steps = [];
  let m;
  while ((m = stepRx.exec(solution)) !== null) {
    const text = m[1].replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
    if (text) steps.push(text);
  }

  // Fallback: split on double newlines (each paragraph = one step)
  if (steps.length === 0) {
    solution.split(/\n\n+/).forEach(p => {
      const text = p.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
      if (text) steps.push(text);
    });
  }

  if (steps.length === 0) return null;

  const base = Math.floor(totalPoints / steps.length);
  const extra = totalPoints - base * steps.length;
  return steps.map((descriere, i) => ({
    descriere,
    puncte_maxime: base + (i === steps.length - 1 ? extra : 0)
  }));
}

async function verifyItem(item) {
  const { canvasBase64, enunt, solutieOficiala, puncteMaxime, label, barem: baremFixed } = item;

  if (!canvasBase64) {
    return {
      label,
      pasi: [{ descriere: 'Exercițiu nerezolvat', puncte_acordate: 0, puncte_maxime: puncteMaxime, corect: false }],
      total_acordat: 0,
      total_maxim: puncteMaxime,
      observatii: 'Elevul nu a scris nimic pentru acest exercițiu.'
    };
  }

  const barem = baremFixed || extractBarem(solutieOficiala, puncteMaxime);

  let prompt;
  if (barem && barem.length > 0) {
    const baremJson = JSON.stringify(barem, null, 2);
    prompt = `${SYSTEM_PROMPT}

EXERCIȚIU — ${label}:
${enunt}

BAREM OFICIAL FIX (folosește EXACT acești pași și aceste puncte maxime, nu inventa alții):
${baremJson}

Analizează imaginea atașată și verifică dacă elevul a efectuat fiecare pas din barem.
Returnează EXCLUSIV un obiect JSON (fără alt text):

{
  "pasi": [
    { "descriere": "<copiază exact descrierea din barem>", "puncte_acordate": 0, "puncte_maxime": 0, "corect": false }
  ],
  "total_acordat": 0,
  "total_maxim": ${puncteMaxime},
  "observatii": "feedback scurt pentru elev în română"
}

Reguli stricte:
- pasi[] trebuie să conțină EXACT aceiași pași ca în barem (același număr, aceeași ordine, aceeași descriere)
- puncte_maxime din fiecare pas = exact valoarea din barem
- suma punctelor_acordate = total_acordat
- corect: true doar dacă pasul e complet corect
- TOATE punctele sunt numere întregi`;
  } else {
    prompt = `${SYSTEM_PROMPT}

EXERCIȚIU — ${label} (${puncteMaxime} puncte total):
${enunt}

SOLUȚIE OFICIALĂ:
${solutieOficiala}

Analizează imaginea atașată cu rezolvarea elevului.
Returnează EXCLUSIV un obiect JSON (fără alt text):

{
  "pasi": [
    { "descriere": "descriere scurtă pas", "puncte_acordate": 0, "puncte_maxime": 0, "corect": false }
  ],
  "total_acordat": 0,
  "total_maxim": ${puncteMaxime},
  "observatii": "feedback util pentru elev în română"
}

Reguli:
- suma punctelor_maxime din pasi = exact ${puncteMaxime}
- suma punctelor_acordate = total_acordat
- corect: true doar dacă pasul e complet corect
- TOATE punctele sunt numere întregi`;
  }

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: 'image/png', data: canvasBase64 } }
  ]);

  const raw     = result.response.text().trim();
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed  = JSON.parse(jsonStr);
  parsed.label  = label;
  parsed.total_maxim   = puncteMaxime;
  parsed.total_acordat = Math.min(Math.max(Math.round(parsed.total_acordat || 0), 0), puncteMaxime);

  if (Array.isArray(parsed.pasi)) {
    parsed.pasi = parsed.pasi.map(p => ({
      ...p,
      puncte_acordate: Math.round(p.puncte_acordate || 0),
      puncte_maxime:   Math.round(p.puncte_maxime   || 0),
    }));
  }

  return parsed;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const items = req.body;
    if (!Array.isArray(items)) throw new Error('Payload must be an array');

    const results = await Promise.all(
      items.map(item =>
        verifyItem(item).catch(err => ({
          label:         item.label || '?',
          pasi:          [],
          total_acordat: 0,
          total_maxim:   item.puncteMaxime || 0,
          observatii:    `Eroare la evaluarea AI: ${err.message}`,
          error:         true
        }))
      )
    );

    res.status(200).json(results);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
