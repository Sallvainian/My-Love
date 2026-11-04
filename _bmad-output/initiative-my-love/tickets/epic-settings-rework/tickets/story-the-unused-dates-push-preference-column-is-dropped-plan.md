---
title: 'The unused dates push preference column is dropped'
type: 'chore'
ticket: '18'
created: '2026-11-04'
status: done
operator_actions:
  - "Before merging the PR to main, confirm both phones (the owner's iPhone Duo and the partner's iPhone) run story 5.4's update or later."
  - "Before merging the PR to main, re-read the hosted catalog for public.push_preferences read-only and confirm nothing added since 2026-11-04 depends on the dates column."
  - "After the deploy, confirm the hosted schema has no push_preferences.dates column."
  - "After the deploy, on both phones open Settings > Notifications and confirm the switches load and a toggle saves."
baseline_revision: '173a94dc720de0e57cdfbb070fac89069807020f'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 5.4 stopped every date push and every client read or write of `push_preferences.dates`, but kept the column because installed shells still selected and upserted it; R14 is met only once the schema has no such column (second of DW-416's two deploys).

**Approach:** A new migration `supabase/migrations/20261104000000_drop_push_preferences_dates.sql` runs only `alter table public.push_preferences drop column if exists dates` (its column comment goes with it), with a header citing the 2026-11-04 read-only hosted catalog check (no dependents, policies do not name it) and the merge check owed before main. Then: `36_push_preferences.sql` drops `dates` from PUSH-PREF-009/013/016/027 (six switches, `plan(27)` unchanged); `35_push_devices.sql` PUSH-DB-063 becomes `hasnt_column` and its section/header comments say the column is gone (`plan(95)` unchanged); `database.types.ts` is regenerated with `npm run db:types` on CLI 2.122.0 (shim on PATH); the "remains until story 18" text in `src/services/pushPreferencesService.ts` and the test name in `tests/unit/services/pushPreferencesService.test.ts:85` say it was dropped; DW-416 gets `status: done 2026-11-04` and a `resolution:` naming the migration. No already-applied migration is edited; the `push-preferences` local copy still parses copies carrying `dates`; send-push, every other table, policy and function stay as they are.

</intent-contract>

## Implementation Notes

Oneshot: the change is one `drop column if exists`, three-line pgTAP edits, two comment edits, a regenerated types file and a ledger close — well under 100 lines and mechanical. The 2026-11-04 hosted catalog read in the story's Notes stands in for the epic's read-before-drop constraint; the builder needs no hosted access.

- Files: new `supabase/migrations/20261104000000_drop_push_preferences_dates.sql`; `supabase/tests/database/35_push_devices.sql` (header, section comment, PUSH-DB-063 now `hasnt_column`; `plan(95)` unchanged); `supabase/tests/database/36_push_preferences.sql` (header, PUSH-PREF-009/013/016/027 without `dates`; `plan(27)` unchanged); `src/types/database.types.ts` (regenerated, 3 lines removed); `src/services/pushPreferencesService.ts` header; `tests/unit/services/pushPreferencesService.test.ts:85` test name; `deferred-work.md` DW-416 closed. DW-416's dated `progress:` line is history and stays as written.
- Pre-apply check on the shared local stack, in one rolled-back transaction: a row with `love_notes` f, `moods` t, `photos` f, `pokes_and_kisses` t, `dates` f, `partner_requests` f, `date_reminders` t kept every non-`dates` value after the migration body; the three policies, `PRIMARY KEY (user_id)` and each remaining switch's `true` default were intact; a second run of the body printed the `does not exist, skipping` notice and succeeded.
- CLI 2.122.0 through a scratch shim (`npx -y supabase@2.122.0`), as story 5.4 did: the installed 3.0.0 cannot read `config.toml`. `supabase migration up --local` applied only `20261104000000`.
- The 35_push_devices.sql `invalid URL ""` warnings in `supabase test db` come from its sender-settings-empty cases, not this change.

## Plan Change Log

## Review Triage Log

### 2026-11-04 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` The migration header (lines 7-9) stated the phone confirmation in the present tense, as though done, and omitted the hosted-catalog re-read the story's 2026-11-04 merge-check Decision owes before main — the header now says both checks are owed before the PR to main merges.

## Verification

**Commands:**
- Before applying (rolled-back transaction on the local DB): insert a `push_preferences` row with mixed switches, run the migration body, check the six switches kept, the three policies, the primary key and each default `true`; run the body a second time to prove `if exists` -- expected: values unchanged, second run clean.
- `supabase migration up` (2.122.0 shim) then `supabase test db` -- expected: every file passes.
- `npm run db:types && git diff src/types/database.types.ts` -- expected: only the three `dates` lines of `push_preferences` removed; a second run leaves no diff.
- `npm run typecheck`, `npm run lint`, `npm run test:unit` -- expected: exit 0.
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass, no `deno.lock` left.
- `npx playwright test tests/e2e/settings/push-switches-web.spec.ts` (shim on PATH) -- expected: pass.

**Manual checks (if no CLI):**
- `grep -rnI "push_preferences.dates\|story 18" src tests supabase/tests supabase/functions scripts` -- expected: no text saying the column stays or waits for story 18.

## Auto Run Result

Status: awaiting-operator

**Summary.** Second of DW-416's two deploys (R14): migration `20261104000000_drop_push_preferences_dates.sql` drops `push_preferences.dates` with `drop column if exists` (its column comment goes with it) and touches nothing else. The pgTAP pins now pin the six remaining switches and the column's absence, `database.types.ts` is regenerated without it, the two "remains until story 18" texts say it was dropped, and DW-416 is closed. The build is complete; what is owed is the owner's merge check and post-deploy hand checks (story Notes, Decisions 2026-11-04), listed under `operator_actions`.

**Files changed**
- `supabase/migrations/20261104000000_drop_push_preferences_dates.sql` — new: the drop, with the hosted-catalog read and the merge check owed.
- `supabase/tests/database/35_push_devices.sql` — PUSH-DB-063 asserts the column is gone; header and section comment updated; `plan(95)`.
- `supabase/tests/database/36_push_preferences.sql` — PUSH-PREF-009/013/016/027 without `dates` (six switches); header; `plan(27)`.
- `src/types/database.types.ts` — regenerated with `npm run db:types` on CLI 2.122.0: `dates` gone from Row, Insert and Update.
- `src/services/pushPreferencesService.ts` — header says story 5.18 dropped the column.
- `tests/unit/services/pushPreferencesService.test.ts` — test name says the column was dropped; assertion unchanged.
- `_bmad-output/initiative-my-love/deferred-work.md` — DW-416 `status: done 2026-11-04` with a `resolution:` naming the migration.

**Review findings.** One quick pass, 1 finding, low, patched (migration header's merge-check wording). Nothing deferred, nothing rejected.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 0, low 1.

**Verification.** Pre-apply, in a rolled-back transaction on the local DB: a row with mixed switches kept every non-`dates` value, the three policies, the primary key and each `true` default stayed, and a second run of the body was clean (`does not exist, skipping`); the patched file re-ran clean the same way. `supabase migration up` (2.122.0 shim) applied only `20261104000000`. `supabase test db` 26 files / 594 tests PASS (before and after the patch). `npm run db:types` output equals the committed file, twice. `npm run typecheck` 0; `npm run lint` 0; `npm run test:unit` 221 files / 4056 tests passed; `deno test --no-lock supabase/functions/send-push/` 89 passed, no `deno.lock`; `npx playwright test tests/e2e/settings` 64 passed, row audit clean. The residue grep finds only text saying the column is gone. The patch changed only a SQL comment, so the TypeScript, deno and E2E runs were not repeated.

**Residual risks**
- A shell still on code older than story 5.4 fails every push-settings load and save once the hosted column is gone; only the owner's merge check covers that.
- The hosted catalog was read on 2026-11-04 during refinement, not by this build; a dependent object added since would make the deploy's migration fail (a plain drop does not cascade), which the merge check's re-read covers.

## Operator Confirmation

Confirmed 2026-11-04: the external actions this story owed were carried out.

- Before merging the PR to main, confirm both phones (the owner's iPhone Duo and the partner's iPhone) run story 5.4's update or later.
- Before merging the PR to main, re-read the hosted catalog for public.push_preferences read-only and confirm nothing added since 2026-11-04 depends on the dates column.
- After the deploy, confirm the hosted schema has no push_preferences.dates column.
- After the deploy, on both phones open Settings > Notifications and confirm the switches load and a toggle saves.

_Appended by the bmad-loop orchestrator (`bmad-loop confirm`, #335): a human confirmed these external actions out of band, and the story was advanced from `awaiting-operator` to `done`._
How each was checked, all read-only against the hosted project:

1. Hosted API logs: the owner's iPhone app stopped selecting `dates` at 2026-11-03 20:25 UTC (1,110 requests since, none naming it); the partner's iPhone app made story 5.8's linked-since read at 22:01 UTC, and 5.4's commit `ecfc3902` is an ancestor of 5.8's `0e67220c`.
2. Hosted catalog before the merge: the only object depending on `push_preferences.dates` was its own default; no function, view or trigger named it, and the three own-row policies did not.
3. Hosted catalog after the deploy: `push_preferences` has no `dates` column, and `20261104000000` is the last applied migration (the drop ran at 2026-11-04 19:45 UTC).
4. Not on the phones: the Notifications page exists only in the shell, and no phone had opened it since the deploy. On the iPhone Duo simulator, with the shell built from `934663da` against a local stack whose `push_preferences` columns match the hosted ones, the page showed all six switches matching the stored row, and turning Moods off and back on each saved and survived a relaunch.
