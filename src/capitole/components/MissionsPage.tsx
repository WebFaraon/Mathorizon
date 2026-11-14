import { useEffect, useRef, useState } from 'react';
import type { MissionProgress } from '../lib/missions';
import type { LeaderboardRow } from '../hooks/useLeaderboard';
import { LeaderboardCard } from './Sidebar/LeaderboardCard';

interface MissionsPageProps {
  missions: MissionProgress[];
  ready: boolean;
  leaderboardRows: LeaderboardRow[];
  leaderboardReady: boolean;
  currentUserId: string | null;
}

/** Time until local midnight, when the daily missions start over: "5 ore" / "42 min". */
function timeLeft(): string {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const min = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 60000));
  if (min >= 60) {
    const h = Math.ceil(min / 60);
    return `${h} ${h === 1 ? 'oră' : 'ore'}`;
  }
  return `${min} min`;
}

/**
 * The Misiuni tab (misiuni.html): a banner with the owl, the daily missions as full-width cards (the main ones are lessons
 * finished on the Învață path, the extra ones are exercises), and a plate for the missions that are not ready yet.
 * On laptops the Top elevi card stays in the right rail; on a phone there is no rail, so it is repeated at the bottom (.ms-lb).
 */
export function MissionsPage({ missions, ready, leaderboardRows, leaderboardReady, currentUserId }: MissionsPageProps) {
  const owlRef = useRef<HTMLDivElement | null>(null);
  const [left, setLeft] = useState(timeLeft);

  useEffect(() => {
    const t = window.setInterval(() => setLeft(timeLeft()), 30000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    const el = owlRef.current;
    const w = window as unknown as { BMOwl?: { mount(el: HTMLElement, mood: string, o: object): void } };
    if (el && w.BMOwl) { try { w.BMOwl.mount(el, 'happy', {}); } catch { /* the owl is decoration */ } }
  }, []);

  const doneCount = missions.filter((m) => m.done).length;

  return (
    <div className="ms-page">
      <section className="ms-banner" aria-label="Misiuni">
        <div className="ms-banner__tx">
          <h1>Misiunile tale</h1>
          <p>Termină lecții și câștigă XP. Misiunile se reiau în fiecare zi.</p>
        </div>
        <div className="ms-banner__owl"><div className="owl" data-owl-theme="dark" ref={owlRef} /></div>
      </section>

      <div className="ms-head">
        <h2>Misiunile zilei</h2>
        <span className="ms-timer" title="Timp rămas până la miezul nopții">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          {left}
        </span>
      </div>
      {ready && <p className="ms-sum">{doneCount} din {missions.length} terminate azi</p>}

      <ul className="ms-list">
        {(ready ? missions : []).map((m) => {
          const pct = Math.round((m.progress / m.target) * 100);
          return (
            <li className={`ms-card${m.done ? ' ms-card--done' : ''}`} key={m.key}>
              <img className="ms-card__ico" src={m.kind === 'lesson' ? 'assets/images/tabs/invata.svg' : 'assets/images/tabs/exercitii.svg'} alt="" />
              <div className="ms-card__body">
                <div className="ms-card__row">
                  <span className="ms-card__title">{m.title}</span>
                  <span className="ms-card__xp">+{m.xpReward} XP</span>
                </div>
                <div className="ms-bar" role="progressbar" aria-valuemin={0} aria-valuemax={m.target} aria-valuenow={m.progress} aria-label={m.title}>
                  <i style={{ width: `${pct}%` }} />
                  <span>{m.progress} / {m.target}</span>
                </div>
              </div>
              <img className={`ms-card__gift${m.done ? ' is-done' : ''}`} src="assets/images/gamification/cadou.svg" alt="" />
            </li>
          );
        })}
      </ul>

      <div className="ms-soon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="3" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        <div>
          <b>Misiuni săptămânale și lunare</b>
          <span>Se pregătesc. Vor apărea aici, cu recompense mai mari.</span>
        </div>
      </div>

      <div className="ms-lb">
        <div className="cap-side-card">
          <LeaderboardCard rows={leaderboardRows} ready={leaderboardReady} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
}
