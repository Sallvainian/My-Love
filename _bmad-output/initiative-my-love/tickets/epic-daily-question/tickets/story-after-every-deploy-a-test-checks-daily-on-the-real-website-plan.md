---
title: 'After every deploy, a test checks Daily on the real website'
type: feature
ticket: '11'
created: '2026-11-06'
status: done
baseline_revision: 'f435e637a702699a7f6af5bbdfb6fb993af69597'
route: full
route_source: auto
risk: high
review: thorough
review_source: pinned
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      The live check reads both pages after a reload, so a production break in the partner-has-picked update without a reload (R2) still ships unseen.
    evidence: |-
      Before this change nothing checked Daily on the live site; this change adds the hidden-pick and reveal checks but each page reads its state after `pageB.reload()` / `pageA.reload()` (tests/live/daily-question-live.spec.ts), so a hosted Realtime or broadcast-authorization break is not caught. tests/e2e/daily/daily-question-live-pick.spec.ts checks the no-reload update locally only. A no-reload step needs the channel-joined wait that spec uses (the `SUBSCRIBED` log), which is more than a trivial addition.
    location: >-
      tests/live/daily-question-live.spec.ts:313
    severity: medium
  - summary: >-
      Through the mise shims, a local Playwright run aimed at any stack but the default one reaches the default (shared) stack anyway, so a local run of the live spec on an isolated stack signs the bots up and links them on the shared stack.
    evidence: |-
      Reproduced on 2026-11-07 in story 6.11's follow-up review. `npx` is a mise shim that puts the pinned `supabase` first on PATH, so `supabase status -o env` in playwright.config.ts succeeds against the default project and force-sets VITE_SUPABASE_URL to it, overriding the caller's value (a stub `supabase` placed first on PATH did not help). Separately, `npx vite --mode test` through the shim receives fnox's hosted VITE_* values, which vite.config.ts's local-supabase-in-test-mode plugin deletes, so the app falls back to .env.test, which is the default stack, while the spec's own API clients use the caller's stack. Running node and npx from the node install directory (not the shims) kept both on the isolated stack. The plan's earlier note blamed a different `supabase` that fails; the observed cause is the pinned one succeeding. The live spec's localhost guard cannot tell one local stack from another.
    location: >-
      playwright.config.ts:40
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Nothing checks Daily on the live site after a deploy, so a production break in the hidden-pick gate or the reveal (R1, R2) ships unseen. Picks are insert-only, so a repeatable live check needs a way to clear the bot pair's days without the Supabase secret key.

**Approach:** Add the client RPC `reset_bot_daily_days()` (security definer, spine AD-15), callable only by the two `claude_bot_config` accounts and deleting only the caller's current couple's `couple_days`. Add a Playwright spec under its own config that resets, signs the two bots in on two pages, checks the same question, the second bot's pre-pick RPC answers, both picks and the reveal; on a local stack it first creates and links the bots. `deploy.yml` runs it after `health-check` against the live site.

## Boundaries & Constraints

**Always:**
- The RPC: `security definer`, `set search_path = ''`, no arguments; null `auth.uid()` → `'Authentication required'`; caller's `auth.users.email` (lowercased) not equal to lowercased `test_email` or `partner_email` value in `public.claude_bot_config` → SQLSTATE `42501`; no partner → deletes nothing, returns 0; else takes the pair's advisory lock (same key as `assign_couple_day`: `'couple_days:' || user_a || ':' || user_b`) and deletes `couple_days` where `user_a = least(uid, partner) and user_b = greatest(uid, partner)`, returning the deleted count (int). EXECUTE revoked from public and anon, granted to authenticated. It returns no config value and no choice.
- The spec reads both passwords from `CLAUDE_BOT_PASSWORD` and `CLAUDE_BOT_PARTNER_PASSWORD` and fails at once, naming the variable, when either is unset or empty. It uses only the publishable/anon key and the two bots' own sessions; it asserts each signed-in session's email is the expected bot email before any write.
- Bot emails: `claude-bot@test.example.com` (signs in with `CLAUDE_BOT_PASSWORD`) and `claude-bot-partner@test.example.com` (`CLAUDE_BOT_PARTNER_PASSWORD`), the values `claude_bot_config` holds.
- Live mode (`LIVE_BASE_URL` set): never signs up, links or unlinks; a missing or unlinked bot fails with a message saying so. Local mode: the Supabase URL must be a localhost / 127.0.0.1 host or the spec throws before any request.
- Both browser contexts and both API clients use time zone `UTC` (offset 0), so all four agree on one date.
- Match surrounding style by hand; import E2E helpers by deep path; GitHub secrets the job needs are listed in this plan's Implementation Notes, never set.

**Never:** the Supabase secret / service-role key anywhere in the spec, its config or the deploy job; `gh secret set`; any sign-in, read or write of an account other than the two bots; editing `src/types/database.types.ts` by hand (regenerate with `npm run db:types`); a `production` environment on the new job (it runs npm code); the per-worker pool or `tests/support/merged-fixtures.ts`'s pooled fixtures in this spec; client app code calling the RPC.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bot resets | bot A linked to bot B, days with picks | their days and picks gone, count returned; other couples' days untouched | none |
| Non-bot caller | linked non-bot user with days | nothing deleted | `42501` |
| Unauthenticated | null `auth.uid()` | nothing deleted | `'Authentication required'` |
| Unlinked bot | bot with no partner | returns 0 | none |
| Email case | `auth.users.email` differs only in case | allowed | none |
| Local, fresh stack | no account has the bot emails | spec signs both up (display names in metadata), links via `partner_requests` insert + `accept_partner_request`, then passes | sign-up failure fails the test |
| Local, rerun | bots exist and are linked | sign-in succeeds, no sign-up or link | none |
| Live, bot missing/unlinked | sign-in fails or `get_my_partner_id` is not the other bot | test fails naming the cause | no account created |

</intent-contract>

## Code Map

- `supabase/migrations/20261106010000_daily_question_day_by_id.sql` -- template for the new migration's header, shape, comment and grants.
- `supabase/migrations/20261105030000_daily_question_days_and_picks.sql:242` -- pair advisory lock key; `daily_picks.day_id` and `daily_questions.source_day_id` cascade from `couple_days`.
- `supabase/migrations/20260316031209_create_claude_bot_config.sql` -- `claude_bot_config(key, value)`, rows `test_email`, `partner_email`; RLS on, no policies.
- `supabase/tests/database/18_function_execute_grants.sql:114` -- FN-GRANT-008 alphabetical list (insert `reset_bot_daily_days` after `register_push_device`); add FN-GRANT-021 like FN-GRANT-020 (line ~207); bump `plan(29)`.
- `supabase/tests/database/40_daily_question_gate.sql` -- header lists each story's RPC; DAILY-014/015 list the client RPCs ("four" → "five"); B's before-pick block (~line 383) calls every client RPC: add `reset_bot_daily_days()` there as `throws_ok … '42501'` (B is no bot), next id DAILY-112; bump `plan(111)`. Helpers `tests.create_test_user`, `tests.authenticate_as` are inline.
- `supabase/tests/database/22_claude_bot_config_no_secret.sql` -- asserts exactly 2 config rows under service_role; the new test file must change config rows only inside its own rolled-back transaction.
- `tests/e2e/daily/daily-question-pick-and-reveal.spec.ts` -- the two-page pick / waiting / reveal flow and test ids to mirror (`daily-question`, `daily-option-this|that`, `daily-send-pick`, `daily-waiting`, `daily-my-pick`, `daily-partner-status`, `daily-reveal`, `daily-reveal-mine|partner|mark`).
- `tests/support/helpers/reads.ts:122-128` -- `DAILY_DAY_READ`, `DAILY_PICK_SEND`, `SECOND_CONTEXT_READ_TIMEOUT`.
- `tests/support/helpers/welcome-splash.ts` -- `dismissWelcomeSplash(page)` before navigation.
- `tests/e2e/auth/login.spec.ts:160-163` -- UI login: `getByLabel('Email', { exact: true })`, `password-input`, `submit-button`, then `login-screen` count 0.
- `src/api/partnerService.ts:287,373` -- how the app links: insert `partner_requests { from_user_id, to_user_id, status: 'pending' }`, then the recipient calls `accept_partner_request({ p_request_id })`; recipient finds the id via `get_my_pending_partner_requests` or a select on `partner_requests`.
- `playwright.config.ts` -- importing it runs its top-level block, which force-sets `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` from `supabase status` (with ES256 re-signing) and exports `webServer` (`npx vite --mode test`). Do not edit it.
- `knip.json` -- `entry` list; the new config and spec need entries or Knip reports them unused.
- `.github/workflows/deploy.yml` -- `health-check` job (needs `deploy`), `vars.SITE_URL`, repo secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261106020000_reset_bot_daily_days.sql` -- create the RPC per Always, with a header like story 6.6's and a `comment on function`.
- [ ] `supabase/tests/database/44_reset_bot_daily_days.sql` -- new pgTAP file (inline helpers): inside the transaction point `claude_bot_config`'s two rows at fresh `@example.com` test emails (one in different case), create bot pair, a linked non-bot couple and an unlinked bot; give both couples days and picks via `assign_couple_day` / `record_daily_pick` or `submit_daily_pick`; assert each matrix row (non-bot `42501` and its rows kept; bot deletes own days and picks, other couple's days kept; null uid refused; unlinked bot returns 0; case-insensitive match; anon cannot execute).
- [ ] `supabase/tests/database/18_function_execute_grants.sql`, `supabase/tests/database/40_daily_question_gate.sql` -- the FN-GRANT and gate edits in the Code Map.
- [ ] `src/types/database.types.ts` -- regenerate with `npm run db:types` after `supabase migration up` locally.
- [ ] `playwright.live.config.ts` -- `import baseConfig from './playwright.config'`; `testDir: './tests/live'`, `workers: 1`, `fullyParallel: false`, `retries: 0`, timeout 180 s, no `globalSetup`; `use.baseURL` = `LIVE_BASE_URL` or `http://localhost:5173`, `timezoneId: 'UTC'`, trace/screenshot/video `'retain-on-failure'`; `webServer` = `baseConfig.webServer` only when `LIVE_BASE_URL` is unset; list + html reporter to `playwright-report-live`.
- [ ] `tests/live/daily-question-live.spec.ts` -- one `[P0]` test from `@playwright/test` (no pooled fixtures): resolve target (live: `LIVE_SUPABASE_URL`, `LIVE_SUPABASE_PUBLISHABLE_KEY`, both required; local: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` with the localhost guard); sign each bot in with supabase-js (`persistSession: false`); local only: sign up a missing bot with `display_name` 'Claude Bot' / 'Claude Partner', link if unlinked; assert pair linked to each other; each bot calls `reset_bot_daily_days`; two browser contexts log in through the UI at `/`, open `/daily`, same `daily-question` text; bot A picks This (200), waiting screen; as bot B via API: `get_daily_day('UTC', 0, now)` and `get_daily_day_by_id(day_id)` → state `partner`, `my_choice`/`partner_choice`/`same` null, no value `'this'`/`'that'` anywhere (deep walk); B's page reload shows "has picked" and no reveal; B picks That; both pages after reload show the reveal with `Different picks`. Close contexts and sign the API clients out in `finally`. File header says what it checks and that it touches only the bot pair.
- [ ] `knip.json` -- add `playwright.live.config.ts` and `tests/live/*.spec.ts` to `entry`.
- [ ] `.github/workflows/deploy.yml` -- job `live-daily-check` (`needs: health-check`, no environment): checkout, setup-node from `.node-version` with npm cache, `npm ci`, `npx playwright install --with-deps chromium`, run `npx playwright test -c playwright.live.config.ts` with `LIVE_BASE_URL: ${{ vars.SITE_URL }}`, `LIVE_SUPABASE_URL`/`LIVE_SUPABASE_PUBLISHABLE_KEY` from the two existing `VITE_*` secrets, `CLAUDE_BOT_PASSWORD`, `CLAUDE_BOT_PARTNER_PASSWORD` secrets; upload `playwright-report-live` and `test-results` on failure. Comment explains why it exists and that it never uses the secret key.

**Acceptance Criteria:**
- Given a fresh local stack with every migration, when `supabase test db` runs, then 44, 40 and 18 pass, showing a non-bot refused and a bot unable to delete another couple's rows.
- Given a fresh local stack where no account has the bot emails, when the live spec runs locally twice in a row, then the first run creates and links both bots and both runs pass.
- Given `deploy.yml`, when read, then `live-daily-check` needs `health-check`, names only the secrets in Implementation Notes, and has no service key.

## Implementation Notes

- **GitHub secrets the `live-daily-check` job needs** (repository secrets, not the `production` environment, since the job runs npm code):
  - `CLAUDE_BOT_PASSWORD` (new): the `claude-bot@test.example.com` password, the value of the fnox entry of the same name.
  - `CLAUDE_BOT_PARTNER_PASSWORD` (new): the `claude-bot-partner@test.example.com` password, the value of the fnox entry of the same name.
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (already set; the build uses them), passed as `LIVE_SUPABASE_URL` / `LIVE_SUPABASE_PUBLISHABLE_KEY`; `vars.SITE_URL` (already set) as `LIVE_BASE_URL`.
- Files: the migration, `44_reset_bot_daily_days.sql` (19 assertions, one more than the matrix: a profile row carrying a bot email does not pass the check), the 18/40 edits, regenerated types (4 lines), `playwright.live.config.ts`, `tests/live/daily-question-live.spec.ts`, `knip.json`, `deploy.yml`, and `.gitignore` (`**/playwright-report-live/`, so a local run leaves no untracked report).
- Deviations: Knip picks up `playwright.live.config.ts` through its Playwright plugin and called the plan's entry redundant, so only `tests/live/*.spec.ts` was added. `deploy.yml` uses `--config=` rather than `-c`, which Knip read as an unlisted binary.
- Verified on an isolated stack (`project_id` changed, ports 553xx), never the shared one, since a loop run is live: `supabase test db` 31 files / 859 tests PASS on a fresh replay; regenerated types formatted with the pinned oxfmt equal the committed file; the live spec in local mode passed on a fresh stack (bots created and linked) and on two reruns; `typecheck`, `lint`, `knip` exit 0. Live mode against a missing bot failed with "Cannot sign in … a live run never signs one up" and created no account; local mode with a production `VITE_SUPABASE_URL` in the environment refused before any request.
- Surprise: under `npx`, `playwright.config.ts`'s `supabase status` resolves a different `supabase` than the shell's mise one and fails, so the main config leaves `VITE_*` as the environment has them. A local run therefore needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` pointed at the local stack when the shell carries production values; the localhost guard stops it otherwise. The builder's first run hit the shared stack this way, created and linked the two bots there and stopped at the reset (the shared stack lacks this migration); it then deleted those two users and their one `partner_requests` row.
- A local run logs "Could not announce the pick" when the stack runs without Realtime (the isolated one did); the test does not depend on the broadcast.

## Plan Change Log

- 2026-11-06 (PO, at epic closure): every `PUSH_FIXTURE_PASSWORD` in this plan now reads `CLAUDE_BOT_PARTNER_PASSWORD`. After the build, `66e69812` gave the partner bot its own password at the owner's request, because the push fixtures share `PUSH_FIXTURE_PASSWORD`. The spec, `deploy.yml` and `provision-push-fixtures.mjs` on main use the new name.

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 7 findings — high 2, medium 1, low 3, false 0, maybe-false 0
- findings:
  - `[high]` `[patch]` `44_reset_bot_daily_days.sql` seeds picks at noon UTC on today's date; `assign_couple_day` stamps the day `created_at = now()` and `record_daily_pick` raises DQ002 for `picked_at < created_at - 5 min`, so the file aborts after 12:05 UTC. — Confirmed at `20261105210000_daily_question_own_clocks.sql:194`. Seeds now use 2030-03-01 / 2030-03-02, as 42 does.
  - `[high]` `[patch]` On failure the job uploaded traces and the HTML report, which record the typed bot passwords and the token request/response; any GitHub user can download a public repo's artifacts. — Confirmed (trace on, upload of `test-results` and `playwright-report-live`). `trace: 'off'` in the live config; the upload takes only `test-results/**/*.png` and `*.webm`, where the password field shows as dots.
  - `[low]` `[reject]` The two browser sign-ins are never signed out, so each run leaves live sessions whose tokens a trace would hold. — With traces off and no report uploaded the tokens no longer leave the runner; what remains is two session rows per bot per deploy on test accounts, and the direct fix (`scope: 'global'`) would also end any manual bot session.
  - `[medium]` `[patch]` The RPC checked only the caller as a bot, so a bot linked to a real user could delete that user's days. — Confirmed: `accept_partner_request` places no limit on linking a bot. The partner's `auth.users.email` must now also be a `claude_bot_config` value (else 42501); RESET-018/019 show a bot linked to a non-bot refused and that couple's days kept.
  - `[low]` `[patch]` `rpcResponse` hand-wrote matchers that `tests/support/helpers/reads.ts` exports (AGENTS.md shared helpers). — Replaced with `interceptNetworkCall` and `DAILY_DAY_READ` / `DAILY_PICK_SEND` / `SECOND_CONTEXT_READ_TIMEOUT`.
  - `[low]` `[patch]` Local mode reused an already-running dev server, which may point at production while the spec's guard checks only its own `VITE_SUPABASE_URL`. — Confirmed (`reuseExistingServer: !CI` in the base config). The live config sets `reuseExistingServer: false`, so the server always gets the env the guard checked.
  - `[low]` `[patch]` `deploy.yml` `paths-ignore` lists `playwright.config.ts` but not `playwright.live.config.ts`, so a change to it alone runs a full production deploy. — Added.

### 2026-11-07 — Review pass
- verdicts: 32 findings — high 0, medium 10, low 14, false 8, maybe-false 0
- findings:
  - `[low]` `[reject]` (blind) A run that crosses 00:00 UTC between A's pick and B's read gets the next day and fails a healthy deploy. — Real, but the window is about a minute a day; the fix adds a midnight guard or a restart branch.
  - `[false]` `[reject]` (blind) Every deploy is red until the owner sets the two secrets; the hosted `claude_bot_config` emails are unchecked. — A missing secret failing loudly is correct (skipping would let a missing secret switch the check off unseen), and the intent puts the secrets after the merge. Read-only query of the hosted project on 2026-11-07: both config values equal the spec's emails, both bot accounts exist, and they are linked to each other.
  - `[medium]` `[patch]` (blind) `live-daily-check` has no `timeout-minutes`, and the workflow's `deploy` concurrency group (`cancel-in-progress: false`) queues the next deploy behind a hang for up to six hours. — Added `timeout-minutes: 15` with a comment.
  - `[low]` `[reject]` (blind) The spec never runs before production: `tests/**` is in `paths-ignore` and `test.yml` has no leg for it. — It runs on the next deploy and on demand through `workflow_dispatch`; a test.yml leg or a full production deploy for a test-only change costs more than the delayed detection.
  - `[medium]` `[defer]` (blind) The live check never tests the no-reload Realtime update (R2). — Pre-existing gap (nothing checked production before); a no-reload step needs the channel-joined wait. Deferred.
  - `[false]` `[reject]` (blind) The leak check covers only three fields and literal 'this'/'that'. — `daily_day_snapshot` (20261105030000:419-438) returns day_id, day, question, state, my_choice, my_picked_at, partner_choice, same, write{mine, done}; only partner_choice and same can carry the partner's choice, both are asserted null, and the deep walk catches a bare choice anywhere. There is no count field.
  - `[low]` `[patch]` (blind) What B's own page received before B's pick is never checked. — `openDaily` now returns the page's `get_daily_day` response, and the pre-pick reload runs `expectHidden` on it.
  - `[low]` `[reject]` (blind) The browser sessions are never signed out. — carried: the 2026-11-06 row (same location and claim, code unchanged): with traces off and no report uploaded the tokens never leave the runner.
  - `[medium]` `[defer]` (blind) The `npx` / `supabase status` problem is recorded only in the plan. — Verified during this pass's verification, with a corrected cause (the mise shims, not a failing CLI); pre-existing tooling, not caused by this change. Deferred.
  - `[low]` `[reject]` (blind) File 44 never tests the written-question cascade or the null-email branch. — The cascade is the declared FK `daily_questions_source_day_id_fkey ... on delete cascade` (20261105030000:116-118), and the live bots write no questions; an account with no email cannot sign in to this app. Adding the fixture is more than a direct correction for a rarely-met gap.
  - `[low]` `[reject]` (blind) The Implementation Notes give the wrong assertion count (19, not 21). — The fix edits this build's plan.
  - `[low]` `[reject]` (blind) The Execution tasks still describe the trace and the upload that the first review changed. — The fix edits this build's plan.
  - `[low]` `[reject]` (blind) The live config shares `test-results` with the main config, so a local live run clears the last E2E run's output. — Running the live spec locally is rare, and the rename spreads across the config, deploy.yml and .gitignore.
  - `[medium]` `[patch]` (edge) `screenshot: 'retain-on-failure'` is not a ScreenshotMode, so no screenshot is ever taken. — Confirmed in node_modules/playwright (types/test.d.ts:7310, lib/index.js:578). Now `'only-on-failure'`; a failed local run then attached test-failed-1.png and -2.png.
  - `[medium]` `[patch]` (edge) The two contexts come from `browser.newContext()`, which the config's `video` never reaches, so no .webm is written. — Confirmed (`recordVideo` is set only in the `_contextFactory` fixture, lib/index.js:389). The spec now passes `recordVideo` to its contexts; runs wrote two .webm files.
  - `[medium]` `[patch]` (edge) A failed run uploads an empty artifact without a warning anyone sees. — Same root cause as the two rows above; fixed by them (files now exist on every test failure). `if-no-files-found` was left at its default so an upload error never hides the real failure.
  - `[low]` `[reject]` (edge) A run crossing 00:00 UTC fails a healthy deploy. — Same as the blind row: a short daily window, and the fix adds a guard.
  - `[low]` `[reject]` (edge) A local rerun after an inserted but unaccepted request hits the unique index and stays stuck. — Local only and needs a run to die between two calls; the fix adds a lookup branch.
  - `[low]` `[reject]` (edge) `paths-ignore` lists `playwright.live.config.ts` and `tests/live/**`, so changes to them never run. — Same as the blind row: they run on the next deploy or on demand.
  - `[medium]` `[patch]` (edge) The deploy.yml comment says a failure uploads screenshots and videos, but neither was captured. — Same root cause as the screenshot and video rows; the comment is now true.
  - `[medium]` `[patch]` (verification-gap) RESET-020 cannot tell whether the caller check reads auth.users or the profile row, because n_1's partner is not a bot. — New RESET-022: an unlinked non-bot whose profile row carries a bot email gets 42501. With the check pointed at public.users, only RESET-022 failed.
  - `[medium]` `[patch]` (verification-gap) No test has the caller check as the only refusal. — New RESET-020/021: B, now a non-bot linked to a bot, gets 42501 and the pair keeps 2 days / 4 picks. With the caller check removed, RESET-020, 021 and 022 failed.
  - `[medium]` `[patch]` (verification-gap) `screenshot: 'retain-on-failure'` is invalid. — Same as the edge row; fixed there.
  - `[false]` `[reject]` (intent) The RPC is stricter than the intent: it also refuses a bot whose partner is not a bot. — No bad outcome: the two live bots are linked to each other (hosted query above), and the extra refusal serves the intent's "never deletes the owner's or partner's account".
  - `[low]` `[reject]` (intent) The written-question cascade is untested. — Same as the blind row on file 44.
  - `[false]` `[reject]` (intent) "No trace" is checked narrowly. — Same refutation as the blind leak-check row.
  - `[low]` `[patch]` (intent) B's answers are checked from a Node client, not from B's page. — Fixed with the blind row: the page's own response is now checked too.
  - `[false]` `[reject]` (intent) "Fails the deploy" means a red run after the site has shipped. — The intent puts the job after health-check, so the site has always shipped by then; a red run is what the intent asks for.
  - `[false]` `[reject]` (intent) "Passes twice in a row" rests on a note in the plan. — Re-run in this pass: on a fresh isolated stack the spec created and linked both bots and passed twice.
  - `[false]` `[reject]` (intent) The hosted config and bot accounts are UNVERIFIED. — Verified read-only on the hosted project (see the blind secrets row).
  - `[low]` `[reject]` (intent) The plan's task list disagrees with its triage log. — The fix edits this build's plan.
  - `[false]` `[reject]` (intent) Changes the intent did not ask for (`paths-ignore`, `.gitignore`, `knip.json`, `reuseExistingServer: false`). — Each supports the asked-for job or spec; none changes behaviour outside it.
- also fixed (found while patching, not a lens finding): `playwright.live.config.ts` imported `TestConfigWebServer`, which `@playwright/test` does not export; it now derives the type from `PlaywrightTestConfig['webServer']` (a standalone tsc of the file: 0 errors in it).

## Design Notes

A separate config, not a project in `playwright.config.ts`: that config's `globalSetup` provisions the worker pool with the service key, which the deploy job must not have. Importing it reuses its local env block and dev server unchanged. Live mode reads `LIVE_*` names so a local `supabase status` overwriting `VITE_*` can never point a live run at the wrong project. The RPC reads `auth.users.email`, not `public.users.email`, so a profile row edit can never pass the bot check.

## Verification

**Commands:**
- `supabase migration up` then `npm run db:types` -- expected: types change only by `reset_bot_daily_days`; a second run leaves the file unchanged.
- `mise exec -- supabase test db` -- expected: every file passes.
- `CLAUDE_BOT_PASSWORD=… CLAUDE_BOT_PARTNER_PASSWORD=… npx playwright test -c playwright.live.config.ts` twice, after deleting any local bot accounts -- expected: passes both times.
- `npm run typecheck`, `npm run lint`, `npx knip`, `npm run test:unit` -- expected: exit 0.
- `npx playwright test tests/e2e/daily --project=chromium` -- expected: the Daily specs still pass.

## Auto Run Result

Status: built

**Summary:** A post-deploy check of Daily on the live site. The new client RPC `reset_bot_daily_days()` lets the two Claude bot accounts, and only them while linked to each other, clear their own pair's days (picks cascade), so the check can rerun any number of times a day without the Supabase secret key. `tests/live/daily-question-live.spec.ts`, run through `playwright.live.config.ts`, signs both bots in on two pages, checks they see one question, checks that B's `get_daily_day` and `get_daily_day_by_id` answers and B's own page response before B's pick carry no choice, then both pick and see the reveal. On a local stack it first creates and links the bots. `deploy.yml` runs it as `live-daily-check` after `health-check`, with a 15-minute limit.

**Files changed:**
- `supabase/migrations/20261106020000_reset_bot_daily_days.sql` -- the RPC.
- `supabase/tests/database/44_reset_bot_daily_days.sql` -- 24 assertions: refusals (including a non-bot linked to a bot, and a profile-row spoof that only the caller check can refuse), own-pair delete, other couples untouched, unlinked bot, case, bot linked to a non-bot.
- `supabase/tests/database/18_function_execute_grants.sql`, `40_daily_question_gate.sql` -- FN-GRANT-008/021; the gate's client-RPC lists and DAILY-112.
- `src/types/database.types.ts` -- regenerated (one function entry).
- `playwright.live.config.ts` -- the live config: traces off, screenshots on failure, no reused dev server.
- `tests/live/daily-question-live.spec.ts` -- the live check; records its own contexts' video.
- `.github/workflows/deploy.yml` -- `live-daily-check` job (15-minute limit, uploads only .png and .webm on failure); the live config in `paths-ignore`.
- `knip.json`, `.gitignore` -- the spec as a Knip entry; the live report folder ignored.

**GitHub secrets the job needs** (repository secrets; the owner sets them after the epic merges): `CLAUDE_BOT_PASSWORD` and `CLAUDE_BOT_PARTNER_PASSWORD` (new, the fnox values of the same names); `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` and `vars.SITE_URL` already exist.

**Review findings (follow-up pass, thorough: blind, edge-case, verification-gap, intent):** 32 findings. Patched 5 entries (high 0, medium 4: failure screenshots and videos never captured, no job timeout, and two missing caller-check tests; low 1: B's page response unchecked), plus a wrong type import found while patching. Deferred 2 (medium): no no-reload Realtime check on the live site; local Playwright runs reach the default stack through the mise shims. Rejected: 7 low (midnight crossing, twice; spec changes never run before a deploy, twice; written-question cascade untested, twice, plus the null-email branch; shared `test-results` folder; stuck local rerun after a half-made link request), 3 low that would edit this plan (assertion count; task list against triage, twice), 1 low carried (browser sessions not signed out), 8 false (the loud failure without secrets, hosted config, leak-check breadth, twice, the stricter RPC, "fails the deploy", "passes twice", extra supporting changes); each reason is in the 2026-11-07 triage row.

**Follow-up review recommended: false.** A follow-up pass that patched no high finding; patched counts: high 0, medium 4, low 1.

**Verification (after the patches):** on a fresh isolated stack (copied config, project `live611`, ports 553xx; never the shared one, a loop run being live): `supabase test db` 31 files, 864 tests, PASS. File 44 was also run against two broken copies of the function inside a rolled-back transaction: with the caller check removed, RESET-020/021/022 failed; with it reading `public.users`, RESET-022 failed. Regenerated types, formatted with the pinned oxfmt, equal the committed file. The live spec in local mode, started from zero bot accounts, created and linked both bots and passed twice in a row (4.4 s, 3.7 s), with node and npx run from the node install directory (see the deferred item). `npm run typecheck`, `npm run lint`, `npx knip` exit 0; `npm run test:unit` 247 files, 4,568 tests passed; a standalone tsc of `playwright.live.config.ts` reports no error in that file. Not run: `tests/e2e/daily` (no app code changed; the shared stack belongs to the live loop run).

**Incident during verification:** the first local run went through the mise shims and reached the shared local stack. There it created the two bot accounts and linked them with one accepted partner request, then stopped at the reset (that stack lacks this migration). No day or pick rows were written. Those exact rows (both created at 02:47:54-55 UTC on 2026-11-07) were deleted at once; the stack has no bot account, profile or partner request left. The next two runs' browser logins also reached it and failed, writing nothing.

**Residual risks:**
- The live run waits for the owner's secrets and the merge to main; until the secrets exist the job fails with "CLAUDE_BOT_PASSWORD is not set". The hosted side is ready (read-only check on 2026-11-07): both config emails match and the bots exist, linked to each other.
- A run that straddles 00:00 UTC could see two dates and fail once.
- A local run of the live spec against a stack other than the default one needs node and npx from outside the mise shims, or it reaches the default stack (deferred).
- Playwright's `error-context.md`, written into `test-results/` on a failure, holds the typed password in plain text. It stays on the runner: the upload takes only .png and .webm, and `test-results/` is gitignored.
