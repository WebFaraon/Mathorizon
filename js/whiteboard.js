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
  // Same key js/drawing-canvas.js's own stylus-only toggle already uses —
  // deliberately shared, not a separate whiteboard-only preference: it's
  // the same physical device/stylus either way, so setting it once on
  // either drawing surface should carry over to the other.
  var INPUT_MODE_KEY = 'mathorizon:dc-input-mode';
  var WIDTH_PRESETS = [2, 4, 8];
  // Range for the "custom width" slider a second click on an already-active
  // preset opens (see _toggleCustomWidthPanel) — WIDTH_MIN goes below the
  // thinnest preset on purpose (that was the actual ask: the presets alone
  // didn't go thin enough), WIDTH_MAX gives real headroom above the
  // thickest one rather than just filling in the gaps between 2/4/8.
  var WIDTH_MIN = 0.5;
  var WIDTH_MAX = 20;
  var MAX_DPR = 2; // matches drawing-canvas.js's own cap — see its _resize
  // Same values as js/drawing-canvas.js's own highlighter — one consistent
  // look for "highlighter" across every drawing surface in the app.
  var HIGHLIGHTER_OPACITY    = 0.28;
  var HIGHLIGHTER_WIDTH_MULT = 2.2;

  // Velocity-simulated ink for the pen tool only (see _widthFromVelocity,
  // drawVariableWidthStroke, variableWidthPathString) — slower strokes lay
  // down thicker ink, faster ones thin out, the way a real fountain/brush
  // pen behaves and a fixed-width line never does. The highlighter and
  // straight-line tools deliberately keep a constant width instead (a real
  // marker's chisel tip doesn't taper, and a ruler-straight line shouldn't
  // wobble in thickness either).
  // These numbers are the whole "feel" of the pen and were tuned by eye, not
  // measured — LOGICAL_W/H means "speed" here is in logical units per
  // millisecond, which has no intuitive real-world scale, so if the pen
  // feels too twitchy or too flat, retune SLOW_SPEED/FAST_SPEED (the speed
  // range the taper happens over), MIN/MAX_MULT (how extreme the taper
  // gets), or CURVE (see below) here rather than hunting through the
  // drawing code.
  // FAST_SPEED in particular used to be tuned for a fast deliberate swipe —
  // ordinary handwriting speed sat well below it, so most normal writing
  // only ever reached the top ~30% of the thinning range and the taper was
  // barely visible; lowered so everyday writing speed actually crosses most
  // of the SLOW..FAST range instead of just grazing the start of it.
  // Sensitivity (how early the taper kicks in — SLOW/FAST/CURVE below) and
  // range (how extreme it gets — MIN/MAX here) turned out to need separate
  // tuning passes: sensitivity was fine once raised, but the resulting
  // thin-while-moving vs. thick-dot-at-a-stop contrast was too extreme —
  // narrowed from 0.5..1.6 (3.2x) to 0.65..1.4 (2.15x) without touching the
  // speed thresholds/curve shape that fixed the sensitivity separately.
  var VW_MIN_MULT   = 0.65; // thinnest the pen gets, as a multiple of the picked width
  var VW_MAX_MULT   = 1.4;  // thickest the pen gets, at a dead stop
  var VW_SLOW_SPEED = 0.03; // logical units/ms at or below this -> MAX_MULT
  var VW_FAST_SPEED = 0.45; // logical units/ms at or above this -> MIN_MULT
  // Applied to the 0..1 SLOW..FAST position before mapping to a width (see
  // _widthFromVelocity) — 1 would be a straight line; <1 bows the curve so
  // it responds fastest right off VW_SLOW_SPEED and eases into MIN_MULT,
  // instead of needing to get most of the way to FAST_SPEED before the
  // taper becomes noticeable. This is what actually fixes "have to write
  // unrealistically fast to see it thin out" — a curve is more forgiving of
  // FAST_SPEED being not-quite-right than chasing an exact threshold is.
  var VW_CURVE      = 0.55;
  var VW_SMOOTHING  = 0.22; // 0..1, how fast width chases the new target (see _widthFromVelocity) — lower = smoother but laggier

  // Text tool (see _startTextEditor) — the box auto-sizes to its own
  // content (both width and height) up to TEXT_MAX_WIDTH, past which it
  // wraps, so a 3-word note doesn't claim a huge fixed hitbox the way an
  // always-360-wide box used to. Same font the rest of the site's own UI
  // uses (--font-ui in :root) rather than a generic system font, for one
  // consistent look — it's already loaded site-wide (see class.html's own
  // Google Fonts <link>) well before a whiteboard session ever opens, so
  // there's no separate loading-readiness risk to worry about here.
  var TEXT_MAX_WIDTH  = 360;
  var TEXT_MIN_WIDTH  = 24;
  var TEXT_DEFAULT_FONT_SIZE = 32;
  // Mirrors --font-ui by hand: this is a Fabric.js canvas text object, not
  // DOM, so it can't read the CSS variable. Keep the two in step.
  var TEXT_FONT_FAMILY = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

  // 1 = the "fit the whole board in the container" scale computed fresh in
  // _applySize every resize — MIN_ZOOM stays 1 rather than allowing zoom
  // OUT below that, since there's nothing more of the board to reveal past
  // "fully visible" (it would just shrink into a smaller box with empty
  // margin, not show anything new).
  var MIN_ZOOM = 1;      // (kept: the relative zoom of a new board, 1 = the 1400 x 900 area fits the window)
  /* The board is endless, like iDroo's (2026-11-21): the zoom is shown as the real scale (100% = one board unit per screen pixel) and goes from
     3% to 3200%. WORLD is how far ink may be put: so big nobody reaches its edge, small enough that numbers stay exact at the highest zoom. */
  var MIN_SCALE = 0.03;
  var MAX_SCALE = 32;
  var WORLD = { x0: -20000, y0: -20000, x1: 21400, y1: 20900 };

  /* Several boards in one session (2026-11-20): the shared board (key 'c', everyone writes) and one private board per student
     (key = the student's user id; only that student and the teacher see it, both write). Each board owns its objects, its undo
     history, its live strokes and its camera; the Whiteboard keeps ONE toolbar, ONE set of canvases and swaps the active board's
     data in (see _swapIn / _inBoard), so a board that is not on screen costs no painting at all. */
  var COMMON_KEY = 'c';
  var TEACHER_ON_STUDENT_COLOR = '#DC2626';   // the teacher's corrections on a student's board, so they read apart from the student's own ink
  // ...but red is also close to the first student's own colour (#e11d48, see join_whiteboard_session), so the colour is chosen per student:
  // the first of these that is clearly different from the ink the student writes with
  var CORRECTION_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#7C3AED', '#EA580C'];
  function hexRgb(h) { var m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function pickCorrectionColor(studentColor) {
    var sc = hexRgb(studentColor);
    if (!sc) return CORRECTION_COLORS[0];
    var best = CORRECTION_COLORS[0], bestD = -1;
    for (var i = 0; i < CORRECTION_COLORS.length; i++) {
      var c = hexRgb(CORRECTION_COLORS[i]);
      var d = Math.sqrt(Math.pow(c[0] - sc[0], 2) + Math.pow(c[1] - sc[1], 2) + Math.pow(c[2] - sc[2], 2));
      if (d >= 150) return CORRECTION_COLORS[i];
      if (d > bestD) { bestD = d; best = CORRECTION_COLORS[i]; }
    }
    return best;
  }
  var MAX_LOADED_STUDENT_BOARDS = 4;          // the teacher's memory of other students' boards; the least recently used one is dropped (reloaded when opened again)
  // the per-board fields of a Whiteboard (swapped as a set)
  var BOARD_KEYS = ['_liveStrokes', '_committedIds', '_objectsById', '_myPathPoints', '_objectNaturalPos', '_myObjectOffsets',
    '_myObjectScales', '_myObjectsJson', '_selectedIds', '_myStrokeHistory', '_myRedoStack', '_clearGen', '_dragObjs', '_remoteDragObjs', '_imgPending'];
  function newBoardData() {
    return {
      _liveStrokes: new Map(), _committedIds: new Set(), _objectsById: new Map(), _myPathPoints: new Map(),
      _objectNaturalPos: new Map(), _myObjectOffsets: new Map(), _myObjectScales: new Map(), _myObjectsJson: new Map(),
      _selectedIds: new Set(), _myStrokeHistory: [], _myRedoStack: [], _clearGen: 0, _dragObjs: null, _remoteDragObjs: null, _imgPending: new Map(), _fcObjects: []
    };
  }

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

  // subpaths is an array of polylines (each an array of {x,y}) — a single
  // freehand stroke or line is just one subpath, [[...]], but a shape/body
  // is genuinely several disconnected pieces (a cube is 6 separate edge/
  // face polylines, not one continuous line), and treating those as one
  // flat point list — which parsePathPoints used to do, and which this
  // function used to require — jumps a fake straight segment between the
  // END of one piece and the START of the next unrelated one. That's what
  // produced the wild loop/curve artifacts in the shape/body selection
  // highlight and made clicking near (but not on) a shape select it: the
  // "hitbox" was actually this bogus zigzag, whose loose loops cover far
  // more area than the real shape. See _addObjectIfNew's centerline
  // handling for where subpaths actually comes from.
  function distToPolyline(p, subpaths) {
    var min = Infinity;
    for (var s = 0; s < subpaths.length; s++) {
      var pts = subpaths[s];
      if (!pts.length) continue;
      if (pts.length === 1) { min = Math.min(min, dist(p, pts[0])); continue; }
      for (var i = 0; i < pts.length - 1; i++) {
        var d2 = distToSegment(p, pts[i], pts[i + 1]);
        if (d2 < min) min = d2;
      }
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

  function pointInRect(p, r) {
    return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
  }

  // Standard segment/segment intersection via orientation tests (no
  // special-casing collinear overlap — a rubber-band edge landing exactly
  // parallel to a stroke segment is a vanishingly unlikely miss, not
  // worth the extra code).
  function segmentsIntersect(a, b, c, d) {
    function ccw(p1, p2, p3) { return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x); }
    return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
  }

  // Does the segment p0->p1 actually touch the rect — not just their
  // bounding boxes? Used by the rubber-band selection (see its own call
  // site) so a stroke's LOOSE bounding box (which can be much bigger than
  // the ink itself for a curvy or diagonal shape) never gets treated as
  // "the hitbox" — only the real path does, same as the eraser/click-
  // select's own distToPolyline check already does.
  function segmentIntersectsRect(p0, p1, rect) {
    if (pointInRect(p0, rect) || pointInRect(p1, rect)) return true;
    if (Math.max(p0.x, p1.x) < rect.minX || Math.min(p0.x, p1.x) > rect.maxX) return false;
    if (Math.max(p0.y, p1.y) < rect.minY || Math.min(p0.y, p1.y) > rect.maxY) return false;
    var c0 = { x: rect.minX, y: rect.minY }, c1 = { x: rect.maxX, y: rect.minY };
    var c2 = { x: rect.maxX, y: rect.maxY }, c3 = { x: rect.minX, y: rect.maxY };
    return segmentsIntersect(p0, p1, c0, c1) || segmentsIntersect(p0, p1, c1, c2) ||
           segmentsIntersect(p0, p1, c2, c3) || segmentsIntersect(p0, p1, c3, c0);
  }

  // subpaths — see distToPolyline's own comment on why this can't just be
  // one flat point list for a shape/body.
  function polylineIntersectsRect(subpaths, rect) {
    for (var s = 0; s < subpaths.length; s++) {
      var pts = subpaths[s];
      if (!pts.length) continue;
      if (pts.length === 1) { if (pointInRect(pts[0], rect)) return true; continue; }
      for (var i = 0; i < pts.length - 1; i++) {
        if (segmentIntersectsRect(pts[i], pts[i + 1], rect)) return true;
      }
    }
    return false;
  }

  // Smooth freehand path (quadratic curve through consecutive midpoints) —
  // same technique js/drawing-canvas.js uses for its own live pen stroke,
  // reused here for both the live overlay preview and the final committed
  // fabric.Path, so a stroke never visibly "snaps" from smooth to jagged
  // the instant it's finalized.
  function smoothPathString(points) {
    // A stationary tap (highlighter, pencil): "M x y L x y" with round caps is a dot.
    if (points.length === 1) {
      return 'M ' + _r2(points[0].x) + ' ' + _r2(points[0].y) + ' L ' + _r2(points[0].x) + ' ' + _r2(points[0].y);
    }
    if (points.length < 2) return null;
    if (points.length === 2) {
      return 'M ' + _r2(points[0].x) + ' ' + _r2(points[0].y) + ' L ' + _r2(points[1].x) + ' ' + _r2(points[1].y);
    }
    var d = 'M ' + _r2(points[0].x) + ' ' + _r2(points[0].y);
    for (var i = 1; i < points.length - 1; i++) {
      var mx = (points[i].x + points[i + 1].x) / 2;
      var my = (points[i].y + points[i + 1].y) / 2;
      d += ' Q ' + _r2(points[i].x) + ' ' + _r2(points[i].y) + ' ' + _r2(mx) + ' ' + _r2(my);
    }
    var last = points[points.length - 1];
    d += ' L ' + _r2(last.x) + ' ' + _r2(last.y);
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

  // Straight-edged counterpart of drawSmoothStroke — for the selection
  // halo around a shape/body (see _drawSelectionOverlay), whose subpaths
  // are precise polygon edges, not sampled freehand input. Running those
  // through drawSmoothStroke's quadratic-curve fit rounded every sharp
  // corner into a curve, which is exactly the "hitbox is round/curvy
  // instead of following the actual straight edge" artifact — a shape's
  // OWN outline is always drawn with plain straight lines already
  // (_insertShape just joins M/L points), so its highlight needs to match
  // that, not the freehand-smoothing convention.
  function drawPolylineStroke(ctx, points, color, width, opacity) {
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
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.restore();
  }

  // Target width for the point just captured, from how fast the pointer is
  // currently moving — prevPt/pt both need a .t (ms timestamp, see
  // _bindPointerEvents' pen branch); prevPt is null for a stroke's very
  // first point, which has no speed yet and just starts at baseWidth.
  // Blended toward the raw speed-implied width (VW_SMOOTHING) rather than
  // jumping straight to it — raw per-sample speed from real pointer input
  // is noisy enough that an unsmoothed line visibly stutters in thickness.
  function _widthFromVelocity(baseWidth, prevPt, pt, scale) {
    if (!prevPt) return baseWidth;
    var dt = Math.max(1, pt.t - prevPt.t); // ms; floored so a duplicate-timestamp sample can't divide by zero
    // screen pixels per ms (not logical units): the same hand speed gives the same pen thickness at any zoom and on any screen size
    var speed = dist(prevPt, pt) * (scale || 1) / dt;
    var t = (speed - VW_SLOW_SPEED) / (VW_FAST_SPEED - VW_SLOW_SPEED);
    t = Math.pow(Math.max(0, Math.min(1, t)), VW_CURVE);
    var targetW = baseWidth * (VW_MAX_MULT - t * (VW_MAX_MULT - VW_MIN_MULT));
    var prevW = prevPt.w == null ? baseWidth : prevPt.w;
    return prevW + (targetW - prevW) * VW_SMOOTHING;
  }

  /* ---------------------------------------------------------------------------------------------
     Ink geometry v2 (2026-11-12). The pen is ONE smooth closed outline per stroke, built from the
     kept points of the gesture: the points are low-pass filtered (a 1-2-1 average, endpoints pinned),
     the width follows the speed but is smoothed again along the stroke, the two sides of the ribbon are
     offset along the averaged tangent and joined with quadratic curves through their midpoints, and the
     two ends are true semicircles. The previous version was a union of one quad and one circle per raw
     point: lumpy at any zoom (each point's own width made a bump) and a path of thousands of subpaths
     that took tens of milliseconds to rasterize. This one is a few hundred commands and the edges are
     curves, so it stays smooth at 1000% zoom. The live preview paints the very same path string
     through Path2D, so a stroke never changes shape when it is committed.
     --------------------------------------------------------------------------------------------- */
  function _r2(v) { return Math.round(v * 100) / 100; }

  // 1-2-1 low-pass over x and y (endpoints pinned so a stroke still ends where the pointer did).
  // withWidth: the pen's width channel gets extra passes, since a noisy width is what made the
  // old outline bumpy. Returns the same array when there is nothing to smooth.
  function smoothInkPoints(points, passes, withWidth) {
    var n = points.length;
    if (n < 3) return points;
    var pts = points, p, i, out;
    for (p = 0; p < passes; p++) {
      out = [pts[0]];
      for (i = 1; i < n - 1; i++) {
        var a = pts[i - 1], b = pts[i], c = pts[i + 1];
        var o = { x: (a.x + 2 * b.x + c.x) / 4, y: (a.y + 2 * b.y + c.y) / 4 };
        if (b.w != null) o.w = (a.w + 2 * b.w + c.w) / 4;
        out.push(o);
      }
      out.push(pts[n - 1]);
      pts = out;
    }
    if (withWidth && pts[0].w != null) {
      for (p = 0; p < 3; p++) {
        out = [pts[0]];
        for (i = 1; i < n - 1; i++) {
          out.push({ x: pts[i].x, y: pts[i].y, w: (pts[i - 1].w + 2 * pts[i].w + pts[i + 1].w) / 4 });
        }
        out.push(pts[n - 1]);
        pts = out;
      }
    }
    return pts;
  }

  // The pen's outline as an SVG path string (also what Path2D paints for the live preview).
  function inkOutline(points) {
    if (!points.length) return null;
    var pts = smoothInkPoints(points, 2, true);
    var n = pts.length, i;
    function half(p) { return (p.w == null ? 2 : p.w) / 2; }
    if (n === 1) return circlePathString(_r2(pts[0].x), _r2(pts[0].y), _r2(half(pts[0])));
    var L = [], R = [];
    for (i = 0; i < n; i++) {
      var a = pts[i > 0 ? i - 1 : 0], b = pts[i < n - 1 ? i + 1 : n - 1];
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len, ny = dx / len, h = half(pts[i]);
      L.push({ x: pts[i].x + nx * h, y: pts[i].y + ny * h });
      R.push({ x: pts[i].x - nx * h, y: pts[i].y - ny * h });
    }
    function f(q) { return _r2(q.x) + ' ' + _r2(q.y); }
    function mid(a2, b2) { return _r2((a2.x + b2.x) / 2) + ' ' + _r2((a2.y + b2.y) / 2); }
    var hEnd = _r2(half(pts[n - 1])), hStart = _r2(half(pts[0]));
    var d = 'M ' + f(L[0]);
    for (i = 1; i < n - 1; i++) d += ' Q ' + f(L[i]) + ' ' + mid(L[i], L[i + 1]);
    d += ' L ' + f(L[n - 1]);
    d += ' A ' + hEnd + ' ' + hEnd + ' 0 0 0 ' + f(R[n - 1]);
    for (i = n - 2; i >= 1; i--) d += ' Q ' + f(R[i]) + ' ' + mid(R[i], R[i - 1]);
    d += ' L ' + f(R[0]);
    d += ' A ' + hStart + ' ' + hStart + ' 0 0 0 ' + f(L[0]) + ' Z';
    return d;
  }

  // Live preview of the pen: the same path string as the committed object, painted with Path2D.
  function drawInkPath(ctx, d, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fill(new Path2D(d));
    ctx.restore();
  }

  // Kept for the callers that still ask for "the committed path of a variable-width stroke".
  function variableWidthPathString(points) { return inkOutline(points); }

  // The white "eye"-shaped gaps in the first cut of this were exactly this:
  // fill() with the default nonzero rule treats overlapping shapes as ADDING
  // winding only when they wind the SAME rotational direction — opposite
  // windings SUBTRACT instead, cutting a hole wherever they overlap. The
  // quads in _strokeOutlinePieces happen to always wind counter-clockwise
  // on screen (their corner order is a fixed a→b→c→d template applied to a
  // perpendicular that's always "90° left of local travel", so this holds
  // regardless of which way any given segment points); this needs to match
  // that, not the arc command's own natural clockwise sweep (sweep-flag=1
  // is "positive angle direction", which is clockwise in screen/y-down
  // space) — hence sweep-flag=0 below. drawVariableWidthStroke's ctx.arc
  // has the exact same fix via its anticlockwise=true argument — that flag
  // and SVG's sweep-flag are the same convention (both describe rotation
  // sense in a y-down coordinate system), so the two stay visually
  // identical between the live preview and the committed path.
  //
  // Two semicircle arcs, not a many-sided polygon (the original version of
  // this, kept a CIRCLE_SEGS=10 sides regardless of how big the circle
  // actually got drawn) — a joint circle can end up considerably bigger
  // than the pen's picked width once velocity-based thickening is in play
  // (a slow/stationary moment thickens toward VW_MAX_MULT), and a 10-sided
  // polygon at that size is visibly faceted: exactly the "smooth while
  // drawing, polygonal the instant it commits" mismatch this fixes — the
  // live preview was already a true arc via ctx.arc, only the committed
  // SVG path was ever approximated.
  function circlePathString(cx, cy, r) {
    return 'M ' + (cx + r) + ' ' + cy +
      ' A ' + r + ' ' + r + ' 0 1 0 ' + (cx - r) + ' ' + cy +
      ' A ' + r + ' ' + r + ' 0 1 0 ' + (cx + r) + ' ' + cy + ' Z';
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

  /* ---- Geometric shape stamps (toolbar shape picker — see SHAPE_DEFS,
     _insertShape, and the "Forme 2D"/"Corpuri 3D" dropdowns in _build) ----
     Each shape is built as one or more closed/open point-lists ("subpaths")
     around a center, joined into a single SVG path string the exact same
     way the arrow tool already joins its shaft + barb subpaths — which is
     also why these stay plain M/L polylines with no curves (parsePathPoints,
     the eraser/select tool's own path-string reader, only understands M/L/Q
     — see its own comment). Every curve here (circle, ellipse, arcs,
     rounded corners) is therefore a many-segment straight-line
     approximation rather than a true arc, same trick the sphere/cone/
     cylinder's equator/base ellipses already use one level up in
     js/geometry-figure-editor.js (ellipseArcPoints there, ellipseArcPts
     here — not shared code since that module keeps its shapes as live,
     independently-draggable-vertex Fabric groups, a much bigger machine
     than a whiteboard "stamp a fixed shape, then move it like any other
     stroke" tool needs). */

  function regularPolygonPts(cx, cy, rx, ry, n, rotDeg) {
    var pts = [], rot = (rotDeg == null ? -90 : rotDeg) * Math.PI / 180;
    for (var i = 0; i < n; i++) {
      var a = rot + i * 2 * Math.PI / n;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    pts.push(pts[0]);
    return pts;
  }

  function starPts(cx, cy, rx, ry, spikes, innerRatio) {
    var pts = [], rot = -Math.PI / 2;
    for (var i = 0; i < spikes * 2; i++) {
      var a = rot + i * Math.PI / spikes;
      var r = (i % 2 === 0) ? 1 : innerRatio;
      pts.push({ x: cx + rx * r * Math.cos(a), y: cy + ry * r * Math.sin(a) });
    }
    pts.push(pts[0]);
    return pts;
  }

  function ellipsePts(cx, cy, rx, ry, segments) {
    var pts = [];
    for (var i = 0; i <= segments; i++) {
      var a = i / segments * 2 * Math.PI;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    return pts;
  }

  function ellipseArcPts(cx, cy, rx, ry, a0, a1, segments) {
    var pts = [];
    for (var i = 0; i <= segments; i++) {
      var a = a0 + (a1 - a0) * i / segments;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    return pts;
  }

  function roundedRectPts(minX, minY, maxX, maxY, radius) {
    var r = Math.min(radius, (maxX - minX) / 2, (maxY - minY) / 2);
    var pts = [];
    function arc(acx, acy, startDeg, endDeg) {
      for (var i = 0; i <= 6; i++) {
        var a = (startDeg + (endDeg - startDeg) * i / 6) * Math.PI / 180;
        pts.push({ x: acx + r * Math.cos(a), y: acy + r * Math.sin(a) });
      }
    }
    arc(minX + r, minY + r, 180, 270);
    arc(maxX - r, minY + r, 270, 360);
    arc(maxX - r, maxY - r, 0, 90);
    arc(minX + r, maxY - r, 90, 180);
    pts.push(pts[0]);
    return pts;
  }

  // Widest line of `text` at `fontSizeLogical`, in the SAME logical units
  // as fontSizeLogical itself — canvas measureText is linear in font size,
  // so measuring at a logical (not screen) size and reading the result
  // back as logical units needs no further scale/zoom conversion at the
  // call site (see _repositionTextEditor/_finishTextEditor, which each
  // want this in a different final unit space and just multiply from
  // here). A reused offscreen canvas — measureText needs a real 2D
  // context but never needs to draw anything, so one canvas, made lazily
  // once, serves every call for the lifetime of the page.
  var _measureCtx = null;
  function measureTextWidth(text, fontSizeLogical) {
    if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
    _measureCtx.font = fontSizeLogical + 'px ' + TEXT_FONT_FAMILY;
    var max = 0;
    (text || '').split('\n').forEach(function (line) {
      var w = _measureCtx.measureText(line.length ? line : ' ').width;
      if (w > max) max = w;
    });
    return max;
  }

  // Breaks a polyline (2+ points — a straight edge or a curved arc, either
  // works since this walks segment by segment) into short "on" dash
  // segments for the edges of a 3D body that a real opaque solid would hide
  // from this viewing angle (see each 3D shape's own build() below for
  // which edges those are and why). There's no fabric strokeDashArray
  // involved — a shape/body is ONE fabric.Path, and one Path can only carry
  // one dash pattern for its whole outline, which can't distinguish hidden
  // from visible edges within the same object. Baking the gaps directly
  // into the path's own point geometry sidesteps that entirely: the "dash"
  // is just more ordinary M/L subpaths, so hidden edges can be dashed and
  // visible ones solid within the exact same single path/single fabric
  // object/single committed row — no group/multi-object machinery needed.
  // The running dash/gap phase (pos, drawing) carries over BETWEEN segments
  // of the same polyline so a multi-segment arc (e.g. a cone's back rim)
  // dashes continuously instead of restarting the pattern at every segment.
  function dashedPolylineSegments(pts, dashLen, gapLen) {
    var segs = [];
    var pos = 0, drawing = true;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var segLen = dist(a, b);
      if (!segLen) continue;
      var t = 0;
      while (t < 1) {
        var phaseLen = drawing ? dashLen : gapLen;
        var travel = Math.min(phaseLen - pos, segLen * (1 - t));
        var t2 = t + travel / segLen;
        if (drawing) {
          segs.push([
            { x: a.x + (b.x - a.x) * t,  y: a.y + (b.y - a.y) * t },
            { x: a.x + (b.x - a.x) * t2, y: a.y + (b.y - a.y) * t2 }
          ]);
        }
        pos += travel;
        t = t2;
        if (pos >= phaseLen - 1e-6) { pos = 0; drawing = !drawing; }
      }
    }
    return segs;
  }

  // id -> { label, icon (24x24 glyph, toolbar button only), build(cx,cy) }.
  // build() returns EITHER a plain array of subpaths (2D shapes — every
  // edge is always visible, there's nothing for it to hide behind) OR, for
  // the six 3D bodies, { subpaths, hidden }: subpaths are the edges drawn
  // normally, hidden are the edges a real opaque solid would occlude from
  // this angle, drawn dashed instead (via dashedPolylineSegments — see
  // _insertShape). Either way, every subpath is sized around a fixed
  // half-extent, not the current zoom/selection — a stamped shape is a
  // normal committed stroke afterward, moved with the "select" tool like
  // anything else, never resized in place (this app doesn't have per-vertex
  // handles the way js/geometry-figure-editor.js does).
  // Basic-polygon and regular-polygon/rounded icons are original to this
  // toolbar; the ones shared with the geometry configurator's own shape
  // picker (cerc/patrat/paralelogram/romb/cub/piramidă/sferă/con/cilindru)
  // reuse that module's exact SHAPE_ICONS glyphs for visual consistency
  // between the two tools.
  var SHAPE_DEFS = {
    // Every 2D shape's size constants below were rescaled (see the
    // conversation this shipped in) so each one's bounding-box diagonal
    // comes out to ~235 logical units, same target as the 3D bodies further
    // down — before this, a stamped cube was ~40% bigger than a stamped
    // pyramid dropped at the same moment, purely from each shape's own
    // half-extent constants never having been calibrated against each
    // other. Aspect ratios (square/circle/rhombus/etc.) are untouched —
    // only the overall scale changed.
    patrat: {
      label: 'Pătrat', icon: '<rect x="4.5" y="4.5" width="15" height="15"/>',
      build: function (cx, cy) {
        var h = 83; // equal half-extent on both axes — was hw=90/hh=70, an actual rectangle
        return [[{ x: cx - h, y: cy - h }, { x: cx + h, y: cy - h }, { x: cx + h, y: cy + h }, { x: cx - h, y: cy + h }, { x: cx - h, y: cy - h }]];
      }
    },
    'tri-echilateral': {
      // What "tri-isoscel" actually was before this — kept (as its own
      // correctly-named shape) since an equilateral triangle is a real,
      // separately useful option, not just a mislabeled placeholder.
      label: 'Triunghi echilateral', icon: '<path d="M12 3 4 20 20 20Z"/>',
      build: function (cx, cy) {
        // Base = 2*hw, slant side = sqrt(hw²+(2hh)²); equal side lengths
        // (the actual definition of equilateral, not just "looks roughly
        // even") needs hh = hw·√3/2.
        var hw = 89, hh = hw * Math.sqrt(3) / 2;
        return [[{ x: cx, y: cy - hh }, { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh }, { x: cx, y: cy - hh }]];
      }
    },
    'tri-isoscel': {
      // A genuinely different shape from tri-echilateral now — 2 equal
      // (the slant sides) and a 3rd, clearly different one (the base),
      // instead of the old shape which actually had all 3 sides equal.
      label: 'Triunghi isoscel', icon: '<path d="M12 2 7 20 17 20Z"/>',
      build: function (cx, cy) {
        var hw = 59, hh = 102;
        return [[{ x: cx, y: cy - hh }, { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh }, { x: cx, y: cy - hh }]];
      }
    },
    'tri-dreptunghic': {
      label: 'Triunghi dreptunghic', icon: '<path d="M5 4 5 20 20 20Z"/>',
      build: function (cx, cy) {
        var hw = 90, hh = 75;
        return [[{ x: cx - hw, y: cy + hh }, { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy - hh }, { x: cx - hw, y: cy + hh }]];
      }
    },
    trapez: {
      label: 'Trapez', icon: '<path d="M9 6 15 6 20 18 4 18Z"/>',
      build: function (cx, cy) {
        var hw = 97, hh = 66, topHw = hw * 0.5;
        return [[{ x: cx - topHw, y: cy - hh }, { x: cx + topHw, y: cy - hh }, { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh }, { x: cx - topHw, y: cy - hh }]];
      }
    },
    paralelogram: {
      label: 'Paralelogram', icon: '<path d="M8 6 20 6 16 18 4 18Z"/>',
      build: function (cx, cy) {
        var hw = 105, hh = 53, skew = 41; // hh was 65 — too tall for a parallelogram, flattened on top of the general size pass
        return [[{ x: cx - hw + skew, y: cy - hh }, { x: cx + hw, y: cy - hh }, { x: cx + hw - skew, y: cy + hh }, { x: cx - hw, y: cy + hh }, { x: cx - hw + skew, y: cy - hh }]];
      }
    },
    romb: {
      label: 'Romb', icon: '<path d="M12 2 17 12 12 22 7 12Z"/>',
      build: function (cx, cy) {
        // All 4 sides are equal length for ANY hw/hh here (a rhombus
        // doesn't need equal diagonals — only a square does), so the old
        // 95/75 was already technically a valid romb; it just read as
        // squashed/flattened because the diagonals were so close in length
        // it barely looked different from a wide oval. Taller than wide
        // reads as a proper romb instead.
        var hw = 70, hh = 95;
        return [[{ x: cx, y: cy - hh }, { x: cx + hw, y: cy }, { x: cx, y: cy + hh }, { x: cx - hw, y: cy }, { x: cx, y: cy - hh }]];
      }
    },
    pentagon: {
      label: 'Pentagon', icon: '<path d="M12 3 20.5 9.5 17 19 7 19 3.5 9.5Z"/>',
      build: function (cx, cy) { return [regularPolygonPts(cx, cy, 90, 90, 5)]; }
    },
    hexagon: {
      label: 'Hexagon', icon: '<path d="M8 4 16 4 20.5 12 16 20 8 20 3.5 12Z"/>',
      build: function (cx, cy) { return [regularPolygonPts(cx, cy, 89, 89, 6, -30)]; }
    },
    octagon: {
      label: 'Octagon', icon: '<path d="M8.5 3.5 15.5 3.5 20.5 8.5 20.5 15.5 15.5 20.5 8.5 20.5 3.5 15.5 3.5 8.5Z"/>',
      build: function (cx, cy) { return [regularPolygonPts(cx, cy, 90, 90, 8, -22.5)]; }
    },
    stea: {
      label: 'Stea', icon: '<path d="M12 3 14.4 9.6 21.5 9.8 15.8 14 17.9 21 12 16.9 6.1 21 8.2 14 2.5 9.8 9.6 9.6Z"/>',
      build: function (cx, cy) { return [starPts(cx, cy, 90, 90, 5, 0.42)]; }
    },
    cerc: {
      label: 'Cerc', icon: '<circle cx="12" cy="12" r="8.5"/>',
      build: function (cx, cy) { return [ellipsePts(cx, cy, 83, 83, 48)]; } // equal radii — was 90/75, an ellipse
    },
    'patrat-rotunjit': {
      label: 'Pătrat rotunjit', icon: '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/>',
      // Same hw≠hh bug patrat itself had — a "rounded square" with unequal
      // width/height is really just a rounded rectangle.
      build: function (cx, cy) { return [roundedRectPts(cx - 83, cy - 83, cx + 83, cy + 83, 26)]; }
    },
    semicerc: {
      label: 'Semicerc', icon: '<path d="M4 16h16"/><path d="M4 16a8 8 0 0 1 16 0"/>',
      build: function (cx, cy) {
        var rx = 106, h = 101;
        var pts = ellipseArcPts(cx, cy + h / 2, rx, h, Math.PI, 2 * Math.PI, 24);
        pts.push(pts[0]);
        return [pts];
      }
    },
    // ---- 3D bodies: build() returns { subpaths, hidden } — see the
    // comment above SHAPE_DEFS. Which edges are hidden follows from the
    // same viewing convention every one of these already used before this
    // fix (the "back" geometry shifted up-and-right of the "front"
    // geometry): that puts the viewer below-and-left, so the front, top and
    // right sides of a body are visible and its back, bottom and left sides
    // are not. An edge is hidden only where BOTH faces meeting at it are
    // hidden — worked out per shape below, not guessed.
    cub: {
      label: 'Cub',
      // Only the 3 faces actually visible from this angle — front, top,
      // right (same edges the real inserted shape itself renders solid,
      // see this shape's own build() below and its "hidden" set) — the
      // back corner's 3 edges are dropped entirely rather than dashed;
      // at this icon's tiny size a dash pattern just read as visual noise,
      // not as "these are hidden".
      icon: '<path d="M3 9H15V21H3Z"/><path d="M9 4H21V16"/><path d="M3 9 9 4"/><path d="M15 9 21 4"/><path d="M15 21 21 16"/><path d="M3 21 9 16 9 4" stroke-dasharray="0.1 2.6"/><path d="M9 16H21" stroke-dasharray="0.1 2.6"/>',
      build: function (cx, cy) {
        // Equal-side front face (a real square — the old hw=80/hh=65 made
        // the front face, and so the whole cube, visibly a squashed box)
        // plus a clean angle+length depth vector instead of the old ad-hoc
        // dx/dy, which didn't even make the front and back faces congruent.
        // s/depthLen also both scaled down from an early pass at this (72/
        // 92) — that version came out ~40% bigger than the other 3D bodies
        // when stamped side by side, since nothing had normalized them
        // against each other yet; see the 2D shapes' own comment above.
        var s = 57, depthLen = 73, depthAngle = -36 * Math.PI / 180;
        var dx = Math.cos(depthAngle) * depthLen, dy = Math.sin(depthAngle) * depthLen;
        var F0 = { x: cx - s, y: cy - s }, F1 = { x: cx + s, y: cy - s }, F2 = { x: cx + s, y: cy + s }, F3 = { x: cx - s, y: cy + s };
        var B0 = { x: F0.x + dx, y: F0.y + dy }, B1 = { x: F1.x + dx, y: F1.y + dy }, B2 = { x: F2.x + dx, y: F2.y + dy }, B3 = { x: F3.x + dx, y: F3.y + dy };
        // F3 (front-bottom-left) and its mirror B3 (back-bottom-left) are
        // the only corners bordering exclusively hidden faces (back+bottom+
        // left) — so B3's own 3 edges are the only ones hidden; every other
        // edge borders at least one visible face (front/top/right).
        return {
          subpaths: [[F0, F1, F2, F3, F0], [B0, B1], [B1, B2], [F0, B0], [F1, B1], [F2, B2]],
          hidden: [[F3, B3], [B3, B0], [B3, B2]]
        };
      }
    },
    'piramida-patrata': {
      label: 'Piramidă (bază pătrată)',
      icon: '<path d="M3 21H15"/><path d="M15 21 21 16"/><path d="M12 3 3 21"/><path d="M12 3 15 21"/><path d="M12 3 21 16"/><path d="M21 16H9L3 21" stroke-dasharray="0.1 2.6"/><path d="M12 3 9 16" stroke-dasharray="0.1 2.6"/>',
      build: function (cx, cy) {
        var hw = 88, dx = 57, dy = 39, topY = cy - 99, botY = cy + 57; // scaled to match the other 3D bodies' size — see the 2D shapes' own comment on the same pass
        var p0 = { x: cx - hw, y: botY }, p1 = { x: cx + hw - dx, y: botY }, p2 = { x: cx + hw, y: botY - dy }, p3 = { x: cx - hw + dx, y: botY - dy };
        var apex = { x: (p0.x + p2.x) / 2, y: topY };
        // Same reasoning as the cube: the base is always hidden (it's the
        // side resting on the ground) and the back+left faces are hidden
        // here too, so p3 (the base corner bordering base+back+left, all
        // three hidden) is the one corner whose edges are all hidden.
        return {
          subpaths: [[p0, p1], [p1, p2], [apex, p0], [apex, p1], [apex, p2]],
          hidden: [[p2, p3], [p3, p0], [apex, p3]]
        };
      }
    },
    'piramida-triunghiulara': {
      label: 'Piramidă (bază triunghiulară)',
      // Last segment was "M12 13 20 18" — a transposed-coordinate typo that
      // sent it to (20,18) instead of the base's actual right corner
      // (18,20), drawing a stray crossed line instead of connecting to it.
      icon: '<path d="M3 20H21"/><path d="M12 3 3 20"/><path d="M12 3 21 20"/><path d="M21 20 12 15 3 20" stroke-dasharray="0.1 2.6"/><path d="M12 3V15" stroke-dasharray="0.1 2.6"/>',
      build: function (cx, cy) {
        var hw = 86, baseY = cy + 65, backY = cy + 30, topY = cy - 96; // scaled to match the other 3D bodies' size
        var p0 = { x: cx - hw, y: baseY }, p1 = { x: cx + hw, y: baseY }, p2 = { x: cx, y: backY }, apex = { x: cx, y: topY };
        // Only the front face (apex, p0, p1) is genuinely visible here —
        // the base is always hidden (resting on the ground) and, with a
        // single back vertex rather than a separate back+left+right like
        // the square-base pyramid, BOTH other lateral faces (apex,p1,p2 and
        // apex,p2,p0) recede away from the viewer too. p2 is the one vertex
        // bordering nothing but hidden faces, so all 3 of ITS edges are
        // hidden — not just p0-p2, which is what this shipped with first.
        return {
          subpaths: [[p0, p1], [apex, p0], [apex, p1]],
          hidden: [[p1, p2], [p0, p2], [apex, p2]]
        };
      }
    },
    // con/cilindru/sfera: each "circle viewed edge-on" ellipse splits into a
    // near/visible half (larger y — nothing in front of it to block it) and
    // a far/hidden half (smaller y — behind the body's own curved surface
    // from this angle) — the standard textbook convention for sketching a
    // cone/cylinder/sphere, and unlike the polyhedra above this one doesn't
    // depend on this shape's own front/back labeling, just the ellipse's
    // own center.
    con: {
      label: 'Con',
      icon: '<path d="M3 19a9 3 0 0 0 18 0"/><path d="M12 3 3 19"/><path d="M12 3 21 19"/><path d="M3 19a9 3 0 0 1 18 0" stroke-dasharray="0.1 2.6"/>',
      build: function (cx, cy) {
        var rx = 82, ry = 23, apexY = cy - 92, baseY = cy + 53; // scaled to match the other 3D bodies' size
        var front = ellipseArcPts(cx, baseY, rx, ry, 0, Math.PI, 24);
        var back  = ellipseArcPts(cx, baseY, rx, ry, Math.PI, 2 * Math.PI, 24);
        return {
          subpaths: [front, [{ x: cx, y: apexY }, { x: cx - rx, y: baseY }], [{ x: cx, y: apexY }, { x: cx + rx, y: baseY }]],
          hidden: [back]
        };
      }
    },
    cilindru: {
      label: 'Cilindru',
      icon: '<path d="M3 6a9 3 0 1 0 18 0 9 3 0 1 0-18 0"/><path d="M3 6V19"/><path d="M21 6V19"/><path d="M3 19a9 3 0 0 0 18 0"/><path d="M3 19a9 3 0 0 1 18 0" stroke-dasharray="0.1 2.6"/>',
      build: function (cx, cy) {
        var rx = 80, ry = 21, topY = cy - 66, botY = cy + 66; // scaled to match the other 3D bodies' size
        // The top rim is fully visible — you're looking down onto the
        // cylinder's own flat top disk, seeing its whole boundary, the same
        // way you'd see the full rim of a real cup from slightly above.
        // Only the BOTTOM rim has a genuinely hidden half: its far arc is
        // occluded by the cylinder's own curved side (the bottom face
        // itself faces away, resting on the ground, same as every other
        // body here) — this shipped with both rims dashed on their far
        // side at first, which dashed the top one backwards.
        var topFull  = ellipsePts(cx, topY, rx, ry, 28);
        var botFront = ellipseArcPts(cx, botY, rx, ry, 0, Math.PI, 24);
        var botBack  = ellipseArcPts(cx, botY, rx, ry, Math.PI, 2 * Math.PI, 24);
        return {
          subpaths: [topFull, botFront, [{ x: cx - rx, y: topY }, { x: cx - rx, y: botY }], [{ x: cx + rx, y: topY }, { x: cx + rx, y: botY }]],
          hidden: [botBack]
        };
      }
    },
    sfera: {
      label: 'Sferă',
      icon: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12a9.5 3.2 0 0 0 19 0"/><path d="M2.5 12a9.5 3.2 0 0 1 19 0" stroke-dasharray="0.1 2.6"/>',
      build: function (cx, cy) {
        var r = 83; // scaled to match the other 3D bodies' size
        // The outline circle is the sphere's silhouette — always fully
        // visible regardless of viewing angle, unlike the equator band.
        var eqFront = ellipseArcPts(cx, cy, r, r * 0.3, 0, Math.PI, 20);
        var eqBack  = ellipseArcPts(cx, cy, r, r * 0.3, Math.PI, 2 * Math.PI, 20);
        return {
          subpaths: [ellipsePts(cx, cy, r, r, 48), eqFront],
          hidden: [eqBack]
        };
      }
    }
  };
  var SHAPE_IDS_2D = ['patrat', 'tri-echilateral', 'tri-isoscel', 'tri-dreptunghic', 'trapez', 'paralelogram', 'romb', 'pentagon', 'hexagon', 'octagon', 'stea', 'cerc', 'patrat-rotunjit', 'semicerc'];
  var SHAPE_IDS_3D = ['cub', 'piramida-patrata', 'piramida-triunghiulara', 'con', 'cilindru', 'sfera'];

  /* Where an object is, in board units (cached in obj.data.bb, dropped whenever the object moves or changes). Everything that needs "which objects
     are near here" (culling, the dirty-region repaint, hit tests) reads this instead of asking Fabric to recompute coordinates. */
  function objBox(o) {
    var d = o.data;
    if (d && d.bb) return d.bb;
    var r = o.getBoundingRect(true, true), pad = (o.strokeWidth || 0) + 4;
    var bb = { x0: r.left - pad, y0: r.top - pad, x1: r.left + r.width + pad, y1: r.top + r.height + pad };
    if (d) d.bb = bb;
    return bb;
  }
  function boxesTouch(a, b) { return !(a.x0 > b.x1 || a.x1 < b.x0 || a.y0 > b.y1 || a.y1 < b.y0); }
  function unionBoxes(list) {
    var u = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.x0 < u.x0) u.x0 = b.x0; if (b.y0 < u.y0) u.y0 = b.y0;
      if (b.x1 > u.x1) u.x1 = b.x1; if (b.y1 > u.y1) u.y1 = b.y1;
    }
    return u;
  }

  /* Pictures on the board (kind 'image'): files of the teacher's library (bucket wb-files, private). A picture is read through a signed
     address and decoded ONCE per path; every object that shows it shares the decoded element. */
  var IMG_BUCKET = 'wb-files';
  var imgCache = new Map();
  function loadBoardImage(supabase, path) {
    var hit = imgCache.get(path);
    if (hit) return hit;
    var pr = supabase.storage.from(IMG_BUCKET).createSignedUrl(path, 3600).then(function (r) {
      if (r.error || !r.data) throw (r.error || new Error('no signed url'));
      return new Promise(function (resolve, reject) {
        var im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = function () { resolve(im); };
        im.onerror = function () { reject(new Error('image failed to load')); };
        im.src = r.data.signedUrl;
      });
    });
    pr.catch(function () { imgCache.delete(path); });
    imgCache.set(path, pr);
    return pr;
  }
  function rectCenterline(cx, cy, w, h) {
    var hw = w / 2, hh = h / 2;
    return [[{ x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh }, { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh }, { x: cx - hw, y: cy - hh }]];
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
    this._penPreset = 'pen';          // which of the three writing presets the single pen key stands for: 'pen' | 'pencil' | 'highlighter'
    this._undoMount = opts.undoMount || null;   // where undo/redo live (next to the logo in the header of js/class-page.js); null = a corner over the canvas
    this._tool      = 'pen'; // 'pen' | 'pencil' | 'highlighter' | 'eraser' | 'select' | 'line' | 'dashed-line' | 'arrow' | 'pan'
    // 'any' (default) | 'pen' (stylus-only — a finger/mouse pans instead of
    // drawing/interacting, same convention and shared localStorage key as
    // js/drawing-canvas.js's own toggle — see _isInputAllowed).
    this._inputMode = this._loadInputMode();
    // Blocked by the teacher (whiteboard_participants.locked) — see
    // setLocked(), wired live from js/class-page.js's roster subscription.
    // Blocks starting anything new; a stroke already mid-gesture when the
    // lock lands is left to finish rather than yanked away mid-draw.
    // readOnly: the replay of a finished lesson (js/class-page.js, "Vezi tabla"). Nothing can be written (it is the locked
    // state, for good), nothing is listened to (the board is finished), the toolbar is hidden and only pan and zoom work.
    this._readOnly  = !!opts.readOnly;
    this._locked    = !!opts.locked || this._readOnly;
    this._isTeacher = !!opts.isTeacher;
    this._gridOn    = !!opts.gridOn;
    // Zoom is now shown OUTSIDE this component entirely (see
    // openWhiteboardLiveView in js/class-page.js, next to its own
    // fullscreen button) rather than in the toolbar — this is this
    // component's only hook back out to that external label.
    this._onZoomChange = typeof opts.onZoomChange === 'function' ? opts.onZoomChange : null;

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
    // id -> fabric object, for every object on the board (mine and everyone
    // else's alike — a remote move/resize needs to look up someone else's
    // object too, see _applyObjectUpdate). _setObjectOffset alone runs on
    // EVERY pointermove of a drag/resize gesture, so an O(n) getObjects()
    // .find() there (and in _resizeHandlePos, called every animation frame
    // a selection is active) is exactly the kind of cost that stays
    // invisible with a handful of strokes on the board and turns into real,
    // felt lag once a lesson's board has accumulated a few dozen+ objects.
    this._objectsById = new Map();
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
    // id -> scale (shapes/bodies only — see the resize handle in
    // _drawSelectionOverlay/_bindPointerEvents). Kept separate from
    // _myObjectOffsets above rather than folded into it so every existing
    // move-drag call site (which only ever reads/writes {dx,dy}) keeps
    // working unchanged — only _setObjectOffset, _myTranslatedPoints and
    // the persist/broadcast paths need to know scale exists at all.
    this._myObjectScales  = new Map();
    this._myObjectsJson   = new Map(); // id -> fabric_json
    // "select" tool's current multi-selection (own objects only, ids into
    // the maps above) — a rubber-band drag over empty space replaces this
    // wholesale, a click adds/refocuses it, see _bindPointerEvents. Drawn
    // as highlight boxes by _drawSelectionOverlay; cleared on tool switch,
    // on erasing a selected object, or on selecting empty space.
    this._selectedIds = new Set();
    // The text tool's live editing <textarea>, or null when none is open —
    // see _startTextEditor/_finishTextEditor. At most one at a time: a
    // click that would open a second one finishes the first first.
    this._textEditing = null;
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
    this._zoom      = 1;
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
    this._panDirX = 0;   // last direction the camera moved in (decides on which side the painted layers get more room)
    this._panDirY = 0;
    this._dragObjs = null; // objects being moved/resized: drawn on the overlay while the committed layer is painted without them

    this._sessionLocked = !!opts.locked;           // the teacher's lock on this participant (applies to the shared board only, see _recomputeLocked)
    this._baseColor = opts.userColor;
    this._onBoardChange   = typeof opts.onBoardChange === 'function' ? opts.onBoardChange : null;
    this._onBoardsReady   = typeof opts.onBoardsReady === 'function' ? opts.onBoardsReady : null;
    this._onBoardActivity = typeof opts.onBoardActivity === 'function' ? opts.onBoardActivity : null;
    this._onOpenFiles     = typeof opts.onOpenFiles === 'function' ? opts.onOpenFiles : null;
    this._build(container);
    this._initFabric();
    this._initBoards();
    this._bindToolbar();
    this._bindPointerEvents();
    this._bindKeyboard();
    try { if (localStorage.getItem('wb_perf') === '1') this._togglePerf(); } catch (e) {}
    this._startBoards();
    this._startLoop();
    if (this._readOnly) {
      this._wrap.classList.add('wb-board--readonly');
      this._setTool('pan');
    }
  }

  /* ---- DOM ---- */

  var GRID_ICON = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>';
  // The grid's desired ON-SCREEN cell size range, in CSS px — NOT a
  // logical size, and not one fixed number either (see _redrawGrid's own
  // comment for why a single constant target, this file's first attempt
  // at this, looked oversized on a phone). MIN/MAX bound how big a
  // "comfortable" cell is allowed to look on any given viewport; which
  // exact value within that band is actually used any given moment is
  // also shaped by niceGridStep's snapping, so neither bound is a
  // guarantee, just a target.
  var GRID_CELL_TARGET_PX_MIN = 22;
  var GRID_CELL_TARGET_PX_MAX = 46;
  // The idroo/Miro-style nested subdivision (see _redrawGrid): every major
  // cell is split into MINOR_GRID_SUBDIVISIONS² smaller ones, which are
  // themselves split again, and so on — as many levels deep as the current
  // zoom makes visible. Unlike the very first version of this, the level-0
  // ("major") step is computed ONCE per _applySize (see this._gridBaseStep)
  // from the container size alone, NOT from the live zoom — so it never
  // re-snaps to a different nice-round-number mid-gesture. Every deeper
  // level is just that same fixed step divided by SUBDIVISIONS repeatedly,
  // so every line, at every level, sits at a fixed LOGICAL position that
  // never moves or swaps out from under the user while zooming — cells
  // never disappear, new finer ones just fade in inside them. A level's
  // opacity fades in continuously as its own on-screen size crosses from
  // FADE_MIN_PX (invisible, too dense to help) to FADE_MAX_PX (fully at
  // MINOR_GRID_OPACITY) — and once a level is fully faded in, it just
  // stays there; it's the next, finer level that starts fading in beneath
  // it. Level 0 itself is always drawn at the bolder MAJOR_GRID_OPACITY,
  // permanently (its own on-screen size only ever grows with zoom, never
  // shrinks below the fade band). How many levels actually become visible
  // before MAX_ZOOM is reached falls out of this math on its own — no
  // separate cap needed.
  var MINOR_GRID_SUBDIVISIONS = 5;
  var MINOR_GRID_FADE_MIN_PX  = 6;
  var MINOR_GRID_FADE_MAX_PX  = 14;
  var MAJOR_GRID_OPACITY = 0.16;
  var MINOR_GRID_OPACITY = 0.10;
  var GRID_MAX_LEVELS = 8; // safety cap on the subdivision loop; the fade-out condition always stops it well before this in practice

  // Same icon glyphs js/drawing-canvas.js uses for these exact tools/actions
  // — one consistent visual language across every drawing surface in the
  // app (the CSS classes are already deliberately shared, see the note on
  // .wb-board in css/style.css).
  var PEN_ICON         = '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>';
  var PENCIL_ICON      = '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>';
  var HIGHLIGHTER_ICON = '<path d="M4 20h4l10.5-10.5-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>';
  var ERASER_ICON      = '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>';

  // Per-tool cursors — a white halo behind a dark core (same technique
  // js/drawing-canvas.js's own CROSSHAIR_CURSOR uses) so each stays
  // visible against both the board's white paper and any darker chrome
  // around it. Pen/highlighter/eraser reuse their own toolbar glyph above
  // rather than a generic reticle, so the cursor reads as "this tool" at
  // a glance instead of the same interchangeable crosshair every drawing
  // app (including this one, before) tends to default to; the hotspot for
  // each sits at the glyph's own working tip (where a real pen/highlighter/
  // eraser would actually touch the page), not the icon's visual center.
  function haloCursor(glyph, hotspotX, hotspotY, fallback) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
      '<g fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' + glyph + '</g>' +
      '<g fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + glyph + '</g>' +
      '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + hotspotX + ' ' + hotspotY + ', ' + fallback;
  }
  // Pen cursor: a GoodNotes-style circle showing the actual nib — the
  // participant's own ink color, sized to match whatever width is
  // currently picked in the toolbar — rather than a generic pen glyph, so
  // hovering the board shows exactly how thick/what color the next stroke
  // will be instead of just "this is the pen tool". Recomputed (see
  // _updateCursor) whenever the tool becomes 'pen', the width changes, or
  // the zoom changes — diameterPx is expected already converted to
  // on-screen CSS px (picked width × current zoom) by the caller. A
  // white halo ring behind for contrast on dark ink/backgrounds (same
  // technique haloCursor above uses), a soft translucent fill so the paper/
  // ink underneath still shows through, and a crisp full-opacity ring
  // marking the exact boundary.
  function penCursor(color, diameterPx) {
    var r = Math.max(3, diameterPx / 2);
    var pad = 3;
    var size = r * 2 + pad * 2, c = size / 2;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="' + color + '" fill-opacity="0.32" stroke="#fff" stroke-width="2.4"/>' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="1.3"/>' +
      '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + c + ' ' + c + ', crosshair';
  }
  var HIGHLIGHTER_CURSOR = haloCursor(HIGHLIGHTER_ICON, 4, 20, 'crosshair');
  var ERASER_CURSOR      = haloCursor(ERASER_ICON, 12, 20, 'cell');
  // A precision reticle for the line/dashed-line/arrow tools — these place
  // two exact points rather than "touch here with a tip", so a crosshair
  // fits better than the pen-glyph cursors above; refined (thinner, plus a
  // center dot) from an earlier, blockier version of the same idea.
  var CROSSHAIR_CURSOR_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
    '<line x1="10" y1="1" x2="10" y2="19" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
    '<line x1="1" y1="10" x2="19" y2="10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
    '<line x1="10" y1="3" x2="10" y2="17" stroke="#1a1a1a" stroke-width="1.2" stroke-linecap="round"/>' +
    '<line x1="3" y1="10" x2="17" y2="10" stroke="#1a1a1a" stroke-width="1.2" stroke-linecap="round"/>' +
    '<circle cx="10" cy="10" r="1.6" fill="#1a1a1a"/>' +
    '</svg>';
  var CROSSHAIR_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent(CROSSHAIR_CURSOR_SVG) + '") 10 10, crosshair';
  // The text tool used to just use the native `cursor: text` I-beam — on a
  // dark-themed page (this whole app), Chromium picks a WHITE I-beam to
  // match the page's own color-scheme, which is invisible against the
  // board's own paper (always white, regardless of site theme — see the
  // dedicated comment on that elsewhere in this file) — exactly backwards
  // from what's needed here. Same halo technique as every other custom
  // cursor above instead: an always-dark I-beam that's never at the mercy
  // of the OS/browser's own light/dark cursor guess.
  var TEXT_CURSOR_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
    '<g stroke="#fff" stroke-width="3" stroke-linecap="round">' +
    '<line x1="10" y1="3" x2="10" y2="17"/><line x1="6" y1="3" x2="14" y2="3"/><line x1="6" y1="17" x2="14" y2="17"/>' +
    '</g>' +
    '<g stroke="#1a1a1a" stroke-width="1.4" stroke-linecap="round">' +
    '<line x1="10" y1="3" x2="10" y2="17"/><line x1="6" y1="3" x2="14" y2="3"/><line x1="6" y1="17" x2="14" y2="17"/>' +
    '</g>' +
    '</svg>';
  var TEXT_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent(TEXT_CURSOR_SVG) + '") 10 10, text';
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
  var TEXT_ICON        = '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>';

  /* Toolbar icons (2026-11-21): one family, drawn on a 24 grid with a 1.8 line (set in css/whiteboard.css), a single colour (currentColor, so the
     key's own state colours them) and a faint fill of the same colour for the solid parts, so they sit quietly in the strip and still tell apart at
     a glance: arrow, hand, eraser block, fountain pen, pencil, marker, T, root, line with ends, dashed line, arrow, shapes, mouse, stylus on a pad,
     picture, grid. The cursors keep the older glyphs above (their hotspots are tuned to them). */
  var DUO = ' fill="currentColor" fill-opacity=".16"';
  var TB = {
    select: '<path d="M6 3.6v15.2l3.9-3.7 2.7 5.4 2.6-1.3-2.7-5.3 5.4-.2z"' + DUO + '/>',
    pan: '<path d="M8 12.6V6.3a1.45 1.45 0 0 1 2.9 0V11"/><path d="M10.9 10.6V4.7a1.45 1.45 0 0 1 2.9 0v6"/><path d="M13.8 10.6V6a1.45 1.45 0 0 1 2.9 0v7.4"/><path d="M16.7 9.6a1.45 1.45 0 0 1 2.9 0v5.2c0 3.4-2.6 6-6 6h-.9c-2.1 0-3.5-.8-4.8-2.3l-3-3.5a1.4 1.4 0 0 1 2.1-1.9l1.9 1.8V6.3"' + DUO + '/>',
    eraser: '<path d="M4.6 14.4 13 6a2.1 2.1 0 0 1 3 0l3.2 3.2a2.1 2.1 0 0 1 0 3l-7.3 7.3H8.5a2.1 2.1 0 0 1-1.5-.6l-2.4-2.4a2.1 2.1 0 0 1 0-3.1z"' + DUO + '/><path d="m8.8 10.6 6 6"/><path d="M11.8 19.5H20"/>',
    pen: '<path d="M13.2 4.3a2.1 2.1 0 0 1 3 0l3.5 3.5a2.1 2.1 0 0 1 0 3l-7.4 7.4-6.6 2.3 2.3-6.6z"' + DUO + '/><path d="m5.7 20.3 4.4-4.4"/><path d="m12.4 5.1 6.5 6.5"/><circle cx="10.1" cy="13.9" r="1.2"/>',
    pencil: '<path d="M15.6 4.4a2.2 2.2 0 0 1 3.1 0l.9.9a2.2 2.2 0 0 1 0 3.1L8.7 19.3 4 20.3l1-4.7z"' + DUO + '/><path d="m13.6 6.4 4 4"/><path d="m5 15.6 3.4 3.4"/>',
    highlighter: '<path d="M14.4 4.6 19.4 9.6 11.6 17.4 6.6 12.4z"' + DUO + '/><path d="m6.6 12.4-1.8 4.6 1.7 1.7"/><path d="m6.5 18.7 2.9-.9 2.2-2.2"/><path d="M4 21h9"/>',
    text: '<path d="M5 8.2V5.4h14v2.8"/><path d="M12 5.4V19"/><path d="M9 19h6"/>',
    math: '<path d="m3.5 12.8 1.7-1 3 7 4-14H20.5"/><path d="m13.6 10.4 4.8 6.2m0-6.2-4.8 6.2"/>',
    line: '<path d="M6.4 17.6 17.6 6.4"/><circle cx="5.4" cy="18.6" r="1.9"' + DUO + '/><circle cx="18.6" cy="5.4" r="1.9"' + DUO + '/>',
    dashed: '<path d="M7.2 16.8 16.8 7.2" stroke-dasharray="2.2 2.6"/><circle cx="5.4" cy="18.6" r="1.9"' + DUO + '/><circle cx="18.6" cy="5.4" r="1.9"' + DUO + '/>',
    arrow: '<path d="M5.5 18.5 18 6"/><path d="M10.5 5.6h7.9v7.9"/><circle cx="5.5" cy="18.5" r="1.4"' + DUO + '/>',
    figures: '<path d="M8.2 4.2 13.2 12.8H3.2z"' + DUO + '/><circle cx="16.6" cy="8.2" r="4.1"/><rect x="11" y="13.6" width="9.5" height="7" rx="1.8"' + DUO + '/>',
    mouse: '<rect x="6.4" y="3" width="11.2" height="18" rx="5.6"' + DUO + '/><path d="M12 7.2v3.8"/>',
    stylus: '<rect x="3" y="12.2" width="12.2" height="8.4" rx="2.2"' + DUO + '/><path d="M20 4 11.4 12.6"/><path d="m17.8 3.2 3 3" stroke-width="2.8"/><path d="m11.4 12.6-.6 2.3 2.3-.6"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.6"/><circle cx="9" cy="10" r="1.9"' + DUO + '/><path d="m4 17.4 4.7-4.5a1.6 1.6 0 0 1 2.2 0l3.1 3 2-2 4.5 4"/>',
    grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.2"' + DUO + '/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>'
  };

  function toolBtn(tool, icon, title) {
    return '<button type="button" class="dc-tool-btn' + (tool === 'pen' ? ' dc-tool-btn--active' : '') +
      '" data-tool="' + tool + '" title="' + title + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg>' +
    '</button>';
  }

  // stroke-width 2, matching toolBtn's own icons exactly (not the geometry
  // configurator's 1.7 shapeIcon24 used to borrow) — next to a full-weight
  // line/arrow glyph in the SAME toolbar, 1.7 read as visibly thinner/
  // smaller despite being the same pixel box, which is exactly the "these
  // look tiny" complaint this was tuned to fix.
  function shapeIcon24(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  // ONE key for every geometric figure and body (iDroo style): a big panel with "Forme 2D" and "Corpuri 3D", large buttons.
  // Same .gfe-dropdown / .gfe-shape-btn markup as before, so the generic open/close and _insertShape keep working.
  var FIGURES_ICON = '<path d="M12 4 21 20H3Z"/>';
  function figuresDropdown() {
    function grid(ids) {
      return '<div class="wb-figs-grid">' + ids.map(function (id) {
        return '<button type="button" class="dc-tool-btn gfe-shape-btn wb-fig" data-shape="' + id + '" title="' + SHAPE_DEFS[id].label + '" aria-label="' + SHAPE_DEFS[id].label + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + SHAPE_DEFS[id].icon + '</svg></button>';
      }).join('') + '</div>';
    }
    return '<div class="gfe-dropdown wb-figs-dd">' +
      '<button type="button" class="dc-tool-btn gfe-dropdown__trigger" title="Figuri și corpuri geometrice" aria-label="Figuri și corpuri geometrice" aria-haspopup="true" aria-expanded="false">' +
        shapeIcon24(TB.figures) +
      '</button>' +
      '<div class="gfe-dropdown__panel wb-figs-panel">' +
        '<div class="wb-figs-sec"><b>Forme 2D</b>' + grid(SHAPE_IDS_2D) + '</div>' +
        '<div class="wb-figs-sec"><b>Corpuri 3D</b>' + grid(SHAPE_IDS_3D) + '</div>' +
      '</div>' +
    '</div>';
  }

  // The writing key's panel: the three presets (pen, pencil, marker) and the brush size in px.
  var PEN_PRESETS = [
    { id: 'pen', label: 'Pix', icon: TB.pen, title: 'Pix: grosimea liniei se subțiază cu viteza (P)' },
    { id: 'pencil', label: 'Creion', icon: TB.pencil, title: 'Creion: aceeași grosime, indiferent de viteză (C)' },
    { id: 'highlighter', label: 'Marker', icon: TB.highlighter, title: 'Marker (H)' }
  ];
  function penPanelHTML() {
    return '<div class="gfe-dropdown wb-pen-dd" id="wbPenDd">' +
      '<div class="gfe-dropdown__panel wb-pen-panel">' +
        '<div class="wb-pen-presets" role="group" aria-label="Tipul de scriere">' +
          PEN_PRESETS.map(function (pr, i) {
            return '<button type="button" class="wb-preset' + (i === 0 ? ' wb-preset--active' : '') + '" data-preset="' + pr.id + '" title="' + pr.title + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + pr.icon + '</svg><span>' + pr.label + '</span></button>';
          }).join('') +
        '</div>' +
        '<div class="wb-pen-size">' +
          '<div class="wb-pen-size__head"><span>Grosime</span><b class="wb-pen-size__v"><span id="wbWidthCustomVal">' + WIDTH_PRESETS[0] + '</span> px</b></div>' +
          '<div class="wb-pen-size__row">' +
            WIDTH_PRESETS.map(function (w, i) {
              var dotSize = 4 + i * 4;
              return '<button type="button" class="dc-width-btn' + (i === 0 ? ' dc-width-btn--active' : '') + '" data-width="' + w + '" title="' + w + ' px">' +
                '<span class="dc-width-dot" style="width:' + dotSize + 'px;height:' + dotSize + 'px"></span></button>';
            }).join('') +
            '<input type="range" class="wb-width-range" id="wbWidthCustomRange" min="' + WIDTH_MIN + '" max="' + WIDTH_MAX + '" step="0.5" value="' + WIDTH_PRESETS[0] + '" aria-label="Grosime în pixeli">' +
          '</div>' +
          '<div class="wb-pen-size__sample" aria-hidden="true"><i id="wbWidthSample"></i></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Undo / redo: next to the logo in the header of the live view (iDroo style), so they never cover the board.
  // Without a mount (any other page that embeds the board) they float in the corner of the canvas as before.
  function undoHTML() {
    return '<div class="wb-undo-corner" id="wbUndoCorner">' +
      '<button type="button" class="dc-action-btn" id="wbUndoBtn" title="Anulează (Ctrl+Z)" disabled>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + UNDO_ICON + '</svg>' +
      '</button>' +
      '<button type="button" class="dc-action-btn" id="wbRedoBtn" title="Reface (Ctrl+Y)" disabled>' +
        '<svg class="dc-icon-mirror" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + UNDO_ICON + '</svg>' +
      '</button>' +
    '</div>';
  }

  Whiteboard.prototype._build = function (container) {
    var wrap = document.createElement('div');
    wrap.className = 'wb-board';
    wrap.innerHTML =
      '<div class="dc-toolbar wb-toolbar">' +
        // A plain divider bar between EVERY group, including these four
        // (manipulate / ink+text / line shapes / shape+body pickers) — used
        // to be dc-tool-group--nodiv's lighter, divider-less spacing here
        // (idroo's own toolbar convention), but with this many groups in a
        // row that read as "which button belongs to which cluster?" instead
        // of just softer, so every group now gets the same divider the
        // width/grid/undo groups already had.
        '<div class="dc-tool-group">' +
          toolBtn('select', TB.select, 'Selectează și mută ce am desenat eu (Q)') +
          toolBtn('pan', TB.pan, 'Mișcă vizualizarea — trage pentru a naviga (W)') +
          toolBtn('eraser', TB.eraser, 'Radieră — șterge ce am desenat eu (E)') +
        '</div>' +
        '<div class="dc-tool-group">' +
          '<button type="button" class="dc-tool-btn dc-tool-btn--active wb-penkey" id="wbPenKey" data-tool="pen" aria-haspopup="true" aria-expanded="false" title="Scriere: pix, creion, marker și grosimea (P)">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + TB.pen + '</svg>' +
          '</button>' +
          toolBtn('text', TB.text, 'Text (T)') +
          (!this._readOnly && global.WBMath ?
            '<button type="button" class="dc-tool-btn" id="wbMathBtn" title="Ecuații și simboluri matematice (M). Dublu clic pe o formulă o modifică" aria-label="Ecuații și simboluri matematice">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + TB.math + '</svg>' +
            '</button>' : '') +
          penPanelHTML() +
        '</div>' +
        '<div class="dc-tool-group">' +
          toolBtn('line', TB.line, 'Linie dreaptă (apasă din nou pentru grosime)') +
          toolBtn('dashed-line', TB.dashed, 'Linie punctată (apasă din nou pentru grosime)') +
          toolBtn('arrow', TB.arrow, 'Săgeată (apasă din nou pentru grosime)') +
        '</div>' +
        '<div class="dc-tool-group">' +
          figuresDropdown() +
        '</div>' +
        // Stylus-only toggle — same markup/classes (.dc-inputmode-btn,
        // .dc-mode-badge) as js/drawing-canvas.js's own, reused as-is (that
        // CSS is already page-generic) so this reads as "the same toggle,
        // just in the whiteboard" rather than a new control to learn. See
        // _isInputAllowed for what it actually gates.
        '<div class="dc-tool-group">' +
          '<button type="button" class="dc-tool-btn dc-inputmode-btn" id="wbInputModeBtn" aria-pressed="false" title="Mod de scriere: orice input">' +
            '<svg class="dc-icon-any" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              TB.mouse +
            '</svg>' +
            '<svg class="dc-icon-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              TB.stylus +
            '</svg>' +
          '</button>' +
          '<span class="dc-mode-badge" role="status">Mod stilou activ</span>' +
        '</div>' +
        // The teacher's files (pictures, PDFs): a library opened from here, js/wb-files.js
        (this._isTeacher && !this._readOnly && this._onOpenFiles ?
        '<div class="dc-tool-group">' +
          '<button type="button" class="dc-tool-btn" id="wbFilesBtn" title="Fișiere, imagini și PDF-uri" aria-label="Fișiere, imagini și PDF-uri">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + TB.image + '</svg>' +
          '</button>' +
        '</div>' : '') +
        // Grid ON/OFF is a global, teacher-controlled session setting (see
        // setGridEnabled) — a student never gets this button at all, not
        // just a disabled one, so their toolbar doesn't imply a control
        // they don't have.
        (this._isTeacher ?
        '<div class="dc-tool-group">' +
          '<button type="button" class="dc-action-btn' + (this._gridOn ? ' dc-action-btn--active' : '') + '" id="wbGridBtn" title="' + (this._gridOn ? 'Ascunde grila' : 'Arată grila') + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + TB.grid + '</svg>' +
          '</button>' +
        '</div>' : '') +
      '</div>' +
      '<div class="wb-canvas-outer" id="wbCanvasOuter">' +
        '<div class="wb-locked-banner" id="wbLockedBanner">' +
          (global.icon ? global.icon('lock', { size: 16 }) : '') +
          '<span>Profesorul a blocat temporar scrisul tău pe tabla comună. Tabla ta rămâne a ta.</span>' +
        '</div>' +
        '<div class="wb-canvas-wrap" id="wbCanvasWrap">' +
          '<canvas class="wb-grid-canvas" id="wbGridCanvas"></canvas>' +
          '<canvas id="wbFabricCanvas"></canvas>' +
          (this._undoMount ? '' : undoHTML()) +
          // Transient hint shown when a blocked input tries to draw/interact
          // while stylus-only mode is on — same markup/class/copy as
          // js/drawing-canvas.js's own (.wb-canvas-wrap is already
          // position:relative, so this needs no whiteboard-specific CSS).
          '<div class="dc-input-hint" id="wbInputHint" role="status" aria-live="polite">Folosește pixul digital pentru a scrie</div>' +
        '</div>' +
      '</div>';
    container.appendChild(wrap);
    if (this._undoMount) this._undoMount.innerHTML = undoHTML();
    this._undoEl = (this._undoMount || wrap).querySelector('#wbUndoCorner');

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
    this._inputHint  = wrap.querySelector('#wbInputHint');
    this._applyLockedUi();
    this._applyInputMode(); // reflect the persisted preference in the UI
    // the equation editor's libraries (about 1 MB compressed) are fetched quietly a few seconds after the board opens, so the first press of the key is quick
    if (!this._readOnly && global.WBMath && !(global.navigator && navigator.connection && navigator.connection.saveData)) {
      var selfW = this;
      setTimeout(function () { if (!selfW._destroyed) global.WBMath.ready().catch(function () {}); }, 4000);
    }
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
    if (tool === 'pen' || tool === 'pencil' || tool === 'highlighter') this._setPenPreset(tool);
    // the writing options (presets, size) belong to the drawing tools only: pointer, pan, eraser and text close them
    if (tool !== 'pen' && tool !== 'pencil' && tool !== 'highlighter' && tool !== 'line' && tool !== 'dashed-line' && tool !== 'arrow') this._closeShapeDropdowns();
    this._toolbarEl.querySelectorAll('[data-tool]').forEach(function (b) {
      b.classList.toggle('dc-tool-btn--active', b.dataset.tool === tool);
    });
    this._updateCursor();
  };

  // The single writing key shows whichever of the three presets is current (icon and shortcut); the panel marks it too.
  Whiteboard.prototype._setPenPreset = function (preset) {
    this._penPreset = preset;
    var key = this._toolbarEl.querySelector('#wbPenKey');
    if (key) {
      key.dataset.tool = preset;
      var pr = PEN_PRESETS.filter(function (x) { return x.id === preset; })[0];
      var svg = key.querySelector('svg');
      if (pr && svg) svg.innerHTML = pr.icon;
    }
    this._toolbarEl.querySelectorAll('[data-preset]').forEach(function (b) {
      b.classList.toggle('wb-preset--active', b.dataset.preset === preset);
    });
  };

  // Width: the three round presets, the slider, the value in px and a sample line all show the same number.
  Whiteboard.prototype._syncWidthUi = function () {
    var w = this._width, txt = String(+w.toFixed(1));
    this._toolbarEl.querySelectorAll('.dc-width-btn').forEach(function (b) {
      b.classList.toggle('dc-width-btn--active', parseFloat(b.dataset.width) === w);
    });
    var range = this._toolbarEl.querySelector('#wbWidthCustomRange');
    if (range && parseFloat(range.value) !== w) range.value = w;
    var val = this._toolbarEl.querySelector('#wbWidthCustomVal');
    if (val) val.textContent = txt;
    var sample = this._toolbarEl.querySelector('#wbWidthSample');
    if (sample) sample.style.height = Math.max(1, w) + 'px';
    this._updateCursor();
  };

  // Opens (or closes) the writing panel under an anchor key. withPresets: the pen family also shows the three presets;
  // a line / arrow shows only the size.
  Whiteboard.prototype._toggleToolPanel = function (anchor, withPresets) {
    var dd = this._toolbarEl.querySelector('#wbPenDd');
    var wasOpen = dd.classList.contains('gfe-dropdown--open');
    this._closeShapeDropdowns();
    if (wasOpen) return;
    dd.classList.add('gfe-dropdown--open');
    dd.classList.toggle('wb-pen-dd--sizeonly', !withPresets);
    this._syncWidthUi();
    this._positionDropdownPanel(dd.querySelector('.gfe-dropdown__panel'), anchor.getBoundingClientRect());
    anchor.setAttribute('aria-expanded', 'true');
  };

  // Split out of _setTool so the pen's own cursor (see penCursor above) can
  // be refreshed WITHOUT switching tools too — it depends on the current
  // width and zoom, neither of which changing on their own goes through
  // _setTool at all (see the width-picker's click/input handlers and
  // _syncViewport, which all call this directly).
  Whiteboard.prototype._updateCursor = function () {
    if (!this._overlayEl) return;
    var tool = this._tool;
    // Locked blocks every tool except pan (pure navigation, never a
    // write — see setLocked) — that gets its usual 'grab' regardless,
    // everything else gets 'not-allowed' instead of its normal cursor so
    // it's obvious nothing will happen. Otherwise: pan gets the
    // browser's own grab/grabbing (already high-contrast, no custom
    // cursor needed), select the plain arrow (it's the one tool that
    // ISN'T about marking the board), and every drawing tool its own
    // glyph cursor — see haloCursor's own comment above for why each
    // gets its own rather than one shared crosshair.
    var cur =
      (this._locked && tool !== 'pan') ? 'not-allowed' :
      tool === 'eraser' ? ERASER_CURSOR :
      tool === 'pan' ? 'grab' :
      tool === 'select' ? 'default' :
      (tool === 'pen' || tool === 'pencil') ? penCursor(this._color, Math.max(6, Math.round(this._width * this._scale))) :
      tool === 'highlighter' ? HIGHLIGHTER_CURSOR :
      tool === 'text' ? TEXT_CURSOR :
      CROSSHAIR_CURSOR; // line / dashed-line / arrow
    // the pen's picture cursor is not set again while it is already the one showing (another gesture may have put 'grabbing' there)
    if ((tool === 'pen' || tool === 'pencil') && cur === this._cursorStr && this._overlayEl.style.cursor.indexOf('url(') === 0) return;
    this._cursorStr = cur;
    this._overlayEl.style.cursor = cur;
  };

  /* ---- Input mode (stylus-only vs. any input) — same convention as
     js/drawing-canvas.js's own toggle (see INPUT_MODE_KEY's own comment
     for why the localStorage key is shared, not whiteboard-specific). Lets
     a student rest a palm/finger on a tablet screen without leaving stray
     ink, and gives phones/tablets a deliberate "hand off to the stylus"
     switch the same way the exam scratch canvas already does. ---- */

  Whiteboard.prototype._loadInputMode = function () {
    try {
      return localStorage.getItem(INPUT_MODE_KEY) === 'pen' ? 'pen' : 'any';
    } catch (err) {
      return 'any'; // private mode / storage blocked -> safe default
    }
  };

  // pen (the stylus itself): always allowed. touch/mouse: only in "any" mode.
  Whiteboard.prototype._isInputAllowed = function (pointerType) {
    if (pointerType === 'pen') return true;
    return this._inputMode === 'any';
  };

  Whiteboard.prototype._toggleInputMode = function () {
    this._inputMode = (this._inputMode === 'pen') ? 'any' : 'pen';
    try { localStorage.setItem(INPUT_MODE_KEY, this._inputMode); } catch (err) {}
    this._applyInputMode();
  };

  Whiteboard.prototype._applyInputMode = function () {
    var stylusOnly = this._inputMode === 'pen';
    var btn = this._toolbarEl && this._toolbarEl.querySelector('#wbInputModeBtn');
    if (btn) {
      btn.classList.toggle('dc-inputmode-btn--stylus', stylusOnly);
      btn.classList.toggle('dc-tool-btn--active', stylusOnly);
      btn.setAttribute('aria-pressed', String(stylusOnly));
      btn.title = stylusOnly
        ? 'Mod stilou: doar pixul digital (apasă pentru orice input)'
        : 'Mod de scriere: orice input (apasă pentru doar stilou)';
    }
    var badge = this._toolbarEl && this._toolbarEl.querySelector('.dc-mode-badge');
    if (badge) badge.classList.toggle('dc-mode-badge--show', stylusOnly);
    // Leaving stylus-only mode clears any lingering "use the stylus" hint.
    if (!stylusOnly) this._hideInputHint();
  };

  Whiteboard.prototype._showInputHint = function () {
    if (!this._inputHint) return;
    this._inputHint.classList.add('dc-input-hint--show');
    var self = this;
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(function () { self._hideInputHint(); }, 2200);
  };

  Whiteboard.prototype._hideInputHint = function () {
    clearTimeout(this._hintTimer);
    if (this._inputHint) this._inputHint.classList.remove('dc-input-hint--show');
  };

  // Same open/position/close dance as js/geometry-figure-editor.js's own
  // _closeDropdowns (see that file's comment) — position:fixed (computed
  // here from the trigger's own getBoundingClientRect) rather than
  // absolute, since the toolbar's horizontal-scroll overflow would
  // otherwise clip an absolutely-positioned panel the same way it would
  // there.
  Whiteboard.prototype._closeShapeDropdowns = function () {
    this._toolbarEl.querySelectorAll('.gfe-dropdown--open').forEach(function (dd) {
      dd.classList.remove('gfe-dropdown--open');
      var trigger = dd.querySelector('.gfe-dropdown__trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
    var pk = this._toolbarEl.querySelector('#wbPenKey');
    if (pk) pk.setAttribute('aria-expanded', 'false');
  };

  // Clamps a just-opened .gfe-dropdown__panel to the viewport on both axes.
  // The naive "left-aligned under the trigger" placement (what both call
  // sites below used to just set directly) silently assumed a horizontal
  // toolbar row — it broke specifically in the landscape-phone layout
  // (see the "orientation: landscape" rules on .wb-board .dc-toolbar),
  // where the toolbar becomes a narrow 56px column pinned to the right
  // edge: a trigger's own rect then sits hard against the screen's right
  // edge, so "open below-and-left-aligned" pushed most of the panel off-
  // screen instead of just beside it. position:fixed doesn't get pulled
  // back on screen on its own the way an absolutely-positioned element
  // inside a scrolling ancestor might, so this has to happen explicitly.
  // Caller must add the --open class (making the panel display:block,
  // hence measurable via offsetWidth/Height) BEFORE calling this.
  //
  // A first version of this FLIPPED all the way to the trigger's opposite
  // edge whenever the naive placement didn't fit (mirroring how a
  // tooltip library typically handles this) — for a trigger sitting well
  // INTO the middle of a wide toolbar rather than right at its edge, that
  // jumped much further than it needed to, covering a whole strip of
  // OTHER toolbar buttons the panel had no real reason to sit on top of.
  // Plain clamping instead never jumps further than it has to: the panel
  // only ever slides the minimum distance needed to stay on screen, so it
  // stays as close to the trigger as it can.
  Whiteboard.prototype._positionDropdownPanel = function (panel, r) {
    var margin = 8;
    var pw = panel.offsetWidth, ph = panel.offsetHeight;
    var left = Math.max(margin, Math.min(r.left, window.innerWidth - pw - margin));
    var top  = Math.max(margin, Math.min(r.bottom + 6, window.innerHeight - ph - margin));
    panel.style.left = left + 'px';
    panel.style.top  = top + 'px';
  };

  Whiteboard.prototype._bindToolbar = function () {
    var self = this;
    // Custom-width slider (see _toggleCustomWidthPanel) — a plain direct
    // listener rather than folded into the delegated 'click' handler below,
    // since 'input' fires continuously while dragging and there's exactly
    // one of these, not a set of buttons to match by selector.
    this._toolbarEl.querySelector('#wbWidthCustomRange').addEventListener('input', function () {
      self._width = parseFloat(this.value);
      self._syncWidthUi(); // the dots, the value in px, the sample line and the pen cursor all follow
    });
    this._toolbarEl.addEventListener('click', function (e) {
      var ddTrigger = e.target.closest('.gfe-dropdown__trigger');
      if (ddTrigger) {
        var dd = ddTrigger.closest('.gfe-dropdown');
        var wasOpen = dd.classList.contains('gfe-dropdown--open');
        self._closeShapeDropdowns();
        if (!wasOpen) {
          dd.classList.add('gfe-dropdown--open');
          var panel = dd.querySelector('.gfe-dropdown__panel');
          self._positionDropdownPanel(panel, ddTrigger.getBoundingClientRect());
          ddTrigger.setAttribute('aria-expanded', 'true');
        }
        return;
      }
      var shapeBtn = e.target.closest('[data-shape]');
      if (shapeBtn) {
        self._insertShape(shapeBtn.dataset.shape);
        self._closeShapeDropdowns();
        return;
      }
      var penKey    = e.target.closest('#wbPenKey');
      var presetBtn = e.target.closest('[data-preset]');
      var toolBtnEl = e.target.closest('[data-tool]');
      var widthBtn  = e.target.closest('[data-width]');
      var gridBtn   = e.target.closest('#wbGridBtn');
      var filesBtn  = e.target.closest('#wbFilesBtn');
      var mathBtn   = e.target.closest('#wbMathBtn');
      var inputModeBtn = e.target.closest('#wbInputModeBtn');
      if (mathBtn) {
        self._closeShapeDropdowns();
        self._openMath(null);
      } else if (filesBtn) {
        self._closeShapeDropdowns();
        if (self._onOpenFiles) self._onOpenFiles();
      } else if (penKey) {
        // the single writing key: first press selects the current preset and opens its options, a press while it is
        // already the tool shows or hides them
        if (self._tool !== 'pen' && self._tool !== 'pencil' && self._tool !== 'highlighter') self._setTool(self._penPreset);
        self._toggleToolPanel(penKey, true);
      } else if (presetBtn) {
        self._setTool(presetBtn.dataset.preset);      // the panel stays open so the size can be set next
      } else if (toolBtnEl) {
        var t = toolBtnEl.dataset.tool;
        if ((t === 'line' || t === 'dashed-line' || t === 'arrow') && self._tool === t) {
          self._toggleToolPanel(toolBtnEl, false);     // a second press on a line tool: its size
        } else {
          self._setTool(t);
          self._closeShapeDropdowns();
        }
      } else if (widthBtn) {
        self._width = parseFloat(widthBtn.dataset.width);
        self._syncWidthUi();
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
      } else if (inputModeBtn) {
        self._toggleInputMode();
      }
    });

    // Undo/redo live in their own floating corner over the canvas now, not
    // in the toolbar (see _build) — a separate small listener rather than
    // folded into the delegated one above, since that one's scoped to
    // this._toolbarEl specifically and these buttons are no longer inside it.
    this._undoEl.addEventListener('click', function (e) {
      var undoBtn = e.target.closest('#wbUndoBtn');
      var redoBtn = e.target.closest('#wbRedoBtn');
      if (undoBtn && !undoBtn.disabled) self.undo();
      else if (redoBtn && !redoBtn.disabled) self.redo();
    });

    // Same two safety nets js/geometry-figure-editor.js's own shape-picker
    // dropdown uses: a click anywhere outside the toolbar (the canvas,
    // most likely — exactly where you'd click right after picking a shape)
    // and a page scroll (the panel is position:fixed, so it wouldn't
    // otherwise follow the trigger it's supposed to be anchored under).
    this._shapeDocClickHandler = function (e) {
      if (!self._toolbarEl.contains(e.target)) self._closeShapeDropdowns();
    };
    document.addEventListener('click', this._shapeDocClickHandler);
    this._shapeScrollCloseHandler = function (e) {
      // the panel itself scrolls (the figures panel on a phone): that must not close it
      var t = e && e.target;
      if (t && t.nodeType === 1 && t.closest && t.closest('.gfe-dropdown__panel')) return;
      self._closeShapeDropdowns();
    };
    global.addEventListener('scroll', this._shapeScrollCloseHandler, true);
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
      if (e.ctrlKey && e.altKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); self._togglePerf(); return; }
      if (self._readOnly) return;     // a replay: no shortcuts, no undo
      if (self._math) return;         // the equation editor is open: typing belongs to it
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
      } else if (e.key === 'c' || e.key === 'C') {
        self._setTool('pencil');
      } else if (e.key === 'h' || e.key === 'H') {
        self._setTool('highlighter');
      } else if (e.key === 't' || e.key === 'T') {
        self._setTool('text');
      } else if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        self._openMath(null);
      } else if (e.key === 'q' || e.key === 'Q') {
        self._setTool('select');
      } else if (e.key === 'w' || e.key === 'W') {
        self._setTool('pan');
      } else if (e.key === 'e' || e.key === 'E') {
        self._setTool('eraser');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && self._selectedIds.size) {
        // Select tool's multi-selection — own objects only, since
        // _selectedIds can never hold anyone else's id to begin with (see
        // _findMyObjectAt/the rubber-band's own owner-only filter).
        e.preventDefault();
        var ids = Array.from(self._selectedIds);
        self._selectedIds = new Set();
        self._deleteObjects(ids);
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

    // While a zoom gesture is shown by scaling the already-painted bitmaps (see _gestureTransform), a render at the new camera would land in
    // a canvas that still carries the CSS transform and jump; it is held back and the settle render paints everything once.
    // Fabric paints nothing here: it is the store of the objects. Every old "repaint everything" request becomes "every tile is stale" (the tiles
    // stay on screen and are painted again one by one), see _tlStaleAll.
    var fcSelf = this;
    this._fabricCanvas.skipOffscreen = false;
    this._fabricCanvas.requestRenderAll = function () { fcSelf._tlStaleAll(); return this; };
    this._fabricCanvas.renderAll = function () { return this; };

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
    this._tlInitLayers();

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

    // A plain wheel always zooms, centered on the cursor, no modifier key
    // needed — panning moved to a right-click-drag instead (see
    // _bindPointerEvents' pointerdown), which is what used to need a plain
    // scroll. Always preventDefault so the page itself never scrolls out
    // from under this.
    this._canvasWrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      self._setZoom(self._currentOrPendingZoom() * Math.pow(0.999, e.deltaY), e.clientX, e.clientY);
    }, { passive: false });
    // The right-click-drag pan below needs the browser's own context menu
    // out of the way, or a right-click-and-release-without-dragging (a
    // normal "just show me the menu" click) would still pop it up.
    this._canvasWrap.addEventListener('contextmenu', function (e) { e.preventDefault(); });
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
    // one device-pixel ratio for all three layers = Fabric's own retina scaling: a pan is then an exact whole-pixel shift on each of them
    var dpr = Math.min(global.devicePixelRatio || 1, 3);

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
    this._zoom = Math.max(MIN_SCALE / baseScale, Math.min(MAX_SCALE / baseScale, this._zoom));
    this._viewportW = vw;
    this._viewportH = vh;
    this._dpr       = dpr;
    this._scale     = baseScale * this._zoom;
    // The grid's level-0 step, fixed in LOGICAL units from here until the
    // next resize — deliberately computed from baseScale (the container's
    // own fit-to-screen scale), never this._scale, so it stays constant
    // across every zoom/pan step in between and the grid lines never jump.
    // See _redrawGrid and the constants above for the rest of the scheme.
    var gridMinDim = Math.min(vw, vh);
    this._gridTargetPx = Math.max(GRID_CELL_TARGET_PX_MIN, Math.min(GRID_CELL_TARGET_PX_MAX, gridMinDim / 14));
    this._panX = vw / 2 - centerLogicalX * this._scale;
    this._panY = vh / 2 - centerLogicalY * this._scale;
    this._clampCamera();

    var self = this;
    // The grid and stroke layers are BIGGER than the viewport (by OVERSCAN, shared between both sides): a pan then only moves the
    // already painted layers with a CSS transform, and a layer is repainted only when the viewport is about to leave it
    // ...but never more than a pixel budget: on a big or retina screen two layers of 20 million pixels each (80 MB apiece) are what
    // slows panning down, not the strokes
    var vpPx = vw * vh * this._dpr * this._dpr;
    var ov = Math.max(OVERSCAN_MIN, Math.min(OVERSCAN, Math.sqrt(LAYER_PIXEL_BUDGET / Math.max(1, vpPx)) - 1));
    this._cw = Math.ceil(vw * (1 + ov));
    this._ch = Math.ceil(vh * (1 + ov));
    [[this._layA, this._cw, this._ch], [this._layB, this._cw, this._ch], [this._overlayEl, vw, vh]].forEach(function (a) {
      var el = a[0];
      el.style.width  = a[1] + 'px';
      el.style.height = a[2] + 'px';
      el.width  = Math.round(a[1] * self._dpr);
      el.height = Math.round(a[2] * self._dpr);
    });
    // Fabric only keeps the objects now (it paints nothing: the tiles do), so its own canvas is a dot
    this._fabricCanvas.setDimensions({ width: 2, height: 2 });
    this._rend = null;          // sizes changed: whatever was painted is gone, the next sync is a full render
    this._syncViewport();
  };

  // Pushes the current camera (this._scale/_panX/_panY) to every layer
  // that needs it: Fabric's own viewportTransform for the committed
  // strokes (each one built with objectCaching:false in _addObjectIfNew —
  // see that flag's own comment for why a cached bitmap isn't safe to use
  // here, so every object is always re-rendered fresh from its vector path
  // at whatever the CURRENT transform is, zoom included, with nothing
  // extra needed on a zoom change the way a cached object would), the
  // grid/paper background (redrawn inline, cheap — see _redrawGrid), and the
  // live-stroke overlay (marked dirty, picked up on the next animation-
  // frame tick by _redrawOverlay so it stays batched with everyone else's
  // incoming points instead of forcing an extra paint of its own).
  // Coalesces a pan drag's own viewport pushes to at most once per animation
  // frame — same reasoning and same pattern as _setZoom's own
  // requestAnimationFrame batching just above (_pendingZoom/_zoomRafId),
  // just for panning instead of zooming. A raw pointermove stream can fire
  // well past display refresh rate (a fast mouse or a precision trackpad
  // easily reports 120-240+ moves/sec) — every one of those used to call
  // _syncViewport synchronously, which clears and repaints THREE full-size
  // canvases (Fabric's own, the grid, and — via the dirty flag below — the
  // overlay) at full device-pixel resolution, every single time. That's
  // real, unavoidable fill-rate work regardless of how little is actually
  // drawn on the board (confirmed live: noticeably laggy panning/zooming
  // with all of two strokes on the whole board) — capping it to one push
  // per frame, dropping whatever pan positions land in between before
  // their frame comes up, removes the redundant multiple-repaints-per-
  // frame part of that cost without changing what a single frame does.
  Whiteboard.prototype._scheduleSyncViewport = function () {
    if (this._panRafId) return;
    var self = this;
    this._panRafId = requestAnimationFrame(function () {
      self._panRafId = null;
      self._syncViewport();
    });
  };

  /* How the committed layer (paper, grid and all the ink) is painted (2026-11-21, tiles, like a map):
       - the board is cut into square TILES of TILE x TILE device pixels at the "paint scale" ps (the zoom the board was last settled at). A tile is
         white paper + grid lines + every object that touches it, painted once and kept. Nothing else paints ink;
       - what you see is the FRONT layer, a canvas 1.2 to 1.6 times the viewport, made of whole tiles drawn side by side (a plain drawImage, a
         few milliseconds). A PAN only moves that canvas with a CSS transform (the GPU does it) and, when the viewport is about to leave it, the
         canvas is composed again around the new camera from tiles that already exist: no ink is painted again;
       - a ZOOM is shown by scaling the front layer with the same CSS transform while the wheel or the pinch goes on. When it stops (90 ms) the
         board gets a new paint scale and the tiles of the new scale are painted a few at a time, the ones in view first, at most a few
         milliseconds of every frame. The layer that was on screen stays underneath as the GHOST, scaled to match, until the new tiles cover
         the view, so nothing blinks and no frame ever waits for a whole repaint;
       - a change to one object repaints only the tiles it touches (several at once if it must look right in the same frame, as when an object
         leaves the layer to be dragged); a change to everything (grid on or off, a batch of rows) marks every tile stale: stale tiles stay on
         screen and are replaced one by one;
       - objects far smaller than a pixel are drawn as a dot, so a board zoomed far out with thousands of strokes costs almost nothing.
     this._rend is the camera the front layer was composed at (scale = ps); this._grend is the same for the ghost. */
  var TILE = 512;                // device pixels per side of a tile
  var TILE_BUDGET_BUSY = 5;      // ms of tile painting per frame while the camera is moving
  var TILE_BUDGET_IDLE = 12;     // ...and when it is still
  var OVERSCAN = 0.6;            // extra size of the front layer, as a fraction of the viewport per axis (both sides together)
  var OVERSCAN_MIN = 0.22;       // ...never less than this
  var LAYER_PIXEL_BUDGET = 10e6; // device pixels of one layer: the overscan shrinks on big and retina screens to stay under it
  var SETTLE_MS = 90;            // after the last zoom step, how long before the board is painted at its new scale
  var TILE_LIMIT_BYTES = 130e6;  // memory for the cache of tiles

  // the layers: two canvases, one in front and one (the ghost) behind while the front is still being filled
  Whiteboard.prototype._tlInitLayers = function () {
    var self = this, wrap = this._canvasWrap;
    function mk(z) {
      var c = document.createElement('canvas');
      c.className = 'wb-tile-canvas';
      c.style.cssText = 'position:absolute;left:0;top:0;right:auto;bottom:auto;pointer-events:none;transform-origin:0 0;will-change:transform;z-index:' + z + ';';
      wrap.insertBefore(c, self._overlayEl);
      return c;
    }
    this._layA = mk(1); this._layB = mk(0);
    this._layB.style.display = 'none';
    this._front = this._layA; this._ghost = this._layB; this._ghostOn = false;
    this._tl = null; this._grend = null;
    this._queue = []; this._qset = new Set(); this._tilePool = [];
    if (this._gridEl) this._gridEl.style.display = 'none';
    var wEl = this._fabricCanvas && this._fabricCanvas.wrapperEl;
    if (wEl) wEl.style.display = 'none';
  };

  // the paint level for scale ps: grid steps and their opacities are fixed for it
  Whiteboard.prototype._tlMake = function (ps) {
    var steps = [niceGridStep((this._gridTargetPx || 32) / ps)];
    for (var i = 1; i < GRID_MAX_LEVELS; i++) {
      var nextStep = steps[i - 1] / MINOR_GRID_SUBDIVISIONS;
      if (nextStep * ps < MINOR_GRID_FADE_MIN_PX) break;
      steps.push(nextStep);
    }
    var ops = steps.map(function (step, lvl) {
      if (lvl === 0) return MAJOR_GRID_OPACITY;
      var t = Math.max(0, Math.min(1, (step * ps - MINOR_GRID_FADE_MIN_PX) / (MINOR_GRID_FADE_MAX_PX - MINOR_GRID_FADE_MIN_PX)));
      return MINOR_GRID_OPACITY * t;
    });
    return { ps: ps, S: ps * this._dpr, tiles: new Map(), steps: steps, ops: ops, gridOn: !!this._gridOn };
  };

  // Everything forgotten and composed again around the camera (first paint, resize, another board). No ghost: there is nothing to show under it.
  Whiteboard.prototype._tlReset = function () {
    clearTimeout(this._gestureTimer);
    this._gestureXform = false;
    this._queue = []; this._qset = new Set();
    this._ghostOn = false; this._grend = null;
    if (this._ghost) this._ghost.style.display = 'none';
    var tl = this._tl;
    if (tl) tl.tiles.forEach(function (t) { this._tilePool.push(t.cv); }, this);
    this._tl = null;
    this._rend = null;
    this._tlRefresh(true, true);
  };

  function xfFor(r, scale, panX, panY) {
    var k = scale / r.scale;
    return { k: k, tx: (k - 1) * r.ox + panX - k * r.panX, ty: (k - 1) * r.oy + panY - k * r.panY };
  }
  function setXf(el, x) {
    el.style.transform = (x.k === 1 && !x.tx && !x.ty) ? '' : 'matrix(' + x.k + ',0,0,' + x.k + ',' + x.tx + ',' + x.ty + ')';
  }
  // Where the layers sit and how they are stretched for the camera right now.
  Whiteboard.prototype._applyXforms = function () {
    if (this._rend) setXf(this._front, xfFor(this._rend, this._scale, this._panX, this._panY));
    if (this._ghostOn && this._grend) setXf(this._ghost, xfFor(this._grend, this._scale, this._panX, this._panY));
  };

  // The range of tiles (at the current level) under the front layer.
  Whiteboard.prototype._tlArea = function () {
    var r = this._rend, S = this._tl.S, dpr = r.dpr;
    var lx0 = (r.ox - r.panX) * dpr, ly0 = (r.oy - r.panY) * dpr;
    var wd = Math.round(this._cw * dpr), hd = Math.round(this._ch * dpr);
    return {
      tx0: Math.max(Math.floor(WORLD.x0 * S / TILE), Math.floor(lx0 / TILE)), tx1: Math.min(Math.floor(WORLD.x1 * S / TILE), Math.floor((lx0 + wd - 1) / TILE)),
      ty0: Math.max(Math.floor(WORLD.y0 * S / TILE), Math.floor(ly0 / TILE)), ty1: Math.min(Math.floor(WORLD.y1 * S / TILE), Math.floor((ly0 + hd - 1) / TILE))
    };
  };

  // The front layer composed around the camera from the tiles that exist; the missing and stale ones are queued.
  // newLevel: the board is painted at a new scale (fresh tiles). noGhost: do not keep the old layer underneath.
  Whiteboard.prototype._tlRefresh = function (newLevel, noGhost) {
    if (this._destroyed || this._bg) return;
    var dpr = this._dpr, vw = this._viewportW, vh = this._viewportH;
    if (!this._front) return;
    if (this._rend && !noGhost) {
      this._tlFlattenGhost();
      var tmp = this._front; this._front = this._ghost; this._ghost = tmp;
      this._grend = this._rend; this._ghostOn = true;
      this._ghost.style.zIndex = 0; this._ghost.style.display = '';
    }
    if (newLevel) {
      var old = this._tl;
      if (old) old.tiles.forEach(function (t) { this._tilePool.push(t.cv); }, this);   // the ghost is a bitmap of its own, the tiles are not needed
      this._tl = this._tlMake(this._scale);
      this._queue = []; this._qset = new Set();
    }
    var tl = this._tl;
    var exX = this._cw - vw, exY = this._ch - vh;
    // content moving right (pan growing) uncovers the left side: more room on the left
    var mx = exX * (this._panDirX > 0 ? 0.75 : this._panDirX < 0 ? 0.25 : 0.5);
    var my = exY * (this._panDirY > 0 ? 0.75 : this._panDirY < 0 ? 0.25 : 0.5);
    var ox = -Math.round(mx * dpr) / dpr, oy = -Math.round(my * dpr) / dpr;
    this._rend = { scale: tl.ps, panX: this._panX, panY: this._panY, ox: ox, oy: oy, vw: vw, vh: vh, dpr: dpr };
    var f = this._front;
    f.style.zIndex = 1; f.style.display = '';
    f.style.left = ox + 'px'; f.style.top = oy + 'px';
    var ctx = f.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, f.width, f.height);
    this._gestureXform = false;
    var a = this._tlArea();
    for (var ty = a.ty0; ty <= a.ty1; ty++) {
      for (var tx = a.tx0; tx <= a.tx1; tx++) {
        var t = tl.tiles.get(tx + ',' + ty);
        if (t) { this._tlBlit(tx, ty, t); if (t.stale) this._tlEnqueue(tx, ty); }
        else this._tlEnqueue(tx, ty);
      }
    }
    this._applyXforms();
    if (!this._queue.length) this._tlDrained();
  };

  // When the ghost is still on screen as a new composition begins, its pixels are copied under the front layer first, so a second change of
  // scale before the first one finished is not lost (the holes of the front layer show the picture that was there).
  Whiteboard.prototype._tlFlattenGhost = function () {
    if (!this._ghostOn || !this._grend || !this._rend) return;
    var fr = this._rend, gr = this._grend, dpr = fr.dpr;
    var xf = xfFor(fr, this._scale, this._panX, this._panY), xg = xfFor(gr, this._scale, this._panX, this._panY);
    var a = xg.k / xf.k, e = (gr.ox + xg.tx - fr.ox - xf.tx) / xf.k, g = (gr.oy + xg.ty - fr.oy - xf.ty) / xf.k;
    var ctx = this._front.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.setTransform(a, 0, 0, a, e * dpr, g * dpr);
    try { ctx.drawImage(this._ghost, 0, 0); } catch (err) { /* a layer with no size yet */ }
    ctx.restore();
  };

  Whiteboard.prototype._tlDrained = function () {
    if (!this._ghostOn) return;
    this._ghostOn = false; this._grend = null;
    this._ghost.style.display = 'none';
    this._ghost.style.transform = '';
    var c = this._ghost.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this._ghost.width, this._ghost.height);
  };

  Whiteboard.prototype._tlEnqueue = function (tx, ty) {
    var key = tx + ',' + ty;
    if (this._qset.has(key)) return;
    this._qset.add(key);
    this._queue.push({ tx: tx, ty: ty });
    this._tlKick();
  };
  Whiteboard.prototype._tlKick = function () {
    if (this._pumpRaf || this._destroyed) return;
    var self = this;
    this._pumpRaf = requestAnimationFrame(function () { self._pumpRaf = null; self._tlPump(); });
  };

  // Paints queued tiles, the ones in view and nearest to its centre first, for a few milliseconds, and asks for the next frame if more are waiting.
  Whiteboard.prototype._tlPump = function () {
    if (this._destroyed || this._bg || !this._tl || !this._rend) return;
    var now = performance.now(), busy = this._camAt && now - this._camAt < 140;
    var budget = busy ? TILE_BUDGET_BUSY : TILE_BUDGET_IDLE;
    var tl = this._tl, dpr = this._dpr;
    var cxl = (this._viewportW / 2 - this._panX) * dpr * (tl.ps / this._scale), cyl = (this._viewportH / 2 - this._panY) * dpr * (tl.ps / this._scale);
    var vx0 = -this._panX * dpr * (tl.ps / this._scale), vy0 = -this._panY * dpr * (tl.ps / this._scale);
    var vx1 = vx0 + this._viewportW * dpr * (tl.ps / this._scale), vy1 = vy0 + this._viewportH * dpr * (tl.ps / this._scale);
    var painted = 0;
    while (this._queue.length) {
      var best = 0, bd = Infinity;
      for (var i = 0; i < this._queue.length; i++) {
        var q = this._queue[i], x0 = q.tx * TILE, y0 = q.ty * TILE;
        var vis = !(x0 > vx1 || x0 + TILE < vx0 || y0 > vy1 || y0 + TILE < vy0);
        var dx = x0 + TILE / 2 - cxl, dy = y0 + TILE / 2 - cyl, d = dx * dx + dy * dy + (vis ? 0 : 1e14);
        if (d < bd) { bd = d; best = i; }
      }
      var it = this._queue.splice(best, 1)[0];
      this._qset.delete(it.tx + ',' + it.ty);
      var t = this._tlPaintTile(it.tx, it.ty);
      this._tlBlit(it.tx, it.ty, t);
      painted++;
      if (performance.now() - now > budget) break;
    }
    if (this._perfEl) this._perfNote(performance.now() - now, painted);
    if (this._queue.length) this._tlKick(); else this._tlDrained();
  };

  function pathCmdString(path) {
    var s = '';
    for (var i = 0; i < path.length; i++) s += path[i].join(' ') + ' ';
    return s;
  }

  // One object painted into ctx, whose transform maps board units to the pixels of the tile. Pen strokes (a filled outline) go through a cached
  // Path2D: the browser parses and fills it natively, which is several times faster than Fabric walking the commands one by one.
  Whiteboard.prototype._tlPaintObj = function (ctx, o, S) {
    var b = objBox(o), bw = (b.x1 - b.x0) * S, bh = (b.y1 - b.y0) * S;
    if (bw < 1.5 && bh < 1.5 && o.type === 'path') {          // smaller than a pixel: a dot of its colour
      ctx.globalAlpha = (o.opacity == null ? 1 : o.opacity) * 0.8;
      ctx.fillStyle = o.fill || o.stroke || '#000';
      var m = 1 / S;
      ctx.fillRect((b.x0 + b.x1) / 2 - m / 2, (b.y0 + b.y1) / 2 - m / 2, m, m);
      ctx.globalAlpha = 1;
      return;
    }
    if (o.type === 'path' && o.fill && !o.stroke && typeof Path2D !== 'undefined') {
      var p2 = o._p2d;
      if (!p2) { try { p2 = o._p2d = new Path2D(pathCmdString(o.path)); } catch (e) { p2 = o._p2d = null; } }
      if (p2) {
        var mt = o.calcTransformMatrix();
        ctx.save();
        ctx.transform(mt[0], mt[1], mt[2], mt[3], mt[4], mt[5]);
        ctx.translate(-o.pathOffset.x, -o.pathOffset.y);
        ctx.globalAlpha = o.opacity == null ? 1 : o.opacity;
        ctx.fillStyle = o.fill;
        ctx.fill(p2);
        // far out, a pen line is a fraction of a pixel wide and would vanish: it keeps a hairline, as on any whiteboard
        var sw = o.strokeWidth || 2;
        if (sw * S * Math.max(Math.abs(mt[0]), Math.abs(mt[3])) < 1.1) {
          ctx.globalAlpha *= 0.8;
          ctx.strokeStyle = o.fill;
          ctx.lineWidth = 1.1 / (S * Math.max(Math.abs(mt[0]), Math.abs(mt[3])));
          ctx.stroke(p2);
        }
        ctx.restore();
        return;
      }
    }
    var oldSw = o.strokeWidth, thin = o.stroke && oldSw * S * (o.strokeUniform ? 1 : Math.max(Math.abs(o.scaleX || 1), Math.abs(o.scaleY || 1))) < 1.1;
    if (thin) o.strokeWidth = 1.1 / (S * (o.strokeUniform ? 1 : Math.max(Math.abs(o.scaleX || 1), Math.abs(o.scaleY || 1))));
    try { o.render(ctx); } catch (err) { /* a half-built object must not stop the repaint */ }
    if (thin) o.strokeWidth = oldSw;
  };

  // The grid lines of one tile, in device pixels, each snapped to a whole pixel (crisp, one pixel wide at any zoom). They sit at fixed board
  // positions, so neighbouring tiles agree and nothing moves while panning.
  Whiteboard.prototype._tlGrid = function (ctx, tx, ty, tl) {
    var S = tl.S, ox = tx * TILE, oy = ty * TILE;
    var wx0 = ox / S, wx1 = (ox + TILE) / S, wy0 = oy / S, wy1 = (oy + TILE) / S;
    ctx.lineWidth = 1;
    for (var lvl = tl.steps.length - 1; lvl >= 0; lvl--) {      // finest first, the coarse lines paint on top
      var op = tl.ops[lvl]; if (op <= 0) continue;
      var step = tl.steps[lvl];
      ctx.strokeStyle = 'rgba(20,16,8,' + op + ')';
      ctx.beginPath();
      for (var kx = Math.ceil(wx0 / step), kx1 = Math.floor(wx1 / step); kx <= kx1; kx++) { var xd = Math.round(kx * step * S) - ox + 0.5; if (xd < 0 || xd > TILE) continue; ctx.moveTo(xd, 0); ctx.lineTo(xd, TILE); }
      for (var ky = Math.ceil(wy0 / step), ky1 = Math.floor(wy1 / step); ky <= ky1; ky++) { var yd = Math.round(ky * step * S) - oy + 0.5; if (yd < 0 || yd > TILE) continue; ctx.moveTo(0, yd); ctx.lineTo(TILE, yd); }
      ctx.stroke();
    }
  };

  // Paints (or repaints) one tile of the current level and returns it.
  Whiteboard.prototype._tlPaintTile = function (tx, ty) {
    var tl = this._tl, S = tl.S, key = tx + ',' + ty, t = tl.tiles.get(key);
    if (!t) {
      var cv = this._tilePool.pop();
      if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = TILE; }
      t = { cv: cv, stale: false };
      tl.tiles.set(key, t);
      this._tlEvict(key);
    }
    var ctx = t.cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, TILE, TILE);
    if (tl.gridOn) this._tlGrid(ctx, tx, ty, tl);
    var m = 3 / S, reg = { x0: tx * TILE / S - m, y0: ty * TILE / S - m, x1: (tx + 1) * TILE / S + m, y1: (ty + 1) * TILE / S + m };
    ctx.setTransform(S, 0, 0, S, -tx * TILE, -ty * TILE);
    var list = this._fabricCanvas._objects;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (!o.visible || !boxesTouch(objBox(o), reg)) continue;
      this._tlPaintObj(ctx, o, S);
    }
    t.stale = false;
    return t;
  };

  // Keeps the cache within its memory: the tiles farthest from the camera are given up first (the ones under the front layer stay).
  Whiteboard.prototype._tlEvict = function (keepKey) {
    var tl = this._tl, max = Math.max(60, Math.min(150, Math.floor(TILE_LIMIT_BYTES / (TILE * TILE * 4))));
    if (tl.tiles.size <= max) return;
    var a = this._tlArea(), self = this, S = tl.S, dpr = this._dpr;
    var cx = (this._viewportW / 2 - this._panX) * dpr * (tl.ps / this._scale) / TILE, cy = (this._viewportH / 2 - this._panY) * dpr * (tl.ps / this._scale) / TILE;
    var list = [];
    tl.tiles.forEach(function (t, k) {
      var p = k.split(','), x = +p[0], y = +p[1];
      if (k === keepKey || (x >= a.tx0 && x <= a.tx1 && y >= a.ty0 && y <= a.ty1)) return;
      list.push({ k: k, d: (x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy) });
    });
    list.sort(function (p, q) { return q.d - p.d; });
    for (var i = 0; i < list.length && tl.tiles.size > max; i++) {
      var t = tl.tiles.get(list[i].k);
      if (t) self._tilePool.push(t.cv);
      tl.tiles.delete(list[i].k);
    }
  };

  // A tile drawn onto the front layer (when it is at the same scale as the tiles).
  Whiteboard.prototype._tlBlit = function (tx, ty, t) {
    var r = this._rend, tl = this._tl;
    if (!r || !tl || r.scale !== tl.ps || !t) return;
    var f = this._front, dx = Math.round(tx * TILE + (r.panX - r.ox) * r.dpr), dy = Math.round(ty * TILE + (r.panY - r.oy) * r.dpr);
    if (dx >= f.width || dy >= f.height || dx + TILE <= 0 || dy + TILE <= 0) return;
    f.getContext('2d').drawImage(t.cv, dx, dy);
  };

  // Every tile out of date (the grid was switched, many objects arrived at once): they stay on screen until each one has been painted again.
  Whiteboard.prototype._tlStaleAll = function () {
    if (this._destroyed || this._bg) return;
    if (this._staleRaf) return;
    var self = this;
    this._staleRaf = requestAnimationFrame(function () {
      self._staleRaf = null;
      var tl = self._tl;
      if (self._destroyed || self._bg || !tl || !self._rend) return;
      if (self._gestureXform) return;               // a settle is coming: it paints everything at the new scale anyway
      tl.gridOn = !!self._gridOn;
      tl.tiles.forEach(function (t) { t.stale = true; });
      var a = self._tlArea();
      for (var ty = a.ty0; ty <= a.ty1; ty++) for (var tx = a.tx0; tx <= a.tx1; tx++) self._tlEnqueue(tx, ty);
    });
  };

  // The tiles (that exist) touching these board boxes.
  Whiteboard.prototype._tlTilesFor = function (u) {
    var tl = this._tl, S = tl.S, out = [], m = 2 / S;
    var tx0 = Math.floor((u.x0 - m) * S / TILE), tx1 = Math.floor((u.x1 + m) * S / TILE), ty0 = Math.floor((u.y0 - m) * S / TILE), ty1 = Math.floor((u.y1 + m) * S / TILE);
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 400) { tl.tiles.forEach(function (t, k) { var p = k.split(','); out.push([+p[0], +p[1]]); }); return out; }
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) if (tl.tiles.has(tx + ',' + ty)) out.push([tx, ty]);
    return out;
  };

  /* Dirty regions: an object is erased, undone, moved or dropped after a drag, a text changes. Only the tiles it touches are painted again, in the
     same frame when there are few of them (an object that leaves the layer to be dragged must be gone from it at once), or as stale tiles otherwise. */
  Whiteboard.prototype._invalidateBoxes = function (boxes) {
    if (this._bg || !boxes || !boxes.length) return;
    var self = this;
    this._pendingBoxes = (this._pendingBoxes || []).concat(boxes);
    if (this._boxRaf) return;
    this._boxRaf = requestAnimationFrame(function () {
      self._boxRaf = null;
      var list = self._pendingBoxes || [];
      self._pendingBoxes = [];
      if (!self._destroyed && list.length) self._renderBoxes(list);
    });
  };

  Whiteboard.prototype._renderBoxes = function (boxes) {
    if (this._destroyed || this._bg || !boxes.length) return;
    if (this._gestureXform || !this._tl || !this._rend) return;     // the layers are scaled during a zoom: the settle paints everything
    var tiles = this._tlTilesFor(unionBoxes(boxes)), now = tiles.length <= 8;
    for (var i = 0; i < tiles.length; i++) {
      var tx = tiles[i][0], ty = tiles[i][1];
      if (now) this._tlBlit(tx, ty, this._tlPaintTile(tx, ty));
      else { var t = this._tl.tiles.get(tx + ',' + ty); if (t) t.stale = true; this._tlEnqueue(tx, ty); }
    }
  };

  // A new object goes on top of everything: it is painted onto the tiles it touches (and onto the front layer) instead of repainting them.
  Whiteboard.prototype._paintNewObject = function (obj) {
    if (!obj || this._bg || this._gestureXform || !this._tl || !this._rend) return;
    if (obj.data && obj.data.boardKey && obj.data.boardKey !== this._board.key) return;   // it landed on a board that is not on screen
    if (obj.data && obj.data.isImage) { this._invalidateBoxes([objBox(obj)]); return; }   // pictures lie under the ink
    var tl = this._tl, S = tl.S, b = objBox(obj), tiles = this._tlTilesFor(b);
    for (var i = 0; i < tiles.length; i++) {
      var tx = tiles[i][0], ty = tiles[i][1], t = tl.tiles.get(tx + ',' + ty);
      if (!t) continue;
      var ctx = t.cv.getContext('2d');
      ctx.setTransform(S, 0, 0, S, -tx * TILE, -ty * TILE);
      this._tlPaintObj(ctx, obj, S);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this._tlBlit(tx, ty, t);
    }
  };

  Whiteboard.prototype._syncViewport = function () {
    var dpr = this._dpr;
    this._panX = Math.round(this._panX * dpr) / dpr;
    this._panY = Math.round(this._panY * dpr) / dpr;
    this._camAt = performance.now();
    var r = this._rend;
    this._fabricCanvas.setViewportTransform([this._scale, 0, 0, this._scale, this._panX, this._panY]);

    var sameCanvas = r && r.vw === this._viewportW && r.vh === this._viewportH && r.dpr === dpr;
    if (!sameCanvas) {
      this._tlReset();
    } else if (r.scale !== this._scale) {
      // a zoom step: the layers are only scaled (the GPU does it); the board is painted at its new scale 90 ms after the last step
      this._gestureXform = true;
      this._applyXforms();
      var self = this;
      clearTimeout(this._gestureTimer);
      this._gestureTimer = setTimeout(function () { if (!self._destroyed) { self._gestureXform = false; self._tlRefresh(true); self._dirty = true; } }, SETTLE_MS);
    } else {
      this._applyXforms();
      var tx = this._panX - r.panX, ty = this._panY - r.panY;
      if (tx) this._panDirX = tx > 0 ? 1 : -1;
      if (ty) this._panDirY = ty > 0 ? 1 : -1;
      // the viewport must stay inside the front layer: else it is composed again around the new camera (from tiles that already exist)
      var L = r.ox + tx, T = r.oy + ty;
      if (L > 0 || T > 0 || L + this._cw < this._viewportW || T + this._ch < this._viewportH) this._tlRefresh(false);
    }

    this._dirty = true;
    // the overlay (live strokes, selection, a dragged object) is painted at the current camera right away, so it never trails the layers
    if (this._liveStrokes.size || this._selectedIds.size || this._dragObjs) { this._redrawOverlay(); this._dirty = false; }
    // Keeps the text tool's live editing <textarea> anchored to its spot on the BOARD
    if (this._textEditing) this._repositionTextEditor();
    if (this._math) this._math.reposition();
    // The pen cursor's own on-screen size is the picked width AT THE CURRENT ZOOM. A new cursor picture at every wheel step makes
    // the browser decode an image per frame, so it is refreshed once the zoom settles.
    if (this._tool === 'pen' || this._tool === 'pencil') {
      clearTimeout(this._cursorTimer);
      var selfC = this;
      this._cursorTimer = setTimeout(function () { if (!selfC._destroyed) selfC._updateCursor(); }, 110);
    }
  };

  // A small readout for finding out what is slow on a given machine (Ctrl + Alt + P shows or hides it): the last tile pass (ms and tiles), the tiles waiting
  // and kept, the paint scale, and the frame rate.
  Whiteboard.prototype._togglePerf = function () {
    if (this._perfEl) { this._perfEl.remove(); this._perfEl = null; try { localStorage.removeItem('wb_perf'); } catch (e) {} return; }
    var el = document.createElement('div');
    el.className = 'wb-perf';
    this._canvasWrap.appendChild(el);
    this._perfEl = el;
    this._perfLast = null;
    try { localStorage.setItem('wb_perf', '1'); } catch (e) {}
    this._perfRender();
  };
  Whiteboard.prototype._perfNote = function (ms, tiles) {
    this._perfLast = { ms: ms, tiles: tiles, n: ((this._perfLast && this._perfLast.n) || 0) + 1 };
    this._perfRender();
  };
  Whiteboard.prototype._perfRender = function () {
    if (!this._perfEl) return;
    var l = this._perfLast, mp = (this._cw * this._ch * this._dpr * this._dpr / 1e6).toFixed(1), tl = this._tl;
    this._perfEl.textContent = (l ? 'dale ' + l.tiles + ' în ' + Math.round(l.ms) + ' ms (x' + l.n + ')' : 'dale: nimic încă') +
      ' · așteaptă ' + (this._queue ? this._queue.length : 0) + ' · în memorie ' + (tl ? tl.tiles.size : 0) + ' · scara ' + (tl ? Math.round(tl.ps * 1000) / 1000 : '-') +
      ' · strat ' + mp + ' MP · ' + Math.round(this._dpr * 100) / 100 + 'x · ' + (this._fps || 0) + ' fps' + (this._maxGap ? ' · cel mai lung cadru ' + this._maxGap + ' ms' : '');
  };

  // Keeps the camera inside the world (which is huge but not unbounded): per axis, if the world at the current scale is smaller than the viewport it is
  // centred, otherwise its far edge can never leave a gap between it and the viewport's own far edge.
  Whiteboard.prototype._clampCamera = function () {
    var vw = this._canvasWrap.clientWidth  || 1;
    var vh = this._canvasWrap.clientHeight || 1;
    this._panX = clampPanAxis(this._panX, WORLD.x0, WORLD.x1, vw, this._scale);
    this._panY = clampPanAxis(this._panY, WORLD.y0, WORLD.y1, vh, this._scale);
  };

  function clampPanAxis(pan, w0, w1, viewportSize, s) {
    var c0 = w0 * s, c1 = w1 * s, size = c1 - c0;
    if (size <= viewportSize) return (viewportSize - size) / 2 - c0;
    return Math.min(-c0, Math.max(viewportSize - c1, pan));
  }

  // Snaps a raw logical grid step to the nearest 1-2-5-per-decade value
  // (…,10,20,50,100,200,500,1000,…) — the same progression rulers, chart
  // axes, and every adaptive-grid design tool (Miro, Figma, idroo) use,
  // instead of a perfectly continuous size. That's deliberate: it's what
  // gives an adaptive grid its "coarser squares split into finer ones as
  // you zoom in" feel, arriving in discrete jumps at nice round numbers,
  // rather than a mathematically-smooth but visually-arbitrary resize.
  function niceGridStep(raw) {
    var exp = Math.floor(Math.log(raw) / Math.LN10);
    var base = Math.pow(10, exp);
    var frac = raw / base;
    var niceFrac = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
    return niceFrac * base;
  }

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
  Whiteboard.prototype._zoomLimits = function () {
    var bs = this._baseScale || 1;
    return { min: MIN_SCALE / bs, max: MAX_SCALE / bs };
  };

  // A wheel step or a button asks for a zoom and the board glides to it (about 70 ms to cover most of the way, like iDroo); a pinch follows the
  // fingers exactly (instant). Either way every frame is only a change of the layers' CSS transform: nothing is painted until it settles.
  Whiteboard.prototype._setZoom = function (z, clientX, clientY, instant) {
    var lim = this._zoomLimits();
    z = Math.max(lim.min, Math.min(lim.max, z));
    this._zoomGoal = { z: z, clientX: clientX, clientY: clientY };
    if (instant) {
      this._zoomAnimOn = false;
      if (this._zoomRafId) { cancelAnimationFrame(this._zoomRafId); this._zoomRafId = null; }
      this._applyZoomTo(z, clientX, clientY);
      this._zoomGoal = null;
      return;
    }
    if (this._zoomRafId) return;
    var self = this, last = performance.now();
    this._zoomAnimOn = true;
    function frame(now) {
      self._zoomRafId = null;
      var g = self._zoomGoal;
      if (self._destroyed || !g) return;
      var dt = Math.min(64, Math.max(1, now - last)); last = now;
      var cur = self._zoom, ratio = g.z / cur;
      if (Math.abs(Math.log(ratio)) < 0.0015) { self._zoomGoal = null; self._applyZoomTo(g.z, g.clientX, g.clientY); return; }
      var f = 1 - Math.exp(-dt / 70);
      self._applyZoomTo(cur * Math.pow(ratio, f), g.clientX, g.clientY);
      self._zoomRafId = requestAnimationFrame(frame);
    }
    this._zoomRafId = requestAnimationFrame(frame);
  };

  // The zoom value a caller should treat as "current" while a zoom is in flight: the wheel handler computes its next zoom multiplicatively
  // off of the goal, so several notches inside one animation add up.
  Whiteboard.prototype._currentOrPendingZoom = function () {
    return this._zoomGoal ? this._zoomGoal.z : this._zoom;
  };

  Whiteboard.prototype._applyZoomTo = function (z, clientX, clientY) {
    if (this._destroyed || z === this._zoom) return;
    var wrapRect = this._canvasWrap.getBoundingClientRect();
    var anchorX = (clientX != null) ? (clientX - wrapRect.left) : (this._canvasWrap.clientWidth  / 2);
    var anchorY = (clientY != null) ? (clientY - wrapRect.top)  : (this._canvasWrap.clientHeight / 2);
    // The logical point currently under the anchor, before the scale changes: solving _panX/_panY below for "this same point maps back to this
    // same anchor" is what keeps it visually fixed.
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
    if (this._onZoomChange) this._onZoomChange(Math.round(this._scale * 100));
  };

  // Clamped to the logical board's own bounds — the viewport can show area
  // beyond the white paper (panned so it doesn't fill the visible area, or
  // just a mismatched aspect ratio), and without this a stroke/erase/
  // select gesture that starts or drags through that margin would place
  // real points out there instead of stopping at the paper's edge.
  Whiteboard.prototype._getPos = function (e) {
    var rect = this._overlayEl.getBoundingClientRect();
    var x = (e.clientX - rect.left - this._panX) / this._scale;
    var y = (e.clientY - rect.top  - this._panY) / this._scale;
    return {
      x: Math.max(WORLD.x0, Math.min(WORLD.x1, x)),
      y: Math.max(WORLD.y0, Math.min(WORLD.y1, y))
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
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      // Belt-and-suspenders alongside the text editor's own blur handler
      // (see _startTextEditor) — any click reaching the canvas itself means
      // focus has already left the editing <textarea>, so finish it before
      // dispatching this click to whatever tool is active. Idempotent if
      // blur already got there first (see the guard at the top of
      // _finishTextEditor).
      if (self._textEditing) self._finishTextEditor(false);

      // Right mouse button always pans, whatever tool is currently active
      // — a "hold to navigate" convention so nudging the view doesn't
      // force a trip to the toolbar's own pan tool first. Pure navigation,
      // never a write, so — same as the pan tool below — allowed even
      // while locked (see setLocked).
      if (e.pointerType === 'mouse' && e.button === 2) {
        self._activePtrs[e.pointerId] = {
          panning: true, startX: e.clientX, startY: e.clientY,
          panStartX: self._panX, panStartY: self._panY
        };
        el.style.cursor = 'grabbing';
        return;
      }

      if (e.pointerType === 'touch') {
        self._touchPositions[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (self._touchCount() >= 2) { self._beginPinch(); return; }
        // A 3rd+ finger while already pinching with two others — ignore it
        // rather than let it start a stray draw/erase/pan underneath.
        if (self._pinching) return;
        // A single finger in stylus-only mode pans instead of drawing/
        // interacting — same convention js/drawing-canvas.js's own toggle
        // uses (see _isInputAllowed): touch still does something useful
        // rather than just being silently ignored. The pan TOOL's own
        // touch handling is already covered generically by the branch
        // just below (it doesn't check pointerType at all), so this only
        // needs to add the stylus-only case for every OTHER tool.
        if (self._inputMode === 'pen' && self._tool !== 'pan') {
          self._activePtrs[e.pointerId] = {
            panning: true, startX: e.clientX, startY: e.clientY,
            panStartX: self._panX, panStartY: self._panY
          };
          el.style.cursor = 'grabbing';
          return;
        }
      }

      // Pure navigation, never a write — allowed even while locked (see
      // setLocked) or in stylus-only mode (see _isInputAllowed below),
      // unlike every other branch after it.
      if (self._tool === 'pan') {
        self._activePtrs[e.pointerId] = {
          panning: true, startX: e.clientX, startY: e.clientY,
          panStartX: self._panX, panStartY: self._panY
        };
        el.style.cursor = 'grabbing';
        return;
      }
      // Same rule as drawing: pen (the stylus) is always allowed, mouse/
      // touch only in "any" input mode — selecting/moving/erasing an
      // object shouldn't be reachable through an input the student isn't
      // allowed to write with either (same reasoning js/drawing-canvas.js's
      // own figure-move-mode gate uses).
      if (!self._isInputAllowed(e.pointerType)) {
        self._showInputHint();
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

      // Click-to-place, no drag gesture at all — same immediacy as a shape
      // from the toolbar picker, just anchored at the click instead of a
      // fixed default spot. Nothing is tracked in _activePtrs for this
      // pointer: there's no drag to follow, _startTextEditor takes over
      // via its own <textarea> and DOM events from here.
      if (self._tool === 'text') {
        self._startTextEditor(pos, null);
        return;
      }

      if (self._tool === 'select') {
        // Checked BEFORE the normal object hit-test below — the handle
        // sits right at a shape's own corner, inside what would otherwise
        // also register as "clicked the shape itself" (see _findMyObjectAt),
        // and grabbing it needs to win that overlap so resize and move
        // stay two distinct, reliable gestures instead of a coin flip.
        var handle = self._resizeHandlePos();
        if (handle && dist(pos, handle) <= 12 / self._scale) {
          var hNatural = self._objectNaturalPos.get(handle.id);
          var hOff = self._myObjectOffsets.get(handle.id) || { dx: 0, dy: 0 };
          var hCenter = { x: hNatural.left + hOff.dx, y: hNatural.top + hOff.dy };
          self._activePtrs[e.pointerId] = {
            resizing: true, objId: handle.id, center: hCenter,
            startScale: self._myObjectScales.get(handle.id) || 1,
            startDist: Math.max(1, dist(hCenter, pos)),
            lastSentAt: 0, lastSentPos: null
          };
          el.style.cursor = 'nwse-resize';
          return;
        }
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
      var isPen         = self._tool === 'pen';
      var effWidth   = isHighlighter ? self._width * HIGHLIGHTER_WIDTH_MULT : self._width;
      var effOpacity = isHighlighter ? HIGHLIGHTER_OPACITY : 1;
      // The pen's first point has no prior point to compute speed from, so
      // it just starts at the plain picked width — .t is still stamped so
      // the SECOND point (first pointermove) has something to measure
      // speed against. See _widthFromVelocity.
      var startT = (global.performance || Date).now();
      var startPt = isPen ? { x: pos.x, y: pos.y, t: startT, w: effWidth } : pos;
      var strokeId = genId();
      self._activePtrs[e.pointerId] = {
        strokeId: strokeId, points: [startPt], pending: [startPt], lastSentAt: 0, lastSentPos: null,
        width: effWidth, opacity: effOpacity, isPen: isPen, lastT: startT, lastRaw: null
      };
      self._liveStrokes.set('m:' + strokeId, { points: [startPt], color: self._color, width: effWidth, opacity: effOpacity });
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
            self._setZoom(self._pinchStartZoom * (d / self._pinchStartDist), mid.x, mid.y, true);
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
        self._scheduleSyncViewport();
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
        // a plain click that wiggles a pixel must not take the objects off the committed layer
        if (!st.dragLayerOn) {
          if (dist(pos, st.dragStart) * self._scale < 3) return;
          st.dragLayerOn = true;
          self._beginDragLayer(st.objIds);
        }
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
      if (st.resizing) {
        // Scale factor = how much farther (or closer) the pointer is from
        // the shape's own center now vs. at the start of the drag — clamped
        // so a wild swipe can't invert the shape (crossing through 0) or
        // blow it up past readability.
        if (!st.dragLayerOn) { st.dragLayerOn = true; self._beginDragLayer([st.objId]); }
        var newDist = Math.max(1, dist(st.center, pos));
        var newScale = Math.max(0.15, Math.min(6, st.startScale * (newDist / st.startDist)));
        self._setObjectScale(st.objId, newScale);
        self._dirty = true;
        var rnow = (global.performance || Date).now();
        var rmoved = !st.lastSentPos || dist(st.lastSentPos, pos) >= BROADCAST_PX;
        if (rmoved || rnow - st.lastSentAt >= BROADCAST_MS) {
          var rOff = self._myObjectOffsets.get(st.objId) || { dx: 0, dy: 0 };
          self._send('object:move', { moves: [{ id: st.objId, offsetX: rOff.dx, offsetY: rOff.dy, scale: newScale }] });
          st.lastSentAt = rnow;
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
        // every sample the browser had (a 120+ Hz mouse or a stylus reports several per event) feeds the stroke, so a fast
        // flick is not drawn as a few long chords; samples closer than ~1 screen px to the last kept one are dropped
        var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
        if (!evs.length) evs = [e];
        var nowT = (global.performance || Date).now();
        for (var ci = 0; ci < evs.length; ci++) {
          var cpos = evs[ci] === e ? pos : self._getPos(evs[ci]);
          self._addFreehandPoint(st, cpos, st.lastT + (nowT - st.lastT) * (ci + 1) / evs.length);
        }
        st.lastT = nowT;
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
      // Re-derive the cursor for whatever tool is ACTUALLY active rather
      // than hardcoding 'grab' — a right-click-drag pans regardless of the
      // active tool (see pointerdown), so releasing it while e.g. the pen
      // is still selected must restore the pen's own crosshair, not leave
      // the grab cursor stuck. Harmless no-op when 'pan' really is the
      // active tool (self._setTool('pan') sets 'grab' right back anyway).
      if (st.panning) { self._setTool(self._tool); return; }
      if (st.erasing) { self._erasedThisDrag = null; return; }
      if (st.rubberBand) {
        var rect = normalizedRect(self._activeRubberBand.start, self._activeRubberBand.current);
        self._activeRubberBand = null;
        var ids = [];
        self._fabricCanvas.getObjects().forEach(function (obj) {
          if (!obj.data || obj.data.ownerId !== self._userId) return;
          var pts = self._myTranslatedPoints(obj.data.id);
          if (!pts) return;
          // Bounding-box check first — cheap, and lets most objects skip
          // the exact per-segment test below. The exact test is what
          // actually matters: a curvy or diagonal stroke's bounding box
          // can be much bigger than its real ink, and selecting based on
          // that box alone would pick up strokes the rubber-band never
          // actually touched.
          var b = self._myObjectBounds(obj.data.id);
          if (b && rectsIntersect(rect, b) && polylineIntersectsRect(pts, rect)) ids.push(obj.data.id);
        });
        self._selectedIds = new Set(ids);
        self._dirty = true;
        return;
      }
      if (st.moving) {
        el.style.cursor = 'default';
        if (st.dragLayerOn) self._endDragLayer();
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
      if (st.resizing) {
        el.style.cursor = 'default';
        if (st.dragLayerOn) self._endDragLayer();
        var finalScale = self._myObjectScales.get(st.objId) || 1;
        var fOff = self._myObjectOffsets.get(st.objId) || { dx: 0, dy: 0 };
        self._send('object:move', { moves: [{ id: st.objId, offsetX: fOff.dx, offsetY: fOff.dy, scale: finalScale }] });
        self._persistObjectScale(st.objId, finalScale);
        return;
      }
      if (!st.shape && st.lastRaw) self._addFreehandPoint(st, st.lastRaw.pos, st.lastRaw.t, true); // the stroke ends exactly where the pointer did
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
      // Re-derive the cursor for whatever tool is ACTUALLY active rather
      // than hardcoding 'grab' — a right-click-drag pans regardless of the
      // active tool (see pointerdown), so releasing it while e.g. the pen
      // is still selected must restore the pen's own crosshair, not leave
      // the grab cursor stuck. Harmless no-op when 'pan' really is the
      // active tool (self._setTool('pan') sets 'grab' right back anyway).
      if (st.panning) { self._setTool(self._tool); return; }
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
        if (st.dragLayerOn) self._endDragLayer();
        self._send('object:move', { moves: revertMoves });
        return;
      }
      if (st.resizing) {
        el.style.cursor = 'default';
        self._setObjectScale(st.objId, st.startScale);
        self._dirty = true;
        if (st.dragLayerOn) self._endDragLayer();
        var cOff = self._myObjectOffsets.get(st.objId) || { dx: 0, dy: 0 };
        self._send('object:move', { moves: [{ id: st.objId, offsetX: cOff.dx, offsetY: cOff.dy, scale: st.startScale }] });
        return;
      }
      self._liveStrokes.delete('m:' + st.strokeId);
      self._dirty = true;
      self._send('stroke:cancel', { strokeId: st.strokeId });
    });

    // Re-open a text object's editor on its actual content, not just move/
    // resize it — select tool only (a double-click with any other tool
    // already means something else, e.g. two quick pen dots). The single-
    // click pointerdown/up pair just above will already have selected the
    // object by the time this fires.
    el.addEventListener('dblclick', function (e) {
      if (self._tool !== 'select' || self._locked) return;
      var target = self._findMyObjectAt(self._getPos(e));
      if (target && target.data.isText) {
        e.preventDefault();
        self._startTextEditor(null, target);
      } else if (target && target.data.isMath) {
        e.preventDefault();
        self._openMath(target);
      }
    });
    // a double tap with a finger or a stylus (touch screens do not always send dblclick): opens the equation editor on a formula
    var lastTap = { t: 0, x: 0, y: 0 };
    el.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      if (self._tool !== 'select' || self._locked) return;
      var now = Date.now(), pos = self._getPos(e);
      if (now - lastTap.t < 380 && dist(pos, lastTap) * self._scale < 26) {
        lastTap.t = 0;
        var tg = self._findMyObjectAt(pos);
        if (tg && tg.data.isMath) self._openMath(tg);
      } else lastTap = { t: now, x: pos.x, y: pos.y };
    });
  };

  // One freehand sample: kept only if it moved at least INK_MIN_STEP_PX screen pixels (always kept when force is set), with the
  // pen's speed-based width computed against the last KEPT point. The newest raw sample is remembered so the stroke can end on it.
  var INK_MIN_STEP_PX = 1.2;
  Whiteboard.prototype._addFreehandPoint = function (st, cpos, t, force) {
    var prev = st.points[st.points.length - 1];
    st.lastRaw = { pos: cpos, t: t };
    var d = dist(prev, cpos);
    if (force ? d < 0.001 : d < INK_MIN_STEP_PX / this._scale) return;
    var pt = cpos;
    if (st.isPen) {
      pt = { x: cpos.x, y: cpos.y, t: t };
      pt.w = _widthFromVelocity(st.width, prev, pt, this._scale);
    }
    st.points.push(pt);
    st.pending.push(pt);
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
    // A freehand tap-without-moving (dotting an "i", a multiplication ×)
    // used to get thrown out here (points.length < 2) — the live overlay
    // already draws a single stationary point as a dot (see
    // drawSmoothStroke's own 1-point branch), so discarding it on commit
    // just made it visibly vanish the instant the mouse lifted. A
    // degenerate SHAPE (start===end drag) is still dropped — collapsing a
    // line/arrow/rect to a dot isn't a meaningful shape the way a bare dot
    // of ink is.
    var isDegenerate = shape ? dist(start, end) < 2 : !points.length;
    if (isDegenerate) {
      if (liveKey) { this._liveStrokes.delete(liveKey); this._dirty = true; }
      return;
    }
    // Variable-width pen strokes are recognized the same way the live
    // overlay does (points[0].w present) — see _redrawOverlay's own
    // comment. Committed as a FILLED outline (variableWidthPathString)
    // instead of a fixed-width stroked path, with the exact original
    // points saved as "centerline" so _addObjectIfNew's eraser/select
    // hit-testing has the real geometry to work with after a reload
    // instead of parsePathPoints' lossy reconstruction (which only
    // understands a plain M/Q/L stroke, not this fill's many M/L/Z
    // subpaths) — see that fallback chain's own comment.
    var isVariableWidth = !shape && points.length && points[0].w != null;
    // freehand rows are stored compact: 2 decimals, no timestamps (a 90-point pen stroke used to weigh ~39 KB in the database)
    if (isVariableWidth) points = points.map(function (q) { return { x: _r2(q.x), y: _r2(q.y), w: _r2(q.w) }; });
    var path = shape ? straightPathString(start, end, shape)
      : isVariableWidth ? inkOutline(points) : smoothPathString(smoothInkPoints(points, 2));
    var dashArray = shape === 'dashed-line' ? [width * 3, width * 2.4] : null;
    var self = this;
    var gen  = this._clearGen; // see the field comment in the constructor
    // clientStrokeId (both branches) round-trips back through
    // postgres_changes so a REMOTE viewer can do the exact same "swap,
    // don't just delete" trick for their copy of this stroke's live
    // preview — see _connectRealtime's INSERT handler. strokeWidth stays
    // set even on the fill branch (nothing actually strokes with it) so
    // the eraser/select tolerance, which reads obj.strokeWidth, still
    // scales with the pen's picked width instead of falling back to its
    // "no strokeWidth" default.
    // centerline is one subpath ([points]) here — a plain stroke/line is a
    // single continuous polyline, unlike a shape/body's several genuinely
    // separate pieces (see _insertShape's own centerline, and
    // distToPolyline's comment on why every consumer expects this nested
    // "array of subpaths" shape uniformly rather than some flat, some not.
    var json = isVariableWidth
      ? { path: path, fill: this._color, strokeWidth: width, opacity: opacity, centerline: [points], v: 2, clientStrokeId: liveKey ? liveKey.slice(2) : null }
      : { path: path, stroke: this._color, strokeWidth: width, strokeDashArray: dashArray, opacity: opacity, clientStrokeId: liveKey ? liveKey.slice(2) : null };
    this._supabase.from('whiteboard_objects').insert(this._rowBase('stroke', json)).select().single().then(function (res) {
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
      var newObj = self._addObjectIfNew(res.data, [points]);
      // A new stroke invalidates whatever was on the redo stack — standard
      // undo/redo semantics (matches drawing-canvas.js's own _undo/_redo).
      // On the board the stroke belongs to, which may no longer be the one on screen.
      self._inBoard(self._boardForRow(res.data), function () {
        self._myStrokeHistory.push({ id: res.data.id, kind: res.data.kind, fabric_json: res.data.fabric_json });
        self._myRedoStack = [];
        self._updateUndoRedoButtons();
      });
      self._dirty = true;
      self._paintNewObject(newObj);
    });
  };

  // Toolbar shape picker (SHAPE_DEFS) — unlike a drawn stroke, there's no
  // drag gesture at all: click a shape and it lands, already fully sized,
  // centered on whatever's currently visible (the same anchor _setZoom
  // uses when it isn't given a clientX/clientY), exactly like the
  // geometry configurator's own _insertShape drops its preset shapes at a
  // fixed default spot rather than making you drag one out. From here on
  // it's just a normal committed stroke — move it with the "select" tool,
  // erase it, undo it — no separate code path for "is this a shape".
  Whiteboard.prototype._insertShape = function (shapeId) {
    var def = SHAPE_DEFS[shapeId];
    if (!def) return;
    var cx = (this._viewportW / 2 - this._panX) / this._scale;
    var cy = (this._viewportH / 2 - this._panY) / this._scale;
    var built = def.build(cx, cy);
    // A 2D shape's build() is still a plain array of subpaths (no edge of a
    // flat figure is ever hidden); a 3D body's is {subpaths, hidden} — see
    // SHAPE_DEFS's own comment.
    var visible = Array.isArray(built) ? built : built.subpaths;
    var hidden  = Array.isArray(built) ? [] : built.hidden;
    var width = this._width;
    var path = visible.map(function (pts) {
      return pts.map(function (p, i) { return (i === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y; }).join(' ');
    }).join(' ');
    var visPath = path;   // the solid edges only, before the dashes of the hidden ones are added
    if (hidden.length) {
      // Same visual dash rhythm as the dashed-line tool (width*3 on, *2.4
      // off) for one consistent "this means dashed" language everywhere on
      // the board — see dashedPolylineSegments for why this is baked into
      // the path geometry instead of a strokeDashArray.
      var dashLen = width * 3, gapLen = width * 2.4;
      path += ' ' + hidden.map(function (pts) {
        return dashedPolylineSegments(pts, dashLen, gapLen).map(function (seg) {
          return 'M ' + seg[0].x + ' ' + seg[0].y + ' L ' + seg[1].x + ' ' + seg[1].y;
        }).join(' ');
      }).join(' ');
    }
    // centerline keeps the ORIGINAL (non-dashed-broken-up) subpaths for hit-
    // testing (see _addObjectIfNew) — a hidden edge is still part of the
    // shape you can click/erase/select, only its on-screen rendering is
    // dashed, so hit-testing has no reason to see it any differently than a
    // visible one.
    var centerline = visible.concat(hidden);
    var self = this;
    var shapeJson = { path: path, stroke: this._color, strokeWidth: width, strokeDashArray: null, opacity: 1, centerline: centerline, isShape: true };
    if (hidden.length) {
      // the hidden edges stay stored as plain polylines (plus the visible part of the path and the dash rhythm), so a resize can
      // lay the dashes out again at the same on-screen length instead of stretching them (see _rebuildDashes)
      var r2 = function (n) { return Math.round(n * 100) / 100; };
      shapeJson.vpath = visPath;
      shapeJson.hidden = hidden.map(function (pts) { return pts.map(function (p) { return { x: r2(p.x), y: r2(p.y) }; }); });
      shapeJson.dashOn = width * 3;
      shapeJson.dashOff = width * 2.4;
    }
    // isShape marks this for the resize handle in _drawSelectionOverlay/_bindPointerEvents — freehand ink and lines never get one.
    this._supabase.from('whiteboard_objects').insert(this._rowBase('stroke', shapeJson)).select().single().then(function (res) {
      if (self._destroyed) return;
      if (res.error) { console.error('[Whiteboard] shape insert failed', res.error); return; }
      var shapeObj = self._addObjectIfNew(res.data, centerline);
      self._inBoard(self._boardForRow(res.data), function () {
        self._myStrokeHistory.push({ id: res.data.id, kind: res.data.kind, fabric_json: res.data.fabric_json });
        self._myRedoStack = [];
        self._updateUndoRedoButtons();
      });
      self._dirty = true;
      if (shapeObj) self._paintNewObject(shapeObj);
    });
  };

  // Equation editor (js/wb-math.js): a keyboard of mathematical structures and a live formula that can be dragged into place; the
  // finished formula is ONE vector object (a filled path, like pen ink) stored as a normal 'stroke' row, so every other client, the replay,
  // undo, move, resize and erase need nothing new. isMath keeps the LaTeX so the owner can open it again (double click / double tap).
  Whiteboard.prototype._openMath = function (existingObj) {
    if (this._readOnly || this._locked || !global.WBMath || this._destroyed) return;
    if (this._textEditing) this._finishTextEditor(false);
    if (this._math) { if (!existingObj) return; this._math.close(false); }
    var opts = { color: this._color };
    if (existingObj) {
      var id = existingObj.data.id, j = this._myObjectsJson.get(id) || {}, b = this._myObjectBounds(id);
      if (!j.latex || !b) return;
      opts.latex = j.latex; opts.replaceId = id; opts.color = j.fill || this._color;
      opts.fs = (j.fs || this._defaultTextSize()) * (this._myObjectScales.get(id) || 1);
      opts.center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
      existingObj.visible = false;
      this._mathHidden = existingObj;
      this._selectedIds = new Set();
      this._dirty = true;
      this._fabricCanvas.requestRenderAll();
    }
    this._mathPrevTool = this._tool;
    this._setTool('pan');    // while the editor is open the board only moves and zooms: a tap must not draw under the keyboard
    var btn = this._toolbarEl && this._toolbarEl.querySelector('#wbMathBtn');
    if (btn) btn.classList.add('is-open');
    global.WBMath.open(this, opts).catch(function () {});
  };
  Whiteboard.prototype._mathClosed = function (committed) {
    var btn = this._toolbarEl && this._toolbarEl.querySelector('#wbMathBtn');
    if (btn) btn.classList.remove('is-open');
    if (this._mathHidden) { this._mathHidden.visible = true; this._mathHidden = null; if (this._fabricCanvas) this._fabricCanvas.requestRenderAll(); }
    if (this._destroyed) return;
    if (!committed) this._setTool(this._mathPrevTool && this._mathPrevTool !== 'pan' ? this._mathPrevTool : 'select');
  };
  Whiteboard.prototype._mathCommit = function (o) {
    var self = this;
    if (this._destroyed || this._readOnly || this._locked || !global.WBMath) return;
    var probe = global.WBMath.toPath(o.latex, o.fs, 0, 0);
    if (!probe || !probe.d) return;
    var p = global.WBMath.toPath(o.latex, o.fs, o.cx - probe.w / 2, o.cy - probe.h / 2);
    if (!p || !p.d) return;
    var rr = function (n) { return Math.round(n * 100) / 100; };
    var centerline = rectCenterline(rr(o.cx), rr(o.cy), rr(probe.w), rr(probe.h));
    var json = { path: p.d, fill: o.color || this._color, strokeWidth: 0, opacity: 1, centerline: centerline, isShape: true, isMath: true, latex: p.latex, fs: rr(o.fs) };
    if (o.replaceId) this._deleteObjects([o.replaceId]);
    this._supabase.from('whiteboard_objects').insert(this._rowBase('stroke', json)).select().single().then(function (res) {
      if (self._destroyed) return;
      if (res.error) { console.error('[Whiteboard] equation insert failed', res.error); if (global.BM && BM.toast) BM.toast('Formula nu s-a putut salva. Încearcă din nou.', 'error'); return; }
      var obj = self._addObjectIfNew(res.data, centerline);
      self._inBoard(self._boardForRow(res.data), function () {
        self._myStrokeHistory.push({ id: res.data.id, kind: res.data.kind, fabric_json: res.data.fabric_json });
        self._myRedoStack = [];
        self._updateUndoRedoButtons();
      });
      self._dirty = true;
      if (obj) self._paintNewObject(obj);
      // the new formula is selected, so it can be moved or resized right away
      self._selectedIds = new Set([res.data.id]);
      self._setTool('select');
      self._dirty = true;
    });
  };

  // The box's own width, both live while editing and at commit time —
  // auto-sized to the widest actual line (so 3 letters get a 3-letter-wide
  // hitbox, not always the full wrap width) up to TEXT_MAX_WIDTH, past
  // which it wraps like any other <textarea>/fabric.Textbox. TEXT_WIDTH_PAD
  // is just breathing room for the caret at the end of the widest line
  // (measureText alone would put it flush against the edge).
  var TEXT_WIDTH_PAD = 10;
  var TEXT_LINE_HEIGHT = 1.3;       // the editor's CSS line-height (.wb-text-editor), and about what Fabric's own line height comes to
  var TEXT_SCREEN_TARGET_PX = 56;   // a new text is about this tall on the screen at any zoom, within [TEXT_MIN_FONT, TEXT_DEFAULT_FONT_SIZE] logical
  var TEXT_MIN_FONT = 10;
  Whiteboard.prototype._defaultTextSize = function () {
    return Math.round(Math.max(1, Math.min(TEXT_DEFAULT_FONT_SIZE, TEXT_SCREEN_TARGET_PX / this._scale)));
  };
  Whiteboard.prototype._clampTextWidth = function (text, fontSizeLogical) {
    return Math.min(Math.max(measureTextWidth(text, fontSizeLogical) + TEXT_WIDTH_PAD, TEXT_MIN_WIDTH), TEXT_MAX_WIDTH);
  };

  // Re-lays-out the live editing <textarea> from this._textEditing's fixed
  // LOGICAL anchor/font-size/scale plus whatever's actually typed —
  // called once from _startTextEditor, again on every keystroke (an
  // 'input' listener there), and again from _syncViewport on every pan/
  // zoom change. That last one is what keeps the box visually anchored to
  // its actual spot on the BOARD through a zoom/pan instead of sitting
  // frozen at whatever screen pixel it first appeared at — a plain
  // position:fixed element has no idea the board underneath just moved.
  Whiteboard.prototype._repositionTextEditor = function () {
    var editing = this._textEditing;
    if (!editing) return;
    var ta = editing.ta;
    var w = this._clampTextWidth(ta.value, editing.fontSize);
    var wrapRect = this._canvasWrap.getBoundingClientRect();
    // minus what the editor's own padding and the committed text's drawing offset add, so the typed glyphs sit where the final text will
    ta.style.left = (wrapRect.left + this._panX + editing.topLeft.x * this._scale - 5) + 'px';
    ta.style.top  = (wrapRect.top  + this._panY + editing.topLeft.y * this._scale - 2) + 'px';
    ta.style.width = (w * editing.scale * this._scale) + 'px';
    ta.style.fontSize = (editing.fontSize * editing.scale * this._scale) + 'px';
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  };

  // Text tool (see the 'text' branch in _bindPointerEvents' pointerdown,
  // and the dblclick listener at the end of that same function for
  // re-editing an existing one) — opens a real HTML <textarea> positioned
  // exactly over the logical spot, so typing/IME/spellcheck/copy-paste all
  // just work the way they do everywhere else on the page; a canvas has no
  // native text input of its own. pos is the click point for a NEW text
  // (existingObj null); for re-editing, existingObj's own current
  // position/size/content are used instead and pos is ignored (pass null).
  Whiteboard.prototype._startTextEditor = function (pos, existingObj) {
    if (this._textEditing) this._finishTextEditor(false); // finish whatever was already open first
    var self = this;
    var fontSize = this._defaultTextSize(), color = this._color, scale = 1;
    var initialText = '', topLeft;
    if (existingObj) {
      var j = this._myObjectsJson.get(existingObj.data.id) || {};
      fontSize = j.fontSize || fontSize;
      color = j.color || color;
      scale = this._myObjectScales.get(existingObj.data.id) || 1;
      initialText = j.text || '';
      var natural = this._objectNaturalPos.get(existingObj.data.id);
      var off = this._myObjectOffsets.get(existingObj.data.id) || { dx: 0, dy: 0 };
      var center = { x: natural.left + off.dx, y: natural.top + off.dy };
      var oldWidth = j.textWidth || TEXT_MIN_WIDTH, oldHeight = j.textHeight || fontSize * 1.3;
      // Top-left, not center — this is the anchor editing visually holds
      // fixed while the box's width/height changes with the content (see
      // _persistTextEdit, which re-derives the same anchor the same way).
      topLeft = { x: center.x - (oldWidth * scale) / 2, y: center.y - (oldHeight * scale) / 2 };
      existingObj.visible = false;
      // Drop the selection halo/resize handle too, not just the rendered
      // text — both are computed from the OLD bounds (see
      // _myObjectBounds/_resizeHandlePos) that won't update until this
      // commits, so leaving them showing would visibly mismatch the live
      // textarea the instant its size changes from the original.
      this._selectedIds = new Set();
      this._dirty = true;
      this._fabricCanvas.requestRenderAll();
    } else {
      // the first line sits centered on the click, and its left edge on it: the text starts exactly under the pointer
      topLeft = { x: pos.x, y: pos.y - fontSize * TEXT_LINE_HEIGHT / 2 };
    }

    var ta = document.createElement('textarea');
    ta.className = 'wb-text-editor';
    ta.value = initialText;
    ta.spellcheck = false;
    ta.style.color = color;
    // A <textarea> with no rows attribute defaults to an intrinsic height
    // of 2 ROWS (a real HTML quirk, not a sizing bug of ours) — height:auto
    // then resolves against THAT baseline, not against actual content, so
    // an empty/short box measured its own scrollHeight as two lines tall
    // no matter what _repositionTextEditor did afterward. rows=1 fixes the
    // baseline itself; scrollHeight still grows normally past that once
    // there's more than one real line to show.
    ta.rows = 1;
    this._canvasWrap.appendChild(ta);

    this._textEditing = {
      ta: ta, existingObj: existingObj || null, initialText: initialText,
      topLeft: topLeft, fontSize: fontSize, scale: scale,
      onDocPointerDown: null // filled in just below, needs `editing` to already exist for the closure
    };
    this._repositionTextEditor();
    ta.addEventListener('input', function () { self._repositionTextEditor(); });
    ta.addEventListener('blur', function () { self._finishTextEditor(false); });
    ta.addEventListener('keydown', function (e) {
      // Enter is left alone — a real newline, same as any other <textarea>
      // on the page. Blur (above) or Escape are the only two ways out.
      if (e.key === 'Escape') { e.stopPropagation(); self._finishTextEditor(true); }
    });
    // A click anywhere else that reaches the canvas is ALSO caught by
    // pointerdown's own guard at the top of _bindPointerEvents, but a
    // click on some other part of the page entirely (a toolbar button,
    // for instance) never reaches that handler at all — only blur (above)
    // catches that case. This capture-phase listener is the one thing that
    // reliably catches BOTH: it runs before the click's own target sees
    // it, so it beats any focus-order quirk between browsers. Finishing
    // twice (this + blur, for the same click) is harmless — see the guard
    // at the top of _finishTextEditor.
    function onDocPointerDown(e) {
      if (e.target !== ta) self._finishTextEditor(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown, true);
    this._textEditing.onDocPointerDown = onDocPointerDown;

    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
  };

  // Closes whatever _startTextEditor opened — cancelled (Escape) discards
  // any change and restores an existing object untouched; otherwise an
  // empty/whitespace-only result deletes an existing object (never worth
  // keeping an empty box) or simply creates nothing (a new one that was
  // never worth starting), and real content commits via _insertText/
  // _persistTextEdit. Guarded to be a safe no-op if called twice for the
  // same editor (blur AND the document-level catch-all in _startTextEditor
  // can both fire for one click-away) or after destroy() mid-flight. Always
  // ends (committed, cancelled, or emptied-and-deleted alike) by switching
  // to the select tool — otherwise, with the tool still on "text", the very
  // click that dismisses this editor would immediately open ANOTHER one
  // wherever that click landed, which is what made confirming a text entry
  // feel like it did nothing (no visible "done", just a new empty box).
  Whiteboard.prototype._finishTextEditor = function (cancelled) {
    var editing = this._textEditing;
    if (!editing) return;
    this._textEditing = null;
    document.removeEventListener('pointerdown', editing.onDocPointerDown, true);
    // Read BEFORE removing from the DOM — scrollHeight is only meaningful
    // while still laid out. Divided back down through both the current
    // zoom AND this object's own resize scale to land in the same natural/
    // unscaled logical units everything else (_myPathPoints, textHeight in
    // fabric_json) is stored in.
    var heightLogical = editing.ta.scrollHeight / this._scale / editing.scale;
    var text = editing.ta.value.trim();
    if (editing.ta.parentNode) editing.ta.parentNode.removeChild(editing.ta);
    if (editing.existingObj) editing.existingObj.visible = true;
    if (this._destroyed) return;

    if (editing.existingObj) {
      var id = editing.existingObj.data.id;
      if (cancelled) {
        this._fabricCanvas.requestRenderAll();
      } else if (!text) {
        this._deleteObjects([id]);
      } else if (text !== editing.initialText) {
        this._persistTextEdit(id, text, this._clampTextWidth(text, editing.fontSize), heightLogical);
      } else {
        this._fabricCanvas.requestRenderAll();
      }
    } else if (!cancelled && text) {
      this._insertText(text, editing.topLeft, this._clampTextWidth(text, editing.fontSize), heightLogical, editing.fontSize);
    } else {
      this._fabricCanvas.requestRenderAll();
    }
    this._setTool('select');
  };

  // Commits a brand-new text object — same insert-then-render-locally
  // pattern as _commitStroke/_insertShape. centerline is the box's own 4
  // corners as ONE closed subpath, in the exact "array of subpaths" shape
  // every other object's hit-testing already expects uniformly (see
  // distToPolyline's own comment) — a text box just happens to have
  // exactly one, rectangular, subpath, so it needs no changes of its own
  // to _myObjectBounds/_myTranslatedPoints/the resize handle to work
  // correctly; only _findMyObjectAt/_eraseAt special-case isText, to let a
  // click ANYWHERE inside the box select it rather than only right at its
  // (invisible) outline the way an unfilled shape's does.
  Whiteboard.prototype._insertText = function (text, topLeft, width, height, fontSize) {
    var center = { x: topLeft.x + width / 2, y: topLeft.y + height / 2 };
    var hw = width / 2, hh = height / 2;
    var centerline = [[
      { x: center.x - hw, y: center.y - hh }, { x: center.x + hw, y: center.y - hh },
      { x: center.x + hw, y: center.y + hh }, { x: center.x - hw, y: center.y + hh },
      { x: center.x - hw, y: center.y - hh }
    ]];
    var self = this;
    this._supabase.from('whiteboard_objects').insert(this._rowBase('text', {
        isText: true, text: text, left: center.x, top: center.y,
        textWidth: width, textHeight: height, fontSize: fontSize, color: this._color,
        // A Textbox has no SVG path string the way every other object does
        // (see _addObjectIfNew) — without its own centerline saved here,
        // MY OWN text reloaded later (a refresh, a dropped-INSERT replay
        // via _reconcileObjects) would fall all the way through to
        // parsePathPoints(j.path) with no j.path to parse. Same rectangle
        // as the local centerline just above.
        centerline: centerline
    })).select().single().then(function (res) {
      if (self._destroyed) return;
      if (res.error) { console.error('[Whiteboard] text insert failed', res.error); return; }
      var textObj = self._addObjectIfNew(res.data, centerline);
      self._inBoard(self._boardForRow(res.data), function () {
        self._myStrokeHistory.push({ id: res.data.id, kind: res.data.kind, fabric_json: res.data.fabric_json });
        self._myRedoStack = [];
        self._updateUndoRedoButtons();
      });
      self._dirty = true;
      if (textObj) self._paintNewObject(textObj);
    });
  };

  // Commits an EDIT to an existing text object's content (see the dblclick
  // listener in _bindPointerEvents) — font size never changes here (only
  // the resize handle changes that, via the ordinary _persistObjectScale
  // path every other object already uses), but width AND height both can:
  // shortening a long line, or changing the line count, should shrink or
  // grow the hitbox to match the new content, same auto-sizing _insertText
  // gives a brand-new box. Folds whatever offset the box already had (from
  // an earlier plain move) into the new natural position and resets the
  // offset to zero, the same way a freshly committed object always starts
  // at offset zero — there's no reason to keep carrying an old offset
  // forward once the natural position itself has just been redefined.
  Whiteboard.prototype._persistTextEdit = function (objId, text, width, height) {
    var self = this;
    var json = this._myObjectsJson.get(objId);
    var obj = this._objectsById.get(objId);
    if (!json || !obj) return;
    var scale = this._myObjectScales.get(objId) || 1;
    var off = this._myObjectOffsets.get(objId) || { dx: 0, dy: 0 };
    var natural = this._objectNaturalPos.get(objId);
    var oldCenter = { x: natural.left + off.dx, y: natural.top + off.dy };
    // Same anchor _startTextEditor computed to position the live editor —
    // re-derived here from the OLD width/height since those are what was
    // still true the instant editing began.
    var topLeft = { x: oldCenter.x - (json.textWidth * scale) / 2, y: oldCenter.y - (json.textHeight * scale) / 2 };
    var center  = { x: topLeft.x + (width * scale) / 2, y: topLeft.y + (height * scale) / 2 };

    // width must be re-applied to the live Fabric object too — it's the
    // Textbox's own wrap boundary (see _addObjectIfNew), not just bookkeeping.
    var oldBox = objBox(obj);
    obj.set({ text: text, width: width, left: center.x, top: center.y });
    obj.setCoords();
    obj.data.bb = null;
    this._objectNaturalPos.set(objId, { left: center.x, top: center.y });
    this._myObjectOffsets.set(objId, { dx: 0, dy: 0 });
    // Unscaled half-extents — _myTranslatedPoints re-applies `scale` itself
    // when it reads this back (see its own comment), same convention as
    // every other object's stored centerline/_myPathPoints.
    var hw = width / 2, hh = height / 2;
    var centerline = [[
      { x: center.x - hw, y: center.y - hh }, { x: center.x + hw, y: center.y - hh },
      { x: center.x + hw, y: center.y + hh }, { x: center.x - hw, y: center.y + hh },
      { x: center.x - hw, y: center.y - hh }
    ]];
    this._myPathPoints.set(objId, centerline);
    this._dirty = true;
    this._invalidateBoxes([oldBox, objBox(obj)]);

    var newJson = Object.assign({}, json, { text: text, left: center.x, top: center.y, textWidth: width, textHeight: height, offsetX: 0, offsetY: 0, centerline: centerline });
    this._supabase.from('whiteboard_objects').update({ fabric_json: newJson }).eq('id', objId)
      .then(function (res) {
        if (res.error) { global.BM && BM.toast && BM.toast('Eroare: ' + res.error.message, 'error'); return; }
        self._myObjectsJson.set(objId, newJson);
      });
  };

  /* ---- Realtime ---- */

  Whiteboard.prototype._connectRealtime = function () {
    var self = this, common = this._boards.get(COMMON_KEY);
    // The shared channel: live strokes of the shared board (Broadcast) and the durable feed of EVERY board's rows (postgres_changes).
    // The feed is private by itself: row level security only lets a student receive the shared board and their own, and the teacher all.
    var ch = this._supabase.channel('whiteboard-' + this._sessionId, { config: { broadcast: { self: false } } });
    this._bindLiveEvents(ch, common);
    ch
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'whiteboard_objects', filter: 'session_id=eq.' + this._sessionId
      }, function (p) {
        var row = p.new, b = self._boardForRow(row);
        // someone wrote on a student's board: the teacher's tab for that student lights up, even when that board is not open
        if (row.board_owner && row.created_by !== self._userId && self._onBoardActivity) self._onBoardActivity(row.board_owner);
        if (!b) return;
        var cid = row.fabric_json && row.fabric_json.clientStrokeId;
        // Same swap-not-delete trick as the local drawer's own finish() —
        // retire the remote live-preview entry in the SAME tick the real
        // object gets added, so a remote viewer never sees the stroke blink
        // out during the commit round-trip either.
        var added = self._inBoard(b, function () {
          if (cid) { this._liveStrokes.delete('r:' + cid); if (b === this._board) this._dirty = true; }
          return this._addObjectIfNew(row);
        });
        if (added) self._paintNewObject(added);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'whiteboard_objects', filter: 'session_id=eq.' + this._sessionId
      }, function (p) { self._applyObjectUpdate(p.new); })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'whiteboard_objects', filter: 'session_id=eq.' + this._sessionId
      }, function (p) {
        var id = p.old && p.old.id, ob = id && self._idBoard.get(id);
        if (!ob) return;
        self._removeObjectById(id);   // repaints just the box it covered
      })
      .subscribe(function (status, err) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Whiteboard] realtime channel', status, err);
        }
        // Realtime's postgres_changes feed is push-only, no catch-up replay
        // for whatever happened while a socket was briefly down (a laptop
        // sleep/wake, a phone tab backgrounded, an ordinary network blip) —
        // any INSERT/DELETE that landed during that gap is just gone for
        // this client, forever, until something re-syncs from the DB. That's
        // the exact shape of the "one stray line stayed until I refreshed"
        // report: the eraser's DELETE reached the server fine, every OTHER
        // already-connected client got the live event fine, but this one
        // client's socket happened to be reconnecting at that exact moment.
        // SUBSCRIBED fires again after every such reconnect (not just the
        // very first connect), so reconciling here — including on that very
        // first call, briefly racing the first load's own fetch, which is
        // harmless since _addObjectIfNew already de-dupes by id — closes
        // that gap without the user ever needing to know it happened.
        if (status === 'SUBSCRIBED') self._reconcileAll();
      });
    common.channel = ch;
    if (this._board === common) this._channel = ch;
  };

  // The live (ephemeral) traffic of one board: the points of a stroke in progress and drags. Only the board that is on screen shows
  // them; a board in the background gets the finished result through the durable feed instead.
  Whiteboard.prototype._bindLiveEvents = function (ch, b) {
    var self = this;
    function onScreen() { return b === self._board && !self._destroyed; }
    ch.on('broadcast', { event: 'stroke:point' }, function (msg) { if (onScreen()) self._onRemotePoint(msg.payload); })
      .on('broadcast', { event: 'stroke:end' },   function (msg) { if (onScreen()) self._onRemoteStrokeEnd(msg.payload); })
      .on('broadcast', { event: 'stroke:cancel' }, function (msg) { if (onScreen()) { self._liveStrokes.delete('r:' + msg.payload.strokeId); self._dirty = true; } })
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
        if (!onScreen()) return;
        // m.scale is only ever present for a resize-handle drag (see
        // _bindPointerEvents' 'resizing' branch) — update it first so the
        // very same _setObjectOffset call below picks up the new scale
        // together with position, both taking effect as one transform.
        self._onRemoteMoves(msg.payload.moves || []);
      });
  };

  // The private channel of a student's board (only that student and the teacher may join, see wb_topic_allowed in the migration).
  // If it cannot be joined the board still works: the other side then sees finished strokes (durable feed) instead of live ones.
  Whiteboard.prototype._connectBoardChannel = function (b) {
    if (b.channel || b.isCommon || this._readOnly || this._destroyed || !this._multi) return;
    var self = this;
    var ch = this._supabase.channel('wbp:' + this._sessionId + ':' + b.ownerId, { config: { private: true, broadcast: { self: false } } });
    this._bindLiveEvents(ch, b);
    ch.subscribe(function (status, err) {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[Whiteboard] private channel', status, err);
      if (status === 'SUBSCRIBED' && b.loaded) self._reconcileBoard(b);
    });
    b.channel = ch;
    if (b === this._board) this._channel = ch;
  };

  // Safety net under the best-effort realtime push above: re-derives local
  // state from the DB's own current row set rather than trusting that every
  // INSERT/DELETE this client should have seen actually arrived. Cheap (ids
  // only) and non-destructive to anything genuinely still current — only
  // touches objects that have actually drifted out of sync.
  Whiteboard.prototype._reconcileAll = function () {
    var self = this;
    this._boards.forEach(function (b) { if (b.loaded) self._reconcileBoard(b); });
  };
  Whiteboard.prototype._reconcileBoard = function (b) {
    var self = this;
    this._boardFilter(this._supabase.from('whiteboard_objects').select('id').eq('session_id', this._sessionId), b)
      .then(function (res) {
        if (self._destroyed || res.error || b.evicted) return;
        var serverIds = {};
        (res.data || []).forEach(function (r) { serverIds[r.id] = true; });
        var missingIds = [];
        self._inBoard(b, function () {
          // A local object the server no longer has — its DELETE never made it to this client (see the SUBSCRIBED callback above).
          this._fabricCanvas._objects.slice().forEach(function (obj) {
            if (obj.data && obj.data.id && !serverIds[obj.data.id]) self._removeObjectById(obj.data.id);
          });
          // The reverse case — a row the server has that this client missed entirely (a dropped INSERT).
          missingIds = Object.keys(serverIds).filter(function (id) { return !self._committedIds.has(id); });
        });
        if (b === self._board) self._fabricCanvas.requestRenderAll();
        if (missingIds.length) {
          self._supabase.from('whiteboard_objects').select('*').in('id', missingIds)
            .order('seq', { ascending: true })
            .then(function (res2) {
              if (self._destroyed || res2.error || b.evicted) return;
              self._inBoard(b, function () { (res2.data || []).forEach(function (row) { self._addObjectIfNew(row); }); });
              if (b === self._board) self._fabricCanvas.requestRenderAll();
            });
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
    var self = this, b = this._boardForRow(row);
    if (!b) return;
    this._inBoard(b, function () {
      var j = row.fabric_json || {};
      if (this._imgPending.has(row.id)) this._imgPending.set(row.id, j);   // a picture still loading takes it when it is ready
      var dx = j.offsetX || 0, dy = j.offsetY || 0;
      this._myObjectScales.set(row.id, j.scale || 1);
      this._setObjectOffset(row.id, dx, dy);
      if (row.created_by === this._userId) {
        this._myObjectOffsets.set(row.id, { dx: dx, dy: dy });
        this._myObjectsJson.set(row.id, j);
      }
    });
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
    if (!row) return null;
    // The row belongs to one board: add it there even when another one is on screen now (an insert that resolved after a switch,
    // a remote insert for a board that is not shown). A board this client does not hold is ignored (see _boardForRow).
    var tb = this._boardForRow(row);
    if (!tb) return null;
    if (tb !== this._dataBoard) return this._inBoard(tb, function () { return this._addObjectIfNew(row, rawPoints); });
    if (this._committedIds.has(row.id)) return null;
    this._committedIds.add(row.id);
    this._idBoard.set(row.id, tb);
    var j = row.fabric_json || {};
    if (j.isImage) { this._addImageObject(row, tb); return null; }   // the picture joins the board when it has loaded
    // center, not fabric's default top-left, on BOTH branches below — a
    // shape/text's resize handle (see _drawSelectionOverlay/
    // _bindPointerEvents) scales it around its own middle, which needs
    // left/top (and the scaling itself) anchored there instead of a
    // corner to begin with. Harmless for freehand ink, which never
    // resizes, and keeps the same one code path for every object type.
    var obj;
    if (j.isText) {
      // A Textbox needs left/top passed in explicitly (unlike a Path,
      // whose left/top fall out implicitly from its own SVG path data
      // below) — see _insertText/_persistTextEdit, which always store the
      // NATURAL (pre-offset) center in j.left/j.top for exactly this.
      obj = new fabric.Textbox(j.text || '', {
        left: j.left, top: j.top, width: j.textWidth, fontSize: j.fontSize,
        fontFamily: TEXT_FONT_FAMILY, fill: j.color, editable: false,
        selectable: false, evented: false, objectCaching: false, // no cached bitmap: text stays sharp at any zoom
        originX: 'center', originY: 'center',
        data: { id: row.id, ownerId: row.created_by, isShape: false, isText: true, boardKey: tb.key }
      });
    } else {
      // Variable-width pen strokes (see _commitStroke) are a FILLED
      // outline, not a stroked centerline — j.fill is only ever set for
      // those, never alongside j.stroke.
      // Pen strokes saved before the smooth outline existed (no v:2) are rebuilt from their stored centerline, so an old board
      // gets the clean, light geometry too instead of the lumpy thousand-subpath ribbon they were committed with.
      var pathD = j.path;
      if (j.fill && !j.isShape && j.v !== 2 && j.centerline && j.centerline[0] && j.centerline[0].length && j.centerline[0][0].w != null) {
        pathD = inkOutline(j.centerline[0].filter(function (q, qi, arr) { return qi === 0 || qi === arr.length - 1 || dist(q, arr[qi - 1]) >= 0.4; })) || j.path;
      }
      obj = new fabric.Path(pathD, {
        stroke: j.fill ? null : j.stroke,
        strokeWidth: j.strokeWidth,
        strokeDashArray: j.strokeDashArray || null, // dashed-line tool only — see _commitStroke
        opacity: j.opacity == null ? 1 : j.opacity,
        fill: j.fill || null,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        strokeUniform: !!j.isShape,   // a resized figure keeps the line width it was drawn with (the dashes of a body are laid out again, see _rebuildDashes)
        selectable: false,
        evented: false,
        // objectCaching:true (Fabric's own default) was tried here for pan
        // performance on a board with many committed objects — reverted
        // after confirming (a side-by-side render of the exact same path,
        // cached vs not) that it visibly washes out/blurs a pen stroke's
        // FILLED variable-width outline (_strokeOutlinePieces/
        // variableWidthPathString): a thin filled ribbon rasterized into a
        // cache bitmap loses definition in a way a plain stroked line
        // doesn't, and it's most visible on exactly the highest-frequency
        // object type a lesson accumulates (freehand pen ink) — the crisp
        // live overlay preview swapping, ~one network round-trip after
        // pointerup, into a noticeably softer committed version. Off
        // entirely, every object always re-renders straight from its own
        // vector path data at the CURRENT transform, so it's exactly as
        // sharp right after committing as at any zoom level later — the
        // same fix this file used before objectCaching was ever turned
        // back on, see the git history on this line.
        objectCaching: false,
        originX: 'center',
        originY: 'center',
        data: { id: row.id, ownerId: row.created_by, isShape: !!j.isShape, isText: false, isMath: !!j.isMath, boardKey: tb.key,
                hidden: j.hidden || null, vpath: j.vpath || null, dashOn: j.dashOn || 0, dashOff: j.dashOff || 0, dashScale: 1 }
      });
    }
    // Natural position captured BEFORE applying any stored move offset —
    // see the field comment in the constructor and _onRemoteObjectMove/
    // _applyObjectUpdate, which both re-derive "natural + offset" the same
    // way rather than nudging relative to wherever the object happens to
    // already be on screen. Now the natural CENTER (see originX/Y above),
    // not top-left — same reason _myTranslatedPoints scales stored hit-test
    // points around this exact point, so a resized shape's hitbox matches
    // what's actually rendered.
    // a pen outline is parsed into a native Path2D now (spread over the load), not in the middle of a frame when a tile first needs it
    if (obj.type === 'path' && obj.fill && !obj.stroke && typeof Path2D !== 'undefined') { try { obj._p2d = new Path2D(pathCmdString(obj.path)); } catch (e) { obj._p2d = null; } }
    this._objectNaturalPos.set(row.id, { left: obj.left, top: obj.top });
    var offsetX = j.offsetX || 0, offsetY = j.offsetY || 0, scale = j.scale || 1;
    if (offsetX || offsetY || scale !== 1) {
      obj.set({ left: obj.left + offsetX, top: obj.top + offsetY, scaleX: scale, scaleY: scale });
      obj.setCoords();
      this._rebuildDashes(obj, scale);
    }
    this._fabricCanvas.add(obj);
    this._objectsById.set(row.id, obj);
    if (row.created_by === this._userId) {
      // Preference order: rawPoints (my own fresh commit, still in memory —
      // already an array of subpaths, see _commitStroke/_insertShape) ->
      // j.centerline (a variable-width pen stroke or a shape/body reloaded
      // from history — its ORIGINAL subpaths, saved exactly for this) ->
      // parsePathPoints (every other reloaded stroke's only remaining
      // record — see that function's own comment). parsePathPoints itself
      // still returns one flat polyline, so it's wrapped as its own single
      // subpath to match what every consumer expects uniformly.
      this._myPathPoints.set(row.id, rawPoints || (j.centerline && j.centerline.length ? j.centerline : [parsePathPoints(j.path)]));
      this._myObjectOffsets.set(row.id, { dx: offsetX, dy: offsetY });
      this._myObjectScales.set(row.id, scale);
      this._myObjectsJson.set(row.id, j);
    }
    return obj;
  };

  // A picture row: load the file, then build the Fabric object on its own board. Pictures sit under all ink (after the pictures
  // already there), so writing and drawing always show over a worksheet.
  Whiteboard.prototype._addImageObject = function (row, tb) {
    var self = this, j0 = row.fabric_json || {};
    tb.data._imgPending.set(row.id, j0);
    loadBoardImage(this._supabase, j0.src).then(function (im) {
      if (self._destroyed || tb.evicted) return;
      self._inBoard(tb, function () {
        var j = this._imgPending.get(row.id) || j0;     // an update (a move) that arrived while it was loading
        this._imgPending.delete(row.id);
        if (!this._committedIds.has(row.id)) return;    // erased or undone in the meantime
        var offsetX = j.offsetX || 0, offsetY = j.offsetY || 0, scale = j.scale || 1;
        var base = (j.width || im.naturalWidth) / im.naturalWidth;
        var obj = new fabric.Image(im, {
          left: j.left, top: j.top, originX: 'center', originY: 'center', scaleX: base, scaleY: base,
          selectable: false, evented: false, objectCaching: false,
          data: { id: row.id, ownerId: row.created_by, isShape: false, isText: false, isImage: true, baseScale: base, boardKey: tb.key }
        });
        this._objectNaturalPos.set(row.id, { left: obj.left, top: obj.top });
        if (offsetX || offsetY || scale !== 1) obj.set({ left: obj.left + offsetX, top: obj.top + offsetY, scaleX: base * scale, scaleY: base * scale });
        obj.setCoords();
        var list = this._fabricCanvas._objects, n = 0;
        while (n < list.length && list[n].data && list[n].data.isImage) n++;
        this._fabricCanvas.insertAt(obj, n);
        this._objectsById.set(row.id, obj);
        if (row.created_by === this._userId) {
          this._myPathPoints.set(row.id, j.centerline && j.centerline.length ? j.centerline : rectCenterline(j.left, j.top, j.width || im.naturalWidth, j.height || im.naturalHeight));
          this._myObjectOffsets.set(row.id, { dx: offsetX, dy: offsetY });
          this._myObjectScales.set(row.id, scale);
          this._myObjectsJson.set(row.id, j);
        }
        if (this._autoSelect === row.id && tb === this._board) {   // just inserted by me: ready to move or resize
          this._autoSelect = null;
          this._selectedIds = new Set([row.id]);
          this._setTool('select');
        }
        this._dirty = true;
        if (tb === this._board) this._invalidateBoxes([objBox(obj)]);
      });
    }).catch(function (err) { console.warn('[Whiteboard] picture not shown', err); });
  };

  // What the teacher is looking at, in board units: the centre and the size of the visible part (for placing a picture).
  Whiteboard.prototype.getViewInfo = function () {
    var s = this._scale || 1;
    var x0 = -this._panX / s, y0 = -this._panY / s;
    var x1 = (this._viewportW - this._panX) / s, y1 = (this._viewportH - this._panY) / s;
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, boardW: LOGICAL_W, boardH: LOGICAL_H, free: true };
  };

  // Puts one picture on the board on screen. spec: {src (path in wb-files), width, height (board units), left, top (its centre)}.
  Whiteboard.prototype.insertImage = function (spec) {
    var self = this;
    if (this._locked || this._readOnly) return Promise.resolve(null);
    var json = { isImage: true, src: spec.src, width: Math.round(spec.width), height: Math.round(spec.height), left: Math.round(spec.left), top: Math.round(spec.top), name: spec.name || null,
      centerline: rectCenterline(Math.round(spec.left), Math.round(spec.top), Math.round(spec.width), Math.round(spec.height)) };
    var b = this._dataBoard;
    return this._supabase.from('whiteboard_objects').insert(this._rowBase('image', json)).select().single().then(function (res) {
      if (self._destroyed) return null;
      if (res.error) { console.error('[Whiteboard] picture insert failed', res.error); if (global.BM && BM.toast) BM.toast('Nu s-a putut pune imaginea: ' + res.error.message, 'error'); return null; }
      if (b === self._board) self._autoSelect = res.data.id;
      self._addObjectIfNew(res.data);
      self._inBoard(self._boardForRow(res.data), function () {
        self._myStrokeHistory.push({ id: res.data.id, kind: 'image', fabric_json: res.data.fabric_json });
        self._myRedoStack = [];
        self._updateUndoRedoButtons();
      });
      return res.data;
    });
  };

  Whiteboard.prototype._removeObjectById = function (id) {
    if (!id) return;
    var ob = this._idBoard.get(id);
    if (ob && ob !== this._dataBoard) { this._inBoard(ob, function () { this._removeObjectById(id); }); return; }
    this._idBoard.delete(id);
    this._imgPending.delete(id);
    this._committedIds.delete(id);
    this._myPathPoints.delete(id);
    this._objectNaturalPos.delete(id);
    this._myObjectOffsets.delete(id);
    this._myObjectScales.delete(id);
    this._myObjectsJson.delete(id);
    if (this._selectedIds.delete(id)) this._dirty = true; // drop its now-stale highlight box too
    var obj = this._objectsById.get(id);
    this._objectsById.delete(id);
    if (obj) {
      if (obj.visible) this._invalidateBoxes([objBox(obj)]);   // only the box it covered is repainted
      this._fabricCanvas.remove(obj);
    }
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
    var subpaths = this._myPathPoints.get(id); // array of polylines — see distToPolyline's own comment
    if (!subpaths || !subpaths.length) return null;
    var off = this._myObjectOffsets.get(id);
    var dx = off ? off.dx : 0, dy = off ? off.dy : 0;
    var scale = this._myObjectScales.get(id) || 1;
    if (!dx && !dy && scale === 1) return subpaths;
    // Scale around the shape's own natural center (see originX/Y:'center'
    // in _addObjectIfNew) — the SAME point Fabric itself scales the
    // rendered path around, so a resized shape's hitbox/halo lines up with
    // what's actually drawn instead of scaling from some other corner.
    var natural = this._objectNaturalPos.get(id) || { left: 0, top: 0 };
    var cx = natural.left, cy = natural.top;
    return subpaths.map(function (pts) {
      return pts.map(function (p) {
        return { x: cx + dx + (p.x - cx) * scale, y: cy + dy + (p.y - cy) * scale };
      });
    });
  };

  // Shared by the eraser/select hit-testing and the selection halo below —
  // obj.strokeWidth alone is only ever the shape's ORIGINAL, unscaled
  // stroke (set once at insert time and never touched by a resize, see
  // _setObjectScale), so a resize-handle-dragged shape's actual on-screen
  // ink grows/shrinks by `scale` while a tolerance computed from
  // strokeWidth alone would stay frozen at its original-size value — comically
  // oversized around a shrunk-down shape, barely-there around a blown-up
  // one. Multiplying the whole band (base + padding) by the object's own
  // current scale keeps it matching what's actually drawn at any size.
  // How much of an object's resize shows in its line width: a freehand stroke grows with it, a figure (strokeUniform) does not.
  Whiteboard.prototype._inkScale = function (objId) {
    var o = this._objectsById.get(objId);
    return (o && o.data && (o.data.isShape || o.data.isImage)) ? 1 : (this._myObjectScales.get(objId) || 1);
  };

  // A 3D body's hidden edges are dashes baked into its path. When the body is resized the dashes must not stretch with it: they are
  // laid out again so that, once the object's scale is applied, they keep the on-screen length they were drawn with (and more of
  // them appear on a bigger body). The visible edges and the line width (strokeUniform) are untouched.
  Whiteboard.prototype._rebuildDashes = function (obj, scale) {
    var d = obj && obj.data;
    if (!d || !d.hidden || !d.vpath) return;
    if (Math.abs((d.dashScale || 1) - scale) < 0.004) return;
    var on = d.dashOn / scale, off = d.dashOff / scale;
    var str = d.vpath + ' ' + d.hidden.map(function (pts) {
      return dashedPolylineSegments(pts, on, off).map(function (seg) {
        return 'M ' + seg[0].x + ' ' + seg[0].y + ' L ' + seg[1].x + ' ' + seg[1].y;
      }).join(' ');
    }).join(' ');
    var left = obj.left, top = obj.top;
    obj._setPath(str, { left: left, top: top });   // the box of the figure does not change (every extreme point is on a solid edge), so it stays centred
    obj.set({ left: left, top: top });
    obj.dirty = true;
    d.dashScale = scale;
  };

  Whiteboard.prototype._hitTolerance = function (objId, strokeWidth, pad) {
    var scale = this._inkScale(objId);
    return ((strokeWidth || 2) / 2 + pad) * scale;
  };

  // Eraser tool — drag over any of MY OWN strokes to delete them one at a
  // time. Scoped to own strokes only for now, same as _clearMine and the
  // DB's own owner-only delete policy: a teacher-erases-anyone tool is
  // Phase 2 (see the SQL comment in 20260904160000_whiteboard_objects.sql —
  // it needs its own RLS policy, not just a client-side change).
  Whiteboard.prototype._eraseAt = function (pos) {
    var self = this;
    var hitIds = [];
    this._fabricCanvas._objects.forEach(function (obj) {
      if (!obj.data || obj.data.ownerId !== self._userId) return;
      if (self._erasedThisDrag.has(obj.data.id)) return;
      var bb = objBox(obj);   // far from the pointer: no need to measure the stroke at all
      if (pos.x < bb.x0 - 12 || pos.x > bb.x1 + 12 || pos.y < bb.y0 - 12 || pos.y > bb.y1 + 12) return;
      if (obj.data.isImage) return;   // a swipe of the eraser over a worksheet must rub out the writing, not the picture (select it and press Delete)
      // Text reads as a filled block, not a thin outline — anywhere inside
      // its own box is "on" it, the same reasoning _findMyObjectAt below
      // uses for its own isText branch.
      if (obj.data.isText || obj.data.isMath) {
        var b = self._myObjectBounds(obj.data.id);
        if (b && pointInRect(pos, b)) { hitIds.push(obj.data.id); self._erasedThisDrag.add(obj.data.id); }
        return;
      }
      var pts = self._myTranslatedPoints(obj.data.id);
      if (!pts) return;
      var tol = self._hitTolerance(obj.data.id, obj.strokeWidth, 5); // a little slack for a fast swipe — was +8, tightened along with _findMyObjectAt below (see its own comment)
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
    var objs = this._fabricCanvas._objects;
    for (var i = objs.length - 1; i >= 0; i--) {
      var obj = objs[i];
      if (!obj.data || obj.data.ownerId !== this._userId) continue;
      var bb0 = objBox(obj);
      if (pos.x < bb0.x0 - 12 || pos.x > bb0.x1 + 12 || pos.y < bb0.y0 - 12 || pos.y > bb0.y1 + 12) continue;
      // Text reads as a filled block of glyphs, not a thin unfilled
      // outline the way every shape/stroke here is — clicking anywhere
      // inside its box should grab it, not just within a few px of its
      // (invisible) edge the way distToPolyline's tolerance works for
      // everything else below.
      if (obj.data.isText || obj.data.isImage || obj.data.isMath) {
        var b = this._myObjectBounds(obj.data.id);
        if (b && pointInRect(pos, b)) return obj;
        continue;
      }
      var pts = this._myTranslatedPoints(obj.data.id);
      if (!pts) continue;
      // Was +8 — well past the visible selection halo's own width (see
      // _drawSelectionOverlay, drawn at strokeWidth+3), so clicking a
      // handful of px of empty space next to a shape would grab it. +3
      // keeps the click target close to what's actually drawn as "this is
      // the grabbable thing" rather than a much larger invisible margin.
      var tol = this._hitTolerance(obj.data.id, obj.strokeWidth, 3);
      if (distToPolyline(pos, pts) <= tol) return obj;
    }
    return null;
  };

  // MY OWN object's current logical-space bounding box (already shifted
  // by whatever the "select" tool has moved it) — used both for the
  // rubber-band's own hit-testing (does this box intersect the dragged
  // rectangle?) and for drawing its highlight in _drawSelectionOverlay.
  Whiteboard.prototype._myObjectBounds = function (id) {
    var subpaths = this._myTranslatedPoints(id);
    if (!subpaths || !subpaths.length) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    subpaths.forEach(function (pts) {
      pts.forEach(function (p) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
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
    var obj = this._objectsById.get(objId);
    var natural = this._objectNaturalPos.get(objId);
    if (!obj || !natural) return;
    // Re-reads _myObjectScales rather than taking scale as a param — every
    // existing move-drag call site only ever knows about {dx,dy}, and this
    // way none of them need to change to keep whatever scale a shape
    // already has instead of silently resetting it to 1 on the next move.
    var scale = this._myObjectScales.get(objId) || 1;
    var baseS = (obj.data && obj.data.baseScale) || 1;   // a picture's own size ratio (shown size / file size)
    var oldBox = (this._bg || !obj.visible) ? null : objBox(obj);
    obj.set({ left: natural.left + dx, top: natural.top + dy, scaleX: scale * baseS, scaleY: scale * baseS });
    this._rebuildDashes(obj, scale);
    obj.setCoords();
    if (obj.data) obj.data.bb = null;
    if (this._bg) return;   // a board that is not on screen: nothing to paint, it is painted when it is opened
    if (this._dragObjs && this._dragObjs.indexOf(obj) >= 0) { this._dirty = true; return; } // drawn on the overlay, nothing else to repaint
    if (oldBox) this._invalidateBoxes([oldBox, objBox(obj)]);   // only the old and the new place are repainted
  };

  // While objects are moved or resized they are taken off the committed layer (painted once without them) and drawn on the
  // overlay at every frame: a drag then costs a few objects per frame, however much else is on the board.
  // Another participant's drag (live positions arrive as Broadcast): the same trick, so a remote drag does not repaint the whole
  // board for every message either. The objects leave the committed layer at the first message and come back 300 ms after the last.
  Whiteboard.prototype._onRemoteMoves = function (moves) {
    var self = this, need = [];
    moves.forEach(function (m) {
      if (m.scale != null) self._myObjectScales.set(m.id, m.scale);
      var o = self._objectsById.get(m.id);
      if (o && (!self._dragObjs || self._dragObjs.indexOf(o) < 0)) need.push(o);
    });
    if (need.length) {
      var needBoxes = need.map(objBox);
      need.forEach(function (o) { o.visible = false; });
      this._dragObjs = (this._dragObjs || []).concat(need);
      this._remoteDragObjs = (this._remoteDragObjs || []).concat(need);
      this._renderBoxes(needBoxes);
    }
    moves.forEach(function (m) { self._setObjectOffset(m.id, m.offsetX, m.offsetY); });
    this._dirty = true;
    clearTimeout(this._remoteDragTimer);
    this._remoteDragTimer = setTimeout(function () { self._endRemoteDrag(); }, 300);
  };

  Whiteboard.prototype._endRemoteDrag = function () {
    clearTimeout(this._remoteDragTimer);
    var objs = this._remoteDragObjs;
    if (!objs) return;
    this._remoteDragObjs = null;
    if (this._dragObjs) {
      this._dragObjs = this._dragObjs.filter(function (o) { return objs.indexOf(o) < 0; });
      if (!this._dragObjs.length) this._dragObjs = null;
    }
    objs.forEach(function (o) { o.visible = true; });
    if (this._destroyed) return;
    this._renderBoxes(objs.map(objBox));
    this._dirty = true;
  };

  Whiteboard.prototype._beginDragLayer = function (ids) {
    this._endRemoteDrag();
    var objs = [], self = this;
    ids.forEach(function (id) { var o = self._objectsById.get(id); if (o) objs.push(o); });
    if (!objs.length) return;
    var boxes = objs.map(objBox);
    this._dragObjs = objs;
    objs.forEach(function (o) { o.visible = false; });
    this._renderBoxes(boxes);       // just the place they leave is repainted, not the whole board
  };

  Whiteboard.prototype._endDragLayer = function () {
    var objs = this._dragObjs;
    if (!objs) return;
    this._dragObjs = null;
    objs.forEach(function (o) { o.visible = true; });
    if (this._destroyed) return;
    this._renderBoxes(objs.map(objBox));   // back on the committed layer (only where they landed) in the same task that the overlay stops drawing them
    this._redrawOverlay();
    this._dirty = false;
  };

  // Resize handle drag (see _drawSelectionOverlay for the handle itself and
  // _bindPointerEvents' 'resizing' branch for the gesture) — scales around
  // the shape's own center (originX/Y:'center', set in _addObjectIfNew),
  // position untouched. Goes back through _setObjectOffset with whatever
  // offset the shape already has (rather than setting scaleX/scaleY here
  // directly) so position and scale can never end up applied independently
  // out of sync with each other.
  Whiteboard.prototype._setObjectScale = function (objId, scale) {
    this._myObjectScales.set(objId, scale);
    var off = this._myObjectOffsets.get(objId) || { dx: 0, dy: 0 };
    this._setObjectOffset(objId, off.dx, off.dy);
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

  // Persists the resize handle's final scale — same shape as
  // _persistObjectMove just above (merge into the cached fabric_json,
  // revert optimistic state on failure), kept as its own function rather
  // than folded into that one since a move drag and a resize drag are
  // separate gestures in _bindPointerEvents that each end at their own time.
  Whiteboard.prototype._persistObjectScale = function (objId, scale) {
    var self = this;
    var json = this._myObjectsJson.get(objId);
    if (!json) return;
    var newJson = Object.assign({}, json, { scale: scale });
    this._supabase.from('whiteboard_objects').update({ fabric_json: newJson }).eq('id', objId)
      .then(function (res) {
        if (res.error) {
          global.BM && BM.toast && BM.toast('Eroare: ' + res.error.message, 'error');
          var prevScale = json.scale || 1;
          self._setObjectScale(objId, prevScale);
          var off = self._myObjectOffsets.get(objId) || { dx: 0, dy: 0 };
          self._send('object:move', { moves: [{ id: objId, offsetX: off.dx, offsetY: off.dy, scale: prevScale }] });
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
    // (each removed object repaints just the box it covered, see _removeObjectById)
    // The selection halo/resize handle live on the OVERLAY canvas, which
    // only repaints when _dirty is set (see _redrawOverlay) — requestRenderAll
    // above is Fabric's own canvas, a different layer entirely. Unconditional
    // here rather than relying on _removeObjectById's own "was this id
    // selected" check: the Delete-key handler already clears _selectedIds
    // itself BEFORE calling this, so that check never fires and the overlay
    // never got told to redraw — the stale halo/handle from the frame just
    // before deletion just sat there until some unrelated later interaction
    // happened to repaint over it.
    this._dirty = true;
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
    this._supabase.from('whiteboard_objects').insert(this._rowBase(entry.kind || 'stroke', entry.fabric_json)).select().single().then(function (res) {
      if (self._destroyed) return;
      if (res.error) { console.error('[Whiteboard] redo failed', res.error); return; }
      var redoObj = self._addObjectIfNew(res.data);
      self._inBoard(self._boardForRow(res.data), function () {
        self._myStrokeHistory.push({ id: res.data.id, kind: res.data.kind, fabric_json: res.data.fabric_json });
        self._updateUndoRedoButtons();
      });
      if (redoObj) self._paintNewObject(redoObj);
    });
  };

  Whiteboard.prototype._updateUndoRedoButtons = function () {
    // this._wrap, not this._toolbarEl — these buttons now float over the
    // canvas in their own corner (see _build/#wbUndoCorner) rather than
    // living in the toolbar.
    if (this._bg) return;
    var undoBtn = this._undoEl && this._undoEl.querySelector('#wbUndoBtn');
    var redoBtn = this._undoEl && this._undoEl.querySelector('#wbRedoBtn');
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
    this._sessionLocked = !!locked;
    this._recomputeLocked();
    this._applyLockedUi();
    // Re-derive the cursor for whatever tool is currently selected — see
    // _setTool's own locked branch. Harmless no-op call otherwise (same
    // tool, just recomputes the same class list too).
    if (this._overlayEl) this._setTool(this._tool);
  };

  Whiteboard.prototype._applyLockedUi = function () {
    if (this._wrap) this._wrap.classList.toggle('wb-board--locked', this._locked && !this._readOnly);
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
    this._tlStaleAll();
  };

  /* ---- Render loop (overlay only — Fabric renders itself on demand) ---- */

  Whiteboard.prototype._startLoop = function () {
    var self = this;
    function tick(now) {
      if (self._destroyed) return;
      if (self._perfEl) {
        if (self._tickLast) { var gap = now - self._tickLast; if (gap > (self._gapMaxNow || 0)) self._gapMaxNow = gap; self._tickN = (self._tickN || 0) + 1; }
        self._tickLast = now;
        if (!self._tickWin) self._tickWin = now;
        if (now - self._tickWin >= 1000) { self._fps = Math.round(self._tickN * 1000 / (now - self._tickWin)); self._maxGap = Math.round(self._gapMaxNow || 0); self._tickN = 0; self._gapMaxNow = 0; self._tickWin = now; self._perfRender(); }
      }
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
    if (this._dragObjs) {
      var fcv = this._fabricCanvas, skip = fcv.skipOffscreen;
      fcv.skipOffscreen = false;   // the layer's own view is not the camera the overlay is painted at
      this._dragObjs.forEach(function (o) {
        o.visible = true;
        try { o.render(ctx); } catch (err) { /* a half-built object must not stop the frame */ }
        o.visible = false;
      });
      fcv.skipOffscreen = skip;
    }
    this._liveStrokes.forEach(function (st) {
      // A variable-width pen stroke is recognizable by its own points
      // carrying .w (set in _bindPointerEvents' pen branch and, for
      // someone else's live stroke, round-tripped through the broadcast
      // payload unchanged) — no separate flag needed on the entry itself.
      if (st.shape) { drawStraightStroke(ctx, st.points[0], st.points[st.points.length - 1], st.color, st.width, st.opacity, st.shape); return; }
      if (!st.points.length) return;
      // the smoothed geometry is rebuilt only when a point was added since the last frame
      if (!st._ink || st._inkN !== st.points.length) {
        st._inkN = st.points.length;
        st._ink = st.points[0].w != null ? inkOutline(st.points) : smoothInkPoints(st.points, 2);
      }
      if (st.points[0].w != null) drawInkPath(ctx, st._ink, st.color);
      else drawSmoothStroke(ctx, st._ink, st.color, st.width, st.opacity);
    });
    this._drawSelectionOverlay(ctx);
  };

  // Resize handle position (bottom-right corner of the object's own
  // bounding box, in logical coords) — only when exactly one object is
  // selected (a multi-selection only ever moves as a rigid group, same as
  // it always has — resizing a GROUP would need to decide a shared anchor
  // and isn't what was asked for) and that object is a stamped shape/body
  // (isShape — see _insertShape) or a text box (isText — see _insertText),
  // never freehand ink or a line. Shared between drawing the handle in
  // _drawSelectionOverlay and hit-testing a click on it in
  // _bindPointerEvents so the two can never disagree about where it is.
  Whiteboard.prototype._resizeHandlePos = function () {
    if (this._selectedIds.size !== 1) return null;
    var id = this._selectedIds.values().next().value;
    var obj = this._objectsById.get(id);
    if (!obj || !(obj.data.isShape || obj.data.isText || obj.data.isImage)) return null;
    var subpaths = this._myTranslatedPoints(id);
    if (!subpaths || !subpaths.length) return null;
    // The bounding BOX's own bottom-right corner can land in empty space
    // for a shape that isn't itself a rectangle (a pyramid's actual
    // rightmost point and its actual bottommost point are two different
    // vertices, neither of which is where those two extremes combine) —
    // that's exactly why the handle used to float outside the pyramid.
    // Picking the real vertex that maximizes x+y instead always lands on
    // an actual corner of the shape, in whichever direction reads as
    // "toward the bottom-right" for that particular shape.
    var best = null, bestScore = -Infinity;
    subpaths.forEach(function (pts) {
      pts.forEach(function (p) {
        var score = p.x + p.y;
        if (score > bestScore) { bestScore = score; best = p; }
      });
    });
    if (!best) return null;
    return { id: id, x: best.x, y: best.y };
  };

  // "select" tool decorations, drawn on top of every live stroke above: a
  // highlight HUGGING each currently-selected object's own actual ink
  // (individually, idroo-style — see _findMyObjectAt's own comment for
  // why a padded bounding box is the wrong hitbox for a curvy/diagonal
  // shape; the same reasoning applies to what the highlight should look
  // like, not just what it should respond to), a dashed box around the
  // union of all of them when 2+ are selected (so a multi-selection reads
  // as one group at a glance — THIS one stays a plain bounding rect, same
  // as idroo's own group-selection outline), and the rubber-band
  // rectangle itself while a selection drag is in progress. Recomputed
  // fresh from each object's CURRENT points/bounds on every redraw rather
  // than cached, so a highlight tracks its object through a drag without
  // any extra bookkeeping of its own.
  Whiteboard.prototype._drawSelectionOverlay = function (ctx) {
    var self = this;
    var pad = 10; // logical units of breathing room — group box only, see below
    var hairline = 1.5 / this._scale; // a true ~1.5 device px at any zoom, same technique as the grid
    var boxes = [];
    this._selectedIds.forEach(function (id) {
      var subpaths = self._myTranslatedPoints(id);
      var obj = self._objectsById.get(id);
      if (!subpaths || !obj) return;
      var b = self._myObjectBounds(id);
      if (b) boxes.push(b);
      // A translucent halo drawn ALONG the stroke's own points, just
      // barely wider than the ink itself — reads as a thin outline right
      // at the edge of the exact shape (a straight line/arrow's halo is
      // just its shaft; the arrowhead barbs aren't in the cached hit-test
      // points either, a minor cosmetic gap, not a hit-testing one)
      // rather than a thick highlighter-like glow. Each subpath drawn on
      // its own (see distToPolyline's own comment) — a shape/body's several
      // disconnected pieces used to get smoothed into one continuous curve
      // here, which is exactly the wild loop/curve artifact around shapes
      // and bodies in the selection highlight. A shape's own subpaths are
      // precise straight edges (drawPolylineStroke), not sampled freehand
      // input — running THOSE through the curve-fit smoothing every other
      // stroke type still uses below rounded off every sharp corner, which
      // was the "hitbox lines are curved, not on the real edge" bug.
      var drawHaloSeg = (obj.data.isShape || obj.data.isText || obj.data.isImage) ? drawPolylineStroke : drawSmoothStroke;
      // Scaled by the object's own resize factor for the same reason
      // _hitTolerance is — see its own comment — or a shrunk shape's halo
      // stays frozen at its original size and comically swallows it whole.
      var haloScale = self._inkScale(id);
      var haloWidth = ((obj.strokeWidth || 2) + 3) * haloScale;
      subpaths.forEach(function (pts) {
        drawHaloSeg(ctx, pts, 'rgba(37,99,235,0.45)', haloWidth, 1);
      });
    });
    var handle = this._resizeHandlePos();
    if (handle) {
      var hs = 9 / this._scale; // ~9 device px at any zoom, same fixed-screen-size technique as hairline above
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = hairline * 1.3;
      ctx.beginPath();
      ctx.rect(handle.x - hs, handle.y - hs, hs * 2, hs * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
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


  /* ---- Boards: the shared one and one private board per student ---- */

  Whiteboard.prototype._initBoards = function () {
    this._boards   = new Map();     // key -> board
    this._idBoard  = new Map();     // object id -> the board it lives on (a delete only carries the id)
    this._multi    = false;         // true once the database knows private boards (migration 20261120100000)
    var common = this._makeBoard(null);
    this._board = common;           // the board on screen
    this._dataBoard = common;       // the board whose data is in the per-board fields right now (differs from _board only inside _inBoard)
    this._bg = false;
    this._swapIn(common);
    this._color = common.color;
    this._recomputeLocked();
  };

  Whiteboard.prototype._makeBoard = function (ownerId) {
    var isCommon = !ownerId;
    // the teacher writes in another colour on a student's board, so a correction reads apart from the student's own ink
    var color = (!isCommon && this._isTeacher && ownerId !== this._userId) ? TEACHER_ON_STUDENT_COLOR : this._baseColor;
    var b = {
      key: isCommon ? COMMON_KEY : ownerId, ownerId: ownerId || null, isCommon: isCommon, color: color,
      data: newBoardData(), cam: null, loaded: false, loading: false, channel: null, lastUsed: 0, evicted: false
    };
    this._boards.set(b.key, b);
    return b;
  };

  // The board a row belongs to. null = a board this client does not hold (the teacher's student boards are created when opened).
  Whiteboard.prototype._boardForRow = function (row) {
    var owner = row && row.board_owner;
    if (!owner) return this._boards.get(COMMON_KEY);
    var b = this._boards.get(owner);
    if (b) return b;
    if (this._readOnly || (owner === this._userId && !this._isTeacher)) return this._getBoard(owner, true);
    return null;
  };

  Whiteboard.prototype._getBoard = function (ownerId, create) {
    var key = ownerId || COMMON_KEY;
    var b = this._boards.get(key);
    if (b || !create) return b || null;
    b = this._makeBoard(ownerId);
    if (!this._readOnly) this._connectBoardChannel(b);
    return b;
  };

  // WHERE the per-board fields live: copy a board's data into `this`, or stash `this` back into the board.
  Whiteboard.prototype._swapIn = function (b) {
    var d = b.data, i;
    for (i = 0; i < BOARD_KEYS.length; i++) this[BOARD_KEYS[i]] = d[BOARD_KEYS[i]];
    this._fabricCanvas._objects = d._fcObjects;
  };
  Whiteboard.prototype._swapOut = function (b) {
    var d = b.data, i;
    for (i = 0; i < BOARD_KEYS.length; i++) d[BOARD_KEYS[i]] = this[BOARD_KEYS[i]];
    d._fcObjects = this._fabricCanvas._objects;
  };
  // Runs fn with board b's data in place (not painting anything when b is not the board on screen) and puts everything back.
  Whiteboard.prototype._inBoard = function (b, fn) {
    if (!b || b === this._dataBoard) return fn.call(this);
    var cur = this._dataBoard, wasBg = this._bg;
    this._swapOut(cur); this._swapIn(b); this._dataBoard = b; this._bg = (b !== this._board);
    try { return fn.call(this); }
    finally { this._swapOut(b); this._swapIn(cur); this._dataBoard = cur; this._bg = wasBg; }
  };

  Whiteboard.prototype._boardFilter = function (q, b) {
    if (b.ownerId) return q.eq('board_owner', b.ownerId);
    return this._multi ? q.is('board_owner', null) : q;
  };

  // The columns every new row needs; a private board's rows carry its owner (the shared board's rows omit it, so an old database works too).
  Whiteboard.prototype._rowBase = function (kind, json) {
    var r = { session_id: this._sessionId, class_id: this._classId, created_by: this._userId, kind: kind, fabric_json: json };
    var b = this._dataBoard;
    if (b && b.ownerId) r.board_owner = b.ownerId;
    return r;
  };

  // The participant lock (the teacher blocks a student) applies to the shared board only; a student's own board stays theirs.
  Whiteboard.prototype._recomputeLocked = function () {
    this._locked = this._readOnly || (this._board.isCommon && this._sessionLocked);
  };

  Whiteboard.prototype._startBoards = function () {
    var self = this;
    if (!this._readOnly) this._connectRealtime();
    // does the database know private boards yet?
    this._supabase.from('whiteboard_objects').select('board_owner').limit(1).then(function (res) {
      if (self._destroyed) return;
      self._multi = !res.error;
      // a student always has a board of their own (empty until they write on it)
      if (self._multi && !self._isTeacher && !self._readOnly) self._getBoard(self._userId, true);
      if (self._onBoardsReady && !self._readOnly) self._onBoardsReady(self._multi);
    });
    this._loadFirst();
  };

  // The first load. A student (and the replay of a finished lesson) gets everything the row security lets them see in one go and the
  // rows are sorted into boards; the teacher loads the shared board now and a student's board when it is opened.
  Whiteboard.prototype._loadFirst = function () {
    var self = this, common = this._boards.get(COMMON_KEY);
    var base = function () { return self._supabase.from('whiteboard_objects').select('*').eq('session_id', self._sessionId); };
    if (this._isTeacher && !this._readOnly) {
      common.loading = true;
      base().is('board_owner', null).order('seq', { ascending: true }).then(function (res) {
        if (self._destroyed) return;
        if (res.error) {
          // an older database without private boards: no board_owner column, everything is the shared board
          return base().order('seq', { ascending: true }).then(function (res2) {
            common.loading = false;
            if (self._destroyed) return;
            if (res2.error) { console.error('[Whiteboard] load failed', res2.error); return; }
            common.loaded = true;
            self._addRowsSliced(common, res2.data || []);
          });
        }
        common.loading = false; common.loaded = true;
        self._addRowsSliced(common, res.data || []);
      });
      return;
    }
    base().order('seq', { ascending: true }).then(function (res) {
      if (self._destroyed) return;
      if (res.error) { console.error('[Whiteboard] load failed', res.error); return; }
      var rows = res.data || [], groups = new Map();
      rows.forEach(function (row) {
        var b = self._boardForRow(row);
        if (!b) return;
        if (!groups.has(b)) groups.set(b, []);
        groups.get(b).push(row);
      });
      common.loaded = true;
      var chain = Promise.resolve();
      // the board on screen first
      [common].concat(Array.from(groups.keys()).filter(function (b) { return b !== common; })).forEach(function (b) {
        b.loaded = true;
        chain = chain.then(function () { return self._addRowsSliced(b, groups.get(b) || []); });
      });
      if (self._readOnly && self._onBoardsReady) self._onBoardsReady(true);
    });
  };

  // A board's rows (the teacher opening a student's board the first time, or again after it was dropped from memory).
  Whiteboard.prototype._loadBoard = function (b) {
    if (b.loaded || b.loading) return;
    var self = this;
    b.loading = true;
    this._boardFilter(this._supabase.from('whiteboard_objects').select('*').eq('session_id', this._sessionId), b)
      .order('seq', { ascending: true }).then(function (res) {
        b.loading = false;
        if (self._destroyed || b.evicted) return;
        if (res.error) { console.error('[Whiteboard] board load failed', res.error); return; }
        b.loaded = true;
        self._addRowsSliced(b, res.data || []);
      });
  };

  // Objects are added in slices so a heavy board never freezes the page while it loads.
  Whiteboard.prototype._addRowsSliced = function (b, rows) {
    var self = this, at = 0;
    return new Promise(function (resolve) {
      (function slice() {
        if (self._destroyed || b.evicted) return resolve();
        var stop = Math.min(rows.length, at + 25);
        self._inBoard(b, function () { for (; at < stop; at++) this._addObjectIfNew(rows[at]); });
        // a big board is painted every ~250 ms while it loads (and once at the end), not after every slice
        var nowT = Date.now();
        if (b === self._board && (at >= rows.length || !self._lastLoadPaint || nowT - self._lastLoadPaint > 250)) { self._lastLoadPaint = nowT; self._fabricCanvas.requestRenderAll(); }
        if (at < rows.length) setTimeout(slice, 0); else resolve();
      })();
    });
  };

  Whiteboard.prototype.supportsBoards = function () { return !!this._multi; };
  Whiteboard.prototype.getBoardKey = function () { return this._board.key; };
  Whiteboard.prototype.getBoards = function () {
    var out = [];
    this._boards.forEach(function (b) { out.push({ key: b.key, ownerId: b.ownerId, isCommon: b.isCommon, loaded: b.loaded, loading: b.loading, color: b.color }); });
    return out;
  };

  // Shows another board: the shared one (null / 'c') or a student's (their user id). The teacher may open any student's board, a
  // student only their own. The board on screen is stashed (its camera too) and the other's data is put in place: nothing is repainted
  // for the boards that stay in the background.
  Whiteboard.prototype.setBoard = function (key, studentColor) {
    key = key || COMMON_KEY;
    if (this._destroyed || key === this._board.key) return true;
    if (this._math) this._math.close(false);   // a formula in the making belongs to the board it was started on
    var b = this._boards.get(key);
    if (!b) {
      if (key === COMMON_KEY || !this._multi) return false;
      if (!this._isTeacher && key !== this._userId && !this._readOnly) return false;
      b = this._getBoard(key, true);
    }
    if (studentColor) b.studentColor = studentColor;
    this._activate(b);
    return true;
  };

  // The ink a student writes with, read from what they already wrote on their board (when the roster does not say)
  Whiteboard.prototype._inferStudentColor = function (b) {
    var list = b.data._fcObjects;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o.data && o.data.ownerId === b.ownerId) {
        var c = typeof o.stroke === 'string' ? o.stroke : (typeof o.fill === 'string' ? o.fill : null);
        if (c && hexRgb(c)) return c;
      }
    }
    return null;
  };

  Whiteboard.prototype._activate = function (b) {
    var self = this, prev = this._board;
    // whatever is half done on the old board ends first: a typed text is saved there, strokes in the air are cancelled
    if (this._textEditing) this._finishTextEditor(false);
    this._endRemoteDrag();
    Object.keys(this._activePtrs).forEach(function (pid) {
      var st = self._activePtrs[pid];
      if (st.strokeId) { self._liveStrokes.delete('m:' + st.strokeId); self._send('stroke:cancel', { strokeId: st.strokeId }); }
    });
    this._activePtrs = {};
    this._activeRubberBand = null;
    this._touchPositions = {};
    this._pinching = false;
    clearTimeout(this._gestureTimer);
    // the camera is kept per board, as the centre of the view and the zoom, so it survives a window resize in between
    var vw = this._viewportW || 1, vh = this._viewportH || 1;
    prev.cam = { zoom: this._zoom, cx: (vw / 2 - this._panX) / this._scale, cy: (vh / 2 - this._panY) / this._scale };
    this._swapOut(prev);
    this._board = b; this._dataBoard = b; this._bg = false;
    this._swapIn(b);
    this._channel = b.channel || null;
    if (!b.isCommon && this._isTeacher && b.ownerId !== this._userId) b.color = pickCorrectionColor(b.studentColor || this._inferStudentColor(b));
    this._color = b.color;
    b.lastUsed = Date.now();
    this._recomputeLocked();
    this._applyLockedUi();
    // camera of the new board
    var c = b.cam;
    this._zoom = c ? c.zoom : 1;
    this._scale = this._baseScale * this._zoom;
    if (c) { this._panX = vw / 2 - c.cx * this._scale; this._panY = vh / 2 - c.cy * this._scale; }
    else { this._panX = vw / 2 - (LOGICAL_W / 2) * this._scale; this._panY = vh / 2 - (LOGICAL_H / 2) * this._scale; }
    this._clampCamera();
    this._rend = null;
    this._costCache = null;
    this._pendingBoxes = [];     // repaints queued for the board that just left the screen
    this._gestureXform = false;
    this._syncViewport();
    this._updateZoomUi();
    this._dirty = true;
    this._updateUndoRedoButtons();
    if (this._overlayEl) this._setTool(this._tool);   // the pen cursor wears this board's colour
    if (b.ownerId && !this._readOnly) { this._connectBoardChannel(b); this._loadBoard(b); }
    this._evictBoards();
    if (this._onBoardChange) this._onBoardChange(b.key);
  };

  // The teacher keeps a few students' boards in memory; the least recently used one is dropped (it is loaded again when opened).
  Whiteboard.prototype._evictBoards = function () {
    var self = this, list = [];
    this._boards.forEach(function (b) { if (b.ownerId && b !== self._board && b.ownerId !== self._userId && (b.loaded || b.loading)) list.push(b); });
    if (list.length <= MAX_LOADED_STUDENT_BOARDS || this._readOnly) return;
    list.sort(function (x, y) { return x.lastUsed - y.lastUsed; });
    list.slice(0, list.length - MAX_LOADED_STUDENT_BOARDS).forEach(function (b) {
      b.data._fcObjects.forEach(function (o) { if (o.data && o.data.id) self._idBoard.delete(o.data.id); });
      if (b.channel) { try { self._supabase.removeChannel(b.channel); } catch (e) {} b.channel = null; }
      b.data = newBoardData(); b.loaded = false; b.loading = false; b.cam = null;
      b.evicted = true;
      self._boards.delete(b.key);
    });
  };

  /* ---- Teardown ---- */

  Whiteboard.prototype.destroy = function () {
    this._destroyed = true;
    // Discards rather than commits — and, since _destroyed is already
    // true, _finishTextEditor's own guard skips any Supabase call entirely.
    // Needed explicitly (not just left to the DOM teardown below): the
    // text editor's "click away" listener lives on `document`, not on
    // this._wrap, so removing _wrap alone would leave it (and its closure
    // over `self`) dangling forever otherwise.
    if (this._textEditing) this._finishTextEditor(true);
    if (this._math) { try { this._math.close(false); } catch (e) {} }
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._zoomRafId) cancelAnimationFrame(this._zoomRafId);
    if (this._pumpRaf) cancelAnimationFrame(this._pumpRaf);
    if (this._staleRaf) cancelAnimationFrame(this._staleRaf);
    clearTimeout(this._gestureTimer);
    if (this._panRafId) cancelAnimationFrame(this._panRafId);
    clearTimeout(this._resizeTimer);
    clearTimeout(this._hintTimer);
    clearTimeout(this._panSettleTimer);
    clearTimeout(this._gestureTimer);
    if (this._ro) this._ro.disconnect();
    if (this._keyHandler) global.removeEventListener('keydown', this._keyHandler);
    if (this._shapeDocClickHandler) document.removeEventListener('click', this._shapeDocClickHandler);
    if (this._shapeScrollCloseHandler) global.removeEventListener('scroll', this._shapeScrollCloseHandler, true);
    var selfD = this;
    if (this._boards) this._boards.forEach(function (b) { if (b.channel) { try { selfD._supabase.removeChannel(b.channel); } catch (e) {} b.channel = null; } });
    this._channel = null;
    clearTimeout(this._remoteDragTimer);
    if (this._fabricCanvas) this._fabricCanvas.dispose();
    if (this._undoMount) this._undoMount.innerHTML = '';
    if (this._wrap && this._wrap.parentNode) this._wrap.parentNode.removeChild(this._wrap);
  };

  global.Whiteboard = Whiteboard;

})(window);
