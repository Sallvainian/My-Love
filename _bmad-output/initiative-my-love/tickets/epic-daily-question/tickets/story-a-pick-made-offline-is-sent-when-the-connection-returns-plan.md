---
title: 'A pick made offline is sent when the connection returns'
type: 'feature'
ticket: '7'
created: '2026-11-06'
status: done
baseline_revision: '452ecdb92529e83644f3fce9678d4fde4d460da6'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 1
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
warnings: ['oversized']
deferred:
  - summary: >-
      AGENTS.md does not describe the daily question's offline model: the data-model paragraph and the "new per-account offline data is a localCopy kind" rule both omit the pick-queue.
    evidence: |-
      AGENTS.md "Maintained by hand" opens with a data-model paragraph ("Check which data model a feature uses…") that spells out how every feature behaves offline but says nothing of Daily. Daily's saved days are the `daily-days` local copy. Picks made offline go into the per-account `pick-queue` store (`services/pickQueue.ts`), and `dailyQuestionSlice.drainQueuedPicks` sends them under `PICK_QUEUE_LOCK` on start, on `online` and on a backoff after a failed pass. A queued pick never enters the copy, so only a server snapshot produces a reveal. The Known-pitfalls rule "New per-account offline data is a new kind in services/localCopy.ts, not a new IndexedDB store" now has a second queue-store exception (beside `note-queue`) that it does not state. This change only added `pickQueue` and `pick-queue` to two lists. The fix edits an agent-context file, so the review deferred it.
    location: >-
      AGENTS.md:66,100
    severity: low
---

<intent-contract>

## Intent

**Problem:** Offline, Send my pick refuses (story 12), so a pick made without a connection is lost (epic R7; spine AD-12). Story 2's server already dates a late pick by its `picked_at`, so a pick sent after midnight can still count for its own date.

**Approach:** A new `pick-queue` IndexedDB store holds an offline pick with the instant and zone it was made in. `dailyQuestionSlice.drainQueuedPicks` sends the signed-in account's rows under a Web Lock on start and on `online`, then announces each confirmed pick as story 6 does. Daily shows a queued pick as the own pick, never as a reveal.

## Boundaries & Constraints

**Always:**
- **Schema** (`dbSchema.ts`, `DB_VERSION` 15 → 16): store `pick-queue`, `keyPath: ['user_id', 'day_id']`, index `by-user` on `user_id`, gated on the store existing (as `note-queue` is; an existing store missing the index gets it), header list and comment block updated, `STORE_NAMES.PICK_QUEUE`. Row `StoredQueuedPick`: `{ user_id, day_id, choice: 'this'|'that', picked_at (ISO), time_zone, utc_offset_minutes, failed: boolean, failure: string | null }`.
- **`src/services/pickQueue.ts`** (new; `noteQueue.ts`'s handle and convention, opened through `openMyLoveDB()`): `enqueuePick(row)` (put; a new pick for the same key replaces it), `listQueuedPicks(userId)` (oldest `picked_at` first, ties by `day_id`; `[]` and a `console.error` on failure), `markQueuedPickFailed(userId, dayId, failure)`, `removeQueuedPick(userId, dayId)`; writes throw. Header states the queue rules. `deleteAccountData` never touches it.
- **`syncLock.ts`:** `PICK_QUEUE_LOCK = 'my-love:pick-queue'`.
- **API (`dailyQuestionApi.ts`):**
  - `submitDailyPick(dayId, choice, pickedAt = new Date(), zone = pickZone(pickedAt))`, where exported `pickZone(at)` is `{ time_zone: deviceZone().time_zone, utc_offset_minutes: -at.getTimezoneOffset() }`; the request sends `zone`.
  - Exported `isPickRefusal(error)`: true for `AccountDataError('day-changed')`, or for an `AccountDataError` whose `cause.code` is one the RPC raises: `DQ001`, `DQ002`, `P0002`, `22023`. Every other failure (offline, network, timeout, 401/5xx, `invalid-response`) is transient.
- **Slice:**
  - New field `dailyQueuedPicks: QueuedDailyPick[]` (the account's rows as the view needs them). It goes in `signedOutState()` as `[]` in the same commit.
  - A private `showQueuedPicks(userId, isCurrent)` re-reads the list and sets the field only while `isCurrent()`. `loadDailyDay` calls it beside its saved-day read.
  - `submitDailyPick` keeps the device-date refusal first. Then, when `!isOnline()`, it enqueues `{ user_id, day_id: shown day_id, choice, picked_at: pickedAt.toISOString(), ...pickZone(pickedAt), failed: false, failure: null }` with no request, refreshes the field, and resolves (an enqueue failure throws). Online it sends as today; after a confirmed answer it removes any row for that day (a failed one), then refreshes the field.
  - New `drainQueuedPicks()` never throws. It does nothing signed out or offline, and runs one pass under `withSyncLock(PICK_QUEUE_LOCK)`. The pass takes the account's non-failed rows, oldest first. For each row, while `isCurrent()` and online, it calls `submitDailyPickRequest(day_id, choice, new Date(picked_at), { time_zone, utc_offset_minutes })`. There is no device-date check here: a late pick is the server's to date (story 2).
    - **Confirmed:** remove the row, even if the session changed (the pick is committed). Then, only if current: announce it as story 6 does (`void announceDailyPick(...).catch(log)`), `mergeDailyDay`, and show it by `refreshDailyDay`'s rule (the shown `day_id`, or today's with nothing `ok` shown).
    - **`isPickRefusal`:** `markQueuedPickFailed` with the error's message, then continue.
    - **Any other failure:** `console.error('[DailyQuestion] Could not send a queued pick:', error)`, then stop; the row stays pending.
    - **Lock held by another tab:** wait (`waitForSyncLock`), then `loadDailyDay()`.
    - Every path ends by refreshing the field.
  - Session capture and re-check around every await. The header comment describes the queue.
- **Triggers (`App.tsx`):** `drainQueuedPicks()` in `handleOnline` while signed in, and in the mount effect's immediate part beside `drainQueuedNotes` (not on the 5-minute interval).
- **View (`DailyQuestion.tsx`):** `DayCard` gets the queued row for its `day_id`.
  - Server state `me`/`both`: unchanged; the server's pick wins.
  - Else a pending row: no option buttons and no Send, `PickCard` "Your pick" with `question[row.choice]` (`daily-my-pick`) and its time (`daily-my-pick-time`), `daily-pick-queued` "Waiting for a connection to send your pick.", and the partner status line. Never the reveal.
  - Else a failed row: options and Send as usual, plus `daily-pick-failed` (`FAILURE_BOX`, `role="alert"`) "Your pick could not be sent. {failure}". A new Send replaces the row.
  - `DayCard.send` drops its own `isOnline()` refusal; the slice decides.
- **Tests:** E2E fixtures from `merged-fixtures.ts`; `clearPairDays` + `ensureTestCoachQuestions` before and at teardown. Listeners attach before the navigation they observe, and there are no hard waits (`.claude/hooks/tea-enforce.cjs`). New unit tests go in new files, each under 1,000 lines. Knip runs in lint: no unused exports.

**Never:** a migration, an RPC or `database.types.ts` change; a queued pick in any local copy or in `dailyDay`; a reveal or partner choice from anything but a server snapshot; deleting the queue on sign-out; the write prompt (story 8), the dock or `/mood`, `DailyMessage/`, `messagesSlice`; a new `registerLocalCopy`; a bare `openDB`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline Send | shown D (`none`), offline | row queued, no request; own pick shown, no options | enqueue failure → send error |
| Offline Send, partner picked | shown D `partner` | own queued pick + "has picked", no reveal | — |
| Late drain | queued 23:50 on D (11-05); drained 00:10 11-06 | RPC gets D's id, 23:50 `picked_at`, the queued zone pair | — |
| Drain confirmed | answer `both` | row removed; reveal shown; `daily_pick` announced | announce failure logged |
| Refused | RPC `DQ002`/`P0002`/`DQ001`/`22023` | row `failed` + message; failure shown; options back | next row still sent |
| Transient | network error / 5xx | row stays pending; pass stops | logged |
| Other account's rows | B's row on the device, A signed in | never sent, never shown | — |
| Session changes mid-drain | sign-out after the RPC answers | row removed; no state, copy or announce write | — |
| Second tab draining | lock held | no send here; reload after it lets go | — |
| Already picked elsewhere | server holds own pick | idempotent answer; row removed | — |
| Sign-out | rows queued | rows stay; field cleared | — |

</intent-contract>

## Code Map

- `src/services/dbSchema.ts:28-45,101-110,208-230,341-349` -- version list, `note-queue` schema entry, comment block + `DB_VERSION`, `STORE_NAMES`, the v14 branch to copy for v16.
- `src/services/noteQueue.ts` -- the template for `pickQueue.ts` (handle, ordering, failure conventions, header shape).
- `src/services/syncLock.ts:28,54,79` -- `NOTE_QUEUE_LOCK`, `withSyncLock` (skips when held), `waitForSyncLock`.
- `src/stores/slices/notesSlice.ts:160-168,707-750,1894-1950` -- the note drain: `NOTE_RETRY_DELAYS_MS` and its maximum, `scheduleDrainRetry` / `cancelDrainRetry` (one timer, its session, cancelled on any account or session change), and the loop (lock, wait, re-pass, in-flight promise). The pick drain copies the in-flight promise and the backoff retry; it needs no rate limit. `postgrest-js` never retries a POST (`node_modules/@supabase/postgrest-js/dist/index.cjs:81-87,181-186`), so the RPC gets no retry of its own.
- `src/api/dailyQuestionApi.ts:65-71,126-160` -- `deviceZone`, `submitDailyPick` (it sends the offset from `pickedAt` already), `PICK_DATE_MISMATCH`.
- `src/services/accountDataError.ts:105-120` -- `toAccountDataError` wraps a PostgREST error with `cause` = the mapped error, which keeps `.code` (`errorHandlers.ts:58-90`; that class is not exported).
- `src/stores/slices/dailyQuestionSlice.ts` -- `mergeAnswer`, `loadDailyDay`, `refreshDailyDay` (the show rule to reuse), `submitDailyPick`. `src/stores/slices/authSlice.ts:250-256` -- `signedOutState()`'s daily fields.
- `src/components/DailyQuestion/DailyQuestion.tsx:55-170` -- `DayCard`, `PickCard`, `pickedTime`, the `isOnline()` branch to drop.
- `src/App.tsx:533-602` -- `handleOnline` and the mount effect where `drainQueuedNotes` runs.
- Migration `supabase/migrations/20261105210000_daily_question_own_clocks.sql:160-206` -- the RPC's SQLSTATEs (read-only).
- Tests to update:
  - `tests/unit/services/dbSchema.test.ts:58-126` (store list, count 6 → 7, version 16), `dbSchema.upgradesToV14.test.ts` (six `objectStoreNames.length).toBe(6)`), `dbSchemaFixtures.ts` `ALL_STORES`.
  - `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx:339-353,505-525` (the two offline-refusal tests become queue tests; keep their other checks).
  - `tests/unit/stores/signOutClearsAccountState.test.ts:109-111,241` (expected and seeded `dailyQueuedPicks`).
  - `tests/unit/App.localCopyRefresh.test.tsx:190,443-497` and `App.pushRegistration.test.tsx:184` (stub `drainQueuedPicks`, add drain tests).
  - `src/api/__tests__/dailyQuestionApi.test.ts`.
- Test kit: `tests/unit/stores/dailyQuestionFixture.ts`, `navigatorFixtures.ts` (`setOnline`), `loaderIdentityGuardsFixture.ts` (`deferred`); the slice test's `vi.mock` block and fake `Date` setup (`dailyQuestionSlice.test.ts:1-75`) to copy into the new file.
- E2E kit: `tests/e2e/daily/daily-question-live-pick.spec.ts` (two pages, `channelJoined`, settle wait), `tests/support/helpers/offline.ts` (`goOffline`), `indexed-db.ts` (`readStore`), `reads.ts` (`DAILY_PICK_SEND`, `DAILY_DAY_BY_ID_READ`), `factories/daily-question.ts`. Tracing off when a context goes offline (`test.use({ trace: 'off', video: 'off' })`, as the offline spec does).
- `AGENTS.md:66,101` -- the list of modules that open `my-love-db` and the unsent-queue exception; add `pickQueue` / `pick-queue` (docs-only commit).

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/dbSchema.ts` -- v16 store, types, constants.
- [ ] `src/services/pickQueue.ts` -- the queue service.
- [ ] `src/services/syncLock.ts` -- `PICK_QUEUE_LOCK`.
- [ ] `src/api/dailyQuestionApi.ts` -- `pickZone`, the `zone` parameter, `isPickRefusal`.
- [ ] `src/stores/slices/dailyQuestionSlice.ts`, `authSlice.ts` -- `dailyQueuedPicks`, offline enqueue, `drainQueuedPicks`, `signedOutState()`.
- [ ] `src/stores/slices/dailyQuestionSlice.ts` -- the backoff retry (Design Notes) and the in-flight promise.
- [ ] `src/App.tsx` -- the two drain triggers.
- [ ] `src/components/DailyQuestion/DailyQuestion.tsx` -- the queued and failed rendering.
- [ ] Unit: `tests/unit/services/pickQueue.test.ts` (new); schema tests (fresh profile and a v15 profile upgraded keep their rows and gain `pick-queue` with its key path and index); `tests/unit/stores/dailyQuestionSlice.pickQueue.test.ts` (new: every matrix row, including the faked-clock late drain asserting the `day_id`, `Date` and zone pair passed); the API, view, sign-out and App tests above.
- [ ] Unit, also:
  - The late drain is queued through the store: at 23:50 offline, `submitDailyPick`; at 00:10 online, the drain. It asserts the request's `day_id`, its 23:50 `Date` and the zone pair captured at 23:50.
  - The backoff retry: it runs after a transient stop while online, stops on a completed pass, and is cancelled by a session change; offline it waits for `online`.
  - A second call during a drain: one pass, no `loadDailyDay` from the lock-held path, and one more pass for a row queued meanwhile.
  - A same-account sign-in after sign-out sends the kept row.
  - The drain's outer catch: a failing queue write resolves, logs, and refreshes the field.
  - A failing row cleanup after a confirmed online send still shows and announces the pick.
  - The view with a pending row of another `day_id`: the options show, and no queued pick does.
  - The fresh-profile schema test asserts the `pick-queue` key path and `by-user` index.
- [ ] `tests/e2e/daily/daily-question-offline-pick.spec.ts` (new) -- the two E2E ACs below. In the refusal test, also assert:
  - the exact 400 status;
  - that `daily-pick-failed` contains the row's `failure`;
  - exactly one `submit_daily_pick` request.
- [ ] `AGENTS.md` -- the two mentions.

**Acceptance Criteria:**
- Given the worker pair on a local stack with cleared days, both on `/daily` with channels joined and reads settled, when the partner sends That, and the worker's page then goes offline and sends This, then:
  - no `submit_daily_pick` request is made;
  - the worker sees `daily-my-pick` with This's text, `daily-pick-queued`, "has picked" and no `daily-reveal`;
  - the worker's `pick-queue` holds one row for that day.
- When the worker's page then goes online, then:
  - one `submit_daily_pick` answers 200, with the row's `picked_at` in its body;
  - the worker's page shows the reveal marked "Different picks";
  - the queue is empty;
  - the partner's page shows the reveal without a reload.
- Given the worker alone with a queued offline pick, when the day's `couple_days.created_at` is moved 10 minutes ahead by the admin client and the page goes online, then the server refuses with `DQ002`, `daily-pick-failed` shows, the options and Send my pick show again, and the queue row has `failed: true`.

## Implementation Notes

- Built as planned by the implementing subagent. `refreshDailyDay` and the drain share one helper, `showIfOnScreen`, for the rule about which day's answer is shown.
- The refusal E2E sits in its own describe with the `skipNetworkMonitoring` annotation: the server's 400 (`DQ002`) is the point of the test.
- Parent fix after verification: the E2E log showed `drainQueuedPicks` reaching `loadDailyDay` through the lock-held path inside one tab. App calls the drain on mount and again when `isOnline` or `session` changes, and two overlapping drains in one tab found their own lock taken. The drain now keeps one in-flight promise per tab, as `drainQueuedNotes` does. A call while it runs asks for one more pass, so the lock is only ever found held by another tab. Two unit tests cover it.
- Parent addition: the slice header now describes the queue, as the plan asked.
- Verified by the parent in this session:
  - `npm run typecheck` 0 errors, `npm run lint` exit 0, `npx knip` clean.
  - `npm run test:unit`: 243 files, 4471 tests.
  - The TEA hook sweep exits 0.
  - Playwright set: 14 passed, and the row audit found no leftover rows.
  - `daily-question-offline-pick.spec.ts --repeat-each=3`: 6 passed.
- **Loopback 1 re-derivation** (after the bad_plan entry in the Plan Change Log):
  - **What the subagent did:** it re-applied the saved pass-1 patch, then added the backoff retry. Each pass now answers a `DrainPassOutcome` (`done`, `transient`, `offline`, `stale`, `other-tab`, `failed`), and only `transient` while online schedules a retry. It also made `isPickRefusal` a type guard and added the folded tests: the new `dailyQuestionSlice.pickQueue.retry.test.ts` (9 tests), a view test, fresh-profile schema assertions and the tighter refusal E2E.
  - **Parent fix:** both slice test files' `afterEach` now call `clearAuth()`. That session change cancels any retry timer a test left scheduled, so no timer can fire after the file ends (AGENTS: fire-and-forget work).
  - **Verified by the parent:**
    - typecheck 0 errors; lint, Knip and the hook sweep all exit 0;
    - `test:unit`: 244 files, 4481 tests, and the same with `SEED=101` and `SEED=202` on `test:unit:coverage`;
    - Playwright set: 14 passed, row audit clean;
    - the new spec with `--repeat-each=3`: 6 passed.

## Plan Change Log

### 2026-11-06 — Review pass 1 loopback (bad_plan)

- **Trigger:** blind-hunter and edge-case-hunter, each on its own. When a drain's send fails transiently while the device reports online, the row stays pending, and the card reads "Waiting for a connection to send your pick." This lasts until the next `online` event or app start. `postgrest-js` never retries a POST. The Code Map said "the pick drain needs no retry timer", which left the plan short of R7's "sent as soon as a connection returns".
- **Amended:**
  - **Code Map:** the `notesSlice` line now points at the retry backoff to copy.
  - **Tasks:** the retry task. Also this pass's patch rows (see the triage log), folded in so the re-derivation fixes them in one go:
    - the late-drain unit test queued through the store;
    - the drain's in-flight promise;
    - a same-account sign-in sending the kept row;
    - the drain's outer catch;
    - the failing cleanup after an online send;
    - the view with another day's row;
    - the fresh-profile schema assertions;
    - the refusal E2E's tighter checks;
    - `isPickRefusal` as a type guard.
  - **Design Notes:** the backoff rule and the type guard.
- **Known-bad state avoided:** a pick queued offline that never goes out while the device is online, with nothing on screen saying why.
- **KEEP:**
  - The reverted diff passed every Verification command: typecheck, lint, Knip, 4471 unit tests, the hook, the Playwright set 14/14 and the new spec 6/6 over 3 repeats. It is saved whole at `/private/tmp/claude-501/-Users-sallvain-Projects-My-Love--bmad-loop-runs-20261105-224246-5db5-worktrees-6-7/37fe84a2-df5b-4ad2-ad2d-86d7ebd396ed/scratchpad/ticket67-pass1.patch`.
  - Re-apply it first (`git apply <path>`; it applies cleanly to `baseline_revision`), then add only what this entry amends.
  - It already holds the in-flight promise and its two tests, and the slice header describing the queue.
  - Keep `showIfOnScreen`, the schema v16 branch, `pickQueue.ts`, the view's pending and failed rendering, both E2E tests (real `DQ002` through `created_at`, with the `skipNetworkMonitoring` describe), and the AGENTS.md two-line edit (a separate docs-only commit).

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 27 findings — high 0, medium 3, low 20, false 4, maybe-false 0
- findings:
  - `[low]` `[reject]` blind: a refused row's failure shows the context-prefixed text "[DailyQuestionApi.submitDailyPick] Database error: …". — Real (`errorHandlers.ts:62-84` via `toAccountDataError`). But a refusal needs a phone clock more than 5 minutes off or a relink, and the online send path already shows the same text; story 2's review rejected it for that path. The fix needs a per-code message map.
  - `[medium]` `[bad_plan]` blind: a transient send failure while online leaves the row pending, and the card says "Waiting for a connection…", until the next `online` event or start. — Real: the pass stops (`dailyQuestionSlice` drain), App triggers only on `online` and mount, and `postgrest-js` never retries a POST (`index.cjs:81-87,181-186`). Amended: Code Map, Tasks and Design Notes add a backoff retry as `notesSlice` has.
  - `[low]` `[reject]` blind: an online send that fails in transit is not queued. — The user sees `daily-send-error` and keeps the selection to send again, so nothing is dropped without a word. The intent queues offline picks. Queuing on a transport failure adds a branch to the online send.
  - `[low]` `[reject]` blind: a refused pick for a day no longer on screen is never shown. — Real, but a late pick is refused only on clock skew or a relink, and showing it needs new UI.
  - `[low]` `[reject]` blind: failed rows are never removed and survive sign-out. — The intent says "The queue survives sign-out", and AD-12 keeps a refused row in the queue, marked failed. There is one row per refused day, read only through the account's `by-user` index.
  - `[low]` `[reject]` blind: a failed IndexedDB read blanks `dailyQueuedPicks`, and the options come back. — Rare. A second pick replaces the row under its one key and the server keeps one pick per day, so nothing duplicates. The fix changes the service's read convention (reads return `[]` on failure).
  - `[low]` `[patch]` blind: the refusal E2E checks only the failure prefix and status ≥ 400, not the shown reason against the row, not the send count, and not a replacing Send. — Folded into the amended Tasks: the exact status, the row's `failure` text and one send. The replacing Send stays covered by the component test, because the moved `created_at` refuses any new pick that day.
  - `[low]` `[patch]` blind: no test signs the same account back in and shows the kept row sent. — Folded into the amended Tasks.
  - `[low]` `[defer]` blind: AGENTS.md's data-model paragraph does not describe the daily question's queue and copy. — The fix edits an agent-context file; it is deferred to finalize, recorded in `deferred` and the ledger.
  - `[false]` `[reject]` blind: the AGENTS.md hunks are mixed with the code. — Nothing is committed yet. Finalize commits AGENTS.md on its own.
  - `[low]` `[patch]` blind: the `'Your pick was refused.'` fallback cannot run, because `isPickRefusal` admits only an `AccountDataError`. — Folded in: `isPickRefusal` becomes a type guard.
  - `[low]` `[reject]` blind: a queued pick cannot be changed or withdrawn. — The intent: "the pick control is disabled while either exists".
  - `[medium]` `[bad_plan]` edge: a transient failure while online leaves the row pending with no retry. — Same root cause and amendment as the second blind row.
  - `[low]` `[reject]` edge: with `navigator.onLine` true but no network, the pick is not queued. — Same claim and reason as the third blind row.
  - `[low]` `[reject]` edge: a failed `listQueuedPicks` read overwrites the field. — Same claim and reason as the sixth blind row.
  - `[low]` `[reject]` edge: refused rows stay on disk and survive sign-out. — Same claim and reason as the fifth blind row.
  - `[low]` `[patch]` edge: the fresh-profile schema test asserts only that the store exists and the count, not its key path or index (the plan asked for both). — Folded into the amended Tasks.
  - `[low]` `[patch]` verification-gap: no view test has a pending row for a different `day_id` than the one shown. — Folded into the amended Tasks.
  - `[low]` `[patch]` verification-gap: the drain's outer catch (a failing `removeQueuedPick` or `markQueuedPickFailed`) is untested. — Folded into the amended Tasks.
  - `[low]` `[patch]` verification-gap: the logged failing row cleanup after a confirmed online send is untested. — Folded into the amended Tasks.
  - `[low]` `[reject]` verification-gap (other): the stored failure text carries the context prefix. — Same claim and reason as the first blind row.
  - `[medium]` `[patch]` intent: the 11:50 PM / 12:10 AM unit test seeds the row by hand, so the queueing at 23:50 that the verify names is not exercised. — Folded into the amended Tasks: the test queues through `submitDailyPick` at 23:50, offline.
  - `[false]` `[reject]` intent: the pick control is absent rather than disabled. — The same intent sentence covers the server's own pick, whose waiting screen has never shown the options (story 12). Absent is how "disabled" already reads for that case.
  - `[low]` `[patch]` intent: the wording a real refusal shows is not verified. — Same root cause as the refusal E2E row (the weak assertions); folded in with it.
  - `[false]` `[reject]` intent: the partner sees the reveal without a reload, more than the intent asks. — There is no bad outcome; story 6's live path is the expected one.
  - `[low]` `[patch]` intent: a sign-out and same-account sign-in drain is not tested end to end. — Same root cause and fold as the eighth blind row.
  - `[false]` `[reject]` intent: an offline pick made after midnight on a stale screen is refused, not queued. — AD-12: "The client refuses a pick when the device date is not the shown day's day, and re-fetches".

### 2026-11-06 — Review pass
- verdicts: 31 findings — high 0, medium 0, low 23, false 8, maybe-false 0
- findings:
  - `[low]` `[reject]` blind: a refused row's failure shows the context-prefixed "[DailyQuestionApi.submitDailyPick] Database error: …" text. — carried: the pass-1 row; refusals are rare, and the online path shows the same text.
  - `[low]` `[reject]` blind: a failed queue read looks empty, so the field blanks and the drain answers `done`, cancelling the retry. — carried: the pass-1 row (a failed read blanks the field). The new detail, the cancelled retry, shares its cause: the service's `[]`-on-failure read convention. The next `online` event or start drains again.
  - `[low]` `[patch]` blind: the try/catch around the drain's final `showQueuedPicks` cannot catch anything, and its comment ("an unreadable queue leaves it as is") is false. — Patched: the try/catch is removed, and the comment now says the field is refreshed on every path and an unreadable queue reads as empty.
  - `[low]` `[reject]` blind: "Waiting for a connection to send your pick." is wrong while online after a transient failure. — The backoff resends in 5–60 s. The wording is the intent-contract's, and a transient stop while online is not everyday.
  - `[low]` `[reject]` blind: a pick is queued only when `navigator.onLine` is false. — carried: the pass-1 row; the user sees the send error and keeps the selection.
  - `[low]` `[patch]` blind: a `failed` pass (a queue write threw) and an `other-tab` pass leave pending rows with no retry. — Patched for `failed`: it now schedules the backoff retry, as `transient` does. A test makes the removal fail once after a confirmed send, and the retry pass removes the row, announces the day and shows the answer. The `other-tab` part is not fixed: it needs the other tab to close mid-retry, and the next `online` event or start covers it.
  - `[low]` `[reject]` blind: refused rows are never removed and survive sign-out. — carried: the pass-1 row; the intent says the queue survives sign-out.
  - `[low]` `[reject]` blind: the backoff never gives up on a permanent non-refusal error (P0001, 42501, `invalid-response`). — These need a session-less request (which the session guard turns into a transient `TypeError`) or a broken deploy. The note drain retries the same way, and a cap adds attempt state.
  - `[low]` `[reject]` blind: a reconnect starts two passes (the `online` handler, then the mount effect re-run by `isOnline`), so a transient first pass is retried at once. — Real, but it costs one extra request on a failed reconnect and one IndexedDB read per reconnect. The note drain shares the pattern, and the fix means splitting App's effect.
  - `[low]` `[defer]` blind: AGENTS.md is incomplete (the data-model paragraph, and the localCopy rule's queue exception). — carried: the pass-1 defer, widened by the localCopy-rule detail. Recorded in `deferred`.
  - `[false]` `[reject]` blind: the AGENTS.md edits need their own commit. — carried: the pass-1 row; finalize commits AGENTS.md on its own.
  - `[false]` `[reject]` blind: the plan file is untracked and not in the diff. — The review diff leaves `_bmad-output/` out on purpose (the plan goes only to the claims lenses), and finalize commits the plan.
  - `[low]` `[patch]` blind: the E2E spec re-sorts the pair by hand and never asserts there is one day. — Patched: `readPairDayIds` and `setPairDaysCreatedAt` now live in `tests/support/factories/daily-question.ts` on a shared `orderedPair`, which the factory's two existing functions now use too. The spec asserts exactly one day id.
  - `[low]` `[patch]` blind: `QueuedDailyPick` copies `StoredQueuedPick`'s fields by hand. — Patched: it is now `Pick<StoredQueuedPick, 'day_id' | 'choice' | 'picked_at' | 'failed' | 'failure'>`.
  - `[low]` `[patch]` blind: no view test has a refused row while the partner has picked. — Patched: a test in `DailyQuestion.test.tsx` shows the options, the failure, "has picked", and no reveal.
  - `[low]` `[patch]` blind: no test checks that the other-tab path refreshes `dailyQueuedPicks`. — Patched: the lock-held test asserts the field after the drain.
  - `[low]` `[patch]` blind: no App test shows that a start while offline does not drain picks. — Patched: a test in `App.localCopyRefresh.test.tsx`.
  - `[false]` `[reject]` blind: the DQ002 E2E leaves the old selection checked when the options return, and nothing asserts it. — No bad outcome is named. The card keeps its `day_id`, so the selection stays, and Send works on it.
  - `[low]` `[reject]` edge: the refusal text carries the context prefix. — carried: the pass-1 row.
  - `[low]` `[patch]` edge: an `online` drain that reads the queue before an offline enqueue commits leaves the row pending while online. — Patched: after the enqueue, `submitDailyPick` starts a drain when `isOnline()` holds and the session is current. Two tests cover a connection that returns during the `put`, and one that stays offline.
  - `[low]` `[patch]` edge: `failed` and `other-tab` passes get no retry. — Same entry as the blind `failed`/`other-tab` row: `failed` is patched, `other-tab` is not.
  - `[low]` `[reject]` edge: the backoff never gives up on a permanent error. — Same claim and reason as the blind row.
  - `[low]` `[reject]` edge: a refused pick for another day is never surfaced, and failed rows stay forever. — carried: the pass-1 rows.
  - `[low]` `[reject]` edge: another tab replaces a row while this tab's refused send is in flight, and the new row is marked failed. — Needs two tabs, an offline enqueue in the stale tab and a refusal in the same moment. The fix adds a compare parameter to `markQueuedPickFailed`.
  - `[low]` `[patch]` verification-gap (other): a confirmed drain send whose row removal throws gets no retry, so the card stays "Waiting…" and the partner is not told. — Same entry as the blind `failed`/`other-tab` row: patched by the `failed` retry, with the test named there.
  - `[false]` `[reject]` intent: the late-pick date is not proven end to end; the unit test mocks the RPC. — The verify asks what the pick is "sent with": its 11:50 PM `picked_at` and its day. The test asserts both on the request. Server-side dating by `picked_at` is story 2's pgTAP (`41_daily_question_own_clocks.sql`).
  - `[false]` `[reject]` intent: the zone test computes its expected value with the same `pickZone`. — `pickZone` has its own test against a literal value (`dailyQuestionApi.test.ts`, the `pickZone` describe). The late-drain test shows the queued pair is re-sent after the device zone changes.
  - `[false]` `[reject]` intent: the controls are hidden rather than disabled, and come back after a refusal. — carried: the pass-1 row.
  - `[low]` `[reject]` intent: the "at start" trigger is tested only in an App unit test, with the drain mocked. — An E2E start needs a reload with a pick queued, which dev mode cannot do offline. The App test covers the trigger, and the slice tests cover the drain it calls.
  - `[false]` `[reject]` intent: the row's extra `failure` field goes beyond the listed fields. — "Its failure shown" needs the reason kept beside `failed`. Nothing is lost.
  - `[false]` `[reject]` intent: the `zone` parameter, the new exports, the cleanup of a failed row and the AGENTS.md edit are outside the intent's surface. — Each one serves a requirement the intent states, and no bad outcome is named.

## Design Notes

- A failed row stops being pending: it shows its failure and gives the pick control back, so the user is never stuck on a day. A new Send replaces it under the same key, and the server holds no pick to duplicate. AD-12's "disabled while either exists" is read as a pending row.
- Refusal codes are listed explicitly (the four the RPC raises). A broader rule (any SQLSTATE) would mark a statement timeout or a 401 as permanent.
- A queued pick for a day that is no longer shown (sent after midnight) is not on screen. The drain still sends it with its own `day_id` and `picked_at`, and its answer goes into the copy only.
- A pass that stops on a transient failure while online is retried with a backoff, as `notesSlice` does:
  - 5 s, 10 s, 20 s and 40 s, then every 60 s, until a pass completes;
  - one timer at a time, holding the session it was set for; an account or session change cancels it, and a timer that fires anyway re-checks that session before it drains;
  - known offline, nothing is scheduled, and the `online` event drains instead.

  The 5-minute interval stays out (Boundaries). This is a retry of a failed pass, not a new schedule.
- `isPickRefusal` is a type guard (`error is AccountDataError`), so the drain stores `error.message` with no fallback branch.
- E2E refusal uses a real `DQ002`: moving the day's `created_at` ahead puts the queued `picked_at` before the window. There is no page clock and no faked response.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors beyond the worktree's known TS2883 baseline in `tests/support/merged-fixtures.ts`.
- `npm run lint` -- expected: exit 0 (includes Knip).
- `npm run test:unit` -- expected: all pass.
- `echo '{}' | node .claude/hooks/tea-enforce.cjs --stop` (sweeps recently modified test files) -- expected: exit 0, no findings.
- `supabase start` (CLI from `.mise.toml`), then `npx playwright test tests/e2e/daily/ tests/e2e/auth/login.spec.ts tests/e2e/offline/love-notes-offline-send.spec.ts --project=chromium` -- expected: all pass; then `tests/e2e/daily/daily-question-offline-pick.spec.ts --repeat-each=3` passes.

## Auto Run Result

Status: built

**Summary:** A pick made offline is no longer refused. It waits on the device and goes out when the connection returns.
- **Queue:** Send my pick, offline, writes the pick to a new per-account `pick-queue` IndexedDB store, with the instant and zone it was made in. The store is v16, keyed `[user_id, day_id]` with a `by-user` index, and opened through `openMyLoveDB()`.
- **Drain:** `dailyQuestionSlice.drainQueuedPicks` sends only the signed-in account's pending rows, oldest first, under `PICK_QUEUE_LOCK`. It runs on start, on `online`, and after an offline enqueue if the connection has just returned. It re-sends each row's own `day_id`, `picked_at` and zone pair, with no device-date check, so a pick made at 11:50 PM and sent at 12:10 AM counts for its own day (story 2's rule).
- **Outcomes:** a confirmed pick is removed from the queue, announced to the partner (`daily_pick`, as story 6 does), merged into the copy and shown. A refusal (`DQ001`, `DQ002`, `P0002`, `22023`) marks the row failed with its message. Any other failure leaves it pending and retries on a backoff (5, 10, 20, 40 s, then every 60 s) while online.
- **Concurrency:** one drain runs per tab, and a call made while it runs asks for one more pass. Another tab holding the lock is waited for.
- **Daily screen:**
  - A pending row shows as "Your pick" with its time and "Waiting for a connection to send your pick.", with no options and never the reveal.
  - The server's own pick always wins over a queued row.
  - A refused row gives the options back beside "Your pick could not be sent. …", and a new Send replaces it.
  - A queued pick never enters `dailyDay` or the `daily-days` copy.
- **Sign-out:** the rows survive sign-out, and only the view's field `dailyQueuedPicks` is cleared.

**Files changed:**
- `src/services/dbSchema.ts`: v16 `pick-queue` store, the `StoredQueuedPick` type, `STORE_NAMES.PICK_QUEUE`.
- `src/services/pickQueue.ts` (new): enqueue, list (oldest first), mark failed, remove.
- `src/services/syncLock.ts`: `PICK_QUEUE_LOCK`.
- `src/api/dailyQuestionApi.ts`: `pickZone`, a `zone` parameter on `submitDailyPick`, and the `isPickRefusal` type guard.
- `src/stores/slices/dailyQuestionSlice.ts`: `dailyQueuedPicks`, the offline enqueue, `drainQueuedPicks` (per-tab in-flight promise, backoff retry, session checks), `showIfOnScreen` shared with `refreshDailyDay`, and the header.
- `src/stores/slices/authSlice.ts`: `dailyQueuedPicks: []` in `signedOutState()`.
- `src/App.tsx`: drains on `online` and at signed-in start.
- `src/components/DailyQuestion/DailyQuestion.tsx`: pending and refused rendering; the view's own offline refusal is gone.
- Unit tests:
  - New: `tests/unit/services/pickQueue.test.ts`, `tests/unit/services/dbSchema.upgradesToV16.test.ts`, `tests/unit/stores/dailyQuestionSlice.pickQueue.test.ts`, `tests/unit/stores/dailyQuestionSlice.pickQueue.retry.test.ts`.
  - Updated: the schema, API, view, sign-out and App tests.
- E2E:
  - `tests/e2e/daily/daily-question-offline-pick.spec.ts` (new): an offline pick beside a partner pick, sent and revealed on reconnect; a real `DQ002` refusal shown.
  - `tests/support/factories/daily-question.ts`: `readPairDayIds`, `setPairDaysCreatedAt`, and a shared `orderedPair`.
- `AGENTS.md`: `pickQueue` in the list of modules that open `my-love-db`; `pick-queue` beside `note-queue` as a queue that survives sign-out (its own docs commit).

**Review findings:** two review passes, each with 4 lenses (blind-hunter, edge-case-hunter, verification-gap, intent-alignment).
- **Pass 1 (27 findings: medium 3, low 20, false 4):** one bad_plan loopback. A transient send failure while online left a queued pick stuck as "Waiting for a connection" until the next `online` event or start, because `postgrest-js` never retries a POST. The plan gained a backoff retry. The code was reverted and re-derived from the saved pass-1 patch with the retry added. The pass's 13 patch-route rows were folded into the re-derivation:
  - the late-drain test now queues through the store at 23:50;
  - fresh-profile schema assertions;
  - view, sign-in, outer-catch and online-cleanup tests;
  - the tighter refusal E2E;
  - `isPickRefusal` as a type guard.
- **Pass 2 (31 findings: low 23, false 8):** 8 patch entries applied:
  - a dead try/catch and its comment;
  - a retry after a `failed` pass (a queue write threw), with a test;
  - a drain started after an offline enqueue when the connection has just returned, with tests;
  - the E2E pair helpers moved into the factory, asserting one day;
  - `QueuedDailyPick` derived with `Pick<>`;
  - a view test of a refused row with the partner picked;
  - the lock-held test asserting the field;
  - an App test for no drain at an offline start.
- **Deferred (1):** AGENTS.md does not describe the daily question's offline model or the localCopy rule's second queue-store exception. The fix edits an agent-context file. It is in `deferred` for the orchestrator's ledger copy.
- **Rejected:**
  - The refusal message carries the API's context prefix (4 rows). Refusals need a phone clock more than 5 minutes off or a relink, and the online send path already shows the same text.
  - An online send that fails in transit is not queued (3 rows). The user sees the error and keeps the selection.
  - A failed queue read reads as empty (3 rows). This is the service's `[]`-on-failure convention, and a second pick replaces the row under one key.
  - Refused rows stay, survive sign-out, and are not shown for another day (5 rows). The intent keeps the queue across sign-out, and refusals are rare.
  - The backoff never gives up on a permanent error (2 rows). This needs a broken deploy, and notes retry the same way.
  - Two passes on reconnect cost one extra request.
  - "Waiting for a connection" while a retry is pending. This is the contract's wording, and the retry runs within 60 s.
  - A two-tab replace race.
  - An "at start" E2E. Dev mode cannot reload offline, and the unit tests cover both halves.
  - A queued pick cannot be withdrawn. The intent disables the control.
  - 12 false rows: the docs commit, the untracked plan, hidden-versus-disabled (twice), the stale-screen refusal, the partner seeing it live, server-side dating proven by pgTAP, the `pickZone` literal test, the `failure` field, out-of-surface changes, and an unasserted selection.

**Follow-up review recommended: false.** No high was patched in either pass. Pass 1 routed its 3 mediums to the bad_plan loopback, and pass 2 patched 0 high, 0 medium and 8 low.

**Verification (parent session, after the last patch, on the shared local stack, CLI 2.122.0):**
- `npm run typecheck`: 0 errors. `npm run lint`, `npx knip` and the TEA hook sweep all exit 0.
- `npm run test:unit`: 244 files, 4486 tests. The same passed shuffled with `SEED=303` (and with 101 and 202 before the last patches).
- Playwright, chromium (`tests/e2e/daily/`, `login.spec.ts`, `love-notes-offline-send.spec.ts`): 14 passed, row audit clean.
- `daily-question-offline-pick.spec.ts --repeat-each=3`: 6 passed.
- The implementing subagent removed the `failed` retry and the post-enqueue drain one at a time and saw their new tests fail. The parent saw the pass-1 in-flight test fail by construction, without the guard.
- No migration, RPC or `database.types.ts` change, so `supabase test db` and `db:types` were not needed.

**Residual risks:**
- A refused pick shows the API's prefixed message ("[DailyQuestionApi.submitDailyPick] Database error: …").
- A refused pick for a day no longer on screen is not shown anywhere, and refused rows stay on the device.
- An online send that fails in transit is shown as an error, not queued.
- A pending row stuck by an `other-tab` pass, whose tab then closes, waits for the next `online` event or start.
- WebKit and Firefox were not run (the plan names chromium).
