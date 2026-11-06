---
title: "Both partners pick today's question and see the reveal"
type: 'feature'
ticket: '12'
created: '2026-11-05'
status: done
baseline_revision: 'd2eca0bdf13ff685f8de258f0cfbc73a2a66da36'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
warnings: ['oversized']
deferred:
  - summary: >-
      AGENTS.md says useAppStore.ts composes 14 slices; with dailyQuestionSlice it composes 15.
    evidence: |-
      `grep -c "create[A-Za-z]*Slice(set, get, api)" src/stores/useAppStore.ts` gives 15 after this change; AGENTS.md line 26 still reads "composes 14 slices". The fix edits an agent-context file, so it is deferred rather than patched.
    location: >-
      AGENTS.md:26
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 1 shipped `get_daily_day` and `submit_daily_pick`, but no client calls them: there is no Daily view, slice or API, so nobody can see today's question, pick, or see the reveal (epic R1, R2, R5; spine AD-5, AD-13, AD-16).

**Approach:** Add `dailyQuestionApi` (RPC calls plus a zod parse of the AD-16 snapshot), `dailyQuestionSlice` (load and submit with the session check, fields in `signedOutState()`), and a `DailyQuestion` view at `/daily` registered in four of the five places (the dock is story 9). Prove it with unit, component and a two-page Playwright spec on a local stack.

## Boundaries & Constraints

**Always:**
- Fetch sends `time_zone` = `Intl.DateTimeFormat().resolvedOptions().timeZone`, `utc_offset_minutes` = `-new Date().getTimezoneOffset()` (east-positive), `reported_at` = now ISO; a pick sends `picked_at` = the instant Send my pick was pressed plus the same zone pair (AD-2).
- `get_daily_day` answers `{status:'ok',snapshot} | {status:'unlinked'}`; anything that does not parse, or an RPC error, throws, wrapped by `toAccountDataError` as `countdownMarksService` does. Offline, the API calls `requireOnline` before any request.
- Every async slice action captures `{ userId, authSessionVersion }` before its first await and writes nothing after it if either changed. Every new slice field is in `signedOutState()` and in `EXPECTED_RESET`.
- A failed load never clears a shown answer and never turns into `unlinked`. A load answer for the same `day_id` whose `state` ranks lower (`none` < `me`/`partner` < `both`) than the stored one does not replace it.
- Send my pick: offline, the view shows `offlineMessage('Your pick', 'send', 'needs')` and sends nothing (checked with `isOnline()` before the action runs).
- A question shows as `{This} or {That}?` in plain text, no icons, no number. The reveal shows both picks and `Same picks` or `Different picks` from `snapshot.same`. Nothing shows the partner's choice unless the snapshot carries it.
- The view sits inside `<main>` as a normal page (not `isScreenView`), so it gets `--dock-clearance` and `--dock-left/right`. Relative imports in `src/`.
- E2E imports from `tests/support/merged-fixtures.ts`; pair ids from `resolveWorkerPairIds`; `clearPairDays` before the test and deferred at teardown.

**Never:** a local copy or `registerLocalCopy` (story 5), the invitation screen (story 5 — `unlinked` renders no question and no pick control), Realtime or broadcast (story 6), a pick queue (story 7), the write prompt (story 8), the dock, `/mood` redirect or `viewForPush` (story 9), streak/nudge UI, any migration or `database.types.ts` change, any change to `DailyMessage/` or `messagesSlice`, importing from `calendarHelpers.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No picks | `state 'none'` | question, two options, Send my pick (disabled until one is chosen), "{Name} hasn't picked yet" | — |
| Partner picked | `state 'partner'` | same as above but "{Name} has picked"; no partner choice shown | — |
| Waiting | `state 'me'` | own pick text and its time (`h:mm AM`), "Waiting on {Name}", no options | — |
| Reveal | `state 'both'` | own and partner's option text, `Same picks` / `Different picks` | — |
| Unlinked | `{status:'unlinked'}` | no question, no pick control | — |
| Load fails | RPC error / bad shape, nothing shown yet | error box with Retry | message from `toAccountDataError` |
| Load fails after a snapshot | snapshot shown | snapshot stays, error shown | — |
| Offline send | `navigator.onLine` false | offline message, no RPC | — |
| Session changes mid-request | sign-out or switch before answer | answer discarded | — |

`{Name}` is the partner's `displayName` from `partnerSlice`, else "Your partner".

</intent-contract>

## Code Map

- `src/types/database.types.ts:984,1012` -- `get_daily_day` / `submit_daily_pick` arg types already exist; both return `Json`. Read-only.
- `supabase/migrations/20261105010000_daily_question_days_and_picks.sql` -- snapshot keys: `day_id, day, question{this,that}, state, my_choice, my_picked_at, partner_choice, same, write{mine,done}`. Read-only.
- `src/services/countdownMarksService.ts:28-41` -- `requireOnline` + try/`toAccountDataError` shape to copy; `src/services/accountDataError.ts:51,63,102`.
- `src/api/supabaseClient.ts` -- `import { supabase } from './supabaseClient'`. `src/api/validation/broadcastSchemas.ts` -- zod is `zod/v4`.
- `src/stores/slices/notificationsSlice.ts:105-160` -- `isCurrent()` session-check pattern; `src/stores/types.ts` (slice import + `AppState extends`), `src/stores/useAppStore.ts:134-152` (compose; persist nothing new).
- `src/stores/slices/authSlice.ts:156-256` -- `signedOutState()`; `tests/unit/stores/signOutClearsAccountState.test.ts:58-108` `EXPECTED_RESET`, `:110-121` `SECRETS`, `seedSignedInSession`.
- `src/stores/slices/navigationSlice.ts:31-37,79-86` -- `ViewType`, `pathMap`. `src/App.tsx:205-217,225-236` (both ternaries), `:64-66` lazy import, `:969-989` render chain.
- `src/components/PartnerMoodView/PartnerMoodView.tsx:361-427` -- page/card styling; `src/components/shared/kitClasses.ts` (`CARD`, `PRIMARY_BUTTON`, `SECONDARY_BUTTON`, `FAILURE_BOX`); `src/components/Settings/NotificationsPage.tsx:101-142` offline check + error display.
- `tests/unit/stores/pushPreferences.test.ts`, `loaderIdentityGuardsFixture.ts`, `navigatorFixtures.ts` -- slice test shape (`vi.mock` the API, `deferred()`, `setOnline`).
- `tests/e2e/settings/couple-start-date.spec.ts:49-98` -- partner context via `partnerAuthToken` + `getStorageStatePath`, `closeContext`; `tests/support/factories/daily-question.ts` (`clearPairDays`), `tests/support/factories/events.ts:117` (`resolveWorkerPairIds`).
- `tests/unit/utils/basePath.test.ts:45` -- `ROUTES` mirrors `pathMap`.
- `_bmad-output/initiative-my-love/deferred-work.md:4036` -- DW-461 (shared coach pool), handed to this story.

## Tasks & Acceptance

**Execution:**
- [ ] `src/api/validation/dailyQuestionSchemas.ts` -- zod schemas and types `DailyDaySnapshot`, `DailyDayAnswer`, `DailyChoice`.
- [ ] `src/api/dailyQuestionApi.ts` -- `fetchDailyDay(): Promise<DailyDayAnswer>`, `submitDailyPick(dayId, choice): Promise<DailyDaySnapshot>`; zone pair helper.
- [ ] `src/stores/slices/dailyQuestionSlice.ts` + `src/stores/types.ts` + `src/stores/useAppStore.ts` + `src/stores/slices/authSlice.ts` -- fields `dailyDay`, `dailyDayLoading`, `dailyDayError`; actions `loadDailyDay()` (never throws) and `submitDailyPick(choice)` (throws for the view).
- [ ] `src/stores/slices/navigationSlice.ts`, `src/App.tsx` -- `'daily'` → `/daily` in `ViewType`, `pathMap`, both ternaries, lazy import and render chain.
- [ ] `src/components/DailyQuestion/DailyQuestion.tsx` + `index.ts` -- the view per the matrix; loads on mount; testids `daily-question`, `daily-option-this`, `daily-option-that`, `daily-send-pick`, `daily-partner-status`, `daily-waiting`, `daily-my-pick`, `daily-my-pick-time`, `daily-reveal`, `daily-reveal-mark`, `daily-error`, `daily-retry`.
- [ ] `tests/support/factories/daily-question.ts` -- `ensureTestCoachQuestions(supabaseAdmin)`: upserts three fixed-uuid coach rows with `ignoreDuplicates`; never deletes them (resolves DW-461).
- [ ] `src/api/__tests__/dailyQuestionApi.test.ts`, `tests/unit/stores/dailyQuestionSlice.test.ts`, `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx` -- matrix rows, offline refusal before any request, session-change discard, no-regress rule, Same and Different marks.
- [ ] `tests/unit/stores/signOutClearsAccountState.test.ts` -- new fields in `EXPECTED_RESET`; seed a snapshot whose question text is in `SECRETS`. `tests/unit/utils/basePath.test.ts` -- add `/daily`.
- [ ] `tests/e2e/daily/daily-question-pick-and-reveal.spec.ts` -- `[P0]` two-page flow (Acceptance below).
- [ ] `_bmad-output/initiative-my-love/deferred-work.md` -- DW-461 `status: resolved` with its resolution.

**Acceptance Criteria:**
- Given a linked worker pair on a local stack with test coach questions and no days, when both open `/daily`, then both show the same `{This} or {That}?` text, equal to the pair's `couple_days` question read through the admin client.
- Given the worker has sent This, when the partner reloads `/daily`, then the partner sees "has picked" and no reveal, and the worker's page shows the waiting screen with the This text and a time.
- Given the partner then sends That, when the partner's page answers and the worker reloads, then both pages show the reveal with both option texts and `Different picks`.
- Given a signed-in store holding a day, when the account signs out, then every `dailyQuestionSlice` field is back to its signed-out value and no question text remains in the serialized store.

## Implementation Notes

- `dailyDay` holds the whole answer (`{status:'ok',snapshot} | {status:'unlinked'} | null`), so `unlinked` needs no extra field.
- Extra testids beyond the plan's list: `daily-question-view` (page root), `daily-reveal-mine`, `daily-reveal-partner`, `daily-loading`.
- The API refuses offline with `offlineMessage(what, action, 'needs')` through a local `refuseOffline`, because `requireOnline` only takes the plural verb. Messages: "Today's question needs a connection to load." and "Your pick needs a connection to send."
- Test support added: `readPairQuestionTexts` (admin read of the pair's question) in `tests/support/factories/daily-question.ts`, the `DAILY_DAY_READ` / `DAILY_PICK_SEND` globs in `tests/support/helpers/reads.ts`, and snapshot builders in `tests/unit/stores/dailyQuestionFixture.ts`.
- DW-461 is closed as `status: done 2026-11-05` with a `resolution:` line, the ledger's form for closed entries.
- The local stack had no coach questions; the spec seeds its three fixed-uuid rows through `ensureTestCoachQuestions`.

## Plan Change Log

## Review Triage Log

### 2026-11-05 — Review pass
- verdicts: 27 findings — high 0, medium 5, low 14, false 8, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind) neither RPC sets a request timeout, so a stalled socket leaves loading or sending stuck — both calls now chain `.abortSignal(requestTimeout())`, as every account-data service does; two API tests pin the signal.
  - `[low]` `[reject]` (blind) `refuseOffline` copies `requireOnline` because `requireOnline` cannot pass the singular verb — it still builds the text with `offlineMessage`, so the wording cannot drift. The fix adds a parameter to a shared service for a cosmetic duplicate.
  - `[false]` `[reject]` (blind) the schema accepts `state` and choice combinations the view cannot draw (`me` with no `my_choice`, `both` with no `partner_choice`) — no shipped RPC sends them: `daily_day_snapshot` sets `me` and `both` only when the gate returns those rows, and story 1's triage found the left-pair case unreachable through `get_daily_day` and `submit_daily_pick`; `my_picked_at` comes from a `timestamptz`.
  - `[low]` `[patch]` (blind) the send error and the load error share `data-testid="daily-error"` and can show at once — the send error is now `daily-send-error`, and its tests are updated.
  - `[medium]` `[patch]` (blind) `DayCard` has no key, so the chosen option carries over to a new `day_id` and Send could submit a choice made on another question — keyed by `day_id`; a component test shows a new day resets the selection and the send error.
  - `[low]` `[patch]` (blind) the E2E takes the first of an unordered result without checking there is only one day — it now asserts length 1 first.
  - `[low]` `[defer]` (blind) AGENTS.md line 26 says `useAppStore.ts` composes 14 slices; it now composes 15 (`grep -c` gives 15) — the fix edits an agent-context file, so it is recorded in `deferred`.
  - `[low]` `[patch]` (blind) `submitDailyPick` sends the offset at send time, not the offset at `pickedAt` — it now sends `-pickedAt.getTimezoneOffset()`, pinned by an API test.
  - `[low]` `[reject]` (blind) overlapping loads clear `dailyDayLoading` early — the only effect is Retry enabled during a second request after a remount or StrictMode's double effect in dev. The no-regress rule already keeps the shown state, and the fix adds a request-token guard.
  - `[low]` `[reject]` (blind) an offline load is logged at error level, and a transport failure twice — this is console noise only, with nothing shown to users. Story 5 replaces the offline read with the saved day, and the fix adds a branch.
  - `[low]` `[patch]` (blind) the first frame is blank before the mount effect raises the loading flag, and `daily-loading` is untested — loading now shows whenever there is no answer and no error; a component test asserts it while the fetch is pending.
  - `[low]` `[reject]` (edge) an older load for yesterday's day can replace today's snapshot — this needs two overlapping loads across midnight. The load-vs-load case is the same request-token guard rejected above, and the cross-day merge rule belongs to story 5's merge function.
  - `[low]` `[reject]` (edge) overlapping loads clear the loading flag early — same claim as the blind row, rejected for the same reason.
  - `[medium]` `[patch]` (edge) `DayCard` keeps its state across a `day_id` change — same entry and fix as the blind row.
  - `[low]` `[reject]` (edge) a view left open past midnight answers yesterday's question — real. The intent gives this to story 2, whose ticket says "the client refuses a pick when the device date is not the shown day and re-fetches", and which adds the server's date check.
  - `[false]` `[reject]` (edge) `state 'both'` with a null `partner_choice` gives a blank card — same refutation as the blind schema row: no shipped RPC returns it.
  - `[low]` `[patch]` (edge) two error boxes share one testid — same entry and fix as the blind row.
  - `[false]` `[reject]` (edge) `resolvedOptions().timeZone` may be undefined in an old WebView — ECMA-402 requires `resolvedOptions().timeZone` to be a string, and every engine the app ships to (Safari and WKWebView, Chromium) returns one.
  - `[low]` `[patch]` (edge) the E2E question read can flake on two days — same entry and fix as the blind row.
  - `[medium]` `[patch]` (verification-gap, other) `DayCard` without a key lets a choice survive Retry onto a new day — same entry and fix as the blind row.
  - `[medium]` `[patch]` (intent) the ticket's verify wants both pages to show the reveal after a reload, and the partner's reveal was checked only from the submit answer — the spec now reloads the partner page, waits on `get_daily_day`, and asserts both texts and `Different picks`.
  - `[false]` `[reject]` (intent) only `Different picks` runs end to end — the verify reads "Same or Different", so either outcome meets it. The server's `same` is pinned by story 1's pgTAP, and a component test covers `Same picks`.
  - `[false]` `[reject]` (intent) the tests do not own question rows with known text — the spec inserts its own questions (`ensureTestCoachQuestions`). Under the shared pool, asserting a specific text cannot be made reliable (DW-461), and the intent asks for the same question on both pages, which the spec asserts against the admin read.
  - `[low]` `[patch]` (intent) the sign-out clearing was shown only in the shared suite, not in the slice's unit tests — added a test to `dailyQuestionSlice.test.ts` that sets all three fields, calls `clearAuth()`, and asserts they are reset.
  - `[false]` `[reject]` (intent) the read is also refused offline — no defect. An offline read fails either way, and the refusal gives the stated message instead of a fetch error; story 5 replaces it with the saved day.
  - `[false]` `[reject]` (intent) the partner-picked line gives way to "Waiting on {partner}" after the own pick — this is the ticket's waiting screen; nothing is missing.
  - `[false]` `[reject]` (intent) R1, R2 and R5 were not read by the auditor — no claim was made.

### 2026-11-05 — Review pass (follow-up)
- verdicts: 27 findings — high 0, medium 0, low 16, false 11, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) the E2E reveal checks only that the whole block contains both texts, so a swap of `my_choice` and `partner_choice` for one viewer would pass — each page now asserts `daily-reveal-mine` and `daily-reveal-partner` (worker: This / That, partner: That / This), with the reveal still asserted visible.
  - `[low]` `[patch]` (blind) the E2E never asserts the "hasn't picked yet" line or the partner's name — the worker's page now asserts "hasn't picked yet" before picking. The name is not asserted end to end: the view's `{Name}` lookup and its fallback are pinned by the component tests, and the E2E would need an extra admin read of each account's display name.
  - `[low]` `[patch]` (blind) the waiting screen is checked only from the `submit_daily_pick` answer, never from a `get_daily_day` read in state `me` — the worker's page now reloads after its pick, waits on the read, and asserts the waiting screen, the pick text, the time and no options.
  - `[low]` `[reject]` (blind) the E2E has no guard for local midnight between the two page loads — a run must cross local midnight in the few seconds between the two reads, which no everyday run meets, and the fix adds a clock or a time-window guard. The `clockAnchor()` rule applies to specs that install a page clock; this one installs none.
  - `[false]` `[reject]` (blind) `ensureTestCoachQuestions` could seed the hosted pool — `playwright.config.ts:71-72` sets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the local stack's `supabase status`; `fnox.toml` holds neither name (its key is `SUPABASE_SERVICE_KEY`), so no supported run gives the admin client a hosted URL and key, and every other factory writes through the same client.
  - `[low]` `[reject]` (blind) a send that times out after the server committed never re-reads, so a re-pick of the other option shows the stored first pick — reaching it needs the server to commit and then take longer than `REQUEST_TIMEOUT_MS` (30 s, `accountDataError.ts:93`) to answer. The waiting screen then shows the pick the server truly stored (`on conflict ... do nothing`, migration line 579), and the fix adds a re-read branch that story 7's queue replaces.
  - `[false]` `[reject]` (blind) `submitDailyPick` pairs a send-time zone name with a pick-time offset — the slice calls `submitDailyPickRequest(dayId, choice)` with no `pickedAt` (`dailyQuestionSlice.ts:106`), so both are read at the same instant; no shipped caller passes an older `pickedAt`.
  - `[low]` `[patch]` (blind) the view re-reads only on mount, so an account switch while `/daily` is open (`setAuthUser` → `discardAccountState` nulls `dailyDay`, and `signedOutState` keeps `currentView`) leaves "Loading today's question…" forever — the effect now also depends on `userId` and `authSessionVersion`; a new component test switches the account with the view open and sees the new day, and fails without the fix. The reconnect half is not patched: an offline load shows its error with Retry, and reloading on `isOnline` would raise an offline error on every disconnect.
  - `[low]` `[reject]` (blind) an unlinked account sees a blank page — the intent gives the unlinked screen to story 5 ("it keeps story 1's unlinked status, whose screen is story 5's"), and `/daily` has no dock entry until story 9.
  - `[false]` `[reject]` (blind) the component and slice tests start sign-out deletes they never wait for, risking an `EnvironmentTeardownError` — the deletes run against fake-indexeddb and log only on failure, and three shuffled runs of both files (random seeds) passed 42 of 42 with exit 0 and no teardown error. 25 test files use the same `clearAuth()` pattern under the shuffled CI suite.
  - `[low]` `[patch]` (blind) no test shows the options and Send disabled while a send is open, Retry disabled while a load is open, or the submit session check after a sign-out or a same-account re-login — added the two component tests and the two slice tests.
  - `[low]` `[patch]` (blind) the new files are not in the Prettier shape — the mis-indented `<DayCard … />` props in `DailyQuestion.tsx` are re-indented. The rest (escaped quotes, a few lines past 100 columns) carries no named harm: format-on-save runs in `modifications` mode and reformats only the lines a person edits.
  - `[low]` `[patch]` (edge) an account switch with the view open loads nothing again — same entry and fix as the blind row.
  - `[low]` `[reject]` (edge) a pick sent past midnight lands on yesterday's question — carried: the prior pass's row for a view left open past midnight; story 2 owns the date check, and the code reads as before.
  - `[low]` `[reject]` (edge) overlapping loads clear the loading flag early, and an older read can win — carried: the prior pass's overlapping-loads rows; the code reads as before.
  - `[low]` `[reject]` (edge) an older day's answer can replace a newer one — carried: the prior pass's cross-day row; story 5's merge function owns it.
  - `[false]` `[reject]` (edge) `state 'me'` or `'both'` with a null choice draws an empty card — carried: no shipped RPC returns those combinations.
  - `[false]` `[reject]` (edge) `my_picked_at` accepts any string and could show "Invalid Date" — carried with the schema row: the server fills it from a `timestamptz`.
  - `[low]` `[reject]` (edge) the E2E flakes on a run across midnight — same claim as the blind row, rejected for the same reason.
  - `[false]` `[reject]` (edge, claim) DW-461 is written `status: done` where the plan's task says `resolved` — the plan's Implementation Notes record that `done` with a `resolution:` line is the ledger's form for closed entries, and the ledger is consistent; the fix would edit the plan.
  - `[low]` `[patch]` (verification-gap) the no-regress tests run their loads one after another, so nothing shows a read open across a pick keeps the pick — added two slice cases: a read starts, a pick stores `me` (and `both`), the read settles lower, and the pick stays.
  - `[low]` `[reject]` (verification-gap) nothing tests the `/daily` arm of the `popstate` chain — a popstate onto `/daily` needs a `/daily` entry the app pushed, and with no dock slot until story 9 nothing in the app pushes one: a URL load skips history (`setView(initialView, true)`) and the next `setView` makes that first entry Home. The test would have to hand-build history entries; story 9's dock tests are where a forward onto `/daily` becomes reachable.
  - `[false]` `[reject]` (intent) the tests do not own question rows with known text (reading B2, not B1) — carried: the shared-pool reason recorded under DW-461.
  - `[false]` `[reject]` (intent) the load is refused offline too, beyond the intent — carried: no defect.
  - `[false]` `[reject]` (intent) `Same picks` runs only in a mocked component test — carried: the verify reads "Same or Different".
  - `[false]` `[reject]` (intent) the unlinked status is never exercised against a real unlinked account — the intent's verify asks nothing of unlinked, and its screen is story 5's; the slice and component tests cover the status.
  - `[false]` `[reject]` (intent) the offline send refusal is not exercised end to end — the verify does not ask for it; the component and API tests cover the refusal before any request.

## Design Notes

- No local copy yet: Daily re-reads on each mount. Story 5 replaces the no-regress rule with its merge function and keeps the same field.
- Coach questions are pair-less, so any worker can draw any of them. The spec therefore asserts both pages agree with the admin-read question, never a specific text, and the test rows are idempotent fixed-uuid upserts that stay in the local database, so teardown never hits the NO ACTION 23503.
- Time on the waiting screen: `new Date(my_picked_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })`.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0.
- `npm run lint` -- expected: exit 0.
- `npx vitest run src/api/__tests__/dailyQuestionApi.test.ts tests/unit/stores/dailyQuestionSlice.test.ts src/components/DailyQuestion tests/unit/stores/signOutClearsAccountState.test.ts tests/unit/utils/basePath.test.ts` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `supabase start` (CLI from `.mise.toml`), then `npx playwright test tests/e2e/daily/ --project=chromium` -- expected: passes; rerun once to show it repeats.

## Auto Run Result

Status: built

**Summary:** This is the client half of the Daily tracer, built on story 1's RPCs. Two linked accounts at `/daily` see the same `{This} or {That}?` question and each send a pick. The first sees a waiting screen with their pick and its time, the second sees that the partner has picked, and after a reload both see the reveal marked Same picks or Different picks. Send my pick is refused offline. This follow-up review pass patched seven low entries: the view now reloads when the account changes while it is open, and the tests are tighter.

**Files changed in this pass:**
- `src/components/DailyQuestion/DailyQuestion.tsx`: the load effect also depends on `userId` and `authSessionVersion`, so an account switch with the view open loads the new account's day; `<DayCard>` props re-indented.
- `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx`: tests for the controls disabled during a send, Retry disabled during a load, and the account-switch reload.
- `tests/unit/stores/dailyQuestionSlice.test.ts`: two concurrent no-regress cases (a read open across a pick keeps the pick) and the submit session check after a sign-out and after a same-account re-login.
- `tests/e2e/daily/daily-question-pick-and-reveal.spec.ts`: asserts "hasn't picked yet", reloads the worker's waiting screen, and checks whose pick is whose in each reveal.

The story's full file list is unchanged from the first pass: the API and schemas, the slice and its store wiring, the view and its registration in `navigationSlice.ts` and `App.tsx`, the tests and test support, and DW-461's resolution.

**Review findings:** 27 findings: high 0, medium 0, low 16, false 11.
- **Patched:** 7 entries, all low.
  - E2E reveal mine/partner
  - E2E "hasn't picked yet"
  - E2E waiting reload
  - account-switch reload (blind and edge)
  - guard tests
  - `DayCard` indentation
  - concurrent no-regress tests
- **Deferred:** none new. The first pass's AGENTS.md slice-count item stays in `deferred`.
- **Rejected low:**
  - midnight E2E guard, twice: no everyday run crosses midnight between two reads seconds apart, and the fix adds a guard.
  - committed-then-timed-out send: needs a 30 s server stall after commit; the screen then shows the stored pick, and the fix adds a branch story 7 replaces.
  - unlinked blank page: the intent gives that screen to story 5.
  - the past-midnight pick, overlapping loads and the cross-day replace: carried from the first pass.
  - popstate onto `/daily`: unreachable until story 9 pushes a `/daily` entry.
- **Rejected false:**
  - hosted seeding: the admin client takes the local stack's URL and key.
  - zone pair mismatch: no caller passes an older `pickedAt`.
  - teardown logging: three shuffled runs were clean.
  - null-choice states and an invalid `my_picked_at`: carried.
  - DW-461 status word: the ledger's form.
  - five intent divergences: carried or not asked by the verify.

**Follow-up review recommended: false.** This is a follow-up pass and it patched no high entry. Patched by verdict: high 0, medium 0, low 7.

**Verification (after the patches):**
- The new account-switch test failed with the fix removed and passed with it restored.
- `npm run typecheck` exited 0.
- `npm run lint` exited 0.
- `npx vitest run src/components/DailyQuestion tests/unit/stores/dailyQuestionSlice.test.ts` passed 49 tests.
- `npm run test:unit` passed 230 files and 4242 tests.
- `npx playwright test tests/e2e/daily/ --project=chromium --repeat-each=3 --workers=2` passed 3 of 3 on Supabase CLI 2.122.0, and the row audit found no leftover rows.

**Residual risks:**
- The test coach rows stay in the local and CI databases, beside story 4's pool once it lands.
- `/daily` is reachable only by URL until story 9 adds the dock slot, and its `popstate` arm is untested until then.
- Nothing updates live until story 6, and an offline pick is refused until story 7 queues it.
- A view left open past midnight can still answer the previous day until story 2 adds the date check.
- A send that the server commits but answers after the 30 s timeout shows a send error until a reload.
