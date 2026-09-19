import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { EASE_OUT } from '../../lib/motion';

/* Same destination as before — bac.html's simulator reads both params. */
const BAC_HREF = 'bac.html?new=1&type=bac';

/* Fixed facts about the exam format, not user data — the same three
   literals the old banner carried. */
const FACTS = ['12 exerciții', '3 ore', 'Notă automată'];

/**
 * Simulare BAC, moved into the sidebar as a full-color card instead of the
 * white bordered banner it used to be — it's promotional, not a progress
 * fact like the two cards above it, so it's allowed to look different.
 *
 * The whole card lifts on hover (same language as every other card on the
 * page); the button additionally gets the "pressed" treatment on tap
 * (darker edge beneath in CSS, a small downward nudge here) — one hover
 * cue and one press cue, not both stacked on the button alone.
 */
export function SimulareBannerCard() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.a
      className="cap-side-card cap-side-card--sim"
      href={BAC_HREF}
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

      {/* Press feedback is plain CSS (:active) — see .cap-btn in
          styles.css for why a Framer whileTap here fought with it. */}
      <span className="cap-btn cap-btn--on-color cap-btn--block">
        Începe simularea
        <ArrowRight aria-hidden="true" />
      </span>
    </motion.a>
  );
}
