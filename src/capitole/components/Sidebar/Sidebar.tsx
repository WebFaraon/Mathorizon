import { ContinueCard } from './ContinueCard';
import { NudgeCard } from './NudgeCard';
import { SimulareBannerCard } from './SimulareBannerCard';
import type { ContinueTarget, SidebarNudge } from '../../lib/recommendations';

interface SidebarProps {
  continueTarget: ContinueTarget | null;
  nudge: SidebarNudge;
  ready: boolean;
}

/**
 * The persistent column next to the chapter grid — not a tab, not a
 * separate section the user has to navigate to, always rendered alongside
 * it. Order: the main recommendation first, the smaller attention signal
 * second, the Simulare BAC promo last (it's the same offer regardless of
 * personal progress, so it reads best as the closing card, not the lead).
 */
export function Sidebar({ continueTarget, nudge, ready }: SidebarProps) {
  return (
    <aside className="cap-sidebar" aria-label="Recomandări">
      <ContinueCard target={continueTarget} ready={ready} />
      <NudgeCard nudge={nudge} ready={ready} />
      <SimulareBannerCard />
    </aside>
  );
}
