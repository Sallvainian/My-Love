# Finding Contracts

Paths are project-relative. F-numbers refer to the September 12 report; CAP-numbers preserve that mapping. Line numbers in the source report are navigation hints, not proof that a historical migration is still authoritative.

## Scope and evidence boundaries

| Disposition | Findings | Reason |
|---|---|---|
| Implement | F1, F2, F3, F4, F5, F8, F9, F10, F12, F13 | Ten findings outside scripture reading. |
| Excluded by Sallvain on 2026-09-12 | F6, F7, F11, F14, F15, F16, F17 | Scripture is planned for removal separately; do not repair it or claim it is already removed. |

The updated report preserves the original finding IDs and makes this exclusion depend on removal of the app surface, database objects and local caches (CAP-1, CAP-2 and CAP-5 of the separate removal plan). Hiding the screen does not satisfy that dependency. If removal lands first, recheck shared services, policies, generated types and tests against the resulting tree. There are three HIGH, six MEDIUM and one LOW findings in the active scope; one HIGH is credential exposure.

The report reviews revision `a48e4f56` and states its references also apply to `bae82495`, the HEAD observed during spec preparation. Its findings came from source inspection; no repository execution, exploit test or hosted Supabase check established them. The interrupted scan left unverified sites and did not audit `_bmad-output/`; completing this remediation does not establish that the whole application is secure.

The effective `public.users` SELECT policy admits self, linked partner and reverse partner-link rows through `get_my_partner_id()`. Stranger search does not enumerate users. F2–F4 therefore require a UUID learned elsewhere, such as a previous relationship or partner request. Preserve this boundary when changing policies.

## F1 / CAP-1 — Exposed bot credential (HIGH)

**Boundary and site:** `supabase/migrations/20260316031209_create_claude_bot_config.sql` seeds a plaintext password for a live bot account in public git history. RLS with no policies protects the config table, not migration source. The deployment workflow applies migrations to production.

The affected login is `claude-bot@test.example.com`, linked to `claude-bot-partner@test.example.com`; the seed fields are `test_email`, `test_password` and `partner_email`. These are target identifiers, not permission to rotate unrelated accounts.

**Required change:** Rotate the exposed password first. Update any actual bot consumers through fnox for local use and GitHub Secrets for CI; inspect consumers before deciding which variables are required. Remove live credential literals from the migration and replace the seeding path with explicit secret injection outside committed SQL. Preserve a working fresh database setup when those optional production bot credentials are absent. Never print either password, include it in test output, or copy it into this spec.

**Closure evidence:** Record a sanitized failed login with the old password and successful intended bot operation with the replacement; confirm existing sessions/refresh tokens are invalidated or document their remaining lifetime and required follow-up. Record source scanning by path/result without echoing matched values. A source-only edit cannot invalidate credentials already in git history. Do not rewrite git history in this story.

**Bounded impact:** The exposed identity is a test bot linked to another test bot; the report does not establish access to the owner's real couple data. It still supplies an authenticated foothold and exposes shared fixture state to corruption. Do not count a public anon key as a leaked server secret.

## F2 / CAP-2 — Love-note Realtime authorization (HIGH)

**Sites:** `src/hooks/useRealtimeMessages.ts`, `src/api/ephemeralBroadcast.ts`, `src/stores/slices/notesSlice.ts:addNote`, `src/components/love-notes/LoveNoteMessage.tsx`.

**Required change:** Both subscription and send use authenticated private `love-notes:<recipient UUID>` channels. Set Realtime auth before subscription. Add `realtime.messages` broadcast SELECT authorization for the recipient and INSERT authorization for that recipient's current partner, using `get_my_partner_id()` and exact topic matching. An unrelated authenticated user or anon client must not gain permission. A sender needs send permission, not blanket read permission across partner topics.

Validate incoming note shape and require `to_user_id` to match the current user and `from_user_id` to match the current partner before deduplication or insertion into state. Treat preview URLs received over the wire as untrusted: discard them. Locally created optimistic previews may use `blob:`; persisted images must resolve through the existing authorized Storage path and cannot cause arbitrary external-host requests. Keep legitimate text/image display and preview cleanup working.

**Regression evidence:** Exercise real private Realtime delivery between linked partners and rejected read/send attempts by an outsider and anon client. Send mismatched ids, malformed notes, duplicate ids and an attacker-host preview; none may enter state or cause an image request. Cover old public topic listeners, reconnect/auth refresh, sign-out during a queued send, overlapping sends and image-note delivery. Restore normal delivery after denied attempts.

## F3 / CAP-3 — Mood Realtime authorization and shape (HIGH)

**Sites:** `src/api/moodSyncService.ts`, `src/api/ephemeralBroadcast.ts`, `src/hooks/usePartnerMood.ts`, `src/components/MoodTracker/PartnerMoodDisplay.tsx`, `PartnerMoodView`'s MoodCard and `MoodHistoryItem.tsx`.

**Required change:** Apply the same directional private-channel authorization to `mood-updates:<recipient UUID>`. Parse wire data with `SupabaseMoodSchema.safeParse` before dispatch; retain a current-partner identity check. Replace all three unsafe mood-array render checks with `Array.isArray` guards. Correct the comment that Broadcast needs no RLS permissions.

**Regression evidence:** Prove linked delivery and denial for outsider/anon subscribers and publishers with actual Realtime. Non-array, unknown or otherwise invalid mood values must produce no state insertion, partner toast or render crash. Valid multi-mood updates still render. Cover the receiver guards separately from policy tests so malformed authorized traffic is also rejected.

**Shared F2/F3 invariants:** Keep `sendEphemeralBroadcast()` serialization, its claim-before-socket-wait ordering and awaited channel removal. Keep the mood registry's reference counting; changes must not let one consumer tear down another's subscription. Do not add scattered `supabase.channel()` calls or a public fallback after private authorization fails. Capture the account/recipient for queued work and discard stale work when identity changes.

## F4 / CAP-4 — Interaction recipients (MEDIUM)

**Sites:** `src/api/interactionService.ts:sendInteraction`, `src/utils/interactionValidation.ts`, `src/stores/slices/interactionsSlice.ts:addIncomingInteraction`; original policy in `20251206024345_remote_schema.sql`.

**Required change:** The INSERT boundary requires both caller-as-sender and current linked partner-as-recipient. Derive the target from the authenticated relationship rather than trusting a caller-supplied UUID. Reject incoming non-partner rows before changing history or `unviewedCount`; account for legitimate relationship loading without accepting unverified identities.

**Regression evidence:** Direct Data API/SQL-role tests reject self-targeting, stranger targeting, spoofed senders, missing partners and stale former-partner targets. A linked partner can send both interaction types, and one legitimate incoming row increments the badge once. Unit tests prove rejected incoming rows leave the feed and badge unchanged.

## F5 / CAP-5 — Interaction immutability (MEDIUM)

**Boundary:** The original UPDATE policy uses only recipient ownership. PostgreSQL reuses its USING expression when WITH CHECK is absent; adding the same recipient check does not make sender/type immutable.

**Required change:** Keep only `viewed` mutable for the receiving client. Evaluate narrow column privileges first; a BEFORE UPDATE trigger or a narrow mark-viewed RPC may enforce the invariant if grants cannot do so without disrupting the API. A trigger must compare OLD and NEW for immutable fields and must not become a definer function that turns every client into a privileged bypass.

**Regression evidence:** From a legitimate received interaction, permit the viewed update and reject changing sender, recipient, type, id or creation metadata, including a combined viewed-plus-forgery patch. Use this legitimate row to isolate F5 after F4 closes the report's self-insert setup path. Check both row visibility and persisted values; a silent zero-row update is not proof of column immutability.

## F8 / CAP-8 — Account-scoped custom messages (MEDIUM)

**Sites:** `src/services/customMessageService.ts`, inherited methods in `BaseIndexedDBService.ts`, `src/stores/slices/messagesSlice.ts`, `src/types/index.ts:Message`, `src/services/dbSchema.ts` and message validation/import types.

**Required change:** Persist immutable authenticated `userId` ownership for newly created/imported custom messages. Add a `by-user` index through the centralized IndexedDB upgrade. Apply ownership before data reaches application state, including list/filter/search, direct get, update/delete, clear/bulk operations, paging, rotation, duplicate detection and export. Inherited base methods cannot remain public ownership bypasses. Imported metadata cannot nominate a different owner; do not partition bundled public daily-message content as if it were private custom content.

Capture account identity across asynchronous create/import/load/edit/delete work. Guard every later state mutation, including errors/loading/finally, and reset new account-scoped state through `signedOutState()`. A new login must not make an old import continue under the new identity.

**Legacy assumption:** Keep rows without trustworthy ownership stored but inaccessible to normal account operations. Do not infer their owner from the currently signed-in account, timestamps or device identity. No silent deletion, automatic claiming or recovery/export screen. If product expectations require access to those rows, resolve ownership with Sallvain before relaxing this boundary.

**Upgrade requirements:** Read the current DB_VERSION at implementation time and advance it once. Branch on object-store/index existence; add the missing index to an existing messages store as well as creating it on a fresh database. Preserve other stores and owned rows; all openers use `upgradeDb`. Exercise upgrades where a different service opens the database first, and handle existing connections without an indefinite hang.

**Regression evidence:** In one browser database, A creates messages; B cannot list, get by id, change, delete, clear, rotate or export them. B's import and duplicate detection see only B's content. Switching back restores A's messages. Repeat with signed-out access, ownerless legacy rows and paused promises across account switches. Verify both a fresh database and upgrade, plus normal public daily-message rotation.

## F9 / CAP-9 — Profile name and auth email ownership (LOW)

**Settled design:** `display_name` is a freely editable profile field; `email` is an auth-owned read-only mirror. No email-change UI or username login. The report's impersonation claim did not hold because stranger profiles are hidden and `partner_id` is already pinned.

**Required change:** Redefine `sync_user_profile()` so signup still seeds a display name but its ON CONFLICT update maintains only email and updated_at. Preserve existing function ACLs, including the later execute revocations. Change `DisplayNameSetup.tsx` to write the profile name directly, removing its auth metadata write. Change `App.tsx` setup gating and `LoveNotes.tsx` own-name lookup to read the profile; an own-name helper beside `getPartnerDisplayName()` is appropriate. Remove session refreshes used only to refresh that obsolete metadata path. Other profile-table readers need no unrelated rewrite.

Prevent client changes to the email mirror while allowing the effective owner of the SECURITY DEFINER auth-sync function to update it. Evaluate column privileges first; if a trigger is used, distinguish effective SQL role from JWT identity and keep the guard SECURITY INVOKER so it observes the real client role. Preserve existing partner_id restrictions. Do not broaden profile SELECT to make setup or partner search easier.

**Regression evidence:** Client email changes fail, own display-name changes succeed, partner-row writes fail, and a later auth update synchronizes email without clobbering the chosen name. Test actual role/trigger paths rather than only mocked client calls. Cover password signup and Google bootstrap, missing profile/name and loading/error states, setup completion without auth refresh, persisted names after reload, and the chat's own-name display. Guard delayed profile reads against account switches. Existing anchors: `tests/api/auth-bootstrap-identity.spec.ts`, `tests/e2e/auth/display-name-setup.spec.ts`, `tests/unit/api/partnerService.check.test.tsx`.

## F10 / CAP-10 — Bounded image request body (MEDIUM)

**Sites:** `supabase/functions/upload-love-note-image/index.ts`; both Blob upload/retry call sites in `src/services/loveNoteImageService.ts`.

**Required change:** Reject declared bodies over `CONFIG.MAX_FILE_SIZE_BYTES` before reading. Under the report's strict contract, reject absent or invalid Content-Length before reading as well. Count bytes while consuming `req.body`; cancel and return 413 immediately on exceeding the existing 5 × 1024 × 1024 byte limit, even when the header lies. Never use unbounded `arrayBuffer()`/`formData()` first. Check cumulative size before retaining each chunk; neither allocation nor copies may grow with the entire attack body.

The actual client uses `application/octet-stream`; reject the unused multipart format with 415. Preserve auth verification, CORS/preflight, rate-limit behavior, allowed MIME magic-byte checks and uploader-prefixed Storage paths. If browser/gateway evidence shows absent Content-Length for valid uploads, document a bounded-stream-only exception before changing that contract; do not ask browser code to manufacture the header.

**Regression evidence:** Test over-limit declarations with zero body reads; absent/invalid/negative/fractional lengths; a small declared length with an over-limit stream; exact limit; limit plus one byte; disconnected/truncated bodies; unsupported multipart; normal upload/retry; and unauthenticated requests. Assert cancellation and zero Storage writes on rejection, rather than only checking the response code. Demonstrate the endpoint separately after its Edge Function deployment.

**Bounded impact:** The report establishes buffering before validation but does not establish the hosted gateway's body cap. Do not claim a production worker crash was reproduced. Rebuilding the per-isolate rate limiter is outside this finding.

## F12 / CAP-12 — Photo account-switch continuations (MEDIUM)

**Site:** `src/stores/slices/photosSlice.ts:uploadPhoto` and `deletePhoto`.

**Required change:** Capture the initiating user and recheck it immediately before every post-await state mutation, including success, catch and finally. Preserve the original account context of authorized upload/delete operations; a response for A cannot insert a photo or signed URL into B's gallery, remove B's row, or change B's error/loading state.

**Regression evidence:** Pause the upload, signing or deletion request, switch A to B, then resolve and reject the pending work. B's full relevant state remains unchanged; signed-out completion is also harmless. Same-account success/failure and retry still behave correctly. This finding covers a shared-device timing window, not a remote account takeover.

**Out of scope — the compression window:** `src/components/PhotoUpload/PhotoUpload.tsx:86` and `src/components/photos/PhotoUploader.tsx:171` both `await imageCompressionService.compressImage(selectedFile)` *before* calling into the store (`PhotoUpload.tsx:100`, `PhotoUploader.tsx:184`). A switch that lands during compression therefore enters `uploadPhoto` fresh under B; `photoService` binds the request to B's token and the photo is stored, attributed and authorized as B's own. That is the accepted behaviour, not a CAP-12 violation: nothing of A's continuation crosses into B's state. `SPEC.md` CAP-12 **success** is authoritative for this finding's scope — only a continuation of A's that changes B's gallery, error or loading state is in scope — and the fix stays inside `photosSlice.ts`. Do not widen this finding into `PhotoUpload.tsx` or `PhotoUploader.tsx`, and do not add a compression pause point to the evidence above.

## F13 / CAP-13 — Browser-initiated authentication callbacks (MEDIUM)

**Site:** `src/api/supabaseClient.ts` client auth configuration and its bootstrap consumers.

**Required change:** Set `flowType: 'pkce'`, retaining supported password login, signup and Google OAuth. Verify callback handling against the installed SDK, including browser verifier storage and the GitHub Pages base path. A foreign implicit fragment must not save a session or bind application/service-worker state to the attacker's identity.

**Regression evidence:** Use an isolated test account's complete implicit fragment (`access_token`, `refresh_token`, `expires_in`, `token_type`), both signed out and with another user already signed in. Reject missing/wrong-verifier code callbacks and preserve the existing account; accept a code tied to the initiating browser. Avoid tests that only inspect a mocked createClient option. Demonstrate the real Google redirect; verify signup confirmation if enabled. The report found no existing password-recovery screen or update handler, so adding one is out of scope.

## Rejected claims and separate follow-up

These are scope boundaries from the report, not new findings to implement:

| Claim | Why excluded |
|---|---|
| IndexedDB auth tokens as a new exposure | The SDK already persists equivalent tokens in same-origin localStorage; the separate compromise was not established. The interim token-removal recommendation was withdrawn. |
| Partner-search filter injection | Server RLS still bounds rows; preserve that boundary. |
| Arbitrary together-session partner | Superseded by a later partner-guard RPC; scripture is also excluded here. |
| Large hand-selected JSON import | Local user-selected input; worst-case self-tab availability did not meet the report's finding threshold. |
| Any commenter can invoke the privileged agent | The pinned action checks repository permissions despite the workflow's missing local gate. |
| PR prompt injection as demonstrated API compromise | Fork trigger permissions and action actor checks constrain it; broad tool grants and PR-controlled instructions were hazards without a demonstrated bypass. |
| Fork npm scripts stealing a privileged GitHub token | Fork tokens are read-only with secrets withheld; credential relocation alone was not treated as isolation. |
| AdminPanel access as backend privilege escalation | The panel manages local messages; the actual account-boundary defect is F8. |
| Rate-limiter bypass/memory as a separate escalation | Worker lifetime bounds retention and users can already upload to their own Storage prefix; F10 addresses request buffering. |
| Unused Google offline refresh token as demonstrated theft | Unnecessary retention was observed without a separate theft path. |
| Developer script injection/traversal | Inputs are developer-controlled; hostile external inputs would change the threat model. Lint ignores scripts. |
| Committed pooler URL as a password leak | It contains connection coordinates but no password; F1 is the actual credential exposure. |

`supabase/.temp/` tracked-but-ignored files contain no reported credentials, and `partnerService.ts` has a stale stranger-search comment. They are hygiene follow-up, not acceptance requirements here. The report's residual Realtime sites share F2/F3's cause; reflection residuals are scripture; rate-limit specifics and the remaining incomplete scan are not independently confirmed findings.
