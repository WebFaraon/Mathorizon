# Registre Google Sheets <-> Supabase <-> platforma: handoff

Written 2026-10-08 so work can continue after a context loss. Read this first, then `docs/registru-sync.md` (contract and runbook, in Romanian).
Everything below is committed on `main` unless it says "local only". All user-facing text is Romanian, no em dash in UI copy, admin/registru buttons are flat (no 3D), real student names and phones never go in answers or in git.

## 1. What this is

The company keeps one Google Sheets workbook per teacher (the "registre"). The founder wants the platform linked to them instead of the platform's own register:
the **sheet stays the single calculator** (prices, student cost/sold, teacher pay are the sheet's formulas); the platform **reads** the computed values and **writes only input cells**.
Today there are no real registers in the platform: the 27 registers in Drive are **demo** copies written from the demo data (196 groups, 476 student columns, 3788 lessons). Real data comes when real registers are shared with the service account.

```
Google Sheets (registre)  --registru-sync (edge fn, cron every minute)-->  Supabase tables reg_*  --REST (admin token)-->  console (admin.html, mode "Registre")
Google Sheets (registre)  <--registru-apply (edge fn)  <-- reg_commands (queue)  <-- console (RPC reg_enqueue_command)
```

## 2. Ids, accounts, secrets (no secret values here)

| What | Value / where |
|---|---|
| Supabase project | `tfflpivehrrzmklvcyhe` (Free plan, pg_cron + pg_net enabled). Service key is NOT in `.env` (empty), I cannot call Supabase from Node; the user runs SQL in the SQL Editor and deploys with the CLI |
| Edge functions | `registru-sync`, `registru-apply` (both `verify_jwt=false` in `supabase/config.toml`, they check access themselves), `send-class-push` (old) |
| Function secrets (Supabase) | `GOOGLE_SA_KEY` (service account JSON as text), `REG_SYNC_SECRET` (value in gitignored `_import/reg-sync-secret.txt`; its SHA256 prefix is shown in the dashboard, compare to check) |
| Cron | job `registru-sync`, every minute (`* * * * *`), POSTs to `/functions/v1/registru-sync` with header `x-sync-secret`. SQL with the secret: `_import/cron-registru-sync.sql` (local only) |
| Google Cloud project | `mathorizon-registre` |
| Service account | `registre-sync@mathorizon-registre.iam.gserviceaccount.com`, key `_import/google-service-account.json` (local only). A service account has NO Drive storage: it cannot create files, only read/edit shared ones. Needs **Viewer** to read a register, **Editor** to write in it |
| OAuth (to create files as the user) | client `_import/google-oauth-client.json`, token `_import/google-oauth-token.json`, made by `scripts/registru-import/google/login.js`. The app is in Testing mode (user `bivoldragos6@gmail.com` is a test user): the refresh token expires after ~7 days, rerun `login.js` |
| Drive | demo folder `Registre demo Mathorizon` id `10hLceGMw2BTLzDImL_uXrfOEfMBzYS-O` (owner bivoldragos6, SA is Editor). Clean template v2 `17Jtu8BjDDjtr3uaig3Jijl7eeCLcAs5DIwsmHFHq2so` (tabs Total achitari, Disponibilitate, Disponibilitate Vara, Orar 1, hidden CONFIGURARI; managers "Ceban Olga", "Botnari Radu" and cabinet 18 were added to its CONFIGURARI because the demo uses them). Old template v1 `1NRr40-0Z48jcsG2ZY73Lh3Pk2rxmdgSalTH5LEuiBl0` is obsolete (can be trashed) |
| The user's REAL register | "Bivol Dragos Registru EXAMEN.MD OFFLINE 2025-2026", id `1zSYuq41b5nJjzc3442I_tHySAgWd6NL2Jucc1PKMsAk`, owned by the company account matematicamoldova@gmail.com, SA has Viewer. Local copy `C:\Users\Dragos\Downloads\Bivol Dragos Registru EXAMEN.MD OFFLINE 2025-2026.xlsx`. Its importer report is in `_import/out/` (real names inside: local only) |
| Local only (gitignored) | everything in `_import/`: keys, tokens, `demo/links.json` (teacher -> workbook id + group tab ids), `demo/snapshot.json` (the reg_* tables as the sync stores them, for tests), `demo/seed-workbooks.sql`, `out/` (importer reports) |

## 3. Database (migrations in `supabase/migrations/`, all run by the user)

- `20261008120000_registre_sync.sql`: `reg_workbooks`, `reg_groups`, `reg_students`, `reg_lessons`, `reg_sync_runs`; RLS (admin sees all, a teacher sees the workbook whose `owner_user_id` is his); `reg_is_admin()`, `reg_can_see()`; `reg_apply_group(workbook, group jsonb)` (replaces one group in a transaction) and `reg_prune_groups` (service role only). Remember the grant gotcha: DROP+CREATE of a function re-grants EXECUTE to anon, every migration revokes explicitly.
- `20261008180000_registre_sync_teacher.sql`: `reg_workbooks.project/config/teacher_data/issues`; `reg_spreadsheet_id()`, `reg_add_workbook(link_or_id, teacher, owner, year)`, `reg_update_workbook(id, enabled, owner, clear_owner, year)` (admin only).
- `20261008200000_registre_commands.sql`: `reg_commands` (pending/running/done/noop/invalid/conflict/failed), `reg_can_write()` (= admin today; the one place to add managers), `reg_enqueue_command(workbook, sheet_id, type, payload, id)`.
- `20261008220000_registre_transfer.sql`: adds `TRANSFER` to the allowed command types and makes `reg_enqueue_command` check the destination group (`payload.toWorkbook` / `toSheet`).
- `reg_workbooks` also holds `drive_modified`, `last_synced_at` (last check) and `last_full_sync_at` (last real read; the console polls the newest value to know when to reload).

## 4. Code map

Shared by Node and Deno (plain ES modules, `supabase/functions/_shared/registru/`; Node reaches them through thin CJS wrappers in `scripts/registru-import/`):
`parse.mjs` (the register parser: group tab, students D..Z, lessons rows 9..198, year inferred from the sequence of rows), `link.mjs` (columns -> people by phone + name tokens), `validate.mjs` (findings + `TITLES`), `pay.mjs` (prices, teacher pay formula), `sync-core.mjs` (`valuesBook`, `syncWorkbook`: peek modifiedTime, read, parse, validate, hash per group, replace changed groups, prune deleted tabs, workbook data), `google.mjs` (JWT login read/write scopes, `readWorkbook`, `driveModified`, `createAdapter` for live reads/writes, `tabTitle`, `QuotaError`), `commands.mjs` (planners ADD_STUDENT, SET_STATUS, SET_MANAGER, ADD_PAYMENT, ADD_DISCOUNT and `planTransfer`), `apply.mjs` (`apply` sync for tests, `applyAsync` and `applyTransferAsync` against Google), `pay.mjs` also holds `splitMoney` (the Calculator's transfer split), `memory-book.mjs` (a register in memory: tests and planning).
Functions: `supabase/functions/registru-sync/index.ts`, `registru-apply/index.ts`.
Console (browser): `js/admin/registry-dataset.js` (`build(tables)` -> teachers, managers, rooms, groups, persons, transfers, ledger raw data; also loaded by Node tests), `js/admin/registry-mode.js` (Demo|Registre switch, `loadTables`, `refresh`, 45 s `poll`, `command`, `enrol`), `js/admin/mock-data.js` (`useData(ds)`/`useDemo()` swap the data inside the same arrays; `readOnly()`, `blocked()`, `registry`), `js/admin/registru-data.js` (`fromRegistry`, sheet money, pay from the sheet, `drift`), `js/admin/sheet-links.js` (`groupUrl`, `teacherUrl`: demo map or the registry data), views: `sincronizare.js` (state, issues with cell links, add register, settings, recent writes), `elevi.js` ("In registru" section, "Arata in registru" button), `inscriere.js` (registry branch writes ADD_STUDENT), Repartizare and Disponibilitate (click on a group opens its tab in Sheets).
Tools (`scripts/registru-import/`): `run.js` importer CLI (`npm run import:registru -- "<xlsx>"` -> `_import/out/*.report.md`), `google/{auth,login,whoami,make-template,build-registers,fix-schedules,verify-registers,sync-local,apply-local,seed-sql}.js`, `demo-group.js`.
Tests: `npm run check:demo` (21,267), `npm run check:sync` (67), `npm run check:registry` (13,888, needs `_import/demo/snapshot.json`, skipped without it). Live proofs: `google/verify-registers.js` (Sheets formulas == console, 4,821 values), `google/apply-local.js` (writes on a live demo register and puts the cells back), `google/sync-local.js [--save] [--twice]`.

## 5. Behaviour to remember

- Ownership: the sheet owns formulas (rows 2, 5, 6, column C), marks, topics, dates, group header cells, schedule. Managers/admin may write row 1 (student header `Name+373XXXXXXXX`), 3 (payments, a `SUM(...)`), 4 (discounts), 7 (manager), 8 (status). Writes never rename tabs, insert/delete rows or columns, or touch formulas: the admin's OTHER confidential sheets (bank, transfers) import from the registers (probably IMPORTRANGE by file id, tab name, range); their formulas are still unknown (user has no access yet). Never replace a real register file, never ask for those sheets' data.
- Safety of a write: plan with expected old values -> re-read the cells just before -> write -> read back -> result kept on the command. A column with marks but no header is never reused. A column given by number is accepted only while its header still matches name and phone. Google Sheets has no compare-and-set: a few ms window remains.
- Money rules (from the real file): student price by group size {1:608, 2:348, 3:288, 4:248, 5:228, 6:218, 7:0 (invalid), 8:148}; cost = count of cells exactly PREZENT or ABSENT in the column x price (**all rows, even a row with no date or topic**); teacher pay per lesson only when date and topic exist, by size, charged students and teacher level (`pay.mjs`). In Registre mode the console shows the sheet's own cost/sold and flags `drift` when its own count differs (message in the student drawer).
- Dates have no year ("4 August"): year from the title's school year, then +1 when months wrap; a register covers one school year. Demo lessons run past Aug 2026, so groups that start in Sept 2026 get the year one back (known demo artifact, tolerated in the check).
- A lesson of two hours is two schedule rows ("Joi 10", "Joi 11"). Irregular schedules (different hours per day) keep the first day's window. A schedule row with no day and hour is a stub (warning).
- One person across groups: same phone + name-token subset; no phone -> by name only (flagged). Transfers in the console are synthesized from the chain of a person's columns (date = first lesson in the new group, never on or before his last lesson in the old one).
- `Total achitari` has room for 30 payments (rows 3..32): a teacher with more loses the rest in the sheet's total. `Oră de probă confirmată` and `Înlocuire` students are not counted by the sheet's "Elevi activi/ora de proba" totals (the console counts them).
- Demo caveats: all 27 demo registers are titled OFFLINE (projects Online and Matematica.md do not show), `instabil` status does not exist in registers (demo wrote it as Activ), teacher phone empty, room seats assumed 8.
- Google quota: 60 read requests/minute/project. The sync avoids it by asking Drive for `modifiedTime` first (a register unchanged and fully read less than a day ago is not read); on a 429 the run stops and the next one continues (`QuotaError`).
- Freshness: Sheets -> DB within ~1-2 min (cron every minute); open console reloads itself within 45 s of a newer read (not while typing or under a dialog); the green pill has a reload button; the Sincronizare page has "Sincronizeaza acum".

## 5b. Transfer (done 2026-10-08)

Command `TRANSFER` on the OLD group, the new group in the payload (the two groups may be in two registers): phase 1 writes the student's column in the new group (header, manager, status, the part of the money that moves as `SUM(x)`), phase 2 closes the old column (status Transferat, the moved part taken out as one more minus term in the payments and discounts SUMs). The split is `splitMoney(A, R, C)` computed in the function from the old column's cells (A = row 3, R = row 4, C = row 5, calculated by the sheet); the console sends `expect {A,R,C}` and any difference is refused. Each phase is one atomic `spreadsheets.batchUpdate` in its register. Phase 2 failing = `failed/half-done`; the same command retried finishes only phase 2. The console dialog (`js/admin/transfer.js`) has a registry branch (`commitRegistry`, retry button, no undo); `AdminRegistry.transfer` loops the students, then syncs both registers and refreshes. Proofs: `check:sync` (85) and `google/transfer-local.js` (two live demo registers, cells restored).

## 6. Deploy commands (user runs them)

```
npx supabase functions deploy registru-sync  --project-ref tfflpivehrrzmklvcyhe --use-api --no-verify-jwt
npx supabase functions deploy registru-apply --project-ref tfflpivehrrzmklvcyhe --use-api --no-verify-jwt
```
Redeploy BOTH whenever anything in `supabase/functions/` changes (the shared modules are bundled into each). The site is static (served from `main`); Ctrl+F5 to load new JS.

## 7. What is left (as of 2026-10-08)

1. **Rehearsal on a real register**, local only: run the importer/console dataset on the real Bivol register, see the issues and how the console looks (recommended next).
2. ~~Transfer between groups~~ DONE (see section 9).
3. **New groups from Inscriere**: a new tab (`duplicateSheet` of the template tab "Orar 1"), name in the Total tab's F4:AI4 list. Today the dialog says new groups are created in the register.
4. **Group-level writes from the console** (state, schedule, room): read-only in Registre mode today.
5. **Apps Script `onEdit`** to call the sync in seconds (optional; the minute cron may be enough).
6. **Roles**: managers and teachers as platform accounts (`reg_can_write()`), a teacher-facing page (RLS already limits a teacher to his workbook via `owner_user_id`).
7. **Real data checklist** (`docs/registru-sync.md` section 7): share each real register with the SA (Editor to write), "Adauga registru", fix the issues in Sheets (24 errors / 75 warnings in the Bivol register), then switch to Registre. Open questions for the founder: the confidential sheets' IMPORTRANGE formulas, whether Oră de probă confirmată / Înlocuire count as active in reports, extending the 30-payment table, the year-less dates.
8. **Ops**: Supabase Free pauses an inactive project after about a week and has no daily backups: Pro is recommended for real data; there is no alert when a register fails (only the Sincronizare page); rotate `REG_SYNC_SECRET` if it leaks (update the secret AND the cron job).
9. **Cleanup**: trash template v1 in Drive; test students left in demo registers (e.g. "Mirzac Samuel" column J of the Sula Vlad register, "Testescu Ionela" runs were reverted); the 3 old "Gutu Petru Registru ..." files in the user's Drive root are early xlsx imports.
10. Not derivable from registers: teacher phone, room seats, group project (from the title), status-change history (no journey log in Registre mode).

## 8. Working notes (tooling traps I hit)

- The Bash tool breaks on heredocs that contain apostrophes (it evals the command): write files with the Write tool or from a Python script file; the same for patch scripts. Python `'''` strings eat backslashes: check regexes after patching.
- Most files in the repo are CRLF; patch scripts read with `newline=''`, normalise to LF, then write back CRLF.
- A background `python -m http.server &` inside a command dies when the command ends: run it as the whole background command (`run_in_background`) and stop it with PowerShell (`Get-CimInstance Win32_Process`... `Stop-Process`). Serve the repo root on 8099 to test admin pages; stub `js/auth.js` and route `/rest/v1/reg_*` (honour the `Range` header for pagination) from `_import/demo/snapshot.json`; serve the snapshot itself from the same server.
- Playwright MCP: routes stack across calls and the browser caches JS; for a clean test open `page.context().newPage()` and use `addInitScript` to set `bm_admin_source`. There is no `require` in `browser_run_code_unsafe`; `fetch` works.
- `google/sync-local.js --save` rewrites the snapshot: run it for ALL teachers (not `--only`). The Google read quota (60/min) can make it wait a minute.
- Registry mode swaps data in place (`D.useData`): any new code that caches objects from `D.groups`/`D.students` must refresh them on `D.onChange`.
