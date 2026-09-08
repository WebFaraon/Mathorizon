'use strict';
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tfflpivehrrzmklvcyhe.supabase.co';

/* Public "business card" header for a teacher — lets class.html show
   students the avatar/name of whoever teaches them, and a read-only
   "Vezi profilul" view (name, badges, rating, location, bio) opened from
   the class header. Deliberately NOT the full profile.html view: no
   password section, no individual review comments, no edit controls —
   just the header a teacher already treats as their public business card.

   auth.users metadata for a user other than yourself isn't reachable via
   RLS from the browser (Supabase Auth locks that down regardless of table
   policies), so this goes through the service-role admin API instead of a
   direct client query. Email and phone are deliberately left out of the
   response — a teacher filled those in for their OWN profile page's
   contact row, not to have them broadcast to every student in every one
   of their classes. */
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { accessToken, teacherId } = req.body || {};
    if (!accessToken) { res.status(401).json({ error: 'Neautorizat.' }); return; }
    if (!teacherId)   { res.status(400).json({ error: 'Lipsește teacherId.' }); return; }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) { res.status(500).json({ error: 'Nu este configurat pe server.' }); return; }
    const admin = createClient(SUPABASE_URL, serviceKey);

    const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken);
    if (callerError || !callerData || !callerData.user) {
      res.status(401).json({ error: 'Sesiune invalidă.' });
      return;
    }

    // Only ever serves profesor accounts — never lets this become a general
    // "look up any user by id" endpoint (e.g. another student's data).
    const { data: targetProfile, error: profileError } = await admin
      .from('user_profiles').select('role, status').eq('user_id', teacherId).single();
    if (profileError || !targetProfile || targetProfile.role !== 'profesor') {
      res.status(404).json({ error: 'Profesor negăsit.' });
      return;
    }

    const { data: targetUserData, error: targetError } = await admin.auth.admin.getUserById(teacherId);
    if (targetError || !targetUserData || !targetUserData.user) {
      res.status(404).json({ error: 'Profesor negăsit.' });
      return;
    }

    const meta = targetUserData.user.user_metadata || {};
    res.status(200).json({
      name:       meta.full_name || meta.name || 'Profesor',
      avatar_url: meta.custom_avatar_url || meta.avatar_url || null,
      cover_url:  meta.custom_cover_url || null,
      bio:        meta.bio || '',
      country:    meta.country || '',
      social_url: meta.social_url || '',
      created_at: targetUserData.user.created_at,
      status:     targetProfile.status
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
