/* ============================================================
   Lesson guide: "Cum intru la lecție?" (students)
   ============================================================
   A short dialog with the steps to get into an online lesson, and what to do when it does not work. Used by the "Lecția ta" card in Clase and by
   the Meet block in a class. The founder asks for the lesson to be followed from a LAPTOP (the teacher shares the screen and works on the live
   whiteboard), so the first step says so. window.BMLessonGuide.open() shows it; .isNew() says whether this student has not opened it yet
   (the key that opens it is then drawn as a hint). Text only, no data.
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'lesson_guide_seen_v1';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const STEPS = [
    ['Folosește laptopul.', 'Profesorul împarte ecranul și lucrează pe tablă live. Pe telefon se vede prea mic și e greu de urmărit.'],
    ['Intră în Teorema cu contul tău.', 'La „Clase”, sus, vezi lecția ta de azi. Cu 10 minute înainte de oră, butonul „Intră la lecție” se aprinde.'],
    ['Apasă „Intră la lecție”.', 'Se deschide Google Meet într-o filă nouă. Dacă ți se cere, apasă „Cere să participi” și așteaptă puțin: profesorul te primește. Intră cu numele tău real.'],
    ['Permite microfonul și camera.', 'Când browserul întreabă, apasă „Permite”. Ține microfonul oprit până îți spune profesorul.'],
    ['Tabla live.', 'Dacă profesorul lucrează pe tablă, o găsești în clasă, la tab-ul „Tablă”.']
  ];
  const TROUBLE = [
    ['Butonul e gri.', 'Încă nu e ora. Se aprinde cu 10 minute înainte de lecție și se stinge cu 10 minute înainte de sfârșit.'],
    ['Scrie „Profesorul nu a adăugat linkul”.', 'Spune-i managerului tău, el îl poate completa în câteva minute.'],
    ['Nu vezi lecția în Clase.', 'Contul tău nu e încă în clasă sau nu e legat de numele tău din registru. Scrie-i profesorului.'],
    ['Meet nu se deschide.', 'Folosește Google Chrome și nu bloca ferestrele noi (pop-up) pentru Teorema.'],
    ['Ești totuși pe telefon.', 'Instalează aplicația Google Meet înainte de lecție, nu în ultimul minut.']
  ];

  let last = null;

  function open() {
    const prev = document.activeElement;
    close();
    const host = document.createElement('div');
    host.className = 'lg';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-labelledby', 'lgT');
    host.innerHTML = `
      <div class="lg__backdrop" data-close></div>
      <div class="lg__dialog">
        <header class="cm__head"><h2 id="lgT" class="cm__title">Cum intru la lecție?</h2><button type="button" class="cm__x" data-close aria-label="Închide"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
        <div class="lg__body">
          <ol class="lg__steps">${STEPS.map(s => `<li><span class="lg__n" aria-hidden="true"></span><p><b>${esc(s[0])}</b> ${esc(s[1])}</p></li>`).join('')}</ol>
          <h3 class="lg__h">Nu merge?</h3>
          <ul class="lg__trouble">${TROUBLE.map(s => `<li><p><b>${esc(s[0])}</b> ${esc(s[1])}</p></li>`).join('')}</ul>
        </div>
        <footer class="cm__foot"><button type="button" class="cl-key cl-key--primary" data-close>Am înțeles</button></footer>
      </div>`;
    document.body.appendChild(host);
    document.body.classList.add('lg-open');
    last = { host, prev };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Tab') trap(e, host); };
    document.addEventListener('keydown', onKey);
    last.onKey = onKey;
    host.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ }
    document.dispatchEvent(new CustomEvent('lessonguide:seen'));
    const first = host.querySelector('.cm__foot .cl-key');
    if (first) first.focus({ preventScroll: true });
  }

  /* keeps Tab inside the dialog */
  function trap(e, host) {
    const f = [...host.querySelectorAll('button, a[href]')].filter(x => !x.disabled);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }

  function close() {
    if (!last) return;
    const { host, prev, onKey } = last;
    last = null;
    document.removeEventListener('keydown', onKey);
    host.remove();
    document.body.classList.remove('lg-open');
    if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
  }

  function isNew() { try { return !localStorage.getItem(KEY); } catch (e) { return false; } }

  window.BMLessonGuide = { open, close, isNew };
})();
