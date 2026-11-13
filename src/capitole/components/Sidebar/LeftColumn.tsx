/**
 * Left rail. On wide screens the profile card is the fixed panel of js/rail.js (the same on every tab, drawn into
 * <aside id="appRail"> in <body>), so this column is hidden by css/rail.css. In the stacked and phone layouts it is the
 * "Profil" pane: rail.js draws the same card into this <aside id="appRailMount">.
 */
export function LeftColumn() {
  return <aside id="appRailMount" className="cap-col cap-col-left" aria-label="Profilul tău" />;
}
