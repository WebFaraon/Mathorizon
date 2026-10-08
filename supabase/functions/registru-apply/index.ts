/* registru-apply: writes the platform's commands (reg_commands) into the Google Sheets registers (F2).
   Called by the console right after it queues a command (Bearer token of an admin), or by pg_cron to catch what is left (header x-sync-secret).
   Body (optional): { "command_id": "<uuid>" } for one command; without it, the oldest pending ones.
   Each command: claimed (pending -> running, so two calls never run the same one), planned on the live tab, checked again just before
   the write, written, read back, and the outcome kept on the command: done | noop | invalid | conflict | failed.
   Secrets: GOOGLE_SA_KEY, REG_SYNC_SECRET (as registru-sync). The service account must be EDITOR of the register to write in it. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyAsync, applyTransferAsync, applyNewGroupAsync } from '../_shared/registru/apply.mjs';
import { createAdapter, tabTitle } from '../_shared/registru/google.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('REG_SYNC_SECRET') ?? '';
const SA_KEY = Deno.env.get('GOOGLE_SA_KEY') ?? '';
const BATCH = 5;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

async function allowed(req: Request): Promise<boolean> {
  if (SECRET && req.headers.get('x-sync-secret') === SECRET) return true;
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return false;
  const { data: p } = await sb.from('user_profiles').select('role').eq('user_id', data.user.id).maybeSingle();
  return p?.role === 'admin';
}

const finish = (id: string, status: string, result: unknown) =>
  sb.from('reg_commands').update({ status, result, applied_at: new Date().toISOString() }).eq('id', id);

async function run(key: unknown, row: any) {
  const { data: wb } = await sb.from('reg_workbooks').select('spreadsheet_id, enabled').eq('id', row.workbook_id).maybeSingle();
  if (!wb || !wb.enabled) {
    const result = { status: 'failed', code: 'workbook', msg: 'Registrul nu mai e activ în platformă.' };
    await finish(row.id, 'failed', result);
    return result;
  }
  try {
    let result;
    if (row.type === 'NEW_GROUP') {
      // a command on the register itself: the tab does not exist yet
      result = await applyNewGroupAsync(createAdapter(key, wb.spreadsheet_id), { id: row.id, type: 'NEW_GROUP', ...row.payload });
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
      result = await applyAsync(createAdapter(key, wb.spreadsheet_id), { id: row.id, type: row.type, tab, ...row.payload });
    }
    }
    await finish(row.id, result.status, result);
    return result;
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 400);
    const hint = /403|permission/i.test(msg) ? ' Registrul trebuie partajat cu contul de serviciu ca Editor (nu doar Cititor).' : '';
    const result = { status: 'failed', code: 'google', msg: msg + hint };
    await finish(row.id, 'failed', result);
    return result;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!(await allowed(req))) return json(401, { error: 'not allowed' });
  if (!SA_KEY) return json(500, { error: 'GOOGLE_SA_KEY is not set' });
  const key = JSON.parse(SA_KEY);
  const body = await req.json().catch(() => ({}));
  // a command left "running" by a call that died: we cannot know whether it wrote, so it is marked failed and a person looks at the register
  await sb.from('reg_commands').update({ status: 'failed', applied_at: new Date().toISOString(), result: { status: 'failed', code: 'interrupted', msg: 'Rularea s-a întrerupt: verifică registrul înainte să repeți comanda.' } })
    .eq('status', 'running').lt('claimed_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
  let q = sb.from('reg_commands').select('id, workbook_id, sheet_id, type, payload').eq('status', 'pending').order('created_at', { ascending: true }).limit(BATCH);
  if (body.command_id) q = sb.from('reg_commands').select('id, workbook_id, sheet_id, type, payload').eq('status', 'pending').eq('id', body.command_id);
  const { data: rows, error } = await q;
  if (error) return json(500, { error: error.message });
  const results: unknown[] = [];
  for (const row of rows ?? []) {
    // claim it: only one caller moves it from pending to running
    const { data: claimed } = await sb.from('reg_commands').update({ status: 'running', claimed_at: new Date().toISOString() }).eq('id', row.id).eq('status', 'pending').select('id');
    if (!claimed || !claimed.length) continue;
    const r = await run(key, row);
    results.push({ id: row.id, status: (r as any)?.status ?? 'done', column: (r as any)?.column, msg: (r as any)?.msg, code: (r as any)?.code });
  }
  return json(200, { results });
});
