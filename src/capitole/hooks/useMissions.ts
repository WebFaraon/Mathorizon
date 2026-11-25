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
 * The reward itself is granted on the server (rpc claim_mission, migration
 * 20261125110000): fixed sums, once per day per mission. The browser only
 * shows the new total (BM.Training.setTotalXp).
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
      // Only a confirmed student is paid (teachers, managers and admins get no XP from anything for now). With the role not known yet
      // nothing is claimed: the claim row would be written and the XP refused, and the student would lose it. The run repeats on bmauth:profile.
      const payable = auth?.role === 'elev';
      for (const mission of progress) {
        if (!payable) break;
        if (!mission.done || claimedKeys.has(mission.key)) continue;
        try {
          // The reward is granted by the server (claim_mission): fixed sums, once per day per mission, students only.
          // Nothing is written from here directly any more (the three tables are read-only for the browser).
          const { data, error } = await sb.rpc('claim_mission', { p_key: mission.key, p_day: iso });
          const res = data as { ok?: boolean; total?: number } | null;
          if (!error && res && res.ok && typeof res.total === 'number') {
            window.BM?.Training?.setTotalXp?.(res.total);
          }
          if (!error) claimedKeys.add(mission.key);
        } catch {
          // Same reasoning as the read above: don't block the rest of the page on a gamification side-effect failing.
        }
      }

      // `done` (shown as the checkmark) reflects the real-world condition
      // being met, independent of whether the claim write succeeded — a
      // solved-8-exercises mission is complete the moment the 8th is
      // solved, whether or not its one-time XP happened to land yet.
      if (!cancelled) setState({ missions: progress, ready: true });
    };

    void run();
    // The path's progress may arrive later from the database (Parcurs.ready) or change when a lesson is finished.
    (window as unknown as { Parcurs?: { ready(): Promise<unknown> } }).Parcurs?.ready().then(() => { if (!cancelled) void run(); }, () => {});
    document.addEventListener('parcurs:changed', run);
    document.addEventListener('bmauth:synced', run);
    document.addEventListener('bmauth:profile', run);
    document.addEventListener('bmauth:streak-updated', run);
    return () => {
      cancelled = true;
      document.removeEventListener('parcurs:changed', run);
      document.removeEventListener('bmauth:synced', run);
      document.removeEventListener('bmauth:profile', run);
      document.removeEventListener('bmauth:streak-updated', run);
    };
  }, []);

  return state;
}
