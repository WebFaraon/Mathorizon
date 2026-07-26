/* ============================================================
   Mathorizon — Custom (teacher/admin-added) exercises
   Fetches admin-authored exercises from Supabase and merges
   them into BM.EXERCISES so every existing consumer that reads
   that array picks them up, with no redeploy required.
   ============================================================ */

window.BM = window.BM || {};

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://tfflpivehrrzmklvcyhe.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmxwaXZlaHJyem1rbHZjeWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDUzNDMsImV4cCI6MjA5NzgyMTM0M30.-gGiOdro6z5vHC23bbKNdHppH1tf2x82GshFIGVCb6w';

  // Only grades '9'/'bac' reach the sitewide pool (trainer/category/BAC
  // simulator) — preserves today's exact behavior. Grades '5'-'8'/'10'/'11'/'12'
  // (added by teachers building class Simulări) stay out of this pool; the
  // Simulări exercise picker queries custom_exercises directly instead.
  const ready = fetch(`${SUPABASE_URL}/rest/v1/custom_exercises?grade=in.(9,bac)&select=*`, {
    headers: { apikey: SUPABASE_ANON }
  })
    .then(r => r.ok ? r.json() : [])
    .then(rows => {
      (rows || []).forEach(row => {
        BM.EXERCISES.push({
          id:            row.id,
          categoryId:    row.category_id,
          subcategoryId: row.subcategory_id,
          difficulty:    row.difficulty,
          grade:         row.grade,
          source:        row.source,
          title:         row.title,
          statement:     row.statement,
          solution:      row.solution,
          barem:         row.barem,
          baremEstimat:  row.barem_estimat,
          puncteTotal:   row.punctaj_total,
          figureSvg:     row.figure_svg,
          _custom:       true
        });
      });
    })
    .catch(() => {});

  // This timeout only exists to cap a genuinely hung/dropped connection —
  // `ready` already resolves gracefully on its own (via .catch above) for a
  // normal failed/slow response, so racing it against a short timeout buys
  // nothing but risk: if the fetch is merely a bit slow (cold Supabase,
  // weak connection, or just a bigger custom_exercises table over time) and
  // loses the race, generateExam() (js/bac.js) proceeds with an empty
  // BM.EXERCISES merge and silently leaves any slot that depends entirely on
  // custom exercises (e.g. geometry, which has no static seed exercises at
  // all) unavailable — with no error, indistinguishable from "no exercises
  // exist". A generous ceiling keeps the real protection (never hang
  // forever) without being the common case that trips.
  const timeout = new Promise(resolve => setTimeout(resolve, 10000));
  BM.customExercisesReady = () => Promise.race([ready, timeout]);
})();
