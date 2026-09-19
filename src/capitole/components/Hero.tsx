import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { GradeSwitch } from './GradeSwitch';
import { SummaryStrip } from './SummaryStrip';
import type { BMStats } from '../lib/bm-types';

interface HeroProps {
  stats: BMStats | null;
}

/* Same four phrases the old inline rotator in capitole.html cycled. */
const PHRASES = [
  'Exersează inteligent. Progresează rapid. Ia BAC-ul cu 10.',
  'Sute de exerciții organizate pe capitole și dificultate.',
  'Simulări reale BAC cu timer, notă automată și progres salvat.',
  'Antrenament rapid personalizat, pentru orice capitol și orice nivel.'
];

const ROTATE_MS = 5500;

/**
 * Title, rotating subtitle, and one row combining the grade switch with
 * the "solved" progress chip (see SummaryStrip.tsx — the percent-complete
 * chip that used to sit next to it is gone, as directly derivable from
 * this same number). One plain block, no boxed background: an earlier
 * version gave this section its own gradient wash, which read as an
 * oddly-shaped colored panel once the page became three columns (the
 * gradient only spanned the middle column's width, with the plain page
 * background sitting right beside it at the same height) — removed
 * rather than reworked. The chapter grid (ChaptersSection) sits directly
 * below with no heading of its own.
 */
export function Hero({ stats }: HeroProps) {
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

        {/* Fixed height so the swap below never nudges the row underneath. */}
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

        {/* One row: the grade switch (sets the context everything below —
            chapter grid, missions, leaderboard — is scoped to) alongside
            the one progress figure that's left. */}
        <div className="cap-header-row">
          <GradeSwitch />
          <SummaryStrip stats={stats} />
        </div>
      </div>
    </section>
  );
}
