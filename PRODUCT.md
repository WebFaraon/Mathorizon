# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: students in grade XII in Moldova/Romania preparing for the BAC math exam. They open Capitole to decide what to practice today, continue a chapter, or jump into a simulation. Teachers (profesori) also use the site to run virtual classes, but visit the Capitole tab less often than students. Grade IX students (Evaluare Națională) are a planned audience; that track is marked "în curând".

## Product Purpose

Mathorizon is a BAC math preparation platform: a bank of exercises (about 650) organized by chapter, type, and difficulty, each with a step-by-step official-style barem; gamified training with XP, streaks, and daily missions; AI-graded full BAC simulations; and virtual classrooms (homework, catalog, tests, chat, live whiteboard). Success means a student practices regularly and arrives at the BAC knowing how points are awarded.

## Positioning

Exercises and grading follow the real BAC barem structure: solutions are broken into scored steps calibrated against official baremuri, and simulations are graded criterion by criterion the way the exam is. It is built for the Romanian-language BAC specifically, not generic math practice.

## Operating Context

Used on laptops at home and heavily on phones. Students return daily (streaks, daily missions, leaderboard). Main navigation tabs: Capitole, Simulare, Antrenament, Clase, Pachete. Tokens gate AI-graded simulations. Light and dark themes are both supported.

## Capabilities and Constraints

- Vanilla HTML/CSS/JS across most pages with one shared stylesheet (`css/style.css`); the Capitole tab is a React + TypeScript island (`src/capitole/`, built with `npm run build:react`).
- The navbar is shared markup (`partials/nav.html`) used by every tab.
- All user-facing copy is Romanian. Do not use em dashes in UI copy.
- Math is rendered with KaTeX.
- Payments are not wired yet; plans exist in the data model only.

## Brand Commitments

- Name: Mathorizon. The existing logo (`assets/images/`) is kept.
- Blue stays the primary brand color.
- Dark theme must be supported and look intentional.

## Evidence on Hand

Real exercise counts per chapter, real user XP and leaderboard data from Supabase. No testimonials, press, or pass-rate statistics exist; do not invent them.

## Product Principles

1. Practice first: the fastest path from opening the site to solving an exercise wins.
2. Exam-true: structure, scoring, and language mirror the real BAC.
3. Progress is visible and earned, never inflated.
4. Clarity and minimalism over decoration; performance is part of quality (smooth 60fps motion).
