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
    { id: 'usor',    label: 'Ușor' },
    { id: 'mediu',   label: 'Mediu' },
    { id: 'dificil', label: 'Dificil' }
  ];
  const GRADE_LABEL = { '9': 'Clasa a 9-a', bac: 'BAC' };

  let ae = null;

  function _blankAiResult() {
    return { titlu: '', enunt_katex: '', raspuns_final: '', punctaj_total: 0, pasi_barem: [], metode_alternative: [] };
  }

  function openAddExerciseModal() {
    ae = {
      step: 1,
      grade: '', categoryId: '', subcategoryId: '', difficulty: '',
      file: null, mimeType: '', imageBase64: '', previewUrl: '',
      aiResult: null
    };
    _aeShowModal();
  }
  window.openAddExerciseModal = openAddExerciseModal;

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openAddExerciseBtn')?.addEventListener('click', openAddExerciseModal);
  });

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

    modal.querySelector('#aeBackdrop').onclick = _aeClose;
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
    if (ae.step === 3) { body.innerHTML = _aeStep3(); _aeBindStep3(body); }
  }

  /* ---- Step 1 — Detalii ---- */
  function _aeStep1() {
    const cat = BM.getCategoryById(ae.categoryId);
    const subs = cat ? cat.subcategories : [];
    return `
      <div class="cls-form-field">
        <label class="cls-form-label">Clasă *</label>
        <select id="aeGrade" class="cls-form-input">
          <option value="">Alege clasa…</option>
          ${GRADES.map(g => `<option value="${g.id}" ${ae.grade === g.id ? 'selected' : ''}>${g.label}</option>`).join('')}
        </select>
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Capitol *</label>
        <select id="aeCategory" class="cls-form-input">
          <option value="">Alege capitolul…</option>
          ${BM.CATEGORIES.map(c => `<option value="${c.id}" ${ae.categoryId === c.id ? 'selected' : ''}>${BM.esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Subcapitol *</label>
        <select id="aeSubcategory" class="cls-form-input" ${!cat ? 'disabled' : ''}>
          <option value="">${cat ? 'Alege subcapitolul…' : 'Alege mai întâi capitolul'}</option>
          ${subs.map(s => `<option value="${s.id}" ${ae.subcategoryId === s.id ? 'selected' : ''}>${BM.esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Dificultate *</label>
        <select id="aeDifficulty" class="cls-form-input">
          <option value="">Alege dificultatea…</option>
          ${DIFFICULTIES.map(d => `<option value="${d.id}" ${ae.difficulty === d.id ? 'selected' : ''}>${d.label}</option>`).join('')}
        </select>
      </div>`;
  }

  function _aeBindStep1(body) {
    body.querySelector('#aeGrade').onchange       = e => { ae.grade = e.target.value; };
    body.querySelector('#aeDifficulty').onchange  = e => { ae.difficulty = e.target.value; };
    body.querySelector('#aeSubcategory').onchange = e => { ae.subcategoryId = e.target.value; };
    body.querySelector('#aeCategory').onchange = e => {
      ae.categoryId = e.target.value;
      ae.subcategoryId = '';
      body.innerHTML = _aeStep1();
      _aeBindStep1(body);
    };
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

  /* ---- Step 3 — Verificare ---- */
  function _aeStep3() {
    const r = ae.aiResult;
    const total = (r.pasi_barem || []).reduce((s, p) => s + (Number(p.puncte_maxime) || 0), 0);
    return `
      <button class="btn btn--surface btn--sm" id="aeRegenerate" style="margin-bottom:16px">🔄 Regenerează</button>

      <div class="cls-form-field">
        <label class="cls-form-label">Titlu</label>
        <input type="text" id="aeTitlu" class="cls-form-input" value="${BM.esc(r.titlu || '')}">
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Enunț (previzualizare)</label>
        <div id="aeEnuntPreview" style="padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface)"></div>
        <textarea id="aeEnuntKatex" class="cls-form-input cls-form-textarea" rows="3" style="margin-top:8px">${BM.esc(r.enunt_katex || '')}</textarea>
        <span class="cls-form-hint">Editează textul de mai sus — folosește $...$ / $$...$$ pentru formule.</span>
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Răspuns final</label>
        <input type="text" id="aeRaspunsFinal" class="cls-form-input" value="${BM.esc(r.raspuns_final || '')}">
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Punctaj total exercițiu *</label>
        <input type="number" min="1" id="aePunctajTotal" class="cls-form-input" style="max-width:120px" value="${Number(r.punctaj_total) || total || ''}">
        <span class="cls-form-hint">Corectează aici dacă AI-ul a ghicit greșit punctajul oficial al exercițiului.</span>
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Barem — suma pașilor: <span id="aeBaremTotal">${total}</span></label>
        <div id="aeBaremRows">${_aeBaremRowsHtml(r.pasi_barem || [])}</div>
        <button class="btn btn--surface btn--sm" id="aeAddPas" style="margin-top:8px">+ Adaugă pas</button>
      </div>

      <div class="cls-form-field">
        <label class="cls-form-label">Metode alternative</label>
        <div id="aeAltRows">${_aeAltRowsHtml(r.metode_alternative || [])}</div>
        <button class="btn btn--surface btn--sm" id="aeAddAlt" style="margin-top:8px">+ Adaugă metodă</button>
      </div>
    `;
  }

  function _aeBaremRowsHtml(pasi) {
    if (!pasi.length) return '<p class="cls-form-hint">Niciun pas — adaugă unul mai jos.</p>';
    return pasi.map((p, i) => `
      <div class="ae-barem-row" data-idx="${i}" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;padding:12px;border:1px solid var(--border);border-radius:10px">
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <textarea class="cls-form-input cls-form-textarea ae-pas-descriere" rows="2" placeholder="Descriere pas">${BM.esc(p.descriere || '')}</textarea>
          <textarea class="cls-form-input cls-form-textarea ae-pas-operatie" rows="2" placeholder="Calcul (LaTeX)">${BM.esc(p.operatie_katex || '')}</textarea>
          <div class="ae-pas-preview" style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);font-size:0.88rem"></div>
        </div>
        <input type="number" min="0" class="cls-form-input ae-pas-puncte" value="${Number(p.puncte_maxime) || 0}" style="width:70px">
        <button class="icon-btn ae-pas-remove" title="Șterge pasul">✕</button>
      </div>`).join('');
  }

  function _aeAltRowsHtml(alts) {
    if (!alts.length) return '<p class="cls-form-hint">Nicio metodă alternativă.</p>';
    return alts.map((m, i) => `
      <div class="ae-alt-row" data-idx="${i}" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;padding:12px;border:1px solid var(--border);border-radius:10px">
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <input type="text" class="cls-form-input ae-alt-nume" placeholder="Nume metodă" value="${BM.esc(m.nume || '')}">
          <textarea class="cls-form-input cls-form-textarea ae-alt-descriere" rows="2" placeholder="Descriere">${BM.esc(m.descriere || '')}</textarea>
        </div>
        <button class="icon-btn ae-alt-remove" title="Șterge metoda">✕</button>
      </div>`).join('');
  }

  function _aeBindStep3(body) {
    const previewEl = body.querySelector('#aeEnuntPreview');
    const renderPreview = () => {
      const txt = body.querySelector('#aeEnuntKatex').value;
      previewEl.innerHTML = BM.trustedNl2br(txt);
      BM.renderMath(previewEl);
    };
    renderPreview();
    body.querySelector('#aeEnuntKatex').addEventListener('input', renderPreview);

    const renderPasPreview = row => {
      const descriere = row.querySelector('.ae-pas-descriere').value;
      const operatie   = row.querySelector('.ae-pas-operatie').value;
      const previewEl  = row.querySelector('.ae-pas-preview');
      previewEl.innerHTML = BM.trustedNl2br(descriere + (operatie ? '<br>$$' + operatie + '$$' : ''));
      BM.renderMath(previewEl);
    };
    body.querySelectorAll('.ae-barem-row').forEach(row => {
      renderPasPreview(row);
      row.querySelector('.ae-pas-descriere').addEventListener('input', () => renderPasPreview(row));
      row.querySelector('.ae-pas-operatie').addEventListener('input', () => renderPasPreview(row));
    });

    const recomputeTotal = () => {
      const total  = Array.from(body.querySelectorAll('.ae-pas-puncte')).reduce((s, el) => s + (Number(el.value) || 0), 0);
      const target = Number(body.querySelector('#aePunctajTotal')?.value) || 0;
      const totalEl = body.querySelector('#aeBaremTotal');
      totalEl.textContent = total;
      totalEl.style.color = (target && total !== target) ? '#ef4444' : '#16a34a';
      totalEl.style.fontWeight = '700';
    };
    body.querySelectorAll('.ae-pas-puncte').forEach(el => el.addEventListener('input', recomputeTotal));
    body.querySelector('#aePunctajTotal').addEventListener('input', recomputeTotal);
    recomputeTotal();

    body.querySelectorAll('.ae-pas-remove').forEach(btn => btn.addEventListener('click', () => {
      _aeCollectReview(body);
      const idx = Number(btn.closest('.ae-barem-row').dataset.idx);
      ae.aiResult.pasi_barem.splice(idx, 1);
      _aeRender();
    }));

    body.querySelector('#aeAddPas').addEventListener('click', () => {
      _aeCollectReview(body);
      ae.aiResult.pasi_barem.push({ nr: ae.aiResult.pasi_barem.length + 1, descriere: '', operatie_katex: '', puncte_maxime: 0 });
      _aeRender();
    });

    body.querySelectorAll('.ae-alt-remove').forEach(btn => btn.addEventListener('click', () => {
      _aeCollectReview(body);
      const idx = Number(btn.closest('.ae-alt-row').dataset.idx);
      ae.aiResult.metode_alternative.splice(idx, 1);
      _aeRender();
    }));

    body.querySelector('#aeAddAlt').addEventListener('click', () => {
      _aeCollectReview(body);
      ae.aiResult.metode_alternative.push({ nume: '', descriere: '' });
      _aeRender();
    });

    body.querySelector('#aeRegenerate').addEventListener('click', async () => {
      if (!confirm('Regenerezi cu AI? Modificările curente se pierd.')) return;
      await _aeAnalyze();
    });
  }

  function _aeCollectReview(body) {
    if (!ae.aiResult) return;
    ae.aiResult.titlu         = body.querySelector('#aeTitlu')?.value.trim() || '';
    ae.aiResult.enunt_katex   = body.querySelector('#aeEnuntKatex')?.value || '';
    ae.aiResult.raspuns_final = body.querySelector('#aeRaspunsFinal')?.value.trim() || '';
    ae.aiResult.punctaj_total = Number(body.querySelector('#aePunctajTotal')?.value) || 0;
    ae.aiResult.pasi_barem = Array.from(body.querySelectorAll('.ae-barem-row')).map((row, i) => ({
      nr: i + 1,
      descriere:      row.querySelector('.ae-pas-descriere').value,
      operatie_katex: row.querySelector('.ae-pas-operatie').value,
      puncte_maxime:  Number(row.querySelector('.ae-pas-puncte').value) || 0
    }));
    ae.aiResult.metode_alternative = Array.from(body.querySelectorAll('.ae-alt-row')).map(row => ({
      nume:      row.querySelector('.ae-alt-nume').value,
      descriere: row.querySelector('.ae-alt-descriere').value
    }));
  }

  /* ---- Navigation ---- */
  function _aeBack() {
    if (ae.step > 1) { ae.step--; _aeRender(); }
  }

  async function _aeNext() {
    if (ae.step === 1) {
      if (!ae.grade || !ae.categoryId || !ae.subcategoryId || !ae.difficulty) {
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
      const body = document.getElementById('aeBody');
      _aeCollectReview(body);
      await _aeSave();
    }
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
      const res = await fetch('/api/admin/generate-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: session?.access_token,
          imageBase64: ae.imageBase64,
          mimeType: ae.mimeType,
          context: {
            grade: ae.grade,
            categoryId: ae.categoryId, categoryName: cat?.name || ae.categoryId,
            subcategoryId: ae.subcategoryId, subcategoryName: sub?.name || ae.subcategoryId,
            difficulty: ae.difficulty
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Eroare AI');

      ae.aiResult = Object.assign(_blankAiResult(), data);
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
      BM.toast('Completează titlul, enunțul și cel puțin un pas din barem.', 'error'); return;
    }

    const baremSum = r.pasi_barem.reduce((s, p) => s + (Number(p.puncte_maxime) || 0), 0);
    if (r.punctaj_total && baremSum !== r.punctaj_total) {
      const proceed = confirm(
        `Suma pașilor din barem (${baremSum}) nu corespunde cu punctajul total declarat (${r.punctaj_total}). Salvezi oricum?`
      );
      if (!proceed) return;
    }

    const cat = BM.getCategoryById(ae.categoryId);
    const barem = r.pasi_barem.map(p => ({
      descriere: p.operatie_katex ? `${p.descriere}: $$${p.operatie_katex}$$` : p.descriere,
      puncte_maxime: Number(p.puncte_maxime) || 0
    }));

    const solutionParts = r.pasi_barem.map(p =>
      `**Pasul ${p.nr}.** ${p.descriere}${p.operatie_katex ? `\n$$${p.operatie_katex}$$` : ''}`
    );
    if (r.raspuns_final) solutionParts.push(`$$\\boxed{${r.raspuns_final}}$$`);
    if (r.metode_alternative.length) {
      solutionParts.push('**Metode alternative:**');
      r.metode_alternative.forEach(m => solutionParts.push(`**${m.nume}.** ${m.descriere}`));
    }

    const row = {
      grade: ae.grade,
      category_id: ae.categoryId,
      subcategory_id: ae.subcategoryId,
      difficulty: ae.difficulty,
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
