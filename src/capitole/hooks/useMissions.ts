import { useEffect, useState } from 'react';
import { computeMissionProgress, todayIso, type MissionProgress } from '../lib/missions';

export interface MissionsState {
  missions: MissionProgress[];
  /** False until the first read (claims + progress) has settled. */
  ready: boolean;
}

/**
 * Real daily-mission progress, plus the one-time XP payout when a mission
 * is completed for the first time today.
 *
 * Progress is computed straight from BM.Storage — see lib/missions.ts. The
 * only thing that needs a network round trip is "was today's reward for
 * this mission already claimed" (so reloading the page, or opening it on
 * a second device, never pays out twice) — read from and written to
 * user_daily_mission_claims (owner-scoped RLS, see the migration) through
 * the SAME authenticated Supabase client js/auth.js already holds, not a
 * second session of our own.
 *
 * The actual XP grant reuses BM.Training.addXp() (js/training-stats.js,
 * loaded on this page specifically for this — see capitole.html) instead
 * of writing to training_stats directly, so it goes through the exact
 * same local+DB write every other XP award on the site already uses.
 */
export function useMissions(): MissionsState {
  const [state, setState] = useState<MissionsState>({ missions: [], ready: false });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const storage = window.BM?.Storage;
      const auth = window.BMAuth;
      if (!storage) return;

      const iso = todayIso();
      const solved = storage.getSolved();
      const progress = computeMissionProgress(solved, iso);

      const uid = auth?.user?.id;
      const sb = auth?.supabase;

      // No session yet, or Supabase client not ready — still show real
      // progress bars, just can't confirm claim state or pay out XP until
      // it is (a later bmauth:synced re-run of this same effect covers it).
      if (!uid || !sb) {
        if (!cancelled) setState({ missions: progress, ready: true });
        return;
      }

      let claimedKeys = new Set<string>();
      try {
        const { data } = await sb
          .from('user_daily_mission_claims')
          .select('mission_key')
          .eq('day', iso);
        claimedKeys = new Set((data ?? []).map((row) => row.mission_key as string));
      } catch {
        // Read failed (offline, RLS hiccup) — treat as "nothing confirmed
        // claimed yet" rather than blocking the progress bars on it; worst
        // case a completed mission's checkmark waits for the next load.
      }

      // Pay out any mission that's newly complete and not yet claimed.
      // Sequential, not Promise.all: each insert's uniqueness (user_id,
      // day, mission_key) is what prevents a double payout, so there's no
      // benefit to racing them, only risk of a rare double-insert if two
      // finished in the same tick.
      for (const mission of progress) {
        if (!mission.done || claimedKeys.has(mission.key)) continue;
        try {
          const { error } = await sb
            .from('user_daily_mission_claims')
            .insert({ user_id: uid, day: iso, mission_key: mission.key, xp_awarded: mission.xpReward });
          // A unique-violation here means another tab/load already claimed
          // it between our read and this insert — not an error worth
          // surfacing, just skip the XP grant below.
          if (!error) {
            window.BM?.Training?.addXp(mission.xpReward);
            claimedKeys.add(mission.key);
          }
        } catch {
          // Same reasoning as the read above — don't block the rest of the
          // page on a gamification side-effect failing.
        }
      }

      // `done` (shown as the checkmark) reflects the real-world condition
      // being met, independent of whether the claim write succeeded — a
      // solved-8-exercises mission is complete the moment the 8th is
      // solved, whether or not its one-time XP happened to land yet.
      if (!cancelled) setState({ missions: progress, ready: true });
    };

    void run();
    document.addEventListener('bmauth:synced', run);
    document.addEventListener('bmauth:streak-updated', run);
    return () => {
      cancelled = true;
      document.removeEventListener('bmauth:synced', run);
      document.removeEventListener('bmauth:streak-updated', run);
    };
  }, []);

  return state;
}
