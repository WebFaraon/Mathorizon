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

  const ready = fetch(`${SUPABASE_URL}/rest/v1/custom_exercises?select=*`, {
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
          _custom:       true
        });
      });
    })
    .catch(() => {});

  const timeout = new Promise(resolve => setTimeout(resolve, 4000));
  BM.customExercisesReady = () => Promise.race([ready, timeout]);
})();
