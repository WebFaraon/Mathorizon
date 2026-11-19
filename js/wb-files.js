/* ============================================================
   Tabla live: the teacher's files (2026-11-20)
   A library of pictures and PDFs (table wb_files, private bucket wb-files) that a teacher fills ahead of time (profile page) or on the
   spot (the picture key of the board's toolbar), and puts on the board. A PDF is put page by page: the teacher picks the pages, each is
   drawn once by pdf.js (js/vendor/pdfjs, loaded only when a PDF is opened), saved as a picture and placed as an ordinary picture object.

     WBFiles.open({ supabase, userId, mode: 'insert' | 'manage', getView, insert })
        insert(specs) -> Promise: puts [{src, width, height, left, top, name}] on the board (js/whiteboard.js insertImage)
        getView()     -> {cx, cy, w, h, boardW, boardH}: where the teacher is looking (to place what is inserted)
   ============================================================ */
(function (global) {
  'use strict';

  var BUCKET = 'wb-files';
  var MAX_BYTES = 25 * 1024 * 1024;       // same as the bucket's limit
  var MAX_SIDE = 2400;                    // pictures are brought down to this many pixels on the long side
  var PAGE_W = 1600;                      // a PDF page is drawn this wide
  var THUMB_W = 360;
  var PDF_SRC = 'js/vendor/pdfjs/pdf.min.js';
  var PDF_WORKER = 'js/vendor/pdfjs/pdf.worker.min.js';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(name, size) { return global.icon ? global.icon(name, { size: size || 18 }) : ''; }
  function uuid() { return (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'f' + Date.now() + Math.random().toString(16).slice(2); }
  function toast(msg, kind) { if (global.BM && BM.toast) BM.toast(msg, kind || 'info'); }
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function extOf(name, mime) {
    var m = /\.([a-z0-9]{2,5})$/i.exec(name || '');
    if (m) return m[1].toLowerCase();
    return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' })[mime] || 'bin';
  }

  /* ---------- pdf.js, only when needed ---------- */
  var pdfReady = null;
  function loadPdfJs() {
    if (global.pdfjsLib) { global.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER; return Promise.resolve(global.pdfjsLib); }
    if (pdfReady) return pdfReady;
    pdfReady = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = PDF_SRC;
      sc.onload = function () { global.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER; resolve(global.pdfjsLib); };
      sc.onerror = function () { pdfReady = null; reject(new Error('pdf.js nu s-a putut încărca')); };
      document.head.appendChild(sc);
    });
    return pdfReady;
  }

  /* ---------- images: bring down to size ---------- */
  function decode(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { resolve({ im: im, url: url }); };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Fișierul nu e o imagine pe care o putem citi.')); };
      im.src = url;
    });
  }
  function canvasBlob(canvas, type, q) {
    return new Promise(function (resolve) { canvas.toBlob(function (b) { resolve(b); }, type, q); });
  }
  function drawScaled(im, w, h, maxSide, white) {
    var k = Math.min(1, maxSide / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var ctx = c.getContext('2d');
    if (white) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, 0, 0, cw, ch);
    return c;
  }

  /* ---------- the dialog ---------- */
  function open(opts) {
    var sb = opts.supabase, uid = opts.userId, insertMode = opts.mode === 'insert';
    document.querySelectorAll('.wbf').forEach(function (n) { n.remove(); });
    var root = document.createElement('div');
    root.className = 'wbf';
    root.innerHTML =
      '<div class="wbf__card" role="dialog" aria-modal="true" aria-label="Fișierele mele">' +
        '<div class="wbf__head">' +
          '<button type="button" class="wbf__back" id="wbfBack" hidden aria-label="Înapoi la fișiere">' + ico('chevron-left', 20) + '</button>' +
          '<div class="wbf__title"><h2 id="wbfTitle">Fișierele mele</h2><p id="wbfSub">Imagini și PDF-uri pentru tablă</p></div>' +
          '<button type="button" class="wbf__x" id="wbfClose" aria-label="Închide">' + ico('x', 18) + '</button>' +
        '</div>' +
        '<div class="wbf__body" id="wbfBody"></div>' +
        '<div class="wbf__foot" id="wbfFoot" hidden></div>' +
      '</div>';
    document.body.appendChild(root);
    var body = root.querySelector('#wbfBody'), foot = root.querySelector('#wbfFoot'), titleEl = root.querySelector('#wbfTitle'), subEl = root.querySelector('#wbfSub'), backBtn = root.querySelector('#wbfBack');
    var files = [], thumbs = {}, pdfDoc = null, pdfFile = null, picked = new Set(), busy = false, closed = false;
    var fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.multiple = true; fileInput.accept = 'image/*,application/pdf'; fileInput.hidden = true;
    root.appendChild(fileInput);

    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      root.classList.remove('on');
      setTimeout(function () { root.remove(); }, 180);
    }
    function onKey(e) { if (e.key === 'Escape' && !busy) { if (pdfFile) showList(); else close(); } }
    document.addEventListener('keydown', onKey);
    root.addEventListener('click', function (e) { if (e.target === root && !busy) close(); });
    root.querySelector('#wbfClose').addEventListener('click', function () { if (!busy) close(); });
    backBtn.addEventListener('click', function () { if (!busy) showList(); });
    requestAnimationFrame(function () { root.classList.add('on'); });

    /* ----- library ----- */
    function loadFiles() {
      return sb.from('wb_files').select('*').order('created_at', { ascending: false }).then(function (r) {
        if (r.error) throw r.error;
        files = r.data || [];
        var paths = files.map(function (f) { return thumbPath(f); });
        if (!paths.length) return;
        return sb.storage.from(BUCKET).createSignedUrls(paths, 3600).then(function (res) {
          (res.data || []).forEach(function (x, i) { if (x && x.signedUrl && !x.error) thumbs[files[i].id] = x.signedUrl; });
        }, function () {});
      });
    }
    function thumbPath(f) { return uid + '/t/' + f.id + '.jpg'; }

    function showList() {
      pdfDoc = null; pdfFile = null; picked = new Set();
      backBtn.hidden = true; foot.hidden = true;
      titleEl.textContent = 'Fișierele mele';
      subEl.textContent = insertMode ? 'Alege ce pui pe tablă, sau încarcă un fișier nou' : 'Imagini și PDF-uri pe care le poți pune pe tablă';
      body.innerHTML = '<div class="wbf__bar">' +
          '<button type="button" class="wbf__go" id="wbfUp">' + ico('plus', 18) + '<span>Încarcă fișiere</span></button>' +
          '<span class="wbf__hint">Imagini și PDF-uri, până la 25 MB fiecare</span>' +
        '</div><div class="wbf__grid" id="wbfGrid"></div>';
      body.querySelector('#wbfUp').addEventListener('click', function () { if (!busy) fileInput.click(); });
      drawGrid();
    }

    function drawGrid() {
      var grid = body.querySelector('#wbfGrid');
      if (!grid) return;
      if (!files.length) {
        grid.innerHTML = '<div class="wbf__empty"><div class="wbf__empty-ic">' + ico('file', 34) + '</div><b>Nu ai niciun fișier încă</b>' +
          '<span>Încarcă o imagine sau un PDF și îl poți pune pe orice tablă, la orice lecție.</span></div>';
        return;
      }
      grid.innerHTML = files.map(function (f) {
        var isPdf = f.kind === 'pdf';
        var t = thumbs[f.id];
        var meta = (isPdf ? 'PDF' + (f.pages ? ' · ' + f.pages + (f.pages === 1 ? ' pagină' : ' pagini') : '') : 'Imagine') + ' · ' + fmtSize(f.size || 0);
        return '<div class="wbf__item" data-id="' + esc(f.id) + '">' +
          '<button type="button" class="wbf__thumb" data-act="use" aria-label="' + (insertMode ? 'Pune pe tablă: ' : 'Deschide: ') + esc(f.name) + '">' +
            (t ? '<img src="' + esc(t) + '" alt="" loading="lazy">' : '<span class="wbf__ph">' + ico(isPdf ? 'file-text' : 'image', 30) + '</span>') +
            (isPdf ? '<i class="wbf__tag">PDF</i>' : '') +
          '</button>' +
          '<div class="wbf__meta"><b title="' + esc(f.name) + '">' + esc(f.name) + '</b><span>' + esc(meta) + '</span></div>' +
          '<div class="wbf__acts">' +
            (insertMode || isPdf ? '<button type="button" class="wbf__use" data-act="use">' + (isPdf ? 'Alege paginile' : 'Pune pe tablă') + '</button>' : '') +
            '<button type="button" class="wbf__del" data-act="del" title="Șterge din bibliotecă" aria-label="Șterge ' + esc(f.name) + '">' + ico('trash-2', 16) + '</button>' +
          '</div></div>';
      }).join('');
    }

    body.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act || busy) return;
      var item = act.closest('.wbf__item');
      var f = item && files.filter(function (x) { return x.id === item.getAttribute('data-id'); })[0];
      if (!f) return;
      if (act.getAttribute('data-act') === 'del') return askDelete(f, item);
      if (f.kind === 'pdf') return openPdf(f);
      if (insertMode) return placeImage(f);
      toast('Imaginea e în bibliotecă. O pui pe tablă din tablă, cu cheia cu imagine.', 'info');
    });

    /* ----- upload ----- */
    fileInput.addEventListener('change', function () {
      var list = Array.prototype.slice.call(fileInput.files || []);
      fileInput.value = '';
      if (list.length) uploadAll(list);
    });
    root.addEventListener('dragover', function (e) { e.preventDefault(); });
    root.addEventListener('drop', function (e) {
      e.preventDefault();
      var list = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      if (list.length && !busy) uploadAll(list);
    });

    function setBusy(on, text) {
      busy = on;
      root.classList.toggle('is-busy', on);
      var bar = body.querySelector('.wbf__bar');
      if (bar) {
        var hint = bar.querySelector('.wbf__hint');
        if (hint) hint.textContent = on ? text : 'Imagini și PDF-uri, până la 25 MB fiecare';
        var up = bar.querySelector('#wbfUp'); if (up) up.disabled = on;
      }
      if (on && text && !body.querySelector('.wbf__bar')) { foot.hidden = false; foot.innerHTML = '<span class="wbf__prog">' + esc(text) + '</span>'; }
    }

    function uploadAll(list) {
      var added = [];
      var chain = Promise.resolve();
      list.forEach(function (file, i) {
        chain = chain.then(function () {
          setBusy(true, 'Se încarcă ' + (i + 1) + ' din ' + list.length + ': ' + file.name);
          return uploadOne(file).then(function (row) { if (row) added.push(row); }, function (err) { toast((file.name || 'Fișierul') + ': ' + (err && err.message || err), 'error'); });
        });
      });
      return chain.then(function () {
        setBusy(false);
        if (!added.length) return;
        files = added.concat(files);
        drawGrid();
        // one file in the board's own library: straight onto the board (a picture) or to its pages (a PDF)
        if (insertMode && added.length === 1) { if (added[0].kind === 'pdf') openPdf(added[0]); else placeImage(added[0]); }
        else toast(added.length === 1 ? 'Fișierul a fost încărcat.' : added.length + ' fișiere au fost încărcate.', 'success');
      });
    }

    function uploadOne(file) {
      var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (file.size > MAX_BYTES * (isPdf ? 1 : 2)) return Promise.reject(new Error('e prea mare (maxim 25 MB)'));
      if (!isPdf && !/^image\//.test(file.type)) return Promise.reject(new Error('nu e imagine și nici PDF'));
      var id = uuid(), st = sb.storage.from(BUCKET);
      if (isPdf) {
        var path = uid + '/' + id + '.pdf';
        return file.arrayBuffer().then(function (buf) {
          return loadPdfJs().then(function (lib) { return lib.getDocument({ data: buf.slice(0) }).promise; }).then(function (doc) {
            return doc.getPage(1).then(function (pg) {
              return renderPage(pg, THUMB_W, 0.8).then(function (r) {
                return Promise.all([st.upload(path, file, { contentType: 'application/pdf', upsert: false }), st.upload(uid + '/t/' + id + '.jpg', r.blob, { contentType: 'image/jpeg', upsert: true })]);
              });
            }).then(function (ups) {
              if (ups[0].error) throw ups[0].error;
              return insertRow({ id: id, kind: 'pdf', name: file.name, mime: 'application/pdf', size: file.size, path: path, pages: doc.numPages });
            });
          }, function () { throw new Error('PDF-ul nu poate fi citit (poate e protejat cu parolă)'); });
        });
      }
      return decode(file).then(function (d) {
        var im = d.im, w = im.naturalWidth, h = im.naturalHeight;
        var keep = /^image\/(png|jpeg|webp|gif)$/.test(file.type) && Math.max(w, h) <= MAX_SIDE && file.size <= 8 * 1024 * 1024;
        var big = keep ? Promise.resolve({ blob: file, w: w, h: h, mime: file.type }) : (function () {
          var c = drawScaled(im, w, h, MAX_SIDE, true);
          return canvasBlob(c, 'image/jpeg', 0.88).then(function (b) { return { blob: b, w: c.width, h: c.height, mime: 'image/jpeg' }; });
        })();
        var thumbC = drawScaled(im, w, h, THUMB_W, true);
        return Promise.all([big, canvasBlob(thumbC, 'image/jpeg', 0.8)]).then(function (a) {
          URL.revokeObjectURL(d.url);
          var main = a[0], path = uid + '/' + id + '.' + extOf(main.mime === file.type ? file.name : 'x.jpg', main.mime);
          if (main.blob.size > MAX_BYTES) throw new Error('e prea mare (maxim 25 MB)');
          return Promise.all([st.upload(path, main.blob, { contentType: main.mime, upsert: false }), st.upload(uid + '/t/' + id + '.jpg', a[1], { contentType: 'image/jpeg', upsert: true })]).then(function (ups) {
            if (ups[0].error) throw ups[0].error;
            return insertRow({ id: id, kind: 'image', name: file.name, mime: main.mime, size: main.blob.size, path: path, width: main.w, height: main.h });
          });
        });
      });
    }

    function insertRow(row) {
      row.owner_id = uid;
      return sb.from('wb_files').insert(row).select().single().then(function (r) {
        if (r.error) throw r.error;
        return sb.storage.from(BUCKET).createSignedUrl(thumbPath(r.data), 3600).then(function (s) { if (s.data && s.data.signedUrl) thumbs[r.data.id] = s.data.signedUrl; return r.data; }, function () { return r.data; });
      });
    }

    /* ----- delete ----- */
    function askDelete(f, item) {
      var acts = item.querySelector('.wbf__acts');
      acts.innerHTML = '<span class="wbf__ask">Ștergi?</span><button type="button" class="wbf__use wbf__use--no" data-x="no">Nu</button><button type="button" class="wbf__use wbf__use--yes" data-x="yes">Șterge</button>';
      acts.addEventListener('click', function h(e) {
        var b = e.target.closest('[data-x]');
        if (!b) return;
        e.stopPropagation();
        acts.removeEventListener('click', h);
        if (b.getAttribute('data-x') === 'no') { drawGrid(); return; }
        removeFile(f);
      }, true);
    }
    // A picture that is on a board stays readable there: only the library entry goes then (a file nobody uses is removed completely).
    function removeFile(f) {
      setBusy(true, 'Se șterge…');
      var st = sb.storage.from(BUCKET);
      var q = f.kind === 'pdf'
        ? sb.from('whiteboard_objects').select('id', { count: 'exact', head: true }).like('fabric_json->>src', uid + '/p/' + f.id + '-%')
        : sb.from('whiteboard_objects').select('id', { count: 'exact', head: true }).eq('fabric_json->>src', f.path);
      q.then(function (r) {
        var used = !r.error && (r.count || 0) > 0;
        var del = used ? Promise.resolve() : (f.kind === 'pdf'
          ? st.list(uid + '/p', { limit: 200, search: f.id + '-' }).then(function (l) { return st.remove([f.path, thumbPath(f)].concat((l.data || []).map(function (o) { return uid + '/p/' + o.name; }))); })
          : st.remove([f.path, thumbPath(f)]));
        return Promise.resolve(del).then(function () { return sb.from('wb_files').delete().eq('id', f.id); }).then(function (d) {
          if (d.error) throw d.error;
          files = files.filter(function (x) { return x.id !== f.id; });
          setBusy(false); drawGrid();
          toast(used ? 'Șters din bibliotecă. Rămâne pe tablele unde a fost pus.' : 'Fișierul a fost șters.', 'info');
        });
      }).catch(function (err) { setBusy(false); drawGrid(); toast('Nu s-a putut șterge: ' + (err && err.message || err), 'error'); });
    }

    /* ----- put a picture on the board ----- */
    function fitSize(w, h, maxW, maxH) { var k = Math.min(maxW / w, maxH / h, 1.6); return { w: w * k, h: h * k }; }
    function clampCentre(c, size, board) { return Math.min(Math.max(c, size / 2 + 12), board - size / 2 - 12); }

    function placeImage(f) {
      if (!opts.insert) return;
      var v = (opts.getView && opts.getView()) || { cx: 700, cy: 450, w: 1400, h: 900, boardW: 1400, boardH: 900 };
      var sz = fitSize(f.width || 800, f.height || 600, Math.min(v.w * 0.7, 980), Math.min(v.h * 0.8, 720));
      var spec = { src: f.path, width: sz.w, height: sz.h, left: clampCentre(v.cx, sz.w, v.boardW), top: clampCentre(v.cy, sz.h, v.boardH), name: f.name };
      setBusy(true, 'Se pune pe tablă…');
      Promise.resolve(opts.insert([spec])).then(function (ok) {
        setBusy(false);
        if (ok !== false) close();
      }, function () { setBusy(false); });
    }

    /* ----- PDF: pick pages ----- */
    function renderPage(page, width, q) {
      var vp1 = page.getViewport({ scale: 1 });
      var scale = Math.min(width / vp1.width, 3200 / vp1.height);
      var vp = page.getViewport({ scale: scale });
      var c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
        return canvasBlob(c, 'image/jpeg', q || 0.88).then(function (blob) { return { blob: blob, w: c.width, h: c.height }; });
      });
    }

    function openPdf(f) {
      pdfFile = f;
      backBtn.hidden = false;
      titleEl.textContent = f.name;
      subEl.textContent = insertMode ? 'Alege paginile care intră pe tablă' : 'Paginile PDF-ului';
      body.innerHTML = '<div class="wbf__loading"><div class="classes-spinner"></div><span>Se deschide PDF-ul…</span></div>';
      foot.hidden = true;
      Promise.all([loadPdfJs(), sb.storage.from(BUCKET).download(f.path)]).then(function (a) {
        if (a[1].error) throw a[1].error;
        return a[1].data.arrayBuffer().then(function (buf) { return a[0].getDocument({ data: buf }).promise; });
      }).then(function (doc) {
        if (closed || pdfFile !== f) return;
        pdfDoc = doc;
        var n = doc.numPages;
        if (n === 1) picked = new Set([1]);
        body.innerHTML = (insertMode ? '<div class="wbf__bar"><button type="button" class="wbf__ghost" id="wbfAll">Toate paginile</button><button type="button" class="wbf__ghost" id="wbfNone">Nicio pagină</button><span class="wbf__hint">' + n + (n === 1 ? ' pagină' : ' pagini') + '</span></div>' : '') +
          '<div class="wbf__pages" id="wbfPages">' + Array.apply(null, Array(n)).map(function (_, i) {
            return '<button type="button" class="wbf__pg" data-p="' + (i + 1) + '" aria-pressed="' + picked.has(i + 1) + '"><span class="wbf__pgimg" data-loaded="0"></span><b>' + (i + 1) + '</b><i class="wbf__chk">' + ico('check', 16) + '</i></button>';
          }).join('') + '</div>';
        var pagesEl = body.querySelector('#wbfPages');
        var io = ('IntersectionObserver' in global) ? new IntersectionObserver(function (es) {
          es.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); drawThumb(en.target); } });
        }, { root: body, rootMargin: '200px' }) : null;
        pagesEl.querySelectorAll('.wbf__pg').forEach(function (b) { if (io) io.observe(b); else drawThumb(b); });
        function drawThumb(btn) {
          var n2 = +btn.getAttribute('data-p'), slot = btn.querySelector('.wbf__pgimg');
          pdfDoc.getPage(n2).then(function (pg) { return renderPage(pg, 280, 0.75); }).then(function (r) {
            if (closed) return;
            var im = document.createElement('img'); im.alt = ''; im.src = URL.createObjectURL(r.blob);
            slot.appendChild(im); slot.setAttribute('data-loaded', '1'); slot.style.aspectRatio = r.w + ' / ' + r.h;
          }).catch(function () {});
        }
        if (!insertMode) { foot.hidden = true; return; }
        pagesEl.addEventListener('click', function (e) {
          var b = e.target.closest('.wbf__pg');
          if (!b || busy) return;
          var p = +b.getAttribute('data-p');
          if (picked.has(p)) picked.delete(p); else picked.add(p);
          b.setAttribute('aria-pressed', picked.has(p));
          syncFoot();
        });
        body.querySelector('#wbfAll').addEventListener('click', function () { for (var i = 1; i <= n; i++) picked.add(i); pagesEl.querySelectorAll('.wbf__pg').forEach(function (b) { b.setAttribute('aria-pressed', 'true'); }); syncFoot(); });
        body.querySelector('#wbfNone').addEventListener('click', function () { picked.clear(); pagesEl.querySelectorAll('.wbf__pg').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); syncFoot(); });
        syncFoot();
      }).catch(function (err) {
        body.innerHTML = '<div class="wbf__empty"><b>PDF-ul nu s-a putut deschide</b><span>' + esc(err && err.message || err) + '</span></div>';
      });
    }

    function syncFoot() {
      foot.hidden = false;
      var n = picked.size;
      foot.innerHTML = '<span class="wbf__prog" id="wbfProg">' + (n ? n + (n === 1 ? ' pagină aleasă' : ' pagini alese') : 'Alege cel puțin o pagină') + '</span>' +
        '<button type="button" class="wbf__go" id="wbfPlace"' + (n ? '' : ' disabled') + '>' + ico('check', 18) + '<span>Pune pe tablă</span></button>';
      foot.querySelector('#wbfPlace').addEventListener('click', placePages);
    }

    // The chosen pages: each is drawn at full size, saved as a picture (once per page: the same page is not uploaded twice) and placed in a
    // tidy grid around the middle of what the teacher is looking at.
    function placePages() {
      if (busy || !picked.size || !opts.insert) return;
      var list = Array.from(picked).sort(function (a, b) { return a - b; });
      var f = pdfFile, st = sb.storage.from(BUCKET), specs = [];
      busy = true; root.classList.add('is-busy');
      var prog = function (t) { var el = foot.querySelector('#wbfProg'); if (el) el.textContent = t; var b = foot.querySelector('#wbfPlace'); if (b) b.disabled = true; };
      var chain = Promise.resolve();
      list.forEach(function (n, i) {
        chain = chain.then(function () {
          prog('Se pregătește pagina ' + (i + 1) + ' din ' + list.length + '…');
          var path = uid + '/p/' + f.id + '-' + n + '.jpg';
          return pdfDoc.getPage(n).then(function (pg) { return renderPage(pg, PAGE_W, 0.86); }).then(function (r) {
            return st.upload(path, r.blob, { contentType: 'image/jpeg', upsert: true }).then(function (u) {
              if (u.error) throw u.error;
              specs.push({ src: path, nat: { w: r.w, h: r.h }, name: f.name + ' · pag. ' + n });
            });
          });
        });
      });
      chain.then(function () {
        var v = (opts.getView && opts.getView()) || { cx: 700, cy: 450, w: 1400, h: 900, boardW: 1400, boardH: 900 };
        var cols = Math.min(specs.length, 3), rows = Math.ceil(specs.length / cols), gap = 28;
        var aspect = specs[0].nat.h / specs[0].nat.w;
        var pw = Math.min(560, (v.boardW - 60 - gap * (cols - 1)) / cols);
        var ph = pw * aspect;
        var k = Math.min(1, (v.boardH - 60 - gap * (rows - 1)) / (rows * ph));
        pw *= k; ph *= k;
        var totalW = cols * pw + (cols - 1) * gap, totalH = rows * ph + (rows - 1) * gap;
        var x0 = Math.min(Math.max(v.cx - totalW / 2, 20), v.boardW - totalW - 20), y0 = Math.min(Math.max(v.cy - totalH / 2, 20), v.boardH - totalH - 20);
        var out = specs.map(function (s, i) {
          var c = i % cols, r = Math.floor(i / cols);
          var h2 = pw * (s.nat.h / s.nat.w);
          return { src: s.src, width: pw, height: h2, left: x0 + c * (pw + gap) + pw / 2, top: y0 + r * (ph + gap) + h2 / 2, name: s.name };
        });
        prog('Se pun pe tablă…');
        return Promise.resolve(opts.insert(out));
      }).then(function (ok) {
        busy = false; root.classList.remove('is-busy');
        if (ok !== false) close(); else syncFoot();
      }).catch(function (err) {
        busy = false; root.classList.remove('is-busy');
        toast('Nu s-au putut pune paginile: ' + (err && err.message || err), 'error');
        syncFoot();
      });
    }

    /* ----- start ----- */
    body.innerHTML = '<div class="wbf__loading"><div class="classes-spinner"></div><span>Se încarcă fișierele…</span></div>';
    loadFiles().then(showList, function (err) {
      body.innerHTML = '<div class="wbf__empty"><b>Fișierele nu se pot citi încă</b><span>' + esc(err && err.message || err) + '</span></div>';
    });
    return { close: close };
  }

  global.WBFiles = { open: open };
})(window);
