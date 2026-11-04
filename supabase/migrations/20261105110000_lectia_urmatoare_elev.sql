-- Lectia urmatoare a elevului, pentru cardul "Lectia ta" din Clase si pentru butonul "Intra la lectie".
--   student_next_lessons(): pentru fiecare clasa in care elevul e inscris (activ), cea mai apropiata lectie care nu e anulata si la care
--   se mai poate intra (sfarsitul ei minus 10 minute inca nu a trecut); lectiile mutate sau in plus sunt cele din class_lessons.
--   La grupele online vine si raspunsul sali Meet (class_meet_at: deschisa / inchisa si cand se deschide / fara link), cu linkul DOAR cat e deschisa.
-- Se ruleaza dupa 20261103100000_mutare_ore_si_offline.sql. Nu cere redeploy la nicio functie Edge.

create or replace function public.student_next_lessons(p_limit int default 4)
returns table (class_id uuid, subject text, grade text, teacher_name text, mode text,
               start_at timestamptz, end_at timestamptz, kind text, meet jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_tz constant text := 'Europe/Chisinau';
  v_now timestamp := now() at time zone 'Europe/Chisinau';
begin
  if v_uid is null then return; end if;
  return query
  with mine as (
    select c.id as cid, c.teacher_name as tname, g.subject as subj, g.grade as grd, lower(coalesce(g.mode, '')) as md
      from public.class_members m
      join public.classes c on c.id = m.class_id
      join public.reg_groups g on g.id = c.reg_group_id
     where m.student_id = v_uid and m.status = 'activ'
       and lower(coalesce(g.state, '')) in ('activ', 'se completează', 'se completeaza', 'startează', 'starteaza')
  ),
  nxt as (
    select mine.*, l.l_start, l.l_hours, l.l_kind,
           row_number() over (partition by mine.cid order by l.l_start) as rn
      from mine
      cross join lateral public.class_lessons(mine.cid, v_now - interval '1 day', v_now + interval '8 days') l
     where l.l_kind <> 'cancelled'
       and l.l_start + make_interval(hours => l.l_hours) - interval '10 minutes' > v_now
  )
  select n.cid, n.subj, n.grd, n.tname, n.md,
         n.l_start at time zone v_tz,
         (n.l_start + make_interval(hours => n.l_hours)) at time zone v_tz,
         n.l_kind,
         case when n.md = 'online' then public.class_meet_at(n.cid, v_uid, now()) else null end
    from nxt n
   where n.rn = 1
   order by n.l_start
   limit least(greatest(coalesce(p_limit, 4), 1), 10);
end $$;

revoke all on function public.student_next_lessons(int) from public, anon;
grant execute on function public.student_next_lessons(int) to authenticated;

-- Verificare dupa rulare (nu trebuie sa apara niciun rand):
--   select routine_name, grantee from information_schema.routine_privileges
--    where routine_schema = 'public' and routine_name = 'student_next_lessons' and grantee in ('anon', 'public');
