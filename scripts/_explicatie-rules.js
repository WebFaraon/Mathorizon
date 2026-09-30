/* ============================================================
   Regulile de FORMĂ pentru câmpul `explicatie` al pașilor de barem
   (js/data.js). Sursă unică de adevăr, folosită în trei locuri:
     - scripts/generate-barem-explicatii.js  -> RULES_PROMPT intră în prompt,
       iar lintStatic() respinge (și retrimite) un răspuns care le încalcă
     - scripts/lint-barem-explicatii.js      -> rulează lintStatic() pe tot ce
       există deja în data.js
     - docs/barem-explicatii.md              -> versiunea pentru oameni

   De ce sunt stricte: o explicație se citește pe orice ecran, de la 320px la
   1920px, iar KaTeX nu rupe formulele display pe rânduri. Un paragraf plin de
   formule în rând sau un lanț lung de egalități pe un singur rând iese din
   container pe telefon. Lățimea efectivă se verifică separat, în browser
   (scripts/_explicatie-browser-lint.js); aici sunt regulile de conținut care
   se pot verifica din text.
   ============================================================ */
'use strict';

const LIMITS = {
  maxProse: 240,        // caractere de text în afara formulelor, per explicație
  maxInline: 5,         // formule $...$ per explicație
  maxInlineChars: 18,   // caractere în interiorul unui $...$
  maxDisplay: 4,        // formule $$...$$ per explicație
  maxRows: 4,           // rânduri într-un \begin{aligned}
  maxRowLhs: 8,         // caractere înaintea lui & într-un rând aligned
  maxEqualsPerRow: 2,   // semne "=" pe un singur rând
  maxTextInMath: 12,    // caractere în \text{...}
  maxLeftDepth: 1       // \left...\right imbricate
};

// Nu se scrie NICIODATĂ în rând ($...$): sunt înalte sau late, deci taie
// linia de text sau ies din coloană.
const BANNED_INLINE = /\\(frac|dfrac|tfrac|int|sum|prod|lim|begin|left|right|boxed)(?![a-zA-Z])/;

const ALLOWED_ROW_START = /^(=|\\Rightarrow|\\Leftrightarrow|\\implies|\\iff)/;

/* Textul care intră în prompt. String.raw, ca backslash-urile LaTeX să
   rămână întregi (într-un template literal obișnuit \t sau \f ar dispărea). */
const RULES_PROMPT = String.raw`REGULI STRICTE DE FORMĂ. Fiecare e verificată automat, iar un răspuns care o încalcă este respins și ți se cere să îl refaci.

STRUCTURĂ
1. Explicația e o succesiune de blocuri scurte: o propoziție, apoi formula ei pe rând separat ($$...$$). Fără paragrafe lungi.
2. Proza (tot ce nu e formulă) are cel mult ${LIMITS.maxProse} de caractere pe explicație. Cel mult ${LIMITS.maxDisplay} formule $$...$$.
3. Nu reformula criteriul. Prima propoziție spune ce facem concret: "Notăm...", "Aplicăm...", "Înlocuim...".

FORMULE ÎN RÂND ($...$)
4. Doar simboluri și egalități scurte: cel mult ${LIMITS.maxInlineChars} de caractere în interiorul unui $...$ și cel mult ${LIMITS.maxInline} astfel de formule pe explicație.
5. Niciodată în rând: \frac, \int, \sum, \prod, \lim, \left, \right, \begin, \boxed. Orice formulă care conține așa ceva se scrie ca $$...$$ pe rând separat.
6. Dacă introduci două sau mai multe relații deodată (de exemplu t = ..., x = ..., dx = ...), nu le înșira în propoziție: pune-le într-un bloc aligned (regula 8).

FORMULE PE RÂND ($$...$$)
7. O formulă pe un singur rând are cel mult ${LIMITS.maxEqualsPerRow} semne "=". Trei sau mai multe egalități se scriu obligatoriu pe mai multe rânduri, cu \begin{aligned}. Într-un aligned se numără doar egalitățile de DUPĂ & (membrul stâng e o ipoteză, nu o verigă din lanț): "x = 3 &\Rightarrow t = \sqrt{4} = 2" e în regulă, are două.
8. \begin{aligned}: cel mult ${LIMITS.maxRows} rânduri și EXACT un & pe fiecare rând. Există două forme permise, nu le amesteca:
   (a) Lanț de calcul cu expresia de plecare lungă. Primul rând conține doar expresia, cu & în față; fiecare rând următor începe cu &= :
   $$\begin{aligned} &2\left[G(3)-G(2)\right] \\ &= 2\left(6-\tfrac{2}{3}\right) \\ &= \tfrac{32}{3} \end{aligned}$$
   (b) Definiții paralele sau lanț cu membrul stâng scurt (cel mult ${LIMITS.maxRowLhs} caractere înaintea lui &). Rândurile care continuă lanțul încep cu &= :
   $$\begin{aligned} t &= \sqrt{x+1} \\ x &= t^2 - 1 \\ dx &= 2t\,dt \end{aligned}$$
   Nu pune niciodată un membru stâng lung înaintea lui & și nu folosi \\ în afara unui aligned.
9. Fără \boxed. Fără \text{...} mai lung de ${LIMITS.maxTextInMath} caractere: cuvintele explicative se scriu în propoziție, nu în formulă, pentru că textul din formule nu se rupe pe rânduri.
10. Paranteze: \left...\right doar când conținutul are fracții sau radicali înalți, și niciodată unul în interiorul altuia. Altfel folosește ( ) și [ ] simple. O fracție numerică mică în interiorul unei expresii se scrie \tfrac.
11. LĂȚIME. Pe telefon o formulă are în jur de 280 de pixeli, adică 30-35 de caractere de formulă pe rând. Ce nu încape se sparge conform regulii 8. Nu lăsa niciodată o formulă lungă pe un singur rând.

LIMBĂ ȘI FORMAT
12. Română cu diacritice, persoana I plural ("integrăm", "notăm", "obținem"). Fără liniuță lungă, fără **bold**, fără liste cu bulină.
13. Fiecare valoare numerică trebuie să rezulte din REZOLVAREA dată. Nu inventa nimic.

EXEMPLE DE EXPLICAȚII CORECTE (alt exercițiu, doar ca formă):

Pas "Calculul discriminantului" la ecuația x^2 - 5x + 6 = 0:
"Identificăm coeficienții $a = 1$, $b = -5$, $c = 6$ și calculăm discriminantul:\n$$\begin{aligned} \Delta &= b^2 - 4ac \\ &= 25 - 24 \\ &= 1 \end{aligned}$$"

Pas "Substituția" la o integrală cu $2x+1$ sub radical:
"Notăm $u = 2x + 1$ și exprimăm restul:\n$$\begin{aligned} u &= 2x + 1 \\ x &= \frac{u-1}{2} \\ dx &= \tfrac{1}{2}\,du \end{aligned}$$\nLimitele devin $u = 1$ și $u = 7$."`;

/* Regulile de CONȚINUT. Nu se pot verifica automat (cer înțelegere
   matematică), deci le citește un om înainte de --apply. Sunt separate de cele
   de formă pentru că cele de formă împing spre scurt, iar fără astea un model
   care vrea să încapă în limite renunță la exact ce îl ajută pe elev: a fost
   observat la an-int-002, unde prima variantă în regulile de formă a pierdut
   simplificarea integrandului, noile limite și calculul lui G(3). */
const CONTENT_PROMPT = String.raw`REGULI DE CONȚINUT. Nu le verifică un program, le verifică un om, dar contează la fel de mult ca cele de formă.

C1. Calcul concret, nu reformulare a criteriului. Dacă criteriul zice "Determinarea unei primitive", arată ce formulă se aplică și scrie primitiva.
C2. AUTONOMIE. Elevul citește doar enunțul și explicația acestui pas. Orice expresie care apare într-o formulă și nu e în enunț (integrandul simplificat, o valoare precum G(3), noile limite) trebuie să-și arate originea în aceeași explicație.
C3. Nu sări nicio operație. O valoare se arată calculată, nu doar folosită: nu "G(3) = 6", ci "G(3) = 3^3/3 - 3 = 6". Noile limite după o substituție se derivă explicit: "pentru x = 3 avem t = 2". Nici operațiile cu fracții nu se sar (aducerea la același numitor, produsul): 6 - 2/3 = 16/3 se scrie, nu se presupune.
C4. Dacă pasul se sprijină pe o transformare pe care criteriul oficial o presupune dar nu o scrie (de exemplu simplificarea integrandului înainte de substituție), include-o la începutul explicației. E chiar locul unde elevul se rătăcește.
C5. Explică doar ce ține de pas: nu anticipa pașii următori și nu relua pașii anteriori (în afara transformărilor de la C4).
C6. Nu comprima ca să încapi. Ai loc de ${LIMITS.maxDisplay} blocuri: folosește-le. Dar nu repeta același calcul pe rânduri consecutive: fiecare rând trebuie să aducă un pas nou.`;

/* ---------------------------------------------------------------- */

function splitSegments(text) {
  const display = [];
  const inline = [];
  const noDisplay = String(text || '').replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => { display.push(m); return ' '; });
  const prose = noDisplay.replace(/\$([^$\n]+?)\$/g, (_, m) => { inline.push(m); return ' '; });
  return { display, inline, prose: prose.replace(/\s+/g, ' ').trim(), leftover: prose };
}

function maxLeftDepth(tex) {
  let depth = 0, max = 0;
  const re = /\\(left|right)(?![a-zA-Z])/g;
  let m;
  while ((m = re.exec(tex))) {
    if (m[1] === 'left') { depth++; if (depth > max) max = depth; }
    else depth--;
  }
  return max;
}

function equalsCount(tex) {
  return (tex.match(/=/g) || []).length;
}

function lintDisplay(tex, idx, out) {
  const tag = `formula $$ nr. ${idx + 1}`;
  const compact = tex.replace(/\s+/g, '');

  if (/\\boxed/.test(tex)) out.push(`${tag}: contine \\boxed (regula 9)`);

  for (const m of tex.matchAll(/\\text\{([^}]*)\}/g)) {
    if (m[1].length > LIMITS.maxTextInMath) {
      out.push(`${tag}: \\text{${m[1].slice(0, 20)}...} are ${m[1].length} caractere, maximum ${LIMITS.maxTextInMath}; cuvintele merg in propozitie (regula 9)`);
    }
  }

  if (maxLeftDepth(tex) > LIMITS.maxLeftDepth) {
    out.push(`${tag}: \\left...\\right imbricate; foloseste ( ) sau [ ] simple in interior (regula 10)`);
  }

  const env = tex.match(/\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}/);
  const outside = env ? tex.replace(env[0], ' ') : tex;
  if (/\\\\/.test(outside)) {
    out.push(`${tag}: are \\\\ in afara unui \\begin{aligned} (regula 8)`);
  }

  if (!env) {
    if (equalsCount(tex) > LIMITS.maxEqualsPerRow) {
      out.push(`${tag}: ${equalsCount(tex)} semne "=" pe un singur rand, maximum ${LIMITS.maxEqualsPerRow}; foloseste \\begin{aligned} (regula 7)`);
    }
    return;
  }

  const rows = env[1].split(/\\\\(?:\[[^\]]*\])?/).map(r => r.trim()).filter(r => r.length);
  if (rows.length > LIMITS.maxRows) {
    out.push(`${tag}: aligned are ${rows.length} randuri, maximum ${LIMITS.maxRows} (regula 8)`);
  }

  rows.forEach((row, r) => {
    const rowTag = `${tag}, randul ${r + 1}`;
    const amps = (row.match(/(?<!\\)&/g) || []).length;
    if (amps !== 1) {
      out.push(`${rowTag}: are ${amps} caractere &, trebuie exact 1 (regula 8)`);
      return;
    }
    const [lhsRaw, rhsRaw] = row.split(/(?<!\\)&/);
    const lhs = lhsRaw.replace(/\s+/g, '');
    const rhs = rhsRaw.trim();
    if (lhs.length > LIMITS.maxRowLhs) {
      out.push(`${rowTag}: membrul stang dinaintea lui & are ${lhs.length} caractere ("${lhs.slice(0, 16)}..."), maximum ${LIMITS.maxRowLhs}; pentru o expresie lunga foloseste forma (a): & la inceputul randului (regula 8)`);
    }
    if (lhs.length === 0 && r > 0 && !ALLOWED_ROW_START.test(rhs)) {
      out.push(`${rowTag}: un rand fara membru stang trebuie sa inceapa cu &= (regula 8)`);
    }
    // Se numara doar ce e DUPA &: membrul stang ("x = 3" in "x = 3 &\Rightarrow
    // t = \sqrt{4} = 2") e o ipoteza, nu o veriga din lant.
    if (equalsCount(rhs) > LIMITS.maxEqualsPerRow) {
      out.push(`${rowTag}: ${equalsCount(rhs)} semne "=" dupa &, maximum ${LIMITS.maxEqualsPerRow}; desparte randul in doua: primul pastreaza cel mult ${LIMITS.maxEqualsPerRow} egalitati, al doilea incepe cu &= sau &\\Rightarrow si continua lantul (regula 7)`);
    }
  });
}

/* Verifică o explicație. Întoarce lista de încălcări (goală = în regulă). */
function lintStatic(text) {
  const out = [];
  const t = String(text || '');
  if (!t.trim()) return ['explicatie goala'];

  if (t.includes('—')) out.push('contine liniuta lunga (regula 12)');
  if (/\*\*/.test(t)) out.push('contine **bold** (regula 12)');
  // BM.trustedNl2br nu escapeaza HTML: un "$a<b$" ajunge in innerHTML si
  // browserul citeste "<b" ca inceput de tag, inghitind restul formulei.
  if (/<[a-zA-Z\/!]/.test(t)) out.push('contine "<" urmat direct de litera (browserul il citeste ca tag HTML); scrie \\lt sau pune spatii in jurul lui < (regula 12)');
  if (/^\s*[-*•]\s/m.test(t)) out.push('contine lista cu bulina (regula 12)');

  const seg = splitSegments(t);
  if (seg.leftover.includes('$')) out.push('delimitatori $ neperechi (un $ ramas in afara formulelor)');

  if (seg.prose.length > LIMITS.maxProse) {
    out.push(`proza are ${seg.prose.length} caractere, maximum ${LIMITS.maxProse}; sparge in blocuri propozitie + formula (regulile 1-2)`);
  }
  if (seg.display.length > LIMITS.maxDisplay) {
    out.push(`${seg.display.length} formule $$ pe explicatie, maximum ${LIMITS.maxDisplay} (regula 2)`);
  }
  if (seg.inline.length > LIMITS.maxInline) {
    out.push(`${seg.inline.length} formule in rand ($...$), maximum ${LIMITS.maxInline}; grupeaza-le intr-un bloc aligned (regulile 4 si 6)`);
  }
  seg.inline.forEach(f => {
    if (BANNED_INLINE.test(f)) {
      out.push(`formula in rand $${f.slice(0, 24)}$ contine \\frac/\\int/\\sum/\\lim/\\left/\\begin; scrie-o ca $$...$$ pe rand separat (regula 5)`);
    } else if (f.trim().length > LIMITS.maxInlineChars) {
      out.push(`formula in rand $${f.slice(0, 24)}...$ are ${f.trim().length} caractere, maximum ${LIMITS.maxInlineChars}; scrie-o ca $$...$$ (regula 4)`);
    }
  });

  seg.display.forEach((d, i) => lintDisplay(d, i, out));
  return out;
}

module.exports = { LIMITS, RULES_PROMPT, CONTENT_PROMPT, lintStatic, splitSegments };
