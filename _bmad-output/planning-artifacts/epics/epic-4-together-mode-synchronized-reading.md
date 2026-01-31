# Epic 4: Together Mode — Synchronized Reading

Couples can read scripture together in real-time with a lobby, Reader/Responder role selection, 3-second countdown, synchronized phase advancement via lock-in mechanism, partner position indicators, and graceful reconnection handling. Includes no-shame fallback to solo from lobby.

## Story 4.1: Lobby, Role Selection & Countdown

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

## Story 4.2: Synchronized Reading with Lock-In

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

## Story 4.3: Reconnection & Graceful Degradation

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
