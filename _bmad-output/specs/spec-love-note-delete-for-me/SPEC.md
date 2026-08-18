---
id: SPEC-love-note-delete-for-me
companions: []
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Delete a Love Note for Me Only

## Why

A pain to solve. The Love Notes thread (Notes tab) is append-only in practice: `love_notes` carries exactly two policies today — `"Users can insert their own messages"` (INSERT) and `"Users can view their own messages"` (SELECT) at `supabase/migrations/20251206024345_remote_schema.sql:246,255` — and the original `"Users can delete own notes"` policy was dropped at `:7` and never recreated. A user with a typo, an image they would rather stop scrolling past, or a painful exchange has no way to clear it from their own history. The obvious fix is the wrong one: the thread is a single shared row set, so any delete that touched the row would rewrite the partner's memories too. In a two-person relationship app that is not an acceptable side effect — one person must not be able to edit what the other remembers. What is needed is a per-user hide: the message leaves the deleting user's history and stays exactly as it was in the partner's.

## Capabilities

- **CAP-1**
  - **intent:** A user can remove any message in their Love Notes thread — one they sent or one they received — from their own history.
  - **success:** The message leaves the acting session's thread as soon as the removal is confirmed, with no reload and no manual refetch, and is still absent after a reload; a fetch of the same conversation over the same time range as the partner still returns that message with unchanged `content` and `image_url`.

- **CAP-2**
  - **intent:** A removal is bound to the user's account rather than the device it was performed on.
  - **success:** Hide a message on client A, then sign in fresh on client B: the thread returned to B omits that message, with no local state carried between the two.

- **CAP-3**
  - **intent:** The partner's copy of a hidden message survives intact, including any attached image.
  - **success:** After the deleting user hides a note carrying an image, the partner can still open that note's full-size image; the storage object is still present.

- **CAP-4**
  - **intent:** Infinite scroll and the end-of-history indicator reflect the thread the user can actually see, not the raw row count.
  - **success:** With messages hidden inside a paged range, a page request still yields up to `PAGE_SIZE` (50, `src/config/images.ts:67`) visible messages, and `notesHasMore` becomes false only when no visible older message remains.

- **CAP-5**
  - **intent:** A user confirms the removal before it takes effect, so a mistaken tap does not cost a message.
  - **success:** Invoking removal on a message opens a confirmation; dismissing or cancelling it leaves the message in the thread untouched; only the confirming action removes it.

## Constraints

- The removal cannot be a column on `love_notes`. `supabase/migrations/20260727000000_love_notes_idempotency.sql:15-19` records the standing decision: `"Deliberately NOT paired with an UPDATE policy. love_notes grants only INSERT and SELECT, …"`, because `"Adding UPDATE purely to support merge-duplicates would also let a user edit notes they had already sent."` The removal record belongs in its own per-user table.
- The new table must `ENABLE ROW LEVEL SECURITY` in the same migration that creates it. `supabase/migrations/20260725170000_grant_api_roles_on_public.sql:35` runs `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;` and `:40-41` extends that to future tables via `ALTER DEFAULT PRIVILEGES`, so a new `public` table without RLS is readable and writable by every authenticated user.
- A removal row is writable and readable only by its owning `auth.uid()`, and only for a `love_notes` row that owner is a party to — `auth.uid()` equal to the note's `from_user_id` or `to_user_id`, mirroring `"Users can view their own messages"` (`supabase/migrations/20251206024345_remote_schema.sql:255-260`).
- Removed messages must be excluded server-side, before the `LIMIT`, on **both** read paths — they are separate queries with separate flags. `fetchNotes` queries at `src/stores/slices/notesSlice.ts:209-216` and sets `notesHasMore` at `:236`; `fetchOlderNotes` queries at `:288-295` and sets it at `:318`. Both derive the flag as `(data?.length || 0) === limit`, so filtering after the response shrinks pages and makes the flag lie.
- The replacement read path must not widen who can read a note. A view must declare `security_invoker = true`; an RPC must not be `SECURITY DEFINER` over `love_notes`. The existing SELECT restriction — a note is visible only to its sender or recipient — must still hold for a third party through the new path, and needs a pgTAP case asserting they get zero rows.
- The removal path must never reach `deleteLoveNoteImage` (`src/services/loveNoteImageService.ts:302`), which calls `supabase.storage.from(BUCKET_NAME).remove([storagePath])`. The uploader holds a matching storage DELETE policy (`"Users delete own love note images"`, `supabase/migrations/20251205000001_add_love_notes_images.sql:45`), and the notes store already calls it from `discardOrphanedImage()` at `src/stores/slices/notesSlice.ts:72` — so destroying the object is reachable from this very file and would break CAP-3.
- No storage policy may be added, renamed or dropped. `supabase/tests/database/16_photos_storage_update_policy.sql:17-32` asserts with `policies_are` that `storage.objects` carries exactly nine named policies. The `public` schema is clear by contrast: `supabase/tests/database/02_rls_policies.sql:70-92` asserts `policies_are` only for the five `scripture_*` tables, so a new table's policies and a replacement `love_notes` read path need no edit to an existing pgTAP file.
- Removing the same message twice must converge on one row. `(user_id, note_id)` is the natural key — a DB `UNIQUE` on that pair with `.upsert(…, { onConflict: 'user_id,note_id', ignoreDuplicates: true })`. No client-generated key is needed here: unlike the `love_notes` send path, the row being referenced already has a server id.
- No Realtime work is introduced. *Live* cross-session propagation is the non-goal — a removal reaches the user's other sessions on their next fetch — so this feature adds no channel, no broadcast, and no `PERFORM realtime.send()` in an RPC.
- The affordance is offered only for a note the client holds as a stored server row, identified by the absence of `tempId`. An optimistic note's `id` *is* the temp string (`src/stores/slices/notesSlice.ts:416` builds `` `temp-${Date.now()}-…` `` and `:434` assigns `id: tempId`), and a failed send keeps it — `:509-511` sets `error: true` without replacing the id. Both states are excluded; writing a `temp-…` string into the table's UUID reference would fail.
- The affordance must add no layout height to the message bubble, or `calculateRowHeight` (`src/components/love-notes/MessageList.tsx:155-182`) must be updated in the same change — it hand-computes each row's pixels from content length and image presence, and `react-window` positions rows from its return value. Any menu or popover must render outside the virtualized scroll container rather than inside a row.
- When a removal empties the loaded window while `notesHasMore` is still true, the store must refill from the server before the list renders. `src/components/love-notes/MessageList.tsx:335` early-returns the empty state on `!isLoading && notes.length === 0` — before the `<List>` whose `onRowsRendered` is the only thing that ever calls `onLoadMore` — so an emptied window would strand the user on an empty screen with unread history behind it.
- The empty state reached by removing every visible message must not assert the conversation never happened; the existing copy `"No love notes yet"` (`src/components/love-notes/MessageList.tsx:346`) is false in that case.
- Any account-scoped store field this adds must be reset in `signedOutState()` in `authSlice.ts` in the same commit; a partial reset leaks the previous couple's data on a shared device.
- Any store action that `set()`s after an `await` must first re-check the captured user id and bail, clearing any loading flag it set — as `fetchNotes` does at `src/stores/slices/notesSlice.ts:228-231` (`if (get().userId !== userId) { set({ notesIsLoading: false }); return; }`) and `fetchOlderNotes` at `:308-311`.

## Non-goals

- No un-send and no delete-for-both. The partner's copy is never altered or removed, whoever sent the message.
- No editing of message content — the standing reason `love_notes` has no UPDATE policy.
- No bulk operation: no "clear conversation", no date-range purge, no per-sender sweep.
- No destruction of the underlying row. The message is unreachable for the removing user, but the row survives because it *is* the partner's copy — the two are the same row. This is not a data-retention or right-to-erasure feature, and it does not scrub the message from backups.
- No delete for any other history: the daily-message 30-day back-navigation (`MessageHistory`, `src/types/index.ts:107-116`), mood entries, photos, partner interactions, and `scripture_messages` are all out of scope.
- No undo and no restore. Removal is one-way: there is no undo window, no hidden-messages archive, and no way to bring a removed message back into the user's own thread. The confirmation step in CAP-5 is the only guard against a mistaken tap.
- No live propagation to the user's *other* sessions. The acting session updates immediately (CAP-1); a different session already showing the message keeps showing it until it refetches.
- No removal of a message still in flight — see the optimistic-state constraint above.
- No new view. This adds no entry to `ViewType`/`pathMap`, no `App.tsx` render branch, and no tab in `BottomNavigation.tsx`.

## Success signal

A user removes a message from their Notes thread on their phone and it is gone; they open the app on their laptop later and it is still gone there. Their partner opens the same conversation on their own device and the message is exactly where it always was, image and all — with no way to tell anything happened.

## Assumptions

- The affordance hangs off the individual message bubble. `src/components/love-notes/LoveNoteMessage.tsx` has two buttons today — the image tap target (`:253-266`) and retry (`:296-303`) — and no long-press or context-menu pattern to extend, so the interaction is being introduced rather than reused. The exact gesture is left to implementation; CAP-5 is written so it can be tested whichever is chosen.
- The confirmation in CAP-5 follows the existing `src/components/PhotoDeleteConfirmation/` pattern rather than a native `confirm()`.
- Exact copy for the all-messages-removed empty state is left to implementation, subject to the constraint that it must not be false.
