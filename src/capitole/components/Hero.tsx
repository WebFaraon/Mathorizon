import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { GradeSwitch } from './GradeSwitch';

/* Same four phrases the old inline rotator in capitole.html cycled. */
const PHRASES = [
  'Exersează inteligent. Progresează rapid. Ia BAC-ul cu 10.',
  'Sute de exerciții organizate pe capitole și dificultate.',
  'Simulări reale BAC cu timer, notă automată și progres salvat.',
  'Antrenament rapid personalizat — orice capitol, orice nivel.'
];

const ROTATE_MS = 5500;

/**
 * Page header: title + rotating subtitle on a quiet indigo→blue wash.
 *
 * The old hero stacked four decorative layers behind this text (glow orbs,
 * a coordinate-system SVG, eight floating math glyphs, and a grid overlay),
 * all of them animating on loops. They're gone: the background is now a
 * single flat gradient, so the title is the only thing competing for
 * attention. The one remaining motion is the subtitle swap, which carries
 * actual content.
 */
export function Hero() {
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // No auto-rotation under reduced motion: a phrase that replaces itself
    // is movement the reader didn't ask for. The first phrase still shows.
    if (prefersReducedMotion) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % PHRASES.length),
      ROTATE_MS
    );
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  return (
    <section className="cap-hero">
      <div className="cap-hero__inner">
        <motion.h1
          className="cap-hero__title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          Centrul tău de antrenament pentru{' '}
          <span className="cap-hero__title-accent">BAC &amp; Evaluare Națională</span>
        </motion.h1>

        {/* Fixed height so the swap below never nudges the stats section. */}
        <p className="cap-hero__sub">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {PHRASES[index]}
            </motion.span>
          </AnimatePresence>
        </p>

        {/* Placed here — right under the title, before anything else on
            the page — because it sets the context everything below (the
            chapter grid, missions, leaderboard) is scoped to, not because
            it belongs visually with the "which chapter" content further
            down. */}
        <GradeSwitch />
      </div>
    </section>
  );
}
