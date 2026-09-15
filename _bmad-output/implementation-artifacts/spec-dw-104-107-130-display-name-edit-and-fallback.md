---
title: 'Display name: a settings route back, and one seed rule for both readers'
type: 'feature'
created: '2026-09-14'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: ['multiple-goals', 'oversized']
deferred:
  - summary: >-
      A third reader of `users.display_name` still renders a seeded partner's own
      email address as their name, on the partner-mood surface.
    evidence: |-
      `partnerService.getPartner` builds `displayName: partnerRecord.display_name
      || partnerRecord.email || 'Partner'`, applying no seed rule, and that value
      reaches `partnerSlice` and is rendered as "<name>'s Moods" and "Connected
      with <name>". For the exact DW-104 couple -- a partner row still carrying
      `sync_user_profile()`'s email seed -- love notes now correctly shows
      'Partner' while the partner-mood view still shows the full address from the
      same stored row. No test reaches that `||` chain: the store test stubs
      `getPartner` with fixtures that already carry a displayName, and the only
      spec rendering PartnerMoodView passes `partner: null`. Pre-existing and
      outside this bundle's intent, which names `getPartnerDisplayName` alone.
    location: >-
      src/api/partnerService.ts:88 (rendered at src/components/PartnerMoodView/PartnerMoodView.tsx:535,565,628)
    severity: medium
  - summary: >-
      Two sibling destructive buttons still fail WCAG AA contrast with white text
      on `bg-red-500`.
    evidence: |-
      Measured against this repo's Tailwind 4.3.3 palette: `--color-red-500` is
      `oklch(63.7% 0.237 25.331)` = #fb2c36, which is 3.82:1 against #ffffff --
      below the 4.5:1 AA floor, and the exact figure axe reported for the events
      delete-confirm button before it was moved to `bg-red-600` (#e7000b, 4.76:1)
      in this change. The same `bg-red-500` + `text-white` pairing remains on the
      anniversary reset button and the photo delete button. Neither sits under an
      axe scan today, so both are silently non-compliant. Pre-existing; only the
      events button was touched here because only it was under a scan this
      change's page-height increase brought into evaluation.
    location: >-
      src/components/Settings/AnniversarySettings.tsx:207 and src/components/PhotoGallery/PhotoViewer.tsx:671
    severity: low
baseline_revision: '905617694cd6a2188210b1d7a801e9799d7dcb31'
---

<intent-contract>

## Intent

**Problem:** `DisplayNameSetup` is the only UI that writes `display_name`, and `src/App.tsx:617` renders it only when `needsDisplayName`, which `src/App.tsx:329` sets solely on `result.status === 'unset'` — so a name can be chosen once and never changed (DW-130). Separately `getPartnerDisplayName` (`src/api/supabaseClient.ts:342-368`) returns `data?.display_name ?? null` verbatim, so a partner whose row still carries the trigger's email seed is rendered in the chat as their full email address, while the own-name path falls back to the email prefix (DW-104). Neither is covered end to end: `tests/e2e/auth/display-name-setup.spec.ts:194-196` stops at the post-reload app container and never navigates to love notes (DW-107).

**Approach:** Extract the seed-fallback classification that is currently a local `const` inside `lookupOwnDisplayName` (`src/api/supabaseClient.ts:450-453`) into one exported predicate, and apply it in `getPartnerDisplayName` as well as in `lookupOwnDisplayName`. Give `DisplayNameSetup` optional prefill/cancel/copy props and mount it from a new Account-section entry point in `Settings`, reusing the existing write at `DisplayNameSetup.tsx:101-108`. Close the E2E gap with a new case in the existing spec file that edits the name through Settings and asserts it on a note in the chat.

## Boundaries & Constraints

**Always:**
- Keep both write-side refusals in `DisplayNameSetup.handleSubmit` on every surface, the edit one included: a name equal to the account email (`:87-90`) and the literal `SEED_FALLBACK_NAME` (`:92-95`). The read side recomputes that classification on every read, so saving either re-prompts forever.
- Keep the profile UPDATE payload exactly `{ display_name, updated_at }` scoped by `.eq('id', user.id)` — `authenticated` holds UPDATE on only those two columns (`supabase/migrations/20260912030000_profile_name_email_ownership.sql:141`), and naming any other column makes the whole PATCH a 42501.
- Keep failing closed on a zero-row update (`DisplayNameSetup.tsx:118-120`).
- The existing `<DisplayNameSetup isOpen onComplete={…} />` call in `App.tsx:620-630` must keep compiling and behaving identically — every new prop is optional and defaults to today's behaviour.
- The E2E case uses this worker's own pool account via `resolveOwnPair` and restores the display name it changed in a teardown that always runs.

**Never:**
- No schema, migration, grant or policy change — `users_update_self_safe` already permits the write.
- Never link or unlink partners, reset a password, or null a shared row in the E2E spec.
- Do not touch `partnerService.getPartnerInfo` (`src/api/partnerService.ts:76-89`); it is a different surface with its own fallback chain.
- Do not add react-router, do not use the `@/` alias inside `src/`, and do not re-add a formatter.
- Do not refactor the `useState(() => …)` mount hack at `Settings.tsx:27-31`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Partner chose a name | partner row `display_name: 'Jessie'`, `email: 'p@example.com'` | `getPartnerDisplayName()` → `'Jessie'` | No error expected |
| Partner still carries the email seed | `display_name` equals the partner row's own `email`, any case, with stray whitespace | `getPartnerDisplayName()` → `null`; chat keeps its `'Partner'` default | No error expected |
| Partner carries `'Unknown'`, `''`, whitespace or `null` | any of those in `display_name` | `getPartnerDisplayName()` → `null` | No error expected |
| Partner name merely contains the email | `display_name: 'p@example.com (work)'` | `getPartnerDisplayName()` → that string — the rule is equality, not containment | No error expected |
| Partner row has no email to compare | `email: null`, `display_name: 'Jessie'` | `getPartnerDisplayName()` → `'Jessie'` | No error expected |
| Partner read fails / no partner | PostgREST error, or `getPartnerId()` → `null` | `getPartnerDisplayName()` → `null`, as today | Logged, not thrown |
| Settings opens the edit form | name currently `'Jessie'` | Modal opens with the field pre-filled `'Jessie'` and a Cancel control | No error expected |
| Edit save is refused | submitted name equals the account email, or is `'Unknown'` | Inline error, modal stays open, no network write | Existing inline error banner |
| Edit cancelled | Cancel pressed | Modal closes, no write, displayed name unchanged | No error expected |
| Own-name read fails in Settings | `lookupOwnDisplayName()` → `error` | The row says the name could not be loaded; editing is still offered with an empty field | Logged, not thrown |

</intent-contract>

## Code Map

- `src/api/supabaseClient.ts:342-368` -- `getPartnerDisplayName`; selects only `display_name` today, must also select `email` and apply the shared predicate. `:376` `SEED_FALLBACK_NAME`. `:419-461` `lookupOwnDisplayName`, whose `:448-453` block is the classification to extract (trim both sides; `''`, `SEED_FALLBACK_NAME`, or a case-insensitive match to the email). `:471-474` `getOwnDisplayName`.
- `src/components/DisplayNameSetup/DisplayNameSetup.tsx` -- `:30-35` props, `:38` `useState('')` to prefill from, `:84-95` the two refusals, `:101-120` the write and the fail-closed check, `:140-143` header copy, `:192-226` submit button. Reused as-is by both surfaces.
- `src/components/DisplayNameSetup/DisplayNameSetup.css` -- `.submit-button:120-146` is the style to sit a secondary control beside; dark-mode block at `:179`.
- `src/components/Settings/Settings.tsx:76-154` -- Account section; `:81-101` the existing `user-info` block the new row sits beside.
- `src/components/Settings/Settings.css:73-101` -- `.user-info` / `.user-email` / `.user-label`; add the new rules near them and mirror them in the dark-mode block at `:222`.
- `src/App.tsx:617-633` -- the signup gate; the untouched call site whose behaviour must not change.
- `src/components/love-notes/LoveNotes.tsx:57-95` -- `userName` defaults `'You'` and falls back to the email prefix at `:81`; `partnerName` defaults `'Partner'` at `:59` and is only overwritten when `getPartnerDisplayName()` answers truthy at `:86-88`. That default is the partner-side fallback — no component change is needed.
- `src/components/love-notes/MessageList.tsx:92` and `LoveNoteMessage.tsx:244` -- `senderName` renders only on a note, inside `data-testid="love-note-message"`.
- `tests/unit/api/ownDisplayNameContract.test.ts` -- drives the real module against a stubbed PostgREST chain; the single-result stub shape to copy.
- `tests/unit/api/partnerLookupContract.test.ts:21-49` -- the queued `singleResults` variant of that stub, which is what a two-read call (`partner_id`, then the partner row) needs.
- `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx` -- existing write-side coverage and its `vi.mock` of `../../../api/supabaseClient`; extend rather than replace.
- `src/components/love-notes/__tests__/OwnDisplayName.test.tsx:55-62` -- mocks `MessageList` down to two spans, `own-name` and `partner-name`.
- `tests/e2e/auth/display-name-setup.spec.ts` -- `:91` `test.use({ authSessionEnabled: false })` applies to the existing describe only; `:69-73` `suppressWelcomeSplash`; `:194-196` where coverage stops.
- `tests/support/helpers/events.ts:70-84` -- `resolveOwnPair(supabaseAdmin)` → `{ userId, partnerId }`, keyed on `TEST_WORKER_INDEX`.
- `tests/support/helpers/navigation.ts:50-55` -- `navigateTo(page, 'settings' | 'notes')`.
- `tests/e2e/notes/love-notes.spec.ts:51-78` -- how a note is sent through the UI and asserted.

## Tasks & Acceptance

**Execution:**
- `src/api/supabaseClient.ts` -- extract `:450-453` into an exported predicate (e.g. `isSeedFallbackName(storedName, accountEmail)`) taking the raw column value and the raw email, trimming both, and returning true for `''`, `SEED_FALLBACK_NAME`, or a case-insensitive equality; call it from `lookupOwnDisplayName`; in `getPartnerDisplayName` select `'display_name, email'` and return `null` when the predicate holds -- one classification, so the two readers can no longer disagree.
- `src/components/DisplayNameSetup/DisplayNameSetup.tsx` -- add optional `initialName`, `onCancel` and `mode` (`'setup' | 'edit'`, defaulting to `'setup'`) props: seed the field from `initialName`, render a Cancel control when `onCancel` is supplied, and switch the header/subtitle/submit copy in edit mode -- the same form, and the same refusals, on both surfaces.
- `src/components/DisplayNameSetup/DisplayNameSetup.css` -- add the secondary-button rules (and their dark-mode counterparts) for the Cancel control.
- `src/components/Settings/Settings.tsx` -- read the current name with `lookupOwnDisplayName` in a `useEffect` guarded by a cancelled flag, render it in the Account section with a Change control (`data-testid="settings-display-name"` and `settings-display-name-edit`), mount `DisplayNameSetup` conditionally in edit mode prefilled with that name, and re-read on completion -- the route back the feature has never had.
- `src/components/Settings/Settings.css` -- styles for the display-name row and Change control, mirrored in the dark-mode block.
- `tests/unit/api/partnerDisplayNameContract.test.ts` -- new file driving the real `getPartnerDisplayName` against a queued PostgREST stub, covering every partner row in the I/O matrix -- the contract, not a consumer's use of it.
- `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx` -- add edit-mode cases: the field arrives prefilled, Cancel calls `onCancel` and writes nothing, and the email/`'Unknown'` refusals still hold with a prefilled field.
- `src/components/Settings/__tests__/Settings.displayName.test.tsx` -- new file: the current name renders, Change opens the form prefilled, completing re-reads the name, cancelling leaves it alone, and a failed read still offers editing.
- `src/components/love-notes/__tests__/OwnDisplayName.test.tsx` -- add the case where `getPartnerDisplayName` answers `null` and the chat keeps `'Partner'` rather than showing an address.
- `tests/e2e/auth/display-name-setup.spec.ts` -- add a second `test.describe` (default auth session, so this worker's partner-linked pool account) that changes the name through Settings, sends a note, and asserts the new name on that note, restoring the original name in a teardown that always runs.

**Acceptance Criteria:**
- Given a signed-in user whose profile already has a chosen name, when they open Settings, then the Account section shows that name and a control that opens the display-name form pre-filled with it.
- Given that form is open from Settings, when the user submits a new valid name, then the profile row is updated, the form closes, and the Account section shows the new name without a reload.
- Given that form is open from Settings, when the user cancels, then no write is issued and the shown name is unchanged.
- Given a user arriving without a name, when the app loads, then `App.tsx`'s gate still renders the same modal with no Cancel control and unchanged copy.
- Given a partner whose profile row still carries only the trigger's seed, when the chat loads, then no part of the partner's email address is rendered as their name.
- Given this worker's pool account, when the E2E case renames it in Settings and opens love notes, then a note it sends carries the new name, and the account's original name is restored afterwards.

## Design Notes

`getPartnerDisplayName` returning `null` for a seed is deliberately the same answer it already gives for "no partner" and "the read failed": `LoveNotes.tsx:86` is its only caller and does nothing with the difference except keep its `'Partner'` default. The fail-closed rule in AGENTS.md is about a null that gates Realtime delivery; this one only decides a rendered string, exactly as `getOwnDisplayName` already collapses three answers into one.

The partner's `email` is readable — the SELECT policy returns own + partner rows (`20260205000001_fix_users_rls_recursion.sql:28-37`) and `partnerService.ts:76` already selects that column for the partner. Only UPDATE was revoked from `authenticated`.

Settings mounts the form conditionally rather than keeping it mounted behind `isOpen={false}`, so each open is a fresh mount and `useState(initialName)` actually picks the current name up.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (worktree-only TS2883 noise aside).
- `npm run lint` -- expected: exit 0.
- `npx vitest run tests/unit/api/partnerDisplayNameContract.test.ts tests/unit/api/ownDisplayNameContract.test.ts src/components/DisplayNameSetup src/components/Settings/__tests__/Settings.displayName.test.tsx src/components/love-notes/__tests__/OwnDisplayName.test.tsx` -- expected: all pass.
- `npx playwright test --project=chromium tests/e2e/auth/display-name-setup.spec.ts` -- expected: all pass, with `supabase start` running.

## Auto Run Result

Status: done
Blocking condition: none

### Summary

Display names now have a route back after signup, and the own-name and partner-name readers apply one shared rule to the same column. The seed classification that lived as a local `const` inside `lookupOwnDisplayName` is an exported predicate that `getPartnerDisplayName` also applies, so a partner who never chose a name is no longer rendered in the chat as their full email address. `DisplayNameSetup` gained three optional props and is mounted a second time from a new Account-section entry point in Settings, prefilled with the current name — the same form, with the same two write-side refusals, reached by someone who already has a name. End-to-end coverage now walks that route and asserts the new name on a note in love notes, before and after a reload.

### Files changed

- `src/api/supabaseClient.ts` — exported `isSeedFallbackName`; `getPartnerDisplayName` selects `display_name, email` and answers `null` for a seeded row; `lookupOwnDisplayName` calls the shared predicate instead of its own copy.
- `src/components/DisplayNameSetup/DisplayNameSetup.tsx` — optional `initialName`, `onCancel`, `mode`; dialog semantics and Escape-to-cancel where a cancel route exists; the signup gate's markup and its lack of an exit are unchanged.
- `src/components/DisplayNameSetup/DisplayNameSetup.css` — secondary Cancel control and its dark-mode rules.
- `src/components/Settings/Settings.tsx` — display-name row fed by `lookupOwnDisplayName`, a Change control, and the form mounted conditionally in edit mode with a re-read on completion.
- `src/components/Settings/Settings.css` — display-name row and Change control, mirrored in dark mode.
- `src/components/Settings/EventsSettings.tsx` — **out of spec, one line**: the event delete-confirm button moved from `bg-red-500`/`hover:bg-red-600` to `bg-red-600`/`hover:bg-red-700`. See Residual risks.
- `tests/unit/api/partnerDisplayNameContract.test.ts` — new; drives the real `getPartnerDisplayName` against a stubbed PostgREST chain over every partner row in the I/O matrix.
- `src/components/Settings/__tests__/Settings.displayName.test.tsx` — new; the Settings entry point against the real form.
- `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx` — edit-mode cases, dialog semantics, and the signup gate's unchanged shape.
- `src/components/love-notes/__tests__/OwnDisplayName.test.tsx` — the partner-side fallback.
- `tests/e2e/auth/display-name-setup.spec.ts` — new `Display Name Edit` case on this worker's pool account, with the name restored in `test.afterEach`.

### Review findings breakdown

Four layers reported 25 findings: 0 high, 9 medium, 15 low, 1 false, 0 maybe-false. Full rows in the Review Triage Log above.

**Patched (6 entries — 4 medium, 2 low):**
- Saving then immediately reopening Change during the re-read prefilled the pre-save name and wrote it back over the new one.
- The E2E name restore sat in the test body, where a Playwright timeout would skip it and leave the shared pool row renamed.
- The E2E prefill assertion was guarded on the raw column rather than on what the field actually shows.
- The E2E asserted only the optimistic note render, never a reload — which is DW-107's own wording.
- The modal became user-dismissible without `role="dialog"`, `aria-modal`, an accessible name, or a keyboard exit.
- Three new `OwnDisplayName` cases were one case under three names.

**Deferred (2):** the third reader in `partnerService.getPartner` that still renders a seeded partner's email on the partner-mood surface (medium); and the two sibling `bg-red-500` + `text-white` buttons that still fail WCAG AA (low). Both are in frontmatter `deferred`.

**Rejected (9):** the write side keeping its own copy of the seed rule (no bad outcome today, and the fix would collapse two refusal messages the intent requires keeping); no rendered-surface test for the partner fix (unreachable without a seeded partner row, which a spec must not create); two unreachable `??` arms (required by the column's type); the spec's own `oversized`/`multiple-goals` warnings (fix would edit this build's spec); a hardcoded `SEED_FALLBACK_NAME` in a test mock and `autoFocus` on a prefilled field (documented convention; correct behaviour); DW-104's expectation surface versus its test surface (same substance as the coverage finding); the `EventsSettings` recolour being unverified (refuted — the axe spec verifies it, run red-then-green); the "App's gate is unchanged" tests being at the component surface (App's gate is already covered in `tests/unit/App.eventsSession.test.tsx`); and one **false** finding — that `'Not set yet'` describes an unreachable state, refuted because `App.tsx:324-327` fails open on a read error, so a user with a genuinely unset name whose App-level read failed does reach Settings.

### Follow-up review recommendation

`true`. First pass, four `medium` entries patched (threshold is two). The specific unverified risk: the E2E teardown's restore now writes and re-verifies **up to twice**, to beat an app-side PATCH that can still be in flight when a timeout aborts the body without closing the page (`tests/e2e/auth/display-name-setup.spec.ts`). That retry was validated by a hand-simulated abort, not by a deterministic test, so its timing assumption is the one thing here no automated check pins.

Patched counts by verdict: high 0, medium 4, low 2.

### Verification performed

- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0.
- `npx vitest run` — 95 files, 1788 tests, all passed.
- `npx playwright test --project=chromium` (whole suite) — 108 passed, 0 failed. `tests/e2e/auth/token-persistence-overlap.spec.ts` was excluded: it reads `<worktree>/node_modules/@playwright/test/package.json` literally, and a loop worktree's `node_modules/` is empty, so it fails at collection time here regardless of this change.
- `tests/e2e/settings/events-accessibility.spec.ts` — run at baseline (4 passed) and on this branch before the recolour (1 failed), which is how the contrast defect was established as real rather than assumed.
- Worker pool rows re-queried after the full E2E run: all 20 display names intact, so the new teardown restores correctly.
- Every I/O & Edge-Case Matrix row has a covering test that ran and passed.

### Residual risks

1. **One out-of-spec line.** `EventsSettings.tsx:1365` is not in this spec's Code Map or Tasks, and all four review layers flagged it. It is here because this change makes the Settings page ~105px taller, which scrolls the events row into view on click and flips axe's obscuring heuristic from "skip" to "evaluate" on the delete-confirm button — so `events-accessibility.spec.ts:211` goes red on this branch and green at baseline, both of which I ran. The button genuinely fails WCAG AA: I computed `--color-red-500` = `oklch(63.7% 0.237 25.331)` to #fb2c36 at 3.82:1 on white, reproducing axe's reported hex and ratio exactly; `bg-red-600` (#e7000b) measures 4.76:1 and clears the 4.5:1 floor. Reverting it would ship a red P1 check. The change is one token plus its hover pair, and no test pins that button's class.
2. **The partner-side fix is pinned at the module boundary, not at a rendered note.** `partnerDisplayNameContract.test.ts` drives the real reader and fails without the change, but no E2E shows a seeded partner's name in the chat — pool accounts are provisioned with a chosen name, and a spec must not rewrite the partner's row.
3. **The E2E mutates this worker's own pool row.** It restores it in `test.afterEach` and asserts the restore landed, but the row is shared fixture state that outlives the run.
