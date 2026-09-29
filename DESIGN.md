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
  ink: "#17191C"
  ink-2: "#464B52"
  ink-3: "#646A71"
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
  dark-ink: "#ECEDE9"
  dark-ink-2: "#B5BAC0"
  dark-ink-3: "#8D939A"
  dark-lcd: "#141B11"
  dark-lcd-ink: "#BCE296"
  dark-bezel: "#050607"
  dark-blue: "#5C8CF2"
  dark-blue-edge: "#1E3B86"
  dark-green: "#4DBE8E"
  dark-red: "#EE7560"
  dark-orange: "#F08A3C"
  dark-orange-ink: "#F4A25F"
  nav-chassis: "#1C1F23"
  nav-key: "#2A2E34"
  nav-key-border: "#373C43"
  nav-key-edge: "#0A0B0D"
  nav-ink: "#D3D6DA"
  nav-blue-edge: "#172F6E"
typography:
  display:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.8rem, 2.9vw, 2.55rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.022em"
    fontVariation: "'wdth' 87.5"
  lcd-figure:
    fontFamily: "Doto, Archivo, monospace"
    fontSize: "clamp(2.6rem, 4.6vw, 3.6rem)"
    fontWeight: 900
    lineHeight: 0.9
    fontFeature: "'tnum' 1"
  lcd-small:
    fontFamily: "Doto, Archivo, monospace"
    fontSize: "1.45rem"
    fontWeight: 900
    lineHeight: 1
    fontFeature: "'tnum' 1"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 800
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 87.5"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.12rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 87.5"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.64rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 87.5"
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
    padding: "0 14px"
    height: "38px"
  nav-tab-active:
    backgroundColor: "{colors.blue}"
    textColor: "#ffffff"
    rounded: "{rounded.key}"
---

# Design System: Mathorizon

## Overview

**Creative North Star: "The Scientific Calculator"**

Mathorizon is built as an instrument, not a brochure. Every surface is a part of a scientific calculator: pale-gray (light) or graphite (dark) chassis panels with hard 1px edges and near-square corners, keys that stand on a darker solid bottom edge and sink when pressed, and a recessed green-gray LCD that carries the numbers that matter. The student reads their progress off the display and presses a chapter key to continue; the interface is operated, not browsed.

Density is high and tabular. Chapters are laid out as a keypad, exercise banks are drawn honestly as dot matrices (one dot per exercise, solved dots lit), missions are segmented counters, and numerals are always tabular. Color is not decoration: four legend colors each have one job, the way function labels are printed on a real calculator. Motion is the motion of hardware: a key sinks, an LCD refreshes in stepped frames, dots light in one scan. Nothing tweens, glows, or floats.

Scope: this system currently covers the Capitole tab (`capitole.html`, the React island in `src/capitole/`) and the shared navbar (`partials/nav.html`, the "NAVBAR — calculator skin" block at the end of `css/style.css`). The other tabs (Simulare, Antrenament, Clase, Pachete, profile, class pages, admin) still render the legacy look from `css/style.css`. This file describes the world those tabs are meant to move into; it does not describe their current state. Rejected by the user for this world: rounded soft-shadow cards, gradients, glass, neon, and empty minimalism.

**Key Characteristics:**
- Chassis panels: flat fills, 1px edges, 3px corners, no drop shadows.
- Keys: solid darker bottom edge at rest, brightness dim on hover, sink on press.
- LCD surfaces carry the key numbers, set in Doto dot-matrix, over a faint unlit pixel lattice.
- Archivo at 87.5% width for all display and UI type.
- Four legend colors with fixed jobs; everything else is ink on chassis.
- Light and dark themes are both fully tokenized; dark is a backlit night mode, not an inversion.

## Colors

A neutral warm-gray chassis with ink text, one green-gray LCD, and four saturated legend colors used only for their assigned jobs.

### Primary
- **Key Blue** (#2F5FD0; dark #5C8CF2): the brand color and the primary key. Lit keys (active nav tab, active grade, primary buttons, active phone tab), focus rings, the hero title accent line, the "last worked here" mark, the current user's leaderboard rank, and the Algebră legend. Its bottom edge is **Blue Edge** (#1B3A8A; dark #1E3B86). The current user's leaderboard row sits on **Blue Wash** (9% blue; 12% in dark).

### Secondary
- **Done Green** (#1D7A57; dark #4DBE8E): completion and the Geometrie legend. Done marks, completed mission checks and their filled cells.
- **Analiză Red** (#BF3D29; dark #EE7560): the Analiză legend only.

### Tertiary
- **XP Orange** (#DE6A1E; dark #F08A3C): XP and nothing else. The XP section icon and the reward mark of a completed mission. XP figures in text use **XP Orange Ink** (#A94A0B; dark #F4A25F) for contrast on the chassis.

### Neutral
- **Chassis** (#E3E4DF; dark #111316): the page ground behind everything.
- **Panel** (#F0F1ED; dark #181B1F): side rails, modals, the phone tab bar.
- **Panel Edge** (#C3C6BD; dark #2B2F35): the 1px edge on every panel and key.
- **Key Face** (#FBFBF8; dark #23272D) with **Key Edge** (#B4B8AE; dark #08090B): the face and bottom edge of every neutral key.
- **Rule** (#D3D6CE; dark #262A30): internal dividers inside panels and keys.
- **Ink** (#17191C; dark #ECEDE9), **Ink 2** (#464B52; dark #B5BAC0), **Ink 3** (#646A71; dark #8D939A): primary text, secondary text (descriptions), and tertiary text (counts, labels, disabled "în curând" states).
- **Ghost** (11% ink; 9% in dark): unlit matrix dots, empty mission cells, avatar placeholders.
- **LCD Glass** (#C3CDB0; dark backlit #141B11) with **LCD Ink** (#1C2718; dark #BCE296), **LCD Dim** and **LCD Ghost** (unlit segments and the pixel lattice): every display surface.
- **Bezel** (#2A2E33; dark #050607): the frame around the main LCD and the empty profile cover strip.
- **Nav chassis** (#1C1F23), **nav key** (#2A2E34, border #373C43, edge #0A0B0D), **nav ink** (#D3D6DA): the navbar is the calculator's dark top strip and looks the same in both themes. Its lit tab uses Key Blue with a deeper edge (#172F6E). Its counters use the dark LCD pair.

### Named Rules
**The Legend Rule.** Each legend color has exactly one job set: blue is primary action and Algebră, green is done and Geometrie, red is Analiză, orange is XP. A chapter's color comes from this map, never from the older per-category colors in `js/data.js`. A new chapter without an assigned legend falls back to ink, not to a fifth hue.

**The Orange Is Earned Rule.** Orange appears only where XP is shown or awarded. It never marks navigation, state, or a chapter.

**The Flat Chassis Rule.** No gradients anywhere. The only patterned fill in the system is the LCD's unlit dot lattice (a 4px radial-dot grid in LCD Ghost), because a real dot-matrix display has one.

## Typography

**Display Font:** Archivo (with system-ui, -apple-system, Segoe UI), loaded as a variable font (wdth 62-125, wght 400-800)
**Body Font:** Archivo
**Label/Mono Font:** Doto (weights 600-900), for LCD numerals only
**Math Legend Font:** KaTeX_Main (with Cambria Math, Times New Roman), for chapter symbols

**Character:** A condensed grotesk key legend (Archivo at `font-stretch: 87.5%`, weight 800) paired with dot-matrix display numerals. The pairing reads as the printing on a calculator body next to the digits on its screen.

### Hierarchy
- **Display** (800, clamp(1.8rem, 2.9vw, 2.55rem), 1.08, -0.022em, 87.5% width): the page h1, left-aligned, balanced wrap; the second line is a block in Key Blue.
- **LCD Figure** (Doto 900, clamp(2.6rem, 4.6vw, 3.6rem), 0.9, tabular): the main readout on the hero LCD. Its companions are the total (Doto 900, clamp(1.3rem, 2vw, 1.7rem)) and the percent (Doto 900, 1.5rem).
- **LCD Small** (Doto 900, 1.45rem, 1, tabular, right-aligned): the profile stat displays; the navbar token and streak counters use Doto 900 at 1.2rem.
- **Headline** (800, 1.35rem, -0.01em, 87.5% width): the profile name.
- **Title** (800, 1.12rem, 1.2, -0.01em, 87.5% width): chapter key names. Panel section titles use 800 at 1rem, profile subsection titles 800 at 0.95rem, both at 87.5% width.
- **Body** (400, 0.8rem, 1.45): key descriptions and panel copy. List items (mission titles, leaderboard names) are 600 at 0.84rem.
- **Label** (700, 0.6-0.66rem, letter-spacing 0.04-0.12em, uppercase): printed legends on keys (chapter subcategories in the legend color, 0.08em, 87.5% width), the "în curând" plate, stat labels under the small displays, the done / last-worked marks, and table column heads. LCD annunciators are Archivo 700 at 0.62rem, 0.1em.
- **Button** (700, 0.86rem; small 0.8rem). Nav tabs are 600 at 0.88rem, 0.01em.

### Named Rules
**The LCD-Only Doto Rule.** Doto is set only on an LCD surface (the hero display, the profile stat displays, the navbar counters). Never on a chassis, a key, a panel title, or body text. The words on an LCD (annunciators, the typed input line, the unit "rezolvate") stay in Archivo.

**The Tabular Rule.** Every number that can change (counts, percents, XP, ranks, levels) is set with `font-variant-numeric: tabular-nums`.

**The Condensed Legend Rule.** Headings and key legends use Archivo at 87.5% width and weight 800. Do not substitute a system display face.

## Layout

A strict three-column instrument at desktop width. From 1180px the left rail (profile) and right rail (missions, leaderboard) are fixed to the viewport edges, full height below the navbar, each `--cap-rail` wide (340px, 300px at or below 1400px), and scroll on their own. The middle column reserves the rail width plus a 24px gap on each side by margin and holds the title, the LCD, the grade keys and the chapter keypad inside a shell capped at 1760px with 28px side padding.

The chapter keypad is a two-column grid (18px row gap, 16px column gap). Each key is a size container: below 300px of key width the face tightens (14px padding, smaller symbol and description) and marks drop their words. Between 640px and 1180px the three columns stack with the middle one first. At 640px and below the keypad is one column, the shell padding drops to 16px, and the three columns become three full-screen panes on a sliding track switched by a fixed bottom tab bar (62px plus the safe-area inset), with the middle pane (Capitole) as the default.

Spacing rhythm: 4px key edge, 8px small gaps, 14-16px internal gaps in keys and panels, 20px panel padding, 24px column gap, 28px section gap (22px at or below 900px). Rails meet the viewport edge flush: their outer border and corners are removed so they read as the chassis' side panels.

## Elevation & Depth

The system is flat chassis plus physical key travel. Panels never cast shadows; they are separated from the ground by a 1px edge and a tonal step. The only raised objects are keys, and their height is a solid, unblurred bottom edge in a darker shade of the face color. Displays are recessed instead: an inset shade pushes the glass below the chassis. The single blurred shadow in the system belongs to overlays (modals and the phone menu), which float above the instrument rather than sit on it.

### Shadow Vocabulary
- **Key edge** (`box-shadow: 0 4px 0 0 var(--k-key-edge)`): chapter keys at rest. On press it collapses to `0 0 0 0` and the face moves down `translateY(4px)`.
- **Button edge** (`box-shadow: 0 3px 0 0 <edge color>`): buttons, grade keys, nav tabs, tab bar keys, modal close. Collapses with a `translateY(3px)` sink on press. The edge color is Key Edge on neutral keys and Blue Edge on lit keys.
- **LCD bezel** (`box-shadow: 0 0 0 7px var(--k-bezel), 0 7px 0 7px color-mix(in srgb, var(--k-bezel) 70%, black), inset 0 3px 6px rgba(0, 0, 0, 0.22)`): the main display: a spread ring frame, a solid lower lip, and an inset recess.
- **LCD recess** (`box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.18)`): small displays (XP bar, profile stats). The navbar counters use `inset 0 2px 4px rgba(0, 0, 0, 0.55)`.
- **Overlay** (`box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.4)`): modals only.

### Named Rules
**The Key Travel Rule.** Rest: darker solid bottom edge. Hover: `filter: brightness(0.95)` (0.96 on chapter keys, 0.94 in the navbar) and nothing else; no lift, no color swap, no glow. Press: the edge collapses and the key sinks by the edge height, both on one 0.1s transition so they move in lockstep. Every color property is restated under `:hover` so an older shared rule cannot leak a color swap in.

**The No Soft Card Rule.** A panel or key never carries a blurred drop shadow. Depth on the chassis is an edge, a tone, or an inset; blur is reserved for overlays.

## Shapes

Near-square, machined corners: 3px on panels, displays, plates and avatars; 4px on keys and buttons; 1px on matrix dots, mission cells and XP segments. Rails lose their corners where they meet the viewport. Every panel and key carries a 1px solid edge. Things that are not pressable yet (a chapter with no published exercises, the grade IX option) are printed flat on the chassis: dashed 1px outline, transparent fill, no bottom edge, text in Ink 3. Internal structure is drawn with 1px Rule lines, never with extra boxes.

## Components

### Buttons (keys)
Tactile and mechanical: every button is a key.
- **Shape:** 4px corners, 1px edge, 40px tall (36px small), 0 18px padding, 700 weight at 0.86rem, 16px icon with an 8px gap.
- **Neutral key:** Key Face with Panel Edge border and a 3px Key Edge bottom.
- **Primary key:** Key Blue face, Blue Edge border and bottom edge, white text.
- **Hover / Press:** per the Key Travel Rule; focus is a 2px Key Blue outline at 3px offset.
- **Printed (not yet available):** dashed edge, transparent, no bottom edge, `cursor: not-allowed`, with an uppercase "în curând" badge.

### Chapter Keys (signature)
The keypad is the page's center. Each chapter is one large key: Key Face, 1px Panel Edge border, 4px corners, 4px Key Edge bottom, 16px 18px 14px padding, 14px internal gap. Inside, top to bottom: the chapter symbol in the math font at 2.3rem in the legend color, the name (Title) and description (Body in Ink 2); the printed legend row of subcategories (Label, legend color, one line, overflow collapsed into "+N tipuri"); the dot matrix; and a foot separated by a 1px Rule with the solved count, state marks (a flag for "last worked here" in blue, a check for done in green, both uppercase 0.66rem with a 13px icon) and the percent in the legend color. The focus outline takes the key's legend color. Hovering raises the unlit matrix dots to 16% of the legend color so the lit ones read against what is left; pressing sinks the key 4px.

### Dot Matrix (signature)
One dot per exercise in the chapter's bank, 1px corners, unlit in Ghost and lit in the legend color. The dot pitch is computed from the exercise count (7px to 34px) so every key's field has similar area while staying exactly one dot per exercise. On first view the solved dots light in one left-to-right scan (0.2s `steps(2)` per dot, the whole matrix within 650ms); with reduced motion they render static.

### LCD Display (signature)
The hero readout: LCD Glass with the 4px dot lattice, 3px corners, a 7px bezel ring with a lower lip, and an inset recess. Top row: annunciators (XII lit, IX ghosted, then BAC, and a Σ on the right) in Archivo 700. Middle: the input line typing a rotating phrase with a blinking block cursor (1.05s `steps(1)`). Bottom: percent at left, the big Doto figure and total right-aligned with the Archivo unit. Figures do not count up; a new value strobes in over three stepped frames (0.16s). At phone width the input line reserves two lines so typing never moves the figure. Small displays (profile stats, the 20-segment XP bar, navbar counters) reuse the glass and a lighter recess.

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
Rows separated by 1px Rule lines, 8px 6px padding: rank (tabular, 800; top three in Ink, the user in blue), a 30px square-cornered avatar with initials on Ghost, name and level, XP right-aligned. The user's own row sits on Blue Wash with an uppercase "tu" tag in blue. The full list opens in a chassis-panel modal with a five-column table grid and uppercase column heads.

### Profile Panel
A cover strip (the user's photo, or a plain Bezel strip, never a gradient), an 88px square-cornered avatar overlapping it with a 3px Panel ring, name (Headline), an uppercase role line in blue, then level with a 20-segment LCD XP bar, three small stat displays, and achievements. Empty states are dashed plates with a line icon and Ink 3 text.

### Navigation
The navbar is the calculator's dark top strip, identical in both themes. Tabs are keys: nav key face, 1px border, 4px corners, 3px nav edge, 38px tall, 0 14px padding, Archivo 600 at 0.88rem. The active tab (and the primary guest action) is lit Key Blue with a deeper blue edge. Icon buttons and the profile button share the key treatment. Token and streak counters are small backlit LCDs with Doto numerals; at or below 1400px the token word drops. On phones the menu drops as a nav-chassis panel with the current page as a lit blue row; within Capitole a fixed bottom tab bar of three keys (Profil, Capitole, Misiuni) switches panes, the active one lit blue.

## Do's and Don'ts

### Do:
- **Do** build every pressable control as a key: solid darker bottom edge (3px buttons, 4px chapter keys), brightness dim only on hover, collapse-and-sink on press over 0.1s.
- **Do** restate background, color and border-color under `:hover` on every key so legacy shared rules cannot swap colors in.
- **Do** put the numbers a student should read first on an LCD surface, in Doto 900 with tabular numerals.
- **Do** assign color by the Legend Rule: blue for primary and Algebră, green for done and Geometrie, red for Analiză, orange for XP.
- **Do** show real quantities at their real size: one dot per exercise, one cell per mission step.
- **Do** mark not-yet-available items as printed plates: dashed 1px edge, no fill, no key edge, Ink 3, "în curând".
- **Do** tokenize every color for both `:root` and `[data-theme="dark"]`; dark is a backlit LCD at night (dark glass, pale green segments), not an inversion.
- **Do** use stepped timing (`steps()`) for display changes and honor `prefers-reduced-motion` by rendering static.
- **Do** write all UI copy in Romanian, and punctuate with commas, colons or periods: no em dash in UI copy.

### Don't:
- **Don't** use rounded soft-shadow cards, gradients, glassmorphism, or neon glows; panels are flat with a 1px edge.
- **Don't** set Doto outside an LCD surface.
- **Don't** use orange for anything but XP, and don't introduce a fifth legend hue.
- **Don't** animate numbers with count-ups or tweens; an LCD refreshes.
- **Don't** lift, recolor, or glow a key on hover.
- **Don't** round corners past 4px on panels, keys, or displays.
- **Don't** color chapters from the legacy `js/data.js` category colors.
