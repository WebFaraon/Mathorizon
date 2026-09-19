import { Hero } from './components/Hero';
import { SummaryStrip } from './components/SummaryStrip';
import { ChaptersSection } from './components/ChaptersSection';
import { Sidebar } from './components/Sidebar/Sidebar';
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
 * Layout: hero (+ the grade switch) → compact progress line → a two-column
 * body (chapter grid + a persistent sidebar). The sidebar leads with the
 * daily-missions and XP-leaderboard cards (useMissions/useLeaderboard),
 * then the existing "continue"/nudge/Simulare cards, unchanged.
 */
export function App() {
  const { stats, chapters, continueTarget, nudge, ready } = useCapitoleData();
  const { missions, ready: missionsReady } = useMissions();
  const { rows: leaderboardRows, ready: leaderboardReady } = useLeaderboard();

  return (
    <>
      <Hero />
      <SummaryStrip stats={stats} />
      <div className="cap-shell">
        <div className="cap-layout">
          <ChaptersSection chapters={chapters} ready={ready} />
          <Sidebar
            continueTarget={continueTarget}
            nudge={nudge}
            ready={ready}
            missions={missions}
            missionsReady={missionsReady}
            leaderboardRows={leaderboardRows}
            leaderboardReady={leaderboardReady}
            currentUserId={window.BMAuth?.user?.id ?? null}
          />
        </div>
      </div>
    </>
  );
}
