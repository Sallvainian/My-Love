---
title: 'Needs-a-connection handling everywhere else'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: '0d917e88164895291eef215218d20f50915711be'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Offline, several writes still send requests, fail late with generic or misleading text ("Not authenticated", "Failed to delete photo", a raw "TypeError: Failed to fetch"), or briefly change the screen. Custom-message forms hide an up-front refusal behind "try again", and the custom-messages editor has no offline indicator (story 11, CAP-4, CAP-8).

**Approach:** Check `navigator.onLine` before each write listed below, before any request or local change. Show the existing wording, "You are offline. <what> need(s) a connection to <action>.", where that control already reports errors. Add the offline indicator to the custom-messages editor.

## Boundaries & Constraints

**Always:** The refusal comes before any request, including `auth.getUser()`, and before any optimistic change. Controls stay enabled offline, so a tap shows the message. A refused or failed note keeps its text and picture in the composer, and every failure shows exactly one message, never two and never none. Build messages with one helper beside `requireOnline` in `accountDataError.ts`. Online behaviour stays the same.

**Never:** No offline partner-search message, because it is a read (decision 2026-09-24). No queueing of these writes. No change to text-note queueing or the mood queue. No offline indicator on login, sign-up name, loading or welcome. No disabled buttons. No new IndexedDB store, migration or Realtime channel. Never link, unlink or seed a real `partner_requests` row in E2E.

## I/O & Edge-Case Matrix

All rows assume offline and the screen loaded online first. The message is the "You are offline. …" sentence. Every row sends no Supabase request and leaves the data on screen unchanged.

| Control | Message (after "You are offline. ") | Shown in |
|---|---|---|
| Photo upload | Photos need a connection to upload. | `photo-upload-error` |
| Photo delete | Photos need a connection to delete. | `photo-viewer-delete-error`; dialog stays open |
| Display name save | Name changes need a connection to save. | DisplayNameSetup inline error; row unchanged |
| Partner request send / accept / decline | Partner requests need a connection to send / accept / decline. | `partner-connection-error` |
| Poke or kiss badge tap | A poke / kiss needs a connection to be marked as seen. | Toast. The animation still plays and the badge stays. |
| Retry failed picture note | Notes with a picture need a connection to send. | Love-notes banner. The note stays failed. |
| Remove note | Love notes need a connection to remove. | Removal dialog. The note never leaves the list. |
| Send picture note | Notes with a picture need a connection to send. | Banner only. The composer keeps the text and picture and shows no "Failed to send". A failed save to the offline queue still shows "Failed to send. Try again." |
| Thread load or text send with no partner loaded | Love notes need a connection to load / send. | Banner, instead of the raw lookup reason. Refused before the partner lookup. A text send keeps the typed text. |
| Scroll up for older notes | — | No request and no per-scroll error; the app-wide offline indicator is the message. The notes on screen stay, and older ones load on the next scroll once back online. |
| Custom message create / edit / delete / import | Custom messages need a connection to save. | Form error, dialog error, or import alert. Import no longer blames the file. |
| Open custom-messages editor | — | Offline indicator visible |

</frozen-after-approval>

## Code Map

- `src/services/accountDataError.ts` — `requireOnline` (:38). Add the message helper, widen `action`, and make `requireOnline` use the helper. Its current output must not change. `requireOnline` hard-codes "need" (:40); the helper also takes "needs", for the poke/kiss row.
- `src/components/PhotoUpload/PhotoUpload.tsx:81-115` — `handleUpload`. Guard before `setStep('uploading')` (:85), which comes before compressing (:98), and reuse the `setError`/'error' step.
- `src/components/PhotoGallery/PhotoViewer.tsx:416-459` — `handleDeleteConfirm`. Guard before the slice call. The online text 'Failed to delete photo. Please try again.' stays.
- `src/components/DisplayNameSetup/DisplayNameSetup.tsx:100-164` — guard before `getUser()`. The catch at :164 shows `err.message`.
- `src/api/partnerService.ts` — send :195, accept :333, decline :361. Guard at the top of each, outside any try that rewraps the error. `PartnerMoodView.tsx:283-332` shows `err.message`.
- `src/components/PokeKissInterface/PokeKissInterface.tsx:271-286` — `handleAnimationComplete`. Guard before `markInteractionViewed` (:275), keeping the `finally` cleanup. Sibling toasts are at :176 and :212.
- `src/stores/slices/notesSlice.ts`:
  - `IMAGE_NOTE_NEEDS_CONNECTION` (:127): change it to the new wording.
  - `knownOffline()` (:147): reuse it.
  - `NoteNotAcceptedError` (:133) is not exported and is thrown for two things: the offline picture refusal (:1195-1197) and a failed save to the offline queue (:1164). Add an exported subclass for offline refusals only, thrown by the picture refusal and the no-partner text refusal below. The slice's existing rethrow (:1382) still passes it on.
  - `retryFailedMessage` (:1396): an image note, offline, sets `notesError` and returns without throwing, before `getPartnerId` (:1442). `onRetry` has no catch.
  - `removeNote` (:1605): throw before the optimistic removal (:1643-1644).
  - Text `sendNote`: the lookup (:1151) runs only when no partner is loaded (:1149). Before it, when `knownOffline()`, set `notesError` to the offline wording and throw the offline-refusal error, so no request goes out and the composer keeps the text. Today this path sets `notesError` and resolves (:1386-1387), so the composer clears the draft (`MessageInput.tsx:139-142`).
  - `fetchOlderNotes` (:933): after the loading/`notesHasMore` check (:937-939) and before `notesIsLoading` is raised, return when `knownOffline()`, leaving `notesHasMore` unchanged. Today it looks up the partner (:960) and queries `love_notes_visible` on every scroll, and the failure is silent while notes are on screen (`keepThreadClear`).
  - `fetchNotes`: inside `serverRequest`, before `lookupPartnerId()` (:779), when `knownOffline()` throw with the offline wording, so no request goes out. The saved thread still shows, and the banner shows only on an empty thread (`keepThreadClear`, :921).
- `src/components/love-notes/MessageInput.tsx:145-149` — skip the generic 'Failed to send. Try again.' only for the offline-refusal subclass. A failed queue save keeps it: `notesSlice.offlineQueue.test.ts:818` pins that it is the only message shown.
- `src/components/AdminPanel/` — `CreateMessageForm.tsx:65`, `EditMessageForm.tsx:64`, `DeleteConfirmDialog.tsx:37` (`catch {}`) and `AdminPanel.tsx:79-82` (import alert): show `err.message` for `AccountDataError` with code `offline`. `AdminPanel` renders `<NetworkStatusIndicator showOnlyWhenOffline />` (from `../shared`) under its header (:94-97). App returns it early at `App.tsx:678`, outside the shell's indicator (:732). `tests/unit/config/styleKitSweep.test.ts:58-67` pins palette-shade counts per `AdminPanel/` file, so a new styled error element there means updating those counts in the same change.
- Existing tests to update where they pin old offline text: `tests/unit/stores/notesSlice.localCopy.test.ts:798-814` (raw "TypeError: Failed to fetch") and `notesSlice.offlineQueue.test.ts:836-843` (uses the constant). Online-failure tests stay as they are.
- E2E idioms, from `tests/e2e/offline/photos-offline.spec.ts`:
  - `test.use({ trace: 'off', video: 'off' })`
  - a local `goOffline` helper (:101), reset in `finally`
  - `supabaseAdmin` seeding with cleanup by id
  - the `lastWelcomeView` `beforeEach` (:205)
- E2E partner requests: the pool has only linked pairs. Fake an unlinked user with `interceptNetworkCall`, as `tests/e2e/partner/partner-kit.spec.ts:189-201` and `partner-mood.spec.ts:50-80` do, using uuid-shaped ids. Those only fake an empty request list, so also fake a pending incoming request and the sender lookup it triggers (`users?select=id,email,display_name&id=in.(…)`, `partnerService.ts:268-291`). Fake the search results for Send too (`:160-164`), so a regressed guard can never insert a real `partner_requests` row.
- E2E no-partner row: pool users are always linked and the partner loads from the saved copy, so cover this row with unit tests and say so in the E2E spec. The older-notes row needs a thread longer than one page (`NOTES_PAGE_SIZE`); cover it with unit tests too.
- E2E custom messages: the editor is at `page.goto('/admin')`, with test ids in `tests/e2e/account-data/cross-device.spec.ts:90-98`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/accountDataError.ts` — add the message helper and widen `action` — one wording source.
- [ ] `PhotoUpload.tsx`, `PhotoViewer.tsx`, `DisplayNameSetup.tsx`, `partnerService.ts`, `PokeKissInterface.tsx` — add the up-front guards from the matrix.
- [ ] `notesSlice.ts`, `MessageInput.tsx` — handle the retry, remove, picture-send and no-partner rows.
- [ ] `CreateMessageForm.tsx`, `EditMessageForm.tsx`, `DeleteConfirmDialog.tsx`, `AdminPanel.tsx` — surface the offline message and add the indicator.
- [ ] Unit tests beside the existing ones:
  - the helper
  - each guard: offline gives the message, and the write function is not called
  - notes retry, remove and no-partner (load and text send: no lookup, draft kept)
  - older notes offline: no lookup or query, notes and `notesHasMore` unchanged
  - the picture refusal skips the composer's generic error; a failed queue save still shows it
  - the AdminPanel offline message and indicator

  Update the two pinned notes tests, and `styleKitSweep.test.ts` if the Admin files gain styled elements.
- [ ] `tests/e2e/offline/needs-a-connection.spec.ts` — for each matrix row except no-partner and older notes: load online, go offline, tap, then assert the message, zero Supabase requests and unchanged data. Also assert the editor's indicator.

**Acceptance Criteria:**
- Given any matrix control and a device back online, when it is used again, then it behaves as it did before this change.
- Given `npm run lint`, `npm run typecheck` and `npm run test:unit`, when they run, then all pass.

## Spec Change Log

- 2026-09-24, before implementation. Trigger: a pre-build check of the spec against the code. Amended, with the user's approval of the frozen changes: the picture and no-partner matrix rows and one Always rule (refuse before the partner lookup; keep the draft; exactly one message per failure); Code Map line numbers (PhotoUpload, removeNote, App.tsx), the offline-refusal error subclass, the helper's need/needs form, the partner-request fakes, `styleKitSweep.test.ts`, and the no-partner row's unit-only coverage. Known-bad state avoided: a lookup request on the no-partner row, a cleared draft, and a silent failed queue save.
- 2026-09-24, before implementation. Trigger: the same check found `fetchOlderNotes` querying the server on every offline scroll. Amended, with the user's approval: a new matrix row for older notes, its Code Map entry and unit test. Known-bad state avoided: repeated failing requests while offline.

## Design Notes

Count requests from `page.on('request')`, armed after `setOffline(true)`, just before the tap. Count only URLs under the local Supabase origin on `/rest/v1`, `/storage/v1`, `/auth/v1` or `/functions/v1`, and assert zero. Offline requests still fire the `request` event, so a leak shows up. Background reads such as refreshers do not run without an `online` event, but if one does, narrow the filter to the write's own path and method, and state that in the test.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm run test:unit` — expected: pass.
- `supabase start`, then `npx playwright test tests/e2e/offline/needs-a-connection.spec.ts` — expected: pass.

## Review Triage Log

| # | Lens | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | blind-hunter | Offline `fetchOlderNotes` early return strands the infinite loader, so older notes never load on the next scroll after reconnect | medium | patch | `react-window-infinite-loader` 2.0.1 memoizes its requested-row `Set` on `[isRowLoaded, loadMoreRows]`, and `MessageList.tsx:226-243` changes neither when the early return leaves `notesIsLoading`, `notesHasMore` and `notes.length` untouched. Before the change the loading flag toggled and reset the Set. Violates the matrix row "older ones load on the next scroll once back online". |
| 2 | blind-hunter | Rewriting the localCopy no-partner test dropped the only coverage of an online send whose lookup returns `error` | low | patch | The remaining `status: 'error'` lookups (`notesSlice.offlineQueue.test.ts:365,408`) are drain/reload tests. Nothing now pins `notesError` carrying the lookup reason for an online send. |
| 3 | blind-hunter | `requireOnline` doc still says `what` completes "… need a connection to save." although `action` is now widened | low | patch | `accountDataError.ts` doc comment above `requireOnline`: a direct correction. The claimed grammar footgun in `offlineMessage` is false: every call site pairs subject and verb correctly. |
| 4 | blind-hunter | Guards sit in components, not the store/service | false | reject | The spec's Code Map puts them in `handleUpload`, `handleDeleteConfirm`, DisplayNameSetup and `handleAnimationComplete`. `uploadPhoto`, `deletePhoto` and `markInteractionViewed` each have one caller (`PhotoUpload.tsx:122`, `PhotoViewer.tsx:447`, `PokeKissInterface.tsx:289`), so no caller goes unguarded. |
| 5 | blind-hunter | Hand-written offline sentences remain outside the helper (PokeKiss send toasts, interaction and events services) | low | defer | Pre-existing strings, all in the same format today. Drift risk only. |
| 6 | blind-hunter | E2E watcher omits `/realtime/v1` | false | reject | A note broadcast is sent only after its write succeeds, and that write is a counted `/rest/v1` or `/functions/v1` request, so a leak is seen before any broadcast. |
| 7 | blind-hunter | Offline messages stay up after reconnect | low | reject | Same as every existing online error on these surfaces. The fix adds `online` listeners to six components. |
| 8 | blind-hunter, edge-case-hunter | A second identical offline delete refusal neither re-announces nor refocuses | low | reject | Real (identical `setDeleteError` string is a no-op), but the message stays visible and the fix needs an attempt counter. |
| 9 | blind-hunter | Expected offline refusals are logged with `console.error` | low | reject | Offline loads and sends already failed and logged before the change. Log level only. |
| 10 | blind-hunter | Three shapes of offline error | false | reject | Each surface handles the shape it receives: the removal dialog shows `err.message` (`NoteRemoveConfirmation.tsx:148`), MessageInput checks the spec-mandated subclass, and AdminPanel checks `AccountDataError`. No caller mis-handles one. |
| 11 | blind-hunter | Offline Retry at the rate limit gets the rate-limit error first; Retry has no catch | low | reject | Needs being offline and at 10 messages per minute at once. The missing catch pre-dates this change, and reordering adds branches. |
| 12 | blind-hunter | Partner search has no offline message | false | reject | Excluded by the frozen Never rule (decision 2026-09-24). |
| 13 | blind-hunter | Onboarding DisplayNameSetup has no offline indicator | false | reject | Excluded by the frozen Never rule ("sign-up name"). |
| 14 | blind-hunter | No test that offline Retry → online Upload reuses the key and file | false | reject | The key is set only on file selection (`PhotoUpload.tsx:74`) and cleared only on close (`:145`); the offline path touches neither, and the unit test checks Retry returns to the same preview. |
| 15 | blind-hunter | New toast copies the untracked-timer race | low | reject | Existing pattern in the component (`:176`, `:212`). The fix adds a timer ref and cleanup. |
| 16 | edge-case-hunter | Offline mid-import leaves earlier rows saved but not shown | low | defer | Pre-existing: the store is reloaded only on success. This change altered only the alert text. The rows appear on the next refresh. |
| 17 | edge-case-hunter | Offline edit or delete of a row without `serverId` shows the generic error | false | reject | Such a row is refused online too (`customMessageService.ts:363`, "not in the account"), so the connection is not what blocks it and the offline sentence would mislead. |
| 18 | edge-case-hunter, intent-alignment | E2E skips GETs on four screens, so a leaked `getUser` or partner lookup passes E2E | low | reject | Design Notes sanction narrowing and the spec header states it. Unit tests pin those reads: `partnerService.check.test.tsx` asserts no `getUser`, and the notes tests assert no `getPartnerId` or `lookupPartnerId`. |
| 19 | intent-alignment | Reads guarded too; no-partner and older-notes rows unit-only; custom-message unit tests inject the refusal; partner DB check cannot fail; badge count only unit-checked | false | reject | All spec-directed. The matrix includes the load and older-notes rows, the Code Map makes the two rows unit-only, and the real custom-message refusal is covered end to end. |
