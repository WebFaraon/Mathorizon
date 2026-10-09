---
name: Mathorizon
description: BAC math practice built as a scientific calculator, keys you press and an LCD that answers.
colors:
  chassis: "#E3E4DF"
  panel: "#F0F1ED"
  panel-edge: "#C3C6BD"
  key: "#FBFBF8"
  key-edge: "#B4B8AE"
  rule: "#D3D6CE"
  grid: "rgba(23, 25, 28, 0.065)"
  ink: "#17191C"
  ink-2: "#464B52"
  ink-3: "#5E646B"
  ink-soft: "#5D636A"
  ghost: "rgba(23, 25, 28, 0.11)"
  lcd: "#C3CDB0"
  lcd-ink: "#1C2718"
  lcd-dim: "rgba(28, 39, 24, 0.66)"
  lcd-ghost: "rgba(28, 39, 24, 0.09)"
  bezel: "#2A2E33"
  blue: "#2F5FD0"
  blue-edge: "#1B3A8A"
  blue-wash: "rgba(47, 95, 208, 0.09)"
  green: "#1D7A57"
  red: "#BF3D29"
  orange: "#DE6A1E"
  orange-ink: "#A94A0B"
  dark-chassis: "#111316"
  dark-panel: "#181B1F"
  dark-panel-edge: "#2B2F35"
  dark-key: "#23272D"
  dark-key-edge: "#08090B"
  dark-rule: "#262A30"
  dark-grid: "rgba(236, 237, 233, 0.04)"
  dark-ink: "#ECEDE9"
  dark-ink-2: "#B5BAC0"
  dark-ink-3: "#8D939A"
  dark-ink-soft: "#9AA0A7"
  dark-lcd: "#141B11"
  dark-lcd-ink: "#BCE296"
  dark-bezel: "#050607"
  dark-blue: "#5C8CF2"
  dark-blue-edge: "#1E3B86"
  dark-green: "#4DBE8E"
  dark-red: "#EE7560"
  dark-orange: "#F08A3C"
  dark-orange-ink: "#F4A25F"
  nav-chassis: "#3A5A9F"
  nav-chassis-edge: "#2A4478"
  nav-key: "#4665A9"
  nav-key-border: "#5874B3"
  nav-key-edge: "#263F72"
  nav-ink: "#F1F4FA"
  nav-lit: "#FFFFFF"
  nav-lit-ink: "#2E4C8F"
  nav-lit-edge: "#B4C1DC"
  nav-lcd: "#D3DCC3"
  nav-lcd-low: "#E7D8A2"
  nav-lcd-empty: "#EBC3B9"
  dark-nav-chassis: "#1F2F52"
  dark-nav-chassis-edge: "#121C33"
  dark-nav-key: "#2A3C63"
  dark-nav-key-border: "#374A73"
  dark-nav-key-edge: "#0F172C"
  dark-nav-ink: "#DDE3F0"
  dark-nav-lit: "#E6EAF3"
  dark-nav-lit-ink: "#27427F"
  dark-nav-lit-edge: "#7F8DAD"
  dark-nav-lcd: "#B8C3A6"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 2.5vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.028em"
  lcd-figure:
    fontFamily: "Doto, monospace"
    fontSize: "clamp(2.6rem, 4.6vw, 3.6rem)"
    fontWeight: 900
    lineHeight: 0.9
    fontFeature: "'tnum' 1"
  lcd-small:
    fontFamily: "Doto, monospace"
    fontSize: "1.45rem"
    fontWeight: 900
    lineHeight: 1
    fontFeature: "'tnum' 1"
  headline:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 800
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "1.12rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "0.64rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.08em"
  math-legend:
    fontFamily: "KaTeX_Main, 'Cambria Math', 'Times New Roman', serif"
    fontSize: "2.3rem"
    lineHeight: 1
rounded:
  cell: "1px"
  panel: "3px"
  key: "4px"
spacing:
  key-edge: "4px"
  button-edge: "3px"
  gap-sm: "8px"
  gap-md: "16px"
  gap-lg: "24px"
  panel-pad: "20px"
  section-gap: "28px"
  grid-cell: "28px"
  rail: "340px"
components:
  button-key:
    backgroundColor: "{colors.key}"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    padding: "0 18px"
    height: "40px"
  button-key-primary:
    backgroundColor: "{colors.blue}"
    textColor: "#ffffff"
    rounded: "{rounded.key}"
    padding: "0 18px"
    height: "40px"
  button-key-sm:
    height: "36px"
  chapter-key:
    backgroundColor: "{colors.key}"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    padding: "16px 18px 14px"
  bank-strip:
    backgroundColor: "{colors.ghost}"
    rounded: "{rounded.cell}"
    height: "14px"
  chassis-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "20px"
  lcd-display:
    backgroundColor: "{colors.lcd}"
    textColor: "{colors.lcd-ink}"
    rounded: "{rounded.panel}"
    padding: "12px 18px 14px"
  nav-tab:
    backgroundColor: "{colors.nav-key}"
    textColor: "{colors.nav-ink}"
    rounded: "{rounded.key}"
    padding: "0 16px"
    height: "38px"
  nav-tab-active:
    backgroundColor: "{colors.nav-lit}"
    textColor: "{colors.nav-lit-ink}"
    rounded: "{rounded.key}"
  nav-counter:
    backgroundColor: "{colors.nav-lcd}"
    textColor: "{colors.lcd-ink}"
    rounded: "{rounded.panel}"
---

# Design System: Mathorizon

## Overview

**Creative North Star: "The Scientific Calculator"**

Mathorizon is built as an instrument, not a brochure. Every surface is a part of a scientific calculator: pale-gray (light) or graphite (dark) chassis panels with hard 1px edges and near-square corners, keys that stand on a darker solid bottom edge and sink when pressed, and a recessed green-gray LCD that carries the numbers that matter, all laid on the site's graph-paper ground. The student reads their progress off the display and presses a chapter key to continue; the interface is operated, not browsed.

Density is high and tabular. Chapters are laid out as a keypad, each exercise bank is drawn honestly as a bank strip (one segment per subcategory, sized by its exercise count, filled by the share solved), missions are segmented counters, and numerals are always tabular. Color is not decoration: four legend colors each have one job, the way function labels are printed on a real calculator. Motion is the motion of hardware: the page powers on (the LCD runs a segment test, keys land on their edges, strips fill), a key sinks, an LCD refreshes in stepped frames. Numbers never tween, and nothing glows or floats.

Scope: this system currently covers the Capitole tab (`capitole.html`, the React island in `src/capitole/`), the chapter page's subchapter view (`category.html`, styled in `css/calculator.css`) and the shared navbar (`partials/nav.html`, the "NAVBAR — calculator skin" block at the end of `css/style.css`). Since then the landing page, the profile, the sign-in page (`auth.html`), the Simulare setup flow, the Clase main page and a single class (`class.html`) have joined it; the other tabs (Antrenament, Pachete, admin, the exam and results views, the class whiteboard and simulation runner) still render the legacy look from `css/style.css`. This file describes the world those tabs are meant to move into; it does not describe their current state. Rejected by the user for this world: rounded soft-shadow cards, gradients, glass, neon, and empty minimalism.

**Key Characteristics:**
- Chassis panels: flat fills, 1px edges, 3px corners, no drop shadows, on a 28px graph-paper ground.
- Keys: solid darker bottom edge at rest, brightness dim on hover, sink on press.
- LCD surfaces carry the key numbers, set in Doto dot-matrix, over a faint unlit pixel lattice.
- Plus Jakarta Sans, the site face, for all display and UI type; weight carries the hierarchy.
- Four legend colors with fixed jobs; everything else is ink on chassis.
- The navbar is a solid brand-blue strip with a white lit key and a pale classic LCD.
- A power-on motion sequence, gated by reduced motion; displays step, never tween.
- Light and dark themes are both fully tokenized; dark is a backlit night mode, not an inversion.

## Colors

A neutral warm-gray chassis with ink text, one green-gray LCD, four saturated legend colors used only for their assigned jobs, and a brand-blue top strip.

### Primary
- **Key Blue** (#2F5FD0; dark #5C8CF2): the brand color and the primary key. Lit keys on the chassis (active grade, primary buttons, active phone tab), focus rings, the hero title accent line, the "last worked here" mark, the current user's leaderboard rank, and the Algebră legend. Its bottom edge is **Blue Edge** (#1B3A8A; dark #1E3B86). The current user's leaderboard row sits on **Blue Wash** (9% blue; 12% in dark).

### Secondary
- **Done Green** (#1D7A57; dark #4DBE8E): completion and the Geometrie legend. Done marks, completed mission checks and their filled cells.
- **Analiză Red** (#BF3D29; dark #EE7560): the Analiză legend only.

### Tertiary
- **XP Orange** (#DE6A1E; dark #F08A3C): XP and nothing else. The XP section icon and the reward mark of a completed mission. XP figures in text use **XP Orange Ink** (#A94A0B; dark #F4A25F) for contrast on the chassis.

### Neutral
- **Chassis** (#E3E4DF; dark #111316): the page ground behind everything, ruled with **Grid** lines (6.5% ink; 4% pale ink in dark) into 28px graph-paper squares.
- **Panel** (#F0F1ED; dark #181B1F): side rails, modals, the phone tab bar.
- **Panel Edge** (#C3C6BD; dark #2B2F35): the 1px edge on every panel and key.
- **Key Face** (#FBFBF8; dark #23272D) with **Key Edge** (#B4B8AE; dark #08090B): the face and bottom edge of every neutral key.
- **Rule** (#D3D6CE; dark #262A30): internal dividers inside panels and keys.
- **Ink** (#17191C; dark #ECEDE9), **Ink 2** (#464B52; dark #B5BAC0), **Ink 3** (#5E646B; dark #8D939A): primary text, secondary text (descriptions, leaderboard streak flames), and tertiary text (counts, labels, disabled "în curând" states). **Ink Soft** (#5D636A; dark #9AA0A7) is the legend fallback for a chapter with no assigned legend color.
- **Ghost** (11% ink; 9% in dark): unlit bank-strip segments, empty mission cells, avatar placeholders.
- **LCD Glass** (#C3CDB0; dark backlit #141B11) with **LCD Ink** (#1C2718; dark #BCE296), **LCD Dim** and **LCD Ghost** (unlit segments and the pixel lattice): every display surface on the chassis.
- **Bezel** (#2A2E33; dark #050607): the frame around the main LCD and the empty-state LCDs.
- **Cover** (#3A5A9F; dark #1F3160): the profile cover strip when the user has no cover photo, the navbar's own blue.
- **Nav strip** (#3A5A9F; dark #1F2F52, with a 1px edge #2A4478; dark #121C33): the navbar is a solid, calm (desaturated) blue top strip. Its keys are a lighter blue (#4665A9, border #5874B3, edge #263F72; dark #2A3C63 / #374A73 / #0F172C) with **Nav Ink** (#F1F4FA; dark #DDE3F0). The lit key is white (#FFFFFF; dark #E6EAF3) with blue ink (#2E4C8F; dark #27427F) and a pale-blue edge (#B4C1DC; dark #7F8DAD). Its counters are a pale classic LCD (#D3DCC3; dark #B8C3A6) with LCD Ink digits in both themes; low tints the glass amber (#E7D8A2) and empty tints it red (#EBC3B9).

### Named Rules
**The Legend Rule.** Each legend color has exactly one job set: blue is primary action and Algebră, green is done and Geometrie, red is Analiză, orange is XP. A chapter's color comes from this map, never from the older per-category colors in `js/data.js`. A new chapter without an assigned legend falls back to Ink Soft, not to a fifth hue.

**The Orange Is Earned Rule.** Orange appears only where XP is shown or awarded. It never marks navigation, state, a streak, or a chapter; the leaderboard streak flame is Ink 2.

**The Flat Chassis Rule.** No gradients anywhere. The system has exactly two patterned fills, both physical: the graph-paper ground (1px Grid lines on a 28px square) and the LCD's unlit dot lattice (a 4px radial-dot grid in LCD Ghost), because a real dot-matrix display has one.

## Typography

**Display Font:** Plus Jakarta Sans, via the site's `--font-ui` (with system-ui, sans-serif)
**Body Font:** Plus Jakarta Sans
**Label/Mono Font:** Doto (weights 600-900), for LCD numerals only
**Math Legend Font:** KaTeX_Main (with Cambria Math, Times New Roman), for chapter symbols

**Character:** The site's own geometric sans at heavy weight (800) for key legends and titles, tightly tracked, paired with dot-matrix display numerals. The pairing reads as the printing on a calculator body next to the digits on its screen.

### Hierarchy
- **Display** (800, clamp(1.75rem, 2.5vw, 2.25rem), 1.12, -0.028em): the page h1, left-aligned, balanced wrap; the second line is a block in Key Blue.
- **LCD Figure** (Doto 900, clamp(2.6rem, 4.6vw, 3.6rem), 0.9, tabular): the main readout on the hero LCD. Its companions are the total (Doto 900, clamp(1.3rem, 2vw, 1.7rem)) and the percent (Doto 900, 1.5rem).
- **LCD Small** (Doto 900, 1.45rem, 1, tabular, right-aligned): the profile stat displays; the navbar token and streak counters use Doto 900 at 1.2rem.
- **Headline** (800, 1.35rem, -0.01em): the profile name.
- **Title** (800, 1.12rem, 1.2, -0.01em): chapter key names. Panel section titles use 800 at 1rem, profile subsection titles 800 at 0.95rem.
- **Body** (400, 0.8rem, 1.45): key descriptions and panel copy. List items (mission titles, leaderboard names) are 600 at 0.84rem.
- **Label** (700, 0.6-0.66rem, letter-spacing 0.04-0.12em, uppercase): printed legends on keys (chapter subcategories in the legend color, 0.08em), the "în curând" plate, stat labels under the small displays, the done / last-worked marks, and table column heads. LCD annunciators are 700 at 0.62rem, 0.1em.
- **Button** (700, 0.86rem; small 0.8rem). Nav tabs are 600 at 0.9rem.

### Named Rules
**The LCD-Only Doto Rule.** Doto is set only on an LCD surface (the hero display, the profile stat displays, the navbar counters). Never on a chassis, a key, a panel title, or body text. The words on an LCD (annunciators, the typed input line, the unit "rezolvate") stay in the UI face.

**The Tabular Rule.** Every number that can change (counts, percents, XP, ranks, levels) is set with `font-variant-numeric: tabular-nums`.

**The One Face Rule.** Every non-LCD word is set in the site face, Plus Jakarta Sans, through `--font-ui`; headings and key legends take weight 800. Hierarchy comes from weight, size and tracking, not from a second UI face or a width axis.

## Layout

A strict three-column instrument at desktop width. From 1180px the left rail (profile) and right rail (missions, leaderboard) are fixed to the viewport edges, full height below the navbar, each `--cap-rail` wide (340px, 300px at or below 1400px), and scroll on their own. The middle column reserves the rail width plus a 24px gap on each side by margin and holds the title, the LCD, the grade keys and the chapter keypad inside a shell capped at 1760px with 28px side padding. The page ground behind all of it is the graph-paper grid (28px squares), scoped to the Capitole page.

The chapter keypad is a two-column grid (18px row gap, 16px column gap). Each key is a size container: below 300px of key width the face tightens (14px padding, smaller symbol and description) and marks drop their words. Between 640px and 1180px the three columns stack with the middle one first. At 640px and below the keypad is one column, the shell padding drops to 16px, the strip legend beside the grade keys hides, and the three columns become three full-screen panes on a sliding track switched by a fixed bottom tab bar (62px plus the safe-area inset), with the middle pane (Capitole) as the default.

Spacing rhythm: 4px key edge, 8px small gaps, 14-16px internal gaps in keys and panels, 20px panel padding, 24px column gap, 28px section gap (22px at or below 900px). Rails meet the viewport edge flush: their outer border and corners are removed so they read as the chassis' side panels. In the navbar, tab keys sit 12px apart (8px at or below 1400px, where the token counter also drops its word).

## Elevation & Depth

The system is flat chassis plus physical key travel. Panels never cast shadows; they are separated from the ground by a 1px edge and a tonal step. The only raised objects are keys, and their height is a solid, unblurred bottom edge in a darker shade of the face color. Displays are recessed instead: an inset shade pushes the glass below the chassis. Blurred shadows belong only to overlays (modals and the phone menu), which float above the instrument rather than sit on it.

### Shadow Vocabulary
- **Key edge** (`box-shadow: 0 4px 0 0 var(--k-key-edge)`): chapter keys at rest. On press it collapses to `0 0 0 0` and the face moves down `translateY(4px)`.
- **Button edge** (`box-shadow: 0 3px 0 0 <edge color>`): buttons, grade keys, nav tabs, tab bar keys, modal close. Collapses with a `translateY(3px)` sink on press. The edge color is Key Edge on neutral keys, Blue Edge on lit chassis keys, and the nav key edge or pale-blue lit edge in the navbar.
- **LCD bezel** (`box-shadow: 0 0 0 7px var(--k-bezel), 0 7px 0 7px color-mix(in srgb, var(--k-bezel) 70%, black), inset 0 3px 6px rgba(0, 0, 0, 0.22)`): the main display: a spread ring frame, a solid lower lip, and an inset recess.
- **LCD recess** (`box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.18)`): small displays (XP bar, profile stats). The navbar counters use `inset 0 2px 3px rgba(0, 0, 0, 0.22)`.
- **Overlay** (`box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.4)`): modals. The phone menu drop panel uses `0 18px 30px -12px rgba(0, 0, 0, 0.45)`.

### Named Rules
**The Key Travel Rule.** Rest: darker solid bottom edge. Hover: `filter: brightness(0.95)` (0.96 on chapter keys, 0.94 in the navbar) and nothing else; no lift, no color swap, no glow. Press: the edge collapses and the key sinks by the edge height, both on one 0.1s transition so they move in lockstep. Every color property is restated under `:hover` so an older shared rule cannot leak a color swap in.

**The No Soft Card Rule.** A panel or key never carries a blurred drop shadow. Depth on the chassis is an edge, a tone, or an inset; blur is reserved for overlays.

## Shapes

Near-square, machined corners: 3px on panels, displays, plates and avatars; 4px on keys and buttons; 1px on bank-strip segments, mission cells and XP segments. Rails lose their corners where they meet the viewport. Every panel and key carries a 1px solid edge. Things that are not pressable yet (a chapter with no published exercises, the grade IX option) are printed flat on the chassis: dashed 1px outline, transparent fill, no bottom edge, text in Ink 3. Internal structure is drawn with 1px Rule lines, never with extra boxes.

## Components

### Buttons (keys)
Tactile and mechanical: every button is a key.
- **Shape:** 4px corners, 1px edge, 40px tall (36px small), 0 18px padding, 700 weight at 0.86rem, 16px icon with an 8px gap.
- **Neutral key:** Key Face with Panel Edge border and a 3px Key Edge bottom.
- **Primary key:** Key Blue face, Blue Edge border and bottom edge, white text.
- **Hover / Press:** per the Key Travel Rule; focus is a 2px Key Blue outline at 3px offset.
- **Printed (not yet available):** dashed edge, transparent, no bottom edge, `cursor: not-allowed`, with an uppercase "în curând" badge.

### Chapter Keys (signature)
The keypad is the page's center. Each chapter is one large key: Key Face, 1px Panel Edge border, 4px corners, 4px Key Edge bottom, 16px 18px 14px padding, 14px internal gap. Inside, top to bottom: the chapter symbol in the math font at 2.3rem in the legend color, the name (Title) and description (Body in Ink 2); the printed legend row of subcategories (Label, legend color, one line, overflow collapsed into "+N tipuri"); the bank strip; and a foot separated by a 1px Rule with the solved count, state marks (a flag for "last worked here" in blue, a check for done in green, both uppercase 0.66rem with a 13px icon) and the percent in the legend color. The focus outline takes the key's legend color. On hover the face only dims, per the Key Travel Rule, while the printed symbol tilts (`translateY(-3px) rotate(-6deg) scale(1.08)` over 0.28s); pressing sinks the key 4px. Hovering or focusing a key reads its numbers out on the hero LCD.

### Bank Strip (signature)
One strip per chapter key, 14px tall, one segment per subcategory with 3px gaps and 1px corners. A segment's width is its share of the chapter's exercises (flex-grow, 6px minimum); its fill is a `scaleX` layer in the legend color equal to the share solved, over a Ghost track. The segment under the pointer shows a 22% legend-color track, grows to `scaleY(1.35)`, and the hero LCD reads that subcategory ("Algebră › Polinoame", with the TIP annunciator lit). Segments are spans inside the key's link, so a tap anywhere still opens the chapter. A small legend chip beside the grade keys (a 34px by 8px bar, part-filled in Ink 2, "rezolvat din fiecare tip") teaches how to read the strip; it hides at phone width.

### LCD Display (signature)
The hero readout: LCD Glass with the 4px dot lattice, 3px corners, a 7px bezel ring with a lower lip, and an inset recess. Top row: annunciators (XII lit, IX ghosted, BAC, then CAP when a chapter is read out, TIP when a subcategory is, and Σ for the whole bank) in the UI face at 700. Middle: the input line typing a rotating phrase with a blinking block cursor (1.05s `steps(1)`), or the chapter name and bold subcategory while a key or segment is pointed at. Bottom: percent at left, the big Doto figure and total right-aligned with the unit. Figures do not count up; a new value strobes in over three stepped frames (0.16s). At phone width the input line reserves two lines so typing never moves the figure. Small displays (profile stats, the 20-segment XP bar) reuse the glass and a lighter recess.

### Cards / Containers (chassis panels)
- **Corner Style:** 3px; 0 on rails flush to the viewport.
- **Background:** Panel.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Panel Edge; internal sections divided by 1px Rule lines inset 20px.
- **Internal Padding:** 20px (sections 20px 20px 22px, 14px gap).
- **Titles:** Title-style at 1rem with an 18px line icon in Key Blue (XP Orange for the XP section).

### Mission Counters
A mission is a row: an 18px check box (2px-cornered empty box in Ink 3, a green check when done), the title, the XP reward in XP Orange Ink, and a track of segmented cells (one per exercise in the target, 8px tall, 3px gap). Filled cells are Key Blue, turning Done Green when the mission completes; the reward mark goes from dimmed Ink 3 to XP Orange. Done titles are struck through in Ink 3.

### Leaderboard Rows
Rows separated by 1px Rule lines, 8px 6px padding: rank (tabular, 800; top three in Ink, the user in blue), a 30px square-cornered avatar with initials on Ghost, name, level and streak (an 11px flame in Ink 2), XP right-aligned. The user's own row sits on Blue Wash with an uppercase "tu" tag in blue. The full list opens in a chassis-panel modal with a five-column table grid and uppercase column heads.

### Profile Panel
A cover strip (the user's photo, or a plain Cover-blue strip, never a gradient), an 88px square-cornered avatar overlapping it with a 3px Panel ring, name (Headline), an uppercase role line in blue, then level with a 20-segment LCD XP bar, three small stat displays, and achievements. Empty states are dashed plates with a line icon and Ink 3 text.

### Navigation
The navbar is the calculator's solid brand-blue top strip (no glass, no blur), deeper blue in dark. Tabs are keys on it: nav key face, 1px border, 4px corners, 3px nav edge, 38px tall, 0 16px padding (0 13px at or below 1400px), 600 at 0.9rem, nav ink. The active tab (and the primary guest action) is lit white with blue ink and a pale-blue edge. Icon buttons and the profile button share the key treatment; the profile avatar has 3px corners. Token and streak counters are a pale classic LCD set into the strip (3px corners, a key-edge border, inset recess) with dark Doto 900 digits at 1.2rem and an 0.6rem 800 word; when low the glass turns amber with dark amber ink, when empty red with dark red ink. At or below 1400px the token word drops. On phones the menu drops as a panel of the same blue with the current page as a lit white row; within Capitole a fixed bottom tab bar of three keys (Profil, Capitole, Misiuni) switches panes, the active one lit Key Blue.

### Motion
The page powers on once, like the instrument it is, and afterwards moves only in answer to the student. Entrances ease on `cubic-bezier(0.16, 1, 0.3, 1)`; display changes are stepped. Every piece below is gated by `prefers-reduced-motion` (the component checks `useReducedMotion`, the stylesheet uses `no-preference` / `reduce` queries), and under reduced motion the page renders its final state.
- **LCD power-on:** a 620ms segment test with every annunciator lit and 88% / 888 / 888 on the figures, while the glass comes up in six stepped brightness frames (0.45 to 1.08 to 1). Then the real readout and the typing start.
- **Title:** each line rises out of its own mask (`translateY(105%)` to 0, 0.7s; the accent line 90ms later).
- **Keys land:** as the keypad scrolls into view each key drops onto its edge (from -14px, 0.46s), overshoots into a 2px seat and settles, 70ms after the previous key. Its strip then fills segment by segment (0.7s each, starting 260ms after the landing, 45ms between segments). Locked keys only fade in.
- **Rails:** the profile rail slides in from the left and the missions rail from the right (28px, 0.42s).
- **XP bar:** charges segment by segment (0.12s `steps(2)` each, 32ms apart, from 420ms).
- **Stat LCDs:** refresh in stepped frames, staggered 380 / 480 / 580ms.
- **Missions:** filled cells light in two steps; a finished mission's check draws itself (0.5s from 0.35s) and its XP reward pops once (0.42s from 0.7s).
- **Leaderboard:** rows slide in from the right (14px, 0.4s), the first five staggered 45ms apart from 300ms; the user's own row flashes once in 26% blue (1.1s).
- **Hover:** the chapter symbol tilts while the key face only dims; a strip segment grows vertically.

**The Power-On Rule.** Choreography happens once, on arrival, and in hardware order: the display tests itself, the keys seat, the readouts fill. After that, motion only answers input. Nothing loops except the LCD cursor.

**The Stepped Display Rule.** Anything shown on an LCD changes in `steps()` frames, never with a tween or an easing curve, and numbers never count up. Easing curves belong to physical parts: masks, keys, rails, strips.

## Do's and Don'ts

### Do:
- **Do** build every pressable control as a key: solid darker bottom edge (3px buttons, 4px chapter keys), brightness dim only on hover, collapse-and-sink on press over 0.1s.
- **Do** restate background, color and border-color under `:hover` on every key so legacy shared rules cannot swap colors in.
- **Do** put the numbers a student should read first on an LCD surface, in Doto 900 with tabular numerals.
- **Do** assign color by the Legend Rule: blue for primary and Algebră, green for done and Geometrie, red for Analiză, orange for XP.
- **Do** show real quantities at their real proportions: one strip segment per subcategory, sized by its exercise count and filled by the share solved; one cell per mission step.
- **Do** mark not-yet-available items as printed plates: dashed 1px edge, no fill, no key edge, Ink 3, "în curând".
- **Do** tokenize every color for both `:root` and `[data-theme="dark"]`; dark is a backlit LCD at night (dark glass, pale green segments), not an inversion.
- **Do** ease entrances on `cubic-bezier(0.16, 1, 0.3, 1)`, use stepped timing (`steps()`) for display changes, and honor `prefers-reduced-motion` by rendering static.
- **Do** write all UI copy in Romanian, and punctuate with commas, colons or periods: no em dash in UI copy.

### Don't:
- **Don't** use rounded soft-shadow cards, gradients, glassmorphism, or neon glows; panels are flat with a 1px edge.
- **Don't** set Doto outside an LCD surface.
- **Don't** add a second UI face or a width axis; Plus Jakarta Sans carries every non-LCD word.
- **Don't** use orange for anything but XP, and don't introduce a fifth legend hue.
- **Don't** animate numbers with count-ups or tweens; an LCD refreshes.
- **Don't** lift, recolor, or glow a key on hover.
- **Don't** round corners past 4px on panels, keys, or displays.
- **Don't** color chapters from the legacy `js/data.js` category colors.

### Favorite / Istoric panels

The navbar's side panels (vanilla markup from `js/app.js` on Capitole, `js/panels.js` on other tabs, `js/category.js` on the chapter page) use the same world on every tab; their rules live in `css/calculator.css`, which every page with the navbar links after `css/style.css`: a Panel-colored sheet sliding in from the right on the page easing, a shadow only while open, head buttons as Keys, each exercise as a Key row (chapter symbol in its Legend color via `data-cat`, title, chapter name, rarity printed as a 1px-outlined uppercase legend in the site's rarity text colors: Comun, Rar, Epic, Legendar, via `BM.rarityBadge`; the old Ușor/Mediu/Greu labels are retired), and the empty state as a small LCD reading inside a bezel. Rows land one after another (capped at 320ms) when the panel opens. Every entrance animation uses fill-mode `backwards`, never `both`: a held final frame would pin `transform`/`box-shadow` and swallow the `:active` press sink on keys.

### Chapter page (category.html): decks

Tokens are shared: every `--k-*` token and the graph-paper ground live in `css/calculator.css`, linked after `css/style.css` on `capitole.html` and `category.html`. The chapter page's whole look is chapter-colored: `body[data-cat]` sets `--legend` (Algebră blue, Geometrie green, Analiză red, others Ink Soft); the per-subcategory colors in `js/data.js` are not used.

- **Header:** the chapter symbol as a 72px key, the title rising out of a mask, and an LCD reading one scope at a time: the chapter, the open subcategory, or the deck under the pointer. The LCD shows the CAP/TIP annunciators, C/R/E/L annunciators lit for the rarities present, a rarity line ("Comun 60/257 · Rar 76/266"), and the Doto figure. It powers on with the segment test (888) on load.
- **Decks:** each subcategory is a key face on a stack of tinted cards, one per rarity it holds (Comun/Rar/Epic/Legendar, `--rarity-*-b` mixed 30% into the key color), each peeking 5px under the face. A strip on the face shows solved share per rarity. Hover fans the stack and reads the deck on the LCD; press sinks the face 4px and squeezes the stack. Empty subcategories are flat dashed faces with no stack.
- **Motion:** the decks are dealt (drop with a 2.5deg twist, 55ms stagger), then their rarity cards slide out from under the face, then the strips fill. All fill-mode `backwards`; reduced motion shows the final state.
- **Breadcrumb:** a panel bar with the back link as a Primary Key and the current name in the legend color.

### Exercise view (category.html?sub=…): collectible cards

The rarity card system stays, reprinted in this world (`css/calculator.css`, markup in `js/category.js` renderRarityCards / renderFilterBar / buildRarityModal):

- **Card:** a key (272px tall) standing on a 4px edge in its rarity color (`--rarity-*-b` mixed 62% into Key Edge), border tinted 38%. A printed band across the top (30px, rarity tint 11%) carries the pips (1 Comun to 4 Legendar), the rarity name, a "Rezolvat" mark on solved cards (stamped in when marked), and the card's collection number (`#012`, its place in the whole subcategory, stable under filters). The formula sits in a recessed Panel window. The subcategory tag is hidden (same on every card of the page). Favorite / solved are 30px keys; solved lights green, favorite tints red.
- **Filters:** keys with their counts (Toate 76, Comun 26…). Status keys light blue when selected; rarity keys are printed in their rarity ink with pips and fill with the rarity color when selected. Phone: the two dropdowns are keys opening a Panel list.
- **Modal:** Panel dialog with a 6px rarity top rule and the rarity legend as a printed tab hanging from it; close and prev/next are keys (prev/next move to the bottom corners on phones); "Arată baremul" is a Primary Key; statement in a recessed window; barem step numbers are square rarity tiles.
- **Motion:** cards are dealt (drop with a 2deg twist, capped stagger) on load and after every filter change. Holding a card sinks it onto its edge and releasing brings it back up; a press on its favorite / solved keys presses only those keys (`:active:not(:has(.rarity-card__actions:active))`). The opening click replays the press as one short down-and-up before the modal grows out of the card. The page behind an open modal is blurred (7px).
- **Header key:** square by default, grows sideways for wide symbols (P(X), log, lg>). The header LCD takes the larger column share.

### Profile (profile.html): the identification plate

Styled in `css/calculator.css` (scoped through `#profileContent`), markup in `js/profile-page.js` renderProfile.

- **Plate:** like the label plate on the back of a calculator. A 128px cover strip (the user's photo, or the Cover blue), a 96px square photo tile standing on a key edge, the name and the role line, and a spec table of the account's facts (Țară, E-mail, Telefon, Link, Rating for teachers, Membru din, Autentificare) drawn as a hairline grid, then the bio. No colored chips: a teacher's status is a small LED (green approved, amber pending with a slow blink, red rejected).
- **Student:** a four-field progress display (exercises solved with a bar, level, streak, best BAC grade) across the page, then three columns: the BAC history as a printing calculator's paper tape (toothed edges, dot-matrix print, grades under 5 printed in red like a printer's negative numbers, total average at the foot), exam tokens as notched tickets with a perforation, and the account card.
- **Teacher:** title and one sentence, the day-filter key (a square key with the calendar icon, lit blue while a filter is on, with a green LED) and the blue "Creează clasă" key; a display with five left-aligned dot-matrix totals (Grupe, Elevi activi, Lecții ținute, Prezență medie in percent, and Elevi pe oră, the average number of students present at a lesson, to one decimal); then the class blocks, as many across as the width allows (one on a phone; the page uses up to 1840px). A block is a Panel on a 6px edge in the key-edge colour with a darker header band (number, subject, delete), so each class reads as its own object; it lifts 3px on hover and sinks when pressed (not when one of its own keys is pressed): a header (the number on an LCD chip, the subject with a chevron, grade, level and lesson type, delete as a quiet icon that turns red on hover), a hairline, two fields (Program: days and hour; Cod de invitație: the code on an LCD chip with a small copy key that flips to a check), and a small display at the foot with three figures: **Elevi** (taken / seats, one segment per seat, a "complet" legend when full), **Elevi pe oră** (the average number of students present at a lesson, with "la 12 ore") and **Prezență** (the class attendance in percent, ten segments). Figures with no lessons yet show "-" and "fără ore încă". They are computed in `_fetchAggregateStats` the same way as the Sumar tab of the class (headcount over current members; mean of each member's own rate). The whole block opens the class (a stretched link; the keys sit above it); hovering lights its number in inverse video. In a time the digits are dot-matrix and the colon is set in the UI face because Doto draws it as a cross at this size.
- **Student:** a join panel with the code typed into an LCD input (six characters, dot-matrix, the bezel turns blue on focus) and the Alătură-te key; a display (Clase înscrise, Profesori, Următoarea lecție with the day); then blocks of the same shape: header with "Ieși din clasă" as a red text link (a repeated per-row action, so a link and not a 3D key), Program and Profesor, and a display with the next lesson of that group and how many days ago they joined.
- **Greeting and today (both roles):** an eyebrow with the date ("Joi, 1 octombrie", a small blue square before it), a title that greets by the hour ("Bună dimineața" / "Bună ziua" / "Bună seara") followed by the user's name in blue, and below it a **today strip**: a Panel with a header band (LED, "Lecțiile tale de azi", a count on a small display) and one small ticket per lesson that meets today, in time order: the time on an LCD chip, subject, grade, type and seats (teacher) or teacher (student), and a legend that says where it is now ("peste 2 h 15 min", "a început" with a blinking square, "încheiată" after three hours; the classes carry no duration, so it is a guess and the wording avoids claiming more). With none, it says "Nu sunt lecții programate pentru azi." and names the next lesson. The words follow the clock every 30 seconds.
- **Empty states:** the list drawn as ghost rows with a key-tile icon, one sentence and the create key (teacher) or the code hint (student).
- **Filter popover:** a Panel under the filter key with a small notch, the seven days as small keys (lit blue and sunk when chosen) and an "Arată toate" link; while a filter is on, a caption above the blocks says "Arăt 2 din 5 grupe (Mar, Joi)". On a phone it opens from the key's left edge so it stays on screen.
- **Create-class modal:** a Panel on a blurred backdrop: the header (kicker, title, close key), three numbered steps (Materie; Program: day keys, at most 2, hour dropdown, Online/Offline keys; Grupa: seats 1 to 6, class, optional level as key rows) and a live preview on the right. The preview is a display that assembles the class as you choose (subject, days, hour, seats as slots, tags), shows the saved name and six progress segments (green at six of six). The numbered chips turn green when their step is done; pressing create with fields missing marks them red, nudges them and scrolls to the first. Choices are keys, not native selects; Materie and Ora are a dropdown with keyboard support. On a phone the modal is a bottom sheet with the preview sticky at its top. Esc, the backdrop and the close key close it, focus returns to the key that opened it.
- **Confirm dialog** (delete class, leave class): a Panel with a key-tile icon (red for the destructive ones), Anulează and a red key.
- **Motion:** first paint only: the display runs its segment test and its figures tick up in stepped frames, the blocks are dealt one after another (80ms apart, a small twist) and their segments light one by one. Later renders of the same page (fresh data after the cached paint, a class created or deleted) do not replay it: a new class lands at the top with a blue wash that fades, a deleted or left block slides out before the list closes the gap. The modal rises (blurred backdrop, steps staggered, display powers on), preview lines blink when they change. All fill-mode backwards; reduced motion shows the final state.

### Sign-in page (auth.html): the locked display

Styles in `css/auth-page.css` (linked after `css/calculator.css`, all scoped under `body.ap`, own `ap-` classes because the legacy `.auth-*` rules still serve the profile page and the login modal), behaviour in `js/auth-page.js`. Surface brief: `.impeccable/surfaces/auth-html.md`. Three forms (Conectare, Înregistrare, reset) on one page, Google, role Elev or Profesor; the Supabase logic is unchanged.

- **Split:** left, a solid navbar-blue column (`--ap-cover`, deeper in dark; no gradient) with the wordmark, the Acasă key and the theme key as navbar keys, the two-line headline (the second line a lit key: white face, blue ink, pale-blue edge), one sentence and the display. On desktop the column is sticky and as tall as the window, capped at 680px; below 900px it stacks above the panel as a compact header (title, display and panel share one left edge). Right, the graph-paper ground with one chassis panel (440px, 1px edge, 3px corners, no shadow).
- **The display talks:** annunciators light the mode (CONECTARE, ÎNREGISTRARE, RESETARE) and, in sign-up, the role; a typed line (two lines reserved) greets on a mode change and, when the person goes into a field, prints that field's rule ("Minim 8 caractere.", "3-20 caractere: litere mici, cifre sau _."; the programmatic focus after a mode change does not override the greeting); the figures are real: exercises and chapters from `BM.EXERCISES` / `BM.CATEGORIES`, and in sign-up the 3 free ExamTokens. It powers on with the segment test (888), refreshes in stepped frames, never counts up.
- **The bank, on the column:** under the display a chassis plate lists the chapters from the real data (`BM.CATEGORIES`, `BM.EXERCISES`): the chapter symbol and strip in its Legend colour (Algebră blue, Geometrie green, Analiză red, the rest Ink Soft), the name, the exercise count, one strip segment per type of item sized by its count; a chapter with none is printed flat with a dashed "în curând" plate (as on the keypad). Pointing at a row makes the display read it ("Algebră: 616 exerciții în 12 tipuri."). Below it a printed list of four lines (barem pas cu pas, antrenament cu cronometru, simulare BAC 12 exerciții 3 ore, clase virtuale) with a small lit square as the bullet. The column is as tall as the window, so by height the list goes first (under 940px), then the plate (under 760px); stacked (under 900px) only the plate stays, down to 520px.
- **Panel:** mode keys (the open one lit blue and held half way down), fields as recessed slots (the page ground tone, 2px inset, 46px, 16px type so iOS does not zoom), a small square eye key in the password slot, eight password cells (one per required character: blue while filling, green at eight, `n/8` beside them), a confirm line with an LED (green "Parolele coincid.", red when different), an amber Caps Lock note, role keys (the open one lit and sunk; the Profesor key carries an amber LED that waits with a slow blink), the primary key, a rule with "sau" and a neutral Google key. Messages are a bordered line with an LED (red or green) that nudges on error; empty required fields get a red edge, a nudge and the cursor. Loading is three stepped squares on the key, never a spinner.
- **Dark theme:** the same tokens; keys lit in blue take dark ink (`#0A1226`) instead of white because white on the dark blue is under 4.5:1.
- **Motion:** first paint only (`body.ap-boot`, which the script drops after 2.6s or at the first mode change, so a key never plays its entrance twice), in hardware order: the display runs its test, the headline rises out of its masks, the panel settles, the mode keys, the submit key and Google land on their edges (70ms apart), the chapter strips fill segment by segment and the list prints line by line; after a mode change only the fields of the form come in, 30ms apart. Reduced motion shows the final state with nothing running (the cursor stops too).
- **Not on this page:** the four-icon feature list and the decorative math symbols of the first version, any gradient, any rounded card, any em dash in the copy.

### A class (class.html): the cabinet

One class on its own page: a plate, a row of tab keys, and the same panels and displays as everywhere else. A style-only pass: the structure (hero, tabs Sumar / Mesaje / Teme / Simulări / Tablă / Catalog, or Cabinet Personal for a student) did not change. Styles in `css/class-detail.css` (only on class.html, scoped with `body:has(#classRoot)` and CSS nesting); behaviour and markup in `js/class-page.js`.

- **Mechanism:** the legacy class CSS is written on the site's variables (`--surface`, `--card`, `--border`, `--text`, `--accent`, the radii, the shadows). The stylesheet first remaps those variables to the calculator tokens (radii 3-4px, shadows become hard 3-5px edges), which recolours and squares every legacy component at once, dialogs and wizards included; the rules after it restyle what needs more than a new colour.
- **Plate (hero):** a flat Panel on a 5px edge, no gradient, orbs or symbol wallpaper. The subject, role and lesson type are outlined legends (2px corners, uppercase, tracked), the title is 800 weight, the teacher's avatar is a key-face square. On the right, two small displays: **Program** (the week as seven cells with the class's own days lit, today underlined, an Online / Offline indicator, and a clock counting down to the next lesson in stepped seconds) and, for the teacher, **Cod invitație** (the code in dot-matrix with a copy key).
- **Tabs:** keys, not underlined text. The open tab is lit blue and held half-way down; on a phone the row scrolls. The bar is sticky under the navbar (the body clips with `overflow-x: clip`, because `hidden` turns the body into a scroll container and silently disables sticky).
- **Sumar:** three up-next panels with key-tile icons; **Pulsul grupei** is one display with five left-aligned dot-matrix figures (seats with segments, attendance, students per lesson, class average, lessons held); the roster, the attention list and the activity are printed sheets with LCD-chip initials and outlined status legends; the info card is a panel with a key-tile subject icon. Section labels carry a small blue square.
- **Mesaje:** the panel is sized to the window (window height minus navbar, tab bar and a margin), and opening the tab lifts the page until the whole panel is on screen, so the box you type in is never below the fold. The composer is labelled ("Scrie un mesaj clasei"), a recessed slot with a real blue **Trimite** key (an unlit, tinted key while empty) and a hint about Enter. Three voices: others on a key face, you in lit blue, the teacher on the display (LCD face, marked with a legend). The list sits on graph paper. The notification prompt is a small panel under the tab bar (top on a phone too), not a bar across the bottom that would cover the composer.
- **Teme, Simulări:** toolbars are auto-width keys on the right; each homework or simulation is a Panel that lifts 3px on hover and sinks when pressed (not when its own keys are pressed). No side stripes: a homework's state is a small square before its title (green far off, blue soon, red urgent, grey expired) and an outlined due legend; the per-card actions are small keys, delete turns red.
- **Catalog and Cabinet Personal:** the totals are a display; the table is a printed sheet with uniform date chips (no rainbow months), grades in the UI face (green high, red low, ink between) and LCD-chip initials; the Note / Prezență switch is two tab keys.
- **Dialogs** (confirm, wizards): a Panel on a blurred backdrop, step markers as small LCD squares (blue active, green done).
- **Motion:** only while a tab is freshly opened (`body[data-cd-fresh]`, set for 1.6s by `class-page.js`): the plate fades in, both displays run their segment test, the tab keys drop in one by one, panels are dealt with a stagger, and the figures on the displays count up in stepped frames (`_cdWatchNumbers`). Later refreshes of the same tab (realtime) stay still. The clock in the plate ticks every second. Reduced motion shows the final state.
- **Not restyled:** the live whiteboard view, the simulation runner and the editors are legacy and only pick up the new colours and squared corners through the variables.

## Admin console (admin.html): station signage

A separate visual world for the admin role only. The calculator world (displays, dot-matrix figures, keys on edges) stays for students and teachers; the admin sees an operations console built like a station's signage system: every piece of information has a sign, colour codes are fixed like transit lines, and the page you are on is marked the way a station marks "you are here". Brief: `.impeccable/surfaces/admin-html.md` (seed 05ada60a, "Semnalistica de gară").

- **Where it lives:** `admin.html` (shell + views), `css/admin.css` (tokens `--ax-*`, shell, shared components, all under `body.ax`), `css/admin/<view>.css`, `js/admin/shell.js` (router, sign panel, access), `js/admin/ui.js` (helpers: filters in the URL, multi-select, drawer, toasts, CSV), `js/admin/mock-data.js` (demo data), `js/admin/views/<view>.js`. The Adaugă exercițiu and Culegeri pages run inside the same shell (`body.ax.ax-legacy[data-ax-page]`, their content in `#axLegacy`, the site variables remapped to the console tokens).
- **Routing and access:** an admin who signs in with no explicit destination lands on `admin.html` (`js/auth-page.js`), and the default landing pages (index, Capitole) send an admin there once the role is known (`js/auth.js`, after `bmauth:profile`), unless they chose "Vezi site-ul" in this tab (`sessionStorage.bm_admin_browse`). The console has no site navbar (`BM.onNavReady` is a no-op stub on these pages).
- **Type:** Plus Jakarta Sans, the same UI font as the student and teacher site (loaded in admin.html and the two legacy pages), weights 400-800, tabular figures everywhere; hierarchy comes from size and weight only.
- **Colour:** off-white ground `#F2F2EE` (dark `#0D0F12`), white panels with 1px rules, ink `#121417`. The sign panel is black in both themes. The highlight is a light signal blue (`--ax-hi` `#7DB9FF`, dark `#8CC4FF`, with `--ax-hi-wash` for hover rows): "you are here" in the sign panel, selected quick filters, today markers, the now-line in Repartizare. Signal yellow `#FFC20E` with black is now only for warnings (conflicts, financial risk, hazard stripe). Actions are blue `#1F5FD6`. Project line colours, used only as narrow bands: Examen.md Offline violet, Examen.md Online blue, Matematica.md teal. Every page also has its own colour (`--ax-c-<page>`, exposed as `--pg` on the shell and on each nav item): sky Acasă, orange Orar, green Elevi, pink Repartizare, lime Disponibilitate, periwinkle Analitică, sand Conturi, coral Adaugă exercițiu, cyan Culegeri. It colours the nav icon, the page plate, the top rule of stat signs and panel heads, the active sort column, and the focus and hover edge of dropdowns, buttons and rows.
- **Signs:** statuses are indicator shapes plus colour (activ: filled green disc; se completează: half disc amber; înlocuire: swap arrows violet; inactiv: hollow grey ring; students add oră de probă as a dashed ring, instabil half disc, transferat an arrow), never pastel pills. Grade is a roman numeral in a ruled box; seats are small squares (filled = taken); pictograms are white line icons on black square plates; room numbers are black platform plates.
- **Dropdowns:** every `select.ax-select` is upgraded by `AdminUI.enhanceSelects` (MutationObserver in `ui.js`) to a button plus a popover in the multi-select language: opens with a short drop-in, chevron turns, the active row gets a page-colour edge, arrow keys, Enter, Escape and type-ahead work, the native element stays in the DOM (hidden) so views keep reading `.value` and listening to `change`. Multi-select filters open with a height transition.
- **Pinned filters:** on Orar, Elevi and Repartizare (from 1181px) the filter rail is a second sign panel: `position: fixed`, full height under the top bar, next to the navigation (`.ax-fixsplit > .ax-rail`, width `--ax-fix-w`, left `--ax-side-w`), independent of the page scroll; header, figures and list live in `.ax-col` beside it. Below 1181px the rail becomes a bar pinned under the top bar (sticky, header and figures first, list after). Disponibilitate keeps a sticky rail. Analitică and Conturi pin their filter bars, as a one-row scroller on phones.
- **Folded sign panel:** one centred 46px column, groups separated by a rule, badges on the tile corner, theme and fold buttons stacked. Folding and unfolding is animated with FLIP (WAAPI): the panel's width and the content's `translateX` ease between 264px and 76px (0.34s), no grid transition and no layout work per frame; the labels fade, the two text buttons collapse to icons; the fixed filter column follows with the same easing. Only above 960px (below it the panel is a drawer).
- **Logo:** `assets/images/MathorizonLogo-mark.png` on the black sign panel (it is a light mark, which is why the panel is black in both themes).
- **Shapes:** corners 2-3px, no soft shadows (only popovers get a hard rule plus one short shadow), no gradients except the yellow-black hazard stripe.
- **Data:** demo data generated in the browser (196 groups, ~600 students, 28 teachers, 8 rooms, 6 managers), same every load; demo edits (moving groups, statuses) stay in localStorage and the top bar has "Date demo · Resetează". The Conturi page uses the real Supabase data and says so.
- **Motion:** rows and cards arrive from the right like a train (`data-arrive`, short stagger) on the first render of a route; the sign-panel arrow advances on hover; drawers slide in from the right. Reduced motion turns all of it off.

- **Repartizare board:** one scroll only. From 1181px the board fills the screen under a one-line header (title plus the day summary as five small figures; the clash count turns yellow and opens a drawer with the list and the Arată / Rezolvă actions). The board is the only scroller, so the sticky hour header (big, centred 08:00 to 20:00) and the sticky cabinet plates are always in view and the horizontal scrollbar sits at the bottom of the screen. The day (list of seven, selected one in the page colour, `azi` and clash markers, lesson counts) and the Cabinete / Profesori switch are the first block of the fixed column, above the filters; the legend and the drag hint are at its end. Below the board there is nothing. Cards are detailed by default (URL `vis=c` gives the compact one): teacher or room in full, no abbreviations, then class box and subject, status sign, seats plus `taken/max` ("complet" when full); Școala de Vară is a sun icon, not a word. Columns are 196px, lanes 124px. Undo: the toast after a move, or Ctrl+Z. Phones and tablets keep the day strip and the switch above the board.
- **Acasă:** greeting, the six attention signs, then two columns: the three projects on the left, and in the middle a hub of big tiles, one per page (Orar, Elevi, Repartizare, Disponibilitate, Analitică, Conturi, Adaugă exercițiu, Culegeri). Each tile has the page colour as a rule along the top (it grows into a wash on hover), a 64px colour plate with the icon, the title, one sentence, and a live figure (groups, students, lessons today with clashes, teachers, share of active students). The old "today in rooms" board is gone: Repartizare is the place for that.
- **Repartizare header:** the seven days are one grid of equal cells (the page colour fills the chosen one) with the Cabinete / Profesori switch beside them in the same 54px row; there is no title, the crumb names the page. On phones the days take the full row and the switch sits under them.
- **Moving between pages:** the old page fades out in 150ms, the new one comes in with its blocks rising one after another (46ms ease, 60ms apart; the fixed filter column slides in from the left). Re-renders on the same page (filters, theme) stay instant. Links to the two legacy documents fade the page first, then navigate, and those pages play the same entrance. Never a transform on `.ax-fixsplit` itself, because the fixed filter column lives inside it. Reduced motion turns all of it off.
- **Tables:** Orar and Elevi use `table-layout: fixed` with set column shares, 14px side padding, and 28-30px of room after a right-aligned figure column (Sold, Locuri libere) so a figure never touches the next column's text.
- **Analitică colour:** the page blue stays the base. Each indicator card carries a tone (blue totals, green active, amber filling or trial, violet starting or transferred, red inactive, teal averages and rates): a 4px rule on top, a tinted icon chip, and the rule grows on hover. Section heads get a rule and a square in their tone, status rows have bars in the status colour, debts are red.
- **Disponibilitate, "Cine e liber?":** the bar has an hour scale (08 to 20) in the header and a legend ("Cum se citește bara"): green = the teacher's working hours, hatched = outside them, coloured blocks = groups already held (project colour), blue frame = the hour searched.
- **Calculator (`#calculator`, `js/admin/views/calculator.js`, `css/admin/calculator.css`):** transfer, înlocuire and retur, with the office-sheet formulas (the sum is split proportionally between achitări and reduceri). Lilac page colour. Three tabs like route plates (arrow keys switch, `?mod=` in the address), a form panel that stays in view (each field has its own colour band: achitări teal, reduceri amber, cost orange, ore blue, preț violet, plus a black "Rândul 3 / 4 / 5" plate), and a live result: no button, it updates as you type, accepts comma or dot, flags negatives and letters in the field, and shows a plain error when the numbers cannot work (înlocuire above the available sum). Results are cells with a copy key (clipboard plus toast) and proportion bars; retur leads with a big tone-coded banner (green to return, red the student owes, blue exact). Nothing is stored or sent. Verified in Playwright against a copy of the original formulas, including random inputs.
- **Polish layer (review pass):** all in the last block of `css/admin.css`, none of it changes layout. Nav item of the new route plays a short plate-in and its icon pops; buttons and tiles press down 1px, nav icons tilt on hover, switches spring; clock digits tick when the minute changes; filter chips pop in; toasts show a draining bar and pause on hover; drawer sections stagger in; table wrappers show a fade at a scroll edge; `::selection` uses the page colour. Figures in stat signs count up once per route entry (`AdminUI.countUp`, 380-900ms, skipped under reduced motion, width locked so nothing shifts) and the first 14 rows of Orar and Elevi arrive with a 12ms stagger (`AdminUI.stagger`). The entrance uses `.ax-in` classes added by `shell.js` (never a class on `.ax-view` that would restyle the whole subtree).
- **Touch and small screens:** `100dvh` for the sign panel and drawers, `overscroll-behavior: contain` on drawers and popovers, hover-only effects are reset under `(hover: none)`, and under `(pointer: coarse)` small text links (phones, "Urmărește progresul", "Arată filtrele") get an invisible 44px hit area through `::after`. The "Date demo · Resetează" pill is hidden on pages with real or pure-tool data (`view.demo === false`, Calculator, Profesori, legacy pages) and moves into the nav drawer on phones.
- **Rule for CSS edits:** a stray `}` makes the parser drop the next rule silently (it once swallowed `.ax-rail > * { flex-shrink: 0 }` and collapsed the Orar day selector on 900px-high screens); check brace balance after appending blocks.

## Registru (registru.html): the teacher's spreadsheet as a page

The teacher's Excel register rebuilt in the console's signage language but wearing the sheet's own colours. Entry: a "Registru" key in the profile of an approved teacher (and of an admin); the page itself checks the role (profesor with status active, or admin). Files: `registru.html`, `css/registru.css`, `js/registru/registru.js`, data in `js/admin/registru-data.js` on top of `js/admin/mock-data.js`.

- **Tabs at the bottom, like the sheet's tabs:** Total achitări, Disponibilitate, then one tab per group (badge = students, dot = group status, name = days and hour, "(Vară)" for the summer regime). At the end of the strip, as in the spreadsheet, two arrows move the tabs (a click moves a page, holding moves them continuously, the wheel too); arrows, Home and End move between tabs; routes `#total`, `#disponibilitate`, `#grupa/<id>`. Black top bar as the console's sign panel, with a "Salvat" mark that flashes after every edit and the "Date demo" teacher picker (the page runs on demo data; the picker stands in for the signed-in teacher).
- **Sheet palette (tokens `--rg-*`, each with a dark twin):** sage labels and total column, cream cells, orange for salary rows, green "Grupa" band, steel blue (sold, headers), teal (achitări, day heads), peach (reduceri), orange (cost), pink (efectuate), light blue availability grid with a dark green Disponibil and a yellow Ocupat, lilac bands I-IV / V-IX / X-XII for the classes, month tints in the date column (hue by month, as June, July, August in the sheet). Presence is a pill: dark green Prezent, red Absent, grey Absent motivat, light green Prima lecție gratuită; a red frame marks the first lesson where a student went past what he paid.
- **Total achitări:** payments received on the left (Data, Suma, total), then one sticky label column, a total column and one column per group. Sticky "Grupa" row, sticky left columns, the board is the only scroller. Row and column under the pointer light up; group names open the group's sheet. Monthly rows (state of students, yield, value, hours, cost by manager) are stacked mini lists. Key figures count up on entry.
- **Group sheet, all of it editable:** the table starts at once (no header block, no legend, nothing pinned at the top). Three blocks: on the left DATA / TEMA / price (a wide first column), on the right Ziua / Ora / Cabinetul and the teacher's level and presence percentage, both pinned to the screen edges (from 1181px); between them the students, the only thing the horizontal scrollbar moves, with a dozen empty "Loc liber" columns after them. Grid lines are darker than on the Total sheet. The pills of the first column are dropdowns (format 1 to 8, group status, subject, class, level, profile) and the price per hour is a number field; each student has two dropdowns, the status and the manager (both centred in their cell); the status of a student is a dropdown in the header (Oră de probă, Activ, Transferat, Inactiv, Oră de probă confirmată, Înlocuire, Instabil). A lesson's date opens a calendar in the site's own style (month arrows, today ringed, the group's meeting days dotted, arrow and PageUp/PageDown keys), its title is a plain text field (Enter saves and leaves it), and "Adaugă lecție nouă", at the left under the dates, appends a row with no date until one is picked (an added lesson can be deleted, with undo). Every presence cell opens a menu (or takes a key: P, G, M, A, B, Delete; arrows move): Prezent, Prezent prima lecție gratuită, Absent motivat, Absent nemotivat, Absent prima lecție de probă, each in its own soft colour. Only the cell under the pointer reacts to hover; there are no tooltips on the presence cells (the red frame marks the first lesson where a student went past what he paid). A student name opens a drawer.
- **Disponibilitate is wired to the console:** click, drag across hours (mouse), or tap; a day name or an hour toggles the whole line (with undo). The grid runs 08:00 to 21:00 and has no legend or second "saved" chip (the top bar's "Salvat" is enough). On hover an empty cell shows a drawn, exactly centred plus and a green one shows "Scoate" over the whole cell, never on top of the word. Ocupat cells are the teacher's own lessons and cannot be painted; clicking one shows the lesson. The grid writes `AdminData.setAvailability`; the table "Ce predai și pentru ce clase" writes `AdminData.setTeach` (grades where the teacher has a group are locked). The console's Disponibilitate page reads the same store and refreshes live from another tab (`storage` event, `bm:demo-external`); it links back with "Registrul profesorului".
- **One world of data:** `registru-data.js` (loaded by both admin.html and registru.html) generates, per group, lessons, topics, per-lesson price, presence per student, paid, discounts and cost; from them come the student's balance (sold = achitări + reduceri - cost of the lessons marked Prezent or Absent nemotivat) and the last three presence marks, which the console's Elevi, Orar and Analitică read. Every edit of the register (marks, dates, titles, added lessons, price per hour, group fields, student status) is kept in the same demo store as the console's own edits (`AdminData.setMark`, `setLesson`, `addLesson`, `setRate`, `setGroup`, `setStudentStatus`), so the console follows at once and "Resetează datele demo" clears all of it. **Money rules:** a student pays per hour by the format of the group (individual 608, three students 288 each, six 218; two, four and five are in between and can be corrected in `registru-data.js` or per group in the sheet). The teacher earns per hour of lesson by how many students came: all of them 255, one missing 218, fewer 175, never less than 175 (individual 255; three students 1 -> 175, 2 -> 218, 3 -> 255; six 1 to 4 -> 175, 5 -> 218, 6 -> 255). A lesson counts, for the students' cost, the teacher's pay, the hours and every figure, only when it has a date **and** a title; until then its price and pay are blank (so the teacher always fills both in). "Suma pentru toate lecțiile" is the sum of the lesson pays, payments received and "Salariu spre achitare" follow from it. **Who sees what:** a teacher opens only his own register (the one that matches his name; there is no picker and `?t=` is ignored); the admin opens any teacher's register and changes it.
- **Phones:** the ledger folds into a bar with the paid sum, the labels and the date stay pinned on the left, the right block scrolls with the sheet, dropdown pills lose their chevron, long names switch to short forms, hit areas are 40-46px, the tabs bar keeps its arrows and respects the home-bar inset.

## Recepție (admin.html#receptie): the lobby TV

A page of the console for the big screen at the entrance (offline groups only, the ones with a cabinet). Files: `js/admin/views/receptie.js`, `css/admin/receptie.css`; page colour mint (`--ax-c-receptie`). Same station-signage language as the rest, scaled for a room: the board is sized in em from the width of its box (container units), so one layout reads from across the lobby on a 1080p or 4K screen and also shows as a preview in the console.

- **What it shows, by the clock:** first the lessons in progress now (a two-hour lesson that began an hour ago is still in progress), then the next wave, the lessons that start at the next hour that has lessons today ("Urmează"), then, when the day is over, the first lessons of the next day with lessons ("Mâine"). Not the whole day at once: the plan is compared with the clock every 15 seconds and rebuilt when the hour changes.
- **Slides:** six groups per slide, sorted by cabinet; a slide stays 10 seconds and the bar along the top (one segment per slide, green for in progress, blue for upcoming, ink for tomorrow) fills while it is on screen, then the next slide comes. With one to four groups the cards are bigger (one row, or two by two); five or six are three by two.
- **A card:** the cabinet as a black platform plate with the floor, the teacher, the time and the days, the subject, the class as a number ("Clasa 7", for children and parents), "3 din 3 elevi" or "Individual", then every student with a status dot (filled green: in the group; dashed blue ring: oră de probă; violet ring: înlocuire; "Instabil" is an internal status and shows as a normal student). In progress: how many minutes are left and a thin elapsed line; upcoming: "începe în 40 min".
- **Top corner:** day of the week, date and the running clock, as in the old lobby.
- **In the console only:** pause and step, a simulation of any day and hour (so the board can be shown at noon on a Sunday; a yellow "simulare" tag marks it), and "Pe tot ecranul" (full screen, screen kept awake, pointer hidden after 3 seconds). Keys: arrows, space, F. \`#receptie?tv=1\` hides the console around the board for a screen that stays on this address (Esc leaves).
- **State in the address:** \`?zi=<1-7>&ora=<8-20>\`.

## Transfer (admin.html#orar, drawer of a group): moving students between groups

- **One person, one record.** A transfer never copies a student. `s.group` is the group he is in now; the transfer is stored in `edits.transfers` (one row per transfer in `demo_state`, so it syncs and undoes like every other edit). The group he left keeps his column: status **Transferat** there, marks and money untouched (statistics are not lost); in the new group he is **Activ**, with a new empty column and no money. His balance in the console is the sum of his columns.
- **Flow.** Drawer footer "Transfer" turns the student list into a tick list (square boxes, check drawn on tick, count in the footer) → "Alege grupa" opens a dialog of candidates → a choice opens a "what will happen" note → "Transferă" → done screen with "Anulează transferul".
- **Candidates** (`AdminData.transferCandidates`): same subject, grade and profile, not closed, free seats for everyone, never a group he already was in. No filter chips: the rules are fixed. Same profile is required; the order is by level (the same level first, then the nearest). Groups with too few seats are listed dimmed; full ones are only counted.
- **Register.** The moved column is lilac (status "Transferat", no dropdown, the new group's name under the name); the incoming column is blue ("din ..."). Cells the transfer closes are hatched and cannot be marked: lessons from the transfer day on in the old group, lessons before it in the new one.
- **Colour.** The transfer colour is `--ax-swap` (the status colour of Transferat); selection is the signal blue; the dialog header is the dark sign panel.

### Comments on register cells
- A thread of notes per cell (presence cell, student column, lesson date), like a spreadsheet's comments. A small amber corner marks a cell with a thread, red while something in it is unread; a card with the first note shows on hover; click, Shift+F2 or the right-click menu open the thread.
- Only the admin starts a thread; the teacher reads and replies. Stored one row per message in `edits.comments` (so two writers never overwrite each other and it syncs like every other edit). Read state is per device (`bm_rg_cm_read_v1`).
- Unread count: a red number on the group's tab and on the top-bar comments button, whose drawer lists every conversation of the teacher and jumps to the cell.

- Recepție: the size of the group is shown as "Grup cu N elevi" (or Individual), never as a count of enrolled students. A click on a lesson card opens that teacher's register at the group in a new tab; the TV kiosk (?tv=1) ignores clicks.

## Înscriere (admin.html#inscriere): the enrolment desk
- Two panes: what the parent says (subject, grade, profile only for the lyceum X-XII, level; then, optional, the parent's wishes: days, hours, offline/online, a teacher) and the live result. Chips are ink when chosen (the console's own segmented look), the grade is a 6x2 grid of roman numerals, the profile row opens with a height animation only for X-XII.
- Result 1, "Grupe existente": only ACTIVE groups with a free seat (a switch adds the ones that are still filling), the same level first and then the nearest. Result 2, "Grupă nouă": the teachers who teach that subject and grade with the hours they can still take, a week grid of free hours (click an hour, click the same hour on another day for a second weekly meeting), the room picked automatically for offline groups.
- Enrolling asks only for the name, the parent's phone and the manager. The student starts as **Oră de probă** (first lesson free) in the teacher's register (a column "elev nou") and becomes **Activ** when the parent pays. A new group starts as **Se completează** with this one student. Every enrolment can be undone.
- Data: `edits.newStudents` and `edits.newGroups` (rows in the shared demo state, like every other edit); a new group id is `g` + digits so the register's routes accept it.

### The money of a transfer (automatic)
- A transfer confirmed in Orar splits the student's money with the Calculator's "Transfer" formulas, done from the register's own figures (`AdminData.transferFin`): A = payments, R = discounts, C = the cost of the lessons he had in the old group. Payments and discounts are consumed in proportion (A/(A+R), R/(A+R)) up to C; the old column ends with balance 0 and the rest (A+R-C, split into payments and discounts) is the start of the new column. Rounded to cents so the parts add up exactly; the student's total balance never changes.
- If C is more than A+R the student owes the difference: it stays in the old group and nothing negative goes to the new one (the dialog warns). The split is stored with the transfer (`edits.transfers[id].fin`), so undo gives the old figures back, and a second transfer carries what the first brought.
- The dialog shows the table of figures before confirming; the register shows cents only when a figure has some, and the student drawer says how the money moved.
- Transfer candidates keep the way of teaching: an offline group only offers offline groups, an online one only online ones. From an Activ group the Activ groups come first, then the level orders them (same level first).

## Parcursul elevului (the student's journey)
- A History button on every student row in Elevi (and in his drawer) opens the folder of that student: a summary strip (since when, groups, spent, paid, balance), then one chapter per group in the order he joined them, linked by the transfers. A chapter has the events inside it (enrolled, first lesson, status changes, last lesson, becoming inactive), the figures of that group (lessons held, spent, paid, discounts, balance) and a bar of how much of what he paid was spent. A transfer between chapters shows its date and the money that moved, and the debt left behind.
- Dates come from the register (first and last marked lesson), the transfers and a log of status changes (`edits.history`, written by `setStudentStatus`). A generated student who left has his end dated by his last lesson. Data: `AdminData.journey`, UI: `js/admin/journey.js`.
- Three "story" students are part of the demo data (buildSeeds in mock-data.js): one transferred once, one twice (three groups), one transferred and then inactive. Their transfers are seeded, not edits, so "Resetează" keeps them; their money is split with the same rules and their lessons in the new groups carry marks. The journey shows, per group and in a summary, how much was spent.
- A wide table (`.ax-table-wrap`) must not swallow the wheel: it keeps `overscroll-behavior-x: contain` only, so scrolling over the rows still moves the page.
