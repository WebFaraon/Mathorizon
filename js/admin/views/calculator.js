/* ============================================================
   Admin console: Calculator (transfer, înlocuire, retur)
   ============================================================
   Three small calculators for the money side of a student's move
   between groups. Every one splits a sum proportionally between
   "Achitări" (what the student paid) and "Reduceri" (the discount
   given), the way the office does it in the sheet:

     transfer   cost of the lessons already held, taken from the old
                group; what is left goes to the new group
     înlocuire  hours x price of a substitute teacher, moved to the
                "Înlocuire" sheet; the rest stays in the main group
     retur      what stays in the register so the balance is 0, and
                what goes back to the student

   The result is live (no button): it updates while you type, and
   each figure has a copy key so it can be pasted into the sheet.
   Pure demo-free logic: nothing is stored or sent anywhere.
   ============================================================ */
(function () {
  'use strict';
  const U = window.AdminUI;
  const { esc, ico } = U;

  /* ---- number helpers (comma or dot, no minus) ---- */
  const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
  const fix = v => { const t = (Math.abs(v) < 0.005 ? 0 : v).toFixed(2); return t; };   // as the sheet shows it (transfer)
  const f2 = v => fix(round2(v));                                                      // rounded first (înlocuire, retur)
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  function parse(raw) {
    const t = String(raw == null ? '' : raw).trim().replace(/\s/g, '').replace(',', '.');
    if (t === '') return { blank: true };
    if (t[0] === '-') return { err: 'Valoarea nu poate fi negativă.' };
    if (!/^\d*\.?\d*$/.test(t) || t === '.') return { err: 'Doar cifre, cu virgulă sau punct (ex: 2808.50).' };
    return { v: parseFloat(t) };
  }

  /* ---- what each calculator asks for ---- */
  const F = {
    ach: { tone: 'ach', unit: 'lei' },
    red: { tone: 'red', unit: 'lei' },
    cost: { tone: 'cost', unit: 'lei' },
    ore: { tone: 'ore', unit: 'ore', step: '0.25' },
    pret: { tone: 'pret', unit: 'lei / oră' }
  };
  const MODES = {
    transfer: {
      title: 'Transfer', icon: 'swap', sub: 'Elev dintr-un grup în altul',
      lede: 'Introdu sumele din grupul vechi. Costul lecțiilor deja ținute se scade proporțional din achitări și din reduceri; restul trece în grupul nou.',
      fields: [
        { id: 'ach', k: 'ach', label: 'Achitări', row: 'Rândul 3', hint: 'banii plătiți de elev', ex: '2808.50' },
        { id: 'red', k: 'red', label: 'Reduceri', row: 'Rândul 4', hint: 'reducerile acordate', ex: '244.00' },
        { id: 'cost', k: 'cost', label: 'Costul lecțiilor', row: 'Rândul 5', hint: 'lecțiile deja ținute', ex: '872.00' }
      ],
      sample: ['2808.50', '244.00', '872.00'],
      how: ['Proporția achitărilor = Achitări ÷ (Achitări + Reduceri), la fel pentru reduceri.', 'Consumat în grupul vechi = Costul lecțiilor × proporția fiecăreia.', 'Rămâne pentru grupul nou = ce ai introdus − ce s-a consumat. Soldul grupului vechi devine 0.']
    },
    inlocuire: {
      title: 'Înlocuire', icon: 'users', sub: 'Ore făcute de un înlocuitor',
      lede: 'Introdu orele și prețul unei ore, apoi achitările și reducerile din grupul principal. Suma se împarte proporțional: o treci în foaia „Înlocuire", restul rămâne în grupul principal.',
      fields: [
        { id: 'ore', k: 'ore', label: 'Număr de ore', hint: 'orele făcute de înlocuitor', ex: '8.5' },
        { id: 'pret', k: 'pret', label: 'Preț pe oră', hint: 'tariful unei ore', ex: '150.00' },
        { id: 'ach', k: 'ach', label: 'Achitări', row: 'Grup principal', hint: 'banii plătiți de elev', ex: '3500.50' },
        { id: 'red', k: 'red', label: 'Reduceri', row: 'Grup principal', hint: 'reducerile acordate', ex: '450.00' }
      ],
      sample: ['8.5', '150.00', '3500.50', '450.00'],
      how: ['Total înlocuire = Număr de ore × Preț pe oră (nu poate depăși Achitări + Reduceri).', 'Din Achitări treci în „Înlocuire" Total × proporția achitărilor; din Reduceri, restul.', 'În grupul principal rămâne diferența, la fiecare.']
    },
    retur: {
      title: 'Retur', icon: 'wallet', sub: 'Banii care se întorc elevului',
      lede: 'Introdu achitările, reducerile și costul lecțiilor. Vezi ce sumă se returnează și ce valori rămân în registru, ca soldul să iasă 0.',
      fields: [
        { id: 'ach', k: 'ach', label: 'Achitări', row: 'Rândul 3', hint: 'banii plătiți de elev', ex: '2808.00' },
        { id: 'red', k: 'red', label: 'Reduceri', row: 'Rândul 4', hint: 'reducerile acordate', ex: '244.00' },
        { id: 'cost', k: 'cost', label: 'Costul lecțiilor', row: 'Rândul 5', hint: 'lecțiile deja ținute', ex: '872.00' }
      ],
      sample: ['2808.00', '244.00', '872.00'],
      how: ['În registru rămân valori care însumează exact costul lecțiilor, împărțite proporțional între achitări și reduceri.', 'Se returnează doar din achitări (banii reali ai elevului): Achitări − Achitări noi.', 'Dacă costul depășește Achitări + Reduceri, elevul mai datorează diferența.']
    }
  };
  const ORDER = ['transfer', 'inlocuire', 'retur'];

  /* ---- the three calculations (formulas as in the office sheet) ---- */
  function calcTransfer(x) {
    const total = x.ach + x.red;
    if (total === 0) return { error: 'Achitări + Reduceri nu poate fi 0.' };
    const pa = x.ach / total, pr = x.red / total;
    const achC = x.cost * pa, redC = x.cost * pr;
    const d = { total, pa, pr, achC, redC, achRem: x.ach - achC, redRem: x.red - redC, ach: x.ach, red: x.red, cost: x.cost };
    if (x.cost > total + 1e-9) d.warn = `Costul lecțiilor (${f2(x.cost)}) e mai mare decât Achitări + Reduceri (${f2(total)}): valorile rămase ies negative. Verifică sumele.`;
    return { d };
  }
  function calcInlocuire(x) {
    if (x.ore <= 0 || x.pret <= 0) return { error: 'Numărul de ore și prețul pe oră trebuie să fie mai mari ca 0.' };
    const total = x.ach + x.red;
    if (total === 0) return { error: 'Achitări + Reduceri (grup principal) nu poate fi 0.' };
    const tot = x.ore * x.pret;
    if (tot > total + 1e-9) return { error: `Suma pentru înlocuire (${f2(tot)}) este mai mare decât Achitări + Reduceri din grupul principal (${f2(total)}).` };
    const pa = x.ach / total, pr = x.red / total;
    const achI = round2(tot * pa);
    const redI = round2(tot - achI);
    return { d: { total, pa, pr, tot, ore: x.ore, pret: x.pret, ach: x.ach, red: x.red, achI, redI, achRem: round2(x.ach - achI), redRem: round2(x.red - redI) } };
  }
  function calcRetur(x) {
    const total = x.ach + x.red;
    if (total === 0) return { error: 'Achitări + Reduceri nu poate fi 0.' };
    const pa = x.ach / total, pr = x.red / total;
    const achNew = round2(x.cost * pa), redNew = round2(x.cost * pr);
    const achC = round2(x.ach - achNew), redC = round2(x.red - redNew);
    const owes = total < x.cost ? round2(x.cost - total) : 0;
    const back = round2(achC);
    const outcome = owes > 0 ? 'owes' : back > 0 ? 'back' : 'exact';
    return { d: { total, pa, pr, ach: x.ach, red: x.red, cost: x.cost, achNew, redNew, achC, redC, owes, back, outcome } };
  }
  const CALC = { transfer: calcTransfer, inlocuire: calcInlocuire, retur: calcRetur };

  /* ---- state that survives leaving the page ---- */
  const S = { mode: 'transfer', vals: { transfer: {}, inlocuire: {}, retur: {} } };
  let rootEl = null, lastKind = null;

  /* ---- markup ---- */
  function tabsHTML() {
    return `
      <div class="cl-tabs" role="tablist" aria-label="Tipul calculului">
        ${ORDER.map(id => {
          const m = MODES[id];
          return `<button type="button" role="tab" class="cl-tab" id="clTab-${id}" data-mode="${id}" aria-selected="${id === S.mode}" aria-controls="clPanel" tabindex="${id === S.mode ? 0 : -1}">
            <span class="cl-tab__pic">${ico(m.icon, 22)}</span>
            <span class="cl-tab__t"><b>${esc(m.title)}</b><small>${esc(m.sub)}</small></span>
          </button>`;
        }).join('')}
      </div>`;
  }

  function fieldHTML(f, i) {
    const def = F[f.k];
    const val = S.vals[S.mode][f.id] || '';
    return `
      <div class="cl-f cl-t--${def.tone}" data-arrive style="--i:${i}">
        <label class="cl-f__l" for="clIn-${f.id}">
          ${f.row ? `<span class="cl-f__row">${esc(f.row)}</span>` : ''}
          <b>${esc(f.label)}</b>
          <small>${esc(f.hint)}</small>
        </label>
        <div class="cl-f__in">
          <input id="clIn-${f.id}" data-f="${f.id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="${esc(f.ex)}" value="${esc(val)}" aria-describedby="clErr-${f.id}">
          <span class="cl-f__u">${esc(def.unit)}</span>
        </div>
        <p class="cl-f__err" id="clErr-${f.id}" role="alert" hidden></p>
      </div>`;
  }

  function formHTML() {
    const m = MODES[S.mode];
    return `
      <div class="cl-form__head">
        <div><h2 class="ax-h2">${esc(m.title)}</h2><p class="cl-lede">${esc(m.lede)}</p></div>
      </div>
      <div class="cl-fields">${m.fields.map(fieldHTML).join('')}</div>
      <div class="cl-form__act">
        <button type="button" class="ax-btn ax-btn--sm" id="clSample">${ico('lightbulb', 16)} Completează un exemplu</button>
        <button type="button" class="ax-btn ax-btn--sm" id="clReset">${ico('undo', 16)} Golește</button>
      </div>
      <details class="cl-how">
        <summary>${ico('info', 16)} Cum se calculează</summary>
        <ol>${m.how.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
      </details>`;
  }

  const cell = (k, label, sub, tone, big) => `
    <div class="cl-cell cl-t--${tone}${big ? ' cl-cell--big' : ''}">
      <span class="cl-cell__l"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
      <output class="cl-cell__v" data-v="${k}">0.00</output>
      <button type="button" class="cl-copy" data-copy="${k}" aria-label="Copiază ${esc(label)}" title="Copiază">${ico('copy', 16)}</button>
    </div>`;
  const note = (kind, html) => `<p class="cl-note cl-note--${kind}">${ico(kind === 'ok' ? 'check' : kind === 'warn' ? 'alert' : 'info', 16)}<span>${html}</span></p>`;
  const card = (cls, icon, title, sub, body) => `
    <article class="cl-card ${cls}" data-arrive>
      <header class="cl-card__h"><span class="cl-card__pic">${ico(icon, 20)}</span><div><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div></header>
      <div class="cl-card__b">${body}</div>
    </article>`;
  const meter = (id, label, tone, aLabel, bLabel) => `
    <div class="cl-meter cl-t--${tone}">
      <div class="cl-meter__h"><b>${esc(label)}</b><span data-v="${id}Tot"></span></div>
      <span class="cl-bar" role="img" aria-label="${esc(label)}"><i class="cl-bar__a" data-bar="${id}A"></i><i class="cl-bar__b" data-bar="${id}B"></i></span>
      <div class="cl-meter__k"><span><i class="cl-sw cl-sw--a"></i>${esc(aLabel)} <b data-v="${id}AV"></b></span><span><i class="cl-sw cl-sw--b"></i>${esc(bLabel)} <b data-v="${id}BV"></b></span></div>
    </div>`;
  const split = () => `
    <div class="cl-split">
      <div class="cl-split__h"><b>Proporția din total</b><span data-v="splitTot"></span></div>
      <span class="cl-bar cl-bar--split" role="img" aria-label="Proporția achitărilor și a reducerilor"><i class="cl-bar__a cl-t--ach" data-bar="splitA"></i><i class="cl-bar__b cl-t--red" data-bar="splitB"></i></span>
      <div class="cl-meter__k"><span><i class="cl-sw cl-sw--ach"></i>Achitări <b data-v="splitAV"></b></span><span><i class="cl-sw cl-sw--red"></i>Reduceri <b data-v="splitBV"></b></span></div>
    </div>`;

  /* one template per mode and per outcome; values are filled in place */
  function resultHTML(mode, d) {
    if (mode === 'transfer') {
      return `
        ${d.warn ? note('warn', esc(d.warn)) : ''}
        <div class="cl-cards">
          ${card('cl-card--old', 'arrow-up-right', 'În grupul vechi', 'de unde pleacă elevul', `
            <p class="cl-lead">Introdu în celule:</p>
            ${cell('achC', 'Achitări', 'rândul 3', 'ach')}
            ${cell('redC', 'Reduceri', 'rândul 4', 'red')}
            ${note('ok', 'Soldul (E2) devine automat <b>0.00</b>.')}
            ${note('info', 'Adaugă un comentariu în grupul vechi și schimbă statusul în <span class="ax-st ax-st--transferat"><i class="ax-st__i"></i>Transferat</span>.')}`)}
          ${card('cl-card--new', 'arrow-right', 'În grupul nou', 'unde vine elevul', `
            <p class="cl-lead">Introdu în celule:</p>
            ${cell('achRem', 'Achitări', 'rândul 3', 'ach')}
            ${cell('redRem', 'Reduceri', 'rândul 4', 'red')}
            ${note('ok', 'Soldul inițial în grupul nou: <b data-v="sumRem"></b>.')}
            ${note('info', 'Adaugă un comentariu și în grupul nou.')}`)}
        </div>
        <section class="cl-viz" aria-label="Cum s-a împărțit costul">
          <h3>Cum s-a împărțit costul lecțiilor <small data-v="costTxt"></small></h3>
          ${split()}
          ${meter('mA', 'Achitări', 'ach', 'consumat', 'rămas')}
          ${meter('mR', 'Reduceri', 'red', 'consumat', 'rămas')}
        </section>`;
    }
    if (mode === 'inlocuire') {
      return `
        <div class="cl-cards">
          ${card('cl-card--old', 'arrow-up-right', 'În foaia „Înlocuire"', 'ce treci acolo', `
            <div class="cl-total"><span>Total înlocuire</span><b data-v="tot">0.00</b><small data-v="totTxt"></small></div>
            ${cell('achI', 'Achitări', 'scoase proporțional', 'ach')}
            ${cell('redI', 'Reduceri', 'scoase proporțional', 'red')}
            ${note('ok', 'Total în foaia „Înlocuire": <b data-v="sumI"></b>.')}`)}
          ${card('cl-card--new', 'arrow-right', 'În grupul principal', 'ce rămâne după scădere', `
            <p class="cl-lead">Scazi suma din registrul principal:</p>
            ${cell('achRem', 'Achitări rămase', '', 'ach')}
            ${cell('redRem', 'Reduceri rămase', '', 'red')}
            ${note('ok', 'Total rămas în grupul principal: <b data-v="sumRem"></b>.')}`)}
        </div>
        <section class="cl-viz" aria-label="Cum s-a împărțit suma">
          <h3>Cum s-a împărțit suma de înlocuire</h3>
          ${split()}
          ${meter('mA', 'Achitări', 'ach', 'în „Înlocuire"', 'rămas')}
          ${meter('mR', 'Reduceri', 'red', 'în „Înlocuire"', 'rămas')}
        </section>`;
    }
    // retur
    const hero = {
      back: ['cl-hero--back', 'Suma de returnat', 'Trebuie să o returnezi elevului, din achitări.', 'check'],
      owes: ['cl-hero--owes', 'Elevul mai datorează', 'Costul lecțiilor depășește achitări + reduceri.', 'alert'],
      exact: ['cl-hero--exact', 'Sold exact', 'Fără retur: achitările acoperă exact lecțiile.', 'check']
    }[d.outcome];
    return `
      <section class="cl-hero ${hero[0]}" data-arrive>
        <span class="cl-hero__pic">${ico(hero[3], 26)}</span>
        <div><p>${esc(hero[1])}</p><b data-v="heroV">0.00</b><small>${esc(hero[2])}</small></div>
        <button type="button" class="cl-copy cl-copy--hero" data-copy="heroV" aria-label="Copiază suma" title="Copiază">${ico('copy', 18)}</button>
      </section>
      <div class="cl-cards">
        ${card('cl-card--new', 'arrow-right', 'Noile valori în registru', 'după retur', `
          <p class="cl-lead">Introdu în celule:</p>
          ${cell('achNew', 'Achitări noi', 'rândul 3', 'ach')}
          ${cell('redNew', 'Reduceri noi', 'rândul 4', 'red')}
          ${note('ok', 'Verificare: <b data-v="sumNew"></b> (sold final) = <b data-v="costV"></b> (costul lecțiilor).')}`)}
        ${d.outcome === 'owes' ? '' : card('cl-card--old', 'arrow-up-right', 'Ce iese din registru', 'din ce a introdus', `
          ${cell('achC', 'Din achitări', 'se returnează', 'ach')}
          ${cell('redC', 'Din reduceri', 'se anulează, nu se returnează', 'red')}
          ${note('info', 'Din total: <b data-v="totalV"></b> = <b data-v="achV"></b> achitări + <b data-v="redV"></b> reduceri.')}`)}
      </div>
      ${d.outcome === 'owes' ? '' : `
      <section class="cl-viz" aria-label="Cum se împarte">
        <h3>Ce rămâne și ce iese</h3>
        ${split()}
        ${meter('mA', 'Achitări', 'ach', 'rămâne în registru', 'se returnează')}
        ${meter('mR', 'Reduceri', 'red', 'rămâne în registru', 'se anulează')}
      </section>`}`;
  }

  /* ---- paint ---- */
  function setV(el, text) {
    if (!el || el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('is-upd'); void el.offsetWidth; el.classList.add('is-upd');
  }
  function V(k, text) { rootEl.querySelectorAll(`[data-v="${k}"]`).forEach(e => setV(e, text)); }
  function B(k, a) { const el = rootEl.querySelector(`[data-bar="${k}"]`); if (el) el.style.width = Math.max(0, Math.min(100, a)).toFixed(2) + '%'; }

  function fillValues(mode, d) {
    if (mode === 'transfer') {
      V('achC', fix(d.achC)); V('redC', fix(d.redC)); V('achRem', fix(d.achRem)); V('redRem', fix(d.redRem));
      V('sumRem', `${fix(d.achRem)} + ${fix(d.redRem)} = ${fix(d.achRem + d.redRem)}`);
      V('costTxt', `· ${f2(d.cost)} lei`);
      V('splitTot', `${f2(d.total)} lei`); V('splitAV', `${f2(d.ach)} · ${pct(d.ach, d.total)}%`); V('splitBV', `${f2(d.red)} · ${pct(d.red, d.total)}%`);
      B('splitA', d.pa * 100); B('splitB', d.pr * 100);
      V('mATot', `${f2(d.ach)} lei`); V('mAAV', fix(d.achC)); V('mABV', fix(d.achRem)); B('mAA', d.ach ? (d.achC / d.ach) * 100 : 0); B('mAB', d.ach ? (d.achRem / d.ach) * 100 : 0);
      V('mRTot', `${f2(d.red)} lei`); V('mRAV', fix(d.redC)); V('mRBV', fix(d.redRem)); B('mRA', d.red ? (d.redC / d.red) * 100 : 0); B('mRB', d.red ? (d.redRem / d.red) * 100 : 0);
    } else if (mode === 'inlocuire') {
      V('tot', f2(d.tot)); V('totTxt', `${f2(d.ore)} ore × ${f2(d.pret)} lei`);
      V('achI', f2(d.achI)); V('redI', f2(d.redI)); V('sumI', `${f2(d.achI)} + ${f2(d.redI)} = ${f2(d.achI + d.redI)}`);
      V('achRem', f2(d.achRem)); V('redRem', f2(d.redRem)); V('sumRem', `${f2(d.achRem)} + ${f2(d.redRem)} = ${f2(d.achRem + d.redRem)}`);
      V('splitTot', `${f2(d.total)} lei`); V('splitAV', `${f2(d.ach)} · ${pct(d.ach, d.total)}%`); V('splitBV', `${f2(d.red)} · ${pct(d.red, d.total)}%`);
      B('splitA', d.pa * 100); B('splitB', d.pr * 100);
      V('mATot', `${f2(d.ach)} lei`); V('mAAV', f2(d.achI)); V('mABV', f2(d.achRem)); B('mAA', d.ach ? (d.achI / d.ach) * 100 : 0); B('mAB', d.ach ? (d.achRem / d.ach) * 100 : 0);
      V('mRTot', `${f2(d.red)} lei`); V('mRAV', f2(d.redI)); V('mRBV', f2(d.redRem)); B('mRA', d.red ? (d.redI / d.red) * 100 : 0); B('mRB', d.red ? (d.redRem / d.red) * 100 : 0);
    } else {
      V('heroV', d.outcome === 'owes' ? f2(d.owes) : d.outcome === 'back' ? f2(d.back) : '0.00');
      V('achNew', f2(d.achNew)); V('redNew', f2(d.redNew)); V('sumNew', f2(d.achNew + d.redNew)); V('costV', f2(d.cost));
      V('achC', f2(d.achC)); V('redC', f2(d.redC)); V('totalV', f2(d.total)); V('achV', f2(d.ach)); V('redV', f2(d.red));
      V('splitTot', `${f2(d.total)} lei`); V('splitAV', `${f2(d.ach)} · ${pct(d.ach, d.total)}%`); V('splitBV', `${f2(d.red)} · ${pct(d.red, d.total)}%`);
      B('splitA', d.pa * 100); B('splitB', d.pr * 100);
      V('mATot', `${f2(d.ach)} lei`); V('mAAV', f2(d.achNew)); V('mABV', f2(d.achC)); B('mAA', d.ach ? (d.achNew / d.ach) * 100 : 0); B('mAB', d.ach ? (d.achC / d.ach) * 100 : 0);
      V('mRTot', `${f2(d.red)} lei`); V('mRAV', f2(d.redNew)); V('mRBV', f2(d.redC)); B('mRA', d.red ? (d.redNew / d.red) * 100 : 0); B('mRB', d.red ? (d.redC / d.red) * 100 : 0);
    }
  }

  function emptyHTML() {
    const m = MODES[S.mode];
    return `
      <div class="cl-empty" data-arrive>
        <span class="cl-empty__pic">${ico('calculator', 30)}</span>
        <h3>Rezultatul apare aici</h3>
        <p>Completează câmpurile din stânga. Calculul se face pe loc, fără buton, iar fiecare cifră are o tastă de copiere ca s-o lipești în foaie.</p>
        <button type="button" class="ax-btn" id="clSample2">${ico('lightbulb', 16)} Încearcă un exemplu</button>
        <ul>${m.fields.map(f => `<li class="cl-t--${F[f.k].tone}"><i></i>${esc(f.label)}${f.row ? ` <small>${esc(f.row.toLowerCase())}</small>` : ''}</li>`).join('')}</ul>
      </div>`;
  }
  function errorHTML(msg) {
    return `<div class="cl-error" role="alert" data-arrive><span class="cl-error__hz ax-hazard" aria-hidden="true"></span><div>${ico('alert', 22)}<b>Nu se poate calcula</b><p>${esc(msg)}</p></div></div>`;
  }

  function paint() {
    const out = rootEl.querySelector('#clOut');
    const mode = S.mode, m = MODES[mode];
    const x = {}; let blank = false, bad = false;
    m.fields.forEach(f => {
      const p = parse(S.vals[mode][f.id]);
      const wrap = rootEl.querySelector(`[data-f="${f.id}"]`);
      const err = rootEl.querySelector(`#clErr-${f.id}`);
      const showErr = !!p.err;
      if (wrap) wrap.setAttribute('aria-invalid', showErr ? 'true' : 'false');
      if (err) { err.hidden = !showErr; err.textContent = p.err || ''; }
      if (wrap) wrap.closest('.cl-f').classList.toggle('is-bad', showErr);
      if (p.blank) blank = true; else if (p.err) bad = true; else x[f.id] = p.v;
    });
    let kind, res = null;
    if (bad) kind = 'fix';
    else if (blank) kind = 'empty';
    else { res = CALC[mode](x); kind = res.error ? 'error' : 'ready:' + (res.d.outcome || '') + (res.d.warn ? ':w' : ''); }
    const key = mode + '|' + kind;
    if (key !== lastKind) {
      lastKind = key;
      if (kind === 'empty') out.innerHTML = emptyHTML();
      else if (kind === 'fix') out.innerHTML = errorHTML('Corectează câmpurile marcate cu roșu.');
      else if (kind === 'error') out.innerHTML = errorHTML(res.error);
      else out.innerHTML = resultHTML(mode, res.d);
      out.classList.remove('is-in'); void out.offsetWidth; out.classList.add('is-in');
      const s2 = out.querySelector('#clSample2'); if (s2) s2.addEventListener('click', sample);
    } else if (kind === 'error') {
      const p = out.querySelector('.cl-error p'); if (p) p.textContent = res.error;
    }
    if (res && res.d) fillValues(mode, res.d);
  }

  /* ---- events ---- */
  function sample() {
    const m = MODES[S.mode];
    m.fields.forEach((f, i) => { S.vals[S.mode][f.id] = m.sample[i]; const el = rootEl.querySelector(`#clIn-${f.id}`); if (el) el.value = m.sample[i]; });
    paint();
  }
  function reset() {
    S.vals[S.mode] = {};
    rootEl.querySelectorAll('.cl-f input').forEach(i => { i.value = ''; });
    paint();
    const first = rootEl.querySelector('.cl-f input'); if (first) first.focus();
  }
  function copy(key) {
    const el = rootEl.querySelector(`[data-v="${key}"]`);
    if (!el) return;
    const text = el.textContent.trim();
    const done = () => U.toast('Copiat: ' + esc(text));
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) { /* no clipboard */ }
      t.remove(); done();
    }
  }
  function setMode(mode, focusTab) {
    if (!MODES[mode] || mode === S.mode) return;
    S.mode = mode; lastKind = null;
    U.writeQuery({ mod: mode === 'transfer' ? null : mode });
    rootEl.querySelector('.cl-tabs').outerHTML = tabsHTML();
    const form = rootEl.querySelector('#clForm');
    form.classList.remove('is-in'); void form.offsetWidth;
    form.innerHTML = formHTML();
    form.classList.add('is-in');
    wireForm(); wireTabs();
    paint();
    if (focusTab) { const t = rootEl.querySelector(`#clTab-${mode}`); if (t) t.focus(); }
  }
  function wireTabs() {
    const tabs = Array.from(rootEl.querySelectorAll('.cl-tab'));
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => setMode(t.dataset.mode));
      t.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); setMode(tabs[(i + d + tabs.length) % tabs.length].dataset.mode, true); }
      });
    });
  }
  function wireForm() {
    rootEl.querySelectorAll('.cl-f input').forEach(inp => {
      inp.addEventListener('input', () => { S.vals[S.mode][inp.dataset.f] = inp.value; paint(); });
    });
    rootEl.querySelector('#clSample').addEventListener('click', sample);
    rootEl.querySelector('#clReset').addEventListener('click', reset);
  }

  window.AdminViews.calculator = {
    title: 'Calculator',
    icon: 'calculator',
    demo: false,
    render(root, ctx) {
      rootEl = root;
      if (MODES[ctx.query.mod]) S.mode = ctx.query.mod;
      lastKind = null;
      root.innerHTML = `
        <header class="ax-head cl-head">
          <div class="ax-head__t">
            <span class="ax-plate">${ico('calculator', 24)}</span>
            <div>
              <h1 class="ax-h1">Calculator</h1>
              <p class="ax-lede">Transfer, înlocuire și retur: sumele se împart proporțional între achitări și reduceri, ca în foaia de lucru.</p>
            </div>
          </div>
        </header>
        ${tabsHTML()}
        <div class="cl-grid">
          <section class="ax-panel cl-form is-in" id="clForm" aria-label="Date de intrare">${formHTML()}</section>
          <section class="cl-out" id="clOut" aria-live="polite" aria-label="Rezultat"></section>
        </div>`;
      wireTabs(); wireForm();
      root.querySelector('#clOut').addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copy(b.dataset.copy); });
      paint();
    }
  };
})();
