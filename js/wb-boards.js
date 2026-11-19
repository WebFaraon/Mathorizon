/* ============================================================
   Tabla live: the strip of boards (2026-11-20)
   One shared board everyone writes on, and one private board per student (only that student and the teacher see it).
   This file draws the strip under the header of the live view and drives Whiteboard.setBoard (js/whiteboard.js):
     - a student: two tabs, "Tabla comună" and "Tabla mea";
     - the teacher on a laptop: "Tabla comună" and a tab per student (photo, name, a dot while they write), sideways scroll and arrows;
     - the teacher on a phone: "Comună", previous / next student keys and a key that opens the list of students.
   Alt + left / right arrow steps through the boards.
   ============================================================ */
(function (global) {
  'use strict';

  var COMMON = 'c';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(name, size) { return global.icon ? global.icon(name, { size: size || 16 }) : ''; }

  /**
   * @param {object} o
   *   modal    - the live view's root element (#tablaLiveModal); the strip goes right after its header
   *   wb       - the Whiteboard instance
   *   isTeacher, readOnly, myId
   *   members  - [{id, name}] the students of the class (the teacher's list of tabs)
   *   getRoster - () => the connected participants [{user_id, display_name, avatar_url, role, color}]
   *   defaultAvatar - url
   */
  function mount(o) {
    var wb = o.wb, modal = o.modal, active = COMMON, live = {}, news = {}, destroyed = false;
    var strip = document.createElement('div');
    strip.className = 'wb-boards';
    strip.id = 'wbBoards';
    strip.hidden = true;
    strip.setAttribute('role', 'tablist');
    strip.setAttribute('aria-label', 'Tablele');
    var header = modal.querySelector('.wb-fs-header');
    if (header && header.nextSibling) modal.insertBefore(strip, header.nextSibling); else modal.appendChild(strip);

    function students() {
      var roster = (o.getRoster && o.getRoster()) || [];
      var byId = {};
      roster.forEach(function (p) { if (p.role !== 'profesor') byId[p.user_id] = p; });
      var list = [];
      var seen = {};
      (o.members || []).forEach(function (m) {
        var p = byId[m.id];
        seen[m.id] = true;
        list.push({ id: m.id, name: m.name || (p && p.display_name) || 'Elev', avatar: (p && p.avatar_url) || o.defaultAvatar, color: p && p.color, online: !!p });
      });
      Object.keys(byId).forEach(function (id) {
        if (seen[id]) return;
        var p = byId[id];
        list.push({ id: id, name: p.display_name || 'Elev', avatar: p.avatar_url || o.defaultAvatar, color: p.color, online: true });
      });
      if (o.readOnly) {
        // a replay: only the students who have a board in it
        var have = {};
        wb.getBoards().forEach(function (b) { if (b.ownerId) have[b.ownerId] = true; });
        list = list.filter(function (s) { return have[s.id]; });
        wb.getBoards().forEach(function (b) { if (b.ownerId && !seen[b.ownerId] && !byId[b.ownerId]) list.push({ id: b.ownerId, name: 'Elev', avatar: o.defaultAvatar, online: false }); });
      }
      list.sort(function (a, b) {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return String(a.name).localeCompare(String(b.name), 'ro');
      });
      return list;
    }

    function nameOf(key) {
      if (key === COMMON) return 'Tabla comună';
      if (key === o.myId) return 'Tabla mea';
      var s = students().filter(function (x) { return x.id === key; })[0];
      return s ? s.name : 'Elev';
    }

    function tabHTML(key, label, avatar, extra) {
      var on = key === active;
      var cls = 'wb-bt' + (on ? ' is-on' : '') + (live[key] ? ' is-live' : '') + (news[key] && !on ? ' has-news' : '') + (extra && extra.off ? ' is-off' : '');
      return '<button type="button" class="' + cls + '" role="tab" aria-selected="' + on + '" data-board="' + esc(key) + '" title="' + esc(label) + '">' +
        (avatar ? '<span class="wb-bt__ph"><img src="' + esc(avatar) + '" alt=""></span>'
          : '<span class="wb-bt__ico">' + (key === COMMON ? ico('users', 16) : ico('user', 16)) + '</span>') +
        '<span class="wb-bt__t">' + esc(label) + '</span><i class="wb-bt__dot"></i></button>';
    }

    function render() {
      if (destroyed) return;
      var html = '';
      if (!o.isTeacher && !o.readOnly) {
        html = '<div class="wb-boards__lane">' + tabHTML(COMMON, 'Tabla comună') + tabHTML(o.myId, 'Tabla mea') + '</div>';
      } else if (o.isTeacher || o.isTeacherReplay) {
        var list = students();
        var idx = -1;
        list.forEach(function (s, i) { if (s.id === active) idx = i; });
        var cur = idx >= 0 ? list[idx] : null;
        html =
          tabHTML(COMMON, 'Tabla comună') +
          '<span class="wb-boards__sep" aria-hidden="true"></span>' +
          '<button type="button" class="wb-bnav wb-bnav--l" data-step="-1" title="Elevul de dinainte (Alt + ←)" aria-label="Elevul de dinainte">' + ico('chevron-left', 18) + '</button>' +
          '<div class="wb-boards__lane" id="wbBoardsLane">' +
            (list.length ? list.map(function (s) { return tabHTML(s.id, s.name, s.avatar, { off: !s.online }); }).join('') : '<span class="wb-boards__empty">Niciun elev în clasă</span>') +
          '</div>' +
          '<button type="button" class="wb-bnav wb-bnav--r" data-step="1" title="Elevul următor (Alt + →)" aria-label="Elevul următor">' + ico('chevron-right', 18) + '</button>' +
          // phones: one key with the name of the open student (opens the list)
          '<button type="button" class="wb-bpick" id="wbBoardPick" aria-haspopup="true">' +
            (cur ? '<span class="wb-bt__ph"><img src="' + esc(cur.avatar) + '" alt=""></span>' : '<span class="wb-bt__ico">' + ico('user', 16) + '</span>') +
            '<span class="wb-bt__t">' + esc(cur ? cur.name : 'Elevi') + '</span>' + ico('chevron-down', 16) + '</button>';
      } else {
        // a student's replay: the shared board and, when there is one, their own
        var hasOwn = wb.getBoards().some(function (b) { return b.ownerId === o.myId; });
        html = '<div class="wb-boards__lane">' + tabHTML(COMMON, 'Tabla comună') + (hasOwn ? tabHTML(o.myId, 'Tabla mea') : '') + '</div>';
      }
      html += '<span class="wb-boards__note" id="wbBoardNote">' + noteText() + '</span>';
      strip.innerHTML = html;
      var lane = strip.querySelector('#wbBoardsLane');
      var tab = lane && lane.querySelector('.wb-bt.is-on');
      if (tab) { try { lane.scrollTo({ left: tab.offsetLeft - lane.clientWidth / 2 + tab.clientWidth / 2, behavior: 'auto' }); } catch (e) { lane.scrollLeft = tab.offsetLeft - 60; } }
      modal.setAttribute('data-board', active === COMMON ? 'common' : (active === o.myId ? 'own' : 'student'));
    }

    // What the person is writing on, and in which colour (so a correction on a student's board is never a surprise)
    function noteText() {
      if (active === COMMON) return o.readOnly ? '' : 'O văd toți cei din clasă';
      if (active === o.myId) return o.readOnly ? '' : 'Doar tu și profesorul o vedeți';
      if (o.readOnly) return '';
      return '<b class="wb-boards__sw" style="background:' + esc(wb._color) + '"></b>Scrii pe tabla lui ' + esc(nameOf(active)) + ', în culoarea ta';
    }

    function show(key) {
      if (destroyed) return;
      if (key === active && wb.getBoardKey() === key) return;
      var s = key === COMMON ? null : students().filter(function (x) { return x.id === key; })[0];
      wb.setBoard(key === COMMON ? null : key, s && s.color);
    }

    strip.addEventListener('click', function (e) {
      var step = e.target.closest('[data-step]');
      if (step) { go(+step.getAttribute('data-step')); return; }
      var t = e.target.closest('.wb-bt');
      if (t) { show(t.getAttribute('data-board')); return; }
      if (e.target.closest('#wbBoardPick')) { openSheet(); }
    });

    // previous / next student (and from the shared board, the first / last one)
    function go(dir) {
      var list = students();
      if (!list.length) return;
      var idx = -1;
      list.forEach(function (s, i) { if (s.id === active) idx = i; });
      var next = idx < 0 ? (dir > 0 ? 0 : list.length - 1) : (idx + dir + list.length) % list.length;
      show(list[next].id);
    }
    function onKey(e) {
      if (!e.altKey || e.ctrlKey || e.metaKey || strip.hidden) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      e.preventDefault();
      if (!o.isTeacher && !o.readOnly) { show(active === COMMON ? o.myId : COMMON); return; }
      go(e.key === 'ArrowRight' ? 1 : -1);
    }
    document.addEventListener('keydown', onKey);

    // phone: the list of students as a sheet
    var sheet = null;
    function closeSheet() { if (sheet) { sheet.remove(); sheet = null; } document.removeEventListener('click', outside, true); }
    function outside(e) { if (sheet && !sheet.contains(e.target) && !e.target.closest('#wbBoardPick')) closeSheet(); }
    function openSheet() {
      if (sheet) { closeSheet(); return; }
      var list = students();
      sheet = document.createElement('div');
      sheet.className = 'wb-bsheet';
      sheet.setAttribute('role', 'listbox');
      sheet.innerHTML = '<div class="wb-bsheet__h"><b>Elevii</b><span>' + list.length + '</span></div>' +
        '<div class="wb-bsheet__list">' + (list.length ? list.map(function (s) {
          return '<button type="button" class="wb-bs' + (s.id === active ? ' is-on' : '') + (s.online ? '' : ' is-off') + (news[s.id] && s.id !== active ? ' has-news' : '') + '" data-board="' + esc(s.id) + '" role="option" aria-selected="' + (s.id === active) + '">' +
            '<span class="wb-bt__ph"><img src="' + esc(s.avatar) + '" alt=""></span><span class="wb-bs__n">' + esc(s.name) + '</span>' +
            '<span class="wb-bs__st">' + (live[s.id] ? 'scrie acum' : s.online ? 'conectat' : 'neconectat') + '</span><i class="wb-bt__dot"></i></button>';
        }).join('') : '<div class="wb-boards__empty">Niciun elev în clasă</div>') + '</div>';
      modal.appendChild(sheet);
      sheet.style.top = (strip.getBoundingClientRect().bottom + 6) + 'px';
      sheet.addEventListener('click', function (e) {
        var b = e.target.closest('.wb-bs');
        if (!b) return;
        closeSheet();
        show(b.getAttribute('data-board'));
      });
      setTimeout(function () { document.addEventListener('click', outside, true); }, 0);
    }

    var liveTimers = {};
    var api = {
      // the engine says which board is on screen now
      onChange: function (key) {
        active = key || COMMON;
        delete news[active];
        closeSheet();
        render();
      },
      // somebody wrote on this student's board (also when it is not open): a dot on the tab, and "writes now" for a few seconds
      activity: function (ownerId) {
        if (destroyed || !ownerId) return;
        if (ownerId !== active) news[ownerId] = true;
        live[ownerId] = true;
        clearTimeout(liveTimers[ownerId]);
        liveTimers[ownerId] = setTimeout(function () { delete live[ownerId]; if (!destroyed) render(); }, 4000);
        render();
      },
      // the boards are known now (the database supports them / the replay is loaded)
      ready: function (supported) {
        if (destroyed) return;
        // a replay with only the shared board has nothing to switch to
        var show = !!supported && (!o.readOnly || wb.getBoards().length > 1);
        strip.hidden = !show;
        modal.classList.toggle('wb-has-boards', show);
        if (show) render();
      },
      // the roster changed (who is connected)
      refresh: function () { if (!destroyed && !strip.hidden) render(); },
      destroy: function () {
        destroyed = true;
        document.removeEventListener('keydown', onKey);
        closeSheet();
        Object.keys(liveTimers).forEach(function (k) { clearTimeout(liveTimers[k]); });
        strip.remove();
      }
    };
    if (wb.supportsBoards()) api.ready(true);
    return api;
  }

  global.WBBoards = { mount: mount };
})(window);
