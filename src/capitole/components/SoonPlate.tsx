import { READY_GRADES, romanGrade } from './ClassChips';

interface SoonPlateProps {
  grade: number;
  onPickReady: (grade: number) => void;
}

/** A class without exercises yet: a quiet plate with two ways forward. */
export function SoonPlate({ grade, onPickReady }: SoonPlateProps) {
  return (
    <div className="cap-soonplate">
      <div className="cap-soonplate__text">
        <b>Exercițiile pentru clasa a {romanGrade(grade)}-a se pregătesc</b>
        <span>Până atunci, lecțiile scurte din Învață te țin în ritm.</span>
      </div>
      <div className="cap-soonplate__keys">
        <a className="cap-soonplate__key cap-soonplate__key--go" href="parcurs.html">Mergi la Învață</a>
        {READY_GRADES.map((ready) => (
          <button type="button" className="cap-soonplate__key" key={ready} onClick={() => onPickReady(ready)}>
            Vezi clasa a {romanGrade(ready)}-a
          </button>
        ))}
      </div>
    </div>
  );
}
