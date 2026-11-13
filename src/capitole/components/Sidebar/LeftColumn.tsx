/**
 * Left rail. The profile card itself is drawn by js/rail.js (the same card on every page of the site, so it
 * stays put when the tab changes), into this <aside id="appRail">. React only keeps the place: in the phone and stacked
 * layouts it is the "Profil" pane, on wide screens rail.css fixes it to the left of the viewport.
 */
export function LeftColumn() {
  return <aside id="appRail" className="cap-col cap-col-left" aria-label="Profilul tău" />;
}
