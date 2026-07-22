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
  var SNAP_PX          = 13;   // screen-space snap radius, independent of zoom
  var EDGE_PX          = 14;   // screen-space "near a segment" radius for the tick tool
  var MIN_ZOOM = 0.4, MAX_ZOOM = 3, ZOOM_STEP = 0.2;

  // Default/"adaptive" role colors — mirrors DrawingCanvas._adaptColors()'s
  // black⇄white swatch approach. These are only used for the LIVE editing
  // canvas (a <canvas> 2D context can't read CSS custom properties); the
  // exported SVG instead embeds var(--text)/var(--text-secondary) directly
  // so the student-facing page re-colors for free with the site theme.
  var ROLE_LIGHT = { primary: '#1C1917', auxiliary: '#6b6459' };
  var ROLE_DARK  = { primary: '#e5e7eb', auxiliary: '#9ca3af' };
  var HANDLE_COLOR = '#3B82F6';
  // Distinct from HANDLE_COLOR (used for transient snap feedback / segment
  // preview) so a persistent, draggable 3D vertex handle never looks like
  // one of those momentary UI hints.
  var THREE_D_HANDLE_COLOR = '#f97316';
  var THREE_D_HANDLE_OFFSET = 13; // px, radial push away from the shape's own centroid

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

  // Pushes a 3D shape's vertex handles a few px away from the point they
  // control (radially outward from the shape's own centroid) so the handle
  // doesn't visually sit exactly on top of 2-3 converging edges, and is
  // easier to pick out/grab on its own. The offset is computed once, at
  // creation time, and stays fixed thereafter — recomputing it "live" from
  // the shape's current centroid on every drag tick would require inverting
  // a circular dependency (the offset direction would depend on the very
  // point it's offsetting), so a fixed offset is the simple, stable choice.
  function centroidOf(points) {
    var cx = 0, cy = 0, n = 0;
    Object.keys(points).forEach(function (k) { cx += points[k].x; cy += points[k].y; n++; });
    return { x: cx / n, y: cy / n };
  }
  function radialOffset(point, centroid, dist) {
    var dx = point.x - centroid.x, dy = point.y - centroid.y;
    var len = Math.hypot(dx, dy) || 1;
    return { dx: (dx / len) * dist, dy: (dy / len) * dist };
  }

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
  function refreshCoordsWrapper(fn) {
    return function (eventData, transform, x, y) {
      var result = fn(eventData, transform, x, y);
      transform.target.setCoords();
      return result;
    };
  }

  function attachPolygonVertexControls(poly) {
    poly.hasBorders    = false;
    poly.objectCaching = false;
    poly.controls = poly.points.reduce(function (acc, point, index) {
      acc['p' + index] = new fabric.Control({
        positionHandler: polygonPositionHandler,
        actionHandler: refreshCoordsWrapper(polygonActionHandler),
        actionName: 'modifyPolygon',
        pointIndex: index
      });
      return acc;
    }, {});
  }

  function attachCircleUniformControls(circle) {
    ['tl', 'tr', 'bl', 'br'].forEach(function (k) {
      if (circle.controls[k] && fabric.controlsUtils && fabric.controlsUtils.scalingEqually) {
        circle.controls[k] = fabric.util.object.clone(circle.controls[k]);
        circle.controls[k].actionHandler = fabric.controlsUtils.scalingEqually;
      }
    });
    circle.setControlsVisibility({ ml: false, mt: false, mr: false, mb: false, mtr: false });
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
      build: function (pts, stroke) {
        var F = [pts.F0, pts.F1, pts.F2, pts.F3];
        var B = [pts.B0, pts.B1, pts.B2, pts.B3];
        var front = new fabric.Polygon(F, { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeLineJoin: 'round' });
        var back  = new fabric.Polygon(B, { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5], strokeLineJoin: 'round' });
        var edges = F.map(function (p, i) { return new fabric.Line([p.x, p.y, B[i].x, B[i].y], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' }); });
        return [front, back].concat(edges);
      }
    },
    'piramida-patrata': {
      defaultPoints: function (o) {
        return {
          p0: { x: o.x - 70, y: o.y + 15 },  // base left
          p1: { x: o.x,      y: o.y + 42 },  // base front
          p2: { x: o.x + 70, y: o.y + 15 },  // base right
          p3: { x: o.x,      y: o.y - 15 },  // base back
          apex: { x: o.x, y: o.y - 110 }
        };
      },
      handles: ['p0', 'p1', 'p2', 'p3', 'apex'],
      build: function (pts, stroke) {
        var p0 = pts.p0, p1 = pts.p1, p2 = pts.p2, p3 = pts.p3, apex = pts.apex;
        var baseVisible = new fabric.Polyline([p0, p1, p2], { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeLineJoin: 'round' });
        var baseHidden  = new fabric.Polyline([p2, p3, p0], { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5], strokeLineJoin: 'round' });
        var edgeP0 = new fabric.Line([apex.x, apex.y, p0.x, p0.y], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' });
        var edgeP1 = new fabric.Line([apex.x, apex.y, p1.x, p1.y], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' });
        var edgeP2 = new fabric.Line([apex.x, apex.y, p2.x, p2.y], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' });
        var edgeP3 = new fabric.Line([apex.x, apex.y, p3.x, p3.y], { stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5], strokeLineCap: 'round' });
        return [baseVisible, baseHidden, edgeP0, edgeP1, edgeP2, edgeP3];
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
      build: function (pts, stroke) {
        var p0 = pts.p0, p1 = pts.p1, p2 = pts.p2, apex = pts.apex;
        var edgeFront = new fabric.Line([p0.x, p0.y, p1.x, p1.y], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' });
        var edgeBkL   = new fabric.Line([p1.x, p1.y, p2.x, p2.y], { stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5], strokeLineCap: 'round' });
        var edgeBkR   = new fabric.Line([p2.x, p2.y, p0.x, p0.y], { stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5], strokeLineCap: 'round' });
        var apex0 = new fabric.Line([apex.x, apex.y, p0.x, p0.y], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' });
        var apex1 = new fabric.Line([apex.x, apex.y, p1.x, p1.y], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' });
        var apex2 = new fabric.Line([apex.x, apex.y, p2.x, p2.y], { stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5], strokeLineCap: 'round' });
        return [edgeFront, edgeBkL, edgeBkR, apex0, apex1, apex2];
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
      // the shape it's actually resizing (called from _regenerate3DFromHandle).
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
        var circle = new fabric.Circle({ left: o.x - R, top: o.y - R, radius: R, fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var front = ellipseArcPoints(o.x, o.y, R, ry, 0, Math.PI, 20);
        var back  = ellipseArcPoints(o.x, o.y, R, ry, Math.PI, 2 * Math.PI, 20);
        var eqFront = new fabric.Polyline(front, { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeLineJoin: 'round' });
        var eqBack  = new fabric.Polyline(back,  { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5], strokeLineJoin: 'round' });
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
        var base = new fabric.Ellipse({ left: o.x - rx, top: baseY - ry, rx: rx, ry: ry, fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var slantL = new fabric.Line([apex.x, apex.y, o.x - rx, baseY], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' });
        var slantR = new fabric.Line([apex.x, apex.y, o.x + rx, baseY], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' });
        return [base, slantL, slantR];
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
        var top = new fabric.Ellipse({ left: o.x - rx, top: topY - ry, rx: rx, ry: ry, fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var bot = new fabric.Ellipse({ left: o.x - rx, top: botY - ry, rx: rx, ry: ry, fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var lineL = new fabric.Line([o.x - rx, topY, o.x - rx, botY], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' });
        var lineR = new fabric.Line([o.x + rx, topY, o.x + rx, botY], { stroke: stroke, strokeWidth: 2, strokeLineCap: 'round' });
        return [top, bot, lineL, lineR];
      }
    }
  };

  var SHAPE_LABELS = {
    'tri-isoscel': 'Triunghi isoscel', 'tri-echilateral': 'Triunghi echilateral', 'tri-oarecare': 'Triunghi oarecare',
    cerc: 'Cerc', patrat: 'Pătrat', paralelogram: 'Paralelogram',
    'trapez-isoscel': 'Trapez isoscel', 'trapez-dreptunghic': 'Trapez dreptunghic',
    cub: 'Cub', 'piramida-patrata': 'Piramidă (bază pătrată)', 'piramida-triunghiulara': 'Piramidă (bază triunghiulară)',
    sfera: 'Sferă', con: 'Con', cilindru: 'Cilindru'
  };

  // Small outline glyphs (viewBox 0 0 24 24, stroke=currentColor) matching
  // DrawingCanvas's pen/eraser icon style — 2D shapes as plain outlines, 3D
  // solids as simplified versions of the same oblique-projection convention
  // used for the actual inserted shapes (offset/second face + dashed hidden
  // edges), just legible at icon scale.
  var SHAPE_ICONS = {
    'tri-isoscel':    '<path d="M12 4 4 20 20 20Z"/>',
    'tri-echilateral':'<path d="M12 3.5 3.5 20.5 20.5 20.5Z"/><path d="M7.2 12.4 8.4 12.9"/><path d="M16.8 12.4 15.6 12.9"/><path d="M10.5 20.5 10.5 19.1"/><path d="M13.5 20.5 13.5 19.1"/>',
    'tri-oarecare':   '<path d="M15 4 3 20 21 17Z"/>',
    cerc:             '<circle cx="12" cy="12" r="8.5"/>',
    patrat:           '<rect x="4.5" y="4.5" width="15" height="15"/>',
    paralelogram:     '<path d="M8 6 20 6 16 18 4 18Z"/>',
    'trapez-isoscel': '<path d="M9 6 15 6 20 18 4 18Z"/>',
    'trapez-dreptunghic': '<path d="M6 6 15 6 20 18 6 18Z"/>',
    cub: '<path d="M4 10 14 10 14 20 4 20Z"/><path d="M9 5 19 5 19 15 14 15" stroke-dasharray="2.2 2"/><path d="M4 10 9 5"/><path d="M14 10 19 5"/><path d="M14 20 19 15"/>',
    'piramida-patrata': '<path d="M4 18 12 21 20 18" stroke-dasharray="2.2 2"/><path d="M4 18 9 15 20 18"/><path d="M12 3 4 18"/><path d="M12 3 20 18"/><path d="M12 3 9 15" stroke-dasharray="2.2 2"/>',
    'piramida-triunghiulara': '<path d="M4 19 20 19"/><path d="M12 3 4 19"/><path d="M12 3 20 19"/><path d="M12 3 12 19" stroke-dasharray="2.2 2"/>',
    sfera: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 14.5C6.5 16.3 17.5 16.3 20.2 14.5"/><path d="M3.8 9.6C6.5 7.8 17.5 7.8 20.2 9.6" stroke-dasharray="2.2 2"/>',
    con: '<path d="M4.5 18a7.5 2 0 0 0 15 0"/><path d="M12 4 4.5 18"/><path d="M12 4 19.5 18"/>',
    cilindru: '<path d="M4.5 7a7.5 2 0 0 0 15 0a7.5 2 0 0 0 -15 0"/><path d="M4.5 17a7.5 2 0 0 0 15 0"/><path d="M4.5 7v10"/><path d="M19.5 7v10"/>'
  };

  var TOOL_ICONS = {
    select: '<path d="M5 3 5 19 9 15 12 21.5 14.7 20.2 12 14.5 17 14Z" fill="currentColor" stroke="none"/>',
    // "Hand" pan tool — palm + fingers, standard pan/scroll-tool convention.
    pan: '<rect x="6" y="11" width="12" height="9" rx="3"/><path d="M9 11V6a1.5 1.5 0 0 1 3 0v5"/><path d="M12 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M15 11.5V7a1.5 1.5 0 0 1 3 0v6"/>',
    // Same eraser glyph as DrawingCanvas's own eraser tool (js/drawing-canvas.js), reused for icon-language consistency.
    eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
    segment: '<path d="M5 19 19 5"/><circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none"/>',
    text: '<path d="M5 6h14"/><path d="M12 6v13"/><path d="M9 19h6"/>',
    'right-angle': '<path d="M5 5v14h14"/><path d="M5 12h7v7"/>',
    arc: '<path d="M5 19 19 19"/><path d="M5 19V5"/><path d="M9 19a10 10 0 0 1 8-9.8"/>',
    tick: '<path d="M6 4 6 20"/><path d="M12 4 12 20"/><path d="M3 9 9 9"/><path d="M3 15 9 15"/><path d="M9 9 15 9"/><path d="M9 15 15 15"/>'
  };

  function _gfeIcon(inner) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  var TOOLBAR_HTML = `
    <div class="gfe-tool-section">
      <span class="gfe-tool-section__label">Instrumente</span>
      <div class="dc-tool-group">
        <button class="dc-tool-btn dc-tool-btn--active" data-tool="select" title="Selectează / mută">${_gfeIcon(TOOL_ICONS.select)}</button>
        <button class="dc-tool-btn" data-tool="pan" title="Mișcă vizualizarea (utilă la zoom)">${_gfeIcon(TOOL_ICONS.pan)}</button>
        <button class="dc-tool-btn" data-tool="eraser" title="Radieră — apasă pe un element pentru a-l șterge">${_gfeIcon(TOOL_ICONS.eraser)}</button>
      </div>
    </div>
    <div class="gfe-tool-section">
      <span class="gfe-tool-section__label">Forme 2D</span>
      <div class="dc-tool-group gfe-shape-group">
        ${['tri-isoscel','tri-echilateral','tri-oarecare','cerc','patrat','paralelogram','trapez-isoscel','trapez-dreptunghic']
          .map(function (id) { return `<button class="dc-tool-btn gfe-shape-btn" data-shape="${id}" title="${SHAPE_LABELS[id]}">${_gfeIcon(SHAPE_ICONS[id])}</button>`; }).join('')}
      </div>
    </div>
    <div class="gfe-tool-section">
      <span class="gfe-tool-section__label">Corpuri 3D</span>
      <div class="dc-tool-group gfe-shape-group">
        ${['cub','piramida-patrata','piramida-triunghiulara','sfera','con','cilindru']
          .map(function (id) { return `<button class="dc-tool-btn gfe-shape-btn" data-shape="${id}" title="${SHAPE_LABELS[id]}">${_gfeIcon(SHAPE_ICONS[id])}</button>`; }).join('')}
      </div>
    </div>
    <div class="gfe-tool-section">
      <span class="gfe-tool-section__label">Linii și segmente</span>
      <div class="dc-tool-group">
        <button class="dc-tool-btn" data-tool="segment" title="Segment (mediană, bisectoare, înălțime...)">${_gfeIcon(TOOL_ICONS.segment)}</button>
        <button class="dc-action-btn" id="gfe-dash-toggle" aria-pressed="false" title="Segment punctat">┄</button>
      </div>
    </div>
    <div class="gfe-tool-section">
      <span class="gfe-tool-section__label">Adnotări</span>
      <div class="dc-tool-group">
        <button class="dc-tool-btn" data-tool="right-angle" title="Unghi drept">${_gfeIcon(TOOL_ICONS['right-angle'])}</button>
        <button class="dc-tool-btn" data-tool="arc" title="Arc unghi">${_gfeIcon(TOOL_ICONS.arc)}</button>
      </div>
    </div>
    <div class="gfe-tool-section">
      <span class="gfe-tool-section__label">Text</span>
      <div class="dc-tool-group">
        <button class="dc-tool-btn" data-tool="text" title="Etichetă text">${_gfeIcon(TOOL_ICONS.text)}</button>
      </div>
    </div>
    <div class="gfe-tool-section">
      <span class="gfe-tool-section__label">Culori</span>
      <div class="dc-tool-group">
        <button class="dc-color-btn dc-color-btn--active" data-color="" data-adaptive title="Culoare implicită" aria-label="Culoare implicită"></button>
        <button class="dc-color-btn" data-color="#ffffff" style="background:#ffffff;border-color:var(--border)" title="Alb" aria-label="Culoare alb"></button>
        <button class="dc-color-btn" data-color="#dc2626" style="background:#dc2626" title="Roșu" aria-label="Culoare roșu"></button>
        <button class="dc-color-btn" data-color="#1d4ed8" style="background:#1d4ed8" title="Albastru" aria-label="Culoare albastru"></button>
        <button class="dc-color-btn" data-color="#16a34a" style="background:#16a34a" title="Verde" aria-label="Culoare verde"></button>
        <input type="color" id="gfe-color-picker" class="gfe-color-picker" value="#dc2626" title="Altă culoare" aria-label="Alege altă culoare">
      </div>
    </div>
    <div class="gfe-tool-section gfe-tool-section--actions">
      <span class="gfe-tool-section__label">Acțiuni</span>
      <div class="dc-tool-group">
        <button class="dc-action-btn" id="gfe-zoomout-btn" title="Micșorează">−</button>
        <span class="dc-zoom-label" id="gfe-zoom-label">100%</span>
        <button class="dc-action-btn" id="gfe-zoomin-btn" title="Mărește">+</button>
        <button class="dc-action-btn" id="gfe-fit-btn" title="Potrivește la ecran">⤢</button>
        <button class="dc-action-btn" id="gfe-grid-btn" title="Arată grila">▦</button>
        <button class="dc-action-btn" id="gfe-undo-btn" title="Anulează (Ctrl+Z)">↺</button>
        <button class="dc-action-btn" id="gfe-redo-btn" title="Reface (Ctrl+Y)">↻</button>
        <button class="dc-action-btn dc-action-btn--danger" id="gfe-clear-btn" title="Șterge tot">⨯</button>
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
    this._dashed     = false;
    this._color      = null; // null = adaptive/default; else literal hex
    this._gridVisible = this._loadGridVisible();
    this._zoom       = 1;
    this._destroyed  = false;
    this._undoStack  = [];
    this._redoStack  = [];
    this._suspendHistory = false;
    this._segmentStart   = null;
    this._previewLine    = null;

    this._build();
    this._bindEvents();
    this._applyGridVisible();

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
      stopContextMenu: true
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

  GeometryFigureEditor.prototype._repaintRoleColor = function (obj) {
    var self = this;
    if (obj._objects) obj._objects.forEach(function (child) { self._repaintRoleColor(child); });
    var role = obj.data && obj.data.role;
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
    if (obj.type === 'polygon') attachPolygonVertexControls(obj);
    if (obj.type === 'circle')  attachCircleUniformControls(obj);
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
      if (obj.__isSnapMarker || (obj.data && obj.data.kind === 'handle')) return;

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
          entries.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, type: 'midpoint' });
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
            entries.push({ x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2, type: 'midpoint' });
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
          entries.push({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, type: 'midpoint' });
        } catch (err) {}
      } else if (obj.type === 'circle') {
        var center = obj.getCenterPoint();
        entries.push({ x: center.x, y: center.y, type: 'vertex', edgeDirs: [] });
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
    var hit = this._nearestSnapPoint(absPt, excludeObj);
    if (hit) { this._flashSnapMarker(hit); return { x: hit.x, y: hit.y }; }
    return null;
  };

  GeometryFigureEditor.prototype._flashSnapMarker = function (pt) {
    var canvas = this._fabricCanvas;
    var marker = new fabric.Circle({
      left: pt.x - 6, top: pt.y - 6, radius: 6, fill: 'transparent',
      stroke: HANDLE_COLOR, strokeWidth: 2, selectable: false, evented: false
    });
    marker.__isSnapMarker = true;
    canvas.add(marker);
    canvas.requestRenderAll();
    setTimeout(function () {
      if (canvas.contains && canvas.contains(marker)) canvas.remove(marker);
      canvas.requestRenderAll();
    }, 320);
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
      if (obj.__isSnapMarker || (obj.data && obj.data.kind === 'handle')) return;
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
    'trapez-dreptunghic':  [{ x: -70, y: 50 }, { x: -70, y: -50 }, { x: 40, y: -50 }, { x: 80, y: 50 }]
  };

  GeometryFigureEditor.prototype._insertShape = function (shapeId) {
    var center = this._viewCenterPoint();
    var spec = this._strokeSpec('primary');
    var obj;

    if (POLY_PRESETS[shapeId]) {
      var pts = POLY_PRESETS[shapeId].map(function (p) { return { x: p.x + center.x, y: p.y + center.y }; });
      obj = new fabric.Polygon(pts, {
        fill: 'transparent', stroke: spec.stroke, strokeWidth: 2, strokeUniform: true, strokeLineJoin: 'round',
        objectCaching: false, data: { role: spec.role, kind: 'shape', id: genId() }
      });
      attachPolygonVertexControls(obj);
    } else if (shapeId === 'cerc') {
      obj = new fabric.Circle({
        left: center.x - 60, top: center.y - 60, radius: 60,
        fill: 'transparent', stroke: spec.stroke, strokeWidth: 2, strokeUniform: true,
        data: { role: spec.role, kind: 'shape', id: genId() }
      });
      attachCircleUniformControls(obj);
    } else if (shapeId === 'patrat') {
      obj = new fabric.Rect({
        left: center.x - 60, top: center.y - 60, width: 120, height: 120,
        fill: 'transparent', stroke: spec.stroke, strokeWidth: 2, strokeUniform: true,
        data: { role: spec.role, kind: 'shape', id: genId() }
      });
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
    var groupId = genId();
    var group = new fabric.Group(objects, { data: { role: spec.role, kind: kind, id: groupId, points: points } });
    // Native resize/rotate controls sit right where these per-vertex handles
    // need to be clickable — Fabric prioritizes hit-testing the ACTIVE
    // object's own controls over sibling objects underneath, so without this
    // the handles would be unreachable. The group is still draggable by its body.
    group.hasControls = false;
    this._fabricCanvas.add(group);
    group.data._lastLeft = group.left;
    group.data._lastTop  = group.top;

    var self = this;
    var centroid = centroidOf(points);
    factory.handles.forEach(function (key) {
      var p = points[key];
      var off = radialOffset(p, centroid, THREE_D_HANDLE_OFFSET);
      var handle = new fabric.Circle({
        left: p.x + off.dx - 6, top: p.y + off.dy - 6, radius: 6,
        fill: THREE_D_HANDLE_COLOR, stroke: '#fff', strokeWidth: 1.5,
        // A drag handle only ever translates — never resizes/rotates, and
        // never shows its own selection chrome — and is only meaningful
        // while its shape is the active selection (see _syncHandleVisibility).
        hasControls: false, hasBorders: false,
        lockScalingX: true, lockScalingY: true, lockRotation: true,
        visible: false,
        data: { kind: 'handle', handleFor: groupId, pointKey: key, offsetDx: off.dx, offsetDy: off.dy }
      });
      self._fabricCanvas.add(handle);
    });

    this._fabricCanvas.setActiveObject(group);
    this._syncHandleVisibility();
    this._fabricCanvas.requestRenderAll();
    this._pushHistory();
  };

  // Handles are only useful (and only clickable — visible:false objects are
  // excluded from Fabric's hit-testing too) while their own shape is the
  // active selection, so the canvas doesn't stay permanently cluttered with
  // drag points for every 3D solid on the page.
  GeometryFigureEditor.prototype._syncHandleVisibility = function () {
    var active = this._fabricCanvas.getActiveObject();
    var activeGroupId = null;
    if (active && active.data) {
      if (active.data.points) activeGroupId = active.data.id;
      else if (active.data.kind === 'handle') activeGroupId = active.data.handleFor;
    }
    this._fabricCanvas.getObjects().forEach(function (o) {
      if (o.data && o.data.kind === 'handle') {
        var show = o.data.handleFor === activeGroupId;
        o.visible = show;
        o.evented = show;
      }
    });
    this._fabricCanvas.requestRenderAll();
  };

  // Every point this shape's handles don't cover (e.g. the cube/sphere/cone/
  // cylinder's fixed "origin" anchor) still needs to translate when the whole
  // group is dragged by its body — handled in the 'object:moving' listener
  // (see _bindEvents) by shifting every key in data.points by the same delta.
  GeometryFigureEditor.prototype._regenerate3DFromHandle = function (handle) {
    var canvas = this._fabricCanvas;
    var group = canvas.getObjects().find(function (o) { return o.data && o.data.id === handle.data.handleFor; });
    if (!group) return;
    var factory = THREE_D[group.data.kind];
    if (!factory) return;

    var points = group.data.points;
    // The handle is rendered offsetDx/offsetDy away from the point it
    // actually controls (see radialOffset) — subtract that back out to get
    // the true controlled point.
    points[handle.data.pointKey] = {
      x: handle.left + 6 - handle.data.offsetDx,
      y: handle.top  + 6 - handle.data.offsetDy
    };

    // Some handles only encode a single meaningful axis (e.g. a radius or a
    // base height) — without this, the other axis drifts to wherever the
    // raw mouse happened to be and the handle visually floats away from the
    // shape it's supposed to be resizing. Snap it back onto the constrained
    // point BEFORE building, and reposition the actual handle circle to match
    // (re-applying the same fixed offset so it stays visually detached).
    if (factory.constrainHandle) {
      var constrained = factory.constrainHandle(handle.data.pointKey, points);
      points[handle.data.pointKey] = constrained;
      handle.set({ left: constrained.x + handle.data.offsetDx - 6, top: constrained.y + handle.data.offsetDy - 6 });
      handle.setCoords();
    }

    try {
      // left/top are NOT preserved here — every child object is rebuilt at
      // its true absolute canvas coordinate (straight from `points`), so
      // Fabric's own bounding-box-derived position for the new group is
      // already exactly right and must be left alone; forcing the OLD
      // left/top back on would misalign the rendered shape from its own
      // (still-correctly-positioned) handles the moment a resize changes the
      // bounding box. angle/scale are kept only as a defensive no-op, since
      // hasControls=false means the group is never rotated/scaled directly.
      var prevProps = { angle: group.angle, scaleX: group.scaleX, scaleY: group.scaleY };
      var stroke = group.data.role === 'custom' ? this._currentObjectColor(group) : this._paletteColor(group.data.role);
      var objects = factory.build(points, stroke);
      var freshGroup = new fabric.Group(objects, { data: Object.assign({}, group.data, { points: points }) });
      freshGroup.hasControls = false;
      freshGroup.set(prevProps);
      canvas.remove(group);
      canvas.add(freshGroup);
      canvas.sendToBack(freshGroup); // every handle must stay clickable above the shape, regardless of prior z-order
      freshGroup.data._lastLeft = freshGroup.left;
      freshGroup.data._lastTop  = freshGroup.top;
      canvas.requestRenderAll();
    } catch (err) { /* keep the previous shape rather than crash the editor */ }
  };

  GeometryFigureEditor.prototype._currentObjectColor = function (obj) {
    var found = obj;
    if (obj._objects && obj._objects.length) found = obj._objects[0];
    return found.stroke || this._paletteColor('primary');
  };

  /* ---- segment tool ---- */

  GeometryFigureEditor.prototype._clearSegmentPreview = function () {
    if (this._previewLine) {
      this._fabricCanvas.remove(this._previewLine);
      this._previewLine = null;
    }
  };

  GeometryFigureEditor.prototype._updateSegmentPreview = function (pt) {
    if (!this._segmentStart) return;
    var snap = this._nearestSnapPoint(pt);
    var p = snap ? { x: snap.x, y: snap.y } : pt;
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
    var snap = this._nearestSnapPoint(pt);
    var p = snap ? { x: snap.x, y: snap.y } : pt;
    if (snap) this._flashSnapMarker(p);

    if (!this._segmentStart) {
      this._segmentStart = p;
      return;
    }
    var spec = this._strokeSpec('auxiliary');
    var line = new fabric.Line([this._segmentStart.x, this._segmentStart.y, p.x, p.y], {
      stroke: spec.stroke, strokeWidth: 2, strokeDashArray: this._dashed ? [8, 6] : null, strokeLineCap: 'round',
      data: { role: spec.role, kind: 'segment' }
    });
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
    this._canvasWrap.classList.toggle('gfe-canvas-wrap--grid', this._gridVisible);
    var btn = this._toolbar.querySelector('#gfe-grid-btn');
    if (btn) { btn.classList.toggle('dc-action-btn--active', this._gridVisible); btn.title = this._gridVisible ? 'Ascunde grila' : 'Arată grila'; }
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
    var objs = canvas.getObjects().filter(function (o) { return !o.__isSnapMarker && !(o.data && o.data.kind === 'handle'); });
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
    active.forEach(function (o) {
      canvas.remove(o);
      if (o.data && o.data.id) {
        canvas.getObjects().filter(function (h) { return h.data && h.data.handleFor === o.data.id; })
          .forEach(function (h) { canvas.remove(h); });
      }
    });
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    this._pushHistory();
  };

  // Eraser tool: click an element to delete it directly, no select-then-
  // press-trash round trip. Clicking a 3D shape's handle erases the whole
  // shape (its owner), same as clicking the shape itself.
  GeometryFigureEditor.prototype._eraseObject = function (obj) {
    if (obj.__isSnapMarker) return;
    var canvas = this._fabricCanvas;
    var target = obj;
    if (obj.data && obj.data.kind === 'handle') {
      target = canvas.getObjects().find(function (o) { return o.data && o.data.id === obj.data.handleFor; });
      if (!target) return;
    }
    canvas.remove(target);
    if (target.data && target.data.id) {
      canvas.getObjects().filter(function (h) { return h.data && h.data.handleFor === target.data.id; })
        .forEach(function (h) { canvas.remove(h); });
    }
    canvas.requestRenderAll();
    this._pushHistory();
  };

  GeometryFigureEditor.prototype._confirmClear = function () {
    var self = this;
    if (document.getElementById('gfeClearConfirmOverlay')) return;
    var ov = document.createElement('div');
    ov.className = 'bac-confirm-overlay';
    ov.id = 'gfeClearConfirmOverlay';
    ov.innerHTML = `
      <div class="bac-confirm-modal" role="dialog" aria-modal="true">
        <div class="bac-confirm-icon">🗑️</div>
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
      var shapeBtn  = e.target.closest('[data-shape]');
      var toolBtn   = e.target.closest('[data-tool]');
      var colorBtn  = e.target.closest('[data-color]');
      var tickBtn   = e.target.closest('[data-tick]');
      var dashBtn   = e.target.closest('#gfe-dash-toggle');
      var undoBtn   = e.target.closest('#gfe-undo-btn');
      var redoBtn   = e.target.closest('#gfe-redo-btn');
      var clearBtn  = e.target.closest('#gfe-clear-btn');
      var zoomInBtn  = e.target.closest('#gfe-zoomin-btn');
      var zoomOutBtn = e.target.closest('#gfe-zoomout-btn');
      var fitBtn     = e.target.closest('#gfe-fit-btn');
      var gridBtn    = e.target.closest('#gfe-grid-btn');

      if (shapeBtn) self._insertShape(shapeBtn.dataset.shape);
      else if (toolBtn) self._setTool(toolBtn.dataset.tool);
      else if (colorBtn) self._applyColorToSelection('adaptive' in colorBtn.dataset ? null : colorBtn.dataset.color);
      else if (tickBtn) {
        self._tickCount = parseInt(tickBtn.dataset.tick, 10);
        self._toolbar.querySelectorAll('[data-tick]').forEach(function (b) { b.classList.toggle('gfe-tick-btn--active', b === tickBtn); });
        self._setTool('tick');
      }
      else if (dashBtn) { self._dashed = !self._dashed; dashBtn.classList.toggle('dc-action-btn--active', self._dashed); }
      else if (undoBtn) self._undo();
      else if (redoBtn) self._redo();
      else if (clearBtn) self._confirmClear();
      else if (zoomInBtn) self._setZoom(self._zoom + ZOOM_STEP);
      else if (zoomOutBtn) self._setZoom(self._zoom - ZOOM_STEP);
      else if (fitBtn) self._fitToView();
      else if (gridBtn) self._toggleGrid();
    });

    this._toolbar.querySelector('#gfe-color-picker').addEventListener('input', function (e) {
      self._applyColorToSelection(e.target.value);
    });

    this._fabricCanvas.on('mouse:down', function (opt) {
      if (self._tool === 'pan') {
        self._panning = true;
        self._panStart = { x: opt.e.clientX, y: opt.e.clientY };
        self._fabricCanvas.defaultCursor = 'grabbing';
        return;
      }
      if (self._tool === 'eraser') {
        if (opt.target) self._eraseObject(opt.target);
        return;
      }
      var pt = self._fabricCanvas.getPointer(opt.e);
      if (self._tool === 'segment') self._handleSegmentClick(pt);
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
      if (self._tool === 'segment' && self._segmentStart) {
        self._updateSegmentPreview(self._fabricCanvas.getPointer(opt.e));
      }
    });

    this._fabricCanvas.on('mouse:up', function () {
      if (self._panning) {
        self._panning = false;
        self._fabricCanvas.defaultCursor = 'grab';
      }
    });

    this._fabricCanvas.on('selection:created', function () { self._syncHandleVisibility(); });
    this._fabricCanvas.on('selection:updated', function () { self._syncHandleVisibility(); });
    this._fabricCanvas.on('selection:cleared', function () { self._syncHandleVisibility(); });

    this._fabricCanvas.on('object:moving', function (opt) {
      var target = opt.target;
      if (!target || !target.data) return;
      if (target.data.kind === 'handle') {
        self._regenerate3DFromHandle(target);
      } else if (target.data.points) {
        // A 3D group dragged by its body (not a per-vertex handle) — its own
        // points are the absolute-coordinate source of truth for the next
        // handle-drag rebuild, so they (and the handle circles) must move
        // along with it, not just the rendered group.
        var dx = target.left - target.data._lastLeft;
        var dy = target.top  - target.data._lastTop;
        if (dx || dy) {
          Object.keys(target.data.points).forEach(function (k) {
            target.data.points[k].x += dx;
            target.data.points[k].y += dy;
          });
          self._fabricCanvas.getObjects().forEach(function (h) {
            if (h.data && h.data.handleFor === target.data.id) {
              h.set({ left: h.left + dx, top: h.top + dy });
              h.setCoords();
            }
          });
        }
        target.data._lastLeft = target.left;
        target.data._lastTop  = target.top;
      }
    });

    this._fabricCanvas.on('object:modified', function () { self._pushHistory(); });
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
      if (e.key === 'Escape') self._setTool('select');
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

  GeometryFigureEditor.prototype.exportFigureSvg = function () {
    var self = this;
    return new Promise(function (resolve) {
      try {
        var json = self._fabricCanvas.toJSON(['data']);
        var el = document.createElement('canvas');
        var staticCanvas = new fabric.StaticCanvas(el);
        staticCanvas.setDimensions({ width: self._fabricCanvas.getWidth(), height: self._fabricCanvas.getHeight() });
        var SENTINEL = { primary: '#a1b2c3', auxiliary: '#a1b2c4' };
        staticCanvas.loadFromJSON(json, function () {
          function paintSentinel(obj) {
            if (obj._objects) obj._objects.forEach(paintSentinel);
            var role = obj.data && obj.data.role;
            if (role === 'primary' || role === 'auxiliary') {
              if (obj.stroke) obj.set('stroke', SENTINEL[role]);
              if (obj.type === 'i-text' || obj.type === 'text') obj.set('fill', SENTINEL[role]);
            }
            // handles are editor-only chrome, never part of the exported figure
            if (obj.data && obj.data.kind === 'handle') obj.set({ opacity: 0 });
          }
          staticCanvas.getObjects().forEach(paintSentinel);
          staticCanvas.renderAll();
          var raw = staticCanvas.toSVG();
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
    if (this._ro) this._ro.disconnect();
    if (this._mo) this._mo.disconnect();
    clearTimeout(this._resizeTimer);
    this._fabricCanvas.dispose();
    if (this._wrap && this._wrap.parentNode) this._wrap.parentNode.removeChild(this._wrap);
  };

  global.GeometryFigureEditor = GeometryFigureEditor;

})(window);
