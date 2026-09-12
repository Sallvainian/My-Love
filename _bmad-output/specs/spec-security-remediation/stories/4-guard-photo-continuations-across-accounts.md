---
title: 'Guard photo continuations across accounts'
type: 'bugfix'
created: '2026-09-12'
status: done
baseline_revision: 2056ed1b0eb209dad29fdef3da72448dcc30889c
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `src/stores/slices/photosSlice.ts` writes store state after every `await` with no check that the signed-in user is still the one who started the work. On a shared device, A starts an upload or a delete, switches to B, and A's continuation inserts A's photo and signed URL into B's gallery, removes a row from B's list, paints A's failure into the app-wide `error` banner, or strands `isUploading`/`uploadProgress`. `loadPhotos` in the same file already carries the guard (`:151`, `:158`, `:162`); `uploadPhoto`, `deletePhoto` and `updatePhoto` do not.

**Approach:** Capture the initiating identity at action entry and recheck it immediately before every post-await `set()` — success, catch, progress callback and warning paths alike — using the `userId` + `authSessionVersion` pair `eventsSlice` already uses, so a sign-out and sign-in as the *same* account cannot revive the previous session's request either. The authorized server operation is left alone: a response that arrives late still reports its true outcome to its own caller; only the shared store is protected.

## Boundaries & Constraints

**Always:**
- Capture `{ userId, authSessionVersion }` once at action entry; recheck **both** before each post-await `set()`, including the `onProgress` callback `photoService.uploadPhoto` invokes while the upload is in flight.
- Return the true outcome of the durable operation to the caller even when the continuation is stale — `uploadPhoto` still returns `{ success: true }` / `{ success: false, error }`; state is what is withheld, not the truth.
- Preserve every existing same-account behaviour: quota reject at ≥95%, quota warning at ≥80% and post-upload, optimistic insert with `isOwn` computed from the captured user, progress 0→100, error message returned directly rather than read back off the shared `error` key.
- Keep the guard shape and comment idiom of `eventsSlice.ts:292-376` so the 19-site copy-paste pattern stays recognisable.

**Never:**
- Do not cancel, retarget or re-authorize the in-flight Supabase request. `photoService.uploadPhoto` and `deletePhoto` bind to `supabase.auth.getUser()` at their own start (`photoService.ts:307`, `:479`); that binding is correct and stays.
- Do not add a field to `signedOutState()` — this story introduces no new account-scoped state.
- Do not touch `loadPhotos`, the photo components, `photoService`, the database, RLS or Storage policies.
- Do not treat the **compression window** as in scope. `PhotoUpload.tsx:86` and `PhotoUploader.tsx:171` `await imageCompressionService.compressImage(selectedFile)` *before* calling into the store (`PhotoUpload.tsx:100`, `PhotoUploader.tsx:184`), so a switch landing during compression enters `uploadPhoto` fresh under B and the upload proceeds as B's own — bound to B's token by `photoService`, correctly attributed and authorized. That is accepted behaviour, resolved by Sallvain on 2026-09-12 and recorded in `remediation.md` under **Out of scope — the compression window**. The store slice is the whole job; do not widen this story into `PhotoUpload.tsx` or `PhotoUploader.tsx`, and do not add a compression pause point to the test matrix.
- Do not widen `PhotoUploadResult` or change any caller's contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Upload resolves after switch to B | A's `uploadPhoto` pending in `getSignedUrl`; store now holds B's `userId` and B's `photos` | B's `photos`, `isUploading`, `uploadProgress`, `storageWarning` unchanged; A's photo and signed URL absent from the whole store | No error; returns `{ success: true }` to A's caller |
| Upload rejects after switch to B | A's `uploadPhoto` pending; service throws | B's shared `error` stays as it was; B's `isUploading`/`uploadProgress` unchanged | Returns `{ success: false, error }` to A's caller |
| Progress callback fires after switch | A's upload in flight, `onProgress(75)` invoked post-switch | B's `uploadProgress` unchanged | No error expected |
| Quota check resolves after switch | A's `checkStorageQuota` returns 97% post-switch | B's `error` and `isUploading` unchanged | Returns `{ success: false, error }` to A's caller |
| Post-upload quota warning after switch | A's second `checkStorageQuota` returns `approaching` post-switch | B's `storageWarning` unchanged | No error expected |
| Delete resolves after switch to B | A's `deletePhoto('p1')` pending; B's gallery contains a row whose id is also `p1` | B's `photos` still contains `p1` | No error expected |
| Delete rejects after switch to B | A's `deletePhoto` throws post-switch | B's shared `error` unchanged | Error swallowed, as today |
| Caption save resolves after switch | A's `updatePhoto` pending; B's gallery holds the same photo id | B's `photos` unchanged (no caption applied), B's `error` unchanged | Returns void |
| Sign-out completion | A's upload/delete/update pending, then `clearAuth()` | No store write at all; `photos` stays `[]`, `error` stays `null` | No error expected |
| Same user signs back in mid-flight | A's upload pending, then `clearAuth()` + `setAuthUser(A)` (`authSessionVersion` bumped twice) | No store write — the request belongs to the previous session | No error expected |
| Same-account success | A stays signed in, upload succeeds | Photo prepended with `isOwn: true` and its signed URL; `isUploading` false, `uploadProgress` 0 | No error expected |
| Same-account failure then retry | A stays signed in, first attempt throws, second succeeds | First sets `error`; second clears it and inserts the photo once | Error surfaced then cleared |

</intent-contract>

## Code Map

- `src/stores/slices/photosSlice.ts:69-144` `uploadPhoto` — the primary site. Six post-await writes with no guard: `:78-82` quota reject, `:90` quota warning, `:97` the `onProgress` callback (fires *during* the `photoService.uploadPhoto` await), `:119-123` the optimistic insert, `:130` the post-upload warning, `:136-140` the catch. `:111` `get().userId` is read for `isOwn` — replace with the captured id so a late success cannot mislabel ownership. `:171-187` `deletePhoto` — two unguarded writes (`:180-182`, `:185`). `:212-235` `updatePhoto` — two unguarded writes (`:224-230`, `:220`/`:233`).
- `src/stores/slices/photosSlice.ts:150-165` `loadPhotos` — the in-file precedent, already guarded on `userId` alone at `:158` and `:162`, with the comment (`:155-157`) explaining why the late write is reachable. Do not change it.
- `src/stores/slices/eventsSlice.ts:292-376` (`addEvent`, `editEvent`, `removeEvent`) — the guard shape to copy verbatim: `const { userId: requestedBy, authSessionVersion: requestedInSession } = get();` then `if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) { return <truthful success>; }`, with the standing comment "success reports the durable write only — the account changed, so this session's state is deliberately untouched." `:239-242` shows the same pair used as an `ownsLoad()` closure when several writes share one guard.
- `src/stores/slices/authSlice.ts:151,207,244` — `authSessionVersion` is bumped by `clearAuth` (always) and by `setAuthUser` when the id changes. That is what makes sign-out → sign-in-as-A distinguishable from an uninterrupted A; a `userId`-only compare misses it.
- `src/stores/slices/authSlice.ts:61-140` `signedOutState()` — already resets `photos`, `selectedPhotoId`, `isUploading`, `uploadProgress`, `storageWarning` (`:92-96`). It does **not** reset `error`; `error` is the app-wide key owned by `appSlice.ts:21` ("Global error state"), which is why an unguarded catch here paints a banner for the next account.
- `src/services/photoService.ts:301-310` / `:477-490` — both call `supabase.auth.getUser()` at their own start, so the network operation is already bound to the account that issued it. `:108-120` `getSignedUrl(storagePath, expiresIn)` → `string | null`; `:175` `checkStorageQuota()` → `{ used, quota, percent, warning }`; `:576` `updatePhoto(id, updates)` → `boolean`.
- `tests/unit/stores/loaderIdentityGuards.test.ts` — the test home. `:76-78` the `photoService` mock currently exposes **only** `getPhotos`; it must gain `uploadPhoto`, `deletePhoto`, `getSignedUrl`, `checkStorageQuota`. `:134-146` `deferred<T>()` hand-settled promise helper. `:171-178` `switchToUserC(cOwnState)` sets `userId`/`isAuthenticated` directly and **does not** bump `authSessionVersion` — deliberate (`:10-18`: driving the switch through `clearAuth` makes every assertion pass with the guard deleted). `:395-428` the two existing `loadPhotos` cases are the row-for-row template. `:1150-1204` the `when the identity has not changed` block is where same-account behaviour rows go.
- `src/components/PhotoUpload/PhotoUpload.tsx:100-117` and `src/components/photos/PhotoUploader.tsx:184,216` — the two `uploadPhoto` callers. `PhotoUpload` reads `uploadResult.success`; `PhotoUploader` ignores the result and retries by re-calling `handleUpload`. Neither changes; they are read-only evidence that the return contract must stay exactly as it is.
- `src/components/PhotoCarousel/PhotoCarousel.tsx:220` and `src/components/PhotoGallery/PhotoViewer.tsx:400` — the two `deletePhoto` callers, both awaiting a `Promise<void>`. Unchanged.
- `tests/unit/services/photoService.idempotency.test.ts:174-190` — the other existing consumer of the slice, and the one this change can break. It builds an **isolated** store from `createPhotosSlice` alone (`create<Store>()(createPhotosSlice ...)`) and seeds only `{ userId: USER_ID }`, so `authSessionVersion` is `undefined` in that store. The capture/recheck pair still agrees (`undefined !== undefined` is false), which is why the guard must be a plain equality compare: do **not** add a `if (!requestedBy || !requestedInSession) return` bail, which would make its two `it.each` cases — the only ones in that file that go through the store rather than calling `photoService` directly — dead.
- `src/components/PhotoGallery/__tests__/PhotoViewer.focus.test.tsx` — mocks `useAppStore` wholesale and asserts `deletePhoto` call count only; unaffected. Together with the file above these are the only two tests that reach `photosSlice` (`grep -rln "photosSlice" tests` → `loaderIdentityGuards.test.ts` for its section comment at `:392`, and `photoService.idempotency.test.ts` for the import), so nothing currently pins the unguarded behaviour.
- `node_modules/` was absent in this worktree; `npm ci` has been run (exit 0). Every npm script below needs it.

## Tasks & Acceptance

**Execution:**

**Start from the previous attempt, not from scratch.** The first run's implementation is committed at `_bmad-output/implementation-artifacts/story-4-guard-photo-continuations.attempted.patch` (731 lines, touching `src/stores/slices/photosSlice.ts` and `tests/unit/stores/loaderIdentityGuards.test.ts`). It applies **forward** cleanly onto this story's baseline — `git apply --check` on that patch exits 0, measured at commit `94e25194` on `fix/security-remediation`. Begin by applying it:

```
git apply _bmad-output/implementation-artifacts/story-4-guard-photo-continuations.attempted.patch
```

Then **verify and correct** the applied change against the corrected intent above — do not re-implement it. The attempt was reverted for the compression-scope intent gap, which the Spec Change Log now resolves in the attempt's favour: it already confined itself to `photosSlice.ts` and already excluded the compression window, so its scope matches the resolved decision. Treat the bullets below as the checklist to verify the applied diff against, and work the open `[patch]` findings in the **Review Triage Log** — in particular the `[medium]` one recording that the `authSessionVersion` conjunct of `ownsDelete`/`ownsUpdate` is pinned by no test (proved by mutation: weakening either closure to a `userId`-only compare left the suite at 78 passed). Re-run the full **Verification** section on the corrected tree regardless of how little changes.

- `src/stores/slices/photosSlice.ts` — edit `uploadPhoto` — capture `{ userId: requestedBy, authSessionVersion: requestedInSession }` before the first `set()`, add a local `ownsUpload()` predicate, and gate all six post-await writes on it (including the `onProgress` arrow at `:97`). Use `requestedBy` instead of `get().userId` for `isOwn`. Stale paths still `return` the real result. Update the slice docblock to record the cross-slice dependency on `authSlice` that this introduces.
- `src/stores/slices/photosSlice.ts` — edit `deletePhoto` and `updatePhoto` — same capture and the same recheck before their success and catch writes. See **Design Notes** for why `updatePhoto` is in scope alongside the two actions `remediation.md` names.
- `tests/unit/stores/loaderIdentityGuards.test.ts` — edit — extend the `photoService` mock with the four new methods; add `describe('uploadPhoto')`, `describe('deletePhoto')` and `describe('updatePhoto')` blocks covering every stale row of the I/O matrix, plus a `signs back in as the same account` case that drives `clearAuth()` + `setAuthUser(A)` (the only row `switchToUserC` cannot express, and the one that discriminates the `authSessionVersion` half of the guard). Seed C's own `photos`/`error` first, so a guard that fails to discard is caught by C's data being overwritten. Add the same-account success, failure-then-retry and progress rows to the existing `when the identity has not changed` block.
- Verification: reproduce red-then-green for each new guard by reverting that one guard in the working tree and confirming only its own cases fail; record the result in **Verification**.

**Acceptance Criteria:**
- Given A's upload is pending at any of its four await points (`checkStorageQuota`, `photoService.uploadPhoto`, `getSignedUrl`, the post-upload `checkStorageQuota`) or inside its progress callback, and the store is handed to B, when the pending work settles either way, then no key of B's store changes and no string unique to A's photo appears anywhere in `JSON.stringify(useAppStore.getState())`.
- Given A's delete of a photo id that also exists in B's gallery is pending, when it resolves after the switch, then B's row with that id is still present.
- Given A's upload or delete is pending, when `clearAuth()` runs before it settles, then the store keeps the signed-out values and `error` stays `null`.
- Given A signs out and signs back in as A while an upload is pending, when it settles, then no write lands — the request belonged to the previous `authSessionVersion`.
- Given the account never changes, when an upload succeeds, fails, is retried, reports progress, is quota-rejected or raises a quota warning, then every pre-existing behaviour is byte-for-byte what it was, including the returned `PhotoUploadResult`.
- Given each guard is individually reverted, when `npm run test:unit` runs, then only that guard's own new cases fail — no guard is proved by another's assertions.
- Given `npm run lint`, `npm run typecheck`, `npm run test:unit` and `fnox exec -- npm run build`, when they run, then all pass (3 pre-existing `EventCountdown.tsx` lint warnings are baseline).

## Spec Change Log

### 2026-09-12 — escalation resolved (`/bmad-loop-resolve 4`)
- **Decision (Sallvain):** the compression window is out of scope. `SPEC.md` CAP-12 **success** is authoritative over `remediation.md`'s former "Pause compression/…" clause: only a continuation of A's that changes B's gallery, error or loading state is in scope. An upload whose compression outlives the session proceeds as the newly signed-in account's own upload, correctly attributed and authorized. Rationale: the app is two people on separate phones, and the window is about one second after tapping a photo.
- **Scope:** `src/stores/slices/photosSlice.ts` only. `PhotoUpload.tsx` and `PhotoUploader.tsx` are not widened into.
- **Encoded at:** the new **Never** bullet in `<intent-contract>`, and `remediation.md` → F12 → **Out of scope — the compression window** (whose `**Regression evidence:**` line no longer names compression as a pause point).
- **The first attempt is preserved and is the starting point.** Its diff is committed at `_bmad-output/implementation-artifacts/story-4-guard-photo-continuations.attempted.patch` and applies forward cleanly (`git apply --check` exit 0 at `94e25194`). See **Tasks & Acceptance → Execution**; the re-drive applies and corrects it rather than re-implementing.
- Supersedes the two `[intent_gap]` findings in the Review Triage Log below and the open questions under **Auto Run Result**; both are closed by this decision. The `[low]` `[patch]` finding about the residual risk having no ledger entry is closed too — the behaviour is recorded in `remediation.md` as accepted, not deferred.

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 27 findings — high 0, medium 5, low 18, false 4, maybe-false 0
- attempted change saved to `../../implementation-artifacts/story-4-guard-photo-continuations.attempted.patch` (731 lines, reverse-applies cleanly); code reverted per the intent_gap branch
- findings:
  - `[medium]` `[intent_gap]` The compression window is excluded from scope though F12's regression evidence names it — verified: `PhotoUpload.tsx:86` and `PhotoUploader.tsx:171` both `await imageCompressionService.compressImage()` before entering the store, so a switch during compression enters `uploadPhoto` fresh under B and B's gallery gains a photo B never chose. `SPEC.md:55` and `remediation.md:108` disagree about whether that counts; see the intent-gap questions under **Auto Run Result**.
  - `[low]` `[patch]` Design Notes claim the compression case "is recorded as a residual risk" but `deferred: []` and no ledger entry exists — verified: `_bmad-output/implementation-artifacts/deferred-work.md` has no matching entry. Moot under the intent_gap branch; the resolution decides whether the item is deferred or implemented.
  - `[medium]` `[patch]` The `authSessionVersion` conjunct of `ownsDelete`/`ownsUpdate` is pinned by no test — verified by mutation: weakening either closure to `get().userId === requestedBy` alone leaves the suite at 78 passed. Fix is two cases (`clearAuth()` + `setAuthUser(A)`) mirroring `uploadPhoto`'s existing same-account row. Moot under intent_gap; carry to the re-derivation.
  - `[low]` `[defer]` `loadPhotos` keeps the weaker `userId`-only guard while the rest of the file moves to the pair — pre-existing (`photosSlice.ts:183-194` predates this story) and same-account only.
  - `[low]` `[patch]` `isOwn: requestedBy ? ... : false` is a provable no-op and its comment claims otherwise — verified: the line sits after `if (!ownsUpload()) return`, so `requestedBy === get().userId` by construction. Smallest fix is dropping the causal clause from the comment.
  - `[medium]` `[defer]` `signedOutState()` never resets the app-wide `error` key — verified: `grep -c error src/stores/slices/authSlice.ts` returns 0, so a banner outlives sign-out. Pre-existing and the cause behind several of these symptoms, but not introduced here.
  - `[low]` `[reject]` Three byte-identical guard closures share no helper — real, but the smallest fix introduces a factory abstraction rather than a direct correction, and the divergence is not something users or developers meet in everyday use.
  - `[low]` `[patch]` Guard idiom varies across the six upload sites; the `&&` form at `:104` and `:155` fuses identity into a business predicate so a reader scanning for guards misses it, and reverting it for a red/green pass also changes the quota condition.
  - `[low]` `[patch]` Two stale cases assert a single key and leave `isUploading`/`uploadProgress` untested although the block header promises they are caught separately — verified for the signing case and the pre-upload-warning case.
  - `[low]` `[patch]` The same-account retry case mints a fresh input per attempt, encoding the double-write shape `PhotoUploadInput.idempotencyKey` exists to prevent (`photoService.ts:72-82`).
  - `[low]` `[reject]` The I/O matrix rows and the empty Spec Change Log no longer match the tests that shipped — real, but the fix edits this build's spec, and the matrix lives inside the read-only `<intent-contract>`.
  - `[low]` `[patch]` `flush()` silently depends on real timers; a future shared `vi.useFakeTimers()` would hang four cases with no diagnostic. One doc-comment line.
  - `[false]` `[reject]` Entering `uploadPhoto` signed out (`requestedBy` null) writes a stale "Not authenticated" banner — refuted: `App.tsx:512` returns `<LoginScreen/>` when there is no session, so the uploader is never mounted and the entry is unreachable through the UI.
  - `[low]` `[patch]` The new slice docblock asserts the pair guard for "every action that writes after an await" while `loadPhotos` rechecks `userId` only — the docblock overclaims and should name the three actions it describes.
  - `[low]` `[defer]` The post-upload warning ignores `warning === 'exceeded'` — verified pre-existing: the baseline at `9ce70d04:photosSlice.ts:128` carries the identical condition; this change only appended `&& ownsUpload()`.
  - `[low]` `[defer]` Two concurrent same-account uploads let the first completion zero `isUploading`/`uploadProgress` under the second — pre-existing consequence of a single shared flag, untouched here.
  - `[false]` `[reject]` Residual risk is broader than measured because a signed-out entry writes `error` — same refutation as the unreachable signed-out entry above.
  - `[medium]` `[patch]` (verification-gap, pre-verified) `authSessionVersion` half of the delete/update guards is unverified; mutation demonstrated silent survival. Same root cause as the medium row above; shares its fix.
  - `[low]` `[patch]` (verification-gap) `loadPhotos` non-adoption is defensible, but the docblock written as if it had been retrofitted is not. Shares the docblock fix above.
  - `[low]` `[patch]` (verification-gap, other) `isOwn` via `requestedBy` is an unreachable-different tightening, not a behavior change — noted so it is not mistaken for an untested behavioral edit. Shares the comment fix.
  - `[low]` `[defer]` (verification-gap, other) `PhotoUploader.tsx:184-194` shows a success toast on a failed upload because `uploadPhoto` never throws — pre-existing and untouched; it does mean a stale `{ success: true }` and a genuine failure are indistinguishable at that call site.
  - `[medium]` `[intent_gap]` (intent-alignment D1) The intent's expectation for the compression pause lives at the component surface; every change and test in the diff lives at the store surface. Grouped with the first row — same root cause.
  - `[low]` `[patch]` (intent-alignment D2) `switchToUserC` models a transition no app path produces: both real transitions bump `authSessionVersion` and run `signedOutState()` (`authSlice.ts:207`, `:244`), so the `userId` half is proved against synthetic state while the version half is the half that fires in production. Shares the two-case fix above.
  - `[false]` `[reject]` (intent-alignment D3) `updatePhoto` exceeds the literal Site line — refuted as a defect: CAP-12's success criterion is stated over outcomes ("changes none of B's gallery, error or loading state"), and a caption save writes both `photos` and `error`. Recorded in Design Notes rather than done silently.
  - `[low]` `[defer]` (intent-alignment D4) `remediation.md:106` requires a recheck "including ... finally" but neither action has a `finally`; the originating session's flags are released by `signedOutState()` rather than by this code, and no test pins that.
  - `[low]` `[reject]` (intent-alignment D5) "B's full relevant state" is satisfied by key enumeration plus three marker strings rather than a structural whole-state comparison — the fix is a whole-state snapshot harness, more than a direct correction, for a gap not met in everyday use.
  - `[false]` `[reject]` (intent-alignment D6) A client-only change with `photoService` mocked conflicts with `SPEC.md:64`'s server-boundary constraint — refuted by F12's own framing at `remediation.md:108`: "This finding covers a shared-device timing window, not a remote account takeover."

### 2026-09-12 — Review pass (re-drive)
- verdicts: 26 findings — high 0, medium 1, low 13, false 12, maybe-false 0
- findings:
  - `[low]` `[patch]` `deletePhoto`'s success-guard comment justified itself with the one case where the skipped write was correct — verified: `photoService.getPhotos` is RLS-scoped to own+partner rows (`photoService.ts:249-273`), so the id is present in the next account's list only when that account is A's partner, and for a partner the row really is gone. Fixed: the comment now says the write is withheld because the session ended, and that reconciling the row is the new session's own `loadPhotos`' job.
  - `[false]` `[reject]` The guard leaves a phantom row with nothing to reconcile it — refuted: every real account change runs `signedOutState()` (`authSlice.ts:207` via `clearAuth`, `:244-250` via `discardAccountState` when `setAuthUser` sees a different id), which empties `photos` outright, so no stale row survives into the next session.
  - `[false]` `[reject]` `uploadPhoto` hands the next account a success UI — refuted at the cited location: the claim rests on `PhotoUploader.tsx:184`'s unconditional success toast, and `grep -rn "PhotoUploader" src tests` returns exactly one hit outside the file itself (a test comment). Nothing imports it. The mounted caller `PhotoUpload.tsx:100-106` does read `uploadResult.success`, and returning the true outcome there is what the intent's Always list mandates.
  - `[low]` `[patch]` The three same-account-resignin cases asserted against a store state no app path produces — verified: `clearAuth()` empties `photos`, so a store holding C's row after A signs back in is unreachable. Fixed: `uploadPhoto` now asserts the reachable empty gallery, and the delete/update cases seed `aGalleryRow()` — A's own re-loaded row, which is what the dead session's continuation would really corrupt. Re-measured: all three still fail only their own case when the `authSessionVersion` conjunct is weakened.
  - `[low]` `[patch]` The `>= 80` pre-upload warning branch was not pinned by the test that claimed it — verified: the same-account case used an every-call quota mock at 85%, so both warning writes produced a byte-identical string and either could be deleted. Fixed: split into two cases with distinct percentages (85% pre-upload, 87% post-upload). Deleting either write now fails exactly its own case.
  - `[false]` `[reject]` Only one of three branches of the changed `isOwn` expression is exercised — refuted: `photoService.uploadPhoto` inserts `user_id: userId` for the authenticated caller (`photoService.ts:367`), so `photo.user_id === requestedBy` always holds on this path, and `App.tsx` renders `<LoginScreen/>` with no session, so `requestedBy === null` is unreachable. The untested branches cannot occur.
  - `[low]` `[patch]` Every new fixture was an untyped literal, so type drift would be invisible — verified: a rename on `SupabasePhoto` would leave the fixtures silently wrong with typecheck green. Fixed: `uploadInput()`, `aPhoto()` and `cPhoto()` now carry `PhotoUploadInput` / `SupabasePhoto` / `PhotoWithUrls` return types via a type-only import.
  - `[low]` `[patch]` The docblock said `loadPhotos` keeps the weaker guard deliberately but gave no reason — verified: it pointed at an explanation of why the pair is stronger, not why one writer may stay weaker. Fixed: the docblock now records that `loadPhotos` writes only `photos`, so the case the weaker form misses repopulates A's own gallery with A's own rows.
  - `[false]` `[reject]` The guard-idiom finding was only half-fixed; three shapes remain — refuted: the logged row was specifically about the `&&` form fusing identity into a business predicate, which is fixed. The remaining early-return/block variance mirrors `eventsSlice` and every one of the ten sites names an `owns*()` predicate, so nothing is missed by a reader scanning for guards.
  - `[low]` `[defer]` carried — `loadPhotos` keeps the weaker `userId`-only guard, so a dead session's catch can write `photos: []` over the new one. Same claim and location as the row logged on 2026-09-12; code still reads as described. Not re-deferred per the carry rule; see the ledger note under **Auto Run Result**.
  - `[medium]` `[defer]` carried — `signedOutState()` never resets the app-wide `error` key, so a failure banner outlives sign-out. Same claim and location as the logged row; `grep -c error src/stores/slices/authSlice.ts` still returns 0. Not re-deferred per the carry rule.
  - `[low]` `[defer]` carried — the post-upload warning ignores `warning === 'exceeded'`, so the worst quota state shows no warning. Same claim and location as the logged row; pre-existing at `9ce70d04`.
  - `[low]` `[defer]` carried — two concurrent same-account uploads let the first completion zero `isUploading`/`uploadProgress` under the second. Same claim and location as the logged row; a consequence of the single shared flag, untouched here.
  - `[low]` `[patch]` (verification-gap, pre-verified) The post-upload storage warning's only owner-path assertion was already satisfied by the pre-upload write — filed with a mutation demonstration (`if (false && ownsUpload())` left 80/80 green). Grouped with the `>= 80` row above; the same two-case split fixes both.
  - `[low]` `[patch]` (verification-gap, pre-verified) `deletePhoto` and `updatePhoto` owner-path error writes were pinned only in the negative — re-measured here: widening both catch guards so the write never runs left the file at 80/80 and the full suite at 2033. Fixed: added `deletePhoto surfaces a failure` and `updatePhoto surfaces a rejected save and a thrown one`, which also pins the previously untested `!persisted` write.
  - `[low]` `[patch]` (verification-gap, pre-verified) The quota-rejection flag reset was unasserted on the owner path — re-measured: reducing the write to `set({ error: quotaError })` left the file green while stranding `isUploading: true`. Fixed: the rejection case now asserts `isUploading` false and `uploadProgress` 0.
  - `[false]` `[reject]` (verification-gap, other) `flush()` depends on real timers — the layer filed it as "a live constraint on the file, not a defect today", and `grep -n "useFakeTimers"` on the file returns nothing. The doc-comment added this pass already records the constraint.
  - `[false]` `[reject]` (verification-gap, other) `loadPhotos` non-adoption of the pair guard — the layer explicitly declined to file it, having checked that `loadPhotos` writes only `photos` and so leaks nothing across accounts. Same conclusion the docblock now records.
  - `[low]` `[patch]` (intent-alignment D1) The matrix's expectations are written at the sign-out surface while 13 cross-account cases measure at the raw-`setState` surface — verified: `switchToUserC` bumps no `authSessionVersion` and resets nothing, whereas a real handoff runs `signedOutState()`. Grouped with the resignin-seed row above; the synthetic transition is retained deliberately (the file header at `:10-16` records that driving it through `clearAuth` made the suite pass with five guards deleted), and the reachable-state fix was applied where it does not destroy discrimination.
  - `[false]` `[reject]` (intent-alignment D2) `error` is the only field that genuinely leaks across a real handoff, yet the flags are foregrounded — refuted as a defect: the diff does cover `error` on every catch and sign-out case, and the flags are asserted in addition, not instead.
  - `[low]` `[patch]` (intent-alignment D3) The flag assertions were justified by a comment citing unmounted code — verified: `usePhotos` is imported only by `src/components/photos/PhotoUploader.tsx`, which nothing imports, so `isUploading`/`uploadProgress` reach no mounted UI. Fixed: the block comment now states that plainly and gives the real reason the keys are asserted.
  - `[false]` `[reject]` (intent-alignment D4) The caller-contract premise holds at only one of two call sites — refuted as a defect: the second site is the unimported `PhotoUploader.tsx`, so no live behaviour depends on it.
  - `[false]` `[reject]` (intent-alignment D5) Named closures were used where the cited `eventsSlice.ts:292-376` range shows only the inline form — refuted: the spec's own Code Map blesses the closure form, citing `eventsSlice.ts:239-242`'s `ownsLoad()` for exactly the case of several writes sharing one guard.
  - `[false]` `[reject]` (intent-alignment D6) Ten checks cover eleven write paths — refuted: the layer itself records the arrangement is outcome-identical on every matrix row, and the mutation matrix confirms each of the ten fails only cases in its own block.
  - `[false]` `[reject]` (intent-alignment D7) The two conjuncts are never exercised at the same surface — refuted as a defect: both halves are independently pinned. Weakening any of the three closures to a `userId`-only compare fails exactly its own same-account-resignin case, and the 13 `switchToUserC` cases pin the id half.
  - `[false]` `[reject]` (intent-alignment D8) The docblock characterises `loadPhotos` though its code is untouched — refuted as a defect: describing a neighbouring guard is documentation, not a code-surface widening, and it is the fix a prior logged row asked for.

## Design Notes

**Why both `userId` and `authSessionVersion`.** `loadPhotos` compares `userId` alone, which is enough for A→B but not for A→signed-out→A: the same id returns and a request from the dead session writes as if it were live. `eventsSlice` already pairs the id with `authSessionVersion`, which `clearAuth` bumps unconditionally (`authSlice.ts:207`). This story adopts the stronger pair rather than the weaker in-file precedent, and does not retrofit `loadPhotos` — that is a different action with its own contract.

**Why the `onProgress` callback needs the guard.** It is the one write that does not sit after a visible `await` keyword: `photoService.uploadPhoto` invokes it from inside the awaited call (`photoService.ts:336`, `:357`, `:459`). Reading the slice top-to-bottom it looks synchronous with the call, so it is the write most likely to be missed — and a stranded `uploadProgress` renders B a progress bar for a photo B never chose (`PhotoUploader.tsx:372-382`).

**Why the return value is not guarded.** `uploadPhoto` returns its outcome directly instead of having callers read the shared `error` key — the reason is already recorded at `photosSlice.ts:24-28`. A late result is still the true result of a real, authorized operation, and its caller is A's own component closure. Blanking it would be inventing a failure that did not happen. `eventsSlice` settles this the same way: "success reports the durable write only."

**What is deliberately out of scope, with the measurement.** `PhotoUpload.tsx:86` and `PhotoUploader.tsx:171` compress the image *before* calling into the store. If the switch lands during compression, `uploadPhoto` is entered fresh under B, `photoService` binds the request to B's token, and the photo becomes B's — correctly attributed, because the operation genuinely is B's. That is not "A's continuation changing B's state", so it is outside CAP-12. Sallvain resolved this on 2026-09-12: the upload proceeding as B's own is accepted behaviour, recorded in `remediation.md` under **Out of scope — the compression window**. It is not a deferred item and needs no ledger entry.

**Why `updatePhoto` is in scope.** `remediation.md`'s Site line names `uploadPhoto` and `deletePhoto`, but CAP-12's success criterion is stated over outcomes: "A's continuation changes none of B's gallery, error or loading state." A caption save is a photo continuation and it writes both `photos` and the app-wide `error` — the same defect, the same file, twenty lines away, and the identical one-line fix. Leaving it would mean `photosSlice` still holds an unguarded post-await mutation of exactly the keys the capability protects. This is the only place the story goes beyond the two named actions, and it goes no further: `loadPhotos` already has its guard and is untouched, and nothing outside this file changes.

**Why unit tests at the store are the boundary, not E2E.** `rollout.md` warns that "mocked client tests alone cannot demonstrate RLS, private Realtime authorization, auth callback rejection or role-sensitive triggers". F12 has no server boundary: the defect is entirely client store logic, and `remediation.md` itself calls it "a shared-device timing window, not a remote account takeover". These tests run the real `useAppStore` with the real slice and mock only the network service, so the code under test is the code that failed. A Playwright run could not pause a promise mid-flight without the same instrumentation and would additionally have to sign two worker-pool accounts into one browser, which `AGENTS.md` forbids.

## Verification

**Commands:**
- `npm run test:unit` — expected: green, with the new photo guard cases and all 2008 pre-existing tests still passing.
- `npx vitest run tests/unit/services/photoService.idempotency.test.ts tests/unit/stores/loaderIdentityGuards.test.ts` — expected: green; the idempotency file is the one that drives the slice from an isolated store with no `authSessionVersion`, so it is the specific regression risk of this change.
- `npm run typecheck` — expected: clean (`tsc -b --force` over all three projects).
- `npm run lint` — expected: 0 errors; 3 pre-existing `EventCountdown.tsx` warnings are baseline.
- `fnox exec -- npm run build` — expected: exit 0. Bare `npm run build` would exit 0 with a secret-less bundle, so the prefix is required.
- Red-then-green, one guard at a time: revert a single recheck in `photosSlice.ts`, run `npm run test:unit`, confirm **only** that guard's own new cases go red, restore it.

**Manual checks (if no CLI):**
- `git diff src/stores/slices/photosSlice.ts` shows changes confined to `uploadPhoto`, `deletePhoto`, `updatePhoto` and the slice docblock — `loadPhotos`, `selectPhoto`, `clearPhotoSelection`, `clearError` and `clearStorageWarning` untouched.
- `grep -n "get().userId" src/stores/slices/photosSlice.ts` shows no remaining read of the *live* user inside a post-await path of the three edited actions.

### Results (2026-09-12, re-drive from the saved patch)

The first attempt's patch applied forward cleanly onto baseline `2056ed1b`
(`git apply` exit 0) and was then corrected against the resolved intent rather
than re-implemented. The open `[patch]` findings in the Review Triage Log were
worked; every `[defer]` and `[reject]` finding was left alone.

- `npm run typecheck` — exit 0 (`tsc -b --force`, all three projects).
- `npm run lint` — 0 errors, 3 warnings, all three the pre-existing
  `react-refresh/only-export-components` warnings in `EventCountdown.tsx`.
- `npm run test:unit` — 111 files, **2033** tests pass (2008 before; +25).
- `npx vitest run tests/unit/services/photoService.idempotency.test.ts tests/unit/stores/loaderIdentityGuards.test.ts` — 91 pass. The idempotency
  file's isolated store, which has no `authSessionVersion`, still works: the
  guard is a plain equality compare, so `undefined === undefined` holds.
- `fnox exec -- npm run build` — exit 0.

Manual checks both hold. The diff touches only the slice docblock and the three
edited actions — `loadPhotos`, `selectPhoto`, `clearPhotoSelection`, `clearError`
and `clearStorageWarning` are untouched. The only remaining reads of the live
`get().userId` are `loadPhotos`' own pre-existing guard (`photosSlice.ts:189`,
`:196`, `:200`) and the three `owns*()` comparisons (`:88`, `:215`, `:268`).

**Red-then-green, one guard at a time.** Each of the ten rechecks was reverted
individually and the file re-run. Every one fails only cases inside its own
`describe` block — no guard is proved by another's assertions:

| Guard | Cases that go red when it is reverted |
|---|---|
| quota-reject write (`:102`) | `does not reject the new account's session over the previous one's quota` |
| 80% warning write (`:109`) | `does not raise the pre-upload storage warning against the new account` |
| `onProgress` write (`:122`) | `does not move the new account's progress bar` |
| success early-return (`:138`) | the gallery, signing, sign-out and same-account-resignin cases (4) |
| post-upload warning write (`:162`) | `does not raise the post-upload storage warning against the new account` |
| upload catch write (`:172`) | `does not paint the previous account's failure onto the new one` |
| delete success write (`:227`) | the shared-gallery and same-account-resignin cases (2) |
| delete catch write (`:235`) | the delete-failure and delete-after-sign-out cases (2) |
| update success write (`:276`) | the caption, rejected-save, sign-out and same-account-resignin cases (4) |
| update catch write (`:292`) | `does not paint the previous account's thrown save onto the new one` |

**What changed relative to the saved patch.** Nine of the ten guards are the
patch's own, verified unmodified against the resolved intent. The corrections
are the open `[patch]` findings:

- `deletePhoto` and `updatePhoto` each gained a
  `writes nothing when the SAME account signs back in mid-flight` case
  (`clearAuth()` + `setAuthUser(A)`), closing the `[medium]` finding that the
  `authSessionVersion` conjunct of `ownsDelete`/`ownsUpdate` was pinned by no
  test. Re-measured by mutation: weakening either closure to a `userId`-only
  compare now fails exactly its own new case and nothing else.
- The two `&& ownsUpload()` sites (`:109`, `:162`) were split into a plain
  `if (ownsUpload())` so identity is never fused into a business predicate.
- The `isOwn` comment no longer claims a behaviour the guard above makes
  unreachable; it now says plainly that this is not a behaviour change.
- The slice docblock names the three guarded actions instead of claiming
  "every action that writes after an await", and records that `loadPhotos`
  keeps the weaker `userId`-only form deliberately.
- The signing and pre-upload-warning cases now also assert
  `isUploading`/`uploadProgress`, which the block header promised were caught
  separately. The pre-upload-warning case parks the upload and asserts before
  the success path is reached, so those flags stay provable against its own
  guard alone.
- The same-account retry case reuses one input carrying a fixed
  `idempotencyKey`, so it encodes a retry of one logical upload rather than the
  double-write `PhotoUploadInput.idempotencyKey` exists to prevent.
- `flush()` carries a doc-comment line recording its dependency on real timers.

## Auto Run Result

Status: done

### Summary of implemented change

`uploadPhoto`, `deletePhoto` and `updatePhoto` in `src/stores/slices/photosSlice.ts`
now capture `{ userId, authSessionVersion }` at action entry and recheck the pair
before every post-await `set()` — ten sites in all, including the `onProgress`
callback `photoService.uploadPhoto` fires from inside its own await. A stale
continuation writes nothing to the shared store but still returns its true
outcome to its own caller. The in-flight Supabase request is untouched, and so
are `loadPhotos`, the photo components, `photoService`, and every policy.

The run began by applying the first attempt's saved patch
(`../../implementation-artifacts/story-4-guard-photo-continuations.attempted.patch`),
which applies forward cleanly onto baseline `2056ed1b`, then corrected it against
the resolved compression-scope intent rather than re-implementing it.

### Files changed

- `src/stores/slices/photosSlice.ts` — three identity guards (`ownsUpload`,
  `ownsDelete`, `ownsUpdate`) gating ten post-await writes, plus a slice docblock
  recording the new cross-slice dependency on `authSlice`.
- `tests/unit/stores/loaderIdentityGuards.test.ts` — the `photoService` mock
  gained four methods; 29 new cases across `uploadPhoto`, `deletePhoto`,
  `updatePhoto` and the same-account block.
- `_bmad-output/specs/spec-security-remediation/stories/4-guard-photo-continuations-across-accounts.md` —
  this spec: verification results, review triage log, and this section.

### Review findings breakdown

26 findings across four layers — high 0, medium 1, low 13, false 12, maybe-false 0.
Eight entries were patched, all at verdict `low`; four `defer` rows were carried
from the previous pass; twelve findings were rejected.

**Patches applied (8, all `low`):**

1. The two storage-warning writes were split into two owner-path cases with
   distinct percentages (85% pre-upload, 87% post-upload) — the previous single
   case used an every-call quota mock, so both writes produced an identical
   string and either could be deleted with the suite green.
2. Added `deletePhoto surfaces a failure` and `updatePhoto surfaces a rejected
   save and a thrown one` — the owner-path error writes were asserted only in
   the negative, and making them unreachable left the whole suite passing.
3. The quota-rejection case now asserts `isUploading` false and `uploadProgress`
   0; dropping the flag reset previously went undetected.
4. `uploadInput()`, `aPhoto()` and `cPhoto()` gained real return types
   (`PhotoUploadInput`, `SupabasePhoto`, `PhotoWithUrls`).
5. The three same-account-resignin cases now model reachable state — an empty
   gallery for upload, A's own re-loaded row for delete and update — instead of
   a store holding another account's row after A has signed back in.
6. `deletePhoto`'s success-guard comment no longer justifies itself with the one
   case in which the skipped write would have been correct.
7. The slice docblock now gives the reason `loadPhotos` stays on the weaker
   `userId`-only guard rather than only asserting that it does.
8. The photo block's test comment no longer cites `PhotoUploader.tsx` as the
   renderer of a stranded progress bar; that component is imported by nothing.

**Rejected findings, with reasons:** twelve, each recorded with its refutation in
the triage-log entry above. In outline: the phantom-row and success-UI findings
are refuted by `signedOutState()` emptying `photos` on every real account change
and by `PhotoUploader.tsx` being unimported; the `isOwn` branch-coverage finding
is refuted because `photoService` inserts the caller's own `user_id`; the guard-
idiom, closure-shape, check-count, conjunct-surface and docblock-surface findings
describe arrangements that produce no bad outcome, each confirmed by the mutation
matrix; and the two verification-gap `Other` notes were filed by their own layer
as non-defects.

**Deferred: none added this pass.** The four `defer` rows are all carries of rows
already logged on 2026-09-12, and the carry rule forbids deferring a carried row
again, so `deferred` stays `[]`.

> **Ledger note for a human.** Those four carried rows have **no** entry in
> `implementation-artifacts/deferred-work.md` and none in this frontmatter,
> because the previous pass halted on `intent gap` before its defer branch ever
> ran. They are real and pre-existing: (a) `loadPhotos` keeps the weaker
> `userId`-only guard; (b) `signedOutState()` never resets the app-wide `error`
> key — **medium**, and the cause behind several symptoms this story works
> around; (c) the post-upload warning ignores `warning === 'exceeded'`; (d) two
> concurrent same-account uploads let the first completion zero the shared
> `isUploading`/`uploadProgress`. If they should be tracked, they need adding to
> the ledger by hand.

### Follow-up review recommendation

`false`. This was a first pass; of the eight patched entries none was `high` and
none was `medium` — patched by verdict: high 0, medium 0, low 8.

### Verification performed

- `npm run typecheck` — exit 0 (`tsc -b --force`, all three projects).
- `npm run lint` — 0 errors, 3 warnings, all pre-existing in `EventCountdown.tsx`.
- `npm run test:unit` — 111 files, **2037** tests pass (2008 at baseline; +29).
- `npx vitest run tests/unit/services/photoService.idempotency.test.ts tests/unit/stores/loaderIdentityGuards.test.ts` — 95 pass. The idempotency file's
  isolated store, which has no `authSessionVersion`, still works.
- `fnox exec -- npm run build` — exit 0.
- Manual checks hold: the diff touches only the slice docblock and the three
  edited actions, and the only live `get().userId` reads left are `loadPhotos`'
  own guard (`:191`, `:198`, `:202`) and the three `owns*()` comparisons
  (`:90`, `:217`, `:272`).
- **Mutation matrix, re-run after patching.** Each of the ten identity rechecks
  was reverted individually: every one fails only cases inside its own `describe`
  block. Each of the three closures weakened to a `userId`-only compare fails
  only its own same-account-resignin case. Each of the six owner-path writes that
  review found unpinned — both warning writes, the quota-rejection flag reset,
  the delete catch write, the `!persisted` write and the update catch write —
  now fails exactly one case when removed.

### Residual risks

- **`error` outlives sign-out.** `signedOutState()` does not reset the app-wide
  `error` key, so a banner raised just *before* a switch still crosses into the
  next session. This story stops continuations from writing it; it does not stop
  a write that already landed. Carried `defer`, no ledger entry — see the note
  above.
- **The compression window is accepted behaviour, by decision.** A switch landing
  during `compressImage` enters `uploadPhoto` fresh under the new account, and the
  upload proceeds as that account's own. Resolved by Sallvain on 2026-09-12 and
  recorded in `remediation.md`; not a deferred item.
- **`isUploading` and `uploadProgress` reach no mounted UI today.** `usePhotos` is
  imported only by the unimported `PhotoUploader.tsx`, so guarding those two keys
  is protection for a consumer that does not yet exist. They are store keys the
  matrix names, so they are guarded and asserted, but no user-visible symptom
  currently depends on them.
- **Cross-account transitions are exercised at the store, not through the real
  auth path.** 13 cases drive the switch with a raw `setState`, deliberately:
  the file header records that routing them through `clearAuth` made the suite
  pass with five guards deleted. The six cases that do use real auth actions are
  what pin the `authSessionVersion` half.
