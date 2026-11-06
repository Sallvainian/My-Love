# Reconcile review: Daily Question spine against its inputs

Spine: `architecture-daily-question.md` (227 lines, read in full).
Inputs read in full: `initiative-my-love.md` (R1–R20, C1–C4, Done when, Boundaries, Notes), the brainstorm intent, and the five epic tickets (`epic-daily-question`, `epic-streak-and-partner-page`, `epic-daily-pushes-and-nudge`, `epic-reply-in-love-notes`, `epic-remove-moods-and-interactions`).
Line numbers are from the files as read on 2026-11-05.

## Verdict

The spine covers every requirement and constraint, and each epic's architecture question (day settlement, 8 AM/8 PM scheduling, question and pick storage, the reply's stored question) gets an answer. One rule contradicts R2 as written: the local-copy ban drops R2's "before your own exists". Several gaps would let epics 6, 7 and 8 diverge: what counts as a "trace" of a pick, written questions in the hour when the partners are on different dates, offline days with no cached question, late-pick pushes, and the +1 animation's state.

## Findings

### F1 (High): AD-5 bans the partner's choice from every local copy, which R2 allows after your own pick

- Input, R2 (initiative:24): "a partner's pick stays hidden from the other until the other has picked, then both picks show together (the reveal); met when nothing the app shows or receives carries the partner's pick **before your own exists**."
- Input, R11 (initiative:33): "each past day is marked Same or Different with a running count".
- Spine, AD-5 (spine:76): "No broadcast payload, push payload or local copy **ever** carries a partner's `choice`; they carry `day_id` and state only."
- Spine, AD-6 (spine:82): "It returns the day snapshot, including the partner's pick when AD-5 admits it."
- Spine, AD-13 (spine:124): "the day snapshot, the streak snapshot … and the past-days history are `localCopy` kinds."

AD-5 leaves out R2's qualifier for local copies. Read literally, the cached day snapshot cannot hold the revealed pick, and the past-days copy cannot hold the partner's choices that Same/Different needs. AD-6 and AD-13 assume the opposite. Epic 6 (reveal) and epic 7 (past questions) can each pick a different reading, so one shows the reveal and the history offline and the other does not. The ban fits broadcasts and pushes. For local copies it should read "before the reader's own pick exists on the server".

### F2 (Medium): "No trace of the first pick" is not defined, and neither is the day read's security mode

- Input, initiative Done when (initiative:53): "a request made as the partner before their own pick gets **no trace** of the first pick."
- Input, epic 6 Done when (epic-daily-question:25): "a request made as the second partner before their pick gets no trace of the first."
- Input, C1 (initiative:46): "the server enforces the hidden pick, withholding the partner's pick row until the reader's own exists (RLS)".
- Input, brainstorm push copy (brainstorm:55): "Jessie answered - answer to see it and keep your 14-day streak".
- Spine, AD-5 (spine:76): "they carry `day_id` and state only."
- Spine, AD-13 (spine:124): "The day RPC answers `{ status: 'ok', … } | { status: 'unlinked' }`" (the RPC has no name and its fields are not given).

Epic 8's partner-picked push, and any "Jessie answered" state on the Today screen, tell the partner that a pick exists. A strict reading of "no trace" in epic 6's test forbids that. The spine permits "state" but does not say whether the day snapshot tells a partner who has not picked that the other partner has. RLS hides the row, so that flag needs a `SECURITY DEFINER` read. The spine also does not say whether the day RPC, the past-days read and `couple_streak` run as invoker (gated by the AD-5 policy) or as definer (which bypasses the policy C1 names). The spine should state three things:
- "trace" means the row and the choice, and the fact of a pick is allowed;
- whether the snapshot carries `partner_picked`;
- every definer reader applies AD-5's gate itself.

### F3 (Medium): A written question can miss "the next day" when the partners are on different dates, and "writer's date" is undefined

- Input, R3 (initiative:25): "yes lets them type its two options (This / That) and it **becomes the couple's next question** … met when a written question is asked of both the next day".
- Input, R20 (initiative:42): partners can be "an hour apart".
- Input, epic 6 (epic-daily-question:17): "**After the reveal** each is asked to write tomorrow's question" (R3 says "each day each partner is asked").
- Spine, AD-4 (spine:70): "A written question targets the writer's date + 1. If that date already has an assigned or pending question, the new one joins the couple's pool instead [ASSUMPTION: a partner an hour ahead may already have opened that date]."

Between the ahead partner's midnight and the behind partner's midnight, anything the behind partner writes goes to the pool and is not asked next. R3's met-when fails in exactly the R20 case the owner raised. The [ASSUMPTION] tag records the trade-off but does not settle whether it is acceptable. Targeting the next date with no question assigned would keep R3. Separately, "writer's date" can mean the date being answered (`couple_days.day`) or the server-derived current date (AD-2). The two differ when a reveal arrives after midnight, which R17's late picks make possible. The spine also does not settle when the prompt is shown: every day (initiative) or after the reveal (epic 6).

### F4 (Medium): An offline pick needs a cached day, and nothing covers a pick the date check rejects

- Input, R17 (initiative:39): "a pick made offline is kept on the device with the time it was made and sent the moment a connection returns; it counts for the date it was made".
- Spine, AD-12 (spine:118): "The row holds `day_id`, `choice`, `picked_at` and `time_zone` fixed when the pick is made."
- Spine, AD-6 (spine:82): "checks … that the AD-2 date equals `couple_days.day`."
- Spine, AD-2 (spine:58): "The client uses its own device date only to choose which cached day to show."
- Spine, Deferred (spine:225): only "Pick-queue rows whose day no longer belongs to the pair after an unlink".

Only the server assigns a day (AD-4), so a device that has been offline since before its midnight has no `day_id` for today. The spine does not say what Daily shows then: nothing, or the stale cached day. If the stale day stays pickable, a pick at 12:05 AM is queued against yesterday's `day_id`, and AD-6 rejects it for good. The Deferred list covers rejected rows only in the unlink case. Epic 6 needs one rule for both cases:
- a cached day whose date is not the device date cannot be picked;
- a date-rejected queue row is marked failed, as `note-queue` marks rejected rows.

### F5 (Medium-Low): A late offline pick fires a partner-picked push the recipient may be unable to act on

- Input, R14 (initiative:36): pushes "each timed on the recipient's own clock".
- Input, epic 8 Outcome (epic-daily-pushes-and-nudge:21): "called back to the day's question **at the right moment** on their own clock."
- Input, push copy (brainstorm:55): "answer to see it and keep your 14-day streak".
- Spine, AD-10 (spine:106): "AFTER INSERT triggers that call `notify_push(kind)`: on `daily_picks` (resolved to `daily_partner_picked` or `daily_both_answered`)".

Under R17 a pick can land after midnight, or days later. AD-10 then sends "Jessie answered, answer to see it" for a date the recipient can no longer pick: AD-6 rejects any pick whose local date is not that day. The spine does not say whether the trigger skips or changes the push when the day is closed for the recipient. Epic 8's copy and epic 6's late-pick path will each assume something different.

### F6 (Low-Medium): The +1 animation's device state is clobbered by the copy that holds it, and its trigger is ambiguous

- Input, R8 (initiative:30): "at once for whoever picks second and on the next open for whoever picked first."
- Spine, AD-13 (spine:124): "the streak snapshot (with a device-side `lastCelebratedTotal`) … The +1 animation (R8) plays when the snapshot's held total is higher than `lastCelebratedTotal`, and is never driven by a realtime event."
- Spine, AD-11 (spine:112): "A receiver treats an event only as 're-read the day'".
- Code: `src/services/localCopy.ts:15` says `writeLocalCopy` will "replace the saved value". `deleteAccountCopies` runs at sign-out (`localCopy.ts:21`).

A device-side field inside a local-copy kind is overwritten by every successful refresh unless the write merges it, and sign-out deletes it. The spine gives no merge rule and no first value: on a fresh device or after re-sign-in, the animation either replays the whole total or must be seeded from it. Whether a `daily_pick` broadcast also refreshes the streak decides whether the first picker sees +1 at once or "on the next open". R9's milestone screen depends on the same state.

### F7 (Low): The spine does not say which count is "the streak" in push copy and on Daily

- Input, push copy (brainstorm:55): "keep your 14-day streak".
- Input, epic 8 (epic-daily-pushes-and-nudge:17): "The pushes quote epic 7's streak count".
- Spine, AD-7 (spine:88): returns "the held total, the current run …"; Deferred (spine:220): "Exact push copy … owned by `send-push/payload.ts`."

AD-7 stops the count from being computed differently, but not from two epics choosing different fields. "Keep your streak" only makes sense for the current run, because the held total never drops (R5). Epic 8 might quote the held total while Daily's flame shows the run, or the other way round.

### F8 (Low): The map attributes removal rules to AD-10, but AD-10 contains none

- Input, R19 (initiative:41): "the mood, poke and kiss switches are gone."
- Input, epic 10 Done when (epic-remove-moods-and-interactions:25–26): "no … push kind or Settings switch"; "no mood or interaction rows or tables … hosted-only objects included."
- Spine, map (spine:210): "R15, R16 removal | epic 10 migrations | AD-11 (topic kept), AD-10 (**columns dropped**)".
- Spine, AD-10 (spine:106) only adds columns and rewrites the source check for the new sources.

Nothing in the spine says that epic 10 drops the mood and interaction FK columns from `push_requests`, removes their source-check entries, and drops the mood, poke and kiss `push_preferences` columns. Epics 8 and 10 each rewrite the same source check, so the order and the expected final shape should be in the rule, not only in a map cell.

### F9 (Low): The spine does not restate the "must not change" boundary for Home, and its names sit next to the existing daily-message code

- Input, initiative Boundaries (initiative:62): "Must not change: Home's bundled daily message, which the Daily tab does not replace." Repeated in epic 6 (epic-daily-question:34).
- Spine, layer table (spine:23–25): `src/components/Daily/`, `src/components/PartnerView/`, `dailySlice.ts`, `dailyApi.ts`; Conventions (spine:139): `ViewType 'daily'`.
- Code: `src/components/DailyMessage/` and `messagesSlice.getDailyMessage` (`src/stores/slices/messagesSlice.ts:466`) are Home's bundled message. `src/components/PartnerView/` does not exist; the Partner page today is `src/components/PartnerMoodView/`.

The spine never mentions the boundary. Its `daily*` names sit beside the bundled-message code, which invites edits to the wrong module. Its Partner path does not say whether epic 7 rebuilds the page in place or in a new folder, which affects what epic 10 deletes.

## Checked and consistent (not flagged)

- R1, R4: AD-4's single assigner and its no-repeat cycle; AD-6's own-pick write.
- R5, R6, R7, R9, R11 counts: AD-7, including the hold-on-miss rule, the run reset, the colour order, and `floor(held / 25)`.
- R10 and epic 9's offline reply: AD-14, which also covers queued notes and the reply opening its reveal.
- R12: the View convention, which follows the five registration places.
- R13 and C2: nudge row → `send-push`, plus a Broadcast on the existing topic.
- R14's evening condition: the spine reads it literally and flags that as an assumption.
- R15, R16, C3: AD-11 keeps the topic, the registry and `partner_linked`.
- R18: AD-13's `unlinked` status, with a failed read throwing.
- R19's added switches: AD-10.
- R20: AD-2, AD-3 and AD-7's later-midnight closure.
- C4: AD-9; the phone schedules nothing.
- Boundaries: no guess column, no freeze, no sixth dock slot.
- Notes assumptions: written questions are couple-only (AD-4), the phone clock is trusted (AD-2), and pushes reach the iOS shell only, with no native code (spine:195).
