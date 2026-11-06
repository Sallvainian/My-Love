---
type: review
lens: rubric
target: _bmad-output/initiative-my-love/architecture-daily-question/architecture-daily-question.md
ticket: _bmad-output/initiative-my-love/initiative-my-love.md
units: [epic-daily-question, epic-streak-and-partner-page, epic-daily-pushes-and-nudge, epic-reply-in-love-notes, epic-remove-moods-and-interactions]
date: '2026-11-05'
---

# Rubric review: Daily Question architecture spine

## Verdict

The spine picks the right divergence points: couple key, server-derived dates, one assignment function, one streak function, server-scheduled pushes, the trigger-only push path, the shared topic, the pick queue and local copies. Most of its brownfield claims check out against the code. It is not ready to bind epic 6 yet. Two rules cannot be built as written. The AD-5 policy raises 42P17, which I reproduced on the local stack. The AD-12 queue row has no owner, so on a shared device one partner's queued pick would be sent as the other partner's pick. One rule contradicts another: AD-5 says no local copy ever holds a partner's choice, and AD-13 says the copies do hold it. Function security, the `at` parameter on client RPCs, and the hosted pg_cron install are not settled. The fixes are small and stay inside the spine. Nothing needs re-slicing.

Tally: 1 critical, 3 high, 10 medium, 13 low.

## What was verified (brownfield spot-checks)

| Spine claim | Evidence | Result |
| --- | --- | --- |
| AD-1 ordered pair "as `couple_settings` does" | `supabase/migrations/20260923020000_couple_settings.sql`: `check (user_a < user_b)`, pair-only policies `to authenticated` through `get_my_partner_id()` | Holds |
| AD-10 `notify_push(kind)` posts `{kind, id}`; sender resolves with the service role | `20261031020000_push_moods_photos_interactions.sql:83-126`; `send-push/handler.ts:253-278` | Holds. But `POSTED_KINDS` (`handler.ts:146`) rejects unknown kinds, so the new kinds need a sender change in the same deploy (L13) |
| AD-10 one FK column per source, `unique` with token, source check rewritten | `20261031020000` lines 56-66; `20261031040000` rebuilds `push_requests_source_check` | Holds |
| AD-10 `push_preferences` one boolean per kind, default true | `20261031050000_push_preferences.sql:44-49` | Holds. The naming convention differs (L10) |
| "With no `push_sender_settings` row nothing is posted" | `notify_push` returns early when the URL or secret is null | Holds |
| AD-11 `mood-updates:<uid>` topic is allowed by the realtime policies | `20260912010000_private_couple_broadcast_policies.sql`: SELECT on own topic, INSERT on partner's topic, `love-notes:%` and `mood-updates:%` only | Holds |
| AD-11 `sendEphemeralBroadcast` and the refcounted registry | `src/api/ephemeralBroadcast.ts` (private, `httpSend`); `moodSyncService.ts:44-61, 642-668, 848` | Holds. The registry is mood-typed: events are bound only in `bindMoodChannel` and subscribers have only `onMood`/`onPartnerLinked` (L11) |
| AD-12 "Like `note-queue`, the queue survives sign-out" | `src/services/noteQueue.ts`: rows carry `userId`, `by-user` index, drained only for the signed-in account under `withSyncLock` | The precedent holds, but AD-12 leaves out the parts of it that matter (C1) |
| AD-13 only a successful read overwrites a copy | `src/services/localCopy.ts` header rules | Holds |
| AD-9 / C4 `reminderIdsToCancel` stays as it is | `src/services/dateReminders.ts:382-408` | Holds, because no daily push is scheduled on the phone |
| Conventions: FN-GRANT-008 pins the RPC set | `supabase/tests/database/18_function_execute_grants.sql:91-116` (exact list; its comment notes hosted grants `authenticated` EXECUTE by default) | Holds. See H3 for internal functions |
| Deployment: migrate, then functions, then site | `.github/workflows/deploy.yml`: `functions` needs `migrate`, `build` needs `functions` | Holds |
| Stack: Postgres 17.11.0.006, pg_cron 1.6.4, pg_net 0.20.4, CLI 2.122.0, React/supabase-js/Zustand/push/idb ranges | `docker ps` image tag; local `pg_available_extensions`; `.mise.toml`; `package.json` | Holds locally. On hosted (read-only `list_extensions`), pg_cron 1.6.4 is **available but not installed** and pg_net is **0.19.5** (M8) |
| AD-5 self-referencing SELECT policy is writable | Reproduced on the local DB in a rolled-back transaction: `infinite recursion detected in policy for relation "zz_picks"` | **Fails** (H1) |
| `formatDateKey` lives in `calendarHelpers.ts` | Used only by `calendarHelpers.ts` and `MoodHistoryCalendar.tsx` | Holds |

## Critical

### C1. AD-12's pick-queue row has no owner, so a shared device sends one partner's pick as the other's

AD-12 lists the row as `day_id, choice, picked_at, time_zone` and says `dailySlice` drains "the queue" oldest first, through AD-6, and that the queue survives sign-out. Take a phone the two partners share, which is the shared-device case AGENTS.md guards against throughout:

1. A picks offline and signs out.
2. B signs in and the drain runs.
3. `submit_daily_pick` checks only that the day belongs to the caller's pair. It does, because B is A's partner.
4. A's choice is stored as B's pick. The day reveals with a fabricated pick, and A's real pick is lost.

Nothing errors. `note-queue`, which AD-12 cites as its model, avoids this only because each row carries `userId` and the drain lists only `listQueuedNotes(signedInUserId)` under `withSyncLock(NOTE_QUEUE_LOCK)` (`src/services/noteQueue.ts` header and `notesSlice.ts:1918`).

**Fix:** add `userId` (the picker, captured at pick time) to the row, plus a `by-user` index. Drain only the signed-in account's rows, under a sync lock like `NOTE_QUEUE_LOCK`. State that a row is never sent under a session whose `auth.uid()` differs from its `userId`.

## High

### H1. AD-5's policy cannot be written as stated (42P17), and the RPCs could apply a second gate

The rule admits a partner's row "only when the caller's own pick for the same `day_id` exists". A `daily_picks` SELECT policy that queries `daily_picks` recurses. I reproduced this locally, in a rolled-back transaction under `set local role authenticated`: `ERROR: infinite recursion detected in policy for relation "zz_picks"`. AGENTS.md records the same trap for `public.users`.

The implementer will be forced into a SECURITY DEFINER helper. Meanwhile `submit_daily_pick` and any day or history RPC that returns the partner's pick will probably run as definer and bypass RLS. Each could then re-implement the gate its own way. That is exactly the divergence AD-5 exists to prevent.

**Fix:**
- Name one `security definer stable set search_path = ''` helper, for example `public.i_picked(p_day_id uuid) returns boolean`. It needs EXECUTE for `authenticated`, because policies run as the invoker, so it joins FN-GRANT-008 the way `get_my_partner_id` does.
- The policy becomes `user_id = auth.uid() or (user_id = get_my_partner_id() and (select public.i_picked(day_id)))`.
- Any definer function that returns a partner's `choice` must gate it through the same helper.
- Pin it with a pgTAP test that reads as the second partner before and after their own pick.

### H2. AD-5 and AD-13 contradict each other on local copies

AD-5 says: "No broadcast payload, push payload or local copy **ever** carries a partner's `choice`." AD-13 says the opposite in practice:

- It caches the day snapshot. The State row lists "revealed pick", and AD-6 returns the partner's pick once admitted.
- It caches the past-days history, and R11's Same/Different list cannot be drawn offline without both choices.

Epic 6 (reveal offline) and epic 7 (history offline) will each have to break one of the two rules.

**Fix:** scope AD-5's ban to "before the reader's own pick exists on the server". Say that the day and history copies hold a partner's choice only when it came from a server response that AD-5 admitted. Keep the absolute ban for broadcast and push payloads.

### H3. Function security, pair guards and grants are unspecified for the new functions

`couple_streak(user_a, user_b, at)` and `assign_couple_day(user_a, user_b, day)` take arbitrary pair arguments. The spine says the client calls `couple_streak` and that the day fetch triggers assignment, but it never says:

- whether each function is SECURITY DEFINER or INVOKER;
- whether it checks that the caller is one side of the pair passed in;
- which functions are client RPCs and which are internal (`assign_couple_day`, `enqueue_daily_reminders`, the AD-5 helper).

A definer `couple_streak` callable with any two ids leaks another couple's streak and Same counts. A callable `assign_couple_day` lets a user create days for other couples.

The Conventions row covers only "new RPCs". But FN-GRANT-008's own comment records that hosted's default ACL grants `authenticated` EXECUTE on every new function. So an internal function that isn't explicitly revoked is reachable at `/rest/v1/rpc/<name>` on hosted, while the local test stays green (memory: Supabase local vs hosted function ACLs).

`user_time_zones` has no stated RLS. An invoker `couple_streak` would need the partner's zone, and a definer one would not. The two epics that read it could choose differently.

**Fix:** add an AD, or extend the Conventions row, with a table of each new function: name, client-callable or internal, definer or invoker, pair guard.

- Client RPCs derive the pair from `auth.uid()` and `get_my_partner_id()` and take no user-id arguments. For example, use `couple_streak(at)` publicly over an internal `_couple_streak(a, b, at)`.
- Internal functions `revoke execute ... from public, anon, authenticated`.
- State `user_time_zones` RLS: own row read and write; the partner reads only through definer functions.

## Medium

### M1. AD-8's `at` parameter on client-callable RPCs lets the client fake "now"

AD-8 makes every time-dependent function take `at timestamptz default now()`. On the day fetch, which assigns days, a client can pass any instant. That has three effects:

- It creates `couple_days` rows for future dates, peeking at and consuming the pool.
- Those rows block AD-4's written-question target, because the date "already has an assigned question".
- It creates rows for past dates, which AD-6 will then accept late picks for. That rescues streaks well beyond the trusted-clock assumption, which covers `picked_at`, not server time.

**Fix:** only internal or test-only signatures take `at`. Client RPCs read `now()` themselves and call the internal function. pgTAP calls the internal one with fixed instants.

### M2. `couple_streak`'s `today_state` is "for the caller's own date", but `send-push` has no caller

AD-7 says both the client and `send-push` call the function. Under the service role `auth.uid()` is null, so "the caller's own date" is undefined for push copy. Epic 8 will invent its own reading.

**Fix:** add a `viewer uuid` argument to the internal function, which the public wrapper fills from `auth.uid()`. `today_state` and "today" are computed for that viewer's zone.

### M3. Whether the partner's pick *existence* is visible is undecided

R14's partner-picked push and AD-11's `daily_pick {day_id}` broadcast both tell the reader that the partner picked, before the reader has picked. AD-5's "state only" suggests that is allowed. But:

- RLS hides the row, so a plain read cannot show "Jessie already picked". Epic 6 would need a definer field in the day snapshot, and nothing says whether one exists.
- The initiative's and epic 6's Done-when says "no trace of the first pick". Read literally, that rules out existence too, so a test written from it would fail on the push.

**Fix:** state that "the pick" in R2/C1 means the `choice`, and that existence is deliberately exposed. Name the day-snapshot field, for example `partner_picked boolean`, and the definer path that computes it. Or decide that existence stays hidden on screen and only the push reveals it. Ask the owner if this is not already settled by the mock-up's Waiting screen.

### M4. Resolving a `daily_picks` insert into partner-picked or both-answered races

`send-push` reads after `pg_net` posts asynchronously, after commit. If both partners pick within a second or two, both calls see two picks, both resolve to `daily_both_answered`, and no partner-picked push is sent. Or the first picker gets both kinds. The rule also never says who receives both-answered. Only the sequence diagram does: the first picker.

**Fix:** resolve by insert order. A pick is "second" only if the other pick's `created_at`, with ties broken by `id`, precedes it, whatever exists at read time. The first pick sends partner-picked to the partner. The second sends both-answered to the first picker only.

### M5. AD-4 anchors a written question on the writer's date, not the revealed day

"Write tomorrow's question?" follows a day's reveal. Take B at 23:30 on day D, which is 00:30 on D+1 for A, an hour ahead:

1. B writes, targeting D+1.
2. A sees D's reveal after A's midnight and writes. "Writer's date + 1" targets D+2.
3. Both questions are asked on consecutive days.

R3 says that when both write, the second joins the pool. Concurrent writes for the same date also need a constraint, not a read-then-insert.

**Fix:** target `revealed couple_days.day + 1`. Enforce one pending written question per (pair, target date) with a partial unique index, and a conflicting insert lands in the pool (target null).

### M6. Epic 10's column drops must follow the `dates` precedent

The map's R15/R16 row says "AD-10 (columns dropped)". `20261104000000_drop_push_preferences_dates.sql` records why `dates` could not be dropped at once: "installed shells still selected and upserted it, and a select that names a missing column fails the whole read". Epic 8 adds five columns to the same Settings read that epic 10 removes `moods` and `pokes_and_kisses` from.

**Fix:** add a rule.

1. Stop the web code reading a column.
2. Ship it and let the live update reach the shells.
3. Then drop the column, along with the `push_requests` `mood_id`/`interaction_id` columns and the source-check rebuild.

Epic 10 owns the order. Epics 8 and 9 must not select columns that epic 10 will drop.

### M7. The shared day and history read contract is unnamed

Epics 6, 7, 8 and 9 all consume "the day RPC" and "the past-days history". Only `submit_daily_pick` is named. The day fetch's name, its `{ status: 'ok' | 'unlinked' }` snapshot fields (question, own pick, partner pick when admitted, partner-picked state per M3, `day_id`, date), and whether history is an RPC or a direct RLS select are left open. Epic 9 opens a reveal from `couple_day_id`, which needs a by-id read nobody owns.

**Fix:** name these three, the day fetch, a by-id day read and the history read, with their result shapes, in an AD or the Structural Seed.

### M8. Hosted pg_cron isn't installed; the Stack versions are local-only

I checked the hosted project read-only. `pg_cron` 1.6.4 is available but `installed_version` is null, and `pg_net` is 0.19.5, not 0.20.4. The spine says "Deployment does not change". In fact the first epic 8 migration must install the extension on hosted. Supabase's documented form is `create extension pg_cron with schema pg_catalog; grant usage on schema cron to postgres; …`. The schedule must also be idempotent, using a named `cron.schedule`, so that `db reset` and re-applied migrations converge.

There is also no stated failure envelope. If a `pg_net` post fails, the warning is swallowed and the unique `daily_reminders` row then blocks every retry, so that push is lost for the day.

**Fix:** correct the Stack rows to "hosted 1.6.4 available, installed by epic 8's migration" and "pg_net local 0.20.4, hosted 0.19.5". Add the install-and-schedule rule. Under Deferred or Operations, record that a failed reminder post is not retried, as an accepted risk with `cron.job_run_details` and `net._http_response` as the signal.

### M9. `lastCelebratedTotal` sits inside a server-filled copy

AD-13 puts a device-side `lastCelebratedTotal` inside the streak local copy. Every successful refresh replaces that copy with server data, and `writeLocalCopy` replaces whole values. So the field is either clobbered, replaying the +1 animation every refresh, or each refresher must merge, which nothing says.

Sign-out deletes every copy. On the next sign-in `lastCelebratedTotal` is missing, the total is higher, and the +1 animation and possibly the milestone screen replay. Milestone "already shown" state has no home at all.

**Fix:** put celebration state in its own local-copy kind (`streak-celebrated: { total, milestone }`), written only by the animation. When it is missing, initialize it to the current snapshot without playing.

### M10. Coach questions have no stated read policy

AD-1's pair-only RLS pattern would hide coach rows, where the pair is null. Love Notes needs to read a question through `couple_day_id` (AD-14), and so does the history.

**Fix:** state the `daily_questions` SELECT policy: coach rows (`user_a is null`) are readable by `authenticated`, and couple rows by the pair. Or state that question text is served only through definer reads and the table has no SELECT grant.

## Low

- **L1. Stale zone upsert.** AD-3 has every pick upsert `user_time_zones`, so a queued pick drained after travel writes its old zone over the new one. **Fix:** upsert only when the reported instant is newer than `updated_at`, or don't let picks upsert at all.
- **L2. Repeats within a cycle.** Two `assign_couple_day` calls for *different* dates, from partners on either side of midnight, can draw the same question, breaking R4. **Fix:** `pg_advisory_xact_lock` on the pair inside the function.
- **L3. Late "8 AM" pushes.** The morning push is due "from 08:00 until local midnight". A user whose first zone report comes at 22:00, or a cron outage, gets an "8 AM" push at night. **Fix:** bound the window, for example 08:00 to 12:00, or accept and say so.
- **L4. Trigger kinds.** A trigger's argument is constant, so one `daily_reminders` trigger cannot post `daily_question` or `daily_reminder` per row. **Fix:** say the trigger posts one kind (`daily_reminder_row`) that `send-push` resolves from `kind`, or use two triggers with `WHEN`.
- **L5. `/mood` deferral spans two epics.** "`/mood` URL redirect and the old view's removal (epics 6 and 10)" is deferred as "local", yet it spans two epics. `viewForPush` (`src/services/pushNotifications.ts`) also routes `mood` pushes. **Fix:** give epic 6 the redirect and the new kinds' tap routing, and give epic 10 the removal.
- **L6. Cron on test stacks.** The cron job runs on CI and local stacks and, at each pool couple's 08:00, calls AD-4 for them. That can create `couple_days` rows in the middle of an E2E run and make day-sensitive specs depend on the time of day. **Fix:** E2E sets up its own days, or the job is unscheduled on test stacks.
- **L7. Re-linking the same partner.** It resumes the same pair, so every unlinked day counts as missed: the run resets and the total holds. **Fix:** state it as intended, or count missed days only while linked.
- **L8. "Hidden for good" isn't final.** AD-5 says a day only the partner picked stays hidden for good, but AD-6 accepts a late pick for any day with a row, at any time, under the trusted clock. A partner-picked push for a late pick also announces a closed day. **Fix:** reword it as "until your own pick lands", and say whether `send-push` skips pick pushes for closed days.
- **L9. Unlinked users.** `enqueue_daily_reminders` doesn't say it skips them. **Fix:** due only for users with `partner_id` set.
- **L10. Preference naming.** "Each `push_preferences` column has the same name as its kind" departs from the existing convention: singular kinds (`love_note`), plural columns (`love_notes`), and the `PREFERENCE_FOR_KIND` map (`handler.ts:127-143`). **Fix:** follow the existing map, or note the break on purpose.
- **L11. Registry extension point.** AD-11 should name it. The daily events go into `bindMoodChannel` as new `.on('broadcast', …)` handlers, with new optional callbacks on `MoodSubscriber`, checked against the entry's partner snapshot. Never a second `supabase.channel()` on the same topic.
- **L12. Day rollover while the screen is open.** After local midnight AD-6 rejects a pick made on the stale day. Rejected queue rows have no rule outside the unlink case under Deferred. **Fix:** the client re-fetches at local midnight, and a rejected queued pick is marked failed, as `note-queue` does.
- **L13. Deploy window.** Migrations create the new triggers before the `functions` job deploys `send-push`, and the old `POSTED_KINDS` answers 400. Pushes in that window, a few minutes, are lost. **Fix:** accept and say so, or have epic 8 ship the sender kinds one deploy before the triggers.

## Coverage

Every R1 to R20 and C1 to C4 appears in the Capability map with a governing AD.

- **Thin:** R15 and R16 are covered only as "epic 10 migrations, client deletion", which is acceptable since removal is local to epic 10, plus M6's ordering. R3's write path for a written question, whether an RPC or a direct insert, is not named, but it is local to epic 6.
- **Operational envelope:**
  - Deployment and environments are decided, but corrected by M8 and L6.
  - Infra and provider: pg_cron and pg_net on hosted need M8.
  - Operations: cron observability is deferred and acceptable. The lost-push failure mode is unstated (M8).

## Deferred list

Five entries can't cause divergence: nudge rate limit, push copy, renaming the topic, pool authoring, and `formatDateKey`. Each is owned by one epic or happens after the slice.

Three entries need work:
- "`/mood` redirect" spans epics 6 and 10 (L5).
- "Unlink mid-day" also affects epic 8's reminders (L9).
- "Observability of the cron job" should carry the not-retried failure mode (M8).
