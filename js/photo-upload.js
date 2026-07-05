/* ============================================================
   PhotoUpload — photo-based answer capture for BAC simulation
   Alternative to DrawingCanvas: same onSave/initialData/flush/destroy
   surface, so bac.js can mount either widget interchangeably.
   ============================================================ */

(function (global) {
  'use strict';

  var MAX_W    = 1500;
  var JPEG_Q   = 0.8;

  function PhotoUpload(container, options) {
    options = options || {};
    this._container  = container;
    this._onSave      = options.onSave || null;
    this._initialData = options.initialData || null;
    this._destroyed   = false;

    this._build();
    this._bindEvents();

    if (this._initialData) this._showPreview(this._initialData);
  }

  PhotoUpload.prototype._isMobile = function () {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  };

  PhotoUpload.prototype._build = function () {
    var wrap = document.createElement('div');
    wrap.className = 'pu-wrap';

    var mobile = this._isMobile();

    wrap.innerHTML = `
      <div class="pu-camera-row" ${mobile ? '' : 'hidden'}>
        <button class="pu-camera-btn" type="button">📷 Deschide camera</button>
      </div>
      <div class="pu-dropzone" role="button" tabindex="0" aria-label="Încarcă poza rezolvării">
        <div class="pu-dropzone__icon">⬆️</div>
        <div class="pu-dropzone__text">Trage poza aici sau apasă pentru a selecta</div>
        <div class="pu-dropzone__hint">${mobile ? 'JPG, PNG' : 'JPG, PNG — sau lipește (Ctrl+V) o captură de ecran'}</div>
      </div>
      <input type="file" accept="image/*" class="pu-file-input" hidden>
      <input type="file" accept="image/*" capture="environment" class="pu-camera-input" hidden>
      <div class="pu-preview" hidden>
        <img class="pu-preview__img" alt="Poza rezolvării">
        <div class="pu-preview__actions">
          <button class="pu-btn pu-btn--reset" type="button">↺ Schimbă poza</button>
        </div>
      </div>
      <div class="pu-error" hidden></div>
    `;

    this._container.appendChild(wrap);
    this._wrap        = wrap;
    this._cameraRow    = wrap.querySelector('.pu-camera-row');
    this._cameraBtn    = wrap.querySelector('.pu-camera-btn');
    this._dropzone      = wrap.querySelector('.pu-dropzone');
    this._fileInput      = wrap.querySelector('.pu-file-input');
    this._cameraInput    = wrap.querySelector('.pu-camera-input');
    this._previewEl      = wrap.querySelector('.pu-preview');
    this._previewImg     = wrap.querySelector('.pu-preview__img');
    this._resetBtn       = wrap.querySelector('.pu-btn--reset');
    this._errorEl        = wrap.querySelector('.pu-error');
  };

  PhotoUpload.prototype._bindEvents = function () {
    var self = this;

    this._dropzone.addEventListener('click', function () { self._fileInput.click(); });
    this._dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self._fileInput.click(); }
    });
    this._cameraBtn.addEventListener('click', function () { self._cameraInput.click(); });

    this._fileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) self._handleFile(file);
      e.target.value = '';
    });
    this._cameraInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) self._handleFile(file);
      e.target.value = '';
    });

    this._dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      self._dropzone.classList.add('pu-dropzone--drag');
    });
    this._dropzone.addEventListener('dragleave', function () {
      self._dropzone.classList.remove('pu-dropzone--drag');
    });
    this._dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      self._dropzone.classList.remove('pu-dropzone--drag');
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) self._handleFile(file);
    });

    this._resetBtn.addEventListener('click', function () { self._reset(); });

    // Desktop clipboard-paste (e.g. a pasted screenshot of the solved exercise).
    this._pasteHandler = function (e) {
      if (self._destroyed) return;
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image/') === 0) {
          var file = items[i].getAsFile();
          if (file) { self._handleFile(file); break; }
        }
      }
    };
    document.addEventListener('paste', this._pasteHandler);
  };

  PhotoUpload.prototype._handleFile = function (file) {
    var self = this;
    if (!file.type || file.type.indexOf('image/') !== 0) {
      this._showError('Fișierul selectat nu este o imagine.');
      return;
    }
    this._hideError();
    this._compress(file).then(function (dataUrl) {
      if (self._destroyed) return;
      self._showPreview(dataUrl);
      self._save(dataUrl);
    }).catch(function () {
      self._showError('Nu am putut procesa imaginea. Încearcă din nou.');
    });
  };

  PhotoUpload.prototype._compress = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var scale = img.naturalWidth > MAX_W ? MAX_W / img.naturalWidth : 1;
          var w = Math.max(1, Math.round(img.naturalWidth  * scale));
          var h = Math.max(1, Math.round(img.naturalHeight * scale));
          var canvas = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          // Flattens transparency (e.g. a pasted PNG screenshot) onto white
          // before JPEG encoding, which has no alpha channel of its own.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL('image/jpeg', JPEG_Q));
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = function () { reject(new Error('load-failed')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('read-failed')); };
      reader.readAsDataURL(file);
    });
  };

  PhotoUpload.prototype._showPreview = function (dataUrl) {
    this._previewImg.src = dataUrl;
    this._previewEl.hidden = false;
    this._dropzone.hidden = true;
    this._cameraRow.hidden = true;
  };

  PhotoUpload.prototype._reset = function () {
    this._previewEl.hidden = true;
    this._previewImg.src = '';
    this._dropzone.hidden = false;
    this._cameraRow.hidden = !this._isMobile();
    this._save(null);
  };

  PhotoUpload.prototype._save = function (dataUrl) {
    if (this._onSave) this._onSave(dataUrl || '');
  };

  PhotoUpload.prototype._showError = function (msg) {
    this._errorEl.textContent = msg;
    this._errorEl.hidden = false;
    if (global.BM && global.BM.toast) global.BM.toast(msg, 'error');
  };

  PhotoUpload.prototype._hideError = function () {
    this._errorEl.hidden = true;
  };

  // Photo saves are synchronous (no debounce like DrawingCanvas' stroke
  // buffer), so there's never a pending write to flush — kept only so
  // bac.js can call it unconditionally regardless of which widget is active.
  PhotoUpload.prototype.flush = function () {};

  PhotoUpload.prototype.destroy = function () {
    this._destroyed = true;
    document.removeEventListener('paste', this._pasteHandler);
    if (this._wrap && this._wrap.parentNode) this._wrap.parentNode.removeChild(this._wrap);
  };

  global.PhotoUpload = PhotoUpload;

})(window);
