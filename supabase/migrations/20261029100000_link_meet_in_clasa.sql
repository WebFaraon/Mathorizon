-- Linkul Google Meet al profesorului, dat elevilor doar in fereastra lectiei (2026-10-29).
--
-- Linkul sta in registru (fila Disponibilitate, D16:H16), il citeste sincronizarea in reg_workbooks.teacher_data.meet ({ url } curat sau { why }).
-- Elevul nu are voie sa citeasca reg_*, iar linkul e usa spre lectie: il da o functie security definer, doar
--   - profesorului clasei si adminului (oricand, ca sa-l verifice);
--   - unui elev ACTIV al clasei (nu inactiv, nu in asteptare, nu un strain), si doar de la 10 minute inainte de lectie pana cu 10 minute inainte de sfarsitul ei.
-- Ora lectiei vine din programul grupei din registru (reg_groups.schedule: o linie pe ora; o lectie de doua ore are doua linii in aceeasi zi), in ora Chisinaului.
-- In afara ferestrei raspunsul spune doar cand se deschide urmatoarea, nu linkul.

create or replace function public.class_meet_at(p_class uuid, p_uid uuid, p_at timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c public.classes;
  g public.reg_groups;
  w public.reg_workbooks;
  v_url text;
  v_teacher boolean;
  v_now timestamp;
  v_day date;
  v_start timestamp;
  v_open timestamp;
  v_close timestamp;
  v_next timestamp;
  r record;
  k int;
  v_tz constant text := 'Europe/Chisinau';
begin
  select * into c from public.classes where id = p_class;
  if not found then return jsonb_build_object('status', 'denied'); end if;

  v_teacher := c.teacher_id = p_uid or exists (select 1 from public.user_profiles where user_id = p_uid and role = 'admin');
  if not v_teacher and not exists (select 1 from public.class_members where class_id = p_class and student_id = p_uid and status = 'activ') then
    return jsonb_build_object('status', 'denied');
  end if;

  if c.reg_group_id is null then return jsonb_build_object('status', 'no_link'); end if;
  select * into g from public.reg_groups where id = c.reg_group_id;
  if not found then return jsonb_build_object('status', 'no_link'); end if;
  select * into w from public.reg_workbooks where id = g.workbook_id;

  v_url := w.teacher_data #>> '{meet,url}';
  if v_url is null then return jsonb_build_object('status', 'no_link', 'why', w.teacher_data #>> '{meet,why}'); end if;

  -- profesorul (si adminul) vad linkul oricand
  if v_teacher then return jsonb_build_object('status', 'open', 'url', v_url, 'teacher', true); end if;

  if lower(coalesce(g.state, '')) not in ('activ', 'se completează', 'se completeaza', 'startează', 'starteaza') then
    return jsonb_build_object('status', 'closed');
  end if;

  v_now := p_at at time zone v_tz;
  for k in -1..7 loop
    v_day := v_now::date + k;
    for r in
      select min((e->>'hour')::int) as h0, count(*)::int as n
      from jsonb_array_elements(coalesce(g.schedule, '[]'::jsonb)) e
      where (e->>'day') ~ '^[1-7]$' and (e->>'hour') ~ '^[0-9]{1,2}$' and (e->>'day')::int = extract(isodow from v_day)::int
      group by (e->>'day')
    loop
      v_start := v_day + make_interval(hours => r.h0);
      v_open := v_start - interval '10 minutes';
      v_close := v_start + make_interval(hours => r.n) - interval '10 minutes';
      if v_now >= v_open and v_now < v_close then
        return jsonb_build_object('status', 'open', 'url', v_url, 'closes_at', v_close at time zone v_tz);
      end if;
      if v_open > v_now and (v_next is null or v_open < v_next) then v_next := v_open; end if;
    end loop;
  end loop;

  return jsonb_build_object('status', 'closed', 'opens_at', case when v_next is null then null else v_next at time zone v_tz end);
end $$;

-- apelul din aplicatie: ora e ora serverului, nu una trimisa de client
create or replace function public.class_meet_link(p_class uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.class_meet_at(p_class, auth.uid(), now());
$$;

revoke all on function public.class_meet_at(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.class_meet_link(uuid) from public, anon;
grant execute on function public.class_meet_link(uuid) to authenticated;
