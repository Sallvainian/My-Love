---
title: 'Log out replaces Sign out everywhere'
type: 'feature'
ticket: '5'
created: '2026-11-03'
status: done
baseline_revision: '8aa6b69370066e05817270824d8ebc7a353a1e3e'
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

**Problem:** Settings' two session rows, their in-progress labels, the "every device" confirmation dialog, the offline refusal, the failure message and the login screen's partial notice still say "Sign out" (all in `src/components/Settings/Settings.tsx:456,503,521,636,656,668,745,766`), while EXPERIENCE.md's Voice and Tone says "Log out" everywhere in the UI (R13). The behaviour the Danger action row asks for already exists from story 1: Log out acts at once, Log out of all devices refuses offline before any dialog and otherwise confirms, and both rows are disabled while either runs.

**Approach:** Replace each of those strings with Voice and Tone's verbatim "Log out" table, leaving "Sign in" untouched, the testids (`settings-sign-out*`, `login-sign-out-notice`) and identifiers as they are, and behaviour unchanged. Update every test and tool that reads the old text: `Settings.kit.test.tsx` (strings only, every assertion kept), `tests/e2e/settings/settings-kit.spec.ts:93`, and the sim driver's `signOut()` button lookup in `scripts/sim-driver/RunnerUITests/Drive.swift:169-179` plus its `sim` help line 90. Add one E2E case to `tests/e2e/auth/logout.spec.ts` proving R13's row behaviour at the outermost surface: offline, Log out of all devices shows `You are offline. Logging out of all devices needs a connection to go through.`, opens no dialog and sends no Supabase request; back online, it opens the dialog reading `Log out on every device? You'll need to sign in again on each one.` with `Cancel` and `Log out everywhere`, and Cancel leaves the person signed in (model: `tests/e2e/offline/needs-a-connection.spec.ts` — `goOffline` from `tests/support/helpers/offline`, a `page.on('request')` watch on the Supabase API paths, `setOffline(false)` in `finally`; put the case in its own `test.describe` with `test.use({ trace: 'off', video: 'off' })`, since tracing corrupts when the context goes offline, per that spec's line 63).

**Strings (verbatim):** rows `Log out` · `Log out of all devices`; running `Logging out…` · `Logging out of all devices…`; dialog `Log out on every device? You'll need to sign in again on each one.` · `Cancel` · `Log out everywhere`; offline `offlineMessage('Logging out of all devices', 'go through', 'needs')`; failure `Failed to log out. Please try again.`; partial notice `You're logged out on this device, but your other devices could not be logged out. Sign in again when you're online and try Log out of all devices once more.`

**Acceptance:** Given the built UI, when every rendered string is searched, then none reads "Sign out"/"Signing out"/"signed out" and the login button still reads `Sign in`. Given Settings offline, when Log out of all devices is tapped, then the refusal shows and no dialog opens; online, the dialog asks before anything is logged out.

</intent-contract>

## Implementation Notes

Oneshot: about 90 lines across Settings.tsx, two test files, one new E2E case and the sim driver, all mechanical text changes plus one test modelled on existing ones. Comments next to the changed strings are reworded to match; comments elsewhere that say "sign out" about the auth action are left alone.

- Settings.tsx: the eight UI strings swapped to Voice and Tone's table; testids, identifiers and behaviour unchanged. Comments naming the row as `"Sign out of all devices"` in `LoginScreen.tsx`, `api/auth/types.ts` and `services/pushNotifications.ts` now name it `"Log out of all devices"`; log and console text about the auth action is unchanged.
- Deviation: the new E2E case lives in its own file, `tests/e2e/auth/logout-everywhere.spec.ts`, not in `logout.spec.ts`: Playwright refuses `test.use({ trace })` inside a describe ("forces a new worker"), and turning tracing off for the whole of `logout.spec.ts` would drop the P0 cases' traces. `logout.spec.ts`'s first case also checks the row reads `Log out` and the login button still reads `Sign in`.
- Sim driver: `Drive.swift`'s `signOut()` now taps the `Log out` button; the `sim signout` command keeps its name (a CLI verb, not UI). Not run on a simulator here.
- Local E2E used a scratch `supabase` shim (`--workdir` with `[inbucket]` renamed `[local_smtp]`), as stories 1 and 3 did; nothing in the repo changed for it.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `logout-everywhere.spec.ts` watched only `/auth/v1/logout`, so an offline tap that sent any other Supabase request (the push-device RPC, the token read) would still pass — patched: while offline the spec now records every request under `/rest/v1`, `/storage/v1`, `/auth/v1` and `/functions/v1`, armed after `goOffline` and before the tap, and asserts none.
  - `[low]` `[patch]` The new spec never kept the welcome splash away, so a worker whose storage-state stamp is over an hour old renders only the splash and `navigateTo(page, 'settings')` times out (`welcome-splash.ts` header, `App.tsx` splash branch) — patched: `beforeEach` calls `dismissWelcomeSplash(page)`, as `needs-a-connection.spec.ts` does. `logout.spec.ts` has the same gap from before this change; left as it is.
  - `[low]` `[patch]` After Cancel the checks were already true at once, so a Cancel that started a log-out would send its request after `expect(logoutRequests).toEqual([])` ran — patched: after Cancel the spec asserts the row is enabled and still reads `Log out of all devices`; `handleLogout` disables and relabels it synchronously before any await, so a started log-out fails the check.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0
- `npx vitest run src/components/Settings src/components/LoginScreen` -- expected: all green
- `npm run test:unit` -- expected: all green
- `npx playwright test tests/e2e/auth/logout.spec.ts tests/e2e/auth/logout-everywhere.spec.ts tests/e2e/settings tests/e2e/navigation/dock.spec.ts tests/e2e/account-data` -- expected: pass (needs `supabase start`)
- `grep -rnE "['\">\`]\s*Sign(ing)? out|signed out on this device|sign out\. Please" src --include=*.tsx --include=*.ts | grep -v __tests__` -- expected: no match

## Auto Run Result

Status: built

**Summary.** Every UI string in EXPERIENCE.md's Voice and Tone "Log out" table now reads Log out: both rows, their in-progress labels, the Confirmation dialog's question and button, the offline refusal (`offlineMessage('Logging out of all devices', 'go through', 'needs')`), the failure message and the login screen's partial notice (owned by `Settings.tsx`). `Sign in` is unchanged. The rows' behaviour (Log out at once; Log out of all devices refusing offline before any dialog, otherwise confirming; both disabled while either runs) was already in place from story 5.1 and is now proven end to end by a new E2E spec. Test ids and identifiers keep their `sign-out` names.

**Files changed**
- `src/components/Settings/Settings.tsx` — the eight strings and the comments beside them.
- `src/components/LoginScreen/LoginScreen.tsx`, `src/api/auth/types.ts`, `src/services/pushNotifications.ts` — comments naming the row.
- `src/components/Settings/__tests__/Settings.kit.test.tsx` — expected strings and test titles; every assertion kept.
- `tests/e2e/settings/settings-kit.spec.ts` — the quiet row's text check and titles.
- `tests/e2e/auth/logout.spec.ts` — the first P0 case also checks the row reads `Log out` and the login button `Sign in`.
- `tests/e2e/auth/logout-everywhere.spec.ts` (new) — offline refusal with no dialog and no Supabase request; online dialog text and buttons; Cancel logs out nothing.
- `scripts/sim-driver/RunnerUITests/Drive.swift`, `scripts/sim-driver/sim` — `sim signout` taps the `Log out` button.

**Review findings.** One quick pass: 3 low findings, all patched in the new E2E spec (request watch widened to every Supabase API path while offline; welcome-splash guard; synchronous row check after Cancel). Nothing deferred, nothing rejected.

**Follow-up review recommended: false.** Patched counts: high 0, medium 0, low 3.

**Verification.** After the patches: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm run test:unit` 227 files / 3948 tests passed; `npx playwright test tests/e2e/auth/logout.spec.ts tests/e2e/auth/logout-everywhere.spec.ts tests/e2e/settings tests/e2e/navigation/dock.spec.ts tests/e2e/account-data` 82 passed, and the new spec passed 3 of 3 with `--repeat-each=3`, on the local stack through a scratch `supabase` CLI shim (CLI 3.0.0 rejects `[inbucket]`). The Verification grep for rendered "Sign out" strings in `src` (excluding tests) finds nothing.

**Residual risks**
- The sim driver's `Drive.swift` change was not run on a simulator; it matches the button's exact `Log out` label, which `Log out of all devices` does not equal.
- `tests/e2e/auth/logout.spec.ts` still has no welcome-splash guard, as before this change.
