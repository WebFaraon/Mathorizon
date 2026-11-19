import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { Podium, LbRow } from './LeaderboardRows';

interface LeaderboardModalProps {
  rows: LeaderboardRow[];
  currentUserId: string | null;
  onClose: () => void;
}

/**
 * The full roster, opened from LeaderboardCard's "Leaderboard" key: the podium
 * of the first three, then every other place as a card row, and a bar at the
 * bottom that always shows your own place. Portaled to document.body, because
 * the right rail is position:fixed with its own stacking context (a modal left
 * inside it ended up under the navbar and the other rail).
 */
export function LeaderboardModal({ rows, currentUserId, onClose }: LeaderboardModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const me = currentUserId ? rows.find((r) => r.userId === currentUserId) : undefined;
  const rest = rows.slice(3);

  return createPortal(
    <div className="classes-modal">
      <div className="classes-modal__backdrop" onClick={onClose} />
      <div className="classes-modal__dialog cap-leaderboard-modal lb-modal" role="dialog" aria-modal="true" aria-label="Clasament complet">
        <div className="lb-modal__head">
          <img className="lb-modal__ico" src="assets/images/gamification/leaderboard.svg" alt="" />
          <div className="lb-modal__t">
            <h3>Clasament</h3>
            <p>Toți elevii, după XP total · {rows.length} {rows.length === 1 ? 'elev' : 'elevi'}</p>
          </div>
          <button type="button" className="cap-leaderboard-modal__close" onClick={onClose} aria-label="Închide">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="lb-modal__body">
          <Podium rows={rows.slice(0, 3)} currentUserId={currentUserId} big />
          {rest.length > 0 && (
            <ol className="lb-list lb-list--modal">
              {rest.map((r) => (
                <LbRow key={r.userId} row={r} you={r.userId === currentUserId} />
              ))}
            </ol>
          )}
        </div>

        {me && (
          <div className="lb-modal__me">
            <span className="lb-modal__mel">Locul tău</span>
            <ol className="lb-list">
              <LbRow row={me} you />
            </ol>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
