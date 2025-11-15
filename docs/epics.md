# My-Love - Epic Breakdown

**Author:** Frank
**Date:** 2025-11-14 (Updated with FR traceability)
**Project Level:** 2
**Target Scale:** Medium feature set (34 stories across 6 epics)

---

## Overview

This document provides the complete epic and story breakdown for My-Love, transforming the strategic requirements from the [PRD](./PRD.md) into tactical, implementable stories with full functional requirement (FR) traceability.

**Living Document Notice:** This document evolves through the BMad Method workflow chain:
1. **Initial Creation** (this version): Epic structure, stories, FR traceability ✅
2. **After UX Design**: Story acceptance criteria updated with interaction specs and mockup references
3. **After Architecture**: Story technical notes updated with implementation decisions and patterns
4. **During Implementation**: Stories refined as edge cases discovered

**Document Structure:**

Each epic includes:
- Expanded goal and value proposition
- Complete story breakdown with user stories in BDD format
- Detailed acceptance criteria for each story
- Story sequencing and dependencies
- **NEW:** Complete FR inventory and coverage matrices ensuring no requirements are missed

**Epic Sequencing Principles:**

- Epic 1 establishes foundational infrastructure and fixes critical issues
- Epic 2 adds comprehensive E2E testing to protect against regressions
- Epics 3-4 build feature value (messages and photos)
- Epic 5 addresses technical debt and optimizes performance
- Epic 6 adds interactive connection features (mood tracking, interactions, countdowns)
- Stories within epics are vertically sliced and sequentially ordered
- No forward dependencies - each story builds only on previous work

**Epic Summary:**

| Epic | Focus | Stories | FRs Covered |
|---|---|---|---|
| **Epic 1** | Foundation & Core Fixes | 6 | FR001-FR005, FR010, FR031-FR033 |
| **Epic 2** | Testing Infrastructure | 6 | All FRs (validation layer) |
| **Epic 3** | Enhanced Message Experience | 6 | FR006-FR011, FR026-FR030 |
| **Epic 4** | Photo Gallery & Memories | 5 | FR012-FR015 |
| **Epic 5** | Code Quality & Performance | 5 | Technical debt & optimization |
| **Epic 6** | Interactive Connection Features | 6 | FR016-FR025 |
| **Total** | | **34 stories** | **33 FRs (100% coverage)** |

---

## Functional Requirements Inventory

**Core Data Persistence:**
- **FR001**: System SHALL persist all user data (messages, photos, mood entries, settings) across browser sessions
- **FR002**: System SHALL correctly restore application state from persisted storage on app initialization
- **FR003**: System SHALL handle storage quota limits gracefully with user notification

**Pre-Configured Experience:**
- **FR004**: System SHALL eliminate onboarding flow by pre-configuring relationship data via hardcoded constants
- **FR005**: System SHALL display relationship duration automatically without user input

**Message Library & Navigation:**
- **FR006**: System SHALL maintain library of 365 unique love messages across 5 categories
- **FR007**: System SHALL display one message per day based on date-based rotation algorithm
- **FR008**: System SHALL support horizontal swipe gestures to navigate to previous days' messages
- **FR009**: System SHALL prevent forward navigation to future unread messages
- **FR010**: System SHALL allow users to favorite messages with visual indication
- **FR011**: System SHALL enable message sharing via native share API or clipboard copy

**Photo Gallery:**
- **FR012**: System SHALL allow users to upload photos with captions and optional tags
- **FR013**: System SHALL display photos in carousel/gallery view with smooth animated transitions
- **FR014**: System SHALL store photos in IndexedDB with compression for optimal storage
- **FR015**: System SHALL provide navigation interface to access photo gallery from main app

**Anniversary Countdown:**
- **FR016**: System SHALL calculate and display countdown to next anniversary
- **FR017**: System SHALL support multiple custom countdowns for special dates
- **FR018**: System SHALL trigger celebration animations when countdown reaches zero

**Mood Tracking & Sync:**
- **FR019**: System SHALL allow user to log daily mood (5 mood types)
- **FR020**: System SHALL sync mood entries to backend service for partner visibility
- **FR021**: System SHALL display mood history in calendar view
- **FR022**: System SHALL support optional notes with each mood entry

**Interactive Connection Features:**
- **FR023**: System SHALL support "poke" and "kiss" actions that send notifications to partner
- **FR024**: System SHALL display animated reactions when poke/kiss is received
- **FR025**: System SHALL maintain interaction history for sentimental value

**Custom Message Management:**
- **FR026**: System SHALL allow admin user to review AI-generated message suggestions
- **FR027**: System SHALL provide accept/decline interface for message curation
- **FR028**: System SHALL enable creation of custom messages with category selection
- **FR029**: System SHALL allow editing of existing messages in library
- **FR030**: System SHALL integrate approved custom messages into daily rotation algorithm

**Navigation & UI:**
- **FR031**: System SHALL provide top navigation bar to access: Home, Photos, Mood Tracker, Settings
- **FR032**: System SHALL maintain consistent theme across all views
- **FR033**: System SHALL support all 4 existing themes (Sunset Bliss, Ocean Dreams, Lavender Fields, Rose Garden)

**Total: 33 Functional Requirements**

---

## FR Coverage Map

This section maps each functional requirement to the epic(s) and story(ies) that implement it, ensuring complete coverage and traceability.

### Epic 1: Foundation & Core Fixes
**Addresses:** FR001, FR002, FR003, FR004, FR005, FR031, FR032, FR033
- Infrastructure for all features
- Data persistence foundation (FR001-FR003)
- Pre-configured experience (FR004-FR005)
- Navigation and theming (FR031-FR033)

### Epic 2: Testing Infrastructure & Quality Assurance
**Addresses:** All FRs indirectly (validation layer)
- Ensures all functional requirements are tested and working
- Provides regression protection for Epic 1 features

### Epic 3: Enhanced Message Experience
**Addresses:** FR006, FR007, FR008, FR009, FR010, FR011, FR026, FR027, FR028, FR029, FR030
- Message library expansion (FR006)
- Daily rotation and navigation (FR007-FR009)
- Favorites and sharing (FR010-FR011)
- Custom message management (FR026-FR030)

### Epic 4: Photo Gallery & Memories
**Addresses:** FR012, FR013, FR014, FR015
- Photo upload and storage (FR012, FR014)
- Carousel gallery view (FR013)
- Navigation integration (FR015)

### Epic 5: Code Quality & Performance Improvements
**Addresses:** Technical debt and optimization (no new FRs)
- State management refactoring
- Performance optimization (photo pagination)
- Code maintainability (service layer, validation)
- Test coverage expansion

### Epic 6: Interactive Connection Features
**Addresses:** FR016, FR017, FR018, FR019, FR020, FR021, FR022, FR023, FR024, FR025
- Mood tracking and sync (FR019-FR022)
- Poke/kiss interactions (FR023-FR025)
- Anniversary countdowns (FR016-FR018)

**Coverage Validation:** ✅ All 33 FRs mapped to epics

---

## Epic 1: Foundation & Core Fixes

### Goal

Establish a stable, production-ready foundation by addressing technical debt from rapid prototyping, fixing critical persistence bugs, and eliminating onboarding friction. This epic ensures the app is reliable and ready for feature expansion.

### Value Delivery

By completing this epic, the app will persist data correctly across sessions, your girlfriend will never see setup screens, and the codebase will be clean and maintainable for future development.

### Stories

**Story 1.1: Technical Debt Audit & Refactoring Plan**

As a developer,
I want to audit the vibe-coded prototype for technical debt,
So that I can identify and prioritize refactoring efforts before adding new features.

**Acceptance Criteria:**
1. Complete code review identifying: code smells, architectural inconsistencies, missing error handling, unused dependencies
2. Document findings in technical-decisions.md
3. Create prioritized refactoring checklist (critical vs. nice-to-have)
4. Estimate effort for each refactoring item
5. No code changes in this story - pure analysis

**Prerequisites:** None

---

**Story 1.2: Fix Zustand Persist Middleware Configuration**

As a developer,
I want to fix the Zustand state persistence bug,
So that user data (favorites, settings, message history) survives browser sessions.

**Acceptance Criteria:**
1. Zustand persist middleware correctly saves state to LocalStorage
2. State hydration works on app initialization without data loss
3. Storage partializer only persists necessary state (not transient UI state)
4. Handle storage quota exceeded errors gracefully
5. Test persistence across browser refresh, tab close/reopen, and 24-hour gap
6. All existing features continue working (no regression)

**Prerequisites:** Story 1.1 (understand current state management architecture)

---

**Story 1.3: IndexedDB Service Worker Cache Fix**

As a developer,
I want to ensure IndexedDB operations work correctly with the service worker,
So that photos and messages persist reliably offline.

**Acceptance Criteria:**
1. IndexedDB operations complete successfully even when offline
2. Service worker doesn't interfere with IndexedDB transactions
3. Cache strategy updated if needed for IndexedDB compatibility
4. Test: Add photo offline, go online, verify photo persists
5. Test: Favorite message, restart app, verify favorite persists

**Prerequisites:** Story 1.2

---

**Story 1.4: Remove Onboarding Flow & Pre-Configure Relationship Data**

As the app developer,
I want to pre-configure relationship data via hardcoded constants,
So that my girlfriend never sees the onboarding wizard.

**Acceptance Criteria:**
1. Create configuration constants in `src/config/constants.ts` for: partner name, relationship start date
2. Remove Onboarding component from render path
3. App initializes with pre-configured data on first load
4. Relationship duration calculates correctly from pre-configured start date
5. Settings allow editing name/date if needed (edge case)
6. No onboarding UI visible at any point in normal flow

**Prerequisites:** Story 1.2 (need working persistence first)

---

**Story 1.5: Critical Refactoring - Code Quality Improvements**

As a developer,
I want to refactor critical code quality issues identified in audit,
So that the codebase is maintainable and follows best practices.

**Acceptance Criteria:**
1. Address all "critical" items from Story 1.1 refactoring checklist
2. Ensure TypeScript strict mode compliance (no `any` types without justification)
3. Add error boundaries for graceful error handling
4. Remove unused dependencies and dead code
5. ESLint warnings reduced to zero
6. All existing features continue working (regression testing)

**Prerequisites:** Story 1.1, 1.2, 1.3, 1.4

---

**Story 1.6: Build & Deployment Configuration Hardening**

As a developer,
I want to ensure build and deployment process is robust,
So that production deployments are reliable and pre-configuration works correctly.

**Acceptance Criteria:**
1. Vite build process bundles configuration constants correctly
2. GitHub Pages deployment correctly serves PWA with pre-configured data
3. Service worker generation works correctly in production build
4. Build produces optimized, minified bundles
5. Deployment script includes smoke test verification
6. Document deployment process in README or deployment guide

**Prerequisites:** Story 1.4 (need pre-configuration working)

---

**Epic 1 Summary:**
- **Total Stories:** 6
- **Estimated Effort:** High (foundation work is critical)
- **Deliverable:** Stable, production-ready app with persistence fixes and no onboarding

---

## Epic 2: Testing Infrastructure & Quality Assurance

### Goal

Establish comprehensive end-to-end testing infrastructure using Playwright to achieve 100% test coverage, ensuring all features are validated and regression-free before deployment.

### Value Delivery

By completing this epic, the app will have automated testing that catches bugs before production, validates PWA functionality (offline mode, service workers, IndexedDB), and provides confidence for rapid feature development without breaking existing functionality.

### Stories

**Story 2.1: Testing Framework Setup**

As a developer,
I want to scaffold Playwright testing framework with PWA-specific helpers,
So that I can write comprehensive E2E tests for all app features.

**Acceptance Criteria:**
1. Install @playwright/test and configure playwright.config.ts
2. Set up test directory structure: tests/e2e/, tests/support/fixtures/, tests/support/helpers/
3. Create PWA testing helpers: waitForServiceWorker, clearIndexedDB, goOffline, goOnline
4. Configure multi-browser support (Chromium, Firefox, WebKit)
5. Set up test scripts in package.json (test:e2e, test:e2e:ui, test:e2e:debug)
6. Create .env.test.example with test environment variables
7. Add tests/README.md with testing guidelines and patterns

**Prerequisites:** Epic 1 complete (stable foundation to test against)

---

**Story 2.2: Component Integration Tests**

As a developer,
I want integration tests for all Epic 1 features,
So that I can verify core functionality works as expected.

**Acceptance Criteria:**
1. Test suite for message display and rotation logic
2. Test suite for favorites functionality (add, remove, persist)
3. Test suite for settings page (edit name/date, persist changes)
4. Test suite for relationship duration calculation accuracy
5. Test suite for navigation between Home, Favorites, Settings
6. All tests pass consistently (no flakiness)
7. Tests validate both UI state and data persistence (LocalStorage, IndexedDB)

**Prerequisites:** Story 2.1

---

**Story 2.3: Add data-testid Attributes to Components**

As a developer,
I want semantic data-testid attributes on all interactive elements,
So that tests are maintainable and resilient to UI changes.

**Acceptance Criteria:**
1. Add data-testid to all buttons (favorites, navigation, settings actions)
2. Add data-testid to message display areas
3. Add data-testid to input fields (settings form)
4. Add data-testid to navigation elements
5. Follow naming convention: [component]-[element]-[action] (e.g., "message-favorite-button")
6. Update existing tests to use data-testid selectors (no CSS class dependencies)
7. Document data-testid strategy in tests/README.md

**Prerequisites:** Story 2.2

---

**Story 2.4: Configure Auto-Start Preview Server for Tests**

As a developer,
I want tests to automatically start the dev server,
So that I can run tests without manual setup.

**Acceptance Criteria:**
1. Configure playwright.config.ts webServer option to auto-start Vite dev server
2. Server starts on available port (dynamic port detection)
3. Tests wait for server readiness before execution
4. Server shuts down gracefully after tests complete
5. Works in both local development and CI environments
6. Add timeout handling for slow server starts
7. Test command runs end-to-end without manual intervention

**Prerequisites:** Story 2.3

---

**Story 2.5: Run & Validate Tests Pass**

As a developer,
I want all tests to pass with 100% coverage of Epic 1 features,
So that I have confidence in the stability of the foundation.

**Acceptance Criteria:**
1. All Epic 1 features have corresponding E2E tests
2. Test coverage report shows 100% of critical user paths covered
3. All tests pass in all configured browsers (Chromium, Firefox, WebKit)
4. Tests run in under 5 minutes total
5. No flaky tests (consistent pass rate across 10 runs)
6. Generate HTML test report with screenshots on failure
7. Document any known limitations or edge cases not covered

**Prerequisites:** Story 2.4

---

**Story 2.6: Add CI Integration (GitHub Actions)**

As a developer,
I want tests to run automatically on every push and pull request,
So that regressions are caught before merging code.

**Acceptance Criteria:**
1. Create .github/workflows/playwright.yml workflow file
2. Workflow triggers on push to main and all pull requests
3. Workflow runs tests on Ubuntu (latest) with all browsers
4. Workflow uploads test artifacts (reports, screenshots) on failure
5. Workflow fails if any tests fail (blocking PR merge)
6. Add status badge to README.md showing test status
7. Test execution time in CI under 10 minutes
8. Document CI setup and troubleshooting in tests/README.md

**Prerequisites:** Story 2.5

---

**Epic 2 Summary:**
- **Total Stories:** 6
- **Estimated Effort:** Medium (framework setup + comprehensive test writing)
- **Deliverable:** 100% test coverage of Epic 1 features with automated CI validation

---

## Epic 3: Enhanced Message Experience

### Goal

Expand the message library to 365 unique messages, implement intuitive swipe navigation for browsing message history, and create an admin interface for custom message management.

### Value Delivery

Your girlfriend gets a full year of unique daily messages without repetition, can revisit favorite past messages with smooth swipe gestures, and you can curate and personalize the message library to make it even more meaningful.

### Stories

**Story 3.1: Expand Message Library to 365 Messages**

As the app creator,
I want to expand the message library from 100 to 365 unique messages,
So that my girlfriend receives a different message every day for a full year.

**Acceptance Criteria:**
1. Generate or source 265 additional love messages across the 5 categories (reasons, memories, affirmations, future plans, custom)
2. Messages are high-quality, heartfelt, and varied in tone and length
3. Update defaultMessages.ts with all 365 messages
4. Each message tagged with appropriate category
5. No duplicate messages in library
6. Message rotation algorithm handles 365-message library correctly

**Prerequisites:** Epic 1 complete (stable foundation)

---

**Story 3.2: Implement Horizontal Swipe Navigation - Backward Only**

As your girlfriend,
I want to swipe left to see yesterday's message,
So that I can revisit recent messages that made me smile.

**Acceptance Criteria:**
1. Swipe left gesture navigates to previous day's message
2. Swipe right from any past message returns toward today
3. Cannot swipe right beyond today's message (subtle bounce indicator)
4. Smooth animated transition between messages (300ms ease-out)
5. Message history loads correctly from message rotation algorithm
6. Swipe gesture works on touch devices and trackpad (desktop)
7. Accessibility: keyboard navigation (arrow keys) also works

**Prerequisites:** Story 3.1 (need full message library to navigate)

---

**Story 3.3: Message History State Management**

As a developer,
I want to track message history in the Zustand store,
So that swipe navigation knows which messages have been shown and can prevent future browsing.

**Acceptance Criteria:**
1. Store tracks: current message index, message history (dates + message IDs shown)
2. History persists across sessions (LocalStorage via Zustand persist)
3. Algorithm ensures today's message is deterministic (same message all day)
4. Prevents loading messages from future dates
5. Handles edge case: first-time user has no history (starts with today only)
6. Handles edge case: user skipped days (show missed messages when swiping back)

**Prerequisites:** Story 3.2

---

**Story 3.4: Admin Interface - Custom Message Management (Phase 1: UI)**

As the app creator,
I want an admin settings panel to manage custom messages,
So that I can add personalized messages to the rotation.

**Acceptance Criteria:**
1. Add "Admin" tab in navigation (password-protected or hidden route)
2. UI displays list of all messages with category filter
3. UI shows "Create New Message" button
4. UI shows "Edit" and "Delete" buttons for each message
5. Form for creating new message: text area, category dropdown, save/cancel
6. Form for editing existing message: pre-populated fields, save/cancel
7. All UI is styled consistently with app theme
8. No backend integration yet (save to LocalStorage temporarily)

**Prerequisites:** Story 3.3

---

**Story 3.5: Admin Interface - Message Persistence & Integration**

As the app creator,
I want custom messages to persist in IndexedDB and integrate into daily rotation,
So that my personalized messages appear alongside default messages.

**Acceptance Criteria:**
1. Custom messages saved to IndexedDB `messages` object store
2. Message rotation algorithm pulls from both default and custom messages
3. Category filter works with custom messages
4. Custom messages can be marked as "active" or "draft" (only active rotate)
5. Deletion removes from IndexedDB and rotation
6. Import/export feature to back up custom messages (JSON format)
7. Test: Create custom message, verify it appears in rotation next day

**Prerequisites:** Story 3.4

---

**Story 3.6: AI Message Suggestion Review Interface (Optional Enhancement)**

As the app creator,
I want to review AI-generated message suggestions and approve/reject them,
So that I can quickly expand the library with quality-controlled content.

**Acceptance Criteria:**
1. Admin panel includes "Generate Suggestions" button
2. Uses OpenAI API (or similar) to generate 10 message suggestions
3. Each suggestion displayed with "Accept" and "Reject" buttons
4. Accepted messages added to custom message library as drafts
5. Rejected messages discarded
6. Can regenerate new batch of suggestions
7. Rate limiting or cost control to prevent excessive API usage

**Prerequisites:** Story 3.5

---

**Epic 3 Summary:**
- **Total Stories:** 6 (one optional)
- **Estimated Effort:** Medium-High
- **Deliverable:** 365-message library, swipe navigation, custom message management

---

## Epic 4: Photo Gallery & Memories

### Goal

Create a beautiful photo gallery where your girlfriend can upload, caption, and browse photos with smooth carousel animations, preserving special moments in a private, emotionally rich interface.

### Value Delivery

Photos become a core part of the daily experience, allowing her to relive memories and add new ones easily, all stored privately on her device.

### Stories

**Story 4.1: Photo Upload & Storage**

As your girlfriend,
I want to upload photos with captions,
So that I can preserve special memories in the app.

**Acceptance Criteria:**
1. "Photos" tab in navigation opens photo gallery view
2. "Upload Photo" button triggers file picker (image files only)
3. Selected photo previewed before upload
4. Caption text area (optional, max 500 characters)
5. Tags input field (comma-separated, optional)
6. Photo compressed client-side before storage (max 1920px width, 80% quality)
7. Photo saved to IndexedDB with metadata: id, file blob, caption, tags, uploadDate
8. Success feedback shown after upload
9. Handle error cases: file too large, unsupported format, storage quota exceeded

**Prerequisites:** Epic 1 complete (IndexedDB working)

---

**Story 4.2: Photo Gallery Grid View**

As your girlfriend,
I want to see all my uploaded photos in a grid,
So that I can browse my photo collection.

**Acceptance Criteria:**
1. Gallery displays photos in responsive grid (2-3 columns mobile, 3-4 desktop)
2. Photos load from IndexedDB sorted by uploadDate (newest first)
3. Each grid item shows photo thumbnail with caption overlay on hover/tap
4. Lazy loading for performance (load 20 photos at a time)
5. Empty state message if no photos uploaded yet
6. Loading spinner while fetching photos
7. Tap photo to open carousel/lightbox view (Story 4.3)

**Prerequisites:** Story 4.1

---

**Story 4.3: Photo Carousel with Animated Transitions**

As your girlfriend,
I want to view photos in a full-screen carousel,
So that I can enjoy photos in detail with smooth animations.

**Acceptance Criteria:**
1. Tapping grid photo opens full-screen lightbox/carousel
2. Swipe left/right to navigate between photos (smooth 300ms transition)
3. Photo displayed at optimal size (fills screen, maintains aspect ratio)
4. Caption and tags displayed below photo
5. Close button exits carousel (or swipe down gesture)
6. Keyboard navigation (arrow keys) works
7. Framer Motion animations: entrance fade-in, swipe transitions
8. Edit and Delete buttons visible in carousel view

**Prerequisites:** Story 4.2

---

**Story 4.4: Photo Edit & Delete Functionality**

As your girlfriend,
I want to edit captions/tags or delete photos,
So that I can manage my photo collection.

**Acceptance Criteria:**
1. Edit button in carousel opens edit modal
2. Edit modal shows: current photo, editable caption, editable tags, save/cancel
3. Save updates IndexedDB entry
4. Delete button shows confirmation dialog
5. Confirmed delete removes from IndexedDB and refreshes gallery
6. Deleted photos no longer appear in grid or carousel
7. Undo delete (optional enhancement: trash/archive folder)

**Prerequisites:** Story 4.3

---

**Story 4.5: Photo Gallery Navigation Integration**

As your girlfriend,
I want seamless navigation between Home and Photos,
So that I can easily access my photo memories.

**Acceptance Criteria:**
1. Top navigation bar includes "Photos" tab with icon
2. Active tab highlighted to show current view
3. Navigation transitions smoothly (no jarring reloads)
4. Photo count badge on Photos tab (optional)
5. Deep linking: can share direct link to photo gallery
6. Back navigation works correctly (browser back button)

**Prerequisites:** Story 4.4

---

**Epic 4 Summary:**
- **Total Stories:** 5
- **Estimated Effort:** Medium
- **Deliverable:** Full-featured photo gallery with carousel and management

---

## Epic 5: Code Quality & Performance Improvements

### Goal

Address technical debt and optimize performance by refactoring complex state management, improving code maintainability, adding comprehensive unit tests, and optimizing resource-intensive operations like photo loading.

### Value Delivery

By completing this epic, the codebase will be more maintainable, performant, and resilient. The 1,268-line store will be split into manageable feature slices, photo gallery will load efficiently with pagination, service code will be DRY with a base class, and critical utilities will have unit test coverage for confidence in refactoring.

### Stories

**Story 5.1: Split useAppStore into Feature Slices**

As a developer,
I want to split the monolithic useAppStore.ts (1,268 lines) into feature-specific slices,
So that the state management is more maintainable and easier to reason about.

**Acceptance Criteria:**
1. Analyze current useAppStore.ts structure and identify natural feature boundaries
2. Create feature slices: `useMessagesStore.ts`, `usePhotosStore.ts`, `useSettingsStore.ts`, `useNavigationStore.ts`, `useMoodStore.ts`
3. Extract related state, actions, and selectors into respective slices
4. Maintain existing API compatibility (no breaking changes to component imports)
5. Use Zustand's slice pattern or similar composition approach
6. Update imports across codebase to use feature slices
7. Verify all existing functionality works (run E2E tests)
8. Document slice architecture in technical-decisions.md

**Prerequisites:** Epic 1 and Epic 2 complete (stable foundation with tests)

**Technical Notes:**
- Consider using Zustand's `combine` or manual composition
- Keep shared state (like theme) in a core slice
- Each slice should be independently testable

---

**Story 5.2: Implement Photo Pagination with Lazy Loading**

As a user,
I want the photo gallery to load efficiently without loading all photos into memory,
So that the app remains responsive even with hundreds of photos.

**Acceptance Criteria:**
1. Update PhotoGallery component to use existing `getPage()` pagination method
2. Implement virtual scrolling or progressive loading (load 20 photos per page)
3. Add "Load More" button or infinite scroll behavior
4. Photos load on-demand as user scrolls (lazy loading)
5. Memory usage stays constant regardless of total photo count
6. Smooth UX: loading indicators, no jarring jumps during load
7. IndexedDB queries optimized (use cursor pagination, not loading all then slicing)
8. Test with 100+ photos to verify performance improvement

**Prerequisites:** Story 5.1 (photos state extracted to slice)

**Technical Notes:**
- Existing `getPage(page: number, pageSize: number)` method in photosService.ts
- Consider using react-window or react-virtualized for virtual scrolling
- Maintain current photo ordering (newest first)

---

**Story 5.3: Extract Base Service Class to Reduce Duplication**

As a developer,
I want to extract common service logic into a base class,
So that messagesService, photosService, and moodService don't duplicate ~80% of their code.

**Acceptance Criteria:**
1. Analyze common patterns across messagesService.ts, photosService.ts, moodService.ts
2. Create `BaseIndexedDBService.ts` with shared methods: `add()`, `get()`, `getAll()`, `update()`, `delete()`, `clear()`
3. Refactor existing services to extend base class
4. Maintain existing API contracts (no breaking changes)
5. Add generic typing for type safety (`BaseIndexedDBService<T>`)
6. Remove duplicated error handling and transaction logic
7. All existing E2E tests still pass
8. Document service architecture in technical-decisions.md

**Prerequisites:** Story 5.2

**Technical Notes:**
- Each service still defines its own schema and store name
- Base class handles DB connection, transactions, error handling
- Consider using TypeScript generics for type-safe operations

---

**Story 5.4: Add Unit Tests for Utilities and Services**

As a developer,
I want unit tests for critical utilities and services,
So that I can refactor confidently without breaking functionality.

**Acceptance Criteria:**
1. Set up Vitest for unit testing (fast, Vite-native)
2. Add tests for utility functions: date calculations, message rotation algorithm, validation helpers
3. Add tests for service layer: BaseIndexedDBService methods (use fake-indexeddb)
4. Add tests for Zustand store slices: state updates, selectors, actions
5. Achieve 80%+ code coverage for utilities and services
6. Tests run in under 5 seconds total (fast feedback loop)
7. Configure test scripts: `npm run test:unit`, `npm run test:unit:watch`, `npm run test:unit:coverage`
8. Document testing approach in tests/README.md

**Prerequisites:** Story 5.3 (service refactoring complete)

**Technical Notes:**
- Use `fake-indexeddb` for service tests (no real browser DB)
- Use Vitest's built-in mocking for external dependencies
- Don't duplicate E2E test scenarios - unit tests focus on logic/edge cases

---

**Story 5.5: Centralize Input Validation Layer**

As a developer,
I want a centralized validation layer for user inputs,
So that corrupted or invalid data can't enter the system.

**Acceptance Criteria:**
1. Create `src/validation/` directory with validation schemas
2. Define validation rules for: messages (content, category), photos (captions, tags), moods (type, notes), settings (name, date)
3. Use Zod or similar for type-safe runtime validation
4. Apply validation at service layer (before IndexedDB write)
5. Return clear, user-friendly error messages on validation failure
6. Add validation tests in Story 5.4's unit test suite
7. Update existing forms to use centralized validators
8. Prevent edge cases: empty strings, null values, excessively long inputs, invalid dates

**Prerequisites:** Story 5.4

**Technical Notes:**
- Validation happens at service boundary (not UI layer)
- Zod schemas double as TypeScript types
- Existing E2E tests should help catch any regressions from stricter validation

---

**Epic 5 Summary:**
- **Total Stories:** 5
- **Estimated Effort:** Medium-High (refactoring requires care)
- **Deliverable:** Maintainable codebase with better performance, DRY code, unit tests, and robust validation

---

## Epic 6: Interactive Connection Features

### Goal

Build interactive features that enable real-time emotional connection: mood tracking synced via NocoDB backend, poke/kiss interactions, and anniversary countdown timers.

### Value Delivery

She can log daily moods that you can see, you can send spontaneous "kisses" or "pokes" to brighten her day, and countdown timers build anticipation for special dates.

### Stories

**Story 6.1: NocoDB Backend Setup & API Integration**

As a developer,
I want to set up NocoDB backend and create API integration layer,
So that I can sync mood and interaction data between devices.

**Acceptance Criteria:**
1. NocoDB instance deployed (free tier on NocoDB Cloud or self-hosted)
2. Create tables: `moods` (id, date, mood_type, note, user, createdAt), `interactions` (id, type, from_user, to_user, createdAt, viewed)
3. API service layer created: `nocodb.service.ts` with methods: saveMood, getMoods, sendInteraction, getInteractions
4. Authentication configured (API token stored securely in env vars)
5. Error handling for network failures (graceful degradation)
6. Rate limiting protection to stay within free tier limits

**Prerequisites:** Epic 1 complete

---

**Story 6.2: Mood Tracking UI & Local Storage**

As your girlfriend,
I want to log my daily mood,
So that I can track how I'm feeling and you can see it.

**Acceptance Criteria:**
1. "Mood" tab in navigation opens mood tracker view
2. Today's mood selector: 5 buttons (loved, happy, content, thoughtful, grateful) with icons
3. Optional note field (max 200 characters)
4. Save button stores mood entry locally (IndexedDB) and attempts NocoDB sync
5. Success feedback: "Mood logged!" message
6. Can only log one mood per day (edit if logging again same day)
7. UI shows if mood synced successfully or pending (offline indicator)

**Prerequisites:** Story 6.1

---

**Story 6.3: Mood History Calendar View**

As your girlfriend,
I want to see my mood history in a calendar,
So that I can reflect on patterns over time.

**Acceptance Criteria:**
1. Calendar view displays current month with mood icons on logged dates
2. Tapping a date shows mood details (mood type, note, date)
3. Navigate between months (prev/next buttons)
4. Empty dates show no mood indicator
5. Current date highlighted
6. Responsive layout (mobile and desktop)

**Prerequisites:** Story 6.2

---

**Story 6.4: Mood Sync & Partner Visibility**

As the app creator,
I want to see my girlfriend's mood logs,
So that I can check in on how she's feeling.

**Acceptance Criteria:**
1. Admin/partner view shows mood history synced from NocoDB
2. Displays: date, mood type, note (if provided)
3. Auto-refreshes or manual refresh button
4. Only shows moods from partner (user filtering)
5. Handles sync conflicts gracefully
6. Offline mode: displays cached moods, syncs when back online

**Prerequisites:** Story 6.3

---

**Story 6.5: Poke & Kiss Interactions**

As your girlfriend (and you),
I want to send spontaneous pokes or kisses,
So that we can share small moments of affection throughout the day.

**Acceptance Criteria:**
1. Interaction button in top nav: "Send Kiss" or "Send Poke" (icon or text)
2. Tapping sends interaction to NocoDB backend
3. Recipient receives notification badge on icon
4. Tapping notification badge shows interaction with animation:
   - Kiss: animated hearts or kiss lips
   - Poke: playful nudge animation
5. Interaction marked as "viewed" after animation plays
6. Interaction history viewable (last 7 days)
7. Can send unlimited interactions (no daily limit)

**Prerequisites:** Story 6.4

---

**Story 6.6: Anniversary Countdown Timers**

As your girlfriend,
I want to see countdowns to our anniversaries,
So that I can look forward to special dates.

**Acceptance Criteria:**
1. Settings page allows adding custom countdown: name, date
2. Home view displays next upcoming countdown (days, hours, minutes remaining)
3. Countdown updates in real-time (or on page load)
4. Multiple countdowns supported (shows nearest one)
5. When countdown reaches zero: celebration animation triggers
6. Past anniversaries marked as "Celebrated" with date passed
7. Edit and delete countdowns in settings

**Prerequisites:** Story 6.2 (mood tracking sets pattern for settings/features)

---

**Epic 6 Summary:**
- **Total Stories:** 6
- **Estimated Effort:** Medium-High (backend integration adds complexity)
- **Deliverable:** Mood tracking, poke/kiss interactions, anniversary countdowns

---

## FR Coverage Matrix

This detailed matrix shows exactly which story(ies) implement each functional requirement, ensuring complete traceability from requirements to implementation.

| FR | Requirement | Epic | Story | Implementation Notes |
|---|---|---|---|---|
| **FR001** | Persist user data across sessions | Epic 1 | Story 1.2 | Zustand persist middleware |
| **FR002** | Restore application state on init | Epic 1 | Story 1.2 | State hydration on load |
| **FR003** | Handle storage quota gracefully | Epic 1 | Story 1.2 | Error handling for quota exceeded |
| **FR004** | Pre-configure relationship data | Epic 1 | Story 1.4 | Hardcoded constants in config |
| **FR005** | Auto-display relationship duration | Epic 1 | Story 1.4 | Calculate from start date |
| **FR006** | 365 message library | Epic 3 | Story 3.1 | Expand from 100 to 365 messages |
| **FR007** | One message per day rotation | Epic 3 | Story 3.3 | Date-based deterministic algorithm |
| **FR008** | Swipe to previous messages | Epic 3 | Story 3.2 | Horizontal swipe gesture support |
| **FR009** | Prevent forward navigation | Epic 3 | Story 3.2 | Block swipe beyond today |
| **FR010** | Favorite messages | Epic 1 | Story 1.2 | Persist favorites in state |
| **FR011** | Share messages | Epic 3 | Story 3.2 | Native share API or clipboard |
| **FR012** | Upload photos with captions | Epic 4 | Story 4.1 | File picker + caption input |
| **FR013** | Carousel gallery view | Epic 4 | Story 4.3 | Full-screen lightbox with swipe |
| **FR014** | IndexedDB photo storage | Epic 4 | Story 4.1 | Compression + IndexedDB |
| **FR015** | Photo gallery navigation | Epic 4 | Story 4.5 | Top nav integration |
| **FR016** | Anniversary countdown display | Epic 6 | Story 6.6 | Real-time countdown timer |
| **FR017** | Multiple custom countdowns | Epic 6 | Story 6.6 | Settings to add/manage countdowns |
| **FR018** | Celebration animations | Epic 6 | Story 6.6 | Trigger animation at zero |
| **FR019** | Log daily mood | Epic 6 | Story 6.2 | 5 mood types with UI |
| **FR020** | Sync moods to backend | Epic 6 | Story 6.1, 6.4 | NocoDB API integration |
| **FR021** | Mood history calendar | Epic 6 | Story 6.3 | Calendar view component |
| **FR022** | Optional mood notes | Epic 6 | Story 6.2 | Note field with mood entry |
| **FR023** | Poke/kiss actions | Epic 6 | Story 6.5 | Send interaction via NocoDB |
| **FR024** | Animated reactions | Epic 6 | Story 6.5 | Heart/nudge animations |
| **FR025** | Interaction history | Epic 6 | Story 6.5 | Last 7 days viewable |
| **FR026** | Review AI suggestions | Epic 3 | Story 3.6 | AI message generation (optional) |
| **FR027** | Accept/decline interface | Epic 3 | Story 3.6 | Approval UI (optional) |
| **FR028** | Create custom messages | Epic 3 | Story 3.4 | Message creation form |
| **FR029** | Edit existing messages | Epic 3 | Story 3.5 | Edit + persist to IndexedDB |
| **FR030** | Integrate custom messages | Epic 3 | Story 3.5 | Include in rotation algorithm |
| **FR031** | Top navigation bar | Epic 1 | Story 1.4 | Home, Photos, Mood, Settings tabs |
| **FR032** | Consistent theme | Epic 1 | Story 1.5 | Theme system refactoring |
| **FR033** | Support 4 existing themes | Epic 1 | Story 1.5 | Sunset, Ocean, Lavender, Rose Garden |

**Coverage Status:**
- ✅ All 33 FRs mapped to specific stories
- ✅ No orphaned requirements
- ✅ Complete traceability from PRD → Epic → Story

---

## Story Guidelines Reference

**Story Format:**

```
**Story [EPIC.N]: [Story Title]**

As a [user type],
I want [goal/desire],
So that [benefit/value].

**Acceptance Criteria:**
1. [Specific testable criterion]
2. [Another specific criterion]
3. [etc.]

**Prerequisites:** [Dependencies on previous stories, if any]
```

**Story Requirements:**

- **Vertical slices** - Complete, testable functionality delivery
- **Sequential ordering** - Logical progression within epic
- **No forward dependencies** - Only depend on previous work
- **AI-agent sized** - Completable in 2-4 hour focused session
- **Value-focused** - Integrate technical enablers into value-delivering stories

---

**For implementation:** Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown.
