# Requirements Inventory

## Functional Requirements

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

## NonFunctional Requirements

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

## Additional Requirements

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

## FR Coverage Map

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
