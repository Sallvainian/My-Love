# Findings 2026-10-03: tests/unit/

Verbatim copy of the scored findings in the 2026-10-03 TEA test review of tests/unit/ (`test-review-target-tests-unit.md`, run against main at bab5120e). Every row is in scope. Rule ids (C#, H#, M#, L#) are defined in TEA's criteria registry, `.claude/skills/bmad-tea-test-review/steps-c/criteria-registry.md`; the Knowledge Base links below still carry the v6 `bmad-testarch-test-review` path and do not resolve. `corrections.md` overrides any row or suggested fix it names. Line numbers are from bab5120e; locate each finding by its content.

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Class-only rejection check

**Severity**: P1 (High)
**Location**: `tests/unit/utils/offlineErrorHandler.test.ts:121`
**Row**: H10
**Criterion**: Explicit Assertions
**Knowledge Base**: [test-quality.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Issue Description**:
"throws OfflineError when offline" has one assertion, and it constrains only the class of the rejection. Any `OfflineError`, whatever its operation or message, passes, and the test never checks that the wrapped function did not run. None of H10's three exemptions applies. The sibling test at line 124 pins `operation: 'sync-data'`, but H10 is judged per test.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
await expect(withOfflineCheck('save', async () => 42)).rejects.toThrow(OfflineError);
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended)
const fn = vi.fn(async () => 42);
await expect(withOfflineCheck('save', fn)).rejects.toMatchObject({
  name: 'OfflineError',
  operation: 'save',
  message: OFFLINE_RETRY_MESSAGE,
});
expect(fn).not.toHaveBeenCalled();
```

**Benefits**:
The test then fails if the wrong operation is reported, the message drifts, or the wrapped work runs while offline.

**Priority**:
P1 because H10 is a HIGH row: the test stays green while the error's content is wrong. This finding alone sets the verdict to Request Changes.

---

### 2. Multi-concern tests

**Severity**: P2 (Medium)
**Location**: 12 tests, listed below
**Row**: M3
**Criterion**: One Concern per Test
**Knowledge Base**: [test-quality.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md) (Example 8)

**Issue Description**:
Each test asserts against three or more subjects (store state, the per-account local copy, the server or queue, the rendered list), so a failure reports under a name that does not say which layer broke. The pattern is concentrated in store tests that verify every effect of one action in one case.

| Location | Subjects | Suggested split |
| --- | --- | --- |
| `stores/notesSlice.queueMultiTab.test.ts:183` | server rows and shared queue; tab 2 state; upsert count and broadcast; local copy | One case per effect, reusing `tab1SendsTab2sNoteAndItIsRejected` setup |
| `stores/loaderIdentityGuards.messages.test.ts:262` | favorite call; copy write; store optimistic state | Move the store assertions into "a confirmed favorite flips the row and records it" |
| `stores/accountDataSlices.test.ts:168` | owner's copy; other account's copy; store mirror | Split out "shows the refreshed rows and favorites in the store" |
| `components/AdminPanel.accountData.test.tsx:229` | saved copy; store; rendered list | Three cases over `completeAcceptedDelete()` |
| `components/AdminPanel.accountData.test.tsx:243` | accessible failure; cancel enabled and row kept; retried delete | Split; line 259 already covers cancel |
| `stores/interactionsSlice.localCopy.test.ts:416` | server read limit; store list and count; saved copy | Extract the refresher lookup, one case per destination |
| `stores/photosSlice.localCopy.test.ts:149` | store state; saved copy; image-fill request | Three cases sharing the 60-row setup |
| `stores/loaderIdentityGuards.customMessages.test.ts:539` | store list; copy write; rotation-pool re-read | One case per outcome, reusing `aRemote()`/`aCustomInput()` |
| `stores/loaderIdentityGuards.customMessages.test.ts:601` | import result; copy write; pool re-read | One case per outcome |
| `stores/notesSlice.offlineQueue.test.ts:157` | store state; local copy; note queue | Three cases over `reconnectAfterThreeOffline()` |
| `stores/notesSlice.offlineQueue.test.ts:180` | server row; store; local copy; reload | Helper for queue-and-drain, separate assertions |
| `stores/settingsSlice.initializeApp.test.ts:223` | seeding; read count; published pool | Mirror the empty-DB split at lines 187, 204, 216 |

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation) — photosSlice.localCopy.test.ts:149
it('first online start: lists every photo, saves the copy, requests the fill', async () => {
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended)
describe('first online start', () => {
  it('lists every photo', async () => { /* state only */ });
  it('saves the listed photos as the copy', async () => { /* savedCopies only */ });
  it('requests the image fill for the account session', async () => { /* fill request only */ });
});
```

**Benefits**:
A failure names the layer that broke, which is the question every sign-out, local-copy and session-guard regression asks first.

**Priority**:
P2: real diagnostic cost, no risk of a false green.

---

### 3. Names that state the mechanism, not the outcome

**Severity**: P3 (Low)
**Location**: 6 tests, listed below
**Row**: L5
**Criterion**: BDD Format (Convention: bddNaming, 8 of 8 sampled)
**Knowledge Base**: [test-quality.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md) (Example 8)

| Location | Current name | Suggested name |
| --- | --- | --- |
| `utils/interactionValidation.test.ts:114` | handles empty string | returns an empty string unchanged |
| `utils/messageRotation.test.ts:39` | handles December 31st | formats the last day of the year without rolling into the next |
| `utils/dateFormat.test.ts:14` | [P0] should format dates consistently | [P0] formats a local date as its zero-padded YYYY-MM-DD wall-clock day |
| `utils/dateFormat.test.ts:22` | [P0] should handle edge case dates (midnight, DST transitions) | [P0] maps instants around midnight and both DST transitions to the New York calendar day |
| `utils/offlineErrorHandler.test.ts:113` | executes the function when online | returns the wrapped operation's result when online |
| `stores/settingsSlice.initializeApp.test.ts:223` | skips default message loader when IndexedDB already contains messages | keeps the stored pool and does not reseed when IndexedDB already has messages |

**Benefits**: the failure line becomes the bug report. **Priority**: P3, rename only.

---

### 4. Unnamed domain literals

**Severity**: P3 (Low)
**Location**: 5 sites, listed below
**Row**: L6
**Criterion**: Named Domain Literals
**Knowledge Base**: [data-factories.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md) (Example 6)

| Location | Literal | Fix |
| --- | --- | --- |
| `stores/notesSlice.queueMultiTab.test.ts:230` | `'23514'` | Import `CHECK_VIOLATION_CODE` from `tests/support/check-constraint-envelopes.ts` (already exported there) |
| `stores/notesSlice.offlineQueue.test.ts:327` (also 403, 513) | `'23514'` | Same import; the file already names `INSUFFICIENT_PRIVILEGE = '42501'` |
| `stores/notesSlice.queueRetry.test.ts:200` | `'08006'` | `const CONNECTION_FAILURE = '08006'; // SQLSTATE connection_failure` |
| `services/dbSchema.v15MessageData.test.ts:168` | `toBe(6)` | Assert the named store list, or name the count with the list in a comment |
| `stores/moodSlice.test.ts:274` | `fetchPartnerMoods(10)` | Drop the argument or name it, as `moodSlice.partnerMoodsCopy.test.ts` does with `PARTNER_MOOD_LIMIT` |

**Benefits**: the reader sees which rejection path or schema shape the test encodes. **Priority**: P3.

---

### 5. One check written in two matcher styles

**Severity**: P3 (Low)
**Location**: 4 files, listed below
**Row**: L7
**Criterion**: Assertion Style (Convention: assertionStyle, 8 of 8 sampled)
**Knowledge Base**: [test-quality.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md) (Example 8)

| Location | Mix | Fix |
| --- | --- | --- |
| `services/moodService.test.ts:168` (also 409) | `expect(x.length).toBe(1)` vs `toHaveLength(1)` elsewhere in the file | Use `toHaveLength` |
| `services/storageSchema.test.ts:501` | `.contains(...)).toBe(true)` at 143 vs `toContain(...)` at 501; same split for absence | One membership form throughout |
| `api/moodSyncService.test.ts:251` | per-field `toBe` vs `toMatchObject({ synced, failed })` in every other case | `toMatchObject` |
| `utils/offlineErrorHandler.test.ts:32` | per-field `toBe` at 17–20 vs `toMatchObject` at 32–37 for the same defaults | Keep one form |

**Benefits**: one dialect per file; `toHaveLength`/`toContain` also print the actual collection on failure. **Priority**: P3.

---

## Violation Summary by Location

| Location | Severity | Criterion | Issue | Fix |
| --- | --- | --- | --- | --- |
| `api/moodSyncService.test.ts:251` | P3 | L7 | Per-field `toBe` vs `toMatchObject` | `toMatchObject` |
| `components/AdminPanel.accountData.test.tsx:229` | P2 | M3 | Copy, store and list in one test | Split by layer |
| `components/AdminPanel.accountData.test.tsx:243` | P2 | M3 | Failure, cancel and retry in one test | Split |
| `services/dbSchema.v15MessageData.test.ts:168` | P3 | L6 | Unnamed store count `6` | Assert named list |
| `services/moodService.test.ts:168` | P3 | L7 | `.length).toBe` vs `toHaveLength` | `toHaveLength` |
| `services/storageSchema.test.ts:501` | P3 | L7 | `.contains().toBe` vs `toContain` | One form |
| `stores/accountDataSlices.test.ts:168` | P2 | M3 | Two copies and store mirror | Split store half |
| `stores/interactionsSlice.localCopy.test.ts:416` | P2 | M3 | Server, store, copy | Split by destination |
| `stores/loaderIdentityGuards.customMessages.test.ts:539` | P2 | M3 | List, copy, pool re-read | Split |
| `stores/loaderIdentityGuards.customMessages.test.ts:601` | P2 | M3 | Result, copy, pool re-read | Split |
| `stores/loaderIdentityGuards.messages.test.ts:262` | P2 | M3 | Call, copy, store state | Move store asserts |
| `stores/moodSlice.test.ts:274` | P3 | L6 | Unnamed limit `10` | Drop or name |
| `stores/notesSlice.offlineQueue.test.ts:157` | P2 | M3 | State, copy, queue | Split |
| `stores/notesSlice.offlineQueue.test.ts:180` | P2 | M3 | Server, state, copy, reload | Split |
| `stores/notesSlice.offlineQueue.test.ts:327` | P3 | L6 | Unnamed `'23514'` | `CHECK_VIOLATION_CODE` |
| `stores/notesSlice.queueMultiTab.test.ts:183` | P2 | M3 | Four subjects | Split |
| `stores/notesSlice.queueMultiTab.test.ts:230` | P3 | L6 | Unnamed `'23514'` | `CHECK_VIOLATION_CODE` |
| `stores/notesSlice.queueRetry.test.ts:200` | P3 | L6 | Unnamed `'08006'` | Named constant |
| `stores/photosSlice.localCopy.test.ts:149` | P2 | M3 | State, copy, fill request | Split |
| `stores/settingsSlice.initializeApp.test.ts:223` | P2 | M3 | Seeding, read count, pool | Mirror empty-DB split |
| `stores/settingsSlice.initializeApp.test.ts:223` | P3 | L5 | Names a collaborator call | Rename |
| `utils/dateFormat.test.ts:14` | P3 | L5 | "consistently" | Rename |
| `utils/dateFormat.test.ts:22` | P3 | L5 | "handle edge case dates" | Rename |
| `utils/interactionValidation.test.ts:114` | P3 | L5 | "handles empty string" | Rename |
| `utils/messageRotation.test.ts:39` | P3 | L5 | "handles December 31st" | Rename |
| `utils/offlineErrorHandler.test.ts:32` | P3 | L7 | Per-field `toBe` vs `toMatchObject` | One form |
| `utils/offlineErrorHandler.test.ts:113` | P3 | L5 | "executes the function" | Rename |
| `utils/offlineErrorHandler.test.ts:121` | P1 | H10 | Class-only rejection check | `toMatchObject` + not-called |

All paths are under `tests/unit/`.

