---
title: 'DW-156: add MESSAGE_FAVORITES to the STORE_NAMES core-names test'
type: 'chore'
created: '2026-09-16'
status: 'done'
baseline_revision: 'dd58d64b86dc21107f84737d3c10c8a5e9b15cc8'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      STORE_NAMES core-names it is five independent toBe asserts, not an
      exact key set, so extra keys still pass.
    evidence: |-
      tests/unit/services/dbSchema.test.ts:695-699 five toBe lines.
      Pre-existing four-expect style; this change added MESSAGE_FAVORITES
      in the same form. Intent asked to add that expect, not Object.keys
      or toEqual of the whole map.
    location: >-
      tests/unit/services/dbSchema.test.ts:695-699
    severity: low
---

<intent-contract>

## Intent

**Problem:** `STORE_NAMES` in `src/services/dbSchema.ts` exports five names, including `MESSAGE_FAVORITES: 'message-favorites'`. The core-names `it` in `tests/unit/services/dbSchema.test.ts` still asserts only `MESSAGES`, `PHOTOS`, `MOODS`, and `SW_AUTH`. Story 4 deleted the scripture `STORE_NAMES` `it` and did not add the fifth survivor.

**Approach:** Add `MESSAGE_FAVORITES` to that core-names assertion. Do not change `STORE_NAMES` itself.

## Boundaries & Constraints

**Always:**
- Keep the four existing expects (`MESSAGES` / `PHOTOS` / `MOODS` / `SW_AUTH`) and add `expect(STORE_NAMES.MESSAGE_FAVORITES).toBe('message-favorites')` in the same `it`.
- One-file change: `tests/unit/services/dbSchema.test.ts` only (plus this spec artifact).

**Never:**
- Do not edit `src/services/dbSchema.ts` or `STORE_NAMES`.
- Do not edit `_bmad-output/implementation-artifacts/deferred-work.md`.
- Do not re-add scripture store names or types.
- Do not change production code, schema version, or other tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Core-names `it` | `STORE_NAMES` as exported (five keys, `MESSAGE_FAVORITES: 'message-favorites'`) | The `it` asserts all five names, including `MESSAGE_FAVORITES` → `'message-favorites'` | Test fails if that expect is missing or the string differs |

</intent-contract>

## Code Map

- `src/services/dbSchema.ts:117-123` — read-only. Current export:
  `MESSAGES: 'messages'`, `MESSAGE_FAVORITES: 'message-favorites'`, `PHOTOS: 'photos'`, `MOODS: 'moods'`, `SW_AUTH: 'sw-auth'`. Do not edit.
- `tests/unit/services/dbSchema.test.ts:693-699` — `describe('STORE_NAMES constants')` / `it('should have correct core store names')`. Ledger line numbers (`:566-571`, intent `:628-633`) are stale after later tests; this is the `it`. Today it asserts only the four names. Add `MESSAGE_FAVORITES`.
- `_bmad-output/implementation-artifacts/deferred-work.md` — orchestrator records resolution. Do not edit.

## Tasks & Acceptance

**Execution:**
- `tests/unit/services/dbSchema.test.ts` — in `it('should have correct core store names')`, add `expect(STORE_NAMES.MESSAGE_FAVORITES).toBe('message-favorites')` beside the four existing expects. Leave every other `it` in this file unchanged.

**Acceptance Criteria:**
- Given `STORE_NAMES` exports `MESSAGE_FAVORITES: 'message-favorites'` plus `MESSAGES`, `PHOTOS`, `MOODS`, and `SW_AUTH`, when `it('should have correct core store names')` runs, then it asserts all five of those key/value pairs.
- Given `src/services/dbSchema.ts` and `_bmad-output/implementation-artifacts/deferred-work.md`, when this change lands, then those two files are unchanged.

## Spec Change Log

## Review Triage Log

### 2026-09-16 — Review pass
- verdicts: 11 findings — high 0, medium 0, low 4, false 7, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind hunter: matrix Error Handling says the test fails if the expect is missing — `tests/unit/services/dbSchema.test.ts:696` `expect(STORE_NAMES.MESSAGE_FAVORITES).toBe('message-favorites')` fails when the value is not `'message-favorites'`. Absence of an expect is true of any additive `toBe`; that wording lives in this spec (`:38`). Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: verification cannot prove the change because the commands pass on the pre-change tree — verification-gap reported no gaps. The covering `it('should have correct core store names')` is in the 17/17 `npx vitest run tests/unit/services/dbSchema.test.ts` pass; the diff is the fifth expect. An `rg`/freeze-list would be editing this spec's Verification section.
  - `[low]` `[defer]` Blind hunter: the `it` is still five independent `toBe`s, so extra `STORE_NAMES` keys still pass — `tests/unit/services/dbSchema.test.ts:695-699`. Pre-existing four-expect style; this change added `MESSAGE_FAVORITES` in the same form. Intent asked to add that expect, not `Object.keys`/`toEqual`.
  - `[low]` `[reject]` Blind hunter: `STORE_NAMES` is not bound to live stores; production uses `'message-favorites'` literals — `src/services/messageFavorites.ts:12` `db.getAllFromIndex('message-favorites', 'by-user', userId)`; `src/services/storage.ts:285` and `src/services/customMessageService.ts:370` use the same literal. Intent: "This is a one-file test completeness fix; do not change STORE_NAMES itself." Production wiring is out of scope.
  - `[false]` `[reject]` Blind hunter: matrix has no red-run row for a missing or mistyped `MESSAGE_FAVORITES` — the added `toBe('message-favorites')` is that mistype catch. A missing-expect row would describe deleting the line this story added. Fix would be editing this spec's matrix.
  - `[false]` `[reject]` Intent alignment: spec artifact is a surface the bundle intent did not name — bmad-build-auto requires `{spec_file}`; the product hunk is still the one test file. `src/services/dbSchema.ts` and `_bmad-output/implementation-artifacts/deferred-work.md` are unchanged.
  - `[false]` `[reject]` Intent alignment: intent/ledger line numbers (`:628-633` / `:566-571`) are not the edited lines — same `it('should have correct core store names')`; current lines are `:693-700` after later tests. Not a second `it`.
  - `[low]` `[defer]` Intent alignment: Reading B (closed set of five `STORE_NAMES` keys) is not implemented — same root as the independent-`toBe` row; `tests/unit/services/dbSchema.test.ts:695-699`.
  - `[low]` `[reject]` Intent alignment: Reading C (bind the constant to IndexedDB survivors) is not implemented — store existence already uses the literal `'message-favorites'` at `tests/unit/services/dbSchema.test.ts:63-67` and `:75` `length).toBe(5)`. Intent named the core-names `STORE_NAMES` assertion, not those store tests.
  - `[false]` `[reject]` Intent alignment: Reading D (repair ledger `location:`) vs the diff — spawn and intent.md said do not edit the deferred-work ledger. `_bmad-output/implementation-artifacts/deferred-work.md:1556` still `status: open`.
  - `[false]` `[reject]` Intent alignment: Reading E (rewrite other `'message-favorites'` literals in the same file) vs the diff — intent: "Add MESSAGE_FAVORITES to the STORE_NAMES core-names assertion." Other `it`s were left unchanged.

## Verification

**Commands:**
- `npx vitest run tests/unit/services/dbSchema.test.ts` -- expected: exit 0, including `should have correct core store names`
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0

## Auto Run Result

Status: done

Summary of implemented change: The STORE_NAMES core-names `it` now asserts `MESSAGE_FAVORITES: 'message-favorites'` next to the four existing names. Production `STORE_NAMES` and `_bmad-output/implementation-artifacts/deferred-work.md` were not edited.

Files changed:
- `tests/unit/services/dbSchema.test.ts` — added `expect(STORE_NAMES.MESSAGE_FAVORITES).toBe('message-favorites')` in `it('should have correct core store names')`
- `_bmad-output/implementation-artifacts/spec-dw-156-store-names-message-favorites.md` — build-auto spec

Review findings breakdown: patches applied: none (high 0, medium 0). Items deferred: 1 (core-names `it` remains independent `toBe`s, not an exact key set). Rejected: matrix/verification wording (spec edits); production `'message-favorites'` literals (intent is a one-file test fix); spec artifact required by build-auto; stale intent/ledger line numbers (same `it`); ledger left open (orchestrator records resolution); other `'message-favorites'` literals in the same file (intent named the core-names assertion).

Follow-up review recommendation: false. Patched this pass: high 0, medium 0, low 0.

Verification performed:
- `npx vitest run tests/unit/services/dbSchema.test.ts` — exit 0, 17/17 passed, including `should have correct core store names`
- `npm run typecheck` — exit 0
- `npm run lint` — exit 0
- `git diff HEAD -- src/services/dbSchema.ts _bmad-output/implementation-artifacts/deferred-work.md` — empty

Residual risks: extra `STORE_NAMES` keys still pass the core-names `it` until that assertion becomes an exact set (deferred, low).
