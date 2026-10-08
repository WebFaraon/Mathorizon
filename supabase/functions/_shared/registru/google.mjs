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

const SCOPE_READ = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly';
const SCOPE_WRITE = 'https://www.googleapis.com/auth/spreadsheets';
const cached = {};
export async function accessToken(key, write) {
  const scope = write ? SCOPE_WRITE : SCOPE_READ, id = key.client_email + '|' + scope, c = cached[id];
  if (c && c.exp > Date.now() + 60000) return c.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await signJwt(key, scope) })
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('Login Google eșuat: ' + JSON.stringify(j).slice(0, 200));
  cached[id] = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached[id].token;
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

async function send(token, method, url, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) });
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

/* ONE group tab: { title (the register's), tabs: [{ title, sheetId, hidden, values }] } in two calls made at the same time. The tab is asked for by name and
   checked by its id (the names change, the ids do not): a name that is not that sheet's today is an error, never another group's data. */
export async function readGroupTab(key, spreadsheetId, sheetId, tab) {
  const token = await accessToken(key);
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId);
  const [meta, vals] = await Promise.all([
    get(token, base + '?fields=properties.title,sheets.properties(title,sheetId,hidden)'),
    get(token, base + '/values/' + encodeURIComponent(q(tab) + '!A1:AC198') + '?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS')
  ]);
  const s = meta.sheets.find(x => String(x.properties.sheetId) === String(sheetId));
  if (!s) throw new Error('Fila nu mai există în registru (id ' + sheetId + ').');
  if (s.properties.title !== tab) throw new Error('Fila s-a redenumit între timp („' + s.properties.title + '”): citirea completă o preia.');
  if (GENERAL.has(plain(tab))) throw new Error('Fila „' + tab + '” nu e o grupă.');
  return { title: meta.properties.title, tabs: [{ title: tab, sheetId: s.properties.sheetId, hidden: !!s.properties.hidden, values: vals.values || [] }] };
}

/* when the file last changed (one light call): a register that did not change is not read at all */
export async function driveModified(key, spreadsheetId) {
  const j = await get(await accessToken(key), 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(spreadsheetId) + '?fields=modifiedTime&supportsAllDrives=true');
  return j.modifiedTime;
}

/* ---- writing: what a command needs from a live register (see applyAsync in apply.mjs) ---- */
import { MemoryBook, a1 as cellName, parseA1 } from './memory-book.mjs';

const toCells = (formulas, values) => {
  const cells = {};
  (formulas || []).forEach((row, r) => (row || []).forEach((x, c) => {
    if (x === '' || x === undefined || x === null) return;
    const v = values && values[r] ? values[r][c] : undefined;
    const isF = typeof x === 'string' && x.startsWith('=');
    cells[cellName(r + 1, c + 1)] = isF ? { v: v === '' ? undefined : v, f: x.slice(1) } : { v: x };
  }));
  return cells;
};

/* the tab with the given sheet id of a register: its title now (names change, ids do not) */
export async function tabTitle(key, spreadsheetId, sheetId) {
  const token = await accessToken(key, true);
  const meta = await get(token, 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId) + '?fields=sheets.properties(title,sheetId)');
  const s = meta.sheets.find(x => String(x.properties.sheetId) === String(sheetId));
  if (!s) throw new Error('Fila nu mai există în registru (id ' + sheetId + ').');
  return s.properties.title;
}

export function createAdapter(key, spreadsheetId) {
  let ids = null;                                             // tab title -> sheet id, read once
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId);
  const ranges = list => list.map(r => 'ranges=' + encodeURIComponent(r)).join('&');
  const two = async list => {                                 // the same ranges as formulas and as calculated values
    const token = await accessToken(key, true);
    const q = ranges(list) + '&majorDimension=ROWS&';
    const [f, v] = await Promise.all([
      get(token, base + '/values:batchGet?valueRenderOption=FORMULA&' + q),
      get(token, base + '/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&' + q)
    ]);
    return list.map((_, k) => [f.valueRanges[k].values || [], v.valueRanges[k].values || []]);
  };
  return {
    async load(tab) {
      const [[f, v], [cf, cv]] = await two([q(tab) + '!A1:AC198', "'CONFIGURARI'!A1:K200"]);
      return new MemoryBook({ [tab]: { cells: toCells(f, v) }, CONFIGURARI: { hidden: true, cells: toCells(cf, cv) } }, spreadsheetId + '.xlsx');
    },
    async read(tab, keys) {
      const out = {};
      const parts = await two(keys.map(k => q(tab) + '!' + k));
      keys.forEach((k, i) => { const c = toCells(parts[i][0], parts[i][1]); out[k] = c.A1 || { v: null }; });
      return out;
    },
    async tabs() {
      const token = await accessToken(key, true);
      const meta = await get(token, base + '?fields=sheets.properties(title,sheetId,hidden,index)');
      ids = Object.fromEntries(meta.sheets.map(s => [s.properties.title, s.properties.sheetId]));
      return meta.sheets.map(s => ({ title: s.properties.title, sheetId: s.properties.sheetId, hidden: !!s.properties.hidden }));
    },
    /* a copy of a tab (colours, dropdown chips, validations, formulas) with a new name, at the end of the visible tabs */
    async duplicate(sourceTitle, title) {
      const token = await accessToken(key, true);
      const all = await this.tabs();
      const src = all.find(x => x.title === sourceTitle);
      if (!src) throw new Error('Fila-șablon „' + sourceTitle + '” nu mai există.');
      const lastVisible = all.reduce((m, x, i) => (!x.hidden ? i : m), all.length - 1);
      const r = await send(token, 'POST', base + ':batchUpdate', { requests: [{ duplicateSheet: { sourceSheetId: src.sheetId, newSheetName: title, insertSheetIndex: lastVisible + 1 } }] });
      const sheetId = r.replies[0].duplicateSheet.properties.sheetId;
      ids[title] = sheetId;
      return { sheetId };
    },
    /* a tab gets a new name; `cell` ({ tab, a1, v }) is the cell of "Total achitari" that holds the old name (its formulas find the tab by it),
       changed in the SAME request, so the register never has a name the Total list cannot find */
    async renameTab(oldTitle, newTitle, cell) {
      const token = await accessToken(key, true);
      await this.tabs();
      if (ids[oldTitle] === undefined) throw new Error('Fila „' + oldTitle + '” nu mai există în registru.');
      const requests = [{ updateSheetProperties: { properties: { sheetId: ids[oldTitle], title: newTitle }, fields: 'title' } }];
      if (cell) {
        if (ids[cell.tab] === undefined) throw new Error('Fila „' + cell.tab + '” nu există în registru.');
        const { r, c } = parseA1(cell.a1);
        requests.push({ updateCells: { start: { sheetId: ids[cell.tab], rowIndex: r - 1, columnIndex: c - 1 }, rows: [{ values: [{ userEnteredValue: { stringValue: String(cell.v) } }] }], fields: 'userEnteredValue' } });
      }
      await send(token, 'POST', base + ':batchUpdate', { requests });
      ids[newTitle] = ids[oldTitle]; delete ids[oldTitle];
    },
    async remove(title) {
      const token = await accessToken(key, true);
      await this.tabs();
      if (ids[title] === undefined) return;
      await send(token, 'POST', base + ':batchUpdate', { requests: [{ deleteSheet: { sheetId: ids[title] } }] });
      delete ids[title];
    },
    /* clears (rectangles) and cells of one or more tabs, in ONE request: all or nothing */
    async batchWrite({ clears, cells }) {
      const token = await accessToken(key, true);
      if (!ids) await this.tabs();
      const need = [...new Set((clears || []).map(c => c.tab).concat(Object.keys(cells || {})))];
      for (const tb of need) if (ids[tb] === undefined) throw new Error('Fila „' + tb + '” nu există în registru.');
      const requests = (clears || []).map(({ tab, range }) => {
        const [a, b] = range.split(':').map(parseA1);
        return { updateCells: { range: { sheetId: ids[tab], startRowIndex: a.r - 1, endRowIndex: b.r, startColumnIndex: a.c - 1, endColumnIndex: b.c }, fields: 'userEnteredValue' } };
      });
      Object.keys(cells || {}).forEach(tab => Object.keys(cells[tab]).forEach(k => {
        const c = cells[tab][k], { r, c: col } = parseA1(k);
        const cell = c.f ? { userEnteredValue: { formulaValue: '=' + c.f } }
          : c.v === undefined || c.v === null || c.v === '' ? {}
          : typeof c.v === 'number' ? { userEnteredValue: { numberValue: c.v } } : { userEnteredValue: { stringValue: String(c.v) } };
        requests.push({ updateCells: { start: { sheetId: ids[tab], rowIndex: r - 1, columnIndex: col - 1 }, rows: [{ values: [cell] }], fields: 'userEnteredValue' } });
      }));
      await send(token, 'POST', base + ':batchUpdate', { requests });
    },
    /* all the cells of a tab in ONE request (spreadsheets.batchUpdate is all or nothing): the text as text (a "+373..." header stays text),
       a formula as a formula, an empty value clears the cell */
    async write(tab, cells) {
      const token = await accessToken(key, true);
      if (!ids) {
        const meta = await get(token, base + '?fields=sheets.properties(title,sheetId)');
        ids = Object.fromEntries(meta.sheets.map(s => [s.properties.title, s.properties.sheetId]));
      }
      if (ids[tab] === undefined) throw new Error('Fila „' + tab + '” nu mai există în registru.');
      const requests = Object.keys(cells).map(k => {
        const c = cells[k], { r, c: col } = parseA1(k);
        const cell = c.f ? { userEnteredValue: { formulaValue: '=' + c.f } }
          : c.v === undefined || c.v === null || c.v === '' ? {}
          : typeof c.v === 'number' ? { userEnteredValue: { numberValue: c.v } } : { userEnteredValue: { stringValue: String(c.v) } };
        return { updateCells: { start: { sheetId: ids[tab], rowIndex: r - 1, columnIndex: col - 1 }, rows: [{ values: [cell] }], fields: 'userEnteredValue' } };
      });
      await send(token, 'POST', base + ':batchUpdate', { requests });
    }
  };
}
