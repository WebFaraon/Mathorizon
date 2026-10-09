/* registru-replace: the money of the replacements (docs/inlocuiri.md).
   For every replacement still open it looks at what the substitute teacher has marked (reg_lessons.marks of the substitute's tab, as registru-sync last read it),
   moves the money of each marked lesson from the base register to the substitute's register, gives it back when a mark is changed, and closes the tab when the
   replacement is over. The logic is replacement-engine.mjs (pure, tested in scripts/check-sync.js); this file only connects it to Supabase and Google.
   Called by registru-sync after it read the registers (header x-sync-secret), or by an admin from the console ("Reîncearcă").
   Body (optional): { "replacement_id": "<uuid>" } to look at one replacement only;
   { "replacement_id", "retry_item": "<student_key>" } lets a line that gave up (or whose write could not be confirmed) try again: the admin has looked at the register.
   Every step is a reg_commands row with an id made from the step (so the same step is never written twice), run as the console's own commands are.
   Secrets: GOOGLE_SA_KEY, REG_SYNC_SECRET (as registru-sync). */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { settleReplacements } from '../_shared/registru/replacement-engine.mjs';
import { runCommand } from '../_shared/registru/process.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('REG_SYNC_SECRET') ?? '';
const SA_KEY = Deno.env.get('GOOGLE_SA_KEY') ?? '';
const LOCK_SECONDS = 150;
const CLOSED_LOOKBACK_DAYS = 30;                     // a closed replacement is still looked at for this long (a late mark, a corrected mark)

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

/* a UUID made from the step's name: the same step always has the same row, so a repeat finds the first answer instead of writing twice */
async function uuidOf(text: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = [...h].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const asEngineResult = (r: any) => (r && typeof r === 'object' ? r : { status: 'failed', code: 'no-result', msg: 'Comanda nu a întors niciun rezultat.' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!(await allowed(req))) return json(401, { error: 'not allowed' });
  if (!SA_KEY) return json(500, { error: 'GOOGLE_SA_KEY is not set' });
  const key = JSON.parse(SA_KEY);
  const body = await req.json().catch(() => ({}));

  // one run at a time: two runs together would look at the same marks
  const { data: got } = await sb.rpc('reg_take_lock', { p_name: 'replace', p_seconds: LOCK_SECONDS });
  if (!got) return json(200, { busy: true });
  try {
    if (body.replacement_id && body.retry_item) {
      // a new attempt = new command ids: the steps of the old attempt keep their answers, nothing is replayed
      const { data: it } = await sb.from('reg_replacement_items').select('attempt, status').eq('replacement_id', body.replacement_id).eq('student_key', body.retry_item).maybeSingle();
      if (it && it.status !== 'settled' && it.status !== 'reversed') {
        await sb.from('reg_replacement_items').update({ attempt: (it.attempt ?? 1) + 1, tries: 0, error: null, step: null, updated_at: new Date().toISOString() }).eq('replacement_id', body.replacement_id).eq('student_key', body.retry_item);
      }
    }
    const cutoff = new Date(Date.now() - CLOSED_LOOKBACK_DAYS * 86400000).toISOString();
    const db = {
      async replacements() {
        let q = sb.from('reg_replacements').select('*').or(`status.eq.active,and(status.eq.closed,closed_at.gt.${cutoff})`).order('created_at', { ascending: true });
        if (body.replacement_id) q = sb.from('reg_replacements').select('*').eq('id', body.replacement_id).neq('status', 'cancelled');
        const { data, error } = await q;
        if (error) throw new Error('reg_replacements: ' + error.message);
        return (data ?? []).map((r: any) => ({ id: r.id, origWorkbook: r.orig_workbook, origSheet: r.orig_sheet, replWorkbook: r.repl_workbook, replSheet: r.repl_sheet, status: r.status, dates: r.dates ?? [], price: Number(r.price) }));
      },
      async replData(rep: any) {
        const { data: g } = await sb.from('reg_groups').select('id').eq('workbook_id', rep.replWorkbook).eq('sheet_id', rep.replSheet).maybeSingle();
        if (!g) return null;
        const [{ data: st }, { data: ls }] = await Promise.all([
          sb.from('reg_students').select('col, name, phone').eq('group_id', g.id),
          sb.from('reg_lessons').select('row_no, marks').eq('group_id', g.id).order('row_no', { ascending: true })
        ]);
        return { students: (st ?? []).map((s: any) => ({ col: s.col, name: s.name, phone: s.phone })), lessons: (ls ?? []).map((l: any) => ({ row: l.row_no, marks: l.marks ?? {} })) };
      },
      async items(rep: any) {
        const { data, error } = await sb.from('reg_replacement_items').select('*').eq('replacement_id', rep.id);
        if (error) throw new Error('reg_replacement_items: ' + error.message);
        return (data ?? []).map((i: any) => ({ ...i, ach: Number(i.ach), red: Number(i.red), short: Number(i.short), tot: i.tot == null ? null : Number(i.tot) }));
      },
      async saveItem(rep: any, it: any) {
        const { error } = await sb.from('reg_replacement_items').upsert({
          replacement_id: rep.id, student_key: it.student_key, lesson_row: it.lesson_row, student_name: it.student_name, student_phone: it.student_phone, mark: it.mark,
          status: it.status, step: it.step ?? null, error: it.error ?? null, tries: it.tries ?? 0, attempt: it.attempt ?? 1, tot: it.tot ?? null,
          ach: it.ach ?? 0, red: it.red ?? 0, short: it.short ?? 0, settled_at: it.settled_at ?? null, updated_at: new Date().toISOString()
        }, { onConflict: 'replacement_id,student_key' });
        if (error) throw new Error('reg_replacement_items: ' + error.message);   // the step is already written in the register: the engine stops here and the next run reads the command's answer
      },
      async setStatus(rep: any, status: string) {
        const { error } = await sb.from('reg_replacements').update({ status, closed_at: status === 'closed' ? new Date().toISOString() : null }).eq('id', rep.id);
        if (error) throw new Error('reg_replacements: ' + error.message);
      }
    };

    /* one step: the row exists before anything is written, and a repeated id answers with the first answer */
    const run = async (r: { id: string; workbook: string; sheet: number; type: string; payload: Record<string, unknown> }) => {
      const id = await uuidOf(r.id);
      const { data: old } = await sb.from('reg_commands').select('id, status, result').eq('id', id).maybeSingle();
      if (old) {
        if (old.status === 'done' || old.status === 'noop') return asEngineResult(old.result ?? { status: old.status });
        if (old.status === 'running' || old.status === 'pending') return { status: 'failed', code: 'interrupted', msg: 'Pasul a început și nu s-a încheiat.' };
        return asEngineResult(old.result ?? { status: old.status });
      }
      const { error } = await sb.from('reg_commands').insert({ id, workbook_id: r.workbook, sheet_id: r.sheet, type: r.type, payload: r.payload, status: 'running', claimed_at: new Date().toISOString() });
      if (error) return { status: 'failed', code: 'interrupted', msg: 'Pasul nu a putut fi înregistrat: ' + error.message };
      return asEngineResult(await runCommand(sb, key, { id, workbook_id: r.workbook, sheet_id: r.sheet, type: r.type, payload: r.payload }));
    };

    const out = await settleReplacements({ db, run, today: new Date().toISOString().slice(0, 10) });
    return json(200, out);
  } catch (e) {
    return json(500, { error: String((e as Error).message ?? e).slice(0, 400) });
  } finally {
    await sb.rpc('reg_release_lock', { p_name: 'replace' });
  }
});
