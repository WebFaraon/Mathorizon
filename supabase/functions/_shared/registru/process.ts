/* The runner of one command (reg_commands row) against Google Sheets, shared by registru-apply (commands queued by the console) and registru-replace
   (the money steps of the replacements). It finds the register and the tab (by sheet id, names change), applies the command, and keeps the outcome on the row:
   done | noop | invalid | conflict | failed. Also owns the two commands that touch the replacements table: REPLACEMENT_CREATE and REPLACEMENT_CANCEL. */
import { applyAsync, applySetGroupAsync, applyTransferAsync, applyNewGroupAsync } from './apply.mjs';
import { applyReplacementCreateAsync } from './replacement.mjs';
import { createAdapter, tabTitle } from './google.mjs';

export const finish = (sb: any, id: string, status: string, result: unknown) =>
  sb.from('reg_commands').update({ status, result, applied_at: new Date().toISOString() }).eq('id', id);

const plainT = (x: string) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* the dates of a replacement as the console sends them: [{ iso, start, duration, cabinet }] */
function cleanDates(d: unknown): { ok: boolean; dates?: any[]; msg?: string } {
  if (!Array.isArray(d) || !d.length) return { ok: false, msg: 'Alege cel puțin o dată pentru înlocuire.' };
  const out: any[] = [];
  for (const x of d as any[]) {
    const start = Number(x?.start), duration = Number(x?.duration), iso = String(x?.iso ?? ''), cabinet = String(x?.cabinet ?? '').trim();
    if (!ISO.test(iso) || !Number.isFinite(start) || start < 7 || start > 22 || !(duration >= 1 && duration <= 4)) return { ok: false, msg: 'Una dintre datele înlocuirii e incompletă (data, ora sau durata).' };
    if (out.some(o => o.iso === iso && o.start === start)) continue;
    out.push({ iso, start, duration, cabinet });
  }
  return { ok: true, dates: out.sort((a, b) => (a.iso + String(a.start).padStart(2, '0')).localeCompare(b.iso + String(b.start).padStart(2, '0'))) };
}

async function createReplacement(sb: any, key: unknown, row: any, wb: any) {
  const p = row.payload ?? {};
  const cd = cleanDates(p.dates);
  if (!cd.ok) return { status: 'invalid', code: 'dates', msg: cd.msg };
  const { data: ow } = await sb.from('reg_workbooks').select('spreadsheet_id, enabled').eq('id', p.origWorkbook).maybeSingle();
  if (!ow || !ow.enabled) return { status: 'failed', code: 'workbook', msg: 'Registrul grupei de bază nu mai e activ în platformă.' };
  const fromTab = await tabTitle(key, ow.spreadsheet_id, p.origSheet);
  const from = createAdapter(key, ow.spreadsheet_id), to = ow.spreadsheet_id === wb.spreadsheet_id ? from : createAdapter(key, wb.spreadsheet_id);

  // the tab of this group at this teacher exists already: it is brought up to date and reused
  const { data: existing } = await sb.from('reg_replacements').select('id, repl_sheet, dates, status').eq('orig_workbook', p.origWorkbook).eq('orig_sheet', p.origSheet).eq('repl_workbook', row.workbook_id).neq('status', 'cancelled').maybeSingle();
  let existingTab: string | undefined;
  if (existing) {
    try { existingTab = await tabTitle(key, wb.spreadsheet_id, existing.repl_sheet); }
    catch { await sb.from('reg_replacements').update({ status: 'cancelled' }).eq('id', existing.id); }   // the tab was deleted by hand: a new one is made
  }
  const r = await applyReplacementCreateAsync({ from, to }, { id: row.id, fromTab, existingTab, dates: cd.dates, teacherLevel: p.teacherLevel, title: p.title });
  if (r.status !== 'done' && r.status !== 'noop') return r;

  const keep = existingTab && existing ? (existing.dates ?? []).filter((o: any) => !cd.dates!.some(n => n.iso === o.iso && n.start === o.start)) : [];
  const dates = [...keep, ...cd.dates!].sort((a: any, b: any) => (a.iso + String(a.start).padStart(2, '0')).localeCompare(b.iso + String(b.start).padStart(2, '0')));
  let id = row.id;
  if (existingTab && existing) {
    id = existing.id;
    const { error } = await sb.from('reg_replacements').update({ status: 'active', closed_at: null, dates, price: r.price, size: r.size, repl_tab: r.tab }).eq('id', id);
    if (error) return { status: 'failed', code: 'db', msg: 'Fila e pregătită, dar înlocuirea nu s-a putut salva: ' + error.message };
  } else {
    const { error } = await sb.from('reg_replacements').insert({ id, orig_workbook: p.origWorkbook, orig_sheet: p.origSheet, repl_workbook: row.workbook_id, repl_sheet: r.sheetId, repl_tab: r.tab, status: 'active', dates, price: r.price, size: r.size, created_by: row.created_by ?? null });
    if (error) return { status: 'failed', code: 'db', msg: 'Fila e creată în registru, dar înlocuirea nu s-a putut salva: ' + error.message };
  }
  return Object.assign({}, r, { replacementId: id, dates });
}

/* cancel one date (payload.iso) or every date still ahead; the lesson itself is not undone (nothing was moved before the substitute marks it).
   With no live date left and no money moved, the tab goes Inactiv at once; with money moved, the engine closes it after the last date. */
async function cancelReplacement(sb: any, key: unknown, row: any, wb: any) {
  const p = row.payload ?? {};
  const { data: rep } = await sb.from('reg_replacements').select('*').eq('id', p.replacementId).maybeSingle();
  if (!rep || rep.repl_workbook !== row.workbook_id) return { status: 'invalid', code: 'not-found', msg: 'Înlocuirea nu există.' };
  const today = new Date().toISOString().slice(0, 10);
  let changed = 0;
  const dates = (rep.dates ?? []).map((d: any) => {
    if (d.cancelled || d.iso < today || (p.iso && d.iso !== p.iso) || (p.start != null && d.start !== p.start)) return d;
    changed++; return { ...d, cancelled: true };
  });
  if (!changed) return { status: 'invalid', code: 'past', msg: 'Lecția a trecut sau a fost anulată deja: nu mai poate fi anulată.' };
  const live = dates.filter((d: any) => !d.cancelled);
  let closed = false;
  if (!live.length) {
    const { count } = await sb.from('reg_replacement_items').select('student_key', { count: 'exact', head: true }).eq('replacement_id', rep.id).neq('status', 'reversed');
    if (!count) {
      const tab = await tabTitle(key, wb.spreadsheet_id, rep.repl_sheet);
      const r = await applyAsync(createAdapter(key, wb.spreadsheet_id), { id: row.id, type: 'REPL_CLOSE', tab });
      if (r.status !== 'done' && r.status !== 'noop') return r;
      closed = true;
    }
  }
  const upd: any = { dates };
  if (closed) { upd.status = 'closed'; upd.closed_at = new Date().toISOString(); }
  const { error } = await sb.from('reg_replacements').update(upd).eq('id', rep.id);
  if (error) return { status: 'failed', code: 'db', msg: error.message };
  return { status: 'done', replacementId: rep.id, cancelled: changed, closed, tab: rep.repl_tab };
}

export async function runCommand(sb: any, key: unknown, row: any) {
  const { data: wb } = await sb.from('reg_workbooks').select('spreadsheet_id, enabled').eq('id', row.workbook_id).maybeSingle();
  if (!wb || !wb.enabled) {
    const result = { status: 'failed', code: 'workbook', msg: 'Registrul nu mai e activ în platformă.' };
    await finish(sb, row.id, 'failed', result);
    return result;
  }
  try {
    let result;
    if (row.type === 'SET_AVAILABILITY') {
      // a command on the register: the tab is "Disponibilitate" or, for the summer one, "Disponibilitate Vara" (found by name, the register has no sheet id for it here)
      const adapter = createAdapter(key, wb.spreadsheet_id);
      const want = row.payload?.summer ? 'disponibilitate vara' : 'disponibilitate';
      const found = (await adapter.tabs()).find((x: any) => plainT(x.title) === want);
      result = found ? await applyAsync(adapter, { id: row.id, type: 'SET_AVAILABILITY', tab: found.title, ...row.payload })
        : { status: 'invalid', code: 'no-tab', msg: 'Registrul nu are fila de disponibilitate.' };
    } else if (row.type === 'NEW_GROUP') {
      // a command on the register itself: the tab does not exist yet
      result = await applyNewGroupAsync(createAdapter(key, wb.spreadsheet_id), { id: row.id, type: 'NEW_GROUP', ...row.payload });
    } else if (row.type === 'REPLACEMENT_CREATE') {
      result = await createReplacement(sb, key, row, wb);
    } else if (row.type === 'REPLACEMENT_CANCEL') {
      result = await cancelReplacement(sb, key, row, wb);
    } else {
      const tab = await tabTitle(key, wb.spreadsheet_id, row.sheet_id);               // the tab's name today (names change, the id does not)
      if (row.type === 'TRANSFER') {
        // two groups, possibly in two registers: the new one is in the payload
        const { toWorkbook, toSheet, ...rest } = row.payload;
        const { data: wb2 } = await sb.from('reg_workbooks').select('spreadsheet_id, enabled').eq('id', toWorkbook).maybeSingle();
        if (!wb2 || !wb2.enabled) {
          result = { status: 'failed', code: 'workbook', msg: 'Registrul grupei noi nu mai e activ în platformă.' };
        } else {
          const toTab = await tabTitle(key, wb2.spreadsheet_id, toSheet);
          const from = createAdapter(key, wb.spreadsheet_id), to = wb2.spreadsheet_id === wb.spreadsheet_id ? from : createAdapter(key, wb2.spreadsheet_id);
          result = await applyTransferAsync({ from, to }, { id: row.id, type: 'TRANSFER', fromTab: tab, toTab, ...rest });
        }
      } else {
        const adapter = createAdapter(key, wb.spreadsheet_id), cmd = { id: row.id, type: row.type, tab, ...row.payload };
        result = row.type === 'SET_GROUP' ? await applySetGroupAsync(adapter, cmd) : await applyAsync(adapter, cmd);
      }
      if (result && !result.tab) result.tab = tab;   // the name the tab has now (the client reads just that tab next)
    }
    await finish(sb, row.id, result.status, result);
    return result;
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 400);
    const hint = /403|permission/i.test(msg) ? ' Registrul trebuie partajat cu contul de serviciu ca Editor (nu doar Cititor).' : '';
    const result = { status: 'failed', code: 'google', msg: msg + hint };
    await finish(sb, row.id, 'failed', result);
    return result;
  }
}
