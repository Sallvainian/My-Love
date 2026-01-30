# Sprint Change Proposal: Remove Offline-First Architecture

**Date:** 2026-01-28
**Author:** Salvain
**Status:** Approved
**Scope Classification:** Minor

---

## Section 1: Issue Summary

### Problem Statement

During Epic 1 test design, a Party Mode risk assessment revealed that the offline-first architecture adds significant complexity without real user value. The app requires internet connectivity to use its core feature (Scripture Reading Together mode requires a phone/video call with partner). If there's no internet, users can't call their partner, so the app wouldn't be practically usable even if it worked functionally offline.

### Discovery Context

- **Trigger:** Party Mode risk assessment for Epic 1 (R-E1-001: Offline reflections lost during sync, R-E1-002: IndexedDB migration fails)
- **When:** 2026-01-27 during test design workflow
- **Who:** Salvain (product owner) during multi-agent discussion with TEA, Architect, Dev, PM agents

### Evidence

- 2 high-priority risks (score >=6) were identified for offline sync
- Mitigation strategies proposed were increasingly complex (write-ahead logging, migration checkpoints, sync queue persistence, conflict resolution)
- Product insight: offline capability provides no practical value given the phone-call requirement

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact | Details |
|------|--------|---------|
| **Epic 1** | Scope REDUCED | Story 1.9 simplified from 3-5 days to 1 day; Story 1.2 simplified |
| **Epic 2+** | Beneficial | No offline-to-online conversion complexity for Together mode |

### Story Impact

| Story | Change |
|-------|--------|
| **Story 1.2: Data Foundation** | Remove sync queue stores, remove "synced" index pattern |
| **Story 1.9** | Rename from "Offline Sync Engine" to "Network Detection & Optimistic UI"; reduce scope from 3-5 days to 1 day |
| **All stories** | Remove references to "synced: false" tracking pattern |

### Artifact Conflicts

| Artifact | Sections Needing Update |
|----------|------------------------|
| **prd.md** | MVP Scope Network Requirements, Executive Summary |
| **architecture.md** | Brownfield Constraints (3 locations) |
| **ux-design-specification.md** | Already updated - no changes needed |
| **epics.md** | File deleted - needs regeneration |

### Technical Impact

| Before | After |
|--------|-------|
| IndexedDB as source of truth | IndexedDB as cache only |
| Sync queue with conflict resolution | No sync queue needed |
| Complex migration with rollback | Simple migration (corruption = clear & refetch) |
| 2 high-priority risks (score >=6) | 0 high-priority risks |

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

Fix inconsistencies in existing documents and regenerate epics with updated scope.

### Rationale

1. **No code written yet** - This is a pre-implementation architectural decision
2. **Documents partially updated** - Some sections already reflect the change
3. **Scope reduction** - This simplifies the project, doesn't expand it
4. **Risk elimination** - 2 high-priority risks completely eliminated

### Effort Estimate

| Task | Effort |
|------|--------|
| PRD updates | 5 minutes |
| Architecture updates | 10 minutes |
| Epics regeneration | 30-60 minutes (via create-epics-and-stories workflow) |

### Risk Assessment

- **Risk Level:** Low
- **Reason:** Pre-implementation decision, reduces complexity, no rollback needed

---

## Section 4: Detailed Change Proposals

### PRD Changes

#### Change 1: MVP Scope Network Requirements

**Location:** prd.md - Project Scope / MVP Section

**OLD:**
```markdown
**Network Requirements:**
- **Solo Mode:** Fully offline-capable with IndexedDB; sync when online
```

**NEW:**
```markdown
**Network Requirements:**
- **Solo Mode:** Online-required with optimistic UI; IndexedDB provides read caching for performance
```

**Rationale:** Aligns with architectural decision - server is source of truth, IndexedDB is cache-only

---

#### Change 2: Executive Summary MVP Scope

**Location:** prd.md - Executive Summary

**OLD:**
```markdown
**MVP scope:** Solo mode (offline-capable, resumable) + Together mode...
```

**NEW:**
```markdown
**MVP scope:** Solo mode (resumable with optimistic UI) + Together mode...
```

**Rationale:** Removes misleading "offline-capable" claim

---

### Architecture Changes

#### Change 3: Technical Constraints - Brownfield Constraints

**Location:** architecture.md - Technical Constraints & Dependencies

**OLD:**
```markdown
- IndexedDB offline-first with sync queue
```

**NEW:**
```markdown
- IndexedDB caching with optimistic UI (server is source of truth)
```

**Rationale:** Removes sync queue reference which was eliminated

---

#### Change 4: Starter Template - Architectural Patterns

**Location:** architecture.md - Starter Template Evaluation / Architectural Patterns to Follow

**OLD:**
```markdown
| **IndexedDB** | `offlineMoodService` | `offlineScriptureService` |
```

**NEW:**
```markdown
| **IndexedDB** | `offlineMoodService` | `scriptureReadingService` (cache-only) |
```

**Rationale:** Reflects that scripture service uses cache-only pattern, not offline-first

---

#### Change 5: Cross-Cutting Concerns

**Location:** architecture.md - Project Context Analysis / Cross-Cutting Concerns

**OLD:**
```markdown
| **Caching & Optimistic UI** | Solo mode, reflections | IndexedDB read cache + write-through to server |
```

This row is already correct. No change needed.

---

### Epics Regeneration

**Location:** _bmad-output/planning-artifacts/epics.md

**Status:** File deleted - requires regeneration

**Required Updates When Regenerating:**
1. Story 1.2: Remove sync queue and conflict resolution from scope
2. Story 1.9: Rename from "Offline Sync Engine" to "Network Detection & Optimistic UI"
3. Story 1.9: Reduce effort estimate from 3-5 days to 1 day
4. All stories: Remove references to "synced: false" tracking pattern
5. All stories: Remove references to offline-first patterns

**Workflow to Use:** `/bmad_bmm_create-epics-and-stories`

---

## Section 5: Implementation Handoff

### Scope Classification: Minor

This change can be implemented directly without escalation.

### Handoff Recipients

| Role | Responsibility |
|------|----------------|
| **Developer (Salvain)** | Apply PRD and Architecture edits |
| **Developer (Salvain)** | Run create-epics-and-stories workflow to regenerate epics |

### Action Items

- [x] Apply PRD edit 1: MVP Scope Network Requirements
- [x] Apply PRD edit 2: Executive Summary
- [x] Apply Architecture edit 3: Technical Constraints
- [x] Apply Architecture edit 4: Starter Template Patterns
- [ ] Regenerate epics.md with updated Story 1.2 and 1.9 scope

### Success Criteria

1. All documents consistently reference "online-required with optimistic UI"
2. No references to "offline-first", "sync queue", or "conflict resolution" remain
3. Story 1.9 is renamed and scope reduced
4. Regenerated epics pass validation

---

## Approval

**Approved by:** Salvain
**Date:** 2026-01-28

---

## Post-MVP Enhancement: Draft-Queue Pattern

If users request offline Solo capability, consider implementing a draft-queue pattern:

- Save in-progress Solo entries to IndexedDB as drafts with status: `draft | queued | syncing | synced | failed`
- Use `clientRequestId` for server-side idempotency (dedupe on retry)
- Only allow creating NEW entries offline (no editing synced entries = no conflicts)
- UX: Status pills ("Saved locally", "Syncing...", "Failed — retry")

**Estimated effort:** ~2-3 days
**Trigger:** User feedback requesting offline Solo mode

---

## Reference Documents

- **Decision Source:** `_bmad-output/test-design-epic-1.md`
- **PRD:** `_bmad-output/planning-artifacts/prd.md`
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md`
- **UX Design:** `_bmad-output/planning-artifacts/ux-design-specification.md`

---

**Generated by:** BMad Correct-Course Workflow
**Version:** BMad v6
