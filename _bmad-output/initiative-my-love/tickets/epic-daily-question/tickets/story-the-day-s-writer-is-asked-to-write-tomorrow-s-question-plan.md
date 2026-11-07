---
title: "The day's writer is asked to write tomorrow's question"
type: 'feature'
ticket: '8'
created: '2026-11-06'
status: done
baseline_revision: 'd6d7c534407a648146b8d464a4a3b0f987db0cfc'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 3 put `submit_written_question` on the server, but no screen calls it. The day's writer is never asked to write tomorrow's question, and the device has nowhere to keep a "No thanks" (epic R3, R4; spine AD-4, AD-13, AD-16).

**Approach:** When the snapshot on screen holds the writer's own server pick (`my_choice` set), with `write.mine` true, `write.done` false, the day not declined on this device and the day being today, Daily opens a bottom sheet titled "Write tomorrow's question?". The sheet has This and That fields, a "{This} or {That}?" preview, the option rules, Send for tomorrow (which calls a new `submitWrittenQuestion` API and slice action and merges the returned snapshot), and "No thanks, pick one for us", which writes the `day_id` to the new device-state local-copy kind `daily-write-declined`.

## Boundaries & Constraints

**Always:**
- Show rule: `snapshot.my_choice !== null && write.mine && !write.done && !declined.includes(day_id) && snapshot.day === formatDateISO(new Date())`, and not closed during this mount. A queued (unsent) pick never opens it. The partner (`write.mine` false) never sees it.
- Closing it with a tap on the scrim, or with Escape, hides it until the next mount of Daily (a later open, or a reload). Only Send succeeding (`write.done`) or No thanks stop it for the day.
- Copy, from the owner-approved mock-up `Tomorrow.dc.html`:
  - label "Tomorrow";
  - title "Write tomorrow's question?";
  - sub-line "{partner} gets it tomorrow. You'll answer it too.";
  - fields labelled This and That, with an "or" divider between them;
  - preview box "{partner} will see" over `{this.trim() || '…'} or {that.trim() || '…'}?`, case kept as typed;
  - buttons Send for tomorrow (primary) and No thanks, pick one for us (secondary, lucide `Shuffle` icon `aria-hidden`).
- A rules line sits above Send: "Each option is 1 to 40 characters, and the two must be different." The client does not pre-validate: the server judges (R4), so Send is disabled only while a send is in flight. Inputs use `fieldClass` (16px).
- Sheet layout: `fixed inset-0 z-50` scrim (`bg-black/50`, items at the end), padded `pt/pl/pr` by `env(safe-area-inset-top/left/right)`. The panel is `rounded-t-[28px] bg-card`, `max-h-full overflow-y-auto`, and its bottom padding is `calc(1.25rem + env(safe-area-inset-bottom))`. It has no animation: it opens and closes at once (AGENTS: back-swipe picture, Reduce Motion). `role="dialog" aria-modal aria-labelledby`, `useFocusTrap` with Escape closing it; initial focus on the panel, not a field, so the iOS keyboard does not pop up.
- API `submitWrittenQuestion(dayId, thisText, thatText)` in `dailyQuestionApi.ts`:
  - `refuseOffline("Tomorrow's question", 'send')` before any request ("You are offline. Tomorrow's question needs a connection to send.");
  - sends the raw texts (the server trims) and parses `DailyDaySnapshotSchema`, with `requestTimeout()`;
  - refusal mapping, as `AccountDataError('refused', message, { cause })` with a new `'refused'` code added to `AccountDataErrorCode`:
    - `DQ003` → the server's own message;
    - `DQ004` → "It is your partner's turn to write tomorrow's question.";
    - `DQ005` → "Send your own pick before writing tomorrow's question.";
    - `DQ006` → "Today's turn to write has ended. Tomorrow's question will come from the pool.";
    - anything else → `toAccountDataError`.
- Slice `submitWrittenQuestion(thisText, thatText)`: plain `Error` when signed out or no day shown. It captures and re-checks `{ userId, authSessionVersion }`, merges the snapshot via `mergeDailyDay`, then sets `dailyDay: mergeAnswer(...)`. It throws the request's error. `declineWrittenQuestion(dayId)`: session-checked; adds the id through the new service, then sets `dailyWriteDeclined`. On a write failure it logs and resolves: the sheet still closes for this mount.
- New `src/services/dailyWriteDeclined.ts`:
  - `DAILY_WRITE_DECLINED_KIND = 'daily-write-declined'`, value `string[]`;
  - `readDeclinedWriteDays(userId)` returns `[]` on null, a failure or a non-array; `addDeclinedWriteDay(userId, dayId)` runs under a new waiting lock `DAILY_WRITE_DECLINED_LOCK` in `syncLock.ts`, dedupes, keeps the newest 31 ids and throws on a write failure.
  - No `registerLocalCopy`: it has no server source.
- `dailyWriteDeclined: string[]` is loaded in `loadDailyDay` step 1, beside `showQueuedPicks`, and added to `signedOutState()`. The kind is removed on sign-out by the existing `deleteAccountCopies`.
- `localCopy.ts` header, FILL SOURCES rule: add that the device-state kind `daily-write-declined` is exempt. It is written only by this device's "No thanks" and never refreshed from the server (AD-13).

**Never:** SQL, migration or type changes; a write card on the reveal; the nudge prompt (epic 8); a server-side record of "No thanks"; client-side option validation that blocks Send; editing `database.types.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Writer picks online | `write.mine`, pick confirmed | sheet opens at once | — |
| Partner picks | `write.mine` false | no sheet ever | — |
| Writer picked offline | queued row only, `state` none/partner | no sheet; opens once the drain merges the server snapshot | — |
| Reopen Daily / reload | still mine, not done, not declined | sheet again | — |
| Scrim / Escape | sheet open | closes; returns on next mount | — |
| Valid send | `' Beach '`, `Mountains` | one `submit_written_question`; sheet closes, `write.done` true; never again that day | — |
| Server refusal | `Tea` / `tea` | sheet stays, reason in `FAILURE_BOX` | "The two options must differ" |
| Offline send | `navigator.onLine` false | no request; offline sentence shown | `AccountDataError('offline')` |
| No thanks | tap | id saved in kind; sheet closes; not on next mount or reload | write failure logged, closes anyway |
| Done elsewhere | snapshot `write.done` true | no sheet | — |
| Stale day | snapshot `day` ≠ device date | no sheet | — |

</intent-contract>

## Code Map

- `src/api/dailyQuestionApi.ts` -- `refuseOffline`, `submitDailyPick` (the pattern to copy, including the DQ001 special case), `toAccountDataError`. Add `submitWrittenQuestion` and `WRITE_REFUSAL_MESSAGES`; update the module header.
- `src/services/accountDataError.ts:16-22` -- the `AccountDataErrorCode` union; add `'refused'`. Grep for exhaustive uses before adding it.
- `src/stores/slices/dailyQuestionSlice.ts` -- `mergeAnswer`, `loadDailyDay` step 1 (`Promise.all` with `showQueuedPicks`), and the session-capture pattern in `submitDailyPick`. Add the field, the two actions and a header paragraph.
- `src/stores/slices/authSlice.ts:250-257` -- the daily fields in `signedOutState()`.
- `src/services/dailyDaysCopy.ts` -- `mergeDailyDay`. Copy its shape (read, change, write under `withWaitingLock`) for `dailyWriteDeclined.ts`. `src/services/syncLock.ts:96` -- `DAILY_DAYS_LOCK`; add the new lock beside it.
- `src/services/localCopy.ts:37-40` -- the FILL SOURCES rule to amend.
- `src/components/DailyQuestion/DailyQuestion.tsx` -- `DayCard` and the `DailyQuestion` root. Render the new `WriteQuestionSheet` from the root while the show rule holds; keep a per-mount `closedFor: day_id | null` state. Put the sheet in its own file, `src/components/DailyQuestion/WriteQuestionSheet.tsx`.
- `src/components/shared/kitClasses.ts` -- `fieldClass`, `FIELD_LABEL`, `PRIMARY_BUTTON`, `SECONDARY_BUTTON`, `FAILURE_BOX`, `FOOTNOTE`. `DIALOG_SCRIM` shows the inset padding pattern. `src/hooks/useFocusTrap.ts` -- as `KitDialog` uses it (`Settings/ConfirmDialog.tsx:41-92`).
- `src/api/validation/dailyQuestionSchemas.ts` -- the snapshot already has `write { mine, done }`; no change.
- Server reference (read-only): `supabase/migrations/20261106000000_daily_question_written_questions.sql:116-167` (the messages for P0002 and DQ003 to DQ006).
- Tests to update or add:
  - `src/api/__tests__/dailyQuestionApi.test.ts`;
  - `tests/unit/stores/dailyQuestionSlice.test.ts` (or a new `dailyQuestionSlice.writeQuestion.test.ts` copying its `vi.mock`/fake-Date header);
  - new `tests/unit/services/dailyWriteDeclined.test.ts`, modelled on `dailyDaysCopy.test.ts`;
  - `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx`;
  - `tests/unit/stores/signOutClearsAccountState.test.ts:109-112,241-260` (expected and seeded `dailyWriteDeclined`);
  - `tests/unit/stores/dailyQuestionFixture.ts:22` (default `write`; add an override helper if needed).
- E2E kit:
  - `tests/e2e/daily/daily-question-pick-and-reveal.spec.ts` shows the two-page setup, `clearPairDays`, `ensureTestCoachQuestions` and `interceptNetworkCall`;
  - `tests/support/factories/daily-question.ts` -- add `readPairDayWriter(admin, pair)`, which returns the `couple_days.writer` of the pair's one row, and `readPairWrittenQuestions(admin, pair)` (`daily_questions` rows with `user_a/user_b` = pair: `this_text`, `that_text`, `source_day_id`);
  - `tests/support/helpers/reads.ts` -- add `WRITTEN_QUESTION_SEND = '**/rest/v1/rpc/submit_written_question'`, in the style of `DAILY_PICK_SEND`;
  - `tests/support/helpers/offline.ts` (`goOffline`); `skipNetworkMonitoring` annotation for the spec that expects the 400, as `daily-question-offline-pick.spec.ts` does.
- Existing daily E2E specs (`live-pick`, `offline-pick`, `pick-and-reveal`, `offline-and-invite`): after the writer's pick the sheet's scrim now covers the page. Any later click on the writer's page must first close the sheet (Escape or a scrim click), or the test must pick on the non-writer's page. Keep every existing assertion (AGENTS lesson L4).

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/accountDataError.ts` -- add `'refused'` to the union.
- [ ] `src/services/syncLock.ts`, `src/services/dailyWriteDeclined.ts` -- the lock and the kind service.
- [ ] `src/services/localCopy.ts` -- the header exemption.
- [ ] `src/api/dailyQuestionApi.ts` -- `submitWrittenQuestion` and the refusal mapping.
- [ ] `src/stores/slices/dailyQuestionSlice.ts`, `src/stores/slices/authSlice.ts` -- `dailyWriteDeclined`, `submitWrittenQuestion`, `declineWrittenQuestion`, the load in step 1, `signedOutState()`.
- [ ] `src/components/DailyQuestion/WriteQuestionSheet.tsx`, `DailyQuestion.tsx` -- the sheet and the show rule; update the view header.
- [ ] Unit tests: every matrix row at the view or slice level. Also:
  - the API test: the RPC name and args, offline with zero `rpc` calls, each DQ code's message;
  - the kind service: dedupe, cap, a failed read giving `[]`;
  - sign-out clearing the field;
  - a stale-session guard on both actions;
  - the sheet's panel and scrim class strings containing all four `safe-area-inset` names.
- [ ] `tests/support/factories/daily-question.ts`, `tests/support/helpers/reads.ts` -- the helpers above.
- [ ] `tests/e2e/daily/daily-question-write-tomorrow.spec.ts` (new) -- the ACs below. Pages: the writer's page and the non-writer's, chosen from `readPairDayWriter` after both pages have opened `/daily` (that read assigns the day). Clear days before and at teardown.
- [ ] Existing daily E2E specs -- adjust for the sheet as noted in the Code Map.

**Acceptance Criteria:**
- Given the worker pair on a local stack with cleared days, both on `/daily`, when the non-writer picks, then their page never shows `daily-write-sheet`. When the writer then picks, then the sheet shows right after the pick is confirmed, and again after a reload of the writer's page.
- Given the writer's sheet open, when the writer types `Tea` and `tea` and taps Send for tomorrow, then `submit_written_question` answers 400, the sheet shows "The two options must differ", and no written row exists. When the page goes offline and Send is tapped, then no further `submit_written_question` request is made and the sheet shows "You are offline. Tomorrow's question needs a connection to send."
- Given the writer's sheet open and online, when they send `Beach` / `Mountains`, then one `submit_written_question` answers 200, the sheet closes, `readPairWrittenQuestions` holds one row (`Beach`, `Mountains`, `source_day_id` = today's day), and after a reload the sheet does not return.
- Given cleared days and the writer picked again, when they tap No thanks, pick one for us, then the sheet closes, no request is made, the writer's IndexedDB `local-copies` row `[writerId, 'daily-write-declined']` holds today's `day_id`, and after a reload the sheet does not return.

## Implementation Notes

- Built as planned by the implementing subagent. The sheet is `src/components/DailyQuestion/WriteQuestionSheet.tsx`. `DailyQuestion` keeps a per-mount `writeClosedFor` day id, so a scrim tap or Escape hides the sheet for that day on this mount only.
- Deviations:
  - The view tests are in a new `__tests__/WriteQuestionSheet.test.tsx`. Adding them to `DailyQuestion.test.tsx` would have taken that file past the TEA hook's 1000-line limit.
  - The slice tests are in a new `tests/unit/stores/dailyQuestionSlice.writeQuestion.test.ts`. The fixture gained `writerSnapshot`.
  - No existing daily E2E spec needed a change. None clicks on the writer's page after the writer's pick, and a scrim does not affect `toBeVisible` or IndexedDB reads.
- E2E: `tests/e2e/daily/daily-question-write-tomorrow.spec.ts` has six tests. They cover:
  - only the writer is asked, and asked again after a reload;
  - a scrim tap hides the sheet until the next open;
  - a valid send;
  - No thanks;
  - an offline send;
  - the `Tea`/`tea` refusal, in its own `skipNetworkMonitoring` describe.
- Verified by the parent:
  - typecheck, lint and Knip exit 0;
  - `test:unit`: 247 files, 4557 tests; `SEED=101 test:unit:coverage` passes the same;
  - the local stack is at `20261106010000`;
  - `tests/e2e/daily/`: 13 passed, row audit clean;
  - the new spec with `--repeat-each=3`: 18 passed.
- Matrix audit: every row has a passing test.
  - Covered in `WriteQuestionSheet.test.tsx`: queued-only, drain-opens, done elsewhere, stale day, Escape, and a No thanks write failure that still closes the sheet.
  - Covered in E2E, and in unit tests as well: the writer, the partner, reload, scrim, valid send, refusal, offline and No thanks.
- Residual: only today's writer parity ran in E2E (the writer follows the date). A `loadDailyDay` that read the declined kind before a concurrent No thanks finished can briefly reset `dailyWriteDeclined`; the per-mount close still hides the sheet.

## Plan Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 5 findings — high 0, medium 1, low 3, false 1, maybe-false 0
- findings:
  - `[medium]` `[patch]` A read in flight when Send succeeds lands with the same rank and `write.done` false, undoing the sent turn in `dailyDay` and the copy, so the sheet reopens. Confirmed: `mergeAnswer` and `mergeDailyDay` compared state rank only, and `refreshDailyDay` from a partner's `daily_pick` can be in flight. Fixed: the new `keepWriteDone` (`dailyDaysCopy.ts`) keeps `write.done` true for the same `day_id` in both merges; tests are in `dailyDaysCopy.test.ts` and `dailyQuestionSlice.writeQuestion.test.ts`.
  - `[low]` `[patch]` On a mount, the sheet opened from the snapshot already shown before this mount's read answered, so a turn written on another device flashed the sheet. Fixed: a per-mount `readFor` flag (keyed by `sessionKey`, set when this mount's `loadDailyDay()` resolves) joins the show rule. It is deliberately not tied to `dailyDayLoading`, so a background load leaves an open sheet alone. Both cases have view tests.
  - `[low]` `[patch]` `addDeclinedWriteDay` wrote without a session check, so a sign-out between its read and its write could recreate the outgoing account's kind after `deleteAccountCopies`. Fixed: it takes `isCurrent` and skips the write when stale, as `mergeDailyDay` does; the caller passes its own; there are service and slice tests.
  - `[false]` `[reject]` The two residual notes belong in `deferred-work.md`. Neither is a defect: a stale `dailyWriteDeclined` after a concurrent No thanks is invisible, because `decline()` calls `onClose`, which sets `writeClosedFor` for the mount, and the next mount re-reads the kind. Writer parity is not a code path: the spec takes whichever partner is the writer, and the existing specs make no click on the writer's page after the pick.
  - `[low]` `[patch]` The new code's style did not match its surroundings: one-line test headers of 114 to 169 characters, lines over 100 characters, and `\'` escapes. Fixed by hand-wrapping, dropping empty first lines and using double-quoted strings. The two Tailwind class strings stay unwrapped.

## Design Notes

- The server is the only judge of an option: the rules line tells the writer the limits up front, and a refusal shows the server's reason. Send stays usable so the reason can reach the screen (R4 "the server refuses any other").
- The sub-line drops the mock-up's "tomorrow morning": the morning push is epic 8, and the question exists from midnight.
- A per-mount close (scrim or Escape) is not "answered". The epic's re-ask rule ("on each later open of that day") counts only writing or No thanks as answered.
- `write.done` comes back in the submit's own snapshot (spine AD-16), so a successful send ends the prompt through the normal merge, with no extra state.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors other than the worktree's known TS2883 in `tests/support/merged-fixtures.ts`, if present.
- `npm run lint` -- expected: exit 0.
- `npx knip` -- expected: no new findings.
- `npm run test:unit` -- expected: all pass; also `SEED=101 npm run test:unit:coverage`.
- `supabase status` (CLI from `.mise.toml`) shows the stack running, reset to this branch's migrations if needed (`supabase db reset`) -- expected: up.
- `npx playwright test tests/e2e/daily/ --project=chromium` -- expected: every daily spec passes, the new one included; then the new spec again with `--repeat-each=3`.

## Auto Run Result

Status: built

**Summary:** The day's writer is now asked to write tomorrow's question on Daily.
- **When it opens.** Once the writer's own pick is on the server (`my_choice` set), a bottom sheet opens if all of these hold:
  - `write.mine` is true and `write.done` is false;
  - the day is not declined on this device;
  - the day is the device's date;
  - this mount's read has answered.
- **What it holds:**
  - This and That fields;
  - the "{This} or {That}?" preview, as typed;
  - the option rules;
  - Send for tomorrow, which calls `submit_written_question` and merges the returned snapshot;
  - "No thanks, pick one for us", which saves the `day_id` in the device-only `daily-write-declined` local copy.
- **Closing it.** A scrim tap or Escape hides it until the next open of Daily.
- **Refusals.**
  - Offline, Send is refused before any request: "You are offline. Tomorrow's question needs a connection to send."
  - A server refusal shows its reason: DQ003 in the server's words, DQ004 to DQ006 as fixed sentences.
- **Who sees it.** The partner never sees the sheet, and a queued offline pick never opens it.
- **Layout.** The sheet has no animation and clears all four safe-area insets.

**Files changed:**
- `src/api/dailyQuestionApi.ts`: `submitWrittenQuestion` and the refusal-message map.
- `src/services/accountDataError.ts`: the `'refused'` code.
- `src/services/dailyWriteDeclined.ts` (new), `src/services/syncLock.ts`: the declined-days kind and its lock.
- `src/services/localCopy.ts`: the header exempts `daily-write-declined` from the server-fill rule.
- `src/services/dailyDaysCopy.ts`: `keepWriteDone`, so `write.done` never moves back.
- `src/stores/slices/dailyQuestionSlice.ts`, `authSlice.ts`: `dailyWriteDeclined`, `submitWrittenQuestion`, `declineWrittenQuestion`, the load of the field, `signedOutState()`.
- `src/components/DailyQuestion/WriteQuestionSheet.tsx` (new), `DailyQuestion.tsx`: the sheet and its show rule.
- Tests:
  - new `WriteQuestionSheet.test.tsx`, `dailyWriteDeclined.test.ts`, `dailyQuestionSlice.writeQuestion.test.ts` and `tests/e2e/daily/daily-question-write-tomorrow.spec.ts` (six tests);
  - updated API, `dailyDaysCopy`, sign-out and fixture tests;
  - factory helpers `readPairDayWriter`, `readPairWrittenQuestions`, and `WRITTEN_QUESTION_SEND`.

**Review findings:**
- Quick lens, 5 findings, with 4 patched: 1 medium (the stale read undoing `write.done`) and 3 low (the flash on mount, the declined write's session check, style). Nothing was deferred.
- 1 was rejected as false: the residual notes are not deferred defects (see the triage log).

**Follow-up review recommended: false.** This was the first pass. It patched no high and only one medium (patched: high 0, medium 1, low 3).

**Verification (parent, after the patches):**
- typecheck, lint and Knip exit 0;
- `test:unit`: 247 files, 4566 tests; `SEED=101 test:unit:coverage` passes the same;
- the local stack (CLI 2.122.0) is at migration `20261106010000`;
- `tests/e2e/daily/` (Chromium): 13 passed, row audit clean;
- the new spec with `--repeat-each=3`: 18 passed.

**Residual risks:**
- Only the date's writer parity on the run day ran in E2E. The spec chooses the writer's page from `couple_days.writer`, so the code path is the same for either partner.
- The sheet's copy ("{partner} gets it tomorrow. You'll answer it too.", the rules line, the DQ004 to DQ006 sentences) was written for this story. It was not in the mock-up.
- No live-site check yet: that is story 11.
