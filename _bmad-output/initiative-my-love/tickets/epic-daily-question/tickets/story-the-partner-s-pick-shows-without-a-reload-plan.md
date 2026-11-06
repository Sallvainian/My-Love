---
title: "The partner's pick shows without a reload"
type: 'feature'
ticket: '6'
created: '2026-11-06'
status: done
baseline_revision: '9106fa373bda92a51b9e9456553a44185aad0eef'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The partner-connect poke test failed once while the realtime-recovery spec ran beside it (ledger DW-464).
    evidence: |-
      The implementing agent's first combined Playwright run failed "a poke reaches each linked partner live" once (no notification-badge); two reruns and the parent's two full runs passed. The poke path (interactionService postgres_changes) is untouched by this change and the baseline was not run, so it is unverified. Settle it with partner-connect.spec.ts --repeat-each=10 beside the recovery spec on the baseline and on this branch.
    location: >-
      tests/e2e/partner/partner-connect.spec.ts
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** A partner's pick reaches the other partner's open Daily only on a reload: nothing tells the other device that the day changed (epic R2; spine AD-11). The mood registry knows only `new_mood` and `partner_linked`.

**Approach:** Turn `moodSyncService`'s registry into `subscribePartnerEvents(handlers)` over one `PartnerEvent` union (`partner_linked`, `daily_pick`, `new_mood`), each event validated in `broadcastSchemas.ts` and bound when the channel is created, on the same `mood-updates:<uid>` topic. After a confirmed pick the client sends `daily_pick { day_id }`; the receiver re-reads that day with a new client RPC, `get_daily_day_by_id`, and merges the answer through story 5's `mergeDailyDay`.

## Boundaries & Constraints

**Always:**
- **Migration** `supabase/migrations/20261106010000_daily_question_day_by_id.sql`: client RPC `public.get_daily_day_by_id(day_id uuid) returns jsonb`, `security definer`, `set search_path = ''`, in the style of `get_daily_day`. Null `auth.uid()` → `'Authentication required'`. No partner, or a day that is not the caller's current pair's (`user_a = least(uid, partner)`, `user_b = greatest(uid, partner)`) → `raise exception 'Day not found' using errcode = 'P0002'`. Otherwise it returns `daily_day_snapshot(day_id, uid, now())`. `revoke execute … from public, anon`; `grant execute … to authenticated`; plus a header and a `comment on function`.
- **pgTAP:**
  - `40_daily_question_gate.sql`: add the RPC to DAILY-014/015 ("four client RPCs"). Next to DAILY-046..048, B calls `get_daily_day_by_id(day)` before B's own pick; assert state `partner`, null `my_choice`/`partner_choice`/`same`, and no `"this"`/`"that"` value anywhere in the answer. After B's pick, B's by-id answer carries `partner_choice`. A partnered outsider and an unlinked user get P0002. Bump `plan(n)` and update the header list.
  - `18_function_execute_grants.sql`: add `get_daily_day_by_id` to FN-GRANT-008's list (alphabetical), add FN-GRANT-020 (authenticated may EXECUTE it), bump `plan`.
- **Types:** `src/types/database.types.ts` comes only from `npm run db:types` on the local stack reset to this branch.
- **`broadcastSchemas.ts`:**
  - `DAILY_PICK_EVENT = 'daily_pick'`; `PARTNER_EVENTS = ['partner_linked', 'daily_pick', 'new_mood'] as const`; a `PartnerEvent` union: `{ event: 'partner_linked' } | { event: 'daily_pick'; day_id } | { event: 'new_mood'; mood: SupabaseMood }`.
  - `parsePartnerEvent(event, raw, { partnerId })` returns `PartnerEvent | null`:
    - `partner_linked`: always returned, as today; its payload is trusted for nothing.
    - `new_mood`: through the existing `parseMoodBroadcast`.
    - `daily_pick`: `null` when `partnerId` is null or the payload is not `{ day_id: uuid }`. Unknown keys are stripped.
- **`moodSyncService`:**
  - `subscribeMoodUpdates(cb, onStatus, onPartnerLinked)` becomes `subscribePartnerEvents(handlers: PartnerEventHandlers)`: one optional handler per event name, which receives that union member, plus `onStatus?`.
  - `bindMoodChannel` binds one `.on('broadcast', { event })` per `PARTNER_EVENTS` entry, which parses with `parsePartnerEvent` and fans out to the subscribers' handler for that event. `partner_linked` keeps its `refreshChannelIdentity` side effect.
  - Every other behaviour stays exactly as it is: the refcount, the reopen, the identity snapshot, the status replay, the leave wait, and the `[MoodSyncService] Broadcast subscription status:` log (the spec regex reads it).
  - Private names may stay.
  - Migrate every caller, mock and stub: `usePartnerMood`, `PartnerMoodView`, `usePartnerLinkListener`, the auth-bootstrap harness and every unit test.
- **Send:** `announceDailyPick(dayId)` in `src/api/dailyQuestionApi.ts` resolves the partner with plain `getPartnerId()` (the send side, as `syncMood` does). With none it returns. Otherwise it calls `sendEphemeralBroadcast('mood-updates:<partnerId>', DAILY_PICK_EVENT, { day_id })` and throws on failure. Story 7's drain will call it too.
  - `submitDailyPick`, after the server's answer and while `isCurrent()` holds, starts it without awaiting: `void announceDailyPick(snapshot.day_id).catch(log)`, where `log` is `console.error('[DailyQuestion] Could not announce the pick:', error)`. The pick stays shown whatever the broadcast does.
- **Re-read:**
  - `fetchDailyDayById(dayId)` in `src/api/dailyQuestionApi.ts` calls `rpc('get_daily_day_by_id', { day_id })`. It refuses offline first, parses with `DailyDaySnapshotSchema` and throws the same way `fetchDailyDay` does.
  - New slice action `refreshDailyDay(dayId)` never throws and does the session capture and re-check around every await. It fetches, then `mergeDailyDay(userId, { status: 'ok', snapshot }, isCurrent)`, then shows the merged answer in one of two cases, and in both it clears `dailyDayError`:
    - the shown answer is an `ok` snapshot with the same `day_id`: shown through `mergeAnswer`;
    - nothing `ok` is shown and `snapshot.day === formatDateISO(new Date())`.
  - Any other case writes the copy only. A failure logs `console.error('[DailyQuestion] Failed to re-read a day:', error)` and changes nothing.
- **Listener:** new `src/hooks/useDailyPickListener.ts`, mounted by `DailyQuestion`.
  - While `userId` is set and `syncStatus.isOnline` holds, it holds one subscriber: `daily_pick` → `refreshDailyDay(day_id)`, and every `SUBSCRIBED` → `loadDailyDay()`, because a broadcast is never replayed.
  - It uses the async-teardown guard (an `active` flag; release a subscription that resolves after unmount) as `usePartnerLinkListener` does. The session is a dependency, so an account switch re-subscribes.
- **E2E:** fixtures from `merged-fixtures.ts`; `clearPairDays` + `ensureTestCoachQuestions` before each test and again at teardown. Listeners and request trackers are attached before the navigation they observe.

**Never:**
- Put a `choice` in any broadcast, or show a partner choice from anything but a server snapshot.
- Let a daily table join `supabase_realtime`, call `supabase.channel()` outside the registry, or create a new topic prefix.
- Hand-edit `database.types.ts`, or change an earlier migration.
- Add `daily_nudge` to the union (epic 8), and do not touch the pick queue, the drain or the write prompt (stories 7 and 8), the dock, `/mood`, `DailyMessage/` or `messagesSlice`.
- Add a slice field, or a localCopy kind.
- Link, unlink or reset a pool account in a spec.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Partner picks first | shown `none` for D; `daily_pick {D}`; by-id answers `partner` | "has picked" shows; copy entry `partner` | — |
| Reveal | shown `me` for D; by-id answers `both` | reveal shows | — |
| Slow lower re-read | stored `both`, by-id `me` | stays `both` | — |
| Other day shown | shown D1, event D2 | copy gains D2; screen unchanged | — |
| Nothing shown | `dailyDay` null or load error; snapshot `day` = device today | shown; error cleared | — |
| Re-read fails | by-id rejects | nothing changes | `console.error` with that message |
| Session changes mid re-read | sign-out before merge | copy and state untouched | — |
| Malformed or muted | `{}` / bad uuid / partner snapshot null | dropped, no re-read | debug log |
| Old events | `new_mood` / `partner_linked` | reach their handlers as before | — |
| Own pick confirmed | submit answers | `daily_pick {day_id}` POSTed to `mood-updates:<partner>` | failure logged, pick still shown |
| No partner on send | `getPartnerId` null | no broadcast | — |
| By-id foreign or unlinked | another pair's day, or no partner | P0002 'Day not found' | — |

</intent-contract>

## Code Map

- `src/api/moodSyncService.ts:44-61` -- `MoodSubscriber`, `PARTNER_LINKED_EVENT`. `:632-675` -- `bindMoodChannel`, the two handlers to generalise. `:827-983` -- `subscribeMoodUpdates`, to become `subscribePartnerEvents`. The topic, the entry life cycle and the identity refresh do not change. The comment at `:832-836` already holds: a stale-token join is refused and the SDK rejoins an errored channel with the renewed token. If the ported spec shows otherwise, fix it in the registry.
- `src/api/validation/broadcastSchemas.ts` -- `parseMoodBroadcast`, `UUIDSchema`. Extend the module header to cover the union.
- `src/api/ephemeralBroadcast.ts:154` -- `sendEphemeralBroadcast(topic, event, payload)` throws on refusal. `src/api/supabaseClient.ts:443` -- `getPartnerId`.
- `src/api/dailyQuestionApi.ts` -- `refuseOffline`, `fetchDailyDay` (the pattern for `fetchDailyDayById`), `submitDailyPick`.
- `src/stores/slices/dailyQuestionSlice.ts` -- `mergeAnswer`, `loadDailyDay` (step 1 shows how a saved day is chosen for display), `submitDailyPick`. Update the header comment.
- `src/services/dailyDaysCopy.ts` -- `mergeDailyDay(userId, answer, isCurrent)` returns the answer to show. Unchanged.
- `src/hooks/usePartnerLinkListener.ts:80-123` -- the subscriber and teardown pattern. `src/hooks/usePartnerMood.ts:84`, `src/components/PartnerMoodView/PartnerMoodView.tsx:175` -- callers to migrate.
- `src/components/DailyQuestion/DailyQuestion.tsx` -- mount the hook in `DailyQuestion()`. `DayCard` is keyed by `day_id`, so a state change keeps the user's unsent selection.
- `supabase/migrations/20261105210000_daily_question_own_clocks.sql:248-300` -- the `get_daily_day` client RPC style. `:182` -- the P0002 raise.
- `supabase/tests/database/40_daily_question_gate.sql:42,176-188,368-418` -- `plan`, DAILY-014/015, B's before-pick block. `18_function_execute_grants.sql:29,114,196-201` -- `plan`, FN-GRANT-008, FN-GRANT-019.
- `tests/unit/api/fakeMoodRealtime.ts` -- the channel fake: `emitEvent(chan, 'daily_pick', { day_id })`, `emitMood`, `PARTNER_ID`. The `moodSyncSubscription*.test.ts` files and `realtimeLeaveContract.test.ts` call `subscribeMoodUpdates` positionally (~57 calls): migrate them mechanically and keep every assertion.
- Unit mocks of `subscribeMoodUpdates` -- `src/hooks/__tests__/usePartnerMood.test.ts`, `usePartnerLinkListener.test.ts`, and the `PartnerMoodView.{kit,search,requests}.test.tsx` files. `tests/support/harnesses/auth-bootstrap-notification-order.tsx:103,168,217` stubs it and restores it.
- `tests/unit/stores/dailyQuestionSlice.test.ts` -- `vi.mock` of `dailyQuestionApi` with `importOriginal`; add `fetchDailyDayById` and `announceDailyPick`. `src/components/DailyQuestion/__tests__/DailyQuestion.test.tsx` -- mock the new hook or the service there.
- `tests/e2e/partner/realtime-recovery-after-renewal.spec.ts` -- `trackReads` (GET only), `bootExpired`, the `/mood` context, `MOOD_SUBSCRIBED_LOG`, `broadcastPath`. Move `trackReads` into `tests/support/helpers/request-tracker.ts` with a method parameter, and import it back.
- `tests/e2e/daily/daily-question-pick-and-reveal.spec.ts:30-80` -- the two-context setup. `tests/support/helpers/reads.ts:130-134` -- add `DAILY_DAY_BY_ID_READ = '**/rest/v1/rpc/get_daily_day_by_id'`.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261106010000_daily_question_day_by_id.sql` -- the RPC and its grants.
- [ ] `supabase/tests/database/40_daily_question_gate.sql`, `18_function_execute_grants.sql` -- the assertions from Boundaries.
- [ ] `src/types/database.types.ts` -- `supabase db reset`, then `npm run db:types`.
- [ ] `src/api/validation/broadcastSchemas.ts` -- the union, `PARTNER_EVENTS`, `DAILY_PICK_EVENT`, `parsePartnerEvent`.
- [ ] `src/api/moodSyncService.ts` -- `subscribePartnerEvents`, the per-event binding.
- [ ] `src/hooks/usePartnerMood.ts`, `src/components/PartnerMoodView/PartnerMoodView.tsx`, `src/hooks/usePartnerLinkListener.ts` -- migrate.
- [ ] `src/api/dailyQuestionApi.ts` -- `fetchDailyDayById`, `announceDailyPick`.
- [ ] `src/stores/slices/dailyQuestionSlice.ts` -- `refreshDailyDay`; announce after a confirmed submit.
- [ ] `src/hooks/useDailyPickListener.ts` + `src/components/DailyQuestion/DailyQuestion.tsx` -- the listener, mounted in the view.
- [ ] Unit tests (every caller's test, the harness, the moodSync tests) -- migrate to the new API.
- [ ] `tests/unit/api/partnerEvents.test.ts` (new, on `fakeMoodRealtime`) -- through `subscribePartnerEvents`:
  - `new_mood` and `partner_linked` still reach their handlers;
  - `daily_pick` reaches its handler with `{ day_id }`;
  - a malformed payload, and a muted snapshot, dispatch nothing;
  - the channel binds each `PARTNER_EVENTS` name once.
- [ ] `tests/unit/stores/dailyQuestionSlice.test.ts`, `src/api/__tests__/dailyQuestionApi.test.ts`, `src/hooks/__tests__/useDailyPickListener.test.ts` -- every matrix row at its layer. The listener test covers the event → refresh, SUBSCRIBED → load, no subscriber while offline or signed out, and a release after unmount.
- [ ] `tests/support/helpers/request-tracker.ts`, `tests/support/helpers/reads.ts` -- the shared tracker and the read constant.
- [ ] `tests/e2e/daily/daily-question-live-pick.spec.ts` -- the live AC below, `[P0]`.
- [ ] `tests/e2e/partner/realtime-recovery-after-renewal.spec.ts` -- port the mood context to a live `daily_pick`, per the AC below.

**Acceptance Criteria:**
- Given the worker pair on a local stack with cleared days, both on `/daily`, each page's channel joined (the `SUBSCRIBED` log seen) and its `get_daily_day` reads settled, when the worker sends This, then:
  - the partner's page, without a reload, shows `daily-partner-status` "has picked" and no `daily-reveal`;
  - a `get_daily_day_by_id` read answered it 200, and no new `get_daily_day` read started on that page.
- Then, when the partner sends That, the worker's page, without a reload, shows `daily-reveal` with both option texts and "Different picks", under the same read conditions.
- Given the recovery spec's context booted on `/daily` with an expired session and the refresh cut off, when the token renews and the partner then picks through the real UI, then:
  - the receiving Daily shows "has picked" with no reload and no new `get_daily_day` read after the send;
  - the poke and the note still arrive live;
  - the partner's `daily_pick` broadcast to `mood-updates:<worker>` answered 202.
- Given `tests/e2e/partner/partner-connect.spec.ts`, when it runs, then it passes: `partner_linked` still re-arms through the registry.

## Implementation Notes

- Built as planned. `get_daily_day_by_id` is `stable` (it only reads). The gate file is now `plan(108)` (DAILY-103..108) and the grants file `plan(29)` (FN-GRANT-020).
- `PARTNER_LINKED_EVENT` moved from `moodSyncService` to `broadcastSchemas.ts`, beside `DAILY_PICK_EVENT` and `NEW_MOOD_EVENT`. `PartnerEventHandlers` is exported from `moodSyncService`.
- `tests/unit/api/fakeMoodRealtime.ts` gained a `moodHandlers()` adapter, so the ~50 positional `moodSyncSubscription*` calls kept every assertion. `trackReads` and `MOOD_SUBSCRIBED_LOG` moved to `tests/support/helpers/request-tracker.ts`.
- The registry needed no change for the stale-boot case: the ported spec shows that a channel opened on an expired token rejoins on the renewed one.
- Verified in this session: `supabase db reset` and `supabase test db` on the shared stack, reset to this branch (30 files, 832 tests). `db:types` reproduced the committed one-line diff. Typecheck and lint ran clean, `test:unit` passed 233 files and 4381 tests, the plan's Playwright set passed 15 tests, and the live spec passed with `--repeat-each=3`.
- The implementing subagent saw one failure of "a poke reaches each linked partner live" (`partner-connect.spec.ts`) while the recovery spec ran beside it. It passed on two reruns and in the parent's full run above. That poke path (`interactionService`'s `postgres_changes`) is untouched here.

## Plan Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 26 findings — high 0, medium 1, low 18, false 6, maybe-false 1
- findings:
  - `[low]` `[reject]` blind: `announceDailyPick` reads the partner with `getPartnerId()`, which turns a failed lookup into `null`, so the send is skipped without a log. — Real (`supabaseClient.ts:443`), but the plan chose the send-side lookup on purpose, as `syncMood` does. Throwing on `error` would add only a log line, because the broadcast still does not go out. A lookup failure right after a successful RPC is rare, and the fix adds a branch.
  - `[low]` `[patch]` blind: the fan-out switch in `dispatchPartnerEvent` mixes literals with a constant and has no exhaustiveness check, so a new `PartnerEvent` member (`daily_nudge`, epic 8) would be dropped without a word. — Patched: every case now uses its constant, and a `default` assigns the event to a `never`, so a missing case fails the typecheck.
  - `[low]` `[reject]` blind: the ported recovery spec no longer covers the Mood card's recovery after a renewal. — The intent itself ports the spec "from a live mood to a live daily_pick", and the epic retires the mood screen's E2E in story 9. The commit message records why the check narrows (AGENTS.md L4). Grouped with the verification-gap and intent-alignment rows on the same narrowing.
  - `[maybe-false]` `[defer]` blind: a `partner-connect.spec.ts` poke failure seen once during the build sits only in the plan. — Recorded as ledger DW-464 and in `deferred`, marked unverified. It is settled by repeated runs beside the recovery spec on the baseline and on this branch.
  - `[low]` `[reject]` blind: `partner-connect.spec.ts:169` keeps its own GET-only `trackReads`. — It predates this change, and it matches the exact path where the shared helper matches the path's end, so merging them needs a new option. It does no harm to any test.
  - `[low]` `[reject]` blind: opening Daily costs two `get_daily_day` reads (the mount read and the `SUBSCRIBED` re-read). — This is the tradeoff Design Notes records: a broadcast is never replayed, so every join re-reads. Coalescing the reads would add state to the slice.
  - `[low]` `[reject]` blind: a channel that ran out of reopen retries leaves Daily with no live updates and no sign of it. — This is the registry's existing behaviour, shared with moods. The SDK rejoins an errored channel itself, and the next Daily mount re-subscribes and re-reads. It needs five server closes in a row, and the fix adds retry state.
  - `[low]` `[patch]` blind: the pgTAP file does not test the null `auth.uid()` branch, or a uuid that names no day. — Patched: DAILY-109 ('Authentication required') and DAILY-110 (P0002 for `gen_random_uuid()`).
  - `[low]` `[reject]` blind: `DailyPickBroadcastSchema` and `PartnerEventIdentity` are exported but unused, and Knip would report them. — Knip runs in no CI job, and the module already exports unused schemas and identity types the same way (`MoodBroadcastSchema`, `LoveNoteBroadcastIdentity`). No harm is named.
  - `[false]` `[reject]` blind: the listener test "releases the subscriber on unmount" passes on either the cleanup path or the late-release path. — If `.then` had not stored `release` before `unmount()`, the late path would call it asynchronously, and the synchronous `expect(release).toHaveBeenCalledTimes(1)` would fail. `waitFor` yields first, so only the cleanup path can pass.
  - `[low]` `[patch]` blind: `DailyQuestion.test.tsx` runs the real `announceDailyPick`. — Patched: the `dailyQuestionApi` mock now includes `announceDailyPick` as a resolved `vi.fn`.
  - `[low]` `[reject]` blind: no unit or integration test drives a `daily_pick` through the real store into the rendered view. — `daily-question-live-pick.spec.ts` covers exactly that path in a browser, and the slice and hook tests cover each layer. Adding another layer is more than a direct fix.
  - `[low]` `[patch]` blind: two new comment lines are not wrapped (the `broadcastSchemas.ts` header and `dailyQuestionSlice.test.ts` line 3). — Patched: both rewrapped.
  - `[low]` `[reject]` edge: a `daily_pick` that lands during a re-join's identity refresh, while `partnerId` is nulled, is dropped after the `SUBSCRIBED` re-read has already run. — Real, but the window is one `users` round trip on a re-join only (the first join keeps its fresh snapshot), and moods share it. The fix needs a new registry callback (new surface). The next open re-reads. Listed as a residual risk.
  - `[low]` `[reject]` edge: `getPartnerId` turns a lookup error into "no partner" on the send. — Same root cause and reason as the first row.
  - `[low]` `[reject]` edge: if `subscribePartnerEvents` rejects, the hook holds nothing until its dependencies change. — Rare (a `setAuth` or session read throwing), logged, and the same pattern as `usePartnerLinkListener`. Remounting Daily recovers, and a retry loop adds complexity.
  - `[low]` `[patch]` edge: the live spec's settle wait (`started >= 2`) can pass before the join's own `get_daily_day` read starts, so a late read could change the before-send counts. — Patched: `channelJoined` records each page's `started()` when its `SUBSCRIBED` log arrives, and the wait requires a later read with none in flight. Passed with `--repeat-each=3`.
  - `[medium]` `[patch]` verification-gap: no test shows that a re-linked account cannot read its old pair's day by id. A looser pair check (`uid in (user_a, user_b)`) would pass every existing test. — Patched: DAILY-111, B's by-id call on the old day after the relink, raises P0002. The gate file is now `plan(111)`.
  - `[low]` `[reject]` verification-gap: the recovery spec dropped the Mood card's renewal coverage. — Same root cause and reason as the third row.
  - `[low]` `[patch]` verification-gap (other): the three `moodSyncSubscription*` test headers still say only two mutually exclusive views subscribe. — Patched: the headers now list all four subscribers, and say only the two views are mutually exclusive.
  - `[false]` `[reject]` intent: the ported recovery spec covers only the first-pick half. — The intent asks for "a live daily_pick", and `daily-question-live-pick.spec.ts` checks the reveal half live.
  - `[low]` `[reject]` intent: the recovery spec now tests the registry's rejoin path rather than `MoodTracker`'s `TOKEN_REFRESHED` re-lookup. — Same narrowing as the third row, which the intent asked for.
  - `[false]` `[reject]` intent: whether partner-connect passes is unverified. — It passed in both of the parent's full Playwright runs (15 tests each).
  - `[false]` `[reject]` intent: the rule for which re-read is shown goes beyond "merges". — The re-read is merged through `mergeDailyDay` as asked. The show rule keeps another date's day off the screen (R9), and the slice tests cover it. It is not a divergence from the intent.
  - `[false]` `[reject]` intent: `daily_pick` gets a weaker identity check than `new_mood`. — The payload is `{ day_id }` only by AD-11. The send is authorized by `couple_broadcast_partner_can_send`, and the receiver trusts it only to ask for a re-read the server gates.
  - `[false]` `[reject]` intent: whether `database.types.ts` was regenerated is unverified. — `npm run db:types` on the stack reset to this branch reproduced the one-line diff, twice.

## Design Notes

- Re-read on every `SUBSCRIBED`, as `usePartnerLinkListener` does: a broadcast that lands while the channel joins or re-joins is lost, and nothing replays it. That costs one `get_daily_day` per Daily open in addition to the mount read. The E2E waits for those reads to settle before the send, so a live update cannot come from them.
- The receiver shows a re-read only when it is the day on screen, or today with nothing on screen. Partners on different clocks (R9) can pick on a date that is the receiver's tomorrow, and that day must not replace the one shown. It still goes into the copy, because the gate released it to this account.
- `daily_pick` needs a non-null partner snapshot, as `new_mood` does. A channel whose account changed is muted that way. The event carries only `day_id` and asks for a server re-read, so its content is trusted for nothing.

## Verification

**Commands:**
- `supabase db reset` (CLI 2.122.0 from `.mise.toml`), then `supabase test db` -- expected: every file passes.
- `npm run db:types && git diff --stat src/types/database.types.ts` -- expected: only the new function's entry changes.
- `npm run typecheck` -- expected: no errors other than the worktree's known TS2883 in `tests/support/merged-fixtures.ts`.
- `npm run lint` -- expected: exit 0.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/daily/ tests/e2e/partner/partner-connect.spec.ts tests/e2e/partner/realtime-recovery-after-renewal.spec.ts tests/e2e/auth/login.spec.ts --project=chromium` -- expected: all pass. Then rerun `tests/e2e/daily/daily-question-live-pick.spec.ts` with `--repeat-each=3`.

## Auto Run Result

Status: built

**Summary:** A partner's pick now shows on the other partner's open Daily without a reload.
- **Registry:** `moodSyncService.subscribeMoodUpdates` became `subscribePartnerEvents(handlers)`, over one `PartnerEvent` union (`partner_linked`, `daily_pick`, `new_mood`). Each event is bound once when the channel is created, on the same `mood-updates:<uid>` topic. Each is validated by `parsePartnerEvent` in `broadcastSchemas.ts`, and reaches only the handler registered for it. Every caller, mock and stub has moved to it.
- **Send:** after a confirmed pick, `submitDailyPick` starts `announceDailyPick(day_id)` without waiting: `daily_pick { day_id }` through `sendEphemeralBroadcast` to the partner's topic. A failure is logged. Story 7's drain can call the same function.
- **Receive:** `useDailyPickListener`, mounted by `DailyQuestion`, holds one subscriber while signed in and online.
  - A `daily_pick` calls `refreshDailyDay(day_id)`. That re-reads the day through the new client RPC `get_daily_day_by_id` and merges it through `mergeDailyDay`. It shows the result when that day is the one on screen, or today's with nothing on screen.
  - Every `SUBSCRIBED` re-reads today, because a broadcast is never replayed.
- **Server:** `get_daily_day_by_id(day_id)` is security definer and reads only through `daily_day_snapshot`. It answers P0002 'Day not found' with no partner, or for a day that is not the caller's current pair's. It is in the gate file, FN-GRANT-008/020 and the regenerated types.

**Files changed:**
- `supabase/migrations/20261106010000_daily_question_day_by_id.sql`: the new client RPC and its grants.
- `supabase/tests/database/40_daily_question_gate.sql`: the by-id calls before and after B's pick, the four-RPC grant checks, null JWT, an unknown day, outsiders and the relinked caller (`plan(111)`).
- `supabase/tests/database/18_function_execute_grants.sql`: FN-GRANT-008 list and FN-GRANT-020.
- `src/types/database.types.ts`: regenerated, adding one line.
- `src/api/validation/broadcastSchemas.ts`: the event constants, `PARTNER_EVENTS`, the `PartnerEvent` union and `parsePartnerEvent`.
- `src/api/moodSyncService.ts`: `subscribePartnerEvents`, the per-event binding and an exhaustive dispatch.
- `src/api/dailyQuestionApi.ts`: `fetchDailyDayById` and `announceDailyPick`.
- `src/stores/slices/dailyQuestionSlice.ts`: `refreshDailyDay`, and the announce after a confirmed pick.
- `src/hooks/useDailyPickListener.ts`, `src/components/DailyQuestion/DailyQuestion.tsx`: the listener, mounted in the view.
- `src/hooks/usePartnerMood.ts`, `src/hooks/usePartnerLinkListener.ts`, `src/components/PartnerMoodView/PartnerMoodView.tsx`, `src/api/interactionService.ts` (a comment): migrated to the new API.
- Unit tests:
  - New `tests/unit/api/partnerEvents.test.ts` and `src/hooks/__tests__/useDailyPickListener.test.ts`.
  - Extended `dailyQuestionSlice`, `dailyQuestionApi`, `broadcastSchemas` and `DailyQuestion` tests.
  - Every `moodSyncSubscription*` test, `realtimeLeaveContract`, the `PartnerMoodView` and hook tests, and `fakeMoodRealtime.ts` (`moodHandlers()`) migrated.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx`: stubs `subscribePartnerEvents`.
- `tests/support/helpers/request-tracker.ts` (new: `trackReads` with a method, `MOOD_SUBSCRIBED_LOG`), `tests/support/helpers/reads.ts` (`DAILY_DAY_BY_ID_READ`): shared test helpers.
- `tests/e2e/daily/daily-question-live-pick.spec.ts`: new `[P0]` spec. Two pages, no reload: "has picked", then the reveal.
- `tests/e2e/partner/realtime-recovery-after-renewal.spec.ts`: the `/mood` context is ported to a live `daily_pick` on `/daily`.
- `tests/e2e/partner/partner-mood-realtime.spec.ts`: a comment.
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-464.

**Review findings:** 26 findings from 4 lenses (blind-hunter, edge-case-hunter, verification-gap, intent-alignment). They break down as high 0, medium 1, low 18, false 6 and maybe-false 1.
- **Patched (7):**
  - an exhaustive `dispatchPartnerEvent` switch;
  - pgTAP DAILY-109 (null JWT) and DAILY-110 (unknown day);
  - pgTAP DAILY-111 (a relinked caller on the old pair's day; the medium);
  - the `announceDailyPick` mock in the view test;
  - the live spec's settle wait, which now waits for the join's own read;
  - two comment rewraps;
  - three stale test headers.
- **Deferred (1):** the one-time `partner-connect` poke failure seen during the build. It is unverified, recorded as DW-464 and in frontmatter `deferred`.
- **Rejected:**
  - `announceDailyPick` treats a failed partner lookup as no partner (2 rows). The plan chose the send-side lookup; a fix would add only a log, and the broadcast would still not go out.
  - The recovery spec dropped the Mood card's renewal coverage (4 rows). The intent ports the spec off moods, story 9 retires the mood screen's E2E, and the commit records the narrowing.
  - `partner-connect.spec.ts` keeps its own `trackReads`. It predates this change and matches paths differently.
  - Two `get_daily_day` reads per open. This is the recorded tradeoff.
  - No recovery once the channel has used its retries. This is the registry's existing behaviour, and a remount recovers.
  - Unused exports. Knip runs in no CI job, and the module already exports this way.
  - No store-to-view integration test. The live E2E covers that path.
  - A `daily_pick` dropped during a re-join's identity refresh. The window is one round trip, and the fix needs new registry surface.
  - A rejected subscribe holds nothing. It is rare and logged, as in `usePartnerLinkListener`.
  - 6 false rows: the listener-test claim and five intent-alignment observations disproved by the code or by the parent's runs.

**Follow-up review recommended: false.** This first pass patched high 0, medium 1 and low 6. One medium is below the threshold of a high or two mediums.

**Verification (after the patches, in this session, on the shared local stack reset to this branch):**
- `supabase db reset` (CLI 2.122.0) applied every migration. `supabase test db` passed 30 files and 835 tests.
- `npm run db:types` reproduced the committed one-line diff in `database.types.ts`.
- `npm run typecheck` exited 0 with no errors, and `npm run lint` exited 0.
- `npm run test:unit` passed 233 files and 4381 tests.
- The Playwright set passed 15 tests, and the row audit found no leftover rows. The set was `tests/e2e/daily/`, `partner-connect.spec.ts`, `realtime-recovery-after-renewal.spec.ts` and `login.spec.ts`, run with `--project=chromium`.
- `daily-question-live-pick.spec.ts --repeat-each=3` passed 3 tests.

**Residual risks:**
- A `daily_pick` that lands in the one-round-trip window of a re-join's identity refresh is dropped. The next open re-reads it.
- A channel that has used all its reopen retries stops live updates until Daily remounts.
- A failed partner lookup on the send side skips the announcement without a log.
- DW-464: the `partner-connect` poke failure seen once is unverified.
- The ported recovery spec no longer exercises the Mood card's renewal path in a browser. The commit records this.
