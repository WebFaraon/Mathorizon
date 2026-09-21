import { motion, useReducedMotion } from 'framer-motion';
import { CircleCheck, Gift, ListChecks } from 'lucide-react';
import type { MissionProgress } from '../../lib/missions';
import { EASE_OUT } from '../../lib/motion';

interface MissionsCardProps {
  missions: MissionProgress[];
  ready: boolean;
}

/**
 * "Misiunile zilei" — three real missions computed from data the site
 * already tracks (see lib/missions.ts): showing up today, and two solved-
 * today thresholds. Completing one grants real XP exactly once per day
 * (see hooks/useMissions.ts) — this component only renders whatever state
 * that hook hands it.
 *
 * A section inside RightColumn's shared .cap-sidebar-panel now, not its
 * own bordered card — no entrance animation or skeleton chrome of its own
 * beyond what that shared panel already provides, and the green identity
 * that used to live on the standalone card's top border now sits on the
 * eyebrow icon instead (see LeaderboardCard's Trophy for the same pattern).
 */
export function MissionsCard({ missions, ready }: MissionsCardProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!ready) {
    return <div className="cap-sidebar-section cap-sidebar-section--skeleton" aria-hidden="true" />;
  }

  return (
    <div className="cap-sidebar-section">
      <span className="cap-side-card__eyebrow">
        <ListChecks className="cap-side-card__eyebrow-icon cap-side-card__eyebrow-icon--green" aria-hidden="true" />
        Misiunile zilei
      </span>
      <ul className="cap-missions__list">
        {missions.map((mission) => (
          <li className={`cap-mission${mission.done ? ' cap-mission--done' : ''}`} key={mission.key}>
            <span className="cap-mission__check" aria-hidden="true">
              {mission.done ? <CircleCheck /> : <span className="cap-mission__check-empty" />}
            </span>
            <span className="cap-mission__body">
              <span className="cap-mission__row">
                <span className="cap-mission__title">{mission.title}</span>
                <span className="cap-mission__xp">+{mission.xpReward} XP</span>
              </span>
              <span className="cap-mission__trackrow">
                <span className="cap-mission__track">
                  <motion.span
                    className="cap-mission__fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (mission.progress / mission.target) * 100)}%` }}
                    transition={
                      prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: EASE_OUT }
                    }
                  />
                </span>
                {/* The reward waiting at the end of the bar — makes the
                    connection between "finish this" and "get XP" visual,
                    not just a number in the header row. */}
                <Gift
                  className={`cap-mission__reward${mission.done ? ' cap-mission__reward--done' : ''}`}
                  aria-hidden="true"
                />
              </span>
              <span className="cap-mission__count">{mission.progress} / {mission.target}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
