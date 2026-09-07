/* ============================================================
   Mathorizon — Admin "Culegeri" page (admin-culegeri.html)
   Admin-only upload of scanned PDF textbooks into a private Supabase
   Storage bucket ('culegeri') — visible to approved teachers (role=
   profesor) and admin via the culegeri table's RLS, browsed from the
   exercise-picker in js/class-page.js (see the "Din culegere" tab).
   See supabase/migrations/20260908090000_culegeri_library.sql for the
   table/bucket/RLS this page depends on.
   ============================================================ */

(function () {
  'use strict';

  const GRADES = [
    { id: '5',   label: 'Clasa a 5-a' },
    { id: '6',   label: 'Clasa a 6-a' },
    { id: '7',   label: 'Clasa a 7-a' },
    { id: '8',   label: 'Clasa a 8-a' },
    { id: '9',   label: 'Clasa a 9-a' },
    { id: '10',  label: 'Clasa a 10-a' },
    { id: '11',  label: 'Clasa a 11-a' },
    { id: 'bac', label: 'Clasa a 12-a · BAC' }
  ];
  const GRADE_LABEL = Object.fromEntries(GRADES.map(g => [g.id, g.label]));

  // Matches the bucket's file_size_limit in supabase/migrations/20260908090000_
  // culegeri_library.sql — checked here too so a too-large file fails fast
  // with a clear message instead of after a slow upload attempt errors out
  // against Supabase's own limit.
  const MAX_FILE_BYTES = 200 * 1024 * 1024;

  let selectedFile = null;
  let culegeriCache = [];

  /* ---- Auth guard (same pattern as js/admin-add-exercise.js) ---- */
  function _waitForAuth() {
    return new Promise(resolve => {
      if (window._bmAuthReady) return resolve(window.BMAuth);
      const timer = setTimeout(() => resolve(window.BMAuth), 6000);
      document.addEventListener('bmauth:ready', () => { clearTimeout(timer); resolve(window.BMAuth); }, { once: true });
    });
  }
  function _waitForProfile() {
    return new Promise(resolve => {
      if (window.BMAuth?.role) return resolve();
      document.addEventListener('bmauth:profile', resolve, { once: true });
      setTimeout(resolve, 5000);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const auth = await _waitForAuth();
    if (!auth.user) { window.location.replace('auth.html?from=admin-culegeri.html'); return; }
    await _waitForProfile();

    const loading = document.getElementById('clLoading');
    const denied  = document.getElementById('clDenied');
    const wrap    = document.getElementById('clWrap');
    if (auth.role !== 'admin') {
      if (loading) loading.style.display = 'none';
      if (denied)  denied.style.display  = '';
      return;
    }
    if (loading) loading.style.display = 'none';
    if (wrap)    wrap.style.display    = '';

    document.getElementById('clGrade').innerHTML = `<option value="" selected disabled>Alege clasa…</option>`
      + GRADES.map(g => `<option value="${g.id}">${g.label}</option>`).join('');
    // Same styled dropdown used everywhere else (.cls-form-select is
    // display:none by design — this replaces it with the real widget
    // instead of leaving it invisible or falling back to the unstyled
    // native <select> popup).
    BM.initCustomSelects();
    _bindUpload();
    _loadList();
  });

  // BM.makeCustomSelect's visible label only updates through its own click
  // handler — setting the underlying <select>'s .value programmatically
  // (as after a successful upload) clears the real value but leaves the
  // styled dropdown showing the previous class. Reset both halves by hand.
  function _resetGradeSelect() {
    const sel = document.getElementById('clGrade');
    sel.value = '';
    const wrapper = sel.previousElementSibling;
    if (!wrapper || !wrapper.classList.contains('cls-csel')) return;
    const display = wrapper.querySelector('.cls-csel__display');
    if (display) {
      display.textContent = 'Alege clasa…';
      display.removeAttribute('data-has-value');
    }
    wrapper.querySelectorAll('.cls-csel__option--sel').forEach(el => el.classList.remove('cls-csel__option--sel'));
  }

  function _resetDropZone() {
    document.getElementById('clDropMain').innerHTML = 'Trage fișierul PDF aici sau <u>alege din calculator</u>';
    document.getElementById('clDropHint').textContent = 'PDF · Max 200MB';
  }

  function _bindUpload() {
    const fileInput  = document.getElementById('clFileInput');
    const dropLabel  = document.getElementById('clDropLabel');
    const uploadBtn  = document.getElementById('clUploadBtn');
    const titleInput = document.getElementById('clTitle');
    const gradeSelect = document.getElementById('clGrade');

    function checkReady() {
      uploadBtn.disabled = !(selectedFile && titleInput.value.trim() && gradeSelect.value);
    }

    function setFile(file) {
      if (!file) return;
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf) { BM.toast('Doar fișiere PDF sunt acceptate.', 'error'); return; }
      if (file.size > MAX_FILE_BYTES) {
        BM.toast(`Fișierul are ${(file.size / 1024 / 1024).toFixed(0)}MB — depășește limita de 200MB.`, 'error');
        return;
      }
      selectedFile = file;
      document.getElementById('clDropMain').textContent = file.name;
      document.getElementById('clDropHint').textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB — alege alt fișier pentru a înlocui`;
      checkReady();
    }

    fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
    titleInput.addEventListener('input', checkReady);
    gradeSelect.addEventListener('change', checkReady);

    // Native drag/drop ignores the input's `accept` filter, so PDF-ness is
    // re-checked manually inside setFile() regardless of entry point.
    ['dragover', 'dragleave', 'drop'].forEach(evt => {
      dropLabel.addEventListener(evt, e => {
        e.preventDefault();
        dropLabel.classList.toggle('wz-upload-drop--over', evt === 'dragover');
        if (evt === 'drop' && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
      });
    });

    uploadBtn.addEventListener('click', _doUpload);
  }

  async function _doUpload() {
    const btn   = document.getElementById('clUploadBtn');
    const title = document.getElementById('clTitle').value.trim();
    const grade = document.getElementById('clGrade').value;
    if (!selectedFile || !title || !grade) return;

    btn.disabled = true;
    btn.textContent = 'Se încarcă…';
    try {
      const slug = Math.random().toString(36).slice(2, 8);
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${grade}/${slug}-${safeName}`;

      const { error: upErr } = await BMAuth.supabase.storage
        .from('culegeri')
        .upload(path, selectedFile, { upsert: false, contentType: 'application/pdf' });
      if (upErr) throw new Error(upErr.message);

      const { error: dbErr } = await BMAuth.supabase.from('culegeri').insert({
        title, grade, file_path: path, uploaded_by: BMAuth.user.id
      });
      if (dbErr) throw new Error(dbErr.message);

      BM.toast('Culegere adăugată.', 'success');
      selectedFile = null;
      document.getElementById('clTitle').value = '';
      document.getElementById('clFileInput').value = '';
      document.getElementById('clUploadBtn').disabled = true;
      _resetGradeSelect();
      _resetDropZone();
      _loadList();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Încarcă culegerea';
    }
  }

  async function _loadList() {
    const listEl = document.getElementById('clList');
    listEl.innerHTML = `<div class="admin-empty">Se încarcă…</div>`;
    const { data, error } = await BMAuth.supabase.from('culegeri').select('*').order('created_at', { ascending: false });
    if (error) { listEl.innerHTML = `<div class="admin-empty">Eroare: ${BM.esc(error.message)}</div>`; return; }
    culegeriCache = data || [];
    if (!culegeriCache.length) { listEl.innerHTML = `<div class="admin-empty">Nicio culegere încărcată încă.</div>`; return; }

    listEl.innerHTML = culegeriCache.map(row => `
      <div class="prof-field-row">
        <div>
          <div style="font-weight:700">${BM.esc(row.title)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${BM.esc(GRADE_LABEL[row.grade] || row.grade)} · ${new Date(row.created_at).toLocaleDateString('ro-RO')}</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn btn--surface btn--sm" data-open="${row.id}">Deschide</button>
          <button class="btn btn--surface btn--sm" data-delete="${row.id}" style="color:var(--red)">Șterge</button>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('[data-open]').forEach(el => {
      el.addEventListener('click', () => _openCulegere(el.dataset.open));
    });
    listEl.querySelectorAll('[data-delete]').forEach(el => {
      el.addEventListener('click', () => _deleteCulegere(el.dataset.delete));
    });
  }

  async function _openCulegere(id) {
    const row = culegeriCache.find(r => r.id === id);
    if (!row) return;
    const { data, error } = await BMAuth.supabase.storage.from('culegeri').createSignedUrl(row.file_path, 300);
    if (error) { BM.toast('Eroare: ' + error.message, 'error'); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function _deleteCulegere(id) {
    const row = culegeriCache.find(r => r.id === id);
    if (!row) return;
    if (!confirm(`Ștergi „${row.title}"? Nu mai poate fi recuperată.`)) return;
    try {
      await BMAuth.supabase.storage.from('culegeri').remove([row.file_path]);
      const { error } = await BMAuth.supabase.from('culegeri').delete().eq('id', row.id);
      if (error) throw new Error(error.message);
      BM.toast('Culegere ștearsă.', 'success');
      _loadList();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
    }
  }
})();
