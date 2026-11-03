---
title: 'Refactor sweep (epic-settings-rework)'
type: 'refactor'
ticket: '16'
created: '2026-11-03'
status: done
baseline_revision: 'a4a33ceb02341362f6fda7a2a7455e2203776c67'
route: 'full'
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
      The AGENTS.md Settings subpage rule names `subpageAvailable(path)` for any parent page's row, but the helper is local to `Settings.tsx`, and it overclaims that the row and the page "cannot disagree" (ledger DW-438).
    evidence: |-
      `subpageAvailable` is a non-exported function in src/components/Settings/Settings.tsx; parent pages other than the top page live in their own files, so a row there cannot call it. A path missing from SUBPAGES counts as available. Today only top-page rows have pages with `available`. The fix edits AGENTS.md, which review routes to the orchestrator.
    location: >-
      AGENTS.md (Where things are, Settings subpage rule)
    severity: low
---

<intent-contract>

## Intent

**Problem:** The epic left code-only cleanups in the ledger: dead code (`DisplayNameSetup`'s Settings edit mode, DW-427; `reminderDateEntries`, DW-433), a subpage row gated separately from its page's `available` (DW-423), and no test that sign-out keeps the device's photo-download choice (DW-420).

**Approach:** Remove the dead code and its tests, derive the gated top-page rows from `SUBPAGES`, add the missing sign-out test, close the four ledger entries. Nothing a person sees changes.

## Boundaries & Constraints

**Always:** No visible or behavioural change. Keep accessible names and the dialog role (AGENTS.md, Maintained by hand). Wait for sign-out's fire-and-forget deletes before a test ends. Match surrounding style by hand; never run `prettier --write`. AGENTS.md edit in its own `docs` commit. Ledger: only `status:`/`resolution:` on the four entries.

**Never:** The other open entries. DW-426 (moves a persisted, account-scoped field: 15 test files, cross-account leak risk). DW-429 (drops the column that keeps `getPartner`'s URL distinct from `lookupPartnerId`'s, which `partner-connect.spec.ts`'s `PARTNER_LOOKUP` matches on). DW-430/431, DW-434, DW-435/436 change what a person sees. DW-419, DW-425, DW-432, DW-437 are hand checks, owner decisions or orchestrator-owned. No change to the signup gate's behaviour, to `planDateReminders` output, or to `src/types/database.types.ts`.

</intent-contract>

## Code Map

- `src/components/DisplayNameSetup/DisplayNameSetup.tsx` -- props `initialName`, `onCancel`, `mode`; the Escape `useEffect`; `isEdit` branches; the Cancel row; header comments about the Settings edit route. Only caller `src/App.tsx:720`, which passes `isOpen` and `onComplete` only.
- `src/services/profileService.ts:10-15,107-150` -- `saveDisplayName`, the twin of the gate's rules (3-30 length, not the email, not `SEED_FALLBACK_NAME`).
- `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx:~300-330`, `src/components/shared/__tests__/kitSurfaces.test.tsx:~395-410` -- the cases that render `mode="edit"` / `onCancel`.
- `src/services/dateReminders.ts:35,245-375` -- `reminderDateEntries` (no production caller), `ReminderDateItem.name` (read only by it), doc lines naming it.
- `src/services/__tests__/dateReminders.test.ts:668-840` -- `describe('reminderDateEntries')`; its last case, "uses the keys the planner reads", is the planner's only all-marks check.
- `src/components/Settings/Settings.tsx:163-302,445-456` -- `SUBPAGES` (`notifications` `available: hasNativePush`, `photos` `available: canTellMobileData`); the top page gates `NotificationsRow` and the Photos `SettingsRow` by calling those functions directly.
- `src/components/Settings/stack/SettingsStack.tsx:64,125` -- `available?: () => boolean`; the stack's own test `requestedPage.available?.() !== false`.
- `tests/unit/stores/signOutClearsAccountState.test.ts:259-1000` -- `describe('clearAuth on sign-out')`, `seedDevice`, `expectOnlyOutgoingDataDeleted`.
- `src/services/photoDownloadPreference.ts:16` -- `PHOTOS_OVER_MOBILE_DATA_KEY`.
- `AGENTS.md:28` -- Settings subpage rule.
- `_bmad-output/initiative-my-love/deferred-work.md` -- DW-420, DW-423, DW-427, DW-433.

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/DisplayNameSetup/DisplayNameSetup.tsx` -- drop `initialName`, `onCancel`, `mode`, the Escape effect, the `isEdit` copy and the Cancel row (setup copy and full-width Continue stay); fix comments that describe the Settings route; name `profileService.saveDisplayName` as the twin of its rules. -- DW-427, option "leave it with a comment".
- [ ] `DisplayNameSetup.test.tsx`, `kitSurfaces.test.tsx` -- delete the edit/cancel cases only. -- They test removed code.
- [ ] `src/services/dateReminders.ts` -- delete `reminderDateEntries` and `ReminderDateItem.name`; reword the doc lines naming them. -- DW-433.
- [ ] `src/services/__tests__/dateReminders.test.ts` -- delete `describe('reminderDateEntries')`, but keep "uses the keys the planner reads" as a `planDateReminders` case with its seven keys spelled out and the same expected texts. -- Keeps the planner's coverage.
- [ ] `src/components/Settings/Settings.tsx` -- add `subpageAvailable(path)` (`SUBPAGES.get(path)?.available?.() !== false`) and gate the Notifications and Photos rows with it. -- DW-423.
- [ ] `tests/unit/stores/signOutClearsAccountState.test.ts` -- a case: key `'true'`, `clearAuth()`, wait for the deletes, key still `'true'`; same for a no-session boot with the owner marker set. -- DW-420.
- [ ] `AGENTS.md` -- one clause in the subpage rule: gate a row whose page has `available` with `subpageAvailable(path)`. -- DW-423.
- [ ] `deferred-work.md` -- `status: done 2026-11-03` and a `resolution:` on DW-420, DW-423, DW-427, DW-433.

**Acceptance Criteria:**
- Given a new signup with no name, when the gate opens, then it shows "Welcome!" and a full-width Continue with no Cancel, and saving works as before.
- Given a device with no push plugin or no connection type, when Settings opens, then the Notifications or Photos row is absent exactly as before, and a pasted `/settings/photos` still falls back to the top page.
- Given a device whose photo choice is Any connection, when the account signs out (or boots with no session), then the choice reads Any connection afterwards.
- Given the four entries, when the ledger is read, then each is `done` with a resolution naming this story.

## Implementation Notes

- Implemented by a Sonnet subagent from this plan; diff read in full against the baseline.
- `kitSurfaces.test.tsx`: the edit-route case was the only kit check of the failure box (`bg-dtint`, `text-danger`, alert role, icon), so it became a signup-gate case that types `"ab "` and checks the same box, rather than being deleted. Its Cancel-class assertion went with the Cancel control.
- The deleted edit-mode `DisplayNameSetup` tests that also apply to the gate (dialog role and `aria-modal`, the email, `Unknown` and zero-row refusals) already have setup-mode twins in the same file, so nothing the gate does lost coverage.
- `dateReminders.test.ts`: "uses the keys the planner reads" became a `planDateReminders` case with the seven keys spelled out and the same expected texts.
- Sign-out tests wait on `expectOnlyOutgoingDataDeleted` before asserting, so the fire-and-forget deletes end inside the test; `afterEach` removes the photo key.
- Environment: OrbStack was stopped and was started for pgTAP and E2E; the CLI shim (`~/.local/bin/supabase`, 2.122.0) sat first on PATH. Typecheck showed no `TS2883` baseline errors this time.
- E2E: `tests/e2e/auth/token-persistence-overlap.spec.ts` cannot load in a worktree (it reads `node_modules/<pkg>/package.json` from the repo root, and the worktree has no `node_modules`), so the run passed every other `tests/e2e` spec explicitly. The change touches nothing that spec covers.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `src/services/dateReminders.ts` doc on `reminderDatesFrom` still says the Settings marks list uses it — confirmed: its only caller is `dateRemindersAtLaunch.ts:147`. Fixed: the sentence now reads "The re-plan builds its input here."
  - `[low]` `[defer]` The AGENTS.md clause tells any parent page's row to use `subpageAvailable(path)`, which is local to `Settings.tsx` — confirmed (non-exported; parent pages like `DatesPage.tsx` live in their own files); no such row exists today. The fix edits AGENTS.md, so it is deferred: frontmatter `deferred` and ledger DW-438.
  - `[low]` `[patch]` `subpageAvailable`'s doc says the row and page "cannot disagree", but a path missing from `SUBPAGES` counts as available — confirmed. Fixed the code comment: it now says the row reads the page's own `available` check from `SUBPAGES` and that a missing path counts as available. The same overclaim in AGENTS.md is carried by DW-438.

## Design Notes

E2E and pgTAP need the local stack. The Homebrew CLI on PATH (3.0.0) rejects `config.toml`; put a scratch dir first on PATH whose `supabase` runs `~/.local/bin/supabase` (2.122.0), as stories 5.4-5.15 did. Docker is OrbStack (`orb start`). Six-ish `TS2883` errors in `tests/support/merged-fixtures.ts` are the worktree baseline; any other typecheck error is real.

## Verification

**Commands:**
- `npm run typecheck` -- expected: only the worktree's `TS2883` baseline in `merged-fixtures.ts`.
- `npm run lint` -- expected: no errors.
- `npm run test:unit` -- expected: every file passes.
- `supabase test db` (2.122.0 shim) -- expected: every file passes.
- `npx playwright test --project=chromium` (stack running, shim on PATH) -- expected: pass, no leftover rows; any failure checked against the baseline revision before it is called pre-existing.
- `rg -n "reminderDateEntries|mode=\"edit\"|initialName" src tests` -- expected: no matches.

## Auto Run Result

Status: built

**Summary:** The epic's code-only deferrals are cleaned up with no visible change. `DisplayNameSetup` loses its dead Settings edit mode (DW-427). `reminderDateEntries` and `ReminderDateItem.name` are deleted (DW-433). The top page's Notifications and Photos rows read their page's `available` through `subpageAvailable(path)` (DW-423). Two tests pin that sign-out keeps the device's photo-download choice (DW-420). The four ledger entries are closed.

**Files changed:**
- `src/components/DisplayNameSetup/DisplayNameSetup.tsx`: removed `initialName`, `onCancel`, `mode`, the Escape handler, the edit copy and the Cancel row; the header names `profileService.saveDisplayName` as the twin of the gate's rules.
- `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx`: removed the edit-mode cases; the setup-mode twins remain.
- `src/components/shared/__tests__/kitSurfaces.test.tsx`: the kit failure-box check moved from the edit route to the signup gate.
- `src/services/dateReminders.ts`: deleted `reminderDateEntries` and `ReminderDateItem.name`; reworded the docs that named the marks list.
- `src/services/__tests__/dateReminders.test.ts`: deleted `describe('reminderDateEntries')`; the all-marks planner check is kept with explicit keys.
- `src/components/Settings/Settings.tsx`: added `subpageAvailable(path)`; the Notifications and Photos rows use it.
- `tests/unit/stores/signOutClearsAccountState.test.ts`: two cases, one for sign-out and one for a no-session boot, check that the photo-download key survives.
- `AGENTS.md`: one clause in the Settings subpage rule (separate `docs` commit).
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-420, DW-423, DW-427 and DW-433 closed; DW-438 appended.

**Review findings:** 3, all low. 2 patched (two doc comments); 1 deferred (the AGENTS.md wording, DW-438); 0 rejected.

**Follow-up review recommended:** false. Patched entries: high 0, medium 0, low 2.

**Verification:**
- `npm run typecheck`: exit 0, with no `TS2883` baseline errors.
- `npm run lint`: exit 0.
- `npm run test:unit`: 221 files and 4055 tests passed, before and after the patches.
- `supabase test db` through the 2.122.0 shim: 26 files and 594 tests passed.
- `npx playwright test --project=chromium` on every `tests/e2e` spec except `auth/token-persistence-overlap.spec.ts`: 290 passed, exit 0, and the row audit found no leftover rows. That spec cannot load in a worktree because it reads `node_modules/*/package.json` from the repo root, and the worktree has none.
- `rg "reminderDateEntries|mode=\"edit\"|initialName" src tests`: no matches.

**Out of scope (left open in the ledger):**
- DW-426: moves a persisted, account-scoped field across 15 test files, with a cross-account leak risk.
- DW-429: dropping the column makes `getPartner`'s URL identical to `lookupPartnerId`'s, which `partner-connect.spec.ts` matches on.
- DW-430/431, DW-434 and DW-435/436 are visible behaviour or design changes, not cleanup.
- DW-419, DW-425, DW-432 and DW-437 are hand checks, owner decisions or orchestrator-owned.

**Residual risk:** low. The sweep removed only dead paths and comments, and the full suites pass.
