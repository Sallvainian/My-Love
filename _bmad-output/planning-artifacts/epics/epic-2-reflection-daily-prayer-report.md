# Epic 2: Reflection & Daily Prayer Report

Users can reflect on each scripture step with a rating, per-verse bookmark flag, and optional note. At the end of a session, users can send a message to their partner and view the Daily Prayer Report showing their own reflections and their partner's message. Handles unlinked users gracefully and delivers the emotional payoff of the experience.

## Story 2.1: Per-Step Reflection System

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

## Story 2.2: End-of-Session Reflection Summary

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

## Story 2.3: Daily Prayer Report — Send & View

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
