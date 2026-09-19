import { motion, useReducedMotion } from 'framer-motion';
import { CircleCheck } from 'lucide-react';
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
 */
export function MissionsCard({ missions, ready }: MissionsCardProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!ready) {
    return <div className="cap-side-card cap-side-card--skeleton" aria-hidden="true" />;
  }

  return (
    <motion.div
      className="cap-side-card cap-side-card--missions"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE_OUT }}
    >
      <span className="cap-side-card__eyebrow">Misiunile zilei</span>
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
              <span className="cap-mission__count">{mission.progress} / {mission.target}</span>
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
