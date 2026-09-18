import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { EASE_OUT } from '../lib/motion';

/* Same destination as before — bac.html's simulator reads both params. */
const BAC_HREF = 'bac.html?new=1&type=bac';

/* Fixed facts about the exam format, not user data — the same three
   literals the old markup carried. */
const FACTS = ['12 exerciții', '3 ore', 'Notă automată'];

export function BacSimBanner() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="cap-bac" aria-label="Simulare BAC">
      <div className="cap-shell">
        <motion.a
          className="cap-bac__card"
          href={BAC_HREF}
          initial={prefersReducedMotion ? false : 'hidden'}
          whileInView="shown"
          whileHover="hover"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: { opacity: 0, y: 16 },
            shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } }
          }}
        >
          <span className="cap-bac__icon">
            <ClipboardList aria-hidden="true" />
          </span>

          <span className="cap-bac__info">
            <span className="cap-bac__name">Simulare BAC</span>
            <span className="cap-bac__desc">
              Structură oficială BAC Moldova 2022+ · Timer 3h · Notă automată
            </span>
          </span>

          <span className="cap-bac__facts">
            {FACTS.map((fact) => (
              <span className="cap-bac__fact" key={fact}>{fact}</span>
            ))}
          </span>

          {/* Only the button scales, though the whole banner is the hover
              target (the "hover" label propagates from the anchor above) —
              it points at the thing the click will do, which is what the old
              CSS rule `.bac-sim-card:hover .bac-sim-card__action` did too. */}
          <motion.span
            className="cap-bac__action"
            variants={prefersReducedMotion ? undefined : { hover: { scale: 1.04 } }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            Simulare BAC
            <ArrowRight className="cap-bac__action-icon" aria-hidden="true" />
          </motion.span>
        </motion.a>
      </div>
    </section>
  );
}
