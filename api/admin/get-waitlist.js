'use strict';
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tfflpivehrrzmklvcyhe.supabase.co';

/* Admin-only read of the waitlist table — public/anon has zero access to
   it (see the migration), so this is the only way to see the rows short
   of the Supabase dashboard directly. Verifies the caller's own session
   token belongs to a user with role='admin' before using the service-role
   key to actually read the data. */
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET')     { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const authHeader = (req.headers && req.headers['authorization']) || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) { res.status(401).json({ error: 'Neautorizat.' }); return; }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) { res.status(500).json({ error: 'Nu este configurat pe server.' }); return; }
    const admin = createClient(SUPABASE_URL, serviceKey);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData || !userData.user) {
      res.status(401).json({ error: 'Sesiune invalidă.' });
      return;
    }

    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .single();
    if (profileError || !profile || profile.role !== 'admin') {
      res.status(403).json({ error: 'Acces interzis.' });
      return;
    }

    const { data, error } = await admin
      .from('waitlist')
      .select('email, clasa, sursa, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) { res.status(500).json({ error: error.message }); return; }

    res.status(200).json({ rows: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
