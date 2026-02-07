# Test Design: Epic 2 - Reflection & Daily Prayer Report

**Date:** 2026-02-02
**Author:** Sallvain
**Status:** Draft
**Epic:** Epic 2 — Reflection & Daily Prayer Report
**Architecture Reference:** `_bmad-output/test-design-architecture.md`
**QA Reference:** `_bmad-output/test-design-qa.md`

---

## Executive Summary

**Scope:** Full test design for Epic 2

Epic 2 enables users to reflect on each scripture step with a rating, per-verse bookmark flag, and optional note. At the end of a session, users can send a message to their partner and view the Daily Prayer Report showing their own reflections and their partner's message. Handles unlinked users gracefully.

**Risk Summary:**

- Total risks identified: 10
- High-priority risks (>=6): 2
- Critical categories: DATA (reflection persistence reliability)

**Coverage Summary:**

- P0 scenarios: 5 (~10-15 hours)
- P1 scenarios: 11 (~11-17 hours)
- P2/P3 scenarios: 14 (~6-12 hours)
- **Total effort**: ~27-44 hours (~4-6 days)

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|:-----------:|:------:|:-----:|------------|-------|----------|
| R2-001 | DATA | Reflection write fails silently — user loses rating/note due to network error without visible feedback | 2 | 3 | **6** | Optimistic UI with retry queue; surface persistent failure with "Couldn't save" toast and manual retry button | Frontend Dev | Sprint (Epic 2) |
| R2-002 | DATA | Idempotency constraint violation on reflection resubmit — unique constraint (session_id + step_index + user_id) rejects legitimate retry after network timeout | 2 | 3 | **6** | Use upsert (ON CONFLICT UPDATE) instead of insert; ensure RPC handles retries gracefully | Backend Dev | Sprint (Epic 2) |

### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|:-----------:|:------:|:-----:|------------|-------|
| R2-003 | BUS | Unlinked user sees partner messaging UI — user with no partner reaches "Write something for [Partner Name]" screen | 2 | 2 | 4 | Guard clause checks partner_id before rendering message composition; skip to completion | Frontend Dev |
| R2-005 | BUS | Bookmark toggle race condition — rapid tapping causes inconsistent state between UI and server | 2 | 2 | 4 | Debounce bookmark toggle (300ms); last-write-wins with server reconciliation | Frontend Dev |
| R2-006 | TECH | End-of-session summary shows stale bookmarks — IndexedDB cache not updated after toggle during session | 2 | 2 | 4 | Write-through pattern: update IndexedDB after server write; summary reads server as source of truth | Frontend Dev |
| R2-007 | BUS | Daily Prayer Report renders incomplete when partner hasn't completed — broken layout instead of "Waiting" state | 2 | 2 | 4 | Distinct UI state for partner_incomplete; test with seeded incomplete partner data | Frontend Dev + QA |
| R2-010 | DATA | Together mode report shows mismatched step data — partner A's ratings don't align with partner B's in side-by-side view | 2 | 2 | 4 | Query both users' reflections by session_id and step_index; order by step_index | QA |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|:-----------:|:------:|:-----:|--------|
| R2-004 | SEC | Partner message visible to wrong user — RLS policy gap allows unauthorized read of Daily Prayer Report messages | 1 | 3 | 3 | RLS penetration testing |
| R2-008 | PERF | Reflection summary query slow with many bookmarks — loading 17 steps' worth of bookmarks + reflections | 1 | 2 | 2 | Index on session_id; monitor |
| R2-009 | BUS | Character counter UX confusing — textarea allows typing beyond limit before showing counter | 1 | 1 | 1 | Monitor |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority classification based on risk and business impact, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (>=6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|:----------:|:---------:|-------|
| 2.1-E2E-001 | Submit per-step reflection with rating and note — data persists to server | E2E | R2-001 | FR30, FR32; validates core emotional payoff |
| 2.1-API-001 | Reflection write idempotency — upsert on (session_id, step_index, user_id) does not reject retries | API | R2-002 | NFR-R6; prevents data loss on network retry |
| 2.1-E2E-002 | Bookmark toggle persists to server — filled amber when active, outlined when inactive | E2E | R2-005 | Write-through to server, cache in IndexedDB |
| 2.3-E2E-001 | Daily Prayer Report loads after session completion — own ratings and bookmarks visible | E2E | — | FR36, FR37; end-to-end happy path |
| 2.3-E2E-002 | Unlinked user (partner_id null) bypasses messaging — session marked complete, reflections saved | E2E | R2-003 | FR39; graceful degradation |

**Total P0:** 5 scenarios

### P1 (High)

**Criteria:** Important features + Medium risk (3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|:----------:|:---------:|-------|
| 2.1-E2E-003 | Rating validation — Continue disabled until rating selected; quiet helper text appears | E2E | — | FR30, FR33; no aggressive validation |
| 2.1-E2E-004 | Reflection write failure shows retry UI — server error triggers visible non-blocking indicator | E2E | R2-001 | NFR-R2; confirms mitigation works |
| 2.2-E2E-001 | End-of-session summary displays bookmarked verses with highlight | E2E | R2-006 | Verifies write-through cache consistency |
| 2.2-E2E-002 | Standout verse selection + session-level rating required before Continue | E2E | — | Story 2.2; quiet validation pattern |
| 2.2-API-001 | Reflection summary data saved to server — session phase advances to 'report' | API | — | Phase state machine transition |
| 2.3-E2E-003 | Partner message composition (max 300 chars) and send — message stored | E2E | — | FR34 |
| 2.3-E2E-004 | Skip message option works — tertiary button, no guilt language, session completes | E2E | — | FR35 |
| 2.3-E2E-005 | Report shows partner's message when partner has completed (card styling) | E2E | R2-007 | FR38; "like receiving a gift" UX |
| 2.3-E2E-006 | Report shows "Waiting for [Partner Name]" when partner hasn't completed | E2E | R2-007 | Distinct incomplete-partner state |
| 2.1-UNIT-001 | Bookmark toggle debounce — rapid toggles coalesce to single server write | Unit | R2-005 | Isolates debounce logic |
| 2.3-API-001 | RLS: partner message SELECT restricted to sender_id or recipient_id | API | R2-004 | NFR-S3; security boundary test |

**Total P1:** 11 scenarios

### P2 (Medium)

**Criteria:** Secondary features + Low risk + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|:----------:|:---------:|-------|
| 2.2-E2E-003 | "You didn't mark any verses — that's okay" when no bookmarks | E2E | — | Empty state handling |
| 2.2-E2E-004 | Fade-through-white transition (400ms); instant if reduced-motion | E2E | — | NFR-A4 |
| 2.2-E2E-005 | Focus moves to reflection form heading on transition | E2E | — | FR52; a11y focus management |
| 2.3-E2E-007 | Together mode report: side-by-side ratings and bookmarks for both partners | E2E | R2-010 | FR41 |
| 2.3-API-002 | Solo session partner views Daily Prayer Report asynchronously | API | — | FR40 |
| 2.1-E2E-005 | Bookmark aria-labels toggle: "Bookmark this verse" / "Remove bookmark" | E2E | — | FR51; a11y |
| 2.1-E2E-006 | Rating radiogroup aria-labels: "Rating 1 of 5: A little" through "Rating 5 of 5: A lot" | E2E | — | FR33, NFR-A3 |
| 2.1-COMP-001 | Character counter appears at 200+ chars (note textarea) with muted style | Component | — | UI polish |
| 2.3-E2E-008 | Keyboard overlap handled: CTA above keyboard or collapse on blur | E2E | — | Mobile UX |
| 2.2-E2E-006 | Verse selection chips minimum 48x48px touch targets | E2E | — | NFR-A2 |

**Total P2:** 10 scenarios

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|:----------:|:---------:|-------|
| 2.3-E2E-009 | Both partners' standout verse selections shown in Together mode report | E2E | — | Extended Together mode coverage |
| 2.3-E2E-010 | Bookmark sharing respects opt-in toggle from reflection summary | E2E | — | Privacy control |
| 2.1-PERF-001 | Reflection summary query completes in <500ms with 17 steps of data | API | R2-008 | Performance benchmark |
| 2.1-E2E-007 | Full keyboard navigation through 1-5 rating scale | E2E | — | a11y exploratory |

**Total P3:** 4 scenarios

---

## Execution Strategy

| Tier | Scope | Target Duration | Trigger |
|------|-------|:---------------:|---------|
| **Every PR** | All P0 + P1 functional tests (16 scenarios) | < 12 min | PR to main |
| **Nightly** | Full suite P0-P2 (26 scenarios) | < 25 min | Scheduled |
| **Weekly** | All P0-P3 + performance benchmark (30 scenarios) | < 35 min | Scheduled |

Philosophy: Run everything in PRs if under 15 minutes. With Playwright parallelization, 16 scenarios fit well within this budget. Defer only the P2/P3 edge cases and performance benchmarks to nightly/weekly.

---

## Resource Estimates

| Priority | Count | Total Hours | Notes |
|----------|:-----:|:-----------:|-------|
| P0 | 5 | ~10-15 | Complex setup, data integrity assertions |
| P1 | 11 | ~11-17 | Standard E2E + API patterns |
| P2 | 10 | ~5-10 | Accessibility + edge cases |
| P3 | 4 | ~1-2 | Exploratory, performance |
| **Total** | **30** | **~27-44** | **~4-6 days (1 QA)** |

### Prerequisites

**Test Data:**

- Extend `testSession` fixture with `include_reflections`, `include_bookmarks`, `include_messages` params
- `createReflection` factory (session_id, step_index, user_id, rating, notes)
- `createBookmark` factory (session_id, step_index, user_id)
- `createPartnerMessage` factory (session_id, sender_id, recipient_id, content)
- Partner state presets: "partner_completed", "partner_not_completed", "no_partner"

**Tooling:**

- Playwright + `@seontechnologies/playwright-utils` (already configured)
- Existing `merged-fixtures` pattern and `supabaseAdmin` fixture

**Environment:**

- Supabase local or staging with test data seeding RPC (from Sprint 0)
- `scripture_seed_test_data` RPC extended for reflections, bookmarks, and messages

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >= 95% (waivers required for failures)
- **P2/P3 pass rate**: >= 90% (informational)
- **High-risk mitigations (R2-001, R2-002)**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths (reflection save, report load)**: >= 80%
- **Security scenarios (RLS partner isolation)**: 100%
- **Business logic (unlinked user, partner states)**: >= 70%
- **Accessibility (aria, focus, reduced-motion)**: >= 50%

### Non-Negotiable Requirements

- All P0 tests pass
- No high-risk (>=6) items unmitigated
- Reflection idempotency (R2-002) verified via API test
- RLS partner message isolation (R2-004) verified via API test

---

## Mitigation Plans

### R2-001: Reflection Write Fails Silently (Score: 6)

**Mitigation Strategy:**
1. Implement optimistic UI with background retry queue (3 retries, exponential backoff)
2. On persistent failure (3 retries exhausted), show non-blocking "Couldn't save your reflection" toast
3. Provide manual "Retry" button that re-attempts the write
4. Never block session advancement — user can continue; reflection syncs when connectivity returns

**Owner:** Frontend Dev
**Timeline:** Sprint (Epic 2)
**Status:** Planned
**Verification:** 2.1-E2E-004 confirms retry UI appears on server error; 2.1-E2E-001 confirms data persists on success

### R2-002: Idempotency Constraint Rejects Retries (Score: 6)

**Mitigation Strategy:**
1. Change reflection insert RPC to use `INSERT ... ON CONFLICT (session_id, step_index, user_id) DO UPDATE`
2. Ensure updated_at timestamp changes on upsert (for cache invalidation)
3. Return success (200) on conflict rather than 409

**Owner:** Backend Dev
**Timeline:** Sprint (Epic 2)
**Status:** Planned
**Verification:** 2.1-API-001 submits same reflection twice and asserts both return success with correct data

---

## Assumptions and Dependencies

### Assumptions

1. Sprint 0 blockers from system-level test architecture (R-001 seeding RPC, R-002 Broadcast mock, R-008 dbSchema centralization) are resolved before Epic 2 testing begins
2. Supabase RLS policies for `scripture_reflections`, `scripture_bookmarks`, and partner messages follow session-based isolation pattern from Epic 1
3. IndexedDB caching pattern from Epic 1 extends to reflection and bookmark data without architectural changes

### Dependencies

1. `scripture_seed_test_data` RPC extended for reflections, bookmarks, and messages — Required before P0 test development
2. Upsert semantics for reflection write RPC (R2-002 mitigation) — Required before P0 test 2.1-API-001
3. Epic 1 test infrastructure (merged-fixtures, testSession, supabaseAdmin) — Assumed available

### Risks to Plan

- **Risk**: Epic 1 test infrastructure incomplete or flaky
  - **Impact**: Epic 2 test development blocked or delayed
  - **Contingency**: Prioritize stabilizing Epic 1 fixtures before starting Epic 2 tests

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run)
- Run `*automate` for broader coverage once implementation exists

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework
- `probability-impact.md` — Risk scoring methodology
- `test-levels-framework.md` — Test level selection
- `test-priorities-matrix.md` — P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd/`
- Epic: `_bmad-output/planning-artifacts/epics/epic-2-reflection-daily-prayer-report.md`
- Architecture: `_bmad-output/test-design-architecture.md`
- QA: `_bmad-output/test-design-qa.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/bmm/testarch/test-design`
**Version**: 4.0 (BMad v6)
