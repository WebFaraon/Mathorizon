/* The Telegram bot of the platform, the assistant of the teachers.
   Two jobs:
     1. when a group of the teacher is ready to start it asks him whether he confirms the start; the answer reaches the manager in the console;
     2. it answers what teachers used to ask the manager: today's and tomorrow's lessons, the week, the groups with their students, the pay, the numbers, the
        replacements, the Meet link, the rules (the answers are in ./assistant.mjs).
   Pure logic: the database (db) and Telegram (api) are passed in, so the whole conversation is tested without either (scripts/check-telegram.js); the Edge
   Function supabase/functions/telegram-bot/index.ts gives it the real ones.

   The start question:
     teacher   /start CODE            -> his Mathorizon account is tied to this chat (the code comes from his profile page, valid 15 minutes)
     bot       "<group> is ready to start. Do you confirm?"   [Confirm] [Do not confirm]
     teacher   Confirm                -> status confirmed: the manager sees it in the console and calls the students for the trial lesson
     teacher   Do not confirm         -> the bot asks for the reason; the next message is the reason: status declined, the manager sees it
   The bot writes on its own only between 08:00 and 21:00 (Chisinau). When the teacher asks something, it answers at any hour. A teacher who is not tied to the bot
   is not written to: the manager sees that in the console and calls him. */
import { startCheck } from '../registru/start-rule.mjs';
import * as A from './assistant.mjs';

export const TZ = 'Europe/Chisinau';
export const WRITE_FROM = 8, WRITE_TO = 21;
export const MAX_ATTEMPTS = 3;

export const { esc, whenText, gradeText } = A;
const MAX_LEN = 3800;                                                       // Telegram stops a message at 4096 characters

/* the hour on the wall clock of Chisinau */
export function localHour(date) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).format(date));
  return h === 24 ? 0 : h;
}
export const canWrite = date => { const h = localHour(date); return h >= WRITE_FROM && h < WRITE_TO; };

export const askText = A.askText;
export const askKeyboard = id => ({ inline_keyboard: [[{ text: '✅ Confirm startul', callback_data: 'c:' + id }, { text: '❌ Nu confirm', callback_data: 'n:' + id }]] });

/* a long answer in pieces, each cut at a blank line */
export function chunks(text, limit = MAX_LEN) {
  if (text.length <= limit) return [text];
  const out = []; let cur = '';
  for (const part of text.split('\n\n')) {
    if (cur && (cur + '\n\n' + part).length > limit) { out.push(cur); cur = part; } else cur = cur ? cur + '\n\n' + part : part;
    while (cur.length > limit) { out.push(cur.slice(0, limit)); cur = cur.slice(limit); }
  }
  if (cur) out.push(cur);
  return out;
}

const T = {
  linked: name => `✅ <b>Gata${name ? ', ' + esc(name) : ''}!</b> Contul tău Mathorizon e conectat la acest chat.\n\nCe fac pentru tine:\n• îți scriu când o grupă a ta e gata de start și te întreb dacă o confirmi;\n• îți arăt programul, grupele, salariul și înlocuirile când mă întrebi.\n\nÎncearcă /azi, /grupe sau /salariu. Toate comenzile: /ajutor. Oprești mesajele cu /stop.`,
  badCode: 'Codul nu mai e valabil (ține 15 minute) sau a fost deja folosit. Intră pe Mathorizon, la profilul tău, apasă „Conectează Telegram” și folosește linkul nou.',
  notLinked: 'Acest chat nu e conectat la un cont Mathorizon. Intră pe Mathorizon, la profilul tău, apasă „Conectează Telegram” și deschide linkul primit.',
  hello: name => `👋 Salut${name ? ', ' + esc(name) : ''}! Sunt asistentul Mathorizon.\nÎți arăt programul, grupele și salariul, iar când o grupă a ta e gata de start te întreb dacă o confirmi.\n\nScrie /ajutor sau folosește butoanele de jos.`,
  stopped: 'Am oprit mesajele și am șters legătura cu contul tău. O poți reface oricând din profilul tău de pe Mathorizon.',
  unknown: 'Nu am înțeles 🤔 Alege din butoanele de jos sau scrie /ajutor ca să vezi ce pot face.',
  already: 'Ai răspuns deja la această întrebare.',
  notYours: 'Întrebarea aceasta nu e pentru acest cont.',
  gone: 'Grupa nu mai e în starea de start, așa că nu mai ai nimic de confirmat.',
  askReason: 'Care e motivul? Scrie-l într-un singur mesaj și îl transmit managerului.',
  thanksReason: reason => `Mulțumesc 🙏 Am transmis motivul managerului:\n<i>${esc(reason)}</i>`,
  stillWaiting: 'ℹ️ Încă aștept motivul pentru care nu confirmi startul. Scrie-l într-un mesaj.',
  noGroup: 'Grupa nu mai există în registrul tău.',
  error: 'Nu am putut citi datele acum. Încearcă din nou peste un minut.'
};

/* ---------- a message or a button press from Telegram ---------- */

export async function handleUpdate(update, { db, api, now = new Date() }) {
  if (update && update.callback_query) return handleCallback(update.callback_query, { db, api, now });
  const m = update && update.message;
  if (!m || !m.chat || m.chat.type !== 'private' || typeof m.text !== 'string') return { handled: false };
  const chat = m.chat.id, text = m.text.trim();
  const say = (t, extra) => api.sendMessage(chat, t, extra);
  const sayAll = async (t, extra) => { const parts = chunks(t); for (let i = 0; i < parts.length; i++) await say(parts[i], i === parts.length - 1 ? extra : undefined); };

  const start = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9]{4,32}))?\s*$/i.exec(text);
  if (start) {
    if (start[1]) {
      const code = await db.consumeLinkCode(start[1].toUpperCase());
      if (!code) { await say(T.badCode); return { handled: true, linked: false }; }
      const u = await db.saveLink({ user_id: code.user_id, chat_id: chat, username: m.from && m.from.username || null, first_name: m.from && m.from.first_name || null });
      await say(T.linked(u && u.name || (m.from && m.from.first_name) || ''), { reply_markup: A.menuKeyboard() });
      return { handled: true, linked: true };
    }
    const u = await db.userByChat(chat);
    await say(u ? T.hello(u.name) : T.notLinked, u ? { reply_markup: A.menuKeyboard() } : undefined);
    return { handled: true };
  }
  if (/^\/stop(?:@\w+)?\s*$/i.test(text)) { await db.unlinkChat(chat); await say(T.stopped, { reply_markup: { remove_keyboard: true } }); return { handled: true, unlinked: true }; }

  const cmd = A.commandOf(text);
  if (cmd === 'ajutor') { await say(A.helpText, { reply_markup: A.menuKeyboard() }); return { handled: true, command: cmd }; }

  const user = await db.userByChat(chat);
  if (!user) { await say(T.notLinked); return { handled: true }; }
  const waiting = await db.awaitingReason(chat);
  if (waiting && !cmd && !text.startsWith('/')) {
    const reason = text.slice(0, 500);
    const done = await db.setRequest(waiting.id, { status: 'declined', reason, decided_at: now.toISOString() }, ['awaiting_reason']);
    if (done) { await say(T.thanksReason(reason)); return { handled: true, declined: true, request: waiting.id }; }
  }

  if (cmd) {
    try {
      if (cmd === 'reguli') await say(A.rulesIntro, { reply_markup: A.rulesKeyboard() });
      else {
        const view = await db.teacherView(user.user_id);
        if (cmd === 'meet') await say(A.meetText(view));
        else if (!A.hasRegister(view)) await say(A.NO_REGISTER);
        else if (cmd === 'azi') await sayAll(A.dayText(view, now, 0));
        else if (cmd === 'maine') await sayAll(A.dayText(view, now, 1));
        else if (cmd === 'saptamana') await sayAll(A.weekText(view, now));
        else if (cmd === 'grupe') await sayAll(A.groupsText(view), { reply_markup: A.groupsKeyboard(view) });
        else if (cmd === 'salariu') await say(A.salaryText(view, now));
        else if (cmd === 'statistici') await say(A.statsText(view, now));
        else if (cmd === 'inlocuiri') await sayAll(A.replacementsText(view, now));
      }
    } catch (e) { await say(T.error); return { handled: true, command: cmd, failed: true }; }
    if (waiting) await say(T.stillWaiting);
    return { handled: true, command: cmd };
  }
  await say(T.unknown, { reply_markup: A.menuKeyboard() });
  return { handled: true };
}

async function handleCallback(cb, { db, api, now }) {
  const chat = cb.message && cb.message.chat && cb.message.chat.id, msgId = cb.message && cb.message.message_id;
  const answer = (t) => api.answerCallbackQuery(cb.id, t);
  const data = String(cb.data || '');

  // the groups, the rules: the message itself changes, the chat stays clean
  const nav = /^(g:[0-9a-f-]{36}|gl|r:(?:start|status|marks|schedule))$/.exec(data);
  if (nav && chat) {
    const user = await db.userByChat(chat);
    if (!user) { await answer(T.notYours); return { handled: true }; }
    const edit = (text, markup) => msgId ? api.editMessageText(chat, msgId, text, { reply_markup: markup }).catch(() => {}) : null;
    if (data.startsWith('r:')) { await answer(''); await edit(A.RULES[data.slice(2)], A.rulesKeyboard()); return { handled: true, navigated: data }; }
    let view;
    try { view = await db.teacherView(user.user_id); } catch (e) { await answer(T.error); return { handled: true, failed: true }; }
    if (data === 'gl') { await answer(''); await edit(A.groupsText(view), A.groupsKeyboard(view)); return { handled: true, navigated: data }; }
    const card = A.groupCard(view, data.slice(2), now);
    if (!card) { await answer(T.noGroup); return { handled: true }; }
    await answer(''); await edit(card, A.backKeyboard);
    return { handled: true, navigated: data };
  }

  const d = /^([cn]):([0-9a-f-]{36})$/.exec(data);
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
    if (msgId) await api.editMessageText(chat, msgId, A.confirmedText(r, now), { reply_markup: { inline_keyboard: [] } }).catch(() => {});
    return { handled: true, confirmed: true, request: r.id };
  }
  const upd = await db.setRequest(r.id, { status: 'awaiting_reason' }, ['pending']);
  if (!upd) { await answer(T.already); return { handled: true, already: true }; }
  await answer('');
  if (msgId) await api.editMessageText(chat, msgId, A.declinedText(r), { reply_markup: { inline_keyboard: [] } }).catch(() => {});
  await api.sendMessage(chat, T.askReason, { reply_markup: { force_reply: true, input_field_placeholder: 'Motivul' } });
  return { handled: true, askedReason: true, request: r.id };
}

const isStarting = state => ['startează', 'starteaza'].includes(String(state || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()) || String(state || '').toLowerCase().trim() === 'startează';

/* ---------- the questions waiting to be sent ---------- */

/* db.dueRequests() -> [{ request, groupState, students: [{ name, status }], chat }] for the requests with status pending that were never sent (chat null: the teacher is not tied). */
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
      const sent = await api.sendMessage(x.chat, A.askText(r, counts, x.students, now), { reply_markup: askKeyboard(r.id) });
      await db.setRequest(r.id, { notified_at: now.toISOString(), telegram_chat_id: x.chat, telegram_message_id: sent && sent.message_id || null, enrolled: counts.enrolled, need: counts.need, notify_error: null }, ['pending']);
      out.sent++;
    } catch (e) {
      await db.setRequest(r.id, { notify_attempts: (r.notify_attempts || 0) + 1, notify_error: String(e && e.message || e).slice(0, 200) }, ['pending']);
      out.failed++;
    }
  }
  return out;
}
