'use strict';

// Gemini's newer/"-preview" models occasionally return a transient 503
// "currently experiencing high demand" under global capacity spikes — this is
// shared server-side load across ALL callers of that model, unrelated to this
// app's own request volume. A short retry with backoff resolves it in
// practice; only a persistent outage should still surface as an error.
async function generateContentWithRetry(model, parts, { retries = 3, baseDelayMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await model.generateContent(parts);
    } catch (e) {
      lastErr = e;
      const is503 = e?.status === 503 || /503|UNAVAILABLE|high demand/i.test(e?.message || '');
      if (!is503 || attempt === retries) throw e;
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

module.exports = { generateContentWithRetry };
