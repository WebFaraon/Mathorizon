import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, PartyPopper } from 'lucide-react';
import type { ContinueTarget } from '../../lib/recommendations';
import { categoryHref } from '../../lib/navigate';
import { EASE_OUT } from '../../lib/motion';

interface ContinueCardProps {
  target: ContinueTarget | null;
  ready: boolean;
}

/**
 * "Continuă de unde ai rămas" — the sidebar's main call to action.
 *
 * The target chapter (and, where one exists, the specific next exercise)
 * come from lib/recommendations.ts, computed from the same progress numbers
 * the chapter grid renders — never a second, separate guess. See that file
 * for the exact preference order.
 */
export function ContinueCard({ target, ready }: ContinueCardProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!ready) {
    return <div className="cap-side-card cap-side-card--skeleton" aria-hidden="true" />;
  }

  const entrance = {
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, ease: EASE_OUT }
  };

  // Nothing left to continue — every unlocked chapter is at 100%.
  if (!target || target.allDone) {
    return (
      <motion.div className="cap-side-card cap-side-card--continue" {...entrance}>
        <span className="cap-side-card__eyebrow">Continuă de unde ai rămas</span>
        <div className="cap-continue__done">
          <PartyPopper className="cap-continue__done-icon" aria-hidden="true" />
          <h3 className="cap-continue__title">Toate capitolele sunt complete</h3>
        </div>
        <p className="cap-continue__desc">
          Ai rezolvat tot ce e disponibil acum. Testează-ți nivelul într-o simulare cronometrată.
        </p>
        {/* Press feedback is plain CSS now (:active), not Framer's
            whileTap — see .cap-btn in styles.css for why: mixing a
            Framer-driven transform with a CSS-eased box-shadow put the two
            out of sync. A plain <a> here still gets the whole effect. */}
        <a className="cap-btn cap-btn--primary cap-btn--block" href="bac.html?new=1&type=bac">
          Simulare BAC
          <ArrowRight aria-hidden="true" />
        </a>
      </motion.div>
    );
  }

  const { chapter, nextExercise } = target;
  if (!chapter) return null;

  const started = chapter.progress.solved > 0;
  const remaining = chapter.progress.total - chapter.progress.solved;
  const href = nextExercise
    ? categoryHref(chapter.category.id, nextExercise.subcategoryId, nextExercise.id)
    : categoryHref(chapter.category.id);

  return (
    <motion.div
      className="cap-side-card cap-side-card--continue"
      style={{ '--cap-card-color': chapter.category.color } as React.CSSProperties}
      {...entrance}
    >
      <span className="cap-side-card__eyebrow">Continuă de unde ai rămas</span>
      <h3 className="cap-continue__title">{chapter.category.name}</h3>
      {/* One paragraph, not a separate boxed callout for the next exercise —
          that second block (its own padding + background + gap) was most of
          what made this card taller than it needed to be. The title still
          stands out via <strong>. */}
      <p className="cap-continue__desc">
        {started
          ? `${chapter.progress.solved} din ${chapter.progress.total} exerciții rezolvate — mai ai ${remaining}.`
          : `${chapter.progress.total} exerciții te așteaptă.`}
        {nextExercise && (
          <>
            {' '}Următorul: <strong>{nextExercise.title}</strong>
          </>
        )}
      </p>
      <a className="cap-btn cap-btn--primary cap-btn--block" href={href}>
        {started ? 'Continuă capitolul' : 'Începe capitolul'}
        <ArrowRight aria-hidden="true" />
      </a>
    </motion.div>
  );
}
