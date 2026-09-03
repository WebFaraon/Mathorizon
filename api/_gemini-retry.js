'use strict';

/* Every Gemini call in this app goes out on ONE shared API key, so all the
   failure modes below are about that key's quota/capacity rather than about
   anything the caller did wrong:

   • 503 UNAVAILABLE "high demand" — transient global capacity spike on the
     model, shared across all callers. A short backoff clears it.
   • 429 RESOURCE_EXHAUSTED — the key's own quota. On the FREE tier that is a
     handful of requests per minute AND only ~20 requests per DAY per model,
     which is very easy to hit in a single admin session. The API returns a
     RetryInfo.retryDelay telling us exactly how long to wait — respect it
     instead of guessing, and give up straight away when that wait is longer
     than the time budget we have left (a per-day quota never clears in time).
   • no response at all — the request simply hangs. Neither this SDK nor
     Node's fetch sets a usable deadline: undici only gives up after ~300s and
     then throws an opaque "fetch failed", by which point the hosting gateway
     has long since returned 504 to the browser and the user has been staring
     at a spinner for five minutes. So every attempt now gets an explicit
     timeout, and the retry loop as a whole gets a total budget — previously a
     3-retry chain of ~150s calls could run for ~8 minutes before failing.

   Errors thrown from here carry `.code` (a stable machine tag) and `.status`
   (the HTTP status the API route should answer with), plus a Romanian
   `.message` that is safe to show the user as-is. */

// These are sized so the whole retry chain finishes inside a typical hosting
// function limit, which is what actually decides whether the browser gets our
// error or the platform's 504 HTML page. Tune them to the host if needed:
//
//   GEMINI_TIMEOUT_MS  one attempt's deadline. Keep it comfortably under the
//                      function's maxDuration (e.g. 50000 on a 60s limit) so
//                      our own message wins the race against the gateway.
//   GEMINI_BUDGET_MS   ceiling for the whole call, retries and waits included.
//   GEMINI_RETRIES     extra attempts after the first (default 1).
//
// For reference, a successful call currently lands anywhere between ~10s and
// ~60s depending on how loaded the API key's tier is.
const ATTEMPT_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 90000;
const TOTAL_BUDGET_MS    = Number(process.env.GEMINI_BUDGET_MS)  || 200000;
const DEFAULT_RETRIES    = Number.isFinite(Number(process.env.GEMINI_RETRIES))
  ? Number(process.env.GEMINI_RETRIES)
  : 1;

const MESSAGES = {
  quota:      'Cota Gemini a fost depășită pentru cheia API curentă. Încearcă din nou peste un minut.',
  quotaDaily: 'Cota ZILNICĂ Gemini a fost epuizată pentru cheia API curentă (planul gratuit permite ~20 de cereri pe zi per model). Activează facturarea pe proiectul Google AI Studio al cheii, sau reia mâine.',
  overloaded: 'Serverele Gemini sunt momentan supraîncărcate (503). Încearcă din nou peste un minut.',
  timeout:    'Gemini nu a răspuns în timp util. Încearcă din nou — dacă se repetă, fotografia e probabil prea mare sau cheia API e limitată de planul gratuit.',
  server:     'Gemini a returnat o eroare de server. Încearcă din nou peste câteva momente.',
  auth:       'Cheia GEMINI_API_KEY lipsește sau este invalidă pe server.',
};

const STATUS = { quota: 429, quotaDaily: 429, overloaded: 503, timeout: 504, server: 502, auth: 500 };

// A 429 can mean two very different things, and the difference decides whether
// waiting is worth anything at all:
//   • a per-minute rate limit — clears on its own; waiting the delay the API
//     asks for turns the failure into a success.
//   • a per-DAY quota (20 requests/day/model on the free tier) — will not
//     clear for hours, so waiting only burns the request's time budget before
//     failing anyway.
// The violated quota's own id says which: "…PerDay…" vs "…PerMinute…".
const MAX_QUOTA_WAIT_MS = 30000;

function isDailyQuota(err) {
  for (const d of (err && err.errorDetails) || []) {
    for (const v of (d && d.violations) || []) {
      if (/PerDay/i.test(String((v && v.quotaId) || ''))) return true;
    }
  }
  return /PerDay/i.test(String((err && err.message) || ''));
}

function classify(err) {
  const status = err && err.status;
  const msg    = String((err && err.message) || '');

  if (status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg)) return 'quota';
  if (status === 503 || /\b503\b|UNAVAILABLE|high demand|overloaded/i.test(msg))     return 'overloaded';
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(msg)) return 'auth';
  if (status === 500 || status === 502 || status === 504)                            return 'server';
  // Timeouts reach us as the SDK's own abort error, or — when the abort came
  // from undici's ~300s ceiling rather than from ours — as a bare
  // "fetch failed"/socket error with no status at all.
  if ((err && err.name === 'GoogleGenerativeAIAbortError') ||
      /aborted|abort|timed? ?out|ETIMEDOUT|ECONNRESET|EPIPE|socket hang up|fetch failed|terminated/i.test(msg)) return 'timeout';
  return 'fatal';
}

// The API states the exact wait in RetryInfo (e.g. retryDelay: "54s"). The SDK
// surfaces the parsed details on GoogleGenerativeAIFetchError.errorDetails,
// but falls back to only the raw message on older shapes — so read both.
function serverRetryDelayMs(err) {
  const details = (err && err.errorDetails) || [];
  for (const d of details) {
    const raw = d && d.retryDelay;
    const m = typeof raw === 'string' && /^([\d.]+)s$/.exec(raw);
    if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  }
  const m = /"retryDelay"\s*:\s*"([\d.]+)s"|Please retry in ([\d.]+)s/i.exec(String((err && err.message) || ''));
  if (m) return Math.ceil(parseFloat(m[1] || m[2]) * 1000);
  return null;
}

function friendly(err, kind) {
  if (kind === 'fatal') return err;
  const e = new Error(MESSAGES[kind]);
  e.code   = kind;
  e.status = STATUS[kind];
  e.cause  = err;
  return e;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * generateContent with a hard per-attempt deadline, a total time budget and
 * quota/capacity-aware retries.
 *
 * @param {object} model  a GenerativeModel from getGenerativeModel()
 * @param {Array}  parts  the request parts ([{text}, {inlineData}, ...])
 */
async function generateContentWithRetry(model, parts, opts = {}) {
  const {
    retries          = DEFAULT_RETRIES,
    baseDelayMs      = 1000,
    attemptTimeoutMs = ATTEMPT_TIMEOUT_MS,
    budgetMs         = TOTAL_BUDGET_MS,
  } = opts;

  const deadline = Date.now() + budgetMs;
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const left = deadline - Date.now();
    if (left <= 0) break;

    try {
      return await model.generateContent(parts, { timeout: Math.min(attemptTimeoutMs, left) });
    } catch (e) {
      lastErr = e;
      let kind = classify(e);
      if (kind === 'quota' && isDailyQuota(e)) kind = 'quotaDaily';

      // A daily quota can't be waited out inside one request, so say so now
      // instead of stalling first and failing anyway.
      if (kind === 'fatal' || kind === 'auth' || kind === 'quotaDaily' || attempt === retries) {
        throw friendly(e, kind);
      }

      // A rate limit clears on its own, and the API states exactly when — but
      // only wait if that fits in this request's remaining budget (and inside
      // a serverless function's own lifetime).
      const wait = kind === 'quota'
        ? (serverRetryDelayMs(e) || baseDelayMs * Math.pow(2, attempt))
        : baseDelayMs * Math.pow(2, attempt);
      if (wait > MAX_QUOTA_WAIT_MS || Date.now() + wait >= deadline) throw friendly(e, kind);

      await sleep(wait);
    }
  }

  throw friendly(lastErr || new Error('timeout'), lastErr ? classify(lastErr) : 'timeout');
}

module.exports = {
  generateContentWithRetry,
  // exported for the API routes, so a quota/timeout failure answers with a
  // real 429/504 instead of the blanket 400 they used to return
  geminiErrorStatus: e => (e && e.status) || null,
};
