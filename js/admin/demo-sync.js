/* ============================================================
   Mathorizon: shared demo state (Supabase table demo_state)
   ============================================================
   The admin console and the teacher register edit demo data. Those
   edits live in AdminData (js/admin/mock-data.js) and in the browser's
   localStorage. This file also keeps them in Supabase, so two devices
   (an admin on a laptop, a teacher on a tablet) work on the same state:

     - on start: read every row of demo_state; the server wins. If the
       table is empty and this browser has edits, they seed the table.
     - on every local save: the rows that changed are upserted (batched,
       250ms); rows that disappeared (a reset, an undo) are deleted.
     - Realtime: a change written by another open page is applied here
       at once (AdminData.sync.replace), which re-renders the views.
     - the page's own writes come back through Realtime too and are
       ignored (column "client").

   Without a session, without the table (migration
   20261005090000_demo_state.sql not run), or offline, nothing changes:
   everything keeps working on localStorage, as before.

   html[data-demo-sync] = local | syncing | live | error, shown by the
   demo pill of both pages. Event: 'bm:demo-sync' { detail: { state } }.
   ============================================================ */
(function () {
  'use strict';
  const D = window.AdminData;
  if (!D || !D.sync) return;

  const TABLE = 'demo_state';
  const CLIENT = Math.random().toString(36).slice(2, 10);
  const FLUSH_MS = 250;

  let sb = null;
  let started = false;
  let last = {};            // key -> JSON the server is known to hold
  const dirty = new Set();
  let flushT = 0, retryT = 0, state = 'local', chan = null, subscribedOnce = false;

  const setState = s => {
    state = s;
    document.documentElement.dataset.demoSync = s;
    document.dispatchEvent(new CustomEvent('bm:demo-sync', { detail: { state: s } }));
  };
  setState('local');

  const split = key => { const i = key.indexOf('/'); return [key.slice(0, i), key.slice(i + 1)]; };
  function flatten(edits) {
    const out = {};
    Object.keys(edits || {}).forEach(sec => {
      const o = edits[sec];
      if (o && typeof o === 'object') Object.keys(o).forEach(id => { out[sec + '/' + id] = o[id]; });
    });
    return out;
  }
  function unflatten(rows) {
    const e = {};
    rows.forEach(r => { const [sec, id] = split(r.key); (e[sec] = e[sec] || {})[id] = r.value; });
    return e;
  }

  /* ---- local -> server ---- */
  function onLocalSave(edits) {
    if (!started) return;
    const cur = flatten(edits);
    Object.keys(cur).forEach(k => { if (JSON.stringify(cur[k]) !== last[k]) dirty.add(k); });
    Object.keys(last).forEach(k => { if (!(k in cur)) dirty.add(k); });
    schedule();
  }
  function schedule() { clearTimeout(flushT); flushT = setTimeout(flush, FLUSH_MS); }

  async function flush() {
    if (!started || !dirty.size) return;
    const cur = flatten(D.sync.edits());
    const up = [], del = [];
    dirty.forEach(k => { if (k in cur) { if (JSON.stringify(cur[k]) !== last[k]) up.push({ key: k, value: cur[k], client: CLIENT, updated_at: new Date().toISOString() }); } else if (k in last) del.push(k); });
    dirty.clear();
    if (!up.length && !del.length) { if (state !== 'live') setState('live'); return; }
    setState('syncing');
    try {
      if (up.length) {
        const { error } = await sb.from(TABLE).upsert(up, { onConflict: 'key' });
        if (error) throw error;
        up.forEach(r => { last[r.key] = JSON.stringify(r.value); });
      }
      if (del.length) {
        const { error } = await sb.from(TABLE).delete().in('key', del);
        if (error) throw error;
        del.forEach(k => { delete last[k]; });
      }
      setState('live');
    } catch (e) {
      console.warn('[demo-sync] write failed, will retry:', e && e.message ? e.message : e);
      up.forEach(r => dirty.add(r.key)); del.forEach(k => dirty.add(k));
      setState('error');
      clearTimeout(retryT); retryT = setTimeout(flush, 4000);
    }
  }

  /* ---- server -> local ---- */
  function onRemote(p) {
    const row = p.eventType === 'DELETE' ? p.old : p.new;
    if (!row || !row.key) return;
    // an insert or update written by this page comes back to it: ignore. (A delete event carries the client
    // that wrote the row last, not the one that deleted it, so a delete is judged by what this page knows:
    // if the row is not one it believes the server holds, or one it is about to write, there is nothing to do.)
    if (p.eventType !== 'DELETE' && row.client === CLIENT) return;
    if (p.eventType === 'DELETE' && (!(row.key in last) || dirty.has(row.key))) return;
    const edits = D.sync.edits();
    const [sec, id] = split(row.key);
    if (p.eventType === 'DELETE') {
      if (edits[sec]) { delete edits[sec][id]; if (!Object.keys(edits[sec]).length) delete edits[sec]; }
      delete last[row.key];
    } else {
      (edits[sec] = edits[sec] || {})[id] = row.value;
      last[row.key] = JSON.stringify(row.value);
    }
    D.sync.replace(edits);
  }

  async function pull(seed) {
    if (!seed) await flush();                       // what this page has not sent yet goes first
    const { data, error } = await sb.from(TABLE).select('key,value');
    if (error) throw error;
    const local = flatten(D.sync.edits());
    if (seed && !data.length && Object.keys(local).length) {
      // the first device to connect gives the table what this browser already has
      started = true;
      Object.keys(local).forEach(k => dirty.add(k));
      await flush();
      return;
    }
    last = {};
    data.forEach(r => { last[r.key] = JSON.stringify(r.value); });
    started = true;
    D.sync.replace(unflatten(data));
  }

  function subscribe() {
    chan = sb.channel('demo-state-' + CLIENT)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, onRemote)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          // after a dropped connection something may have been missed: read everything again
          if (subscribedOnce) pull(false).then(() => setState('live')).catch(() => setState('error'));
          subscribedOnce = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setState('error');
        }
      });
  }

  async function start() {
    const a = window.BMAuth;
    if (!a || !a.supabase || !a.user) return;
    sb = a.supabase;
    try {
      setState('syncing');
      await pull(true);
      D.sync.onSave(onLocalSave);
      subscribe();
      setState('live');
    } catch (e) {
      // no table yet, no permission, offline: stay on localStorage
      console.warn('[demo-sync] not connected, working locally:', e && e.message ? e.message : e);
      started = false;
      setState('local');
    }
  }

  window.addEventListener('online', () => { if (started) { schedule(); pull(false).catch(() => {}); } });
  if (window._bmAuthReady) start();
  else document.addEventListener('bmauth:ready', start, { once: true });

  D.sync.state = () => state;
  D.sync.clientId = CLIENT;
})();
