/* Shapes of the vanilla data this island reads.
   ============================================================
   The Capitole page is React, but the DATA layer deliberately is not.
   Chapters/exercises live in js/data.js, and everything user-specific
   (solved exercises, streak, favorites, history) is synced from Supabase
   into localStorage by js/auth.js — which runs on EVERY page of the site,
   including the four that aren't migrated yet. Re-implementing those
   Supabase queries here would fork the source of truth between this page
   and the rest, so the island reads the same `window.BM` API every other
   page reads, and re-reads it on the same events js/app.js listened for.

   Only the members actually used are declared. The names are copied from
   js/data.js / js/storage.js and must keep matching them exactly.
*/

export interface BMSubcategory {
  id: string;
  name: string;
  /** May contain markup, same as a chapter symbol (see below). */
  symbol: string;
  color: string;
  description: string;
}

/** One of the 4 chapters — js/data.js → BM.CATEGORIES. */
export interface BMCategory {
  id: string;
  name: string;
  /**
   * Math glyph for the chapter. Can contain HTML: combinatorics ships as
   * `C<span class="sym-nb"><sup>k</sup><sub>n</sub></span>` so the k/n sit
   * stacked (.sym-nb in css/style.css). That's why it's rendered as markup.
   */
  symbol: string;
  gradient: string;
  /** The chapter's accent color — the per-card color coding the design keeps. */
  color: string;
  description: string;
  tagline?: string;
  subcategories: BMSubcategory[];
}

/** Only the fields this page needs; a real exercise has many more. */
export interface BMExercise {
  id: string;
  categoryId: string;
  subcategoryId: string;
}

/** js/storage.js → getStats() */
export interface BMStats {
  total: number;
  solvedCount: number;
  percent: number;
  streak: number;
}

/** js/storage.js → getProgressForCategory() */
export interface BMCategoryProgress {
  solved: number;
  total: number;
  percent: number;
}

export interface BMStorage {
  getStats(exercises: BMExercise[]): BMStats;
  getProgressForCategory(categoryId: string, exercises: BMExercise[]): BMCategoryProgress;
  recordVisit(): void;
}

export interface BMGlobal {
  CATEGORIES?: BMCategory[];
  EXERCISES?: BMExercise[];
  Storage?: BMStorage;
  /** Resolves once js/custom-exercises.js has merged the Supabase rows into EXERCISES. */
  customExercisesReady?: () => Promise<unknown>;
  gotoCategory?: (categoryId: string, subcategoryId?: string, exerciseId?: string) => void;
}
