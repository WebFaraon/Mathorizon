/* ============================================================
   Whiteboard — live collaborative drawing surface ("Tablă live")
   Phase 1: shared freehand pen, fixed color per participant,
   width picker, "șterge ce am desenat eu". No pan/zoom, no
   eraser-by-click, no text/shapes yet — those are later phases.

   Architecture: fabric.Canvas holds only COMMITTED strokes (one
   fabric.Path per finished stroke) — cheap to render since it never
   changes mid-gesture. The in-progress stroke (mine or anyone else's)
   is drawn on a plain 2D <canvas> overlay on top, redrawn from scratch
   every animation frame from whatever points have arrived so far —
   never touching Fabric's object graph until the stroke is done. This
   split is what keeps several people drawing at once from bogging down
   the canvas: Fabric only ever does one cheap add() per finished stroke,
   never a rebuild per point.

   Sync: one Supabase Realtime channel per session, 'whiteboard-<id>',
   carrying two kinds of traffic — Broadcast for the live, ephemeral
   points of an in-progress stroke (throttled, never persisted), and
   postgres_changes on whiteboard_objects for the durable, replayable
   record of finished strokes (what a late joiner replays, what a
   client rebuilds from after a refresh).
   ============================================================ */

(function (global) {
  'use strict';

  // Fixed logical drawing surface — every stroke's (x,y) lives in this
  // coordinate space regardless of the viewer's actual screen size; each
  // client just scales its OWN rendering to fit its container width (see
  // _applySize). This is what "one shared board, no per-user pan/zoom yet"
  // means concretely: the coordinate space is shared and absolute, only
  // the on-screen scale differs per viewer.
  var LOGICAL_W = 1400;
  var LOGICAL_H = 900;

  var BROADCAST_MS = 40; // flush a broadcast at most this often...
  var BROADCAST_PX = 5;  // ...or sooner if the pointer moved at least this far
  var WIDTH_PRESETS = [2, 4, 8];
  var MAX_DPR = 2; // matches drawing-canvas.js's own cap — see its _resize

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function genId() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  // Smooth freehand path (quadratic curve through consecutive midpoints) —
  // same technique js/drawing-canvas.js uses for its own live pen stroke,
  // reused here for both the live overlay preview and the final committed
  // fabric.Path, so a stroke never visibly "snaps" from smooth to jagged
  // the instant it's finalized.
  function smoothPathString(points) {
    if (points.length < 2) return null;
    if (points.length === 2) {
      return 'M ' + points[0].x + ' ' + points[0].y + ' L ' + points[1].x + ' ' + points[1].y;
    }
    var d = 'M ' + points[0].x + ' ' + points[0].y;
    for (var i = 1; i < points.length - 1; i++) {
      var mx = (points[i].x + points[i + 1].x) / 2;
      var my = (points[i].y + points[i + 1].y) / 2;
      d += ' Q ' + points[i].x + ' ' + points[i].y + ' ' + mx + ' ' + my;
    }
    var last = points[points.length - 1];
    d += ' L ' + last.x + ' ' + last.y;
    return d;
  }

  function drawSmoothStroke(ctx, points, color, width) {
    if (!points.length) return;
    if (points.length === 1) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth   = width;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length - 1; i++) {
      var mx = (points[i].x + points[i + 1].x) / 2;
      var my = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    var last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  /**
   * @param {HTMLElement} container - mounted into this element (emptied first? no — caller owns that)
   * @param {object} opts
   *   supabase   - the shared BMAuth.supabase client
   *   sessionId  - whiteboard_sessions.id
   *   classId    - classes.id (denormalized onto every whiteboard_objects row)
   *   userId     - auth.uid()
   *   userColor  - this participant's fixed color (from whiteboard_participants.color)
   */
  function Whiteboard(container, opts) {
    this._supabase  = opts.supabase;
    this._sessionId = opts.sessionId;
    this._classId   = opts.classId;
    this._userId    = opts.userId;
    this._color     = opts.userColor;
    this._width     = WIDTH_PRESETS[0];

    this._liveStrokes  = new Map();  // key -> {points:[{x,y}], color, width}
    this._activePtrs   = {};         // pointerId -> {strokeId, points, pending, lastSentAt, lastSentPos}
    this._committedIds = new Set();
    this._dirty       = false;
    this._rafId       = null;
    this._destroyed    = false;
    this._scale = 1;
    this._dpr   = 1;

    this._build(container);
    this._initFabric();
    this._bindToolbar();
    this._bindPointerEvents();
    this._connectRealtime();
    this._loadExisting();
    this._startLoop();
  }

  /* ---- DOM ---- */

  Whiteboard.prototype._build = function (container) {
    var wrap = document.createElement('div');
    wrap.className = 'wb-board';
    wrap.innerHTML =
      '<div class="dc-toolbar wb-toolbar">' +
        '<div class="dc-tool-group">' +
          WIDTH_PRESETS.map(function (w, i) {
            var dotSize = 3 + i * 3;
            return '<button type="button" class="dc-width-btn' + (i === 0 ? ' dc-width-btn--active' : '') +
              '" data-width="' + w + '" title="Grosime linie">' +
              '<span class="dc-width-dot" style="width:' + dotSize + 'px;height:' + dotSize + 'px"></span></button>';
          }).join('') +
        '</div>' +
        '<div class="dc-tool-group dc-tool-group--right">' +
          '<button type="button" class="dc-action-btn dc-action-btn--danger" id="wbClearMineBtn" title="Șterge ce am desenat eu">' +
            (global.icon ? global.icon('trash-2', { size: 16 }) : '×') +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="wb-canvas-wrap" id="wbCanvasWrap"><canvas id="wbFabricCanvas"></canvas></div>';
    container.appendChild(wrap);

    this._wrap       = wrap;
    this._toolbarEl   = wrap.querySelector('.wb-toolbar');
    this._canvasWrap  = wrap.querySelector('#wbCanvasWrap');
    this._fabricEl    = wrap.querySelector('#wbFabricCanvas');
  };

  Whiteboard.prototype._bindToolbar = function () {
    var self = this;
    this._toolbarEl.addEventListener('click', function (e) {
      var widthBtn = e.target.closest('[data-width]');
      var clearBtn = e.target.closest('#wbClearMineBtn');
      if (widthBtn) {
        self._width = parseInt(widthBtn.dataset.width, 10);
        self._toolbarEl.querySelectorAll('.dc-width-btn').forEach(function (b) {
          b.classList.toggle('dc-width-btn--active', b === widthBtn);
        });
      } else if (clearBtn) {
        self._clearMine();
      }
    });
  };

  /* ---- Fabric canvas (committed strokes) ---- */

  Whiteboard.prototype._initFabric = function () {
    this._fabricCanvas = new fabric.Canvas(this._fabricEl, {
      selection: false,
      evented: false,          // no per-object interaction in Phase 1 — we own all pointer handling via the overlay
      renderOnAddRemove: false, // batched — every call site below does its own requestRenderAll()
      backgroundColor: '#ffffff' // deliberately NOT theme-linked — see note on the participant color palette below
    });

    // Overlay canvas: raw 2D context, captures every pointer event, renders
    // only the in-progress stroke (mine + everyone else's). Sits on top of
    // whatever Fabric just rendered its own <canvas>/.canvas-container as.
    var overlay = document.createElement('canvas');
    overlay.className = 'wb-overlay-canvas';
    overlay.style.touchAction = 'none'; // prevent the page from scrolling/pinch-zooming while drawing
    this._canvasWrap.appendChild(overlay);
    this._overlayEl  = overlay;
    this._overlayCtx = overlay.getContext('2d');

    this._applySize();

    var self = this;
    if (global.ResizeObserver) {
      this._ro = new ResizeObserver(function () {
        clearTimeout(self._resizeTimer);
        self._resizeTimer = setTimeout(function () { self._applySize(); }, 80);
      });
      this._ro.observe(this._canvasWrap);
    }
  };

  // No pan/zoom (Phase 1, confirmed scope) — each client just scales the
  // fixed LOGICAL_W×LOGICAL_H surface to fit its own container width.
  // Fabric's setZoom handles that for the committed-stroke canvas (and its
  // own enableRetinaScaling default keeps that backing store crisp); the
  // raw overlay canvas needs the same scale factor applied by hand since
  // nothing manages it automatically.
  Whiteboard.prototype._applySize = function () {
    if (this._destroyed) return;
    var wrapW = this._canvasWrap.clientWidth || 800;
    var scale = wrapW / LOGICAL_W;
    var cssW  = wrapW;
    var cssH  = LOGICAL_H * scale;
    var dpr   = Math.min(global.devicePixelRatio || 1, MAX_DPR);

    this._scale = scale;
    this._dpr   = dpr;

    this._fabricCanvas.setDimensions({ width: cssW, height: cssH });
    this._fabricCanvas.setZoom(scale);

    var ov = this._overlayEl;
    ov.style.width  = cssW + 'px';
    ov.style.height = cssH + 'px';
    ov.width  = Math.round(cssW * dpr);
    ov.height = Math.round(cssH * dpr);

    this._dirty = true;
  };

  Whiteboard.prototype._getPos = function (e) {
    var rect = this._overlayEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this._scale,
      y: (e.clientY - rect.top)  / this._scale
    };
  };

  /* ---- Pointer handling (mouse / touch / pen — no input-mode gating,
     unlike the exam scratch-canvas, everyone drawing here is expected to
     use whatever they have) ---- */

  Whiteboard.prototype._bindPointerEvents = function () {
    var self = this;
    var el = this._overlayEl;

    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      var pos = self._getPos(e);
      var strokeId = genId();
      self._activePtrs[e.pointerId] = { strokeId: strokeId, points: [pos], pending: [pos], lastSentAt: 0, lastSentPos: null };
      self._liveStrokes.set('m:' + strokeId, { points: [pos], color: self._color, width: self._width });
      self._dirty = true;
    });

    el.addEventListener('pointermove', function (e) {
      var st = self._activePtrs[e.pointerId];
      if (!st) return;
      e.preventDefault();
      var pos = self._getPos(e);
      st.points.push(pos);
      st.pending.push(pos);
      self._liveStrokes.get('m:' + st.strokeId).points = st.points;
      self._dirty = true;
      self._maybeFlush(st);
    });

    function finish(e) {
      var st = self._activePtrs[e.pointerId];
      if (!st) return;
      delete self._activePtrs[e.pointerId];
      self._flush(st);
      self._send('stroke:end', { strokeId: st.strokeId });
      self._liveStrokes.delete('m:' + st.strokeId);
      self._dirty = true;
      self._commitStroke(st.points);
    }
    el.addEventListener('pointerup', finish);
    // Not gated to touch — mirrors drawing-canvas.js's own reasoning: a
    // fast stylus swipe off the canvas edge fires pointerleave, not
    // pointerup, and a stroke left "stuck" active would never commit.
    el.addEventListener('pointerleave', finish);
    el.addEventListener('pointercancel', function (e) {
      var st = self._activePtrs[e.pointerId];
      if (!st) return;
      delete self._activePtrs[e.pointerId];
      self._liveStrokes.delete('m:' + st.strokeId);
      self._dirty = true;
      self._send('stroke:cancel', { strokeId: st.strokeId });
    });
  };

  Whiteboard.prototype._maybeFlush = function (st) {
    var now = (global.performance || Date).now();
    var last = st.points[st.points.length - 1];
    var moved = !st.lastSentPos || dist(st.lastSentPos, last) >= BROADCAST_PX;
    if (moved || now - st.lastSentAt >= BROADCAST_MS) this._flush(st);
  };

  Whiteboard.prototype._flush = function (st) {
    if (!st.pending.length) return;
    this._send('stroke:point', { strokeId: st.strokeId, color: this._color, width: this._width, points: st.pending });
    st.pending = [];
    st.lastSentAt = (global.performance || Date).now();
    st.lastSentPos = st.points[st.points.length - 1];
  };

  Whiteboard.prototype._send = function (event, payload) {
    if (!this._channel) return;
    payload.userId = this._userId;
    this._channel.send({ type: 'broadcast', event: event, payload: payload });
  };

  // A tap with no movement never rendered anything and isn't worth a row —
  // same rule drawing-canvas.js uses for its own strokes.
  Whiteboard.prototype._commitStroke = function (points) {
    if (points.length < 2) return;
    var path = smoothPathString(points);
    var self = this;
    this._supabase.from('whiteboard_objects').insert({
      session_id: this._sessionId,
      class_id:   this._classId,
      created_by: this._userId,
      kind: 'stroke',
      fabric_json: { path: path, stroke: this._color, strokeWidth: this._width }
    }).select().single().then(function (res) {
      if (self._destroyed) return;
      if (res.error) { console.error('[Whiteboard] commit failed', res.error); return; }
      self._addObjectIfNew(res.data);
      self._fabricCanvas.requestRenderAll();
    });
  };

  /* ---- Realtime ---- */

  Whiteboard.prototype._connectRealtime = function () {
    var self = this;
    this._channel = this._supabase
      .channel('whiteboard-' + this._sessionId, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'stroke:point' }, function (msg) { self._onRemotePoint(msg.payload); })
      .on('broadcast', { event: 'stroke:end' },   function (msg) { self._onRemoteStrokeGone(msg.payload); })
      .on('broadcast', { event: 'stroke:cancel' }, function (msg) { self._onRemoteStrokeGone(msg.payload); })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'whiteboard_objects', filter: 'session_id=eq.' + this._sessionId
      }, function (p) { self._addObjectIfNew(p.new); self._fabricCanvas.requestRenderAll(); })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'whiteboard_objects', filter: 'session_id=eq.' + this._sessionId
      }, function (p) { self._removeObjectById(p.old && p.old.id); self._fabricCanvas.requestRenderAll(); })
      .subscribe(function (status, err) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Whiteboard] realtime channel', status, err);
        }
      });
  };

  Whiteboard.prototype._onRemotePoint = function (payload) {
    var key = 'r:' + payload.strokeId;
    var entry = this._liveStrokes.get(key);
    if (!entry) {
      entry = { points: [], color: payload.color, width: payload.width };
      this._liveStrokes.set(key, entry);
    }
    entry.points = entry.points.concat(payload.points);
    this._dirty = true;
  };

  Whiteboard.prototype._onRemoteStrokeGone = function (payload) {
    this._liveStrokes.delete('r:' + payload.strokeId);
    this._dirty = true;
  };

  // Shared by three call sites (my own commit, a remote INSERT, the bulk
  // historical load) so all three stay trivially idempotent regardless of
  // arrival order — e.g. a stroke committed the instant before a bulk
  // fetch runs could otherwise arrive via both paths.
  Whiteboard.prototype._addObjectIfNew = function (row) {
    if (!row || this._committedIds.has(row.id)) return;
    this._committedIds.add(row.id);
    var j = row.fabric_json || {};
    var path = new fabric.Path(j.path, {
      stroke: j.stroke,
      strokeWidth: j.strokeWidth,
      fill: null,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      selectable: false,
      evented: false,
      data: { id: row.id, ownerId: row.created_by }
    });
    this._fabricCanvas.add(path);
  };

  Whiteboard.prototype._removeObjectById = function (id) {
    if (!id) return;
    this._committedIds.delete(id);
    var obj = this._fabricCanvas.getObjects().find(function (o) { return o.data && o.data.id === id; });
    if (obj) this._fabricCanvas.remove(obj);
  };

  Whiteboard.prototype._loadExisting = function () {
    var self = this;
    this._supabase.from('whiteboard_objects').select('*').eq('session_id', this._sessionId)
      .order('seq', { ascending: true })
      .then(function (res) {
        if (self._destroyed) return;
        if (res.error) { console.error('[Whiteboard] load failed', res.error); return; }
        (res.data || []).forEach(function (row) { self._addObjectIfNew(row); });
        self._fabricCanvas.requestRenderAll();
      });
  };

  Whiteboard.prototype._clearMine = function () {
    var self = this;
    this._supabase.from('whiteboard_objects').delete()
      .eq('session_id', this._sessionId).eq('created_by', this._userId)
      .select('id')
      .then(function (res) {
        if (res.error) { global.BM && BM.toast && BM.toast('Eroare: ' + res.error.message, 'error'); return; }
        (res.data || []).forEach(function (r) { self._removeObjectById(r.id); });
        self._fabricCanvas.requestRenderAll();
      });
  };

  /* ---- Render loop (overlay only — Fabric renders itself on demand) ---- */

  Whiteboard.prototype._startLoop = function () {
    var self = this;
    function tick() {
      if (self._destroyed) return;
      if (self._dirty) { self._redrawOverlay(); self._dirty = false; }
      self._rafId = requestAnimationFrame(tick);
    }
    this._rafId = requestAnimationFrame(tick);
  };

  Whiteboard.prototype._redrawOverlay = function () {
    var ctx = this._overlayCtx;
    var el  = this._overlayEl;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.setTransform(this._scale * this._dpr, 0, 0, this._scale * this._dpr, 0, 0);
    this._liveStrokes.forEach(function (s) { drawSmoothStroke(ctx, s.points, s.color, s.width); });
  };

  /* ---- Teardown ---- */

  Whiteboard.prototype.destroy = function () {
    this._destroyed = true;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    clearTimeout(this._resizeTimer);
    if (this._ro) this._ro.disconnect();
    if (this._channel) this._supabase.removeChannel(this._channel);
    if (this._fabricCanvas) this._fabricCanvas.dispose();
    if (this._wrap && this._wrap.parentNode) this._wrap.parentNode.removeChild(this._wrap);
  };

  global.Whiteboard = Whiteboard;

})(window);
