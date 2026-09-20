import { Hero } from './components/Hero';
import { ChaptersSection } from './components/ChaptersSection';
import { LeftColumn } from './components/Sidebar/LeftColumn';
import { RightColumn } from './components/Sidebar/RightColumn';
import { useCapitoleData } from './hooks/useCapitoleData';
import { useMissions } from './hooks/useMissions';
import { useLeaderboard } from './hooks/useLeaderboard';

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
 * .cap-col-middle carries `order: -1` at narrow widths (see styles.css) so
 * it's what appears first when the three collapse into one stacked column,
 * even though it's authored second here.
 */
export function App() {
  const { stats, chapters, ready } = useCapitoleData();
  const { missions, ready: missionsReady } = useMissions();
  const { rows: leaderboardRows, ready: leaderboardReady } = useLeaderboard();
  const currentUserId = window.BMAuth?.user?.id ?? null;

  return (
    <div className="cap-shell">
      <div className="cap-three-col">
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
  );
}
