---
stepsCompleted:
  - step-01-validate-prerequisites
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

{{requirements_coverage_map}}

## Epic List

{{epics_list}}
