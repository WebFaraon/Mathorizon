import { motion, useReducedMotion } from 'framer-motion';
import type { BMStats } from '../lib/bm-types';
import { EASE_OUT } from '../lib/motion';

interface SummaryStripProps {
  stats: BMStats | null;
}

/**
 * Replaces the old four stat boxes with one line of text under the hero:
 * "X din Y exerciții rezolvate · Z% completat". Real numbers, same source
 * as before (BM.Storage.getStats — see hooks/useCapitoleData.ts), just
 * rendered as a sentence instead of cards with icons.
 *
 * No count-up here: a single line of running text tweening its digits reads
 * as flicker, not progress — that animation earned its place on four large
 * standalone numbers, not on two numbers inside a sentence. It gets one
 * fade-in on arrival, matching the hero title/subtitle stagger, and nothing
 * more.
 */
export function SummaryStrip({ stats }: SummaryStripProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="cap-shell">
      <div className="cap-summary">
        <motion.p
          className="cap-summary__line"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: EASE_OUT }}
        >
          {stats ? (
            <>
              <strong>{stats.solvedCount}</strong> din {stats.total} exerciții rezolvate
              <span className="cap-summary__dot" aria-hidden="true">·</span>
              <strong>{stats.percent}%</strong> completat
            </>
          ) : (
            'Îți încărcăm progresul…'
          )}
        </motion.p>
      </div>
    </div>
  );
}
