/* One-time login as the Drive owner (for creating the demo registers: a service account has no storage of its own).
     node scripts/registru-import/google/login.js
   Opens Google's consent page, catches the answer on localhost, saves the refresh token in _import/ (outside git). */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const { OAUTH_CLIENT, OAUTH_TOKEN } = require('./auth');

const SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'];
const client = JSON.parse(fs.readFileSync(OAUTH_CLIENT, 'utf8')).installed;
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname !== '/') { res.writeHead(404).end(); return; }
  const code = u.searchParams.get('code');
  if (!code) { res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Lipsește codul: ' + (u.searchParams.get('error') || '')); return; }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: client.client_id, client_secret: client.client_secret, redirect_uri: 'http://localhost:' + server.address().port, grant_type: 'authorization_code' }) });
    const j = await r.json();
    if (!j.refresh_token) throw new Error(JSON.stringify(j));
    fs.writeFileSync(OAUTH_TOKEN, JSON.stringify({ refresh_token: j.refresh_token, scope: j.scope }, null, 1));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<h2>Gata. Poți închide fila asta.</h2>');
    console.log('Autorizat. Token salvat în ' + OAUTH_TOKEN);
  } catch (e) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Eroare: ' + e.message); console.error(e.message); }
  setTimeout(() => process.exit(0), 300);
});
server.listen(0, '127.0.0.1', () => {
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: client.client_id, redirect_uri: 'http://localhost:' + server.address().port, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent' });
  console.log('Deschid pagina Google. Dacă nu se deschide singură, copiază linkul:\n' + url);
  execFile('powershell', ['-NoProfile', '-Command', 'Start-Process', '"' + url.replace(/&/g, '`&') + '"'], () => {});
});
setTimeout(() => { console.error('Timp expirat (5 minute).'); process.exit(1); }, 5 * 60 * 1000);
