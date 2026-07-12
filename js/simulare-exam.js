/* ============================================================
   Mathorizon — Simulări: student exam-taking screen
   The exam itself renders as a fixed, full-viewport overlay appended
   directly to <body> (with fullscreen + navbar-hiding enforcement,
   same convention as the real BAC simulator) — deliberately NOT
   inside #cdContent, so a class-page.js tab reload (realtime update,
   visibilitychange, etc.) can never clobber an in-progress exam out
   from under the student.

   Once finished (or when simply reviewing an already-completed
   attempt), the fullscreen takeover is released and results render
   back inside the normal class page (#cdContent, navbar visible) —
   there's nothing left to protect from cheating once it's over, and
   staying "inside the class" reads much more naturally than a second
   full-page takeover for what is just a read-only summary.

   Grading itself happens server-side via the start_simulation_attempt /
   submit_simulation_answer / finish_simulation_attempt RPC functions —
   this file only drives the UI and autosaves the student's answers.
   ============================================================ */

window.BM = window.BM || {};

(function () {
  'use strict';

  let state = null;
  let _simRealtimeChannel = null;

  window.SimulareExam = { start };

  /* ---- Fullscreen helpers (same approach as bac.js) ---- */
  function _enterFullscreen() {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen || (() => {})).call(el);
  }
  function _exitFullscreen() {
    (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen || (() => {})).call(document);
  }
  function _isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
  }

  function _onFsChange() {
    if (!state || state.finished) return;
    if (_isFullscreen()) { _hideFsPrompt(); return; }
    _logViolation();
    _showFsPrompt();
  }
  document.addEventListener('fullscreenchange',       _onFsChange);
  document.addEventListener('webkitfullscreenchange', _onFsChange);
  document.addEventListener('mozfullscreenchange',    _onFsChange);

  // Non-punitive by design (unlike the BAC exam's 2-strike auto-cancel) —
  // there's no token/forfeiture concept for a teacher-run class simulation,
  // so exiting fullscreen just blocks interaction with a reminder instead
  // of destroying the attempt.
  function _showFsPrompt() {
    if (document.getElementById('simFsPrompt')) return;
    const ov = document.createElement('div');
    ov.id = 'simFsPrompt';
    ov.innerHTML = `
      <div class="fs-resume-box">
        <div class="fs-resume-icon">🖥️</div>
        <div class="fs-resume-title">Revino la ecran complet</div>
        <p class="fs-resume-body">Simularea rulează în ecran complet — timpul continuă să curgă.</p>
        <button class="btn btn--primary" id="simFsPromptBtn">↑ Revino la ecran complet</button>
      </div>`;
    document.body.appendChild(ov);
    document.getElementById('simFsPromptBtn').onclick = () => { _enterFullscreen(); };
  }
  function _hideFsPrompt() {
    document.getElementById('simFsPrompt')?.remove();
  }

  function _beforeUnload(e) {
    e.preventDefault();
    e.returnValue = '';
  }

  /* Same hover-to-peek behavior as bac.js's exam mode: hovering the top
     edge (or the hidden navbar itself) slides it back into view. */
  function _initNavAutoHide() {
    const nav  = document.querySelector('.nav');
    const zone = document.getElementById('navHoverZone');
    if (!nav || !zone || nav._simAutoHideBound) return;
    nav._simAutoHideBound = true;
    const show = () => nav.classList.add('nav--peek');
    const hide = (e) => {
      const to = e.relatedTarget;
      if (to && (nav.contains(to) || to === zone)) return;
      nav.classList.remove('nav--peek');
    };
    zone.addEventListener('mouseenter', show);
    nav.addEventListener('mouseenter', show);
    nav.addEventListener('mouseleave', hide);
    zone.addEventListener('mouseleave', hide);
  }

  /* Watches this specific simulation's own row for two opposite events:
     - Teacher hits "Încheie" while the student is still mid-exam → force-
       finish them immediately with whatever's been answered so far.
     - Teacher hits "Redeschide" while the student is sitting on their OLD
       results screen (_renderResults doesn't take over fullscreen, so
       there's nothing else stopping them from just staying there) → without
       this, they'd have no way to know a retake is available short of
       manually navigating away and back to the Simulări tab. Only offer
       the retake if the reopen happened AFTER this attempt finished —
       reusing the same started_at-vs-finished_at comparison as start(),
       so a student who's simply looking at a still-current result (sim
       reopened, then they retook it and are viewing THAT result) doesn't
       get an incorrect "you can retake" prompt for their own latest score. */
  function _watchSimulationStatus(simulationId) {
    _unwatchSimulationStatus();
    _simRealtimeChannel = BMAuth.supabase
      .channel('sim-watch-' + simulationId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'simulations', filter: 'id=eq.' + simulationId
      }, (payload) => {
        if (payload.new?.status === 'incheiata' && state && !state.finished) {
          BM.toast('Profesorul a încheiat simularea — se finalizează cu răspunsurile tale curente.', 'info');
          _finish();
        } else if (payload.new?.status === 'activa' && state?.finished && state.attempt?.finished_at
          && new Date(state.attempt.finished_at).getTime() < new Date(payload.new.started_at).getTime()) {
          BM.toast('Profesorul a redeschis simularea — o poți relua acum.', 'info');
          start(Object.assign({}, state.simulation, payload.new));
        }
      })
      .subscribe();
  }
  function _unwatchSimulationStatus() {
    if (_simRealtimeChannel) { BMAuth.supabase.removeChannel(_simRealtimeChannel); _simRealtimeChannel = null; }
  }

  // options[itemId] = [{id, label, position}, ...] — only fetched for items
  // that actually have any (free-text items simply get an empty array).
  async function _fetchOptions(items) {
    const itemIds = items.filter(it => it.answer_type === 'grila').map(it => it.id);
    if (!itemIds.length) return {};
    const { data } = await BMAuth.supabase
      .from('simulation_item_options').select('*').in('simulation_item_id', itemIds).order('position');
    const byItem = {};
    (data || []).forEach(o => { (byItem[o.simulation_item_id] = byItem[o.simulation_item_id] || []).push(o); });
    return byItem;
  }

  /* ---- Mod supravegheat: silent violation logging (teacher-only, never
     shown to the student — see simulation_attempt_flags' RLS). Only wired
     up when the simulation itself has supervised === true. ---- */
  function _logViolation() {
    if (!state || state.finished || !state.simulation.supervised) return;
    BMAuth.supabase.rpc('log_sim_violation', { p_attempt_id: state.attempt.id }).catch(() => {});
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) _logViolation();
  });

  async function start(simulation) {
    try {
      // Shouldn't happen going forward (the wizard now only activates a
      // simulation after its items are saved), but an old/broken row could
      // still exist — checked up front, before creating any attempt or
      // entering fullscreen, so a student never gets stuck with a fresh
      // 'in_progres' row for a simulation that has nothing to answer.
      const { count: itemCount, error: itemCountErr } = await BMAuth.supabase
        .from('simulation_items').select('id', { count: 'exact', head: true }).eq('simulation_id', simulation.id);
      if (itemCountErr) throw itemCountErr;
      if (!itemCount) {
        BM.toast('Această simulare nu are niciun exercițiu — anunță profesorul.', 'error');
        return;
      }

      // A student can now have several attempt rows for the same
      // simulation (one per retake after a teacher reopens it) — only the
      // most recent one is ever relevant, so always take the latest.
      const { data: existingList } = await BMAuth.supabase
        .from('simulation_attempts').select('*')
        .eq('simulation_id', simulation.id).eq('student_id', BMAuth.user.id)
        .order('started_at', { ascending: false }).limit(1);
      const existing = existingList?.[0] || null;

      // A finalized attempt only means "just show past results" if it's
      // still current — i.e. the simulation hasn't been reopened SINCE
      // this attempt finished. reopenSimulation() resets simulations.
      // started_at to the reopen time specifically so this comparison
      // works: finished_at < started_at means "stale, reopened after I
      // finished" → the student gets a fresh retake instead. Without this
      // check, a student who simply finished early while the exam was
      // still active for classmates would get wrongly forced into a new
      // attempt every time they revisit their own results.
      const canRetake = simulation.status === 'activa' && existing?.status === 'finalizata'
        && new Date(existing.finished_at).getTime() < new Date(simulation.started_at).getTime();

      if (existing?.status === 'finalizata' && !canRetake) {
        // Already finished — show the results right inside the class page.
        // No fullscreen/overlay takeover: there's nothing left to protect
        // from cheating once it's over.
        const { data: items, error: itemsErr } = await BMAuth.supabase
          .from('simulation_items').select('*').eq('simulation_id', simulation.id).order('position');
        if (itemsErr) throw itemsErr;
        const options = await _fetchOptions(items || []);
        state = { simulation, items: items || [], options, attempt: existing, answers: {}, finished: true };
        await _renderResults();
        return;
      }

      document.getElementById('simExamOverlay')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'simExamOverlay';
      overlay.className = 'sim-exam-overlay';
      overlay.innerHTML = `<div class="classes-loading"><div class="classes-spinner"></div><p>Se încarcă simularea...</p></div>`;
      document.body.appendChild(overlay);

      // Only an in-progress attempt can be resumed as-is — a finalized one
      // (first-time-finished-but-stale-after-reopen, i.e. canRetake) must
      // go through start_simulation_attempt to get a genuinely fresh row;
      // it never reuses an old finalized attempt.
      let attempt = existing?.status === 'in_progres' ? existing : null;
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
      const options = await _fetchOptions(items || []);

      const answers = {};
      const { data: rows } = await BMAuth.supabase.from('simulation_answers')
        .select('*').eq('attempt_id', attempt.id);
      (rows || []).forEach(a => { answers[a.simulation_item_id] = a.answer_text || ''; });

      state = { simulation, items: items || [], options, attempt, answers, current: 0, timerInterval: null, lastFocusedInput: null, finished: false };

      document.body.classList.add('bac-exam-mode');
      _initNavAutoHide();
      window.addEventListener('beforeunload', _beforeUnload);
      _watchSimulationStatus(simulation.id);

      _enterFullscreen();
      _renderShell();
      _renderItem(0);
      _startTimer();
    } catch (e) {
      document.getElementById('simExamOverlay')?.remove();
      BM.toast('Nu s-a putut porni simularea: ' + e.message, 'error');
    }
  }

  function _close() {
    clearInterval(state?.timerInterval);
    _unwatchSimulationStatus();
    window.removeEventListener('beforeunload', _beforeUnload);
    document.body.classList.remove('bac-exam-mode');
    _hideFsPrompt();
    _exitFullscreen();
    document.getElementById('simExamOverlay')?.remove();
    state = null;
    if (typeof window.onSimulareExamClosed === 'function') window.onSimulareExamClosed();
  }

  /* ---- Exam shell (sidebar + main), mirrors bac.html's #examView ---- */
  function _renderShell() {
    const overlay = document.getElementById('simExamOverlay');
    overlay.innerHTML = `
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

    const isGrila = item.answer_type === 'grila';
    const letters = 'ABCDEFGH';
    const options = state.options[item.id] || [];

    content.innerHTML = `
      <div class="bac-exercise-card">
        <div class="bac-card-stripe"></div>
        <div class="bac-card-body">
          <h2 class="bac-slot-title">Item ${idx + 1} · ${item.points}p</h2>
          <div class="bac-statement math-content" id="simStatement"></div>
        </div>
      </div>
      ${isGrila ? `
      <div class="sim-answer-block">
        ${options.map((o, i) => `
          <div class="sim-option-card${state.answers[item.id] === o.id ? ' sim-option-card--selected' : ''}" data-opt-id="${o.id}">
            <span class="sim-option-card__letter">${letters[i] || i + 1}</span>
            <span class="sim-option-card__label">${BM.esc(o.label)}</span>
          </div>`).join('')}
      </div>` : `
      <div class="sim-answer-block">
        <label class="cls-form-label">Răspuns final</label>
        <input type="text" class="sim-answer-input" id="simAnswerInput" autocomplete="off" maxlength="300"
               value="${BM.esc(state.answers[item.id] || '')}">
        <div class="sim-symbol-toolbar">
          ${['(', ')', 'x', '∈','∉','∩','∪','∅','⊂','≤','≥','≠','√','∞','π','²','³','⁴','⁵','⁶','±']
            .map(s => `<button type="button" class="sim-symbol-btn" data-sym="${BM.esc(s)}">${s}</button>`).join('')}
        </div>
      </div>`}`;

    const stEl = document.getElementById('simStatement');
    stEl.innerHTML = BM.trustedNl2br(item.statement || '');
    BM.renderMath(stEl);

    if (isGrila) {
      content.querySelectorAll('.sim-option-card').forEach(card => {
        card.addEventListener('click', () => {
          content.querySelectorAll('.sim-option-card').forEach(c => c.classList.remove('sim-option-card--selected'));
          card.classList.add('sim-option-card--selected');
          _saveAnswer(item.id, card.dataset.optId);
        });
      });
    } else {
      const input = document.getElementById('simAnswerInput');
      state.lastFocusedInput = input;
      const debouncedSave = BM.debounce(() => _saveAnswer(item.id, input.value), 500);
      input.addEventListener('focus', () => { state.lastFocusedInput = input; });
      input.addEventListener('input', debouncedSave);
      input.addEventListener('blur', () => _saveAnswer(item.id, input.value));

      content.querySelectorAll('.sim-symbol-btn').forEach(btn => {
        btn.addEventListener('click', () => _insertSymbol(btn.dataset.sym));
      });
    }

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
      const { error } = await BMAuth.supabase.rpc('submit_simulation_answer', {
        p_attempt_id: state.attempt.id, p_item_id: itemId, p_answer_text: text
      });
      // The server auto-finalizes an attempt whose time limit has already
      // elapsed and rejects the write — if that just happened, jump straight
      // to the results screen instead of leaving the student mid-item.
      if (error && /already finished/i.test(error.message || '')) { await _finish(true); return; }
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

  async function _finish(alreadyFinalized) {
    clearInterval(state.timerInterval);
    _unwatchSimulationStatus();
    try {
      if (!alreadyFinalized) {
        // The visible input's own debounce (500ms) or blur handler may not
        // have fired yet — e.g. the timer hit 0 mid-keystroke, with nothing
        // to blur it. Flush whatever's currently typed directly (bypassing
        // the debounce) before finishing, so the last edit is never lost.
        // Best-effort: if this fails (already finished, network hiccup),
        // finishing still proceeds with whatever was already saved.
        const curInput = document.getElementById('simAnswerInput');
        const curItem  = state.items[state.current];
        if (curInput && curItem) {
          try {
            await BMAuth.supabase.rpc('submit_simulation_answer', {
              p_attempt_id: state.attempt.id, p_item_id: curItem.id, p_answer_text: curInput.value
            });
          } catch (e) { /* best-effort flush */ }
        }

        const { data, error } = await BMAuth.supabase.rpc('finish_simulation_attempt', { p_attempt_id: state.attempt.id });
        if (error) throw error;
        state.attempt = data;
      } else {
        const { data } = await BMAuth.supabase.from('simulation_attempts').select('*').eq('id', state.attempt.id).single();
        state.attempt = data;
      }
      state.finished = true;

      // Release the exam takeover now — results render back inside the
      // normal class page, not as a second fullscreen overlay.
      window.removeEventListener('beforeunload', _beforeUnload);
      document.body.classList.remove('bac-exam-mode');
      _hideFsPrompt();
      _exitFullscreen();
      document.getElementById('simExamOverlay')?.remove();

      await _renderResults();
    } catch (e) {
      BM.toast('Eroare la finalizare: ' + e.message, 'error');
    }
  }

  /* ---- Own results (never shows other students' data — RLS-enforced too) ----
     The correct answer is only readable once this attempt is 'finalizata'
     (see the sim_keys_student_select_after_finish policy) — fetching it here
     is safe precisely because _renderResults only ever runs for a finished
     attempt. Renders into #cdContent — normal class page, navbar visible —
     never the fullscreen exam overlay. */
  async function _renderResults() {
    const mount = document.getElementById('cdContent');
    if (!mount) return;
    mount.innerHTML = `<div class="classes-loading"><div class="classes-spinner"></div><p>Se încarcă rezultatul...</p></div>`;

    const itemIds = state.items.map(it => it.id);
    const [{ data: answers }, { data: keys }] = await Promise.all([
      BMAuth.supabase.from('simulation_answers').select('*').eq('attempt_id', state.attempt.id),
      BMAuth.supabase.from('simulation_answer_keys').select('*').in('simulation_item_id', itemIds)
    ]);
    if (!state.options) state.options = await _fetchOptions(state.items);
    const answerMap = {};
    (answers || []).forEach(a => { answerMap[a.simulation_item_id] = a; });
    const keyMap = {};
    (keys || []).forEach(k => { keyMap[k.simulation_item_id] = k.correct_answer; });

    // For grilă items, both the student's answer and the key are option ids
    // — resolve each to its label text so results show something readable
    // instead of a raw uuid.
    const optLabel = (itemId, optionId) => (state.options[itemId] || []).find(o => o.id === optionId)?.label || '—';

    const rows = state.items.map((it, idx) => {
      const a = answerMap[it.id];
      const correct = !!a?.is_correct;
      const isGrila = it.answer_type === 'grila';
      const yourAnswer = isGrila ? (a?.answer_text ? optLabel(it.id, a.answer_text) : '(fără răspuns)') : (a?.answer_text || '(fără răspuns)');
      const correctAnswer = isGrila ? optLabel(it.id, keyMap[it.id]) : (keyMap[it.id] || '—');
      return `
        <div class="sim-result-card sim-result-card--${correct ? 'ok' : 'no'}">
          <div class="sim-result-card__head">
            <span class="sim-result-card__idx">${idx + 1}</span>
            <span class="sim-result-card__pts">${a?.points_earned ?? 0}/${it.points}p</span>
            <span class="sim-result-card__mark">${correct ? '✓' : '✕'}</span>
          </div>
          <div class="sim-result-card__statement math-content" id="simResultStatement${idx}"></div>
          <div class="sim-result-card__answers">
            <div class="sim-result-answer">
              <span class="sim-result-answer__lbl">Răspunsul tău</span>
              <span class="sim-result-answer__val">${BM.esc(yourAnswer)}</span>
            </div>
            <div class="sim-result-answer sim-result-answer--correct">
              <span class="sim-result-answer__lbl">Răspuns corect</span>
              <span class="sim-result-answer__val">${BM.esc(BM.latexToPlain(correctAnswer))}</span>
            </div>
          </div>
          ${a?.feedback_text ? `
          <div class="sim-result-feedback">💬 ${BM.esc(a.feedback_text)}</div>` : ''}
        </div>`;
    }).join('');

    const grade = state.attempt.grade_10 != null ? parseFloat(state.attempt.grade_10) : null;
    const gradeCls = grade == null ? '' : grade >= 9 ? 'hi' : grade >= 7 ? 'ok' : grade >= 5 ? 'mid' : 'lo';

    mount.innerHTML = `
      <div class="sim-results-wrap">
        <div class="sim-result-summary">
          <div class="sim-result-summary__stat">
            <div class="sim-result-summary__val sim-result-summary__val--${gradeCls}">${state.attempt.grade_10 ?? '—'}</div>
            <div class="sim-result-summary__lbl">Notă</div>
          </div>
          <div class="sim-result-summary__divider"></div>
          <div class="sim-result-summary__stat">
            <div class="sim-result-summary__val">${state.attempt.earned_points}<span class="sim-result-summary__val-sep">/</span>${state.attempt.total_points}</div>
            <div class="sim-result-summary__lbl">Punctaj acumulat</div>
          </div>
        </div>
        <div class="sim-result-list">${rows}</div>
        <button class="btn btn--surface" id="simResultsCloseBtn" style="margin-top:16px">← Înapoi la simulări</button>
      </div>`;

    state.items.forEach((it, idx) => {
      const el = document.getElementById('simResultStatement' + idx);
      if (!el) return;
      el.innerHTML = BM.trustedNl2br(it.statement || '');
      BM.renderMath(el);
    });

    document.getElementById('simResultsCloseBtn').onclick = _close;

    // Covers both paths that lead here: a student who just finished
    // normally (via _finish, which already unwatched before calling this)
    // and one revisiting an old result from the Simulări list (start()'s
    // early-return branch) — either way, results being on screen shouldn't
    // mean losing track of the teacher reopening the simulation for a
    // retake (see _watchSimulationStatus).
    _watchSimulationStatus(state.simulation.id);
  }
})();
