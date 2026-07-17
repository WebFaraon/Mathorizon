
/* ============================================================
   Mathorizon — Admin "Add Exercise" wizard (admin.html)
   Photo → Gemini transcription → editable review → publish as
   a global custom_exercises row, merged client-side via
   js/custom-exercises.js into BM.EXERCISES for every user.
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

  let ae = null;

  // Gemini sometimes wraps raspuns_final in its own $...$/$$...$$ even though
  // the prompt asks for bare LaTeX — strip it so we can safely nest it inside
  // our own $$\boxed{...}$$ without producing unparseable nested delimiters.
  function _stripMathDelims(s) {
    return String(s || '').trim().replace(/^\$\$?(.*?)\$\$?$/s, '$1').trim();
  }

  function _blankAiResult() {
    return { titlu: '', enunt_katex: '', raspuns_final: '', punctaj_total: 0, pasi_barem: [], verificare_numerica: '', verificat: null, metode_alternative: [], duplicat: null };
  }

  function openAddExerciseModal() {
    ae = {
      step: 1,
      grade: '', categoryId: '', subcategoryId: '', difficulty: '', punctajTotal: '',
      file: null, mimeType: '', imageBase64: '', previewUrl: '',
      aiResult: null
    };
    _aeShowModal();
  }
  window.openAddExerciseModal = openAddExerciseModal;

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openAddExerciseBtn')?.addEventListener('click', openAddExerciseModal);
  });

  /* Custom select — shared implementation moved to BM.makeCustomSelect /
     BM.initCustomSelects (js/utils.js) so class-page.js's Simulări exercise
     picker can reuse the same dropdown instead of duplicating it. */
  function _aeInitCustomSelects(body) {
    BM.initCustomSelects(body);
  }

  /* ---- Modal shell ---- */
  function _aeShowModal() {
    const modal = document.createElement('div');
    modal.id = 'aeWizard';
    modal.className = 'wz-overlay';
    modal.innerHTML = `
      <div class="wz-backdrop" id="aeBackdrop"></div>
      <div class="wz-dialog av-dialog" role="dialog">
        <div class="wz-head">
          <span class="wz-head__title">Exercițiu Nou</span>
          <div class="wz-steps" id="aeSteps"></div>
          <button class="icon-btn" id="aeCloseBtn">✕</button>
        </div>
        <div class="wz-body av-body" id="aeBody"></div>
        <div class="wz-foot">
          <button class="btn btn--surface" id="aeBackBtn">← Înapoi</button>
          <button class="btn btn--primary"  id="aeNextBtn">Continuă →</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    // Deliberately NOT wired to close on backdrop click — a stray click
    // outside the dialog must not discard an in-progress exercise (a Gemini
    // call may already have been spent on it). Only the explicit ✕ button
    // (or a successful save) closes the wizard.
    modal.querySelector('#aeCloseBtn').onclick  = _aeClose;
    modal.querySelector('#aeBackBtn').onclick   = _aeBack;
    modal.querySelector('#aeNextBtn').onclick   = _aeNext;

    _aeRender();
  }

  function _aeClose() {
    document.getElementById('aeWizard')?.remove();
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    ae = null;
  }

  /* ---- Render ---- */
  function _aeRender() {
    const body    = document.getElementById('aeBody');
    const steps   = document.getElementById('aeSteps');
    const backBtn = document.getElementById('aeBackBtn');
    const nextBtn = document.getElementById('aeNextBtn');
    if (!body || !steps || !backBtn || !nextBtn) return;

    const labels = ['Detalii', 'Fotografie', 'Verificare'];
    steps.innerHTML = labels.map((l, i) => `
      <div class="wz-step-item">
        <div class="wz-step-dot${i + 1 < ae.step ? ' wz-step-dot--done' : ''}${i + 1 === ae.step ? ' wz-step-dot--active' : ''}">
          ${i + 1 < ae.step ? '✓' : i + 1}
        </div>
        <span class="wz-step-label">${l}</span>
      </div>
      ${i < 2 ? '<div class="wz-step-line"></div>' : ''}
    `).join('');

    backBtn.style.visibility = ae.step === 1 ? 'hidden' : '';
    backBtn.disabled = false;
    nextBtn.textContent =
      ae.step === 2 ? 'Analizează cu AI →' :
      ae.step === 3 ? 'Confirmă și adaugă'  : 'Continuă →';
    nextBtn.disabled = false;

    if (ae.step === 1) { body.innerHTML = _aeStep1(); _aeBindStep1(body); }
    if (ae.step === 2) { body.innerHTML = _aeStep2(); _aeBindStep2(body); }
    if (ae.step === 3) {
      body.innerHTML = _aeStep3(); _aeBindStep3(body);
      const r = ae.aiResult;
      const baremSum = (r.pasi_barem || []).reduce((s, p) => s + (Number(p.puncte_maxime) || 0), 0);
      nextBtn.disabled = !!(ae.punctajTotal && baremSum !== Number(ae.punctajTotal));
    }
  }

  /* ---- Step 1 — Detalii ---- */
  function _aeStep1() {
    const cat = BM.getCategoryById(ae.categoryId);
    const subs = cat ? cat.subcategories : [];
    return `
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
      <div class="cls-form-field">
        <label class="cls-form-label">Punctaj total exercițiu *</label>
        <input type="number" min="1" id="aePunctajTotalStep1" class="cls-form-input" style="max-width:120px"
               placeholder="ex: 5" value="${BM.esc(ae.punctajTotal || '')}">
        <span class="cls-form-hint">Punctajul oficial al exercițiului — AI-ul va construi baremul să însumeze exact atât.</span>
      </div>`;
  }

  function _aeBindStep1(body) {
    body.querySelector('#aeGrade').onchange              = e => { ae.grade = e.target.value; };
    body.querySelector('#aeDifficulty').onchange         = e => { ae.difficulty = e.target.value; };
    body.querySelector('#aeSubcategory').onchange        = e => { ae.subcategoryId = e.target.value; };
    body.querySelector('#aePunctajTotalStep1').oninput   = e => { ae.punctajTotal = e.target.value; };
    body.querySelector('#aeCategory').onchange = e => {
      ae.categoryId = e.target.value;
      ae.subcategoryId = '';
      body.innerHTML = _aeStep1();
      _aeBindStep1(body);
    };
    _aeInitCustomSelects(body);
  }

  /* ---- Step 2 — Fotografie ---- */
  function _aeStep2() {
    return `
      <p class="wz-subtitle">Încarcă o fotografie clară a exercițiului (enunț + rezolvare).</p>
      <div class="wz-upload-zone">
        <input type="file" id="aeFileInput" class="wz-file-input" accept="image/jpeg,image/png,image/heic,image/heif">
        ${ae.previewUrl
          ? `<img src="${ae.previewUrl}" alt="Previzualizare" style="max-width:100%;max-height:320px;border-radius:10px;border:1px solid var(--border);display:block;margin:0 auto">`
          : `<label for="aeFileInput" class="wz-upload-drop" id="aeDropZone">
               <span class="wz-upload-drop__icon">⬆</span>
               <span class="wz-upload-drop__main">Trage fotografia aici sau <u>alege din calculator</u></span>
               <span class="wz-upload-drop__hint">JPG, PNG, HEIC</span>
             </label>`}
      </div>
      ${ae.previewUrl ? `<button class="btn btn--surface btn--sm" id="aeReplacePhoto" style="margin-top:12px">Schimbă fotografia</button>` : ''}
    `;
  }

  function _aeBindStep2(body) {
    const fi = body.querySelector('#aeFileInput');
    fi.onchange = () => { if (fi.files[0]) _aeLoadFile(fi.files[0]); };

    const drop = body.querySelector('#aeDropZone');
    if (drop) {
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background = 'rgba(58,107,173,0.08)'; });
      drop.addEventListener('dragleave', () => { drop.style.background = ''; });
      drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.style.background = '';
        const file = e.dataTransfer.files?.[0];
        if (file) _aeLoadFile(file);
      });
    }

    body.querySelector('#aeReplacePhoto')?.addEventListener('click', () => {
      ae.file = null; ae.previewUrl = ''; ae.imageBase64 = ''; ae.mimeType = '';
      _aeRender();
    });
  }

  function _aeLoadFile(file) {
    ae.file = file;
    ae.mimeType = file.type;
    const reader = new FileReader();
    reader.onload = () => {
      ae.previewUrl   = reader.result;
      ae.imageBase64  = String(reader.result).split(',')[1] || '';
      _aeRender();
    };
    reader.readAsDataURL(file);
  }

  /* ---- Step 3 — Verificare (preview read-only, generat de AI) ---- */
  function _aeStep3() {
    const r = ae.aiResult;
    const baremSum = (r.pasi_barem || []).reduce((s, p) => s + (Number(p.puncte_maxime) || 0), 0);
    const mismatch = ae.punctajTotal && baremSum !== Number(ae.punctajTotal);
    const alts = r.metode_alternative || [];
    return `
      <button class="btn btn--surface btn--sm" id="aeRegenerate" style="margin-bottom:16px">🔄 Regenerează</button>

      ${mismatch ? `
      <div style="padding:12px 14px;border:1px solid #ef4444;border-radius:10px;background:rgba(239,68,68,0.08);color:#ef4444;margin-bottom:16px;font-size:0.88rem">
        ⚠️ Suma pașilor din barem (${baremSum}) nu corespunde cu punctajul declarat (${ae.punctajTotal}p). Apasă „Regenerează" — nu se poate confirma cu punctaje diferite.
      </div>` : ''}

      ${r.duplicat?.este_duplicat ? `
      <div style="padding:12px 14px;border:1px solid #f59e0b;border-radius:10px;background:rgba(245,158,11,0.08);color:#f59e0b;margin-bottom:16px;font-size:0.88rem">
        ⚠️ Posibil duplicat al exercițiului „${BM.esc(r.duplicat.titlu_similar || '')}". Verifică înainte de a confirma.
      </div>` : ''}

      ${r.verificat === false ? `
      <div style="padding:12px 14px;border:1px solid #ef4444;border-radius:10px;background:rgba(239,68,68,0.08);color:#ef4444;margin-bottom:16px;font-size:0.88rem">
        ⚠️ AI-ul nu și-a putut confirma singur răspunsul final la verificare — recalculează manual înainte de a confirma.
      </div>` : ''}

      <h3 style="font-size:1.1rem;font-weight:700;color:var(--text);margin-bottom:14px">${BM.esc(r.titlu || '(fără titlu)')}</h3>

      <div class="cls-form-field">
        <label class="cls-form-label">Enunț</label>
        <div id="aeEnuntPreview" class="ae-preview-box"></div>
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Barem (${baremSum} puncte)</label>
        ${_aeBaremStepsHtml(r.pasi_barem || [])}
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Răspuns final</label>
        <div id="aeRaspunsPreview" class="ae-preview-box"></div>
        ${r.verificare_numerica ? `<span class="cls-form-hint">🔍 Verificare AI: ${BM.esc(r.verificare_numerica)}</span>` : ''}
      </div>

      ${alts.length ? `
      <div class="cls-form-field">
        <label class="cls-form-label">Metode alternative</label>
        ${_aeAltMethodsHtml(alts)}
      </div>` : ''}
    `;
  }

  function _aeBaremStepsHtml(pasi) {
    return pasi.map((p, i) => `
      <div class="ae-pas-view" style="margin-bottom:10px;padding:12px 14px;border:1px solid var(--border);border-radius:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong style="color:var(--accent)">Pasul ${p.nr || i + 1}</strong>
          <span style="background:var(--accent-dim);color:var(--accent);padding:2px 10px;border-radius:20px;font-size:0.78rem;font-weight:700">${Number(p.puncte_maxime) || 0}p</span>
        </div>
        <div class="ae-pas-preview" data-idx="${i}"></div>
      </div>`).join('');
  }

  function _aeAltMethodsHtml(alts) {
    return alts.map((m, i) => `
      <div style="margin-bottom:10px;padding:12px 14px;border:1px solid var(--border);border-radius:10px">
        <strong style="color:var(--text)">${BM.esc(m.nume || '')}</strong>
        <div class="ae-alt-preview" data-idx="${i}" style="margin-top:6px"></div>
      </div>`).join('');
  }

  function _aeBindStep3(body) {
    const r = ae.aiResult;

    const enuntEl = body.querySelector('#aeEnuntPreview');
    enuntEl.innerHTML = BM.trustedNl2br(r.enunt_katex || '');
    BM.renderMath(enuntEl);

    const raspunsEl = body.querySelector('#aeRaspunsPreview');
    raspunsEl.innerHTML = r.raspuns_final ? BM.trustedNl2br(`$$${_stripMathDelims(r.raspuns_final)}$$`) : '';
    BM.renderMath(raspunsEl);

    body.querySelectorAll('.ae-pas-preview').forEach(el => {
      const p = (r.pasi_barem || [])[Number(el.dataset.idx)];
      el.innerHTML = BM.trustedNl2br(p?.descriere || '');
      BM.renderMath(el);
    });

    body.querySelectorAll('.ae-alt-preview').forEach(el => {
      const m = (r.metode_alternative || [])[Number(el.dataset.idx)];
      el.innerHTML = BM.trustedNl2br(m?.descriere || '');
      BM.renderMath(el);
    });

    body.querySelector('#aeRegenerate').addEventListener('click', async () => {
      if (!confirm('Regenerezi cu AI? Rezultatul curent se pierde.')) return;
      await _aeAnalyze();
    });
  }

  /* ---- Navigation ---- */
  function _aeBack() {
    if (ae.step > 1) { ae.step--; _aeRender(); }
  }

  async function _aeNext() {
    if (ae.step === 1) {
      if (!ae.grade || !ae.categoryId || !ae.subcategoryId || !ae.difficulty || !Number(ae.punctajTotal)) {
        BM.toast('Completează toate câmpurile.', 'error'); return;
      }
      ae.step = 2; _aeRender(); return;
    }
    if (ae.step === 2) {
      if (!ae.imageBase64) { BM.toast('Încarcă o fotografie.', 'error'); return; }
      await _aeAnalyze();
      return;
    }
    if (ae.step === 3) {
      await _aeSave();
    }
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
    const body = document.getElementById('aeBody');
    const nextBtn = document.getElementById('aeNextBtn');
    const backBtn = document.getElementById('aeBackBtn');
    nextBtn.disabled = true;
    if (backBtn) backBtn.disabled = true;
    body.innerHTML = `
      <div class="classes-loading">
        <div class="classes-spinner"></div>
        <p>AI-ul analizează exercițiul…</p>
      </div>`;

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

      ae.aiResult = Object.assign(_blankAiResult(), data, { punctaj_total: Number(ae.punctajTotal) || data.punctaj_total });
      ae.step = 3;
      _aeRender();
    } catch (e) {
      BM.toast('Eroare la analiza AI: ' + e.message, 'error');
      ae.step = 2;
      _aeRender();
    }
  }

  async function _aeSave() {
    const r = ae.aiResult;
    if (!r.titlu || !r.enunt_katex || !r.pasi_barem.length) {
      BM.toast('Rezultatul AI e incomplet — apasă Regenerează.', 'error'); return;
    }

    const baremSum = r.pasi_barem.reduce((s, p) => s + (Number(p.puncte_maxime) || 0), 0);
    if (ae.punctajTotal && baremSum !== Number(ae.punctajTotal)) {
      BM.toast(`Suma pașilor (${baremSum}) nu corespunde cu punctajul declarat (${ae.punctajTotal}). Apasă Regenerează.`, 'error');
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
      ai_raw: r
    };

    const nextBtn = document.getElementById('aeNextBtn');
    nextBtn.disabled = true;
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
      nextBtn.disabled = false;
    }
  }

  function _aeResetAfterSave() {
    ae.file = null; ae.previewUrl = ''; ae.imageBase64 = ''; ae.mimeType = '';
    ae.aiResult = null;
    ae.step = 2;
    _aeRender();
  }
})();
