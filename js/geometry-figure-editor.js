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
     Each returns { group, handleAnchor } — group is the static fabric.Group
     drawn at `origin` (absolute canvas coords) for the given scalar `param`;
     handleAnchor is where the depth/height drag-handle belongs for that
     same origin+param, so the handle can be repositioned after a rebuild. */

  var THREE_D = {
    cub: {
      defaultParam: 40,
      build: function (origin, param, stroke) {
        var hs = 55;
        var F = [{ x: -hs, y: -hs }, { x: hs, y: -hs }, { x: hs, y: hs }, { x: -hs, y: hs }]
          .map(function (p) { return { x: p.x + origin.x, y: p.y + origin.y }; });
        var dx = param, dy = -param * 0.85;
        var B = F.map(function (p) { return { x: p.x + dx, y: p.y + dy }; });
        var front = new fabric.Polygon(F, { fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var back  = new fabric.Polygon(B, { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5] });
        var edges = F.map(function (p, i) { return new fabric.Line([p.x, p.y, B[i].x, B[i].y], { stroke: stroke, strokeWidth: 2 }); });
        return { objects: [front, back].concat(edges), handleAnchor: B[1] };
      }
    },
    'piramida-patrata': {
      defaultParam: 95,
      build: function (origin, param, stroke) {
        var L = { x: origin.x - 70, y: origin.y + 15 }, Fr = { x: origin.x, y: origin.y + 42 },
            R = { x: origin.x + 70, y: origin.y + 15 }, Bk = { x: origin.x, y: origin.y - 15 };
        var apex = { x: origin.x, y: Bk.y - param };
        var baseVisible = new fabric.Polyline([L, Fr, R], { fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var baseHidden  = new fabric.Polyline([R, Bk, L], { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5] });
        var edgeL  = new fabric.Line([apex.x, apex.y, L.x, L.y],   { stroke: stroke, strokeWidth: 2 });
        var edgeR  = new fabric.Line([apex.x, apex.y, R.x, R.y],   { stroke: stroke, strokeWidth: 2 });
        var edgeF  = new fabric.Line([apex.x, apex.y, Fr.x, Fr.y], { stroke: stroke, strokeWidth: 2 });
        var edgeBk = new fabric.Line([apex.x, apex.y, Bk.x, Bk.y], { stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5] });
        return { objects: [baseVisible, baseHidden, edgeL, edgeR, edgeF, edgeBk], handleAnchor: apex };
      }
    },
    'piramida-triunghiulara': {
      defaultParam: 95,
      build: function (origin, param, stroke) {
        var L = { x: origin.x - 60, y: origin.y + 22 }, R = { x: origin.x + 60, y: origin.y + 22 },
            Bk = { x: origin.x, y: origin.y - 18 };
        var apex = { x: origin.x, y: Bk.y - param };
        var edgeFront = new fabric.Line([L.x, L.y, R.x, R.y], { stroke: stroke, strokeWidth: 2 });
        var edgeBkL   = new fabric.Line([L.x, L.y, Bk.x, Bk.y], { stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5] });
        var edgeBkR   = new fabric.Line([R.x, R.y, Bk.x, Bk.y], { stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5] });
        var apexL = new fabric.Line([apex.x, apex.y, L.x, L.y], { stroke: stroke, strokeWidth: 2 });
        var apexR = new fabric.Line([apex.x, apex.y, R.x, R.y], { stroke: stroke, strokeWidth: 2 });
        var apexBk = new fabric.Line([apex.x, apex.y, Bk.x, Bk.y], { stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5] });
        return { objects: [edgeFront, edgeBkL, edgeBkR, apexL, apexR, apexBk], handleAnchor: apex };
      }
    },
    sfera: {
      defaultParam: 18,
      build: function (origin, param, stroke) {
        var R = 55;
        var circle = new fabric.Circle({ left: origin.x - R, top: origin.y - R, radius: R, fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var front = ellipseArcPoints(origin.x, origin.y, R, param, 0, Math.PI, 20);
        var back  = ellipseArcPoints(origin.x, origin.y, R, param, Math.PI, 2 * Math.PI, 20);
        var eqFront = new fabric.Polyline(front, { fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var eqBack  = new fabric.Polyline(back,  { fill: 'transparent', stroke: stroke, strokeWidth: 2, strokeDashArray: [6, 5] });
        return { objects: [circle, eqBack, eqFront], handleAnchor: { x: origin.x + R * 0.7, y: origin.y + param * 0.7 } };
      }
    },
    con: {
      defaultParam: 90,
      build: function (origin, param, stroke) {
        var rx = 55, ry = 16;
        var baseY = origin.y + 30;
        var apex = { x: origin.x, y: baseY - param };
        var base = new fabric.Ellipse({ left: origin.x - rx, top: baseY - ry, rx: rx, ry: ry, fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var slantL = new fabric.Line([apex.x, apex.y, origin.x - rx, baseY], { stroke: stroke, strokeWidth: 2 });
        var slantR = new fabric.Line([apex.x, apex.y, origin.x + rx, baseY], { stroke: stroke, strokeWidth: 2 });
        return { objects: [base, slantL, slantR], handleAnchor: apex };
      }
    },
    cilindru: {
      defaultParam: 100,
      build: function (origin, param, stroke) {
        var rx = 55, ry = 16;
        var topY = origin.y - param / 2, botY = origin.y + param / 2;
        var top = new fabric.Ellipse({ left: origin.x - rx, top: topY - ry, rx: rx, ry: ry, fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var bot = new fabric.Ellipse({ left: origin.x - rx, top: botY - ry, rx: rx, ry: ry, fill: 'transparent', stroke: stroke, strokeWidth: 2 });
        var lineL = new fabric.Line([origin.x - rx, topY, origin.x - rx, botY], { stroke: stroke, strokeWidth: 2 });
        var lineR = new fabric.Line([origin.x + rx, topY, origin.x + rx, botY], { stroke: stroke, strokeWidth: 2 });
        return { objects: [top, bot, lineL, lineR], handleAnchor: { x: origin.x, y: botY } };
      }
    }
  };

  var SHAPE_LABELS = {
    'tri-isoscel': 'Isoscel', 'tri-echilateral': 'Echilateral', 'tri-oarecare': 'Oarecare',
    cerc: 'Cerc', patrat: 'Pătrat', paralelogram: 'Paralelogram',
    'trapez-isoscel': 'Trapez is.', 'trapez-dreptunghic': 'Trapez dr.',
    cub: 'Cub', 'piramida-patrata': 'Piramidă (pătrat)', 'piramida-triunghiulara': 'Piramidă (triunghi)',
    sfera: 'Sferă', con: 'Con', cilindru: 'Cilindru'
  };

  var TOOLBAR_HTML = `
    <div class="dc-tool-group gfe-shape-group">
      ${['tri-isoscel','tri-echilateral','tri-oarecare','cerc','patrat','paralelogram','trapez-isoscel','trapez-dreptunghic']
        .map(function (id) { return `<button class="dc-tool-btn gfe-shape-btn" data-shape="${id}" title="Inserează ${SHAPE_LABELS[id]}">${SHAPE_LABELS[id]}</button>`; }).join('')}
    </div>
    <div class="dc-tool-group gfe-shape-group">
      ${['cub','piramida-patrata','piramida-triunghiulara','sfera','con','cilindru']
        .map(function (id) { return `<button class="dc-tool-btn gfe-shape-btn" data-shape="${id}" title="Inserează ${SHAPE_LABELS[id]}">${SHAPE_LABELS[id]}</button>`; }).join('')}
    </div>
    <div class="dc-tool-group">
      <button class="dc-tool-btn dc-tool-btn--active" data-tool="select" title="Selectează / mută">↖</button>
      <button class="dc-tool-btn" data-tool="segment" title="Segment (mediană, bisectoare, înălțime...)">╱</button>
      <button class="dc-action-btn" id="gfe-dash-toggle" aria-pressed="false" title="Segment punctat">┄</button>
      <button class="dc-tool-btn" data-tool="text" title="Etichetă text">T</button>
    </div>
    <div class="dc-tool-group">
      <button class="dc-tool-btn" data-tool="right-angle" title="Unghi drept">⌐</button>
      <button class="dc-tool-btn" data-tool="arc" title="Arc unghi">⌒</button>
      <button class="dc-tool-btn" data-tool="tick" title="Segmente egale (marcaj)">‖</button>
      <button class="gfe-tick-btn gfe-tick-btn--active" data-tick="1" title="1 liniuță">1</button>
      <button class="gfe-tick-btn" data-tick="2" title="2 liniuțe">2</button>
      <button class="gfe-tick-btn" data-tick="3" title="3 liniuțe">3</button>
    </div>
    <div class="dc-tool-group">
      <button class="dc-color-btn dc-color-btn--active" data-color="" data-adaptive title="Culoare implicită" aria-label="Culoare implicită"></button>
      <button class="dc-color-btn" data-color="#dc2626" style="background:#dc2626" title="Roșu" aria-label="Culoare roșu"></button>
      <button class="dc-color-btn" data-color="#1d4ed8" style="background:#1d4ed8" title="Albastru" aria-label="Culoare albastru"></button>
      <button class="dc-color-btn" data-color="#16a34a" style="background:#16a34a" title="Verde" aria-label="Culoare verde"></button>
      <input type="color" id="gfe-color-picker" class="gfe-color-picker" value="#dc2626" title="Altă culoare" aria-label="Alege altă culoare">
    </div>
    <div class="dc-tool-group dc-tool-group--right">
      <button class="dc-action-btn" id="gfe-zoomout-btn" title="Micșorează">−</button>
      <span class="dc-zoom-label" id="gfe-zoom-label">100%</span>
      <button class="dc-action-btn" id="gfe-zoomin-btn" title="Mărește">+</button>
      <button class="dc-action-btn" id="gfe-fit-btn" title="Potrivește la ecran">⤢</button>
      <button class="dc-action-btn" id="gfe-grid-btn" title="Arată grila">▦</button>
      <button class="dc-action-btn" id="gfe-undo-btn" title="Anulează (Ctrl+Z)">↺</button>
      <button class="dc-action-btn" id="gfe-redo-btn" title="Reface (Ctrl+Y)">↻</button>
      <button class="dc-action-btn" id="gfe-delete-btn" title="Șterge selecția (Delete)">🗑</button>
      <button class="dc-action-btn dc-action-btn--danger" id="gfe-clear-btn" title="Șterge tot">⨯</button>
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
        fill: 'transparent', stroke: spec.stroke, strokeWidth: 2, strokeUniform: true,
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
    var param = factory.defaultParam;
    var built = factory.build(origin, param, spec.stroke);
    var group = new fabric.Group(built.objects, { data: { role: spec.role, kind: kind, id: genId(), param: param } });
    // The depth/height handle below sits deliberately close to one of this
    // group's own corners — Fabric prioritizes hit-testing the ACTIVE
    // object's own resize/rotate controls over sibling objects underneath,
    // so without this the handle would be unreachable (clicks land on the
    // group's native corner control instead). Still draggable by its body.
    group.hasControls = false;
    var handle = new fabric.Circle({
      left: built.handleAnchor.x - 6, top: built.handleAnchor.y - 6, radius: 6,
      fill: HANDLE_COLOR, stroke: '#fff', strokeWidth: 1.5,
      data: { kind: 'handle', handleFor: group.data.id, origin: origin }
    });
    this._fabricCanvas.add(group);
    this._fabricCanvas.add(handle);
    this._fabricCanvas.setActiveObject(group);
    this._fabricCanvas.requestRenderAll();
    this._pushHistory();
  };

  GeometryFigureEditor.prototype._regenerate3DFromHandle = function (handle) {
    var canvas = this._fabricCanvas;
    var group = canvas.getObjects().find(function (o) { return o.data && o.data.id === handle.data.handleFor; });
    if (!group) return;
    var kind = group.data.kind;
    var factory = THREE_D[kind];
    if (!factory) return;
    var origin = handle.data.origin;

    // Each 3D preset's handleAnchor moves along a single axis as `param`
    // grows (up for the apex-based shapes, right for the cube's depth
    // corner, down for the cylinder's bottom rim, down for the sphere's
    // equator flatten) — derive param from that one axis, clamped to a
    // sane range per shape so the projection never degenerates.
    var param;
    if (kind === 'sfera')          param = Math.max(6, Math.min(50, Math.abs((handle.top + 6) - origin.y)));
    else if (kind === 'cub')       param = Math.max(10, Math.min(90, (handle.left + 6) - origin.x));
    else if (kind === 'cilindru')  param = Math.max(40, Math.min(240, ((handle.top + 6) - origin.y) * 2));
    else /* piramide / con */      param = Math.max(30, Math.min(220, origin.y - (handle.top + 6)));

    try {
      var prevProps = { left: group.left, top: group.top, angle: group.angle, scaleX: group.scaleX, scaleY: group.scaleY };
      var stroke = group.data.role === 'custom' ? this._currentObjectColor(group) : this._paletteColor(group.data.role);
      var built = factory.build(origin, param, stroke);
      var freshGroup = new fabric.Group(built.objects, { data: Object.assign({}, group.data, { param: param }) });
      freshGroup.hasControls = false;
      freshGroup.set(prevProps);
      canvas.remove(group);
      canvas.add(freshGroup);
      canvas.moveTo(freshGroup, canvas.getObjects().indexOf(handle));
      handle.data.origin = origin;
      canvas.bringToFront(handle);
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
      stroke: spec.stroke, strokeWidth: 2, strokeDashArray: this._dashed ? [8, 6] : null,
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
    this._fabricCanvas.defaultCursor = placing ? 'crosshair' : 'default';
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
      var delBtn    = e.target.closest('#gfe-delete-btn');
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
      else if (delBtn) self._deleteSelected();
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
      var pt = self._fabricCanvas.getPointer(opt.e);
      if (self._tool === 'segment') self._handleSegmentClick(pt);
      else if (self._tool === 'text') self._insertText(pt);
      else if (self._tool === 'right-angle') self._insertRightAngle(pt);
      else if (self._tool === 'arc') self._insertArc(pt);
      else if (self._tool === 'tick') self._insertTick(pt);
    });

    this._fabricCanvas.on('mouse:move', function (opt) {
      if (self._tool === 'segment' && self._segmentStart) {
        self._updateSegmentPreview(self._fabricCanvas.getPointer(opt.e));
      }
    });

    this._fabricCanvas.on('object:moving', function (opt) {
      var target = opt.target;
      if (target && target.data && target.data.kind === 'handle') {
        self._regenerate3DFromHandle(target);
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
