-- ============================================================
-- Fixes a regression the previous migration (20260907120000, avatar_url +
-- display_name refresh) introduced: it rewrote join_whiteboard_session
-- from the ORIGINAL 2-arg version in 20260904120000_whiteboard.sql,
-- without knowing that 20260904130000_whiteboard_flatten_participant_rls
-- had already rewritten it again in between to also populate class_id
-- (denormalized onto whiteboard_participants for realtime RLS — see that
-- migration's own comment) — since 20260907120000 dropped the 2-arg
-- overload and recreated the function from the stale copy, that INSERT
-- went back to omitting class_id entirely, which whiteboard_participants
-- has required NOT NULL since 20260904130000. Every join after that
-- migration ran hit "null value in column class_id violates not-null
-- constraint" — reported live: ending one board and opening another threw
-- this error and the roster showed 0 participants.
--
-- Fix: just the INSERT's column list — add class_id back, value
-- v_session.class_id, otherwise identical to 20260907120000's own version
-- (still refreshes display_name/avatar_url on reconnect, still leaves
-- color untouched).
-- ============================================================

create or replace function public.join_whiteboard_session(p_session_id uuid, p_display_name text, p_avatar_url text default null)
returns public.whiteboard_participants
security definer set search_path = public
language plpgsql as $$
declare
  v_session    public.whiteboard_sessions;
  v_is_teacher boolean;
  v_row        public.whiteboard_participants;
  v_color      text;
  v_palette    text[] := array['#e11d48','#2563eb','#16a34a','#d97706','#7c3aed','#0891b2','#db2777','#65a30d'];
  v_used       text[];
begin
  select * into v_session from whiteboard_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'session not found'; end if;
  if v_session.status <> 'live' then raise exception 'session not live'; end if;

  select exists(select 1 from classes c where c.id = v_session.class_id and c.teacher_id = auth.uid()) into v_is_teacher;
  if not v_is_teacher and not exists (
    select 1 from class_members cm where cm.class_id = v_session.class_id and cm.student_id = auth.uid()
  ) then
    raise exception 'not a member of this class';
  end if;

  -- Reconnect: same color as before (never reassigned), but display_name/
  -- avatar_url ARE refreshed every time — see 20260907120000's own header
  -- comment for why that snapshot can't just be left as first-joined.
  select * into v_row from whiteboard_participants where session_id = p_session_id and user_id = auth.uid();
  if v_row.id is not null then
    update whiteboard_participants set display_name = p_display_name, avatar_url = p_avatar_url
      where id = v_row.id
      returning * into v_row;
    return v_row;
  end if;

  if v_is_teacher then
    v_color := '#111827'; -- reserved teacher color, never drawn from the student palette
  else
    perform pg_advisory_xact_lock(hashtext(p_session_id::text));
    select array_agg(color) into v_used from whiteboard_participants where session_id = p_session_id;
    select c into v_color from unnest(v_palette) c where c <> all (coalesce(v_used, array[]::text[])) limit 1;
    if v_color is null then
      v_color := v_palette[1 + (coalesce(array_length(v_used,1),0) % array_length(v_palette,1))]; -- >8 concurrent: cycle
    end if;
  end if;

  insert into whiteboard_participants (session_id, class_id, user_id, display_name, role, color, avatar_url)
    values (p_session_id, v_session.class_id, auth.uid(), p_display_name, case when v_is_teacher then 'profesor' else 'elev' end, v_color, p_avatar_url)
    on conflict (session_id, user_id) do nothing
    returning * into v_row;

  if v_row.id is null then
    select * into v_row from whiteboard_participants where session_id = p_session_id and user_id = auth.uid();
  end if;
  return v_row;
end $$;

grant execute on function public.join_whiteboard_session(uuid, text, text) to authenticated;
