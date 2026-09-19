import { motion, useReducedMotion } from 'framer-motion';
import { CircleCheck, Percent } from 'lucide-react';
import type { BMStats } from '../lib/bm-types';
import { EASE_OUT } from '../lib/motion';

interface SummaryStripProps {
  stats: BMStats | null;
}

/**
 * Two headline figures under the hero: exercises solved, and percent
 * complete. Same source as before (BM.Storage.getStats — see
 * hooks/useCapitoleData.ts), just given real visual weight — a colored
 * pill, an icon, a bold number — instead of reading as a footnote line.
 *
 * No count-up: a number that tweens every time this remounts (or every
 * time a sync nudges it) reads as flicker on a value this small and
 * central, not as progress. That animation earned its place on the old
 * four-box layout's bigger, more isolated figures; two compact chips next
 * to each other is a different context. It gets one fade-in on arrival,
 * matching the hero's own entrance, and nothing more.
 */
export function SummaryStrip({ stats }: SummaryStripProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!stats) {
    return (
      <div className="cap-summary">
        <p className="cap-summary__loading">Îți încărcăm progresul…</p>
      </div>
    );
  }

  const entrance = {
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 }
  };

  return (
    <div className="cap-summary">
      <motion.div
        className="cap-summary__stat"
        {...entrance}
        transition={{ duration: 0.4, delay: 0.12, ease: EASE_OUT }}
      >
        <CircleCheck className="cap-summary__icon" aria-hidden="true" />
        <span className="cap-summary__text">
          <span className="cap-summary__value">{stats.solvedCount}</span>
          <span className="cap-summary__label">din {stats.total} rezolvate</span>
        </span>
      </motion.div>

      <motion.div
        className="cap-summary__stat"
        {...entrance}
        transition={{ duration: 0.4, delay: 0.2, ease: EASE_OUT }}
      >
        <Percent className="cap-summary__icon" aria-hidden="true" />
        <span className="cap-summary__text">
          <span className="cap-summary__value">{stats.percent}%</span>
          <span className="cap-summary__label">completat</span>
        </span>
      </motion.div>
    </div>
  );
}
