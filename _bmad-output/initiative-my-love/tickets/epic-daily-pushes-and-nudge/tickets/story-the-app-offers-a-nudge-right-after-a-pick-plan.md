---
title: 'The app offers a nudge right after a pick'
type: feature
ticket: '9'
created: '2026-11-26'
status: done
baseline_revision: 'a43190e560f187de935a9344a6288b006d10d854'
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
      tests/e2e/daily/daily-question-after-pick-nudge.spec.ts fails when a run crosses 20:00 or host-local midnight between the pick and the reload.
    evidence: |-
      The server picks the nudge slot (after_pick before 20:00 on the sender's stored zone, evening from 20:00) and the first test expects the waiting button disabled after a reload; a reload after 20:00 reads the new slot unspent, and one after midnight reads a new day. The same low host-clock flake stories 8.3, 8.6, 8.7 and 8.8 deferred for their specs; the shared fix is a guard near 20:00 and midnight (story 8.9 implementation, 2026-11-26).
    location: >-
      tests/e2e/daily/daily-question-after-pick-nudge.spec.ts after the nudge send
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 8.8 gave the waiting card a Nudge button, but nothing asks the first picker right after their pick (R2: "Do you want to nudge your partner?" once, never on an open of Daily where the write sheet showed).

**Approach:** When `DayCard`'s Send my pick resolves and the store's shown day is that day in state `me` with an open `nudge` slot, `DailyQuestion` records a one-shot offer; a new `NudgeSheet` (built as `WriteQuestionSheet`) shows it behind the +1/milestone overlays and never alongside or after the write sheet in that mount. Nudge calls `sendDailyNudge`; Daily's listener closes the offer on the partner's `daily_pick` for that day.

## Boundaries & Constraints

**Always:**
- Offer raised only from the in-view send's continuation, and only when `useAppStore.getState().dailyDay` is `ok`, same `day_id` as the card's, `state === 'me'`, `my_choice` non-null, and `nudge` present with `slot !== null && !spent`. A queued (offline) pick leaves the state `none`/`partner`, so it raises nothing; a drain never raises one. The offer is component state keyed `{ session, dayId }` — gone on reload, remount or account switch.
- Visible only while: the offer matches `sessionKey` and the shown `day_id`; the shown state is `me`; `readFor === sessionKey`; `!celebrationShown`; `!showWriteSheet`; and the write sheet has not shown in this mount for this session (`writeShownIn !== sessionKey`, set by a new `onShown` prop `WriteQuestionSheet` calls once on mount).
- Nudge → `sendDailyNudge()`; success clears the offer (sheet closes, waiting button greys from `spent`). Offline → the error's own message (`You are offline. Your nudge needs a connection to send.`); any other failure → `NUDGE_FAILED_MESSAGE`, sheet stays open (the slice already re-reads the day). Both buttons disabled while sending; the sheet's Nudge also disabled when the shown `nudge` is missing, null-slot or spent.
- Not now, a scrim tap and Escape clear the offer; nothing is sent; the waiting button is unchanged.
- `useDailyPickListener(onPartnerPick?)`: on `daily_pick` it still refreshes the day and the streak, and also calls `onPartnerPick(day_id)` (held in a ref so a new callback never re-subscribes). `DailyQuestion` passes a stable callback clearing an offer for that `day_id`. `daily_nudge`, `partner_linked`, `SUBSCRIBED` do not call it; `new_mood`, `dates_changed` stay unhandled.
- Sheet clears all four `env(safe-area-inset-*)`, opens/closes with no animation: reuse the write sheet's scrim/panel classes, moved to `src/components/shared/kitClasses.ts` as `SHEET_SCRIM`/`SHEET_PANEL` (two users now).
- Existing assertions are kept; E2E specs only gain the step that closes the sheet.

**Never:**
- No slice, API, migration, pgTAP, `send-push`, `database.types.ts` or `src/services/dateReminders.ts` change; no `supabase.channel()`; no new local-copy kind.
- No sweep (8.10), no live device spec or check (8.11); no change to the waiting card's behaviour beyond sharing the error-text helper.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First picker | send → `me`, `nudge {after_pick,false}`, not writer | sheet `daily-nudge-sheet` shows once | — |
| Writer's day | same, `write.mine`, write sheet shows | write sheet only; after it closes, still no nudge sheet | — |
| Second picker | send → `both` | no sheet | — |
| Queued pick | offline send | no sheet, now or after the drain | — |
| Slot null/spent/missing | send → `me`, `nudge` null-slot, spent or absent | no sheet | — |
| Overlay up | +1 or milestone showing | sheet waits, shows after it closes | — |
| Partner picks while open | `daily_pick {day_id}` or a re-read to `both` | sheet closes, does not return | — |
| Nudge refused / fails | `DQ0xx`, network | sheet stays, `daily-nudge-sheet-error` = `Your nudge could not be sent.` | day re-read by slice |
| Nudge offline | no connection | no request, offline sentence on the sheet | — |
| Reload / remount | after any of the above | no sheet | — |

</intent-contract>

## Code Map

- `src/components/DailyQuestion/DailyQuestion.tsx:259-301` -- `DayCard.send`: gain `onPickSent(dayId)` prop, called after `await submitDailyPick` resolves; parent does the state check with `useAppStore.getState()`. `:477-493` write-sheet state/`showWriteSheet` — add `writeShownIn` and the offer state beside it; `:557-560` pass the close callback to `useDailyPickListener`; `:681-690` render `NudgeSheet` after `WriteQuestionSheet`. `:211-226` `WaitingCard.nudgePartner` error mapping → shared helper. Header comment: a paragraph on the offer.
- `src/components/DailyQuestion/NudgeSheet.tsx` (new) -- the sheet; exports `NudgeSheet` and `nudgeFailureMessage(caught)` (offline `AccountDataError` → its message, else `NUDGE_FAILED_MESSAGE`).
- `src/components/DailyQuestion/WriteQuestionSheet.tsx:42-45,101` -- move `SHEET_SCRIM`/`SHEET_PANEL` to `kitClasses.ts`; add optional `onShown` called once in a mount effect (ref, as `onCloseRef`).
- `src/components/shared/kitClasses.ts` -- `SHEET_SCRIM`, `SHEET_PANEL` with a doc line.
- `src/hooks/useDailyPickListener.ts` -- optional `onPartnerPick` param via ref; header bullet.
- Tests: `src/hooks/__tests__/useDailyPickListener.test.ts` (per-event: `daily_pick` calls it with the id, `daily_nudge`/`partner_linked`/`SUBSCRIBED` do not; a new callback does not re-subscribe); new `src/components/DailyQuestion/__tests__/NudgeSheet.test.tsx` (template `WriteQuestionSheet.test.tsx`: Nudge success → `onClose`-path, refusal line, offline sentence and no request, disabled while sending, Not now/scrim/Escape); new `src/components/DailyQuestion/__tests__/DailyQuestion.afterPick.test.tsx` (template `DailyQuestion.nudge.test.tsx`, real store, API mocked incl. `submitDailyPick` request; mock `useDailyPickListener` capturing its argument): each matrix row except reload; `WriteQuestionSheet.test.tsx` gains an `onShown` case. Fixtures: `tests/unit/stores/dailyQuestionFixture.ts` (`nudgeSnapshot`, `waitingSnapshot`).
- E2E: new `tests/e2e/daily/daily-question-after-pick-nudge.spec.ts` (template `daily-question-nudge.spec.ts`; `readPairDayWriter` in `tests/support/factories/daily-question.ts` picks who sends first). Add a shared helper `closeAfterPickSheet(page, isWriter)` in new `tests/support/helpers/after-pick-sheet.ts` (writer: write sheet visible → Escape; else nudge sheet visible → Not now), and use it in every first-picker step of: `daily-question-live-pick`, `daily-streak`, `daily-question-offline-pick` (only an online first pick), `daily-question-pick-and-reveal`, `daily-streak-up`, `daily-streak-milestone`, `daily-question-write-tomorrow`, `daily-question-nudge` (replace its writer-only branch), `partner/partner-streak`, `partner/partner-past-questions`, `partner/realtime-recovery-after-renewal`. A second pick, a queued pick and a seeded day with no open slot meet no sheet — leave those steps.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/shared/kitClasses.ts`, `WriteQuestionSheet.tsx` -- shared sheet classes; `onShown` -- one sheet look; the write-sheet memory.
- [x] `src/components/DailyQuestion/NudgeSheet.tsx` -- the sheet and `nudgeFailureMessage` -- R2's offer.
- [x] `src/hooks/useDailyPickListener.ts` -- `onPartnerPick` -- close on `daily_pick`.
- [x] `src/components/DailyQuestion/DailyQuestion.tsx` -- offer state, raise/visibility rules, `WaitingCard` uses the helper -- the trigger.
- [x] Unit tests (Code Map) -- every matrix row but reload; each registry event and `SUBSCRIBED`.
- [x] E2E helper, new spec, and the eleven spec updates (Code Map / Design Notes).

**Acceptance Criteria:**
- Given the non-writer picks first online, when the pick answers 200, then `daily-nudge-sheet` is visible with "Do you want to nudge your partner?"; Nudge → one `send_daily_nudge` 200, the sheet gone and `daily-nudge` disabled; after a reload no sheet.
- Given the same on a fresh day, when Not now is tapped, then the sheet is gone, no `send_daily_nudge` request was made and `daily-nudge` is enabled.
- Given it is the writer's day, when the writer picks first, then `daily-write-sheet` shows and `daily-nudge-sheet` has count 0, also after Escape.
- Given the first picker nudged or dismissed, when the partner picks second, then the partner's page shows no `daily-nudge-sheet`.
- Given `npm run test:unit`, `npm run typecheck`, `npm run lint`, when run, then all pass.

## Implementation Notes

- 2026-11-26: implemented by a Sonnet subagent from this plan; checked in the parent session against the diff. New files: `src/components/DailyQuestion/NudgeSheet.tsx`, `src/components/DailyQuestion/__tests__/NudgeSheet.test.tsx`, `src/components/DailyQuestion/__tests__/DailyQuestion.afterPick.test.tsx`, `tests/support/helpers/after-pick-sheet.ts`, `tests/e2e/daily/daily-question-after-pick-nudge.spec.ts`.
- `closeAfterPickSheet` takes an optional third argument `writerCloses: 'escape' | 'decline'` (default Escape). The five specs that already answered the write sheet with "No thanks" (`daily-streak`, `daily-streak-up`, `daily-streak-milestone`, `partner-streak`, `partner-past-questions`) keep that with `'decline'`, because Escape hides the sheet only for the mount and a remount (leave and return) would bring it back over the dock.
- `offerNudge` reads `useAppStore.getState()` with a one-line `no-restricted-properties` disable (the stored answer post-dates the render's value; precedent `usePhotoImage.ts`); `NudgeSheet.tsx` exports `nudgeFailureMessage` with a `react-refresh/only-export-components` disable.
- In `daily-question-offline-pick.spec.ts` the partner is the online first picker, so the partner page closes its sheet; the worker's queued pick meets none.
- The new spec has no offline step, so it keeps the default trace and video.
- `tests/live/daily-question-live.spec.ts` still picks first without closing the sheet: the live spec is story 8.11's (ticket text).
- The new spec's host-clock flake went into this plan's `deferred` list.
- 2026-11-26 review patch: `nudgeFailureMessage` lives in `src/components/DailyQuestion/nudgeFailureMessage.ts`, not exported from `NudgeSheet.tsx` as the Code Map said, so no `react-refresh/only-export-components` disable is needed (AGENTS.md: fix before suppressing).

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 6 findings — high 0, medium 1, low 4, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` (quick) The new spec's "the second pick sent no nudge" assertion reads a tracker on `otherPage` while the second pick is on `writerPage` — real; the assertion could not fail on what it names. Fixed: a tracker per page, and the writer's page asserts 0 after its pick.
  - `[medium]` `[patch]` (quick) AC4's second-picker check is masked: the second picker is always the writer, whose +1 and write sheet hide the nudge sheet whatever the offer does — real verification gap at the surface the AC names. Fixed: test 3 now has the non-writer pick second after the writer, dismiss the +1, see the reveal and no `daily-nudge-sheet`, with no `send_daily_nudge` on either page.
  - `[low]` `[patch]` (quick) The `send_daily_nudge` counters were attached after both pages loaded, against AGENTS.md's counters-before-sign-in rule — real rule break (low practical risk: only a click sends). Fixed: both trackers created in the fixture before either `goto` and passed through `PairSetup`.
  - `[low]` `[patch]` (quick) `NudgeSheet.tsx` suppressed `react-refresh/only-export-components` where a direct fix exists — real (AGENTS.md: fix before suppressing). Fixed: helper moved to `nudgeFailureMessage.ts`, disable removed.
  - `[false]` `[reject]` (quick) `writeShownIn` is per session, not per day, so a Daily left mounted overnight after a write sheet offers no nudge the next day — the ticket's rule is "never shows on an open of Daily where the write sheet showed" (owner, 2026-11-25), and the code suppresses exactly on that open; the per-day reading is not what the ticket says.
  - `[low]` `[patch]` (quick) The new spec's header cites DW-535 as if it were this spec's ledger entry — real, misleading citation. Fixed: the header names DW-535 as story 8.8's entry for `daily-question-nudge.spec.ts` and points to this plan's `deferred` list.

## Design Notes

Raise (in `DailyQuestion`, passed to `DayCard` as `onPickSent`):

```ts
const offerNudge = useCallback((dayId: string) => {
  const shown = useAppStore.getState().dailyDay;
  if (shown?.status !== 'ok') return;
  const s = shown.snapshot;
  if (s.day_id !== dayId || s.state !== 'me' || !s.my_choice) return;
  if (!s.nudge || s.nudge.slot === null || s.nudge.spent) return;
  setNudgeOffer({ session: sessionKey, dayId });
}, [sessionKey]);
```

`NudgeSheet` props: `canNudge: boolean`, `onClose(): void` (Not now/scrim/Escape and after a success). Test ids: `daily-nudge-sheet` (scrim, `role="dialog"`, `aria-modal`, labelled by the title), `daily-nudge-panel`, title text exactly `Do you want to nudge your partner?`, `daily-nudge-sheet-send` (Bell icon + `Nudge`, `PRIMARY_BUTTON`), `daily-nudge-sheet-dismiss` (`Not now`, `SECONDARY_BUTTON`), `daily-nudge-sheet-error` (`FAILURE_BOX`, `role="alert"`, cleared on the next tap). Focus trap and initial focus as `WriteQuestionSheet`. The sheet calls `sendDailyNudge` itself; a console.error for non-offline failures as `WaitingCard` does.

E2E new spec (`[P1]`, `test.use({ trace: 'off', video: 'off' })` if it toggles offline): pooled pair, `clearPairDays` before each test and deferred; partner context opens `/daily` first. Test 1: the non-writer picks first → sheet; Nudge → 200, sheet gone, `daily-nudge` disabled; reload (await `DAILY_DAY_READ`) → no sheet; the writer picks second → no nudge sheet (close its write sheet with Escape). Test 2: non-writer first → Not now → `trackReads` on `send_daily_nudge` started 0, `daily-nudge` enabled. Test 3: writer first → write sheet, no nudge sheet; Escape → still none. Assign roles from `readPairDayWriter` after both reads. A run crossing 20:00 or midnight is the known host-clock flake (see 8.8's deferred); add a matching `deferred` entry.

## Verification

**Commands:**
- `npx vitest run src/components/DailyQuestion src/hooks/__tests__/useDailyPickListener.test.ts` -- expected: pass.
- `npm run test:unit` -- expected: pass.
- `npm run typecheck && npm run lint` -- expected: pass.
- `supabase status` (pinned CLI, shared local stack, no reset) then `npx playwright test tests/e2e/daily tests/e2e/partner/partner-streak.spec.ts tests/e2e/partner/partner-past-questions.spec.ts tests/e2e/partner/realtime-recovery-after-renewal.spec.ts --project=chromium` -- expected: pass.

## Auto Run Result

- **Summary:** Right after the first picker's pick, the app offers a nudge (R2; spine AD-11, AD-17).
  - When Send my pick resolves and the shown day is that day in state `me` with an open `nudge` slot, `DailyQuestion` raises a one-shot offer (state of the mount and session).
  - `NudgeSheet` ("Do you want to nudge your partner?", Nudge / Not now) is built like the write sheet. It waits behind the +1, the milestone screen and the mount's first read, and never shows alongside the write sheet or after it showed in this mount.
  - Nudge calls `sendDailyNudge`. Success closes the sheet and greys the waiting button. Offline shows the offline sentence, and any other failure shows `Your nudge could not be sent.` on the sheet while the slice re-reads the day.
  - A queued pick, a second pick, a null or spent slot, a reload and a remount offer nothing.
  - `useDailyPickListener(onPartnerPick)` closes the offer on the partner's `daily_pick` for that day. `daily_nudge`, `partner_linked` and `SUBSCRIBED` keep their re-reads and do not close it, and `new_mood` and `dates_changed` stay unhandled.
- **Files changed:**
  - `src/components/DailyQuestion/DailyQuestion.tsx`: the offer state, the raise and visibility rules, `onPickSent` on `DayCard`, the listener callback; the waiting card uses the shared failure text.
  - `src/components/DailyQuestion/NudgeSheet.tsx` (new): the sheet.
  - `src/components/DailyQuestion/nudgeFailureMessage.ts` (new): the failure line shared with the waiting card.
  - `src/components/DailyQuestion/WriteQuestionSheet.tsx`: shared sheet classes, and an optional `onShown`.
  - `src/components/shared/kitClasses.ts`: `SHEET_SCRIM` and `SHEET_PANEL`.
  - `src/hooks/useDailyPickListener.ts`: an optional `onPartnerPick`, held in a ref.
  - Unit tests:
    - new `NudgeSheet.test.tsx` and `DailyQuestion.afterPick.test.tsx`;
    - `WriteQuestionSheet.test.tsx` gains `onShown` cases;
    - `useDailyPickListener.test.ts` gains per-event callback cases.
  - E2E:
    - new `tests/support/helpers/after-pick-sheet.ts` (`closeAfterPickSheet`);
    - new `tests/e2e/daily/daily-question-after-pick-nudge.spec.ts` (3 `[P1]` tests);
    - eleven first-picker specs close the after-pick sheet.
- **Review findings (one quick pass, 6 findings):**
  - **Patched (1 medium, 4 low):** the writer page's nudge counter; an unmasked second-picker check; counters attached before load; the helper moved out of the component file; the DW-535 citation.
  - **Deferred:** none from review. This plan's `deferred` list carries the new spec's host-clock flake, recorded at implementation.
  - **Rejected (1 false):** per-day write-sheet memory. The ticket's rule is per open of Daily.
- **Follow-up review recommendation:** `false`. First pass, patched 0 high and 1 medium entries, and the medium was a test gap closed by a passing assertion.
- **Verification (2026-11-26, after the patches):**
  - `npm run typecheck` and `npm run lint`: clean.
  - `npm run test:unit`: 5153 tests, 0 failures.
  - `npx playwright test tests/e2e/daily tests/e2e/partner/partner-streak.spec.ts tests/e2e/partner/partner-past-questions.spec.ts tests/e2e/partner/realtime-recovery-after-renewal.spec.ts --project=chromium`: 38 passed, row audit clean (Supabase CLI 2.122.0, shared local stack, no reset).
  - Every I/O matrix row is covered by a passing test; the reload row is covered by the E2E and a unit remount.
- **Residual risks:**
  - The new spec's 20:00/midnight host-clock flake, in `deferred`.
  - `tests/live/daily-question-live.spec.ts` picks first without closing the sheet. The live spec is story 8.11's.
