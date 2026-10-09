/* The engine of the replacements (docs/inlocuiri.md): from the synchronised tables it finds what the substitute teacher has marked, moves the money of each
   marked lesson from the base register to the substitute's register, gives it back when a mark is changed, and closes the tab when it is over.

   Plain ES module and PURE: everything it touches comes in through `db` and `run`, so the same code is tested in Node with fakes and runs in the Edge
   Function with Supabase and Google.
     db.replacements()             -> the replacements to look at: [{ id, origWorkbook, origSheet, replWorkbook, replSheet, status, dates, price }]
     db.replData(rep)              -> the substitute's tab as last synchronised: { students: [{ col, name, phone }], lessons: [{ row, marks: { col: code } }] } or null
     db.items(rep)                 -> the money lines kept so far: [item]
     db.saveItem(rep, item)        -> stores a line (the key is student + lesson row)
     db.setStatus(rep, status)     -> 'active' | 'closed' | 'cancelled'
     run({ id, workbook, sheet, type, payload }) -> { status: 'done'|'noop'|'invalid'|'conflict'|'failed', code?, info?, msg? }
         one command in one register; the same id is never applied twice (a repeated id answers with what the first one answered)
   A line (item) is one student at one lesson row of the substitute's tab:
     pending -> [REPL_TAKE in the base register] -> from-done -> [REPL_MONEY in the substitute's] -> settled
     settled -> (the mark is gone) -> [REPL_MONEY minus in the substitute's] -> rev-new-done -> [REPL_MONEY plus in the base register] -> reversed
     reversed -> (the mark is back) -> pending again, one attempt later
   The state is saved after every step, so a fall between two steps is taken up again from where it stopped, never from the start.
   Money moves for the marks P (present) and A (absent, not excused) only: the cost of a lesson in the register counts exactly those. Empty, M (excused),
   G (free first lesson) and B (absent at the free first lesson) move nothing.
   A step that fails is tried again on the next runs, up to MAX_TRIES, except when it is not known whether it wrote (a write that did not answer, a read-back
   that differs, a call that died): then nobody repeats it, a person looks at the register. */

export const PAYS = new Set(['P', 'A']);
export const MAX_TRIES = 5;
const okRun = r => r && (r.status === 'done' || r.status === 'noop');
const UNKNOWN = new Set(['interrupted', 'verify-failed', 'write-unknown']);

export const itemKey = (phone, row) => `${phone}#${row}`;

/* the lines that should exist now: every (student, lesson row) with a mark that pays */
export function desiredItems(data) {
  const out = new Map();
  (data.lessons || []).forEach(l => {
    (data.students || []).forEach(st => {
      const code = (l.marks || {})[st.col];
      if (PAYS.has(code) && st.phone) out.set(itemKey(st.phone, l.row), { phone: st.phone, name: st.name, row: l.row, mark: code });
    });
  });
  return out;
}

/* the same step of the same attempt (and failure count) is the same command: a repeat after a fall never writes twice */
const cmdId = (rep, item, step) => `repl-${rep.id}-${item.student_key}-${item.attempt || 1}-${step}-${item.tries || 0}`.replace(/[^A-Za-z0-9#_.+-]/g, '_');
const isStuck = item => !!item.error && (item.tries || 0) >= MAX_TRIES;

export async function settleReplacements({ db, run, today, now }) {
  const out = { settled: 0, reversed: 0, errors: 0, closed: 0, looked: 0, short: 0 };
  for (const rep of await db.replacements()) {
    if (rep.status === 'cancelled') continue;
    const data = await db.replData(rep);
    if (!data) continue;                                                       // the tab has not been read yet
    out.looked++;
    const want = desiredItems(data), have = new Map((await db.items(rep)).map(i => [i.student_key, i]));
    const save = it => { have.set(it.student_key, it); return db.saveItem(rep, it); };
    const who = it => ({ name: it.student_name, phone: it.student_phone });

    /* one command; on success `after` records it, on failure the line keeps the reason and the step to repeat */
    const step = async (it, name, req, after) => {
      let r;
      try { r = await run(Object.assign({ id: cmdId(rep, it, name) }, req)); } catch (e) { r = { status: 'failed', code: 'exception', msg: String((e && e.message) || e).slice(0, 300) }; }
      if (okRun(r)) { it.error = null; it.step = null; it.tries = 0; await after(r); return true; }
      it.step = name;
      it.error = (r && r.msg) || ('Comanda a răspuns ' + (r && r.status));
      it.tries = (it.tries || 0) + 1;
      if (r && UNKNOWN.has(r.code)) { it.tries = MAX_TRIES; it.error = 'Nu se știe dacă s-a scris în registru: verifică registrul înainte să repeți. ' + it.error; }
      else if (it.tries >= MAX_TRIES) it.error = `După ${MAX_TRIES} încercări: ${it.error}`;
      await save(it); out.errors++;
      return false;
    };

    // 1. what is marked and not settled yet (or the mark came back after a reversal)
    for (const [key, w] of want) {
      let it = have.get(key);
      if (it && it.status === 'reversed') it = Object.assign({}, it, { status: 'pending', attempt: (it.attempt || 1) + 1, tries: 0, error: null, step: null, ach: 0, red: 0, short: 0 });
      if (!it) it = { student_key: key, lesson_row: w.row, student_name: w.name, student_phone: w.phone, mark: w.mark, status: 'pending', attempt: 1, tries: 0, error: null, step: null, ach: 0, red: 0, short: 0 };
      else it = Object.assign({}, it);
      it.mark = w.mark;
      if (it.status === 'settled') { await save(it); continue; }
      if (isStuck(it)) continue;
      if (it.status === 'pending') {
        const ok1 = await step(it, 'take', { workbook: rep.origWorkbook, sheet: rep.origSheet, type: 'REPL_TAKE', payload: { student: who(it), price: rep.price } }, async r => {
          const i = r.info || {};
          it.ach = i.ach || 0; it.red = i.red || 0; it.short = i.short || 0; it.tot = i.tot || rep.price; it.status = 'from-done'; await save(it);
        });
        if (!ok1) continue;
      }
      if (it.status === 'from-done') {
        await step(it, 'to', { workbook: rep.replWorkbook, sheet: rep.replSheet, type: 'REPL_MONEY', payload: { student: who(it), ach: it.ach, red: it.red } }, async () => {
          it.status = 'settled'; it.settled_at = new Date(now ? now() : Date.now()).toISOString(); await save(it); out.settled++; if (it.short > 0) out.short++;
        });
      }
    }

    // 2. what was settled and is not marked any more (the substitute changed or cleared the mark): the money goes back, first out of the substitute's tab
    for (const [key, it0] of [...have]) {
      if (want.has(key)) continue;
      if (!['settled', 'from-done', 'rev-new-done'].includes(it0.status)) continue;
      const it = Object.assign({}, it0);
      if (isStuck(it)) continue;
      const moved = !!(it.ach || it.red);
      if (it.status === 'settled') {
        if (moved) {
          const ok1 = await step(it, 'rev-new', { workbook: rep.replWorkbook, sheet: rep.replSheet, type: 'REPL_MONEY', payload: { student: who(it), ach: -it.ach, red: -it.red } }, async () => { it.status = 'rev-new-done'; await save(it); });
          if (!ok1) continue;
        } else it.status = 'rev-new-done';                                       // no money had moved: nothing to take back
      }
      // 'from-done': the money left the base register but never reached the substitute's tab: it goes straight back
      if (!moved) { it.status = 'reversed'; it.error = null; await save(it); out.reversed++; continue; }
      await step(it, 'rev-old', { workbook: rep.origWorkbook, sheet: rep.origSheet, type: 'REPL_MONEY', payload: { student: who(it), ach: it.ach, red: it.red } }, async () => { it.status = 'reversed'; await save(it); out.reversed++; });
    }

    // 3. over: the last date has passed and every line is settled or reversed: the tab goes to Inactiv and its schedule is cleared
    //    (it opens again by itself with the next replacement of this group by this teacher)
    if (rep.status === 'active') {
      const live = (rep.dates || []).filter(d => !d.cancelled), dates = live.length ? live : (rep.dates || []);     // every date cancelled: closing waits for the last of them
      const last = dates.reduce((m, d) => (d.iso > m ? d.iso : m), '');
      const lines = [...have.values()];
      const open = lines.some(i => ['pending', 'from-done', 'rev-new-done'].includes(i.status) || (i.error && (i.status !== 'settled' && i.status !== 'reversed')));
      const unsettled = [...want.keys()].some(k => { const i = have.get(k); return !i || i.status !== 'settled'; });
      if (last && today > last && !open && !unsettled) {
        let r;
        try { r = await run({ id: `repl-${rep.id}-close-${last}`, workbook: rep.replWorkbook, sheet: rep.replSheet, type: 'REPL_CLOSE', payload: {} }); } catch (e) { r = null; }
        if (okRun(r)) { await db.setStatus(rep, 'closed'); out.closed++; }
      }
    }
  }
  return out;
}
