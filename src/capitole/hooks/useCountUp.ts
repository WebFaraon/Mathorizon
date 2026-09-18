import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/**
 * Tweens a displayed integer towards `value`.
 *
 * Purpose, not decoration: the count-up is what makes a number that
 * arrives asynchronously read as "this is your progress, it just loaded"
 * rather than as a value that was always there. It therefore also runs when
 * a Supabase sync replaces a stale localStorage figure mid-view — it
 * continues from whatever is on screen (see `fromRef`) instead of snapping
 * or restarting from 0.
 *
 * @param value  the real target value
 * @param start  gate — stays at 0 until the element is actually in view
 */
export function useCountUp(value: number, start: boolean): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!start) return;

    if (prefersReducedMotion) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    if (from === value) return;

    // Longer for a bigger jump, but bounded — 900ms for a 0→900 exercise
    // total, ~450ms for a small correction after a sync.
    const distance = Math.abs(value - from);
    const duration = Math.min(1.1, 0.35 + distance / 1200);

    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        fromRef.current = v;
        setDisplay(Math.round(v));
      },
      onComplete: () => {
        fromRef.current = value;
        setDisplay(value);
      }
    });

    return () => controls.stop();
  }, [value, start, prefersReducedMotion]);

  return display;
}
