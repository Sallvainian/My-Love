---
title: 'Daily shows its saved day offline and invites an unlinked account to link'
type: 'feature'
ticket: '5'
created: '2026-11-06'
status: done
baseline_revision: 'bb3de4d4b9fcfb3351e772f63de2eee254e276b2'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Daily has no saved copy. Offline it shows only an error, and an unlinked account sees a blank page instead of an invitation to link (epic R7, R8; spine AD-12, AD-13).

**Approach:** Add a `daily-days` local-copy kind: a map keyed by `day_id`, written only through one merge function that holds a lock, in which an entry's state never moves back. `loadDailyDay` shows the saved entry for the device's date first, then merges every server answer through that function. Register the kind's refresher and stub it in the two sign-in test files. The view shows the invitation (Go to Partner) only for an `unlinked` answer.

## Boundaries & Constraints

**Always:**
- New `src/services/dailyDaysCopy.ts` owns the kind `DAILY_DAYS_COPY_KIND = 'daily-days'`, whose value is `Record<day_id, DailyDaySnapshot>`, plus two functions:
  - `readSavedDailyDay(userId, day)`: returns the saved snapshot whose `day` equals the given `YYYY-MM-DD`, or `null`. Entries that fail `DailyDaySnapshotSchema` are dropped. If two entries share that `day`, it returns the higher-ranked one.
  - `mergeDailyDay(userId, answer, isCurrent)`: the only writer of the kind. It runs under the new waiting lock `DAILY_DAYS_LOCK`, reads the map and merges the answer:
    - `ok`: replaces the entry for `snapshot.day_id` unless the stored entry ranks higher (`none` 0 < `me`/`partner` 1 < `both` 2), then keeps the 31 newest entries by `day`.
    - `unlinked`: writes `{}`, since the server says there is no day.
    - It writes only while `isCurrent()` holds. A failed write is logged, not thrown.
    - It returns the answer to show: the merged entry, or `unlinked`.
- `src/services/syncLock.ts` gains `withWaitingLock(name, fn)`. It waits for the lock: `navigator.locks.request(name, fn)` without `ifAvailable`, or a per-name in-memory promise chain where `navigator.locks` is missing (happy-dom). `withSyncLock` itself is not changed.
- `loadDailyDay` keeps story 12's session check before every write. Order:
  1. Read the saved entry for `formatDateISO(new Date())`. Show it when `dailyDay` is `null` or holds an `ok` snapshot of another `day`. When the same `day_id` is shown, keep the higher of the two (`mergeAnswer`).
  2. Call `fetchDailyDay`.
  3. On success, `mergeDailyDay`, then set `dailyDay` = `mergeAnswer(get().dailyDay, merged)`.
  4. On the `offline` error: when today's saved snapshot is shown, set no error and log nothing. Otherwise set the error to the API's own message, "You are offline. Today's question needs a connection to load."
  5. Any other failure keeps whatever is shown and sets the error, as in story 12.
- A successful `submitDailyPick` also goes through `mergeDailyDay`, because a confirmed own write is a fill source in the `localCopy.ts` header.
- `registerLocalCopy(DAILY_DAYS_COPY_KIND, () => get().loadDailyDay())` sits in the slice creator. It is stubbed as a no-op, and restored afterwards, in `tests/support/harnesses/auth-bootstrap-notification-order.tsx`. `tests/e2e/auth/login.spec.ts` answers POST `**/rest/v1/rpc/get_daily_day` with `{"status":"unlinked"}`.
- On `unlinked`, the view shows `data-testid="daily-invite"`: an `h1` "Link with your partner", the line "Daily asks you both one question a day. Link your accounts to start.", and a `PRIMARY_BUTTON` "Go to Partner" (`daily-invite-link`) that calls the store's `navigatePartner`. It shows no question and no pick control.
- Relative imports in `src/`. E2E imports from `tests/support/merged-fixtures.ts`, uses `goOffline`, `savedLocalCopy`, `clearPairDays` and `ensureTestCoachQuestions`, and installs routes before the navigation they serve.

**Never:**
- Write the copy from a failed read, or show the invitation for anything but an `unlinked` answer.
- Put a queued pick, the pick queue, Realtime, `get_daily_day_by_id`, the write prompt, `daily-write-declined`, the dock or `/mood` in this story (those are stories 6 to 9).
- Add a new slice field or a new IndexedDB store, or bump `DB_VERSION`.
- Make any migration or `database.types.ts` change.
- Touch `DailyMessage/` or `messagesSlice`.
- Link, unlink or reset a pool account in a spec.
- Parse `YYYY-MM-DD` with `new Date(string)`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Online read | `ok` for today | shown; the map gains or updates its `day_id` | — |
| Slower lower read | stored `both`, answer `me` for the same `day_id` | the map and the screen stay `both` | — |
| Unlinked | `{status:'unlinked'}` | invitation; map written `{}` | — |
| Offline, saved today | copy holds today's `day` | saved snapshot shown, no request | no error shown |
| Offline, none saved | empty copy, or only yesterday | no question, no invitation | "…needs a connection to load." with Retry |
| Failed read, saved today | RPC aborted | saved snapshot shown, never the invitation | request's error shown |
| Failed read, none saved | RPC aborted, empty copy | no question, no invitation | request's error with Retry |
| Pick confirmed | `submit_daily_pick` answer `me` | the map's entry becomes `me` | — |
| Session changes mid-merge | sign-out before the write | copy not written, state not set | — |
| Many days | 32 saved entries | the oldest `day` is dropped | — |

</intent-contract>

## Code Map

- `src/services/localCopy.ts` -- `readLocalCopy` (null on failure), `writeLocalCopy` (throws), `registerLocalCopy`. Sign-out's `deleteAccountCopies` already removes every kind for the account, so it needs no change. Header rules: fill sources, identity.
- `src/services/syncLock.ts:54-84` -- `withSyncLock` skips when the lock is held, so the merge cannot use it. Add `DAILY_DAYS_LOCK = 'my-love:daily-days'` and `withWaitingLock` here.
- `src/stores/slices/dailyQuestionSlice.ts` -- `STATE_RANK` and `mergeAnswer` (move the rank into the service and import it back), `loadDailyDay`, `submitDailyPick`. Update the header comment ("has no local copy yet").
- `src/stores/slices/notificationsSlice.ts:85-140` -- the pattern to follow: `registerLocalCopy` in the creator, saved copy first, server answer second.
- `src/api/dailyQuestionApi.ts` -- `fetchDailyDay` already throws `AccountDataError('offline')` with the needs-a-connection sentence before any request. `src/api/validation/dailyQuestionSchemas.ts` -- `DailyDaySnapshotSchema`, `DailyDayAnswer`.
- `src/utils/dateUtils.ts:150` -- `formatDateISO(date)` gives the device's local `YYYY-MM-DD`.
- `src/components/DailyQuestion/DailyQuestion.tsx:203-249` -- the parent render, which currently draws nothing for `unlinked`. Kit classes come from `../shared/kitClasses`. `navigatePartner` is in `src/stores/slices/navigationSlice.ts:~284`; `src/components/Settings/PartnerPage.tsx:62,108` shows how it is used.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx:218-254` -- the no-op list and the restore list. Add the kind to both.
- `tests/e2e/auth/login.spec.ts:76-123` -- defensive stubs; `serve` answers GET only.
- `tests/e2e/partner/partner-connect.spec.ts:66-95,180-189` -- `createThrowaway` (a real unlinked account with a name, so no name-setup screen) and `signIn` through the form. Move both, unchanged, to `tests/support/helpers/throwaway-account.ts` and import them back, so the new spec does not copy them.
- `tests/e2e/offline/interactions-offline-copy.spec.ts` -- the offline-copy E2E pattern. Dev mode has no service worker, so the reload runs online with the endpoint aborted and the page goes offline afterwards. It uses `trace: 'off', video: 'off'`.
- `tests/e2e/daily/daily-question-pick-and-reveal.spec.ts:30-80` -- pair setup and the two-context pattern. `tests/support/helpers/reads.ts:131` `DAILY_DAY_READ`; `tests/support/helpers/local-copy.ts` `savedLocalCopy(page, kind)`.
- `tests/unit/stores/dailyQuestionSlice.test.ts`, `tests/unit/stores/dailyQuestionFixture.ts`, `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx` -- the existing mocks (`vi.mock` of the API). The slice tests now also need the copy service: use real fake-indexeddb or `vi.mock('../../../src/services/dailyDaysCopy')`, whichever the file already allows. `tests/unit/services/localCopy.test.ts` shows how fake-indexeddb is set up.
- Unit tests that run the real store's `refreshLocalCopies` (`tests/unit/App.*.test.tsx`, `loaderIdentityGuards.*`) will now reach `fetchDailyDay`. Run the full unit suite and stub it where a test fails on it.

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/syncLock.ts` -- `DAILY_DAYS_LOCK`, `withWaitingLock` -- the merge must wait, not skip.
- [ ] `src/services/dailyDaysCopy.ts` -- the kind, `dailyStateRank`, `readSavedDailyDay`, `mergeDailyDay` per Boundaries.
- [ ] `src/stores/slices/dailyQuestionSlice.ts` -- register the refresher; the saved day first; merge on success (load and submit); the offline branch.
- [ ] `src/components/DailyQuestion/DailyQuestion.tsx` -- the invitation for `unlinked`; header comment.
- [ ] `tests/support/harnesses/auth-bootstrap-notification-order.tsx`, `tests/e2e/auth/login.spec.ts` -- stub the new read.
- [ ] `tests/support/helpers/throwaway-account.ts` + `tests/e2e/partner/partner-connect.spec.ts` -- move `createThrowaway`, its `Throwaway` type and `signIn`.
- [ ] `tests/unit/services/dailyDaysCopy.test.ts` -- every matrix row at the service level: no regress, unlinked clears, prune at 31, `isCurrent` false writes nothing, two concurrent merges (`me` and `both`) both serialised so the result is `both`, a malformed entry dropped, a failed write logged with `toHaveBeenCalledWith`.
- [ ] `tests/unit/stores/dailyQuestionSlice.test.ts` -- the saved day shown before the fetch settles; offline with saved today shows no error and sends no request; offline with none saved sets the offline message; a failed read never sets `unlinked`; the submit answer merged into the copy; a session change mid-load writes nothing.
- [ ] `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx` -- the invitation renders only on `unlinked`; Go to Partner calls `navigatePartner`; no invitation on a failed load.
- [ ] `tests/e2e/daily/daily-question-offline-and-invite.spec.ts` -- the three Acceptance tests below, `[P1]`.

**Acceptance Criteria:**
- Given a throwaway account with no partner on a local stack, when it opens `/daily`, then `get_daily_day` answers `unlinked`, `daily-invite` shows with no `daily-question`, and tapping Go to Partner lands on `/partner`, showing the "Connect with Your Partner" heading.
- Given the worker pair with cleared days, when the worker loads `/daily` online (the `daily-days` copy then holds that `day_id`), then reloads with `get_daily_day` aborted and goes offline, then the same question text shows, and neither `daily-invite` nor `daily-loading` shows.
- Given a fresh context for the worker with an empty copy and `get_daily_day` aborted, when `/daily` loads, then an error shows and `daily-invite` does not. Going offline and tapping Retry then shows "You are offline. Today's question needs a connection to load." with no question and no invitation.

## Implementation Notes

- Built as planned. Files: `src/services/dailyDaysCopy.ts` (new: kind, `dailyStateRank`, `readSavedDailyDay`, `mergeDailyDay`, `MAX_SAVED_DAILY_DAYS = 31`), `src/services/syncLock.ts` (`DAILY_DAYS_LOCK`, `withWaitingLock`), `src/stores/slices/dailyQuestionSlice.ts`, `src/components/DailyQuestion/DailyQuestion.tsx` (`daily-invite`, `daily-invite-link`), and the stubs, the helper move and the tests from Tasks.
- Not in the plan: registering the refresher means every pool sign-in now runs `get_daily_day`, which assigns today's `couple_days` row for the pair. The run's leftover-row audit then failed on `couple_days` (+1 per pair). `tests/support/helpers/row-audit.ts` now audits `daily_picks` (by `user_id`) in place of `couple_days`: a sign-in never makes a pick, and `clearPairDays` removes picks with their days. Because service_role may not read `daily_picks.choice` (AD-5), the count now selects each table's first ownership column, not `*`. The `clearPairDays` doc comment says the same. Pool pairs now keep one unpicked day per pair per run date, which no spec reads: the daily specs clear their pair's days first.
- `loadDailyDay` reads the copy before it fetches, so the request starts one tick later. Two slice tests and two view tests now wait with `waitFor`.
- `withWaitingLock` uses a blocking Web Lock, with a per-name promise chain where `navigator.locks` is missing (happy-dom).

## Plan Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 4, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` `mergeDailyDay` treats a failed copy read like an empty copy, so it rewrites the map with only the new entry. This drops other saved days and can store a lower state than the lost one. — Real (`readLocalCopy` returns `null` for both cases, `localCopy.ts:89-98`), but it needs an IndexedDB read to fail and the write that follows to succeed on the same database. The copy is a cache, and the next successful read restores the server's state. The screen keeps the higher state through `mergeAnswer`. The fix adds a throwing read variant to `localCopy.ts`, which is new public surface, for a case not met in everyday use.
  - `[low]` `[reject]` The row-audit change (`daily_picks` in place of `couple_days`, the column select) and its cause are not recorded, and pool pairs now gather an unpicked day per run date. — The change is needed: the planned refresher creates the row on every sign-in (`20261106000000_…sql:344`). The rows it leaves are unpicked days that no spec reads, since the daily specs clear first, and a leaked pick still fails the audit. The fix asked for is recording it in this plan, so it is rejected under the plan-edit rule. Implementation Notes record it anyway.
  - `[low]` `[patch]` A slice test is named "…sends no request…" but mocks `fetchDailyDay` and never checks for a request. — Renamed to "with today saved: shows it, sets no error and logs nothing when the API refuses offline". The API's own tests pin the refusal before any request.
  - `[low]` `[patch]` A view test is named "…with or without a saved day" but writes no saved day. — Renamed to "shows no invitation when the load fails with nothing saved". The next test covers the saved case.

## Design Notes

- The merge returns what to show, so the slice never reads the copy back after a write. `mergeAnswer` stays in the slice as an in-memory guard for when the copy read fails.
- What "a failed read" means here: offline is the needs-a-connection case, which AD-12 phrases as "a device with no day for today". An online failure with nothing saved keeps story 12's error and Retry, because the offline sentence opens with "You are offline." and would be untrue online. Neither failure shows the invitation.
- `unlinked` writes `{}` because the localCopy rule saves "the server says there is nothing" as such. That also stops a later offline open from showing a day from a past pairing.
- If the view is left open past midnight while offline, yesterday's card stays up with the offline error. A failed load never clears what is shown, and story 2's date check refuses a pick on it.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0.
- `npm run lint` -- expected: exit 0.
- `npx vitest run tests/unit/services/dailyDaysCopy.test.ts tests/unit/stores/dailyQuestionSlice.test.ts src/components/DailyQuestion tests/unit/stores/signOutClearsAccountState.test.ts` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `supabase start` (the CLI from `.mise.toml`), then `npx playwright test tests/e2e/daily/ tests/e2e/auth/login.spec.ts tests/e2e/partner/partner-connect.spec.ts --project=chromium` -- expected: all pass. Rerun the daily folder with `--repeat-each=2` to show it repeats.

## Auto Run Result

Status: built

**Summary:** Daily now keeps a saved copy of its days.
- **The copy:** a `daily-days` local copy, a map keyed by `day_id`. It is written only by `mergeDailyDay`, which holds a waiting lock across tabs, never moves an entry's state back, keeps the 31 newest days, and saves an `unlinked` answer as `{}`.
- **Loading:** `loadDailyDay` shows the device date's saved day first, then merges every successful read and every confirmed pick into the copy.
  - Offline with today saved, it shows that day with no error.
  - Offline with nothing saved, it shows "You are offline. Today's question needs a connection to load."
  - A failed read never shows the invitation.
- **Unlinked:** an `unlinked` answer shows the invitation to link, and its Go to Partner button opens the Partner page.
- **Refresher and stubs:** the kind's refresher runs on signed-in start and on reconnect. It is stubbed in the auth-bootstrap harness and in `login.spec.ts`.

**Files changed:**
- `src/services/dailyDaysCopy.ts`: the new kind, the merge function and the saved-day read.
- `src/services/syncLock.ts`: `DAILY_DAYS_LOCK` and `withWaitingLock`.
- `src/stores/slices/dailyQuestionSlice.ts`: the refresher, the saved day shown first, the merge on read and on pick, and the offline branch.
- `src/components/DailyQuestion/DailyQuestion.tsx`: the invitation card.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx`, `tests/e2e/auth/login.spec.ts`: stubs for the new read.
- `tests/support/helpers/throwaway-account.ts`, `tests/e2e/partner/partner-connect.spec.ts`: `createThrowaway`, `Throwaway` and `signIn` moved into a shared helper.
- `tests/support/helpers/row-audit.ts`, `tests/support/factories/daily-question.ts`: the audit counts `daily_picks` instead of `couple_days`, and selects the ownership column.
- `tests/unit/services/dailyDaysCopy.test.ts`, `tests/unit/stores/dailyQuestionSlice.test.ts`, `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx`: unit and view tests.
- `tests/e2e/daily/daily-question-offline-and-invite.spec.ts`: the three `[P1]` acceptance tests.

**Review findings:** 4 findings, all low.
- **Patched:** 2 test names.
- **Deferred:** none.
- **Rejected:**
  - A failed copy read rewrites the map. It is rare, self-heals at the next read, and the fix adds new `localCopy` surface.
  - The row-audit change was not recorded. The fix is a plan edit; Implementation Notes record it anyway.

**Follow-up review recommended: false.** This first pass patched high 0, medium 0, low 2.

**Verification (after the patches):**
- `npm run typecheck` exited 0.
- `npm run lint` exited 0.
- `npm run test:unit` passed 231 files and 4309 tests.
- The targeted vitest files passed 144 tests before the renames.
- On a local stack (Supabase CLI 2.122.0), `npx playwright test tests/e2e/daily/ tests/e2e/auth/login.spec.ts tests/e2e/partner/partner-connect.spec.ts --project=chromium` passed 13 tests, and the row audit found no leftover rows.
- `tests/e2e/daily/ --repeat-each=2` passed 8 tests.

**Residual risks:**
- A failed IndexedDB read during a merge drops the other saved days (rejected above).
- Pool pairs now keep one unpicked `couple_days` row per run date.
- The offline E2E reloads online with the read aborted and then goes offline, because dev mode has no service worker. A true offline reload is not exercised.
- A view left open past midnight while offline keeps yesterday's card, with the offline error under it.
