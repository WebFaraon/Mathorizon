/* Checks of the Telegram bot's conversation, with a database and a Telegram held in memory (no network, no token).
   Run: npm run check:telegram */
'use strict';
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; if (fails.length < 25) fails.push(m); } };

/* a database in memory with the same methods the Edge Function gives the bot */
function memDb() {
  const s = { codes: new Map(), links: new Map(), requests: new Map(), groups: new Map(), students: new Map(), owners: new Map(), names: new Map(), views: new Map() };
  return {
    s,
    async consumeLinkCode(code) { const c = s.codes.get(code); if (!c || c.expires < Date.now()) return null; s.codes.delete(code); return { user_id: c.user_id }; },
    async saveLink(l) { for (const [u, x] of s.links) if (x.chat_id === l.chat_id && u !== l.user_id) s.links.delete(u); s.links.set(l.user_id, l); return { name: s.names.get(l.user_id) || '' }; },
    async userByChat(chat) { for (const [u, x] of s.links) if (x.chat_id === chat) return { user_id: u, name: s.names.get(u) || '' }; return null; },
    async unlinkChat(chat) { for (const [u, x] of s.links) if (x.chat_id === chat) s.links.delete(u); },
    async teacherView(userId) { if (s.viewFails) throw new Error('db down'); return s.views.get(userId) || { workbooks: [], groups: [], students: [], lessons: [], replacements: [] }; },
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
  const { handleUpdate, dispatch, canWrite, localHour, whenText, gradeText, esc, askText, chunks } = bot;
  const A = await import('../supabase/functions/_shared/telegram/assistant.mjs');

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
    ok(db.s.requests.get(REQ).reason === 'Doi dintre elevi au plecat in vacanta pana la 15.' && /Nu am înțeles/.test(last(api).text), 'a later message does not change the reason');
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
    ok(/\/stop/.test(last(api).text) && /\/azi/.test(last(api).text) && /\/salariu/.test(last(api).text) && last(api).extra.reply_markup.keyboard.length === 3, 'help lists the commands and shows the menu keys');
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


  // ================= the assistant =================
  const G = n => '00000000-0000-4000-8000-0000000000' + n;              // group ids that fit the callback pattern
  const TD = { salaryDue: 1500.5, paidTotal: 8200, earnedTotal: 9700.5, meet: 'https://meet.google.com/abc-defg-hij', payments: [{ dateText: '10.10.2026', iso: '2026-10-10', sum: 4000 }, { dateText: '10.09.2026', iso: '2026-09-10', sum: 4200 }, { dateText: '10.08.2026', iso: '2026-08-10', sum: 0 }] };
  const sched = (...rows) => rows.map(([day, hour, cabinet]) => ({ day, hour, cabinet: cabinet || '' }));
  const view = () => ({
    workbooks: [{ id: 'wb1', teacher_name: 'Ana Profesor', teacher_data: TD, last_synced_at: '2026-11-02T09:50:00Z' }],
    groups: [
      { id: G('a1'), workbook_id: 'wb1', sheet_id: 1, tab: 'Luni 12', format_size: 6, state: 'Activ', subject: 'Matematica', grade: 'XII', level: '5-6', profile: 'Real', mode: 'offline', schedule: sched([1, 12, '12'], [4, 12, '12']) },
      { id: G('a2'), workbook_id: 'wb1', sheet_id: 2, tab: 'Marti 15', format_size: 4, state: 'Activ', subject: 'Fizica', grade: 'IX', level: '7-8', profile: '', mode: 'online', schedule: sched([2, 15], [2, 16]) },
      { id: G('a3'), workbook_id: 'wb1', sheet_id: 3, tab: 'Luni 14', format_size: 6, state: 'Se completează', subject: 'Matematica', grade: 'VIII', level: '4-5', profile: '', mode: 'offline', schedule: sched([1, 14, '3']) },
      { id: G('a4'), workbook_id: 'wb1', sheet_id: 4, tab: 'Vineri 9', format_size: 3, state: 'Startează', subject: 'Matematica', grade: 'V', level: '3-4', profile: '', mode: 'offline', schedule: sched([5, 9, '7']) },
      { id: G('a5'), workbook_id: 'wb1', sheet_id: 5, tab: 'Sambata', format_size: 4, state: 'Inactiv', subject: 'Chimie', grade: 'X', level: '', profile: '', mode: 'offline', schedule: sched([6, 10]) },
      { id: G('a6'), workbook_id: 'wb1', sheet_id: 6, tab: 'Inlocuire', format_size: 4, state: 'Înlocuire', subject: 'Matematica', grade: 'VII', level: '', profile: '', mode: 'offline', schedule: sched([3, 10, '5']) }
    ],
    students: [
      { group_id: G('a1'), name: 'Popescu Ion', status: 'Activ' }, { group_id: G('a1'), name: 'Ionescu <b>Ana</b>', status: 'Activ' }, { group_id: G('a1'), name: 'Vieru Maria', status: 'Oră de probă' },
      { group_id: G('a1'), name: 'Plecat Elev', status: 'Inactiv' }, { group_id: G('a1'), name: 'Mutat Elev', status: 'Transferat' },
      { group_id: G('a2'), name: 'Rusu Dan', status: 'Activ' },
      { group_id: G('a3'), name: 'Nou Unu', status: 'Activ' }, { group_id: G('a3'), name: 'Nou Doi', status: 'Oră de probă confirmată' },
      { group_id: G('a4'), name: 'Start Unu', status: 'Oră de probă' }
    ],
    lessons: [
      { group_id: G('a1'), iso: '2026-10-26', topic: 'Limite', marks: { D: 'P', E: 'P', F: 'G' } },
      { group_id: G('a1'), iso: '2026-10-29', topic: 'Derivate', marks: { D: 'P', E: 'A' } },
      { group_id: G('a1'), iso: '2026-11-02', topic: 'Integrale', marks: { D: 'P' } },
      { group_id: G('a1'), iso: '2026-09-28', topic: 'Funcții', marks: { D: 'P', E: 'M' } },
      { group_id: G('a1'), iso: '2026-10-30', topic: 'Fără prezențe', marks: {} },
      { group_id: G('a1'), iso: '2026-10-31', topic: '', marks: { D: 'P' } },
      { group_id: G('a1'), iso: '2026-12-01', topic: 'Planificată', marks: {} },
      { group_id: G('a2'), iso: '2026-10-27', topic: 'Cinematică', marks: { D: 'P' } }
    ],
    replacements: [
      { id: 'r1', status: 'active', orig_workbook: 'wb1', orig_sheet: 1, repl_workbook: 'wbX', repl_sheet: 90, dates: [{ iso: '2026-11-02', start: 12, duration: 1, cabinet: '12' }, { iso: '2026-11-05', start: 12, duration: 1, cabinet: '12' }, { iso: '2026-10-29', start: 12, duration: 1 }, { iso: '2026-11-09', start: 12, duration: 1, cancelled: true }], orig: { subject: 'Matematica', grade: 'XII' }, origTeacher: 'Ana Profesor', replTeacher: 'Bogdan Altul' },
      { id: 'r2', status: 'active', orig_workbook: 'wbY', orig_sheet: 70, repl_workbook: 'wb1', repl_sheet: 6, dates: [{ iso: '2026-11-03', start: 10, duration: 1, cabinet: '5' }], orig: { subject: 'Matematica', grade: 'VII' }, origTeacher: 'Carmen Colega', replTeacher: 'Ana Profesor' }
    ]
  });
  const tw = () => { const w = world(); w.db.s.links.set(TEACH, { chat_id: CHAT }); w.db.s.views.set(TEACH, view()); return w; };
  const msg2 = (text) => ({ message: { message_id: 1, chat: { id: CHAT, type: 'private' }, from: { id: CHAT, first_name: 'Ana' }, text } });
  const press2 = (data, messageId) => ({ callback_query: { id: 'cb9', from: { id: CHAT }, message: { message_id: messageId || 301, chat: { id: CHAT } }, data } });
  const lastText = api => api.log.filter(x => x.m === 'send').pop().text;

  // ---- the clock and the schedules ----
  {
    const t = A.localNow(new Date('2026-11-02T22:30:00Z'));
    ok(t.iso === '2026-11-03' && t.dow === 2 && t.minutes === 30, 'after midnight in Chisinau it is already the next day: ' + JSON.stringify(t));
    ok(A.addDays('2026-11-30', 1) === '2026-12-01' && A.dowOf('2026-11-02') === 1 && A.dowOf('2026-11-08') === 7, 'dates and weekdays');
    ok(A.dayName('2026-11-02', '2026-11-02') === 'azi, luni, 2 noiembrie' && A.dayName('2026-11-03', '2026-11-02') === 'mâine, marți, 3 noiembrie' && A.dayName('2026-11-05', '2026-11-02') === 'joi, 5 noiembrie', 'day names');
    const s2 = A.slotsOf(sched([2, 15, '4'], [2, 16], [4, 9], [4, 11]));
    ok(s2.length === 3 && s2[0].start === 15 && s2[0].end === 17 && s2[0].cabinet === '4' && s2[1].end === 10 && s2[2].start === 11, 'consecutive hours are one lesson, a gap is another');
    ok(A.slotsOf(null).length === 0 && A.slotsOf([{ day: 9, hour: 1 }]).length === 0, 'no schedule');
    ok(A.commandOf('📅 Azi') === 'azi' && A.commandOf('/Maine') === 'maine' && A.commandOf('👥 Grupele mele') === 'grupe' && A.commandOf('/saptamana@MathorizonBot') === 'saptamana' && A.commandOf('❓ Ajutor') === 'ajutor' && A.commandOf('/salariu') === 'salariu' && A.commandOf('Mâine') === 'maine' && A.commandOf('blabla') === null && A.commandOf('') === null, 'commands, with or without the slash and the emoji');
  }
  // ---- today, tomorrow ----
  {
    const v = view();
    const today = A.dayText(v, now, 0);
    ok(/Azi, luni, 2 noiembrie/.test(today) && /nu ai lecții/.test(today), 'Monday: his only lesson is replaced, so he teaches nothing: ' + today.slice(0, 120));
    ok(/Înlocuite/.test(today) && /12:00/.test(today) && /de către Bogdan Altul/.test(today), 'the replaced lesson says who takes it');
    ok(/Se completează/.test(today) === false && /nu a pornit încă/.test(today) && /Matematica, clasa a 8-a \(14:00\)/.test(today), 'a group that is still filling up has no lesson yet, said in one line');
    ok(/Următoarea lecție: <b>mâine, marți, 3 noiembrie, 10:00<\/b>/.test(today), 'with nothing today, the next lesson is named: ' + today.slice(-160));
    const tom = A.dayText(v, now, 1);
    ok(/Mâine, marți, 3 noiembrie<\/b> · 2 lecții/.test(tom), 'Tuesday: two lessons: ' + tom.slice(0, 100));
    ok(tom.indexOf('10:00 – 11:00') < tom.indexOf('15:00 – 17:00'), 'sorted by the hour');
    ok(/Înlocuiești grupa lui Carmen Colega/.test(tom) && /Cabinet 5/.test(tom) && /Matematica, clasa a 7-a/.test(tom), 'the substitute lesson: whose group, which cabinet');
    ok(/Fizica, clasa a 9-a · nivel 7-8/.test(tom) && /Online · <a href="https:\/\/meet\.google\.com\/abc-defg-hij">Intră în Meet<\/a>/.test(tom) && /1 elev/.test(tom), 'an online lesson shows the Meet link and the number of students');
    const fri = A.dayText(v, now, 4);
    ok(/Vineri/.test(fri) && /Cabinet 7/.test(fri) && /Grupă care pornește/.test(fri) && /1 elev \(1 la ora de probă\)/.test(fri), 'a starting group says the trial lesson is next: ' + fri);
    const thu = A.dayText(v, now, 3);
    ok(/Joi, 5 noiembrie/.test(thu) && /Înlocuite/.test(thu) && /nu ai lecții/.test(thu), 'a replacement on another day');
    const mon = A.dayText(v, now, 7);
    ok(/Luni, 9 noiembrie<\/b> · 1 lecție/.test(mon) && /Cabinet 12/.test(mon) && /3 elevi \(1 la ora de probă\)/.test(mon) && !/Plecat Elev|Mutat/.test(mon), 'the next Monday: the cancelled replacement does not count; the left students are not counted: ' + mon);
    ok(/Ionescu &lt;b&gt;Ana/.test(A.groupCard(v, G('a1'), now)) && !/<b>Ana<\/b>/.test(A.groupCard(v, G('a1'), now)), 'a name with markup is escaped');
    ok(/nu ai lecții/.test(A.dayText({ workbooks: [{ id: 'w' }], groups: [], students: [], lessons: [], replacements: [] }, now, 0)), 'a register with no groups: no lessons, no crash');
  }
  // ---- the week ----
  {
    const w = A.weekText(view(), now);
    ok(/Următoarele 7 zile<\/b> · 3 lecții/.test(w), 'the week counts the lessons he teaches: ' + w.slice(0, 80));
    ok(/<s>12:00 · Matematica, clasa a 12-a<\/s> · înlocuită de Bogdan Altul/.test(w) && /10:00–11:00 · Matematica, clasa a 7-a · cab\. 5 · înlocuire/.test(w) && /15:00–17:00 · Fizica, clasa a 9-a · Online/.test(w), 'replaced and substitute lessons are marked: ' + w);
    ok(/🌿/.test(A.weekText({ workbooks: [{ id: 'w' }], groups: [], students: [], lessons: [], replacements: [] }, now)), 'an empty week');
  }
  // ---- the groups ----
  {
    const v = view(), g = A.groupsText(v);
    ok(/Grupele tale<\/b> · 5/.test(g) && !/Înlocuire|clasa a 7-a/.test(g.replace(/Înlocuire/g, '')), 'the replacement tab is not a group of his: ' + g.slice(0, 60));
    ok(/Se completează<\/b> · 1/.test(g) && /mai trebuie 2 elevi ca să pornească \(minimul e 4 din 6\)/.test(g), 'a group that fills up says how many students it still needs');
    ok(/Pornesc<\/b> · 1/.test(g) && /Inactive<\/b> · 1/.test(g) && /luni și joi, 12:00 - 13:00 · 3 elevi \(1 la ora de probă\) din 6/.test(g), 'states, schedule and seats');
    const k = A.groupsKeyboard(v).inline_keyboard;
    ok(k.length === 4 && k[0][0].callback_data === 'g:' + G('a1') && /Matematica XII · lu 12:00/.test(k[0][0].text) && !k.some(r => r[0].callback_data === 'g:' + G('a5')), 'a button for every group that is not inactive, none for the inactive one');
    const c = A.groupCard(v, G('a1'), now);
    ok(/Matematica, clasa a 12-a<\/b>/.test(c) && /nivel 5-6 · profil real · la cabinet/.test(c) && /Activă/.test(c) && /Cabinet 12/.test(c), 'the card: name, level, state, place');
    ok(/1\. Popescu Ion · activ/.test(c) && /3\. Vieru Maria · oră de probă/.test(c) && /\+ 2 elevi plecați sau transferați/.test(c) && /3 locuri ocupate din 6/.test(c), 'the card lists the students that count');
    ok(/4 lecții predate · ultima: luni, 2 noiembrie/.test(c) && /Următoarea lecție: <b>joi, 5 noiembrie, 12:00<\/b>/.test(c), 'lessons given and the next one: ' + c.slice(-200));
    ok(/Mai trebuie|mai trebuie 2 elevi/.test(A.groupCard(v, G('a3'), now)) && /prima lecție, cea de probă/.test(A.groupCard(v, G('a4'), now)), 'the card of a filling group and of a starting group');
    ok(A.groupCard(v, G('a6'), now) === null && A.groupCard(v, 'zz', now) === null, 'no card for a replacement tab or an unknown group');
    ok(/Nu am găsit nicio grupă/.test(A.groupsText({ workbooks: [{ id: 'w' }], groups: [], students: [] })), 'no groups');
  }
  // ---- pay and numbers ----
  {
    const s1 = A.salaryText(view(), now);
    ok(/Câștigat în total: <b>9[.\s\u00a0]?700,5 lei<\/b>/.test(s1) && /Achitat până acum: <b>8[.\s\u00a0]?200 lei<\/b>/.test(s1) && /De primit: <b>1[.\s\u00a0]?500,5 lei<\/b>/.test(s1), 'the three numbers of the register: ' + s1);
    ok(/10\.10\.2026 · 4[.\s\u00a0]?000 lei/.test(s1) && /10\.09\.2026/.test(s1) && !/10\.08\.2026/.test(s1) && /citită acum 10 minute/.test(s1), 'the last payments (an empty one is skipped) and how fresh the numbers are');
    ok(/Nu am găsit cifrele/.test(A.salaryText({ workbooks: [{ id: 'w', teacher_data: {} }] }, now)), 'a register without the numbers says so');
    const st = A.statsText(view(), now);
    ok(/Lecții predate în noiembrie: <b>1<\/b>/.test(st) && /Lecții predate în total: <b>5<\/b>/.test(st), 'lessons this month and in total (a lesson needs a date, a topic and a mark): ' + st);
    ok(/Elevi prezenți pe lecție, în medie: <b>1,4<\/b>/.test(st), 'average of students present: ' + st);
    ok(/Grupe: <b>5<\/b> \(3 active\)/.test(st) && /1 lecție are dată și temă, dar nu are prezențe/.test(st), 'groups, and the lessons that wait for their marks: ' + st);
  }
  // ---- replacements, meet, rules ----
  {
    const r = A.replacementsText(view(), now);
    ok(/Te înlocuiește altcineva/.test(r) && /azi, luni, 2 noiembrie · 12:00–13:00 · Matematica, clasa a 12-a · de către Bogdan Altul/.test(r) && /joi, 5 noiembrie/.test(r) && !/29 octombrie|9 noiembrie/.test(r), 'replacements ahead only, none cancelled or past: ' + r);
    ok(/Înlocuiești tu/.test(r) && /mâine, marți, 3 noiembrie · 10:00–11:00 · Matematica, clasa a 7-a · grupa lui Carmen Colega · cab\. 5/.test(r), 'the lessons he takes over');
    ok(/nicio înlocuire/.test(A.replacementsText({ workbooks: [{ id: 'wb1' }], replacements: [] }, now)), 'nothing ahead');
    ok(/href="https:\/\/meet\.google\.com\/abc-defg-hij"/.test(A.meetText(view())) && /1 grupe online|celor 1 grupe online/.test(A.meetText(view())), 'the Meet link and how many online groups see it');
    ok(/Nu ai încă un link Meet/.test(A.meetText({ workbooks: [{ id: 'w', teacher_data: {} }], groups: [] })) && A.meetText({ workbooks: [], groups: [] }) === A.NO_REGISTER, 'no link yet; no register at all');
    ok(/grup de 6: 4 elevi/.test(A.RULES.start) && /grup de 3: 2 elevi/.test(A.RULES.start) && /Prima lecție gratuită|PRIMA LECȚIE GRATUITĂ/i.test(A.RULES.marks) && A.rulesKeyboard().inline_keyboard.flat().length === 4, 'the rules: the start table from the code, the marks, four topics');
  }
  // ---- long answers are cut at blank lines ----
  {
    const long = Array.from({ length: 60 }, (_, i) => 'Grupa ' + i + ' ' + 'x'.repeat(100)).join('\n\n');
    const parts = chunks(long);
    ok(parts.length > 1 && parts.every(p => p.length <= 3800) && parts.join('\n\n') === long, 'a long answer is split in messages under the limit, nothing lost: ' + parts.length);
    ok(chunks('scurt').length === 1 && chunks('x'.repeat(9000)).every(p => p.length <= 3800), 'short stays whole; one huge block is cut anyway');
  }
  // ---- the conversation ----
  {
    const { db, api } = tw();
    await handleUpdate(msg2('/azi'), { db, api, now });
    ok(/Azi, luni/.test(lastText(api)), '/azi answers with today');
    await handleUpdate(msg2('📅 Mâine'), { db, api, now });
    ok(/Mâine, marți/.test(lastText(api)), 'the menu key "Mâine" works like /maine');
    await handleUpdate(msg2('/saptamana'), { db, api, now });
    ok(/Următoarele 7 zile/.test(lastText(api)), '/saptamana');
    await handleUpdate(msg2('grupele mele'), { db, api, now });
    const gl = api.log.filter(x => x.m === 'send').pop();
    ok(/Grupele tale/.test(gl.text) && gl.extra.reply_markup.inline_keyboard.length === 4, 'text without the slash works; the groups come with their buttons');
    await handleUpdate(msg2('/salariu'), { db, api, now }); ok(/Salariul tău/.test(lastText(api)), '/salariu');
    await handleUpdate(msg2('/statistici'), { db, api, now }); ok(/Cifrele tale/.test(lastText(api)), '/statistici');
    await handleUpdate(msg2('/inlocuiri'), { db, api, now }); ok(/Înlocuiri/.test(lastText(api)), '/inlocuiri');
    await handleUpdate(msg2('/meet'), { db, api, now }); ok(/Linkul tău Meet/.test(lastText(api)), '/meet');
    await handleUpdate(msg2('/reguli'), { db, api, now }); ok(/Reguli pe scurt/.test(lastText(api)) && api.log.filter(x => x.m === 'send').pop().extra.reply_markup.inline_keyboard.length === 2, '/reguli with its topic buttons');
    await handleUpdate(msg2('ce mai faci'), { db, api, now });
    ok(/Nu am înțeles/.test(lastText(api)) && api.log.filter(x => x.m === 'send').pop().extra.reply_markup.keyboard, 'free text: the menu is shown again');
    // buttons: a group card, back to the list, a rule topic
    api.log.length = 0;
    const card = await handleUpdate(press2('g:' + G('a1')), { db, api, now });
    const e1 = api.log.find(x => x.m === 'edit');
    ok(card.navigated && e1 && e1.id === 301 && /Matematica, clasa a 12-a/.test(e1.text) && e1.extra.reply_markup.inline_keyboard[0][0].callback_data === 'gl', 'a group button edits the message into the card, with a back button');
    await handleUpdate(press2('gl'), { db, api, now });
    ok(/Grupele tale/.test(api.log.filter(x => x.m === 'edit').pop().text), 'back to the list');
    await handleUpdate(press2('r:marks'), { db, api, now });
    ok(/Prezențele din registru/.test(api.log.filter(x => x.m === 'edit').pop().text), 'a rule topic button');
    await handleUpdate(press2('g:' + G('ff')), { db, api, now });
    ok(api.log.filter(x => x.m === 'answer').pop().text === 'Grupa nu mai există în registrul tău.', 'a group that is not his: refused');
    const stranger = await handleUpdate({ callback_query: { id: 'cb8', from: { id: 4242 }, message: { message_id: 5, chat: { id: 4242 } }, data: 'g:' + G('a1') } }, { db, api, now });
    ok(stranger.handled && api.log.filter(x => x.m === 'answer').pop().text === 'Întrebarea aceasta nu e pentru acest cont.', 'an unknown chat gets nothing');
  }
  {
    // no register tied to the account
    const { db, api } = world(); db.s.links.set(TEACH, { chat_id: CHAT });
    await handleUpdate(msg2('/azi'), { db, api, now });
    ok(lastText(api) === A.NO_REGISTER, 'no register: he is told to ask for the link');
    await handleUpdate(msg2('/meet'), { db, api, now });
    ok(lastText(api) === A.NO_REGISTER, '/meet with no register');
    // the database fails: a short message, not silence
    const w2 = tw(); w2.db.s.viewFails = true;
    const f = await handleUpdate(msg2('/grupe'), { db: w2.db, api: w2.api, now });
    ok(f.failed && /Nu am putut citi datele/.test(lastText(w2.api)), 'a failure is answered');
    // an unlinked chat has no data
    await handleUpdate({ message: { message_id: 1, chat: { id: 31337, type: 'private' }, from: { id: 31337 }, text: '/salariu' } }, { db: w2.db, api: w2.api, now });
    ok(/nu e conectat/.test(lastText(w2.api)), 'an unlinked chat is sent to connect');
    // linking brings the menu
    const w3 = world(); w3.db.s.codes.set('MENU2345', { user_id: TEACH, expires: Date.now() + 60000 });
    await handleUpdate({ message: { message_id: 1, chat: { id: CHAT, type: 'private' }, from: { id: CHAT, first_name: 'Ana' }, text: '/start MENU2345' } }, { db: w3.db, api: w3.api, now });
    const ln = w3.api.log.filter(x => x.m === 'send').pop();
    ok(/\/azi/.test(ln.text) && ln.extra.reply_markup.keyboard[0][0].text === '📅 Azi', 'linking shows the commands and the menu keys');
    // /stop takes the menu away
    await handleUpdate(msg2('/stop'), { db: w3.db, api: w3.api, now });
    ok(w3.api.log.filter(x => x.m === 'send').pop().extra.reply_markup.remove_keyboard === true, '/stop removes the keys');
  }
  {
    // a menu key while the bot waits for a reason: the command runs, the reason is not taken from it
    const { db, api } = tw();
    await dispatch({ db, api, now }); await handleUpdate(press(CHAT, 'n:' + REQ), { db, api, now });
    await handleUpdate(msg2('📅 Azi'), { db, api, now });
    const texts = api.log.filter(x => x.m === 'send').map(x => x.text);
    ok(db.s.requests.get(REQ).status === 'awaiting_reason' && /Azi, luni/.test(texts[texts.length - 2]) && /Încă aștept motivul/.test(texts[texts.length - 1]), 'a command while the reason is awaited: answered, the reason still awaited');
    await handleUpdate(msg2('Elevii sunt plecați'), { db, api, now });
    ok(db.s.requests.get(REQ).status === 'declined' && /<i>Elevii sunt plecați<\/i>/.test(lastText(api)), 'then the reason is kept and repeated back');
  }
  // ---- the start question is richer ----
  {
    const w = tw(); w.db.s.groups.set('g1', { state: 'Startează' });
    w.db.s.students.set('g1', [{ name: 'Popescu Ion', status: 'Activ' }, { name: 'Vieru <i>Maria</i>', status: 'Oră de probă' }, { name: 'Plecat', status: 'Inactiv' }]);
    w.db.s.requests.get(REQ).schedule = [{ day: 2, hour: 15 }, { day: 2, hour: 16 }];
    await dispatch({ db: w.db, api: w.api, now });
    const q = lastText(w.api);
    ok(/Grupa ta e gata de start/.test(q) && /Matematica, clasa a 12-a/.test(q) && /marți, 15:00 - 17:00/.test(q) && /• Popescu Ion · activ/.test(q) && /• Vieru &lt;i&gt;Maria&lt;\/i&gt; · oră de probă/.test(q) && !/Plecat/.test(q), 'the question lists the students that count, escaped: ' + q);
    ok(/Prima lecție ar fi <b>marți, 3 noiembrie, 15:00<\/b>, cea de probă/.test(q) && /managerul sună elevii/.test(q) && /Confirmi startul grupei\?<\/b>/.test(q), 'it says when the first lesson would be and what confirming does');
    await handleUpdate(press(CHAT, 'c:' + REQ), { db: w.db, api: w.api, now });
    const done = w.api.log.filter(x => x.m === 'edit').pop().text;
    ok(/Ai confirmat startul grupei/.test(done) && /Prima lecție: <b>marți, 3 noiembrie, 15:00<\/b>/.test(done) && /\/azi/.test(done), 'the confirmation says what comes next: ' + done);
  }

  console.log(`TELEGRAM: ${pass} checks passed, ${fail} failed`);
  if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();
