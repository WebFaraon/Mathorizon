/* registru-config: puts the approved managers into the managers list of the registers.
   That list is CONFIGURARI!B2:B of the founder master file (each register shows it through IMPORTRANGE), so one write reaches every register.
   Called by the console (Bearer token of the admin) after a manager is approved or renamed, and from the Manageri page ("Trimite"); or with the header x-sync-secret.
   The master file must be shared with the service account as EDITOR. Until it is, the answer is { ok: false, code: 'no-access', names: [...] }:
   the console then shows the names to copy by hand. Writing is idempotent: a name already in the column is never added twice.
   Secrets: GOOGLE_SA_KEY, REG_SYNC_SECRET (as registru-sync); optional REG_MASTER_ID (the id of the master file, default below). */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { accessToken } from '../_shared/registru/google.mjs';
import { planManagerList, FIRST_ROW, LAST_ROW } from '../_shared/registru/manager-list.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('REG_SYNC_SECRET') ?? '';
const SA_KEY = Deno.env.get('GOOGLE_SA_KEY') ?? '';
const MASTER = Deno.env.get('REG_MASTER_ID') ?? '1cfzsd-M5Ujtc8Y-FQSzmAyjJ12Cq2qAG4SgRhCCVdoQ';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!(await allowed(req))) return json(401, { error: 'not allowed' });
  if (!SA_KEY) return json(500, { error: 'GOOGLE_SA_KEY is not set' });

  const { data: rows, error } = await sb.from('user_profiles').select('user_id, official_name').eq('role', 'manager').eq('status', 'active').not('official_name', 'is', null);
  if (error) return json(500, { error: error.message });
  const wanted = (rows ?? []).map((r: any) => ({ id: r.user_id as string, name: r.official_name as string }));
  if (!wanted.length) return json(200, { ok: true, added: [], present: 0 });

  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(MASTER) + '/values/';
  let token: string;
  try { token = await accessToken(JSON.parse(SA_KEY), true); } catch (e) { return json(502, { ok: false, code: 'google', error: String((e as Error).message) }); }
  const headers = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };

  const range = `CONFIGURARI!B${FIRST_ROW}:B${LAST_ROW}`;
  const res = await fetch(base + encodeURIComponent(range), { headers });
  if (res.status === 403 || res.status === 404) return json(200, { ok: false, code: 'no-access', names: wanted.map(w => w.name) });
  if (!res.ok) return json(502, { ok: false, code: 'google', error: 'Google ' + res.status });
  const j = await res.json();
  const cells = Array.from({ length: LAST_ROW - FIRST_ROW + 1 }, (_, i) => String(j.values?.[i]?.[0] ?? ''));

  const plan = planManagerList(cells, wanted);
  if (plan.add.length) {
    const first = plan.add[0].row, last = plan.add[plan.add.length - 1].row;
    const put = await fetch(base + encodeURIComponent(`CONFIGURARI!B${first}:B${last}`) + '?valueInputOption=RAW', {
      method: 'PUT', headers, body: JSON.stringify({ range: `CONFIGURARI!B${first}:B${last}`, majorDimension: 'ROWS', values: plan.add.map(a => [a.name]) })
    });
    if (put.status === 403) return json(200, { ok: false, code: 'no-access', names: wanted.map(w => w.name) });          // readable but not editable
    if (!put.ok) return json(502, { ok: false, code: 'google', error: 'Google ' + put.status });
  }
  const done = [...plan.present, ...plan.add.map(a => a.id)];
  if (done.length) await sb.from('user_profiles').update({ config_synced_at: new Date().toISOString() }).in('user_id', done);
  return json(200, { ok: true, added: plan.add.map(a => a.name), present: plan.present.length, full: plan.full.length });
});
