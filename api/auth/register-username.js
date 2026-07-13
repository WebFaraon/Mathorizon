'use strict';
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tfflpivehrrzmklvcyhe.supabase.co';
const USERNAME_DOMAIN = 'mathorizon.local';

/* Creates an auth account for students without a real email address, using a
   pseudo-email (username@mathorizon.local) so Supabase's email/password auth
   still works. Requires the service-role key (admin API) so we can mark the
   account confirmed immediately — a real confirmation email could never be
   delivered to that fake domain. */
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { username, password, full_name, role } = req.body || {};
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanName      = String(full_name || '').trim();

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      res.status(400).json({ error: 'Numele de utilizator trebuie să aibă 3-20 caractere: litere mici, cifre sau „_”.' });
      return;
    }
    if (!cleanName) {
      res.status(400).json({ error: 'Numele complet este obligatoriu.' });
      return;
    }
    if (!password || String(password).length < 8) {
      res.status(400).json({ error: 'Parola trebuie să aibă cel puțin 8 caractere.' });
      return;
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      res.status(500).json({ error: 'Înregistrarea cu nume de utilizator nu este configurată pe server.' });
      return;
    }

    const safeRole = role === 'profesor' ? 'profesor' : 'elev';
    const pseudoEmail = `${cleanUsername}@${USERNAME_DOMAIN}`;
    const admin = createClient(SUPABASE_URL, serviceKey);

    const { error } = await admin.auth.admin.createUser({
      email: pseudoEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        role: safeRole,
        username: cleanUsername,
        is_username_account: true
      }
    });

    if (error) {
      const isDuplicate = /already.*registered|already been registered/i.test(error.message || '');
      res.status(400).json({ error: isDuplicate ? 'Acest nume de utilizator este deja folosit.' : error.message });
      return;
    }

    res.status(200).json({ ok: true, email: pseudoEmail });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
