import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame, Trophy, Zap, ClipboardList, Award } from 'lucide-react';
import { useProfileSnapshot } from '../../hooks/useProfileSnapshot';
import { useStudentClass } from '../../hooks/useStudentClass';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { EASE_OUT } from '../../lib/motion';
import { FollowModal } from './FollowModal';

interface ProfilePanelProps {
  leaderboardRows: LeaderboardRow[];
  leaderboardReady: boolean;
  currentUserId: string | null;
}

const XP_PER_LEVEL_FALLBACK = 100;

const ROLE_LABEL: Record<'elev' | 'profesor' | 'admin', string> = {
  elev: 'Elev',
  profesor: 'Profesor',
  admin: 'Admin'
};

/**
 * The whole left rail now — replaced the old ContinueCard/NudgeCard/
 * SimulareBannerCard stack, which pointed at "what to do next" using the
 * same progress numbers the chapter grid right next to it already showed.
 * This is a presentation surface instead, styled after a Duolingo-style
 * profile card: cover, avatar, role/class/join-date, follow counts, a
 * Statistici grid (streak, lifetime XP, leaderboard rank), and a Realizări
 * section (prepared visually ahead of a real achievements feature).
 *
 * Read-only on purpose, no edit affordance: editing stays on profile.html,
 * via the navbar's own profile button.
 *
 * capitole.html is BM.__protectedRoute (see js/auth-hint.js) — a visitor who
 * is genuinely signed out never reaches this component at all, they're
 * bounced to "/" before React mounts. So !snapshot.signedIn here never means
 * "guest"; it only ever means "the real session check hasn't resolved yet"
 * (same race useLeaderboard's own comment describes), which resolves to
 * true within one bmauth:synced tick for every real visitor. A skeleton is
 * therefore the correct read of that state, not a sign-in prompt.
 */
export function ProfilePanel({ leaderboardRows, leaderboardReady, currentUserId }: ProfilePanelProps) {
  const snapshot = useProfileSnapshot();
  const { className } = useStudentClass(snapshot.role === 'elev');
  const prefersReducedMotion = useReducedMotion();
  const [followModal, setFollowModal] = useState<'following' | 'followers' | null>(null);

  if (!snapshot.signedIn) {
    return <div className="cap-profile-panel cap-profile-panel--skeleton" aria-hidden="true" />;
  }

  const entrance = {
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, ease: EASE_OUT }
  };

  // Prefer the leaderboard row's own totalXp (and its rank, alongside it)
  // over the local snapshot's — same underlying number once training_stats
  // has synced, but this keeps level/XP and rank consistent with EACH OTHER
  // even if one source is a beat ahead of the other.
  const myRow = leaderboardRows.find((row) => row.userId === currentUserId) ?? null;
  const xpPerLevel = window.BM?.Training?.XP_PER_LEVEL ?? XP_PER_LEVEL_FALLBACK;
  const totalXp = myRow?.totalXp ?? snapshot.totalXp;
  const level = Math.floor(totalXp / xpPerLevel) + 1;
  const xpIntoLevel = totalXp % xpPerLevel;
  const xpPct = Math.round((xpIntoLevel / xpPerLevel) * 100);

  const roleLabel = snapshot.role ? ROLE_LABEL[snapshot.role] : null;
  const roleLine = roleLabel && className ? `${roleLabel} · ${className}` : roleLabel;

  return (
    <motion.div className="cap-profile-panel" {...entrance}>
      <div
        className="cap-profile-cover"
        style={snapshot.coverUrl ? { backgroundImage: `url('${snapshot.coverUrl}')` } : undefined}
      />
      <div className="cap-profile-body">
        <div className="cap-profile-avatar" aria-hidden="true">
          {snapshot.avatarUrl ? (
            <img src={snapshot.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span>{snapshot.initials}</span>
          )}
        </div>

        <h3 className="cap-profile-name">{snapshot.displayName}</h3>
        {roleLine && <span className="cap-profile-meta cap-profile-meta--primary">{roleLine}</span>}
        {snapshot.memberSince && (
          <span className="cap-profile-meta cap-profile-meta--secondary">S-a alăturat în {snapshot.memberSince}</span>
        )}

        {/* No follow relationship in the data model yet — pressable (opens
            FollowModal's honest empty state) rather than disabled, per
            direct feedback that these should work as real buttons, not just
            static counts. */}
        <div className="cap-profile-follow">
          <button type="button" className="cap-profile-follow__item" onClick={() => setFollowModal('following')}>
            <strong>0</strong> urmăriți
          </button>
          <button type="button" className="cap-profile-follow__item" onClick={() => setFollowModal('followers')}>
            <strong>0</strong> urmăritori
          </button>
        </div>

        <div className="cap-profile-divider" />

        <div className="cap-profile-level">
          <div className="cap-profile-level__head">
            <span className="cap-profile-level__label">Nivel {level}</span>
            <span className="cap-profile-level__xp">
              {xpIntoLevel} / {xpPerLevel} XP
            </span>
          </div>
          <div className="cap-profile-xpbar">
            <div className="cap-profile-xpbar__fill" style={{ width: `${xpPct}%` }} />
          </div>
        </div>

        <div className="cap-profile-section">
          <span className="cap-profile-section__title">Statistici</span>
          <div className="cap-profile-stats">
            <div className="cap-profile-stat">
              <Flame className="cap-profile-stat__icon" aria-hidden="true" />
              <span className="cap-profile-stat__val">{snapshot.dailyStreak}</span>
              <span className="cap-profile-stat__label">zile la rând</span>
            </div>
            <div className="cap-profile-stat">
              <Zap className="cap-profile-stat__icon cap-profile-stat__icon--xp" aria-hidden="true" />
              <span className="cap-profile-stat__val">{totalXp}</span>
              <span className="cap-profile-stat__label">XP total</span>
            </div>
            <div className="cap-profile-stat">
              <Trophy className="cap-profile-stat__icon cap-profile-stat__icon--rank" aria-hidden="true" />
              <span className="cap-profile-stat__val">
                {!leaderboardReady ? '…' : myRow ? `#${myRow.rank}` : '—'}
              </span>
              <span className="cap-profile-stat__label">în clasament</span>
            </div>
          </div>
        </div>

        {/* Prepared ahead of a real achievements feature — an honest empty
            state now rather than fabricated sample progress, since real
            students see this. */}
        <div className="cap-profile-section">
          <span className="cap-profile-section__title">Realizări</span>
          <div className="cap-profile-achievements-empty">
            <Award className="cap-profile-achievements-empty__icon" aria-hidden="true" />
            <p>Realizările vor apărea aici în curând.</p>
          </div>
        </div>

        {snapshot.role === 'elev' && (
          <a className="cap-btn cap-btn--secondary cap-btn--sm cap-btn--block" href="profile.html#simulari-bac">
            <ClipboardList aria-hidden="true" />
            Simulările tale anterioare
          </a>
        )}
      </div>

      {followModal && <FollowModal kind={followModal} onClose={() => setFollowModal(null)} />}
    </motion.div>
  );
}
