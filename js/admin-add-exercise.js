
/* ============================================================
   Mathorizon — Admin "Adaugă exercițiu" full page
   (admin-add-exercise.html). Replaces the old modal wizard
   (js/admin-exercise.js) — same photo → Gemini → editable
   review → publish flow, just laid out as one continuously
   scrollable page instead of stepped modal screens, with the
   AI review section now genuinely editable (not just a preview)
   and, for Geometrie, a full-size figure editor before the photo
   section.
   ============================================================ */

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  const GRADES = [
    { id: '9',   label: 'Clasa a 9-a' },
    { id: 'bac', label: 'Clasa a 12-a · BAC' }
  ];
  const DIFFICULTIES = [
    { id: 'usor',     label: 'Ușor' },
    { id: 'mediu',    label: 'Mediu' },
    { id: 'dificil',  label: 'Dificil' },
    { id: 'legendar', label: 'Legendar' }
  ];
  const GRADE_LABEL = { '9': 'Clasa a 9-a', bac: 'BAC' };

  let ae = {
    grade: '', categoryId: '', subcategoryId: '', difficulty: '', punctajTotal: '',
    file: null, mimeType: '', imageBase64: '', previewUrl: '',
    aiResult: null,
    figureData: null, figureSvg: null
  };
  let aeGeoEditor = null;

  // Gemini sometimes wraps raspuns_final in its own $...$/$$...$$ even though
  // the prompt asks for bare LaTeX — strip it so we can safely nest it inside
  // our own $$\boxed{...}$$ without producing unparseable nested delimiters.
  function _stripMathDelims(s) {
    return String(s || '').trim().replace(/^\$\$?(.*?)\$\$?$/s, '$1').trim();
  }

  /* ---- Auth guard (same pattern as js/admin-page.js) ---- */
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
    if (!auth.user) { window.location.replace('auth.html?from=admin-add-exercise.html'); return; }
    await _waitForProfile();

    const loading = document.getElementById('aeLoading');
    const denied  = document.getElementById('aeDenied');
    const wrap    = document.getElementById('aeWrap');
    if (auth.role !== 'admin') {
      if (loading) loading.style.display = 'none';
      if (denied)  denied.style.display  = '';
      return;
    }

    window._adminSession = (await auth.supabase.auth.getSession()).data.session;
    if (loading) loading.style.display = 'none';
    if (wrap)    wrap.style.display    = '';

    _aeRenderDetalii();
    _aeRenderFoto();
    document.getElementById('aeConfirmBtn').addEventListener('click', _aeSave);
  });

  /* ---- §1 Detalii ---- */
  function _aeRenderDetalii() {
    const body = document.getElementById('aeDetaliiBody');
    const cat  = BM.getCategoryById(ae.categoryId);
    const subs = cat ? cat.subcategories : [];
    body.innerHTML = `
      <div class="ae-detalii-grid">
        <div class="cls-form-field">
          <label class="cls-form-label">Clasă *</label>
          <select id="aeGrade" class="cls-form-input cls-form-select">
            <option value="">Alege clasa…</option>
            ${GRADES.map(g => `<option value="${g.id}" ${ae.grade === g.id ? 'selected' : ''}>${g.label}</option>`).join('')}
          </select>
        </div>
        <div class="cls-form-field">
          <label class="cls-form-label">Capitol *</label>
          <select id="aeCategory" class="cls-form-input cls-form-select">
            <option value="">Alege capitolul…</option>
            ${BM.CATEGORIES.map(c => `<option value="${c.id}" ${ae.categoryId === c.id ? 'selected' : ''}>${BM.esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="cls-form-field">
          <label class="cls-form-label">Subcapitol *</label>
          <select id="aeSubcategory" class="cls-form-input cls-form-select" ${!cat ? 'disabled' : ''}>
            <option value="">${cat ? 'Alege subcapitolul…' : 'Alege mai întâi capitolul'}</option>
            ${subs.map(s => `<option value="${s.id}" ${ae.subcategoryId === s.id ? 'selected' : ''}>${BM.esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="cls-form-field">
          <label class="cls-form-label">Dificultate *</label>
          <select id="aeDifficulty" class="cls-form-input cls-form-select">
            <option value="">Alege dificultatea…</option>
            ${DIFFICULTIES.map(d => `<option value="${d.id}" ${ae.difficulty === d.id ? 'selected' : ''}>${d.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Punctaj total exercițiu *</label>
        <input type="number" min="1" id="aePunctajTotal" class="cls-form-input" style="max-width:120px"
               placeholder="ex: 5" value="${BM.esc(ae.punctajTotal || '')}">
        <span class="cls-form-hint">Punctajul oficial al exercițiului — AI-ul va construi baremul să însumeze exact atât.</span>
      </div>`;

    body.querySelector('#aeGrade').onchange       = e => { ae.grade = e.target.value; };
    body.querySelector('#aeDifficulty').onchange  = e => { ae.difficulty = e.target.value; };
    body.querySelector('#aeSubcategory').onchange = e => { ae.subcategoryId = e.target.value; };
    body.querySelector('#aePunctajTotal').oninput = e => { ae.punctajTotal = e.target.value; _aeUpdateMismatchBanner(); _aeUpdateConfirmState(); };
    body.querySelector('#aeCategory').onchange = e => {
      ae.categoryId = e.target.value;
      ae.subcategoryId = '';
      _aeRenderDetalii();
      _aeUpdateGeoVisibility();
    };
    BM.initCustomSelects(body);
    _aeUpdateGeoVisibility();
  }

  /* ---- §2 Desenează figura (Geometrie only) ---- */
  function _aeUpdateGeoVisibility() {
    const isGeo = ae.categoryId === 'geometrie';
    const card  = document.getElementById('aeGeoCard');
    card.style.display = isGeo ? '' : 'none';

    if (isGeo && !aeGeoEditor) {
      aeGeoEditor = new GeometryFigureEditor(document.getElementById('aeGeoMount'), {
        initialData: ae.figureData || null,
        onChange: (json) => { ae.figureData = json; }
      });
    } else if (!isGeo && aeGeoEditor) {
      aeGeoEditor.destroy();
      aeGeoEditor = null;
    }

    const icon3 = document.getElementById('aeStep3Icon'), title3 = document.getElementById('aeStep3Title');
    const icon4 = document.getElementById('aeStep4Icon'), title4 = document.getElementById('aeStep4Title');
    icon3.textContent = isGeo ? '3' : '2';
    title3.textContent = 'Fotografie exercițiu';
    icon4.textContent = isGeo ? '4' : '3';
    title4.textContent = 'Analiză AI și barem';
  }

  /* ---- §3 Fotografie ---- */
  function _aeRenderFoto() {
    const body = document.getElementById('aeFotoBody');
    body.innerHTML = `
      <p class="wz-subtitle">Încarcă o fotografie clară a exercițiului (enunț + rezolvare).</p>
      <div class="wz-upload-zone">
        <input type="file" id="aeFileInput" class="wz-file-input" accept="image/jpeg,image/png,image/heic,image/heif">
        <div id="aeUploadInner"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;align-items:center">
        <button class="btn btn--surface btn--sm" id="aeReplacePhoto" style="display:none">Schimbă fotografia</button>
        <button class="btn btn--primary" id="aeAnalyzeBtn">Analizează cu AI →</button>
      </div>
    `;
    _aeRenderUploadInner(body);

    const fi = body.querySelector('#aeFileInput');
    fi.onchange = () => { if (fi.files[0]) _aeLoadFile(body, fi.files[0]); };

    body.querySelector('#aeReplacePhoto').addEventListener('click', () => {
      ae.file = null; ae.previewUrl = ''; ae.imageBase64 = ''; ae.mimeType = '';
      _aeRenderUploadInner(body);
    });
    body.querySelector('#aeAnalyzeBtn').addEventListener('click', _aeAnalyze);
  }

  function _aeRenderUploadInner(body) {
    const inner = body.querySelector('#aeUploadInner');
    inner.innerHTML = ae.previewUrl
      ? `<img src="${ae.previewUrl}" alt="Previzualizare" style="max-width:100%;max-height:320px;border-radius:10px;border:1px solid var(--border);display:block;margin:0 auto">`
      : `<label for="aeFileInput" class="wz-upload-drop" id="aeDropZone">
           <span class="wz-upload-drop__icon">⬆</span>
           <span class="wz-upload-drop__main">Trage fotografia aici sau <u>alege din calculator</u></span>
           <span class="wz-upload-drop__hint">JPG, PNG, HEIC</span>
         </label>`;
    body.querySelector('#aeReplacePhoto').style.display = ae.previewUrl ? '' : 'none';

    const drop = inner.querySelector('#aeDropZone');
    if (drop) {
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background = 'rgba(58,107,173,0.08)'; });
      drop.addEventListener('dragleave', () => { drop.style.background = ''; });
      drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.style.background = '';
        const file = e.dataTransfer.files?.[0];
        if (file) _aeLoadFile(body, file);
      });
    }
  }

  function _aeLoadFile(body, file) {
    ae.file = file;
    ae.mimeType = file.type;
    const reader = new FileReader();
    reader.onload = () => {
      ae.previewUrl  = reader.result;
      ae.imageBase64 = String(reader.result).split(',')[1] || '';
      _aeRenderUploadInner(body);
    };
    reader.readAsDataURL(file);
  }

  // Existing exercises for THIS subcapitol only (per user's request — not the
  // whole pool) so Gemini can flag likely duplicates. Combines the static
  // BM.EXERCISES pool (data.js) with already-saved custom_exercises rows for
  // the same category/subcategory (admin.html doesn't load custom-exercises.js,
  // so those aren't in BM.EXERCISES here — fetched separately).
  async function _aeGetExistingForSubcat() {
    const fromStatic = (BM.EXERCISES || [])
      .filter(e => e.categoryId === ae.categoryId && e.subcategoryId === ae.subcategoryId)
      .map(e => ({ title: e.title, statement: e.statement }));

    let fromCustom = [];
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/custom_exercises?category_id=eq.${encodeURIComponent(ae.categoryId)}&subcategory_id=eq.${encodeURIComponent(ae.subcategoryId)}&select=title,statement`,
        { headers: { apikey: SUPABASE_ANON } }
      );
      if (res.ok) fromCustom = await res.json();
    } catch { /* best-effort — don't block analysis on this */ }

    return [...fromStatic, ...fromCustom];
  }

  async function _aeAnalyze() {
    if (!ae.grade || !ae.categoryId || !ae.subcategoryId || !ae.difficulty || !Number(ae.punctajTotal)) {
      BM.toast('Completează toate câmpurile din Detalii exercițiu.', 'error'); return;
    }
    if (!ae.imageBase64) { BM.toast('Încarcă o fotografie.', 'error'); return; }

    const analyzeBtn = document.getElementById('aeAnalyzeBtn');
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = 'Se analizează…<span class="btn-loading-spin"></span>';

    const cat = BM.getCategoryById(ae.categoryId);
    const sub = BM.getSubcategoryById(ae.categoryId, ae.subcategoryId);

    try {
      const session = window._adminSession || (await window.BMAuth.supabase.auth.getSession()).data.session;
      const existingExercises = await _aeGetExistingForSubcat();
      const res = await fetch('/api/admin/generate-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: session?.access_token,
          imageBase64: ae.imageBase64,
          mimeType: ae.mimeType,
          existingExercises,
          context: {
            grade: ae.grade,
            categoryId: ae.categoryId, categoryName: cat?.name || ae.categoryId,
            subcategoryId: ae.subcategoryId, subcategoryName: sub?.name || ae.subcategoryId,
            difficulty: ae.difficulty,
            punctajTotal: Number(ae.punctajTotal) || undefined
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Eroare AI');

      ae.aiResult = Object.assign(
        { titlu: '', enunt_katex: '', raspuns_final: '', punctaj_total: 0, pasi_barem: [], verificare_numerica: '', verificat: null, metode_alternative: [], duplicat: null },
        data,
        { punctaj_total: Number(ae.punctajTotal) || data.punctaj_total }
      );
      _aeRenderAnalysis();
      document.getElementById('aeAnalysisBody').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      BM.toast('Eroare la analiza AI: ' + e.message, 'error');
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analizează cu AI →';
    }
  }

  /* ---- §4 Analiză AI — editable ---- */
  function _aeRenderAnalysis() {
    const body = document.getElementById('aeAnalysisBody');
    const r = ae.aiResult;
    const alts = r.metode_alternative || [];

    body.innerHTML = `
      <button class="btn btn--surface btn--sm" id="aeRegenerate" style="margin-bottom:16px">🔄 Regenerează</button>

      <div id="aeMismatchBanner"></div>

      ${r.duplicat?.este_duplicat ? `
      <div style="padding:12px 14px;border:1px solid #f59e0b;border-radius:10px;background:rgba(245,158,11,0.08);color:#f59e0b;margin-bottom:16px;font-size:0.88rem">
        ⚠️ Posibil duplicat al exercițiului „${BM.esc(r.duplicat.titlu_similar || '')}". Verifică înainte de a confirma.
      </div>` : ''}

      ${r.verificat === false ? `
      <div style="padding:12px 14px;border:1px solid #ef4444;border-radius:10px;background:rgba(239,68,68,0.08);color:#ef4444;margin-bottom:16px;font-size:0.88rem">
        ⚠️ AI-ul nu și-a putut confirma singur răspunsul final la verificare — recalculează manual înainte de a confirma.
      </div>` : ''}

      <div class="cls-form-field">
        <label class="cls-form-label">Titlu</label>
        <input type="text" id="aeTitlu" class="cls-form-input" value="${BM.esc(r.titlu || '')}">
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Enunț (LaTeX)</label>
        <textarea id="aeEnunt" class="cls-form-input" rows="4" style="font-family:monospace;font-size:0.85rem">${BM.esc(r.enunt_katex || '')}</textarea>
        <div class="ae-preview-box" id="aeEnuntPreview" style="margin-top:8px"></div>
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Barem</label>
        <div id="aeBaremRows"></div>
        <button class="btn btn--surface btn--sm" id="aeAddBaremStep" style="margin-top:8px">+ Adaugă pas</button>
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Răspuns final (LaTeX, fără $ )</label>
        <input type="text" id="aeRaspunsFinal" class="cls-form-input" value="${BM.esc(r.raspuns_final || '')}">
        ${r.verificare_numerica ? `<span class="cls-form-hint">🔍 Verificare AI: ${BM.esc(r.verificare_numerica)}</span>` : ''}
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Metode alternative</label>
        <div id="aeAltRows"></div>
        <button class="btn btn--surface btn--sm" id="aeAddAltMethod" style="margin-top:8px">+ Adaugă metodă</button>
      </div>
    `;

    body.querySelector('#aeTitlu').oninput = e => { r.titlu = e.target.value; };
    const enuntEl = body.querySelector('#aeEnunt');
    enuntEl.oninput = _aeDebounce(() => { r.enunt_katex = enuntEl.value; _aeRenderEnuntPreview(); }, 300);
    body.querySelector('#aeRaspunsFinal').oninput = e => { r.raspuns_final = e.target.value; };
    body.querySelector('#aeAddBaremStep').addEventListener('click', () => {
      r.pasi_barem.push({ nr: r.pasi_barem.length + 1, descriere: '', puncte_maxime: 0 });
      _aeRenderBaremRows();
    });
    body.querySelector('#aeAddAltMethod').addEventListener('click', () => {
      r.metode_alternative.push({ nume: '', descriere: '' });
      _aeRenderAltRows();
    });
    body.querySelector('#aeRegenerate').addEventListener('click', async () => {
      if (!confirm('Regenerezi cu AI? Rezultatul curent (inclusiv editările tale) se pierde.')) return;
      await _aeAnalyze();
    });

    _aeRenderEnuntPreview();
    _aeRenderBaremRows();
    _aeRenderAltRows();
    _aeUpdateConfirmState();
  }

  function _aeDebounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function _aeRenderEnuntPreview() {
    const el = document.getElementById('aeEnuntPreview');
    if (!el) return;
    el.innerHTML = BM.trustedNl2br(ae.aiResult.enunt_katex || '');
    BM.renderMath(el);
  }

  function _aeRenderBaremRows() {
    const wrap = document.getElementById('aeBaremRows');
    const pasi = ae.aiResult.pasi_barem || [];
    wrap.innerHTML = pasi.map((p, i) => `
      <div class="ae-barem-row" data-idx="${i}">
        <span class="ae-barem-row__nr">${p.nr || i + 1}.</span>
        <textarea class="cls-form-input ae-barem-row__desc" rows="2" data-field="descriere" style="font-family:monospace;font-size:0.85rem">${BM.esc(p.descriere || '')}</textarea>
        <input type="number" min="0" class="cls-form-input ae-barem-row__pts" data-field="puncte_maxime" value="${Number(p.puncte_maxime) || 0}">
        <button class="btn btn--danger-outline btn--sm ae-barem-row__del" title="Șterge pasul">✕</button>
      </div>
    `).join('') || '<p class="cls-form-hint">Niciun pas — apasă „+ Adaugă pas”.</p>';

    wrap.querySelectorAll('.ae-barem-row').forEach(row => {
      const idx = Number(row.dataset.idx);
      row.querySelector('[data-field="descriere"]').oninput = e => { pasi[idx].descriere = e.target.value; };
      row.querySelector('[data-field="puncte_maxime"]').oninput = e => {
        pasi[idx].puncte_maxime = Number(e.target.value) || 0;
        _aeUpdateMismatchBanner();
        _aeUpdateConfirmState();
      };
      row.querySelector('.ae-barem-row__del').addEventListener('click', () => {
        pasi.splice(idx, 1);
        pasi.forEach((p, i) => { p.nr = i + 1; });
        _aeRenderBaremRows();
        _aeUpdateMismatchBanner();
        _aeUpdateConfirmState();
      });
    });
    _aeUpdateMismatchBanner();
  }

  function _aeRenderAltRows() {
    const wrap = document.getElementById('aeAltRows');
    const alts = ae.aiResult.metode_alternative || [];
    wrap.innerHTML = alts.map((m, i) => `
      <div class="ae-alt-row" data-idx="${i}">
        <input type="text" class="cls-form-input ae-alt-row__nume" data-field="nume" placeholder="Nume metodă" value="${BM.esc(m.nume || '')}">
        <textarea class="cls-form-input ae-alt-row__desc" rows="2" data-field="descriere" style="font-family:monospace;font-size:0.85rem" placeholder="Descriere">${BM.esc(m.descriere || '')}</textarea>
        <button class="btn btn--danger-outline btn--sm ae-alt-row__del" title="Șterge metoda">✕</button>
      </div>
    `).join('') || '<p class="cls-form-hint">Nicio metodă alternativă.</p>';

    wrap.querySelectorAll('.ae-alt-row').forEach(row => {
      const idx = Number(row.dataset.idx);
      row.querySelector('[data-field="nume"]').oninput = e => { alts[idx].nume = e.target.value; };
      row.querySelector('[data-field="descriere"]').oninput = e => { alts[idx].descriere = e.target.value; };
      row.querySelector('.ae-alt-row__del').addEventListener('click', () => {
        alts.splice(idx, 1);
        _aeRenderAltRows();
      });
    });
  }

  function _aeBaremSum() {
    return (ae.aiResult?.pasi_barem || []).reduce((s, p) => s + (Number(p.puncte_maxime) || 0), 0);
  }

  function _aeUpdateMismatchBanner() {
    const el = document.getElementById('aeMismatchBanner');
    if (!el) return;
    if (!ae.aiResult) { el.innerHTML = ''; return; }
    const sum = _aeBaremSum();
    const mismatch = ae.punctajTotal && sum !== Number(ae.punctajTotal);
    el.innerHTML = mismatch ? `
      <div style="padding:12px 14px;border:1px solid #ef4444;border-radius:10px;background:rgba(239,68,68,0.08);color:#ef4444;margin-bottom:16px;font-size:0.88rem">
        ⚠️ Suma pașilor din barem (${sum}) nu corespunde cu punctajul declarat (${ae.punctajTotal}p).
      </div>` : '';
  }

  function _aeUpdateConfirmState() {
    const btn = document.getElementById('aeConfirmBtn');
    if (!btn) return;
    const r = ae.aiResult;
    const valid = !!(r && r.titlu && r.enunt_katex && r.pasi_barem && r.pasi_barem.length &&
      (!ae.punctajTotal || _aeBaremSum() === Number(ae.punctajTotal)));
    // Hidden (not just disabled) until there's an actual barem to confirm —
    // a disabled-but-visible button read as "broken" rather than "not yet".
    btn.style.display = valid ? '' : 'none';
  }

  /* ---- Save ---- */
  async function _aeSave() {
    const r = ae.aiResult;
    if (!r || !r.titlu || !r.enunt_katex || !r.pasi_barem.length) {
      BM.toast('Completează titlul, enunțul și cel puțin un pas de barem.', 'error'); return;
    }

    const baremSum = _aeBaremSum();
    if (ae.punctajTotal && baremSum !== Number(ae.punctajTotal)) {
      BM.toast(`Suma pașilor (${baremSum}) nu corespunde cu punctajul declarat (${ae.punctajTotal}). Corectează baremul.`, 'error');
      return;
    }

    const cat = BM.getCategoryById(ae.categoryId);
    const barem = r.pasi_barem.map(p => ({
      descriere: p.descriere,
      puncte_maxime: Number(p.puncte_maxime) || 0
    }));

    const solutionParts = r.pasi_barem.map(p => `**Pasul ${p.nr}.** ${p.descriere}`);
    if (r.raspuns_final) solutionParts.push(`$$\\boxed{${_stripMathDelims(r.raspuns_final)}}$$`);
    if (r.metode_alternative.length) {
      solutionParts.push('**Metode alternative:**');
      r.metode_alternative.forEach(m => solutionParts.push(`**${m.nume}.** ${m.descriere}`));
    }

    const isGeo = ae.categoryId === 'geometrie';
    if (isGeo && aeGeoEditor) {
      ae.figureSvg = await aeGeoEditor.exportFigureSvg();
      // exportFigureSvg() resolves '' for a canvas with nothing drawn on
      // it — geometry exercises don't all need a figure — so drop the
      // equally-empty figureData too rather than saving a meaningless
      // empty-objects JSON blob alongside a figure_svg that's null anyway.
      if (!ae.figureSvg) ae.figureData = null;
    }

    const row = {
      grade: ae.grade,
      category_id: ae.categoryId,
      subcategory_id: ae.subcategoryId,
      difficulty: ae.difficulty,
      punctaj_total: Number(ae.punctajTotal) || baremSum,
      source: `${GRADE_LABEL[ae.grade] || ae.grade} — ${cat?.name || ae.categoryId}`,
      title: r.titlu,
      statement: r.enunt_katex,
      solution: solutionParts.join('\n\n'),
      barem,
      barem_estimat: true,
      ai_raw: r,
      figure_data: isGeo ? (ae.figureData || null) : null,
      figure_svg:  isGeo ? (ae.figureSvg  || null) : null
    };

    const btn = document.getElementById('aeConfirmBtn');
    btn.disabled = true;
    try {
      const session = window._adminSession || (await window.BMAuth.supabase.auth.getSession()).data.session;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/custom_exercises`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(row)
      });
      if (!res.ok) throw new Error(await res.text());

      BM.toast('Exercițiu adăugat cu succes! Este acum disponibil pentru toți utilizatorii.', 'success');
      _aeResetAfterSave();
    } catch (e) {
      BM.toast('Eroare la salvare: ' + e.message, 'error');
      btn.disabled = false;
    }
  }

  function _aeResetAfterSave() {
    ae.file = null; ae.previewUrl = ''; ae.imageBase64 = ''; ae.mimeType = '';
    ae.aiResult = null;
    ae.figureData = null; ae.figureSvg = null;
    _aeRenderFoto();
    document.getElementById('aeAnalysisBody').innerHTML = '<p class="cls-form-hint">Analizează o fotografie mai sus pentru a vedea rezultatul aici.</p>';
    document.getElementById('aeConfirmBtn').style.display = 'none';
    if (aeGeoEditor) { aeGeoEditor.destroy(); aeGeoEditor = null; }
    _aeUpdateGeoVisibility(); // remounts a fresh, empty editor if still on Geometrie
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
})();
