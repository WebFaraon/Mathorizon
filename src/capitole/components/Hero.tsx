import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { GradeSwitch } from './GradeSwitch';
import type { BMStats, Readout } from '../lib/bm-types';

interface HeroProps {
  stats: BMStats | null;
  /** Chapter key (or bank-strip segment) under the pointer/focus — see App.tsx. */
  readout: Readout | null;
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
/** How long the power-on segment test holds before the real figures show. */
const BOOT_MS = 620;

/**
 * Power-on: like a real calculator, the display first lights every
 * segment (all annunciators, a row of eights), then drops to the real
 * readout. Runs once per page load; skipped under reduced motion.
 */
function useBoot(enabled: boolean): boolean {
  const [booting, setBooting] = useState(enabled);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => setBooting(false), BOOT_MS);
    return () => window.clearTimeout(timer);
  }, [enabled]);
  return booting;
}

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
  const booting = useBoot(!prefersReducedMotion);
  const typed = useTypedPhrase(!prefersReducedMotion && !booting);

  const chapter = readout && !readout.chapter.locked ? readout.chapter : null;
  const sub = chapter ? readout?.sub ?? null : null;
  const source = sub ?? chapter?.progress ?? null;
  const value = source ? source.solved : stats?.solvedCount;
  const total = source ? source.total : stats?.total;
  const percent = source
    ? source.total ? Math.round((source.solved / source.total) * 100) : 0
    : stats?.percent;
  // Keyed on what's displayed, so the refresh blink replays on every change.
  const refreshKey = sub ? `${chapter?.category.id}/${sub.id}` : chapter ? chapter.category.id : 'all';
  const annOn = (on: boolean) => `cap-lcd__ann${booting || on ? ' cap-lcd__ann--on' : ''}`;

  return (
    <section className="cap-hero">
      {/* Each line rises out of its own mask on load (see .cap-hero__line). */}
      <h1 className="cap-hero__title">
        <span className="cap-hero__line">
          <span>Centrul tău de antrenament pentru</span>
        </span>{' '}
        <span className="cap-hero__line cap-hero__line--accent">
          <span className="cap-hero__title-accent">BAC &amp; Evaluare Națională</span>
        </span>
      </h1>

      <div className={`cap-lcd${booting ? ' cap-lcd--boot' : ''}`} aria-live="polite">
        <div className="cap-lcd__annunciators" aria-hidden="true">
          <span className={annOn(true)}>XII</span>
          <span className={annOn(false)}>IX</span>
          <span className={annOn(true)}>BAC</span>
          <span className="cap-lcd__ann-spacer" />
          <span className={annOn(Boolean(chapter))}>CAP</span>
          <span className={annOn(Boolean(sub))}>TIP</span>
          <span className={annOn(!chapter)}>Σ</span>
        </div>

        <p className="cap-lcd__input">
          {booting ? (
            <span />
          ) : chapter ? (
            <span key={refreshKey} className="cap-lcd__refresh">
              {chapter.category.name}
              {sub && <span className="cap-lcd__sub"> › {sub.name}</span>}
            </span>
          ) : (
            <span>{typed}</span>
          )}
          <span className="cap-lcd__cursor" aria-hidden="true" />
        </p>

        <div className="cap-lcd__result">
          {booting ? (
            <span className="cap-lcd__figure" aria-hidden="true">
              <span className="cap-lcd__percent">88%</span>
              <span className="cap-lcd__value">888</span>
              <span className="cap-lcd__total">/888</span>
            </span>
          ) : stats ? (
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
      </div>
    </section>
  );
}
