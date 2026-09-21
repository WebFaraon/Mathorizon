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
 * Right rail — one presentation surface (.cap-sidebar-panel), same as the
 * left rail's .cap-profile-panel, holding two sections (daily missions,
 * then the XP leaderboard) separated by a divider instead of two
 * independently-bordered cards stacked with a gap between them. Each
 * section still gates its own ready state internally (see MissionsCard/
 * LeaderboardCard) — nothing here waits on both before showing either.
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
        className="cap-sidebar-panel"
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: EASE_OUT }}
      >
        <MissionsCard missions={missions} ready={missionsReady} />
        <div className="cap-sidebar-divider" />
        <LeaderboardCard rows={leaderboardRows} ready={leaderboardReady} currentUserId={currentUserId} />
      </motion.div>
    </aside>
  );
}
