import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { CircleCheck, Flame, Library } from 'lucide-react';
import type { BMStats } from '../lib/bm-types';
import { useCountUp } from '../hooks/useCountUp';

/* Geometry of the "Completat" ring — r=18 in a 44×44 box, same as the
   ring js/utils.js's updateProgressRing() drove. */
const RING_RADIUS = 18;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface StatsBarProps {
  stats: BMStats | null;
}

/**
 * The four headline figures, all real:
 *   Total exerciții  — BM.EXERCISES.length (js/data.js + Supabase custom_exercises)
 *   Rezolvate        — user_solved, synced to localStorage by js/auth.js
 *   Completat        — rezolvate / total
 *   Zile consecutive — user_streak
 * See hooks/useCapitoleData.ts for where they come from.
 */
export function StatsBar({ stats }: StatsBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  // once: true — the count-up is an arrival cue, not something to replay
  // every time the user scrolls back up.
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const prefersReducedMotion = useReducedMotion();

  const loaded = stats !== null;
  const run = inView && loaded;

  const total = useCountUp(stats?.total ?? 0, run);
  const solved = useCountUp(stats?.solvedCount ?? 0, run);
  const percent = useCountUp(stats?.percent ?? 0, run);
  const streak = useCountUp(stats?.streak ?? 0, run);

  // Drawn from the same animated percent, so ring and label can't disagree.
  const dashOffset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;

  return (
    <section className="cap-stats-section" aria-label="Progresul tău">
      <div className="cap-shell">
        <motion.div
          ref={ref}
          className="cap-stats"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Tile
            label="Total exerciții"
            value={loaded ? String(total) : '—'}
            icon={<Library className="cap-stat__icon" aria-hidden="true" />}
          />
          <Tile
            label="Rezolvate"
            value={loaded ? String(solved) : '—'}
            accent
            icon={<CircleCheck className="cap-stat__icon cap-stat__icon--accent" aria-hidden="true" />}
          />
          <Tile
            label="Completat"
            value={loaded ? `${percent}%` : '—'}
            icon={
              <svg className="cap-stat__ring" viewBox="0 0 44 44" aria-hidden="true">
                <circle
                  className="cap-stat__ring-track"
                  cx="22" cy="22" r={RING_RADIUS}
                  fill="none" strokeWidth="3.5"
                />
                <circle
                  className="cap-stat__ring-fill"
                  cx="22" cy="22" r={RING_RADIUS}
                  fill="none" strokeWidth="3.5" strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 22 22)"
                />
              </svg>
            }
          />
          <Tile
            label="Zile consecutive"
            value={loaded ? String(streak) : '—'}
            icon={<Flame className="cap-stat__icon cap-stat__icon--flame" aria-hidden="true" />}
          />
        </motion.div>
      </div>
    </section>
  );
}

interface TileProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}

function Tile({ label, value, icon, accent }: TileProps) {
  return (
    <div className="cap-stat">
      <span className="cap-stat__slot">{icon}</span>
      <span className="cap-stat__body">
        <span className={accent ? 'cap-stat__val cap-stat__val--accent' : 'cap-stat__val'}>
          {value}
        </span>
        <span className="cap-stat__lbl">{label}</span>
      </span>
    </div>
  );
}
