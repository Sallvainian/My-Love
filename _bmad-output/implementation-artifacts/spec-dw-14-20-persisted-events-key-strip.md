---
title: 'Strip a stale events key from the persisted blob on read (DW-14, DW-20)'
type: 'bugfix'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      The read-side strip covers the `events` key only; a persisted blob carrying
      `eventsIsLoading` or `eventsError` would still rehydrate those two.
    evidence: |-
      `STALE_PERSISTED_KEYS` (src/stores/useAppStore.ts:74) lists `moods` and `events`.
      A blob carrying `eventsIsLoading: true` would rehydrate it, and `loadEvents` bails
      at `if (!requestedBy) return;` (src/stores/slices/eventsSlice.ts:118) *before*
      raising the flag — so on a signed-out start nothing clears it until the next
      sign-in, leaving a stranded loading state. `eventsError` would likewise show a
      stale banner. Neither carries couple data, so this is not the disclosure class
      DW-14/DW-20 describe, and both are the same unreachability class as the original
      entries: no build has ever written any events key to localStorage. Excluded from
      this change on the authority of the bundle intent, which names the `events` key
      alone ("Strip a stale `events` key out of the persisted blob on read").
    location: >-
      src/stores/useAppStore.ts:74
    severity: low
baseline_revision: 'c68f347f82e396f22db051d178959a137ea5bcc9'
---

<intent-contract>

## Intent

**Problem:** `partialize` in `useAppStore.ts` keeps `events` out of new localStorage writes, but as the comment at `useAppStore.ts:111-114` records, it "stops NEW writes, but it does not govern reads" — so the storage adapter explicitly deletes `data.state.moods` on the way in and has no equivalent guard for `events`. Events are couple-scoped Supabase-only data, so a blob carrying an `events` key would rehydrate one couple's dates into the next account's session on a shared device — the same leak class the moods strip was added to close.

**Approach:** Extend the existing strip block in the adapter's `getItem` so `events` is deleted alongside `moods`, reusing the one `mutated` flag and the single re-serialize it already governs. Mirror the read-side coverage `persistedMoods.test.ts` already has onto `persistedEvents.test.ts`, and retire that file's docblock note recording the gap as deferred.

## Boundaries & Constraints

**Always:** Keep `version: 0` at `useAppStore.ts:87` — the persist version is pinned and must not be bumped to achieve this. Keep the strip inside the existing `getItem` block and reuse the existing `mutated` flag so the blob is still re-serialized at most once. Preserve every allowlisted key (`settings`, `isOnboarded`, `messageHistory`) — stripping must not look like corruption and must not trip the adapter's clear-the-whole-blob path. When no stale key is present, `getItem` must still return the original `str` untouched.

**Never:** Do not add a second read pass, a second `JSON.parse`, or a second `JSON.stringify`. Do not change `partialize` — the write side is already correct and is already pinned by the existing test. Do not generalise the strip into a full mirror of the `partialize` allowlist (dropping every non-allowlisted key); that is a larger behavioural change than this intent asks for. Do not strip `eventsIsLoading` or `eventsError` (see Design Notes). Do not touch `onRehydrateStorage`, the slices, or any component.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Stale events blob | `my-love-storage` holds `state` with `events: [...]`, `isOnboarded`, `messageHistory` | `data.state.events` deleted before return; store hydrates with `events: []` (the slice default); `isOnboarded` and `messageHistory` survive | No error expected; no clear-blob path taken |
| Both stale keys | `state` holds `moods` and `events` | Both deleted in the same pass; exactly one re-serialize | No error expected |
| Clean blob (today's reality) | `state` holds only allowlisted keys | Nothing deleted; `getItem` returns the original `str` unchanged | No error expected |
| No state object | `{"version":0}` with no `state` | No strip attempted; no throw | Existing `data.state &&` guard |
| Absent / unparseable blob | key missing, or invalid JSON | Unchanged: `null` returned, or key removed and `null` returned | Existing early return and `catch` |

</intent-contract>

## Code Map

- `src/stores/useAppStore.ts:111-125` -- the strip block to extend: the moods comment, the `let mutated = false`, and `if (data.state && 'moods' in data.state) { delete data.state.moods; mutated = true; }`. This is the only edit site in `src/`.
- `src/stores/useAppStore.ts:127-143` -- the settings schema check that also sets `mutated`, then `return mutated ? JSON.stringify(data) : str;`. The extension must keep flowing through this single return.
- `src/stores/useAppStore.ts:87` -- `version: 0, // State schema version (matches test fixtures)`. Read-only.
- `src/stores/useAppStore.ts:153-179` -- `partialize`: allowlists `settings`, `isOnboarded`, `messageHistory` only. Read-only; explains why the write side already holds.
- `src/stores/slices/eventsSlice.ts:46-49` -- `EventsSlice` declares `events: CoupleEvent[]`, `eventsIsLoading: boolean`, `eventsError: string | null`. `:91-93` sets the defaults (`events: []`), which is what a stripped read must fall back to. Read-only.
- `src/stores/slices/eventsSlice.ts:107-119` -- `loadEvents` bails at `if (!requestedBy) return;` *before* raising `eventsIsLoading`. Read-only; relevant to the Design Notes exclusion.
- `src/stores/slices/authSlice.ts:130-136` -- `signedOutState()` resets all three events keys. Read-only; the in-memory half of the same guarantee.
- `src/components/RelationshipTimers/EventCountdown.tsx:68-71` -- `getCalendarDaysDiff` calls `date.getFullYear()`. Read-only; a JSON-rehydrated event carries `date` as a **string**, so the stale blob is a `TypeError` risk on top of the disclosure risk.
- `tests/unit/stores/persistedEvents.test.ts` -- 75 lines. Write-side test at `:45-74` stays. The docblock `:16-22` is the "Scope note" recording this exact gap as deferred and must be replaced. Uses `@/stores/useAppStore` (the `@/` alias is tests-only).
- `tests/unit/stores/persistedMoods.test.ts:109-119` -- the read-side pattern to mirror: seed the key, `vi.resetModules()`, import the store, assert on `getState()`. Note the adapter mutates only what it hands Zustand — it does **not** rewrite localStorage — so read-side assertions must target store state, not the raw key. Read-only.

## Tasks & Acceptance

**Execution:**
- `src/stores/useAppStore.ts` -- replace the single-key moods `if` with a module-scope list of stale keys (`moods`, `events`) walked in one loop that sets the existing `mutated` flag; update the adjacent comment so it explains both keys and states why `events` is stripped (couple-scoped, Supabase-only, shared-device rehydration) -- closes the read-side half that `partialize` cannot cover.
- `tests/unit/stores/persistedEvents.test.ts` -- replace the docblock "Scope note" that records the deferral with the now-guaranteed read-side behaviour, and add read-side cases covering the I/O matrix: stale `events` does not reach store state, the surrounding persisted keys survive the strip, and a blob carrying both `moods` and `events` is cleared of both -- the write-side test alone cannot observe the read path.

**Acceptance Criteria:**
- Given a `my-love-storage` blob whose `state` contains an `events` array, when the store module is imported and hydrates, then `useAppStore.getState().events` is `[]`.
- Given that same blob also contains `isOnboarded: true` and a `messageHistory` object, when the store hydrates, then both are still present in store state — the strip did not trigger the corruption path that clears the whole blob.
- Given a blob whose `state` contains both `moods` and `events`, when the store hydrates, then `getState().moods` and `getState().events` are both `[]`.
- Given a blob whose `state` contains no stale keys, when the store hydrates, then every persisted key in it reaches store state unchanged and none is dropped.
- Given the change is complete, when the persisted blob is inspected, then `version` is still `0` and `partialize` is unmodified.

## Spec Change Log

## Design Notes

**Why only `events`, not `eventsIsLoading` / `eventsError`.** Both ledger entries and the intent name the `events` key specifically, and the harm they describe is cross-account disclosure of couple data. The other two keys are transient UI state: they carry no couple data, `signedOutState()` already resets them in memory, and no build has ever written any of the three. They are deliberately left out rather than overlooked. The residual if one ever *were* on disk is cosmetic and self-correcting on the signed-in path — worth noting only because `loadEvents` bails before raising the flag when `userId` is null (`eventsSlice.ts:118`), so a rehydrated `eventsIsLoading: true` would sit until the next sign-in.

**Shape of the edit.** A named module-scope list plus one loop, rather than a second `if` block: it keeps the two keys in one place for the next slice that needs the same protection, and it preserves the existing semantics exactly (`key in data.state` → `delete` → `mutated = true`). `data` is the untyped `JSON.parse` result, so indexed deletion needs no new types.

```ts
const STALE_PERSISTED_KEYS = ['moods', 'events'] as const;
// ...inside getItem, replacing the moods-only branch:
let mutated = false;
if (data.state) {
  for (const key of STALE_PERSISTED_KEYS) {
    if (key in data.state) {
      delete data.state[key];
      mutated = true;
    }
  }
}
```

**Verified, not assumed.** A throwaway probe seeded `state.events` and imported the store: `getState().events` came back as the seeded array with `date` still a string, confirming the read path is unguarded today. The probe was deleted; the permanent form is the new test.

## Verification

**Commands:**
- `npx vitest run tests/unit/stores/persistedEvents.test.ts tests/unit/stores/persistedMoods.test.ts` -- expected: all pass. Baseline before the change is 4 passing; the new read-side cases must fail against unmodified `useAppStore.ts` before they pass with it.
- `npm run test:unit` -- expected: no new failures versus the pre-change run. Capture the pre-change totals first; this worktree is judged against its own baseline, not against zero.
- `npm run lint` -- expected: clean for `src/` and `tests/`.
- `npm run typecheck` -- expected: no *new* errors. This is a bmad-loop worktree, where `tsc -b --force` has a known pre-existing TS2883 baseline; record the error set before the change and compare, rather than requiring an empty result.

## Review Triage Log

### 2026-08-19 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 1: (high 0, medium 0, low 1)
- dismissed:
  - Review-layer collection shortfall — all four layers (`blind-hunter`, `edge-case-hunter`, `verification-gap`, `intent-alignment`) were launched in one message against the staged diff, but this harness spawns subagents detached and returned no collectable output in-turn. Rather than sleep-wait (the documented bmad-loop stall), classification was performed directly against `{diff_file}` and the code at each named site. This is a process note, not a finding about the change; it is recorded here so the pass is not read as a completed four-layer review.
  - Comment line references in the new test docblock could be stale — refuted by verification: `useAppStore.ts:74` is the `STALE_PERSISTED_KEYS` declaration, `:136-144` is exactly the `mutated`/loop block, `:185-189` is exactly the `partialize` moods comment, and `signOutClearsAccountState.test.ts` exists. All four references are accurate as written.
  - The `data.state` guard on the walk is dead code — true that `validateHydratedState` already rejects a falsy `state` upstream, but that does not dispose of the claim's premise: the guard preserves the pre-change structure and costs nothing, and removing it would couple the walk to an upstream invariant. Kept as written, no defect.
  - `leaves the surrounding persisted keys intact` passes against the unpatched store — confirmed by the red-phase run, but this is a non-destruction guard rather than a strip proof, and the strip itself is proved by the two cases that do go red. No defect.
- addressed_findings:
  - `[low]` `[patch]` Test docblock read "the third half of the same guarantee" for a three-part guarantee — nonsensical phrasing in the file's own explanatory header. Changed to "the third part"; verification re-run green.

## Auto Run Result

Status: done
Blocking condition: none

**Implemented change.** The persisted-blob read path in `useAppStore.ts` now strips a stale
`events` key alongside `moods`. The single-key `if` became a module-scope
`STALE_PERSISTED_KEYS = ['moods', 'events']` walked in one loop that sets the existing
`mutated` flag, so the blob is still parsed once and re-serialized at most once.
`version: 0` and `partialize` are untouched. This closes DW-14 and DW-20, which are the
same defect recorded twice: `partialize` governs writes only, so a blob that already
carried `events` would rehydrate one couple's countdown dates into the next account's
session on a shared device.

**Files changed.**
- `src/stores/useAppStore.ts` -- added `STALE_PERSISTED_KEYS` and replaced the moods-only
  strip with a loop over it; rewrote the adjacent comment to cover both keys and record why
  `events` belongs there (couple-scoped, Supabase-only, and — since JSON has no `Date` —
  a string where `EventCountdown` calls `date.getFullYear()`).
- `tests/unit/stores/persistedEvents.test.ts` -- retired the docblock "Scope note" that
  recorded this gap as deferred and replaced it with the now-guaranteed read-side
  behaviour; added five read-side cases plus shared blob/settings fixtures and a
  `hydrateFrom` helper.

**Review findings breakdown.**
- Patches applied: 1 (low) — test docblock said "the third half" of a three-part
  guarantee; corrected to "the third part".
- Items deferred: 1 (low) — the strip covers `events` only; `eventsIsLoading` and
  `eventsError` would still rehydrate. Recorded in frontmatter `deferred` with evidence.
- Dismissed: 4, each with its reason, in the Review Triage Log above. One is a process
  note: the four review layers were launched together against the staged diff but this
  harness spawns subagents detached and returned no collectable output in-turn, so
  classification was performed directly against the diff and the code at each named site
  rather than sleep-waiting on them.
- Follow-up review recommended: **false**. Patched entries this pass: high 0, medium 0,
  low 1. Score = 3x0 + 1x1 = 1, which is below 5, and no patched entry was high.

**Verification performed.**
- Red phase, explicitly checked: with `src/stores/useAppStore.ts` reverted to
  `c68f347` and the new tests in place, `does not hydrate stored events into store state`
  and `clears both stale keys from one blob` both fail; they pass with the change. A
  pre-implementation probe independently confirmed the seeded `events` array reached
  `getState().events` with `date` still a string.
- `npx vitest run tests/unit/stores/persistedEvents.test.ts tests/unit/stores/persistedMoods.test.ts`
  -- 11 passed (baseline 4).
- `npm run test:unit` -- 92 files, 1408 tests passed. Baseline before the change was
  92 files / 1401 tests passed, so all 7 new tests pass and nothing regressed.
- `npm run lint` -- 0 errors, 3 warnings; byte-identical to the pre-change baseline
  (pre-existing `react-refresh/only-export-components` warnings).
- `npm run typecheck` -- 6 errors, all `TS2883` in `tests/support/merged-fixtures.ts`;
  identical to the pre-change baseline for this worktree. 0 non-baseline errors.
- Matrix test audit: all five I/O matrix rows are covered by tests that ran and passed.
  The implementation covered rows 1-3; rows 4 (no `state` object) and 5 (absent /
  unparseable blob) were uncovered and were closed during verification by three added
  cases.

**Residual risks.**
- The deferred item above: `eventsIsLoading` / `eventsError` are still not stripped. Not a
  disclosure risk, but a rehydrated `eventsIsLoading: true` would strand a loading state on
  a signed-out start, because `loadEvents` bails before raising the flag.
- `STALE_PERSISTED_KEYS` is a hand-maintained list with no compile-time link to
  `partialize`. Adding a key to it that `partialize` does persist would silently stop that
  key from rehydrating. The declaration comment warns, but nothing enforces it.
- The change is defensive: no shipped build has ever written `events` to localStorage, so
  there is no installed base of bad blobs and the guard is unreachable in the field today.
