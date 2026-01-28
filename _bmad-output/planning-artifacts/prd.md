---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
inputDocuments:
  - docs/project-context.md
  - docs/index.md
  - docs/architecture-overview.md
  - docs/technology-stack.md
  - docs/data-models.md
  - docs/service-layer.md
  - docs/api-reference.md
  - docs/state-management.md
  - docs/component-inventory.md
  - _bmad-output/project-knowledge/index.md
documentCounts:
  briefs: 0
  research: 0
  projectDocs: 9
  projectContext: 1
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: medium-high
  projectContext: brownfield
featureContext:
  name: "Scripture Reading for Couples — A Responsive Reading (NKJV)"
  totalSteps: 17
  sections:
    - "Healing & Restoration"
    - "Forgiveness & Reconciliation"
    - "Confession & Repentance"
    - "God's Faithfulness & Peace"
    - "The Power of Words"
    - "Christlike Character"
  modes:
    - solo
    - together
  keyCapabilities:
    - "Overview stats dashboard"
    - "Solo guided reading flow"
    - "Together real-time synchronized flow"
    - "Lobby with ready states and countdown"
    - "Reflection tracking (rating, help flag, notes)"
    - "Daily Prayer Report"
  technicalScope:
    - "5 new Supabase tables"
    - "Supabase Broadcast real-time sync"
    - "State machine for together mode"
    - "New Zustand slice"
    - "IndexedDB offline-first service"
---

# Product Requirements Document - My-Love

**Author:** Salvain
**Date:** 2026-01-25

---

## Executive Summary

**Scripture Reading for Couples — A Responsive Reading (NKJV)** is a guided spiritual activity where couples read scripture together (synchronized real-time) or solo, with reflection tracking, help flags, and a "daily prayer report" summary. The activity consists of 17 scripture steps paired with couple-focused response prayers across themes of healing, forgiveness, confession, peace, words, and character.

**Why it exists:** A calm, "safe-to-be-honest" ritual for connection and repair. Helps couples soften toward each other, communicate better (especially after conflict), and build trust through repeated, gentle practice.

**MVP scope:** Solo mode (offline-capable, resumable) + Together mode (lobby, Reader/Responder roles, synchronized phases, 3-second countdown). Reflection per step (1-5 rating, help flag, optional note). Daily Prayer Report (partner messages, shared reflections).

**Key non-goals:** No streaks (avoid pressure). No push notifications (keep calm). No shame UX ("Continue solo" not "Partner abandoned you"). Not therapy — just structured spiritual connection.

---

## Success Criteria

This section defines how we measure success across user experience, business outcomes, and technical performance.

### North Star

Create a calm, "safe-to-be-honest" couples ritual that turns Scripture into a shared moment of connection + repair. The feature succeeds when it helps couples soften toward each other, communicate better (especially after conflict), and build trust through repeated, gentle practice.

---

### User Success

**Emotional Safety & Connection**
- Couples feel closer after a session (even if nothing is "solved")
- Partners can be vulnerable without it escalating into conflict
- The experience feels special, peaceful, and supportive — not clinical or gamified

**Practical Relationship Impact**
- Helps reset tone (less yelling, sarcasm, silent treatment)
- Provides a structured way to "repair" after conflict
- Makes it easier to ask for help or say "I'm sensitive here" without shame

**Spiritual Impact**
- Couples consistently pray/read together (or solo when needed) and feel grounded
- Reflections show growth over time (ratings improve), but the system never pressures

---

### Business Success

**Engagement Targets**

| Metric | Target | Notes |
|--------|--------|-------|
| Meaningful completion rate | ≥85% complete 10+ steps | Primary metric — prevents "homework" feeling |
| Full completion rate | ≥60-70% complete all 17 | Secondary metric |
| Together mode adoption | 25-40% of sessions | Trust signal, not a failure if lower |
| Together used at least once | Per couple in 30 days | Indicates willingness to connect |
| 7-day return rate | ≥50% | Habit forming |
| 30-day retention | ≥30% | Sustained value |

**Connection Signals**

| Metric | Target | Interpretation |
|--------|--------|----------------|
| "Help/sensitive" flag usage | 15-40% of sessions | Shows safety to be vulnerable (not a failure metric) |
| Prayer report messages sent | ≥30% of sessions | Soft bridge being used |
| Both reflections submitted (Together) | ≥90% | Sync working, both engaged |

**Quality (Post-MVP)**
- End-of-session prompt: "Did this help you feel closer?" (Yes/Somewhat/No)
- Stored privately per user, used for aggregate health signals only
- *Deferred to Post-MVP to keep MVP minimal; per-step reflections sufficient initially*

---

### Technical Success

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Real-time sync latency | <500ms | Together mode feels instant |
| Session state recovery | 100% | Reconnects resume correctly |
| Offline resilience | Cached data viewable; writes require connectivity | Graceful degradation with optimistic UI |
| Race condition prevention | Zero double-advances | Server-authoritative state |
| Data sync reliability | 99.9% | No lost reflections |

---

### Measurable Outcomes

**At 1 Month:**
- Feature adopted by active couples
- Session completion rates meet targets
- Together mode used at least once by majority

**At 3 Months:**
- Sustained weekly usage (2-4x/week pattern)
- "Help" flag usage normalizes (indicates established safety)
- Prayer report messages showing meaningful content

**At 6 Months:**
- Couples report improved communication (qualitative feedback)
- Reflection ratings show gradual positive trend
- Feature becomes part of regular relationship maintenance

---

## Product Scope

This section defines what's in scope for MVP, what's deferred to future phases, and what's explicitly out of scope.

### MVP — Minimum Viable Product

**Must Have:**
- Overview page with stats dashboard
- Solo mode (full 17-step flow)
- Together mode with lobby, roles, and real-time sync
- Reflection system (rating, help flag, notes)
- Daily Prayer Report (send/receive messages)
- Offline-first for solo mode
- 5 Supabase tables with RLS

**Deferred from MVP:**
- Streak tracking (intentionally omitted to avoid pressure)
- Push notifications for partner activity
- Historical trend charts for reflections

### Growth Features (Post-MVP)

- Custom scripture sets (user-curated readings)
- Scheduled sessions ("Let's do this every Sunday at 8pm")
- Gentle nudges ("It's been a week — want to reconnect?")
- Reflection history with privacy controls
- Export/share prayer report to journal

### Vision (Future)

- Multiple activity types (Scripture Reading is first of many)
- Guided prompts for post-conflict repair conversations
- Integration with existing mood tracking (correlate moods with sessions)
- Couples devotional content partnerships

---

### Non-Goals

- **Not therapy** — just a structured spiritual connection activity
- **Not competitive** — no leaderboards, no "winning"
- **Not streak-obsessed** — missing days is not a failure
- **Not fixing people** — the goal is connection, not correction

---

## User Journeys

Six narrative scenarios illustrating how different users interact with Scripture Reading across various contexts and edge cases.

### Journey 1: Together Mode — The Repair Ritual

**Persona:** Maya & Jordan, married 4 years

**Opening Scene:**
It's 9:30pm. Maya and Jordan had a tense evening — a disagreement about household responsibilities that left them both quiet at dinner. They're in bed now, phones in hand, the silence heavy. Maya opens My-Love and sees the Scripture Reading feature. She's not sure Jordan will want to, but she taps "Start."

**Rising Action:**
Maya chooses "Together" and "Reader." A gentle prompt appears: *"Waiting for Jordan to join..."* She shows Jordan her phone. He sighs, but opens the app. He sees the invite, chooses "Responder," and joins the lobby. Both tap "Ready." A soft 3...2...1 countdown appears.

The first verse loads: *"He heals the brokenhearted and binds up their wounds."* Maya reads it aloud. Jordan hears her voice crack slightly. He taps "Done" when ready.

The response appears on Jordan's screen: *"Heal what we've wounded—bind up what's torn between us."* He reads it quietly. Something shifts in the room.

**Climax:**
At the reflection screen, Maya rates herself a 3 (struggling) and toggles "I'm sensitive to this." She doesn't write a note — she doesn't need to. The system doesn't judge. Jordan sees his own reflection screen. He rates 4, no flag. They both submit. Step 2 loads.

By step 10, they're both crying a little. Not solved, but softened.

**Resolution:**
At the end, Maya writes in her Daily Prayer Report: *"I'm sorry I got sharp tonight. Thank you for doing this with me."* Jordan writes: *"I love you. Let's try again tomorrow."*

They put their phones down and finally talk — gently this time.

**Capabilities Revealed:**
- Together mode lobby + ready states + countdown
- Role-based screens (Reader/Responder)
- Synchronized phase advancement
- Reflection with rating + help flag
- Daily Prayer Report messaging

---

### Journey 2: Solo Mode — The Quiet Reset

**Persona:** David, in a long-distance relationship

**Opening Scene:**
David's partner Ana is traveling for work, three time zones away. It's late, and David feels disconnected — they've been texting less, and he's anxious. He opens My-Love and taps "Scripture Reading." Ana isn't available, so he chooses "Solo."

**Rising Action:**
The first verse appears: *"The LORD is near to those who have a broken heart..."* David reads it slowly. The response follows: *"Draw near to us. Break our pride, soften our hearts, and rescue what's hurting."* He taps "Continue."

At the reflection, he rates 3 and toggles "I'm sensitive to this." He writes a short note: *"Missing her. Feeling far."*

He moves through the steps at his own pace — some quickly, some slowly. The app doesn't rush him.

**Climax:**
At step 11 (*"Be anxious for nothing..."*), something clicks. He feels his shoulders drop. He's still far from Ana, but he's grounded.

**Resolution:**
At the end, he writes a message for the Daily Prayer Report: *"Did this tonight thinking of you. Step 11 hit me. Love you."*

Ana sees it the next morning. She texts: *"I saw your prayer report. That means so much. Let's do it together when I'm back."*

**Capabilities Revealed:**
- Solo mode full flow
- Asynchronous Daily Prayer Report (partner sees later)
- Self-paced step progression
- Save & Exit / Resume (solo only)
- Offline-capable

---

### Journey 3: Reluctant Partner — The Graceful Fallback

**Persona:** Sam, whose partner Alex is exhausted

**Opening Scene:**
Sam opens Scripture Reading and chooses "Together." Alex is on the couch, half-asleep. Sam shows the invite. Alex mumbles, "Not tonight, babe. I'm wiped."

**Rising Action:**
Sam's in the lobby alone. The screen says: *"Waiting for your partner..."* with a gentle animation. Sam waits a moment, then sees the option: **"Continue solo"** — no guilt, no "Alex didn't join" shame.

Sam taps it. The app smoothly transitions to Solo mode. Sam completes the session alone.

**Climax:**
At the end, Sam still has the option to send a Daily Prayer Report message. Sam writes: *"Did this solo tonight. Just wanted you to know I'm thinking about us. No pressure."*

**Resolution:**
Alex wakes up the next morning and sees the report. It's not an accusation — it's an invitation. Alex texts: *"Thank you for doing that. Let's try together tomorrow."*

**Capabilities Revealed:**
- Lobby fallback to solo (no shame language)
- Daily Prayer Report still generated in solo
- Invitation without pressure
- Neutral copy: "Continue solo" / "Try together later"

---

### Journey 4: Unlinked User — The Solo-Only Path

**Persona:** Chris, newly signed up, partner not linked yet

**Opening Scene:**
Chris just installed My-Love but hasn't completed partner linking. They explore the app and find Scripture Reading. They tap "Start."

**Rising Action:**
The mode selection appears, but "Together" is grayed out with a message: *"Link your partner to do this together."* There's a small "Set up partner" link, but no pressure.

Chris taps "Solo" and begins the session.

**Climax:**
Chris completes the reading alone. At the end, the Daily Prayer Report message step is skipped (no partner to send to), but their reflections are still saved.

**Resolution:**
Later, Chris links their partner. The next time they start, Together mode is available. Their previous solo session stats are preserved.

**Capabilities Revealed:**
- Graceful degradation when partner_id is null
- Together mode disabled with clear explanation
- Solo mode fully functional
- Skip "send message" for unlinked users
- Stats persist across partner linking

---

### Journey 5: Time-Constrained — The Partial Session

**Persona:** Priya, interrupted mid-session

**Opening Scene:**
Priya starts a solo session at lunch break. She gets through 7 steps when her meeting reminder pops up. She needs to stop.

**Rising Action:**
Priya taps the exit button. A prompt appears: *"Save your progress? You can continue later."* She taps "Save & Exit."

**Climax:**
That evening, Priya opens Scripture Reading again. The Overview shows: *"Continue where you left off? (Step 8 of 17)"* She taps "Continue" and resumes.

**Resolution:**
She finishes the remaining 10 steps and completes her Daily Prayer Report. The session is marked complete. Her stats reflect one full session.

**Capabilities Revealed:**
- Partial session save/resume (Solo mode only in MVP)
- Progress indicator on Overview
- Resume prompt on return
- Session marked complete only when step 17 reflections submitted

---

### Journey 6: Reconnection — The Dropped Connection

**Persona:** Mia, whose phone loses signal mid-Together session

**Opening Scene:**
Mia and her partner Eli are in Together mode, on step 9. Mia's phone loses signal (elevator, tunnel, bad wifi). Her screen freezes.

**Rising Action:**
When Mia's connection returns, the app doesn't crash or reset. It shows: *"Reconnecting..."* briefly, then resyncs with the server-authoritative state.

The screen shows she's still on step 9, Reflection phase. Eli has already submitted. Mia submits hers.

**Climax:**
The session resumes seamlessly. They finish the remaining steps together.

**Resolution:**
At the end, neither knows there was a hiccup. The Daily Prayer Report shows all reflections intact.

**Capabilities Revealed:**
- Server-authoritative session state
- Reconnection without data loss
- Best-effort rejoin to current phase (Together mode)
- If partner ends session, it ends cleanly

---

## Journey Requirements Summary

| Journey | Key Capabilities Required |
|---------|---------------------------|
| Together — Repair Ritual | Lobby, ready states, countdown, role-based UI, sync, reflections, Daily Prayer Report |
| Solo — Quiet Reset | Full solo flow, self-paced, async report delivery, save/resume, offline support |
| Reluctant Partner | Lobby fallback to solo, no-shame UX, report still generated |
| Unlinked User | partner_id check, Together disabled gracefully, solo works, skip message step |
| Time-Constrained | Save/resume (solo only MVP), progress persistence, continue prompt |
| Reconnection | Server-authoritative state, reconnect sync, clean session end if partner exits |

---

## MVP Constraints (Lock-Ins from Journeys)

Hard constraints derived from user journey requirements that shape implementation decisions.

1. **Save & Resume:** Solo mode only in MVP. Together mode uses best-effort rejoin to current authoritative phase; if partner ends session, it ends cleanly.

2. **Together Mode Invites:** No push notifications in MVP. Lobby presence only + optional in-app "Send invite" nudge (passive).

3. **Daily Prayer Report:**
   - Solo mode: Partner receives asynchronously (if linked)
   - Unlinked mode: Skip "send message" step entirely; reflections still saved

4. **No-Shame Copy:** All "partner didn't join" or "continue solo" messaging must be neutral and gentle.

5. **Completion Definition:** Session counts as "completed" only when step 17 reflections are submitted. Otherwise status is "in_progress" and resumable (solo).

---

## Web App Specific Requirements

Technical requirements specific to this PWA feature, including responsive design, accessibility, performance, and offline behavior.

### Project-Type Overview

Scripture Reading is a **mobile-first PWA feature** within the existing My-Love SPA. Primary use case is intimate settings (bed, couch) on mobile devices, with graceful desktop support for flexibility.

---

### Responsive Design

| Breakpoint | Priority | Design Approach |
|------------|----------|-----------------|
| Mobile (< 768px) | Primary | Full design attention, touch-optimized |
| Tablet (768-1024px) | Secondary | Scale up gracefully |
| Desktop (> 1024px) | Tertiary | Works, not optimized |

**Mobile-First Principles:**
- Touch targets ≥ 44px
- Readable text without zoom
- Bottom-anchored actions (thumb-friendly)
- No hover-dependent interactions

---

### Accessibility Requirements

**Keyboard Navigation:**
- All controls keyboard accessible (Tab order logical)
- Focus visible on all interactive elements
- No keyboard traps

**Screen Reader Support:**
- Rating scale with clear aria-labels: `"Rating 3 of 5: Okay"` with scale context (Struggling → Strong)
- Phase transitions announced
- Partner status changes announced

**Focus Management:**
- On phase transitions, move focus to new screen header or primary action button
- Don't trap focus; allow natural navigation

**Visual Design:**
- No color-only state indicators (Ready/Not Ready, selected rating)
- Use icons, text labels, or patterns alongside color
- Sufficient contrast ratios (WCAG AA minimum)

**Motion:**
- **MUST** respect `prefers-reduced-motion`
- Disable countdown animations and fades if reduced motion enabled
- Provide instant transitions as alternative

---

### Performance Targets

| Metric | Target | Behavior on Failure |
|--------|--------|---------------------|
| Real-time sync latency | < 500ms typical | Show subtle "Syncing..." indicator |
| Phase transition | < 200ms perceived | Fade transition, don't block |
| Initial load | < 2s on 3G | Skeleton loading states |

**Calm UX over aggressive real-time:**
- Prioritize correctness over speed
- If latency spikes, show smooth "syncing..." not UI jitter
- No jarring state jumps

---

### Offline Behavior

**Solo Mode:**
- Optimistic UI with IndexedDB caching (server is source of truth)
- Changes appear instantly, sync in background
- Resume requires connectivity to fetch latest state
- Graceful degradation: show cached data with "Offline" indicator when disconnected

**Together Mode:**

| Scenario | MVP Behavior |
|----------|--------------|
| Partner goes offline | Show "Partner reconnecting..." indicator |
| Offline persists | Pause phase advancement |
| User wants to exit | Allow clean "End session" |
| Convert to solo | Post-MVP (complex shared state) |

**Post-MVP:** Add "Continue solo" option that properly handles shared state conversion.

---

### Browser Support

Inherited from existing My-Love app:
- Modern browsers with ES6 module support
- Chrome, Safari, Firefox, Edge (latest 2 versions)
- iOS Safari, Chrome for Android
- No IE11 support

---

### Implementation Considerations

**State Sync:**
- Server-authoritative for Together mode
- Supabase Broadcast for real-time events
- Reconnection logic with state resync

**Animation:**
- Framer Motion for transitions (existing pattern)
- Subtle, calming animations
- **MUST** respect `prefers-reduced-motion`

**Testing Priorities (MVP):**
1. Mobile viewport testing (primary)
2. Together-mode sync happy path
3. Reconnect recovery scenarios
4. Solo offline save/resume

---

## Project Scoping & Phased Development

Phased delivery strategy from MVP through growth to vision, with explicit risk mitigation.

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP — deliver the core emotional value (connection, repair, safety) with minimal feature set. Prove the concept works for couples before adding complexity.

**Guiding Principle:** Calm and minimal. Every feature question defaults to "post-MVP" unless essential for core value delivery.

---

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Together Mode — Repair Ritual ✓
- Solo Mode — Quiet Reset ✓
- Reluctant Partner — Graceful Fallback ✓
- Unlinked User — Solo-Only Path ✓
- Time-Constrained — Partial Session (solo) ✓
- Reconnection — Dropped Connection ✓

**Must-Have Capabilities:**

| Capability | Scope |
|------------|-------|
| Overview Page | Basic stats (sessions, steps, avg rating, help count, last completed) |
| Mode Selection | Solo / Together (Together disabled if unlinked) |
| Solo Flow | Full 17 steps, self-paced, offline-capable, resumable |
| Together Flow | Lobby, roles, countdown, synchronized phases (online-required) |
| Reflections | Rating (1-5), help flag, optional note (200 chars) |
| Daily Prayer Report | Send message (300 chars), view partner's message |
| Save/Resume | Solo only |
| Reconnection | Server-authoritative, rejoin to current phase |
| Accessibility | Keyboard nav, aria labels, focus management, reduced motion |

**Network Requirements:**
- **Solo Mode:** Fully offline-capable with IndexedDB; sync when online
- **Together Mode:** Online-required; if either partner offline, show "Reconnecting..." + pause; allow clean "End session"

**Explicitly NOT in MVP:**

| Feature | Reason |
|---------|--------|
| Streak tracking | Avoid pressure |
| Push notifications | Keep calm |
| Partner invite/ping from lobby | Keep passive |
| "Did this help?" prompt | Per-step reflection is enough |
| Convert Together → Solo mid-session | Complex state handling |
| Admin UI | Direct Supabase management |
| Multiple scripture sets | One fixed set first |
| Detailed analytics/trends | Basic stats sufficient |

---

### Phase 2: Growth (Post-MVP)

| Feature | Value |
|---------|-------|
| Partner invite nudge from lobby | Gentle ping option |
| "Did this help you feel closer?" prompt | Aggregate quality signal |
| Convert Together → Solo | Handle interrupted sessions |
| Reflection history view | See past sessions privately |
| Additional scripture sets | Topical variations |

---

### Phase 3: Expansion (Vision)

| Feature | Value |
|---------|-------|
| Admin UI for content | Non-technical content management |
| Custom scripture sets | User-curated readings |
| Scheduled sessions | "Every Sunday at 8pm" |
| Gentle nudges | "It's been a week..." |
| Mood integration | Correlate with mood tracking |
| Multiple activity types | Scripture Reading is first of many |
| Couples devotional partnerships | Content expansion |

---

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Mitigation |
|------|------------|
| Real-time sync complexity | Server-authoritative state; simple broadcast events |
| State machine bugs | Clear phase transitions; extensive Together-mode testing |
| Offline/online edge cases | Solo = offline-first; Together = online-required |

**Market Risks:**

| Risk | Mitigation |
|------|------------|
| Couples don't use it | Start with existing My-Love users; low friction |
| Too religious for some | Framing as "connection ritual" not "Bible study" |
| Too basic | Core emotional value first; features follow |

**Resource Risks:**

| Risk | Mitigation |
|------|------------|
| Scope creep | Strict "post-MVP" default for all new ideas |
| Testing coverage | Prioritized: mobile, sync, reconnect, offline |
| Implementation time | Together-mode is bulk of complexity; solo is simpler |

---

## Functional Requirements

*This is the capability contract. Every feature must trace back to these requirements.*

### Session Management

- **FR1:** User can view the Scripture Reading overview page with session stats
- **FR1a:** User can access Scripture Reading from bottom navigation (add 'scripture' to ViewType and BottomNavigation)
- **FR2:** User can start a new Scripture Reading session
- **FR3:** User can choose between Solo mode and Together mode when starting
- **FR4:** User with no linked partner can only access Solo mode (Together disabled with explanation)
- **FR5:** User can exit a session cleanly at any point
- **FR6:** User can resume an incomplete Solo session from where they left off
- **FR7:** System marks a session as complete only when step 17 reflections are submitted

---

### Solo Mode Flow

- **FR8:** User in Solo mode can progress through all 17 scripture steps at their own pace
- **FR9:** User in Solo mode sees the verse text and can mark "I've read this"
- **FR10:** User in Solo mode sees the response text and can continue to reflection
- **FR11:** User in Solo mode can submit a reflection (rating, help flag, optional note) for each step
- **FR12:** User in Solo mode can save progress and exit mid-session
- **FR13:** User in Solo mode can use the feature with optimistic UI (changes appear instant, sync in background; requires eventual connectivity)

---

### Together Mode Flow

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

### Reflection System

- **FR30:** User can rate their response on a 1-5 scale (Struggling → Strong)
- **FR31:** User can toggle "I want my partner's help / I'm sensitive to this" flag
- **FR32:** User can add an optional note (max 200 characters)
- **FR33:** Reflection rating scale has clear accessible labels

---

### Daily Prayer Report

- **FR34:** User can send an optional message to partner at end of session (max 300 chars)
- **FR35:** User can skip sending a message
- **FR36:** User can view the Daily Prayer Report after session completion
- **FR37:** User can see their own step-by-step ratings and help flags in the report
- **FR38:** User can see partner's message (if sent) in the report
- **FR39:** User with no linked partner skips the send message step (reflections still saved)
- **FR40:** Partner receives Solo session's Daily Prayer Report asynchronously (if linked)
- **FR41:** In Together mode, report shows both users' step-by-step ratings/help flags side-by-side (default shared)

---

### Stats & Progress

- **FR42:** User can view total sessions completed (couple aggregate)
- **FR43:** User can view total steps completed (couple aggregate)
- **FR44:** User can view last session completion date
- **FR45:** User can view average reflection rating (couple aggregate)
- **FR46:** User can view help requests count (couple aggregate)

---

### Partner Integration

- **FR47:** System detects whether user has a linked partner
- **FR48:** User without linked partner sees "Link your partner to do this together" message
- **FR49:** User can navigate to partner linking from Scripture Reading (existing flow)

---

### Accessibility

- **FR50:** User can navigate all controls via keyboard (logical tab order)
- **FR51:** User using screen reader receives clear aria-labels for rating scale
- **FR52:** System moves focus appropriately on phase transitions
- **FR53:** System respects `prefers-reduced-motion` by disabling motion-heavy animations
  - *Note: Countdown can remain but without motion effects.*
- **FR54:** System uses icons/text alongside color for state indicators (not color-only)

---

## Non-Functional Requirements

*Quality attributes specifying HOW WELL the system must perform.*

### Performance

| Requirement | Target | Context |
|-------------|--------|---------|
| **NFR-P1:** Real-time sync latency | < 500ms typical | Together mode phase sync |
| **NFR-P2:** Phase transition perceived speed | < 200ms | No blocking, use fade transitions |
| **NFR-P3:** Initial feature load time | < 2s on 3G | Skeleton loading states |
| **NFR-P4:** UI responsiveness under latency | Show "Syncing..." indicator | No UI jitter or jarring state jumps |

**Principle:** Calm UX over aggressive real-time. Prioritize correctness over speed.

---

### Security & Privacy

| Requirement | Target | Context |
|-------------|--------|---------|
| **NFR-S1:** Reflection data access | User + linked partner only | RLS policies consistent with existing model |
| **NFR-S2:** Session data access | Participants only | No external visibility |
| **NFR-S3:** Daily Prayer Report visibility | Sender + recipient only | Private couple communication |
| **NFR-S4:** Data encryption | At rest and in transit | Supabase default + HTTPS |
| **NFR-S5:** Prior solo data privacy | Private by default after partner linking | Only explicit messages shared retroactively; reflections remain private |

---

### Reliability

| Requirement | Target | Context |
|-------------|--------|---------|
| **NFR-R1:** Session state recovery | 100% | Reconnects resume correctly |
| **NFR-R2:** Data sync reliability | 99.9% | No lost reflections |
| **NFR-R3:** Race condition prevention | Zero double-advances | Server-authoritative state |
| **NFR-R4:** Cache integrity | 100% | IndexedDB cache persists; on corruption, clear and refetch from server |
| **NFR-R5:** Graceful degradation | Feature remains usable | If partner offline, allow clean exit |
| **NFR-R6:** Reflection write idempotency | Unique constraint per session_id + step_index + user_id | No double submits under retries/reconnect |

---

### Accessibility

*Detailed in Functional Requirements (FR50-FR54). Summary:*

| Requirement | Target |
|-------------|--------|
| **NFR-A1:** WCAG compliance | AA minimum |
| **NFR-A2:** Keyboard navigation | Full feature access |
| **NFR-A3:** Screen reader support | All interactive elements labeled |
| **NFR-A4:** Motion sensitivity | Respect `prefers-reduced-motion` |
| **NFR-A5:** Color independence | No color-only indicators |

---

### Integration

| Requirement | Target | Context |
|-------------|--------|---------|
| **NFR-I1:** Supabase compatibility | Full compatibility with existing patterns | Auth, RLS, Realtime Broadcast |
| **NFR-I2:** Existing app integration | Seamless navigation | Use existing ViewType pattern |
| **NFR-I3:** Offline sync pattern | Consistent with existing sync services | IndexedDB + queue pattern |
| **NFR-I4:** State management pattern | Zustand slice composition | Consistent with existing slices |

---

*Scalability: Not a priority for MVP. Couples app with gradual growth. Standard Supabase scaling sufficient.*

---

## Glossary

| Term | Definition |
|------|------------|
| **Solo mode** | Single-user session where one partner completes the Scripture Reading independently, offline-capable and resumable. |
| **Together mode** | Synchronized two-user session where both partners progress through steps in real-time, online-required. |
| **Reader** | The partner role who reads the scripture verse aloud during Together mode. |
| **Responder** | The partner role who reads the response prayer during Together mode. |
| **Lobby** | The waiting room where partners join and ready-up before a Together mode session begins. |
| **Phase** | A distinct stage within each step: Verse (Reader reads), Response (Responder reads), Reflection (both submit). |
| **Reflection** | The user's response after each step: a 1-5 rating, optional help flag, and optional note. |
| **Help flag** / **Sensitive flag** | A toggle indicating "I want my partner's help" or "I'm sensitive to this" — signals vulnerability without requiring explanation. |
| **Daily Prayer Report** | End-of-session summary showing both partners' step-by-step reflections and optional messages to each other. |
| **Server-authoritative state** | Design pattern where the server is the single source of truth for session state, preventing race conditions and ensuring consistency during reconnections. |
| **Broadcast channel** | Supabase Realtime feature used to synchronize Together mode events between partners in real-time. |
| **Optimistic UI** | Architecture pattern where user actions appear instant (stored in IndexedDB cache) while syncing to server in background. Server is source of truth; IndexedDB provides fast reads and graceful offline viewing. |
