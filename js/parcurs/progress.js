/* ============================================================
   Parcurs: progresul elevului (ce lecții a terminat).
   Se ține în localStorage (merge imediat și fără rețea) și se sincronizează cu tabelul parcurs_progress din Supabase
   (migrarea 20261113110000). Dacă tabelul nu există încă, totul merge doar local, în tăcere.
   ============================================================ */
(function (root) {
  'use strict';
  var map = {}, loadedFor = null, readyP = null, remoteOk = true;

  var uid = function () { return (root.BMAuth && root.BMAuth.user && root.BMAuth.user.id) || ''; };
  var key = function () { return 'bm_parcurs_v1_' + (uid() || 'anon'); };
  var sb = function () { return root.BMAuth && root.BMAuth.supabase; };

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeLocal() { try { localStorage.setItem(key(), JSON.stringify(map)); } catch (e) { /* ignore */ } }
  function ensure() {
    var u = uid();
    if (loadedFor !== u) { map = readLocal(); loadedFor = u; readyP = null; }
  }
  function changed(id) { try { document.dispatchEvent(new CustomEvent('parcurs:changed', { detail: { id: id } })); } catch (e) { /* ignore */ } }

  var P = {
    get: function (id) { ensure(); return map[id] || null; },
    isDone: function (id) { ensure(); return !!map[id]; },
    all: function () { ensure(); return map; },

    /* citește din baza de date și îmbină cu ce e local; întoarce o promisiune care se rezolvă mereu */
    ready: function () {
      ensure();
      if (readyP) return readyP;
      var client = sb(), u = uid();
      if (!client || !u) { readyP = Promise.resolve(map); return readyP; }
      readyP = Promise.resolve().then(function () {
        return client.from('parcurs_progress').select('lesson_id,best_pct,plays,xp,via,done_at').eq('user_id', u);
      }).then(function (r) {
        if (!r || r.error || !Array.isArray(r.data)) { remoteOk = false; return map; }
        var remote = {};
        r.data.forEach(function (x) { remote[x.lesson_id] = { at: Date.parse(x.done_at) || Date.now(), pct: x.best_pct, plays: x.plays, xp: x.xp, via: x.via }; });
        var push = [];
        Object.keys(remote).forEach(function (id) {
          var l = map[id], rr = remote[id];
          map[id] = l ? { at: Math.min(l.at, rr.at), pct: Math.max(l.pct || 0, rr.pct || 0), plays: Math.max(l.plays || 0, rr.plays || 0), xp: Math.max(l.xp || 0, rr.xp || 0), via: rr.via } : rr;
        });
        Object.keys(map).forEach(function (id) { if (!remote[id]) push.push(id); });
        writeLocal();
        if (push.length) {
          client.from('parcurs_progress').upsert(push.map(function (id) { return row(id); }), { onConflict: 'user_id,lesson_id' }).then(function () {}, function () {});
        }
        changed();
        return map;
      }).catch(function () { remoteOk = false; return map; });
      return readyP;
    },

    /* a terminat o lecție: întoarce {first, xpGiven} (XP-ul se dă o singură dată pe lecție) */
    complete: function (id, o) {
      ensure(); o = o || {};
      var prev = map[id], first = !prev;
      var rec = prev ? { at: prev.at, pct: Math.max(prev.pct || 0, o.pct || 0), plays: (prev.plays || 0) + 1, xp: prev.xp || 0, via: prev.via || 'lesson' }
                     : { at: Date.now(), pct: o.pct || 0, plays: o.via === 'skip' ? 0 : 1, xp: 0, via: o.via || 'lesson' };
      var xpGiven = first ? Math.max(0, Math.min(500, o.xp || 0)) : 0;
      if (first) rec.xp = xpGiven;
      map[id] = rec; writeLocal();
      var client = sb();
      if (client && uid() && remoteOk) {
        try { client.from('parcurs_progress').upsert(row(id), { onConflict: 'user_id,lesson_id' }).then(function (r) { if (r && r.error) remoteOk = false; }, function () { remoteOk = false; }); } catch (e) { /* ignore */ }
      }
      changed(id);
      return { first: first, xpGiven: xpGiven };
    },

    /* secțiune trecută prin testul de nivel: marchează toate lecțiile ei */
    skipMany: function (ids) {
      ensure();
      var rows = [];
      ids.forEach(function (id) { if (!map[id]) { map[id] = { at: Date.now(), pct: 100, plays: 0, xp: 0, via: 'skip' }; rows.push(row(id)); } });
      writeLocal();
      var client = sb();
      if (rows.length && client && uid() && remoteOk) {
        try { client.from('parcurs_progress').upsert(rows, { onConflict: 'user_id,lesson_id' }).then(function (r) { if (r && r.error) remoteOk = false; }, function () { remoteOk = false; }); } catch (e) { /* ignore */ }
      }
      changed();
    },
    reset: function () { map = {}; loadedFor = null; readyP = null; }
  };

  function row(id) {
    var r = map[id] || {};
    return { user_id: uid(), lesson_id: id, best_pct: Math.max(0, Math.min(100, Math.round(r.pct || 0))), plays: Math.max(0, r.plays || 0), xp: Math.max(0, Math.min(500, r.xp || 0)), via: r.via === 'skip' ? 'skip' : 'lesson', done_at: new Date(r.at || Date.now()).toISOString() };
  }

  root.Parcurs = P;
})(window);
