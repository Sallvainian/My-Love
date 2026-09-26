---
title: 'Fix names, selectors, markers and test structure'
type: 'refactor'
created: '2026-09-25'
status: 'done'
baseline_revision: '744ef0f798b5a5fec1241f24081568602ae4e210'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/corrections.md'
  - '{project-root}/.claude/skills/bmad-testarch-test-review/steps-c/criteria-registry.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Lines that no catalog row names still carry the story's defect kinds in files this story edited, so a fresh TEA re-review may flag them.
    evidence: |-
      This story fixed catalog rows only; its spec forbids sweeping unnamed lines. Reviewers found these leftovers:
      - LoginScreen.kit.test.tsx finds the wordmark and tagline with getByText, although login-wordmark and login-tagline now exist.
      - App.eventsSession.test.tsx still has 8 getByText('Loading...') lookups.
      - Several "should ..." test names remain in MessageInput, LoveNoteMessage, useNetworkStatus, backgroundSync, ImagePreview and FullScreenImageViewer.
      - Some e2e selectors still use structure: h3 + div, h3 ~ span, firstElementChild and [data-testid^=...] prefixes.
      - Other lookups: dbSchema getBlockedDialog uses querySelector, AnniversarySettings.writes uses queryByText, FullScreenImageViewer finds its overlay by tagName, and LoveNotes.realtimeStatus uses getByText('Connected').
      - photoDialogsA11y has two tests with the same name, and a PhotoImageStates if (confirm) step can silently not run.
      - Names that state constants, such as "names the database 'my-love-db'", might count as L5.
      To settle it, run bmad-testarch-test-review on tests/unit, src, tests/e2e and tests/api + tests/integration, then count the L1/L3/L5/L7/M3 rows.
    location: >-
      src/components/LoginScreen/__tests__/LoginScreen.kit.test.tsx, tests/unit/App.eventsSession.test.tsx, and the other files listed
    severity: medium (unverified)
  - summary: >-
      PhotoViewer.focus resets deletePhotoMock inline at the end of each pending-delete test, so a failed assertion leaves a pending mockReturnValue for later tests.
    evidence: |-
      The original single test used the same inline mockReset. Splitting it into two tests doubled the number of places this can happen. It matters only after a test has already failed, where it can cause cascading failures. The fix is an afterEach(() => deletePhotoMock.mockReset()) in that describe.
    location: >-
      src/components/PhotoGallery/__tests__/PhotoViewer.focus.test.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** The 2026-09-25 test reviews list 419 rows with ids L1 (fragile selector), L2 (missing `[P#]` marker in e2e), L3 (no test id or role/label locator), L5 (implementation-shaped name), L7 (mixed assertion style), M3 (one test, three or more unrelated subjects), M4 (ungrouped suite) and M7 (excessive nesting). They span about 100 files in `tests/e2e`, `tests/api`, `tests/unit`, `src/**/__tests__` and `supabase/functions/upload-love-note-image/handler.test.ts`. Four of these rows are verified false positives (`corrections.md`).

**Approach:** Apply the four per-group worklists in `../worklists/story-8/`, which the planning investigation wrote. Each gives, per test file, every row located by current content, its exact fix (new locator, new test name, split test names with the assertions each keeps, new `[P#]` marker), and the app test hooks the fix needs. Add the `data-testid` hooks first, then fix each folder by rule group, one commit per group.

## Boundaries & Constraints

**Always:**
- Every original assertion survives. An M3 split keeps each assertion in some new test, and each new test arranges its own state (shared arrange goes in a local helper or `beforeEach`), never relying on a sibling test's side effects. A split test keeps its parent's `[P#]` marker in e2e.
- A negated text check (`not.toContainText`, `queryBy…` absent) is preceded in the same test by a positive check that the container rendered.
- App (non-test) changes are only `data-testid` or aria attributes, using the canonical ids in the Code Map. Never change markup structure or classes: e2e specs still use structural selectors such as `h3 + div` in `CountdownCard`.
- Repeated ids (`countdown-*`, `mood-icon-*`, `photo-grid-item-*`, `love-note-status`) are always queried inside `within(<card or row>)`.
- Locate rows by content; catalog lines are stale. Rows the worklists mark "already fixed" need no edit, but confirm each with grep.
- Folder-run and suite-run rows describing the same defect are fixed once.
- Match the surrounding style by hand; never run `prettier --write`. No `@/` inside `src/`. E2E imports `{ test, expect }` from `tests/support/merged-fixtures.ts`. A new `eslint-disable` carries a same-line ` -- ` reason.
- Verified false positives get the harmless change in the worklist:
  - `DisplayNameSetup.test.tsx` L5: a rename that drops `getUser()`.
  - `MoodHistoryTimeline.test.tsx` L3: read the notes through the existing `mood-note` test id.
  - `notesSlice.offlineQueue.test.ts` M3: the same assertions moved into a named helper `expectQueueDeliveredOnceInOrder`.
  - `coupleSettingsService.test.ts` L7: one `rejects` style, keeping the `toBeInstanceOf(AccountDataError)` check.

**Never:**
- Do not split whole files: story 9 does H5. Do not touch rules from other stories, `tests/e2e-archive/`, or the pgTAP files.
- Do not weaken a check to satisfy a rule. The worklists name two deliberate equivalences to keep:
  - The LoginScreen card check becomes "the card contains `login-form`".
  - "No Google logo" stays a regex on `innerHTML`, because `not.toContainHTML('<svg')` passes vacuously.
- Do not add `jsr:@std/testing/bdd` to the Deno suite. It is not cached for `deno test --no-lock`; group with `Deno.test` + `t.step`.
- Do not sweep defects no row names. Record them as observations for review.

</intent-contract>

## Code Map

**Worklists (the investigation; follow them file by file):**
- [e2e-api.md](../worklists/story-8/e2e-api.md) -- 106 rows: `tests/e2e`, `tests/api`, the Deno handler. Includes the L2 marker list (offline data paths and needs-a-connection get `[P1]`, token-persistence characterizations get `[P2]`, plus any e2e test still unmarked), the absence-check convention (`page.getByRole('main')` + `not.toContainText(…, { ignoreCase: true })`), and the e2e M3/M4/M7 splits.
- [src-1.md](../worklists/story-8/src-1.md) -- 126 rows: `src/components/love-notes`, `src/components/shared`, `src/hooks`, `src/utils`, `src/api`.
- [src-2.md](../worklists/story-8/src-2.md) -- 121 rows: PhotoGallery, PhotoUpload, RelationshipTimers (CountdownCards), Settings/EventsSettings/AnniversarySettings, LoginScreen, MoodTracker, PartnerMoodView, DisplayNameSetup, InteractionHistory, PokeKissInterface.
- [unit.md](../worklists/story-8/unit.md) -- 66 rows: `tests/unit`.
- Each worklist ends with `## App hooks` and `## Hazards`; read the hazards before editing that group.

**Canonical shared ids (the worklists agree on these; add each once):**
- `src/App.tsx` -- auth loader outer div `auth-loading-screen` (e2e bootstrap-notification-order ×12, unit), its `<Heart>` `auth-loading-icon`; data loader `app-data-loading-screen` / `app-data-loading-icon`; `events-load-error-message`, `events-empty-placeholder-message`.
- `src/components/love-notes/LoveNoteMessage.tsx` -- bubble `love-note-bubble`, used by the e2e `notes-kit` XPath row too. The text already has `love-note-text` from story 1.
- `src/components/love-notes/MessageInput.tsx` -- file input `message-input-file`, used by the e2e `needs-a-connection` `attachPicture` row too.
- `src/components/LoginScreen/LoginScreen.tsx` -- `login-wordmark`, `login-tagline`, `login-card`, `login-form`, `login-heading-icon`, `login-notice-icon`, `login-error-icon`, `submit-button-spinner`, `login-footer`.
- `src/components/DisplayNameSetup/DisplayNameSetup.tsx` -- `display-name-form`, which both src worklists name.
- `src/components/Settings/Settings.tsx` -- `settings-countdowns-card`, `settings-sign-out-card` (e2e), and `settings-identity`, `settings-email`, `settings-version` (src).
- `src/components/Settings/AnniversarySettings.tsx` -- `anniversary-delete-panel` (src-1) and `anniversary-row-date-${id}` (src-2).
- Every other hook is listed once in its own worklist's `## App hooks`.

**Already fixed (confirm only):** `LoveNoteMessage.test.tsx` `tagName 'P'`/`text-base` rows, which now use `love-note-text`; the `moodArrayGuards` note field, which is `getByRole('textbox')`; the `LoginScreen.callbackNotice.test.tsx` form lookup, which story 5 changed to click `submit-button`.

## Tasks & Acceptance

**Execution (one commit per group, in this order):**
- `src/**` (non-test) -- add every hook from the four `## App hooks` sections -- `test(src): add test ids for story 8 locators`.
- `tests/api/events-wire-contract.spec.ts`, `tests/api/interaction-authorization.spec.ts` -- M3 splits -- `test(api): split multi-concern tests`.
- `supabase/functions/upload-love-note-image/handler.test.ts` -- M4 `t.step` grouping + M3 split -- `test(upload-love-note-image): group handler tests and split the success case`.
- `tests/e2e/**` -- commit `test(e2e): …` per group: L2 markers; L1/L3 locators; L5 names; M3/M4/M7 structure.
- `src/**/__tests__/**` -- commit `test(src): …` per group: L1/L3/L7 locators and style; L5 names; M3 splits.
- `tests/unit/**` -- commit `test(unit): …` per group: L1/L3 locators; L5 names; M3 splits.
- Four false-positive files -- the harmless changes above -- `test: quiet the four verified false positives`.

**Acceptance Criteria:**
- Given each catalog row with id L1/L2/L3/L5/L7/M3/M4/M7, when its file is re-read, then the defect is gone:
  - no CSS/tag/XPath/parent-traversal or copy-text locator where a role, label or test id applies;
  - every e2e test name carries `[P#]`;
  - no test name states a method, constant or "correct";
  - no test asserts three or more unrelated subjects;
  - every such file has a `describe` or group;
  - no body nests more than three blocks.
- Given a split or relocated test, when the suite runs, then every assertion that existed before still runs and passes.
- Given the repo, when lint, typecheck, Vitest, the Deno tests and the changed Playwright specs run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 28 findings — high 0, medium 0, low 15, false 11, maybe-false 2
- findings:
  - `[low]` `[patch]` (blind) Split partner-lookup tests in useRealtimeMessages and the rejoin file pass even if no retry happened — Patched in 725e2f19: each test first asserts the retry or rejoin happened (`subscribeCallbacks` length 2; a second, distinct opened channel).
  - `[false]` `[reject]` (blind) `getByRole('main')` narrows the absence checks — Only AppNavigation, NetworkStatusIndicator and SyncToast render outside `<main>` (App.tsx:738-748). They show only fixed copy, so no event, mood or note text can appear there.
  - `[low]` `[defer]` (blind) LoginScreen.kit.test.tsx still finds the wordmark and tagline by getByText — No catalog row names those lines, and the intent is the catalog rows. Deferred with the unflagged-leftovers entry.
  - `[low]` `[patch]` (blind) `getByTestId(...)).not.toBeNull()` in kitSurfaces is an odd dialect — Patched in 725e2f19: `.toBeInTheDocument()` here and in MessageInput.
  - `[low]` `[patch]` (blind) The LoveNoteMessage loading test's comment still names the animate-spin spinner — Patched in 725e2f19: the comment now describes the loading placeholder it asserts.
  - `[low]` `[patch]` (blind) New names overclaim or state constants — messageValidation "caps a message at 1000 characters" now also asserts that a message of MAX+1 is rejected (725e2f19). The dbSchema names are not defects: the version test pins 15 in its body anyway, and the store-name test's name states the values it asserts, which is behaviour, not a method, selector or "correctly".
  - `[maybe-false]` `[defer]` (blind) "should ..." names and ByText('Loading...') lookups remain in touched files — These lines are unflagged, so a re-review would settle it. Deferred as medium (unverified).
  - `[low]` `[defer]` (blind) The worklists' out-of-scope observations were never recorded — Now recorded in `deferred`.
  - `[false]` `[reject]` (blind) No verification results recorded — Verification ran: lint 0, typecheck 0, Vitest 2907 passed, Deno 35 steps, Playwright api 12 and chromium 125 passed. Recorded under Auto Run Result.
  - `[low]` `[reject]` (blind) Edit-only-own now checked on first-page rows, not paged-in rows — The ownership rule is per row owner and does not depend on the page. Appended pages go through the same getEventsPage mapping and the Map merge, and EventsSettings.pagination.test.tsx checks a deep own row against a partner row. Restoring the paged setup would need new seeding.
  - `[low]` `[defer]` (blind) PhotoViewer.focus resets its mock inline, not in afterEach — The pattern predates this story and bites only after a test has already failed. Deferred as low.
  - `[false]` `[reject]` (blind) Unhandled-rejection check dropped from two split tests — Both the 'logs…' and 'retries…' tests run the same mount-and-reject sequence and call `expectNoUnhandledRejection()`, so every path that could leak the rejection is still checked.
  - `[low]` `[reject]` (blind) Outsider cleanup is duplicated across two api specs — The duplication predates this story; each file already had its own inline version. A shared helper would be new structure, which story 7 also rejected.
  - `[low]` `[reject]` (blind) The e2e runtime growth was not measured — The splits are what the M3 rows require. All 28 changed specs, 125 tests, ran in 1.4 min locally.
  - `[false]` `[reject]` (blind) Spec and worklists are uncommitted — They are committed at finalization.
  - `[low]` `[patch]` (edge) useRealtimeMessages retried-join lookup test has no retry premise — Grouped with the first entry; patched in 725e2f19.
  - `[low]` `[patch]` (edge) The rejoin no-lookup test never checks that a replacement exists — Grouped with the first entry; patched in 725e2f19.
  - `[low]` `[patch]` (edge) The MoodHistoryTimeline name says "beneath" but order is never checked — Patched in 725e2f19: renamed 'renders the date header row and the mood row'.
  - `[false]` `[reject]` (edge) Repeated moods duplicate `mood-icon-${m}`, so getByTestId would throw — No test queries a repeated mood by getByTestId; the counts use getAllByTestId, and the single-id queries are for distinct moods.
  - `[false]` `[reject]` (edge) AdminPanel `row()` RegExp breaks on metacharacters or prefixes — Its only callers pass 'Account A message' and 'Account B message', which have no metacharacters and neither is a prefix of the other.
  - `[low]` `[reject]` (verification-gap) The pagination ownership check moved to different data — Grouped with the Edit-only-own entry above; same reasoning.
  - `[false]` `[reject]` (verification-gap) `love-note-status` is queried with screen, not within() — Each of those tests renders one note, so the id cannot match twice.
  - `[maybe-false]` `[defer]` (intent) Success is judged by a re-review that was not run, and constant-stating names might be flagged — Grouped with the unflagged-leftovers deferral, medium (unverified).
  - `[false]` `[reject]` (intent) No evidence that lint, typecheck, Deno or Playwright passed — All of them ran and passed; see Verification in Auto Run Result.
  - `[false]` `[reject]` (intent) Nothing proves every original assertion survived — The verification-gap layer traced each removed assertion to its new location, and the orchestrator read the full diff.
  - `[false]` `[reject]` (intent) login.spec.ts "persist session" corrections item still open — Story 1 (G13) resolved it: the test now signs in before checking persistence.
  - `[low]` `[reject]` (intent) The test-id and false-positive commits are not per finding group — Hooks are shared across folders, so they needed one commit. Regrouping would mean rewriting history, and nobody is harmed.
  - `[false]` `[reject]` (intent) Untracked planning inputs in the diff — They are committed at finalization with this spec.

## Design Notes

Split pattern (golden example, unit M3). One `it` that checks the UI, the disk copy and the server refresh becomes three `it`s that share a local `renderPendingLookup()`/`openGatedDelete(user)` arrange helper. Each keeps its slice of the original `expect`s verbatim. A split is stricter, never looser: a combined write count of 2 becomes 1 per action.

Absence-check pattern (e2e): `await expect(page.getByTestId('event-countdown-future-meetup-e2e')).toBeVisible(); await expect(page.getByRole('main')).not.toContainText('Event passed', { ignoreCase: true });`. The positive check comes first, because a negated check passes on a missing element.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: exit 0, apart from the documented worktree-only TS2883 baseline, if present.
- `npx vitest run` -- expected: all files pass, with a test count at or above the baseline (splits add tests).
- `deno test --no-lock supabase/functions/upload-love-note-image/` -- expected: pass, no `deno.lock` written, step count ≥ the previous 33 cases.
- `supabase start` then `npx playwright test --project=api <changed api specs>` and `npx playwright test --project=chromium <changed e2e specs>` -- expected: pass. If the local stack cannot run, record that in the result.
- `grep -rn --include='*.spec.ts' -E "test(\.(only|fixme))?\(\s*['\"\`]" tests/e2e | grep -vE "\[P[0-3]\]"` -- expected: no output.

## Auto Run Result

Status: done

**Summary:** This story fixes every catalog row for its rule ids across the five `findings-*.md` catalogs: L1, L2, L3, L5, L7, M3, M4 and M7. That is 419 rows in about 100 files, following the four worklists in `../worklists/story-8/`.
- **Locators (L1, L3):** fragile ones now use role, label or `data-testid` locators.
- **Priority markers (L2):** every e2e test name carries a `[P#]` marker. The offline tests are `[P1]`, and the token-persistence characterisation tests are `[P2]`.
- **Names (L5):** implementation-shaped names now describe behaviour.
- **Multi-concern tests (M3):** each is split into focused tests with shared arrange helpers. Every assertion is kept.
- **Structure (M4, M7):** the ungrouped suites now have a `describe`, or `Deno.test` plus `t.step` in the handler suite. The nested quota shim in `photos-offline` is now a named helper.
- **False positives:** the four verified ones each got the harmless change `corrections.md` asks for.
- **Already fixed:** three rows needed no edit, confirmed by grep.

App code changed only by adding `data-testid` attributes, plus one existing `testId` prop on the anniversary countdown card. No markup or classes changed.

**Files changed (124 plus this spec and its worklists):**
- `src/**` app components (25): `data-testid` hooks only (loaders, LoginScreen, love-notes, CountdownCard, Settings, EventsSettings, AnniversarySettings, PhotoViewer/PhotoGridItem, MoodTracker, error boundaries, WelcomeSplash, SyncToast, NetworkStatusIndicator, and others).
- `src/**/__tests__` (40): locators, renames and M3 splits.
- `tests/e2e/**` (29): `[P#]` markers, locators, the logout rename, and splits in cross-device, home events, home-kit, partner-kit, birthdays-wedding, events-crud, needs-a-connection and events-history-pagination. `describe` wrappers for token-persistence and events-history-pagination, and the quota-shim helper.
- `tests/api/**` (2): M3 splits in events-wire-contract (004b, 008b) and interaction-authorization (4 tests), with file-local cleanup helpers.
- `supabase/functions/upload-love-note-image/handler.test.ts`: 4 `Deno.test` groups with `t.step`, and the success case split three ways.
- `tests/unit/**` (27): locators, renames, M3 splits, and the two false-positive changes.
- `_bmad-output/specs/spec-test-review-remediation/worklists/story-8/*.md`: the planning worklists, which serve as this spec's Code Map.

**Commits:**
- Hooks: d99a2951
- api: 16b3b554
- Deno: aeb718e7
- e2e: fecf4a66, 3a9e9d44, da44d433 and ff5872d6
- src: 6c7e93e7, 1a764e13 and f6b14236
- unit: a75340d3, 9a1bafe0 and 49e53f91
- False positives: 400bbd18
- Review patches: 725e2f19

**Review findings:** 28 in total: high 0, medium 0, low 15, false 11, maybe-false 2.
- **Patched (low, 5 entries):** 725e2f19 fixed these. The first two came from 3 findings and the last three from one finding each.
  - Retry and rejoin premises in the split partner-lookup tests.
  - `toBeInTheDocument` in place of `.not.toBeNull()`.
  - The stale spinner comment in LoveNoteMessage.
  - The messageValidation name, now backed by a MAX+1 rejection assertion.
  - The MoodHistoryTimeline rename.
- **Deferred (2 entries):**
  - Unflagged leftovers of the story's defect kinds in edited files: medium (unverified), grouping 4 findings.
  - The inline `mockReset` in PhotoViewer.focus: low.
- **Rejected, low (6):**
  - Edit-only-own moved to first-page data (2 findings): the rule is per owner, not per page, and unit tests cover the component side.
  - Duplicated outsider cleanup: the duplication predates this story.
  - Unmeasured e2e runtime: the whole changed set ran in 1.4 min.
  - Commit grouping: the hooks are shared across folders.
- **Rejected, false (11):**
  - The `<main>` scope: nothing outside `<main>` renders data text.
  - Missing verification results, counted twice (blind and intent reviewers).
  - The dropped unhandled-rejection check: still checked on every path.
  - Uncommitted spec and worklists, counted twice: they are committed at finalization.
  - Duplicate mood-icon ids: nothing queries a duplicate.
  - AdminPanel RegExp: no caller passes metacharacters.
  - `love-note-status` via `screen`: each test renders one note.
  - Assertion survival: traced by the verification-gap layer.
  - The login.spec item: story 1 fixed it.

**Follow-up review recommended:** false. This was a first pass. Every patched entry was low: none high, and no medium.

**Verification (after the review patches):**
- `npm run lint`: exit 0.
- `npm run typecheck` (`tsc -b --force`): exit 0.
- `npx vitest run`: 156 files, 2907 tests passed (2802 before this story).
- `deno test --no-lock supabase/functions/upload-love-note-image/`: 4 tests, 35 steps, all passed. No `deno.lock` was written.
- Playwright `api` on the 2 changed specs: 12 passed.
- Playwright `chromium` on the 28 changed e2e specs (token-persistence excluded): 125 passed in 1.4 min. The review patches touched no Playwright spec.
- The spec's `[P#]` grep: no output.

**Residual risks:**
- `tests/e2e/auth/token-persistence-overlap.spec.ts` was not run. It reads `node_modules` from the worktree root, which a loop worktree does not have. Its only changes are a `describe` wrapper and `[P2]` added to its test names, and both lint and typecheck pass.
- A fresh TEA re-review may still flag lines that no row named (see `deferred`).
- The splits add e2e runtime, for example home-kit goes from 2 tests to 10 and partner-kit from 2 to 6. CI shard balance was not re-measured.
