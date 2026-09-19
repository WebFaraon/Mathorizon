import { useEffect, useState } from 'react';

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  totalXp: number;
  bestStreak: number;
  rank: number;
  /** floor(totalXp / XP_PER_LEVEL) + 1 — same formula js/training-stats.js
      uses for the student's own level, read from BM.Training.XP_PER_LEVEL
      rather than a second hardcoded 100 so the two can't drift apart. */
  level: number;
}

export interface LeaderboardState {
  rows: LeaderboardRow[];
  /** False until the RPC call has settled (success or failure). */
  ready: boolean;
}

/** Every elev account (see supabase/migrations/..._xp_leaderboard_all_students.sql),
    not just a top-10 cut — comfortably above the current student count,
    kept finite as a sane ceiling rather than truly unbounded. */
const LIMIT = 500;

/** Row shape returned by the get_xp_leaderboard() RPC (snake_case, as Postgres returns it). */
interface LeaderboardRpcRow {
  user_id: string;
  display_name: string;
  total_xp: number;
  best_streak: number;
  rank: number;
}

/**
 * Top students by lifetime XP — real numbers from training_stats, via the
 * get_xp_leaderboard security-definer function (training_stats itself has
 * owner-only RLS, so no client query can rank across users directly; see
 * supabase/migrations/20260919090100_xp_leaderboard.sql for why this has
 * to be a database-side function rather than a Supabase table read).
 *
 * All-time, not a weekly league — training_stats.total_xp has no
 * week-bucketed counterpart to rank by instead.
 */
export function useLeaderboard(): LeaderboardState {
  const [state, setState] = useState<LeaderboardState>({ rows: [], ready: false });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const sb = window.BMAuth?.supabase;
      if (!sb) return;

      try {
        const { data, error } = await sb.rpc('get_xp_leaderboard', { p_limit: LIMIT });
        if (error) throw error;
        const xpPerLevel = window.BM?.Training?.XP_PER_LEVEL ?? 100;
        const rpcRows = (data ?? []) as LeaderboardRpcRow[];
        const rows: LeaderboardRow[] = rpcRows.map((row) => ({
          userId: row.user_id,
          displayName: row.display_name,
          totalXp: row.total_xp,
          bestStreak: row.best_streak,
          rank: row.rank,
          level: Math.floor(row.total_xp / xpPerLevel) + 1
        }));
        if (!cancelled) setState({ rows, ready: true });
      } catch {
        // Offline / RPC not reachable — an empty leaderboard renders as
        // "nothing to show yet" (see LeaderboardCard), not an error banner.
        if (!cancelled) setState({ rows: [], ready: true });
      }
    };

    void run();
    // A sign-in after this page already mounted (rare on a protected
    // route, but bmauth:synced is cheap to re-run on) is the one moment
    // the client goes from no-session to authenticated.
    document.addEventListener('bmauth:synced', run);
    return () => {
      cancelled = true;
      document.removeEventListener('bmauth:synced', run);
    };
  }, []);

  return state;
}
