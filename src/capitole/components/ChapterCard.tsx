import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import type { ChapterView } from '../hooks/useCapitoleData';
import type { BMCategoryProgress } from '../lib/bm-types';
import { useFittedTags } from '../hooks/useFittedTags';
import { categoryHref } from '../lib/navigate';
import { EASE_OUT } from '../lib/motion';

interface ChapterCardProps {
  chapter: ChapterView;
  /** Position in the grid — drives the staggered entrance. */
  index: number;
}

const STAGGER_S = 0.07;

type ChapterStatus = 'done' | 'progress' | 'new';

const STATUS_LABEL: Record<ChapterStatus, string> = {
  done: 'La zi',
  progress: 'În lucru',
  new: 'Neînceput'
};

/**
 * A dot, separate from the chapter's own identity color (top border/symbol/
 * tags), that reads at a glance whether THIS user is caught up here — green
 * finished, amber started, gray untouched. Purely derived from the real
 * solved/total ratio, same numbers the progress bar below already shows.
 */
function chapterStatus(progress: BMCategoryProgress): ChapterStatus {
  if (progress.percent >= 100) return 'done';
  if (progress.percent > 0) return 'progress';
  return 'new';
}

export function ChapterCard({ chapter, index }: ChapterCardProps) {
  const { category, progress, locked } = chapter;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const prefersReducedMotion = useReducedMotion();

  const names = category.subcategories.map((sub) => sub.name);
  const [tagsRef, shownTags] = useFittedTags(names.length);
  const hiddenTags = names.length - shownTags;
  const status = chapterStatus(progress);

  // Per-chapter accent color, straight from js/data.js — every card keeps
  // its own identity color (top band, symbol tile, tags, progress fill).
  const cardStyle = { '--cap-card-color': category.color } as React.CSSProperties;

  const body = (
    <>
      <div className="cap-card__top">
        {/* Markup, not text: a chapter symbol can carry .sym-nb markup for
            stacked indices (combinatorics' Cᵏₙ) — see lib/bm-types.ts. */}
        <span
          className="cap-card__symbol"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: category.symbol }}
        />
        <span className="cap-card__top-right">
          {!locked && (
            <span
              className={`cap-card__status cap-card__status--${status}`}
              title={STATUS_LABEL[status]}
            >
              <span className="sr-only">{STATUS_LABEL[status]}</span>
            </span>
          )}
          <span className="cap-card__count">
            {locked ? 'În curând' : `${progress.total} exerciții`}
          </span>
        </span>
      </div>

      <h3 className="cap-card__name">{category.name}</h3>
      <p className="cap-card__desc">{category.tagline || category.description}</p>

      <div className="cap-card__tags" ref={tagsRef}>
        {names.slice(0, shownTags).map((name) => (
          <span className="cap-card__tag" key={name}>{name}</span>
        ))}
        {hiddenTags > 0 && <span className="cap-card__tag">+{hiddenTags} tipuri</span>}
      </div>

      <div className="cap-card__footer">
        <div
          className="cap-card__track"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progres ${category.name}`}
        >
          {/* Fills from 0 to the real value once the card is in view — the one
              piece of motion on the card that carries information. */}
          <motion.div
            className="cap-card__bar"
            initial={{ width: 0 }}
            animate={{ width: inView ? `${progress.percent}%` : 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.85, delay: 0.1 + index * STAGGER_S, ease: EASE_OUT }
            }
          />
        </div>
        <div className="cap-card__progress-label">
          <span>{progress.solved} / {progress.total} rezolvate</span>
          <span className="cap-card__percent">{progress.percent}%</span>
        </div>
      </div>
    </>
  );

  /* The outer motion.div owns only the staggered entrance (fade + slide up
     on mount, per-index delay). Hover/press are plain CSS on .cap-card now
     (a dim on hover, a chunky press-down on click — see styles.css) rather
     than a Framer whileHover/whileTap: an earlier version animated the
     hover lift here with Framer while a sibling used CSS for its own
     press shadow, and the two fell out of sync (see the .cap-btn comment
     in styles.css for the same lesson learned on the buttons). Plain CSS
     keeps both properties on one transition, so they move together. */
  return (
    <motion.div
      ref={ref}
      className="cap-card-slot"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
      animate={{ opacity: locked ? 0.72 : 1, y: 0 }}
      transition={{ duration: 0.42, delay: index * STAGGER_S, ease: EASE_OUT }}
    >
      {locked ? (
        // Locked chapter ("În curând"): not a link, no dim, no press, no
        // pointer — same treatment as the old .chapter-card--soon.
        <div className="cap-card cap-card--soon" style={cardStyle} aria-disabled="true">
          <div className="cap-card__link">{body}</div>
        </div>
      ) : (
        <div className="cap-card" style={cardStyle}>
          {/* A real anchor, where the old card was a <div onclick>: keyboard
              focus, middle-click and "open in new tab" now work, and
              js/page-transition.js gives it the same fade every other link
              on the site gets. Destination identical to BM.gotoCategory(). */}
          <a className="cap-card__link" href={categoryHref(category.id)}>
            {body}
          </a>
        </div>
      )}
    </motion.div>
  );
}
