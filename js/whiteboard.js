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
  var VW_MIN_MULT   = 0.5;  // thinnest the pen gets, as a multiple of the picked width
  var VW_MAX_MULT   = 1.6;  // thickest the pen gets, at a dead stop
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
  var VW_SMOOTHING  = 0.35; // 0..1, how fast width chases the new target (see _widthFromVelocity) — lower = smoother but laggier
  var CIRCLE_SEGS   = 10;   // join-circle polygon approximation — see variableWidthPathString

  // 1 = the "fit the whole board in the container" scale computed fresh in
  // _applySize every resize — MIN_ZOOM stays 1 rather than allowing zoom
  // OUT below that, since there's nothing more of the board to reveal past
  // "fully visible" (it would just shrink into a smaller box with empty
  // margin, not show anything new).
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 6;
  var ZOOM_STEP = 0.25;

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

  function polylineIntersectsRect(pts, rect) {
    if (!pts.length) return false;
    if (pts.length === 1) return pointInRect(pts[0], rect);
    for (var i = 0; i < pts.length - 1; i++) {
      if (segmentIntersectsRect(pts[i], pts[i + 1], rect)) return true;
    }
    return false;
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

  // Target width for the point just captured, from how fast the pointer is
  // currently moving — prevPt/pt both need a .t (ms timestamp, see
  // _bindPointerEvents' pen branch); prevPt is null for a stroke's very
  // first point, which has no speed yet and just starts at baseWidth.
  // Blended toward the raw speed-implied width (VW_SMOOTHING) rather than
  // jumping straight to it — raw per-sample speed from real pointer input
  // is noisy enough that an unsmoothed line visibly stutters in thickness.
  function _widthFromVelocity(baseWidth, prevPt, pt) {
    if (!prevPt) return baseWidth;
    var dt = Math.max(1, pt.t - prevPt.t); // ms; floored so a duplicate-timestamp sample can't divide by zero
    var speed = dist(prevPt, pt) / dt; // logical units / ms
    var t = (speed - VW_SLOW_SPEED) / (VW_FAST_SPEED - VW_SLOW_SPEED);
    t = Math.pow(Math.max(0, Math.min(1, t)), VW_CURVE);
    var targetW = baseWidth * (VW_MAX_MULT - t * (VW_MAX_MULT - VW_MIN_MULT));
    var prevW = prevPt.w == null ? baseWidth : prevPt.w;
    return prevW + (targetW - prevW) * VW_SMOOTHING;
  }

  // Shared geometry for the pen's variable-width ink: each point carries
  // its own .w (see _widthFromVelocity), so a single canvas lineWidth can't
  // draw it — instead every segment becomes its own filled quad (one edge
  // offset half its start point's width, the other half its end point's,
  // perpendicular to the segment), plus a filled circle at every point to
  // round over the seam between adjacent quads (which generally don't line
  // up edge-to-edge once the path turns or the width changes). Filling
  // every piece as ONE path in a single fill() call is what makes the
  // overlaps invisible — nonzero winding just unions them — which only
  // holds up at globalAlpha 1; this is why variable width stays pen-only
  // (opacity 1) and never highlighter (semi-transparent, which would show
  // every overlap as a darker blotch). Returned as data rather than drawn
  // directly so the same math backs both the live canvas preview
  // (drawVariableWidthStroke) and the committed SVG path
  // (variableWidthPathString) — a stroke must look pixel-identical the
  // instant it's finalized, same reasoning as smoothPathString/
  // drawSmoothStroke's own split above.
  function _strokeOutlinePieces(points) {
    var quads = [], circles = [];
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i], p1 = points[i + 1];
      var w0 = p0.w == null ? 2 : p0.w, w1 = p1.w == null ? 2 : p1.w;
      var dx = p1.x - p0.x, dy = p1.y - p0.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len, ny = dx / len;
      quads.push({
        a: { x: p0.x + nx * w0 / 2, y: p0.y + ny * w0 / 2 },
        b: { x: p1.x + nx * w1 / 2, y: p1.y + ny * w1 / 2 },
        c: { x: p1.x - nx * w1 / 2, y: p1.y - ny * w1 / 2 },
        d: { x: p0.x - nx * w0 / 2, y: p0.y - ny * w0 / 2 }
      });
    }
    for (var j = 0; j < points.length; j++) {
      circles.push({ cx: points[j].x, cy: points[j].y, r: (points[j].w == null ? 2 : points[j].w) / 2 });
    }
    return { quads: quads, circles: circles };
  }

  // Live preview of an in-progress (or another viewer's live) pen stroke —
  // see drawSmoothStroke above for the fixed-width equivalent every other
  // tool still uses.
  function drawVariableWidthStroke(ctx, points, color) {
    if (!points.length) return;
    var pieces = _strokeOutlinePieces(points);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    pieces.quads.forEach(function (q) {
      ctx.moveTo(q.a.x, q.a.y);
      ctx.lineTo(q.b.x, q.b.y);
      ctx.lineTo(q.c.x, q.c.y);
      ctx.lineTo(q.d.x, q.d.y);
      ctx.closePath();
    });
    pieces.circles.forEach(function (c) {
      ctx.moveTo(c.cx + c.r, c.cy);
      // anticlockwise=true: see circlePathString's own comment on why this
      // has to wind the same direction as the quads, not canvas's default.
      ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2, true);
    });
    ctx.fill();
    ctx.restore();
  }

  // Committed counterpart of drawVariableWidthStroke — an SVG path string
  // for the fabric.Path this stroke becomes (see _commitStroke/
  // _addObjectIfNew), filled rather than stroked. Circles are drawn as a
  // CIRCLE_SEGS-sided polygon (M/L/Z only) instead of arc ('A') commands —
  // matching the "curves are many-segment straight-line approximations"
  // convention SHAPE_DEFS's own circle/ellipse stamps already use elsewhere
  // in this file, rather than introducing the only arc commands in the
  // whole codebase into fabric's path parser.
  function variableWidthPathString(points) {
    if (!points.length) return null;
    // _strokeOutlinePieces already degrades to "just the one join circle,
    // no quads" for a single point — see its own quad loop — so there's no
    // separate 1-point case to special-case here.
    var pieces = _strokeOutlinePieces(points);
    var d = pieces.quads.map(function (q) {
      return 'M ' + q.a.x + ' ' + q.a.y + ' L ' + q.b.x + ' ' + q.b.y +
             ' L ' + q.c.x + ' ' + q.c.y + ' L ' + q.d.x + ' ' + q.d.y + ' Z';
    }).join(' ');
    d += ' ' + pieces.circles.map(function (c) { return circlePathString(c.cx, c.cy, c.r); }).join(' ');
    return d.trim();
  }

  // The white "eye"-shaped gaps in the first cut of this were exactly this:
  // fill() with the default nonzero rule treats overlapping shapes as ADDING
  // winding only when they wind the SAME rotational direction — opposite
  // windings SUBTRACT instead, cutting a hole wherever they overlap. The
  // quads in _strokeOutlinePieces happen to always wind counter-clockwise
  // on screen (their corner order is a fixed a→b→c→d template applied to a
  // perpendicular that's always "90° left of local travel", so this holds
  // regardless of which way any given segment points); this polygon needs
  // to match that, not cos/sin's own natural clockwise sweep (angle 0 at
  // 3-o'clock, increasing = clockwise in screen/y-down space) — hence the
  // negated angle below. drawVariableWidthStroke's ctx.arc has the exact
  // same fix via its anticlockwise=true argument.
  function circlePathString(cx, cy, r) {
    var d = 'M ' + (cx + r) + ' ' + cy;
    for (var k = 1; k <= CIRCLE_SEGS; k++) {
      var a = -(k / CIRCLE_SEGS) * Math.PI * 2;
      d += ' L ' + (cx + r * Math.cos(a)) + ' ' + (cy + r * Math.sin(a));
    }
    return d + ' Z';
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

  // id -> { label, icon (24x24 glyph, toolbar button only), build(cx,cy) }.
  // build() returns an array of subpaths (each an array of {x,y}) sized
  // around a fixed half-extent, not the current zoom/selection — a stamped
  // shape is a normal committed stroke afterward, moved with the "select"
  // tool like anything else, never resized in place (this app doesn't have
  // per-vertex handles the way js/geometry-figure-editor.js does).
  // Basic-polygon and regular-polygon/rounded icons are original to this
  // toolbar; the ones shared with the geometry configurator's own shape
  // picker (cerc/patrat/paralelogram/romb/cub/piramidă/sferă/con/cilindru)
  // reuse that module's exact SHAPE_ICONS glyphs for visual consistency
  // between the two tools.
  var SHAPE_DEFS = {
    patrat: {
      label: 'Pătrat', icon: '<rect x="4.5" y="4.5" width="15" height="15"/>',
      build: function (cx, cy) {
        var hw = 90, hh = 70;
        return [[{ x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh }, { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh }, { x: cx - hw, y: cy - hh }]];
      }
    },
    'tri-isoscel': {
      label: 'Triunghi isoscel', icon: '<path d="M12 3 5 20 19 20Z"/>',
      build: function (cx, cy) {
        var hw = 90, hh = 75;
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
        var hw = 95, hh = 65, topHw = hw * 0.5;
        return [[{ x: cx - topHw, y: cy - hh }, { x: cx + topHw, y: cy - hh }, { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh }, { x: cx - topHw, y: cy - hh }]];
      }
    },
    paralelogram: {
      label: 'Paralelogram', icon: '<path d="M8 6 20 6 16 18 4 18Z"/>',
      build: function (cx, cy) {
        var hw = 90, hh = 65, skew = 35;
        return [[{ x: cx - hw + skew, y: cy - hh }, { x: cx + hw, y: cy - hh }, { x: cx + hw - skew, y: cy + hh }, { x: cx - hw, y: cy + hh }, { x: cx - hw + skew, y: cy - hh }]];
      }
    },
    romb: {
      label: 'Romb', icon: '<path d="M12 2 17 12 12 22 7 12Z"/>',
      build: function (cx, cy) {
        var hw = 95, hh = 75;
        return [[{ x: cx, y: cy - hh }, { x: cx + hw, y: cy }, { x: cx, y: cy + hh }, { x: cx - hw, y: cy }, { x: cx, y: cy - hh }]];
      }
    },
    pentagon: {
      label: 'Pentagon', icon: '<path d="M12 3 20.5 9.5 17 19 7 19 3.5 9.5Z"/>',
      build: function (cx, cy) { return [regularPolygonPts(cx, cy, 90, 90, 5)]; }
    },
    hexagon: {
      label: 'Hexagon', icon: '<path d="M8 4 16 4 20.5 12 16 20 8 20 3.5 12Z"/>',
      build: function (cx, cy) { return [regularPolygonPts(cx, cy, 90, 90, 6, -30)]; }
    },
    octagon: {
      label: 'Octagon', icon: '<path d="M8.5 3.5 15.5 3.5 20.5 8.5 20.5 15.5 15.5 20.5 8.5 20.5 3.5 15.5 3.5 8.5Z"/>',
      build: function (cx, cy) { return [regularPolygonPts(cx, cy, 90, 90, 8, -22.5)]; }
    },
    stea: {
      label: 'Stea', icon: '<path d="M12 3 14.4 9.6 21.5 9.8 15.8 14 17.9 21 12 16.9 6.1 21 8.2 14 2.5 9.8 9.6 9.6Z"/>',
      build: function (cx, cy) { return [starPts(cx, cy, 95, 95, 5, 0.42)]; }
    },
    cerc: {
      label: 'Cerc', icon: '<circle cx="12" cy="12" r="8.5"/>',
      build: function (cx, cy) { return [ellipsePts(cx, cy, 90, 75, 48)]; }
    },
    'patrat-rotunjit': {
      label: 'Pătrat rotunjit', icon: '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/>',
      build: function (cx, cy) { return [roundedRectPts(cx - 90, cy - 70, cx + 90, cy + 70, 26)]; }
    },
    semicerc: {
      label: 'Semicerc', icon: '<path d="M4 16h16"/><path d="M4 16a8 8 0 0 1 16 0"/>',
      build: function (cx, cy) {
        var rx = 95, h = 90;
        var pts = ellipseArcPts(cx, cy + h / 2, rx, h, Math.PI, 2 * Math.PI, 24);
        pts.push(pts[0]);
        return [pts];
      }
    },
    cub: {
      label: 'Cub',
      icon: '<path d="M4 10 14 10 14 20 4 20Z"/><path d="M9 5 19 5 19 15"/><path d="M4 10 9 5"/><path d="M14 10 19 5"/><path d="M14 20 19 15"/><path d="M4 20 9 15 9 5"/><path d="M9 15 19 15"/>',
      build: function (cx, cy) {
        var hw = 80, hh = 65, dx = 55, dy = -40;
        var minX = cx - hw, maxX = cx + hw, minY = cy - hh, maxY = cy + hh;
        var F0 = { x: minX, y: minY - dy }, F1 = { x: maxX - dx, y: minY - dy }, F2 = { x: maxX - dx, y: maxY }, F3 = { x: minX, y: maxY };
        var B0 = { x: F0.x + dx, y: F0.y + dy }, B1 = { x: F1.x + dx, y: F1.y + dy }, B2 = { x: F2.x + dx, y: F2.y + dy }, B3 = { x: F3.x + dx, y: F3.y + dy };
        return [[F0, F1, F2, F3, F0], [B0, B1, B2, B3, B0], [F0, B0], [F1, B1], [F2, B2], [F3, B3]];
      }
    },
    'piramida-patrata': {
      label: 'Piramidă (bază pătrată)',
      icon: '<path d="M4 18 20 18"/><path d="M12 3 4 18"/><path d="M12 3 20 18"/><path d="M12 3 12 13"/><path d="M12 13 4 18"/><path d="M12 13 20 18"/>',
      build: function (cx, cy) {
        var hw = 85, dx = 55, dy = 38, topY = cy - 95, botY = cy + 55;
        var p0 = { x: cx - hw, y: botY }, p1 = { x: cx + hw - dx, y: botY }, p2 = { x: cx + hw, y: botY - dy }, p3 = { x: cx - hw + dx, y: botY - dy };
        var apex = { x: (p0.x + p2.x) / 2, y: topY };
        return [[p0, p1, p2, p3, p0], [apex, p0], [apex, p1], [apex, p2], [apex, p3]];
      }
    },
    'piramida-triunghiulara': {
      label: 'Piramidă (bază triunghiulară)',
      icon: '<path d="M4 20 18 20"/><path d="M12 3 4 20"/><path d="M12 3 18 20"/><path d="M12 3 12 13"/><path d="M12 13 4 20"/><path d="M12 13 18 20"/>',
      build: function (cx, cy) {
        var hw = 85, baseY = cy + 65, backY = cy + 30, topY = cy - 95;
        var p0 = { x: cx - hw, y: baseY }, p1 = { x: cx + hw, y: baseY }, p2 = { x: cx, y: backY }, apex = { x: cx, y: topY };
        return [[p0, p1, p2, p0], [apex, p0], [apex, p1], [apex, p2]];
      }
    },
    con: {
      label: 'Con',
      icon: '<path d="M4.5 18a7.5 2 0 0 0 15 0"/><path d="M4.5 18a7.5 2 0 0 1 15 0"/><path d="M12 4 4.5 18"/><path d="M12 4 19.5 18"/>',
      build: function (cx, cy) {
        var rx = 85, ry = 24, apexY = cy - 95, baseY = cy + 55;
        return [ellipsePts(cx, baseY, rx, ry, 28), [{ x: cx, y: apexY }, { x: cx - rx, y: baseY }], [{ x: cx, y: apexY }, { x: cx + rx, y: baseY }]];
      }
    },
    cilindru: {
      label: 'Cilindru',
      icon: '<path d="M4.5 7a7.5 2 0 0 0 15 0a7.5 2 0 0 0 -15 0"/><path d="M4.5 17a7.5 2 0 0 0 15 0"/><path d="M4.5 17a7.5 2 0 0 1 15 0"/><path d="M4.5 7v10"/><path d="M19.5 7v10"/>',
      build: function (cx, cy) {
        var rx = 85, ry = 22, topY = cy - 70, botY = cy + 70;
        return [ellipsePts(cx, topY, rx, ry, 28), ellipsePts(cx, botY, rx, ry, 28), [{ x: cx - rx, y: topY }, { x: cx - rx, y: botY }], [{ x: cx + rx, y: topY }, { x: cx + rx, y: botY }]];
      }
    },
    sfera: {
      label: 'Sferă',
      icon: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 14.5C6.5 16.3 17.5 16.3 20.2 14.5"/><path d="M3.8 9.6C6.5 7.8 17.5 7.8 20.2 9.6"/>',
      build: function (cx, cy) {
        var r = 85;
        return [ellipsePts(cx, cy, r, r, 48), ellipsePts(cx, cy, r, r * 0.3, 40)];
      }
    }
  };
  var SHAPE_IDS_2D = ['patrat', 'tri-isoscel', 'tri-dreptunghic', 'trapez', 'paralelogram', 'romb', 'pentagon', 'hexagon', 'octagon', 'stea', 'cerc', 'patrat-rotunjit', 'semicerc'];
  var SHAPE_IDS_3D = ['cub', 'piramida-patrata', 'piramida-triunghiulara', 'con', 'cilindru', 'sfera'];
  var CHEVRON_ICON = '<path d="M6 9.5 12 15.5 18 9.5"/>';

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
  var PEN_ICON         = '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
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
  var PEN_CURSOR         = haloCursor(PEN_ICON, 3, 21, 'crosshair');
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

  function shapeIcon24(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  // "Forme 2D" / "Corpuri 3D" — same .gfe-dropdown/.gfe-shape-btn markup and
  // interaction the geometry configurator's own shape picker uses (see
  // js/geometry-figure-editor.js), reused as-is (that CSS is already
  // page-generic, not scoped to that editor) so this reads as "the same
  // shape tool, just inside the whiteboard" rather than a new one to learn.
  function shapeDropdown(triggerIconId, title, ids) {
    return '<div class="gfe-dropdown">' +
      '<button type="button" class="dc-tool-btn gfe-dropdown__trigger" title="' + title + '" aria-haspopup="true" aria-expanded="false">' +
        shapeIcon24(SHAPE_DEFS[triggerIconId].icon) + shapeIcon24(CHEVRON_ICON) +
      '</button>' +
      '<div class="gfe-dropdown__panel">' +
        '<div class="dc-tool-group gfe-shape-group">' +
          ids.map(function (id) {
            return '<button type="button" class="dc-tool-btn gfe-shape-btn" data-shape="' + id + '" title="' + SHAPE_DEFS[id].label + '">' + shapeIcon24(SHAPE_DEFS[id].icon) + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
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
        '<div class="dc-tool-group dc-tool-group--nodiv">' +
          shapeDropdown('patrat', 'Forme 2D', SHAPE_IDS_2D) +
          shapeDropdown('cub', 'Corpuri 3D', SHAPE_IDS_3D) +
        '</div>' +
        '<div class="dc-tool-group">' +
          WIDTH_PRESETS.map(function (w, i) {
            var dotSize = 3 + i * 3;
            return '<button type="button" class="dc-width-btn' + (i === 0 ? ' dc-width-btn--active' : '') +
              '" data-width="' + w + '" title="Grosime linie (apasă din nou pentru grosime personalizată)">' +
              '<span class="dc-width-dot" style="width:' + dotSize + 'px;height:' + dotSize + 'px"></span></button>';
          }).join('') +
          // Not a real .gfe-dropdown__trigger — clicking any of the 3
          // preset buttons ABOVE while it's already the active one is what
          // opens this (see the widthBtn branch in _bindToolbar), so there's
          // no separate visible trigger of its own, just the (initially
          // hidden) panel positioned under whichever button was clicked.
          '<div class="gfe-dropdown wb-width-dd" id="wbWidthCustomDd">' +
            '<div class="gfe-dropdown__panel wb-width-panel">' +
              '<label class="wb-width-panel__label" for="wbWidthCustomRange">Grosime personalizată: <span id="wbWidthCustomVal">' + WIDTH_PRESETS[0] + '</span></label>' +
              '<input type="range" class="wb-width-range" id="wbWidthCustomRange" min="' + WIDTH_MIN + '" max="' + WIDTH_MAX + '" step="0.5" value="' + WIDTH_PRESETS[0] + '">' +
            '</div>' +
          '</div>' +
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
      // browser's own grab/grabbing (already high-contrast, no custom
      // cursor needed), select the plain arrow (it's the one tool that
      // ISN'T about marking the board), and every drawing tool its own
      // glyph cursor — see haloCursor's own comment above for why each
      // gets its own rather than one shared crosshair.
      this._overlayEl.style.cursor =
        (this._locked && tool !== 'pan') ? 'not-allowed' :
        tool === 'eraser' ? ERASER_CURSOR :
        tool === 'pan' ? 'grab' :
        tool === 'select' ? 'default' :
        tool === 'pen' ? PEN_CURSOR :
        tool === 'highlighter' ? HIGHLIGHTER_CURSOR :
        CROSSHAIR_CURSOR; // line / dashed-line / arrow
    }
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
  };

  // #wbWidthCustomDd has no .gfe-dropdown__trigger of its own — the width
  // preset button that was clicked a second time (see the widthBtn branch
  // above) IS the trigger, passed in as btn — so it's positioned/opened
  // here instead of through the generic ddTrigger click branch that handles
  // the shape dropdowns. _closeShapeDropdowns() still closes it the same
  // way, since that just queries .gfe-dropdown--open generically.
  Whiteboard.prototype._toggleCustomWidthPanel = function (btn) {
    var dd = this._toolbarEl.querySelector('#wbWidthCustomDd');
    var wasOpen = dd.classList.contains('gfe-dropdown--open');
    this._closeShapeDropdowns();
    if (wasOpen) return; // the click that got us here was the "close it again" click
    var r = btn.getBoundingClientRect();
    var panel = dd.querySelector('.gfe-dropdown__panel');
    panel.style.top  = (r.bottom + 6) + 'px';
    panel.style.left = r.left + 'px';
    var range = dd.querySelector('#wbWidthCustomRange');
    range.value = this._width;
    dd.querySelector('#wbWidthCustomVal').textContent = this._width;
    dd.classList.add('gfe-dropdown--open');
  };

  Whiteboard.prototype._bindToolbar = function () {
    var self = this;
    // Custom-width slider (see _toggleCustomWidthPanel) — a plain direct
    // listener rather than folded into the delegated 'click' handler below,
    // since 'input' fires continuously while dragging and there's exactly
    // one of these, not a set of buttons to match by selector.
    this._toolbarEl.querySelector('#wbWidthCustomRange').addEventListener('input', function () {
      self._width = parseFloat(this.value);
      self._toolbarEl.querySelector('#wbWidthCustomVal').textContent = this.value;
    });
    this._toolbarEl.addEventListener('click', function (e) {
      var ddTrigger = e.target.closest('.gfe-dropdown__trigger');
      if (ddTrigger) {
        var dd = ddTrigger.closest('.gfe-dropdown');
        var wasOpen = dd.classList.contains('gfe-dropdown--open');
        self._closeShapeDropdowns();
        if (!wasOpen) {
          var panel = dd.querySelector('.gfe-dropdown__panel');
          var r = ddTrigger.getBoundingClientRect();
          panel.style.top = (r.bottom + 6) + 'px';
          panel.style.left = r.left + 'px';
          dd.classList.add('gfe-dropdown--open');
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
        // A second click on the ALREADY-active preset opens the custom
        // slider instead of just re-selecting the same preset — and
        // crucially does NOT touch self._width first, so it starts the
        // slider from whatever's actually active (which might already be a
        // custom value from a previous open of this same panel) rather
        // than snapping back to the preset's own round number.
        if (widthBtn.classList.contains('dc-width-btn--active')) {
          self._toggleCustomWidthPanel(widthBtn);
        } else {
          self._width = parseInt(widthBtn.dataset.width, 10);
          self._toolbarEl.querySelectorAll('.dc-width-btn').forEach(function (b) {
            b.classList.toggle('dc-width-btn--active', b === widthBtn);
          });
          self._closeShapeDropdowns();
        }
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

    // Same two safety nets js/geometry-figure-editor.js's own shape-picker
    // dropdown uses: a click anywhere outside the toolbar (the canvas,
    // most likely — exactly where you'd click right after picking a shape)
    // and a page scroll (the panel is position:fixed, so it wouldn't
    // otherwise follow the trigger it's supposed to be anchored under).
    this._shapeDocClickHandler = function (e) {
      if (!self._toolbarEl.contains(e.target)) self._closeShapeDropdowns();
    };
    document.addEventListener('click', this._shapeDocClickHandler);
    this._shapeScrollCloseHandler = function () { self._closeShapeDropdowns(); };
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
    // The grid's level-0 step, fixed in LOGICAL units from here until the
    // next resize — deliberately computed from baseScale (the container's
    // own fit-to-screen scale), never this._scale, so it stays constant
    // across every zoom/pan step in between and the grid lines never jump.
    // See _redrawGrid and the constants above for the rest of the scheme.
    var gridMinDim = Math.min(vw, vh);
    var gridTargetPx = Math.max(GRID_CELL_TARGET_PX_MIN, Math.min(GRID_CELL_TARGET_PX_MAX, gridMinDim / 14));
    this._gridBaseStep = niceGridStep(gridTargetPx / baseScale);
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

  // Grid/paper background — see the CSS comment on .wb-grid-canvas for why
  // this paints the white "paper" rect too, not just the grid lines: with
  // the fixed-viewport camera, no DOM element is sized/positioned to the
  // board anymore for a CSS background to show through from. Cheap enough
  // (the paper rect plus at most a few dozen grid lines) to just redraw
  // inline from _syncViewport on every pan/zoom step rather than batching
  // it through the dirty-flag/rAF loop the way the overlay's live strokes
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
    var lineWidth = 1 / s; // a true single DEVICE pixel at any zoom, never thickening/blurring as zoom grows

    // Build the list of steps from level 0 (coarsest, fixed — see
    // this._gridBaseStep) down to however fine a level is still visible at
    // the current zoom — each level is the previous one's step divided by
    // MINOR_GRID_SUBDIVISIONS, so every line at every level sits at a fixed
    // logical position that never shifts as zoom changes; only whether a
    // given (always-the-same) line is currently faded in changes.
    var baseStep = this._gridBaseStep || niceGridStep(Math.min(GRID_CELL_TARGET_PX_MAX, 32) / this._scale);
    var steps = [baseStep];
    for (var i = 1; i < GRID_MAX_LEVELS; i++) {
      var nextStep = steps[i - 1] / MINOR_GRID_SUBDIVISIONS;
      if (nextStep * this._scale < MINOR_GRID_FADE_MIN_PX) break;
      steps.push(nextStep);
    }

    // Drawn finest-first, coarsest-last, so level 0 (and any other
    // already-fully-faded-in level) paints on top at full opacity wherever
    // its lines coincide with a finer level's — same reasoning the old
    // two-tier version used, just generalized to N levels.
    for (var lvl = steps.length - 1; lvl >= 0; lvl--) {
      var step = steps[lvl];
      var opacity;
      if (lvl === 0) {
        opacity = MAJOR_GRID_OPACITY;
      } else {
        var stepPx = step * this._scale;
        var t = Math.max(0, Math.min(1, (stepPx - MINOR_GRID_FADE_MIN_PX) / (MINOR_GRID_FADE_MAX_PX - MINOR_GRID_FADE_MIN_PX)));
        opacity = MINOR_GRID_OPACITY * t;
        if (opacity <= 0) continue;
      }
      ctx.strokeStyle = 'rgba(20,16,8,' + opacity + ')';
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (var x = 0; x <= LOGICAL_W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, LOGICAL_H); }
      for (var y = 0; y <= LOGICAL_H; y += step) { ctx.moveTo(0, y); ctx.lineTo(LOGICAL_W, y); }
      ctx.stroke();
    }
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
      x: Math.max(0, Math.min(LOGICAL_W, x)),
      y: Math.max(0, Math.min(LOGICAL_H, y))
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
      var isPen         = self._tool === 'pen';
      var effWidth   = isHighlighter ? self._width * HIGHLIGHTER_WIDTH_MULT : self._width;
      var effOpacity = isHighlighter ? HIGHLIGHTER_OPACITY : 1;
      // The pen's first point has no prior point to compute speed from, so
      // it just starts at the plain picked width — .t is still stamped so
      // the SECOND point (first pointermove) has something to measure
      // speed against. See _widthFromVelocity.
      var startPt = isPen ? { x: pos.x, y: pos.y, t: (global.performance || Date).now(), w: effWidth } : pos;
      var strokeId = genId();
      self._activePtrs[e.pointerId] = {
        strokeId: strokeId, points: [startPt], pending: [startPt], lastSentAt: 0, lastSentPos: null,
        width: effWidth, opacity: effOpacity, isPen: isPen
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
        var newPt = pos;
        if (st.isPen) {
          var prevPt = st.points[st.points.length - 1];
          newPt = { x: pos.x, y: pos.y, t: (global.performance || Date).now() };
          newPt.w = _widthFromVelocity(st.width, prevPt, newPt);
        }
        st.points.push(newPt);
        st.pending.push(newPt);
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
    var path = shape ? straightPathString(start, end, shape)
      : isVariableWidth ? variableWidthPathString(points) : smoothPathString(points);
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
    var json = isVariableWidth
      ? { path: path, fill: this._color, strokeWidth: width, opacity: opacity, centerline: points, clientStrokeId: liveKey ? liveKey.slice(2) : null }
      : { path: path, stroke: this._color, strokeWidth: width, strokeDashArray: dashArray, opacity: opacity, clientStrokeId: liveKey ? liveKey.slice(2) : null };
    this._supabase.from('whiteboard_objects').insert({
      session_id: this._sessionId,
      class_id:   this._classId,
      created_by: this._userId,
      kind: 'stroke',
      fabric_json: json
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
    var subpaths = def.build(cx, cy);
    var path = subpaths.map(function (pts) {
      return pts.map(function (p, i) { return (i === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y; }).join(' ');
    }).join(' ');
    var width = this._width;
    var self = this;
    this._supabase.from('whiteboard_objects').insert({
      session_id: this._sessionId,
      class_id:   this._classId,
      created_by: this._userId,
      kind: 'stroke',
      fabric_json: { path: path, stroke: this._color, strokeWidth: width, strokeDashArray: null, opacity: 1 }
    }).select().single().then(function (res) {
      if (self._destroyed) return;
      if (res.error) { console.error('[Whiteboard] shape insert failed', res.error); return; }
      self._addObjectIfNew(res.data);
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
        // first call, briefly racing _loadExisting's own fetch, which is
        // harmless since _addObjectIfNew already de-dupes by id — closes
        // that gap without the user ever needing to know it happened.
        if (status === 'SUBSCRIBED') self._reconcileObjects();
      });
  };

  // Safety net under the best-effort realtime push above: re-derives local
  // state from the DB's own current row set rather than trusting that every
  // INSERT/DELETE this client should have seen actually arrived. Cheap (ids
  // only) and non-destructive to anything genuinely still current — only
  // touches objects that have actually drifted out of sync.
  Whiteboard.prototype._reconcileObjects = function () {
    var self = this;
    this._supabase.from('whiteboard_objects').select('id').eq('session_id', this._sessionId)
      .then(function (res) {
        if (self._destroyed || res.error) return;
        var serverIds = {};
        (res.data || []).forEach(function (r) { serverIds[r.id] = true; });
        // A local object the server no longer has — its DELETE never made it
        // to this client (see the comment at the SUBSCRIBED callback above).
        self._fabricCanvas.getObjects().slice().forEach(function (obj) {
          if (obj.data && obj.data.id && !serverIds[obj.data.id]) self._removeObjectById(obj.data.id);
        });
        // The reverse case — a row the server has that this client missed
        // entirely (a dropped INSERT) — fetched and added the same way
        // _loadExisting hydrates the board initially.
        var missingIds = Object.keys(serverIds).filter(function (id) { return !self._committedIds.has(id); });
        if (missingIds.length) {
          self._supabase.from('whiteboard_objects').select('*').in('id', missingIds)
            .order('seq', { ascending: true })
            .then(function (res2) {
              if (self._destroyed || res2.error) return;
              (res2.data || []).forEach(function (row) { self._addObjectIfNew(row); });
              self._fabricCanvas.requestRenderAll();
            });
        }
        self._fabricCanvas.requestRenderAll();
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
    // Variable-width pen strokes (see _commitStroke) are a FILLED outline,
    // not a stroked centerline — j.fill is only ever set for those, never
    // alongside j.stroke.
    var path = new fabric.Path(j.path, {
      stroke: j.fill ? null : j.stroke,
      strokeWidth: j.strokeWidth,
      strokeDashArray: j.strokeDashArray || null, // dashed-line tool only — see _commitStroke
      opacity: j.opacity == null ? 1 : j.opacity,
      fill: j.fill || null,
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
      // Preference order: rawPoints (my own fresh commit, still in memory)
      // -> j.centerline (a variable-width pen stroke reloaded from
      // history — its ORIGINAL points, saved exactly for this) ->
      // parsePathPoints (every other reloaded stroke's only remaining
      // record — see that function's own comment).
      this._myPathPoints.set(row.id, rawPoints || (j.centerline && j.centerline.length ? j.centerline : parsePathPoints(j.path)));
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
      // A variable-width pen stroke is recognizable by its own points
      // carrying .w (set in _bindPointerEvents' pen branch and, for
      // someone else's live stroke, round-tripped through the broadcast
      // payload unchanged) — no separate flag needed on the entry itself.
      if (st.shape) drawStraightStroke(ctx, st.points[0], st.points[st.points.length - 1], st.color, st.width, st.opacity, st.shape);
      else if (st.points.length && st.points[0].w != null) drawVariableWidthStroke(ctx, st.points, st.color);
      else drawSmoothStroke(ctx, st.points, st.color, st.width, st.opacity);
    });
    this._drawSelectionOverlay(ctx);
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
    var objsById = {};
    this._fabricCanvas.getObjects().forEach(function (o) { if (o.data) objsById[o.data.id] = o; });
    var boxes = [];
    this._selectedIds.forEach(function (id) {
      var pts = self._myTranslatedPoints(id);
      var obj = objsById[id];
      if (!pts || !obj) return;
      var b = self._myObjectBounds(id);
      if (b) boxes.push(b);
      // A translucent halo drawn ALONG the stroke's own points, just
      // barely wider than the ink itself — reads as a thin outline right
      // at the edge of the exact shape (a straight line/arrow's halo is
      // just its shaft; the arrowhead barbs aren't in the cached hit-test
      // points either, a minor cosmetic gap, not a hit-testing one)
      // rather than a thick highlighter-like glow.
      drawSmoothStroke(ctx, pts, 'rgba(37,99,235,0.45)', (obj.strokeWidth || 2) + 3, 1);
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
    if (this._shapeDocClickHandler) document.removeEventListener('click', this._shapeDocClickHandler);
    if (this._shapeScrollCloseHandler) global.removeEventListener('scroll', this._shapeScrollCloseHandler, true);
    if (this._channel) this._supabase.removeChannel(this._channel);
    if (this._fabricCanvas) this._fabricCanvas.dispose();
    if (this._wrap && this._wrap.parentNode) this._wrap.parentNode.removeChild(this._wrap);
  };

  global.Whiteboard = Whiteboard;

})(window);
