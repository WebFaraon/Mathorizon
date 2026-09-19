import { useEffect, useState } from 'react';
import type { BMStats, ChapterView } from '../lib/bm-types';
import { pickContinueTarget, pickNudge, type ContinueTarget, type SidebarNudge } from '../lib/recommendations';

export type { ChapterView } from '../lib/bm-types';

export interface CapitoleData {
  stats: BMStats | null;
  chapters: ChapterView[];
  /** Null only until the first snapshot lands — see `ready`. */
  continueTarget: ContinueTarget | null;
  nudge: SidebarNudge;
  /** False until the Supabase custom-exercise merge has settled — skeletons until then. */
  ready: boolean;
}

const EMPTY: CapitoleData = { stats: null, chapters: [], continueTarget: null, nudge: null, ready: false };

/** Snapshot of everything this page shows, straight out of the BM globals. */
function readSnapshot(): Omit<CapitoleData, 'ready'> | null {
  const bm = window.BM;
  const storage = bm?.Storage;
  const categories = bm?.CATEGORIES;
  const exercises = bm?.EXERCISES;
  if (!storage || !categories || !exercises) return null;

  const chapters: ChapterView[] = categories.map((category) => {
    const progress = storage.getProgressForCategory(category.id, exercises);
    return { category, progress, locked: progress.total === 0 };
  });

  const solved = storage.getSolved();
  const continueTarget = pickContinueTarget(chapters, exercises, solved);
  const nudge = pickNudge(
    chapters,
    storage.getFavorites(),
    exercises,
    solved,
    continueTarget.chapter?.category.id ?? null
  );

  return { stats: storage.getStats(exercises), chapters, continueTarget, nudge };
}

/**
 * The page's single data source.
 *
 * Mirrors js/app.js's old lifecycle one-for-one:
 *  1. wait for BM.customExercisesReady() — the Supabase custom_exercises
 *     merge — before the first real render, so a chapter whose exercises all
 *     come from the DB never flashes as "În curând";
 *  2. read through BM.Storage, whose localStorage mirror js/auth.js fills
 *     from Supabase (user_solved / user_streak / user_favorites);
 *  3. re-read on `bmauth:synced` (progress landed) and
 *     `bmauth:streak-updated` (the once-a-day streak bump, which fires on
 *     every page and can land after the first read).
 *
 * The sidebar's "continue" and "nudge" picks (lib/recommendations.ts) are
 * derived in the same snapshot, from the same read — not a second
 * independent look at window.BM — so they can never disagree with what the
 * chapter grid itself shows.
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
