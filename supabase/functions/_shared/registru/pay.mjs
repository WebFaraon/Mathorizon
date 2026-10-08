/* The money rules of the teachers' registers (Google Sheets), written once, as they are in the sheets' formulas.
   - the student's price per hour is looked up by the group's format (cell A1: "Grup cu 6 elevi", "Individual 1 elev");
   - a lesson counts for a student (cost) when his mark is exactly PREZENT or ABSENT;
   - what the teacher earns for a lesson depends on how many students are charged for it, on the group's format and
     on the teacher's level (written on every lesson row, 1-6).
   js/admin/registru-data.js keeps a copy of these constants (it runs in the browser); scripts/check-demo-data.js
   compares the two on every combination, so they cannot drift apart.
   Plain ES module, no imports: read by Node (require) and by the Supabase Edge Function (Deno). */

/* preturi, {608, 348, 288, 248, 228, 218, 0, 148}: indexed by the number in "Grup cu N elevi" (7 is not a format) */
export const PRICES = { 1: 608, 2: 348, 3: 288, 4: 248, 5: 228, 6: 218, 7: 0, 8: 148 };
export const priceFor = size => PRICES[size] || 0;

export const PAY_MAX_8 = { 1: 180, 2: 235, 3: 255, 4: 270, 5: 280, 6: 325 };      // suma_max for groups of 8
export const PAY_MAX = { 1: 165, 2: 215, 3: 235, 4: 255, 5: 265, 6: 305 };        // suma_max for every other format
export const GUARANTEED = { 4: 3, 5: 4 };                                         // minim_garantat

/* the sheet's formula for column C: paying = students marked PREZENT or ABSENT on the lesson row */
export function lessonPay(size, paying, level) {
  if (!(size >= 1) || !paying) return 0;
  const max = (size === 8 ? PAY_MAX_8 : PAY_MAX)[level] || 0;
  const counted = Math.max(paying, GUARANTEED[size] || 0);
  let f;
  if (size === 3) f = { 1: 0.6863, 2: 0.8549, 3: 1 }[paying];
  else if (size === 6) f = { 1: 0.6863, 2: 0.6863, 3: 0.6863, 4: 0.6863, 5: 0.8549, 6: 1 }[paying];
  else if (size === 8) f = paying < 3 ? 0.6296 : paying < 6 ? 0.7519 : paying / size;
  else f = counted / size;
  if (f === undefined) f = paying / size;       // more students than seats: the sheet pays pro rata above the cap
  return f * max;
}

