import { useState } from 'react';
import { Hero } from './components/Hero';
import { ChaptersSection } from './components/ChaptersSection';
import { MobileTabBar } from './components/MobileTabBar';
import { LeftColumn } from './components/Sidebar/LeftColumn';
import { RightColumn } from './components/Sidebar/RightColumn';
import { useCapitoleData } from './hooks/useCapitoleData';
import { useMissions } from './hooks/useMissions';
import { useLeaderboard } from './hooks/useLeaderboard';
import { MOBILE_TAB_INDEX, type MobileTab } from './lib/mobile-tabs';

/**
 * Everything on capitole.html below the shared navbar.
 *
 * Deliberately NOT in here: the navbar itself, the Favorite/Istoric side
 * panels and the back-to-top button. Those are opened from the navbar, which
 * is common to all five tabs and still vanilla — they stay in the page's own
 * markup, driven by js/app.js, until the rest of the site is migrated too.
 *
 * Layout: three columns, all starting at the same top edge (right under the
 * navbar) and running the full height of the page — not just alongside the
 * chapter grid like the previous single right-hand sidebar did:
 *   - left:   profile panel (photo, cover, level/XP, streak, leaderboard rank)
 *   - middle: hero (title, grade switch, progress chips) → chapter grid
 *   - right:  daily missions → XP leaderboard
 * .cap-col-middle carries `order: -1` at narrow-but-not-phone widths (see
 * styles.css) so it's what appears first when the three collapse into one
 * stacked column, even though it's authored second here.
 *
 * Below the phone breakpoint that stacked column becomes a Clash Royale-
 * style tab bar instead (see .cap-tabbar/.cap-mobile-viewport in
 * styles.css): the three columns sit side by side in a 300%-wide row that
 * slides via --cap-tab-index, one full pane per tab, rather than stacking
 * top to bottom — there's no good reading order for "profile, then
 * chapters, then missions" all in one scroll on a phone. mobileTab only
 * ever matters at that width; the CSS driving the slide simply doesn't
 * apply above it, so this state is otherwise inert. All three columns'
 * own data hooks (above) keep running regardless of which tab is active —
 * switching tabs only moves the slide, it never unmounts anything, so a
 * tab you switch back to is never stale or re-loading.
 */
export function App() {
  const { stats, chapters, ready } = useCapitoleData();
  const { missions, ready: missionsReady } = useMissions();
  const { rows: leaderboardRows, ready: leaderboardReady } = useLeaderboard();
  const currentUserId = window.BMAuth?.user?.id ?? null;
  const [mobileTab, setMobileTab] = useState<MobileTab>('capitole');

  return (
    <div className="cap-shell">
      <div className="cap-mobile-viewport">
        <div
          className="cap-three-col"
          style={{ '--cap-tab-index': MOBILE_TAB_INDEX[mobileTab] } as React.CSSProperties}
        >
          <LeftColumn
            leaderboardRows={leaderboardRows}
            leaderboardReady={leaderboardReady}
            currentUserId={currentUserId}
          />

          <div className="cap-col cap-col-middle">
            <Hero stats={stats} />
            <ChaptersSection chapters={chapters} ready={ready} />
          </div>

          <RightColumn
            missions={missions}
            missionsReady={missionsReady}
            leaderboardRows={leaderboardRows}
            leaderboardReady={leaderboardReady}
            currentUserId={currentUserId}
          />
        </div>
      </div>

      <MobileTabBar active={mobileTab} onChange={setMobileTab} />
    </div>
  );
}
