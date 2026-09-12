---
title: 'Authorize and validate couple broadcasts'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: '81a54a22d4185aa9e767136b868a3720465dae50'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      The retry's re-subscribe cannot rejoin an errored channel at all, because the SDK gates
      the whole of subscribe() on the channel already being closed.
    evidence: |-
      node_modules/@supabase/realtime-js/dist/module/RealtimeChannel.js:134 wraps the entire join
      body in `if (this.channelAdapter.isClosed())` and otherwise returns `this`. After a
      CHANNEL_ERROR the state is `errored`, not closed, so the retry at useRealtimeMessages.ts is a
      no-op however many times it fires. Pre-existing and untouched by this story: the baseline
      retry had the identical shape, and passing `handleStatus` (patched this pass) fixes only the
      reporting half. Settle by removing and reopening the channel on retry rather than
      re-subscribing the same object, with a test that drives a real CHANNEL_ERROR.
    location: >-
      src/hooks/useRealtimeMessages.ts:190-196
    severity: medium
  - summary: >-
      getPartnerId() returning null for a transient error is indistinguishable from "unlinked",
      and would drop every note and mood for the life of the channel.
    evidence: |-
      src/api/supabaseClient.ts:128-136 returns null on any PostgREST error, and both receivers
      treat a null snapshot as "trust nothing". A snapshot taken at join would then stay null until
      the next SUBSCRIBED. I could not show the program reaches this: the users query and the
      Realtime socket address the same host, so a network failure denies the join too and the retry
      path runs. Settle by reproducing a PostgREST-only failure (for example a 500 injected at
      /rest/v1/users) while the websocket stays healthy, and observing whether notes stop arriving.
    location: >-
      src/api/supabaseClient.ts:128-136
    severity: medium (unverified)
  - summary: >-
      The Array.isArray guard was adopted at the three broadcast-facing mood sites and not at the
      four siblings that share the identical idiom.
    evidence: |-
      src/stores/slices/moodSlice.ts:384, src/components/MoodHistory/MoodDetailModal.tsx:91,
      src/components/MoodHistory/CalendarDay.tsx:72 and src/components/MoodTracker/MoodTracker.tsx:170
      still use `x && x.length > 0` ahead of an unconditional MOOD_CONFIG[allMoods[0]] deref. No
      broadcast reaches them: moodSlice's transform consumes moodApi.fetchByUser output, already
      parsed by MoodArraySchema, and the MoodHistory pair read the offline-first IndexedDB path.
      Pre-existing hardening rather than a hole this story opened. Settle by deciding whether the
      IndexedDB read path needs the same guard and covering it in the shape of
      src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx.
    location: >-
      src/stores/slices/moodSlice.ts:384
    severity: low
  - summary: >-
      No E2E drives the app's own Realtime clients in a browser against the new policies; live
      evidence stops at the raw SDK.
    evidence: |-
      tests/api/couple-broadcast-authorization.spec.ts builds its own createClient identities and
      calls join()/httpSend() directly; it imports neither useRealtimeMessages, moodSyncService,
      sendEphemeralBroadcast nor the store, and tests/e2e/notes/love-notes.spec.ts and
      tests/e2e/partner/partner-mood.spec.ts mention neither realtime nor broadcast. The policy
      predicates themselves are measured because the spec builds the same topic strings and the same
      session-based clients, but the composition shipped to users is covered only by mocked unit
      tests. Pre-existing for both features. Settle with a two-context E2E in the shape of the
      togetherMode scripture specs.
    location: >-
      tests/e2e/notes/love-notes.spec.ts
    severity: low
  - summary: >-
      An effect re-run that lands while the previous run's un-awaited removeChannel is still
      deregistering is handed the dying channel.
    evidence: |-
      useRealtimeMessages' cleanup calls supabase.removeChannel without awaiting it, and
      src/api/realtimeSocket.ts documents that the registry entry is dropped later still, from the
      _onClose hook, so supabase.channel(topic) in the replacement run can return the leaving
      object whose subscribe() is a silent no-op. Pre-existing: the baseline cleanup had the same
      shape, and the new `cancelled` guard covers only the subscribe-after-unmount half. Settle by
      awaiting the leave the way moodSyncService's closingMoodChannels registry does.
    location: >-
      src/hooks/useRealtimeMessages.ts:215-232
    severity: low
  - summary: >-
      getSignedInUserId() returning null for a transient getSession error is read as "the account
      changed", which mutes the mood channel until a fresh subscriber re-arms it.
    evidence: |-
      src/api/supabaseClient.ts:81-92 returns null on any getSession error or throw, and
      refreshChannelIdentity (src/api/moodSyncService.ts:455-460) treats `null !== entry.ownerUserId`
      as an account change and nulls the partner snapshot. Only the next SUBSCRIBED or a new
      subscriber's `entry.partnerId = partnerIdAtJoin` restores it, and an already-joined channel
      emits no further SUBSCRIBED. I could not show the program reaches this: refreshChannelIdentity
      runs only from the SUBSCRIBED arm, i.e. moments after the same session authorized the private
      join, so a session read that fails while that join succeeds is not demonstrated. Same shape as
      the getPartnerId ambiguity already recorded. Settle by injecting a getSession failure while the
      websocket stays healthy and observing whether partner moods stop arriving.
    location: >-
      src/api/supabaseClient.ts:81-92
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** Love notes and moods ride **public** Realtime topics that anyone holding the project's anon key can join and publish to (CAP-2/CAP-3, F2/F3). `src/hooks/useRealtimeMessages.ts:68` opens `` .channel(`love-notes:${userId}`) `` and `src/api/moodSyncService.ts:504` opens `.channel(topic, { config: { broadcast: { self: false } } })` — neither passes `private: true`, no policy exists on `realtime.messages` for either prefix, and both topics are just a user UUID. Receivers then trust the wire completely: `useRealtimeMessages.ts:42` destructures `payload.payload.message` straight into `addNote`, `moodSyncService.ts:513-521` hand-builds a `SupabaseMoodRecord` with no parse, `PartnerMoodView.tsx:182-190` raises a toast for any broadcast without checking the sender, and `LoveNoteMessage.tsx:126-128` renders `message.imagePreviewUrl` directly as an `<img src>`, so a forged preview URL causes a request to an attacker host.

**Approach:** Add one forward migration with directional RLS on `realtime.messages` — receive only on your own topic, send only to your current partner's topic, via `public.get_my_partner_id()`. Make both subscribers and `sendEphemeralBroadcast()` open `private: true` channels with `supabase.realtime.setAuth()` before subscribe. Validate every incoming payload at the service boundary before it reaches state: zod-parse the shape, require the directional ids to match the signed-in user and the partner snapshot taken at join, and drop client-only fields (`imagePreviewUrl` above all) from the wire. Replace the three unsafe mood-array render checks with `Array.isArray`.

## Boundaries & Constraints

**Always:** Keep `sendEphemeralBroadcast()`'s per-topic serialization, its claim-before-socket-wait ordering (`ephemeralBroadcast.ts:69` before `:74`) and its awaited `removeChannel` in the `finally`. Keep `moodSyncService`'s refcounted registry and `closingMoodChannels` leave-wait; one consumer must never tear down another's subscription. Compare the topic segment as **text** (`split_part(topic, ':', 2) = (select auth.uid())::text`), never `::uuid` — a non-UUID segment would raise 22P02 instead of denying. Use plain `=` against `public.get_my_partner_id()` so an unpartnered caller (NULL) is denied, per `20260818000002_create_events_table.sql:60`. Policies are `TO authenticated` so anon gets an RLS denial, not a function permission error (`20260818000002_create_events_table.sql:55-58`). Snapshot the partner id at join and refresh it on `SUBSCRIBED`; do not claim per-message relationship revalidation. Capture the signed-in user id at subscribe and drop broadcasts that arrive after it changes.

**Never:** Call `supabase.channel()` outside `ephemeralBroadcast`/`moodSyncService`/the existing hook. Add a public fallback when a private join is denied. Widen the receive policy to partner topics — a sender needs INSERT, not SELECT. Accept a wire `imagePreviewUrl`/`imageBlob`/`tempId`/`sending`/`error`/`imageUploading`. Touch `realtime`-owned tables or functions beyond RLS on `realtime.messages`. Change `interactionService.ts:251`'s channel, the scripture hooks, or F4/F5/F13 behaviour. Flip the hosted "Allow public access to channels" setting in this story (see Design Notes). Hand-edit `src/types/database.types.ts`. Run `npm run deploy`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Partner delivers a note | B (A's partner) sends on private `love-notes:<A>`; A subscribed private | A's channel joins `SUBSCRIBED`, `addNote` called once with the parsed note | No error expected |
| Outsider joins victim topic | Authenticated non-partner joins `love-notes:<A>` / `mood-updates:<A>` with `private: true` | Never reaches `SUBSCRIBED`; `CHANNEL_ERROR` | Status surfaced to caller, no state change |
| Anon joins victim topic | Unauthenticated client, `private: true` | Never reaches `SUBSCRIBED` | Denied at join |
| Outsider sends to victim topic | Non-partner opens private `love-notes:<A>` and `send()`s | Join or send rejected; A's `addNote` never called | Sender's promise rejects |
| Forged sender id | Wire note with `from_user_id` ≠ partner snapshot, `to_user_id` = A | Dropped before dedupe; `addNote` not called | Debug log only |
| Forged recipient id | Wire note with `to_user_id` ≠ signed-in user | Dropped before dedupe | Debug log only |
| Attacker preview URL | Wire note carrying `imagePreviewUrl: 'https://attacker.example/x.png'` | Field absent from the stored note; no image request to that host | Silently stripped |
| Malformed note | Missing `id`, non-string `content`, or non-object payload | Dropped; no throw, no state change | Debug log only |
| Duplicate note id | Same valid note arrives twice | Stored once (existing `addNote` dedupe) | No error expected |
| Malformed mood | `mood_types` a string/number, unknown `mood_type`, missing `created_at` | No subscriber dispatch, no `PartnerMoodView` toast, no render crash | Debug log only |
| Non-partner mood | Valid mood whose `user_id` ≠ partner snapshot | No dispatch, no toast | Debug log only |
| Valid multi-mood | `mood_types: ['happy','tired']` from partner | Both emoji/labels render in all three mood views | No error expected |
| Sign-out mid-send | Session cleared while a send is queued | `setAuth()` yields anon, join denied, send rejects | `notesSlice.ts:566-570` logs non-fatal; note stays saved |
| Overlapping sends | Two notes to one topic before the first channel closes | Both delivered, in order, one channel at a time | Second send still queued behind the first |
| Reconnect | Channel removed then resubscribed by the same user | Rejoins `SUBSCRIBED`, partner delivery resumes, partner snapshot refreshed | No error expected |

</intent-contract>

## Code Map

- `supabase/migrations/20260220000001_scripture_lobby_and_roles.sql:64-97` — the in-repo template for `realtime.messages` policies (`for select ... to authenticated using (topic like 'scripture-session:%' and ...)`, plus the matching `for insert`/`with check`). Copy the shape; swap the `::uuid` cast for a text compare.
- `supabase/migrations/20260222000001_scripture_lock_in.sql:300-327` — the other two existing `realtime.messages` policies (`scripture-presence:%`). With the two new ones the schema holds six; a `policies_are('realtime','messages', ...)` assertion must list all six.
- `supabase/migrations/20260205000001_fix_users_rls_recursion.sql:13-23` — `public.get_my_partner_id()` is `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`, body `SELECT partner_id FROM public.users WHERE id = auth.uid();`, granted to `authenticated` (re-granted at `20260818000000_revoke_anon_execute_and_fix_partner_guards.sql:285`). Reuse it — a new `public.` function would have to be added to the exact-list assertion at `supabase/tests/database/18_function_execute_grants.sql:128-132`.
- `supabase/migrations/20260912000000_remove_claude_bot_password_row.sql` — latest migration; the new file must sort after it.
- `supabase/tests/database/` — 23 files; **none references the `realtime` schema** (`grep -rn "realtime" supabase/tests/` is empty), and every `policies_are` call is scoped to `public` (`02_rls_policies.sql:70,75,80,85,90`) or `storage` (`16_photos_storage_update_policy.sql:17-19`). Adding `realtime.messages` policies breaks no existing pgTAP file.
- `src/api/ephemeralBroadcast.ts:69` — `const channel = supabase.channel(topic);` claims the topic **before** `await waitForSocketReady()` at `:74`; that order is load-bearing (`:58-68`). Add the private config at `:69` and `await supabase.realtime.setAuth()` between `:69` and `:74`.
- `src/api/moodSyncService.ts:504-508` — `.channel(topic, { config: { broadcast: { self: false } } })`; add `private: true`. `:189-191` — the comment "doesn't require RLS permissions" is now false; correct it. `:509-526` — the unvalidated hand-built `SupabaseMoodRecord` and the `subscribers.forEach` dispatch; parse and identity-check here. `:460` — `` const topic = `mood-updates:${currentUserId}` ``. `:527-532` — the `subscribe()` status callback, where the partner snapshot is refreshed on `SUBSCRIBED`.
- `src/hooks/useScriptureBroadcast.ts:121-126, 173-190` — the working private-channel precedent in this codebase: `config: { broadcast: { self: false }, private: true }`, then `supabase.realtime.setAuth().then(...)` with a `cancelled` flag guarding the subscribe. Mirror the cancellation guard.
- `src/hooks/useRealtimeMessages.ts:67-74` — public channel + `handleNewMessage` at `:39-57`, which calls `addNote(message)` with no checks. `:37` already reads `userId` from the store; the partner id is not available here — resolve it with `getPartnerId()` from `src/api/supabaseClient.ts:79`, the same source `notesSlice.sendNote` uses.
- `src/stores/slices/notesSlice.ts:565` — `` await sendEphemeralBroadcast(`love-notes:${partnerId}`, 'new_message', { message: data }) `` where `data` is the server row; `:566-570` treats a broadcast failure as non-fatal. No change needed here beyond confirming that contract still holds.
- `src/components/love-notes/LoveNoteMessage.tsx:126-128` — `if (message.imagePreviewUrl) { setImageUrl(message.imagePreviewUrl) }` takes priority over the signed-URL path at `:138-144` and lands at `<img src={imageUrl}>` (`:300-301`). This is why the wire field must never survive parsing; the component itself is correct for locally created `blob:` previews and is left alone.
- `src/types/models.ts:17-34` — `LoveNote`: server fields `id, from_user_id, to_user_id, content, created_at, image_url`; client-only `sending, error, tempId, imageUploading, imageBlob, imagePreviewUrl`. `src/types/database.types.ts:163-181` — the `love_notes` row also carries `idempotency_key`.
- `src/api/validation/supabaseSchemas.ts:111-119` — `SupabaseMoodSchema` (`id`, `user_id`, `mood_type`, `mood_types` nullable-optional, `note` nullable, `created_at`/`updated_at` nullable). `MoodTypeSchema` at `:88-105`. There is no love-note schema yet.
- `src/components/MoodTracker/PartnerMoodDisplay.tsx:107`, `src/components/MoodTracker/MoodHistoryItem.tsx:40`, `src/components/PartnerMoodView/PartnerMoodView.tsx:668` — the three unsafe checks, all of the form `x.mood_types && x.mood_types.length > 0` / `moodEntry.moods && moodEntry.moods.length > 0`. `PartnerMoodView.tsx:670` then does `MOOD_CONFIG[allMoods[0]]` and `:693` `allMoods.map(...)`, which throw on a non-array.
- `src/components/PartnerMoodView/PartnerMoodView.tsx:180-201` — the second `subscribeMoodUpdates` consumer; it raises a toast (`:185-190`) with **no** sender check, which is why the identity check belongs in the service, not only in `usePartnerMood.ts:84`.
- `src/api/interactionService.ts:251` — `` .channel(`incoming-interactions:${userId}`) `` is still a **public** `postgres_changes` channel with no policy. It is out of scope here and is the blocking dependency for the hosted public-access setting (Design Notes).
- Existing unit tests that will need their fakes updated: `tests/unit/api/ephemeralBroadcast.test.ts:60-129` (hand-written `FakeChannel` reproducing the topic registry and the `state == 'closed'` subscribe gate), `tests/unit/api/moodSyncSubscription.test.ts:70-76` (same fake, 13 refcount cases), `src/hooks/__tests__/useRealtimeMessages.test.ts:8,44` (asserts `expect(supabase.channel).toHaveBeenCalledWith('love-notes:user-123')` — a second argument breaks this). All three mock `@/api/supabaseClient`, so their mocks must gain `realtime.setAuth`.
- `tests/api/interaction-realtime.spec.ts:23-66` — the only existing **live-websocket** test and the template for the new one: `supabaseAsUser.channel(...).subscribe((status) => statuses.push(status))` then `recurse(...)` until `SUBSCRIBED`, finally `await supabaseAsUser.removeChannel(channel)`.
- `tests/support/helpers/rls-security.ts:14-36` `createUserClient(supabaseAdmin, userId)` and `:43-93` `createOutsiderClient(supabaseAdmin, emailPrefix)` → `{ client, userId, cleanup }` — the ready-made attacker identity. `tests/support/fixtures/index.ts:105-124` `supabaseAsUser` (anon key + this worker's JWT); `tests/support/fixtures/auth.ts:47,58` `authToken`/`partnerAuthToken`. Worker accounts are pre-linked as partners by `tests/support/auth/global-setup.ts:150-152`, shared password `tests/support/test-credentials.ts:14`.
- `playwright.config.ts:140-166` — three projects, directory-scoped, no `testMatch`: a spec in `tests/api/` runs under the `api` project. Priority tags live in the test **title** (`[P0]`/`[P1]`), selected by `--grep`.
- Supabase docs (Context7, `guides/realtime/settings.mdx`): "Allow public access to channels" defaults to **Enabled** — "no policy check runs, but anyone holding your project's anon key can subscribe to and broadcast on any public channel." Disabled rejects every non-private join with `PrivateOnly`. `guides/realtime/authorization.mdx` and `examples/prompts/use-realtime.md`: `config: { private: true }` plus `await supabase.realtime.setAuth()` **before** subscribe; SELECT policies gate receive, INSERT policies gate send.
- `node_modules/` is **absent** in this worktree (`ls -d node_modules` → no such file). Run `npm ci` before any npm script. Do not symlink it from the main checkout.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/20260912010000_private_couple_broadcast_policies.sql` — create — two `realtime.messages` policies `TO authenticated` matching `topic like 'love-notes:%' or topic like 'mood-updates:%'`: `couple_broadcast_recipient_can_receive` (SELECT, `split_part(topic, ':', 2) = (select auth.uid())::text`) and `couple_broadcast_partner_can_send` (INSERT, `split_part(topic, ':', 2) = public.get_my_partner_id()::text`). One predicate for both prefixes, so there is a single place to audit. Header comment records why the compare is text, not `::uuid`.
- `supabase/tests/database/23_couple_broadcast_policies.sql` — create — pgTAP: `policies_are('realtime', 'messages', ...)` listing all six policy names; `policy_cmd_is` for the two new ones (SELECT / INSERT); assert both are restricted to `authenticated` via `pg_policies.roles`. Header states that behavioural proof lives in the Playwright spec, not here.
- `src/api/validation/broadcastSchemas.ts` — create — `LoveNoteBroadcastSchema` (zod object over the server fields only: `id`, `from_user_id`, `to_user_id`, `content`, `created_at`, `image_url` nullable-optional, `idempotency_key` optional) and `parseLoveNoteBroadcast(raw, { currentUserId, partnerId })` returning `LoveNote | null`. Zod's default object strip is what removes `imagePreviewUrl` and every other client-only field; the directional check requires `to_user_id === currentUserId && from_user_id === partnerId`. Also export `parseMoodBroadcast(raw, { partnerId })` wrapping `SupabaseMoodSchema.safeParse` plus the `user_id === partnerId` check, so both features share one boundary.
- `src/api/ephemeralBroadcast.ts` — edit `openSendClose` — open with `{ config: { private: true } }` at the existing claim site, then `await supabase.realtime.setAuth()` before `await waitForSocketReady()`. Queue, timeout and awaited teardown unchanged. Update the module docblock to say sends are authorized by the INSERT policy.
- `src/hooks/useRealtimeMessages.ts` — edit — resolve the partner id with `getPartnerId()` inside the effect, open the channel with `{ config: { private: true } }`, `await supabase.realtime.setAuth()` before `subscribe()` behind a `cancelled` guard modelled on `useScriptureBroadcast.ts:113-190`, refresh the partner snapshot on `SUBSCRIBED`, and route every payload through `parseLoveNoteBroadcast` — dropping a `null` result before `addNote`, the vibration and the `onNewMessage` callback. Retry/backoff behaviour is unchanged.
- `src/api/moodSyncService.ts` — edit — add `private: true` to the channel config; `await supabase.realtime.setAuth()` before `subscribe()`; store a `partnerId` snapshot on `MoodChannelEntry` resolved via `getPartnerId()` at entry creation and refreshed when the status callback sees `SUBSCRIBED`; capture `currentUserId` and drop a broadcast if the signed-in user changed; run the candidate record through `parseMoodBroadcast` and dispatch to `subscribers` only on success. Correct the false "doesn't require RLS permissions" comment at `:189-191`.
- `src/components/MoodTracker/PartnerMoodDisplay.tsx`, `src/components/MoodTracker/MoodHistoryItem.tsx`, `src/components/PartnerMoodView/PartnerMoodView.tsx` — edit — replace the three truthy/`.length` checks with `Array.isArray(...) && ....length > 0` so a non-array value falls back to the single-mood path instead of throwing at `PartnerMoodView.tsx:670`. Also add a named `export` to `MoodCard` (`PartnerMoodView.tsx:664`) so the guard can be tested without mounting the whole 711-line view; leave `index.ts` exporting only `PartnerMoodView`.
- `tests/unit/api/broadcastSchemas.test.ts` — create — unit-test every receiver row of the I/O matrix against `parseLoveNoteBroadcast`/`parseMoodBroadcast`: forged sender, forged recipient, attacker `imagePreviewUrl` (asserting the key is absent from the result), malformed and non-object payloads, unknown `mood_type`, non-array `mood_types`, missing `created_at`, non-partner mood, and the valid multi-mood case.
- `tests/unit/api/ephemeralBroadcast.test.ts`, `tests/unit/api/moodSyncSubscription.test.ts`, `src/hooks/__tests__/useRealtimeMessages.test.ts` — edit — add `realtime.setAuth` to each mock, assert it resolves **before** `subscribe()` and that the channel is opened with `private: true`, and keep every existing queue/refcount/retry case green. Add cases for a malformed or non-partner broadcast reaching no subscriber, and for a sign-out mid-send producing a rejected (non-fatal) broadcast.
- `src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx` and `src/components/PartnerMoodView/__tests__/MoodCard.moodArray.test.tsx` — create (no PartnerMoodDisplay/PartnerMoodView test file exists today) — render `MoodHistoryItem`, `PartnerMoodDisplay` and the newly exported `MoodCard` with `mood_types`/`moods` set to a string and to a number, asserting no throw and the single-mood fallback, plus the valid multi-mood case for each.
- `tests/api/couple-broadcast-authorization.spec.ts` — create — live Realtime against the local stack, in the `api` project, following `tests/api/interaction-realtime.spec.ts`: partner→victim private delivery on both topics; outsider and anon private joins to both topics denied; outsider private send denied; delivery restored after a `removeChannel`/resubscribe cycle. Use `createOutsiderClient` for the attacker and a bare `createClient(url, anonKey)` for anon; link or unlink no worker accounts.
- Operational: record in **Operational Evidence** the measured answer to whether a **public** join to `love-notes:<A>` still receives a privately-sent broadcast on this stack, the state of the hosted "Allow public access to channels" setting, and the `interactionService.ts:251` dependency that keeps it Enabled. Keep the `rollout.md` "Realtime rollout" row open.

**Acceptance Criteria:**
- Given a fresh local stack, when `supabase db reset` and `supabase test db` run, then all pgTAP files pass including `23_couple_broadcast_policies.sql`, and `realtime.messages` carries exactly the six expected policies.
- Given two linked worker accounts, when the partner sends a note and a mood over private channels and the recipient is subscribed privately, then both arrive and the recipient's channel reports `SUBSCRIBED` without `CHANNEL_ERROR`.
- Given an authenticated non-partner and an anon client, when either joins `love-notes:<victim>` or `mood-updates:<victim>` with `private: true`, then neither reaches `SUBSCRIBED`, and a subsequent legitimate partner send still reaches the victim.
- Given a victim subscribed privately, when a non-partner opens the victim's topic privately and calls `send()`, then the victim's `addNote` is never called and no mood is dispatched.
- Given the app's own unit suites, when `npm run test:unit` runs, then the existing `ephemeralBroadcast` queue, `moodSyncSubscription` refcount and `useRealtimeMessages` retry cases still pass alongside the new validation cases.
- Given `npm ci`, when `npm run lint`, `npm run typecheck`, `npm run test:unit` and `fnox exec -- npm run build` run, then all pass.
- Given the Realtime rollout row in `rollout.md`, when this story closes, then it remains open with the measured public-join result, the hosted setting state and the `interactionService` dependency recorded.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 43 findings — high 0, medium 9, low 21, false 12, maybe-false 1
- findings:
  - `[medium]` `[patch]` (blind-hunter) The retry calls `subscribe()` with no callback, so no status reaches `handleStatus` again — verified against `node_modules/@supabase/realtime-js/dist/module/RealtimeChannel.js:129-179`, where the handed callback is the only thing wired into `_onError`, `_onClose` and the joinPush receives; the retry-count reset and `refreshPartnerSnapshot()` therefore never ran after the first retry. Patched: the retry now passes `handleStatus`, and the test fake records each call's callback instead of retaining the first (red-then-green confirmed).
  - `[low]` `[reject]` (blind-hunter) The async subscribe IIFE has no `.catch` — neither awaited call has a demonstrated rejection path: `getPartnerId` try/catches to `null` (`src/api/supabaseClient.ts:133-136`) and `_performAuth` catches its own token-callback failure and falls back to the cached value (`RealtimeClient.js:484-492`). A guard for a state not shown reachable.
  - `[medium]` `[patch]` (blind-hunter) `refreshChannelIdentity` is fire-and-forget, so `entry.partnerId` holds the previous snapshot across two network round-trips — patched: the snapshot is nulled synchronously before the first await, plus a `.catch`. Grouped with the two edge-case rows below and with the same defect in `useRealtimeMessages.refreshPartnerSnapshot`, patched the same way.
  - `[medium]` `[patch]` (blind-hunter) `partnerIdAtJoin` is resolved on every call but only read in the `if (!entry)` literal — verified: a second consumer wastes a `users` round-trip, and an entry whose snapshot was nulled never recovers, silently dropping every partner mood for the life of the page. Patched: the fresh value is assigned for every caller.
  - `[low]` `[patch]` (blind-hunter) Three documents still said the send is "rejected at the join" after the diff removed the join — patched in `moodSyncService.broadcastMoodToPartner` and `sendEphemeralBroadcast`'s `@throws`. The third is the intent-contract matrix row, whose fix would edit this build's spec.
  - `[low]` `[patch]` (blind-hunter) The `[P1]` public-join test only logged the join status while `rollout.md` and Operational Evidence said it was asserted — patched: `settledStatus(eavesdrop)` is now asserted to be `SUBSCRIBED`.
  - `[medium]` `[patch]` (blind-hunter) Both send-denial cases used an unlinked outsider, so only the `get_my_partner_id() IS NULL` branch was exercised — patched: a new `[P0]` case links two throwaway accounts to each other and asserts the partnered sender is denied on the victim's topics while succeeding on its own partner's.
  - `[low]` `[defer]` (blind-hunter) `Array.isArray` adopted at three sites, not at the four siblings sharing the idiom — deferred: `moodSlice.ts:384` and the `MoodHistory` pair read zod-validated (`MoodArraySchema`) or IndexedDB data that no broadcast reaches, so this is pre-existing hardening rather than a hole this story opened.
  - `[low]` `[patch]` (blind-hunter) The `result.success === false` arm was unreachable in practice and covered by nothing — patched: the fake now arms that resolved shape and a case asserts the send rejects.
  - `[low]` `[patch]` (blind-hunter) `httpSend` depends on a hosted Realtime serving `/realtime/v1/api/broadcast`, measured only on the local container — resolved by measurement: the hosted endpoint answers HTTP 422 `{"errors":{"messages":["can't be blank"]}}`, not 404, so the route is live. Patched: recorded in `rollout.md` as satisfied rather than outstanding.
  - `[false]` `[reject]` (blind-hunter) An unconstrained `image_url` could reach an `<img src>` — refuted: `LoveNoteMessage.tsx:144` passes it only to `getSignedImageUrl`, which always calls `supabase.storage.from(BUCKET).createSignedUrl(storagePath, ...)` (`loveNoteImageService.ts:255-257`), so an absolute attacker URL produces a failed Storage signing and `setImageError(true)`, never a request to that host. The `content` half of the same row was real and is patched below.
  - `[low]` `[patch]` (blind-hunter) The pgTAP predicate assertions pinned Postgres's exact deparsed spelling — patched: the positive matches are loosened to `split_part(topic`, `auth.uid` and `get_my_partner_id`, and the durable `strpos(..., '::uuid') = 0` check is kept and extended to the send predicate. The same row's claim that three files are missing from the story's Execution list is rejected: its fix edits this build's spec.
  - `[medium]` `[patch]` (edge-case-hunter) Broadcast arriving between `SUBSCRIBED` and the awaited `refreshChannelIdentity` is authorized against the ex-partner — same root cause as the blind-hunter row above; patched with it.
  - `[medium]` `[patch]` (edge-case-hunter) An existing entry's `ownerUserId`/`partnerId` are never updated from the freshly-resolved lookup — same root cause as the `partnerIdAtJoin` row; patched with it.
  - `[medium]` `[patch]` (edge-case-hunter) An account change nulls `partnerId` with no later `SUBSCRIBED` to revive it, so a re-login on the same device receives no moods until reload — same root cause; the assignment for every caller fixes it.
  - `[medium]` `[patch]` (edge-case-hunter) A note arriving between `SUBSCRIBED` and the hook's `getPartnerId()` resolving is checked against the pre-disconnect partner — verified at `useRealtimeMessages.ts:121-126`; patched: `partnerIdRef.current` is nulled synchronously before the await, matching `refreshChannelIdentity`.
  - `[maybe-false]` `[defer]` (edge-case-hunter) `getPartnerId()` returning `null` for a transient PostgREST error is indistinguishable from "unlinked" and would drop every note and mood for the life of the channel — could not be settled: I could not show a state where the `users` query fails while the private websocket join to the same host succeeds. Deferred with what would settle it.
  - `[low]` `[patch]` (edge-case-hunter) A wire mood with `created_at: null` was accepted and rendered "Just now" — patched: `MoodBroadcastSchema` overrides `created_at` to non-null.
  - `[false]` `[reject]` (edge-case-hunter) `MOOD_CONFIG[allMoods[0]]` can still be undefined — refuted: every value reaching those components is zod-validated against the `MoodTypeSchema` enum, by `parseMoodBroadcast` on the wire path and by `MoodArraySchema` in `moodApi.fetchByUser` on the fetch path, so a member outside the enum does not arrive.
  - `[low]` `[patch]` (edge-case-hunter) `content` was unbounded while the DB CHECK is 1..1000 — patched: `.min(1).max(1000)` with cases at both ends.
  - `[low]` `[defer]` (edge-case-hunter) `subscribe()` on an `errored` channel is a no-op because the SDK gates its whole body on `channelAdapter.isClosed()` (`RealtimeChannel.js:134`) — real, but pre-existing and untouched by this diff: the baseline retry had the same shape. Deferred.
  - `[low]` `[defer]` (edge-case-hunter) An effect re-run while the previous run's un-awaited `removeChannel` is still deregistering is handed a dying channel — pre-existing; the new `cancelled` guard covers the subscribe half, and the remaining window is the same one the baseline had.
  - `[low]` `[reject]` (edge-case-hunter) The fake's timeout rejection message does not match the real `AbortError` — test-fidelity only, with no user- or developer-visible bad outcome, and the fix adds fake complexity.
  - `[medium]` `[patch]` (edge-case-hunter) Only an unpartnered forger is tested, so the `<> partner` branch is unmeasured — same root cause as the blind-hunter row; patched with it.
  - `[low]` `[patch]` (edge-case-hunter) `sendEphemeralBroadcast`'s `@throws` still promised a throw when "the channel never subscribes" — grouped with the stale-docblock row; patched.
  - `[low]` `[reject]` (edge-case-hunter) The claim "capture `currentUserId` and drop a broadcast if the signed-in user changed" implies a per-broadcast account check that does not exist — rejected: the topic embeds its owner, the check is at join and `SUBSCRIBED` by design, and `rollout.md` explicitly forbids claiming per-message relationship revalidation from RLS.
  - `[low]` `[reject]` (edge-case-hunter) "Queue, timeout and awaited teardown unchanged" understates that the timeout changed kind — rejected: the module docblock and the story's Design Notes both state plainly that the bound is handed to the fetch rather than raced against the whole operation.
  - `[false]` `[reject]` (edge-case-hunter) The intent's "setAuth before subscribe" describes a join denial that cannot occur — refuted as a defect: the spec's Design Notes pre-authorized the REST fallback before implementation, and the remaining mismatch is intent-contract text whose fix would edit this build's spec.
  - `[low]` `[patch]` (verification-gap) The new `cancelled` guard is unverified — pre-verified by that layer and confirmed: deleting both guards left the file green. Patched: two cases unmount mid-`getPartnerId` and mid-`setAuth` and assert `subscribe` was never called (red-then-green confirmed).
  - `[low]` `[defer]` (verification-gap) `Array.isArray` not adopted at `MoodDetailModal.tsx:91` and `CalendarDay.tsx:72` — pre-verified; grouped with the blind-hunter adoption row and deferred for the same reason.
  - `[medium]` `[patch]` (verification-gap) The retry test's fake re-arms a status callback the real SDK does not, hiding the missing-callback defect — pre-verified; patched with the retry row.
  - `[medium]` `[patch]` (verification-gap, other) `void refreshChannelIdentity` leaves a stale-trust window the tests never enter — same root cause as the two rows above; patched.
  - `[low]` `[reject]` (verification-gap, other) `idempotency_key` is on the broadcast schema but not on the `LoveNote` type — no bad outcome: the value comes from the server row `notesSlice.ts:565` broadcasts, and an extra key on an object typed structurally harms nothing.
  - `[low]` `[defer]` (verification-gap, other) No E2E exercises the app's own realtime composition in a browser — real coverage gap, but pre-existing for these features and explicitly out of this story's shape; deferred with the intent-alignment row below.
  - `[medium]` `[patch]` (intent-alignment) "Cannot inject" was asserted only at the private surface; the public-publisher → private-subscriber direction was unmeasured — I measured it on the local stack: anon public join reaches `SUBSCRIBED`, its websocket `send()` reports `ok` and an anon REST broadcast returns 202, and the private subscriber receives none of it. Patched: both attack directions are now asserted in the `[P1]` test.
  - `[low]` `[defer]` (intent-alignment) Live evidence sits at the SDK transport while the app composition is only unit-tested — grouped with the E2E row above and deferred.
  - `[low]` `[reject]` (intent-alignment) The toast is the intent's named surface but only `onMood` is asserted — rejected: `PartnerMoodView.tsx:185-190` raises the toast from inside the `onMood` callback, so `expect(onMood).not.toHaveBeenCalled()` is that surface, not a proxy for it.
  - `[low]` `[reject]` (intent-alignment) No test renders a note and asserts no fetch to the attacker host — rejected: the field is stripped before it reaches state, asserted by key-absence, and `LoveNoteMessage` reads nothing else that could originate the request.
  - `[false]` `[reject]` (intent-alignment) The send transport moved off the surface the invariant was written for — refuted: the per-topic queue, the claim-before-socket-wait order and the awaited `removeChannel` are all literally preserved, and the REST fallback was pre-authorized by the spec's Design Notes before implementation.
  - `[false]` `[reject]` (intent-alignment) pgTAP proves stored text rather than behaviour — refuted as a defect: that split is deliberate and stated in the file's own header, with behaviour proved by the Playwright spec, which is what `rollout.md` requires.
  - `[false]` `[reject]` (intent-alignment) Operational closure is local-stack only — refuted: `rollout.md` permits exactly this and requires the row stay open, which it does.
  - `[false]` `[reject]` (intent-alignment) Two production surfaces widened for testability — no named harm: `MoodCard` stays out of `index.ts`, and the two schema exports are reuse of existing constants rather than new behaviour.
  - `[false]` `[reject]` (intent-alignment) Payload identity is enforced client-side only — refuted: `remediation.md` explicitly requires the receiver-side identity check in addition to the transport boundary, so this is the contract, not a gap in it.

### 2026-09-12 — Review pass (follow-up)
- verdicts: 40 findings — high 0, medium 3, low 26, false 9, maybe-false 2
- findings:
  - `[low]` `[reject]` (blind-hunter) The previous pass's verdict tally contradicts its own bullets — verified by counting: `grep -c` over rows 177-219 gives 43 rows, and the verdict labels count medium 12, low 22, false 8, maybe-false 1 against a header reading medium 9, low 21, false 12. Real, but its only fix is to edit this build's spec, so it is rejected under that rule; this pass's header above was computed from a counted tally rather than written by hand.
  - `[medium]` `[patch]` (blind-hunter) `23_couple_broadcast_policies.sql` never pins the `topic like 'love-notes:%' or topic like 'mood-updates:%'` guard, which is the clause that scopes both policies — verified by mutation against the running stack: dropping and recreating the receive policy without the prefix clause left all three pre-existing `strpos` assertions true while the grant widened to every realtime topic whose second segment is the caller's id. Patched: two new `ok()` assertions pin both prefixes in `qual` and in `with_check` (red-then-green confirmed against that mutation).
  - `[low]` `[patch]` (blind-hunter) The same file never asserts the policies are PERMISSIVE, so an `as restrictive` rewrite would pass every assertion while AND-ing itself against the four scripture policies — verified: `policies_are`, `policy_cmd_is` and `policy_roles_are` all read columns that are indifferent to permissiveness. Same root cause as the row above (the file pins the policy set's identity, not its predicates' semantics); patched with it via a third assertion on `pg_policies.permissive`.
  - `[low]` `[patch]` (blind-hunter) Two `ephemeralBroadcast.ts` doc comments still describe the deleted `subscribe()` send — verified at `:71` ("measured from `subscribe()` to the send resolving", directly contradicting the next paragraph, which says the bound is handed to `httpSend`) and `:97` ("This channel would then join nothing and report TIMED_OUT"). Patched: `:71` now reads "Upper bound on one send's HTTP request" and `:97`'s consequence is restated in terms of the socket the `finally` still drives.
  - `[false]` `[reject]` (blind-hunter) The new `await supabase.realtime.setAuth()` sits outside `openSendClose`'s `try/finally`, so a rejection would orphan the claimed channel — refuted: `setAuth` has no demonstrated rejection path. `RealtimeClient.js:384-398` awaits only `_performAuth`, which catches its own `accessToken()` failure and falls back to the cached value (`:484-492`); the sibling `await waitForSocketReady()` on the same side of the boundary cannot reject either (`realtimeSocket.ts:74-93` has no throw and returns on its own timeout). Grouped with the edge-case row below.
  - `[low]` `[patch]` (blind-hunter) `refreshChannelIdentity` assigns `entry.partnerId = null` twice with nothing between — verified at `moodSyncService.ts:451` and `:458`; the second is dead and obscures the deliberate clear-before-await ordering the first comment explains. Patched: the dead assignment is replaced by a comment recording why none is needed there.
  - `[low]` `[reject]` (blind-hunter) `entry.partnerId = partnerIdAtJoin` unconditionally clobbers whatever `refreshChannelIdentity` last wrote — verified as a real race: `partnerIdAtJoin` is resolved before `await supabase.realtime.setAuth()` (`:521-525`) and assigned at `:632` for every caller, so a subscriber whose lookup started earlier can restore a partner the refresh just nulled. Rejected: the account-change direction is unreachable (the topic embeds `currentUserId`, so a same-topic subscriber is the same account), leaving only an unlink concurrent with a mount — and RLS already denies an ex-partner's send at `couple_broadcast_partner_can_send`, so the snapshot is defence in depth. The fix needs an identity-generation counter, which is more than a direct correction. Grouped with two rows below.
  - `[false]` `[reject]` (blind-hunter) Three `useRealtimeMessages` async paths have no rejection handler while the `moodSyncService` sibling was given one — refuted on the same evidence as the `setAuth` row: `getPartnerId` try/catches every path to `null` (`supabaseClient.ts:132-136`) and `setAuth` does not reject, so none of the three has a demonstrated rejection. The sibling's `.catch` is belt-and-braces over the same two calls, not a fix for a reachable state. Grouped with two edge-case rows below.
  - `[false]` `[reject]` (blind-hunter) `MoodBroadcastSchema`'s non-null `created_at` silently drops a legitimate row with a null timestamp — refuted: `moods.created_at` is `TIMESTAMPTZ DEFAULT now()` (`20251203000001_create_base_schema.sql:69`) and `MoodInsertSchema.created_at` is `.optional()` and not nullable, so no client path writes a null; a legitimate null row is not reachable.
  - `[low]` `[reject]` (blind-hunter) `DW-88` carries no `severity:` while its four siblings do — verified in the ledger hunk. Rejected: the source record, this spec's `deferred:` frontmatter, carries `severity: medium (unverified)` for that item, and the ledger is orchestrator-owned and explicitly out of bounds for this session.
  - `[false]` `[reject]` (blind-hunter) `review_loop_iteration: 0` contradicts a body carrying a completed review pass — refuted by the counter's semantics: it gates the bad_spec repair loop within one pass, and step-01 resets it to `0` by design when a `done` spec is re-dispatched for a follow-up review. It does not count reviews ever run.
  - `[low]` `[reject]` (blind-hunter) The Execution list omits three changed files — carried: same claim and location as the logged row of 2026-09-12, and the code still reads as that row describes. Verdict and route kept; its only fix is to edit this build's spec.
  - `[low]` `[reject]` (blind-hunter) The `[P1]` public-path test exercises `love-notes` only — verified at `couple-broadcast-authorization.spec.ts:378-380`; both `[P0]` join-denial tests do cover both topics. Rejected: no policy check runs for a public join at all (the test's own premise), so the public path cannot diverge by prefix, and duplicating the test adds live-Realtime surface for a difference that cannot exist.
  - `[low]` `[reject]` (blind-hunter) Denial assertions check only "not SUBSCRIBED" while `TERMINAL_FAILURES` admits `CLOSED`, so a denial can be reported that was never observed — verified at `:60`, `:126` and `:152`. Rejected: the security property under test is precisely "never reaches SUBSCRIBED", which is what the intent matrix states and what the assertion checks; tightening to a specific terminal status would make a live-Realtime suite flaky without adding a property.
  - `[low]` `[reject]` (blind-hunter) Non-delivery rests on three fixed 3s sleeps — verified at `:303`, `:397` and the third grace wait. Rejected: two of the three follow a completed positive round-trip (`poll` for a delivered message) before the sleep, and the forged-note case additionally asserts `notes.received` equals exactly the one legitimate note, which a late forgery would break. Restructuring the three tests is more than a direct correction.
  - `[medium]` `[patch]` (blind-hunter) The live spec's payloads are shapes the story's own validators reject, so transport and validation are never exercised together — verified: `{ message: { id: 'note-1', content: 'hi' } }` and `{ id: 'mood-1', mood_type: 'happy' }` both fail their schemas on a non-UUID `id` alone. Same root cause as the verification-gap row below (no test joins producer, transport and validator). Patched at the unit surface, which is where the contract can actually be pinned; the live spec's raw-envelope fixtures are left as the transport proof they are.
  - `[false]` `[reject]` (edge-case-hunter) A `setAuth()` rejection after the topic is claimed orphans the channel and wedges that topic's queue — same root cause as the blind-hunter row above; refuted with it.
  - `[low]` `[reject]` (edge-case-hunter) A concurrent `refreshChannelIdentity` resolving between `:522` and `:632` lets a stale `partnerIdAtJoin` re-authorize an ex-partner — same root cause as the blind-hunter clobber row; rejected with it for the same reasons.
  - `[maybe-false]` `[defer]` (edge-case-hunter) `getSignedInUserId()` returning `null` from a transient session-read failure is read as "account changed" and mutes the mood channel for the life of the page — could not be settled: `refreshChannelIdentity` runs only from the `SUBSCRIBED` arm, moments after the same session authorized the private join, so a session read failing while that join succeeds is not demonstrated. Deferred with what would settle it; if true it is medium.
  - `[false]` `[reject]` (edge-case-hunter) A denied private re-join stops mood delivery permanently because `moodSyncService` has no retry ladder — refuted: the Phoenix channel schedules its own rejoin on every join error and channel error while the socket is connected (`@supabase/phoenix/priv/static/phoenix.mjs:246-252` and `:259-268`), and `:233-238` rejoins an errored channel on socket reopen, so a denied join is retried with backoff rather than abandoned.
  - `[low]` `[patch]` (edge-case-hunter) The mood `note` is unbounded on the wire while `content` was bounded to its DB range this same pass — verified: `moods_note_check` is `char_length(note) <= 500` (`20251206024345_remote_schema.sql:117`) and `PartnerMoodDisplay` renders the note unbounded. Patched: `MoodBroadcastSchema` overrides `note` to `z.string().max(500).nullable()`, with cases at 500 and 501.
  - `[low]` `[reject]` (edge-case-hunter) A `setAuth()` rejection inside the un-caught async IIFE would stop `subscribe()` ever running — carried: same claim and location as the logged row of 2026-09-12, and the code still reads as that row describes. Verdict and route kept.
  - `[false]` `[reject]` (edge-case-hunter) A `setAuth()` rejection inside the retry's `.then()` silently skips that attempt with nothing to reschedule it — refuted on the same evidence: `setAuth` has no demonstrated rejection path. Grouped with the blind-hunter uncaught-paths row.
  - `[low]` `[reject]` (edge-case-hunter) A private join to `love-notes:<non-uuid>` can raise 22P02 in the scripture policies, which cast the same segment — verified: `20260220000001_scripture_lobby_and_roles.sql:76` and `:91` cast `split_part(topic, ':', 2)::uuid`, and making these topics private is what first causes RLS to be evaluated for them. Rejected: both app clients build the segment from a Supabase-issued UUID, so only a deliberately malformed join reaches it, and the outcome is an error rather than access. The fix means either a regex guard here or editing another story's policies plus the pgTAP arrays that pin them — more than a direct correction.
  - `[low]` `[reject]` (edge-case-hunter) "Queue, timeout and awaited teardown unchanged" understates that the timeout changed kind — carried: same claim as the logged row of 2026-09-12; code unchanged. Verdict and route kept. (The stale prose it pointed at is separately patched above.)
  - `[low]` `[reject]` (edge-case-hunter) The claim "capture `currentUserId` and drop a broadcast if the signed-in user changed" implies a per-broadcast account check that does not exist — carried: same claim and location as the logged row of 2026-09-12; the check is still at join and `SUBSCRIBED` by design. Verdict and route kept.
  - `[false]` `[reject]` (edge-case-hunter) The intent's "setAuth before subscribe" describes a join the sender never performs — carried: same claim as the logged row of 2026-09-12. Verdict and route kept.
  - `[low]` `[patch]` (verification-gap) The `entry.partnerId = partnerIdAtJoin` recovery assignment added last pass is unverified — pre-verified by that layer (commenting the line out left 110 files / 1998 tests green) and reproduced here. Patched: a new case in `moodSyncSubscription.test.ts` nulls the snapshot via a `SUBSCRIBED` refresh, asserts the first subscriber is muted, then attaches a second subscriber with a succeeding lookup and asserts both receive again (red-then-green confirmed against that same mutation).
  - `[medium]` `[patch]` (verification-gap) Nothing joins `broadcastMoodToPartner`'s hand-listed wire fields to `MoodBroadcastSchema`'s hand-listed required fields — pre-verified by that layer: deleting `note: mood.note` from the producer left all 1998 tests green while `parseMoodBroadcast` would reject every real mood, because `note` is `.nullable()` and not `.optional()`. Grouped with the blind-hunter live-payload row. Patched: a round-trip case in `moodSyncService.test.ts` captures what the producer actually hands the broadcast queue and feeds it through `parseMoodBroadcast` (red-then-green confirmed against that same mutation).
  - `[low]` `[reject]` (verification-gap, other) Stale-partner overwrite race at `moodSyncService.ts:632` — same root cause as the two clobber rows above; rejected with them.
  - `[maybe-false]` `[defer]` (verification-gap, other) A transient session-read failure mutes the mood channel indefinitely, and `getSignedInUserId` has no direct test — same root cause as the edge-case row above; deferred with it.
  - `[low]` `[defer]` (verification-gap, other) The retry test added last pass asserts a rejoin the real SDK cannot execute — carried: same claim as the logged row of 2026-09-12, already on the ledger. Verdict and route kept; not re-deferred.
  - `[false]` `[reject]` (intent-alignment) Send authorization moved from the join surface the intent names to the REST surface — carried: same claim as the logged row of 2026-09-12, refuted there and unchanged. Verdict and route kept.
  - `[low]` `[defer]` (intent-alignment) The intent's rows name app objects while the only live test drives the raw SDK — carried: same claim as the logged row of 2026-09-12, already on the ledger. Verdict and route kept; not re-deferred.
  - `[low]` `[reject]` (intent-alignment) The attacker preview URL is asserted at the store surface, not the render surface — carried: same claim as the logged row of 2026-09-12. Verdict and route kept.
  - `[low]` `[reject]` (intent-alignment) Malformed and non-partner moods are asserted on the `onMood` callback, not the toast — carried: same claim as the logged row of 2026-09-12. Verdict and route kept.
  - `[low]` `[reject]` (intent-alignment) Account-change detection lives at join/`SUBSCRIBED`, not at message arrival — carried: same claim as the logged row of 2026-09-12. Verdict and route kept.
  - `[low]` `[reject]` (intent-alignment) The Problem is stated about the public topics while the fix closes the private path only — verified as accurate description, not defect: the intent's own Never list forbids flipping the hosted setting in this story, the `[P1]` test measures and asserts the public path's remaining behaviour, and `rollout.md` keeps the row open with `interactionService.ts:251` named as the dependency. Nothing to fix that the intent does not already exclude.
  - `[low]` `[reject]` (intent-alignment) The timeout moved from the operation surface to the request surface — carried: same claim as the logged row of 2026-09-12. Verdict and route kept.
  - `[low]` `[reject]` (intent-alignment) Four edits sit outside the surfaces the Approach enumerates — carried: same claim as the logged rows of 2026-09-12, which found no named harm and noted the Execution-list half is a spec edit. Verdict and route kept.

## Design Notes

**Why text comparison, not `::uuid`.** The scripture precedent casts (`20260220000001:74`). A topic whose second segment is not a UUID then raises 22P02 during policy evaluation instead of denying the join. `split_part(topic, ':', 2) = (select auth.uid())::text` cannot raise, and a non-canonical UUID simply fails to match — fail closed. Both clients build topics from Supabase-issued lowercase UUID strings.

**Why the sender does not get SELECT.** F2 is explicit: "A sender needs send permission, not blanket read permission across partner topics." Supabase grants a private join for read **or** write, so an INSERT-only policy is enough to join and broadcast. Verify this write-only join actually reaches `SUBSCRIBED` on the local stack; if Realtime turns out to demand SELECT for join, send through the REST broadcast endpoint — which checks the same INSERT policy — rather than widening the SELECT policy.

**Why the identity check moves into `moodSyncService`.** `usePartnerMood.ts:84` already filters on `newMood.user_id === partnerId`, but `PartnerMoodView.tsx:182-190` raises a toast for *any* broadcast. F3 requires malformed and non-partner payloads to produce no toast, so the check has to sit where both consumers share it.

**Why the hosted setting is not flipped here.** With "Allow public access to channels" Enabled — the default — no policy check runs for a non-private join, so the new policies gate private joins only. Disabling it rejects every non-private join with `PrivateOnly`, and `src/api/interactionService.ts:251` is still a public `postgres_changes` channel, as are installed PWA builds on the old public topics. `rollout.md` covers exactly this: "If a global setting conflicts with another live consumer, report the concrete dependency before changing it and keep rollout completion open." So this story ships the policies and the private clients, records the dependency, and leaves the rollout row open.

**Ordering inside `openSendClose`.** The claim must stay first (`ephemeralBroadcast.ts:58-68` explains why: `channel()` registers synchronously, and being in the registry stops another topic's teardown from disconnecting the shared socket underneath). `setAuth()` only sets the token, so it slots between the claim and `waitForSocketReady()`.

## Operational Evidence

Measured on the local stack on 2026-09-12: `supabase_realtime_My-Love`, image `public.ecr.aws/supabase/realtime:v2.124.4`, `@supabase/supabase-js` and `@supabase/realtime-js` 2.116.0. Database reset from scratch (`supabase db reset`, 20260912010000 applied last) before every measurement.

**A write-only private JOIN is refused; the REST broadcast endpoint is not.** The spec's Design Notes anticipated this, and it is what happened. A partner holding INSERT and no SELECT on the recipient's topic cannot open a private websocket channel to it:

```
error_code=Unauthorized sub=<partner uuid> [error] Unauthorized: You do not have
permissions to read from this Channel topic: love-notes:<victim uuid>
```

The same client's `channel.httpSend(...)` to that topic returns `{"success":true}` (HTTP 202) and the recipient receives it, while an unlinked outsider's `httpSend` to the same topic **rejects** with `Error: Unauthorized` (HTTP 403 — `POST /api/broadcast/love-notes%3A<uuid>/events/new_message ... Sent 403 in 6ms`) and nothing is delivered. So `sendEphemeralBroadcast` sends over REST, and the SELECT policy was NOT widened to partner topics.

**`send()` hides the denial; `httpSend()` does not.** The SDK falls back to the same REST endpoint when a channel is not joined, logging `Realtime send() is automatically falling back to REST API`, but it resolves `'ok'` even for the outsider whose request was rejected — measured, with no delivery. That is why the implementation and the Playwright spec both use `httpSend`.

**Public join to a victim topic: reaches SUBSCRIBED, receives nothing.** The measured answer to the rollout question. A bare anon-key client joining `love-notes:<victim>` **without** `private: true` settles as `SUBSCRIBED` on this stack — Realtime's "Allow public access to channels" is at its default, Enabled, and no policy check runs for a public join. It then receives **zero** of the broadcasts the partner sends privately to that same topic; private and public are separate delivery paths. That is what closes CAP-2/CAP-3 without flipping the setting. Asserted in `tests/api/couple-broadcast-authorization.spec.ts` so a change in that behaviour fails a test rather than passing silently.

**The hosted setting is not flipped, and the dependency that keeps it Enabled.** `src/api/interactionService.ts:251` still opens `` `incoming-interactions:${userId}` `` as a **public** `postgres_changes` channel with no policy; disabling public access would reject every one of those joins with `PrivateOnly`. Installed PWA builds still on the old public topics are the second dependency. Per `rollout.md` — "If a global setting conflicts with another live consumer, report the concrete dependency before changing it and keep rollout completion open" — the setting is left as is and the row stays open.

**Not verified in this session:** the hosted project's actual "Allow public access to channels" value. `mcp__supabase__get_project` for `xojempkrugifnaveqtqc` returns id/region/status/database only and exposes no Realtime settings; no dashboard or management-API read was performed. The value is therefore recorded as *unread*, not as *Enabled*, even though Enabled is the documented default. The migration is likewise not yet applied to the hosted project — it ships through `.github/workflows/deploy.yml`.

**Harness note.** `realtime.setAuth(token)` with an explicit token puts realtime-js into manual-token mode (`_manuallySetToken`), where it stops re-installing the token on a reconnect; a re-join of a private topic is then refused as Unauthorized regardless of how long the client waits. Session-based clients — the mode the app uses — re-join cleanly. The Playwright spec builds every identity the app's way for this reason; the effect is a property of the harness, not of these policies.

## Verification

**Commands:**
- `npm ci` — expected: exit 0; `node_modules/` is absent in this worktree and every later command needs it.
- `supabase start && supabase db reset && supabase test db` — expected: all pgTAP files pass, including the new `23_couple_broadcast_policies.sql`.
- `npm run test:unit` — expected: green, with the new `broadcastSchemas` cases and every pre-existing queue/refcount/retry case still passing.
- `npx playwright test tests/api/couple-broadcast-authorization.spec.ts` — expected: partner delivery passes, every outsider/anon join and send is denied.
- `npm run lint && npm run typecheck` — expected: 0 errors (3 pre-existing warnings in `EventCountdown.tsx` are baseline).
- `fnox exec -- npm run build` — expected: exit 0.

**Manual checks (if no CLI):**
- `psql` (or Supabase MCP `execute_sql`) `select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'realtime' and tablename = 'messages'` — expected: six rows, the two new ones `{authenticated}` with the text comparison in `qual`/`with_check`.
- Open two browsers signed in as linked partners: send a note with an image and log a multi-mood; both arrive, the image resolves through the signed Storage URL, and no request is made to any non-Supabase host.

## Auto Run Result

Status: done

**Summary:** A follow-up review pass over the shipped story. Four review layers reported 40 findings; verification confirmed six root-cause entries worth fixing and refuted or rejected the rest. The fixes are all hardening of the evidence and the wire contract, not changes to the security design: the pgTAP file now pins the clause that actually scopes both RLS policies, the mood wire schema bounds `note` to its DB range, two stale doc comments and one dead assignment are cleared, and two coverage holes that let a real regression ship green are now pinned by tests.

**Files changed this pass:**
- `supabase/tests/database/23_couple_broadcast_policies.sql` — three assertions added (plan 7 → 10): the `love-notes:%` / `mood-updates:%` prefix guard in both `qual` and `with_check`, and that both policies are PERMISSIVE.
- `src/api/validation/broadcastSchemas.ts` — `MoodBroadcastSchema.note` bounded to `z.string().max(500).nullable()`, matching `moods_note_check`.
- `src/api/moodSyncService.ts` — the dead second `entry.partnerId = null` in `refreshChannelIdentity` removed.
- `src/api/ephemeralBroadcast.ts` — two doc comments that still described the deleted `subscribe()` send corrected.
- `tests/unit/api/moodSyncSubscription.test.ts` — new case: a later subscriber re-arms a snapshot a failed refresh had nulled.
- `tests/unit/api/moodSyncService.test.ts` — new round-trip case: what `broadcastMoodToPartner` puts on the wire is fed through `parseMoodBroadcast`.
- `tests/unit/api/broadcastSchemas.test.ts` — new case: a mood note at 500 accepted, at 501 dropped.

**Review findings:** 40 reported — 8 rows patched across 6 root-cause entries (2 medium, 4 low), 4 rows deferred across 1 new entry plus 3 carried, 28 rejected. The 9 `false` verdicts were refuted against the code or the SDK: `setAuth()` has no rejection path (`RealtimeClient.js:384-398`, `:484-492`), so neither the orphan-channel nor the three uncaught-path claims reach their bad outcome; a denied private re-join is retried by Phoenix's own `rejoinTimer` rather than abandoned; a legitimate null `created_at` is unreachable given the column default and `MoodInsertSchema`; `review_loop_iteration: 0` is the workflow's own reset for a follow-up dispatch; and the send-surface, timeout-surface and "setAuth before subscribe" claims are carried refutations from the first pass. The rejected `low` findings are recorded row by row with what made each not worth fixing — chiefly that the fix would edit this build's spec, that the claim describes a deliberate rollout boundary the intent itself draws, or that the smallest fix adds a generation counter, a regex guard or duplicated live-Realtime surface for a defect not reachable in everyday use.

**Follow-up review recommendation:** false. This was itself a follow-up pass and it patched no `high`; the two `medium` entries were both evidence gaps (an unpinned policy clause, an unpinned producer/consumer contract), each now closed by a test whose red state was reproduced against the exact mutation the reviewer described. Patched counts by verdict: medium 2 entries, low 4 entries, high 0.

**Verification performed:**
- `supabase test db`: 24 files, **254** pgTAP tests, PASS (251 before; +3 from the new assertions).
- `npm run test:unit`: 110 files, **2001** tests pass (1998 before; +3 new cases).
- `npx playwright test tests/api/couple-broadcast-authorization.spec.ts`: 6 passed.
- `npm run lint`: 0 errors (3 pre-existing `EventCountdown.tsx` warnings). `npm run typecheck`: clean. `fnox exec -- npm run build`: exit 0.
- Red-then-green reproduced for all three new test surfaces: commenting out `moodSyncService.ts:632` fails only the new re-arm case; deleting `note: mood.note` from the producer fails only the new round-trip case; and recreating the receive policy without its prefix clause (in a rolled-back transaction against the running stack) leaves the three pre-existing `strpos` assertions true while the new prefix assertion goes false.

**Residual risks:**
- Unchanged from the first pass: the rollout row stays open (the hosted "Allow public access to channels" setting is still Enabled and `src/api/interactionService.ts:251` still depends on it), and installed PWA builds on the old public topics stop exchanging notes and moods with an updated partner until they update.
- One new deferred item: a transient `getSession` failure is indistinguishable from an account change and would mute the mood channel until a fresh subscriber attaches. Not shown reachable — the refresh runs only moments after the same session authorized the private join — and recorded with what would settle it.
- The `entry.partnerId = partnerIdAtJoin` clobber window is real but left in place: it needs an unlink concurrent with a mount, and RLS denies an ex-partner's send regardless, so the snapshot is defence in depth rather than the gate.
