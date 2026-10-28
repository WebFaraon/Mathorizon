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
  // The teacher's groups from his register (js/classes-registry.js), or null when the account has no register linked.
  let _reg = null;

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
        const back = opener && document.contains(opener) ? opener : document.querySelector('#inviteCodeInput');
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

  /* the code from an invitation link (classes.html?cod=ABC123); only six letters or digits count */
  function _inviteCode() {
    try {
      const c = new URLSearchParams(location.search).get('cod');
      return c && /^[A-Za-z0-9]{6}$/.test(c) ? c.toUpperCase() : '';
    } catch (e) { return ''; }
  }

  function renderLoginPrompt() {
    setRootContent(`
      <div class="cl-page">
        <div class="cl-empty cl-empty--solo">
          <div class="cl-empty__icon">${icon('lock', { size: 24 })}</div>
          <h2>Autentificare necesară</h2>
          <p>${_inviteCode() ? 'Ai primit o invitație într-o clasă. Conectează-te sau creează un cont de elev, iar codul clasei te așteaptă.' : 'Trebuie să fii autentificat pentru a accesa clasele.'}</p>
          <a class="cl-key cl-key--primary" href="auth.html?from=${encodeURIComponent('classes.html' + location.search)}">Conectează-te</a>
        </div>
      </div>
    `);
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
  function _lessonState(time, end) {
    const [h, m] = time.split(':').map(Number);
    const at = new Date();
    at.setHours(h, m, 0, 0);
    const diff = Math.round((at - new Date()) / 60000);
    if (end && diff <= 0) {                                  // a register group knows when its lesson ends
      const [eh, em] = end.split(':').map(Number), to = new Date();
      to.setHours(eh, em, 0, 0);
      return to > new Date() ? { cls: 'now', text: 'în desfășurare' } : { cls: 'done', text: 'încheiată' };
    }
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
        const st = _lessonState(li.dataset.time, li.dataset.end);
        li.className = li.className.replace(/cl-lesson--(soon|now|done)/, 'cl-lesson--' + st.cls);
        const el = li.querySelector('.cl-lesson__state');
        if (el && el.textContent !== st.text) el.textContent = st.text;
      });
    }, 30000);
  }

  /* ═══════════════════════════════════════════════════════════════
     THE GROUPS OF THE REGISTER (teacher view)
     The register is the source: the groups, their students, schedule, cabinet and status are what the sync last read from it.
  ═══════════════════════════════════════════════════════════════ */
  const _hh = h => String(h).padStart(2, '0') + ':00';
  const _ro = (n, one, many) => `${n} ${n === 1 ? one : (n % 100 >= 1 && n % 100 <= 19 ? many : 'de ' + many)}`;
  const _gradeLabel = g => (g ? 'clasa a ' + g + '-a' : '');
  const ROM = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
  const _grade = g => (ROM[g] ? 'Clasa a ' + ROM[g] + '-a' : g ? 'Clasa ' + g : '');
  const _regDays = g => g.days.map(d => DAY_ORDER[d - 1]).filter(Boolean);

  function _regTodayLessons() {
    const today = ((new Date().getDay() + 6) % 7) + 1;
    return _reg.groups.filter(g => g.status.id !== 'inactiv' && g.days.includes(today) && g.start != null).sort((a, b) => a.start - b.start);
  }
  function _regNextLesson() {
    const today = ((new Date().getDay() + 6) % 7) + 1, live = _reg.groups.filter(g => g.status.id !== 'inactiv' && g.start != null && g.days.length);
    for (let k = 1; k <= 7; k++) {
      const day = ((today - 1 + k) % 7) + 1, hit = live.filter(g => g.days.includes(day)).sort((a, b) => a.start - b.start)[0];
      if (hit) return { day, g: hit };
    }
    return null;
  }

  function regTodayHTML() {
    const lessons = _regTodayLessons(), next = _regNextLesson();
    const nextText = next ? `Următoarea: ${DAY_ORDER[next.day - 1].toLowerCase()}, ${_hh(next.g.start)}, ${BM.esc(next.g.subject)}${next.g.grade ? ' (' + _gradeLabel(next.g.grade) + ')' : ''}.` : '';
    return `
      <section class="cl-today" aria-labelledby="clTodayT">
        <header class="cl-today__head">
          <h2 id="clTodayT"><i class="cl-today__led${lessons.length ? ' is-on' : ''}"></i>Lecțiile tale de azi</h2>
          <span class="cl-today__count">${lessons.length ? _ro(lessons.length, 'lecție', 'lecții') : 'nicio lecție'}</span>
        </header>
        ${lessons.length ? `
          <ol class="cl-today__list">
            ${lessons.map((g, i) => {
              const t0 = _hh(g.start), t1 = _hh(g.start + g.duration), st = _lessonState(t0, t1);
              const sub = [_grade(g.grade), g.mode ? (g.mode === 'online' ? 'Online' : 'Offline') : '', g.cab ? 'Cab. ' + g.cab : '', _ro(g.enrolled, 'elev', 'elevi')].filter(Boolean);
              return `
              <li class="cl-lesson cl-lesson--${st.cls}" style="--i:${i}" data-time="${t0}" data-end="${t1}">
                <a class="cl-lesson__link" href="${g.classId ? 'class.html?id=' + g.classId : '#rg-' + g.id}">
                  <span class="cl-lesson__time">${_timeHTML(t0)}</span>
                  <span class="cl-lesson__body"><b>${BM.esc(g.subject)}</b><span>${sub.map(BM.esc).join(' · ')}</span></span>
                  <span class="cl-lesson__state">${st.text}</span>
                  ${icon('chevron-down', { size: 18 })}
                </a>
              </li>`;
            }).join('')}
          </ol>` : `
          <div class="cl-today__empty"><b>Nu sunt lecții programate pentru azi.</b>${nextText ? `<span>${nextText}</span>` : ''}</div>`}
      </section>`;
  }

  /* One group of the register. The whole block opens the platform class (Sumar, Mesaje, Teme, Simulări, Catalog), where the students and their statuses are.
     Four rows and no boxes: when it meets (the time on a small display), what it is (subject, class, level, format, cabinet, as two plain lines), the week in seven keys,
     where it stands (Se completează, Startează, Activ) with how full it is. The invite code and the register are a quiet footer. */
  function regCardHTML(g, idx) {
    const days = _regDays(g), t0 = g.start != null ? _hh(g.start) : '', t1 = g.start != null ? _hh(g.start + g.duration) : '';
    const WK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const week = WK.map((l, i) => `<i class="${g.days.includes(i + 1) ? 'on' : ''}" title="${DAY_ORDER[i]}">${l}</i>`).join('');
    const what = [_grade(g.grade), g.level ? 'Nivel ' + g.level : '', g.profile].filter(Boolean).join(' · ');
    const where = [g.mode ? (g.mode === 'online' ? 'Online' : 'Offline') : '', g.cab ? 'Cab. ' + g.cab : (g.mode === 'online' ? '' : 'fără cabinet'), g.summer ? 'Vară' : ''].filter(Boolean).join(' · ');
    const segs = Math.min(g.size || 0, 12), lit = g.size ? Math.min(segs, Math.round(g.enrolled / g.size * segs)) : 0;
    let hint = '';
    if (g.status.id === 'completare' && g.need) hint = g.enrolled >= g.need ? 'Are destui elevi: pornește în curând.' : `Mai trebuie ${_ro(g.need - g.enrolled, 'elev', 'elevi')} ca să pornească (minim ${g.need}).`;
    else if (g.status.id === 'starteaza') hint = 'Are destui elevi: urmează ora de probă.';
    const href = g.classId ? `class.html?id=${g.classId}` : (g.url || '#');
    const ext = !g.classId && g.url ? ' target="_blank" rel="noopener"' : '';
    const label = `${g.subject}${g.grade ? ', ' + _grade(g.grade) : ''}${days.length ? ', ' + days.join(' și ') : ''}${t0 ? ', ora ' + t0 : ''}`;
    return `
      <li class="rg-card rg-card--${g.status.id}" id="rg-${g.id}" style="--i:${idx}" data-filter-row data-days="${days.join(',')}">
        <a class="rg-open" href="${BM.esc(href)}"${ext} aria-label="Deschide grupa: ${BM.esc(label)}">
          <span class="rg-head">
            <span class="rg-time" title="${t0 && t1 ? t0 + ' - ' + t1 : ''}">${t0 ? `<b>${_timeHTML(t0)}</b><small>${_timeHTML(t1)}</small>` : '<b>-</b>'}</span>
            <span class="rg-title">
              <b class="rg-name">${BM.esc(g.subject)}</b>
              ${what ? `<span class="rg-what">${BM.esc(what)}</span>` : ''}
              ${where ? `<span class="rg-where">${BM.esc(where)}</span>` : ''}
            </span>
          </span>
          <span class="rg-week" role="img" aria-label="Zilele: ${days.join(', ') || 'neprogramată'}">${week}</span>
          <span class="rg-state"${hint ? ` title="${BM.esc(hint)}"` : ''}>
            <span class="rg-status rg-status--${g.status.id}"><i aria-hidden="true"></i>${g.status.label}</span>
            <span class="rg-seats">${g.size ? segsHTML(lit, segs) : ''}<span class="rg-seats__n"><b>${g.enrolled}</b>${g.size ? `/${g.size}` : ''}<em> ${g.enrolled === 1 ? 'elev' : 'elevi'}</em></span></span>
          </span>
        </a>
        <span class="rg-foot">
          ${g.code ? `<span class="rg-code" title="Cod de invitație pentru elevi"><span>Cod</span><b>${BM.esc(g.code)}</b><button type="button" class="cl-mini" data-copy="${BM.esc(g.code)}" aria-label="Copiază codul ${BM.esc(g.code)}" title="Copiază codul"><span class="cl-mini__a">${icon('copy', { size: 14 })}</span><span class="cl-mini__b">${icon('check', { size: 14 })}</span></button></span>` : '<span></span>'}
          ${g.url ? `<a class="rg-link" href="${BM.esc(g.url)}" target="_blank" rel="noopener" title="Deschide fila grupei în registru" aria-label="Registrul grupei">${icon('book-open', { size: 16 })} Registru</a>` : ''}
        </span>
      </li>`;
  }

  function regSectionHTML() {
    const live = _reg.groups.filter(g => g.status.id !== 'inactiv').length, off = _reg.groups.length - live;
    return `
      <section class="cl-sect" aria-labelledby="clRegT">
        <header class="cl-sect__h">
          <h2 id="clRegT">Grupele din registru</h2>
          <span class="cl-sect__n">${_ro(live, 'grupă', 'grupe')}${off ? ` și ${off} inactive` : ''}${_reg.syncedAt ? ' · la zi cu registrul ' + relDate(_reg.syncedAt) : ''}</span>
        </header>
        <p class="cl-sect__sub">Programul și elevii vin din registrul tău; o schimbare de acolo apare aici în câteva secunde.</p>
        <ol class="rg-grid" id="regGrid" aria-label="Grupele din registru">${_reg.groups.map(regCardHTML).join('')}</ol>
      </section>`;
  }

  /* ═══════════════════════════════════════════════════════════════
     TEACHER VIEW
  ═══════════════════════════════════════════════════════════════ */
  function _teacherCacheKey() { return 'bm_cls_t_' + BMAuth.user.id; }

  function _applyTeacherUI(allClasses, memberCounts, aggStats) {
    const hasReg = !!(_reg && _reg.groups.length);
    /* the classes the database made for the register's groups are the cards above; here stay only the ones the teacher made by hand */
    const classes = hasReg ? allClasses.filter(c => !c.reg_group_id) : allClasses;
    const has = classes.length > 0 || hasReg;
    setRootContent(`
      <div class="${pageClass()}">
        <header class="cl-head">
          ${headInfoHTML('Grupele tale, cu programul și elevii lor. Apasă pe o grupă ca să intri în clasa ei.')}
        </header>
        <div id="clReqRoot"></div>
        ${hasReg ? regTodayHTML() : has ? todayHTML(classes, 'profesor', memberCounts) : ''}
        ${hasReg ? statusHTML('Toate grupele', [
          { lbl: 'Grupe', tick: _reg.stats.groups },
          { lbl: 'Elevi activi', tick: _reg.stats.students },
          { lbl: 'Lecții ținute', tick: _reg.stats.lessons },
          _reg.stats.rate != null ? { lbl: 'Prezență medie', tick: _reg.stats.rate, suffix: '%' } : { lbl: 'Prezență medie', val: '-' },
          _reg.stats.perLesson != null ? { lbl: 'Elevi pe oră', tick: _reg.stats.perLesson, dec: 1 } : { lbl: 'Elevi pe oră', val: '-' }
        ]) : has && aggStats ? statusHTML('Toate grupele', [
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
        ${has ? _dayFilterHTML() : ''}
        ${has ? `<div class="cl-bar" id="clBar" hidden></div>` : ''}
        ${hasReg ? regSectionHTML() : ''}
        ${hasReg ? `
          ${classes.length ? `
          <section class="cl-sect cl-sect--platform" aria-labelledby="clOrphT">
            <header class="cl-sect__h"><h2 id="clOrphT">Clase fără grupă în registru</h2><span class="cl-sect__n">${_ro(classes.length, 'clasă', 'clase')}</span></header>
            <p class="cl-sect__sub">Grupa acestor clase nu mai există în registrul tău (fila a fost ștearsă sau înlocuită). Elevii lor le văd în continuare. Dacă grupa e încă activă, cere administratorului să o refacă în registru.</p>
            <ol class="cl-blocks" id="classesGrid" aria-label="Clase fără grupă în registru">
              ${classes.map((c, i) => teacherBlock(c, memberCounts[c.id] || 0, i, aggStats && aggStats.perClass && aggStats.perClass[c.id])).join('')}
            </ol>
          </section>` : ''}
          <div class="cl-empty cl-empty--solo cl-empty--panel" id="classesFilterEmpty" hidden>
            <div class="cl-empty__icon">${icon('search-x', { size: 24 })}</div>
            <h2>Nicio grupă în ziua selectată</h2>
            <p>Încearcă altă zi sau șterge filtrul.</p>
          </div>` : has ? `
          <ol class="cl-blocks" id="classesGrid" aria-label="Clasele tale">
            ${classes.map((c, i) => teacherBlock(c, memberCounts[c.id] || 0, i, aggStats && aggStats.perClass && aggStats.perClass[c.id])).join('')}
          </ol>
          <div class="cl-empty cl-empty--solo cl-empty--panel" id="classesFilterEmpty" hidden>
            <div class="cl-empty__icon">${icon('search-x', { size: 24 })}</div>
            <h2>Nicio clasă în ziua selectată</h2>
            <p>Încearcă altă zi sau șterge filtrul.</p>
          </div>` : teacherEmpty()}
      </div>
    `);
    _wireCopyKeys();
    if (has) { _wireDayFilter(); _applyDayFilter(); startTodayTicker(); }
    runStatus();
    _painted = true;
  }

  /* ── Day-of-week filter: the seven days as keys in a row, always in view (no panel to open). A key pressed shows only the groups that meet that day;
     several keys add up. Today's key carries a small dot. */
  let _clearDayFilter = () => {};
  function _dayFilterHTML() {
    const today = DAY_ORDER[((new Date().getDay() + 6) % 7)];
    return `
      <div class="cl-days" id="clsDayFilter" role="group" aria-label="Arată grupele după zi">
        <span class="cl-days__k">Zilele</span>
        <span class="cl-days__keys">
          ${DAY_ORDER.map(d => `<button type="button" class="cl-chip${_dayFilterSelected.includes(d) ? ' is-on' : ''}${d === today ? ' cl-chip--today' : ''}" data-day="${d}" aria-pressed="${_dayFilterSelected.includes(d)}" aria-label="${d}${d === today ? ' (azi)' : ''}" title="${d}${d === today ? ', azi' : ''}">${DAY_SHORT[d]}</button>`).join('')}
        </span>
      </div>`;
  }

  function _wireDayFilter() {
    const wrap = document.getElementById('clsDayFilter');
    if (!wrap) return;
    const sync = () => {
      wrap.querySelectorAll('[data-day]').forEach(chip => {
        const on = _dayFilterSelected.includes(chip.dataset.day);
        chip.classList.toggle('is-on', on);
        chip.setAttribute('aria-pressed', String(on));
      });
      BM.Storage.setClassDayFilter(_dayFilterSelected);
      _applyDayFilter();
    };
    wrap.querySelectorAll('[data-day]').forEach(chip => {
      chip.addEventListener('click', () => {
        const day = chip.dataset.day;
        _dayFilterSelected = _dayFilterSelected.includes(day) ? _dayFilterSelected.filter(d => d !== day) : [..._dayFilterSelected, day];
        sync();
      });
    });
    _clearDayFilter = () => { _dayFilterSelected = []; sync(); };
  }

  // Matches if ANY of the class's own days is among the selected filter
  // days — a Marți/Joi class stays visible when only "Joi" is picked.
  function _applyDayFilter() {
    const rows = [...document.querySelectorAll('[data-filter-row]')];
    if (!rows.length) return;
    let visibleCount = 0;
    rows.forEach(row => {
      const days = (row.dataset.days || '').split(',').filter(Boolean);
      const match = _dayFilterSelected.length === 0 || days.some(d => _dayFilterSelected.includes(d));
      row.hidden = !match;
      if (match) visibleCount++;
    });
    // a list with nothing to show goes away, the others stay; and one message when nothing is left at all
    ['regGrid', 'classesGrid'].forEach(id => {
      const g = document.getElementById(id);
      if (g) { const any = [...g.children].some(c => !c.hidden); g.hidden = !any; const sect = g.closest('.cl-sect'); if (sect) sect.hidden = !any && _dayFilterSelected.length > 0; }
    });
    const emptyMsg = document.getElementById('classesFilterEmpty');
    if (emptyMsg) emptyMsg.hidden = visibleCount !== 0;

    const bar = document.getElementById('clBar');
    if (bar) {
      if (_dayFilterSelected.length) {
        const names = DAY_ORDER.filter(d => _dayFilterSelected.includes(d)).map(d => DAY_SHORT[d]).join(', ');
        bar.hidden = false;
        bar.innerHTML = `<span>Arăt <b>${visibleCount}</b> din <b>${rows.length}</b> grupe <em>(${names})</em></span>
          <button type="button" class="cl-link" id="clBarClear">Arată toate</button>`;
        document.getElementById('clBarClear')?.addEventListener('click', () => _clearDayFilter());
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
      if (cached) { hasCached = true; _reg = cached.reg || null; _applyTeacherUI(cached.classes, cached.memberCounts, cached.aggStats); }
    } catch {}
    if (!hasCached) setRootContent(loadingHTML());

    const regP = window.ClassesRegistry ? window.ClassesRegistry.load(BMAuth.supabase, BMAuth.user.id) : Promise.resolve(null);
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

    _reg = await regP;
    try { sessionStorage.setItem(_teacherCacheKey(), JSON.stringify({ classes, memberCounts, aggStats, reg: _reg })); } catch {}
    _applyTeacherUI(classes, memberCounts, aggStats);
    _lastTeacherClasses = classes;
    loadJoinRequests(classes);
    _watchRegister();
  }

  /* The teacher types in Sheets; the sync writes it to the database within seconds. This page looks at the last write every 45 s while it is on screen and
     redraws only when it moved. A join request redraws just the requests, at once (js/join-badge.js tells us). */
  let _lastTeacherClasses = [], _regPoll = null;
  function _watchRegister() {
    if (_regPoll) { clearInterval(_regPoll); _regPoll = null; }
    if (!window.ClassesRegistry || !_reg) return;
    _regPoll = setInterval(async () => {
      if (document.hidden || !_reg) return;
      const now = await window.ClassesRegistry.stamp(BMAuth.supabase);
      if (now && now !== _reg.stamp) { try { sessionStorage.removeItem(_teacherCacheKey()); } catch {} renderTeacherView(); }
    }, 45000);
  }
  window.addEventListener('bm:join-requests-changed', () => {
    if (!window.BMAuth || !BMAuth.user) return;
    if (BMAuth.role === 'profesor') loadJoinRequests(_lastTeacherClasses);
    else if (typeof renderStudentView === 'function') { try { sessionStorage.removeItem(_studentCacheKey()); } catch {} renderStudentView(); }
  });

  /* ═══════════════════════════════════════════════════════════════
     JOIN REQUESTS (teacher): a student with the code asks to join; nothing of the class is open to the student until the teacher accepts.
     When the class is a register group, accepting can also tie the student to his name in the register (his presences and status then come from it).
  ═══════════════════════════════════════════════════════════════ */
  let _reqs = [];
  const _plainName = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const _initials = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

  async function loadJoinRequests(classes) {
    const root = document.getElementById('clReqRoot');
    if (!root || !classes.length) return;
    const ids = classes.map(c => c.id);
    let reqs = [], linked = [];
    try {
      const [r, l] = await Promise.all([
        BMAuth.supabase.from('class_join_requests').select('id, class_id, student_id, student_name, class_name, created_at').eq('status', 'pending').in('class_id', ids).order('created_at', { ascending: true }),
        BMAuth.supabase.from('class_member_links').select('class_id, reg_student_name').in('class_id', ids)
      ]);
      reqs = r.error ? [] : (r.data || []);
      linked = l.error ? [] : (l.data || []);
    } catch {}
    const taken = new Set(linked.map(x => x.class_id + '|' + _plainName(x.reg_student_name)));
    _reqs = reqs.map(r => {
      const g = _reg && _reg.groups ? _reg.groups.find(x => x.classId === r.class_id) : null;
      const cands = g ? g.students.filter(s => s.status.enrolled && !taken.has(r.class_id + '|' + _plainName(s.name))) : null;
      let best = null;
      if (cands && cands.length) {
        const want = new Set(_plainName(r.student_name).split(' ').filter(w => w.length > 1));
        const scored = cands.map(s => ({ s, n: _plainName(s.name).split(' ').filter(w => want.has(w)).length })).sort((a, b) => b.n - a.n);
        if (scored[0].n > 0 && (!scored[1] || scored[1].n < scored[0].n)) best = scored[0].s.name;
      }
      return { ...r, cands, best };
    });
    root.innerHTML = _reqs.length ? joinRequestsHTML() : '';
    root.querySelectorAll('[data-decide]').forEach(btn => btn.addEventListener('click', () => decideRequest(btn.closest('[data-req]').dataset.req, btn.dataset.decide === 'accept', btn)));
    if (window.BMJoinBadge) window.BMJoinBadge.set(_reqs.length);
  }

  function joinRequestsHTML() {
    return `
      <section class="cl-sect cl-reqs" aria-labelledby="clReqT">
        <header class="cl-sect__h"><h2 id="clReqT">Cereri de alăturare</h2><span class="cl-sect__n">${_ro(_reqs.length, 'cerere', 'cereri')}</span></header>
        <ul class="cl-reqlist">
          ${_reqs.map(r => `
            <li class="cl-req cl-req--pending" data-req="${r.id}">
              <span class="cl-req__av" aria-hidden="true">${BM.esc(_initials(r.student_name))}</span>
              <span class="cl-req__body">
                <b>${BM.esc(r.student_name || 'Elev')}</b>
                <span>vrea să intre în ${BM.esc(r.class_name || 'clasă')} · ${relDate(r.created_at)}</span>
              </span>
              ${r.cands ? `
              <label class="cl-req__pick">
                <span>Elevul din registru</span>
                <select class="cl-req__sel" data-pick aria-label="Elevul din registru pentru ${BM.esc(r.student_name || 'elev')}">
                  <option value="">Nu e în registru, sau nu știu</option>
                  ${r.cands.map(s => `<option value="${BM.esc(s.name)}"${s.name === r.best ? ' selected' : ''}>${BM.esc(s.name)}</option>`).join('')}
                </select>
              </label>` : ''}
              <span class="cl-req__acts">
                <button type="button" class="cl-req__link" data-decide="reject">Respinge</button>
                <button type="button" class="cl-key cl-key--primary" data-decide="accept">${icon('check', { size: 16 })} Acceptă</button>
              </span>
            </li>`).join('')}
        </ul>
      </section>`;
  }

  async function decideRequest(id, accept, btn) {
    const row = document.querySelector(`[data-req="${id}"]`);
    const reg = accept ? (row && row.querySelector('[data-pick]') ? row.querySelector('[data-pick]').value : '') : '';
    row && row.querySelectorAll('button, select').forEach(el => { el.disabled = true; });
    try {
      const { data, error } = await BMAuth.supabase.rpc('decide_join_request', { p_request: id, p_accept: accept, p_reg_name: reg || null });
      if (error) throw error;
      const st = data && data.status;
      if (st === 'accepted') BM.toast(reg ? 'Elevul a fost acceptat și legat de registru.' : 'Elevul a fost acceptat în clasă.', 'success');
      else if (st === 'rejected') BM.toast('Cererea a fost respinsă.', 'info');
      else BM.toast('Cererea fusese deja rezolvată.', 'info');
      try { sessionStorage.removeItem(_teacherCacheKey()); } catch {}
      renderTeacherView();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
      row && row.querySelectorAll('button, select').forEach(el => { el.disabled = false; });
    }
  }

  function teacherEmpty() {
    return `
      <section class="cl-sheet cl-sheet--empty" aria-label="Grupele tale">
        <div class="cl-ghosts" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="cl-empty">
          <div class="cl-empty__icon">${icon('school', { size: 24 })}</div>
          <h2>Nicio grupă încă</h2>
          <p>Grupele apar aici singure, imediat ce managerul le creează în registrul tău. Dacă ai grupe în registru și nu le vezi, cere administratorului să îți lege contul de registru.</p>
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
      <li class="cl-block" style="--i:${idx}"
          data-id="${cls.id}" data-days="${info.days.join(',')}" data-filter-row>
        <div class="cl-block__top">
          <span class="cl-block__no">${String(idx + 1).padStart(2, '0')}</span>
          <div class="cl-block__title">
            <a class="cl-block__link" href="class.html?id=${cls.id}">${BM.esc(info.subject)}${icon('chevron-right', { size: 18 })}</a>
            ${sub.length ? `<span class="cl-block__sub">${sub.map(t => `<span>${BM.esc(t)}</span>`).join('')}</span>` : ''}
            ${cls.description ? `<span class="cl-block__desc">${BM.esc(cls.description)}</span>` : ''}
          </div>
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

  function _applyStudentUI(classes, reqs) {
    reqs = reqs || [];
    const teachers = new Set(classes.map(c => c.teacher_name).filter(Boolean)).size;
    const next = _nextLesson(classes);
    setRootContent(`
      <div class="${pageClass()}">
        <header class="cl-head">
          ${headInfoHTML('Introdu codul primit de la profesor și trimite o cerere de alăturare.')}
        </header>

        ${classes.length ? todayHTML(classes, 'elev', null) : ''}

        <section class="cl-join" aria-labelledby="clJoinTitle">
          <div class="cl-join__icon">${icon('key', { size: 24 })}</div>
          <div class="cl-join__txt">
            <h2 id="clJoinTitle">Alătură-te unei clase</h2>
            <p>Codul are 6 caractere. Intri în clasă după ce profesorul îți acceptă cererea.</p>
          </div>
          <div class="cl-join__row">
            <input type="text" id="inviteCodeInput" class="cl-codeinput"
                   placeholder="ABC123" maxlength="6" autocomplete="off" autocapitalize="characters"
                   spellcheck="false" aria-label="Cod de invitație"
                   oninput="this.value = this.value.toUpperCase()">
            <button type="button" class="cl-key cl-key--primary" id="joinClassBtn">Trimite cererea</button>
          </div>
        </section>

        ${reqs.length ? studentRequestsHTML(reqs) : ''}

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
    const invited = _inviteCode();
    if (invited && codeInput) {
      codeInput.value = invited;
      const hint = document.querySelector('.cl-join__txt p');
      if (hint) hint.textContent = 'Codul din invitația ta e completat. Apasă „Trimite cererea”; intri în clasă după ce profesorul o acceptă.';
      joinBtn?.focus({ preventScroll: true });
    }
    codeInput?.addEventListener('keydown', e => { if (e.key === 'Enter') joinClass(); });
    document.querySelectorAll('[data-cancel-req]').forEach(btn => btn.addEventListener('click', () => cancelJoinRequest(btn.dataset.cancelReq)));
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
      if (cached) { hasCached = true; _applyStudentUI(cached.classes, cached.reqs); }
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

    let reqs = [];
    try {
      const { data, error } = await BMAuth.supabase.from('class_join_requests')
        .select('id, class_name, status, created_at, decided_at').eq('student_id', BMAuth.user.id).in('status', ['pending', 'rejected']).order('created_at', { ascending: false });
      if (!error) reqs = data || [];
    } catch {}

    try { sessionStorage.setItem(_studentCacheKey(), JSON.stringify({ classes, reqs })); } catch {}
    _applyStudentUI(classes, reqs);
  }

  /* the requests the student sent: waiting for the teacher, or turned down (can be sent again after a day) */
  function studentRequestsHTML(reqs) {
    const retry = r => {
      const left = new Date(r.decided_at).getTime() + 86400000 - Date.now();
      return left > 0 ? `Poți trimite din nou peste ${left > 3600000 ? Math.ceil(left / 3600000) + ' ore' : Math.max(1, Math.ceil(left / 60000)) + ' minute'}.` : 'Poți trimite din nou cererea cu codul clasei.';
    };
    return `
      <section class="cl-sect cl-reqs" aria-labelledby="clMyReqT">
        <header class="cl-sect__h"><h2 id="clMyReqT">Cererile tale</h2><span class="cl-sect__n">${_ro(reqs.length, 'cerere', 'cereri')}</span></header>
        <ul class="cl-reqlist">
          ${reqs.map(r => `
            <li class="cl-req cl-req--${r.status}">
              <span class="cl-req__dot" aria-hidden="true"></span>
              <span class="cl-req__body">
                <b>${BM.esc(r.class_name || 'Clasă')}</b>
                <span>${r.status === 'pending' ? 'Așteaptă răspunsul profesorului. Nu ai acces la clasă până îți acceptă cererea.' : 'Cererea a fost respinsă. ' + retry(r)}</span>
              </span>
              ${r.status === 'pending' ? `<button type="button" class="cl-req__link" data-cancel-req="${r.id}">Retrage cererea</button>` : ''}
            </li>`).join('')}
        </ul>
      </section>`;
  }

  async function cancelJoinRequest(id) {
    try {
      const { error } = await BMAuth.supabase.from('class_join_requests').delete().eq('id', id).eq('student_id', BMAuth.user.id).eq('status', 'pending');
      if (error) throw error;
      BM.toast('Cererea a fost retrasă.', 'info');
      try { sessionStorage.removeItem(_studentCacheKey()); } catch {}
      renderStudentView();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
    }
  }

  function studentEmpty() {
    return `
      <section class="cl-sheet cl-sheet--empty" aria-label="Clasele în care ești înscris">
        <div class="cl-ghosts" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="cl-empty">
          <div class="cl-empty__icon">${icon('library', { size: 24 })}</div>
          <h2>Nicio clasă înscrisă</h2>
          <p>Introdu codul de invitație de mai sus și trimite o cerere. Clasa apare aici după ce profesorul o acceptă.</p>
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
    btn.textContent = 'Se trimite…';
    const reset = () => { btn.disabled = false; btn.textContent = 'Trimite cererea'; };

    try {
      const { data, error } = await BMAuth.supabase.rpc('request_join_class', { p_code: code, p_name: BMAuth.displayName() });
      if (error) throw error;
      const st = (data && data.status) || '';
      const nm = data && data.class_name ? ' „' + data.class_name + '"' : '';
      if (st === 'pending') {
        BM.toast('Cererea a fost trimisă. Intri în clasă' + nm + ' după ce profesorul o acceptă.', 'success');
        if (input) input.value = '';
        try { sessionStorage.removeItem(_studentCacheKey()); } catch {}
        renderStudentView();
        return;
      }
      const msg = {
        not_found: 'Cod de invitație invalid. Verifică și încearcă din nou.',
        own_class: 'Nu te poți înscrie în propria clasă.',
        already_member: 'Ești deja înscris în această clasă.',
        already_pending: 'Ai trimis deja o cerere pentru această clasă. Așteaptă răspunsul profesorului.',
        rejected_wait: 'Cererea ta a fost respinsă. Poți trimite din nou peste cel mult o zi.',
        too_many: 'Prea multe coduri greșite la rând. Încearcă din nou peste 15 minute.',
        auth: 'Conectează-te ca să trimiți o cerere.'
      }[st] || 'Cererea nu a putut fi trimisă.';
      BM.toast(msg, st === 'already_pending' ? 'info' : 'error');
      reset();
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
