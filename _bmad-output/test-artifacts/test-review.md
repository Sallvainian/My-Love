---
workflowType: 'testarch-test-review'
stepsCompleted:
  [
    'step-01-load-context',
    'step-02-discover-tests',
    'step-03-quality-evaluation',
    'step-03f-aggregate-scores',
    'step-04-generate-report',
  ]
lastStep: 'step-04-generate-report'
lastSaved: '2026-08-19'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '.claude/skills/bmad-testarch-test-review/steps-c/criteria-registry.md'
  - '.claude/skills/bmad-testarch-test-review/resources/tea-index.csv'
  - '.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-test-review/resources/knowledge/evidence-integrity.md'
  - '.claude/skills/bmad-testarch-test-review/test-review-template.md'
  - 'src/api/interactionService.ts'
  - 'src/api/errorHandlers.ts'
  - 'src/utils/offlineErrorHandler.ts'
  - '_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md'
  - '_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md'
---

# Test Quality Review: dw-events-offline-message-honesty

**Quality Score**: 61/100 (D - Needs Improvement)
**Review Date**: 2026-08-19
**Review Scope**: directory
**Reviewer**: Sallvain (TEA Agent)

Scope note: the reviewed set is the three test artifacts the working tree changes, all of which
live in `tests/unit/api/`. The other five files in that directory were not changed by this work and
were not reviewed; four of them are in the convention-baseline sample instead.

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Needs Improvement

**Recommendation**: Request Changes

**Context Basis**: pr_diff

**Context Waivers Applied**: 0

### Key Strengths

✅ Zero CRITICAL, HIGH and MEDIUM rows fired. No skipped or focused test, no hard wait, no
conditional assertion, no unreset shared state, no tautological or unreachable assertion, and no
unawaited promise anywhere in the reviewed set.
✅ Falsifiability is engineered rather than assumed: `offlineMessageHonesty.test.ts:87-91` carries
three positive controls that prove the detector still sees a real import, and
`interactionService.test.ts:197-214` pairs a `console.error` **not**-called check with a
called check on the contrasting path, so neither half can pass for the wrong reason.
✅ The boundary model is measured, not guessed. `fakeInteractionsBackend.ts:20-24` quotes the
`curl` and the literal `406 / PGRST116` response it was derived from, which is exactly what
`evidence-integrity.md` § Example 3 asks for before a framework property is relied on.

### Key Weaknesses

❌ 37 of the 39 findings are one row: no reviewed test carries the `[P#]` priority marker the
repository is drifting toward (9 of 40 sampled files use it). That single LOW-tier row is what
drives the score under the 70 floor and therefore the derived verdict.
❌ `interactionService.test.ts:370` passes `(USER_ID, 1, 1)` for limit and offset. Both literals are
unnamed and equal, so the test named "honours the offset and limit window" cannot fail if the two
parameters are swapped in the service.
❌ `offlineMessageHonesty.test.ts` is headed "enforced repo-wide" but enforces a hand-maintained
list of six modules, and three Supabase-only surfaces that `AGENTS.md` names are not on it. No
registry row covers this; it is reported as prose below.

### Summary

The three files under review are unusually careful work. Every assertion in them can fail, the
error messages are pinned whole with `toBe` because the regression being guarded is an *extra
sentence*, the fake refuses to model an operator it does not understand rather than silently
matching every row, and the file that could most easily have become decoration — a guard asserting
the absence of an import — carries positive controls proving its own detector works. Measured
against the deduction ledger, not one determinism, isolation or performance row fired, and no
MEDIUM row fired in any dimension. All 44 runtime tests pass in 470 ms.

The score is nevertheless 61, and the derived recommendation is `Request Changes`. Both come almost
entirely from one Convention row: `priorityMarkers` is `emerging` in this repository (9 of 40
sampled files, and 38 of the full 82-file corpus outside the review set), the deduction schedule
fires it at LOW on every reviewed test that lacks the marker, and there are 37 such tests. The
remedy is mechanical and the priorities already exist —
`_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md:213-245` assigns
P1 to TEST-01/02/03 and P2 to TEST-04/05, which is precisely what these tests implement. Read the
verdict as "add the markers and fix two literals", not as a statement about the tests' correctness.

---

## Run-Level Preconditions

Evaluated once for the run, not per file, per `criteria-registry.md` § RUN-LEVEL PRECONDITIONS.

- **`playwrightUtilsActive` = true.** `tea_use_playwright_utils` is `true` and
  `@seontechnologies/playwright-utils@^4.4.0` is in `package.json:59`, so rows M9 and L9 exist for
  this run. Neither fired: their per-file gate needs a JS/TS Playwright spec and all three reviewed
  files run under vitest. Separately, per the registry's *Mandate-backed keys report an unspread
  convention* rule: playwright-utils is installed and the flag is true; **0 of 40** sampled files
  outside the review set import it. Adoption has not spread into this neighbourhood — the package is
  wired into `tests/support/` (6 files) for the Playwright projects, and the 40-file sample nearest
  the reviewed files is entirely vitest unit specs. The score does not move.
- **`pactjsUtilsActive` = false.** `tea_use_pactjs_utils` is `true` but
  `@seontechnologies/pactjs-utils` is **not installed** (`grep -c pactjs-utils package.json` → 0).
  Row M10 does not exist for this run and deducts nothing. Run the `framework` workflow if contract
  testing is ever wanted; there are currently 0 `.pacttest.ts` files, so nothing is unprotected.
- **Pact MCP.** `tea_pact_mcp: mcp`. Pact artifacts are gated on relevance, and the review set
  contains none, so no broker or provider path was exercised. For the record, this session's MCP
  tool list contains no SmartBear/PactFlow server.
- **Execution mode.** `tea_execution_mode: auto`, `tea_capability_probe: true`. Resolved to
  **sequential**. This session runs inside a bmad-loop worktree, where `CLAUDE.md` records that
  handing worktree work to a background subagent and waiting on it silently burns the session
  (run `20260818-230216-c22b` lost two that way), so `canLaunchSubagents` is false for this runtime.
  All four dimension workers were executed in-session against the same context and the same
  registry. Their JSON outputs were written to this session's scratchpad rather than to
  `{test_artifacts}/`, to keep four intermediate files out of a tracked artifact directory:
  `…/87d75651-e6e0-44c3-9e3c-ebc2d277798f/scratchpad/tea-test-review-{determinism,isolation,maintainability,performance}-2026-08-19T15-16-16.json`.

---

## Quality Criteria Assessment

| Criterion                            | Status         | Violations | Basis                                                                            | Notes                                                                                             |
| ------------------------------------ | -------------- | ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| BDD Format (Given-When-Then)         | ✅ PASS        | 0          | Convention: bddNaming (40 of 40 sampled)                                         | Every name states a behavior; 0 of 497 sampled names are purely implementation-shaped             |
| Test IDs                             | ✅ PASS (n/a)  | 0          | Convention: testIds (0 of 40 sampled)                                            | Gate closed twice over: no DOM lookups, and the sampled corpus has no test-id convention          |
| Priority Markers (P0/P1/P2/P3)       | ⚠️ WARN        | 37         | Convention: priorityMarkers (9 of 40 sampled)                                    | `emerging`, not yet house-wide; no reviewed test carries the `[P#]` form                          |
| Disabled or Focused Tests            | ✅ PASS        | 0          | Absolute                                                                         | 0 hits for `.skip`/`.only`/`.todo`/`xit`/`fit`/`fdescribe`                                        |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS        | 0          | Absolute                                                                         | No `waitForTimeout`, `sleep(` or `setTimeout(` in the review set                                  |
| Determinism (no conditionals)        | ✅ PASS        | 0          | Absolute + Applicability                                                         | H2 gate closed: the two `Date.now()` reads govern no expiry, TTL or scheduling boundary           |
| Isolation (cleanup, no shared state) | ✅ PASS        | 0          | Absolute                                                                         | Module-level `backend` is reset in `beforeEach`; `navigator.onLine` and the spy restored in both  |
| Fixture Patterns                     | ✅ PASS        | 0          | Applicability: the file constructs domain payloads                               | M2/M5 did not fire; the fake is an extracted shared module, mirroring `fakeMoodsBackend.ts`       |
| Data Factories                       | ✅ PASS        | 0          | Applicability: the file constructs domain payloads                               | Rows are built by `backend.seed()` with overrides, not inline three or more times                 |
| Network-First Pattern                | ✅ PASS (n/a)  | 0          | Applicability: the file navigates and then reads data-dependent content          | No navigation anywhere in the review set                                                          |
| Playwright Utils Adoption            | ✅ PASS (n/a)  | 0          | Convention: playwrightUtils (0 of 40 sampled)                                    | Precondition true, convention absent, and no reviewed file is a Playwright spec — see above       |
| Pact.js Utils Adoption               | ✅ PASS (n/a)  | 0          | Applicability: the reviewed file is a JS/TS Pact artifact                        | Precondition false: the package is not installed. Row does not exist this run                     |
| Explicit Assertions                  | ✅ PASS        | 0          | Absolute                                                                         | 37 of 37 declared test blocks assert; both `undefined` matcher forms verified to fail (probe)     |
| Test Length (≤1000 lines)            | ✅ PASS        | 484        | Absolute                                                                         | Largest reviewed file is 484 lines                                                                |
| Test Duration (≤1.5 min)             | ✅ PASS        | 0.47 s     | Absolute                                                                         | Measured, not estimated: `npx vitest run` over both spec files, 44 tests, 470 ms                  |
| Flakiness Patterns                   | ✅ PASS        | 0          | Absolute + Applicability                                                         | H1/H2/H3/H4/M1/M6 all clear; the one live-clock comparison is a monotonic lower bound             |
| Mobile Flow Patterns                 | ✅ PASS (n/a)  | 0          | Applicability: the reviewed file is a Maestro flow                               | No Maestro flow in the review set                                                                 |

**Total Violations**: 0 Critical, 0 High, 0 Medium, 39 Low

**Convention Baseline**: 40 test files sampled outside the review set

### Convention baseline detail

`corpusSize` 82, `sampled` 40. The corpus is every `*.test.ts(x)` / `*.spec.ts` under `tests/`
excluding `tests/e2e-archive/` (frozen, matched by no Playwright project per `AGENTS.md`) and
excluding the two reviewed spec files. The sample is closest-first by directory distance from
`tests/unit/api/`: all 4 remaining files at distance 0, then the `tests/unit/*` sibling band in
lexical path order until the 40 cap. Every count below came from a real `grep -l` over those 40
files, never an estimate.

| Key               | Adopted | Sampled | Status        | Observed form                                                        |
| ----------------- | ------- | ------- | ------------- | -------------------------------------------------------------------- |
| `priorityMarkers` | 9       | 40      | `emerging`    | `[P#]` prefix inside the test name, e.g. `test('[P1] …')`            |
| `testIds`         | 0       | 40      | `absent`      | —                                                                     |
| `bddNaming`       | 40      | 40      | `established` | Verb-phrase name stating behavior; 11 of 40 use a `should` prefix     |
| `networkFirst`    | 0       | 40      | `absent`      | —                                                                     |
| `playwrightUtils` | 0       | 40      | `absent`      | —                                                                     |
| `dataFactories`   | 14      | 40      | `emerging`    | Per-file `make*` / `create*` builders (`makeMoodEntry`, `createTestStore`) |
| `fixtures`        | 2       | 40      | `emerging`    | `fake*Backend` helper module imported from a sibling path             |
| `assertionStyle`  | 40      | 40      | `established` | `expect` + vitest matchers; 0 files use another dialect               |

Sensitivity check on the one key that deducts: `priorityMarkers` is `emerging` under either
measurement. 9 of 40 in the mandated closest-first sample (22.5%), and 38 of the full 82-file
outside corpus (46%) — the marker is concentrated in the scripture and e2e specs and appears in
**0 of the 4** sampled files in `tests/unit/api/` itself. Both figures are below the 50% threshold
that would make it `established`, so the row fires at LOW rather than being stepped down further,
and it fires either way.

---

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -0 × 10 = -0
High Violations:         -0 × 5 = -0
Medium Violations:       -0 × 2 = -0
Low Violations:          -39 × 1 = -39

Bonus Points:
  Excellent BDD:         +0
  Comprehensive Fixtures: +0
  Data Factories:        +0
  Network-First:         +0
  Perfect Isolation:     +0
  All Test IDs:          +0
                         --------
Total Bonus:             +0

Final Score:             61/100
Grade:                   D
```

Why every bonus is 0 — each is all-or-nothing and must hold across **every** reviewed file:

- **Excellent BDD** — `fakeInteractionsBackend.ts` declares no tests, so the criterion cannot hold
  across it, and several names in the main spec lead with an implementation symbol (`single()`,
  `.or()`, `logSupabaseError`). Enough to pass L5, not enough to earn the bonus.
- **Comprehensive Fixtures** — setup is still repeated inline: `backend.nextError = new
  TypeError('fetch failed')` 6 times, `backend.nextError = denied` 4 times,
  `backend.insertMatchesNoRow = true` 4 times, `setOnline(false)` 3 times.
- **Data Factories** — `offlineMessageHonesty.test.ts` takes its data from two hardcoded lists, and
  L6 fired twice on unnamed literals.
- **Network-First**, **All Test IDs** — no network interception and no element lookups exist to
  hold the criterion.
- **Perfect Isolation** — the criterion reads "no shared mutable state". The module-level `backend`
  is shared mutable state. It is disciplined enough that H4 does not fire, which is a different bar.

---

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Carry the test design's priority markers into the test names

**Severity**: P3 (Low)
**Location**: `tests/unit/api/interactionService.test.ts` (33 tests), `tests/unit/api/offlineMessageHonesty.test.ts` (4 declared blocks)
**Row**: L2 — 37 violations, the full line list is in the Appendix
**Criterion**: Priority Markers (P0/P1/P2/P3)
**Knowledge Base**: [test-priorities-matrix.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-priorities-matrix.md)

**Issue Description**:
9 of the 40 sampled files outside the review set carry a `[P#]` prefix in the test name; the
convention is `emerging` rather than house-wide, so the row fires at LOW. No reviewed test carries
one, so `--grep '\[P1\]'`-style selective execution cannot see this suite at all — which matters
here, because the epic already produced the priorities. This is a labelling gap, not a defect in
what the tests check.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
it('reports no rows found when PostgREST refuses to coerce the empty result', async () => {
it('still maps a send through handleSupabaseError, unchanged', async () => {
it.each(SUPABASE_ONLY_MODULES)('%s imports neither symbol that promises a sync', …);
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended) — priorities from
// _bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md:213-234
it('[P1] reports no rows found when PostgREST refuses to coerce the empty result', async () => {  // TEST-01
it('[P1] still maps a send through handleSupabaseError, unchanged', async () => {                 // TEST-02
it.each(SUPABASE_ONLY_MODULES)('[P1] %s imports neither symbol that promises a sync', …);         // TEST-03
```

The mapping is already written down: TEST-01, TEST-02 and TEST-03 are **P1**; TEST-04 (the
non-`Error` rejection at `interactionService.test.ts:259`) and TEST-05 (the three read/update
success paths at `:357-483`) are **P2**.

**Benefits**:
Selective execution and the PR tier can address this suite by priority; the traceability matrix
gains the same key on both sides; the marker survives as the record of *why* a test exists after
the epic artifacts are archived.

**Priority**:
P3. Nothing about the tests' behavior changes, the fix is a text edit, and the convention is not
yet house-wide. It is listed first only because it is 37 of the 39 findings and therefore all of
the distance between this score and a passing one.

---

### 2. Name the pagination literals, and make them differ

**Severity**: P3 (Low)
**Location**: `tests/unit/api/interactionService.test.ts:370`
**Row**: L6
**Criterion**: Magic Value
**Knowledge Base**: [data-factories.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)

**Issue Description**:
Two bare `1`s stand for `limit` and `offset`. Neither is named or commented, and because they are
equal the test cannot distinguish them: `getInteractionHistory(userId, limit = 50, offset = 0)`
could swap its two parameters and this test would stay green. The test is named "honours the
offset and limit window", so the name claims more than the assertion can carry — the shape
`evidence-integrity.md` lists as "flow name promising an effect no assertion mentions".

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
it('honours the offset and limit window', async () => {
  const secondPage = await interactionService.getInteractionHistory(USER_ID, 1, 1);

  expect(secondPage.map((entry) => entry.id)).toEqual(['sent-to-me']);
});
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended): distinct values over enough rows that a
// limit/offset swap produces a different page.
it('honours the offset and limit window', async () => {
  backend.seed({ id: 'third-newest', from_user_id: USER_ID, to_user_id: PARTNER_ID,
                 created_at: '2026-08-18T00:30:00.000Z' });
  const LIMIT = 2;
  const OFFSET = 1;

  const secondPage = await interactionService.getInteractionHistory(USER_ID, LIMIT, OFFSET);

  // limit=2, offset=1 → the 2nd and 3rd rows. Swapped (limit=1, offset=2) → only the 3rd.
  expect(secondPage.map((entry) => entry.id)).toEqual(['sent-to-me', 'third-newest']);
});
```

**Benefits**:
The `.range(offset, offset + limit - 1)` arithmetic in `src/api/interactionService.ts:294` becomes
falsifiable in both parameters instead of one, and a reader can tell which literal is which
without opening the service.

**Why the fragment's exemption does not cover this**:
`data-factories.md:477` exempts "a value used once, whose meaning the test name already states".
There are two values here, they are equal, and the name states the pair ("the offset and limit
window") without saying which is which — so the exemption's premise, that the name disambiguates
the literal, does not hold.

**Priority**:
P3. The pagination path is exercised today, just not discriminatingly, and pagination of a
two-person interaction history is low-impact.

---

### 3. Hoist the fake's duplicated default timestamp into one constant

**Severity**: P3 (Low)
**Location**: `tests/unit/api/fakeInteractionsBackend.ts:135`
**Row**: L6
**Criterion**: Magic Value
**Knowledge Base**: [data-factories.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)

**Issue Description**:
`'2026-08-18T00:00:00.000Z'` is the fake's default `created_at`. It carries domain meaning, is
unexplained, and exists in two copies, so `seed()` and `insertRow()` can drift apart silently — and
an inserted row's timestamp differing from a seeded row's would change ordering results without any
test naming the cause.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
// :135  in seed()
created_at: '2026-08-18T00:00:00.000Z',
// :291  in insertRow()
created_at: (this.payload.created_at as string | undefined) ?? '2026-08-18T00:00:00.000Z',
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended)
/** Fixed creation instant for any row that does not supply one; keeps seeded and
 *  inserted rows on the same clock so ordering assertions stay meaningful. */
const DEFAULT_CREATED_AT = '2026-08-18T00:00:00.000Z';
```

**Benefits**:
One place to change, and the reason the date is fixed at all becomes readable.

**Related Violations**:
`tests/unit/api/fakeInteractionsBackend.ts:291` — same literal, second copy. Counted once.

---

### Findings with no registry row

Reported per `criteria-registry.md` rule 1: these are real, they carry **no severity and no
deduction**, and the registry has no row for them. Inventing one would make them incomparable
against the same finding next week.

**a. "Enforced repo-wide" is enforced over six hand-maintained paths.**
`tests/unit/api/offlineMessageHonesty.test.ts:1-2` is headed "The honesty invariant, enforced
repo-wide", and its stated purpose (`:17-22`) is to replace the "two module headers, four
`// NOT handleNetworkError:` comments, and reviewer attention" currently holding the property up.
`SUPABASE_ONLY_MODULES` (`:73-80`) lists six paths; 23 modules under `src/` import
`supabaseClient`. Three Supabase-only surfaces that `AGENTS.md` names outright — "photos, love
notes and partner interactions are Supabase-only" — are absent: `src/services/loveNoteImageService.ts`,
`src/components/love-notes/LoveNotes.tsx` and `src/components/PokeKissInterface/PokeKissInterface.tsx`.
None imports either symbol today (verified), so nothing is currently wrong; the point is that a
seventh module is protected only if somebody remembers to extend the list, which is the failure
mode the file says it exists to remove. The header already recommends the stronger fix — an ESLint
`no-restricted-imports` override — and correctly declines to make it here because it edits
`eslint.config.js`. Worth doing as its own change, with the list derived rather than enumerated.

**b. `it('covers every module in the list')` does not check coverage.**
`:130-133` asserts only that both arrays are non-empty. The name claims the stronger property; the
assertion proves the weaker one, and it would pass against a one-entry list. This is
`evidence-integrity.md`'s "name promising an effect no assertion mentions". Either rename it to
what it checks ("both lists are non-empty") or give it the check its name implies — for instance,
assert `SUPABASE_ONLY_MODULES` against a derived set of modules that import `supabaseClient` and
carry no IndexedDB reference, so a new Supabase-only module fails the guard by existing.

**c. The detector reads only one import form.**
`importedNames()` (`:101-117`) matches `import { … } from '…'` alone. `import * as errorHandlers
from './errorHandlers'` followed by `errorHandlers.handleNetworkError(...)`, a default import, and
`export { handleNetworkError } from …` all pass the guard. The file already discloses that it is
"a static scan, not module resolution" (`:24-31`), which is the honest thing to do; naming the
three specific bypasses in that comment would make the disclosure actionable for whoever picks up
the ESLint upgrade.

**d. The `sendKiss` offline test does not assert the no-request property.**
`interactionService.test.ts:133-140` asserts `backend.fromCalls === 0` for `sendPoke`;
`:142-148` asserts only the message for `sendKiss`. The acceptance criterion covers both:
"Given `navigator.onLine` is false, when `sendPoke` **or** `sendKiss` is called, then it rejects
without issuing any `supabase.from()` call"
(`spec-dw-7-18-events-offline-message-honesty.md:137`). Both route through the same guard, so the
risk is small — one added line closes it.

**e. `backend.payloads` mixes two operations in one list.**
`fakeInteractionsBackend.ts:188` and `:195` both push into `payloads`, so `payloads[0]`
(`interactionService.test.ts:128`) is only unambiguous while a test performs exactly one write. A
future test doing an insert and an update would read an order-dependent index. Separate arrays, or
push `{ op, values }`.

---

## Best Practices Found

### 1. Positive controls on a guard that otherwise only asserts absence

**Location**: `tests/unit/api/offlineMessageHonesty.test.ts:82-91, 135-140`
**Pattern**: Falsifiability by construction
**Knowledge Base**: [evidence-integrity.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/evidence-integrity.md)

**Why This Is Good**:
A test that only ever asserts an absence passes just as happily when its detector is broken. This
file says so in its own comment and then does something about it, running the same detector against
three modules where the import genuinely exists.

**Code Example**:

```typescript
// ✅ Excellent pattern demonstrated in this test
const OFFLINE_FIRST_IMPORTERS: { file: string; symbol: string }[] = [
  { file: 'src/api/moodApi.ts', symbol: 'handleNetworkError' },
  { file: 'src/api/moodSyncService.ts', symbol: 'handleNetworkError' },
  { file: 'src/components/MoodTracker/MoodTracker.tsx', symbol: 'OFFLINE_ERROR_MESSAGE' },
];

it.each(OFFLINE_FIRST_IMPORTERS)('still sees $symbol imported by $file, where the promise is true',
  ({ file, symbol }) => {
    expect(importedNames(readModule(file))).toContain(symbol);
  });
```

**Use as Reference**:
Any future absence-asserting guard in this repo should carry the same shape. `readModule()`
(`:119-125`) extends it: a path that has moved fails loudly instead of making its case vacuously
green.

---

### 2. A negative check paired with its own contrasting control

**Location**: `tests/unit/api/interactionService.test.ts:197-214`
**Pattern**: Prove the instrument before trusting the reading
**Knowledge Base**: [evidence-integrity.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/evidence-integrity.md)

**Why This Is Good**:
`expect(console.error).not.toHaveBeenCalled()` on its own would pass in a world where the spy never
fires at all. The very next test proves it does fire on the contrasting path, so the pair pins the
`instanceof InteractionWriteError` re-throw ordering that nothing else in the file would notice.

**Code Example**:

```typescript
// ✅ Excellent pattern demonstrated in this test
it('is re-thrown ahead of logSupabaseError, so it is not logged as a Supabase failure', async () => {
  backend.insertReturnsEmptyBody = true;
  await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));
  expect(console.error).not.toHaveBeenCalled();
});

it('logs, by contrast, when the failure really was mid-flight', async () => {
  backend.nextError = new TypeError('fetch failed');
  await rejection(interactionService.sendPoke(PARTNER_ID, USER_ID));
  expect(console.error).toHaveBeenCalled();
});
```

---

### 3. The fake refuses what it does not model

**Location**: `tests/unit/api/fakeInteractionsBackend.ts:204-219`, asserted at `interactionService.test.ts:106-110`
**Pattern**: Fail loud rather than match everything
**Knowledge Base**: [test-quality.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Why This Is Good**:
The predecessor fake no-op'd `.or()`, `.order()` and `.range()`, which the epic's own deferred
ledger recorded as the reason the history read's predicate, ordering and pagination were untested
(`spec-dw-7-18-events-offline-message-honesty.md:56-69`). The replacement models the one operator
the service sends and throws on anything else — and then a test asserts the throw, so the safety
net itself is covered.

**Code Example**:

```typescript
// ✅ Excellent pattern demonstrated in this fake
if (operator !== 'eq') {
  throw new Error(`FakeInteractionsBackend does not model .or() operator "${operator}"`);
}
```

---

### 4. Boundary behavior measured against the real server, with the command recorded

**Location**: `tests/unit/api/fakeInteractionsBackend.ts:9-40`
**Pattern**: Verify the framework property before relying on it; cite the mechanism
**Knowledge Base**: [evidence-integrity.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/evidence-integrity.md)

**Why This Is Good**:
The header quotes the `curl` and the literal `HTTP/1.1 406` / `PGRST116` body it produced against
this repo's local PostgREST, and cites `postgrest-js@2.112.3 dist/index.mjs:1162` for the `Accept`
header that causes it. `evidence-integrity.md` treats a comment asserting a mechanism as a claim
with the same standing as an assertion; this one carries its source. The consequence is
substantive: the old fake conflated a zero-row `.single()` with `{ data: null, error: null }`, and
separating them revealed that the reachable path was the one nothing tested.

---

### 5. Whole-message pinning chosen for a stated reason

**Location**: `tests/unit/api/interactionService.test.ts:1-17`
**Pattern**: Match the assertion strength to the regression being guarded

**Why This Is Good**:
The regression is an *extra sentence*, so a substring assertion would pass with the sync promise
re-attached. The file explains that and pins with `toBe` throughout, then adds explicit
`not.toContain(SYNC_PROMISE)` checks as a second, differently-shaped guard on the same property.
Verified falsifiable: under vitest 4.1.10 both `expect(undefined).toBe(s)` and
`expect(undefined).not.toContain(x)` fail, so the `failure?.message` optional chaining does not
create a hole if a method resolves instead of rejecting.

---

## Test File Analysis

### `tests/unit/api/interactionService.test.ts`

- **File Path**: `tests/unit/api/interactionService.test.ts`
- **File Size**: 484 lines, 17.7 KB
- **Test Framework**: Vitest 4.1.10
- **Language**: TypeScript
- **Describe Blocks**: 10 (max nesting depth 2)
- **Test Cases (it/test)**: 33 declared, 33 at runtime
- **Average Test Length**: ~9 lines per test
- **Fixtures Used**: 0 formal fixtures; `beforeEach`/`afterEach` plus the extracted
  `FakeInteractionsBackend`
- **Data Factories Used**: 1 (`backend.seed()` with overrides)
- **Total Assertions**: 41 (~1.2 per test)
- **Assertion Types**: `toBe`, `toEqual`, `toMatchObject`, `toHaveLength`, `toContain` (negated),
  `toThrow`, `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toHaveBeenCalled` (and negated)
- **Priority Distribution**: P0 0, P1 0, P2 0, P3 0, **Unknown 33**

### `tests/unit/api/offlineMessageHonesty.test.ts`

- **File Path**: `tests/unit/api/offlineMessageHonesty.test.ts`
- **File Size**: 167 lines, 7.0 KB
- **Test Framework**: Vitest 4.1.10
- **Language**: TypeScript
- **Describe Blocks**: 3 (max nesting depth 2)
- **Test Cases (it/test)**: 4 declared (2 plain, 2 `it.each`), 11 at runtime
- **Fixtures Used**: 0; the file reads real source files through a local `readModule()` helper
- **Data Factories Used**: 0 — the data is two curated module lists, which is the subject
- **Total Assertions**: 6
- **Assertion Types**: `toContain`, `toEqual`, `toBe`, `toBeGreaterThan`
- **Priority Distribution**: P0 0, P1 0, P2 0, P3 0, **Unknown 4**

### `tests/unit/api/fakeInteractionsBackend.ts`

- **File Path**: `tests/unit/api/fakeInteractionsBackend.ts`
- **File Size**: 336 lines, 11.0 KB
- **Test Framework**: n/a — a test support module, no runner API used
- **Language**: TypeScript
- **Describe Blocks**: 0 · **Test Cases**: 0 · **Assertions**: 0

This file is scored, not excluded. The registry's unscorable rule covers a *format* the ledger has
no predicate for (`.feature`, `.robot`, `.http`); a TypeScript test-support module is not that —
file-level and literal-level rows (H4, H5, M2, L6) attach to it normally, and L6 fired. The rows
keyed on a test body (C1-C4, C6, M3, M4, L2) simply have nothing to attach to, which is a closed
gate rather than a pass earned by matching nothing.

### Test Scope

- **Test IDs**: none used (the repo has no test-id or scenario-id convention in this neighbourhood)
- **Execution evidence**: `npx vitest run tests/unit/api/interactionService.test.ts
  tests/unit/api/offlineMessageHonesty.test.ts` → **2 files, 44 tests, 44 passed, 470 ms**
  (transform 80 ms, setup 220 ms, tests 11 ms, environment 437 ms)

### Other working-tree changes, and why they are not in the review set

`_bmad-output/implementation-artifacts/deferred-work.md` and the nine untracked files under
`_bmad-output/` are ledger and TEA artifacts, not test artifacts, so no reader would expect them in
a test-quality review set. Nothing was dropped for a reason the disclosure manifest would need to
record, so that section is omitted.

---

## Context and Integration

### What the Context Said

Context was resolved as the change the tests cover: the source they exercise
(`src/api/interactionService.ts`), the two modules whose exported messages the honesty invariant is
about (`src/api/errorHandlers.ts`, `src/utils/offlineErrorHandler.ts`), and the epic's own frozen
spec. `context_files` was empty and this run is non-interactive with no human to ask, so the set was
resolved from what the request named — "the tests covering the changes currently in the working
tree" — rather than by hunting for artifacts. Context raised findings here; it waived none.

What it established:

- **Every line-number claim the tests make about the source is accurate.** `handleNetworkError`'s
  sync sentence really is at `src/api/errorHandlers.ts:95`; `OFFLINE_ERROR_MESSAGE` really is at
  `src/utils/offlineErrorHandler.ts:74`; `isPostgrestError` really spans
  `src/api/errorHandlers.ts:109-117` and really does key on `details` being present, which is the
  premise of the fake's `FakePostgrestError` shape and of the test at
  `interactionService.test.ts:90-104`. Comments asserting a mechanism are claims; these ones hold.
- **The reviewed diff closes a gap the epic recorded rather than inventing one.**
  `spec-dw-7-18-events-offline-message-honesty.md:56-69` deferred exactly this: "the fake builder's
  `or()`, `order()` and `range()` are deliberate no-ops, so the history read's predicate, ordering
  and pagination are not exercised at all". The working tree models all three and adds the
  success-path tests. That is the epic's P2 row TEST-05.
- **The spec's own I/O matrix was slightly wrong, and the tests corrected it rather than encoding
  it.** The matrix row at `:104` describes the zero-row insert as `{ data: null, error: null }`.
  `fakeInteractionsBackend.ts:9-32` shows measurement-backed that the reachable outcome under
  `.single()` is `PGRST116`, and that `{ data: null, error: null }` needs a 2xx with an empty body.
  Both are now modelled and both are asserted (`interactionService.test.ts:166-195`). This is the
  single most valuable thing in the diff and it would have been invisible to a test written from
  the matrix alone.
- **Acceptance criteria against assertions.** AC1 (no `handleNetworkError` import) and AC3 (no
  rejection promises a future sync) are covered, and `offlineMessageHonesty.test.ts` generalises AC1
  past this one module. AC4 is covered for `sendPoke` and only partly for `sendKiss` — finding (d)
  above. AC5 is a `git diff` invariant, not a test target.
- **One deferred entry stays uncovered, correctly.**
  `spec…:12-29` records that `markAsViewed` resolves successfully when its UPDATE matches zero rows
  under RLS. The new `markAsViewed` test (`:472-482`) seeds a matching row, so the silent-zero-row
  case is still unasserted — appropriately, because the guard does not exist yet and the spec's
  Never list excluded adding it (it is P3 / TEST-06 in the test design). Route that to `trace`, not
  here.

### Related Artifacts

- **Story / Spec**: [spec-dw-7-18-events-offline-message-honesty.md](../implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md)
- **Test Design**: [test-design-epic-dw-events-offline-message-honesty.md](./test-design-epic-dw-events-offline-message-honesty.md)
- **Risk Assessment**: highest is P1; the design records no P0 scenario and explains why
- **Priority Framework**: P0-P3 applied in the design, not yet carried into the test names

---

## Knowledge Base References

Listed by how far each was actually consulted, so a reader can tell a grounded citation from a
loaded-but-unused one.

**Read in full, and load-bearing for findings in this report:**

- **[test-quality.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)** — Definition of Done: hard waits, ≤1000 lines, committed skips and focus, assertions that cannot fail, suite structure and naming. Example 7 ("Assertions That Cannot Fail") is the C3/C5/C6 source.
- **[evidence-integrity.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/evidence-integrity.md)** — falsifiability, "Instruments verified before readings", "Names reconciled with assertions". Grounds the C5 non-fire, Best Practices 1, 2 and 4, and rowless findings (a) and (b).

**Read at the section that decided a call:**

- **[data-factories.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)** § Example 6, "Naming the Literals You Do Hardcode" (`:440-477`) — both L6 findings, and the exemption at `:477` that was checked against them.
- **[timing-debugging.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/timing-debugging.md)** § wall-clock fixtures (`:295-345`) — the H2 gate decision.
- **[selective-testing.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/selective-testing.md)** § Example 1, tag-based execution by priority (`:13-54`) — what the missing `[P#]` markers actually cost.
- **[playwright-utils-mandate.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/playwright-utils-mandate.md)** — consulted for the M9/L9 firing predicate; the mandate does not bind a vitest runner.

**Loaded as core for this stack, no row fired:**

- **[test-levels-framework.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-levels-framework.md)**, **[test-priorities-matrix.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-priorities-matrix.md)**, **[test-healing-patterns.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-healing-patterns.md)**, **[selector-resilience.md](../../.claude/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md)** — no DOM selectors, no failures to heal, and the level question was settled by the epic's own test design.

Not loaded, with the reason: the Playwright Utils and Pact.js fragment sets. `step-01` directs that
the profiles be skipped when the reviewed files execute under a runner the mandate does not bind,
and all three run under vitest; `pactjs-utils` is additionally not installed and there are no
contract artifacts in scope.

For coverage mapping, consult `trace` workflow outputs.

See [tea-index.csv](../../.claude/skills/bmad-testarch-test-review/resources/tea-index.csv) for the complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Add `[P#]` markers to all 37 tests** — copy the priorities the epic test design already
   assigns (TEST-01/02/03 → P1, TEST-04/05 → P2).
   - Priority: P3 (but it is the whole score gap)
   - Owner: PR author
   - Estimated Effort: 15-20 minutes

2. **Fix the two magic values** — name the pagination literals and make them differ; hoist the
   fake's default `created_at`.
   - Priority: P3
   - Owner: PR author
   - Estimated Effort: 15 minutes

3. **Assert `fromCalls === 0` in the `sendKiss` offline test** — one line, and it completes the
   acceptance criterion.
   - Priority: P3
   - Owner: PR author
   - Estimated Effort: 2 minutes

### Follow-up Actions (Future PRs)

1. **Replace the six-path list with an ESLint `no-restricted-imports` override** — the honesty
   test's own header already recommends it and explains why it was not done here. Resolves modules
   instead of pattern-matching import text, closes the namespace-import and re-export bypasses, and
   runs in the job that already lints `src`.
   - Priority: P2
   - Target: backlog (needs an operator decision on `eslint.config.js`)

2. **Rename or strengthen `it('covers every module in the list')`** — make the name and the
   assertion agree.
   - Priority: P3
   - Target: same change as (1)

3. **Extend `SUPABASE_ONLY_MODULES`, or derive it** — `loveNoteImageService.ts`, `LoveNotes.tsx`
   and `PokeKissInterface.tsx` are Supabase-only per `AGENTS.md` and are not on the list.
   - Priority: P3
   - Target: backlog

### Re-Review Needed?

⚠️ Re-review after the immediate actions — the markers and the two literals move the score from 61
to 100 with no change to what the tests check. Nothing here needs a pairing session or a refactor.

---

## Decision

**Recommendation**: Request Changes

**Rationale**:
The recommendation is computed from the deduped violation counts, not chosen: 0 CRITICAL and 0 HIGH
rule out `Block` and severity-driven `Request Changes`, and the score of 61 falls under the 70
floor, which returns `Request Changes` on volume. That floor is doing all the work here — 37 of the
39 findings are a single LOW Convention row for a missing `[P#]` prefix, and the remaining two are
unnamed literals. No determinism, isolation or performance row fired in any of the three files, and
no MEDIUM row fired anywhere.

Read literally, then: the tests are correct, falsifiable and fast, and they need a text pass before
merge. The registry forbids softening a computed verdict because context argues the findings are
acceptable, and this report does not soften it — but it does say plainly what the number is made
of, because a reader who saw "Request Changes / grade D" and assumed a correctness problem would
act on the wrong information. Fifty minutes of edits, listed under Immediate Actions, clears every
finding in this report.

> Test quality needs improvement with 61/100 score. 39 LOW violations, 37 of them one convention
> row, put the score under the 70 floor. No critical, high, or medium violation was detected, and
> all 44 tests pass in 470 ms.

---

## Appendix

### Violation Summary by Location

L2 is collapsed to one row per file with the complete line list inline, because 37 identical
entries would be less checkable rather than more. No line has been dropped.

| Line                                                                                                                                      | Severity | Criterion        | Row | Issue                                                       | Fix                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------- | --- | ------------------------------------------------------------- | -------------------------------------------------------- |
| `interactionService.test.ts` 76, 90, 106, 114, 124, 133, 142, 150, 166, 174, 182, 197, 208, 218, 229, 239, 249, 259, 273, 294, 304, 314, 324, 357, 363, 369, 375, 388, 397, 413, 428, 449, 472 (33) | P3       | Priority Markers | L2  | No `[P#]` marker; convention `emerging` at 9 of 40 sampled  | Add the marker the epic test design already assigns    |
| `offlineMessageHonesty.test.ts` 130, 135, 142, 154 (4)                                                                                    | P3       | Priority Markers | L2  | No `[P#]` marker; convention `emerging` at 9 of 40 sampled  | Add the marker the epic test design already assigns    |
| `interactionService.test.ts:370`                                                                                                          | P3       | Magic Value      | L6  | Two unnamed, equal `1`s for limit and offset                | Name both and make them differ over 3+ matching rows   |
| `fakeInteractionsBackend.ts:135` (also `:291`)                                                                                            | P3       | Magic Value      | L6  | Unexplained default `created_at`, duplicated                | Hoist to one `DEFAULT_CREATED_AT` constant             |

### Dimension Scores

Informational only. The deduction ledger above is the authoritative score.

| Dimension       | Score   | Grade | Violations |
| --------------- | ------- | ----- | ---------- |
| Determinism     | 100/100 | A     | 0          |
| Isolation       | 100/100 | A     | 0          |
| Maintainability | 22/100  | F     | 39         |
| Performance     | 100/100 | A     | 0          |

### Rows considered and deliberately not fired

Recorded so the next review can disagree with a decision rather than re-derive it.

| Row    | Where it nearly fired                                              | Why it did not                                                                                                                                                                                                                                  |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **C5** | `interactionService.test.ts:76-110`, the three "fake fidelity" tests | The predicate needs *no call into the system under test* between configuration and assertion. These set one flag and then call the fake's builder, whose own logic derives the asserted envelope. The row's rationale names a mocking library, not a hand-written fake with branching; `evidence-integrity.md` requires this check ("Instruments verified before readings"). |
| **H2** | `interactionService.test.ts:402`, `:457` — `Date.now()`              | `timing-debugging.md:345` scopes the row to "values that govern an expiry, a lifetime, a TTL, or a schedule". `beforeRead` governs none of those: it is a lower bound for a `created_at` fallback assertion, and because the service's own `new Date()` runs strictly after it, `getTime() >= beforeRead` cannot race. The value is asserted against, which is why the fragment's "never asserted against" clause is not the reason the gate is closed — the "governs" clause is. |
| **H3** | `interactionService.test.ts:283`                                     | An assertion in a loop fires only if the loop may run zero times. The array is a 4-element inline literal.                                                                                                                                      |
| **H4** | `interactionService.test.ts:33` — module-level mutable `backend`     | `beforeEach` calls `backend.reset()`; `navigator.onLine` is restored in both hooks and the console spy in `afterEach`.                                                                                                                            |
| **L5** | `'coerces a zero-row single() to PGRST116 …'` and similar            | The names reference an implementation symbol but state a behavior; 0 of 497 sampled corpus names are purely implementation-shaped, so the house form is the same.                                                                                |
| **M6** | `interactionService.test.ts:107`                                     | `.or()` throws before the thenable is consumed, so no promise floats.                                                                                                                                                                            |

### Quality Trends

First review of these files. No prior score to compare.

---

## Checklist Validation

Validated against `.claude/skills/bmad-testarch-test-review/checklist.md`. Items that needed a
decision or that were not satisfiable are recorded here rather than silently ticked.

| Checklist area                       | Result                                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test file discovery                  | ✅ 3 files, all readable. Framework Vitest 4.1.10, config found at `vitest.config.ts`                                                                          |
| Knowledge base loading               | ⚠️ Partial by design — see § Knowledge Base References for what was loaded and why the Playwright/Pact sets were skipped                                       |
| Context gathering                    | ✅ Spec and test design read; P1/P2 priorities extracted and used in Recommendation 1                                                                          |
| Every criterion has a status + basis | ✅ 17 rows, every `PASS (n/a)` states why its gate is closed                                                                                                   |
| Score matches the breakdown          | ✅ 100 − 39 + 0 = 61; grade D matches the 60-69 band                                                                                                            |
| Recommendation computed, not chosen  | ✅ `deriveRecommendation({0,0,0,39}, 61)` → `Request Changes` via the `score < 70` branch. Identical in § Executive Summary and § Decision                       |
| Every violation carries its row      | ✅ 39 of 39 carry L2 or L6; both severities read from the registry                                                                                             |
| Convention rows cite adoption        | ✅ All five Convention rows cite `<adopted> of 40 sampled`; the three `absent` ones deducted nothing                                                            |
| Context waivers                      | ✅ 0. Context raised findings (a), (d) and the AC checks; it waived nothing and changed no severity                                                             |
| Excluded-from-review-set manifest    | ✅ Omitted — nothing matched any of the three legal exclusion reasons. The non-test working-tree changes are named in § Test File Analysis instead              |
| Inline comments / badge / story edit | n/a — `generate_inline_comments` is `false`, and no badge or story-append option is configured. No test file was modified by this review                        |
| CLI sessions cleaned up              | n/a — no browser automation was needed for a vitest unit suite, so no `playwright-cli` session was opened                                                       |
| Temp artifacts location              | ⚠️ Deviation, disclosed in § Run-Level Preconditions: the four worker JSONs are in this session's scratchpad, not `{test_artifacts}/`, to keep intermediates out of a tracked artifact directory |
| No false positives                   | ✅ Every fired row re-checked against its predicate; the six close calls that did **not** fire are recorded in the Appendix with reasons                        |

**Notes**

- **Test Framework**: Vitest 4.1.10 (TypeScript, happy-dom environment)
- **Review Scope**: the three test artifacts changed in the working tree, all in `tests/unit/api/`
- **Quality Score**: 61/100, grade D
- **Critical Issues**: 0 P0, 0 P1
- **Recommendation**: Request Changes
- **Special Considerations**: the verdict is produced by the `score < 70` floor, not by any
  severity tier; 37 of 39 findings are one LOW Convention row
- **Follow-up Actions**: re-review after the three Immediate Actions; the ESLint
  `no-restricted-imports` upgrade is an operator decision tracked as a follow-up

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0 (step-file architecture), Create mode, sequential execution
**Review ID**: test-review-dw-events-offline-message-honesty-20260819
**Timestamp**: 2026-08-19 15:16:16
**Version**: 1.0

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in the knowledge base: `.claude/skills/bmad-testarch-test-review/resources/knowledge/`
2. Consult `tea-index.csv` for detailed guidance
3. Request clarification on specific violations — every one carries its registry row
4. The § *Rows considered and deliberately not fired* table records the close calls

This review applies the rubric consistently. Context can reveal additional findings and clarify
impact; it cannot waive a violation, change severity, or alter the score. Formal risk acceptance
belongs in `trace` or the release gate.

---

## Reviewed Files

- tests/unit/api/interactionService.test.ts
- tests/unit/api/fakeInteractionsBackend.ts
- tests/unit/api/offlineMessageHonesty.test.ts

## Review Context

- src/api/interactionService.ts
- src/api/errorHandlers.ts
- src/utils/offlineErrorHandler.ts
- _bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md
- _bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md
