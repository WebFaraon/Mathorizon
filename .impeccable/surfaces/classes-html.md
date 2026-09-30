---
version: 1
slug: "classes-html"
primary_target: "classes.html"
related_targets: []
---

# Clase (classes.html, main tab)

Scope: the Clase tab's main page only: the teacher view (totals, list of classes, invite codes, day filter, delete, "Creează clasă" and its create-class modal) and the student view (join by code, enrolled classes, leave). NOT class.html (a single class). Visitor mode: Operate. Audience: Romanian teachers running small private math groups, and their students (grades V to XII). Constraints: keep every function and Supabase call (join, leave, create, delete, day filter in localStorage, copy code, cached first paint), Romanian copy, no em dash in UI copy, light + dark, calculator world from DESIGN.md.

## Direction contract

THESIS: A class group is a line in a register: who, when, how full, and the code to get in, all readable on one row. The page is the teacher's (and the student's) class register set on the calculator chassis, with a display on top that totals it. Refuses the category default of a grid of soft rounded cards with icon-badge KPI tiles.

OWN-WORLD: The shared calculator world: graph-paper chassis ground, panel and key faces with hard 1px edges and 3-4px corners, keys that sink when pressed, green-gray LCD (backlit in dark) with dot-matrix numerals left-aligned, the navbar's calm blue. The register is a printed sheet on the chassis (same sheet as the exam structure): ruled rows, a header row of small labels, an LCD chip for the code, occupancy as a row of LCD segments.

STORY: A teacher opens the page, reads the totals (groups, active students, lessons held, average attendance), scans the register for the group they need, copies its code or opens it, and presses "Creează clasă" to add a new one. A student types the six-character code into a code display, presses Alătură-te, and sees their groups with the teacher, the schedule and when they joined.

FIRST VIEWPORT: Title and lede left, the day-filter key and the blue "Creează clasă" key right. Below, a wide LCD with four left-aligned dot-matrix totals. Below, the register: header labels (Grupă, Program, Ocupare, Cod), one ruled row per class, each with an index, the subject and grade, the days and hour, occupancy segments with the count, the code in an LCD chip with a copy key, a delete key and a chevron. Student: the code display with six cells and the join key take the place of the create key, the register lists teacher, schedule, joined date and the leave link.

FORM: Registrul de clase, dealt option 1 of 3 (registru, consolă cu coloană de statistici, orarul săptămânii). Seed key 3bce3f20. Signature interaction: the register prints in row by row, the occupancy segments light one by one, the totals tick up to their value on the display, the copy key flips to a check, a deleted row slides out before the list re-flows, a new class lands highlighted at the top. The create-class modal is a chassis panel with numbered steps on the left and a live "ticket" display on the right that assembles the class (subject, days, hour, seats as segments, the generated name) as you choose; six progress segments show what is still missing; choices are keys (seats, grade, level, lesson type, days), not selects.

MOTION: load sequence (status LCD segment test, then rows printed), stepped LCD tick-up, segment light-up, key press sink, modal rises with a blurred backdrop and its sections stagger in, preview lines refresh with a short blink. Reduced motion renders static.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict and DESIGN.md.
