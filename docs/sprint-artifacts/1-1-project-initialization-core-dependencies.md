# Story 1.1: Project Initialization & Core Dependencies

Status: drafted

## Story

As a **developer**,
I want **the React Native + Expo project structure established with all core dependencies**,
So that **subsequent feature development has a solid foundation**.

## Acceptance Criteria

1. **AC1**: Expo SDK 54 project created via `npx create-expo-app@latest my-love-mobile --template blank-typescript` and project runs without errors on `npx expo start`
   - TypeScript configuration is strict mode enabled
   - iOS 15.0+ and Android 10+ minimum targets set (FR60, FR61)

2. **AC2**: All core dependencies install without version conflicts:
   - Expo Router ^4.0.0 (file-based routing)
   - TanStack Query v5.90+ (server state management)
   - React Native Paper v5 (UI framework)
   - MMKV v4 (local storage)
   - Supabase JS client v2.79+ (backend integration)
   - Expo packages: notifications, linking, secure-store, haptics, image-picker
   - @react-native-community/netinfo ^11.0.0 (network status)
   - react-native-safe-area-context ^4.0.0 (safe area handling)

3. **AC3**: Project structure matches Architecture document specification:

   ```
   app/
     _layout.tsx
     index.tsx
     (auth)/
     (tabs)/
   src/
     components/
     hooks/
     lib/
     providers/
     theme/
     types/
     utils/
   ```

4. **AC4**: app.json configured with scheme: "mylove" for deep linking (FR4)

5. **AC5**: Environment variable placeholders configured in .env.local:
   - EXPO_PUBLIC_SUPABASE_URL
   - EXPO_PUBLIC_SUPABASE_ANON_KEY
   - EXPO_PUBLIC_APP_SCHEME=mylove

6. **AC6**: Metro bundler configured for tree-shaking and path aliases set up for @/ imports

7. **AC7**: TypeScript paths configured in tsconfig.json for absolute imports (@/components, @/hooks, etc.)

8. **AC8**: Basic placeholder files created in all required directories to establish structure

## Tasks / Subtasks

- [ ] **Task 1: Initialize Expo Project** (AC: 1)
  - [ ] Run `npx create-expo-app@latest my-love-mobile --template blank-typescript`
  - [ ] Navigate into project directory
  - [ ] Verify project compiles and starts with `npx expo start`
  - [ ] Confirm TypeScript strict mode is enabled in tsconfig.json

- [ ] **Task 2: Install Core Dependencies** (AC: 2)
  - [ ] Install Expo packages: `npx expo install expo-router expo-notifications expo-linking expo-secure-store expo-haptics expo-image-picker`
  - [ ] Install Supabase client: `npm install @supabase/supabase-js@^2.79.0`
  - [ ] Install TanStack Query: `npm install @tanstack/react-query@^5.90.0`
  - [ ] Install React Native Paper: `npm install react-native-paper@^5.0.0`
  - [ ] Install MMKV: `npm install react-native-mmkv@^4.0.0`
  - [ ] Install NetInfo: `npm install @react-native-community/netinfo@^11.0.0`
  - [ ] Install Safe Area Context: `npm install react-native-safe-area-context@^4.0.0`
  - [ ] Verify no version conflicts in package.json
  - [ ] Test that all dependencies install successfully with `npm install`

- [ ] **Task 3: Configure Expo Router** (AC: 3, 4)
  - [ ] Update app.json to include scheme: "mylove"
  - [ ] Configure expo-router plugin in app.json with origin
  - [ ] Create app/\_layout.tsx as root layout file
  - [ ] Create app/index.tsx as entry point
  - [ ] Create app/(auth)/\_layout.tsx for auth group
  - [ ] Create app/(tabs)/\_layout.tsx for main tab navigation
  - [ ] Create app/+not-found.tsx for 404 handling

- [ ] **Task 4: Setup Source Code Structure** (AC: 3, 8)
  - [ ] Create src/components/ directory with subdirectories:
    - src/components/core/
    - src/components/love-notes/
    - src/components/mood/
    - src/components/photos/
    - src/components/shared/
  - [ ] Create src/hooks/ directory
  - [ ] Create src/lib/ directory
  - [ ] Create src/providers/ directory
  - [ ] Create src/theme/ directory
  - [ ] Create src/types/ directory
  - [ ] Create src/utils/ directory
  - [ ] Add .gitkeep or placeholder index.ts files to maintain structure

- [ ] **Task 5: Configure TypeScript Paths** (AC: 7)
  - [ ] Update tsconfig.json to add baseUrl and paths for @/ imports
  - [ ] Configure paths for: @/components/_, @/hooks/_, @/lib/_, @/providers/_, @/theme/_, @/types/_, @/utils/\*
  - [ ] Verify imports resolve correctly in IDE

- [ ] **Task 6: Configure Metro Bundler** (AC: 6)
  - [ ] Create or update metro.config.js for tree-shaking
  - [ ] Configure resolver for path aliases
  - [ ] Verify bundler starts without errors

- [ ] **Task 7: Setup Environment Configuration** (AC: 5)
  - [ ] Create .env.local with placeholder variables
  - [ ] Add .env.local to .gitignore
  - [ ] Create .env.example with documented placeholders
  - [ ] Verify environment variables accessible via process.env.EXPO*PUBLIC*\*

- [ ] **Task 8: Configure Platform Targets** (AC: 1)
  - [ ] Update app.json with iOS configuration:
    - supportsTablet: true
    - bundleIdentifier: com.mylove.app
    - iOS minimum version targeting
  - [ ] Update app.json with Android configuration:
    - package: com.mylove.app
    - adaptiveIcon configuration
    - Android 10+ targeting

- [ ] **Task 9: Verification Testing** (AC: 1, 2)
  - [ ] Run `npx expo start` and verify no errors
  - [ ] Test iOS simulator launch (if available)
  - [ ] Test Android emulator launch (if available)
  - [ ] Verify all imports resolve correctly
  - [ ] Check TypeScript compilation without errors
  - [ ] Document any warnings or deprecation notices

## Dev Notes

### Architecture Alignment

This story establishes the foundational project structure that all subsequent Epic 1 stories will build upon. Key architectural patterns from the Architecture document:

- **ADR 004**: Expo Router for file-based navigation with deep linking support
- **ADR 005**: MMKV v4 as fast local storage (Nitro Module)
- **ADR 006**: TanStack Query v5 for server state management

### Technology Constraints

- **Expo SDK 54** managed workflow - no native code ejection needed
- **React Native 0.81** (latest stable via Expo SDK 54)
- **TypeScript strict mode** for type safety across codebase
- **Minimum targets**: iOS 15.0+ / Android 10+ (FR60, FR61)

### Critical Dependencies

From [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Dependencies-and-Integrations]:

```json
{
  "dependencies": {
    "expo": "~54.0.0",
    "expo-router": "^4.0.0",
    "expo-linking": "~7.1.0",
    "expo-secure-store": "~14.1.0",
    "expo-haptics": "~14.1.0",
    "expo-notifications": "~0.32.0",
    "expo-image-picker": "~16.0.0",
    "@supabase/supabase-js": "^2.79.0",
    "@tanstack/react-query": "^5.90.0",
    "react-native-mmkv": "^4.0.0",
    "react-native-paper": "^5.0.0",
    "react-native-safe-area-context": "^4.0.0",
    "@react-native-community/netinfo": "^11.0.0",
    "react-native": "0.81.0",
    "react": "18.2.0",
    "typescript": "~5.3.0"
  }
}
```

### Project Structure Notes

- **Alignment with unified project structure**:
  - app/ directory for Expo Router file-based routing
  - src/ directory for application code (components, hooks, lib, providers, theme, types, utils)
  - Clean separation between routing (app/) and business logic (src/)

- **Path alias configuration**:
  - Use @/ prefix for absolute imports (e.g., @/components/core/ThemedButton)
  - Improves code readability and refactoring capability
  - Standard pattern in modern React Native projects

### Testing Notes

- **No automated tests in this story** - focus is on project scaffolding
- **Manual verification**: Project compiles, starts, and renders placeholder content
- **Future stories will add**: Unit tests (Jest), component tests (React Native Testing Library), E2E tests (Detox/Maestro)

### Security Considerations

- **Environment variables** use EXPO*PUBLIC* prefix (exposed to client bundle)
- **Sensitive keys** (anon key) are designed for client use with RLS protection
- **No secrets** should be committed - .env.local is gitignored
- **.env.example** provides documentation without real values

### Performance Baseline

From [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Non-Functional-Requirements]:

- **NFR-P1**: Cold start target < 2 seconds to interactive
- **NFR-P7**: TanStack Query caching with stale-while-revalidate pattern
- This story establishes the minimal foundation to achieve these targets

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-1.md] - Complete Epic 1 technical specification
- [Source: docs/architecture.md#Project-Structure] - Canonical project structure definition
- [Source: docs/architecture.md#Project-Initialization] - Initialization commands and setup
- [Source: docs/epics.md#Story-1.1] - Story breakdown and acceptance criteria
- [Source: docs/architecture.md#ADR-004] - Expo Router decision rationale
- [Source: docs/architecture.md#ADR-005] - MMKV storage decision rationale
- [Source: docs/architecture.md#ADR-006] - TanStack Query decision rationale

### Learnings from Previous Story

First story in epic - no predecessor context.

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- Will be filled by dev agent during implementation -->

### Debug Log References

<!-- Will be filled during implementation -->

### Completion Notes List

<!-- Will be filled upon story completion -->

### File List

<!-- Will be filled with NEW, MODIFIED, DELETED files during implementation -->
