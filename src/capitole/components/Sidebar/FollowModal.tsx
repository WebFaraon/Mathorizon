import { useEffect } from 'react';
import { X, Users } from 'lucide-react';

interface FollowModalProps {
  kind: 'following' | 'followers';
  onClose: () => void;
}

const COPY = {
  following: {
    title: 'Urmăriți',
    empty: 'Nu urmărești pe nimeni încă.'
  },
  followers: {
    title: 'Urmăritori',
    empty: 'Nu ai niciun urmăritor încă.'
  }
};

/**
 * Opened from ProfilePanel's "Urmăriți"/"Urmăritori" buttons. There's no
 * follow relationship in the data model yet (see ProfilePanel's own comment)
 * — this is an honest empty state, not a placeholder list of fake people,
 * since real students see this. Reuses .classes-modal/__backdrop/__dialog/
 * __head/__body from the shared site stylesheet, same as LeaderboardModal.
 */
export function FollowModal({ kind, onClose }: FollowModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copy = COPY[kind];

  return (
    <div className="classes-modal">
      <div className="classes-modal__backdrop" onClick={onClose} />
      <div className="classes-modal__dialog cap-follow-modal" role="dialog" aria-modal="true" aria-label={copy.title}>
        <div className="classes-modal__head">
          <h3>{copy.title}</h3>
          <button type="button" className="cap-leaderboard-modal__close" onClick={onClose} aria-label="Închide">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="classes-modal__body">
          <div className="cap-follow-modal__empty">
            <Users className="cap-follow-modal__empty-icon" aria-hidden="true" />
            <p>{copy.empty}</p>
            <span>Funcția de urmărire vine în curând.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
