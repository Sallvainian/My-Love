---
title: 'Settings state splits into dates, profile and notifications slices'
type: 'refactor'
ticket: '3'
created: '2026-11-02'
status: done
baseline_revision: 'e5356642e91e21565f8dc1883dc40fbb56dfab37'
route: 'full'
route_source: 'auto'
risk: 'medium'
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

**Problem:** `settingsSlice.ts` (1138 lines) owns start-up, device settings and onboarding plus four unrelated account-data domains (anniversaries, couple settings, countdown marks, own profile, push preferences), each with its own local-copy kind (DW-399, R15). The display name is not in the store at all: Settings.tsx reads it with a component-local `lookupOwnDisplayName()`, so R4's later rows would have no one name store.

**Approach:** Move code, not behaviour: `datesSlice.ts` (anniversaries, couple settings, countdown marks), `profileSlice.ts` (own profile; the Settings name row now reads `ownProfile` through `loadOwnProfile`) and `notificationsSlice.ts` (push preferences, Date reminders included), each taking its kind constant, `readSaved*` reader, parser, fresh-for guard, copy saver and `registerLocalCopy` refresher. `settingsSlice.ts` keeps `initializeApp`, `settings`/`setSettings`/`updateSettings` and onboarding. Compose the three in the store, AppState and `signedOutState()`; update AGENTS.md's slice count.

## Boundaries & Constraints

**Always:** Keep every action's body, error text, `console.error` message (`[Settings] …` prefixes included), capture-and-recheck of `{ userId, authSessionVersion }` and `serializeAccountDataWrite` use exactly as today. Keep state field names and shapes, including the anniversaries mirror at `settings.relationship.anniversaries` (datesSlice actions write it through `set`), so store tests change only import paths. Keep the `[Settings]` testids and strings on the name row. Every new account-scoped field goes into `signedOutState()` in the same commit. `src/` imports use relative paths.

**Never:** No visible change beyond the name row now sharing the store. No change to `PUSH_PREFERENCE_KEYS` contents (story 4 removes `dates`), to which writes need a connection, to App's setup gate (`lookupOwnDisplayName` stays there), to `partialize`, or to persisted keys. Do not move events (they stay in `eventsSlice`). Do not reformat untouched code (no `prettier --write`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Name loaded | Settings mounts online; profile read answers a chosen name | Row shows `Loading...`, then the name; Change enabled, prefilled with it | — |
| Name unset | read answers `displayName: null` | `Not set yet`; field prefill empty | — |
| Name read fails | `fetchOwnProfile` throws, or device offline | `Couldn't load your name`; Change enabled, prefill empty | `ownProfileLoadFailed` true; `ownProfile`/copy untouched |
| Name saved | DisplayNameSetup completes | Change disabled and row `Loading...` across one `loadOwnProfile` re-read; row then shows what the server answered; store `ownProfile.displayName` is the new name (Home reads it) | re-read failure → `Couldn't load your name`, prefill empty |
| Sign-out | any moved field set | every moved field and `ownProfileLoadFailed` reset | — |

</intent-contract>

## Code Map

- `src/stores/slices/settingsSlice.ts` -- source of the split. Lines 17-74 header doc (split per domain); 107-211 `SettingsSlice` interface; 213-378 kinds/parsers/readers/fresh-for guards; 380-424 anniversary helpers (`AnniversaryInputSchema`, `toMirrored`, `mirrorAnniversaries`, `withAnniversaries`, `notSynced`); 430-503 registrations and copy savers; actions 689-1133. Keep: `initializeApp` (521-642), `setSettings`, `updateSettings`, `setOnboarded`, `isInitialized`/`isInitializing` export, `settings`/`isOnboarded` initial state.
- `src/stores/useAppStore.ts:130-150` -- compose new slices right after `createSettingsSlice`; nothing else there changes (persist/partialize keep reading `settings`).
- `src/stores/types.ts` -- import the three slice interfaces and extend `AppState`.
- `src/stores/slices/authSlice.ts:234-243` -- `signedOutState()` settings block: regroup comments by new slice; add `ownProfileLoadFailed: false`. `discardAccountState` (320+) comment about `settings.relationship.anniversaries` stays true.
- `src/components/Settings/Settings.tsx:38-40,51,559-631,872-897` -- drop `lookupOwnDisplayName`/`OwnDisplayNameLookup` state and effect; read `ownProfile`, `ownProfileLoadFailed`, `loadOwnProfile` from the store; a local `nameReading` flag (true on mount and on `onComplete` until `loadOwnProfile()` settles, with a cancelled guard) gives `Loading...` + disabled Change; `onComplete` calls `loadOwnProfile()` instead of the token bump + `refreshLocalCopy(PROFILE_COPY_KIND)`. Avatar initial reads the same name. `userEmail` stays local.
- `src/App.tsx:43` -- `PROFILE_COPY_KIND` import path only.
- `src/services/dateRemindersAtLaunch.ts:1-14` -- import paths only.
- Comment path fixes (`settingsSlice.x` → new slice): `src/services/{anniversariesService,countdownMarksService,coupleSettingsService,profileService,pushPreferencesService}.ts`, `src/components/Settings/{CountdownMarks,PushSettings}.tsx`, `src/types/index.ts:80`, `src/stores/slices/partnerSlice.ts:13`.
- Tests, import paths only: `tests/unit/stores/{accountDataSlices.anniversaries,birthdaysWedding,countdownMarks,coupleSettings,dateRemindersAtLaunch,pushPreferencesCopy}.test.ts`, `src/components/Settings/__tests__/PushSettings.test.tsx`, `tests/support/harnesses/auth-bootstrap-notification-order.tsx`. `tests/unit/stores/settingsSlice.initializeApp.test.ts` composes `createSettingsSlice` alone; its `TestState` shrinks with the interface.
- `src/components/Settings/__tests__/Settings.displayName.test.tsx` -- stubs `lookupOwnDisplayName`; re-stub `profileService.fetchOwnProfile` (answering `OwnProfile`, rejecting for the failure case) and seed the store's `userId`, keeping every assertion; replace the `refreshLocalCopy('profile')` check with "store `ownProfile.displayName` is the saved name". See `Settings.birthdayWedding.test.tsx` for how Settings tests seed the store.
- `tests/unit/stores/signOutClearsAccountState.test.ts:98-102,518-553` -- `EXPECTED_RESET` pins `signedOutState()` keys; add `ownProfileLoadFailed`.
- `tests/e2e/auth/display-name-setup.spec.ts:318` and `tests/e2e/offline/needs-a-connection.spec.ts:272` -- intercept Settings' mount read with `OWN_PROFILE_READ` (`tests/support/helpers/reads.ts:75`) instead of `gateNameRead`, which Settings no longer requests; fix the comment there.
- `AGENTS.md` Where things are, first bullet -- "composes 11 slices" → 14.

## Tasks & Acceptance

**Execution:**
- [ ] `src/stores/slices/datesSlice.ts` (new) -- `DatesSlice`: `coupleSettings`, `countdownMarks`; anniversary, couple-settings and countdown-mark actions; `CoupleSettings` type; `ANNIVERSARIES_/COUPLE_SETTINGS_/COUNTDOWN_MARKS_COPY_KIND`; `readSavedAnniversaries/CoupleSettings/CountdownMarks`; its three `registerLocalCopy` calls; header doc moved from settingsSlice.
- [ ] `src/stores/slices/profileSlice.ts` (new) -- `ProfileSlice`: `ownProfile`, new `ownProfileLoadFailed` (true when the last `loadOwnProfile` could not get a server answer: offline or a failed read; false after a successful read or a confirmed `setBirthday`), `loadOwnProfile`, `setBirthday`; `PROFILE_COPY_KIND`, `readSavedOwnProfile`, registration; header doc says Settings' name row reads it.
- [ ] `src/stores/slices/notificationsSlice.ts` (new) -- `NotificationsSlice`: `pushPreferences`, `pushPreferencesLoadFailed`, `loadPushPreferences`, `setPushPreference`; `PUSH_PREFERENCES_COPY_KIND`, `PUSH_PREFERENCE_KEYS` (unchanged), `readSavedPushPreferences`, the `hasNativeReminders` registration.
- [ ] `src/stores/slices/settingsSlice.ts` -- remove what moved; header says start-up, device settings, onboarding.
- [ ] `src/stores/useAppStore.ts`, `src/stores/types.ts`, `src/stores/slices/authSlice.ts` -- compose, type, reset (as Code Map).
- [ ] `src/components/Settings/Settings.tsx` -- name row from the store (as Code Map and I/O matrix).
- [ ] Import-path and comment updates listed in the Code Map; `AGENTS.md` count.
- [ ] Tests -- the import-path updates; `Settings.displayName.test.tsx` re-stub plus one case "offline with a saved copy shows `Couldn't load your name`"; `signOutClearsAccountState` gains `ownProfileLoadFailed`; a profileSlice unit case in `tests/unit/stores/birthdaysWedding.test.ts` (where `loadOwnProfile` is tested) for the flag: set on a failed read and offline, cleared by a successful read; the two E2E intercepts.

**Acceptance Criteria:**
- Given the split, when `settingsSlice.ts` is read, then it holds only `initializeApp`, the device `settings` with `setSettings`/`updateSettings`, and onboarding, and no `registerLocalCopy` call.
- Given each moved kind, when a signed-in start runs `refreshLocalCopies()`, then `anniversaries`, `couple-settings`, `countdown-marks`, `profile` and `push-preferences` each still have a registered refresher that shows the saved copy and then the server's answer.
- Given a signed-in account with every moved field set, when it signs out, then each moved field and `ownProfileLoadFailed` hold their signed-out values.
- Given Settings open online, when the name is changed through the form, then the Settings row and the store's `ownProfile.displayName` (what Home reads) both show the new name without a reload.

## Implementation Notes

- Implemented by a Sonnet subagent from this plan. The three slices are line-for-line moves of the old code (checked by comparing sorted line sets); the only behaviour change is `ownProfileLoadFailed` in `profileSlice` and the name row in `Settings.tsx`.
- Not in the Code Map: `Settings.kit.test.tsx` and `Settings.mobileDataPhotos.test.tsx` also stubbed `lookupOwnDisplayName` and were re-stubbed onto `profileService.fetchOwnProfile`; their two offline cases now wait for `Couldn't load your name`, which is what an offline Settings showed before the change too (the lookup failed offline).
- Ledger: new DW-426 (the anniversaries mirror still inside `settings`); DW-399 closed with a resolution line.
- Local E2E used the same scratch `supabase` shim as story 1 (CLI 3.0.0 rejects `[inbucket]`); `tests/e2e/auth/token-persistence-overlap.spec.ts` was left out of the run because it reads `node_modules/@playwright/test/package.json` from the worktree root, which a loop worktree does not have. Nothing in the repo changed for either.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 4, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` DW-399 left `status: open` though this change resolves it — closed: `status: done 2026-11-03` plus a `resolution:` line naming story 5.3 and DW-426.
  - `[low]` `[patch]` The two E2E comments implied the `OWN_PROFILE_READ` intercept sees only Settings' mount read; the signed-in start's `profile` refresher requests the same URL — comments reworded to say that read may answer first.
  - `[low]` `[patch]` `let accountCounter` sat between two imports in `Settings.mobileDataPhotos.test.tsx` — moved below the last import.
  - `[low]` `[patch]` Dead `lookupOwnDisplayName` mocks in `Settings.birthdayWedding.test.tsx` and `Settings.togetherSince.test.tsx` — deleted (hoisted fn, factory entry, `beforeEach` stub).
  - `[false]` `[reject]` Name row could stay `Loading...` forever if `loadOwnProfile` rejected — it cannot reject: `readLocalCopy` catches and returns `null` (`src/services/localCopy.ts:89-98`), the server read is inside `try/catch`, and the rest is synchronous `set`.

### 2026-11-03 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `Settings.kit.test.tsx`'s "Loading... while the first read is in flight" case left `fetchOwnProfile` on a never-settling `mockReturnValue` promise; the read now runs inside `serializeAccountDataWrite`, whose module-level `tail` would hold every later case's `loadOwnProfile` if the stray call got past `readLocalCopy` before the next `beforeEach` changed `userId` — a timing-dependent stall. Fixed: `mockReturnValueOnce` with a promise the case releases, then waits for the row to settle.
  - `[low]` `[patch]` `Settings.tsx` name-read effect comment said "the slice logs the failure"; offline `loadOwnProfile` sets `ownProfileLoadFailed` and returns without logging (`profileSlice.ts` step 2). Fixed: comment says only a failed server read is logged.
  - `[low]` `[reject]` The name row's read now waits behind other queued account-data tasks (launch refreshes, an anniversary or favorite write), where `lookupOwnDisplayName` read outside the queue — real, but each queued request is short in everyday use, so `Loading...` lasts a fraction of a second longer only when Settings opens during one; the fix would need a separate unqueued read path, against the plan's design of reading through `loadOwnProfile` (queued so a read cannot land after a birthday write).

## Design Notes

The anniversaries mirror stays inside the persisted `settings.relationship.anniversaries`, now written by `datesSlice` actions: moving it to its own field would change `partialize`, the `getItem` blanking, `discardAccountState` and every test that reads the mirror, which the ticket's "only import paths changed" rules out. The kind, reader, refresher and actions move, which is what DW-399 asks. Record this residue as a new deferred-work ledger entry.

The name row keeps today's three labels by holding only a local "a read is in flight" flag; the value and failure come from the store. `ownProfileLoadFailed` differs from `pushPreferencesLoadFailed` (set only when nothing is shown) on purpose: after a name save whose re-read fails, the store still holds the pre-save name, and prefilling the form from it would write the old name back (the hazard `Settings.displayName.test.tsx` pins).

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (worktree TS2883 baseline errors excepted if present before the change)
- `npm run lint` -- expected: exit 0
- `npm run test:unit` -- expected: all green
- `npx playwright test tests/e2e/settings tests/e2e/offline tests/e2e/auth tests/e2e/home` -- expected: pass (needs `supabase start`)

**Manual checks (if no CLI):**
- `grep -n "registerLocalCopy" src/stores/slices/settingsSlice.ts` -- expected: no match.


## Auto Run Result

Status: built

**Summary.** `settingsSlice.ts` (1138 lines) is split by domain (DW-399, R15). `datesSlice` takes anniversaries, couple settings and countdown marks; `profileSlice` the own profile; `notificationsSlice` the push preferences with Date reminders — each with its copy kind, reader, parser, fresh-for guard, copy saver and refresher, code moved unchanged. `settingsSlice` keeps `initializeApp`, the device `settings` and onboarding, with no `registerLocalCopy`. Settings' name row now reads the store's `ownProfile` (R4's one name store): a local in-flight flag keeps `Loading...` and the disabled Change, and a new `ownProfileLoadFailed` keeps `Couldn't load your name` with an empty prefill. A name save re-reads through `loadOwnProfile`, which also updates what Home reads. `signedOutState()` covers every moved field plus the new flag; AGENTS.md says 14 slices. This repair session (after verify found no `ci-status.json`) re-verified the committed work, ran a second quick review pass, patched two low findings and ran the On Complete hook.

**Files changed**
- `src/stores/slices/datesSlice.ts`, `profileSlice.ts`, `notificationsSlice.ts` — new slices (moved code; `ownProfileLoadFailed` new).
- `src/stores/slices/settingsSlice.ts` — start-up, device settings, onboarding only.
- `src/stores/useAppStore.ts`, `src/stores/types.ts` — compose and type the three slices.
- `src/stores/slices/authSlice.ts` — `signedOutState()` regrouped, `ownProfileLoadFailed: false` added.
- `src/components/Settings/Settings.tsx` — name row from the store instead of `lookupOwnDisplayName`; effect comment corrected in the second pass.
- `src/App.tsx`, `src/services/dateRemindersAtLaunch.ts` — import paths.
- `src/services/{anniversaries,countdownMarks,coupleSettings,profile,pushPreferences}Service.ts`, `src/components/Settings/{CountdownMarks,PushSettings}.tsx`, `src/types/index.ts`, `src/stores/slices/partnerSlice.ts` — comment paths.
- `AGENTS.md` — slice count 11 → 14.
- `_bmad-output/initiative-my-love/deferred-work.md` — DW-399 closed; DW-426 added.
- Tests: import paths in six store tests, `PushSettings.test.tsx` and the auth harness; `Settings.displayName.test.tsx`, `Settings.kit.test.tsx`, `Settings.mobileDataPhotos.test.tsx` re-stubbed onto `fetchOwnProfile`; dead mocks removed from `Settings.birthdayWedding/togetherSince.test.tsx`; `birthdaysWedding.test.ts` gains the flag cases; `signOutClearsAccountState.test.ts` pins the flag; two E2E specs intercept `OWN_PROFILE_READ`. Second pass: the kit test's in-flight case releases its pending read.

**Review findings.** Pass 1 (quick): 5 findings — 4 low patched, 1 false rejected (`loadOwnProfile` cannot reject). Pass 2 (quick): 3 findings — 2 low patched (kit test pending read held the shared account-data queue; offline-logging comment), 1 low rejected (the name read now queues behind other account-data tasks: negligible in use, and avoiding it needs an unqueued read path against the plan's design). Nothing deferred.

**Follow-up review recommended: false.** Patched counts this pass: high 0, medium 0, low 2.

**Verification.** After the second-pass patches: `npm run typecheck` exit 0; `npm run lint` exit 0; `npm run test:unit` 227 files / 3945 tests passed; `SEED=7 npm run test:unit:coverage` exit 0; `npx playwright test` over every spec in `tests/e2e/settings`, `tests/e2e/offline`, `tests/e2e/auth` and `tests/e2e/home` except `tests/e2e/auth/token-persistence-overlap.spec.ts` (fails to load in a loop worktree, see Implementation Notes) — 163 passed, on local Supabase through a scratch CLI shim (CLI 3.0.0 rejects `[inbucket]`). `grep registerLocalCopy src/stores/slices/settingsSlice.ts` finds nothing. Every I/O-matrix row is covered by a passing case in `Settings.displayName.test.tsx`, `birthdaysWedding.test.ts` or `signOutClearsAccountState.test.ts`.

**Residual risks**
- Opening Settings now makes one queued profile read (`display_name,birthday`) instead of the gate-style `display_name` read outside the queue; `Loading...` can last slightly longer if Settings opens while launch refreshes or an account-data write are running.
- `tests/e2e/auth/token-persistence-overlap.spec.ts` was not run here; it does not touch Settings.
- The refreshers register in a new order (dates, profile, notifications); `refreshLocalCopies` runs them in parallel, so order should not matter.

**Verify gate (`bash .bmad-loop/ci-status.sh`).** It cannot pass in this run as configured: `_bmad/custom/issue-tracking.yaml` has `enabled: false` ("off until loop run 20261102-215408-6a69 ends"), so the build-auto On Complete hook stops at `common/check-config` before `common/write-ci-status`, and no `ci-status.json` is written — the same for every ticket. Nothing was pushed and no CI ran. Left for the owner: drop the `[verify]` command from `.bmad-loop/policy.toml` for this run, or enable issue tracking; `ci-status.json` was not hand-written.
