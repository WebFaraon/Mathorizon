'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateContentWithRetry } = require('./_gemini-retry');

// Google retired the entire Gemini 2.x generation from generateContent (404
// "no longer available"). We initially replaced it with gemini-3-flash-preview,
// but "-preview" models carry noticeably more restrictive rate limits than
// stable releases and started throwing transient 503 "high demand" errors as
// usage grew — gemini-3.5-flash is the stable/GA successor in the same tier
// (confirmed image/vision input support), so it's used instead. If this
// starts 404ing later, check https://ai.google.dev/gemini-api/docs/models
// for the current stable model list.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model  = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  generationConfig: { temperature: 0 }
});

// Gemini is told to return ONLY a JSON object, but occasionally wraps it in
// stray prose despite that instruction. A hard JSON.parse() failure used to
// take down the whole item — falling into the generic catch in the handler
// below, which zeroed its score with no useful explanation ever reaching the
// student (the observatii text wasn't even rendered client-side; see bac.js).
// Falling back to the outermost {...} block recovers the common case instead
// of discarding a real evaluation over a stray sentence before/after it.
function extractJson(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  const candidate = (start !== -1 && end > start) ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(candidate);
  } catch (e) {
    // Gemini's JSON often contains raw LaTeX backslashes (\log, \sqrt, \left,
    // \frac, \boxed, \notin, \right, \tan, \underline...) that it forgot to
    // double per JSON string-escaping rules (a literal "\" must be written
    // "\\") — this is the "Bad escaped character in JSON" failure, which used
    // to zero the whole exercise on a pure formatting slip. Same fix already
    // applied in api/admin/generate-exercise.js. \b \f \n \r \t \u are
    // technically valid single-char JSON escapes too, but in this
    // LaTeX-transcription context a backslash followed by one of those
    // letters is essentially always the start of a LaTeX command (\boxed,
    // \frac, \notin, \right, \tan, \underline), not a real control character
    // — so only "\" "/ and a genuine \uXXXX are treated as already-valid;
    // everything else gets doubled.
    const repaired = candidate.replace(/\\(?!["\\/]|u[0-9a-fA-F]{4})/g, '\\\\');
    return JSON.parse(repaired);
  }
}

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

// Extra grading reminders per exercise type — these matter regardless of
// whether the item has a transcribed barem, since they cover things the
// solution text often doesn't spell out step-by-step (domain conditions,
// extraneous-root checks, notation conventions) but a real BAC corrector
// would still check against the official barem.
const SUBCAT_HINTS = {
  'ec-log':          'Verifică explicit condițiile de existență ale logaritmilor (argumentul > 0, baza > 0 și baza ≠ 1) — dacă acesta e un pas/criteriu distinct și elevul nu l-a scris, nu acorda punctajul acelui pas chiar dacă rezultatul final e corect.',
  'inec-log':        'Verifică condițiile de existență ale logaritmilor (argument > 0, bază > 0 și ≠ 1) și dacă sensul inegalității a fost păstrat/inversat corect în funcție de bază (subunitară vs. supraunitară).',
  'ec-irationale':   'Verifică condiția de existență a radicalilor de ordin par (radicandul ≥ 0) și dacă elevul a verificat/eliminat soluțiile străine prin substituție — dacă acesta e un pas distinct în barem, o soluție corectă „din întâmplare" fără verificare scrisă nu primește acel punctaj.',
  'ec-exp':          'Verifică dacă baza este corect gestionată (bază > 0, bază ≠ 1) și dacă schimbarea de variabilă (notație auxiliară), atunci când e folosită, e corect efectuată și revenită la final.',
  'inec-rationale':  'Verifică domeniul de definiție (numitorii ≠ 0) și corectitudinea tabelului de semn / intervalelor soluție rezultate.',
  'complexe':        'Verifică forma cerută (algebrică/trigonometrică), calculul corect al modulului și argumentului, și operațiile cu numere complexe (conjugat, împărțire, ridicare la putere).',
  'polinoame':       'Verifică schema lui Horner sau împărțirea polinomială și identificarea corectă a rădăcinilor, inclusiv multiplicitatea lor.',
  'trigonometrie':   'Verifică dacă soluțiile generale sunt scrise cu forma corectă (+2kπ sau +kπ, k∈ℤ, după caz) și dacă intervalul cerut de enunț e respectat la selectarea soluțiilor particulare.',
  'geo-plana':       'Verifică aplicarea corectă a formulelor de arie/perimetru și a teoremelor (Pitagora, sinusurilor, cosinusurilor) — nu penaliza lipsa desenului dacă rezolvarea scrisă e completă și corectă.',
  'geo-analitica':   'Verifică formulele de distanță, pantă, ecuația dreptei/cercului și corectitudinea coordonatelor/coeficienților folosiți.',
  'geo-spatiu':      'Verifică formulele de volum/arie pentru corpuri geometrice și unitățile de măsură folosite.',
  'siruri':          'Verifică identificarea corectă a formulei termenului general și, dacă se cere, corectitudinea demonstrației prin inducție.',
  'progresii':       'Verifică formula termenului general și a sumei (progresie aritmetică sau geometrică, după caz) și calculul corect al rației/diferenței.',
  'derivate':        'Verifică regulile de derivare aplicate corect (produs, cât, compunere) și dacă rezultatul e adus la o formă simplificată.',
  'limite':          'Verifică dacă nedeterminările sunt corect identificate și ridicate (factor comun, limite remarcabile, regula lui l\'Hôpital dacă e cazul).',
  'integrale':       'Verifică metoda de integrare aplicată corect (părți, schimbare de variabilă) și evaluarea corectă la capete pentru integrale definite.',
  'probabilitate':   'Verifică dacă formula de probabilitate/combinatorică aleasă e cea corectă (combinări vs. aranjamente vs. permutări) și dacă numărul de cazuri favorabile/posibile e corect calculat.',
  'combinari':       'Verifică aplicarea corectă a binomului lui Newton (termenul general, coeficienți binomiali) și identificarea corectă a termenului/coeficientului cerut de enunț.',
  'calcul-algebric': 'Verifică proprietățile puterilor/radicalilor/logaritmilor aplicate corect și dacă expresia a fost simplificată complet, nu doar parțial.'
};

// Shared conventions from real BAC Moldova baremuri that the base rule list
// (numbered 1..N above the call site) doesn't otherwise capture — appended
// on top of whatever criteria the barem itself lists, fixed or heuristic.
// startNum continues the numbering from whichever prompt calls this (the
// fixed-criteria prompt has 7 base rules, the fallback path has 8).
function extraConventions(startNum) {
  const n = startNum;
  return `
${n}. CONDIȚII DE EXISTENȚĂ / DOMENIU: dacă rezolvarea necesită condiții de existență (argument logaritm > 0, bază > 0 și ≠ 1, radical de ordin par ≥ 0, numitor ≠ 0) și un pas/criteriu din barem le vizează, verifică dacă elevul le-a scris explicit — dacă lipsesc complet, acel pas NU e îndeplinit, chiar dacă rezultatul final e corect.
${n + 1}. VERIFICAREA SOLUȚIILOR: la ecuații unde barem-ul cere verificarea soluțiilor (eliminarea soluțiilor străine, de regulă la ecuații iraționale), acest pas trebuie să apară scris explicit — o soluție corectă „din întâmplare" fără verificare scrisă nu primește acel punctaj dacă e un criteriu separat.
${n + 2}. FORME ECHIVALENTE: acceptă orice formă matematic echivalentă a unui rezultat (ex: 1/2 = 0,5 = 2/4; forme factorizate/dezvoltate echivalente) — nu penaliza formatul de scriere dacă valoarea e corectă, DECÂT dacă enunțul cere explicit o formă anume (formă simplificată, interval, mulțime de soluții).
${n + 3}. NOTAȚIE: verifică corectitudinea notației cerute de tipul răspunsului (paranteze rotunde vs. pătrate pentru intervale, ∈/∉/∪/∩, mulțimea vidă ∅) — o notație greșită care schimbă sensul matematic (ex: interval închis în loc de deschis) invalidează criteriul chiar dacă valorile numerice sunt corecte.
${n + 4}. PROPAGAREA ERORII: dacă elevul greșește un calcul la un pas dar la pasul următor aplică CORECT metoda/formula pe propriul rezultat greșit (fără o nouă greșeală de metodă), acordă punctajul pasului următor DOAR dacă acel criteriu testează corectitudinea metodei/procedeului — dacă criteriul cere explicit valoarea numerică finală corectă, nu acorda punctajul.`;
}

async function verifyItem(item) {
  const {
    canvasBase64, enunt, solutieOficiala,
    puncteMaxime, label, barem: baremFixed, baremEstimat,
    raspunsCorect, subcategoryId, mimeType
  } = item;
  const imageMimeType = mimeType || 'image/png';

  const subcatHint = SUBCAT_HINTS[subcategoryId] || '';
  const subcatBlock = subcatHint ? `\nATENȚIE SPECIFICĂ PENTRU ACEST TIP DE EXERCIȚIU: ${subcatHint}\n` : '';

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

  // NOTE: there is no separate "answer box" UI anywhere in the exam — the
  // canvas drawing is the only place a student ever writes anything. An
  // earlier version of this block referenced a "răspuns scris în casetă"
  // that the client never actually populated (js/bac.js always sent an
  // empty string for it), so this instruction was unconditionally telling
  // Gemini the box was empty on every single graded exercise, risking a
  // wrongful zero on the final-answer criterion regardless of what was
  // correctly drawn on canvas. Ground truth for cross-checking now comes
  // purely from what's visible in the image, consistent with rules 1 and 3.
  const finalAnswerBlock = raspunsCorect
    ? `\nRĂSPUNSUL FINAL CORECT AL EXERCIȚIULUI ESTE: ${raspunsCorect}
Verifică ÎN IMAGINE dacă elevul a ajuns la acest rezultat (sau o formă echivalentă). Dacă rezultatul final scris de elev pe canvas NU coincide cu cel corect, criteriul care cere explicit răspunsul final este GREȘIT și primește 0 puncte — dar dacă elevul a scris corect rezultatul (chiar dacă nu într-o casetă separată), criteriul e îndeplinit.`
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
7. Dacă elevul combină mai multe criterii într-un singur calcul, dar rezultatul intermediar corect pentru fiecare e vizibil implicit în ce a scris, marchează toate criteriile acoperite ca îndeplinite — nu penaliza doar pentru că nu a scris pe rânduri separate.${extraConventions(8)}
${subcatBlock}${finalAnswerBlock}

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

    const result = await generateContentWithRetry(model, [
      { text: prompt },
      { inlineData: { mimeType: imageMimeType, data: canvasBase64 } }
    ]);

    const raw     = result.response.text().trim();
    const parsed  = extractJson(raw);
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
8. REGULĂ OFICIALĂ BAC: dacă în item nu este indicată metoda de rezolvare, orice altă metodă de rezolvare CORECTĂ din punct de vedere matematic se acceptă și se punctează corespunzător criteriului echivalent — chiar dacă elevul a folosit o identitate/proprietate diferită de cea din soluția de referință. NU penaliza o metodă alternativă doar pentru că nu se potrivește cu pașii soluției oficiale.${extraConventions(9)}
${subcatBlock}${finalAnswerBlock}

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

  const result = await generateContentWithRetry(model, [
    { text: prompt },
    { inlineData: { mimeType: imageMimeType, data: canvasBase64 } }
  ]);

  const raw     = result.response.text().trim();
  const parsed  = extractJson(raw);
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
