/* ============================================================
   Whiteboard — live collaborative drawing surface ("Tablă live")
   Phase 1: shared freehand pen/highlighter/eraser, fixed color per
   participant, width picker, undo/redo (own strokes only, Ctrl+Z/Ctrl+Y),
   "șterge ce am desenat eu", a teacher-toggled per-participant write lock,
   and a per-viewer pan/zoom tool (own navigation only — never synced,
   everyone else keeps seeing the same shared logical board regardless of
   what any one viewer is zoomed into). No erasing anyone else's stroke, no
   text/shapes yet — those are later phases (see the Phase-2 notes at
   _eraseAt and in 20260904160000_whiteboard_objects.sql).

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
  // Same values as js/drawing-canvas.js's own highlighter — one consistent
  // look for "highlighter" across every drawing surface in the app.
  var HIGHLIGHTER_OPACITY    = 0.28;
  var HIGHLIGHTER_WIDTH_MULT = 2.2;

  // 1 = the "fit the whole board in the container" scale computed fresh in
  // _applySize every resize — MIN_ZOOM stays 1 rather than allowing zoom
  // OUT below that, since there's nothing more of the board to reveal past
  // "fully visible" (it would just shrink into a smaller box with empty
  // margin, not show anything new).
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 4;
  var ZOOM_STEP = 0.25;

  // The browser's built-in 'crosshair' cursor is a thin, plain dark line —
  // easy to lose against the board's own white background. Same fix (and
  // same reasoning) as js/drawing-canvas.js's own CROSSHAIR_CURSOR: a white
  // halo behind a dark core line stays visible either way.
  var CROSSHAIR_CURSOR_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">' +
    '<line x1="11" y1="1" x2="11" y2="21" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>' +
    '<line x1="1" y1="11" x2="21" y2="11" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>' +
    '<line x1="11" y1="2" x2="11" y2="20" stroke="#1a1a1a" stroke-width="1.4" stroke-linecap="round"/>' +
    '<line x1="2" y1="11" x2="20" y2="11" stroke="#1a1a1a" stroke-width="1.4" stroke-linecap="round"/>' +
    '</svg>';
  var CROSSHAIR_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent(CROSSHAIR_CURSOR_SVG) + '") 11 11, crosshair';

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function genId() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  // Reconstructs an approximate polyline from a committed stroke's SVG path
  // string (smoothPathString's own output: "M x y" then repeated "Q cx cy
  // mx my" then a final "L x y") — used only for the eraser's hit-testing
  // against MY OWN older strokes, which weren't drawn this session so their
  // original points[] array (available live in _commitStroke) is long gone;
  // this is the only record left. Each Q's end point (the midpoint) stands
  // in for that segment of the original curve — close enough for a
  // tolerance-based "is the pointer near this stroke" check, not meant to
  // be exact.
  function parsePathPoints(d) {
    var pts = [];
    if (!d) return pts;
    var tokens = d.match(/[MLQ]|-?\d*\.?\d+/g) || [];
    var i = 0;
    while (i < tokens.length) {
      var cmd = tokens[i];
      if (cmd === 'M' || cmd === 'L') {
        pts.push({ x: parseFloat(tokens[i + 1]), y: parseFloat(tokens[i + 2]) });
        i += 3;
      } else if (cmd === 'Q') {
        pts.push({ x: parseFloat(tokens[i + 3]), y: parseFloat(tokens[i + 4]) });
        i += 5;
      } else {
        i++;
      }
    }
    return pts;
  }

  function distToSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var lenSq = dx * dx + dy * dy;
    var t = lenSq ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq)) : 0;
    return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
  }

  function distToPolyline(p, pts) {
    if (!pts.length) return Infinity;
    if (pts.length === 1) return dist(p, pts[0]);
    var min = Infinity;
    for (var i = 0; i < pts.length - 1; i++) {
      var d2 = distToSegment(p, pts[i], pts[i + 1]);
      if (d2 < min) min = d2;
    }
    return min;
  }

  // "select" tool's rubber-band drag — a and b are its two corners in
  // either order (whichever direction the user actually dragged), so
  // this always returns a min/max-normalized box regardless.
  function normalizedRect(a, b) {
    return { minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) };
  }

  function rectsIntersect(r1, r2) {
    return r1.minX <= r2.maxX && r1.maxX >= r2.minX && r1.minY <= r2.maxY && r1.maxY >= r2.minY;
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

  function drawSmoothStroke(ctx, points, color, width, opacity) {
    if (!points.length) return;
    ctx.save();
    ctx.globalAlpha = opacity == null ? 1 : opacity;
    if (points.length === 1) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
    ctx.restore();
  }

  // The two open-chevron "barb" endpoints of an arrowhead at p1, pointing
  // back toward p0 — shared by straightPathString (the committed SVG path)
  // and drawStraightStroke (the live preview) so a stroke never visibly
  // "snaps" to a differently-shaped head the instant it's finalized, same
  // reasoning as smoothPathString/drawSmoothStroke's own split above.
  function arrowBarbPoints(p0, p1) {
    var dx = p1.x - p0.x, dy = p1.y - p0.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var theta = Math.atan2(dy, dx);
    // Scales down for a short arrow (so the head doesn't dwarf the shaft)
    // but caps out for a long one (so it doesn't grow huge) — 14..28
    // logical units either way.
    var headLen = Math.min(28, Math.max(14, len * 0.28));
    var spread = Math.PI / 7; // ~25.7° off the reverse-of-shaft direction, each side
    return [1, -1].map(function (sign) {
      var ang = theta + Math.PI + sign * spread;
      return { x: p1.x + headLen * Math.cos(ang), y: p1.y + headLen * Math.sin(ang) };
    });
  }

  // Straight-line tools (line/dashed-line/arrow) — a plain 2-point path,
  // no smoothing (unlike smoothPathString's freehand curve-fit) since
  // these are meant to look ruler-straight. 'arrow' appends a second
  // subpath (a fresh M) for the chevron head — parsePathPoints' own
  // tokenizer doesn't distinguish M from L, so the eraser's hit-testing
  // reconstruction still picks up all of it (with one harmless, invisible
  // zero-length "connector" between subpaths — see its own comment).
  function straightPathString(p0, p1, shape) {
    var d = 'M ' + p0.x + ' ' + p0.y + ' L ' + p1.x + ' ' + p1.y;
    if (shape !== 'arrow') return d;
    var barbs = arrowBarbPoints(p0, p1);
    d += ' M ' + barbs[0].x + ' ' + barbs[0].y + ' L ' + p1.x + ' ' + p1.y + ' L ' + barbs[1].x + ' ' + barbs[1].y;
    return d;
  }

  // Live preview of an in-progress line/dashed-line/arrow — see the
  // shape-tool branch in _bindPointerEvents for how p0/p1 are tracked
  // (always exactly the gesture's start and current point, never a full
  // polyline the way freehand drawing accumulates one).
  function drawStraightStroke(ctx, p0, p1, color, width, opacity, shape) {
    ctx.save();
    ctx.globalAlpha = opacity == null ? 1 : opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth   = width;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.setLineDash(shape === 'dashed-line' ? [width * 3, width * 2.4] : []);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    if (shape === 'arrow') {
      var barbs = arrowBarbPoints(p0, p1);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(barbs[0].x, barbs[0].y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(barbs[1].x, barbs[1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * @param {HTMLElement} container - mounted into this element (emptied first? no — caller owns that)
   * @param {object} opts
   *   supabase   - the shared BMAuth.supabase client
   *   sessionId  - whiteboard_sessions.id
   *   classId    - classes.id (denormalized onto every whiteboard_objects row)
   *   userId     - auth.uid()
   *   userColor  - this participant's fixed color (from whiteboard_participants.color)
   *   locked     - this participant's current write-lock state (also
   *                whiteboard_participants.locked) — kept live afterwards
   *                via setLocked(), not re-read from here again.
   *   isTeacher  - whether THIS participant is the class teacher — the
   *                only one who gets the grid toggle in their toolbar at
   *                all (see _build/setGridEnabled).
   *   gridOn     - the session's CURRENT grid state (whiteboard_sessions.
   *                grid_enabled) — a global, teacher-controlled setting
   *                shared by every participant, not a per-viewer
   *                preference; kept live afterwards via setGridEnabled(),
   *                wired from js/class-page.js's session subscription,
   *                same shape as locked/setLocked above.
   */
  function Whiteboard(container, opts) {
    this._supabase  = opts.supabase;
    this._sessionId = opts.sessionId;
    this._classId   = opts.classId;
    this._userId    = opts.userId;
    this._color     = opts.userColor;
    this._width     = WIDTH_PRESETS[0];
    this._tool      = 'pen'; // 'pen' | 'highlighter' | 'eraser' | 'select' | 'line' | 'dashed-line' | 'arrow' | 'pan'
    // Blocked by the teacher (whiteboard_participants.locked) — see
    // setLocked(), wired live from js/class-page.js's roster subscription.
    // Blocks starting anything new; a stroke already mid-gesture when the
    // lock lands is left to finish rather than yanked away mid-draw.
    this._locked    = !!opts.locked;
    this._isTeacher = !!opts.isTeacher;
    this._gridOn    = !!opts.gridOn;

    this._liveStrokes  = new Map();  // key -> {points:[{x,y}], color, width, opacity}
    this._activePtrs   = {};         // pointerId -> {strokeId, points, pending, lastSentAt, lastSentPos, erasing, panning}
    // Raw last-known position of every currently-down TOUCH pointer (mouse/
    // pen excluded — pinch is a touch-only gesture), independent of
    // _activePtrs' per-gesture state — see _touchCount/_beginPinch.
    this._touchPositions = {};
    this._pinching       = false;
    this._pinchStartDist = null;
    this._pinchStartZoom = 1;
    this._committedIds = new Set();
    // My own committed strokes' points, for the eraser's hit-testing — see
    // parsePathPoints's comment for why this needs both a live (exact) and
    // a reconstructed-from-path (approximate) source. Only ever populated
    // for MY OWN strokes; erasing anyone else's is Phase 2 (a teacher-can-
    // delete-any-stroke policy hasn't been added yet — see the SQL comment
    // in 20260904160000_whiteboard_objects.sql).
    this._myPathPoints   = new Map(); // id -> points[]
    // Every object's Fabric left/top the instant it's constructed, BEFORE
    // any stored offsetX/offsetY (see the "select" move tool) is applied —
    // needed for every viewer, not just an object's owner, since applying
    // a MOVE (mine or a remote one) always means "natural position + the
    // CURRENT offset", never a relative nudge from wherever it visually
    // happens to be already.
    this._objectNaturalPos = new Map(); // id -> {left, top}
    // The two below are scoped to MY OWN objects only, same ownership
    // rule as _myPathPoints and the eraser/delete RLS policy — moving
    // someone else's object is Phase 2, same deferral as erasing one (see
    // _eraseAt's own comment). _myObjectOffsets mirrors what's currently
    // persisted (or optimistically about to be) so hit-testing/dragging
    // never has to re-derive it from Fabric's own left/top; _myObjectsJson
    // caches each object's last-known full fabric_json so a move's UPDATE
    // can merge into it without re-fetching the row first.
    this._myObjectOffsets = new Map(); // id -> {dx, dy}
    this._myObjectsJson   = new Map(); // id -> fabric_json
    // "select" tool's current multi-selection (own objects only, ids into
    // the maps above) — a rubber-band drag over empty space replaces this
    // wholesale, a click adds/refocuses it, see _bindPointerEvents. Drawn
    // as highlight boxes by _drawSelectionOverlay; cleared on tool switch,
    // on erasing a selected object, or on selecting empty space.
    this._selectedIds = new Set();
    // {start:{x,y}, current:{x,y}} logical-space rectangle while a
    // rubber-band selection drag is in progress, else null — kept
    // separate from the per-pointer gesture state in _activePtrs so
    // _drawSelectionOverlay has one obvious place to read it from.
    this._activeRubberBand = null;
    this._myStrokeHistory = [];       // [{id, fabric_json}] — undo stack, oldest first
    this._myRedoStack     = [];
    // Bumped by _clearMine() — a stroke whose in-flight commit (see
    // _commitStroke) started before that bump but resolves after it would
    // otherwise land in the DB and get added to the canvas AFTER "clear
    // mine" already ran, leaving one stray element behind. Each commit
    // captures the generation it started under and, if it no longer
    // matches when the insert resolves, deletes what it just inserted
    // instead of drawing it.
    this._clearGen     = 0;
    this._dirty       = false;
    this._rafId       = null;
    this._destroyed    = false;
    // _scale is the TOTAL effective logical->CSS-px scale (_baseScale *
    // _zoom) — _getPos/_redrawOverlay/_redrawGrid/Fabric's own
    // viewportTransform all read this combined value directly, so only
    // _applySize (which computes it) and the zoom code need to know about
    // the two factors separately.
    this._scale     = 1;
    this._baseScale = 1; // the "whole board fits the container" scale alone
    this._zoom      = MIN_ZOOM;
    this._dpr   = 1;
    // _panX/_panY: the "camera" — canvas-pixel translation applied on top
    // of _scale (Fabric's own viewportTransform is exactly [_scale, 0, 0,
    // _scale, _panX, _panY], see _syncViewport). null here specifically
    // (not 0) is how _applySize tells "never sized before" apart from "sized
    // before, camera legitimately at 0,0" — see its own comment.
    this._panX = null;
    this._panY = null;
    // Last viewport size _applySize actually computed a camera for — needed
    // because a resize's ResizeObserver callback only sees the NEW size on
    // this._canvasWrap by the time it runs, and re-centering across a
    // resize needs the OLD size too (see _applySize).
    this._viewportW = null;
    this._viewportH = null;

    this._build(container);
    this._initFabric();
    this._bindToolbar();
    this._bindPointerEvents();
    this._bindKeyboard();
    this._connectRealtime();
    this._loadExisting();
    this._startLoop();
  }

  /* ---- DOM ---- */

  var GRID_ICON = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>';
  // The grid's desired ON-SCREEN cell size, in CSS px — NOT a logical size.
  // _redrawGrid derives the actual logical spacing from this fresh on every
  // redraw (target ÷ current scale), so cells stay this same size on
  // screen at any zoom instead of growing/shrinking (and, at high zoom,
  // becoming too coarse to write comfortably against) the way a fixed
  // LOGICAL spacing would.
  var GRID_CELL_TARGET_PX = 40;

  // Same icon glyphs js/drawing-canvas.js uses for these exact tools/actions
  // — one consistent visual language across every drawing surface in the
  // app (the CSS classes are already deliberately shared, see the note on
  // .wb-board in css/style.css).
  var PEN_ICON         = '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
  var HIGHLIGHTER_ICON = '<path d="M4 20h4l10.5-10.5-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>';
  var ERASER_ICON      = '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>';
  // Classic tilted arrow-cursor glyph — the universal "selection tool"
  // icon in every drawing app, distinct from PAN_ICON's open hand (that
  // one moves the CAMERA; this one moves an OBJECT — see _findMyObjectAt).
  var SELECT_ICON      = '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>';
  // Same plain-diagonal glyph as the geometry figure editor's own segment
  // tool (js/geometry-figure-editor.js's TOOL_ICONS.segment /
  // 'segment-dashed'), minus its draggable-endpoint dots — a whiteboard
  // line isn't editable after the fact the way a geometry segment is, so
  // there's nothing for those dots to represent here.
  var LINE_ICON         = '<path d="M5 19 19 5"/>';
  var DASHED_LINE_ICON  = '<path d="M5 19 19 5" stroke-dasharray="3.6 3.2"/>';
  var ARROW_ICON        = '<path d="M5 19 19 5"/><path d="M19 5 12 7"/><path d="M19 5 17 12"/>';
  var PAN_ICON         = '<rect x="6" y="11" width="12" height="9" rx="3"/><path d="M9 11V6a1.5 1.5 0 0 1 3 0v5"/><path d="M12 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M15 11.5V7a1.5 1.5 0 0 1 3 0v6"/>';
  var UNDO_ICON        = '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>';
  var ZOOM_OUT_ICON    = '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>';
  var ZOOM_IN_ICON     = '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>';

  function toolBtn(tool, icon, title) {
    return '<button type="button" class="dc-tool-btn' + (tool === 'pen' ? ' dc-tool-btn--active' : '') +
      '" data-tool="' + tool + '" title="' + title + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg>' +
    '</button>';
  }

  Whiteboard.prototype._build = function (container) {
    var wrap = document.createElement('div');
    wrap.className = 'wb-board';
    wrap.innerHTML =
      '<div class="dc-toolbar wb-toolbar">' +
        // Three small tool groups (manipulate / ink / line shapes) with
        // breathing room between them but no divider bars —
        // dc-tool-group--nodiv overrides the toolbar's usual adjacent-
        // sibling divider (see its own CSS rule) for just these, same
        // lighter-touch grouping idroo's own toolbar uses. The width
        // picker/grid/zoom/undo groups after this keep their normal
        // divider — those are separate FUNCTIONAL areas, not sub-groups
        // of "the tools".
        '<div class="dc-tool-group dc-tool-group--nodiv">' +
          toolBtn('select', SELECT_ICON, 'Selectează și mută ce am desenat eu (S)') +
          toolBtn('pan', PAN_ICON, 'Mișcă vizualizarea — trage pentru a naviga (M)') +
          toolBtn('eraser', ERASER_ICON, 'Radieră — șterge ce am desenat eu (E)') +
        '</div>' +
        '<div class="dc-tool-group dc-tool-group--nodiv">' +
          toolBtn('pen', PEN_ICON, 'Stilou (P)') +
          toolBtn('highlighter', HIGHLIGHTER_ICON, 'Marker (H)') +
        '</div>' +
        '<div class="dc-tool-group dc-tool-group--nodiv">' +
          toolBtn('line', LINE_ICON, 'Linie dreaptă') +
          toolBtn('dashed-line', DASHED_LINE_ICON, 'Linie punctată') +
          toolBtn('arrow', ARROW_ICON, 'Săgeată') +
        '</div>' +
        '<div class="dc-tool-group">' +
          WIDTH_PRESETS.map(function (w, i) {
            var dotSize = 3 + i * 3;
            return '<button type="button" class="dc-width-btn' + (i === 0 ? ' dc-width-btn--active' : '') +
              '" data-width="' + w + '" title="Grosime linie">' +
              '<span class="dc-width-dot" style="width:' + dotSize + 'px;height:' + dotSize + 'px"></span></button>';
          }).join('') +
        '</div>' +
        // Grid ON/OFF is a global, teacher-controlled session setting (see
        // setGridEnabled) — a student never gets this button at all, not
        // just a disabled one, so their toolbar doesn't imply a control
        // they don't have.
        (this._isTeacher ?
        '<div class="dc-tool-group">' +
          '<button type="button" class="dc-action-btn' + (this._gridOn ? ' dc-action-btn--active' : '') + '" id="wbGridBtn" title="' + (this._gridOn ? 'Ascunde grila' : 'Arată grila') + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + GRID_ICON + '</svg>' +
          '</button>' +
        '</div>' : '') +
        '<div class="dc-tool-group">' +
          '<button type="button" class="dc-action-btn" id="wbZoomOutBtn" title="Micșorează" disabled>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ZOOM_OUT_ICON + '</svg>' +
          '</button>' +
          '<span class="dc-zoom-label" id="wbZoomLabel">100%</span>' +
          '<button type="button" class="dc-action-btn" id="wbZoomInBtn" title="Mărește">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ZOOM_IN_ICON + '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="dc-tool-group dc-tool-group--right">' +
          '<button type="button" class="dc-action-btn" id="wbUndoBtn" title="Anulează (Ctrl+Z)" disabled>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + UNDO_ICON + '</svg>' +
          '</button>' +
          '<button type="button" class="dc-action-btn" id="wbRedoBtn" title="Reface (Ctrl+Y)" disabled>' +
            '<svg class="dc-icon-mirror" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + UNDO_ICON + '</svg>' +
          '</button>' +
          '<button type="button" class="dc-action-btn dc-action-btn--danger" id="wbClearMineBtn" title="Șterge ce am desenat eu">' +
            (global.icon ? global.icon('trash-2', { size: 16 }) : '×') +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="wb-canvas-outer" id="wbCanvasOuter">' +
        '<div class="wb-locked-banner" id="wbLockedBanner">' +
          (global.icon ? global.icon('lock', { size: 16 }) : '') +
          '<span>Profesorul a blocat temporar scrisul tău pe această tablă</span>' +
        '</div>' +
        '<div class="wb-canvas-wrap" id="wbCanvasWrap">' +
          '<canvas class="wb-grid-canvas" id="wbGridCanvas"></canvas>' +
          '<canvas id="wbFabricCanvas"></canvas>' +
        '</div>' +
      '</div>';
    container.appendChild(wrap);

    this._wrap       = wrap;
    this._toolbarEl  = wrap.querySelector('.wb-toolbar');
    // .wb-canvas-wrap (not -outer) is the actual pan/zoom viewport — see
    // the CSS comment on it for why the locked banner needed pulling out
    // of it into its own non-overlapping strip instead of floating on top
    // of the canvas. Three canvases stack inside it, all pinned to its own
    // fixed size (never resized by pan/zoom — see that same CSS comment):
    // the grid/paper background (below), Fabric's committed strokes
    // (#wbFabricCanvas), and the live in-progress-stroke overlay (appended
    // by _initFabric).
    this._canvasWrap = wrap.querySelector('#wbCanvasWrap');
    this._gridEl     = wrap.querySelector('#wbGridCanvas');
    this._gridCtx    = this._gridEl.getContext('2d');
    this._fabricEl   = wrap.querySelector('#wbFabricCanvas');
    this._lockedBannerEl = wrap.querySelector('#wbLockedBanner');
    this._zoomLabelEl   = wrap.querySelector('#wbZoomLabel');
    this._zoomOutBtnEl  = wrap.querySelector('#wbZoomOutBtn');
    this._zoomInBtnEl   = wrap.querySelector('#wbZoomInBtn');
    this._applyLockedUi();
  };

  Whiteboard.prototype._setTool = function (tool) {
    // Leaving "select" for anything else drops the selection — a stale
    // highlighted selection while some other tool is active would be
    // confusing (what does drawing/erasing do to a "selected" stroke?).
    if (this._tool === 'select' && tool !== 'select' && this._selectedIds.size) {
      this._selectedIds = new Set();
      this._dirty = true;
    }
    this._tool = tool;
    this._toolbarEl.querySelectorAll('[data-tool]').forEach(function (b) {
      b.classList.toggle('dc-tool-btn--active', b.dataset.tool === tool);
    });
    if (this._overlayEl) {
      // Locked blocks every tool except pan (pure navigation, never a
      // write — see setLocked) — that gets its usual 'grab' regardless,
      // everything else gets 'not-allowed' instead of its normal cursor so
      // it's obvious nothing will happen. Otherwise: pan gets the
      // browser's own grab/grabbing (a custom cursor for those is
      // unnecessary — already high-contrast), eraser a plain 'cell',
      // select the plain arrow (it's the one tool that ISN'T about
      // marking the board, so the high-visibility crosshair would be
      // misleading here), and pen/highlighter/the line tools the
      // high-visibility crosshair (see its own comment above for why not
      // the plain CSS keyword).
      this._overlayEl.style.cursor =
        (this._locked && tool !== 'pan') ? 'not-allowed' :
        tool === 'eraser' ? 'cell' : tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : CROSSHAIR_CURSOR;
    }
  };

  Whiteboard.prototype._bindToolbar = function () {
    var self = this;
    this._toolbarEl.addEventListener('click', function (e) {
      var toolBtnEl = e.target.closest('[data-tool]');
      var widthBtn  = e.target.closest('[data-width]');
      var clearBtn  = e.target.closest('#wbClearMineBtn');
      var gridBtn   = e.target.closest('#wbGridBtn');
      var undoBtn   = e.target.closest('#wbUndoBtn');
      var redoBtn   = e.target.closest('#wbRedoBtn');
      var zoomInBtn  = e.target.closest('#wbZoomInBtn');
      var zoomOutBtn = e.target.closest('#wbZoomOutBtn');
      if (toolBtnEl) {
        self._setTool(toolBtnEl.dataset.tool);
      } else if (widthBtn) {
        self._width = parseInt(widthBtn.dataset.width, 10);
        self._toolbarEl.querySelectorAll('.dc-width-btn').forEach(function (b) {
          b.classList.toggle('dc-width-btn--active', b === widthBtn);
        });
      } else if (clearBtn) {
        self._clearMine();
      } else if (gridBtn) {
        // Teacher-only (see _build) — a global session setting, not a
        // per-viewer one, so this both applies locally right away AND
        // persists it for every other participant (setGridEnabled itself
        // is what js/class-page.js's session subscription calls on their
        // end when this UPDATE lands). Reverted on failure since the
        // local flip above already happened optimistically.
        var next = !self._gridOn;
        self.setGridEnabled(next);
        self._supabase.from('whiteboard_sessions').update({ grid_enabled: next }).eq('id', self._sessionId)
          .then(function (res) {
            if (res.error) {
              self.setGridEnabled(!next);
              global.BM && BM.toast && BM.toast('Eroare: ' + res.error.message, 'error');
            }
          });
      } else if (undoBtn && !undoBtn.disabled) {
        self.undo();
      } else if (redoBtn && !redoBtn.disabled) {
        self.redo();
      } else if (zoomInBtn && !zoomInBtn.disabled) {
        self._setZoom(self._currentOrPendingZoom() + ZOOM_STEP);
      } else if (zoomOutBtn && !zoomOutBtn.disabled) {
        self._setZoom(self._currentOrPendingZoom() - ZOOM_STEP);
      }
    });
  };

  // Desktop only in practice (there's no keyboard on a phone/tablet to fire
  // these), bound at the window so it works regardless of which element
  // has focus — except a real text input, where Ctrl+Z/Ctrl+Y and the
  // P/H/E letters should do their normal text-editing thing instead (the
  // session-title field in js/class-page.js's header lives in the same
  // document and isn't part of this component, but keydown at window level
  // reaches it all the same).
  Whiteboard.prototype._bindKeyboard = function () {
    var self = this;
    this._keyHandler = function (e) {
      var t = document.activeElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        self.undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        self.redo();
      } else if (e.key === 'p' || e.key === 'P') {
        self._setTool('pen');
      } else if (e.key === 'h' || e.key === 'H') {
        self._setTool('highlighter');
      } else if (e.key === 'e' || e.key === 'E') {
        self._setTool('eraser');
      } else if (e.key === 's' || e.key === 'S') {
        self._setTool('select');
      } else if (e.key === 'm' || e.key === 'M') {
        self._setTool('pan');
      }
    };
    global.addEventListener('keydown', this._keyHandler);
  };

  /* ---- Fabric canvas (committed strokes) ---- */

  Whiteboard.prototype._initFabric = function () {
    this._fabricCanvas = new fabric.Canvas(this._fabricEl, {
      selection: false,
      evented: false,          // no per-object interaction in Phase 1 — we own all pointer handling via the overlay
      renderOnAddRemove: false // batched — every call site below does its own requestRenderAll()
      // No backgroundColor here — .wb-grid-canvas's white/grid paint
      // underneath shows through the transparent fabric canvas instead
      // (see the contrast note on that class for why it's fixed-white,
      // never theme-linked).
    });

    // Overlay canvas: raw 2D context, captures every pointer event, renders
    // only the in-progress stroke (mine + everyone else's). A sibling of
    // Fabric's own canvas directly inside .wb-canvas-wrap — all three
    // canvas layers (grid, Fabric, overlay) are pinned to the wrap's own
    // fixed size via CSS inset:0 and never resized by pan/zoom, so the
    // overlay always lines up with Fabric's canvas exactly — see the CSS
    // comment on .wb-canvas-wrap for why.
    var overlay = document.createElement('canvas');
    overlay.className = 'wb-overlay-canvas';
    overlay.style.touchAction = 'none'; // prevent the page from scrolling/pinch-zooming while drawing
    this._canvasWrap.appendChild(overlay);
    this._overlayEl  = overlay;
    this._overlayCtx = overlay.getContext('2d');

    this._applySize();
    this._setTool(this._tool); // applies the initial (high-visibility) cursor — see its own comment
    this._updateZoomUi();

    var self = this;
    if (global.ResizeObserver) {
      this._ro = new ResizeObserver(function () {
        clearTimeout(self._resizeTimer);
        self._resizeTimer = setTimeout(function () { self._applySize(); }, 80);
      });
      this._ro.observe(this._canvasWrap);
    }

    // Ctrl/Cmd+wheel zooms, centered on the cursor — same convention as
    // js/drawing-canvas.js and the geometry figure editor. A plain scroll
    // pans instead, same as Miro/idroo — .wb-canvas-wrap is no longer a
    // real scrollable element (see its own CSS comment), so this is now
    // the only way a plain scroll/trackpad-swipe moves the view; we always
    // preventDefault so the page itself never scrolls out from under a
    // pan gesture.
    this._canvasWrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        self._setZoom(self._currentOrPendingZoom() * Math.pow(0.999, e.deltaY), e.clientX, e.clientY);
        return;
      }
      self._panX -= e.deltaX;
      self._panY -= e.deltaY;
      self._clampCamera();
      self._syncViewport();
    }, { passive: false });
  };

  // Each client scales the fixed LOGICAL_W×LOGICAL_H surface to its own
  // container — this._scale is (fit-to-container "base" scale) × (this
  // viewer's own zoom, see _setZoom), never anyone else's. "Fit" means
  // contain (both width AND height bounded), not width-only — a
  // fullscreen board is shown on every device shape from a phone in
  // portrait to an ultrawide monitor, and width-only scaling would either
  // overflow a short viewport or leave a tall one mostly empty.
  //
  // Unlike the very first version of this file, this does NOT run on
  // every zoom/pan change anymore — only on a genuine container resize
  // (ResizeObserver, debounced) and once at startup. All three canvas
  // layers are sized to the WRAP's own fixed CSS size here, never to the
  // zoomed board size, and pan/zoom afterwards only ever change
  // this._scale/_panX/_panY plus Fabric's viewportTransform (see
  // _syncViewport) — never these elements' width/height. That split is
  // what actually fixes two bugs the old resize-the-canvas-every-zoom-step
  // approach had: setting a canvas element's width/height attribute
  // (which resizing to the zoomed size required, every step) clears its
  // bitmap SYNCHRONOUSLY, but Fabric's own redraw into the now-blank
  // canvas is scheduled for a LATER frame — a fast zoom gesture could
  // keep clearing it again before that redraw ever got an uninterrupted
  // frame to land in, so the board would visibly go blank until the
  // gesture stopped. And since the backing store's size no longer grows
  // with zoom level at all, there's no more size-vs-sharpness tradeoff to
  // manage either — Fabric's own retina scaling (uncapped, automatic) and
  // this._dpr below can both just stay at full quality always.
  Whiteboard.prototype._applySize = function () {
    if (this._destroyed) return;
    // The viewport size from the LAST time this ran — needed to figure out
    // which logical point was centered before recomputing the camera for
    // the new size below (this._canvasWrap already reflects the NEW size
    // by the time a resize gets here). null on the very first call, which
    // _panX's own null-ness (see below) already short-circuits around.
    var oldVw = this._viewportW || this._canvasWrap.clientWidth  || 800;
    var oldVh = this._viewportH || this._canvasWrap.clientHeight || 600;
    var vw = this._canvasWrap.clientWidth  || 800;
    var vh = this._canvasWrap.clientHeight || 600;
    var baseScale = Math.min(vw / LOGICAL_W, vh / LOGICAL_H);
    var dpr = Math.min(global.devicePixelRatio || 1, MAX_DPR);

    // Re-center on whatever logical point was centered before (preserving
    // the user's own zoom factor, this._zoom) rather than resetting the
    // camera on every resize — null _panX specifically means "never sized
    // before", the only time we instead center on the board's own middle.
    var centerLogicalX, centerLogicalY;
    if (this._panX == null) {
      centerLogicalX = LOGICAL_W / 2;
      centerLogicalY = LOGICAL_H / 2;
    } else {
      centerLogicalX = (oldVw / 2 - this._panX) / this._scale;
      centerLogicalY = (oldVh / 2 - this._panY) / this._scale;
    }

    this._baseScale = baseScale;
    this._viewportW = vw;
    this._viewportH = vh;
    this._dpr       = dpr;
    this._scale     = baseScale * this._zoom;
    this._panX = vw / 2 - centerLogicalX * this._scale;
    this._panY = vh / 2 - centerLogicalY * this._scale;
    this._clampCamera();

    var self = this;
    [this._gridEl, this._fabricEl, this._overlayEl].forEach(function (el) {
      el.style.width  = vw + 'px';
      el.style.height = vh + 'px';
      el.width  = Math.round(vw * self._dpr);
      el.height = Math.round(vh * self._dpr);
    });
    // Fabric applies its OWN (uncapped, automatic) retina scaling on top
    // of these CSS dimensions — safe to leave uncapped now that the
    // backing store this produces is pinned to the viewport instead of
    // growing with zoom, see this method's own comment above.
    this._fabricCanvas.setDimensions({ width: vw, height: vh });

    this._syncViewport();
  };

  // Pushes the current camera (this._scale/_panX/_panY) to every layer
  // that needs it: Fabric's own viewportTransform for the committed
  // strokes (each one built with objectCaching:false in _addObjectIfNew
  // specifically so this stays crisp — see that flag's own comment for
  // why, this used to be the "blurry at high zoom" bug), the grid/paper
  // background (redrawn inline, cheap — see _redrawGrid), and the
  // live-stroke overlay (marked dirty, picked up on the next animation-
  // frame tick by _redrawOverlay so it stays batched with everyone else's
  // incoming points instead of forcing an extra paint of its own).
  Whiteboard.prototype._syncViewport = function () {
    this._fabricCanvas.setViewportTransform([this._scale, 0, 0, this._scale, this._panX, this._panY]);
    // setViewportTransform only self-triggers a render when renderOnAddRemove
    // is on, which this canvas deliberately keeps off (see _initFabric) —
    // every other call site here already does its own requestRenderAll()
    // for the same reason, this is just that same convention applied to pan/zoom.
    this._fabricCanvas.requestRenderAll();
    this._redrawGrid();
    this._dirty = true;
  };

  // Keeps the board from being panned/zoomed away into empty space with
  // no way back — the same guarantee native scrollLeft/Top clamping used
  // to give this for free back when panning was real DOM scrolling. Per
  // axis: if the board (at the current scale) is smaller than the
  // viewport, center it (same as the old margin:auto at zoom 1); if it's
  // bigger, clamp so its far edge can never leave a gap between it and
  // the viewport's own far edge, same as a native scrollbar's own limits.
  Whiteboard.prototype._clampCamera = function () {
    var vw = this._canvasWrap.clientWidth  || 1;
    var vh = this._canvasWrap.clientHeight || 1;
    this._panX = clampPanAxis(this._panX, LOGICAL_W * this._scale, vw);
    this._panY = clampPanAxis(this._panY, LOGICAL_H * this._scale, vh);
  };

  function clampPanAxis(pan, contentSize, viewportSize) {
    if (contentSize <= viewportSize) return (viewportSize - contentSize) / 2;
    return Math.min(0, Math.max(viewportSize - contentSize, pan));
  }

  // Grid/paper background — see the CSS comment on .wb-grid-canvas for why
  // this paints the white "paper" rect too, not just the grid lines: with
  // the fixed-viewport camera, no DOM element is sized/positioned to the
  // board anymore for a CSS background to show through from. Cheap enough
  // (the paper rect plus at most ~35 grid lines) to just redraw inline
  // from _syncViewport on every pan/zoom step rather than batching it
  // through the dirty-flag/rAF loop the way the overlay's live strokes
  // are — those redraw every frame during a whole gesture regardless, so
  // batching them earns its keep; a plain rect-and-some-lines redraw here
  // and there doesn't need it.
  Whiteboard.prototype._redrawGrid = function () {
    var ctx = this._gridCtx;
    var el  = this._gridEl;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, el.width, el.height);
    var s = this._scale * this._dpr;
    ctx.setTransform(s, 0, 0, s, this._panX * this._dpr, this._panY * this._dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    if (!this._gridOn) return;
    // Logical spacing re-derived from the CURRENT scale every redraw —
    // GRID_CELL_TARGET_PX ÷ scale is exactly the logical size that renders
    // as GRID_CELL_TARGET_PX on screen right now, so cells neither balloon
    // into unusably-coarse squares at high zoom nor shrink into a dense
    // mush at low zoom the way a fixed LOGICAL spacing would.
    var cellLogical = GRID_CELL_TARGET_PX / this._scale;
    ctx.strokeStyle = 'rgba(20,16,8,0.09)';
    ctx.lineWidth = 1 / s; // a true single DEVICE pixel at any zoom, never thickening/blurring as zoom grows
    ctx.beginPath();
    for (var x = 0; x <= LOGICAL_W; x += cellLogical) { ctx.moveTo(x, 0); ctx.lineTo(x, LOGICAL_H); }
    for (var y = 0; y <= LOGICAL_H; y += cellLogical) { ctx.moveTo(0, y); ctx.lineTo(LOGICAL_W, y); }
    ctx.stroke();
  };

  // clientX/clientY (viewport coordinates), when given, keep whatever
  // logical point was under the cursor/pinch-midpoint fixed on screen
  // through the zoom change. Omitted (toolbar buttons, keyboard), it
  // anchors to the center of whatever's currently visible instead.
  //
  // Coalesced to at most once per animation frame: a fast wheel or pinch
  // gesture can fire far more raw events per second than the display can
  // even paint, and there's no reason to redo the anchor math and push a
  // new viewportTransform more often than the screen can show it. Only
  // the latest requested zoom/anchor per frame is kept; anything
  // superseded before its frame comes up is simply dropped, same as any
  // other rAF-coalesced input handler.
  Whiteboard.prototype._setZoom = function (z, clientX, clientY) {
    z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z * 100) / 100));
    this._pendingZoom = { z: z, clientX: clientX, clientY: clientY };
    if (this._zoomRafId) return;
    var self = this;
    this._zoomRafId = requestAnimationFrame(function () {
      self._zoomRafId = null;
      self._applyPendingZoom();
    });
  };

  // The zoom value a caller should treat as "current" while a zoom is
  // in flight — the wheel handler computes its next zoom multiplicatively
  // off of whatever's already requested (self._zoom alone would be stale
  // until the pending one actually applies, under-zooming a fast scroll
  // that fires several events inside one frame).
  Whiteboard.prototype._currentOrPendingZoom = function () {
    return this._pendingZoom ? this._pendingZoom.z : this._zoom;
  };

  Whiteboard.prototype._applyPendingZoom = function () {
    var pending = this._pendingZoom;
    this._pendingZoom = null;
    if (!pending || this._destroyed) return;
    var z = pending.z;
    if (z === this._zoom) return;
    var wrapRect = this._canvasWrap.getBoundingClientRect();
    var anchorX = (pending.clientX != null) ? (pending.clientX - wrapRect.left) : (this._canvasWrap.clientWidth  / 2);
    var anchorY = (pending.clientY != null) ? (pending.clientY - wrapRect.top)  : (this._canvasWrap.clientHeight / 2);
    // The logical point currently under the anchor, before the scale
    // changes — solving _panX/_panY below for "this same logical point
    // maps back to this same anchor" is what keeps it visually fixed.
    var logicalX = (anchorX - this._panX) / this._scale;
    var logicalY = (anchorY - this._panY) / this._scale;

    this._zoom  = z;
    this._scale = this._baseScale * z;
    this._panX  = anchorX - logicalX * this._scale;
    this._panY  = anchorY - logicalY * this._scale;
    this._clampCamera();
    this._syncViewport();
    this._updateZoomUi();
  };

  Whiteboard.prototype._updateZoomUi = function () {
    if (this._zoomLabelEl) this._zoomLabelEl.textContent = Math.round(this._zoom * 100) + '%';
    if (this._zoomOutBtnEl) this._zoomOutBtnEl.disabled = this._zoom <= MIN_ZOOM;
    if (this._zoomInBtnEl)  this._zoomInBtnEl.disabled  = this._zoom >= MAX_ZOOM;
  };

  Whiteboard.prototype._getPos = function (e) {
    var rect = this._overlayEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this._panX) / this._scale,
      y: (e.clientY - rect.top  - this._panY) / this._scale
    };
  };

  /* ---- Touch pinch-to-zoom helpers — same technique and reasoning as
     js/drawing-canvas.js's own _touchCount/_touchDistance/_touchMidpoint,
     just tracked in this._touchPositions instead of that file's
     this._pointers (kept separate from _activePtrs, which holds per-
     gesture draw/erase/pan state — a touch can be "down" here before it's
     decided what it's doing). ---- */

  Whiteboard.prototype._touchCount = function () {
    return Object.keys(this._touchPositions).length;
  };
  Whiteboard.prototype._touchDistance = function () {
    var ids = Object.keys(this._touchPositions);
    if (ids.length < 2) return 0;
    return dist(this._touchPositions[ids[0]], this._touchPositions[ids[1]]);
  };
  Whiteboard.prototype._touchMidpoint = function () {
    var ids = Object.keys(this._touchPositions);
    if (ids.length < 2) return null;
    var p0 = this._touchPositions[ids[0]], p1 = this._touchPositions[ids[1]];
    return { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  };

  // A second finger landing always means "pinch now", regardless of what
  // tool is selected or what the first finger was already doing — cancel
  // whatever that was (a draw, erase, or pan) rather than let it continue
  // underneath the pinch.
  Whiteboard.prototype._beginPinch = function () {
    var self = this;
    Object.keys(this._activePtrs).forEach(function (pid) {
      var st = self._activePtrs[pid];
      if (st.strokeId) {
        self._liveStrokes.delete('m:' + st.strokeId);
        self._send('stroke:cancel', { strokeId: st.strokeId });
        self._dirty = true;
      }
      if (st.erasing) self._erasedThisDrag = null;
      if (st.panning) self._overlayEl.style.cursor = 'grab';
      delete self._activePtrs[pid];
    });
    this._pinching = true;
    var d = this._touchDistance();
    this._pinchStartDist = d > 0 ? d : null;
    this._pinchStartZoom = this._zoom;
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

      if (e.pointerType === 'touch') {
        self._touchPositions[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (self._touchCount() >= 2) { self._beginPinch(); return; }
        // A 3rd+ finger while already pinching with two others — ignore it
        // rather than let it start a stray draw/erase/pan underneath.
        if (self._pinching) return;
      }

      // Pure navigation, never a write — allowed even while locked (see
      // setLocked), unlike every other branch below.
      if (self._tool === 'pan') {
        self._activePtrs[e.pointerId] = {
          panning: true, startX: e.clientX, startY: e.clientY,
          panStartX: self._panX, panStartY: self._panY
        };
        el.style.cursor = 'grabbing';
        return;
      }
      if (self._locked) return; // teacher has blocked this participant's writing — see setLocked
      var pos = self._getPos(e);

      if (self._tool === 'eraser') {
        self._erasedThisDrag = new Set();
        self._activePtrs[e.pointerId] = { erasing: true };
        self._eraseAt(pos);
        return;
      }

      if (self._tool === 'select') {
        var target = self._findMyObjectAt(pos);
        if (!target) {
          // Empty space (or someone else's object, which is never
          // selectable — see _findMyObjectAt) — drop whatever was
          // selected and start a rubber-band drag instead. A drag that
          // never moves (a plain click) naturally ends up selecting
          // nothing in the finish() handler below, which is exactly
          // "click empty space to deselect".
          self._selectedIds = new Set();
          self._activeRubberBand = { start: pos, current: pos };
          self._activePtrs[e.pointerId] = { rubberBand: true };
          self._dirty = true;
          return;
        }
        // Clicking a member of an existing MULTI-selection drags the
        // whole group without disturbing it; anything else (an unselected
        // object, or the lone member of a single-selection) refocuses the
        // selection to just that one object first.
        var ids;
        if (self._selectedIds.has(target.data.id) && self._selectedIds.size > 1) {
          ids = Array.from(self._selectedIds);
        } else {
          ids = [target.data.id];
          self._selectedIds = new Set(ids);
        }
        var startOffsets = {};
        ids.forEach(function (id) { startOffsets[id] = self._myObjectOffsets.get(id) || { dx: 0, dy: 0 }; });
        self._activePtrs[e.pointerId] = {
          moving: true, objIds: ids, dragStart: pos, startOffsets: startOffsets,
          lastSentAt: 0, lastSentPos: null
        };
        self._dirty = true; // repaint highlight boxes for the (possibly just-changed) selection
        el.style.cursor = 'grabbing';
        return;
      }

      // Straight-line tools — tracked as exactly [start, current] (never a
      // growing polyline the way freehand pen/highlighter points
      // accumulate below), redrawn as a straight segment each frame — see
      // drawStraightStroke/straightPathString.
      if (self._tool === 'line' || self._tool === 'dashed-line' || self._tool === 'arrow') {
        var shapeId = genId();
        self._activePtrs[e.pointerId] = {
          strokeId: shapeId, shape: self._tool, points: [pos, pos], pending: [pos, pos],
          lastSentAt: 0, lastSentPos: null, width: self._width, opacity: 1
        };
        self._liveStrokes.set('m:' + shapeId, { shape: self._tool, points: [pos, pos], color: self._color, width: self._width, opacity: 1 });
        self._dirty = true;
        return;
      }

      var isHighlighter = self._tool === 'highlighter';
      var effWidth   = isHighlighter ? self._width * HIGHLIGHTER_WIDTH_MULT : self._width;
      var effOpacity = isHighlighter ? HIGHLIGHTER_OPACITY : 1;
      var strokeId = genId();
      self._activePtrs[e.pointerId] = {
        strokeId: strokeId, points: [pos], pending: [pos], lastSentAt: 0, lastSentPos: null,
        width: effWidth, opacity: effOpacity
      };
      self._liveStrokes.set('m:' + strokeId, { points: [pos], color: self._color, width: effWidth, opacity: effOpacity });
      self._dirty = true;
    });

    el.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' && self._touchPositions[e.pointerId]) {
        self._touchPositions[e.pointerId].x = e.clientX;
        self._touchPositions[e.pointerId].y = e.clientY;
      }

      if (self._pinching) {
        e.preventDefault();
        if (self._pinchStartDist && self._touchCount() === 2) {
          var d = self._touchDistance();
          if (d > 0) {
            var mid = self._touchMidpoint();
            self._setZoom(self._pinchStartZoom * (d / self._pinchStartDist), mid.x, mid.y);
          }
        }
        return;
      }

      var st = self._activePtrs[e.pointerId];
      if (!st) return;
      e.preventDefault();
      if (st.panning) {
        // Direct manipulation, same convention as Miro/idroo — content
        // follows the finger/cursor rather than a scrollbar-style inverse
        // relationship.
        self._panX = st.panStartX + (e.clientX - st.startX);
        self._panY = st.panStartY + (e.clientY - st.startY);
        self._clampCamera();
        self._syncViewport();
        return;
      }
      var pos = self._getPos(e);
      if (st.erasing) { self._eraseAt(pos); return; }
      if (st.rubberBand) {
        self._activeRubberBand.current = pos;
        self._dirty = true;
        return;
      }
      if (st.moving) {
        // One shared (groupDx,groupDy) applied on top of each object's OWN
        // starting offset — a rigid group translation, so objects that
        // already sat at different individual offsets (from an earlier,
        // separate move) keep their relative positions to each other.
        var groupDx = pos.x - st.dragStart.x;
        var groupDy = pos.y - st.dragStart.y;
        var moves = st.objIds.map(function (id) {
          var so = st.startOffsets[id];
          var nx = so.dx + groupDx, ny = so.dy + groupDy;
          self._setObjectOffset(id, nx, ny);
          self._myObjectOffsets.set(id, { dx: nx, dy: ny });
          return { id: id, offsetX: nx, offsetY: ny };
        });
        self._dirty = true; // keep selection highlight boxes tracking the moved objects
        var mnow = (global.performance || Date).now();
        var mmoved = !st.lastSentPos || dist(st.lastSentPos, pos) >= BROADCAST_PX;
        if (mmoved || mnow - st.lastSentAt >= BROADCAST_MS) {
          self._send('object:move', { moves: moves });
          st.lastSentAt = mnow;
          st.lastSentPos = pos;
        }
        return;
      }
      if (st.shape) {
        // Replace the end point, never accumulate — a shape is always
        // exactly [start, current], see the pointerdown branch above.
        st.points[1] = pos;
        st.pending = st.points.slice();
      } else {
        st.points.push(pos);
        st.pending.push(pos);
      }
      self._liveStrokes.get('m:' + st.strokeId).points = st.points;
      self._dirty = true;
      self._maybeFlush(st);
    });

    function finish(e) {
      if (e.pointerType === 'touch') {
        delete self._touchPositions[e.pointerId];
        if (self._pinching) {
          // Fewer than 2 fingers left: stop zooming, but don't let
          // whichever one remains resume drawing either — wait for a
          // full release (touchCount 0) before any new gesture can start.
          if (self._touchCount() < 2) self._pinchStartDist = null;
          if (self._touchCount() === 0) self._pinching = false;
          return;
        }
      }
      var st = self._activePtrs[e.pointerId];
      if (!st) return;
      delete self._activePtrs[e.pointerId];
      if (st.panning) { el.style.cursor = 'grab'; return; }
      if (st.erasing) { self._erasedThisDrag = null; return; }
      if (st.rubberBand) {
        var rect = normalizedRect(self._activeRubberBand.start, self._activeRubberBand.current);
        self._activeRubberBand = null;
        var ids = [];
        self._fabricCanvas.getObjects().forEach(function (obj) {
          if (!obj.data || obj.data.ownerId !== self._userId) return;
          var b = self._myObjectBounds(obj.data.id);
          if (b && rectsIntersect(rect, b)) ids.push(obj.data.id);
        });
        self._selectedIds = new Set(ids);
        self._dirty = true;
        return;
      }
      if (st.moving) {
        el.style.cursor = 'default';
        // Unthrottled — the throttled broadcasts during the drag may have
        // skipped the very last point, and this is the one every other
        // viewer needs to land on exactly.
        var finalMoves = st.objIds.map(function (id) {
          var off = self._myObjectOffsets.get(id) || { dx: 0, dy: 0 };
          return { id: id, offsetX: off.dx, offsetY: off.dy };
        });
        self._send('object:move', { moves: finalMoves });
        finalMoves.forEach(function (m) { self._persistObjectMove(m.id, m.offsetX, m.offsetY); });
        return;
      }
      self._flush(st);
      self._send('stroke:end', { strokeId: st.strokeId });
      // Deliberately NOT deleting the live-stroke entry here — the overlay
      // preview stays exactly as drawn until _commitStroke's DB round-trip
      // resolves and the real fabric.Path is ready to take its place (same
      // tick, see below). Removing it here instead left a gap the length of
      // that round-trip where the stroke was neither on the overlay nor on
      // Fabric yet — a visible "disappears for a moment, then reappears"
      // flicker on every release.
      self._commitStroke(st.points, 'm:' + st.strokeId, st.width, st.opacity, st.shape);
    }
    el.addEventListener('pointerup', finish);
    // Not gated to touch — mirrors drawing-canvas.js's own reasoning: a
    // fast stylus swipe off the canvas edge fires pointerleave, not
    // pointerup, and a stroke left "stuck" active would never commit.
    el.addEventListener('pointerleave', finish);
    el.addEventListener('pointercancel', function (e) {
      if (e.pointerType === 'touch') {
        delete self._touchPositions[e.pointerId];
        if (self._pinching) {
          if (self._touchCount() < 2) self._pinchStartDist = null;
          if (self._touchCount() === 0) self._pinching = false;
          return;
        }
      }
      var st = self._activePtrs[e.pointerId];
      if (!st) return;
      delete self._activePtrs[e.pointerId];
      if (st.panning) { el.style.cursor = 'grab'; return; }
      if (st.erasing) { self._erasedThisDrag = null; return; }
      if (st.rubberBand) { self._activeRubberBand = null; self._dirty = true; return; }
      if (st.moving) {
        // Snap back to wherever it was before this drag — same "the whole
        // in-progress gesture is discarded" semantics as a cancelled
        // stroke below, just as a revert instead of a delete since the
        // object already existed. Nothing was ever sent to the DB for a
        // cancelled drag, so there's nothing to undo there either.
        el.style.cursor = 'default';
        var revertMoves = st.objIds.map(function (id) {
          var so = st.startOffsets[id];
          self._setObjectOffset(id, so.dx, so.dy);
          self._myObjectOffsets.set(id, so);
          return { id: id, offsetX: so.dx, offsetY: so.dy };
        });
        self._dirty = true;
        self._send('object:move', { moves: revertMoves });
        return;
      }
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
    // shape (line/dashed-line/arrow) or null (freehand) — tells the
    // receiving end in _onRemotePoint whether "points" here REPLACES the
    // stroke's current [start,end] or gets appended to its polyline.
    this._send('stroke:point', { strokeId: st.strokeId, color: this._color, width: st.width, opacity: st.opacity, shape: st.shape || null, points: st.pending });
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
  // same rule drawing-canvas.js uses for its own strokes; for a shape
  // that's "start and end land on the same point" rather than "fewer than
  // 2 points" (a shape's points array is always exactly [start,end], even
  // for a zero-movement tap — see the pointerdown branch in
  // _bindPointerEvents). liveKey is the overlay preview entry to retire
  // once (and only once) the real object is ready to take its place — see
  // the note at the finish() call site. width/opacity are the EFFECTIVE
  // values already baked in at pointerdown (pen vs highlighter — see
  // _bindPointerEvents), not self._width/1 — otherwise a highlighter
  // stroke would commit at pen width/opacity if the tool got switched
  // again before this resolved. shape is 'line'/'dashed-line'/'arrow', or
  // falsy for an ordinary freehand pen/highlighter stroke.
  Whiteboard.prototype._commitStroke = function (points, liveKey, width, opacity, shape) {
    var start = points[0], end = points[points.length - 1];
    var isDegenerate = shape ? dist(start, end) < 2 : points.length < 2;
    if (isDegenerate) {
      if (liveKey) { this._liveStrokes.delete(liveKey); this._dirty = true; }
      return;
    }
    var path = shape ? straightPathString(start, end, shape) : smoothPathString(points);
    var dashArray = shape === 'dashed-line' ? [width * 3, width * 2.4] : null;
    var self = this;
    var gen  = this._clearGen; // see the field comment in the constructor
    this._supabase.from('whiteboard_objects').insert({
      session_id: this._sessionId,
      class_id:   this._classId,
      created_by: this._userId,
      kind: 'stroke',
      // clientStrokeId round-trips back through postgres_changes so a
      // REMOTE viewer can do the exact same "swap, don't just delete"
      // trick for their copy of this stroke's live preview — see
      // _connectRealtime's INSERT handler.
      fabric_json: { path: path, stroke: this._color, strokeWidth: width, strokeDashArray: dashArray, opacity: opacity, clientStrokeId: liveKey ? liveKey.slice(2) : null }
    }).select().single().then(function (res) {
      if (self._destroyed) return;
      if (res.error) {
        console.error('[Whiteboard] commit failed', res.error);
        if (liveKey) { self._liveStrokes.delete(liveKey); self._dirty = true; } // don't leave the preview stuck forever
        return;
      }
      if (liveKey) self._liveStrokes.delete(liveKey);
      // "Clear mine" ran while this stroke was still in flight — its DELETE
      // query already returned before this row existed, so it never caught
      // it. Undo the insert instead of drawing a stroke the user just asked
      // to erase; the DELETE this triggers reaches every other viewer the
      // same way _clearMine's own does.
      if (self._clearGen !== gen) {
        self._supabase.from('whiteboard_objects').delete().eq('id', res.data.id).then(function () {});
        self._dirty = true;
        return;
      }
      self._addObjectIfNew(res.data, points);
      // A new stroke invalidates whatever was on the redo stack — standard
      // undo/redo semantics (matches drawing-canvas.js's own _undo/_redo).
      self._myStrokeHistory.push({ id: res.data.id, fabric_json: res.data.fabric_json });
      self._myRedoStack = [];
      self._updateUndoRedoButtons();
      self._dirty = true;
      self._fabricCanvas.requestRenderAll();
    });
  };

  /* ---- Realtime ---- */

  Whiteboard.prototype._connectRealtime = function () {
    var self = this;
    this._channel = this._supabase
      .channel('whiteboard-' + this._sessionId, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'stroke:point' }, function (msg) { self._onRemotePoint(msg.payload); })
      .on('broadcast', { event: 'stroke:end' },   function (msg) { self._onRemoteStrokeEnd(msg.payload); })
      .on('broadcast', { event: 'stroke:cancel' }, function (msg) { self._liveStrokes.delete('r:' + msg.payload.strokeId); self._dirty = true; })
      // Live, ephemeral drag position(s) from the "select" tool — same
      // Broadcast-not-persisted channel as a stroke's own in-progress
      // points, see _bindPointerEvents' 'moving' branch. Batched (one or
      // more {id,offsetX,offsetY} moves per message) since dragging a
      // multi-selection moves every selected object in the same gesture.
      // Applies to ANY object regardless of whose it is, since a REMOTE
      // participant is the one dragging THEIR OWN object(s) here —
      // _setObjectOffset doesn't care about ownership, only
      // _findMyObjectAt (my own hit-testing) does.
      .on('broadcast', { event: 'object:move' }, function (msg) {
        (msg.payload.moves || []).forEach(function (m) { self._setObjectOffset(m.id, m.offsetX, m.offsetY); });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'whiteboard_objects', filter: 'session_id=eq.' + this._sessionId
      }, function (p) {
        var cid = p.new.fabric_json && p.new.fabric_json.clientStrokeId;
        // Same swap-not-delete trick as the local drawer's own finish() —
        // retire the remote live-preview entry in the SAME tick the real
        // object gets added, so a remote viewer never sees the stroke blink
        // out during the commit round-trip either.
        if (cid) { self._liveStrokes.delete('r:' + cid); self._dirty = true; }
        self._addObjectIfNew(p.new);
        self._fabricCanvas.requestRenderAll();
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'whiteboard_objects', filter: 'session_id=eq.' + this._sessionId
      }, function (p) { self._applyObjectUpdate(p.new); })
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
      entry = { points: [], color: payload.color, width: payload.width, opacity: payload.opacity, shape: payload.shape || null };
      this._liveStrokes.set(key, entry);
    }
    // A shape's payload always carries its full current [start,end] pair
    // (see _flush) — replace, don't accumulate, unlike freehand's growing
    // polyline below.
    entry.points = payload.shape ? payload.points : entry.points.concat(payload.points);
    this._dirty = true;
  };

  // The DURABLE counterpart to object:move's live broadcast — covers a
  // viewer who wasn't connected during the drag (a late join, a dropped
  // connection) and, for my OWN object, keeps _myObjectsJson/_myObjectOffsets
  // in sync in case another of my own tabs/devices was the one that moved
  // it. Idempotent with the live broadcast: applying the same (dx,dy)
  // twice via _setObjectOffset is a no-op, always relative to natural
  // position rather than wherever the object currently sits.
  Whiteboard.prototype._applyObjectUpdate = function (row) {
    if (!row) return;
    var j = row.fabric_json || {};
    var dx = j.offsetX || 0, dy = j.offsetY || 0;
    this._setObjectOffset(row.id, dx, dy);
    if (row.created_by === this._userId) {
      this._myObjectOffsets.set(row.id, { dx: dx, dy: dy });
      this._myObjectsJson.set(row.id, j);
    }
  };

  // 'end' means the finished object is already on its way as a committed
  // row (matched by clientStrokeId in the INSERT handler above) — leave the
  // live preview showing until that arrives instead of deleting it here,
  // same reasoning as the local drawer's own finish(). The timeout is only
  // a safety net for the rare case nothing ever arrives (e.g. the sender's
  // stroke was a single-point tap, which _commitStroke drops without
  // inserting any row at all) — without it a dropped stroke like that would
  // leave a phantom preview on screen forever for everyone else.
  Whiteboard.prototype._onRemoteStrokeEnd = function (payload) {
    var key = 'r:' + payload.strokeId;
    if (!this._liveStrokes.has(key)) return;
    var self = this;
    setTimeout(function () {
      if (self._liveStrokes.delete(key)) self._dirty = true;
    }, 2000);
  };

  // Shared by three call sites (my own commit, a remote INSERT, the bulk
  // historical load) so all three stay trivially idempotent regardless of
  // arrival order — e.g. a stroke committed the instant before a bulk
  // fetch runs could otherwise arrive via both paths. rawPoints is only
  // ever passed by my own commit (the exact points, still in memory at
  // that moment) — every other caller leaves it out and, for one of MY
  // strokes loaded from history, parsePathPoints reconstructs an
  // approximation instead; see that function's own comment for why.
  Whiteboard.prototype._addObjectIfNew = function (row, rawPoints) {
    if (!row || this._committedIds.has(row.id)) return;
    this._committedIds.add(row.id);
    var j = row.fabric_json || {};
    var path = new fabric.Path(j.path, {
      stroke: j.stroke,
      strokeWidth: j.strokeWidth,
      strokeDashArray: j.strokeDashArray || null, // dashed-line tool only — see _commitStroke
      opacity: j.opacity == null ? 1 : j.opacity,
      fill: null,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      selectable: false,
      evented: false,
      // Fabric objects default to objectCaching:true — rendering from a
      // cached BITMAP (rasterized once at whatever resolution it happened
      // to need at the time) rather than fresh from the vector path data
      // on every paint. That cache doesn't reliably regenerate at a new
      // resolution when OUR OWN custom setViewportTransform changes the
      // zoom (see _syncViewport) the way it would for zoom driven through
      // Fabric's own built-in interactions — it silently kept reusing a
      // bitmap rasterized for an earlier, often much lower, zoom and
      // stretched it up, which is exactly what was making committed
      // strokes look blurry at high zoom despite an otherwise-crisp
      // backing store. Off entirely, a stroke is always re-rasterized
      // straight from its path data at the CURRENT zoom, so it's exactly
      // as sharp at 400% as at 100% — the small number of on-screen
      // strokes here never made caching earn its keep anyway.
      objectCaching: false,
      data: { id: row.id, ownerId: row.created_by }
    });
    // Natural position captured BEFORE applying any stored move offset —
    // see the field comment in the constructor and _onRemoteObjectMove/
    // _applyObjectUpdate, which both re-derive "natural + offset" the same
    // way rather than nudging relative to wherever the object happens to
    // already be on screen.
    this._objectNaturalPos.set(row.id, { left: path.left, top: path.top });
    var offsetX = j.offsetX || 0, offsetY = j.offsetY || 0;
    if (offsetX || offsetY) {
      path.set({ left: path.left + offsetX, top: path.top + offsetY });
      path.setCoords();
    }
    this._fabricCanvas.add(path);
    if (row.created_by === this._userId) {
      this._myPathPoints.set(row.id, rawPoints || parsePathPoints(j.path));
      this._myObjectOffsets.set(row.id, { dx: offsetX, dy: offsetY });
      this._myObjectsJson.set(row.id, j);
    }
  };

  Whiteboard.prototype._removeObjectById = function (id) {
    if (!id) return;
    this._committedIds.delete(id);
    this._myPathPoints.delete(id);
    this._objectNaturalPos.delete(id);
    this._myObjectOffsets.delete(id);
    this._myObjectsJson.delete(id);
    if (this._selectedIds.delete(id)) this._dirty = true; // drop its now-stale highlight box too
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
    // Bump first — any of my strokes already mid-commit (insert sent,
    // response not back yet) will see this changed generation in
    // _commitStroke and delete themselves instead of landing on the
    // canvas after this "clear everything I drew" runs.
    this._clearGen++;
    // Discard anything of mine that's only ever lived on the overlay —
    // a stroke still being actively drawn (pointer still down) or one
    // whose live preview hasn't been retired yet — since none of that
    // is in whiteboard_objects yet for the delete below to catch.
    this._activePtrs = {};
    Array.from(this._liveStrokes.keys())
      .filter(function (k) { return k.charAt(0) === 'm'; })
      .forEach(function (k) { self._liveStrokes.delete(k); });
    // Every stroke this clears is about to be gone for good — nothing left
    // to undo/redo or to erase individually.
    this._myStrokeHistory = [];
    this._myRedoStack = [];
    this._updateUndoRedoButtons();
    this._dirty = true;
    this._supabase.from('whiteboard_objects').delete()
      .eq('session_id', this._sessionId).eq('created_by', this._userId)
      .select('id')
      .then(function (res) {
        if (res.error) { global.BM && BM.toast && BM.toast('Eroare: ' + res.error.message, 'error'); return; }
        (res.data || []).forEach(function (r) { self._removeObjectById(r.id); });
        self._fabricCanvas.requestRenderAll();
      });
  };

  // MY OWN cached hit-test points for an object, shifted by however far
  // the "select" tool has moved it since — _myPathPoints alone is only
  // ever the shape as originally drawn, so both the eraser and the select
  // tool's own hit-testing need this translated version instead, or a
  // moved object would keep responding to clicks/swipes at its OLD spot.
  Whiteboard.prototype._myTranslatedPoints = function (id) {
    var pts = this._myPathPoints.get(id);
    if (!pts || !pts.length) return null;
    var off = this._myObjectOffsets.get(id);
    if (!off || (!off.dx && !off.dy)) return pts;
    return pts.map(function (p) { return { x: p.x + off.dx, y: p.y + off.dy }; });
  };

  // Eraser tool — drag over any of MY OWN strokes to delete them one at a
  // time. Scoped to own strokes only for now, same as _clearMine and the
  // DB's own owner-only delete policy: a teacher-erases-anyone tool is
  // Phase 2 (see the SQL comment in 20260904160000_whiteboard_objects.sql —
  // it needs its own RLS policy, not just a client-side change).
  Whiteboard.prototype._eraseAt = function (pos) {
    var self = this;
    var hitIds = [];
    this._fabricCanvas.getObjects().forEach(function (obj) {
      if (!obj.data || obj.data.ownerId !== self._userId) return;
      if (self._erasedThisDrag.has(obj.data.id)) return;
      var pts = self._myTranslatedPoints(obj.data.id);
      if (!pts) return;
      var tol = (obj.strokeWidth || 2) / 2 + 8; // a little slack for a fast swipe
      if (distToPolyline(pos, pts) <= tol) {
        hitIds.push(obj.data.id);
        self._erasedThisDrag.add(obj.data.id);
      }
    });
    if (hitIds.length) this._deleteObjects(hitIds);
  };

  // "select" tool hit-testing — same tolerance-based polyline distance
  // check as the eraser above, just returning the TOPMOST match (last in
  // z-order, i.e. drawn most recently) instead of collecting every one a
  // drag passes over, since a click can only pick up one object to move.
  // Own objects only — see _eraseAt's own comment for why that's not a
  // client-side-only restriction (the move UPDATE's own RLS policy
  // enforces it server-side too).
  Whiteboard.prototype._findMyObjectAt = function (pos) {
    var objs = this._fabricCanvas.getObjects();
    for (var i = objs.length - 1; i >= 0; i--) {
      var obj = objs[i];
      if (!obj.data || obj.data.ownerId !== this._userId) continue;
      var pts = this._myTranslatedPoints(obj.data.id);
      if (!pts) continue;
      var tol = (obj.strokeWidth || 2) / 2 + 8;
      if (distToPolyline(pos, pts) <= tol) return obj;
    }
    return null;
  };

  // MY OWN object's current logical-space bounding box (already shifted
  // by whatever the "select" tool has moved it) — used both for the
  // rubber-band's own hit-testing (does this box intersect the dragged
  // rectangle?) and for drawing its highlight in _drawSelectionOverlay.
  Whiteboard.prototype._myObjectBounds = function (id) {
    var pts = this._myTranslatedPoints(id);
    if (!pts || !pts.length) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  };

  // Repositions ANY object — mine (a live drag) or someone else's (an
  // incoming remote move, see _onRemoteObjectMove/_applyObjectUpdate) —
  // to natural position + (dx,dy). Always relative to the object's own
  // natural left/top (captured once in _addObjectIfNew), never to
  // wherever it visually happens to be already, so applying the same
  // (dx,dy) twice is a safe no-op rather than double-moving it.
  Whiteboard.prototype._setObjectOffset = function (objId, dx, dy) {
    var obj = this._fabricCanvas.getObjects().find(function (o) { return o.data && o.data.id === objId; });
    var natural = this._objectNaturalPos.get(objId);
    if (!obj || !natural) return;
    obj.set({ left: natural.left + dx, top: natural.top + dy });
    obj.setCoords();
    this._fabricCanvas.requestRenderAll();
  };

  // Persists the "select" tool's final drag position — own objects only,
  // enforced both here (client never attempts it for someone else's, see
  // _findMyObjectAt) and server-side by wb_objects_owner_update. Merges
  // into the object's own cached fabric_json (_myObjectsJson, kept
  // current since _addObjectIfNew) rather than sending a partial update,
  // since a bare {offsetX,offsetY} row would otherwise overwrite path/
  // stroke/etc. with nothing. Reverts the visible position on failure —
  // the drag already applied it optimistically the instant it happened.
  Whiteboard.prototype._persistObjectMove = function (objId, dx, dy) {
    var self = this;
    var json = this._myObjectsJson.get(objId);
    if (!json) return; // shouldn't happen for one of my own objects, but nothing sane to merge into
    var newJson = Object.assign({}, json, { offsetX: dx, offsetY: dy });
    this._supabase.from('whiteboard_objects').update({ fabric_json: newJson }).eq('id', objId)
      .then(function (res) {
        if (res.error) {
          global.BM && BM.toast && BM.toast('Eroare: ' + res.error.message, 'error');
          var prevDx = json.offsetX || 0, prevDy = json.offsetY || 0;
          self._setObjectOffset(objId, prevDx, prevDy);
          self._myObjectOffsets.set(objId, { dx: prevDx, dy: prevDy });
          self._send('object:move', { moves: [{ id: objId, offsetX: prevDx, offsetY: prevDy }] });
          return;
        }
        self._myObjectsJson.set(objId, newJson);
      });
  };

  // Shared by the eraser and undo — removes committed strokes both locally
  // (Fabric + the caches above) and in the DB, which reaches every other
  // viewer through the same DELETE postgres_changes handler _clearMine
  // already relies on. Also drops these ids from the undo stack so a later
  // undo can't try to re-delete an already-erased stroke, and — worse — a
  // later redo can't resurrect one the user erased on purpose.
  Whiteboard.prototype._deleteObjects = function (ids) {
    var self = this;
    ids.forEach(function (id) { self._removeObjectById(id); });
    this._myStrokeHistory = this._myStrokeHistory.filter(function (h) { return ids.indexOf(h.id) === -1; });
    this._updateUndoRedoButtons();
    this._fabricCanvas.requestRenderAll();
    this._supabase.from('whiteboard_objects').delete().in('id', ids).then(function (res) {
      if (res.error) console.error('[Whiteboard] erase failed', res.error);
    });
  };

  // Undo/redo — scoped to MY OWN strokes only, same reasoning as the
  // eraser above: undoing someone else's stroke mid-lesson would be
  // confusing in a live shared session, so this only ever pops my own
  // history. Bound to the toolbar buttons and Ctrl+Z/Ctrl+Y — see
  // _bindKeyboard.
  Whiteboard.prototype.undo = function () {
    if (!this._myStrokeHistory.length) return;
    var entry = this._myStrokeHistory.pop();
    this._myRedoStack.push(entry);
    this._updateUndoRedoButtons();
    this._removeObjectById(entry.id);
    this._fabricCanvas.requestRenderAll();
    this._supabase.from('whiteboard_objects').delete().eq('id', entry.id).then(function (res) {
      if (res.error) console.error('[Whiteboard] undo failed', res.error);
    });
  };

  // Can't resurrect the deleted row (it's gone) — re-inserts the same
  // fabric_json as a brand new row instead, same as a fresh stroke, which
  // syncs to everyone else the normal way through the INSERT handler.
  Whiteboard.prototype.redo = function () {
    if (!this._myRedoStack.length) return;
    var entry = this._myRedoStack.pop();
    this._updateUndoRedoButtons();
    var self = this;
    this._supabase.from('whiteboard_objects').insert({
      session_id: this._sessionId, class_id: this._classId, created_by: this._userId,
      kind: 'stroke', fabric_json: entry.fabric_json
    }).select().single().then(function (res) {
      if (self._destroyed) return;
      if (res.error) { console.error('[Whiteboard] redo failed', res.error); return; }
      self._addObjectIfNew(res.data);
      self._myStrokeHistory.push({ id: res.data.id, fabric_json: res.data.fabric_json });
      self._updateUndoRedoButtons();
      self._fabricCanvas.requestRenderAll();
    });
  };

  Whiteboard.prototype._updateUndoRedoButtons = function () {
    var undoBtn = this._toolbarEl.querySelector('#wbUndoBtn');
    var redoBtn = this._toolbarEl.querySelector('#wbRedoBtn');
    if (undoBtn) undoBtn.disabled = !this._myStrokeHistory.length;
    if (redoBtn) redoBtn.disabled = !this._myRedoStack.length;
  };

  // Called from js/class-page.js when the teacher locks/unlocks this
  // participant — live, through the whiteboard_participants realtime
  // subscription already running there. Only blocks STARTING something new
  // (see the _locked check in _bindPointerEvents' pointerdown); a stroke
  // already mid-gesture when the lock lands is left to finish rather than
  // yanked away mid-draw. Enforced server-side too, not just here — the
  // wb_objects_insert RLS policy checks the same flag, so this is a UX
  // nicety (an instant, friendly block) on top of a real one, not the only
  // thing standing between a locked student and the board.
  Whiteboard.prototype.setLocked = function (locked) {
    this._locked = !!locked;
    this._applyLockedUi();
    // Re-derive the cursor for whatever tool is currently selected — see
    // _setTool's own locked branch. Harmless no-op call otherwise (same
    // tool, just recomputes the same class list too).
    if (this._overlayEl) this._setTool(this._tool);
  };

  Whiteboard.prototype._applyLockedUi = function () {
    if (this._wrap) this._wrap.classList.toggle('wb-board--locked', this._locked);
  };

  // Called both locally (the teacher's own click, for instant feedback —
  // see _bindToolbar's gridBtn branch) and from js/class-page.js's
  // whiteboard_sessions realtime subscription, which is what actually
  // makes the teacher's toggle take effect for every OTHER participant,
  // live. A no-op when the value already matches, so the teacher's own
  // change echoing back through that same subscription (postgres_changes
  // echoes a client's own writes back to it) never does redundant work.
  // No button to update for a student — _build never renders #wbGridBtn
  // for them at all (see its own comment), so the querySelector below
  // simply finds nothing and this only touches the shared render state.
  Whiteboard.prototype.setGridEnabled = function (on) {
    on = !!on;
    if (on === this._gridOn) return;
    this._gridOn = on;
    var btn = this._toolbarEl && this._toolbarEl.querySelector('#wbGridBtn');
    if (btn) {
      btn.classList.toggle('dc-action-btn--active', on);
      btn.title = on ? 'Ascunde grila' : 'Arată grila';
    }
    this._redrawGrid();
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
    var s = this._scale * this._dpr;
    ctx.setTransform(s, 0, 0, s, this._panX * this._dpr, this._panY * this._dpr);
    this._liveStrokes.forEach(function (st) {
      if (st.shape) drawStraightStroke(ctx, st.points[0], st.points[st.points.length - 1], st.color, st.width, st.opacity, st.shape);
      else drawSmoothStroke(ctx, st.points, st.color, st.width, st.opacity);
    });
    this._drawSelectionOverlay(ctx);
  };

  // "select" tool decorations, drawn on top of every live stroke above:
  // a light highlight box around each currently-selected object (individually,
  // idroo-style), a dashed box around the union of all of them when 2+ are
  // selected (so a multi-selection reads as one group at a glance), and the
  // rubber-band rectangle itself while a selection drag is in progress.
  // Recomputed fresh from each object's CURRENT bounding box on every
  // redraw rather than cached, so a highlight tracks its object through a
  // drag without any extra bookkeeping of its own.
  Whiteboard.prototype._drawSelectionOverlay = function (ctx) {
    var self = this;
    var pad = 10; // logical units of breathing room around each box
    var hairline = 1.5 / this._scale; // a true ~1.5 device px at any zoom, same technique as the grid
    var boxes = [];
    this._selectedIds.forEach(function (id) {
      var b = self._myObjectBounds(id);
      if (!b) return;
      boxes.push(b);
      ctx.save();
      ctx.fillStyle = 'rgba(37,99,235,0.12)';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = hairline;
      var x = b.minX - pad, y = b.minY - pad, w = (b.maxX - b.minX) + pad * 2, h = (b.maxY - b.minY) + pad * 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    if (boxes.length > 1) {
      var u = boxes.reduce(function (acc, b) {
        return {
          minX: Math.min(acc.minX, b.minX), minY: Math.min(acc.minY, b.minY),
          maxX: Math.max(acc.maxX, b.maxX), maxY: Math.max(acc.maxY, b.maxY)
        };
      });
      var gp = pad * 1.6;
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.setLineDash([6, 4].map(function (n) { return n / this._scale; }, this));
      ctx.lineWidth = hairline;
      ctx.strokeRect(u.minX - gp, u.minY - gp, (u.maxX - u.minX) + gp * 2, (u.maxY - u.minY) + gp * 2);
      ctx.restore();
    }
    if (this._activeRubberBand) {
      var r = normalizedRect(this._activeRubberBand.start, this._activeRubberBand.current);
      ctx.save();
      ctx.fillStyle = 'rgba(37,99,235,0.10)';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1 / this._scale;
      ctx.fillRect(r.minX, r.minY, r.maxX - r.minX, r.maxY - r.minY);
      ctx.strokeRect(r.minX, r.minY, r.maxX - r.minX, r.maxY - r.minY);
      ctx.restore();
    }
  };

  /* ---- Teardown ---- */

  Whiteboard.prototype.destroy = function () {
    this._destroyed = true;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._zoomRafId) cancelAnimationFrame(this._zoomRafId);
    clearTimeout(this._resizeTimer);
    if (this._ro) this._ro.disconnect();
    if (this._keyHandler) global.removeEventListener('keydown', this._keyHandler);
    if (this._channel) this._supabase.removeChannel(this._channel);
    if (this._fabricCanvas) this._fabricCanvas.dispose();
    if (this._wrap && this._wrap.parentNode) this._wrap.parentNode.removeChild(this._wrap);
  };

  global.Whiteboard = Whiteboard;

})(window);
