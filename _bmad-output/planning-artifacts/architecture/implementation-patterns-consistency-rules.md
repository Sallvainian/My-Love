# Implementation Patterns & Consistency Rules

## Pattern Categories Defined

**7 conflict points identified** where AI agents could make different choices. All patterns below are mandatory for Scripture Reading implementation.

## Naming Patterns

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
  - `scripture_seed_test_data(session_count?, include_reflections?, include_messages?)` — test environments only

**Code Naming (Inherited):**
- Variables/functions: `camelCase` (`sessionId`, `handleLockIn`)
- Components: `PascalCase` (`LockInButton`, `ReflectionSummary`)
- Files: `PascalCase.tsx` for components, `camelCase.ts` for utilities
- Constants: `SCREAMING_CASE` for true constants (`MAX_STEPS = 17`)

## Structure Patterns

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

## Format Patterns

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

## Communication Patterns

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

## Process Patterns

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

**Cache & Optimistic UI Pattern:**
- **Reads:** Return IndexedDB cache immediately → fetch fresh from server → update cache
- **Writes:** Show optimistic success → POST to server → on success, update cache → on failure, retry with user feedback
- **Recovery:** On cache corruption, clear IndexedDB and refetch from server
- Never block UI on server response (optimistic)

## Enforcement Guidelines

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

## Pattern Examples

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
