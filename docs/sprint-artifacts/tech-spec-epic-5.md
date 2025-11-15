# Epic Technical Specification: Code Quality & Performance

Date: 2025-11-14
Author: Frank
Epic ID: 5
Status: Draft

---

## Overview

Epic 5 focuses on addressing accumulated technical debt and optimizing application performance to ensure long-term maintainability and scalability. Following the successful completion of Epics 1-4 (Foundation, Testing, Messages, and Photos), this epic tackles critical architectural improvements that were intentionally deferred during rapid feature development.

The centerpiece of this epic is refactoring the monolithic 1,268-line `useAppStore.ts` into feature-specific slices, making state management more maintainable and easier to reason about. Additionally, the epic addresses performance bottlenecks in photo loading through pagination and lazy loading, eliminates code duplication by extracting a base service class, adds comprehensive unit test coverage for utilities and services, and centralizes input validation to prevent data corruption at the service boundary.

## Objectives and Scope

### Objectives

1. **Improve State Management Maintainability**: Split the monolithic Zustand store into feature-specific slices (messages, photos, settings, navigation, mood) to reduce cognitive load and improve code organization
2. **Optimize Photo Gallery Performance**: Implement pagination and lazy loading to prevent memory bloat when users have hundreds of photos
3. **Reduce Code Duplication**: Extract common IndexedDB patterns into a base service class, eliminating ~80% duplication across messagesService, photosService, and moodService
4. **Establish Unit Test Coverage**: Add comprehensive unit tests for utilities, services, and store slices to enable confident refactoring and prevent regressions
5. **Centralize Validation Logic**: Create a validation layer using Zod schemas to prevent invalid data from entering the system at service boundaries

### In Scope

- Refactoring `useAppStore.ts` (1,268 lines) into 5 feature slices with maintained API compatibility
- Implementing pagination for PhotoGallery component using existing `getPage()` method
- Creating `BaseIndexedDBService<T>` generic base class
- Setting up Vitest unit testing framework with 80%+ coverage target
- Creating `src/validation/` module with Zod schemas for all data models
- Updating all existing E2E tests to verify no regressions

### Out of Scope

- New user-facing features (this is pure refactoring and optimization)
- Changes to UI/UX design or visual styling
- Backend integration or API development
- Migration of existing data structures or breaking schema changes
- Performance optimization beyond photo pagination (e.g., bundle splitting, CDN)
- Test coverage expansion beyond 80% (future epic can target 100%)

## System Architecture Alignment

This epic strengthens the existing architecture patterns established in Epics 1-4 without introducing new architectural paradigms:

**State Management (Zustand)**: The store refactoring maintains the single-store pattern but improves internal organization through slices. The Zustand `persist` middleware configuration remains unchanged, preserving the existing LocalStorage persistence strategy. Component imports will be updated but the API surface remains backward-compatible.

**Service Layer (IndexedDB)**: The introduction of `BaseIndexedDBService<T>` consolidates the existing transaction handling, error management, and CRUD patterns already present in `messagesService.ts`, `photosService.ts`, and the planned `moodService.ts`. This refactoring preserves all existing IndexedDB schemas and store names while eliminating duplication.

**Component Architecture**: Photo pagination leverages the existing `PhotoGallery` component and the already-implemented `photosService.getPage()` method. No new components are introduced; existing components gain performance through optimized data loading patterns.

**Testing Strategy**: Vitest unit tests complement the existing Playwright E2E test suite from Epic 2, following the test pyramid pattern. E2E tests validate user flows end-to-end, while unit tests provide fast feedback on utility logic, service operations, and store slice updates.

**Validation Layer**: The new centralized validation with Zod schemas enforces type safety at service boundaries, complementing TypeScript's compile-time checking with runtime validation. This prevents the data corruption edge cases discovered during Epic 4 photo upload testing.

## Detailed Design

### Services and Modules

| Module                      | Responsibility                                   | Inputs                     | Outputs                           | Owner/Story    |
| --------------------------- | ------------------------------------------------ | -------------------------- | --------------------------------- | -------------- |
| **useMessagesStore**        | Message state management slice                   | User actions, message data | Message state, selectors          | Story 5.1      |
| **usePhotosStore**          | Photo state management slice                     | User actions, photo data   | Photo state, selectors            | Story 5.1      |
| **useSettingsStore**        | Settings state management slice                  | User preferences           | Settings state, theme actions     | Story 5.1      |
| **useNavigationStore**      | Navigation state management slice                | Route changes              | Current route, navigation actions | Story 5.1      |
| **useMoodStore**            | Mood tracking state slice                        | Mood entries               | Mood state, calendar data         | Story 5.1      |
| **BaseIndexedDBService<T>** | Generic IndexedDB operations                     | Store name, schema         | CRUD operations, error handling   | Story 5.3      |
| **messagesService**         | Message persistence (extends Base)               | Message objects            | Promise<Message[]>                | Story 5.3      |
| **photosService**           | Photo persistence with pagination (extends Base) | Photo objects, page params | Promise<Photo[]>, getPage()       | Story 5.2, 5.3 |
| **moodService**             | Mood persistence (extends Base)                  | Mood objects               | Promise<MoodEntry[]>              | Story 5.3      |
| **validation/**             | Centralized validation layer                     | User inputs                | Validated data or errors          | Story 5.5      |
| **Vitest Test Suite**       | Unit test coverage for utilities/services        | N/A                        | Test reports, coverage metrics    | Story 5.4      |

### Data Models and Contracts

**Store Slice Interfaces**

```typescript
// Feature slice pattern (Story 5.1)
interface MessagesSlice {
  messages: Message[];
  currentMessage: Message | null;
  messageHistory: MessageHistory;
  loadMessages: () => Promise<void>;
  addMessage: (text: string, category: MessageCategory) => Promise<void>;
  toggleFavorite: (messageId: number) => Promise<void>;
  updateCurrentMessage: () => void;
}

interface PhotosSlice {
  photos: Photo[];
  currentPage: number;
  totalPhotos: number;
  isLoading: boolean;
  loadPhotos: (page: number, pageSize: number) => Promise<void>;
  addPhoto: (photo: Omit<Photo, 'id'>) => Promise<void>;
  updatePhoto: (id: number, updates: Partial<Photo>) => Promise<void>;
  deletePhoto: (id: number) => Promise<void>;
}

interface SettingsSlice {
  settings: Settings | null;
  theme: ThemeName;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setTheme: (theme: ThemeName) => void;
}

interface NavigationSlice {
  currentRoute: string;
  navigate: (route: string) => void;
  goBack: () => void;
}

interface MoodSlice {
  moods: MoodEntry[];
  addMoodEntry: (mood: MoodType, note?: string) => void;
  getMoodForDate: (date: string) => MoodEntry | undefined;
}
```

**BaseIndexedDBService Generic Contract (Story 5.3)**

```typescript
abstract class BaseIndexedDBService<T extends { id?: number }> {
  constructor(
    protected dbName: string,
    protected storeName: string,
    protected version: number
  );

  // CRUD operations
  abstract getAll(): Promise<T[]>;
  abstract get(id: number): Promise<T | undefined>;
  abstract add(item: Omit<T, 'id'>): Promise<number>;
  abstract update(id: number, updates: Partial<T>): Promise<void>;
  abstract delete(id: number): Promise<void>;
  abstract clear(): Promise<void>;

  // Pagination support
  getPage(page: number, pageSize: number): Promise<T[]>;

  // Shared error handling
  protected handleError(operation: string, error: Error): never;
  protected handleQuotaExceeded(): never;
}
```

**Validation Schemas (Story 5.5)**

```typescript
// Using Zod for runtime validation
import { z } from 'zod';

const MessageSchema = z.object({
  id: z.number().optional(),
  text: z.string().min(1).max(1000),
  category: z.enum(['reasons', 'memories', 'affirmations', 'future_plans', 'custom']),
  createdAt: z.date(),
  isFavorite: z.boolean().default(false),
});

const PhotoSchema = z.object({
  id: z.number().optional(),
  file: z.instanceof(Blob),
  caption: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  uploadDate: z.date(),
});

const MoodEntrySchema = z.object({
  id: z.number().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood: z.enum(['loved', 'happy', 'content', 'thoughtful', 'grateful']),
  note: z.string().max(200).optional(),
});

const SettingsSchema = z.object({
  partnerName: z.string().min(1),
  relationshipStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  theme: z.enum(['sunset', 'ocean', 'lavender', 'rose']),
});

type Message = z.infer<typeof MessageSchema>;
type Photo = z.infer<typeof PhotoSchema>;
type MoodEntry = z.infer<typeof MoodEntrySchema>;
type Settings = z.infer<typeof SettingsSchema>;
```

### APIs and Interfaces

**Store Composition API (Story 5.1)**

```typescript
// Main store combines all slices
const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Combine all slices
      ...createMessagesSlice(set, get),
      ...createPhotosSlice(set, get),
      ...createSettingsSlice(set, get),
      ...createNavigationSlice(set, get),
      ...createMoodSlice(set, get),
    }),
    {
      name: 'my-love-storage',
      partialize: (state) => ({
        settings: state.settings,
        messageHistory: state.messageHistory,
        moods: state.moods,
        theme: state.theme,
      }),
    }
  )
);

// Component usage remains unchanged
const currentMessage = useAppStore((state) => state.currentMessage);
const toggleFavorite = useAppStore((state) => state.toggleFavorite);
```

**Photo Pagination API (Story 5.2)**

```typescript
interface PhotosService {
  // Existing methods maintained
  getAll(): Promise<Photo[]>;
  add(photo: Omit<Photo, 'id'>): Promise<number>;
  update(id: number, updates: Partial<Photo>): Promise<void>;
  delete(id: number): Promise<void>;

  // Enhanced pagination (already implemented, now utilized)
  getPage(page: number, pageSize: number): Promise<Photo[]>;
  getTotalCount(): Promise<number>;
}

// Component usage
const PhotoGallery: React.FC = () => {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const loadMore = async () => {
    const photos = await photosService.getPage(page + 1, pageSize);
    // Update state with new photos
    setPage(page + 1);
  };

  // Render with infinite scroll or "Load More" button
};
```

**Validation API (Story 5.5)**

```typescript
// Service layer validation
class MessagesService extends BaseIndexedDBService<Message> {
  async add(message: Omit<Message, 'id'>): Promise<number> {
    // Validate before write
    const validated = MessageSchema.parse({
      ...message,
      createdAt: new Date(),
    });

    return super.add(validated);
  }
}

// Validation errors are type-safe
try {
  await messagesService.add({ text: '', category: 'invalid' });
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle validation error with clear messages
    console.error(error.errors);
  }
}
```

### Workflows and Sequencing

**Story 5.1: Store Refactoring Sequence**

1. Analyze current `useAppStore.ts` structure
2. Create slice files: `src/store/slices/messagesSlice.ts`, `photosSlice.ts`, `settingsSlice.ts`, `navigationSlice.ts`, `moodSlice.ts`
3. Extract state and actions into respective slices
4. Update `useAppStore.ts` to compose slices using spread operator
5. Update component imports (automated with find-replace)
6. Run E2E tests to verify no regressions
7. Document slice architecture in `technical-decisions.md`

**Story 5.2: Photo Pagination Implementation**

1. Update `PhotoGallery` component to use `getPage()` method
2. Implement infinite scroll or "Load More" UI pattern
3. Add loading states and skeleton loaders
4. Test with 100+ photos to verify memory optimization
5. Update E2E tests to cover pagination scenarios

**Story 5.3: Base Service Extraction**

1. Analyze common patterns in `messagesService.ts`, `photosService.ts`, `moodService.ts`
2. Create `src/services/BaseIndexedDBService.ts` with generic type parameter
3. Extract: `openDB()`, `add()`, `get()`, `getAll()`, `update()`, `delete()`, `clear()`, error handling
4. Refactor existing services to extend `BaseIndexedDBService<T>`
5. Verify all existing functionality works (E2E tests)
6. Remove duplicated code from service files

**Story 5.4: Unit Test Setup**

1. Install Vitest: `npm install -D vitest @vitest/ui fake-indexeddb`
2. Create `vitest.config.ts` and test scripts in `package.json`
3. Write unit tests for:
   - `src/utils/dateHelpers.ts` - date calculations, relationship duration
   - `src/utils/messageRotation.ts` - message selection algorithm
   - `src/services/BaseIndexedDBService.ts` - CRUD operations (use `fake-indexeddb`)
   - Store slices - state updates, selectors
4. Achieve 80%+ coverage
5. Configure coverage reporting with `v8` provider

**Story 5.5: Validation Layer**

1. Install Zod: `npm install zod`
2. Create `src/validation/schemas.ts` with all Zod schemas
3. Update service layer to validate inputs before IndexedDB writes
4. Add validation to:
   - `messagesService.add()`, `messagesService.update()`
   - `photosService.add()`, `photosService.update()`
   - `settingsService.setSettings()`, `settingsService.updateSettings()`
   - `moodService.add()`
5. Write unit tests for validation edge cases
6. Update forms to display validation errors from service layer

**Dependency Flow**

```
Story 5.1 (Store Slicing) ─┐
                            ├─→ Story 5.4 (Unit Tests)
Story 5.2 (Pagination) ─────┤
                            │
Story 5.3 (Base Service) ───┴─→ Story 5.5 (Validation)
```

All stories can run in parallel except:

- Story 5.4 depends on 5.1, 5.2, 5.3 being complete (tests the refactored code)
- Story 5.5 depends on 5.3 (validation integrates with base service)

## Non-Functional Requirements

### Performance

**Photo Gallery Performance (Story 5.2)**

- **Target**: Gallery loads in <500ms regardless of total photo count
- **Metric**: Memory usage stays under 100MB with 500+ photos (currently ~500MB with all photos loaded)
- **Implementation**: Pagination with 20 photos per page, lazy loading on scroll
- **Test**: Measure with Chrome DevTools Performance tab, heap snapshots

**Store Slice Performance (Story 5.1)**

- **Target**: Component re-renders reduced by 30% through selective subscriptions
- **Metric**: Zustand selector optimization prevents unnecessary re-renders
- **Implementation**: Components subscribe only to required slice data
- **Test**: React DevTools Profiler to measure render counts before/after

**Unit Test Performance (Story 5.4)**

- **Target**: Complete unit test suite runs in <5 seconds
- **Metric**: Fast feedback loop for TDD workflow
- **Implementation**: Vitest with parallel test execution
- **Test**: CI pipeline reports test execution time

**Validation Performance (Story 5.5)**

- **Target**: Zod validation adds <10ms overhead per operation
- **Metric**: Negligible impact on user-facing operations
- **Implementation**: Schema compilation occurs once at module load
- **Test**: Performance.now() benchmarks before/after validation

### Security

**Input Validation (Story 5.5)**

- **Requirement**: All user inputs validated at service boundary to prevent XSS, injection, data corruption
- **Implementation**: Zod schemas enforce strict typing, max lengths, regex patterns
- **Threats Mitigated**:
  - Message content XSS (max 1000 chars, sanitized by React)
  - Photo caption overflow (max 500 chars)
  - Invalid dates causing calculation errors
  - Malformed mood entries corrupting history

**Type Safety (All Stories)**

- **Requirement**: TypeScript strict mode maintained, zero `any` types
- **Implementation**: Generic type parameters on `BaseIndexedDBService<T>` ensure type safety
- **Validation**: TSC compiler errors prevent deployment of unsafe code

**Data Integrity (Story 5.3)**

- **Requirement**: IndexedDB transactions are atomic, errors rollback properly
- **Implementation**: `BaseIndexedDBService` wraps all operations in try-catch with proper error propagation
- **Test**: Unit tests verify transaction rollback on error

### Reliability/Availability

**Backward Compatibility (Story 5.1)**

- **Requirement**: Store refactoring maintains 100% API compatibility
- **Implementation**: Component imports updated but function signatures unchanged
- **Test**: All Epic 2 E2E tests pass without modification

**Graceful Degradation (Story 5.2)**

- **Requirement**: Photo gallery works even if pagination fails
- **Implementation**: Fallback to loading all photos if `getPage()` errors
- **Test**: Simulate IndexedDB errors and verify graceful fallback

**Error Recovery (Story 5.3)**

- **Requirement**: Clear, actionable error messages for all failure modes
- **Implementation**: `BaseIndexedDBService` provides specific error types:
  - `QuotaExceededError` → "Storage full, please delete old photos"
  - `TransactionError` → "Database error, please refresh and try again"
  - `ValidationError` → "Invalid input: [specific field error]"
- **Test**: Unit tests verify error message clarity

**Test Coverage (Story 5.4)**

- **Requirement**: 80%+ code coverage on utilities, services, stores
- **Implementation**: Vitest coverage reports block PRs if coverage drops
- **Monitoring**: GitHub Actions CI fails on coverage regression

### Observability

**Unit Test Reporting (Story 5.4)**

- **Metrics**: Test count, pass/fail rate, execution time, coverage percentage
- **Implementation**: Vitest UI for interactive test exploration, coverage reports in HTML
- **Access**: `npm run test:unit:ui` for local, coverage report in CI artifacts

**E2E Test Reporting (All Stories)**

- **Metrics**: User flow success/failure, screenshot diffs on failure
- **Implementation**: Playwright test reports with trace files
- **Validation**: All Epic 1-4 tests must pass after each story completion

**Performance Monitoring (Story 5.2)**

- **Metrics**: Photo load time, memory heap size, render count
- **Implementation**: Chrome DevTools Performance profiling
- **Baseline**: Capture before/after metrics for pagination optimization

**Code Quality Metrics (All Stories)**

- **Metrics**: TypeScript errors, ESLint warnings, code duplication percentage
- **Implementation**: TSC, ESLint, and optional SonarQube analysis
- **Target**: Zero TS errors, zero ESLint warnings, <10% duplication

**Store State Inspection (Story 5.1)**

- **Tool**: Zustand DevTools extension for Redux DevTools
- **Visibility**: Inspect slice state, action history, time-travel debugging
- **Usage**: Install extension, enable devtools in store configuration

## Dependencies and Integrations

**New Dependencies**

| Package          | Version | Purpose                     | Story |
| ---------------- | ------- | --------------------------- | ----- |
| `vitest`         | ^2.0.0  | Unit testing framework      | 5.4   |
| `@vitest/ui`     | ^2.0.0  | Interactive test UI         | 5.4   |
| `fake-indexeddb` | ^6.0.0  | IndexedDB mocking for tests | 5.4   |
| `zod`            | ^3.23.0 | Runtime validation schemas  | 5.5   |

**Existing Dependencies (No Changes)**

- `zustand@5.0.8` - State management (refactored but version unchanged)
- `idb@8.0.3` - IndexedDB wrapper (used in BaseIndexedDBService)
- `react@19.1.1` - Component framework
- `framer-motion@12.23.24` - Animations
- `@playwright/test@1.49.1` - E2E testing (Epic 2)

**Integration Points**

**Store Integration (Story 5.1)**

- Components import from `@/store/useAppStore` (unchanged path)
- Slice files import `StateCreator` from Zustand
- Persist middleware configuration remains in main store file

**Service Integration (Story 5.2, 5.3)**

- `PhotoGallery` component calls `photosService.getPage()`
- All services extend `BaseIndexedDBService<T>`
- Error handling propagates to UI via Promise rejections

**Validation Integration (Story 5.5)**

- Services call `Schema.parse()` before IndexedDB writes
- Form components catch `ZodError` and display field-specific errors
- TypeScript types auto-generated from Zod schemas via `z.infer<>`

**Test Integration (Story 5.4)**

- Vitest runs alongside Playwright (different test types)
- CI runs both test suites: `npm run test:unit && npm run test:e2e`
- Coverage reports uploaded to CI artifacts

## Acceptance Criteria (Authoritative)

**Epic-Level Acceptance Criteria**

1. ✅ **Store refactoring complete**: `useAppStore.ts` split into 5 feature slices with maintained API compatibility
2. ✅ **Photo pagination implemented**: Gallery loads 20 photos at a time, memory usage optimized
3. ✅ **Base service extracted**: `BaseIndexedDBService<T>` eliminates duplication across all service files
4. ✅ **Unit tests passing**: 80%+ coverage on utilities, services, stores; all tests pass in <5 seconds
5. ✅ **Validation layer active**: Zod schemas validate all inputs at service boundaries
6. ✅ **No regressions**: All Epic 2 E2E tests pass without modification
7. ✅ **Performance targets met**: Photo gallery loads in <500ms, memory usage under 100MB with 500+ photos
8. ✅ **Documentation updated**: `technical-decisions.md` includes slice architecture and validation strategy

**Story-Level Acceptance Criteria**

**Story 5.1: Split useAppStore into Feature Slices**

1. 5 slice files created: `useMessagesStore.ts`, `usePhotosStore.ts`, `useSettingsStore.ts`, `useNavigationStore.ts`, `useMoodStore.ts`
2. Each slice has clear boundaries (messages, photos, settings, navigation, mood)
3. Main store composes slices using spread operator
4. Component imports updated, zero breaking changes
5. All E2E tests pass
6. Slice architecture documented

**Story 5.2: Implement Photo Pagination with Lazy Loading**

1. PhotoGallery uses `getPage(page, pageSize)` method
2. 20 photos per page displayed
3. "Load More" button or infinite scroll implemented
4. Loading states with skeleton loaders
5. Memory usage tested with 100+ photos
6. E2E tests cover pagination scenarios

**Story 5.3: Extract Base Service Class to Reduce Duplication**

1. `BaseIndexedDBService<T>` class created with generic type
2. Shared methods: `add()`, `get()`, `getAll()`, `update()`, `delete()`, `clear()`, `getPage()`
3. messagesService, photosService, moodService extend base class
4. Code duplication reduced by ~80%
5. All E2E tests pass
6. Service architecture documented

**Story 5.4: Add Unit Tests for Utilities and Services**

1. Vitest installed and configured
2. Test coverage ≥80% for:
   - `src/utils/dateHelpers.ts`
   - `src/utils/messageRotation.ts`
   - `src/services/BaseIndexedDBService.ts`
   - Store slices
3. All tests pass consistently
4. Tests run in <5 seconds
5. Coverage reports generated

**Story 5.5: Centralize Input Validation Layer**

1. Zod schemas created for: Message, Photo, MoodEntry, Settings
2. Validation applied at service layer (before IndexedDB writes)
3. Clear error messages on validation failure
4. Forms display field-specific validation errors
5. Unit tests cover validation edge cases
6. No invalid data can enter system

## Traceability Mapping

| Acceptance Criteria                   | Spec Section                                | Component/API                                                                        | Test Coverage                                         |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **AC1: Store refactoring complete**   | Detailed Design → Services and Modules      | useMessagesStore, usePhotosStore, useSettingsStore, useNavigationStore, useMoodStore | E2E tests (Epic 2) verify no regressions              |
| **AC2: Photo pagination implemented** | APIs and Interfaces → Photo Pagination API  | PhotoGallery component, photosService.getPage()                                      | E2E pagination tests, manual testing with 100+ photos |
| **AC3: Base service extracted**       | Data Models → BaseIndexedDBService Contract | BaseIndexedDBService<T>, messagesService, photosService, moodService                 | Unit tests for CRUD operations, E2E tests             |
| **AC4: Unit tests passing**           | Test Strategy → Unit Testing                | Vitest test suite, utilities, services, stores                                       | Vitest coverage reports (80%+)                        |
| **AC5: Validation layer active**      | Data Models → Validation Schemas            | Zod schemas, service layer validation                                                | Unit tests for validation edge cases                  |
| **AC6: No regressions**               | NFR → Reliability/Availability              | All components, services                                                             | Epic 2 E2E test suite (100% pass rate)                |
| **AC7: Performance targets met**      | NFR → Performance                           | PhotoGallery pagination, memory optimization                                         | Chrome DevTools Performance tab, heap snapshots       |
| **AC8: Documentation updated**        | Dependencies and Integrations               | technical-decisions.md                                                               | Manual review                                         |

**Story-to-Component Mapping**

| Story   | Components Modified             | Services Modified                                                 | Tests Added                                |
| ------- | ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| **5.1** | All components (import updates) | None                                                              | Unit tests for store slices                |
| **5.2** | PhotoGallery                    | photosService (utilize getPage())                                 | E2E pagination tests                       |
| **5.3** | None (internal refactor)        | messagesService, photosService, moodService, BaseIndexedDBService | Unit tests for BaseIndexedDBService        |
| **5.4** | None                            | None                                                              | Unit tests for utilities, services, stores |
| **5.5** | Forms (error display)           | All services (add validation)                                     | Unit tests for validation schemas          |

**Test Coverage Traceability**

| Test Type                        | Coverage                              | Purpose                                        | Framework       |
| -------------------------------- | ------------------------------------- | ---------------------------------------------- | --------------- |
| **E2E Tests (Epic 2)**           | User flows end-to-end                 | Prevent regressions after refactoring          | Playwright      |
| **Unit Tests (Story 5.4)**       | Utilities, services, stores (80%+)    | Fast feedback on logic correctness             | Vitest          |
| **Manual Testing**               | Photo pagination performance          | Verify memory optimization with large datasets | Chrome DevTools |
| **Validation Tests (Story 5.5)** | Edge cases (empty, invalid, overflow) | Ensure robust input handling                   | Vitest          |

## Risks, Assumptions, Open Questions

**Risks**

1. **Risk**: Store refactoring breaks component imports despite API compatibility
   - **Likelihood**: Low
   - **Impact**: High (app broken)
   - **Mitigation**: Run all E2E tests after each slice extraction; use TypeScript to catch import errors at compile time

2. **Risk**: Photo pagination introduces UI jank or broken infinite scroll
   - **Likelihood**: Medium
   - **Impact**: Medium (poor UX)
   - **Mitigation**: Test with 100+ photos, use React DevTools Profiler to catch performance issues early

3. **Risk**: BaseIndexedDBService abstraction doesn't fit all service needs
   - **Likelihood**: Low
   - **Impact**: Medium (refactor required)
   - **Mitigation**: Start with messagesService and photosService (known patterns), add override methods if needed

4. **Risk**: Zod validation schemas too strict, reject valid user input
   - **Likelihood**: Medium
   - **Impact**: Medium (user frustration)
   - **Mitigation**: Comprehensive unit tests for edge cases, gradual rollout with monitoring

5. **Risk**: Unit test suite slows down development (>5 second run time)
   - **Likelihood**: Low
   - **Impact**: Low (minor DX issue)
   - **Mitigation**: Use Vitest watch mode for fast feedback, optimize slow tests

**Assumptions**

1. **Assumption**: Existing E2E test suite (Epic 2) has sufficient coverage to catch regressions
   - **Validation**: Review test coverage report, add tests if gaps found

2. **Assumption**: Photo pagination with 20 photos per page provides good UX
   - **Validation**: User testing after implementation, adjust page size if needed

3. **Assumption**: 80% unit test coverage is sufficient for confidence in refactoring
   - **Validation**: Monitor for bugs after deployment, increase coverage if issues arise

4. **Assumption**: Zod adds acceptable performance overhead (<10ms per operation)
   - **Validation**: Benchmark validation performance in Story 5.5

5. **Assumption**: messagesService, photosService, and moodService have similar enough patterns to share a base class
   - **Validation**: Code analysis in Story 5.3, use abstract methods for service-specific logic

**Open Questions**

1. **Question**: Should store slices be in separate files or combined into one file with exports?
   - **Answer**: Separate files for better maintainability and clarity (one slice per file pattern)

2. **Question**: Infinite scroll vs. "Load More" button for photo pagination?
   - **Answer**: Start with "Load More" button (simpler, no scroll position management), can upgrade to infinite scroll later

3. **Question**: Should validation errors be displayed inline (per field) or as toast notifications?
   - **Answer**: Inline field errors for forms (better UX), toast for service-level errors (e.g., quota exceeded)

4. **Question**: Do we need to migrate existing LocalStorage data for slice refactor?
   - **Answer**: No migration needed - persist middleware handles serialization, keys remain unchanged

5. **Question**: Should BaseIndexedDBService be exported as a library for other projects?
   - **Answer**: Out of scope for Epic 5, but document for potential extraction in future

## Test Strategy Summary

**Test Pyramid Approach**

```
        /\
       /E2E\       ← Epic 2 Playwright tests (validate user flows)
      /------\
     / Integr.\   ← Light integration tests (services + IndexedDB)
    /----------\
   /   Unit     \ ← Story 5.4 Vitest tests (utilities, services, stores)
  /--------------\
```

**Unit Testing (Story 5.4)**

- **Framework**: Vitest with `fake-indexeddb` for mocking
- **Coverage Target**: 80%+ on utilities, services, stores
- **Focus Areas**:
  - `dateHelpers.ts`: Edge cases (leap years, DST, relationship duration calculations)
  - `messageRotation.ts`: Deterministic message selection, history tracking
  - `BaseIndexedDBService`: CRUD operations, error handling, transaction rollback
  - Store slices: State updates, selector memoization, action correctness
- **Execution**: `npm run test:unit` (parallel, <5 seconds)

**E2E Regression Testing (All Stories)**

- **Framework**: Playwright (from Epic 2)
- **Coverage**: All user flows from Epics 1-4 (messages, photos, settings, navigation)
- **Validation**: After each story completion, full E2E suite must pass
- **Purpose**: Catch breaking changes from refactoring
- **Execution**: `npm run test:e2e` (CI required for merge)

**Manual Testing**

- **Photo Pagination (Story 5.2)**: Load gallery with 100+ photos, verify memory usage with Chrome DevTools
- **Store Refactoring (Story 5.1)**: Smoke test all features, verify persistence works
- **Validation (Story 5.5)**: Test edge cases (empty inputs, max length, invalid dates)

**Performance Testing**

- **Photo Gallery**: Chrome DevTools Performance tab, heap snapshots before/after pagination
- **Store Slices**: React DevTools Profiler, measure render count reduction
- **Validation**: Performance.now() benchmarks for Zod schema parsing

**Test Data Management**

- **Unit Tests**: Use factory functions to generate test data (messages, photos, moods)
- **E2E Tests**: Use existing test fixtures from Epic 2
- **Performance Tests**: Generate 500+ photo mock dataset for load testing

**Continuous Integration**

- **GitHub Actions**: Run unit tests + E2E tests on every PR
- **Coverage Enforcement**: Block merge if unit test coverage drops below 80%
- **Test Artifacts**: Upload coverage reports, Playwright traces on failure
