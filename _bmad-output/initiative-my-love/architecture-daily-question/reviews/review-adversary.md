---
type: review
lens: adversary
target: _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md
units: [epic-daily-question, epic-streak-and-partner-page, epic-daily-pushes-and-nudge, epic-reply-in-love-notes, epic-remove-moods-and-interactions]
date: '2026-11-05'
---

# Adversarial review: Daily Question spine

Method: for each hole, two units one level down (epics 6–10 or stories in them) that each follow every AD word for word and still build things that don't fit together, or leak the hidden pick (R2/C1). Each hole ends with the AD that would close it. Code claims cite the file read. Where I did not read the code, the claim is marked UNVERIFIED.

Verdict: **not ready to build from.** AD-5 promises a server-enforced hidden pick, but it is written as a table policy, and every read path the spine routes (definer RPCs, `send-push` under the service role) skips table policies. Several functions also take the pair and the instant as caller-supplied arguments.

Counts: 2 critical, 6 high, 11 medium, 6 low.

---

## Critical

### CR-1. AD-5 is enforced only by a policy that every routed read path bypasses

- **Unit A (epic 6, "day RPC" story):** the day fetch has to call `assign_couple_day`, which inserts `couple_days`. AD-4 makes it the only creator, so clients get no INSERT on that table, and the fetch is therefore written `security definer`. It builds its `{ status: 'ok', … }` snapshot by selecting `daily_picks` for the day. It obeys AD-2, AD-4, AD-6 and AD-13. AD-5's policy exists and passes its pgTAP test.
- **Unit B (epic 7, history / Same-Different story):** `couple_streak` and a past-days read are `security definer` because they must see both partners' picks to count `same`. The history RPC returns `{ day, my_choice, partner_choice, same }` for every day.
- **Clash:** in this repo, functions are owned by the table owner and no table uses `FORCE ROW LEVEL SECURITY` (grep of `supabase/migrations/` finds none). The repo itself records that a definer function "bypasses RLS" (`20260205000001_fix_users_rls_recursion.sql:7`). Both units therefore return the partner's `choice` before the caller's own pick exists. AD-5's own sentence ("the `daily_picks` SELECT policy admits…") is satisfied, and C1 is broken anyway. `send-push` reads with the service role (BYPASSRLS, `20260818000000…:334`). Nothing ties its payload builder to the gate either: AD-10 only says the copy "never includes a choice".
- **Also broken by the same gap:** AD-6's "returns the snapshot including the partner's pick when AD-5 admits it" leaves each RPC author to re-implement "admits" separately.
- **Proposed AD-5 (replacement):** "The hidden pick has one gate: `public.visible_daily_picks(viewer uuid, at timestamptz)`, a `security definer` set-returning function. It is the only SQL that selects `daily_picks.choice`. It returns the viewer's own rows, and a partner row only where (a) the viewer's own pick for that `day_id` exists and (b) the day belongs to the viewer's current pair (`get_my_partner_id()`). Every RPC that returns a choice (day snapshot, submit, history, by-id day read) selects through it with `viewer = auth.uid()`. `couple_streak` counts `same` only over days where both rows exist. `send-push` never reads `choice`. One pgTAP file calls every client RPC as the second partner before their pick and asserts no `choice`, `same` or per-day mark for that day. Any new RPC is added to that file in the same change, as FN-GRANT-008 is."

### CR-2. AD-5's policy, as written, is a self-referencing policy (42P17)

- **Unit A (epic 6, migration story):** writes the policy literally: `using (user_id = auth.uid() or exists (select 1 from daily_picks p where p.day_id = daily_picks.day_id and p.user_id = auth.uid()))`.
- **Unit B (any epic 7/9 query against `daily_picks`):** errors with "infinite recursion detected in policy". This is the trap AGENTS.md records for `public.users`, and `20260205000001` fixed it there with a definer helper.
- **Also:** the AD-5 wording "a partner's row" has no current-pair term. One author keys the policy on "any row of a day where I have a pick", and then after an unlink and relink the caller still reads the ex-partner's picks on the old pair's days, against AD-1's "new pair starts with an empty history".
- **Proposed tightening (folded into CR-1's gate):** the policy calls a definer helper `public.my_daily_pick_exists(day_id)` keyed on `auth.uid()` only, never on a passed user. The helper is listed in FN-GRANT-008. The partner arm also requires `user_id = get_my_partner_id()`.

---

## High

### H-1. Client-callable functions take the pair and the instant as arguments

- **Unit A (epic 7):** follows the Conventions row "each new RPC is added to FN-GRANT-008" and grants `couple_streak(user_a, user_b, at)` to `authenticated`, because AD-7 says "the client … call[s] this function".
- **Unit B (epic 6):** grants `assign_couple_day(user_a, user_b, day)` the same way, because the client's day fetch needs it. AD-8 requires the `at` parameter on every time-dependent function, the day fetch included.
- **Clash / leak:** any signed-in user can (a) read any couple's streak and Same counts (if definer), (b) pre-assign days far in the future, using up the cycle (R4) and taking dates that written questions target (R3), and (c) pass `at` in the future to read tomorrow's question, or a closed-day state, early.
- **Proposed AD-15:** "Two tiers. Internal functions (`assign_couple_day`, `couple_streak_at`, `enqueue_daily_reminders`, the CR-1 gate) take the pair, viewer and `at` explicitly. They are revoked from `anon` and `authenticated` and are what pgTAP calls with fixed instants (AD-8). Client RPCs (`get_daily_day`, `submit_daily_pick`, `get_couple_streak`, `get_daily_history`, `get_daily_day_by_id`) take no pair, viewer or `at`. They derive the pair from `auth.uid()` and `get_my_partner_id()`, pass `now()`, and only they go in FN-GRANT-008."

### H-2. `couple_streak`'s "caller's own date" has no caller under the service role

- **Unit A (epic 7):** computes `today_state` from `auth.uid()`'s zone, as AD-7 says ("for the caller's own date").
- **Unit B (epic 8):** `send-push` calls the same function with the service role, as AD-7 requires ("the client and `send-push` both call this function"). `auth.uid()` is null, so `today_state` falls back to UTC or errors, and the both-answered copy quotes a state for the wrong clock.
- **Proposed AD-7 amendment:** "`couple_streak` takes `viewer uuid` and returns `today_state` for the viewer's zone (AD-3). The client wrapper passes `auth.uid()`; `send-push` passes the recipient."

### H-3. Partner-picked versus both-answered is decided at send time, after the race

- **Unit A (epic 8, trigger story):** `notify_push('daily_pick')` posts `{kind, id}`. The trigger argument is a fixed string per trigger (`20261031020000…:105`, `tg_argv[0]`). So, per AD-10, the pick row is "resolved" to a kind by `send-push`.
- **Unit B (epic 8, payload story):** `resolveSource` (`supabase/functions/send-push/handler.ts:278`) reads state when the request arrives. `net.http_post` is asynchronous (`20261031020000…:35`), so the request can arrive seconds after the second pick has committed.
- **Clash:** when the partners pick close together, both rows resolve to `daily_both_answered`. The second picker gets a "both answered" push about their own tap, and nobody gets `daily_partner_picked`. If instead the kind is classified inside the trigger, two concurrent READ COMMITTED inserts each see no other pick, and no both-answered push goes out. `push_requests` dedupes per row (`daily_pick_id, token`), so it cannot catch either case.
- **Proposed AD-6 amendment:** "`submit_daily_pick` takes `select … for update` on the `couple_days` row before inserting, and stores `is_second boolean` on the pick. The trigger posts the kind from that column. `send-push` never infers order. The recipient of `daily_partner_picked` is the partner. The recipient of `daily_both_answered` is the first picker only."

### H-4. A queued pick has no owner, and its key can collide on a shared device

- **Unit A (epic 6, `pickQueue.ts`):** stores exactly the fields AD-12 lists (`day_id, choice, picked_at, time_zone`) under the key `day_id`. AD-12 names no other field, and the queue "survives sign-out".
- **Unit B (epic 6, `dailySlice` drain):** drains "the queue oldest first … at start", as AD-12 says.
- **Clash / leak:** on a shared iPad, partner A picks offline and signs out, then partner B signs in. B's slice shows the queued choice as "your pick" (that is A's hidden pick, against R2) and submits it as B's own. `submit_daily_pick` accepts it, because the day belongs to B's pair too, which breaks R1 ("each saved pick belongs to its picker alone"). If B picks offline as well, the shared `day_id` key overwrites A's row. `note-queue` avoids all of this with `userId` and a `by-user` index (`src/services/noteQueue.ts:11,17`), but AD-12 says "like `note-queue`" only about surviving sign-out.
- **Proposed AD-12 amendment:** "Each row holds `user_id` and is keyed `[user_id, day_id]`, with a `by-user` index. Only the signed-in account's rows are read, shown or drained, under a `withSyncLock`, as in `notesSlice.drainQueuedNotes`. There is at most one row per user per day."

### H-5. AD-5's "no local copy carries a partner's choice" contradicts AD-6 and AD-13

- **Unit A (epic 6):** follows AD-13 and caches the day snapshot. AD-6 says that snapshot includes the partner's pick once it is admitted, so the copy holds the revealed choice and the reveal shows offline.
- **Unit B (epic 7):** follows AD-5 literally ("no … local copy ever carries a partner's `choice`"). It strips choices from the history copy, so Same/Different and past reveals cannot render offline, and it rejects Unit A's copy in review.
- **Proposed AD-5 wording:** "No broadcast or push payload ever carries a `choice`. A local copy carries a partner's `choice` only when it came from a server answer to that account made after the account's own pick existed on the server. It never comes from a queued row, a broadcast or another account's state."

### H-6. One snapshot shape, read by day id, is missing, and four units each need it

- **Units:** the today snapshot (epic 6, AD-6's return), the history copy (epic 7, R11), the reply attachment's "tapping … opens that day's reveal" (epic 9, AD-14), and the receiver's "re-read the day" on `daily_pick {day_id}` (AD-11).
- **Clash:** AD-2 defines only a fetch by the caller's own date. A receiver a day ahead is told about `day_id` d. It re-reads its own date, d+1, so the reveal of d never shows live for it. Epic 9's attachment tap has no by-id read path, so it invents one, probably definer and outside the gate. Epic 7's history invents a second row shape. AD-5's "state" is undefined, so one author sends `partner_picked: true` and another `state: 'partner'`. The today copy and the history copy then hold the same day twice, can disagree, and only the copy-overwrite rule decides which wins.
- **Proposed AD-16:** "One projection, `daily_day_snapshot(day_id, viewer, at)`: `{ day_id, day, question {id, this, that}, state: 'none'|'me'|'partner'|'both', my_choice, partner_choice|null }`. It is read through the CR-1 gate and returned by `get_daily_day` (own date), `get_daily_day_by_id`, `submit_daily_pick` and, as an array, `get_daily_history`. A broadcast receiver re-reads by the `day_id` it was given. The localCopy kinds store snapshots keyed by `day_id`: today is one entry of the history map, not a second copy."

---

## Medium

### M-1. Two writers of `user_time_zones`; a stale queued pick moves the clock back

- **Unit A (epic 6, day fetch):** upserts the current zone (AD-3).
- **Unit B (epic 6, drain):** upserts the `time_zone` stored in the queued row when the pick was made (AD-3: "every pick upserts it"). A pick made in New York and drained after a flight to London sets the zone back to New York.
- **Also:** a phone and a Mac browser with different zones flip the row on every fetch. AD-7 reads the current zones, so a closed missed day can reopen. `today_state` then goes blue, grey, blue, and the push copy and the Partner page disagree.
- **Proposed AD-3 amendment:** "The row stores `reported_at` (the device instant). An upsert applies only when its `reported_at` is newer than the stored one. A queue drain never writes the zone. The closure of day d uses each partner's zone as of their pick of d where one exists, and the stored zone otherwise."

### M-2. Late and back-dated picks have no bound, so AD-5's "hidden for good" is false

- **Unit A (epic 6):** follows AD-6 to the letter. It accepts any `picked_at` and any IANA zone whose local date equals `couple_days.day`.
- **Unit B (epic 7):** relies on AD-5's "a day only the partner picked stays hidden for good" to show such days as permanently "Hidden" on the history page.
- **Clash:** a crafted call with a back-dated `picked_at` (or the partner's zone) picks any past day, reveals it and raises the streak through the API. That is wider than the initiative's accepted "change the phone clock" risk. A zone ahead of the user's own lets them pick the partner's d+1 day, which already exists, before their own midnight.
- **Proposed AD-6 amendment:** "Reject a pick unless `couple_days.created_at − 5 min ≤ picked_at ≤ now() + 5 min` and `picked_at ≥ now() − 72 h` (or a stated grace past closure). AD-5 drops 'for good' in favour of 'until the viewer's own pick lands'."

### M-3. A pick on a stale screen at midnight is rejected and the user never knows

- **Unit A (epic 6, UI):** keeps showing day d's question across local midnight. AD-2 lets the device date only choose which cached day to show.
- **Unit B (epic 6, server):** at 00:01, rejects the pick because the AD-2 date (d+1) ≠ `couple_days.day` (d). This happens online and offline. AD-12 gives the queued case no failed-row handling (the Deferred list mentions marking rows failed only for the unlink case).
- **Proposed AD-12 amendment:** "The client refuses a pick locally when the device date ≠ the shown day's `day` and reloads the day. The server's rejection for a date mismatch has its own error code. A rejected queue row is marked failed and shown, never silently dropped."

### M-4. Assigning two dates at once can repeat a question, and "cycle" has no stored shape

- **Unit A:** the morning cron (AD-9) assigns the date d+1 of a partner ahead.
- **Unit B:** at the same moment, the other partner's day fetch assigns date d. Each runs `assign_couple_day` without seeing the other's uncommitted row, and both draw the same question within one cycle (against R4). `on conflict` protects only the same date. "Current cycle" also has no column: one author stores `couple_days.cycle`, another derives it by counting, and the two disagree once written questions join the pool mid-cycle.
- **Proposed AD-4 amendment:** "`assign_couple_day` takes `pg_advisory_xact_lock` on the pair before reading. `couple_days.cycle int not null` stores the cycle. The draw excludes `question_id`s with the current cycle, and a new cycle is `max(cycle) + 1`."

### M-5. Written questions have no named write path, and their target date drifts

- **Unit A (epic 6):** inserts written questions directly under a pair RLS policy, with a client-sent `target_day`.
- **Unit B (epic 6):** writes an RPC that computes "the writer's date + 1" (AD-4) when the question is sent. A prompt shown after day d's reveal but submitted after the writer's midnight targets d+2. Two concurrent writes for the same date both see "no pending question", so both are stored pending for that date, and AD-4's "takes the pending written question" has two to choose from.
- **Proposed AD-4 amendment:** "The only write path is `submit_written_question(day_id, this_text, that_text)`. The target is `couple_days.day + 1` of the revealed day. It takes the AD-4 pair lock, and a partial unique index on `(user_a, user_b, target_day) where status = 'pending'` holds R3's 'first sent is asked'."

### M-6. Pushes fire for days that are no longer anyone's today

- **Unit A (epic 8):** an AFTER INSERT on `daily_picks` pushes on every insert (AD-10). A late offline pick drained at 00:10 sends "Casey picked today's question" for yesterday.
- **Unit B (epic 8, AD-9):** morning is "due from 08:00 until local midnight". After a cron outage, or on the first run after deploy, the 8 AM push goes out at 23:00, with the evening one at the same tick.
- **Proposed AD-9/AD-10 amendment:** "A pick push is suppressed when its `day` is not the recipient's current date (AD-3). Morning is due 08:00–08:30 and evening 20:00–20:30 local, and a missed window sends nothing."

### M-7. `love_notes.couple_day_id` is not checked against the pair

- **Unit A (epic 9):** adds the column exactly as AD-14 specifies: a foreign key with `on delete set null`. The existing insert policy checks only the user columns (UNVERIFIED: I did not read the current form of the policy). Foreign key checks run without RLS.
- **Unit B (epic 8/9, push copy for a reply):** `send-push` reads the note with the service role and joins the day to quote the question. A crafted note can name another couple's `couple_day_id` and have that couple's written question (AD-4: "visible to their couple only") pushed into the sender's partner's notification. A queued reply drained after an unlink carries the old pair's day.
- **Proposed AD-14 amendment:** "The `love_notes` INSERT `with check` requires `couple_day_id is null or` the day belongs to `(from_user_id, to_user_id)`'s ordered pair. `send-push` and the display join resolve the day only within the note's pair. A queued reply that is refused is marked failed, as `note-queue` already does."

### M-8. The registry AD-11 names is typed for moods

- **Unit A (epic 6):** adds `daily_pick`. The only entry point is `subscribeMoodUpdates(callback(mood), onStatus, onPartnerLinked)`, and it binds `new_mood` and `partner_linked` when the channel is created (`src/api/moodSyncService.ts:642,659,827`). The author adds a fourth positional callback.
- **Unit B (epic 8):** adds `daily_nudge` as a separate `subscribeDailyEvents` that reuses the topic entry, whose channel `usePartnerLinkListener` has already bound. Epic 10 then removes `onMood`, and the positional signature shifts under both of them.
- **Proposed AD-11 amendment:** "Epic 6 turns the registry into `subscribePartnerEvents(handlers: Partial<Record<PartnerEvent, () => void>>)`. Every event in one `PartnerEvent` union (`partner_linked`, `daily_pick`, `daily_nudge`, and `new_mood` until epic 10) is bound when the channel is created and validated in `broadcastSchemas.ts`. Epic 10 removes a union member and nothing else."

### M-9. A queued pick against a later server re-read

- **Unit A (epic 6):** a partner's `daily_pick` triggers a re-read, which overwrites the day copy with a server snapshot that has no own pick (AD-12/AD-13: "reveal only from server"). The localCopy rules also allow writing "the user's own write (confirmed or queued)" (`src/services/localCopy.ts:37`), so a second author may put the queued pick into the copy and have it overwritten.
- **Unit B (epic 6):** with no own pick in the snapshot, the UI offers the pick again. The user taps the other option and a second queued row goes in. The first row lands first, and the idempotent repeat silently drops the choice the user saw last.
- **Proposed AD-12 amendment:** "Own pick shown = server pick ?? the queued row for `(user, day)`. The pick control is disabled while either exists. A queued pick is never written into a localCopy."

### M-10. The `+1` and milestone baseline is overwritten and has no initial value

- **Unit A (epic 7):** stores `lastCelebratedTotal` inside the streak copy, as AD-13 says. Every successful refresh overwrites the copy with the server snapshot, which does not have the field.
- **Unit B (epic 7, milestone screen):** compares the new total against an absent baseline. On a new device, after sign-out (which deletes copies), or after any refresh, the +1 and the 25-day screen replay from 0, or never play.
- **Proposed AD-13 amendment:** "The celebration baseline is its own localCopy kind (`daily-celebrated`) that only the animation writes. The first read with no baseline sets it to the current total without playing. The +1 and the milestone screen both compare against it."

### M-11. "The only write path" is not backed by grants

AD-6 removes UPDATE and DELETE but says nothing about INSERT. An epic 6 author gives `daily_picks` an "own row" INSERT policy, following the `couple_settings` pattern (`20260923020000_couple_settings.sql`). A direct PostgREST insert then skips the date check, the zone check and the H-3 ordering. **Proposed:** "`daily_picks`, `couple_days`, `daily_questions` (couple rows), `daily_nudges` and `user_time_zones` have no INSERT, UPDATE or DELETE grant to `authenticated`. Writes go only through their RPCs."

---

## Low

- **L-1. `daily_reminders` has no `day_id`.** `send-push` re-derives the pair and the question when the reminder is handled. After an unlink between enqueue and send, the copy is for the wrong pair. Add `day_id uuid references couple_days` (null when unlinked, and then no push).
- **L-2. One bad couple aborts the whole cron batch.** `enqueue_daily_reminders` runs every user in one statement, so one failing `assign_couple_day` (for example, an empty pool on a test stack) means no reminders for anyone. Wrap each user in an exception block that raises a warning, as `notify_push` does (`20261031020000…:36`).
- **L-3. Two kinds share one dedupe column.** `daily_partner_picked` and `daily_both_answered` both use `daily_pick_id`, while `releaseRequest(kind, sourceId)` maps a kind to a column. State the kind → column map in AD-10. Epics 8 and 10 each rewrite `push_requests_source_check`, so name the final column list once.
- **L-4. Tomorrow's written question is visible early.** The question is "visible to their couple only" (AD-4), so the partner can read tomorrow's question before it is asked. Decide whether a pending written question is hidden until assigned (product call).
- **L-5. Same/Different is computed in two places.** History's per-day marks and `couple_streak`'s counts both compute it. Derive the per-day mark inside the AD-16 projection from the same rule `couple_streak` uses, or have `couple_streak` sum the projection.
- **L-6. Nothing forbids publishing `daily_picks`.** AD-11 does not forbid adding `daily_picks` to `supabase_realtime`, and a `postgres_changes` path would bring back the AGENTS.md "SUBSCRIBED before system" race. State: "No daily table joins the publication." The local cron also assigns days for E2E pairs at real `now()` (AD-9, Deployment), which races tests that seed a written question for tomorrow. Either have E2E disable the job, or have `enqueue_daily_reminders` skip pairs that have no push device.

---

## Pairs checked and found safe under the current ADs

- **Same/total counts as a leak.** They are safe as long as "done" means both rows exist (AD-7). A day the caller has not picked is never done, so no count or `today_state` moves before their pick. CR-1's pgTAP file should pin this.
- **Broadcast payloads.** `{ day_id }` only, on a topic whose INSERT policy is partner-only (`20260912010000_private_couple_broadcast_policies.sql:60-66`).
- **`partner_linked` surviving epic 10.** `usePartnerLinkListener` (mounted in `App.tsx`) holds the registry entry, not a mood view. It is kept only if M-8's union change keeps `partner_linked` bound.
