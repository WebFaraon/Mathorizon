import { useState } from 'react';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { Podium, LbRow, LbGap } from './LeaderboardRows';
import { LeaderboardModal } from './LeaderboardModal';

interface LeaderboardCardProps {
  rows: LeaderboardRow[];
  ready: boolean;
  currentUserId: string | null;
  /** How many places after the podium the rail shows (RightColumn fits it to the window, 0 to 2); the modal has them all. */
  maxRows?: number;
}

/**
 * "Top elevi": every student on Teorema ranked by lifetime XP. The first three
 * stand on a podium, the next places follow as rows and YOUR place is always
 * on the card, whatever it is (with three dots when places are skipped).
 * The "Leaderboard" key opens the full list in LeaderboardModal.
 */
export function LeaderboardCard({ rows, ready, currentUserId, maxRows = 2 }: LeaderboardCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!ready) {
    return <div className="cap-sidebar-section cap-sidebar-section--skeleton" aria-hidden="true" />;
  }

  const top = rows.slice(0, 3);
  const next = rows.slice(3, 3 + maxRows);
  const me = currentUserId ? rows.find((r) => r.userId === currentUserId) : undefined;
  const shown = 3 + next.length;
  const meBelow = me && me.rank > shown ? me : undefined;
  const gap = meBelow && meBelow.rank > shown + 1;

  return (
    <>
      <div className="cap-sidebar-section lb-card">
        <div className="lb-head">
          <div className="lb-head__t">
            <h2 className="lb-head__h">Top elevi</h2>
            <p className="lb-head__s">după XP total</p>
          </div>
          <img className="lb-head__ico" src="assets/images/gamification/leaderboard.svg" alt="" />
        </div>

        {rows.length === 0 ? (
          <p className="cap-leaderboard__empty">
            {(window as unknown as Record<string, unknown>).__bmLbFailed
              ? 'Clasamentul nu se poate încărca acum. Încearcă din nou puțin mai târziu.'
              : 'Fii primul din clasament: rezolvă exerciții la Antrenament ca să câștigi XP.'}
          </p>
        ) : (
          <>
            <Podium rows={top} currentUserId={currentUserId} />
            {(next.length > 0 || meBelow) && (
              <ol className="lb-list lb-list--card">
                {next.map((r) => (
                  <LbRow key={r.userId} row={r} you={r.userId === currentUserId} />
                ))}
                {gap && <LbGap />}
                {meBelow && <LbRow row={meBelow} you />}
              </ol>
            )}
            <button type="button" className="cap-btn cap-btn--block lb-open" onClick={() => setModalOpen(true)}>
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
