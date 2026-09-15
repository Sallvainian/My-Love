---
title: 'DW-100/DW-101: close the last two messages-writing identity-guard gaps'
type: 'bugfix'
created: '2026-09-14'
status: ready-for-dev
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
baseline_revision: 25338e26a09fc2ef6f2feae8f7494e1084c63bff
---

<intent-contract>

## Intent

**Problem:** Two store actions write shared `messages` state after an `await` without capturing account identity first and re-checking it before the write — `messagesSlice.toggleFavorite` captures `userId` alone and admits the gap in a comment (DW-100), and `settingsSlice.initializeApp` reads `get().userId` live at two points separated by an `await` and writes `messages` twice unguarded (DW-101). An account switch landing mid-flight writes the outgoing account's data into the incoming account's store.

**Approach:** Apply the capture-and-recheck idiom already used at seven sites in `messagesSlice.ts` — destructure `{ userId: requestedBy, authSessionVersion: requestedInSession }` at action entry, define `stillCurrent()`, pass `requestedBy` to every service call, and gate every post-`await` `set()` on `stillCurrent()`. Add unit coverage for both actions in the existing guard suites.

## Boundaries & Constraints

**Always:**
- Capture BOTH `userId` and `authSessionVersion`, never `userId` alone — `clearAuth` bumps the version on every sign-out, so the pair is what distinguishes "A → signed out → A again" from an uninterrupted A.
- Use the exact shape at `messagesSlice.ts:88-91`: a destructured capture plus a `stillCurrent()` arrow comparing both fields against live `get()`.
- In `initializeApp`, release the loading flag and set the module `isInitialized` flag on the stale path too. `setLoading(true)` is raised before the awaits and `isLoading` is app state that `signedOutState()` does not reset, so an early return that only skips the write leaves a permanent spinner.
- On `initializeApp`'s stale path, hand off to a fresh re-read under whichever identity is now current, instead of simply returning. Copy the body of `reloadRotationPool` (`src/stores/slices/authSlice.ts:204-210`): capture the POST-change pair, `void get().loadMessages()`, re-check that pair inside `.then()` before `get().updateCurrentMessage()`, and attach a `.catch()` because nothing awaits the chain. Withholding the write is only half the fix -- on a cold boot `messages` is `[]`, `reloadRotationPool` returns early on an empty pool (`authSlice.ts:202`), and `isInitialized = true` stops `initializeApp` ever re-running (`settingsSlice.ts:81`), so the incoming account is left with an empty pool, a null `currentMessage`, and a Retry button (`DailyMessage.tsx:130`) that cannot recover it.
- Leave `storageService.addMessages(...)` in the seeding branch unguarded, on the stale path too. The default rows are shared and carry no owner, so seeding them under a superseded identity is correct; skipping the seed would leave the database unseeded for every account.
- Replace the `(DW-100)` comment at `messagesSlice.ts:134` — leaving it once the guard lands makes the comment a lie.

**Never:**
- Do not touch `_bmad-output/implementation-artifacts/deferred-work.md`; the orchestrator records resolution.
- Do not change `messagesSlice.addMessage` (:110-127). Same unguarded shape, but a documented dead action deliberately left alone — guarding it is scope creep.
- Do not extract a shared helper for the idiom; it is copy-pasted by design across ~19 sites.
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

- `src/stores/slices/messagesSlice.ts:130-154` -- `toggleFavorite`, DW-100. Captures `userId` only at :135; comment :131-134 admits the missing recheck; unguarded `set()` :140-150 writes `messages` and `messageHistory.favoriteIds`.
- `src/stores/slices/messagesSlice.ts:88-96` -- `loadMessages`. **Golden example; copy verbatim.** Same idiom at `loadCustomMessages` (368-371), `createCustomMessage` (404-407), `updateCustomMessage` (448-451), `deleteCustomMessage` (488-491), `exportCustomMessages` (551-554), `importCustomMessages` (591-594).
- `src/stores/slices/messagesSlice.ts:10-19` -- slice header stating the contract and why `authSessionVersion` is paired with `userId`.
- `src/stores/slices/settingsSlice.ts:75-165` -- `initializeApp`, DW-101. Live `get().userId` at :126 and :141; unguarded `set({ messages })` at :144 and :147; `updateCurrentMessage()` at :151; `setLoading(true)` at :89, `setLoading(false)` at :153; module flags `isInitializing`/`isInitialized` declared :49-50, written :86, :155, :163.
- `src/stores/slices/authSlice.ts:324` -- `authSessionVersion: get().authSessionVersion + 1` inside `discardAccountState`; read-only evidence for capturing the version.
- `src/stores/slices/authSlice.ts:201-210` -- `reloadRotationPool`. **Golden example for the stale-path handoff; copy `:204-210` verbatim.** `:202` is `if ((get().messages?.length ?? 0) === 0) return;`, the empty-pool early return that makes the cold-boot case unrecoverable from here; `:196-198` states why it must stay. Read-only.
- `src/stores/slices/messagesSlice.ts:87-100` -- `loadMessages`, the action the handoff calls. It captures `{ userId, authSessionVersion }` at its own entry, so invoking it AFTER the identity moved reads under the new identity with no argument threading.
- `src/components/DailyMessage/DailyMessage.tsx:130` -- the Retry button's `initializeApp()` call. Dead once `isInitialized` latches; read-only, and NOT the recovery path.
- `src/stores/types.ts:50-69` -- `AppStateCreator` types every slice's `get()` as the composed `AppState`, so `settingsSlice` reads `userId`/`authSessionVersion` with no cast.
- `src/services/storage.ts:222-232, 331-350` -- `getAllMessages(userId)` and `toggleFavorite(messageId, userId)` already take a nullable owner. Read-only; signatures unchanged.
- `tests/unit/stores/loaderIdentityGuards.test.ts` -- guard suite. `toggleFavorite` describe :657-676 (happy path only); `loadMessages` mid-flight case :640-654 is the shape to mirror. Existing helpers: `switchToUserC()` :307, `deferred()` :200, `flush()` :244, `toggleStoredFavorite` mock :53 (wired :140-141), ids `A`/`C` :194-195, fixtures `aCustomMessage()`/`cRotationPool()`.
- `tests/unit/stores/settingsSlice.initializeApp.test.ts` -- standalone zustand store via `buildTestStore` :35-66; `TestState` :24-33 has `userId` but **no `authSessionVersion`**, so a recheck would currently compare `undefined === undefined`.
- `src/components/DailyMessage/DailyMessage.tsx:157` -- sole caller of `toggleFavorite`. Read-only.

## Tasks & Acceptance

**Execution:**
- `src/stores/slices/messagesSlice.ts` -- in `toggleFavorite`, extend the :135 capture to `{ userId: requestedBy, authSessionVersion: requestedInSession }`, add `stillCurrent()`, insert `if (!stillCurrent()) return;` between the `await` and the `set()`, and rewrite the :131-134 comment to state the guard instead of admitting its absence -- closes DW-100.
- `src/stores/slices/settingsSlice.ts` -- in `initializeApp`, capture the pair and define `stillCurrent()` before the `try`, pass `requestedBy` to both `getAllMessages` calls, and gate the two `set({ messages })` writes on `stillCurrent()`. Then branch on `stillCurrent()` around `updateCurrentMessage()` (`:151`): when current, call it directly as today; when stale, fire the `loadMessages()` handoff specified in Boundaries instead of returning. `setLoading(false)` and `isInitialized = true` run on both paths -- closes DW-101.
- `tests/unit/stores/loaderIdentityGuards.test.ts` -- add two mid-flight cases to the `toggleFavorite` describe: an account switch, and a same-account re-login that only bumps `authSessionVersion` -- the existing case pins only the happy path, so the guard could be deleted and stay green.
- `tests/unit/stores/settingsSlice.initializeApp.test.ts` -- add `authSessionVersion` to `TestState` and the store, plus whatever the handoff needs to be observable (`messages`, and a `loadMessages` that records the id it read under). Add THREE cases that change identity while `getAllMessages` is pending: one on the seeded branch, one on the empty-DB branch -- settle the first read with `[]` so `storedMessages.length === 0` is actually entered -- and one sign-out to `null`. Each asserts BOTH halves: the stale `set({ messages })` did not land, AND the handoff read was issued under the NEW identity and left a non-empty pool. A prior attempt shipped two cases that both settled the first read with a non-empty array, so the seeding branch had zero coverage and its guard could be deleted green.

**Acceptance Criteria:**
- Given the current suites, when the guard in either action is deleted, then at least one new case fails -- the coverage must not be satisfiable by the pre-fix code.
- Given `initializeApp` took its stale path, when `initializeApp()` is called again in the same page load, then it short-circuits on `isInitialized` rather than re-running -- the handoff, not a re-init, is what recovers the pool.
- Given `initializeApp` took its stale path on a cold boot (`messages` starting `[]`), when the handoff settles, then `messages` is non-empty and holds exactly what `getAllMessages` returns for the identity that is now current -- never the outgoing account's rows, and never `[]`.
- Given the seeding branch is reached with a stale identity, when the guard on its `set({ messages })` is deleted, then at least one case fails -- that branch must be entered by a case, not only the non-empty branch.
- Given no identity change anywhere, when the full unit suite runs, then existing `loadMessages`, `toggleFavorite`, `setAuthUser` and `initializeApp` cases pass unchanged.
- Given the repo after the change, when `npm run test:unit`, `npm run typecheck` and `npm run lint` run, then all three pass with no new failures.

## Spec Change Log

### 2026-09-14 — escalation resolved (`/bmad-loop-resolve dw-store-identity-guard-gaps`)

The prior run escalated `intent gap`: DW-101's guard withheld the stale `messages` write but left the
incoming account with an empty pool, `isInitialized` latched, and a dead Retry button on cold boot.
The intent did not say what the stale path owed the incoming account.

**Decision:** the stale path re-reads under the identity that is now current. It withholds the stale
write as before, still releases the loading flag and still latches `isInitialized`, and additionally
hands off to `get().loadMessages()` + a re-checked `updateCurrentMessage()`, mirroring
`reloadRotationPool`'s body. This closes the DW-101 leak with no availability regression.

Changed in this amendment: the "Never" bullet forbidding a rotation-pool reload on the stale path is
removed (its premise, "`setAuthUser` owns refilling the pool", is refuted by `authSlice.ts:202`) and
replaced with two narrower prohibitions; the handoff and the unguarded seeding `addMessages` are added
to "Always"; the single mid-flight I/O row becomes three (seeded, empty-DB, sign-out); the
`settingsSlice` execution and test bullets and the acceptance criteria are rewritten to require and
pin the handoff and the seeding branch; four read-only Code Map anchors are added.

Rejected alternatives: leaving `isInitialized` false (recovery becomes a 10-second blank screen plus a
manual Retry tap, since `App.tsx`'s own ref blocks any automatic re-init); relaxing
`reloadRotationPool`'s empty-pool early return (reintroduces the seed race `authSlice.ts:196-198`
exists to prevent, in a file outside this change); shipping DW-100 alone and closing DW-101 won't-fix.

## Review Triage Log

### 2026-09-14 — Review pass
- verdicts: 27 findings — high 5, medium 2, low 16, false 4, maybe-false 0
- findings:
  - `[high]` `[intent_gap]` blind-hunter: cold-boot account switch leaves the incoming account with no rotation pool and no path to one; the spec's "`setAuthUser` owns refilling the pool" premise is false — demonstrated against the real composed store: with the guard, `messages` stays `[]` and `currentMessage` stays `null` after `clearAuth()`+`setAuthUser(C)` lands mid-init; with the guard removed the same probe writes A's pool into C's store, so the change causes the dead screen.
  - `[high]` `[intent_gap]` blind-hunter: `isInitialized = true` on the stale path makes the skipped write permanent for the page load — probe confirmed the second `initializeApp()` logs "Skipping - app already initialized" and issues no read, so `DailyMessage.tsx:130`'s Retry button is dead in exactly the state that renders it.
  - `[medium]` `[intent_gap]` blind-hunter: the seeding-branch guard has zero coverage, falsifying this spec's own AC ("when the guard in either action is deleted, at least one new case fails") — both new `settingsSlice` cases settle `getAllMessages` with a non-empty array, so neither enters the `storedMessages.length === 0` branch. Grouped with the verification-gap layer's filed gap; moot under the cascade.
  - `[low]` `[reject]` blind-hunter: `addMessages` runs unguarded on the stale path — true but benign (shared non-account daily rows), and its proposed fixes are a spec edit or an early return that would leave the database unseeded.
  - `[low]` `[defer]` blind-hunter: the `catch` path's `setError('Failed to initialize app')` is unguarded, and `error` is absent from `signedOutState()` — real, but pre-existing and untouched by this diff.
  - `[low]` `[intent_gap]` blind-hunter: the copied `deferred<T>()` drops `fail` and `promise.catch(() => {})` — confirmed against `loaderIdentityGuards.test.ts:200-211`, which carries both plus the comment explaining that an unhandled rejection fails the whole file. Moot under the cascade.
  - `[false]` `[reject]` blind-hunter: three `stillCurrent()` calls should collapse to one captured boolean — refuted: no `await` separates the `set()` gate from the `updateCurrentMessage()` gate, so they cannot drift, and a single capture hoisted above the seeding branch's three awaits would be computed too early and let a stale write through.
  - `[low]` `[reject]` blind-hunter: `seedAsOnScreen(rows: unknown[])` is untyped — the file's store-seeding idiom is already `as unknown as Parameters<typeof useAppStore.setState>[0]` throughout, and the proposed `Message[]` would reject `aCustomMessage()`'s extra `userId`/`active`/`tags` fields on excess-property check, so the fix is not a direct correction.
  - `[low]` `[intent_gap]` blind-hunter: the leak sweep and the captured-id assertion are present in one new case and missing from three. Moot under the cascade.
  - `[low]` `[intent_gap]` blind-hunter: the same-account `settingsSlice` case asserts `messages` equals `[]`, which `buildTestStore` already initialises to `[]` — confirmed inert. Moot under the cascade.
  - `[low]` `[defer]` blind-hunter: the `addMessage` observation has no route to the ledger (deferred below); the companion claim that the Code Map's line anchors go stale is rejected, since its fix edits this build's spec.
  - `[high]` `[intent_gap]` edge-case-hunter: sign-out during the initial read leaves the pool unseeded, Home blank and Retry dead — same root cause as the first two rows; its suggested guard (leave `isInitialized` false) is one of the competing resolutions the intent does not select between.
  - `[low]` `[defer]` edge-case-hunter: the incoming account sees the outgoing init's error banner — same pre-existing `catch` as above.
  - `[low]` `[defer]` edge-case-hunter: a concurrent `loadMessages` that drops the row mid-write makes an unfavorite append the id to `favoriteIds` — real, but the `set()` body is unchanged by this diff, so pre-existing.
  - `[low]` `[reject]` edge-case-hunter: `storageService.toggleFavorite` resolves without writing when the row is not visible or the read failed, while the UI flips — pre-existing and documented as deliberately preserved at `src/services/storage.ts:299-303`; the fix would change a service signature the intent-contract forbids touching.
  - `[high]` `[intent_gap]` edge-case-hunter: `reloadRotationPool` returns early when `messages` is empty, which is the exact cold-boot state the stale path leaves behind — confirmed at `src/stores/slices/authSlice.ts:202`; this is the refutation of the spec's compensating premise.
  - `[medium]` `[intent_gap]` verification-gap (pre-verified): the seeding branch's captured-id argument and its guard are both unverified — that layer reverted the branch to its pre-fix shape and `npm run test:unit` stayed green at 93 files / 1743 tests. Grouped with the blind-hunter row above; moot under the cascade.
  - `[high]` `[intent_gap]` verification-gap: a mid-flight identity change during the first `initializeApp` now leaves the incoming account permanently pool-less where it previously got the wrong pool — same root cause, independently traced through `authSlice.ts:202`, `:277` and `:284-285`.
  - `[low]` `[intent_gap]` verification-gap: `expect(messages).toEqual(cRotationPool())` in the new switch case does no work — confirmed, `aCustomMessage()` is id 7 and `cRotationPool()[0]` is id 1, so the optimistic `map` matches nothing either way; the case is still sound via its `favoriteIds` assertion. Moot under the cascade.
  - `[false]` `[reject]` intent-alignment: the settingsSlice guard uses positive wraps instead of the golden early return — refuted by the code: `isInitialized = true` and `setLoading(false)` sit after the writes inside the `try`, so an early return at the golden shape would skip both.
  - `[low]` `[defer]` intent-alignment: a favorite made *before* a switch still carries the outgoing account's id into the incoming account's `favoriteIds` — confirmed at `src/stores/slices/authSlice.ts:321`, which rebuilds `messageHistory` while pruning only `shownMessages`. Pre-existing.
  - `[false]` `[reject]` intent-alignment: DW-101's guard is pinned only at the field-compare surface — refuted: the guard suite's own header argues direct identity switching is the stronger discriminator, and two independent mutation runs confirmed the `authSessionVersion` half fails when degraded to an id-only compare.
  - `[low]` `[intent_gap]` intent-alignment: the new test comments assert a production race that DW-101's ledger entry explicitly says was never demonstrated. Moot under the cascade.
  - `[low]` `[defer]` intent-alignment: `messagesSlice.addMessage` is a third messages writer that `set()`s after an await with no capture at all, contradicting the intent's "last two" framing — deferred below rather than fixed, since the intent-contract excludes it.
  - `[low]` `[reject]` intent-alignment: the added error-path case is outside the intent and survives full guard removal — it exists to cover a row of this spec's own I/O matrix, and deleting passing coverage of documented behaviour is not an improvement.
  - `[false]` `[reject]` intent-alignment: the artifact surface (spec file added, ledger untouched) — no bad outcome asserted; the ledger prohibition was respected.
  - `[low]` `[reject]` intent-alignment: the DW-101 ledger entry's `:143,:147` is off by one against HEAD's `:144,:147` — the fix edits `deferred-work.md`, which the invocation forbids.

## Design Notes

Golden example to copy (`src/stores/slices/messagesSlice.ts:88-96`):

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

Why the stale path re-reads instead of just returning (resolution of the 2026-09-14 escalation): an
earlier version of this intent said "`setAuthUser` owns refilling the pool". That premise is false on
a cold boot. `reloadRotationPool` -- the refill `setAuthUser` fires -- returns early when `messages`
is empty (`src/stores/slices/authSlice.ts:202`), and the array is not persisted, so on a cold boot it
is empty precisely because the init being withheld is the one that would have filled it. `setAuthUser`
itself documents the same dead end for the in-place-switch case at `authSlice.ts:267-270`: "nothing
reloads the daily rows after an in-place switch -- `initializeApp` is guarded by a module flag and an
App-level ref, both of which survive sign-out". The stale path is the cold-boot hole in that coverage,
so it fills the hole locally with the same two lines `reloadRotationPool` would have run, rather than
weakening the seed-race guard in a file outside this change.

Observed, out of scope: `messagesSlice.addMessage` (:110-127) has the same unguarded post-`await` `set()` shape but is a documented dead action with no caller and no ledger entry. Left untouched.

## Verification

**Commands:**
- `npx vitest run tests/unit/stores/loaderIdentityGuards.test.ts tests/unit/stores/settingsSlice.initializeApp.test.ts` -- expected: all cases pass, new ones included.
- `npm run test:unit` -- expected: full unit suite passes, no new failures.
- `npm run typecheck` -- expected: no NEW errors in the touched files (a worktree-only TS2883 baseline may be present).
- `npm run lint` -- expected: exit 0.

