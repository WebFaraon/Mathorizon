import { useEffect, useState } from 'react';

export interface StudentClassState {
  /** Most recently joined class's name, or null if enrolled in none (or
      not a student — see `enabled`). A student can belong to more than one
      class (js/classes-page.js's own student view lists all of them); the
      profile panel only has room to name one, so this picks the newest. */
  className: string | null;
  ready: boolean;
}

const EMPTY: StudentClassState = { className: null, ready: false };

interface ClassMemberRow {
  joined_at: string;
  classes: { name: string } | null;
}

/**
 * Same query js/classes-page.js's renderStudentView() already runs for the
 * "Clasele mele" tab — a plain embedded select, not an RPC: a student
 * reading their OWN class_members/classes rows doesn't hit the
 * owner-only-RLS wall get_xp_leaderboard exists to work around (see
 * useLeaderboard.ts's comment). Only ever queried for role:'elev' — a
 * teacher/admin's own classes are a different relationship (classes.teacher_id).
 */
export function useStudentClass(enabled: boolean): StudentClassState {
  const [state, setState] = useState<StudentClassState>(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setState({ className: null, ready: true });
      return;
    }

    let cancelled = false;

    const run = async () => {
      const auth = window.BMAuth;
      const sb = auth?.supabase;
      if (!auth?.user || !sb) {
        if (!cancelled) setState({ className: null, ready: true });
        return;
      }

      try {
        const { data, error } = await sb
          .from('class_members')
          .select('joined_at, classes ( name )')
          .eq('student_id', auth.user.id)
          .order('joined_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        const rows = (data ?? []) as unknown as ClassMemberRow[];
        if (!cancelled) setState({ className: rows[0]?.classes?.name ?? null, ready: true });
      } catch {
        if (!cancelled) setState({ className: null, ready: true });
      }
    };

    void run();
    document.addEventListener('bmauth:synced', run);
    return () => {
      cancelled = true;
      document.removeEventListener('bmauth:synced', run);
    };
  }, [enabled]);

  return state;
}
