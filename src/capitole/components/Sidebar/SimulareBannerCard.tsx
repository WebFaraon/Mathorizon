import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { EASE_OUT } from '../../lib/motion';

/* Same destination as before — bac.html's simulator reads both params. */
const BAC_HREF = 'bac.html?new=1&type=bac';

/* Fixed facts about the exam format, not user data — the same three
   literals the old banner carried. */
const FACTS = ['12 exerciții', '3 ore', 'Notă automată'];

/**
 * Simulare BAC, in the sidebar. Plain white/bordered card, same as
 * ContinueCard/NudgeCard above it. Unlike them, the card itself is NOT a
 * link — only the button inside is — per direct feedback that the whole
 * container being clickable (with its own hover effect) was confusing
 * when just the button should lead to the simulation.
 */
export function SimulareBannerCard() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="cap-side-card"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: 0.12, ease: EASE_OUT }}
    >
      <span className="cap-sim__icon">
        <ClipboardList aria-hidden="true" />
      </span>
      <span className="cap-sim__name">Simulare BAC</span>
      {/* Trimmed to just the one detail the facts pills below don't already
          say — "3 ore" and "Notă automată" would otherwise appear twice. */}
      <span className="cap-sim__desc">Structură oficială BAC Moldova 2022+</span>

      <span className="cap-sim__facts">
        {FACTS.map((fact) => (
          <span className="cap-sim__fact" key={fact}>{fact}</span>
        ))}
      </span>

      {/* The one clickable element in this card — press feedback is plain
          CSS (:active), see .cap-btn in styles.css for why a Framer
          whileTap here fought with it. */}
      <a className="cap-btn cap-btn--primary cap-btn--block" href={BAC_HREF}>
        Începe simularea
        <ArrowRight aria-hidden="true" />
      </a>
    </motion.div>
  );
}
