-- Securizare după auditul din 2026-11-25. Se rulează în SQL Editor, o singură dată (se poate rula și a doua oară fără probleme).
-- Nu schimbă ce vede sau ce face un utilizator obișnuit; oprește doar lucruri pe care aplicația nu le face niciodată.

-- 1) Tokenurile de simulare: un elev nu mai poate să-și mărească singur numărul (înainte putea scrie orice valoare în propriul rând).
--    Aplicația doar scade tokenul la pornirea unei simulări; noul cont primește 3 de la trigger-ul de înregistrare.
--    Adminul și funcțiile serverului (care nu rulează ca "authenticated") pot în continuare să dea tokenuri.
create or replace function public.exam_tokens_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and not exists (select 1 from public.user_profiles up where up.user_id = auth.uid() and up.role = 'admin') then
    if tg_op = 'INSERT' then
      new.count := least(coalesce(new.count, 0), 3);
    else
      new.count := least(coalesce(new.count, 0), old.count);
    end if;
    new.count := greatest(new.count, 0);
  end if;
  return new;
end $$;

drop trigger if exists exam_tokens_guard on public.exam_tokens;
create trigger exam_tokens_guard before insert or update on public.exam_tokens
  for each row execute function public.exam_tokens_guard();


-- 2) Temele predate: elevul poate schimba doar fișierele lui; nota, comentariul și confirmarea rămân ale profesorului.
create or replace function public.homework_submissions_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and auth.uid() = old.student_id
     and not exists (
       select 1 from public.assignments a join public.classes c on c.id = a.class_id
       where a.id = old.assignment_id and c.teacher_id = auth.uid())
     and not exists (select 1 from public.user_profiles up where up.user_id = auth.uid() and up.role = 'admin') then
    new.grade := old.grade;
    new.grade_confirmed := old.grade_confirmed;
    new.teacher_comment := old.teacher_comment;
    new.graded_at := old.graded_at;
    new.student_id := old.student_id;
    new.assignment_id := old.assignment_id;
  end if;
  return new;
end $$;

drop trigger if exists homework_submissions_guard on public.homework_submissions;
create trigger homework_submissions_guard before update on public.homework_submissions
  for each row execute function public.homework_submissions_guard();


-- 3) Funcția de la înregistrare: nu trebuie apelată de nimeni din afară, iar drumul de căutare e fixat.
alter function public.handle_new_user() set search_path = public, pg_temp;
revoke all on function public.handle_new_user() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'alter function public.rls_auto_enable() set search_path = public, pg_temp';
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

-- 3b) Restul funcțiilor la care Supabase semnala "drum de căutare modificabil" (nu schimbă ce fac, doar le fixează schema).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('class_members_block_direct_insert','classes_block_client_insert','block_client_write_attendance',
                        '_sim_try_number','_sim_answers_match','_sim_normalize','_sim_strip_superscript','_sim_brace_close',
                        '_sim_strip_frac','_sim_strip_sqrt','_sim_strip_exp_braces','_sim_promote_numeric_literals',
                        '_sim_eval_expr','_sim_grade_from_points','_nickname_reserved','reg_spreadsheet_id')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.fn);
  end loop;
end $$;

-- 4) Spațiile de stocare publice: limită de mărime (înainte puteai urca orice, oricât de mare).
update storage.buckets set file_size_limit = 5242880,  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'] where id = 'avatars';
update storage.buckets set file_size_limit = 26214400 where id = 'assignment-files';

-- Verificare (trebuie să dea 0 rânduri):
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in ('handle_new_user','rls_auto_enable')
--     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
