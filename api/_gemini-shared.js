'use strict';

/* Helpers shared by every route that sends a photo to Gemini and reads a JSON
   object back (admin/generate-exercise, class/generate-simulation-exercise,
   training/generate-mcq-options, verify-exam). Each used to carry its own
   slightly-different copy of this logic — the copies drifted, and the weakest
   one decided how a given route failed. */

/* ── Reading Gemini's JSON ────────────────────────────────────────────────
   Four failure modes, handled in order:

   1. ```json fences — the model wraps the object in markdown despite being
      told not to.
   2. stray prose before/after the object — recovered by taking the outermost
      {...} span. Only api/verify-exam.js used to do this; elsewhere a single
      stray sentence around an otherwise perfect answer threw away the whole
      analysis.
   3. un-escaped LaTeX backslashes that make JSON.parse throw — Gemini writes
      \sqrt, \left, \cdot, \angle… inside JSON strings and forgets that a
      literal backslash must be written "\\". The classic "Bad escaped
      character in JSON" failure. Doubling the offending backslashes fixes it.
   4. un-escaped LaTeX backslashes that make JSON.parse SUCCEED — and quietly
      destroy the formula. This one was invisible until now. \b \f \n \r \t
      are valid single-character JSON escapes, so an un-escaped "\boxed{4}"
      parses cleanly into BACKSPACE + "oxed{4}", and "\frac" into FORMFEED +
      "rac" — no exception, no repair attempt, just a barem whose LaTeX has
      silently lost its command name and renders as garbage. \frac and \boxed
      are the two most common commands in this whole corpus, so this is the
      damaging case, and the old parser (in all three of its copies) only ever
      ran its repair from the catch branch, which this path never reaches.

      Detection is by consequence rather than by guesswork: a successful parse
      whose output contains a raw BACKSPACE, FORMFEED, TAB or CR can only have
      come from a mangled command (\boxed \bar \binom, \frac \forall, \times
      \text \theta \to, \right \rightarrow) — none of those four characters has
      any legitimate place in KaTeX barem text. A raw NEWLINE is left alone
      because it genuinely occurs (the admin page appends "\n\n$$\boxed{…}$$"
      to the last step itself), which is also why the repair below never
      doubles a "\n". */
// Written as char codes rather than a regex character class so the values
// stay legible (and cannot be mangled by an editor that normalises whitespace).
const MANGLED_ESCAPE_CODES = [0x08, 0x09, 0x0c, 0x0d]; // BACKSPACE, TAB, FORMFEED, CR

// Doubles the backslashes Gemini forgot to double, stepping OVER the escape
// pairs it got right. It has to consume "\x" as a unit rather than testing a
// lookahead: with a lookahead, the second backslash of a correct "\\sqrt" is
// itself "a backslash not followed by a valid escape char", so it gets doubled
// too and turns valid input into "\\\sqrt", which then won't parse at all.
// That is why a reply mixing one mangled command with one correct one used to
// come out corrupted — the repair threw, and the mangled first parse was kept.
//
// keepNewlineEscape leaves "\n" alone so a real line break survives (the admin
// page appends "\n\n$$\boxed{…}$$" to the last barem step itself); it is only
// dropped as a last resort, when nothing else will parse.
function repairLatexBackslashes(s, keepNewlineEscape = true) {
  const alreadyValid = keepNewlineEscape
    ? /^(?:u[0-9a-fA-F]{4}|["\\/n])$/
    : /^(?:u[0-9a-fA-F]{4}|["\\/])$/;
  return s.replace(/\\(u[0-9a-fA-F]{4}|[\s\S]|$)/g, (match, tail) =>
    alreadyValid.test(tail) ? match : '\\\\' + tail);
}

function containsMangled(value) {
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i++) {
      if (MANGLED_ESCAPE_CODES.indexOf(value.charCodeAt(i)) !== -1) return true;
    }
    return false;
  }
  if (Array.isArray(value)) return value.some(containsMangled);
  if (value && typeof value === 'object') return Object.values(value).some(containsMangled);
  return false;
}

function extractJson(raw) {
  const cleaned = String(raw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  const candidate = (start !== -1 && end > start) ? cleaned.slice(start, end + 1) : cleaned;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    // Case 3: repair is the only way to get anything at all. Fall back to
    // doubling "\n" too if the conservative repair still won't parse.
    try {
      return JSON.parse(repairLatexBackslashes(candidate));
    } catch {
      return JSON.parse(repairLatexBackslashes(candidate, false));
    }
  }

  // Case 4: it parsed, but into mojibake. Prefer the repaired reading; keep
  // the original if the repair can't parse (then the control character came
  // from somewhere else and is not ours to second-guess).
  if (containsMangled(parsed)) {
    try {
      const repaired = JSON.parse(repairLatexBackslashes(candidate));
      if (!containsMangled(repaired)) return repaired;
    } catch { /* keep the original parse */ }
  }
  return parsed;
}

/* ── Image MIME type ──────────────────────────────────────────────────────
   Gemini accepts only these five as inline image data and rejects the entire
   request otherwise. What the browser reports as file.type can be '' (an
   extension the OS doesn't recognise), 'image/jpg' (not a real MIME type) or
   something Gemini has never heard of — all of which used to be forwarded
   verbatim, or blanket-relabelled 'image/jpeg' even for a PNG. */
const SUPPORTED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

function normalizeImageMime(mimeType, fallback = 'image/jpeg') {
  const m = String(mimeType || '').toLowerCase().split(';')[0].trim();
  if (m === 'image/jpg') return 'image/jpeg';
  return SUPPORTED_IMAGE_MIME.includes(m) ? m : fallback;
}

module.exports = { extractJson, normalizeImageMime, SUPPORTED_IMAGE_MIME };
