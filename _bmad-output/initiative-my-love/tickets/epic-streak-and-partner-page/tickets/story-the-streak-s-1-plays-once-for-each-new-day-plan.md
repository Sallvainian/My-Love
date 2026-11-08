---
title: "The streak's +1 plays once for each new day"
type: feature
ticket: '5'
created: '2026-11-07'
status: done
baseline_revision: 'bd148702810bf975e83a0a132750b9419080de66'
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
      A failed IndexedDB read of daily-celebrated is taken as "nothing stored", so the claim re-seeds over a good stored value.
    evidence: |-
      readCelebrated returns null both when nothing is stored and when readLocalCopy (src/services/localCopy.ts:97-105) catches a read error. claimCelebration treats null as absent and writes { held: streak.held, milestones: streak.milestones }, so one transient read failure silently drops that held total's +1 and replaces milestones with the server's count, which story 6 would then read as milestone screens already shown. Rare but real (an IndexedDB read failing while the write after it succeeds); the fix needs a read that tells "absent" from "failed", a new branch in the localCopy API rather than a direct correction. Story 6, which starts reading milestones, is the natural place to add it.
    location: >-
      src/services/dailyCelebrated.ts (claimCelebration)
    severity: low
---

<intent-contract>

## Intent

**Problem:** When the couple's held total goes up, nothing on Daily celebrates it; R4 wants the design's "Streak goes up by one" screen once per device per new day.

**Approach:** A device-state local-copy kind `daily-celebrated { held, milestones }` remembers the held total this device last celebrated. Whenever Daily shows an `ok` streak, it claims a celebration: under a lock, nothing stored seeds it silently; a held above the stored one writes the new held and plays a full-screen +1 overlay. The Partner page never claims.

## Boundaries & Constraints

**Always:**
- New `src/services/dailyCelebrated.ts` (template `dailyWriteDeclined.ts`): `DAILY_CELEBRATED_KIND = 'daily-celebrated'`; zod-checked `{ held, milestones }` (non-negative integers; malformed reads as absent); `readCelebrated(userId)`; `claimCelebration(userId, streak, isCurrent)` under new `DAILY_CELEBRATED_LOCK` (`syncLock.ts`, `withWaitingLock`): stored null → write `{ held, milestones }` from the streak, return `{ play: false }`; `streak.held > stored.held` → write `{ held: streak.held, milestones: stored.milestones }` (story 6 owns milestones), return `{ play: true, previous: stored }`; else `{ play: false }`. Writes only while `isCurrent()`; a write failure throws. No `registerLocalCopy` (no server source).
- Slice action `claimStreakCelebration(streak): Promise<CelebrationClaim>` in `dailyQuestionSlice.ts`: captures `{ userId, authSessionVersion }`, passes `isCurrent`, never throws (logs, returns `{ play: false }`), returns `{ play: false }` with no user. No new slice state, so no `signedOutState()` field.
- `DailyQuestion.tsx`: an effect on `[streak, sessionKey]` claims for each `ok` streak shown (saved or fresh). Not cancelled by a re-render, only by unmount (a ref), since the claim has already written. A `play` sets `celebration = { session: sessionKey, streak }`; it shows only while `session === sessionKey`.
- Overlay `StreakUp.tsx` in `src/components/DailyQuestion/` from the mock-up's StreakUp board: `fixed inset-0 z-100 bg-page`, its content and button padded by all four `env(safe-area-inset-*)` (`calc(1rem+env(...))`, as `kitClasses.ts` `DIALOG_SCRIM`), `role="dialog" aria-modal="true"`, test id `daily-streak-up`. Contents: a ring and the plain lucide `Flame` going from grey (`bg-ash-tint`/`text-ash-ink`) to orange (`bg-fire-tint`, flame `text-fire` filled) with a bounce; held rolling from `held - 1` to `held` (`daily-streak-up-held` holds the new number) with a `+1` badge (`daily-streak-up-plus`); "day streak" under it; `StreakWeek` (prefix `daily-streak-up`) whose newest `done` entry fills in; the message `daily-streak-up-message` "You and {partner} both answered." then "{run} days in a row!" ("1 day in a row!" when run is 1). Button `daily-streak-up-continue`: "See {partner}'s pick" when the snapshot on screen is `both`, else "Continue"; it closes the overlay (stored already written), which reveals the card.
- Motion through `motion/react` (`m`, `useReducedMotion`, as `UpdateToast.tsx`); one play, about 1.5 s, no loop. Under Reduce Motion render the end state with plain elements and no `m.*` component (new held, `+1` shown, today filled, message shown).
- `StreakWeek.tsx` gains optional `fillDay?: string` and `reduceMotion?: boolean`: that day's dot scales/fades in; Partner and Daily callers unchanged.
- While the overlay shows, `WriteQuestionSheet` waits (`showWriteSheet && !celebrationShown`).
- `localCopy.ts` header FILL SOURCES names both device-state kinds (`daily-write-declined`, `daily-celebrated`); `DailyQuestion.tsx` and slice headers describe the claim. Sign-out deletes the kind through the existing `deleteAccountCopies`.
- E2E on the worker pair with `clearPairDays` before and deferred at teardown; picks through the UI; second context per `daily-streak.spec.ts`.

**Never:** play on a Realtime event alone (only the held comparison); claim from the Partner page or any view but Daily; compute held/run on the client; write `daily-celebrated` anywhere but `claimCelebration`; touch milestones beyond seeding (story 6); the flaming heart or milestone screen; edit `database.types.ts`; add a migration; `@/` in `src/`; `prettier --write`; link, unlink or reset pool pairs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| first read | nothing stored, held 4 | stored `{4, milestones}`; no overlay | — |
| equal | stored 4, held 4 | no write, no overlay | — |
| up | stored 4, held 5 | stored `{5, stored.milestones}`; overlay rolls 4→5 | — |
| lower | stored 6, held 5 | no write, no overlay | — |
| two claims at once | stored 4, held 5, two tabs/effects | exactly one `play: true` | lock serialises |
| malformed stored | value not `{held,milestones}` | treated as absent: seed, no play | — |
| session changed | sign-out mid-claim | no write; `play: false` | — |
| write fails | IndexedDB put throws | no overlay; logged | slice returns `play: false` |
| Reduce Motion | up, reduced | end state, no `m.*` element | — |
| run 1 | run 1 | "1 day in a row!" | — |
| catch-up next day | held up, today's snapshot not `both` | button "Continue" | — |

</intent-contract>

## Code Map

- `src/services/dailyWriteDeclined.ts`, `src/services/syncLock.ts` (l.94-103 locks, `withWaitingLock`) -- template and lock.
- `src/services/localCopy.ts` l.38-42 -- FILL SOURCES exemption to extend.
- `src/stores/slices/dailyQuestionSlice.ts` -- header l.48-69, interface ~l.130-180, session-check pattern in `declineWrittenQuestion` (~l.600-625).
- `src/components/DailyQuestion/DailyQuestion.tsx` -- `sessionKey`, `streak`, `showWriteSheet` (~l.320-360), render (~l.380-440); header comment.
- `src/components/shared/StreakWeek.tsx` -- `WeekDot`, grid.
- `src/components/shared/UpdateToast.tsx` + `__tests__/UpdateToast.test.tsx` l.40-90 -- `motion/react` use and the motion mock (`useReducedMotion` from a store) to copy for tests.
- `src/api/validation/dailyQuestionSchemas.ts` -- `CoupleStreak`, `CountSchema`.
- Unit test homes: `tests/unit/services/dailyWriteDeclined.test.ts` (fake-indexeddb template), `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx` (+ `dailyQuestionFixture.ts`), `dailyQuestionSlice*.test.ts` there, `src/components/DailyQuestion/__tests__/WriteQuestionSheet.test.tsx` (mocks `fetchCoupleStreak`; must stay green).
- E2E: template `tests/e2e/daily/daily-streak.spec.ts` (`seedPairDays`, `clearPairDays`, second context, `COUPLE_STREAK_READ`). Specs whose second pick will now raise the overlay and may need it dismissed before a click: `daily-streak.spec.ts`, `daily-question-live-pick.spec.ts`, `daily-question-write-tomorrow.spec.ts`, `daily-question-offline-pick.spec.ts`, `daily-question-pick-and-reveal.spec.ts`, `tests/e2e/partner/partner-streak.spec.ts`, `tests/e2e/partner/realtime-recovery-after-renewal.spec.ts`. Put one shared `dismissStreakUp(page)` in `tests/support/helpers/` rather than copies.

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/dailyCelebrated.ts`, `src/services/syncLock.ts` -- kind, schema, read, claim, lock.
- [ ] `src/services/localCopy.ts` -- header exemption.
- [ ] `src/stores/slices/dailyQuestionSlice.ts` -- `claimStreakCelebration`; header.
- [ ] `src/components/shared/StreakWeek.tsx` -- `fillDay`, `reduceMotion`.
- [ ] `src/components/DailyQuestion/StreakUp.tsx` (new), `DailyQuestion.tsx` -- overlay, claim effect, write sheet waits; header.
- [ ] Unit tests -- every matrix row: service (fake-indexeddb, incl. sign-out's `deleteAccountCopies` removing the kind), slice action, component (claim → overlay, button label, dismiss, write sheet waits, Reduce Motion end state with no motion element, Partner `StreakCard` unaffected).
- [ ] `tests/e2e/daily/daily-streak-up.spec.ts` (new) -- (1) seeded 1 done day: both open Daily (seeds), A picks, B picks → B sees `daily-streak-up` at once with held 2; B dismisses, reloads: no overlay; (2) A then navigates away from Daily and back → A sees it once; reload: none; (3) seeded: A opens Daily, picks, stays; B picks → A sees it without reload; (4) A opens Daily (seeds) and picks, goes to Partner; B picks; A's Partner card shows the new held and no overlay; A opens Daily → overlay plays.
- [ ] The specs listed in the Code Map -- dismiss the overlay where it blocks a later step; keep every existing assertion.

**Acceptance Criteria:**
- Given both partners on Daily with stored celebrations, when the second partner picks, then the second picker sees the +1 overlay at once, and a reload never shows it again.
- Given the first picker, when they next open Daily (or are on Daily when the partner's pick arrives), then they see the +1 once.
- Given the Partner page opened first after the day is done, when it shows, then it shows the new held without the overlay, and Daily then still plays it.

## Implementation Notes

- The claim effect also waits for this mount's own day read (`readFor === sessionKey`). A dock tap from a page above Home (`setView` walks back to Home first) mounts Daily, unmounts it and mounts it again; the first, short-lived mount claimed and stored the held total with nothing to play it on, so Partner -> Daily never played (found by e2e scenario 4). Only specs that finish the day on a page they keep using needed `dismissStreakUp`: `daily-streak`, `daily-question-write-tomorrow`, `partner-streak`; the others assert visibility only and pass unchanged.

## Plan Change Log

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 4 findings — high 0, medium 1, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[defer]` A failed IndexedDB read of `daily-celebrated` reads as "nothing stored", so `claimCelebration` re-seeds over the stored value, dropping a +1 and overwriting `milestones`. Verified: `readLocalCopy` returns `null` on a caught error (`localCopy.ts:97-105`) and the claim seeds on `null`. Deferred (rare but real): the fix needs a read that tells absent from failed, more than a direct correction.
  - `[medium]` `[patch]` The "a reload / coming back never replays it" checks (E2E tests 1 and 2, the unit test `a reload (a new mount) never replays it`) asserted the overlay absent before the new mount's claim had answered, so a replay regression would still pass. Fixed: the claim's `.then` sets `claimedHeld` in the same callback as `setCelebration`, rendered as `data-streak-claimed` on `daily-question-view`; each check waits for it to equal the expected held before asserting no overlay.
  - `[low]` `[patch]` The slice test `a sign-out during the claim…` never checked the stored value survived. Fixed: it asserts `readCelebrated(A)` is still `{ held: 3, milestones: 0 }`; the session change is simulated by bumping `authSessionVersion`, since `clearAuth()` itself deletes the copies and would make the check vacuous.
  - `[low]` `[patch]` The unit test `the Partner page card never claims or plays` rendered `StreakCard` alone, which has no claim path, so it could not fail. Fixed: deleted; E2E scenario 4 covers the Partner page.

## Design Notes

- The claim writes before the overlay shows, so a reload or a second tab never replays it, and two concurrent claims (saved copy then fresh read, or two tabs) yield one play. The cost: leaving Daily mid-animation does not replay it.
- Rolling from `held - 1` keeps the design's "+1" literal even when this device missed several done days.
- "See {partner}'s pick" only when today's snapshot is `both`: a celebration of yesterday's day, seen next morning, has no reveal to open.
- `useReducedMotion` + rendering plain elements under it makes "no movement" checkable in a unit test by the absence of motion elements.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (or only the worktree TS2883 baseline).
- `npm run lint` -- expected: exit 0.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/daily tests/e2e/partner tests/e2e/auth/login.spec.ts` -- expected: pass on the local stack.
- `npx playwright test tests/e2e/daily/daily-streak-up.spec.ts --repeat-each=3` -- expected: all pass.

## Auto Run Result

Status: built

**Summary:** Story 7.5: the streak's +1 plays once per new held total on each device. A device-state local-copy kind `daily-celebrated { held, milestones }` remembers what this device last celebrated; Daily claims each `ok` streak it shows (after this mount's own day read), under a cross-tab lock: nothing stored seeds silently, a higher held is stored first and then plays the full-screen "Streak goes up by one" overlay (flame lighting from grey, held rolling up with "+1", the newest done day filling in the week strip, "You and {partner} both answered. {run} days in a row!", and "See {partner}'s pick", or "Continue" when today's day is not `both`). The write sheet waits behind it; Reduce Motion renders the end state with no motion element; the Partner page never claims. Sign-out deletes the kind through `deleteAccountCopies`.

**Files changed:**
- `src/services/dailyCelebrated.ts` (new): the kind, its schema, `readCelebrated`, `claimCelebration`.
- `src/services/syncLock.ts`: `DAILY_CELEBRATED_LOCK`.
- `src/services/localCopy.ts`: FILL SOURCES header exempts both device-state kinds.
- `src/stores/slices/dailyQuestionSlice.ts`: `claimStreakCelebration` (session-checked, never throws); header.
- `src/components/DailyQuestion/StreakUp.tsx` (new): the overlay.
- `src/components/DailyQuestion/DailyQuestion.tsx`: claim effect, overlay, `data-streak-claimed`, write sheet waits; header.
- `src/components/shared/StreakWeek.tsx`: optional `fillDay`, `reduceMotion`.
- `tests/unit/services/dailyCelebrated.test.ts`, `tests/unit/stores/dailyQuestionSlice.celebration.test.ts`, `src/components/DailyQuestion/__tests__/DailyQuestion.celebration.test.tsx` (new): every matrix row.
- `tests/e2e/daily/daily-streak-up.spec.ts` (new): second picker at once; first picker on return, and while Daily is open; Partner page first; no replay after a reload.
- `tests/support/helpers/streak-up.ts` (new): shared `dismissStreakUp`.
- `tests/e2e/daily/daily-streak.spec.ts`, `tests/e2e/daily/daily-question-write-tomorrow.spec.ts`, `tests/e2e/partner/partner-streak.spec.ts`: dismiss the overlay where it now covers a later step; existing assertions kept.

**Review (quick, pinned; lens: quick):** 4 findings.
- **Patched (3):** the no-replay checks now wait on the claim's answer (medium); the slice sign-out test checks the stored value (low); the vacuous Partner-card unit test deleted (low).
- **Deferred (1, low):** a failed IndexedDB read re-seeds over the stored value (frontmatter `deferred`).
- **Rejected:** none.

**Follow-up review recommended: false.** First pass; patched counts by verdict: high 0, medium 1, low 2. No patched high and fewer than two patched mediums.

**Verification (after the patches):**
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run test:unit`: 4744 tests, 0 failures.
- `npx playwright test tests/e2e/daily tests/e2e/partner tests/e2e/auth/login.spec.ts`: 39 passed on the local stack.
- `npx playwright test tests/e2e/daily/daily-streak-up.spec.ts --repeat-each=3`: 12 passed.

**Residual risks:**
- Waiting for this mount's own day read guards the dock's double mount online; offline the saved day answers almost at once, so a short-lived mount could still claim before it unmounts and drop that +1. UNVERIFIED.
- The overlay's look follows the mock-up's StreakUp board as described in the plan; it was not compared visually against the design.
- Leaving Daily mid-animation does not replay it (the claim is stored before the overlay shows), by design.
