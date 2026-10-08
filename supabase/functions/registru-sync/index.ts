/* registru-sync: reads the teachers' Google Sheets registers into the platform's reg_* tables (F1: read only).
   Called by pg_cron every few minutes (header x-sync-secret) or by an admin from the console (Bearer token of an admin).
   Body (optional): { "workbook_id": "<uuid>" } to sync one register; without it, every enabled one.
   Secrets (supabase secrets set): GOOGLE_SA_KEY (the service account JSON, as text), REG_SYNC_SECRET (a long random string). */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { syncWorkbook } from '../_shared/registru/sync-core.mjs';
import { readWorkbook, driveModified, QuotaError } from '../_shared/registru/google.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('REG_SYNC_SECRET') ?? '';
const SA_KEY = Deno.env.get('GOOGLE_SA_KEY') ?? '';
const BUDGET_MS = 100_000;                         // stop starting new registers after this: the platform limits how long a call may run

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };   // the admin console calls it from the browser
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!(await allowed(req))) return json(401, { error: 'not allowed' });
  if (!SA_KEY) return json(500, { error: 'GOOGLE_SA_KEY is not set' });
  const key = JSON.parse(SA_KEY);
  const body = await req.json().catch(() => ({}));
  let q = sb.from('reg_workbooks').select('id, spreadsheet_id, title, school_year_from, drive_modified, last_full_sync_at').eq('enabled', true);
  if (body.workbook_id) q = q.eq('id', body.workbook_id);
  const { data: books, error } = await q.order('last_synced_at', { ascending: true, nullsFirst: true });   // the longest-waiting register first
  if (error) return json(500, { error: error.message });

  const started = Date.now(), results: unknown[] = [];
  for (const wb of books ?? []) {
    if (Date.now() - started > BUDGET_MS) { results.push({ workbook: wb.id, status: 'deferred' }); continue; }
    const run = await sb.from('reg_sync_runs').insert({ workbook_id: wb.id }).select('id').single();
    try {
      const r = await syncWorkbook({ wb, read: (id: string) => readWorkbook(key, id), peek: (id: string) => driveModified(key, id), db });
      if (!r.full) {                                       // nothing changed: only note that it was checked
        await sb.from('reg_sync_runs').delete().eq('id', run.data?.id);
        await sb.from('reg_workbooks').update({ last_synced_at: new Date().toISOString() }).eq('id', wb.id);
        results.push({ workbook: wb.id, status: 'unchanged' });
        continue;
      }
      const status = r.skipped.length ? 'partial' : 'ok';
      await sb.from('reg_sync_runs').update({ finished_at: new Date().toISOString(), status, groups_seen: r.seen, groups_changed: r.changed, groups_skipped: r.skipped.length, detail: r }).eq('id', run.data?.id);
      await sb.from('reg_workbooks').update({ last_synced_at: new Date().toISOString(), last_status: status, last_error: null, title: r.title, teacher_name: r.teacher, drive_modified: r.modified, last_full_sync_at: new Date().toISOString() }).eq('id', wb.id);
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
  return json(200, { results });
});
