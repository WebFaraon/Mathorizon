/* Checks of the Telegram bot's conversation, with a database and a Telegram held in memory (no network, no token).
   Run: npm run check:telegram */
'use strict';
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; if (fails.length < 25) fails.push(m); } };

/* a database in memory with the same methods the Edge Function gives the bot */
function memDb() {
  const s = { codes: new Map(), links: new Map(), requests: new Map(), groups: new Map(), students: new Map(), owners: new Map(), names: new Map() };
  return {
    s,
    async consumeLinkCode(code) { const c = s.codes.get(code); if (!c || c.expires < Date.now()) return null; s.codes.delete(code); return { user_id: c.user_id }; },
    async saveLink(l) { for (const [u, x] of s.links) if (x.chat_id === l.chat_id && u !== l.user_id) s.links.delete(u); s.links.set(l.user_id, l); return { name: s.names.get(l.user_id) || '' }; },
    async userByChat(chat) { for (const [u, x] of s.links) if (x.chat_id === chat) return { user_id: u, name: s.names.get(u) || '' }; return null; },
    async unlinkChat(chat) { for (const [u, x] of s.links) if (x.chat_id === chat) s.links.delete(u); },
    async request(id) { return s.requests.get(id) || null; },
    async groupState(r) { return (s.groups.get(r.group_id) || {}).state || null; },
    async setRequest(id, patch, allowed) { const r = s.requests.get(id); if (!r || !allowed.includes(r.status)) return null; Object.assign(r, patch); return r; },
    async awaitingReason(chat) { return [...s.requests.values()].filter(r => r.status === 'awaiting_reason' && r.telegram_chat_id === chat).pop() || null; },
    async dueRequests() {
      return [...s.requests.values()].filter(r => r.status === 'pending' && !r.notified_at && (r.notify_attempts || 0) < 3).map(r => {
        const g = s.groups.get(r.group_id) || {}, owner = s.owners.get(r.workbook_id), link = owner && s.links.get(owner);
        return { request: r, groupState: g.state, students: s.students.get(r.group_id) || [], chat: link ? link.chat_id : null };
      });
    }
  };
}
function fakeApi(opts) {
  const log = [];
  let n = 100;
  return {
    log,
    async sendMessage(chat, text, extra) { if (opts && opts.fail) throw new Error('Forbidden: bot was blocked by the user'); log.push({ m: 'send', chat, text, extra }); return { message_id: ++n }; },
    async editMessageText(chat, id, text, extra) { log.push({ m: 'edit', chat, id, text, extra }); return {}; },
    async answerCallbackQuery(id, text) { log.push({ m: 'answer', id, text }); return {}; }
  };
}

(async () => {
  const bot = await import('../supabase/functions/_shared/telegram/bot.mjs');
  const { handleUpdate, dispatch, canWrite, localHour, whenText, gradeText, esc, askText } = bot;

  // ---- pure helpers ----
  ok(whenText([{ day: 1, hour: 12 }, { day: 4, hour: 12 }]) === 'luni și joi, 12:00 - 13:00', 'two days, one hour: ' + whenText([{ day: 1, hour: 12 }, { day: 4, hour: 12 }]));
  ok(whenText([{ day: 3, hour: 15 }, { day: 3, hour: 16 }]) === 'miercuri, 15:00 - 17:00', 'one day, two hours: ' + whenText([{ day: 3, hour: 15 }, { day: 3, hour: 16 }]));
  ok(whenText([{ day: 1, hour: 9 }, { day: 3, hour: 9 }, { day: 5, hour: 9 }]) === 'luni, miercuri și vineri, 09:00 - 10:00', 'three days');
  ok(whenText([]) === '' && whenText(null) === '' && whenText([{ day: 9, hour: 3 }, { day: 'x' }]) === '', 'no schedule, no text');
  ok(gradeText('XII') === 'clasa a 12-a' && gradeText('III') === 'clasa a 3-a' && gradeText('') === '' && gradeText('Pregătitoare') === 'clasa Pregătitoare', 'grade text');
  ok(esc('<b>&"x"</b>') === '&lt;b&gt;&amp;"x"&lt;/b&gt;', 'html escaped');
  // 08:00 to 21:00 Chisinau: winter UTC+2, summer UTC+3
  ok(canWrite(new Date('2026-11-02T06:00:00Z')) && !canWrite(new Date('2026-11-02T05:59:00Z')) && canWrite(new Date('2026-11-02T18:59:00Z')) && !canWrite(new Date('2026-11-02T19:00:00Z')), 'winter: writes from 08:00 to 20:59 local');
  ok(canWrite(new Date('2026-07-06T05:00:00Z')) && !canWrite(new Date('2026-07-06T04:59:00Z')) && !canWrite(new Date('2026-07-06T18:00:00Z')), 'summer: the same wall clock (UTC+3)');
  ok(localHour(new Date('2026-11-02T22:30:00Z')) === 0, 'midnight is hour 0, not 24');

  const now = new Date('2026-11-02T10:00:00Z');                         // 12:00 in Chisinau: the bot may write
  const REQ = '11111111-1111-4111-8111-111111111111', REQ2 = '22222222-2222-4222-8222-222222222222';
  const TEACH = 'u-teacher', CHAT = 555;
  const world = () => {
    const db = memDb(), api = fakeApi();
    db.s.names.set(TEACH, 'Ana Profesor');
    db.s.owners.set('wb1', TEACH);
    db.s.groups.set('g1', { state: 'Startează' });
    db.s.students.set('g1', [{ status: 'Activ' }, { status: 'Oră de probă' }, { status: 'Oră de probă' }, { status: 'Inactiv' }]);
    db.s.requests.set(REQ, { id: REQ, group_id: 'g1', workbook_id: 'wb1', status: 'pending', subject: 'Matematica', grade: 'XII', schedule: [{ day: 1, hour: 12 }], format_size: 6, notify_attempts: 0 });
    return { db, api };
  };
  const msg = (chat, text) => ({ message: { message_id: 1, chat: { id: chat, type: 'private' }, from: { id: chat, first_name: 'Ana', username: 'ana' }, text } });
  const press = (chat, data, messageId) => ({ callback_query: { id: 'cb1', from: { id: chat }, message: { message_id: messageId || 101, chat: { id: chat } }, data } });
  const last = api => api.log.filter(x => x.m === 'send').pop();

  // ---- an unlinked teacher is not written to; the request waits ----
  {
    const { db, api } = world();
    const r = await dispatch({ db, api, now });
    ok(r.sent === 0 && r.noChat === 1 && api.log.length === 0 && db.s.requests.get(REQ).notified_at == null, 'no Telegram tied: nothing sent, the request stays pending for the manager: ' + JSON.stringify(r));
  }
  // ---- linking with a code ----
  {
    const { db, api } = world();
    db.s.codes.set('ABCD2345', { user_id: TEACH, expires: Date.now() + 60000 });
    await handleUpdate(msg(CHAT, '/start abcd2345'), { db, api, now });
    ok(db.s.links.get(TEACH) && db.s.links.get(TEACH).chat_id === CHAT && !db.s.codes.has('ABCD2345'), 'the code ties the account to the chat, once');
    ok(/Ana Profesor/.test(last(api).text) && /conectat/.test(last(api).text), 'the bot says who is connected: ' + last(api).text);
    await handleUpdate(msg(777, '/start ABCD2345'), { db, api, now });
    ok(db.s.links.get(TEACH).chat_id === CHAT && /nu mai e valabil/.test(last(api).text), 'a used code does nothing');
    db.s.codes.set('OLDCODE9', { user_id: TEACH, expires: Date.now() - 1 });
    await handleUpdate(msg(888, '/start OLDCODE9'), { db, api, now });
    ok(db.s.links.get(TEACH).chat_id === CHAT && /nu mai e valabil/.test(last(api).text), 'an expired code does nothing');
    await handleUpdate(msg(999, '/start'), { db, api, now });
    ok(/nu e conectat/.test(last(api).text), '/start from an unknown chat explains how to connect');
    await handleUpdate(msg(999, 'salut'), { db, api, now });
    ok(/nu e conectat/.test(last(api).text), 'text from an unknown chat: how to connect');
    // a second account taking the same chat frees the first one
    db.s.codes.set('SECOND22', { user_id: 'u-other', expires: Date.now() + 60000 });
    await handleUpdate(msg(CHAT, '/start SECOND22'), { db, api, now });
    ok(!db.s.links.has(TEACH) && db.s.links.get('u-other').chat_id === CHAT, 'a chat belongs to one account at a time');
  }
  // ---- the question, the confirmation ----
  {
    const { db, api } = world();
    db.s.links.set(TEACH, { chat_id: CHAT });
    const r = await dispatch({ db, api, now });
    const q = last(api);
    ok(r.sent === 1 && q.chat === CHAT && /gata de start/.test(q.text) && /Matematica, clasa a 12-a/.test(q.text) && /luni, 12:00 - 13:00/.test(q.text) && /3 elevi înscriși din 6/.test(q.text) && /minimul pentru start e 4/.test(q.text) && /Confirmi startul/.test(q.text), 'the question names the group, the time and the students: ' + q.text);
    ok(q.extra.reply_markup.inline_keyboard[0].length === 2 && q.extra.reply_markup.inline_keyboard[0][0].callback_data === 'c:' + REQ && q.extra.reply_markup.inline_keyboard[0][1].callback_data === 'n:' + REQ, 'two buttons: confirm and do not confirm');
    const rq = db.s.requests.get(REQ);
    ok(rq.notified_at && rq.telegram_chat_id === CHAT && rq.telegram_message_id === 101 && rq.enrolled === 3 && rq.need === 4, 'the request remembers when, where and with how many students it was asked');
    ok((await dispatch({ db, api, now })).sent === 0, 'the same question is never sent twice');
    // the confirmation
    const c = await handleUpdate(press(CHAT, 'c:' + REQ), { db, api, now });
    ok(c.confirmed && db.s.requests.get(REQ).status === 'confirmed' && db.s.requests.get(REQ).decided_at === now.toISOString(), 'confirm: status confirmed with the time');
    ok(api.log.some(x => x.m === 'edit' && /Ai confirmat startul/.test(x.text) && x.extra.reply_markup.inline_keyboard.length === 0), 'the question is replaced by the confirmation, without buttons');
    const again = await handleUpdate(press(CHAT, 'c:' + REQ), { db, api, now });
    ok(again.already && api.log.filter(x => x.m === 'answer').pop().text === 'Ai răspuns deja la această întrebare.', 'pressing again is answered, not repeated');
    await handleUpdate(press(CHAT, 'n:' + REQ), { db, api, now });
    ok(db.s.requests.get(REQ).status === 'confirmed', 'a late "do not confirm" cannot undo a confirmation');
  }
  // ---- "do not confirm" and the reason ----
  {
    const { db, api } = world();
    db.s.links.set(TEACH, { chat_id: CHAT });
    await dispatch({ db, api, now });
    const n = await handleUpdate(press(CHAT, 'n:' + REQ), { db, api, now });
    ok(n.askedReason && db.s.requests.get(REQ).status === 'awaiting_reason', 'do not confirm: the bot asks for the reason');
    ok(last(api).extra.reply_markup.force_reply === true && /motivul/i.test(last(api).text), 'the prompt is a reply prompt: ' + last(api).text);
    const rs = await handleUpdate(msg(CHAT, 'Doi dintre elevi au plecat in vacanta pana la 15.'), { db, api, now });
    const rq = db.s.requests.get(REQ);
    ok(rs.declined && rq.status === 'declined' && rq.reason === 'Doi dintre elevi au plecat in vacanta pana la 15.' && rq.decided_at, 'the next message is the reason: declined, with the text');
    ok(/Am transmis motivul/.test(last(api).text), 'the teacher is thanked');
    await handleUpdate(msg(CHAT, 'alt mesaj'), { db, api, now });
    ok(db.s.requests.get(REQ).reason === 'Doi dintre elevi au plecat in vacanta pana la 15.' && /nicio întrebare deschisă/.test(last(api).text), 'a later message does not change the reason');
    // a very long reason is cut
    const w2 = world(); w2.db.s.links.set(TEACH, { chat_id: CHAT }); await dispatch({ db: w2.db, api: w2.api, now });
    await handleUpdate(press(CHAT, 'n:' + REQ), { db: w2.db, api: w2.api, now }); await handleUpdate(msg(CHAT, 'x'.repeat(2000)), { db: w2.db, api: w2.api, now });
    ok(w2.db.s.requests.get(REQ).reason.length === 500, 'the reason is kept to 500 characters');
  }
  // ---- somebody else's chat can not answer ----
  {
    const { db, api } = world();
    db.s.links.set(TEACH, { chat_id: CHAT });
    db.s.links.set('u-intruder', { chat_id: 666 });
    await dispatch({ db, api, now });
    const x = await handleUpdate(press(666, 'c:' + REQ), { db, api, now });
    ok(x.handled && db.s.requests.get(REQ).status === 'pending' && api.log.filter(a => a.m === 'answer').pop().text === 'Întrebarea aceasta nu e pentru acest cont.', 'another teacher\'s chat can not answer this question');
    await handleUpdate(press(12345, 'c:' + REQ), { db, api, now });
    ok(db.s.requests.get(REQ).status === 'pending', 'an unknown chat can not answer');
    await handleUpdate(press(CHAT, 'c:not-a-uuid'), { db, api, now });
    await handleUpdate(press(CHAT, 'x:' + REQ), { db, api, now });
    await handleUpdate(press(CHAT, 'c:' + REQ + 'zz'), { db, api, now });
    ok(db.s.requests.get(REQ).status === 'pending', 'malformed buttons do nothing');
  }
  // ---- the group changed meanwhile ----
  {
    const { db, api } = world();
    db.s.links.set(TEACH, { chat_id: CHAT });
    db.s.groups.set('g1', { state: 'Activ' });
    const r = await dispatch({ db, api, now });
    ok(r.cancelled === 1 && r.sent === 0 && db.s.requests.get(REQ).status === 'cancelled', 'a group that is no longer starting is not asked about: cancelled');
    const w = world(); w.db.s.links.set(TEACH, { chat_id: CHAT }); await dispatch({ db: w.db, api: w.api, now });
    w.db.s.groups.set('g1', { state: 'Activ' });
    const c = await handleUpdate(press(CHAT, 'c:' + REQ), { db: w.db, api: w.api, now });
    ok(c.cancelled && w.db.s.requests.get(REQ).status === 'cancelled' && /nu mai ai nimic de confirmat/.test(w.api.log.filter(a => a.m === 'answer').pop().text), 'answering after the manager changed the status: cancelled, the teacher is told');
  }
  // ---- the night, a blocked bot ----
  {
    const { db, api } = world();
    db.s.links.set(TEACH, { chat_id: CHAT });
    const night = await dispatch({ db, api, now: new Date('2026-11-02T19:30:00Z') });
    ok(night.night && api.log.length === 0 && db.s.requests.get(REQ).notified_at == null, 'at 21:30 local nothing is sent; the request waits for the morning');
    const morning = await dispatch({ db, api, now: new Date('2026-11-03T06:05:00Z') });
    ok(morning.sent === 1, 'at 08:05 local it is sent');
  }
  {
    const { db } = world(); db.s.links.set(TEACH, { chat_id: CHAT });
    const bad = fakeApi({ fail: true });
    for (let i = 0; i < 4; i++) await dispatch({ db, api: bad, now });
    const rq = db.s.requests.get(REQ);
    ok(rq.notify_attempts === 3 && /blocked/.test(rq.notify_error) && rq.status === 'pending', 'a blocked bot is tried 3 times, then left for the manager with the error: attempts ' + rq.notify_attempts);
  }
  // ---- /stop and help ----
  {
    const { db, api } = world(); db.s.links.set(TEACH, { chat_id: CHAT });
    await handleUpdate(msg(CHAT, '/ajutor'), { db, api, now });
    ok(/\/stop/.test(last(api).text), 'help mentions /stop');
    await handleUpdate(msg(CHAT, '/stop'), { db, api, now });
    ok(!db.s.links.has(TEACH) && /legătura/.test(last(api).text), '/stop unties the account');
    ok((await handleUpdate({ message: { chat: { id: -100, type: 'group' }, text: '/start' } }, { db, api, now })).handled === false, 'groups are ignored');
    ok((await handleUpdate({}, { db, api, now })).handled === false && (await handleUpdate(null, { db, api, now })).handled === false, 'empty updates are ignored');
  }
  // ---- the text escapes what a register can hold ----
  {
    const t = askText({ subject: 'Mate <b>x</b> & Co', grade: 'XII', schedule: [] }, { enrolled: 1, need: 2, size: 3 });
    ok(!/<b>x<\/b>/.test(t) && /Mate &lt;b&gt;x&lt;\/b&gt; &amp; Co/.test(t) && /1 elev înscris din 3/.test(t), 'a subject with markup can not inject formatting: ' + t);
  }

  console.log(`TELEGRAM: ${pass} checks passed, ${fail} failed`);
  if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();
