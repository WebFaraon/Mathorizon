-- Drops the temporary diagnostic function used to find the "3.14 -> null"
-- bug (20260714200000) — no longer needed now that _sim_eval_expr is
-- fixed and fully tested.
drop function if exists public._sim_eval_debug(text);
