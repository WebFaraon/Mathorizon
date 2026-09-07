-- ============================================================
-- Tablă live roster — real profile photo + always-current display name.
--
-- Two separate problems reported together:
--
-- 1. whiteboard_participants had no avatar at all — the roster dropdown
--    (js/class-page.js _rosterDropdownContent) only ever had initials to
--    show, never a real uploaded photo.
--
-- 2. display_name is a snapshot taken once, the very first time a user
--    joins a given session (see join_whiteboard_session below) — the
--    unique(session_id,user_id) reconnect branch found the existing row
--    and just returned it as-is, never refreshing display_name. Rename
--    yourself in your profile after joining a still-live board (exactly
--    what happened: "DR4GOȘ" joined, then got renamed to "Bivol Dragoș"
--    without ever leaving/re-ending that session) and the roster kept
--    showing the stale name forever, through every reopen, since reopening
--    the fullscreen view calls this same RPC and always hit the
--    do-nothing reconnect branch.
--
-- Fix for both: add avatar_url alongside display_name, and make the
-- reconnect branch UPDATE both to whatever the client just passed in
-- (always freshly read from auth.js's own BMAuth.displayName()/avatarUrl()
-- — themselves already live off the current JWT user_metadata, see
-- js/auth.js) instead of silently keeping the original snapshot forever.
-- color is deliberately left untouched on reconnect — that one's SUPPOSED
-- to stay stable for the life of the session, see the function's own
-- original comment.
-- ============================================================

alter table public.whiteboard_participants add column if not exists avatar_url text;

-- Signature is changing (a new 3rd parameter) — CREATE OR REPLACE only
-- replaces a function with the SAME argument types, so the old 2-arg
-- overload has to be dropped explicitly or it'd just linger unused
-- alongside the new one (and any caller still invoking it with 2 args
-- would silently keep hitting the old, non-refreshing behavior).
drop function if exists public.join_whiteboard_session(uuid, text);

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
  -- avatar_url ARE refreshed every time — see this migration's own header
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

  insert into whiteboard_participants (session_id, user_id, display_name, role, color, avatar_url)
    values (p_session_id, auth.uid(), p_display_name, case when v_is_teacher then 'profesor' else 'elev' end, v_color, p_avatar_url)
    on conflict (session_id, user_id) do nothing
    returning * into v_row;

  if v_row.id is null then
    select * into v_row from whiteboard_participants where session_id = p_session_id and user_id = auth.uid();
  end if;
  return v_row;
end $$;

grant execute on function public.join_whiteboard_session(uuid, text, text) to authenticated;
