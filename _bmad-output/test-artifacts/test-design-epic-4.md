---
stepsCompleted: []
lastStep: ''
lastSaved: ''
---

# Test Design: Epic 4 — Together Mode: Synchronized Reading

**Date:** 2026-02-20
**Author:** Sallvain
**Status:** Draft
**Epic:** Epic 4 — Together Mode — Synchronized Reading
**Architecture Reference:** `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md`

---

## Executive Summary

**Scope:** Full test design for Epic 4 — Together Mode (Stories 4.1, 4.2, 4.3)

Epic 4 enables couples to read scripture together in real-time with a lobby, Reader/Responder role selection, 3-second countdown, synchronized phase advancement via lock-in mechanism, partner position indicators, and graceful reconnection handling. Includes no-shame fallback to solo from lobby.

**Key architectural features under test:** Supabase Broadcast channel (`scripture-session:{session_id}`), Ephemeral Presence channel (`scripture-presence:{session_id}`), `scripture_lock_in` RPC with `expected_version` optimistic concurrency, server-authoritative countdown.

**Risk Summary:**

- Total risks identified: 13
- High-priority risks (≥6): 6 (TECH×3, DATA×1, BUS×1, SEC×1)
- Critical categories: TECH (concurrency, anti-race, presence TTL), SEC (broadcast authorization)
- Gate status: **CONCERNS** — 6 MITIGATE risks require resolution before release

**Coverage Summary:**

- P0 scenarios: 11 tests (~20–35 hours)
- P1 scenarios: 17 tests (~20–30 hours)
- P2/P3 scenarios: 16 tests (~8–14 hours)
- **Total effort**: ~48–79 hours (~6–10 days)

> **Note on P0 density:** Together Mode is a real-time synchronized feature where both users share a single session state. Many failure modes have no workaround (a stuck lock-in blocks both users; channel auth failure exposes session data). Higher P0 density than the 10% guideline is justified for this epic.

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|-----------|
| **Epic 1 Solo Reading** | Already shipped and tested; regression suite in place | Regression pass required (see Interworking) |
| **Epic 2 Reflection + Daily Prayer Report** | Already shipped and tested; Together mode exits to this phase | Regression pass required |
| **Supabase Realtime infrastructure config** | Platform team owns channel limits, billing, connection pool | Platform monitoring in place |
| **Performance testing at scale** | App is single-couple; presence overhead negligible at current scale | E4-R12 documented as MONITOR |
| **Extended WCAG 2.1 AA accessibility** | ACs specify exact aria-live requirements; deep screen reader flows beyond specified ACs deferred | Manual QA review recommended before launch |

---

## Risk Assessment

### High-Priority Risks (Score ≥6) — MITIGATE Required

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|---|---|-------|------------|-------|----------|
| E4-R01 | TECH | **Lock-In RPC concurrency** — both users click "Ready" simultaneously; non-atomic upsert could double-advance `current_step_index` or corrupt `version` | 2 | 3 | **6** | RPC uses `expected_version` guard + atomic `UPDATE ... WHERE version = expected_version`; second writer receives 409 | Backend Dev | Sprint (Epic 4) |
| E4-R02 | TECH | **Stale broadcast ingestion** — client receives out-of-order or replayed broadcast with `version ≤ localVersion`; anti-race guard missing or broken | 2 | 3 | **6** | Client discards any broadcast where `incoming.version ≤ local.version`; explicit unit test for bypass scenario | Frontend Dev | Sprint (Epic 4) |
| E4-R03 | DATA | **Incomplete 409 rollback** — server rejects `scripture_lock_in` with 409; optimistic `pending_lock_in` not cleared; UI permanently shows "Ready", partner advancement blocked | 2 | 3 | **6** | Full rollback on 409: reset `pending_lock_in`, refetch canonical session state, show "Session updated" toast | Frontend Dev | Sprint (Epic 4) |
| E4-R04 | TECH | **Presence TTL false positive** — mobile OS backgrounds app, heartbeat stops; partner sees "Partner reconnecting..." for an active partner who is merely backgrounded | 3 | 2 | **6** | Grace buffer before showing reconnecting indicator (>20s); distinguish network loss vs backgrounded app | Frontend Dev | Sprint (Epic 4) |
| E4-R05 | BUS | **Reconnection snapshot miss** — disconnected partner rejoins but `snapshot_json` not fetched or applied; partner resumes at stale step/phase | 2 | 3 | **6** | On reconnect: always refetch session via server API; apply `snapshot_json` before resuming; version check guards | Frontend Dev | Sprint (Epic 4) |
| E4-R06 | SEC | **Broadcast channel authorization gap** — `scripture-session:{session_id}` channel missing `private: true` or `realtime.messages` RLS policy omitted; non-session member reads session events | 2 | 3 | **6** | Private channel required; RLS policy on realtime.messages: `session_id IN (SELECT id FROM scripture_sessions WHERE user1_id = auth.uid() OR user2_id = auth.uid())` | Backend Dev | Sprint (Epic 4) |

### Medium-Priority Risks (Score 3–5)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
|---------|----------|-------------|---|---|-------|------------|-------|
| E4-R07 | BUS | **Countdown clock drift** — server sends `startedAt` timestamp; client renders from `Date.now()` with network delay; visible mismatch between partners >1s | 2 | 2 | 4 | Clients compute `timeRemaining = startedAt + 3000 - Date.now()`; drift ≤500ms acceptable; test with simulated delay | Frontend Dev |
| E4-R08 | BUS | **Solo fallback channel leak** — user taps "Continue solo" in lobby; broadcast channel not unsubscribed; stale listener persists into future sessions | 2 | 2 | 4 | Channel cleanup required in solo-fallback code path; integration test verifies unsubscribe called | Frontend Dev |
| E4-R09 | DATA | **Role alternation off-by-one** — `step_index % 2` logic inverted; wrong roles shown from step 2 onward | 2 | 2 | 4 | Unit test `determineRole(baseRole, stepIndex)` across steps 0–16; E2E verifies pill badge text on step 2 | Frontend Dev |
| E4-R10 | BUS | **Accessibility regression — countdown** — aria-live announcement missing; reduced-motion users see animation instead of static | 2 | 2 | 4 | Accessibility E2E: assert aria-live content; assert `prefers-reduced-motion` respected | Frontend Dev |
| E4-R11 | BUS | **No-shame language compliance** — lobby fallback and reconnection timeout use blame or alarm language | 1 | 3 | 3 | Assert exact AC-specified strings: "Continue solo", "Your partner seems to have stepped away", "Holding your place" | QA |

### Low-Priority Risks (Score 1–2)

| Risk ID | Category | Description | P | I | Score | Action |
|---------|----------|-------------|---|---|-------|--------|
| E4-R12 | PERF | Presence heartbeat every 10s — negligible at current scale | 1 | 2 | 2 | Monitor |
| E4-R13 | OPS | Channel count at session end — both channels must be unsubscribed | 1 | 2 | 2 | Monitor |

### Risk Category Legend

- **TECH**: Technical/Architecture (concurrency, integration, flakiness)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, resource limits)
- **DATA**: Data Integrity (corruption, stale state)
- **BUS**: Business Impact (UX harm, accessibility, language compliance)
- **OPS**: Operations (channel cleanup, resource limits)

---

## Entry Criteria

- [ ] `scripture-session:{session_id}` Broadcast channel configured with `private: true`
- [ ] `scripture-presence:{session_id}` Broadcast channel configured
- [ ] `scripture_lock_in` RPC deployed with `expected_version` validation
- [ ] RLS policies on `realtime.messages` for session channels deployed and tested
- [ ] Worker-isolated test user pairs provisioned (user + partner per Playwright worker)
- [ ] Local Supabase running (`supabase start`) or staging environment accessible
- [ ] `scripture_sessions`, `scripture_step_states` tables seeded with fixture data
- [ ] E4-R01 through E4-R06 mitigation implementations code-complete

## Exit Criteria

- [ ] All P0 tests pass (100%)
- [ ] All P1 tests pass (≥95%; any failures triaged and waivered)
- [ ] E4-R01 (lock-in concurrency), E4-R02 (anti-race), E4-R03 (409 rollback), E4-R06 (channel auth) verified passing
- [ ] No open SEC (E4-R06) issues
- [ ] No open DATA issues above score 4
- [ ] Language compliance (E4-R11) strings verified against AC text
- [ ] Both channels (scripture-session + scripture-presence) confirmed unsubscribed on session end

---

## Test Coverage Plan

> P0/P1/P2/P3 = risk-based **priority** level, **NOT** execution timing. Execution schedule is in the Execution Strategy section below.

### P0 — Critical

**Criteria:** Blocks the core Together Mode journey + risk score ≥6 + no workaround for either partner.

| Test ID | Requirement | Test Level | Risk Link | Tests | Notes |
|---------|-------------|-----------|-----------|-------|-------|
| 4.2-API-001 | Both users lock-in simultaneously — exactly one advance, second gets 409 | API | E4-R01 | 3 | Concurrent RPC calls; assert `version` increments once; assert second caller receives 409 |
| 4.2-API-002 | 409 response → full rollback: `pending_lock_in` cleared, refetch fires, toast shown | E2E | E4-R03 | 2 | Route mock for 409; assert button state restored; assert "Session updated" toast visible |
| 4.2-UNIT-001 | Broadcast handler discards stale events (version ≤ local) | Unit | E4-R02 | 2 | Feed out-of-order broadcasts; assert stale ignored; assert newer version applied |
| 4.0-API-003 | Non-session member cannot subscribe to `scripture-session:{id}` channel | API | E4-R06 | 2 | Subscribe as unlinked user; assert subscription denied by RLS |
| 4.0-E2E-001 | Together session full journey — role → lobby → both ready → countdown → step 1 reading → lock-in → advance | E2E | All | 2 | Worker-isolated pair; covers 4.1 + 4.2 happy path in one flow |

**Total P0: 11 tests**

---

### P1 — High

**Criteria:** Important features + risk score 3–5 + common workflows.

| Test ID | Requirement | Test Level | Risk Link | Tests | Notes |
|---------|-------------|-----------|-----------|-------|-------|
| 4.3-E2E-001 | Disconnected partner reconnects — canonical snapshot applied; resumes at correct step | E2E | E4-R05 | 2 | Simulate disconnect + reconnect; assert `snapshot_json` fetched; assert correct step rendered |
| 4.1-API-001 | Role selection stored on session — Reader/Responder persisted in `scripture_sessions` | API | — | 2 | POST role; GET session; assert `user1_role` |
| 4.1-E2E-001 | Ready toggle real-time sync — User A toggles Ready, User B sees update immediately | E2E | — | 2 | Worker pair; assert aria-live "Jordan is ready" fires on User B |
| 4.1-E2E-002 | "Continue solo" — session.mode updates to 'solo', broadcast channel unsubscribed | E2E | E4-R08 | 2 | Click "Continue solo"; assert mode='solo' via API; assert channel cleanup |
| 4.2-E2E-001 | Partner position indicator — partner navigates to response, indicator updates | E2E | — | 2 | Presence event injection; assert "[Name] is viewing the response" visible |
| 4.2-COMP-001 | LockIn button state machine — click→pending→undo cycle; server confirm→advance | Component | — | 3 | Mock RPC; assert button transforms through states |
| 4.2-UNIT-002 | `determineRole(baseRole, stepIndex)` — correct parity flip for steps 0–16 | Unit | E4-R09 | 2 | Boundary: steps 0, 1, 2, 15, 16 |
| 4.1-COMP-001 | Countdown timer — renders correctly from server timestamp, ticks down | Component | E4-R07 | 2 | Mount with `startedAt=now-500ms`; assert ~2.5s shown; assert tick |

**Total P1: 17 tests**

---

### P2 — Medium

**Criteria:** Secondary flows + risk score 1–2 + edge cases and accessibility.

| Test ID | Requirement | Test Level | Risk Link | Tests | Notes |
|---------|-------------|-----------|-----------|-------|-------|
| 4.3-E2E-002 | Disconnection UI — heartbeat stops >20s; "Partner reconnecting…" shown + lock-in paused | E2E | E4-R04 | 2 | Simulate stopped heartbeat; assert UI state |
| 4.3-E2E-003 | "End Session" after 30s timeout — both progress saved, session status updated, channels cleaned | E2E | — | 2 | Simulate 31s offline; click "End Session"; assert cleanup |
| 4.1-COMP-002 | Reduced-motion countdown — static number, no Framer Motion animation | Component | E4-R10 | 1 | `useReducedMotion` mock; assert no motion variant |
| 4.1-E2E-003 | Countdown aria-live — "Session starting in 3 seconds" and "Session started" announced | E2E | E4-R10 | 2 | Playwright aria-live assertion |
| 4.1-E2E-004 | Ready state aria-live — partner ready toggle triggers "Jordan is ready" announcement | E2E | — | 1 | |
| 4.2-UNIT-003 | Presence throttle — updates not more than once per view change + 10s heartbeat | Unit | — | 2 | Timer mock; assert no excess broadcasts |
| 4.2-COMP-002 | Slide-left transition reduced-motion — instant (0ms duration) | Component | — | 1 | `prefers-reduced-motion` mock |
| 4.2-UNIT-004 | Stale presence TTL — presence older than 20s hides position indicator | Unit | — | 1 | |
| 4.1-E2E-005 | Language compliance — exact no-blame strings present on screen per AC | E2E | E4-R11 | 2 | Text assertions: "Continue solo", "Your partner seems to have stepped away", "Holding your place" |
| 4.3-E2E-004 | Both channels unsubscribed at normal session end | E2E | E4-R13 | 1 | |

**Total P2: 15 tests**

---

### P3 — Low

**Criteria:** Nice-to-have, exploratory, regression depth.

| Test ID | Requirement | Test Level | Tests | Notes |
|---------|-------------|-----------|-------|-------|
| 4.2-E2E-002 | Reflection phase transition — lock-in past step 17 → `phase = 'reflection'` | E2E | 1 | |
| 4.3-E2E-005 | "Keep Waiting" — reconnecting indicator persists after selection | E2E | 1 | |
| 4.2-COMP-003 | RoleIndicator colors — #A855F7 (Reader) and #C084FC (Responder) rendered | Component | 1 | |

**Total P3: 3 tests**

---

## Execution Strategy

**Philosophy:** Run all Playwright functional tests on every PR. With worker parallelization, 40+ Playwright tests complete in 10–15 minutes. Only defer tests that are genuinely long-running or require external tooling.

| Gate | Tests | Tooling | Time |
|------|-------|---------|------|
| **Every PR** | P0 + P1 + P2 + P3 (Playwright unit, component, API, E2E) | `npx playwright test` | ~10–15 min |
| **Nightly** | Full P0–P3 suite + presence heartbeat timer tests | Playwright | <30 min |
| **On-demand** | Performance baseline for presence overhead (future) | k6 or Playwright network monitor | — |

Smoke command (P0 E2E only): `npx playwright test --grep "@p0"` — <5 min

---

## Resource Estimates

| Priority | Tests | Effort Range |
|----------|-------|-------------|
| P0 | 11 | ~20–35 hours |
| P1 | 17 | ~20–30 hours |
| P2 | 15 | ~7–13 hours |
| P3 | 3 | ~1–2 hours |
| **Total** | **46** | **~48–80 hours (~1.5–2.5 weeks)** |

Estimates include fixture setup, worker-isolated pair provisioning, and broadcast/presence mock infrastructure. First-time presence channel testing setup adds ~8–12 hours to P0 effort.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% (no exceptions)
- **P1 pass rate:** ≥95% (written waiver required for any failure)
- **P2/P3 pass rate:** ≥90% (informational)
- **SEC (E4-R06) tests:** 100% (channel authorization is non-negotiable)
- **TECH concurrency (E4-R01/R02/R03) tests:** 100% (race condition and rollback tests must pass)

### Coverage Targets

- Critical paths (Together journey, lock-in, reconnection): ≥90%
- Security scenarios (channel auth): 100%
- Accessibility (aria-live, reduced-motion): ≥80%
- Business logic (role alternation, language): ≥70%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] E4-R01 through E4-R06 mitigations verified (6 MITIGATE risks cleared)
- [ ] SEC tests (E4-R06) pass 100%
- [ ] No open TECH/DATA risks above score 4 at release

---

## Mitigation Plans

### E4-R01: Lock-In RPC Concurrency (Score: 6)

**Mitigation Strategy:**
1. Implement RPC using `UPDATE scripture_sessions SET version = version + 1, current_step_index = current_step_index + 1 WHERE id = session_id AND version = expected_version`
2. Return 409 status when `version != expected_version`
3. Both clients handle 409: rollback optimistic state, refetch session
**Owner:** Backend Dev
**Timeline:** Sprint (Epic 4) — before first E2E tests run
**Status:** Planned
**Verification:** Test ID 4.2-API-001 (concurrent lock-in; exactly one advance)

### E4-R02: Stale Broadcast Ingestion (Score: 6)

**Mitigation Strategy:**
1. Client handler: `if (incoming.version <= localVersion) return; // discard`
2. Version stored in Zustand slice as `localVersion`
3. Tested explicitly with out-of-order event injection
**Owner:** Frontend Dev
**Timeline:** Sprint (Epic 4)
**Status:** Planned
**Verification:** Test ID 4.2-UNIT-001

### E4-R03: Incomplete 409 Rollback (Score: 6)

**Mitigation Strategy:**
1. On 409 response from `scripture_lock_in`: clear `pending_lock_in` from Zustand slice
2. Dispatch refetch action to reload canonical session state
3. Show non-alarming toast: "Session updated"
**Owner:** Frontend Dev
**Timeline:** Sprint (Epic 4)
**Status:** Planned
**Verification:** Test ID 4.2-API-002

### E4-R04: Presence TTL False Positive (Score: 6)

**Mitigation Strategy:**
1. Implement two-tier presence: heartbeat miss → internal "suspected offline" state (not shown)
2. Only show "Partner reconnecting..." after 20s without heartbeat (as specified in AC)
3. Do not show indicator for <20s heartbeat gaps (backgrounded device tolerance)
**Owner:** Frontend Dev
**Timeline:** Sprint (Epic 4)
**Status:** Planned
**Verification:** Test ID 4.3-E2E-002

### E4-R05: Reconnection Snapshot Miss (Score: 6)

**Mitigation Strategy:**
1. On channel reconnection event: always call `GET /scripture_sessions/{id}` before rendering
2. Apply `snapshot_json` from response as canonical state
3. Compare `snapshot.version` to `localVersion`; overwrite if snapshot is newer
**Owner:** Frontend Dev
**Timeline:** Sprint (Epic 4)
**Status:** Planned
**Verification:** Test ID 4.3-E2E-001

### E4-R06: Broadcast Channel Authorization Gap (Score: 6)

**Mitigation Strategy:**
1. All scripture session channels must use `{ config: { private: true } }`
2. RLS policy on `realtime.messages`:
   ```sql
   CREATE POLICY "scripture_session_channel_read" ON realtime.messages
   FOR SELECT TO authenticated
   USING (
     SPLIT_PART(topic, ':', 2)::uuid IN (
       SELECT id FROM public.scripture_sessions
       WHERE user1_id = (SELECT auth.uid()) OR user2_id = (SELECT auth.uid())
     )
     AND topic LIKE 'scripture-session:%'
   );
   ```
3. Same pattern applied to `scripture-presence:*` channels
**Owner:** Backend Dev
**Timeline:** Sprint (Epic 4) — before any broadcast tests
**Status:** Planned
**Verification:** Test ID 4.0-API-003

---

## Assumptions and Dependencies

### Assumptions

1. Worker-isolated test user pairs are provisioned via existing `tests/support/auth-setup.ts` pattern
2. `scripture_lock_in` RPC signature matches `lock_in(session_id, step_index, user_id, expected_version)`
3. Broadcast channel name format is `scripture-session:{session_id}` and `scripture-presence:{session_id}`
4. Local Supabase Realtime is available when `supabase start` is running
5. `test-design-architecture.md` (system-level) documents the same 5-table schema; no schema changes expected

### Dependencies

1. `scripture_lock_in` RPC with `expected_version` — required before P0 API tests can run
2. `realtime.messages` RLS policies for private channels — required before E4-R06 test runs
3. `scripture_sessions` + `scripture_step_states` tables with version column — required for all concurrency tests
4. Worker-isolated test pair provisioning — required for all E2E together-mode tests

### Risks to Plan

- **Risk:** Supabase Realtime not supported in local `supabase start` environment
  - **Impact:** E2E broadcast/presence tests cannot run locally; CI-only
  - **Contingency:** Mock Supabase Realtime channels in E2E tests; validate real channel auth in staging

- **Risk:** Playwright worker isolation fails when two users share same Realtime connection
  - **Impact:** Together-mode E2E flaky (users bleed into each other's sessions)
  - **Contingency:** Use separate Playwright workers per user; each worker loads dedicated `.auth/worker-N.json`

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|-----------------|
| **Epic 1 Solo Reading** | Together mode reuses `ScriptureReadingService` and `scriptureReadingSlice` | All existing `tests/e2e/scripture/scripture-solo-reading.spec.ts` must pass |
| **Epic 2 Reflection + Daily Prayer Report** | Together mode exits to reflection phase (same flow) | All existing `tests/e2e/scripture/scripture-reflection-*.spec.ts` must pass |
| **scripture-session Broadcast Channel** | New subscription added; must not interfere with existing mood/interaction channels | Run full `npm test:unit` and `npm test:e2e` regression before release |
| **scripture-rls-security.spec.ts** | RLS changes for realtime.messages may affect existing session security tests | Run `tests/e2e/scripture/scripture-rls-security.spec.ts` after RLS policy deployment |
| **IndexedDB schema (v5)** | `scripture_sessions` store added to cache layer | Run `tests/unit/services/scriptureReadingService.*.test.ts` regression |

---

## Follow-on Workflows

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework (P×I scoring, gate decisions)
- `probability-impact.md` — Risk scoring methodology (1–3 scale definitions)
- `test-levels-framework.md` — Test level selection (unit/integration/E2E decision matrix)
- `test-priorities-matrix.md` — P0–P3 prioritization criteria

### Related Documents

- Epic: `_bmad-output/planning-artifacts/epics/epic-4-together-mode-synchronized-reading.md`
- Architecture Decisions: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md`
- System-Level Test Design (Architecture): `_bmad-output/test-design-architecture.md`
- System-Level Test Design (QA): `_bmad-output/test-design-qa.md`
- Prior Epic Test Design (Epic 2): `_bmad-output/test-design-epic-2.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (Step-File Architecture)
