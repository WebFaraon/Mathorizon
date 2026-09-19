import { motion, useReducedMotion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { EASE_OUT } from '../../lib/motion';

interface LeaderboardCardProps {
  rows: LeaderboardRow[];
  ready: boolean;
  currentUserId: string | null;
}

/**
 * Top students by lifetime XP (see hooks/useLeaderboard.ts for exactly
 * where the number comes from — it's real, not a placeholder list). Not
 * "who's online right now": the site has no site-wide presence tracking,
 * only per-session Realtime channels (exam/whiteboard) — this is the
 * nearest real signal to "students doing well on Mathorizon" that exists
 * today.
 */
export function LeaderboardCard({ rows, ready, currentUserId }: LeaderboardCardProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!ready) {
    return <div className="cap-side-card cap-side-card--skeleton cap-side-card--skeleton-sm" aria-hidden="true" />;
  }

  return (
    <motion.div
      className="cap-side-card cap-side-card--leaderboard"
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
        <ol className="cap-leaderboard__list">
          {rows.map((row) => (
            <li
              key={row.userId}
              className={`cap-leaderboard__row${row.userId === currentUserId ? ' cap-leaderboard__row--you' : ''}`}
            >
              <span className="cap-leaderboard__rank">{row.rank}</span>
              <span className="cap-leaderboard__name">
                {row.displayName}
                {row.userId === currentUserId && <span className="cap-leaderboard__you">Tu</span>}
              </span>
              <span className="cap-leaderboard__xp">{row.totalXp} XP</span>
            </li>
          ))}
        </ol>
      )}
    </motion.div>
  );
}
