---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
workflowComplete: true
completedAt: '2026-01-29'
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

**Session Management (FR1-FR7):**

- FR1: User can view the Scripture Reading overview page with session stats
- FR1a: User can access Scripture Reading from bottom navigation (add 'scripture' to ViewType and BottomNavigation)
- FR2: User can start a new Scripture Reading session
- FR3: User can choose between Solo mode and Together mode when starting
- FR4: User with no linked partner can only access Solo mode (Together disabled with explanation)
- FR5: User can exit a session cleanly at any point
- FR6: User can resume an incomplete Solo session from where they left off
- FR7: System marks a session as complete only when step 17 reflections are submitted

**Solo Mode Flow (FR8-FR13):**

- FR8: User in Solo mode can progress through all 17 scripture steps at their own pace
- FR9: User in Solo mode sees the verse text and can mark "I've read this"
- FR10: User in Solo mode sees the response text and can continue to reflection
- FR11: User in Solo mode can submit a reflection (rating, help flag, optional note) for each step
- FR12: User in Solo mode can save progress and exit mid-session
- FR13: User in Solo mode can use the feature with optimistic UI (changes appear instant, sync in background; requires eventual connectivity)

**Together Mode Flow (FR14-FR29):**

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

**Reflection System (FR30-FR33):**

- FR30: User can rate their response on a 1-5 scale (Struggling -> Strong)
- FR31: User can toggle "I want my partner's help / I'm sensitive to this" flag
- FR32: User can add an optional note (max 200 characters)
- FR33: Reflection rating scale has clear accessible labels

**Daily Prayer Report (FR34-FR41):**

- FR34: User can send an optional message to partner at end of session (max 300 chars)
- FR35: User can skip sending a message
- FR36: User can view the Daily Prayer Report after session completion
- FR37: User can see their own step-by-step ratings and help flags in the report
- FR38: User can see partner's message (if sent) in the report
- FR39: User with no linked partner skips the send message step (reflections still saved)
- FR40: Partner receives Solo session's Daily Prayer Report asynchronously (if linked)
- FR41: In Together mode, report shows both users' step-by-step ratings/help flags side-by-side (default shared)

**Stats & Progress (FR42-FR46):**

- FR42: User can view total sessions completed (couple aggregate)
- FR43: User can view total steps completed (couple aggregate)
- FR44: User can view last session completion date
- FR45: User can view average reflection rating (couple aggregate)
- FR46: User can view help requests count (couple aggregate)

**Partner Integration (FR47-FR49):**

- FR47: System detects whether user has a linked partner
- FR48: User without linked partner sees "Link your partner to do this together" message
- FR49: User can navigate to partner linking from Scripture Reading (existing flow)

**Accessibility (FR50-FR54):**

- FR50: User can navigate all controls via keyboard (logical tab order)
- FR51: User using screen reader receives clear aria-labels for rating scale
- FR52: System moves focus appropriately on phase transitions
- FR53: System respects prefers-reduced-motion by disabling motion-heavy animations
- FR54: System uses icons/text alongside color for state indicators (not color-only)

### NonFunctional Requirements

**Performance:**

- NFR-P1: Real-time sync latency < 500ms typical (Together mode phase sync)
- NFR-P2: Phase transition perceived speed < 200ms (no blocking, use fade transitions)
- NFR-P3: Initial feature load time < 2s on 3G (skeleton loading states)
- NFR-P4: UI responsiveness under latency — show "Syncing..." indicator (no UI jitter or jarring state jumps)

**Security & Privacy:**

- NFR-S1: Reflection data access — user + linked partner only (RLS policies)
- NFR-S2: Session data access — participants only (no external visibility)
- NFR-S3: Daily Prayer Report visibility — sender + recipient only (private couple communication)
- NFR-S4: Data encryption at rest and in transit (Supabase default + HTTPS)
- NFR-S5: Prior solo data privacy — private by default after partner linking (only explicit messages shared; reflections remain private)

**Reliability:**

- NFR-R1: Session state recovery — 100% (reconnects resume correctly)
- NFR-R2: Data sync reliability — 99.9% (no lost reflections)
- NFR-R3: Race condition prevention — zero double-advances (server-authoritative state)
- NFR-R4: Cache integrity — 100% (IndexedDB cache persists; on corruption, clear and refetch)
- NFR-R5: Graceful degradation — feature remains usable (if partner offline, allow clean exit)
- NFR-R6: Reflection write idempotency — unique constraint per session_id + step_index + user_id

**Accessibility:**

- NFR-A1: WCAG compliance — AA minimum
- NFR-A2: Keyboard navigation — full feature access
- NFR-A3: Screen reader support — all interactive elements labeled
- NFR-A4: Motion sensitivity — respect prefers-reduced-motion
- NFR-A5: Color independence — no color-only indicators

**Integration:**

- NFR-I1: Supabase compatibility — full compatibility with existing patterns (Auth, RLS, Realtime Broadcast)
- NFR-I2: Existing app integration — seamless navigation (use existing ViewType pattern)
- NFR-I3: Caching pattern — consistent with existing services (IndexedDB for read caching)
- NFR-I4: State management pattern — Zustand slice composition (consistent with existing slices)

### Additional Requirements

**From Architecture:**

- Brownfield feature addition — no starter template needed; integrate with existing patterns
- Centralize IndexedDB versioning as tech debt fix (new dbSchema.ts — single source of truth for DB_VERSION)
- 5 new Supabase tables: scripture_sessions, scripture_step_states, scripture_reflections, scripture_bookmarks, scripture_messages
- Server-authoritative state with version-based concurrency control (expected_version validation, 409 on stale mutations)
- Hybrid sync architecture: server-authoritative transitions + client pending state
- Phase enum state machine: lobby -> countdown -> reading -> reflection -> report -> complete
- IndexedDB as read cache + optimistic UI pattern (reads: cache first -> fetch fresh -> update cache; writes: POST to server -> update cache)
- Feature-scoped component subfolders (session/, reading/, reflection/) with centralized motion config
- Session-based RLS access policies (consistent pattern across all scripture tables)
- Supabase RPCs with scripture_ prefix (scripture_lock_in, scripture_advance_phase, scripture_submit_reflection, scripture_create_session)
- Broadcast channel per session for real-time sync (scripture-session:{session_id})
- Ephemeral presence channel with heartbeat (~10s intervals, ~20s TTL)
- Error handling via ScriptureErrorCode enum + centralized handler
- Container/presentational component pattern (smart containers connect to slice, dumb components receive props)
- sw-db.ts must be kept in sync manually with dbSchema.ts (service worker constraint)

**From UX Design:**

- Lavender Dreams theme for Scripture Reading screens (distinct from app's default Sunset Romance)
- **BookmarkFlag replaces PRD's "help/sensitive flag"** — per stakeholder decision, bookmarks are personal reflection tools rather than vulnerability signals (impacts FR31, FR37, FR46)
- Free navigation within verse/response pairs (either partner can move between verse <-> response freely)
- Lock-in mechanism: both partners must confirm "Ready for next verse" to advance
- Partner position indicator showing where partner is viewing ("Jordan is viewing the response")
- No-shame/blame-free copy throughout ("Continue solo" not "Partner abandoned you"; "We'll continue when you're both ready" not "Waiting for Jordan...")
- Text-only progress indicator ("Verse X of 17" — no progress bar; ritual, not task)
- Three-tier button hierarchy: Primary (advances session), Secondary (navigation within step), Tertiary (optional actions)
- Partner presence feedback with three-state indicator (same page/different page/both ready/disconnected)
- Phase transition animations with prefers-reduced-motion fallbacks (all animations instant-swap when reduced motion enabled)
- Focus management rules for each phase transition (defined targets per transition type)
- ARIA announcement strategy: aria-live="polite" only, throttled, announce only on semantic state changes
- Touch targets minimum 48x48px with 8px spacing between targets
- Keyboard overlap handling for textareas during reflection/message entry
- Dancing Script font for partner messages in Daily Prayer Report
- Single-column layout at all breakpoints; max-w-md centered container on md+
- Reflection form: verse selection (bookmarked highlighted), session rating (1-5 "How meaningful"), optional note, message to partner
- Daily Prayer Report reveals: partner's message, standout verse, session rating side-by-side, shared bookmarks (opt-in)
- Role alternation: Reader on verse N becomes Responder on verse N+1
- "Start fresh" option when resume is available (explicit clear of saved state)

### FR Coverage Map

- FR1: Epic 1 — Overview page with session stats
- FR1a: Epic 1 — Bottom navigation integration (scripture ViewType)
- FR2: Epic 1 — Start new Scripture Reading session
- FR3: Epic 1 — Mode selection (Solo/Together)
- FR4: Epic 1 — Solo-only access when unlinked (Together disabled)
- FR5: Epic 1 — Clean session exit
- FR6: Epic 1 — Resume incomplete Solo session
- FR7: Epic 1 — Session completion only after step 17 reflections
- FR8: Epic 1 — Solo 17-step progression
- FR9: Epic 1 — Solo verse text display
- FR10: Epic 1 — Solo response text display
- FR11: Epic 2 — Reflection submission (rating, bookmark, note)
- FR12: Epic 1 — Solo save/exit mid-session
- FR13: Epic 1 — Optimistic UI with IndexedDB caching
- FR14: Epic 4 — Together mode role selection (Reader/Responder)
- FR15: Epic 4 — Together mode lobby
- FR16: Epic 4 — Partner join status in lobby
- FR17: Epic 4 — Ready state toggle in lobby
- FR18: Epic 4 — Lobby fallback to Solo (no-shame)
- FR19: Epic 4 — 3-second countdown when both ready
- FR20: Epic 4 — Reader verse text + "Done reading"
- FR21: Epic 4 — Responder waiting screen during Reader phase
- FR22: Epic 4 — Responder response text + "Done"
- FR23: Epic 4 — Reader waiting screen during Responder phase
- FR24: Epic 4 — Both see reflection screen after response
- FR25: Epic 4 — Advance only when both submit reflections
- FR26: Epic 1 — Progress indicator (Step X of 17)
- FR27: Epic 4 — "Partner reconnecting..." indicator
- FR28: Epic 4 — Pause advancement while partner offline
- FR29: Epic 4 — Clean session end if partner remains offline
- FR30: Epic 2 — 1-5 rating scale (Struggling -> Strong)
- FR31: Epic 2 — BookmarkFlag per verse (replaces help/sensitive flag per UX decision)
- FR32: Epic 2 — Optional note (max 200 chars)
- FR33: Epic 2 — Accessible rating labels
- FR34: Epic 2 — Send message to partner (max 300 chars)
- FR35: Epic 2 — Skip sending message
- FR36: Epic 2 — View Daily Prayer Report
- FR37: Epic 2 — Own step-by-step ratings and bookmarks in report
- FR38: Epic 2 — Partner's message in report
- FR39: Epic 2 — Unlinked user skips message (reflections saved)
- FR40: Epic 2 — Solo report sent asynchronously to partner
- FR41: Epic 2 — Together mode side-by-side report
- FR42: Epic 3 — Total sessions completed (couple aggregate)
- FR43: Epic 3 — Total steps completed (couple aggregate)
- FR44: Epic 3 — Last session completion date
- FR45: Epic 3 — Average reflection rating (couple aggregate)
- FR46: Epic 3 — Bookmark count (couple aggregate)
- FR47: Epic 1 — Partner detection
- FR48: Epic 1 — "Link your partner" message
- FR49: Epic 1 — Navigate to partner linking
- FR50: Epic 1 — Keyboard navigation (logical tab order)
- FR51: Epic 1 — Screen reader aria-labels for rating
- FR52: Epic 1 — Focus management on phase transitions
- FR53: Epic 1 — prefers-reduced-motion support
- FR54: Epic 1 — Icons/text alongside color (not color-only)

## Epic List

### Epic 1: Foundation & Solo Scripture Reading
Users can access Scripture Reading from bottom navigation, start a Solo session, read through all 17 scripture steps at their own pace, save and resume progress, and experience smooth optimistic UI. The feature is fully accessible with keyboard navigation, screen reader support, and reduced motion compliance.

**FRs covered:** FR1, FR1a, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR12, FR13, FR26, FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR54

---

## Epic 1: Foundation & Solo Scripture Reading

Users can access Scripture Reading from bottom navigation, start a Solo session, read through all 17 scripture steps at their own pace, save and resume progress, and experience smooth optimistic UI. The feature is fully accessible with keyboard navigation, screen reader support, and reduced motion compliance.

### Story 1.1: Database Schema & Backend Infrastructure

As a developer,
I want the Supabase tables, RLS policies, RPCs, centralized dbSchema.ts, and scripture reading service created,
So that all frontend features have a reliable backend foundation.

**Acceptance Criteria:**

**Given** the existing My-Love Supabase project
**When** the migration is applied
**Then** the following tables exist with correct schemas:
- `scripture_sessions` (id, mode, user1_id, user2_id, current_phase, current_step_index, status, version, snapshot_json, started_at, completed_at)
- `scripture_step_states` (id, session_id, step_index, user1_locked_at, user2_locked_at, advanced_at)
- `scripture_reflections` (id, session_id, step_index, user_id, rating, notes, is_shared, created_at)
- `scripture_bookmarks` (id, session_id, step_index, user_id, share_with_partner, created_at)
- `scripture_messages` (id, session_id, sender_id, message, created_at)
**And** RLS policies enforce session-based access (only session participants can read/write)
**And** RPCs exist: `scripture_create_session`, `scripture_submit_reflection`, `scripture_lock_in`, `scripture_advance_phase`
**And** unique constraint exists on scripture_reflections (session_id, step_index, user_id) for idempotent writes

**Given** the existing IndexedDB services with version conflicts
**When** `src/services/dbSchema.ts` is created
**Then** it centralizes DB_NAME, DB_VERSION (bumped to 5), and all store definitions
**And** existing services (moodService, customMessageService, photoStorageService) import from dbSchema.ts
**And** new IndexedDB stores are created: scriptureSessions, scriptureReflections, scriptureBookmarks, scriptureMessages
**And** scripture stores use cache-only pattern (no 'synced' index)

**Given** the centralized dbSchema
**When** `src/services/scriptureReadingService.ts` is created
**Then** it provides IndexedDB CRUD for scripture data (read-heavy, write-through to server)
**And** read pattern: check IndexedDB first, return cached, fetch fresh from server, update cache
**And** write pattern: POST to server, on success update IndexedDB, on failure show retry UI
**And** corruption recovery: on IndexedDB error, clear cache and refetch from server

**Given** the service and schema
**When** `src/store/slices/scriptureReadingSlice.ts` is created
**Then** it exports types: SessionPhase, SessionMode, ScriptureSession, ScriptureReadingState
**And** it provides actions for session lifecycle (create, load, exit)
**And** it follows the existing Zustand slice composition pattern
**And** it is composed into useAppStore

**Given** the scripture content
**When** the static scripture data is added
**Then** all 17 steps with verse text, response text, section themes, and verse references are available as static JSON

### Story 1.2: Navigation & Overview Page

As a user,
I want to access Scripture Reading from the bottom navigation and see an overview page with mode selection,
So that I can easily find and start the feature.

**Acceptance Criteria:**

**Given** the user is logged in and on any page
**When** they tap the "Scripture" tab in bottom navigation
**Then** the Scripture Reading overview page loads
**And** 'scripture' is added to ViewType in navigationSlice
**And** the Scripture tab appears in BottomNavigation with an appropriate icon

**Given** the user is on the Scripture Reading overview page
**When** the page renders
**Then** the page displays using Lavender Dreams theme (purple gradients, glass morphism cards)
**And** the page shows a "Start" button to begin a new session
**And** the layout follows single-column mobile-first design with max-w-md centered on md+

**Given** the user taps "Start"
**When** mode selection appears
**Then** "Solo" and "Together" mode options are displayed

**Given** the user has a linked partner (partner_id is not null)
**When** mode selection is shown
**Then** both Solo and Together modes are enabled and selectable

**Given** the user has no linked partner (partner_id is null)
**When** mode selection is shown
**Then** Together mode is grayed out with message "Link your partner to do this together"
**And** a "Set up partner" link navigates to the existing partner linking flow
**And** Solo mode is fully functional

**Given** the user has an incomplete Solo session
**When** the overview page loads
**Then** a resume prompt shows "Continue where you left off? (Step X of 17)"
**And** a "Start fresh" option is available to explicitly clear saved state

### Story 1.3: Solo Reading Flow

As a user,
I want to read through all 17 scripture steps at my own pace with verse and response screens,
So that I can engage with scripture in a calm, self-paced experience.

**Acceptance Criteria:**

**Given** the user selects Solo mode and starts a session
**When** the session begins
**Then** a new scripture_session is created with mode='solo', status='in_progress', current_step_index=0
**And** the first verse screen loads

**Given** the user is on a verse screen
**When** the screen renders
**Then** the verse reference is displayed (Inter 500, 12px, muted purple)
**And** the verse text is displayed prominently (Playfair Display 400, 20px)
**And** a "View Response" secondary button is available for navigation
**And** a "Next Verse" primary button is available (full-width, 56px, bottom-anchored)
**And** the progress indicator shows "Verse X of 17" as text (no progress bar)

**Given** the user taps "View Response"
**When** the response screen loads
**Then** the response prayer text is displayed (Inter 400, 16px)
**And** a "Back to Verse" secondary button is available
**And** the "Next Verse" primary button remains available
**And** transition uses crossfade animation (200ms, instant if reduced-motion)

**Given** the user taps "Next Verse" (on either verse or response screen)
**When** advancing to the next step
**Then** current_step_index increments
**And** the next verse screen loads with slide-left + fade transition (300ms)
**And** the progress indicator updates

**Given** the user reaches step 17 (index 16) and taps "Next Verse"
**When** advancing past the last step
**Then** the session phase transitions to 'reflection'
**And** the reading phase is complete (reflection handled in Epic 2; for now show placeholder/completion screen)

**Given** the user is on any reading screen
**When** they tap the exit button
**Then** a confirmation prompt appears: "Save your progress? You can continue later."
**And** "Save & Exit" saves current_step_index to server and caches locally
**And** session status remains 'in_progress'

### Story 1.4: Save, Resume & Optimistic UI

As a user,
I want my solo session progress saved automatically and resumable, with changes appearing instantly,
So that I never lose progress and the experience feels smooth.

**Acceptance Criteria:**

**Given** the user is in a Solo session
**When** they exit mid-session (via Save & Exit or closing the app)
**Then** the current step index and session state are persisted to the server
**And** the session data is cached in IndexedDB for fast retrieval
**And** the session status remains 'in_progress'

**Given** the user returns to the Scripture Reading overview
**When** an incomplete Solo session exists
**Then** the overview shows "Continue where you left off? (Step X of 17)"
**And** tapping "Continue" loads the session from cache immediately, then fetches fresh from server
**And** tapping "Start fresh" clears the saved state and begins a new session

**Given** the user is in a Solo session with network connectivity
**When** they advance through steps
**Then** step advancement appears instant (optimistic UI)
**And** the server is updated in the background
**And** IndexedDB cache is updated on successful server response

**Given** the user is viewing a previously cached session
**When** they are offline
**Then** cached data is displayed with an "Offline" indicator
**And** step advancement is blocked until connectivity returns
**And** no data is lost

**Given** an IndexedDB corruption occurs
**When** a read or write operation fails
**Then** the cache is cleared automatically
**And** data is refetched from the server
**And** the user sees no error (graceful recovery)

**Given** a server write fails (network error)
**When** the user advanced a step optimistically
**Then** retry UI is shown (subtle, non-blocking)
**And** the local state is not rolled back until retry is exhausted

### Story 1.5: Accessibility Foundations

As a user with accessibility needs,
I want full keyboard navigation, screen reader support, reduced motion compliance, and color-independent indicators,
So that I can use Scripture Reading regardless of my abilities.

**Acceptance Criteria:**

**Given** the user navigates with keyboard only
**When** they tab through Scripture Reading screens
**Then** all interactive elements are reachable in logical tab order
**And** focus is visible on all controls (ring-2 ring-purple-400 or existing focus style)
**And** buttons activate with Enter or Space
**And** no keyboard traps exist

**Given** the user has a screen reader active
**When** they interact with Scripture Reading
**Then** all buttons have descriptive aria-labels
**And** the progress indicator has aria-label "Currently on verse X of 17"
**And** phase transitions are announced via aria-live="polite" region ("Now on verse 5", "Now in reflection")
**And** announcements fire only on semantic state changes (not on re-renders)

**Given** the user transitions between phases (verse to response, step to step)
**When** the transition completes
**Then** focus moves to the logical target:
- Verse screen: verse heading
- Response screen: navigation button that was used
- New step: verse heading
- Reflection: reflection form heading

**Given** the user has prefers-reduced-motion enabled
**When** animations would normally play
**Then** all crossfade transitions are replaced with instant swaps (duration: 0)
**And** the useMotionConfig hook is created in src/hooks/useMotionConfig.ts
**And** all Scripture Reading components use this hook for animation configuration

**Given** any state indicator in Scripture Reading
**When** it communicates information via color
**Then** an icon or text label accompanies the color
**And** WCAG AA contrast ratios are met (4.5:1 normal text, 3:1 large text)
**And** all touch targets are minimum 48x48px with 8px spacing between targets

---

## Epic 2: Reflection & Daily Prayer Report

Users can reflect on each scripture step with a rating, per-verse bookmark flag, and optional note. At the end of a session, users can send a message to their partner and view the Daily Prayer Report showing their own reflections and their partner's message. Handles unlinked users gracefully and delivers the emotional payoff of the experience.

### Story 2.1: Per-Step Reflection System

As a user,
I want to bookmark verses during reading and submit a reflection (rating, optional note) after each step,
So that I can mark what matters to me and capture my response in the moment.

**Acceptance Criteria:**

**Given** the user is on a verse screen (Solo or Together mode)
**When** they tap the bookmark icon
**Then** the BookmarkFlag toggles instantly (filled amber when active, outlined when inactive)
**And** the bookmark is persisted to scripture_bookmarks table (write-through to server, cache in IndexedDB)
**And** no confirmation dialog appears (instant toggle)
**And** the bookmark icon has aria-label "Bookmark this verse" / "Remove bookmark"
**And** the hit area is minimum 48x48px

**Given** the user completes a step (taps "Next Verse" or both lock in during Together mode)
**When** the reflection screen appears
**Then** a 1-5 rating scale is displayed with numbered circles
**And** end labels show "A little" (1) and "A lot" (5)
**And** the prompt reads "How meaningful was this for you today?"
**And** the rating uses radiogroup with aria-labels: "Rating 1 of 5: A little" through "Rating 5 of 5: A lot"
**And** an optional note textarea is available (max 200 characters, auto-grow to ~4 lines, resize-none)
**And** character counter appears at 200+ characters (muted style)

**Given** the user submits a reflection
**When** they tap "Continue"
**Then** the reflection is saved to scripture_reflections (session_id, step_index, user_id, rating, notes, is_shared)
**And** the write is idempotent (unique constraint on session_id + step_index + user_id)
**And** the IndexedDB cache is updated on success
**And** the session advances to the next step (or to end-of-session if step 17)

**Given** the user has not selected a rating
**When** they tap "Continue"
**Then** quiet helper text appears below the rating: "Please select a rating"
**And** the Continue button remains disabled until a rating is selected
**And** no red flashes or aggressive validation

### Story 2.2: End-of-Session Reflection Summary

As a user,
I want to review my bookmarked verses and provide an overall session reflection after completing all 17 steps,
So that I can process the experience as a whole before seeing the prayer report.

**Acceptance Criteria:**

**Given** the user has completed step 17's reflection
**When** the session transitions to the reflection summary phase
**Then** the screen displays a list of verses the user bookmarked during the session
**And** bookmarked verses are highlighted; non-bookmarked verses are not shown
**And** if no bookmarks exist, text reads "You didn't mark any verses — that's okay"
**And** the transition uses fade-through-white animation (400ms, instant if reduced-motion)
**And** focus moves to the reflection form heading

**Given** the reflection summary is displayed
**When** the user interacts with the form
**Then** they can select which verse "stood out" from the bookmarked list (uses MoodButton-style chip pattern with aria-pressed)
**And** verse selection chips are minimum 48x48px touch targets
**And** a session-level rating (1-5) is available with the same scale pattern as per-step reflections
**And** an optional note textarea (max 200 chars) is available

**Given** the user has completed the reflection summary
**When** they tap "Continue"
**Then** a verse selection and session rating are required (quiet validation, button disabled until complete)
**And** the reflection summary data is saved to the server
**And** the session phase advances to 'report'

### Story 2.3: Daily Prayer Report — Send & View

As a user,
I want to send a message to my partner and view the Daily Prayer Report showing our reflections,
So that we can connect emotionally through shared vulnerability and encouragement.

**Acceptance Criteria:**

**Given** the user has completed the reflection summary
**When** the report phase begins
**Then** a message composition screen appears: "Write something for [Partner Name]"
**And** a textarea is available (max 300 characters, auto-grow, character counter at limit)
**And** a "Skip" option is clearly available (tertiary button, no guilt language)
**And** the keyboard overlap is handled (sticky CTA above keyboard or collapse until blur)

**Given** the user has no linked partner (partner_id is null)
**When** the report phase begins
**Then** the message composition step is skipped entirely
**And** the session is marked complete
**And** all reflections are still saved
**And** a simple completion screen shows "Session complete"

**Given** the user sends a message or skips
**When** the Daily Prayer Report screen loads
**Then** the session is marked as complete (status='complete', completed_at set)
**And** the report shows the user's own step-by-step ratings and bookmarked verses
**And** if the partner sent a message, it is revealed (Dancing Script font, 18px, card styling — like receiving a gift)
**And** if the partner has not yet completed, their section shows "Waiting for [Partner Name]'s reflections"

**Given** a Solo session is completed by a linked user
**When** the partner opens Scripture Reading later
**Then** the partner can view the Daily Prayer Report asynchronously
**And** the report shows the sender's message and their own data when they complete

**Given** a Together mode session is completed
**When** both partners have submitted reflections and messages
**Then** the report shows both users' step-by-step ratings and bookmarks side-by-side
**And** both partners' standout verse selections are shown
**And** both messages are revealed
**And** bookmark sharing respects the opt-in toggle from the reflection summary

---

## Epic 3: Stats & Overview Dashboard

Users can view their Scripture Reading journey statistics on the overview page — total sessions completed, total steps completed, average reflection rating, bookmark count, and last session date — all as couple-aggregate metrics.

### Story 3.1: Couple-Aggregate Stats Dashboard

As a user,
I want to see my Scripture Reading journey stats on the overview page,
So that I can see our progress without gamification pressure.

**Acceptance Criteria:**

**Given** the user navigates to the Scripture Reading overview page
**When** the stats section renders
**Then** the following couple-aggregate metrics are displayed:
- Total sessions completed (count of sessions with status='complete' for the couple)
- Total steps completed (sum of completed steps across all sessions)
- Last session completion date (most recent completed_at)
- Average reflection rating (mean of all ratings across both partners)
- Bookmark count (total bookmarks across both partners)

**Given** the user has no completed sessions
**When** the stats section renders
**Then** stats show zeros or dashes gracefully (no error states)
**And** a gentle message encourages starting: "Begin your first reading"

**Given** the stats are being loaded
**When** the page first renders
**Then** skeleton loading states are shown for each stat card
**And** stats load within NFR-P3 target (<2s on 3G)
**And** cached stats from IndexedDB are shown immediately, then updated from server

**Given** the user's partner has also completed sessions
**When** stats aggregate
**Then** the metrics reflect both partners' data (couple-level, not individual)
**And** the queries use session-based access (RLS enforced)

**Given** the stats are displayed
**When** the user views the overview
**Then** stats use the Lavender Dreams glass morphism card styling
**And** the layout is single-column on mobile, max-w-md centered on md+
**And** no gamification language is used (no streaks, no "keep it up!" pressure)

---

## Epic 4: Together Mode — Synchronized Reading

Couples can read scripture together in real-time with a lobby, Reader/Responder role selection, 3-second countdown, synchronized phase advancement via lock-in mechanism, partner position indicators, and graceful reconnection handling. Includes no-shame fallback to solo from lobby.

### Story 4.1: Lobby, Role Selection & Countdown

As a user,
I want to select my role, enter a lobby, ready up with my partner, and experience a synchronized countdown,
So that we begin reading together with shared anticipation.

**Acceptance Criteria:**

**Given** the user selects Together mode
**When** the mode selection completes
**Then** a role selection screen appears with "Reader" and "Responder" options
**And** role descriptions are clear: "You read the verse" / "You read the response"
**And** the selected role is stored on the scripture_session (user1_id with role)

**Given** the user has selected a role
**When** they enter the lobby
**Then** the lobby screen shows "Waiting for [Partner Name]..." with a gentle animation
**And** a "Continue solo" option is available (no-shame language, tertiary button)
**And** a Supabase Broadcast channel is joined: scripture-session:{session_id}

**Given** both partners are in the lobby
**When** each partner can see the other's join status
**Then** partner presence is shown ("Jordan has joined")
**And** each user sees a "Ready" toggle button
**And** ready state changes are broadcast in real-time

**Given** a user toggles Ready
**When** their ready state changes
**Then** the broadcast sends the ready state to the partner
**And** the button updates: "Ready" (primary) or "Not Ready" (secondary)
**And** the partner sees the updated state immediately
**And** ready state is announced via aria-live="polite": "[Partner Name] is ready"

**Given** both users are Ready
**When** the server detects both ready states
**Then** a 3-second countdown begins (server-authoritative timestamp for sync)
**And** the countdown shows 3...2...1 with scale/fade animation
**And** reduced-motion users see static number display (no animation)
**And** screen reader announces: "Session starting in 3 seconds" at start, "Session started" at end
**And** countdown container receives focus
**And** after countdown, the first verse loads for both partners simultaneously

**Given** the user is in the lobby and partner has not joined
**When** they tap "Continue solo"
**Then** the session converts to solo mode smoothly (no shame messaging)
**And** the session mode updates to 'solo' on the server
**And** the broadcast channel is cleaned up

### Story 4.2: Synchronized Reading with Lock-In

As a couple,
I want to read verses with clear roles, navigate freely within each step, and advance together via mutual lock-in,
So that we progress through scripture as a team without one partner rushing ahead.

**Acceptance Criteria:**

**Given** the Together session has started after countdown
**When** a verse screen loads
**Then** the Reader sees a RoleIndicator pill badge: "You read this" (#A855F7)
**And** the Responder sees: "Partner reads this" (#C084FC)
**And** both see the verse text (Playfair Display) and the BookmarkFlag
**And** both can freely navigate between verse and response screens
**And** roles alternate each step: Reader on verse N becomes Responder on verse N+1

**Given** both partners are viewing a step
**When** either partner navigates between verse and response
**Then** a PartnerPosition indicator shows where the partner is: "[Name] is viewing the [verse/response]"
**And** position updates are sent via ephemeral presence channel (scripture-presence:{session_id})
**And** presence is throttled: on view change + heartbeat every ~10s
**And** stale presence drops after ~20s TTL

**Given** a partner is ready to advance
**When** they tap "Ready for next verse" (LockInButton)
**Then** an optimistic pending_lock_in state is set locally
**And** the RPC scripture_lock_in(session_id, step_index, user_id, expected_version) is called
**And** the button transforms to "Ready" with check + "Tap to undo" (secondary style)
**And** below the button: "We'll continue when you're both ready"

**Given** one partner has locked in
**When** the other partner has not
**Then** the locked-in partner sees the waiting state
**And** they can tap to undo their lock-in
**And** the waiting partner sees no pressure language

**Given** both partners lock in
**When** the server confirms both locks via RPC
**Then** the server bumps the session version, advances current_step_index
**And** a broadcast is sent: { session_id, version, snapshot_json, triggered_by: 'lock_in' }
**And** both clients receive the broadcast and advance to the next step
**And** clients ignore broadcasts where version <= local version (anti-race)
**And** transition: slide-left + fade (300ms, instant if reduced-motion)

**Given** the server rejects a lock-in with 409 (version mismatch)
**When** the client receives the rejection
**Then** the pending_lock_in state is rolled back
**And** the client refetches session state from server
**And** a subtle toast shows "Session updated" (no alarming error)

**Given** both partners complete step 17's lock-in
**When** advancing past the last step
**Then** the session phase transitions to 'reflection'
**And** both partners enter the reflection flow (Epic 2)

### Story 4.3: Reconnection & Graceful Degradation

As a user in Together mode,
I want graceful handling when my partner's connection drops,
So that our session isn't lost and we can resume or exit cleanly.

**Acceptance Criteria:**

**Given** both partners are in an active Together session
**When** one partner goes offline (presence heartbeat stops for >20s)
**Then** the connected partner sees "Partner reconnecting..." indicator
**And** the indicator uses the three-state presence system (disconnected = indicator off)
**And** phase advancement is paused (lock-in button shows "Holding your place" with "Reconnecting..." helper)
**And** the state is announced via aria-live="polite"

**Given** the partner is offline for >30 seconds
**When** the timeout is reached
**Then** an "End Session" option appears alongside "Keep Waiting"
**And** language remains neutral: "Your partner seems to have stepped away"
**And** no blame or alarm language is used

**Given** the user chooses "Keep Waiting"
**When** they continue waiting
**Then** the reconnecting indicator remains
**And** the session continues to wait for partner presence

**Given** the user chooses "End Session"
**When** they confirm
**Then** the session ends cleanly for both partners
**And** both partners' progress (reflections, bookmarks) up to the current step is saved
**And** the session status is updated to reflect early termination
**And** the broadcast channel is cleaned up

**Given** the offline partner's connection is restored
**When** they rejoin within the timeout
**Then** the app shows "Reconnecting..." briefly
**And** the client resyncs with server-authoritative state (fetches latest session snapshot)
**And** both partners resume from the current phase/step
**And** no data is lost
**And** the experience is seamless — neither partner sees a reset or jarring state jump

**Given** the server-authoritative state has advanced while a partner was offline
**When** the reconnecting partner's client receives the current state
**Then** the client updates to match the canonical state (version check)
**And** any stale local state is overwritten
**And** the partner resumes at the correct step and phase
