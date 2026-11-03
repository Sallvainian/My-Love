---
title: 'The Settings navigation rules have an E2E spec'
type: 'chore'
ticket: '19'
created: '2026-11-03'
status: done
baseline_revision: '94023a0bd434eacb1bd5cb80921991934af26324'
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
deferred: []
---

<intent-contract>

## Intent

**Problem:** The epic's navigation rules (Notes: reload, back from Home, pasted link, Home is the bottom layer) are each tested piecemeal across `settings-stack`, `home-date-entry-points`, `dock` and `routing` specs; no one spec walks them all, and "back on Home leaves nothing of the app's behind" has no E2E check at all.

**Approach:** Add one spec, `tests/e2e/navigation/settings-navigation-rules.spec.ts`, with one test per rule, driving the real app in the bottom-dock form on a phone viewport. No app code changes.

## Boundaries & Constraints

**Always:** Import `{ test, expect }` from `tests/support/merged-fixtures.ts`. Reuse helpers (`dismissWelcomeSplash`, `openSettingsFromHome`, `openDatesList`, `openNewDateForm`, `navigateTo`, `resolveOwnPair`, `seedEvent`, `isoDateDaysFromNow`, `UPCOMING_EVENTS_READ`, `COUPLE_SETTINGS_READ`) by deep path; write no copy of one. Arm `interceptNetworkCall` before the action it waits on. Seed only through `supabaseAdmin`, delete only seeded ids in `afterEach`. Each test tags `[P1]` (or `[P0]` for back-to-Home). Match surrounding spec style by hand; never `prettier --write`.

**Never:** Change `src/`, other specs or helpers (a missing helper is a deferral, not an edit elsewhere). Link/unlink partners, save a field, or null shared rows. Emulate the column dock form (desktop Chrome cannot fake `env()` insets; `settings-stack.spec.ts` header says the unit tests prove it) — say so in the spec's header. Fixed page clocks.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reload list page | gear → Dates, reload | `/settings/dates`, h1 Dates | — |
| Reload date page | Dates → seeded event row, reload | `/settings/dates/event/<id>`, h1 = label | — |
| Reload one-field page | gear → Profile → Name, reload | `/settings/profile`, h1 Profile; back → `/settings` | — |
| Reload form page | Dates → `+` → Event, reload | `/settings/dates`, h1 Dates, no form | — |
| Date page from Home | Home card tap, then back | `/`, `nav-home` `aria-current="page"` both on the page and after back | — |
| Pasted link | `goto('/settings/dates/event/<id>')`, back arrow | `/settings/dates` (skips `dates/event`), history length unchanged; arrow again → `/settings` | — |
| Pasted one-field link | `goto('/settings/profile/name')` | `/settings/profile` | — |
| Sideways through dock | Home → Mood → Notes → Photos (dock), back | `/`, Home lit | — |
| Deep Settings then dock | gear → Profile → Name, dock Partner, back | `/`, Home lit | — |
| Back on Home | after returning to `/`, `page.goBack()` | URL is not on the app's origin (`about:blank`) | — |

</intent-contract>

## Code Map

- `src/stores/slices/navigationSlice.ts:122-195` -- `setView`: a dock pick walks `history.go(-depth)` to the first entry, makes it Home, pushes the view at `depth: 1`; `openSettingsPage` pushes with `depth+1`, `inApp`, optional `from: 'home'`. Read-only.
- `src/components/Settings/stack/SettingsStack.tsx:94-101,174-185,215-224` -- `pageAbove` (nearest ancestor with a page), reload-to-parent (`history.back()` when `inApp`, else replace), `goBack` (back when `inApp`, else replace with page above). Read-only.
- `src/components/Settings/Settings.tsx:163-302` -- `SUBPAGES`: `profile/name`, `dates/new-event` are `reloadsToParent`; `dates/event/<id>` is matched by `EVENT_PATH`, not in the table.
- `tests/e2e/settings/settings-stack.spec.ts:21-36` -- phone viewport, `historyLength`; pattern for fresh-load back (`goto` then arrow, `history.length` unchanged).
- `tests/e2e/home/home-date-entry-points.spec.ts:28-46,51-82` -- `openHome` (arms events + couple-settings reads before `goto('/')`), `cardButton(page,label)`, `homeIsLit`, seeded-event `afterEach`. Copy the local `openHome` pattern; it is file-local, not a helper.
- `tests/support/helpers/settings-screen.ts` -- `openSettingsFromHome`, `openDatesList`. `tests/support/helpers/new-date-forms.ts` -- `openNewDateForm(page,'event')`. `tests/support/helpers/navigation.ts` -- `navigateTo`. `tests/support/helpers/events.ts:73,144,185` -- `resolveOwnPair`, `seedEvent`, `isoDateDaysFromNow`.
- Test ids: `settings-profile-row`, `settings-profile-name`, `settings-dates-row`, `settings-dates-event-<id>`, `nav-<view>`, `settings-view`, `app-header`; Back is `getByRole('button', { name: 'Back' })`.

## Tasks & Acceptance

**Execution:**
- [ ] `tests/e2e/navigation/settings-navigation-rules.spec.ts` -- new spec, one `describe`, tests per the I/O matrix (group the four reloads into at most two tests; group the two pasted links; group the two back-to-Home paths with the back-on-Home check), header comment naming the epic's Notes rules it covers and the bottom-dock-only scope -- the ticket's one closing spec.

**Acceptance Criteria:**
- Given the local stack, when `npx playwright test --project=chromium tests/e2e/navigation/settings-navigation-rules.spec.ts` runs, then every test passes, and passes again with `--repeat-each=3`.
- Given the spec has run, when the row audit runs, then no seeded row is left.
- Given each matrix row, when its test runs, then it asserts the URL, the page shown (h1 or witness) and, where Home is the target, `nav-home` `aria-current="page"`.

## Implementation Notes

- Implemented by a Sonnet subagent from this plan; the diff (one new file, `tests/e2e/navigation/settings-navigation-rules.spec.ts`) read in full against the baseline.
- Five tests: two reload tests (list + date page; one-field + form page), date page from Home, pasted links, and the `[P0]` Home-is-the-bottom test (dock sideways, then deep Settings then dock, each followed by one more back that lands on `about:blank`). `openHome` is a file-local copy of `home-date-entry-points.spec.ts`'s local function, as the plan said; it is not a shared helper.
- The form-page reload uses `reloadDatesList`, which arms the Dates list read before `page.reload()`; the reload lands on the Dates list through `history.back()` and the list's mount read answers it.
- Matrix audit: all ten rows are asserted by a test that ran and passed.
- Environment: stack already running; the 2.122.0 CLI shim was put first on PATH.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: none. The quick lens checked matrix coverage, helper reuse, the reload and pasted-link history paths against `SettingsStack.tsx` and `navigationSlice.ts`, test ids, and seeding and teardown, and found nothing.

## Design Notes

"Back on Home leaves nothing behind": Playwright's page starts at `about:blank`, so `goto('/')` puts Home on the visit's first app entry. After any view's back lands on Home, one more `page.goBack()` must leave the origin — `expect(page.url()).not.toContain(new URL(baseURL).host)` or `toBe('about:blank')`. A Settings page reached sideways (Settings › Profile › Name then the dock) proves `history.go(-depth)` dropped the Settings entries.

Environment: E2E needs the local stack. The Homebrew CLI on PATH (3.0.0) rejects `config.toml`; put a scratch dir first on PATH whose `supabase` runs `~/.local/bin/supabase` (2.122.0), as stories 5.4–5.16 did. Docker is OrbStack (`orb start`). `TS2883` errors in `tests/support/merged-fixtures.ts` are the worktree baseline.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors beyond the worktree `TS2883` baseline in `merged-fixtures.ts`.
- `npm run lint` -- expected: no errors.
- `npx playwright test --project=chromium tests/e2e/navigation/settings-navigation-rules.spec.ts --repeat-each=3` (stack running, shim on PATH) -- expected: all pass.
- `npx playwright test --project=chromium tests/e2e/navigation tests/e2e/settings tests/e2e/home` -- expected: pass (neighbours unaffected).

## Auto Run Result

Status: built

**Summary:** One new E2E spec walks every Settings navigation rule from the epic's Notes, in the bottom-dock form on a phone viewport:
- a reload restores a list page and a date page, and the page above a one-field page or a form page;
- back from a date page opened from Home returns to Home, with Home lit;
- a pasted `/settings/...` link opens its page, and its back arrow goes to the page above without leaving the app;
- back from any view, whether it was reached sideways through the dock or deep in Settings, lands on Home;
- one more back on Home leaves the app (`about:blank`). Until now no E2E checked this.

No app code changed.

**Files changed:**
- `tests/e2e/navigation/settings-navigation-rules.spec.ts`: new, five tests (four `[P1]` and one `[P0]`). It seeds its own events and deletes them by id.

**Review findings:** 0. Nothing patched, deferred or rejected.

**Follow-up review recommended:** false. Patched entries: high 0, medium 0, low 0.

**Verification:**
- `npm run typecheck`: exit 0, with no errors and none of the `TS2883` baseline errors.
- `npm run lint`: exit 0.
- `npx playwright test --project=chromium tests/e2e/navigation/settings-navigation-rules.spec.ts --repeat-each=3`: 15 passed. The row audit found no leftover rows.
- `npx playwright test --project=chromium tests/e2e/navigation tests/e2e/settings tests/e2e/home`: 145 passed. The row audit found no leftover rows.

**Residual risk:**
- The ticket's "passes in CI" is not verified here: nothing was pushed, and CI is the orchestrator's to run.
- The column dock form is not exercised, because desktop Chrome cannot emulate `env()` insets. The spec's header says so, and the unit tests cover that form.
- The back-on-Home check relies on Playwright's page starting at `about:blank`, which held on every run.
