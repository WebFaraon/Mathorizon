import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { GradeSwitch } from './GradeSwitch';
import type { BMStats, ChapterView } from '../lib/bm-types';

interface HeroProps {
  stats: BMStats | null;
  /** Chapter key currently under the pointer/focus — see App.tsx. */
  readout: ChapterView | null;
}

/* Same four phrases the old inline rotator in capitole.html cycled. */
const PHRASES = [
  'Exersează inteligent. Progresează rapid. Ia BAC‑ul cu 10.',
  'Sute de exerciții organizate pe capitole și dificultate.',
  'Simulări reale BAC cu timer, notă automată și progres salvat.',
  'Antrenament rapid personalizat, pentru orice capitol și orice nivel.'
];

const ROTATE_MS = 6500;
const TYPE_MS = 26;

/**
 * Types the current phrase onto the LCD's input line one character at a
 * time, holds it, then moves to the next. Under reduced motion the first
 * phrase simply sits there, whole, with no rotation.
 */
function useTypedPhrase(enabled: boolean): string {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(enabled ? 0 : PHRASES[0].length);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % PHRASES.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setShown(0);
    const phrase = PHRASES[index];
    const timer = window.setInterval(() => {
      setShown((n) => {
        if (n >= phrase.length) {
          window.clearInterval(timer);
          return n;
        }
        return n + 1;
      });
    }, TYPE_MS);
    return () => window.clearInterval(timer);
  }, [index, enabled]);

  return PHRASES[index].slice(0, shown);
}

/**
 * Title, then the page's display: an LCD panel that reads out the whole
 * bank by default and switches to one chapter's numbers while that
 * chapter's key is hovered or focused (the keypad below drives it through
 * App.tsx). No count-up on the numbers: an LCD refreshes, it doesn't
 * tween, so a change is one short blink of the digits and nothing more.
 */
export function Hero({ stats, readout }: HeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const typed = useTypedPhrase(!prefersReducedMotion);

  const showingChapter = readout !== null && !readout.locked;
  const value = showingChapter ? readout.progress.solved : stats?.solvedCount;
  const total = showingChapter ? readout.progress.total : stats?.total;
  const percent = showingChapter ? readout.progress.percent : stats?.percent;
  // Keyed on what's displayed, so the refresh blink replays on every change.
  const refreshKey = showingChapter ? readout.category.id : 'all';

  return (
    <section className="cap-hero">
      <h1 className="cap-hero__title">
        Centrul tău de antrenament pentru{' '}
        <span className="cap-hero__title-accent">BAC &amp; Evaluare Națională</span>
      </h1>

      <div className="cap-lcd" aria-live="polite">
        <div className="cap-lcd__annunciators" aria-hidden="true">
          <span className="cap-lcd__ann cap-lcd__ann--on">XII</span>
          <span className="cap-lcd__ann">IX</span>
          <span className="cap-lcd__ann cap-lcd__ann--on">BAC</span>
          <span className="cap-lcd__ann-spacer" />
          <span className={`cap-lcd__ann${showingChapter ? ' cap-lcd__ann--on' : ''}`}>CAP</span>
          <span className={`cap-lcd__ann${showingChapter ? '' : ' cap-lcd__ann--on'}`}>Σ</span>
        </div>

        <p className="cap-lcd__input">
          {showingChapter ? (
            <span key={refreshKey} className="cap-lcd__refresh">
              {readout.category.name}
            </span>
          ) : (
            <span>{typed}</span>
          )}
          <span className="cap-lcd__cursor" aria-hidden="true" />
        </p>

        <div className="cap-lcd__result">
          {stats ? (
            <span key={refreshKey} className="cap-lcd__refresh cap-lcd__figure">
              <span className="cap-lcd__percent">{percent}%</span>
              <span className="cap-lcd__value">{value}</span>
              <span className="cap-lcd__total">/{total}</span>
              <span className="cap-lcd__unit">rezolvate</span>
            </span>
          ) : (
            <span className="cap-lcd__unit">Îți încărcăm progresul…</span>
          )}
        </div>
      </div>

      <div className="cap-hero__keys">
        <GradeSwitch />
        <p className="cap-hero__legend" aria-hidden="true">
          <span className="cap-hero__legend-lit">
            <span className="cap-hero__legend-dot cap-hero__legend-dot--blue" />
            <span className="cap-hero__legend-dot cap-hero__legend-dot--green" />
            <span className="cap-hero__legend-dot cap-hero__legend-dot--red" />
          </span>
          rezolvat
          <span className="cap-hero__legend-dot" /> de rezolvat
        </p>
      </div>
    </section>
  );
}
