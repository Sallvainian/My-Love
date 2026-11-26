---
title: 'A failed read of a saved copy never overwrites it'
type: bugfix
ticket: '2'
created: '2026-11-25'
status: done
baseline_revision: '7a040302d8091cdaad45efa731a8e5eb95450ed8'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `readLocalCopy` answers `null` both when no copy is saved and when the IndexedDB read throws, so the four read-then-write merges (`mergeDailyDay`, `mergeDailyDays`, `addDeclinedWriteDay`, `claimCelebration`) treat a failed read as "nothing saved" and overwrite a good copy with only the new data (DW-487, DW-509; epic R8).

**Approach:** Add one read to `localCopy.ts` that answers `found`, `absent` or `failed`, and have those four merges and `claimMilestone` read through it. A `failed` read writes nothing; `absent`, and a malformed value, behave exactly as today.

## Boundaries & Constraints

**Always:** The new read logs a failure with the same line `readLocalCopy` logs today (`[localCopy] Failed to read ${kind} copy:`). `readLocalCopy` keeps its signature and behaviour (it may delegate to the new read). Locks, `isCurrent()` checks, return types and the existing doc wording of each function stay, with only the failed-read sentence added. A malformed stored value still reads as absent and is replaced.

**Never:** No change to `readLocalCopy`'s other callers, to `readSavedDailyDay`, `readSavedDailyHistory`, `readDeclinedWriteDays`, `readCelebrated`, `dailyStreakCopy.ts`, or to the slices (`dailyDaySlice.ts`, `dailyStreakSlice.ts`, `dailyHistorySlice.ts` already handle each outcome below). No change to any existing test assertion. No nudge work (story 8.8, which builds on this merge).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `mergeDailyDay`, read fails | saved map with days X, Y; `ok` answer for Z | returns the answer unchanged; no write; map still X, Y | read logged; next merge of Z merges into X, Y as today |
| `mergeDailyDay`, `unlinked` | any | writes `{}` as today (no read is made) | — |
| `mergeDailyDays`, read fails | saved map; page of snapshots | no write; map unchanged | read logged |
| `addDeclinedWriteDay`, read fails | saved `['d1','d2']` | throws; no write; list still `['d1','d2']` | slice's existing catch logs, `dailyWriteDeclined` unchanged |
| `claimCelebration`, read fails | stored `{held:3, milestones:1}` | `NO_CELEBRATION`; no write | read logged |
| `claimMilestone`, read fails | stored value | `false`; no write | read logged |
| absent / malformed | nothing saved, or invalid value | seeds / merges / replaces as today | — |

</intent-contract>

## Code Map

- `src/services/localCopy.ts:96-106` -- `readLocalCopy`. Add beside it the new exported read and its result type; update the header API list (lines 12-14) with one entry for it.
- `src/services/dailyDaysCopy.ts:183-232` -- `mergeDailyDay` (reads at :194, only for `ok`) and `mergeDailyDays` (reads at :223). Both call `parseSavedDays(...)` on the read value; on `failed` return before any write (`mergeDailyDay` returns `answer`).
- `src/services/dailyWriteDeclined.ts:41-53` -- `addDeclinedWriteDay` reads through `readDeclinedWriteDays` (:27-31, keep as is for its other caller). Read through the new read here and parse the array the same way (factor the filter into a local helper shared with `readDeclinedWriteDays`).
- `src/services/dailyCelebrated.ts:47-121` -- `readCelebrated` (keep), `claimCelebration` (:72), `claimMilestone` (:112). Same pattern: a local helper that parses with `CelebratedSchema`, shared with `readCelebrated`.
- Callers, read-only: `dailyDaySlice.ts:416,342,455,529,590` set `mergeAnswer(get().dailyDay, merged)`, which keeps the higher shown state; `dailyDaySlice.ts:610` catches a throw from `addDeclinedWriteDay` and leaves `dailyWriteDeclined`; `dailyStreakSlice.ts:172,189` pass the claim through.
- Tests: `tests/unit/services/localCopy.test.ts`, `dailyDaysCopy.test.ts`, `dailyWriteDeclined.test.ts`, `dailyCelebrated.test.ts`, all on fake-indexeddb through the real `openMyLoveDB`. Fail the IndexedDB read with `vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementationOnce(() => { throw failure; })` (precedent: `localCopy.test.ts:140`, `dailyQuestionSlice.pickQueue.retry.test.ts:223`).
- `_bmad-output/initiative-my-love/deferred-work.md:4148-4154` (DW-487) and `:4330-4336` (DW-509) -- add a `resolution:` line before `status:` and set `status: done 2026-11-25`, as DW-508 above them does.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/localCopy.ts` -- add `readLocalCopyStatus<T>(userId, kind): Promise<LocalCopyRead<T>>` (see Design Notes); make `readLocalCopy` delegate to it; header API entry -- the one read that tells absent from failed.
- [x] `src/services/dailyDaysCopy.ts` -- both merges read through it; `failed` writes nothing; add one sentence to each doc comment -- DW-487.
- [x] `src/services/dailyWriteDeclined.ts` -- `addDeclinedWriteDay` throws on `failed`, writing nothing; doc says so -- DW-487 ("No thanks" part).
- [x] `src/services/dailyCelebrated.ts` -- `claimCelebration` answers `NO_CELEBRATION` and `claimMilestone` `false` on `failed`, writing nothing; docs say so -- DW-509, #510 regression.
- [x] `tests/unit/services/localCopy.test.ts` -- `readLocalCopyStatus`: `absent`, `found` (value read back), `failed` (logged with `toHaveBeenCalledWith`); `readLocalCopy` still `null` on a failed read.
- [x] `tests/unit/services/dailyDaysCopy.test.ts`, `dailyWriteDeclined.test.ts`, `dailyCelebrated.test.ts` -- one test per function (five): seed a value, fail the read once, assert the result, the stored value unchanged and no `writeLocalCopy` call; then call again and assert today's behaviour on the stored value. Keep every existing test.
- [x] `_bmad-output/initiative-my-love/deferred-work.md` -- DW-487 and DW-509 done with a resolution naming the new read and the tests.

**Acceptance Criteria:**
- Given a saved copy, when the IndexedDB read fails once during each of the five functions, then the stored value is unchanged, no write is made, and the next successful call behaves as it does today.
- Given no saved copy or a malformed one, when each merge runs, then it seeds or merges exactly as before (existing tests pass unchanged).
- Given `deferred-work.md`, when DW-487 and DW-509 are read, then both show `status: done 2026-11-25`.

## Implementation Notes

- 2026-11-25: implemented by a Sonnet subagent from this plan; verified in the parent session against the diff. Files: `src/services/localCopy.ts` (`LocalCopyRead<T>`, `readLocalCopyStatus`, `readLocalCopy` now delegates), `dailyDaysCopy.ts`, `dailyWriteDeclined.ts` (local `parseDeclinedWriteDays`), `dailyCelebrated.ts` (local `parseCelebrated`), the four service test files, and the ledger (DW-487, DW-509 done). No slice changed.
- `addDeclinedWriteDay` throws `Error('The declined write days could not be read')` on a failed read; the slice's catch covers it as it covers a failed write.
- In the two `dailyDaysCopy` tests the fresh snapshot is on a date of its own, so the date-drop rule does not remove a seeded day and blur the "unchanged" assertion.
- Red check: with the baseline `dailyDaysCopy.ts`, `dailyWriteDeclined.ts` and `dailyCelebrated.ts` (new `localCopy.ts` kept), the four new bug tests fail and the `claimMilestone` one passes, as expected for a regression case.
- Verification: the four service test files 114 passed; `npm run test:unit` 261 files, 5003 tests passed; `npm run typecheck` exit 0; `npx eslint src/services tests/unit/services` exit 0; the ledger grep shows two `status: done 2026-11-25` lines.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` The `mergeDailyDay` failed-read test's `resolves.toEqual(ok(fresh))` could not tell "returned the answer as it is" from "merged into an empty map", because no seeded entry shared `fresh`'s `day_id`, so the matrix row "returns the answer unchanged" was not pinned by the return value. — Patched by the implementing subagent: the seed now holds `higher`, the same `day_id` and `day` at state `both`, so a normal merge would return `higher` while the failed read returns `ok(fresh)`; the second call now expects `higher` kept and tagged `'C'`. A direct test correction.

## Design Notes

```ts
export type LocalCopyRead<T> =
  | { status: 'found'; value: T }
  | { status: 'absent' }
  | { status: 'failed' };

export async function readLocalCopyStatus<T>(userId: string, kind: string): Promise<LocalCopyRead<T>> {
  try { const row = await (await getDb()).get(STORE_NAMES.LOCAL_COPIES, [userId, kind]);
        return row ? { status: 'found', value: row.value as T } : { status: 'absent' }; }
  catch (error) { console.error(`[localCopy] Failed to read ${kind} copy:`, error); return { status: 'failed' }; }
}
```

A result rather than a throwing read: the merges run inside `withWaitingLock`, and a result keeps each "failed → write nothing" branch next to its read with no new try/catch, matching `lookupPartnerId()`'s status pattern. `addDeclinedWriteDay` is the one that throws, because its contract already throws when it cannot save and its caller's catch leaves the list as it was (the sheet closes either way, `WriteQuestionSheet.tsx:116-124`). Throw an `Error` whose message says the declined days could not be read.

`mergeDailyDay` on `failed` returns `answer` itself: the caller's `mergeAnswer` keeps whichever of it and the shown day ranks higher, so the screen never moves back. Parsing helpers stay per module (they parse different shapes); only the read is shared.

## Verification

**Commands:**
- `npx vitest run tests/unit/services/localCopy.test.ts tests/unit/services/dailyDaysCopy.test.ts tests/unit/services/dailyWriteDeclined.test.ts tests/unit/services/dailyCelebrated.test.ts` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `npm run typecheck` -- expected: exit 0, or only errors `baseline_revision` also shows.
- `npx eslint src/services tests/unit/services` -- expected: no errors.
- `grep -n -A8 -E '^### DW-(487|509):' _bmad-output/initiative-my-love/deferred-work.md | grep 'status:'` -- expected: two `status: done 2026-11-25` lines.

## Auto Run Result

Status: built

**Summary:** `localCopy.ts` gains `readLocalCopyStatus`, which answers `found`, `absent` or `failed`; `readLocalCopy` delegates to it and behaves as before. The four read-then-write merges and `claimMilestone` read through it, and a failed IndexedDB read now writes nothing: `mergeDailyDay` returns the server answer as it is (the slice's `mergeAnswer` keeps the higher day on screen), `mergeDailyDays` returns, `addDeclinedWriteDay` throws (the slice's catch leaves the declined list), `claimCelebration` answers `NO_CELEBRATION` and `claimMilestone` `false`. Absent and malformed values behave as today. DW-487 and DW-509 are done in the ledger.

**Files changed:**
- `src/services/localCopy.ts`: `LocalCopyRead<T>` and `readLocalCopyStatus`; `readLocalCopy` delegates; header API entry.
- `src/services/dailyDaysCopy.ts`: both merges write nothing on a failed read.
- `src/services/dailyWriteDeclined.ts`: `addDeclinedWriteDay` throws on a failed read; local `parseDeclinedWriteDays` shared with `readDeclinedWriteDays`.
- `src/services/dailyCelebrated.ts`: both claims write nothing on a failed read; local `parseCelebrated` shared with `readCelebrated`.
- `tests/unit/services/localCopy.test.ts`, `dailyDaysCopy.test.ts`, `dailyWriteDeclined.test.ts`, `dailyCelebrated.test.ts`: the new read's three outcomes, and one failed-read test per function (five), each followed by a successful call.
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-487 and DW-509 resolved, `status: done 2026-11-25`.

**Review findings:** 1 patch applied (low: the `mergeDailyDay` failed-read test now pins the returned answer). Nothing deferred, nothing rejected.

**Follow-up review recommended:** false. This pass patched 0 high, 0 medium and 1 low.

**Verification:** after the patch: the four service test files 114 passed; `npm run test:unit` 261 files, 5003 tests passed; `npm run typecheck` exit 0; `npx eslint src/services tests/unit/services` exit 0; the ledger grep shows two `status: done 2026-11-25` lines. Red check before review: against the baseline merge modules the four bug tests failed and the `claimMilestone` regression test passed. Every I/O matrix row has a passing test; the slice row is covered by `dailyQuestionSlice.writeQuestion.test.ts` "never throws: a write failure is logged, and the field stays as it was".

**Residual risks:** none known.
