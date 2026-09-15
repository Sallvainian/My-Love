---
title: 'DW-100/DW-101: close the last two messages-writing identity-guard gaps'
type: 'bugfix'
created: '2026-09-14'
status: done
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized', 'multiple-goals']
deferred:
  - summary: >-
      initializeApp's mid-flight cases all change userId as well as
      authSessionVersion, so dropping the version half of stillCurrent()
      in settingsSlice stays green.
    evidence: |-
      The three mid-flight cases at settingsSlice.initializeApp.test.ts:215-335
      set userId to USER_C or null whenever they bump authSessionVersion.
      toggleFavorite has a same-account re-login case; initializeApp does not.
      Pre-existing in 84e6c8ea, not introduced by this pass.
    location: >-
      tests/unit/stores/settingsSlice.initializeApp.test.ts:215-335
    severity: medium
  - summary: >-
      No case changes identity a second time while the stale-path
      loadMessages() handoff is in flight, so deleting the inner pair
      recheck in the .then() stays green.
    evidence: |-
      settingsSlice.ts:163-165 re-checks userId and authSessionVersion
      before updateCurrentMessage(). The three handoff cases settle the
      handoff under a still-current incoming identity. Pre-existing in
      84e6c8ea.
    location: >-
      src/stores/slices/settingsSlice.ts:163-165
    severity: low
  - summary: >-
      Nothing makes the initializeApp stale-path handoff chain reject, so
      deleting its .catch() stays green. The test double's loadMessages
      also does not swallow errors the way production does.
    evidence: |-
      settingsSlice.ts:171-173 attaches .catch() because nothing awaits
      the chain. settingsSlice.initializeApp.test.ts:124-132's loadMessages
      rethrows into that catch, unlike messagesSlice.ts:97-99 which
      swallows. Pre-existing in 84e6c8ea.
    location: >-
      src/stores/slices/settingsSlice.ts:171-173
    severity: low
baseline_revision: fbe14ffa5c0775ab2ae6b50631d0249db7a3697a
---

<intent-contract>

## Intent

**Problem:** Two store actions write shared `messages` state after an `await` without capturing account identity first and re-checking it before the write — `messagesSlice.toggleFavorite` captured `userId` alone and admitted the gap in a comment (DW-100), and `settingsSlice.initializeApp` read `get().userId` live at two points separated by an `await` and wrote `messages` twice unguarded (DW-101). An account switch landing mid-flight writes the outgoing account's data into the incoming account's store.

**Approach:** Apply the capture-and-recheck idiom already used at seven other sites in `messagesSlice.ts` — destructure `{ userId: requestedBy, authSessionVersion: requestedInSession }` at action entry, define `stillCurrent()`, pass `requestedBy` to every service call, and gate every post-`await` `set()` on `stillCurrent()`. Add unit coverage for both actions in the existing guard suites. This branch already landed that shape in `84e6c8ea`; keep it, fill any gap, do not re-derive.

## Boundaries & Constraints

**Always:**
- Capture BOTH `userId` and `authSessionVersion`, never `userId` alone — `clearAuth` bumps the version on every sign-out, so the pair is what distinguishes "A → signed out → A again" from an uninterrupted A.
- Use the exact shape at `messagesSlice.ts:89-91`: a destructured capture plus a `stillCurrent()` arrow comparing both fields against live `get()`.
- In `initializeApp`, release the loading flag and set the module `isInitialized` flag on the stale path too. `setLoading(true)` is raised before the awaits and `isLoading` is app state that `signedOutState()` does not reset, so an early return that only skips the write leaves a permanent spinner.
- On `initializeApp`'s stale path, hand off to a fresh re-read under whichever identity is now current, instead of simply returning. Copy the body of `reloadRotationPool` (`src/stores/slices/authSlice.ts:204-210`): capture the POST-change pair, `void get().loadMessages()`, re-check that pair inside `.then()` before `get().updateCurrentMessage()`, and attach a `.catch()` because nothing awaits the chain. Withholding the write is only half the fix -- on a cold boot `messages` is `[]`, `reloadRotationPool` returns early on an empty pool (`authSlice.ts:202`), and `isInitialized = true` stops `initializeApp` ever re-running (`settingsSlice.ts:81`), so the incoming account is left with an empty pool, a null `currentMessage`, and a Retry button (`DailyMessage.tsx:130`) that cannot recover it.
- Leave `storageService.addMessages(...)` in the seeding branch unguarded, on the stale path too. The default rows are shared and carry no owner, so seeding them under a superseded identity is correct; skipping the seed would leave the database unseeded for every account.
- Do not restore the admitting `(DW-100)` comment on `toggleFavorite`. The comment must state that the pair is captured and rechecked, not that the recheck is missing.

**Never:**
- Do not touch `_bmad-output/implementation-artifacts/deferred-work.md`; the orchestrator records resolution.
- Do not change `messagesSlice.addMessage` (`:109-128`). Same unguarded shape, but a documented dead action deliberately left alone — guarding it is scope creep.
- Do not extract a shared helper for the idiom; it is copy-pasted by design across the existing sites.
- Do not route the stale-path handoff through `reloadRotationPool` itself. It is module-private to `authSlice.ts` and returns early when `messages` is empty (`authSlice.ts:202`) -- precisely the cold-boot state the stale path leaves behind. Inline the equivalent body in `settingsSlice` instead.
- Do not relax, remove or otherwise edit `reloadRotationPool`'s empty-pool early return, or any other line of `src/stores/slices/authSlice.ts`. `authSlice.ts:196-198` records why the early return exists ("Firing there would race that seed with a read of a still-empty store"); repairing the cold-boot hole at that level is a wider change than this bundle.
- Do not change service signatures in `src/services/storage.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| toggleFavorite, identity unchanged | Signed in as A; `messages` holds A's row with `isFavorite: false` | Service called with `(id, A)`; row flips to `isFavorite: true`; id appended to `messageHistory.favoriteIds` | No error expected |
| toggleFavorite, account switched mid-flight | A taps favorite; store switches to C (holding C's own `messages`) before the service settles | Neither `messages` nor `messageHistory.favoriteIds` written; C's seeded state untouched | No error expected |
| toggleFavorite, same-account re-login mid-flight | A taps favorite; `authSessionVersion` bumped before the service settles | Write skipped — `userId` alone would have matched | No error expected |
| toggleFavorite, service throws | `storageService.toggleFavorite` rejects | Existing `catch` logs and swallows; no `set()` | `console.error`, not re-thrown |
| initializeApp, identity unchanged, DB seeded | First read returns rows | Both reads receive the captured id; `set({ messages })` lands; `updateCurrentMessage()` runs; `setLoading(false)` | No error expected |
| initializeApp, identity unchanged, DB empty | First read returns `[]` | Defaults seeded via `addMessages`, re-read with the captured id, `set({ messages })` lands | No error expected |
| initializeApp, identity changed mid-flight, DB seeded | Signed in as A on a cold boot (`messages` starts `[]`); identity moves to C while the first `getAllMessages` is in flight | The stale `set({ messages })` is withheld and `updateCurrentMessage()` is NOT called directly; instead the handoff fires, `loadMessages()` reads under C's id, and `updateCurrentMessage()` runs from its `.then()` once C is confirmed still current. `messages` ends non-empty. `setLoading(false)` runs and `isInitialized` is still set | Handoff chain carries a `.catch()`; nothing awaits it |
| initializeApp, identity changed mid-flight, DB empty | DB unseeded, so the first read returns `[]`; identity moves to C while a read in the seeding branch is in flight | `addMessages` still seeds the shared defaults; the re-read's `set({ messages })` is withheld; the same handoff fires and C ends with a non-empty pool | Handoff chain carries a `.catch()` |
| initializeApp, sign-out mid-flight | Identity moves to `null` while a read is in flight | Same handoff; `loadMessages()` reads with `null` and lands the shared daily rows only -- none of the outgoing account's custom rows | No error expected |

</intent-contract>

## Code Map

- `src/stores/slices/messagesSlice.ts:130-159` -- `toggleFavorite`, DW-100. Capture at `:136-138`, `if (!stillCurrent()) return;` at `:143`, `set()` at `:145-155`. Comment at `:131-135` already states the guard. Keep this shape.
- `src/stores/slices/messagesSlice.ts:87-100` -- `loadMessages`. **Golden example; copy verbatim.** Same idiom at `loadCustomMessages` (`:374`), `createCustomMessage` (`:410`), `updateCustomMessage` (`:454`), `deleteCustomMessage` (`:494`), `exportCustomMessages` (`:557`), `importCustomMessages` (`:597`).
- `src/stores/slices/messagesSlice.ts:10-19` -- slice header stating the contract and why `authSessionVersion` is paired with `userId`.
- `src/stores/slices/messagesSlice.ts:109-128` -- `addMessage`. Dead action; leave unguarded.
- `src/stores/slices/settingsSlice.ts:75-188` -- `initializeApp`, DW-101. Capture at `:92-94`; `getAllMessages(requestedBy)` at `:130` and `:145`; gated `set({ messages })` at `:147-148` and `:150-151`; current-path `updateCurrentMessage()` at `:154-155`; stale-path handoff at `:156-174`; `setLoading(false)` at `:176`; `isInitialized = true` at `:178`. Module flags `isInitializing`/`isInitialized` declared `:49-50`, short-circuit `:81-83`. Keep this shape.
- `src/stores/slices/authSlice.ts:324` -- `authSessionVersion: get().authSessionVersion + 1` inside `discardAccountState`; read-only evidence for capturing the version.
- `src/stores/slices/authSlice.ts:201-218` -- `reloadRotationPool`. **Golden example for the stale-path handoff; copy `:204-210` verbatim.** `:202` is `if ((get().messages?.length ?? 0) === 0) return;`. `:196-198` states why it must stay. Read-only.
- `src/stores/slices/messagesSlice.ts:87-100` -- `loadMessages`, the action the handoff calls. It captures `{ userId, authSessionVersion }` at its own entry, so invoking it AFTER the identity moved reads under the new identity with no argument threading.
- `src/components/DailyMessage/DailyMessage.tsx:130` -- the Retry button's `initializeApp()` call. Dead once `isInitialized` latches; read-only, and NOT the recovery path.
- `src/stores/types.ts:50-69` -- `AppStateCreator` types every slice's `get()` as the composed `AppState`, so `settingsSlice` reads `userId`/`authSessionVersion` with no cast.
- `src/services/storage.ts:222-232, 331-351` -- `getAllMessages(userId)` and `toggleFavorite(messageId, userId)` already take a nullable owner. Read-only; signatures unchanged.
- `tests/unit/stores/loaderIdentityGuards.test.ts` -- guard suite. `toggleFavorite` describe `:657-736` already has the happy path plus the account-switch and same-account re-login cases. `loadMessages` mid-flight case `:641-654` is the shape those mirror. Helpers: `switchToUserC()` `:307`, `deferred()` `:200`, `flush()` `:244`, `toggleStoredFavorite` mock `:53` (wired `:140-141`), ids `A`/`C` `:193-194`, fixtures `aCustomMessage()` `:566` / `cRotationPool()` `:581`.
- `tests/unit/stores/settingsSlice.initializeApp.test.ts` -- standalone zustand store via `buildTestStore` `:99-141`; `TestState` `:25-36` includes `authSessionVersion` and `loadMessages`. Mid-flight cases: seeded `:215-257`, empty-DB `:259-299`, sign-out `:301-335`.
- `src/components/DailyMessage/DailyMessage.tsx:157` -- sole caller of `toggleFavorite`. Read-only.

## Tasks & Acceptance

**Execution:**
- `src/stores/slices/messagesSlice.ts` -- `toggleFavorite` must capture `{ userId: requestedBy, authSessionVersion: requestedInSession }`, define `stillCurrent()`, insert `if (!stillCurrent()) return;` between the `await` and the `set()`, pass `requestedBy` to `storageService.toggleFavorite`, and keep a comment that states the guard rather than admitting its absence -- closes DW-100. Present at `:130-159` on this baseline; edit only if that shape is missing.
- `src/stores/slices/settingsSlice.ts` -- `initializeApp` must capture the pair and define `stillCurrent()` before the `try`, pass `requestedBy` to both `getAllMessages` calls, and gate the two `set({ messages })` writes on `stillCurrent()`. Then branch on `stillCurrent()` around `updateCurrentMessage()`: when current, call it directly; when stale, fire the `loadMessages()` handoff specified in Boundaries instead of returning. `setLoading(false)` and `isInitialized = true` run on both paths -- closes DW-101. Present at `:92-178` on this baseline; edit only if that shape is missing.
- `tests/unit/stores/loaderIdentityGuards.test.ts` -- `toggleFavorite` must cover three cases: identity unchanged, account switch mid-flight, and same-account re-login that only bumps `authSessionVersion`. Present at `:657-736`; add any missing case.
- `tests/unit/stores/settingsSlice.initializeApp.test.ts` -- `TestState` must include `authSessionVersion` and a `loadMessages` the handoff can call. Must include THREE cases that change identity while `getAllMessages` is pending: seeded branch, empty-DB branch (first read settles `[]` so `storedMessages.length === 0` is entered), and sign-out to `null`. Each asserts BOTH halves: the stale `set({ messages })` did not land, AND the handoff read was issued under the NEW identity and left a non-empty pool. Present at `:215-335`; add any missing case.

**Acceptance Criteria:**
- Given the current suites, when the guard in either action is deleted, then at least one new case fails -- the coverage must not be satisfiable by the pre-fix code.
- Given `initializeApp` took its stale path, when `initializeApp()` is called again in the same page load, then it short-circuits on `isInitialized` rather than re-running -- the handoff, not a re-init, is what recovers the pool.
- Given `initializeApp` took its stale path on a cold boot (`messages` starting `[]`), when the handoff settles, then `messages` is non-empty and holds exactly what `getAllMessages` returns for the identity that is now current -- never the outgoing account's rows, and never `[]`.
- Given the seeding branch is reached with a stale identity, when the guard on its `set({ messages })` is deleted, then at least one case fails -- that branch must be entered by a case, not only the non-empty branch.
- Given no identity change anywhere, when the full unit suite runs, then existing `loadMessages`, `toggleFavorite`, `setAuthUser` and `initializeApp` cases pass unchanged.
- Given the repo after the change, when `npm run test:unit`, `npm run typecheck` and `npm run lint` run, then all three pass with no new failures.

## Spec Change Log

## Review Triage Log

### 2026-09-14 — Review pass
- verdicts: 14 findings — high 0, medium 1, low 6, false 7, maybe-false 0
- findings:
  - `[false]` `[reject]` The only new test does not pin the identity guard and collides with the AC that deleting a guard must fail a new case — the AC is satisfied by the mid-flight cases at `loaderIdentityGuards.test.ts:677-736`, which fail if `stillCurrent()` at `messagesSlice.ts:143` is deleted. The catch-path case covers a different matrix row and is not required to pin the guard.
  - `[low]` `[reject]` Execution, the I/O matrix, and the Code Map disagree on whether the fourth `toggleFavorite` case is in scope — the fix is to edit this spec. The matrix audit required the row; dropping the test would un-cover it.
  - `[low]` `[patch]` `toggleStoredFavorite.mockRejectedValue(failure)` was not `Once` and was not restored — changed to `mockRejectedValueOnce(failure)` at `loaderIdentityGuards.test.ts:745`.
  - `[false]` `[reject]` The new case never asserts `toggleStoredFavorite` was called with `(own.id, A)` — the happy path at `:669` already pins `requestedBy`. On the catch path the captured id does not change swallow-and-skip-set behaviour.
  - `[false]` `[reject]` The new case snapshots leftover `favoriteIds` instead of seeding `[42]` — an unguarded `set()` still appends `messageId`, so `toEqual(knownFavoriteIds)` fails, and the `isFavorite: false` assertion independently catches the flip.
  - `[medium]` `[defer]` `initializeApp` still has no A → signed-out → A / `authSessionVersion`-only case — all three mid-flight init tests also change `userId`. Pre-existing in `84e6c8ea`.
  - `[low]` `[defer]` No case changes identity a second time while the handoff `loadMessages()` is in flight — deleting the inner compare at `settingsSlice.ts:163-165` stays green. Pre-existing in `84e6c8ea`.
  - `[low]` `[defer]` Nothing makes the handoff chain reject, so deleting `.catch()` at `settingsSlice.ts:171-173` stays green, and the test double does not swallow like production `loadMessages`. Pre-existing in `84e6c8ea`.
  - `[false]` `[reject]` The `isInitialized` short-circuit AC is pinned only in the seeded stale case — `isInitialized = true` at `settingsSlice.ts:178` is a single statement after the current/stale branch; the seeded case at `:253-256` pins that it latched. It cannot be dropped from only the empty-DB or sign-out paths without restructuring.
  - `[low]` `[reject]` Spec 2's empty `deferred` / change log / triage log drop the prior pass's parked items — the fix is to edit this spec. Spec-2 is a new file; spec-1 still holds those parked rows.
  - `[low]` `[reject]` The matrix row "initializeApp, identity unchanged, DB seeded" says "Both reads receive the captured id" but the seeded path issues one `getAllMessages` — the fix is to edit this spec.
  - `[false]` `[reject]` Intent-alignment: this diff does not change `toggleFavorite` or `initializeApp` — spec-2 instructed to keep the `84e6c8ea` shape and edit only if missing. Both actions already capture the pair and recheck at HEAD.
  - `[false]` `[reject]` Intent-alignment: the added catch-path test is outside `intent.md` and survives full guard removal — extra coverage of the documented `catch` is not a bad outcome. The identity-guard cases remain in the committed suite.
  - `[false]` `[reject]` Intent-alignment: spec-2 restates the already-landed stale-path handoff that `intent.md` never stated — that handoff is the `/bmad-loop-resolve` decision already in production at `settingsSlice.ts:156-174`. Documenting it is not a divergence to fix.

## Design Notes

This worktree already contains the recovered implementation from `84e6c8ea` (`fix(stores): guard toggleFavorite and initializeApp on account identity`). The prior spec (`spec-dw-100-101-store-identity-guard-gaps.md`) recorded the `/bmad-loop-resolve dw-store-identity-guard-gaps` decision that the stale path re-reads under the identity now current. This spec carries that decision forward; do not revert the handoff to a bare `return`.

Golden example to copy (`src/stores/slices/messagesSlice.ts:89-96`):

```ts
const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
const stillCurrent = () =>
  get().userId === requestedBy && get().authSessionVersion === requestedInSession;

try {
  const messages = await storageService.getAllMessages(requestedBy);
  if (!stillCurrent()) return;
  set({ messages });
} catch (error) { /* ... */ }
```

Why the loading flag is handled differently in `initializeApp`: the guard suite's header records that a stranded loading flag is a permanently blank screen, not a cosmetic wobble. `isLoading` lives on `appSlice` and is absent from `signedOutState()`, so nothing else clears it. The stale path therefore skips only the account-scoped writes.

Why the stale path re-reads instead of just returning (resolution of the 2026-09-14 escalation): an earlier version of this intent said "`setAuthUser` owns refilling the pool". That premise is false on a cold boot. `reloadRotationPool` -- the refill `setAuthUser` fires -- returns early when `messages` is empty (`src/stores/slices/authSlice.ts:202`), and the array is not persisted, so on a cold boot it is empty precisely because the init being withheld is the one that would have filled it. `setAuthUser` itself documents the same dead end for the in-place-switch case at `authSlice.ts:267-270`: "nothing reloads the daily rows after an in-place switch -- `initializeApp` is guarded by a module flag and an App-level ref, both of which survive sign-out". The stale path is the cold-boot hole in that coverage, so it fills the hole locally with the same two lines `reloadRotationPool` would have run, rather than weakening the seed-race guard in a file outside this change.

Observed, out of scope: `messagesSlice.addMessage` (`:109-128`) has the same unguarded post-`await` `set()` shape but is a documented dead action with no caller and no ledger entry. Left untouched.

## Verification

**Commands:**
- `npx vitest run tests/unit/stores/loaderIdentityGuards.test.ts tests/unit/stores/settingsSlice.initializeApp.test.ts` -- expected: all cases pass, new ones included.
- `npm run test:unit` -- expected: full unit suite passes, no new failures.
- `npm run typecheck` -- expected: no NEW errors in the touched files (a worktree-only TS2883 baseline may be present).
- `npm run lint` -- expected: exit 0.

## Auto Run Result

Status: done

Summary of implemented change: DW-100 and DW-101 were already closed on this branch by `84e6c8ea` (`toggleFavorite` and `initializeApp` capture `{ userId, authSessionVersion }` and recheck before `set()`; `initializeApp`'s stale path hands off to `loadMessages()`). This pass added a catch-path unit case for the I/O matrix row "toggleFavorite, service throws" and recorded spec-2.

Files changed:
- `tests/unit/stores/loaderIdentityGuards.test.ts` — added `swallows a service rejection and does not write the favorite`, using `mockRejectedValueOnce`.
- `_bmad-output/implementation-artifacts/spec-dw-100-101-store-identity-guard-gaps-2.md` — spec-2 for this pass.

Review findings breakdown:
- Patches applied: 1 low — `mockRejectedValue` → `mockRejectedValueOnce`.
- Items deferred: 3 — initializeApp has no version-only mid-flight case (medium); no second identity change during handoff (low); handoff `.catch()` unpinned and test double does not swallow (low).
- Rejected: 10 — 7 false (AC already pinned by mid-flight cases; requestedBy pinned on happy path; leftover favoriteIds still detect a write; isInitialized is a single latched assignment; identity guards already at HEAD; extra catch-path coverage is not a defect; spec-2 documenting the resolve handoff is not a defect) and 3 low whose fix is a spec edit (Execution vs matrix vs Code Map; empty deferred vs spec-1 parked items; "both reads" wording on the seeded path).

Follow-up review recommendation: false. Patched this pass: high 0, medium 0, low 1.

Verification performed:
- `npx vitest run tests/unit/stores/loaderIdentityGuards.test.ts tests/unit/stores/settingsSlice.initializeApp.test.ts` — 2 files, 117 passed.
- `npm run test:unit` — 93 files, 1744 passed.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0.

Residual risks: initializeApp's version half of `stillCurrent()` is not isolated by a same-account re-login case; the stale-path handoff's inner recheck and `.catch()` are unpinned. Production still has those lines. `addMessage` remains an unguarded dead action, as specified.
