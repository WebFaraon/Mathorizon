import { useEffect, useState } from 'react';

export interface ProfileSnapshot {
  signedIn: boolean;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  coverUrl: string | null;
  role: 'elev' | 'profesor' | 'admin' | null;
  /** "septembrie 2026"-style, ro-RO locale — null only if created_at is
      somehow missing (shouldn't happen for a real Supabase user). */
  memberSince: string | null;
  /** Lifetime XP from local/DB-synced training stats — the profile panel
      prefers the leaderboard row's own totalXp when one is found (same
      number, but guaranteed consistent with the rank sitting next to it),
      falling back to this before that row is available. */
  totalXp: number;
  dailyStreak: number;
}

const SIGNED_OUT: ProfileSnapshot = {
  signedIn: false,
  displayName: '',
  avatarUrl: null,
  initials: '?',
  coverUrl: null,
  role: null,
  memberSince: null,
  totalXp: 0,
  dailyStreak: 0
};

const MEMBER_SINCE_FORMAT = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' });

function readSnapshot(): ProfileSnapshot {
  const auth = window.BMAuth;
  const user = auth?.user;
  if (!user) return SIGNED_OUT;

  return {
    signedIn: true,
    displayName: auth.displayName(),
    avatarUrl: auth.avatarUrl(),
    initials: auth.initials(),
    coverUrl: user.user_metadata?.custom_cover_url ?? null,
    role: auth.role,
    memberSince: user.created_at ? MEMBER_SINCE_FORMAT.format(new Date(user.created_at)) : null,
    totalXp: window.BM?.Training?.getTotalXp?.() ?? 0,
    dailyStreak: window.BM?.Storage?.getStreak().count ?? 0
  };
}

/**
 * The profile panel's own data source — name/photo/cover/role/join-date/XP/
 * streak, none of which useCapitoleData reads (that hook is chapter-progress
 * only, shared with the chapter grid). Same read-window.BM-globals-then-
 * re-run-on-bmauth:synced idiom as useLeaderboard/useMissions, but with no
 * async call of its own (everything here is a synchronous global read)
 * there's no real "loading" phase to gate on — a guest and a not-yet-
 * resolved real session look identical on the very first read, and both
 * simply read as signedIn:false until bmauth:synced fires (which only ever
 * happens for the latter).
 */
export function useProfileSnapshot(): ProfileSnapshot {
  const [data, setData] = useState<ProfileSnapshot>(() => readSnapshot());

  useEffect(() => {
    const refresh = () => setData(readSnapshot());
    document.addEventListener('bmauth:synced', refresh);
    return () => document.removeEventListener('bmauth:synced', refresh);
  }, []);

  return data;
}
