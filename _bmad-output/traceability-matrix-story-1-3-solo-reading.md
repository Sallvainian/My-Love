# Traceability Matrix & Gate Decision - Story 1.3

**Story:** Solo Reading Flow  
**Date:** 2026-02-07  
**Evaluator:** TEA Test Architect (Murat)  
**Workflow:** `testarch-trace` (Phase 1 + Phase 2)

---

## Scope

- `tests/e2e/scripture/scripture-solo-reading.spec.ts`
- `tests/support/helpers.ts`
- `_bmad-output/test-review.md`
- `_bmad-output/implementation-artifacts/1-3-solo-reading-flow/story.md`
- `_bmad-output/implementation-artifacts/1-3-solo-reading-flow/acceptance-criteria.md`

## Evidence Inputs

- Reliability fix commits (user-provided): `f9983b3`, `bcc26d2`
- Burn-in signal from `_bmad-output/test-review.md:35`: consecutive green runs for `[P1-012]` and `[P2-012]`

---

## PHASE 1: Requirements Traceability

### AC -> Test ID -> File/Line Mapping

| Criterion ID | Priority | Acceptance Criterion (Summary) | Mapped Test ID(s) | Test File:Line | Helper File:Line | Level | Coverage | Evidence Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-1 | P0 | Solo session starts with first verse loaded and in-progress solo session state | `P0-009` | `tests/e2e/scripture/scripture-solo-reading.spec.ts:96`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:103`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:111` | `tests/support/helpers.ts:235`, `tests/support/helpers.ts:242`, `tests/support/helpers.ts:246`, `tests/support/helpers.ts:258`, `tests/support/helpers.ts:130` | E2E | FULL | Start path is asserted through visible `solo-reading-flow` and first verse assertions; helper path confirms solo/in-progress lookup and session creation API observation. |
| AC-2 | P1 | Verse screen renders required controls and progress text | `P0-009`, `UNSCOPED-ID-VERSE-SCREEN` | `tests/e2e/scripture/scripture-solo-reading.spec.ts:137`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:145`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:150`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:154`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:159`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:165` | `tests/support/helpers.ts:235` | E2E | FULL | Explicit assertions cover verse reference/text, View Response, Next Verse, and `Verse 1 of 17` indicator. |
| AC-3 | P1 | Response screen navigation (view response, back to verse, keep next action) | `UNSCOPED-ID-RESP-NAV`, `UNSCOPED-ID-RESP-ADVANCE` | `tests/e2e/scripture/scripture-solo-reading.spec.ts:168`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:173`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:177`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:182`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:187`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:191`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:194`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:197`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:207` | `tests/support/helpers.ts:235` | E2E | FULL | Direct response-screen entry, response content visibility, back navigation, and response-path advancement are asserted. |
| AC-4 | P1 | Step advancement updates progress and moves flow forward | `P1-001`, `P1-012`, `P0-009` | `tests/e2e/scripture/scripture-solo-reading.spec.ts:219`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:231`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:241`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:245`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:257`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:260`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:265`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:42`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:67` | `tests/support/helpers.ts:297`, `tests/support/helpers.ts:308` | E2E | FULL | Progress increments are asserted across steps; reflection-submit transition includes PATCH/POST observability and user-visible progression. |
| AC-5 | P2 | Session completion boundary at step 17 transitions to completion/reflection phase | `P2-012`, `P0-009` | `tests/e2e/scripture/scripture-solo-reading.spec.ts:269`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:286`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:290`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:291`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:129`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:132` | `tests/support/helpers.ts:297` | E2E | FULL | Final-step boundary and completion screen transition are explicitly asserted on the 17th step path. |
| AC-6 | P1 | Exit with save prompt and in-progress persistence | `N/A (no explicit tagged test in scoped spec)` | `tests/e2e/scripture/scripture-solo-reading.spec.ts:19` | `tests/support/helpers.ts:147`, `tests/support/helpers.ts:150`, `tests/support/helpers.ts:151`, `tests/support/helpers.ts:152`, `tests/support/helpers.ts:153`, `tests/support/helpers.ts:238` | E2E helper path | PARTIAL | Save/exit behavior exists in helper normalization path, but scoped tests do not directly assert the AC-6 prompt/persistence contract (`current_step_index` + `status='in_progress'`) as an explicit scenario. |

### Coverage Summary

| Priority | Total AC | FULL | PARTIAL | NONE | FULL % | Covered % (FULL+PARTIAL) | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| P0 | 1 | 1 | 0 | 0 | 100% | 100% | ✅ PASS |
| P1 | 4 | 3 | 1 | 0 | 75% | 100% | ⚠️ WARN |
| P2 | 1 | 1 | 0 | 0 | 100% | 100% | ✅ PASS |
| **Total** | **6** | **5** | **1** | **0** | **83%** | **100%** | **⚠️ CONCERNS** |

### Gap Analysis

#### High Priority Gaps

1. **AC-6 (P1) is PARTIAL, not FULL**
   - Missing explicit scenario-level assertion for the exit prompt contract and persistence of `status='in_progress'` with saved step index.
   - Current support relies on conditional helper execution (`normalizeOverviewFromActiveFlow`) rather than dedicated user-journey test intent.

#### Critical / Medium / Low Gaps

- Critical (P0): 0
- Medium (P2): 0
- Low (P3): 0

---

## PHASE 2: Deterministic Gate Decision

### Decision Inputs

- `P0 FULL coverage`: `100%` (1/1)
- `Overall FULL coverage`: `83%` (5/6)
- Manual waiver: `false`

### Decision Rule Evaluation

1. Rule 1 (`P0 < 100% => FAIL`): **NOT triggered** (`P0 = 100%`)
2. Rule 2 (`Overall FULL >= 90% => PASS`): **NOT met** (`83%`)
3. Rule 3 (`Overall FULL >= 75% => CONCERNS`): **met** (`83%`)
4. Rule 4 (`Overall FULL < 75% => FAIL`): not applicable
5. Rule 5 (`manual waiver => WAIVED`): not applicable

## GATE DECISION: ⚠️ CONCERNS

### Rationale

Gate does not fail because P0 is fully covered and stable. Gate does not pass because overall FULL traceability is below the 90% PASS threshold due to AC-6 being partial. Reliability hardening evidence is positive (`f9983b3`, `bcc26d2`) and burn-in for `[P1-012]` / `[P2-012]` is green, but this evidence does not close the explicit AC-6 traceability gap.

---

## Residual Flake-Risk Assessment

| Risk | Probability | Impact | Score | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| Backend/auth coupling can still fail setup before flow assertions | Medium | Medium | 6 | `_bmad-output/test-review.md:27`, `_bmad-output/test-review.md:28`, `tests/support/helpers.ts:88` | Keep auth preflight diagnostics and ensure env/token prerequisites in CI and local runs. |
| Strict response-gated helper hotspots remain in shared helpers | Medium | Medium | 6 | `_bmad-output/test-review.md:104`, `tests/support/helpers.ts:308`, `tests/support/helpers.ts:359`, `tests/support/helpers.ts:399` | Apply UI-first + bounded diagnostic pattern consistently to these helper paths. |
| Long 17-step scenarios require elevated timeout budgets | Low | Medium | 4 | `_bmad-output/test-review.md:29`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:100`, `tests/e2e/scripture/scripture-solo-reading.spec.ts:273` | Keep targeted burn-in and isolate long-path tests for nightly/critical lanes. |
| AC-6 relies on conditional helper branch rather than explicit dedicated test | Medium | Medium | 6 | `tests/support/helpers.ts:238`, `tests/support/helpers.ts:147` | Add explicit AC-6 scenario test to move PARTIAL -> FULL and remove ambiguity. |

**Overall residual risk:** **Medium-Low**, bounded but not fully retired.

---

## Recommendation

**Do not close the gate yet.**

Run **`TA` (Test Automation)** next to add an explicit AC-6 scenario (`Exit with Save`) with deterministic assertions for:
- prompt visibility and button behavior,
- persisted `status='in_progress'`,
- persisted step index save semantics.

If product/stakeholders want stricter Given/When/Then acceptance decomposition before implementation, run `AT` first, then `TA`.

---

## Sign-Off Snapshot

- Story ID: `1.3`
- Total AC: `6`
- FULL: `5`
- PARTIAL: `1`
- NONE: `0`
- Deterministic decision: **`CONCERNS`**
- Recommended next workflow: **`TA`**

