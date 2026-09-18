import { useEffect, useState } from 'react';
import type { BMCategory, BMCategoryProgress, BMStats } from '../lib/bm-types';

export interface ChapterView {
  category: BMCategory;
  progress: BMCategoryProgress;
  /**
   * No exercises published for this chapter yet → renders as "În curând"
   * and isn't clickable. Derived from the live count exactly as js/app.js
   * derived it (`prog.total === 0`), never hardcoded per chapter: geometry
   * has no exercises in js/data.js at all and only becomes unlocked once
   * custom_exercises rows arrive from Supabase, so which chapters are
   * locked is a property of the data, not of this file.
   */
  locked: boolean;
}

export interface CapitoleData {
  stats: BMStats | null;
  chapters: ChapterView[];
  /** False until the Supabase custom-exercise merge has settled — skeletons until then. */
  ready: boolean;
}

const EMPTY: CapitoleData = { stats: null, chapters: [], ready: false };

/** Snapshot of everything this page shows, straight out of the BM globals. */
function readSnapshot(): Omit<CapitoleData, 'ready'> | null {
  const bm = window.BM;
  const storage = bm?.Storage;
  const categories = bm?.CATEGORIES;
  const exercises = bm?.EXERCISES;
  if (!storage || !categories || !exercises) return null;

  return {
    stats: storage.getStats(exercises),
    chapters: categories.map((category) => {
      const progress = storage.getProgressForCategory(category.id, exercises);
      return { category, progress, locked: progress.total === 0 };
    })
  };
}

/**
 * The page's single data source.
 *
 * Mirrors js/app.js's old lifecycle one-for-one:
 *  1. wait for BM.customExercisesReady() — the Supabase custom_exercises
 *     merge — before the first real render, so a chapter whose exercises all
 *     come from the DB never flashes as "În curând";
 *  2. read through BM.Storage, whose localStorage mirror js/auth.js fills
 *     from Supabase (user_solved / user_streak);
 *  3. re-read on `bmauth:synced` (progress landed) and
 *     `bmauth:streak-updated` (the once-a-day streak bump, which fires on
 *     every page and can land after the first read).
 *
 * Both listeners stay attached rather than running once: re-reading is
 * idempotent and cheap, and it keeps the numbers correct if a sync ever
 * resolves twice (e.g. a second account signing in without a reload).
 */
export function useCapitoleData(): CapitoleData {
  const [data, setData] = useState<CapitoleData>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    const refresh = (ready: boolean) => {
      if (cancelled) return;
      const snapshot = readSnapshot();
      if (!snapshot) return;
      setData({ ...snapshot, ready });
    };

    const bm = window.BM;
    const merged = bm?.customExercisesReady?.() ?? Promise.resolve();
    // .then only — customExercisesReady() never rejects (it resolves on
    // failure too, and races a 10s timeout), so there is no error branch.
    void merged.then(() => refresh(true));

    const onSynced = () => refresh(true);
    document.addEventListener('bmauth:synced', onSynced);
    document.addEventListener('bmauth:streak-updated', onSynced);

    return () => {
      cancelled = true;
      document.removeEventListener('bmauth:synced', onSynced);
      document.removeEventListener('bmauth:streak-updated', onSynced);
    };
  }, []);

  return data;
}
