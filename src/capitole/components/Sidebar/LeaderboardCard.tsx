import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { EASE_OUT } from '../../lib/motion';
import { LeaderboardRows } from './LeaderboardRows';
import { LeaderboardModal } from './LeaderboardModal';

interface LeaderboardCardProps {
  rows: LeaderboardRow[];
  ready: boolean;
  currentUserId: string | null;
}

/**
 * Every student on Mathorizon, ranked by lifetime XP (see hooks/useLeaderboard.ts
 * and supabase/migrations/..._xp_leaderboard_all_students.sql — it's a real,
 * complete roster, not a top-N cut or a placeholder list). Not "who's online
 * right now": the site has no site-wide presence tracking, only per-session
 * Realtime channels (exam/whiteboard) — this is the nearest real signal to
 * "students doing well on Mathorizon" that exists today.
 *
 * Only the first few rows show here (see .cap-side-card .cap-leaderboard__list
 * in styles.css); the "Leaderboard" button opens LeaderboardModal with the
 * same rows, unclipped, for the full roster.
 */
export function LeaderboardCard({ rows, ready, currentUserId }: LeaderboardCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [modalOpen, setModalOpen] = useState(false);

  if (!ready) {
    return <div className="cap-side-card cap-side-card--skeleton cap-side-card--skeleton-sm" aria-hidden="true" />;
  }

  return (
    <>
      <motion.div
        className="cap-side-card"
        style={{ '--cap-card-color': 'var(--yellow)' } as React.CSSProperties}
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.06, ease: EASE_OUT }}
      >
        <span className="cap-side-card__eyebrow">
          <Trophy className="cap-side-card__eyebrow-icon" aria-hidden="true" />
          Top elevi · XP
        </span>

        {rows.length === 0 ? (
          <p className="cap-leaderboard__empty">
            Fii primul din clasament: rezolvă exerciții la Antrenament ca să câștigi XP.
          </p>
        ) : (
          <>
            <LeaderboardRows rows={rows} currentUserId={currentUserId} />
            <button
              type="button"
              className="cap-btn cap-btn--secondary cap-btn--block"
              onClick={() => setModalOpen(true)}
            >
              Leaderboard
            </button>
          </>
        )}
      </motion.div>

      {modalOpen && (
        <LeaderboardModal rows={rows} currentUserId={currentUserId} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
