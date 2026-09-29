import { ChapterCard } from './ChapterCard';
import type { ChapterView, Readout } from '../hooks/useCapitoleData';

interface ChaptersSectionProps {
  chapters: ChapterView[];
  ready: boolean;
  /** Reports the key under the pointer/focus to the hero's LCD (null on leave). */
  onReadout: (readout: Readout | null) => void;
}

/** How many skeletons to show while the Supabase merge settles. */
const SKELETON_COUNT = 4;

/**
 * The keypad: one key per chapter. No visible heading, the LCD right
 * above already says what these are; aria-label keeps the section
 * announced for screen readers.
 */
export function ChaptersSection({ chapters, ready, onReadout }: ChaptersSectionProps) {
  return (
    <section className="cap-chapters" aria-label="Capitole">
      <div className="cap-grid" onMouseLeave={() => onReadout(null)}>
        {ready
          ? chapters.map((chapter, index) => (
              <ChapterCard key={chapter.category.id} chapter={chapter} index={index} onReadout={onReadout} />
            ))
          : Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <div className="cap-card-skeleton" key={i} aria-hidden="true" />
            ))}
      </div>
    </section>
  );
}
