# Mathorizon: working context

Read this first. It says what the project is, how the user wants you to work, what already exists, and where the latest work stopped. Last updated 2026-10-29. Deeper notes live in `docs/` and in `DESIGN.md` / `PRODUCT.md`.

## What this is

Mathorizon is a Romanian/Moldovan BAC math-prep platform that grew into a classroom platform, plus an admin console tied to the teachers' Google Sheets registers (one register workbook per teacher, one tab per group). The public site and the admin console are plain HTML, CSS and vanilla JS (no framework), with one React island (`src/capitole/`, built with vite). Backend is Supabase (Postgres with RLS, security-definer RPCs, triggers, pg_cron, pg_net, Edge Functions in Deno, Realtime). AI parts use Gemini (`api/`).

The product is for a school business. A manager enrols students and builds groups in the console, teachers keep their register in Google Sheets, students use the platform (classes, homework, tests, live whiteboard). The central idea of the last weeks: **the register is the source of truth**, and the platform, the console and Telegram follow it within seconds.

## How the user wants you to work (standing rules)

- Reply in **Romanian**. Short, plain, no code talk unless asked. Founder-facing material must not mention code, migrations or scripts.
- **No em dash ("—") in any user-facing text.** Use a comma, colon or period.
- After each finished round: **commit and push to `main` without asking**. The checkout is often on the branch `claude/gracious-bell-cuzali`, so run `git branch --show-current` and `git fetch` first, confirm `origin/main` is an ancestor of HEAD, then `git push origin HEAD:main`. Never force-push, never `--no-verify`.
- **The user runs database SQL and deploys Edge Functions themself.** You write the migration files and give the exact command. Deploy command: `npx supabase functions deploy <name> --project-ref tfflpivehrrzmklvcyhe --use-api --no-verify-jwt`. When anything under `supabase/functions/` changes, `registru-sync` and `registru-apply` (and `telegram-bot` if touched) must be redeployed. After a `DROP` + `CREATE` of a function, re-check that `anon` did not get EXECUTE back.
- **Never print real names, phones, tokens or keys.** `.env` and `_import/` stay local and out of git. Test accounts `bivoldragos7@gmail.com` (teacher) and `bivoldragos8@gmail.com` (student) are real accounts the user tests on; do not reset their fields blindly and do not save their passwords anywhere.
- **Ask instead of assuming** on delicate business processes (money, who can accept whom, what a status means). Do not retry or work around an action the user or a permission check refused.
- Visual work: verify by looking (screenshot, zoom), at desktop and phone, light and dark. A computed-style diff is not proof that it looks right.
- If something is not tested on real data, say so. Do not claim a feature works end to end if it only ran against mocks.

## Design rules

- The design system is in `DESIGN.md` ("The Scientific Calculator"): chassis panels with 1px edges and 3px corners, keys with a solid darker bottom edge that sink when pressed, a recessed green-gray LCD (Doto font, only for numerals and displays), Plus Jakarta Sans for all other text, tokens `--k-*` in `css/calculator.css`. No gradients, no soft drop shadows on panels, blur only on overlays.
- **Public site: 3D keys** (rest: bottom edge, hover: dim only, press: sink). Restate every colour property under `:hover` so an older shared rule cannot leak a colour swap. Repeated per-row toggles are plain text links, not 3D buttons. Entrance animations must use fill-mode `backwards` (not `both`), or they kill the press sink.
- **Admin console and `registru.html`: flat "ax" style buttons**, tokens `--ax-*` in `css/admin.css`. No 3D there.
- Terminology: rarity is Comun / Rar / Epic / Legendar (never Ușor/Mediu/Greu).
- Pages already moved into the calculator world: Capitole, category, landing, profile, `auth.html`, Simulare setup, Clase list, a single class, the live whiteboard. Still legacy look from `css/style.css`: Antrenament, Pachete, admin tools pages, exam and results views, the simulation runner.
- The class pages load `css/class-detail.css`, which styles all fields and `.icon-btn` with ID-level specificity. A new rule that must win there needs `body:has(#classRoot) > #someId ...` specificity (see `css/whiteboard.css`).

## Repo map

- Public pages: `index.html`, `capitole.html`, `category.html`, `training.html`, `bac.html`, `classes.html`, `class.html`, `profile.html`, `pachete.html`, `auth.html`; admin: `admin.html`, `registru.html`.
- JS: `js/classes-page.js` (Clase list, teacher and student views, join requests), `js/classes-registry.js` (reads register groups for a teacher), `js/class-page.js` (one class: Sumar, Mesaje, Teme, Simulări, Tablă, Catalog, Meet block), `js/class-registry-view.js`, `js/whiteboard.js` (live board, Fabric.js), `js/join-badge.js`, `js/profile-page.js` (Telegram card, Registru button), `js/admin/*` (console: `shell.js` NAV, `ui.js` helpers, `views/*`, `registry-*.js` data layer).
- CSS: `css/style.css` (legacy, huge), `css/calculator.css` (tokens + calculator world), `css/class-detail.css`, `css/whiteboard.css`, `css/admin.css` + `css/admin/*`.
- Backend: `supabase/migrations/*` (apply in order; the user runs them), `supabase/functions/` (`registru-sync`, `registru-apply`, `registru-replace`, `telegram-bot`, `send-class-push`, `_shared/registru/*`, `_shared/telegram/bot.mjs`), `supabase/manual/*` (SQL the user runs by hand after reading it).
- Checks (plain node, no framework): `npm run check:sync` (274 checks), `check:meet` (43), `check:telegram` (44), `check:registry`, `check:demo`, `check:replacements`, `lint:explicatii`. Run the relevant ones after touching the logic they cover; keep them passing.
- Docs: `docs/registre-handoff.md` (read first for the registers), `docs/registru-sync.md`, `docs/grupe-startare-si-cabinete.md` (group rules, classes from register, Meet, Telegram), `docs/inlocuiri.md` (substitute teachers), `docs/registre-format-nou.md`, `docs/apps-script.md`, `docs/barem-explicatii.md`.

## How the register link works

- Tables: `reg_workbooks` (`owner_user_id` links the teacher account; `teacher_data` json incl. `meet`, `totalSheetId`), `reg_groups`, `reg_students`, `reg_lessons`; `classes.reg_group_id`; `class_members`; `class_member_links` (teacher-only: account <-> student name in the register); `class_join_requests`; `class_join_attempts` (throttle); `group_start_requests`; `telegram_bot`, `telegram_links`, `telegram_link_codes`.
- Read: `registru-sync` runs every minute (pg_cron job) and an Apps Script `onEdit` hook gives second-level updates. Write: `registru-apply` (commands queue `reg_commands`). Service account `registre-sync@mathorizon-registre.iam.gserviceaccount.com` must be Editor on each register.
- Attendance, lesson topic and lesson date are written **only in Sheets**; the platform blocks writing them (triggers). Catalog on the platform shows grades only.
- Start rule: status "Startează" is set automatically when enrolled students reach `START_MIN` (`{2:2,3:2,4:3,5:4,6:4,8:6,10:6}`, in `_shared/registru/start-rule.mjs`). Only 4 of 6 and 2 of 3 are confirmed by the business; 2/4/5/8/10 are still open. Counted statuses: Activ, Oră de probă, Oră de probă confirmată.

## What changed since 14 October 2026 (all on `main`)

1. **Group rules** (docs/grupe-startare-si-cabinete.md): auto Startează, mandatory enrolment fields (format Online/Offline, the four general fields), optional cabinet for new groups, schedule rule (two consecutive hours in one day, or one hour on two different days), individual lessons have no trial hour.
2. **Clase from the register**: each register group of a linked teacher gets a class and an invite code via DB triggers (`20261015120000`). Teachers can no longer create classes (`20261028100000`); `supabase/manual/sterge-clasele-fara-registru.sql` removes hand-made ones (the user reviews and runs it). Compact cards (`regCardHTML`), ~4 per row on desktop, whole card opens the class; day filter as 7 keys; weekday letters are two letters (Lu Ma Mi Jo Vi Sâ Du) because M/M was ambiguous.
3. **Join by request** (`20261016100000`, `20261028120000`): student enters the code and sends a request; only the teacher accepts (decision of the business for now), can tie the student to a name in the register; badge in the nav (`join-badge.js`); realtime; 10 attempts per 15 minutes then blocked; after a rejection retry after 24 h. Student's own requests have a dedicated card (`studentRequestsHTML`, `.cl-req--mine`).
4. **Sumar and Catalog follow the register** (roster, status, manager, enrolment and leave dates). Audit fixed leaks: classes were readable by any logged-in user, now scoped (`20261028140000`); orphan links removed with the member (`20261028150000`).
5. **Google Meet** (`20261029100000`, `20261029110000`): teacher writes one link in the register (cells A16:C16 label, D16:H16 link), students of **Online** groups see "Intră la lecție" in the class header from 10 minutes before the lesson until 10 minutes before its end (`class_meet_at`, `class_meet_link`, Europe/Chisinau). Teachers use their personal Google accounts (decided). `registru-sync` must be deployed for the link to be read.
6. **Telegram bot and Starturi** (`20261029120000`, `supabase/functions/telegram-bot`, `_shared/telegram/bot.mjs`, `scripts/telegram-setup.js`): when a group becomes Startează a row is created in `group_start_requests`; cron (`telegram-dispatch`, every minute, header `x-sync-secret`) sends the teacher "Confirmi startul grupei?" with [Confirm startul] [Nu confirm]; a "no" asks for a reason. Quiet hours: nothing is sent outside 08:00 to 21:00 Chisinau. Teacher connects Telegram from the profile. The manager sees it in the admin page **Starturi** (sections De sunat, Așteaptă profesorul, Nu s-a confirmat, Rezolvate) and in a tile on Acasă. Bot name: `MathorizonBot`.
7. **Admin console polish**: invite code block (copy invitation / copy code) in Înscriere, Repartizare and the Orar group panel (`U.inviteHTML`, only in Registre mode); "Adaugă registru" form (no year, says Editor not Cititor, teacher account required); Meet status line in Disponibilitate; Sincronizare shows the last real read time (`reg_workbooks.last_synced_at`); nav icon colours for Starturi and Sincronizare.
8. **Live whiteboard redesign** (`css/whiteboard.css`, markup in `js/class-page.js` `openWhiteboardLiveView` and `js/whiteboard.js` `_build`): navbar-blue header with LCD title and head-count, toolbar of keys (active tool lit blue), roster panel, zoom on an LCD, paper on graph-paper ground, phone portrait and landscape. Locked student's drawing tools show flat (the old rule never applied because of an unclosed comment in `style.css`). The shared `dc-*` / `gfe-*` toolbar classes are also used by the drawing canvas and the geometry editor: scope any change under `.wb-fullscreen`.
9. **Fixes**: auto-start commands that failed on Google quota are now retried (10-minute bucket id + sweep in `registru-sync`); runs stuck without status are marked failed after 10 minutes; "acum 1 oră" grammar; Clase mobile layouts.

## Where things stand / open items

- **Telegram delivers.** A real question went out at 09:00 and was confirmed on 2026-10-30. A pending request still belongs to a register with no `owner_user_id` (no one to write to until the account is linked).
- **Security pass of 2026-10-31.** Migration `20261031100000_securizare_date.sql` (the user runs it; then `supabase/manual/verifica-securitatea.sql` must return zero rows): admin-only student/class lists (they were readable without login), storage policies for `assignment-files`, no table rights for `anon` except `custom_exercises` and `training_mcq_cache`. `/api/verify-exam` now needs a signed-in user. `.vercelignore` keeps CLAUDE.md, apps-script, `_import` out of the deploy. Not fixed: unlimited account creation in `/api/auth/register-username`, whiteboard broadcast channel is public (session uuid is the only secret).
- **Payments are hidden** (Pachete removed from the nav, profile and BAC dialog; `pachete.html` redirects). Remove the redirect line when payments exist. Antrenament still shows a plain paywall to `plan = free` students (34 of 35 are free); the admin sets plans by hand in Conturi.
- Real registers are not converted yet (the new template with tariffs via IMPORTRANGE from a master file; plan in `docs/registre-format-nou.md`). Everything so far ran on 27 demo registers plus the user's own linked one.
- Meet only appears after `registru-sync` is redeployed, the link is in the register and the group's format is Online.
- Start minimums for group sizes 2, 4, 5, 8, 10 are unconfirmed.
- Optional: `registru-sync` cron could run every 5 minutes instead of every minute (`cron.alter_job`).
- Payments are still stubbed; `user_profiles.plan` is not enforced anywhere.
- Ideas the user has not decided: more bot actions (accept join requests from Telegram, lesson reminders with the Meet link, attendance reminders, substitute confirmations, manager alerts).

## Testing and tooling tips

- Run the site statically: `python -m http.server 8099` from the repo root, as its own background process. For admin Demo mode no login is needed.
- UI checks without a real session: Playwright with an init script that defines a fake `window.BMAuth` (user, role `profesor` or `elev`, a small Supabase query-builder mock with `from().select().eq().in()...then`, `rpc`, `channel`). Disable the cache (`page.route('**/*', r => r.continue())`). For phones use `browser.newContext({viewport, isMobile, deviceScaleFactor})`. Pages saved as plain `.html` files need a viewport meta to be tested at phone width.
- Postgres logic can be tested in memory with pglite; the DB functions are in the migrations.
- Windows + Git Bash: heredocs containing apostrophes break, write files with the editor tool; repo files are mostly CRLF (git warns about LF to CRLF, that is fine); keep generated files out of git (`.playwright-mcp/`, `_newExcel/`, `_import/`).
- Read-only checks against production use the service key from `.env` (never print it). The Supabase MCP connector is not authorised in this environment.
