/* ============================================================
   Mathorizon — Classes Page
   Teachers: create classes, share invite codes, manage members.
   Students: join via invite code, view/leave classes.

   The page is a class register (see .impeccable/surfaces/classes-html.md
   and DESIGN.md): a display with the totals, then one ruled row per
   class. Markup classes: cl-* (the page), cm-* (the create-class modal).
   The look lives in css/calculator.css, section "classes.html".
   ============================================================ */

(function () {
  'use strict';

  const DAY_ORDER = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
  const DAY_SHORT = { Luni: 'Lun', 'Marți': 'Mar', Miercuri: 'Mie', Joi: 'Joi', Vineri: 'Vin', 'Sâmbătă': 'Sâm', 'Duminică': 'Dum' };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Persists across renderTeacherView() re-renders AND across page visits
  // (stored in localStorage via BM.Storage) — a teacher navigating to
  // another tab and back expects the filter to still be applied.
  let _dayFilterSelected = BM.Storage.getClassDayFilter();

  // The first paint plays the entrance (display test, rows printed one by
  // one); every later re-render of the same page (fresh data after the
  // cached paint, a class created or deleted) must not replay it.
  let _painted = false;
  // Invite code of the class that was just created: its row lands
  // highlighted at the top of the register.
  let _freshCode = null;

  // Class names are always machine-generated as "Materie · Zi[/Zi2] · Oră"
  // (see buildGeneratedName/_getSelectedDays below — there's no free-text
  // override), so the day(s) a class meets on can be recovered straight
  // from the name for the day filter without a schema change.
  function _parseClassDays(name) {
    const dayPart = String(name || '').split(' · ')[1] || '';
    return dayPart.split('/').map(d => d.trim()).filter(d => DAY_ORDER.includes(d));
  }

  // Everything a row needs to show about a class. Structured columns
  // (schedule_days, schedule_time, lesson_type) win over the name when a
  // class has them; older classes fall back to the name.
  function _classInfo(cls) {
    const parts = String(cls.name || '').split(' · ');
    let days = _parseClassDays(cls.name);
    if (Array.isArray(cls.schedule_days) && cls.schedule_days.length) {
      days = cls.schedule_days.map(n => DAY_ORDER[n - 1]).filter(Boolean);
    }
    return {
      subject: parts[0] || cls.name || 'Clasă',
      days,
      time: String(cls.schedule_time || parts[2] || '').slice(0, 5),
      type: cls.lesson_type === 'online' ? 'Online' : cls.lesson_type === 'offline' ? 'Offline' : '',
      grade: cls.school_grade ? 'Clasa ' + cls.school_grade : '',
      level: cls.math_level ? 'Nivel ' + cls.math_level : ''
    };
  }

  const _shortDays = days => days.map(d => DAY_SHORT[d] || d).join(' · ');

  // Doto draws its colon as a cross-shaped cluster at this size, so the
  // colon of a time is set in the UI face and only the digits are dot-matrix.
  const _timeHTML = t => BM.esc(t).replace(':', '<span class="cl-colon">:</span>');

  /* ─── Init ─────────────────────────────────────────────────────── */
  function init() {
    BM.initScrollTop();
    if (window._bmAuthReady) {
      handleAuthReady();
    } else {
      document.addEventListener('bmauth:ready', handleAuthReady, { once: true });
    }
  }

  function handleAuthReady() {
    if (!BMAuth.user) {
      renderLoginPrompt();
      return;
    }
    if (BMAuth.role) {
      renderForRole();
    } else {
      /* Role loads async via bmauth:synced — show the loading display until then */
      document.addEventListener('bmauth:synced', renderForRole, { once: true });
    }
  }

  function renderForRole() {
    if (BMAuth.role === 'profesor') {
      renderTeacherView();
    } else {
      renderStudentView();
    }
  }

  /* ─── Custom confirm dialog ────────────────────────────────────── */
  function showConfirm({ title, message, confirmText = 'Confirmă', danger = false, icon: iconHtml = icon('triangle-alert', { size: 32 }) }) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'cl-confirm';
      overlay.innerHTML = `
        <div class="cl-confirm__dialog" role="alertdialog" aria-modal="true" aria-labelledby="clConfirmTitle">
          <div class="cl-confirm__icon${danger ? ' cl-confirm__icon--danger' : ''}">${iconHtml}</div>
          <h2 class="cl-confirm__title" id="clConfirmTitle">${title}</h2>
          ${message ? `<p class="cl-confirm__msg">${message}</p>` : ''}
          <div class="cl-confirm__foot">
            <button type="button" class="cl-key" id="confirmNo">Anulează</button>
            <button type="button" class="cl-key ${danger ? 'cl-key--danger' : 'cl-key--primary'}" id="confirmYes">${confirmText}</button>
          </div>
        </div>
      `;

      const opener = document.activeElement;
      const close = (result) => {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        // The row that opened this may be gone (deleted, left): fall back to the page's main key.
        const back = opener && document.contains(opener) ? opener : document.querySelector('#createClassBtn, #inviteCodeInput');
        if (back) back.focus({ preventScroll: true });
        resolve(result);
      };
      const onKey = e => {
        if (e.key === 'Escape') { e.stopPropagation(); close(false); }
        else trapTab(e, overlay);
      };
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
      overlay.querySelector('#confirmNo').addEventListener('click',  () => close(false));
      overlay.querySelector('#confirmYes').addEventListener('click', () => close(true));
      document.addEventListener('keydown', onKey, true);
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.appendChild(overlay);
      overlay.querySelector('#confirmNo').focus();
    });
  }

  /* Keeps Tab inside an open dialog. */
  function trapTab(e, container) {
    if (e.key !== 'Tab' || !container) return;
    const items = [...container.querySelectorAll('button:not([disabled]), a[href], input')]
      .filter(el => el.getClientRects().length);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (!container.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ─── Root helpers ─────────────────────────────────────────────── */
  function getRoot() { return document.getElementById('classesRoot'); }

  function setRootContent(html) {
    const root = getRoot();
    if (!root) return;
    root.innerHTML = html;
  }

  function loadingHTML() {
    return `
      <div class="cl-page">
        <div class="cl-loading" role="status">
          <span class="cl-loading__lcd">Se încarcă<i></i></span>
        </div>
      </div>`;
  }

  function renderLoginPrompt() {
    setRootContent(`
      <div class="cl-page">
        <div class="cl-empty cl-empty--solo">
          <div class="cl-empty__icon">${icon('lock', { size: 24 })}</div>
          <h2>Autentificare necesară</h2>
          <p>Trebuie să fii autentificat pentru a accesa clasele.</p>
          <a class="cl-key cl-key--primary" href="auth.html?from=classes.html">Conectează-te</a>
        </div>
      </div>
    `);
  }

  /* ─── Invite code generator ────────────────────────────────────── */
  function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  /* ─── Relative date ─────────────────────────────────────────────── */
  function relDate(isoStr) {
    if (!isoStr) return '';
    const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
    if (diff < 60)      return 'acum';
    if (diff < 3600)    return `acum ${Math.floor(diff / 60)} min`;
    if (diff < 86400)   return `acum ${Math.floor(diff / 3600)} ore`;
    if (diff < 2592000) return `acum ${Math.floor(diff / 86400)} zile`;
    return new Date(isoStr).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ─── The totals display ───────────────────────────────────────────
     A green-gray LCD with left-aligned dot-matrix figures. On the first
     paint it runs its segment test, then the figures tick up to their
     value in steps (like a display refreshing). Later renders show the
     figures at once. */
  function statusHTML(label, cells) {
    return `
      <div class="cl-status${_painted ? '' : ' cl-boot'}" role="group" aria-label="${label}" style="--cols:${cells.length}">
        ${cells.map(c => `
          <div class="cl-status__cell">
            <span class="cl-status__lbl">${c.lbl}</span>
            <span class="cl-status__row">
              <span class="cl-status__val"${c.tick != null ? ` data-tick="${c.tick}" data-dec="${c.dec || 0}" data-suffix="${c.suffix || ''}"` : ''}>${c.tick != null ? (_painted ? Number(c.tick).toFixed(c.dec || 0) + (c.suffix || '') : (0).toFixed(c.dec || 0)) : c.val}</span>
              ${c.unit ? `<span class="cl-status__unit">${c.unit}</span>` : ''}
            </span>
          </div>`).join('')}
      </div>`;
  }

  function runStatus() {
    const status = document.querySelector('.cl-status');
    if (!status) return;
    const vals = [...status.querySelectorAll('[data-tick]')];
    const fmt = (v, x) => Number(x).toFixed(Number(v.dataset.dec) || 0) + v.dataset.suffix;
    const finish = () => vals.forEach(v => { v.textContent = fmt(v, v.dataset.tick); });
    if (_painted || reduced) { status.classList.remove('cl-boot'); finish(); return; }
    setTimeout(() => {
      status.classList.remove('cl-boot');
      const steps = 9;
      let k = 0;
      const t = setInterval(() => {
        k++;
        vals.forEach(v => {
          const target = Number(v.dataset.tick);
          const dec = Number(v.dataset.dec) || 0;
          v.textContent = fmt(v, dec ? target * Math.min(k / steps, 1) : Math.round(target * Math.min(k / steps, 1)));
        });
        if (k >= steps) { clearInterval(t); finish(); }
      }, 46);
    }, 620);
  }

  /* A row of LCD segments: `lit` of `total` switched on. */
  function segsHTML(lit, total) {
    return `<span class="cl-seg" aria-hidden="true">${Array.from({ length: total }, (_, i) =>
      `<i${i < lit ? ' class="on"' : ''} style="--s:${i}"></i>`).join('')}</span>`;
  }

  function pageClass() { return 'cl-page' + (_painted ? ' cl-static' : ''); }

  /* ─── Greeting and today ───────────────────────────────────────────
     "Bună ziua, <name>" (dimineața / ziua / seara by the hour), the date
     as "Joi, 1 octombrie", and a strip with the lessons that are today. */
  function _greeting() {
    const h = new Date().getHours();
    return h >= 5 && h < 11 ? 'Bună dimineața' : h >= 11 && h < 18 ? 'Bună ziua' : 'Bună seara';
  }

  function _todayLabel() {
    const s = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function headInfoHTML(lede) {
    const name = BM.esc((window.BMAuth && BMAuth.displayName && BMAuth.displayName()) || '');
    return `
      <div class="cl-head__info">
        <span class="cl-eyebrow"><i></i>${_todayLabel()}</span>
        <h1 class="cl-title">${_greeting()}${name ? `, <span class="cl-title__name">${name}</span>` : ''}</h1>
        <p class="cl-lede">${lede}</p>
      </div>`;
  }

  function _todayLessons(classes) {
    const todayName = DAY_ORDER[(new Date().getDay() + 6) % 7];
    return classes
      .map(cls => ({ cls, info: _classInfo(cls) }))
      .filter(x => x.info.days.includes(todayName) && /^\d{1,2}:\d{2}/.test(x.info.time))
      .sort((a, b) => a.info.time.localeCompare(b.info.time));
  }

  // Where a lesson is relative to now, in words. The classes carry no
  // duration, so a lesson that has started is "a început", and after three
  // hours "încheiată".
  function _lessonState(time) {
    const [h, m] = time.split(':').map(Number);
    const at = new Date();
    at.setHours(h, m, 0, 0);
    const diff = Math.round((at - new Date()) / 60000);
    if (diff > 0) {
      const text = diff >= 60 ? `peste ${Math.floor(diff / 60)} h${diff % 60 ? ' ' + (diff % 60) + ' min' : ''}` : `peste ${diff} min`;
      return { cls: 'soon', text };
    }
    if (diff > -180) return { cls: 'now', text: 'a început' };
    return { cls: 'done', text: 'încheiată' };
  }

  function todayHTML(classes, role, memberCounts) {
    const lessons = _todayLessons(classes);
    const title = role === 'profesor' ? 'Lecțiile tale de azi' : 'Lecțiile de azi';
    const next = _nextLesson(classes);
    const nextText = next
      ? `Următoarea: ${next.at.toLocaleDateString('ro-RO', { weekday: 'long' })}, ${BM.esc(next.time)}, ${BM.esc(_classInfo(next.cls).subject)}${next.cls.school_grade ? ' (clasa ' + BM.esc(next.cls.school_grade) + ')' : ''}.`
      : '';
    return `
      <section class="cl-today" aria-labelledby="clTodayT">
        <header class="cl-today__head">
          <h2 id="clTodayT"><i class="cl-today__led${lessons.length ? ' is-on' : ''}"></i>${title}</h2>
          <span class="cl-today__count">${lessons.length ? `${lessons.length} ${lessons.length === 1 ? 'lecție' : 'lecții'}` : 'nicio lecție'}</span>
        </header>
        ${lessons.length ? `
          <ol class="cl-today__list">
            ${lessons.map(({ cls, info }, i) => {
              const st = _lessonState(info.time);
              const n = memberCounts ? memberCounts[cls.id] : null;
              const sub = [info.grade, info.type, role === 'profesor'
                ? (n != null ? `${n}${cls.max_students ? '/' + cls.max_students : ''} ${n === 1 ? 'elev' : 'elevi'}` : '')
                : (cls.teacher_name || '')].filter(Boolean);
              return `
              <li class="cl-lesson cl-lesson--${st.cls}" style="--i:${i}" data-time="${BM.esc(info.time)}">
                <a class="cl-lesson__link" href="class.html?id=${cls.id}">
                  <span class="cl-lesson__time">${_timeHTML(info.time)}</span>
                  <span class="cl-lesson__body">
                    <b>${BM.esc(info.subject)}</b>
                    <span>${sub.map(BM.esc).join(' · ')}</span>
                  </span>
                  <span class="cl-lesson__state">${st.text}</span>
                  ${icon('chevron-right', { size: 18 })}
                </a>
              </li>`;
            }).join('')}
          </ol>` : `
          <div class="cl-today__empty">
            <b>Nu sunt lecții programate pentru azi.</b>
            ${nextText ? `<span>${nextText}</span>` : ''}
          </div>`}
      </section>`;
  }

  // The words in the strip ("peste 2 h" -> "a început") follow the clock.
  let _todayTimer = null;
  function startTodayTicker() {
    clearInterval(_todayTimer);
    _todayTimer = setInterval(() => {
      const items = document.querySelectorAll('.cl-lesson[data-time]');
      if (!items.length) { clearInterval(_todayTimer); return; }
      items.forEach(li => {
        const st = _lessonState(li.dataset.time);
        li.className = li.className.replace(/cl-lesson--(soon|now|done)/, 'cl-lesson--' + st.cls);
        const el = li.querySelector('.cl-lesson__state');
        if (el && el.textContent !== st.text) el.textContent = st.text;
      });
    }, 30000);
  }

  /* ═══════════════════════════════════════════════════════════════
     TEACHER VIEW
  ═══════════════════════════════════════════════════════════════ */
  function _teacherCacheKey() { return 'bm_cls_t_' + BMAuth.user.id; }

  function _applyTeacherUI(classes, memberCounts, aggStats) {
    const has = classes.length > 0;
    setRootContent(`
      <div class="${pageClass()}">
        <header class="cl-head">
          ${headInfoHTML('Aici sunt grupele tale, fiecare cu programul, cifrele ei și codul de invitație pe care îl trimiți elevilor.')}
          <div class="cl-head__keys">
            ${has ? _dayFilterHTML() : ''}
            <button type="button" class="cl-key cl-key--primary" id="createClassBtn">${icon('plus', { size: 16 })} Creează clasă</button>
          </div>
        </header>
        ${has ? todayHTML(classes, 'profesor', memberCounts) : ''}
        ${has && aggStats ? statusHTML('Toate grupele', [
          { lbl: 'Grupe', tick: aggStats.totalGroups },
          { lbl: 'Elevi activi', tick: aggStats.activeStudents },
          { lbl: 'Lecții ținute', tick: aggStats.totalLessons },
          aggStats.avgAttendance != null
            ? { lbl: 'Prezență medie', tick: aggStats.avgAttendance, suffix: '%' }
            : { lbl: 'Prezență medie', val: '-' },
          aggStats.avgPerLesson != null
            ? { lbl: 'Elevi pe oră', tick: aggStats.avgPerLesson, dec: 1 }
            : { lbl: 'Elevi pe oră', val: '-' }
        ]) : ''}
        ${has ? `
          <div class="cl-bar" id="clBar" hidden></div>
          <ol class="cl-blocks" id="classesGrid" aria-label="Clasele tale">
            ${classes.map((c, i) => teacherBlock(c, memberCounts[c.id] || 0, i, aggStats && aggStats.perClass && aggStats.perClass[c.id])).join('')}
          </ol>
          <div class="cl-empty cl-empty--solo cl-empty--panel" id="classesFilterEmpty" hidden>
            <div class="cl-empty__icon">${icon('search-x', { size: 24 })}</div>
            <h2>Nicio clasă în ziua selectată</h2>
            <p>Încearcă altă zi sau șterge filtrul.</p>
          </div>` : teacherEmpty()}
      </div>
      ${createModalHTML()}
    `);
    _freshCode = null;
    document.querySelectorAll('#createClassBtn, #createFirstBtn').forEach(b => b.addEventListener('click', openCreateModal));
    document.querySelectorAll('.cl-block__del').forEach(btn => {
      btn.addEventListener('click', () => deleteClass(btn.dataset.id, btn.dataset.name));
    });
    _wireCopyKeys();
    _initCustomControls();
    if (has) { _wireDayFilter(); _applyDayFilter(); startTodayTicker(); }
    runStatus();
    _painted = true;
  }

  /* ── Day-of-week filter — a square key with the calendar icon next to
     "Creează clasă"; a teacher only needs it once there are enough
     classes that scanning the register by eye stops being faster. */
  function _dayFilterHTML() {
    const n = _dayFilterSelected.length;
    return `
      <div class="cl-filter" id="clsDayFilter">
        <button type="button" class="cl-key cl-key--square${n ? ' is-on' : ''}" id="dayFilterBtn"
                title="Filtrează după zi" aria-label="Filtrează după zi" aria-expanded="false">
          ${icon('calendar', { size: 18 })}
          ${n ? '<span class="cl-filter__dot"></span>' : ''}
        </button>
        <div class="cl-filter__pop" id="dayFilterPop" role="dialog" aria-label="Filtrează după zi">
          <div class="cl-filter__title">Arată doar clasele din zilele alese</div>
          <div class="cl-filter__chips">
            ${DAY_ORDER.map(d => `
              <button type="button" class="cl-chip${_dayFilterSelected.includes(d) ? ' is-on' : ''}" data-day="${d}" aria-pressed="${_dayFilterSelected.includes(d)}">${d}</button>
            `).join('')}
          </div>
          <button type="button" class="cl-link" id="dayFilterClear">Arată toate</button>
        </div>
      </div>`;
  }

  function _wireDayFilter() {
    const wrap  = document.getElementById('clsDayFilter');
    const btn   = document.getElementById('dayFilterBtn');
    const pop   = document.getElementById('dayFilterPop');
    if (!wrap || !btn || !pop) return;

    const setOpen = open => {
      wrap.classList.toggle('cl-filter--open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', e => {
      e.stopPropagation();
      setOpen(!wrap.classList.contains('cl-filter--open'));
    });
    pop.addEventListener('click', e => e.stopPropagation());
    // Bound once per render on the wrapper that exists now; a stale wrapper
    // from an earlier render is detached, so the extra listeners are inert.
    document.addEventListener('click', () => setOpen(false));
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') { setOpen(false); btn.focus(); } });

    const sync = () => {
      btn.classList.toggle('is-on', _dayFilterSelected.length > 0);
      const dot = btn.querySelector('.cl-filter__dot');
      if (_dayFilterSelected.length && !dot) btn.insertAdjacentHTML('beforeend', '<span class="cl-filter__dot"></span>');
      else if (!_dayFilterSelected.length && dot) dot.remove();
      BM.Storage.setClassDayFilter(_dayFilterSelected);
      _applyDayFilter();
    };

    pop.querySelectorAll('[data-day]').forEach(chip => {
      chip.addEventListener('click', () => {
        const day = chip.dataset.day;
        _dayFilterSelected = _dayFilterSelected.includes(day)
          ? _dayFilterSelected.filter(d => d !== day)
          : [..._dayFilterSelected, day];
        const on = _dayFilterSelected.includes(day);
        chip.classList.toggle('is-on', on);
        chip.setAttribute('aria-pressed', String(on));
        sync();
      });
    });

    document.getElementById('dayFilterClear')?.addEventListener('click', () => {
      _dayFilterSelected = [];
      pop.querySelectorAll('.cl-chip.is-on').forEach(c => { c.classList.remove('is-on'); c.setAttribute('aria-pressed', 'false'); });
      sync();
    });
  }

  // Matches if ANY of the class's own days is among the selected filter
  // days — a Marți/Joi class stays visible when only "Joi" is picked.
  function _applyDayFilter() {
    const grid = document.getElementById('classesGrid');
    if (!grid) return;
    const rows = [...grid.querySelectorAll('.cl-block')];
    let visibleCount = 0;
    rows.forEach(row => {
      const days = (row.dataset.days || '').split(',').filter(Boolean);
      const match = _dayFilterSelected.length === 0 || days.some(d => _dayFilterSelected.includes(d));
      row.hidden = !match;
      if (match) visibleCount++;
    });
    const emptyMsg = document.getElementById('classesFilterEmpty');
    if (emptyMsg) emptyMsg.hidden = visibleCount !== 0;
    grid.hidden = visibleCount === 0;

    const bar = document.getElementById('clBar');
    if (bar) {
      if (_dayFilterSelected.length) {
        const names = DAY_ORDER.filter(d => _dayFilterSelected.includes(d)).map(d => DAY_SHORT[d]).join(', ');
        bar.hidden = false;
        bar.innerHTML = `<span>Arăt <b>${visibleCount}</b> din <b>${rows.length}</b> grupe <em>(${names})</em></span>
          <button type="button" class="cl-link" id="clBarClear">Arată toate</button>`;
        document.getElementById('clBarClear')?.addEventListener('click', () => document.getElementById('dayFilterClear')?.click());
      } else {
        bar.hidden = true;
        bar.innerHTML = '';
      }
    }
  }

  // One pass across ALL the teacher's classes — 3 queries total regardless
  // of how many classes exist (not one query per class): member statuses,
  // session count, then attendance records for those sessions. "Prezență
  // medie" here is a single pooled percentage (total present marks ÷ total
  // recorded marks across every class), not an average of each class's own
  // rate — deliberately avoids merging attMatrix objects keyed by
  // student_id across classes, which would corrupt a per-student calc for
  // any student enrolled in more than one of this teacher's classes.
  async function _fetchAggregateStats(classIds) {
    if (!classIds.length) return { totalGroups: 0, activeStudents: 0, totalLessons: 0, avgAttendance: null, avgPerLesson: null, perClass: {} };
    const [{ data: members }, { data: sessions }] = await Promise.all([
      BMAuth.supabase.from('class_members').select('class_id, student_id, status').in('class_id', classIds),
      BMAuth.supabase.from('class_sessions').select('id, class_id').in('class_id', classIds)
    ]);
    const activeStudents = (members || []).filter(m => m.status !== 'inactiv').length;
    const sessionIds = (sessions || []).map(s => s.id);

    let avgAttendance = null;
    let records = [];
    if (sessionIds.length) {
      const { data } = await BMAuth.supabase
        .from('attendance_records').select('session_id, student_id, present').in('session_id', sessionIds);
      records = data || [];
      if (records.length) {
        avgAttendance = Math.round((records.filter(r => r.present).length / records.length) * 100);
      }
    }

    // Per class, with the same meaning as the Sumar tab of that class:
    // lessons held; students present per lesson on average (a headcount,
    // over the class's current members); attendance (the mean of each
    // member's own rate over the lessons recorded for them).
    const sessionClass = {};
    (sessions || []).forEach(s => { sessionClass[s.id] = s.class_id; });
    const perClass = {};
    classIds.forEach(id => {
      perClass[id] = { lessons: 0, avgPresent: null, rate: null, _members: new Set(), _per: {} };
    });
    (members || []).forEach(m => { perClass[m.class_id]?._members.add(m.student_id); });
    (sessions || []).forEach(s => { perClass[s.class_id].lessons++; });
    let presentTotals = {};
    records.forEach(r => {
      const cid = sessionClass[r.session_id];
      const pc = perClass[cid];
      if (!pc || !pc._members.has(r.student_id)) return;
      const st = pc._per[r.student_id] || (pc._per[r.student_id] = { present: 0, recorded: 0 });
      st.recorded++;
      if (r.present) { st.present++; presentTotals[cid] = (presentTotals[cid] || 0) + 1; }
    });
    classIds.forEach(id => {
      const pc = perClass[id];
      if (pc.lessons) pc.avgPresent = (presentTotals[id] || 0) / pc.lessons;
      const rates = Object.values(pc._per).map(v => v.present / v.recorded);
      if (rates.length) pc.rate = Math.round((rates.reduce((t, v) => t + v, 0) / rates.length) * 100);
      delete pc._members; delete pc._per;
    });

    // Students present at a lesson, on average, over every lesson of every class.
    const presentAll = Object.values(presentTotals).reduce((t, v) => t + v, 0);
    const avgPerLesson = sessionIds.length ? presentAll / sessionIds.length : null;

    return { totalGroups: classIds.length, activeStudents, totalLessons: sessionIds.length, avgAttendance, avgPerLesson, perClass };
  }

  async function renderTeacherView() {
    /* Show cached content immediately if available */
    let hasCached = false;
    try {
      const cached = JSON.parse(sessionStorage.getItem(_teacherCacheKey()) || 'null');
      if (cached) { hasCached = true; _applyTeacherUI(cached.classes, cached.memberCounts, cached.aggStats); }
    } catch {}
    if (!hasCached) setRootContent(loadingHTML());

    let classes = [];
    try {
      const { data, error } = await BMAuth.supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', BMAuth.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      classes = data || [];
    } catch (e) {
      BM.toast('Eroare la încărcarea claselor: ' + e.message, 'error');
    }

    /* Fetch member counts in parallel */
    const memberCounts = {};
    if (classes.length > 0) {
      await Promise.all(classes.map(async cls => {
        try {
          const { count } = await BMAuth.supabase
            .from('class_members')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id);
          memberCounts[cls.id] = count || 0;
        } catch {}
      }));
    }

    let aggStats = null;
    try { aggStats = await _fetchAggregateStats(classes.map(c => c.id)); } catch {}

    try { sessionStorage.setItem(_teacherCacheKey(), JSON.stringify({ classes, memberCounts, aggStats })); } catch {}
    _applyTeacherUI(classes, memberCounts, aggStats);
  }

  function teacherEmpty() {
    return `
      <section class="cl-sheet cl-sheet--empty" aria-label="Registrul claselor">
        <div class="cl-ghosts" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="cl-empty">
          <div class="cl-empty__icon">${icon('school', { size: 24 })}</div>
          <h2>Nicio clasă creată</h2>
          <p>Creează prima clasă și trimite codul de invitație elevilor tăi.</p>
          <button type="button" class="cl-key cl-key--primary" id="createFirstBtn">${icon('plus', { size: 16 })} Creează prima clasă</button>
        </div>
      </section>
    `;
  }

  function teacherBlock(cls, memberCount, idx, st) {
    const info = _classInfo(cls);
    const sub = [info.grade, info.level, info.type].filter(Boolean);
    const code = BM.esc(cls.invite_code);
    const max = cls.max_students || 0;
    const full = max > 0 && memberCount >= max;
    const segs = Math.min(max, 12);
    const seatsLit = max ? Math.min(segs, Math.round((memberCount / max) * segs)) : 0;
    const lessons = st ? st.lessons : 0;
    const perHour = st && st.avgPresent != null ? st.avgPresent.toFixed(1) : null;
    const rate = st && st.rate != null ? st.rate : null;
    return `
      <li class="cl-block${cls.invite_code === _freshCode ? ' cl-block--new' : ''}" style="--i:${idx}"
          data-id="${cls.id}" data-days="${info.days.join(',')}">
        <div class="cl-block__top">
          <span class="cl-block__no">${String(idx + 1).padStart(2, '0')}</span>
          <div class="cl-block__title">
            <a class="cl-block__link" href="class.html?id=${cls.id}">${BM.esc(info.subject)}${icon('chevron-right', { size: 18 })}</a>
            ${sub.length ? `<span class="cl-block__sub">${sub.map(t => `<span>${BM.esc(t)}</span>`).join('')}</span>` : ''}
            ${cls.description ? `<span class="cl-block__desc">${BM.esc(cls.description)}</span>` : ''}
          </div>
          <button type="button" class="cl-block__del" data-id="${cls.id}" data-name="${BM.esc(cls.name)}"
                  aria-label="Șterge clasa ${BM.esc(info.subject)}" title="Șterge clasa">${icon('x', { size: 16 })}</button>
        </div>

        <div class="cl-block__meta">
          <div class="cl-field">
            <span class="cl-field__k">Program</span>
            <span class="cl-field__v">
              <span>${info.days.length ? _shortDays(info.days) : '-'}</span>
              ${info.time ? `<span class="cl-time">${_timeHTML(info.time)}</span>` : ''}
            </span>
          </div>
          <div class="cl-field">
            <span class="cl-field__k">Cod de invitație</span>
            <span class="cl-field__v cl-block__code">
              <span class="cl-chipcode" title="Creată ${relDate(cls.created_at)}">${code}</span>
              <button type="button" class="cl-mini" data-copy="${code}" aria-label="Copiază codul ${code}" title="Copiază codul">
                <span class="cl-mini__a">${icon('copy', { size: 16 })}</span><span class="cl-mini__b">${icon('check', { size: 16 })}</span>
              </button>
            </span>
          </div>
        </div>

        <div class="cl-lcd" role="group" aria-label="Cifrele grupei" style="--cols:3">
          <div class="cl-lcd__cell">
            <span class="cl-lcd__k">Elevi${full ? ' <em>complet</em>' : ''}</span>
            <span class="cl-lcd__v">${memberCount}${max ? `<small>/${max}</small>` : ''}</span>
            ${max ? segsHTML(seatsLit, segs) : '<span class="cl-lcd__hint">fără limită</span>'}
          </div>
          <div class="cl-lcd__cell" title="Media elevilor prezenți la o oră">
            <span class="cl-lcd__k">Elevi pe oră</span>
            <span class="cl-lcd__v">${perHour != null ? perHour : '-'}</span>
            <span class="cl-lcd__hint">${lessons ? `la ${lessons} ${lessons === 1 ? 'oră' : 'ore'}` : 'fără ore încă'}</span>
          </div>
          <div class="cl-lcd__cell" title="Prezența medie a grupei">
            <span class="cl-lcd__k">Prezență</span>
            <span class="cl-lcd__v">${rate != null ? rate + '<small>%</small>' : '-'}</span>
            ${rate != null ? segsHTML(Math.round(rate / 10), 10) : '<span class="cl-lcd__hint">fără ore încă</span>'}
          </div>
        </div>
      </li>
    `;
  }

  function _wireCopyKeys() {
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        window._copyCode(btn.dataset.copy).then(ok => {
          if (!ok) return;
          btn.classList.add('is-done');
          setTimeout(() => btn.classList.remove('is-done'), 1400);
        });
      });
    });
  }

  /* ─── Create modal ─────────────────────────────────────────────── */
  function buildTimeOptions() {
    let opts = '';
    for (let h = 9; h <= 21; h++) {
      const hh = String(h).padStart(2, '0');
      opts += `<option value="${hh}:00">${hh}:00</option>`;
      if (h < 21) opts += `<option value="${hh}:30">${hh}:30</option>`;
    }
    return opts;
  }

  /* The form's source of truth stays a set of native <select>s (same ids
     as always). Materie and Ora are dressed as a dropdown (cm-sel); the
     short lists (seats, grade, level) are dressed as a row of keys
     (cm-keys). Both write to the select and dispatch 'change'. */

  let _controlsWired = false;

  function _selSync(sel) {
    const wrap = sel.previousElementSibling;
    if (!wrap) return;
    if (wrap.classList.contains('cm-sel')) {
      const opt = sel.options[sel.selectedIndex];
      const display = wrap.querySelector('.cm-sel__display');
      display.textContent = opt ? opt.text : '';
      wrap.classList.toggle('is-placeholder', !sel.value);
      wrap.querySelectorAll('.cm-sel__opt').forEach(o => {
        const on = !!sel.value && o.dataset.value === sel.value;
        o.classList.toggle('is-on', on);
        o.setAttribute('aria-selected', String(on));
      });
    } else if (wrap.classList.contains('cm-keys')) {
      wrap.querySelectorAll('.cm-opt').forEach(b => {
        const on = b.dataset.value === sel.value;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }
  }

  function _makeSelect(sel) {
    const wrap = document.createElement('div');
    wrap.className = 'cm-sel is-placeholder';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cm-sel__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `<span class="cm-sel__display"></span><span class="cm-sel__arrow">${icon('chevron-down', { size: 16 })}</span>`;

    const list = document.createElement('div');
    list.className = 'cm-sel__list';
    list.setAttribute('role', 'listbox');

    [...sel.options].forEach(opt => {
      if (!opt.value) return;
      const item = document.createElement('div');
      item.className = 'cm-sel__opt';
      item.setAttribute('role', 'option');
      item.dataset.value = opt.value;
      item.textContent = opt.text;
      item.addEventListener('click', e => {
        e.stopPropagation();
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        _closeAllSelects();
        trigger.focus();
      });
      list.appendChild(item);
    });

    wrap.appendChild(trigger);
    wrap.appendChild(list);

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = wrap.classList.contains('cm-sel--open');
      _closeAllSelects();
      if (!wasOpen) _openSelect(wrap, trigger, list);
    });
    trigger.addEventListener('keydown', e => {
      const open = wrap.classList.contains('cm-sel--open');
      const opts = [...list.querySelectorAll('.cm-sel__opt')];
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !open) {
        e.preventDefault();
        _openSelect(wrap, trigger, list);
        return;
      }
      if (!open) return;
      let cur = opts.findIndex(o => o.classList.contains('is-active'));
      if (e.key === 'ArrowDown') cur = Math.min(opts.length - 1, cur + 1);
      else if (e.key === 'ArrowUp') cur = Math.max(0, cur - 1);
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (cur >= 0) opts[cur].click();
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        _closeAllSelects();
        return;
      } else return;
      e.preventDefault();
      opts.forEach(o => o.classList.remove('is-active'));
      opts[cur].classList.add('is-active');
      opts[cur].scrollIntoView({ block: 'nearest' });
    });

    sel.style.display = 'none';
    sel.parentNode.insertBefore(wrap, sel);
    _selSync(sel);
  }

  /* Fixed-position the list off the trigger's viewport rect so it escapes
     clipping by the scrollable modal body. Flips upward if there's no
     room below. */
  function _openSelect(wrap, trigger, list) {
    wrap.classList.add('cm-sel--open');
    trigger.setAttribute('aria-expanded', 'true');
    const rect   = trigger.getBoundingClientRect();
    const maxH   = 232;
    const below  = window.innerHeight - rect.bottom;
    const openUp = below < maxH + 8 && rect.top > below;
    list.style.left  = rect.left + 'px';
    list.style.width = rect.width + 'px';
    if (openUp) {
      list.style.top    = 'auto';
      list.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    } else {
      list.style.bottom = 'auto';
      list.style.top    = (rect.bottom + 6) + 'px';
    }
    list.querySelectorAll('.is-active').forEach(o => o.classList.remove('is-active'));
    list.querySelector('.is-on')?.scrollIntoView({ block: 'nearest' });
  }

  function _closeAllSelects() {
    document.querySelectorAll('.cm-sel--open').forEach(w => {
      w.classList.remove('cm-sel--open');
      w.querySelector('.cm-sel__trigger')?.setAttribute('aria-expanded', 'false');
    });
  }

  function _makeKeys(sel) {
    const grp = document.createElement('div');
    grp.className = 'cm-keys';
    grp.dataset.for = sel.id;
    grp.setAttribute('role', 'group');
    [...sel.options].forEach(opt => {
      if (!opt.value) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cm-opt';
      b.dataset.value = opt.value;
      b.textContent = opt.dataset.label || opt.text;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        // Pressing the lit key again lets go of it (the optional level
        // needs that; for the required fields it just shows them empty).
        sel.value = sel.value === opt.value ? '' : opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      grp.appendChild(b);
    });
    sel.style.display = 'none';
    sel.parentNode.insertBefore(grp, sel);
    _selSync(sel);
  }

  // Scrolling INSIDE an open list also fires a native 'scroll' event —
  // since it's captured (not bubbled), a plain document-level capture
  // listener can't tell that apart from the page/modal scrolling
  // underneath it, and would close the list the instant you tried to
  // scroll through its options. Ignore scrolls whose target is the list
  // itself; only page/ancestor scrolls should close it.
  function _onDocumentScroll(e) {
    if (e.target?.closest && e.target.closest('.cm-sel__list')) return;
    _closeAllSelects();
  }

  function _initCustomControls() {
    document.querySelectorAll('.cm select[data-ui="dropdown"]').forEach(_makeSelect);
    document.querySelectorAll('.cm select[data-ui="keys"]').forEach(_makeKeys);
    document.querySelectorAll('.cm select').forEach(sel => sel.addEventListener('change', () => { _selSync(sel); updatePreview(); }));
    if (!_controlsWired) {
      _controlsWired = true;
      document.addEventListener('click', _closeAllSelects);
      document.addEventListener('scroll', _onDocumentScroll, true);
    }
  }

  const FIELD_IDS = ['classMaterieInput', 'classOraInput', 'classMaxEleviInput', 'classGradeInput', 'classMathLevelInput'];

  function createModalHTML() {
    const step = (n, title, inner, field) => `
      <section class="cm-step" data-step="${n}">
        <h3 class="cm-step__h"><span class="cm-step__n">${n}</span>${title}</h3>
        ${inner}
      </section>`;
    const fld = (key, label, inner, hint = '') => `
      <div class="cm-field" data-field="${key}">
        <span class="cm-label" id="cmL-${key}">${label}</span>
        ${inner}
        ${hint ? `<span class="cm-hint">${hint}</span>` : ''}
      </div>`;
    return `
      <div class="cm" id="classesModal" style="display:none" role="dialog" aria-modal="true" aria-labelledby="cmTitle">
        <div class="cm__backdrop" id="classesModalBackdrop"></div>
        <div class="cm__dialog">
          <header class="cm__head">
            <h2 class="cm__title" id="cmTitle">Creează o clasă</h2>
            <button type="button" class="cm__x" id="closeModalBtn" aria-label="Închide">${icon('x', { size: 18 })}</button>
          </header>

          <div class="cm__body">
            <div class="cm__form">
              ${step(1, 'Materie', fld('materie', 'Ce predai în această grupă?', `
                <select id="classMaterieInput" data-ui="dropdown" aria-labelledby="cmL-materie">
                  <option value="">Selectează materia</option>
                  <option value="Matematică">Matematică</option>
                  <option value="Limba Română">Limba Română</option>
                  <option value="Istorie">Istorie</option>
                  <option value="Geografie">Geografie</option>
                  <option value="Chimie">Chimie</option>
                  <option value="Limba Engleză">Limba Engleză</option>
                  <option value="Biologie">Biologie</option>
                </select>`))}

              ${step(2, 'Program', `
                ${fld('zi', 'Ziua lecției', `
                  <div class="cm-days" id="classZiuaPicker" role="group" aria-labelledby="cmL-zi">
                    ${DAY_ORDER.map(d => `<button type="button" class="cm-day" data-day="${d}" aria-pressed="false" aria-label="${d}" title="${d}">${DAY_SHORT[d]}</button>`).join('')}
                  </div>`, 'Poți alege 2 zile dacă grupa are lecții de două ori pe săptămână.')}
                <div class="cm-row">
                  ${fld('ora', 'Ora', `
                    <select id="classOraInput" data-ui="dropdown" aria-labelledby="cmL-ora">
                      <option value="">Alege ora</option>
                      ${buildTimeOptions()}
                    </select>`)}
                  ${fld('tip', 'Tip lecție', `
                    <div class="cm-keys cm-keys--2" id="classTipPicker" role="group" aria-labelledby="cmL-tip">
                      <button type="button" class="cm-opt cm-opt--ico" data-tip="online" aria-pressed="false">${icon('monitor', { size: 16 })} Online</button>
                      <button type="button" class="cm-opt cm-opt--ico" data-tip="offline" aria-pressed="false">${icon('school', { size: 16 })} Offline</button>
                    </div>`)}
                </div>`)}

              ${step(3, 'Grupa', `
                ${fld('max', 'Număr maxim de elevi', `
                  <select id="classMaxEleviInput" data-ui="keys" aria-labelledby="cmL-max">
                    <option value="">Număr</option>
                    <option value="1" data-label="1">1</option>
                    <option value="2" data-label="2">2</option>
                    <option value="3" data-label="3">3</option>
                    <option value="4" data-label="4">4</option>
                    <option value="5" data-label="5">5</option>
                    <option value="6" data-label="6">6</option>
                  </select>`, '1 înseamnă lecție individuală.')}
                <div class="cm-row cm-row--grade">
                  ${fld('grade', 'Clasa elevilor', `
                    <select id="classGradeInput" data-ui="keys" aria-labelledby="cmL-grade">
                      <option value="">Clasa</option>
                      ${[5, 6, 7, 8, 9, 10, 11, 12].map(n => `<option value="a ${n}-a" data-label="${n}">a ${n}-a</option>`).join('')}
                    </select>`)}
                  ${fld('level', 'Nivel matematică <em>(opțional)</em>', `
                    <select id="classMathLevelInput" data-ui="keys" aria-labelledby="cmL-level">
                      <option value="">Nivel</option>
                      ${['5-6', '6-7', '7-8', '9-10'].map(v => `<option value="${v}">${v}</option>`).join('')}
                    </select>`)}
                </div>`)}
            </div>

            <aside class="cm__preview" aria-label="Previzualizare">
              <div class="cm-lcd">
                <span class="cm-lcd__kicker">Previzualizare</span>
                <div class="cm-lcd__subject" id="cmSubj"></div>
                <div class="cm-lcd__when">
                  <span class="cm-lcd__days" id="cmDays"></span>
                  <span class="cm-lcd__time" id="cmTime"></span>
                </div>
                <div class="cm-lcd__seats">
                  <span class="cm-slots" id="cmSlots" aria-hidden="true"></span>
                  <span id="cmSeatsTxt"></span>
                </div>
                <div class="cm-lcd__tags" id="cmTags"></div>
              </div>
              <div class="cm-name">
                <span>Denumire salvată</span>
                <b id="classNamePreview">Încă necompletată</b>
              </div>
              <div class="cm-progress" aria-live="polite">
                <span class="cm-progress__segs" id="cmSegs" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
                <span class="cm-progress__txt" id="cmProgTxt">0 din 6 completate</span>
              </div>
            </aside>
          </div>

          <footer class="cm__foot">
            <button type="button" class="cl-key" id="cancelCreateBtn">Anulează</button>
            <button type="button" class="cl-key cl-key--primary" id="confirmCreateBtn">${icon('plus', { size: 16 })} Creează clasa</button>
          </footer>
        </div>
      </div>
    `;
  }

  // Reads selection straight off the keys' DOM state rather than keeping a
  // parallel JS array — the day picker has no hidden <select>, this *is*
  // its source of truth. Always returned in weekday order regardless of
  // click order, so "Marți/Joi" never renders as "Joi/Marți".
  function _getSelectedDays() {
    const picker = document.getElementById('classZiuaPicker');
    if (!picker) return [];
    const selected = [...picker.querySelectorAll('.cm-day.is-on')].map(b => b.dataset.day);
    return DAY_ORDER.filter(d => selected.includes(d));
  }

  function _getSelectedTip() {
    return document.getElementById('classTipPicker')?.querySelector('.cm-opt.is-on')?.dataset.tip || '';
  }

  function buildGeneratedName() {
    const mat = document.getElementById('classMaterieInput')?.value || '';
    const zi  = _getSelectedDays().join('/');
    const ora = document.getElementById('classOraInput')?.value || '';
    if (!mat && !zi && !ora) return 'Încă necompletată';
    const parts = [mat, zi, ora].filter(Boolean);
    return parts.join(' · ');
  }

  // Which required fields still have no answer, in the order they sit.
  function _missingFields() {
    const val = id => document.getElementById(id)?.value || '';
    const miss = [];
    if (!val('classMaterieInput')) miss.push('materie');
    if (!_getSelectedDays().length) miss.push('zi');
    if (!val('classOraInput')) miss.push('ora');
    if (!_getSelectedTip()) miss.push('tip');
    if (!val('classMaxEleviInput')) miss.push('max');
    if (!val('classGradeInput')) miss.push('grade');
    return miss;
  }

  // A preview line refreshes with a short blink, like a display updating.
  function _setLine(el, text, isTime) {
    if (!el || el.dataset.v === text) return;
    el.dataset.v = text;
    if (isTime) el.innerHTML = _timeHTML(text); else el.textContent = text;
    if (reduced) return;
    el.classList.remove('cm-tick');
    void el.offsetWidth;
    el.classList.add('cm-tick');
  }

  function updatePreview() {
    const val = id => document.getElementById(id)?.value || '';
    const days = _getSelectedDays();
    const tip = _getSelectedTip();
    const max = parseInt(val('classMaxEleviInput'), 10) || 0;
    const grade = val('classGradeInput');
    const level = val('classMathLevelInput');

    const subj = document.getElementById('cmSubj');
    _setLine(subj, val('classMaterieInput') || 'Materia');
    subj?.classList.toggle('is-empty', !val('classMaterieInput'));
    const daysEl = document.getElementById('cmDays');
    _setLine(daysEl, days.length ? days.map(d => DAY_SHORT[d]).join(' · ') : 'Ziua');
    daysEl?.classList.toggle('is-empty', !days.length);
    const timeEl = document.getElementById('cmTime');
    _setLine(timeEl, val('classOraInput') || '00:00', true);
    timeEl?.classList.toggle('is-empty', !val('classOraInput'));

    const slots = document.getElementById('cmSlots');
    if (slots) {
      const n = max || 6;
      if (slots.children.length !== n || slots.dataset.set !== String(!!max)) {
        slots.innerHTML = '<i></i>'.repeat(n);
        slots.dataset.set = String(!!max);
      }
      slots.classList.toggle('is-empty', !max);
    }
    _setLine(document.getElementById('cmSeatsTxt'), max ? (max === 1 ? 'lecție individuală' : `${max} locuri`) : 'locuri');

    const tags = [tip === 'online' ? 'Online' : tip === 'offline' ? 'Offline' : '', grade ? `Clasa ${grade}` : '', level ? `Nivel ${level}` : ''].filter(Boolean);
    const tagsEl = document.getElementById('cmTags');
    if (tagsEl) tagsEl.innerHTML = tags.length ? tags.map(t => `<span>${BM.esc(t)}</span>`).join('') : '<span class="is-empty">tip · clasă</span>';

    const nameEl = document.getElementById('classNamePreview');
    if (nameEl) nameEl.textContent = buildGeneratedName();

    const missing = _missingFields();
    const done = 6 - missing.length;
    document.querySelectorAll('#cmSegs i').forEach((s, i) => s.classList.toggle('on', i < done));
    const pt = document.getElementById('cmProgTxt');
    if (pt) pt.textContent = done === 6 ? 'Gata de creat' : `${done} din 6 completate`;
    document.querySelectorAll('.cm-field').forEach(f => {
      const isMissing = missing.includes(f.dataset.field);
      if (!isMissing) f.classList.remove('cm-field--missing');
    });
    document.querySelectorAll('.cm-step').forEach(s => {
      const fields = [...s.querySelectorAll('.cm-field')].map(f => f.dataset.field).filter(k => k !== 'level');
      s.classList.toggle('is-done', fields.every(k => !missing.includes(k)));
    });
  }

  function _wireDayPicker() {
    const picker = document.getElementById('classZiuaPicker');
    if (!picker || picker._wired) return;
    picker._wired = true;
    picker.querySelectorAll('.cm-day').forEach(chip => {
      chip.addEventListener('click', () => {
        const isSelected = chip.classList.contains('is-on');
        const selectedCount = picker.querySelectorAll('.cm-day.is-on').length;
        if (!isSelected && selectedCount >= 2) {
          BM.toast('Poți selecta cel mult 2 zile pe săptămână.', 'info');
          return;
        }
        chip.classList.toggle('is-on');
        chip.setAttribute('aria-pressed', String(!isSelected));
        updatePreview();
      });
    });
  }

  // Single-select, unlike the day picker — a lesson is either online or
  // offline, never both.
  function _wireTipPicker() {
    const picker = document.getElementById('classTipPicker');
    if (!picker || picker._wired) return;
    picker._wired = true;
    picker.querySelectorAll('.cm-opt').forEach(chip => {
      chip.addEventListener('click', () => {
        const already = chip.classList.contains('is-on');
        picker.querySelectorAll('.cm-opt').forEach(c => { c.classList.remove('is-on'); c.setAttribute('aria-pressed', 'false'); });
        if (!already) { chip.classList.add('is-on'); chip.setAttribute('aria-pressed', 'true'); }
        updatePreview();
      });
    });
  }

  let _modalReturnFocus = null;
  function _onModalKey(e) {
    if (e.key === 'Escape') closeCreateModal();
    else trapTab(e, document.querySelector('#classesModal .cm__dialog'));
  }

  function openCreateModal() {
    const modal = document.getElementById('classesModal');
    if (!modal) return;
    _modalReturnFocus = document.activeElement;
    modal.style.display = 'flex';
    modal.classList.remove('is-closing');
    /* Fără asta, body-ul rămâne scrollabil sub modalul fixed — pe mobil,
       scroll-ul pe pagina din spate face ca header-ul modalului (fixed)
       să iasă din ecran când bara de adresă a browserului se ascunde/arată. */
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.getElementById('closeModalBtn').onclick         = closeCreateModal;
    document.getElementById('cancelCreateBtn').onclick       = closeCreateModal;
    document.getElementById('classesModalBackdrop').onclick  = closeCreateModal;
    document.getElementById('confirmCreateBtn').onclick      = confirmCreateClass;
    document.addEventListener('keydown', _onModalKey);
    _wireDayPicker();
    _wireTipPicker();
    updatePreview();
    modal.querySelector('.cm-sel__trigger')?.focus({ preventScroll: true });
  }

  function _resetModal() {
    FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; _selSync(el); }
    });
    document.querySelectorAll('#classZiuaPicker .cm-day.is-on, #classTipPicker .cm-opt.is-on')
      .forEach(c => { c.classList.remove('is-on'); c.setAttribute('aria-pressed', 'false'); });
    document.querySelectorAll('.cm-field--missing').forEach(f => f.classList.remove('cm-field--missing'));
    updatePreview();
    _closeAllSelects();
  }

  function closeCreateModal() {
    const modal = document.getElementById('classesModal');
    if (!modal || modal.style.display === 'none') return;
    document.removeEventListener('keydown', _onModalKey);
    _closeAllSelects();
    const done = () => {
      modal.style.display = 'none';
      modal.classList.remove('is-closing');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      _resetModal();
      if (_modalReturnFocus && document.contains(_modalReturnFocus)) _modalReturnFocus.focus({ preventScroll: true });
    };
    if (reduced) { done(); return; }
    modal.classList.add('is-closing');
    setTimeout(done, 170);
  }

  async function confirmCreateClass() {
    const name         = buildGeneratedName();
    const materie      = document.getElementById('classMaterieInput')?.value;
    const selectedDays = _getSelectedDays();
    const ziua         = selectedDays.join('/');
    const ora          = document.getElementById('classOraInput')?.value;
    const tip       = _getSelectedTip();
    const maxElevi  = document.getElementById('classMaxEleviInput')?.value;
    const grade     = document.getElementById('classGradeInput')?.value;
    const mathLevel = document.getElementById('classMathLevelInput')?.value;

    const missing = _missingFields();
    if (missing.length) {
      // Name the first thing that is missing, and mark every empty field.
      const msg = {
        materie: 'Selectează materia.',
        zi: 'Selectează ziua (cel puțin una).',
        ora: 'Selectează ora.',
        tip: 'Selectează tipul lecției (online sau offline).',
        max: 'Selectează numărul maxim de elevi.',
        grade: 'Selectează clasa elevilor.'
      };
      document.querySelectorAll('.cm-field').forEach(f => f.classList.toggle('cm-field--missing', missing.includes(f.dataset.field)));
      document.querySelector('.cm-field--missing')?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      BM.toast(msg[missing[0]], 'error');
      return;
    }

    const btn = document.getElementById('confirmCreateBtn');
    const btnHtml = btn.innerHTML;
    btn.disabled    = true;
    btn.textContent = 'Se creează…';
    const restore = () => { btn.disabled = false; btn.innerHTML = btnHtml; };

    let inviteCode = generateInviteCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { error } = await BMAuth.supabase
          .from('classes')
          .insert({
            name,
            teacher_id:    BMAuth.user.id,
            teacher_name:  BMAuth.displayName(),
            invite_code:   inviteCode,
            max_students:  parseInt(maxElevi, 10),
            school_grade:  grade,
            math_level:    mathLevel || null,
            // ISO weekday numbering (1=Luni…7=Duminică) — the structured
            // counterpart of `name`'s "Materie · Zi[/Zi2] · Oră" text, used
            // by the Sumar tab's "next lesson" calc. `name` itself is never
            // parsed for this again after the one-time backfill migration.
            schedule_days: selectedDays.map(d => DAY_ORDER.indexOf(d) + 1),
            schedule_time: ora,
            lesson_type:   tip
          });

        if (!error) {
          closeCreateModal();
          restore();
          BM.toast('Clasa a fost creată! Cod: ' + inviteCode, 'success');
          _freshCode = inviteCode;
          try { sessionStorage.removeItem(_teacherCacheKey()); } catch {}
          renderTeacherView();
          return;
        }
        if (error.code === '23505') {
          inviteCode = generateInviteCode();
        } else {
          throw error;
        }
      } catch (e) {
        BM.toast('Eroare: ' + e.message, 'error');
        restore();
        return;
      }
    }

    BM.toast('Nu s-a putut genera un cod unic. Încearcă din nou.', 'error');
    restore();
  }

  async function deleteClass(classId, className) {
    const ok = await showConfirm({
      icon:        icon('trash-2', { size: 32 }),
      danger:      true,
      title:       'Ștergi clasa „' + BM.esc(className) + '"?',
      message:     'Această acțiune este ireversibilă. Toți elevii înscriși vor fi scoși din clasă.',
      confirmText: 'Șterge clasa'
    });
    if (!ok) return;
    try {
      const { error } = await BMAuth.supabase
        .from('classes')
        .delete()
        .eq('id', classId)
        .eq('teacher_id', BMAuth.user.id);
      if (error) throw error;
      BM.toast('Clasa a fost ștearsă.', 'info');
      try { sessionStorage.removeItem(_teacherCacheKey()); } catch {}
      // The row slides out before the register closes the gap.
      const row = document.querySelector(`.cl-block[data-id="${classId}"]`);
      if (row && !reduced) {
        row.classList.add('cl-block--leaving');
        await new Promise(r => setTimeout(r, 300));
      }
      renderTeacherView();
    } catch (e) {
      BM.toast('Eroare la ștergere: ' + e.message, 'error');
    }
  }

  // Resolves true only when the code really reached the clipboard.
  window._copyCode = function (code) {
    const done = navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject();
    return done
      .then(() => { BM.toast('Codul ' + code + ' a fost copiat!', 'success'); return true; })
      .catch(() => { BM.toast('Codul este: ' + code, 'info'); return false; });
  };

  /* ═══════════════════════════════════════════════════════════════
     STUDENT VIEW
  ═══════════════════════════════════════════════════════════════ */
  function _studentCacheKey() { return 'bm_cls_s_' + BMAuth.user.id; }

  // The next lesson across all the student's groups: the soonest
  // upcoming (day, hour) of any of them.
  function _nextLesson(classes) {
    const now = new Date();
    const todayIso = ((now.getDay() + 6) % 7) + 1;
    let best = null;
    classes.forEach(c => {
      const info = _classInfo(c);
      const t = info.time.match(/^(\d{1,2}):(\d{2})/);
      if (!t || !info.days.length) return;
      info.days.forEach(dayName => {
        const d = DAY_ORDER.indexOf(dayName) + 1;
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((d - todayIso + 7) % 7), +t[1], +t[2]);
        if (at <= now) at.setDate(at.getDate() + 7);
        if (!best || at < best.at) best = { at, dayName, time: info.time, cls: c };
      });
    });
    if (!best) return null;
    const days = Math.round((new Date(best.at.getFullYear(), best.at.getMonth(), best.at.getDate()) -
      new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    return { time: best.time, at: best.at, cls: best.cls, when: days === 0 ? 'azi' : days === 1 ? 'mâine' : DAY_SHORT[best.dayName] };
  }

  function _applyStudentUI(classes) {
    const teachers = new Set(classes.map(c => c.teacher_name).filter(Boolean)).size;
    const next = _nextLesson(classes);
    setRootContent(`
      <div class="${pageClass()}">
        <header class="cl-head">
          ${headInfoHTML('Introdu codul primit de la profesor și vezi grupele la care participi.')}
        </header>

        ${classes.length ? todayHTML(classes, 'elev', null) : ''}

        <section class="cl-join" aria-labelledby="clJoinTitle">
          <div class="cl-join__icon">${icon('key', { size: 24 })}</div>
          <div class="cl-join__txt">
            <h2 id="clJoinTitle">Alătură-te unei clase</h2>
            <p>Codul are 6 caractere, litere și cifre.</p>
          </div>
          <div class="cl-join__row">
            <input type="text" id="inviteCodeInput" class="cl-codeinput"
                   placeholder="ABC123" maxlength="6" autocomplete="off" autocapitalize="characters"
                   spellcheck="false" aria-label="Cod de invitație"
                   oninput="this.value = this.value.toUpperCase()">
            <button type="button" class="cl-key cl-key--primary" id="joinClassBtn">Alătură-te</button>
          </div>
        </section>

        ${classes.length ? statusHTML('Clasele tale', [
          { lbl: 'Clase înscrise', tick: classes.length },
          { lbl: 'Profesori', tick: teachers },
          next ? { lbl: 'Următoarea lecție', val: _timeHTML(next.time), unit: next.when } : { lbl: 'Următoarea lecție', val: '-' }
        ]) : ''}

        ${classes.length === 0 ? studentEmpty() : `
          <ol class="cl-blocks" id="classesGrid" aria-label="Clasele în care ești înscris">
            ${classes.map((c, i) => studentBlock(c, i)).join('')}
          </ol>`}
      </div>
    `);
    const joinBtn   = document.getElementById('joinClassBtn');
    const codeInput = document.getElementById('inviteCodeInput');
    joinBtn?.addEventListener('click', joinClass);
    codeInput?.addEventListener('keydown', e => { if (e.key === 'Enter') joinClass(); });
    document.querySelectorAll('.cl-block__leave').forEach(btn => {
      btn.addEventListener('click', () => leaveClass(btn.dataset.id, btn.dataset.name));
    });
    if (classes.length) startTodayTicker();
    runStatus();
    _painted = true;
  }

  async function renderStudentView() {
    /* Show cached content immediately if available */
    let hasCached = false;
    try {
      const cached = JSON.parse(sessionStorage.getItem(_studentCacheKey()) || 'null');
      if (cached) { hasCached = true; _applyStudentUI(cached.classes); }
    } catch {}
    if (!hasCached) setRootContent(loadingHTML());

    let classes = [];
    try {
      const { data, error } = await BMAuth.supabase
        .from('class_members')
        .select(`joined_at, classes ( id, name, description, teacher_name, created_at, school_grade, schedule_days, schedule_time, lesson_type )`)
        .eq('student_id', BMAuth.user.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      classes = (data || []).filter(row => row.classes).map(row => ({ ...row.classes, joined_at: row.joined_at }));
    } catch (e) {
      BM.toast('Eroare la încărcarea claselor: ' + e.message, 'error');
    }

    try { sessionStorage.setItem(_studentCacheKey(), JSON.stringify({ classes })); } catch {}
    _applyStudentUI(classes);
  }

  function studentEmpty() {
    return `
      <section class="cl-sheet cl-sheet--empty" aria-label="Clasele în care ești înscris">
        <div class="cl-ghosts" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="cl-empty">
          <div class="cl-empty__icon">${icon('library', { size: 24 })}</div>
          <h2>Nicio clasă înscrisă</h2>
          <p>Introdu codul de invitație de mai sus pentru a te alătura primei clase.</p>
        </div>
      </section>
    `;
  }

  function studentBlock(cls, idx) {
    const info = _classInfo(cls);
    const sub = [info.grade, info.type].filter(Boolean);
    const next = _nextLesson([cls]);
    const since = Math.max(0, Math.floor((Date.now() - new Date(cls.joined_at)) / 86400000));
    return `
      <li class="cl-block" style="--i:${idx}" data-id="${cls.id}">
        <div class="cl-block__top">
          <span class="cl-block__no">${String(idx + 1).padStart(2, '0')}</span>
          <div class="cl-block__title">
            <a class="cl-block__link" href="class.html?id=${cls.id}">${BM.esc(info.subject)}${icon('chevron-right', { size: 18 })}</a>
            ${sub.length ? `<span class="cl-block__sub">${sub.map(t => `<span>${BM.esc(t)}</span>`).join('')}</span>` : ''}
            ${cls.description ? `<span class="cl-block__desc">${BM.esc(cls.description)}</span>` : ''}
          </div>
          <button type="button" class="cl-block__leave" data-id="${cls.id}" data-name="${BM.esc(cls.name)}">Ieși din clasă</button>
        </div>

        <div class="cl-block__meta">
          <div class="cl-field">
            <span class="cl-field__k">Program</span>
            <span class="cl-field__v">
              <span>${info.days.length ? _shortDays(info.days) : '-'}</span>
              ${info.time ? `<span class="cl-time">${_timeHTML(info.time)}</span>` : ''}
            </span>
          </div>
          <div class="cl-field">
            <span class="cl-field__k">Profesor</span>
            <span class="cl-field__v">${BM.esc(cls.teacher_name || '-')}</span>
          </div>
        </div>

        <div class="cl-lcd" role="group" aria-label="Cifrele grupei" style="--cols:2">
          <div class="cl-lcd__cell">
            <span class="cl-lcd__k">Următoarea lecție</span>
            <span class="cl-lcd__v">${next ? `${_timeHTML(next.time)}<span class="cl-lcd__u">${next.when}</span>` : '-'}</span>
          </div>
          <div class="cl-lcd__cell">
            <span class="cl-lcd__k">Înscris de</span>
            <span class="cl-lcd__v">${since}<span class="cl-lcd__u">${since === 1 ? 'zi' : 'zile'}</span></span>
          </div>
        </div>
      </li>
    `;
  }

  async function joinClass() {
    const input = document.getElementById('inviteCodeInput');
    const code  = input?.value.trim().toUpperCase();

    if (!code || code.length !== 6) {
      BM.toast('Introdu un cod valid de 6 caractere.', 'error');
      input?.focus();
      const join = document.querySelector('.cl-join');
      if (join && !reduced) { join.classList.remove('cl-shake'); void join.offsetWidth; join.classList.add('cl-shake'); }
      return;
    }

    const btn = document.getElementById('joinClassBtn');
    btn.disabled    = true;
    btn.textContent = 'Se verifică…';
    const reset = () => { btn.disabled = false; btn.textContent = 'Alătură-te'; };

    try {
      const { data: found, error: findErr } = await BMAuth.supabase
        .from('classes')
        .select('id, name, teacher_id')
        .eq('invite_code', code)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!found) {
        BM.toast('Cod de invitație invalid. Verifică și încearcă din nou.', 'error');
        reset();
        return;
      }
      if (found.teacher_id === BMAuth.user.id) {
        BM.toast('Nu te poți înscrie în propria clasă.', 'error');
        reset();
        return;
      }

      const { error: joinErr } = await BMAuth.supabase
        .from('class_members')
        .insert({ class_id: found.id, student_id: BMAuth.user.id, student_name: BMAuth.displayName() });

      if (joinErr) {
        if (joinErr.code === '23505') {
          BM.toast('Ești deja înscris în această clasă.', 'error');
        } else {
          throw joinErr;
        }
        reset();
        return;
      }

      BM.toast('Te-ai alăturat clasei „' + found.name + '"!', 'success');
      try { sessionStorage.removeItem(_studentCacheKey()); } catch {}
      renderStudentView();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
      reset();
    }
  }

  async function leaveClass(classId, className) {
    const ok = await showConfirm({
      title:       `Ieși din clasa „${BM.esc(className)}"?`,
      message:     'Nu vei mai avea acces la mesaje și teme. Te poți alătura din nou cu codul de invitație.',
      confirmText: 'Ieși din clasă',
      danger:      true,
      icon:        icon('log-out', { size: 32 })
    });
    if (!ok) return;
    try {
      const { error } = await BMAuth.supabase
        .from('class_members')
        .delete()
        .eq('class_id', classId)
        .eq('student_id', BMAuth.user.id);
      if (error) throw error;
      BM.toast('Ai ieșit din clasă.', 'info');
      try { sessionStorage.removeItem(_studentCacheKey()); } catch {}
      const row = document.querySelector(`.cl-block[data-id="${classId}"]`);
      if (row && !reduced) {
        row.classList.add('cl-block--leaving');
        await new Promise(r => setTimeout(r, 300));
      }
      renderStudentView();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
    }
  }

  /* ─── Bootstrap ─────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
