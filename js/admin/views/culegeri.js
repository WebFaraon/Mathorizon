/* ============================================================
   Admin console: Culegeri
   ============================================================
   Scanned PDF textbooks, uploaded into the private Storage bucket 'culegeri' and listed in the table culegeri
   (supabase/migrations/20260908090000_culegeri_library.sql). Approved teachers browse them from the class page
   (exercise picker, simulations, homework). Admin only.
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI;
  const { esc, ico } = U;

  const GRADES = [
    { id: '5', label: 'Clasa a 5-a' }, { id: '6', label: 'Clasa a 6-a' }, { id: '7', label: 'Clasa a 7-a' }, { id: '8', label: 'Clasa a 8-a' },
    { id: '9', label: 'Clasa a 9-a' }, { id: '10', label: 'Clasa a 10-a' }, { id: '11', label: 'Clasa a 11-a' }, { id: 'bac', label: 'Clasa a 12-a · BAC' }
  ];
  const GRADE_LABEL = Object.fromEntries(GRADES.map(g => [g.id, g.label]));
  const MAX_BYTES = 200 * 1024 * 1024;          // the bucket's own limit: checked here so a big file fails before a slow upload
  const mb = n => (n / 1024 / 1024).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1) + ' MB';
  const sb = () => window.BMAuth && window.BMAuth.supabase;

  // kept outside render(): the page is drawn again when the registers change, and a half-filled form must survive that
  let form = { title: '', grade: '', file: null };
  let items = null, loadErr = '', busy = false, root = null;

  function dropHTML() {
    const f = form.file;
    return `<input type="file" id="cgFile" accept="application/pdf,.pdf" hidden>
      <label for="cgFile" class="cg-drop${f ? ' is-set' : ''}" id="cgDrop">
        <span class="cg-drop__pic">${ico(f ? 'file-text' : 'upload', 24)}</span>
        <b>${f ? esc(f.name) : 'Alege fișierul PDF'}</b>
        <small>${f ? mb(f.size) + ' · apasă pentru alt fișier' : 'sau trage-l aici · maximum 200 MB'}</small>
      </label>`;
  }

  function listHTML() {
    if (loadErr) return `<div class="ax-empty">${esc(loadErr)}</div>`;
    if (!items) return `<div class="ax-empty">Se încarcă…</div>`;
    if (!items.length) return `<div class="ax-empty">Nicio culegere încărcată.</div>`;
    return `<ul class="cg-list">${items.map(r => `
      <li class="cg-row">
        <div class="cg-row__t"><b>${esc(r.title)}</b><span class="ax-sub">${esc(GRADE_LABEL[r.grade] || r.grade)} · ${new Date(r.created_at).toLocaleDateString('ro-RO')}</span></div>
        <div class="cg-row__k">
          <button type="button" class="ax-btn ax-btn--sm" data-open="${esc(r.id)}">${ico('external', 16)} Deschide</button>
          <button type="button" class="ax-btn ax-btn--sm cg-del" data-del="${esc(r.id)}">${ico('trash-2', 16)} Șterge</button>
        </div>
      </li>`).join('')}</ul>`;
  }

  const ready = () => !!(form.file && form.title.trim() && form.grade);

  function paintList() {
    const box = root && root.querySelector('#cgList');
    if (!box) return;
    box.innerHTML = listHTML();
    const n = root.querySelector('#cgCount');
    if (n) n.textContent = items ? String(items.length) : '';
  }
  function paintDrop() {
    const box = root && root.querySelector('#cgDropBox');
    if (!box) return;
    box.innerHTML = dropHTML();
    wireDrop();
    sync();
  }
  function sync() {
    const b = root && root.querySelector('#cgGo');
    if (b) b.disabled = busy || !ready();
  }

  function setFile(file) {
    if (!file) return;
    if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) { U.toast('Doar fișiere PDF.', 'warn'); return; }
    if (file.size > MAX_BYTES) { U.toast(`Fișierul are ${mb(file.size)}, limita e 200 MB.`, 'warn'); return; }
    form.file = file;
    paintDrop();
  }

  function wireDrop() {
    const input = root.querySelector('#cgFile'), drop = root.querySelector('#cgDrop');
    input.addEventListener('change', () => setFile(input.files[0]));
    // a dropped file ignores the input's accept filter, so setFile checks the type again
    ['dragover', 'dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.toggle('is-over', ev === 'dragover');
      if (ev === 'drop' && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
    }));
  }

  async function load() {
    const c = sb();
    if (!c) { loadErr = 'Nu există o sesiune activă.'; paintList(); return; }
    const { data, error } = await c.from('culegeri').select('*').order('created_at', { ascending: false });
    if (error) { loadErr = error.message; items = null; } else { loadErr = ''; items = data || []; }
    paintList();
  }

  async function upload() {
    if (!ready() || busy) return;
    const btn = root.querySelector('#cgGo');
    busy = true; btn.disabled = true; btn.textContent = 'Se încarcă…';
    try {
      const file = form.file, title = form.title.trim(), grade = form.grade;
      const path = `${grade}/${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const up = await sb().storage.from('culegeri').upload(path, file, { upsert: false, contentType: 'application/pdf' });
      if (up.error) throw new Error(up.error.message);
      const ins = await sb().from('culegeri').insert({ title, grade, file_path: path, uploaded_by: window.BMAuth.user.id });
      if (ins.error) throw new Error(ins.error.message);
      U.toast('Culegere adăugată.');
      form = { title: '', grade: '', file: null };
      busy = false;
      render(root);
      load();
    } catch (e) {
      busy = false;
      btn.textContent = 'Încarcă culegerea';
      sync();
      U.toast('Nu s-a încărcat: ' + e.message, 'warn');
    }
  }

  async function open(id) {
    const row = (items || []).find(r => r.id === id);
    if (!row) return;
    const { data, error } = await sb().storage.from('culegeri').createSignedUrl(row.file_path, 300);
    if (error) { U.toast(error.message, 'warn'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function remove(id) {
    const row = (items || []).find(r => r.id === id);
    if (!row || !confirm(`Ștergi „${row.title}"? Nu mai poate fi recuperată.`)) return;
    try {
      await sb().storage.from('culegeri').remove([row.file_path]);
      const { error } = await sb().from('culegeri').delete().eq('id', row.id);
      if (error) throw new Error(error.message);
      U.toast('Culegere ștearsă.');
      load();
    } catch (e) {
      U.toast('Nu s-a șters: ' + e.message, 'warn');
    }
  }

  function render(r) {
    root = r;
    r.innerHTML = `
      <div class="cg">
        <header class="ax-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('library', 24)}</span>
            <div><h1 class="ax-h1">Culegeri</h1></div>
          </div>
        </header>

        <section class="ax-panel" aria-labelledby="cgNewT">
          <div class="ax-panel__head"><h2 class="ax-h2" id="cgNewT">Culegere nouă</h2></div>
          <div class="ax-panel__body cg-form">
            <label class="cg-f"><span>Titlu</span><input class="ax-input" id="cgTitle" maxlength="120" placeholder="ex: Culegere BAC Matematică, Prut 2024" autocomplete="off" value="${esc(form.title)}"></label>
            <div class="cg-f"><label for="cgGrade">Clasă</label>
              <select class="ax-select" id="cgGrade"><option value="" disabled hidden${form.grade ? '' : ' selected'}>Alege clasa</option>${GRADES.map(g => `<option value="${g.id}"${form.grade === g.id ? ' selected' : ''}>${g.label}</option>`).join('')}</select></div>
            <div class="cg-f"><span>Fișier PDF</span><div id="cgDropBox">${dropHTML()}</div></div>
            <div class="cg-act"><button type="button" class="ax-btn ax-btn--dark" id="cgGo" disabled>Încarcă culegerea</button></div>
          </div>
        </section>

        <section class="ax-panel" aria-labelledby="cgListT">
          <div class="ax-panel__head"><h2 class="ax-h2" id="cgListT">Culegeri încărcate <span class="cg-n" id="cgCount">${items ? items.length : ''}</span></h2></div>
          <div id="cgList">${listHTML()}</div>
        </section>
      </div>`;
    r.querySelector('#cgTitle').addEventListener('input', e => { form.title = e.target.value; sync(); });
    r.querySelector('#cgGrade').addEventListener('change', e => { form.grade = e.target.value; sync(); });
    r.querySelector('#cgGo').addEventListener('click', upload);
    r.querySelector('#cgList').addEventListener('click', e => {
      const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
      if (o) open(o.dataset.open); else if (d) remove(d.dataset.del);
    });
    wireDrop();
    U.enhanceSelects(r);
    sync();
  }

  window.AdminViews.culegeri = {
    title: 'Culegeri',
    icon: 'library',
    demo: false,
    render(r) { render(r); load(); }
  };
})();
