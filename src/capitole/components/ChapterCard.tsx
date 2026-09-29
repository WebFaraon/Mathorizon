import { useRef } from 'react';
import { useInView } from 'framer-motion';
import { CircleCheck, Flag } from 'lucide-react';
import type { ChapterView, Readout, SubProgress } from '../hooks/useCapitoleData';
import { useFittedTags } from '../hooks/useFittedTags';
import { categoryHref } from '../lib/navigate';

interface ChapterCardProps {
  chapter: ChapterView;
  /** Position on the keypad — drives the power-on landing order. */
  index: number;
  onReadout: (readout: Readout | null) => void;
}

/**
 * Legend color per chapter, like the colored function labels printed on a
 * calculator. Deliberately NOT category.color from js/data.js: the page
 * runs on four legend colors with fixed jobs (blue, green, red, plus
 * orange reserved for XP), and the data file's colors predate that.
 */
const LEGEND: Record<string, string> = {
  algebra: 'var(--k-blue)',
  geometrie: 'var(--k-green)',
  analiza: 'var(--k-red)'
};

/** Each key lands this long after the previous one on first view. */
const LAND_STAGGER_MS = 70;

/**
 * The chapter's bank as one strip, one segment per subcategory ("tip"):
 * a segment's width is its share of the chapter's exercises, its fill is
 * how much of it this user has solved. Pointing at a segment reads that
 * subcategory out on the hero's LCD. Segments are spans inside the key's
 * link, so a tap anywhere still opens the chapter.
 */
function BankStrip({
  chapter,
  onReadout
}: {
  chapter: ChapterView;
  onReadout: (readout: Readout | null) => void;
}) {
  const total = chapter.subs.reduce((sum, sub) => sum + sub.total, 0) || 1;

  const show = (sub: SubProgress | null) => onReadout({ chapter, sub });

  return (
    <span className="cap-strip" onMouseLeave={() => show(null)}>
      {chapter.subs.map((sub, i) => (
        <span
          key={sub.id}
          className="cap-strip__seg"
          style={{
            flexGrow: sub.total / total,
            '--fill': sub.total ? sub.solved / sub.total : 0,
            '--seg-i': i
          } as React.CSSProperties}
          onMouseEnter={() => show(sub)}
        >
          <span className="cap-strip__fill" />
        </span>
      ))}
    </span>
  );
}

/**
 * One chapter as one key on the keypad: symbol and name printed on the
 * face, the subcategories as its colored legend, and the bank strip
 * showing solved progress per subcategory. Hovering or focusing the key
 * reads its numbers out on the hero's LCD; pressing it sinks the key
 * (plain CSS :active, same mechanic as every other button on the site)
 * and follows the link.
 */
export function ChapterCard({ chapter, index, onReadout }: ChapterCardProps) {
  const { category, progress, locked, lastWorked } = chapter;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  const names = category.subcategories.map((sub) => sub.name);
  const [tagsRef, fitted] = useFittedTags(names.length);
  // A counter that hides exactly one name costs the same room as the name.
  const shownTags = names.length - fitted === 1 ? names.length : fitted;
  const hiddenTags = names.length - shownTags;
  const done = !locked && progress.percent >= 100;

  const keyStyle = {
    '--legend': LEGEND[category.id] ?? 'var(--k-ink-soft)',
    '--land-delay': `${index * LAND_STAGGER_MS}ms`
  } as React.CSSProperties;

  const body = (
    <>
      <div className="cap-key__main">
        {/* Markup, not text: a chapter symbol can carry .sym-nb markup for
            stacked indices (combinatorics' Cᵏₙ) — see lib/bm-types.ts. */}
        <span
          className="cap-key__symbol"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: category.symbol }}
        />
        <div className="cap-key__text">
          <h3 className="cap-key__name">{category.name}</h3>
          <p className="cap-key__desc">{category.tagline || category.description}</p>
        </div>
      </div>

      <div className="cap-key__legend" ref={tagsRef}>
        {names.slice(0, shownTags).map((name) => (
          <span className="cap-key__legend-item" key={name}>{name}</span>
        ))}
        {hiddenTags > 0 && (
          <span className="cap-key__legend-item">+{hiddenTags} {hiddenTags === 1 ? 'tip' : 'tipuri'}</span>
        )}
      </div>

      {locked ? (
        <span className="cap-key__soon">În curând</span>
      ) : (
        <BankStrip chapter={chapter} onReadout={onReadout} />
      )}

      <div className="cap-key__foot">
        <span className="cap-key__count">
          {locked ? (
            'Fără exerciții publicate'
          ) : (
            <>
              <b>{progress.solved}</b>/{progress.total} rezolvate
            </>
          )}
        </span>
        <span className="cap-key__marks">
          {lastWorked && !locked && (
            <span className="cap-key__mark cap-key__mark--last" title="Ultima dată aici">
              <Flag aria-hidden="true" /> <span className="cap-key__mark-text">Ultima dată aici</span>
            </span>
          )}
          {done && (
            <span className="cap-key__mark cap-key__mark--done">
              <CircleCheck aria-hidden="true" /> La zi
            </span>
          )}
          {!locked && <span className="cap-key__percent">{progress.percent}%</span>}
        </span>
      </div>
    </>
  );

  return (
    <div
      ref={ref}
      className={`cap-key${locked ? ' cap-key--soon' : ''}${inView ? ' cap-key--in' : ''}`}
      style={keyStyle}
      onMouseEnter={() => onReadout({ chapter, sub: null })}
    >
      {locked ? (
        // Locked chapter ("În curând"): not a link, printed flat with no
        // key edge, so nothing about it suggests it can be pressed.
        <div className="cap-key__face" aria-disabled="true">{body}</div>
      ) : (
        <a
          className="cap-key__face"
          href={categoryHref(category.id)}
          onFocus={() => onReadout({ chapter, sub: null })}
          onBlur={() => onReadout(null)}
        >
          {body}
        </a>
      )}
    </div>
  );
}
