-- ============================================================
-- Flux tab: Anunțuri (teacher-only, one-way) → Mesaje (two-way class
-- chat). Everyone in the class — teacher and active students alike —
-- can now post to class_posts, and can react to any message with an
-- emoji via the new message_reactions table.
--
-- class_posts predates the migrations folder, so its exact original
-- RLS shape isn't visible here (see 20260906120000 for the same
-- caveat on class_members) — the policies below are additive only
-- (new names, dropped-and-recreated for idempotency) and can only
-- grant permission, never take any away, since permissive policies
-- for the same command are OR'd together with whatever already
-- exists. "Is this my class" reuses the same c.teacher_id = auth.uid()
-- / active class_members check used everywhere else (whiteboard,
-- class_members_teacher_update, ...).
-- ============================================================

-- `title` was NOT NULL — fine for teacher announcements, wrong for a
-- chat message that's just a line of text.
alter table public.class_posts alter column title drop not null;

-- Denormalized alongside author_name (same reasoning: avoid a join per
-- message just to render an avatar), populated client-side from
-- BMAuth.avatarUrl() at insert time. Null falls back to initials.
alter table public.class_posts add column if not exists author_avatar_url text;

drop policy if exists class_posts_members_select on public.class_posts;
create policy class_posts_members_select on public.class_posts for select to authenticated
  using (
    exists (select 1 from public.classes c where c.id = class_posts.class_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.class_members cm where cm.class_id = class_posts.class_id and cm.student_id = auth.uid() and cm.status = 'activ')
  );

drop policy if exists class_posts_members_insert on public.class_posts;
create policy class_posts_members_insert on public.class_posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      exists (select 1 from public.classes c where c.id = class_posts.class_id and c.teacher_id = auth.uid())
      or exists (select 1 from public.class_members cm where cm.class_id = class_posts.class_id and cm.student_id = auth.uid() and cm.status = 'activ')
    )
  );

-- A message's own author can remove it; the class's teacher can also
-- remove anyone's (moderation) — same as the old teacher-only delete,
-- just no longer exclusive to posts the teacher authored themselves.
drop policy if exists class_posts_author_or_teacher_delete on public.class_posts;
create policy class_posts_author_or_teacher_delete on public.class_posts for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from public.classes c where c.id = class_posts.class_id and c.teacher_id = auth.uid())
  );

-- ── Reactions ────────────────────────────────────────────────────
-- post_reactions is left as-is (it's a single boolean "seen" marker,
-- unique per post+user, and catalog-stats.js still reads it to
-- backfill display names for members who joined before student_name
-- was stored) — a real multi-emoji reaction needs one row per
-- (post, user, emoji), so it gets its own table rather than overloading
-- post_reactions' existing unique(post_id, user_id) constraint.
create table if not exists public.message_reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.class_posts(id) on delete cascade,
  user_id    uuid not null,
  user_name  text not null default '',
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create index if not exists message_reactions_post_id_idx on public.message_reactions(post_id);

alter table public.message_reactions enable row level security;

drop policy if exists message_reactions_members_select on public.message_reactions;
create policy message_reactions_members_select on public.message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.class_posts p
      join public.classes c on c.id = p.class_id
      where p.id = message_reactions.post_id
        and (
          c.teacher_id = auth.uid()
          or exists (select 1 from public.class_members cm where cm.class_id = c.id and cm.student_id = auth.uid() and cm.status = 'activ')
        )
    )
  );

drop policy if exists message_reactions_own_insert on public.message_reactions;
create policy message_reactions_own_insert on public.message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.class_posts p
      join public.classes c on c.id = p.class_id
      where p.id = message_reactions.post_id
        and (
          c.teacher_id = auth.uid()
          or exists (select 1 from public.class_members cm where cm.class_id = c.id and cm.student_id = auth.uid() and cm.status = 'activ')
        )
    )
  );

drop policy if exists message_reactions_own_delete on public.message_reactions;
create policy message_reactions_own_delete on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Without this, class-page.js's postgres_changes subscription for
-- message_reactions never fires — and per the class_members incident
-- (20260904140000), a table missing from this publication can silently
-- break realtime delivery for every OTHER table on the same shared
-- channel too, not just this one.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
