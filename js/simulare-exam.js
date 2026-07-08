/* ============================================================
   Mathorizon — Simulări: student exam-taking screen
   Renders into #cdContent (class.html), reusing bac.js's exam
   shell CSS classes. Grading itself happens server-side via the
   start_simulation_attempt / submit_simulation_answer /
   finish_simulation_attempt RPC functions — this file only
   drives the UI and autosaves the student's answers.
   ============================================================ */

window.BM = window.BM || {};

(function () {
  'use strict';

  let state = null;

  window.SimulareExam = { start };

  async function start(simulation) {
    const mount = document.getElementById('cdContent');
    if (!mount) return;

    mount.innerHTML = `<div class="classes-loading"><div class="classes-spinner"></div><p>Se încarcă simularea...</p></div>`;

    try {
      // Look for an attempt of ours first — covers "resume" and "view result"
      // without ever touching start_simulation_attempt (which only succeeds
      // while the simulation is 'activa', and would wrongly block resuming/
      // reviewing an attempt after a teacher later ends or reopens it).
      const { data: existing } = await BMAuth.supabase
        .from('simulation_attempts').select('*')
        .eq('simulation_id', simulation.id).eq('student_id', BMAuth.user.id)
        .maybeSingle();

      let attempt = existing || null;
      if (!attempt) {
        const { data, error } = await BMAuth.supabase.rpc('start_simulation_attempt', {
          p_simulation_id: simulation.id,
          p_student_name: (window.BMAuth.displayName ? BMAuth.displayName() : '') || ''
        });
        if (error) throw error;
        attempt = data;
      }

      const { data: items, error: itemsErr } = await BMAuth.supabase
        .from('simulation_items').select('*').eq('simulation_id', simulation.id).order('position');
      if (itemsErr) throw itemsErr;

      let answers = {};
      if (attempt.status !== 'finalizata') {
        const { data: rows } = await BMAuth.supabase.from('simulation_answers')
          .select('*').eq('attempt_id', attempt.id);
        (rows || []).forEach(a => { answers[a.simulation_item_id] = a.answer_text || ''; });
      }

      state = { simulation, items: items || [], attempt, answers, current: 0, timerInterval: null, lastFocusedInput: null };

      if (attempt.status === 'finalizata') { await _renderResults(); return; }

      _renderShell();
      _renderItem(0);
      _startTimer();
    } catch (e) {
      mount.innerHTML = `
        <div class="cd-placeholder">
          <div class="cd-placeholder__icon">⚠️</div>
          <h3 class="cd-placeholder__title">Nu s-a putut porni simularea</h3>
          <p class="cd-placeholder__desc">${BM.esc(e.message)}</p>
        </div>`;
    }
  }

  function _close() {
    clearInterval(state?.timerInterval);
    state = null;
    if (typeof window.onSimulareExamClosed === 'function') window.onSimulareExamClosed();
  }

  /* ---- Exam shell (sidebar + main), mirrors bac.html's #examView ---- */
  function _renderShell() {
    const mount = document.getElementById('cdContent');
    mount.innerHTML = `
      <div class="bac-exam-wrap">
        <div class="bac-sidebar-wrap" id="simSidebarWrap">
          <aside class="bac-sidebar" id="simItemNav"></aside>
        </div>
        <main class="bac-main">
          <div class="bac-exam-topbar">
            <div class="bac-slot-meta">
              <span class="bac-slot-num">${BM.esc(state.simulation.title)}</span>
            </div>
            <div class="bac-topbar-controls">
              <span class="bac-timer" id="simTimerEl"></span>
              <button class="btn btn--danger bac-finish-btn" id="simFinishBtn">Finalizează</button>
            </div>
          </div>
          <div id="simSlotContent"></div>
          <div class="bac-slot-nav">
            <button class="bac-slot-btn bac-slot-btn--prev" id="simPrevBtn">Anterior</button>
            <div class="bac-progress-dots" id="simProgressDots"></div>
            <button class="bac-slot-btn bac-slot-btn--next" id="simNextBtn">Următor</button>
          </div>
        </main>
      </div>`;

    document.getElementById('simFinishBtn').onclick = _confirmFinish;
    document.getElementById('simPrevBtn').onclick = () => _renderItem(state.current - 1);
    document.getElementById('simNextBtn').onclick = () => _renderItem(state.current + 1);
  }

  function _renderSidebarAndDots() {
    const nav = document.getElementById('simItemNav');
    if (nav) {
      nav.innerHTML = `
        <div class="bac-sidebar__header">
          <div class="bac-sidebar__exam-title">Simulare</div>
        </div>
        <div class="bac-sidebar__nav">
          <div class="bac-sidebar__section-label">Itemi</div>
          ${state.items.map((it, i) => `
            <div class="bac-nav-item${i === state.current ? ' current' : ''}" data-nav-idx="${i}">
              <span class="bac-nav-item__label">Item ${i + 1}</span>
              ${i === state.current ? '<span class="bac-nav-badge">În lucru</span>' : `<span class="bac-nav-item__pts">${it.points}p</span>`}
            </div>`).join('')}
        </div>`;
      nav.querySelectorAll('[data-nav-idx]').forEach(el => {
        el.onclick = () => _renderItem(Number(el.dataset.navIdx));
      });
    }

    const dots = document.getElementById('simProgressDots');
    if (dots) {
      dots.innerHTML = state.items.map((it, i) => {
        let cls = 'bac-dot';
        if (i === state.current) cls += ' current';
        else if (state.answers[it.id]) cls += ' done';
        return `<div class="${cls}" title="Item ${i + 1}"></div>`;
      }).join('');
    }
  }

  function _renderItem(idx) {
    if (idx < 0 || idx >= state.items.length) return;
    state.current = idx;
    const item = state.items[idx];
    const content = document.getElementById('simSlotContent');
    if (!content) return;

    content.innerHTML = `
      <div class="bac-exercise-card">
        <div class="bac-card-stripe"></div>
        <div class="bac-card-body">
          <h2 class="bac-slot-title">Item ${idx + 1} · ${item.points}p</h2>
          <div class="bac-statement math-content" id="simStatement"></div>
        </div>
      </div>
      <div class="sim-answer-block">
        <label class="cls-form-label">Răspuns final</label>
        <input type="text" class="sim-answer-input" id="simAnswerInput" autocomplete="off"
               value="${BM.esc(state.answers[item.id] || '')}">
        <div class="sim-symbol-toolbar">
          ${['∈','∉','∩','∪','∅','⊂','≤','≥','≠','√','∞','π','²','³','±']
            .map(s => `<button type="button" class="sim-symbol-btn" data-sym="${BM.esc(s)}">${s}</button>`).join('')}
        </div>
      </div>`;

    const stEl = document.getElementById('simStatement');
    stEl.innerHTML = BM.trustedNl2br(item.statement || '');
    BM.renderMath(stEl);

    const input = document.getElementById('simAnswerInput');
    state.lastFocusedInput = input;
    const debouncedSave = BM.debounce(() => _saveAnswer(item.id, input.value), 500);
    input.addEventListener('focus', () => { state.lastFocusedInput = input; });
    input.addEventListener('input', debouncedSave);
    input.addEventListener('blur', () => _saveAnswer(item.id, input.value));

    content.querySelectorAll('.sim-symbol-btn').forEach(btn => {
      btn.addEventListener('click', () => _insertSymbol(btn.dataset.sym));
    });

    document.getElementById('simPrevBtn').disabled = idx === 0;
    document.getElementById('simNextBtn').disabled = idx === state.items.length - 1;

    _renderSidebarAndDots();
  }

  function _insertSymbol(sym) {
    const inp = state.lastFocusedInput;
    if (!inp) return;
    const start = inp.selectionStart ?? inp.value.length;
    const end   = inp.selectionEnd ?? inp.value.length;
    inp.setRangeText(sym, start, end, 'end');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.focus();
  }

  async function _saveAnswer(itemId, text) {
    state.answers[itemId] = text;
    try {
      await BMAuth.supabase.rpc('submit_simulation_answer', {
        p_attempt_id: state.attempt.id, p_item_id: itemId, p_answer_text: text
      });
    } catch (e) { /* best-effort autosave — next debounced edit or Finalizează retries */ }
    _renderSidebarAndDots();
  }

  /* ---- Timer ---- */
  function _startTimer() {
    _tick();
    state.timerInterval = setInterval(_tick, 1000);
  }

  function _tick() {
    if (!state) return;
    const startedMs = new Date(state.attempt.started_at).getTime();
    const limitMs   = state.simulation.time_limit_minutes * 60 * 1000;
    const remaining = Math.max(0, Math.floor((startedMs + limitMs - Date.now()) / 1000));

    const timerEl = document.getElementById('simTimerEl');
    if (timerEl) {
      const h = Math.floor(remaining / 3600), m = Math.floor((remaining % 3600) / 60), s = remaining % 60;
      const pad = n => String(n).padStart(2, '0');
      timerEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
      timerEl.className = 'bac-timer' + (remaining < 600 ? ' danger' : remaining < 1800 ? ' warning' : '');
    }
    if (remaining <= 0) {
      clearInterval(state.timerInterval);
      BM.toast('Timpul a expirat! Simularea se finalizează.', 'info');
      _finish();
    }
  }

  /* ---- Finish ---- */
  function _confirmFinish() {
    if (document.getElementById('simFinishConfirm')) return;
    const ov = document.createElement('div');
    ov.id = 'simFinishConfirm';
    ov.className = 'confirm-overlay';
    ov.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-dialog__body">
          <div class="confirm-dialog__icon">🎓</div>
          <div class="confirm-dialog__title">Finalizezi simularea?</div>
          <p style="color:var(--text-muted);font-size:0.9rem;margin-top:8px">
            Exercițiile necompletate primesc 0 puncte. Această acțiune este ireversibilă.
          </p>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;padding:0 20px 20px">
          <button class="btn btn--surface" id="simFinishCancelBtn">Înapoi</button>
          <button class="btn btn--danger" id="simFinishOkBtn">Da, finalizează</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#simFinishCancelBtn').onclick = () => ov.remove();
    ov.querySelector('#simFinishOkBtn').onclick = () => { ov.remove(); _finish(); };
  }

  async function _finish() {
    clearInterval(state.timerInterval);
    try {
      const { data, error } = await BMAuth.supabase.rpc('finish_simulation_attempt', { p_attempt_id: state.attempt.id });
      if (error) throw error;
      state.attempt = data;
      await _renderResults();
    } catch (e) {
      BM.toast('Eroare la finalizare: ' + e.message, 'error');
    }
  }

  /* ---- Own results (never shows other students' data — RLS-enforced too) ---- */
  async function _renderResults() {
    const mount = document.getElementById('cdContent');
    mount.innerHTML = `<div class="classes-loading"><div class="classes-spinner"></div><p>Se încarcă rezultatul...</p></div>`;

    const { data: answers } = await BMAuth.supabase.from('simulation_answers')
      .select('*').eq('attempt_id', state.attempt.id);
    const answerMap = {};
    (answers || []).forEach(a => { answerMap[a.simulation_item_id] = a; });

    const rows = state.items.map((it, idx) => {
      const a = answerMap[it.id];
      const correct = !!a?.is_correct;
      return `
        <div class="sim-result-row sim-result-row--${correct ? 'ok' : 'no'}">
          <span class="sim-result-row__idx">${idx + 1}</span>
          <span class="sim-result-row__answer">${BM.esc(a?.answer_text || '(fără răspuns)')}</span>
          <span class="sim-result-row__pts">${a?.points_earned ?? 0}/${it.points}p</span>
          <span class="sim-result-row__mark">${correct ? '✓' : '✕'}</span>
        </div>`;
    }).join('');

    mount.innerHTML = `
      <div class="sim-results-wrap">
        <div class="sim-result-summary">
          <div class="sim-result-summary__grade">${state.attempt.grade_10 ?? '—'}</div>
          <div class="sim-result-summary__pts">${state.attempt.earned_points}/${state.attempt.total_points} puncte</div>
        </div>
        <div class="sim-result-list">${rows}</div>
        <button class="btn btn--surface" id="simResultsCloseBtn" style="margin-top:16px">← Înapoi la simulări</button>
      </div>`;

    document.getElementById('simResultsCloseBtn').onclick = _close;
  }
})();
