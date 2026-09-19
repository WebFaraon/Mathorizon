import { motion, useReducedMotion } from 'framer-motion';
import { CircleCheck } from 'lucide-react';
import type { BMStats } from '../lib/bm-types';
import { EASE_OUT } from '../lib/motion';

interface SummaryStripProps {
  stats: BMStats | null;
}

/**
 * One headline figure — exercises solved — sitting in the same row as the
 * grade switch (see Hero.tsx). Same source as before (BM.Storage.getStats
 * — see hooks/useCapitoleData.ts), just given real visual weight — a
 * colored pill, an icon, a bold number — instead of reading as a
 * footnote line.
 *
 * The percent-complete figure that used to sit next to this one is gone:
 * it's directly derivable from this same number (solved/total), and
 * showing both doubled up on the same information for a second chip.
 *
 * No count-up: a number that tweens every time this remounts (or every
 * time a sync nudges it) reads as flicker on a value this small, not as
 * progress. It gets one fade-in on arrival, matching the hero's own
 * entrance, and nothing more.
 */
export function SummaryStrip({ stats }: SummaryStripProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!stats) {
    return <p className="cap-summary__loading">Îți încărcăm progresul…</p>;
  }

  return (
    <motion.div
      className="cap-summary__stat"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12, ease: EASE_OUT }}
    >
      <CircleCheck className="cap-summary__icon" aria-hidden="true" />
      <span className="cap-summary__text">
        <span className="cap-summary__value">{stats.solvedCount}</span>
        <span className="cap-summary__label">din {stats.total} rezolvate</span>
      </span>
    </motion.div>
  );
}
