import { Hero } from './components/Hero';
import { StatsBar } from './components/StatsBar';
import { ChaptersSection } from './components/ChaptersSection';
import { BacSimBanner } from './components/BacSimBanner';
import { useCapitoleData } from './hooks/useCapitoleData';

/**
 * Everything on capitole.html below the shared navbar.
 *
 * Deliberately NOT in here: the navbar itself, the Favorite/Istoric side
 * panels and the back-to-top button. Those are opened from the navbar, which
 * is common to all five tabs and still vanilla — they stay in the page's own
 * markup, driven by js/app.js, until the rest of the site is migrated too.
 */
export function App() {
  const { stats, chapters, ready } = useCapitoleData();

  return (
    <>
      <Hero />
      <StatsBar stats={stats} />
      <ChaptersSection chapters={chapters} ready={ready} />
      <BacSimBanner />
    </>
  );
}
