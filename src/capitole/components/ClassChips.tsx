/** Classes shown on the Exerciții hub. Only the ones in READY have exercises yet. */
export const GRADES = [5, 6, 7, 8, 9, 10, 11, 12] as const;
export const READY_GRADES: readonly number[] = [12];

const ROMAN: Record<number, string> = { 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII' };

export function romanGrade(g: number): string {
  return ROMAN[g] ?? String(g);
}

interface ClassChipsProps {
  value: number;
  onChange: (grade: number) => void;
}

/**
 * The class keys at the top of the hub. A class without exercises is still a
 * pressable key (it opens the "se pregătește" plate); it just carries no LED.
 */
export function ClassChips({ value, onChange }: ClassChipsProps) {
  return (
    <div className="cap-grades" role="group" aria-label="Clasă">
      {GRADES.map((g) => {
        const ready = READY_GRADES.includes(g);
        const on = g === value;
        return (
          <button
            key={g}
            type="button"
            className={`cap-grades__key${on ? ' is-on' : ''}${ready ? '' : ' is-soon'}`}
            aria-pressed={on}
            onClick={() => onChange(g)}
          >
            <span className="cap-grades__small">Clasa</span>
            <span className="cap-grades__num">{romanGrade(g)}</span>
          </button>
        );
      })}
    </div>
  );
}
