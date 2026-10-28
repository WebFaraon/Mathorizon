/* The Telegram bot of the platform: asks a teacher, when his group is ready to start, whether he confirms the start; the answer reaches the manager in the console.
   Pure logic: the database (db) and Telegram (api) are passed in, so the whole conversation is tested without either (scripts/check-telegram.js); the Edge
   Function supabase/functions/telegram-bot/index.ts gives it the real ones.

   The conversation:
     teacher   /start CODE            -> his Mathorizon account is tied to this chat (the code comes from his profile page, valid 15 minutes)
     bot       "<group> is ready to start. Do you confirm?"   [Confirm] [Do not confirm]
     teacher   Confirm                -> status confirmed: the manager sees it in the console and calls the students for the trial lesson
     teacher   Do not confirm         -> the bot asks for the reason; the next message is the reason: status declined, the manager sees it
   The bot writes only between 08:00 and 21:00 (Chisinau). A teacher who is not tied to the bot is not written to: the manager sees that in the console and calls him. */
import { startCheck } from '../registru/start-rule.mjs';

export const TZ = 'Europe/Chisinau';
export const WRITE_FROM = 8, WRITE_TO = 21;
export const MAX_ATTEMPTS = 3;

const DAYS = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

export const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pad = n => String(n).padStart(2, '0');

/* the hour on the wall clock of Chisinau */
export function localHour(date) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).format(date));
  return h === 24 ? 0 : h;
}
export const canWrite = date => { const h = localHour(date); return h >= WRITE_FROM && h < WRITE_TO; };

export const gradeText = g => { const n = ROMAN[String(g == null ? '' : g).trim().toUpperCase()]; return n ? `clasa a ${n}-a` : (g ? `clasa ${g}` : ''); };

/* "luni și joi, 12:00 - 13:00": the days of the group and the hours of its lesson, from the schedule rows (one per hour) */
export function whenText(schedule) {
  const byDay = new Map();
  (Array.isArray(schedule) ? schedule : []).forEach(r => {
    const d = Number(r && r.day), h = Number(r && r.hour);
    if (!(d >= 1 && d <= 7) || !Number.isFinite(h)) return;
    const x = byDay.get(d) || { h0: h, n: 0 };
    x.h0 = Math.min(x.h0, h); x.n++;
    byDay.set(d, x);
  });
  if (!byDay.size) return '';
  const days = [...byDay.keys()].sort((a, b) => a - b), first = byDay.get(days[0]);
  const names = days.map(d => DAYS[d - 1]);
  const dayText = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' și ' + names[names.length - 1];
  return `${dayText}, ${pad(first.h0)}:00 - ${pad(first.h0 + first.n)}:00`;
}

const groupLine = r => [esc(r.subject || 'Grupă'), esc(gradeText(r.grade))].filter(Boolean).join(', ');

export function askText(r, counts) {
  const when = whenText(r.schedule);
  return `<b>Grupa e gata de start</b>\n${groupLine(r)}${when ? '\n' + esc(when) : ''}\n` +
    `${counts.enrolled} ${counts.enrolled === 1 ? 'elev înscris' : 'elevi înscriși'} din ${counts.size}${counts.need ? ` (minimul pentru start e ${counts.need})` : ''}.\n\n` +
    'Confirmi startul grupei?';
}
export const askKeyboard = id => ({ inline_keyboard: [[{ text: '✅ Confirm startul', callback_data: 'c:' + id }, { text: '❌ Nu confirm', callback_data: 'n:' + id }]] });

const T = {
  linked: name => `Gata${name ? ', ' + esc(name) : ''}. Contul tău Mathorizon e conectat la acest chat.\nVei primi aici o întrebare când una dintre grupele tale e gata de start: confirmi startul sau spui motivul pentru care nu.\nOprești mesajele cu /stop.`,
  badCode: 'Codul nu mai e valabil (ține 15 minute) sau a fost deja folosit. Intră pe Mathorizon, la profilul tău, apasă „Conectează Telegram” și folosește linkul nou.',
  notLinked: 'Acest chat nu e conectat la un cont Mathorizon. Intră pe Mathorizon, la profilul tău, apasă „Conectează Telegram” și deschide linkul primit.',
  hello: name => `Salut${name ? ', ' + esc(name) : ''}! Sunt botul Mathorizon. Îți scriu când o grupă a ta e gata de start și te întreb dacă o confirmi. Nu e nimic de făcut până atunci.`,
  help: 'Ce pot face:\n• îți scriu când o grupă a ta e gata de start și te întreb dacă confirmi startul;\n• /stop oprește mesajele și șterge legătura cu contul tău.\nPentru orice altceva, vorbește cu managerul tău.',
  stopped: 'Am oprit mesajele și am șters legătura cu contul tău. O poți reface oricând din profilul tău de pe Mathorizon.',
  nothing: 'Nu am nicio întrebare deschisă pentru tine acum. Îți scriu când o grupă e gata de start.',
  already: 'Ai răspuns deja la această întrebare.',
  notYours: 'Întrebarea aceasta nu e pentru acest cont.',
  gone: 'Grupa nu mai e în starea de start, așa că nu mai ai nimic de confirmat.',
  askReason: 'Care e motivul? Scrie-l într-un singur mesaj și îl transmit managerului.',
  thanksReason: 'Mulțumesc. Am transmis motivul managerului.',
  confirmedDone: r => `✅ Ai confirmat startul grupei\n${groupLine(r)}${whenText(r.schedule) ? '\n' + esc(whenText(r.schedule)) : ''}\n\nManagerul a fost anunțat și sună elevii pentru prima lecție.`,
  declinedAsk: r => `❌ Nu ai confirmat startul grupei\n${groupLine(r)}${whenText(r.schedule) ? '\n' + esc(whenText(r.schedule)) : ''}`
};

/* ---------- a message or a button press from Telegram ---------- */

export async function handleUpdate(update, { db, api, now = new Date() }) {
  if (update && update.callback_query) return handleCallback(update.callback_query, { db, api, now });
  const m = update && update.message;
  if (!m || !m.chat || m.chat.type !== 'private' || typeof m.text !== 'string') return { handled: false };
  const chat = m.chat.id, text = m.text.trim();
  const say = (t, extra) => api.sendMessage(chat, t, extra);

  const start = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9]{4,32}))?\s*$/i.exec(text);
  if (start) {
    if (start[1]) {
      const code = await db.consumeLinkCode(start[1].toUpperCase());
      if (!code) { await say(T.badCode); return { handled: true, linked: false }; }
      const u = await db.saveLink({ user_id: code.user_id, chat_id: chat, username: m.from && m.from.username || null, first_name: m.from && m.from.first_name || null });
      await say(T.linked(u && u.name || (m.from && m.from.first_name) || ''));
      return { handled: true, linked: true };
    }
    const u = await db.userByChat(chat);
    await say(u ? T.hello(u.name) : T.notLinked);
    return { handled: true };
  }
  if (/^\/stop(?:@\w+)?\s*$/i.test(text)) { await db.unlinkChat(chat); await say(T.stopped); return { handled: true, unlinked: true }; }
  if (/^\/(?:ajutor|help)(?:@\w+)?\s*$/i.test(text)) { await say(T.help); return { handled: true }; }

  const user = await db.userByChat(chat);
  if (!user) { await say(T.notLinked); return { handled: true }; }
  const waiting = await db.awaitingReason(chat);
  if (waiting && !text.startsWith('/')) {
    const done = await db.setRequest(waiting.id, { status: 'declined', reason: text.slice(0, 500), decided_at: now.toISOString() }, ['awaiting_reason']);
    if (done) { await say(T.thanksReason); return { handled: true, declined: true, request: waiting.id }; }
  }
  await say(T.nothing);
  return { handled: true };
}

async function handleCallback(cb, { db, api, now }) {
  const chat = cb.message && cb.message.chat && cb.message.chat.id, msgId = cb.message && cb.message.message_id;
  const answer = (t) => api.answerCallbackQuery(cb.id, t);
  const d = /^([cn]):([0-9a-f-]{36})$/.exec(String(cb.data || ''));
  if (!d || !chat) { await answer(''); return { handled: false }; }
  const user = await db.userByChat(chat);
  if (!user) { await answer(T.notYours); return { handled: true }; }
  const r = await db.request(d[2]);
  if (!r || Number(r.telegram_chat_id) !== Number(chat)) { await answer(T.notYours); return { handled: true }; }
  if (r.status !== 'pending') { await answer(T.already); return { handled: true, already: true }; }
  if (!isStarting(await db.groupState(r))) {
    await db.setRequest(r.id, { status: 'cancelled' }, ['pending']);
    await answer(T.gone);
    if (msgId) await api.editMessageText(chat, msgId, esc(T.gone), { reply_markup: { inline_keyboard: [] } }).catch(() => {});
    return { handled: true, cancelled: true };
  }
  if (d[1] === 'c') {
    const upd = await db.setRequest(r.id, { status: 'confirmed', decided_at: now.toISOString() }, ['pending']);
    if (!upd) { await answer(T.already); return { handled: true, already: true }; }
    await answer('Confirmat');
    if (msgId) await api.editMessageText(chat, msgId, T.confirmedDone(r), { reply_markup: { inline_keyboard: [] } }).catch(() => {});
    return { handled: true, confirmed: true, request: r.id };
  }
  const upd = await db.setRequest(r.id, { status: 'awaiting_reason' }, ['pending']);
  if (!upd) { await answer(T.already); return { handled: true, already: true }; }
  await answer('');
  if (msgId) await api.editMessageText(chat, msgId, T.declinedAsk(r), { reply_markup: { inline_keyboard: [] } }).catch(() => {});
  await api.sendMessage(chat, T.askReason, { reply_markup: { force_reply: true, input_field_placeholder: 'Motivul' } });
  return { handled: true, askedReason: true, request: r.id };
}

const isStarting = state => ['startează', 'starteaza'].includes(String(state || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()) || String(state || '').toLowerCase().trim() === 'startează';

/* ---------- the questions waiting to be sent ---------- */

/* db.dueRequests() -> [{ request, groupState, students: [{ status }], chat }] for the requests with status pending that were never sent (chat null: the teacher is not tied). */
export async function dispatch({ db, api, now = new Date() }) {
  const out = { sent: 0, noChat: 0, cancelled: 0, failed: 0, night: false };
  if (!canWrite(now)) { out.night = true; return out; }
  for (const x of await db.dueRequests()) {
    const r = x.request;
    if (!isStarting(x.groupState)) { await db.setRequest(r.id, { status: 'cancelled' }, ['pending']); out.cancelled++; continue; }
    if (!x.chat) { out.noChat++; continue; }
    const sc = startCheck({ state: 'Se completează', format_size: r.format_size, students: x.students || [] });
    const counts = { enrolled: sc ? sc.enrolled : (x.students || []).length, need: sc ? sc.need : null, size: r.format_size || '?' };
    try {
      const sent = await api.sendMessage(x.chat, askText(r, counts), { reply_markup: askKeyboard(r.id) });
      await db.setRequest(r.id, { notified_at: now.toISOString(), telegram_chat_id: x.chat, telegram_message_id: sent && sent.message_id || null, enrolled: counts.enrolled, need: counts.need, notify_error: null }, ['pending']);
      out.sent++;
    } catch (e) {
      await db.setRequest(r.id, { notify_attempts: (r.notify_attempts || 0) + 1, notify_error: String(e && e.message || e).slice(0, 200) }, ['pending']);
      out.failed++;
    }
  }
  return out;
}
