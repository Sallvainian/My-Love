---
title: 'DW-352: sign-out removes the app''s delivered notifications'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'c1f7f70af0b573e434a8ad064c6e27ed17e142c9'
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
deferred:
  - summary: >-
      DW-352's native removal is unverified on a shell: no simulator check yet shows sign-out emptying Notification Center of delivered pushes and date reminders.
    evidence: |-
      The intent names a simulator check of the shell as a follow-up outside the loop. Unit tests mock the plugin, so they cannot show that `Capacitor.isPluginAvailable('LocalNotifications')` is true in the installed shell or that the plugin's iOS method (`UNUserNotificationCenter.removeAllDeliveredNotifications()`, LocalNotificationsPlugin.swift:879-888) removes delivered APNs pushes there. Settle it with `scripts/sim-driver/sim`: push a love note and let a date reminder fire, sign out, then `sim center` shows no group for the app.
    location: >-
      src/services/pushNotifications.ts (stopDevicePushes)
    severity: low
  - summary: >-
      An account switch without a sign-out (in place, or a fresh sign-in whose owner marker names another account) leaves the outgoing account's delivered notifications in Notification Center.
    evidence: |-
      `discardAccountState` calls `stopPushesForSignOut()` only when `identity.userId === null` (src/stores/slices/authSlice.ts:336), and the fresh-sign-in leftover path calls `deleteAccountData(leftover)` alone (authSlice.ts:457-459). `deleteAccountData` cancels pending date reminders but does not remove delivered ones, so delivered pushes and reminders stay for the incoming account on those paths. This predates DW-352, and the owner's decision covers sign-out only. Reachability is unverified: a device normally goes through signed out, which now runs the removal. The fix would be a removal call on those paths (not the APNs unregister, which would race `startPushRegistration`), plus a decision that a switch should empty Notification Center too.
    location: >-
      src/stores/slices/authSlice.ts:331-336, 456-459
    severity: low
  - summary: >-
      PartnerMoodView.kit.test.tsx "enables refresh when online" failed once under the full unit suite with the refresh button still `aria-busy` and disabled, and passed on 3 isolated reruns and 2 later full runs.
    evidence: |-
      First `npm run test:unit` of this run: 1 failed of 3759, `expect(element).toBeEnabled()` at src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx:166, with the button rendered `aria-busy="true" disabled`. `findByTestId` resolves on presence, not enablement, so an in-flight refresh still busy under load fails it. Unrelated to this change, which touches no PartnerMoodView code. Settle by asserting through `waitFor(() => expect(...).toBeEnabled())` after confirming what keeps it busy.
    location: >-
      src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx:166
    severity: low
---

<intent-contract>

## Intent

**Problem:** Sign-out unregisters from APNs, clears the badge and forgets the token, but every delivered love-note push and date reminder stays in Notification Center with its sender's name and text, so the next person on a shared device can read the previous account's notifications (DW-352).

**Approach:** Per the owner's 2026-11-02 clear-whole-group decision, `stopDevicePushes` in `src/services/pushNotifications.ts` also calls `LocalNotifications.removeAllDeliveredNotifications()` from `@capacitor/local-notifications` (native `UNUserNotificationCenter.removeAllDeliveredNotifications()`, which empties the app's whole group, pushes included, and needs no `register()` this launch). The call sits behind its own `Capacitor.isPluginAvailable('LocalNotifications')` check inside the existing `isNativePlatform()` gate, so the web and an older shell skip it; a failure is logged and never throws, and the badge clear and token forget still run. Web-only, no new Swift. Unit-test that it runs on sign-out and is skipped without the plugin (and in a browser). A simulator check of the shell is a follow-up outside the loop.

</intent-contract>

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/pushNotifications.ts` -- in `stopDevicePushes`, add the gated, try/catch-wrapped `LocalNotifications.removeAllDeliveredNotifications()` call (not a `dateReminders.ts` helper: that module imports this one); replace the "Not removeAllDeliveredNotifications()" comment and the "Delivered notifications stay in Notification Center" doc lines for `stopDevicePushes` and the module header's story 3.2 paragraph so they say sign-out now empties the app's delivered notifications (DW-352) -- the fix.
- [ ] `src/services/__tests__/pushNotifications.test.ts` -- mock `@capacitor/local-notifications`; in `describe('stopDevicePushes')` assert the call on sign-out, no call when `LocalNotifications` is unavailable (badge clear still runs), no call in a browser, and a rejecting call is logged while badge clear and token forget still happen and nothing throws; keep every existing assertion -- proves the gate.

**Acceptance Criteria:**
- Given the native shell with the local-notifications plugin, when `stopDevicePushes()` runs, then `removeAllDeliveredNotifications` is called once and the APNs unregister, badge clear and token forget still happen.
- Given a shell without the `LocalNotifications` plugin, or a browser, when `stopDevicePushes()` runs, then `removeAllDeliveredNotifications` is not called and nothing throws.
- Given the plugin call rejects, when `stopDevicePushes()` runs, then it resolves, logs the failure once, and still clears the badge and forgets the token.

## Implementation Notes

Oneshot: one function and its tests, well under 100 lines.

- `src/services/pushNotifications.ts`: imports `LocalNotifications` and, in `stopDevicePushes` after the APNs unregister and before the badge clear, calls `removeAllDeliveredNotifications()` behind `Capacitor.isPluginAvailable('LocalNotifications')` in its own try/catch. Gated inline, not through `dateReminders.hasDateReminders()`, because `dateReminders.ts` imports this module. Doc comments updated; the header says a shell from before story 4.1 (`0c15b9a6`, which added the plugin) has no `LocalNotifications`.
- `src/services/__tests__/pushNotifications.test.ts`: mocks `@capacitor/local-notifications`. Without the mock the real package would call the mocked `registerPlugin`, get the environment stub and log a TypeError. Adds the no-plugin and rejecting-call cases, plus the call and no-call assertions on the existing cases. Both new positive tests fail against the baseline code (checked by reverting the fix).
- Review patch: corrected the now-false comment in `ios/App/App/AppBadge.swift` (a comment only, no Swift code) and the `stopPushesForSignOut` doc in `src/stores/slices/authSlice.ts`.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `ios/App/App/AppBadge.swift:7-10` still says sign-out leaves Notification Center as it is, and the `stopPushesForSignOut` doc in `src/stores/slices/authSlice.ts:84-86` omits the removal. Fixed both comments; no code change.
  - `[low]` `[defer]` The simulator check of the shell, named in the intent as a follow-up outside the loop, has no ledger entry. Real; the ledger is the orchestrator's, so it is recorded in `deferred` for the orchestrator to carry.
  - `[low]` `[defer]` An account switch without a sign-out (authSlice.ts:336, 457-459) leaves delivered notifications. Confirmed in the code. This predates the change, the owner's decision names sign-out only, and reachability is unverified, so it is recorded in `deferred`.

## Verification

**Commands:**
- `npx vitest run src/services/__tests__/pushNotifications.test.ts tests/unit/stores/signOutStopsDevicePushes.test.ts src/api/auth/__tests__/authServices.test.ts src/services/__tests__/loveNotesReadService.test.ts` -- expected: all pass
- `npm run test:unit` -- expected: all pass
- `npm run typecheck` and `npm run lint` -- expected: no new errors (worktree TS2883 baseline aside)

## Auto Run Result

Status: built

**Summary:** Sign-out now empties the app's Notification Center group (DW-352). `stopDevicePushes` calls `@capacitor/local-notifications`' `removeAllDeliveredNotifications()` behind its own `isPluginAvailable('LocalNotifications')` check inside the native-platform gate, so the web and an older shell skip it. A failure is logged, and the badge clear and token forget still run.

**Files changed:**
- `src/services/pushNotifications.ts`: the gated removal in `stopDevicePushes`, with updated doc comments.
- `src/services/__tests__/pushNotifications.test.ts`: the local-notifications mock and tests for: called on sign-out, skipped without the plugin, skipped in a browser, a rejection logged without blocking the rest.
- `src/stores/slices/authSlice.ts`: `stopPushesForSignOut` doc names the removal.
- `ios/App/App/AppBadge.swift`: corrected a doc comment that said Notification Center is left alone. A comment only; no reinstall needed.
- `_bmad-output/initiative-my-love/plan-dw-sign-out-clears-notifications.md`: this plan.

**Review:** quick lens, 3 findings, all low. 1 patched (two stale comments). 2 deferred: the simulator check of the shell, and the leak on an account switch without a sign-out. None rejected. A test flake seen during verification is deferred too (PartnerMoodView.kit refresh button). Patched counts: high 0, medium 0, low 1. Follow-up review recommended: false.

**Verification:** targeted vitest (4 files, 117 tests) passed; both new positive tests fail on the baseline code. `npm run test:unit`: the first run had 1 unrelated failure (the PartnerMoodView.kit flake, deferred); the two runs after it passed (224 files, 3759 tests), the second after the review patch. `npm run typecheck` exit 0. `npm run lint` exit 0.

**Residual risks:** the native behaviour is unverified on a shell until the simulator follow-up runs. On iOS the plugin method also zeroes the badge, which overlaps the `AppBadge.clear()` that follows and is harmless.
