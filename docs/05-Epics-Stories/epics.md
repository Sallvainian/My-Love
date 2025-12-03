# My-Love - Epic Breakdown

**Author:** Frank
**Date:** 2025-11-16
**Updated:** 2025-11-17 (Platform Pivot: Native Mobile → PWA Enhancement)
**Project Level:** PWA Enhancement & Bug Fix
**Target Scale:** Two-person intimate PWA (Web browsers - Desktop/Mobile)

> **Document Version:** 2.0 (Platform Pivot Update)
> **Status:** Fully rewritten for PWA audit, bug fixes, and feature enhancement
> **Stack:** React 19 + Vite 7 + Zustand + Tailwind CSS + Supabase

---

## Overview

This document provides the complete epic and story breakdown for My-Love PWA enhancement, decomposing the requirements from the [PRD](./prd.md) into implementable stories. The focus is on **auditing and fixing the existing PWA codebase**, then adding new features. Each story is designed to be completable by a single dev agent in one focused session.

**Living Document Notice:** Version 2.0 reflects platform pivot from React Native mobile to PWA enhancement. All stories now focus on web APIs, existing codebase audit, and incremental feature development.

### Workflow Mode: PWA ENHANCEMENT

**Mode:** AUDIT & ENHANCE
**Context Completeness:** Full (PRD, Architecture, and Epics all updated for PWA)
**Update Date:** 2025-11-17

### Available Context Summary

| Document          | Status          | Key Contributions                                                |
| ----------------- | --------------- | ---------------------------------------------------------------- |
| PRD               | ✅ Updated v2.0 | 65 FRs revised for PWA, Web Push API, browser APIs               |
| Architecture      | ✅ Updated v2.0 | React 19 + Vite 7 + Zustand stack documented                     |
| UX Design         | ⏳ Needs Update | Coral Heart theme valid, adapt for web responsive                |
| Existing Codebase | ✅ Available    | React 19, Vite 7, Zustand, Tailwind, Supabase already configured |

**Approach:** Epic 1 prioritizes PWA stabilization (audit, bug fixes, deployment repair). Subsequent epics add features on stable foundation.

## Epic Structure Summary

**Total Epics: 8** | **Total FRs: 65** | **All FRs Covered: ✅**

### Epic 0: Deployment & Backend Infrastructure Setup

**Goal:** Establish automated deployment pipeline and backend connection infrastructure
**User Value:** Reliable deployment automation and working backend connection as TRUE foundation
**FRs Covered:** FR60, FR65, partial FR1-4 (4+ FRs)
**Stories:** 5 (GitHub Actions pipeline, Env vars/secrets, Supabase init, E2E validation, Monitoring)

### Epic 1: PWA Foundation Audit & Stabilization

**Goal:** Audit existing codebase, fix bugs, repair deployment, ensure stable foundation
**User Value:** Reliable, bug-free app that works consistently across browsers
**FRs Covered:** FR1-4, FR60-65 (10 FRs)
**Stories:** 5 (Codebase audit, Supabase config validation, Auth flow fixes, Session management, Network resilience)

### Epic 2: Love Notes Real-Time Messaging

**Goal:** Partners can exchange instant love notes with real-time delivery
**User Value:** Send and receive love notes instantly - the core differentiating feature
**FRs Covered:** FR7-13 (7 FRs)
**Stories:** 5 (Database schema, Chat UI, Send messages, Realtime subscription, Scroll performance)

### Epic 3: Push Notifications & Daily Engagement

**Goal:** App actively engages partners throughout the day via notifications
**User Value:** Stay connected even when app is closed, never miss a love note or daily message
**FRs Covered:** FR6, FR9, FR14-21, FR38-39, FR42, FR47 (14 FRs)
**Stories:** 6 (Permission flow, Token storage, Love Note alerts, Daily message notifications, URL routing, Notification history)

### Epic 4: Dashboard & Daily Connection

**Goal:** At-a-glance partner connection status with daily love messages
**User Value:** Quick overview of partner's state and daily romantic inspiration
**FRs Covered:** FR36-37, FR45-46, FR55-59, FR64 (10 FRs)
**Stories:** 5 (Feature Hub home, Partner mood display, Days together counter, Daily message rotation, Offline indicator)

### Epic 5: Mood Tracking & Transparency

**Goal:** Partners share emotional states with full transparency
**User Value:** Know how your partner is feeling throughout the day
**FRs Covered:** FR22-28 (7 FRs)
**Stories:** 4 (Mood emoji picker, Quick logging flow, Partner mood viewing, Mood history timeline)

### Epic 6: Photo Gallery & Memories

**Goal:** Partners share and browse photo memories together
**User Value:** Visual memory collection that both partners can enjoy
**FRs Covered:** FR29-35 (7 FRs)
**Stories:** 4 (Photo selection/compression, Upload with progress, Gallery grid view, Full-screen viewer with gestures)

### Epic 7: Settings, Interactions & Personalization

**Goal:** Customize experience and send playful partner interactions
**User Value:** Personal preferences, theme control, and fun poke/kiss interactions
**FRs Covered:** FR5, FR40-44, FR48-54 (10 FRs)
**Stories:** 5 (Theme toggle/dark mode, Biometric auth, Notification preferences, Partner pokes/kisses, Profile management)

---

## Functional Requirements Inventory

### User Account & Authentication (6 FRs)

- **FR1:** Users can authenticate via Supabase (email/password or Google OAuth)
- **FR2:** Users maintain authenticated sessions across browser sessions
- **FR3:** Users can log out and re-authenticate as needed
- **FR4:** App handles authentication URL redirects for OAuth callbacks
- **FR5:** Users can optionally enable biometric authentication (WebAuthn) for convenience unlock
- **FR6:** System stores push notification subscriptions in user profile for notification delivery

### Love Notes - Real-Time Messaging (7 FRs)

- **FR7:** Users can send text messages to their partner through Love Notes
- **FR8:** Users receive partner's Love Notes in real-time via Supabase Realtime subscription
- **FR9:** System delivers push notification when new Love Note arrives
- **FR10:** Users can view complete Love Notes message history with scroll-back
- **FR11:** Love Notes display sender identification and timestamp on each message
- **FR12:** System provides optimistic update (message appears immediately before server confirmation)
- **FR13:** System provides haptic feedback (Vibration API) on Love Note send and receive

### Push Notification Infrastructure (8 FRs)

- **FR14:** System sends daily love message notification at 7:00 AM user's timezone
- **FR15:** System sends push notification immediately when partner sends Love Note
- **FR16:** Users can configure optional mood reminder notifications at custom time
- **FR17:** System sends milestone/anniversary notifications on special dates
- **FR18:** Users can tap notifications to navigate directly to relevant screen via URL routing
- **FR19:** App displays in-app notification history as fallback if push fails
- **FR20:** System requests notification permission on first launch with clear value explanation
- **FR21:** App handles notifications in both foreground (in-app banner) and background (service worker) states

### Mood Tracking (7 FRs)

- **FR22:** Users can log current mood by selecting from 12 emotion options
- **FR23:** Users can optionally add brief text note with mood entry
- **FR24:** Users can view their partner's mood entries (full transparency model)
- **FR25:** Users can view mood history timeline showing entries over time
- **FR26:** Mood logging completes in under 5 seconds (quick access priority)
- **FR27:** System provides haptic feedback (Vibration API) on mood save confirmation
- **FR28:** System syncs mood entries to Supabase for partner visibility

### Photo Gallery (7 FRs)

- **FR29:** Users can select photos from device using File API for upload
- **FR30:** System compresses images using Canvas API before uploading to Supabase Storage
- **FR31:** Users see upload progress indicator during photo upload
- **FR32:** Users can view shared gallery showing both partners' photos
- **FR33:** Gallery displays thumbnails for efficient browsing
- **FR34:** Users can tap photo to view full-screen with swipe/zoom gestures
- **FR35:** System syncs uploaded photos to Supabase for partner visibility

### Daily Love Messages (4 FRs)

- **FR36:** System displays today's love message from 365-message rotation library
- **FR37:** System determines which message to display based on deterministic rotation algorithm
- **FR38:** Users receive push notification with daily message preview at scheduled time
- **FR39:** Users can tap daily message notification to view full message in app

### Partner Interactions (5 FRs)

- **FR40:** Users can send partner poke interaction
- **FR41:** Users can send partner kiss interaction
- **FR42:** System notifies partner when poke/kiss is received
- **FR43:** System provides playful haptic feedback (Vibration API) on poke/kiss send
- **FR44:** Users can view history of partner interactions

### Anniversary & Milestones (3 FRs)

- **FR45:** App displays days together countdown from relationship start date
- **FR46:** System calculates and shows upcoming milestones (100 days, 1 year, etc.)
- **FR47:** System sends push notifications on milestone dates

### Settings & Preferences (7 FRs)

- **FR48:** Users can toggle between light mode and dark mode
- **FR49:** System detects browser/OS theme preference as default
- **FR50:** Theme preference persists across sessions via localStorage
- **FR51:** Users can enable/disable mood reminder notifications
- **FR52:** Users can configure mood reminder notification time
- **FR53:** Users can enable/disable biometric authentication (WebAuthn)
- **FR54:** Users can view and manage their profile information

### Dashboard & Overview (5 FRs)

- **FR55:** Dashboard displays partner's current/latest mood prominently
- **FR56:** Dashboard shows preview of last Love Note received
- **FR57:** Dashboard displays days together counter
- **FR58:** Dashboard shows snippet of today's daily love message
- **FR59:** Dashboard provides quick access navigation to all major features

### Technical Platform Requirements (6 FRs)

- **FR60:** App runs as Progressive Web App installable on mobile and desktop
- **FR61:** App is responsive across mobile (320px) to desktop (1920px) viewports
- **FR62:** App persists user preferences locally via localStorage/IndexedDB
- **FR63:** App uses Zustand stores with persistence for state management
- **FR64:** App provides visual indication when network is unavailable
- **FR65:** System stores all user data in Supabase with proper Row Level Security

---

**Total: 65 Functional Requirements** across 11 capability areas

---

## FR Coverage Map

| Epic                                                  | FRs Covered                                                                        | Total |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- | ----- |
| **Epic 0: Deployment & Backend Infrastructure Setup** | FR60, FR65, partial FR1-4 (backend connection)                                     | 4+    |
| **Epic 1: PWA Foundation Audit & Stabilization**      | FR1, FR2, FR3, FR4, FR60, FR61, FR62, FR63, FR64, FR65                             | 10    |
| **Epic 2: Love Notes Real-Time Messaging**            | FR7, FR8, FR9\*, FR10, FR11, FR12, FR13                                            | 7     |
| **Epic 3: Push Notifications & Daily Engagement**     | FR6, FR9\*, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR38, FR39, FR42, FR47 | 14    |
| **Epic 4: Dashboard & Daily Connection**              | FR36, FR37, FR45, FR46, FR55, FR56, FR57, FR58, FR59, FR64\*                       | 10    |
| **Epic 5: Mood Tracking & Transparency**              | FR22, FR23, FR24, FR25, FR26, FR27, FR28                                           | 7     |
| **Epic 6: Photo Gallery & Memories**                  | FR29, FR30, FR31, FR32, FR33, FR34, FR35                                           | 7     |
| **Epic 7: Settings, Interactions & Personalization**  | FR5, FR40, FR41, FR43, FR44, FR48, FR49, FR50, FR51, FR52, FR53, FR54              | 12    |

*FR9 appears in both Epic 2 (message display) and Epic 3 (push notification delivery)
*FR64 (offline indicator) is foundational but displayed on dashboard

**Coverage Verification:** All 65 FRs are mapped to at least one epic ✅

---

## Epic 0: Deployment & Backend Infrastructure Setup

**Goal:** Establish automated deployment pipeline and backend connection infrastructure

**User Value:** Reliable deployment automation and working backend connection as TRUE foundation for all subsequent work

**FRs Covered:** FR60 (deployment reliability), FR65 (network handling), partial FR1-4 (backend connection for auth)

---

### Story 0.1: GitHub Actions Deployment Pipeline Setup

**As a** developer,
**I want** to create an automated GitHub Actions workflow for deployment,
**So that** code changes automatically deploy to production on merge to main.

**Acceptance Criteria:**

**Given** My-Love PWA repository on GitHub
**When** GitHub Actions workflow is configured
**Then**

- `.github/workflows/deploy.yml` exists with Vite build and GitHub Pages deployment steps
- Workflow triggers on push to `main` branch
- Build process runs `npm install` and `npm run build`
- Built artifacts from `dist/` directory deploy to GitHub Pages
- Deployment succeeds and GitHub Pages URL is accessible
- Workflow status badge shows passing status

**Technical Context:**

- **Technology:** GitHub Actions, GitHub Pages, Vite build output
- **Files:** `.github/workflows/deploy.yml`, `vite.config.ts` (base path configuration)
- **Environment:** GitHub-hosted runner (ubuntu-latest), Node.js 20.x
- **Success Criteria:** Green deployment, accessible site at GitHub Pages URL

**Dependencies:** None (TRUE foundation story)

**Estimated Complexity:** Low (standard GitHub Actions + Vite build)

---

### Story 0.2: Environment Variables & Secrets Management

**As a** developer,
**I want** to properly configure environment variables and GitHub secrets,
**So that** production build has correct Supabase connection details without exposing secrets.

**Acceptance Criteria:**

**Given** Supabase project and GitHub repository
**When** environment variables are configured
**Then**

- `.env.example` file documents all required `VITE_` environment variables
- GitHub repository secrets contain production Supabase credentials:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- GitHub Actions workflow injects secrets into build environment
- Production build successfully accesses environment variables via `import.meta.env.VITE_*`
- Local development uses `.env.local` (gitignored) for dev credentials
- No secrets exposed in built JavaScript bundles (anon key is public-safe)

**Technical Context:**

- **Technology:** Vite environment variables (`VITE_` prefix), GitHub Secrets
- **Files:** `.env.example`, `.github/workflows/deploy.yml`, `.gitignore`
- **Security:** Supabase anon key is safe for public exposure (RLS protects data)
- **Success Criteria:** Build uses correct Supabase URL/key, no secret leakage

**Dependencies:** Story 0.1 (deployment workflow must exist to inject secrets)

**Estimated Complexity:** Low (standard Vite + GitHub Secrets pattern)

---

### Story 0.3: Supabase Project Initialization & Connection Setup

**As a** developer,
**I want** to initialize the Supabase project and verify connection from deployed PWA,
**So that** authentication and database features have working backend infrastructure.

**Acceptance Criteria:**

**Given** Supabase account and deployed PWA
**When** Supabase project is initialized
**Then**

- Supabase project created with appropriate region selection
- Database initialized with connection pooling configured
- Supabase client initialization code exists in `/src/lib/supabase.ts`
- Client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- Deployed PWA successfully connects to Supabase (verify via network tab)
- Console shows no Supabase connection errors
- Auth service responds (test login can be performed)

**Technical Context:**

- **Technology:** Supabase (PostgreSQL + Auth + Realtime), Supabase JS SDK
- **Files:** `/src/lib/supabase.ts`, Supabase project dashboard configuration
- **Connection:** HTTPS connection to Supabase cloud instance
- **Success Criteria:** Successful Supabase client initialization, auth API responds

**Dependencies:** Story 0.2 (environment variables must be configured)

**Estimated Complexity:** Low-Medium (Supabase project setup + connection validation)

---

### Story 0.4: Production Deployment End-to-End Validation

**As a** developer,
**I want** to validate the complete deployment pipeline works end-to-end,
**So that** I can confidently build subsequent features on a working foundation.

**Acceptance Criteria:**

**Given** GitHub Actions deployment workflow and Supabase connection configured
**When** end-to-end validation is performed
**Then**

- Make a trivial code change (e.g., update homepage text)
- Push change to `main` branch
- GitHub Actions workflow triggers automatically
- Build completes successfully (green checkmark)
- GitHub Pages reflects the updated change within 2 minutes
- Deployed site loads without errors (check browser console)
- Network tab shows successful Supabase connection
- Site is accessible on desktop and mobile browsers
- HTTPS certificate is valid (GitHub Pages auto-provides SSL)
- Performance Lighthouse score is acceptable (≥ 80 for PWA)

**Technical Context:**

- **Technology:** Full deployment pipeline + Supabase + GitHub Pages
- **Validation:** Browser DevTools (Console, Network, Lighthouse)
- **Success Criteria:** Zero-error deployment, working backend connection, fast load time

**Dependencies:** Story 0.1, 0.2, 0.3 (complete pipeline must exist)

**Estimated Complexity:** Low (validation story, not implementation)

---

### Story 0.5: Deployment Monitoring & Rollback Strategy (Optional)

**As a** developer,
**I want** to establish deployment monitoring and rollback procedures,
**So that** failed deployments can be quickly detected and reverted.

**Acceptance Criteria:**

**Given** working deployment pipeline
**When** monitoring and rollback strategy is established
**Then**

- GitHub Actions workflow includes health check step after deployment
- Health check verifies deployed site returns 200 status code
- Health check verifies Supabase connection succeeds (ping API)
- Workflow fails if health check fails (prevents bad deployment)
- Rollback procedure documented (revert commit or re-run previous successful workflow)
- Deployment notifications configured (optional: GitHub Actions status notifications)

**Technical Context:**

- **Technology:** GitHub Actions workflow steps, curl/wget for health checks
- **Monitoring:** Simple HTTP status + Supabase ping
- **Success Criteria:** Bad deployments caught, rollback process documented

**Dependencies:** Story 0.4 (validation must pass before adding monitoring)

**Estimated Complexity:** Low (simple health checks)

---

## Epic 1: PWA Foundation Audit & Stabilization

**Goal:** Audit existing codebase, fix bugs, repair deployment, ensure stable foundation

**User Value:** Reliable, bug-free app that works consistently across browsers

**FRs Covered:** FR1, FR2, FR3, FR4, FR60, FR61, FR62, FR63, FR64, FR65

---

### Story 1.1: Codebase Audit & Dependency Validation

**As a** developer,
**I want** to audit the existing PWA codebase and validate all dependencies,
**So that** I understand the current state and can identify issues to fix.

**Acceptance Criteria:**

**Given** existing PWA codebase with React 19 + Vite 7 + Zustand
**When** audit is performed
**Then**

- All dependencies in package.json are verified compatible (FR60)
- No security vulnerabilities identified via `npm audit`
- TypeScript strict mode enabled and no type errors (FR62)
- ESLint passes with no errors
- Vite build succeeds without warnings
- PWA manifest.json properly configured with app metadata
- Service worker (vite-plugin-pwa) properly configured
- All existing tests pass (Vitest + Playwright)

**And** project structure validated:

```
src/
  pages/              # Page components
  components/         # Shared UI components
  stores/             # Zustand state slices (FR63)
  hooks/              # Custom React hooks
  lib/                # Utilities and configurations
  types/              # TypeScript type definitions
public/
  manifest.json       # PWA manifest
  sw.js              # Service worker
```

**Prerequisites:** None (first story)

**Technical Notes:**

- Run `npm audit fix` for security vulnerabilities
- Verify React 19, Vite 7, Zustand 5, Tailwind 3 versions
- Check vite-plugin-pwa configuration for PWA compliance
- Validate Supabase client v2.81+ installed
- Document any deprecated APIs or patterns found

---

### Story 1.2: Supabase Client & Configuration Validation

**As a** developer,
**I want** to validate Supabase client configuration and connection,
**So that** backend services are properly accessible and secure.

**Acceptance Criteria:**

**Given** existing Supabase configuration
**When** validation is performed
**Then**

- `src/lib/supabase.ts` creates client with environment variables
- Environment variables properly loaded (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
- Supabase client connects successfully to project
- Auth session persistence uses localStorage with proper storage adapter
- Realtime subscription capability verified (FR8)
- Row Level Security policies accessible (FR65)

**And** Zustand stores properly configured:

- Persistence middleware uses localStorage (FR62)
- Store hydration works on page reload
- DevTools integration functional for debugging

**Given** browser storage limitations
**When** session data is stored
**Then**

- Session tokens stored in localStorage (not exceeding quotas)
- Refresh token rotation handled by Supabase client
- No sensitive data exposed in browser storage

**Prerequisites:** Story 1.1

**Technical Notes:**

- Verify .env file has VITE\_ prefix for Vite environment variables
- Test Supabase connection with simple query
- Ensure Zustand persist middleware configured correctly
- Check for any CORS issues with Supabase endpoints
- Validate RLS policies allow partner data access

---

### Story 1.4: Session Management & Persistence Fixes

**As a** user,
**I want** to stay logged in between browser sessions and have reliable logout,
**So that** I don't need to re-authenticate constantly but can control my session.

**Acceptance Criteria:**

**Given** user is authenticated
**When** browser is closed and reopened
**Then**

- Session automatically restored from localStorage (FR2)
- No login screen shown if valid session exists
- App loads directly to home/dashboard
- Session validity checked with Supabase (token refresh)

**Given** user clicks "Log Out"
**When** logout is confirmed
**Then**

- Supabase signOut() called successfully (FR3)
- localStorage cleared of session tokens
- Zustand stores reset to initial state
- User preferences (theme, settings) preserved
- User redirected to login page
- No stale data visible after logout

**And** session edge cases handled:

- Session expires during use: show re-auth prompt
- Multiple tabs: session sync across tabs
- Network loss during session: graceful degradation
- Corrupted session data: automatic cleanup

**Prerequisites:** Story 1.2

**Technical Notes:**

- Use supabase.auth.onAuthStateChange() listener
- Implement session refresh before expiry
- Handle localStorage quota exceeded errors
- Test with browser dev tools Application tab
- Verify no memory leaks from auth listeners

---

### Story 1.5: Network Status & Offline Resilience

**As a** user,
**I want** to know when I'm offline and understand what functionality is available,
**So that** I'm not confused when features don't work.

**Acceptance Criteria:**

**Given** device loses network connectivity
**When** app detects offline status
**Then**

- Status indicator changes to red dot with "Offline" text (FR64)
- Banner appears: "You're offline. Some features unavailable."
- Cached Zustand data still viewable (marked as potentially stale)
- Write operations (send message, log mood) fail with clear error
- No hanging requests or infinite spinners

**Given** device regains connectivity
**When** online status detected
**Then**

- Status indicator changes to green "Online"
- Banner dismisses with fade animation
- Zustand stores can resync with server
- Success feedback: "Back online"

**And** connection states properly handled:

- Online: Green indicator, full functionality
- Connecting: Yellow indicator, "Reconnecting..."
- Offline: Red indicator, read-only mode

**Given** PWA service worker is active
**When** user navigates while offline
**Then**

- Cached pages load from service worker
- Static assets available offline
- API calls fail gracefully with user feedback

**Prerequisites:** Story 1.2

**Technical Notes:**

- Use navigator.onLine and 'online'/'offline' events
- Implement custom useNetworkStatus hook
- Service worker caches static assets via Workbox
- Show stale data indicators for cached content
- Test offline mode in browser DevTools

---

## Epic 2: Love Notes Real-Time Messaging

**Goal:** Partners can exchange instant love notes with real-time delivery

**User Value:** Send and receive love notes instantly - the core differentiating feature

**FRs Covered:** FR7, FR8, FR10, FR11, FR12, FR13

---

### Story 2.0: Love Notes Database Schema Setup

**As a** developer,
**I want** the love_notes table and RLS policies created in Supabase,
**So that** messaging features have the required backend storage.

**Acceptance Criteria:**

**Given** Supabase project is accessible
**When** migration is applied
**Then**

- `love_notes` table created with columns: id (uuid), from_user_id (uuid FK), to_user_id (uuid FK), content (text), created_at (timestamptz)
- RLS enabled: users see only messages where they are sender OR recipient
- Index created on (to_user_id, created_at DESC) for efficient querying
- Supabase Realtime enabled on table for live updates
- Foreign keys reference auth.users with ON DELETE CASCADE

**Prerequisites:** None (first story in Epic 2)

**Technical Notes:**

- Use Supabase Dashboard SQL editor or migration file
- Test RLS by querying as different authenticated users
- Verify Realtime subscription capability enabled
- Add content length constraint (max 1000 chars)

---

### Story 2.1: Love Notes Chat UI Foundation

**As a** user,
**I want** a beautiful chat interface to view my Love Notes conversation,
**So that** I can see our message history in an intimate, personal format.

**Acceptance Criteria:**

**Given** user navigates to Love Notes page
**When** the page loads
**Then**

- Chat interface displays with messages in conversation format (FR10)
- Partner messages appear on left with light gray background
- User messages appear on right with coral (#FFA8A8) background
- Each message shows sender identification and timestamp (FR11)
- Timestamps in friendly format: "2:45 PM" for today, "Yesterday", "Nov 15" for older
- Messages rendered with React virtualization for performance
- Infinite scroll loads older messages on scroll-up
- Pull-to-refresh or refresh button triggers data refetch

**And** message bubble styling (Tailwind):

- Border radius: rounded-2xl
- Padding: px-4 py-2
- Max width: max-w-[75%]
- Soft shadow: shadow-sm
- Text: text-base text-gray-700

**Prerequisites:** Story 1.2, Story 2.0

**Technical Notes:**

- Use react-window or custom virtualization for performance
- Zustand store for messages with optimistic updates
- Fetch from Supabase with pagination (.range())
- Format dates with date-fns or native Intl.DateTimeFormat
- Tailwind classes for responsive layout

---

### Story 2.2: Send Love Note with Optimistic Updates

**As a** user,
**I want** to send a love note that appears immediately while syncing in background,
**So that** the experience feels instant and responsive.

**Acceptance Criteria:**

**Given** user is viewing Love Notes chat
**When** they type a message and click send
**Then**

- Text input field at bottom with coral send button
- Send button disabled until text entered (min 1 character)
- Message immediately appears in chat with "sending" indicator (FR12)
- Vibration API feedback on send (navigator.vibrate([50])) (FR13)
- Supabase insert happens in background
- Message state updates to "sent" with checkmark on success
- Input field clears after send
- Chat scrolls to bottom to show new message

**Given** send fails due to network error
**When** error is caught
**Then**

- Message displays red error indicator
- Click message shows retry option
- Zustand optimistic update rolled back on failure
- Error vibration pattern: navigator.vibrate([100, 50, 100])

**And** validation:

- Max 1000 characters (with counter at 900+)
- XSS sanitization applied (DOMPurify)
- No empty messages allowed
- Rate limiting: max 10 messages per minute

**Prerequisites:** Story 2.1

**Technical Notes:**

- Zustand action for sendNote with optimistic add
- Temporary UUID for optimistic message, replace with server ID
- Use DOMPurify for content sanitization
- Vibration API with feature detection
- Error boundary for failed sends

---

### Story 2.3: Real-Time Message Reception

**As a** user,
**I want** to receive my partner's love notes instantly without refreshing,
**So that** our conversation feels like real-time chat.

**Acceptance Criteria:**

**Given** user has Love Notes page open
**When** partner sends a new message
**Then**

- Supabase Realtime subscription detects INSERT event (FR8)
- New message appears instantly at bottom of chat
- Gentle vibration on receive: navigator.vibrate([30]) (FR13)
- Chat auto-scrolls to new message if user is at bottom
- If user scrolled up, "New message ↓" indicator appears
- Zustand store updated with new message

**Given** page is in background tab
**When** partner sends message
**Then**

- Realtime subscription maintained
- Zustand store updated
- Message appears when user returns to tab
- (Push notification handled in Epic 3)

**And** subscription lifecycle:

- Subscribe on component mount
- Unsubscribe on unmount
- Reconnect on network recovery
- Handle subscription errors gracefully

**Prerequisites:** Story 2.2

**Technical Notes:**

- Supabase Realtime channel subscription
- Filter: `to_user_id=eq.{userId}`
- React useEffect cleanup for subscription
- WebSocket reconnection logic built into Supabase client
- Visibility API for tab focus detection

---

### Story 2.4: Message History & Scroll Performance

**As a** user,
**I want** to scroll through our complete message history smoothly,
**So that** I can revisit past love notes without performance issues.

**Acceptance Criteria:**

**Given** user has extensive message history
**When** they scroll up through chat
**Then**

- Messages load in pages (50 messages per page)
- Loading spinner at top while fetching more
- Smooth 60fps scrolling maintained
- Scroll position preserved during data load
- No memory leaks from unmounted messages
- Only visible messages rendered (virtualization)

**Given** user wants to see oldest messages
**When** they continue scrolling up
**Then**

- All messages eventually loadable
- "Beginning of conversation" indicator at very top
- "Load more" button alternative to infinite scroll

**And** performance targets:

- Initial load: < 500ms for 50 messages
- Subsequent loads: < 300ms per page
- Memory: < 100MB for 1000+ messages (virtualized)

**Prerequisites:** Story 2.3

**Technical Notes:**

- react-window VariableSizeList for virtualization
- Pagination via Supabase .range(from, to)
- Intersection Observer for infinite scroll trigger
- Measure and cache message heights for virtualization
- Profile with React DevTools for performance

---

## Epic 3: Push Notifications & Daily Engagement

**Goal:** App actively engages partners throughout the day via notifications

**User Value:** Stay connected even when app is closed, never miss a love note or daily message

**FRs Covered:** FR6, FR9, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR38, FR39, FR42, FR47

---

### Story 3.0: Push Notification & Daily Messages Schema Setup

**As a** developer,
**I want** push_subscriptions and daily_love_messages tables created,
**So that** notification features have required backend infrastructure.

**Acceptance Criteria:**

**Given** Supabase project is accessible
**When** migrations are applied
**Then**

- `push_subscriptions` table created with: id (uuid), user_id (uuid FK), subscription (jsonb), created_at (timestamptz)
- Unique constraint on user_id (one subscription per user)
- RLS: users manage only their own subscriptions
- `daily_love_messages` table created with: id (int), message (text), category (text)
- 365 rotation entries seeded for daily messages
- Index on push_subscriptions (user_id) for efficient lookups

**Prerequisites:** None (first story in Epic 3)

**Technical Notes:**

- Web Push subscription object stored as JSONB
- Migration: create_push_subscriptions_table, create_daily_love_messages_table
- Seed daily_love_messages with diverse romantic messages
- VAPID keys generated for Web Push

---

### Story 3.1: Notification Permission Flow

**As a** user,
**I want** to understand why the app needs notification permission before granting it,
**So that** I make an informed decision about enabling this core feature.

**Acceptance Criteria:**

**Given** user completes authentication for first time
**When** permission request flow starts
**Then**

- Pre-permission dialog explains value: "Enable notifications to receive love notes instantly and daily messages" (FR20)
- Dialog shows preview of notification types
- "Enable Notifications" button (coral, primary)
- "Not Now" option (text link)
- If user clicks Enable, browser permission dialog shown
- Success message on grant, tips if denied

**Given** user denies permission
**When** they use notification features
**Then**

- Graceful degradation: in-app notification history works (FR19)
- Periodic reminder (once per week max): "Enable notifications to never miss a love note"
- Settings page shows "Notifications: Disabled" with button to re-enable

**And** re-prompt strategy:

- Don't ask again immediately after denial
- Offer value reminder after significant app usage
- Settings allows manual enable attempt
- Handle "denied" vs "default" permission states

**Prerequisites:** Story 1.2

**Technical Notes:**

- Notification.requestPermission() API
- Check Notification.permission before requesting
- Handle blocked (never ask again) state
- Store permission status in Zustand/localStorage
- Service worker required for background notifications

---

### Story 3.2: Push Subscription Registration & Storage

**As a** system,
**I want** to store Web Push subscriptions in user profiles,
**So that** backend can send targeted notifications to specific browsers.

**Acceptance Criteria:**

**Given** user grants notification permission
**When** subscription registration occurs
**Then**

- Service worker registered if not already
- PushManager.subscribe() called with VAPID public key (FR6)
- Subscription object (endpoint, keys) obtained
- Subscription stored in Supabase push_subscriptions table
- Subscription refresh handled if expired

**Given** user logs in on different browser/device
**When** they enable notifications
**Then**

- New subscription created (different endpoint)
- Multiple subscriptions per user supported
- Notifications sent to all active subscriptions

**And** security:

- Subscription endpoint not exposed in client responses
- VAPID keys properly configured server-side
- Subscription cleaned up on logout
- Handle subscription expiration gracefully

**Prerequisites:** Story 3.1, Story 1.2

**Technical Notes:**

- Service worker subscription using web-push library concepts
- VAPID public key loaded from environment variable
- Supabase insert to push_subscriptions table
- Handle subscription errors (NotAllowedError, etc.)
- Unsubscribe on logout

---

### Story 3.3: Love Note Push Notifications

**As a** user,
**I want** to receive a push notification when my partner sends a love note,
**So that** I never miss their message even when the app is closed.

**Acceptance Criteria:**

**Given** partner sends a Love Note
**When** message is inserted into database
**Then**

- Supabase Database Webhook or Edge Function triggers (FR9, FR15)
- Push notification sent via Web Push API within 2 seconds
- Content: "[Partner name]: [message preview]" (first 50 chars)
- Notification icon: app icon
- Notification badge: app badge icon
- Click action: opens app to Love Notes page

**Given** user clicks notification
**When** navigation occurs
**Then**

- App opens directly to Love Notes page (FR18)
- Message visible in chat
- Notification dismissed
- Focus set to chat input

**Given** app is in foreground
**When** Love Note arrives
**Then**

- In-app toast notification at top (FR21)
- Toast shows partner name and message preview
- Click toast navigates to Love Notes
- Vibration feedback: navigator.vibrate([30])

**And** background handling:

- Service worker handles push event
- Notification displayed even when app closed
- Fallback: in-app notification history (FR19)

**Prerequisites:** Story 3.2, Story 2.3

**Technical Notes:**

- Supabase Edge Functions for server-side push sending
- web-push library for sending notifications
- Service worker 'push' event handler
- URL routing: /love-notes route
- Handle notification click with clients.openWindow()

---

### Story 3.4: Daily Love Message Notifications

**As a** user,
**I want** to receive a daily love message notification at 7 AM,
**So that** I start my day with romantic inspiration.

**Acceptance Criteria:**

**Given** user has notification permission enabled
**When** 7:00 AM arrives in user's timezone
**Then**

- Push notification delivered with daily message preview (FR14, FR38)
- Content: "Your daily love: [first 100 chars]..."
- Scheduled via Supabase Edge Function cron job
- Priority: High (should show prominently)

**Given** user clicks daily message notification
**When** navigation occurs
**Then**

- App opens to Daily Message page (FR39)
- Full message displayed beautifully
- Today's message from 365-rotation library (FR36)
- Deterministic rotation ensures same message for both partners (FR37)

**And** scheduling:

- Supabase pg_cron or external cron service
- Timezone-aware per user profile
- No notification if user disabled daily messages in settings

**Prerequisites:** Story 3.2

**Technical Notes:**

- Supabase Edge Function with scheduled execution
- Message rotation: dayOfYear % 365
- URL routing: /daily-message
- User timezone stored in profile
- Respect user notification preferences

---

### Story 3.5: Notification URL Routing

**As a** user,
**I want** clicking a notification to take me directly to relevant content,
**So that** I don't waste time navigating through the app.

**Acceptance Criteria:**

**Given** user receives any app notification
**When** they click it
**Then**

- App opens or brings to foreground
- React Router handles URL navigation
- Correct page loads without intermediate screens (FR18)
- Appropriate data fetched for that page

**And** routing map:

- `/love-notes` → Love Notes chat page
- `/love-notes?id={noteId}` → Love Notes with specific message highlighted
- `/daily-message` → Daily Message display page
- `/mood` → Mood Tracker page
- `/` or `/home` → Dashboard/Home page

**Given** invalid URL received
**When** routing fails
**Then**

- Fallback to Home page
- No crash or white screen
- Log error for debugging

**Prerequisites:** Story 3.3, Story 3.4

**Technical Notes:**

- React Router v6 with route configuration
- Service worker notification click handler
- clients.openWindow() with URL
- Handle hash-based routing for GitHub Pages if needed
- Test all URL scenarios

---

### Story 3.6: In-App Notification History

**As a** user,
**I want** to see notification history within the app,
**So that** I don't miss anything if push notifications fail.

**Acceptance Criteria:**

**Given** push notification is sent
**When** system records it
**Then**

- Notification entry saved to Zustand store and localStorage (FR19)
- History shows: type, content preview, timestamp
- Accessible from Home page or Settings
- Maximum 100 entries retained (FIFO eviction)

**Given** user views notification history
**When** they click an entry
**Then**

- Navigation to relevant page (same as notification click)
- Entry marked as "viewed"
- Unread count badge updates
- Smooth transition to target page

**And** notification types tracked:

- Love Note received
- Daily love message
- Mood reminder (if enabled)
- Milestone/anniversary
- Partner poke/kiss (FR42, FR47)

**Prerequisites:** Story 3.5

**Technical Notes:**

- Zustand store for notification history
- Persist to localStorage with size limit
- NotificationBadge component with count
- Clean up old entries automatically
- Fallback when push delivery fails

---

## Epic 4: Dashboard & Daily Connection

**Goal:** At-a-glance partner connection status with daily love messages

**User Value:** Quick overview of partner's state and daily romantic inspiration

**FRs Covered:** FR36, FR37, FR45, FR46, FR55, FR56, FR57, FR58, FR59, FR64

---

### Story 4.0: Relationships Table for Days Together Counter

**As a** developer,
**I want** the relationships table created with start_date tracking,
**So that** the days together counter has the required data source.

**Acceptance Criteria:**

**Given** Supabase project is accessible
**When** migration is applied
**Then**

- `relationships` table created with: id (uuid), user_id_1 (uuid FK), user_id_2 (uuid FK), start_date (date), created_at (timestamptz)
- Check constraint: user_id_1 < user_id_2 (prevents duplicates)
- RLS: users view only relationships where they are participant
- Unique constraint on (user_id_1, user_id_2)
- Migration seeds test data for development

**Prerequisites:** None (first story in Epic 4)

**Technical Notes:**

- Migration: create_relationships_table
- Days calculation: Date.now() - startDate in milliseconds / (1000*60*60\*24)
- Consider manual relationship setup for MVP
- Partner matching logic needed

---

### Story 4.1: Feature Hub Home Screen

**As a** user,
**I want** a dashboard that shows all features with quick status indicators,
**So that** I can see what's new and navigate to any feature easily.

**Acceptance Criteria:**

**Given** user is authenticated
**When** Home page loads
**Then**

- Feature Hub layout with card-based feature grid (FR59)
- Navigation menu/sidebar with main sections
- Each feature card shows icon, title, and status indicator
- Coral accent color (#FF6B6B) for active indicators
- Pull-to-refresh or refresh button updates all dashboard data
- Responsive layout for mobile and desktop (FR61)

**And** feature cards include:

- Love Notes: Badge shows unread count (FR56)
- Mood Tracker: Shows partner's current mood emoji
- Photo Gallery: "View memories" subtitle
- Daily Message: Today's message snippet (FR58)
- Settings: "Customize your experience"

**Given** user clicks a feature card
**When** navigation occurs
**Then**

- Page transition < 300ms smooth animation
- Loading states shown while data fetches
- Breadcrumb or back navigation available
- Vibration feedback on tap: navigator.vibrate([10])

**Prerequisites:** Story 1.2, Story 1.5

**Technical Notes:**

- React Router routes for each feature
- Zustand stores prefetch on dashboard load
- Tailwind responsive grid: grid-cols-1 md:grid-cols-2
- Lazy load feature pages with React.lazy
- Dashboard data aggregation in single Zustand store

---

### Story 4.2: Days Together Counter Display

**As a** user,
**I want** to see how many days we've been together prominently displayed,
**So that** I'm reminded of our journey and upcoming milestones.

**Acceptance Criteria:**

**Given** relationship start date is configured
**When** Home page displays
**Then**

- Days together counter as hero element at top (FR45, FR57)
- Large number display (text-4xl font-bold)
- Animated counting effect on initial load (Framer Motion)
- Coral accent color for emphasis
- Caption: "days together" below number

**Given** milestone is approaching
**When** dashboard calculates milestones
**Then**

- Upcoming milestone shown: "100 days in 5 days!" (FR46)
- Special styling for milestone days (gold badge)
- Milestones tracked: 100 days, 6 months, 1 year, 500 days, etc.

**And** calculation:

- Days = Math.floor((Date.now() - startDate) / (86400000))
- Start date fetched from Supabase relationship record
- Updates automatically (no manual refresh needed)

**Prerequisites:** Story 4.1, Story 4.0

**Technical Notes:**

- Framer Motion animate={{ scale: [0.5, 1] }} for counting
- Date utilities in src/utils/date.ts
- Supabase query for relationship start_date
- Cache result in Zustand with daily refresh
- Handle missing start_date gracefully

---

### Story 4.3: Partner Mood Status Display

**As a** user,
**I want** to see my partner's current mood on the dashboard,
**So that** I immediately know how they're feeling.

**Acceptance Criteria:**

**Given** partner has logged a mood
**When** Home page displays
**Then**

- Partner's current mood prominently shown (FR55)
- Emoji display for mood type (e.g., 😊 Happy)
- Time since logged: "2 hours ago" (relative time)
- Click to view full mood history
- Warm gray text, coral accent for emoji background

**Given** partner hasn't logged mood today
**When** dashboard checks mood status
**Then**

- Display: "No mood logged yet today"
- Encourage message: "Check in with them ❤️"
- Placeholder icon or default emoji

**And** real-time update:

- Zustand store refetches on focus
- Could subscribe to Realtime for instant update (optional)
- Visual indicator for "just now" entries

**Prerequisites:** Story 4.1

**Technical Notes:**

- PartnerMoodCard component with Tailwind styling
- Query: latest mood entry for partner user_id
- Relative time formatting: "2 hours ago", "yesterday"
- Part of dashboard aggregated data fetch
- Handle partner not having any moods

---

### Story 4.4: Daily Love Message Display

**As a** user,
**I want** to see today's love message beautifully displayed,
**So that** I get daily romantic inspiration.

**Acceptance Criteria:**

**Given** user views daily message
**When** page loads
**Then**

- Today's message from 365-rotation library (FR36)
- Beautiful card layout with soft coral background (bg-pink-50)
- Elegant typography (text-2xl font-serif text-gray-800)
- Date displayed: "November 17, 2025"
- Message determined by rotation algorithm (FR37)
- Same message shown to both partners

**Given** user sees message preview on dashboard
**When** they click the preview
**Then**

- Navigates to full Daily Message page
- Message snippet shown: first 80 characters... (FR58)
- Card with heart icon and "Today's Message" title

**And** rotation algorithm:

```typescript
const dayOfYear = Math.floor((Date.now() - new Date(year, 0, 0)) / 86400000);
const messageIndex = dayOfYear % 365;
const todaysMessage = messageLibrary[messageIndex];
```

- Deterministic: both partners see same message
- 365 unique messages in library

**Prerequisites:** Story 4.1, Story 3.0 (for messages table)

**Technical Notes:**

- /daily-message route for full display
- Message library fetched from Supabase or static JSON
- Date calculation for rotation
- Cache message for the day in Zustand
- Beautiful Tailwind card styling

---

### Story 4.5: Network Status on Dashboard

**As a** user,
**I want** to see my connection status clearly on the dashboard,
**So that** I know if my data is current or potentially stale.

**Acceptance Criteria:**

**Given** dashboard is displayed
**When** network status changes
**Then**

- StatusIndicator visible in header area (FR64)
- Green dot: "Online" - full sync active
- Yellow dot: "Connecting..." - attempting reconnection
- Red dot: "Offline" - using cached data

**Given** offline status detected
**When** user views dashboard
**Then**

- All data marked as potentially stale
- Last sync timestamp shown: "Last updated 10 min ago"
- Offline banner from Story 1.5 visible
- No auto-refresh attempts when offline

**And** visual consistency:

- Status indicator in top-right corner
- Small, unobtrusive but noticeable
- Tailwind classes: fixed top-4 right-4 z-50

**Prerequisites:** Story 1.5, Story 4.1

**Technical Notes:**

- StatusIndicator component shared across pages
- useNetworkStatus hook from Story 1.5
- Timestamp tracking for last successful sync
- Zustand store timestamp tracking
- Consistent placement across all pages

---

## Epic 5: Mood Tracking & Transparency

**Goal:** Partners share emotional states with full transparency

**User Value:** Know how your partner is feeling throughout the day

**FRs Covered:** FR22, FR23, FR24, FR25, FR26, FR27, FR28

---

### Story 5.1: Mood Emoji Picker Interface

**As a** user,
**I want** to quickly select my current mood from a grid of emotions,
**So that** I can log how I'm feeling in seconds.

**Acceptance Criteria:**

**Given** user navigates to Mood page
**When** page displays
**Then**

- 3x4 grid of 12 emotion emojis (FR22)
- Emotions: Happy 😊, Sad 😢, Excited 🤩, Anxious 😰, Calm 😌, Angry 😠, Loving 🥰, Grateful 🙏, Tired 😴, Energetic ⚡, Confused 🤔, Hopeful 🌟
- Each emoji button is 48px minimum (accessibility)
- Label below each emoji for clarity
- Partner's current mood displayed at top of page (FR24)

**Given** user clicks an emoji
**When** selection occurs
**Then**

- Emoji visually selected (coral border, scale animation)
- Vibration feedback: navigator.vibrate([15, 15]) (FR27)
- Optional note field expands below (FR23)
- "Log Mood" button appears

**And** quick access priority:

- Entire flow completable < 5 seconds (FR26)
- Single-click selection, no confirmation dialog
- Optional note collapsed by default
- Minimal cognitive load

**Prerequisites:** Story 1.2

**Technical Notes:**

- MoodEmojiPicker component with Tailwind grid
- 12 MoodType enum values
- Framer Motion for selection animation
- Accessibility: role="button", aria-label for each emoji
- Touch-friendly tap targets (min 44px)

---

### Story 5.2: Quick Mood Logging Flow

**As a** user,
**I want** to log my mood with optional note and have it save immediately,
**So that** my partner knows how I'm feeling without delay.

**Acceptance Criteria:**

**Given** user has selected mood emoji
**When** they click "Log Mood" button
**Then**

- Mood entry saved to Supabase (FR28)
- Optimistic update: entry appears immediately
- Success toast: "Mood logged ✓" in green
- Vibration confirmation: navigator.vibrate([30]) (FR27)
- Selection resets for next entry
- Total time from open to saved < 5 seconds (FR26)

**Given** user adds optional note
**When** note field is used
**Then**

- Text input expands below emoji grid
- Placeholder: "Add a note (optional)"
- Max 200 characters with counter
- Note saved with mood entry (FR23)

**Given** save fails due to network
**When** error occurs
**Then**

- Error toast: "Failed to save mood. Retry?"
- Retry button in toast
- Entry remains with error indicator
- Vibration error pattern

**Prerequisites:** Story 5.1

**Technical Notes:**

- Zustand action for logMood with optimistic update
- Insert to mood_entries table: user_id, mood_type, note, created_at
- Toast notifications using existing UI component
- Input validation: max 200 chars, XSS sanitization
- Quick response time priority

---

### Story 5.3: Partner Mood Viewing & Transparency

**As a** user,
**I want** to see my partner's mood entries and history,
**So that** I understand their emotional state throughout the day.

**Acceptance Criteria:**

**Given** user views Mood page
**When** partner mood section loads
**Then**

- Partner's current mood prominently displayed at top (FR24)
- Shows emoji, label, time since logged, optional note
- "Your partner is feeling: [mood emoji] [label]"
- Full transparency: all mood entries visible

**Given** partner logs new mood
**When** user is viewing mood page
**Then**

- Update appears on refetch (Zustand refetch on focus)
- Could subscribe to Realtime for instant update (optional)
- Visual indicator for "just now" entries

**And** transparency model:

- Both partners see each other's complete mood history
- No hidden or private moods
- Trust-based system per PRD requirements

**Prerequisites:** Story 5.2

**Technical Notes:**

- PartnerMoodDisplay component
- Query partner_id from user profile or relationship
- Supabase query: mood_entries where user_id = partnerId
- Respect RLS policies (partner relationship verified)
- Handle case where partner has no moods logged

---

### Story 5.4: Mood History Timeline

**As a** user,
**I want** to see my mood history over time,
**So that** I can track patterns and reflect on my emotional journey.

**Acceptance Criteria:**

**Given** user scrolls down on Mood page
**When** history section loads
**Then**

- Timeline view showing mood entries (FR25)
- Chronological order (newest first)
- Each entry: emoji, timestamp, optional note
- Clear visual separation between days
- Infinite scroll for older entries

**Given** user has extensive history
**When** they scroll through timeline
**Then**

- Smooth 60fps scrolling (virtualized list)
- Entries load in batches (50 per page)
- Memory efficient: only visible items rendered
- "Load more" button or auto-load on scroll

**And** timeline styling:

- MoodHistoryItem component
- Date headers: "Today", "Yesterday", "Nov 15"
- Subtle dividers between entries
- Expandable notes (truncate long notes initially)

**Prerequisites:** Story 5.2

**Technical Notes:**

- react-window for virtualized list
- Pagination with Supabase .range()
- Date formatting utilities
- Intersection Observer for infinite scroll
- Collapse/expand for long notes

---

## Epic 6: Photo Gallery & Memories

**Goal:** Partners share and browse photo memories together

**User Value:** Visual memory collection that both partners can enjoy

**FRs Covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35

---

### Story 6.0: Photo Storage Schema & Buckets Setup

**As a** developer,
**I want** Supabase Storage bucket and photos metadata table created,
**So that** photo features have required storage infrastructure.

**Acceptance Criteria:**

**Given** Supabase project is accessible
**When** migration and storage setup are applied
**Then**

- Supabase Storage bucket "photos" created (private)
- `photos` metadata table created with: id (uuid), user_id (uuid FK), storage_path (text), file_size (int), created_at (timestamptz)
- RLS: users see own photos + partner's photos
- Storage policy: users upload to own path only (photos/{user_id}/\*)
- Index on (user_id, created_at DESC) for gallery queries
- Foreign key to auth.users with ON DELETE CASCADE

**Prerequisites:** None (first story in Epic 6)

**Technical Notes:**

- Create Storage bucket via Supabase Dashboard or API
- Migration: create_photos_table
- Storage path pattern: photos/{user_id}/{uuid}.{ext}
- Consider 10MB file size limit per photo
- Storage policies for access control

---

### Story 6.1: Photo Selection & Compression

**As a** user,
**I want** to select photos from my device and have them optimized before upload,
**So that** sharing is fast and doesn't consume excessive storage.

**Acceptance Criteria:**

**Given** user clicks "Add Photo" in gallery
**When** file input opens
**Then**

- File input with accept="image/\*" (FR29)
- Single or multi-select supported
- Permission handled by browser automatically
- Preview of selected image(s) shown

**Given** user selects photo(s)
**When** selection confirmed
**Then**

- Image compression applied using Canvas API (FR30)
- Target: < 1MB per photo after compression
- Original quality maintained where possible
- Compression < 3 seconds for typical photo
- Preview shown before upload confirmation

**And** supported formats:

- JPEG, PNG, WebP
- Max 10MB original size
- File type verification before compression
- HEIC conversion if needed (via library)

**Prerequisites:** Story 1.2

**Technical Notes:**

- HTML file input with multiple attribute
- Canvas API for resizing and compression
- Target 1024px max dimension, 80% JPEG quality
- Image compression utility in src/utils/compression.ts
- Use createObjectURL for preview display

---

### Story 6.2: Photo Upload with Progress Indicator

**As a** user,
**I want** to see upload progress while my photo transfers to the server,
**So that** I know the upload is working and can estimate completion time.

**Acceptance Criteria:**

**Given** photo is selected and compressed
**When** upload begins
**Then**

- Progress indicator shown (0% to 100%) (FR31)
- Visual progress bar with percentage
- Cancel button available
- "Uploading photo..." message
- Upload to Supabase Storage (FR35)

**Given** upload completes successfully
**When** server confirms
**Then**

- Success message: "Photo uploaded ✓"
- Photo appears in gallery immediately
- Optimistic update to gallery state
- Vibration feedback on completion

**Given** upload fails
**When** error occurs
**Then**

- Error message: "Upload failed. Retry?"
- Retry button
- Photo remains locally for retry
- No partial upload left on server

**And** performance target:

- Total upload time < 10 seconds for compressed photo

**Prerequisites:** Story 6.1, Story 6.0

**Technical Notes:**

- Supabase Storage upload with onUploadProgress callback
- XMLHttpRequest or Fetch API with progress tracking
- Path: `photos/{userId}/{timestamp}_{filename}`
- Insert metadata record on successful upload
- Handle upload abort/cancel

---

### Story 6.3: Photo Gallery Grid View

**As a** user,
**I want** to browse all shared photos in a beautiful grid layout,
**So that** I can enjoy our visual memories together.

**Acceptance Criteria:**

**Given** user navigates to Photo Gallery
**When** page loads
**Then**

- Grid view with photo thumbnails (FR32, FR33)
- 3-column layout on mobile, 4-column on desktop
- Both partners' photos shown together
- Sorted by date (newest first)
- Smooth scrolling with lazy loading

**Given** gallery has many photos
**When** user scrolls
**Then**

- Lazy loading of images (IntersectionObserver)
- Blur placeholder while loading
- Infinite scroll for pagination
- Memory efficient rendering

**And** thumbnail styling:

- Aspect ratio preserved (object-cover)
- Subtle border radius (rounded-lg)
- Hover effect: slight scale up
- Click to open full-screen viewer

**Prerequisites:** Story 6.2

**Technical Notes:**

- PhotoThumbnail component with Tailwind grid
- Supabase Storage public URLs for thumbnails
- Query photos table: select \*, order by created_at desc
- Lazy loading with loading="lazy" attribute
- Consider thumbnail generation for performance

---

### Story 6.4: Full-Screen Photo Viewer with Gestures

**As a** user,
**I want** to view photos in full-screen with zoom and swipe gestures,
**So that** I can appreciate our memories in detail.

**Acceptance Criteria:**

**Given** user clicks photo thumbnail in gallery
**When** viewer opens
**Then**

- Full-screen photo display (FR34)
- Black/dark background for focus
- Photo caption displayed below
- Close button (X) in top corner
- Swipe left/right to next/previous photo (on touch devices)

**Given** user interacts with photo
**When** gestures are used
**Then**

- Pinch-to-zoom supported (touch devices)
- Double-tap/click to zoom in/out
- Pan to move zoomed photo
- Smooth gesture handling

**Given** user wants to dismiss
**When** they click X or press Escape
**Then**

- Viewer closes with fade animation
- Return to gallery at same scroll position
- Keyboard navigation: arrow keys for next/prev

**And** navigation:

- Swipe/arrow keys to browse photos
- Index indicator: "3 of 25"
- Preload adjacent photos for smooth transition

**Prerequisites:** Story 6.3

**Technical Notes:**

- PhotoViewer modal component
- Framer Motion for animations
- Touch gesture library (react-use-gesture or similar)
- Route: /photos/{id} for direct linking
- Handle keyboard events for accessibility

---

## Epic 7: Settings, Interactions & Personalization

**Goal:** Customize experience and send playful partner interactions

**User Value:** Personal preferences, theme control, and fun poke/kiss interactions

**FRs Covered:** FR5, FR40, FR41, FR43, FR44, FR48, FR49, FR50, FR51, FR52, FR53, FR54

---

### Story 7.1: Theme Toggle & Dark Mode Support

**As a** user,
**I want** to switch between light and dark mode,
**So that** I can use the app comfortably at any time of day.

**Acceptance Criteria:**

**Given** user opens Settings
**When** theme section displays
**Then**

- Toggle switch for dark mode (FR48)
- Options: "Light", "Dark", "System Default"
- System preference detection (FR49)
- Current selection highlighted

**Given** user toggles theme
**When** selection changes
**Then**

- Theme immediately applies across app
- Smooth transition animation (Tailwind dark: classes)
- Preference persisted in localStorage (FR50)
- Coral Heart colors maintained in both modes

**And** dark mode palette:

- Background: bg-gray-900
- Surface: bg-gray-800
- Text: text-gray-100
- Primary: #FF8787 (lighter coral for dark bg)
- Tailwind dark mode variant classes

**Prerequisites:** Story 1.2

**Technical Notes:**

- Tailwind dark mode with class strategy
- useTheme hook with localStorage persistence
- prefers-color-scheme media query for system default
- Toggle dark class on html element
- All components use Tailwind dark: variants

---

### Story 7.2: Notification Preferences Configuration

**As a** user,
**I want** to customize which notifications I receive and when,
**So that** I control my notification experience.

**Acceptance Criteria:**

**Given** user views notification settings
**When** preferences section loads
**Then**

- Toggle: "Daily Love Message" (enabled/disabled)
- Toggle: "Mood Reminders" (FR51)
- Time picker for mood reminder (FR52)
- Toggle: "Partner Interaction Alerts"
- Toggle: "Milestone Notifications"

**Given** user disables mood reminders
**When** setting saved
**Then**

- localStorage preference updated
- Server-side notification job respects preference
- Confirmation: "Mood reminders disabled"

**Given** user sets custom reminder time
**When** time picker used
**Then**

- Time stored in user profile (Supabase)
- Default: Not set (no reminder)
- Format: 24-hour selection
- Server cron job uses this time (FR16)

**Prerequisites:** Story 3.1

**Technical Notes:**

- Zustand store for notification preferences
- Sync critical preferences to Supabase user profile
- HTML time input for time picker
- Server reads preferences before sending notifications
- Toggle components with Tailwind styling

---

### Story 7.3: Biometric Authentication Setup

**As a** user,
**I want** to optionally enable biometric/WebAuthn unlock,
**So that** I can access the app quickly without re-authenticating.

**Acceptance Criteria:**

**Given** browser supports WebAuthn
**When** user views security settings
**Then**

- Toggle: "Enable Biometric Unlock" (FR53)
- Explanation: "Use fingerprint or Face ID for quick access"
- Device capability detected automatically (PublicKeyCredential API)

**Given** user enables biometrics
**When** toggle activated
**Then**

- WebAuthn registration prompt shown (FR5)
- On success: preference saved in localStorage
- NOT replacing Supabase auth, just device convenience
- Session still managed by Supabase

**Given** user opens app with biometrics enabled
**When** app launches with expired session
**Then**

- Biometric prompt shown first
- On success: auto re-authenticate or show cached content
- On failure: falls back to email/password re-auth
- Graceful degradation if biometric fails

**Prerequisites:** Story 1.2

**Technical Notes:**

- WebAuthn API (navigator.credentials)
- Feature detection for WebAuthn support
- localStorage flag for biometric enabled
- Handle unsupported browsers gracefully
- Optional feature, not critical path

---

### Story 7.4: Partner Poke & Kiss Interactions

**As a** user,
**I want** to send playful pokes and kisses to my partner,
**So that** I can express affection in fun, quick ways.

**Acceptance Criteria:**

**Given** user is on Home or dedicated interactions page
**When** they click "Poke" or "Kiss" button
**Then**

- Interaction sent to partner immediately (FR40, FR41)
- Playful vibration feedback: poke [100, 50, 100], kiss [50, 30, 50] (FR43)
- Visual animation: Framer Motion scale/bounce effect
- Success confirmation: "Poke sent! 👆" or "Kiss sent! 💋"

**Given** partner receives interaction
**When** notification triggers
**Then**

- Push notification: "[Partner] sent you a poke!" (FR42)
- In-app toast if app is open
- Vibration pattern for received interaction

**Given** user views interaction history
**When** history page loads
**Then**

- List of past pokes/kisses (FR44)
- Who sent, timestamp, type
- Fun statistics: "You've sent 25 kisses this month!"

**Prerequisites:** Story 3.2

**Technical Notes:**

- Interaction type enum: POKE, KISS
- Supabase table: partner_interactions
- Vibration patterns for different interactions
- Edge Function for push notification
- Framer Motion for playful animations

---

### Story 7.5: Profile Management

**As a** user,
**I want** to view and edit my profile information,
**So that** my partner sees accurate info about me.

**Acceptance Criteria:**

**Given** user opens Profile section in Settings
**When** page loads
**Then**

- Display name shown (editable) (FR54)
- Email address (read-only)
- Partner's name shown
- Relationship start date (editable)
- Profile picture placeholder (future enhancement)

**Given** user edits display name
**When** they save changes
**Then**

- Supabase user profile updated
- Partner sees new name throughout app
- Success toast: "Profile updated ✓"
- Input validation: 2-50 characters

**Given** user views account actions
**When** section displays
**Then**

- "Log Out" button (calls logout from Story 1.4)
- "Delete Account" (with confirmation dialog)
- App version display
- Privacy policy link

**Prerequisites:** Story 1.2

**Technical Notes:**

- User profile from Supabase auth.users + profiles table
- Zustand action for updateProfile with optimistic update
- Delete account requires careful data cleanup
- Version from package.json or build constant
- Form validation with Zod schema

---

## FR Coverage Matrix

| FR # | Description                                            | Epic      | Story          |
| ---- | ------------------------------------------------------ | --------- | -------------- |
| FR1  | Email/password + OAuth authentication                  | Epic 1    | Story 1.2      |
| FR2  | Persistent authenticated sessions                      | Epic 1    | Story 1.4      |
| FR3  | Logout and re-authentication                           | Epic 1    | Story 1.4      |
| FR4  | Authentication URL redirect handling (OAuth)           | Epic 1    | Story 1.2      |
| FR5  | Biometric authentication (WebAuthn)                    | Epic 7    | Story 7.3      |
| FR6  | Push subscription storage                              | Epic 3    | Story 3.2      |
| FR7  | Send text messages (Love Notes)                        | Epic 2    | Story 2.2      |
| FR8  | Real-time message receipt via Supabase Realtime        | Epic 2    | Story 2.3      |
| FR9  | Push notification for new Love Note                    | Epic 3    | Story 3.3      |
| FR10 | View complete message history with scroll-back         | Epic 2    | Story 2.1      |
| FR11 | Sender identification and timestamp display            | Epic 2    | Story 2.1      |
| FR12 | Optimistic update on message send                      | Epic 2    | Story 2.2      |
| FR13 | Haptic feedback (Vibration API) on send/receive        | Epic 2    | Story 2.2, 2.3 |
| FR14 | Daily love message notification at 7:00 AM             | Epic 3    | Story 3.4      |
| FR15 | New Love Note push notification                        | Epic 3    | Story 3.3      |
| FR16 | Mood reminder notifications                            | Epic 7    | Story 7.2      |
| FR17 | Milestone/anniversary notifications                    | Epic 3    | Story 3.4      |
| FR18 | Notification URL routing                               | Epic 3    | Story 3.5      |
| FR19 | In-app notification history                            | Epic 3    | Story 3.6      |
| FR20 | Notification permission request with value explanation | Epic 3    | Story 3.1      |
| FR21 | Foreground/background notification handling            | Epic 3    | Story 3.3      |
| FR22 | Log mood using emoji picker                            | Epic 5    | Story 5.1, 5.2 |
| FR23 | Optional note with mood entry                          | Epic 5    | Story 5.2      |
| FR24 | View partner's mood entries                            | Epic 5    | Story 5.3      |
| FR25 | Mood history timeline                                  | Epic 5    | Story 5.4      |
| FR26 | Quick mood logging (<5 seconds)                        | Epic 5    | Story 5.2      |
| FR27 | Haptic feedback (Vibration API) on mood save           | Epic 5    | Story 5.1, 5.2 |
| FR28 | Sync mood entries to Supabase                          | Epic 5    | Story 5.2      |
| FR29 | Select photos from device (File API)                   | Epic 6    | Story 6.1      |
| FR30 | Compress images (Canvas API) before upload             | Epic 6    | Story 6.1      |
| FR31 | Upload progress indicator                              | Epic 6    | Story 6.2      |
| FR32 | Shared photo gallery grid view                         | Epic 6    | Story 6.3      |
| FR33 | Thumbnail display for efficient browsing               | Epic 6    | Story 6.3      |
| FR34 | Full-screen photo viewer with gestures                 | Epic 6    | Story 6.4      |
| FR35 | Sync photos to Supabase Storage                        | Epic 6    | Story 6.2      |
| FR36 | Display daily love message from rotation               | Epic 4    | Story 4.4      |
| FR37 | Deterministic message rotation algorithm               | Epic 4    | Story 4.4      |
| FR38 | Daily message notification delivery                    | Epic 3    | Story 3.4      |
| FR39 | Navigate to full message from notification             | Epic 3    | Story 3.4      |
| FR40 | Send partner poke interaction                          | Epic 7    | Story 7.4      |
| FR41 | Send partner kiss interaction                          | Epic 7    | Story 7.4      |
| FR42 | Partner interaction notifications                      | Epic 3    | Story 3.4      |
| FR43 | Haptic feedback on poke/kiss                           | Epic 7    | Story 7.4      |
| FR44 | Interaction history                                    | Epic 7    | Story 7.4      |
| FR45 | Days together counter                                  | Epic 4    | Story 4.2      |
| FR46 | Milestone tracking and display                         | Epic 4    | Story 4.2      |
| FR47 | Milestone notifications                                | Epic 3    | Story 3.4      |
| FR48 | Theme toggle (light/dark mode)                         | Epic 7    | Story 7.1      |
| FR49 | System theme preference detection                      | Epic 7    | Story 7.1      |
| FR50 | Theme preference persistence (localStorage)            | Epic 7    | Story 7.1      |
| FR51 | Mood reminder toggle                                   | Epic 7    | Story 7.2      |
| FR52 | Custom mood reminder time                              | Epic 7    | Story 7.2      |
| FR53 | Biometric authentication toggle                        | Epic 7    | Story 7.3      |
| FR54 | Profile information management                         | Epic 7    | Story 7.5      |
| FR55 | Partner mood on dashboard                              | Epic 4    | Story 4.3      |
| FR56 | Love Note preview on dashboard                         | Epic 4    | Story 4.1      |
| FR57 | Days together counter on dashboard                     | Epic 4    | Story 4.2      |
| FR58 | Daily message snippet on dashboard                     | Epic 4    | Story 4.4      |
| FR59 | Quick navigation from dashboard                        | Epic 4    | Story 4.1      |
| FR60 | PWA installable on mobile and desktop                  | Epic 1    | Story 1.1      |
| FR61 | Responsive design (320px to 1920px)                    | Epic 4    | Story 4.1      |
| FR62 | Local preference persistence (localStorage/IndexedDB)  | Epic 1    | Story 1.2      |
| FR63 | Zustand state management with persistence              | Epic 1    | Story 1.2      |
| FR64 | Network status indicator                               | Epic 1, 4 | Story 1.5, 4.5 |
| FR65 | Supabase integration with RLS                          | Epic 1    | Story 1.2      |

### Coverage Validation

**Total FRs in PRD:** 65
**Total FRs Mapped:** 65 ✅
**Coverage Percentage:** 100%

**Cross-Epic FRs:** FR9 (Love Note push notifications) touches both Epic 2 (message send) and Epic 3 (notification delivery), validating push notifications as cross-cutting concern.

---

## Summary

### Breakdown Statistics

| Metric                       | Value     |
| ---------------------------- | --------- |
| Total Epics                  | 7         |
| Total Stories                | 34        |
| Total FRs Covered            | 65 (100%) |
| Average Stories per Epic     | 4.9       |
| PRD Capability Areas Covered | 11/11     |

### Epic Delivery Sequence

1. **Epic 1: PWA Foundation Audit & Stabilization** (5 stories) - Must complete first
   - Audits existing codebase and fixes foundation issues
   - No dependencies, enables all subsequent epics

2. **Epic 2: Love Notes Real-Time Messaging** (5 stories) - Core feature
   - Delivers the primary differentiating value proposition
   - Depends on Epic 1 for stable foundation and Supabase setup

3. **Epic 3: Push Notifications & Daily Engagement** (6 stories) - Engagement layer
   - Makes the app "sticky" with proactive engagement
   - Depends on Epic 1 (auth) and Epic 2 (note alerts)

4. **Epic 4: Dashboard & Daily Connection** (5 stories) - Home experience
   - Creates the central hub for partner connection
   - Depends on Epic 1, partial Epic 3 (daily messages)

5. **Epic 5: Mood Tracking & Transparency** (4 stories) - Emotional connection
   - Enables emotional transparency between partners
   - Depends on Epic 1, benefits from Epic 3 notifications

6. **Epic 6: Photo Gallery & Memories** (4 stories) - Visual memories
   - Builds shared visual memory collection
   - Depends on Epic 1, benefits from Epic 3 notifications

7. **Epic 7: Settings, Interactions & Personalization** (5 stories) - Polish & fun
   - Adds personalization and playful interactions
   - Depends on Epic 1, benefits from Epic 3 notifications

### Design Principles Applied

✅ **PWA-First Focus:** All stories designed for web browser environment with PWA capabilities
✅ **Audit Before Build:** Epic 1 prioritizes understanding and fixing existing code
✅ **User Value Focus:** Each epic delivers tangible user value, not technical layers
✅ **Bite-Sized Stories:** Every story completable by single dev agent in one session
✅ **BDD Acceptance Criteria:** All stories have Given/When/Then testable criteria
✅ **Dependency Management:** Clear prerequisites prevent forward dependencies
✅ **FR Traceability:** Every functional requirement mapped to specific stories
✅ **Web API Integration:** Stories use browser APIs (Vibration, File, Canvas, WebAuthn)
✅ **No Time Estimates:** Acknowledging AI-driven development paradigm shift

### Success Validation

- ✅ All 65 FRs from PRD inventory are covered
- ✅ No orphaned FRs without story assignment
- ✅ Epic sequence follows logical dependency chain
- ✅ Stories reference specific web technologies (Zustand, Tailwind, Framer Motion)
- ✅ Stories use web APIs (Vibration API, File API, Canvas API, Web Push, WebAuthn)
- ✅ Performance targets aligned with web standards (60fps, < 500ms loads)
- ✅ Security standards use web patterns (localStorage, RLS, VAPID keys)
- ✅ Responsive design considerations throughout (mobile and desktop)

### Next Steps

This epic breakdown is now ready for:

1. **Story Implementation:** Begin with Epic 1 Story 1.1 (Codebase Audit)
2. **Technical Validation:** Verify existing codebase against story requirements
3. **Database Setup:** Create Supabase tables as stories require them
4. **Dev Agent Assignment:** Stories can be assigned for autonomous implementation

---

_Generated: 2025-11-17 | Version: 2.0 (Platform Pivot) | Mode: PWA Enhancement_

_This document reflects complete platform pivot from React Native mobile to PWA web application. All stories now target web browser environment with React 19 + Vite 7 + Zustand + Tailwind CSS stack._

---

_For implementation: Start with Epic 1 Story 1.1 to audit existing codebase and establish stable foundation._

_This document incorporates context from updated PRD v2.0 (65 FRs for PWA) and Architecture v2.0 (React 19 + Vite + Zustand stack)._
