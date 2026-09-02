/* ============================================================
   GeometryFigureEditor — Fabric.js-based diagram editor for the
   admin "Adaugă exercițiu" wizard's Geometrie-only "Desenează
   figura" step. Purely a visual aid for students (never AI-graded):
   preset 2D/3D shapes with draggable vertices, a segment tool with
   vertex/midpoint snapping, geometry annotations (right angle, arc,
   tick marks), text labels, and a theme-agnostic role-color model
   exported as an inline SVG that re-colors with the site's existing
   dark/light theme switch.
   ============================================================ */

(function (global) {
  'use strict';

  if (typeof fabric === 'undefined') {
    console.error('GeometryFigureEditor: fabric.js not loaded (expected js/vendor/fabric.min.js before this script)');
    return;
  }

  var GRID_VISIBLE_KEY = 'mathorizon:gfe-grid-visible';
  var SNAP_GRID_KEY    = 'mathorizon:gfe-snap-to-grid';
  var SNAP_PX          = 13;   // screen-space snap radius, independent of zoom
  var EDGE_PX          = 14;   // screen-space "near a segment" radius for the tick tool
  // Matches .gfe-canvas-wrap--grid's CSS cell size exactly (css/style.css) so
  // "snap to grid" lands on the same intersections the visible grid draws —
  // fixed in canvas units, not zoom-adjusted, since the CSS background is
  // itself a screen-fixed pattern that doesn't rescale with zoom either.
  var GRID_CELL_PX = 24;
  var MIN_ZOOM = 0.4, MAX_ZOOM = 3, ZOOM_STEP = 0.2;
  var RIGHT_ANGLE_SNAP_DEG = 5;   // how close to exactly 90° a segment's live angle has to be, against a direction it started on, to snap
  var RIGHT_ANGLE_MARK_PX  = 11;  // screen-space size of the little "⌐" indicator square, independent of zoom

  // Default/"adaptive" role colors — mirrors DrawingCanvas._adaptColors()'s
  // black⇄white swatch approach. These are only used for the LIVE editing
  // canvas (a <canvas> 2D context can't read CSS custom properties); the
  // exported SVG instead embeds var(--text)/var(--text-secondary) directly
  // so the student-facing page re-colors for free with the site theme.
  var ROLE_LIGHT = { primary: '#1C1917', auxiliary: '#6b6459' };
  var ROLE_DARK  = { primary: '#e5e7eb', auxiliary: '#9ca3af' };
  var HANDLE_COLOR = '#3B82F6';   // transient snap feedback / segment preview only
  var VERTEX_COLOR = '#ec4899';   // reshape-this-point controls (pink/magenta, matches IDroo)
  var SCALE_COLOR  = '#22c55e';   // whole-shape uniform resize controls (green)
  var ROTATE_COLOR = '#3B82F6';   // whole-shape rotate control (blue)

  fabric.Object.prototype.transparentCorners = false;
  fabric.Object.prototype.cornerColor        = HANDLE_COLOR;
  fabric.Object.prototype.cornerStrokeColor  = '#ffffff';
  fabric.Object.prototype.borderColor        = HANDLE_COLOR;
  fabric.Object.prototype.cornerSize         = 9;
  fabric.Object.prototype.cornerStyle        = 'circle';

  /* ---- geometry helpers (module-scope, no editor state needed) ---- */

  function unitVec(to, from) {
    var dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  function distToSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    var cx = a.x + t * dx, cy = a.y + t * dy;
    return Math.hypot(p.x - cx, p.y - cy);
  }

  function buildArcPoints(center, r, a1, a2, segments) {
    var diff = a2 - a1;
    while (diff > Math.PI)  diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    var pts = [];
    for (var i = 0; i <= segments; i++) {
      var a = a1 + diff * (i / segments);
      pts.push({ x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
    }
    return pts;
  }

  function ellipseArcPoints(cx, cy, rx, ry, fromT, toT, segments) {
    var pts = [];
    for (var i = 0; i <= segments; i++) {
      var t = fromT + (toT - fromT) * (i / segments);
      pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
    }
    return pts;
  }

  function mostPerpendicularPair(dirs) {
    var best = null, bestScore = Infinity;
    for (var i = 0; i < dirs.length; i++) {
      for (var j = i + 1; j < dirs.length; j++) {
        var dot = Math.abs(dirs[i].x * dirs[j].x + dirs[i].y * dirs[j].y);
        if (dot < bestScore) { bestScore = dot; best = [dirs[i], dirs[j]]; }
      }
    }
    return best || [dirs[0] || { x: 1, y: 0 }, { x: 0, y: -1 }];
  }

  function tickMarkLines(p1, p2, count, color) {
    var dx = p2.x - p1.x, dy = p2.y - p1.y;
    var len = Math.hypot(dx, dy) || 1;
    var d = { x: dx / len, y: dy / len };
    var n = { x: -d.y, y: d.x };
    var mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    var spacing = 5, tickLen = 9;
    var lines = [];
    for (var i = 0; i < count; i++) {
      var offset = (i - (count - 1) / 2) * spacing;
      var cx = mid.x + d.x * offset, cy = mid.y + d.y * offset;
      lines.push(new fabric.Line([
        cx + n.x * tickLen / 2, cy + n.y * tickLen / 2,
        cx - n.x * tickLen / 2, cy - n.y * tickLen / 2
      ], { stroke: color, strokeWidth: 2 }));
    }
    return lines;
  }

  function genId() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ---- Fabric.Polygon vertex-editing controls (canonical Fabric.js
     "editable polygon" recipe) — attached per-instance since the number
     of controls depends on that polygon's own point count. Snapping is
     wired in here via fabricObject.canvas.__gfe (the owning editor
     instance), stashed on the canvas at construction time. ---- */

  function polygonPositionHandler(dim, finalMatrix, fabricObject) {
    var x = fabricObject.points[this.pointIndex].x - fabricObject.pathOffset.x;
    var y = fabricObject.points[this.pointIndex].y - fabricObject.pathOffset.y;
    return fabric.util.transformPoint(
      { x: x, y: y },
      fabric.util.multiplyTransformMatrices(
        fabricObject.canvas.viewportTransform,
        fabricObject.calcTransformMatrix()
      )
    );
  }

  function polygonActionHandler(eventData, transform, x, y) {
    var polygon = transform.target;
    var currentControl = polygon.controls[polygon.__corner];
    var mouseLocalPosition = polygon.toLocalPoint(new fabric.Point(x, y), 'center', 'center');
    var polygonBaseSize = polygon._getNonTransformedDimensions();
    var size = polygon._getTransformedDimensions(0, 0);
    var finalPointPosition = {
      x: mouseLocalPosition.x * polygonBaseSize.x / size.x + polygon.pathOffset.x,
      y: mouseLocalPosition.y * polygonBaseSize.y / size.y + polygon.pathOffset.y
    };

    var editor = polygon.canvas && polygon.canvas.__gfe;
    if (editor) {
      try {
        var absPt = fabric.util.transformPoint(
          { x: finalPointPosition.x - polygon.pathOffset.x, y: finalPointPosition.y - polygon.pathOffset.y },
          polygon.calcTransformMatrix()
        );
        var snapped = editor._trySnap(absPt, polygon);
        if (snapped) {
          var inv = fabric.util.invertTransform(polygon.calcTransformMatrix());
          var localPt = fabric.util.transformPoint(snapped, inv);
          finalPointPosition = { x: localPt.x + polygon.pathOffset.x, y: localPt.y + polygon.pathOffset.y };
        }
      } catch (err) { /* never let a snapping bug break vertex dragging */ }
    }

    polygon.points[currentControl.pointIndex] = finalPointPosition;
    return true;
  }

  // Deliberately NOT recomputing the polygon's left/top/width/height/pathOffset
  // to keep some "anchor" corner fixed after a vertex edit (the textbook
  // Fabric.js polygon-editing recipe does this via the private, version-
  // fragile _setPositionDimensions — verified against this vendored v5.3.0
  // build to blow up into huge bogus coordinates). Rendering and control-handle
  // positioning both derive purely from `points` relative to the SAME
  // pathOffset/transform, so they stay in sync regardless; the only cost is a
  // stale bounding box if the shape is rotated/scaled as a whole afterward
  // (rare for a figure that's mostly built via per-vertex dragging), which is
  // an acceptable trade for not depending on an unstable private API.
  // Recomputes a Polygon's width/height/pathOffset from its CURRENT .points
  // after a vertex edit, compensating left/top so the rendered shape doesn't
  // visually jump — without this, width/height stay frozen at insertion-time
  // values, which vertex-editing math itself doesn't care about (it works in
  // scale-independent RATIOS that cancel the staleness out), but the native
  // border/scale-controls DO care, since they size themselves directly off
  // width*scaleX/height*scaleY — hence the green box drifting out of sync
  // with the actual reshaped polygon until the next reload recomputed it.
  function recomputePolygonBounds(poly) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    poly.points.forEach(function (p) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    var newOffsetX = (minX + maxX) / 2, newOffsetY = (minY + maxY) / 2;
    var dx = newOffsetX - poly.pathOffset.x, dy = newOffsetY - poly.pathOffset.y;
    // A pathOffset shift moves each raw point's local coordinate by -Δ, so the
    // object's CENTER (the fixed reference calcTransformMatrix() translates
    // to — see M(0,0) == center identity) must move by +R*S*Δ to keep every
    // point's ABSOLUTE position unchanged. Computing that target center here,
    // then handing it to setPositionByOrigin (below) rather than hand-deriving
    // left/top ourselves, is what actually matters: for a non-'center' origin,
    // left/top depend on width/height too, and width/height are ALSO changing
    // in this same function — setPositionByOrigin recomputes left/top against
    // the NEW width/height to hit the target, which a raw "left += rdx" (the
    // original, buggy version of this function) silently failed to account for.
    var oldCenter = poly.getCenterPoint();
    if (dx || dy) {
      var angle = fabric.util.degreesToRadians(poly.angle || 0);
      var cos = Math.cos(angle), sin = Math.sin(angle);
      var sdx = dx * poly.scaleX, sdy = dy * poly.scaleY;
      oldCenter.x += sdx * cos - sdy * sin;
      oldCenter.y += sdx * sin + sdy * cos;
    }
    poly.pathOffset = { x: newOffsetX, y: newOffsetY };
    poly.width  = maxX - minX;
    poly.height = maxY - minY;
    poly.setPositionByOrigin(oldCenter, 'center', 'center');
  }

  // A whole-shape resize (dragging a green corner/edge handle, as opposed to
  // dragging one pink vertex) leaves scaleX/scaleY non-1 while .points stays
  // in its original, unscaled local coordinates — Fabric bakes that
  // anisotropic stretch into a transform matrix at export time instead of
  // into the geometry. strokeUniform (vector-effect="non-scaling-stroke")
  // masks the effect on the live canvas AND in a raw export, but
  // normalizeStrokeWidthInSvg deliberately strips that attribute for static
  // exports (see its comment) — once stripped, a leftover non-uniform
  // transform visibly thickens whichever edges are more aligned with the
  // more-stretched axis (e.g. a trapezoid's legs after widening it; a
  // square's edges after turning it into a non-square rectangle). Baking
  // the scale into .points and resetting scaleX/scaleY to 1 keeps every
  // edge's stroke isotropic no matter how non-uniformly the shape was
  // resized. Vertex-dragging (which never touches scaleX/scaleY) is
  // unaffected — this is a no-op whenever scaleX/scaleY are already 1.
  function bakePolygonScale(poly) {
    if (poly.scaleX === 1 && poly.scaleY === 1) return;
    var oldCenter = poly.getCenterPoint();
    var sx = poly.scaleX, sy = poly.scaleY;
    poly.points = poly.points.map(function (p) { return { x: p.x * sx, y: p.y * sy }; });
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    poly.points.forEach(function (p) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    poly.pathOffset = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    poly.width  = maxX - minX;
    poly.height = maxY - minY;
    poly.set({ scaleX: 1, scaleY: 1 });
    poly.setPositionByOrigin(oldCenter, 'center', 'center');
  }

  // Same anisotropic-scale bug as bakePolygonScale above, but a Rect's
  // geometry is just width/height (with a left/top origin, so growing them
  // never needs to reposition the shape) — bake scaleX/scaleY into those
  // directly instead of a points array.
  function bakeRectScale(rect) {
    if (rect.scaleX === 1 && rect.scaleY === 1) return;
    rect.set({ width: rect.width * rect.scaleX, height: rect.height * rect.scaleY, scaleX: 1, scaleY: 1 });
  }

  function refreshCoordsWrapper(fn) {
    return function (eventData, transform, x, y) {
      // Deliberately NOT calling recomputePolygonBounds here: this actionHandler
      // runs on EVERY mousemove tick during a single drag, and pathOffset/left/top
      // are read by THIS SAME handler (via polygon.pathOffset in polygonActionHandler)
      // on the very next tick — recomputing mid-drag made each tick reference an
      // already-shifted baseline, compounding into wildly wrong bounds after a few
      // ticks (worst when the shape was previously rotated). Bounds are recomputed
      // exactly once, after the drag completes, from the 'object:modified' handler.
      var result = fn(eventData, transform, x, y);
      transform.target.setCoords();
      return result;
    };
  }

  // Snaps the raw pointer position fed into the rotate control's
  // actionHandler to the nearest grid intersection before handing off to
  // Fabric's own handler — rotation angle is a direct, unconstrained
  // function of (x,y) (atan2 of the point relative to center), so
  // pre-snapping the input lands the output on the grid too, the same way
  // vertex dragging does.
  function withGridSnapDirect(handler) {
    return function (eventData, transform, x, y) {
      var editor = transform.target.canvas && transform.target.canvas.__gfe;
      if (editor && editor._snapToGrid) {
        var snapped = editor._snapPointToGrid({ x: x, y: y });
        x = snapped.x; y = snapped.y;
      }
      return handler(eventData, transform, x, y);
    };
  }

  var EDGE_MIDPOINT_CORNERS = { ml: ['tl', 'bl'], mr: ['tr', 'br'], mt: ['tl', 'tr'], mb: ['bl', 'br'] };

  // Where a scale control (corner or edge-midpoint) actually IS right now —
  // aCoords only has the 4 true corners, so an edge-midpoint's position is
  // the midpoint between its two adjacent corners.
  function _scaleHandlePoint(target, key) {
    if (target.aCoords[key]) return target.aCoords[key];
    var pair = EDGE_MIDPOINT_CORNERS[key];
    if (!pair) return null;
    var a = target.aCoords[pair[0]], b = target.aCoords[pair[1]];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  // All of a Polygon/3D-Group's REAL vertices, in absolute canvas space —
  // bias-free, unlike aCoords (see below).
  function _realVertices(target) {
    if (target.type === 'polygon' && target.points) {
      var m = target.calcTransformMatrix();
      return target.points.map(function (p) {
        return fabric.util.transformPoint({ x: p.x - target.pathOffset.x, y: p.y - target.pathOffset.y }, m);
      });
    }
    if (target.type === 'group' && target.data && target.data.points) {
      var gm = target.calcTransformMatrix();
      return Object.keys(target.data.points).map(function (k) {
        return fabric.util.transformPoint(target.data.points[k], gm);
      });
    }
    return null;
  }

  // A scale handle's true grid-snap target — for a Rect/Circle, the
  // bounding-box point from _scaleHandlePoint IS the real geometry, so it's
  // used directly (same as vertex dragging would land on, since there's no
  // separate "vertex" concept). For a Polygon/Group, though, aCoords is
  // computed with a strokeWidth-ish padding baked in that its real vertices
  // don't have (same bias _reattach's move-snap fix already had to work
  // around) — AND the box corner/midpoint being dragged often isn't a real
  // vertex to begin with (e.g. a triangle's apex sits at its box's top-
  // middle, not at either top corner). Snapping the box point directly, as
  // the corner/rotate handlers already do, would land the (invisible) box
  // edge on the grid a pixel or so away from the actual point a user is
  // trying to align — exactly the mismatch vertex-dragging (which snaps the
  // real point) vs. scale-dragging (which snapped the box instead) produced.
  // Using whichever real vertex is nearest to the box point instead makes
  // scale-dragging land on the exact same grid point vertex-dragging would.
  function _scaleSnapTarget(target, key) {
    var boxPt = _scaleHandlePoint(target, key);
    if (!boxPt) return null;
    var verts = _realVertices(target);
    if (!verts || !verts.length) return boxPt;
    var best = verts[0], bestDist = Infinity;
    verts.forEach(function (v) {
      var d = Math.hypot(v.x - boxPt.x, v.y - boxPt.y);
      if (d < bestDist) { bestDist = d; best = v; }
    });
    return best;
  }

  // Scale controls are rendered pushed outward from the shape's true edge by
  // SCALE_PUSH (see styleScaleAndRotateControls, below) so they don't
  // collide with the pink vertex handles at the same spot — and Fabric's
  // scale handlers move the dragged point by the SAME delta the mouse
  // moved, not to the mouse's absolute position. So naively pre-snapping
  // the raw input the way withGridSnapDirect does for rotate would just
  // re-introduce that same fixed SCALE_PUSH offset into the result instead
  // of landing on the grid. Instead: run the handler with the raw input to
  // get the natural (unsnapped) result, measure where the dragged point
  // actually landed, and re-run with the input nudged by exactly the delta
  // needed to land that point on the grid instead. The mouse-delta-to-
  // point-delta relationship is close to 1:1 but not exactly — strokeUniform
  // keeps the on-screen stroke width constant regardless of scale, which
  // makes the true relationship slightly non-linear — so one correction
  // pass typically lands within a fraction of a pixel but not always exactly
  // 0; a couple more passes, re-measuring the ACTUAL result each time rather
  // than assuming linearity, squeeze the residual down to sub-hundredth-
  // pixel, well under anything a display could actually render as a gap.
  function withGridSnapScale(handler) {
    return function (eventData, transform, x, y) {
      var result = handler(eventData, transform, x, y);
      var target = transform.target;
      var editor = target.canvas && target.canvas.__gfe;
      if (editor && editor._snapToGrid && result) {
        var cx = x, cy = y;
        for (var i = 0; i < 4; i++) {
          target.setCoords();
          var pt = _scaleSnapTarget(target, transform.corner);
          if (!pt) break;
          var dx = Math.round(pt.x / GRID_CELL_PX) * GRID_CELL_PX - pt.x;
          var dy = Math.round(pt.y / GRID_CELL_PX) * GRID_CELL_PX - pt.y;
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) break;
          cx += dx; cy += dy;
          handler(eventData, transform, cx, cy);
        }
      }
      return result;
    };
  }


  function attachPolygonVertexControls(poly) {
    poly.objectCaching = false;
    poly.controls = Object.assign({}, poly.controls);
    poly.points.forEach(function (point, index) {
      poly.controls['p' + index] = new fabric.Control({
        positionHandler: polygonPositionHandler,
        actionHandler: refreshCoordsWrapper(polygonActionHandler),
        actionName: 'modifyPolygon',
        pointIndex: index,
        cursorStyle: 'pointer',
        sizeX: 12, sizeY: 12,
        render: renderVertexControl
      });
    });
    styleScaleAndRotateControls(poly); // adds/restyles the native scale (green) + rotate (blue) controls alongside the vertex ones above
  }

  function circleRadiusPositionHandler(dim, finalMatrix, fabricObject) {
    return fabric.util.transformPoint(
      { x: fabricObject.radius, y: 0 },
      fabric.util.multiplyTransformMatrices(fabricObject.canvas.viewportTransform, fabricObject.calcTransformMatrix())
    );
  }

  // Horizontal distance only — same "stays on the horizontal through
  // origin" convention as the sphere's own radius handle. Besides making
  // the drag predictable, it means grid-snapping only has to land the one
  // (x) coordinate on the grid, and since the center is a grid point too
  // (insertion/move already keep it one), the resulting radius comes out
  // as a whole multiple of the grid — so all 4 cardinal points end up on
  // the grid, not just the one actually dragged.
  function circleRadiusActionHandler(eventData, transform, x, y) {
    var circle = transform.target;
    var center = circle.getCenterPoint();
    var newRadius = Math.max(10, Math.abs(x - center.x));
    // left = center - radius LOOKS right, but strokeUniform makes Fabric's
    // actual rendered/measured dimensions include a strokeWidth contribution
    // that plain left/radius arithmetic doesn't account for — every call
    // was drifting the center by ~1px (compounding across repeated drags in
    // the same gesture) for exactly that reason. Setting radius alone, then
    // measuring how far the center actually moved and correcting left/top
    // by that measured amount, sidesteps needing to know Fabric's exact
    // stroke-compensation formula.
    circle.set({ radius: newRadius });
    circle.setCoords();
    var shifted = circle.getCenterPoint();
    circle.set({ left: circle.left + (center.x - shifted.x), top: circle.top + (center.y - shifted.y) });
    circle.setCoords();
    return true;
  }

  function attachCircleUniformControls(circle) {
    circle.controls = Object.assign({}, circle.controls);
    // A single handle, growing/shrinking the circle around its own FIXED
    // center — Fabric's default bounding-box corners (the old behavior
    // here, even wrapped in scalingEqually to stop it turning into an
    // ellipse) always keep the OPPOSITE corner as anchor, so resizing from
    // any corner shifted the center off to one side. Never what you want
    // for a shape whose whole identity is "one center, one radius" — same
    // "radius" handle convention already used for the sphere/cone/cylinder.
    circle.controls.radius = new fabric.Control({
      positionHandler: circleRadiusPositionHandler,
      actionHandler: withGridSnapDirect(circleRadiusActionHandler),
      actionName: 'resizeCircleRadius',
      cursorStyle: 'ew-resize',
      sizeX: 12, sizeY: 12,
      render: renderVertexControl
    });
    // No bounding-box corners and no rotate handle (rotating a circle is a
    // visual no-op) — just the one radius handle above.
    circle.setControlsVisibility({ tl: false, tr: false, bl: false, br: false, ml: false, mt: false, mr: false, mb: false, mtr: false });
    circle.hasBorders = true;
    circle.borderColor = SCALE_COLOR;
  }

  /* ---- Segment (fabric.Line) endpoint controls — a line is neither
     "one center + one radius" (circle) nor "N vertices on a shared outline"
     (polygon); it's just two independent points. Fabric's DEFAULT controls
     for a bare Line are the same 8-corner scale-box + rotate handle every
     other shape gets, which resizes it by stretching a scaleX/scaleY
     transform (blurry with objectCaching on, and it drags the OPPOSITE
     corner as a fixed anchor rather than letting either endpoint move
     freely) — wrong model entirely for "grab an end and extend/rotate it
     around the other end, which stays a fixed pivot". These two controls
     replace the whole default set with exactly that: drag p1, p2 stays
     put (and vice versa), same pink vertex-style dot as every other
     reshape-this-point control in this editor. */
  function lineEndpointPositionHandler(dim, finalMatrix, fabricObject) {
    var lp = fabricObject.calcLinePoints();
    var local = this.pointKey === 'p1' ? { x: lp.x1, y: lp.y1 } : { x: lp.x2, y: lp.y2 };
    return fabric.util.transformPoint(
      local,
      fabric.util.multiplyTransformMatrices(fabricObject.canvas.viewportTransform, fabricObject.calcTransformMatrix())
    );
  }

  function lineEndpointActionHandler(eventData, transform, x, y) {
    var line = transform.target;
    var key = transform.corner; // 'p1' or 'p2' — whichever control is being dragged
    var pt = { x: x, y: y };
    var editor = line.canvas && line.canvas.__gfe;
    if (editor) {
      try {
        var snapped = editor._trySnap(pt, line);
        if (snapped) pt = snapped;
      } catch (err) { /* never let a snapping bug break endpoint dragging */ }
    }

    // The OTHER endpoint must stay EXACTLY where it visually is right now —
    // read its current absolute position before touching anything, the same
    // way polygonActionHandler treats every point it isn't currently moving.
    var lp = line.calcLinePoints();
    var m = line.calcTransformMatrix();
    var fixedLocal = key === 'p1' ? { x: lp.x2, y: lp.y2 } : { x: lp.x1, y: lp.y1 };
    var fixedAbs = fabric.util.transformPoint(fixedLocal, m);

    var nx1 = key === 'p1' ? pt.x : fixedAbs.x;
    var ny1 = key === 'p1' ? pt.y : fixedAbs.y;
    var nx2 = key === 'p1' ? fixedAbs.x : pt.x;
    var ny2 = key === 'p1' ? fixedAbs.y : pt.y;

    // Rewrite x1/y1/x2/y2 (the line's REAL geometry) directly and reset
    // angle/scale to identity — exactly how the line looked the moment it
    // was first drawn — instead of leaving the old geometry in place and
    // stretching a scaleX/scaleY transform over it. That's what keeps the
    // stroke crisp (no cached bitmap being scaled) and the line's actual
    // length/quality intact no matter how far it's extended.
    line.set({
      x1: nx1, y1: ny1, x2: nx2, y2: ny2,
      angle: 0, scaleX: 1, scaleY: 1,
      width: Math.abs(nx2 - nx1) || 1,
      height: Math.abs(ny2 - ny1) || 1,
      left: Math.min(nx1, nx2), top: Math.min(ny1, ny2)
    });
    alignLineToStart(line);
    return true;
  }

  function attachLineEndpointControls(line) {
    line.objectCaching = false;
    line.hasBorders = false; // no bounding-box outline — just the two pivot dots
    line.controls = Object.assign({}, line.controls);
    ['p1', 'p2'].forEach(function (key) {
      line.controls[key] = new fabric.Control({
        pointKey: key,
        positionHandler: lineEndpointPositionHandler,
        actionHandler: refreshCoordsWrapper(lineEndpointActionHandler),
        actionName: 'modifyLineEndpoint',
        cursorStyle: 'pointer',
        sizeX: 12, sizeY: 12,
        render: renderVertexControl
      });
    });
    line.setControlsVisibility({ tl: false, tr: false, bl: false, br: false, ml: false, mt: false, mr: false, mb: false, mtr: false });
  }

  /* ---- Shared control styling: green scale squares pushed slightly outside
     the real shape + one blue rotate circle above center, reused by every
     shape type so the whole toolset reads consistently (matches the IDroo
     reference: distinct handle types, distinct colors, never overlapping). */
  var SCALE_KEYS = ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'];
  var SCALE_PUSH = 10; // px — a pure rendering/click-target offset; Fabric's
                        // resize math still keys off the object's true corners

  function renderRotateControl(ctx, left, top) {
    ctx.save();
    ctx.fillStyle = ROTATE_COLOR;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(left, top, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function renderVertexControl(ctx, left, top) {
    ctx.save();
    ctx.fillStyle = VERTEX_COLOR;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(left, top, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function styleScaleAndRotateControls(obj) {
    obj.controls = Object.assign({}, obj.controls); // own copy — never mutate the shared prototype dict
    SCALE_KEYS.forEach(function (k) {
      if (!obj.controls[k]) return;
      obj.controls[k] = fabric.util.object.clone(obj.controls[k]);
      var c = obj.controls[k];
      c.offsetX = (c.x || 0) * SCALE_PUSH * 2;
      c.offsetY = (c.y || 0) * SCALE_PUSH * 2;
      c.sizeX = 9; c.sizeY = 9;
      c.actionHandler = withGridSnapScale(c.actionHandler);
    });
    if (obj.controls.mtr) {
      obj.controls.mtr = fabric.util.object.clone(obj.controls.mtr);
      obj.controls.mtr.offsetY = -(SCALE_PUSH * 2 + 30);
      obj.controls.mtr.render = renderRotateControl;
      if (fabric.controlsUtils && fabric.controlsUtils.rotationWithSnapping) {
        obj.controls.mtr.actionHandler = withGridSnapDirect(fabric.controlsUtils.rotationWithSnapping);
      }
    }
    obj.cornerColor = SCALE_COLOR;
    obj.cornerStrokeColor = '#ffffff';
    obj.borderColor = SCALE_COLOR;
    obj.transparentCorners = false;
    obj.cornerStyle = 'rect';
    obj.cornerSize = 9;
  }

  /* ---- 3D group vertex controls — same "editable point" idea as Polygon's
     controls above, but for fabric.Group (which has no .points/.pathOffset
     of its own). Points are stored LOCAL to the group (center-relative,
     unscaled) in group.data.points, so they compose correctly underneath
     whatever rotation/scale the group's own native controls apply — exactly
     mirroring how Polygon keeps .points independent of its own transform. */

  function groupVertexPositionHandler(dim, finalMatrix, fabricObject) {
    var localPt = fabricObject.data.points[this.pointKey];
    return fabric.util.transformPoint(
      { x: localPt.x, y: localPt.y },
      fabric.util.multiplyTransformMatrices(
        fabricObject.canvas.viewportTransform,
        fabricObject.calcTransformMatrix()
      )
    );
  }

  function groupVertexActionHandler(eventData, transform, x, y) {
    var group = transform.target;
    var key = group.controls[group.__corner].pointKey;
    var mouseLocal = group.toLocalPoint(new fabric.Point(x, y), 'center', 'center');
    // toLocalPoint returns pixel-space coordinates at the group's CURRENT
    // scale — divide it back out so the stored point stays in a stable,
    // scale-independent unit system (same reasoning as Polygon's own
    // baseSize/transformedSize ratio in polygonActionHandler above).
    var localPoint = { x: mouseLocal.x / group.scaleX, y: mouseLocal.y / group.scaleY };

    var editor = group.canvas && group.canvas.__gfe;
    if (editor) {
      try {
        var matrix = group.calcTransformMatrix();
        var absPt = fabric.util.transformPoint(localPoint, matrix);
        var snapped = editor._trySnap(absPt, group);
        if (snapped) {
          var inv = fabric.util.invertTransform(matrix);
          localPoint = fabric.util.transformPoint(snapped, inv);
        }
      } catch (err) { /* never let a snapping bug break vertex dragging */ }
    }

    group.data.points[key] = localPoint;
    var factory = THREE_D[group.data.kind];
    if (factory && factory.constrainHandle) {
      group.data.points[key] = factory.constrainHandle(key, group.data.points);
    }
    rebuildGroupChildren(group);
    return true;
  }

  // Rebuilds a 3D group's children IN PLACE (the group object itself is
  // never swapped out, so its attached controls/data keep working without
  // any re-wiring) from its stored local vertex points. Bakes the group's
  // CURRENT rotation/scale directly into the fresh absolute geometry and
  // resets angle/scale to identity right after — sidesteps ever needing
  // Fabric's addWithUpdate to correctly compose children with a non-identity
  // group transform mid-edit (unverified/fragile to assume), at zero visible
  // cost: the rendered shape is pixel-identical, only WHERE the rotation
  // "lives" internally shifts from group.angle into the raw coordinates.
  function rebuildGroupChildren(group) {
    var factory = THREE_D[group.data.kind];
    if (!factory) return;
    var matrix = group.calcTransformMatrix();
    var absolutePoints = {};
    Object.keys(group.data.points).forEach(function (k) {
      absolutePoints[k] = fabric.util.transformPoint(group.data.points[k], matrix);
    });

    var editor = group.canvas && group.canvas.__gfe;
    var stroke = '#1C1917';
    if (editor) {
      stroke = group.data.role === 'custom' ? editor._currentObjectColor(group) : editor._paletteColor(group.data.role);
    }

    var newChildren = factory.build(absolutePoints, stroke);
    group.getObjects().slice().forEach(function (c) { group.remove(c); });
    newChildren.forEach(function (c) { group.addWithUpdate(c); });

    group.set({ angle: 0, scaleX: 1, scaleY: 1 });
    var center = group.getCenterPoint();
    Object.keys(absolutePoints).forEach(function (k) {
      group.data.points[k] = { x: absolutePoints[k].x - center.x, y: absolutePoints[k].y - center.y };
    });
    group.setCoords();
    if (group.canvas) group.canvas.requestRenderAll();
  }

  function attachGroup3DControls(group, factory) {
    group.controls = Object.assign({}, group.controls);
    factory.handles.forEach(function (key) {
      group.controls['v_' + key] = new fabric.Control({
        positionHandler: groupVertexPositionHandler,
        actionHandler: groupVertexActionHandler,
        actionName: 'modifyGroupVertex',
        pointKey: key,
        cursorStyle: 'pointer',
        sizeX: 12, sizeY: 12,
        render: renderVertexControl
      });
    });
    styleScaleAndRotateControls(group);
    group.hasControls = true;
    group.hasBorders = true;
    group.objectCaching = false;
  }

  /* ---- 3D textbook-projection preset factories ----
     Each shape stores its FULL geometry as a set of named, independently
     draggable absolute-coordinate points (data.points on the group) — not a
     single scalar "param" — so every dimension (width/height/depth for the
     cube, each base vertex for the pyramids, radius vs. tilt for the sphere,
     radius vs. height for the cone/cylinder) gets its own handle instead of
     one handle vaguely controlling "the whole thing" along a guessed axis.
     `defaultPoints(origin)` seeds the initial layout; `handles` lists which
     point keys get a draggable circle; `build(points, stroke)` reconstructs
     every primitive purely from the current point set. */

  // Builds one fabric.Path out of several "pen strokes" (each an array of
  // points, drawn as M...L...L...) that touch at shared vertices (e.g. a
  // pyramid's apex, where 3+ edges meet). Each is its own separate Fabric
  // object gets its own independent anti-aliasing pass — two of THOSE
  // meeting at exactly the same pixel don't necessarily composite back up
  // to full opacity, which is what left a visible hairline gap at cube/
  // pyramid/cone vertices. One Path, one stroke() call, one anti-aliasing
  // pass over the whole thing — no seam is possible.
  function multiStrokePath(strokes, stroke, dashed) {
    var d = strokes.map(function (pts) {
      return pts.map(function (p, i) { return (i === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y; }).join(' ');
    }).join(' ');
    return new fabric.Path(d, {
      fill: 'transparent', stroke: stroke, strokeWidth: 2,
      strokeLineJoin: 'round', strokeLineCap: 'round',
      strokeDashArray: dashed ? [6, 5] : null,
      objectCaching: false
    });
  }

  var THREE_D = {
    cub: {
      // Every one of the 8 corners is its own handle (front F0-F3, back
      // B0-B3) — same free per-vertex editing as the pyramids, so dragging
      // any corner reshapes width/height/depth/skew independently instead
      // of one handle standing in for "the whole box".
      defaultPoints: function (o) {
        var hs = 55, dx = 40, dy = -34;
        var F = [{ x: -hs, y: -hs }, { x: hs, y: -hs }, { x: hs, y: hs }, { x: -hs, y: hs }]
          .map(function (p) { return { x: p.x + o.x, y: p.y + o.y }; });
        var pts = { F0: F[0], F1: F[1], F2: F[2], F3: F[3] };
        ['F0', 'F1', 'F2', 'F3'].forEach(function (k, i) {
          pts['B' + i] = { x: F[i].x + dx, y: F[i].y + dy };
        });
        return pts;
      },
      handles: ['F0', 'F1', 'F2', 'F3', 'B0', 'B1', 'B2', 'B3'],
      // All 12 real edges (used for the segment tool's vertex/midpoint snap
      // registry — see _buildSnapRegistry — regardless of which are
      // rendered dashed above).
      edges: [
        ['F0', 'F1'], ['F1', 'F2'], ['F2', 'F3'], ['F3', 'F0'],
        ['B0', 'B1'], ['B1', 'B2'], ['B2', 'B3'], ['B3', 'B0'],
        ['F0', 'B0'], ['F1', 'B1'], ['F2', 'B2'], ['F3', 'B3']
      ],
      // F0/F1/F2/F3 are front-top-left/top-right/bottom-right/bottom-left;
      // B0-B3 the same corners shifted back (up-right). Of the cube's 6
      // faces, front/top/right are visible from this angle and back/bottom/
      // left are hidden — an edge is dashed only if BOTH the faces it
      // borders are hidden, which happens for exactly 3 edges, all meeting
      // at the one fully-hidden corner B3 (back-bottom-left): F3-B3
      // (bottom+left), B3-B0 (left+back), B2-B3 (back+bottom). Previously
      // this dashed the whole back-face loop (B0-B1-B2-B3) instead — wrongly
      // dashing B0-B1 and B1-B2 (each borders the visible top/right face)
      // and leaving F3-B3 wrongly solid.
      build: function (pts, stroke) {
        var F = [pts.F0, pts.F1, pts.F2, pts.F3];
        var B = [pts.B0, pts.B1, pts.B2, pts.B3];
        // Front square (closed loop) + the 3 depth/back edges that border a
        // visible face — merged into one path so those joins render seamlessly.
        var solid = multiStrokePath(
          [[F[0], F[1], F[2], F[3], F[0]], [F[0], B[0]], [F[1], B[1]], [F[2], B[2]], [B[0], B[1]], [B[1], B[2]]],
          stroke, false
        );
        var hidden = multiStrokePath([[F[3], B[3]], [B[3], B[0]], [B[2], B[3]]], stroke, true);
        return [hidden, solid];
      }
    },
    'piramida-patrata': {
      // Base is a true parallelogram (front edge p0-p1 + the same depth
      // offset the cube uses for its back corners), NOT a symmetric front-on
      // diamond — a perfectly symmetric diamond put the apex, the near base
      // corner (front) AND the far base corner (back) all on the exact same
      // vertical line, so the dashed "hidden" apex-to-back edge rendered
      // directly on top of the solid apex-to-front edge (identical pixels
      // for their whole overlapping range) and simply vanished. Offsetting
      // the back corners by (dx,dy) — and the apex by half that, so it
      // still reads as centered over the whole base — guarantees no two
      // vertices ever share an x, so every edge is its own visible line.
      defaultPoints: function (o) {
        var dx = 38, dy = -32, hw = 62;
        var f0 = { x: o.x - hw, y: o.y + 40 };  // front-left (visible)
        var f1 = { x: o.x + hw, y: o.y + 40 };  // front-right (visible)
        return {
          p0: f0,
          p1: f1,
          p2: { x: f1.x + dx, y: f1.y + dy },  // back-right (visible)
          p3: { x: f0.x + dx, y: f0.y + dy },  // back-left (the ONE hidden corner)
          apex: { x: o.x + dx / 2, y: o.y - 95 }
        };
      },
      handles: ['p0', 'p1', 'p2', 'p3', 'apex'],
      edges: [['p0', 'p1'], ['p1', 'p2'], ['p2', 'p3'], ['p3', 'p0'], ['apex', 'p0'], ['apex', 'p1'], ['apex', 'p2'], ['apex', 'p3']],
      build: function (pts, stroke) {
        var p0 = pts.p0, p1 = pts.p1, p2 = pts.p2, p3 = pts.p3, apex = pts.apex;
        // Solid: visible base edge (p0-p1-p2) + the 3 edges down to it from
        // the apex — all meet at p0/p1/p2/apex, merged so those joins seal.
        var solid = multiStrokePath([[p0, p1, p2], [apex, p0], [apex, p1], [apex, p2]], stroke, false);
        // Dashed: hidden base edge (p2-p3-p0) + the one hidden apex edge,
        // sharing p3.
        var dashedPath = multiStrokePath([[p2, p3, p0], [apex, p3]], stroke, true);
        return [dashedPath, solid];
      }
    },
    'piramida-triunghiulara': {
      defaultPoints: function (o) {
        return {
          p0: { x: o.x - 60, y: o.y + 22 },
          p1: { x: o.x + 60, y: o.y + 22 },
          p2: { x: o.x, y: o.y - 18 },
          apex: { x: o.x, y: o.y - 113 }
        };
      },
      handles: ['p0', 'p1', 'p2', 'apex'],
      edges: [['p0', 'p1'], ['p1', 'p2'], ['p2', 'p0'], ['apex', 'p0'], ['apex', 'p1'], ['apex', 'p2']],
      build: function (pts, stroke) {
        var p0 = pts.p0, p1 = pts.p1, p2 = pts.p2, apex = pts.apex;
        // Solid: front base edge + the 2 edges down to it from the apex —
        // meet at p0/p1/apex.
        var solid = multiStrokePath([[p0, p1], [apex, p0], [apex, p1]], stroke, false);
        // Dashed: the two hidden base edges (sharing p2) + the hidden apex
        // edge (also sharing p2).
        var dashedPath = multiStrokePath([[p1, p2, p0], [apex, p2]], stroke, true);
        return [dashedPath, solid];
      }
    },
    sfera: {
      defaultPoints: function (o) {
        return {
          origin:  { x: o.x, y: o.y },
          radius:  { x: o.x + 55, y: o.y },     // handle: sphere radius (stays on the horizontal through origin)
          equator: { x: o.x, y: o.y + 12.6 }    // handle: equator tilt/flatten (stays on the vertical through origin)
        };
      },
      handles: ['radius', 'equator'],
      // Both handles only ever encode ONE meaningful axis (radius: distance
      // right of origin; equator: distance below origin) — the other axis
      // is meaningless, so left un-constrained it drifts wherever the mouse
      // happened to be and visually "floats away" from the sphere. Snapping
      // it back onto that single axis after every drag keeps it stuck to
      // the shape it's actually resizing (called from groupVertexActionHandler).
      constrainHandle: function (key, pts) {
        var o = pts.origin;
        if (key === 'radius') return { x: o.x + Math.max(15, pts.radius.x - o.x), y: o.y };
        if (key === 'equator') {
          var R = Math.max(15, pts.radius.x - o.x);
          return { x: o.x, y: o.y + Math.max(4, Math.min(R - 2, Math.abs(pts.equator.y - o.y))) };
        }
        return pts[key];
      },
      build: function (pts, stroke) {
        var o = pts.origin;
        var R = Math.max(15, pts.radius.x - o.x);
        var ry = Math.max(4, Math.min(R - 2, Math.abs(pts.equator.y - o.y)));
        var circle = new fabric.Circle({ left: o.x - R, top: o.y - R, radius: R, fill: 'transparent', stroke: stroke, strokeWidth: 2, objectCaching: false });
        var front = ellipseArcPoints(o.x, o.y, R, ry, 0, Math.PI, 20);
        var back  = ellipseArcPoints(o.x, o.y, R, ry, Math.PI, 2 * Math.PI, 20);
        var eqFront = new fabric.Polyline(front, { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeLineJoin: 'round', objectCaching: false });
        var eqBack  = new fabric.Polyline(back,  { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5], strokeLineJoin: 'round', objectCaching: false });
        return [circle, eqBack, eqFront];
      }
    },
    con: {
      defaultPoints: function (o) {
        return {
          origin: { x: o.x, y: o.y },
          apex:   { x: o.x, y: o.y - 60 },
          radius: { x: o.x + 55, y: o.y + 30 }   // handle: base radius + base height (both axes meaningful, already stays on the base's own edge)
        };
      },
      handles: ['apex', 'radius'],
      // radius.y is used directly (base height) so that axis is already
      // correct; only clamp .x so dragging past origin can't flip the
      // handle to the wrong (left) side of a still-positive rx.
      constrainHandle: function (key, pts) {
        if (key === 'radius') {
          var o = pts.origin;
          return { x: o.x + Math.max(15, pts.radius.x - o.x), y: pts.radius.y };
        }
        return pts[key];
      },
      build: function (pts, stroke) {
        var o = pts.origin;
        var rx = Math.max(15, pts.radius.x - o.x);
        var ry = rx * 0.29;
        var baseY = pts.radius.y;
        var apex = pts.apex;
        // The base circle's far half is hidden behind the cone's own lateral
        // surface from this angle — same convention as the sphere's equator
        // (see sfera.build) — front/near half solid, back/far half dashed,
        // instead of a single uniformly-solid ellipse.
        var baseFront = new fabric.Polyline(ellipseArcPoints(o.x, baseY, rx, ry, 0, Math.PI, 20), { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeLineJoin: 'round', objectCaching: false });
        var baseBack  = new fabric.Polyline(ellipseArcPoints(o.x, baseY, rx, ry, Math.PI, 2 * Math.PI, 20), { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5], strokeLineJoin: 'round', objectCaching: false });
        // Both slants share the apex — merged into one path so that join seals.
        var slants = multiStrokePath([[{ x: o.x - rx, y: baseY }, apex, { x: o.x + rx, y: baseY }]], stroke, false);
        return [baseBack, baseFront, slants];
      }
    },
    cilindru: {
      defaultPoints: function (o) {
        return {
          origin: { x: o.x, y: o.y },
          top:    { x: o.x + 55, y: o.y - 50 },  // handle: radius + top height
          bottom: { x: o.x, y: o.y + 50 }        // handle: bottom height (x is meaningless — constrained back to center)
        };
      },
      handles: ['top', 'bottom'],
      constrainHandle: function (key, pts) {
        var o = pts.origin;
        if (key === 'top')    return { x: o.x + Math.max(15, pts.top.x - o.x), y: pts.top.y };
        if (key === 'bottom') return { x: o.x, y: pts.bottom.y };
        return pts[key];
      },
      build: function (pts, stroke) {
        var o = pts.origin;
        var rx = Math.max(15, pts.top.x - o.x);
        var ry = rx * 0.29;
        var topY = pts.top.y, botY = pts.bottom.y;
        // Top rim has nothing above it to block the view, so it stays one
        // uniformly-solid ellipse. The bottom rim's far half is hidden behind
        // the cylinder's own lateral surface, same convention as the cone's
        // base / the sphere's equator (see sfera.build) — front/near half
        // solid, back/far half dashed.
        var top = new fabric.Ellipse({ left: o.x - rx, top: topY - ry, rx: rx, ry: ry, fill: 'transparent', stroke: stroke, strokeWidth: 2, objectCaching: false });
        var botFront = new fabric.Polyline(ellipseArcPoints(o.x, botY, rx, ry, 0, Math.PI, 20), { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeLineJoin: 'round', objectCaching: false });
        var botBack  = new fabric.Polyline(ellipseArcPoints(o.x, botY, rx, ry, Math.PI, 2 * Math.PI, 20), { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5], strokeLineJoin: 'round', objectCaching: false });
        var lineL = new fabric.Line([o.x - rx, topY, o.x - rx, botY], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round', objectCaching: false });
        var lineR = new fabric.Line([o.x + rx, topY, o.x + rx, botY], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round', objectCaching: false });
        return [botBack, top, botFront, lineL, lineR];
      }
    }
  };

  var SHAPE_LABELS = {
    'tri-isoscel': 'Triunghi isoscel', 'tri-echilateral': 'Triunghi echilateral', 'tri-oarecare': 'Triunghi oarecare',
    cerc: 'Cerc', patrat: 'Pătrat', paralelogram: 'Paralelogram',
    'trapez-isoscel': 'Trapez isoscel', 'trapez-dreptunghic': 'Trapez dreptunghic', romb: 'Romb',
    cub: 'Cub', 'piramida-patrata': 'Piramidă (bază pătrată)', 'piramida-triunghiulara': 'Piramidă (bază triunghiulară)',
    sfera: 'Sferă', con: 'Con', cilindru: 'Cilindru'
  };

  // Small outline glyphs (viewBox 0 0 24 24, stroke=currentColor) matching
  // DrawingCanvas's pen/eraser icon style — 2D shapes as plain outlines, 3D
  // solids as simplified versions of the same oblique-projection convention
  // used for the actual inserted shapes (offset/second face + dashed hidden
  // edges), just legible at icon scale.
  var SHAPE_ICONS = {
    // Tall/narrow silhouette — shape alone (vs. the wide/flat equilateral
    // below) already tells the two apart, no equal-side tick marks needed.
    'tri-isoscel':    '<path d="M12 3 5 20 19 20Z"/>',
    // Wide/flat silhouette (true 60-60-60 proportions).
    'tri-echilateral':'<path d="M12 6 3.5 19 20.5 19Z"/>',
    'tri-oarecare':   '<path d="M15 4 3 20 21 17Z"/>',
    cerc:             '<circle cx="12" cy="12" r="8.5"/>',
    patrat:           '<rect x="4.5" y="4.5" width="15" height="15"/>',
    paralelogram:     '<path d="M8 6 20 6 16 18 4 18Z"/>',
    'trapez-isoscel': '<path d="M9 6 15 6 20 18 4 18Z"/>',
    'trapez-dreptunghic': '<path d="M6 6 15 6 20 18 6 18Z"/>',
    // Elongated (not a square just tilted) — vertical diagonal roughly
    // double the horizontal one, so it reads unambiguously as a rhombus.
    romb:             '<path d="M12 2 17 12 12 22 7 12Z"/>',
    // Front face solid (the closed square) + the 2 edges bordering a
    // visible face (back-top, back-right) ALSO solid — only the back-left
    // edge, back-bottom edge, and the connector down to that one fully-
    // hidden back-bottom-left corner are dashed. (Was inverted before —
    // the back-top/back-right edges were dashed and the truly-hidden ones
    // weren't drawn at all.)
    cub: '<path d="M4 10 14 10 14 20 4 20Z"/><path d="M9 5 19 5 19 15"/><path d="M4 10 9 5"/><path d="M14 10 19 5"/><path d="M14 20 19 15"/><path d="M4 20 9 15 9 5" stroke-dasharray="2.2 2"/><path d="M9 15 19 15" stroke-dasharray="2.2 2"/>',
    // Front base edge + the 2 apex edges down to it solid; the 3 edges to
    // the single hidden back corner dashed — same convention as the cube
    // above (was inverted the same way).
    'piramida-patrata': '<path d="M4 18 20 18"/><path d="M12 3 4 18"/><path d="M12 3 20 18"/><path d="M12 3 12 13" stroke-dasharray="2.2 2"/><path d="M12 13 4 18" stroke-dasharray="2.2 2"/><path d="M12 13 20 18" stroke-dasharray="2.2 2"/>',
    // Apex + 2 front base corners solid (outer silhouette), + a hidden
    // back corner reached only by dashed lines — same "one fully-hidden
    // vertex" convention as the actual inserted 3D shape, so this reads as
    // a solid, not a flat triangle.
    'piramida-triunghiulara': '<path d="M4 20 18 20"/><path d="M12 3 4 20"/><path d="M12 3 18 20"/><path d="M12 3 12 13" stroke-dasharray="2 1.6"/><path d="M12 13 4 20" stroke-dasharray="2 1.6"/><path d="M12 13 18 20" stroke-dasharray="2 1.6"/>',
    sfera: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 14.5C6.5 16.3 17.5 16.3 20.2 14.5"/><path d="M3.8 9.6C6.5 7.8 17.5 7.8 20.2 9.6" stroke-dasharray="2.2 2"/>',
    con: '<path d="M4.5 18a7.5 2 0 0 0 15 0"/><path d="M4.5 18a7.5 2 0 0 1 15 0" stroke-dasharray="2 1.6"/><path d="M12 4 4.5 18"/><path d="M12 4 19.5 18"/>',
    cilindru: '<path d="M4.5 7a7.5 2 0 0 0 15 0a7.5 2 0 0 0 -15 0"/><path d="M4.5 17a7.5 2 0 0 0 15 0"/><path d="M4.5 17a7.5 2 0 0 1 15 0" stroke-dasharray="2 1.6"/><path d="M4.5 7v10"/><path d="M19.5 7v10"/>'
  };

  var TOOL_ICONS = {
    select: '<path d="M5 3 5 19 9 15 12 21.5 14.7 20.2 12 14.5 17 14Z" fill="currentColor" stroke="none"/>',
    // "Hand" pan tool — palm + fingers, standard pan/scroll-tool convention.
    pan: '<rect x="6" y="11" width="12" height="9" rx="3"/><path d="M9 11V6a1.5 1.5 0 0 1 3 0v5"/><path d="M12 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M15 11.5V7a1.5 1.5 0 0 1 3 0v6"/>',
    // Same eraser glyph as DrawingCanvas's own eraser tool (js/drawing-canvas.js), reused for icon-language consistency.
    eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
    segment: '<path d="M5 19 19 5"/><circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none"/>',
    'segment-dashed': '<path d="M5 19 19 5" stroke-dasharray="3.6 3.2"/><circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none"/>',
    text: '<path d="M5 6h14"/><path d="M12 6v13"/><path d="M9 19h6"/>',
    'right-angle': '<path d="M5 5v14h14"/><path d="M5 12h7v7"/>',
    arc: '<path d="M5 19 19 19"/><path d="M5 19V5"/><path d="M9 19a10 10 0 0 1 8-9.8"/>',
    tick: '<path d="M6 4 6 20"/><path d="M12 4 12 20"/><path d="M3 9 9 9"/><path d="M3 15 9 15"/><path d="M9 9 15 9"/><path d="M9 15 15 15"/>',
    chevron: '<path d="M6 9.5 12 15.5 18 9.5" stroke-width="2.3"/>'
  };

  // Zoom/undo/redo/grid/clear — identical markup to DrawingCanvas's own
  // toolbar (js/drawing-canvas.js, DC_TOOLBAR_HTML) so these controls read
  // as the same design-system icon everywhere on the site, not a
  // similar-but-different one just for this editor.
  var DC_ICONS = {
    zoomOut: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>',
    zoomIn: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>',
    // A frame with the content sized to fit snugly inside it — reads as
    // "everything scaled to fit this view", and unlike a corner-bracket
    // glyph it can't be mistaken for the real OS-fullscreen button (which
    // uses that corner-bracket "expand" shape elsewhere on this same page).
    fit: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="7.2" y="8" width="9.6" height="8" rx="1"/>',
    // A magnet, not another grid — two grid icons side by side (plain grid
    // vs. grid-with-a-dot) read as near-identical at toolbar size. Thick
    // horseshoe body (bumped stroke-width so it reads as solid metal, not
    // a thin wire/cord) + two chunky filled pole caps at the open ends —
    // the universal "snapping" symbol, unmistakable for the plain
    // grid-visibility toggle next to it.
    snapGrid: '<path d="M7 4v7a5 5 0 0 0 10 0V4" stroke-width="2.6"/><rect x="4.2" y="2.8" width="5.6" height="4.8" rx="1.1" fill="currentColor" stroke="none"/><rect x="14.2" y="2.8" width="5.6" height="4.8" rx="1.1" fill="currentColor" stroke="none"/>'
  };

  function _gfeIcon(inner) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  // Same stroke-width (2, vs. the rest of this toolbar's 1.7) as
  // DrawingCanvas's own icons — matches their exact visual weight, not just
  // their shape.
  function _dcIcon(inner, extraClass) {
    return `<svg${extraClass ? ` class="${extraClass}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  var TOOLBAR_HTML = `
    <div class="gfe-tool-section">
      <div class="dc-tool-group">
        <button class="dc-tool-btn dc-tool-btn--active" data-tool="select" title="Selectează / mută (Q)">${_gfeIcon(TOOL_ICONS.select)}</button>
        <button class="dc-tool-btn" data-tool="pan" title="Mișcă vizualizarea — utilă la zoom (W)">${_gfeIcon(TOOL_ICONS.pan)}</button>
        <button class="dc-tool-btn" data-tool="eraser" title="Radieră — apasă și trage peste elemente pentru a le șterge (E)">${_gfeIcon(TOOL_ICONS.eraser)}</button>
      </div>
    </div>
    <div class="gfe-tool-section">
      <div class="gfe-dropdown">
        <button type="button" class="dc-tool-btn gfe-dropdown__trigger" title="Forme 2D — alege o formă" aria-haspopup="true" aria-expanded="false">
          ${_gfeIcon(SHAPE_ICONS['tri-oarecare'])}${_gfeIcon(TOOL_ICONS.chevron)}
        </button>
        <div class="gfe-dropdown__panel">
          <div class="dc-tool-group gfe-shape-group">
            ${['tri-isoscel','tri-echilateral','tri-oarecare','cerc','patrat','paralelogram','trapez-isoscel','trapez-dreptunghic','romb']
              .map(function (id) { return `<button class="dc-tool-btn gfe-shape-btn" data-shape="${id}" title="${SHAPE_LABELS[id]}">${_gfeIcon(SHAPE_ICONS[id])}</button>`; }).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="gfe-tool-section">
      <div class="gfe-dropdown">
        <button type="button" class="dc-tool-btn gfe-dropdown__trigger" title="Corpuri 3D — alege un corp" aria-haspopup="true" aria-expanded="false">
          ${_gfeIcon(SHAPE_ICONS.cub)}${_gfeIcon(TOOL_ICONS.chevron)}
        </button>
        <div class="gfe-dropdown__panel">
          <div class="dc-tool-group gfe-shape-group">
            ${['cub','piramida-patrata','piramida-triunghiulara','sfera','con','cilindru']
              .map(function (id) { return `<button class="dc-tool-btn gfe-shape-btn" data-shape="${id}" title="${SHAPE_LABELS[id]}">${_gfeIcon(SHAPE_ICONS[id])}</button>`; }).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="gfe-tool-section">
      <div class="dc-tool-group">
        <button class="dc-tool-btn" data-tool="segment" title="Segment continuu">${_gfeIcon(TOOL_ICONS.segment)}</button>
        <button class="dc-tool-btn" data-tool="segment-dashed" title="Segment punctat">${_gfeIcon(TOOL_ICONS['segment-dashed'])}</button>
      </div>
    </div>
    <div class="gfe-tool-section">
      <div class="dc-tool-group">
        <button class="dc-tool-btn" data-tool="right-angle" title="Unghi drept">${_gfeIcon(TOOL_ICONS['right-angle'])}</button>
        <button class="dc-tool-btn" data-tool="arc" title="Arc unghi">${_gfeIcon(TOOL_ICONS.arc)}</button>
      </div>
    </div>
    <div class="gfe-tool-section">
      <div class="dc-tool-group">
        <button class="dc-tool-btn" data-tool="text" title="Etichetă text">${_gfeIcon(TOOL_ICONS.text)}</button>
      </div>
    </div>
    <div class="gfe-tool-section">
      <div class="dc-tool-group">
        <button class="dc-color-btn dc-color-btn--active" data-color="" data-adaptive title="Culoare implicită" aria-label="Culoare implicită"></button>
        <button class="dc-color-btn" data-color="#dc2626" style="background:#dc2626" title="Roșu" aria-label="Culoare roșu"></button>
        <button class="dc-color-btn" data-color="#1d4ed8" style="background:#1d4ed8" title="Albastru" aria-label="Culoare albastru"></button>
        <button class="dc-color-btn" data-color="#16a34a" style="background:#16a34a" title="Verde" aria-label="Culoare verde"></button>
        <button class="dc-color-btn" data-color="#ea580c" style="background:#ea580c" title="Portocaliu" aria-label="Culoare portocaliu"></button>
        <button class="dc-color-btn" data-color="#7c3aed" style="background:#7c3aed" title="Violet" aria-label="Culoare violet"></button>
      </div>
    </div>
    <div class="gfe-tool-section gfe-tool-section--actions">
      <div class="dc-tool-group">
        <button class="dc-action-btn" id="gfe-zoomout-btn" title="Micșorează">${_dcIcon(DC_ICONS.zoomOut)}</button>
        <span class="dc-zoom-label" id="gfe-zoom-label">100%</span>
        <button class="dc-action-btn" id="gfe-zoomin-btn" title="Mărește">${_dcIcon(DC_ICONS.zoomIn)}</button>
        <button class="dc-action-btn" id="gfe-fit-btn" title="Potrivește la ecran">${_dcIcon(DC_ICONS.fit)}</button>
        <button class="dc-action-btn" id="gfe-grid-btn" title="Arată grila">${_dcIcon(DC_ICONS.grid)}</button>
        <button class="dc-action-btn" id="gfe-snapgrid-btn" title="Activează alinierea la grilă">${_dcIcon(DC_ICONS.snapGrid)}</button>
        <button class="dc-action-btn" id="gfe-undo-btn" title="Anulează (Ctrl+Z)">${_dcIcon(DC_ICONS.undo)}</button>
        <button class="dc-action-btn" id="gfe-redo-btn" title="Reface (Ctrl+Y)">${_dcIcon(DC_ICONS.undo, 'dc-icon-mirror')}</button>
        <button class="dc-action-btn dc-action-btn--danger" id="gfe-clear-btn" title="Șterge tot">${_dcIcon(DC_ICONS.trash)}</button>
      </div>
    </div>
  `;

  function GeometryFigureEditor(container, options) {
    options = options || {};
    this._container = container;
    this._onChange  = options.onChange || null;
    this._initialData = options.initialData || null;

    this._tool       = 'select';
    this._tickCount  = 1;
    this._color      = null; // null = adaptive/default; else literal hex
    this._gridVisible = this._loadGridVisible();
    this._snapToGrid  = this._loadSnapToGrid();
    this._zoom       = 1;
    this._destroyed  = false;
    this._undoStack  = [];
    this._redoStack  = [];
    this._suspendHistory = false;
    this._segmentStart   = null;
    this._segmentPreviewPoint = null;
    this._previewLine    = null;
    this._rightAngleMark = null;

    this._build();
    this._bindEvents();
    this._applyGridVisible();
    this._applySnapToGridUI();

    var self = this;
    requestAnimationFrame(function () {
      self._resizeCanvas();
      self._adaptColors();
      if (self._initialData) {
        self._loadJSON(self._initialData);
      } else {
        self._pushHistory();
      }
    });
  }

  GeometryFigureEditor.prototype._build = function () {
    var wrap = document.createElement('div');
    wrap.className = 'gfe-wrap';

    var toolbar = document.createElement('div');
    toolbar.className = 'dc-toolbar gfe-toolbar';
    toolbar.innerHTML = TOOLBAR_HTML;

    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'gfe-canvas-wrap';

    var canvasEl = document.createElement('canvas');
    canvasWrap.appendChild(canvasEl);

    wrap.appendChild(toolbar);
    wrap.appendChild(canvasWrap);
    this._container.appendChild(wrap);

    this._wrap       = wrap;
    this._toolbar    = toolbar;
    this._canvasWrap = canvasWrap;

    this._fabricCanvas = new fabric.Canvas(canvasEl, {
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
      // Fabric locks corner-drag scaling to the shape's aspect ratio by
      // default (Shift frees it) — flipped here so corner-dragging is a
      // free, independent-axis resize by default (Shift now locks the
      // aspect ratio instead), matching how vertex dragging already moves
      // freely in both axes. Also what makes grid-snap land exactly on both
      // axes for a dragged corner — a fixed-aspect diagonal only has one
      // degree of freedom, so at most one axis could ever be made to land
      // exactly on the grid.
      uniformScaling: false,
      // Every shape here is fill:'transparent' (outline-only), but Fabric's
      // default hit-testing treats a shape's whole bounding path as
      // clickable regardless of what's actually painted there — so clicking
      // inside a big circle's empty interior always selected the circle
      // itself, even directly on top of a smaller shape nested inside it
      // (e.g. a square inscribed in a circle), with no way to reach the
      // inner shape short of moving the circle out of the way first.
      // perPixelTargetFind checks actual rendered pixel opacity at the
      // click point instead, so a click lands on whichever shape is really
      // painted there — the circle's stroke, or the square underneath it.
      perPixelTargetFind: true,
      targetFindTolerance: 4
    });
    this._fabricCanvas.__gfe = this;
  };

  GeometryFigureEditor.prototype._resizeCanvas = function () {
    if (this._destroyed) return;
    var w = this._canvasWrap.clientWidth || 800;
    var h = Math.max(420, this._canvasWrap.clientHeight || 520);
    this._fabricCanvas.setWidth(w);
    this._fabricCanvas.setHeight(h);
    this._fabricCanvas.requestRenderAll();
  };

  /* ---- color roles ---- */

  GeometryFigureEditor.prototype._paletteColor = function (role) {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var pal = dark ? ROLE_DARK : ROLE_LIGHT;
    return pal[role] || pal.primary;
  };

  GeometryFigureEditor.prototype._strokeSpec = function (defaultRole) {
    if (this._color) return { stroke: this._color, role: 'custom' };
    return { stroke: this._paletteColor(defaultRole), role: defaultRole };
  };

  GeometryFigureEditor.prototype._repaintRoleColor = function (obj, inheritedRole) {
    var self = this;
    // 3D shapes' child primitives (edges/faces built by THREE_D[...].build())
    // never carry their own data.role — only the parent Group does — so a
    // role found on an ancestor must propagate down to children that don't
    // have their own, or those children never adapt to theme changes at all.
    var role = (obj.data && obj.data.role) || inheritedRole;
    if (obj._objects) obj._objects.forEach(function (child) { self._repaintRoleColor(child, role); });
    if (role === 'primary' || role === 'auxiliary') {
      var color = this._paletteColor(role);
      if (obj.stroke) obj.set('stroke', color);
      if (obj.type === 'i-text' || obj.type === 'text') obj.set('fill', color);
    }
  };

  GeometryFigureEditor.prototype._adaptColors = function () {
    var self = this;
    this._fabricCanvas.getObjects().forEach(function (o) { self._repaintRoleColor(o); });
    this._fabricCanvas.requestRenderAll();
    this._paintAdaptiveSwatch();
  };

  // The "default" swatch has no color of its own (it just means "use
  // whatever --text currently resolves to") — but left with no background at
  // all it's invisible/blends into the toolbar, same problem DrawingCanvas's
  // adaptive black/white swatch solves by painting itself on theme change.
  GeometryFigureEditor.prototype._paintAdaptiveSwatch = function () {
    var btn = this._toolbar && this._toolbar.querySelector('[data-adaptive]');
    if (!btn) return;
    var color = this._paletteColor('primary');
    btn.style.background = color;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var label = 'Culoare implicită (' + (dark ? 'alb' : 'negru') + ')';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  };

  GeometryFigureEditor.prototype._applyColorToSelection = function (hexOrNull) {
    this._color = hexOrNull;
    this._updateColorSwatchUI();
    var obj = this._fabricCanvas.getActiveObject();
    if (!obj) return;
    var isLine = obj.data && (obj.data.kind === 'segment' || obj.data.kind === 'right-angle' || obj.data.kind === 'arc-marker' || obj.data.kind === 'tick-marks');
    var role = hexOrNull ? 'custom' : (isLine ? 'auxiliary' : 'primary');
    var color = hexOrNull || this._paletteColor(role);
    var apply = function (o) {
      if (o._objects) { o._objects.forEach(apply); }
      if (o.stroke) o.set('stroke', color);
      if (o.type === 'i-text' || o.type === 'text') o.set('fill', color);
      o.data = Object.assign({}, o.data, { role: role });
    };
    apply(obj);
    this._fabricCanvas.requestRenderAll();
    this._pushHistory();
  };

  /* ---- history (undo/redo via JSON snapshots) ---- */

  GeometryFigureEditor.prototype._pushHistory = function () {
    if (this._suspendHistory) return;
    var json = JSON.stringify(this._fabricCanvas.toJSON(['data']));
    if (this._undoStack.length && this._undoStack[this._undoStack.length - 1] === json) return;
    this._undoStack.push(json);
    if (this._undoStack.length > 60) this._undoStack.shift();
    this._redoStack = [];
    this._updateUndoRedoButtons();
    this._notifyChange();
  };

  GeometryFigureEditor.prototype._notifyChange = function () {
    if (this._onChange) this._onChange(this._fabricCanvas.toJSON(['data']));
  };

  GeometryFigureEditor.prototype._reattach = function (obj) {
    // Self-heals any figure saved before bakePolygonScale/bakeRectScale
    // existed (a non-uniformly-resized polygon/rect whose scaleX/scaleY
    // never got baked into its geometry, see those functions' comment) —
    // opening the editor on it, even without touching the shape, is enough
    // to normalize it before the next save/export.
    if (obj.type === 'polygon') { attachPolygonVertexControls(obj); bakePolygonScale(obj); obj.setCoords(); }
    if (obj.type === 'circle')  attachCircleUniformControls(obj);
    // Rect (the "patrat" preset) only ever gets the shared scale/rotate
    // styling (no per-vertex controls, same as circle) — was missing here,
    // so after undo/redo/load it fell back to Fabric's bare default
    // (uncolored circular) handles instead of the green/blue custom ones.
    if (obj.type === 'rect')    { styleScaleAndRotateControls(obj); bakeRectScale(obj); obj.setCoords(); }
    if (obj.type === 'line' && obj.data && obj.data.kind === 'segment') attachLineEndpointControls(obj);
    // fabric.Control instances (positionHandler/actionHandler/render — all
    // functions) never survive a JSON round-trip, so every 3D group needs
    // its custom vertex+scale+rotate controls rebuilt from scratch after
    // undo/redo/load, exactly like Polygon/Circle above — this was missing
    // entirely, which is why undo used to leave 3D shapes with Fabric's
    // bare default (uncolored, no vertex) controls.
    if (obj.type === 'group' && obj.data && THREE_D[obj.data.kind]) {
      attachGroup3DControls(obj, THREE_D[obj.data.kind]);
    }
  };

  GeometryFigureEditor.prototype._restoreFromSnapshot = function (jsonStr) {
    var self = this;
    this._suspendHistory = true;
    this._fabricCanvas.loadFromJSON(JSON.parse(jsonStr), function () {
      self._fabricCanvas.getObjects().forEach(function (o) { self._reattach(o); });
      self._fabricCanvas.requestRenderAll();
      self._suspendHistory = false;
      self._updateUndoRedoButtons();
      self._notifyChange();
    });
  };

  GeometryFigureEditor.prototype._undo = function () {
    if (this._undoStack.length < 2) return;
    this._redoStack.push(this._undoStack.pop());
    this._restoreFromSnapshot(this._undoStack[this._undoStack.length - 1]);
  };

  GeometryFigureEditor.prototype._redo = function () {
    if (!this._redoStack.length) return;
    var snap = this._redoStack.pop();
    this._undoStack.push(snap);
    this._restoreFromSnapshot(snap);
  };

  GeometryFigureEditor.prototype._updateUndoRedoButtons = function () {
    var undoBtn = this._toolbar.querySelector('#gfe-undo-btn');
    var redoBtn = this._toolbar.querySelector('#gfe-redo-btn');
    if (undoBtn) undoBtn.disabled = this._undoStack.length < 2;
    if (redoBtn) redoBtn.disabled = this._redoStack.length === 0;
  };

  GeometryFigureEditor.prototype._loadJSON = function (data) {
    var self = this;
    this._suspendHistory = true;
    this._fabricCanvas.loadFromJSON(data, function () {
      self._fabricCanvas.getObjects().forEach(function (o) { self._reattach(o); });
      self._fabricCanvas.requestRenderAll();
      self._suspendHistory = false;
      self._adaptColors();
      self._pushHistory();
    });
  };

  /* ---- snapping ---- */

  GeometryFigureEditor.prototype._buildSnapRegistry = function (excludeObj) {
    var entries = [];
    this._fabricCanvas.getObjects().forEach(function (obj) {
      if (obj === excludeObj) return;
      if (obj.__isSnapMarker) return;

      if (obj.type === 'polygon') {
        var pts = obj.points.map(function (p) {
          return fabric.util.transformPoint(
            { x: p.x - obj.pathOffset.x, y: p.y - obj.pathOffset.y },
            obj.calcTransformMatrix()
          );
        });
        pts.forEach(function (p, i) {
          var next = pts[(i + 1) % pts.length], prev = pts[(i - 1 + pts.length) % pts.length];
          entries.push({ x: p.x, y: p.y, type: 'vertex', edgeDirs: [unitVec(next, p), unitVec(prev, p)] });
        });
        for (var i = 0; i < pts.length; i++) {
          var a = pts[i], b = pts[(i + 1) % pts.length];
          entries.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, type: 'midpoint', edgeDirs: [unitVec(b, a)] });
        }
      } else if (obj.type === 'rect') {
        obj.setCoords();
        var c = obj.aCoords;
        if (c) {
          var order = [c.tl, c.tr, c.br, c.bl];
          order.forEach(function (p, i) {
            var next = order[(i + 1) % 4], prev = order[(i - 1 + 4) % 4];
            entries.push({ x: p.x, y: p.y, type: 'vertex', edgeDirs: [unitVec(next, p), unitVec(prev, p)] });
          });
          for (var j = 0; j < 4; j++) {
            var a2 = order[j], b2 = order[(j + 1) % 4];
            entries.push({ x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2, type: 'midpoint', edgeDirs: [unitVec(b2, a2)] });
          }
        }
      } else if (obj.type === 'line') {
        try {
          var lp = obj.calcLinePoints();
          var m  = obj.calcTransformMatrix();
          var p1 = fabric.util.transformPoint({ x: lp.x1, y: lp.y1 }, m);
          var p2 = fabric.util.transformPoint({ x: lp.x2, y: lp.y2 }, m);
          entries.push({ x: p1.x, y: p1.y, type: 'vertex', edgeDirs: [unitVec(p2, p1)] });
          entries.push({ x: p2.x, y: p2.y, type: 'vertex', edgeDirs: [unitVec(p1, p2)] });
          entries.push({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, type: 'midpoint', edgeDirs: [unitVec(p2, p1)] });
        } catch (err) {}
      } else if (obj.type === 'circle') {
        var center = obj.getCenterPoint();
        entries.push({ x: center.x, y: center.y, type: 'vertex', edgeDirs: [] });
      } else if (obj.type === 'group' && obj.data && obj.data.points) {
        // 3D solids (cub/piramide/etc.) — same vertex+midpoint snap targets
        // as a 2D polygon, just derived from data.points (LOCAL, group-
        // center-relative — see attachGroup3DControls) plus each shape's own
        // `edges` list (which pairs of named points are actually connected;
        // a cube/pyramid isn't a single closed ring like a polygon, so there
        // is no "next/prev" to infer this from positionally). Shapes with no
        // `edges` entry (cone/cylinder/sphere — curved, no real vertices)
        // still contribute their named points as bare snap targets, just
        // without edge directions to drive a right-angle snap.
        try {
          var spec3d = THREE_D[obj.data.kind];
          var gm = obj.calcTransformMatrix();
          var world = {};
          Object.keys(obj.data.points).forEach(function (k) {
            world[k] = fabric.util.transformPoint(obj.data.points[k], gm);
          });
          var dirsByKey = {};
          var edgeList = (spec3d && spec3d.edges) || [];
          edgeList.forEach(function (pair) {
            var wa = world[pair[0]], wb = world[pair[1]];
            if (!wa || !wb) return;
            (dirsByKey[pair[0]] = dirsByKey[pair[0]] || []).push(unitVec(wb, wa));
            (dirsByKey[pair[1]] = dirsByKey[pair[1]] || []).push(unitVec(wa, wb));
            entries.push({ x: (wa.x + wb.x) / 2, y: (wa.y + wb.y) / 2, type: 'midpoint', edgeDirs: [unitVec(wb, wa)] });
          });
          Object.keys(world).forEach(function (k) {
            entries.push({ x: world[k].x, y: world[k].y, type: 'vertex', edgeDirs: dirsByKey[k] || [] });
          });
        } catch (err) {}
      }
    });
    return entries;
  };

  GeometryFigureEditor.prototype._nearestSnapPoint = function (pt, excludeObj) {
    var threshold = SNAP_PX / this._fabricCanvas.getZoom();
    var registry = this._buildSnapRegistry(excludeObj);
    var best = null, bestDist = threshold;
    registry.forEach(function (e) {
      var d = Math.hypot(e.x - pt.x, e.y - pt.y);
      if (d <= bestDist) { bestDist = d; best = e; }
    });
    return best;
  };

  GeometryFigureEditor.prototype._trySnap = function (absPt, excludeObj) {
    // Grid-snap, when toggled on, is instant/always-on (unlike the proximity-
    // based shape-vertex snap below) — every vertex drag lands on the
    // nearest grid intersection, no closeness threshold to clear first.
    if (this._snapToGrid) {
      return this._snapPointToGrid(absPt);
    }
    var hit = this._nearestSnapPoint(absPt, excludeObj);
    if (hit) return { x: hit.x, y: hit.y };
    return null;
  };

  GeometryFigureEditor.prototype._collectEdgeDirsNear = function (pt) {
    var threshold = SNAP_PX / this._fabricCanvas.getZoom();
    var dirs = [];
    this._buildSnapRegistry().forEach(function (e) {
      if (e.type === 'vertex' && Math.hypot(e.x - pt.x, e.y - pt.y) <= threshold && e.edgeDirs) {
        dirs = dirs.concat(e.edgeDirs);
      }
    });
    return dirs;
  };

  GeometryFigureEditor.prototype._findNearestEdge = function (pt) {
    var threshold = EDGE_PX / this._fabricCanvas.getZoom();
    var best = null, bestDist = threshold;
    function consider(p1, p2) {
      var d = distToSegment(pt, p1, p2);
      if (d <= bestDist) { bestDist = d; best = { p1: p1, p2: p2 }; }
    }
    this._fabricCanvas.getObjects().forEach(function (obj) {
      if (obj.__isSnapMarker) return;
      if (obj.type === 'polygon') {
        var pts = obj.points.map(function (p) {
          return fabric.util.transformPoint({ x: p.x - obj.pathOffset.x, y: p.y - obj.pathOffset.y }, obj.calcTransformMatrix());
        });
        for (var i = 0; i < pts.length; i++) consider(pts[i], pts[(i + 1) % pts.length]);
      } else if (obj.type === 'rect') {
        obj.setCoords();
        var c = obj.aCoords;
        if (c) { consider(c.tl, c.tr); consider(c.tr, c.br); consider(c.br, c.bl); consider(c.bl, c.tl); }
      } else if (obj.type === 'line') {
        try {
          var lp = obj.calcLinePoints(), m = obj.calcTransformMatrix();
          var p1 = fabric.util.transformPoint({ x: lp.x1, y: lp.y1 }, m);
          var p2 = fabric.util.transformPoint({ x: lp.x2, y: lp.y2 }, m);
          consider(p1, p2);
        } catch (err) {}
      } else if (obj.type === 'group' && obj.data && obj.data.points) {
        try {
          var spec3d = THREE_D[obj.data.kind];
          if (!spec3d || !spec3d.edges) return;
          var gm = obj.calcTransformMatrix();
          var world = {};
          Object.keys(obj.data.points).forEach(function (k) {
            world[k] = fabric.util.transformPoint(obj.data.points[k], gm);
          });
          spec3d.edges.forEach(function (pair) {
            var wa = world[pair[0]], wb = world[pair[1]];
            if (wa && wb) consider(wa, wb);
          });
        } catch (err) {}
      }
    });
    return best;
  };

  /* ---- shape presets ---- */

  GeometryFigureEditor.prototype._viewCenterPoint = function () {
    var c = this._fabricCanvas;
    var zoom = c.getZoom();
    var vpt = c.viewportTransform;
    return { x: (c.getWidth() / 2 - vpt[4]) / zoom, y: (c.getHeight() / 2 - vpt[5]) / zoom };
  };

  var POLY_PRESETS = {
    'tri-isoscel':    [{ x: 0, y: -70 }, { x: -60, y: 60 }, { x: 60, y: 60 }],
    'tri-echilateral':[{ x: 0, y: -81 }, { x: -70, y: 40 }, { x: 70, y: 40 }],
    'tri-oarecare':   [{ x: -70, y: 60 }, { x: 50, y: -70 }, { x: 80, y: 50 }],
    paralelogram:     [{ x: -70, y: 50 }, { x: -30, y: -50 }, { x: 70, y: -50 }, { x: 30, y: 50 }],
    'trapez-isoscel':      [{ x: -80, y: 50 }, { x: -40, y: -50 }, { x: 40, y: -50 }, { x: 80, y: 50 }],
    'trapez-dreptunghic':  [{ x: -70, y: 50 }, { x: -70, y: -50 }, { x: 40, y: -50 }, { x: 80, y: 50 }],
    romb:             [{ x: 0, y: -80 }, { x: 42, y: 0 }, { x: 0, y: 80 }, { x: -42, y: 0 }]
  };

  GeometryFigureEditor.prototype._snapDimToGrid = function (d) {
    return Math.max(GRID_CELL_PX, Math.round(d / GRID_CELL_PX) * GRID_CELL_PX);
  };

  GeometryFigureEditor.prototype._insertShape = function (shapeId) {
    var center = this._viewCenterPoint();
    if (this._snapToGrid) center = this._snapPointToGrid(center);
    var spec = this._strokeSpec('primary');
    var self = this;
    var obj;

    if (POLY_PRESETS[shapeId]) {
      var pts = POLY_PRESETS[shapeId].map(function (p) {
        var abs = { x: p.x + center.x, y: p.y + center.y };
        return self._snapToGrid ? self._snapPointToGrid(abs) : abs;
      });
      obj = new fabric.Polygon(pts, {
        fill: 'transparent', stroke: spec.stroke, strokeWidth: 2, strokeUniform: true, strokeLineJoin: 'round',
        objectCaching: false, data: { role: spec.role, kind: 'shape', id: genId() }
      });
      attachPolygonVertexControls(obj);
    } else if (shapeId === 'cerc') {
      var radius = this._snapToGrid ? this._snapDimToGrid(60) : 60;
      obj = new fabric.Circle({
        left: center.x - radius, top: center.y - radius, radius: radius,
        fill: 'transparent', stroke: spec.stroke, strokeWidth: 2, strokeUniform: true,
        objectCaching: false, data: { role: spec.role, kind: 'shape', id: genId() }
      });
      if (this._snapToGrid) {
        // left = center - radius LOOKS like it should land exactly on the
        // grid once center and radius both do, but strokeUniform gives
        // Fabric's actually-measured center (getCenterPoint) a sub-pixel
        // bias plain left/radius arithmetic doesn't account for (same
        // strokeUniform quirk _scaleSnapTarget and the radius handle above
        // both had to work around) — so measure the REAL center and correct
        // left/top by however far off it actually is, instead of trusting
        // the naive formula.
        obj.setCoords();
        var trueCenter = obj.getCenterPoint();
        var snappedCenter = this._snapPointToGrid(trueCenter);
        obj.set({
          left: obj.left + (snappedCenter.x - trueCenter.x),
          top: obj.top + (snappedCenter.y - trueCenter.y)
        });
        obj.setCoords();
      }
      attachCircleUniformControls(obj);
    } else if (shapeId === 'patrat') {
      var side = this._snapToGrid ? this._snapDimToGrid(120) : 120;
      var rectLeft = this._snapToGrid ? this._snapPointToGrid({ x: center.x - side / 2, y: 0 }).x : center.x - side / 2;
      var rectTop  = this._snapToGrid ? this._snapPointToGrid({ x: 0, y: center.y - side / 2 }).y : center.y - side / 2;
      obj = new fabric.Rect({
        left: rectLeft, top: rectTop, width: side, height: side,
        fill: 'transparent', stroke: spec.stroke, strokeWidth: 2, strokeUniform: true,
        objectCaching: false, data: { role: spec.role, kind: 'shape', id: genId() }
      });
      styleScaleAndRotateControls(obj); // no vertex controls — a rect only ever resizes/rotates as a whole
    } else if (THREE_D[shapeId]) {
      this._insert3DShape(shapeId, center, spec);
      return;
    } else {
      return;
    }

    this._fabricCanvas.add(obj);
    this._fabricCanvas.setActiveObject(obj);
    this._fabricCanvas.requestRenderAll();
    this._pushHistory();
  };

  GeometryFigureEditor.prototype._insert3DShape = function (kind, origin, spec) {
    var factory = THREE_D[kind];
    var points = factory.defaultPoints(origin);
    var objects = factory.build(points, spec.stroke);
    var group = new fabric.Group(objects, { data: { role: spec.role, kind: kind, id: genId(), points: points } });

    // data.points must be LOCAL (group-center-relative, unscaled) from here
    // on, matching groupVertexPositionHandler's expectations — group angle/
    // scale are still identity at this point (just constructed), so this is
    // a plain subtraction, same as rebuildGroupChildren's post-bake step.
    var center = group.getCenterPoint();
    Object.keys(points).forEach(function (k) {
      points[k] = { x: points[k].x - center.x, y: points[k].y - center.y };
    });

    attachGroup3DControls(group, factory);
    this._fabricCanvas.add(group);
    this._fabricCanvas.setActiveObject(group);
    this._fabricCanvas.requestRenderAll();
    this._pushHistory();
  };

  GeometryFigureEditor.prototype._currentObjectColor = function (obj) {
    var found = obj;
    if (obj._objects && obj._objects.length) found = obj._objects[0];
    return found.stroke || this._paletteColor('primary');
  };

  /* ---- segment tool ---- */

  // Fabric.Line has a real internal inconsistency: calcTransformMatrix()'s
  // translation (the point everything else is measured from — vertex/scale
  // snapping, this file's own snap registry) is computed from a stroke-
  // width-padded bounding box, but calcLinePoints() (which supplies the
  // actual path coordinates drawn inside that transform) is NOT padded the
  // same way — so the line RENDERS up to strokeWidth/2 away from the exact
  // x1/y1 it was constructed with, even though every other shape type in
  // this editor (polygon, rect, group) reconstructs its points exactly.
  // That's the "segment doesn't quite touch the vertex" gap. Fixed by
  // measuring where point 1 actually lands right after construction and
  // nudging left/top by whatever that's off by — a rigid shift, so it
  // corrects both endpoints at once.
  function alignLineToStart(line) {
    line.setCoords();
    var lp = line.calcLinePoints();
    var m = line.calcTransformMatrix();
    var actual = fabric.util.transformPoint({ x: lp.x1, y: lp.y1 }, m);
    var dx = line.x1 - actual.x, dy = line.y1 - actual.y;
    if (dx || dy) {
      line.set({ left: line.left + dx, top: line.top + dy });
      line.setCoords();
    }
  }

  GeometryFigureEditor.prototype._clearSegmentPreview = function () {
    if (this._previewLine) {
      this._fabricCanvas.remove(this._previewLine);
      this._previewLine = null;
    }
    this._updateRightAngleIndicator(null);
    this._segmentPreviewPoint = null;
  };

  // Tiny "⌐" bracket at `hit.point`, drawn along hit.dir1/hit.dir2 (the edge
  // direction the snap fired against, and the perpendicular the line is
  // currently snapped to) — the standard right-angle mark, sized in screen
  // space so it stays legible at any zoom. Recreated from scratch on every
  // call rather than mutated in place (cheap for a 3-point path, and avoids
  // fighting Fabric's Path internals over a moving `path` property) —
  // passing null just removes whatever mark is currently showing.
  GeometryFigureEditor.prototype._updateRightAngleIndicator = function (hit) {
    if (this._rightAngleMark) {
      this._fabricCanvas.remove(this._rightAngleMark);
      this._rightAngleMark = null;
    }
    if (!hit) return;
    var sz = RIGHT_ANGLE_MARK_PX / this._fabricCanvas.getZoom();
    var o = hit.point, d1 = hit.dir1, d2 = hit.dir2;
    var a = { x: o.x + d1.x * sz, y: o.y + d1.y * sz };
    var c = { x: o.x + d2.x * sz, y: o.y + d2.y * sz };
    var b = { x: a.x + d2.x * sz, y: a.y + d2.y * sz };
    var mark = new fabric.Path(
      'M ' + a.x + ' ' + a.y + ' L ' + b.x + ' ' + b.y + ' L ' + c.x + ' ' + c.y,
      { fill: 'transparent', stroke: HANDLE_COLOR, strokeWidth: 1.5, selectable: false, evented: false, objectCaching: false }
    );
    mark.__isSnapMarker = true;
    this._rightAngleMark = mark;
    this._fabricCanvas.add(mark);
  };

  // Drop-a-perpendicular-onto-a-nearby-side check — the angle forms where
  // the line ARRIVES, not where it started (e.g. a triangle's altitude:
  // you start at a vertex, drag toward the OPPOSITE side, and the line
  // should snap perpendicular to THAT side, landing exactly on it). So this
  // looks at whatever real edge (of any other shape, any orientation —
  // tilted works exactly like axis-aligned, it's a plain angle-between-two-
  // vectors check, not a special-cased horizontal/vertical one) the cursor
  // is currently near, not at anything connected to _segmentStart. Returns
  // { point, dir1, dir2 } — point is the exact foot of the perpendicular
  // ON that edge's line, both for the snapped endpoint and for where the
  // little right-angle mark renders — or null if nothing's close enough.
  GeometryFigureEditor.prototype._rightAngleSnap = function (pt) {
    var edge = this._findNearestEdge(pt);
    if (!edge) return null;
    var edgeDir = unitVec(edge.p2, edge.p1);
    var dx = pt.x - this._segmentStart.x, dy = pt.y - this._segmentStart.y;
    var len = Math.hypot(dx, dy);
    if (len < 2) return null;
    var dragDir = { x: dx / len, y: dy / len };
    var dot = Math.max(-1, Math.min(1, dragDir.x * edgeDir.x + dragDir.y * edgeDir.y));
    var diffFrom90 = Math.abs(Math.acos(dot) * 180 / Math.PI - 90);
    if (diffFrom90 > RIGHT_ANGLE_SNAP_DEG) return null;

    // Foot of the perpendicular from _segmentStart onto the edge's
    // (infinite) line — vector projection.
    var t = (this._segmentStart.x - edge.p1.x) * edgeDir.x + (this._segmentStart.y - edge.p1.y) * edgeDir.y;
    var foot = { x: edge.p1.x + edgeDir.x * t, y: edge.p1.y + edgeDir.y * t };

    // Orient the mark's two arms so they actually bracket the angle: dir1
    // along the edge toward wherever the cursor currently sits (either
    // edge direction is mathematically a valid 90°, but only one reads as
    // "pointing at what the user is doing"); dir2 back along the drawn
    // segment, from the foot toward the start.
    var dir1 = edgeDir;
    var alongSign = (pt.x - foot.x) * edgeDir.x + (pt.y - foot.y) * edgeDir.y;
    if (alongSign < 0) dir1 = { x: -edgeDir.x, y: -edgeDir.y };
    var dir2 = unitVec(this._segmentStart, foot);

    return { point: foot, dir1: dir1, dir2: dir2 };
  };

  GeometryFigureEditor.prototype._updateSegmentPreview = function (pt) {
    if (!this._segmentStart) return;
    var snap = this._nearestSnapPoint(pt);
    var p = snap ? { x: snap.x, y: snap.y } : pt;

    // A real vertex/midpoint match always wins over an inferred right angle
    // — landing exactly on an existing point is more useful/explicit.
    var rightAngle = snap ? null : this._rightAngleSnap(pt);
    if (rightAngle) {
      p = rightAngle.point;
      this._updateRightAngleIndicator(rightAngle);
    } else {
      this._updateRightAngleIndicator(null);
    }
    this._segmentPreviewPoint = p;

    if (!this._previewLine) {
      this._previewLine = new fabric.Line([this._segmentStart.x, this._segmentStart.y, p.x, p.y], {
        stroke: HANDLE_COLOR, strokeWidth: 1.5, strokeDashArray: [4, 4], selectable: false, evented: false
      });
      this._previewLine.__isSnapMarker = true;
      this._fabricCanvas.add(this._previewLine);
    } else {
      this._previewLine.set({ x2: p.x, y2: p.y });
    }
    this._fabricCanvas.requestRenderAll();
  };

  GeometryFigureEditor.prototype._handleSegmentClick = function (pt) {
    if (!this._segmentStart) {
      var snap = this._nearestSnapPoint(pt);
      this._segmentStart = snap ? { x: snap.x, y: snap.y } : pt;
      return;
    }
    // Whatever the live preview last showed (plain point-snap OR a
    // right-angle snap) is exactly what gets committed — never recomputed
    // independently, so a click never lands somewhere subtly different from
    // what was just previewed.
    var p = this._segmentPreviewPoint || pt;
    var spec = this._strokeSpec('auxiliary');
    var line = new fabric.Line([this._segmentStart.x, this._segmentStart.y, p.x, p.y], {
      stroke: spec.stroke, strokeWidth: 2, strokeDashArray: this._tool === 'segment-dashed' ? [8, 6] : null, strokeLineCap: 'round',
      objectCaching: false,
      data: { role: spec.role, kind: 'segment' }
    });
    alignLineToStart(line);
    attachLineEndpointControls(line);
    this._clearSegmentPreview();
    this._fabricCanvas.add(line);
    this._segmentStart = null;
    this._setTool('select');
    this._pushHistory();
  };

  /* ---- annotations ---- */

  GeometryFigureEditor.prototype._insertRightAngle = function (pt) {
    var v = this._nearestSnapPoint(pt);
    var origin = v ? { x: v.x, y: v.y } : pt;
    var dirs = this._collectEdgeDirsNear(origin);
    var pair = dirs.length >= 2 ? mostPerpendicularPair(dirs) : [{ x: 1, y: 0 }, { x: 0, y: -1 }];
    var s = 14;
    var A = { x: origin.x + pair[0].x * s, y: origin.y + pair[0].y * s };
    var C = { x: origin.x + pair[1].x * s, y: origin.y + pair[1].y * s };
    var B = { x: A.x + pair[1].x * s, y: A.y + pair[1].y * s };
    var spec = this._strokeSpec('auxiliary');
    var marker = new fabric.Polyline([A, B, C], {
      fill: 'transparent', stroke: spec.stroke, strokeWidth: 2, objectCaching: false,
      data: { role: spec.role, kind: 'right-angle' }
    });
    this._fabricCanvas.add(marker);
    this._setTool('select');
    this._pushHistory();
  };

  GeometryFigureEditor.prototype._insertArc = function (pt) {
    var v = this._nearestSnapPoint(pt);
    var origin = v ? { x: v.x, y: v.y } : pt;
    var dirs = this._collectEdgeDirsNear(origin);
    var d1 = dirs[0] || { x: 1, y: 0 }, d2 = dirs[1] || { x: 0, y: -1 };
    var r = 22;
    var pts = buildArcPoints(origin, r, Math.atan2(d1.y, d1.x), Math.atan2(d2.y, d2.x), 14);
    var spec = this._strokeSpec('auxiliary');
    var arc = new fabric.Polyline(pts, {
      fill: 'transparent', stroke: spec.stroke, strokeWidth: 2, objectCaching: false,
      data: { role: spec.role, kind: 'arc-marker' }
    });
    this._fabricCanvas.add(arc);
    this._setTool('select');
    this._pushHistory();
  };

  GeometryFigureEditor.prototype._insertTick = function (pt) {
    var edge = this._findNearestEdge(pt);
    this._setTool('select');
    if (!edge) return;
    var spec = this._strokeSpec('auxiliary');
    var lines = tickMarkLines(edge.p1, edge.p2, this._tickCount, spec.stroke);
    var group = new fabric.Group(lines, { data: { role: spec.role, kind: 'tick-marks' } });
    this._fabricCanvas.add(group);
    this._pushHistory();
  };

  GeometryFigureEditor.prototype._insertText = function (pt) {
    var self = this;
    var spec = this._strokeSpec('primary');
    var text = new fabric.IText('Text', {
      left: pt.x, top: pt.y, fontSize: 18, fill: spec.stroke,
      fontFamily: "'Josefin Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      data: { role: spec.role, kind: 'label' }
    });
    this._fabricCanvas.add(text);
    this._fabricCanvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    text.on('editing:exited', function () { self._pushHistory(); });
    this._setTool('select');
    this._fabricCanvas.requestRenderAll();
  };

  /* ---- toolbar / tool-mode wiring ---- */

  GeometryFigureEditor.prototype._setTool = function (tool) {
    this._tool = tool;
    this._clearSegmentPreview();
    this._segmentStart = null;
    var placing = tool !== 'select';
    this._fabricCanvas.selection = !placing;
    this._fabricCanvas.getObjects().forEach(function (o) { o.selectable = !placing; });
    this._fabricCanvas.discardActiveObject();
    this._fabricCanvas.defaultCursor = tool === 'pan' ? 'grab' : (placing ? 'crosshair' : 'default');
    this._fabricCanvas.requestRenderAll();
    this._toolbar.querySelectorAll('[data-tool]').forEach(function (btn) {
      btn.classList.toggle('dc-tool-btn--active', btn.dataset.tool === tool);
    });
  };

  GeometryFigureEditor.prototype._closeDropdowns = function () {
    this._toolbar.querySelectorAll('.gfe-dropdown--open').forEach(function (dd) {
      dd.classList.remove('gfe-dropdown--open');
      var trigger = dd.querySelector('.gfe-dropdown__trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  };

  GeometryFigureEditor.prototype._updateColorSwatchUI = function () {
    var self = this;
    this._toolbar.querySelectorAll('[data-color]').forEach(function (btn) {
      var isAdaptive = 'adaptive' in btn.dataset;
      var active = isAdaptive ? !self._color : btn.dataset.color === self._color;
      btn.classList.toggle('dc-color-btn--active', active);
    });
  };

  GeometryFigureEditor.prototype._loadGridVisible = function () {
    try { var v = localStorage.getItem(GRID_VISIBLE_KEY); return v === '1'; } catch (err) { return false; }
  };

  GeometryFigureEditor.prototype._toggleGrid = function () {
    this._gridVisible = !this._gridVisible;
    try { localStorage.setItem(GRID_VISIBLE_KEY, this._gridVisible ? '1' : '0'); } catch (err) {}
    this._applyGridVisible();
  };

  GeometryFigureEditor.prototype._applyGridVisible = function () {
    var btn = this._toolbar.querySelector('#gfe-grid-btn');
    if (btn) { btn.classList.toggle('dc-action-btn--active', this._gridVisible); btn.title = this._gridVisible ? 'Ascunde grila' : 'Arată grila'; }
    this._fabricCanvas.requestRenderAll();
  };

  // Drawn fresh every render pass (hooked via 'before:render') directly in
  // scene coordinates through the CURRENT viewportTransform — unlike the old
  // CSS background-pattern grid, this one pans/zooms WITH the content
  // (an "infinite" grid, IDroo-style: minor lines every cell, a heavier
  // major line every 5th), and stays exactly aligned with grid-snap, which
  // operates in the same scene-space units.
  GeometryFigureEditor.prototype._drawFabricGrid = function () {
    var canvas = this._fabricCanvas;
    var ctx = canvas.getContext();
    var zoom = canvas.getZoom();
    var vpt = canvas.viewportTransform;
    var w = canvas.getWidth(), h = canvas.getHeight();
    var cell = GRID_CELL_PX * zoom;
    if (cell < 4) return; // too dense to read — skip rather than render a solid smear

    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var minorColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    var majorColor = dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.18)';

    var kMinX = Math.floor(-vpt[4] / cell) - 1, kMaxX = Math.ceil((w - vpt[4]) / cell) + 1;
    var kMinY = Math.floor(-vpt[5] / cell) - 1, kMaxY = Math.ceil((h - vpt[5]) / cell) + 1;

    ctx.save();
    [minorColor, majorColor].forEach(function (color, pass) {
      var isMajor = pass === 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var kx = kMinX; kx <= kMaxX; kx++) {
        if ((kx % 5 === 0) !== isMajor) continue;
        var x = Math.round(kx * cell + vpt[4]) + 0.5;
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
      }
      for (var ky = kMinY; ky <= kMaxY; ky++) {
        if ((ky % 5 === 0) !== isMajor) continue;
        var y = Math.round(ky * cell + vpt[5]) + 0.5;
        ctx.moveTo(0, y); ctx.lineTo(w, y);
      }
      ctx.stroke();
    });
    ctx.restore();
  };

  GeometryFigureEditor.prototype._loadSnapToGrid = function () {
    try { return localStorage.getItem(SNAP_GRID_KEY) === '1'; } catch (err) { return false; }
  };

  GeometryFigureEditor.prototype._toggleSnapToGrid = function () {
    this._snapToGrid = !this._snapToGrid;
    try { localStorage.setItem(SNAP_GRID_KEY, this._snapToGrid ? '1' : '0'); } catch (err) {}
    this._applySnapToGridUI();
  };

  GeometryFigureEditor.prototype._applySnapToGridUI = function () {
    var btn = this._toolbar.querySelector('#gfe-snapgrid-btn');
    if (btn) { btn.classList.toggle('dc-action-btn--active', this._snapToGrid); btn.title = this._snapToGrid ? 'Dezactivează alinierea la grilă' : 'Activează alinierea la grilă'; }
  };

  // Snaps an absolute canvas point to the nearest grid intersection — same
  // cell size as the visible .gfe-canvas-wrap--grid CSS pattern, so vertex
  // dragging lands exactly on the squares the admin can see.
  GeometryFigureEditor.prototype._snapPointToGrid = function (pt) {
    return {
      x: Math.round(pt.x / GRID_CELL_PX) * GRID_CELL_PX,
      y: Math.round(pt.y / GRID_CELL_PX) * GRID_CELL_PX
    };
  };

  GeometryFigureEditor.prototype._setZoom = function (z) {
    z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z * 20) / 20));
    this._zoom = z;
    var canvas = this._fabricCanvas;
    canvas.zoomToPoint({ x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 }, z);
    var label = this._toolbar.querySelector('#gfe-zoom-label');
    if (label) label.textContent = Math.round(z * 100) + '%';
  };

  GeometryFigureEditor.prototype._fitToView = function () {
    var canvas = this._fabricCanvas;
    var objs = canvas.getObjects().filter(function (o) { return !o.__isSnapMarker; });
    if (!objs.length) { this._setZoom(1); canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); return; }
    var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    objs.forEach(function (o) {
      var r = o.getBoundingRect(true, true);
      left = Math.min(left, r.left); top = Math.min(top, r.top);
      right = Math.max(right, r.left + r.width); bottom = Math.max(bottom, r.top + r.height);
    });
    var pad = 40;
    var w = Math.max(1, right - left + pad * 2), h = Math.max(1, bottom - top + pad * 2);
    var zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(canvas.getWidth() / w, canvas.getHeight() / h)));
    canvas.setZoom(zoom);
    var cx = (left + right) / 2, cy = (top + bottom) / 2;
    var vpt = canvas.viewportTransform.slice();
    vpt[4] = canvas.getWidth() / 2 - cx * zoom;
    vpt[5] = canvas.getHeight() / 2 - cy * zoom;
    canvas.setViewportTransform(vpt);
    this._zoom = zoom;
    var label = this._toolbar.querySelector('#gfe-zoom-label');
    if (label) label.textContent = Math.round(zoom * 100) + '%';
  };

  GeometryFigureEditor.prototype._deleteSelected = function () {
    var canvas = this._fabricCanvas;
    var active = canvas.getActiveObjects();
    if (!active.length) return;
    // Discarding the selection BEFORE removing the objects matters for a
    // multi-select: canvas.getActiveObjects() for that case is really a
    // fabric.ActiveSelection wrapper around the individual objects, and
    // discardActiveObject() needs those objects to still exist to properly
    // unwind it. Removing them first left the ActiveSelection's own
    // bounding box + controls dangling on screen, referencing objects that
    // no longer existed — dragging one of those stale handles corrupted
    // rendering (the grid re-drawing itself on top of itself, handle
    // duplicates) badly enough to need a page refresh.
    canvas.discardActiveObject();
    active.forEach(function (o) { canvas.remove(o); });
    canvas.requestRenderAll();
    this._pushHistory();
  };

  // Eraser tool: click an element to delete it directly, no select-then-
  // press-trash round trip.
  GeometryFigureEditor.prototype._eraseObject = function (obj) {
    if (obj.__isSnapMarker) return;
    var canvas = this._fabricCanvas;
    var self = this;
    // Deferred, not synchronous: this runs from inside Fabric's own
    // mouse:down/mouse:move handling (that's what fired the 'mouse:down'/
    // 'mouse:move' event we're reacting to), and `obj` is the exact target
    // Fabric itself just found — its internal handler is still executing
    // and may touch that same object again right after our listener
    // returns. Removing it from the canvas THIS tick throws inside that
    // internal code and leaves Fabric's interaction state corrupted for
    // every tool from then on (this is what broke Select/Pan after a
    // drag-erase pass — the more objects erased per drag, the more
    // chances to hit it). Pushing the actual removal to the next tick lets
    // Fabric finish its own handler first.
    setTimeout(function () {
      canvas.remove(obj);
      canvas.requestRenderAll();
      self._pushHistory();
    }, 0);
  };

  GeometryFigureEditor.prototype._confirmClear = function () {
    var self = this;
    if (document.getElementById('gfeClearConfirmOverlay')) return;
    var ov = document.createElement('div');
    ov.className = 'bac-confirm-overlay';
    ov.id = 'gfeClearConfirmOverlay';
    ov.innerHTML = `
      <div class="bac-confirm-modal" role="dialog" aria-modal="true">
        <div class="bac-confirm-icon">${icon('trash-2', { size: 48, className: 'icon--error' })}</div>
        <div class="bac-confirm-title">Ștergi toată figura?</div>
        <div class="bac-confirm-sub">Acțiunea nu poate fi anulată.</div>
        <div class="bac-confirm-actions">
          <button class="btn btn--surface" id="gfe-clear-cancel">Anulează</button>
          <button class="btn btn--danger" id="gfe-clear-confirm">Șterge</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    var close = function () { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 220); };
    ov.querySelector('#gfe-clear-cancel').onclick = close;
    ov.querySelector('#gfe-clear-confirm').onclick = function () {
      close();
      self._fabricCanvas.clear();
      self._pushHistory();
    };
    ov.onclick = function (e) { if (e.target === ov) close(); };
    requestAnimationFrame(function () { ov.classList.add('open'); });
  };

  GeometryFigureEditor.prototype._bindEvents = function () {
    var self = this;

    this._toolbar.addEventListener('click', function (e) {
      var ddTrigger = e.target.closest('.gfe-dropdown__trigger');
      if (ddTrigger) {
        var dd = ddTrigger.closest('.gfe-dropdown');
        var wasOpen = dd.classList.contains('gfe-dropdown--open');
        self._closeDropdowns();
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

      var shapeBtn  = e.target.closest('[data-shape]');
      var toolBtn   = e.target.closest('[data-tool]');
      var colorBtn  = e.target.closest('[data-color]');
      var tickBtn   = e.target.closest('[data-tick]');
      var undoBtn   = e.target.closest('#gfe-undo-btn');
      var redoBtn   = e.target.closest('#gfe-redo-btn');
      var clearBtn  = e.target.closest('#gfe-clear-btn');
      var zoomInBtn  = e.target.closest('#gfe-zoomin-btn');
      var zoomOutBtn = e.target.closest('#gfe-zoomout-btn');
      var fitBtn     = e.target.closest('#gfe-fit-btn');
      var gridBtn    = e.target.closest('#gfe-grid-btn');
      var snapGridBtn = e.target.closest('#gfe-snapgrid-btn');

      if (shapeBtn) { self._insertShape(shapeBtn.dataset.shape); self._closeDropdowns(); }
      else if (toolBtn) self._setTool(toolBtn.dataset.tool);
      else if (colorBtn) self._applyColorToSelection('adaptive' in colorBtn.dataset ? null : colorBtn.dataset.color);
      else if (tickBtn) {
        self._tickCount = parseInt(tickBtn.dataset.tick, 10);
        self._toolbar.querySelectorAll('[data-tick]').forEach(function (b) { b.classList.toggle('gfe-tick-btn--active', b === tickBtn); });
        self._setTool('tick');
      }
      else if (undoBtn) self._undo();
      else if (redoBtn) self._redo();
      else if (clearBtn) self._confirmClear();
      else if (zoomInBtn) self._setZoom(self._zoom + ZOOM_STEP);
      else if (zoomOutBtn) self._setZoom(self._zoom - ZOOM_STEP);
      else if (fitBtn) self._fitToView();
      else if (gridBtn) self._toggleGrid();
      else if (snapGridBtn) self._toggleSnapToGrid();
    });

    this._docClickHandler = function (e) {
      if (!self._toolbar.contains(e.target)) self._closeDropdowns();
    };
    document.addEventListener('click', this._docClickHandler);

    // Fixed-position panels don't move with a scroll the way an
    // absolutely-positioned one anchored in flow would, so just close on
    // scroll rather than re-computing their position mid-gesture.
    this._scrollCloseHandler = function () { self._closeDropdowns(); };
    window.addEventListener('scroll', this._scrollCloseHandler, true);

    this._fabricCanvas.on('mouse:down', function (opt) {
      if (self._tool === 'pan') {
        self._panning = true;
        self._panStart = { x: opt.e.clientX, y: opt.e.clientY };
        self._fabricCanvas.defaultCursor = 'grabbing';
        return;
      }
      if (self._tool === 'eraser') {
        self._erasing = true;
        if (opt.target) self._eraseObject(opt.target);
        return;
      }
      var pt = self._fabricCanvas.getPointer(opt.e);
      if (self._tool === 'segment' || self._tool === 'segment-dashed') self._handleSegmentClick(pt);
      else if (self._tool === 'text') self._insertText(pt);
      else if (self._tool === 'right-angle') self._insertRightAngle(pt);
      else if (self._tool === 'arc') self._insertArc(pt);
      else if (self._tool === 'tick') self._insertTick(pt);
    });

    this._fabricCanvas.on('mouse:move', function (opt) {
      if (self._panning) {
        var e = opt.e;
        var dx = e.clientX - self._panStart.x, dy = e.clientY - self._panStart.y;
        self._panStart = { x: e.clientX, y: e.clientY };
        self._fabricCanvas.relativePan(new fabric.Point(dx, dy));
        return;
      }
      if ((self._tool === 'segment' || self._tool === 'segment-dashed') && self._segmentStart) {
        self._updateSegmentPreview(self._fabricCanvas.getPointer(opt.e));
      }
      // "Hold and erase" — while the mouse button is down with the eraser
      // active, sweep-erase whatever the cursor passes over instead of
      // requiring a fresh, precisely-aimed click per element (thin 2px
      // strokes over a transparent fill are hard to hit exactly, especially
      // on a 3D wireframe). mouse:down already erased under the initial
      // click; this only needs to keep going for the rest of the drag.
      if (self._tool === 'eraser' && self._erasing) {
        var target = opt.target || self._fabricCanvas.findTarget(opt.e, false);
        if (target) self._eraseObject(target);
      }
    });

    this._fabricCanvas.on('mouse:up', function () {
      if (self._panning) {
        self._panning = false;
        self._fabricCanvas.defaultCursor = 'grab';
      }
      self._erasing = false;
    });

    this._fabricCanvas.on('before:render', function () {
      if (self._gridVisible) self._drawFabricGrid();
    });

    // Ctrl/Cmd+wheel zoom, centered on the cursor — a plain scroll over the
    // canvas is left alone so it scrolls the page like everywhere else,
    // rather than hijacking it into a zoom the moment the cursor crosses in.
    this._fabricCanvas.on('mouse:wheel', function (opt) {
      if (!(opt.e.ctrlKey || opt.e.metaKey)) return;
      var zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, self._fabricCanvas.getZoom() * Math.pow(0.999, opt.e.deltaY)));
      self._fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      self._zoom = zoom;
      var label = self._toolbar.querySelector('#gfe-zoom-label');
      if (label) label.textContent = Math.round(zoom * 100) + '%';
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Vertex/scale/rotate are now all genuine Fabric controls attached
    // directly to each shape (see attachGroup3DControls/attachPolygonVertexControls),
    // not separate sibling objects — so there's no custom visibility-sync or
    // position-sync needed here any more; Fabric's own active-object/control
    // rendering and native group-dragging already do the right thing.
    // Whole-shape repositioning (drag-to-move, not vertex/scale/rotate) —
    // translates left/top by whatever delta lands a REAL, bias-free point of
    // the shape's own geometry on the grid, so it lines up with vertex/scale
    // dragging exactly. Which point is bias-free depends on the shape type:
    // Polygon/Group auto-derive left/top (and aCoords, which is NOT the raw
    // path bounds either — it's padded outward by strokeWidth/2) from their
    // points, so an actual point/vertex has to be read directly; Rect/Circle
    // don't derive left/top from anything, it's the literal, unpadded corner
    // coordinate, so it's already exactly what vertex/scale dragging would
    // agree on.
    this._fabricCanvas.on('object:moving', function (opt) {
      if (!self._snapToGrid) return;
      var target = opt.target;
      if (!target || target.__isSnapMarker) return;
      target.setCoords();
      var ref;
      if (target.type === 'polygon' && target.points && target.points.length) {
        ref = fabric.util.transformPoint(
          { x: target.points[0].x - target.pathOffset.x, y: target.points[0].y - target.pathOffset.y },
          target.calcTransformMatrix()
        );
      } else if (target.type === 'group' && target.data && target.data.points) {
        var firstKey = Object.keys(target.data.points)[0];
        ref = fabric.util.transformPoint(target.data.points[firstKey], target.calcTransformMatrix());
      } else {
        ref = { x: target.left, y: target.top };
      }
      var snapped = self._snapPointToGrid(ref);
      var dx = snapped.x - ref.x, dy = snapped.y - ref.y;
      if (dx || dy) target.set({ left: target.left + dx, top: target.top + dy });
    });

    this._fabricCanvas.on('object:modified', function (opt) {
      if (opt.target && opt.target.type === 'polygon') {
        bakePolygonScale(opt.target); // no-op unless a corner/edge scale handle (not a vertex) was just dragged
        recomputePolygonBounds(opt.target);
        opt.target.setCoords();
      } else if (opt.target && opt.target.type === 'rect') {
        bakeRectScale(opt.target);
        opt.target.setCoords();
      }
      // Scaling/rotating a 3D group's whole bounding box (the green/blue
      // handles) applies a plain scaleX/scaleY/angle transform to the
      // existing children by default — which stretches their stroke width
      // and dash spacing right along with the geometry, unlike per-vertex
      // dragging (which already rebuilds fresh, undistorted geometry on
      // every tick via rebuildGroupChildren). Doing the same rebuild here,
      // once the gesture finishes, bakes the transform into fresh geometry
      // with a constant stroke width and un-stretched dashes (matching
      // IDroo) without interfering mid-drag — rebuilding on every tick was
      // tried first, but resetting scaleX/scaleY mid-gesture confuses
      // Fabric's own scale-handle math (which computes each tick's scale
      // from the state captured once at drag-start), degrading the grid-
      // snap precision that same drag already relies on.
      if (opt.target && opt.target.type === 'group' && opt.target.data && THREE_D[opt.target.data.kind]) {
        rebuildGroupChildren(opt.target);
      }
      self._pushHistory();
    });
    this._fabricCanvas.on('object:added', function (opt) {
      if (opt.target && opt.target.__isSnapMarker) return;
      // creation-time history pushes are handled explicitly by each insert
      // function (right after configuring the new object), so this hook
      // only needs to catch loadFromJSON-driven adds, which are already
      // guarded by _suspendHistory.
    });

    this._keyHandler = function (e) {
      var active = document.activeElement;
      var typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); self._undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); self._redo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (self._fabricCanvas.getActiveObjects().length) { e.preventDefault(); self._deleteSelected(); }
      }
      if (e.key === 'Escape') { self._setTool('select'); self._closeDropdowns(); }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        var key = e.key.toLowerCase();
        if (key === 'q') { e.preventDefault(); self._setTool('select'); }
        else if (key === 'w') { e.preventDefault(); self._setTool('pan'); }
        else if (key === 'e') { e.preventDefault(); self._setTool('eraser'); }
      }
    };
    window.addEventListener('keydown', this._keyHandler);

    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () {
        clearTimeout(self._resizeTimer);
        self._resizeTimer = setTimeout(function () { self._resizeCanvas(); }, 80);
      });
      this._ro.observe(this._canvasWrap);
    }

    this._mo = new MutationObserver(function () { self._adaptColors(); });
    this._mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  };

  /* ---- export ---- */

  GeometryFigureEditor.prototype.exportFigureData = function () {
    return this._fabricCanvas.toJSON(['data']);
  };

  // Fabric's toSVG() always normalizes colors to "rgb(r, g, b)" in the
  // exported style attribute, never the original hex string — so the
  // sentinel swap below has to match THAT form, not the hex we assigned.
  function hexToRgbPattern(hex) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return new RegExp('rgb\\(\\s*' + r + '\\s*,\\s*' + g + '\\s*,\\s*' + b + '\\s*\\)', 'gi');
  }

  // Frames the export tight around whatever was actually drawn, instead of
  // baking in the full admin canvas (700-900px+ tall on the "Adaugă
  // exercițiu" page, per .ae-geo-editor .gfe-canvas-wrap's 70vh/min-640px —
  // and that height varies with whatever the admin's own browser window
  // happened to be at authoring time). Left uncropped, students see a huge
  // mostly-empty box around a small centered figure, and two figures drawn
  // at different admin window sizes come out at inconsistent visual scale
  // relative to each other even though the drawings themselves are the same
  // size in canvas units. Cropping to the content's own bounding box (plus
  // a fixed padding) makes the exported size depend only on how big the
  // drawing itself is, never on the authoring viewport.
  var FIGURE_EXPORT_PADDING = 24;

  // Raw canvas strokeWidth is always literally "2" at draw time (see the
  // scattered `strokeWidth: 2` calls throughout this file) — a deliberate,
  // tuned-by-eye value for the LIVE editor at its own natural zoom. But
  // every consumer of the exported SVG (card thumbnail, modal) displays it
  // at a FIXED box size via CSS max-width/max-height — so a figure drawn
  // large on the canvas gets shrunk down MORE to fit that box than one
  // drawn small does. A flat "2" stroke on a big drawing ends up shrunk to
  // near-nothing; the same flat "2" on a small drawing barely shrinks at
  // all and reads as bold. The raw stroke has to grow WITH the drawing's
  // own size — not shrink — so that after each figure's own (different)
  // amount of display-time shrinking, they all land back at the same
  // visual weight. Rescaling proportionally to the content bbox at export
  // time does that, independent of how big the admin happened to draw it.
  var STROKE_REFERENCE_SIZE = 340; // bbox size (px) at which strokeWidth:2 looks right, tuned by eye
  var STROKE_SCALE_MIN = 0.25;
  var STROKE_SCALE_MAX = 5;

  // Returns the strokeScale to apply (see normalizeStrokeWidthInSvg below) —
  // computed from the content bbox, but deliberately NOT applied here by
  // mutating each Fabric object's .strokeWidth. Circles are drawn with
  // strokeUniform:true (see attachCircleUniformControls) so their stroke
  // stays visually constant on the LIVE, interactive canvas regardless of
  // any scaleX/scaleY — but that's a canvas-rendering-only compensation,
  // and Fabric's toSVG() doesn't reliably re-derive the same effective width
  // from a mutated .strokeWidth property the way a plain Polyline/Line does.
  // Rewriting the actual stroke-width/stroke-dasharray attributes in the
  // FINAL exported SVG markup (see exportFigureSvg) sidesteps that per-shape
  // inconsistency entirely — it scales whatever Fabric actually wrote out,
  // for every shape type uniformly, guaranteed.
  function cropStaticCanvasToContent(staticCanvas) {
    var objects = staticCanvas.getObjects();
    if (!objects.length) return 1;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach(function (o) {
      o.setCoords();
      var r = o.getBoundingRect(true, true);
      if (r.left < minX) minX = r.left;
      if (r.top < minY) minY = r.top;
      if (r.left + r.width > maxX) maxX = r.left + r.width;
      if (r.top + r.height > maxY) maxY = r.top + r.height;
    });
    var dx = FIGURE_EXPORT_PADDING - minX, dy = FIGURE_EXPORT_PADDING - minY;
    objects.forEach(function (o) {
      o.set({ left: o.left + dx, top: o.top + dy });
      o.setCoords();
    });
    staticCanvas.setDimensions({
      width: (maxX - minX) + FIGURE_EXPORT_PADDING * 2,
      height: (maxY - minY) + FIGURE_EXPORT_PADDING * 2
    });
    var contentSize = Math.max(maxX - minX, maxY - minY);
    if (contentSize <= 0) return 1;
    var scale = contentSize / STROKE_REFERENCE_SIZE;
    if (scale < STROKE_SCALE_MIN) scale = STROKE_SCALE_MIN;
    if (scale > STROKE_SCALE_MAX) scale = STROKE_SCALE_MAX;
    return scale;
  }

  function normalizeStrokeWidthInSvg(svg, scale) {
    // Every 2D shape (circle, pătrat, triunghi, trapez, paralelogram — see
    // strokeUniform:true in _insertShape) exports with
    // vector-effect="non-scaling-stroke". That's a real SVG rendering
    // instruction: "always paint this stroke at exactly stroke-width CSS
    // pixels, no matter what transform/scale is applied to this element or
    // its ancestors" — it's what makes strokeUniform work while actively
    // dragging a resize handle in the LIVE editor (so the line doesn't
    // stretch mid-drag). But once exported as a frozen, static SVG, it
    // actively backfires: displayed at a shrunk-down card-thumbnail size,
    // 3D shapes (built from plain paths, no vector-effect) scale their
    // stroke down along with the geometry like normal, while 2D shapes'
    // strokes stay pinned at their literal on-canvas pixel width — reading
    // as noticeably thicker than everything else, regardless of how big or
    // small the shape itself was drawn (confirmed by exporting a resized
    // circle directly: the stroke-width value changes but the rendered
    // line does not, because vector-effect overrides it). None of that
    // "freeze the stroke width" behavior is wanted in a static, already-
    // drawn export, so strip it — every stroke then scales normally with
    // the rest of the SVG, same as the 3D shapes always have.
    svg = svg.replace(/\s*vector-effect="non-scaling-stroke"/g, '');

    if (scale === 1) return svg;
    // Attribute form (stroke-width="2") — how Fabric renders it for most
    // shape/line/polyline exports.
    svg = svg.replace(/stroke-width="([\d.]+)"/g, function (_, w) {
      return 'stroke-width="' + (parseFloat(w) * scale).toFixed(2) + '"';
    });
    // CSS-style form (style="...stroke-width: 2;...") — some Fabric versions
    // bake stroke-width into the style attribute instead for certain
    // shapes/groups, so both forms need covering for this to be reliable
    // across every object type the editor can produce.
    svg = svg.replace(/stroke-width:\s*([\d.]+)/g, function (_, w) {
      return 'stroke-width: ' + (parseFloat(w) * scale).toFixed(2);
    });
    svg = svg.replace(/stroke-dasharray="([^"]+)"/g, function (_, arr) {
      var scaled = arr.split(/[\s,]+/).filter(Boolean)
        .map(function (v) { return (parseFloat(v) * scale).toFixed(2); }).join(',');
      return 'stroke-dasharray="' + scaled + '"';
    });
    // CSS-style form (style="...stroke-dasharray: 6 5;...", space-separated,
    // no attribute at all) — this is what Fabric 5.3.0 actually emits for
    // every dashed shape (hidden 3D edges, the dashed segment tool), so
    // without this the attribute-form regex above never matches anything
    // and dash length/gap stays fixed regardless of how much the rest of
    // the figure scales, reading as too-dense on a large figure and too-
    // sparse on a small one relative to the (correctly scaled) stroke width.
    // "none" (non-dashed shapes) is required to start with a digit right
    // after the whitespace, so "none" itself never matches — without that,
    // \s* backtracking to zero-width lets [\d.\s]+ capture just the single
    // space before "none" and "match" it anyway (harmless here only because
    // the empty-scaled replacement happens to reconstruct the same string).
    svg = svg.replace(/stroke-dasharray:\s*(\d[\d.\s]*)/g, function (_, arr) {
      var scaled = arr.trim().split(/[\s,]+/).filter(Boolean)
        .map(function (v) { return (parseFloat(v) * scale).toFixed(2); }).join(' ');
      return 'stroke-dasharray: ' + scaled;
    });
    return svg;
  }

  GeometryFigureEditor.prototype.exportFigureSvg = function () {
    var self = this;
    return new Promise(function (resolve) {
      // An editor mounted for a geometry exercise but never actually drawn
      // in still round-trips through here at save time — without this,
      // it silently exports a valid-but-blank SVG (full canvas size, no
      // shapes), which is truthy, so the student view rendered an empty
      // bordered box with nothing in it. Resolving '' here makes that
      // falsy, matching what BM.renderExerciseFigure already treats as
      // "no figure" (see js/utils.js), so nothing renders instead.
      if (!self._fabricCanvas.getObjects().length) { resolve(''); return; }
      try {
        var json = self._fabricCanvas.toJSON(['data']);
        var el = document.createElement('canvas');
        var staticCanvas = new fabric.StaticCanvas(el);
        staticCanvas.setDimensions({ width: self._fabricCanvas.getWidth(), height: self._fabricCanvas.getHeight() });
        var SENTINEL = { primary: '#a1b2c3', auxiliary: '#a1b2c4' };
        staticCanvas.loadFromJSON(json, function () {
          var strokeScale = cropStaticCanvasToContent(staticCanvas);
          function paintSentinel(obj, inheritedRole) {
            // 3D shapes' child primitives never carry their own data.role —
            // only the parent Group does — so it must propagate down, same
            // fix as _repaintRoleColor.
            var role = (obj.data && obj.data.role) || inheritedRole;
            if (obj._objects) obj._objects.forEach(function (child) { paintSentinel(child, role); });
            if (role === 'primary' || role === 'auxiliary') {
              if (obj.stroke) obj.set('stroke', SENTINEL[role]);
              if (obj.type === 'i-text' || obj.type === 'text') obj.set('fill', SENTINEL[role]);
            }
          }
          staticCanvas.getObjects().forEach(paintSentinel);
          staticCanvas.renderAll();
          var raw = staticCanvas.toSVG();
          raw = normalizeStrokeWidthInSvg(raw, strokeScale);
          raw = raw.replace(hexToRgbPattern(SENTINEL.primary), 'var(--text)');
          raw = raw.replace(hexToRgbPattern(SENTINEL.auxiliary), 'var(--text-secondary)');
          staticCanvas.dispose();
          resolve(raw);
        });
      } catch (err) {
        console.error('GeometryFigureEditor: SVG export failed', err);
        resolve('');
      }
    });
  };

  GeometryFigureEditor.prototype.destroy = function () {
    this._destroyed = true;
    window.removeEventListener('keydown', this._keyHandler);
    document.removeEventListener('click', this._docClickHandler);
    window.removeEventListener('scroll', this._scrollCloseHandler, true);
    if (this._ro) this._ro.disconnect();
    if (this._mo) this._mo.disconnect();
    clearTimeout(this._resizeTimer);
    this._fabricCanvas.dispose();
    if (this._wrap && this._wrap.parentNode) this._wrap.parentNode.removeChild(this._wrap);
  };

  global.GeometryFigureEditor = GeometryFigureEditor;

})(window);
