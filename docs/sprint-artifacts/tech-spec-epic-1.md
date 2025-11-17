# Epic Technical Specification: Foundation & Authentication

Date: 2025-11-16
Author: Frank
Epic ID: 1
Status: Draft

---

## Overview

This technical specification provides the implementation blueprint for Epic 1: Foundation & Authentication, which establishes the core infrastructure for My-Love Mobile. The epic delivers the foundational project setup, Supabase backend integration, magic link authentication, session persistence, and network resilience - enabling all subsequent feature development.

Epic 1 is the critical first step that transforms the PRD's vision of "deeper connection through native mobile performance" into a working React Native + Expo application skeleton with secure, passwordless authentication. The epic ensures that partners can securely access their intimate connection app with minimal friction while establishing the technical patterns that all subsequent epics will leverage.

## Objectives and Scope

**In Scope:**

- React Native + Expo SDK 54 project initialization with TypeScript
- Expo Router file-based navigation structure
- TanStack Query v5 server state management configuration
- Supabase JS client v2.79+ integration (Auth, Database, Realtime, Storage)
- React Native Paper v5 UI framework with Coral Heart theme foundation
- MMKV v4 local storage for preferences
- Secure token storage via Expo SecureStore
- Magic link (passwordless) authentication flow with deep linking
- Session persistence across app launches (30-day timeout)
- Logout functionality with proper cleanup
- Network status detection and offline resilience
- iOS 15.0+ / Android 10+ platform targeting

**Out of Scope:**

- Feature-specific screens (Love Notes, Mood Tracker, Photos, etc.)
- Push notification implementation (Epic 3)
- Biometric authentication setup (Epic 7)
- Partner pairing/relationship setup (assumed pre-existing in Supabase)
- App Store/Google Play submission
- Production EAS Build configuration
- Privacy policy and legal documents

## System Architecture Alignment

This epic implements the foundational architecture decisions from the Architecture document:

**Key Architectural Patterns Referenced:**

- **ADR 001:** Online-first architecture with TanStack Query caching (not offline-first sync)
- **ADR 002:** React Native Paper for UI with heavy theming customization
- **ADR 004:** Expo Router for file-based navigation with deep linking
- **ADR 005:** MMKV for fast local storage (preferences, not sensitive data)
- **ADR 006:** TanStack Query for server state management

**Technology Constraints:**

- Expo SDK 54 managed workflow (no native code ejection)
- Supabase as sole backend provider (Auth, Database, Realtime, Storage)
- TypeScript strict mode for type safety
- Minimum targets: iOS 15.0+ / Android 10+ (FR60, FR61)

**Security Requirements:**

- NFR-S1: Session tokens in SecureStore (device keychain), not plain storage
- NFR-S6: 30-day session timeout with server-side revocation
- NFR-I1: Supabase JS Client v2.79+ compatibility with graceful degradation

## Detailed Design

### Services and Modules

| Module                                                 | Responsibility                                         | Inputs                                         | Outputs                                         |
| ------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------- |
| **Supabase Client** (`src/lib/supabase.ts`)            | Configure Supabase connection with SecureStore adapter | Environment variables (SUPABASE_URL, ANON_KEY) | Configured client instance                      |
| **Auth Provider** (`src/providers/AuthProvider.tsx`)   | Manage authentication state and session lifecycle      | Supabase client, user events                   | Auth context with user, session, loading states |
| **Query Provider** (`src/providers/QueryProvider.tsx`) | Provide TanStack Query client to app tree              | QueryClient configuration                      | QueryClientProvider wrapper                     |
| **Theme Provider** (`src/providers/ThemeProvider.tsx`) | Provide React Native Paper theming                     | Theme tokens (Coral Heart)                     | PaperProvider with custom theme                 |
| **Storage** (`src/lib/storage.ts`)                     | MMKV storage wrapper for preferences                   | Key-value pairs                                | Persistent local storage                        |
| **Network Monitor** (`src/hooks/useNetworkStatus.ts`)  | Monitor network connectivity changes                   | NetInfo events                                 | Online/offline/connecting states                |
| **Root Layout** (`app/_layout.tsx`)                    | Wire all providers and establish app structure         | Child routes                                   | Provider-wrapped navigation tree                |

### Data Models and Contracts

**User Session (Supabase Auth):**

```typescript
interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: User;
}

interface User {
  id: string;
  email: string;
  app_metadata: {
    provider?: string;
  };
  user_metadata: {
    display_name?: string;
    partner_id?: string;
  };
  created_at: string;
}
```

**Auth Context State:**

```typescript
interface AuthContextState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}
```

**Network Status:**

```typescript
type NetworkStatus = 'online' | 'offline' | 'connecting';

interface NetworkState {
  status: NetworkStatus;
  lastSyncedAt: Date | null;
  isInternetReachable: boolean;
}
```

**Theme Tokens:**

```typescript
const tokens = {
  colors: {
    primary: '#FF6B6B',
    secondary: '#FFA8A8',
    surface: '#FFF5F5',
    dark: '#C92A2A',
    background: '#FFFFFF',
    text: '#495057',
    success: '#51CF66',
    warning: '#FCC419',
    error: '#FF6B6B',
    info: '#339AF0',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 8, md: 12, lg: 16, full: 9999 },
};
```

### APIs and Interfaces

**Supabase Auth API (Magic Link):**

```typescript
// Send magic link email
const { error } = await supabase.auth.signInWithOtp({
  email: userEmail,
  options: {
    emailRedirectTo: 'mylove://auth/callback',
  },
});

// Get current session
const {
  data: { session },
  error,
} = await supabase.auth.getSession();

// Sign out
const { error } = await supabase.auth.signOut();

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    /* handle sign in */
  }
  if (event === 'SIGNED_OUT') {
    /* handle sign out */
  }
  if (event === 'TOKEN_REFRESHED') {
    /* token auto-refreshed */
  }
});
```

**Deep Link Schema:**

```
mylove://                       # App scheme (configured in app.json)
mylove://auth/callback          # Magic link verification endpoint
```

**Error Codes:**

- `invalid_grant`: Magic link expired or already used
- `invalid_request`: Malformed authentication request
- `invalid_credentials`: Invalid token during verification
- Network errors: Standard fetch errors, retryable

### Workflows and Sequencing

**Magic Link Authentication Flow:**

```
1. User opens app → Check for existing session
2. If no session → Show Login screen
3. User enters email → Validate (RFC 5322)
4. Tap "Send Magic Link" → supabase.auth.signInWithOtp()
5. Email sent → Show "Check your email" message
6. User receives email → Tap magic link
7. Deep link opens app → mylove://auth/callback?token=xxx
8. Expo Linking intercepts → Extract token
9. Supabase verifies token → Session established
10. Session stored in SecureStore → User redirected to Home
11. Auth state updated → App re-renders authenticated state
```

**App Launch Flow:**

```
1. App launches (cold/warm start)
2. Root layout mounts providers
3. AuthProvider checks SecureStore for existing session
4. If session found → Validate with Supabase
5. If valid → Set authenticated state, skip login
6. If invalid/expired → Clear storage, show login
7. If no session → Show login screen
8. Network status monitoring starts
```

**Logout Flow:**

```
1. User taps "Log Out" in Settings
2. supabase.auth.signOut() called
3. Server revokes session
4. SecureStore cleared (tokens only)
5. TanStack Query cache cleared
6. MMKV preferences retained (theme, etc.)
7. Navigation reset to Login screen
8. Auth state updated to unauthenticated
```

## Non-Functional Requirements

### Performance

**NFR-P1 (App Launch Time):**

- Cold start target: < 2 seconds to interactive
- Warm start target: < 500ms to interactive
- Implementation: Minimal initial bundle, lazy load non-essential modules
- Measurement: Profile with React Native Performance Monitor on physical devices

**NFR-P7 (TanStack Query Caching):**

- Cache configuration with stale-while-revalidate pattern
- Background refetch on app focus
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)

### Security

**NFR-S1 (Authentication Security):**

- Magic link tokens expire after 60 minutes (Supabase default)
- Session tokens stored in SecureStore (OS keychain/keystore)
- No passwords stored on device
- Biometric auth uses OS secure enclave (Epic 7)

**NFR-S6 (Session Management):**

- Session timeout: 30 days of inactivity
- Manual logout clears server-side session
- Device-specific sessions (multi-device support)
- Automatic token refresh handled by Supabase client

### Reliability/Availability

**NFR-R3 (Offline Resilience):**

- Show cached data marked as potentially stale when offline
- Fail write operations immediately with retry prompt (no offline queue)
- App remains navigable with cached content
- Network recovery triggers automatic TanStack Query refetch

**NFR-I1 (Supabase Client Compatibility):**

- Compatible with Supabase JS Client v2.79+
- Graceful degradation on service unavailability
- Retry logic for transient network failures

### Observability

**Logging Strategy:**

```typescript
const logger = {
  error: (msg: string, ctx?: object) => console.error(`[ERROR] ${msg}`, ctx),
  warn: (msg: string, ctx?: object) => console.warn(`[WARN] ${msg}`, ctx),
  info: (msg: string, ctx?: object) => __DEV__ && console.info(`[INFO] ${msg}`, ctx),
  debug: (msg: string, ctx?: object) => __DEV__ && console.debug(`[DEBUG] ${msg}`, ctx),
};

// Log events:
// - Authentication events (login, logout, token refresh)
// - Network status changes
// - Session expiration
// - Error occurrences
```

**Privacy Compliance:**

- Never log email content or tokens
- Log only event types and metadata
- No sensitive user data in logs

## Dependencies and Integrations

**Core Dependencies (package.json):**

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

**DevDependencies:**

```json
{
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@types/react": "~18.2.0",
    "@types/react-native": "~0.73.0",
    "typescript": "~5.3.0"
  }
}
```

**Environment Configuration:**

```bash
# .env.local (not committed)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_APP_SCHEME=mylove
```

**Platform Targeting:**

```json
// app.json
{
  "expo": {
    "scheme": "mylove",
    "ios": { "supportsTablet": true, "bundleIdentifier": "com.mylove.app" },
    "android": { "package": "com.mylove.app", "adaptiveIcon": {} },
    "plugins": [["expo-router", { "origin": "https://mylove.app" }]]
  }
}
```

## Acceptance Criteria (Authoritative)

**AC1:** Project initializes successfully with `npx expo start` without errors (FR60, FR61, FR62, FR63)

**AC2:** All core dependencies install without version conflicts (Expo SDK 54, Supabase 2.79+, TanStack Query 5.90+, MMKV v4, React Native Paper v5)

**AC3:** Project structure matches Architecture document specification (app/, src/components/, src/hooks/, src/lib/, src/providers/, src/theme/, src/types/, src/utils/)

**AC4:** Supabase client connects successfully using environment variables and SecureStore adapter (NFR-S1)

**AC5:** TanStack Query provider wraps application with proper configuration (staleTime: 0, retry: 3, refetchOnWindowFocus: true)

**AC6:** React Native Paper theme applies Coral Heart colors (Primary #FF6B6B, Surface #FFF5F5, Text #495057)

**AC7:** User can enter email and request magic link with validation (FR1)

**AC8:** Magic link deep links successfully intercept `mylove://auth/callback` and complete authentication (FR4)

**AC9:** Session persists across app launches via SecureStore (FR2)

**AC10:** User can log out, clearing session from SecureStore and server (FR3)

**AC11:** Network status indicator displays correct state: online (green), connecting (yellow), offline (red) (FR64)

**AC12:** Offline mode shows cached data with staleness indication and fails write operations with retry prompt (NFR-R3)

**AC13:** App launches in < 2 seconds cold start on target devices (NFR-P1)

**AC14:** Session automatically refreshes without user intervention (NFR-S6)

**AC15:** Error messages are user-friendly, not technical jargon (NFR-R2)

## Traceability Mapping

| AC # | Tech Spec Section   | Component(s) / API(s)                               | Test Idea                                                       |
| ---- | ------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| AC1  | Project Structure   | Root project, package.json, tsconfig.json           | Run `npx expo start`, verify no errors in console               |
| AC2  | Dependencies        | package.json                                        | Run `npm install`, check for version conflict warnings          |
| AC3  | Project Structure   | Folder structure                                    | File system check for all required directories                  |
| AC4  | Supabase Client     | `src/lib/supabase.ts`, Expo SecureStore             | Mock Supabase connection, verify token storage in SecureStore   |
| AC5  | Query Provider      | `src/lib/queryClient.ts`, QueryProvider             | Verify QueryClientProvider wraps app, check retry config        |
| AC6  | Theme Provider      | `src/theme/tokens.ts`, ThemeProvider                | Visual inspection of color application across components        |
| AC7  | Auth Flow           | Login screen, `supabase.auth.signInWithOtp()`       | Enter valid email, verify API call made with correct redirectTo |
| AC8  | Deep Linking        | `app.json scheme`, Expo Linking                     | Trigger deep link, verify auth completion flow                  |
| AC9  | Session Persistence | AuthProvider, SecureStore                           | Close app, reopen, verify auto-login without prompt             |
| AC10 | Logout Flow         | `supabase.auth.signOut()`, SecureStore, QueryClient | Tap logout, verify all caches cleared, redirected to login      |
| AC11 | Network Status      | `useNetworkStatus`, StatusIndicator                 | Toggle airplane mode, verify indicator color changes            |
| AC12 | Offline Resilience  | TanStack Query cache, Network Monitor               | Disconnect network, verify cached data shows with stale marker  |
| AC13 | Performance         | Root layout, minimal bundle                         | Profile with Performance Monitor, measure time to interactive   |
| AC14 | Session Management  | Supabase client auto-refresh                        | Wait for token expiration, verify seamless refresh              |
| AC15 | Error Handling      | Error utilities, toast components                   | Trigger network error, verify friendly message displayed        |

## Risks, Assumptions, Open Questions

**Risks:**

1. **RISK: Magic Link Deep Linking Failure in Production Builds** (MEDIUM)
   - Risk: Deep linking may behave differently in TestFlight/production vs development
   - Mitigation: Test auth flow in TestFlight builds early, document exact app.json configuration, use Expo Router's built-in deep link handling
   - Contingency: Provide manual token entry fallback

2. **RISK: SecureStore Limitations on Older Devices** (LOW)
   - Risk: SecureStore may not work correctly on minimum supported devices (iOS 15.0, Android 10)
   - Mitigation: Test on minimum target devices, implement fallback to encrypted AsyncStorage if needed
   - Contingency: Graceful degradation with security warning

3. **RISK: TanStack Query Cache Invalidation Complexity** (MEDIUM)
   - Risk: Improper cache invalidation may cause stale data issues
   - Mitigation: Establish clear query key conventions from start, document invalidation patterns
   - Contingency: Conservative cache settings initially, tune based on testing

**Assumptions:**

- **A1:** Supabase project is already configured with Auth enabled and magic link support
- **A2:** User profiles table exists in Supabase with partner_id relationship established
- **A3:** Both partners have already been paired in existing web PWA (no pairing flow needed)
- **A4:** Network connectivity is generally available (online-first architecture acceptable)
- **A5:** Developer has Node.js 20+, npm 10+, and Expo CLI installed
- **A6:** EAS CLI access configured for future builds (not required for Epic 1)

**Open Questions:**

1. **Q1:** Should session timeout be configurable or fixed at 30 days?
   - Current: Fixed at 30 days per NFR-S6
   - Alternative: User preference in settings

2. **Q2:** What is the exact relationship schema for partner_id in user_metadata vs separate table?
   - Current: Assume user_metadata.partner_id
   - Need: Confirm with existing Supabase schema

3. **Q3:** Should network status banner be dismissible or always visible when offline?
   - Current: Always visible when offline
   - Alternative: Dismissible with persistent indicator

## Test Strategy Summary

**Test Levels:**

1. **Unit Tests** (Jest + React Native Testing Library)
   - Auth hook state management
   - Network status detection logic
   - Theme token application
   - MMKV storage wrapper functions
   - Date/validation utilities

2. **Integration Tests**
   - Provider composition (Auth + Query + Theme)
   - Supabase client initialization
   - Deep link routing with Expo Router
   - SecureStore token persistence

3. **E2E Tests** (Detox or Maestro)
   - Complete magic link flow (simulated)
   - Session persistence across app restart
   - Logout flow clearing all state
   - Network status indicator transitions

4. **Manual Testing Checklist**
   - [ ] Magic link email delivery
   - [ ] Deep link interception on iOS/Android
   - [ ] Session restore after 24+ hours
   - [ ] Logout clears credentials but retains preferences
   - [ ] Offline indicator accurate with airplane mode
   - [ ] Cold start < 2 seconds on physical device
   - [ ] Warm start < 500ms

**Coverage Targets:**

- Unit tests: 80%+ coverage on utils, hooks, providers
- Integration tests: All critical user paths (auth, session, network)
- E2E tests: Core happy paths (login, persist, logout)

**Test Frameworks:**

- Jest for unit testing
- React Native Testing Library for component tests
- Detox or Maestro for E2E (future story if needed)

---

_Generated by BMAD Epic Tech Context Workflow_
_Date: 2025-11-16_
_Epic: Foundation & Authentication (Epic 1)_
_Status: Ready for Implementation_
