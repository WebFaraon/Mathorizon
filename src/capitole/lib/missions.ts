/* ============================================================
   Daily missions — definitions.
   ============================================================
   Definitions live here (constants), same as BM.CATEGORIES defines the
   chapters — there's no admin UI to author missions yet, so a database
   table of definitions would just be a second place to keep in sync with
   this one. What DOES live server-side is which missions today's reward
   was already paid out for (see supabase/migrations/
   20260919090200_daily_mission_claims.sql and hooks/useMissions.ts) —
   that's real per-user state, this is just configuration.

   Progress for every mission here is computed from data the site already
   tracks for real (BM.Storage.getSolved() timestamps, BM.Storage.
   getStreak()) — nothing invented, nothing mocked.
   ============================================================ */

import type { BMSolvedMap } from './bm-types';

export interface MissionDefinition {
  key: string;
  title: string;
  target: number;
  xpReward: number;
  /** 'lesson' = lessons finished today on the Învață path (the main missions); 'solve' = exercises solved today. */
  kind: 'lesson' | 'solve';
}

/* The main missions are lessons (the path, Învață); the exercise ones are the extra. The two exercise keys are the old ones, so rewards already paid out stay valid. */
export const DAILY_MISSIONS: MissionDefinition[] = [
  { key: 'lesson_1_today', title: 'Termină o lecție', target: 1, xpReward: 10, kind: 'lesson' },
  { key: 'lesson_3_today', title: 'Termină 3 lecții', target: 3, xpReward: 30, kind: 'lesson' },
  { key: 'solve_5_today', title: 'Rezolvă 5 exerciții', target: 5, xpReward: 20, kind: 'solve' },
  { key: 'solve_10_today', title: 'Rezolvă 10 exerciții', target: 10, xpReward: 40, kind: 'solve' }
];

/** Local calendar date as "YYYY-MM-DD" — matches _isoDate() in js/storage.js. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameLocalDay(ts: number, iso: string): boolean {
  const d = new Date(ts);
  const tsIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return tsIso === iso;
}

/** How many exercises were solved on today's local calendar date. */
export function countSolvedToday(solved: BMSolvedMap, iso: string): number {
  return Object.values(solved).filter((ts) => isSameLocalDay(ts, iso)).length;
}

/**
 * Lessons first finished today. The path stores the time of the FIRST completion of each lesson (js/parcurs/progress.js,
 * window.Parcurs, copy in localStorage), so doing the same lesson again does not count twice; tests and section skips don't count.
 */
export function countLessonsToday(iso: string): number {
  type Rec = { at?: number; via?: string };
  let map: Record<string, Rec> = {};
  const live = (window as unknown as { Parcurs?: { all(): Record<string, Rec> } }).Parcurs;
  try {
    if (live) map = live.all();
    else {
      const uid = window.BMAuth?.user?.id || 'anon';
      map = JSON.parse(localStorage.getItem('bm_parcurs_v1_' + uid) || '{}') || {};
    }
  } catch { map = {}; }
  return Object.keys(map).filter((id) => {
    const r = map[id];
    return r && r.via !== 'skip' && !/\.(test|skip)$/.test(id) && typeof r.at === 'number' && r.at > 1e12 && isSameLocalDay(r.at, iso);
  }).length;
}

export interface MissionProgress extends MissionDefinition {
  progress: number;
  done: boolean;
}

/** Real progress for every mission, from today's finished lessons and solved exercises. */
export function computeMissionProgress(solved: BMSolvedMap, iso: string): MissionProgress[] {
  const solvedToday = countSolvedToday(solved, iso);
  const lessonsToday = countLessonsToday(iso);

  return DAILY_MISSIONS.map((mission) => {
    const n = mission.kind === 'lesson' ? lessonsToday : solvedToday;
    return { ...mission, progress: Math.min(n, mission.target), done: n >= mission.target };
  });
}
