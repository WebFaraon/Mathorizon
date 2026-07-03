/* ============================================================
   DrawingCanvas — vanilla JS drawing surface for BAC simulation
   Supports: mouse, touch, Apple Pencil, S Pen (PointerEvents API)
   ============================================================ */

(function (global) {
  'use strict';

  var INPUT_MODE_KEY = 'mathorizon:dc-input-mode'; // 'any' | 'pen' — persists across exercises

  var TOOLBAR_HTML = `
    <div class="dc-tool-group">
      <button class="dc-tool-btn dc-tool-btn--active" data-tool="pen" title="Stilou (P)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
      </button>
      <button class="dc-tool-btn" data-tool="eraser" title="Radieră (E)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
          <path d="M22 21H7"/>
          <path d="m5 11 9 9"/>
        </svg>
      </button>
    </div>
    <div class="dc-tool-group">
      <button class="dc-color-btn dc-color-btn--active" data-color="#1a1a1a" data-adaptive title="Negru" aria-label="Culoare negru"></button>
      <button class="dc-color-btn" data-color="#1d4ed8" title="Albastru" aria-label="Culoare albastru"></button>
      <button class="dc-color-btn" data-color="#dc2626" title="Roșu" aria-label="Culoare roșu"></button>
    </div>
    <div class="dc-tool-group">
      <button class="dc-width-btn dc-width-btn--active" data-width="2" title="Subțire">
        <span class="dc-width-dot" style="width:3px;height:3px"></span>
      </button>
      <button class="dc-width-btn" data-width="4" title="Mediu">
        <span class="dc-width-dot" style="width:5px;height:5px"></span>
      </button>
      <button class="dc-width-btn" data-width="8" title="Gros">
        <span class="dc-width-dot" style="width:9px;height:9px"></span>
      </button>
    </div>
    <div class="dc-tool-group">
      <button class="dc-tool-btn dc-inputmode-btn" id="dc-inputmode-btn" aria-pressed="false" title="Mod de scriere: orice input">
        <svg class="dc-icon-any" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="7"/>
          <path d="M12 6v4"/>
        </svg>
        <svg class="dc-icon-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          <path d="m15 5 4 4"/>
        </svg>
      </button>
      <span class="dc-mode-badge" role="status">Mod stilou activ — doar pixul digital este acceptat</span>
    </div>
    <div class="dc-tool-group">
      <button class="dc-action-btn" id="dc-zoomout-btn" title="Micșorează">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>
        </svg>
      </button>
      <span class="dc-zoom-label" id="dc-zoom-label">100%</span>
      <button class="dc-action-btn" id="dc-zoomin-btn" title="Mărește">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>
        </svg>
      </button>
    </div>
    <div class="dc-tool-group dc-tool-group--right">
      <button class="dc-action-btn" id="dc-maximize-btn" title="Ecran complet pentru canvas">
        <svg class="dc-icon-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        </svg>
        <svg class="dc-icon-collapse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
          <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
        </svg>
      </button>
      <button class="dc-action-btn" id="dc-undo-btn" title="Anulează (Ctrl+Z)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7v6h6"/>
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
        </svg>
      </button>
      <button class="dc-action-btn dc-action-btn--danger" id="dc-clear-btn" title="Șterge tot">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  `;

  var MIN_ZOOM = 1;
  var MAX_ZOOM = 2;
  var ZOOM_STEP = 0.25;

  function DrawingCanvas(container, options) {
    options = options || {};
    this._container  = container;
    this._onSave     = options.onSave  || null;
    this._initialData = options.initialData || null;
    this._onMaximizeChange = options.onMaximizeChange || null;

    this._tool        = 'pen';
    this._inputMode   = this._loadInputMode(); // 'any' (default) | 'pen'
    this._color       = '#1a1a1a';
    this._strokeWidth = 2;
    // Strokes are kept as vector data (points, not pixels) so resizing the
    // canvas (e.g. collapsing/expanding the exam sidebar) can redraw them at
    // the new size instead of cropping a raster snapshot to the old bounds.
    this._strokes        = [];
    this._currentStroke  = null;
    this._bgImage        = null; // raster image loaded from a previous session (item.work)
    this._bgImageCssW    = 0;
    this._bgImageCssH    = 0;
    this._isDrawing   = false;
    this._points      = [];
    this._pointers    = {};    // active touch pointers → { x, y } for scroll/pan gestures
    this._scrolling   = false; // true while a finger/two-finger scroll is in progress
    this._zoom        = 1;     // bounded [MIN_ZOOM, MAX_ZOOM] — grows the raster, not a CSS scale
    this._maximized   = false;
    this._saveTimer   = null;
    this._resizeTimer = null;
    this._destroyed   = false;

    this._build();
    this._bindEvents();
    this._applyInputMode(); // reflect persisted preference in UI

    // Defer resize so the DOM has laid out
    var self = this;
    requestAnimationFrame(function () {
      self._adaptColors();
      self._resize();
      if (self._initialData && self._initialData.startsWith('data:image/png;base64,')) {
        self._loadImage(self._initialData);
      }
    });
  }

  DrawingCanvas.prototype._build = function () {
    var wrap = document.createElement('div');
    wrap.className = 'dc-wrap';

    var toolbar = document.createElement('div');
    toolbar.className = 'dc-toolbar';
    toolbar.innerHTML = TOOLBAR_HTML;

    // Set colour swatches background (adaptive swatch applied later in _adaptColors)
    toolbar.querySelector('[data-color="#1d4ed8"]').style.background = '#1d4ed8';
    toolbar.querySelector('[data-color="#dc2626"]').style.background = '#dc2626';

    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'dc-canvas-wrap';

    this._gridCanvas = document.createElement('canvas');
    this._gridCanvas.className = 'dc-grid-canvas';
    this._gridCanvas.setAttribute('aria-hidden', 'true');

    this._canvas = document.createElement('canvas');
    this._canvas.className = 'dc-draw-canvas';
    this._canvas.setAttribute('role', 'img');
    this._canvas.setAttribute('aria-label', 'Zonă de desen');

    // Transient hint shown when a blocked input (mouse) tries to draw
    var hint = document.createElement('div');
    hint.className = 'dc-input-hint';
    hint.setAttribute('role', 'status');
    hint.setAttribute('aria-live', 'polite');
    hint.textContent = 'Folosește pixul digital pentru a scrie';

    canvasWrap.appendChild(this._gridCanvas);
    canvasWrap.appendChild(this._canvas);
    canvasWrap.appendChild(hint);
    this._inputHint = hint;

    wrap.appendChild(toolbar);
    wrap.appendChild(canvasWrap);

    this._container.appendChild(wrap);
    this._wrap       = wrap;
    this._canvasWrap = canvasWrap;
    this._toolbar    = toolbar;
    this._modeBadge  = toolbar.querySelector('.dc-mode-badge');

    this._ctx     = this._canvas.getContext('2d');
    this._gridCtx = this._gridCanvas.getContext('2d');
  };

  DrawingCanvas.prototype._resize = function () {
    if (this._destroyed) return;

    // The container's own box never grows with zoom — only the canvases
    // inside it do, via .dc-canvas-wrap's overflow:auto (scroll to pan).
    var baseW = this._canvasWrap.offsetWidth  || 800;
    var baseH = Math.max(600, this._canvasWrap.offsetHeight || 600);
    var w   = Math.round(baseW * this._zoom);
    var h   = Math.round(baseH * this._zoom);
    var dpr = window.devicePixelRatio || 1;

    var setSize = function (canvas, ctx) {
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      ctx.scale(dpr, dpr);
    };

    setSize(this._gridCanvas, this._gridCtx);
    setSize(this._canvas, this._ctx);

    this._width  = w;
    this._height = h;
    this._dpr    = dpr;

    this._drawGrid();
    // Setting canvas.width/height above wipes the bitmap — rebuild it from
    // vector stroke data instead of a raster snapshot, so content that was
    // outside the previous (narrower) bounds isn't cropped away for good.
    this._redrawAll();
  };

  // Replays the loaded background image (if any) plus every recorded stroke
  // onto the current canvas. Called after every resize and after undo/clear
  // so the visible bitmap always matches the vector source of truth.
  DrawingCanvas.prototype._redrawAll = function () {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    if (this._bgImage) {
      this._ctx.drawImage(this._bgImage, 0, 0, this._bgImageCssW, this._bgImageCssH);
    }
    for (var i = 0; i < this._strokes.length; i++) {
      this._drawStroke(this._strokes[i]);
    }
  };

  DrawingCanvas.prototype._drawStroke = function (stroke) {
    var pts = stroke.points;
    var n   = pts.length;
    if (n === 0) return;

    if (stroke.type === 'eraser') {
      var r = stroke.width * 5;
      for (var i = 0; i < n; i++) {
        this._ctx.clearRect(pts[i].x - r, pts[i].y - r, r * 2, r * 2);
      }
      return;
    }

    var ctx = this._ctx;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.globalCompositeOperation = 'source-over';

    if (n === 2) {
      ctx.lineWidth = stroke.width * (0.6 + pts[1].pressure * 1.2);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      return;
    }

    // Same midpoint-smoothing used for live rendering, replayed for the
    // whole stroke so the redrawn shape matches what was originally drawn.
    for (var j = 2; j < n; j++) {
      var p0 = pts[j - 2], p1 = pts[j - 1], p2 = pts[j];
      var mx1 = (p0.x + p1.x) / 2, my1 = (p0.y + p1.y) / 2;
      var mx2 = (p1.x + p2.x) / 2, my2 = (p1.y + p2.y) / 2;
      ctx.lineWidth = stroke.width * (0.6 + p2.pressure * 1.2);
      ctx.beginPath();
      ctx.moveTo(mx1, my1);
      ctx.quadraticCurveTo(p1.x, p1.y, mx2, my2);
      ctx.stroke();
    }
  };

  DrawingCanvas.prototype._drawGrid = function () {
    var canvas = this._gridCanvas;
    var ctx    = this._gridCtx;
    var dpr    = this._dpr || window.devicePixelRatio || 1;
    // Use physical pixel dimensions — immune to any accumulated ctx transform.
    var pw     = canvas.width;
    var ph     = canvas.height;
    var dark   = document.documentElement.getAttribute('data-theme') === 'dark';

    // Reset transform so fillRect(0,0,pw,ph) always covers the entire canvas.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = dark ? '#161616' : '#f7f5ef';
    ctx.fillRect(0, 0, pw, ph);

    var cell = 24 * dpr; // 24 CSS-px grid in physical pixels

    // Fine grid
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.055)';
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    for (var x = 0; x <= pw; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, ph); }
    for (var y = 0; y <= ph; y += cell) { ctx.moveTo(0, y); ctx.lineTo(pw, y); }
    ctx.stroke();

    // Major grid every 5 cells
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    for (var x2 = 0; x2 <= pw; x2 += cell * 5) { ctx.moveTo(x2, 0); ctx.lineTo(x2, ph); }
    for (var y2 = 0; y2 <= ph; y2 += cell * 5) { ctx.moveTo(0, y2); ctx.lineTo(pw, y2); }
    ctx.stroke();

    ctx.restore();
  };

  DrawingCanvas.prototype._bindEvents = function () {
    var self = this;

    // Toolbar clicks
    this._toolbar.addEventListener('click', function (e) {
      var toolBtn    = e.target.closest('[data-tool]');
      var colorBtn   = e.target.closest('[data-color]');
      var widthBtn   = e.target.closest('[data-width]');
      var undoBtn    = e.target.closest('#dc-undo-btn');
      var clearBtn   = e.target.closest('#dc-clear-btn');
      var modeBtn    = e.target.closest('#dc-inputmode-btn');
      var zoomInBtn  = e.target.closest('#dc-zoomin-btn');
      var zoomOutBtn = e.target.closest('#dc-zoomout-btn');
      var maxBtn     = e.target.closest('#dc-maximize-btn');

      if (modeBtn)  self._toggleInputMode();
      else if (toolBtn)  self._setTool(toolBtn.dataset.tool);
      else if (colorBtn) self._setColor(colorBtn.dataset.color);
      else if (widthBtn) self._setWidth(parseInt(widthBtn.dataset.width, 10));
      else if (undoBtn)  self._undo();
      else if (clearBtn) self._confirmClear();
      else if (zoomInBtn)  self._setZoom(self._zoom + ZOOM_STEP);
      else if (zoomOutBtn) self._setZoom(self._zoom - ZOOM_STEP);
      else if (maxBtn)     self._toggleMaximize();
    });

    // Canvas pointer events
    this._canvas.addEventListener('pointerdown',   this._onDown.bind(this));
    this._canvas.addEventListener('pointermove',   this._onMove.bind(this));
    this._canvas.addEventListener('pointerup',     this._onUp.bind(this));
    this._canvas.addEventListener('pointercancel', this._onUp.bind(this));
    this._canvas.addEventListener('pointerleave',  this._onUp.bind(this));
    this._canvas.style.touchAction = 'none'; // prevent scroll while drawing

    // Keyboard shortcuts
    this._keyHandler = function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        self._undo();
      }
      if (e.key === 'p' || e.key === 'P') self._setTool('pen');
      if (e.key === 'e' || e.key === 'E') self._setTool('eraser');
      if (e.key === 'Escape' && self._maximized) self._toggleMaximize();
    };
    window.addEventListener('keydown', this._keyHandler);

    // Responsive resize
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () {
        clearTimeout(self._resizeTimer);
        self._resizeTimer = setTimeout(function () { self._resize(); }, 80);
      });
      this._ro.observe(this._canvasWrap);
    }

    // Redraw grid and adapt palette on theme change
    this._mo = new MutationObserver(function () { self._drawGrid(); self._adaptColors(); });
    this._mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  };

  DrawingCanvas.prototype._getPos = function (e) {
    var rect = this._canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      // stylus pressure: 0–1; mouse always reports 0.5; fallback 0.5
      pressure: (e.pressure > 0) ? e.pressure : 0.5
    };
  };

  DrawingCanvas.prototype._onDown = function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (e.pointerType === 'touch') {
      this._pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      // Scroll gestures: two fingers always scroll the page; in stylus-only
      // mode a single finger scrolls too (it can't draw anyway).
      if (this._touchCount() >= 2 || this._inputMode === 'pen') {
        this._beginScroll(e);
        return;
      }
      // one finger in "any" mode → draw (fall through)
    } else if (!this._isInputAllowed(e.pointerType)) {
      // pen is always allowed; a blocked mouse gets the hint.
      this._showInputHint();
      return;
    }

    e.preventDefault();
    this._canvas.setPointerCapture(e.pointerId);

    this._isDrawing = true;

    var pos = this._getPos(e);
    this._points = [pos];
    this._lastPos = pos;
    // _points is the same array referenced here, so later pushes to it
    // during _onMove are automatically reflected in the recorded stroke.
    this._currentStroke = {
      type:   this._tool === 'eraser' ? 'eraser' : 'pen',
      color:  this._color,
      width:  this._strokeWidth,
      points: this._points
    };

    if (this._tool === 'pen') {
      var ctx = this._ctx;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  DrawingCanvas.prototype._onMove = function (e) {
    if (this._scrolling) {
      if (e.pointerType === 'touch' && this._pointers[e.pointerId]) {
        this._pointers[e.pointerId].x = e.clientX;
        this._pointers[e.pointerId].y = e.clientY;
      }
      e.preventDefault();
      if (this._scrollEl) {
        this._scrollEl.scrollTop  = this._scrollStartTop  - (this._avgTouchY() - this._scrollStartY);
        // Horizontal pan only matters when zoomed in (canvas wider than its
        // container) — at zoom 1 scrollLeft has nowhere to go, so this is a no-op.
        this._scrollEl.scrollLeft = this._scrollStartLeft - (this._avgTouchX() - this._scrollStartX);
      }
      return;
    }

    // Keep the tracked finger position fresh so a two-finger scroll that starts
    // mid-stroke baselines from where the finger actually is (no jump).
    if (e.pointerType === 'touch' && this._pointers[e.pointerId]) {
      this._pointers[e.pointerId].x = e.clientX;
      this._pointers[e.pointerId].y = e.clientY;
    }

    if (!this._isDrawing) return;
    e.preventDefault();

    var pos = this._getPos(e);

    if (this._tool === 'eraser') {
      var r = this._strokeWidth * 5;
      this._ctx.clearRect(pos.x - r, pos.y - r, r * 2, r * 2);
      this._points.push(pos);
    } else {
      this._points.push(pos);
      this._renderStroke();
    }

    this._lastPos = pos;
  };

  DrawingCanvas.prototype._renderStroke = function () {
    var pts = this._points;
    var n   = pts.length;
    if (n < 2) return;

    var ctx      = this._ctx;
    var pressure = pts[n - 1].pressure;
    // Map pressure [0,1] → width multiplier [0.6, 1.8]
    var width    = this._strokeWidth * (0.6 + pressure * 1.2);

    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.strokeStyle = this._color;
    ctx.lineWidth   = width;
    ctx.globalCompositeOperation = 'source-over';

    if (n === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      return;
    }

    // Smooth curve through midpoints (incremental — only draw last segment)
    var p0   = pts[n - 3] || pts[n - 2];
    var p1   = pts[n - 2];
    var p2   = pts[n - 1];
    var mx1  = (p0.x + p1.x) / 2;
    var my1  = (p0.y + p1.y) / 2;
    var mx2  = (p1.x + p2.x) / 2;
    var my2  = (p1.y + p2.y) / 2;

    ctx.beginPath();
    ctx.moveTo(mx1, my1);
    ctx.quadraticCurveTo(p1.x, p1.y, mx2, my2);
    ctx.stroke();
  };

  DrawingCanvas.prototype._onUp = function (e) {
    var isLeave = e.type === 'pointerleave';
    if (!isLeave && e.pointerType === 'touch') delete this._pointers[e.pointerId];

    if (this._scrolling) {
      if (isLeave) return; // ignore boundary events mid-scroll
      if (this._touchCount() === 0) this._scrolling = false;
      else this._rebaselineScroll(); // a finger lifted, others remain → avoid a jump
      return;
    }

    if (!this._isDrawing) return;
    this._isDrawing = false;
    // A tap with no movement (points.length === 1) never rendered anything
    // live either — dropping it here keeps that behavior on redraw, and
    // keeps isBlankStrokes() in bac.js correctly treating a stray tap as
    // unanswered instead of leaving a stored dot to redraw later.
    if (this._currentStroke && this._currentStroke.points.length > 1) {
      this._strokes.push(this._currentStroke);
    }
    this._currentStroke = null;
    this._points    = [];
    this._scheduleSave();
  };

  /* ---- Touch scroll helpers ---- */

  DrawingCanvas.prototype._touchCount = function () {
    return Object.keys(this._pointers).length;
  };

  DrawingCanvas.prototype._avgTouchY = function () {
    var ids = Object.keys(this._pointers);
    if (!ids.length) return this._scrollStartY || 0;
    var sum = 0;
    for (var i = 0; i < ids.length; i++) sum += this._pointers[ids[i]].y;
    return sum / ids.length;
  };

  DrawingCanvas.prototype._avgTouchX = function () {
    var ids = Object.keys(this._pointers);
    if (!ids.length) return this._scrollStartX || 0;
    var sum = 0;
    for (var i = 0; i < ids.length; i++) sum += this._pointers[ids[i]].x;
    return sum / ids.length;
  };

  DrawingCanvas.prototype._getScrollParent = function (node) {
    var el = node.parentElement;
    while (el) {
      var cs = getComputedStyle(el);
      var scrollableY = (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowY === 'overlay') && el.scrollHeight > el.clientHeight;
      var scrollableX = (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'overlay') && el.scrollWidth  > el.clientWidth;
      if (scrollableY || scrollableX) return el;
      el = el.parentElement;
    }
    // Fallback: the document scroller (works for full-page window scrolling).
    return document.scrollingElement || document.documentElement;
  };

  DrawingCanvas.prototype._rebaselineScroll = function () {
    this._scrollStartTop  = this._scrollEl ? this._scrollEl.scrollTop  : 0;
    this._scrollStartLeft = this._scrollEl ? this._scrollEl.scrollLeft : 0;
    this._scrollStartY    = this._avgTouchY();
    this._scrollStartX    = this._avgTouchX();
  };

  DrawingCanvas.prototype._beginScroll = function (e) {
    this._scrolling = true;
    this._cancelActiveStroke(); // discard any accidental mark from the first finger
    this._scrollEl  = this._getScrollParent(this._canvas);
    try { this._canvas.setPointerCapture(e.pointerId); } catch (err) {}
    this._rebaselineScroll();
  };

  DrawingCanvas.prototype._cancelActiveStroke = function () {
    if (!this._isDrawing) return;
    this._isDrawing = false;
    this._points    = [];
    // The in-progress stroke was never pushed to _strokes, so redrawing from
    // the committed stroke list naturally leaves no trace of it.
    this._currentStroke = null;
    this._redrawAll();
  };

  DrawingCanvas.prototype._undo = function () {
    if (this._strokes.length === 0) return;
    this._strokes.pop();
    this._redrawAll();
    this._scheduleSave();
  };

  DrawingCanvas.prototype._confirmClear = function () {
    if (!confirm('Ștergi toate notițele? Acțiunea nu poate fi anulată.')) return;
    this._strokes = [];
    this._bgImage = null;
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._scheduleSave();
  };

  DrawingCanvas.prototype._setTool = function (tool) {
    this._tool = tool;
    this._toolbar.querySelectorAll('[data-tool]').forEach(function (btn) {
      btn.classList.toggle('dc-tool-btn--active', btn.dataset.tool === tool);
    });
    this._canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
  };

  DrawingCanvas.prototype._setColor = function (color) {
    this._color = color;
    this._toolbar.querySelectorAll('[data-color]').forEach(function (btn) {
      btn.classList.toggle('dc-color-btn--active', btn.dataset.color === color);
    });
    if (this._tool === 'eraser') this._setTool('pen');
  };

  DrawingCanvas.prototype._setWidth = function (w) {
    this._strokeWidth = w;
    this._toolbar.querySelectorAll('[data-width]').forEach(function (btn) {
      btn.classList.toggle('dc-width-btn--active', parseInt(btn.dataset.width, 10) === w);
    });
  };

  /* ---- Zoom (grows the raster + scroll-to-pan; bounded, not infinite) ---- */

  DrawingCanvas.prototype._setZoom = function (z) {
    z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z * 100) / 100));
    if (z === this._zoom) return;
    this._zoom = z;
    var label = this._toolbar.querySelector('#dc-zoom-label');
    if (label) label.textContent = Math.round(z * 100) + '%';
    var zoomOutBtn = this._toolbar.querySelector('#dc-zoomout-btn');
    var zoomInBtn  = this._toolbar.querySelector('#dc-zoomin-btn');
    if (zoomOutBtn) zoomOutBtn.disabled = z <= MIN_ZOOM;
    if (zoomInBtn)  zoomInBtn.disabled  = z >= MAX_ZOOM;
    this._resize();
  };

  /* ---- Fullscreen canvas mode ---- */

  DrawingCanvas.prototype._toggleMaximize = function () {
    this._maximized = !this._maximized;
    this._wrap.classList.toggle('dc-wrap--maximized', this._maximized);
    var btn = this._toolbar.querySelector('#dc-maximize-btn');
    if (btn) {
      btn.title = this._maximized ? 'Ieși din ecran complet (Esc)' : 'Ecran complet pentru canvas';
      btn.classList.toggle('dc-action-btn--active', this._maximized);
    }
    // The host page (bac.js) hides the sidebar/topbar/exercise card via this
    // callback — that's what actually makes the canvas fill the screen; see
    // the .dc-wrap--maximized comment in style.css for why this isn't done
    // with position:fixed here.
    if (this._onMaximizeChange) this._onMaximizeChange(this._maximized);
    // Let the layout settle (siblings hidden, container resized) before redrawing.
    var self = this;
    requestAnimationFrame(function () { self._resize(); });
  };

  /* ---- Input mode (stylus-only vs. any input) ---- */

  DrawingCanvas.prototype._loadInputMode = function () {
    try {
      return localStorage.getItem(INPUT_MODE_KEY) === 'pen' ? 'pen' : 'any';
    } catch (err) {
      return 'any'; // private mode / storage blocked → safe default
    }
  };

  // pen: always allowed. touch/mouse: only in "any" mode.
  DrawingCanvas.prototype._isInputAllowed = function (pointerType) {
    if (pointerType === 'pen') return true;
    return this._inputMode === 'any';
  };

  DrawingCanvas.prototype._toggleInputMode = function () {
    this._inputMode = (this._inputMode === 'pen') ? 'any' : 'pen';
    try { localStorage.setItem(INPUT_MODE_KEY, this._inputMode); } catch (err) {}
    this._applyInputMode();
  };

  DrawingCanvas.prototype._applyInputMode = function () {
    var stylusOnly = this._inputMode === 'pen';
    var btn = this._toolbar.querySelector('#dc-inputmode-btn');
    if (btn) {
      btn.classList.toggle('dc-inputmode-btn--stylus', stylusOnly);
      btn.classList.toggle('dc-tool-btn--active', stylusOnly);
      btn.setAttribute('aria-pressed', String(stylusOnly));
      btn.title = stylusOnly
        ? 'Mod stilou: doar pixul digital (apasă pentru orice input)'
        : 'Mod de scriere: orice input (apasă pentru doar stilou)';
    }
    if (this._modeBadge) {
      this._modeBadge.classList.toggle('dc-mode-badge--show', stylusOnly);
    }
    // Leaving stylus-only mode clears any lingering "use the stylus" hint.
    if (!stylusOnly) this._hideInputHint();
  };

  DrawingCanvas.prototype._showInputHint = function () {
    if (!this._inputHint) return;
    this._inputHint.classList.add('dc-input-hint--show');
    clearTimeout(this._hintTimer);
    var self = this;
    this._hintTimer = setTimeout(function () { self._hideInputHint(); }, 2200);
  };

  DrawingCanvas.prototype._hideInputHint = function () {
    clearTimeout(this._hintTimer);
    if (this._inputHint) this._inputHint.classList.remove('dc-input-hint--show');
  };

  DrawingCanvas.prototype._loadImage = function (dataUrl) {
    var self = this;
    var img  = new Image();
    img.onload = function () {
      var dpr  = self._dpr || window.devicePixelRatio || 1;
      // Draw at the PNG's own CSS-equivalent dimensions, not self._width/height.
      // The PNG was saved at (physicalW × physicalH), so dividing by dpr gives
      // the original CSS dimensions. Drawing at these CSS coords with scale(dpr,dpr)
      // active maps 1:1 to physical pixels — no squishing even if the canvas was
      // resized between saves.
      // Kept as the base layer (not baked into a stroke) so later resizes can
      // redraw it via _redrawAll() instead of relying on a one-time paint.
      self._bgImage     = img;
      self._bgImageCssW = img.naturalWidth  / dpr;
      self._bgImageCssH = img.naturalHeight / dpr;
      self._redrawAll();
    };
    img.src = dataUrl;
  };

  DrawingCanvas.prototype._adaptColors = function () {
    var dark  = document.documentElement.getAttribute('data-theme') === 'dark';
    var color = dark ? '#f0f0f0' : '#1a1a1a';
    var label = dark ? 'Alb'    : 'Negru';
    var btn   = this._toolbar.querySelector('[data-adaptive]');
    if (!btn) return;

    var wasActive = btn.classList.contains('dc-color-btn--active');
    btn.dataset.color      = color;
    btn.style.background   = color;
    btn.title              = label;
    btn.setAttribute('aria-label', 'Culoare ' + label.toLowerCase());

    if (wasActive) {
      this._color = color;
    }
  };

  DrawingCanvas.prototype._strokesDataUrl = function () {
    // Save only the draw canvas (transparent bg + strokes).
    // getCanvasImage() composites the grid background on top for export/AI,
    // but we must NOT save the grid into item.work — that would bake the
    // current theme's background onto the draw canvas on reload, breaking
    // theme switching.
    return this._canvas.toDataURL('image/png');
  };

  DrawingCanvas.prototype._scheduleSave = function () {
    if (!this._onSave) return;
    var self = this;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(function () {
      self._saveTimer = null; // must reset BEFORE calling onSave so destroy()
      self._onSave(self._strokesDataUrl()); // knows no pending save remains
    }, 400);
  };

  DrawingCanvas.prototype.getCanvasImage = function () {
    var off = document.createElement('canvas');
    off.width  = this._canvas.width;
    off.height = this._canvas.height;
    var ctx = off.getContext('2d');
    ctx.drawImage(this._gridCanvas, 0, 0);
    ctx.drawImage(this._canvas,     0, 0);
    return off.toDataURL('image/png');
  };

  DrawingCanvas.prototype.flush = function () {
    if (this._destroyed || !this._onSave) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = null;
    this._onSave(this._strokesDataUrl());
  };

  DrawingCanvas.prototype.destroy = function () {
    this._destroyed = true;
    // Navigating away while the canvas is fullscreen shouldn't leave the
    // host page's mini-exercise overlay orphaned.
    if (this._maximized && this._onMaximizeChange) this._onMaximizeChange(false);
    // Flush any unsaved stroke before teardown
    if (this._saveTimer && this._onSave) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
      this._onSave(this._strokesDataUrl());
    } else {
      clearTimeout(this._saveTimer);
    }
    clearTimeout(this._resizeTimer);
    clearTimeout(this._hintTimer);
    window.removeEventListener('keydown', this._keyHandler);
    if (this._ro) this._ro.disconnect();
    if (this._mo) this._mo.disconnect();
    if (this._wrap && this._wrap.parentNode) this._wrap.parentNode.removeChild(this._wrap);
  };

  global.DrawingCanvas = DrawingCanvas;

})(window);
