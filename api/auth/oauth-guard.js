'use strict';
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tfflpivehrrzmklvcyhe.supabase.co';
const NEW_WINDOW_MS = 2 * 60 * 1000;           // an account made by the sign-in that just happened is at most this old

/* Google sign-in cannot tell "I have an account" from "make me one": Supabase creates the account the first time a Google
   identity shows up. The sign-in page has two tabs that mean two different things (Conectare: an account that exists,
   Înregistrare: a new one), so the page asks this route, right after Google brings the person back, whether what happened
   matches the tab they pressed the Google key in.

   decide() is the whole rule, kept pure so it can be tested (scripts/check-oauth-guard.js):
     - the account is NEW when it was made seconds ago by this very sign-in: it has no profile yet (the site makes the profile on
       the first page after signing up) and it only has a Google identity, so a person who had an account and just linked Google
       is never mistaken for a new one;
     - intent "login" and the account is new  -> "no-account": the account this sign-in just created is deleted (nothing else is
       ever deleted), the person is told to use Înregistrare;
     - intent "signup" and the account is not new -> "exists": nothing is deleted, the page signs the person out and sends them to Conectare;
     - anything else -> "ok". */
function decide({ user, hasProfile, intent, now }) {
  const providers = ((user && user.identities) || []).map(i => i.provider);
  if (!providers.includes('google')) return { status: 'ok' };                       // not a Google account: nothing to guard
  const created = Date.parse(user.created_at);
  const isNew = !hasProfile && providers.every(p => p === 'google') && Number.isFinite(created) && (now - created) < NEW_WINDOW_MS;
  if (intent === 'login' && isNew) return { status: 'no-account', remove: true };
  if (intent === 'signup' && !isNew) return { status: 'exists' };
  return { status: 'ok' };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const intent = req.body && (req.body.intent === 'signup' || req.body.intent === 'login') ? req.body.intent : null;
    if (!token || !intent) { res.status(400).json({ error: 'Cerere incompletă.' }); return; }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) { res.status(500).json({ error: 'Serviciul nu este configurat pe server.' }); return; }
    const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // who is asking: the token must be a real session; the answer is only ever about that person
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data || !data.user) { res.status(401).json({ error: 'Sesiune invalidă.' }); return; }
    const user = data.user;

    const { data: prof } = await admin.from('user_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
    const out = decide({ user, hasProfile: !!prof, intent, now: Date.now() });

    if (out.remove) {
      const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
      if (delErr) { res.status(500).json({ error: 'Nu am putut anula contul nou: ' + delErr.message }); return; }
    }
    res.status(200).json({ status: out.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = handler;
module.exports.decide = decide;
