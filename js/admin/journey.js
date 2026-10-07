/* ============================================================
   Admin console: the journey of a student ("Parcursul elevului")
   ============================================================
   AdminJourney.open(studentId): a dialog with the folder of one student, from the first day to now: every group he was
   in (when he enrolled, when his first lesson was, how many lessons, what they cost, what he paid, his balance), what
   happened between groups (a transfer, with the money that moved) and how a stay ended (inactive, transferred). The
   data comes from AdminData.journey (js/admin/registru-data.js): the register's first and last marked lesson, the
   transfers and the log of status changes.
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI, D = window.AdminData;
  const { esc, ico, hh } = U;
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const long = iso => new Date(iso + 'T00:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  const short = iso => { const d = new Date(iso + 'T00:00:00'); const m = D.MONTHS[d.getMonth()]; return d.getDate() + ' ' + (m.length > 4 ? m.slice(0, 3) + '.' : m) + ' ' + d.getFullYear(); };
  const money = v => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2, maximumFractionDigits: Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2 }).format(v);
  const sgn = v => (v < 0 ? '−' : '') + money(Math.abs(v));
  const dayNames = g => g.days.map(d => D.DAYS[d - 1].name).join(' / ');
  const sizeLabel = n => (n === 1 ? 'Individual' : `Grup cu ${n} elevi`);
  const statusName = id => (D.STUDENT_STATUS.find(x => x.id === id) || { name: id }).name;
  const stHTML = id => `<span class="ax-st ax-st--${esc(id)}"><i class="ax-st__i" aria-hidden="true"></i>${esc(statusName(id))}</span>`;
  const MARK = { P: 'Prezent', G: 'Prima lecție gratuită', M: 'Absent motivat', A: 'Absent nemotivat', B: 'Absent la lecția de probă' };
  const groupLine = g => `${esc(D.teacher(g.teacher).name)}, ${esc(dayNames(g))} ${hh(g.start)}-${hh(g.start + g.duration)}`;
  const months = (a, b) => Math.max(0, (new Date(b).getFullYear() - new Date(a).getFullYear()) * 12 + new Date(b).getMonth() - new Date(a).getMonth());

  const EVENT = {
    enrol: { ic: 'user-plus', tone: 'blue' },
    arrive: { ic: 'swap', tone: 'swap' },
    first: { ic: 'play', tone: 'green' },
    status: { ic: 'refresh-cw', tone: 'ink' },
    last: { ic: 'clock', tone: 'ink' },
    inactive: { ic: 'x', tone: 'off' },
    moved: { ic: 'swap', tone: 'swap' }
  };
  function eventText(e) {
    if (e.kind === 'enrol') return '<b>Înscris</b> în platformă';
    if (e.kind === 'arrive') return `<b>Venit prin transfer</b>${e.from ? ' din ' + esc(D.teacher(e.from.teacher).name) + ', ' + esc(dayNames(e.from)) : ''}`;
    if (e.kind === 'first') return `<b>Prima lecție</b><span>${esc(MARK[e.code] || '')}</span>`;
    if (e.kind === 'status') return `<b>Statut schimbat</b><span>${stHTML(e.from)} <i class="jr-arr" aria-hidden="true">${ico('arrow-right', 14)}</i> ${stHTML(e.to)}</span>`;
    if (e.kind === 'last') return '<b>Ultima lecție</b>';
    if (e.kind === 'inactive') return `<b>Devine inactiv</b>${e.last ? '<span>după ultima lecție ținută</span>' : ''}`;
    if (e.kind === 'moved') return '<b>Transferat</b><span>grupa nouă nu e înregistrată</span>';
    return '';
  }

  function chapterHTML(c, i, now) {
    const g = c.g, room = g.room ? D.room(g.room) : null;
    const total = c.paid + c.disc;
    const pct = total > 0 ? Math.min(100, Math.round(c.spent / total * 100)) : (c.spent > 0 ? 100 : 0);
    const here = now && c.k === now.k;
    return `
      <section class="jr-ch${here ? ' is-now' : ''}" style="--i:${i}" aria-label="${esc(g.subject + ', ' + D.teacher(g.teacher).name)}">
        <span class="jr-pin" aria-hidden="true">${ico(here ? 'play' : 'grid', 16)}</span>
        <div class="jr-card">
          <header class="jr-ch__h">
            <span class="ax-grade">${esc(g.grade)}</span>
            <div><b>${esc(g.subject)}${g.profile ? ', ' + esc(g.profile) : ''}</b><span>${groupLine(g)}${room ? `, cabinetul ${room.num}` : ', online'} · ${esc(sizeLabel(g.size))}</span></div>
            <div class="jr-ch__r">${stHTML(c.status)}<span class="jr-spent" title="Costul lecțiilor la care a fost prezent sau absent nemotivat în această grupă"><small>Cheltuit în grupă</small><b data-n="${c.spent}" class="jr-m">${money(c.spent)} lei</b></span></div>
          </header>
          <ol class="jr-ev">${c.events.map((e, k) => { const t = EVENT[e.kind] || EVENT.status; return `
            <li class="jr-e jr-e--${t.tone}" style="--k:${k}"><span class="jr-e__d">${esc(short(e.iso))}</span><span class="jr-e__n" aria-hidden="true">${ico(t.ic, 14)}</span><span class="jr-e__t">${eventText(e)}</span></li>`; }).join('')}</ol>
          <dl class="jr-money">
            <div><dt>Lecții ținute</dt><dd data-n="${c.held}" data-d="0">${c.held}</dd></div>
            <div><dt>Cheltuit</dt><dd data-n="${c.spent}" class="jr-m">${money(c.spent)} lei</dd></div>
            <div><dt>Achitat</dt><dd data-n="${c.paid}" class="jr-m">${money(c.paid)} lei</dd></div>
            <div><dt>Reduceri</dt><dd data-n="${c.disc}" class="jr-m">${money(c.disc)} lei</dd></div>
            <div><dt>Sold</dt><dd class="jr-m ${c.sold < 0 ? 'is-neg' : c.sold > 0 ? 'is-pos' : ''}">${sgn(c.sold)} lei</dd></div>
          </dl>
          <div class="jr-bar" role="img" aria-label="Cheltuit ${pct}% din ce a plătit"><i style="--p:${pct / 100}"></i></div>
        </div>
      </section>`;
  }
  function linkHTML(c, nextC, i) {
    const f = c.fin;
    const moved = f ? Math.round((f.achRem + f.redRem) * 100) / 100 : null;
    return `
      <div class="jr-link" style="--i:${i}">
        <span class="jr-pin jr-pin--swap" aria-hidden="true">${ico('swap', 16)}</span>
        <div class="jr-link__c">
          <span class="jr-link__d">${esc(long(c.leave))}</span>
          <b>Transferat în ${esc(D.teacher(c.to.teacher).name)}</b>
          <span>${esc(c.to.subject)}, clasa ${esc(c.to.grade)}, ${esc(dayNames(c.to))} ${hh(c.to.start)}-${hh(c.to.start + c.to.duration)}</span>
          ${f ? `<span class="jr-link__m">Rămași aici ${money(f.achC + f.redC)} lei, trecuți în grupa nouă <b>${money(moved)} lei</b>${f.debt ? `, datorie rămasă ${money(f.debt)} lei` : ''}</span>` : ''}
        </div>
      </div>`;
  }

  function open(sid) {
    const J = D.journey(sid);
    if (!J) return;
    const s = J.student, mgr = D.manager(s.manager);
    const now = J.chapters.find(c => c.g.id === s.group) || J.chapters[J.chapters.length - 1];
    const dlg = document.createElement('dialog');
    dlg.className = 'jr-dlg';
    dlg.setAttribute('aria-labelledby', 'jrT');
    const mo = months(J.since, D.todayISO);
    let body = '';
    J.chapters.forEach((c, i) => {
      body += chapterHTML(c, i * 2, now);
      if (c.to && J.chapters[i + 1]) body += linkHTML(c, J.chapters[i + 1], i * 2 + 1);
    });
    if (!J.chapters.length) body = '<p class="jr-none">Elevul nu a fost încă într-o grupă.</p>';
    dlg.innerHTML = `
      <header class="jr-h">
        <span class="jr-h__ic" aria-hidden="true">${ico('history', 22)}</span>
        <div><span class="jr-h__e">Parcursul elevului</span><h2 id="jrT">${esc(s.name)}</h2></div>
        <button type="button" class="ax-icon-btn jr-x" data-x aria-label="Închide">${ico('x', 18)}</button>
      </header>
      <div class="jr-b">
        <div class="jr-sum">
          <div class="jr-sum__w"><span>Acum</span>${stHTML(s.status)}<span class="jr-sum__s">${mgr ? 'Manager ' + esc(mgr.name) : ''}</span></div>
          <dl class="jr-sum__k">
            <div><dt>În platformă din</dt><dd>${esc(long(J.since))}<small>${mo ? (mo === 1 ? 'de o lună' : 'de ' + mo + ' luni') : 'din această lună'}</small></dd></div>
            <div><dt>Grupe</dt><dd>${J.chapters.length}</dd></div>
            <div><dt>Cheltuit în total</dt><dd>${money(J.totals.spent)} lei<small>${J.totals.held} lecții</small></dd></div>
            <div><dt>Achitat</dt><dd>${money(J.totals.paid + J.totals.disc)} lei<small>${J.totals.disc ? 'din care reduceri ' + money(J.totals.disc) : 'fără reduceri'}</small></dd></div>
            <div><dt>Sold acum</dt><dd class="${J.totals.balance < 0 ? 'is-neg' : J.totals.balance > 0 ? 'is-pos' : ''}">${sgn(J.totals.balance)} lei</dd></div>
          </dl>
        </div>
        ${J.chapters.length ? (() => { const max = Math.max(...J.chapters.map(c => c.spent), 1); return `<section class="jr-by" aria-label="Cheltuit pe grupe"><h3>Cheltuit pe grupe</h3><ul>${J.chapters.map((c, i) => `<li style="--i:${i}"><span class="jr-by__n"><b>${esc(c.g.subject)}</b> ${esc(D.teacher(c.g.teacher).name)}</span><span class="jr-by__b" aria-hidden="true"><i style="--p:${c.spent / max}"></i></span><span class="jr-by__v">${money(c.spent)} lei</span><small>${c.held} ${c.held === 1 ? 'lecție' : 'lecții'}</small></li>`).join('')}<li class="jr-by__t"><span class="jr-by__n"><b>Total</b></span><span></span><span class="jr-by__v">${money(J.totals.spent)} lei</span><small>${J.totals.held} lecții</small></li></ul></section>`; })() : ''}
        <div class="jr-tl" id="jrTl"><i class="jr-line" aria-hidden="true"></i>${body}</div>
      </div>
      <footer class="jr-f"><span>${J.chapters.length === 1 ? 'O grupă' : J.chapters.length + ' grupe'} în parcurs</span><button type="button" class="ax-btn" data-x>Închide</button></footer>`;
    document.body.appendChild(dlg);
    const hold = e => { const t = e.target; if (t !== dlg && dlg.contains(t) && t.closest('.jr-b')) return; e.preventDefault(); };
    document.addEventListener('wheel', hold, { passive: false, capture: true });
    document.addEventListener('touchmove', hold, { passive: false, capture: true });
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-x]')) dlg.close(); });
    dlg.addEventListener('close', () => { document.removeEventListener('wheel', hold, { capture: true }); document.removeEventListener('touchmove', hold, { capture: true }); dlg.remove(); });
    dlg.showModal();
    /* the figures run up to their value once the card is in view */
    if (!calm()) {
      const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { count(en.target); io.unobserve(en.target); } }), { root: dlg.querySelector('.jr-b'), threshold: 0.4 }) : null;
      dlg.querySelectorAll('.jr-card').forEach(c => { if (io) io.observe(c); else count(c); });
    } else dlg.querySelectorAll('.jr-card').forEach(c => c.classList.add('is-in'));
    function count(card) {
      card.classList.add('is-in');
      card.querySelectorAll('dd[data-n]').forEach(el => {
        const to = +el.dataset.n, dec = el.dataset.d === '0', t0 = performance.now(), isM = el.classList.contains('jr-m');
        const tick = t => { const p = Math.min(1, (t - t0) / 700), v = to * (1 - Math.pow(1 - p, 3)); el.textContent = dec ? Math.round(v) : money(Math.round(v * 100) / 100) + (isM ? ' lei' : ''); if (p < 1) requestAnimationFrame(tick); else el.textContent = dec ? to : money(to) + (isM ? ' lei' : ''); };
        requestAnimationFrame(tick);
      });
    }
    const x = dlg.querySelector('.jr-x'); if (x) x.focus();
  }

  window.AdminJourney = { open };
})();
