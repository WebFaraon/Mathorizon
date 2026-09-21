import { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
 * this page. Rows are the exact same LeaderboardRows the card renders (same
 * data, same ordering), just in the 'table' variant — real Loc/Elev/Nivel/
 * XP columns instead of the card's compact stacked layout, with a matching
 * header row above them (see styles.css).
 *
 * Portaled to document.body, not rendered where LeaderboardCard sits in the
 * tree: LeaderboardCard lives inside .cap-col-right, one of the two rails
 * that are position:fixed with their own z-index (see .cap-col-left/-right
 * in styles.css) — which, left in place, trapped this modal inside that
 * rail's own stacking context instead of the page's. From there its z-index
 * of 500 (see .classes-modal) never got to compete with the navbar's 320 or
 * the OTHER rail's own z-index:5, which is what caused every symptom direct
 * feedback flagged at once: the navbar tinting from the backdrop rendering
 * behind it, the other rail staying sharp instead of sitting under the
 * blur, and the dialog's own head/close button ending up hidden behind the
 * navbar instead of above it.
 */
export function LeaderboardModal({ rows, currentUserId, onClose }: LeaderboardModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
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
          <div className="cap-leaderboard-table__head" aria-hidden="true">
            <span>Loc</span>
            <span />
            <span>Elev</span>
            <span>Nivel</span>
            <span>XP</span>
          </div>
          <LeaderboardRows rows={rows} currentUserId={currentUserId} variant="table" />
        </div>
      </div>
    </div>,
    document.body
  );
}
