import { motion, useReducedMotion } from 'framer-motion';
import { MissionsCard } from './MissionsCard';
import { LeaderboardCard } from './LeaderboardCard';
import type { MissionProgress } from '../../lib/missions';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { EASE_OUT } from '../../lib/motion';

interface RightColumnProps {
  missions: MissionProgress[];
  missionsReady: boolean;
  leaderboardRows: LeaderboardRow[];
  leaderboardReady: boolean;
  currentUserId: string | null;
}

/**
 * Right rail — two separate cards (.cap-side-card), daily missions and
 * the XP leaderboard, each with its own frame. The rail itself is fixed to
 * the viewport on wide screens, so both stay in place while the middle
 * scrolls. Each card still gates its own ready state internally (see
 * MissionsCard/LeaderboardCard) — nothing here waits on both before showing either.
 */
export function RightColumn({
  missions,
  missionsReady,
  leaderboardRows,
  leaderboardReady,
  currentUserId
}: RightColumnProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <aside className="cap-col cap-col-right" aria-label="Misiuni și clasament">
      <motion.div
        className="cap-side-card"
        initial={prefersReducedMotion ? undefined : { opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.42, ease: EASE_OUT }}
      >
        <MissionsCard missions={missions} ready={missionsReady} />
      </motion.div>
      <motion.div
        className="cap-side-card"
        initial={prefersReducedMotion ? undefined : { opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.42, delay: 0.08, ease: EASE_OUT }}
      >
        <LeaderboardCard rows={leaderboardRows} ready={leaderboardReady} currentUserId={currentUserId} />
      </motion.div>
    </aside>
  );
}
