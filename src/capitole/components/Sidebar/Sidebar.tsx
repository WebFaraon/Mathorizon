import { ContinueCard } from './ContinueCard';
import { NudgeCard } from './NudgeCard';
import { SimulareBannerCard } from './SimulareBannerCard';
import { MissionsCard } from './MissionsCard';
import { LeaderboardCard } from './LeaderboardCard';
import type { ContinueTarget, SidebarNudge } from '../../lib/recommendations';
import type { MissionProgress } from '../../lib/missions';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';

interface SidebarProps {
  continueTarget: ContinueTarget | null;
  nudge: SidebarNudge;
  ready: boolean;
  missions: MissionProgress[];
  missionsReady: boolean;
  leaderboardRows: LeaderboardRow[];
  leaderboardReady: boolean;
  currentUserId: string | null;
}

/**
 * The persistent column next to the chapter grid — not a tab, not a
 * separate section the user has to navigate to, always rendered alongside
 * it. Order: the two Duolingo-style widgets (daily missions, then the XP
 * leaderboard they were requested together with) lead, since they're the
 * new headline content; the existing recommendation/nudge/promo cards
 * follow, unchanged from before.
 */
export function Sidebar({
  continueTarget,
  nudge,
  ready,
  missions,
  missionsReady,
  leaderboardRows,
  leaderboardReady,
  currentUserId
}: SidebarProps) {
  return (
    <aside className="cap-sidebar" aria-label="Recomandări">
      <MissionsCard missions={missions} ready={missionsReady} />
      <LeaderboardCard rows={leaderboardRows} ready={leaderboardReady} currentUserId={currentUserId} />
      <ContinueCard target={continueTarget} ready={ready} />
      <NudgeCard nudge={nudge} ready={ready} />
      <SimulareBannerCard />
    </aside>
  );
}
