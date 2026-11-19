import type { LeaderboardRow } from '../../hooks/useLeaderboard';

const IMG = 'assets/images/gamification/';

/** 1250 -> "1.250" (Romanian grouping), so long totals stay readable. */
export function fmtXp(n: number): string {
  return n.toLocaleString('ro-RO');
}

function Avatar({ row, className }: { row: LeaderboardRow; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <img
        src={row.avatarUrl || 'assets/images/avatar-owl.svg'}
        alt=""
        referrerPolicy="no-referrer"
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.src.endsWith('avatar-owl.svg')) img.src = 'assets/images/avatar-owl.svg';
        }}
      />
    </span>
  );
}

/** Streak pill: flame + days in a row. Hidden when the database does not return the daily streak yet. */
function Streak({ row }: { row: LeaderboardRow }) {
  if (row.streak === null) return null;
  return (
    <span className={`lb-streak${row.streak > 0 ? ' is-on' : ''}`} title={`Serie de ${row.streak} zile`}>
      <img src={`${IMG}streak-mini.svg`} alt="" />
      {row.streak}
    </span>
  );
}

function Xp({ row }: { row: LeaderboardRow }) {
  return (
    <span className="lb-xp">
      <img src={`${IMG}xp-mini.svg`} alt="" />
      {fmtXp(row.totalXp)}
      <small>XP</small>
    </span>
  );
}

function Crown() {
  return (
    <svg className="lb-crown" viewBox="0 0 40 28" aria-hidden="true">
      <path d="M4 22 L2 6 L12 13 L20 2 L28 13 L38 6 L36 22 Z" fill="#F5B921" stroke="#B37A06" strokeWidth="2" strokeLinejoin="round" />
      <rect x="4" y="22" width="32" height="5" rx="2" fill="#E29A0C" stroke="#B37A06" strokeWidth="2" />
      <circle cx="20" cy="15" r="2.4" fill="#fff" opacity=".85" />
    </svg>
  );
}

/** Top three on a podium: 2nd, 1st, 3rd, each with photo, name, XP and streak. */
export function Podium({ rows, currentUserId, big = false }: { rows: LeaderboardRow[]; currentUserId: string | null; big?: boolean }) {
  const by = (rank: number) => rows.find((r) => r.rank === rank) ?? rows[rank - 1];
  const order = [by(2), by(1), by(3)].filter(Boolean) as LeaderboardRow[];
  if (order.length === 0) return null;
  return (
    <ol className={`lb-podium${big ? ' lb-podium--big' : ''}`}>
      {order.map((row) => {
        const place = row.rank <= 3 ? row.rank : order.indexOf(row) + 1;
        const you = row.userId === currentUserId;
        return (
          <li key={row.userId} className={`lb-pod lb-pod--${place}${you ? ' is-you' : ''}`}>
            {place === 1 && <Crown />}
            <span className="lb-pod__who">
              <Avatar row={row} className="lb-pod__avatar" />
              <b className="lb-pod__name" title={row.displayName}>{row.displayName}</b>
              {you && <span className="lb-you">Tu</span>}
            </span>
            <Xp row={row} />
            <Streak row={row} />
            <span className="lb-pod__step" aria-label={`Locul ${row.rank}`}>
              <span>{row.rank}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One ranked row: place, photo, name and level, streak, total XP. */
export function LbRow({ row, you }: { row: LeaderboardRow; you: boolean }) {
  return (
    <li className={`lb-row${you ? ' is-you' : ''}`}>
      <span className="lb-row__rank">{row.rank}</span>
      <Avatar row={row} className="lb-row__avatar" />
      <span className="lb-row__main">
        <b className="lb-row__name" title={row.displayName}>
          <span className="lb-t">{row.displayName}</span>
          {you && <span className="lb-you">Tu</span>}
        </b>
        <small className="lb-row__lvl">Nivel {row.level}</small>
      </span>
      <Streak row={row} />
      <Xp row={row} />
    </li>
  );
}

/** Three dots between the visible places and your own row, when places are skipped. */
export function LbGap() {
  return (
    <li className="lb-gap" aria-hidden="true">
      <i /><i /><i />
    </li>
  );
}
