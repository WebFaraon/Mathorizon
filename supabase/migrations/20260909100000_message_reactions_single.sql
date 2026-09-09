-- ============================================================
-- One reaction per user per message, not one per (message, emoji).
-- The original message_reactions design (20260909090000) let the same
-- user stack multiple different emoji on one message — in practice that
-- read as a bug ("de ce am 3 reacții pe un mesaj?"), not a feature.
-- Picking a new emoji now replaces the user's existing reaction on that
-- message instead of adding to it (see class-page.js _fluxToggleReaction,
-- which upserts on (post_id, user_id) rather than (post_id, user_id, emoji)).
-- ============================================================

-- Live data can already have a user with 2-3 emoji on the same post (the
-- exact bug this migration fixes) — the new unique(post_id, user_id) below
-- would reject that as duplicates, so collapse each user down to their
-- single most recent reaction per post first. (created_at, id) as the
-- tiebreaker keeps this deterministic even for same-millisecond inserts.
delete from public.message_reactions a
using public.message_reactions b
where a.post_id = b.post_id
  and a.user_id = b.user_id
  and (a.created_at, a.id) < (b.created_at, b.id);

alter table public.message_reactions
  drop constraint if exists message_reactions_post_id_user_id_emoji_key;

alter table public.message_reactions
  add constraint message_reactions_post_id_user_id_key unique (post_id, user_id);
