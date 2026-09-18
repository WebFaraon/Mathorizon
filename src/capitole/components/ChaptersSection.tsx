import { ChapterCard } from './ChapterCard';
import type { ChapterView } from '../hooks/useCapitoleData';

interface ChaptersSectionProps {
  chapters: ChapterView[];
  ready: boolean;
}

/** How many skeletons to show while the Supabase merge settles. */
const SKELETON_COUNT = 4;

export function ChaptersSection({ chapters, ready }: ChaptersSectionProps) {
  return (
    <section className="cap-chapters" aria-labelledby="cap-chapters-title">
      <div className="cap-shell">
        <header className="cap-section-head">
          <h2 className="cap-section-title" id="cap-chapters-title">Capitole</h2>
          <p className="cap-section-sub">
            Alege un capitol și continuă de unde ai rămas.
          </p>
        </header>

        <div className="cap-grid">
          {ready
            ? chapters.map((chapter, index) => (
                <ChapterCard key={chapter.category.id} chapter={chapter} index={index} />
              ))
            : Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <div className="cap-card-skeleton" key={i} aria-hidden="true" />
              ))}
        </div>
      </div>
    </section>
  );
}
