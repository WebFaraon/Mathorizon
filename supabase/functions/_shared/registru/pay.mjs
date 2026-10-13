/* The money rules of the teachers' registers (Google Sheets), written once, as they are in the sheets' formulas.
   - the student's price per hour is looked up by the group's format (cell A1: "Grup cu 6 elevi", "Individual 1 elev", "Grup cu 10 elevi") and mode (C1);
   - a lesson counts for a student (cost) when his mark is exactly PREZENT or ABSENT;
   - what the teacher earns for a lesson depends on how many students are charged for it, on the group's format and
     on the teacher's level (written on every lesson row, 1-7).
   js/admin/registru-data.js keeps a copy of these constants (it runs in the browser); scripts/check-demo-data.js
   compares the two on every combination, so they cannot drift apart.
   Plain ES module, no imports: read by Node (require) and by the Supabase Edge Function (Deno). */

/* What a student pays per hour, by the group's format (cell A1) and its mode (cell C1 of the new register format, "Online" / "Offline"). The new registers read
   this from CONFIGURARI (O offline, P online), and cell A2 of every group tab shows the price that applies ("258 MDL/oră"); the figures below are the
   ones in the template of 2026-10-13 and only a fallback: a register's own A2 wins (parse.mjs g.price). 0 = that format does not exist in that mode
   (8 students online, 10 students offline, 7 never). */
export const PRICES_OFFLINE = { 1: 608, 2: 348, 3: 288, 4: 248, 5: 228, 6: 218, 7: 0, 8: 148, 10: 0 };
export const PRICES_ONLINE = { 1: 548, 2: 328, 3: 258, 4: 228, 5: 218, 6: 198, 7: 0, 8: 0, 10: 108 };
export const PRICES = PRICES_OFFLINE;                                           // the old registers had only these
export const isOnline = mode => /^online/i.test(String(mode || '').trim());
export const priceFor = (size, mode) => (isOnline(mode) ? PRICES_ONLINE : PRICES_OFFLINE)[size] || 0;
/* the formats that exist in each mode */
export const SIZES_OFFLINE = [1, 2, 3, 4, 5, 6, 8];
export const SIZES_ONLINE = [1, 2, 3, 4, 5, 6, 10];
export const SIZES_ALL = [1, 2, 3, 4, 5, 6, 8, 10];
export const sizesFor = mode => (isOnline(mode) ? SIZES_ONLINE : SIZES_OFFLINE);

/* what the teacher earns for a full lesson, by the teacher's level (1..7); the new registers read these from CONFIGURARI S:V, the old ones had 1..6 in the formula */
export const PAY_MAX_8 = { 1: 180, 2: 235, 3: 255, 4: 270, 5: 280, 6: 325, 7: 325 };       // offline, group of 8 (CONFIGURARI T)
export const PAY_MAX = { 1: 165, 2: 215, 3: 235, 4: 255, 5: 265, 6: 305, 7: 305 };         // offline, every other format (S)
export const PAY_MAX_ONLINE = { 1: 152, 2: 206, 3: 224, 4: 242, 5: 251, 6: 260, 7: 296 };  // online, every other format (U)
export const PAY_MAX_ONLINE_10 = { 1: 170, 2: 224, 3: 242, 4: 260, 5: 279, 6: 278, 7: 314 }; // online, group of 10 (V)
export const GUARANTEED = { 4: 3, 5: 4, 10: 6 };                                           // minim_garantat

/* the sheet's formula for column C: paying = students marked PREZENT or ABSENT on the lesson row. The new registers round the result to a whole number;
   this returns the exact figure (compare with a tolerance of one half). A level the table does not have pays the formula's default: 255 offline, 242 online. */
export function lessonPay(size, paying, level, mode) {
  if (!(size >= 1) || !paying) return 0;
  const online = isOnline(mode);
  const table = online ? (size === 10 ? PAY_MAX_ONLINE_10 : PAY_MAX_ONLINE) : (size === 8 ? PAY_MAX_8 : PAY_MAX);
  const max = table[level] || (mode === undefined ? 0 : (online ? 242 : 255));          // without a mode (the old registers) an unknown level pays 0, as the old formula did
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
