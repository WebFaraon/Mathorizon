/* ============================================================
   Admin console: the platform accounts of the students in the registers
   ============================================================
   A register student has a Mathorizon account when a teacher tied the account to his name in the register (class_member_links).
   The database function admin_student_accounts gives those ties; the student's sheet (Elevi) shows the account and its e-mail.
   ============================================================ */
(function () {
  'use strict';
  const sb = () => window.BMAuth && window.BMAuth.supabase;
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let cache = null, at = 0, pending = null;

  /* the list of ties, kept for a minute; rejects when the function is not in the database yet (the caller then shows nothing) */
  function load(force) {
    if (!force && cache && Date.now() - at < 60000) return Promise.resolve(cache);
    if (pending) return pending;
    if (!sb()) return Promise.reject(new Error('no session'));
    pending = sb().rpc('admin_student_accounts').then(r => {
      if (r.error) throw new Error(r.error.message);
      cache = r.data || []; at = Date.now();
      return cache;
    }).finally(() => { pending = null; });
    return pending;
  }

  /* columns = [{ gid, name }] of one student (AdminData.registry.columnsOf) */
  function find(list, columns) {
    const hit = (list || []).find(a => (columns || []).some(c => c.gid === a.reg_group_id && norm(c.name) === norm(a.reg_student_name)));
    return hit || null;
  }

  async function setPlan(userId, plan) {
    const r = await sb().rpc('set_student_plan', { target_user_id: userId, new_plan: plan });
    if (r.error) throw new Error(r.error.message);
    if (cache) cache.forEach(a => { if (a.user_id === userId) a.plan = plan; });
  }

  window.AdminAccounts = { load, find, setPlan };
})();
