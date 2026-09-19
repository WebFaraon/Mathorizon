/**
 * Clasa a XII-a / a IX-a switch.
 *
 * There is nothing to actually switch YET: BM.EXERCISES (js/data.js) has
 * no grade field at all — the whole catalog is implicitly the BAC (12th
 * grade) track, exactly like index.html's own landing page already tells
 * visitors ("Clasa a 9-a — Lucrăm la exerciții și teste... te anunțăm
 * primul"). So "a XII-a" is the real, active, already-selected state, and
 * "a IX-a" is visibly present but inert — same treatment locked chapter
 * cards get (see ChapterCard.tsx's cap-card--soon) — rather than a toggle
 * that would silently do nothing or, worse, switch to an empty page.
 *
 * The active option's press feedback is plain CSS (:active in
 * styles.css), not Framer Motion — see .cap-btn there for why mixing the
 * two for a single press animation caused the shadow and the button's own
 * movement to fall out of sync.
 */
export function GradeSwitch() {
  return (
    <div className="cap-grade-switch" role="group" aria-label="Clasă">
      <button type="button" className="cap-grade-switch__option cap-grade-switch__option--active" aria-pressed="true">
        Clasa a XII-a
      </button>
      <button
        type="button"
        className="cap-grade-switch__option cap-grade-switch__option--soon"
        aria-pressed="false"
        disabled
        title="Clasa a IX-a — în curând"
      >
        Clasa a IX-a
        <span className="cap-grade-switch__badge">În curând</span>
      </button>
    </div>
  );
}
