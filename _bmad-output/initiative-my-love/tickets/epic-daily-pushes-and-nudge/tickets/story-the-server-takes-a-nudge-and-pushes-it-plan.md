---
title: 'The server takes a nudge and pushes it'
type: feature
ticket: '7'
created: '2026-11-26'
status: done
baseline_revision: '5c9ddeb9afcbd0172be7c89ec900b44495e5b56d'
route: full
route_source: auto
risk: high
review: thorough
review_source: pinned
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md'
warnings: [oversized]
deferred:
  - summary: >-
      A sender whose clock is past midnight while the recipient's is still on the day can nudge about that day in a fresh slot of the sender's new date, which also spends that date's slot before the new day's question.
    evidence: |-
      record_daily_nudge and the snapshot key the limit on (from_user, sender_local_date, slot) and require only user_local_date(partner, at) = the day (AD-17 as written). With A on UTC and B in New York, at 2030-09-11 02:00 UTC A (picked 09-10, B not) gets slot after_pick for 09-10, unspent, so a third nudge about 09-10 lands and A's 09-11 after_pick slot is spent before 09-11's question. Real low defect, deferred because it needs partners in different zones and a nudge after the sender's midnight, and the fix (also requiring the sender's own date to be the day, or keying on day_id) changes AD-17's rule, which is the architect's or owner's call (review 2026-11-26: blind-hunter, edge-case-hunter, intent-alignment).
    location: >-
      supabase/migrations/20261126020000_daily_nudge.sql record_daily_nudge and daily_day_snapshot nudge block
    severity: low
  - summary: >-
      record_daily_nudge reads the sender's stored zone twice (user_local_date, then daily_nudge_slot), so a zone written between the two statements gives the row a date from one zone and a slot from the other.
    evidence: |-
      Under READ COMMITTED each statement in the volatile function takes a fresh snapshot, and get_daily_day may update user_time_zones from the same account's other device in between. Real low defect, deferred because it needs a zone change within the same milliseconds as a nudge; the fix is to read the zone once and derive both values from it (review 2026-11-26: edge-case-hunter).
    location: >-
      supabase/migrations/20261126020000_daily_nudge.sql:154-155
    severity: low
  - summary: >-
      tests/api/push-daily-nudge.spec.ts takes today from the host clock before seeding, so a run that crosses host-local midnight between the seed and the nudge fails spuriously.
    evidence: |-
      setUpPair seeds today with isoDateDaysFromNow(0, new Date()) and host-zone user_time_zones rows; after midnight user_local_date(recipient, now()) is the next date and send_daily_nudge refuses DQ009. The same low flake stories 8.3 and 8.6 deferred for push-daily-sender.spec.ts and push-daily-picks.spec.ts; the shared fix is a guard near local midnight (review 2026-11-26: intent-alignment).
    location: >-
      tests/api/push-daily-nudge.spec.ts setUpPair
    severity: low
---

<intent-contract>

## Intent

**Problem:** `daily_nudges` and the sender's `daily_nudge` kind exist (story 8.3), but no client can send a nudge, nothing posts one, and the day snapshot carries no `nudge`, so the waiting screen (8.8) has nothing to call or grey out (R2, spine AD-16, AD-17).

**Approach:** One migration adds the client RPC `send_daily_nudge(day_id)` over an internal `record_daily_nudge(viewer, day_id, at)`, an internal `daily_nudge_slot(sender, at)` that is the one definition of the sender's slot, the `daily_nudges` AFTER INSERT trigger posting `notify_push('daily_nudge')`, and `daily_day_snapshot` gaining `nudge { slot, spent }`.

## Boundaries & Constraints

**Always:**
- AD-15 tiers: `send_daily_nudge` is `security definer`, `set search_path = ''`, takes only `day_id`, refuses a NULL `auth.uid()` with `'Authentication required'` (as `submit_written_question` does), passes `pg_catalog.now()`; revoke from `public, anon`, grant `authenticated`. `record_daily_nudge` and `daily_nudge_slot` are `security definer`, `set search_path = ''`, take `at` and read no other clock (AD-8); revoke from `public, anon, authenticated` (each named), grant `service_role`.
- A nudge needs, in this order: the day in the viewer's current pair (`users.partner_id`, as `record_written_question` does) else `P0002 'Day not found'`; the viewer's own pick else `DQ007`; no partner pick else `DQ008`; `user_local_date(partner, at) = day` else `DQ009`; a free `(from_user, sender_local_date, slot)` else `DQ010`. The day row is taken `for update` (serialises with `record_daily_pick`). The insert is `on conflict on constraint daily_nudges_sender_date_slot_key do nothing`, and no row inserted raises `DQ010`, so a concurrent duplicate is refused too. Returns `daily_day_snapshot(day, viewer, at)`.
- `sender_local_date` is `user_local_date(viewer, at)`; `slot` is `daily_nudge_slot(viewer, at)`: `after_pick` while the sender's stored-zone clock (UTC with no row, AD-3) reads before 20:00, `evening` from 20:00.
- Snapshot `nudge`: `slot` is `daily_nudge_slot(viewer, at)` when the viewer has picked, the partner has not, the partner is the viewer's current `partner_id`, and `user_local_date(partner, at) = day`; otherwise null. `spent` is whether a `daily_nudges` row from the viewer has that `sender_local_date` and `slot`; false when `slot` is null. Every other key and the `write.target_day` walk are copied unchanged.
- Trigger `daily_nudges_push_after_insert`, `after insert … for each row`, no WHEN, `execute function public.notify_push('daily_nudge')`, preceded by `drop trigger if exists`. Body is `{kind, id}` only.
- Update the comments on `daily_nudges`, `notify_push()`, `push_sender_settings` and `daily_day_snapshot` (its `at` is now used). Migration header records the hosted catalog read (below) and that the sender has known `daily_nudge` since story 8.3.
- Existing pgTAP assertions change only where forced: DAILY-038's key list gains `nudge` and FN-GRANT-008's list gains `send_daily_nudge`. Everything else is new assertions.

**Never:**
- No client code (`src/`), no `PARTNER_EVENTS`/`daily_nudge` broadcast, no button, sheet or schema parse of `nudge` (8.8, 8.9). No live-check change (8.11).
- No change to `send-push` code beyond the `handler.ts` header sentence; no change to `enqueue_daily_reminders`, `record_daily_pick` or `src/services/dateReminders.ts`.
- Never hand-edit `src/types/database.types.ts`; regenerate with `npm run db:types`.
- Never touch a pool pair's rows in an api spec; never `supabase db reset` the shared stack.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First nudge | A picked, B not, B's date is the day, A's clock 12:00 | row `after_pick`; snapshot `nudge {after_pick, true}`; one queued `{kind:'daily_nudge', id}` | — |
| Same slot again | A's clock 19:59:59 | refused, still one row | `DQ010` |
| Evening | A's clock 20:00 | snapshot `{evening, false}`; nudge → `{evening, true}` | — |
| Third | A's clock 21:00 | refused, two rows | `DQ010` |
| No own pick | A has not picked | snapshot slot null, spent false | `DQ007` |
| Partner picked | B picked | slot null | `DQ008` |
| Recipient's day over | B's clock already the next date | slot null | `DQ009` |
| Outsider / unlinked | caller not in the day's current pair | nothing written | `P0002` |
| Switch off | recipient `daily_nudge = false` | row lands, sender records nothing | — |

</intent-contract>

## Code Map

- `supabase/migrations/20261107000000_daily_question_write_target_day.sql:48-200` -- current `daily_day_snapshot` (whole body to copy into `create or replace`; `v_mine`/`v_theirs`/`v_partner` exist), its comment and grants.
- `supabase/migrations/20261106000000_daily_question_written_questions.sql:100-235` -- `record_written_question` (pair lookup, P0002) and `submit_written_question` (thin client wrapper, grants) -- templates.
- `supabase/migrations/20261105210000_daily_question_own_clocks.sql:138-230` -- `record_daily_pick` takes the day row `for update` with membership in the WHERE.
- `supabase/migrations/20261125000000_daily_push_sender.sql:55-83,215-240` -- `daily_nudges` (unique `daily_nudges_sender_date_slot_key`, slot check, comment saying story 7 adds the trigger) and `user_local_date(user_id, at)` (null for a null arg).
- `supabase/migrations/20261126010000_daily_pick_pushes.sql` -- trigger + comment template; current `notify_push()` and `push_sender_settings` comment text to extend with `daily_nudges`.
- `supabase/functions/send-push/handler.ts:18-23` -- header says "the nudge is posted from story 8.7": reword to "since story 8.7". The `daily_nudge` branch (`:448`) already resolves `from_user`→`to_user`, held-0 copy, sound `default`.
- `supabase/tests/database/40_daily_question_gate.sql` -- AD-5 gate file: `plan(122)`; header story list; DAILY-014/015 list client RPCs; B's before-pick block (`:446-470`); DAILY-038 at `:388`; DAILY-031 NULL-uid pattern. Highest id DAILY-122.
- `supabase/tests/database/18_function_execute_grants.sql:97-116` -- FN-GRANT-008 alphabetical list.
- `supabase/tests/database/48_daily_reminders.sql:24-90` -- helper template (`pg_temp.mk` with zone/device, `link`, `day`, direct `daily_picks` insert, queued-body join on `body->>'id'`, `push_sender_settings` reset).
- `tests/api/push-daily-sender.spec.ts:95-198` -- reminder/nudge case hand-posts each `daily_nudges` row as story 8.3's stand-in for this trigger; header lines 8-11 say so.
- `tests/api/push-daily-picks.spec.ts` -- template for the new spec (throwaway pair, `seedPairDays`, `party.client.rpc`, absence shown by a hand post answering `zeros` plus empty `requestsFor`).
- `tests/support/helpers/push-requests.ts` -- `createParty`, `registerDevice`, `link`, `awaitRequests`, `requestsFor`, `postKindToSender`, `dailyPayload(kind, title, body, 'default')`, `zeros`; module comment lists the specs.
- `tests/support/factories/daily-question.ts:91` -- `seedPairDays(admin, pair, [{daysAgo: 0, picks: 'user'}])`: today with the first party's pick, host-zone `user_time_zones` rows for both.
- `tests/support/helpers/row-audit.ts:25-41` -- `AUDITED_TABLES`; add `daily_nudges: ['from_user', 'to_user']`.
- `src/api/validation/dailyQuestionSchemas.ts:18` -- `z.object` strips unknown keys, so the new `nudge` key breaks no client; do not edit.
- Hosted catalog, read read-only 2026-11-26: `daily_nudges`, `daily_day_snapshot` and `user_local_date` exist; no `send_daily_nudge`, `record_daily_nudge`, `daily_nudge_slot`; no trigger on `daily_nudges`, `daily_picks` or `daily_reminders`. Nothing hosted-only to drop.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261126020000_daily_nudge.sql` -- `daily_nudge_slot`, `record_daily_nudge`, `send_daily_nudge`, the replaced `daily_day_snapshot`, the trigger, the four comments, grants, in `begin … commit` -- the nudge (AD-16, AD-17, AD-10).
- [x] `supabase/tests/database/50_daily_nudges.sql` -- fixed-instant cases per Design Notes -- proves the rules and the trigger.
- [x] `supabase/tests/database/40_daily_question_gate.sql` -- DAILY-038 gains `nudge`; new: `nudge` carries exactly `slot` and `spent`; `send_daily_nudge` is executable by authenticated and not anon; refuses a NULL `auth.uid()`; B calling it before B's own pick is refused `DQ007` and writes no `daily_nudges` row; header line for story 8.7; plan count -- the AD-5 gate.
- [x] `supabase/tests/database/18_function_execute_grants.sql` -- FN-GRANT-008 gains `send_daily_nudge` -- exact grant list.
- [x] `src/types/database.types.ts` -- regenerate with `npm run db:types` -- the new functions.
- [x] `tests/api/push-daily-nudge.spec.ts` -- new spec per Design Notes -- the Playwright api check.
- [x] `tests/api/push-daily-sender.spec.ts` -- nudge steps: after each `addNudge`, wait for the trigger's records (`awaitRequests`), then the hand post is a replay (`skipped`); the switched-off nudge's hand post still answers `zeros` with no records; header says the nudge posts through its trigger (8.7) -- keeps story 8.3's checks true.
- [x] `tests/support/helpers/row-audit.ts` -- `daily_nudges` joins `AUDITED_TABLES` -- the ticket.
- [x] `tests/support/helpers/push-requests.ts`, `supabase/functions/send-push/handler.ts` -- comments only -- accuracy.

**Acceptance Criteria:**
- Given the migration applied, when `supabase test db` runs, then every file passes, `50_daily_nudges.sql` included.
- Given the edge runtime serving `send-push`, when the push api specs run, then all pass and the row audit reports no leftover rows.
- Given the migrated stack, when `npm run db:types` runs twice, then the second run leaves `src/types/database.types.ts` unchanged and it holds `send_daily_nudge`.

## Implementation Notes

- Files: `supabase/migrations/20261126020000_daily_nudge.sql`, `supabase/tests/database/50_daily_nudges.sql` (48 assertions), `supabase/tests/database/40_daily_question_gate.sql` (DAILY-038 gains `nudge`; new DAILY-123 to DAILY-129; `plan(129)`), `supabase/tests/database/18_function_execute_grants.sql` (FN-GRANT-008), `src/types/database.types.ts` (regenerated: `daily_nudge_slot`, `record_daily_nudge`, `send_daily_nudge`), `tests/api/push-daily-nudge.spec.ts`, `tests/api/push-daily-sender.spec.ts`, `tests/support/helpers/row-audit.ts`, `tests/support/helpers/push-requests.ts` and `supabase/functions/send-push/handler.ts` (comments).
- Not in the plan, forced by the `AUDITED_TABLES` change: `tests/unit/helpers/row-audit.test.ts` pins the audited table count, `12 * 2 * 2` becomes `13 * 2 * 2`.
- `50_daily_nudges.sql` opens the pair's days in their own statements before any snapshot call: `daily_day_snapshot` is `stable`, so it cannot see a `couple_days` row that `assign_couple_day` inserts in the same statement.
- The migration is applied to the shared local stack with `supabase migration up` (no reset).
- Verified 2026-11-26 (parent session, after the subagent): `supabase test db` 37 files / 1162 tests PASS; `npm run db:types` reproduces the committed file byte for byte; `npm run typecheck`, `npm run lint` clean; `row-audit.test.ts` 19 passed; `deno test --no-lock supabase/functions/send-push/` 123 passed; the six push api specs 19 passed with `supabase functions serve` (stopped afterwards), row audit clean.

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 13, false 7, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind-hunter) DQ009's message "The day has ended for your partner" is wrong when the partner's date has not reached the day (the case DAILY-NUDGE-014/015 test) — real. Fixed: the message is "The day is not your partner's current date" in the raise and the header; DAILY-NUDGE-015 expects it; the stack's function was replaced in place, no reset.
  - `[low]` `[patch]` (blind-hunter) The matrix row "recipient's day over" (recipient already on the next date) has no test, only the other direction — real. Fixed: DAILY-NUDGE-049/050, B as sender at 2030-09-13 01:00 UTC: slot null and DQ009.
  - `[low]` `[defer]` (blind-hunter) The once-per-slot limit counts the sender's date, not the day nudged about, so a sender past midnight spends the new date's slot on yesterday's day — real per AD-17's key; deferred (see `deferred`), needs different zones and a nudge after the sender's midnight, and the fix changes AD-17's rule. The "not documented" part is false: the header and function comment state the (viewer, sender-local date, slot) key.
  - `[low]` `[patch]` (blind-hunter) The snapshot's current-partner condition is untested; removing it leaves every test green — real. Fixed: DAILY-NUDGE-051/052 clear B's partner_id: slot null and P0002, then relink.
  - `[low]` `[patch]` (blind-hunter) 18_function_execute_grants.sql has a per-RPC "executable by authenticated" assertion for every client RPC but send_daily_nudge — real. Fixed: FN-GRANT-024 and plan(33).
  - `[false]` `[reject]` (blind-hunter) DAILY-014/015 still say "the seven client RPCs" — each names and checks exactly those seven, which stays true; send_daily_nudge's grants are DAILY-124/125, as the plan kept existing assertions unchanged.
  - `[false]` `[reject]` (blind-hunter) DAILY-NUDGE-030/048 join on existing rows, so a refusal that still posted would be invisible — a refusal raises, and throws_ok rolls back its subtransaction, queue insert included, so no call can exist for a missing row; a second trigger would double the joined count and DAILY-NUDGE-006 pins the one trigger.
  - `[low]` `[patch]` (blind-hunter) setUpPair returns `firstDevice` and nothing reads it — real dead value. Fixed: the return value is dropped; the parent session kept the first party's device registration (the subagent had removed it), so recording exactly the partner's tokens still shows the sender's device hears nothing.
  - `[low]` `[patch]` (blind-hunter) pg_temp.mk writes utc_offset_minutes 0 for America/New_York — real inconsistent fixture row. Fixed: mk takes an offset; New York carries -240.
  - `[false]` `[reject]` (blind-hunter) The snapshot does nudge lookups for every history entry — the IF's AND stops at the first false, so the partner_id and partner-date lookups run only where the viewer picked and the partner did not, and the spent query only with a slot (the current day).
  - `[low]` `[patch]` (blind-hunter) The api spec runs two independent scenarios as one test, so a failure in the first hides the second — real. Fixed: two `[P0]` tests in the serial describe, every assertion kept.
  - `[low]` `[defer]` (edge-case-hunter) Viewer already on the next date while the partner is on the day: a nudge about yesterday spends today's slot — same root cause as the blind-hunter limit row; deferred with it.
  - `[low]` `[defer]` (edge-case-hunter) The snapshot offers a slot while the viewer's own date is past the day — same root cause; deferred with it.
  - `[low]` `[defer]` (edge-case-hunter) The zone read twice in record_daily_nudge can mix a date and a slot from two zones under a concurrent zone write — real under READ COMMITTED; deferred (see `deferred`), needs a zone write within milliseconds of a nudge.
  - `[low]` `[defer]` (intent-alignment) Reading A3 ("one day" as the couple day) diverges from the sender-local key — same root cause as the limit row; deferred with it.
  - `[false]` `[reject]` (intent-alignment) The snapshot's 20:00 rules are tested on the internal function, not the client RPCs — AD-8 has pgTAP call internal functions with fixed instants, and client RPCs only pass now(); the client path is covered by DAILY-NUDGE-041/042 and the api spec.
  - `[false]` `[reject]` (intent-alignment) "The gate file shows no choice" is met by a refusal — the only satisfiable reading: AD-5 calls each client RPC as the second partner before their own pick, and send_daily_nudge must refuse then (DQ007).
  - `[false]` `[reject]` (intent-alignment) The switch-off check is a hand post, not the trigger's own post — the sender's switch path is the same for either post, and the trigger firing through the client RPC is proven by the Alice/Bob test.
  - `[low]` `[defer]` (intent-alignment) The spec depends on the host date and zone — real low midnight flake, the one 8.3 and 8.6 deferred for their specs; deferred (see `deferred`).
  - `[false]` `[reject]` (intent-alignment) Whether the types match `npm run db:types` is unverified — verified: a second `npm run db:types` leaves the file byte-identical (cmp).

## Design Notes

Refusal codes (new, `DQ007`–`DQ010`) carry short messages with no choice: `'Pick before nudging'`, `'Your partner has picked'`, `'The day has ended for your partner'`, `'Nudge already sent'`. `spent` is false with no slot so story 8.8's merge rule ("never moves `spent` back while `slot` is unchanged") never sees a spent null slot.

`50_daily_nudges.sql` (inline helpers as in 48; `a` zone `UTC`, `b` zone `America/New_York` (UTC-4 in September), both with a device; `o`/`d` another couple; `u` unlinked; `c`/`e` a pair with no zone row). Day `2030-09-10` for a/b; picks inserted directly:
1. Structure: the two internal functions are security definer with empty search_path, denied to anon/authenticated/PUBLIC, granted to service_role; `send_daily_nudge` security definer, empty search_path; `daily_nudges` carries exactly one non-internal trigger, `daily_nudges_push_after_insert notify_push O 5`, and its def has no WHEN and kind `daily_nudge`.
2. No picks: a's snapshot nudge `{slot: null, spent: false}`; `record_daily_nudge(a)` → DQ007.
3. A picks. At `2030-09-10 03:00+00` (B's clock 09-09 23:00): slot null; nudge → DQ009.
4. At `12:00+00`: `{after_pick, false}`; B's snapshot slot null (no own pick). Nudge → `{after_pick, true}`; row `to_user` b, `sender_local_date` 2030-09-10, slot `after_pick`; one queued call, keys `id,kind`, kind `daily_nudge`, to the sender URL with the secret.
5. At `19:59:59+00` still `{after_pick, true}`, nudge → DQ010. At `20:00:00+00` `{evening, false}` while B's clock reads 16:00 (the sender's clock decides). Nudge → `{evening, true}`; at `21:00+00` a third → DQ010; two rows, two queued calls (refusals queue nothing).
6. B picks: a's slot null; nudge → DQ008.
7. Sender's clock, not UTC: day `2030-09-12`, B picks; at `2030-09-12 21:00+00` (B 17:00) B's slot is `after_pick`; B nudges; row `sender_local_date` 2030-09-12, slot `after_pick`.
8. o and u call `record_daily_nudge` on a/b's day → P0002; a day id no row has → P0002.
9. Client RPC: c/e (no zone, UTC) on today's UTC date, c picked: as c, `send_daily_nudge` returns `nudge.spent` true and `slot` equal to `daily_nudge_slot(c, now())`; again → DQ010; as e → DQ007.

`tests/api/push-daily-nudge.spec.ts` (`[P0]`, serial, throwaway accounts `dailynudge`): (1) Alice (one device) and Bob (two) linked, `seedPairDays` today `picks: 'user'`. Alice's `send_daily_nudge({day_id})` answers no error, `state` `me`, `nudge.spent` true, `nudge.slot` equal to the one `daily_nudges` row's slot (no host-clock guess). `awaitRequests(nudgeId, 'daily_nudge_id', 2)`: Bob's two tokens, `dailyPayload('daily_nudge', '{Alice} nudged you', 'Your streak needs your pick today.', 'default')` (held 0); hand post → `skipped: 2`. Alice again → error code `DQ010`, still one row. Bob → `DQ007`. (2) Carol and Dave, Dave's `daily_nudge` off: Carol's nudge succeeds; hand post → `zeros`; `requestsFor` `[]`.

The new spec repeats the pick spec's pair setup; keep it local, since the shared helpers already cover every step and the two specs seed differently.

## Verification

**Commands:**
- `supabase migration up && npm run db:types && npm run db:types && git diff --stat src/types/database.types.ts` -- expected: applied; types hold the two functions, the second run changes nothing.
- `supabase test db` -- expected: all files pass.
- `supabase functions serve` (background, stopped afterwards) then `fnox exec -- npx playwright test --project=api tests/api/push-daily-nudge.spec.ts tests/api/push-daily-sender.spec.ts tests/api/push-daily-picks.spec.ts tests/api/push-daily-reminders.spec.ts tests/api/push-partner-activity-trigger.spec.ts tests/api/push-love-note-trigger.spec.ts` -- expected: all pass, row audit clean.
- `npm run typecheck && npm run lint` -- expected: pass.
- `npx vitest run tests/unit/helpers/row-audit.test.ts` -- expected: pass.
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass (comment-only change).

## Auto Run Result

- **Summary:** The server now takes a nudge and pushes it (spine AD-16, AD-17, AD-10).
  - `send_daily_nudge(day_id)` is the client RPC, a thin wrapper over the internal `record_daily_nudge(viewer, day_id, at)` at `now()`.
  - It refuses with P0002 (not the caller's current pair's day), DQ007 (no own pick), DQ008 (the partner has picked), DQ009 (the day is not the partner's current date, from `user_local_date`) and DQ010 (the slot is spent).
  - The internal `daily_nudge_slot(sender, at)` is the one definition of the slot: `after_pick` before 20:00 on the sender's stored-zone clock, `evening` from 20:00.
  - The `daily_nudges` AFTER INSERT trigger posts `{kind: 'daily_nudge', id}` through `notify_push`, which the sender has known since story 8.3.
  - `daily_day_snapshot` gains `nudge { slot, spent }`. `slot` is null when no nudge can be sent, and `spent` is false with no slot.
  - `daily_nudges` joins `AUDITED_TABLES`, and the types are regenerated. No client code changed.
- **Files changed:**
  - `supabase/migrations/20261126020000_daily_nudge.sql`: the three functions, the replaced snapshot, the trigger, the comments and the grants.
  - `supabase/tests/database/50_daily_nudges.sql`: 52 assertions at fixed instants, covering the structure, the grants and the trigger, the slot edges, every refusal and snapshot state, both clock directions, the current-pair condition and the client RPC.
  - `supabase/tests/database/40_daily_question_gate.sql`: DAILY-038 gains `nudge`. New DAILY-123 to DAILY-129: the nudge keys, the grants, a NULL uid, and B refused DQ007 before their own pick with no row and no slot.
  - `supabase/tests/database/18_function_execute_grants.sql`: FN-GRANT-008 gains `send_daily_nudge`, plus a new FN-GRANT-024.
  - `src/types/database.types.ts`: regenerated.
  - `tests/api/push-daily-nudge.spec.ts`: new, two `[P0]` tests through the client RPC, the trigger and the sender.
  - `tests/api/push-daily-sender.spec.ts`: the nudge steps wait for the trigger's records, so the hand post is a replay.
  - `tests/support/helpers/row-audit.ts` and `tests/unit/helpers/row-audit.test.ts`: `daily_nudges` is audited, and the table count goes from 12 to 13.
  - `tests/support/helpers/push-requests.ts` and `supabase/functions/send-push/handler.ts`: comments only.
- **Review findings:** 20 findings, all from one thorough pass with four lenses: high 0, medium 0, low 13, false 7. The verification-gap lens found no gaps.
  - **Patched (7 low):**
    - the DQ009 message;
    - a recipient-ahead test;
    - a current-partner test;
    - FN-GRANT-024;
    - the spec's unused return value;
    - the fixture offset;
    - the spec split into two tests.
  - **Deferred (3 entries in `deferred`, 6 low rows):**
    - the sender-date crossing, an AD-17 rule question (four rows);
    - the double zone read;
    - the spec's host-midnight flake.
  - **Rejected as false (7):**
    - DAILY-014/015 still describe their seven RPCs truly;
    - the queue joins cannot miss a rolled-back call;
    - the history lookups short-circuit;
    - AD-8 tests internal functions at fixed instants;
    - the gate's choice check is met by a refusal;
    - the switch path is the same for a hand post;
    - the generated types were verified with `cmp`.
- **Follow-up review recommendation:** `false`. This first pass patched 0 high and 0 medium entries.
- **Verification (2026-11-26, after the patches):**
  - `supabase migration up`: applied to the shared stack, with no reset. The DQ009 wording was replaced in place on the stack.
  - `supabase test db`: 37 files, 1167 tests, PASS.
  - `npm run db:types`: byte-identical.
  - `npm run typecheck` and `npm run lint`: clean.
  - `row-audit.test.ts`: 19 passed.
  - `deno test --no-lock supabase/functions/send-push/`: 123 passed.
  - The six push api specs: 20 passed with `supabase functions serve` running (stopped afterwards). The row audit reported no leftover rows.
- **Residual risks:**
  - On hosted, the trigger meets a sender that already accepts `daily_nudge` (story 8.3, deployed by the first loop run). `deploy.yml` applies the migration before it redeploys the functions.
  - The three deferred items above.
  - Story 8.8 must parse `nudge` in `DailyDaySnapshotSchema` (which strips it today) and map DQ007 to DQ010 to "Your nudge could not be sent.".
