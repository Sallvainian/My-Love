---
type: review
lens: verify
target: _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md
round: 2
against: [review-adversary.md, review-rubric.md, review-reconcile.md, review-currency.md]
units: [epic-daily-question, epic-streak-and-partner-page, epic-daily-pushes-and-nudge, epic-reply-in-love-notes, epic-remove-moods-and-interactions]
date: '2026-11-05'
---

# Verification review: revised Daily Question spine

## Verdict

The revision closes every round-1 critical and high finding except one, which it closes only in part (rubric H3, table grants). I found no path that leaks a partner's choice before the reader's own pick exists. The revision leaves or introduces 4 high holes, 8 medium and 5 low:

- the reply's pair check cannot be added to `love_notes` the way AD-14 implies;
- the nudge cap is keyed on `day_id`, so it is not a daily cap;
- the current-date drop removes the both-answered push in R20's own scenario;
- "the 8 PM push spends a slot" reads two ways.

Each fix is one line in an existing AD. The spine is buildable once those four are settled.

Spine line numbers are from the file as read on 2026-11-05 (296 lines). The SQL claims marked "verified" were run on the local stack (`supabase_db_My-Love`, Postgres 17.11) inside `begin … rollback`.

Tally: round-1 critical/high: 13. Closed 12, partly 1, open 0. New: 0 critical, 4 high, 8 medium, 5 low.

## 1. Round-1 critical and high findings

The currency review had no critical or high findings. Its five mediums and lows are all addressed: Stack hosted column (spine:222-226), tzdata fallback (spine:59), service-role key deferred (spine:291), pg_cron install/unschedule guard (spine:121), and `job_run_details` pruning (spine:121).

| # | Finding | Status | Spine line that closes it |
| --- | --- | --- | --- |
| Adversary CR-1 | Hidden pick enforced only by a policy that definer RPCs and `send-push` bypass | Closed | 78: "`visible_daily_picks(viewer, at)` is a `security definer` set-returning internal function, and the only SQL that selects `daily_picks.choice`"; 82: "`send-push` never reads `choice`"; 83: the pgTAP file over every client RPC. Residual: the table SELECT policy is a second gate that the pgTAP file does not exercise (N-M5). |
| Adversary CR-2 | Self-referencing policy raises 42P17; no current-pair term | Closed | 79: "`user_id = auth.uid() or (user_id = get_my_partner_id() and my_daily_pick_exists(day_id))`. `my_daily_pick_exists` is a definer helper keyed on `auth.uid()` alone." The definer helper reads past RLS (no `FORCE RLS` in the repo), so it does not recurse. |
| Adversary H-1 | Client-callable functions take pair and instant | Closed | 184-185: internal functions "take the pair, viewer and `at`. Each is `revoke execute … from public, anon, authenticated`"; client RPCs "take no pair, viewer or `at`". 114: "Client RPCs never take `at`; they pass `now()`." Verified locally that `service_role` keeps its explicit EXECUTE after that revoke (default ACL `service_role=X/postgres`), so `send-push` can still call `couple_streak`. |
| Adversary H-2 | `today_state` has no caller under the service role | Closed | 101: `couple_streak(user_a, user_b, viewer, at)`; 108: "`send-push` passes the recipient." |
| Adversary H-3 | Partner-picked vs both-answered decided after the race | Closed | 91-92: "locks the `couple_days` row (`for update`) … stores `is_second`"; 142: "`send-push` reads `is_second` and never infers order"; 137: recipients "Partner / the first picker". Residual: the posted kind strings are not fixed (N-M6). |
| Adversary H-4 | Queued pick has no owner; key collides | Closed | 158: rows hold `user_id` … "keyed `[user_id, day_id]`, with a `by-user` index"; 159: "drains only the signed-in account's rows … under `withSyncLock`". |
| Adversary H-5 | AD-5 local-copy ban contradicts AD-6/AD-13 | Closed | 81: "A local copy holds a partner's `choice` only when it came from a server answer the gate released to that account." |
| Adversary H-6 | No shared by-id snapshot shape | Closed | 193: `daily_day_snapshot(day_id, viewer, at)`, returned by `get_daily_day`, `get_daily_day_by_id`, `submit_daily_pick`, `get_daily_history`; 151: "A receiver re-reads that `day_id`"; 169: "a map keyed by `day_id`; today is one entry of it". Residual: whole-map writes race (N-M7). |
| Rubric C1 | Pick-queue row has no owner (shared device) | Closed | 158-159, as for H-4. The owner has since said no one shares a phone (memlog), so this guard is kept for parity with `note-queue`. |
| Rubric H1 | AD-5 policy cannot be written (42P17) | Closed | 79, as for CR-2; 185: "They and `my_daily_pick_exists` are the only new entries in FN-GRANT-008." |
| Rubric H2 | AD-5 vs AD-13 on local copies | Closed | 81. |
| Rubric H3 | Function security, pair guards, grants and `user_time_zones` RLS unspecified | **Partly** | Functions are closed by 184-186 (tiers, `security definer`, `search_path = ''`, revoke, FN-GRANT-008). Grants are not. 186 states only "No daily table grants INSERT, UPDATE or DELETE" and "`daily_questions` grants no SELECT". SELECT on `couple_days`, `daily_picks`, `daily_nudges`, `daily_reminders` and `user_time_zones` is left open, so the rubric's `user_time_zones` RLS question is unanswered. N-H1 shows a concrete break caused by this gap. |
| Reconcile F1 | AD-5 bans the choice from every local copy, against R2 | Closed | 81. 80 also settles reconcile F2: "'no trace' in the Done-when means the choice". |

## 2. New holes

### High

#### N-H1. AD-14's pair check on `love_notes` either does nothing or breaks every love-note insert

AD-14 (spine:177) says: "The insert `with check` requires the day to belong to the note's own ordered pair." The live policy is `"Users can insert their own messages"`, `for insert to public with check (auth.uid() = from_user_id)` (`20251206024345_remote_schema.sql:245-251`, pinned in `26_love_notes_and_users_policies.sql`). Two epic 9 authors can each follow AD-14 and break it in different ways:

- **Unit A** adds a second permissive policy holding the `couple_day_id` check. Permissive policies are OR-ed, so the old policy alone admits any `couple_day_id`. **Verified** with a rolled-back pair of tables: the insert with a bogus day id succeeded.
- **Unit B** alters the existing policy, so the check subquery reads `couple_days` as the invoker. AD-15 never grants SELECT on `couple_days`. An epic 6 author who follows the repo's `revoke all … from anon, authenticated` pattern (`couple_settings.sql`) and "reads only through snapshots" then grants none. Every love-note insert then fails, including those with `couple_day_id` null. **Verified**: `ERROR: permission denied for table zz_days` on a null-day insert.

**Fix (AD-14):** "The check is added by `alter policy "Users can insert their own messages"`, never by a second permissive policy. It reads the day through a definer helper `couple_day_in_pair(couple_day_id, from_user_id, to_user_id)`, which is listed in FN-GRANT-008, and never selects `couple_days` directly."

#### N-H2. The nudge cap is per `day_id`, so it is not two per sender per day, and a nudge can name a day the recipient cannot act on

AD-17 (spine:200-201) keys the cap on `unique (from_user, day_id, slot)` and checks only that the sender's pick exists and the partner's does not. Nothing ties `day_id` to anyone's current date. So:

- Every past day the partner missed opens two more slots. A sender can send `2 × missed days` nudges today through `send_daily_nudge`. That breaks the owner's binding "two per sender per day".
- A sender an hour ahead at 00:30 can nudge on their own d+1. The partner, still on d, cannot open d+1 for another 23.5 hours, and `send-push`'s current-date drop (spine:142) covers pick pushes only, not `daily_nudge`.

**Fix (AD-17):** "`send_daily_nudge` refuses unless `day_id`'s `day` is the recipient's current date (AD-3). The cap is `unique (from_user, sender_local_date, slot)`."

#### N-H3. The current-date drop removes `daily_both_answered` in R20's own scenario

AD-10 (spine:142) says: "It drops a pick push whose `day` is not the recipient's current date." The rule was added to stop late partner-picked pushes (round-1 M-6), but it is worded for every pick push. Take R20's met-when case: A is an hour ahead. A picks d at 23:30 A-time, and B picks d at 23:30 B-time, which is 00:30 on d+1 for A. B's pick has `is_second` true, so `daily_both_answered` goes to A. A's current date is now d+1, so the push is dropped. R17's late drain also always loses it. Epic 8's Done-when needs all five kinds to arrive.

**Fix (AD-10):** "The current-date drop applies to `daily_partner_picked` only. `daily_both_answered` is sent whenever the day was not closed (AD-7) when the second pick was made."

#### N-H4. "The 8 PM `partner` push spends a slot" has two incompatible readings

AD-17 (spine:202) says the after-pick prompt, the waiting screen's button "and the 8 PM `partner` push all spend these same two slots". The owner's decision is that the push opens the waiting screen, where the user's tap spends the `evening` slot.

- **Unit A (epic 8, cron story)** reads "the push spends a slot" literally. When it enqueues the `partner` variant, it also inserts a `daily_nudges` row with slot `evening`. The partner then gets an automatic nudge the sender never sent, and the sender's button is greyed out before they tap it.
- **Unit B (epic 8, waiting-screen story)** spends the slot on the tap.

Both readings follow the AD word for word.

**Fix (AD-17):** "Only a tap on the after-pick prompt or the Nudge button inserts a nudge. The 8 PM `partner` push only opens the waiting screen, and is skipped when the recipient's `evening` slot is already spent."

### Medium

#### N-M1. `get_daily_day()` takes no arguments in AD-13, yet AD-3 makes it the only zone writer

AD-13 (spine:170) writes the signature as `get_daily_day()`. AD-3 (spine:65) says "Only the day fetch writes it" with `reported_at`, and AD-2 needs the sent IANA name and offset. A builder who follows AD-13's signature writes nothing to `user_time_zones`, so no user ever gets a scheduled push and every day closes on UTC (spine:65).

**Fix (AD-13):** state `get_daily_day(time_zone, utc_offset_minutes, reported_at)`.

#### N-M2. Which zone dates the fetch, the sent one or the stored one, is open

AD-2 (spine:59) says "a day fetch's date is the caller's current date in their zone (AD-3)". AD-3 (spine:65) updates the stored zone only when `reported_at` is newer. Take a second device in a different zone whose clock is a few seconds behind, or a phone that has just landed but is not the newest reporter.

- If the fetch uses the stored zone, the server's date and the device date differ.
- AD-12's "refuses a pick when the device date is not the shown day's `day`, and re-fetches" (spine:161) then loops, and Daily can never be picked on that device.

`reported_at` is also client-sent with no upper bound. A phone whose clock once ran a year ahead freezes the stored zone until that date.

**Fix (AD-2/AD-3):** "The fetch dates itself with the zone it sends. The stored zone is used only by cron and closure. `reported_at` above `now() + 5 min` is clamped to `now()`."

#### N-M3. The offset fallback has no single home and no sign convention

AD-2 (spine:59) applies "name if known, else offset" in at least five places: fetch, pick, closure, cron and the nudge slot. It does not say:

- **Which sign the offset uses.** JS `getTimezoneOffset()` is west-positive, and Postgres text offsets are POSIX-inverted. **Verified:** `timestamptz '2026-11-05 12:00Z' at time zone '-05'` gives `17:00`, while `at time zone interval '-05:00'` and `make_interval(mins => -300)` give `07:00`.
- **That a stored name must never reach `AT TIME ZONE` unchecked.** A name unknown on hosted (`America/Coyhaique`) raises an error there, which breaks `couple_streak` for that couple.

The `pg_timezone_names` lookup costs 7–8 ms (currency F2). Repeated per date inside `couple_streak`, it grows with history length.

**Fix (AD-2):** "`utc_offset_minutes` is east-positive (`-getTimezoneOffset()`). One immutable-by-input helper, `effective_zone(name, offset)`, resolved once when a row is written and stored beside it, is the only thing passed to `AT TIME ZONE`, and an offset is applied as an interval."

#### N-M4. A written question can be stranded, and the second writer's question is asked rather than pooled

AD-4 (spine:71) has three gaps:

1. **Lost when its date gets no row.** `assign_couple_day` takes a pending question only "for that date". If the target date gets no `couple_days` row (nobody opens the app that day and no one has a push device), the question stays pending forever. It is never asked and never joins the pool, against R4.
2. **Stranded by a race.** `submit_written_question` is not said to take the pair advisory lock. Running concurrently with `assign_couple_day` for the same date, it can compute a target that the other transaction is assigning from the pool, and the row is stranded the same way.
3. **Second writer's question asked next.** If A's question has already been assigned to d+1 when B writes from the same revealed day d, B's target becomes d+2. B's question is then asked, where R3 says "the first sent is asked and the other joins the pool".

**Fix (AD-4):**
- `submit_written_question` takes the same pair lock and records `source_day_id`.
- A second question for the same `source_day_id` joins the pool whatever the first one's state.
- `assign_couple_day` takes the earliest pending question with `target_day <= day`.

#### N-M5. Two gates for the choice, and the pgTAP file covers one

AD-5 (spine:78-79) keeps a table SELECT policy, so a direct PostgREST `select choice from daily_picks` is SQL outside `visible_daily_picks`. That contradicts "the only SQL that selects `daily_picks.choice`". The policy and the function each encode the rule, with different wording: the function adds "the day belongs to the viewer's current pair". The pgTAP file at spine:83 "calls every client RPC", so drift in the policy goes unseen.

**Fix (AD-5):** "The pgTAP file also selects `daily_picks` directly as the second partner before their pick. Alternatively, `daily_picks` grants no SELECT and the policy exists only for C1's RLS requirement."

#### N-M6. The trigger's posted kind strings are not fixed

AD-10's table (spine:137-139) maps two kinds onto one trigger table twice. `notify_push` posts the constant `tg_argv[0]` (`20261031020000…sql:105`), and `parseBody` rejects any kind not in `POSTED_KINDS` (`send-push/handler.ts:146,254-262`). Two builds both satisfy the AD:

- **Unit A** uses two triggers with `WHEN (new.is_second)` and `WHEN (new.kind = 'morning')`, posting the final kinds.
- **Unit B** uses one trigger posting `daily_pick` or `daily_reminder` and lets `send-push` branch on `is_second` or `kind`.

If epic 8's sender story and trigger story pick differently, every daily push answers 400. The "one deploy before" step (spine:144) does not catch this, because each half passes its own tests.

**Fix (AD-10):** "One trigger per PushKind, with a `WHEN` clause, posting the final kind string."

#### N-M7. Day snapshots are one whole-value copy with four writers

AD-13 (spine:169) makes all day snapshots one `localCopy` value. `writeLocalCopy` "replace[s] the saved value" (`src/services/localCopy.ts:15`). The today refresher, the history refresher, the broadcast re-read by `day_id` and the submit response each read the map, merge their entry and write it back. Interleaved, one drops another's entries. A slower read issued before the partner's pick can also overwrite a `both` entry with `me`, so the reveal disappears until the next refresh.

**Fix (AD-13):** "Map writes go through one merge function under a lock, and an entry's `state` never moves back (none → me/partner → both)."

#### N-M8. Nothing tells the waiting screen whether the current nudge slot is spent

AD-17 (spine:202) says "the button greys out once the current slot is spent". AD-16's one snapshot shape (spine:193) has no nudge field, and the 20:00 boundary is on the server's stored zone, not the device. One builder adds a field to the snapshot. Another keeps device-local state, which a second device or a reinstall loses. A third learns only from the unique-violation error.

**Fix (AD-16):** add `nudge { slot: 'after_pick' | 'evening' | null, spent: boolean }` to the snapshot, computed server-side for the viewer.

### Low

| # | Hole | Fix (one line) |
| --- | --- | --- |
| N-L1 | `daily_reminders` has no variant column (spine:122), so the `self`/`partner` variant is chosen at enqueue but has nowhere to be stored. `send-push` then re-derives it at send time and can disagree. | Store `kind in ('morning','evening_self','evening_partner')` and map both evening values to `daily_reminder`. |
| N-L2 | Adding `love_notes.couple_day_id` needs `love_notes_visible` recreated, because `select n.*` freezes its columns (`20260817000000…sql:115-140`). AD-14 does not say so. `17_love_note_removals.sql` catches it, but late. | AD-14: "recreate `love_notes_visible` in the same migration." |
| N-L3 | "`send-push` never reads `choice`" (spine:82) is prose only. The service role bypasses RLS but not column privileges. | Revoke table SELECT on `daily_picks` from `service_role` and grant it every column except `choice`. |
| N-L4 | `daily-celebrated` (spine:171) is written by an animation, against `localCopy`'s fill-source rule ("Never from a default, a guess…", `localCopy.ts:37-38`), so a reviewer holding that rule rejects it. | AD-13: name it as the one device-state kind and exempt it in the `localCopy.ts` header in the same change. |
| N-L5 | The initiative and epic 6 Done-when still say "no trace of the first pick" (initiative:53, epic-daily-question:17). The spine redefines this as the choice (spine:80), but a test written from the ticket asserts that the snapshot's `state` is hidden. | Ask Sofia to amend both Done-when lines to "no trace of the choice" (the memlog already has this question open). |

## 3. Leak paths checked and found closed

I found no path that releases a partner's `choice` before the reader's own pick exists on the server.

- **Snapshot paths:** `get_daily_day`, `get_daily_day_by_id`, `get_daily_history` and the `submit_daily_pick` repeat all read through the gate (spine:193).
- **`couple_streak`:** `same` sums only days that are done, and a done day needs the viewer's own pick (spine:102,107).
- **Broadcasts:** the payload is `{ day_id }` on a partner-only INSERT topic. `20260912010000…sql` filters by topic only, not by event, so the new events are allowed.
- **Pushes:** `send-push` never reads `choice`. N-L3 would enforce that in Postgres.
- **The reply attachment:** it is read by the recipient through `get_daily_day_by_id`, and copying question text is forbidden (spine:177). An API-crafted reply on an unrevealed day therefore shows the recipient `state: 'partner'` with no choice.
- **The pick queue:** reads are per account (spine:158-160).
- **A back-dated pick after relinking:** it reveals only because the caller then has a pick, which is what R2 allows. The trusted clock is accepted in the initiative Notes.

## Evidence

- **Repo files read:**
  - `supabase/migrations/20261031020000_push_moods_photos_interactions.sql`, `20261031040000_push_partner_requests.sql`, `20261031050000_push_preferences.sql`, `20260912010000_private_couple_broadcast_policies.sql`, `20260923020000_couple_settings.sql`, `20260817000000_love_note_removals.sql`, and the `love_notes` policy in `20251206024345_remote_schema.sql`;
  - `supabase/tests/database/18_function_execute_grants.sql` and `26_love_notes_and_users_policies.sql`;
  - `supabase/functions/send-push/handler.ts` and `index.ts`;
  - `src/api/moodSyncService.ts` (registry and channel binding), `src/services/noteQueue.ts`, `src/services/localCopy.ts` (header), and `src/services/pushNotifications.ts` (`viewForPush`).
- **Local SQL, run inside rolled-back transactions:**
  - a permissive OR admitting a bogus FK value;
  - a policy subquery on an ungranted table raising `permission denied`;
  - the sign of an `AT TIME ZONE` text offset against an interval;
  - `pg_default_acl` for functions (`service_role` keeps EXECUTE after revoking PUBLIC, anon and authenticated).
- **Not run:** nothing on hosted. Advisory-lock behaviour across the per-user exception blocks in `enqueue_daily_reminders` is UNVERIFIED. My expectation is that the locks taken in committed subtransactions are held until the cron transaction ends, which is harmless at couple scale.
