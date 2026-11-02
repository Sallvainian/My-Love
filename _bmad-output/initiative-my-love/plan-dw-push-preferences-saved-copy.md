---
title: 'Push switches show the saved push-preferences copy offline and after a failed read'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: '263a126d1c044b5fab1b18be7fe529d233459957'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `settingsSlice.loadPushPreferences` never reads the saved `push-preferences` local copy: offline it returns early, so Settings' seven push switches (PushSettings' six rows, CountdownMarks' "Date reminders") render the `?? true` default disabled although the copy may say off (DW-381); a failed read sets `pushPreferences: null` + `pushPreferencesLoadFailed: true`, so a failed background refresh disables an open section although the copy is fine (DW-393). PushSettings.test.tsx:357 asserts only `expect(console.error).toHaveBeenCalled()`, which has passed vacuously on unrelated errors (DW-394).

**Approach:** Seed the store from the saved copy before the online read (online and offline, only while `pushPreferences` is `null`), as `loadCountdownMarks` does; on a failed read keep whatever is shown and flag the failure only when nothing is shown. Replace the bare console.error assertion with the expected message.

## Boundaries & Constraints

**Always:** Re-check `isCurrent()` (userId + authSessionVersion) after the copy read and before every `set`. Seed only while `get().pushPreferences === null` both before and after the read (a server answer or confirmed write is newer). The copy is still written only from a successful read or confirmed write. Match surrounding style by hand (no Prettier runs).

**Never:** No change to `setPushPreference`, the refresher registration, `readSavedPushPreferences`/`parseSavedPushPreferences`, the components' JSX/`?? true` fallbacks (seeded state makes them show the copy), `dateRemindersAtLaunch`, or the deferred-work ledger. No new IndexedDB store or helper module.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline, copy saved | `pushPreferences` null, copy `{…dateReminders:false}` | state = copy, `LoadFailed` false, no fetch; rows show copy, enabled | — |
| Offline, no copy | null, no copy | state null, `LoadFailed` false, no fetch; offline line, rows disabled | — |
| Failed read, copy saved | null, copy saved, fetch rejects | state = copy, `LoadFailed` false; no load-error line, rows enabled | logged `[Settings] Failed to load the push settings:` |
| Failed read, no copy | null, no copy, fetch rejects | state null, `LoadFailed` true; load-error line, rows disabled | logged |
| Failed reload after success | state = server row | state kept, `LoadFailed` false | logged |
| Success | any | state + copy = server row, `LoadFailed` false | — |
| Sign-out during copy read | identity changes | nothing set | — |

</intent-contract>

## Code Map

- `src/stores/slices/settingsSlice.ts:1010-1032` -- `loadPushPreferences`; model the seed on `loadCountdownMarks` (~1052-1084) steps 1-3. `readSavedPushPreferences(userId)` (:368) already parses the copy. Update the doc comments that describe the old behaviour: header block :50-60, `pushPreferences`/`pushPreferencesLoadFailed` fields :120-126, `loadPushPreferences` action doc :180-184, and the catch comment ("a failed load clears them").
- `src/components/Settings/PushSettings.tsx:~172` -- only the comment "until it is loaded they show the default" needs to say the saved copy or the server answer enables them. No logic change.
- `src/services/localCopy.ts` -- `deleteAccountCopies(userId)` and `writeLocalCopy` for test setup; `clearAuth` deletes copies fire-and-forget, so tests must clear copies themselves after `setAuthUser`.
- `tests/unit/stores/pushPreferences.test.ts` -- store tests; successful loads write A's copy into the global fake-indexeddb, so add `await deleteAccountCopies(A)` and `(B)` in `beforeEach` after `setAuthUser(A)`. The test "a failed reload after a successful load clears the switches" encodes the old behaviour: rewrite it to expect state kept and `LoadFailed` false.
- `tests/unit/stores/pushPreferencesCopy.test.ts` -- has `clearCopies`, `writeLocalCopy`, `REMINDERS_OFF`; "keeps the copy when a later read fails" expects `LoadFailed` true with a copy present: change to false and assert the state shows the copy. New seeding tests go here.
- `src/components/Settings/__tests__/PushSettings.test.tsx` -- real store; add `await deleteAccountCopies('user-a')` in `beforeEach` after `setAuthUser`. Rewrite "disables the rows that had loaded when a reload fails" (now: rows stay enabled, no load-error line). Line 357: assert `console.error` was called with `'[Settings] Failed to load the push settings:'` and the rejected error. `settings-reminders-switch` is the date-reminders switch (rendered by `CountdownMarks` inside the section).

## Tasks & Acceptance

**Execution:**
- [ ] `src/stores/slices/settingsSlice.ts` -- in `loadPushPreferences`: (1) when `pushPreferences` is null, `readSavedPushPreferences(requestedBy)`, return if `!isCurrent()`, then if a copy exists and state is still null `set({ pushPreferences: saved, pushPreferencesLoadFailed: false })`; (2) offline return; (3) fetch unchanged; catch: log, then `if (isCurrent() && get().pushPreferences === null) set({ pushPreferencesLoadFailed: true })`. Update the doc comments listed in the Code Map -- DW-381, DW-393.
- [ ] `src/components/Settings/PushSettings.tsx` -- update the disabled-rows comment -- keep docs true.
- [ ] `tests/unit/stores/pushPreferencesCopy.test.ts` -- add: offline with copy seeds state (no fetch); offline without copy leaves null, not failed; failed read with copy shows copy, not failed; failed read without copy null + failed; a state already loaded (non-null) is not overwritten by the copy; fix the existing failed-read test -- I/O matrix coverage.
- [ ] `tests/unit/stores/pushPreferences.test.ts` -- clear copies in `beforeEach`; rewrite the failed-reload test to the new behaviour -- determinism + new rule.
- [ ] `src/components/Settings/__tests__/PushSettings.test.tsx` -- clear copies in `beforeEach`; rewrite the reload-fails test; add: offline with a saved copy (dateReminders and loveNotes off) shows those switches off and enabled with no offline line; failed read with a saved copy shows the copy with no load-error line; replace the bare console.error assertion -- DW-381/393 at the component surface, DW-394.

**Acceptance Criteria:**
- Given a saved copy with "Date reminders" and "Love notes" off and no connection, when Settings' push section opens, then both switches show off and are enabled, and no "need a connection to load" line shows.
- Given a saved copy and a failing server read, when the section opens or reloads on reconnect, then the switches show the copy, stay enabled, and no "Couldn't load your push settings." line shows.
- Given no saved copy and a failing server read, when the section opens, then the load-error line shows, every row is disabled, and the test asserts the logged `[Settings] Failed to load the push settings:` message.

## Implementation Notes

- Implemented by a Sonnet subagent: seed from `readSavedPushPreferences` before the online read; the catch flags `pushPreferencesLoadFailed` only when `pushPreferences` is still null. Doc comments updated in `settingsSlice.ts` and `PushSettings.tsx`.
- Tests clear copies with `deleteAccountCopies` (no new helper). Because the copy read now comes before the fetch, the "lands after sign-out" store tests wait for the fetch call before signing out, so they still test a late server answer.
- Parent session tightened two new component tests that waited on a bare `console.error` call to assert the expected message (same lesson as DW-394).

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 2, false 2, maybe-false 0
- findings:
  - `[low]` `[reject]` Opening the section offline flashes the offline line and default rows for one render before the async copy read seeds the store — real, but it lasts one IndexedDB read and the refresher usually seeds the store at signed-in start; removing it needs a new account-scoped "copy checked" field (plus `signedOutState()`), which is more than a direct correction, and the plan keeps the components' JSX unchanged.
  - `[false]` `[reject]` "a failed reload that lands after sign-out leaves the next account untouched" no longer exercises the `isCurrent()` guard — the guard is still covered by "drops a failure that lands after sign-out without flagging the next account" (B's state null), and the test's assertion still holds; no coverage is lost.
  - `[false]` `[reject]` Field comment "from `public.push_preferences` via its local copy" is inaccurate — it is the slice's established idiom: `ownProfile` and `countdownMarks` use the same phrase although they are also set directly from server answers and writes.
  - `[low]` `[patch]` `PushSettings.tsx:168` comment ~133 chars, past printWidth 100 — implementer wrapped it onto two lines (95/39 chars); verification re-run green.

## Verification

**Commands:**
- `npx vitest run tests/unit/stores/pushPreferences.test.ts tests/unit/stores/pushPreferencesCopy.test.ts src/components/Settings/__tests__/PushSettings.test.tsx src/components/Settings/__tests__/CountdownMarks.test.tsx tests/unit/stores/dateRemindersAtLaunch.test.ts tests/unit/stores/signOutClearsAccountState.test.ts` -- expected: all pass
- `npm run typecheck` -- expected: exit 0 (worktree-only TS2883 errors that also fail at the baseline are not caused by this change; compare against baseline if any appear)
- `npx eslint src/stores/slices/settingsSlice.ts src/components/Settings tests/unit/stores/pushPreferences.test.ts tests/unit/stores/pushPreferencesCopy.test.ts` -- expected: no errors
- `SEED=7 npm run test:unit:coverage` -- expected: whole unit suite passes shuffled

## Auto Run Result

Status: built

**Summary:** Settings' seven push switches (PushSettings' six rows and CountdownMarks' "Date reminders") now show the saved `push-preferences` local copy. `loadPushPreferences` seeds the store from the copy before the online read, online or offline, only while nothing is loaded. A failed read keeps whatever is shown, and only an empty section is flagged as failed (that flag disables its rows). PushSettings.test.tsx's bare `console.error` assertion now asserts the expected message. Resolves DW-381, DW-393, DW-394.

**Files changed:**
- `src/stores/slices/settingsSlice.ts`: copy seed and failed-read fallback in `loadPushPreferences`; doc comments updated.
- `src/components/Settings/PushSettings.tsx`: disabled-rows comment updated.
- `src/components/Settings/__tests__/PushSettings.test.tsx`: clears the copy per test; offline-with-copy and failed-read-with-copy tests (date-reminders switch included); reload-fails test rewritten; message assertions replace bare `console.error` checks.
- `tests/unit/stores/pushPreferencesCopy.test.ts`: seed/fallback matrix tests; failed-read test updated.
- `tests/unit/stores/pushPreferences.test.ts`: clears copies per test; failed-reload test updated to the new rule; late-answer tests wait for the fetch before signing out.

**Review:** quick lens, 4 findings. 1 patch applied (low: comment wrap). Nothing deferred. Rejected: the one-render offline-line flash (low; fix needs a new account-scoped flag), the redundant sign-out test (false; guard covered elsewhere), and the "via its local copy" wording (false; the slice's existing idiom).

**Follow-up review recommended:** false (patched: high 0, medium 0, low 1).

**Verification:**
- Targeted vitest (6 files): 202 passed.
- `npx eslint` on the touched files: clean.
- `npm run typecheck`: exit 0.
- `SEED=7 npm run test:unit:coverage`: 224 files, 3782 tests passed.
- I/O matrix audit: every row has a covering test, and each one ran and passed.

**Residual risks:** When the section opens offline before anything has seeded the store, the offline line and default rows can show for one render until the copy read lands.
