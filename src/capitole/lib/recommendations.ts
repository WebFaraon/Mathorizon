/* ============================================================
   Sidebar picks — "Continuă de unde ai rămas" + the attention nudge.
   ============================================================
   Pure functions over data the page already has (ChapterView[] from
   useCapitoleData, plus BM.EXERCISES / getSolved() / getFavorites()) — no
   fetching, no new Supabase reads. Kept separate from the hook so the
   "which chapter/exercise to point at" logic can be read (and changed) on
   its own, without wading through the data-fetching effect.
   ============================================================ */

import type { BMExercise, BMSolvedMap, ChapterView } from './bm-types';

export interface ContinueTarget {
  /** True once every unlocked chapter is at 100% — nothing left to "continue". */
  allDone: boolean;
  chapter: ChapterView | null;
  /** The first unsolved exercise in that chapter, if any were found. */
  nextExercise: BMExercise | null;
}

const NOTHING_TO_CONTINUE: ContinueTarget = { allDone: false, chapter: null, nextExercise: null };

/**
 * Picks the chapter the "Continuă de unde ai rămas" card points at.
 *
 * Preference order, using only real progress numbers:
 *  1. A chapter already started but not finished — closest to completion
 *     first, so the card nudges toward finishing something rather than
 *     always restarting the same partially-done chapter.
 *  2. If nothing has been started yet, the first untouched chapter, in the
 *     same order BM.CATEGORIES lists them (Algebră → Geometrie → Analiză →
 *     Combinatorică) — a stable, predictable starting point.
 *  3. If every unlocked chapter is already at 100%, `allDone: true`.
 *
 * `nextExercise` is the first exercise in that chapter the user hasn't
 * solved yet (BM.EXERCISES order), so the card can name something concrete
 * instead of just "continue this chapter".
 */
export function pickContinueTarget(
  chapters: ChapterView[],
  exercises: BMExercise[],
  solved: BMSolvedMap
): ContinueTarget {
  const unlocked = chapters.filter((c) => !c.locked);
  if (unlocked.length === 0) return NOTHING_TO_CONTINUE;

  const inProgress = unlocked
    .filter((c) => c.progress.percent > 0 && c.progress.percent < 100)
    .sort((a, b) => b.progress.percent - a.progress.percent);

  const notStarted = unlocked.find((c) => c.progress.percent === 0) ?? null;
  const chapter = inProgress[0] ?? notStarted;

  if (!chapter) return { allDone: true, chapter: null, nextExercise: null };

  const nextExercise = exercises.find((e) => e.categoryId === chapter.category.id && !solved[e.id]) ?? null;
  return { allDone: false, chapter, nextExercise };
}

export type SidebarNudge =
  | { kind: 'favorites'; count: number; items: BMExercise[] }
  | { kind: 'weak-chapter'; chapter: ChapterView }
  | null;

/**
 * Picks the one thing the small "worth a look" card calls out — real data,
 * never a fixed message (see the prompt this is built from).
 *
 * Favorites take priority: exercises the user deliberately marked but hasn't
 * solved are a more personal, specific signal than a chapter percentage.
 * Falls back to the unlocked chapter with the lowest progress, excluding
 * whichever chapter the "continue" card already points at — otherwise the
 * two sidebar cards can end up naming the exact same chapter, which reads
 * as redundant rather than as two distinct pieces of information.
 *
 * Returns null when there's nothing worth flagging (no unsolved favorites,
 * and fewer than two unlocked-and-incomplete chapters to compare) — an
 * empty sidebar slot beats a forced, uninformative one.
 */
export function pickNudge(
  chapters: ChapterView[],
  favorites: string[],
  exercises: BMExercise[],
  solved: BMSolvedMap,
  excludeCategoryId: string | null
): SidebarNudge {
  const unsolvedFavoriteIds = favorites.filter((id) => !solved[id]);
  if (unsolvedFavoriteIds.length > 0) {
    // Newest-favorited first (favorites' own order), capped to 3 so the
    // card stays a preview, not a second copy of the favorites panel.
    const items = unsolvedFavoriteIds
      .map((id) => exercises.find((e) => e.id === id))
      .filter((e): e is BMExercise => Boolean(e))
      .slice(0, 3);
    return { kind: 'favorites', count: unsolvedFavoriteIds.length, items };
  }

  const candidates = chapters.filter(
    (c) => !c.locked && c.progress.percent < 100 && c.category.id !== excludeCategoryId
  );
  if (candidates.length < 2) return null;

  const weakest = [...candidates].sort(
    (a, b) =>
      a.progress.percent - b.progress.percent ||
      b.progress.total - b.progress.solved - (a.progress.total - a.progress.solved)
  )[0];

  return { kind: 'weak-chapter', chapter: weakest };
}
