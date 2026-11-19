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
  /** The Misiuni page shows the missions in its own middle column, so the rail keeps only Top elevi. */
  hideMissions?: boolean;
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
  currentUserId,
  hideMissions = false
}: RightColumnProps) {
  const prefersReducedMotion = useReducedMotion();
  const asideRef = useRef<HTMLElement | null>(null);
  // Places shown after the podium in the leaderboard card: 2 when there is room, fewer on a short window.
  const [maxRows, setMaxRows] = useState(2);
  const rowH = useRef(0);
  const dataRef = useRef({ rows: leaderboardRows, me: currentUserId });
  dataRef.current = { rows: leaderboardRows, me: currentUserId };

  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const fit = () => {
      if (getComputedStyle(aside).position !== 'fixed') { setMaxRows(2); return; }   // stacked layouts scroll with the page
      const list = aside.querySelector<HTMLElement>('.lb-list');
      const first = list && (list.querySelector('.lb-row') as HTMLElement | null);
      if (first && first.offsetHeight) rowH.current = first.offsetHeight + 6;
      const h = rowH.current || 56;
      const cs = getComputedStyle(aside);
      const avail = aside.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const cards = Array.from(aside.querySelectorAll<HTMLElement>('.cap-side-card'));
      const gap = parseFloat(cs.rowGap) || 0;
      // everything the cards take except the rows of the list, plus the 5px edge under the last card
      // the missions card shrinks and scrolls on a short window, so its content height counts, but at most 330px (it gives way to the podium card before the places after the podium do)
      const used = cards.reduce((n, c) => n + (c.querySelector('.lb-card') ? c.offsetHeight : Math.min(c.scrollHeight, 330)), 0) + gap * Math.max(0, cards.length - 1) + 8;
      const inList = aside.querySelectorAll('.lb-list--card .lb-row, .lb-list--card .lb-gap').length;
      const base = used - inList * h - (inList ? 8 : 0);
      // the largest number of places after the podium whose rows (plus your own, when you are further down) still fit
      const all = dataRef.current.rows;
      const meId = dataRef.current.me;
      const me = meId ? all.find((r) => r.userId === meId) : undefined;
      let best = 0;
      for (const m of [2, 1]) {
        const shownPlaces = Math.min(m, Math.max(0, all.length - 3));
        const need = shownPlaces + (me && me.rank > 3 + shownPlaces ? 1 : 0);
        if (base + need * h + (need ? 8 : 0) <= avail) { best = m; break; }
      }
      setMaxRows(best);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(aside);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [missions, missionsReady, leaderboardRows, leaderboardReady, maxRows]);

  return (
    <aside className="cap-col cap-col-right" aria-label="Misiuni și clasament" ref={asideRef}>
      {!hideMissions && (
        <motion.div
          className="cap-side-card"
          initial={prefersReducedMotion ? undefined : { opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.42, ease: EASE_OUT }}
        >
          <MissionsCard missions={missions} ready={missionsReady} />
        </motion.div>
      )}
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
