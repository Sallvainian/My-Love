---
title: 'Every 25 days the milestone screen shows its badge'
type: feature
ticket: '6'
created: '2026-11-07'
status: done
baseline_revision: '50540eb69a9350f29e2697af3ce2f85b36169b4e'
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

**Problem:** Reaching 25, 50, 75… days of the held total plays only the +1; R5 wants the design's 25-day milestone screen with the animated flaming heart and its badges, once per milestone per device.

**Approach:** `claimCelebration` (story 5) also compares `streak.milestones` with the stored `milestones` when it plays, stores the higher one and answers `milestone: true`. Daily then shows a new full-screen `Milestone` overlay after the +1's button; its Continue and Close close it, revealing the card.

## Boundaries & Constraints

**Always:**
- `src/services/dailyCelebrated.ts`: `CelebrationClaim` play variant becomes `{ play: true; previous: Celebrated; milestone: boolean }`. In the play branch write `{ held: streak.held, milestones: Math.max(stored.milestones, streak.milestones) }` and answer `milestone: streak.milestones > stored.milestones`. Seed and no-play branches unchanged (seed stores the streak's milestones and plays nothing). Update the module header (it says story 6 owns milestones). `claimStreakCelebration` in `dailyQuestionSlice.ts` passes it through unchanged; update its doc comment.
- `DailyQuestion.tsx`: `celebration` gains `stage: 'up' | 'milestone'` and `milestone: boolean` from the claim. StreakUp's button: `milestone` → stage `milestone`, else close. The Milestone overlay's Continue and Close both close (`setCelebration(null)`). `celebrationShown` stays true through both stages, so the write sheet waits behind either. Header comment describes the milestone.
- New `src/components/DailyQuestion/FlamingHeart.tsx`: the mock-up's SVG (viewBox `0 0 64 64`: outer flame, inner flame, heart rotated -8° with two highlight ellipses) as a component; gradient ids from `useId()` so several on one page never collide; prop `animated` adds the flicker classes to the two flames and the beat class to the heart group, and sets `data-animated="true|false"` on the `<svg>`; `aria-hidden`. The gradient hexes are illustration colours, the same in both themes, kept as named constants in this file (no kit token). Comment that the flaming heart is used only by the milestone screen.
- New `src/components/DailyQuestion/Milestone.tsx` from the Milestone board: `fixed inset-0 z-100 overflow-y-auto`, background `bg-page` with `bg-fire-tint` layered over it (the dark fire-tint is translucent, so the page colour must be under it, e.g. `bg-page bg-linear-to-b from-fire-tint to-fire-tint`), padded by all four `calc(1rem+env(safe-area-inset-*))` as `StreakUp.tsx`; `role="dialog" aria-modal="true"`, test id `daily-milestone`. Close: a 44 px round icon button top-right inside that padding (lucide `X`, `aria-label="Close"`, `daily-milestone-close`). Content, centred, `max-w-sm`: the 150 px `bg-fire-tint` disc holding `FlamingHeart` (`daily-milestone-heart`, animated unless Reduce Motion); `{held}` (`daily-milestone-held`, `font-serif` 64px bold `text-fire-ink`) over "days answered together" (`font-serif` 26px `text-fire-soft`); `daily-milestone-message` "You and {partner} have answered together on {held} days."; a `bg-card shadow-card` rounded-[20px] panel with "New badge unlocked" (12px uppercase tracking-[.08em] `text-fire-soft`) and a 4-column grid of badges. Continue `PRIMARY_BUTTON w-full`, `daily-milestone-continue`. Reduce Motion via `useReducedMotion()` from `motion/react` (as `StreakUp.tsx`): `animated={!reduceMotion}`; the CSS keyframes also carry `motion-reduce:animate-none`.
- Badges: exported pure `milestoneBadges(milestones: number): { days: number; reached: boolean }[]` — block `b = floor((max(milestones,1) - 1) / 4)`, days `(4b+1..4b+4) × 25`, `reached = days <= milestones × 25`. Each badge `daily-milestone-badge-{days}` with `data-reached`; reached: 60 px `bg-fire-tint` disc, 3 px fire ring, a static (never animated) `FlamingHeart`, number `text-fire-ink`; locked: `bg-ash-tint`, heart `grayscale opacity-45`, number `text-muted`. Badges never animate.
- Text shows `streak.held` and `streak.milestones` as the server counted them; the client computes only the badge block.
- `src/index.css`: three keyframes from the board (`fhOuter` 1.4 s, `fhInner` 1 s, `fhBeat` 1.6 s, ease-in-out infinite) as `--animate-flame-outer`, `--animate-flame-inner`, `--animate-heart-beat-flame` in the first `@theme` block with a comment; the flames need `[transform-box:fill-box]` and bottom-centre origin, the heart origin `50% 60%`.
- E2E on the worker pair: `clearPairDays` before and deferred at teardown, `seedPairDays` days 1–24 `both`, both partners open Daily and wait for `daily-celebrated` seeded at `{ held: 24, milestones: 0 }`; picks through the UI; second context as `daily-streak-up.spec.ts`.

**Never:** the flaming heart anywhere but `Milestone.tsx` (the counter, the +1, the Partner card and the dock keep the plain `Flame`); a milestone without the +1 before it; play on an event alone; compute held or milestones on the client; write `daily-celebrated` outside `claimCelebration`; a migration or a server change; edit `database.types.ts`; `@/` in `src/`; `prettier --write`; link, unlink or reset pool pairs; hex colours outside `FlamingHeart.tsx`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| first milestone | stored `{24,0}`, streak held 25 ms 1 | stored `{25,1}`; +1 then milestone, 25 reached, 50/75/100 grey | — |
| plain +1 | stored `{25,1}`, held 26 ms 1 | stored `{26,1}`; +1 only, its button closes | — |
| caught up past one | stored `{24,0}`, held 27 ms 1 | milestone shows held 27 | — |
| two at once | stored `{40,1}`, held 75 ms 3 | stored ms 3; one screen, 25/50/75 reached, 100 grey | — |
| second block | ms 5 (held 130) | badges 125 reached, 150/175/200 grey | — |
| block edge | ms 4 / ms 8 | 25–100 all reached / 125–200 all reached | — |
| seed | nothing stored, held 30 ms 1 | stored `{30,1}`; nothing plays | — |
| stored ahead | stored `{30,2}`, held 31 ms 1 | stored ms stays 2; `milestone: false` | — |
| Reduce Motion | milestone shown, reduced | `data-animated="false"`, no animation class on flames or heart | — |
| Close or Continue | milestone shown | overlay gone, reveal visible, write sheet may open | — |
| reload | after a milestone shown | no +1, no milestone | — |

</intent-contract>

## Code Map

- Design: the owner-approved canvas (epic References), board `project/Milestone.dc.html`, saved read-only at `/private/tmp/claude-501/-Users-sallvain-Projects-My-Love--bmad-loop-runs-20261107-005314-0f5a-worktrees-7-6/d900ac38-f386-40ad-b26e-64c5451ebb10/scratchpad/artifact-files/405608b9-ae3b-49c9-b66c-dfd4b1cafcae/project/Milestone.dc.html` — copy the SVG paths, gradients and keyframes from it; its "days in a row" wording is replaced as above.
- `src/services/dailyCelebrated.ts` -- `CelebrationClaim`, `claimCelebration` play branch.
- `src/stores/slices/dailyQuestionSlice.ts` ~l.71-80 header, ~l.187-193 interface, ~l.643 action.
- `src/components/DailyQuestion/DailyQuestion.tsx` l.343-352 `celebration` state, l.405-414 claim effect, l.511-518 `StreakUp` render; header l.36-49.
- `src/components/DailyQuestion/StreakUp.tsx` -- template for the overlay shell, safe-area padding, `useReducedMotion`; its own behaviour unchanged.
- `src/components/shared/kitClasses.ts` `PRIMARY_BUTTON`; `src/index.css` l.7-57 first `@theme` (keyframes/`--animate-*` precedent), l.85-93 fire/ash tokens.
- Unit homes: `tests/unit/services/dailyCelebrated.test.ts` (its "up" test asserts story 5's carried milestones: rewrite it for the new rule, keep the play/previous checks), `tests/unit/stores/dailyQuestionSlice.celebration.test.ts` (its `play: true` `toEqual` gains `milestone: false`), `src/components/DailyQuestion/__tests__/DailyQuestion.celebration.test.tsx` (motion mock with `motion.reduce`, store setup — extend here or add `Milestone.test.tsx` beside it reusing that mock), fixture `tests/unit/stores/dailyQuestionFixture.ts` `coupleStreak`.
- E2E: template `tests/e2e/daily/daily-streak-up.spec.ts` (`openDailySeeded`, `pick`, the setup fixture, `expectClaimed`); `seedPairDays`/`clearPairDays` in `tests/support/factories/daily-question.ts`; `savedLocalCopy`, `recurseUntil`, `dismissStreakUp` helpers.

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/dailyCelebrated.ts`, `src/stores/slices/dailyQuestionSlice.ts` -- milestone in the claim; headers.
- [ ] `src/index.css` -- the three animations.
- [ ] `src/components/DailyQuestion/FlamingHeart.tsx`, `Milestone.tsx` (new) -- the heart, the screen, `milestoneBadges`.
- [ ] `src/components/DailyQuestion/DailyQuestion.tsx` -- stage, StreakUp button → milestone, render; header.
- [ ] Unit tests -- every matrix row: service (claim answers and stored values), `milestoneBadges` (1, 4, 5 i.e. 130 days, 8), component (+1 then milestone, plain +1 closes straight away, Continue and Close each reveal the card, write sheet waits through both stages, text and badges, Reduce Motion `data-animated="false"` and no animation class).
- [ ] `tests/e2e/daily/daily-streak-milestone.spec.ts` (new) -- 24 seeded done days: worker picks, partner picks second → partner sees `daily-streak-up` held 25, its button → `daily-milestone` held 25, message with the worker's name, badge 25 `data-reached="true"`, 50/75/100 `"false"`; Continue → reveal visible; reload (wait on `data-streak-claimed` 25) → neither overlay; stored `{ held: 25, milestones: 1 }`. Second test: the first picker, returning to Daily, sees +1 then milestone and closes it with Close.

**Acceptance Criteria:**
- Given 24 done days and both partners on Daily, when the second partner picks, then they see the +1, then the milestone screen with 25 in colour and 50, 75 and 100 grey, and after a reload neither shows again.
- Given a +1 that crosses no milestone, when its button is pressed, then the card shows with no milestone screen.
- Given Reduce Motion, when the milestone screen shows, then the flames and the heart do not move.

## Implementation Notes

- `tests/unit/config/styleKitSweep.test.ts` rejects hex colours in `src/components`; it gains a narrow exemption for `FlamingHeart.tsx`'s hex lines only, pinned at 5, plus a test that the file has nothing else off-kit.
- The sweep also rejects `bg-linear-to-b`, so the overlay is an outer `fixed inset-0 bg-page` dialog holding an inner scrolling `bg-fire-tint` layer instead of the plan's gradient example; same look in both themes.
- `milestoneBadges` lives in its own module, `src/components/DailyQuestion/milestoneBadges.ts`, not exported from `Milestone.tsx`: exporting it there tripped `react-refresh/only-export-components`, and AGENTS.md says fix rather than suppress.
- The big disc carries `ring-14 ring-card/50` (a fire-tint disc on a fire-tint screen is otherwise invisible, the board's `box-shadow:0 0 0 14px`); the Close button is `bg-fire-soft/10 text-fire-soft`.
- Files: `dailyCelebrated.ts`, `dailyQuestionSlice.ts` (doc only), `DailyQuestion.tsx`, new `FlamingHeart.tsx`, `Milestone.tsx`, `milestoneBadges.ts`, `index.css`; tests `dailyCelebrated.test.ts`, `dailyQuestionSlice.celebration.test.ts`, `DailyQuestion.celebration.test.tsx`, new `Milestone.test.tsx`, new `tests/e2e/daily/daily-streak-milestone.spec.ts`, `styleKitSweep.test.ts`.

## Plan Change Log

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 4, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `FlamingHeart.tsx` comment says `useId()` ids hold colons and strips them with a dead `.replace` — verified: React 19.3.1 builds ids as `_r_<n>_` (`react-dom-client.development.js:9448`). Fixed: comment and `.replace` deleted.
  - `[low]` `[patch]` `dailyQuestionSlice.ts` module header (l.71-76) still says the claim decides only the held total — verified against the file. Fixed: header now says the same claim decides and stores the higher milestone count.
  - `[low]` `[patch]` On a milestone day the +1's button reads "See {partner}'s pick" but opens the milestone screen — verified: `showReveal` was true whenever today is `both`. Fixed: `showReveal` is false when `celebration.milestone`, so it reads "Continue"; the E2E's two `expectStreakUp` calls and a unit assertion expect "Continue".
  - `[low]` `[patch]` Badge hearts carry the highlight ellipses and a full `ring-fire`, unlike the board (no ellipses, `#fdba74` ring) — verified against `Milestone.dc.html`. Fixed: `FlamingHeart` takes `highlights` (default true), badges pass `false`; reached ring is `ring-fire/50`.

## Design Notes

- Storing the higher of the two milestone counts keeps "once per milestone" even if the server's count ever drops; the screen shows the newest block, so skipping several milestones still shows one screen with each reached badge in colour.
- The milestone is decided and stored in the same claim as the +1, so a reload during the +1 skips both, as story 5's design accepts for the +1.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (or only the worktree TS2883 baseline).
- `npm run lint` -- expected: exit 0.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/daily tests/e2e/partner` -- expected: pass on the local stack.
- `npx playwright test tests/e2e/daily/daily-streak-milestone.spec.ts --repeat-each=3` -- expected: all pass.

## Auto Run Result

Status: built

**Summary:** Story 7.6: every 25 days of the held total, the +1 on Daily is followed by the design's milestone screen. `claimCelebration` now also compares the streak's `milestones` with the stored count when it plays, stores the higher one and answers `milestone`; Daily's +1 button (reading "Continue" on a milestone day) then opens the full-screen `Milestone` overlay: the animated flaming heart (flickering flames, beating heart; still under Reduce Motion), "{held} days answered together", "You and {partner} have answered together on {held} days.", and "New badge unlocked" with the block of four badges holding the newest milestone, reached ones in colour and the rest grey. Continue and Close both close it onto the reveal; the write sheet waits behind both screens. Shown once per milestone per device, clear of all four safe-area insets.

**Files changed:**
- `src/services/dailyCelebrated.ts`: milestone decided and stored in the claim; header.
- `src/stores/slices/dailyQuestionSlice.ts`: header and interface doc only.
- `src/components/DailyQuestion/DailyQuestion.tsx`: celebration `stage`/`milestone`, +1 button → milestone, render; header.
- `src/components/DailyQuestion/FlamingHeart.tsx` (new): the flaming-heart SVG, `animated`, `highlights`.
- `src/components/DailyQuestion/Milestone.tsx` (new): the milestone overlay.
- `src/components/DailyQuestion/milestoneBadges.ts` (new): the badge block.
- `src/index.css`: the three flaming-heart animations.
- `tests/unit/services/dailyCelebrated.test.ts`, `tests/unit/stores/dailyQuestionSlice.celebration.test.ts`, `src/components/DailyQuestion/__tests__/DailyQuestion.celebration.test.tsx`, `src/components/DailyQuestion/__tests__/Milestone.test.tsx` (new): every matrix row.
- `tests/e2e/daily/daily-streak-milestone.spec.ts` (new): 24 seeded done days; second picker sees +1 then milestone (25 in colour, 50/75/100 grey), nothing after a reload; first picker on returning, closed with Close.
- `tests/unit/config/styleKitSweep.test.ts`: pinned hex exemption for `FlamingHeart.tsx` only.

**Review (quick, pinned; lens: quick):** 4 findings, all low, all patched (dead `useId` replace, stale slice header, +1 label on milestone days, badge highlights and ring). Deferred: none. Rejected: none.

**Follow-up review recommended: false.** First pass; patched counts by verdict: high 0, medium 0, low 4.

**Verification (after the patches):**
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run test:unit`: 256 files, 4771 tests, 0 failures.
- `npx playwright test tests/e2e/daily tests/e2e/partner`: 37 passed on the local stack.
- `npx playwright test tests/e2e/daily/daily-streak-milestone.spec.ts --repeat-each=3`: 6 passed.

**Residual risks:**
- The screen's look (dark mode, iPhone Duo side column) was not compared visually against the board; UNVERIFIED.
- Story 5's deferred finding still stands: a failed IndexedDB read of `daily-celebrated` re-seeds, which now also drops a milestone screen rather than replaying one.
- The milestone is stored with the +1's claim, so a reload during the +1 skips both screens, by design.
