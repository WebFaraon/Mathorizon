/* ============================================================
   Verificarea de LĂȚIME a explicațiilor, într-un browser real.

   Regulile din _explicatie-rules.js se verifică din text. Ce nu se poate
   verifica din text e dacă o formulă ÎNCAPE, și asta depinde de fonturile
   KaTeX, de CSS și de lățimea ecranului. De aceea explicațiile se randează
   aici cu CSS-ul real (css/style.css), cu js/utils.js real (deci cu
   BM.trustedNl2br și BM.renderMath reale, nu copii) și cu KaTeX-ul de pe CDN
   pe care îl încarcă și paginile. BM.fitDisplayMath NU se apelează: vrem
   lățimea naturală, adică ce ar trebui să facă rețeaua de siguranță.

   Două verificări, pe lățimile 320 / 390 / 768 / 1280:
     1. VIZIBILITATE: nimic din explicație nu iese din zona vizibilă a
        modalului. .rarity-modal__body are overflow-x:hidden, deci ce iese e
        tăiat fără nicio urmă. Se măsoară față de modal, NU față de propria
        cutie a elementului: un bloc mai lat decât părintele lui își vede
        propriile margini în regulă și tot iese.
     2. LĂȚIME NATURALĂ: o formulă $$...$$ trebuie să încapă cu cel mult 15%
        micșorare (MIN_RATIO). Sub asta, textul devine prea mic ca să fie
        citit pe telefon și formula trebuie spartă pe rânduri.

   Oglindește markup-ul lui buildRarityModalBody din js/category.js. Dacă
   acela se schimbă, se schimbă și aici.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist';
const MIN_RATIO = 0.85;
const WIDTHS = [320, 390, 768, 1280];

function loadPlaywright() {
  try { return require(path.join(ROOT, 'node_modules', 'playwright')); }
  catch (e) { return null; }
}

function pageHtml(items, css, utilsSrc) {
  // "<" scapat, ca un </script> din continut sa nu inchida tagul
  const data = JSON.stringify(items).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${KATEX}/katex.min.css">
<style>${css}</style></head><body>
<div class="classes-modal rarity-modal" data-rarity="rar">
  <div class="classes-modal__dialog rarity-modal__dialog">
    <div class="rarity-modal__head"><span class="rarity-badge">rar</span></div>
    <div class="rarity-modal__body">
      <div class="rarity-modal__barem-content" id="steps"></div>
    </div>
  </div>
</div>
<script src="${KATEX}/katex.min.js"></script>
<script src="${KATEX}/contrib/auto-render.min.js"></script>
<script>
  window.BM = window.BM || {};
  window.BM.onNavReady = function () {};
  ${utilsSrc}
  window.__items = ${data};
  document.getElementById('steps').innerHTML = window.__items.map(function (it, i) {
    return '<div class="rarity-step">' +
      '<span class="rarity-step__num">' + (i + 1) + '</span>' +
      '<div class="rarity-step__crit math-content">' + BM.trustedNl2br(it.criterion || 'Criteriu') + '</div>' +
      '<span class="rarity-step__pts">' + (it.points || 2) + 'p</span>' +
      (it.explicatie ? '<div class="rarity-step__detail math-content">' + BM.trustedNl2br(it.explicatie) + '</div>' : '') +
    '</div>';
  }).join('');
  BM.renderMath(document.body);
  // Fonturile KaTeX vin de pe CDN: pana ajung, formulele se masoara cu un font
  // de rezerva, mai ingust. Se asteapta, altfel masuratoarea minte.
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
    .then(function () { setTimeout(function () { window.__ready = true; }, 200); });
</script>
</body></html>`;
}

/* items: [{ criterion, points, explicatie }]
   Întoarce { available, reason?, problems: string[][] } (problems[i] pentru items[i]). */
async function lintLayout(items, opts = {}) {
  const widths = opts.widths || WIDTHS;
  const pw = loadPlaywright();
  if (!pw) return { available: false, reason: 'playwright nu e instalat (npm i -D playwright)', problems: items.map(() => []) };

  const css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
  const utilsSrc = fs.readFileSync(path.join(ROOT, 'js', 'utils.js'), 'utf8');
  const html = pageHtml(items, css, utilsSrc);

  const problems = items.map(() => new Set());
  let browser;
  try {
    browser = await pw.chromium.launch();
    for (const w of widths) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: 900 },
        deviceScaleFactor: 1,
        isMobile: w < 500,
        hasTouch: w < 500
      });
      const page = await ctx.newPage();
      await page.setContent(html, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 45000 });

      const res = await page.evaluate(({ MIN_RATIO, w }) => {
        const out = [];
        const body = document.querySelector('.rarity-modal__body');
        const bcs = getComputedStyle(body);
        const br = body.getBoundingClientRect();
        const visRight = br.right - parseFloat(bcs.paddingRight) - (body.offsetWidth - body.clientWidth);

        document.querySelectorAll('.rarity-step').forEach((step) => {
          const msgs = [];
          const det = step.querySelector('.rarity-step__detail');
          if (!det) { out.push(msgs); return; }

          // 1. vizibilitate
          let worst = 0, worstWhat = '';
          const walker = document.createTreeWalker(det, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            if (!node.textContent.trim()) continue;
            // .katex-mathml e varianta MathML pentru cititoare de ecran,
            // decupata la 1px: pozitia ei nu e ce vede elevul.
            if (node.parentElement && node.parentElement.closest('.katex-mathml')) continue;
            // Textul dintr-o formula display deruleaza in interiorul ei; il
            // judeca verificarea 2 (lățime naturală), nu aceasta. Cutia
            // formulei fata de modal se verifica mai jos.
            if (node.parentElement && node.parentElement.closest('.katex-display')) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rc of range.getClientRects()) {
              const over = rc.right - visRight;
              if (over > worst) { worst = over; worstWhat = node.textContent.trim().slice(0, 28); }
            }
          }
          det.querySelectorAll('.katex').forEach((k) => {
            // o formula display scrolleaza in interiorul ei: ce e "iesit" acolo
            // il judeca verificarea 2, nu asta
            if (k.closest('.katex-display')) return;
            const over = k.getBoundingClientRect().right - visRight;
            if (over > worst) { worst = over; worstWhat = '[formula in rand]'; }
          });
          if (worst > 0.5) msgs.push(`la ${w}px iese ${Math.round(worst)}px din zona vizibila a modalului, taiat (langa "${worstWhat}")`);

          const dr = det.getBoundingClientRect();
          if (dr.right > visRight + 0.5) msgs.push(`la ${w}px cutia explicatiei depaseste modalul cu ${Math.round(dr.right - visRight)}px`);

          // 2. latime naturala a formulelor display
          det.querySelectorAll('.katex-display').forEach((d, j) => {
            const over = d.getBoundingClientRect().right - visRight;
            if (over > 0.5) msgs.push(`la ${w}px formula $$ nr. ${j + 1} are cutia cu ${Math.round(over)}px mai lata decat modalul, taiata`);
            const need = d.scrollWidth, avail = d.clientWidth;
            if (need - avail > 1) {
              const ratio = avail / need;
              if (ratio < MIN_RATIO) {
                msgs.push(`formula $$ nr. ${j + 1} are nevoie de ${need}px si are ${avail}px la ${w}px (ar trebui micsorata la ${Math.round(ratio * 100)}%, minim ${Math.round(MIN_RATIO * 100)}%); sparge-o pe randuri cu aligned (regula 8)`);
              }
            }
          });
          out.push(msgs);
        });
        return out;
      }, { MIN_RATIO, w });

      res.forEach((msgs, i) => msgs.forEach(m => problems[i].add(m)));
      await ctx.close();
    }
  } catch (e) {
    return { available: false, reason: 'browserul nu a putut rula verificarea: ' + e.message.split('\n')[0], problems: items.map(() => []) };
  } finally {
    if (browser) await browser.close();
  }
  return { available: true, problems: problems.map(s => [...s]) };
}

module.exports = { lintLayout, MIN_RATIO, WIDTHS };
