import { ChapterCard } from './ChapterCard';
import type { ChapterView } from '../hooks/useCapitoleData';

interface ChaptersSectionProps {
  chapters: ChapterView[];
  ready: boolean;
}

/** How many skeletons to show while the Supabase merge settles. */
const SKELETON_COUNT = 4;

/**
 * No visible "Capitole" heading/subtitle any more — the header block right
 * above (title, grade switch, progress chips — see Hero.tsx) already
 * establishes what this grid is, and the heading was mostly adding a gap
 * between that block and the cards. aria-label keeps the section
 * announced for screen readers even without visible heading text.
 */
export function ChaptersSection({ chapters, ready }: ChaptersSectionProps) {
  return (
    <section className="cap-chapters" aria-label="Capitole">
      <div className="cap-grid">
        {ready
          ? chapters.map((chapter, index) => (
              <ChapterCard key={chapter.category.id} chapter={chapter} index={index} />
            ))
          : Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <div className="cap-card-skeleton" key={i} aria-hidden="true" />
            ))}
      </div>
    </section>
  );
}
