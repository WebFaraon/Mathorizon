import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { EASE_OUT } from '../../lib/motion';

/* Same destination as before — bac.html's simulator reads both params. */
const BAC_HREF = 'bac.html?new=1&type=bac';

/* Fixed facts about the exam format, not user data — the same three
   literals the old banner carried. */
const FACTS = ['12 exerciții', '3 ore', 'Notă automată'];

/**
 * Simulare BAC, in the sidebar. Tried as a full-color blue-gradient card
 * first; reverted to the same plain white/bordered look as the cards above
 * it per direct feedback — it's still a link to a different destination,
 * not a progress fact, but that didn't need a different color language.
 *
 * The button gets the "pressed" treatment on tap (darker edge beneath in
 * CSS, a small downward nudge) — same lockstep mechanic as every other CTA
 * on the page, see .cap-btn in styles.css.
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
      <span className="cap-btn cap-btn--primary cap-btn--block">
        Începe simularea
        <ArrowRight aria-hidden="true" />
      </span>
    </motion.a>
  );
}
