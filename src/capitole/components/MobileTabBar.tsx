import { User, LayoutGrid, Trophy } from 'lucide-react';
import type { MobileTab } from '../lib/mobile-tabs';

interface MobileTabBarProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}

const TABS: { key: MobileTab; label: string; Icon: typeof User }[] = [
  { key: 'profile', label: 'Profil', Icon: User },
  { key: 'capitole', label: 'Capitole', Icon: LayoutGrid },
  { key: 'sidebar', label: 'Misiuni', Icon: Trophy }
];

/**
 * Fixed bottom nav, phone widths only (see .cap-tabbar in styles.css —
 * display:none above the breakpoint, so this always renders, CSS just
 * hides it). Swaps which of the three columns is in view by driving
 * --cap-tab-index on .cap-three-col (see App.tsx) rather than mounting/
 * unmounting anything — every column's own data hooks keep running
 * regardless of which tab is active, so switching back to one never
 * shows a stale/reloading state.
 */
export function MobileTabBar({ active, onChange }: MobileTabBarProps) {
  return (
    <nav className="cap-tabbar" aria-label="Navigare rapidă">
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          className={`cap-tabbar__btn${active === key ? ' cap-tabbar__btn--active' : ''}`}
          onClick={() => onChange(key)}
          aria-current={active === key ? 'page' : undefined}
        >
          <Icon className="cap-tabbar__icon" aria-hidden="true" />
          <span className="cap-tabbar__label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
