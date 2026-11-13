import { useEffect, useState } from 'react';
import { Heart, History, Target, ChevronRight } from 'lucide-react';

type Kind = 'fav' | 'hist' | 'mis';

interface Counts {
  fav: number;
  hist: number;
  mis: number;
}

declare global {
  interface Window {
    BMCollections?: Partial<Record<Kind, () => void>>;
  }
}

function readCounts(): Counts {
  const st = window.BM?.Storage as unknown as
    | {
        getFavorites(): string[];
        getHistory?(): unknown[];
        getMistakes?(): Record<string, unknown>;
      }
    | undefined;
  if (!st) return { fav: 0, hist: 0, mis: 0 };
  return {
    fav: st.getFavorites().length,
    hist: st.getHistory ? st.getHistory().length : 0,
    mis: st.getMistakes ? Object.keys(st.getMistakes()).length : 0
  };
}

const ROWS: { kind: Kind; title: string; text: string; Icon: typeof Heart; tone: string }[] = [
  { kind: 'fav', title: 'Favorite', text: 'Exercițiile pe care le-ai marcat cu inimioară.', Icon: Heart, tone: 'rose' },
  { kind: 'hist', title: 'Istoric rezolvări', text: 'Ce ai rezolvat în ultima vreme.', Icon: History, tone: 'violet' },
  { kind: 'mis', title: 'Greșelile mele', text: 'Exercițiile la care ai greșit și nu le-ai reluat încă.', Icon: Target, tone: 'amber' }
];

/** "30+" past 30, so a long list does not stretch the badge. */
function badge(n: number): string {
  return n > 30 ? '30+' : String(n);
}

/**
 * "Colecțiile tale": three ruled rows. Each opens the side panel js/app.js owns
 * (the same panels the navbar hearts and clock open), so there is one list per
 * collection and no second implementation here.
 */
export function Collections() {
  const [counts, setCounts] = useState<Counts>(readCounts);

  useEffect(() => {
    const refresh = () => setCounts(readCounts());
    document.addEventListener('bmauth:synced', refresh);
    document.addEventListener('bm:collections-changed', refresh);
    window.addEventListener('pageshow', refresh);
    refresh();
    return () => {
      document.removeEventListener('bmauth:synced', refresh);
      document.removeEventListener('bm:collections-changed', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  return (
    <section className="cap-coll" aria-labelledby="capCollTitle">
      <h2 className="cap-sec-title" id="capCollTitle">Colecțiile tale</h2>
      <div className="cap-coll__list">
        {ROWS.map(({ kind, title, text, Icon, tone }) => (
          <button
            key={kind}
            type="button"
            className={`cap-coll__row cap-coll__row--${tone}`}
            onClick={() => window.BMCollections?.[kind]?.()}
          >
            <span className="cap-coll__icon" aria-hidden="true"><Icon /></span>
            <span className="cap-coll__text">
              <b>{title}</b>
              <small>{text}</small>
            </span>
            <span className={`cap-coll__count${counts[kind] === 0 ? ' is-zero' : ''}`}>{badge(counts[kind])}</span>
            <ChevronRight className="cap-coll__go" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
