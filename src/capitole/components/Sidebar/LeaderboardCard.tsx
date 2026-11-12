import { useState } from 'react';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { LeaderboardRows } from './LeaderboardRows';
import { LeaderboardModal } from './LeaderboardModal';

interface LeaderboardCardProps {
  rows: LeaderboardRow[];
  ready: boolean;
  currentUserId: string | null;
  /** How many rows the rail's preview shows (RightColumn fits it to the window); the modal always has them all. */
  maxRows?: number;
}

/**
 * Every student on Teorema, ranked by lifetime XP (see hooks/useLeaderboard.ts
 * and supabase/migrations/..._xp_leaderboard_all_students.sql — it's a real,
 * complete roster, not a top-N cut or a placeholder list). Not "who's online
 * right now": the site has no site-wide presence tracking, only per-session
 * Realtime channels (exam/whiteboard) — this is the nearest real signal to
 * "students doing well on Teorema" that exists today.
 *
 * A section inside RightColumn's shared .cap-sidebar-panel now, not its own
 * bordered card — see MissionsCard's own comment for why. --cap-card-color
 * stays set inline here (rather than moving up to the shared panel) since
 * it's this section's own thing to own: the Leaderboard button and the
 * Trophy eyebrow icon both read it, and Missions has no equivalent need
 * for it.
 *
 * Only the first few rows show here (see .cap-sidebar-panel .cap-leaderboard__list
 * in styles.css); the "Leaderboard" button opens LeaderboardModal with the
 * same rows, unclipped, for the full roster.
 */
export function LeaderboardCard({ rows, ready, currentUserId, maxRows = 4 }: LeaderboardCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!ready) {
    return <div className="cap-sidebar-section cap-sidebar-section--skeleton" aria-hidden="true" />;
  }

  return (
    <>
      <div className="cap-sidebar-section">
        <h2 className="cap-side-title">
          <img className="cap-side-title__img" src="assets/images/gamification/leaderboard.svg" alt="" />
          Top elevi · XP
        </h2>

        {rows.length === 0 ? (
          <p className="cap-leaderboard__empty">
            Fii primul din clasament: rezolvă exerciții la Antrenament ca să câștigi XP.
          </p>
        ) : (
          <>
            <LeaderboardRows rows={rows.slice(0, maxRows)} currentUserId={currentUserId} />
            <button
              type="button"
              className="cap-btn cap-btn--block"
              onClick={() => setModalOpen(true)}
            >
              Leaderboard
            </button>
          </>
        )}
      </div>

      {modalOpen && (
        <LeaderboardModal rows={rows} currentUserId={currentUserId} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
