import { ProfilePanel } from './ProfilePanel';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';

interface LeftColumnProps {
  leaderboardRows: LeaderboardRow[];
  leaderboardReady: boolean;
  currentUserId: string | null;
}

/**
 * Left rail — a single profile panel (photo, cover, level/XP, streak,
 * leaderboard rank), full column height, flush to the viewport's left edge
 * at the 3-column breakpoint (see .cap-col-left's breakout rule in
 * styles.css). Replaced the old ContinueCard/NudgeCard/SimulareBannerCard
 * stack, which duplicated information the chapter grid right next to it
 * already showed.
 */
export function LeftColumn({ leaderboardRows, leaderboardReady, currentUserId }: LeftColumnProps) {
  return (
    <aside className="cap-col cap-col-left" aria-label="Profilul tău">
      <ProfilePanel
        leaderboardRows={leaderboardRows}
        leaderboardReady={leaderboardReady}
        currentUserId={currentUserId}
      />
    </aside>
  );
}
