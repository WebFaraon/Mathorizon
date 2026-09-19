import { ContinueCard } from './ContinueCard';
import { NudgeCard } from './NudgeCard';
import { SimulareBannerCard } from './SimulareBannerCard';
import type { ContinueTarget, SidebarNudge } from '../../lib/recommendations';

interface LeftColumnProps {
  continueTarget: ContinueTarget | null;
  nudge: SidebarNudge;
  ready: boolean;
}

/**
 * Left rail — the "what to do next" cards that were the whole sidebar
 * before missions/leaderboard were added. Runs the full column height
 * alongside the hero + chapters + right rail, not just alongside the
 * grid, in its own always-rendered column (never a tab).
 */
export function LeftColumn({ continueTarget, nudge, ready }: LeftColumnProps) {
  return (
    <aside className="cap-col cap-col-left" aria-label="Recomandări">
      <ContinueCard target={continueTarget} ready={ready} />
      <NudgeCard nudge={nudge} ready={ready} />
      <SimulareBannerCard />
    </aside>
  );
}
