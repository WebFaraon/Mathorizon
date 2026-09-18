import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import type { ChapterView } from '../hooks/useCapitoleData';
import { useFittedTags } from '../hooks/useFittedTags';
import { categoryHref } from '../lib/navigate';
import { EASE_OUT } from '../lib/motion';

interface ChapterCardProps {
  chapter: ChapterView;
  /** Position in the grid — drives the staggered entrance. */
  index: number;
}

const STAGGER_S = 0.07;

export function ChapterCard({ chapter, index }: ChapterCardProps) {
  const { category, progress, locked } = chapter;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const prefersReducedMotion = useReducedMotion();

  const names = category.subcategories.map((sub) => sub.name);
  const [tagsRef, shownTags] = useFittedTags(names.length);
  const hiddenTags = names.length - shownTags;

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
        <span className="cap-card__count">
          {locked ? 'În curând' : `${progress.total} exerciții`}
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

  /* Two layers on purpose. The outer one owns the staggered entrance (its
     transition carries a per-index delay); the inner one owns the hover
     lift. Sharing one element would apply the entrance delay to the hover
     too, so a card late in the grid would lift — and drop again — a fifth
     of a second after the cursor. The deeper hover shadow is CSS, which
     keeps it theme-aware in dark mode. */
  return (
    <motion.div
      ref={ref}
      className="cap-card-slot"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
      animate={{ opacity: locked ? 0.72 : 1, y: 0 }}
      transition={{ duration: 0.42, delay: index * STAGGER_S, ease: EASE_OUT }}
    >
      {locked ? (
        // Locked chapter ("În curând"): not a link, no hover lift, no
        // pointer, dimmed — same treatment as the old .chapter-card--soon.
        <div className="cap-card cap-card--soon" style={cardStyle} aria-disabled="true">
          <div className="cap-card__link">{body}</div>
        </div>
      ) : (
        <motion.div
          className="cap-card"
          style={cardStyle}
          whileHover={prefersReducedMotion ? undefined : { y: -6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* A real anchor, where the old card was a <div onclick>: keyboard
              focus, middle-click and "open in new tab" now work, and
              js/page-transition.js gives it the same fade every other link
              on the site gets. Destination identical to BM.gotoCategory(). */}
          <a className="cap-card__link" href={categoryHref(category.id)}>
            {body}
          </a>
        </motion.div>
      )}
    </motion.div>
  );
}
