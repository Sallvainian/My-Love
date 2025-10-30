# My-Love - Epic Breakdown

**Author:** Frank
**Date:** 2025-10-30
**Project Level:** 2
**Target Scale:** Medium feature set (16-24 stories across 4 epics)

---

## Overview

This document provides the detailed epic breakdown for My-Love, expanding on the high-level epic list in the [PRD](./PRD.md).

Each epic includes:

- Expanded goal and value proposition
- Complete story breakdown with user stories
- Acceptance criteria for each story
- Story sequencing and dependencies

**Epic Sequencing Principles:**

- Epic 1 establishes foundational infrastructure and fixes critical issues
- Subsequent epics build progressively, each delivering significant end-to-end value
- Stories within epics are vertically sliced and sequentially ordered
- No forward dependencies - each story builds only on previous work

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
I want to pre-configure relationship data at build time,
So that my girlfriend never sees the onboarding wizard.

**Acceptance Criteria:**
1. Create environment variables or config file for: partner name, relationship start date
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
1. Vite build process includes environment variable injection for relationship data
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

## Epic 2: Enhanced Message Experience

### Goal

Expand the message library to 365 unique messages, implement intuitive swipe navigation for browsing message history, and create an admin interface for custom message management.

### Value Delivery

Your girlfriend gets a full year of unique daily messages without repetition, can revisit favorite past messages with smooth swipe gestures, and you can curate and personalize the message library to make it even more meaningful.

### Stories

**Story 2.1: Expand Message Library to 365 Messages**

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

**Story 2.2: Implement Horizontal Swipe Navigation - Backward Only**

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

**Prerequisites:** Story 2.1 (need full message library to navigate)

---

**Story 2.3: Message History State Management**

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

**Prerequisites:** Story 2.2

---

**Story 2.4: Admin Interface - Custom Message Management (Phase 1: UI)**

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

**Prerequisites:** Story 2.3

---

**Story 2.5: Admin Interface - Message Persistence & Integration**

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

**Prerequisites:** Story 2.4

---

**Story 2.6: AI Message Suggestion Review Interface (Optional Enhancement)**

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

**Prerequisites:** Story 2.5

---

**Epic 2 Summary:**
- **Total Stories:** 6 (one optional)
- **Estimated Effort:** Medium-High
- **Deliverable:** 365-message library, swipe navigation, custom message management

---

## Epic 3: Photo Gallery & Memories

### Goal

Create a beautiful photo gallery where your girlfriend can upload, caption, and browse photos with smooth carousel animations, preserving special moments in a private, emotionally rich interface.

### Value Delivery

Photos become a core part of the daily experience, allowing her to relive memories and add new ones easily, all stored privately on her device.

### Stories

**Story 3.1: Photo Upload & Storage**

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

**Story 3.2: Photo Gallery Grid View**

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
7. Tap photo to open carousel/lightbox view (Story 3.3)

**Prerequisites:** Story 3.1

---

**Story 3.3: Photo Carousel with Animated Transitions**

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

**Prerequisites:** Story 3.2

---

**Story 3.4: Photo Edit & Delete Functionality**

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

**Prerequisites:** Story 3.3

---

**Story 3.5: Photo Gallery Navigation Integration**

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

**Prerequisites:** Story 3.4

---

**Epic 3 Summary:**
- **Total Stories:** 5
- **Estimated Effort:** Medium
- **Deliverable:** Full-featured photo gallery with carousel and management

---

## Epic 4: Interactive Connection Features

### Goal

Build interactive features that enable real-time emotional connection: mood tracking synced via NocoDB backend, poke/kiss interactions, and anniversary countdown timers.

### Value Delivery

She can log daily moods that you can see, you can send spontaneous "kisses" or "pokes" to brighten her day, and countdown timers build anticipation for special dates.

### Stories

**Story 4.1: NocoDB Backend Setup & API Integration**

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

**Story 4.2: Mood Tracking UI & Local Storage**

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

**Prerequisites:** Story 4.1

---

**Story 4.3: Mood History Calendar View**

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

**Prerequisites:** Story 4.2

---

**Story 4.4: Mood Sync & Partner Visibility**

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

**Prerequisites:** Story 4.3

---

**Story 4.5: Poke & Kiss Interactions**

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

**Prerequisites:** Story 4.4

---

**Story 4.6: Anniversary Countdown Timers**

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

**Prerequisites:** Story 4.2 (mood tracking sets pattern for settings/features)

---

**Epic 4 Summary:**
- **Total Stories:** 6
- **Estimated Effort:** Medium-High (backend integration adds complexity)
- **Deliverable:** Mood tracking, poke/kiss interactions, anniversary countdowns

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
