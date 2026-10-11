/* What a register's own Apps Script (apps-script/Mathorizon-sync.gs) may ask of registru-sync (docs/apps-script.md).
   The script sits where teachers can open it, so its key (REG_HOOK_SECRET) is deliberately weak: it can only ask to READ one register again, nothing else.
   No other field of the body is accepted with it: not a workbook id of ours, not a command, not "all registers". The decision is here, pure, so it is tested
   (scripts/check-sync.js); the function only calls it.
     { spreadsheet_id, sheet_id, tab }   one group tab was edited: that tab is read and replaced
     { spreadsheet_id, full: true }      the structure changed (a tab added, a row inserted): that register is read whole */
const KEYS = new Set(['spreadsheet_id', 'sheet_id', 'tab', 'force', 'full']);
const SPREADSHEET = /^[A-Za-z0-9_-]{20,80}$/;

export function checkHookBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, msg: 'Cerere necunoscută.' };
  const extra = Object.keys(body).filter(k => !KEYS.has(k));
  if (extra.length) return { ok: false, msg: 'Câmpuri neacceptate: ' + extra.join(', ') };
  if (typeof body.spreadsheet_id !== 'string' || !SPREADSHEET.test(body.spreadsheet_id)) return { ok: false, msg: 'spreadsheet_id lipsește sau nu arată a id de registru.' };
  if (body.full === true) {
    if (body.sheet_id !== undefined || body.tab !== undefined) return { ok: false, msg: 'O citire completă nu are fila.' };
    return { ok: true, kind: 'full', spreadsheetId: body.spreadsheet_id };
  }
  if (!Number.isInteger(body.sheet_id) || body.sheet_id < 0) return { ok: false, msg: 'sheet_id lipsește.' };
  if (typeof body.tab !== 'string' || !body.tab.trim() || body.tab.length > 120) return { ok: false, msg: 'tab lipsește.' };
  return { ok: true, kind: 'group', spreadsheetId: body.spreadsheet_id, sheetId: body.sheet_id, tab: body.tab };
}

/* constant-time comparison of the key (a leaked timing difference would only help a guess, but it costs nothing) */
export function sameSecret(a, b) {
  const x = String(a == null ? '' : a), y = String(b == null ? '' : b);
  if (!x || !y || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
