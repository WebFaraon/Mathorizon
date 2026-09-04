-- class_members was never added to the supabase_realtime publication
-- (pre-dates the migration discipline, like classes/class_members
-- themselves). class-page.js's _setupRealtime() has always subscribed to
-- postgres_changes on class_members as part of its ONE shared
-- 'class-live-<classId>' channel (alongside class_posts, assignments,
-- simulations, and now whiteboard_sessions/whiteboard_participants) —
-- and a postgres_changes registration for a table NOT in the publication
-- doesn't just fail silently for that one table, it appears to break
-- delivery for every OTHER table bound to the same channel too (verified:
-- a 4-listener channel without class_members delivered correctly, adding
-- class_members as a 5th listener stopped ALL of them, including
-- class_posts, from firing). So this one missing table has likely been
-- silently breaking live updates for Flux/Teme/Simulări/Tablă alike this
-- whole time, masked by those tabs' other refresh triggers (explicit
-- actions, tab switches) that don't depend on realtime.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='class_members') then
    alter publication supabase_realtime add table public.class_members;
  end if;
end $$;
