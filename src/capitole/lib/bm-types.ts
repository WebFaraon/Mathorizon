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

import type { SupabaseClient } from '@supabase/supabase-js';

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
  /** Every exercise object in js/data.js and every custom_exercises row
      (see js/custom-exercises.js) sets this — used by the sidebar's
      "Continuă de unde ai rămas" card to name the specific next exercise. */
  title: string;
}

/** js/storage.js → getSolved() — exercise id → the ms timestamp it was solved at. */
export type BMSolvedMap = Record<string, number>;

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
  /** Keyed by exercise id. Source for the sidebar's "next exercise" pick and for daily missions. */
  getSolved(): BMSolvedMap;
  /** Exercise ids, most-recently-favorited first. Source for the nudge card. */
  getFavorites(): string[];
  /** lastDate is "YYYY-MM-DD" or null — source for the "visited today" mission. */
  getStreak(): { count: number; lastDate: string | null };
  recordVisit(): void;
}

export interface BMGlobal {
  CATEGORIES?: BMCategory[];
  EXERCISES?: BMExercise[];
  Storage?: BMStorage;
  /** Resolves once js/custom-exercises.js has merged the Supabase rows into EXERCISES. */
  customExercisesReady?: () => Promise<unknown>;
  gotoCategory?: (categoryId: string, subcategoryId?: string, exerciseId?: string) => void;
  Training?: {
    addXp(amount: number): number;
    /** XP needed per level (js/training-stats.js) — level = floor(xp / this) + 1.
        Read here rather than hardcoded so the leaderboard's level column
        (useLeaderboard.ts) can never drift from Antrenament's own math. */
    XP_PER_LEVEL?: number;
  };
}

/**
 * Set up by js/auth.js. The island uses the live `supabase` client
 * (the SAME instance auth.js authenticated — not a second client with its
 * own session) for the two things that need an authenticated write/RPC
 * call and have no existing BM.* wrapper: claiming a daily mission's XP
 * (an owner-scoped insert — see supabase/migrations/..._daily_mission_claims.sql)
 * and reading the XP leaderboard (a security-definer RPC — see
 * supabase/migrations/..._xp_leaderboard.sql). Typed via @supabase/supabase-js's
 * own SupabaseClient — already a real dependency (server-side, e.g.
 * api/admin/get-waitlist.js) — a type-only import, so it costs nothing in
 * the bundle; the actual client instance is created at runtime by the
 * classic <script> from the Supabase CDN, not by this import.
 */
export interface BMAuthGlobal {
  readonly user: { id: string } | null;
  readonly supabase: SupabaseClient | null;
}

/**
 * Derived view of one chapter — not a raw BM shape, but built straight from
 * BM.CATEGORIES + BM.Storage.getProgressForCategory() (see
 * hooks/useCapitoleData.ts). Lives here, not in the hook file, so
 * lib/recommendations.ts can consume it without an import cycle.
 */
export interface ChapterView {
  category: BMCategory;
  progress: BMCategoryProgress;
  /**
   * No exercises published for this chapter yet → renders as "În curând"
   * and isn't clickable. Derived from the live count (`progress.total === 0`),
   * never hardcoded per chapter: geometry has no exercises in js/data.js at
   * all and only unlocks once custom_exercises rows arrive from Supabase.
   */
  locked: boolean;
}
