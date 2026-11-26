---
title: "The waiting screen's Nudge button nudges the partner"
type: feature
ticket: '8'
created: '2026-11-26'
status: done
baseline_revision: 'e5e6e44b7b9c00f1f7f67474543b92cc5a1a48cd'
route: full
route_source: auto
risk: high
review: thorough
review_source: pinned
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      tests/e2e/daily/daily-question-nudge.spec.ts fails when a run crosses 20:00 or host-local midnight between the nudge and the reload.
    evidence: |-
      The server picks the slot (after_pick before 20:00 on the sender's stored zone, evening from 20:00) and the spec expects the button disabled after a reload; a reload after 20:00 reads the new slot unspent, and one after midnight reads a new day. The same low host-clock flake stories 8.3, 8.6 and 8.7 deferred for their specs; the shared fix is a guard near 20:00 and midnight (story 8.8 implementation, 2026-11-26).
    location: >-
      tests/e2e/daily/daily-question-nudge.spec.ts after the nudge send
    severity: low
  - summary: >-
      The client keeps nudge.spent per (day_id, slot), while the server spends a slot per (sender-local date, slot), so a sender whose date has passed the shown day sees a greyed button the server would still accept.
    evidence: |-
      keepNudgeSpent keeps a stored {after_pick, spent: true} over a later {after_pick, spent: false} for the same day_id. With the sender far ahead of the partner (UTC+9 against UTC-5) and the day still on screen after the sender's midnight, the server opens a fresh after_pick slot on the sender's new date for the same day, and the button stays greyed. Same root cause as story 8.7's deferred sender-date crossing (AD-17 keys the limit on the sender's date); the snapshot carries no date to tell the two slots apart (review 2026-11-26: blind-hunter).
    location: >-
      src/services/dailyDaysCopy.ts keepNudgeSpent
    severity: low
  - summary: >-
      After a P0002 refusal (the pair changed) the nudge's re-read of the same day_id fails too, so the stale waiting card keeps an enabled button that fails on every tap.
    evidence: |-
      sendDailyNudge starts refreshDailyDay(dayId) on any non-offline failure; get_daily_day_by_id answers P0002 for a day outside the current pair, and refreshDailyDay only logs. Real low defect, deferred because it needs an unlink between showing the card and tapping, and the fix (loadDailyDay on P0002) adds a branch the plan does not settle (review 2026-11-26: blind-hunter).
    location: >-
      src/stores/slices/dailyDaySlice.ts sendDailyNudge
    severity: low
  - summary: >-
      Daily does not re-read at the sender's local midnight, so a page left open and visible across midnight keeps the old day and its nudge slot.
    evidence: |-
      useDailyDayRereads arms only 20:00:05 and visibilitychange; Daily had no midnight re-read before this change either (pre-existing). A pick made then is refused day-changed and re-reads, but the nudge button shows the old day's state until a return or reload (review 2026-11-26: blind-hunter).
    location: >-
      src/hooks/useDailyDayRereads.ts
    severity: low
  - summary: >-
      A nudge request that times out after the server committed it shows "Your nudge could not be sent." although the push went out.
    evidence: |-
      requestTimeout aborts the client request; the row and its trigger post may already be committed. The card shows NUDGE_FAILED_MESSAGE, and the re-read then greys the button (spent), so the line and the state disagree. Real low defect, deferred because it needs a timeout after commit; the fix needs a rule for when the re-read overrides the line that the intent does not give (review 2026-11-26: edge-case-hunter).
    location: >-
      src/components/DailyQuestion/DailyQuestion.tsx WaitingCard
    severity: low
  - summary: >-
      The 20:00 re-read uses the device's clock while the server's slot uses the stored zone, which differ when the same account reads Daily from a second device in another zone.
    evidence: |-
      get_daily_day stores the zone of whichever device read last; Daily's mount read stores this device's zone, so they agree unless another device of the same account in another zone reads in between. Then the timer fires at the wrong hour and the evening slot shows only on a return or reload (review 2026-11-26: edge-case-hunter, intent-alignment).
    location: >-
      src/hooks/useDailyDayRereads.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 8.7 gave the server `send_daily_nudge(day_id)` and the snapshot's `nudge { slot, spent }`, but the client strips `nudge`, has no way to send one, and the waiting screen is a plain "Waiting on {partner}" line, so a partner who picked first cannot nudge (R2, spine AD-13, AD-16, AD-17, AD-11).

**Approach:** Parse `nudge`, make the day merge keep `nudge.spent` one-way within a slot, add `sendDailyNudge` (API + `dailyDaySlice` action) that broadcasts `daily_nudge { day_id }` after a confirmed send, add `daily_nudge` to the partner-event registry, and replace the plain line with the board's dashed waiting card and its Nudge button; Daily also re-reads the day at 20:00 and on return to the front.

## Boundaries & Constraints

**Always:**
- Button disabled when `nudge` is missing, `slot` is null, `spent` is true, or a send is in flight. Offline it stays enabled; a tap sends no request and shows `offlineMessage('Your nudge', 'send', 'needs')` ("You are offline. Your nudge needs a connection to send.") through the API's `refuseOffline`.
- A refusal (`DQ007`–`DQ010`, `P0002`) or any failed request: no broadcast, the card's failure box shows exactly `Your nudge could not be sent.`, and the slice starts `refreshDailyDay(day_id)` for that day. Offline starts no re-read.
- A confirmed send merges the returned snapshot into the copy and the shown day (as `submitWrittenQuestion` does), then fire-and-forget `daily_nudge { day_id }` on the partner's `mood-updates:<uid>` via `sendEphemeralBroadcast`; a failed broadcast is logged, never shown.
- Merge (copy and `mergeAnswer`): `nudge.spent` never moves true→false while `nudge.slot` is the same non-null value; a different slot is taken as the kept entry has it (a new slot starts unspent); a snapshot without `nudge` reads as `{ slot: null, spent: false }`.
- Session checks (`userId`, `authSessionVersion`) before every `set` after an await, as the slice's other actions.
- Daily's listener (`useDailyPickListener`) gains `daily_nudge` → `refreshDailyDay(day_id)` only (no streak re-read); `SUBSCRIBED`, `partner_linked`, `daily_pick` unchanged; `new_mood` and `dates_changed` stay unhandled.
- Existing assertions are kept; only the two "unknown event" tests that use `daily_nudge` switch to another unknown name, and the two event-list pins gain `daily_nudge`.

**Never:**
- No after-pick nudge sheet or its once-per-open rule (story 8.9 calls this send); no sweep (8.10); no live device check (8.11).
- No migration, pgTAP, `send-push` or `database.types.ts` change; no change to `src/services/dateReminders.ts`.
- No `supabase.channel()` call; no new local-copy kind or IndexedDB store.
- No change to what the Partner page, partner-link, dates-changed or mood listeners do.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open slot | `state: me`, `nudge {after_pick, false}` | card with enabled "Nudge Jessie"; tap → one RPC, button disabled while sending, then disabled (spent), one broadcast | — |
| Spent / null / missing | `spent: true`, or `slot: null`, or no `nudge` | button disabled | — |
| Offline tap | slot open, no connection | no RPC, no broadcast, no re-read | box shows the offline sentence |
| Refusal | RPC `DQ010` (or DQ007–9, P0002) | no broadcast; `refreshDailyDay(day_id)`; button follows the re-read (partner picked → reveal) | box: `Your nudge could not be sent.` |
| Failed request | network / 5xx / unparsable | same as refusal | same line |
| Slow read | stored `{after_pick, true}`, read answers `{after_pick, false}` same rank | stays spent | — |
| New slot | stored `{after_pick, true}`, read `{evening, false}` | `{evening, false}`: enabled | — |
| 20:00 / return | Daily open at 19:59 local, or tab becomes visible | `loadDailyDay()` once at 20:00 (and each day after), and on each `visibilitychange` to visible | — |
| Partner's `daily_nudge` | broadcast `{ day_id }` from the partner | Daily `refreshDailyDay(day_id)`; Partner page, link, dates listeners do nothing | malformed / no partner known → dropped |

</intent-contract>

## Code Map

- `src/api/validation/dailyQuestionSchemas.ts:18-38` -- `DailyDaySnapshotSchema`: add `nudge: z.object({ slot: z.enum(['after_pick','evening']).nullable(), spent: z.boolean() }).optional()` (optional like `write.target_day`, so saved days and test fixtures without it parse).
- `src/services/dailyDaysCopy.ts:57-65,153-170` -- `keepWriteDone` and `mergeSnapshots`: add exported `keepNudgeSpent(entry, other)` beside `keepWriteDone`, apply it with `keepWriteDone` in `mergeSnapshots`; header comment line on the rule.
- `src/stores/slices/dailyDaySlice.ts:184-196` -- `mergeAnswer`: apply `keepNudgeSpent` with `keepWriteDone`. Add `sendDailyNudge` to `DailyDaySlice` and the returned object (template: `submitWrittenQuestion` at its end of file; `refreshDailyDay` for the re-read); header comment paragraph.
- `src/api/dailyQuestionApi.ts:240-244` -- beside `announceDailyPick`: `announceDailyNudge(dayId)`; new `sendDailyNudge(dayId): Promise<DailyDaySnapshot>` (`refuseOffline('Your nudge','send')`, rpc `send_daily_nudge` `{ day_id }` with `requestTimeout()`, parse, map `NUDGE_REFUSAL_CODES` to `AccountDataError('refused', NUDGE_FAILED_MESSAGE, { cause })`, else `toAccountDataError`); export `NUDGE_FAILED_MESSAGE = 'Your nudge could not be sent.'`; module header paragraph. Types already hold `send_daily_nudge` (story 8.7).
- `src/api/validation/broadcastSchemas.ts:20-60,265-303` -- `DAILY_NUDGE_EVENT = 'daily_nudge'` (doc as `DAILY_PICK_EVENT`), appended to `PARTNER_EVENTS`; `PartnerEvent` gains `{ event: 'daily_nudge'; day_id }`; `parsePartnerEvent` handles it exactly as `daily_pick` (shared local helper, same `{ day_id: uuid }` schema); module/function docs list it.
- `src/api/moodSyncService.ts:45-60,697-716` -- `PartnerEventHandlers` doc line; `dispatchPartnerEvent` case for `DAILY_NUDGE_EVENT` (the `never` default forces it).
- `src/hooks/useDailyPickListener.ts` -- add the `daily_nudge` handler; header bullet.
- `src/components/DailyQuestion/DailyQuestion.tsx:316-326` -- the `state === 'me'` `daily-waiting` line becomes the dashed `WaitingCard` (Design Notes); header paragraph. Mount the 20:00/return re-read hook in `DailyQuestion`.
- `src/hooks/useDailyDayRereads.ts` (new) -- the 20:00 timer and the visibility re-read (Design Notes).
- Tests to extend: `tests/unit/api/broadcastSchemas.test.ts:259-316`, `tests/unit/api/partnerEvents.test.ts:252-264` (+ a dispatch test), `src/hooks/__tests__/useDailyPickListener.test.ts:48-58`, `src/hooks/__tests__/usePartnerStreakListener.test.ts:50-60`, `src/hooks/__tests__/usePartnerLinkListener.test.ts`, `src/hooks/__tests__/useDatesChangedListener.test.ts`, `src/components/PartnerView/__tests__/PartnerView.listener.test.tsx:109-119`, `tests/unit/services/dailyDaysCopy.test.ts`, `tests/unit/stores/dailyQuestionSlice.writeQuestion.test.ts` as the template for a new `tests/unit/stores/dailyQuestionSlice.nudge.test.ts` (fixtures in `dailyQuestionFixture.ts`), `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx` (keeps every `daily-waiting` assertion: the card root carries that test id and its text contains "Waiting on {partner}"), and `src/api/__tests__/dailyQuestionApi.test.ts`.
- E2E templates: `tests/e2e/daily/daily-question-pick-and-reveal.spec.ts` (two contexts, `clearPairDays` before and at teardown, `interceptNetworkCall`), `tests/e2e/daily/daily-question-offline-pick.spec.ts` (`goOffline`, `trackReads` request counter, `test.use({ trace: 'off', video: 'off' })`); globs in `tests/support/helpers/reads.ts:116-131`. `clearPairDays` deletes `couple_days`, which cascades `daily_nudges` (audited table).
- Design: board `Waiting.dc.html` of https://claude.ai/artifact/8wnGn8SjpqJwSckSUVBaEh.

## Tasks & Acceptance

**Execution:**
- [x] `src/api/validation/dailyQuestionSchemas.ts` -- optional `nudge` -- the client sees the slot.
- [x] `src/services/dailyDaysCopy.ts` -- `keepNudgeSpent` + use in `mergeSnapshots` -- AD-13 rule in the copy.
- [x] `src/api/validation/broadcastSchemas.ts`, `src/api/moodSyncService.ts` -- `daily_nudge` in the registry -- AD-11.
- [x] `src/api/dailyQuestionApi.ts` -- `sendDailyNudge`, `announceDailyNudge`, `NUDGE_FAILED_MESSAGE` -- the request.
- [x] `src/stores/slices/dailyDaySlice.ts` -- `mergeAnswer` rule; `sendDailyNudge()` action -- the state.
- [x] `src/hooks/useDailyPickListener.ts` -- `daily_nudge` handler -- the receiver.
- [x] `src/hooks/useDailyDayRereads.ts` + mount in `DailyQuestion.tsx` -- 20:00 and return re-reads.
- [x] `src/components/DailyQuestion/DailyQuestion.tsx` -- `WaitingCard` -- the button.
- [x] Unit tests (files in Code Map) -- schema parse with/without `nudge`; merge rows of the matrix (copy and `mergeAnswer`); API offline/refusal/failure/success mapping and broadcast payload; slice: success (merge, one broadcast), refusal and failed request (throws, no broadcast, `refreshDailyDay` once, session-change writes nothing), offline (no request, no re-read); view: enabled/disabled states incl. missing `nudge`, disabled while sending, refusal and failed request show the line, offline shows the sentence; hook: fires at 20:00 local (fake `setTimeout`/`Date` only), re-arms, visibility re-read, cleans up; registry: `daily_nudge` parsed/dropped/dispatched to its handler only, Daily listener per event + `SUBSCRIBED`, the four other listeners register no `daily_nudge`.
- [x] `tests/e2e/daily/daily-question-nudge.spec.ts` -- new `[P0]` spec per Design Notes -- the ticket's E2E.

**Acceptance Criteria:**
- Given the worker picked and the partner has not, when the worker taps Nudge, then exactly one `send_daily_nudge` request answers 200, one `daily_nudges` row exists for the pair, and the button is disabled, also after a reload.
- Given the same state offline, when the worker taps Nudge, then the offline sentence shows, no `send_daily_nudge` request is made and no row exists.
- Given `npm run test:unit`, `npm run typecheck` and `npm run lint`, when run, then all pass.

## Implementation Notes

- 2026-11-26: implemented by a Sonnet subagent from this plan; checked in the parent session against the diff. New files: `src/hooks/useDailyDayRereads.ts`, `src/hooks/__tests__/useDailyDayRereads.test.ts`, `tests/unit/stores/dailyQuestionSlice.nudge.test.ts`, `src/components/DailyQuestion/__tests__/DailyQuestion.nudge.test.tsx` (its own file because adding to `DailyQuestion.test.tsx` passed the 1000-line limit), `tests/e2e/daily/daily-question-nudge.spec.ts`; `nudgeSnapshot` added to `tests/unit/stores/dailyQuestionFixture.ts`; `DAILY_NUDGE_SEND` to `tests/support/helpers/reads.ts`.
- Deviation from Design Notes: `WaitingCard` renders as a sibling after `DayCard` in `DailyQuestion` (keyed `${day_id}:waiting`), not as a fragment returned by `DayCard`; same layout and position.
- The two unknown-event tests now use `daily_poke`; the two event-list pins list five events, `daily_nudge` after `daily_pick`.
- The E2E presses Escape on the write-tomorrow sheet when the worker is the day's writer, since the sheet covers the card.
- The host-clock flake of the new spec went into this plan's `deferred` list (the loop files it), not straight into the ledger.
- Verification (parent session): `npm run typecheck` 0, `npm run lint` 0, `npm run test:unit` 264 files / 5103 tests passed, `npx playwright test tests/e2e/daily/daily-question-nudge.spec.ts tests/e2e/daily/daily-question-pick-and-reveal.spec.ts --project=chromium` 2 passed, row audit clean (Supabase CLI 2.122.0).

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 33 findings — high 0, medium 3, low 13, false 17, maybe-false 0
- findings:
  - `[low]` `[defer]` (blind-hunter) keepNudgeSpent keys on slot, not the sender's date, so a sender past midnight sees a greyed button the server would accept — real; same root cause as 8.7's deferred AD-17 sender-date crossing, needs zones far apart and the day on screen after the sender's midnight; deferred (see `deferred`).
  - `[low]` `[patch]` (blind-hunter) sendDailyNudge sets dailyDay with no on-screen guard, so a day re-read mid-request is replaced by the nudged day — real. Fixed: shown through `showIfOnScreen(snapshot, merged)`; new slice test with the shown day changing during the request.
  - `[low]` `[defer]` (blind-hunter) After P0002 the re-read of the same day_id fails, leaving a stale enabled card — real; needs an unlink between show and tap, fix adds a branch; deferred.
  - `[false]` `[reject]` (blind-hunter) The receiver's daily_nudge re-read changes nothing visible — the intent requires Daily's listener to re-read that day (AD-11); one idempotent read is the designed cost, not a defect.
  - `[low]` `[patch]` (blind-hunter) useDailyDayRereads header claims a session re-check the callback lacks and names the server's clock — real. Fixed: comment says the effect cleanup clears the timer, and the slot turns at 20:00 in the sender's stored zone.
  - `[low]` `[defer]` (blind-hunter) No re-read at the sender's midnight — real and pre-existing (Daily never re-read at midnight); deferred.
  - `[false]` `[reject]` (blind-hunter) A refusal is logged twice at error level and the card's log is unasserted — the pick path logs the same way (`logSupabaseError` in the API, `console.error` in DayCard); the test asserts no console spy, which no rule forbids; no named harm.
  - `[low]` `[patch]` (blind-hunter) dailyDaysCopy.test.ts copies the shared `nudgeSnapshot` as a local `nudged` — real (AGENTS.md shared helpers). Fixed: imports `nudgeSnapshot`.
  - `[low]` `[patch]` (blind-hunter) mergeSnapshots' loop variable `other` shadows the new `other` snapshot — real; a later edit in the loop would read a stored entry for the snapshot. Fixed: loop variable renamed `saved`.
  - `[false]` `[reject]` (blind-hunter) E2E covers no refusal and no partner-side broadcast — the ticket's Verify assigns refusals and registry events to unit tests, which cover both; the E2E covers every step the ticket gives it.
  - `[false]` `[reject]` (blind-hunter) Every return re-reads the day on top of other reads, and ignores isOnline — the intent asks for the return re-read; loadDailyDay is idempotent and refuses offline before any request, keeping the shown day.
  - `[low]` `[patch]` (blind-hunter) Two edited doc comments in dailyDaysCopy.ts run far past the line width — real. Fixed: rewrapped.
  - `[false]` `[reject]` (blind-hunter) Hook tests miss a userId change, DST and an early-firing timer — a userId change takes the same `session` path the version test covers; the local Date constructor handles DST; an early fire costs one idempotent read, no visible outcome.
  - `[false]` `[reject]` (blind-hunter) Effect lists both `signedIn` and `session` — redundant but harmless, as in useDatesChangedListener; no caller diverges.
  - `[low]` `[patch]` (edge-case-hunter) Nudge answer replaces a newer day on screen — same root cause as the blind-hunter on-screen row; fixed with it.
  - `[low]` `[defer]` (edge-case-hunter) A timeout after commit shows the failure line though the push went out — real; needs a timeout after commit, and the fix needs a rule the intent does not give; deferred.
  - `[false]` `[reject]` (edge-case-hunter) nudgeError stays after the snapshot changes — the line reports the last tap's outcome, as the intent asks, and clears on the next tap like the refused-pick box the intent cites; clearing on a snapshot change would hide the refusal line the intent requires.
  - `[false]` `[reject]` (edge-case-hunter) A failed partner lookup skips the broadcast silently — the receiver's re-read changes nothing visible (see above), and announceDailyPick has the same send-side lookup; no user outcome.
  - `[low]` `[defer]` (edge-case-hunter) Device zone vs stored zone for the 20:00 timer — every Daily read stores this device's zone, so they differ only when the same account reads from a second device in another zone; deferred.
  - `[false]` `[reject]` (edge-case-hunter) An early timer re-arms and reads twice — one extra idempotent loadDailyDay, nothing shown changes.
  - `[low]` `[patch]` (edge-case-hunter) The hook comment's session re-check claim — same as the blind-hunter comment row; fixed with it.
  - `[medium]` `[patch]` (verification-gap) The card's refusal test never checks the failure line — gap as filed. Fixed: a refusal case whose re-read keeps the card (spent) asserts exactly `Your nudge could not be sent.` and a disabled button.
  - `[medium]` `[patch]` (verification-gap) No test shows DailyQuestion mounts useDailyDayRereads — gap as filed. Fixed: a component test where a visibilitychange re-read moves the button from spent after_pick to an enabled evening slot.
  - `[medium]` `[patch]` (verification-gap) The E2E reload check passes on the local copy alone — gap as filed. Fixed: the spec asserts the reload's get_daily_day body has `nudge` `{ slot: rows[0].slot, spent: true }`.
  - `[low]` `[patch]` (verification-gap, other) The hook header's session re-check claim — same as the blind-hunter comment row; fixed with it.
  - `[false]` `[reject]` (intent-alignment) Offline refuses at the API's `refuseOffline`, not `requireOnline` in the component — `refuseOffline` is the module's singular-verb `requireOnline` over `offlineMessage`, used by every daily RPC; `requireOnline` would print "Your nudge need"; the sentence is the one the intent asks for.
  - `[low]` `[defer]` (intent-alignment) 20:00 on the device clock vs the stored zone — same as the edge-case-hunter zone row; deferred with it.
  - `[medium]` `[patch]` (intent-alignment) The refusal line is unasserted at the card — same as the verification-gap refusal row; fixed with it.
  - `[false]` `[reject]` (intent-alignment) A stored entry winning on state rank keeps its slot over a new one — the stored entry wins only over a lower-state, older answer (`both` with slot null, or `me` over a `none` with slot null), so no newer slot is lost.
  - `[medium]` `[patch]` (intent-alignment) The E2E reload does not isolate the server — same as the verification-gap E2E row; fixed with it.
  - `[false]` `[reject]` (intent-alignment) Story 9 must repeat the card's message choice — story 9 imports `NUDGE_FAILED_MESSAGE` and the offline error carries its own message; nothing diverges in this change.
  - `[false]` `[reject]` (intent-alignment) No new SUBSCRIBED assertion — the existing "re-reads today on every SUBSCRIBED" tests stand unchanged, which is what "SUBSCRIBED … unchanged" asks.
  - `[false]` `[reject]` (intent-alignment) The shared `parseDayBroadcast` refactor of daily_pick parsing — behaviour and messages unchanged, every daily_pick test still passes; not a defect.

## Design Notes

`keepNudgeSpent` (copy and slice share it; keep it next to `keepWriteDone`, one helper each, since both are called at the same two sites):

```ts
export function keepNudgeSpent(entry: DailyDaySnapshot, other: DailyDaySnapshot | undefined): DailyDaySnapshot {
  const slot = entry.nudge?.slot ?? null;
  if (slot === null || entry.nudge?.spent || other?.nudge?.slot !== slot || !other.nudge.spent) return entry;
  return { ...entry, nudge: { slot, spent: true } };
}
```

`WaitingCard` (sibling below the day card: `DayCard` returns a fragment of its card and, for `state === 'me' && mine`, the waiting card in place of the line). Root `data-testid="daily-waiting"`: `flex flex-col items-center gap-2.5 rounded-[20px] border-2 border-dashed border-partner/40 bg-ptint/50 p-[18px] text-center`; tile `h-11 w-11 rounded-[14px] bg-ptint text-partner` holding lucide `Hourglass`; `Waiting on {partnerNameInline}` (15px semibold ink); `They can't see your pick until they make theirs.` (13px muted); button `data-testid="daily-nudge"`, lucide `Bell` + `Nudge {partnerNameInline}`, `inline-flex h-11 items-center gap-2 rounded-full bg-ptint px-[18px] text-sm font-semibold text-partner` plus the kit's focus/disabled classes; failure box `FAILURE_BOX`, `role="alert"`, `data-testid="daily-nudge-error"`, cleared on the next tap. Error text: `AccountDataError` with code `offline` → its message; anything else → `NUDGE_FAILED_MESSAGE`.

`useDailyDayRereads()`: while signed in, a `setTimeout` to the next local 20:00:05 (`new Date(y, m, d, 20, 0, 5)`, next day's when past; the 5 s lets a server clock slightly behind the device answer the evening slot), which calls `loadDailyDay()` and re-arms; a `visibilitychange` listener that calls `loadDailyDay()` when visible. Both cleaned up on unmount and on session change.

E2E `daily-question-nudge.spec.ts` (`test.use({ trace: 'off', video: 'off' })`): pooled pair, `clearPairDays` before and deferred; the partner's context opens `/daily` first (writes the partner's zone, so their date is the worker's); the worker opens `/daily`, picks; `daily-nudge` enabled; `goOffline(page, true)`, tap → `daily-nudge-error` has the offline sentence, request counter for `**/rest/v1/rpc/send_daily_nudge` started 0, admin count of `daily_nudges` for the pair's day 0; online, tap → response 200, button disabled, one row (slot from the row, never guessed from the host clock); reload (await `DAILY_DAY_READ`) → button disabled. Add `DAILY_NUDGE_SEND` to `reads.ts`. A run crossing 20:00 or midnight between the nudge and the reload is the low host-clock flake stories 8.3/8.6/8.7 deferred; add a matching `deferred` entry.

## Verification

**Commands:**
- `npx vitest run tests/unit/api/broadcastSchemas.test.ts tests/unit/api/partnerEvents.test.ts tests/unit/services/dailyDaysCopy.test.ts src/hooks/__tests__ src/components/DailyQuestion src/components/PartnerView/__tests__/PartnerView.listener.test.tsx` plus the slice and API test files touched -- expected: pass.
- `npm run test:unit` -- expected: pass.
- `npm run typecheck && npm run lint` -- expected: pass.
- `supabase status` (local stack running, pinned CLI) then `npx playwright test tests/e2e/daily/daily-question-nudge.spec.ts tests/e2e/daily/daily-question-pick-and-reveal.spec.ts --project=chromium` -- expected: pass (project name from `playwright.config.ts`).

## Auto Run Result

- **Summary:** The waiting screen's Nudge button nudges the partner (R2; spine AD-11, AD-13, AD-16, AD-17).
  - `DailyDaySnapshotSchema` parses an optional `nudge { slot, spent }`; a day without it reads as no slot.
  - `keepNudgeSpent` keeps `nudge.spent` one-way within a slot, in the copy merge and in the slice's `mergeAnswer`; a new slot starts unspent.
  - `sendDailyNudge` (API and `dailyDaySlice` action): offline refuses with "You are offline. Your nudge needs a connection to send." and no request; a refusal (DQ007–DQ010, P0002) or a failed request announces nothing and re-reads the day; a confirmed send merges the snapshot, shows it if that day is on screen, and broadcasts `daily_nudge { day_id }`.
  - `daily_nudge` joins `PARTNER_EVENTS`, `parsePartnerEvent` and the dispatch; Daily's listener re-reads the named day; the Partner page, partner-link and dates-changed listeners register nothing for it.
  - The plain "Waiting on" line is the board's dashed waiting card with the Nudge button; `useDailyDayRereads` re-reads the day at local 20:00:05 and on each return to the front.
- **Files changed:**
  - `src/api/validation/dailyQuestionSchemas.ts`: optional `nudge`.
  - `src/services/dailyDaysCopy.ts`: `keepNudgeSpent`, used in `mergeSnapshots`.
  - `src/api/validation/broadcastSchemas.ts`, `src/api/moodSyncService.ts`: the `daily_nudge` event.
  - `src/api/dailyQuestionApi.ts`: `sendDailyNudge`, `announceDailyNudge`, `NUDGE_FAILED_MESSAGE`.
  - `src/stores/slices/dailyDaySlice.ts`: the `sendDailyNudge` action and the merge rule.
  - `src/hooks/useDailyPickListener.ts`: the `daily_nudge` handler.
  - `src/hooks/useDailyDayRereads.ts`: new, the 20:00 and return re-reads.
  - `src/components/DailyQuestion/DailyQuestion.tsx`: `WaitingCard`, and the hook mounted.
  - Tests: `dailyQuestionApi.test.ts`, `broadcastSchemas.test.ts`, `partnerEvents.test.ts`, `dailyDaysCopy.test.ts`, the five listener tests, `dailyQuestionFixture.ts` (`nudgeSnapshot`); new `dailyQuestionSlice.nudge.test.ts`, `useDailyDayRereads.test.ts`, `DailyQuestion.nudge.test.tsx`, `tests/e2e/daily/daily-question-nudge.spec.ts`; `tests/support/helpers/reads.ts` gains `DAILY_NUDGE_SEND`.
- **Review findings:** 33 findings from one thorough pass with four lenses: high 0, medium 3, low 13, false 17.
  - **Patched (3 medium, 7 low rows, in 7 fixes):** the on-screen guard on the nudge answer; the hook comment; the shared test helper; the shadowed loop variable; the doc-comment widths; the card's refusal-line test; the hook-mount test; the E2E reload body check.
  - **Deferred (5 entries in `deferred`, 6 low rows):** the sender-date slot key (8.7's AD-17 root cause); the stale card after P0002; no midnight re-read (pre-existing); a timeout after commit; device zone vs stored zone. Plus the new spec's host-clock flake, recorded at implementation.
  - **Rejected as false (17):** each with its refutation in the Review Triage Log: the receiver re-read is intent-mandated; logging matches the pick path; E2E scope matches the ticket's Verify; the return re-read is idempotent and intended; hook test gaps have no outcome; redundant deps are harmless; a stale line is the intent's refused-pick behaviour; a skipped broadcast has no visible effect; an early timer costs one idempotent read; `refuseOffline` is the singular `requireOnline`; the rank-kept slot loses no newer slot; story 9 reuses the message constant; SUBSCRIBED tests stand; the parse refactor keeps behaviour; and the duplicate rows of each.
- **Follow-up review recommendation:** `false`. This first pass patched 0 high and 3 medium entries. The three mediums are all test gaps, closed by new assertions that pass, so no unverified risk remains to name.
- **Verification (2026-11-26, after the patches):**
  - `npm run typecheck` and `npm run lint`: clean.
  - `npm run test:unit`: 264 files, 5106 tests passed.
  - `npx playwright test tests/e2e/daily/daily-question-nudge.spec.ts tests/e2e/daily/daily-question-pick-and-reveal.spec.ts --project=chromium`: 2 passed, row audit clean (Supabase CLI 2.122.0, shared local stack, no reset).
  - The implementer also ran all of `tests/e2e/daily` and the two Partner specs that read `daily-waiting` (34 passed) before the patches.
- **Residual risks:**
  - The six deferred items in `deferred`.
  - Story 8.9 (the after-pick sheet) calls `sendDailyNudge` and must show `NUDGE_FAILED_MESSAGE`, or the offline error's own message, on a failure.
