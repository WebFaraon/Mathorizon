import { Hero } from './components/Hero';
import { SummaryStrip } from './components/SummaryStrip';
import { ChaptersSection } from './components/ChaptersSection';
import { Sidebar } from './components/Sidebar/Sidebar';
import { useCapitoleData } from './hooks/useCapitoleData';

/**
 * Everything on capitole.html below the shared navbar.
 *
 * Deliberately NOT in here: the navbar itself, the Favorite/Istoric side
 * panels and the back-to-top button. Those are opened from the navbar, which
 * is common to all five tabs and still vanilla — they stay in the page's own
 * markup, driven by js/app.js, until the rest of the site is migrated too.
 *
 * Layout: hero → compact progress line → a two-column body (chapter grid +
 * a persistent sidebar with the "continue" recommendation, an attention
 * nudge, and the Simulare BAC promo). The old four-stat-box row and the
 * full-width Simulare banner are gone — see SummaryStrip and
 * components/Sidebar/ for what replaced them.
 */
export function App() {
  const { stats, chapters, continueTarget, nudge, ready } = useCapitoleData();

  return (
    <>
      <Hero />
      <SummaryStrip stats={stats} />
      <div className="cap-shell">
        <div className="cap-layout">
          <ChaptersSection chapters={chapters} ready={ready} />
          <Sidebar continueTarget={continueTarget} nudge={nudge} ready={ready} />
        </div>
      </div>
    </>
  );
}
