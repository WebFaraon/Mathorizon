export type MobileTab = 'profile' | 'capitole' | 'sidebar';

/** DOM order of the three columns in App.tsx (left, middle, right) — also
    the slide order .cap-three-col's transform uses (see --cap-tab-index
    in styles.css), so this is the one place that mapping is spelled out. */
export const MOBILE_TAB_INDEX: Record<MobileTab, number> = {
  profile: 0,
  capitole: 1,
  sidebar: 2
};
