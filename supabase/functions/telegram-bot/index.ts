/* telegram-bot: the Telegram bot of the teachers: it asks to confirm the start of a group and answers what teachers asked the manager (today's lessons, groups, pay, ...).
   The conversation is in ../_shared/telegram/bot.mjs and the answers in ../_shared/telegram/assistant.mjs, both tested without a network.
   Two callers:
     - Telegram: every message and button press, with the header x-telegram-bot-api-secret-token (the webhook's secret_token, set by scripts/telegram-setup.js);
     - pg_cron, every minute: { "action": "dispatch" } with the header x-sync-secret, sends the questions that are waiting (only between 08:00 and 21:00, Chisinau).
   Secrets (supabase secrets set): TELEGRAM_BOT_TOKEN (from BotFather), TELEGRAM_WEBHOOK_SECRET (a long random string), REG_SYNC_SECRET (already set for registru-sync).
   Deploy with --no-verify-jwt: neither caller has a Supabase JWT, both are checked by their own secret. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleUpdate, dispatch, MAX_ATTEMPTS } from '../_shared/telegram/bot.mjs';
import { sameSecret } from '../_shared/registru/hook.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';
const SYNC_SECRET = Deno.env.get('REG_SYNC_SECRET') ?? '';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/* Telegram: one method per call; an error from Telegram (a blocked bot, a bad request) is thrown with its description */
async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(String(j.description || `Telegram ${res.status}`));
  return j.result;
}
const api = {
  sendMessage: (chat: number, text: string, extra: Record<string, unknown> = {}) => call('sendMessage', { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }),
  editMessageText: (chat: number, id: number, text: string, extra: Record<string, unknown> = {}) => call('editMessageText', { chat_id: chat, message_id: id, text, parse_mode: 'HTML', ...extra }),
  answerCallbackQuery: (id: string, text: string) => call('answerCallbackQuery', { callback_query_id: id, text: text || undefined })
};

/* the official name when the admin set one (migration 20261101110000), else the name of the profile */
const nameOf = async (userId: string) => {
  let r = await sb.from('user_profiles').select('official_name, display_name').eq('user_id', userId).maybeSingle();
  if (r.error) r = await sb.from('user_profiles').select('display_name').eq('user_id', userId).maybeSingle() as any;
  const d: any = r.data;
  return (d?.official_name as string) || (d?.display_name as string) || '';
};

/* every row of a query, 1000 at a time (the API stops at 1000) */
async function allRows(build: (from: number, to: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const db = {
  async consumeLinkCode(code: string) {
    const { data } = await sb.from('telegram_link_codes').delete().eq('code', code).gt('expires_at', new Date().toISOString()).select('user_id');
    return data && data[0] ? { user_id: data[0].user_id as string } : null;
  },
  async saveLink(l: { user_id: string; chat_id: number; username: string | null; first_name: string | null }) {
    await sb.from('telegram_links').delete().eq('chat_id', l.chat_id).neq('user_id', l.user_id);          // a chat belongs to one account
    const { error } = await sb.from('telegram_links').upsert({ ...l, linked_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
    return { name: await nameOf(l.user_id) };
  },
  async userByChat(chat: number) {
    const { data } = await sb.from('telegram_links').select('user_id').eq('chat_id', chat).maybeSingle();
    return data ? { user_id: data.user_id as string, name: await nameOf(data.user_id as string) } : null;
  },
  async unlinkChat(chat: number) { await sb.from('telegram_links').delete().eq('chat_id', chat); },
  /* everything the assistant needs about one teacher: his registers, groups, students, lessons and replacements (see assistant.mjs) */
  async teacherView(userId: string) {
    const { data: wbs, error } = await sb.from('reg_workbooks').select('id, teacher_name, teacher_data, last_synced_at').eq('owner_user_id', userId).eq('enabled', true);
    if (error) throw new Error(error.message);
    const workbooks = wbs ?? [], ids = workbooks.map((w: any) => w.id);
    if (!ids.length) return { workbooks: [], groups: [], students: [], lessons: [], replacements: [] };
    const { data: groups } = await sb.from('reg_groups').select('id, workbook_id, sheet_id, tab, format_size, state, subject, grade, level, profile, schedule, mode').in('workbook_id', ids);
    const gids = (groups ?? []).map((g: any) => g.id);
    const [students, lessons, reps] = await Promise.all([
      gids.length ? allRows((a, b) => sb.from('reg_students').select('group_id, name, status').in('group_id', gids).order('col', { ascending: true }).range(a, b)) : Promise.resolve([]),
      gids.length ? allRows((a, b) => sb.from('reg_lessons').select('group_id, iso, topic, marks').in('group_id', gids).not('iso', 'is', null).order('group_id').order('row_no').range(a, b)) : Promise.resolve([]),
      sb.from('reg_replacements').select('id, status, orig_workbook, orig_sheet, repl_workbook, repl_sheet, dates').eq('status', 'active').or(`orig_workbook.in.(${ids.join(',')}),repl_workbook.in.(${ids.join(',')})`)
    ]);
    const rows = reps.data ?? [];
    const wids = [...new Set(rows.flatMap((r: any) => [r.orig_workbook, r.repl_workbook]))];
    const [names, origs] = rows.length ? await Promise.all([
      sb.from('reg_workbooks').select('id, teacher_name').in('id', wids),
      sb.from('reg_groups').select('workbook_id, sheet_id, subject, grade, mode').in('workbook_id', [...new Set(rows.map((r: any) => r.orig_workbook))])
    ]) : [{ data: [] }, { data: [] }];
    const nameOfWb = new Map((names.data ?? []).map((w: any) => [w.id, w.teacher_name as string]));
    const replacements = rows.map((r: any) => ({
      ...r,
      orig: (origs.data ?? []).find((g: any) => g.workbook_id === r.orig_workbook && String(g.sheet_id) === String(r.orig_sheet)) ?? null,
      origTeacher: nameOfWb.get(r.orig_workbook) ?? '', replTeacher: nameOfWb.get(r.repl_workbook) ?? ''
    }));
    return { workbooks, groups: groups ?? [], students, lessons, replacements };
  },
  async request(id: string) { const { data } = await sb.from('group_start_requests').select('*').eq('id', id).maybeSingle(); return data; },
  async groupState(r: any) {
    if (!r.group_id) return null;
    const { data } = await sb.from('reg_groups').select('state').eq('id', r.group_id).maybeSingle();
    return (data?.state as string) ?? null;
  },
  /* the update only happens while the request is still in one of the allowed statuses: two presses at once decide only once */
  async setRequest(id: string, patch: Record<string, unknown>, allowed: string[]) {
    const { data } = await sb.from('group_start_requests').update(patch).eq('id', id).in('status', allowed).select('id');
    return data && data[0] ? data[0] : null;
  },
  async awaitingReason(chat: number) {
    const { data } = await sb.from('group_start_requests').select('id').eq('status', 'awaiting_reason').eq('telegram_chat_id', chat).order('created_at', { ascending: false }).limit(1);
    return data && data[0] ? { id: data[0].id as string } : null;
  },
  /* the questions that were never sent, each with its group's state now, the group's students, and the chat of the teacher (null when he is not tied to the bot) */
  async dueRequests() {
    const { data: reqs } = await sb.from('group_start_requests').select('*').eq('status', 'pending').is('notified_at', null).lt('notify_attempts', MAX_ATTEMPTS).order('created_at', { ascending: true }).limit(25);
    if (!reqs || !reqs.length) return [];
    const gids = reqs.map((r: any) => r.group_id).filter(Boolean), wids = [...new Set(reqs.map((r: any) => r.workbook_id))];
    const [gs, ss, ws] = await Promise.all([
      gids.length ? sb.from('reg_groups').select('id, state').in('id', gids) : Promise.resolve({ data: [] }),
      gids.length ? sb.from('reg_students').select('group_id, name, status').in('group_id', gids).order('col', { ascending: true }) : Promise.resolve({ data: [] }),
      sb.from('reg_workbooks').select('id, owner_user_id').in('id', wids)
    ]);
    const owners = (ws.data ?? []).map((w: any) => w.owner_user_id).filter(Boolean);
    const { data: links } = owners.length ? await sb.from('telegram_links').select('user_id, chat_id').in('user_id', owners) : { data: [] };
    const stateOf = new Map((gs.data ?? []).map((g: any) => [g.id, g.state]));
    const ownerOf = new Map((ws.data ?? []).map((w: any) => [w.id, w.owner_user_id]));
    const chatOf = new Map((links ?? []).map((l: any) => [l.user_id, Number(l.chat_id)]));
    return reqs.map((r: any) => ({
      request: r,
      groupState: stateOf.get(r.group_id) ?? null,
      students: (ss.data ?? []).filter((s: any) => s.group_id === r.group_id).map((s: any) => ({ name: s.name, status: s.status })),
      chat: chatOf.get(ownerOf.get(r.workbook_id)) ?? null
    }));
  }
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!TOKEN) return json(500, { error: 'TELEGRAM_BOT_TOKEN is not set' });

  // Telegram: always answered 200 once the secret fits, so it does not send the same update again
  if (WEBHOOK_SECRET && sameSecret(req.headers.get('x-telegram-bot-api-secret-token'), WEBHOOK_SECRET)) {
    try { await handleUpdate(await req.json(), { db, api, now: new Date() }); } catch (e) { console.error('telegram update failed:', e); }
    return json(200, { ok: true });
  }
  // the cron
  if (SYNC_SECRET && sameSecret(req.headers.get('x-sync-secret'), SYNC_SECRET)) {
    const body = await req.json().catch(() => ({}));
    if (body.action !== 'dispatch') return json(400, { error: 'unknown action' });
    try { return json(200, await dispatch({ db, api, now: new Date() })); } catch (e) { return json(500, { error: String((e as Error).message ?? e).slice(0, 300) }); }
  }
  return json(401, { error: 'not allowed' });
});
