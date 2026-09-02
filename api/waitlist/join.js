'use strict';
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tfflpivehrrzmklvcyhe.supabase.co';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_MAX = 5;          // max submissions from the same IP...
const RATE_LIMIT_WINDOW_MIN = 60;  // ...within this many minutes

function getClientIp(req) {
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || null;
}

/* Public landing-page waitlist signup. Writes with the service-role key
   (same reason as api/auth/register-username.js: this is an operation the
   client can't be trusted to do itself — anti-spam checks need to happen
   server-side, and public/anon has zero access to the waitlist table by
   design, see the migration). */
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { email, clasa, sursa, website } = req.body || {};

    // Honeypot — real visitors never see this field. A filled-in value
    // means an automated form-filler touched it; pretend success so it
    // doesn't learn to skip the field next time.
    if (website) { res.status(200).json({ ok: true }); return; }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanClasa = String(clasa || '').trim();
    const cleanSursa = String(sursa || 'landing').trim().slice(0, 40) || 'landing';

    if (!EMAIL_RE.test(cleanEmail)) {
      res.status(400).json({ error: 'Adresă de email invalidă.' });
      return;
    }
    if (!cleanClasa) {
      res.status(400).json({ error: 'Lipsește clasa țintă.' });
      return;
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      res.status(500).json({ error: 'Waitlist-ul nu este configurat pe server.' });
      return;
    }
    const admin = createClient(SUPABASE_URL, serviceKey);
    const ip = getClientIp(req);

    // Rate limit by IP — a real IP is available in production behind the
    // host's proxy (x-forwarded-for); locally, with none, this is null
    // and the check fails open rather than blocking every local request.
    if (ip) {
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60000).toISOString();
      const { count, error: countError } = await admin
        .from('waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', since);
      if (!countError && count !== null && count >= RATE_LIMIT_MAX) {
        res.status(429).json({ error: 'Prea multe încercări. Încearcă mai târziu.' });
        return;
      }
    }

    // ignoreDuplicates — email+clasa is unique; a repeat submission from
    // the same person (e.g. after clearing localStorage) is a silent
    // success, not an error, and never overwrites the original ip/timestamp.
    const { error } = await admin
      .from('waitlist')
      .upsert(
        { email: cleanEmail, clasa: cleanClasa, sursa: cleanSursa, ip },
        { onConflict: 'email,clasa', ignoreDuplicates: true }
      );

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
