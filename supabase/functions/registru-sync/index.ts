/* registru-sync: reads the teachers' Google Sheets registers into the platform's reg_* tables (F1: read only).
   Called by pg_cron every few minutes (header x-sync-secret) or by an admin from the console (Bearer token of an admin).
   Body (optional): { "workbook_id": "<uuid>" } to sync one register; without it, every enabled one.
   { "workbook_id", "sheet_id", "tab" }: only that group's tab is read and replaced (right after a write of the console; the cron's full read follows).
   The register's own Apps Script (apps-script/Mathorizon-sync.gs, docs/apps-script.md) calls it at every edit with the header x-hook-secret and
   { "spreadsheet_id", "sheet_id", "tab" } (one tab) or { "spreadsheet_id", "full": true } (the structure changed). That key can ask for nothing else (hook.mjs).
   Secrets (supabase secrets set): GOOGLE_SA_KEY (the service account JSON, as text), REG_SYNC_SECRET (a long random string), REG_HOOK_SECRET (the registers' key). */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { syncWorkbook, syncGroup } from '../_shared/registru/sync-core.mjs';
import { readWorkbook, readGroupTab, driveModified, QuotaError } from '../_shared/registru/google.mjs';
import { checkHookBody, sameSecret } from '../_shared/registru/hook.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('REG_SYNC_SECRET') ?? '';
const HOOK_SECRET = Deno.env.get('REG_HOOK_SECRET') ?? '';
const SA_KEY = Deno.env.get('GOOGLE_SA_KEY') ?? '';
const BUDGET_MS = 100_000;                         // stop starting new registers after this: the platform limits how long a call may run

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret, x-hook-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };   // the admin console calls it from the browser
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

/* who is asking: 'full' (the cron, the secret), 'admin' (the console), 'hook' (a register's Apps Script: it may only read one register again), or nobody */
async function who(req: Request): Promise<'full' | 'admin' | 'hook' | null> {
  if (SECRET && sameSecret(req.headers.get('x-sync-secret'), SECRET)) return 'full';
  if (HOOK_SECRET && sameSecret(req.headers.get('x-hook-secret'), HOOK_SECRET)) return 'hook';
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return null;
  const { data: p } = await sb.from('user_profiles').select('role').eq('user_id', data.user.id).maybeSingle();
  return p?.role === 'admin' ? 'admin' : null;
}

/* the console asks for the newest of these to know whether to read again (migration 20261011100000; a platform without it just ignores the error) */
const stamp = (wbId: string) => sb.from('reg_workbooks').update({ last_change_at: new Date().toISOString() }).eq('id', wbId).then(() => {}, () => {});

const db = {
  async hashes(wbId: string) {
    const { data, error } = await sb.from('reg_groups').select('sheet_id, content_hash').eq('workbook_id', wbId);
    if (error) throw new Error(error.message);
    return new Map((data ?? []).map((r: any) => [String(r.sheet_id), r.content_hash]));
  },
  async applyGroup(wbId: string, payload: unknown) {
    const { error } = await sb.rpc('reg_apply_group', { p_workbook: wbId, p_group: payload });
    if (error) throw new Error('reg_apply_group: ' + error.message);
  },
  async prune(wbId: string, keep: number[]) {
    const { data, error } = await sb.rpc('reg_prune_groups', { p_workbook: wbId, p_keep: keep });
    if (error) throw new Error('reg_prune_groups: ' + error.message);
    return (data as number) ?? 0;
  }
};

/* after a read of the registers: the replacements still open (a substitute's tab to follow, money to move, a tab to close) are handed to registru-replace.
   It reads what this function has just stored, so it comes after the loop; it never fails the sync (its own run keeps its own record). */
async function settleReplacements(onlyIfTab?: { wb: string; sheet: number }) {
  try {
    let q = sb.from('reg_replacements').select('id', { count: 'exact', head: true });
    q = onlyIfTab ? q.eq('repl_workbook', onlyIfTab.wb).eq('repl_sheet', onlyIfTab.sheet).in('status', ['active', 'closed']) : q.eq('status', 'active');
    const { count } = await q;
    if (!count) return;
    const call = fetch(SUPABASE_URL + '/functions/v1/registru-replace', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sync-secret': SECRET }, body: '{}' }).then(r => r.text()).catch(() => '');
    const rt = (globalThis as any).EdgeRuntime;
    if (rt && typeof rt.waitUntil === 'function') rt.waitUntil(call); else await call;
  } catch { /* the next run tries again */ }
}

/* A group with enough enrolled students goes from "Se completează" to "Startează" by itself: a SET_GROUP command is put in the queue (the same road as every other write,
   checked against what the register holds now: if somebody changed the state meanwhile it is refused, nothing is overwritten) and registru-apply is called to run it.
   The command's id is made from the group and the number of students, so the same moment never queues it twice (a person who sets the state back is respected until
   another student joins). */
async function detId(s: string): Promise<string> {
  const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function queueAutoStart(wbId: string, list: { sheetId: number; tab: string; enrolled: number; need: number }[] | undefined) {
  if (!list || !list.length) return;
  try {
    const rows = [];
    for (const x of list) rows.push({ id: await detId(`autostart|${wbId}|${x.sheetId}|${x.enrolled}`), workbook_id: wbId, sheet_id: x.sheetId, type: 'SET_GROUP', payload: { state: 'Startează', expect: { state: 'Se completează' }, auto: true, enrolled: x.enrolled, need: x.need } });
    const { error } = await sb.from('reg_commands').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) return;
    const call = fetch(SUPABASE_URL + '/functions/v1/registru-apply', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sync-secret': SECRET }, body: '{}' }).then(r => r.text()).catch(() => '');
    const rt = (globalThis as any).EdgeRuntime;
    if (rt && typeof rt.waitUntil === 'function') rt.waitUntil(call); else await call;
  } catch { /* the next run tries again */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const role = await who(req);
  if (!role) return json(401, { error: 'not allowed' });
  if (!SA_KEY) return json(500, { error: 'GOOGLE_SA_KEY is not set' });
  const key = JSON.parse(SA_KEY);
  const body = await req.json().catch(() => ({}));

  /* a register's own script: what it asks is checked field by field, then turned into the same group / one-register read the console uses */
  if (role === 'hook') {
    const h = checkHookBody(body);
    if (!h.ok) return json(400, { error: h.msg });
    const { data: found } = await sb.from('reg_workbooks').select('id').eq('spreadsheet_id', h.spreadsheetId).eq('enabled', true).maybeSingle();
    if (!found) return json(200, { results: [{ status: 'failed', error: 'registru necunoscut sau oprit' }] });
    body.workbook_id = found.id;
    delete body.spreadsheet_id;
    if (h.kind === 'full') { delete body.full; body.force = true; } else { body.force = true; }
  }

  let q = sb.from('reg_workbooks').select('id, spreadsheet_id, title, school_year_from, drive_modified, last_full_sync_at, teacher_data').eq('enabled', true);
  if (body.workbook_id) q = q.eq('id', body.workbook_id);
  const { data: books, error } = await q.order('last_synced_at', { ascending: true, nullsFirst: true });   // the longest-waiting register first
  if (error) return json(500, { error: error.message });

  if (body.workbook_id && body.sheet_id && body.tab) {
    const wb = (books ?? [])[0];
    if (!wb) return json(200, { results: [{ workbook: body.workbook_id, status: 'failed', error: 'registru necunoscut sau oprit' }] });
    try {
      const r = await syncGroup({ wb, sheetId: body.sheet_id, tab: String(body.tab), readTab: (id: string, sid: number, tab: string) => readGroupTab(key, id, sid, tab), db });
      if (r.changed) { await stamp(wb.id); await settleReplacements({ wb: wb.id, sheet: Number(body.sheet_id) }); }
      await queueAutoStart(wb.id, (r as any).autoStart);   // a substitute's tab that changed: the money follows at once
      return json(200, { results: [{ workbook: wb.id, group: true, status: r.skipped.length ? 'partial' : 'ok', changed: r.changed, tab: r.tab }] });
    } catch (e) {
      return json(200, { results: [{ workbook: wb.id, group: true, status: 'failed', error: String((e as Error).message ?? e).slice(0, 300) }] });
    }
  }

  // a run opened and never closed (the function was cut between the insert and the update) is marked failed, so the console counts it and nobody mistakes it for a live run
  await sb.from('reg_sync_runs').update({ finished_at: new Date().toISOString(), status: 'failed', detail: { error: 'întrerupt: funcția s-a oprit înainte de final; registrul se citește din nou la următorul ciclu' } }).is('status', null).lt('started_at', new Date(Date.now() - 10 * 60000).toISOString());

  const started = Date.now(), results: unknown[] = [];
  for (const wb of books ?? []) {
    if (Date.now() - started > BUDGET_MS) { results.push({ workbook: wb.id, status: 'deferred' }); continue; }
    const run = await sb.from('reg_sync_runs').insert({ workbook_id: wb.id }).select('id').single();
    try {
      const r = await syncWorkbook({ wb, read: (id: string) => readWorkbook(key, id), peek: (id: string) => driveModified(key, id), db, force: !!(body.force && body.workbook_id) });
      if (!r.full) {                                       // nothing changed: only note that it was checked
        await sb.from('reg_sync_runs').delete().eq('id', run.data?.id);
        await sb.from('reg_workbooks').update({ last_synced_at: new Date().toISOString() }).eq('id', wb.id);
        results.push({ workbook: wb.id, status: 'unchanged' });
        continue;
      }
      const status = r.skipped.length ? 'partial' : 'ok';
      await sb.from('reg_sync_runs').update({ finished_at: new Date().toISOString(), status, groups_seen: r.seen, groups_changed: r.changed, groups_skipped: r.skipped.length, detail: r }).eq('id', run.data?.id);
      await sb.from('reg_workbooks').update({ last_synced_at: new Date().toISOString(), last_status: status, last_error: null, title: r.title, teacher_name: r.teacher, drive_modified: r.modified, last_full_sync_at: new Date().toISOString(), project: r.workbook.project, config: r.workbook.config, teacher_data: r.workbook.teacher, issues: r.issues }).eq('id', wb.id);
      await stamp(wb.id);                                  // a full read happens only when the file changed: that is a change for the console
      await queueAutoStart(wb.id, (r as any).autoStart);
      results.push({ workbook: wb.id, status, seen: r.seen, changed: r.changed, skipped: r.skipped.length });
    } catch (e) {
      if (e instanceof QuotaError) {                       // Google's per-minute limit: stop here, the next run continues with the longest-waiting register
        await sb.from('reg_sync_runs').delete().eq('id', run.data?.id);
        results.push({ workbook: wb.id, status: 'deferred', reason: 'quota' });
        break;
      }
      const msg = String((e as Error).message ?? e).slice(0, 500);
      await sb.from('reg_sync_runs').update({ finished_at: new Date().toISOString(), status: 'failed', detail: { error: msg } }).eq('id', run.data?.id);
      await sb.from('reg_workbooks').update({ last_synced_at: new Date().toISOString(), last_status: 'failed', last_error: msg }).eq('id', wb.id);
      results.push({ workbook: wb.id, status: 'failed', error: msg });
    }
  }
  await settleReplacements();
  return json(200, { results });
});
