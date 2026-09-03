#!/usr/bin/env node
/* ============================================================
   Reports what plan the GEMINI_API_KEY in .env is actually being
   served under, and whether it can generate right now.

   Why this exists: "I put credit on my Gemini account" and "this API key
   is on the paid tier" are two different facts, and only the second one
   changes anything. Credit lives on a Cloud BILLING ACCOUNT; the paid tier
   is enabled per PROJECT; and an API key belongs to exactly one project. A
   key created in project A stays on the free tier forever no matter how much
   credit sits on a billing account linked to project B.

   The free tier is not just a spending cap — it is ~20 generateContent calls
   per day per model and low-priority serving, which is what makes the same
   photo take 8s once and 250s the next time.

   Google does not expose the project id through the key itself, so this
   script reports the one thing it can prove from the API — which quota
   bucket the calls are counted against — and then points at the two pages
   where the rest is visible.

   Usage:  node scripts/check-gemini-key.js
           node scripts/check-gemini-key.js --generate   (spends 1 daily call)
   ============================================================ */
'use strict';
require('dotenv').config();

const KEY  = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const SPEND = process.argv.includes('--generate');

function mask(k) {
  return k.length > 14 ? `${k.slice(0, 10)}…${k.slice(-4)}` : '(prea scurtă)';
}

// Reads the quota bucket out of a 429. The metric name is the authoritative
// free-vs-paid signal: generate_content_free_tier_requests vs …paid_tier….
function readQuota(err) {
  const out = { metric: null, quotaId: null, limit: null, perDay: false };
  const m = /Quota exceeded for metric:\s*(\S+?),/.exec(err.message || '');
  if (m) out.metric = m[1];
  for (const d of err.details || []) {
    for (const v of d.violations || []) {
      out.quotaId = v.quotaId || out.quotaId;
      out.limit   = v.quotaValue || out.limit;
      if (/PerDay/i.test(v.quotaId || '')) out.perDay = true;
    }
  }
  return out;
}

(async () => {
  console.log('');
  if (!KEY) {
    console.log('  GEMINI_API_KEY lipsește din .env — nimic de verificat.');
    process.exitCode = 1;
    return;
  }
  console.log(`  cheie  : ${mask(KEY)}   (${KEY.length} caractere)`);
  console.log(`  model  : ${MODEL}`);
  console.log('');

  // 1. Is the key even valid? countTokens is billed against a separate,
  //    generous quota, so this costs nothing from the daily generate budget.
  let res = await fetch(`${BASE}/models/${MODEL}:countTokens?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.log(`  ✗ cheia NU e validă pentru ${MODEL} (HTTP ${res.status})`);
    console.log(`    ${(body.error && body.error.message) || ''}`);
    process.exitCode = 1;
    return;
  }
  console.log('  ✓ cheia e validă și modelul există');

  if (!SPEND) {
    console.log('');
    console.log('  Pentru a afla planul e nevoie de o generare reală.');
    console.log('  Rulează cu --generate (consumă 1 cerere din cota zilnică).');
    console.log('');
    process.exitCode = 0;
    return;
  }

  // 2. One real generateContent. Either it works (key can generate right now)
  //    or the 429 tells us exactly which quota bucket we are in.
  const t0 = Date.now();
  res = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Spune doar: ok' }] }],
      generationConfig: { maxOutputTokens: 8 }
    })
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const body = await res.json().catch(() => ({}));

  if (res.ok) {
    console.log(`  ✓ generateContent a mers (${secs}s)`);
    console.log('');
    console.log('  Cota zilnică nu e epuizată ACUM — dar asta singur nu dovedește');
    console.log('  că e tier plătit. Confirmă planul în AI Studio (link mai jos):');
    console.log('  pe free tier limita e ~20 de generări pe zi per model.');
    printWhereToLook();
    process.exitCode = 0;
    return;
  }

  if (res.status === 429) {
    const q = readQuota(body.error || {});
    const free = /free_tier/i.test(q.metric || '') || /FreeTier/i.test(q.quotaId || '');
    console.log(`  ✗ 429 RESOURCE_EXHAUSTED (${secs}s)`);
    if (q.metric)  console.log(`    metric : ${q.metric}`);
    if (q.quotaId) console.log(`    quotaId: ${q.quotaId}`);
    if (q.limit)   console.log(`    limită : ${q.limit}${q.perDay ? ' pe ZI' : ''}`);
    console.log('');
    console.log(free
      ? '  >>> Cheia e servită pe FREE TIER. Creditul de pe contul de facturare\n      nu se aplică proiectului acestei chei.'
      : '  >>> Cheia e pe tier plătit, dar a atins o limită de rată. Reîncearcă.');
    printWhereToLook();
    process.exitCode = free ? 2 : 0;
    return;
  }

  console.log(`  ✗ HTTP ${res.status} (${secs}s)`);
  console.log(`    ${(body.error && body.error.message) || ''}`);
  process.exitCode = 1;
  return;
})();

function printWhereToLook() {
  console.log('');
  console.log('  Unde verifici:');
  console.log('   1. https://aistudio.google.com/apikey');
  console.log('      Găsește cheia de mai sus în listă. Coloana "Plan" spune');
  console.log('      Free sau Paid, iar coloana "Project" spune CĂRUI proiect');
  console.log('      îi aparține. Ăsta e proiectul care trebuie să aibă facturare.');
  console.log('   2. https://console.cloud.google.com/billing');
  console.log('      Contul cu credit → "Account management" → lista proiectelor');
  console.log('      legate. Proiectul de la pasul 1 TREBUIE să apară acolo.');
  console.log('');
  console.log('  Dacă nu apare: fie leagă proiectul la contul de facturare, fie');
  console.log('  generează o cheie nouă în proiectul care are deja facturare și');
  console.log('  înlocuiește GEMINI_API_KEY (în .env ȘI în variabilele de mediu');
  console.log('  ale hostingului — deploy-ul nu citește .env).');
  console.log('');
}
