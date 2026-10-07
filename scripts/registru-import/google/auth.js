/* Google service-account login without any library: a signed JWT exchanged for an access token.
   The key file stays outside git (_import/google-service-account.json, or the path in GOOGLE_SA_FILE). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_FILE = process.env.GOOGLE_SA_FILE || path.join(__dirname, '..', '..', '..', '_import', 'google-service-account.json');
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const OAUTH_CLIENT = path.join(__dirname, '..', '..', '..', '_import', 'google-oauth-client.json');
const OAUTH_TOKEN = path.join(__dirname, '..', '..', '..', '_import', 'google-oauth-token.json');
let cached = null, cachedUser = null;

/* the Drive owner, through the refresh token saved by login.js: used to CREATE files (they are owned by him, on his storage) */
async function userToken() {
  if (cachedUser && cachedUser.exp > Date.now() + 60000) return cachedUser.value;
  const c = JSON.parse(fs.readFileSync(OAUTH_CLIENT, 'utf8')).installed, t = JSON.parse(fs.readFileSync(OAUTH_TOKEN, 'utf8'));
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }) });
  const j = await res.json();
  if (!j.access_token) throw new Error('Login utilizator eșuat (rulează login.js din nou): ' + JSON.stringify(j));
  cachedUser = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cachedUser.value;
}

async function token(scopes) {
  const scope = (scopes || ['https://www.googleapis.com/auth/drive']).join(' ');
  if (cached && cached.scope === scope && cached.exp > Date.now() + 60000) return cached.value;
  const key = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: key.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = b64u(crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(key.private_key));
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + body + '.' + sig }) });
  const j = await res.json();
  if (!j.access_token) throw new Error('Login Google eșuat: ' + JSON.stringify(j));
  cached = { scope, value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.value;
}

async function api(method, url, opts) {
  opts = opts || {};
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method, headers: Object.assign({ authorization: 'Bearer ' + (opts.who === 'user' ? await userToken() : await token(opts.scopes)) }, opts.body ? { 'content-type': 'application/json' } : {}), body: opts.body ? JSON.stringify(opts.body) : undefined });
    if ((res.status === 429 || res.status >= 500) && attempt < 6) { await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt))); continue; }   // Google's per-minute limits: wait and retry
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
    if (!res.ok) throw new Error(`${method} ${url.split('?')[0]} -> ${res.status} ${JSON.stringify(data.error || data).slice(0, 300)}`);
    return data;
  }
}

module.exports = { token, userToken, api, KEY_FILE, OAUTH_CLIENT, OAUTH_TOKEN };
