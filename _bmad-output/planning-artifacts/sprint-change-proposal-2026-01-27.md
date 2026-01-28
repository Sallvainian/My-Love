# Sprint Change Proposal

**Date:** 2026-01-27
**Author:** Salvain (via Correct Course workflow)
**Status:** Pending Approval
**Change Scope:** Minor

---

## Section 1: Issue Summary

### Problem Statement

Story 1-2 (Data Foundation) creates the 5 Scripture Reading Supabase tables with RLS policies, but does not include a test data seeding mechanism. QA requires seeding capability (B-003) to populate test databases with scripture sessions, reflections, and related records for integration testing.

### Discovery Context

Identified during Sprint 0 planning review of QA dependencies. The QA infrastructure setup requires test data factories to work against seeded database records.

### Evidence

- QA dependency matrix lists B-003 as Sprint 0 Week 2 blocker
- Without seeding, Playwright tests cannot verify data flows
- Test environments (local Supabase, CI shards, staging) all need seed capability

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Status | Impact |
|------|--------|--------|
| **Epic 1: Scripture Reading Foundation & Solo Mode** | in-progress | **Minor** — Add acceptance criteria to Story 1-2 |
| Epic 2: Daily Prayer Report | backlog | None |
| Epic 3: Together Mode Lobby & Synchronization | backlog | None |
| Epic 4: Together Mode Reading Experience | backlog | None |
| Epic 5: Accessibility & Polish | backlog | None |

### Story Impact

- **Story 1-2 (Data Foundation):** Add test data seeding acceptance criteria

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| PRD | None | Test infrastructure not in PRD scope |
| Architecture | None | Aligns with existing RPC patterns |
| UX Design | None | No UI impact |

### Technical Impact

- **Code:** Add `scripture_seed_test_data` RPC function (~50-100 lines)
- **Infrastructure:** None
- **Deployment:** RPC included in existing migration

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

Add test data seeding capability as new acceptance criteria to Story 1-2 (Data Foundation).

### Implementation

Create a Supabase RPC function `scripture_seed_test_data` that:
- Accepts options for quantity and data variations
- Creates scripture_sessions, scripture_reflections, scripture_step_states, scripture_bookmarks, scripture_messages records
- Only callable in non-production environments
- Returns summary of seeded records

### Rationale

| Factor | Assessment |
|--------|------------|
| **Effort** | Low — ~50-100 lines, single RPC function |
| **Risk** | Low — Test-only, no production impact |
| **Timeline** | None — Ships with Story 1-2 |
| **Cohesion** | High — Seeding belongs with table creation |
| **Pattern alignment** | Follows `scripture_` RPC naming convention |

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| Separate story (1-2a) | Overhead for small capability; fragments related work |
| Service method only | RPC is more flexible for CI/test environments |
| Defer to later | Blocks QA; test infrastructure is Sprint 0 priority |

---

## Section 4: Detailed Change Proposals

### Change 1: Story 1-2 Acceptance Criteria

**File:** `_bmad-output/planning-artifacts/epics.md`
**Story:** 1-2 Data Foundation
**Section:** Acceptance Criteria (after line 391)

**Addition:**
```markdown
**Given** a test environment needs scripture data
**When** the `scripture_seed_test_data` RPC is called with options
**Then** it creates test records across all 5 scripture tables:
- `scripture_sessions` (configurable count, modes, statuses)
- `scripture_step_states` (matching sessions with varied lock-in states)
- `scripture_reflections` (ratings 1-5, optional notes, help flags)
- `scripture_bookmarks` (random verses bookmarked)
- `scripture_messages` (optional partner messages)
**And** returns a summary of created record counts
**And** the RPC is restricted to non-production environments
```

**Implementation Notes addition:**
```markdown
- Create `scripture_seed_test_data` RPC for test data generation
```

---

### Change 2: Architecture RPC List

**File:** `_bmad-output/planning-artifacts/architecture.md`
**Section:** Supabase RPC Naming (line 427)

**Addition:**
```markdown
  - `scripture_seed_test_data(session_count?, include_reflections?, include_messages?)` — test environments only
```

---

## Section 5: Implementation Handoff

### Change Scope Classification: Minor

This change can be implemented directly by the development team as part of Story 1-2 execution. No escalation required.

### Handoff Assignments

| Role | Responsibility |
|------|----------------|
| **SM (this workflow)** | Update `epics.md` with new acceptance criteria |
| **SM (this workflow)** | Update `architecture.md` RPC list |
| **Dev** | Implement RPC when executing Story 1-2 |
| **QA** | Use seeding in test factories and CI pipeline |

### Action Plan

| Step | Action | Owner | Status |
|------|--------|-------|--------|
| 1 | Update Story 1-2 acceptance criteria in `epics.md` | SM | Pending |
| 2 | Add RPC to `architecture.md` RPC list | SM | Pending |
| 3 | Implement `scripture_seed_test_data` RPC | Dev | Blocked on Story 1-2 start |
| 4 | Document seeding usage for QA | Dev | Blocked on Step 3 |
| 5 | Integrate seed call into CI test workflow | QA | Blocked on Step 3 |

### Success Criteria

- [ ] Story 1-2 acceptance criteria includes test data seeding
- [ ] `scripture_seed_test_data` RPC documented in architecture
- [ ] QA can call seeding function in test environments

---

## Approval

**Approval Status:** Approved ✓

- [x] User approval received (2026-01-27)
- [x] Edits applied to `epics.md`
- [x] Edits applied to `architecture.md`
- [x] sprint-status.yaml reviewed (no changes needed)

---

*Generated by Correct Course workflow on 2026-01-27*

---
---

# Sprint Change Proposal #2: Offline-First → Online-Required with Optimistic UI

**Date:** 2026-01-27
**Triggered By:** Test Design Analysis for Epic 1
**Status:** APPROVED FOR IMPLEMENTATION
**Change Scope:** Major (Architecture Decision Change)

---

## Executive Summary

During test design for Epic 1, analysis revealed that the "offline-first" architecture for Solo mode adds significant complexity (2 high-priority risks, complex sync queue, conflict resolution) without proportional user value. Users doing Scripture Reading likely need internet connectivity anyway for partner communication features.

**Decision:** Change from "offline-first" (IndexedDB as source of truth) to "online-required with optimistic UI" (server as source of truth, IndexedDB as read cache).

---

## Impact Summary

### Risk Reduction

| Risk | Before | After |
|------|--------|-------|
| R-E1-001 (Offline sync data loss) | Score 6 (High) | **ELIMINATED** |
| R-E1-002 (IndexedDB migration) | Score 6 (High) | Score 2 (Low) |
| High-priority risks | 2 | 0 |

### Scope Reduction

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| P0 tests | 18 | 14 | -4 |
| P1 tests | 22 | 21 | -1 |
| Total tests | 55 | 50 | -5 |
| Effort | ~1.5-2 weeks | ~1-1.5 weeks | ~20% reduction |

### Story Changes

| Story | Before | After |
|-------|--------|-------|
| 1.9 | "Offline Sync Engine" | "Network Detection & Optimistic UI" |

---

## Artifact Updates Required

### Summary

| Document | Edit Count |
|----------|------------|
| PRD (`prd.md`) | 5 |
| Architecture (`architecture.md`) | 9 |
| UX Design (`ux-design-specification.md`) | 7 |
| Epics (`epics.md`) | 13 |
| **Total** | **34** |

---

### 1. PRD Edits

#### 1.1: FR13
- **FROM:** "User in Solo mode can use the feature fully offline (with sync when online)"
- **TO:** "User in Solo mode can use the feature with optimistic UI (changes appear instant, sync in background; requires eventual connectivity)"

#### 1.2: Offline Behavior Section
- **FROM:** "Full offline support (IndexedDB first), Sync to Supabase when online, Resume works offline"
- **TO:** "Optimistic UI with IndexedDB caching (server is source of truth), Changes appear instantly, Resume requires connectivity, Graceful degradation with offline indicator"

#### 1.3: Technical Success
- **FROM:** "Offline solo mode | Full functionality"
- **TO:** "Offline resilience | Cached data viewable; writes require connectivity"

#### 1.4: NFR-R4
- **FROM:** "Offline solo data integrity — 100%"
- **TO:** "Cache integrity — 100% (clear and refetch on corruption)"

#### 1.5: Glossary
- **FROM:** "Offline-first" definition
- **TO:** "Optimistic UI" definition

---

### 2. Architecture Edits

#### 2.1: Decision 4 (Major Rewrite)
- **FROM:** "Offline Architecture" with sync queue, `synced: false` pattern
- **TO:** "Caching Architecture" with read cache, write-through to server

#### 2.2: Cross-Cutting Concerns
- **FROM:** "Offline persistence | IndexedDB service + sync queue"
- **TO:** "Caching & Optimistic UI | IndexedDB read cache + write-through"

#### 2.3: Data Boundaries
- **FROM:** Reflections/Bookmarks source of truth = IndexedDB
- **TO:** Reflections/Bookmarks source of truth = Supabase (server)

#### 2.4: Requirements Overview
- **FROM:** "Offline-first storage"
- **TO:** "Optimistic UI with caching"

#### 2.5: NFR Coverage
- **FROM:** "Version-based sync"
- **TO:** "Server-authoritative state, cache recovery"

#### 2.6: dbSchema Stores
- Remove `synced` index from scripture stores (cache-only)
- Remove `scriptureStepStates` store (server-only)

#### 2.7: Process Patterns
- **FROM:** "Offline Sync Pattern" with sync queue
- **TO:** "Cache & Optimistic UI Pattern"

#### 2.8: Existing Files Modified
- **FROM:** SyncService gets `syncScriptureReadingData()` method
- **TO:** SyncService — no changes needed for scripture

#### 2.9: Services to Update
- Remove sw-db.ts requirement for scripture

---

### 3. UX Design Edits

#### 3.1: YAML Constraints
- **FROM:** "IndexedDB offline-first (solo mode)"
- **TO:** "IndexedDB caching with optimistic UI"

#### 3.2: Platform Strategy
- **FROM:** "Offline Support | Full for Solo mode"
- **TO:** "Offline Resilience | Cached data viewable; writes require connectivity"

#### 3.3: Technical Integration
- **FROM:** "IndexedDB for offline-first data persistence"
- **TO:** "IndexedDB for read caching and optimistic UI"

#### 3.4: Key Design Challenges
- **FROM:** "Offline-First Reliability"
- **TO:** "Optimistic UI Reliability"

#### 3.5: Experience Principles
- **FROM:** "Offline save, background sync"
- **TO:** "Optimistic UI, cached data available offline"

#### 3.6: Solo Mode Flow Description
- **FROM:** "offline support"
- **TO:** "optimistic UI"

#### 3.7: Mermaid Diagram
- **FROM:** "Save & Exit to IndexedDB"
- **TO:** "Save to Server & Cache Locally"

---

### 4. Epics Edits

#### 4.1-4.3: NFR References
- FR13, NFR-R4, NFR-I3 updates to match PRD

#### 4.4-4.6: Story Technical Notes
- Remove `synced: false` pattern references
- Update IndexedDB store definitions

#### 4.7: Story 1.9 Complete Rewrite
**FROM:** "Offline Sync Engine"
- Sync queue processing
- Conflict resolution (last-write-wins)
- Multi-device sync handling
- Quota exceeded handling

**TO:** "Network Detection & Optimistic UI"
- Network status detection
- Optimistic UI for writes
- Retry logic (exponential backoff)
- Offline indicator
- Cache refresh on reconnect

#### 4.8-4.11: Other Story Updates
- Stats from server (cached locally)
- Remove sync references
- Simplify partner offline handling
- Update Epic 1 summary

---

## Approval

**Change Approved By:** Salvain
**Date:** 2026-01-27
**Review Mode:** Incremental with batch approval

### Approval Log

| Edit # | Section | Status |
|--------|---------|--------|
| 1-5 | PRD | ✓ Approved |
| 6-14 | Architecture | ✓ Approved |
| 15-21 | UX Design | ✓ Approved |
| 22-34 | Epics | ✓ Batch Approved |

---

## Next Steps

1. Apply all 34 edits to source documents
2. Update sprint-status.yaml if needed
3. Continue with Epic 1 implementation using new architecture

---

*Generated by Correct Course workflow on 2026-01-27*
