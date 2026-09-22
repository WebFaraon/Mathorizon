/* ============================================================
   Scanare pe text brut a lui js/data.js: găsește spanul exact [ ... ] al
   câmpului `barem` pentru fiecare exercițiu, conștient de string-uri și
   comentarii (LaTeX-ul din data.js e plin de acolade și ghilimele, deci un
   simplu număr de acolade nu ajunge).

   Extras din scripts/regenerate-baremuri.js ca să fie folosit și de
   scripts/generate-barem-explicatii.js, în loc să fie duplicat.
   ============================================================ */
'use strict';

function findMatchingBracket(text, openIndex) {
  const open = text[openIndex];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) throw new Error('not a bracket at ' + openIndex);
  let depth = 0, i = openIndex;
  while (i < text.length) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') { const nl = text.indexOf('\n', i); i = nl === -1 ? text.length : nl + 1; continue; }
    if (c === '/' && text[i + 1] === '*') { const end = text.indexOf('*/', i + 2); i = end === -1 ? text.length : end + 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c; i++;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === open) { depth++; i++; continue; }
    if (c === close) { depth--; i++; if (depth === 0) return i - 1; continue; }
    i++;
  }
  throw new Error('no matching bracket from ' + openIndex);
}

function buildBaremSpanMap(text) {
  const arrKey = 'BM.EXERCISES = [';
  const arrOpen = text.indexOf(arrKey) + arrKey.length - 1;
  const arrClose = findMatchingBracket(text, arrOpen);
  const map = {};
  let i = arrOpen + 1;
  const skipTrivia = (j) => {
    while (j < arrClose) {
      if (/\s/.test(text[j])) { j++; continue; }
      if (text[j] === '/' && text[j + 1] === '/') { const nl = text.indexOf('\n', j); j = nl === -1 ? arrClose : nl + 1; continue; }
      if (text[j] === '/' && text[j + 1] === '*') { const end = text.indexOf('*/', j + 2); j = end === -1 ? arrClose : end + 2; continue; }
      if (text[j] === ',') { j++; continue; }
      break;
    }
    return j;
  };
  i = skipTrivia(i);
  while (i < arrClose) {
    if (text[i] !== '{') throw new Error('expected { at ' + i + ', got ' + JSON.stringify(text.slice(i, i + 20)));
    const objStart = i;
    const objEnd = findMatchingBracket(text, objStart);
    const objText = text.slice(objStart, objEnd + 1);
    const idMatch = /id:\s*'([^']+)'/.exec(objText);
    const baremKeyMatch = /barem:\s*\[/.exec(objText);
    if (idMatch && baremKeyMatch) {
      const baremOpenAbs = objStart + baremKeyMatch.index + baremKeyMatch[0].length - 1;
      const baremCloseAbs = findMatchingBracket(text, baremOpenAbs);
      const baremKeywordAbs = objStart + baremKeyMatch.index;
      map[idMatch[1]] = { start: baremOpenAbs, end: baremCloseAbs, keywordStart: baremKeywordAbs };
    }
    i = skipTrivia(objEnd + 1);
  }
  return map;
}

function lineIndent(text, atIndex) {
  const nl = text.lastIndexOf('\n', atIndex);
  return /^[ \t]*/.exec(text.slice(nl + 1, atIndex))[0];
}

module.exports = { findMatchingBracket, buildBaremSpanMap, lineIndent };
