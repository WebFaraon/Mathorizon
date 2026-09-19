import { MissionsCard } from './MissionsCard';
import { LeaderboardCard } from './LeaderboardCard';
import type { MissionProgress } from '../../lib/missions';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';

interface RightColumnProps {
  missions: MissionProgress[];
  missionsReady: boolean;
  leaderboardRows: LeaderboardRow[];
  leaderboardReady: boolean;
  currentUserId: string | null;
}

/** Right rail — the Duolingo-style widgets: daily missions, then the XP
    leaderboard, always rendered alongside the hero + chapters + left rail. */
export function RightColumn({
  missions,
  missionsReady,
  leaderboardRows,
  leaderboardReady,
  currentUserId
}: RightColumnProps) {
  return (
    <aside className="cap-col cap-col-right" aria-label="Misiuni și clasament">
      <MissionsCard missions={missions} ready={missionsReady} />
      <LeaderboardCard rows={leaderboardRows} ready={leaderboardReady} currentUserId={currentUserId} />
    </aside>
  );
}
