---
title: 'See all opens every past question with the running count'
type: feature
ticket: '8'
created: '2026-11-07'
status: done
baseline_revision: 'fafcb8fa56c9bfef9f61051220ddd3721428dc84'
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
deferred:
  - summary: >-
      After an in-session relink to a different partner whose first history page is full, the history merge keeps the previous pair's older rows below it and shows them under the new partner's name.
    evidence: |-
      loadDailyHistory's full-page branch keeps loaded rows older than the new page's oldest day (dailyQuestionSlice.ts), and nothing resets dailyHistory on a partner change, only signedOutState(). Needs an in-session relink (the app has no unlink action) to a pair that already has 30+ done days; a new pair's first page is short and replaces everything. Fix: reset or key the history on the partner id; extends story 7's deferred relink finding, whose natural home is story 9.
    location: >-
      src/stores/slices/dailyQuestionSlice.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** The Partner page's Past questions card shows only the three newest days and has no way to see the rest or how often the couple picked the same (R7).

**Approach:** A See all link on the card pushes `/partner/history`, a page of the Partner view (not a new `ViewType`): its own bar with a back arrow in place of the app header, "Past questions", "Same pick on {same} of your {done} days" from the streak, and every done day newest first, paging `get_daily_history` 30 at a time as the list nears its end.

## Boundaries & Constraints

**Always:**
- Navigation (`navigationSlice.ts`): `partnerPath: string` (`''` top, `'history'`), `isPartnerRoute(routePath)` true for exactly `/partner` and `/partner/history`, `partnerPathFromRoute(routePath)` (`'history'` for `/partner/history`, else `''`), `openPartnerPage(path)` pushes one entry `{ view: 'partner', partnerPath, inApp: true, depth: historyDepth() + 1 }` at `withBasePath('/partner/history')` and sets `currentView: 'partner'`, `showPartnerPage(path)` sets it without history; `setView` without `skipHistory` resets `partnerPath` to `''` (as it does `settingsPath`). Slice header documents it.
- `App.tsx`: both ternaries use `isPartnerRoute(routePath) ? 'partner'`; both call `showPartnerPage(partnerPathFromRoute(routePath))` beside `showSettingsPage`; the offline banner is skipped when `currentView === 'partner' && partnerPath !== ''` (the page renders its own under its bar); `AppNavigation` gets `hasOwnBar` for that case and hides its header then, as it does for Settings. The dock still lights Partner (`currentView` is `partner`).
- Back (arrow): `history.state?.inApp === true` → `history.back()`; else `replaceState` to `/partner` keeping `inApp` and `depth` as `replaceSettingsRoute` does, then `showPartnerPage('')`. Browser back / the shell's swipe go through the `popstate` handler unchanged.
- No partner confirmed (not loading, no load error) while `partnerPath === 'history'`: replace the entry with `/partner` and show the top page. Loading and load-error states render as on the top page.
- Slice (`dailyQuestionSlice.ts`): `DAILY_HISTORY_PAGE_SIZE = 30` exported from `dailyQuestionApi.ts`; new `dailyHistoryEnd: boolean` (the oldest page was read) and `dailyHistoryLoadingMore: boolean`; `loadMoreDailyHistory()` — no-op unless signed in, `dailyHistory` non-empty, not `dailyHistoryEnd`, not already loading more; reads `fetchDailyHistory(oldest.day)`; after the await re-checks `{ userId, authSessionVersion }` and that the list's oldest `day` is still the one it asked before, else writes nothing; appends rows whose `day_id` is not already present; `dailyHistoryEnd` = page shorter than 30; failure keeps rows, sets `dailyHistoryError`, never throws, offline not logged. `loadDailyHistory` now merges (story 7 Design Note): a full first page keeps loaded rows older than its oldest day (and `dailyHistoryEnd` as is); a short page replaces all and sets `dailyHistoryEnd: true`. Both new fields in `signedOutState()` in the same commit; slice header updated.
- Page `src/components/PartnerView/PastQuestionsPage.tsx` from the board: own sticky bar (`safe-top`, z-30, glass reaching under the side column like `SettingsBar`), back button 44px `ChevronLeft`, `aria-label="Back to {partner name}"`, test id `partner-history-back`; then `NetworkStatusIndicator showOnlyWhenOffline`; h1 "Past questions" (serif 30px, `partner-history-title`); summary `partner-history-summary` "Same pick on {same} of your {done} days" (`day` when done is 1), shown only with an `ok` streak; card of rows (`partner-history-row`, `data-same`) of days with `state === 'both'` and both choices: `{this} or {that}?` (15px semibold, `partner-history-question`), date (12px `text-muted`, `partner-history-date`, `Wed, Nov 4`, plus `, 2025` outside the current year, parsed with `parseEventDate`), chips "You: {my option}" `bg-tint text-accent` (`partner-history-mine`) and "{partner}: {option}" `bg-ptint text-partner` (`partner-history-theirs`), mark Same (lucide `Check` 14px, `text-good`) or Different (`text-muted`) at the end (`partner-history-mark`). A sentinel after the last row observed by `IntersectionObserver` (`rootMargin: '0px 0px 600px 0px'`) calls `loadMoreDailyHistory()`; skip the observer when `IntersectionObserver` is undefined. Scrolls to top on mount. Kit tokens only. The page sits inside `<main>`, so it inherits `--dock-clearance` and `--dock-left`/`--dock-right`; add nothing that overrides them.
- `PastQuestionsCard.tsx`: label row gets a right-aligned "See all" button (13px semibold `text-accent`, `min-h-11`, test id `partner-past-questions-see-all`) calling `openPartnerPage('history')`; header comment updated.
- `PartnerView.tsx`: with a partner and `partnerPath === 'history'`, render `PastQuestionsPage` instead of the name/streak/card; the existing load effect, listener and states stay shared.

**Never:** a new `ViewType`, a sixth registration place or react-router; a local copy or offline rows (story 9); client-computed Same/Different (use `same`) or counts (use the streak's `same`/`done`); touching SQL, migrations or `database.types.ts`; `@/` in `src/`; `prettier --write`; linking, unlinking or resetting pool pairs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| first page then more | 35 done days | 30 rows; nearing end loads 5 more; end reached, no further read | — |
| more while busy / at end | loading more, or `dailyHistoryEnd` | no request | — |
| re-read after paging | 35 loaded, first page re-read lands (30) | 35 rows kept, newest replaced | — |
| re-read short | 35 loaded, re-read answers 3 | 3 rows, end true | — |
| stale more | first page replaced the tail during a more | appended nothing | — |
| session change | sign-out during more | nothing written | — |
| failed more | fetch throws | rows stay, error set | logged unless offline |
| push | See all tapped | URL `/partner/history`, one entry added, page shown, Partner lit | — |
| back in-app | arrow or browser back | `/partner`, top page | — |
| fresh load back | reload on `/partner/history`, arrow | entry replaced with `/partner`, history length unchanged | — |
| unlinked on history | no partner | entry replaced with `/partner`, Connect UI | — |
| dock tap | Partner tapped on history page | `/partner` top page | — |
| sign-out | fields set | `dailyHistoryEnd` false, `dailyHistoryLoadingMore` false | — |

</intent-contract>

## Code Map

- `src/stores/slices/navigationSlice.ts` -- `pathMap`, `settingsRoute`/`settingsPathFromRoute` (template for the partner helpers), `historyDepth`, `setView` l.~150 (resets `settingsPath`), `openSettingsPage`/`showSettingsPage` (templates).
- `src/App.tsx` l.209-272 -- both ternaries and `popstate`; l.~898 `AppNavigation`, l.912 offline banner; l.1024 `PartnerView`.
- `src/components/Navigation/AppNavigation.tsx` l.115-190 -- `isSettings` hides the header; add `hasOwnBar` prop.
- `src/components/Settings/stack/SettingsStack.tsx` l.97-116 `replaceSettingsRoute`, l.213-222 `goBack` -- template for the partner back; do not edit.
- `src/components/Settings/stack/SettingsBar.tsx` -- glass/safe-top/`-left-(--dock-left)` pattern to copy (not import: its test ids are Settings').
- `src/stores/slices/dailyQuestionSlice.ts` -- header l.71-78, interface l.160-168, `historySeq` l.286, `loadDailyHistory` l.411-437.
- `src/api/dailyQuestionApi.ts` -- `fetchDailyHistory(before?)` exists (story 7); add the page-size export.
- `src/stores/slices/authSlice.ts` l.266-268 -- `signedOutState()` history fields.
- `src/components/PartnerView/PartnerView.tsx`, `PastQuestionsCard.tsx`, `StreakCard.tsx` (streak shape: `same`, `done`).
- `src/services/eventsService.ts` `parseEventDate`.
- Board, read-only: `/private/tmp/claude-501/-Users-sallvain-Projects-My-Love--bmad-loop-runs-20261107-005314-0f5a-worktrees-7-8/9b22daec-c2fe-42b5-b04f-2a117e1a8d33/scratchpad/artifact-files/405608b9-ae3b-49c9-b66c-dfd4b1cafcae/project/History.dc.html` (`.row`, `.p.you` → `bg-tint text-accent`, `.p.them` → `bg-ptint text-partner`, `#15803d` → `text-good`, `#f1e6ec` → `border-line`).
- Unit homes: `tests/unit/stores/dailyHistorySlice.test.ts` (add paging/merge cases), `tests/unit/stores/navigationSlice.settingsStack.test.ts` (style for a new `navigationSlice.partnerPage.test.ts`), `src/components/PartnerView/__tests__/` (`PartnerView.test.tsx` `makeState`, `PastQuestionsCard.test.tsx`, new `PastQuestionsPage.test.tsx`), `src/components/Navigation/__tests__/AppNavigation.test.tsx` (mocks `useSideColumn`), `signOutClearsAccountState.test.ts`.
- E2E: `tests/e2e/partner/partner-past-questions.spec.ts` (story 7, pattern), `seedPairDays`/`clearPairDays`/`readPairQuestionsByDay` in `tests/support/factories/daily-question.ts`, `DAILY_HISTORY_READ`/`COUPLE_STREAK_READ` in `tests/support/helpers/reads.ts`. Column form: Chromium CDP `Emulation.setSafeAreaInsetsOverride({ insets: { left: 84, right: 0, top: 0, bottom: 0 } })` on `page.context().newCDPSession(page)` gives `env(safe-area-inset-left)` 84px (verified in planning); only the `chromium` project runs `tests/e2e`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/stores/slices/navigationSlice.ts`, `src/App.tsx`, `src/components/Navigation/AppNavigation.tsx` -- partner page state, routes, header hiding.
- [ ] `src/api/dailyQuestionApi.ts`, `src/stores/slices/dailyQuestionSlice.ts`, `src/stores/slices/authSlice.ts` -- page size, merge, `loadMoreDailyHistory`, sign-out.
- [ ] `src/components/PartnerView/PastQuestionsPage.tsx` (new), `PastQuestionsCard.tsx`, `PartnerView.tsx`.
- [ ] Unit tests -- every matrix row: slice rows in `dailyHistorySlice.test.ts`; navigation helpers and push/show/reset in a new `tests/unit/stores/navigationSlice.partnerPage.test.ts`; page render, summary, chips, date, sentinel calling `loadMoreDailyHistory`, back in-app vs fresh, unlinked replace in `PastQuestionsPage.test.tsx`/`PartnerView.test.tsx`; See all in `PastQuestionsCard.test.tsx`; `hasOwnBar` hides the header in `AppNavigation.test.tsx`; sign-out fields.
- [ ] `tests/e2e/partner/partner-history.spec.ts` (new) -- the ACs below.

**Acceptance Criteria:**
- Given 35 seeded done days (daysAgo 1-35) on the worker's pair, when the worker opens Partner and taps See all, then the URL is `/partner/history`, the summary reads "Same pick on 35 of your 35 days", 30 rows show newest first with the seeded questions, and scrolling to the end shows all 35.
- Given the history page opened from Partner, when the back arrow is tapped, then `/partner` shows the streak card; and when See all then browser back, the same.
- Given `/partner/history` reloaded, then the page still shows with Partner `aria-current="page"`, and its back arrow lands on `/partner` without leaving the app.
- Given the column form (CDP inset left 84), when the history page shows, then the dock has `data-form="column"` and Partner is `aria-current="page"`; the same in the bottom form.

## Implementation Notes

- `replaceWithPartnerTop()` exported from `navigationSlice.ts` (not named in the plan): rewrites the entry to `/partner` keeping `inApp` and `depth`; the back arrow's fresh-load path and the unlinked redirect both use it.
- `PartnerView`'s unlinked redirect waits until it has seen `isLoadingPartner` go true (a ref): the first render has no partner and no loading flag yet, so without it a reload on `/partner/history` bounced to `/partner`. Pinned by a unit test.
- `App.tsx` hides the header (`hasOwnBar`) only while the history page is on screen (`partnerPath !== ''`, a partner, not loading), so the loading block and the load error keep the app header and the dock (added after the subagent's pass).
- After a failed "more", the sentinel retries only when the rows change or it re-enters view, so a failing request cannot loop.
- Column form in E2E: CDP `Emulation.setSafeAreaInsetsOverride` (left 84) gives `data-form="column"`; earlier specs said a desktop browser could not emulate it.
- Unit: new `navigationSlice.partnerPage.test.ts`, `PastQuestionsPage.test.tsx`; cases added in `dailyHistorySlice.test.ts` (incl. "no request once the oldest page was read"), `PartnerView.test.tsx`, `PastQuestionsCard.test.tsx`, `AppNavigation.test.tsx`, `signOutClearsAccountState.test.ts`. E2E: new `tests/e2e/partner/partner-history.spec.ts` (5 tests).

## Plan Change Log

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 4, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `PartnerView.tsx`: the unlinked redirect never fires when the view mounted with a partner (loadPartner raises `isLoadingPartner` only when partner is null, `partnerSlice.ts:165`), so a refresh answering unlinked leaves `/partner/history` on the Connect UI. Fixed: a seen partner also sets `sawLoading`; unit test added.
  - `[low]` `[patch]` `PartnerView.tsx`: on an app-created entry the redirect replaced it with `/partner`, leaving two identical entries (AGENTS.md's Settings trap). Fixed: `history.back()` when `inApp`, replace only on a fresh load; tests updated.
  - `[low]` `[patch]` `PastQuestionsPage.tsx`: a "more" refused offline was never retried after reconnecting while the sentinel stayed in view (effect deps unchanged). Fixed: the online flag joins the sentinel effect's deps; unit test added.
  - `[low]` `[patch]` `dailyQuestionSlice.ts`: a full first page kept `dailyHistoryEnd` true from an earlier `[]` read (unlinked, then linked), so paging never started. Fixed: End resets to false when no older rows are kept; unit test added. The same finding's cross-pair part (an older pair's rows kept after an in-session relink) is real but rare and needs a partner-keyed reset: deferred.

## Design Notes

- The design's page has no app header (only a back arrow where it sits), as Settings has none; hence `hasOwnBar` and the page's own offline banner.
- Merge rule keeps paging stable when `daily_pick`/`SUBSCRIBED` re-read the first page mid-scroll; the tail check makes a stale "more" harmless instead of needing another sequence counter.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (or only the worktree TS2883 baseline).
- `npm run lint` -- expected: exit 0.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/partner tests/e2e/navigation` -- expected: pass on the local stack.
- `npx playwright test tests/e2e/partner/partner-history.spec.ts --repeat-each=3` -- expected: all pass.

## Auto Run Result

Status: built

**Summary:** Story 7.8: See all on the Partner page's Past questions card pushes `/partner/history`. It is a page of the Partner view: `navigationSlice.partnerPath`, not a new view, so the dock keeps Partner lit in both forms. The page has its own bar with a back arrow in place of the app header, plus "Past questions", "Same pick on {same} of your {done} days" from the streak, and every done day newest first, each with its date, "You: …", "{partner}: …" and Same or Different. Pages of `get_daily_history` load 30 at a time as a sentinel nears view. The back arrow goes back one entry when the app created it, and on a fresh load it replaces the entry with `/partner`. Browser back and reload work through the App's route ternaries. `loadDailyHistory` now merges a first-page re-read with the pages loaded below it, as story 7's Design Note asked.

**Files changed:**
- `src/stores/slices/navigationSlice.ts`: `partnerPath`, `isPartnerRoute`, `partnerPathFromRoute`, `openPartnerPage`, `showPartnerPage`, `replaceWithPartnerTop`; `setView` resets the page.
- `src/App.tsx`: both ternaries open `/partner/history` as partner; `showPartnerPage` on load and popstate; header and offline banner give way while the page is on screen.
- `src/components/Navigation/AppNavigation.tsx`: `hasOwnBar` hides the header.
- `src/api/dailyQuestionApi.ts`: `DAILY_HISTORY_PAGE_SIZE`.
- `src/stores/slices/dailyQuestionSlice.ts`, `src/stores/slices/authSlice.ts`: merge, `loadMoreDailyHistory`, `dailyHistoryEnd`, `dailyHistoryLoadingMore`, sign-out reset.
- `src/components/PartnerView/PastQuestionsPage.tsx` (new), `PastQuestionsCard.tsx` (See all), `PartnerView.tsx` (renders the page, unlinked redirect).
- Unit: `navigationSlice.partnerPage.test.ts` (new), `PastQuestionsPage.test.tsx` (new), `dailyHistorySlice.test.ts`, `PartnerView.test.tsx`, `PastQuestionsCard.test.tsx`, `AppNavigation.test.tsx`, `signOutClearsAccountState.test.ts`.
- E2E: `tests/e2e/partner/partner-history.spec.ts` (new; column form through CDP `Emulation.setSafeAreaInsetsOverride`).

**Review (quick, pinned; lens: quick):** 4 findings, all low. Patched 4. Deferred 1 (the cross-pair part of the fourth finding: an older pair's rows kept after an in-session relink). Rejected: none.

**Follow-up review recommended: false.** First pass; patched counts by verdict: high 0, medium 0, low 4.

**Verification (after the patches):**
- `npm run typecheck`: exit 0. `npm run lint`: exit 0.
- `npm run test:unit`: 260 files, 4875 tests, 0 failures.
- `npx playwright test tests/e2e/partner tests/e2e/navigation`: 60 passed, row audit clean.
- `npx playwright test tests/e2e/partner/partner-history.spec.ts --repeat-each=3`: 15 passed.
- Matrix audit: every row covered by a test that ran and passed (slice rows in `dailyHistorySlice.test.ts`, navigation rows in `navigationSlice.partnerPage.test.ts`, page/redirect rows in `PastQuestionsPage.test.tsx`/`PartnerView.test.tsx`, push/back/reload in the E2E).

**Residual risks:**
- The page's look in dark mode and on the iPhone Duo was not compared visually against the board; UNVERIFIED. The CDP column check proves the dock form and the highlight, not the layout.
- A failed first history read shows the title and summary with no rows and no error message (as story 7's card hides); offline rows are story 9.
- The deferred cross-pair rows case above.

