/* ============================================================
   Admin console: Recepție (the lobby TV)
   ============================================================
   A board for the big screen at the entrance: where is each group
   right now. Only the offline groups (they have a cabinet).

   What it shows, by the clock:
     1. the lessons in progress now (a lesson of two hours that began
        an hour ago is still in progress),
     2. then the next wave: the lessons that start at the next hour
        that has lessons today ("Urmează"),
     3. when the day is over: the first lessons of the next day with
        lessons ("Mâine").
   Six groups per slide, sorted by cabinet; a slide lasts 10 seconds
   and a bar along the top fills while it is on screen. The plan is
   recomputed when the hour changes (checked every 15 seconds), not
   all the lessons of the day at once.

   Controls (only in the console, not on the TV): pause and step,
   a simulation of any day and hour (so the board can be shown at
   noon on a Sunday), a busy demo programme (the demo data never has
   more than four lessons at once; the busy programme fills the
   cabinets so a full slide and the paging can be seen), full screen. #receptie?tv=1 hides the console
   around the board, for a screen that is opened on this address.

   Data: the demo data of the console (js/admin/mock-data.js).
   State of the preview in the address: ?zi=<1-7>&ora=<8-20>&prog=aglomerat
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico, hh } = U;

  const PER = 6;                 // groups per slide
  const SLIDE_MS = 10000;        // seconds on screen, per slide
  const CHECK_MS = 15000;        // how often the plan is compared with the clock
  const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
  const calm = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let ctl = null;                // the running board (one at a time)

  /* ---------- what is on, when ---------- */
  let busy = false;              // the busy demo programme (preview only, nothing is stored)
  const enr = g => D.enrolled(g.src || g);
  /* Every hour from 9 to 19: six lessons in the odd hours, eight (two slides) in the even ones, each in its own
     cabinet and with its own teacher, made from real groups of the demo data. */
  const crowdCache = {};
  function crowd(day) {
    if (crowdCache[day]) return crowdCache[day];
    const base = D.groups.filter(g => g.project === 'exo' && g.room && D.enrolled(g).length);
    const out = []; let k = 0;
    for (let h = 9; h <= 19; h++) {
      const n = h % 2 === 0 ? 8 : 6, used = new Set();
      for (let i = 0; i < n; i++) {
        let src = base[(k * 7) % base.length]; k++;
        for (let tries = 0; used.has(src.teacher) && tries < base.length; tries++) { src = base[(k * 7) % base.length]; k++; }
        used.add(src.teacher);
        out.push(Object.assign({}, src, { id: 'demo-' + day + '-' + h + '-' + i, src, days: [day], start: h, duration: 1, room: D.rooms[i % D.rooms.length].id, status: 'activ' }));
      }
    }
    return (crowdCache[day] = out);
  }
  const offline = day => (busy ? crowd(day) : D.groups.filter(g => g.project === 'exo' && g.status !== 'inactiv' && g.room && g.days.includes(day) && D.enrolled(g).length));
  const byRoom = (a, b) => D.room(a.room).num - D.room(b.room).num || a.start - b.start;

  function clock(sim) {
    const d = new Date();
    const real = ((d.getDay() + 6) % 7) + 1;
    const day = sim.zi || real;
    const min = sim.ora != null ? sim.ora * 60 + 5 : d.getHours() * 60 + d.getMinutes();
    const date = new Date(d); date.setDate(d.getDate() + ((day - real + 7) % 7));
    return { day, min, date, sec: d.getSeconds(), simulated: !!(sim.zi || sim.ora != null || busy) };
  }

  function plan(day, min) {
    const all = offline(day);
    const now = all.filter(g => g.start * 60 <= min && min < (g.start + g.duration) * 60).sort(byRoom);
    const later = all.filter(g => g.start * 60 > min);
    const nextStart = later.length ? Math.min.apply(null, later.map(g => g.start)) : null;
    const next = nextStart != null ? later.filter(g => g.start === nextStart).sort(byRoom) : [];
    let tomorrow = null;
    if (!now.length && !next.length) {
      for (let k = 1; k <= 7 && !tomorrow; k++) {
        const d = ((day - 1 + k) % 7) + 1, gs = offline(d);
        if (gs.length) { const s = Math.min.apply(null, gs.map(g => g.start)); tomorrow = { day: d, offset: k, start: s, groups: gs.filter(g => g.start === s).sort(byRoom) }; }
      }
    }
    return { now, next, nextStart, tomorrow };
  }

  function slidesOf(p) {
    const out = [];
    const add = (kind, groups, extra) => {
      const pages = Math.max(1, Math.ceil(groups.length / PER));
      for (let i = 0; i < pages; i++) out.push(Object.assign({ kind, groups: groups.slice(i * PER, (i + 1) * PER), page: i + 1, of: pages }, extra));
    };
    if (p.now.length) {
      const from = Math.min.apply(null, p.now.map(g => g.start)), to = Math.max.apply(null, p.now.map(g => g.start + g.duration));
      add('now', p.now, { sub: `Lecții între ${hh(from)} și ${hh(to)}` });
    }
    if (p.next.length) add('next', p.next, { sub: `Încep la ${hh(p.nextStart)}` });
    if (p.tomorrow) {
      const t = p.tomorrow;
      add('later', t.groups, { label: t.offset === 1 ? 'Mâine' : D.DAYS[t.day - 1].name, sub: `${t.offset === 1 ? 'Azi nu mai sunt lecții. ' : 'Azi nu sunt lecții. '}Încep la ${hh(t.start)}`, startMin: t.start * 60 });
    }
    if (!out.length) out.push({ kind: 'idle', groups: [], page: 1, of: 1, sub: 'Nu sunt lecții programate în acest interval' });
    return out;
  }

  /* ---------- pieces of the board ---------- */
  const gradeNo = g => D.GRADES.indexOf(g) + 1;
  const SIGN = { now: 'În desfășurare', next: 'Urmează', later: 'Mâine', idle: 'Recepție' };

  function studentsHTML(g) {
    const list = enr(g).slice().sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    return `<ul class="rc-stu${list.length > 4 ? ' is-two' : ''}">${list.map(s => `
      <li><i class="rc-dot rc-dot--${s.status === 'instabil' ? 'activ' : s.status}" aria-hidden="true"></i><span class="rc-sn">${esc(s.first)} ${esc(s.last)}</span></li>`).join('')}</ul>`;
  }

  function cardHTML(g, kind, i, startMin) {
    const t = D.teacher(g.teacher), room = D.room(g.room);
    const en = enr(g).length;
    const seats = g.size === 1 ? 'Individual' : `${en} din ${g.size} elevi`;
    const subj = g.subject + (g.regime === 'vara' ? ' (vară)' : '');
    return `
      <article class="rc-card rc-card--${kind}" style="--i:${i}">
        <div class="rc-plate" aria-label="Cabinetul ${room.num}"><small>Cabinet</small><b>${room.num}</b><small>etaj ${room.floor}</small></div>
        <div class="rc-main">
          <h3 class="rc-teacher">${esc(t.first)} ${esc(t.last)}</h3>
          <p class="rc-time"><b>${hh(g.start)}–${hh(g.start + g.duration)}</b><span>${esc(g.days.map(d => D.DAYS[d - 1].name).join(' / '))}</span></p>
        </div>
        <div class="rc-meta">
          <span class="rc-subj">${esc(subj)}</span>
          <span class="rc-grade">Clasa ${gradeNo(g.grade)}${g.profile ? ` <i>${esc(g.profile)}</i>` : ''}</span>
          <span class="rc-seats">${seats}</span>
        </div>
        ${studentsHTML(g)}
        ${kind === 'now' ? `<u class="rc-elapsed" aria-hidden="true" data-until="${(g.start + g.duration) * 60}" data-from="${g.start * 60}"><i></i></u>` : ''}
      </article>`;
  }

  /* ---------- the board ---------- */
  function start(root, query) {
    if (ctl) ctl.stop();
    const sim = { zi: +query.zi >= 1 && +query.zi <= 7 ? +query.zi : 0, ora: +query.ora >= 8 && +query.ora <= 20 ? +query.ora : null };
    const tv = query.tv === '1';
    busy = query.prog === 'aglomerat';
    const saveQ = () => U.writeQuery({ zi: sim.zi || null, ora: sim.ora, prog: busy ? 'aglomerat' : null, tv: tv ? '1' : null });
    const st = { slides: [], i: 0, paused: false, key: '', timers: [], offs: [] };
    const q = s => root.querySelector(s);
    const stage = q('#rcStage'), grid = q('#rcGrid'), prog = q('#rcProg');

    const keyOf = p => [p.now.map(g => g.id).join(), p.next.map(g => g.id).join(), p.tomorrow ? p.tomorrow.groups.map(g => g.id).join() : ''].join('|');

    function paintClock() {
      const c = clock(sim);
      const wd = D.DAYS[c.day - 1].name;
      q('#rcDay').textContent = wd;
      q('#rcDate').textContent = `${c.date.getDate()} ${MONTHS[c.date.getMonth()]}`;
      const now = new Date();
      q('#rcTime').textContent = sim.ora != null ? hhmm(c.min) : String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
      stage.classList.toggle('is-sim', c.simulated);
      // countdowns and the elapsed bar of each card
      stage.querySelectorAll('.rc-elapsed').forEach(el => {
        const to = +el.dataset.until, from = +el.dataset.from;
        el.firstElementChild.style.transform = `scaleX(${Math.max(0.02, Math.min(1, (c.min - from) / (to - from)))})`;
      });
    }

    function paintSlide(animate) {
      const s = st.slides[st.i] || st.slides[0];
      stage.dataset.kind = s.kind;
      q('#rcSign').textContent = s.label ? s.label.toUpperCase() : SIGN[s.kind].toUpperCase();
      q('#rcSub').textContent = s.sub || '';
      q('#rcPage').textContent = st.slides.length > 1 ? `Pagina ${st.i + 1} din ${st.slides.length}` : '';
      grid.className = 'rc-grid is-n' + Math.min(PER, s.groups.length) + (s.groups.length ? '' : ' is-empty');   // the layout follows how many groups there are
      grid.innerHTML = s.groups.length
        ? s.groups.map((g, i) => cardHTML(g, s.kind, i, s.startMin)).join('')
        : `<p class="rc-idle"><b>Nu sunt lecții acum.</b>Revenim cu programul.</p>`;
      if (animate && !calm()) { stage.classList.remove('is-turn'); void stage.offsetWidth; stage.classList.add('is-turn'); }
      paintClock();
    }

    function paintProgress() {
      prog.innerHTML = st.slides.length > 1
        ? st.slides.map((s, k) => `<span class="rc-seg rc-seg--${s.kind}${k < st.i ? ' is-done' : ''}${k === st.i ? ' is-cur' : ''}"><i></i></span>`).join('')
        : '';
      prog.hidden = st.slides.length < 2;
      const cur = prog.querySelector('.is-cur i');
      if (cur) cur.addEventListener('animationend', () => go(st.i + 1, true), { once: true });
    }

    function go(i, animate) {
      if (!st.slides.length) return;
      st.i = (i + st.slides.length) % st.slides.length;
      paintSlide(animate);
      paintProgress();
    }

    function replan(force) {
      const c = clock(sim), p = plan(c.day, c.min), k = keyOf(p);
      if (!force && k === st.key) return;
      const was = st.key;
      st.key = k;
      st.slides = slidesOf(p);
      if (was && k !== was) st.i = 0;                    // the hour changed: from the first slide
      st.i = Math.min(st.i, st.slides.length - 1);
      go(st.i, !!was);
    }

    // controls
    const toolbar = {
      pause: q('#rcPause'), prev: q('#rcPrev'), next: q('#rcNext'), full: q('#rcFull'), day: q('#rcDayPick'), hour: q('#rcHourPick')
    };
    const setPaused = p => {
      st.paused = p;
      stage.classList.toggle('is-paused', p);
      if (toolbar.pause) { toolbar.pause.setAttribute('aria-pressed', String(p)); toolbar.pause.querySelector('span').textContent = p ? 'Reia' : 'Pauză'; }
    };
    if (toolbar.pause) toolbar.pause.addEventListener('click', () => setPaused(!st.paused));
    if (toolbar.prev) toolbar.prev.addEventListener('click', () => go(st.i - 1, true));
    if (toolbar.next) toolbar.next.addEventListener('click', () => go(st.i + 1, true));
    if (toolbar.day) toolbar.day.addEventListener('change', e => { sim.zi = +e.target.value || 0; saveQ(); st.key = ''; replan(true); });
    if (toolbar.hour) toolbar.hour.addEventListener('change', e => { sim.ora = e.target.value === '' ? null : +e.target.value; saveQ(); st.key = ''; replan(true); });
    const progPick = q('#rcProgPick');
    if (progPick) progPick.addEventListener('change', e => { busy = e.target.value === 'aglomerat'; saveQ(); st.key = ''; replan(true); });

    const wrap = q('#rcWrap');
    const fsOK = !!(wrap.requestFullscreen);
    let wake = null;
    const enter = async () => {
      try { await wrap.requestFullscreen(); } catch (e) { return; }
      try { wake = navigator.wakeLock && await navigator.wakeLock.request('screen'); } catch (e) { wake = null; }
    };
    if (toolbar.full) { if (fsOK) toolbar.full.addEventListener('click', enter); else toolbar.full.hidden = true; }
    // the pointer disappears from the TV after a few seconds
    let idleT = 0;
    const wake$ = () => { wrap.classList.remove('is-idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (document.fullscreenElement === wrap || tv) wrap.classList.add('is-idle'); }, 3000); };
    wrap.addEventListener('pointermove', wake$);
    const onFs = () => { wrap.classList.toggle('is-full', document.fullscreenElement === wrap); wake$(); if (document.fullscreenElement !== wrap && wake) { try { wake.release(); } catch (e) {} wake = null; } };
    document.addEventListener('fullscreenchange', onFs);

    const onKey = e => {
      if (!stage.isConnected || e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowRight') { go(st.i + 1, true); }
      else if (e.key === 'ArrowLeft') { go(st.i - 1, true); }
      else if (e.key === ' ') { e.preventDefault(); setPaused(!st.paused); }
      else if ((e.key === 'f' || e.key === 'F') && fsOK) { document.fullscreenElement ? document.exitFullscreen() : enter(); }
      else if (e.key === 'Escape' && tv && !document.fullscreenElement) { location.hash = 'receptie'; }
    };
    document.addEventListener('keydown', onKey);

    st.timers.push(setInterval(() => { if (!stage.isConnected) { ctl && ctl.stop(); return; } paintClock(); }, 1000));
    st.timers.push(setInterval(() => { if (stage.isConnected) replan(false); }, CHECK_MS));
    st.offs.push(D.onChange(() => { if (stage.isConnected) replan(true); }));
    wake$();

    ctl = {
      stop() {
        st.timers.forEach(clearInterval); st.offs.forEach(f => f());
        document.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs);
        clearTimeout(idleT); if (wake) { try { wake.release(); } catch (e) {} }
        ctl = null;
      }
    };
    replan(true);
  }

  window.AdminViews.receptie = {
    title: 'Recepție',
    icon: 'monitor',
    render(root, ctx) {
      const q = ctx.query || {};
      const tv = q.tv === '1';
      const zi = +q.zi >= 1 && +q.zi <= 7 ? +q.zi : 0, ora = +q.ora >= 8 && +q.ora <= 20 ? +q.ora : '';
      document.getElementById('axShell').toggleAttribute('data-tv', tv);
      root.innerHTML = `
        <header class="ax-head rc-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('monitor', 24)}</span>
            <div>
              <h1 class="ax-h1">Recepție</h1>
              <p class="ax-lede">Ecranul de la intrare: lecțiile din cabinete care sunt acum în desfășurare și cele care urmează. Doar grupele offline.</p>
            </div>
          </div>
        </header>
        <div class="rc-tools" role="group" aria-label="Comenzi pentru ecran">
          <div class="rc-tools__a">
            <button type="button" class="ax-btn ax-btn--sm" id="rcPrev" aria-label="Pagina anterioară">${ico('arrow-left', 16)}</button>
            <button type="button" class="ax-btn ax-btn--sm" id="rcPause" aria-pressed="false">${ico('timer', 16)}<span>Pauză</span></button>
            <button type="button" class="ax-btn ax-btn--sm" id="rcNext" aria-label="Pagina următoare">${ico('arrow-right', 16)}</button>
          </div>
          <div class="rc-tools__b">
            <label class="rc-pick"><span>Simulează ziua</span>
              <select class="ax-select" id="rcDayPick">
                <option value="">Azi</option>
                ${D.DAYS.map(d => `<option value="${d.id}"${d.id === zi ? ' selected' : ''}>${d.name}</option>`).join('')}
              </select></label>
            <label class="rc-pick"><span>și ora</span>
              <select class="ax-select" id="rcHourPick">
                <option value="">Acum</option>
                ${D.HOURS.filter(h => h <= 20).map(h => `<option value="${h}"${h === ora ? ' selected' : ''}>${String(h).padStart(2, '0')}:05</option>`).join('')}
              </select></label>
            <label class="rc-pick"><span>Programul</span>
              <select class="ax-select" id="rcProgPick">
                <option value="">Cel real (demo)</option>
                <option value="aglomerat"${q.prog === 'aglomerat' ? ' selected' : ''}>Aglomerat, de probă</option>
              </select></label>
            <button type="button" class="ax-btn ax-btn--primary" id="rcFull">${ico('maximize', 16)}<span>Pe tot ecranul</span></button>
          </div>
        </div>
        <div class="rc-wrap" id="rcWrap"><div class="rc-fit">
          <section class="rc" id="rcStage" data-kind="now" aria-label="Lecțiile din cabinete">
            <div class="rc-prog" id="rcProg" aria-hidden="true"></div>
            <header class="rc-top">
              <div class="rc-state"><span class="rc-sign" id="rcSign"></span><span class="rc-sub" id="rcSub"></span></div>
              <div class="rc-clock">
                <b id="rcTime">00:00:00</b>
                <span><em id="rcDay"></em> <span id="rcDate"></span><i class="rc-simtag">simulare</i></span>
              </div>
            </header>
            <div class="rc-grid" id="rcGrid" aria-live="polite"></div>
            <footer class="rc-foot">
              <span class="rc-leg"><i class="rc-dot rc-dot--activ"></i>elev din grupă<i class="rc-dot rc-dot--proba"></i>oră de probă<i class="rc-dot rc-dot--inlocuire"></i>înlocuire</span>
              <span class="rc-page" id="rcPage"></span>
            </footer>
          </section>
        </div></div>`;
      start(root, q);
    }
  };
})();
