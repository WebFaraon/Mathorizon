import { ChapterCard } from './ChapterCard';
import type { ChapterView } from '../hooks/useCapitoleData';

interface ChaptersSectionProps {
  chapters: ChapterView[];
  ready: boolean;
}

/** How many skeletons to show while the Supabase merge settles. */
const SKELETON_COUNT = 4;

/** The LCD that used to read these keys out is gone from the hub: nothing to report to. */
const NO_READOUT = () => {};

/** "Exersează pe capitole": one key per chapter, progress printed on each. */
export function ChaptersSection({ chapters, ready }: ChaptersSectionProps) {
  /* Clasa a 9-a: examenul nu are capitole, are 12 iteme cu puncte */
  const items = chapters.length > 0 && chapters.every((c) => c.category.flat);
  const points = items ? chapters.reduce((sum, c) => sum + (c.category.points ?? 0), 0) : 0;
  return (
    <section className="cap-chapters" aria-labelledby="capChapTitle">
      <h2 className="cap-sec-title" id="capChapTitle">{items ? 'Exersează pe iteme' : 'Exersează pe capitole'}</h2>
      {items && <p className="cap-sec-note">Examenul are {chapters.length} iteme, {points} de puncte în total. Alege itemul pe care vrei să îl exersezi.</p>}
      <div className="cap-grid">
        {ready
          ? chapters.map((chapter, index) => (
              <ChapterCard key={chapter.category.id} chapter={chapter} index={index} onReadout={NO_READOUT} />
            ))
          : Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <div className="cap-card-skeleton" key={i} aria-hidden="true" />
            ))}
      </div>
    </section>
  );
}
