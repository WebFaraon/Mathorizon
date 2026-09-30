---
version: 1
slug: "bac-html"
primary_target: "bac.html"
related_targets: []
---

# Simulare (bac.html, setup flow)

Scope: the Simulare tab's setup flow: step 1 (choose BAC or Evaluare Națională), step 2 (the expanded setup page with the exam structure, the answer-method pick and the start key) and the ExamToken confirmation dialog. NOT the exam view or the results view. Visitor mode: Operate. Audience: grade XII students (BAC) and grade IX (Evaluare Națională). Constraints: keep the flow and every function (selectSimType, selectAnswerMethod, startExam, token gating, backToChoose), Romanian copy, light + dark, calculator world from DESIGN.md. Retired terminology: exercise levels are rarity (Comun / Rar / Epic), not Ușor / Mediu / Greu.

## Direction contract

THESIS: An ExamToken is literally the ticket that gets you into the exam room, so each exam is a ticket: two large perforated tickets (BAC, Evaluare Națională) on the chassis, with the exam's figures on a small display, under one display that shows the student's own situation. Refuses the category default of two gradient hero halves with glass chips.

OWN-WORLD: The shared calculator world: graph-paper chassis ground, panel and key faces with hard 1px edges and 3-4px corners, keys that sink when pressed, green-gray LCD (backlit in dark) with dot-matrix numerals, the navbar's calm blue. A ticket is a key-face card with notched side edges (the same notch mask as the profile tokens) and a perforation line, a rarity-neutral face, blue for BAC and a second legend color for Evaluare Națională (green, the world's second legend color; never purple).

STORY: The student sees at once what they have (tokens, simulations done, best grade), picks the exam that is theirs, reads its three figures, and presses Selectează; on the next page they see the structure of the exam (12 exercises with rarity and points), choose how they will answer, and press start; the dialog names the token cost.

FIRST VIEWPORT: Top, a wide LCD: "Situația ta" with three fields (simulations finished, best grade, ExamTokens), left-aligned dot-matrix figures from real data (bac-history in localStorage, BM.getTokens, BMAuth.role for admin ∞). Below, two equal tickets side by side: exam title, a one-line description, three LCD fields (exerciții, puncte, timp), the Selectează key at the foot. The ticket's notches sit on its sides, the perforation above the foot.

FORM: Biletul de examen, position 3 on the ordered list (1 console with structure screen, 2 split hero, 3 tickets, 4 sheets, 5 tab strip, 6 timeline, 7 wizard). Seed key 3010d1c8. Signature interaction: a ticket tilts toward the pointer a few degrees and lifts its perforation into view, and pressing it sinks it as a key. Motion grammar: load sequence (situation LCD runs the segment test, the tickets are dealt onto the table one after the other), stepped display refreshes, key press sink; step 1 to step 2 slides the ticket that was chosen; reduced motion renders static.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
