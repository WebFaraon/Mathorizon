import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MissionsCard } from './MissionsCard';
import { LeaderboardCard } from './LeaderboardCard';
import type { MissionProgress } from '../../lib/missions';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { EASE_OUT } from '../../lib/motion';

interface RightColumnProps {
  missions: MissionProgress[];
  missionsReady: boolean;
  leaderboardRows: LeaderboardRow[];
  leaderboardReady: boolean;
  currentUserId: string | null;
}

/**
 * Right rail — two separate cards (.cap-side-card), daily missions and
 * the XP leaderboard, each with its own frame. The rail itself is fixed to
 * the viewport on wide screens, so both stay in place while the middle
 * scrolls. Each card still gates its own ready state internally (see
 * MissionsCard/LeaderboardCard) — nothing here waits on both before showing either.
 */
export function RightColumn({
  missions,
  missionsReady,
  leaderboardRows,
  leaderboardReady,
  currentUserId
}: RightColumnProps) {
  const prefersReducedMotion = useReducedMotion();
  const asideRef = useRef<HTMLElement | null>(null);
  // Rows of the leaderboard preview: at most 4, fewer when the window is too short for both cards to fit without scrolling.
  const [maxRows, setMaxRows] = useState(4);

  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const fit = () => {
      if (getComputedStyle(aside).position !== 'fixed') { setMaxRows(4); return; }   // stacked layouts scroll with the page
      const list = aside.querySelector<HTMLElement>('.cap-leaderboard__list');
      const first = list && (list.children[0] as HTMLElement | undefined);
      if (!list || !first) return;
      const rowH = first.offsetHeight || 1;
      const cs = getComputedStyle(aside);
      const avail = aside.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const cards = Array.from(aside.querySelectorAll<HTMLElement>('.cap-side-card'));
      const gap = parseFloat(cs.rowGap) || 0;
      // everything the cards take except the rows themselves, plus the 5px edge under the last card
      const used = cards.reduce((n, c) => n + c.offsetHeight, 0) + gap * Math.max(0, cards.length - 1) + 8;
      const space = avail - (used - list.offsetHeight);
      setMaxRows(Math.max(2, Math.min(4, Math.floor(space / rowH))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(aside);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [missions, missionsReady, leaderboardRows, leaderboardReady, maxRows]);

  return (
    <aside className="cap-col cap-col-right" aria-label="Misiuni și clasament" ref={asideRef}>
      <motion.div
        className="cap-side-card"
        initial={prefersReducedMotion ? undefined : { opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.42, ease: EASE_OUT }}
      >
        <MissionsCard missions={missions} ready={missionsReady} />
      </motion.div>
      <motion.div
        className="cap-side-card"
        initial={prefersReducedMotion ? undefined : { opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.42, delay: 0.08, ease: EASE_OUT }}
      >
        <LeaderboardCard rows={leaderboardRows} ready={leaderboardReady} currentUserId={currentUserId} maxRows={maxRows} />
      </motion.div>
    </aside>
  );
}
