# Sprint Change Proposal

**Date:** 2025-11-16
**Author:** Frank
**Proposal ID:** SCP-001
**Status:** DRAFT

---

## 1. Issue Summary

### Problem Statement

Pre-implementation database analysis via Supabase MCP revealed that **stories in Epics 2, 3, 4, and 6 depend on database tables that don't exist**. The current epic/story breakdown assumes these schemas are pre-configured, but no stories cover their creation, creating blocking dependencies.

### Context

- **Discovery Method:** Supabase MCP server query during Epic 1 tech spec generation
- **Timing:** Discovered before any implementation began (planning phase)
- **Evidence:** Supabase list_tables confirmed existing schema:
  - ✅ `users` (4 rows) - User profiles with partner_id
  - ✅ `moods` (44 rows) - Mood tracking
  - ✅ `interactions` (29 rows) - Poke/kiss interactions
  - ✅ `partner_requests` (1 row) - Partner pairing
  - ❌ `love_notes` - **MISSING** (Epic 2 blocker)
  - ❌ `push_tokens` - **MISSING** (Epic 3 blocker)
  - ❌ `daily_love_messages` - **MISSING** (Epic 3/4 blocker)
  - ❌ `relationships` - **MISSING** (Epic 4 blocker)
  - ❌ `photos` + Storage bucket - **MISSING** (Epic 6 blocker)

### Business Impact

Without this change, developers implementing stories like "2-2 Send Love Note" will immediately hit blockers when the `love_notes` table doesn't exist. This would cause:

- Wasted development cycles diagnosing "table not found" errors
- Ad-hoc schema creation without proper design review
- Inconsistent RLS policies and security gaps
- Sprint delays as teams scramble to create infrastructure

---

## 2. Impact Analysis

### Epic Impact

| Epic       | Impact Level | Reason                                                   |
| ---------- | ------------ | -------------------------------------------------------- |
| **Epic 1** | NONE         | Uses existing `users` table, foundation complete         |
| **Epic 2** | HIGH         | All messaging stories blocked without `love_notes` table |
| **Epic 3** | HIGH         | Push notification stories blocked without `push_tokens`  |
| **Epic 4** | MEDIUM       | Days counter needs `relationships.start_date`            |
| **Epic 5** | NONE         | `moods` table already exists                             |
| **Epic 6** | HIGH         | Photo features blocked without `photos` table + Storage  |
| **Epic 7** | NONE         | Uses existing tables                                     |

### Story Impact

**Current Stories Blocked (cannot proceed without schema):**

- 2-1: Love Notes Chat UI Foundation
- 2-2: Send Love Note with Optimistic Updates
- 2-3: Real-Time Message Reception
- 2-4: Message History & Scroll Performance
- 3-2: Push Token Registration & Storage
- 3-3: Love Note Push Notifications
- 3-4: Daily Love Message Notifications
- 4-2: Days Together Counter Display
- 6-1: Photo Selection & Compression
- 6-2: Photo Upload with Progress Indicator
- 6-3: Photo Gallery Grid View
- 6-4: Full-Screen Photo Viewer with Gestures

**New Stories Required:**

- 2.0: Love Notes Database Schema Setup
- 3.0: Push Notification & Daily Messages Schema Setup
- 4.0: Relationships Table for Days Together Counter
- 6.0: Photo Storage Schema & Buckets Setup

### Artifact Conflicts

| Artifact               | Conflict Level  | Resolution                                         |
| ---------------------- | --------------- | -------------------------------------------------- |
| **PRD**                | NONE            | Requirements unchanged, just adding infrastructure |
| **Architecture**       | NONE            | Schemas align with documented patterns             |
| **UX Design**          | NONE            | No user-facing impact                              |
| **epics.md**           | UPDATE REQUIRED | Add 4 new schema stories                           |
| **sprint-status.yaml** | UPDATE REQUIRED | Add 4 new story tracking entries                   |
| **Tech Spec (Epic 1)** | NONE            | Already generated, no impact                       |

### Technical Impact

- No code changes required to existing implementation
- Database migrations are additive (non-destructive)
- RLS policies enhance security posture
- Proper indexing established from start
- Supabase Realtime enabled where needed

---

## 3. Recommended Approach

### Selected Path: **Option 1 - Direct Adjustment**

**Add schema setup stories as first story (X.0) in affected epics without modifying existing story structure.**

### Rationale

1. **Minimal Effort:** 4 new stories, each 1-2 hours implementation time
2. **Low Risk:** Simple table creation via Supabase migrations
3. **No Timeline Impact:** Adds ~8 hours total, distributed across epics
4. **Proper Dependency Management:** Schemas established before feature work
5. **Zero Disruption:** Existing story numbers unchanged, just prepended with 0-stories
6. **Security by Design:** RLS policies designed upfront, not retrofitted

### Effort Estimate

| Story                             | Estimated Effort | Risk Level |
| --------------------------------- | ---------------- | ---------- |
| 2.0: Love Notes Schema            | 2 hours          | Low        |
| 3.0: Push & Daily Messages Schema | 2 hours          | Low        |
| 4.0: Relationships Schema         | 1 hour           | Low        |
| 6.0: Photos Schema & Storage      | 3 hours          | Low        |
| **Total**                         | **8 hours**      | **Low**    |

### Alternative Approaches Considered

**Option 2: Rollback** - Not applicable (no implementation started)

**Option 3: MVP Scope Reduction** - Not needed (schemas are foundational, not scope creep)

---

## 4. Detailed Change Proposals

### Story Changes

#### Story 2.0: Love Notes Database Schema Setup (NEW)

**Epic:** 2 - Love Notes Real-Time Messaging

**User Story:**

> As a developer, I want the love_notes table and RLS policies created in Supabase, so that messaging features have the required backend storage.

**Key Schema Elements:**

- `love_notes` table with from_user_id, to_user_id, content, timestamps
- RLS: Users see only their sent/received messages
- Index on (to_user_id, created_at DESC)
- Supabase Realtime enabled

**Prerequisite:** None (first in Epic 2)

---

#### Story 3.0: Push Notification & Daily Messages Schema Setup (NEW)

**Epic:** 3 - Push Notifications & Daily Engagement

**User Story:**

> As a developer, I want push_tokens and daily_love_messages tables created, so that notification features have required backend infrastructure.

**Key Schema Elements:**

- `push_tokens` with user_id, token, platform
- `daily_love_messages` with 365 rotation entries
- RLS: Users manage only their own tokens
- Unique constraint on (user_id, platform)

**Prerequisite:** None (first in Epic 3)

---

#### Story 4.0: Relationships Table for Days Together Counter (NEW)

**Epic:** 4 - Dashboard & Daily Connection

**User Story:**

> As a developer, I want the relationships table created with start_date tracking, so that the days together counter has the required data source.

**Key Schema Elements:**

- `relationships` with user_id_1, user_id_2, start_date
- Check constraint: user_id_1 < user_id_2 (no duplicates)
- RLS: Users view only their relationships
- Migration seeds existing partner pairs

**Prerequisite:** None (first in Epic 4)

---

#### Story 6.0: Photo Storage Schema & Buckets Setup (NEW)

**Epic:** 6 - Photo Gallery & Memories

**User Story:**

> As a developer, I want Supabase Storage bucket and photos metadata table created, so that photo features have required storage infrastructure.

**Key Schema Elements:**

- Supabase Storage "photos" bucket (private)
- `photos` metadata table with user_id, storage_path, file_size
- RLS: Users see own + partner photos
- Storage policy: Upload to own path only
- Index on (user_id, created_at DESC)

**Prerequisite:** None (first in Epic 6)

---

### Artifact Updates Required

#### 1. epics.md

**Change Type:** INSERT new stories

**Location:** After each Epic overview section, before Story X.1

**Format:** Follow existing story template (As a/I want/So that + BDD acceptance criteria)

---

#### 2. sprint-status.yaml

**Change Type:** ADD new story tracking entries

**Specific Edits:**

```yaml
# Epic 2: Love Notes Real-Time Messaging
epic-2: backlog
2-0-love-notes-database-schema-setup: backlog # NEW
2-1-love-notes-chat-ui-foundation: backlog
# ...

# Epic 3: Push Notifications & Daily Engagement
epic-3: backlog
3-0-push-notification-daily-messages-schema-setup: backlog # NEW
3-1-notification-permission-flow: backlog
# ...

# Epic 4: Dashboard & Daily Connection
epic-4: backlog
4-0-relationships-table-days-counter: backlog # NEW
4-1-feature-hub-home-screen: backlog
# ...

# Epic 6: Photo Gallery & Memories
epic-6: backlog
6-0-photo-storage-schema-buckets-setup: backlog # NEW
6-1-photo-selection-compression: backlog
# ...
```

---

## 5. Implementation Handoff

### Change Scope Classification: **MINOR**

This change can be implemented directly without Product Owner or Architect escalation.

### Handoff Recipients

| Role                   | Responsibility                                             |
| ---------------------- | ---------------------------------------------------------- |
| **Scrum Master Agent** | Update epics.md with new schema stories                    |
| **Scrum Master Agent** | Update sprint-status.yaml with new entries                 |
| **Dev Agent**          | Execute tech-spec workflow for Epics 2, 3, 4, 6 when ready |
| **Dev Agent**          | Implement schema stories using Supabase MCP                |

### Implementation Sequence

1. ✅ Update `epics.md` - Add 4 new schema stories (Stories 2.0, 3.0, 4.0, 6.0)
2. ✅ Update `sprint-status.yaml` - Add story tracking entries
3. Continue with Epic 1 implementation (no changes needed)
4. When Epic 2 starts: Implement Story 2.0 first
5. Repeat pattern for Epics 3, 4, and 6

### Success Criteria

- [ ] 4 new schema stories added to epics.md with full acceptance criteria
- [ ] 4 new story entries in sprint-status.yaml
- [ ] Each schema story marked as prerequisite-free (first in epic)
- [ ] Schema stories include RLS policies and proper indexing
- [ ] No changes to existing story numbers or content

---

## 6. Approval

**Recommended Action:** APPROVE this Sprint Change Proposal

**Risk Level:** LOW
**Timeline Impact:** MINIMAL (+8 hours distributed across 4 epics)
**MVP Impact:** NONE (foundation work, not scope change)
**Technical Debt Prevention:** HIGH (proper schema design upfront)

---

_Generated by BMAD Correct-Course Workflow_
_Date: 2025-11-16_
_Status: Ready for User Approval_
