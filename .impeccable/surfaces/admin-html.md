---
version: 1
slug: "admin-html"
primary_target: "admin.html"
related_targets: []
---

# Consola de admin (admin.html and the admin pages)

Scope: a separate console for the admin role: Acasă, Orar (groups), Elevi (students), Repartizare (rooms × hours), Analitică, Disponibilitate (teacher availability), Profesori (real accounts: approvals, waitlist, plans), plus the existing Adaugă exercițiu and Culegeri pages inside the same shell. An admin lands here after signing in and does not see the student navbar; a "Vezi site-ul" link leads out. Visitor mode: Operate (a dense management tool used all day by office staff of a large tutoring company). Data: generated demo data in the browser (js/admin/mock-data.js, projects Examen.md Offline / Examen.md Online / Matematica.md, rooms, managers, balances); demo edits stay in localStorage; Profesori uses the real Supabase RPCs. Constraints: Romanian copy, no em dash in UI copy, light + dark, responsive down to 390px, no dot-matrix/LCD (that world belongs to students and teachers), no AI-vibe (no gradients, glass, glow, pastel pill soup, big radii, soft shadows).

## Direction contract

THESIS: The console is a station's signage system: every piece of information has a sign. Projects, statuses and days carry fixed color codes like transit lines, pages read at a glance like a platform board, and the place you are is marked the way a station marks "you are here". Refuses the category default of a pastel-card SaaS dashboard with colored KPI tiles and pill badges everywhere.

OWN-WORLD: Off-white ground (dark: near-black), white panels with 1px rules and 2px corners, no soft shadows. One grotesque family (Archivo, variable width): expanded heavy for titles and room/platform numbers, normal for text, tabular figures everywhere. Line colors as narrow bands, never fills: Examen.md Offline violet, Examen.md Online blue, Matematica.md teal. Status as indicator shapes plus color (activ: filled green disc; se completează: half disc amber; înlocuire: swap arrows; inactiv: hollow grey ring). Signal yellow with black only for warnings (conflicts, financial risk) and for "you are here" in navigation. Pictograms are white line icons on black square tiles.

STORY: The admin opens the console, is greeted by name with the date and the station clock, sees what needs attention today (room conflicts, groups at financial risk, groups starting tomorrow, debts) and jumps there; in Repartizare they read the rooms like platforms, spot a yellow-black conflict, and drag a group to a free slot that the board validates; in Orar and Elevi they narrow long lists with filters that stay in the address; in Analitică they read the shape of the business in a few honest charts.

FIRST VIEWPORT (Acasă): a black sign panel on the left (pictogram tiles, page names, the current page on a yellow plate, project switch below), a header with "Bună ziua, <nume>", the date and a large clock; a row of attention signs (each a number and a direct link); tiles to every page; today's lessons by room.

FORM: Signage console. Seed key 05ada60a. Signature interactions: the "you are here" yellow plate in the sign panel; room numbers as platform plates in Repartizare with drag-and-drop between slots and live validation (room clash, teacher clash, teacher availability) and undo; filters that write to the URL; line-colored bands on every group. Motion: rows arrive from the right like a train (short stagger), a moved group settles into its slot, plates highlight on hover with the arrow advancing; reduced motion renders static.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict and DESIGN.md.
