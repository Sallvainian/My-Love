# Core Architectural Decisions

## Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Data Architecture — Normalized 5 tables + snapshot_json
2. Real-Time Sync — Hybrid (server-authoritative + client pending)
3. State Machine — Phase enum + local view state + presence channel
4. Caching Architecture — IndexedDB as read cache + optimistic UI pattern

**Important Decisions (Shape Architecture):**
5. Component Architecture — Feature-scoped subfolders + centralized motion
6. RLS Policy Pattern — Session-based access

**Deferred Decisions (Post-MVP):**
- Analytics/monitoring instrumentation
- Performance optimization (lazy loading, code splitting)
- Draft-queue pattern for Solo offline writes (if user demand validated)

## Decision 1: Data Architecture

**Choice:** Normalized 5 Tables + Derived Snapshot

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `scripture_sessions` | Session metadata + derived snapshot | `id`, `mode`, `user1_id`, `user2_id`, `current_phase`, `current_step_index`, `status`, `version`, `snapshot_json`, `started_at`, `completed_at` |
| `scripture_step_states` | Per-step lock-in state | `id`, `session_id`, `step_index`, `user1_locked_at`, `user2_locked_at`, `advanced_at` |
| `scripture_reflections` | Per-step user reflections | `id`, `session_id`, `step_index`, `user_id`, `rating`, `notes`, `is_shared`, `created_at` |
| `scripture_bookmarks` | Per-step bookmarks | `id`, `session_id`, `step_index`, `user_id`, `share_with_partner`, `created_at` |
| `scripture_messages` | Daily Prayer Report messages | `id`, `session_id`, `sender_id`, `message`, `created_at` |

**Rationale:**
- RLS works at row level (not nested JSONB)
- Server-authoritative writes with row-level constraints
- Stats/progress queries are straightforward SQL
- `snapshot_json` provides fast UI paint without sacrificing normalization

## Decision 2: Real-Time Sync Architecture

**Choice:** Hybrid — Server-Authoritative Transitions + Client Pending State

**Server Responsibilities:**
- All state mutations (lock-in, phase advance, role assignment)
- Version incrementing (`scripture_sessions.version`)
- Idempotent writes with `expected_version` validation
- Broadcast state updates to both clients

**Client Responsibilities:**
- Optimistic `pending_lock_in` state (local only)
- Render canonical state from broadcasts
- Rollback on version mismatch (409)

**Concurrency Control:**
```typescript
// RPC signature
lock_in(session_id, step_index, user_id, expected_version) → {
  validate membership (RLS)
  validate session.current_phase and step_index
  idempotent upsert lock-in
  if both_locked → advance phase/step, bump version
  update snapshot_json
  broadcast { session_id, version, snapshot_json }
}
```

**Anti-Race Rules:**
- `version` increments on every canonical mutation
- Clients ignore broadcasts where `version <= localVersion`
- Stale mutations rejected with 409 semantics

## Decision 3: State Machine Design

**Choice:** Phase Enum + Local View State + Ephemeral Presence

**Server-Authoritative (DB + Broadcast):**
```typescript
type SessionPhase = 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
step_index: number; // 0-16
```

**Client-Local (Not Synced):**
```typescript
type ViewState = 'verse' | 'response';
```

**Ephemeral Presence (Broadcast Channel):**
```typescript
// Channel: scripture-presence:{session_id}
// Throttled: on view change + heartbeat every ~10s
type PresencePayload = {
  user_id: string;
  step_index: number;
  view: 'verse' | 'response';
  ts: number;
};
// TTL: ~20s (drop stale presence)
```

**Phase Transitions:**
```
TOGETHER: lobby → countdown → reading (×17) → reflection → report → complete
SOLO:     reading (×17) → reflection → report → complete
```

## Decision 4: Caching Architecture

**Choice:** IndexedDB as Read Cache + Optimistic UI Pattern

**Rationale:** Server is source of truth. IndexedDB provides fast reads and graceful offline viewing. No complex sync queue or conflict resolution needed.

**New Components:**
| Component | Purpose |
|-----------|---------|
| `src/services/dbSchema.ts` | Centralized DB version + upgrade logic |
| `ScriptureReadingService` | IndexedDB cache CRUD (read-heavy, write-through to server) |

**IndexedDB Stores (Cache-Only):**
```typescript
'scripture_sessions': { keyPath: 'id', indexes: ['user_id'] }
'scripture_reflections': { keyPath: 'id', indexes: ['session_id'] }
'scripture_bookmarks': { keyPath: 'id', indexes: ['session_id'] }
'scripture_messages': { keyPath: 'id', indexes: ['session_id'] }
// Note: No 'synced' index needed - server is source of truth
```

**Cache Strategy:**
- **Reads:** Check IndexedDB first → return cached data → fetch fresh from server → update cache
- **Writes:** POST to server → on success, update IndexedDB cache → on failure, show retry UI
- **Corruption Recovery:** On IndexedDB error, clear cache and refetch from server

**Tech Debt Fix:** (unchanged)
- Centralize IndexedDB version management (single source of truth)
- All services reference shared version constant
- Upgrade callbacks handle all stores in one place
- Eliminates existing `VersionError` flakiness

## Decision 5: Component Architecture

**Choice:** Feature-Scoped Subfolders + Centralized Motion Config

**Directory Structure:**
```
src/components/scripture-reading/
├── session/
│   ├── Countdown.tsx
│   ├── LockInButton.tsx
│   └── SessionProgress.tsx
├── reading/
│   ├── RoleIndicator.tsx
│   ├── BookmarkFlag.tsx
│   └── PartnerPosition.tsx
├── reflection/
│   ├── ReflectionSummary.tsx
│   └── DailyPrayerReport.tsx
├── useMotionConfig.ts
└── index.ts
```

**Motion Config:**
```typescript
// useMotionConfig.ts
import { useReducedMotion } from 'framer-motion';

export function useMotionConfig() {
  const shouldReduceMotion = useReducedMotion();

  return {
    fade: shouldReduceMotion ? { duration: 0 } : { duration: 0.3 },
    spring: shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 100, damping: 15 },
    slideUp: shouldReduceMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' },
  };
}
```

## Decision 6: RLS Policy Pattern

**Choice:** Session-Based Access

**Policy Template:**
```sql
-- All scripture_* tables follow this pattern
CREATE POLICY "scripture_[table]_select" ON scripture_[table]
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM scripture_sessions
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
    AND (user_id = auth.uid() OR is_shared = true)
  );

CREATE POLICY "scripture_[table]_insert" ON scripture_[table]
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM scripture_sessions
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
    AND user_id = auth.uid()
  );
```

**Rationale:**
- Consistent pattern across all scripture tables
- Decoupled from couples table semantics
- Session membership is single source of access truth
- Extensible if session model changes

## Decision Impact Analysis

**Implementation Sequence:**
1. Centralize IndexedDB versioning (tech debt fix)
2. Create Supabase tables + RLS policies
3. Create `scriptureReadingSlice` (Zustand)
4. Create `ScriptureReadingService` (IndexedDB)
5. Extend `SyncService`
6. Create Broadcast channel handlers
7. Build components (session → reading → reflection)

**Cross-Component Dependencies:**
```
┌─────────────────┐     ┌─────────────────┐
│ Supabase Tables │◄────│   RLS Policies  │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ scriptureSlice  │◄────│ ScriptureService│
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Broadcast Sync  │     │  SyncService    │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│           UI Components                  │
│  (session/ → reading/ → reflection/)    │
└─────────────────────────────────────────┘
```
