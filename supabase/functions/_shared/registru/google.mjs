/* Google Sheets, read only, with a service account and nothing else: a signed JWT (WebCrypto) swapped for an access token, then two calls
   (tab list, values of the group tabs). Plain ES module: runs in Node (tests) and in the Supabase Edge Function (Deno). */

const b64u = bytes => {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
};
const enc = t => new TextEncoder().encode(t);

async function signJwt(key, scope) {
  const pem = key.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const k = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64u(enc(JSON.stringify({ iss: key.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', k, enc(head + '.' + body)));
  return head + '.' + body + '.' + b64u(sig);
}

let cached = null;
export async function accessToken(key) {
  if (cached && cached.email === key.client_email && cached.exp > Date.now() + 60000) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await signJwt(key, 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly') })
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('Login Google eșuat: ' + JSON.stringify(j).slice(0, 200));
  cached = { email: key.client_email, token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

/* Google's per-minute quota is used up: the caller stops and the next run continues (nothing is marked as failed) */
export class QuotaError extends Error {}

async function get(token, url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) { await new Promise(r => setTimeout(r, 2000 * 2 ** attempt)); continue; }
    const j = await res.json().catch(() => ({}));
    if (res.status === 429) throw new QuotaError('Google: limita pe minut a fost atinsă');
    if (!res.ok) throw new Error(`Google ${res.status}: ${JSON.stringify(j.error || j).slice(0, 240)}`);
    return j;
  }
}

const GENERAL = new Set(['total achitari', 'disponibilitate', 'disponibilitate vara', 'configurari']);
const plain = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const q = t => "'" + t.replace(/'/g, "''") + "'";

/* { title, tabs: [{ title, sheetId, hidden, values }] }: the values (as calculated, no formulas) of every group tab, A1:AC198 */
export async function readWorkbook(key, spreadsheetId) {
  const token = await accessToken(key);
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId);
  const meta = await get(token, base + '?fields=properties.title,sheets.properties(title,sheetId,hidden)');
  const tabs = meta.sheets.map(s => ({ title: s.properties.title, sheetId: s.properties.sheetId, hidden: !!s.properties.hidden, values: null }));
  const groupTabs = tabs.filter(t => !GENERAL.has(plain(t.title)));
  for (let i = 0; i < groupTabs.length; i += 8) {                                  // a few tabs per call keeps the URL short
    const part = groupTabs.slice(i, i + 8);
    const r = await get(token, base + '/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS&' + part.map(t => 'ranges=' + encodeURIComponent(q(t.title) + '!A1:AC198')).join('&'));
    part.forEach((t, k) => { t.values = r.valueRanges[k].values || []; });
  }
  // the general tabs: payments to the teacher, availability (regular and summer), the dropdown lists
  const GENERAL_RANGES = { 'total achitari': 'A1:AI32', 'disponibilitate': 'A1:V15', 'disponibilitate vara': 'A1:V16', 'configurari': 'A1:K200' };
  const general = tabs.filter(t => GENERAL_RANGES[plain(t.title)]);
  if (general.length) {
    const r = await get(token, base + '/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS&' + general.map(t => 'ranges=' + encodeURIComponent(q(t.title) + '!' + GENERAL_RANGES[plain(t.title)])).join('&'));
    general.forEach((t, k) => { t.values = r.valueRanges[k].values || []; });
  }
  return { title: meta.properties.title, tabs };
}

/* when the file last changed (one light call): a register that did not change is not read at all */
export async function driveModified(key, spreadsheetId) {
  const j = await get(await accessToken(key), 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(spreadsheetId) + '?fields=modifiedTime&supportsAllDrives=true');
  return j.modifiedTime;
}
