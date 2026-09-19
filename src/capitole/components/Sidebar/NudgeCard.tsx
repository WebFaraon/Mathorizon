import { motion, useReducedMotion } from 'framer-motion';
import { Heart, Target } from 'lucide-react';
import type { SidebarNudge } from '../../lib/recommendations';
import { categoryHref } from '../../lib/navigate';
import { EASE_OUT } from '../../lib/motion';

interface NudgeCardProps {
  nudge: SidebarNudge;
  ready: boolean;
}

/**
 * The small "worth a look" card. What it shows is picked in
 * lib/recommendations.ts from real data (unsolved favorites, or the
 * unlocked chapter with the lowest progress) — this component only renders
 * whichever one was picked. Renders nothing at all when there's no real
 * signal (see pickNudge), rather than forcing an empty or made-up one.
 */
export function NudgeCard({ nudge, ready }: NudgeCardProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!ready) {
    return <div className="cap-side-card cap-side-card--skeleton cap-side-card--skeleton-sm" aria-hidden="true" />;
  }
  if (!nudge) return null;

  const entrance = {
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, delay: 0.06, ease: EASE_OUT }
  };

  if (nudge.kind === 'favorites') {
    return (
      <motion.div
        className="cap-side-card cap-side-card--nudge"
        style={{ '--cap-card-color': '#ec4899' } as React.CSSProperties}
        {...entrance}
      >
        <span className="cap-nudge__icon cap-nudge__icon--favorites">
          <Heart aria-hidden="true" />
        </span>
        <p className="cap-nudge__text">
          <strong>{nudge.count}</strong>{' '}
          {nudge.count === 1 ? 'exercițiu favorit nerezolvat' : 'exerciții favorite nerezolvate'}
        </p>
        {/* A real button, not a text link — same pressed-button family as
            everywhere else on the page, just smaller (cap-btn--sm), since
            this is a secondary action inside an already-compact card.
            Reuses the real favorites panel (js/app.js) instead of
            re-rendering the list here — same data, one implementation. */}
        <button
          type="button"
          className="cap-btn cap-btn--secondary cap-btn--sm"
          onClick={() => document.getElementById('favBtn')?.click()}
        >
          Vezi favoritele
        </button>
      </motion.div>
    );
  }

  const { chapter } = nudge;
  return (
    <motion.div
      className="cap-side-card cap-side-card--nudge"
      style={{ '--cap-card-color': chapter.category.color } as React.CSSProperties}
      {...entrance}
    >
      <span className="cap-nudge__icon">
        <Target aria-hidden="true" />
      </span>
      <p className="cap-nudge__text">
        <strong>{chapter.category.name}</strong> are cel mai mic progres — {chapter.progress.percent}%
      </p>
      <a className="cap-btn cap-btn--secondary cap-btn--sm" href={categoryHref(chapter.category.id)}>
        Deschide capitolul
      </a>
    </motion.div>
  );
}
