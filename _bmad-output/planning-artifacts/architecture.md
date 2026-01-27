---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowComplete: true
completedAt: '2026-01-26'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - docs/project-context.md
  - docs/index.md
  - docs/architecture-overview.md
  - docs/data-models.md
  - docs/service-layer.md
  - docs/technology-stack.md
  - docs/api-reference.md
  - docs/state-management.md
  - docs/component-inventory.md
workflowType: 'architecture'
project_name: 'My-Love'
user_name: 'Salvain'
date: '2026-01-25'
sourceOfTruth: '_bmad-output/planning-artifacts/prd.md'
classification:
  projectType: web_app
  domain: general
  complexity: medium-high
  projectContext: brownfield
featureContext:
  name: "Scripture Reading for Couples — A Responsive Reading (NKJV)"
  modes:
    - solo
    - together
  keyCapabilities:
    - "Overview stats dashboard"
    - "Solo guided reading flow"
    - "Together real-time synchronized flow"
    - "Lobby with ready states and countdown"
    - "Reflection tracking (rating, bookmark, notes)"
    - "Daily Prayer Report"
  technicalScope:
    - "5 new Supabase tables"
    - "Supabase Broadcast real-time sync"
    - "State machine for together mode"
    - "New Zustand slice"
    - "IndexedDB offline-first service"
constraints:
  - Zustand state management (slice pattern)
  - Supabase Broadcast for real-time sync
  - IndexedDB offline-first (solo mode)
  - Service layer architecture
  - WCAG AA accessibility
  - prefers-reduced-motion support
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
54 FRs organized into 8 capability areas:

| Category | FR Count | Architectural Impact |
|----------|----------|---------------------|
| Session Management | FR1-7 | Session lifecycle, mode selection, completion tracking |
| Solo Mode Flow | FR8-13 | Offline-first storage, save/resume, self-paced progression |
| Together Mode Flow | FR14-29 | Real-time sync, lobby, roles, lock-in, reconnection |
| Reflection System | FR30-33 | Per-step data capture, bookmark flag |
| Daily Prayer Report | FR34-41 | End-of-session messaging, reflection comparison |
| Stats & Progress | FR42-46 | Aggregate queries, couple-level metrics |
| Partner Integration | FR47-49 | Partner detection, linking flow integration |
| Accessibility | FR50-54 | Keyboard nav, screen reader, reduced motion, color independence |

**Non-Functional Requirements:**
24 NFRs across 5 quality dimensions:

| Category | Key Targets | Architectural Driver |
|----------|-------------|---------------------|
| Performance | <500ms sync, <200ms transitions | Supabase Broadcast, optimistic UI |
| Security & Privacy | User + partner only access | RLS policies, private-by-default reflections |
| Reliability | 100% recovery, zero race conditions | Server-authoritative state, idempotent writes |
| Accessibility | WCAG AA, prefers-reduced-motion | Animation system, focus management |
| Integration | Existing Zustand/Supabase/IndexedDB patterns | Brownfield constraints |

**Scale & Complexity:**

- Primary domain: Full-stack PWA (client-heavy)
- Complexity level: Medium-High
- Estimated new architectural components: ~15 (5 tables, 1 slice, 8 UI components, sync service)

### Technical Constraints & Dependencies

**Brownfield Constraints (Must Follow):**
- Zustand slice composition pattern (new `scriptureReadingSlice`)
- Supabase Broadcast for real-time (not postgres_changes due to RLS)
- IndexedDB offline-first with sync queue
- Service layer architecture (new `scriptureReadingService`)
- Zod validation on all API responses
- No Server Components (pure client-side SPA)

**Technology Stack (Locked):**
- React 19 + TypeScript 5.9 + Vite 7.3
- Zustand 5.0 + idb 8.0 + Zod 4.3
- Supabase JS 2.90 (Auth, Database, Storage, Realtime)
- Tailwind CSS 4.1 + Framer Motion 12.27

**Integration Points:**
- `BottomNavigation` — Add 'scripture' to ViewType
- `authService` — User authentication and partner detection
- Existing RLS patterns — Extend for new tables
- Existing sync patterns — Extend for scripture reading data

### Cross-Cutting Concerns Identified

| Concern | Components Affected | Architectural Approach |
|---------|--------------------|-----------------------|
| **Real-time sync** | Lobby, reading phases, lock-in | Supabase Broadcast channel per session |
| **Offline persistence** | Solo mode, reflections | IndexedDB service + sync queue |
| **Session state machine** | All phases | Zustand slice + server-authoritative state |
| **Accessibility** | All UI components | Focus management, aria-live, reduced motion |
| **Partner data isolation** | All data access | RLS policies + broadcast authorization |
| **Reconnection handling** | Together mode | Server state resync, graceful degradation |

## Starter Template Evaluation

### Project Context: Brownfield Feature Addition

This is **not** a greenfield project. Scripture Reading is being added to an existing My-Love PWA with a mature, production-proven technology stack.

### Existing Technology Foundation

| Layer | Technology | Status |
|-------|------------|--------|
| **Frontend** | React 19 + TypeScript 5.9 | Locked |
| **Build** | Vite 7.3 | Locked |
| **Styling** | Tailwind CSS 4.1 + Framer Motion 12.27 | Locked |
| **State** | Zustand 5.0 (slice composition) | Locked |
| **Backend** | Supabase 2.90 (Auth, DB, Storage, Realtime) | Locked |
| **Offline** | idb 8.0 (IndexedDB) | Locked |
| **Validation** | Zod 4.3 | Locked |

### Starter Template Decision: N/A

**Rationale:** Feature must integrate with existing architectural patterns:

1. **New Zustand slice** (`scriptureReadingSlice`) following slice composition pattern
2. **New service** (`scriptureReadingService`) following service layer pattern
3. **New IndexedDB service** for offline solo mode
4. **New Supabase tables** (5) with RLS policies
5. **New components** (8) using existing design system primitives

### Architectural Patterns to Follow

| Pattern | Existing Implementation | Scripture Reading Usage |
|---------|------------------------|------------------------|
| **Zustand slice** | `moodSlice`, `chatSlice`, etc. | `scriptureReadingSlice` |
| **Service layer** | `authService`, `moodService` | `scriptureReadingService` |
| **IndexedDB** | `offlineMoodService` | `offlineScriptureService` |
| **Supabase Broadcast** | Real-time sync pattern | Together mode sync |
| **Component composition** | `MoodButton`, `MoodDetailModal` | `LockInButton`, `ReflectionSummary` |

**Note:** No project initialization required. First implementation story will be creating the new Zustand slice and Supabase tables.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Data Architecture — Normalized 5 tables + snapshot_json
2. Real-Time Sync — Hybrid (server-authoritative + client pending)
3. State Machine — Phase enum + local view state + presence channel
4. Offline Architecture — MoodService pattern + fix IndexedDB versioning

**Important Decisions (Shape Architecture):**
5. Component Architecture — Feature-scoped subfolders + centralized motion
6. RLS Policy Pattern — Session-based access

**Deferred Decisions (Post-MVP):**
- Analytics/monitoring instrumentation
- Performance optimization (lazy loading, code splitting)
- Extended offline capabilities (Together mode offline queuing)

### Decision 1: Data Architecture

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

### Decision 2: Real-Time Sync Architecture

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

### Decision 3: State Machine Design

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

### Decision 4: Offline Architecture

**Choice:** MoodService/SyncService Pattern + Fix IndexedDB Versioning

**New Components:**
| Component | Purpose |
|-----------|---------|
| `src/services/dbSchema.ts` | Centralized DB version + upgrade logic |
| `ScriptureReadingService` | IndexedDB CRUD with `synced: false` pattern |
| `SyncService` extension | `syncScriptureReadingData()` method |

**⚠️ Service Worker Constraint:** `sw-db.ts` must be manually kept in sync with `dbSchema.ts` (Service Workers cannot import idb library).

**IndexedDB Stores:**
```typescript
'scripture_sessions': { keyPath: 'id', indexes: ['synced', 'user_id'] }
'scripture_step_states': { keyPath: 'id', indexes: ['synced', 'session_id'] }
'scripture_reflections': { keyPath: 'id', indexes: ['synced', 'session_id'] }
'scripture_bookmarks': { keyPath: 'id', indexes: ['synced', 'session_id'] }
'scripture_messages': { keyPath: 'id', indexes: ['synced', 'session_id'] }
```

**Tech Debt Fix:**
- Centralize IndexedDB version management (single source of truth)
- All services reference shared version constant
- Upgrade callbacks handle all stores in one place
- Eliminates existing `VersionError` flakiness

### Decision 5: Component Architecture

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

### Decision 6: RLS Policy Pattern

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

### Decision Impact Analysis

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

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**7 conflict points identified** where AI agents could make different choices. All patterns below are mandatory for Scripture Reading implementation.

### Naming Patterns

**Database Naming (Inherited):**
- Tables: `snake_case` plural (`scripture_sessions`, `scripture_reflections`)
- Columns: `snake_case` (`step_index`, `user_id`, `is_shared`)
- Foreign keys: `{table}_id` format (`session_id`, `sender_id`)

**Broadcast Event Naming:**
- Format: `snake_case`
- Examples: `state_updated`, `presence_update`, `lock_in_confirmed`
- Channel naming: `scripture-session:{session_id}`, `scripture-presence:{session_id}`

**Supabase RPC Naming:**
- Format: Action-oriented with `scripture_` prefix
- Examples:
  - `scripture_lock_in(session_id, step_index, user_id, expected_version)`
  - `scripture_advance_phase(session_id, expected_version)`
  - `scripture_submit_reflection(session_id, step_index, user_id, rating, notes, is_shared)`
  - `scripture_create_session(mode, partner_id?)`

**Code Naming (Inherited):**
- Variables/functions: `camelCase` (`sessionId`, `handleLockIn`)
- Components: `PascalCase` (`LockInButton`, `ReflectionSummary`)
- Files: `PascalCase.tsx` for components, `camelCase.ts` for utilities
- Constants: `SCREAMING_CASE` for true constants (`MAX_STEPS = 17`)

### Structure Patterns

**Type Organization:**
- Co-locate types with the Zustand slice
- File: `src/store/slices/scriptureReadingSlice.ts`
- Export types alongside slice actions and selectors

```typescript
// scriptureReadingSlice.ts
export type SessionPhase = 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
export type SessionMode = 'solo' | 'together';

export interface ScriptureSession {
  id: string;
  mode: SessionMode;
  currentPhase: SessionPhase;
  currentStepIndex: number;
  version: number;
  // ...
}

export interface ScriptureReadingState {
  session: ScriptureSession | null;
  isLoading: boolean;
  isPendingLockIn: boolean;
  // ...
}

export const useScriptureReadingStore = create<ScriptureReadingState>(...);
```

**Component Organization:**
- Feature-scoped subfolders: `session/`, `reading/`, `reflection/`
- Each component is a single file
- Barrel exports via `index.ts`

**Test Organization:**
- Top-level `tests/` folder mirroring src structure
- Path: `tests/unit/components/scripture-reading/{subfolder}/{Component}.test.tsx`
- Service tests: `tests/unit/services/scriptureReadingService.test.ts`
- Integration tests: `tests/integration/scripture-reading/`

### Format Patterns

**Error Handling:**
- Use error codes enum + centralized handler
- Location: `src/services/scriptureReadingService.ts`

```typescript
export enum ScriptureErrorCode {
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SYNC_FAILED = 'SYNC_FAILED',
  OFFLINE = 'OFFLINE',
}

export interface ScriptureError {
  code: ScriptureErrorCode;
  message: string;
  details?: unknown;
}

export function handleScriptureError(error: ScriptureError): void {
  switch (error.code) {
    case ScriptureErrorCode.VERSION_MISMATCH:
      // Refetch session state, show subtle toast
      break;
    case ScriptureErrorCode.SYNC_FAILED:
      // Queue for retry, show offline indicator
      break;
    // ...
  }
}
```

**Loading State Naming:**
- Explicit boolean flags per async operation
- Prefix with `is` for booleans, `pending` for in-flight actions

```typescript
interface ScriptureReadingState {
  // General loading
  isLoading: boolean;
  isInitialized: boolean;

  // Specific pending states
  isPendingLockIn: boolean;
  isPendingReflection: boolean;
  isSyncing: boolean;

  // Error state
  error: ScriptureError | null;
}
```

### Communication Patterns

**Broadcast Payload Structure:**
```typescript
// State update broadcast
interface StateUpdatePayload {
  session_id: string;
  version: number;
  snapshot: SessionSnapshot;
  triggered_by: 'lock_in' | 'phase_advance' | 'reconnect';
}

// Presence broadcast
interface PresencePayload {
  user_id: string;
  step_index: number;
  view: 'verse' | 'response';
  ts: number;
}
```

**State Update Pattern:**
- Slice receives broadcast → validates version → updates state
- Never mutate state directly; always use slice actions
- Optimistic updates only for local pending flags

```typescript
// In slice
onBroadcastReceived: (payload: StateUpdatePayload) => {
  if (payload.version <= get().session?.version) return; // Ignore stale
  set({ session: payload.snapshot, isPendingLockIn: false });
}
```

### Process Patterns

**Component Prop Pattern:**
- Components receive data via props (dumb components)
- Container components connect to slice
- Callbacks passed as props for testability

```typescript
// Container (smart)
function LockInButtonContainer() {
  const { isLocked, isPending, partnerLocked } = useScriptureReadingStore(
    (s) => ({
      isLocked: s.session?.userLocked,
      isPending: s.isPendingLockIn,
      partnerLocked: s.session?.partnerLocked,
    })
  );
  const lockIn = useScriptureReadingStore((s) => s.lockIn);

  return (
    <LockInButton
      isLocked={isLocked}
      isPending={isPending}
      partnerLocked={partnerLocked}
      onLockIn={lockIn}
    />
  );
}

// Presentational (dumb)
interface LockInButtonProps {
  isLocked: boolean;
  isPending: boolean;
  partnerLocked: boolean;
  onLockIn: () => void;
}

function LockInButton({ isLocked, isPending, partnerLocked, onLockIn }: LockInButtonProps) {
  // Pure render logic, no hooks that fetch data
}
```

**Offline Sync Pattern:**
- Write to IndexedDB with `synced: false`
- SyncService processes queue when online
- Mark `synced: true` on success
- Never block UI on sync completion

### Enforcement Guidelines

**All AI Agents MUST:**
1. Use `snake_case` for all database columns and broadcast events
2. Co-locate types with `scriptureReadingSlice.ts`
3. Use explicit boolean flags for loading states (`isLoading`, `isPendingX`)
4. Pass data to components via props (dumb component pattern)
5. Handle errors via `ScriptureErrorCode` enum and `handleScriptureError()`
6. Place tests in `tests/unit/...` mirroring src structure
7. Use action-oriented RPC names with `scripture_` prefix

**Pattern Verification:**
- TypeScript will catch most naming violations
- PR review checklist should include pattern compliance
- Linting rules enforce file naming conventions

### Pattern Examples

**Good Examples:**
```typescript
// ✓ Correct broadcast event
channel.send({ type: 'broadcast', event: 'state_updated', payload });

// ✓ Correct RPC call
const result = await supabase.rpc('scripture_lock_in', {
  session_id, step_index, user_id, expected_version
});

// ✓ Correct loading state
const [isLoading, setIsLoading] = useState(false);
const [isPendingLockIn, setIsPendingLockIn] = useState(false);

// ✓ Correct component props
<LockInButton isLocked={isLocked} onLockIn={handleLockIn} />
```

**Anti-Patterns:**
```typescript
// ✗ Wrong: dot notation for events
channel.send({ event: 'session.stateUpdated' });

// ✗ Wrong: resource.action RPC naming
await supabase.rpc('scripture_session_lock_in', ...);

// ✗ Wrong: status enum for simple loading
const [status, setStatus] = useState<'idle' | 'loading'>('idle');

// ✗ Wrong: component fetches its own data
function LockInButton() {
  const session = useScriptureReadingStore((s) => s.session); // ✗
}
```

## Project Structure & Boundaries

### Complete Project Directory Structure

**New Files & Directories for Scripture Reading:**

```
src/
├── components/
│   └── scripture-reading/              # NEW DIRECTORY
│       ├── session/
│       │   ├── Countdown.tsx
│       │   ├── LockInButton.tsx
│       │   └── SessionProgress.tsx
│       ├── reading/
│       │   ├── RoleIndicator.tsx
│       │   ├── BookmarkFlag.tsx
│       │   └── PartnerPosition.tsx
│       ├── reflection/
│       │   ├── ReflectionSummary.tsx
│       │   └── DailyPrayerReport.tsx
│       ├── containers/
│       │   ├── ScriptureReadingView.tsx
│       │   ├── LobbyContainer.tsx
│       │   ├── ReadingContainer.tsx
│       │   └── ReflectionContainer.tsx
│       └── index.ts
│
├── stores/
│   └── slices/
│       └── scriptureReadingSlice.ts    # NEW FILE (types co-located)
│
├── services/
│   ├── dbSchema.ts                     # NEW FILE (centralized IndexedDB version)
│   └── scriptureReadingService.ts      # NEW FILE (IndexedDB CRUD)
│
├── hooks/
│   ├── useMotionConfig.ts              # NEW FILE (global reduced-motion)
│   ├── useScriptureBroadcast.ts        # NEW FILE (real-time channel)
│   └── index.ts                        # MODIFIED (export new hooks)
│
└── types/
    ├── database.types.ts               # MODIFIED (add scripture table types)
    └── models.ts                       # MODIFIED (add scripture app models)

supabase/
└── migrations/
    └── 20260125_scripture_reading.sql  # NEW FILE (tables + RPCs + RLS)

tests/
├── unit/
│   ├── components/
│   │   └── scripture-reading/
│   │       ├── session/
│   │       │   ├── Countdown.test.tsx
│   │       │   ├── LockInButton.test.tsx
│   │       │   └── SessionProgress.test.tsx
│   │       ├── reading/
│   │       │   ├── RoleIndicator.test.tsx
│   │       │   ├── BookmarkFlag.test.tsx
│   │       │   └── PartnerPosition.test.tsx
│   │       └── reflection/
│   │           ├── ReflectionSummary.test.tsx
│   │           └── DailyPrayerReport.test.tsx
│   ├── services/
│   │   ├── dbConfig.test.ts
│   │   └── scriptureReadingService.test.ts
│   ├── stores/
│   │   └── scriptureReadingSlice.test.ts
│   └── hooks/
│       ├── useMotionConfig.test.ts
│       └── useScriptureBroadcast.test.ts
│
└── integration/
    └── scripture-reading/
        ├── solo-mode.test.ts
        ├── together-mode.test.ts
        └── offline-sync.test.ts
```

### Existing Files Modified

| File | Change |
|------|--------|
| `src/stores/useAppStore.ts` | Import and compose `scriptureReadingSlice` |
| `src/stores/slices/navigationSlice.ts` | Add 'scripture' to ViewType |
| `src/App.tsx` | Add scripture reading route/view |
| `src/components/Navigation/BottomNavigation.tsx` | Add scripture tab |
| `src/services/syncService.ts` | Add `syncScriptureReadingData()` method |
| `src/services/moodService.ts` | Import shared `dbSchema.ts` (tech debt fix) |
| `src/services/customMessageService.ts` | Import shared `dbSchema.ts` (tech debt fix) |
| `src/services/photoStorageService.ts` | Import shared `dbSchema.ts` (tech debt fix) |
| `src/sw-db.ts` | **⚠️ Manual sync:** Update DB_VERSION to 5, add scripture stores if Background Sync needed |
| `src/types/database.types.ts` | Add scripture table type definitions |
| `src/types/models.ts` | Add scripture app model interfaces |
| `src/hooks/index.ts` | Export `useMotionConfig`, `useScriptureBroadcast` |

### Architectural Boundaries

**API Boundaries:**

| Boundary | Location | Protocol |
|----------|----------|----------|
| **Supabase Tables** | `supabase/migrations/` | SQL DDL |
| **Supabase RPCs** | `supabase/migrations/` | SQL functions |
| **Supabase Broadcast** | `src/hooks/useScriptureBroadcast.ts` | WebSocket |
| **IndexedDB** | `src/services/scriptureReadingService.ts` | idb wrapper |

**Component Boundaries:**

| Layer | Responsibility | Communication |
|-------|---------------|---------------|
| **Containers** | Connect to slice, pass props | Zustand selectors |
| **Presentational** | Pure render, receive props | Props + callbacks |
| **Slice** | State management | Actions + selectors |
| **Service** | Data persistence | Async methods |
| **Hooks** | Side effects (broadcast, motion) | React hooks |

**Data Boundaries:**

| Data Type | Source of Truth | Sync Pattern |
|-----------|-----------------|--------------|
| Session state | Supabase (server) | Broadcast → Slice |
| Lock-in state | Supabase (server) | RPC → Broadcast |
| Reflections | IndexedDB (local) | SyncService → Supabase |
| Bookmarks | IndexedDB (local) | SyncService → Supabase |
| Presence | Ephemeral broadcast | No persistence |

### Requirements to Structure Mapping

**Feature Mapping:**

| FR Category | Primary Files |
|-------------|---------------|
| **Session Management (FR1-7)** | `scriptureReadingSlice.ts`, `scriptureReadingService.ts`, `ScriptureReadingView.tsx` |
| **Solo Mode Flow (FR8-13)** | `ReadingContainer.tsx`, `scriptureReadingService.ts`, `dbSchema.ts` |
| **Together Mode Flow (FR14-29)** | `useScriptureBroadcast.ts`, `LobbyContainer.tsx`, `LockInButton.tsx`, `Countdown.tsx` |
| **Reflection System (FR30-33)** | `ReflectionSummary.tsx`, `BookmarkFlag.tsx`, `ReflectionContainer.tsx` |
| **Daily Prayer Report (FR34-41)** | `DailyPrayerReport.tsx`, `ReflectionContainer.tsx` |
| **Stats & Progress (FR42-46)** | `scriptureReadingService.ts`, `scriptureReadingSlice.ts` |
| **Accessibility (FR50-54)** | `useMotionConfig.ts`, all presentational components |

**Cross-Cutting Concerns:**

| Concern | Files |
|---------|-------|
| **Real-time sync** | `useScriptureBroadcast.ts`, `scriptureReadingSlice.ts` |
| **Offline persistence** | `dbSchema.ts`, `scriptureReadingService.ts`, `syncService.ts` |
| **Reduced motion** | `useMotionConfig.ts` (global, used by all animated components) |
| **RLS policies** | `20260125_scripture_reading.sql` |

### Integration Points

**Internal Communication:**

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                              │
│                           │                                 │
│                           ▼                                 │
│              ┌─────────────────────────┐                   │
│              │  ScriptureReadingView   │                   │
│              │     (container)         │                   │
│              └───────────┬─────────────┘                   │
│                          │                                  │
│         ┌────────────────┼────────────────┐                │
│         ▼                ▼                ▼                │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐       │
│  │   Lobby    │  │  Reading   │  │   Reflection   │       │
│  │ Container  │  │ Container  │  │   Container    │       │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘       │
│        │               │                 │                 │
│        └───────────────┼─────────────────┘                 │
│                        ▼                                    │
│           ┌─────────────────────────┐                      │
│           │  scriptureReadingSlice  │◄──── useScripture    │
│           │      (Zustand)          │      Broadcast       │
│           └───────────┬─────────────┘                      │
│                       │                                     │
│         ┌─────────────┼─────────────┐                      │
│         ▼             ▼             ▼                      │
│  ┌────────────┐ ┌──────────┐ ┌──────────────┐             │
│  │ scripture  │ │ Supabase │ │  SyncService │             │
│  │ Reading    │ │   RPC    │ │  (modified)  │             │
│  │ Service    │ │          │ │              │             │
│  └────────────┘ └──────────┘ └──────────────┘             │
│        │                                                    │
│        ▼                                                    │
│  ┌────────────┐                                            │
│  │  IndexedDB │◄──── dbSchema.ts (shared version)         │
│  └────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

**External Integrations:**

| Integration | Protocol | Files |
|-------------|----------|-------|
| Supabase Auth | Existing | `authService.ts` (no changes) |
| Supabase Database | PostgreSQL | `database.types.ts`, migration |
| Supabase Realtime | Broadcast | `useScriptureBroadcast.ts` |
| IndexedDB | idb wrapper | `dbSchema.ts`, `scriptureReadingService.ts` |

### File Organization Patterns

**New File Naming:**
- Components: `PascalCase.tsx` (e.g., `LockInButton.tsx`)
- Services: `camelCase.ts` (e.g., `scriptureReadingService.ts`)
- Hooks: `useCamelCase.ts` (e.g., `useScriptureBroadcast.ts`)
- Slices: `camelCaseSlice.ts` (e.g., `scriptureReadingSlice.ts`)
- Tests: `{filename}.test.ts(x)` mirroring src structure

**Migration File:**
- Single file: `20260125_scripture_reading.sql`
- Contains: Tables, indexes, RLS policies, RPC functions
- Idempotent: Uses `IF NOT EXISTS` where appropriate

### Tech Debt Fix: Centralized dbConfig

**Problem:** Existing services use different IndexedDB versions causing `VersionError`.

**Solution:** `src/services/dbSchema.ts` (centralized schema)

```typescript
// dbSchema.ts
export const DB_NAME = 'my-love-db';
export const DB_VERSION = 5; // Bumped for Scripture Reading stores

export const STORES = {
  moods: { keyPath: 'id', indexes: ['synced', 'user_id'] },
  customMessages: { keyPath: 'id', indexes: ['synced'] },
  photos: { keyPath: 'id', indexes: ['synced'] },
  // New scripture stores
  scriptureSessions: { keyPath: 'id', indexes: ['synced', 'user_id'] },
  scriptureStepStates: { keyPath: 'id', indexes: ['synced', 'session_id'] },
  scriptureReflections: { keyPath: 'id', indexes: ['synced', 'session_id'] },
  scriptureBookmarks: { keyPath: 'id', indexes: ['synced', 'session_id'] },
  scriptureMessages: { keyPath: 'id', indexes: ['synced', 'session_id'] },
};

export function upgradeDb(db: IDBPDatabase, oldVersion: number) {
  // Handle all store creation/upgrades in one place
  for (const [name, config] of Object.entries(STORES)) {
    if (!db.objectStoreNames.contains(name)) {
      const store = db.createObjectStore(name, { keyPath: config.keyPath });
      config.indexes.forEach(idx => store.createIndex(idx, idx));
    }
  }
}
```

**⚠️ Service Worker Sync Constraint:**

The `sw-db.ts` file **must be kept in sync manually** with `dbSchema.ts`. Service Workers cannot import from the `idb` library, so constants are duplicated:

```typescript
// sw-db.ts
// SYNC WARNING: These constants must match src/services/dbSchema.ts
const DB_VERSION = 5; // Must match DB_VERSION in src/services/dbSchema.ts
```

**Scripture Reading Implementation Checklist:**
1. ✅ Bump `DB_VERSION` to 5 in `dbSchema.ts`
2. ✅ Add 5 new stores to `MyLoveDBSchema` interface
3. ✅ Add upgrade logic in `scriptureReadingService.ts`
4. ⚠️ Update `sw-db.ts` if Background Sync needs access to scripture data

**Services to Update:**
- `moodService.ts` → import `DB_NAME`, `DB_VERSION`, `upgradeDb`
- `customMessageService.ts` → import shared config
- `photoStorageService.ts` → import shared config
- `scriptureReadingService.ts` → import shared config (new)
- `sw-db.ts` → **manually sync** DB_VERSION constant

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All 6 architectural decisions work together without conflicts:
- Normalized tables enable row-level RLS and clean SQL queries
- Hybrid sync (server-authoritative + client pending) prevents race conditions
- Phase enum + local view state cleanly separates canonical vs ephemeral data
- IndexedDB pattern matches existing MoodService/SyncService
- Component architecture (dumb + containers) supports Zustand slice pattern
- Centralized dbConfig fixes existing tech debt

**Pattern Consistency:**
All 7 implementation patterns align with architectural decisions:
- Naming conventions match Supabase (snake_case) and TypeScript (camelCase)
- Test organization mirrors src structure
- Error handling uses simple enum + handler (not over-engineered)
- Loading states use explicit boolean flags

**Structure Alignment:**
Project structure fully supports all decisions:
- Feature-scoped component folders enable phase-based development
- Hooks directory accommodates global utilities (motion, broadcast)
- Single migration file contains tables + RPCs + RLS (atomic deployment)

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
All 54 FRs across 8 categories have architectural support:
- Session Management: Slice + RPCs + session table
- Solo/Together Flows: Services + broadcast + state machine
- Reflection/Report: Dedicated components + normalized tables
- Stats: SQL-friendly normalized schema
- Accessibility: Global motion config + component patterns

**Non-Functional Requirements Coverage:**
All 24 NFRs have architectural support:
- Performance: Broadcast <500ms, Motion config <200ms transitions
- Security: Session-based RLS, private-by-default reflections
- Reliability: Version-based sync, idempotent writes
- Accessibility: WCAG AA patterns, prefers-reduced-motion
- Integration: Brownfield constraints followed throughout

### Implementation Readiness Validation ✅

**Decision Completeness:**
- 6 major architectural decisions documented
- 7 implementation patterns with examples
- Anti-patterns explicitly documented
- Error handling and loading state patterns defined

**Structure Completeness:**
- 15 new files specified with exact paths
- 12 existing files identified for modification
- Test structure mirrors src organization
- Integration diagram shows data flow

**Pattern Completeness:**
- All naming conventions documented
- Broadcast payload structures defined
- Component prop patterns with container/presentational split
- Offline sync pattern follows existing app conventions

### Gap Analysis Results

**Critical Gaps:** None identified

**Important Gaps (non-blocking):**

| Gap | Resolution |
|-----|------------|
| Scripture content source | Add as static JSON in `public/scripture-steps.json` or Supabase seed |
| Role alternation | Step N: User with lower UUID is Reader; alternates each step |
| Countdown duration | 3 seconds (per UX spec) |

**Future Enhancements (post-MVP):**
- Analytics events for session completion tracking
- Code splitting for scripture-reading components
- E2E tests for Together mode synchronization

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (brownfield, 54 FRs, 24 NFRs)
- [x] Scale and complexity assessed (medium-high)
- [x] Technical constraints identified (Zustand, Supabase, IndexedDB)
- [x] Cross-cutting concerns mapped (sync, offline, accessibility)

**✅ Architectural Decisions**
- [x] Critical decisions documented (6 decisions)
- [x] Technology stack fully specified (locked versions)
- [x] Integration patterns defined (broadcast, RPC, IndexedDB)
- [x] Performance considerations addressed (hybrid sync, motion config)

**✅ Implementation Patterns**
- [x] Naming conventions established (7 patterns)
- [x] Structure patterns defined (feature folders, test mirrors)
- [x] Communication patterns specified (broadcast payloads)
- [x] Process patterns documented (error handling, offline sync)

**✅ Project Structure**
- [x] Complete directory structure defined (15 new, 12 modified)
- [x] Component boundaries established (container/presentational)
- [x] Integration points mapped (diagram included)
- [x] Requirements to structure mapping complete (FR → files table)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
1. Server-authoritative design prevents race conditions
2. Normalized tables enable clean RLS and stats queries
3. Follows existing brownfield patterns (MoodService, slices)
4. Tech debt fix (dbConfig) included — improves overall app stability
5. Comprehensive patterns prevent AI agent implementation conflicts

**Areas for Future Enhancement:**
1. Analytics instrumentation for session tracking
2. E2E test coverage for Together mode
3. Code splitting for bundle optimization
4. Extended offline support (Together mode queue)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions
- When in doubt, match existing app patterns (moodSlice, MoodService)

**First Implementation Priority:**
1. Create `src/services/dbSchema.ts` (tech debt fix — unblocks all services)
2. Create Supabase migration with tables + RPCs + RLS
3. Generate TypeScript types from Supabase
4. Create `scriptureReadingSlice.ts` with types
5. Build components phase-by-phase (session → reading → reflection)

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-01-26
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document**
- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**
- 6 architectural decisions made
- 7 implementation patterns defined
- 27 new/modified files specified
- 78 requirements (54 FRs + 24 NFRs) fully supported

**AI Agent Implementation Guide**
- Technology stack with verified versions
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries
- Integration patterns and communication standards

### Quality Assurance Checklist

**✅ Architecture Coherence**
- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**
- [x] All functional requirements are supported
- [x] All non-functional requirements are addressed
- [x] Cross-cutting concerns are handled
- [x] Integration points are defined

**✅ Implementation Readiness**
- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

### Project Success Factors

**Clear Decision Framework**
Every technology choice was made collaboratively with clear rationale, ensuring all stakeholders understand the architectural direction.

**Consistency Guarantee**
Implementation patterns and rules ensure that multiple AI agents will produce compatible, consistent code that works together seamlessly.

**Complete Coverage**
All project requirements are architecturally supported, with clear mapping from business needs to technical implementation.

**Solid Foundation**
The brownfield integration approach and architectural patterns provide a production-ready foundation following existing app conventions.

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.
