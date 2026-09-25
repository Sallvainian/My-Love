---
title: 'Love-note text saved offline and sent later'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: '7cfee5c42cc1355699d209b8e8f72ac2ea0769b3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A love note can only be sent online. Offline, `sendNote` calls `getPartnerId()`, which returns null, so the note is refused with "Partner not configured" (CAP-3). A failed note that is resent never reaches the partner live, because `retryFailedMessage` sends no broadcast.

**Approach:** Every text-only note goes into a persistent per-account queue in a new IndexedDB store before it is sent. It shows at once as pending, and a drain sends the queue in order, reusing the note's `tempId` as `idempotency_key`. The drain runs right after each enqueue, on app start, on the `online` event and on the 5-minute interval, next to `syncPendingMoods`. A note with a picture keeps today's direct path and is refused offline. A successful resend of any note now broadcasts to the partner.

## Boundaries & Constraints

**Always:**
- The queue is a new store, `note-queue`, created in `src/services/dbSchema.ts` only: `DB_VERSION` 14, existence-gated, keyPath `id`, with a `by-user` index. Each row is plain data: `{ id: tempId, userId, toUserId, content, createdAt, failed }`.
- `toUserId` comes from `get().partner?.id`. When `partner` is not loaded, it comes from `lookupPartnerId()`: `unlinked` is refused with "Partner not configured", as today, and `error` is refused with its reason. A queued note is never sent after a fresh partner lookup.
- The drain:
  - takes `withSyncLock('my-love:note-queue')` and sends only the signed-in account's rows, oldest `createdAt` first;
  - re-reads the queue after each row, so a note enqueued during a run is still sent;
  - captures `{ userId, authSessionVersion }` and re-checks both before each insert and each state write.
- After a confirmed insert:
  - delete the row, even if the session has changed, because the note is committed;
  - replace the optimistic note through `confirmOptimisticNote`;
  - save the copy only if that note was in state, so a drain before the thread is loaded never writes `[]` over the copy;
  - broadcast to `love-notes:${toUserId}` only while the same `userId` is signed in.
- Failure rules:
  - A server rejection (a Postgrest error whose code is a SQLSTATE, not `PGRST…`) marks the row `failed`. The note shows today's "Failed to send · Tap to retry", `23514` sets `notesError` as today, and the drain moves on to the next row.
  - Any other failure leaves the row pending and stops the run. The next trigger retries it.
- Retry of a failed queued note clears `failed` and drains. Removing a failed queued note deletes its row.
- `fetchNotes` adds the account's queued rows to the thread, before its server await, as unconfirmed notes, so they show after a reload even offline. It skips a row whose `tempId` is already on screen or whose `idempotency_key` is in the server page.
- Queued notes never go into the `love-notes` copy. `isConfirmedNote` already excludes any note with a `tempId`.
- Sign-out keeps queue rows (CAP-7). `deleteAccountData` does not touch `note-queue`.
- A failed enqueue throws from `sendNote`, so `MessageInput` keeps the text and shows its error.

**Never:**
- No offline image note. Offline (`navigator.onLine === false`), an image note is refused with `notesError` "A note with a picture needs a connection" before anything is shown or uploaded.
- No DB migration: the server assigns `created_at` at insert.
- No new refresher, no Realtime channel change, no Zustand persist change, and no new slice state. A client-only `queued` flag on `LoveNote` is allowed.
- No service-worker Background Sync for notes.
- No new offline notice. CAP-8 is story 11.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline text | Partner loaded; offline; send three notes | All three show at once as "Waiting to send", in order | N/A |
| Reconnect | Three queued notes; `online` fires | Sent in order, each once; state and copy hold the confirmed rows; each is broadcast | A network failure stops the run; the rows stay pending |
| Reload while queued | Queued rows; reload with no server answer | The notes show pending after the saved thread | N/A |
| Lost response | Insert commits, the reply is lost, then a retry | The same key resolves to the stored row; no duplicate | N/A |
| Server rejection | Insert answers `23514` | The row is marked failed, shows Retry and sets the banner; later rows still send | Retry resends under the same key |
| Online text | Online; send | Enqueued and drained at once; same look as today | N/A |
| Image offline | Offline; image note | Refused with the picture message; nothing shown or uploaded | N/A |
| Resend success | A failed note is retried and confirmed | The partner broadcast is sent | Broadcast failure is logged |
| Account switch | A has queued rows; A signs out and B signs in | B never sees or sends A's rows; they send when A signs back in | Rows kept |
| Two tabs | Both drain at once | The lock lets one run; each note is inserted once | N/A |

</frozen-after-approval>

## Code Map

- `src/stores/slices/notesSlice.ts`:
  - `sendNote` :733-930: text notes enqueue instead of getting a direct insert; image notes keep this path;
  - `retryFailedMessage` :937-1088: a queued note goes back through the drain; the image path adds the broadcast after its confirm, as in `sendNote` :900-917;
  - `fetchNotes` :375-530: merge the queued rows with the `unconfirmed` list at :466-478;
  - `removeFailedMessage` :1244-1257: also delete the queue row;
  - `insertNoteOnce` :254-281, `confirmOptimisticNote` :156-164 and `saveNotesCopy` :301-313: reuse all three.
- `src/services/noteQueue.ts` (new): `enqueueNote` (throws), `listQueuedNotes(userId)` (returns `[]` on failure, sorted by `createdAt` then `id`), `setQueuedNoteFailed(id, failed)` (throws) and `removeQueuedNote(id)` (throws). Document the queue rules in a module header. Open the DB the way `imageCache.ts` does.
- `src/services/dbSchema.ts:88-110, 150-176, 320-328`: add the schema type, the version comment, `STORE_NAMES.NOTE_QUEUE` and the v14 branch.
- `src/services/syncLock.ts`: `withSyncLock`. Add a `NOTE_QUEUE_LOCK` constant beside `MOOD_SYNC_LOCK`.
- `src/App.tsx:414-477`: call `drainQueuedNotes()` in `handleOnline`, in the mount sync and in the interval, next to `syncPendingMoods`.
- `src/types/models.ts:17-34`: add the client-only `queued?: boolean`.
- `src/components/love-notes/LoveNoteMessage.tsx:408-422`: show "Waiting to send" for `queued && !sending`. "Sending..." and the Retry button stay as they are.
- `src/api/errorHandlers.ts`: `isPostgrestError`, used to classify failures.
- `src/stores/slices/authSlice.ts:62-76`: `deleteAccountData` does not change. Its comment already says queued writes stay.
- The fake-session stubs need nothing: no refresher is added, and an empty queue makes no request. Check both specs still pass.
- Keep `tests/e2e/errors/check-error-path-consistency.spec.ts` DW38-E2E-001 green unchanged: send gets 400/CHECK, then Retry, then success, all with the same payload.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/dbSchema.ts`: add the `note-queue` store at v14, existence-gated.
- [x] `src/services/noteQueue.ts`: add the queue API and its header.
- [x] `src/services/syncLock.ts`: add `NOTE_QUEUE_LOCK`.
- [x] `src/stores/slices/notesSlice.ts`: route text notes through the queue, add the `drainQueuedNotes` action, merge the queue in `fetchNotes`, apply the retry and remove rules, add the resend broadcast and the offline image refusal, and update the header.
- [x] `src/types/models.ts` and `LoveNoteMessage.tsx`: add the `queued` flag and "Waiting to send".
- [x] `src/App.tsx`: add the three drain triggers.
- [x] Unit tests:
  - `tests/unit/services/noteQueue.test.ts` and the v14 case in `dbSchema.test.ts`, for fresh and existing databases;
  - `tests/unit/stores/notesSlice.offlineQueue.test.ts`, covering every matrix row plus the stale-session paths;
  - adjust existing notesSlice and component tests only where the text-send path legitimately changed.
- [x] `tests/e2e/offline/love-notes-offline-send.spec.ts`:
  1. Offline, send three notes and see them pending.
  2. Reload with the REST endpoint aborted and see them still pending.
  3. Go online. Via the service client, the partner's view has exactly three rows, in order.
  4. Delete those rows at teardown.
- [x] `AGENTS.md`: in the data-model pitfall, love-note text now queues offline. Make this a docs-only commit.

**Acceptance Criteria:**
- Given three notes sent offline, when the connection returns, then the partner's thread holds each once, in send order, with no reload needed on the sender's side.
- Given queued notes, when the app is reloaded and the queue drained twice (two triggers overlap), then no note is inserted twice.
- Given a failed image note, when Retry succeeds, then `sendEphemeralBroadcast` is called for the partner's topic.

## Design Notes

All text notes go through the queue, not only offline ones. That keeps one send path and one ordering guarantee: an online note sent directly would overtake notes still queued. The cost is that a transient network failure while online now shows the note as pending instead of failed. It retries by itself, which is CAP-3's intent. Server-assigned `created_at` means a queued note is timestamped at delivery. Order is still kept because the drain is sequential.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0
- `npx vitest run tests/unit src` -- expected: all pass
- `npx playwright test tests/e2e/offline tests/e2e/notes tests/e2e/auth tests/e2e/errors` (with `supabase start`) -- expected: all pass

## Implementation Notes

- The drain skips its run while `navigator.onLine === false` (no request that is certain to fail); the `online` event drains.
- Within one tab, a drain asked for while one runs joins it and makes it pass over the queue once more, so a note enqueued as a run finishes is not left for the next trigger. Cross-tab exclusion is `withSyncLock(NOTE_QUEUE_LOCK)`.
- Queued `createdAt` is strictly increasing per slice instance, so notes composed within one millisecond keep their order.
- A CHECK banner raised in a drain pass is not cleared by a later note confirmed in that same pass (it belongs to the note showing Retry); a later pass clears it as a successful send does today.
- The offline image refusal sets `notesError` and also throws, so `MessageInput` keeps the picture and text.
- Retry of a queued note whose row is missing re-enqueues it as composed, under the same key.
- `setQueuedNoteFailed` resolves whether the row existed.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | edge | A transient head-row failure (or a failed queue read) leaves later on-screen queued notes on "Sending..." | low | `drainOnce` reset `sending` only on `next.id`; `sendNote` sets `sending: true` online | patch |
| 2 | edge, blind | `isServerRejection` marks transient SQLSTATEs (08, 40, 53, 57, 55P03) as permanent failures | medium | Any 5-char non-PGRST code counted as a rejection | patch |
| 3 | verif-gap | Retry after the queue row is gone (re-enqueue branch) is untested | medium | Pre-verified: deleting the branch passes every test | patch |
| 4 | verif-gap | App drain triggers (start, `online`, interval) have no App-level test | medium | Pre-verified: grep finds no App test for `drainQueuedNotes` | patch |
| 5 | verif-gap | The lock-lost `settleWaitingNotes` path is untested | low | Pre-verified: the two-tabs test never reads `notes` | patch |
| 6 | blind | A server-rejected queued note cannot be dismissed in the UI and returns on every reload | low | No component calls `removeFailedMessage` (pre-existing); rejections are rare because `MessageInput` validates content first | defer |
| 7 | edge, blind | A persistent non-SQLSTATE error blocks the head of the queue with no Retry | low | Needs a persistent PGRST error on insert (e.g. a schema mismatch); fix adds attempt counting | reject |
| 8 | blind | Online network failure now shows "Waiting to send" and retries only on `online` or the 5-minute interval | low | Accepted in Design Notes | reject |
| 9 | edge, blind, verif-gap | The tab that lost the lock keeps "Waiting to send" for a note another tab delivered, until a refetch | low | Multi-tab only; fix adds cross-tab messaging | reject |
| 10 | edge, blind | A note enqueued after the lock-holding tab's last read waits for the next trigger | low | Millisecond window with two tabs; fix adds a blocking lock wait | reject |
| 11 | edge | A waiting (not failed) queued note cannot be cancelled | low | Same as today's "Sending..." notes; a new UI action | reject |
| 12 | edge | A failed queue delete plus an offline reload shows a sent note twice | low | Needs an IndexedDB delete failure; fix changes the copy shape | reject |
| 13 | edge | A Retry IndexedDB error rejects with no in-thread feedback | low | Needs an IndexedDB write failure; the button stays | reject |
| 14 | blind | Offline with no partner loaded shows the raw lookup reason | low | Partner is loaded from its local copy on start; wording is story 11 | reject |
| 15 | blind, verif-gap | An offline picture shows the banner plus the composer's generic "Failed to send. Try again." | low | Real double message; needs-a-connection wording is story 11 (CAP-4) | reject |
| 16 | blind | Queue rows never expire on a shared device | false | CAP-7 requires sign-out to keep queued writes | reject |
| 17 | blind | `lastQueuedAt` restarts per load, so a clock moved backwards reorders the queue | low | Needs a backwards clock change with notes queued across loads | reject |
| 18 | blind | The E2E checks rows via the admin client, not the partner's UI | low | Broadcast delivery is covered by unit tests | reject |
| 19 | blind | `idempotency_key` is not declared on `LoveNote` | low | Developer-only; two inline casts | reject |
| 20 | blind | AGENTS.md still names `notesSlice.sendNote` as a client-side broadcaster | false | `sendNote` still broadcasts image notes | reject |
| 21 | blind | The "Waiting to send" live region may not be announced | low | Same pattern as the existing "Sending..." span | reject |
