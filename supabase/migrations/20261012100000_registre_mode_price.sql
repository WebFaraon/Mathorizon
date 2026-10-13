-- Formatul nou al registrelor (docs/registre-format-nou.md): fiecare grupa are modul (Online / Offline, celula C1)
-- si pretul pe ora pe care il arata registrul insusi (A2, urmeaza tarifele din CONFIGURARI). Ambele sunt NULL
-- in registrele vechi (modul se deduce din numele fisierului, pretul din tabelul din cod).

alter table public.reg_groups add column if not exists mode  text check (mode in ('online', 'offline'));
alter table public.reg_groups add column if not exists price numeric;

create or replace function public.reg_apply_group(p_workbook uuid, p_group jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
begin
  insert into public.reg_groups as g (workbook_id, sheet_id, tab, format_size, mode, price, state, subject, summer, grade, level, profile, schedule, cached_total_pay, content_hash, synced_at)
  values (p_workbook, (p_group->>'sheet_id')::bigint, p_group->>'tab', nullif(p_group->>'format_size', '')::int,
          nullif(lower(p_group->>'mode'), ''), nullif(p_group->>'price', '')::numeric,
          p_group->>'state', p_group->>'subject',
          coalesce((p_group->>'summer')::boolean, false), p_group->>'grade', p_group->>'level', p_group->>'profile',
          coalesce(p_group->'schedule', '[]'::jsonb), nullif(p_group->>'cached_total_pay', '')::numeric, p_group->>'content_hash', now())
  on conflict (workbook_id, sheet_id) do update set
    tab = excluded.tab, format_size = excluded.format_size, mode = excluded.mode, price = excluded.price, state = excluded.state, subject = excluded.subject, summer = excluded.summer,
    grade = excluded.grade, level = excluded.level, profile = excluded.profile, schedule = excluded.schedule,
    cached_total_pay = excluded.cached_total_pay, content_hash = excluded.content_hash, synced_at = now()
  returning id into v_group;

  delete from public.reg_students where group_id = v_group;
  delete from public.reg_lessons  where group_id = v_group;

  insert into public.reg_students (group_id, col, header_raw, name, phone, phone_kind, manager, status, paid, discount, cost, sold)
  select v_group, s->>'col', s->>'header_raw', s->>'name', s->>'phone', s->>'phone_kind', s->>'manager', s->>'status',
         nullif(s->>'paid', '')::numeric, nullif(s->>'discount', '')::numeric, nullif(s->>'cost', '')::numeric, nullif(s->>'sold', '')::numeric
  from jsonb_array_elements(coalesce(p_group->'students', '[]'::jsonb)) s;

  insert into public.reg_lessons (group_id, row_no, date_text, iso, topic, teacher_level, teacher_pay, marks)
  select v_group, (l->>'row_no')::int, l->>'date_text', nullif(l->>'iso', '')::date, l->>'topic', nullif(l->>'teacher_level', '')::int,
         nullif(l->>'teacher_pay', '')::numeric, coalesce(l->'marks', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_group->'lessons', '[]'::jsonb)) l;

  return v_group;
end $$;

-- grant-urile se reafirma (vezi nota despre DROP+CREATE: nu lasam EXECUTE pentru anon)
revoke all on function public.reg_apply_group(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reg_apply_group(uuid, jsonb) to service_role;
