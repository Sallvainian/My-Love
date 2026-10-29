---
title: 'DW-321: leak checks serialize Error, Map and Set'
type: 'chore'
ticket: ''
created: '2026-10-29'
status: 'done'
baseline_revision: '553ac077f5cb841549b5de60d6927ca8c663c77a'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** DW-321 lists 31 unit-test leak checks that run plain `JSON.stringify` over store state. It writes an Error, a Map and a Set as `{}`, so a previous account's text held in one of them would pass the check unseen. DW-306 fixed this for the events file with `serializedStore()` in `tests/unit/stores/loaderIdentityGuardsFixture.ts`.

**Approach:** Give the fixture's replacer a value-taking form, `serialized(value)`, and make `serializedStore()` call `serialized(useAppStore.getState())`. Rewrite each listed site: the `useAppStore` sites in `loaderIdentityGuards.{moods,partner,customMessages,notes,photos,messages}.test.ts` and `signOutClearsAccountState.test.ts` use `serializedStore()`. The local-store and slice sites in `interactionsSubscription`, `notesSlice.localCopy`, `partnerSlice.localCopy`, `notesSlice.sessionGuard`, `settingsSlice.initializeApp` and `notesSlice.localCopyWrites` use `serialized(<the same value as before>)`. Each rewritten assertion keeps the value it serialized, the string it searched for and any failure message it carried. The only change is the serializer.

</intent-contract>

## Implementation Notes

Oneshot: about 35 changed lines across 14 test files, plus one small new module. The change is mechanical and production code is untouched.

`serialized` lives in a new import-free module, `tests/unit/stores/serializedState.ts`. The fixture's `serializedStore()` calls it, and the value-taking sites import it from there. The fixture itself imports `useAppStore`. Importing the fixture from `interactionsSubscription`, `settingsSlice.initializeApp`, `notesSlice.localCopy` or `notesSlice.localCopyWrites` would therefore evaluate the whole persisted store under those files' partial `vi.mock`s. Those files build an isolated store with `create` and never load `useAppStore`, and that evaluation would run persist hydration and `retireAnniversaryVault()` localStorage writes in them. The replacer still has one definition.

Done: the 21 `useAppStore` sites call `serializedStore()`. The six `loaderIdentityGuards.*` files add it to their existing fixture import, and `signOutClearsAccountState.test.ts` gains a fixture import, since it already loads `useAppStore`. The 10 local-store and slice sites call `serialized(...)` on the same value they passed to `JSON.stringify` before. Every search string and failure message is unchanged. Verification: the leftover-site grep finds no matches; `npx vitest run tests/unit/stores` passes 42 files with 751 tests; `npx eslint tests/unit/stores` exits 0; `npm run typecheck` exits 0. Nothing surprising came up.

## Plan Change Log

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` The header of `loaderIdentityGuardsFixture.ts` says it is shared by the `loaderIdentityGuards.*.test.ts` files only, but `signOutClearsAccountState.test.ts` now imports `serializedStore()` from it. Confirmed at `tests/unit/stores/loaderIdentityGuardsFixture.ts:2`. Fix: the header now names that second consumer. Verification re-ran green.

## Verification

**Commands:**
- `grep -rnE "JSON\.stringify\((useAppStore\.getState|store\.getState|state\(\)|saved\))" tests/unit` -- expected: no matches
- `npx vitest run tests/unit/stores` -- expected: all pass
- `npx eslint tests/unit/stores && npm run typecheck` -- expected: no errors in touched files

## Auto Run Result

Status: built

**Summary:** The 31 DW-321 leak checks no longer run plain `JSON.stringify`, which writes an Error, a Map or a Set as `{}`. They use a replacer that spells those types out. The replacer now lives in an import-free `serialized(value)`. `serializedStore()` applies it to `useAppStore`. Each assertion keeps the value it serialized, the string it searched for and its failure message.

**Files changed:**
- `tests/unit/stores/serializedState.ts`: new; holds `serialized(value)`, the Error/Map/Set replacer, with no imports.
- `tests/unit/stores/loaderIdentityGuardsFixture.ts`: `serializedStore()` delegates to `serialized`, and the header names its new consumer.
- `tests/unit/stores/loaderIdentityGuards.{moods,partner,customMessages,notes,photos,messages}.test.ts`: 16 sites use `serializedStore()`.
- `tests/unit/stores/signOutClearsAccountState.test.ts`: 5 sites use `serializedStore()`.
- `tests/unit/stores/{interactionsSubscription,notesSlice.localCopy,partnerSlice.localCopy,notesSlice.sessionGuard,settingsSlice.initializeApp,notesSlice.localCopyWrites}.test.ts`: 10 sites use `serialized(<same value>)`.

**Review findings:** 1 patch applied (low): the fixture header comment. Nothing deferred, nothing rejected.

**Follow-up review recommended:** false. Patched this pass: high 0, medium 0, low 1.

**Verification:**
- The leftover-site grep finds no matches.
- `npx vitest run tests/unit/stores`: 42 files and 751 tests pass.
- `npx eslint tests/unit/stores`: exit 0.
- `npm run typecheck`: exit 0.
- Every run above came both before and after the review patch.

**Residual risks:** None known. No production code changed.
