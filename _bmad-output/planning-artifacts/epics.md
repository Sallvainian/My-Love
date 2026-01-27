---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# My-Love - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for My-Love, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Session Management (FR1-7)**
- FR1: User can view the Scripture Reading overview page with session stats
- FR1a: User can access Scripture Reading from bottom navigation (add 'scripture' to ViewType and BottomNavigation)
- FR2: User can start a new Scripture Reading session
- FR3: User can choose between Solo mode and Together mode when starting
- FR4: User with no linked partner can only access Solo mode (Together disabled with explanation)
- FR5: User can exit a session cleanly at any point
- FR6: User can resume an incomplete Solo session from where they left off
- FR7: System marks a session as complete only when step 17 reflections are submitted

**Solo Mode Flow (FR8-13)**
- FR8: User in Solo mode can progress through all 17 scripture steps at their own pace
- FR9: User in Solo mode sees the verse text and can mark "I've read this"
- FR10: User in Solo mode sees the response text and can continue to reflection
- FR11: User in Solo mode can submit a reflection (rating, help flag, optional note) for each step
- FR12: User in Solo mode can save progress and exit mid-session
- FR13: User in Solo mode can use the feature fully offline (with sync when online)

**Together Mode Flow (FR14-29)**
- FR14: User initiating Together mode can select their role (Reader or Responder)
- FR15: User in Together mode enters a lobby while waiting for partner
- FR16: User in lobby can see partner's join status
- FR17: User in lobby can toggle their ready state (Ready / Not Ready)
- FR18: User in lobby (pre-countdown) can fall back to Solo mode without shame messaging
- FR19: System starts a 3-second countdown when both users are ready
- FR20: Reader sees verse text and can mark "Done reading" to advance the phase
- FR21: Responder sees waiting screen while Reader is reading
- FR22: Responder sees response text and can mark "Done" to advance the phase
- FR23: Reader sees waiting screen while Responder is responding
- FR24: Both users see reflection screen after response phase
- FR25: System advances to next step only when both users submit reflections
- FR26: User can see progress indicator (Step X of 17)
- FR27: System shows "Partner reconnecting..." indicator if partner goes offline
- FR28: System pauses phase advancement while partner is offline
- FR29: User can end session cleanly (with confirmation) if partner remains offline

**Reflection System (FR30-33)**
- FR30: User can rate their response on a 1-5 scale (Struggling → Strong)
- FR31: User can toggle "I want my partner's help / I'm sensitive to this" flag
- FR32: User can add an optional note (max 200 characters)
- FR33: Reflection rating scale has clear accessible labels

**Daily Prayer Report (FR34-41)**
- FR34: User can send an optional message to partner at end of session (max 300 chars)
- FR35: User can skip sending a message
- FR36: User can view the Daily Prayer Report after session completion
- FR37: User can see their own step-by-step ratings and help flags in the report
- FR38: User can see partner's message (if sent) in the report
- FR39: User with no linked partner skips the send message step (reflections still saved)
- FR40: Partner receives Solo session's Daily Prayer Report asynchronously (if linked)
- FR41: In Together mode, report shows both users' step-by-step ratings/help flags side-by-side (default shared)

**Stats & Progress (FR42-46)**
- FR42: User can view total sessions completed (couple aggregate)
- FR43: User can view total steps completed (couple aggregate)
- FR44: User can view last session completion date
- FR45: User can view average reflection rating (couple aggregate)
- FR46: User can view help requests count (couple aggregate)

**Partner Integration (FR47-49)**
- FR47: System detects whether user has a linked partner
- FR48: User without linked partner sees "Link your partner to do this together" message
- FR49: User can navigate to partner linking from Scripture Reading (existing flow)

**Accessibility (FR50-54)**
- FR50: User can navigate all controls via keyboard (logical tab order)
- FR51: User using screen reader receives clear aria-labels for rating scale
- FR52: System moves focus appropriately on phase transitions
- FR53: System respects `prefers-reduced-motion` by disabling motion-heavy animations
- FR54: System uses icons/text alongside color for state indicators (not color-only)

### NonFunctional Requirements

**Performance (NFR-P1 to NFR-P4)**
- NFR-P1: Real-time sync latency < 500ms typical (Together mode phase sync)
- NFR-P2: Phase transition perceived speed < 200ms (No blocking, use fade transitions)
- NFR-P3: Initial feature load time < 2s on 3G (Skeleton loading states)
- NFR-P4: UI responsiveness under latency — Show "Syncing..." indicator (No UI jitter or jarring state jumps)

**Security & Privacy (NFR-S1 to NFR-S5)**
- NFR-S1: Reflection data access — User + linked partner only (RLS policies)
- NFR-S2: Session data access — Participants only (No external visibility)
- NFR-S3: Daily Prayer Report visibility — Sender + recipient only (Private couple communication)
- NFR-S4: Data encryption — At rest and in transit (Supabase default + HTTPS)
- NFR-S5: Prior solo data privacy — Private by default after partner linking (Only explicit messages shared retroactively)

**Reliability (NFR-R1 to NFR-R6)**
- NFR-R1: Session state recovery — 100% (Reconnects resume correctly)
- NFR-R2: Data sync reliability — 99.9% (No lost reflections)
- NFR-R3: Race condition prevention — Zero double-advances (Server-authoritative state)
- NFR-R4: Offline solo data integrity — 100% (IndexedDB persists all local data)
- NFR-R5: Graceful degradation — Feature remains usable (If partner offline, allow clean exit)
- NFR-R6: Reflection write idempotency — Unique constraint per session_id + step_index + user_id (No double submits)

**Accessibility (NFR-A1 to NFR-A5)**
- NFR-A1: WCAG compliance — AA minimum
- NFR-A2: Keyboard navigation — Full feature access
- NFR-A3: Screen reader support — All interactive elements labeled
- NFR-A4: Motion sensitivity — Respect `prefers-reduced-motion`
- NFR-A5: Color independence — No color-only indicators

**Integration (NFR-I1 to NFR-I4)**
- NFR-I1: Supabase compatibility — Full compatibility with existing patterns (Auth, RLS, Realtime Broadcast)
- NFR-I2: Existing app integration — Seamless navigation (Use existing ViewType pattern)
- NFR-I3: Offline sync pattern — Consistent with existing sync services (IndexedDB + queue pattern)
- NFR-I4: State management pattern — Zustand slice composition (Consistent with existing slices)

### Additional Requirements

**From Architecture Document:**

- **No Starter Template** — Brownfield feature addition to existing My-Love PWA; first story creates new Zustand slice and Supabase tables
- **Centralized IndexedDB Configuration** — ✅ ALREADY IMPLEMENTED in `src/services/dbSchema.ts`. Extend with Scripture Reading stores (bump to v5, add 5 new stores to schema)
- **5 New Supabase Tables with RLS**:
  - `scripture_sessions` — Session metadata + derived snapshot (id, mode, user1_id, user2_id, current_phase, current_step_index, status, version, snapshot_json)
  - `scripture_step_states` — Per-step lock-in state (session_id, step_index, user1_locked_at, user2_locked_at)
  - `scripture_reflections` — Per-step user reflections (session_id, step_index, user_id, rating, notes, is_shared)
  - `scripture_bookmarks` — Per-step bookmarks (session_id, step_index, user_id, share_with_partner)
  - `scripture_messages` — Daily Prayer Report messages (session_id, sender_id, message)
- **Server-Authoritative State** — All state mutations through Supabase RPCs with version control and idempotent writes
- **Hybrid Sync Architecture** — Server-authoritative transitions + client pending state; clients show optimistic `pending_lock_in` locally
- **Phase Enum State Machine** — `'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete'`; step_index 0-16
- **Supabase Broadcast Channels** — `scripture-session:{session_id}` for state updates, `scripture-presence:{session_id}` for ephemeral presence
- **New Zustand Slice** — `scriptureReadingSlice` with types co-located in same file
- **New Service** — `scriptureReadingService` for IndexedDB CRUD with `synced: false` pattern
- **New Hooks** — `useMotionConfig.ts` (global reduced-motion), `useScriptureBroadcast.ts` (real-time channel)
- **Component Architecture** — Feature-scoped subfolders: `session/`, `reading/`, `reflection/`; container/presentational split
- **RLS Policy Pattern** — Session-based access control (user must be session participant)
- **Naming Conventions** — Database: snake_case; TypeScript: camelCase; Components: PascalCase; RPCs: `scripture_` prefix
- **Error Handling Pattern** — `ScriptureErrorCode` enum with centralized `handleScriptureError()` function
- **Loading State Pattern** — Explicit boolean flags: `isLoading`, `isPendingLockIn`, `isPendingReflection`, `isSyncing`

**From UX Design Document:**

- **Lavender Dreams Theme** — Use spiritual/contemplative purple color palette (#A855F7 primary, #F3E5F5 background) for Scripture Reading screens
- **8 New UI Components Required**:
  - `<Countdown>` — 3-2-1 synchronized start with Framer Motion; static fallback for `prefers-reduced-motion`
  - `<RoleIndicator>` — Pill badge showing "You read this" / "Partner reads this"
  - `<BookmarkFlag>` — Per-verse toggle replacing PRD's help/sensitive flag (simpler emotional dynamics)
  - `<PartnerPosition>` — Shows where partner is viewing ("Jordan is viewing the response")
  - `<LockInButton>` — "Ready for next verse" with waiting state and undo capability
  - `<SessionProgress>` — Text-only "Verse X of 17" (no progress bar — ritual, not task)
  - `<ReflectionSummary>` — End-of-session form with bookmarked verse selection, rating, note
  - `<DailyPrayerReport>` — Partner message reveal with side-by-side reflection comparison
- **Session Layout Contract** — Three-zone layout for all reading screens: TOP (progress + partner position), CENTER (content cards), BOTTOM (primary CTA in thumb zone)
- **Lock-In Mechanism** — Both partners must confirm to advance; prevents rushing, creates natural pause points
- **Free Navigation** — Move between verse ↔ response freely within each step; partner position indicator shows where they are
- **Role Alternation** — Reader on verse N becomes Responder on verse N+1
- **Bookmark Privacy** — Private by default; single global toggle at reflection: "Share the verses you marked in today's report?"
- **No-Shame Copy** — All waiting language must be neutral: "We'll continue when you're both ready" (never "Waiting for Jordan...")
- **Focus Management** — Defined focus targets: Lobby→Countdown container, Countdown→Verse heading, Step N→Step N+1 verse heading, Reading→Reflection form heading
- **Animation Specifications** — Phase transitions: 200-400ms crossfade; reduced-motion: instant swap; no bouncing/parallax
- **Touch Targets** — Minimum 48×48px hit area; Lock-in button: full-width 56px height
- **Typography** — Playfair Display for scripture text (20px), Inter for UI, Dancing Script for partner messages in report

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | View Scripture Reading overview page with stats |
| FR1a | Epic 1 | Access from bottom navigation |
| FR2 | Epic 1 | Start new session |
| FR3 | Epic 1 | Choose Solo/Together mode |
| FR4 | Epic 1 | Unlinked users see Solo only |
| FR5 | Epic 1 | Exit session cleanly |
| FR6 | Epic 1 | Resume incomplete solo session |
| FR7 | Epic 1 | Session completion criteria |
| FR8 | Epic 1 | Solo mode 17-step progression |
| FR9 | Epic 1 | Solo verse reading |
| FR10 | Epic 1 | Solo response viewing |
| FR11 | Epic 1 | Solo reflection submission |
| FR12 | Epic 1 | Solo save and exit |
| FR13 | Epic 1 | Full offline support |
| FR14 | Epic 3 | Together mode role selection |
| FR15 | Epic 3 | Together mode lobby |
| FR16 | Epic 3 | Partner join status |
| FR17 | Epic 3 | Ready state toggle |
| FR18 | Epic 3 | Solo fallback from lobby |
| FR19 | Epic 3 | 3-second countdown |
| FR20 | Epic 4 | Reader verse phase |
| FR21 | Epic 4 | Responder waiting (reader phase) |
| FR22 | Epic 4 | Responder response phase |
| FR23 | Epic 4 | Reader waiting (response phase) |
| FR24 | Epic 4 | Both see reflection screen |
| FR25 | Epic 4 | Synchronized step advancement |
| FR26 | Epic 4 | Progress indicator |
| FR27 | Epic 4 | Partner reconnecting indicator |
| FR28 | Epic 4 | Offline pause |
| FR29 | Epic 4 | Clean exit if partner offline |
| FR30 | Epic 1 | 1-5 rating scale |
| FR31 | Epic 1 | Help/sensitive flag |
| FR32 | Epic 1 | Optional note |
| FR33 | Epic 1 | Clear rating labels |
| FR34 | Epic 2 | End-of-session message |
| FR35 | Epic 2 | Skip message option |
| FR36 | Epic 2 | View Daily Prayer Report |
| FR37 | Epic 2 | Own ratings in report |
| FR38 | Epic 2 | Partner message in report |
| FR39 | Epic 2 | No-partner skip message step |
| FR40 | Epic 2 | Async solo report sharing |
| FR41 | Epic 4 | Side-by-side Together report |
| FR42 | Epic 1 | Total sessions stat |
| FR43 | Epic 1 | Total steps stat |
| FR44 | Epic 1 | Last session date |
| FR45 | Epic 1 | Average rating stat |
| FR46 | Epic 1 | Help requests count |
| FR47 | Epic 1 | Partner link detection |
| FR48 | Epic 1 | Link partner message |
| FR49 | Epic 1 | Navigate to partner linking |
| FR50 | Epic 5 | Keyboard navigation |
| FR51 | Epic 5 | Screen reader labels |
| FR52 | Epic 5 | Focus management |
| FR53 | Epic 5 | Reduced motion support |
| FR54 | Epic 5 | Color independence |

## Epic List

### Epic 1: Scripture Reading Foundation & Solo Mode

Users can access Scripture Reading, start solo sessions, progress through all 17 steps at their own pace, and complete sessions with reflections.

**FRs covered:** FR1, FR1a, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR30, FR31, FR32, FR33, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR49

**Implementation Notes:** Creates all foundational database tables (5 Supabase tables), Zustand slice, IndexedDB stores, services, and core UI components. Delivers complete offline-capable solo experience.

---

### Epic 2: Daily Prayer Report

Users can view their session reports showing ratings, help flags, and personal reflections after completing a session. For linked users, enables asynchronous sharing of solo session reports.

**FRs covered:** FR34, FR35, FR36, FR37, FR38, FR39, FR40

**Implementation Notes:** Builds on Epic 1's completed sessions. Creates ReflectionSummary and DailyPrayerReport components. Adds scripture_messages table usage.

---

### Epic 3: Together Mode Lobby & Synchronization

Linked partners can initiate a Together session, enter a lobby, see each other's status, and synchronize when both are ready.

**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR19

**Implementation Notes:** Introduces Supabase Broadcast channels for real-time presence. Creates Countdown component, lobby UI, role selection. Extends session state machine with lobby/countdown phases.

---

### Epic 4: Together Mode Reading Experience

Partners can read scripture together with role-based phases, see partner progress, and advance through verses as a synchronized pair.

**FRs covered:** FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR41

**Implementation Notes:** Implements lock-in mechanism, role alternation, partner position indicators, disconnection handling. Creates RoleIndicator, PartnerPosition, LockInButton components.

---

### Epic 5: Accessibility & Polish

All users, regardless of ability, can fully use Scripture Reading with keyboard navigation, screen reader support, and motion-sensitive animations.

**FRs covered:** FR50, FR51, FR52, FR53, FR54

**Implementation Notes:** Cross-cutting accessibility work. Creates useMotionConfig hook. Ensures WCAG AA compliance across all Scripture Reading components.

---

## Epic 1: Scripture Reading Foundation & Solo Mode

Users can access Scripture Reading, start solo sessions, progress through all 17 steps at their own pace, and complete sessions with reflections.

### Story 1.1: Navigation Entry Point

As a **user**,
I want **to access Scripture Reading from the bottom navigation**,
So that **I can easily find and start the feature from anywhere in the app**.

**Acceptance Criteria:**

**Given** the user is authenticated and on any screen with bottom navigation
**When** they tap the Scripture Reading icon
**Then** the app navigates to the Scripture Reading overview screen
**And** the bottom nav highlights the Scripture icon as active

**Given** the user has a linked partner
**When** they view the Scripture Reading entry point
**Then** Together mode is available (no partner-related messaging shown)

**Given** the user has no linked partner
**When** they view the Scripture Reading entry point
**Then** they see "Link your partner to do this together" message
**And** Solo mode remains accessible

**Given** the user has no linked partner
**When** they tap the "Link your partner" message (FR49)
**Then** the app navigates to the partner setup flow (existing ViewType)

**Given** the partner link status is loading
**When** the user views the Scripture Reading entry point
**Then** they see a skeleton/loading state for the partner status area

**Given** the partner link check fails (network error)
**When** the user views the Scripture Reading entry point
**Then** they see a neutral offline indicator
**And** Solo mode remains accessible

**Implementation Notes:**

- Add `'scripture'` to `ViewType` enum
- Add Scripture icon to `BottomNavigation` component
- Create `ScriptureOverview` container component
- Establish Lavender Dreams design tokens: `#A855F7` primary, `#F3E5F5` background
- Use existing partner state for detection
- Handle loading/error states gracefully

---

### Story 1.2: Data Foundation

As a **developer**,
I want **the Scripture Reading data layer established**,
So that **subsequent stories have reliable persistence and sync infrastructure**.

**Acceptance Criteria:**

**Given** the app is running on IndexedDB schema v4
**When** the app initializes after this story is deployed
**Then** IndexedDB migrates to schema v5 with 5 new stores:
- `scripture_sessions`
- `scripture_step_states`
- `scripture_reflections`
- `scripture_bookmarks`
- `scripture_messages`
**And** existing v4 data is preserved without loss

**Given** schema v5 migration fails (corruption, quota exceeded)
**When** the migration is attempted
**Then** the app logs the error and shows a retry banner
**And** session creation is blocked until migration succeeds
**And** existing app functionality remains unaffected

**Given** Supabase is accessible
**When** the Scripture Reading feature is first used
**Then** the following tables exist:
- `scripture_sessions` (id, mode, user1_id, user2_id, current_phase, current_step_index, status, version, snapshot_json, created_at, updated_at)
- `scripture_reflections` (id, session_id, step_index, user_id, rating, help_flag, notes, is_shared, synced_at)

**Given** RLS policies are applied to `scripture_sessions`
**When** a user queries the table
**Then** they can only read/write sessions where `user1_id = auth.uid()` OR `user2_id = auth.uid()`

**Given** RLS policies are applied to `scripture_reflections`
**When** a user queries the table
**Then** they can only read/write reflections where `user_id = auth.uid()` OR the session's partner has `is_shared = true`

**Given** the `scriptureReadingService` is initialized
**When** CRUD operations are called
**Then** they follow the existing `synced: false` pattern for offline-first writes
**And** expose methods: `createSession`, `getSession`, `updateSession`, `getSessionsByUser`

**Given** the user is offline
**When** `createSession` is called
**Then** record persists to IndexedDB with `synced: false`
**And** operation succeeds without network

**Given** the `scriptureReadingSlice` is added to Zustand
**When** the store initializes
**Then** types are co-located in the same file
**And** slice exposes: `currentSession`, `isLoading`, `error`, `sessions[]`

**Implementation Notes:**

- Extend `src/services/dbSchema.ts` - bump version to 5, add 5 new object stores
- Create Supabase migration for tables with RLS policies
- Create `src/services/scriptureReadingService.ts` following existing service patterns
- Create `src/store/scriptureReadingSlice.ts` with TypeScript types co-located
- Write migration validation tests
- Test RLS policies with different user contexts

---

### Story 1.3: Solo Session UI

As a **user**,
I want **to start a new Scripture Reading session and choose Solo mode**,
So that **I can begin my personal scripture reading journey**.

**Acceptance Criteria:**

**Given** the user is on the Scripture Reading overview screen
**When** they tap "Start New Session"
**Then** they see a mode selection screen with "Solo" and "Together" options
**And** the layout follows the THREE-ZONE contract: TOP (header), CENTER (mode cards), BOTTOM (confirm button in thumb zone)

**Given** the user has a linked partner
**When** they view the mode selection screen
**Then** both "Solo" and "Together" options are enabled and tappable

**Given** the user has no linked partner
**When** they view the mode selection screen
**Then** "Solo" is enabled
**And** "Together" is disabled with tooltip "Link your partner to unlock"

**Given** the user selects "Solo" mode
**When** they confirm their selection
**Then** a new session record is created in IndexedDB with:
- `mode: 'solo'`
- `status: 'active'`
- `current_step_index: 0`
- `current_phase: 'reading'` (solo skips lobby/countdown)
**And** the session is queued for Supabase sync
**And** the user is navigated to the first verse (step 0)

**Given** the user is offline
**When** they start a Solo session
**Then** the session is created locally in IndexedDB with `synced: false`
**And** UI transitions to `phase: 'reading'` immediately
**And** they can proceed without waiting for network

**Implementation Notes:**

- Create `ModeSelectionScreen` component following layout contract
- Create `StartSessionButton` component (BOTTOM zone, full-width)
- Wire up `scriptureReadingSlice.createSession()` action
- Phase state machine for solo: starts at `'reading'` (no `'lobby'` or `'countdown'`)
- Touch targets minimum 48×48px

---

### Story 1.4: Verse Reading Flow

As a **user in Solo mode**,
I want **to see the verse text and mark it as read**,
So that **I can progress through the 17 scripture steps at my own pace**.

**Acceptance Criteria:**

**Given** the user is in an active Solo session at step N (0-16)
**When** the reading screen loads
**Then** the layout follows the THREE-ZONE contract:
- TOP: Progress indicator "Verse X of 17" (X = N + 1)
- CENTER: Verse text card
- BOTTOM: "I've read this" button (full-width, 56px height, in thumb zone)

**Given** the verse text is displayed
**When** the user views the content
**Then** scripture text uses Playfair Display font at 20px
**And** UI text uses Inter font

**Given** the "I've read this" button is rendered
**When** measured
**Then** touch target is minimum 48×48px (actual: full-width × 56px)

**Given** the user is viewing the verse
**When** they tap "I've read this"
**Then** the UI transitions to show the response text (within same step)
**And** `current_phase` updates to `'response'` locally

**Given** the user is on step 16 (the last step)
**When** they view the progress indicator
**Then** it shows "Verse 17 of 17"

**Given** the user navigates away mid-step (app background, browser close)
**When** they return to the session
**Then** they resume at the same step and phase they left
**And** progress shows correct "Verse X of 17"

**Given** the verse content fails to load
**When** the user views the reading screen
**Then** they see an error state with "Retry" option
**And** step progression is blocked until content loads

**Implementation Notes:**

- Create `VerseReadingScreen` component following layout contract
- Create `SessionProgress` component (text-only, no progress bar per UX spec)
- Store 17 steps of verse content in static JSON
- Track `current_phase` within step: `'verse' | 'response' | 'reflection'`
- Persist step/phase state to IndexedDB on every transition
- Typography: Playfair Display 20px for scripture, Inter for UI

---

### Story 1.5: Response Display Flow

As a **user in Solo mode**,
I want **to see the response text after reading the verse**,
So that **I can reflect on its meaning before submitting my reflection**.

**Acceptance Criteria:**

**Given** the user has marked the verse as read (phase = 'response')
**When** the response screen loads
**Then** the layout follows the THREE-ZONE contract:
- TOP: Progress indicator "Verse X of 17"
- CENTER: Response text card with "Back to Verse" link
- BOTTOM: "Continue to Reflection" button (full-width, 56px height)

**Given** the user taps "Continue to Reflection"
**When** they confirm
**Then** the UI transitions to the reflection form
**And** `current_phase` updates to `'reflection'` locally
**And** focus moves to the reflection form heading (per UX focus spec)

**Given** the user taps "Back to Verse"
**When** they confirm
**Then** the UI transitions back to verse display
**And** `current_phase` updates to `'verse'` locally
**And** no duplicate step increments occur

**Given** the user navigates verse → response → verse → response
**When** they view the step state
**Then** `current_step_index` remains unchanged (free navigation within step)

**Given** the user is offline
**When** they navigate between verse and response
**Then** transitions work without network dependency

**Implementation Notes:**

- Create `ResponseDisplayScreen` component following layout contract
- Allow free navigation between verse ↔ response within a step (per UX spec)
- Response content stored alongside verse content in static source
- Phase transitions update IndexedDB immediately
- Touch targets minimum 48×48px

---

### Story 1.6: Reflection Submission

As a **user in Solo mode**,
I want **to submit my reflection with a rating, optional help flag, and optional note**,
So that **I can track my spiritual growth and flag areas needing support**.

**Acceptance Criteria:**

**Given** the user is on the reflection screen for step N
**When** the screen loads
**Then** the layout follows the THREE-ZONE contract:
- TOP: Progress indicator "Verse X of 17"
- CENTER: Reflection form (rating, help toggle, note field)
- BOTTOM: "Submit Reflection" button (full-width, 56px height)

**Given** the reflection form is displayed
**When** the user views the rating scale
**Then** they see a 1-5 scale with accessible labels:
- 1="Struggling", 2="Difficult", 3="Neutral", 4="Good", 5="Strong"
**And** each rating option has minimum 48×48px touch target

**Given** the user has not selected a rating
**When** they view the "Submit Reflection" button
**Then** it is disabled

**Given** the user selects a rating (1-5)
**When** they have not yet submitted
**Then** the "Submit Reflection" button becomes enabled

**Given** the user submits a reflection with rating=3, help_flag=true, note="Need to pray more"
**When** they tap "Submit Reflection"
**Then** a reflection record is created/updated in IndexedDB:
- `session_id`, `step_index: N`, `user_id`, `rating: 3`, `help_flag: true`, `notes: "Need to pray more"`, `synced: false`
**And** the record is queued for Supabase sync
**And** if step 0-15: session advances to step N+1, phase='verse'
**And** if step 16: session advances to completion flow

**Given** the user tries to submit without selecting a rating
**When** they tap "Submit Reflection"
**Then** validation error shows "Please select a rating"
**And** submission is blocked

**Given** the user enters a note exceeding 200 characters
**When** they type
**Then** input is truncated at 200 characters
**And** character count shows "200/200"

**Given** a reflection already exists for this session/step/user
**When** the user reopens the reflection screen
**Then** the form pre-fills with existing values (rating, help_flag, notes)

**Given** the user modifies and resubmits an existing reflection
**When** they tap "Submit Reflection"
**Then** the existing reflection is updated (idempotent upsert)
**And** no duplicate records are created (unique constraint: session_id + step_index + user_id)

**Given** the user is offline
**When** they submit a reflection
**Then** the reflection saves to IndexedDB with `synced: false`
**And** they can proceed to the next step immediately

**Implementation Notes:**

- Create `ReflectionForm` component following layout contract
- Create rating scale component with accessible labels (aria-labels per FR33)
- Implement character counter for notes field
- Use `scriptureReadingService.upsertReflection()` with idempotent logic
- Validate rating is 1-5 integer before submission
- Touch targets minimum 48×48px for all interactive elements

---

### Story 1.7: Session Completion & Exit

As a **user in Solo mode**,
I want **to complete my session after all 17 reflections and exit cleanly at any point**,
So that **my progress is saved and I have a clear sense of accomplishment**.

**Acceptance Criteria:**

**Given** the user submits their reflection for step 16 (the final step)
**When** the submission succeeds
**Then** the session transitions:
- `current_phase` → `'complete'`
- `status` → `'complete'`
- `completed_at` → current timestamp
**And** the user sees a completion confirmation screen
**And** they are offered to view their Daily Prayer Report (placeholder for Epic 2)

**Given** the user is on any screen within an active session
**When** they tap the exit/close button
**Then** they see a confirmation dialog: "Exit session? Your progress is saved."

**Given** the user confirms exit from an incomplete session
**When** they confirm
**Then** the session remains with `status: 'active'` and current step/phase preserved
**And** they are navigated to the Scripture Reading overview

**Given** the user cancels exit
**When** they tap "Cancel"
**Then** they remain on the current screen
**And** no state changes occur

**Given** the user force-closes the app mid-session (kill app, close browser)
**When** they reopen the app
**Then** the session state is preserved in IndexedDB
**And** step, phase, and all submitted reflections are intact
**And** they can resume from where they left off

**Given** a session has `status: 'complete'` and `current_phase: 'complete'`
**When** the user views session history
**Then** the session shows as completed with the completion date

**Implementation Notes:**

- Create `SessionCompletionScreen` component
- Create exit confirmation dialog component
- Session completion criteria: reflection exists for all 17 steps (0-16)
- Phase enum includes `'complete'` as terminal state
- Update `scriptureReadingSlice` with `completeSession()` action
- Track `completed_at` timestamp in session record

---

### Story 1.8: Resume Session UI

As a **user**,
I want **to resume an incomplete Solo session from the overview page**,
So that **I can continue my scripture reading journey where I left off**.

**Acceptance Criteria:**

**Given** the user has an incomplete Solo session (status='active')
**When** they open the Scripture Reading overview
**Then** they see a "Continue Session" card prominently displayed
**And** it shows current progress: "Verse X of 17"
**And** the card is the primary action (above "Start New Session")

**Given** the user taps "Continue Session"
**When** the session loads from IndexedDB
**Then** they resume at the exact step and phase they left off
**And** all previously submitted reflections are preserved
**And** the UI renders the correct screen (verse/response/reflection based on phase)

**Given** the user has no active session
**When** they view the Scripture Reading overview
**Then** "Continue Session" card is not shown
**And** "Start New Session" is the primary action

**Given** the user has multiple incomplete sessions (edge case)
**When** they view the overview
**Then** the most recently updated session is shown in "Continue Session"

**Given** the user is offline
**When** they tap "Continue Session"
**Then** the session loads from IndexedDB
**And** they can continue reading without network

**Implementation Notes:**

- Create `ContinueSessionCard` component
- Add `getActiveSession()` to `scriptureReadingService`
- Add `getMostRecentActiveSession()` for multiple session edge case
- Wire up to `scriptureReadingSlice.loadSession()` action

---

### Story 1.9: Offline Sync Engine

As a **user**,
I want **my offline scripture reading data to sync reliably when I reconnect**,
So that **I never lose progress and my data is backed up**.

**Acceptance Criteria:**

**Given** the user completes actions while offline (sessions, reflections)
**When** network connectivity returns
**Then** the sync service automatically pushes:
- Session records to `scripture_sessions`
- Reflection records to `scripture_reflections`
**And** records update to `synced: true` locally
**And** sync happens in background without blocking UI

**Given** a sync conflict occurs (same reflection modified on server)
**When** sync is attempted
**Then** client data wins (last-write-wins for user's own reflections)
**And** conflict is logged for debugging
**And** no user notification required (silent resolution)

**Given** the user edits the same session on two devices while offline
**When** both devices reconnect and sync
**Then** last-write-wins applies based on `updated_at` timestamp
**And** no data corruption occurs

**Given** the sync queue has items pending
**When** the user views the app
**Then** a subtle "Syncing..." indicator appears (per NFR-P4)
**And** it disappears when sync completes

**Given** sync fails (server error, auth expired)
**When** the failure occurs
**Then** items remain in queue with `synced: false`
**And** retry is attempted on next network availability
**And** user is not interrupted

**Given** the user's device storage is full (IndexedDB quota exceeded)
**When** they try to save a reflection
**Then** they see a neutral warning: "Storage full. Please free up space to continue."
**And** the reflection is kept in memory with retry option
**And** existing data is not corrupted

**Given** the sync queue grows large (>50 items)
**When** sync runs
**Then** items are processed in batches to avoid timeout
**And** progress continues across app restarts

**Implementation Notes:**

- Implement sync queue processing in existing sync service pattern
- Add offline detection using `navigator.onLine` and/or existing offline hook
- Implement last-write-wins conflict resolution using `updated_at`
- Handle IndexedDB quota exceeded gracefully
- Batch processing for large queues
- Subtle sync indicator component

---

### Story 1.10: Overview Page with Stats

As a **user**,
I want **to see my Scripture Reading statistics on the overview page**,
So that **I can track my spiritual journey and celebrate progress with my partner**.

**Acceptance Criteria:**

**Given** the user opens the Scripture Reading overview
**When** the page loads
**Then** they see the following stats:
- Total sessions completed (integer)
- Total steps completed (integer, sum of all session steps)
- Last session completion date (formatted date or "Never")
- Average reflection rating (1.0-5.0, one decimal place)
- Help requests count (integer, total help_flag=true)

**Given** the user has no completed sessions
**When** they view the stats area
**Then** stats show:
- Sessions: 0
- Steps: 0
- Last session: "Never"
- Average rating: "—"
- Help requests: 0

**Given** the user has a linked partner
**When** stats are calculated
**Then** they aggregate both users' session and reflection data
**And** label indicates "Your journey together"

**Given** the user has no linked partner
**When** stats are calculated
**Then** they show only the user's personal data
**And** label indicates "Your journey"

**Given** stats data is loading
**When** the overview page renders
**Then** stats area shows skeleton loading state

**Given** stats calculation fails (network error, DB error)
**When** the overview attempts to load stats
**Then** stats area shows "Unable to load stats" with retry option
**And** rest of page remains functional

**Given** the user is offline
**When** they view the overview
**Then** stats are calculated from local IndexedDB data only
**And** a subtle indicator shows "Offline - showing local data"

**Given** the user completes sessions offline then reconnects
**When** stats are recalculated after sync
**Then** server and local data reconcile without double-counting
**And** stats reflect accurate totals

**Given** the user completes a session
**When** they return to the overview
**Then** stats are refreshed to reflect the new completion

**Implementation Notes:**

- Create `ScriptureStats` component
- Add stats calculation methods to `scriptureReadingService`:
  - `getCompletedSessionCount(userId, partnerId?)`
  - `getTotalStepsCompleted(userId, partnerId?)`
  - `getLastSessionDate(userId, partnerId?)`
  - `getAverageRating(userId, partnerId?)` - returns null if no data
  - `getHelpRequestCount(userId, partnerId?)`
- Use existing partner state to determine couple vs individual view
- Cache stats with short TTL to avoid recalculating on every render
- Reconciliation: use `synced` flag to avoid counting unsynced items twice

---

## Epic 2: Daily Prayer Report

Users can view their session reports showing ratings, help flags, and personal reflections after completing a session. For linked users, enables asynchronous sharing of solo session reports.

### Story 2.1: End-of-Session Message Composition

As a **user who just completed a session**,
I want **to optionally send a message to my partner**,
So that **I can share my thoughts or encouragement after our reading**.

**Acceptance Criteria:**

**Given** the user has a linked partner
**When** they complete a session (submit step 16 reflection)
**Then** they see the message composition screen before the report
**And** the layout follows the THREE-ZONE contract:
- TOP: "Send a message to [Partner Name]"
- CENTER: Text input (max 300 characters) with character counter
- BOTTOM: "Send" and "Skip" buttons

**Given** the user types a message
**When** they reach 300 characters
**Then** input is truncated at 300 characters
**And** character count shows "300/300"

**Given** the user taps "Send"
**When** the message is valid (1-300 characters)
**Then** the message is saved to `scripture_messages` table
**And** `synced: false` if offline
**And** the user proceeds to the Daily Prayer Report

**Given** the user taps "Skip"
**When** they confirm
**Then** no message is saved
**And** the user proceeds to the Daily Prayer Report

**Given** the user has NO linked partner
**When** they complete a session
**Then** the message composition screen is SKIPPED entirely
**And** the user proceeds directly to the Daily Prayer Report

**Given** the user is offline
**When** they send a message
**Then** the message saves to IndexedDB with `synced: false`
**And** the user proceeds normally

**Implementation Notes:**

- Create `MessageCompositionScreen` component
- Use `scripture_messages` table: `session_id`, `sender_id`, `message`, `created_at`
- Character limit 300 (FR34)
- Skip partner detection using existing relationship state
- Follow Dancing Script font for message display per UX spec (report only)

---

### Story 2.2: Daily Prayer Report - Personal View

As a **user**,
I want **to view my Daily Prayer Report showing my step-by-step ratings and help flags**,
So that **I can reflect on my scripture reading journey**.

**Acceptance Criteria:**

**Given** the user completes a session (or taps "View Report" from completed session)
**When** the Daily Prayer Report loads
**Then** they see:
- Session date and mode (Solo/Together)
- All 17 steps listed with:
  - Step number and verse reference
  - Their rating (1-5 with label)
  - Help flag indicator (if flagged)
  - Their note (if entered)

**Given** the user flagged "help needed" on step 5
**When** they view the report
**Then** step 5 shows a visible help indicator
**And** the indicator uses icon+text (not color-only per NFR-A5)

**Given** the user did not enter notes for some steps
**When** they view the report
**Then** those steps show rating and help flag only (no empty note section)

**Given** the report data is loading
**When** the screen renders
**Then** skeleton loading state is shown

**Given** the user is offline
**When** they view a report for a locally-stored session
**Then** the report renders from IndexedDB data

**Given** the user has no linked partner
**When** they view the report
**Then** the report shows their personal data only
**And** the "Partner's message" section is not shown

**Implementation Notes:**

- Create `DailyPrayerReport` component
- Create `ReportStepItem` component for each step row
- Query `scripture_reflections` for session's 17 steps
- Handle missing reflections gracefully (show "—")
- Typography: Playfair Display for verse references, Inter for UI

---

### Story 2.3: Partner Message & Async Report Sharing

As a **user with a linked partner**,
I want **to see my partner's message and have my solo reports shared asynchronously**,
So that **we can stay connected even when reading separately**.

**Acceptance Criteria:**

**Given** the user has a linked partner
**When** they view a Together mode report
**Then** they see their partner's message (if sent) in a highlighted section
**And** the message uses Dancing Script font per UX spec

**Given** the partner did not send a message
**When** the user views the report
**Then** no "Partner's message" section is shown (not empty state)

**Given** the user completed a Solo session
**When** the session syncs to Supabase
**Then** the linked partner can view this session's Daily Prayer Report
**And** only the user's message (if sent) is visible to partner
**And** individual step notes are NOT shared (private by default per NFR-S5)

**Given** the partner has a Solo session report available
**When** the user opens Scripture Reading
**Then** they see a notification: "New report from [Partner Name]"
**And** they can tap to view the partner's report summary

**Given** the user views their partner's Solo report
**When** the report loads
**Then** they see:
- Session date
- Partner's message (if sent)
- Partner's overall stats (total steps, completion)
**And** they do NOT see partner's individual step ratings/notes (privacy)

**Given** the user is offline
**When** they try to view a partner's report
**Then** they see "Connect to view partner's report" message

**Implementation Notes:**

- Extend `DailyPrayerReport` with partner message section
- Create `PartnerReportNotification` component for overview
- Create `PartnerReportSummary` component (limited view)
- RLS ensures partner can only see: session metadata + message
- Partner cannot see: individual step ratings, notes, help flags
- New report detection: compare last_viewed_partner_report timestamp

---

## Epic 3: Together Mode Lobby & Synchronization

Linked partners can initiate a Together session, enter a lobby, see each other's status, and synchronize when both are ready.

### Story 3.1: Together Mode Role Selection & Session Creation

As a **user with a linked partner**,
I want **to select my role (Reader or Responder) when starting Together mode**,
So that **my partner and I can coordinate who leads each verse**.

**Acceptance Criteria:**

**Given** the user has a linked partner
**When** they select "Together" mode from the mode selection screen
**Then** they see a role selection screen with "Reader" and "Responder" options
**And** the layout follows the THREE-ZONE contract:
- TOP: "Choose your role for this session"
- CENTER: Role cards with descriptions
- BOTTOM: "Start Session" button (disabled until role selected)

**Given** the role options are displayed
**When** the user views them
**Then** "Reader" shows: "You'll read the verse aloud first"
**And** "Responder" shows: "You'll share the response after your partner reads"

**Given** the user selects "Reader"
**When** they tap "Start Session"
**Then** a new session is created with:
- `mode: 'together'`
- `status: 'active'`
- `current_phase: 'lobby'`
- `user1_id: current_user` (initiator is always user1)
- `user1_role: 'reader'`
**And** session is saved to IndexedDB and queued for Supabase sync
**And** user enters the lobby screen

**Given** the user selects "Responder"
**When** they tap "Start Session"
**Then** session is created with `user1_role: 'responder'`

**Given** the user is offline
**When** they try to start Together mode
**Then** they see: "Together mode requires an internet connection"
**And** "Start Session" is disabled
**And** they can switch to Solo mode

**Given** the partner has already created a pending Together session
**When** the user selects Together mode
**Then** they see: "Join [Partner]'s session?" with Accept/Decline options
**And** if accepted, they join as `user2_id` with complementary role

**Implementation Notes:**

- Create `RoleSelectionScreen` component
- Extend session schema with `user1_role`, `user2_role` fields
- Role alternation logic: Reader on step N becomes Responder on step N+1
- Check for existing partner session before creating new one
- Require network for Together mode (unlike Solo)

---

### Story 3.2: Together Mode Lobby

As a **user in Together mode**,
I want **to wait in a lobby and see my partner's join status**,
So that **I know when we're both ready to start reading together**.

**Acceptance Criteria:**

**Given** the user has created or joined a Together session
**When** the lobby screen loads
**Then** they see the layout following the THREE-ZONE contract:
- TOP: "Scripture Reading - Together"
- CENTER: Partner status card, Ready toggle
- BOTTOM: "Ready" / "Not Ready" toggle button

**Given** the partner has NOT joined yet
**When** the user views the lobby
**Then** partner status shows: "Waiting for [Partner Name] to join..."
**And** status uses neutral language (no shame per UX spec)

**Given** the partner joins the session
**When** the presence update is received via Supabase Broadcast
**Then** partner status updates to: "[Partner Name] has joined"
**And** partner's ready state is shown

**Given** the user taps "Ready"
**When** they are not yet ready
**Then** their status changes to "Ready"
**And** the button changes to "Not Ready" (toggle)
**And** ready state is broadcast to partner via `scripture-presence:{session_id}`

**Given** the user taps "Not Ready"
**When** they are currently ready
**Then** their status changes to "Not Ready"
**And** state is broadcast to partner

**Given** both users are in the lobby
**When** one user's ready state changes
**Then** the other user sees the update within 500ms (NFR-P1)

**Given** the partner goes offline while in lobby
**When** presence timeout occurs (5 seconds)
**Then** partner status shows: "[Partner Name] reconnecting..."
**And** no shame language is used

**Given** the partner reconnects
**When** presence is restored
**Then** partner status updates and ready states are synchronized

**Implementation Notes:**

- Create `LobbyScreen` component
- Create `useScriptureBroadcast` hook for real-time channel subscription
- Use Supabase Realtime Presence for partner online/offline detection
- Broadcast channel: `scripture-presence:{session_id}`
- Presence payload: `{ user_id, ready: boolean, online: boolean }`
- 5-second timeout for presence before showing "reconnecting"

---

### Story 3.3: Lobby Fallback to Solo & Countdown Start

As a **user in the Together mode lobby**,
I want **to fall back to Solo mode if needed and start when both ready**,
So that **I'm never stuck waiting and can begin reading smoothly**.

**Acceptance Criteria:**

**Given** the user is in the lobby (pre-countdown)
**When** they want to switch to Solo mode
**Then** they see a "Continue Solo" option
**And** tapping it shows: "Continue on your own? Your partner can join a new session later."

**Given** the user confirms fallback to Solo
**When** they tap "Continue Solo"
**Then** the session converts to Solo mode:
- `mode: 'solo'`
- `user2_id: null`
- `current_phase: 'reading'`
**And** partner is notified via broadcast: "Session converted to Solo"
**And** user proceeds to first verse

**Given** the countdown has started
**When** the user tries to fall back to Solo
**Then** "Continue Solo" option is hidden (too late)

**Given** BOTH users are ready
**When** both ready states are confirmed
**Then** a 3-second countdown begins automatically
**And** countdown shows: 3... 2... 1... with animation
**And** focus moves to countdown container (per UX focus spec)

**Given** the countdown is in progress
**When** either user toggles to "Not Ready"
**Then** countdown is cancelled
**And** both users return to lobby state
**And** message shows: "We'll continue when you're both ready"

**Given** the countdown completes (reaches 0)
**When** both users remained ready
**Then** `current_phase` transitions to `'reading'`
**And** both users navigate to verse display for step 0
**And** focus moves to verse heading

**Given** `prefers-reduced-motion` is enabled
**When** countdown displays
**Then** animation is replaced with static number sequence
**And** transitions are instant (no fade)

**Given** network disconnection during countdown
**When** presence is lost
**Then** countdown is cancelled
**And** both users see: "[Partner] reconnecting..."

**Implementation Notes:**

- Create `Countdown` component with Framer Motion animation
- Add reduced-motion variant using `useMotionConfig` hook
- Countdown logic: 3-second timer, cancellable by ready state change
- Broadcast countdown state: `{ countdown_active: boolean, countdown_value: number }`
- Session mode conversion logic in `scriptureReadingService`
- No-shame copy: never "Waiting for [name]...", always "We'll continue when..."

---

## Epic 4: Together Mode Reading Experience

Partners can read scripture together with role-based phases, see partner progress, and advance through verses as a synchronized pair.

### Story 4.1: Reader Phase - Verse Display & Lock-In

As the **Reader in Together mode**,
I want **to see the verse and mark when I'm done reading**,
So that **my partner knows I've finished and we can proceed together**.

**Acceptance Criteria:**

**Given** the user is the Reader for the current step
**When** the reading screen loads
**Then** the layout follows the THREE-ZONE contract:
- TOP: Progress "Verse X of 17" + `<RoleIndicator>` showing "You read this"
- CENTER: Verse text card
- BOTTOM: "Done reading" button (full-width, 56px height)

**Given** the verse is displayed
**When** the user views the content
**Then** scripture text uses Playfair Display font at 20px
**And** touch target for "Done reading" is minimum 48×48px

**Given** the user taps "Done reading"
**When** they confirm
**Then** their lock-in state is recorded:
- `scripture_step_states.user1_locked_at` (or user2) = timestamp
- Local state shows `isPendingLockIn: true` optimistically
**And** the button changes to "Waiting for [Partner]..." (disabled)
**And** lock-in is broadcast via `scripture-session:{session_id}`

**Given** the user has locked in
**When** they want to undo
**Then** they can tap "Undo" within 5 seconds
**And** lock-in is cleared and button returns to "Done reading"

**Given** both users have locked in for the verse phase
**When** the server confirms both locks
**Then** phase transitions to response phase
**And** roles swap: Reader becomes Responder for response

**Given** role alternation is active
**When** the user was Reader on step N
**Then** they become Responder on step N+1
**And** `<RoleIndicator>` updates accordingly

**Implementation Notes:**

- Create `TogetherVerseScreen` component (extends Solo verse screen)
- Create `<RoleIndicator>` pill badge component
- Create `<LockInButton>` with waiting state and undo capability
- Use `scripture_step_states` table for lock-in tracking
- Optimistic UI: show pending state before server confirms
- Server RPC: `scripture_lock_in(session_id, step_index, phase)`

---

### Story 4.2: Responder Phase - Waiting & Response Display

As the **Responder in Together mode**,
I want **to wait while my partner reads, then see the response when it's my turn**,
So that **we experience the scripture in a coordinated, meaningful way**.

**Acceptance Criteria:**

**Given** the user is the Responder during the verse phase
**When** the screen loads
**Then** they see a waiting screen:
- TOP: Progress "Verse X of 17" + `<RoleIndicator>` showing "Partner reads this"
- CENTER: `<PartnerPosition>` showing "[Partner] is reading the verse"
- BOTTOM: No action button (waiting)

**Given** the user is waiting
**When** they view the screen
**Then** language is neutral: "We'll continue when you're both ready"
**And** no "Waiting for [Partner]..." shame language

**Given** the Reader locks in (done reading)
**When** the broadcast is received
**Then** the Responder's screen transitions to response display
**And** transition uses 200-400ms crossfade (per UX animation spec)

**Given** the user is the Responder during the response phase
**When** the response screen loads
**Then** they see:
- TOP: Progress + `<RoleIndicator>` showing "You respond"
- CENTER: Response text card
- BOTTOM: "Done" button (full-width, 56px height)

**Given** the Responder taps "Done"
**When** they confirm
**Then** their lock-in state is recorded
**And** button changes to waiting state

**Given** the user is the Reader during the response phase
**When** the screen loads
**Then** they see a waiting screen with `<PartnerPosition>` showing "[Partner] is viewing the response"

**Given** both users have locked in for the response phase
**When** the server confirms both locks
**Then** phase transitions to reflection phase
**And** both users see the reflection screen

**Given** `prefers-reduced-motion` is enabled
**When** phase transitions occur
**Then** crossfade is replaced with instant swap

**Implementation Notes:**

- Create `TogetherWaitingScreen` component
- Create `<PartnerPosition>` component showing partner's current view
- Create `TogetherResponseScreen` component
- Phase transitions via Supabase Broadcast: `{ phase, step_index }`
- Animation: 200-400ms crossfade using Framer Motion
- Respect `prefers-reduced-motion` via `useMotionConfig` hook

---

### Story 4.3: Together Mode Reflection & Step Advancement

As a **user in Together mode**,
I want **to submit my reflection and advance only when both of us are done**,
So that **we stay synchronized throughout our reading journey**.

**Acceptance Criteria:**

**Given** both users have completed the response phase
**When** the reflection screen loads
**Then** both users see the same reflection form (reuses Solo reflection UI)
**And** layout follows THREE-ZONE contract
**And** each user submits independently

**Given** user A submits their reflection
**When** user B has not yet submitted
**Then** user A sees: "Reflection saved. We'll continue when you're both ready."
**And** user A's reflection is saved to `scripture_reflections`
**And** their lock-in state is recorded in `scripture_step_states`

**Given** both users have submitted reflections for step N
**When** the server confirms both submissions
**Then** if step N < 16: session advances to step N+1, phase='verse'
**And** if step N = 16: session advances to completion flow
**And** roles swap for the new step

**Given** the step advances
**When** both users' screens update
**Then** transition uses 200-400ms crossfade
**And** focus moves to new verse heading (per UX focus spec)

**Given** the user wants to edit their reflection before partner submits
**When** they tap "Edit"
**Then** the form reopens with their existing values
**And** they can resubmit (idempotent upsert)

**Given** both users complete step 16 reflections
**When** the session completes
**Then** `current_phase` → `'complete'`
**And** both users proceed to message composition (Epic 2)

**Implementation Notes:**

- Reuse `ReflectionForm` component from Solo mode
- Add Together-specific waiting state after submission
- Server-authoritative step advancement via RPC
- Prevent race conditions: version-controlled state updates
- Lock-in tracking in `scripture_step_states` for reflection phase

---

### Story 4.4: Partner Disconnection Handling

As a **user in Together mode**,
I want **graceful handling when my partner goes offline**,
So that **I'm not stuck and can exit cleanly if needed**.

**Acceptance Criteria:**

**Given** the partner goes offline during a Together session
**When** presence timeout occurs (5 seconds)
**Then** the user sees: `<PartnerPosition>` showing "[Partner] reconnecting..."
**And** no shame language is used
**And** the current phase is paused (no advancement possible)

**Given** the partner is offline
**When** the user tries to lock in / submit
**Then** their action is saved locally
**And** message shows: "Saved. We'll sync when [Partner] reconnects."

**Given** the partner reconnects
**When** presence is restored
**Then** states are synchronized
**And** any pending lock-ins are processed
**And** session resumes normally

**Given** the partner remains offline for extended time
**When** the user wants to exit
**Then** they see "End Session" option
**And** tapping shows confirmation: "End this session? Your progress is saved."

**Given** the user confirms ending the session
**When** they tap "End Session"
**Then** the session status changes to `'abandoned'`
**And** their reflections are preserved
**And** they return to Scripture Reading overview

**Given** the user's own connection drops
**When** they go offline
**Then** local state is preserved in IndexedDB
**And** when reconnected, they rejoin at the correct step/phase

**Given** both users go offline simultaneously
**When** both reconnect
**Then** session state is reconciled from server
**And** the most recent server state wins

**Implementation Notes:**

- Create `PartnerOfflineOverlay` component
- Use Supabase Realtime Presence for online/offline detection
- 5-second timeout before showing "reconnecting"
- Session status enum: `'active' | 'complete' | 'abandoned'`
- Preserve local state during disconnection
- Reconciliation: server state is authoritative

---

### Story 4.5: Together Mode Report - Side-by-Side View

As a **user who completed a Together session**,
I want **to see both my ratings and my partner's ratings side-by-side**,
So that **we can reflect on our shared journey and support each other**.

**Acceptance Criteria:**

**Given** the user views a Together mode Daily Prayer Report
**When** the report loads
**Then** each step shows side-by-side comparison:
- Left column: User's rating, help flag, note
- Right column: Partner's rating, help flag, note

**Given** a step where both users flagged "help needed"
**When** viewing the report
**Then** both help flags are visible
**And** this is highlighted as a shared struggle point

**Given** a step where only one user flagged "help needed"
**When** viewing the report
**Then** only that user's flag is shown
**And** the other column shows their rating without flag

**Given** either user entered a note
**When** viewing the report
**Then** notes are shown in respective columns
**And** notes use appropriate typography (Inter for readability)

**Given** the user views a Solo mode report
**When** the report loads
**Then** side-by-side view is NOT shown (single column only)

**Given** the report data is loading
**When** the screen renders
**Then** skeleton loading state shows for both columns

**Given** the user is offline
**When** they view a locally-stored Together report
**Then** both users' data renders from IndexedDB (if synced before offline)

**Implementation Notes:**

- Extend `DailyPrayerReport` with side-by-side layout for Together mode
- Create `ReportStepComparison` component for two-column step view
- Query both users' reflections for the session
- Together mode reflections are shared by default (FR41)
- Highlight matching help flags as "shared struggle"

---

## Epic 5: Accessibility & Polish

All users, regardless of ability, can fully use Scripture Reading with keyboard navigation, screen reader support, and motion-sensitive animations.

### Story 5.1: Keyboard Navigation

As a **user who navigates via keyboard**,
I want **to access all Scripture Reading controls with logical tab order**,
So that **I can fully use the feature without a mouse or touch**.

**Acceptance Criteria:**

**Given** the user is on any Scripture Reading screen
**When** they press Tab
**Then** focus moves through interactive elements in logical reading order:
- TOP zone elements first (if interactive)
- CENTER zone elements second
- BOTTOM zone elements last (primary CTA)

**Given** the user is on the mode selection screen
**When** they navigate via keyboard
**Then** they can:
- Tab to "Solo" card, press Enter/Space to select
- Tab to "Together" card, press Enter/Space to select
- Tab to "Start Session" button, press Enter to confirm

**Given** the user is on the reflection form
**When** they navigate via keyboard
**Then** they can:
- Tab through rating options (1-5)
- Use Arrow keys to move between rating options
- Press Enter/Space to select a rating
- Tab to help flag toggle, press Enter/Space to toggle
- Tab to notes field, type freely
- Tab to Submit button, press Enter to submit

**Given** the user is in a modal/dialog
**When** they press Tab
**Then** focus is trapped within the modal
**And** pressing Escape closes the modal

**Given** the user presses Tab on the last focusable element
**When** Shift is not held
**Then** focus wraps to the first focusable element (within modal) or continues normally (on page)

**Given** any interactive element receives focus
**When** the element is visible
**Then** a visible focus indicator is shown (2px outline minimum per WCAG)

**Implementation Notes:**

- Audit all Scripture Reading components for tab order
- Use semantic HTML: `<button>`, `<input>`, proper heading hierarchy
- Implement focus trap for modals using existing pattern or `focus-trap` library
- Ensure all custom components have `tabIndex` and keyboard handlers
- Test with keyboard-only navigation

---

### Story 5.2: Screen Reader Support

As a **user who uses a screen reader**,
I want **clear aria-labels on all interactive elements**,
So that **I understand what each control does and can use the feature effectively**.

**Acceptance Criteria:**

**Given** the rating scale is displayed
**When** a screen reader reads the options
**Then** each rating has a clear label:
- "Rating 1 of 5: Struggling"
- "Rating 2 of 5: Difficult"
- "Rating 3 of 5: Neutral"
- "Rating 4 of 5: Good"
- "Rating 5 of 5: Strong"

**Given** a rating is selected
**When** a screen reader reads the selected state
**Then** it announces: "Rating [N] of 5: [Label], selected"

**Given** the progress indicator shows "Verse 5 of 17"
**When** a screen reader reads it
**Then** it announces: "Progress: Verse 5 of 17"

**Given** the help flag toggle is displayed
**When** a screen reader reads it
**Then** it announces: "I want my partner's help, checkbox, [checked/unchecked]"

**Given** a button is in a loading/waiting state
**When** a screen reader reads it
**Then** it announces the state: "Done reading button, waiting for partner"

**Given** the partner status shows "reconnecting"
**When** a screen reader reads it
**Then** it announces: "[Partner name] reconnecting, please wait"

**Given** any error message appears
**When** a screen reader is active
**Then** the error is announced immediately via `aria-live="assertive"`

**Given** any status update occurs (sync complete, step advanced)
**When** a screen reader is active
**Then** the update is announced via `aria-live="polite"`

**Implementation Notes:**

- Add `aria-label` to all interactive elements
- Use `aria-labelledby` for complex components
- Implement `aria-live` regions for dynamic updates
- Use `role="radiogroup"` for rating scale with `role="radio"` for each option
- Add `aria-describedby` for additional context where needed
- Test with VoiceOver (macOS/iOS) and NVDA (Windows)

---

### Story 5.3: Focus Management

As a **user navigating via keyboard or screen reader**,
I want **focus to move appropriately when phases change**,
So that **I always know where I am and can continue interacting**.

**Acceptance Criteria:**

**Given** the user is in the lobby
**When** countdown starts
**Then** focus moves to the countdown container
**And** screen reader announces: "Countdown starting, 3, 2, 1"

**Given** the countdown completes
**When** the verse screen loads
**Then** focus moves to the verse heading (h2 or equivalent)
**And** screen reader announces the heading text

**Given** the user completes a step
**When** the next step loads
**Then** focus moves to the new verse heading
**And** previous step content is no longer focusable

**Given** the user taps "Continue to Reflection"
**When** the reflection form loads
**Then** focus moves to the reflection form heading
**And** screen reader announces: "Reflection for Verse [X]"

**Given** a modal opens (exit confirmation, error dialog)
**When** the modal is visible
**Then** focus moves to the modal's first focusable element or heading
**And** background content is marked `aria-hidden="true"`

**Given** a modal closes
**When** the user dismisses it
**Then** focus returns to the element that triggered the modal

**Given** an error occurs
**When** the error message appears
**Then** focus moves to the error message
**And** screen reader announces the error immediately

**Implementation Notes:**

- Create `useFocusManagement` hook for declarative focus control
- Define focus targets per UX spec:
  - Lobby → Countdown container
  - Countdown → Verse heading
  - Step N → Step N+1 verse heading
  - Reading → Reflection form heading
- Use `ref` and `focus()` for programmatic focus
- Set `aria-hidden="true"` on background when modal is open
- Store trigger element reference for focus restoration

---

### Story 5.4: Motion & Color Accessibility

As a **user sensitive to motion or who cannot distinguish colors**,
I want **animations that respect my preferences and indicators that don't rely on color alone**,
So that **I can use the feature comfortably and understand all states**.

**Acceptance Criteria:**

**Given** the user has `prefers-reduced-motion: reduce` enabled
**When** any animation would play (countdown, phase transition, crossfade)
**Then** the animation is replaced with instant state change
**And** no motion occurs

**Given** the user has `prefers-reduced-motion: no-preference`
**When** phase transitions occur
**Then** animations play normally (200-400ms crossfade)

**Given** the countdown is displayed
**When** `prefers-reduced-motion: reduce` is enabled
**Then** countdown shows static numbers (3, then 2, then 1) without animation

**Given** a state indicator shows "ready" status
**When** the indicator is displayed
**Then** it uses BOTH color AND icon/text:
- Green checkmark icon + "Ready" text (not green alone)

**Given** a state indicator shows "waiting" status
**When** the indicator is displayed
**Then** it uses BOTH color AND icon/text:
- Clock icon + "Waiting" text (not yellow alone)

**Given** the help flag is toggled on
**When** the indicator is displayed
**Then** it uses BOTH color AND icon:
- Heart/hand icon + visual highlight (not color alone)

**Given** an error state occurs
**When** the error is displayed
**Then** it uses BOTH color AND icon/text:
- Warning icon + error message (not red alone)

**Given** the rating scale is displayed
**When** a rating is selected
**Then** selection is indicated by:
- Fill/border change AND checkmark or different icon (not color alone)

**Implementation Notes:**

- Create `useMotionConfig` hook:
  ```typescript
  const { shouldAnimate, transitionDuration } = useMotionConfig();
  // shouldAnimate: false if prefers-reduced-motion: reduce
  // transitionDuration: 0 if reduced motion, else 200-400ms
  ```
- Apply hook to all Framer Motion animations
- Audit all color-based indicators and add icon/text alternatives
- Use semantic colors from Lavender Dreams theme with icon pairing
- Test with macOS/Windows reduced motion settings
