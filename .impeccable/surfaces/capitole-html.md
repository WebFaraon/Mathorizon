---
version: 1
slug: "capitole-html"
primary_target: "capitole.html"
related_targets: ["partials/nav.html"]
---

# Capitole (capitole.html)

Scope: the signed-in home tab (React island in src/capitole/) plus the shared navbar (partials/nav.html, nav rules in css/style.css), which every tab renders. Visitor mode: Operate. Audience: grade XII BAC students choosing what to practice today; teachers occasionally. Constraints: keep the three columns (profile left, chapters middle, missions + leaderboard right), all content and functions, Romanian copy verbatim, light + dark themes, brand blue primary, existing logo. Balanced gamification: progress and missions carry real weight, chapters stay the center. User rejects: rounded soft-shadow cards, gradients/glass/neon, and empty minimalism.

## Direction contract

THESIS: The page is an instrument, a scientific calculator: chapters are keys you press, your numbers live on an LCD readout that answers the key under your finger. Refuses the category default of rounded white cards with soft shadows floating on a cream wash.

OWN-WORLD: Graphite and pale-gray chassis panels with hard 1px edges and 2 to 4px corners; keys with a solid darker bottom edge (rest), dim on hover, sink on press. A green-gray LCD (backlit dark in dark theme) with dot-matrix digits and faint unlit ghost cells. Four legend colors with jobs, like calculator function labels: blue (brand, primary key, Algebră), orange (XP only), green (Geometrie, done), red (Analiză). Condensed-grotesk key legends, dot-matrix numerals, strict tabular grid.

STORY: In one glance the student reads how much of the bank they have solved, sees each chapter's real exercise matrix with solved cells lit, notices where they worked last, and presses a chapter key to continue. Missions read as segmented counters that fill toward an XP reward.

FIRST VIEWPORT: Dark graphite nav strip (logo, tab keys with the active one lit blue, token/streak as a small LCD). Middle column: h1 left-aligned, then a wide LCD panel: annunciator row (XII lit, IX ghosted "în curând"), an input line that types the rotating phrase with a blinking cursor, and a right-aligned big dot-matrix result "6 / 652 rezolvate". Below it the 2x2 keypad of chapter keys, each with symbol legend, name, description, subcategory legends, and a dot matrix (one dot per exercise). Left rail profile panel, right rail missions and leaderboard as chassis panels.

FORM: Calculatorul științific, position 7 on the ordered list (1 foaia de examen BAC, 2 caietul cu pătrățele, 3 catalogul școlar, 4 tabla, 5 culegerea, 6 manualul EDP, 7 calculatorul). Seed key 41d37bbb. Signature interaction: hovering or focusing a chapter key writes that chapter's readout onto the LCD (name, solved/total, percent) and brightens its matrix; pressing sinks the key. Motion grammar: LCD refresh steps (no count-ups), one scan-sweep lighting solved dots on first view, key sink on press; reduced motion renders static.

Raises: from the catalog grid, the real per-exercise dot matrix; from the cutting bench, state as a mark (check for done, cut legend for "în curând", a flag on the chapter you worked last); from the ASCII grid, strict tabular numerals; from the parametric identity, one color rule for every accent.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
