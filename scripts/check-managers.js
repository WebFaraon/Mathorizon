/* Checks of the managers list: the name key (the same name in any order, without diacritics) and where new managers go in CONFIGURARI!B.
   Run: npm run check:managers */
'use strict';
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
(async () => {
  const { nameKey, planManagerList, FIRST_ROW, LAST_ROW } = await import('../supabase/functions/_shared/registru/manager-list.mjs');
  ok(nameKey('Cerchez Cristina') === nameKey('cristina  CERCHEZ'), 'the order and the case do not matter');
  ok(nameKey('Pricinoc Ariadna') === nameKey('Pricinoc Ariadna '), 'spaces at the end');
  ok(nameKey('Bălățel Cristina') === nameKey('Balatel Cristina'), 'diacritics');
  ok(nameKey('Șerban Ion') === nameKey('Serban Ion') && nameKey('Țurcanu Ana') === nameKey('Turcanu Ana'), 'S and T with comma below');
  ok(nameKey('Ion Popescu') !== nameKey('Ion Popescu Maria'), 'a different name is another key');
  ok(nameKey('') === '' && nameKey(null) === '', 'empty');

  const col = n => { const a = Array(LAST_ROW - FIRST_ROW + 1).fill(''); ['Anghel Cristina', 'Lipovan Alexandru', 'Vieru Carolina'].slice(0, n).forEach((x, i) => { a[i] = x; }); return a; };
  let p = planManagerList(col(3), [{ id: 'a', name: 'Nou Manager' }]);
  ok(p.add.length === 1 && p.add[0].row === FIRST_ROW + 3 && p.present.length === 0, 'a new name goes under the last filled cell');
  p = planManagerList(col(3), [{ id: 'a', name: 'Cristina Anghel' }]);
  ok(p.add.length === 0 && p.present[0] === 'a', 'a name already there (other order) is not added twice');
  p = planManagerList(col(3), [{ id: 'a', name: 'Doi Unu' }, { id: 'b', name: 'Doi Unu' }, { id: 'c', name: 'Trei Unu' }]);
  ok(p.add.length === 2 && p.add[0].row === FIRST_ROW + 3 && p.add[1].row === FIRST_ROW + 4 && p.present.includes('b'), 'two new names in a row, a repeated one only once');
  const gap = col(3); gap[10] = 'Dupa Gol';
  p = planManagerList(gap, [{ id: 'a', name: 'Alt Nume' }]);
  ok(p.add[0].row === FIRST_ROW + 11, 'after the last filled cell, not into a gap');
  const fullCol = Array(LAST_ROW - FIRST_ROW + 1).fill('x y');
  p = planManagerList(fullCol, [{ id: 'a', name: 'Fara Loc' }]);
  ok(p.add.length === 0 && p.full[0] === 'a', 'no room left: reported, nothing written');
  p = planManagerList(col(0), [{ id: 'a', name: 'Primul Manager' }]);
  ok(p.add[0].row === FIRST_ROW, 'an empty column starts at B2');
  p = planManagerList(col(3), []);
  ok(p.add.length === 0 && p.present.length === 0, 'nobody to add');

  console.log(`MANAGERS: ${pass} checks passed, ${fail} failed`);
  fails.forEach(f => console.log('  FAIL:', f));
  process.exit(fail ? 1 : 0);
})();
