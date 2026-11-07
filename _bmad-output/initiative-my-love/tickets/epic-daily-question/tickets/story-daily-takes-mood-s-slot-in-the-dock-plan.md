---
title: 'Daily takes Mood''s slot in the dock'
type: feature
ticket: '9'
created: '2026-11-06'
status: done
baseline_revision: '9f1e3d65531a4d3417d82f4d4f1bfb209b208ed9'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The dock's second button still opens the mood screen, `/mood` and a tapped mood push open Mood or Partner, and nothing in the dock reaches Daily (R6).

**Approach:** Swap the dock's second destination to Daily (label `Daily`, lucide `Flame`, the "plain flame" of parent R9), map `/mood` to Daily in both URL ternaries and rewrite the URL to `/daily`, route `kind: 'mood'` pushes to `daily`, then delete the E2E tests whose subject is the mood screen and re-point the ones that only passed through it.

## Boundaries & Constraints

**Always:**
- `DESTINATIONS` reads Home, Daily, Love Notes, Photos, Partner; the column form still appends Settings as the sixth button.
- `/mood` on initial load and on `popstate` gives `'daily'`; the URL is rewritten to `/daily` with `history.replaceState`, keeping `history.state`.
- Keep every check a re-pointed test made, apart from the mood-screen one, or say in the commit why it narrows (AGENTS.md, L4).
- E2E fixtures come from `tests/support/merged-fixtures.ts`.

**Never:**
- Delete or edit mood code (`MoodTracker/`, `MoodHistory/`, `moodSlice`, `'mood'` in `ViewType`/`pathMap`, `navigateMood`, the `currentView === 'mood'` render arm). Epic 10 deletes them.
- Touch Partner-page mood tests (`partner-mood.spec.ts`, `partner-kit.spec.ts`, the partner-moods test in `mood-offline-copy.spec.ts`). Epic 7 rebuilds that page.
- Add a sixth dock destination, or change Home's daily message.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dock, bottom form | any signed-in view | five buttons Home, Daily, Love Notes, Photos, Partner; `nav-daily` opens `/daily` | none |
| Dock, column form | side column ≥ 44px | the same five, then Settings | none |
| Load `/mood` | fresh load | Daily view shows, `nav-daily` is `aria-current="page"`, URL is `/daily` | none |
| Back/forward onto an old `/mood` entry | popstate | Daily view shows | none |
| Mood push tapped | `{ kind: 'mood', aps: … }` | `viewForPush` gives `'daily'` | junk payloads still give null |

</intent-contract>

## Code Map

- `src/components/Navigation/AppNavigation.tsx:52-91` -- import `Flame` (drop `FaceSlightlySmiling` if unused); `DESTINATIONS[1]` becomes `{ view: 'daily', label: 'Daily', Icon: Flame }`. Update comments that list the icons or "Home, Mood, …" (`:74-78`, `:155-158`).
- `src/App.tsx:211-250` -- both ternaries: `/mood` → `'daily'`, plus the `/daily` rewrite. `:1010` mood render arm stays.
- `src/services/pushNotifications.ts:154-164` -- `VIEW_FOR_KIND.mood: 'daily'`; fix the module doc at `:42` if it names the mapping.
- `src/services/__tests__/pushNotifications.delivered.test.ts:391-425` -- `['mood','daily']`; "a known kind wins over the thread id" now expects `'daily'`.
- `src/components/Navigation/__tests__/AppNavigation.test.tsx:171,297,321` -- labels and testids for Daily, order in both forms.
- `tests/support/helpers/navigation.ts` -- `NavDestination`: replace `'mood'` with `'daily'` so a missed caller fails the typecheck; refresh the doc comment.
- `tests/support/helpers/reads.ts` -- `DAILY_DAY_READ` (story 12) for the reads a re-pointed spec waits on.
- Daily testids: `daily-question-view` (root, rendered in every state), `daily-question`, `daily-loading`. App-wide offline banner: `network-status-banner` (`NetworkStatusIndicator`, App.tsx:900).
- Delete: `tests/e2e/mood/mood-tracker.spec.ts`, `tests/e2e/mood/mood-kit.spec.ts`, `tests/e2e/partner/partner-mood-realtime.spec.ts`, the `[P1] … earlier server moods in the calendar` test in `tests/e2e/offline/mood-offline-copy.spec.ts:104-185`, with helpers and imports only it used.
- Re-point to Daily: `tests/e2e/navigation/dock.spec.ts:23-41,125,220,243-244`, `dock-walk.spec.ts:42-43`, `routing.spec.ts:31-60,92-93` (the direct-URL test loads `/mood` and expects Daily, `nav-daily` current, URL `/daily`), `settings-stack.spec.ts:226-227`, `settings-navigation-rules.spec.ts:239-240`, `theme-sweep.spec.ts:80-88` (screen `daily`, read `DAILY_DAY_READ`, ready on `daily-question`), `events-load-recovery.spec.ts:143-144` (Daily never calls `loadEvents`), `events-offline-copy.spec.ts:98-99,115-116`, `network-status.spec.ts` (open `/daily`, assert `network-status-banner` appears offline and goes after reconnect, in place of `mood-sync-status`).
- `tests/e2e/home/persisted-events-strip.spec.ts:162-203` -- its moods half checks the mood screen. Keep the events half; replace the mood-screen checks with a store check that no `moods` entry carries `staleMood.note`; retitle; record the narrowing in the commit.
- Keep unchanged: `tests/e2e/account-data/account-data.spec.ts:267` -- it reaches the mood form through `setView('mood')` in the store, not a route, and the form stays until epic 10. Also unchanged: unit tests using `'mood'` as a generic view (`navigationSlice.*.test.ts`, `SettingsStack.test.tsx:591-644`, `basePath.test.ts`).

## Tasks & Acceptance

**Execution:**
- [x] `src/components/Navigation/AppNavigation.tsx` -- Daily in slot two -- R6.
- [x] `src/App.tsx` -- `/mood` → Daily in both ternaries, URL rewritten to `/daily` -- R6.
- [x] `src/services/pushNotifications.ts` + its delivered test -- mood push → `daily` -- R6.
- [x] `src/components/Navigation/__tests__/AppNavigation.test.tsx` -- both forms read the five in order, Daily included.
- [x] `tests/support/helpers/navigation.ts` -- `'daily'` replaces `'mood'`.
- [x] Deletions and re-points in the Code Map's E2E list.
- [x] `_bmad-output/initiative-my-love/deferred-work.md` -- record any finding deferred during the build.

**Acceptance Criteria:**
- Given a signed-in worker on a phone viewport, when the dock renders, then its buttons read Home, Daily, Love Notes, Photos, Partner, and tapping Daily shows `daily-question-view` at `/daily`.
- Given the column form (unit test), when the dock renders, then it reads Home, Daily, Love Notes, Photos, Partner, Settings.
- Given a signed-in worker, when `/mood` is loaded, then `daily-question-view` shows, `nav-daily` has `aria-current="page"`, the URL ends `/daily`, and `mood-tracker` is absent.
- Given a payload `{ kind: 'mood' }`, when `viewForPush` reads it, then it answers `'daily'`.
- Given the repository, when `grep -rln "mood-tracker\|goto('/mood')" tests/e2e` runs, then only specs that expect Daily at `/mood` or reach the form through the store (`account-data.spec.ts`) remain.
- Given a local stack, when the full E2E suite runs, then it passes.

## Implementation Notes

- Built as planned by the implementing subagent. `/mood` is redirected by a local `redirectMoodRoute` in `App.tsx`, called after `setView` in both the initial load and `popstate`; it keeps `history.state`, the search and the hash.
- `theme-sweep.spec.ts`: `ScreenRead` gained an optional `method`, because `get_daily_day` is an RPC (POST). It is armed before the cold start, because the signed-in start's refresher sends that read.
- `network-status.spec.ts` now asserts the app-wide `network-status-banner` and `network-status-label`, since `mood-sync-status` lived on the mood screen.
- `persisted-events-strip.spec.ts`: the title is kept, since it still holds (the store check covers the moods half). This narrows the check: the mood screen's note field and "Selected: Sad" summary are no longer checked, as no route reaches that screen.
- Also changed, though the plan did not list it: `README.md` pointed its single-file example at the deleted `mood-tracker.spec.ts`; it now names `dock.spec.ts`. The describe in `mood-offline-copy.spec.ts` is retitled "Partner moods offline".
- Added by the parent after reading the diff: `routing.spec.ts` "[P1] should open Daily on back to a /mood entry left from before Daily", which covers the matrix's popstate row.
- Verification, this session: typecheck and lint clean (no TS2883), `test:unit` 247 files / 4566 tests passed. Playwright ran on every project, with every spec file named except `tests/e2e/auth/token-persistence-overlap.spec.ts`: 370 passed. Nine `api` failures were 503s from `/functions/v1/…`, because the shared stack had no Edge Functions service running. With `supabase functions serve` started for the rerun, `--project=api` passed 86 of 86, and the service was then stopped.
- `token-persistence-overlap.spec.ts` cannot load in a loop worktree: at load time it reads `node_modules/<pkg>/package.json` from the repo root, and the worktree has no `node_modules` folder (it resolves packages from the main checkout). This is an environment limit. The spec does not touch the dock or `/mood`.

## Plan Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 9 findings — high 0, medium 1, low 7, false 1, maybe-false 0
- findings:
  - `[medium]` `[patch]` three test helpers lost their last importers, and CI's `npx knip` (test.yml lint job) fails on them — `npx knip` reported two: `partnerLatestMoodRead` (reads.ts) and `clockAnchorAvoidingFirstOfMonth` (events.ts). `ownMoodHistoryRead` is still imported by `account-data.spec.ts:8`, so that part is false. Both functions were deleted, and Knip now reports nothing.
  - `[low]` `[patch]` no E2E checks the dock's labels or their order on a signed-in phone viewport (first AC) — `dock.spec.ts` "should show the dock and the gear" now also asserts the five `nav-*` buttons' `aria-label`s in DOM order (`DOCK_LABELS`).
  - `[false]` `[reject]` `persisted-events-strip` was not retitled — the title "leaks neither the events nor the moods" is still true: the test asserts the event label is absent and that no store `moods` entry carries the stale note. A title that holds misleads no one.
  - `[low]` `[patch]` the clock comment in `persisted-events-strip.spec.ts` gives a reason that no longer applies — rewritten: the mood is dated at the anchor, and the store check filters by note alone.
  - `[low]` `[patch]` the narrowed checks (`persisted-events-strip`'s note field and "Selected: Sad", `network-status`'s "Online" label) were explained only in the plan and code comments (AGENTS.md L4) — the commit message names both narrowings and says why.
  - `[low]` `[reject]` deleting `partner-mood-realtime.spec.ts` drops the Partner page's only browser test of live mood delivery, with no ledger entry — the intent orders this deletion by name. After this change no route reaches the mood form, so the app has no sender for that path; epic 7 rebuilds the Partner page and epic 10 deletes the mood code. A ledger entry would track a path nothing in the app can now exercise.
  - `[low]` `[patch]` the `AppNavigation.tsx:155` comment said Daily's level-1 heading names the view, but it is the question text, or nothing while loading — reworded: Notes, Partner and Settings name themselves, and Daily's level-1 heading is its question. The reason about ambiguous queries is kept.
  - `[low]` `[patch]` `settings-navigation-rules.spec.ts:252` comment still said "Home, not Notes or Mood" — now reads "Daily".
  - `[low]` `[patch]` the `navigation.ts` doc comment said `NavDestination` matches `ViewType`, though `ViewType` still has `'mood'` — now reads "a subset of ViewType".

## Design Notes

- Why rewrite the URL: without it a `/mood` load leaves `/mood` in the bar, and the next Daily tap compares `/mood` with `/daily` and stacks a second entry (`setView`, navigationSlice.ts:184-230). The architecture calls this a redirect.
- `persisted-events-strip`: the stale moods key is still covered at the store level by the next test ("one load clears both stale keys"); only the mood-screen half goes, because no route reaches that screen.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors other than the worktree's known TS2883 in `tests/support/merged-fixtures.ts`.
- `npm run lint` -- expected: exit 0.
- `npx vitest run src/components/Navigation src/services/__tests__/pushNotifications.delivered.test.ts tests/unit/utils/basePath.test.ts` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `supabase start` (CLI from `.mise.toml`), then `npx playwright test tests/e2e/navigation tests/e2e/offline tests/e2e/settings tests/e2e/home tests/e2e/daily --project=chromium` -- expected: all pass.
- `npx playwright test` (the full suite, every project) -- expected: all pass.

## Auto Run Result

Status: built

**Summary:** Daily took Mood's slot in the dock: the dock reads Home, Daily (lucide `Flame`), Love Notes, Photos, Partner, with Settings added in the column form. A `/mood` load, or back/forward onto an old `/mood` entry, opens Daily and rewrites the address to `/daily`, keeping `history.state`. A tapped mood push opens Daily. E2E tests whose subject was the mood screen are deleted. Tests that only passed through it now go to Daily. Mood code is untouched (epic 10).

**Files changed:**
- `src/components/Navigation/AppNavigation.tsx` -- Daily in slot two; comments updated.
- `src/App.tsx` -- `/mood` → `'daily'` in both ternaries; `redirectMoodRoute` rewrites the URL.
- `src/services/pushNotifications.ts` -- `VIEW_FOR_KIND.mood = 'daily'`.
- `src/components/Navigation/__tests__/AppNavigation.test.tsx`, `src/services/__tests__/pushNotifications.delivered.test.ts` -- Daily labels and order; mood push → daily.
- `tests/support/helpers/navigation.ts` -- `NavDestination` has `'daily'` in place of `'mood'`.
- `tests/support/helpers/reads.ts`, `tests/support/helpers/events.ts` -- removed the now-unused `partnerLatestMoodRead` and `clockAnchorAvoidingFirstOfMonth`.
- Deleted `tests/e2e/mood/mood-tracker.spec.ts`, `tests/e2e/mood/mood-kit.spec.ts`, `tests/e2e/partner/partner-mood-realtime.spec.ts`, and the calendar test in `tests/e2e/offline/mood-offline-copy.spec.ts` (with its helpers).
- Re-pointed to Daily: `dock`, `dock-walk`, `routing` (plus a new popstate test), `settings-stack`, `settings-navigation-rules`, `theme-sweep` (an optional `method` on `ScreenRead`), `events-load-recovery`, `events-offline-copy`, `network-status` (the app-wide banner). `persisted-events-strip` checks the store in place of the mood screen.
- `README.md` -- its single-file example no longer names a deleted spec.

**Review:** quick lens, 9 findings. Patched: 1 medium, 6 low (Knip-unused helpers; E2E dock label and order check; four stale comments), plus 1 low met in the commit message (the narrowed checks). Rejected: 1 false (the test title is still accurate) and 1 low (the live partner-mood E2E covered a send path no route reaches now; the intent orders its deletion). Nothing deferred. Follow-up review recommended: false (patched: high 0, medium 1, low 6).

**Verification:**
- Typecheck and lint are clean, Knip reports nothing, and `test:unit` passed 247 files / 4566 tests.
- Playwright, every project, with every spec file named except `tests/e2e/auth/token-persistence-overlap.spec.ts`, and Edge Functions served for the run:
  - 388 passed and 3 failed after the patches. The 3 failures were `events-history-pagination.spec.ts`, failing in its `coupleEvents` fixture setup with "fetch failed" from the admin client.
  - That file passed 10 of 10 when rerun alone, and passed in the pre-patch full run. The change does not touch it.
- Before the patches: 370 chromium and integration tests passed, and `--project=api` passed 86 of 86 with Edge Functions up. Without them, 9 `api` tests failed with 503, a missing service.

**Residual risks:**
- `token-persistence-overlap.spec.ts` was not run. It cannot load in a loop worktree, which has no `node_modules` folder for its load-time version read. It does not touch the dock or `/mood`.
- The one-off "fetch failed" in `events-history-pagination` came from the shared local stack. It may have been caused by starting the Edge Functions service mid-run; this was not confirmed.
- Users can no longer log a mood anywhere in the app. The intent (R6) asks for this; the Partner page still shows partner moods until epic 7.
