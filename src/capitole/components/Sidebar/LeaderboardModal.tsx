import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { LeaderboardRows } from './LeaderboardRows';

interface LeaderboardModalProps {
  rows: LeaderboardRow[];
  currentUserId: string | null;
  onClose: () => void;
}

/**
 * The full roster, opened from LeaderboardCard's "Leaderboard" button.
 * Reuses .classes-modal/__backdrop/__dialog/__head/__body from the shared
 * site stylesheet (css/style.css) — the same centered-dialog pattern the
 * classroom pages already use — instead of a second modal system just for
 * this page. Rows are the exact same LeaderboardRows the card renders, just
 * with .cap-side-card's height cap out of scope (see styles.css), so every
 * row (not only the first few) shows, scrollable.
 */
export function LeaderboardModal({ rows, currentUserId, onClose }: LeaderboardModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="classes-modal">
      <div className="classes-modal__backdrop" onClick={onClose} />
      <div className="classes-modal__dialog cap-leaderboard-modal" role="dialog" aria-modal="true" aria-label="Clasament complet">
        <div className="classes-modal__head">
          <h3>Clasament complet · Top elevi XP</h3>
          <button type="button" className="cap-leaderboard-modal__close" onClick={onClose} aria-label="Închide">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="classes-modal__body">
          <LeaderboardRows rows={rows} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
}
