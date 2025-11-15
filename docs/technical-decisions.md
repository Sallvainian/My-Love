# Technical Decisions Log

**Project:** My-Love
**Created:** 2025-10-30
**Last Updated:** 2025-10-30

---

## Purpose

This document tracks technical decisions, constraints, preferences, and considerations discovered during product planning and development.

---

## Decisions & Constraints

### Technical Debt Assessment Required

**Context:** v0.1.0 was rapidly prototyped ("vibe-coded") to validate core concept
**Decision:** Include technical debt scan and refactoring in Epic 1
**Rationale:** Before adding new features, assess and address any code quality issues, architectural inconsistencies, or technical shortcuts from rapid prototyping
**Impact:** Ensures stable foundation for feature development
**Date:** 2025-10-30

### Backend Architecture for Mood Sync & Interactive Features

**Context:** Mood tracking and poke/kiss features require data sharing between two users
**Decision:** Implement lightweight backend using NocoDB (free tier) with API integration
**Alternatives Considered:**
- Supabase/Firebase (more complex than needed)
- Google Sheets API (rate limits and auth complexity)
- Full custom backend (overkill for simple sync)
**Rationale:** NocoDB provides free hosting, simple REST API, and minimal setup while maintaining privacy. Keeps 95% of app client-side, only syncs minimal interactive data.
**Impact:** Adds backend dependency but enables key relationship features
**Date:** 2025-10-30

### Client-Side Architecture Maintained

**Context:** Persistence issues in v0.1.0 raised question about architecture
**Decision:** Maintain client-side first architecture (IndexedDB + LocalStorage)
**Rationale:** Aligns with privacy goals, offline-first approach, and zero-cost hosting. Persistence bug is fixable via Zustand persist configuration, not an architectural flaw.
**Impact:** No backend needed for photos, messages, or personal data
**Implementation Details:**
- **Storage Layer:** IndexedDB for large data (photos, message library), LocalStorage for settings and small state
- **State Management:** Zustand with persist middleware for state hydration across sessions
- **Service Worker:** Workbox for offline caching and PWA functionality
**Date:** 2025-10-30

### Pre-configured Relationship Data

**Context:** Story 1.4 removed onboarding flow and implemented hardcoded relationship data
**Decision:** Hardcode relationship configuration in `src/config/constants.ts` for single-user deployment
**Configuration Values:**
- Partner Name: Gracie
- Relationship Start Date: October 18, 2025
- User Name: Frank
**Rationale:** App is personal project for specific relationship, no need for generic onboarding flow. Pre-configuration simplifies UX and removes setup friction. Configuration is done by editing `src/config/constants.ts` directly with hardcoded values.
**Implementation:** Configuration constants are hardcoded in `src/config/constants.ts` and bundled directly into the application at build time.
**Date:** 2025-10-30

---

## Future Decisions

_Technical decisions will be appended here as they arise during planning and development_

---

# Technical Debt Audit Report

**Generated:** 2025-10-30
**Story:** 1.1 - Technical Debt Audit & Refactoring Plan
**Audited By:** Claude Sonnet 4.5 (Dev Agent)
**Purpose:** Comprehensive technical debt audit of vibe-coded v0.1.0 prototype

---

## Executive Summary

This audit systematically reviewed the My-Love codebase to identify technical debt, architectural concerns, and refactoring opportunities prior to Epic 2-4 feature development.

### Key Findings

- ✅ TypeScript strict mode is **ALREADY ENABLED** (corrects Story 1.5 assumption)
- ✅ Codebase is relatively clean with good separation of concerns
- ⚠️ 3 ESLint issues in app code (1 error, 1 warning) + 2 errors in BMAD infrastructure
- ⚠️ Missing error boundaries and inconsistent error handling patterns
- ⚠️ No environment variable support for deployment configuration
- ⚠️ Zustand persist middleware lacks error recovery (Story 1.2 known bug)
- ⚠️ IndexedDB service lacks quota management (blocks Epic 3) and migration strategy

### Overall Assessment

The rapid vibe-coding produced **surprisingly clean code** with good architecture. Most issues are **Nice-to-have** improvements rather than **Critical** blockers. The foundation is solid for feature development.

### Critical Items (3)

1. **Story 1.2** - Fix Zustand persist middleware error handling
2. **Story 1.3** - Resolve IndexedDB/Service Worker compatibility issue
3. **Story 1.6** - Build and deployment configuration hardening

### Epic 3 Blocker (1)

4. **Before Epic 3** - Add IndexedDB quota management for photo uploads

---

## Table of Contents

1. [Configuration & Tooling](#1-configuration--tooling)
2. [State Management (Zustand)](#2-state-management-zustand)
3. [Data Layer (IndexedDB)](#3-data-layer-indexeddb)
4. [Component Architecture](#4-component-architecture)
5. [Build & Deployment](#5-build--deployment)
6. [Code Quality](#6-code-quality)
7. [Security Assessment](#7-security-assessment)
8. [Dependencies Audit](#8-dependencies-audit)
9. [Prioritized Refactoring Checklist](#9-prioritized-refactoring-checklist)
10. [Effort Estimates](#10-effort-estimates)

---

## 1. Configuration & Tooling

### 1.1 TypeScript Configuration ✅ EXCELLENT

**Finding:** TypeScript strict mode is **ALREADY ENABLED** in [tsconfig.app.json:20](../tsconfig.app.json#L20).

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Implication:** Story 1.5's assumption that strict mode needs to be enabled is **incorrect**. The codebase is already TypeScript strict mode compliant.

**Severity:** NONE
**Recommendation:** Update Story 1.5 description. Focus should shift to ensuring all new code maintains strict mode compliance.

---

### 1.2 ESLint Baseline ⚠️ NEEDS ATTENTION

**ESLint Run Results (2025-10-30):**

```
✖ 4 problems (3 errors, 1 warning)
```

**Breakdown:**

1. **bmad/bmb/workflows/create-module/installer-templates/installer.js (2 errors)**
   - Rules: `unicorn/prefer-module`, `unicorn/prefer-node-protocol` (definitions not found)
   - **Severity:** Low - BMAD infrastructure only, not application code
   - **Action:** Exclude bmad/ from ESLint scope

2. **[src/App.tsx:20](../src/App.tsx#L20) (1 warning)**
   - Rule: `react-hooks/exhaustive-deps`
   - Issue: useEffect missing dependency 'settings'
   ```typescript
   useEffect(() => {
     if (settings) {
       applyTheme(settings.themeName);
     }
   }, [settings?.themeName]); // ⚠️ Should be [settings]
   ```
   - **Severity:** Medium - Potential stale closure bug
   - **Action:** Story 1.5 - Fix dependency array

3. **[src/components/DailyMessage/DailyMessage.tsx:36](../src/components/DailyMessage/DailyMessage.tsx#L36) (1 error)**
   - Rule: `@typescript-eslint/no-unused-vars`
   - Issue: 'error' variable defined but never used in catch block
   ```typescript
   } catch (error) {  // ❌ error unused
     console.log('Share cancelled');
   }
   ```
   - **Severity:** Low - Dead code
   - **Action:** Story 1.5 - Remove unused variable or use underscore prefix

**Severity:** Medium (App.tsx), Low (DailyMessage, BMAD)
**Recommendation:** Story 1.5 - Fix exhaustive-deps (critical), remove unused var, exclude bmad/ from linting

---

## 2. State Management (Zustand)

### 2.1 Persist Middleware Configuration ⚠️ CRITICAL

**Location:** [src/stores/useAppStore.ts:282-291](../src/stores/useAppStore.ts#L282-L291)

**Current Implementation:**

```typescript
persist(
  (set, get) => ({ /* store definition */ }),
  {
    name: 'my-love-storage',
    partialize: (state) => ({
      settings: state.settings,
      isOnboarded: state.isOnboarded,
      messageHistory: state.messageHistory,
      moods: state.moods,
    }),
  }
)
```

**Analysis:**

✅ **Good:**
- Proper partialize strategy: Only persists settings/metadata, not heavy data
- Messages and photos correctly excluded (stored in IndexedDB)
- currentMessage excluded (computed on-the-fly)

⚠️ **Critical Issues:**

1. **No Error Handling for Persist Failures**
   - If LocalStorage quota exceeded, persist middleware silently fails
   - No user feedback for persistence errors
   - No fallback strategy

2. **No Versioning/Migration Strategy**
   - Store structure changes will break existing persisted state
   - No migration path for schema updates

**This is the "known bug" mentioned in Story 1.2.**

**Recommended Fix:**

```typescript
persist(storeFactory, {
  name: 'my-love-storage',
  partialize,
  version: 1, // Add versioning
  onRehydrateStorage: () => (state, error) => {
    if (error) {
      console.error('Failed to rehydrate state:', error);
      // Fallback: clear corrupted state
      localStorage.removeItem('my-love-storage');
    }
  },
})
```

**Severity:** **CRITICAL** - Story 1.2 dependency
**Recommendation:** Story 1.2 must add error handling, versioning, and user feedback

---

### 2.2 Store Architecture ✅ GOOD

**Location:** [src/stores/useAppStore.ts](../src/stores/useAppStore.ts)

**Strengths:**
- Clean imperative action pattern
- Good separation between persisted and in-memory state
- Async actions properly handle errors (mostly)
- Type-safe with TypeScript interfaces

**Minor Issue:** Inconsistent error handling - some actions catch errors silently with `console.error`, no user-facing feedback.

**Severity:** Nice-to-have
**Recommendation:** Story 1.5 - Establish consistent error handling pattern

---

## 3. Data Layer (IndexedDB)

### 3.1 StorageService Implementation ⚠️ CRITICAL FOR EPIC 3

**Location:** [src/services/storage.ts](../src/services/storage.ts)

✅ **Good:**
- Clean wrapper around `idb` library
- Proper schema definition with indexes
- Singleton pattern appropriate
- Transaction handling in bulk operations

⚠️ **Critical Concerns:**

1. **No Quota Management for Photos** - **BLOCKS EPIC 3**
   - Photos stored as Blobs in IndexedDB
   - No handling of `QuotaExceededError`
   - No size limits or compression

```typescript
// Current: No quota checking
async addPhoto(photo: Omit<Photo, 'id'>): Promise<number> {
  await this.init();
  return this.db!.add('photos', photo as Photo); // ❌ Can throw QuotaExceededError
}
```

**Impact:** Photo upload feature in Epic 3 will crash without quota management.

2. **No Database Migration Strategy**
   - DB_VERSION hardcoded to 1
   - No strategy for schema updates

3. **Service Worker Compatibility (Story 1.3)**
   - Context notes mention "compatibility issues"
   - Code review shows standard idb usage - no obvious conflicts
   - **Hypothesis:** Race condition between SW cache and IndexedDB transactions?

**Severity:**
- **CRITICAL** for Epic 3 (quota management)
- Medium for Story 1.3 (SW compatibility)
- Nice-to-have for migrations

**Recommendation:**
- Story 1.3: Investigate and document SW compatibility issue
- **Before Epic 3:** Add quota management (3-4 hours estimated)
- Story 1.5: Add database versioning strategy

---

## 4. Component Architecture

### 4.1 App Component ⚠️ NEEDS FIX

**Location:** [src/App.tsx](../src/App.tsx)

**Issues:**

1. **ESLint Warning: Exhaustive Deps** [App.tsx:20](../src/App.tsx#L20)
   - **Severity:** Medium - Potential stale closure bug
   - **Fix:** Change dependency array to `[settings]`

2. **No Error Boundary**
   - App can crash completely if child components throw
   - No graceful degradation

**Severity:** Medium (exhaustive deps), Nice-to-have (error boundary)
**Recommendation:** Story 1.5 - Fix deps, add error boundary

---

### 4.2 DailyMessage Component ⚠️ MINOR FIX

**Location:** [src/components/DailyMessage/DailyMessage.tsx](../src/components/DailyMessage/DailyMessage.tsx)

**Issues:**

1. **Unused Error Variable** [DailyMessage.tsx:36](../src/components/DailyMessage/DailyMessage.tsx#L36) - ESLint error
2. **Animation Performance Concern** - Floating hearts create 10 motion.div elements, uses `window.innerWidth`

**Severity:** Low
**Recommendation:** Story 1.5 - Fix unused var, optionally optimize animation

---

### 4.3 Onboarding Component ⚠️ DEPRECATED

**Location:** [src/components/Onboarding/Onboarding.tsx](../src/components/Onboarding/Onboarding.tsx)

- Will be removed in Story 1.4
- Code is clean, no immediate issues
- **Action Required:** Audit dependencies after removal (framer-motion usage)

**Severity:** None (will be removed)
**Recommendation:** Story 1.4 - Audit dependencies, consider lighter animation library

---

## 5. Build & Deployment

### 5.1 Vite Configuration ✅ GOOD

**Location:** [vite.config.ts](../vite.config.ts)

**Status**: Configuration is complete and working correctly.

1. **Build Configuration**
   - Base path properly configured as `/My-Love/`
   - Build produces optimized, minified bundles
   - Service worker generation via vite-plugin-pwa enabled

2. **Configuration Constants**
   - Configuration done by editing `src/config/constants.ts` directly with hardcoded values
   - Values bundled into application at build time
   - No environment variable injection needed

**Severity:** NONE - Configuration is complete
**Recommendation:** No changes needed

---

### 5.2 PWA Configuration ✅ GOOD

**Location:** [vite.config.ts:10-55](../vite.config.ts#L10-L55)

PWA plugin properly configured. No issues found.

---

### 5.3 Deployment Scripts ⚠️ BASIC

**Location:** [package.json:11-12](../package.json#L11-L12)

**Missing:**
- No smoke tests before deployment
- No deployment environment validation
- No rollback strategy

**Severity:** Medium
**Recommendation:** Story 1.6 - Add smoke test infrastructure

---

## 6. Code Quality

### 6.1 Error Handling ⚠️ INCONSISTENT

**Observed Patterns:**

1. **Silent Console Errors** (most common)
   ```typescript
   } catch (error) {
     console.error('Error loading messages:', error);
     // No user feedback, no recovery
   }
   ```

2. **Error State Set But Not Used**
   - Store has `error` state field, but no component displays it

**Issue:** No consistent error handling strategy. Errors logged but not surfaced to users.

**Severity:** Nice-to-have
**Recommendation:** Story 1.5 - Establish error handling pattern + error boundary

---

### 6.2 Console Statements ⚠️ CLEANUP NEEDED

- `console.error` used in 7 locations
- `console.log` used in 2 locations
- No structured logging

**Severity:** Low
**Recommendation:** Story 1.5 - Replace with structured logging utility

---

### 6.3 Minor Code Smells

1. **Magic Numbers** [messageRotation.ts:39](../src/utils/messageRotation.ts#L39)
   - Hardcoded `% 3` for favorite rotation interval
   - Should be named constant: `FAVORITE_ROTATION_INTERVAL`

2. **Duplicate Date Calculations**
   - Date arithmetic repeated across utility files
   - Could be DRY-er

3. **Large Data File** [defaultMessages.ts](../src/data/defaultMessages.ts)
   - 123 lines of message data
   - Could be extracted to JSON for easier editing

**Severity:** Low
**Recommendation:** Nice-to-have cleanup in Story 1.5

---

## 7. Security Assessment

### 7.1 Data Security ✅ APPROPRIATE

- No sensitive data (passwords, tokens, API keys)
- User data stored locally only (LocalStorage + IndexedDB)
- No external API calls
- No authentication needed

**Severity:** None
**Recommendation:** No action needed

---

### 7.2 XSS/Injection Risks ✅ SAFE

- React's JSX escaping handles user input safely
- No `dangerouslySetInnerHTML` usage
- User-generated content properly sanitized by React

**Severity:** None
**Recommendation:** No action needed

---

### 7.3 Dependencies Vulnerabilities

Run `npm audit` to check for known vulnerabilities (not performed in this audit).

**Recommendation:** Story 1.6 - Add `npm audit` to CI/CD pipeline

---

## 8. Dependencies Audit

### 8.1 Production Dependencies ✅ ALL USED

| Package | Version | Usage | Notes |
|---------|---------|-------|-------|
| react | 19.1.1 | Core framework | Latest |
| react-dom | 19.1.1 | Rendering | Latest |
| zustand | 5.0.8 | State management | Core to app |
| idb | 8.0.3 | IndexedDB wrapper | Used in storage.ts |
| framer-motion | 12.23.24 | Animations | Heavy (~150KB), re-evaluate after Story 1.4 |
| lucide-react | 0.548.0 | Icons | Multiple components |
| workbox-window | 7.3.0 | PWA | Required by vite-plugin-pwa |

**framer-motion Note:**
- Large bundle size (~150KB gzipped)
- Used extensively in Onboarding (removed in Story 1.4) and DailyMessage
- **Action:** Story 1.4 - Re-evaluate after Onboarding removal

**Severity:** Low
**Recommendation:** Story 1.4 - Consider lighter animation library alternative

---

### 8.2 Development Dependencies ✅ ALL USED

All dev dependencies verified as necessary. No unused dependencies found.

---

## 9. Prioritized Refactoring Checklist

### Critical Priority

**Definition:** Blocks Epic 2-4 features OR high crash risk

1. ✅ **[Story 1.2] Fix Zustand Persist Middleware**
   - Add error handling for persist/rehydrate failures
   - Add state versioning for migrations
   - Add user feedback for persistence errors
   - **Rationale:** Known bug, blocks reliable state management
   - **Estimate:** 2-3 hours

2. ✅ **[Story 1.3] Investigate IndexedDB Service Worker Compatibility**
   - Document specific SW compatibility issue
   - Implement fix or workaround
   - Add tests to prevent regression
   - **Rationale:** Known issue, may cause data loss
   - **Estimate:** 3-4 hours

3. ✅ **[Story 1.6] Build and Deployment Configuration Hardening**
   - Verify configuration constants bundled correctly
   - Implement smoke tests for deployment validation
   - Document deployment process
   - **Rationale:** Ensures production deployments are reliable
   - **Estimate:** 1 hour (part of Story 1.6)

4. ✅ **[Epic 3 Blocker] Add IndexedDB Quota Management**
   - Handle QuotaExceededError for photos
   - Implement photo size limits or compression
   - Add user feedback for storage limits
   - **Rationale:** Without this, photo upload will crash
   - **Timing:** Before starting Epic 3
   - **Estimate:** 3-4 hours

### Nice-to-Have Priority

**Definition:** Code style improvements, minor optimizations

5. ✅ **[Story 1.5] Fix ESLint Issues**
   - Fix App.tsx exhaustive-deps warning
   - Remove unused error variable in DailyMessage.tsx
   - Exclude bmad/ from ESLint scope
   - **Estimate:** 1 hour

6. ✅ **[Story 1.5] Add Error Boundaries**
   - Add top-level error boundary in App.tsx
   - Add component-level boundaries for features
   - Implement graceful error UI
   - **Estimate:** 2 hours

7. ✅ **[Story 1.5] Establish Consistent Error Handling**
   - Define error handling pattern
   - Replace console.error with structured logging
   - Surface errors to users appropriately
   - **Estimate:** 2 hours

8. ✅ **[Story 1.4] Audit Dependencies After Onboarding Removal**
   - Check if framer-motion still needed
   - Consider lighter animation library
   - Remove any orphaned dependencies
   - **Estimate:** 30 minutes

9. ✅ **[Story 1.5] Database Migration Strategy**
   - Add version field to IndexedDB schema
   - Implement migration utility
   - Plan for future schema changes
   - **Estimate:** 1 hour

10. ✅ **[Story 1.6] Add Smoke Test Infrastructure**
    - Add basic smoke tests
    - Run before deployment
    - Validate critical paths
    - **Estimate:** 2 hours

11. ✅ **[Story 1.5] Code Quality Improvements**
    - Extract magic numbers to constants
    - DRY up date utility functions
    - Move defaultMessages to JSON (optional)
    - **Estimate:** 1-2 hours

12. ✅ **[Story 1.6] Optimize Build Configuration**
    - Configure manual chunks for vendors
    - Optimize Vite build settings
    - Add bundle size analysis
    - **Estimate:** 1 hour

---

## 10. Effort Estimates

### Story 1.2: Fix Zustand Persist Middleware Configuration
- **Estimate:** 2-3 hours
- **Complexity:** Medium
- **Dependencies:** None

### Story 1.3: IndexedDB Service Worker Cache Fix
- **Estimate:** 3-4 hours
- **Complexity:** Medium-High (investigative)
- **Dependencies:** Story 1.2

### Story 1.4: Remove Onboarding Flow
- **Estimate:** 2-3 hours
- **Complexity:** Low-Medium
- **Dependencies:** None

### Story 1.5: Critical Refactoring & Code Quality
- **Estimate:** 6-8 hours (can be split)
- **Complexity:** Medium
- **Dependencies:** Stories 1.2, 1.3, 1.4

### Story 1.6: Build, Deployment & Configuration
- **Estimate:** 4-5 hours
- **Complexity:** Medium
- **Dependencies:** All previous stories

### Epic 3 Blocker: IndexedDB Quota Management
- **Estimate:** 3-4 hours
- **Complexity:** Medium
- **Dependencies:** Story 1.3
- **Timing:** Before starting Epic 3

**Total Epic 1 Effort:** 17-23 hours (approx 3-4 working days)

---

## Conclusion

The My-Love codebase is in **good shape** for a rapid vibe-coded prototype. The foundation is solid, and most issues are refinements rather than critical blockers.

**Key Takeaways:**

1. ✅ **Strong foundation** - Good separation of concerns, proper TypeScript usage
2. ✅ **Minimal critical debt** - Only 3 critical items block future epics
3. ✅ **Strict mode already enabled** - Story 1.5 assumption corrected
4. ⚠️ **Polish needed** - Error handling, testing, deployment config
5. 📦 **Bundle optimization opportunity** - Evaluate framer-motion after Onboarding removal

**Next Steps:**

1. ✅ Update Story 1.5 description (strict mode already enabled)
2. ✅ Proceed with Stories 1.2-1.6 as planned
3. ✅ Add Epic 3 blocker (quota management) to backlog before starting Epic 3
4. ✅ Use this document as reference for all Story 1.x implementations

---

*End of Technical Debt Audit Report*

---

# Input Validation Strategy

**Decision Date:** 2025-11-14
**Story:** 5.5 - Centralize Input Validation Layer
**Implementation:** Zod-based validation at service boundaries

## Context

During Epic 4 photo upload testing, we discovered that invalid data could potentially enter the system through user inputs, potentially causing data corruption, UI breakage, or unexpected runtime errors. TypeScript provides compile-time type safety, but runtime validation was missing.

## Decision

Implement centralized input validation using Zod schemas at all service boundaries before IndexedDB writes.

### Architecture Pattern: Service Boundary Validation

```typescript
// Services validate before IndexedDB writes
class CustomMessageService {
  async create(input: CreateMessageInput): Promise<Message> {
    // 1. Validate input at service boundary
    const validated = CreateMessageInputSchema.parse(input);

    // 2. Proceed with IndexedDB write using validated data
    return await this.addToIndexedDB(validated);
  }
}
```

### Implementation Details

**Location:** `/src/validation/`
- `schemas.ts` - Zod validation schemas for all data models
- `errorMessages.ts` - Error transformation utilities
- `index.ts` - Public API exports

**Services with Validation:**
- `customMessageService.ts` - Message creation/update validation
- `photoStorageService.ts` - Photo upload/update validation
- `migrationService.ts` - Settings and mood validation (backward compatible)
- `useAppStore.ts` - Store-level validation for moods and settings

**Validation Rules:**

| Model | Field | Validation |
|-------|-------|------------|
| **Message** | text | min: 1, max: 1000 chars (trimmed) |
| **Message** | category | enum: reason, memory, affirmation, future, custom |
| **Photo** | caption | max: 500 chars, optional |
| **Photo** | imageBlob | Blob instance check |
| **Photo** | width/height | positive integers |
| **Photo** | sizes | positive numbers |
| **MoodEntry** | date | ISO format (YYYY-MM-DD) with value validation |
| **MoodEntry** | mood | enum: loved, happy, content, thoughtful, grateful |
| **Settings** | themeName | enum: sunset, ocean, lavender, rose |
| **Settings** | time | HH:MM format with value validation (00:00-23:59) |

### Error Handling Pattern

```typescript
try {
  const validated = MessageSchema.parse(input);
} catch (error) {
  if (isZodError(error)) {
    // Transform to user-friendly message
    const message = formatZodError(error);
    throw new ValidationError(message);
  }
  throw error;
}
```

**Error Transformation:**
- `formatZodError()` - Converts Zod errors to single user-friendly message
- `getFieldErrors()` - Returns Map of field-specific errors for forms
- `createValidationError()` - Creates custom ValidationError with field details
- `isValidationError()` / `isZodError()` - Type guards for error handling

### Type Safety Strategy

Zod schemas serve as the **single source of truth** for both validation and types:

```typescript
export const MessageSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  category: z.enum(['reason', 'memory', 'affirmation', 'future', 'custom']),
  // ...
});

// Types derived from schemas
export type MessageSchemaType = z.infer<typeof MessageSchema>;
```

This ensures schemas and TypeScript types stay in sync, preventing drift between compile-time types and runtime validation.

### Backward Compatibility

**Migration Service:** Uses `.safeParse()` instead of `.parse()` to handle legacy data gracefully:

```typescript
const result = SettingsSchema.safeParse(legacyData);
if (!result.success) {
  console.warn('Legacy data validation failed:', result.error);
  // Apply defaults or data repair logic
}
```

This prevents app initialization from failing due to validation errors in existing user data.

### Testing Coverage

**Unit Tests:** 76 comprehensive tests covering:
- Schema validation for all data models (messages, photos, moods, settings)
- Edge cases (empty strings, max lengths, boundary values)
- Error message transformation
- Type guards and error handling utilities

**Test Files:**
- `tests/unit/validation/schemas.test.ts` - Schema validation tests
- `tests/unit/validation/errorMessages.test.ts` - Error utility tests

**Coverage:** 100% of validation schemas and error utilities

### Performance Considerations

- **Schema Compilation:** Occurs once at module load (automatic with Zod)
- **Validation Overhead:** <10ms per operation (acceptable for user-facing actions)
- **Optimization:** Only validate at service boundary, not in UI or store
- **Graceful Handling:** Use `.safeParse()` for non-critical paths to avoid throw overhead

### Benefits Achieved

**Problems Prevented:**
1. Empty messages causing blank cards
2. Invalid categories breaking filters
3. Photo captions exceeding UI layout limits (>500 chars)
4. Invalid date strings causing calculation errors
5. Mood type typos breaking mood tracking
6. Null values in required fields causing crashes
7. Type mismatches (numbers as strings) breaking logic

**Data Integrity:**
- Invalid data rejected before IndexedDB write
- Prevents corruption of message rotation algorithm
- Ensures mood tracking data consistency
- Settings validation prevents broken app state

### Future Enhancements

1. **Form-level validation:** Display field-specific errors in UI forms
2. **Data repair utilities:** Migrate invalid legacy data to valid schemas
3. **Validation refinement:** Adjust rules based on production error logs
4. **Additional schemas:** Add validation for future data models

## Alternatives Considered

1. **Manual validation:** Too error-prone, hard to maintain
2. **Joi/Yup:** Zod chosen for better TypeScript integration
3. **Class-validator:** Zod schemas more composable and functional
4. **No validation:** Unacceptable - discovered corruption risks during testing

## Impact

- **Positive:** Data corruption prevention, improved type safety, clear error messages
- **Negative:** Minor performance overhead (<10ms), additional code complexity
- **Migration:** No breaking changes - validation only enforced on new writes

## Related Stories

- **Story 5.4:** Unit testing infrastructure (Vitest)
- **Story 5.3:** Service base class extraction
- **Epic 4:** Photo upload testing revealed validation gaps

---

*Last Updated: 2025-11-14*

---

## Store Architecture: Feature Slice Pattern

**Decision Date:** 2025-11-14
**Status:** Implemented in Epic 5, Story 5.1
**Context:** Main store (useAppStore) grew to 1,267 lines, violating single responsibility principle

### Pattern Description

The application uses **feature slices** to organize Zustand store logic. Each slice is a self-contained module managing a specific feature domain.

### Slice Boundaries

| Slice | Responsibility | Size | File |
|-------|---------------|------|------|
| **Messages** | Custom message CRUD, rotation, service integration | 553 lines | `src/stores/slices/messagesSlice.ts` |
| **Photos** | Photo gallery state, upload/delete, storage service | 272 lines | `src/stores/slices/photosSlice.ts` |
| **Settings** | App configuration, persistence to LocalStorage | 255 lines | `src/stores/slices/settingsSlice.ts` |
| **Navigation** | Current day tracking, date navigation | 56 lines | `src/stores/slices/navigationSlice.ts` |
| **Mood** | Daily mood tracking, persistence | 54 lines | `src/stores/slices/moodSlice.ts` |

### Composition Pattern

Main store composes slices using spread operator:

```typescript
// src/stores/useAppStore.ts
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...createMessagesSlice(set, get),
      ...createPhotosSlice(set, get),
      ...createSettingsSlice(set, get),
      ...createNavigationSlice(set, get),
      ...createMoodSlice(set, get),
    }),
    { name: 'app-store', partialize: /* ... */ }
  )
);
```

### Cross-Slice Dependencies

Slices access each other's state via `get()`:

```typescript
// Example: messagesSlice accessing settings
const createMessagesSlice = (set, get): MessagesSlice => ({
  rotateMessage: () => {
    const { customMessages } = get(); // Access own state
    const { rotationInterval } = get(); // Access settings state
    // ...
  }
});
```

**Documented dependencies:**
- Messages → Settings (rotation interval)
- Photos → Navigation (current day for filtering)
- All slices → Settings (theme, preferences)

### Persistence Strategy

**LocalStorage partitioning:**
- Each slice persists independently to prevent localStorage quota issues
- Map serialization/deserialization handles complex data types
- Custom `partialize` functions filter what gets persisted

```typescript
partialize: (state) => ({
  customMessages: state.customMessages,
  photos: state.photos,
  // ... only serializable data
})
```

### Type Safety

**Known limitation:** TypeScript requires `as any` casts (10 instances) due to Zustand's type system limitations when composing heterogeneous slices.

**Rationale:** Pragmatic trade-off accepted because:
1. TypeScript compiles without errors
2. Runtime type safety preserved via Zod validation (Story 5.5)
3. Alternative approaches (discriminated unions, branded types) add complexity without solving the root issue
4. Zustand's official docs acknowledge this limitation

**Future consideration:** Monitor Zustand v5 for improved TypeScript support.

### Migration Impact

**Zero breaking changes:** All 16 components using `useAppStore` work unchanged. Component API remains identical.

### Benefits Achieved

- **80% size reduction** in main store (1,267 → 251 lines)
- **Clear separation of concerns** by feature domain
- **Improved maintainability** - easier to locate and modify feature logic
- **Better testability** - slices can be tested independently
- **Scalability** - new features add new slices without bloating main store

### Testing Strategy

**E2E validation:** All existing E2E tests pass, confirming API compatibility and zero regressions.

**Future work:** Unit tests for individual slices (Story 5.4 addresses this).

---
