# Functional Requirements

*This is the capability contract. Every feature must trace back to these requirements.*

## Session Management

- **FR1:** User can view the Scripture Reading overview page with session stats
- **FR1a:** User can access Scripture Reading from bottom navigation (add 'scripture' to ViewType and BottomNavigation)
- **FR2:** User can start a new Scripture Reading session
- **FR3:** User can choose between Solo mode and Together mode when starting
- **FR4:** User with no linked partner can only access Solo mode (Together disabled with explanation)
- **FR5:** User can exit a session cleanly at any point
- **FR6:** User can resume an incomplete Solo session from where they left off
- **FR7:** System marks a session as complete only when step 17 reflections are submitted

---

## Solo Mode Flow

- **FR8:** User in Solo mode can progress through all 17 scripture steps at their own pace
- **FR9:** User in Solo mode sees the verse text and can mark "I've read this"
- **FR10:** User in Solo mode sees the response text and can continue to reflection
- **FR11:** User in Solo mode can submit a reflection (rating, help flag, optional note) for each step
- **FR12:** User in Solo mode can save progress and exit mid-session
- **FR13:** User in Solo mode can use the feature with optimistic UI (changes appear instant, sync in background; requires eventual connectivity)

---

## Together Mode Flow

- **FR14:** User initiating Together mode can select their role (Reader or Responder)
- **FR15:** User in Together mode enters a lobby while waiting for partner
- **FR16:** User in lobby can see partner's join status
- **FR17:** User in lobby can toggle their ready state (Ready / Not Ready)
- **FR18:** User in lobby (pre-countdown) can fall back to Solo mode without shame messaging
  - *Note: Fallback is from lobby only. Once Together session starts, MVP behavior is "End session" (no convert-to-solo mid-session).*
- **FR19:** System starts a 3-second countdown when both users are ready
  - *Note: Countdown start is server-authoritative (timestamp stored) so both clients stay in sync.*
- **FR20:** Reader sees verse text and can mark "Done reading" to advance the phase
- **FR21:** Responder sees waiting screen while Reader is reading
- **FR22:** Responder sees response text and can mark "Done" to advance the phase
- **FR23:** Reader sees waiting screen while Responder is responding
- **FR24:** Both users see reflection screen after response phase
- **FR25:** System advances to next step only when both users submit reflections
- **FR26:** User can see progress indicator (Step X of 17)
- **FR27:** System shows "Partner reconnecting..." indicator if partner goes offline
- **FR28:** System pauses phase advancement while partner is offline
- **FR29:** User can end session cleanly (with confirmation) if partner remains offline
  - *Note: FR27-29 together ensure graceful offline handling without incorrect phase advancement.*

---

## Reflection System

- **FR30:** User can rate their response on a 1-5 scale (Struggling → Strong)
- **FR31:** User can toggle "I want my partner's help / I'm sensitive to this" flag
- **FR32:** User can add an optional note (max 200 characters)
- **FR33:** Reflection rating scale has clear accessible labels

---

## Daily Prayer Report

- **FR34:** User can send an optional message to partner at end of session (max 300 chars)
- **FR35:** User can skip sending a message
- **FR36:** User can view the Daily Prayer Report after session completion
- **FR37:** User can see their own step-by-step ratings and help flags in the report
- **FR38:** User can see partner's message (if sent) in the report
- **FR39:** User with no linked partner skips the send message step (reflections still saved)
- **FR40:** Partner receives Solo session's Daily Prayer Report asynchronously (if linked)
- **FR41:** In Together mode, report shows both users' step-by-step ratings/help flags side-by-side (default shared)

---

## Stats & Progress

- **FR42:** User can view total sessions completed (couple aggregate)
- **FR43:** User can view total steps completed (couple aggregate)
- **FR44:** User can view last session completion date
- **FR45:** User can view average reflection rating (couple aggregate)
- **FR46:** User can view help requests count (couple aggregate)

---

## Partner Integration

- **FR47:** System detects whether user has a linked partner
- **FR48:** User without linked partner sees "Link your partner to do this together" message
- **FR49:** User can navigate to partner linking from Scripture Reading (existing flow)

---

## Accessibility

- **FR50:** User can navigate all controls via keyboard (logical tab order)
- **FR51:** User using screen reader receives clear aria-labels for rating scale
- **FR52:** System moves focus appropriately on phase transitions
- **FR53:** System respects `prefers-reduced-motion` by disabling motion-heavy animations
  - *Note: Countdown can remain but without motion effects.*
- **FR54:** System uses icons/text alongside color for state indicators (not color-only)

---
