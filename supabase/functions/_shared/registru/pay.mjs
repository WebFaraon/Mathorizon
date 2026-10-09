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

/* The money of a transfer, the Calculator's "Transfer" formulas (the console's js/admin/registru-data.js keeps a copy: check:registry compares them).
   A = what the student paid in the group he leaves, R = the discounts, C = the cost of the lessons he had there.
     share of payments = A / (A + R), of discounts = R / (A + R)
     stays in the old group (consumed) = C x each share   -> the old column ends with balance 0
     goes to the new group = what was entered - what was consumed (payments and discounts apart)
   Everything is rounded to cents so that consumed + moved = A + R exactly. If the lessons cost more than A + R, the student owes the difference:
   it stays in the old group and nothing negative is sent to the new one. */
export const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
export function splitMoney(a, r, c) {
  const A = round2(a), R = round2(r), C = round2(c), total = round2(A + R);
  const used = Math.min(C, total);
  let achC = 0, redC = 0;
  if (total > 0 && used > 0) {
    achC = round2(used * (A / total));
    redC = Math.min(R, round2(used - achC));
    achC = round2(used - redC);
  }
  return { A, R, C, achC, redC, achRem: round2(A - achC), redRem: round2(R - redC), debt: round2(Math.max(0, C - total)) };
}

/* The Calculator's "Inlocuire", for one student: the hours the substitute teacher taught him (one per marked lesson row) at the price of his group's format,
   taken from his payments and discounts in the OLD register in proportion to them, the rest staying there.
     total = hours x price ; ach = round2(total x A / (A + R)) ; red = round2(total - ach)
   When A + R is less than the total (not enough money) what exists is moved and the difference is "short" (it stays unpaid, the new register shows it as a
   negative balance); with no money at all nothing moves and everything is short. Negative cells count as 0 here. */
export function splitReplacement(a, r, price, hours = 1) {
  const A = Math.max(0, round2(a)), R = Math.max(0, round2(r));
  const tot = round2((Number(hours) || 0) * (Number(price) || 0)), have = round2(A + R);
  if (!(tot > 0)) return { tot: 0, ach: 0, red: 0, short: 0, A, R };
  if (!(have > 0)) return { tot, ach: 0, red: 0, short: tot, A, R };
  const amount = Math.min(tot, have);
  const ach = Math.min(A, round2(amount * (A / have)));
  const red = round2(amount - ach);
  return { tot, ach, red, short: round2(tot - amount), A, R };
}
