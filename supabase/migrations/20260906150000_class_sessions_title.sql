-- ============================================================
-- Lesson title ("ce am trecut la lecția respectiva") — optional, set
-- from the Adaugă/Editează lecție modal, shown alongside the date as
-- the row label in the (now transposed) Prezență table.
-- ============================================================

alter table public.class_sessions add column if not exists title text;
