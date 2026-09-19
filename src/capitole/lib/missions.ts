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
}

export const DAILY_MISSIONS: MissionDefinition[] = [
  { key: 'visit_today', title: 'Deschide Mathorizon azi', target: 1, xpReward: 5 },
  { key: 'solve_3_today', title: 'Rezolvă 3 exerciții', target: 3, xpReward: 15 },
  { key: 'solve_8_today', title: 'Rezolvă 8 exerciții', target: 8, xpReward: 30 }
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

export interface MissionProgress extends MissionDefinition {
  progress: number;
  done: boolean;
}

/**
 * Real progress for every mission, from today's solved count + whether
 * the streak was already bumped today (js/auth.js's daily-bump IIFE runs
 * on every page load, so `lastDate === today` is true well before this
 * even renders — "visit_today" is effectively a check-in reward, same
 * spirit as Duolingo's first daily chest).
 */
export function computeMissionProgress(
  solved: BMSolvedMap,
  streakLastDate: string | null,
  iso: string
): MissionProgress[] {
  const solvedToday = countSolvedToday(solved, iso);
  const visited = streakLastDate === iso ? 1 : 0;

  return DAILY_MISSIONS.map((mission) => {
    const progress = mission.key === 'visit_today' ? visited : solvedToday;
    return { ...mission, progress: Math.min(progress, mission.target), done: progress >= mission.target };
  });
}
