# Project Context for AI Agents

> Critical rules and patterns for implementing code in this project. Focus on unobvious details that agents might otherwise miss.
>
> **Generated:** 2026-01-26 | **Status:** Complete | **Rules:** 60+

---

## Technology Stack & Versions

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | React | 19.2.3 |
| Language | TypeScript | 5.9.3 (strict) |
| Build | Vite | 7.3.1 |
| State | Zustand | 5.0.10 |
| Backend | Supabase | 2.90.1 |
| Styling | Tailwind CSS | 4.1.17 |
| Animation | Framer Motion | 12.27.1 |
| Offline | idb | 8.0.3 |
| Validation | Zod | 4.3.5 |
| Unit Tests | Vitest | 4.0.17 |
| Component Tests | Testing Library | 16.3.2 |
| E2E Tests | Playwright | 1.57.0 |
| IndexedDB Mock | fake-indexeddb | 6.2.5 |
| PWA | vite-plugin-pwa | (service worker + offline shell) |

### Version Constraints
- **React 19**: Hooks only, no class components
- **TypeScript strict**: Strict null checks, no implicit any
- **Supabase Broadcast**: Use for real-time sync (not postgres_changes due to RLS)

---

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Type Safety:**
- No `any` (lint-enforced error — use `unknown`, generics, `Record<string, unknown>`, or `z.infer<>`)
- Validate Supabase/API payloads with Zod (`schema.parse(...)`) at the boundary
- Prefix intentionally unused variables with `_` (lint-enforced error)

**Alternatives to `any`:**
- Boundaries: `unknown` + type narrowing
- Generic functions: `function foo<T>(x: T): T`
- Objects: `Record<string, unknown>`
- Validated data: `z.infer<typeof Schema>`

**Modules & Imports:**
- ESM only (`import`/`export`)
- No path aliases configured — use relative imports consistently
- Use `index.ts` barrel exports where the feature folder already does

**Errors:**
- Use `ErrorCode` enum + `handleXError()` pattern for feature errors (no class hierarchies)
- Don't swallow errors silently — log or surface via handler/toast/recovery flow
- Avoid throwing custom error classes unless the existing codebase already does

**Type Organization:**
- Feature types live with the slice (e.g., `src/stores/slices/moodSlice.ts`)
- DB types live in `src/types/database.types.ts`
- App models live in `src/types/models.ts`

---

### Framework-Specific Rules (React + Zustand)

**React:**
- Pure client-side SPA — never use `"use client"` or `"use server"` directives
- Hooks only — no class components
- No React Router — manual URL routing via `navigationSlice`

**Zustand State Access:**
```typescript
// Always use selector pattern (prevents unnecessary re-renders)
const value = useAppStore(state => state.value);

// Multiple values — use destructuring
const { moods, saveMoodEntry } = useAppStore(state => ({
  moods: state.moods,
  saveMoodEntry: state.saveMoodEntry,
}));

// Never do this:
const store = useAppStore(); // subscribes to entire store
```

**Zustand Slices:**
- Actions live with state in each slice (not separate action files)
- Slices: messages, photos, settings, navigation, mood, interactions, partner, notes, scriptureReading
- New features: add slice in `src/stores/slices/`, register in `useAppStore.ts`

**Offline-First Pattern:**
```typescript
// 1. Save locally first (instant UI feedback)
await indexedDBService.save(data);

// 2. Sync to Supabase in background (never block UI on network)
void syncService.enqueueOrSync(); // fire-and-forget with retry queue
```

**API Validation:**
```typescript
// Always validate Supabase responses at boundary (follow MoodApi pattern)
const response = await supabase.from('moods').select('*');
const validated = MoodSchema.array().parse(response.data);
```

---

### Testing Rules

**Test Structure:**
- Unit tests: `tests/unit/**` mirroring `src/**`
- Integration tests: `tests/integration/**` (component + store/service interactions)
- E2E tests: Playwright directory as configured in repo (see Playwright config)

**Mocking:**
- Mock Supabase client at module level (not individual functions)
- Use `fake-indexeddb` for IndexedDB unit tests
- `@ts-ignore` allowed in test files only when necessary for complex mocks

**Test Boundaries:**
- Unit: isolated functions, services, slices, presentational components
- Integration: containers + slice + services wired together (no real network)
- E2E: full user flows (navigation, auth gating, offline/online recovery)

**Coverage:**
- Prioritize critical paths (sync, lock-in transitions, offline recovery)
- Don't chase 100% — cover business logic and regressions first

---

### Code Quality & Style Rules

**Linting:**
- ESLint flat config + `typescript-eslint`
- React hooks rules enforced
- Unused vars error unless prefixed with `_`

**File Organization:**
- Components: `src/components/<feature>/...` (feature folder may be kebab-case) + `index.ts` barrels where used
- Hooks: `src/hooks/useX.ts`
- Stores: `src/stores/slices/xSlice.ts`
- Services: `src/services/xService.ts`

**Naming:**
- Components: PascalCase files
- Hooks: `useX`
- Services/slices: camelCase + suffix (`syncService.ts`, `moodSlice.ts`)
- Types: PascalCase; feature types co-located with slice; shared types in `src/types/`

**Formatting:**
- No Prettier — follow existing style
- Don't reformat unrelated code

---

### Development Workflow Rules

**Branches:**
- Feature: `feature/[description]`
- Fix: `fix/[description]`
- Chore: `chore/[description]`

**Commits:**
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Keep subject line concise (<72 chars)

**Environment:**
- Secrets in encrypted `.env` via `dotenvx`
- Use `dotenvx run -- <command>` for local dev/test (loads encrypted env vars)
- Never commit `.env.keys`
- Node.js 18+

**Deployment:**
- Target: GitHub Pages
- Vite base path: `/My-Love/` in production, `/` in dev
- When adding routes/assets, ensure they work under `/My-Love/` base path (no absolute `/assets/...` assumptions)
- PWA auto-updates via service worker

---

### Critical Don't-Miss Rules

**Never Do:**
- Use `any` (lint-enforced error — use `unknown`, generics, `Record<string, unknown>`, or `z.infer<>`)
- Use React Router (navigation via `navigationSlice`)
- Use `"use client"` / `"use server"` (pure client SPA)
- Skip Zod validation on Supabase responses
- Block UI waiting on network sync
- Subscribe to entire Zustand store (`useAppStore()` without selector)
- Commit `.env.keys` or unencrypted secrets

**Always Do:**
- Validate external data at boundaries (Zod) — follow MoodApi pattern
- Use selector pattern for Zustand (`useAppStore(state => state.x)`)
- Use destructuring for multi-value selectors
- Save to IndexedDB first, sync to Supabase in background (fire-and-forget)
- Sanitize user-generated content (DOMPurify — see `messageValidation.ts`)
- Test with base path `/My-Love/` for GitHub Pages compatibility
- Use `dotenvx run --` for local env loading

**Handle These Edge Cases:**
- Offline state: queue operations, sync when online
- No partner connected: graceful fallback in partner-dependent features
- Auth errors: let Supabase refresh tokens, catch and surface failures

---

## Scripture Reading Feature Architecture

> Feature-specific rules for implementing the Scripture Reading for Couples feature.

### Data Architecture

**5 Normalized Supabase Tables:**

| Table | Purpose |
|-------|---------|
| `scripture_sessions` | Session metadata + `version` + `snapshot_json` |
| `scripture_step_states` | Per-step lock-in timestamps |
| `scripture_reflections` | Per-step user reflections (rating, notes, is_shared) |
| `scripture_bookmarks` | Per-step bookmarks |
| `scripture_messages` | Daily Prayer Report messages |

**RPCs (in migrations, not edge functions):**
- `scripture_create_session(mode, partner_id?)`
- `scripture_lock_in(session_id, step_index, user_id, expected_version)`
- `scripture_advance_phase(session_id, expected_version)`
- `scripture_submit_reflection(session_id, step_index, user_id, rating, notes, is_shared)`

**RLS Pattern:** Session-based access (user must be `user1_id` or `user2_id` on session)

### State Machine

**Session Phases (server-authoritative):**
```typescript
type SessionPhase = 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
type SessionMode = 'solo' | 'together';
```

**Phase Transitions:**
```
TOGETHER: lobby → countdown → reading (×17) → reflection → report → complete
SOLO:     reading (×17) → reflection → report → complete
```

**Client-Local State (not synced):**
```typescript
type ViewState = 'verse' | 'response'; // Which card the user is viewing
```

### Real-Time Sync (Together Mode)

**Hybrid Sync:**
- **Server:** All mutations (lock-in, phase advance) go through RPCs
- **Client:** Optimistic `isPendingLockIn` flag (local only)
- **Version Control:** `expected_version` on mutations, 409 on stale

**Broadcast Channels:**
```typescript
// State updates: scripture-session:{session_id}
{ session_id, version, snapshot, triggered_by: 'lock_in' | 'phase_advance' }

// Presence (ephemeral): scripture-presence:{session_id}
{ user_id, step_index, view: 'verse' | 'response', ts }
```

**Anti-Race Rule:** Ignore broadcasts where `version <= localVersion`

### Offline Architecture (Solo Mode)

**Centralized IndexedDB Config:** `src/services/dbConfig.ts`
```typescript
export const DB_NAME = 'my-love-db';
export const DB_VERSION = 4;
export const STORES = {
  moods: {...}, customMessages: {...}, photos: {...},
  scriptureSessions: { keyPath: 'id', indexes: ['synced', 'user_id'] },
  scriptureStepStates: { keyPath: 'id', indexes: ['synced', 'session_id'] },
  scriptureReflections: { keyPath: 'id', indexes: ['synced', 'session_id'] },
  scriptureBookmarks: { keyPath: 'id', indexes: ['synced', 'session_id'] },
  scriptureMessages: { keyPath: 'id', indexes: ['synced', 'session_id'] },
};
```

**All IndexedDB services must import from dbConfig** (fixes existing VersionError tech debt)

### Component Architecture

**Directory Structure:**
```
src/components/scripture-reading/
├── session/        # Countdown, LockInButton, SessionProgress
├── reading/        # RoleIndicator, BookmarkFlag, PartnerPosition
├── reflection/     # ReflectionSummary, DailyPrayerReport
├── containers/     # Smart components (connect to slice)
└── index.ts
```

**Container/Presentational Pattern:**
```typescript
// Container (smart) — connects to slice
function LockInButtonContainer() {
  const { isLocked, isPending } = useAppStore(s => ({
    isLocked: s.scriptureReading.userLocked,
    isPending: s.scriptureReading.isPendingLockIn,
  }));
  return <LockInButton isLocked={isLocked} isPending={isPending} onLockIn={lockIn} />;
}

// Presentational (dumb) — receives props only
function LockInButton({ isLocked, isPending, onLockIn }: Props) { ... }
```

### Key Files

| Purpose | Location |
|---------|----------|
| Slice (types co-located) | `src/stores/slices/scriptureReadingSlice.ts` |
| IndexedDB service | `src/services/scriptureReadingService.ts` |
| Broadcast hook | `src/hooks/useScriptureBroadcast.ts` |
| Motion config (global) | `src/hooks/useMotionConfig.ts` |
| DB config (shared) | `src/services/dbConfig.ts` |
| Migration | `supabase/migrations/20260125_scripture_reading.sql` |

### Scripture-Specific Patterns

**Error Handling:**
```typescript
enum ScriptureErrorCode {
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SYNC_FAILED = 'SYNC_FAILED',
}
```

**Loading States (explicit booleans):**
```typescript
interface ScriptureReadingState {
  isLoading: boolean;
  isPendingLockIn: boolean;
  isPendingReflection: boolean;
  isSyncing: boolean;
}
```

**Broadcast Event Naming:** `snake_case` (e.g., `state_updated`, `presence_update`)

**Motion Config Hook:**
```typescript
import { useReducedMotion } from 'framer-motion';
export function useMotionConfig() {
  const shouldReduceMotion = useReducedMotion();
  return {
    fade: shouldReduceMotion ? { duration: 0 } : { duration: 0.3 },
    spring: shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 100, damping: 15 },
  };
}
```

### Scripture Reading Anti-Patterns

**Never:**
- Put RPCs in `supabase/functions/` (use migrations)
- Use `postgres_changes` for real-time (RLS blocks; use Broadcast)
- Skip `expected_version` on mutations (causes race conditions)
- Fetch data in presentational components (use containers)
- Hardcode IndexedDB version in services (use shared `dbConfig.ts`)

**Always:**
- Co-locate types with `scriptureReadingSlice.ts`
- Use `scripture_` prefix for RPCs
- Pass data to components via props
- Check `version > localVersion` before applying broadcasts

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Match existing patterns in the codebase

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

---

*Last Updated: 2026-01-26*
