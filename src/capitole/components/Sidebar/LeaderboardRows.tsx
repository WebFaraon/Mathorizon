import { Flame } from 'lucide-react';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';

/** Same rule js/auth.js's _initials() uses for the nav profile pill, so a
    student without a photo gets the identical fallback everywhere on the
    site instead of a second, different-looking placeholder here. */
export function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
}

interface LeaderboardRowsProps {
  rows: LeaderboardRow[];
  currentUserId: string | null;
}

/**
 * The row list itself — shared between LeaderboardCard (a handful of rows,
 * capped height, hidden scrollbar) and LeaderboardModal (every row, full
 * height) so the two never drift into showing different information for
 * the same student. Which one caps the height is a CSS concern scoped to
 * .cap-side-card .cap-leaderboard__list, not something this component
 * decides — see styles.css.
 */
export function LeaderboardRows({ rows, currentUserId }: LeaderboardRowsProps) {
  return (
    <ol className="cap-leaderboard__list">
      {rows.map((row) => (
        <li
          key={row.userId}
          className={`cap-leaderboard__row${row.userId === currentUserId ? ' cap-leaderboard__row--you' : ''}`}
        >
          <span className="cap-leaderboard__rank">{row.rank}</span>
          <span className="cap-leaderboard__avatar" aria-hidden="true">
            {row.avatarUrl ? (
              <img src={row.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              initialsFor(row.displayName)
            )}
          </span>
          <span className="cap-leaderboard__main">
            <span className="cap-leaderboard__name">
              {row.displayName}
              {row.userId === currentUserId && <span className="cap-leaderboard__you">Tu</span>}
            </span>
            <span className="cap-leaderboard__meta">
              <span className="cap-leaderboard__level">Nivel {row.level}</span>
              {row.bestStreak > 0 && (
                <span className="cap-leaderboard__streak">
                  <Flame aria-hidden="true" />
                  {row.bestStreak}
                </span>
              )}
            </span>
          </span>
          <span className="cap-leaderboard__xp">{row.totalXp} XP</span>
        </li>
      ))}
    </ol>
  );
}
