/* ============================================================
   Admin console: Info (only the admin)
   ============================================================
   The longer processes written as steps, for the day someone asks "how do I add a new teacher?": a new teacher, a new manager, someone leaving,
   enrolling a student, a new group, a group ready to start, lesson changes, a register that does not sync, Telegram, the one-time setup.
   Plain text on purpose (no code words): the founder reads it too. A search box filters the sections; #info?p=<id> opens one.
   When a process changes, change it here too (the text is in PROCESSES below).
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI;
  const { esc, ico } = U;

  const ROBOT = 'registre-sync@mathorizon-registre.iam.gserviceaccount.com';

  /* id, title, what it is for, steps (each: bold start + the rest), a note, keys that open the page where the step happens */
  const PROCESSES = [
    {
      id: 'profesor', title: 'Adaug un profesor nou', sub: 'Cont, registru și legătura dintre ele. Durează cam 10 minute.',
      need: 'Ai nevoie de: contul Google al profesorului și numele lui oficial, în forma „Nume Prenume”, cum va apărea în registre.',
      steps: [
        ['Profesorul își face cont pe site.', 'La pagina de autentificare alege rolul „Profesor”. Apoi așteaptă aprobarea, nu poate face nimic până atunci.'],
        ['Îl aprobi tu.', 'În consolă, la Conturi, tab-ul „Cereri”. Scrie numele oficial („Nume Prenume”, obligatoriu) și aprobă.'],
        ['Creezi registrul lui, în contul companiei.', 'Faci o copie a șablonului în dosarul „Registre” și îi dai numele profesorului. Dosarul e deja partajat cu platforma (vezi „Prima configurare”), deci pentru platformă nu mai partajezi nimic.'],
        ['Partajezi registrul cu profesorul.', 'Cu contul lui Google, ca „Editor”, doar pe acest fișier. Să nu-i dai acces la tot dosarul: nu trebuie să vadă registrele colegilor.'],
        ['Adaugi registrul în platformă.', 'La Sincronizare, butonul „Adaugă registru”: lipești linkul, alegi profesorul și contul lui de pe platformă. Contul e obligatoriu: fără el nu apar clasele, codurile de invitație și Telegram.'],
        ['Verifici.', 'După un minut, la Sincronizare registrul trebuie să arate ora ultimei citiri și nicio problemă. La Clase, profesorul are câte o clasă pentru fiecare grupă, cu cod de invitație.'],
        ['Profesorul își conectează Telegram (opțional).', 'Din profilul lui, butonul „Conectează Telegram”. La grupele Online își scrie și linkul Google Meet în registru.']
      ],
      note: 'Editările din registru ajung în platformă în cel mult un minut. Dacă vrei să ajungă în câteva secunde, există un pas separat, opțional, pe care îl face persoana tehnică. Fără el totul merge.',
      keys: [['Conturi', '#profesori'], ['Sincronizare', '#sincronizare']]
    },
    {
      id: 'manager', title: 'Adaug un manager nou', sub: 'Cont, nume oficial și intrarea în lista de manageri a registrelor.',
      need: 'Ai nevoie de: numele oficial al managerului, în forma „Nume Prenume”. Numele nu se mai poate schimba după ce elevii îl au scris în registre, alege-l bine.',
      steps: [
        ['Managerul își face cont pe site.', 'Alege rolul „Manager” și așteaptă aprobarea. Până atunci vede doar un mesaj de așteptare.'],
        ['Îl aprobi tu.', 'La Conturi, tab-ul „Cereri”. Scrie numele oficial (obligatoriu) și aprobă.'],
        ['Numele ajunge singur în lista de manageri.', 'Lista e în fișierul-mamă, tab-ul CONFIGURARI, coloana B. Verifică la Conturi, tab-ul „Manageri”: coloana „În lista din registre” trebuie să spună „Da”. Dacă spune „Lipsește”, apasă „Trimite”.'],
        ['Dacă „Trimite” nu reușește,', 'consola îți arată numele de copiat. Scrie-l de mână în fișierul-mamă, tab-ul CONFIGURARI, coloana B, în prima celulă liberă. Dacă tab-ul e blocat, îl scrie proprietarul fișierului.'],
        ['Așteaptă un minut.', 'Apoi managerul apare în fereastra de înscriere și în listele din registre.'],
        ['Managerul intră în consolă.', 'Își vede elevii și schimbările lecțiilor lor. Își poate conecta Telegram din Profil, dar botul încă nu-i trimite nimic.']
      ],
      note: 'Registrele în formatul vechi, de dinainte de fișierul-mamă, au lista lor de manageri. În acelea numele se scrie și în CONFIGURARI din registrul respectiv. Un manager nu are nevoie de acces la fișierele Google: scrie prin consolă.',
      keys: [['Conturi', '#profesori']]
    },
    {
      id: 'pleaca-profesor', title: 'Un profesor pleacă', sub: 'Ce se întâmplă cu contul, registrul și clasele lui.',
      steps: [
        ['Ștergi profesorul.', 'La Conturi, tab-ul „Profesori”, butonul „Șterge”. Contul lui rămâne ca cont de elev, registrele lui se dezleagă de el, iar clasele trec la admin.'],
        ['Hotărăști ce faci cu registrul.', 'Fișierul rămâne în Drive, cu tot istoricul. Îl poți muta într-un dosar de arhivă sau îl poți da altui profesor: la Sincronizare, legi registrul de contul noului profesor.'],
        ['Îi scoți accesul.', 'În Google, la „Distribuie”, îi scoți dreptul de Editor pe registrul lui.']
      ],
      note: 'Elevii nu se pierd: rămân în registru. Verifică după aceea la Clase că grupele au din nou un profesor legat.',
      keys: [['Conturi', '#profesori'], ['Sincronizare', '#sincronizare']]
    },
    {
      id: 'pleaca-manager', title: 'Un manager pleacă', sub: 'Contul și numele lui din listele registrelor.',
      steps: [
        ['Ștergi managerul.', 'La Conturi, tab-ul „Manageri”, butonul „Șterge”. Nu mai poate intra în consolă.'],
        ['Numele lui rămâne în lista din registre.', 'Platforma nu-l scoate de acolo, iar elevii înscriși de el îl au scris. Cel mai simplu e să-l lași în listă, nu deranjează. Dacă vrei totuși să-l scoți, o faci de mână în fișierul-mamă, dar numai după ce nu-l mai are niciun elev scris.']
      ],
      keys: [['Conturi', '#profesori']]
    },
    {
      id: 'elev', title: 'Înscriu un elev', sub: 'Pentru manageri și admin, când un părinte sună.',
      steps: [
        ['Deschide Înscriere.', 'În stânga scrii ce spune părintele: materia, clasa, formatul (Offline sau Online) și nivelul. Poți alege mai multe niveluri.'],
        ['Alege grupa.', 'Apar doar grupele active care se potrivesc. Dacă nu se potrivește niciuna, tab-ul „Grupă nouă” (vezi „Creez o grupă nouă”).'],
        ['Completează elevul.', 'Numele, prenumele și telefonul părintelui. Câmpul „Managerul” pornește pe numele tău. Îl schimbi doar dacă înscrii pentru un coleg.'],
        ['Apasă „Înscrie elevul”.', 'Elevul apare în registrul profesorului cu statutul „Oră de probă”, cu managerul scris la el. Prima lecție e gratuită. Când părintele plătește, statutul devine „Activ”.']
      ],
      note: 'Dacă apare „Managerul … nu e în lista din CONFIGURARI”, numele managerului lipsește din lista registrului. Vezi „Adaug un manager nou”.',
      keys: [['Înscriere', '#inscriere']]
    },
    {
      id: 'grupa', title: 'Creez o grupă nouă', sub: 'Din Înscriere, când nu există nicio grupă potrivită.',
      steps: [
        ['Înscriere, tab-ul „Grupă nouă”.', 'Alegi materia, clasa, formatul și nivelul, apoi profesorul și intervalul orar din ce propune platforma.'],
        ['Orarul respectă regula.', 'Două ore consecutive în aceeași zi, sau o oră în două zile diferite. Lecțiile individuale nu au oră de probă.'],
        ['Confirmi cu primul elev.', 'Grupa se creează în registrul profesorului, cu starea „Se completează”.'],
        ['Pornește singură.', 'Când are destui elevi înscriși, starea devine „Startează”. De exemplu 4 din 6, sau 2 din 3. Pentru celelalte mărimi regula nu e confirmată încă.']
      ],
      keys: [['Înscriere', '#inscriere'], ['Orar', '#orar']]
    },
    {
      id: 'start', title: 'O grupă e gata de start', sub: 'Ce se întâmplă când o grupă are destui elevi.',
      steps: [
        ['Platforma întreabă profesorul.', 'Pe Telegram: „Confirmi startul grupei?”, cu elevii, prima lecție și două butoane. Mesajele se trimit doar între 08:00 și 21:00.'],
        ['Tu urmărești la Starturi.', 'Secțiunile sunt: „De sunat” (profesorul a confirmat, sună elevii), „Așteaptă profesorul”, „Nu s-a confirmat” (cu motivul scris de profesor) și „Rezolvate”.'],
        ['Marchezi ce ai făcut.', 'După ce suni elevii, marchezi grupa ca rezolvată.']
      ],
      note: 'Dacă profesorul nu și-a conectat Telegram, nu primește nimic și grupa așteaptă la nesfârșit. Cere-i să-l conecteze din profil.',
      keys: [['Starturi', '#starturi']]
    },
    {
      id: 'schimbari', title: 'Un profesor anulează, mută sau adaugă o lecție', sub: 'Cine află și ce faci tu.',
      steps: [
        ['Profesorul face schimbarea din clasă.', 'Butonul „Modifică lecțiile”. La anulare scrie obligatoriu motivul. Mutarea și lecția în plus nu cer motiv.'],
        ['Elevii sunt anunțați singuri.', 'Primesc un mesaj în clasă și o notificare pe telefon.'],
        ['Managerii află la Schimbări.', 'Fiecare manager vede schimbările grupelor în care are elevi înscriși, tu le vezi pe toate. Cele care ating o lecție din următoarele 24 de ore sunt marcate „Urgent”. Fiecare apasă „Am văzut” pentru ale lui.']
      ],
      note: 'Nu există aprobare: profesorul se înțelege cu elevii, iar managerii și adminul sunt doar anunțați.',
      keys: [['Schimbări', '#schimbari']]
    },
    {
      id: 'sincronizare', title: 'Un registru nu se sincronizează', sub: 'Când datele din platformă nu se potrivesc cu registrul.',
      steps: [
        ['Deschide Sincronizare.', 'Vezi ora ultimei citiri a fiecărui registru și lista de probleme, cu link direct la celula cu pricina.'],
        ['Verifică partajarea.', `Registrul trebuie să fie partajat cu ${ROBOT} ca Editor, direct sau prin dosarul „Registre”. Dacă fișierul a fost mutat în afara dosarului, pierde accesul.`],
        ['Verifică structura.', 'Dacă cineva a redenumit o filă sau a inserat sau șters rânduri sau coloane, citirea se poate strica. Fișierele confidențiale ale adminului citesc din registre, deci astfel de schimbări nu se fac.'],
        ['Repară în Sheets, nu în platformă.', 'Corectezi celula din registru și după un minut platforma o citește. Platforma nu scrie prezențele, tema și data lecției: acelea se scriu doar în registru.']
      ],
      keys: [['Sincronizare', '#sincronizare']]
    },
    {
      id: 'telegram', title: 'Conectez Telegram', sub: 'Pentru profesori și manageri.',
      steps: [
        ['Intră în profil.', 'Pe site (profesor) sau în consolă, la Profil (manager). Apasă „Conectează Telegram”.'],
        ['Apasă Start în Telegram.', 'Se deschide botul MathorizonBot. Apeși Start și contul e legat. Linkul ține 15 minute.'],
        ['Ce primește fiecare.', 'Profesorul primește întrebarea de start și comenzile pentru programul lui (azi, mâine, grupe, salariu și altele). Managerul deocamdată doar se conectează, botul nu-i trimite nimic.']
      ],
      note: 'Pentru oprire, orice persoană scrie /stop în Telegram sau apasă „Deconectează” din profil.',
      keys: [['Profilul meu', '#profil']]
    },
    {
      id: 'invitatie', title: 'Un elev intră în clasă cu codul', sub: 'Elevii nu sunt adăugați de mână în clase.',
      steps: [
        ['Dai codul.', 'Fiecare grupă are un cod de invitație. Îl găsești la Înscriere, la Orar sau la Repartizare, cu butoane pentru copierea invitației sau a codului. Îl poți trimite părintelui.'],
        ['Elevul introduce codul.', 'Pe site, la Clase, își face cont de elev și scrie codul. Trimite astfel o cerere.'],
        ['Profesorul acceptă.', 'Doar profesorul poate accepta, și își leagă elevul de numele lui din registru. Primește o insignă în meniu când are cereri noi.']
      ],
      note: 'După 10 încercări greșite în 15 minute, elevul e blocat temporar. După o respingere poate încerca din nou peste 24 de ore.',
      keys: [['Orar', '#orar']]
    },
    {
      id: 'configurare', title: 'Prima configurare: contul companiei', sub: 'Se face o singură dată, când există contul Google al companiei.',
      steps: [
        ['Creezi dosarul „Registre”', 'în contul Google al companiei. Aici vor sta toate registrele profesorilor.'],
        ['Partajezi dosarul cu platforma.', `Adresa ${ROBOT}, ca Editor. Orice registru pus în dosar devine accesibil platformei automat.`],
        ['Muți fișierul-mamă și registrul tău real în contul companiei.', 'Cel mai sigur e transferul de proprietate: fișierul își păstrează adresa și legăturile nu se rup. O copie are altă adresă și trebuie adăugată din nou la Sincronizare.'],
        ['În fișierul-mamă,', 'tab-ul CONFIGURARI are lacăt. Proprietarul adaugă platforma (adresa de mai sus) ca excepție: Date, Foi și intervale protejate, CONFIGURARI, Schimbă permisiunile. Fără asta, numele managerilor nu se mai scriu singure.'],
        ['Fă o copie de rezervă a fișierului-mamă.', 'Toate registrele își iau tarifele și listele de acolo. Dacă fișierul e șters sau nepartajat, prețurile din registre ies zero.']
      ],
      note: 'Registrele reale trebuie aduse în noul format, cu tarifele din fișierul-mamă. Conversia se face odată pentru toate, cu o copie de siguranță automată.',
      keys: [['Sincronizare', '#sincronizare']]
    }
  ];

  function procHTML(p, open) {
    const steps = p.steps.map(s => `<li><span class="inf-n" aria-hidden="true"></span><p><b>${esc(s[0])}</b> ${esc(s[1])}</p></li>`).join('');
    const keys = (p.keys || []).map(k => `<a class="ax-btn ax-btn--sm" href="${esc(k[1])}">${esc(k[0])} ${ico('arrow-right', 14)}</a>`).join('');
    return `<details class="st-sec inf-sec" id="inf-${esc(p.id)}" data-text="${esc((p.title + ' ' + p.sub + ' ' + (p.need || '') + ' ' + p.steps.map(s => s.join(' ')).join(' ') + ' ' + (p.note || '')).toLowerCase())}"${open ? ' open' : ''}>
      <summary class="st-sec__h"><span class="st-sec__t">${esc(p.title)}</span><span class="ax-sub inf-sub">${esc(p.sub)}</span><span class="st-sec__c" aria-hidden="true">${ico('chevron-down', 18)}</span></summary>
      <div class="st-sec__b"><div class="inf-body">
        ${p.need ? `<p class="inf-need">${esc(p.need)}</p>` : ''}
        <ol class="inf-steps">${steps}</ol>
        ${p.note ? `<p class="inf-note">${esc(p.note)}</p>` : ''}
        ${keys ? `<div class="inf-keys">${keys}</div>` : ''}
      </div></div>
    </details>`;
  }

  const plain = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  window.AdminViews.info = {
    title: 'Info',
    demo: false,
    icon: 'info',
    render(root, ctx) {
      const want = ctx && ctx.query && ctx.query.p;
      root.innerHTML = `
        <header class="ax-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('info', 24)}</span>
            <div>
              <h1 class="ax-h1">Info</h1>
              <p class="ax-sub">Pașii proceselor mai lungi, ca să nu trebuiască să-ți amintești. Dacă un pas nu mai seamănă cu ce vezi pe ecran, spune-i celui care întreține platforma.</p>
            </div>
          </div>
        </header>
        <div class="inf-bar">
          <label class="ax-search"><span class="ax-sr">Caută în pași</span>${ico('search', 16)}<input class="ax-input" id="infQ" type="search" placeholder="Caută: profesor, manager, Telegram, registru…" autocomplete="off"></label>
        </div>
        <div id="infList">${PROCESSES.map(p => procHTML(p, p.id === want)).join('')}</div>
        <p class="st-empty" id="infNone" hidden>Nimic găsit. Încearcă un cuvânt mai scurt, de exemplu „manager” sau „registru”.</p>`;
      const q = root.querySelector('#infQ'), none = root.querySelector('#infNone');
      const filter = () => {
        const w = plain(q.value).trim().split(/\s+/).filter(Boolean);
        let shown = 0;
        root.querySelectorAll('.inf-sec').forEach(d => {
          const hit = !w.length || w.every(x => plain(d.dataset.text).includes(x));
          d.hidden = !hit;
          if (hit) shown++;
          if (w.length && hit) d.open = true;
        });
        none.hidden = shown > 0;
      };
      q.addEventListener('input', filter);
      if (want) { const el = root.querySelector('#inf-' + CSS.escape(want)); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 60); }
    }
  };
})();
