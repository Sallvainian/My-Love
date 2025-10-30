# Epic Technical Specification: Foundation & Core Fixes

Date: 2025-10-30
Author: Frank
Epic ID: 1
Status: Draft

---

## Overview

Epic 1 addresses critical technical debt and foundational issues in the My Love PWA that prevent it from being production-ready. The v0.1.0 prototype successfully validated the core concept through rapid vibe-coding, but introduced persistence bugs, unnecessary onboarding friction, and code quality issues that must be resolved before feature expansion.

This epic delivers a stable, production-ready foundation by fixing Zustand persist middleware configuration (FR001-FR003), eliminating the onboarding flow through pre-configured relationship data (FR004-FR005), ensuring IndexedDB operations work correctly with service workers, addressing critical code smells and architectural inconsistencies, and hardening the build/deployment pipeline. Upon completion, the app will reliably persist data across browser sessions, provide a frictionless experience for the single intended user (your girlfriend), and maintain clean, maintainable code ready for Epic 2-4 feature additions.

## Objectives and Scope

**In Scope:**
- Fix Zustand persist middleware to correctly save/restore state from LocalStorage (Story 1.2)
- Ensure IndexedDB transactions complete successfully when service worker is active (Story 1.3)
- Remove Onboarding component from render path and pre-configure relationship data via environment variables (Story 1.4)
- Conduct technical debt audit documenting code smells, architectural issues, and unused dependencies (Story 1.1)
- Refactor critical code quality issues: TypeScript strict mode compliance, error boundaries, unused code removal (Story 1.5)
- Harden build process with environment variable injection and deployment smoke tests (Story 1.6)
- Maintain 100% feature parity - no regressions in existing functionality
- Document all architectural decisions in technical-decisions.md

**Out of Scope:**
- New feature development (photo gallery, mood tracking, countdowns) - deferred to Epics 2-4
- Backend integration or external service setup - not needed for foundation work
- UI/UX redesigns - focus is stability and code quality, not visual changes
- Performance optimization beyond fixing blocking bugs - defer to later sprints
- Migration from Tailwind CSS v3 (current stable version working correctly)

## System Architecture Alignment

This epic aligns with and strengthens the existing architecture documented in [architecture.md](./architecture.md):

**Component Architecture:** Maintains component-based SPA pattern; removes Onboarding component after Story 1.4, simplifies App.tsx render logic to always show DailyMessage for single-user deployment.

**State Management:** Fixes Zustand persist middleware (currently broken) to correctly implement the documented "partialize" strategy that persists only critical state (settings, isOnboarded, messageHistory, moods) to LocalStorage while keeping transient state (messages, photos, currentMessage, isLoading, error) in memory only.

**Data Layer:** Ensures IndexedDB operations (via idb 8.0.3) work reliably with Workbox service worker caching strategy. No schema changes required - fixes operational reliability.

**PWA Service Worker:** No changes to caching strategies or manifest configuration. Ensures IndexedDB transactions don't conflict with CacheFirst strategy for app shell assets.

**Build/Deploy:** Hardens existing Vite build → gh-pages deployment pipeline with environment variable support for pre-configured relationship data and automated smoke testing.

**Constraints:**
- Must maintain offline-first capability (FR002, NFR002)
- No breaking changes to existing data schemas (backward compatibility)
- Preserve all 4 existing themes and animation behaviors
- Keep bundle size under 200KB gzipped target

## Detailed Design

### Services and Modules

| Module/Service | Responsibilities | Input | Output | Owner/Story |
|----------------|------------------|-------|--------|-------------|
| **zustand store (useAppStore)** | State management with persistence | User actions, DB queries | State updates, LocalStorage writes | Story 1.2 |
| **persist middleware** | Serialize/deserialize state to/from LocalStorage | Store state changes | Persisted JSON in LocalStorage | Story 1.2 |
| **storageService (idb wrapper)** | IndexedDB CRUD operations | Photo/message data | Promise<result> | Story 1.3 |
| **App.tsx** | Root component, initialization flow | None | Rendered UI tree | Story 1.4, 1.5 |
| **DailyMessage component** | Main app view with message display | currentMessage from store | Message card UI | No changes |
| **Environment config** | Build-time configuration injection | .env variables | Runtime constants | Story 1.4, 1.6 |
| **Build pipeline** | TypeScript → Vite bundle → PWA generation | Source files | dist/ output | Story 1.6 |
| **Deployment script** | GitHub Pages deploy with smoke tests | dist/ directory | Live URL + validation | Story 1.6 |

**Key Service Interactions:**
- App.tsx → useAppStore.initializeApp() → storageService.init() → IndexedDB open
- User action → Component → Store action → storageService → IndexedDB + LocalStorage
- Build process → inject env vars → bundled constants available at runtime

### Data Models and Contracts

**No schema changes required** - Epic 1 fixes operational issues without modifying existing data models.

**Existing Data Models** (from [data-models.md](./data-models.md)):

```typescript
// Settings (persisted to LocalStorage via Zustand)
interface Settings {
  partnerName: string;          // Pre-configured at build time (Story 1.4)
  relationshipStartDate: string; // Pre-configured at build time (Story 1.4)
  theme: ThemeName;
  notificationsEnabled: boolean;
  notificationTime: string;
}

// Zustand Store State (partial persistence)
interface AppState {
  // PERSISTED via persist middleware (Story 1.2 fixes)
  settings: Settings | null;
  isOnboarded: boolean;          // Will be true by default (Story 1.4)
  messageHistory: MessageHistory;
  moods: MoodEntry[];

  // IN-MEMORY ONLY (not persisted)
  messages: Message[];           // Loaded from IndexedDB on init
  photos: Photo[];               // Loaded from IndexedDB on demand
  currentMessage: Message | null;
  isLoading: boolean;
  error: string | null;
}

// IndexedDB Schema (no changes)
interface MyLoveDB {
  photos: {
    key: number;
    value: Photo;
    indexes: { 'by-date': Date }
  };
  messages: {
    key: number;
    value: Message;
    indexes: { 'by-category': string; 'by-date': Date }
  };
}
```

**Environment Variables** (Story 1.4):
```typescript
// .env.production (not committed)
VITE_PARTNER_NAME=<girlfriend_name>
VITE_RELATIONSHIP_START_DATE=YYYY-MM-DD

// Injected at build time → available as:
import.meta.env.VITE_PARTNER_NAME
import.meta.env.VITE_RELATIONSHIP_START_DATE
```

**Migration Strategy:**
- Story 1.2: Fix persist middleware without changing data shape
- Story 1.4: Initialize settings from env vars on first load, preserve if already exists
- No user data migration required - backward compatible

### APIs and Interfaces

**No external APIs** - all functionality is client-side.

**Internal Module Interfaces:**

**1. StorageService (IndexedDB wrapper)**
```typescript
// src/services/storageService.ts
class StorageService {
  // Initialization (Story 1.3 fixes)
  init(): Promise<IDBDatabase>

  // Message operations (no changes)
  getMessages(): Promise<Message[]>
  addMessage(message: Omit<Message, 'id'>): Promise<number>
  updateMessage(id: number, updates: Partial<Message>): Promise<void>
  toggleFavorite(id: number): Promise<void>

  // Photo operations (future - no changes in Epic 1)
  getPhotos(): Promise<Photo[]>
  addPhoto(photo: Omit<Photo, 'id'>): Promise<number>
  deletePhoto(id: number): Promise<void>
}
```

**2. Zustand Store Actions (Story 1.2 fixes)**
```typescript
// src/store/useAppStore.ts
interface AppStore extends AppState {
  // Initialization (fix in Story 1.2, 1.3)
  initializeApp(): Promise<void>  // Fix: ensure persist rehydrates before DB load

  // Settings (Story 1.4 changes)
  setSettings(settings: Settings): void
  updateSettings(updates: Partial<Settings>): void

  // No changes to other actions
  setOnboarded(value: boolean): void
  loadMessages(): Promise<void>
  addMessage(text: string, category: MessageCategory): Promise<void>
  toggleFavorite(messageId: number): Promise<void>
  updateCurrentMessage(): void
  // ... other actions unchanged
}
```

**3. Environment Configuration Interface (Story 1.4, 1.6)**
```typescript
// src/config/constants.ts (new file)
export const APP_CONFIG = {
  defaultPartnerName: import.meta.env.VITE_PARTNER_NAME || '',
  defaultStartDate: import.meta.env.VITE_RELATIONSHIP_START_DATE || '',
  isPreConfigured: Boolean(import.meta.env.VITE_PARTNER_NAME),
} as const;
```

**4. Error Boundary Interface (Story 1.5)**
```typescript
// src/components/ErrorBoundary.tsx (new component)
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void
  render(): React.ReactNode
}
```

**Browser APIs Used:**
- IndexedDB API (via idb library) - Story 1.3 ensures compatibility with service worker
- LocalStorage API - Story 1.2 fixes persist middleware usage
- Service Worker API - No changes, verify compatibility only

### Workflows and Sequencing

**Story Execution Sequence:** 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 (sequential, each builds on previous)

**Critical Workflow 1: Application Initialization (Fixed in Stories 1.2, 1.3)**

```
User opens app
    ↓
App.tsx mounts
    ↓
useEffect calls initializeApp()
    ↓
[Story 1.2 FIX] Wait for Zustand persist rehydration
    ↓
[Story 1.3 FIX] Initialize IndexedDB (ensure no SW conflicts)
    ↓
Load messages from IndexedDB
    ↓
If empty → populate with 100 default messages
    ↓
Update currentMessage based on date
    ↓
[Story 1.4 FIX] Check if settings exist
    ↓
If NOT exists AND isPreConfigured → inject env vars
    ↓
Set isOnboarded = true (skip onboarding)
    ↓
Set isLoading = false
    ↓
Render DailyMessage component
```

**Critical Workflow 2: State Persistence (Story 1.2 Fix)**

```
User performs action (e.g., favorite message)
    ↓
Component calls store action: toggleFavorite(messageId)
    ↓
Action updates in-memory state: messages[id].isFavorite = true
    ↓
Action calls storageService.toggleFavorite(messageId)
    ↓
IndexedDB transaction updates message record
    ↓
[Story 1.2 FIX] Zustand persist middleware detects state change
    ↓
Middleware serializes ONLY partialize state to JSON
    ↓
Write to LocalStorage key: 'my-love-storage'
    ↓
On next app load → persist rehydrates state from LocalStorage
    ↓
In-memory state restored, IndexedDB still canonical for messages/photos
```

**Critical Workflow 3: Build & Deploy (Story 1.6)**

```
Developer runs: npm run deploy
    ↓
predeploy hook triggers: npm run build
    ↓
TypeScript compilation: tsc -b (type checking)
    ↓
[Story 1.6 ADD] Verify .env.production exists with required vars
    ↓
Vite build process:
  - Bundle React app with env var injection
  - Process Tailwind CSS
  - Generate PWA assets (SW, manifest)
  - Minify and hash assets
    ↓
Output to dist/ directory
    ↓
[Story 1.6 ADD] Run smoke test script:
  - Verify index.html exists
  - Verify manifest.webmanifest exists
  - Verify sw.js contains expected routes
  - Verify env vars injected (grep bundle for VITE_ constants)
    ↓
If smoke tests pass → gh-pages deploys dist/ to gh-pages branch
    ↓
GitHub Pages serves updated site
    ↓
[Story 1.6 ADD] Post-deploy validation:
  - curl live URL, verify 200 response
  - Check manifest loads
  - Verify SW registers
```

**Error Handling Sequence (Story 1.5):**

```
Component renders
    ↓
Error thrown (e.g., null reference, network failure)
    ↓
[Story 1.5 ADD] ErrorBoundary catches error
    ↓
Display fallback UI with error message
    ↓
Log error to console with stack trace
    ↓
User sees "Something went wrong" with retry button
    ↓
Click retry → ErrorBoundary resets state → re-render
```

## Non-Functional Requirements

### Performance

**Targets** (from NFR001):
- App load time: < 2 seconds on 3G connection
- Animations: 60fps (16.67ms frame budget)
- Bundle size: < 200KB gzipped (currently ~150KB baseline)

**Epic 1 Performance Considerations:**

**Story 1.2 (Zustand Persist Fix):**
- LocalStorage read/write must not block UI thread
- Persist middleware should debounce writes (avoid thrashing on rapid state changes)
- Target: < 10ms for state serialization + LocalStorage write
- Hydration on app load: < 50ms to restore persisted state

**Story 1.3 (IndexedDB/SW Compatibility):**
- IndexedDB transactions must remain async (non-blocking)
- Service worker should not intercept IndexedDB operations
- Target: Message load from IndexedDB < 100ms for 365 messages
- Photo operations (future) should lazy load, not affect initial render

**Story 1.5 (Refactoring):**
- Remove unused dependencies to reduce bundle size
- Tree-shaking must eliminate dead code
- No performance regressions from refactoring (baseline: 150KB gzipped)
- Error boundaries should have minimal overhead (< 1ms render impact)

**Story 1.6 (Build Optimization):**
- Vite build should produce optimal chunks
- Environment variable injection adds < 1KB to bundle
- Smoke tests should complete in < 30 seconds
- Deploy process total time: < 5 minutes from `npm run deploy` to live

**Monitoring:**
- Use Chrome DevTools Performance tab for profiling
- Lighthouse CI score must remain 100 for PWA category
- Bundle Analyzer to verify no bloat from refactoring

### Security

**Architecture Security** (from NFR005):
- No backend - all data stored client-side (privacy by design)
- HTTPS enforced via GitHub Pages (required for PWA features)
- No third-party analytics or tracking

**Epic 1 Security Considerations:**

**Story 1.4 (Pre-Configuration):**
- **CRITICAL:** `.env.production` file must be gitignored (never commit sensitive data)
- Environment variables only contain non-sensitive data: partner name, relationship date (not secrets)
- Document in deployment guide: create `.env.production` locally before deploy
- No secrets or API keys involved (client-side only app)

**Story 1.5 (Code Quality):**
- TypeScript strict mode prevents type-related vulnerabilities
- React automatic XSS protection (content escaping by default)
- Error boundaries prevent error stack traces leaking sensitive state
- Input sanitization: not needed yet (no user text input in Epic 1, defer to Epic 2)

**Story 1.6 (Build Hardening):**
- Verify smoke tests don't expose sensitive data in logs
- GitHub Actions deployment secrets (gh-pages token) already secured
- CSP headers: defer to future (GitHub Pages defaults sufficient for Epic 1)

**Data Privacy:**
- LocalStorage and IndexedDB data remains on user's device only
- No network requests except for initial app load (static assets)
- Service worker cache is device-local, not synced

**Threat Model:**
- **Out of scope:** Multi-user authentication (single-user app)
- **Out of scope:** Data encryption at rest (device security is user's responsibility)
- **Mitigated:** XSS via React escaping + TypeScript strict typing
- **Accepted risk:** Physical device access (user must secure their own device)

### Reliability/Availability

**Targets** (from NFR002, NFR003):
- Offline functionality: 100% of features work offline after initial load (except future mood sync/poke features in Epic 4)
- Browser compatibility: Latest 2 versions of Chrome, Firefox, Safari, Edge
- Zero data loss on browser refresh, tab close, or 24-hour gap

**Epic 1 Reliability Improvements:**

**Story 1.2 (Persistence Fix) - CRITICAL:**
- **Problem:** Current bug causes data loss on browser refresh
- **Solution:** Fix persist middleware to correctly save state before page unload
- **Test:** Favorite message → close tab → reopen → verify favorite persists
- **Test:** Change theme → close browser entirely → reopen next day → verify theme persists
- **Graceful degradation:** If LocalStorage quota exceeded, log error but don't crash app

**Story 1.3 (IndexedDB/SW Fix) - CRITICAL:**
- **Problem:** Service worker may interfere with IndexedDB transactions
- **Solution:** Ensure SW cache strategy doesn't block DB operations
- **Test:** Go offline → favorite message → go online → verify IndexedDB updated correctly
- **Test:** Add 365 messages → service worker updates → verify DB integrity
- **Fallback:** If IndexedDB fails to open, app should still render with in-memory messages

**Story 1.5 (Error Boundaries):**
- **Resilience:** ErrorBoundary prevents full app crash from component errors
- **Recovery:** User can retry failed operation without losing entire session
- **Logging:** Console errors provide debugging info without breaking UX

**Story 1.6 (Deployment Reliability):**
- **Smoke tests:** Catch deployment failures before users see broken builds
- **Rollback:** GitHub Pages keeps history, can revert to previous gh-pages commit
- **Validation:** Post-deploy checks ensure live site is functional

**Failure Scenarios & Handling:**

| Failure | Impact | Mitigation | Story |
|---------|--------|------------|-------|
| LocalStorage quota exceeded | Settings/favorites won't persist | Show user warning, continue with defaults | 1.2 |
| IndexedDB open fails | Messages/photos unavailable | Load default 100 messages, show error banner | 1.3 |
| Service worker fails to register | No offline support | App still works online, log warning | 1.3 |
| React component error | UI crashes | ErrorBoundary shows fallback, log error | 1.5 |
| Build smoke test fails | Bad deploy prevented | Halt deployment, notify developer | 1.6 |
| GitHub Pages down | App unavailable | Users see GitHub's error page (out of our control) | N/A |

### Observability

**No external monitoring** - client-side debugging only (aligns with no-backend architecture).

**Epic 1 Observability Additions:**

**Story 1.2 (Persist Debugging):**
- Console log on persist middleware init: "Zustand persist hydrated from LocalStorage"
- Error logging if LocalStorage write fails (quota exceeded, private browsing mode)
- DevTools Application tab inspection: view `my-love-storage` key contents

**Story 1.3 (IndexedDB Monitoring):**
- Console log on DB init: "IndexedDB 'my-love-db' version 1 opened successfully"
- Error logging for DB transaction failures with operation details
- DevTools Application tab: inspect `my-love-db` object stores (photos, messages)

**Story 1.5 (Error Boundary Logging):**
- ErrorBoundary logs caught errors with component stack to console
- Include error message, stack trace, and component tree
- No external error reporting (Sentry, etc.) - keep it simple for single-user app

**Story 1.6 (Build/Deploy Observability):**
- Build script logs: TypeScript compilation status, bundle size, asset count
- Smoke test output: pass/fail status for each check
- Post-deploy validation: HTTP status codes, SW registration status
- GitHub Actions logs (if automated): full deploy pipeline visibility

**Development Debugging Tools:**
- Chrome DevTools Sources tab: Source maps enabled for debugging
- React DevTools: Inspect component state and props
- Application tab: View LocalStorage, IndexedDB, Service Worker, Manifest
- Network tab: Verify service worker caching (offline mode testing)
- Performance tab: Profile persist middleware and IndexedDB operations

**Production Monitoring (User-Facing):**
- No user analytics or telemetry (privacy-first)
- No crash reporting to external services
- Users can open browser console to see error logs if they encounter issues
- Future: Consider opt-in local error log export for support purposes (Epic 4+)

**Key Signals to Monitor:**

| Signal | Location | Purpose | Story |
|--------|----------|---------|-------|
| Persist hydration success/fail | Console log | Verify LocalStorage restore | 1.2 |
| IndexedDB init success/fail | Console log | Verify DB availability | 1.3 |
| Service worker registration | Console log | Verify PWA features active | 1.3 |
| Error boundary catches | Console error log | Track component failures | 1.5 |
| Build bundle size | Build output | Prevent bloat | 1.6 |
| Smoke test results | Deploy script output | Catch bad deploys | 1.6 |

## Dependencies and Integrations

**External Dependencies** (from [package.json](../package.json)):

### Production Dependencies

| Package | Version | Purpose | Epic 1 Impact |
|---------|---------|---------|---------------|
| **react** | 19.1.1 | UI framework | No changes |
| **react-dom** | 19.1.1 | React DOM renderer | No changes |
| **zustand** | 5.0.8 | State management | Story 1.2 fixes persist usage |
| **idb** | 8.0.3 | IndexedDB wrapper | Story 1.3 ensures SW compatibility |
| **framer-motion** | 12.23.24 | Animations | No changes |
| **lucide-react** | 0.548.0 | Icon library | No changes |
| **workbox-window** | 7.3.0 | Service worker client | Story 1.3 verifies no conflicts |

### Development Dependencies

| Package | Version | Purpose | Epic 1 Impact |
|---------|---------|---------|---------------|
| **typescript** | 5.9.3 | Type checking | Story 1.5 enforces strict mode |
| **vite** | 7.1.7 | Build tool | Story 1.6 env var injection |
| **tailwindcss** | 3.4.18 | CSS framework | No changes (v3 working correctly) |
| **eslint** | 9.36.0 | Linting | Story 1.5 reduces warnings to zero |
| **vite-plugin-pwa** | 1.1.0 | PWA generation | Story 1.6 verifies manifest/SW |
| **gh-pages** | 6.3.0 | Deployment | Story 1.6 adds smoke tests |
| **autoprefixer** | 10.4.21 | CSS vendor prefixing | No changes |
| **postcss** | 8.5.6 | CSS processing | No changes |

**Dependencies to Remove** (Story 1.5):
- Audit for unused packages (none identified in initial scan, verify during Story 1.1 audit)

**No New Dependencies Added** - Epic 1 uses existing stack only.

### Integration Points

**Browser APIs:**
- **LocalStorage API** - Story 1.2 fixes persist middleware integration
- **IndexedDB API** - Story 1.3 ensures service worker compatibility
- **Service Worker API** - Story 1.3 verifies registration, no code changes
- **Web Share API** - No changes (existing DailyMessage feature)
- **Notification API** - No changes (permission requested in onboarding, unused after removal)

**Build-Time Integrations:**
- **Vite Environment Variables** - Story 1.4, 1.6 adds `.env.production` support
- **TypeScript Compiler** - Story 1.5 enforces strict mode
- **ESLint** - Story 1.5 eliminates warnings
- **PostCSS + Tailwind** - No changes to CSS pipeline
- **Workbox (via vite-plugin-pwa)** - No configuration changes

**Deployment Integrations:**
- **GitHub Pages** - Story 1.6 adds smoke test validation
- **gh-pages CLI** - No changes to deployment mechanism
- **Git hooks** - Future consideration (not in Epic 1 scope)

**No External Services:**
- No backend APIs
- No CDN dependencies (all assets bundled)
- No analytics or monitoring services
- No payment processors
- No authentication providers

### Version Constraints

**Node.js:** >= 18.0.0 (required for React 19)
**npm:** >= 9.0.0 (or yarn/pnpm equivalent)
**Browser Targets:**
- Chrome/Edge: >= 120 (last 2 versions)
- Firefox: >= 120 (last 2 versions)
- Safari: >= 17 (last 2 versions)
- Mobile Safari: >= 17
- Chrome Mobile: >= 120

**Compatibility Notes:**
- React 19 requires modern JavaScript features (ES2022+)
- IndexedDB v2 API (supported in all target browsers)
- Service Worker API (HTTPS required, provided by GitHub Pages)
- LocalStorage API (universally supported)

## Acceptance Criteria (Authoritative)

These acceptance criteria are extracted from [epics.md](./epics.md) Epic 1 and serve as the authoritative source for story completion validation.

### Story 1.1: Technical Debt Audit & Refactoring Plan

**AC-1.1.1** Complete code review identifying: code smells, architectural inconsistencies, missing error handling, unused dependencies
**AC-1.1.2** Document findings in technical-decisions.md
**AC-1.1.3** Create prioritized refactoring checklist (critical vs. nice-to-have)
**AC-1.1.4** Estimate effort for each refactoring item
**AC-1.1.5** No code changes in this story - pure analysis

### Story 1.2: Fix Zustand Persist Middleware Configuration

**AC-1.2.1** Zustand persist middleware correctly saves state to LocalStorage
**AC-1.2.2** State hydration works on app initialization without data loss
**AC-1.2.3** Storage partializer only persists necessary state (not transient UI state)
**AC-1.2.4** Handle storage quota exceeded errors gracefully
**AC-1.2.5** Test persistence across browser refresh, tab close/reopen, and 24-hour gap
**AC-1.2.6** All existing features continue working (no regression)

### Story 1.3: IndexedDB Service Worker Cache Fix

**AC-1.3.1** IndexedDB operations complete successfully even when offline
**AC-1.3.2** Service worker doesn't interfere with IndexedDB transactions
**AC-1.3.3** Cache strategy updated if needed for IndexedDB compatibility
**AC-1.3.4** Test: Add photo offline, go online, verify photo persists
**AC-1.3.5** Test: Favorite message, restart app, verify favorite persists

### Story 1.4: Remove Onboarding Flow & Pre-Configure Relationship Data

**AC-1.4.1** Create environment variables or config file for: partner name, relationship start date
**AC-1.4.2** Remove Onboarding component from render path
**AC-1.4.3** App initializes with pre-configured data on first load
**AC-1.4.4** Relationship duration calculates correctly from pre-configured start date
**AC-1.4.5** Settings allow editing name/date if needed (edge case)
**AC-1.4.6** No onboarding UI visible at any point in normal flow

### Story 1.5: Critical Refactoring - Code Quality Improvements

**AC-1.5.1** Address all "critical" items from Story 1.1 refactoring checklist
**AC-1.5.2** Ensure TypeScript strict mode compliance (no `any` types without justification)
**AC-1.5.3** Add error boundaries for graceful error handling
**AC-1.5.4** Remove unused dependencies and dead code
**AC-1.5.5** ESLint warnings reduced to zero
**AC-1.5.6** All existing features continue working (regression testing)

### Story 1.6: Build & Deployment Configuration Hardening

**AC-1.6.1** Vite build process includes environment variable injection for relationship data
**AC-1.6.2** GitHub Pages deployment correctly serves PWA with pre-configured data
**AC-1.6.3** Service worker generation works correctly in production build
**AC-1.6.4** Build produces optimized, minified bundles
**AC-1.6.5** Deployment script includes smoke test verification
**AC-1.6.6** Document deployment process in README or deployment guide

**Total Acceptance Criteria:** 30 atomic, testable criteria across 6 stories

## Traceability Mapping

This table maps acceptance criteria to technical specifications, impacted components, and test approaches.

| AC ID | Spec Section | Component/Module | Test Approach |
|-------|-------------|------------------|---------------|
| **AC-1.1.1** | Overview | All source files | Manual code review with checklist |
| **AC-1.1.2** | Detailed Design | docs/technical-decisions.md | Verify document exists and contains findings |
| **AC-1.1.3** | Risks | technical-decisions.md | Review checklist structure (critical/nice-to-have) |
| **AC-1.1.4** | Risks | technical-decisions.md | Verify effort estimates provided |
| **AC-1.1.5** | Overview | N/A | Git diff confirms no code changes |
| **AC-1.2.1** | Data Models, Workflows | useAppStore, persist middleware | Unit test: modify state → verify LocalStorage write |
| **AC-1.2.2** | Workflows | useAppStore.initializeApp() | Integration test: refresh browser → verify state restored |
| **AC-1.2.3** | Data Models | persist middleware config | Unit test: verify partializer only saves specified keys |
| **AC-1.2.4** | NFR Reliability | persist middleware error handling | Unit test: mock quota exceeded → verify graceful handling |
| **AC-1.2.5** | Workflows | Full app | Manual test: favorite → close tab → reopen (3 scenarios) |
| **AC-1.2.6** | Overview | All features | Regression test suite (manual or automated) |
| **AC-1.3.1** | APIs, Workflows | storageService, IndexedDB | Integration test: offline mode → IndexedDB operations |
| **AC-1.3.2** | NFR Reliability | storageService, service worker | Integration test: SW active → IndexedDB transaction succeeds |
| **AC-1.3.3** | System Architecture | vite.config.ts, SW config | Review SW cache strategy code |
| **AC-1.3.4** | Workflows | Photo storage (future) | Manual test: offline photo add → online verification |
| **AC-1.3.5** | Workflows | Message favoriting | Manual test: favorite → restart → verify persists |
| **AC-1.4.1** | Data Models, APIs | .env.production, constants.ts | Verify env vars exist and loaded correctly |
| **AC-1.4.2** | Services | App.tsx | Code review: Onboarding component removed from render |
| **AC-1.4.3** | Workflows | useAppStore.initializeApp() | Integration test: first load → settings populated from env |
| **AC-1.4.4** | Services | DailyMessage, relationship duration logic | Unit test: verify duration calculation from env start date |
| **AC-1.4.5** | Data Models | Settings UI (future) | Manual test: edit settings → verify changes persist |
| **AC-1.4.6** | Services | App.tsx, Onboarding component | Manual test: fresh install → no onboarding shown |
| **AC-1.5.1** | Detailed Design | Multiple files per checklist | Code review: verify critical items addressed |
| **AC-1.5.2** | NFR Security | tsconfig.json, all .ts files | TypeScript compiler: strict mode enabled, no errors |
| **AC-1.5.3** | APIs | ErrorBoundary component | Unit test: throw error → verify boundary catches |
| **AC-1.5.4** | Dependencies | package.json, unused files | npm audit, code search for unused imports |
| **AC-1.5.5** | Overview | All source files | ESLint: run lint command → 0 warnings |
| **AC-1.5.6** | NFR Reliability | All features | Full regression test suite |
| **AC-1.6.1** | APIs, Workflows | vite.config.ts, build script | Build test: verify env vars in bundle |
| **AC-1.6.2** | System Architecture | GitHub Pages, dist/ output | Deploy test: access live URL → verify functionality |
| **AC-1.6.3** | System Architecture | vite-plugin-pwa config | Build test: verify sw.js generated correctly |
| **AC-1.6.4** | NFR Performance | Vite build output | Build test: verify bundle size < 200KB gzipped |
| **AC-1.6.5** | Workflows | deploy script, smoke tests | Automated test: smoke tests pass before deploy |
| **AC-1.6.6** | Overview | README.md or docs/ | Documentation review: deployment process documented |

**Coverage Summary:**
- **Overview/Scope**: 4 ACs
- **System Architecture**: 4 ACs
- **Data Models**: 5 ACs
- **APIs/Interfaces**: 5 ACs
- **Workflows**: 8 ACs
- **NFR Performance**: 1 AC
- **NFR Security**: 1 AC
- **NFR Reliability**: 5 ACs
- **Dependencies**: 1 AC
- **Risks**: 2 ACs

## Risks, Assumptions, Open Questions

### Risks

**R1: Zustand Persist Middleware Complexity (HIGH)**
- **Risk:** Fixing persist middleware may reveal deeper architectural issues with state management
- **Impact:** Story 1.2 could take longer than estimated; may require refactoring store structure
- **Mitigation:** Story 1.1 audit will identify state management issues early; have backup plan to simplify state if needed
- **Owner:** Story 1.2

**R2: Service Worker/IndexedDB Interference (MEDIUM)**
- **Risk:** Service worker cache strategy may fundamentally conflict with IndexedDB operations
- **Impact:** May require service worker reconfiguration or IndexedDB transaction retries
- **Mitigation:** Research Workbox + IndexedDB best practices in Story 1.1; test offline scenarios thoroughly
- **Owner:** Story 1.3

**R3: Pre-Configuration Deployment Complexity (MEDIUM)**
- **Risk:** Environment variable injection at build time may fail in GitHub Actions or require additional configuration
- **Impact:** Deployment pipeline breaks; may need alternative config approach
- **Mitigation:** Test .env.production locally before pushing; document fallback to config.json if needed
- **Owner:** Story 1.6

**R4: TypeScript Strict Mode Migration Effort (MEDIUM)**
- **Risk:** Enabling strict mode may reveal hundreds of type errors in vibe-coded prototype
- **Impact:** Story 1.5 could exceed time estimate; may need to defer some fixes
- **Mitigation:** Story 1.1 audit includes strict mode dry-run; prioritize critical errors only
- **Owner:** Story 1.5

**R5: Regression Risk from Refactoring (HIGH)**
- **Risk:** Code quality improvements in Story 1.5 may introduce bugs or break existing features
- **Impact:** Features that worked in v0.1.0 stop working after Epic 1
- **Mitigation:** Manual regression test checklist before each story completion; ErrorBoundary catches crashes
- **Owner:** Story 1.5, 1.6

**R6: Browser Compatibility Issues (LOW)**
- **Risk:** Fixes may work in Chrome but break in Safari or Firefox
- **Impact:** Users on non-Chrome browsers experience issues
- **Mitigation:** Test on all target browsers (Chrome, Firefox, Safari) for Story 1.2, 1.3, 1.4
- **Owner:** All stories

### Assumptions

**A1: Onboarding Flow Is Unnecessary**
- **Assumption:** Your girlfriend will never need to set up the app herself; pre-configuration is sufficient
- **Validation:** Confirmed by PRD requirement FR004
- **Impact if wrong:** May need to add admin settings panel in future epic

**A2: LocalStorage Quota Is Sufficient**
- **Assumption:** LocalStorage 5-10MB quota is enough for settings, messageHistory, and moods (not photos/messages)
- **Validation:** Settings + messageHistory ≈ 50KB estimated
- **Impact if wrong:** Need to implement quota management or move to IndexedDB

**A3: No Multi-Device Sync Needed**
- **Assumption:** Data stays local to each device; no backend sync in Epic 1
- **Validation:** PRD explicitly excludes cross-device sync
- **Impact if wrong:** Out of scope for Epic 1; defer to Epic 4 (mood sync only)

**A4: Current Tech Stack Is Optimal**
- **Assumption:** React 19, Zustand, Tailwind v3 are correct choices; no major replacements needed
- **Validation:** Architecture review in Story 1.1 will validate this
- **Impact if wrong:** Major refactor required (very unlikely)

**A5: GitHub Pages Hosting Is Reliable**
- **Assumption:** GitHub Pages uptime is acceptable for personal PWA use
- **Validation:** GitHub Pages SLA is 99.9%+
- **Impact if wrong:** Consider alternative hosting (Vercel, Netlify) - future consideration

### Open Questions

**Q1: Should We Add Automated Tests in Epic 1?** (Priority: HIGH)
- **Question:** Story 1.5 focuses on code quality, but no acceptance criteria for unit tests. Should we add tests now or defer?
- **Impact:** Adding tests increases Epic 1 effort but reduces regression risk
- **Recommendation:** Add basic tests for Story 1.2 (persist middleware) and Story 1.3 (IndexedDB) only; defer comprehensive test suite to future epic
- **Decision needed by:** Story 1.1 completion

**Q2: What Is "Critical" Priority for Refactoring Checklist?** (Priority: MEDIUM)
- **Question:** Story 1.1 creates prioritized checklist, but criteria for "critical" vs "nice-to-have" not defined
- **Impact:** May defer important refactoring or waste time on low-value changes
- **Recommendation:** Critical = blocks Epic 2-4 features OR high crash risk; Nice-to-have = code style, minor optimizations
- **Decision needed by:** Story 1.1 completion

**Q3: Should Onboarding Component Be Deleted or Hidden?** (Priority: LOW)
- **Question:** Story 1.4 removes from render path, but should we delete the component files entirely?
- **Impact:** Keeping files adds minimal bundle size; deleting prevents future reuse
- **Recommendation:** Delete Onboarding component files in Story 1.5 (dead code removal)
- **Decision needed by:** Story 1.4 completion

**Q4: How to Handle Users Who Already Completed Onboarding?** (Priority: MEDIUM)
- **Question:** If someone already has settings in LocalStorage from onboarding, should Story 1.4 override with env vars?
- **Impact:** May overwrite user's custom settings if they edited name/date
- **Recommendation:** Only inject env vars if `settings === null`; preserve existing settings if present
- **Decision needed by:** Story 1.4 implementation

**Q5: Should We Implement Build-Time Smoke Tests or Runtime?** (Priority: HIGH)
- **Question:** Story 1.6 adds smoke tests, but should they run post-build (on dist/) or post-deploy (on live URL)?
- **Impact:** Post-build catches issues faster; post-deploy validates actual deployment
- **Recommendation:** Both - post-build checks files/bundles, post-deploy validates live site
- **Decision needed by:** Story 1.6 planning

## Test Strategy Summary

### Test Levels

**Manual Testing (Primary Approach for Epic 1):**
- **Rationale:** Rapid prototyping phase; automated test infrastructure not yet established
- **Coverage:** All acceptance criteria validated manually using test scenarios
- **Tools:** Browser DevTools, manual browser testing across Chrome/Firefox/Safari
- **Documentation:** Test checklist created during Story 1.1, executed after each story

**Unit Testing (Selective):**
- **Scope:** Story 1.2 (persist middleware logic), Story 1.3 (IndexedDB error handling)
- **Framework:** Consider Vitest (matches Vite ecosystem) - decision in Story 1.1
- **Coverage target:** 80%+ for critical persistence logic only
- **Not in scope:** Full component testing (defer to future epic)

**Integration Testing (Manual):**
- **Scope:** Full app initialization flow, offline mode, state persistence across sessions
- **Scenarios:** Browser refresh, tab close/reopen, 24-hour gap, offline → online transition
- **Tools:** Chrome DevTools Network throttling, Application tab (LocalStorage/IndexedDB)

**Build/Deploy Testing (Automated):**
- **Scope:** Story 1.6 smoke tests (post-build validation)
- **Checks:** dist/ file existence, bundle size, env var injection, manifest validity
- **Tools:** Custom bash script or npm script in package.json

### Test Coverage by Story

**Story 1.1 (Audit):**
- No testing (analysis only)
- Deliverable: Test checklist for Stories 1.2-1.6

**Story 1.2 (Persist Fix):**
- Unit tests: persist middleware save/restore logic (8 test cases)
- Integration tests: Browser refresh preserves state (3 scenarios)
- Manual tests: AC-1.2.5 persistence across browser actions

**Story 1.3 (IndexedDB/SW Fix):**
- Unit tests: IndexedDB error handling (4 test cases)
- Integration tests: Offline IndexedDB operations (3 scenarios)
- Manual tests: AC-1.3.4, AC-1.3.5 offline photo/favorite persistence

**Story 1.4 (Pre-Configuration):**
- Integration tests: First load with env vars (2 scenarios)
- Manual tests: AC-1.4.6 no onboarding shown (3 user flows)
- Build tests: Verify env vars in bundle

**Story 1.5 (Refactoring):**
- Static analysis: TypeScript strict mode, ESLint (automated)
- Unit tests: ErrorBoundary component (3 test cases)
- Regression tests: Full manual test checklist from Story 1.1

**Story 1.6 (Build Hardening):**
- Smoke tests: Automated post-build checks (6 checks)
- Manual tests: Deploy to GitHub Pages, verify live site
- Performance tests: Bundle size validation

### Test Scenarios (Critical Paths)

**Scenario 1: Fresh Install with Pre-Configuration**
1. Clear all browser data (LocalStorage, IndexedDB)
2. Open app URL
3. Verify: No onboarding shown, DailyMessage renders, relationship duration correct
4. Verify: Settings populated from env vars (partner name, start date)
5. **Acceptance Criteria Validated:** AC-1.4.2, AC-1.4.3, AC-1.4.4, AC-1.4.6

**Scenario 2: State Persistence After Browser Refresh**
1. Favorite a message
2. Change theme to Ocean Dreams
3. Close tab
4. Reopen tab
5. Verify: Message still favorited, theme still Ocean Dreams
6. **Acceptance Criteria Validated:** AC-1.2.1, AC-1.2.2, AC-1.2.5

**Scenario 3: Offline Functionality**
1. Open app online
2. Switch network to offline (DevTools)
3. Favorite a message
4. Verify: Favorite action succeeds (IndexedDB write)
5. Switch back online
6. Refresh page
7. Verify: Favorite persists
8. **Acceptance Criteria Validated:** AC-1.3.1, AC-1.3.2, AC-1.3.5

**Scenario 4: Build and Deploy Pipeline**
1. Create .env.production with test values
2. Run: npm run deploy
3. Verify: Build succeeds, smoke tests pass
4. Access live GitHub Pages URL
5. Verify: App loads, env vars present, SW registered
6. **Acceptance Criteria Validated:** AC-1.6.1, AC-1.6.2, AC-1.6.3, AC-1.6.5

### Regression Testing

**Baseline Features (Must Not Break):**
- Daily message rotation (correct message for today's date)
- Favorite/unfavorite message with heart animation
- Share message via Web Share API or clipboard
- Theme switching (all 4 themes render correctly)
- Relationship duration counter updates
- Smooth animations (card entrance, hearts burst, decorative hearts)

**Regression Test Checklist (Run After Each Story):**
- [ ] App loads without errors
- [ ] Today's message displays correctly
- [ ] Favorite button works (heart animation plays)
- [ ] Share button works (Web Share API or clipboard)
- [ ] All 4 themes switch correctly
- [ ] Relationship duration calculates correctly
- [ ] Animations are smooth (60fps)
- [ ] No console errors in normal operation
- [ ] Service worker registers successfully
- [ ] Offline mode works (after first load)

### Edge Cases to Test

**LocalStorage Edge Cases:**
- Quota exceeded (fill LocalStorage manually)
- Private browsing mode (LocalStorage disabled)
- LocalStorage corrupted (invalid JSON)

**IndexedDB Edge Cases:**
- DB fails to open (permission denied)
- Transaction timeout (simulate slow disk)
- Version mismatch (simulate DB schema change)

**Service Worker Edge Cases:**
- SW fails to register (HTTP instead of HTTPS)
- SW update pending (user doesn't refresh)
- Cache out of date (stale assets)

**Build/Deploy Edge Cases:**
- .env.production missing (should fail gracefully)
- GitHub Pages down (deployment fails)
- Smoke tests fail (halt deployment)

### Test Tools and Frameworks

**Browser DevTools:**
- Application tab: LocalStorage, IndexedDB, Service Worker, Manifest
- Network tab: Offline mode, cache inspection
- Performance tab: Animation profiling (60fps validation)
- Console: Error log monitoring

**Testing Frameworks (Future Consideration):**
- **Vitest** - Unit testing (matches Vite ecosystem)
- **React Testing Library** - Component testing (deferred to Epic 2+)
- **Playwright** - E2E testing (deferred to Epic 2+)

**Static Analysis:**
- **TypeScript Compiler** - Type checking (strict mode in Story 1.5)
- **ESLint** - Linting (0 warnings goal in Story 1.5)
- **Bundle Analyzer** - Bundle size monitoring (Story 1.6)

### Definition of Done (Testing Perspective)

A story is complete when:
1. All acceptance criteria pass manual validation
2. Regression test checklist passes (no broken features)
3. No console errors in normal operation
4. Code compiles with TypeScript strict mode (Stories 1.5+)
5. ESLint shows 0 warnings (Stories 1.5+)
6. Browser compatibility verified (Chrome, Firefox, Safari)
7. Offline functionality works (after first load)
8. Build and deploy succeeds (Story 1.6)
