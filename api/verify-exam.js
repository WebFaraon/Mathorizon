'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model  = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: { temperature: 0 }
});

function extractBarem(solution, totalPoints) {
  if (!solution) return null;

  const stepRx = /\*\*Pasul\s+\d+[.:]\*\*\s*([\s\S]*?)(?=\*\*Pasul\s+\d+[.:]\*\*|$)/g;
  const steps = [];
  let m;
  while ((m = stepRx.exec(solution)) !== null) {
    const text = m[1].replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
    if (text) steps.push(text);
  }

  if (steps.length === 0) {
    solution.split(/\n\n+/).forEach(p => {
      const text = p.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
      if (text) steps.push(text);
    });
  }

  if (steps.length === 0) return null;

  const base  = Math.floor(totalPoints / steps.length);
  const extra = totalPoints - base * steps.length;
  return steps.map((text, i) => ({
    descriere:     text,
    puncte_maxime: base + (i === steps.length - 1 ? extra : 0)
  }));
}

// A hand-transcribed barem's point split reflects one specific exercise slot
// (e.g. an official 8p item). The same exercise can be drawn into a slot worth
// a different total (e.g. 5p — see SLOTS pools in bac.js, where a 'mediu'
// exercițiu de complexe/polinoame can land in a 5p or 8p exercise). Rescale
// the fixed barem proportionally so it always sums to this run's actual total,
// preserving the original weighting between steps.
function scaleBarem(barem, totalPoints) {
  const sum = barem.reduce((s, b) => s + (b.puncte_maxime || 0), 0);
  if (sum <= 0 || sum === totalPoints) return barem;

  const scaled = barem.map(b => Math.max(0, Math.round(b.puncte_maxime / sum * totalPoints)));
  let diff = totalPoints - scaled.reduce((s, v) => s + v, 0);
  while (diff !== 0) {
    let idx = 0;
    for (let i = 1; i < scaled.length; i++) if (scaled[i] > scaled[idx]) idx = i;
    scaled[idx] = Math.max(0, scaled[idx] + Math.sign(diff));
    diff -= Math.sign(diff);
  }
  return barem.map((b, i) => ({ ...b, puncte_maxime: scaled[i] }));
}

async function verifyItem(item) {
  const {
    canvasBase64, enunt, solutieOficiala,
    puncteMaxime, label, barem: baremFixed, baremEstimat,
    raspunsCorect, raspunsElev
  } = item;

  if (!canvasBase64) {
    return {
      label,
      pasi: [{ descriere: 'Exercițiu nerezolvat', puncte_acordate: 0, puncte_maxime: puncteMaxime, corect: false }],
      total_acordat: 0,
      total_maxim: puncteMaxime,
      observatii: 'Elevul nu a scris nimic pentru acest exercițiu.'
    };
  }

  // Fixed baremes are transcribed against one specific point total and must be
  // rescaled if this exercise landed in a slot worth a different total; baremes
  // extracted fresh from the solution are already computed against puncteMaxime.
  const barem = baremFixed
    ? scaleBarem(baremFixed, puncteMaxime)
    : extractBarem(solutieOficiala, puncteMaxime);
  const nrPasi = barem ? barem.length : null;

  const finalAnswerBlock = raspunsCorect
    ? `\nRĂSPUNS FINAL CORECT: ${raspunsCorect}
RĂSPUNS SCRIS DE ELEV (în casetă): ${raspunsElev || '(necompletat)'}
IMPORTANT: Dacă răspunsul final al elevului NU coincide cu cel corect, ultimul pas (calculul final) este GREȘIT și primește 0 puncte.`
    : '';

  const baremHasCriteria = barem && barem.every(b => b.descriere);
  // Only treat it as the untouched hand-transcribed barem when it wasn't
  // rescaled and isn't a heuristic split (baremEstimat: true) — those step
  // boundaries aren't verified against a real BAC document, so the "official"
  // label wouldn't be honest to apply (the grading itself is equally strict
  // either way — see the shared "indeplinit" instruction below).
  const isVerifiedOfficial = baremFixed && barem === baremFixed && !baremEstimat;
  const baremLabel = isVerifiedOfficial ? 'BAREMUL OFICIAL' : 'CRITERIILE DE EVALUARE';

  if (baremHasCriteria) {
    // Fixed-criteria path: the criterion text and point values always come
    // from our own barem (data.js, or deterministically derived from the
    // static solution text) — never from Gemini. Gemini only judges, per
    // criterion, whether the student demonstrated it; it never writes or
    // rewrites the criterion wording, so the displayed barem is identical
    // for every student instead of being re-described each time.
    const prompt = `Ești un corector strict de examene BAC Moldova. Evaluezi EXCLUSIV ceea ce este SCRIS ÎN IMAGINE.

REGULI CRITICE — CITEȘTE CU ATENȚIE:
1. Citește cu atenție FIECARE calcul din imagine. Verifică dacă rezultatele numerice sunt corecte.
2. Dacă elevul scrie o egalitate greșită (ex: $\\log_2 4 = 3$ în loc de $\\log_2 4 = 2$), criteriul respectiv NU e îndeplinit.
3. NU marca un criteriu ca îndeplinit pentru ceva ce NU poți vedea clar în imagine.
4. NU presupune că elevul a rezolvat corect — verifică fiecare calcul matematic din imagine.
5. Acordă NUMAI puncte întregi — fiecare criteriu e ori complet îndeplinit (punctajul lui maxim), ori 0. NU acorda punctaj parțial în interiorul unui criteriu.
6. REGULĂ OFICIALĂ BAC: dacă în item nu este indicată metoda de rezolvare, orice altă metodă de rezolvare CORECTĂ din punct de vedere matematic se acceptă — chiar dacă elevul a folosit o identitate/proprietate diferită de cea din soluția de referință (ex: $\\frac{1}{\\log_a b} = \\log_b a$ în loc de a calcula $\\log_a b$ direct și a-l inversa). Marchează criteriul ca îndeplinit dacă elevul a ajuns, printr-o metodă validă, la rezultatul cerut de acel criteriu — nu trebuie să copieze exact pașii soluției de referință.
7. Dacă elevul combină mai multe criterii într-un singur calcul, dar rezultatul intermediar corect pentru fiecare e vizibil implicit în ce a scris, marchează toate criteriile acoperite ca îndeplinite — nu penaliza doar pentru că nu a scris pe rânduri separate.
${finalAnswerBlock}

EXERCIȚIU — ${label} (${puncteMaxime} puncte total):
${enunt}

SOLUȚIE OFICIALĂ (o metodă de referință — NU singura metodă acceptată, vezi regula 6):
${solutieOficiala}

${baremLabel} ARE EXACT ${nrPasi} ITEMI DE PUNCTAJ:
${barem.map((b, i) => `${i + 1}. (${b.puncte_maxime}p) ${b.descriere}`).join('\n')}

Returnează EXCLUSIV un obiect JSON valid (fără alt text, fără markdown), cu EXACT ${nrPasi} elemente în "verificari" — câte unul pentru fiecare item de mai sus, ÎN ACEEAȘI ORDINE, fără să incluzi textul criteriului:
{
  "verificari": [
    { "indeplinit": false }
  ],
  "observatii": "feedback concret pentru elev în română, menționând greșelile specifice — folosește notație LaTeX cu $...$"
}`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: 'image/png', data: canvasBase64 } }
    ]);

    const raw     = result.response.text().trim();
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed  = JSON.parse(jsonStr);
    const verificari = Array.isArray(parsed.verificari) ? parsed.verificari : [];

    // The displayed criteria always come from our fixed `barem` array —
    // Gemini's response only supplies the per-index pass/fail verdict.
    const pasi = barem.map((b, i) => {
      const met = !!(verificari[i] && verificari[i].indeplinit);
      return {
        descriere:       b.descriere,
        puncte_maxime:   b.puncte_maxime,
        puncte_acordate: met ? b.puncte_maxime : 0,
        corect:          met
      };
    });

    return {
      label,
      pasi,
      total_acordat: pasi.reduce((s, p) => s + p.puncte_acordate, 0),
      total_maxim:   puncteMaxime,
      observatii:    parsed.observatii || ''
    };
  }

  // Fallback path — no fixed criteria to anchor to (empty/missing solution
  // text), so Gemini identifies its own logical steps and point split.
  const baremBlock = nrPasi
    ? `\nEVALUAREA ARE EXACT ${nrPasi} PAȘI cu punctaje: ${barem.map((b, i) => `pasul ${i+1} = ${b.puncte_maxime}p`).join(', ')}.
Identifică în imagine EXACT ${nrPasi} pași și evaluează fiecare.`
    : `\nÎmparte punctajul de ${puncteMaxime}p între pașii logici pe care îi identifici în imagine.`;

  const prompt = `Ești un corector strict de examene BAC Moldova. Evaluezi EXCLUSIV ceea ce este SCRIS ÎN IMAGINE.

REGULI CRITICE — CITEȘTE CU ATENȚIE:
1. Citește cu atenție FIECARE calcul din imagine. Verifică dacă rezultatele numerice sunt corecte.
2. Dacă elevul scrie o egalitate greșită (ex: $\\log_2 4 = 3$ în loc de $\\log_2 4 = 2$), acel pas este GREȘIT — 0 puncte.
3. NU acorda puncte pentru pași pe care NU îi poți vedea clar în imagine.
4. NU presupune că elevul a rezolvat corect — verifică fiecare calcul matematic din imagine.
5. Dacă imaginea conține erori matematice, marchează pașii respectivi ca greșiți.
6. Acordă NUMAI puncte întregi (0, 1, 2, 3...) — NICIODATĂ zecimale.
7. Folosește notație LaTeX cu $...$ în câmpul "descriere".
8. REGULĂ OFICIALĂ BAC: dacă în item nu este indicată metoda de rezolvare, orice altă metodă de rezolvare CORECTĂ din punct de vedere matematic se acceptă și se punctează corespunzător criteriului echivalent — chiar dacă elevul a folosit o identitate/proprietate diferită de cea din soluția de referință. NU penaliza o metodă alternativă doar pentru că nu se potrivește cu pașii soluției oficiale.
${finalAnswerBlock}

EXERCIȚIU — ${label} (${puncteMaxime} puncte total):
${enunt}

SOLUȚIE OFICIALĂ (o metodă de referință — NU singura metodă acceptată, vezi regula 8):
${solutieOficiala}
${baremBlock}

Returnează EXCLUSIV un obiect JSON valid (fără alt text, fără markdown):
{
  "pasi": [
    { "descriere": "ce a scris elevul la acest pas (LaTeX)", "puncte_acordate": 0, "puncte_maxime": 0, "corect": false }
  ],
  "total_acordat": 0,
  "total_maxim": ${puncteMaxime},
  "observatii": "feedback concret pentru elev în română, menționând greșelile specifice"
}

Reguli JSON:
- suma punctelor_maxime din pasi = exact ${puncteMaxime}
- total_acordat = suma punctelor_acordate din pasi
- corect: true NUMAI dacă pasul e 100% corect matematic`;

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
