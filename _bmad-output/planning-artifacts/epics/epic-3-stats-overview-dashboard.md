# Epic 3: Stats & Overview Dashboard

Users can view their Scripture Reading journey statistics on the overview page — total sessions completed, total steps completed, average reflection rating, bookmark count, and last session date — all as couple-aggregate metrics.

## Story 3.1: Couple-Aggregate Stats Dashboard

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
