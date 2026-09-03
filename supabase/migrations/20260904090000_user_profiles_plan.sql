-- Adds a subscription-tier column to user_profiles so paid features
-- (starting with Antrenament) can be gated for real. There is still no
-- payments backend (pachete.html's purchase buttons just toast "coming
-- soon") — this defaults every account to 'free' and gives admins a
-- manual override (set_student_plan) so specific accounts can be
-- grandfathered onto Standard/Premium until real checkout ships.

alter table public.user_profiles
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'standard', 'premium'));

-- Admin-only: change one student's plan (mirrors set_professor_status's
-- shape — caller must already be an admin per user_profiles).
create or replace function public.set_student_plan(target_user_id uuid, new_plan text)
returns void
security definer set search_path = public
language plpgsql as $$
begin
  if new_plan not in ('free', 'standard', 'premium') then
    raise exception 'invalid plan';
  end if;

  if not exists (
    select 1 from public.user_profiles
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  update public.user_profiles set plan = new_plan where user_id = target_user_id;
end;
$$;

grant execute on function public.set_student_plan(uuid, text) to authenticated;

-- Admin-only: plan for every student, for the Admin Panel's student list
-- (get_all_students already exists and predates this migration, so this
-- stays a separate lookup rather than risking a redefinition of a function
-- whose current body isn't tracked in this repo).
create or replace function public.get_all_student_plans()
returns table(user_id uuid, plan text)
security definer set search_path = public
language plpgsql as $$
begin
  if not exists (
    select 1 from public.user_profiles
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  return query select up.user_id, up.plan from public.user_profiles up where up.role = 'elev';
end;
$$;

grant execute on function public.get_all_student_plans() to authenticated;
