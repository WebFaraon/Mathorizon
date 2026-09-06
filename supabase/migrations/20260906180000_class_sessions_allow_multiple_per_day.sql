-- ============================================================
-- Some groups genuinely have two back-to-back lecții on the same day —
-- the "one lecție per class per day" unique index (added in
-- 20260717110000) was blocking that legitimate case, not just the
-- accidental-double-submit it was meant to guard against. Drop it;
-- the double-submit case it was guarding against is rare enough (and
-- low-stakes enough — worst case is an extra editable row) not to need
-- a DB-level guard in its place.
-- ============================================================

drop index if exists public.class_sessions_class_id_date_idx;
