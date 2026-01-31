# Epic 1: Foundation & Solo Scripture Reading

Users can access Scripture Reading from bottom navigation, start a Solo session, read through all 17 scripture steps at their own pace, save and resume progress, and experience smooth optimistic UI. The feature is fully accessible with keyboard navigation, screen reader support, and reduced motion compliance.

## Story 1.1: Database Schema & Backend Infrastructure

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

## Story 1.2: Navigation & Overview Page

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

## Story 1.3: Solo Reading Flow

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

## Story 1.4: Save, Resume & Optimistic UI

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

## Story 1.5: Accessibility Foundations

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
