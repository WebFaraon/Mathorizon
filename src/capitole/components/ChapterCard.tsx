import { useRef } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { CircleCheck, Flag } from 'lucide-react';
import type { ChapterView } from '../hooks/useCapitoleData';
import { useFittedTags } from '../hooks/useFittedTags';
import { categoryHref } from '../lib/navigate';

interface ChapterCardProps {
  chapter: ChapterView;
  /** Position on the keypad — only used for the entrance order. */
  index: number;
  onReadout: (chapter: ChapterView | null) => void;
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

/** Whole matrix lights up within this window on first view, left to right. */
const SWEEP_MS = 650;

/**
 * Dot pitch from the exercise count, so every key's matrix fills roughly
 * the same field: a 616-exercise bank packs into small dots, a 20-exercise
 * one gets big ones instead of a single thin row in an empty key. Still
 * exactly one dot per exercise.
 */
const MATRIX_AREA = 300 * 96;
function dotPitch(n: number): number {
  return Math.max(7, Math.min(34, Math.floor(Math.sqrt(MATRIX_AREA / Math.max(n, 1)))));
}

function DotMatrix({ cells, animate }: { cells: boolean[]; animate: boolean }) {
  const n = cells.length;
  const pitch = dotPitch(n);
  const gap = Math.max(2, Math.round(pitch * 0.22));
  const matrixStyle = { '--dot': `${pitch - gap}px`, '--dot-gap': `${gap}px` } as React.CSSProperties;
  return (
    <span className={`cap-matrix${animate ? ' cap-matrix--sweep' : ''}`} style={matrixStyle} aria-hidden="true">
      {cells.map((on, i) =>
        on ? (
          <i
            key={i}
            className="cap-matrix__dot cap-matrix__dot--on"
            style={{ '--d': `${Math.round((i / n) * SWEEP_MS)}ms` } as React.CSSProperties}
          />
        ) : (
          <i key={i} className="cap-matrix__dot" />
        )
      )}
    </span>
  );
}

/**
 * One chapter as one key on the keypad: symbol and name printed on the
 * face, the subcategories as its colored legend, and a dot matrix with
 * one dot per exercise in the chapter (solved dots lit). Hovering or
 * focusing the key reads its numbers out on the hero's LCD; pressing it
 * sinks the key (plain CSS :active, same mechanic as every other button
 * on the site) and follows the link.
 */
export function ChapterCard({ chapter, index, onReadout }: ChapterCardProps) {
  const { category, progress, locked, cells, lastWorked } = chapter;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const prefersReducedMotion = useReducedMotion();

  const names = category.subcategories.map((sub) => sub.name);
  const [tagsRef, fitted] = useFittedTags(names.length);
  // A counter that hides exactly one name costs the same room as the name.
  const shownTags = names.length - fitted === 1 ? names.length : fitted;
  const hiddenTags = names.length - shownTags;
  const done = !locked && progress.percent >= 100;

  const keyStyle = {
    '--legend': LEGEND[category.id] ?? 'var(--k-ink-soft)',
    '--enter-delay': `${index * 60}ms`
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
        {hiddenTags > 0 && <span className="cap-key__legend-item">+{hiddenTags} {hiddenTags === 1 ? 'tip' : 'tipuri'}</span>}
      </div>

      {locked ? (
        <span className="cap-key__soon">În curând</span>
      ) : (
        <DotMatrix cells={cells} animate={!prefersReducedMotion} />
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
      onMouseEnter={() => onReadout(chapter)}
    >
      {locked ? (
        // Locked chapter ("În curând"): not a link, printed flat with no
        // key edge, so nothing about it suggests it can be pressed.
        <div className="cap-key__face" aria-disabled="true">{body}</div>
      ) : (
        <a
          className="cap-key__face"
          href={categoryHref(category.id)}
          onFocus={() => onReadout(chapter)}
          onBlur={() => onReadout(null)}
        >
          {body}
        </a>
      )}
    </div>
  );
}
